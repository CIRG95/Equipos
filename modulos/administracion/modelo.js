// modulos/administracion/modelo.js — reglas puras de Administración (Sistema v0.15): catálogos de base, habilitación
// de personas y vehículos, acreditación por mandante, licitaciones, contratos, EPP, pendientes y calendario.
// Sin base de datos ni pantalla: se prueba en pruebas/administracion.test.mjs.

import { habilitacion, estadoFecha, estadoDocumento, textoDias, ultimoDoc, DIAS_AVISO } from '../../compartido/vencimientos.js';

// ───────── Catálogos de base (ids fijos: si dos equipos los crean a la vez, no se duplican) ─────────
export const TIPOS_BASE = [
  { id: 'per-cedula', aplica: 'persona', nombre: 'Cédula de identidad', vence: true, obligatorio: true, orden: 1 },
  { id: 'per-contrato', aplica: 'persona', nombre: 'Contrato de trabajo y anexos', vence: false, obligatorio: true, orden: 2 },
  { id: 'per-titulo', aplica: 'persona', nombre: 'Título profesional o técnico', vence: false, obligatorio: false, orden: 3 },
  { id: 'per-licencia', aplica: 'persona', nombre: 'Licencia de conducir', vence: true, obligatorio: false, orden: 4 },
  { id: 'per-altura', aplica: 'persona', nombre: 'Examen de altura física', vence: true, obligatorio: false, orden: 5 },
  { id: 'per-ocupacional', aplica: 'persona', nombre: 'Examen ocupacional', vence: true, obligatorio: false, orden: 6 },
  { id: 'per-rpas', aplica: 'persona', nombre: 'Credencial de operador RPAS (DGAC)', vence: true, obligatorio: false, orden: 7 },
  { id: 'per-manejo', aplica: 'persona', nombre: 'Curso de manejo defensivo', vence: true, obligatorio: false, orden: 8 },
  { id: 'per-induccion', aplica: 'persona', nombre: 'Inducción de faena', vence: true, obligatorio: false, orden: 9 },
  // Vehículos: los 8 documentos que pide SUCAL para habilitar camionetas en Codelco (captura de Camilo, 13-nov-2026).
  { id: 'veh-revision', aplica: 'vehiculo', nombre: 'Copia del certificado de revisión técnica o certificado de homologación', vence: true, obligatorio: true, orden: 1 },
  { id: 'veh-permiso', aplica: 'vehiculo', nombre: 'Copia del permiso de circulación vigente', vence: true, obligatorio: true, orden: 2 },
  { id: 'veh-seguro', aplica: 'vehiculo', nombre: 'Seguro obligatorio', vence: true, obligatorio: true, orden: 3 },
  { id: 'veh-barras', aplica: 'vehiculo', nombre: 'Certificado de barras antivuelco o certificado de homologación de barras', vence: false, obligatorio: false, orden: 4 },
  { id: 'veh-mantencion', aplica: 'vehiculo', nombre: 'Certificado de mantención', vence: false, obligatorio: true, orden: 5 },
  { id: 'veh-malla', aplica: 'vehiculo', nombre: 'Certificado de malla o sistema de defensa externa', vence: false, obligatorio: false, orden: 6 },
  { id: 'veh-gps', aplica: 'vehiculo', nombre: 'Certificado de instalación de GPS', vence: false, obligatorio: true, orden: 7 },
  { id: 'veh-cunas', aplica: 'vehiculo', nombre: 'Certificado de cuñas', vence: false, obligatorio: true, orden: 8 },
];

export const MANDANTES_BASE = [
  {
    id: 'man-codelco', nombre: 'Codelco', plataforma: 'SUCAL', alias: ['codelco', 'radomiro tomic', 'andina', 'el teniente', 'chuquicamata', 'ministro hales', 'salvador'],
    requisitosVehiculo: TIPOS_BASE.filter(t => t.aplica === 'vehiculo').map(t => ({ tipoId: t.id, obligatorio: t.obligatorio })),
    requisitosPersona: [],
    notas: 'Requisitos de vehículos según SUCAL. Los requisitos de personas se completan con la lista que pida la plataforma.',
  },
];

