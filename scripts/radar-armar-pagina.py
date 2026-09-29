# radar-armar-pagina.py — arma public/radar/index.html a partir del radar de referencia.
#
# El diseño (estilos, estructura, pestañas, tarjetas, grilla y panel lateral) es el del radar de contenido que
# pasó Alex como referencia. Este script toma ese HTML y le cambia lo que hace falta para vivir adentro del CRM:
#   · sin pantalla de clave (el CRM ya pide login)
#   · los datos salen de /api/radar/* en vez de archivos data/*.json
#   · la cuenta propia sale de las semillas con tag "propia", no está escrita a mano
#   · el detalle de cada pieza (transcript, slides, recreación) se pide al abrirla
#   · alta y pausa de cuentas, sincronización, análisis, recreación y dossier a pedido
#
#   python scripts/radar-armar-pagina.py <referencia.html>
#
# Cada reemplazo exige encontrar el texto original: si la referencia cambió, el script avisa qué no encontró.
# La referencia no se guarda en el repo (es de un tercero). La página generada, public/radar/index.html, es la
# fuente desde ahora: los cambios siguientes se hacen ahí. Este script queda como registro de qué se adaptó.
import io, sys

if len(sys.argv) < 2: sys.exit("uso: python scripts/radar-armar-pagina.py <referencia.html>")
s = io.open(sys.argv[1], encoding="utf-8").read()
faltan = []

def r(viejo, nuevo, veces=1):
    global s
    n = s.count(viejo)
    if n != veces:
        faltan.append(f"[{n} en vez de {veces}] {viejo[:90]!r}")
        if n == 0: return
    s = s.replace(viejo, nuevo)

# ── Cabecera y portón ────────────────────────────────────────────────────────────
r("<title>Radar de contenido · BM</title>", "<title>Radar de contenido · EXPOSURE</title>")
r('''<div id="gate">
  <h1>Radar de contenido <span>· BM</span></h1>
  <p>Clave del equipo</p>
  <input id="gk" type="password" autocomplete="current-password" placeholder="••••••••">
  <button id="gb">Entrar</button>
  <div class="err" id="ge"></div>
</div>

''', "")
r('<div class="brand">Radar <span>· contenido BM</span></div>', '<div class="brand">Radar <span>· contenido EXPOSURE</span></div>')
r('''DATOS DE DEMO</span>
''', '''DATOS DE DEMO</span>
  <span class="chip" id="c-con" style="display:none"></span>
  <button class="btn sec" id="b-sync" style="display:none;padding:5px 11px;font-size:12px">Sincronizar</button>
''')

# estilos propios del CRM, al final de la hoja (no tocan nada de lo existente)
r("</style>", '''/* agregados del CRM */
.chip.falta{color:#111;background:var(--amber);border-color:var(--amber);font-weight:700;cursor:pointer}
.alta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center}
.alta input,.alta select{background:var(--surface2);border:1px solid var(--line);color:var(--ink);padding:8px 10px;border-radius:var(--r-s);font-size:12.5px;font-family:inherit}
.alta input.h{min-width:280px;flex:1}
.lk{background:transparent;border:none;color:var(--blue);font-size:12px;padding:0 4px;font-weight:600}
.lk.peligro{color:var(--muted)}
.paso{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
.paso small{display:block;color:var(--muted);margin-top:2px}
.ok{color:var(--green)}.mal{color:var(--red)}
.cargando{opacity:.6;pointer-events:none}
.filters label.chip input,.alta label.chip input{min-width:0;padding:0}
#t-semillas td{vertical-align:middle}
</style>''')

# ── Textos de las vistas ─────────────────────────────────────────────────────────
r('''title="las cuentas con tag 'propia' (nahue.urso) sirven de baseline, no se recrean"''', '''title="las cuentas con tag 'propia' (la nuestra) sirven de baseline, no se recrean"''')
r('<div class="empty">Sin cuentas profundas todavía. <b>run.py cuenta &lt;handle&gt;</b></div>', '<div class="empty">Sin cuentas con piezas en los últimos 30 días.</div>')
r("Rel = vistas del reel / mediana de vistas de los reels de su cuenta en ese trimestre (1x = reel normal de esa cuenta). Nahue: Graph API. Resto: views públicas de Apify.",
  "Rel = vistas del reel / mediana de vistas de los reels de su cuenta en ese trimestre (1x = reel normal de esa cuenta). Vistas públicas, leídas por Apify.")
r('<div class="empty">Sin reels etiquetados. <b>run.py guion</b></div>', '<div class="empty">Sin reels etiquetados todavía. Hacen falta reels con voz ya transcriptos y analizados.</div>')
r("Capturadas por un job diario antes de que venzan (24 h). Nahue: Graph API cada 6 h (texto, alcance, respuestas, avances, salidas; queda la última lectura antes de vencer). Creadores de Semillas: Apify una vez por día (frame, audio transcripto, stickers). Respuestas = DMs a la historia: el lead de un Contestame YO.",
  "Capturadas antes de que venzan (24 h). Cuenta propia: Graph API cada 6 h (alcance, respuestas, avances, salidas; queda la última lectura antes de vencer). Cuentas de Semillas: Apify (frame, texto en pantalla, audio transcripto, stickers). Las métricas de las historias ajenas no son públicas: solo las tiene la cuenta propia. Respuestas = DMs a la historia.")
