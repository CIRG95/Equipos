// app/vistas.js — Avisos y las acciones (formularios, botones y cambios) de las pantallas propias del Sistema.
// v0.14.1: Inicio pasó a vistas-inicio.js, Proyectos a vistas-proyectos.js y las piezas comunes a vistas-ui.js.
// v0.16: «Encargar proyecto» está en vistas-encargo.js y la Configuración en vistas-config.js; Personas es del módulo Administración.
// Las pantallas de los módulos las pone cada módulo (montar()); aquí solo se leen sus datos por la puerta de entrada.

import { escapar as esc, fechaLegible, fechaHoraLegible, hoyISO, descargar, ahoraISO, leerTexto as leerLS, escribirTexto as escribirLS } from '../compartido/util.js';
import { enviarAPapelera, enPapelera, restaurar, eliminarDefinitivo } from '../compartido/papelera.js';
import { listarProyectos, obtenerProyecto, guardarProyecto, listarPersonas, obtenerPersona, guardarPersona, OFICINA_ID } from '../compartido/catalogos.js';
import * as Equipos from '../modulos/equipos/equipos.js';
import * as Gastos from '../modulos/gastos/gastos.js';
import { clp, ESTADOS as ESTADOS_GASTOS } from '../modulos/gastos/modelo.js';
import { mover as moverCalendario } from './calendario.js';
import { COLORES_MARCA, NOMBRE_ETAPA_PROYECTO } from './catalogo.js';
import { vacio } from './vistas-ui.js';
import { guardarArchivo } from '../compartido/archivos.js';
import { inicio, htmlFranjaProyectos } from './vistas-inicio.js';
import { proyectos, proyecto, datosRegistro } from './vistas-proyectos.js';
import { encargo, iniciarEncargo, leerEncargo } from './vistas-encargo.js';
import { configuracion, nuevoCodigo } from './vistas-config.js';
import { proyectoTecnico, leerTecnico } from './vistas-tecnico.js';
import { trabajosDeProyecto, moverTrabajo, cronogramaDeTrabajos, POR_BATERIAS } from './trabajos.js';
import { leerCapasDeArchivos, fusionarCapas, resumenCapas } from '../modulos/vuelos/capas-proyecto.js';
import * as Vuelos from '../modulos/vuelos/vuelos.js';
import { NOMBRE_CATEGORIA } from './catalogo.js';

export { htmlFranjaProyectos, nuevoCodigo };

const carpetaProyecto = p => `Proyectos/${String(p.nombre || 'Proyecto').replace(/[\\/:*?"<>|]+/g, '_')}`;
const idCorto = () => nuevoCodigo() + Date.now().toString(36);

// ─────────────────────────── Avisos de equipos ───────────────────────────
// Problemas y avisos de equipos en terreno. Los ve Administración / RRHH (todos) y el encargado del proyecto (los suyos).
// «Visto» es por persona y por equipo (localStorage): las notificaciones al teléfono quedan para más adelante.

const claveVistos = pid => `env_avisos_vistos_${pid || 'nadie'}`;
const leerVistos = pid => { try { return new Set(JSON.parse(localStorage.getItem(claveVistos(pid)) || '[]')); } catch { return new Set(); } };
const guardarVistos = (pid, set) => { try { localStorage.setItem(claveVistos(pid), JSON.stringify([...set].slice(-500))); } catch { /* */ } };

/** Avisos que le tocan a quien mira: { lista, nuevos }. */
export async function avisosPara(ctx) {
  const [alertas, proyectos] = await Promise.all([Equipos.listarAlertas(), listarProyectos()]);
  let lista;
  if (ctx.rol === 'rrhh') lista = alertas;
  else if (!ctx.personaId) lista = [];
  else {
    const mios = new Set(proyectos.filter(p => p.encargadoId === ctx.personaId).map(p => p.id));
    lista = alertas.filter(a => mios.has(a.proyectoId) || a.reportadaPor === ctx.personaId);
  }
  const vistos = leerVistos(ctx.personaId || ctx.rol);
  const gastos = await Gastos.avisos({ rol: ctx.rol, personaId: ctx.personaId }).catch(() => []);
  return { lista, gastos, nuevos: lista.filter(a => !vistos.has(a.id)).length + gastos.filter(a => !vistos.has(a.id)).length, vistos, proyectos };
}