export const CONFIG_BASE = {
  diasAviso: DIAS_AVISO,
  tablaTiempos: [], // [{ hastaKm, minutos }] — tabla de tiempos de ocupación GNSS por distancia (Manual de Carreteras, Vol. 2)
  tarifas: { diaPersona: '', diaEquipo: '', diaGabinete: '' },
};

export const TURNOS = [['5x2', '5×2 (lunes a viernes)'], ['4x3', '4×3'], ['7x7', '7×7'], ['10x10', '10×10'], ['14x14', '14×14'], ['otro', 'Otro']];
export const TIPOS_CONTRATO = [['indefinido', 'Indefinido'], ['plazo_fijo', 'Plazo fijo'], ['obra', 'Por obra o faena'], ['honorarios', 'Honorarios']];
export const TIPOS_AUSENCIA = [['vacaciones', 'Vacaciones'], ['permiso', 'Permiso'], ['otro', 'Otro']];
export const ESTADOS_PLATAFORMA = [['aprobado', 'Aprobado', 'verde'], ['borrador', 'Borrador', 'ambar'], ['rechazado', 'Rechazado', 'rojo']];
export const ESTADOS_COTIZACION = [['preparacion', 'En preparación', 'gris'], ['enviada', 'Enviada', 'azul'], ['ganada', 'Ganada', 'verde'], ['perdida', 'Perdida', 'rojo']];
export const ESTADOS_GUIA = [['borrador', 'Borrador', 'gris'], ['solicitada', 'Solicitada', 'ambar'], ['emitida', 'Emitida', 'verde']];
export const ESTADOS_VIAJE = [['pendiente', 'Pendiente', 'ambar'], ['reservado', 'Reservado', 'verde'], ['realizado', 'Realizado', 'gris']];
export const TIPOS_BIBLIOTECA = [['plantilla', 'Plantilla oficial'], ['norma', 'Norma'], ['mandante', 'Especificación del mandante'], ['interno', 'Procedimiento interno'], ['equipo', 'Manual de equipo']];
export const RIESGOS_BASE = [
  ['taludes', 'Taludes y bermas', 'Mantener distancia del borde y usar chaleco reflectante.'],
  ['calor', 'Calor y radiación UV', 'Hidratación, bloqueador y pausas periódicas.'],
  ['viento', 'Viento fuerte', 'Suspender el vuelo y asegurar trípodes y bastones.'],
  ['transito', 'Tránsito de vehículos y camiones de faena', 'Contacto radial con el despacho y uso de baliza.'],
  ['ruido', 'Ruido de equipos', 'Protección auditiva.'],
  ['altura', 'Trabajo en altura', 'Arnés con línea de vida y examen de altura vigente.'],
  ['electrico', 'Cercanía a líneas eléctricas', 'Mantener distancia de seguridad y no levantar bastones bajo tendidos.'],
];
const nombreDe = lista => Object.fromEntries(lista.map(([k, t]) => [k, t]));
export const NOMBRE_TURNO = nombreDe(TURNOS);
export const NOMBRE_CONTRATO = nombreDe(TIPOS_CONTRATO);
export const NOMBRE_AUSENCIA = nombreDe(TIPOS_AUSENCIA);
export const NOMBRE_BIBLIOTECA = nombreDe(TIPOS_BIBLIOTECA);

// ───────── Utilidades ─────────
const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const tiposDe = (tipos, aplica) => tipos.filter(t => t.aplica === aplica).sort((a, b) => (a.orden || 99) - (b.orden || 99) || a.nombre.localeCompare(b.nombre, 'es'));
export const docsDe = (documentos, duenoTipo, duenoId) => documentos.filter(d => d.duenoTipo === duenoTipo && d.duenoId === duenoId);