r('title="se editan en semillas.json (F2: alta desde acá). Baseline = mediana de views/likes de las últimas 30 piezas de la cuenta."',
  'title="se agregan y se pausan desde acá. Baseline = mediana de views/likes de las últimas 30 piezas de la cuenta (sin las fijadas)."')
r('''      <div class="scroll-x"><table class="tbl" id="t-semillas"><thead><tr><th>Cuenta</th><th>Tags</th><th class="r">Seguidores</th><th class="r">Piezas sem</th><th class="r">Com sem</th><th class="r">Bangers</th><th class="r">Mediana views</th><th class="r">Baseline n</th><th>Nota</th></tr></thead><tbody></tbody></table></div>
    </div>''',
  '''      <div class="alta" id="alta" style="display:none">
        <input class="h" id="a-h" placeholder="@usuario o link del perfil (podés pegar varios, separados por coma o espacio)">
        <select id="a-t"><option value="referente">referente</option><option value="competencia">competencia</option><option value="nicho">nicho</option><option value="propia">propia</option></select>
        <label class="chip" style="cursor:pointer" title="capturar también sus historias, todos los días"><input type="checkbox" id="a-s" checked> historias</label>
        <input id="a-n" placeholder="nota (opcional)">
        <button class="btn" id="a-b">Agregar cuenta</button>
      </div>
      <div class="scroll-x"><table class="tbl" id="t-semillas"><thead><tr><th>Cuenta</th><th>Tags</th><th class="r">Seguidores</th><th class="r">Piezas sem</th><th class="r">Com sem</th><th class="r">Bangers</th><th class="r">Mediana views</th><th class="r">Baseline n</th><th>Historias</th><th>Nota</th><th></th></tr></thead><tbody></tbody></table></div>
    </div>
    <div class="card">
      <div class="card-title">Conexiones y corridas <i class="i" title="qué fuentes están conectadas y las últimas corridas del Radar, con lo que trajo y lo que costó cada una">i</i></div>
      <div id="est-wrap"><div class="muted">cargando…</div></div>
    </div>''')
r('<div class="empty">Competencia semanal: fase 3 del plan (diff por competidor + Ad Library). Sin datos aún.</div>',
  '<div class="empty">Competencia semanal: diferencias por competidor semana contra semana y anuncios activos (Ad Library). Todavía no está armado.</div>')

# ── Script: portón, carga y estado ───────────────────────────────────────────────
r("const KEY = atob('Y29udGVuaWRvMjAyNg==');\n", "")
r('''// gate
function gateOk(){ return sessionStorage.getItem('bmradar')==='1' || localStorage.getItem('bmradar')==='1'; }
function tryGate(){ if($('#gk').value===KEY){ sessionStorage.setItem('bmradar','1'); localStorage.setItem('bmradar','1'); $('#gate').remove(); load(); } else { $('#ge').textContent='Clave incorrecta'; } }
$('#gb').onclick = tryGate; $('#gk').onkeydown = e => { if(e.key==='Enter') tryGate(); };
if(gateOk()){ $('#gate').remove(); load(); } else { $('#gk').focus(); }
''', '''// La cuenta propia sale de las semillas con tag "propia". PROPIA es la principal; PROPIAS, todas.
let PROPIA = '', PROPIAS = new Set(), E = null;
const DET = new Map();

async function api(path, opts){
  const r = await fetch(path, { credentials:'same-origin', cache:'no-store', ...(opts||{}) });
  let j = null; try{ j = await r.json(); }catch(e){}
  if(r.status === 401) throw new Error('la sesión venció: recargá la página');
  if(!r.ok) throw new Error((j && j.error) || ('http '+r.status));
  return j;
}
const accion = body => api('/api/radar/accion', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
const gestiona = () => !!(E && E.yo && E.yo.gestiona);
''')
r('''async function load(){
  try{
    const r = await fetch('data/latest.json?v='+Date.now());
    if(!r.ok) throw new Error('http '+r.status);
    D = await r.json();
  }catch(e){
    $('#kpis').innerHTML = `<div class="empty">No pude leer data/latest.json (${esc(e.message)}). Corré <b>run.py demo</b> o <b>run.py semanal</b> y redeployá.</div>`;
    return;
  }
''', '''async function load(){
  try{
    D = await api('/api/radar/datos');
  }catch(e){
    $('#kpis').innerHTML = `<div class="empty">No pude leer los datos del Radar (${esc(e.message)}).</div>`;
    return;
  }
  PROPIAS = propias(); PROPIA = [...PROPIAS][0] || '';
  if(!GL.cuenta) GL.cuenta = PROPIA ? '@'+PROPIA : '';
  loadEstado();
''')
r("$('#foot').textContent = `Fuentes: ${D.fuentes?.piezas || '—'} · análisis ${D.fuentes?.analisis || '—'} · generado ${D.generado}`;",
  "$('#foot').textContent = `Fuentes: ${D.fuentes?.piezas || '—'} · análisis ${D.fuentes?.analisis || '—'} · generado ${new Date(D.generado).toLocaleString('es-AR')}`;")
