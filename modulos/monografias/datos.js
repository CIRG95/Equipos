// modulos/monografias/datos.js — datos de Monografías y de lo que publica la app de Terreno (prefijo terreno_, se sincroniza).
//   terreno_monografias           la monografía tal como la envió Terreno (mismo formato; imágenes → { archivo: id })
//   terreno_monografias_gabinete  la versión revisada en el Sistema (misma forma; basadoEn = actualizadoEn de la de Terreno)
//   terreno_revisiones            estados de revisión, solo se agregan: enviada → en-revision → lista | con-observacion
//   terreno_jornadas              jornadas publicadas con sus levantamientos (fotos de puntos → { archivo: id })
// Las fotos van en compartido_archivos (modulo 'terreno', con proyectoId y detalle: tipo, punto, lat, lng, hora, leyenda).

import { registrarAlmacenes, obtener, todos, porIndice, guardar } from '../../compartido/almacen.js';
import { sellar, uuid } from '../../compartido/util.js';
import { guardarArchivoDatos, archivosDeProyecto, infoArchivo } from '../../compartido/archivos.js';

export const VERSION_MODULO = '0.1';
export const SCHEMA_VERSION = 1;
export const ALM = { mono: 'terreno_monografias', gabinete: 'terreno_monografias_gabinete', revisiones: 'terreno_revisiones', jornadas: 'terreno_jornadas' };
export const ESTADOS = {
  enviada: { texto: 'Enviada desde terreno', color: 'gris' },
  'en-revision': { texto: 'En revisión', color: 'azul' },
  lista: { texto: 'Lista', color: 'verde' },
  'con-observacion': { texto: 'Con observación', color: 'ambar' },
  borrador: { texto: 'Creada en gabinete', color: 'gris' },
};
/** Campos de imagen de la monografía de Terreno. */
export const IMAGENES = ['clienteLogo', 'croquisImg', 'panoramicaImg'];

let persona = null;
let registrado = false;
export function iniciarDatos({ personaId = null } = {}) {
  if (!registrado) {
    registrarAlmacenes([
      { nombre: ALM.mono, indices: [['proyectoId', 'proyectoId']] },
      { nombre: ALM.gabinete, indices: [['proyectoId', 'proyectoId']] },
      { nombre: ALM.revisiones, indices: [['monografiaId', 'monografiaId'], ['proyectoId', 'proyectoId']] },
      { nombre: ALM.jornadas, indices: [['proyectoId', 'proyectoId']] },
    ]);
    registrado = true;
  }
  persona = personaId;
}
export function fijarPersona(p) { persona = p; }
const sello = (r, p = persona) => sellar(r, { personaId: p, schemaVersion: SCHEMA_VERSION });
const vivo = r => r && !r.eliminadoEn;

// ─────────── Fotos ───────────
async function huella(texto) {
  try {
    const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(texto));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  } catch { return `${texto.length}-${texto.slice(-64)}`; }
}
const esDataURL = v => typeof v === 'string' && v.startsWith('data:');
const fechaCarpeta = iso => String(iso || new Date().toISOString()).slice(0, 10);

/**
 * Guarda una foto de terreno como archivo del proyecto (si ya está la misma foto, devuelve la que había).
 * detalle: { tipo, monografiaId, puntoId, lat, lng, hora, leyenda, autor }
 */
export async function guardarFoto(dataURL, { proyectoId, duenoTipo = 'terreno_foto', duenoId = null, detalle = {}, personaId = persona, nombreProyecto = '' } = {}) {
  if (!esDataURL(dataURL)) throw new Error('La foto debe venir como dataURL.');
  const h = await huella(dataURL);
  const previa = (await archivosDeProyecto(proyectoId, 'terreno')).find(a => a.detalle && a.detalle.huella === h);
  if (previa) return previa.id;
  const tipo = detalle.tipo || 'otra';
  const carpeta = `Proyectos/${nombreProyecto || proyectoId}/Terreno/${fechaCarpeta(detalle.hora)}`;
  const nombre = `${tipo}${detalle.punto ? '_' + detalle.punto : ''}_${String(detalle.hora || '').replace(/[^0-9]/g, '').slice(0, 14) || Date.now()}.jpg`;
  const reg = await guardarArchivoDatos(dataURL, nombre, { modulo: 'terreno', duenoTipo, duenoId: duenoId || proyectoId, rol: 'foto', proyectoId, carpeta, detalle: { ...detalle, tipo, huella: h } }, { personaId });
  return reg.id;
}

/** Fotos del proyecto que llegaron desde Terreno (sin contenido; se muestran con urlArchivo). */
export async function fotosDeProyecto(proyectoId) {
  return (await archivosDeProyecto(proyectoId, 'terreno')).filter(a => (a.mime || '').startsWith('image/'));
}

