// modulos/vuelos/vuelos.js — PUERTA DE ENTRADA del módulo Vuelos.
// Planificador (GSD, líneas, fotos, tiempo, baterías, densidad LiDAR), limpiador de KML/KMZ para DJI Pilot 2
// y pronóstico por hora. Otros módulos y la app global solo importan este archivo.

import { iniciarDatos, fijarPersona, planesDeProyecto as planesCrudos, listarDrones, listarPlanes, VERSION_MODULO, ALM } from './datos.js';
import { migrarHoja, etapaVuelo, NOMBRE_ETAPA_VUELO, documentosPermiso, geometria, totales, jornadasNecesarias, nombreSector } from './hoja.js';
import { fondoEstatico } from './mapa-estatico.js';
import { diasHabilesDesde } from '../../compartido/periodicidad.js';
import { COLORES_DIA } from './ui.js';
import { montarPantallas } from './pantallas.js';

export const VERSION = VERSION_MODULO;
export const ALMACENES = Object.values(ALM);

let iniciado = false;
export function iniciar({ personaId } = {}) {
  if (!iniciado) { iniciarDatos({ personaId: personaId ?? null }); iniciado = true; }
  else if (personaId !== undefined) fijarPersona(personaId);
}

/** contexto: { rol, personaId, proyectoId?, planId?, tab? } → { desmontar(), refrescar() } */
export function montar(contenedor, contexto) {
  iniciar({ personaId: contexto.personaId });
  return montarPantallas(contenedor, contexto);
}

/** Planes de vuelo de un proyecto: [{ id, nombre, dronId, dron, resumen }] */
export async function planesDeProyecto(proyectoId) {
  iniciar();
  const [planes, drones] = await Promise.all([planesCrudos(proyectoId), listarDrones()]);
  return planes.map(p => {
    const d = drones.find(x => x.id === p.dronId);
    return { id: p.id, nombre: p.nombre, dronId: p.dronId, dron: (d || {}).nombre || p.dronId, resumen: p.resumen || {}, ...jornadasYMapa(p, d) };
  });
}

/**
 * v0.11.3 · Para la ficha del proyecto: jornadas con sus baterías y un esquema fijo sobre imagen híbrida.
 * → { jornadas: [{ dia, fecha, baterias, min, sectores: 'S1 – S3' }], mapa: html }
 */
function jornadasYMapa(plan, d) {
  try {
    const h = migrarHoja(plan), g = geometria(h);
    if (!g || !d) return { jornadas: [], mapa: '' };
    const t = totales(h, d, g), jor = jornadasNecesarias(h, d, g, t);
    const fechas = Array.isArray(h.programa) && h.programa.length ? h.programa.map(x => x.fecha) : (jor && h.fecha ? diasHabilesDesde(h.fecha, jor.dias.length) : []);
    const n = g.sectores.length, diaDe = {};
    const jornadas = jor ? jor.dias.map((di, k) => {
      di.sectores.forEach(i => { diaDe[i] = k; });
      const a = di.sectores[0], b = di.sectores[di.sectores.length - 1];
      return { dia: k + 1, fecha: fechas[k] || null, baterias: di.baterias, min: di.min, excede: di.excede,
        sectores: n > 1 ? (a === b ? nombreSector(h, a, n) : `${nombreSector(h, a, n)} – ${nombreSector(h, b, n)}`) : 'Área completa' };
    }) : [];
    const todos = g.sectores.flatMap(s => s.poligono), aLL = g.marco.aLonLat, W = 480, H = 200;
    const f = fondoEstatico(todos.map(aLL), W, H, { margen: 14 });
    const color = k => COLORES_DIA[k % COLORES_DIA.length];
    const polis = g.sectores.map((s, i) => { const paso = Math.max(1, Math.ceil(s.poligono.length / 300)); return `<polygon points="${s.poligono.filter((_, j) => j % paso === 0).map(p => f.xy(aLL(p)).map(x => x.toFixed(1)).join(',')).join(' ')}" fill="${color(diaDe[i] ?? 0)}" fill-opacity=".35" stroke="${color(diaDe[i] ?? 0)}" stroke-width="2.5"/>`; }).join('');
    const mapa = `<div class="vu-mapa-fijo" style="aspect-ratio: ${W} / ${H}"><div class="vu-mapa-fijo-teselas" aria-hidden="true">${f.html}</div><svg class="vu-res-mapa" viewBox="0 0 ${W} ${H}" role="img" aria-label="Esquema del vuelo sobre imagen satelital">${polis}</svg><small class="vu-mapa-fijo-atr">Imagen © Esri, Maxar</small></div>`;
    return { jornadas, mapa, coloresDia: jornadas.map((_, k) => color(k)) };
  } catch { return { jornadas: [], mapa: '' }; }
}

/** Todos los vuelos con su etapa (v0.11, para Inicio): [{ id, nombre, proyectoId, pilotoId, fecha, fechas, etapa, etapaTexto, logs, dgac, docsPendientes, resumen }] */
export async function listarVuelos() {
  iniciar();
  return (await listarPlanes()).map(migrarHoja).map(h => ({
    id: h.id, nombre: h.nombre || 'Vuelo sin nombre', proyectoId: h.proyectoId, pilotoId: h.pilotoId, fecha: h.fecha,
    fechas: Array.isArray(h.programa) && h.programa.length ? h.programa.map(x => x.fecha) : (h.fecha ? [h.fecha] : []),
    etapa: etapaVuelo(h), etapaTexto: NOMBRE_ETAPA_VUELO[etapaVuelo(h)], logs: (h.permisos.logs || []).length,
    dgac: h.permisos.dgac, docsPendientes: documentosPermiso(h).filter(x => !x.listo).length, resumen: h.resumen || {}, estado: h.estado,
  }));
}
