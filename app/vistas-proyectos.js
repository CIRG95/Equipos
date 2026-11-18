// app/vistas-proyectos.js — Proyectos: activos, registro por mandante, ficha y edición (v0.14.1: separada de vistas.js).


import { escapar as esc, fechaLegible, fechaHoraLegible, hoyISO, diasEntre } from '../compartido/util.js';
import { enPapelera } from '../compartido/papelera.js';
import { listarProyectos, obtenerProyecto, listarPersonas, OFICINA_ID } from '../compartido/catalogos.js';
import * as Equipos from '../modulos/equipos/equipos.js';
import * as Vuelos from '../modulos/vuelos/vuelos.js';
import * as Seguimiento from '../modulos/seguimiento/seguimiento.js';
import * as Monografias from '../modulos/monografias/monografias.js';
import * as Gastos from '../modulos/gastos/gastos.js';
import { clp, ESTADOS as ESTADOS_GASTOS } from '../modulos/gastos/modelo.js';
import { vistaCalendario, eventosEntre } from './calendario.js';
import { ciclosEntre, textoPeriodicidad, sumarDias } from '../compartido/periodicidad.js';
import { ESTADOS as ESTADOS_MONO } from '../modulos/monografias/datos.js';
import { NOMBRE_CATEGORIA, tiposDeProyecto, textosTipos, ETAPAS_PROYECTO, NOMBRE_ETAPA_PROYECTO, etapaProyecto } from './catalogo.js';
import { ICONO, filaEquipo, vacio, diaCorto } from './vistas-ui.js';
import { leerTexto as leerLS } from '../compartido/util.js';
import * as Administracion from '../modulos/administracion/administracion.js';
import * as Planificacion from '../modulos/planificacion/planificacion.js';
import { archivosDe } from '../compartido/archivos.js';
import { INFO_ENCARGO, TIPOS_BITACORA, calidadEncargo, resumenCronograma, barraActividad, sinAcuse, entradasAbiertas } from './encargo.js';
import { trabajosDeProyecto, cronogramaDeTrabajos, avisosOrden, POR_BATERIAS } from './trabajos.js';
import { resumenCapas } from '../modulos/vuelos/capas-proyecto.js';

// v0.15 · Entregables del proyecto (versiones, revisión y envío al mandante)
export const ESTADOS_ENTREGABLE = [['pendiente', 'Pendiente', 'gris'], ['revision', 'En revisión', 'ambar'], ['enviado', 'Enviado', 'azul'], ['observado', 'Observado', 'rojo'], ['aprobado', 'Aprobado', 'verde']];
const chipEntregable = e => { const x = ESTADOS_ENTREGABLE.find(([k]) => k === e) || ESTADOS_ENTREGABLE[0]; return `<span class="sis-chip ${x[2]}">${x[1]}</span>`; };
const chipHab = (h, si = 'Habilitado', no = 'No habilitado') => (!h ? '<span class="sis-chip gris">Sin requisitos</span>' : h.nivel === 'no' ? `<span class="sis-chip rojo">${no}</span>` : h.nivel === 'aviso' ? '<span class="sis-chip ambar">Por vencer</span>' : `<span class="sis-chip verde">${si}</span>`);

// ─────────────────────────── Proyectos ───────────────────────────

export async function proyectos(ctx, sub = null) {
  if (sub === 'calendario') {
    ctx.estado.cal = ctx.estado.cal || { modo: leerLS('env_cal_modo') || 'mes', ref: hoyISO(), proyecto: '' };
    return `<div class="sis-cab"><h1>Calendario</h1>${botonNuevo(ctx)}</div>${await vistaCalendario({ ...ctx.estado.cal, rol: ctx.rol })}`;
  }
  if (sub === 'registro') return registroMandantes(ctx);
  const [lista, personas, equipos, vuelos, eventos] = await Promise.all([listarProyectos(), listarPersonas(), Equipos.listarEquiposConEstado(), Vuelos.listarVuelos().catch(() => []), eventosEntre(hoyISO(), sumarDias(hoyISO(), 90)).catch(() => [])]);
  const nomPers = id => (personas.find(p => p.id === id) || {}).nombre || '';
  const enProyecto = id => equipos.filter(e => e.ubicacion.lugar === 'terreno' && e.ubicacion.proyectoId === id).length;
  const activos = lista.filter(p => p.id !== OFICINA_ID && p.estado !== 'cerrado');
  const eliminados = (await enPapelera('compartido_proyectos')).map(x => x.registro);
  const segs = Object.fromEntries(await Promise.all(activos.map(async p => [p.id, await Seguimiento.resumenDeProyecto(p.id).catch(() => null)])));
  const vista = leerLS('env_proyectos_vista2') === 'etapas' ? 'etapas' : 'tarjetas';
  const selector = `<div class="sis-vistas" role="tablist" aria-label="Vista de proyectos"><button type="button" role="tab" aria-selected="${vista === 'tarjetas'}" class="${vista === 'tarjetas' ? 'activo' : ''}" data-accion="vista-proyectos" data-v="tarjetas">Tarjetas</button><button type="button" role="tab" aria-selected="${vista === 'etapas'}" class="${vista === 'etapas' ? 'activo' : ''}" data-accion="vista-proyectos" data-v="etapas">Por etapa</button></div>`;

  const tarjeta = p => {
    const et = etapaProyecto(p), iEt = ETAPAS_PROYECTO.findIndex(([k]) => k === et);
    const vs = vuelos.filter(v => v.proyectoId === p.id), sg = segs[p.id], prox = eventos.find(e => e.proyectoId === p.id && e.tipo !== 'calibracion');
    const sig = ETAPAS_PROYECTO[iEt + 1];
    let avance = '';
    if (sg) { const c = sg.cuenta; avance = `${c.total - c.sinvolar}/${c.total} tramos volados · ${c.productosListos}/${c.productos} productos · ${c.ok}/${c.total} entregados`; }
    else if (vs.length) { const n = k => vs.filter(v => v.etapa === k).length; avance = `${vs.length} vuelo${vs.length === 1 ? '' : 's'}: ${[['planificacion', 'en planificación'], ['permisos', 'en permisos'], ['programado', 'programados'], ['volado', 'volados sin log'], ['log', 'con log'], ['procesado', 'procesados']].filter(([k]) => n(k)).map(([k, t]) => `${n(k)} ${t}`).join(' · ')}`; }
    return `<article class="sis-proy-card ${et}">
      <div class="sis-proy-card-cab"><small>${esc(p.mandante || 'Sin mandante')}</small><span class="sis-chip etapa-${et}">${esc(NOMBRE_ETAPA_PROYECTO[et])}</span></div>
      <a class="sis-proy-card-nombre" href="#/proyecto/${esc(p.id)}">${esc(p.nombre)}</a>
      <div class="sis-etapas-barra" role="img" aria-label="Etapa: ${esc(NOMBRE_ETAPA_PROYECTO[et])}">${ETAPAS_PROYECTO.map(([k], i) => `<i class="${i <= iEt ? 'hecho' : ''}"></i>`).join('')}</div>
      <div class="sis-etapas-txt">${ETAPAS_PROYECTO.map(([k, t], i) => `<span class="${i === iEt ? 'actual' : ''}">${t.replace('Proceso en ', '')}</span>`).join('')}</div>
      ${avance ? `<p class="sis-tenue">${esc(avance)}</p>` : ''}
      <div class="sis-chips">${tiposDeProyecto(p).categorias.map(t => `<span class="sis-chip gris">${esc(NOMBRE_CATEGORIA[t])}</span>`).join('')}${enProyecto(p.id) ? `<span class="sis-chip azul">${enProyecto(p.id)} equipo${enProyecto(p.id) > 1 ? 's' : ''} en terreno</span>` : ''}</div>
      <div class="sis-proy-card-pie"><span>${p.encargadoId ? `Encargado: ${esc(nomPers(p.encargadoId))}` : (p.comuna ? esc(p.comuna) : '')}</span><span>${prox ? `Próximo: ${esc(prox.corto ? prox.corto.split(' · ')[0] : prox.texto)} ${esc(diaCorto(prox.fecha))}` : p.plazo ? `Plazo ${fechaLegible(p.plazo)}` : ''}</span></div>
      ${sig ? `<button type="button" class="sis-btn chico" data-accion="etapa-proyecto" data-id="${esc(p.id)}" data-e="${sig[0]}">Pasar a ${esc(sig[1].toLowerCase())} →</button>` : ''}
    </article>`;
  };

  const cuerpo = vista === 'etapas'
    ? `<div class="sis-columnas-etapa">${ETAPAS_PROYECTO.filter(([k]) => k !== 'completado').map(([k, t]) => { const ps = activos.filter(p => etapaProyecto(p) === k); return `<div class="sis-col-etapa"><h2>${t} <span class="sis-tenue">${ps.length}</span></h2>${ps.map(tarjeta).join('') || '<p class="sis-tenue">Sin proyectos.</p>'}</div>`; }).join('')}</div>`
    : `<div class="sis-proy-cards">${activos.map(tarjeta).join('')}</div>`;
  const oficina = lista.find(p => p.id === OFICINA_ID);
  return `<div class="sis-cab"><div><h1>Proyectos activos</h1><span class="sis-tenue">${activos.length} proyecto${activos.length === 1 ? '' : 's'} · terreno → gabinete → entregables → completado</span></div>${selector}${botonNuevo(ctx)}</div>
    ${activos.length ? cuerpo : vacio('Aún no hay proyectos activos. Use «Encargar proyecto» para registrar el primero.')}
    ${oficina ? `<p class="sis-tenue">Trabajo que no es de un contrato: <a href="#/proyecto/${OFICINA_ID}">Oficina</a>. Los completados quedan en <a href="#/proyectos/registro">Registro por mandante</a>.</p>` : ''}
    ${eliminados.length ? `<details class="sis-papelera"><summary>Papelera de proyectos (${eliminados.length})</summary>
      <section class="sis-tarjeta"><div class="sis-lista">${eliminados.map(p => `<div class="sis-fila">
        <span class="sis-fila-txt"><b>${esc(p.nombre)}</b><span class="sis-tenue">Eliminado ${fechaHoraLegible(p.eliminadoEn)}</span></span>
        <button class="sis-btn chico" data-accion="restaurar-proyecto" data-id="${esc(p.id)}">Restaurar</button>
        <button class="sis-btn chico peligro" data-accion="purgar-proyecto" data-id="${esc(p.id)}" data-nombre="${esc(p.nombre)}">Eliminar definitivamente</button></div>`).join('')}</div>
        ${eliminados.length > 1 ? `<button class="sis-btn chico peligro" data-accion="vaciar-papelera-proyectos">Vaciar la papelera (${eliminados.length})</button>` : ''}</section></details>` : ''}`;
}

