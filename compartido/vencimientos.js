// compartido/vencimientos.js — motor único de vencimientos (Sistema v0.15).
// Todo lo que vence en la empresa se evalúa aquí con los mismos estados, colores y plazo de aviso:
// documentos del personal y de los vehículos, contratos a plazo fijo, EPP, acreditaciones, calibraciones y permisos.
// Funciones puras (sin base de datos ni pantalla): se prueban en pruebas/vencimientos.test.mjs.

export const DIAS_AVISO = 30;

/** Estados posibles, de peor a mejor. «color» usa las clases de .sis-chip. */
export const ESTADOS_VENC = {
  falta: { texto: 'Falta', color: 'rojo', orden: 0 },
  vencido: { texto: 'Vencido', color: 'rojo', orden: 1 },
  rechazado: { texto: 'Rechazado', color: 'rojo', orden: 2 },
  pendiente: { texto: 'Pendiente', color: 'ambar', orden: 3 },
  por_vencer: { texto: 'Por vencer', color: 'ambar', orden: 4 },
  vigente: { texto: 'Vigente', color: 'verde', orden: 5 },
  no_vence: { texto: 'Sin vencimiento', color: 'verde', orden: 6 },
  opcional: { texto: 'Opcional', color: 'gris', orden: 7 },
};

const aDia = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
/** Días desde hoy hasta la fecha (negativo si ya pasó). */
export const diasHasta = (fechaISO, hoyISO) => Math.round((aDia(fechaISO) - aDia(hoyISO)) / 86400000);

/**
 * Estado de una fecha de vencimiento.
 * fecha vacía → 'falta' si el dato es necesario, 'no_vence' si el documento no vence.
 */
export function estadoFecha(fechaISO, { hoy, diasAviso = DIAS_AVISO, vence = true } = {}) {
  if (!vence) return { estado: 'no_vence', dias: null };
  if (!fechaISO) return { estado: 'falta', dias: null };
  const dias = diasHasta(fechaISO, hoy);
  if (dias < 0) return { estado: 'vencido', dias };
  if (dias <= diasAviso) return { estado: 'por_vencer', dias };
  return { estado: 'vigente', dias };
}

/**
 * Estado de un documento según su tipo.
 * tipo: { vence, obligatorio }. doc: { vence, archivoId?, sinArchivo? } o null.
 * estadoPlataforma (opcional): 'aprobado' | 'borrador' | 'rechazado' (plataforma del mandante, p. ej. SUCAL).
 * Devuelve { estado, dias, cuenta } — cuenta = false si el documento no es requisito (opcional sin cargar).
 */
export function estadoDocumento(tipo, doc, { hoy, diasAviso = DIAS_AVISO, obligatorio = tipo && tipo.obligatorio, estadoPlataforma = null } = {}) {
  if (!doc) return obligatorio ? { estado: 'falta', dias: null, cuenta: true } : { estado: 'opcional', dias: null, cuenta: false };
  const f = estadoFecha(doc.vence, { hoy, diasAviso, vence: !!(tipo && tipo.vence) });
  if (estadoPlataforma === 'rechazado') return { estado: 'rechazado', dias: f.dias, cuenta: true };
  if (f.estado === 'vencido' || f.estado === 'falta') return { ...f, cuenta: true };
  if (estadoPlataforma === 'borrador') return { estado: 'pendiente', dias: f.dias, cuenta: !!obligatorio };
  return { ...f, cuenta: !!obligatorio };
}

/** Un estado «impide» la habilitación si es falta, vencido, rechazado o pendiente (borrador) en un requisito. */
export const impide = e => e.cuenta !== false && ['falta', 'vencido', 'rechazado', 'pendiente'].includes(e.estado);
export const avisa = e => e.estado === 'por_vencer';

/**
 * Habilitación de una persona o vehículo frente a una lista de requisitos.
 * requisitos: [tipo] (cada tipo con id, nombre, vence, obligatorio). docs: [{ tipoId, vence, estadoMandante? }].
 * mandanteId: si viene, se toma el estado en la plataforma de ese mandante.
 * → { habilitado, nivel: 'ok'|'aviso'|'no', pendientes: [{tipo, e}], avisos: [{tipo, e}], filas: [{tipo, doc, e}] }
 */
export function habilitacion(requisitos, docs, { hoy, diasAviso = DIAS_AVISO, mandanteId = null, todosObligatorios = false } = {}) {
  const filas = requisitos.map(tipo => {
    const doc = ultimoDoc(docs, tipo.id);
    const plat = mandanteId && doc && doc.estadoMandante ? doc.estadoMandante[mandanteId] || null : null;
    const e = estadoDocumento(tipo, doc, { hoy, diasAviso, obligatorio: todosObligatorios || tipo.obligatorio, estadoPlataforma: plat });
    return { tipo, doc, e, plataforma: plat };
  });
  const pendientes = filas.filter(f => impide(f.e));
  const avisos = filas.filter(f => !impide(f.e) && avisa(f.e));
  return { habilitado: !pendientes.length, nivel: pendientes.length ? 'no' : avisos.length ? 'aviso' : 'ok', pendientes, avisos, filas };
}

/** El documento vigente de un tipo: el de vencimiento más lejano (o el último cargado si no vence). */
export function ultimoDoc(docs, tipoId) {
  const delTipo = docs.filter(d => d.tipoId === tipoId && !d.eliminadoEn);
  if (!delTipo.length) return null;
  return delTipo.slice().sort((a, b) => String(b.vence || '9999').localeCompare(String(a.vence || '9999')) || String(b.creadoEn || '').localeCompare(String(a.creadoEn || '')))[0];
}

/** Texto corto para una fila: «vence en 12 días», «vencido hace 3 días», «sin fecha». */
export function textoDias(e) {
  if (e.dias == null) return ESTADOS_VENC[e.estado] ? ESTADOS_VENC[e.estado].texto : '';
  if (e.dias < 0) return `vencido hace ${-e.dias} día${e.dias === -1 ? '' : 's'}`;
  if (e.dias === 0) return 'vence hoy';
  return `vence en ${e.dias} día${e.dias === 1 ? '' : 's'}`;
}

/** Ordena pendientes: primero lo más grave y, a igual gravedad, lo más cercano. */
export function ordenarPendientes(lista) {
  const peso = { rojo: 0, ambar: 1, gris: 2 };
  return lista.slice().sort((a, b) => (peso[a.nivel] ?? 3) - (peso[b.nivel] ?? 3) || String(a.fecha || '9999').localeCompare(String(b.fecha || '9999')));
}