r("    : `<div class=\"empty\">Sin análisis aún. Corré <b>run.py analizar</b>.</div>`;", "    : `<div class=\"empty\">Sin piezas analizadas esta semana todavía.</div>`;")

# ── Panel de la pieza: detalle a pedido y acciones ───────────────────────────────
r('''function abrir(id){
  const p = D.piezas.find(x=>x.id===id) || (C && C.piezas.find(x=>x.id===id)); if(!p) return;
  const a = p.analisis, r = p.recreacion;
''', '''let ABIERTA = '';
function abrir(id){
  const base = D.piezas.find(x=>x.id===id) || (C && C.piezas.find(x=>x.id===id)); if(!base) return;
  ABIERTA = id;
  pintarPieza(base, DET.get(id) || null);
  if(!DET.has(id)) api('/api/radar/pieza?id='+encodeURIComponent(id)).then(d => { DET.set(id, d); if(ABIERTA === id) pintarPieza(base, d); }).catch(e => flash('Detalle: '+e.message, true));
}
function pintarPieza(base, det){
  // la grilla trae la pieza sin lo pesado; el detalle suma transcript, slides leídas y recreación
  const p = { ...base, ...(det ? { transcript: det.transcript, slides_local: det.slides_local, slides_texto: det.slides_texto, lectura: det.lectura, analisis: det.analisis || base.analisis, objetivo: det.objetivo || base.objetivo } : {}) };
  const id = p.id;
  const a = p.analisis, r = det ? det.recreacion : null;
  const g = gestiona();
''')
r('''      <button class="btn" ${r?'':'disabled title="primero generá la recreación: run.py recrear '+esc(p.id)+' --kanban"'} onclick="kanban('${esc(p.id)}','reel')">Reel → kanban</button>
      <button class="btn" ${r?'':'disabled title="primero generá la recreación"'} onclick="kanban('${esc(p.id)}','carrusel')">Carrusel → kanban</button></div>''',
  '''      ${g && a && !r && a.recreable ? `<button class="btn" id="b-rec" onclick="recrear('${esc(id)}')">Generar recreación</button>` : ''}
      <button class="btn" ${r&&g?'':'disabled title="'+(g?'primero generá la recreación':'solo dirección y marketing')+'"'} onclick="kanban('${esc(id)}','reel')">Reel → Contenido</button>
      <button class="btn" ${r&&g?'':'disabled title="'+(g?'primero generá la recreación':'solo dirección y marketing')+'"'} onclick="kanban('${esc(id)}','carrusel')">Carrusel → Contenido</button></div>''')
r('''<span class="tag">ángulo #${a.angulo_bm_id} · ${esc(a.angulo_bm_nombre)}</span>`:'<span class="tag">sin ángulo BM</span>'}''',
  '''<span class="tag">ángulo #${a.angulo_bm_id} · ${esc(a.angulo_bm_nombre)}</span>`:'<span class="tag">sin ángulo del banco</span>'}''')
r("${a.como_recrear?`<p><b>Cómo recrear para BM:</b> ${esc(a.como_recrear)}</p>`:''}`;", "${a.como_recrear?`<p><b>Cómo recrear para EXPOSURE:</b> ${esc(a.como_recrear)}</p>`:''}\n      ${g?`<div class=\"acts\"><button class=\"btn sec\" id=\"b-ana\" onclick=\"analizar('${esc(id)}')\">Volver a analizar</button></div>`:''}`;")
r("    html += `<h3>Análisis</h3><div class=\"empty\">Sin análisis. <b>run.py analizar</b></div>`;",
  "    html += `<h3>Análisis</h3><div class=\"empty\">Sin análisis todavía${det&&det.analisis_error?': '+esc(det.analisis_error):'. Se analiza sola en la próxima pasada'}.</div>${g?`<div class=\"acts\"><button class=\"btn\" id=\"b-ana\" onclick=\"analizar('${esc(id)}')\">Analizar ahora</button></div>`:''}`;")