/** Minutos → «3 h 20 min». */
const duracion = m => { const t = Math.round(m); return t >= 60 ? `${Math.floor(t / 60)} h${t % 60 ? ` ${t % 60} min` : ''}` : `${t} min`; };

// ─────────── Registro por mandante (v0.11): base de datos de los proyectos completados ───────────
export async function datosRegistro() {
  const [lista, vuelos, monos] = await Promise.all([listarProyectos(), Vuelos.listarVuelos().catch(() => []), Promise.resolve(null)]);
  const cerrados = lista.filter(p => p.id !== OFICINA_ID && p.estado === 'cerrado');
  return cerrados.map(p => {
    const vs = vuelos.filter(v => v.proyectoId === p.id);
    const fin = (p.etapas && p.etapas.completado) || (p.actualizadoEn || '').slice(0, 10);
    const ini = p.fechaEncargo || (p.creadoEn || '').slice(0, 10);
    return {
      p, mandante: (p.mandante || '').trim() || 'Sin mandante', fin, ini,
      dias: fin && ini ? Math.max(0, diasEntre(ini, fin)) : null,
      ha: vs.reduce((t, v) => t + (v.resumen.area || 0), 0) / 10000,
      km: vs.reduce((t, v) => t + (v.resumen.largo || 0), 0) / 1000,
      vuelos: vs.length, tipos: tiposDeProyecto(p).categorias.map(t => NOMBRE_CATEGORIA[t]).join(', '),
    };
  });
}

async function registroMandantes(ctx) {
  const filas = await datosRegistro();
  const grupos = new Map();
  for (const f of filas) { if (!grupos.has(f.mandante)) grupos.set(f.mandante, []); grupos.get(f.mandante).push(f); }
  const mandantes = [...grupos.keys()].sort((a, b) => grupos.get(b).length - grupos.get(a).length || a.localeCompare(b));
  const sel = mandantes.includes(ctx.estado.mandante) ? ctx.estado.mandante : mandantes[0];
  const fs = (grupos.get(sel) || []).sort((a, b) => (b.fin || '').localeCompare(a.fin || ''));
  const conDias = fs.filter(f => f.dias != null);
  const num = (n, d = 0) => n.toLocaleString('es-CL', { maximumFractionDigits: d });
  return `<div class="sis-cab"><div><h1>Registro por mandante</h1><span class="sis-tenue">Proyectos completados, agrupados por mandante. Sirve como base de datos para cotizar y planificar.</span></div>
      ${filas.length ? '<button class="sis-btn" data-accion="exportar-registro">Exportar CSV</button>' : ''}</div>
    ${!filas.length ? vacio('Aún no hay proyectos completados. Al pasar un proyecto a «Completado» queda aquí, bajo su mandante.') : `
    <div class="sis-registro">
      <div class="sis-mandantes" role="tablist" aria-label="Mandantes">${mandantes.map(m => `<button type="button" role="tab" aria-selected="${m === sel}" class="sis-mandante${m === sel ? ' activo' : ''}" data-accion="ver-mandante" data-m="${esc(m)}"><span>${esc(m)}</span><b>${grupos.get(m).length}</b></button>`).join('')}</div>
      <section class="sis-tarjeta">
        <h2>${esc(sel)}</h2>
        <div class="sis-kpis">
          <div class="sis-kpi"><span>Proyectos</span><b>${fs.length}</b></div>
          <div class="sis-kpi"><span>Superficie volada</span><b>${num(fs.reduce((t, f) => t + f.ha, 0))} <small>ha</small></b></div>
          <div class="sis-kpi"><span>Longitud lineal</span><b>${num(fs.reduce((t, f) => t + f.km, 0), 1)} <small>km</small></b></div>
          <div class="sis-kpi"><span>Plazo medio</span><b>${conDias.length ? num(conDias.reduce((t, f) => t + f.dias, 0) / conDias.length) : '—'} <small>días</small></b></div>
        </div>
        <div class="sis-tabla-scroll"><table class="sis-tabla">
          <thead><tr><th>Proyecto</th><th>Cierre</th><th>Tipos</th><th>Vuelos</th><th>Superficie</th><th>Plazo</th></tr></thead>
          <tbody>${fs.map(f => `<tr><td><a href="#/proyecto/${esc(f.p.id)}">${esc(f.p.nombre)}</a>${f.p.comuna ? `<small>${esc(f.p.comuna)}</small>` : ''}</td><td>${f.fin ? fechaLegible(f.fin) : '—'}</td><td>${esc(f.tipos || '—')}</td><td>${f.vuelos || '—'}</td><td>${f.ha ? `${num(f.ha, 1)} ha` : '—'}${f.km ? ` · ${num(f.km, 1)} km` : ''}</td><td>${f.dias != null ? `${f.dias} d` : '—'}</td></tr>`).join('')}</tbody>
        </table></div>
      </section>
    </div>`}`;
}

