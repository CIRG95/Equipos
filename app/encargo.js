// app/encargo.js — reglas puras del encargo de un proyecto (Sistema v0.16). Sin base de datos ni pantalla:
// se prueban en pruebas/encargo.test.mjs.
//
// El encargo vive dentro del registro del proyecto (compartido_proyectos), sin almacenes nuevos:
//   p.cronograma = [{ id, nombre, desde, hasta, responsableId, hecho }]
//   p.encargo    = { info: { <clave>: 'si' | 'na' | 'pend' }, emitidoPor, emitidoEn, recibidoPor, recibidoEn, prioridad }
//   p.bitacora   = [{ id, tipo: 'consulta' | 'instruccion' | 'llamada' | 'acuerdo', texto, por, en,
//                     respuesta, respondidoPor, respondidoEn, confirmadoPor, confirmadoEn }]

import { dia, isoDe, esFecha, resumenCronograma, barraActividad, rangoProyecto, seCruzan, genteDeProyecto } from '../compartido/cronograma.js';

export { resumenCronograma, barraActividad, rangoProyecto, seCruzan, genteDeProyecto };

/** Información que debe acompañar a un encargo: [clave, nombre, para qué sirve]. */
export const INFO_ENCARGO = [
  ['area', 'Área de trabajo (KMZ, KML o plano)', 'Sin el área no es posible planificar vuelos, redes ni accesos.'],
  ['bases', 'Bases técnicas o alcance por escrito', 'Especificaciones del mandante, términos de referencia o correo con lo solicitado.'],
  ['contacto', 'Contacto en terreno', 'Nombre y teléfono de quien recibe a la cuadrilla.'],
  ['accesos', 'Accesos y permisos de ingreso', 'Acreditación, pases, horarios y restricciones del recinto.'],
  ['referencia', 'Sistema de referencia y puntos existentes', 'Datum, huso y monografías o PR entregados por el mandante.'],
  ['seguridad', 'Requisitos de seguridad del mandante', 'Inducciones, exámenes y elementos de protección exigidos.'],
];
export const NOMBRE_INFO = Object.fromEntries(INFO_ENCARGO.map(([k, t]) => [k, t]));

export const TIPOS_BITACORA = {
  consulta: { texto: 'Consulta', color: 'ambar', pide: 'respuesta' },
  instruccion: { texto: 'Instrucción', color: 'azul', pide: null },
  llamada: { texto: 'Instrucción recibida por teléfono', color: 'ambar', pide: 'confirmacion' },
  acuerdo: { texto: 'Acuerdo', color: 'verde', pide: null },
};


/**
 * Calidad del encargo: qué tiene y qué falta para que el encargado pueda trabajar sin llamar a pedir información.
 * → { puntos, total, pct, items: [{ k, texto, ok, falta }], faltan: [texto] }
 */
export function calidadEncargo(p = {}) {
  const info = (p.encargo && p.encargo.info) || {};
  const items = [
    { k: 'nombre', texto: 'Nombre del proyecto', ok: !!String(p.nombre || '').trim() },
    { k: 'mandante', texto: 'Mandante', ok: !!(p.mandanteId || String(p.mandante || '').trim()) },
    { k: 'tipos', texto: 'Tipo de trabajo', ok: (p.tiposTrabajo || []).length > 0 },
    { k: 'ubicacion', texto: 'Ubicación (comuna o región)', ok: !!(p.comuna || p.region) },
    { k: 'alcance', texto: 'Alcance del trabajo', ok: String(p.alcance || '').trim().length >= 15 },
    { k: 'entregables', texto: 'Entregables solicitados', ok: !!String(p.entregablesPedidos || '').trim() },
    { k: 'plazo', texto: 'Plazo de entrega', ok: esFecha(p.plazo) || !!(p.periodicidad && p.periodicidad.tipo === 'recurrente') },
    { k: 'cronograma', texto: 'Cronograma estimado', ok: (p.cronograma || []).some(a => a.nombre && esFecha(a.desde) && esFecha(a.hasta)) },
    { k: 'encargado', texto: 'Encargado asignado', ok: !!p.encargadoId },
    { k: 'cuadrilla', texto: 'Equipo de trabajo', ok: (p.cuadrilla || []).length > 0 },
    ...INFO_ENCARGO.map(([k, texto]) => ({ k: `info:${k}`, texto, ok: info[k] === 'si' || info[k] === 'na', pendiente: info[k] === 'pend' })),
  ];
  const puntos = items.filter(x => x.ok).length;
  return { puntos, total: items.length, pct: Math.round(100 * puntos / items.length), items, faltan: items.filter(x => !x.ok).map(x => x.texto) };
}

/** Información del encargo marcada como «pendiente de entregar» (la debe quien encargó). */
export function infoPendiente(p = {}) {
  const info = (p.encargo && p.encargo.info) || {};
  return INFO_ENCARGO.filter(([k]) => info[k] === 'pend' || info[k] == null).map(([k, texto]) => ({ k, texto, declarada: info[k] === 'pend' }));
}

/** Actividades tipo según las categorías de trabajo: [nombre, peso relativo de duración]. */
const BASE_CRONO = {
  dron: [['Permisos de vuelo y planificación', 2], ['Vuelos en terreno', 3], ['Procesamiento fotogramétrico o LiDAR', 4]],
  gnss: [['Planificación de la red y monografías previas', 1], ['Medición GNSS en terreno', 3], ['Cálculo y ajuste', 2]],
  nivelacion: [['Nivelación en terreno', 3], ['Cálculo y compensación', 1]],
  estacion: [['Levantamiento con estación total', 3], ['Dibujo y cálculo en gabinete', 3]],
  escaneo: [['Escaneo en terreno', 2], ['Registro y limpieza de nubes de puntos', 4]],
  batimetria: [['Batimetría en terreno', 2], ['Procesamiento batimétrico', 2]],
  otro: [['Trabajo en terreno', 3], ['Proceso en gabinete', 3]],
};

