/* Luma · Admin · Horario – ver y cambiar el horario de 2 semanas
   Datos: Supabase periodos_rooster, turnos, puestos, ausencias, empleados, ajustes; 'modificado' sale de historial.
   Acceso: solo admin (RLS es_admin()). Cada cambio en turnos queda en historial (trigger turnos_historial).
   Un turno de un periodo aprobado vale enseguida para 'Mis turnos' (tableta) y para el control de retrasos (vista jornadas).
   No se envía nada al personal. */
(function () {
  var A = window.LumaAdmin; if (!A) return;
  var sb = A.sb, q = A.q, esc = A.esc, $ = A.$;
  var TZ = 'Europe/Madrid';
  var DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var DIAS_L = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var AUS = { vacaciones: 'VACACIONES', baja: 'BAJA', no_retribuido: 'PERMISO', permiso_retribuido: 'PERMISO', festivo: 'FESTIVO' };
  var ORDEN = ['Jill', 'Almu', 'Dayana', 'Johanna', 'Mara', 'Dio']; // orden del horario de Hendrik; el resto detrás
  var FIN_DEF = 16 * 60; // sin hora de fin = hasta el cierre (16:00), igual que en Horas

  var css = document.createElement('style');
  css.textContent =
    '#t-horario{display:flex;flex-direction:column;gap:16px}' +
    '#t-horario.hidden{display:none}' +
    '.hz-head{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}' +
    '.hz-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
    '.hz-tools .btn{min-height:44px}' +
    '.hz-est{font-size:14px}' +
    '.hz-info{background:#E7E9DA;border-radius:14px;padding:10px 14px;font-size:14px}' +
    '.hz-av{background:#F3E2D6;color:#6A4128;border-radius:14px;padding:12px 16px}' +
    '.hz-av h2{font-size:17px;margin:0 0 6px}.hz-av ul{margin:0;padding-left:18px}.hz-av li{margin:2px 0}' +
    '.hz-av.mini{padding:8px 12px;font-size:14px}' +
    '.hz-grid table{table-layout:fixed;min-width:560px}' +
    '.hz-grid th.d{width:84px}' +
    '.hz-grid th{text-align:center}' +
    '.hz-grid td{padding:4px;border-bottom:1px solid #E2E0D5;vertical-align:stretch}' +
    '.hz-grid td.dia{font-weight:700;font-size:14px;white-space:nowrap;vertical-align:middle}' +
    '.hz-grid td.dia span{display:block;font-weight:500;color:#6C7161;font-size:13px}' +
    '.hz-grid tr.hoy td{background:#FBFAF2}.hz-grid tr.hoy td.dia{color:#815437}' +
    '.hc{cursor:pointer;position:relative}' +
    '.hc:hover .tu,.hc:hover .li,.hc:hover .ab{outline:2px solid #394A32}' +
    '.tu{border-radius:10px;padding:6px 8px;min-height:56px;display:flex;flex-direction:column;justify-content:center;margin-bottom:3px;color:#2E3B28}' +
    '.tu:last-child{margin-bottom:0}' +
    '.tu b{font-family:Fredoka,sans-serif;font-weight:600;font-size:18px;line-height:1.1}' +
    '.tu b i{font-style:normal;font-family:Figtree,sans-serif;font-weight:600;font-size:13px;margin-left:4px;opacity:.8}' +
    '.tu small{font-size:12.5px;font-weight:600}' +
    '.mod{font-size:11px;font-weight:700;color:#815437;margin-top:2px}' +
    '.li{border:2px dashed #E2E0D5;border-radius:10px;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#9A9D8F;font-weight:700;font-size:13px;letter-spacing:.08em}' +
    '.ab{border-radius:10px;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;font-size:13px;letter-spacing:.06em;margin-bottom:3px}' +
    '.ab.vacaciones{background:repeating-linear-gradient(135deg,#F6EBDD 0 8px,#EFDCC6 8px 16px);color:#6A4128}' +
    '.ab.baja{background:repeating-linear-gradient(135deg,#EEEDE7 0 8px,#E2E1D9 8px 16px);color:#4E5245}' +
    '.ab.otra{background:#EDE9F5;color:#4B3F78}' +
    '.ab.peq{min-height:0;padding:3px 6px;font-size:11px}' +
    '.hw{position:absolute;bottom:6px;right:9px;font-size:14px;color:#8A3B1E;font-weight:800}' +
    '.hz-res{display:grid;grid-template-columns:1fr;gap:16px}.hz-res>.card:last-child table{max-width:620px}' +
    '.hz-res table{min-width:0}.hz-res td,.hz-res th{padding:6px 7px;font-size:14px}' +
    '.hz-res th{font-size:11.5px}' +
    '.hz-res td:first-child{white-space:nowrap}.hz-res td.n,.hz-res th.n{text-align:center;font-variant-numeric:tabular-nums}' +
    '.hz-res td.z{color:#B9BCA8}' +
    '.hz-res .over{color:#8A3B1E;font-weight:800}' +
    '.sw-p{display:inline-block;width:14px;height:14px;border-radius:4px;vertical-align:-2px;margin-right:6px;border:1px solid rgba(0,0,0,.08)}' +
    '.hz-ley{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:14px;font-weight:600}' +
    '.dlg .card.hzw{width:min(560px,100%);max-height:92vh;overflow:auto}' +
    '.hz-opts{display:flex;flex-direction:column;gap:8px}' +
    '.hz-opt{display:flex;justify-content:space-between;align-items:center;gap:10px;border:2px solid #E7E9DA;border-radius:12px;padding:10px 12px;background:#fff;text-align:left;min-height:48px}' +
    '.hz-opt.on{border-color:#394A32;background:#F4F6EE}' +
    '.hz-row{display:flex;flex-wrap:wrap;gap:8px}' +
    '.hz-row .btn{min-height:44px}' +
    '.hz-row.fix{position:sticky;bottom:-20px;background:#fff;padding:10px 0 4px;margin-bottom:-4px}' +
    '.hz-rad{display:flex;flex-direction:column;gap:8px}.hz-rad label{flex-direction:row;align-items:center;gap:8px;font-weight:600}.hz-rad input{width:20px;height:20px}' +
    '.hz-ok{font-weight:700;color:#3F6B34}' +
    '@media (max-width:980px){.hz-grid table{min-width:0}.hz-grid th.d{width:66px}.hz-grid td.dia{font-size:13px;white-space:normal}.hz-grid td{padding:3px 2px}.tu{padding:5px 5px}.tu b{font-size:15px}.tu b i{display:block;margin:0;font-size:11.5px}.tu small{font-size:11.5px}.li,.ab{font-size:11px;letter-spacing:.03em}.ab.peq{font-size:9.5px;padding:2px 3px}.hz-grid th{font-size:12px;letter-spacing:.02em}}' +
    '#hz-print{display:none}' +
    '@media print{' +
    '@page{size:A4 landscape;margin:9mm}' +
    'html,body.pr-hz{background:#fff !important}' +
    'body.pr-hz>*{display:none !important}' +
    'body.pr-hz>#hz-print{display:block !important}' +
    '#hz-print{font-family:Figtree,sans-serif;color:#394A32;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '#hz-print .ph{display:flex;align-items:center;gap:14px;border-bottom:3px solid #394A32;padding-bottom:6px;margin-bottom:8px}' +
    '#hz-print .ph img{height:46px}' +
    '#hz-print .ph h1{font-family:Fredoka,sans-serif;font-weight:600;font-size:22px;margin:0}' +
    '#hz-print .ph div{font-size:12px;color:#6C7161}' +
    '#hz-print .wk{break-inside:avoid;margin-bottom:8px}' +
    '#hz-print h2{font-family:Fredoka,sans-serif;font-weight:600;font-size:14px;margin:4px 0}' +
    '#hz-print table{width:100%;border-collapse:collapse;table-layout:fixed;min-width:0}' +
    '#hz-print th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#394A32;background:#F7F3E8;padding:4px;border:1px solid #D9D6C8}' +
    '#hz-print td{border:1px solid #D9D6C8;padding:2px;vertical-align:middle;height:34px}' +
    '#hz-print td.dia{font-weight:700;font-size:11.5px;padding:2px 6px;width:70px}' +
    '#hz-print td.dia span{display:block;font-weight:500;font-size:10.5px;color:#6C7161}' +
    '#hz-print .tu,#hz-print .li,#hz-print .ab{min-height:30px;border-radius:5px;padding:2px 5px;margin:0;font-size:10.5px}' +
    '#hz-print .tu b{font-size:13px}#hz-print .tu b i{font-size:10px}#hz-print .tu small{font-size:10px}' +
    '#hz-print .li{border:0;font-size:10px}' +
    '#hz-print .ley{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:10.5px;font-weight:600;margin-top:4px}' +
    '#hz-print .pie{font-size:9.5px;color:#6C7161;margin-top:4px}' +
    '}';
  document.head.appendChild(css);

  var S = { periodos: [], puestos: [], emp: [], per: null, turnos: [], aus: [], mod: {}, modDel: {}, descanso: 12, todos: false };
  var byP = {}, byE = {};

  // ---------- fechas y horas ----------
  function hoy() { return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); }
  function ahoraMin() { var t = new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }); return toMin(t); }
  function add(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dow(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay(); }
  function lunes(iso) { return add(iso, -((dow(iso) + 6) % 7)); }
  function diff(a, b) { return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000); }
  function fD(iso) { var d = new Date(iso + 'T12:00:00Z'); return DIAS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MES[d.getUTCMonth()]; }
  function fC(iso) { var d = new Date(iso + 'T12:00:00Z'); return d.getUTCDate() + ' ' + MES[d.getUTCMonth()]; }
  function rango(p) { return fC(p.fecha_inicio) + ' – ' + fC(p.fecha_fin) + ' ' + p.fecha_fin.slice(0, 4); }
  function hm(t) { return t ? String(t).slice(0, 5) : ''; }
  function toMin(t) { if (!t) return null; var p = String(t).split(':'); return Number(p[0]) * 60 + Number(p[1]); }
  function finMin(t) { return t.hora_fin ? toMin(t.hora_fin) : FIN_DEF; }
  function dur(t) { return Math.max(0, finMin(t) - toMin(t.hora_inicio) - (t.pausa_min || 0)); }
  function hTxt(min) { var v = Math.round(min / 6) / 10; return String(v).replace('.', ','); }
  function tsTxt(ts) { var d = new Date(ts); return d.toLocaleDateString('es-ES', { timeZone: TZ, day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }); }
  function each(root, sel, fn) { Array.prototype.forEach.call(root.querySelectorAll(sel), fn); }
  function k(e, f) { return e + '|' + f; }

  // ---------- diálogos ----------
  function dlg(html) {
    A.dlg(html); $('dlg-c').classList.add('hzw');
    var no = $('x-no'); if (no) no.addEventListener('click', function () { $('dlg-c').classList.remove('hzw'); });
  }
  function closeDlg() { $('dlg-c').classList.remove('hzw'); A.closeDlg(); }
  function aviso(txt) {
    var m = $('hz-msg'); if (!m) return;
    m.textContent = txt; m.classList.remove('hidden');
    clearTimeout(aviso.t); aviso.t = setTimeout(function () { m.classList.add('hidden'); }, 5000);
  }

  // ---------- carga ----------
  async function cargarBase() {
    var r = await Promise.all([
      q(sb.from('periodos_rooster').select('id,fecha_inicio,fecha_fin,estado,aprobado_en').order('fecha_inicio')),
      q(sb.from('puestos').select('id,nombre,color,orden').order('orden')),
      q(sb.from('empleados').select('id,nombre_corto,horas_semana,activo').order('nombre_corto')),
      q(sb.from('ajustes').select('clave,valor').eq('clave', 'descanso_min_horas'))
    ]);
    S.periodos = r[0]; S.puestos = r[1];
    S.emp = r[2].filter(function (e) { return e.activo; }).sort(function (a, b) {
      var ia = ORDEN.indexOf(a.nombre_corto), ib = ORDEN.indexOf(b.nombre_corto);
      ia = ia < 0 ? 99 : ia; ib = ib < 0 ? 99 : ib;
      return ia - ib || (a.nombre_corto < b.nombre_corto ? -1 : 1);
    });
    if (r[3][0]) S.descanso = Number(r[3][0].valor) || 12;
    byP = {}; S.puestos.forEach(function (p) { byP[p.id] = p; });
    byE = {}; S.emp.forEach(function (e) { byE[e.id] = e; });
  }
  function periodoActual() {
    var h = hoy(), P = S.periodos;
    return P.filter(function (p) { return p.fecha_inicio <= h && p.fecha_fin >= h; })[0] ||
      P.filter(function (p) { return p.fecha_inicio > h; })[0] || P[P.length - 1] || null;
  }
  async function cargarPeriodo() {
    var p = S.per; S.turnos = []; S.aus = []; S.mod = {}; S.modDel = {};
    if (!p) return;
    var r = await Promise.all([
      q(sb.from('turnos').select('id,periodo_id,fecha,empleado_id,puesto_id,hora_inicio,hora_fin,pausa_min').eq('periodo_id', p.id).order('hora_inicio')),
      q(sb.from('ausencias').select('id,empleado_id,tipo,desde,hasta,estado').neq('estado', 'anulada').lte('desde', p.fecha_fin).or('hasta.is.null,hasta.gte.' + p.fecha_inicio)),
      p.aprobado_en ? q(sb.from('historial').select('registro,accion,datos,ts').eq('tabla', 'turnos').eq('datos->>periodo_id', String(p.id)).gt('ts', p.aprobado_en).order('ts')) : Promise.resolve([])
    ]);
    S.turnos = r[0]; S.aus = r[1];
    // 'modificado': último cambio después de aprobar
    r[2].forEach(function (h) {
      if (h.accion === 'DELETE') { if (h.datos) S.modDel[k(h.datos.empleado_id, h.datos.fecha)] = h.ts; }
      else S.mod[h.registro] = h.ts;
    });
  }

  // ---------- modelo ----------
  function celdas(turnos) { var m = {}; turnos.forEach(function (t) { (m[k(t.empleado_id, t.fecha)] = m[k(t.empleado_id, t.fecha)] || []).push(t); }); return m; }
  function ausDe(e, f) { return S.aus.filter(function (a) { return a.empleado_id === e && a.desde <= f && (!a.hasta || a.hasta >= f); })[0] || null; }
  function semanas(p) {
    var out = [], l = lunes(p.fecha_inicio);
    while (l <= p.fecha_fin) { out.push(l); l = add(l, 7); }
    return out;
  }
  function diasSemana(l, p, turnos) {
    var out = [];
    for (var i = 0; i < 7; i++) {
      var f = add(l, i);
      if (f < p.fecha_inicio || f > p.fecha_fin) continue;
      if (i === 6 && !turnos.some(function (t) { return t.fecha === f; })) continue; // domingo solo si hay turno
      out.push(f);
    }
    return out;
  }
  function diasPeriodo(p) { var out = []; semanas(p).forEach(function (l) { out = out.concat(diasSemana(l, p, S.turnos)); }); return out; }
  function visibles() {
    if (S.todos || !S.turnos.length) return S.emp;
    var con = {}; S.turnos.forEach(function (t) { con[t.empleado_id] = 1; });
    return S.emp.filter(function (e) { return con[e.id]; });
  }

  // ---------- avisos (no bloquean) ----------
  function avisos(turnos) {
    var out = [], cel = celdas(turnos), porE = {};
    Object.keys(cel).forEach(function (key) {
      var ts = cel[key], t0 = ts[0], e = byE[t0.empleado_id], n = e ? e.nombre_corto : '?';
      if (ts.length > 1) out.push({ e: t0.empleado_id, f: t0.fecha, txt: n + ' tiene ' + ts.length + ' turnos el ' + fD(t0.fecha) + '.' });
      var a = ausDe(t0.empleado_id, t0.fecha);
      if (a) out.push({ e: t0.empleado_id, f: t0.fecha, txt: n + ' tiene turno el ' + fD(t0.fecha) + ' pero está de ' + (AUS[a.tipo] || a.tipo).toLowerCase() + '.' });
    });
    turnos.forEach(function (t) { (porE[t.empleado_id] = porE[t.empleado_id] || []).push(t); });
    Object.keys(porE).forEach(function (id) {
      var e = byE[id], n = e ? e.nombre_corto : '?';
      var ts = porE[id].slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : toMin(a.hora_inicio) - toMin(b.hora_inicio); });
      for (var i = 1; i < ts.length; i++) {
        var a = ts[i - 1], b = ts[i];
        if (a.fecha === b.fecha) continue; // doble turno ya avisado
        var gap = diff(a.fecha, b.fecha) * 1440 + toMin(b.hora_inicio) - finMin(a);
        if (gap < S.descanso * 60) out.push({ e: id, f: b.fecha, f0: a.fecha, txt: n + ': solo ' + hTxt(gap) + ' h de descanso entre el ' + fD(a.fecha) + ' y el ' + fD(b.fecha) + ' (mínimo ' + S.descanso + ' h).' });
      }
      if (e && e.horas_semana != null) {
        var sem = {};
        ts.forEach(function (t) { var l = lunes(t.fecha); sem[l] = (sem[l] || 0) + dur(t); });
        Object.keys(sem).forEach(function (l) {
          if (sem[l] > e.horas_semana * 60) out.push({ e: id, sem: l, txt: n + ': ' + hTxt(sem[l]) + ' h planificadas la semana del ' + fC(l) + ' – contrato ' + hTxt(e.horas_semana * 60) + ' h.' });
        });
      }
    });
    return out;
  }
  function aplicarOps(turnos, ops) {
    var t = turnos.map(function (x) { return Object.assign({}, x); });
    ops.forEach(function (o) {
      if (o.op === 'del') t = t.filter(function (x) { return x.id !== o.id; });
      if (o.op === 'upd') t.forEach(function (x) { if (x.id === o.id) Object.assign(x, o.row); });
      if (o.op === 'ins') t.push(Object.assign({ id: 'nuevo' + Math.random(), pausa_min: 0 }, o.row));
    });
    return t;
  }
  function avisosDe(ops, emps, fechas) {
    var sim = aplicarOps(S.turnos, ops), sems = (fechas || []).map(lunes);
    return avisos(sim).filter(function (a) {
      if (emps.indexOf(a.e) < 0) return false;
      if (!fechas) return true;
      return fechas.indexOf(a.f) >= 0 || fechas.indexOf(a.f0) >= 0 || sems.indexOf(a.sem) >= 0;
    });
  }
  function avisoHtml(lst, titulo) {
    if (!lst.length) return '';
    return '<div class="hz-av mini"><b>' + esc(titulo || 'Ojo') + '</b><ul>' + lst.map(function (a) { return '<li>' + esc(a.txt) + '</li>'; }).join('') + '</ul></div>';
  }

  // ---------- pintar ----------
  function celdaHtml(e, f, cel, print, marcas) {
    var ts = cel[k(e.id, f)] || [], a = ausDe(e.id, f), h = '';
    if (a && ts.length) h += '<div class="ab peq ' + (a.tipo === 'vacaciones' || a.tipo === 'baja' ? a.tipo : 'otra') + '">' + esc(AUS[a.tipo] || a.tipo) + '</div>';
    ts.forEach(function (t) {
      var p = byP[t.puesto_id];
      h += '<div class="tu" style="background:' + esc(p ? p.color : '#fff') + (p && p.color.toUpperCase() === '#FFFFFF' ? ';border:1px solid #E2E0D5' : '') + '">' +
        '<b>' + hm(t.hora_inicio) + '<i>' + (t.hora_fin ? '– ' + hm(t.hora_fin) : 'fin') + '</i></b>' +
        '<small>' + esc(p ? p.nombre : 'Sin puesto') + '</small>' +
        (!print && S.mod[String(t.id)] ? '<span class="mod">modificado ' + tsTxt(S.mod[String(t.id)]) + '</span>' : '') + '</div>';
    });
    if (!ts.length) {
      if (a) h += '<div class="ab ' + (a.tipo === 'vacaciones' || a.tipo === 'baja' ? a.tipo : 'otra') + '">' + esc(AUS[a.tipo] || a.tipo) + '</div>';
      else h += '<div class="li">LIBRE' + (!print && S.modDel[k(e.id, f)] ? '<span class="mod" style="letter-spacing:0">modificado ' + tsTxt(S.modDel[k(e.id, f)]) + '</span>' : '') + '</div>';
    }
    if (!print && marcas[k(e.id, f)]) h += '<span class="hw" title="Hay un aviso">⚠</span>';
    return h;
  }
  function tablaSemana(l, p, emps, cel, print, marcas) {
    var dias = diasSemana(l, p, S.turnos), h0 = hoy();
    var h = '<table><thead><tr><th class="d">' + (print ? 'Día' : '') + '</th>' + emps.map(function (e) { return '<th>' + esc(e.nombre_corto) + '</th>'; }).join('') + '</tr></thead><tbody>';
    dias.forEach(function (f) {
      var d = new Date(f + 'T12:00:00Z');
      h += '<tr' + (!print && f === h0 ? ' class="hoy"' : '') + '><td class="dia">' + DIAS_L[d.getUTCDay()] + '<span>' + d.getUTCDate() + ' ' + MES[d.getUTCMonth()] + (!print && f === h0 ? ' · hoy' : '') + '</span></td>' +
        emps.map(function (e) { return '<td class="hc" data-e="' + e.id + '" data-f="' + f + '">' + celdaHtml(e, f, cel, print, marcas) + '</td>'; }).join('') + '</tr>';
    });
    return h + '</tbody></table>';
  }
  function leyenda(cls) {
    var usados = {}; S.turnos.forEach(function (t) { usados[t.puesto_id] = 1; });
    var ps = S.puestos.filter(function (p) { return usados[p.id] || p.nombre !== 'Ayudante sala'; });
    return '<div class="' + cls + '">' + ps.map(function (p) { return '<span><span class="sw-p" style="background:' + esc(p.color) + '"></span>' + esc(p.nombre) + '</span>'; }).join('') +
      '<span><b>fin</b> = hasta el cierre</span><span>LIBRE = día libre</span></div>';
  }
  function resumen(p, emps, cel) {
    var dias = diasPeriodo(p), wk = semanas(p);
    var h = '<div class="card tbl"><h2 class="f">Personas por puesto y día</h2><table><thead><tr><th>Puesto</th>' +
      dias.map(function (f) { return '<th class="n">' + DIAS[dow(f)] + '<br>' + Number(f.slice(8)) + '</th>'; }).join('') + '</tr></thead><tbody>';
    var usados = {}; S.turnos.forEach(function (t) { usados[t.puesto_id] = 1; });
    S.puestos.filter(function (x) { return usados[x.id] || x.nombre !== 'Ayudante sala'; }).forEach(function (x) {
      h += '<tr><td><span class="sw-p" style="background:' + esc(x.color) + '"></span>' + esc(x.nombre) + '</td>' + dias.map(function (f) {
        var n = S.turnos.filter(function (t) { return t.fecha === f && t.puesto_id === x.id; }).length;
        return '<td class="n' + (n ? '' : ' z') + '">' + n + '</td>';
      }).join('') + '</tr>';
    });
    h += '<tr><td><b>Total personas</b></td>' + dias.map(function (f) {
      var s = {}; S.turnos.forEach(function (t) { if (t.fecha === f) s[t.empleado_id] = 1; });
      return '<td class="n"><b>' + Object.keys(s).length + '</b></td>';
    }).join('') + '</tr></tbody></table></div>';
    h += '<div class="card tbl"><h2 class="f">Horas planificadas por semana</h2><table><thead><tr><th>Nombre</th><th class="num">Contrato</th>' +
      wk.map(function (l) { return '<th class="num">Sem. ' + fC(l) + '</th>'; }).join('') + '</tr></thead><tbody>';
    emps.forEach(function (e) {
      h += '<tr><td><b>' + esc(e.nombre_corto) + '</b></td><td class="num">' + (e.horas_semana != null ? hTxt(e.horas_semana * 60) + ' h' : '—') + '</td>' + wk.map(function (l) {
        var m = 0; S.turnos.forEach(function (t) { if (t.empleado_id === e.id && lunes(t.fecha) === l) m += dur(t); });
        var over = e.horas_semana != null && m > e.horas_semana * 60;
        return '<td class="num' + (over ? ' over' : '') + '">' + (m ? hTxt(m) + ' h' : '—') + (over ? ' ⚠' : '') + '</td>';
      }).join('') + '</tr>';
    });
    h += '</tbody></table><p class="muted" style="margin:8px 0 0">Sin hora de fin cuenta hasta las 16:00 (igual que en Horas).</p></div>';
    return '<div class="hz-res">' + h + '</div>';
  }

  function pintar() {
    var sec = $('t-horario'), p = S.per;
    var idx = p ? S.periodos.indexOf(p) : -1;
    var h = '<div class="hz-head"><div><h1 class="f">Horario</h1><div class="muted">' + (p ? rango(p) : 'Todavía no hay ningún horario') + '</div></div>' +
      '<div class="hz-tools">' +
      '<button class="btn o s" id="hz-prev" type="button"' + (idx > 0 ? '' : ' disabled') + '>← Anterior</button>' +
      '<button class="btn o s" id="hz-next" type="button"' + (idx >= 0 && idx < S.periodos.length - 1 ? '' : ' disabled') + '>Siguiente →</button>' +
      '<button class="btn o s" id="hz-new" type="button">Nuevo periodo</button>' +
      (p && p.estado === 'borrador' ? '<button class="btn s" id="hz-apr" type="button">Aprobar y publicar</button>' : '') +
      (p ? '<button class="btn s" id="hz-print-b" type="button">Imprimir / PDF</button>' : '') +
      '</div></div>';
    h += '<div class="msg ok hidden" id="hz-msg"></div>';
    if (!p) { sec.innerHTML = h + '<div class="card muted">Crea el primer periodo con «Nuevo periodo».</div>'; enlazar(); return; }
    var est = p.estado === 'borrador' ? '<span class="tag warn hz-est">Borrador</span>' : '<span class="tag ok hz-est">' + (p.estado === 'enviado' ? 'Aprobado y enviado' : 'Aprobado') + '</span>';
    h += '<div class="hz-info">' + est + ' &nbsp;' + (p.estado === 'borrador'
      ? 'Borrador: el personal todavía no lo ve en la tableta y no cuenta para los retrasos.'
      : 'Publicado' + (p.aprobado_en ? ' el ' + tsTxt(p.aprobado_en) : '') + ': se ve en «Mis turnos» de la tableta y cuenta para el control de retrasos. Cambia un turno <b>antes</b> de que empiece. No se envía nada al personal.') + '</div>';
    var av = avisos(S.turnos), marcas = {};
    av.forEach(function (a) { if (a.f) marcas[k(a.e, a.f)] = 1; });
    if (av.length) h += '<div class="hz-av"><h2 class="f">Avisos (' + av.length + ')</h2><ul>' + av.map(function (a) { return '<li>' + esc(a.txt) + '</li>'; }).join('') + '</ul><div style="font-size:13px;margin-top:6px">Solo son avisos: puedes guardar igualmente.</div></div>';
    var emps = visibles(), cel = celdas(S.turnos);
    h += resumen(p, emps, cel);
    semanas(p).forEach(function (l, i) {
      h += '<div class="card hz-grid"><div class="row between"><h2 class="f" style="margin:0">Semana ' + (i + 1) + ' · ' + fC(l) + ' – ' + fC(add(l, 5)) + '</h2>' +
        (i === 0 ? '<label class="chk" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="hz-todos"' + (S.todos ? ' checked' : '') + ' style="width:20px;height:20px"> Mostrar a todo el personal</label>' : '') +
        '</div><div class="tbl" style="margin-top:10px">' + tablaSemana(l, p, emps, cel, false, marcas) + '</div></div>';
    });
    h += '<div class="card">' + leyenda('hz-ley') + '<p class="muted" style="margin:10px 0 0">Toca una casilla para cambiar, quitar, copiar o intercambiar un turno. Toca una casilla LIBRE para crear un turno nuevo.</p></div>';
    sec.innerHTML = h;
    enlazar();
  }
  function enlazar() {
    var sec = $('t-horario');
    var go = function (d) { var i = S.periodos.indexOf(S.per) + d; if (S.periodos[i]) { S.per = S.periodos[i]; recargar(); } };
    if ($('hz-prev')) $('hz-prev').addEventListener('click', function () { go(-1); });
    if ($('hz-next')) $('hz-next').addEventListener('click', function () { go(1); });
    $('hz-new').addEventListener('click', dlgNuevo);
    if ($('hz-apr')) $('hz-apr').addEventListener('click', dlgAprobar);
    if ($('hz-print-b')) $('hz-print-b').addEventListener('click', imprimir);
    if ($('hz-todos')) $('hz-todos').addEventListener('change', function () { S.todos = this.checked; pintar(); });
    each(sec, '.hc', function (td) { td.addEventListener('click', function () { dlgCelda(td.dataset.e, td.dataset.f); }); });
  }
  async function recargar(msg) {
    try { await cargarPeriodo(); pintar(); if (msg) aviso(msg); } catch (e) { A.fail(e); }
  }

  // ---------- guardar (con confirmación si está publicado) ----------
  function empezado(f, t) {
    var h0 = hoy();
    return f < h0 || (f === h0 && t && toMin(t.hora_inicio) <= ahoraMin());
  }
  function guardar(ops, desc, emps, celdasAfect) {
    var av = avisosDe(ops, emps, (celdasAfect || []).map(function (c) { return c.f; }));
    var ya = (celdasAfect || []).some(function (c) { return empezado(c.f, c.t); });
    if (S.per.estado === 'borrador') return ejecutar(ops);
    dlg('<h2 class="f">Este horario ya está publicado – ¿guardar cambio?</h2>' +
      '<p style="margin:0"><b>' + esc(desc) + '</b></p>' +
      '<p class="muted" style="margin:0">Vale enseguida para «Mis turnos» en la tableta y para el control de retrasos. No se envía nada al personal. El cambio queda en el historial.</p>' +
      (ya ? '<div class="hz-av mini"><b>Este turno ya ha empezado o es de un día pasado.</b> El control de retrasos usará el horario nuevo.</div>' : '') +
      avisoHtml(av, 'Avisos (puedes guardar igualmente)') +
      '<div class="msg err" id="x-e"></div><div class="hz-row"><button class="btn" id="x-ok" type="button">Guardar cambio</button><button class="btn o" id="x-no" type="button">Cancelar</button></div>');
    $('x-ok').addEventListener('click', function () { this.disabled = true; ejecutar(ops); });
  }
  async function ejecutar(ops) {
    var hechos = [];
    try {
      for (var i = 0; i < ops.length; i++) {
        var o = ops[i];
        if (o.op === 'ins') await q(sb.from('turnos').insert(o.row));
        if (o.op === 'upd') { await q(sb.from('turnos').update(o.row).eq('id', o.id)); hechos.push(o); }
        if (o.op === 'del') await q(sb.from('turnos').delete().eq('id', o.id));
      }
      closeDlg(); recargar('Guardado.');
    } catch (err) {
      // intercambio a medias: deshacer lo ya cambiado
      for (var j = 0; j < hechos.length; j++) { try { await q(sb.from('turnos').update(hechos[j].antes).eq('id', hechos[j].id)); } catch (e2) { /* sigue */ } }
      var m = $('x-e'); if (m) m.textContent = err.message || String(err); else A.fail(err);
      recargar();
    }
  }

  // ---------- diálogo de una casilla ----------
  function puestoSel(id, v) {
    return '<select id="' + id + '">' + S.puestos.map(function (p) { return '<option value="' + p.id + '"' + (Number(v) === p.id ? ' selected' : '') + '>' + esc(p.nombre) + '</option>'; }).join('') + '</select>';
  }
  function puestoHabitual(e) {
    var c = {}; S.turnos.forEach(function (t) { if (t.empleado_id === e) c[t.puesto_id] = (c[t.puesto_id] || 0) + 1; });
    var best = null; Object.keys(c).forEach(function (p) { if (best == null || c[p] > c[best]) best = p; });
    return best != null ? Number(best) : (S.puestos[0] && S.puestos[0].id);
  }
  function turnoTxt(t) { var p = byP[t.puesto_id]; return hm(t.hora_inicio) + ' ' + (t.hora_fin ? '– ' + hm(t.hora_fin) : 'fin') + ' · ' + (p ? p.nombre : 'sin puesto'); }
  function dlgCelda(eId, f) {
    var e = byE[eId], ts = S.turnos.filter(function (t) { return t.empleado_id === eId && t.fecha === f; });
    if (ts.length > 1) {
      var a = ausDe(eId, f);
      dlg('<h2 class="f">' + esc(e.nombre_corto) + ' · ' + fD(f) + '</h2>' + (a ? '<div class="hz-av mini">Ese día: ' + esc(AUS[a.tipo] || a.tipo) + '</div>' : '') +
        '<div class="hz-av mini"><b>Doble turno</b> – elige cuál quieres cambiar.</div><div class="hz-opts">' +
        ts.map(function (t) { return '<button class="hz-opt" data-t="' + t.id + '" type="button"><span>' + esc(turnoTxt(t)) + '</span><span>Cambiar →</span></button>'; }).join('') +
        '</div><div class="hz-row"><button class="btn o" id="x-add" type="button">Añadir otro turno</button><button class="btn o" id="x-no" type="button">Cerrar</button></div>');
      each($('dlg-c'), '[data-t]', function (b) { b.addEventListener('click', function () { dlgTurno(eId, f, ts.filter(function (t) { return String(t.id) === b.dataset.t; })[0]); }); });
      $('x-add').addEventListener('click', function () { dlgTurno(eId, f, null); });
      return;
    }
    dlgTurno(eId, f, ts[0] || null);
  }
  function dlgTurno(eId, f, t) {
    var e = byE[eId], a = ausDe(eId, f);
    var ini = t ? hm(t.hora_inicio) : '08:30', fin = t ? hm(t.hora_fin) : '', pu = t ? t.puesto_id : puestoHabitual(eId);
    dlg('<h2 class="f">' + (t ? 'Turno' : 'Nuevo turno') + ' · ' + esc(e.nombre_corto) + ' · ' + fD(f) + '</h2>' +
      (a ? '<div class="hz-av mini">Ese día ' + esc(e.nombre_corto) + ' está de <b>' + esc((AUS[a.tipo] || a.tipo).toLowerCase()) + '</b>.</div>' : '') +
      '<div class="form"><label>Empieza<input type="time" id="x-i" value="' + ini + '" step="300"></label>' +
      '<label>Termina (vacío = fin)<input type="time" id="x-f" value="' + fin + '" step="300"></label>' +
      '<label>Puesto' + puestoSel('x-p', pu) + '</label></div>' +
      '<div id="x-av"></div><div class="msg err" id="x-e"></div>' +
      '<div class="hz-row"><button class="btn" id="x-ok" type="button">Guardar</button>' +
      (t ? '<button class="btn t" id="x-libre" type="button">Poner LIBRE</button>' : '') + '<button class="btn o" id="x-no" type="button">Cancelar</button></div>' +
      '<div class="hz-row" style="border-top:1px solid #E2E0D5;padding-top:12px">' +
      '<button class="btn o s" id="x-swap" type="button">Intercambiar con otra persona</button>' +
      (t ? '<button class="btn o s" id="x-copy" type="button">Copiar a otro día</button>' : '') + '</div>' +
      (t && S.mod[String(t.id)] ? '<div class="muted">Modificado ' + tsTxt(S.mod[String(t.id)]) + '</div>' : ''));
    function fila() {
      var i = $('x-i').value, fi = $('x-f').value;
      return { periodo_id: S.per.id, fecha: f, empleado_id: eId, puesto_id: Number($('x-p').value), hora_inicio: i ? i + ':00' : null, hora_fin: fi ? fi + ':00' : null };
    }
    function ops() { var r = fila(); return t ? [{ op: 'upd', id: t.id, row: { puesto_id: r.puesto_id, hora_inicio: r.hora_inicio, hora_fin: r.hora_fin }, antes: { puesto_id: t.puesto_id, hora_inicio: t.hora_inicio, hora_fin: t.hora_fin } }] : [{ op: 'ins', row: r }]; }
    function live() {
      var r = fila();
      if (!r.hora_inicio) { $('x-av').innerHTML = ''; return; }
      $('x-av').innerHTML = avisoHtml(avisosDe(ops(), [eId], [f]), 'Avisos (puedes guardar igualmente)');
    }
    ['x-i', 'x-f', 'x-p'].forEach(function (id) { $(id).addEventListener('input', live); $(id).addEventListener('change', live); });
    live();
    $('x-ok').addEventListener('click', function () {
      var r = fila();
      if (!r.hora_inicio) { $('x-e').textContent = 'Pon la hora de inicio.'; return; }
      if (r.hora_fin && toMin(r.hora_fin) <= toMin(r.hora_inicio)) { $('x-e').textContent = 'La hora de fin tiene que ser después del inicio.'; return; }
      var d = e.nombre_corto + ' · ' + fD(f) + ': ' + (t ? turnoTxt(t) + ' → ' : 'nuevo turno ') + turnoTxt(r);
      guardar(ops(), d, [eId], [{ f: f, t: t || r }]);
    });
    if (t) $('x-libre').addEventListener('click', function () {
      guardar([{ op: 'del', id: t.id }], e.nombre_corto + ' · ' + fD(f) + ': ' + turnoTxt(t) + ' → LIBRE', [eId], [{ f: f, t: t }]);
    });
    $('x-swap').addEventListener('click', function () { dlgSwap(eId, f); });
    if (t) $('x-copy').addEventListener('click', function () { dlgCopiar(t); });
  }

  // ---------- intercambiar ----------
  function txtDia(eId, f) {
    var ts = S.turnos.filter(function (t) { return t.empleado_id === eId && t.fecha === f; });
    if (ts.length) return ts.map(turnoTxt).join(' + ');
    var a = ausDe(eId, f); return a ? (AUS[a.tipo] || a.tipo) : 'LIBRE';
  }
  function dlgSwap(eId, f) {
    var e = byE[eId], sel = null;
    var otros = S.emp.filter(function (x) { return x.id !== eId; });
    dlg('<h2 class="f">Intercambiar · ' + fD(f) + '</h2>' +
      '<p style="margin:0"><b>' + esc(e.nombre_corto) + '</b>: ' + esc(txtDia(eId, f)) + '</p><p class="muted" style="margin:0">¿Con quién intercambia ' + esc(e.nombre_corto) + ' su día?</p>' +
      '<div class="hz-opts">' + otros.map(function (x) { return '<button class="hz-opt" data-o="' + x.id + '" type="button"><b>' + esc(x.nombre_corto) + '</b><span class="muted">' + esc(txtDia(x.id, f)) + '</span></button>'; }).join('') + '</div>' +
      '<div id="x-av"></div><div class="msg err" id="x-e"></div>' +
      '<div class="hz-row fix"><button class="btn" id="x-ok" type="button" disabled>Intercambiar</button><button class="btn o" id="x-no" type="button">Cancelar</button></div>');
    function ops(o) {
      var r = [];
      S.turnos.forEach(function (t) {
        if (t.fecha !== f) return;
        if (t.empleado_id === eId) r.push({ op: 'upd', id: t.id, row: { empleado_id: o }, antes: { empleado_id: eId } });
        if (t.empleado_id === o) r.push({ op: 'upd', id: t.id, row: { empleado_id: eId }, antes: { empleado_id: o } });
      });
      return r;
    }
    each($('dlg-c'), '[data-o]', function (b) {
      b.addEventListener('click', function () {
        sel = b.dataset.o;
        each($('dlg-c'), '[data-o]', function (x) { x.classList.toggle('on', x === b); });
        var o = ops(sel);
        $('x-ok').disabled = !o.length;
        $('x-av').innerHTML = o.length ? avisoHtml(avisosDe(o, [eId, sel], [f]), 'Avisos (puedes guardar igualmente)') : '<div class="hz-av mini">Los dos están libres ese día: no hay nada que intercambiar.</div>';
      });
    });
    $('x-ok').addEventListener('click', function () {
      if (!sel) return;
      var o = byE[sel], cs = S.turnos.filter(function (t) { return t.fecha === f && (t.empleado_id === eId || t.empleado_id === sel); }).map(function (t) { return { f: f, t: t }; });
      guardar(ops(sel), fD(f) + ': ' + e.nombre_corto + ' (' + txtDia(eId, f) + ') ⇄ ' + o.nombre_corto + ' (' + txtDia(sel, f) + ')', [eId, sel], cs);
    });
  }

  // ---------- copiar ----------
  function dlgCopiar(t) {
    var e = byE[t.empleado_id], dias = diasPeriodo(S.per);
    dlg('<h2 class="f">Copiar turno</h2><p style="margin:0"><b>' + esc(e.nombre_corto) + ' · ' + fD(t.fecha) + '</b>: ' + esc(turnoTxt(t)) + '</p>' +
      '<div class="form"><label>A qué día<select id="x-d">' + dias.map(function (f) { return '<option value="' + f + '"' + (f === add(t.fecha, 1) ? ' selected' : '') + '>' + fD(f) + '</option>'; }).join('') + '</select></label>' +
      '<label>Para quién<select id="x-w">' + S.emp.map(function (x) { return '<option value="' + x.id + '"' + (x.id === t.empleado_id ? ' selected' : '') + '>' + esc(x.nombre_corto) + '</option>'; }).join('') + '</select></label></div>' +
      '<div id="x-ya"></div><div id="x-av"></div><div class="msg err" id="x-e"></div>' +
      '<div class="hz-row"><button class="btn" id="x-ok" type="button">Copiar</button><button class="btn o" id="x-no" type="button">Cancelar</button></div>');
    function destino() { return S.turnos.filter(function (x) { return x.fecha === $('x-d').value && x.empleado_id === $('x-w').value; }); }
    function ops() {
      var f = $('x-d').value, w = $('x-w').value, r = [];
      if ($('x-sus') && $('x-sus').checked) destino().forEach(function (x) { r.push({ op: 'del', id: x.id }); });
      r.push({ op: 'ins', row: { periodo_id: S.per.id, fecha: f, empleado_id: w, puesto_id: t.puesto_id, hora_inicio: t.hora_inicio, hora_fin: t.hora_fin, pausa_min: t.pausa_min || 0 } });
      return r;
    }
    function live(refrescarYa) {
      if (refrescarYa) {
        var ya = destino();
        $('x-ya').innerHTML = ya.length ? '<label class="chk" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="x-sus" checked style="width:20px;height:20px"> Sustituir lo que ya hay (' + esc(ya.map(turnoTxt).join(' + ')) + ')</label>' : '';
        if ($('x-sus')) $('x-sus').addEventListener('change', function () { live(false); });
      }
      var same = $('x-d').value === t.fecha && $('x-w').value === t.empleado_id;
      $('x-ok').disabled = same;
      $('x-av').innerHTML = same ? '<div class="hz-av mini">Elige otro día o a otra persona.</div>' : avisoHtml(avisosDe(ops(), [$('x-w').value], [$('x-d').value]), 'Avisos (puedes guardar igualmente)');
    }
    $('x-d').addEventListener('change', function () { live(true); }); $('x-w').addEventListener('change', function () { live(true); });
    live(true);
    $('x-ok').addEventListener('click', function () {
      var f = $('x-d').value, w = byE[$('x-w').value];
      guardar(ops(), 'Copiar ' + turnoTxt(t) + ' a ' + w.nombre_corto + ' · ' + fD(f), [w.id], [{ f: f, t: t }]);
    });
  }

  // ---------- nuevo periodo / aprobar ----------
  function dlgNuevo() {
    var ult = S.periodos[S.periodos.length - 1];
    var ini = ult ? add(ult.fecha_fin, 1) : lunes(hoy());
    if (dow(ini) !== 1) ini = add(lunes(ini), 7);
    var fin = add(ini, 12);
    var antes = function (d) { return S.periodos.filter(function (p) { return p.fecha_fin < d; }).slice(-1)[0] || null; };
    dlg('<h2 class="f">Nuevo periodo</h2>' +
      '<div class="form"><label>Desde (lunes)<input type="date" id="x-d" value="' + ini + '"></label><label>Hasta<input type="date" id="x-h" value="' + fin + '"></label></div>' +
      '<div class="hz-rad"><label><input type="radio" name="x-m" value="vacio"> Vacío</label>' +
      '<label><input type="radio" name="x-m" value="copia" checked> <span id="x-cp">Copiar las 2 semanas anteriores</span></label></div>' +
      '<p class="muted" style="margin:0">Se guarda como <b>borrador</b>: el personal no lo ve hasta que lo apruebes. Al copiar no se copian los turnos de días con vacaciones o baja.</p>' +
      '<div class="msg err" id="x-e"></div><div class="hz-row"><button class="btn" id="x-ok" type="button">Crear borrador</button><button class="btn o" id="x-no" type="button">Cancelar</button></div>');
    function upd() {
      var p = antes($('x-d').value);
      $('x-cp').textContent = p ? 'Copiar las 2 semanas anteriores (' + rango(p) + ')' : 'Copiar (no hay periodo anterior)';
    }
    $('x-d').addEventListener('change', function () { if (this.value) $('x-h').value = add(this.value, 12); upd(); });
    upd();
    $('x-ok').addEventListener('click', async function () {
      var d = $('x-d').value, h = $('x-h').value, modo = document.querySelector('input[name="x-m"]:checked').value;
      if (!d || !h || h < d) { $('x-e').textContent = 'Elige las fechas.'; return; }
      var choca = S.periodos.filter(function (p) { return p.fecha_inicio <= h && p.fecha_fin >= d; })[0];
      if (choca) { $('x-e').textContent = 'Esas fechas se solapan con el horario ' + rango(choca) + '.'; return; }
      var src = modo === 'copia' ? antes(d) : null;
      if (modo === 'copia' && !src) { $('x-e').textContent = 'No hay periodo anterior para copiar.'; return; }
      this.disabled = true;
      try {
        var nuevo = await q(sb.from('periodos_rooster').insert({ fecha_inicio: d, fecha_fin: h, estado: 'borrador' }).select().single());
        var msg = 'Borrador ' + rango(nuevo) + ' creado.';
        if (src) {
          var r = await Promise.all([
            q(sb.from('turnos').select('fecha,empleado_id,puesto_id,hora_inicio,hora_fin,pausa_min').eq('periodo_id', src.id)),
            q(sb.from('ausencias').select('empleado_id,tipo,desde,hasta,estado').neq('estado', 'anulada').lte('desde', h).or('hasta.is.null,hasta.gte.' + d))
          ]);
          var off = diff(src.fecha_inicio, d), filas = [], salt = 0;
          r[0].forEach(function (t) {
            var nf = add(t.fecha, off);
            if (nf < d || nf > h) return;
            if (!byE[t.empleado_id]) { salt++; return; }
            var aus = r[1].some(function (a) { return a.empleado_id === t.empleado_id && a.desde <= nf && (!a.hasta || a.hasta >= nf); });
            if (aus) { salt++; return; }
            filas.push({ periodo_id: nuevo.id, fecha: nf, empleado_id: t.empleado_id, puesto_id: t.puesto_id, hora_inicio: t.hora_inicio, hora_fin: t.hora_fin, pausa_min: t.pausa_min || 0 });
          });
          if (filas.length) await q(sb.from('turnos').insert(filas));
          msg += ' Copiados ' + filas.length + ' turnos' + (salt ? '; ' + salt + ' no copiados (vacaciones, baja o ya no trabaja)' : '') + '.';
        }
        closeDlg();
        await cargarBase();
        S.per = S.periodos.filter(function (p) { return p.id === nuevo.id; })[0];
        recargar(msg);
      } catch (err) { $('x-e').textContent = err.message || String(err); this.disabled = false; }
    });
  }
  function dlgAprobar() {
    var p = S.per, av = avisos(S.turnos);
    dlg('<h2 class="f">Aprobar el horario ' + esc(rango(p)) + '</h2>' +
      '<p style="margin:0">Al aprobarlo se ve en «Mis turnos» de la tableta y cuenta para el control de retrasos. <b>No se envía nada al personal.</b></p>' +
      '<p class="muted" style="margin:0">' + S.turnos.length + ' turnos.</p>' +
      avisoHtml(av, 'Avisos (puedes aprobar igualmente)') +
      '<div class="msg err" id="x-e"></div><div class="hz-row fix"><button class="btn" id="x-ok" type="button">Aprobar y publicar</button><button class="btn o" id="x-no" type="button">Cancelar</button></div>');
    $('x-ok').addEventListener('click', async function () {
      this.disabled = true;
      try {
        await q(sb.from('periodos_rooster').update({ estado: 'aprobado', aprobado_en: new Date().toISOString() }).eq('id', p.id));
        closeDlg(); await cargarBase();
        S.per = S.periodos.filter(function (x) { return x.id === p.id; })[0];
        recargar('Horario aprobado y publicado.');
      } catch (err) { $('x-e').textContent = err.message || String(err); this.disabled = false; }
    });
  }

  // ---------- imprimir ----------
  function imprimir() {
    var p = S.per, emps = visibles(), cel = celdas(S.turnos);
    var box = $('hz-print');
    if (!box) { box = document.createElement('div'); box.id = 'hz-print'; document.body.appendChild(box); }
    var h = '<div class="ph"><img src="../home-assets/luma-badge.webp" alt="Luma Brunch"><div><h1>Horario · ' + esc(rango(p)) + '</h1>' +
      '<div>Luma Brunch &amp; Coffee · Benijófar' + (p.estado === 'borrador' ? ' · BORRADOR' : '') + '</div></div></div>';
    semanas(p).forEach(function (l, i) {
      h += '<div class="wk"><h2>Semana ' + (i + 1) + ' · ' + fC(l) + ' – ' + fC(add(l, 5)) + '</h2>' + tablaSemana(l, p, emps, cel, true, {}) + '</div>';
    });
    h += leyenda('ley') + '<div class="pie">Impreso el ' + tsTxt(new Date().toISOString()) + '. Cambios: siempre en el horario de la tableta («Mis turnos»).</div>';
    box.innerHTML = h;
    document.body.classList.add('pr-hz');
    var fin = function () { document.body.classList.remove('pr-hz'); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    var img = box.querySelector('img');
    var go = function () { window.print(); setTimeout(fin, 1000); };
    if (img && !img.complete) { img.onload = img.onerror = go; } else go();
  }

  // ---------- entrada ----------
  async function abrir() {
    try {
      $('t-horario').innerHTML = '<div class="card muted">Cargando el horario…</div>';
      var antes = S.per && S.per.id;
      await cargarBase();
      S.per = (antes && S.periodos.filter(function (p) { return p.id === antes; })[0]) || periodoActual();
      await cargarPeriodo(); pintar();
    } catch (e) { A.fail(e); }
  }
  window.LumaCaja = window.LumaCaja || {};
  window.LumaCaja.horario = abrir;

})();