/** Jefatura encarga; el encargado de terreno crea un proyecto propio con su formulario técnico. */
export const botonNuevo = ctx => (ctx.rol === 'terreno' ? '<a class="sis-btn primario" href="#/proyecto-tecnico/nuevo">+ Nuevo proyecto</a>' : '<a class="sis-btn primario" href="#/encargo/nuevo">+ Encargar proyecto</a>');

// ─────────── v0.17 · Planificación técnica: trabajos ordenados y capas del proyecto ───────────
const ENLACE_TRABAJO = { dron: id => `#/vuelos/proyecto/${id}`, gnss: id => `#/planificacion/proyecto/${id}`, nivelacion: id => `#/monografias/${id}`, estacion: id => `#/monografias/${id}` };
const TEXTO_ENLACE = { dron: 'Hojas de vuelo', gnss: 'Red de PR', nivelacion: 'Monografías', estacion: 'Monografías' };

/** Días de vuelo según las hojas programadas del proyecto (0 si ninguna está programada). */
const diasDeVuelo = planes => planes.reduce((s, v) => s + (v.programadas || 0), 0);

function htmlTrabajos(p, ctx, planes) {
  const ts = trabajosDeProyecto(p);
  if (!ts.length) return '';
  const edita = ctx.rol === 'terreno' || ctx.rol === 'direccion';
  const dv = diasDeVuelo(planes);
  const nuevos = planes.reduce((s, v) => s + ((v.resumen && v.resumen.amarre && v.resumen.amarre.nuevos) || 0), 0);
  const avisos = avisosOrden(ts, { prsNuevos: nuevos });
  const desde = p.fechaInicio || p.fechaEncargo || '';
  const filas = ts.map((t, k) => {
    const vuelo = POR_BATERIAS.has(t.cat);
    const enlace = ENLACE_TRABAJO[t.cat];
    return `<li class="tr-fila${t.paralelo ? ' paralelo' : ''}" ${edita ? `draggable="true" data-trabajo-i="${k}" data-id="${esc(p.id)}"` : ''}>
      ${edita ? '<span class="tr-asa" aria-hidden="true">⠿</span>' : ''}<span class="tr-n">${k + 1}</span>
      <span class="tr-txt"><b>${esc(NOMBRE_CATEGORIA[t.cat] || t.cat)}</b><small>${vuelo ? (dv ? `Por baterías · ${dv} jornada${dv === 1 ? '' : 's'} según las hojas programadas` : 'Por baterías · programe la hoja de vuelo para calcular las jornadas') : 'Por horario de trabajo'}</small></span>
      <label class="tr-dias">${vuelo && dv ? `<b>${dv}</b>` : `<input type="number" min="1" max="60" value="${esc(t.dias)}" data-accion="trabajo-dias" data-id="${esc(p.id)}" data-i="${k}" aria-label="Días de ${esc(NOMBRE_CATEGORIA[t.cat] || t.cat)}" ${edita ? '' : 'disabled'}>`} días</label>
      ${k ? `<label class="tr-par"><input type="checkbox" data-accion="trabajo-paralelo" data-id="${esc(p.id)}" data-i="${k}" ${t.paralelo ? 'checked' : ''} ${edita ? '' : 'disabled'}> En paralelo con el anterior</label>` : '<span class="tr-par"></span>'}
      <span class="tr-acc">${enlace ? `<a class="sis-btn chico" href="${enlace(p.id)}">${TEXTO_ENLACE[t.cat]}</a>` : ''}
        ${edita ? `<button type="button" class="sis-btn chico" data-accion="trabajo-mover" data-id="${esc(p.id)}" data-i="${k}" data-a="-1" ${k ? '' : 'disabled'} aria-label="Subir">↑</button><button type="button" class="sis-btn chico" data-accion="trabajo-mover" data-id="${esc(p.id)}" data-i="${k}" data-a="1" ${k < ts.length - 1 ? '' : 'disabled'} aria-label="Bajar">↓</button>` : ''}</span></li>`;
  }).join('');
  const crono = desde ? cronogramaDeTrabajos(ts, desde, { diasDe: t => (POR_BATERIAS.has(t.cat) && dv ? dv : t.dias), nombre: c => NOMBRE_CATEGORIA[c] || c, plazo: p.plazo }) : [];
  return `<section class="sis-tarjeta" id="trabajos"><div class="sis-cab"><div><h2>Trabajos del proyecto</h2><span class="sis-tenue">${edita ? 'Ordénelos con las flechas<span data-solo-pc> o arrastrando</span>: el cronograma de terreno sigue este orden.' : 'Orden de ejecución definido por el encargado.'}</span></div></div>
    <ol class="tr-lista">${filas}</ol>
    ${avisos.map(a => `<p class="sis-aviso-linea">${esc(a)}</p>`).join('')}
    ${crono.length ? `<p class="sis-tenue">Desde el ${fechaLegible(desde)}: terreno hasta el ${fechaLegible(crono.filter(a => a.cat !== 'gabinete').reduce((m, a) => (a.hasta > m ? a.hasta : m), crono[0].hasta))}${p.plazo ? `, plazo de entrega ${fechaLegible(p.plazo)}` : ''}.${crono.some(a => a.cat !== 'gabinete' && p.plazo && a.hasta > p.plazo) ? ' <b class="enc-rojo">El terreno termina después del plazo.</b>' : ''}</p>
      ${edita ? `<div class="sis-acciones"><button type="button" class="sis-btn chico primario" data-accion="aplicar-trabajos" data-id="${esc(p.id)}">Llevar al cronograma</button></div>` : ''}`
      : `<p class="sis-tenue">${edita ? `Indique la fecha de inicio de terreno en <a href="#/proyecto-tecnico/${esc(p.id)}">Datos técnicos</a> para armar el cronograma.` : 'Sin fecha de inicio todavía.'}</p>`}
  </section>`;
}

