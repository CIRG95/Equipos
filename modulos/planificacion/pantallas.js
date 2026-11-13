// modulos/planificacion/pantallas.js — pantallas de Planificación (Sistema v0.15): red geodésica GNSS y marcas de vuelo.
// Rutas: #/planificacion · #/planificacion/proyecto/<id> · #/planificacion/red/<id> · #/planificacion/marcas/<id>
// El mapa (Leaflet + base satelital de Esri, igual que Vuelos) se crea una vez por editor; los cambios repintan
// solo las capas y el panel, para que arrastrar un PR recalcule al instante sin recargar el mapa.

import { escapar as esc, hoyISO, cargarScript, descargar, fechaHoraLegible } from '../../compartido/util.js';
import { listarProyectos, listarPersonas, OFICINA_ID } from '../../compartido/catalogos.js';
import { obtener } from '../../compartido/almacen.js';
import { leerArchivo, analizarKml } from '../vuelos/kml.js';
import { listarPlanes } from '../vuelos/datos.js';
import { agregarMapaBase } from '../vuelos/mapa-base.js';
import { caminosEn, recuadro } from '../vuelos/redvial.js';
import { geoAUtm } from '../monografias/comun.js';
import { guardarConfig } from '../administracion/datos.js';
import { ALM, PARAMS_RED, listarRedes, listarMarcas, obtenerRed, obtenerMarcas, guardarRed, guardarMarcas, eliminar } from './datos.js';
import {
  marcoLocal, sugerirPR, vectoresSugeridos, preAnalisis, evaluarPunto, reforzar, planificarSesiones, tiempoPara, marcasArea, marcasCorredor, dist, largoLinea, areaPoligono,
} from './modelo.js';

const vacio = (t, extra = '') => `<div class="sis-vacio"><p>${t}</p>${extra}</div>`;
const COLOR = { ok: '#0F766E', aviso: '#B7791F', malo: '#B42318', control: '#1D5C63', chequeo: '#1D4ED8', gcp: '#C2571A' };
const NIVEL = { ok: ['Cumple', 'verde'], aviso: ['Débil', 'ambar'], malo: ['No cumple', 'rojo'] };
const km = m => (m >= 1000 ? `${(m / 1000).toLocaleString('es-CL', { maximumFractionDigits: 2 })} km` : `${Math.round(m)} m`);
const minTxt = m => (m == null ? '[tabla de tiempos]' : m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);
const uid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