// ─────────── Monografías ───────────
/** Pasa las imágenes dataURL de una monografía de Terreno a archivos. Devuelve una copia con { archivo: id }. */
export async function guardarImagenesDe(m, { proyectoId, personaId = persona, nombreProyecto = '' } = {}) {
  const copia = { ...m };
  const det = (tipo, extra = {}) => ({ tipo, monografiaId: m.id, punto: m.puntoMedido || '', hora: m.fechaMedicion || m.creado || '', autor: m.operadorNombre || '', ...extra });
  for (const k of IMAGENES) {
    if (esDataURL(m[k])) copia[k] = { archivo: await guardarFoto(m[k], { proyectoId, duenoTipo: 'terreno_monografia', duenoId: m.id, personaId, nombreProyecto, detalle: det(k === 'croquisImg' ? 'croquis' : k === 'panoramicaImg' ? 'panoramica' : 'logo') }) };
  }
  copia.fotosExtra = [];
  for (const f of (m.fotosExtra || [])) {
    const g = { ...f };
    if (esDataURL(f.img)) g.img = { archivo: await guardarFoto(f.img, { proyectoId, duenoTipo: 'terreno_monografia', duenoId: m.id, personaId, nombreProyecto, detalle: det('detalle', { leyenda: f.leyenda || '' }) }) };
    copia.fotosExtra.push(g);
  }
  return copia;
}

/** Terreno publica (o vuelve a publicar) una monografía. */
export async function publicarMonografia(m, { proyectoId, personaId = persona, nombreProyecto = '' } = {}) {
  if (!m || !m.id) throw new Error('La monografía no tiene id.');
  if (!proyectoId) throw new Error('Falta el proyecto del Sistema.');
  const copia = await guardarImagenesDe(m, { proyectoId, personaId, nombreProyecto });
  const previa = await obtener(ALM.mono, m.id);
  const reg = sello({ ...copia, id: m.id, proyectoId, origen: 'app-terreno', publicadoEn: new Date().toISOString(), publicadoPor: personaId, creadoEn: previa ? previa.creadoEn : undefined }, personaId);
  await guardar(ALM.mono, reg);
  if (!previa) await agregarRevision({ monografiaId: m.id, proyectoId, estado: 'enviada', observacion: '' }, personaId);
  return { id: m.id, estado: (await estadoDe(m.id)).estado };
}

async function revisionesDe(monografiaId) {
  return (await porIndice(ALM.revisiones, 'monografiaId', monografiaId)).filter(vivo).sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
}
export async function agregarRevision({ monografiaId, proyectoId, estado, observacion = '' }, personaId = persona) {
  if (!ESTADOS[estado]) throw new Error('Estado desconocido: ' + estado);
  return guardar(ALM.revisiones, sello({ id: uuid(), monografiaId, proyectoId, estado, observacion: String(observacion || '').trim(), por: personaId }, personaId));
}
export async function estadoDe(monografiaId) {
  const r = (await revisionesDe(monografiaId)).pop();
  return r ? { estado: r.estado, observacion: r.observacion, revisadoPor: r.por, fecha: r.creadoEn } : { estado: 'borrador', observacion: '', revisadoPor: null, fecha: null };
}

/**
 * Monografías de un proyecto, ya combinadas: la de gabinete si existe (si no, la de Terreno), con su estado
 * y si Terreno envió una versión más nueva que la revisada.
 */
export async function monografiasDeProyecto(proyectoId) {
  const [deTerreno, deGabinete, revs] = await Promise.all([porIndice(ALM.mono, 'proyectoId', proyectoId), porIndice(ALM.gabinete, 'proyectoId', proyectoId), porIndice(ALM.revisiones, 'proyectoId', proyectoId)]);
  const ultima = new Map();
  for (const r of revs.filter(vivo).sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))) ultima.set(r.monografiaId, r);
  const terreno = new Map(deTerreno.filter(vivo).map(m => [m.id, m]));
  const gab = new Map(deGabinete.filter(vivo).map(m => [m.id, m]));
  const ids = new Set([...terreno.keys(), ...gab.keys()]);
  return [...ids].map(id => {
    const t = terreno.get(id) || null, g = gab.get(id) || null, r = ultima.get(id);
    return {
      id, ficha: g || t, terreno: t, gabinete: g,
      nuevaDeTerreno: !!(t && g && g.basadoEn && t.actualizadoEn > g.basadoEn),
      estado: r ? r.estado : (t ? 'enviada' : 'borrador'), observacion: r ? r.observacion : '', revisadoPor: r ? r.por : null, fechaEstado: r ? r.creadoEn : null,
    };
  });
}
export async function monografia(id) {
  const [t, g] = await Promise.all([obtener(ALM.mono, id), obtener(ALM.gabinete, id)]);
  return vivo(g) ? g : vivo(t) ? t : null;
}
/** Guarda la versión de gabinete (la revisada en el Sistema). */
export async function guardarGabinete(m) {
  const t = await obtener(ALM.mono, m.id);
  return guardar(ALM.gabinete, sello({ ...m, basadoEn: m.basadoEn || (t ? t.actualizadoEn : null) }));
}
/** Descarta la versión de gabinete y vuelve a la que envió Terreno. */
export async function usarVersionDeTerreno(id) {
  const t = await obtener(ALM.mono, id);
  if (!t) return null;
  const g = await obtener(ALM.gabinete, id);
  const nueva = { ...t, basadoEn: t.actualizadoEn, proyectoId: t.proyectoId };
  delete nueva.origen;
  return guardar(ALM.gabinete, sello({ ...nueva, creadoEn: g ? g.creadoEn : undefined }));
}
export async function eliminarDeGabinete(id) {
  const g = await obtener(ALM.gabinete, id);
  if (g) await guardar(ALM.gabinete, sello({ ...g, eliminadoEn: new Date().toISOString() }));
}