function htmlCapas(p, ctx) {
  const c = p.capas;
  const edita = ctx.rol === 'terreno' || ctx.rol === 'direccion';
  const cargar = edita ? `<label class="sis-btn chico">${c ? '+ Agregar KMZ' : 'Cargar KMZ'}<input type="file" accept=".kml,.kmz" multiple data-accion="capas-cargar" data-id="${esc(p.id)}" hidden></label>` : '';
  if (!c) return edita ? `<section class="sis-tarjeta" id="capas"><div class="sis-cab"><h2>Capas del proyecto</h2>${cargar}</div><p class="sis-tenue">Caminos y PR ya instalados (KMZ o KML). Las hojas de vuelo los usan para elegir las bases de amarre con la menor cantidad de instalaciones.</p></section>` : '';
  const prs = c.prs || [];
  return `<section class="sis-tarjeta" id="capas"><div class="sis-cab"><div><h2>Capas del proyecto</h2><span class="sis-tenue">${esc(resumenCapas(c) || 'Sin PR activos')} · ${esc((c.archivos || []).join(', '))}</span></div><span class="sis-acciones">${cargar}${edita ? `<button type="button" class="sis-btn chico" data-accion="capas-quitar" data-id="${esc(p.id)}">Quitar</button>` : ''}</span></div>
    ${prs.length ? `<div class="cap-prs">${prs.map(x => `<label class="cap-pr${x.usar === false ? ' off' : ''}"><input type="checkbox" data-accion="capa-pr-usar" data-id="${esc(p.id)}" data-pr="${esc(x.id)}" ${x.usar !== false ? 'checked' : ''} ${edita ? '' : 'disabled'}><span>${esc(x.nombre)}</span></label>`).join('')}</div>
      <p class="sis-tenue">Solo los puntos marcados se usan como PR para el amarre de los vuelos. Los puntos sin nombre útil («Marcador sin título») se cargan desmarcados.</p>` : '<p class="sis-tenue">La capa no trae puntos (PR).</p>'}
  </section>`;
}

// ─────────── v0.16 · Encargo: acuse de recibo, calidad, cronograma y bitácora ───────────
function htmlAcuse(p, ctx, nomPers) {
  const e = p.encargo || {};
  if (!e.emitidoEn) return '';
  if (sinAcuse(p)) {
    const mio = ctx.personaId && ctx.personaId === p.encargadoId;
    return `<section class="sis-tarjeta enc-acuse pendiente"><div><b>${mio ? 'Tiene un encargo nuevo' : 'Encargo sin acuse de recibo'}</b>
      <span>Encargado por ${esc(nomPers(e.emitidoPor) || 'Jefatura')} el ${esc(fechaHoraLegible(e.emitidoEn))}${e.prioridad === 'urgente' ? ' · <b>urgente</b>' : ''}. ${mio ? 'Revise la información y confirme la recepción; si falta algo, regístrelo como consulta en la bitácora.' : `${esc(nomPers(p.encargadoId) || 'El encargado')} aún no confirma la recepción.`}</span></div>
      ${mio ? `<button type="button" class="sis-btn primario" data-accion="acusar-recibo" data-id="${esc(p.id)}">Acusar recibo</button>` : ''}</section>`;
  }
  return e.recibidoEn && e.recibidoPor !== e.emitidoPor ? `<p class="sis-tenue enc-acuse-ok">✓ Encargo recibido por ${esc(nomPers(e.recibidoPor) || 'el encargado')} el ${esc(fechaHoraLegible(e.recibidoEn))}.</p>` : '';
}

function htmlCalidad(p) {
  const c = calidadEncargo(p), info = (p.encargo && p.encargo.info) || {};
  const ct = p.contactoTerreno || {};
  const ESTADO = { si: ['Entregada', 'verde'], na: ['No aplica', 'gris'], pend: ['Pendiente', 'ambar'] };
  return `<div class="enc-medidor"><div class="enc-medidor-barra"><i class="${c.pct >= 85 ? 'alto' : c.pct >= 55 ? 'medio' : 'bajo'}" style="width:${c.pct}%"></i></div><b>${c.pct} %</b></div>
    <p class="sis-tenue">Calidad del encargo: ${c.puntos} de ${c.total} antecedentes. ${c.faltan.length ? `Falta: ${esc(c.faltan.slice(0, 4).join(' · '))}${c.faltan.length > 4 ? ` y ${c.faltan.length - 4} más` : ''}.` : 'Completo.'}</p>
    <div class="sis-lista enc-info-lista">${INFO_ENCARGO.map(([k, t]) => { const e = ESTADO[info[k]] || ['Sin indicar', 'rojo']; return `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(t)}</b></span><span class="sis-chips"><span class="sis-chip ${e[1]}">${e[0]}</span>${info[k] !== 'si' && info[k] !== 'na' ? `<button type="button" class="sis-btn chico" data-accion="info-entregada" data-id="${esc(p.id)}" data-k="${k}">Marcar entregada</button>` : ''}</span></div>`; }).join('')}</div>
    ${ct.nombre || ct.telefono ? `<p><b>Contacto en terreno:</b> ${esc(ct.nombre || '')}${ct.telefono ? ` · <a href="tel:${esc(ct.telefono)}">${esc(ct.telefono)}</a>` : ''}</p>` : ''}
    ${p.sistemaReferencia ? `<p><b>Sistema de referencia:</b> ${esc(p.sistemaReferencia)}</p>` : ''}`;
}

function htmlCronograma(p, nomPers, hoy) {
  const acts = (p.cronograma || []).filter(a => a.nombre && a.desde && a.hasta);
  if (!acts.length) return `<section class="sis-tarjeta"><div class="sis-cab"><h2>Cronograma</h2><a class="sis-btn chico" href="#/encargo/${esc(p.id)}">Definir</a></div>
    <div class="sis-vacio"><p>Sin cronograma. Defina las actividades y sus fechas estimadas para dar seguimiento al avance.</p></div></section>`;
  const r = resumenCronograma(acts, hoy);
  const bHoy = hoy >= r.desde && hoy <= r.hasta ? barraActividad({ desde: hoy, hasta: hoy }, r.desde, r.hasta) : null;
  return `<section class="sis-tarjeta"><div class="sis-cab"><div><h2>Cronograma</h2><span class="sis-tenue">${r.hechas} de ${r.total} actividades realizadas · ${fechaLegible(r.desde)} al ${fechaLegible(r.hasta)}${r.atrasadas.length ? ` · <b class="enc-rojo">${r.atrasadas.length} atrasada${r.atrasadas.length > 1 ? 's' : ''}</b>` : ''}</span></div><a class="sis-btn chico" href="#/encargo/${esc(p.id)}">Editar</a></div>
    <div class="sg-mini enc-avance"><i style="width:${r.pct}%"></i></div>
    <div class="enc-gantt ficha">${acts.map((a, i) => { const b = barraActividad(a, r.desde, r.hasta), tarde = !a.hecho && a.hasta < hoy;
      return `<label class="enc-gantt-fila${a.hecho ? ' hecho' : ''}${tarde ? ' tarde' : ''}"><span class="enc-gantt-nombre"><input type="checkbox" data-accion="crono-hecho" data-id="${esc(p.id)}" data-a="${esc(a.id)}" ${a.hecho ? 'checked' : ''} aria-label="Realizada: ${esc(a.nombre)}"><span><b>${esc(a.nombre)}</b><small>${fechaLegible(a.desde)}${a.hasta !== a.desde ? ` al ${fechaLegible(a.hasta)}` : ''}${a.responsableId ? ` · ${esc(nomPers(a.responsableId))}` : ''}${tarde ? ' · atrasada' : ''}</small></span></span>
        <span class="enc-gantt-pista">${bHoy ? `<em class="enc-hoy" style="left:${bHoy.izq.toFixed(2)}%" title="Hoy"></em>` : ''}<i class="c${i % 5}" style="margin-left:${b.izq.toFixed(2)}%;width:${b.ancho.toFixed(2)}%"></i></span></label>`; }).join('')}</div>
    <p class="sis-tenue">Marque cada actividad al terminarla. Las atrasadas aparecen en «Mis pendientes» del encargado.</p></section>`;
}

