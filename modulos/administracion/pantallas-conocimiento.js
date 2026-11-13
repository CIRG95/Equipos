// modulos/administracion/pantallas-conocimiento.js — Conocimiento de la empresa (Sistema v0.15): mapa de puntos propios
// (PR y vértices de monografías y de las redes de proyectos cerrados), plantillas y biblioteca técnica, lecciones aprendidas.
// Rutas: #/conocimiento · #/conocimiento/biblioteca · #/conocimiento/lecciones

import { cargarScript } from '../../compartido/util.js';
import { abrirArchivo } from '../../compartido/archivos.js';
import { todasLasMonografias } from '../monografias/datos.js';
import { utmAGeo } from '../monografias/comun.js';
import { puntosDeRedes } from '../planificacion/planificacion.js';
import { agregarMapaBase } from '../vuelos/mapa-base.js';
import { ALM, guardarRegistro, guardarArchivoAdmin, aPapelera } from './datos.js';
import { TIPOS_BIBLIOTECA, NOMBRE_BIBLIOTECA, mandanteDeProyecto } from './modelo.js';
import { esc, fechaLegible, vacio, plural, pestanas, campo, input, select, ICO } from './ui.js';

const PESTANAS = [['mapa', 'Mapa de puntos propios', '#/conocimiento'], ['biblioteca', 'Plantillas y biblioteca', '#/conocimiento/biblioteca'], ['lecciones', 'Lecciones aprendidas', '#/conocimiento/lecciones']];
const cab = activa => `<div class="sis-cab"><div><h1>Conocimiento de la empresa</h1><span class="sis-tenue">Repositorio de información técnica de la empresa, disponible como apoyo para la planificación de nuevos proyectos.</span></div></div>${pestanas(PESTANAS, activa)}`;

/** Coordenadas de una monografía: UTM (este, norte, huso) o latitud/longitud decimales. */
function coordMono(m) {
  const num = v => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
  const e = num(m.este), n = num(m.norte);
  if (e && n) { const g = utmAGeo(e, n, m.zonaUTM || '19 S'); if (g) return g; }
  const la = num(m.latitud), lo = num(m.longitud);
  if (la != null && lo != null && isFinite(la) && isFinite(lo) && Math.abs(la) <= 90) return { lat: la, lon: lo };
  return null;
}

export async function puntosPropios(st) {
  const cerrados = new Set(st.proyectos.filter(p => p.estado === 'cerrado').map(p => p.id));
  const monos = await todasLasMonografias().catch(() => []);
  const out = [];
  for (const m of monos) { const c = coordMono(m); if (c) out.push({ nombre: m.puntoMedido || m.nombre || 'Punto', lat: c.lat, lon: c.lon, proyectoId: m.proyectoId, origen: 'Monografía', enlace: `#/monografias/${m.proyectoId}/${m.id}` }); }
  for (const p of await puntosDeRedes().catch(() => [])) if (cerrados.has(p.proyectoId)) out.push({ nombre: p.nombre, lat: p.lat, lon: p.lon, proyectoId: p.proyectoId, origen: p.tipo === 'control' ? 'Vértice de control' : 'PR de red', enlace: `#/planificacion/red/${p.redId}` });
  return out;
}

export async function mapaPuntos(v) {
  v.st.puntosPropios = await puntosPropios(v.st);
  const n = v.st.puntosPropios.length;
  return `${cab('mapa')}
    <div class="sis-dos"><div><section class="sis-tarjeta pl-mapa-caja"><div class="pl-mapa" id="co-mapa"></div></section>
      <p class="sis-tenue">Cada círculo agrupa los PR y vértices monumentados por la empresa; acérquese para separarlos y seleccione uno para ver su proyecto. Los puntos se incorporan automáticamente desde las monografías y desde las redes de los proyectos cerrados.</p></div>
    <aside><section class="sis-tarjeta"><h2>${plural(n, 'punto registrado', 'puntos registrados')}</h2>
      <p class="sis-tenue">Al planificar una nueva red en la zona, use estos puntos como posibles puntos de amarre.</p>
      <div class="sis-lista" id="co-lista">${n ? '' : vacio('Aún no hay puntos con coordenadas. Llegan desde las monografías de la aplicación de Terreno y desde las redes de proyectos cerrados.')}</div></section></aside></div>`;
}

