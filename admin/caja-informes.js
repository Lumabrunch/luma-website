/* Luma · Admin · Caja – Informes (afluencia, productos, pagos)
   Datos: RPC caja_informe(desde, hasta, pruebas) – solo admin (RLS).
   Datos de prueba: RPC caja_pruebas_generar / caja_pruebas_borrar (solo filas prueba = true). */
(function () {
  var A = window.LumaAdmin; if (!A || !window.LumaCaja) return;
  var sb = A.sb, q = A.q, esc = A.esc, $ = A.$;
  var TZ = 'Europe/Madrid';
  var COL = { uno: '#3F6B34', tarjeta: '#2F6B2A', efectivo: '#E0A526', tarjeta_regalo: '#6250D6', grid: '#ECEAE1', eje: '#8B8E80' };
  var MET = { tarjeta: 'Tarjeta', efectivo: 'Efectivo', tarjeta_regalo: 'Tarjeta regalo' };
  var DSEM = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  var css = document.createElement('style');
  css.textContent =
    '#t-informes .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}' +
    '#t-informes .kpi .n{font-family:Fredoka,sans-serif;font-weight:600;font-size:30px;line-height:1.1;margin-top:4px}' +
    '.dl{font-size:13px;font-weight:700;margin-top:4px}.dl.up{color:#2F4F26}.dl.down{color:#8A3B1E}.dl.eq{color:#6C7161}' +
    '.ch{position:relative;width:100%}.ch svg{display:block;width:100%;overflow:visible}' +
    '.ch text{font-family:Figtree,system-ui,sans-serif;fill:#6C7161;font-size:12px}' +
    '.ch .v{fill:#394A32;font-weight:700}' +
    '.ch .hit{fill:transparent;cursor:default}' +
    '.tip{position:fixed;z-index:20;pointer-events:none;background:#394A32;color:#F7F3E8;border-radius:10px;padding:8px 11px;font-size:13px;line-height:1.35;box-shadow:0 4px 14px rgba(0,0,0,.18);max-width:260px}' +
    '.tip b{font-weight:700}' +
    '.cardh{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:10px}' +
    '.cardh h2{margin:0}.cardh .sub{margin-top:2px}' +
    '.lg{display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:#565B4C;margin:0 0 8px}.lg i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px}' +
    '.prueba{background:#F3E2D6;color:#6A4128;border-radius:12px;padding:10px 14px;font-weight:600;display:flex;gap:10px;align-items:center;flex-wrap:wrap}' +
    '.seg{display:inline-flex;background:#E7E9DA;border-radius:999px;padding:3px}.seg button{border:0;background:transparent;border-radius:999px;padding:6px 12px;font-weight:700;font-size:14px}.seg button.on{background:#394A32;color:#F7F3E8}' +
    '.bar-h{display:grid;grid-template-columns:minmax(110px,180px) 1fr auto;gap:6px 10px;align-items:center;font-size:14px}' +
    '.bar-h .tr{height:14px;background:#F2F1EA;border-radius:4px;overflow:hidden}.bar-h .fl{height:100%;background:' + COL.uno + ';border-radius:0 4px 4px 0}' +
    '.heat{display:grid;gap:3px;font-size:12px;color:#6C7161}.heat .c{height:30px;border-radius:5px}' +
    '.empty{padding:30px 10px;text-align:center;color:#6C7161}';
  document.head.appendChild(css);

  // ---------- formato ----------
  function eur(c, dec) { return (c / 100).toLocaleString('es-ES', { minimumFractionDigits: dec === 0 ? 0 : 2, maximumFractionDigits: dec === 0 ? 0 : 2 }) + ' €'; }
  function num(n, d) { return Number(n).toLocaleString('es-ES', { maximumFractionDigits: d || 0 }); }
  function pct(n) { return num(n * 100, 0) + ' %'; }
  function iso(d) { return d.toLocaleDateString('en-CA', { timeZone: TZ }); }
  function hoy() { return iso(new Date()); }
  function addD(s, n) { var d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function diff(a, b) { return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000); }
  function fD(s) { var d = new Date(s + 'T12:00:00Z'); return DSEM[(d.getUTCDay() + 6) % 7 + 1] + ' ' + d.getUTCDate() + ' ' + MES[d.getUTCMonth()]; }
  function fCorto(s) { var d = new Date(s + 'T12:00:00Z'); return d.getUTCDate() + ' ' + MES[d.getUTCMonth()]; }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  // ---------- estado ----------
  var st = { per: 'mes', desde: null, hasta: null, vista: 'afluencia', medida: 'pedidos', pruebas: false, orden: 'ventas', asc: false, buscar: '', tabla: {} };
  var R = null, Rprev = null;

  function periodo(p) {
    var h = hoy(), d = new Date(h + 'T12:00:00Z'), wd = (d.getUTCDay() + 6) % 7;
    if (p === 'hoy') return [h, h];
    if (p === 'ayer') return [addD(h, -1), addD(h, -1)];
    if (p === 'semana') return [addD(h, -wd), h];
    if (p === '7') return [addD(h, -7), addD(h, -1)];
    if (p === 'mes') return [h.slice(0, 8) + '01', h];
    if (p === 'mesant') { var e = addD(h.slice(0, 8) + '01', -1); return [e.slice(0, 8) + '01', e]; }
    if (p === '30') return [addD(h, -30), addD(h, -1)];
    if (p === 'anio') return [h.slice(0, 4) + '-01-01', h];
    return [st.desde, st.hasta];
  }

  // ---------- tooltip ----------
  var tip = document.createElement('div'); tip.className = 'tip hidden'; document.body.appendChild(tip);
  function tipOn(html, ev) { tip.innerHTML = html; tip.classList.remove('hidden'); tipMove(ev); }
  function tipMove(ev) { var x = ev.clientX + 14, y = ev.clientY + 14, w = tip.offsetWidth, h = tip.offsetHeight; if (x + w > innerWidth - 8) x = ev.clientX - w - 14; if (y + h > innerHeight - 8) y = ev.clientY - h - 14; tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
  function tipOff() { tip.classList.add('hidden'); }
  function bindTips(root, tips) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-t]'), function (n) {
      var t = tips[+n.dataset.t];
      n.addEventListener('mouseenter', function (ev) { tipOn(t, ev); n.dispatchEvent(new CustomEvent('hl', { bubbles: true, detail: +n.dataset.t })); });
      n.addEventListener('mousemove', tipMove);
      n.addEventListener('mouseleave', function () { tipOff(); n.dispatchEvent(new CustomEvent('hl', { bubbles: true, detail: -1 })); });
    });
  }

  // ---------- escalas ----------
  function nice(max) {
    if (max <= 0) return { max: 1, step: 1 };
    var raw = max / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
    return { max: Math.ceil(max / step) * step, step: step };
  }
  function roundTop(x, y, w, h, r) {
    r = Math.min(r, w / 2, h); if (h <= 0) return '';
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }

  // Barras verticales (una serie o apiladas). items: [{label, vals:[...], tip}] ; series: [{name,color}]
  function barras(el, items, series, fmtEje, opt) {
    opt = opt || {};
    var W = Math.max(280, el.clientWidth || 600), H = opt.h || 220, L = 52, Rr = 8, T = 18, B = 26;
    var tot = items.map(function (it) { return it.vals.reduce(function (a, b) { return a + b; }, 0); });
    var sc = nice(Math.max.apply(null, tot.concat([0])));
    var pw = W - L - Rr, ph = H - T - B, n = items.length, slot = pw / Math.max(n, 1), bw = Math.max(3, Math.min(42, slot * 0.62));
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" height="' + H + '" role="img" aria-label="' + esc(opt.aria || '') + '">';
    for (var v = 0; v <= sc.max + 1e-9; v += sc.step) {
      var y = T + ph - v / sc.max * ph;
      s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y + '" y2="' + y + '" stroke="' + (v === 0 ? '#C9C7BB' : COL.grid) + '" stroke-width="1"/>';
      s += '<text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(fmtEje(v)) + '</text>';
    }
    var cada = Math.ceil(n / Math.floor(pw / 46));
    var imax = tot.indexOf(Math.max.apply(null, tot));
    items.forEach(function (it, i) {
      var x = L + i * slot + (slot - bw) / 2, acc = 0;
      it.vals.forEach(function (val, k) {
        if (!val) return;
        var h = val / sc.max * ph, y = T + ph - (acc + val) / sc.max * ph;
        var top = k === it.vals.length - 1 || !it.vals.slice(k + 1).some(Boolean);
        var gap = acc > 0 ? 2 : 0;
        s += top ? '<path class="mk" data-i="' + i + '" d="' + roundTop(x, y, bw, h - gap, 4) + '" fill="' + series[k].color + '"/>'
                 : '<rect class="mk" data-i="' + i + '" x="' + x + '" y="' + y + '" width="' + bw + '" height="' + Math.max(0, h - gap) + '" fill="' + series[k].color + '"/>';
        acc += val;
      });
      if (i % cada === 0 || n <= 12) s += '<text x="' + (L + i * slot + slot / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(it.label) + '</text>';
      if (opt.etiquetaMax && i === imax && tot[i] > 0) s += '<text class="v" x="' + (x + bw / 2) + '" y="' + (T + ph - tot[i] / sc.max * ph - 6) + '" text-anchor="middle">' + esc(opt.etiquetaMax(tot[i])) + '</text>';
      s += '<rect class="hit" data-t="' + i + '" x="' + (L + i * slot) + '" y="' + T + '" width="' + slot + '" height="' + ph + '"/>';
    });
    s += '</svg>';
    el.innerHTML = s; el.classList.add('ch');
    var svg = el.querySelector('svg');
    svg.addEventListener('hl', function (e) { Array.prototype.forEach.call(svg.querySelectorAll('.mk'), function (m) { m.style.opacity = e.detail < 0 || +m.dataset.i === e.detail ? 1 : .45; }); });
    bindTips(el, items.map(function (it) { return it.tip; }));
  }

  // Línea con marcadores y retícula
  function linea(el, items, fmtEje, opt) {
    opt = opt || {};
    var W = Math.max(280, el.clientWidth || 600), H = 220, L = 52, Rr = 12, T = 18, B = 26;
    var vals = items.map(function (i) { return i.v; }), sc = nice(Math.max.apply(null, vals.concat([0])));
    var pw = W - L - Rr, ph = H - T - B, n = items.length, dx = n > 1 ? pw / (n - 1) : 0;
    var X = function (i) { return L + (n > 1 ? i * dx : pw / 2); }, Y = function (v) { return T + ph - v / sc.max * ph; };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" height="' + H + '" role="img" aria-label="' + esc(opt.aria || '') + '">';
    for (var v = 0; v <= sc.max + 1e-9; v += sc.step) s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + (v === 0 ? '#C9C7BB' : COL.grid) + '"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + esc(fmtEje(v)) + '</text>';
    s += '<line class="xh" x1="0" x2="0" y1="' + T + '" y2="' + (T + ph) + '" stroke="#B9BCA8" stroke-dasharray="3 3" visibility="hidden"/>';
    s += '<path d="' + items.map(function (it, i) { return (i ? 'L' : 'M') + X(i) + ',' + Y(it.v); }).join('') + '" fill="none" stroke="' + COL.uno + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    var cada = Math.ceil(n / Math.floor(pw / 56));
    items.forEach(function (it, i) {
      if (i % cada === 0) s += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(it.label) + '</text>';
      s += '<circle class="pt" data-i="' + i + '" cx="' + X(i) + '" cy="' + Y(it.v) + '" r="4" fill="' + COL.uno + '" stroke="#fff" stroke-width="2" visibility="' + (n <= 31 ? 'visible' : 'hidden') + '"/>';
      s += '<rect class="hit" data-t="' + i + '" x="' + (X(i) - Math.max(dx, 8) / 2) + '" y="' + T + '" width="' + Math.max(dx, 8) + '" height="' + ph + '"/>';
    });
    s += '</svg>';
    el.innerHTML = s; el.classList.add('ch');
    var svg = el.querySelector('svg'), xh = svg.querySelector('.xh');
    svg.addEventListener('hl', function (e) {
      if (e.detail < 0) { xh.setAttribute('visibility', 'hidden'); return; }
      xh.setAttribute('x1', X(e.detail)); xh.setAttribute('x2', X(e.detail)); xh.setAttribute('visibility', 'visible');
    });
    bindTips(el, items.map(function (it) { return it.tip; }));
  }

  // ---------- medidas ----------
  var MED = {
    pedidos: { n: 'Pedidos', k: 'pedidos', f: function (v) { return num(v); }, eje: function (v) { return num(v); } },
    ventas: { n: 'Ventas', k: 'ventas_cent', f: function (v) { return eur(v); }, eje: function (v) { return eur(v, 0); } },
    comensales: { n: 'Comensales', k: 'comensales', f: function (v) { return num(v); }, eje: function (v) { return num(v); } }
  };

  // ---------- esqueleto ----------
  function esqueleto() {
    $('t-informes').innerHTML =
      '<div class="row between"><div><h1 class="f">Informes de caja</h1><div class="muted" id="in-per"></div></div>' +
      '<div class="pills"><button class="pill" data-iv="afluencia" type="button">Afluencia</button><button class="pill" data-iv="productos" type="button">Productos</button><button class="pill" data-iv="pagos" type="button">Pagos</button></div></div>' +
      '<div class="card" style="margin-top:16px;display:flex;flex-direction:column;gap:12px">' +
      '<div class="row"><select id="in-p"><option value="hoy">Hoy</option><option value="ayer">Ayer</option><option value="semana">Esta semana</option><option value="7">Últimos 7 días</option><option value="mes" selected>Este mes</option><option value="mesant">Mes anterior</option><option value="30">Últimos 30 días</option><option value="anio">Este año</option><option value="otro">Elegir fechas…</option></select>' +
      '<span id="in-f" class="row hidden"><input type="date" id="in-d"> – <input type="date" id="in-h"><button class="btn s" id="in-ok" type="button">Ver</button></span>' +
      '<label class="chk" style="margin-left:auto"><input type="checkbox" id="in-pr"> Ver datos de prueba</label></div>' +
      '<div id="in-pruebas" class="prueba hidden"></div></div>' +
      '<div id="in-body" style="margin-top:16px;display:flex;flex-direction:column;gap:16px"></div>';
    each('#t-informes [data-iv]', function (b) { b.addEventListener('click', function () { st.vista = b.dataset.iv; pintar(); }); });
    $('in-p').addEventListener('change', function () {
      st.per = this.value; $('in-f').classList.toggle('hidden', st.per !== 'otro');
      if (st.per === 'otro') { var p = periodo('mes'); $('in-d').value = st.desde || p[0]; $('in-h').value = st.hasta || p[1]; return; }
      cargar();
    });
    $('in-ok').addEventListener('click', function () { if (!$('in-d').value || !$('in-h').value || $('in-h').value < $('in-d').value) return; st.desde = $('in-d').value; st.hasta = $('in-h').value; cargar(); });
    $('in-pr').addEventListener('change', function () { st.pruebas = this.checked; cargar(); });
    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { if (R && !$('t-informes').classList.contains('hidden')) pintar(); }, 150); });
  }

  function barraPruebas() {
    var b = $('in-pruebas');
    b.classList.toggle('hidden', !st.pruebas);
    if (!st.pruebas) return;
    b.innerHTML = 'Estás viendo DATOS DE PRUEBA (pedidos inventados para probar los informes). No cuentan en los informes reales.' +
      '<span style="margin-left:auto" class="row"><button class="btn s" id="pr-gen" type="button">Crear pruebas (4 semanas)</button><button class="btn s t" id="pr-del" type="button">Borrar todas las pruebas</button></span>';
    $('pr-gen').addEventListener('click', async function () {
      this.disabled = true; try { var n = await q(sb.rpc('caja_pruebas_generar', { p_dias: 28 })); alert(n + ' pedidos de prueba creados.'); cargar(); } catch (e) { A.fail(e); this.disabled = false; }
    });
    $('pr-del').addEventListener('click', async function () {
      if (!confirm('¿Borrar todos los pedidos de prueba? Los pedidos reales no se tocan.')) return;
      this.disabled = true; try { var n = await q(sb.rpc('caja_pruebas_borrar')); alert(n + ' pedidos de prueba borrados.'); cargar(); } catch (e) { A.fail(e); this.disabled = false; }
    });
  }

  async function cargar() {
    var p = periodo(st.per); st.desde = p[0]; st.hasta = p[1];
    var len = diff(p[0], p[1]) + 1, pd = addD(p[0], -len), ph = addD(p[0], -1);
    $('in-per').textContent = (p[0] === p[1] ? fD(p[0]) : fD(p[0]) + ' – ' + fD(p[1])) + ' · comparado con ' + (pd === ph ? fD(pd) : fD(pd) + ' – ' + fD(ph));
    barraPruebas();
    $('in-body').innerHTML = '<div class="card muted">Cargando…</div>';
    try {
      var r = await Promise.all([
        q(sb.rpc('caja_informe', { p_desde: p[0], p_hasta: p[1], p_pruebas: st.pruebas })),
        q(sb.rpc('caja_informe', { p_desde: pd, p_hasta: ph, p_pruebas: st.pruebas }))
      ]);
      R = r[0]; Rprev = r[1]; pintar();
    } catch (e) { $('in-body').innerHTML = '<div class="card msg err">' + esc(e.message) + '</div>'; }
  }

  // ---------- piezas ----------
  function delta(a, b) {
    if (!b) return '<div class="dl eq">sin datos para comparar</div>';
    var d = (a - b) / b, cls = Math.abs(d) < 0.005 ? 'eq' : d > 0 ? 'up' : 'down';
    return '<div class="dl ' + cls + '">' + (d > 0 ? '▲ +' : d < 0 ? '▼ −' : '') + num(Math.abs(d) * 100, 0) + ' % vs periodo anterior</div>';
  }
  function kpis() {
    var k = R.kpi, p = Rprev.kpi;
    var tm = k.pedidos ? k.ventas_cent / k.pedidos : 0, tmp = p.pedidos ? p.ventas_cent / p.pedidos : 0;
    var pc = k.comensales ? k.ventas_cent / k.comensales : 0, pcp = p.comensales ? p.ventas_cent / p.comensales : 0;
    var t = [['Ventas', eur(k.ventas_cent, k.ventas_cent >= 100000 ? 0 : 2), delta(k.ventas_cent, p.ventas_cent)], ['Pedidos', num(k.pedidos), delta(k.pedidos, p.pedidos)],
      ['Comensales', num(k.comensales), delta(k.comensales, p.comensales)], ['Ticket medio', eur(tm), delta(tm, tmp)], ['Por comensal', eur(pc), delta(pc, pcp)]];
    return '<div class="kpis">' + t.map(function (x) { return '<div class="card kpi"><div class="muted">' + x[0] + '</div><div class="n">' + x[1] + '</div>' + x[2] + '</div>'; }).join('') + '</div>';
  }
  function tarjeta(id, titulo, sub, extra) {
    var tb = st.tabla[id];
    return '<div class="card"><div class="cardh"><div><h2 class="f">' + titulo + '</h2>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' +
      '<div class="row">' + (extra || '') + '<div class="seg"><button type="button" data-tb="' + id + '" data-m="g" class="' + (tb ? '' : 'on') + '">Gráfico</button><button type="button" data-tb="' + id + '" data-m="t" class="' + (tb ? 'on' : '') + '">Tabla</button></div></div></div>' +
      '<div id="' + id + '"></div></div>';
  }
  function tabla(cols, rows) {
    return '<div class="tbl"><table><thead><tr>' + cols.map(function (c) { return '<th' + (c.num ? ' class="num"' : '') + '>' + c.n + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (v, i) { return '<td' + (cols[i].num ? ' class="num"' : '') + '>' + v + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function vacio(el) { el.innerHTML = '<div class="empty">Sin ventas en este periodo.' + (st.pruebas ? '' : ' Cuando la caja nueva esté en marcha, aquí aparecen los datos. Para probar: marca «Ver datos de prueba».') + '</div>'; }
  function segTabs() {
    each('#in-body [data-tb]', function (b) { b.addEventListener('click', function () { st.tabla[b.dataset.tb] = b.dataset.m === 't'; pintar(); }); });
  }
  function medidaSel() {
    return '<div class="seg">' + Object.keys(MED).map(function (k) { return '<button type="button" data-md="' + k + '" class="' + (st.medida === k ? 'on' : '') + '">' + MED[k].n + '</button>'; }).join('') + '</div>';
  }

  // ---------- vistas ----------
  function pintar() {
    each('#t-informes [data-iv]', function (b) { b.classList.toggle('on', b.dataset.iv === st.vista); });
    if (!R) return;
    if (st.vista === 'afluencia') vAfluencia(); else if (st.vista === 'productos') vProductos(); else vPagos();
    segTabs();
    each('#in-body [data-md]', function (b) { b.addEventListener('click', function () { st.medida = b.dataset.md; pintar(); }); });
  }

  function vAfluencia() {
    var M = MED[st.medida], vacioP = !R.kpi.pedidos;
    var unDia = st.desde === st.hasta;
    $('in-body').innerHTML = kpis() +
      tarjeta('g-hora', M.n + ' por hora', 'Según la hora en que se abrió el pedido' + (unDia ? '' : ' · total del periodo'), medidaSel()) +
      (unDia ? '' : tarjeta('g-dow', M.n + ' por día de la semana', 'Media por día abierto (lunes a sábado)') +
        tarjeta('g-dia', M.n + ' por día', 'Cada día del periodo') +
        '<div class="card"><div class="cardh"><div><h2 class="f">Cuándo hay más gente</h2><div class="sub">Pedidos de media por día de la semana y hora · más oscuro = más pedidos</div></div></div><div id="g-calor"></div></div>') +
      tarjeta('g-zona', 'Dentro, terraza o para llevar', '');
    var g = function (id) { return $(id); };
    // por hora
    var horas = []; for (var h = 8; h <= 16; h++) horas.push(h);
    var ph = {}; R.por_hora.forEach(function (x) { ph[x.hora] = x; });
    var hs = horas.filter(function (h) { return ph[h] || (h >= 9 && h <= 15); });
    if (vacioP) vacio(g('g-hora'));
    else if (st.tabla['g-hora']) g('g-hora').innerHTML = tabla([{ n: 'Hora' }, { n: 'Pedidos', num: 1 }, { n: 'Comensales', num: 1 }, { n: 'Ventas', num: 1 }],
      hs.map(function (h) { var x = ph[h] || { pedidos: 0, comensales: 0, ventas_cent: 0 }; return [h + ':00–' + (h + 1) + ':00', num(x.pedidos), num(x.comensales), eur(x.ventas_cent)]; }));
    else barras(g('g-hora'), hs.map(function (h) { var x = ph[h] || {}; var v = x[M.k] || 0;
      return { label: h + 'h', vals: [v], tip: '<b>' + h + ':00–' + (h + 1) + ':00</b><br>' + (x.pedidos ? num(x.pedidos) + ' pedidos · ' + num(x.comensales) + ' comensales<br>' + eur(x.ventas_cent) : 'Sin pedidos') }; }),
      [{ color: COL.uno }], M.eje, { etiquetaMax: M.f, aria: M.n + ' por hora' });
    if (unDia) { zona(); return; }
    // día de la semana (media por día abierto)
    var pw = {}; R.por_dia_semana.forEach(function (x) { pw[x.dow] = x; });
    var ds = [1, 2, 3, 4, 5, 6].concat(pw[7] ? [7] : []);
    if (vacioP) vacio(g('g-dow'));
    else if (st.tabla['g-dow']) g('g-dow').innerHTML = tabla([{ n: 'Día' }, { n: 'Días abiertos', num: 1 }, { n: 'Pedidos / día', num: 1 }, { n: 'Comensales / día', num: 1 }, { n: 'Ventas / día', num: 1 }],
      ds.map(function (d) { var x = pw[d] || { dias: 0 }; var n = x.dias || 1; return [DSEM[d], num(x.dias || 0), num((x.pedidos || 0) / n, 1), num((x.comensales || 0) / n, 1), eur((x.ventas_cent || 0) / n)]; }));
    else barras(g('g-dow'), ds.map(function (d) { var x = pw[d] || {}; var v = x.dias ? (x[M.k] || 0) / x.dias : 0;
      return { label: DSEM[d], vals: [v], tip: '<b>' + DSEM[d] + '</b> · media de ' + num(x.dias || 0) + ' días<br>' + M.n + ': ' + M.f(st.medida === 'ventas' ? Math.round(v) : Math.round(v * 10) / 10) }; }),
      [{ color: COL.uno }], M.eje, { etiquetaMax: function (v) { return M.f(st.medida === 'ventas' ? Math.round(v) : Math.round(v)); }, aria: M.n + ' por día de la semana' });
    // por día
    if (vacioP) vacio(g('g-dia'));
    else if (st.tabla['g-dia']) g('g-dia').innerHTML = tabla([{ n: 'Día' }, { n: 'Pedidos', num: 1 }, { n: 'Comensales', num: 1 }, { n: 'Ventas', num: 1 }],
      R.por_dia.map(function (x) { return [fD(x.dia), num(x.pedidos), num(x.comensales), eur(x.ventas_cent)]; }).reverse());
    else {
      var dias = R.por_dia.filter(function (x) { return new Date(x.dia + 'T12:00:00Z').getUTCDay() !== 0 || x.pedidos; });
      var grupo = dias.length > 400 ? 'mes' : dias.length > 80 ? 'semana' : 'dia';
      if (grupo !== 'dia') {
        var g2 = [], ix = {};
        dias.forEach(function (x) {
          var key = grupo === 'mes' ? x.dia.slice(0, 7) : (function () { var d = new Date(x.dia + 'T12:00:00Z'); return addD(x.dia, -((d.getUTCDay() + 6) % 7)); })();
          if (!ix[key]) { ix[key] = { dia: key, pedidos: 0, comensales: 0, ventas_cent: 0 }; g2.push(ix[key]); }
          ix[key].pedidos += x.pedidos; ix[key].comensales += x.comensales; ix[key].ventas_cent += Number(x.ventas_cent);
        });
        dias = g2;
      }
      var lbl = function (x) { return grupo === 'mes' ? MES[+x.dia.slice(5, 7) - 1] + ' ' + x.dia.slice(2, 4) : fCorto(x.dia); };
      var tl = function (x) { return grupo === 'mes' ? MES[+x.dia.slice(5, 7) - 1] + ' ' + x.dia.slice(0, 4) : grupo === 'semana' ? 'Semana del ' + fD(x.dia) : fD(x.dia); };
      $('g-dia').parentNode.querySelector('h2').textContent = M.n + ' por ' + (grupo === 'mes' ? 'mes' : grupo === 'semana' ? 'semana' : 'día');
      if (grupo !== 'dia') $('g-dia').parentNode.querySelector('.sub').textContent = 'Agrupado por ' + grupo + ' (periodo largo) · la primera y la última pueden estar incompletas';
      var items = dias.map(function (x) { return { label: lbl(x), v: x[M.k], vals: [x[M.k]], tip: '<b>' + tl(x) + '</b><br>' + num(x.pedidos) + ' pedidos · ' + num(x.comensales) + ' comensales<br>' + eur(x.ventas_cent) }; });
      if (items.length > 45) linea(g('g-dia'), items, M.eje, { aria: M.n + ' por día' });
      else barras(g('g-dia'), items, [{ color: COL.uno }], M.eje, { aria: M.n + ' por día' });
    }
    // mapa de calor
    if (vacioP) vacio(g('g-calor')); else calor(g('g-calor'), pw);
    zona();
    function zona() {
      if (vacioP) { vacio(g('g-zona')); return; }
      var tot = R.zonas.reduce(function (a, z) { return a + z.ventas_cent; }, 0) || 1;
      if (st.tabla['g-zona']) { g('g-zona').innerHTML = tabla([{ n: 'Zona' }, { n: 'Pedidos', num: 1 }, { n: 'Comensales', num: 1 }, { n: 'Ventas', num: 1 }, { n: '% ventas', num: 1 }],
        R.zonas.map(function (z) { return [esc(nZona(z.zona)), num(z.pedidos), num(z.comensales), eur(z.ventas_cent), pct(z.ventas_cent / tot)]; })); return; }
      var max = Math.max.apply(null, R.zonas.map(function (z) { return z[M.k]; }));
      g('g-zona').innerHTML = '<div class="bar-h">' + R.zonas.map(function (z, i) {
        return '<div>' + esc(nZona(z.zona)) + '</div><div class="tr" data-t="' + i + '"><div class="fl" style="width:' + (z[M.k] / max * 100) + '%"></div></div><div class="num"><b>' + M.f(z[M.k]) + '</b></div>';
      }).join('') + '</div>';
      bindTips(g('g-zona'), R.zonas.map(function (z) { return '<b>' + esc(nZona(z.zona)) + '</b><br>' + num(z.pedidos) + ' pedidos · ' + num(z.comensales) + ' comensales<br>' + eur(z.ventas_cent) + ' (' + pct(z.ventas_cent / tot) + ')'; }));
    }
  }
  function nZona(z) { return { Inside: 'Dentro', Terrace: 'Terraza', 'Para llevar': 'Para llevar', Mesa: 'Mesa' }[z] || z; }

  function calor(el, pw) {
    var hs = []; for (var h = 9; h <= 15; h++) hs.push(h);
    var c = {}; R.calor.forEach(function (x) { c[x.dow + '-' + x.hora] = x.pedidos; if (hs.indexOf(x.hora) < 0) hs.push(x.hora); });
    hs.sort(function (a, b) { return a - b; });
    var ds = [1, 2, 3, 4, 5, 6].concat(pw[7] ? [7] : []);
    var val = function (d, h) { var n = (pw[d] || {}).dias || 0; return n ? (c[d + '-' + h] || 0) / n : 0; };
    var max = 0; ds.forEach(function (d) { hs.forEach(function (h) { max = Math.max(max, val(d, h)); }); });
    // rampa secuencial verde (un tono, claro → oscuro)
    var a = [238, 242, 232], b = [38, 74, 32];
    var colr = function (v) { var t = max ? Math.pow(v / max, .8) : 0; return 'rgb(' + a.map(function (x, i) { return Math.round(x + (b[i] - x) * t); }).join(',') + ')'; };
    var tips = [], s = '<div class="heat" style="grid-template-columns:44px repeat(' + hs.length + ',1fr)"><div></div>' + hs.map(function (h) { return '<div style="text-align:center">' + h + 'h</div>'; }).join('');
    ds.forEach(function (d) {
      s += '<div style="align-self:center">' + DSEM[d] + '</div>';
      hs.forEach(function (h) { var v = val(d, h); tips.push('<b>' + DSEM[d] + ' ' + h + ':00–' + (h + 1) + ':00</b><br>' + num(v, 1) + ' pedidos de media'); s += '<div class="c" data-t="' + (tips.length - 1) + '" style="background:' + colr(v) + '"></div>'; });
    });
    s += '</div><div class="row" style="margin-top:8px;font-size:12px;color:#6C7161;gap:6px">Menos<span style="display:inline-block;width:120px;height:10px;border-radius:5px;background:linear-gradient(90deg,' + colr(0) + ',' + colr(max) + ')"></span>Más (máx. ' + num(max, 1) + ' pedidos/h)</div>';
    el.innerHTML = s;
    bindTips(el, tips);
  }

  function vProductos() {
    var vacioP = !R.productos.length;
    var bq = st.buscar.toLowerCase();
    var ps = R.productos.filter(function (p) { return !bq || (p.nombre + ' ' + p.categoria).toLowerCase().indexOf(bq) >= 0; });
    var k = st.orden === 'ventas' ? 'ventas_cent' : 'cantidad';
    ps.sort(function (a, b) { return st.asc ? a[k] - b[k] : b[k] - a[k]; });
    var totV = R.productos.reduce(function (a, p) { return a + Number(p.ventas_cent); }, 0) || 1;
    $('in-body').innerHTML = kpis() +
      tarjeta('g-cat', 'Ventas por categoría', 'Importe de los productos (con extras, antes de descuentos)') +
      '<div class="card"><div class="cardh"><div><h2 class="f">Productos</h2><div class="sub">' + num(R.productos.length) + ' productos vendidos en el periodo</div></div>' +
      '<div class="row"><input id="pr-q" type="search" placeholder="Buscar…" value="' + esc(st.buscar) + '" style="width:180px">' +
      '<div class="seg"><button type="button" data-or="ventas" class="' + (st.orden === 'ventas' ? 'on' : '') + '">Por ventas</button><button type="button" data-or="cantidad" class="' + (st.orden === 'cantidad' ? 'on' : '') + '">Por unidades</button></div>' +
      '<div class="seg"><button type="button" data-as="0" class="' + (st.asc ? '' : 'on') + '">Más vendidos</button><button type="button" data-as="1" class="' + (st.asc ? 'on' : '') + '">Menos vendidos</button></div>' +
      '<button class="btn o s" id="pr-csv" type="button">CSV</button></div></div><div id="g-prod"></div></div>' +
      tarjeta('g-opc', 'Extras y opciones más elegidos', '');
    // categorías (barras horizontales)
    var el = $('g-cat');
    if (vacioP) vacio(el);
    else if (st.tabla['g-cat']) el.innerHTML = tabla([{ n: 'Categoría' }, { n: 'Unidades', num: 1 }, { n: 'Ventas', num: 1 }, { n: '%', num: 1 }], R.categorias.map(function (c) { return [esc(c.categoria), num(c.cantidad), eur(c.ventas_cent), pct(c.ventas_cent / totV)]; }));
    else {
      var mx = Math.max.apply(null, R.categorias.map(function (c) { return c.ventas_cent; }));
      el.innerHTML = '<div class="bar-h">' + R.categorias.map(function (c, i) { return '<div>' + esc(c.categoria) + '</div><div class="tr" data-t="' + i + '"><div class="fl" style="width:' + (c.ventas_cent / mx * 100) + '%"></div></div><div class="num"><b>' + eur(c.ventas_cent, 0) + '</b> <span class="muted">' + pct(c.ventas_cent / totV) + '</span></div>'; }).join('') + '</div>';
      bindTips(el, R.categorias.map(function (c) { return '<b>' + esc(c.categoria) + '</b><br>' + num(c.cantidad) + ' unidades · ' + eur(c.ventas_cent) + '<br>' + pct(c.ventas_cent / totV) + ' de las ventas'; }));
    }
    // productos
    var pe = $('g-prod');
    if (vacioP) vacio(pe);
    else {
      var mxp = Math.max.apply(null, R.productos.map(function (p) { return p[k]; })) || 1;
      pe.innerHTML = tabla([{ n: '#' }, { n: 'Producto' }, { n: 'Categoría' }, { n: 'Unidades', num: 1 }, { n: 'Ventas', num: 1 }, { n: '% ventas', num: 1 }, { n: '' }],
        ps.slice(0, 50).map(function (p, i) {
          return [String(i + 1), '<b>' + esc(p.nombre) + '</b>', '<span class="muted">' + esc(p.categoria) + '</span>', num(p.cantidad), eur(p.ventas_cent), pct(p.ventas_cent / totV),
            '<div class="tr" style="width:120px;height:10px;background:#F2F1EA;border-radius:4px;overflow:hidden"><div style="height:100%;border-radius:0 4px 4px 0;background:' + COL.uno + ';width:' + (p[k] / mxp * 100) + '%"></div></div>'];
        })) + (ps.length > 50 ? '<p class="muted">Se muestran 50 de ' + ps.length + '. Usa la búsqueda o el CSV para ver todos.</p>' : '') +
        '<p class="muted">Productos de la carta que no se vendieron en este periodo no salen en la lista; mira «Solo en venta» en la Carta para compararlos.</p>';
    }
    $('pr-q').addEventListener('input', function () { st.buscar = this.value; var pos = this.selectionStart; vProductos(); segTabs(); $('pr-q').focus(); $('pr-q').setSelectionRange(pos, pos); });
    each('#in-body [data-or]', function (b) { b.addEventListener('click', function () { st.orden = b.dataset.or; vProductos(); segTabs(); }); });
    each('#in-body [data-as]', function (b) { b.addEventListener('click', function () { st.asc = b.dataset.as === '1'; vProductos(); segTabs(); }); });
    $('pr-csv').addEventListener('click', function () {
      var rows = [['Producto', 'Categoría', 'Unidades', 'Ventas (€)']].concat(ps.map(function (p) { return [p.nombre, p.categoria, String(p.cantidad).replace('.', ','), (p.ventas_cent / 100).toFixed(2).replace('.', ',')]; }));
      descarga('luma-productos-' + st.desde + '_' + st.hasta + '.csv', rows);
    });
    // opciones
    var oe = $('g-opc');
    if (!R.opciones.length) oe.innerHTML = '<div class="empty">Ningún extra elegido en este periodo.</div>';
    else if (st.tabla['g-opc']) oe.innerHTML = tabla([{ n: 'Opción' }, { n: 'Veces', num: 1 }, { n: 'Suplementos', num: 1 }], R.opciones.map(function (o) { return [esc(o.nombre), num(o.veces), eur(o.ventas_cent)]; }));
    else {
      var mo = Math.max.apply(null, R.opciones.map(function (o) { return o.veces; }));
      oe.innerHTML = '<div class="bar-h">' + R.opciones.slice(0, 15).map(function (o, i) { return '<div>' + esc(o.nombre) + '</div><div class="tr" data-t="' + i + '"><div class="fl" style="width:' + (o.veces / mo * 100) + '%"></div></div><div class="num"><b>' + num(o.veces) + '×</b></div>'; }).join('') + '</div>';
      bindTips(oe, R.opciones.map(function (o) { return '<b>' + esc(o.nombre) + '</b><br>' + num(o.veces) + ' veces · ' + eur(o.ventas_cent) + ' en suplementos'; }));
    }
  }

  function vPagos() {
    var vacioP = !R.pagos.length, tot = R.pagos.reduce(function (a, p) { return a + Number(p.importe_cent); }, 0) || 1;
    var mets = ['tarjeta', 'efectivo', 'tarjeta_regalo'].filter(function (m) { return R.pagos.some(function (p) { return p.metodo === m; }); });
    var leyenda = '<div class="lg">' + mets.map(function (m) { return '<span><i style="background:' + COL[m] + '"></i>' + MET[m] + '</span>'; }).join('') + '</div>';
    $('in-body').innerHTML = kpis() +
      '<div class="kpis">' + (vacioP ? '' : R.pagos.map(function (p) { return '<div class="card kpi"><div class="muted"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;background:' + COL[p.metodo] + '"></i>' + (MET[p.metodo] || p.metodo) + '</div><div class="n">' + eur(p.importe_cent) + '</div><div class="dl eq">' + pct(p.importe_cent / tot) + ' · ' + num(p.veces) + ' pagos</div></div>'; }).join('')) + '</div>' +
      tarjeta('g-pdia', st.desde === st.hasta ? 'Pagos por hora' : 'Pagos por día', 'Importe cobrado por forma de pago') +
      (st.desde === st.hasta ? '' : tarjeta('g-phora', 'Pagos por hora', 'Total del periodo, según la hora del pedido'));
    var porDia = st.desde !== st.hasta;
    function serie(el, keys, rows, lab, tipLab) {
      if (vacioP) { vacio(el); return; }
      var m = {}; rows.forEach(function (r) { (m[r[keys]] = m[r[keys]] || {})[r.metodo] = Number(r.importe_cent); });
      var ks = Object.keys(m).sort(function (a, b) { return keys === 'hora' ? a - b : a < b ? -1 : 1; });
      if (keys === 'dia') ks = R.por_dia.map(function (x) { return x.dia; }).filter(function (d) { return m[d] || new Date(d + 'T12:00:00Z').getUTCDay() !== 0; });
      if (st.tabla[el.id]) { el.innerHTML = tabla([{ n: keys === 'dia' ? 'Día' : 'Hora' }].concat(mets.map(function (x) { return { n: MET[x], num: 1 }; })).concat([{ n: 'Total', num: 1 }]),
        ks.map(function (k) { var r = m[k] || {}; var t = mets.reduce(function (a, x) { return a + (r[x] || 0); }, 0); return [tipLab(k)].concat(mets.map(function (x) { return eur(r[x] || 0); })).concat(['<b>' + eur(t) + '</b>']); })); return; }
      el.innerHTML = leyenda + '<div class="gx"></div>';
      barras(el.querySelector('.gx'), ks.map(function (k) { var r = m[k] || {}; var t = mets.reduce(function (a, x) { return a + (r[x] || 0); }, 0);
        return { label: lab(k), vals: mets.map(function (x) { return r[x] || 0; }), tip: '<b>' + tipLab(k) + '</b><br>' + mets.map(function (x) { return MET[x] + ': ' + eur(r[x] || 0) + (t ? ' (' + pct((r[x] || 0) / t) + ')' : ''); }).join('<br>') + '<br>Total: ' + eur(t) }; }),
        mets.map(function (x) { return { name: MET[x], color: COL[x] }; }), function (v) { return eur(v, 0); }, { aria: 'Pagos' });
    }
    if (porDia) { serie($('g-pdia'), 'dia', R.pagos_dia, fCorto, fD); serie($('g-phora'), 'hora', R.pagos_hora, function (h) { return h + 'h'; }, function (h) { return h + ':00–' + (+h + 1) + ':00'; }); }
    else serie($('g-pdia'), 'hora', R.pagos_hora, function (h) { return h + 'h'; }, function (h) { return h + ':00–' + (+h + 1) + ':00'; });
  }

  function descarga(nombre, rows) {
    var csv = '﻿' + rows.map(function (l) { return l.map(function (c) { c = String(c); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';'); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
  }

  var listo = false;
  window.LumaCaja.informes = function () {
    if (!listo) { esqueleto(); listo = true; }
    cargar();
  };
})();