/** v0.13: un módulo marca un aviso como visto (p. ej. Gastos al abrir la rendición). Devuelve true si era nuevo. */
export function marcarAvisoVisto(ctx, id) {
  const clave = ctx.personaId || ctx.rol, vistos = leerVistos(clave);
  if (vistos.has(id)) return false;
  vistos.add(id); guardarVistos(clave, vistos);
  return true;
}

async function avisos(ctx) {
  const { lista, gastos, vistos, proyectos } = await avisosPara(ctx);
  const personas = await listarPersonas();
  const nomPers = id => (personas.find(x => x.id === id) || {}).nombre || 'Sin nombre';
  const nomProy = id => id === OFICINA_ID ? 'Oficina' : (proyectos.find(x => x.id === id) || {}).nombre || 'Sin proyecto';
  const ESTADO = { abierta: 'Abierta', mantencion: 'En mantención', recibida: 'Recibida' };
  guardarVistos(ctx.personaId || ctx.rol, new Set([...vistos, ...lista.map(a => a.id), ...gastos.map(a => a.id)]));
  const textoGasto = a => a.tipo === 'enviada' ? `Enviada por ${esc(nomPers(a.rendicion.personaId))} · ${clp(a.evento.total)}`
    : a.tipo === 'devuelta' ? `Devuelta por RRHH: «${esc(a.evento.motivo)}»` : a.evento.monto ? `Pagada: ${clp(a.evento.monto)} el ${fechaLegible(a.evento.fecha)}` : `Cerrada el ${fechaLegible(a.evento.fecha)}`;
  const seccionGastos = gastos.length ? `<h2 class="sis-sub">Rendiciones de gastos</h2><section class="sis-tarjeta"><div class="sis-lista">${gastos.map(a => `<a class="sis-fila${vistos.has(a.id) ? '' : ' sis-nuevo'}" href="#/gastos/rendicion/${esc(a.rendicion.id)}">
        <span class="sis-fila-txt"><b>Rendición N° ${a.rendicion.numero} · ${esc(nomProy(a.rendicion.proyectoId))}</b><span>${textoGasto(a)}</span><span class="sis-tenue">${esc(fechaHoraLegible(a.evento.creadoEn))}</span></span>
        <span class="sis-chips">${vistos.has(a.id) ? '' : '<span class="sis-chip azul">Nuevo</span>'}<span class="sis-chip ${ESTADOS_GASTOS[a.tipo].color}">${ESTADOS_GASTOS[a.tipo].texto}</span></span></a>`).join('')}</div></section>` : '';
  return `<div class="sis-cab"><h1>Avisos</h1></div>${seccionGastos}
    ${gastos.length ? '<h2 class="sis-sub">Equipos</h2>' : ''}<p class="sis-tenue">${ctx.rol === 'rrhh' ? 'Problemas y avisos de todos los equipos.' : 'Problemas y avisos de equipos en tus proyectos (donde eres el encargado).'} Llegan desde la app de Terreno por la nube. Los estados se cambian en Equipos → Alertas.</p>
    ${ctx.rol !== 'rrhh' && !ctx.personaId ? vacio('Elige quién eres arriba para ver los avisos de tus proyectos.') : ''}
    <section class="sis-tarjeta">${lista.length ? `<div class="sis-lista">${lista.map(a => `<a class="sis-fila${vistos.has(a.id) ? '' : ' sis-nuevo'}" href="#/equipos/${esc(a.equipoId)}">
        <span class="sis-fila-txt"><b>${esc(a.equipo)}</b><span>${esc(a.descripcion || '')}</span>
          <span class="sis-tenue">${esc(nomProy(a.proyectoId))} · ${esc(nomPers(a.reportadaPor))} · ${esc(fechaHoraLegible(a.fechaReporte))}${a.origen === 'app-terreno' ? ' · desde Terreno' : ''}</span></span>
        <span class="sis-chips">${vistos.has(a.id) ? '' : '<span class="sis-chip azul">Nuevo</span>'}<span class="sis-chip ${a.tipo === 'aviso' ? 'ambar' : 'rojo'}">${a.tipo === 'aviso' ? 'Aviso' : 'Problema'}</span><span class="sis-chip gris">${esc(ESTADO[a.estado] || a.estado)}</span></span></a>`).join('')}</div>`
      : vacio('No hay avisos abiertos.')}</section>`;
}

