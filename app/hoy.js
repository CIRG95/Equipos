// app/hoy.js — v0.19 «uso simple»: lógica pura de la pantalla Hoy (sin DOM, con pruebas).
// · agruparPendientes: los pendientes se agrupan por tipo, cada grupo con un verbo («Renovar documentos»).
// · accionPrincipal: lo primero que hay que hacer hoy, en un botón grande; si no hay nada, la acción típica del rol.
// · semaforoProyecto: verde / ámbar / rojo por proyecto, con el motivo en palabras simples (tablero de Jefatura).

import { ordenarPendientes } from '../compartido/vencimientos.js';
import { sinAcuse, entradasAbiertas, resumenCronograma } from './encargo.js';

/** Verbo de cada tipo de pendiente: el grupo dice qué hay que hacer, no de qué módulo viene. */
export const VERBO = {
  Proyectos: 'Responder y confirmar',
  Cronograma: 'Ponerse al día',
  Entregas: 'Entregar',
  'Permisos DGAC': 'Pedir permisos de vuelo',
  Equipos: 'Calibrar equipos',
  Personal: 'Renovar documentos',
  Contratos: 'Revisar contratos que terminan',
  EPP: 'Reponer EPP',
  Ausencias: 'Aprobar vacaciones y permisos',
  Cuadrilla: 'Habilitar a la cuadrilla',
  Vehículos: 'Acreditar vehículos',
  Guías: 'Cerrar guías de despacho',
  Comercial: 'Seguir cotizaciones',
};
export const verboDe = categoria => VERBO[categoria] || categoria || 'Otros';

/**
 * Agrupa por tipo; los grupos con algo urgente van primero y, dentro, por cantidad de urgentes.
 * @returns {{categoria:string, verbo:string, items:object[], urgentes:number}[]}
 */
export function agruparPendientes(items = []) {
  const grupos = new Map();
  for (const x of ordenarPendientes(items)) {
    const k = x.categoria && x.categoria !== 'Otro' ? x.categoria : 'Otros';
    if (!grupos.has(k)) grupos.set(k, { categoria: k, verbo: verboDe(k), items: [], urgentes: 0 });
    const g = grupos.get(k);
    g.items.push(x);
    if (x.nivel === 'rojo') g.urgentes++;
  }
  return [...grupos.values()].sort((a, b) => (b.urgentes > 0) - (a.urgentes > 0) || b.urgentes - a.urgentes || b.items.length - a.items.length);
}

/** Acción típica de cada rol cuando no hay nada urgente. */
const POR_DEFECTO = {
  direccion: { texto: 'Encargar un proyecto', enlace: '#/encargo/nuevo', detalle: 'Todo al día. Si llega un trabajo nuevo, encárgalo aquí.' },
  rrhh: { texto: 'Revisar al personal', enlace: '#/personal', detalle: 'Todo al día. Documentos, contratos y ausencias están en orden.' },
  terreno: { texto: 'Crear un proyecto', enlace: '#/proyecto-tecnico/nuevo', detalle: 'No tienes nada pendiente. Si llegó un trabajo por correo, créalo aquí.' },
};

/** Lo primero que conviene hacer hoy: el pendiente más urgente, o la acción típica del rol. */
export function accionPrincipal(rol, items = []) {
  const [x] = ordenarPendientes(items);
  if (x && (x.nivel === 'rojo' || x.nivel === 'ambar')) return { texto: x.titulo, enlace: x.enlace, detalle: x.detalle || '', nivel: x.nivel, etiqueta: x.etiqueta || '', pendiente: true };
  return { ...(POR_DEFECTO[rol] || POR_DEFECTO.terreno), nivel: 'verde', pendiente: false };
}

/** Días entre dos fechas ISO (b − a). */
const dias = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

/**
 * Semáforo de un proyecto para Jefatura.
 * Rojo: plazo vencido o consultas de terreno sin respuesta. Ámbar: sin confirmar recepción, actividades atrasadas
 * o plazo en 7 días. Verde: avanza sin problemas.
 * @returns {{color:'rojo'|'ambar'|'verde', motivo:string, pct:number}}
 */
export function semaforoProyecto(p, hoy) {
  const r = resumenCronograma(p.cronograma || [], hoy);
  const abiertas = entradasAbiertas(p).length;
  const recurrente = p.periodicidad && p.periodicidad.tipo === 'recurrente';
  const motivos = { rojo: [], ambar: [] };
  if (p.plazo && !recurrente && p.plazo < hoy) motivos.rojo.push(`plazo vencido hace ${dias(p.plazo, hoy)} día${dias(p.plazo, hoy) === 1 ? '' : 's'}`);
  if (abiertas) motivos.rojo.push(`${abiertas} consulta${abiertas > 1 ? 's' : ''} sin responder`);
  if (sinAcuse(p)) motivos.ambar.push('aún no confirma que lo recibió');
  if (r.atrasadas.length) motivos.ambar.push(`${r.atrasadas.length} actividad${r.atrasadas.length > 1 ? 'es' : ''} atrasada${r.atrasadas.length > 1 ? 's' : ''}`);
  if (p.plazo && !recurrente && p.plazo >= hoy && dias(hoy, p.plazo) <= 7) motivos.ambar.push(dias(hoy, p.plazo) === 0 ? 'vence hoy' : `vence en ${dias(hoy, p.plazo)} día${dias(hoy, p.plazo) === 1 ? '' : 's'}`);
  const color = motivos.rojo.length ? 'rojo' : motivos.ambar.length ? 'ambar' : 'verde';
  const motivo = [...motivos.rojo, ...motivos.ambar].join(' · ') || (r.total ? `avanza bien · ${r.pct} %` : 'avanza bien');
  return { color, motivo: motivo.charAt(0).toUpperCase() + motivo.slice(1), pct: r.total ? r.pct : 0 };
}

/** Cuenta de proyectos por color, para la cabecera del tablero. */
export function contarSemaforo(lista) {
  const n = { rojo: 0, ambar: 0, verde: 0 };
  for (const s of lista) n[s.color]++;
  return n;
}
