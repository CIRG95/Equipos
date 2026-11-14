// modulos/administracion/pantallas-seguridad.js — Seguridad en terreno por proyecto (Sistema v0.15): charla de 5 minutos
// con registro de asistencia, riesgos del día con su medida de control e incidencias (las de equipos abren una alerta
// en Equipos). Pensada para usarse desde el teléfono. Ruta: #/seguridad/<proyectoId>

import { hoyISO, fechaHoraLegible } from '../../compartido/util.js';
import { ALM, guardarRegistro, guardarArchivoAdmin } from './datos.js';
import { RIESGOS_BASE } from './modelo.js';
import { esc, fechaLegible, vacio, plural, campo, input, select } from './ui.js';

const SEG = [['charla', 'Charla de 5 minutos'], ['riesgos', 'Riesgos del día'], ['incidencias', 'Incidencias']];
const TIPOS_INC = [['equipo', 'Equipo'], ['acceso', 'Acceso'], ['seguridad', 'Seguridad'], ['mandante', 'Mandante'], ['otro', 'Otro']];

export async function seguridad(v, proyectoId) {
  const p = v.st.proyectos.find(x => x.id === proyectoId);
  if (!p) return vacio('Seleccione un proyecto desde su ficha para registrar la seguridad en terreno.', '<a class="sis-btn" href="#/proyectos">Ir a Proyectos</a>');
  const s = v.st.segSeccion || 'charla';
  const regs = v.st.d.seguridad.filter(x => x.proyectoId === proyectoId).sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)));
  const cuadrilla = [...new Set([p.encargadoId, ...(p.cuadrilla || [])].filter(Boolean))].map(id => v.st.personas.find(x => x.id === id)).filter(Boolean);
  const hoy = hoyISO();
  let cuerpo = '';
  if (s === 'charla') {
    cuerpo = `<form class="sis-form" data-f="charla" data-id="${esc(p.id)}">
      ${campo('Tema', input('tema', '', 'required placeholder="Trabajo cerca de taludes y bermas"'))}
      <div class="sis-campo"><span>Asistentes · cargados desde la cuadrilla del proyecto</span><div class="sis-opciones ad-asistentes">${cuadrilla.length ? cuadrilla.map(x => `<label class="sis-opcion"><input type="checkbox" name="asistentes" value="${esc(x.id)}" checked> ${esc(x.nombre)}</label>`).join('') : '<span class="sis-tenue">El proyecto no tiene cuadrilla. Asígnela en la edición del proyecto.</span>'}</div></div>
      ${campo('Otros asistentes', input('otros', '', 'placeholder="Nombres separados por coma (personal del mandante, contratistas)"'))}
      <div class="sis-acciones"><button class="sis-btn primario">Registrar charla</button></div></form>
      <p class="sis-tenue">La charla se registra en el proyecto con la fecha, la hora y quién la registró. La confirmación de asistencia de cada persona queda a cargo del encargado.</p>`;
  } else if (s === 'riesgos') {
    cuerpo = `<form class="sis-form" data-f="riesgos" data-id="${esc(p.id)}">
      <p class="sis-tenue">Marque los riesgos presentes en la jornada. Cada riesgo incluye su medida de control.</p>
      <div class="ad-riesgos">${RIESGOS_BASE.map(([k, t, m]) => `<label class="sis-fila ad-check"><input type="checkbox" name="riesgos" value="${k}"><span class="sis-fila-txt"><b>${esc(t)}</b><span class="sis-tenue">${esc(m)}</span></span></label>`).join('')}</div>
      ${campo('Otro riesgo y su medida', input('otro', '', 'placeholder="Opcional"'))}
      <div class="sis-acciones"><button class="sis-btn primario">Registrar análisis de riesgos</button></div></form>`;
  } else {
    const eqs = (await v.equipos()).filter(e => e.ubicacion.lugar === 'terreno' && e.ubicacion.proyectoId === p.id);
    cuerpo = `<form class="sis-form" data-f="incidencia" data-id="${esc(p.id)}">
      <div class="sis-par">${campo('Tipo', select('tipo', TIPOS_INC, 'acceso'))}${campo('Equipo (si corresponde)', select('equipoId', eqs.map(e => [e.id, e.nombre]), '', { vacio: 'Ninguno' }))}</div>
      ${campo('Descripción', '<textarea name="descripcion" rows="3" required placeholder="Describa lo ocurrido"></textarea>')}
      ${campo('Fotografía', '<input type="file" name="foto" accept="image/*" capture="environment">')}
      <div class="sis-acciones"><button class="sis-btn primario">Registrar incidencia</button></div></form>
      <p class="sis-tenue">Las incidencias de equipos generan automáticamente una alerta en el módulo Equipos, que llega al encargado y a Recursos Humanos. Todas las incidencias quedan en el proyecto.</p>`;
  }
  const nomRiesgo = k => (RIESGOS_BASE.find(r => r[0] === k) || [k, k])[1];
  const fila = x => {
    const quien = v.nomPers(x.creadoPor) || 'Sin persona';
    if (x.tipo === 'charla') return `<div class="sis-fila"><span class="sis-fila-txt"><b>Charla · ${esc(x.tema)}</b><span class="sis-tenue">${plural((x.asistentes || []).length + (x.otros || []).length, 'asistente', 'asistentes')}: ${esc([...(x.asistentes || []).map(v.nomPers), ...(x.otros || [])].join(', '))}</span><span class="sis-tenue">${fechaHoraLegible(x.creadoEn)} · ${esc(quien)}</span></span><span class="sis-chip verde">Charla</span></div>`;
    if (x.tipo === 'riesgos') return `<div class="sis-fila"><span class="sis-fila-txt"><b>Análisis de riesgos</b><span class="sis-tenue">${esc([...(x.riesgos || []).map(nomRiesgo), x.otro].filter(Boolean).join(' · '))}</span><span class="sis-tenue">${fechaHoraLegible(x.creadoEn)} · ${esc(quien)}</span></span><span class="sis-chip azul">Riesgos</span></div>`;
    return `<div class="sis-fila"><span class="sis-fila-txt"><b>Incidencia · ${esc((TIPOS_INC.find(t => t[0] === x.categoria) || ['', 'Otro'])[1])}</b><span>${esc(x.descripcion)}</span><span class="sis-tenue">${fechaHoraLegible(x.creadoEn)} · ${esc(quien)}${x.alertaEquipo ? ' · alerta creada en Equipos' : ''}</span></span><span class="sis-chips">${x.archivoId ? `<button type="button" class="sis-btn chico" data-a="ver-archivo" data-id="${esc(x.archivoId)}">Foto</button>` : ''}<span class="sis-chip ambar">Incidencia</span></span></div>`;
  };
  const deHoy = regs.filter(x => String(x.creadoEn || '').slice(0, 10) === hoy);
  return `<div class="sis-miga"><a href="#/proyecto/${esc(p.id)}">${esc(p.nombre)}</a> / Seguridad en terreno</div>
    <div class="sis-cab"><div><h1>Seguridad en terreno</h1><span class="sis-tenue">${esc(p.nombre)} · ${fechaLegible(hoy)}</span></div>
      <div class="sis-chips">${deHoy.some(x => x.tipo === 'charla') ? '<span class="sis-chip verde">Charla de hoy registrada</span>' : '<span class="sis-chip ambar">Charla de hoy pendiente</span>'}${deHoy.some(x => x.tipo === 'riesgos') ? '<span class="sis-chip verde">Riesgos de hoy registrados</span>' : ''}</div></div>
    <div class="ad-segmento" role="group" aria-label="Sección">${SEG.map(([k, t]) => `<button type="button" class="${k === s ? 'activo' : ''}" aria-pressed="${k === s}" data-a="seg-seccion" data-s="${k}">${t}</button>`).join('')}</div>
    <section class="sis-tarjeta">${cuerpo}</section>
    <section class="sis-tarjeta"><h2>Registros del proyecto</h2>${regs.length ? `<div class="sis-lista">${regs.slice(0, 30).map(fila).join('')}</div>` : vacio('Sin registros de seguridad en este proyecto.')}</section>`;
}