export const VISTAS = { inicio, proyectos, proyecto, encargo, proyectoTecnico, configuracion, avisos };
/** Comportamiento en vivo que algunas pantallas inician después de pintarse. */
export const AL_PINTAR = { encargo: iniciarEncargo, proyecto: iniciarArrastreTrabajos };

/** v0.17 · Trabajos del proyecto: arrastrar una fila para cambiar el orden (computador). */
function iniciarArrastreTrabajos(raiz, ctx) {
  const lista = raiz.querySelector('.tr-lista');
  if (!lista) return;
  let desde = null;
  lista.addEventListener('dragstart', ev => { const f = ev.target.closest('[data-trabajo-i]'); if (!f) return; desde = Number(f.dataset.trabajoI); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', String(desde)); f.classList.add('llevando'); });
  lista.addEventListener('dragend', () => { desde = null; lista.querySelectorAll('.llevando, .sobre').forEach(x => x.classList.remove('llevando', 'sobre')); });
  lista.addEventListener('dragover', ev => { const f = ev.target.closest('[data-trabajo-i]'); if (!f || desde == null) return; ev.preventDefault(); lista.querySelectorAll('.sobre').forEach(x => x !== f && x.classList.remove('sobre')); f.classList.add('sobre'); });
  lista.addEventListener('drop', async ev => {
    const f = ev.target.closest('[data-trabajo-i]');
    if (!f || desde == null) return;
    ev.preventDefault();
    const a = desde, b = Number(f.dataset.trabajoI);
    desde = null;
    if (a === b) return;
    await guardarTrabajos(f.dataset.id, ts => moverTrabajo(ts, a, b), ctx);
    ctx.avisar('Orden de los trabajos actualizado');
    ctx.repintar();
  });
}

async function guardarTrabajos(id, cambiar, ctx) {
  const p = await obtenerProyecto(id);
  if (!p) return null;
  const ts = cambiar(trabajosDeProyecto(p));
  await guardarProyecto({ id: p.id, trabajos: ts.map(({ cat, dias, paralelo }) => ({ cat, dias, paralelo: !!paralelo })) }, { personaId: ctx.personaId });
  return ts;
}

// ─────────────────────────── Acciones ───────────────────────────

/** Formularios y botones de las pantallas del Sistema. Devuelve true si hay que volver a pintar. */
export async function manejarEnvio(form, ctx) {
  const datos = new FormData(form);
  if (form.dataset.form === 'persona-rapida') {
    const p = await guardarPersona({ nombre: datos.get('nombre').trim(), cargo: (datos.get('cargo') || '').trim(), roles: [ctx.rol === 'rrhh' ? 'rrhh' : ctx.rol === 'direccion' ? 'direccion' : 'encargado'] }, { personaId: ctx.personaId });
    await ctx.usarPersona(p.id);
    ctx.avisar('Persona creada');
    return true;
  }
  if (form.dataset.form === 'terreno-url') {
    const u = (datos.get('url') || '').trim();
    try { if (u) { new URL(u); localStorage.setItem('env_terreno_url', u); } else localStorage.removeItem('env_terreno_url'); } catch { throw new Error('La dirección debe empezar con https://'); }
    ctx.avisar('Dirección guardada');
    return true;
  }
  if (form.dataset.form === 'empresa') {
    await ctx.cambiarMarca({ nombre: (datos.get('nombre') || '').trim() || 'Topoland', color: datos.get('color') || COLORES_MARCA[0][0] });
    ctx.avisar('Marca guardada');
    return true;
  }
  if (form.dataset.form === 'encargo') {
    const id = form.dataset.id || undefined;
    const d = leerEncargo(form);
    if (!d.nombre) throw new Error('Indique el nombre del proyecto (paso 1).');
    const previo = id ? await obtenerProyecto(id) : null;
    const ahora = ahoraISO();
    const enc = { ...((previo && previo.encargo) || {}), ...d.encargo };
    // Encargo nuevo, o cambio de encargado: se emite a nombre de quien lo registra y queda a la espera del acuse de recibo.
    if (!previo || (previo.encargadoId || null) !== d.encargadoId) {
      enc.emitidoPor = ctx.personaId || null; enc.emitidoEn = ahora;
      const propio = !d.encargadoId || d.encargadoId === ctx.personaId;
      enc.recibidoPor = propio ? (ctx.personaId || null) : null; enc.recibidoEn = propio ? ahora : null;
    }
    // Las actividades conservan su marca de «realizada» aunque se editen las fechas.
    const hechas = new Map(((previo && previo.cronograma) || []).map(a => [a.id, a]));
    const cronograma = d.cronograma.map(a => ({ ...a, hecho: hechas.has(a.id) ? !!hechas.get(a.id).hecho : a.hecho, hechoEn: hechas.has(a.id) ? hechas.get(a.id).hechoEn || null : null }));
    const r = await guardarProyecto({ id, ...d, cronograma, encargo: enc, estado: d.estado || (previo && previo.estado) || 'activo' }, { personaId: ctx.personaId });
    const archivos = [...(form.querySelector('[name="archivos"]').files || [])];
    for (const f of archivos) await guardarArchivo(f, { modulo: 'proyectos', duenoTipo: 'encargo', duenoId: r.id, rol: 'documento', proyectoId: r.id, carpeta: `${carpetaProyecto(r)}/Encargo` }, { personaId: ctx.personaId });
    ctx.avisar(id ? 'Encargo guardado' : (enc.recibidoEn ? 'Proyecto creado' : 'Proyecto encargado: el encargado recibirá el aviso'));
    ctx.ir(`#/proyecto/${r.id}`);
    return false;
  }
  if (form.dataset.form === 'proyecto-tecnico') {
    const id = form.dataset.id || undefined;
    const previo = id ? await obtenerProyecto(id) : null;
    const deJefatura = !!(previo && previo.encargo && previo.encargo.emitidoPor && previo.encargo.emitidoPor !== ctx.personaId);
    const d = leerTecnico(form, { deJefatura });
    if (!deJefatura && !d.nombre) throw new Error('Indique el nombre del proyecto.');
    const ahora = ahoraISO();
    const extra = previo ? {} : {
      estado: 'activo', fechaEncargo: hoyISO(), encargadoId: ctx.personaId || null, cuadrilla: ctx.personaId ? [ctx.personaId] : [],
      encargo: { info: {}, prioridad: 'normal', emitidoPor: ctx.personaId || null, emitidoEn: ahora, recibidoPor: ctx.personaId || null, recibidoEn: ahora },
    };
    const archivos = [...(form.querySelector('[name="capas"]').files || [])];
    if (archivos.length) { const leidas = await leerCapasDeArchivos(archivos); extra.capas = fusionarCapas(previo && previo.capas, leidas); }
    const r = await guardarProyecto({ id, ...d, ...extra }, { personaId: ctx.personaId });
    ctx.avisar(previo ? 'Datos técnicos guardados' : `Proyecto creado${extra.capas ? ` · capas: ${resumenCapas(extra.capas)}` : ''}`);
    ctx.ir(`#/proyecto/${r.id}`);
    return false;
  }
  if (form.dataset.form === 'bitacora') {
    const p = await obtenerProyecto(form.dataset.id);
    const texto = (datos.get('texto') || '').trim();
    if (!p || !texto) return false;
    const e = { id: idCorto(), tipo: datos.get('tipo') || 'acuerdo', texto, por: ctx.personaId || null, en: ahoraISO() };
    await guardarProyecto({ id: p.id, bitacora: [...(p.bitacora || []), e] }, { personaId: ctx.personaId });
    ctx.avisar('Registro agregado a la bitácora'); return true;
  }
  if (form.dataset.form === 'bitacora-responder') {
    const p = await obtenerProyecto(form.dataset.id);
    const respuesta = (datos.get('respuesta') || '').trim();
    if (!p || !respuesta) return false;
    await guardarProyecto({ id: p.id, bitacora: (p.bitacora || []).map(b => (b.id === form.dataset.b ? { ...b, respuesta, respondidoPor: ctx.personaId || null, respondidoEn: ahoraISO() } : b)) }, { personaId: ctx.personaId });
    ctx.avisar('Respuesta registrada'); return true;
  }
  if (form.dataset.form === 'entregable') {
    const p = await obtenerProyecto(form.dataset.id);
    const e = { id: idCorto(), nombre: (datos.get('nombre') || '').trim(), version: (datos.get('version') || '').trim(), revisoId: datos.get('revisoId') || null, enviado: datos.get('enviado') || '', estado: datos.get('enviado') ? 'enviado' : 'pendiente' };
    await guardarProyecto({ id: p.id, entregables: [...(p.entregables || []), e] }, { personaId: ctx.personaId });
    ctx.avisar('Entregable agregado'); return true;
  }
  if (form.dataset.form === 'cierre') {
    const p = await obtenerProyecto(form.dataset.id);
    await guardarProyecto({ id: p.id, cierre: { ...(p.cierre || {}), lecciones: (datos.get('lecciones') || '').trim(), fecha: hoyISO() } }, { personaId: ctx.personaId });
    ctx.avisar('Lecciones guardadas'); return true;
  }
  return false;
}

export async function manejarClic(boton, ctx) {
  const cal = () => (ctx.estado.cal = ctx.estado.cal || { modo: leerLS('env_cal_modo') || 'mes', ref: hoyISO(), proyecto: '' });
  switch (boton.dataset.accion) {
    case 'vista-proyectos': escribirLS('env_proyectos_vista2', boton.dataset.v); return true;
    case 'ver-calendario': cal().proyecto = location.hash.split('/')[2] || ''; ctx.ir('#/proyectos/calendario'); return false;
    case 'ver-mandante': ctx.estado.mandante = boton.dataset.m; return true;
    case 'exportar-registro': {
      const filas = await datosRegistro();
      const c = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [['Mandante', 'Proyecto', 'Comuna', 'Región', 'Tipos', 'Encargo', 'Cierre', 'Plazo (días)', 'Vuelos', 'Superficie (ha)', 'Longitud (km)'].map(c).join(';'),
        ...filas.sort((a, b) => a.mandante.localeCompare(b.mandante) || (a.fin || '').localeCompare(b.fin || '')).map(f => [f.mandante, f.p.nombre, f.p.comuna, f.p.region, f.tipos, f.ini, f.fin, f.dias, f.vuelos, f.ha.toFixed(1).replace('.', ','), f.km.toFixed(2).replace('.', ',')].map(c).join(';'))].join('\r\n');
      descargar(`Registro_por_mandante_${hoyISO()}.csv`, '\ufeff' + csv, 'text/csv;charset=utf-8');
      ctx.avisar('Registro exportado'); return false;
    }
    case 'etapa-proyecto': {
      const p = await obtenerProyecto(boton.dataset.id), e = boton.dataset.e;
      if (!p || !NOMBRE_ETAPA_PROYECTO[e]) return false;
      if (e === 'completado' && !confirm(`¿Marcar «${p.nombre}» como completado?\n\nSale de los proyectos activos y queda en el registro de ${p.mandante || 'su mandante'}.`)) return false;
      await guardarProyecto({ id: p.id, etapa: e, etapas: { ...(p.etapas || {}), [e]: hoyISO() }, estado: e === 'completado' ? 'cerrado' : 'activo' }, { personaId: ctx.personaId });
      ctx.avisar(`${p.nombre}: ${NOMBRE_ETAPA_PROYECTO[e].toLowerCase()}`);
      return true;
    }
    case 'cal-modo': cal().modo = boton.dataset.modo; escribirLS('env_cal_modo', boton.dataset.modo); return true;
    case 'cal-mover': cal().ref = moverCalendario(cal(), Number(boton.dataset.d)); return true;
    case 'cal-ir': cal().ref = boton.dataset.ref; if (boton.dataset.modo) cal().modo = boton.dataset.modo; return true;
    case 'abrir-pdf': await Equipos.abrirArchivo(boton.dataset.id); return false;
    case 'vincular': case 'nuevo-codigo': {
      const p = await obtenerPersona(boton.dataset.id);
      if (p && (!p.codigoVinculo || boton.dataset.accion === 'nuevo-codigo')) await guardarPersona({ id: p.id, codigoVinculo: nuevoCodigo() }, { personaId: ctx.personaId });
      if (boton.dataset.accion === 'nuevo-codigo') ctx.avisar('Código cambiado: el anterior ya no sirve');
      ctx.estado.vincular = boton.dataset.id; return true;
    }
    case 'cerrar-vincular': ctx.estado.vincular = null; return true;
    case 'modo-pantalla': ctx.fijarModo(boton.dataset.m); return true;
    case 'trabajo-mover': {
      const i = Number(boton.dataset.i), a = Number(boton.dataset.a);
      await guardarTrabajos(boton.dataset.id, ts => moverTrabajo(ts, i, i + a), ctx);
      return true;
    }
    case 'aplicar-trabajos': {
      const p = await obtenerProyecto(boton.dataset.id);
      if (!p) return false;
      const planes = await Vuelos.planesDeProyecto(p.id).catch(() => []);
      const dv = planes.reduce((s, v) => s + (v.programadas || 0), 0);
      const nuevo = cronogramaDeTrabajos(trabajosDeProyecto(p), p.fechaInicio || p.fechaEncargo, { diasDe: t => (POR_BATERIAS.has(t.cat) && dv ? dv : t.dias), nombre: c => NOMBRE_CATEGORIA[c] || c, plazo: p.plazo });
      if (!nuevo.length) return false;
      const previas = p.cronograma || [];
      // Se conservan las actividades ya realizadas; las pendientes se reemplazan por el orden de los trabajos.
      if (previas.some(a => !a.hecho) && !confirm('¿Reemplazar las actividades pendientes del cronograma por las de los trabajos ordenados? Las ya realizadas se conservan.')) return false;
      const hechas = previas.filter(a => a.hecho);
      await guardarProyecto({ id: p.id, cronograma: [...hechas, ...nuevo.filter(n => !hechas.some(h => h.id === n.id))] }, { personaId: ctx.personaId });
      ctx.avisar('Cronograma actualizado con el orden de los trabajos'); return true;
    }
    case 'capas-quitar': {
      if (!confirm('¿Quitar las capas del proyecto (caminos y PR)? Las hojas de vuelo dejan de proponer bases de amarre.')) return false;
      await guardarProyecto({ id: boton.dataset.id, capas: null }, { personaId: ctx.personaId });
      ctx.avisar('Capas quitadas'); return true;
    }
    case 'abrir-nube': ctx.abrirNube(); return false;
    case 'acusar-recibo': {
      const p = await obtenerProyecto(boton.dataset.id);
      if (!p) return false;
      await guardarProyecto({ id: p.id, encargo: { ...(p.encargo || {}), recibidoPor: ctx.personaId || null, recibidoEn: ahoraISO() } }, { personaId: ctx.personaId });
      ctx.avisar('Recepción del encargo confirmada'); return true;
    }
    case 'info-entregada': {
      const p = await obtenerProyecto(boton.dataset.id);
      if (!p) return false;
      const enc = p.encargo || {};
      await guardarProyecto({ id: p.id, encargo: { ...enc, info: { ...(enc.info || {}), [boton.dataset.k]: 'si' } } }, { personaId: ctx.personaId });
      ctx.avisar('Información marcada como entregada'); return true;
    }
    case 'bitacora-confirmar': {
      const p = await obtenerProyecto(boton.dataset.id);
      if (!p) return false;
      await guardarProyecto({ id: p.id, bitacora: (p.bitacora || []).map(b => (b.id === boton.dataset.b ? { ...b, confirmadoPor: ctx.personaId || null, confirmadoEn: ahoraISO() } : b)) }, { personaId: ctx.personaId });
      ctx.avisar('Instrucción confirmada'); return true;
    }
    case 'entregable-quitar': {
      const p = await obtenerProyecto(boton.dataset.id);
      if (!confirm('¿Quitar este entregable?')) return false;
      await guardarProyecto({ id: p.id, entregables: (p.entregables || []).filter(x => x.id !== boton.dataset.e) }, { personaId: ctx.personaId });
      return true;
    }
    case 'eliminar-proyecto': {
      const p = await obtenerProyecto(boton.dataset.id);
      if (!p || p.id === OFICINA_ID) return false;
      const enUso = (await Equipos.listarEquiposConEstado()).filter(e => e.ubicacion.lugar === 'terreno' && e.ubicacion.proyectoId === p.id);
      if (enUso.length) {
        alert(`No se puede eliminar «${p.nombre}»: tiene ${enUso.length} equipo${enUso.length > 1 ? 's' : ''} en terreno. Primero registra su regreso o traspaso en Equipos.`);
        return false;
      }
      if (!confirm(`¿Eliminar el proyecto «${p.nombre}»?\n\nVa a la papelera y se puede restaurar desde Proyectos.`)) return false;
      await enviarAPapelera('compartido_proyectos', p.id, { personaId: ctx.personaId });
      ctx.avisar('Proyecto eliminado');
      ctx.ir('#/proyectos');
      return false;
    }
    case 'purgar-proyecto':
      if (!confirm(`¿Eliminar definitivamente «${boton.dataset.nombre}»?\n\nSe borra con sus archivos y no se puede deshacer.`)) return false;
      await eliminarDefinitivo('compartido_proyectos', boton.dataset.id, { personaId: ctx.personaId });
      ctx.avisar('Proyecto eliminado definitivamente');
      return true;
    case 'vaciar-papelera-proyectos': {
      const lista = await enPapelera('compartido_proyectos');
      if (!confirm(`¿Eliminar definitivamente los ${lista.length} proyectos de la papelera?\n\nNo se puede deshacer.`)) return false;
      for (const x of lista) await eliminarDefinitivo('compartido_proyectos', x.registro.id, { personaId: ctx.personaId });
      ctx.avisar('Papelera vaciada');
      return true;
    }
    case 'restaurar-proyecto':
      await restaurar('compartido_proyectos', boton.dataset.id, { personaId: ctx.personaId });
      ctx.avisar('Proyecto restaurado');
      return true;
    case 'cerrar-proyecto': {
      const p = await obtenerProyecto(boton.dataset.id);
      await guardarProyecto(p.estado === 'cerrado' ? { id: p.id, estado: 'activo', etapa: 'gabinete' } : { id: p.id, estado: 'cerrado', etapa: 'completado', etapas: { ...(p.etapas || {}), completado: hoyISO() } }, { personaId: ctx.personaId });
      ctx.avisar(p.estado === 'cerrado' ? 'Proyecto reabierto' : 'Proyecto cerrado');
      ctx.ir(`#/proyecto/${p.id}`);
      return false;
    }
  }
  return false;
}

export async function manejarCambio(input, ctx) {
  if (input.dataset.accion === 'ver-cerrados') { ctx.estado.verCerrados = input.checked; return true; }
  if (input.dataset.accion === 'trabajo-dias' || input.dataset.accion === 'trabajo-paralelo') {
    const i = Number(input.dataset.i);
    await guardarTrabajos(input.dataset.id, ts => ts.map((t, k) => (k !== i ? t : input.dataset.accion === 'trabajo-dias' ? { ...t, dias: Math.max(1, Math.round(Number(input.value) || 1)) } : { ...t, paralelo: input.checked })), ctx);
    return true;
  }
  if (input.dataset.accion === 'capa-pr-usar') {
    const p = await obtenerProyecto(input.dataset.id);
    if (!p || !p.capas) return false;
    await guardarProyecto({ id: p.id, capas: { ...p.capas, prs: p.capas.prs.map(x => (x.id === input.dataset.pr ? { ...x, usar: input.checked } : x)) } }, { personaId: ctx.personaId });
    return true;
  }
  if (input.dataset.accion === 'capas-cargar' && input.files && input.files.length) {
    const p = await obtenerProyecto(input.dataset.id);
    if (!p) return false;
    const leidas = await leerCapasDeArchivos(input.files);
    if (!leidas.prs.length && !leidas.caminos.length) { ctx.avisar('El archivo no trae líneas ni puntos.'); return false; }
    const capas = fusionarCapas(p.capas, leidas);
    await guardarProyecto({ id: p.id, capas }, { personaId: ctx.personaId });
    ctx.avisar(`Capas del proyecto: ${resumenCapas(capas)}`); return true;
  }
  if (input.dataset.accion === 'crono-hecho') {
    const p = await obtenerProyecto(input.dataset.id);
    if (!p) return false;
    await guardarProyecto({ id: p.id, cronograma: (p.cronograma || []).map(a => (a.id === input.dataset.a ? { ...a, hecho: input.checked, hechoEn: input.checked ? hoyISO() : null, hechoPor: input.checked ? (ctx.personaId || null) : null } : a)) }, { personaId: ctx.personaId });
    return true;
  }
  if (input.dataset.accion === 'entregable-estado') {
    const p = await obtenerProyecto(input.dataset.id);
    await guardarProyecto({ id: p.id, entregables: (p.entregables || []).map(x => (x.id === input.dataset.e ? { ...x, estado: input.value, enviado: input.value === 'enviado' && !x.enviado ? hoyISO() : x.enviado } : x)) }, { personaId: ctx.personaId });
    return true;
  }
  if (input.dataset.accion === 'cierre-archivos') {
    const p = await obtenerProyecto(input.dataset.id);
    await guardarProyecto({ id: p.id, cierre: { ...(p.cierre || {}), archivos: input.checked } }, { personaId: ctx.personaId });
    return true;
  }
  if (input.dataset.accion === 'encargo-archivo') {
    const f = input.files && input.files[0];
    if (!f) return false;
    const p = await obtenerProyecto(input.dataset.id);
    await guardarArchivo(f, { modulo: 'proyectos', duenoTipo: 'encargo', duenoId: p.id, rol: 'documento', proyectoId: p.id, carpeta: `${carpetaProyecto(p)}/Encargo` }, { personaId: ctx.personaId });
    ctx.avisar('Archivo adjuntado'); return true;
  }
  if (input.dataset.accion === 'cal-proyecto') { ctx.estado.cal = { ...(ctx.estado.cal || { modo: 'mes', ref: hoyISO() }), proyecto: input.value }; return true; }
  return false;
}

export { obtenerPersona };