/** Mandante de un proyecto: por mandanteId o, si no, por el nombre escrito (Codelco RT → Codelco). */
export function mandanteDeProyecto(p, mandantes) {
  if (!p) return null;
  if (p.mandanteId) { const m = mandantes.find(x => x.id === p.mandanteId); if (m) return m; }
  const t = norm(p.mandante);
  if (!t) return null;
  return mandantes.find(m => norm(m.nombre) === t) || mandantes.find(m => t.includes(norm(m.nombre)) || (m.alias || []).some(a => t.includes(norm(a)))) || null;
}

// ───────── Habilitación ─────────

/** Habilitación general de una persona: documentos obligatorios del catálogo. */
export function habilitacionPersona(personaId, { tipos, documentos, hoy, diasAviso = DIAS_AVISO }) {
  return habilitacion(tiposDe(tipos, 'persona').filter(t => t.obligatorio), docsDe(documentos, 'persona', personaId), { hoy, diasAviso });
}

/** Acreditación de una persona o vehículo ante un mandante (sus requisitos, con la obligatoriedad que fija el mandante). */
export function acreditacion(mandante, duenoTipo, duenoId, { tipos, documentos, hoy, diasAviso = DIAS_AVISO }) {
  const lista = (duenoTipo === 'vehiculo' ? mandante.requisitosVehiculo : mandante.requisitosPersona) || [];
  const reqs = lista.map(r => { const t = tipos.find(x => x.id === r.tipoId); return t ? { ...t, obligatorio: r.obligatorio !== false } : null; }).filter(Boolean);
  return habilitacion(reqs, docsDe(documentos, duenoTipo, duenoId), { hoy, diasAviso, mandanteId: mandante.id });
}

/** Todos los documentos de una persona o vehículo (catálogo completo) con su estado, para la ficha. */
export function estadoDocumentos(duenoTipo, duenoId, { tipos, documentos, hoy, diasAviso = DIAS_AVISO }) {
  const docs = docsDe(documentos, duenoTipo, duenoId);
  return tiposDe(tipos, duenoTipo).map(tipo => {
    const doc = ultimoDoc(docs, tipo.id);
    return { tipo, doc, e: estadoDocumento(tipo, doc, { hoy, diasAviso }), historial: docs.filter(d => d.tipoId === tipo.id).length };
  });
}

// ───────── Contrato, EPP y ausencias ─────────
export function avisoContrato(ficha, { hoy, diasAviso = DIAS_AVISO }) {
  const c = ficha && ficha.contrato;
  if (!c || !['plazo_fijo', 'obra'].includes(c.tipo) || !c.termino) return null;
  const e = estadoFecha(c.termino, { hoy, diasAviso });
  return e.estado === 'vigente' ? null : { ...e, termino: c.termino };
}

export function eppPorReponer(ficha, { hoy, diasAviso = DIAS_AVISO }) {
  return ((ficha && ficha.epp) || []).map(x => ({ ...x, e: x.reponer ? estadoFecha(x.reponer, { hoy, diasAviso }) : { estado: 'no_vence', dias: null } }))
    .filter(x => ['vencido', 'por_vencer'].includes(x.e.estado));
}

/** ¿La persona está ausente (vacaciones aprobadas) en esa fecha? */
export const ausenteEn = (ausencias, personaId, fecha) => ausencias.some(a => a.personaId === personaId && a.estado === 'aprobada' && a.desde <= fecha && fecha <= (a.hasta || a.desde));

// ───────── Licitaciones ─────────
/**
 * Cumplimiento de cada persona con los documentos exigidos por la licitación.
 * → [{ personaId, celdas: [{ tipo, doc, e }], faltan, avisos, cumple, nivel }]
 */
export function cumplimientoLicitacion(tipoIds, personas, { tipos, documentos, hoy, diasAviso = DIAS_AVISO }) {
  const reqs = tipoIds.map(id => tipos.find(t => t.id === id)).filter(Boolean);
  return personas.map(p => {
    const h = habilitacion(reqs, docsDe(documentos, 'persona', p.id), { hoy, diasAviso, todosObligatorios: true });
    return { personaId: p.id, persona: p, celdas: h.filas, faltan: h.pendientes.length, avisos: h.avisos.length, cumple: h.habilitado, nivel: h.nivel };
  });
}