function htmlBitacora(p, ctx, nomPers) {
  const entradas = (p.bitacora || []).slice().sort((a, b) => String(b.en).localeCompare(String(a.en)));
  const abiertas = entradasAbiertas(p).length;
  const jefatura = ctx.rol !== 'terreno';
  const tipos = jefatura ? [['instruccion', 'Instrucción al equipo'], ['acuerdo', 'Acuerdo'], ['consulta', 'Consulta']] : [['consulta', 'Consulta a Jefatura'], ['llamada', 'Instrucción recibida por teléfono'], ['acuerdo', 'Acuerdo']];
  return `<section class="sis-tarjeta" id="bitacora"><div class="sis-cab"><div><h2>Bitácora del proyecto</h2><span class="sis-tenue">Consultas, instrucciones y acuerdos por escrito, con fecha y autor.</span></div>${abiertas ? `<span class="sis-chip ambar">${abiertas} por resolver</span>` : ''}</div>
    <form class="sis-form enc-bit-form" data-form="bitacora" data-id="${esc(p.id)}">
      <div class="sis-opciones">${tipos.map(([k, t], i) => `<label class="sis-opcion chico"><input type="radio" name="tipo" value="${k}" ${i === 0 ? 'checked' : ''}> ${t}</label>`).join('')}</div>
      <textarea name="texto" rows="2" required placeholder="${jefatura ? 'Escriba la instrucción o el acuerdo. El encargado la recibe como pendiente.' : 'Escriba la consulta, o lo que se le indicó por teléfono para que Jefatura lo confirme.'}" aria-label="Texto"></textarea>
      <div class="sis-acciones"><button class="sis-btn chico primario">Registrar</button></div></form>
    ${entradas.length ? `<div class="enc-bit">${entradas.map(b => { const t = TIPOS_BITACORA[b.tipo] || TIPOS_BITACORA.acuerdo; const abierta = (b.tipo === 'consulta' && !b.respuesta) || (b.tipo === 'llamada' && !b.confirmadoEn);
      return `<article class="enc-bit-item${abierta ? ' abierta' : ''}"><header><span class="sis-chip ${abierta ? t.color : 'gris'}">${t.texto}</span><b>${esc(nomPers(b.por) || 'Sin persona')}</b><small>${esc(fechaHoraLegible(b.en))}</small></header>
        <p>${esc(b.texto)}</p>
        ${b.respuesta ? `<div class="enc-bit-resp"><b>${esc(nomPers(b.respondidoPor) || 'Respuesta')}</b> <small>${esc(fechaHoraLegible(b.respondidoEn))}</small><p>${esc(b.respuesta)}</p></div>` : ''}
        ${b.confirmadoEn ? `<small class="enc-bit-conf">✓ Confirmada por ${esc(nomPers(b.confirmadoPor) || 'Jefatura')} · ${esc(fechaHoraLegible(b.confirmadoEn))}</small>` : ''}
        ${b.tipo === 'consulta' && !b.respuesta ? `<form class="enc-bit-responder" data-form="bitacora-responder" data-id="${esc(p.id)}" data-b="${esc(b.id)}"><input name="respuesta" required placeholder="Responder…" aria-label="Respuesta"><button class="sis-btn chico">Responder</button></form>` : ''}
        ${b.tipo === 'llamada' && !b.confirmadoEn && b.por !== ctx.personaId ? `<div class="sis-acciones"><button type="button" class="sis-btn chico primario" data-accion="bitacora-confirmar" data-id="${esc(p.id)}" data-b="${esc(b.id)}">Confirmar instrucción</button></div>` : ''}
      </article>`; }).join('')}</div>` : '<p class="sis-tenue">Sin registros. Lo que se acuerde por teléfono puede anotarse aquí para que quede constancia y la otra parte lo confirme.</p>'}
  </section>`;
}


