-- La tableta y el PIN se validan mediante el mismo RPC que ya protege el horario.
create or replace function public.mis_turnos_con_horas(p_token text, p_empleado uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  turnos jsonb;
  hoy date := (now() at time zone 'Europe/Madrid')::date;
  lunes date := date_trunc('week', hoy::timestamp)::date;
  minutos bigint;
  provisional boolean;
begin
  if p_empleado is null or p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'error', 'PIN incorrecto');
  end if;
  turnos := public.mis_turnos(p_token, p_empleado, p_pin)::jsonb;
  if turnos -> 'ok' is distinct from 'true'::jsonb then
    return turnos;
  end if;

  select coalesce(sum(j.minutos_trabajados) filter (where j.salida is not null), 0),
    coalesce(bool_or(j.salida is null), false)
  into minutos, provisional
  from public.jornadas j
  where j.empleado_id = p_empleado
    and j.fecha between lunes and hoy
    and j.entrada is not null;

  return turnos || jsonb_build_object('horas_semana', jsonb_build_object(
    'desde', lunes, 'hasta', lunes + 6, 'minutos', minutos, 'provisional', provisional));
end;
$$;

revoke all on function public.mis_turnos_con_horas(text, uuid, text) from public;
grant execute on function public.mis_turnos_con_horas(text, uuid, text) to anon, authenticated;