/** Nombre del archivo dentro del zip: «02_Titulo_profesional.pdf» (orden de la licitación + nombre del documento). */
export function nombreEnPaquete(k, tipo, archivo) {
  const ext = (archivo && archivo.nombre && archivo.nombre.includes('.')) ? archivo.nombre.slice(archivo.nombre.lastIndexOf('.')) : (archivo && archivo.mime === 'application/pdf' ? '.pdf' : '.jpg');
  return `${String(k + 1).padStart(2, '0')}_${tipo.nombre}${ext}`;
}

// ───────── Pendientes (para «Mis pendientes» del Inicio) ─────────
/**
 * Lo que vence o falta en Administración, según el rol.
 * rrhh: documentos del personal y de la flota, contratos, EPP, guías en borrador.
 * terreno: solo la habilitación (sí/no) de las personas de sus proyectos y la acreditación de sus vehículos, sin detalle de documentos.
 * → [{ nivel: 'rojo'|'ambar', titulo, detalle, enlace, fecha, categoria }]
 */
export function pendientesAdmin({ rol, personaId, d, personas, proyectos, hoy }) {
  const dias = d.config.diasAviso || DIAS_AVISO;
  const out = [];
  const nomProy = id => (proyectos.find(p => p.id === id) || {}).nombre || 'proyecto';
  if (rol === 'rrhh') {
    for (const p of personas) {
      for (const f of estadoDocumentos('persona', p.id, { ...d, hoy, diasAviso: dias })) {
        if (!f.doc && !f.tipo.obligatorio) continue;
        if (['falta', 'vencido', 'por_vencer'].includes(f.e.estado)) {
          out.push({ nivel: f.e.estado === 'por_vencer' ? 'ambar' : 'rojo', etiqueta: etiquetaDe(f.e), categoria: 'Personal', titulo: `${f.tipo.nombre} · ${p.nombre}`, detalle: f.e.estado === 'falta' ? 'Documento obligatorio sin cargar.' : `${textoDias(f.e)[0].toUpperCase()}${textoDias(f.e).slice(1)} (${fechaCorta(f.doc.vence)}).`, enlace: `#/personal/${p.id}`, fecha: f.doc && f.doc.vence });
        }
      }
      const fi = d.fichas.find(x => x.id === p.id);
      const c = avisoContrato(fi, { hoy, diasAviso: dias });
      if (c) out.push({ nivel: c.estado === 'vencido' ? 'rojo' : 'ambar', etiqueta: etiquetaDe(c), categoria: 'Personal', titulo: `Término de contrato · ${p.nombre}`, detalle: `Contrato ${NOMBRE_CONTRATO[fi.contrato.tipo].toLowerCase()}: ${textoDias(c)} (${fechaCorta(c.termino)}).`, enlace: `#/personal/${p.id}/contrato`, fecha: c.termino });
      for (const x of eppPorReponer(fi, { hoy, diasAviso: dias })) out.push({ nivel: x.e.estado === 'vencido' ? 'rojo' : 'ambar', etiqueta: etiquetaDe(x.e), categoria: 'Personal', titulo: `Reposición de EPP · ${p.nombre}`, detalle: `${x.item}: ${textoDias(x.e)}.`, enlace: `#/personal/${p.id}/epp`, fecha: x.reponer });
    }
    for (const v of d.vehiculos) {
      for (const f of estadoDocumentos('vehiculo', v.id, { ...d, hoy, diasAviso: dias })) {
        if (!f.doc && !f.tipo.obligatorio) continue;
        if (['falta', 'vencido', 'por_vencer'].includes(f.e.estado)) out.push({ nivel: f.e.estado === 'por_vencer' ? 'ambar' : 'rojo', etiqueta: etiquetaDe(f.e), categoria: 'Vehículos', titulo: `${f.tipo.nombre} · ${v.patente}`, detalle: f.e.estado === 'falta' ? 'Documento obligatorio sin cargar.' : `${textoDias(f.e)[0].toUpperCase()}${textoDias(f.e).slice(1)}.`, enlace: `#/administracion/vehiculo/${v.id}`, fecha: f.doc && f.doc.vence });
      }
    }
    for (const g of d.guias.filter(x => x.estado === 'borrador')) out.push({ nivel: 'ambar', etiqueta: 'Borrador', categoria: 'Guías', titulo: `Guía de despacho por solicitar · ${nomProy(g.proyectoId)}`, detalle: `${(g.equipoIds || []).length} equipos en el borrador.`, enlace: '#/administracion/guias', fecha: g.fecha });
  }
  if (rol === 'terreno' && personaId) {
    const mios = proyectos.filter(p => p.encargadoId === personaId && p.estado !== 'cerrado');
    for (const p of mios) {
      const man = mandanteDeProyecto(p, d.mandantes);
      for (const pid of p.cuadrilla || []) {
        const per = personas.find(x => x.id === pid);
        if (!per) continue;
        const h = man && (man.requisitosPersona || []).length ? acreditacion(man, 'persona', pid, { ...d, hoy, diasAviso: dias }) : habilitacionPersona(pid, { ...d, hoy, diasAviso: dias });
        if (h.nivel !== 'ok') out.push({ nivel: h.nivel === 'no' ? 'rojo' : 'ambar', etiqueta: h.nivel === 'no' ? 'No habilitado' : 'Por vencer', categoria: 'Cuadrilla', titulo: `${per.nombre} · ${h.nivel === 'no' ? 'no habilitado' : 'habilitación por vencer'}`, detalle: `${p.nombre}${man ? ` · ${man.nombre}` : ''}. Recursos Humanos ve el detalle.`, enlace: `#/proyecto/${p.id}`, fecha: null });
      }
      for (const vid of p.vehiculoIds || []) {
        const v = d.vehiculos.find(x => x.id === vid);
        if (!v || !man) continue;
        const h = acreditacion(man, 'vehiculo', vid, { ...d, hoy, diasAviso: dias });
        if (h.nivel !== 'ok') out.push({ nivel: h.nivel === 'no' ? 'rojo' : 'ambar', etiqueta: h.nivel === 'no' ? 'No acreditada' : 'Por vencer', categoria: 'Vehículos', titulo: `Camioneta ${v.patente} · ${h.nivel === 'no' ? `no acreditada en ${man.plataforma || man.nombre}` : 'documentos por vencer'}`, detalle: `${p.nombre}. ${h.pendientes.length ? `${h.pendientes.length} requisito${h.pendientes.length > 1 ? 's' : ''} pendiente${h.pendientes.length > 1 ? 's' : ''}.` : ''}`, enlace: `#/proyecto/${p.id}`, fecha: null });
      }
    }
  }
  if (rol === 'direccion') {
    for (const c of d.cotizaciones.filter(x => x.estado === 'enviada' && x.fecha)) {
      const e = estadoFecha(c.fecha, { hoy });
      if (e.dias != null && e.dias <= -30) out.push({ nivel: 'ambar', etiqueta: 'Sin respuesta', categoria: 'Comercial', titulo: `Cotización sin respuesta · ${c.nombre}`, detalle: `Enviada hace ${-e.dias} días a ${c.mandante || 'mandante'}.`, enlace: '#/comercial/cotizaciones', fecha: c.fecha });
    }
  }
  return out;
}