r('''function cerrar(){ const d=$('#drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden','true'); }''',
  '''function cerrar(){ const d=$('#drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden','true'); ABIERTA = ''; }
async function enPieza(id, boton, espera, body, listo){
  const b = $('#'+boton); if(b){ b.disabled = true; b.textContent = espera; }
  try{
    const j = await accion(body);
    if(j.pieza){ DET.set(id, j.pieza);
      for(const lista of [D.piezas, C ? C.piezas : []]){ const p = lista.find(x=>x.id===id); if(p){ p.analisis = j.pieza.analisis || p.analisis; p.objetivo = j.pieza.objetivo || p.objetivo; p.recreacion = !!j.pieza.recreacion; } }
      if(ABIERTA === id) abrir(id);
      renderKpis(); renderTabla(); renderGrid(); }
    flash(listo);
  }catch(e){ flash(e.message, true); if(b){ b.disabled = false; b.textContent = 'Reintentar'; } }
}
const analizar = id => enPieza(id, 'b-ana', 'Analizando… (hasta 1 min)', { accion:'analizar', id }, 'Pieza analizada ✓');
const recrear = id => enPieza(id, 'b-rec', 'Escribiendo la recreación… (1 a 2 min)', { accion:'recrear', id }, 'Recreación lista ✓');''')
r('''async function kanban(id, fmt){
  const p = D.piezas.find(x=>x.id===id); const r = p?.recreacion; if(!r) return;
  const rec = r[fmt];
  const cuadr = {tofu:'tofu',problema:'problema',solucion:'solucion',producto:'producto',mentalidad:'confianza'}[p.analisis?.tipo] || 'problema';
  const data = { ID:`radar-${id}-${fmt}-${Date.now()}`, Canal:'Instagram', Titulo: rec.titulo || rec.hook, Cuadrante: cuadr, Angulo: p.analisis?.angulo_bm_nombre || '', Formato: fmt==='carrusel'?'carrusel':'reel', Estado:'Idea', Creada: new Date().toISOString().slice(0,10), Fuente: p.url, Notas: `Radar · @${p.cuenta} · ${p.comentarios} com` };
  try{
    const res = await fetch('/api/kanban', { method:'POST', headers:{'x-hub-key':KEY,'content-type':'application/json'}, body: JSON.stringify({ action:'cadd', tab:'Ideas', data }) });
    if(!res.ok) throw new Error('http '+res.status);
    const j = await res.json(); if(j.error) throw new Error(j.error);
    flash(`${fmt} mandado al kanban ✓ (fila ${j.row ?? '—'})`);
  }catch(e){ flash('Kanban: '+e.message, true); }
}''', '''async function kanban(id, fmt){
  try{
    const j = await accion({ accion:'kanban', id, formato: fmt });
    flash(`${fmt} mandado a Contenido con el guion listo ✓`);
    return j;
  }catch(e){ flash('Contenido: '+e.message, true); }
}''')

# ── Cuentas ──────────────────────────────────────────────────────────────────────
r("  try{ const r = await fetch('data/cuentas/index.json?v='+Date.now()); if(r.ok) idx = await r.json(); }catch(e){}", "  try{ idx = await api('/api/radar/cuentas'); }catch(e){}")
r("  try{ const r = await fetch(`data/cuentas/${encodeURIComponent(h)}.json?v=`+Date.now()); C = await r.json(); }", "  try{ C = await api('/api/radar/cuentas?handle='+encodeURIComponent(h)); }")
r('''<div class="card-title">Para robar · traducido a BM <span class="sub">${dos.robar.length} piezas</span> <i class="i" title="piezas de la cuenta traducidas a importaciones y marca propia, en voz de Nahue, con las reglas de copy BM. Click en la referencia abre la pieza original.">i</i></div>''',
  '''<div class="card-title">Para robar · traducido a EXPOSURE <span class="sub">${dos.robar.length} piezas</span> <i class="i" title="piezas de la cuenta traducidas al avatar y a la oferta de EXPOSURE, en voz de Alex, con las reglas de la casa. Click en la referencia abre la pieza original.">i</i></div>''')
r("<th>#</th><th>Pieza BM</th><th>Formato</th>", "<th>#</th><th>Pieza EXPOSURE</th><th>Formato</th>")
r('''    }
  }
  html += `<div class="cols2">
    <div class="card"><div class="card-title">Keywords que farmean''', '''    }
  }
  if(gestiona()) html += `<div class="acts" style="margin:0 0 14px"><button class="btn sec" id="b-dos">${dos?'Rehacer el dossier':'Generar el dossier de la cuenta'}</button><span class="muted" style="align-self:center">qué hace y qué le robamos, sobre sus piezas analizadas de los últimos 30 días</span></div>`;
  html += `<div class="cols2">
    <div class="card"><div class="card-title">Keywords que farmean''')
r('''  $('#acc-grid').onclick = e => { const c = e.target.closest('.gc'); if(c) abrir(c.dataset.id); };
  renderAccGrid();
}''', '''  $('#acc-grid').onclick = e => { const c = e.target.closest('.gc'); if(c) abrir(c.dataset.id); };
  if($('#b-dos')) $('#b-dos').onclick = async () => { const b = $('#b-dos'); b.disabled = true; b.textContent = 'Armando el dossier… (1 a 2 min)';
    try{ const j = await accion({ accion:'dossier', handle: C.handle }); C.dossier = j.dossier; renderCuenta(); flash('Dossier listo ✓'); }
    catch(e){ flash(e.message, true); b.disabled = false; b.textContent = 'Reintentar'; } };
  renderAccGrid();
}''')
r("<span class=\"rk\">#${i+1}</span><span class=\"md\">${esc(p.tipo_media)}${p.slides_local?` · ${p.slides_local.length}`:''}${p.duracion?` · ${Math.round(p.duracion)}s`:''}</span>",
  "<span class=\"rk\">#${i+1}</span><span class=\"md\">${esc(p.tipo_media)}${p.n_slides?` · ${p.n_slides}`:''}${p.duracion?` · ${Math.round(p.duracion)}s`:''}</span>")