const txt = (fd, k) => String(fd.get(k) || '').trim();
export const acciones = { 'seg-seccion': (b, v) => { v.st.segSeccion = b.dataset.s; return true; } };
export const formularios = {
  charla: async (f, fd, v) => { await guardarRegistro(ALM.seguridad, { proyectoId: f.dataset.id, tipo: 'charla', fecha: hoyISO(), tema: txt(fd, 'tema'), asistentes: fd.getAll('asistentes'), otros: txt(fd, 'otros').split(',').map(s => s.trim()).filter(Boolean) }); v.avisar('Charla registrada'); return true; },
  riesgos: async (f, fd, v) => { await guardarRegistro(ALM.seguridad, { proyectoId: f.dataset.id, tipo: 'riesgos', fecha: hoyISO(), riesgos: fd.getAll('riesgos'), otro: txt(fd, 'otro') }); v.avisar('Análisis de riesgos registrado'); return true; },
  incidencia: async (f, fd, v) => {
    const reg = await guardarRegistro(ALM.seguridad, { proyectoId: f.dataset.id, tipo: 'incidencia', fecha: hoyISO(), categoria: fd.get('tipo'), descripcion: txt(fd, 'descripcion'), equipoId: fd.get('equipoId') || null });
    const foto = fd.get('foto');
    if (foto && foto.size) { const a = await guardarArchivoAdmin(foto, { duenoTipo: 'seguridad', duenoId: reg.id, proyectoId: f.dataset.id, carpeta: 'Seguridad' }); await guardarRegistro(ALM.seguridad, { id: reg.id, archivoId: a.id }); }
    if (fd.get('equipoId')) { await v.reportarEquipo({ equipoId: fd.get('equipoId'), descripcion: txt(fd, 'descripcion'), proyectoId: f.dataset.id }); await guardarRegistro(ALM.seguridad, { id: reg.id, alertaEquipo: true }); }
    v.avisar('Incidencia registrada'); return true;
  },
};