const etiquetaDe = e => (e.estado === 'falta' ? 'Falta' : e.estado === 'vencido' ? 'Vencido' : e.dias === 0 ? 'Hoy' : `En ${e.dias} día${e.dias === 1 ? '' : 's'}`);
const fechaCorta = iso => { if (!iso) return '—'; const [a, m, dd] = String(iso).slice(0, 10).split('-'); return `${dd}-${m}-${a}`; };

// ───────── Calendario ─────────
/** Eventos para el calendario único: vencimientos de documentos, ausencias y fin de contratos. */
export function eventosAdmin({ d, personas, desde, hasta, rol }) {
  const ev = [];
  const poner = (fecha, e) => { if (fecha && fecha >= desde && fecha <= hasta) ev.push({ fecha, ...e }); };
  const nomPer = id => (personas.find(p => p.id === id) || {}).nombre || 'Persona';
  for (const a of d.ausencias.filter(x => x.estado !== 'rechazada')) {
    const fin = a.hasta || a.desde;
    for (let f = a.desde; f && f <= fin; f = sumarDia(f)) poner(f, { tipo: 'ausencia', texto: `${nomPer(a.personaId)} · ${NOMBRE_AUSENCIA[a.tipo] || 'Ausencia'}${a.estado === 'solicitada' ? ' (por aprobar)' : ''}`, corto: `${nomPer(a.personaId).split(' ')[0]} · ${NOMBRE_AUSENCIA[a.tipo] || 'Ausencia'}`, enlace: rol === 'rrhh' ? `#/personal/${a.personaId}/vacaciones` : '#/proyectos/calendario', personaId: a.personaId });
  }
  if (rol === 'rrhh') {
    for (const doc of d.documentos) {
      if (!doc.vence) continue;
      const t = d.tipos.find(x => x.id === doc.tipoId);
      if (!t || !t.vence) continue;
      const dueno = doc.duenoTipo === 'persona' ? nomPer(doc.duenoId) : ((d.vehiculos.find(v => v.id === doc.duenoId) || {}).patente || 'Vehículo');
      poner(doc.vence, { tipo: 'vencimiento', texto: `Vence: ${t.nombre} · ${dueno}`, corto: `Vence ${t.nombre.split(' ').slice(0, 3).join(' ')} · ${dueno}`, enlace: doc.duenoTipo === 'persona' ? `#/personal/${doc.duenoId}` : `#/administracion/vehiculo/${doc.duenoId}` });
    }
    for (const f of d.fichas) if (f.contrato && f.contrato.termino && ['plazo_fijo', 'obra'].includes(f.contrato.tipo)) poner(f.contrato.termino, { tipo: 'vencimiento', texto: `Término de contrato · ${nomPer(f.id)}`, corto: `Fin contrato · ${nomPer(f.id)}`, enlace: `#/personal/${f.id}/contrato` });
  }
  return ev;
}
const sumarDia = iso => { const [y, m, dd] = iso.split('-').map(Number); const f = new Date(Date.UTC(y, m - 1, dd + 1)); return f.toISOString().slice(0, 10); };

