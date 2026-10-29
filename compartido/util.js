// compartido/util.js — utilidades comunes a todos los módulos (igual en cada módulo).

export function uuid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  // Respaldo para navegadores antiguos
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const CLAVE_DISPOSITIVO = 'topoland_dispositivoId';
let dispositivoEnMemoria = null;

export function dispositivoId() {
  if (dispositivoEnMemoria) return dispositivoEnMemoria;
  try {
    let id = localStorage.getItem(CLAVE_DISPOSITIVO);
    if (!id) { id = uuid(); localStorage.setItem(CLAVE_DISPOSITIVO, id); }
    dispositivoEnMemoria = id;
  } catch (e) {
    dispositivoEnMemoria = uuid();
  }
  return dispositivoEnMemoria;
}

export function ahoraISO() { return new Date().toISOString(); }

/** Fecha local de hoy en formato aaaa-mm-dd */
export function hoyISO(fecha = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
}

/**
 * Sella un registro con los campos comunes de trazabilidad.
 * creadoEn solo se pone la primera vez; el resto se actualiza siempre.
 */
export function sellar(registro, { personaId = null, schemaVersion = 1 } = {}) {
  const ahora = ahoraISO();
  if (!registro.id) registro.id = uuid();
  if (!registro.creadoEn) registro.creadoEn = ahora;
  if (!registro.creadoPor) registro.creadoPor = personaId;
  registro.actualizadoEn = ahora;
  registro.dispositivoId = dispositivoId();
  registro.modificadoPor = personaId;
  registro.schemaVersion = schemaVersion;
  return registro;
}

/** Suma meses a una fecha aaaa-mm-dd y devuelve aaaa-mm-dd */
export function sumarMeses(fechaISO, meses) {
  if (!fechaISO) return null;
  const [a, m, d] = fechaISO.split('-').map(Number);
  const f = new Date(a, m - 1 + Number(meses), d);
  // Si el día no existe en el mes destino (31 → 30), JS se pasa al mes siguiente; se corrige al último día.
  if (f.getDate() !== d) f.setDate(0);
  return hoyISO(f);
}

/** Días desde a hasta b (fechas aaaa-mm-dd). Positivo si b es posterior. */
export function diasEntre(aISO, bISO) {
  const a = new Date(aISO + 'T12:00:00');
  const b = new Date(bISO + 'T12:00:00');
  return Math.round((b - a) / 86400000);
}

/** aaaa-mm-dd → dd-mm-aaaa (como se escribe en Chile) */
export function fechaLegible(fechaISO) {
  if (!fechaISO) return '—';
  const [a, m, d] = fechaISO.slice(0, 10).split('-');
  return `${d}-${m}-${a}`;
}

export function fechaHoraLegible(iso) {
  if (!iso) return '—';
  const f = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${p(f.getDate())}-${p(f.getMonth() + 1)}-${f.getFullYear()} ${p(f.getHours())}:${p(f.getMinutes())}`;
}

/** Quita tildes, pasa a mayúsculas y deja solo letras/números/espacios. Útil para comparar encabezados. */
export function normalizarTexto(t) {
  return String(t ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function escapar(t) {
  return String(t ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function descargar(nombre, contenido, tipo = 'application/json') {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Carga un script externo una sola vez (por ejemplo, SheetJS para leer Excel). */
const scriptsCargados = new Map();
export function cargarScript(url) {
  if (scriptsCargados.has(url)) return scriptsCargados.get(url);
  const p = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url; s.onload = res;
    s.onerror = () => { scriptsCargados.delete(url); rej(new Error('No se pudo cargar ' + url)); };
    document.head.appendChild(s);
  });
  scriptsCargados.set(url, p);
  return p;
}
