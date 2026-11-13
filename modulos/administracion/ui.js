// modulos/administracion/ui.js — piezas de pantalla comunes del módulo Administración (Sistema v0.15).

import { escapar as esc, fechaLegible, fechaHoraLegible } from '../../compartido/util.js';
import { ESTADOS_VENC, textoDias } from '../../compartido/vencimientos.js';
import { ESTADOS_PLATAFORMA } from './modelo.js';

export { esc, fechaLegible, fechaHoraLegible };

export const vacio = (t, extra = '') => `<div class="sis-vacio"><p>${t}</p>${extra}</div>`;
export const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

/** Chip de un estado del motor de vencimientos. */
export function chipVenc(e, { conDias = false } = {}) {
  const x = ESTADOS_VENC[e.estado] || ESTADOS_VENC.falta;
  const t = conDias && e.dias != null && ['por_vencer', 'vencido'].includes(e.estado) ? textoDias(e).replace(/^./, c => c.toUpperCase()) : x.texto;
  return `<span class="sis-chip ${x.color}">${esc(t)}</span>`;
}

/** Chip de habilitación: nivel 'ok' | 'aviso' | 'no'. */
export function chipHab(h, { si = 'Habilitado', no = 'No habilitado', aviso = 'Habilitado · revisar fechas' } = {}) {
  if (!h) return '<span class="sis-chip gris">Sin requisitos</span>';
  return h.nivel === 'no' ? `<span class="sis-chip rojo">${no}${h.pendientes.length ? ` · ${h.pendientes.length}` : ''}</span>` : h.nivel === 'aviso' ? `<span class="sis-chip ambar">${aviso}</span>` : `<span class="sis-chip verde">${si}</span>`;
}

const PLAT = Object.fromEntries(ESTADOS_PLATAFORMA.map(([k, t, c]) => [k, { t, c }]));
export const chipPlataforma = k => (k && PLAT[k] ? `<span class="sis-chip ${PLAT[k].c}">${PLAT[k].t}</span>` : '<span class="sis-chip gris">Sin subir</span>');

/** Pestañas internas de una pantalla (enlaces con hash). */
export function pestanas(lista, activa) {
  return `<nav class="ad-tabs" aria-label="Secciones">${lista.map(([k, t, href]) => `<a href="${href}" class="${k === activa ? 'activo' : ''}"${k === activa ? ' aria-current="page"' : ''}>${esc(t)}</a>`).join('')}</nav>`;
}

/** Campo de formulario con etiqueta. */
export function campo(etiqueta, control, { ayuda = '', ancho = '' } = {}) {
  return `<label class="sis-campo${ancho ? ` ${ancho}` : ''}"><span>${esc(etiqueta)}</span>${control}${ayuda ? `<small class="sis-tenue">${ayuda}</small>` : ''}</label>`;
}
export const input = (nombre, valor = '', extra = '') => `<input name="${nombre}" value="${esc(valor ?? '')}" ${extra}>`;
export const fecha = (nombre, valor = '', extra = '') => `<input type="date" name="${nombre}" value="${esc(valor || '')}" ${extra}>`;
export function select(nombre, opciones, valor = '', { vacio: v = null, extra = '' } = {}) {
  return `<select name="${nombre}" ${extra}>${v != null ? `<option value="">${esc(v)}</option>` : ''}${opciones.map(([k, t]) => `<option value="${esc(k)}" ${String(k) === String(valor ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
}

/** «Modificado por X el dd-mm-aaaa hh:mm» (historial automático: lo pone sellar()). */
export const firmaCambio = (r, nomPers) => (r && r.actualizadoEn ? `<span class="sis-tenue ad-firma">Última modificación: ${esc(nomPers(r.modificadoPor) || 'sin persona')} · ${fechaHoraLegible(r.actualizadoEn)}</span>` : '');

export const ICO = {
  descargar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  ver: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  candado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>',
};