export async function proyecto(ctx, id) {
  const p = await obtenerProyecto(id);
  if (!p || p.eliminadoEn) return vacio('Este proyecto no existe o está en la papelera.', '<a class="sis-btn" href="#/proyectos">Volver a Proyectos</a>');
  const [personas, equipos, certs, planes, seg, mono] = await Promise.all([listarPersonas(), Equipos.listarEquiposConEstado(), Equipos.certificadosDeProyecto(id), Vuelos.planesDeProyecto(id), Seguimiento.resumenDeProyecto(id), Monografias.resumenDeProyecto(id)]);
  const gas = await Gastos.resumenDeProyecto(id).catch(() => null);
  const hoy = hoyISO();
  const [cua, pla, archEnc, todosProy] = await Promise.all([
    Administracion.cuadrillaDeProyecto(p, { personas, hoy }).catch(() => null), Planificacion.resumenDeProyecto(id).catch(() => ({ redes: [], marcas: [] })),
    archivosDe('encargo', id).catch(() => []), listarProyectos(),
  ]);
  const lecc = cua ? Administracion.leccionesRelacionadas(p, todosProy, cua.d.mandantes) : [];
  const ents = (p.entregables || []).filter(x => !x.eliminado);
  const nomPers = pid => (personas.find(x => x.id === pid) || {}).nombre || '';
  const enProyecto = equipos.filter(e => e.ubicacion.lugar === 'terreno' && e.ubicacion.proyectoId === id);
  const esOficina = id === OFICINA_ID;
  // v0.17: proyecto propio del encargado (no lo encargó Jefatura): no aplica la calidad del encargo.
  const propio = !!(p.encargo && p.encargo.emitidoPor && p.encargo.emitidoPor === p.encargadoId);
  const plazo = p.plazo ? (() => { const d = diasEntre(hoyISO(), p.plazo); return `${fechaLegible(p.plazo)}${d >= 0 ? ` · faltan ${d} d` : ` · vencido hace ${-d} d`}`; })() : '';

  const meta = (t, v) => v ? `<span>${t}: <b>${v}</b></span>` : '';
  const certsHtml = certs.length ? `<div class="sis-lista">${certs.map(({ equipo, certificado }) => `<div class="sis-fila">
            <span class="sis-fila-txt"><b>${esc(equipo.nombre)}</b><span class="sis-tenue">${certificado ? `${esc(certificado.codigo || 'Certificado')} · ${fechaLegible(certificado.fecha)}${certificado.laboratorio ? ` · ${esc(certificado.laboratorio)}` : ''}` : 'Sin certificado cargado'}</span></span>
            ${certificado && certificado.archivoId ? `<button class="sis-btn chico" data-accion="abrir-pdf" data-id="${esc(certificado.archivoId)}">${ICONO.pdf}PDF</button>` : '<span class="sis-chip ambar">Falta PDF</span>'}
          </div>`).join('')}</div>
          <p class="sis-tenue">Para entregar al mandante los certificados de los equipos que están en este proyecto.</p>`
    : vacio('Cuando salgan equipos a este proyecto, aquí aparecen sus certificados vigentes.');

  return `<div class="sis-encabezado">
      <div>
        <div class="sis-miga"><a href="#/proyectos">Proyectos</a> / ${esc(p.nombre)}</div>
        <h1>${esc(p.nombre)}</h1>
        <div class="sis-meta">
          <span>Mandante: <b>${esc(p.mandante || (esOficina ? 'Trabajo que no es de un contrato' : '—'))}</b></span>
          ${esOficina ? '' : `${meta('Encargado', esc(nomPers(p.encargadoId)))}${meta('Ubicación', esc([p.comuna, p.region].filter(Boolean).join(', ')))}
          ${meta('Encargado por', esc(p.solicitadoPor || ''))}${meta('Encargo', p.fechaEncargo ? fechaLegible(p.fechaEncargo) : '')}${p.periodicidad && p.periodicidad.tipo === 'recurrente' ? meta('Periodicidad', esc(textoPeriodicidad(p.periodicidad).replace('Recurrente · ', ''))) : meta('Plazo', plazo)}`}
        </div>
        ${textosTipos(p).length ? `<div class="sis-chips" style="margin-top:10px">${textosTipos(p).map(t => `<span class="sis-chip gris">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="sis-acciones">${esOficina ? '<span class="sis-chip gris">Especial</span>' : `<span class="sis-chip ${p.estado === 'cerrado' ? 'gris' : 'verde'}">${p.estado === 'cerrado' ? 'Cerrado' : 'Activo'}</span>
        <a class="sis-btn chico" href="${ctx.rol === 'terreno' ? '#/proyecto-tecnico/' : '#/encargo/'}${esc(p.id)}">${ctx.rol === 'terreno' ? 'Datos técnicos' : 'Editar'}</a>`}</div>
    </div>
    ${esOficina ? '' : (() => { const et = etapaProyecto(p), iEt = ETAPAS_PROYECTO.findIndex(([k]) => k === et); return `<section class="sis-tarjeta sis-etapa-ficha"><div class="sis-etapas-pasos">${ETAPAS_PROYECTO.map(([k, t], i) => `<button type="button" class="sis-etapa-paso${i < iEt ? ' hecho' : i === iEt ? ' actual' : ''}" data-accion="etapa-proyecto" data-id="${esc(p.id)}" data-e="${k}" ${i === iEt ? 'aria-current="step"' : ''}><span>${i < iEt ? '✓' : i + 1}</span>${t}${p.etapas && p.etapas[k] ? `<small>${fechaLegible(p.etapas[k])}</small>` : ''}</button>`).join('')}</div></section>`; })()}
    ${esOficina ? '' : htmlAcuse(p, ctx, nomPers)}
    ${p.notas ? `<p class="sis-notas">${esc(p.notas)}</p>` : ''}
    ${!esOficina && ctx.rol === 'terreno' ? `<details class="tec-plan" ${etapaProyecto(p) === 'terreno' ? 'open' : ''}><summary class="tec-plan-tit"><span>Planificación técnica</span><small>${esc([`${trabajosDeProyecto(p).length} trabajo${trabajosDeProyecto(p).length === 1 ? '' : 's'}`, p.capas ? resumenCapas(p.capas) : 'sin capas'].filter(Boolean).join(' · '))}</small></summary>${htmlTrabajos(p, ctx, planes)}${htmlCapas(p, ctx)}</details>` : ''}
    <div class="sis-dos"><div>
      ${esOficina ? '' : `<section class="sis-tarjeta">
        <div class="sis-cab"><h2>${propio ? 'Datos del proyecto' : 'Ficha de encargo'}</h2>${ctx.rol === 'terreno' ? '' : `<a class="sis-btn chico" href="#/encargo/${esc(id)}">Editar</a>`}</div>
        <div class="sis-datos ad-encargo">
          <div class="sis-dato"><span>Mandante</span><b>${esc(cua && cua.mandante ? `${cua.mandante.nombre}${cua.mandante.plataforma ? ` · ${cua.mandante.plataforma}` : ''}` : (p.mandante || '—'))}</b></div>
          <div class="sis-dato"><span>Encargó</span><b>${esc([p.solicitadoPor, p.fechaEncargo && fechaLegible(p.fechaEncargo)].filter(Boolean).join(' · ') || '—')}</b></div>
          <div class="sis-dato"><span>Plazo</span><b>${esc(plazo || '—')}</b></div>
        </div>
        ${p.alcance ? `<p><b>Alcance:</b> ${esc(p.alcance)}</p>` : ''}${p.entregablesPedidos ? `<p><b>Entregables solicitados:</b> ${esc(p.entregablesPedidos)}</p>` : ''}
        ${!p.alcance && !p.entregablesPedidos ? `<p class="sis-tenue">Registre el alcance${ctx.rol === 'terreno' ? ' en «Datos técnicos»' : ' y los entregables solicitados en «Editar»'}. Se ingresa una sola vez y queda disponible para todo el proyecto.</p>` : ''}
        ${propio ? '' : htmlCalidad(p)}
        <div class="sis-cab" style="margin-top:8px"><h3 class="sis-sub">Archivos del mandante</h3><label class="sis-btn chico">+ Adjuntar<input type="file" data-accion="encargo-archivo" data-id="${esc(id)}" hidden></label></div>
        ${archEnc.length ? `<div class="sis-chips">${archEnc.map(a => `<button type="button" class="sis-btn chico" data-accion="abrir-pdf" data-id="${esc(a.id)}">${ICONO.pdf}${esc(a.nombre)}</button>`).join('')}</div>` : '<p class="sis-tenue">Bases técnicas, KMZ del área, planos o correos del encargo.</p>'}
      </section>
      ${htmlCronograma(p, nomPers, hoy)}
      ${ctx.rol === 'terreno' ? '' : htmlTrabajos(p, ctx, planes)}
      ${htmlBitacora(p, ctx, nomPers)}
      `}
      ${p.periodicidad && p.periodicidad.tipo === 'recurrente' ? (() => { const cs = ciclosEntre(p.periodicidad, hoyISO(), sumarDias(hoyISO(), 120)).slice(0, 3);
        return `<section class="sis-tarjeta"><div class="sis-cab"><h2>Próximos ciclos</h2><button class="sis-btn chico" data-accion="ver-calendario">▦ Calendario</button></div>
          ${cs.length ? `<div class="sis-lista">${cs.map(c => `<div class="sis-fila"><span class="sis-fila-txt"><b><span class="mono">${esc(c.numero)}</span> ${esc(c.nombre)}</b><span class="sis-tenue">Terreno ${fechaLegible(c.terreno[0])}${c.terreno[1] !== c.terreno[0] ? ` – ${fechaLegible(c.terreno[1])}` : ''} · datos ${fechaLegible(c.datos)} · entrega ${fechaLegible(c.entrega)}</span></span></div>`).join('')}</div>`
            : '<p class="sis-tenue">Sin ciclos en los próximos 4 meses: revisa la periodicidad (primer ciclo y término).</p>'}</section>`; })() : ''}
      <section class="sis-tarjeta">
        <div class="sis-cab"><h2>Vuelos</h2>${ctx.rol === 'terreno' ? `<a class="sis-btn chico" href="#/vuelos/proyecto/${esc(id)}">Planificación</a>` : ''}</div>
        ${planes.length ? `<div class="sis-vuelos-proy">${planes.map(v => `<article class="sis-vuelo-proy">
            <a class="sis-fila" href="#/vuelos/plan/${esc(v.id)}">
            <span class="sis-fila-txt"><b>${esc(v.nombre)}</b><span class="sis-tenue">${esc(v.dron)}</span></span>
            <span class="sis-chips">${v.resumen.area ? `<span class="sis-chip gris">${(v.resumen.area / 10000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} ha</span>` : ''}${v.resumen.gsd ? `<span class="sis-chip gris">GSD ${v.resumen.gsd.toLocaleString('es-CL', { maximumFractionDigits: 2 })} cm</span>` : ''}${v.resumen.densidad ? `<span class="sis-chip gris">${Math.round(v.resumen.densidad)} pts/m²</span>` : ''}${v.resumen.vuelos ? `<span class="sis-chip azul">${v.resumen.vuelos} batería${v.resumen.vuelos > 1 ? 's' : ''}</span>` : ''}</span></a>
            ${v.mapa || v.jornadas.length ? `<div class="sis-vuelo-proy-det">${v.mapa || ''}
              ${v.jornadas.length ? `<ol class="sis-jornadas">${v.jornadas.map((j, k) => `<li><i style="background: ${v.coloresDia[k]}"></i><span><b>Día ${j.dia}</b>${j.fecha ? ` <small>${esc(diaCorto(j.fecha))}</small>` : ''} · ${j.baterias} batería${j.baterias === 1 ? '' : 's'} · ${duracion(j.min)}<small>${esc(j.sectores)}${j.excede ? ' · no cabe en el horario' : ''}</small></span></li>`).join('')}</ol>` : ''}</div>` : ''}
          </article>`).join('')}</div>`
          : '<div class="sis-vacio"><p>Sin hojas de vuelo. Desde aquí se arma la hoja: área, plan de vuelo, clima y permisos.</p></div>'}
      </section>
      <section class="sis-tarjeta">
        <div class="sis-cab"><h2>Entregas</h2>${seg ? `<a class="sis-btn chico" href="#/seguimiento/${esc(id)}">Abrir</a>` : (ctx.rol === 'terreno' && !esOficina ? `<a class="sis-btn chico" href="#/seguimiento/${esc(id)}">+ Seguimiento</a>` : '')}</div>
        ${seg ? (() => { const c = seg.cuenta, pct = c.productos ? Math.round(100 * c.productosListos / c.productos) : 0; return `<p class="sis-tenue">${seg.ciclo ? esc(seg.ciclo.nombre || '') + ' · ' : ''}${c.total - c.sinvolar}/${c.total} tramos volados · ${c.productosListos}/${c.productos} productos · ${c.ok}/${c.total} entregados</p>
          <div class="sg-mini" style="margin-top:6px"><i style="width:${pct}%"></i></div>${seg.plazo ? `<p class="sis-tenue" style="margin-top:6px">Entrega: ${fechaLegible(seg.plazo.vence)}${seg.plazo.quedan >= 0 ? ` · quedan ${seg.plazo.quedan} días hábiles` : ` · vencida hace ${-seg.plazo.quedan} días hábiles`}</p>` : ''}`; })()
          : '<div class="sis-vacio"><p>Sin seguimiento. Sirve para llevar qué tramos están volados, procesados y entregados.</p></div>'}
      </section>
      ${esOficina ? '' : `<section class="sis-tarjeta">
        <div class="sis-cab"><h2>Monografías y terreno</h2>${ctx.rol === 'terreno' ? `<a class="sis-btn chico" href="#/monografias/${esc(id)}">Abrir</a>` : ''}</div>
        ${mono.total || mono.jornadas.length ? `<div class="sis-chips">${Object.entries(mono.porEstado).map(([e, n]) => `<span class="sis-chip ${ESTADOS_MONO[e].color}">${n} ${esc(ESTADOS_MONO[e].texto.toLowerCase())}</span>`).join('')}</div>
          <p class="sis-tenue" style="margin-top:6px">${mono.total} monografía${mono.total === 1 ? '' : 's'} · ${mono.jornadas.length} jornada${mono.jornadas.length === 1 ? '' : 's'} de terreno${mono.jornadas[0] && mono.jornadas[0].fechaInicio ? ` · última ${fechaLegible(String(mono.jornadas[0].fechaInicio).slice(0, 10))}` : ''}</p>`
          : '<div class="sis-vacio"><p>Llegan desde la app de Terreno: jornadas, fotos y monografías del proyecto (botón «Enviar al Sistema»).</p></div>'}
      </section>`}
      ${esOficina ? '' : `      <section class="sis-tarjeta">
        <div class="sis-cab"><h2>Planificación</h2>${ctx.rol === 'terreno' ? `<a class="sis-btn chico" href="#/planificacion/proyecto/${esc(id)}">Abrir</a>` : ''}</div>
        ${pla.redes.length || pla.marcas.length ? `<div class="sis-lista">${pla.redes.map(r => `<a class="sis-fila" href="#/planificacion/red/${esc(r.id)}"><span class="sis-fila-txt"><b>${esc(r.nombre || 'Red geodésica')}</b><span class="sis-tenue">${(r.puntos || []).filter(x => x.tipo !== 'control').length} PR · ${(r.vectores || []).length} vectores</span></span><span class="sis-chip gris">Red GNSS</span></a>`).join('')}${pla.marcas.map(r => `<a class="sis-fila" href="#/planificacion/marcas/${esc(r.id)}"><span class="sis-fila-txt"><b>${esc(r.nombre || 'Marcas de vuelo')}</b><span class="sis-tenue">${(r.marcas || []).length} marcas · ${r.modo === 'corredor' ? 'corredor' : 'área'}</span></span><span class="sis-chip gris">Marcas de vuelo</span></a>`).join('')}</div>`
          : '<div class="sis-vacio"><p>Sin planificación técnica. Desde Planificación se diseña la red de PR y la distribución de marcas de vuelo del proyecto.</p></div>'}
      </section>
      <section class="sis-tarjeta">
        <h2>Entregables</h2>
        ${ents.length ? `<div class="sis-tabla-scroll"><table class="sis-tabla"><thead><tr><th>Entregable</th><th>Versión</th><th>Revisó</th><th>Enviado al mandante</th><th>Estado</th><th></th></tr></thead><tbody>${ents.map(x => `<tr><td>${esc(x.nombre)}</td><td class="mono">${esc(x.version || '—')}</td><td>${esc(nomPers(x.revisoId) || '—')}</td><td class="mono">${x.enviado ? fechaLegible(x.enviado) : '—'}</td>
          <td><select data-accion="entregable-estado" data-id="${esc(id)}" data-e="${esc(x.id)}" aria-label="Estado de ${esc(x.nombre)}">${ESTADOS_ENTREGABLE.map(([k, t]) => `<option value="${k}" ${x.estado === k ? 'selected' : ''}>${t}</option>`).join('')}</select> ${chipEntregable(x.estado)}</td>
          <td><button type="button" class="sis-btn chico peligro" data-accion="entregable-quitar" data-id="${esc(id)}" data-e="${esc(x.id)}">Quitar</button></td></tr>`).join('')}</tbody></table></div>` : ''}
        <form class="sis-form" data-form="entregable" data-id="${esc(id)}"><div class="sis-par">
          <label class="sis-campo"><span>Entregable</span><input name="nombre" required placeholder="Informe de red, monografías, ortofoto…"></label>
          <label class="sis-campo"><span>Versión</span><input name="version" placeholder="Rev A, Rev 0…"></label>
          <label class="sis-campo"><span>Revisó</span><select name="revisoId"><option value="">—</option>${personas.map(x => `<option value="${esc(x.id)}">${esc(x.nombre)}</option>`).join('')}</select></label>
          <label class="sis-campo"><span>Enviado el</span><input type="date" name="enviado"></label></div>
          <div class="sis-acciones"><button class="sis-btn chico">Agregar entregable</button></div></form>
        <p class="sis-tenue">Registre cada versión enviada al mandante, quién la revisó y su estado. Al cerrar el proyecto se verifica que todos estén enviados o aprobados.</p>
      </section>
      ${['entregables', 'completado'].includes(etapaProyecto(p)) ? (() => {
        const autos = [
          ['Entregables enviados o aprobados', ents.length && ents.every(x => ['enviado', 'aprobado'].includes(x.estado))],
          ['Equipos devueltos (checklist de regreso)', !enProyecto.length],
          ['Gastos rendidos', !gas || (!gas.sinEnviar && !gas.porPagar)],
          ['Puntos registrados (monografías o red de PR)', mono.total > 0 || pla.redes.some(r => (r.puntos || []).length)],
        ];
        const ci = p.cierre || {};
        return `<section class="sis-tarjeta" id="cierre"><h2>Cierre del proyecto</h2>
          <p class="sis-tenue">Antes de cerrar el proyecto, verifique cada punto. Los ítems indicados como «automático» son validados por el sistema; los demás deben confirmarse manualmente.</p>
          <div class="sis-lista">${autos.map(([t, ok]) => `<div class="sis-fila"><span class="sis-fila-txt"><b>${t}</b></span><span class="sis-chips">${ok ? '<span class="sis-chip verde">Cumplido</span>' : '<span class="sis-chip ambar">Pendiente</span>'}<span class="sis-chip gris">Automático</span></span></div>`).join('')}
            <label class="sis-fila"><span class="sis-fila-txt"><b>Archivos ordenados en la nube de la empresa</b></span><span class="sis-chips"><input type="checkbox" data-accion="cierre-archivos" data-id="${esc(id)}" ${ci.archivos ? 'checked' : ''}> Confirmado</span></label></div>
          <form class="sis-form" data-form="cierre" data-id="${esc(id)}">
            <label class="sis-campo"><span>Lecciones aprendidas</span><textarea name="lecciones" rows="3" placeholder="Describa los problemas encontrados y las buenas prácticas a repetir. Esta información se mostrará al planificar proyectos en la misma zona o con el mismo mandante.">${esc(ci.lecciones || '')}</textarea></label>
            <div class="sis-acciones"><button class="sis-btn chico">Guardar lecciones</button></div></form></section>`;
      })() : ''}`}
    </div><aside>
      ${esOficina || !cua ? '' : `<section class="sis-tarjeta">
        <div class="sis-cab"><h2>Cuadrilla y vehículos</h2>${ctx.rol === 'terreno' ? '' : `<a class="sis-btn chico" href="#/encargo/${esc(id)}">Editar</a>`}</div>
        ${cua.mandante ? `<p class="sis-tenue">Acreditación según ${esc(cua.mandante.nombre)}${cua.mandante.plataforma ? ` (${esc(cua.mandante.plataforma)})` : ''}.</p>` : '<p class="sis-tenue">Sin mandante con requisitos: se muestra la habilitación general.</p>'}
        ${cua.gente.length ? `<div class="sis-lista">${cua.gente.map(g => `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(g.persona.nombre)}</b><span class="sis-tenue">${esc(g.persona.cargo || '')}${(ctx.rol !== 'direccion') && g.emergencia && g.emergencia.telefono ? ` · emergencia: ${esc(g.emergencia.nombre || '')} ${esc(g.emergencia.telefono)}` : ''}</span></span><span class="sis-chips">${g.ausente ? '<span class="sis-chip ambar">Ausente hoy</span>' : ''}${chipHab(g.h, cua.mandante && (cua.mandante.requisitosPersona || []).length ? 'Acreditado' : 'Habilitado', cua.mandante && (cua.mandante.requisitosPersona || []).length ? 'No acreditado' : 'No habilitado')}</span></div>`).join('')}</div>` : '<p class="sis-tenue">Sin cuadrilla asignada.</p>'}
        ${cua.vehiculos.length ? `<div class="sis-lista">${cua.vehiculos.map(x => `<div class="sis-fila"><span class="sis-fila-txt"><b class="mono">${esc(x.vehiculo.patente)}</b><span class="sis-tenue">${esc([x.vehiculo.marca, x.vehiculo.modelo].filter(Boolean).join(' '))}</span></span><span class="sis-chips">${chipHab(x.h, 'Acreditada', 'No acreditada')}</span></div>`).join('')}</div>` : ''}
        ${ctx.rol === 'terreno' ? '<p class="sis-tenue">El detalle de los documentos lo administra Recursos Humanos.</p>' : `<div class="sis-acciones"><a class="sis-btn chico" href="#/personal/carpeta-proyecto/${esc(id)}">Armar carpeta de arranque</a></div>`}
      </section>
      <section class="sis-tarjeta">
        <div class="sis-cab"><h2>Seguridad en terreno</h2><a class="sis-btn chico" href="#/seguridad/${esc(id)}">Abrir</a></div>
        ${(() => { const s = cua.seguridad, deHoy = s.filter(x => String(x.creadoEn || '').slice(0, 10) === hoy); return `<div class="sis-chips">${deHoy.some(x => x.tipo === 'charla') ? '<span class="sis-chip verde">Charla de hoy registrada</span>' : '<span class="sis-chip gris">Sin charla hoy</span>'}<span class="sis-chip gris">${s.filter(x => x.tipo === 'incidencia').length} incidencia(s)</span></div><p class="sis-tenue">Charla de 5 minutos, riesgos del día e incidencias, desde el teléfono o el computador.</p>`; })()}
      </section>`}
      ${lecc.length ? `<section class="sis-tarjeta"><h2>Lecciones de proyectos relacionados</h2><div class="sis-lista">${lecc.slice(0, 5).map(x => `<a class="sis-fila" href="#/proyecto/${esc(x.id)}"><span class="sis-fila-txt"><b>${esc(x.nombre)}</b><span>${esc(x.cierre.lecciones)}</span></span></a>`).join('')}</div></section>` : ''}
      <section class="sis-tarjeta">
        <h2>Equipos ${esOficina ? 'asignados' : 'en el proyecto'}</h2>
        ${enProyecto.length ? `<div class="sis-lista">${enProyecto.map(e => filaEquipo(e)).join('')}</div>`
          : vacio('No hay equipos asignados. Se asignan con el checklist de salida en Equipos.', '<a class="sis-btn chico" href="#/equipos">Ir a Equipos</a>')}
      </section>
      <section class="sis-tarjeta">
        <h2>Certificados para el mandante</h2>
        ${certsHtml}
      </section>
      <section class="sis-tarjeta">
        <div class="sis-cab"><h2>Gastos del proyecto</h2><a class="sis-btn chico" href="#/gastos/proyecto/${esc(id)}">${ctx.rol === 'rrhh' ? 'Rendiciones' : 'Abrir'}</a></div>
        ${gas && (gas.gastos || gas.depositos) ? `<div class="sis-datos">
            <div class="sis-dato"><span>Gastado</span><b class="mono">${clp(gas.gastado)}</b></div>
            <div class="sis-dato"><span>Fondo depositado</span><b class="mono">${clp(gas.depositos)}</b></div>
            ${gas.sinEnviar ? `<div class="sis-dato"><span>Sin enviar</span><b class="mono">${clp(gas.sinEnviar)}</b></div>` : ''}
            ${gas.porPagar ? `<div class="sis-dato"><span>Por pagar</span><b class="mono">${clp(gas.porPagar)}</b></div>` : ''}
          </div>
          <div class="sis-chips" style="margin-top:8px">${Object.entries(gas.porEstado).filter(([, n]) => n).map(([e, n]) => `<span class="sis-chip ${ESTADOS_GASTOS[e].color}">${n} ${e === 'borrador' ? 'con gastos sin enviar' : ESTADOS_GASTOS[e].texto.toLowerCase()}</span>`).join('')}</div>`
          : `<div class="sis-vacio"><p>Sin gastos todavía. Cada gasto se registra con la foto de su boleta y se rinde a RRHH.</p>${ctx.rol === 'terreno' ? `<a class="sis-btn chico" href="#/gastos/nuevo/${esc(id)}">+ Nuevo gasto</a>` : ''}</div>`}
      </section>
    </aside></div>`;
}