r("${p.transcript?'<span class=\"tag\">transcript</span>':''}${p.slides_texto?'<span class=\"tag\">slides leídas</span>':''}</div></div></div>`; }).join('');",
  "${p.con_transcript?'<span class=\"tag\">transcript</span>':''}${p.slides_leidas?'<span class=\"tag\">slides leídas</span>':''}</div></div></div>`; }).join('');")

# ── Guion ────────────────────────────────────────────────────────────────────────
r("const GL = { cuenta:'@nahue.urso', dim:'mechanism', sel:'', orden:'rel', ver:48, dias:0, obj:'' };", "const GL = { cuenta:'', dim:'mechanism', sel:'', orden:'rel', ver:48, dias:0, obj:'' };")
r("try{ const g = JSON.parse(localStorage.getItem('bmradar-gl') || '{}');", "try{ const g = JSON.parse(localStorage.getItem('radar-gl') || '{}');")
r("    try{ localStorage.setItem('bmradar-gl', JSON.stringify({dias: GL.dias})); }catch(err){} renderGuion(); };", "    try{ localStorage.setItem('radar-gl', JSON.stringify({dias: GL.dias})); }catch(err){} renderGuion(); };")
r("tema_bm:'Tema BM'", "tema_bm:'Tema EXPOSURE'")
r("  try{ const r = await fetch('data/guion.json?v='+Date.now()); if(!r.ok) return; G = await r.json(); }catch(e){ return; }", "  try{ G = await api('/api/radar/guion'); }catch(e){ return; }")
r("async function pasajes(){ if(GP) return GP; try{ const r = await fetch('data/guion-pasajes.json?v='+Date.now()); GP = r.ok ? await r.json() : {}; }catch(e){ GP = {}; } return GP; }",
  "async function pasajes(){ if(GP) return GP; try{ GP = await api('/api/radar/guion?pasajes=1'); }catch(e){ GP = {}; } return GP; }")
r("const glMet = (r, c) => !glLeads() ? r.rel : (c === '@nahue.urso' ? (r.kk ?? null) : r.com_k);", "const glMet = (r, c) => !glLeads() ? r.rel : (c === '@'+PROPIA ? (r.kk ?? r.com_k) : r.com_k);")
r("  const d = GL.dim, esNahue = GL.cuenta === '@nahue.urso', L = glLeads();", "  const d = GL.dim, esNahue = GL.cuenta === '@'+PROPIA, L = glLeads();")
r("  const nah = esNahue ? null : Object.fromEntries(glGrupos(glVentana('@nahue.urso').filter(r => !GL.obj || r.obj === GL.obj), d, '@nahue.urso').map(x => [x.k, x]));",
  "  const nah = (esNahue || !PROPIA || !G.cuentas['@'+PROPIA]) ? null : Object.fromEntries(glGrupos(glVentana('@'+PROPIA).filter(r => !GL.obj || r.obj === GL.obj), d, '@'+PROPIA).map(x => [x.k, x]));")
r("  const nahSub = x => (!nah || !x || !nah[x.k]) ? '' : ` · Nahue ${relf(nah[x.k].rel)}`;", "  const nahSub = x => (!nah || !x || !nah[x.k]) ? '' : ` · @${PROPIA} ${relf(nah[x.k].rel)}`;")
r("usuarios únicos que comentaron la keyword del caption. Graph API, comentarios por reel.", "usuarios únicos que comentaron la keyword, sobre los comentarios que se bajaron de cada reel.")
r("paso 2: Grupo Estadístico (gatillo de cada cierre) + comentó en el reel y después agendó. Todavía no está conectado.", "falta cruzar con las agendas del CRM: quién comentó el reel y después agendó. Todavía no está conectado.")
r("${nah ? ' Raya blanca: Nahue con la misma etiqueta, objetivo y período.' : ''}", "${nah ? ' Raya blanca: la cuenta propia con la misma etiqueta, objetivo y período.' : ''}")
r("'<span class=\"gl-ley-nah\"></span>Nahue</span>'", "'<span class=\"gl-ley-nah\"></span>@' + esc(PROPIA) + '</span>'")
r("${nx?` · Nahue ${relf(nx.rel)} con ${nx.n} reels`:''}", "${nx?` · @${esc(PROPIA)} ${relf(nx.rel)} con ${nx.n} reels`:''}")
r("'Sin tramos etiquetados todavía. <b>run.py guion</b>'", "'Sin tramos etiquetados todavía.'")