/**
 * Cronograma sugerido entre dos fechas (incluidas) según los tipos de trabajo.
 * Reparte los días en proporción al peso de cada actividad: preparación → terreno → gabinete → revisión → entrega.
 */
export function sugerirCronograma(tipos = [], desde, hasta) {
  if (!esFecha(desde) || !esFecha(hasta) || hasta < desde) return [];
  const cats = tipos.filter(t => BASE_CRONO[t]);
  const terreno = [], gabinete = [];
  for (const c of (cats.length ? cats : ['otro'])) {
    const lista = BASE_CRONO[c];
    lista.forEach(([n, w], i) => (i === lista.length - 1 && lista.length > 1 ? gabinete : terreno).push([n, w]));
  }
  const acts = [['Preparación: acreditación, equipos y traslado', 1], ...terreno, ...gabinete, ['Revisión interna', 1], ['Entrega al mandante', 1]];
  const d0 = dia(desde), total = dia(hasta) - d0 + 1;
  const peso = acts.reduce((s, [, w]) => s + w, 0);
  let acum = 0;
  return acts.map(([nombre, w], i) => {
    const ini = Math.min(total - 1, Math.floor(total * acum / peso));
    acum += w;
    const fin = i === acts.length - 1 ? total - 1 : Math.max(ini, Math.floor(total * acum / peso) - 1);
    return { id: `a${i + 1}`, nombre, desde: isoDe(d0 + ini), hasta: isoDe(d0 + Math.min(total - 1, fin)), responsableId: null, hecho: false };
  });
}

const abierto = p => p && p.id !== 'oficina' && p.estado !== 'cerrado' && !p.eliminadoEn;
export const sinAcuse = p => !!(p.encargo && p.encargo.emitidoEn && !p.encargo.recibidoEn && p.encargadoId && p.encargo.emitidoPor !== p.encargadoId);
export const entradasAbiertas = p => (p.bitacora || []).filter(b => (b.tipo === 'consulta' && !b.respuesta) || (b.tipo === 'llamada' && !b.confirmadoEn));

/**
 * Pendientes de encargos para «Mis pendientes», según quién mira.
 * Encargado: acusar recibo, actividades atrasadas. Quien encargó y Jefatura: consultas sin respuesta, instrucciones
 * telefónicas por confirmar, información que quedó pendiente de entregar y encargos sin acuse.
 */
export function pendientesEncargo({ rol, personaId, proyectos = [], hoy, nombre = () => '' }) {
  const out = [];
  for (const p of proyectos.filter(abierto)) {
    const enlace = `#/proyecto/${p.id}`;
    const mio = personaId && p.encargadoId === personaId;
    const loEncargue = personaId && p.encargo && p.encargo.emitidoPor === personaId;
    const jefatura = rol === 'direccion';
    if (mio && sinAcuse(p)) out.push({ nivel: 'rojo', etiqueta: 'Nuevo encargo', categoria: 'Proyectos', titulo: `Acusar recibo · ${p.nombre}`, detalle: `Encargado por ${nombre(p.encargo.emitidoPor) || 'Jefatura'}. Revise la información y confirme la recepción.`, enlace, fecha: String(p.encargo.emitidoEn).slice(0, 10) });
    if (mio) for (const a of resumenCronograma(p.cronograma, hoy).atrasadas) out.push({ nivel: 'ambar', etiqueta: 'Atrasada', categoria: 'Cronograma', titulo: `${a.nombre} · ${p.nombre}`, detalle: `Debía terminar el ${a.hasta.split('-').reverse().join('-')}. Marque la actividad como realizada o ajuste la fecha.`, enlace, fecha: a.hasta });
    if (loEncargue || jefatura) {
      if (sinAcuse(p)) out.push({ nivel: 'ambar', etiqueta: 'Sin acuse', categoria: 'Proyectos', titulo: `Encargo sin acuse de recibo · ${p.nombre}`, detalle: `${nombre(p.encargadoId) || 'El encargado'} aún no confirma la recepción.`, enlace, fecha: String(p.encargo.emitidoEn).slice(0, 10) });
      for (const b of entradasAbiertas(p)) out.push({ nivel: 'rojo', etiqueta: b.tipo === 'consulta' ? 'Responder' : 'Confirmar', categoria: 'Proyectos', titulo: `${b.tipo === 'consulta' ? 'Consulta sin respuesta' : 'Instrucción telefónica por confirmar'} · ${p.nombre}`, detalle: `${nombre(b.por) || 'Terreno'}: «${String(b.texto).slice(0, 110)}»`, enlace, fecha: String(b.en).slice(0, 10) });
      const pend = infoPendiente(p).filter(x => x.declarada);
      if (pend.length) out.push({ nivel: 'ambar', etiqueta: 'Entregar', categoria: 'Proyectos', titulo: `Información pendiente del encargo · ${p.nombre}`, detalle: pend.map(x => x.texto).join(' · '), enlace, fecha: String((p.encargo && p.encargo.emitidoEn) || '').slice(0, 10) || null });
    }
    if (mio && !loEncargue) for (const b of (p.bitacora || []).filter(x => x.tipo === 'instruccion' && x.por !== personaId && !(x.vistoPor || []).includes(personaId))) out.push({ nivel: 'ambar', etiqueta: 'Instrucción', categoria: 'Proyectos', titulo: `Nueva instrucción · ${p.nombre}`, detalle: `${nombre(b.por) || 'Jefatura'}: «${String(b.texto).slice(0, 110)}»`, enlace, fecha: String(b.en).slice(0, 10) });
  }
  return out;
}
