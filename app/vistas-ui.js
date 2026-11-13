// app/vistas-ui.js — piezas comunes de las pantallas del Sistema (v0.14.1: antes dentro de vistas.js).

import { escapar as esc, fechaLegible } from '../compartido/util.js';

export const ICONO = {
  equipo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11"/><path d="M5 21l7-7 7 7"/><circle cx="12" cy="3" r="1.5"/></svg>',
  alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4"/><path d="M12 17.5v.5"/></svg>',
  calib: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  proyecto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h6l2 2h10v10H3z"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/></svg>',
};

export const nivelCal = {
  vencida: c => `<span class="sis-chip rojo">Calibración vencida hace ${-c.dias} d</span>`,
  por_vencer: c => `<span class="sis-chip ambar">Calibración vence en ${c.dias} d</span>`,
  sin_dato: () => '<span class="sis-chip ambar">Falta fecha de calibración</span>',
  ok: c => `<span class="sis-chip verde">Calibración al día · ${fechaLegible(c.proxima)}</span>`,
  no_aplica: () => '<span class="sis-chip gris">No requiere calibración</span>',
};
export const chipCal = c => (nivelCal[c.nivel] || nivelCal.sin_dato)(c);
export const chipAlertas = n => n ? `<span class="sis-chip rojo">${n} alerta${n > 1 ? 's' : ''} abierta${n > 1 ? 's' : ''}</span>` : '';
export const LUGAR = { oficina: 'En oficina', terreno: 'En terreno', mantencion: 'En mantención', baja: 'De baja' };

export function filaEquipo(e, { nombreProyecto } = {}) {
  const lugar = e.ubicacion.lugar === 'terreno' && nombreProyecto
    ? `<span class="sis-chip azul">${esc(nombreProyecto(e.ubicacion.proyectoId))}</span>`
    : `<span class="sis-chip gris">${LUGAR[e.ubicacion.lugar] || ''}</span>`;
  return `<a class="sis-fila" href="#/equipos/${esc(e.id)}">
    <span class="sis-fila-txt"><b>${esc(e.nombre)}</b><span class="sis-tenue">${esc([e.equipo, e.numeroSerie && `N° ${e.numeroSerie}`].filter(Boolean).join(' · '))}</span></span>
    <span class="sis-chips">${lugar}${chipCal(e.calibracion)}${chipAlertas(e.alertasActivas.length)}</span>
  </a>`;
}

export const vacio = (texto, extra = '') => `<div class="sis-vacio"><p>${texto}</p>${extra}</div>`;

export function estadoAlerta(e) {
  return { abierta: 'Abierta', en_mantencion: 'En mantención', recibida: 'Recibida de mantención', cerrada: 'Cerrada' }[e] || e;
}

// Fechas cortas de pantalla (antes repetidas en vistas.js y calendario.js).
const DSEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const aFechaL = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const lunesDe = iso => { const f = aFechaL(iso); f.setDate(f.getDate() - ((f.getDay() + 6) % 7)); return f.toISOString().slice(0, 10); };
export const diaCorto = iso => { const f = aFechaL(iso); return `${DSEM[f.getDay()]} ${f.getDate()}`; };