// ───────── Comercial ─────────
/** Estimación base de una cotización: días-persona, días-equipo y días de gabinete × tarifas (si están definidas). */
export function estimar({ dias = 0, personas = 0, equipos = 0, gabinete = 0 }, tarifas = {}) {
  const dp = dias * personas, de = dias * equipos;
  const n = v => (v === '' || v == null || !isFinite(Number(v)) ? null : Number(v));
  const t = { p: n(tarifas.diaPersona), e: n(tarifas.diaEquipo), g: n(tarifas.diaGabinete) };
  const total = t.p != null && t.e != null && t.g != null ? dp * t.p + de * t.e + gabinete * t.g : null;
  return { diasPersona: dp, diasEquipo: de, diasGabinete: gabinete, total };
}

/** Resumen de cotizaciones: cantidad por estado y tasa de adjudicación (ganadas / resueltas). */
export function resumenCotizaciones(cotizaciones) {
  const por = Object.fromEntries(ESTADOS_COTIZACION.map(([k]) => [k, cotizaciones.filter(c => c.estado === k)]));
  const resueltas = por.ganada.length + por.perdida.length;
  const motivos = {};
  for (const c of por.perdida) { const m = (c.motivo || 'Sin motivo').trim(); motivos[m] = (motivos[m] || 0) + 1; }
  return { por, tasa: resueltas ? Math.round(100 * por.ganada.length / resueltas) : null, motivos };
}