/** Estado de las monografías de un proyecto, para la app de Terreno. */
export async function estadoMonografias(proyectoId) {
  return (await monografiasDeProyecto(proyectoId)).filter(x => x.terreno)
    .map(x => ({ id: x.id, punto: x.ficha.puntoMedido || '', estado: x.estado, observacion: x.observacion, revisadoPor: x.revisadoPor, fecha: x.fechaEstado }));
}

// ─────────── Jornadas ───────────
/** Terreno publica una jornada con sus levantamientos; las fotos de los puntos pasan a archivos del proyecto. */
export async function publicarJornada(jornada, levantamientos, { proyectoId, personaId = persona, nombreProyecto = '' } = {}) {
  if (!jornada || !jornada.id) throw new Error('La jornada no tiene id.');
  if (!proyectoId) throw new Error('Falta el proyecto del Sistema.');
  const levs = [];
  let nFotos = 0;
  for (const l of (levantamientos || [])) {
    const puntos = [];
    for (const p of (l.puntos || [])) {
      const q = { ...p };
      if (esDataURL(p.foto)) {
        q.foto = { archivo: await guardarFoto(p.foto, { proyectoId, duenoTipo: 'terreno_jornada', duenoId: jornada.id, personaId, nombreProyecto, detalle: { tipo: 'punto', jornadaId: jornada.id, punto: (p.valores && (p.valores.nombre || p.valores.punto || p.valores.id)) || '', lat: p.lat ?? null, lng: p.lng ?? null, hora: p.timestamp || '', autor: jornada.operador || '' } }) };
        nFotos++;
      }
      puntos.push(q);
    }
    const fotosReq = [];
    for (const f of (l.fotosReq || [])) {
      const g = { ...f };
      if (esDataURL(f.foto)) { g.foto = { archivo: await guardarFoto(f.foto, { proyectoId, duenoTipo: 'terreno_jornada', duenoId: jornada.id, personaId, nombreProyecto, detalle: { tipo: 'detalle', jornadaId: jornada.id, leyenda: f.nombre || f.texto || '', hora: f.hora || '', autor: jornada.operador || '' } }) }; nFotos++; }
      fotosReq.push(g);
    }
    levs.push({ ...l, puntos, fotosReq });
  }
  const previa = await obtener(ALM.jornadas, jornada.id);
  const { lat, lng, ...resto } = jornada;
  await guardar(ALM.jornadas, sello({ ...resto, lat: lat ?? null, lng: lng ?? null, id: jornada.id, proyectoId, levantamientos: levs, publicadoEn: new Date().toISOString(), creadoEn: previa ? previa.creadoEn : undefined }, personaId));
  return { id: jornada.id, fotos: nFotos };
}
export async function jornadasDeProyecto(proyectoId) {
  return (await porIndice(ALM.jornadas, 'proyectoId', proyectoId)).filter(vivo).sort((a, b) => String(b.fechaInicio || '').localeCompare(String(a.fechaInicio || '')));
}

/** Resumen para la ficha del proyecto. */
export async function resumenDeProyecto(proyectoId) {
  const [monos, jornadas] = await Promise.all([monografiasDeProyecto(proyectoId), jornadasDeProyecto(proyectoId)]);
  const por = {};
  for (const m of monos) por[m.estado] = (por[m.estado] || 0) + 1;
  return { total: monos.length, porEstado: por, jornadas };
}

export { infoArchivo };
export const todasLasMonografias = async () => (await todos(ALM.mono)).filter(vivo);