export function montarPantallas(contenedor, ctx) {
  const raiz = document.createElement('div');
  raiz.className = 'mod-planif';
  contenedor.appendChild(raiz);
  let activo = true, mapa = null, L = null, capas = null, editor = null;
  const st = { proyectos: [], personas: [], hojas: [], config: { tablaTiempos: [] }, modo: null, sel: null };
  const ir = h => { if (location.hash === h) recargar(); else location.hash = h; };
  const nomProy = id => (st.proyectos.find(p => p.id === id) || {}).nombre || 'Sin proyecto';

  async function base() {
    [st.proyectos, st.personas, st.hojas] = await Promise.all([listarProyectos(), listarPersonas(), listarPlanes().catch(() => [])]);
    st.config = (await obtener('admin_config', 'general').catch(() => null)) || { tablaTiempos: [] };
  }

  // ─────────────────────────── Lista ───────────────────────────
  async function lista() {
    const proyId = ctx.vista === 'proyecto' ? ctx.id : null;
    const [redes, marcas] = await Promise.all([listarRedes(), listarMarcas()]);
    const f = x => !proyId || x.proyectoId === proyId;
    const activos = st.proyectos.filter(p => p.id !== OFICINA_ID && p.estado !== 'cerrado');
    const tabla = st.config.tablaTiempos && st.config.tablaTiempos.length ? st.config.tablaTiempos : [{ hastaKm: '', minutos: '' }];
    const fila = (x, tipo) => `<a class="sis-fila" href="#/planificacion/${tipo}/${esc(x.id)}"><span class="sis-fila-txt"><b>${esc(x.nombre || (tipo === 'red' ? 'Red geodésica' : 'Marcas de vuelo'))}</b><span class="sis-tenue">${esc(nomProy(x.proyectoId))} · ${tipo === 'red' ? `${(x.puntos || []).filter(p => p.tipo !== 'control').length} PR · ${(x.vectores || []).length} vectores` : `${(x.marcas || []).length} marcas · ${x.modo === 'corredor' ? 'corredor' : 'área'}`} · ${fechaHoraLegible(x.actualizadoEn)}</span></span></a>`;
    raiz.innerHTML = `<div class="sis-cab"><div><h1>Planificación${proyId ? ` · ${esc(nomProy(proyId))}` : ''}</h1><span class="sis-tenue">Diseño de redes geodésicas GNSS y distribución de marcas de vuelo, con revisión de la geometría antes de salir a terreno.</span></div></div>
      <div class="sis-dos"><div>
        <section class="sis-tarjeta"><h2>Nueva planificación</h2>
          <form class="sis-form" data-f="nueva">
            <div class="sis-par"><label class="sis-campo"><span>Proyecto *</span><select name="proyectoId" required><option value="">Seleccione</option>${activos.map(p => `<option value="${esc(p.id)}" ${p.id === proyId ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>
              <label class="sis-campo"><span>Tipo</span><select name="tipo"><option value="red">Red geodésica (PR)</option><option value="marcas">Marcas de vuelo (GCP)</option></select></label></div>
            <label class="sis-campo"><span>Nombre</span><input name="nombre" placeholder="Ej.: Red de PR · Etapa 1"></label>
            <div class="sis-acciones"><button class="sis-btn primario">Crear y abrir</button></div>
          </form></section>
        <section class="sis-tarjeta"><h2>Redes geodésicas</h2>${redes.filter(f).length ? `<div class="sis-lista">${redes.filter(f).map(x => fila(x, 'red')).join('')}</div>` : vacio('Sin redes planificadas.')}</section>
        <section class="sis-tarjeta"><h2>Marcas de vuelo</h2>${marcas.filter(f).length ? `<div class="sis-lista">${marcas.filter(f).map(x => fila(x, 'marcas')).join('')}</div>` : vacio('Sin distribuciones de marcas.')}</section>
      </div><aside>
        <section class="sis-tarjeta" id="tabla-tiempos"><h2>Tabla de tiempos de ocupación GNSS</h2>
          <p class="sis-tenue">Tiempos mínimos de observación estática según la longitud del vector, de acuerdo con la norma de la empresa (Manual de Carreteras, Volumen 2). Ingrese la tabla tal como aparece en la edición vigente: la duración de cada sesión se calcula con ella.</p>
          <form class="sis-form" data-f="tabla"><div class="sis-tabla-scroll"><table class="sis-tabla"><thead><tr><th>Vector hasta (km)</th><th>Tiempo mínimo (min)</th></tr></thead><tbody>
            ${tabla.map(t => `<tr><td><input name="km" type="number" min="0" step="0.1" value="${esc(t.hastaKm)}" aria-label="Vector hasta (km)"></td><td><input name="min" type="number" min="0" step="1" value="${esc(t.minutos)}" aria-label="Tiempo mínimo (min)"></td></tr>`).join('')}
            <tr><td><input name="km" type="number" min="0" step="0.1" aria-label="Vector hasta (km), fila nueva"></td><td><input name="min" type="number" min="0" step="1" aria-label="Tiempo mínimo, fila nueva"></td></tr></tbody></table></div>
            <p class="sis-tenue">Complete la última fila para agregar un rango; deje vacías las casillas de un rango para quitarlo.</p>
            <div class="sis-acciones"><button class="sis-btn primario">Guardar tabla</button></div></form></section>
      </aside></div>`;
  }

  // ─────────────────────────── Mapa común ───────────────────────────
  async function crearMapa(el) {
    try { if (!window.L) await cargarScript('vendor/leaflet/leaflet.js'); } catch { el.innerHTML = '<p class="sis-tenue">No se pudo cargar el mapa.</p>'; return null; }
    L = window.L;
    const m = L.map(el, { zoomControl: true });
    agregarMapaBase(L, m);
    m.setView([-33.0, -70.6], 7);
    capas = L.layerGroup().addTo(m);
    m.on('click', ev => editor && editor.alClic && editor.alClic(ev.latlng));
    return m;
  }
  const encuadrar = lls => { if (mapa && lls.length) { try { mapa.fitBounds(L.latLngBounds(lls.map(([lon, lat]) => [lat, lon])).pad(0.15)); } catch { /* */ } } };

  // ─────────────────────────── Editor de red geodésica ───────────────────────────
  async function editorRed(id) {
    let r = await obtenerRed(id);
    if (!r) { raiz.innerHTML = vacio('Esta planificación no existe.', '<a class="sis-btn" href="#/planificacion">Volver</a>'); return; }
    let calc = null, guardarT = null;
    const P = () => ({ ...PARAMS_RED, ...(r.params || {}) });
    const hojasProy = st.hojas.filter(h => h.proyectoId === r.proyectoId && h.area && h.area.original);
    raiz.innerHTML = `<div class="sis-miga"><a href="#/planificacion">Planificación</a> / <a href="#/proyecto/${esc(r.proyectoId)}">${esc(nomProy(r.proyectoId))}</a> / ${esc(r.nombre || 'Red geodésica')}</div>
      <div class="sis-cab"><div><h1>Planificar red geodésica</h1><span class="sis-tenue">Cargue el área de trabajo, sugiera la red y ajuste los PR sobre el mapa: el pre-análisis se recalcula de forma inmediata.</span></div><span id="pl-veredicto"></span></div>
      <div class="pl-editor"><section class="sis-tarjeta pl-mapa-caja"><div class="pl-mapa"></div><div class="pl-barra" id="pl-barra"></div></section><aside class="pl-panel" id="pl-panel"></aside></div>
      <section class="sis-tarjeta" id="pl-bajo"></section>`;
    mapa = await crearMapa(raiz.querySelector('.pl-mapa'));
    const guardarLuego = () => { clearTimeout(guardarT); guardarT = setTimeout(async () => { r = await guardarRed(r); }, 400); };

    function calcular() {
      const pts = r.puntos || [];
      const baseLL = (r.area && r.area.length ? r.area : pts.map(p => [p.lon, p.lat]));
      if (!baseLL.length) { calc = null; return; }
      const marco = marcoLocal(baseLL);
      const xy = pts.map(p => marco.aXY([p.lon, p.lat]));
      const idx = new Map(pts.map((p, i) => [p.id, i]));
      const vec = (r.vectores || []).map(([a, b]) => [idx.get(a), idx.get(b)]).filter(([i, j]) => i != null && j != null && i !== j);
      const fijos = pts.map((p, i) => (p.tipo === 'control' ? i : -1)).filter(i => i >= 0);
      const p = P();
      const pa = pts.length > 1 && vec.length ? preAnalisis(xy, vec, { fijos, a: p.a, b: p.b }) : null;
      const ev = pts.map((_, i) => (pa ? evaluarPunto(pa.puntos[i], p.tol) : { nivel: 'malo', motivo: 'Sin vectores' }));
      const ses = vec.length ? planificarSesiones(xy, vec, { receptores: p.receptores, tabla: st.config.tablaTiempos || [] }) : [];
      calc = { marco, xy, vec, pa, ev, ses, fijos };
    }

    function pintarCapas({ encuadre = false } = {}) {
      if (!mapa) return;
      capas.clearLayers();
      if (r.area && r.area.length) L.polygon(r.area.map(([lon, lat]) => [lat, lon]), { color: '#1D5C63', weight: 2, dashArray: '8 6', fillOpacity: 0.06 }).addTo(capas).bindTooltip('Área de trabajo');
      for (const c of r.caminos || []) L.polyline(c.linea.map(([lon, lat]) => [lat, lon]), { color: '#C9A46A', weight: 5, opacity: 0.9 }).addTo(capas).bindTooltip(c.nombre || 'Camino');
      for (const c of r.caminosMOP || []) L.polyline(c.map(([lon, lat]) => [lat, lon]), { color: '#E0C38A', weight: 3, opacity: 0.8 }).addTo(capas);
      if (!calc) { if (encuadre && r.area) encuadrar(r.area); return; }
      const pts = r.puntos;
      // Escala de las elipses: la tolerancia se dibuja como un 3 % del tamaño del área (exageradas, solo para comparar).
      const tam = Math.max(200, Math.sqrt(r.area && r.area.length > 2 ? areaPoligono(r.area.map(calc.marco.aXY)) : 1e6));
      const esc95 = (tam * 0.03) / P().tol;
      calc.vec.forEach(([i, j]) => { const a = pts[i], b = pts[j]; const amarre = a.tipo === 'control' || b.tipo === 'control'; L.polyline([[a.lat, a.lon], [b.lat, b.lon]], { color: amarre ? '#1D5C63' : '#33383E', weight: 2, dashArray: amarre ? '6 5' : null, opacity: 0.85 }).addTo(capas).bindTooltip(`${a.nombre} – ${b.nombre} · ${km(dist(calc.xy[i], calc.xy[j]))}`); });
      pts.forEach((p, i) => {
        const e = calc.ev[i], color = p.tipo === 'control' ? COLOR.control : COLOR[e.nivel];
        if (calc.pa && isFinite(calc.pa.puntos[i].s95) && calc.pa.puntos[i].s95 > 0) L.circle([p.lat, p.lon], { radius: calc.pa.puntos[i].s95 * esc95, color, weight: 1, fillOpacity: 0.12, interactive: false }).addTo(capas);
        const icono = L.divIcon({ className: '', html: `<div class="pl-pr ${p.tipo === 'control' ? 'control' : e.nivel}${st.sel === p.id ? ' sel' : ''}"><i></i><span>${esc(p.nombre)}</span></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
        const mk = L.marker([p.lat, p.lon], { icon: icono, draggable: true, keyboard: true, title: p.nombre }).addTo(capas);
        mk.on('click', () => { st.sel = p.id; pintarTodo(); });
        mk.on('dragend', ev => { const ll = ev.target.getLatLng(); p.lat = ll.lat; p.lon = ll.lng; st.sel = p.id; guardarLuego(); pintarTodo(); });
      });
      if (encuadre) encuadrar([...(r.area || []), ...pts.map(p => [p.lon, p.lat])]);
    }

    function pintarPanel() {
      const p = P(), pts = r.puntos || [];
      const malos = calc ? calc.ev.filter((e, i) => e.nivel === 'malo' && pts[i].tipo !== 'control').length : 0, avisos = calc ? calc.ev.filter((e, i) => e.nivel === 'aviso').length : 0;
      raiz.querySelector('#pl-veredicto').innerHTML = !pts.length ? '' : malos ? `<span class="sis-chip rojo">${malos} PR no cumple${malos > 1 ? 'n' : ''}</span>` : avisos ? `<span class="sis-chip ambar">${avisos} PR débil${avisos > 1 ? 'es' : ''}</span>` : '<span class="sis-chip verde">Red óptima según el pre-análisis</span>';
      raiz.querySelector('#pl-barra').innerHTML = `<button type="button" class="sis-btn chico${st.modo === 'pr' ? ' activo' : ''}" data-a="modo" data-m="pr" aria-pressed="${st.modo === 'pr'}">+ PR en el mapa</button><button type="button" class="sis-btn chico${st.modo === 'control' ? ' activo' : ''}" data-a="modo" data-m="control" aria-pressed="${st.modo === 'control'}">+ Punto de control</button>
        <span class="pl-ley"><i class="ok"></i>Cumple <i class="aviso"></i>Débil <i class="malo"></i>No cumple <i class="control"></i>Control · elipses exageradas para comparar</span>`;
      const sel = pts.find(x => x.id === st.sel);
      const iSel = sel ? pts.indexOf(sel) : -1;
      const tabla = st.config.tablaTiempos || [];
      raiz.querySelector('#pl-panel').innerHTML = `
        <section class="sis-tarjeta"><h2>Datos de entrada</h2>
          <label class="sis-campo"><span>Área de trabajo (KMZ o KML del mandante)</span><input type="file" accept=".kml,.kmz" data-c="area-archivo"></label>
          ${hojasProy.length ? `<label class="sis-campo"><span>O usar el área de una hoja de vuelo del proyecto</span><select data-c="area-hoja"><option value="">Seleccione</option>${hojasProy.map(h => `<option value="${esc(h.id)}">${esc(h.nombre || 'Hoja de vuelo')}</option>`).join('')}</select></label>` : ''}
          <p class="sis-tenue">${r.area && r.area.length ? `Área cargada: ${esc(r.areaNombre || 'polígono')} · ${(areaPoligono(r.area.map(marcoLocal(r.area).aXY)) / 10000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} ha.` : 'Sin área: los PR sugeridos se distribuyen dentro de ella.'}</p>
          <label class="sis-campo"><span>Caminos (KML con líneas)</span><input type="file" accept=".kml,.kmz" data-c="caminos-archivo"></label>
          <label class="sis-opcion"><input type="checkbox" data-c="mop" ${r.usarMOP ? 'checked' : ''}> Usar la red vial del MOP (sin conexión a internet si ya se descargó)</label>
          <p class="sis-tenue">${(r.caminos || []).length + (r.usarMOP ? (r.caminosMOP || []).length : 0)} camino(s). El PR de partida se ubica junto al camino, en el acceso al área.</p>
          <div class="sis-par"><label class="sis-campo"><span>Receptores</span><input type="number" min="2" max="8" value="${p.receptores}" data-c="param" data-k="receptores"></label><label class="sis-campo"><span>PR a sugerir</span><input type="number" min="2" max="60" value="${p.nSugeridos}" data-c="param" data-k="nSugeridos"></label></div>
          <div class="sis-par"><label class="sis-campo"><span>Precisión a priori (mm)</span><input type="number" min="1" step="0.5" value="${p.a}" data-c="param" data-k="a"></label><label class="sis-campo"><span>+ ppm</span><input type="number" min="0" step="0.1" value="${p.b}" data-c="param" data-k="b"></label><label class="sis-campo"><span>Tolerancia horizontal 95 % (mm)</span><input type="number" min="1" value="${p.tol}" data-c="param" data-k="tol"></label></div>
          <p class="sis-tenue">Tiempos: ${tabla.length ? `tabla de ${tabla.length} rangos cargada.` : '<a href="#/planificacion">cargue la tabla del Manual de Carreteras</a> para calcular la duración de las sesiones.'}</p>
          <div class="sis-acciones"><button type="button" class="sis-btn" data-a="sugerir">Sugerir red</button><button type="button" class="sis-btn primario" data-a="reforzar" ${calc && calc.ev.some(e => e.nivel !== 'ok') ? '' : 'disabled'}>Reforzar puntos débiles</button></div>
          <p class="sis-tenue">«Sugerir red» reemplaza los PR y vectores actuales (los puntos de control se mantienen).</p>
        </section>
        ${sel ? `<section class="sis-tarjeta"><div class="sis-cab"><h2>${esc(sel.nombre)}</h2>${sel.tipo === 'control' ? '<span class="sis-chip azul">Control</span>' : `<span class="sis-chip ${NIVEL[calc.ev[iSel].nivel][1]}">${NIVEL[calc.ev[iSel].nivel][0]}</span>`}</div>
          <p class="sis-tenue">${esc(calc.ev[iSel].motivo)}${calc.pa && calc.pa.puntos[iSel] ? ` · ${calc.pa.puntos[iSel].grado} vector(es)` : ''}</p>
          <div class="sis-par"><label class="sis-campo"><span>Nombre</span><input value="${esc(sel.nombre)}" data-c="pt-nombre"></label><label class="sis-campo"><span>Tipo</span><select data-c="pt-tipo"><option value="pr">PR nuevo</option><option value="control" ${sel.tipo === 'control' ? 'selected' : ''}>Punto de control (amarre)</option></select></label></div>
          <label class="sis-campo"><span>Nota de terreno</span><input value="${esc(sel.nota || '')}" data-c="pt-nota" placeholder="Acceso, obstrucciones, cerco…"></label>
          <div class="sis-lista">${calc.vec.map(([i, j], k) => (i === iSel || j === iSel ? `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(r.puntos[i === iSel ? j : i].nombre)}</b><span class="sis-tenue">${km(dist(calc.xy[i], calc.xy[j]))}</span></span><button type="button" class="sis-btn chico" data-a="vec-quitar" data-k="${k}">Quitar vector</button></div>` : '')).join('')}</div>
          <label class="sis-campo"><span>Agregar vector hacia</span><select data-c="vec-agregar"><option value="">Seleccione</option>${pts.filter(x => x.id !== sel.id && !calc.vec.some(([i, j]) => (i === iSel && pts[j].id === x.id) || (j === iSel && pts[i].id === x.id))).map(x => `<option value="${esc(x.id)}">${esc(x.nombre)}</option>`).join('')}</select></label>
          <div class="sis-acciones"><button type="button" class="sis-btn peligro" data-a="pt-quitar">Quitar punto</button></div></section>`
        : `<section class="sis-tarjeta"><p class="sis-tenue">Seleccione un PR en el mapa para ver su detalle, editar su nombre y nota de terreno, o ajustar sus vectores. Los PR pueden desplazarse arrastrándolos.</p></section>`}
        ${pts.length && !pts.some(x => x.tipo === 'control') ? `<div class="sis-aviso-linea">Sin puntos de control: el pre-análisis toma ${esc(pts[0].nombre)} como punto fijo. Agregue los vértices de amarre con «+ Punto de control» para evaluar la red respecto de ellos.</div>` : ''}
        <p class="sis-tenue">Pre-análisis simplificado para planificar: vectores con σ = ${p.a} mm + ${p.b} ppm, componentes horizontales independientes y puntos de control fijos. No reemplaza el ajuste final con las observaciones reales. El mapa no muestra obstrucciones del cielo ni accesos: regístrelos en la nota de cada PR.</p>`;
      const bajo = raiz.querySelector('#pl-bajo');
      const tab = st.tabBajo || 'vectores';
      const R = p.receptores;
      bajo.innerHTML = `<div class="sis-cab"><div class="ad-tabs-btn" role="tablist"><button type="button" role="tab" aria-selected="${tab === 'vectores'}" class="${tab === 'vectores' ? 'activo' : ''}" data-a="tab-bajo" data-t="vectores">Vectores (${calc ? calc.vec.length : 0})</button><button type="button" role="tab" aria-selected="${tab === 'sesiones'}" class="${tab === 'sesiones' ? 'activo' : ''}" data-a="tab-bajo" data-t="sesiones">Sesiones (${calc ? calc.ses.length : 0})</button></div>
        <div class="sis-acciones"><button type="button" class="sis-btn chico" data-a="csv-puntos">Exportar puntos</button><button type="button" class="sis-btn chico" data-a="csv-vectores">Exportar vectores y sesiones</button><button type="button" class="sis-btn chico peligro" data-a="borrar-red">Eliminar planificación</button></div></div>
        ${!calc || !calc.vec.length ? vacio('Sin vectores. Use «Sugerir red» o agregue vectores desde el detalle de cada PR.') : tab === 'vectores'
          ? `<div class="sis-tabla-scroll"><table class="sis-tabla"><thead><tr><th>Vector</th><th>Largo</th><th>Tipo</th><th>Redundancia local</th><th>Ocupación mínima</th></tr></thead><tbody>${calc.vec.map(([i, j], k) => { const L2 = dist(calc.xy[i], calc.xy[j]); const amarre = pts[i].tipo === 'control' || pts[j].tipo === 'control'; const rr = calc.pa ? calc.pa.vectores[k] : null; return `<tr><td class="mono">${esc(pts[i].nombre)} – ${esc(pts[j].nombre)}</td><td class="mono">${km(L2)}</td><td>${amarre ? 'Amarre' : 'Independiente'}</td><td class="mono">${rr ? rr.r.toFixed(2) : '—'}</td><td>${minTxt(tiempoPara(L2, tabla))}</td></tr>`; }).join('')}</tbody></table></div>`
          : `<div class="sis-tabla-scroll"><table class="sis-tabla"><thead><tr><th>Sesión</th>${Array.from({ length: R }, (_, k) => `<th>Receptor ${k + 1}</th>`).join('')}<th>Vectores</th><th>Vector más largo</th><th>Duración</th></tr></thead><tbody>${calc.ses.map((s, k) => `<tr><td><b>S${k + 1}</b></td>${Array.from({ length: R }, (_, q) => `<td class="mono">${s.puntos[q] != null ? esc(pts[s.puntos[q]].nombre) : '—'}</td>`).join('')}<td>${s.vectores.length}</td><td class="mono">${km(s.largoMax)}</td><td>${minTxt(s.minutos)}</td></tr>`).join('')}</tbody></table></div>
            <p class="sis-tenue">Con ${R} receptores, cada sesión entrega ${R - 1} vectores independientes. Cada sesión comparte al menos un punto con la anterior para encadenar la red.${calc.ses.every(s => s.minutos != null) ? ` Tiempo total de observación: ${minTxt(calc.ses.reduce((t, s) => t + s.minutos, 0))}, sin traslados.` : ''}</p>`}`;
    }
    function pintarTodo(op) { calcular(); pintarCapas(op); pintarPanel(); }

    async function cargarMOP() {
      if (!r.usarMOP || !r.area || !r.area.length) { r.caminosMOP = []; return; }
      try { r.caminosMOP = (await caminosEn(recuadro(r.area, 0.5))).map(c => c.linea); } catch { r.caminosMOP = []; ctx.avisar('No se pudo cargar la red vial del MOP.'); }
    }
    await cargarMOP();

    editor = {
      alClic: ll => {
        if (!st.modo) return;
        const tipo = st.modo; const n = (r.puntos || []).filter(x => x.tipo === tipo).length + 1;
        const p = { id: uid(), nombre: tipo === 'control' ? `C-${n}` : `PR-${String(n).padStart(2, '0')}`, tipo, lat: ll.lat, lon: ll.lng, nota: '' };
        r.puntos = [...(r.puntos || []), p]; st.sel = p.id; st.modo = null; guardarLuego(); pintarTodo();
      },
      acciones: {
        modo: b => { st.modo = st.modo === b.dataset.m ? null : b.dataset.m; if (st.modo) ctx.avisar('Toque el mapa para ubicar el punto'); pintarPanel(); },
        'tab-bajo': b => { st.tabBajo = b.dataset.t; pintarPanel(); },
        sugerir: async () => {
          if (!r.area || !r.area.length) { ctx.avisar('Primero cargue el área de trabajo (KMZ o KML).'); return; }
          if ((r.puntos || []).some(x => x.tipo !== 'control') && !confirm('¿Reemplazar los PR y vectores actuales por una red sugerida?')) return;
          const marco = marcoLocal(r.area);
          const poli = r.area.map(marco.aXY);
          const caminos = [...(r.caminos || []).map(c => c.linea), ...(r.usarMOP ? r.caminosMOP || [] : [])].map(l => l.map(marco.aXY));
          const control = (r.puntos || []).filter(x => x.tipo === 'control');
          const s = sugerirPR(poli, { n: P().nSugeridos, caminos, fijos: control.map(x => marco.aXY([x.lon, x.lat])) });
          const nuevos = s.puntos.map((q, k) => { const [lon, lat] = marco.aLonLat(q); return { id: uid(), nombre: `PR-${String(k + 1).padStart(2, '0')}`, tipo: 'pr', lon, lat, nota: k === 0 && s.partida === 'camino' ? 'PR de partida, junto al camino' : '' }; });
          r.puntos = [...control, ...nuevos];
          const xy = r.puntos.map(x => marco.aXY([x.lon, x.lat]));
          r.vectores = vectoresSugeridos(xy).map(([i, j]) => [r.puntos[i].id, r.puntos[j].id]);
          st.sel = null; r = await guardarRed(r); pintarTodo({ encuadre: true });
          ctx.avisar(s.partida === 'camino' ? 'Red sugerida: el PR-01 queda junto al camino' : 'Red sugerida (sin caminos: el PR-01 queda en un vértice del área)');
        },
        reforzar: async () => {
          const antes = calc.vec.length;
          const v = reforzar(calc.xy, calc.vec, { fijos: calc.fijos, a: P().a, b: P().b, tol: P().tol });
          r.vectores = v.map(([i, j]) => [r.puntos[i].id, r.puntos[j].id]);
          r = await guardarRed(r); pintarTodo();
          ctx.avisar(`Se agregaron ${v.length - antes} vector(es)`);
        },
        'vec-quitar': async b => { const [i, j] = calc.vec[Number(b.dataset.k)]; const a = r.puntos[i].id, c = r.puntos[j].id; r.vectores = r.vectores.filter(([x, y]) => !((x === a && y === c) || (x === c && y === a))); r = await guardarRed(r); pintarTodo(); },
        'pt-quitar': async () => { if (!confirm('¿Quitar este punto y sus vectores?')) return; r.puntos = r.puntos.filter(x => x.id !== st.sel); r.vectores = r.vectores.filter(([a, c]) => a !== st.sel && c !== st.sel); st.sel = null; r = await guardarRed(r); pintarTodo(); },
        'csv-puntos': () => exportarPuntos(r),
        'csv-vectores': () => exportarVectores(r, calc, P()),
        'borrar-red': async () => { if (!confirm('¿Eliminar esta planificación? Va a la papelera.')) return; await eliminar(ALM.redes, r.id); ir('#/planificacion'); },
      },
      cambios: {
        'area-archivo': async i => {
          const f = i.files[0]; if (!f) return;
          try {
            const k = analizarKml(await leerArchivo(f), f.name);
            if (!k.poligonos.length) throw new Error('El archivo no trae polígonos.');
            const pol = k.poligonos.sort((a, b) => b.area - a.area)[0];
            r.area = pol.anillo; r.areaNombre = pol.nombre || f.name; await cargarMOP(); r = await guardarRed(r); pintarTodo({ encuadre: true }); pintarPanel();
            ctx.avisar('Área cargada');
          } catch (e) { ctx.avisar(e.message); }
        },
        'area-hoja': async i => { const h = hojasProy.find(x => x.id === i.value); if (!h) return; r.area = h.area.original.anillo; r.areaNombre = `Hoja de vuelo «${h.nombre || ''}»`; await cargarMOP(); r = await guardarRed(r); pintarTodo({ encuadre: true }); },
        'caminos-archivo': async i => {
          const f = i.files[0]; if (!f) return;
          try { const k = analizarKml(await leerArchivo(f), f.name); const ls = k.ejes.map(e => ({ nombre: e.nombre, linea: e.linea })); if (!ls.length) throw new Error('El archivo no trae líneas.'); r.caminos = [...(r.caminos || []), ...ls]; r = await guardarRed(r); pintarTodo(); ctx.avisar(`${ls.length} camino(s) agregado(s)`); } catch (e) { ctx.avisar(e.message); }
        },
        mop: async i => { r.usarMOP = i.checked; await cargarMOP(); r = await guardarRed(r); pintarTodo(); },
        param: async i => { r.params = { ...P(), [i.dataset.k]: Math.max(0, Number(i.value) || 0) }; r = await guardarRed(r); pintarTodo(); },
        'pt-nombre': async i => { const p = r.puntos.find(x => x.id === st.sel); p.nombre = i.value.trim() || p.nombre; r = await guardarRed(r); pintarTodo(); },
        'pt-tipo': async i => { const p = r.puntos.find(x => x.id === st.sel); p.tipo = i.value; r = await guardarRed(r); pintarTodo(); },
        'pt-nota': async i => { const p = r.puntos.find(x => x.id === st.sel); p.nota = i.value; r = await guardarRed(r); },
        'vec-agregar': async i => { if (!i.value) return; r.vectores = [...(r.vectores || []), [st.sel, i.value]]; r = await guardarRed(r); pintarTodo(); },
      },
    };
    pintarTodo({ encuadre: true });
  }

  // ─────────────────────────── Editor de marcas de vuelo ───────────────────────────
  async function editorMarcas(id) {
    let r = await obtenerMarcas(id);
    if (!r) { raiz.innerHTML = vacio('Esta planificación no existe.', '<a class="sis-btn" href="#/planificacion">Volver</a>'); return; }
    const hojasProy = st.hojas.filter(h => h.proyectoId === r.proyectoId && h.area && (h.area.original || h.area.eje));
    raiz.innerHTML = `<div class="sis-miga"><a href="#/planificacion">Planificación</a> / <a href="#/proyecto/${esc(r.proyectoId)}">${esc(nomProy(r.proyectoId))}</a> / ${esc(r.nombre || 'Marcas de vuelo')}</div>
      <div class="sis-cab"><div><h1>Distribuir marcas de vuelo</h1><span class="sis-tenue">Cargue el área o el eje del vuelo, genere la distribución y ajuste las marcas sobre el mapa. Toque una marca para cambiarla entre control y chequeo.</span></div></div>
      <div class="pl-editor"><section class="sis-tarjeta pl-mapa-caja"><div class="pl-mapa"></div><div class="pl-barra"><span class="pl-ley"><i class="gcp"></i>Control <i class="chequeo"></i>Chequeo</span></div></section><aside class="pl-panel" id="pl-panel"></aside></div>`;
    mapa = await crearMapa(raiz.querySelector('.pl-mapa'));
    const geo = () => (r.modo === 'corredor' ? r.eje : r.area) || [];
    function pintarCapas({ encuadre = false } = {}) {
      if (!mapa) return;
      capas.clearLayers();
      if (r.modo !== 'corredor' && r.area) L.polygon(r.area.map(([lon, lat]) => [lat, lon]), { color: '#1D5C63', weight: 2, dashArray: '8 6', fillOpacity: 0.06 }).addTo(capas);
      if (r.modo === 'corredor' && r.eje) { L.polyline(r.eje.map(([lon, lat]) => [lat, lon]), { color: '#1D5C63', weight: 2, dashArray: '8 6' }).addTo(capas); }
      (r.marcas || []).forEach(m => {
        const icono = L.divIcon({ className: '', html: `<div class="pl-gcp ${m.tipo}"><i></i>${r.marcas.length <= 60 ? `<span>${esc(m.nombre)}</span>` : ''}</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
        const mk = L.marker([m.lat, m.lon], { icon: icono, draggable: true, title: m.nombre }).addTo(capas);
        mk.on('click', async () => { m.tipo = m.tipo === 'control' ? 'chequeo' : 'control'; renombrar(); r = await guardarMarcas(r); pintarCapas(); pintarPanel(); });
        mk.on('dragend', async ev => { const ll = ev.target.getLatLng(); m.lat = ll.lat; m.lon = ll.lng; r = await guardarMarcas(r); });
      });
      if (encuadre) encuadrar([...geo(), ...(r.marcas || []).map(m => [m.lon, m.lat])]);
    }
    const renombrar = () => { let c = 0, k = 0; for (const m of r.marcas) m.nombre = m.tipo === 'control' ? `GCP-${String(++c).padStart(2, '0')}` : `CHK-${String(++k).padStart(2, '0')}`; };
    function pintarPanel() {
      const nC = (r.marcas || []).filter(m => m.tipo === 'control').length, nK = (r.marcas || []).length - nC;
      const hoja = st.hojas.find(h => h.id === r.hojaId);
      raiz.querySelector('#pl-panel').innerHTML = `<section class="sis-tarjeta">
        <div class="ad-segmento" role="group" aria-label="Tipo de vuelo"><button type="button" class="${r.modo !== 'corredor' ? 'activo' : ''}" data-a="modo-m" data-m="area">Área</button><button type="button" class="${r.modo === 'corredor' ? 'activo' : ''}" data-a="modo-m" data-m="corredor">Corredor</button></div>
        ${hojasProy.length ? `<label class="sis-campo"><span>Usar el ${r.modo === 'corredor' ? 'eje' : 'área'} de una hoja de vuelo</span><select data-c="hoja"><option value="">Seleccione</option>${hojasProy.map(h => `<option value="${esc(h.id)}" ${h.id === r.hojaId ? 'selected' : ''}>${esc(h.nombre || 'Hoja de vuelo')}</option>`).join('')}</select></label>` : ''}
        <label class="sis-campo"><span>${r.modo === 'corredor' ? 'Eje (KML con una línea)' : 'Área (KMZ o KML)'}</span><input type="file" accept=".kml,.kmz" data-c="archivo"></label>
        ${hoja && hoja.params ? `<p class="sis-tenue">GSD de la hoja de vuelo: ${esc(hoja.params.gsd)} cm (referencia).</p>` : ''}
        <label class="sis-campo"><span>Distancia entre marcas: <b class="mono">${r.espaciado} m</b></span><input type="range" min="50" max="1500" step="10" value="${r.espaciado}" data-c="espaciado"></label>
        ${r.modo === 'corredor' ? `<label class="sis-campo"><span>Ancho del corredor (m)</span><input type="number" min="10" value="${r.ancho}" data-c="ancho"></label>` : ''}
        <p class="sis-tenue">Regla: ${r.modo === 'corredor' ? 'marcas alternadas a ambos lados del eje y pares obligatorios en los extremos; una de cada tres interiores queda de chequeo.' : 'esquinas, perímetro y malla interior; los puntos de chequeo van entre medio (cerca del 25 %).'} ${r.espaciadoManual ? 'Espaciado definido manualmente.' : `El espaciado inicial se sugiere según el tamaño del ${r.modo === 'corredor' ? 'corredor' : 'área'}.`} Ajústelo según la exigencia del proyecto y vuelva a generar.</p>
        <div class="sis-acciones"><button type="button" class="sis-btn primario" data-a="generar">Generar distribución</button></div></section>
        <section class="sis-tarjeta"><h2>Resultado</h2><div class="sis-chips"><span class="sis-chip ambar">${nC} de control</span><span class="sis-chip azul">${nK} de chequeo</span></div>
          <p class="sis-tenue">Los puntos de chequeo no se incluyen en el ajuste; se utilizan para validar la precisión del modelo en Agisoft o Pix4D.</p>
          <div class="sis-acciones"><button type="button" class="sis-btn primario" data-a="csv-marcas" ${(r.marcas || []).length ? '' : 'disabled'}>Exportar CSV para Agisoft / Pix4D</button><button type="button" class="sis-btn" data-a="a-red">Amarrar a una red de PR</button><button type="button" class="sis-btn chico peligro" data-a="borrar-marcas">Eliminar</button></div></section>`;
    }
    editor = {
      alClic: null,
      acciones: {
        'modo-m': async b => { r.modo = b.dataset.m; r = await guardarMarcas(r); pintarCapas({ encuadre: true }); pintarPanel(); },
        generar: async () => {
          const g = geo(); if (g.length < 2) { ctx.avisar(r.modo === 'corredor' ? 'Primero cargue el eje.' : 'Primero cargue el área.'); return; }
          if ((r.marcas || []).length && !confirm('¿Reemplazar las marcas actuales?')) return;
          const marco = marcoLocal(g);
          if (!r.espaciadoManual) {
            // Espaciado inicial según el tamaño: ~25 marcas en un área y ~12 tramos en un corredor (se ajusta con el deslizador).
            const xy = g.map(marco.aXY), redondo = x => Math.min(1500, Math.max(80, Math.round(x / 10) * 10));
            r.espaciado = r.modo === 'corredor' ? redondo(largoLinea(xy) / 12) : redondo(Math.sqrt(areaPoligono(xy) / 25));
          }
          const ms = r.modo === 'corredor' ? marcasCorredor(g.map(marco.aXY), { espaciado: r.espaciado, ancho: r.ancho }) : marcasArea(g.map(marco.aXY), { espaciado: r.espaciado });
          r.marcas = ms.map(m => { const [lon, lat] = marco.aLonLat(m.p); return { id: uid(), tipo: m.tipo, lon, lat }; });
          renombrar(); r = await guardarMarcas(r); pintarCapas({ encuadre: true }); pintarPanel();
        },
        'csv-marcas': () => exportarMarcas(r),
        'a-red': async () => {
          const redes = (await listarRedes()).filter(x => x.proyectoId === r.proyectoId);
          if (redes[0]) ir(`#/planificacion/red/${redes[0].id}`);
          else { const n = await guardarRed({ proyectoId: r.proyectoId, nombre: 'Red de PR', area: r.modo === 'corredor' ? null : r.area, areaNombre: r.modo === 'corredor' ? '' : 'Área de las marcas de vuelo' }); ir(`#/planificacion/red/${n.id}`); }
        },
        'borrar-marcas': async () => { if (!confirm('¿Eliminar esta distribución? Va a la papelera.')) return; await eliminar(ALM.marcas, r.id); ir('#/planificacion'); },
      },
      cambios: {
        hoja: async i => { const h = hojasProy.find(x => x.id === i.value); if (!h) return; r.hojaId = h.id; if (h.area.tipo === 'corredor' && h.area.eje) { r.modo = 'corredor'; r.eje = h.area.eje.linea; } else if (h.area.original) { r.modo = 'area'; r.area = h.area.original.anillo; } r = await guardarMarcas(r); pintarCapas({ encuadre: true }); pintarPanel(); },
        archivo: async i => {
          const f = i.files[0]; if (!f) return;
          try {
            const k = analizarKml(await leerArchivo(f), f.name);
            if (r.modo === 'corredor') { if (!k.ejes.length) throw new Error('El archivo no trae una línea.'); r.eje = k.ejes.sort((a, b) => b.largo - a.largo)[0].linea; }
            else { if (!k.poligonos.length) throw new Error('El archivo no trae polígonos.'); r.area = k.poligonos.sort((a, b) => b.area - a.area)[0].anillo; }
            r = await guardarMarcas(r); pintarCapas({ encuadre: true }); pintarPanel(); ctx.avisar('Geometría cargada');
          } catch (e) { ctx.avisar(e.message); }
        },
        espaciado: async i => { r.espaciado = Number(i.value); r.espaciadoManual = true; r = await guardarMarcas(r); pintarPanel(); },
        ancho: async i => { r.ancho = Math.max(10, Number(i.value) || 100); r = await guardarMarcas(r); pintarPanel(); },
      },
    };
    pintarCapas({ encuadre: true }); pintarPanel();
  }

  // ─────────────────────────── Exportar ───────────────────────────
  const celda = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = filas => '﻿' + filas.map(f => f.map(celda).join(';')).join('\r\n');
  const n3 = v => (v == null ? '' : v.toFixed(3).replace('.', ','));
  const n8 = v => v.toFixed(8).replace('.', ',');
  function exportarPuntos(r) {
    const filas = [['Nombre', 'Tipo', 'Latitud', 'Longitud', 'Este (UTM)', 'Norte (UTM)', 'Huso', 'Nota de terreno']];
    for (const p of r.puntos || []) { const u = geoAUtm(p.lat, p.lon); const z = Math.floor((p.lon + 180) / 6) + 1; filas.push([p.nombre, p.tipo === 'control' ? 'Control' : 'PR', n8(p.lat), n8(p.lon), n3(u && u.este), n3(u && u.norte), `${z}${p.lat < 0 ? ' S' : ' N'}`, p.nota || '']); }
    descargar(`Puntos_${(r.nombre || 'red').replace(/\W+/g, '_')}_${hoyISO()}.csv`, csv(filas), 'text/csv;charset=utf-8');
  }
  function exportarVectores(r, calc, p) {
    if (!calc) return;
    const pts = r.puntos, tabla = st.config.tablaTiempos || [];
    const filas = [['Vector', 'Desde', 'Hasta', 'Largo (m)', 'Tipo', 'Ocupación mínima (min)']];
    calc.vec.forEach(([i, j], k) => { const L2 = dist(calc.xy[i], calc.xy[j]); filas.push([`V${k + 1}`, pts[i].nombre, pts[j].nombre, Math.round(L2), pts[i].tipo === 'control' || pts[j].tipo === 'control' ? 'Amarre' : 'Independiente', tiempoPara(L2, tabla) ?? 'Sin tabla']); });
    filas.push([]); filas.push(['Sesión', ...Array.from({ length: p.receptores }, (_, k) => `Receptor ${k + 1}`), 'Vector más largo (m)', 'Duración (min)']);
    calc.ses.forEach((s, k) => filas.push([`S${k + 1}`, ...Array.from({ length: p.receptores }, (_, q) => (s.puntos[q] != null ? pts[s.puntos[q]].nombre : '')), Math.round(s.largoMax), s.minutos ?? 'Sin tabla']));
    descargar(`Vectores_y_sesiones_${(r.nombre || 'red').replace(/\W+/g, '_')}_${hoyISO()}.csv`, csv(filas), 'text/csv;charset=utf-8');
  }
  function exportarMarcas(r) {
    const filas = [['Nombre', 'Tipo', 'Latitud', 'Longitud', 'Este (UTM)', 'Norte (UTM)', 'Huso']];
    for (const m of r.marcas || []) { const u = geoAUtm(m.lat, m.lon); const z = Math.floor((m.lon + 180) / 6) + 1; filas.push([m.nombre, m.tipo === 'control' ? 'Control' : 'Chequeo', n8(m.lat), n8(m.lon), n3(u && u.este), n3(u && u.norte), `${z}${m.lat < 0 ? ' S' : ' N'}`]); }
    descargar(`Marcas_${(r.nombre || 'vuelo').replace(/\W+/g, '_')}_${hoyISO()}.csv`, csv(filas), 'text/csv;charset=utf-8');
  }

  // ─────────────────────────── Eventos ───────────────────────────
  raiz.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-a]');
    if (!b || !editor || !editor.acciones[b.dataset.a]) return;
    try { await editor.acciones[b.dataset.a](b); } catch (e) { console.error(e); ctx.avisar(e.message); }
  });
  raiz.addEventListener('change', async ev => {
    const i = ev.target.closest('[data-c]');
    if (!i || !editor || !editor.cambios[i.dataset.c]) return;
    try { await editor.cambios[i.dataset.c](i); } catch (e) { console.error(e); ctx.avisar(e.message); }
  });
  raiz.addEventListener('submit', async ev => {
    const f = ev.target.closest('form[data-f]');
    if (!f) return;
    ev.preventDefault();
    const fd = new FormData(f);
    try {
      if (f.dataset.f === 'nueva') {
        const datos = { proyectoId: fd.get('proyectoId'), nombre: String(fd.get('nombre') || '').trim() };
        const n = fd.get('tipo') === 'marcas' ? await guardarMarcas({ ...datos, nombre: datos.nombre || 'Marcas de vuelo' }) : await guardarRed({ ...datos, nombre: datos.nombre || 'Red de PR' });
        ir(`#/planificacion/${fd.get('tipo') === 'marcas' ? 'marcas' : 'red'}/${n.id}`);
      }
      if (f.dataset.f === 'tabla') {
        const kms = fd.getAll('km'), mins = fd.getAll('min');
        const filas = kms.map((k, i) => ({ hastaKm: k === '' ? null : Number(k), minutos: mins[i] === '' ? null : Number(mins[i]) })).filter(x => x.hastaKm != null && x.minutos != null).sort((a, b) => a.hastaKm - b.hastaKm);
        await guardarConfig({ tablaTiempos: filas });
        ctx.avisar('Tabla de tiempos guardada'); await recargar();
      }
    } catch (e) { console.error(e); ctx.avisar(e.message); }
  });

  async function recargar() {
    if (!activo) return;
    editor = null; mapa = null;
    await base();
    if (ctx.vista === 'red') await editorRed(ctx.id);
    else if (ctx.vista === 'marcas') await editorMarcas(ctx.id);
    else await lista();
    editor = editor || { acciones: {}, cambios: {} };
  }
  recargar().catch(e => { console.error(e); raiz.innerHTML = `<div class="sis-error">No se pudo cargar: ${esc(e.message)}</div>`; });
  return {
    desmontar() { activo = false; raiz.remove(); },
    refrescar() { if (!ctx.vista) recargar(); }, // en los editores no se recarga para no perder el mapa ni la selección
  };
}

export { largoLinea };
