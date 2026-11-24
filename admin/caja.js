/* Luma · Admin · Caja – Carta (ver y editar el menú de la caja)
   Datos: Supabase caja_categorias, caja_productos, caja_grupos_opciones, caja_opciones, caja_producto_grupos, caja_impresoras.
   Acceso: solo admin (RLS es_admin()). Cada cambio queda en la tabla historial (trigger). */
(function () {
  var A = window.LumaAdmin; if (!A) return;
  var sb = A.sb, q = A.q, esc = A.esc, $ = A.$;

  var css = document.createElement('style');
  css.textContent =
    '.dlg .card.wide{width:min(720px,100%);max-height:92vh;overflow:auto}' +
    '.cat-pills .pill small{opacity:.7;font-weight:600;margin-left:4px}' +
    '.prn{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;background:#E7E9DA;margin:0 4px 2px 0}' +
    '.prn.cat{background:transparent;border:1px dashed #B9BCA8;color:#6C7161}' +
    '.chk{flex-direction:row;align-items:center;gap:8px;font-weight:600}' +
    '.chk input{width:20px;height:20px}' +
    '.grp-l li{display:flex;justify-content:space-between;gap:10px;align-items:center}' +
    'tr.off td{color:#8B8E80}' +
    '#t-carta td.num,#t-carta th.num{white-space:nowrap}' +
    '.sw{border:0;border-radius:999px;padding:5px 12px 5px 30px;font-size:13px;font-weight:700;background:#EEEDE7;color:#5E6253;position:relative;white-space:nowrap}' +
    '.sw:before{content:"";position:absolute;left:8px;top:50%;width:14px;height:14px;margin-top:-7px;border-radius:50%;background:#B9BCA8}' +
    '.sw.on{background:#DCE8D6;color:#2F4F26}.sw.on:before{background:#3F6B34}' +
    '.opt-l{display:flex;flex-wrap:wrap;gap:6px 14px;margin:6px 0 2px}.opt-l label{flex-direction:row;align-items:center;gap:6px;font-weight:500}' +
    '.grp-l li{flex-wrap:wrap}' +
    '.sub{font-size:13px;color:#6C7161}';
  document.head.appendChild(css);

  var D = { cats: [], prods: [], grupos: [], opts: [], links: [], prns: [], excl: [] };
  var by = {};
  var st = { vista: 'productos', cat: null, buscar: '', ver: 'venta', grupo: null };

  // ---------- utilidades ----------
  function eur(c) { return c == null ? '—' : (c / 100).toFixed(2).replace('.', ',') + ' €'; }
  function cent(v) { v = String(v || '').trim().replace('€', '').replace(/\s/g, '').replace(',', '.'); if (v === '') return null; var n = Math.round(Number(v) * 100); return isNaN(n) || n < 0 ? NaN : n; }
  function ivaTxt(v) { return String(Number(v)) + ' %'; }
  function idx(list) { var m = {}; list.forEach(function (x) { m[x.id] = x; }); return m; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  function wide() { $('dlg-c').classList.add('wide'); }
  function closeDlg() { $('dlg-c').classList.remove('wide'); A.closeDlg(); }
  function dlg(html) { A.dlg(html); var no = $('x-no'); if (no) { no.addEventListener('click', function () { $('dlg-c').classList.remove('wide'); }); } }
  var IVAS = [10, 4, 21, 0];
  function ivaSel(id, v) { return '<select id="' + id + '">' + IVAS.map(function (i) { return '<option value="' + i + '"' + (Number(v) === i ? ' selected' : '') + '>' + i + ' %</option>'; }).join('') + '</select>'; }
  function prnSel(id, v, vacio) {
    return '<select id="' + id + '"><option value="">' + esc(vacio) + '</option>' + D.prns.map(function (p) { return '<option value="' + p.id + '"' + (v === p.id ? ' selected' : '') + '>' + esc(p.nombre) + '</option>'; }).join('') + '</select>';
  }
  function prnTags(p) {
    var c = by.cat[p.categoria_id] || {};
    var own = [p.impresora1_id, p.impresora2_id].filter(Boolean);
    var ids = own.length ? own : [c.impresora1_id, c.impresora2_id].filter(Boolean);
    if (!ids.length) return '<span class="muted">—</span>';
    return ids.map(function (i) { var x = by.prn[i]; return '<span class="prn' + (own.length ? '' : ' cat') + '" title="' + (own.length ? 'Puesto propio' : 'Igual que la categoría') + '">' + esc(x ? x.nombre : '?') + '</span>'; }).join('');
  }
  var TIPO = { una: 'Elegir 1', multiple: 'Varias', max: 'Máx.' };
  function tipoTxt(l) { return l.tipo === 'max' ? 'Máx. ' + (l.max_n || '?') : TIPO[l.tipo] || l.tipo; }

  // ---------- carga ----------
  async function cargar() {
    var r = await Promise.all([
      q(sb.from('caja_categorias').select('*').order('orden')),
      q(sb.from('caja_productos').select('*').order('orden')),
      q(sb.from('caja_grupos_opciones').select('*').order('orden')),
      q(sb.from('caja_opciones').select('*').order('orden')),
      q(sb.from('caja_producto_grupos').select('*').order('orden')),
      q(sb.from('caja_impresoras').select('id,codigo,nombre,activa,orden').order('orden')),
      q(sb.from('caja_producto_opcion_excluida').select('*'))
    ]);
    D = { cats: r[0], prods: r[1], grupos: r[2], opts: r[3], links: r[4], prns: r[5], excl: r[6] };
    by = { cat: idx(D.cats), prod: idx(D.prods), grupo: idx(D.grupos), prn: idx(D.prns) };
  }

  // ---------- vista principal ----------
  function esqueleto() {
    $('t-carta').innerHTML =
      '<div class="row between"><div><h1 class="f">Carta de la caja</h1><div class="muted" id="ca-res"></div></div>' +
      '<div class="pills"><button class="pill" data-v="productos" type="button">Productos</button><button class="pill" data-v="opciones" type="button">Opciones y extras</button></div></div>' +
      '<div class="card" style="margin-top:16px;display:flex;flex-direction:column;gap:12px">' +
      '<div class="row"><input id="ca-q" type="search" placeholder="Buscar producto u opción…" style="flex:1 1 240px">' +
      '<select id="ca-ver"><option value="venta">Solo en venta</option><option value="no">Solo no disponibles</option><option value="todo">Todo (también archivados)</option></select>' +
      '<button class="btn s" id="ca-new" type="button">+ Nuevo</button></div>' +
      '<div class="pills cat-pills" id="ca-cats"></div></div>' +
      '<div id="ca-body" style="margin-top:16px;display:flex;flex-direction:column;gap:16px"></div>' +
      '<p class="muted">Los productos nunca se borran: si algo deja de venderse, ponlo en «No disponible» y actívalo de nuevo cuando vuelva. Los cambios se guardan al momento y quedan en el historial. Los tickets ya cobrados no cambian: cada ticket guarda su propio nombre, precio e IVA. La caja nueva recoge la carta cuando esté en marcha; hasta entonces Tiller sigue igual.</p>';
    each('#t-carta [data-v]', function (b) { b.addEventListener('click', function () { st.vista = b.dataset.v; pintar(); }); });
    $('ca-q').addEventListener('input', function () { st.buscar = this.value; pintar(); });
    $('ca-ver').addEventListener('change', function () { st.ver = this.value; st.cat = null; pintar(); });
    $('ca-new').addEventListener('click', function () { st.vista === 'productos' ? dlgProducto(null) : dlgGrupo(null); });
  }

  function catVisible(c) { return st.ver === 'todo' || !c.archivada; }
  function enVenta(p) { var c = by.cat[p.categoria_id] || {}; return p.activo && c.activa && !c.archivada; }
  function prodVisible(p) {
    var c = by.cat[p.categoria_id] || {};
    if (!catVisible(c)) return false;
    if (st.ver === 'venta' && !enVenta(p)) return false;
    if (st.ver === 'no' && enVenta(p)) return false;
    if (st.buscar && norm([p.nombre_es, p.nombre_en, p.nombre_nl, p.nombre_ticket, p.sku].join(' ')).indexOf(norm(st.buscar)) < 0) return false;
    return true;
  }

  function pintar() {
    each('#t-carta [data-v]', function (b) { b.classList.toggle('on', b.dataset.v === st.vista); });
    $('ca-new').textContent = st.vista === 'productos' ? '+ Nuevo producto' : '+ Nuevo grupo de opciones';
    var act = D.prods.filter(function (p) { var c = by.cat[p.categoria_id] || {}; return p.activo && c.activa && !c.archivada; }).length;
    $('ca-res').textContent = D.cats.filter(function (c) { return c.activa && !c.archivada; }).length + ' categorías activas · ' + act + ' productos activos (' + D.prods.length + ' en total) · ' + D.opts.length + ' opciones';
    if (st.vista === 'productos') pintarProductos(); else pintarOpciones();
  }

  function pintarProductos() {
    var cats = D.cats.filter(catVisible);
    var visibles = D.prods.filter(prodVisible);
    var n = {}; visibles.forEach(function (p) { n[p.categoria_id] = (n[p.categoria_id] || 0) + 1; });
    $('ca-cats').classList.remove('hidden');
    $('ca-cats').innerHTML = '<button class="pill' + (st.cat ? '' : ' on') + '" data-c="" type="button">Todas<small>' + visibles.length + '</small></button>' +
      cats.filter(function (c) { return n[c.id] || st.cat === c.id; }).map(function (c) {
        var tag = c.archivada ? ' · archivada' : !c.activa ? ' · inactiva' : c.temporada ? ' · temporada' : '';
        return '<button class="pill' + (st.cat === c.id ? ' on' : '') + '" data-c="' + c.id + '" type="button">' + esc(c.nombre_es) + '<small>' + (n[c.id] || 0) + tag + '</small></button>';
      }).join('');
    each('#ca-cats [data-c]', function (b) { b.addEventListener('click', function () { st.cat = b.dataset.c || null; pintar(); }); });

    var lista = st.cat ? cats.filter(function (c) { return c.id === st.cat; }) : cats;
    var html = lista.map(function (c) {
      var ps = visibles.filter(function (p) { return p.categoria_id === c.id; });
      if (!ps.length && (st.buscar || !st.cat)) return '';
      var estado = c.archivada ? '<span class="tag off">Archivada</span>' : !c.activa ? '<span class="tag off">Inactiva</span>' : c.temporada ? '<span class="tag warn">Temporada</span>' : '<span class="tag ok">Activa</span>';
      var prn = [c.impresora1_id, c.impresora2_id].filter(Boolean).map(function (i) { return '<span class="prn">' + esc((by.prn[i] || {}).nombre || '?') + '</span>'; }).join('') || '<span class="muted">sin puesto</span>';
      return '<div class="card tbl"><div class="row between" style="margin-bottom:8px"><div><h2 class="f" style="margin:0">' + esc(c.nombre_es) + ' ' + estado + '</h2>' +
        '<div class="sub">IVA ' + ivaTxt(c.iva) + ' · imprime en ' + prn + '</div></div>' +
        '<button class="btn o s" data-ec="' + c.id + '" type="button">Editar categoría</button></div>' +
        '<table><thead><tr><th>Producto</th><th class="num">Precio</th><th class="num">IVA</th><th>Imprime en</th><th>Opciones</th><th>Estado</th></tr></thead><tbody>' +
        (ps.map(function (p) {
          var gs = D.links.filter(function (l) { return l.producto_id === p.id; });
          var sub = p.nombre_ticket && p.nombre_ticket !== p.nombre_es ? '<div class="sub">Ticket: ' + esc(p.nombre_ticket) + '</div>' : '';
          var nEx = D.excl.filter(function (x) { return x.producto_id === p.id; }).length;
          var opTxt = gs.length ? gs.map(function (l) { return esc((by.grupo[l.grupo_id] || {}).nombre || '?'); }).join(', ') + (nEx ? '<div class="sub">' + nEx + ' opciones quitadas</div>' : '') : '<span class="muted">—</span>';
          return '<tr class="click' + (p.activo ? '' : ' off') + '" data-p="' + p.id + '"><td><b>' + esc(p.nombre_es) + '</b>' + sub + '</td><td class="num">' + (p.precio_variable ? 'Variable' : eur(p.precio_cent)) +
            '</td><td class="num">' + ivaTxt(p.iva) + '</td><td>' + prnTags(p) + '</td><td>' + opTxt +
            '</td><td><button class="sw' + (p.activo ? ' on' : '') + '" data-sw="' + p.id + '" type="button" title="Cambiar">' + (p.activo ? 'En venta' : 'No disponible') + '</button></td></tr>';
        }).join('') || '<tr><td colspan="6" class="muted">Sin productos.</td></tr>') + '</tbody></table></div>';
    }).join('');
    $('ca-body').innerHTML = html || '<div class="card muted">Nada encontrado.</div>';
    each('#ca-body [data-p]', function (tr) { tr.addEventListener('click', function () { dlgProducto(by.prod[tr.dataset.p]); }); });
    each('#ca-body [data-sw]', function (b) {
      b.addEventListener('click', async function (ev) {
        ev.stopPropagation(); var p = by.prod[b.dataset.sw]; b.disabled = true;
        try { await q(sb.from('caja_productos').update({ activo: !p.activo, actualizado_en: new Date().toISOString() }).eq('id', p.id)); p.activo = !p.activo; pintar(); }
        catch (e) { b.disabled = false; A.fail(e); }
      });
    });
    each('#ca-body [data-ec]', function (b) { b.addEventListener('click', function () { dlgCategoria(by.cat[b.dataset.ec]); }); });
  }

  function pintarOpciones() {
    $('ca-cats').classList.add('hidden');
    var bq = norm(st.buscar);
    var html = D.grupos.filter(function (g) { return st.ver !== 'venta' || g.activo; }).map(function (g) {
      var os = D.opts.filter(function (o) { return o.grupo_id === g.id && (st.ver === 'todo' || (st.ver === 'venta' ? o.activa : !o.activa)); });
      if (bq && norm(g.nombre).indexOf(bq) < 0) os = os.filter(function (o) { return norm(o.nombre).indexOf(bq) >= 0; });
      if (bq && !os.length && norm(g.nombre).indexOf(bq) < 0) return '';
      var nprod = D.links.filter(function (l) { return l.grupo_id === g.id; }).length;
      return '<div class="card tbl"><div class="row between" style="margin-bottom:8px"><div><h2 class="f" style="margin:0">' + esc(g.nombre) + (g.activo ? '' : ' <span class="tag off">Inactivo</span>') + '</h2>' +
        '<div class="sub">' + os.length + ' opciones · en ' + nprod + ' productos</div></div>' +
        '<div class="row"><button class="btn o s" data-eg="' + g.id + '" type="button">Editar grupo</button><button class="btn s" data-no="' + g.id + '" type="button">+ Opción</button></div></div>' +
        '<table><thead><tr><th>Opción</th><th class="num">Suplemento</th><th class="num">IVA</th><th>Imprime en</th><th>Estado</th></tr></thead><tbody>' +
        (os.map(function (o) {
          var pr = [o.impresora1_id, o.impresora2_id].filter(Boolean).map(function (i) { return '<span class="prn">' + esc((by.prn[i] || {}).nombre || '?') + '</span>'; }).join('') || '<span class="muted">igual que el producto</span>';
          return '<tr class="click' + (o.activa ? '' : ' off') + '" data-o="' + o.id + '"><td><b>' + esc(o.nombre) + '</b></td><td class="num">' + (o.suplemento_cent ? '+ ' + eur(o.suplemento_cent) : '0,00 €') +
            '</td><td class="num">' + ivaTxt(o.iva) + '</td><td>' + pr + '</td><td>' + (o.activa ? '<span class="tag ok">Activa</span>' : '<span class="tag off">No disponible</span>') + '</td></tr>';
        }).join('') || '<tr><td colspan="5" class="muted">Sin opciones.</td></tr>') + '</tbody></table></div>';
    }).join('');
    $('ca-body').innerHTML = html || '<div class="card muted">Nada encontrado.</div>';
    var oById = idx(D.opts);
    each('#ca-body [data-o]', function (tr) { tr.addEventListener('click', function () { dlgOpcion(oById[tr.dataset.o], null); }); });
    each('#ca-body [data-eg]', function (b) { b.addEventListener('click', function () { dlgGrupo(by.grupo[b.dataset.eg]); }); });
    each('#ca-body [data-no]', function (b) { b.addEventListener('click', function () { dlgOpcion(null, b.dataset.no); }); });
  }

  async function recargar() { await cargar(); pintar(); }
  function botones(txtOk) { return '<div class="msg err" id="x-e"></div><div class="row"><button class="btn" id="x-ok" type="button">' + (txtOk || 'Guardar') + '</button><button class="btn o" id="x-no" type="button">Cancelar</button></div>'; }
  function guardar(fn) {
    $('x-ok').addEventListener('click', async function () {
      var b = this; b.disabled = true; $('x-e').textContent = '';
      try { var r = await fn(); if (r === false) { b.disabled = false; return; } closeDlg(); await recargar(); }
      catch (err) { b.disabled = false; $('x-e').textContent = /duplicate|unique/i.test(err.message) ? 'Ya existe otro con ese nombre o SKU.' : err.message; }
    });
  }

  // ---------- producto ----------
  function dlgProducto(p) {
    var nuevo = !p; p = p || { categoria_id: st.cat || (D.cats.filter(catVisible)[0] || {}).id, iva: 10, activo: true, precio_cent: null };
    var c = by.cat[p.categoria_id] || {};
    var links = p.id ? D.links.filter(function (l) { return l.producto_id === p.id; }) : [];
    dlg('<h2 class="f">' + (nuevo ? 'Nuevo producto' : esc(p.nombre_es)) + '</h2>' +
      '<div class="form">' +
      '<label>Nombre<input id="x-es" value="' + esc(p.nombre_es) + '"></label>' +
      '<label>Nombre corto en el ticket<input id="x-tk" maxlength="32" value="' + esc(p.nombre_ticket) + '" placeholder="igual que ES"></label>' +
      '<label>Categoría<select id="x-cat">' + D.cats.map(function (k) { return '<option value="' + k.id + '"' + (k.id === p.categoria_id ? ' selected' : '') + '>' + esc(k.nombre_es) + (k.archivada ? ' (archivada)' : '') + '</option>'; }).join('') + '</select></label>' +
      '<label>Precio con IVA (€)<input id="x-pr" inputmode="decimal" value="' + (p.precio_cent != null ? (p.precio_cent / 100).toFixed(2).replace('.', ',') : '') + '"></label>' +
      '<label>IVA' + ivaSel('x-iva', p.iva) + '</label>' +
      '<label>Coste (€, opcional)<input id="x-co" inputmode="decimal" value="' + (p.coste_cent != null ? (p.coste_cent / 100).toFixed(2).replace('.', ',') : '') + '"></label>' +
      '<label>Imprime en<select id="x-p1"></select></label><label>Y también en<select id="x-p2"></select></label>' +
      '<label>SKU (opcional)<input id="x-sku" value="' + esc(p.sku) + '"></label>' +
      '<label>Orden<input id="x-ord" type="number" value="' + (p.orden != null ? p.orden : '') + '"></label>' +
      '</div>' +
      '<label class="chk"><input type="checkbox" id="x-var"' + (p.precio_variable ? ' checked' : '') + '> Precio variable (se pide en la caja)</label>' +
      '<label class="chk"><input type="checkbox" id="x-act"' + (p.activo ? ' checked' : '') + '> En venta (quita el visto para guardarlo sin venderlo; vuelve a activarlo cuando quieras)</label>' +
      (nuevo ? '' : '<div><h3 class="f" style="margin:8px 0 4px">Opciones de este producto</h3><p class="muted" style="margin:0 0 6px">Quita el visto de lo que no va con este producto (p. ej. «extra huevo» en un café). Se guarda al momento.</p><ul class="lst grp-l" id="x-gl"></ul>' +
        '<div class="row" style="margin-top:8px"><select id="x-gadd" style="flex:1 1 200px"><option value="">Añadir grupo de opciones…</option>' + D.grupos.map(function (g) { return '<option value="' + g.id + '">' + esc(g.nombre) + '</option>'; }).join('') + '</select>' +
        '<select id="x-gtipo"><option value="multiple">Varias</option><option value="una">Elegir 1</option><option value="max">Máx. 3</option></select>' +
        '<select id="x-gap"><option value="auto">Se abre solo</option><option value="boton">Con botón</option></select>' +
        '<button class="btn o s" id="x-gbtn" type="button">Añadir</button></div></div>') +
      botones());
    wide();
    function puestos() {
      var k = by.cat[$('x-cat').value] || {};
      var base = [k.impresora1_id, k.impresora2_id].filter(Boolean).map(function (i) { return (by.prn[i] || {}).nombre; }).join(' + ') || 'ninguno';
      $('x-p1').outerHTML = prnSel('x-p1', p.impresora1_id || '', 'Igual que la categoría (' + base + ')');
      $('x-p2').outerHTML = prnSel('x-p2', p.impresora2_id || '', '— nada más —');
    }
    puestos();
    $('x-cat').addEventListener('change', function () { p.impresora1_id = $('x-p1').value || null; p.impresora2_id = $('x-p2').value || null; puestos(); });
    if (!nuevo) {
      var pintaLinks = function () {
        $('x-gl').innerHTML = links.map(function (l) {
          var os = D.opts.filter(function (o) { return o.grupo_id === l.grupo_id; });
          var cb = os.map(function (o) {
            var on = !D.excl.some(function (x) { return x.producto_id === p.id && x.opcion_id === o.id; });
            return '<label><input type="checkbox" data-ox="' + o.id + '"' + (on ? ' checked' : '') + '>' + esc(o.nombre) + (o.suplemento_cent ? ' <span class="sub">+' + eur(o.suplemento_cent) + '</span>' : '') + (o.activa ? '' : ' <span class="sub">(no disponible)</span>') + '</label>';
          }).join('');
          return '<li><span><b>' + esc((by.grupo[l.grupo_id] || {}).nombre || '?') + '</b> <span class="sub">· ' + tipoTxt(l) + ' · ' + (l.apertura === 'auto' ? 'se abre solo' : 'con botón') + '</span></span>' +
            '<button class="btn o s" data-rm="' + l.grupo_id + '" type="button">Quitar grupo</button>' +
            '<div class="opt-l" style="flex-basis:100%">' + (cb || '<span class="muted">Este grupo no tiene opciones.</span>') + '</div></li>';
        }).join('') || '<li class="muted">Sin opciones.</li>';
        each('#x-gl [data-ox]', function (c) {
          c.addEventListener('change', async function () {
            var oid = c.dataset.ox; c.disabled = true;
            try {
              if (c.checked) { await q(sb.from('caja_producto_opcion_excluida').delete().eq('producto_id', p.id).eq('opcion_id', oid)); D.excl = D.excl.filter(function (x) { return !(x.producto_id === p.id && x.opcion_id === oid); }); }
              else { await q(sb.from('caja_producto_opcion_excluida').insert({ producto_id: p.id, opcion_id: oid })); D.excl.push({ producto_id: p.id, opcion_id: oid }); }
            } catch (e) { c.checked = !c.checked; $('x-e').textContent = e.message; }
            c.disabled = false;
          });
        });
        each('#x-gl [data-rm]', function (b) {
          b.addEventListener('click', async function () {
            try {
              var oids = D.opts.filter(function (o) { return o.grupo_id === b.dataset.rm; }).map(function (o) { return o.id; });
              if (oids.length) await q(sb.from('caja_producto_opcion_excluida').delete().eq('producto_id', p.id).in('opcion_id', oids));
              D.excl = D.excl.filter(function (x) { return !(x.producto_id === p.id && oids.indexOf(x.opcion_id) >= 0); });
              await q(sb.from('caja_producto_grupos').delete().eq('producto_id', p.id).eq('grupo_id', b.dataset.rm)); links = links.filter(function (l) { return l.grupo_id !== b.dataset.rm; }); D.links = D.links.filter(function (l) { return !(l.producto_id === p.id && l.grupo_id === b.dataset.rm); }); pintaLinks(); }
            catch (e) { $('x-e').textContent = e.message; }
          });
        });
      };
      pintaLinks();
      $('x-gbtn').addEventListener('click', async function () {
        var g = $('x-gadd').value; if (!g) return;
        if (links.some(function (l) { return l.grupo_id === g; })) { $('x-e').textContent = 'Ese grupo ya está.'; return; }
        var t = $('x-gtipo').value;
        var row = { producto_id: p.id, grupo_id: g, orden: links.length, apertura: $('x-gap').value, tipo: t, max_n: t === 'max' ? 3 : null, obligatorio: false };
        try { var r = await q(sb.from('caja_producto_grupos').insert(row).select()); links.push(r[0]); D.links.push(r[0]); pintaLinks(); $('x-gadd').value = ''; $('x-e').textContent = ''; }
        catch (e) { $('x-e').textContent = e.message; }
      });
    }
    guardar(async function () {
      var es = $('x-es').value.trim(), pr = cent($('x-pr').value), co = cent($('x-co').value), vari = $('x-var').checked;
      if (!es) { $('x-e').textContent = 'Falta el nombre en español.'; return false; }
      if (!vari && (pr == null || isNaN(pr))) { $('x-e').textContent = 'Escribe un precio válido (p. ej. 4,95).'; return false; }
      if (isNaN(co)) { $('x-e').textContent = 'El coste no es un número válido.'; return false; }
      var ord = $('x-ord').value;
      var row = {
        nombre_es: es,
        nombre_ticket: $('x-tk').value.trim() || es, categoria_id: $('x-cat').value,
        precio_cent: pr == null || isNaN(pr) ? 0 : pr, coste_cent: co, iva: Number($('x-iva').value),
        impresora1_id: $('x-p1').value || null, impresora2_id: $('x-p2').value || null,
        sku: $('x-sku').value.trim() || null, precio_variable: vari, activo: $('x-act').checked,
        orden: ord === '' ? (nuevo ? D.prods.filter(function (x) { return x.categoria_id === $('x-cat').value; }).length : p.orden) : Number(ord),
        actualizado_en: new Date().toISOString()
      };
      if (row.impresora2_id && row.impresora2_id === row.impresora1_id) row.impresora2_id = null;
      if (!row.impresora1_id && row.impresora2_id) { row.impresora1_id = row.impresora2_id; row.impresora2_id = null; }
      if (nuevo) await q(sb.from('caja_productos').insert(row)); else await q(sb.from('caja_productos').update(row).eq('id', p.id));
    });
  }

  // ---------- categoría ----------
  function dlgCategoria(c) {
    dlg('<h2 class="f">Categoría · ' + esc(c.nombre_es) + '</h2>' +
      '<div class="form">' +
      '<label>Nombre<input id="x-es" value="' + esc(c.nombre_es) + '"></label>' +
      '<label>IVA de la categoría' + ivaSel('x-iva', c.iva) + '</label>' +
      '<label>Imprime en' + prnSel('x-p1', c.impresora1_id || '', '— ninguno —') + '</label>' +
      '<label>Y también en' + prnSel('x-p2', c.impresora2_id || '', '— nada más —') + '</label>' +
      '<label>Orden<input id="x-ord" type="number" value="' + c.orden + '"></label>' +
      '</div>' +
      '<label class="chk"><input type="checkbox" id="x-act"' + (c.activa ? ' checked' : '') + '> Activa (se ve en la caja)</label>' +
      '<label class="chk"><input type="checkbox" id="x-tem"' + (c.temporada ? ' checked' : '') + '> De temporada</label>' +
      '<label class="chk"><input type="checkbox" id="x-arc"' + (c.archivada ? ' checked' : '') + '> Archivada (ya no se usa)</label>' +
      '<p class="muted">El IVA y los puestos de la categoría valen para los productos que no tienen uno propio. Cambiar el IVA aquí no cambia los productos que ya tienen su IVA.</p>' +
      botones());
    wide();
    guardar(async function () {
      var es = $('x-es').value.trim(); if (!es) { $('x-e').textContent = 'Falta el nombre.'; return false; }
      var row = { nombre_es: es, iva: Number($('x-iva').value),
        impresora1_id: $('x-p1').value || null, impresora2_id: $('x-p2').value || null, orden: Number($('x-ord').value || 0),
        activa: $('x-act').checked && !$('x-arc').checked, temporada: $('x-tem').checked, archivada: $('x-arc').checked };
      if (row.impresora2_id && row.impresora2_id === row.impresora1_id) row.impresora2_id = null;
      await q(sb.from('caja_categorias').update(row).eq('id', c.id));
    });
  }

  // ---------- grupos y opciones ----------
  function dlgGrupo(g) {
    var nuevo = !g; g = g || { activo: true, orden: D.grupos.length };
    var usados = g.id ? D.links.filter(function (l) { return l.grupo_id === g.id; }).map(function (l) { return (by.prod[l.producto_id] || {}).nombre_es; }).filter(Boolean) : [];
    dlg('<h2 class="f">' + (nuevo ? 'Nuevo grupo de opciones' : 'Grupo · ' + esc(g.nombre)) + '</h2>' +
      '<label>Nombre<input id="x-n" value="' + esc(g.nombre) + '"></label>' +
      '<label>Orden<input id="x-ord" type="number" value="' + g.orden + '"></label>' +
      '<label class="chk"><input type="checkbox" id="x-act"' + (g.activo ? ' checked' : '') + '> Activo</label>' +
      (usados.length ? '<p class="muted">Se usa en: ' + esc(usados.join(', ')) + '</p>' : '') + botones());
    guardar(async function () {
      var n = $('x-n').value.trim(); if (!n) { $('x-e').textContent = 'Falta el nombre.'; return false; }
      var row = { nombre: n, orden: Number($('x-ord').value || 0), activo: $('x-act').checked };
      if (nuevo) await q(sb.from('caja_grupos_opciones').insert(row)); else await q(sb.from('caja_grupos_opciones').update(row).eq('id', g.id));
    });
  }
  function dlgOpcion(o, grupoId) {
    var nuevo = !o; o = o || { grupo_id: grupoId, iva: 10, activa: true, suplemento_cent: 0, orden: D.opts.filter(function (x) { return x.grupo_id === grupoId; }).length };
    dlg('<h2 class="f">' + (nuevo ? 'Nueva opción' : esc(o.nombre)) + ' <span class="sub">· ' + esc((by.grupo[o.grupo_id] || {}).nombre) + '</span></h2>' +
      '<div class="form">' +
      '<label>Nombre<input id="x-n" value="' + esc(o.nombre) + '"></label>' +
      '<label>Suplemento con IVA (€)<input id="x-pr" inputmode="decimal" value="' + (o.suplemento_cent / 100).toFixed(2).replace('.', ',') + '"></label>' +
      '<label>IVA' + ivaSel('x-iva', o.iva) + '</label>' +
      '<label>Coste (€, opcional)<input id="x-co" inputmode="decimal" value="' + (o.coste_cent != null ? (o.coste_cent / 100).toFixed(2).replace('.', ',') : '') + '"></label>' +
      '<label>Imprime en' + prnSel('x-p1', o.impresora1_id || '', 'Igual que el producto') + '</label>' +
      '<label>Y también en' + prnSel('x-p2', o.impresora2_id || '', '— nada más —') + '</label>' +
      '<label>Orden<input id="x-ord" type="number" value="' + o.orden + '"></label>' +
      '</div><label class="chk"><input type="checkbox" id="x-act"' + (o.activa ? ' checked' : '') + '> Disponible</label>' + botones());
    wide();
    guardar(async function () {
      var n = $('x-n').value.trim(), pr = cent($('x-pr').value), co = cent($('x-co').value);
      if (!n) { $('x-e').textContent = 'Falta el nombre.'; return false; }
      if (pr == null) pr = 0;
      if (isNaN(pr) || isNaN(co)) { $('x-e').textContent = 'Escribe un importe válido (p. ej. 0,50).'; return false; }
      var row = { grupo_id: o.grupo_id, nombre: n, suplemento_cent: pr, coste_cent: co, iva: Number($('x-iva').value),
        impresora1_id: $('x-p1').value || null, impresora2_id: $('x-p2').value || null, orden: Number($('x-ord').value || 0), activa: $('x-act').checked };
      if (row.impresora2_id && row.impresora2_id === row.impresora1_id) row.impresora2_id = null;
      if (nuevo) await q(sb.from('caja_opciones').insert(row)); else await q(sb.from('caja_opciones').update(row).eq('id', o.id));
    });
  }

  // ---------- entrada ----------
  var listo = false;
  async function abrirCarta() {
    try {
      if (!listo) { esqueleto(); listo = true; }
      $('ca-body').innerHTML = '<div class="card muted">Cargando la carta…</div>';
      await cargar(); pintar();
    } catch (e) { A.fail(e); }
  }
  window.LumaCaja = { carta: abrirCarta };
})();