# ── Historias ────────────────────────────────────────────────────────────────────
r("const HSS = { cuenta:'@nahue.urso', dias:7, orden:'fecha' };", "const HSS = { cuenta:'', dias:7, orden:'fecha' };\nconst HS_TIPO = { hand_raiser:'hand raiser', cta:'CTA', why_now:'why now', encuesta:'encuesta', awareness:'awareness', prueba_social:'prueba social', nutricion:'nutrición', libre:'libre' };")
r("  try{ const r = await fetch('data/historias.json?v='+Date.now()); if(!r.ok) return; HS = await r.json(); }catch(e){ return; }", "  try{ HS = await api('/api/radar/historias'); }catch(e){ return; }\n  if(!HS.historias.length) return;")
r("  const cs = Object.keys(n).sort((a,b) => (a!=='nahue.urso') - (b!=='nahue.urso') || n[b]-n[a]);", "  const cs = Object.keys(n).sort((a,b) => (!PROPIAS.has(a)) - (!PROPIAS.has(b)) || n[b]-n[a]);\n  if(!HSS.cuenta) HSS.cuenta = (PROPIA && n[PROPIA]) ? '@'+PROPIA : '*';")
r("`<option value=\"*\">todos los creadores · ${HS.historias.filter(h=>h.cuenta!=='nahue.urso').length}</option>`", "`<option value=\"*\">todas las cuentas seguidas · ${HS.historias.filter(h=>!PROPIAS.has(h.cuenta)).length}</option>`")
r("  const esN = HSS.cuenta === '@nahue.urso';", "  const esN = PROPIAS.has(HSS.cuenta.replace(/^@/, '')) && HS.historias.some(h => '@'+h.cuenta === HSS.cuenta && h.m);")
r("(HSS.cuenta === '*' ? h.cuenta !== 'nahue.urso' : '@'+h.cuenta === HSS.cuenta)", "(HSS.cuenta === '*' ? !PROPIAS.has(h.cuenta) : '@'+h.cuenta === HSS.cuenta)")
r("` · creadores al ${ult.toLocaleDateString", "` · cuentas seguidas al ${ult.toLocaleDateString")
r("'historias de Nahue capturadas en el período'", "'historias de la cuenta propia capturadas en el período'")
r("'DMs a las historias: el lead de cada Contestame YO. Suma del período.'", "'DMs a las historias: el lead de cada historia que pide responder. Suma del período.'")
r("'historias de los creadores de Semillas capturadas en el período'", "'historias de las cuentas de Semillas capturadas en el período'")
r("'videos con habla transcripta (Groq). Los de solo música quedan sin texto.'", "'videos con habla transcripta. Los de solo música quedan sin texto.'")
r("${hsCta(h)?'<span class=\"tag ok\">CTA</span>':''}", "${h.lectura?.tipo && h.lectura.tipo!=='libre'?`<span class=\"tag tipo\">${esc(HS_TIPO[h.lectura.tipo]||h.lectura.tipo)}</span>`:''}${(hsCta(h)||h.lectura?.cta)?'<span class=\"tag ok\">CTA</span>':''}${h.lectura?.keyword?`<span class=\"tag\">${esc(h.lectura.keyword)}</span>`:''}")
r("    ${h.caption?`<h3>Texto</h3><pre class=\"copy\">${esc(h.caption)}</pre>`:''}", "    ${h.lectura?.tipo?`<p style=\"margin:8px 0 0\"><span class=\"tag tipo\">${esc(HS_TIPO[h.lectura.tipo]||h.lectura.tipo)}</span>${h.lectura.cta?'<span class=\"tag ok\">pide acción</span>':''}${h.lectura.keyword?`<span class=\"tag\">keyword ${esc(h.lectura.keyword)}</span>`:''}</p>`:''}\n    ${h.caption?`<h3>Texto en pantalla</h3><pre class=\"copy\">${esc(h.caption)}</pre>`:''}")

