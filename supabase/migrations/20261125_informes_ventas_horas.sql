-- Resumen diario para Informes. La vista jornadas es también la fuente de Admin → Horas.
create or replace function public.caja_informe_ventas_horas(p_desde date, p_hasta date, p_pruebas boolean default false)
returns table (
  dia date,
  ventas_sin_iva_cent bigint,
  minutos_trabajados bigint,
  provisional boolean,
  ventas_por_hora_cent numeric
)
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
begin
  if not coalesce(public.es_admin(), false) then
    raise exception 'Solo administración' using errcode = '42501';
  end if;

  return query
  with
  dias as (
    select p_desde + n as fecha from generate_series(0, p_hasta - p_desde) as g(n)
  ),
  -- Mismos pedidos, pagos y fecha de imputación que caja_informe.
  pedidos as (
    select p.id, (coalesce(p.cerrado_en, p.abierto_en) at time zone 'Europe/Madrid')::date as fecha
    from caja_pedidos p
    where p.estado = 'pagado' and p.prueba = p_pruebas
      and coalesce(p.cerrado_en, p.abierto_en) >= (p_desde::timestamp at time zone 'Europe/Madrid')
      and coalesce(p.cerrado_en, p.abierto_en) < ((p_hasta + 1)::timestamp at time zone 'Europe/Madrid')
  ),
  cobros as (
    select p.id, p.fecha, coalesce(sum(g.importe_cent), 0)::bigint as bruto
    from pedidos p
    left join caja_pagos g on g.pedido_id = p.id
    group by p.id, p.fecha
  ),
  -- Prioridad a las facturas referenciadas por los pagos. Cada factura se cuenta una sola vez.
  facturas_pago as (
    select distinct p.id, f.id as factura_id, f.total_cent, f.cuota_cent
    from pedidos p
    join caja_pagos g on g.pedido_id = p.id
    join caja_facturas f on f.id = g.factura_id and f.prueba = p_pruebas
  ),
  iva_pago as (
    select f.id, sum(f.total_cent) as total, sum(f.cuota_cent) as cuota
    from facturas_pago f
    group by f.id
    having count(*) = count(f.total_cent) and count(*) = count(f.cuota_cent)
  ),
  iva_pedido as (
    select p.id, sum(f.total_cent) as total, sum(f.cuota_cent) as cuota
    from pedidos p
    join caja_facturas f on f.pedido_id = p.id and f.prueba = p_pruebas and f.tipo in ('F1', 'F2')
    group by p.id
    having count(*) = count(f.total_cent) and count(*) = count(f.cuota_cent)
  ),
  lineas as (
    select l.id, l.pedido_id, l.cantidad, l.precio_cent, l.iva
    from pedidos p join caja_lineas l on l.pedido_id = p.id
    where not l.anulada
  ),
  conceptos as (
    select l.id as linea_id, l.pedido_id, l.cantidad * l.precio_cent as bruto, l.iva
    from lineas l
    union all
    select l.id, l.pedido_id, l.cantidad * o.cantidad * o.suplemento_cent, o.iva
    from lineas l join caja_linea_opciones o on o.linea_id = l.id
  ),
  base_linea as (
    select c.linea_id, sum(c.bruto) as bruto from conceptos c group by c.linea_id
  ),
  descuentos_linea as (
    select l.id, sum(d.importe_cent) as importe
    from lineas l join caja_descuentos d on d.linea_id = l.id and d.pedido_id = l.pedido_id
    group by l.id
  ),
  pesos as (
    select c.pedido_id, c.iva,
      c.bruto * case when b.bruto > 0
        then greatest(0::numeric, b.bruto - coalesce(d.importe, 0)) / b.bruto else 1 end as peso
    from conceptos c
    join base_linea b on b.linea_id = c.linea_id
    left join descuentos_linea d on d.id = c.linea_id
  ),
  -- Sin factura conciliada, distribuye el importe realmente cobrado entre los tipos de IVA.
  -- Los descuentos de línea reducen su peso; el descuento general ya se refleja en el cobro.
  pesos_validos as (
    select p.pedido_id, sum(p.peso) as total
    from pesos p
    group by p.pedido_id
    having sum(p.peso) > 0 and not bool_or(p.peso <> 0 and (p.iva is null or p.iva < 0))
  ),
  pesos_por_iva as (
    select p.pedido_id, p.iva, sum(p.peso) as peso
    from pesos p
    where p.peso <> 0
    group by p.pedido_id, p.iva
  ),
  asignacion_iva as (
    select p.pedido_id, p.iva,
      round(c.bruto * sum(p.peso) over (partition by p.pedido_id order by p.iva) / v.total) as acumulado
    from pesos_por_iva p
    join pesos_validos v on v.pedido_id = p.pedido_id
    join cobros c on c.id = p.pedido_id
  ),
  importes_iva as (
    select a.pedido_id, a.iva,
      a.acumulado - lag(a.acumulado, 1, 0::numeric) over (partition by a.pedido_id order by a.iva) as bruto
    from asignacion_iva a
  ),
  iva_calculado as (
    select i.pedido_id, sum(i.bruto - round(i.bruto * 100 / (100 + i.iva))) as cuota
    from importes_iva i
    group by i.pedido_id
  ),
  neto as (
    select c.fecha,
      case
        when c.bruto = 0 then 0
        when ip.total = c.bruto then c.bruto - ip.cuota
        when il.total = c.bruto then c.bruto - il.cuota
        when ic.cuota is not null then c.bruto - ic.cuota
      end as importe
    from cobros c
    left join iva_pago ip on ip.id = c.id
    left join iva_pedido il on il.id = c.id
    left join iva_calculado ic on ic.pedido_id = c.id
  ),
  ventas as (
    select n.fecha, case when count(*) = count(n.importe) then sum(n.importe)::bigint end as importe
    from neto n group by n.fecha
  ),
  equipo as (
    select j.fecha,
      coalesce(sum(j.minutos_trabajados) filter (where j.entrada is not null and j.salida is not null), 0)::bigint as minutos,
      bool_or(j.entrada is not null and j.salida is null) as sin_salida
    from jornadas j
    where j.fecha between p_desde and p_hasta
    group by j.fecha
  ),
  resumen as (
    select d.fecha, case when v.fecha is null then 0::bigint else v.importe end as ventas,
      coalesce(e.minutos, 0::bigint) as minutos, coalesce(e.sin_salida, false) as provisional
    from dias d
    left join ventas v on v.fecha = d.fecha
    left join equipo e on e.fecha = d.fecha
  )
  select r.fecha, r.ventas, r.minutos, r.provisional,
    round(r.ventas::numeric * 60 / nullif(r.minutos, 0), 2)
  from resumen r order by r.fecha;
end;
$$;

revoke all on function public.caja_informe_ventas_horas(date, date, boolean) from public, anon;
grant execute on function public.caja_informe_ventas_horas(date, date, boolean) to authenticated;
