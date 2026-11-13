// app/calendario.js — vista Calendario de Proyectos (v0.10): mes, semana y por persona.
// Se llena solo con: jornadas de las hojas de vuelo (o su fecha), límite de la solicitud DGAC (7 días hábiles antes),
// ciclos de los proyectos recurrentes (terreno, llegada de datos, entrega), plazo de los proyectos únicos y
// vencimientos de calibración de Equipos.

import { escapar as esc, hoyISO, fechaLegible } from '../compartido/util.js';
import { aFechaL as aFecha, lunesDe } from './vistas-ui.js';
import { listarProyectos, listarPersonas, OFICINA_ID } from '../compartido/catalogos.js';
import { ciclosEntre, restarHabiles, sumarDias, aISO, MESES } from '../compartido/periodicidad.js';
import { listarPlanes } from '../modulos/vuelos/datos.js';
import * as Equipos from '../modulos/equipos/equipos.js';

export const TIPOS = {
  vuelo: { texto: 'Vuelos y terreno', clase: 'cal-vuelo' },
  terreno: { texto: 'Vuelos y terreno', clase: 'cal-vuelo' },
  datos: { texto: 'Llegada de datos', clase: 'cal-datos' },
  entrega: { texto: 'Entregas', clase: 'cal-entrega' },
  dgac: { texto: 'Permisos DGAC', clase: 'cal-dgac' },
  calibracion: { texto: 'Calibraciones', clase: 'cal-calib' },
};
const LEYENDA = [['vuelo', 'Vuelos y terreno'], ['datos', 'Llegada de datos'], ['entrega', 'Entregas'], ['dgac', 'Permisos DGAC'], ['calibracion', 'Calibraciones']];
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];


/** Eventos entre dos fechas (incluidas): [{ fecha, tipo, texto, enlace, personaId, proyectoId }]. */
export async function eventosEntre(desde, hasta) {
  const [proyectos, hojas, equipos] = await Promise.all([listarProyectos(), listarPlanes().catch(() => []), Equipos.listarEquiposConEstado().catch(() => [])]);
  const nomProy = new Map(proyectos.map(p => [p.id, p.nombre]));
  const ev = [];
  const poner = (fecha, e) => { if (fecha && fecha >= desde && fecha <= hasta) ev.push({ fecha, ...e }); };
  for (const p of proyectos) {
    if (p.id === OFICINA_ID || p.estado === 'cerrado') continue;
    const per = p.periodicidad;
    if (per && per.tipo === 'recurrente') {
      for (const c of ciclosEntre(per, desde, sumarDias(hasta, 0))) {
        c.diasTerreno.forEach((f, k) => poner(f, { tipo: 'terreno', texto: `${p.nombre} · terreno ${c.numero}${c.diasTerreno.length > 1 ? ` (${k + 1}/${c.diasTerreno.length})` : ''}`, corto: `Terreno ${c.numero} · ${p.nombre}`, enlace: `#/proyecto/${p.id}`, personaId: p.encargadoId, proyectoId: p.id }));
        poner(c.datos, { tipo: 'datos', texto: `${p.nombre} · llegan los datos ${c.numero}`, corto: `Datos ${c.numero} · ${p.nombre}`, enlace: `#/seguimiento/${p.id}`, personaId: p.encargadoId, proyectoId: p.id });
        poner(c.entrega, { tipo: 'entrega', texto: `${p.nombre} · entrega ${c.nombre}`, corto: `Entrega ${c.numero} · ${p.nombre}`, enlace: `#/seguimiento/${p.id}`, personaId: p.encargadoId, proyectoId: p.id });
      }
    } else if (p.plazo) poner(p.plazo, { tipo: 'entrega', texto: `${p.nombre} · entrega`, corto: `Entrega · ${p.nombre}`, enlace: `#/proyecto/${p.id}`, personaId: p.encargadoId, proyectoId: p.id });
  }
  for (const h of hojas) {
    if (h.estado === 'archivada') continue;
    const nombre = h.nombre || 'Hoja de vuelo';
    const dias = Array.isArray(h.programa) && h.programa.length ? h.programa : (h.fecha ? [{ fecha: h.fecha }] : []);
    dias.forEach(d => poner(d.fecha, { tipo: 'vuelo', texto: `${nombre}${d.de > 1 ? ` · día ${d.dia}/${d.de}` : ' · vuelo'}`, corto: `Vuelo${d.de > 1 ? ` ${d.dia}/${d.de}` : ''} · ${nombre}`, detalle: d.sectores ? `${d.sectores.length} sectores · ${d.baterias} baterías` : '', enlace: `#/vuelos/plan/${h.id}`, personaId: h.pilotoId, proyectoId: h.proyectoId }));
    const dg = (h.permisos && h.permisos.dgac) || {};
    if (dias.length && !dg.enviado && !dg.aprobado && h.estado !== 'volada') poner(restarHabiles(dias[0].fecha, 7), { tipo: 'dgac', texto: `${nombre} · enviar DGAC (límite)`, corto: `Límite DGAC · ${nombre}`, enlace: `#/vuelos/plan/${h.id}`, personaId: h.pilotoId, proyectoId: h.proyectoId });
  }
  for (const e of equipos) {
    const c = e.calibracion || {};
    if (c.proxima) poner(String(c.proxima).slice(0, 10), { tipo: 'calibracion', texto: `${e.nombre || e.modelo || 'Equipo'}${e.numeroSerie ? ` ···${String(e.numeroSerie).slice(-4)}` : ''} · calibración vence`, corto: `Calibración · ${e.nombre || e.modelo || 'Equipo'}`, enlace: `#/equipos/${e.id}`, personaId: e.ubicacion && e.ubicacion.personaId, proyectoId: e.ubicacion && e.ubicacion.proyectoId });
  }
  ev.forEach(e => { e.proyecto = nomProy.get(e.proyectoId) || ''; });
  return ev.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo));
}