/** Mapa con agrupación simple por cuadrícula de pantalla (sin librerías adicionales). */
export async function iniciarMapaPuntos(v, raiz) {
  const el = raiz.querySelector('#co-mapa');
  if (!el) return null;
  try { if (!window.L) await cargarScript('vendor/leaflet/leaflet.js'); } catch { el.innerHTML = '<p class="sis-tenue">No se pudo cargar el mapa.</p>'; return null; }
  const L = window.L, mapa = L.map(el);
  agregarMapaBase(L, mapa);
  const capa = L.layerGroup().addTo(mapa);
  const pts = v.st.puntosPropios || [];
  const nomProy = id => (v.st.proyectos.find(p => p.id === id) || {}).nombre || 'Proyecto';
  if (pts.length) mapa.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lon])).pad(0.2)); else mapa.setView([-33.0, -70.6], 6);
  function pintar() {
    capa.clearLayers();
    const grupos = new Map();
    for (const p of pts) { const q = mapa.latLngToLayerPoint([p.lat, p.lon]); const k = `${Math.floor(q.x / 56)},${Math.floor(q.y / 56)}`; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(p); }
    for (const g of grupos.values()) {
      if (g.length === 1) {
        const p = g[0];
        L.circleMarker([p.lat, p.lon], { radius: 7, color: '#1D5C63', weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(capa)
          .bindPopup(`<b>${esc(p.nombre)}</b><br>${esc(p.origen)} · ${esc(nomProy(p.proyectoId))}<br><a href="${esc(p.enlace)}">Abrir</a>`);
      } else {
        const lat = g.reduce((s, p) => s + p.lat, 0) / g.length, lon = g.reduce((s, p) => s + p.lon, 0) / g.length;
        const r = 14 + Math.min(16, Math.sqrt(g.length) * 3);
        L.marker([lat, lon], { icon: L.divIcon({ className: '', html: `<div class="co-grupo" style="width:${2 * r}px;height:${2 * r}px;line-height:${2 * r}px">${g.length}</div>`, iconSize: [2 * r, 2 * r], iconAnchor: [r, r] }), title: `${g.length} puntos` })
          .addTo(capa).on('click', () => mapa.fitBounds(L.latLngBounds(g.map(p => [p.lat, p.lon])).pad(0.3)));
      }
    }
    const b = mapa.getBounds(), vis = pts.filter(p => b.contains([p.lat, p.lon])).slice(0, 40);
    const lista = raiz.querySelector('#co-lista');
    if (lista && pts.length) lista.innerHTML = vis.map(p => `<a class="sis-fila" href="${esc(p.enlace)}"><span class="sis-fila-txt"><b class="mono">${esc(p.nombre)}</b><span class="sis-tenue">${esc(p.origen)} · ${esc(nomProy(p.proyectoId))}</span></span></a>`).join('') || '<p class="sis-tenue">Sin puntos en esta vista.</p>';
  }
  mapa.on('zoomend moveend', pintar);
  pintar();
  return mapa;
}

export function biblioteca(v) {
  const items = v.st.d.biblioteca.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || String(b.version || '').localeCompare(String(a.version || '')));
  const vigente = new Map();
  for (const x of items) if (!vigente.has(`${x.tipo}|${x.nombre}`)) vigente.set(`${x.tipo}|${x.nombre}`, x.id);
  const puedeEditar = v.ctx.rol !== 'terreno' || true; // todos pueden aportar documentos técnicos
  return `${cab('biblioteca')}
    ${puedeEditar ? `<section class="sis-tarjeta"><h2>Agregar documento</h2><form class="sis-form" data-f="biblioteca">
      <div class="sis-par">${campo('Tipo', select('tipo', TIPOS_BIBLIOTECA, 'plantilla'))}${campo('Nombre *', input('nombre', '', 'required placeholder="Monografía de PR, Manual de Carreteras Vol. 2…"'))}${campo('Versión', input('version', '', 'placeholder="v3 · oct-2026"'))}</div>
      <div class="sis-par">${campo('Archivo *', '<input type="file" name="archivo" required>')}${campo('Se usa en', input('vinculo', '', 'placeholder="Redes y Nivelación, Vuelos, mandante Codelco…"'))}</div>
      <div class="sis-acciones"><button class="sis-btn primario">Agregar</button></div></form>
      <p class="sis-tenue">Si agrega una nueva versión con el mismo nombre, la anterior queda como histórica y la vigente se marca automáticamente.</p></section>` : ''}
    ${TIPOS_BIBLIOTECA.map(([k, t]) => { const xs = items.filter(x => x.tipo === k); return xs.length ? `<section class="sis-tarjeta"><h2>${esc(t)}</h2><div class="sis-lista">${xs.map(x => `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(x.nombre)}</b><span class="sis-tenue">${esc(x.version || 'Sin versión')}${x.vinculo ? ` · ${esc(x.vinculo)}` : ''} · ${fechaLegible(String(x.creadoEn || '').slice(0, 10))}</span></span>
      <span class="sis-chips">${vigente.get(`${x.tipo}|${x.nombre}`) === x.id ? '<span class="sis-chip verde">Vigente</span>' : '<span class="sis-chip gris">Histórica</span>'}${x.archivoId ? `<button type="button" class="sis-btn chico" data-a="ver-archivo" data-id="${esc(x.archivoId)}">${ICO.ver}Ver</button>` : ''}<button type="button" class="sis-btn chico peligro" data-a="bib-borrar" data-id="${esc(x.id)}">Quitar</button></span></div>`).join('')}</div></section>` : ''; }).join('') || vacio('Aún no hay documentos en la biblioteca.')}`;
}