# ── Semillas, estado y comentarios ───────────────────────────────────────────────
r('''function renderSemillas(){
  const s = D.semillas || [];
  $('#sem-n').textContent = `${s.filter(x=>x.activa).length} activas de ${s.length}`;
  $('#t-semillas tbody').innerHTML = s.map(x => `<tr class="${x.activa?'':'sin-dato'}">
    <td><b>@${esc(x.handle)}</b>${x.activa?'':' <span class="tag">inactiva</span>'}</td>
    <td>${(x.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</td>
    <td class="r">${num(x.seguidores)}</td><td class="r">${num(x.piezas_semana)}</td><td class="r">${num(x.comentarios_semana)}</td>
    <td class="r">${x.piezas_semana?num(x.bangers):'—'}</td><td class="r">${num(x.med_views)}</td><td class="r" title="piezas históricas usadas para la mediana (mín 5)">${num(x.n_baseline)}</td>
    <td class="muted">${esc(x.nota||'')}</td></tr>`).join('') || `<tr><td colspan="9"><div class="empty">Sin semillas. Editá semillas.json.</div></td></tr>`;
}''', '''function renderSemillas(){
  const s = D.semillas || [], g = gestiona();
  $('#sem-n').textContent = `${s.filter(x=>x.activa).length} activas de ${s.length}`;
  $('#alta').style.display = g ? '' : 'none';
  $('#t-semillas tbody').innerHTML = s.map(x => `<tr class="${x.activa?'':'sin-dato'}" data-h="${esc(x.handle)}">
    <td><b><a href="https://www.instagram.com/${esc(x.handle)}/" target="_blank" rel="noopener" style="text-decoration:none">@${esc(x.handle)}</a></b>${x.activa?'':' <span class="tag">pausada</span>'}${x.nombre?`<br><span class="muted">${esc(x.nombre)}</span>`:''}</td>
    <td>${(x.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</td>
    <td class="r">${num(x.seguidores)}</td><td class="r">${num(x.piezas_semana)}</td><td class="r">${num(x.comentarios_semana)}</td>
    <td class="r">${x.piezas_semana?num(x.bangers):'—'}</td><td class="r">${num(x.med_views)}</td><td class="r" title="piezas históricas usadas para la mediana (mín 5)">${num(x.n_baseline)}</td>
    <td>${x.historias?'<span class="tag ok">sí</span>':'<span class="tag">no</span>'}${g?`<button class="lk" data-a="historias" data-v="${x.historias?0:1}">${x.historias?'apagar':'prender'}</button>`:''}</td>
    <td class="muted">${esc(x.nota||'')}</td>
    <td style="white-space:nowrap">${g?`<button class="lk ${x.activa?'peligro':''}" data-a="activa" data-v="${x.activa?0:1}">${x.activa?'pausar':'reactivar'}</button>`:''}</td></tr>`).join('') || `<tr><td colspan="11"><div class="empty">Sin cuentas. Agregá la primera arriba.</div></td></tr>`;
}
async function trasSemillas(j){ const d = await api('/api/radar/datos'); D = d; PROPIAS = propias(); PROPIA = [...PROPIAS][0] || ''; renderSemillas(); fillCuentas(); return j; }
$('#a-b').onclick = async () => {
  const h = $('#a-h').value.trim(); if(!h){ $('#a-h').focus(); return; }
  const b = $('#a-b'); b.disabled = true;
  try{
    const j = await api('/api/radar/semillas', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ handle: h, tags: [$('#a-t').value], historias: $('#a-s').checked, nota: $('#a-n').value }) });
    await trasSemillas(j);
    $('#a-h').value = ''; $('#a-n').value = '';
    const partes = [j.agregadas.length?`${j.agregadas.length} agregada${j.agregadas.length===1?'':'s'}`:'', j.reactivadas.length?`${j.reactivadas.length} reactivada${j.reactivadas.length===1?'':'s'}`:'', j.ya_estaban.length?`${j.ya_estaban.length} ya estaba${j.ya_estaban.length===1?'':'n'}`:''].filter(Boolean);
    flash(partes.join(' · ') + '. Se leen en la próxima corrida, o ahora con Sincronizar.');
  }catch(e){ flash(e.message, true); } finally { b.disabled = false; }
};
$('#a-h').onkeydown = e => { if(e.key === 'Enter') $('#a-b').click(); };
$('#t-semillas').addEventListener('click', async e => {
  const b = e.target.closest('button.lk'); if(!b) return;
  const h = b.closest('tr').dataset.h;
  b.disabled = true;
  try{ await trasSemillas(await api('/api/radar/semillas', { method:'PATCH', headers:{'content-type':'application/json'}, body: JSON.stringify({ handle: h, [b.dataset.a]: b.dataset.v === '1' }) })); flash('Guardado ✓'); }
  catch(err){ flash(err.message, true); b.disabled = false; }
});

// ═══ ESTADO Y SINCRONIZACIÓN ═══
const PASOS = [
  ['piezas', 'Piezas', 'reels, carruseles y posts de los últimos días de cada cuenta activa, con sus métricas'],
  ['historias', 'Historias', 'las historias activas de las cuentas que las tienen prendidas'],
  ['propias', 'Historias propias', 'las historias activas de la cuenta propia con sus métricas (Graph API)'],
  ['perfiles', 'Perfiles', 'seguidores, nombre y bio de cada cuenta'],
  ['comentarios', 'Comentarios', 'los comentarios de las piezas más comentadas de la semana'],
  ['ciclo', 'Procesar lo que llegó', 'recoge las corridas terminadas, baja las imágenes, transcribe y analiza'],
  ['minar', 'Minar comentarios', 'dolores, objeciones, preguntas y jerga sobre los comentarios ya bajados'],
];
const fhora = f => f ? new Date(f).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';
async function loadEstado(){
  try{ E = await api('/api/radar/estado'); }catch(e){ return; }
  const c = E.conexiones, faltan = [!c.apify && 'Apify', !c.claude && 'Claude', !c.instagram_propio && 'Instagram propio', !c.transcripcion && 'transcripción'].filter(Boolean);
  const chip = $('#c-con');
  chip.style.display = '';
  chip.className = 'chip' + (c.apify && c.claude ? '' : ' falta');
  chip.textContent = faltan.length ? 'falta conectar: ' + faltan.join(', ') : 'todo conectado';
  chip.title = 'Apify lee Instagram. Claude analiza. Instagram propio (Graph API) trae las métricas de las historias de la cuenta. La transcripción pasa a texto lo que se dice.';
  chip.onclick = () => document.querySelector('#tabs button[data-v=semillas]').click();
  $('#b-sync').style.display = gestiona() ? '' : 'none';
  renderEstado(); renderSemillas(); renderComentarios();
}
function renderEstado(){
  if(!E) return;
  const c = E.conexiones;
  const fila = (ok, nombre, detalle) => `<tr><td><b>${nombre}</b></td><td class="${ok?'ok':'mal'}">${ok?'conectado':'falta'}</td><td class="muted">${detalle}</td></tr>`;
  $('#est-wrap').innerHTML = `<div class="cols2"><div><table class="tbl"><tbody>
      ${fila(c.apify, 'Apify', 'lee piezas, perfiles, historias y comentarios de Instagram · gastó US$ ' + d1(E.gasto_apify_30d) + ' en 30 días')}
      ${fila(c.claude, 'Claude', 'analiza cada pieza, lee las historias y escribe las recreaciones · ' + esc(E.modelo))}
      ${fila(c.instagram_propio, 'Instagram propio', 'métricas de las historias de la cuenta (alcance, respuestas, salidas)')}
      ${fila(!!c.transcripcion, 'Transcripción', c.transcripcion ? 'pasa a texto lo que se dice en reels e historias · ' + esc(c.transcripcion) : 'sin esto los reels se analizan solo por el caption y la portada')}
    </tbody></table><p class="muted" style="margin-top:10px">${num(E.sin_analizar)} piezas de los últimos 30 días esperan análisis.</p></div>
    <div class="scroll-x"><table class="tbl"><thead><tr><th>Corrida</th><th>Estado</th><th class="r">Trajo</th><th class="r">Nuevas</th><th class="r">US$</th><th>Cuándo</th></tr></thead><tbody>
      ${(E.corridas||[]).map(k => `<tr title="${esc(k.error||'')}"><td><b>${esc(k.tipo)}</b><br><span class="muted">${esc(k.pedida_por||'')}</span></td><td class="${k.estado==='error'?'mal':k.estado==='recogida'?'ok':''}">${esc(k.estado==='lanzada'?'en curso':k.estado==='recogida'?'lista':'error')}</td><td class="r">${num(k.items)}</td><td class="r">${num(k.nuevos)}</td><td class="r">${k.costo_usd==null?'—':d1(k.costo_usd)}</td><td class="muted">${fhora(k.iniciado)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sin corridas todavía.</td></tr>'}
    </tbody></table></div></div>`;
}
$('#b-sync').onclick = () => {
  ABIERTA = '';
  const d = $('#drawer');
  d.innerHTML = `<div class="dhead"><span class="chip">Sincronizar</span><button class="x" onclick="cerrar()">cerrar ✕</button></div>
    <h2>Qué querés traer ahora</h2>
    <p class="muted">Todo esto corre solo, en horario. Desde acá se adelanta. Las lecturas de Instagram tardan unos minutos: se lanzan y el resultado aparece cuando se procesa.</p>
    ${PASOS.map(([k, n, t]) => `<div class="paso"><div><b>${n}</b><small>${t}</small></div><button class="btn sec" data-p="${k}">${k==='ciclo'||k==='minar'||k==='propias'?'Correr':'Lanzar'}</button></div>`).join('')}
    <div id="sync-r" style="margin-top:14px"></div>`;
  d.classList.add('open'); d.setAttribute('aria-hidden','false');
  d.querySelectorAll('button[data-p]').forEach(b => b.onclick = async () => {
    const txt = b.textContent; b.disabled = true; b.textContent = 'Corriendo…';
    try{
      const j = await accion({ accion:'sincronizar', paso: b.dataset.p });
      $('#sync-r').innerHTML = `<pre class="copy">${esc(JSON.stringify(j, null, 1))}</pre>`;
      flash(j.ok === false ? (j.motivo || 'No se pudo') : 'Listo ✓', j.ok === false);
      loadEstado();
      if(b.dataset.p === 'ciclo' || b.dataset.p === 'minar' || b.dataset.p === 'propias'){ DET.clear(); D = await api('/api/radar/datos'); syncFiltros(); renderKpis(); renderTendencias(); fillCuentas(); renderTabla(); renderGrid(); renderSemillas(); renderComentarios(); loadCuentas(); loadGuion(); loadHistorias(); }
    }catch(e){ flash(e.message, true); $('#sync-r').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    finally{ b.disabled = false; b.textContent = txt; }
  });
};''')
r("  if(!c){ $('#com-wrap').innerHTML = `<div class=\"empty\">Sin minería de comentarios esta semana. <b>run.py comentarios</b> y después <b>run.py minar</b>.</div>`; return; }",
  "  if(!c){ $('#com-wrap').innerHTML = `<div class=\"empty\">Sin minería de comentarios todavía.${gestiona()?' Desde <b>Sincronizar</b>: primero <b>Comentarios</b> (los baja), después <b>Procesar lo que llegó</b> y por último <b>Minar comentarios</b>.':''}</div>`; return; }")

# el arranque va al final, cuando ya están declaradas todas las variables del script
r("</script>\n</body>", "load();\n</script>\n</body>")

if faltan:
    print("NO ENCONTRADO:")
    for f in faltan: print("  ", f)
    sys.exit(1)
for resto in ("nahue", "Nahue", " BM", "run.py", "data/", "KEY"):
    if resto in s:
        import re
        print(f"AVISO: todavía aparece {resto!r}:", [m.group(0) for m in re.finditer(r".{40}" + re.escape(resto) + r".{30}", s)][:4])
io.open("public/radar/index.html", "w", encoding="utf-8", newline="\n").write(s)
print("public/radar/index.html armado:", len(s), "caracteres")