const chip = (e, corto = false) => `<a class="cal-ev ${TIPOS[e.tipo].clase}" href="${esc(e.enlace || '#')}" title="${esc(e.texto)}${e.detalle ? ' · ' + esc(e.detalle) : ''}">${esc(corto ? (e.corto || e.texto) : e.texto)}</a>`;

/** HTML de la vista Calendario. estado: { modo: 'mes'|'semana'|'persona', ref: AAAA-MM-DD, proyecto: '' }. */
export async function vistaCalendario(estado) {
  const hoy = hoyISO();
  const ref = estado.ref || hoy, modo = estado.modo || 'mes';
  const f = aFecha(ref);
  let desde, hasta, titulo;
  if (modo === 'mes') {
    desde = lunesDe(aISO(new Date(f.getFullYear(), f.getMonth(), 1, 12)));
    hasta = sumarDias(desde, 41);
    titulo = `${MESES[f.getMonth()]} ${f.getFullYear()}`;
  } else {
    desde = lunesDe(ref); hasta = sumarDias(desde, 6);
    titulo = `Semana del ${fechaLegible(desde)} al ${fechaLegible(hasta)}`;
  }
  const [todos, proyectos, personas] = await Promise.all([eventosEntre(sumarDias(desde, 0), sumarDias(hasta, 14)), listarProyectos(), listarPersonas()]);
  const ev = todos.filter(e => !estado.proyecto || e.proyectoId === estado.proyecto);
  const delDia = iso => ev.filter(e => e.fecha === iso);
  const dias = n => Array.from({ length: n }, (_, k) => sumarDias(desde, k));
  let cuerpo;
  if (modo === 'mes') {
    cuerpo = `<div class="cal-grilla cal-mes"><div class="cal-cab">${DIAS.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="cal-celdas">${dias(42).map(d => { const fd = aFecha(d), fuera = fd.getMonth() !== f.getMonth(), es = delDia(d);
        return `<div class="cal-dia${fuera ? ' fuera' : ''}${fd.getDay() % 6 === 0 ? ' finde' : ''}${d === hoy ? ' hoy' : ''}"><span class="cal-num">${fd.getDate()}</span>${es.slice(0, 4).map(e => chip(e, true)).join('')}${es.length > 4 ? `<button type="button" class="cal-mas" data-accion="cal-ir" data-ref="${d}" data-modo="semana">+${es.length - 4} más</button>` : ''}</div>`; }).join('')}</div></div>`;
  } else if (modo === 'semana') {
    cuerpo = `<div class="cal-semana">${dias(7).map((d, k) => { const fd = aFecha(d), es = delDia(d);
      return `<div class="cal-col${d === hoy ? ' hoy' : ''}"><div class="cal-col-cab"><span>${DIAS[k]}</span><b>${fd.getDate()}</b></div>${es.map(e => `${chip(e)}${e.detalle ? `<small class="cal-det">${esc(e.detalle)}</small>` : ''}`).join('') || '<span class="cal-vacio">—</span>'}</div>`; }).join('')}</div>`;
  } else {
    const semana = dias(7), ids = [...new Set(ev.filter(e => e.fecha <= hasta).map(e => e.personaId || ''))];
    const nom = id => id ? ((personas.find(p => p.id === id) || {}).nombre || 'Persona') : 'Sin persona asignada';
    cuerpo = `<div class="cal-personas" style="grid-template-columns: 180px repeat(7, minmax(0, 1fr))">
      <span></span>${semana.map((d, k) => `<span class="cal-pcab${d === hoy ? ' hoy' : ''}">${DIAS[k]} ${aFecha(d).getDate()}</span>`).join('')}
      ${ids.length ? ids.sort((a, b) => nom(a).localeCompare(nom(b), 'es')).map(id => `<b class="cal-pnom">${esc(nom(id))}</b>${semana.map(d => `<div class="cal-pcel">${ev.filter(e => e.fecha === d && (e.personaId || '') === id).map(e => chip(e, true)).join('')}</div>`).join('')}`).join('')
        : '<p class="sis-tenue" style="grid-column: 1 / -1">No hay nada programado esta semana.</p>'}
    </div>`;
  }
  const proximos = ev.filter(e => e.fecha >= hoy && e.fecha <= sumarDias(hoy, 14));
  return `<div class="cal-barra">
      <div class="cal-nav"><button class="sis-btn chico" data-accion="cal-mover" data-d="-1" aria-label="Anterior">‹</button><b>${esc(titulo)}</b><button class="sis-btn chico" data-accion="cal-mover" data-d="1" aria-label="Siguiente">›</button><button class="sis-btn chico" data-accion="cal-ir" data-ref="${hoy}">Hoy</button></div>
      <div class="cal-modos" role="tablist" aria-label="Vista del calendario">${[['mes', 'Mes'], ['semana', 'Semana'], ['persona', 'Por persona']].map(([k, t]) => `<button type="button" role="tab" aria-selected="${modo === k}" class="${modo === k ? 'activo' : ''}" data-accion="cal-modo" data-modo="${k}">${t}</button>`).join('')}</div>
    </div>
    <div class="cal-filtros">${LEYENDA.map(([k, t]) => `<span class="cal-ley ${TIPOS[k].clase}">${t}</span>`).join('')}
      <label class="cal-proy">Proyecto <select data-accion="cal-proyecto"><option value="">Todos</option>${proyectos.filter(p => p.id !== OFICINA_ID && p.estado !== 'cerrado').map(p => `<option value="${esc(p.id)}" ${estado.proyecto === p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label></div>
    <div class="cal-dos"><div class="cal-principal">${cuerpo}</div>
      <aside class="sis-tarjeta cal-proximos"><h2>Próximos 14 días</h2>${proximos.length ? `<div class="cal-lista">${proximos.map(e => `<span class="cal-fecha">${e.fecha === hoy ? 'hoy' : esc(fechaCorta(e.fecha))}</span>${chip(e)}`).join('')}</div>` : '<p class="sis-tenue">Nada en las próximas dos semanas.</p>'}
        <p class="sis-tenue">Se llena solo con las jornadas de las hojas de vuelo («Agregar al calendario» en su Resumen), la periodicidad de cada proyecto, el límite DGAC y las calibraciones que vencen.</p></aside></div>`;
}
const DS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const fechaCorta = iso => { const f = aFecha(iso); return `${DS[f.getDay()]} ${f.getDate()}`; };

/** Mueve la referencia un mes o una semana. */
export function mover(estado, d) {
  const f = aFecha(estado.ref || hoyISO());
  if ((estado.modo || 'mes') === 'mes') return aISO(new Date(f.getFullYear(), f.getMonth() + d, 1, 12));
  return sumarDias(aISO(f), 7 * d);
}