export function lecciones(v) {
  const ps = v.st.proyectos.filter(p => p.cierre && String(p.cierre.lecciones || '').trim());
  const ms = v.st.d.mandantes;
  const filtro = v.st.filtroLecciones || '';
  const filas = ps.map(p => ({ p, m: mandanteDeProyecto(p, ms) })).filter(x => !filtro || (x.m && x.m.id === filtro) || (filtro === 'sin' && !x.m));
  return `${cab('lecciones')}
    <div class="sis-cab"><p class="sis-tenue">Se registran al cerrar cada proyecto y se muestran automáticamente en la ficha de los proyectos de la misma comuna o del mismo mandante.</p>
      <label class="sis-campo ad-filtro-lecciones"><span>Mandante</span><select data-c="filtro-lecciones"><option value="">Todos</option>${ms.map(m => `<option value="${esc(m.id)}" ${filtro === m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}<option value="sin" ${filtro === 'sin' ? 'selected' : ''}>Sin mandante registrado</option></select></label></div>
    <section class="sis-tarjeta">${filas.length ? `<div class="sis-lista">${filas.map(({ p, m }) => `<a class="sis-fila" href="#/proyecto/${esc(p.id)}"><span class="sis-fila-txt"><b>${esc(p.nombre)}</b><span>${esc(p.cierre.lecciones)}</span><span class="sis-tenue">${esc(m ? m.nombre : (p.mandante || 'Sin mandante'))}${p.comuna ? ` · ${esc(p.comuna)}` : ''}${p.cierre.fecha ? ` · ${fechaLegible(p.cierre.fecha)}` : ''}</span></span></a>`).join('')}</div>` : vacio('Aún no hay lecciones registradas. Se escriben en el cierre de cada proyecto.')}</section>`;
}

/** Lecciones de otros proyectos relacionados (misma comuna o mismo mandante), para la ficha del proyecto. */
export function leccionesRelacionadas(p, proyectos, mandantes) {
  const m = mandanteDeProyecto(p, mandantes);
  return proyectos.filter(x => x.id !== p.id && x.cierre && String(x.cierre.lecciones || '').trim() && ((p.comuna && x.comuna === p.comuna) || (m && mandanteDeProyecto(x, mandantes) === m)));
}

export const acciones = {
  'bib-borrar': async (b, v) => { if (!confirm('¿Quitar este documento de la biblioteca?')) return false; await aPapelera(ALM.biblioteca, b.dataset.id); return true; },
  'ver-archivo': async b => { await abrirArchivo(b.dataset.id); return false; },
};
export const cambios = { 'filtro-lecciones': (i, v) => { v.st.filtroLecciones = i.value; return true; } };
export const formularios = {
  biblioteca: async (f, fd, v) => {
    const arch = fd.get('archivo');
    if (!arch || !arch.size) throw new Error('Seleccione el archivo.');
    const reg = await guardarRegistro(ALM.biblioteca, { tipo: fd.get('tipo'), nombre: String(fd.get('nombre')).trim(), version: String(fd.get('version') || '').trim(), vinculo: String(fd.get('vinculo') || '').trim() });
    const a = await guardarArchivoAdmin(arch, { duenoTipo: 'biblioteca', duenoId: reg.id, carpeta: `Biblioteca/${NOMBRE_BIBLIOTECA[fd.get('tipo')] || 'Documentos'}` });
    await guardarRegistro(ALM.biblioteca, { id: reg.id, archivoId: a.id });
    v.avisar('Documento agregado'); return true;
  },
};
