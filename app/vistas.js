// app/vistas.js — pantallas propias del Sistema: Inicio, Proyectos, Personas y «Próximamente».
// Las pantallas de Equipos las pone el propio módulo (montar()); aquí solo se leen sus datos por la puerta de entrada.

import { escapar as esc, fechaLegible, fechaHoraLegible, hoyISO, diasEntre, cargarScript, descargar } from '../compartido/util.js';
import { resolverUrlTerreno } from './url-terreno.js';
import { estado as estadoNube } from '../compartido/nube.js';
import { enviarAPapelera, enPapelera, restaurar } from '../compartido/papelera.js';
import {
  listarProyectos, obtenerProyecto, guardarProyecto, listarPersonas, obtenerPersona, guardarPersona, OFICINA_ID,
} from '../compartido/catalogos.js';
import * as Equipos from '../modulos/equipos/equipos.js';
import * as Vuelos from '../modulos/vuelos/vuelos.js';
import * as Seguimiento from '../modulos/seguimiento/seguimiento.js';
import * as Monografias from '../modulos/monografias/monografias.js';
import { vistaCalendario, mover as moverCalendario, eventosEntre } from './calendario.js';
import { BASE_RECURRENTE, SEMANAS, DATOS, ciclosEntre, textoPeriodicidad, sumarDias, restarHabiles } from '../compartido/periodicidad.js';
import { ESTADOS as ESTADOS_MONO } from '../modulos/monografias/datos.js';
import { ROLES, COLORES_MARCA, CATEGORIAS_TRABAJO, NOMBRE_CATEGORIA, tiposDeProyecto, textosTipos, ROLES_PERSONA, NOMBRE_ROL_PERSONA, REGIONES, ETAPAS_PROYECTO, NOMBRE_ETAPA_PROYECTO, etapaProyecto } from './catalogo.js';
import { VERSION_SISTEMA } from './version.js';

const ICONO = {
  equipo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11"/><path d="M5 21l7-7 7 7"/><circle cx="12" cy="3" r="1.5"/></svg>',
  alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4"/><path d="M12 17.5v.5"/></svg>',
  calib: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  proyecto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h6l2 2h10v10H3z"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/></svg>',
};

const nivelCal = {
  vencida: c => `<span class="sis-chip rojo">Calibración vencida hace ${-c.dias} d</span>`,
  por_vencer: c => `<span class="sis-chip ambar">Calibración vence en ${c.dias} d</span>`,
  sin_dato: () => '<span class="sis-chip ambar">Falta fecha de calibración</span>',
  ok: c => `<span class="sis-chip verde">Calibración al día · ${fechaLegible(c.proxima)}</span>`,
  no_aplica: () => '<span class="sis-chip gris">No requiere calibración</span>',
};
const chipCal = c => (nivelCal[c.nivel] || nivelCal.sin_dato)(c);
const chipAlertas = n => n ? `<span class="sis-chip rojo">${n} alerta${n > 1 ? 's' : ''} abierta${n > 1 ? 's' : ''}</span>` : '';
const LUGAR = { oficina: 'En oficina', terreno: 'En terreno', mantencion: 'En mantención', baja: 'De baja' };

function filaEquipo(e, { nombreProyecto } = {}) {
  const lugar = e.ubicacion.lugar === 'terreno' && nombreProyecto
    ? `<span class="sis-chip azul">${esc(nombreProyecto(e.ubicacion.proyectoId))}</span>`
    : `<span class="sis-chip gris">${LUGAR[e.ubicacion.lugar] || ''}</span>`;
  return `<a class="sis-fila" href="#/equipos/${esc(e.id)}">
    <span class="sis-fila-txt"><b>${esc(e.nombre)}</b><span class="sis-tenue">${esc([e.equipo, e.numeroSerie && `N° ${e.numeroSerie}`].filter(Boolean).join(' · '))}</span></span>
    <span class="sis-chips">${lugar}${chipCal(e.calibracion)}${chipAlertas(e.alertasActivas.length)}</span>
  </a>`;
}

const vacio = (texto, extra = '') => `<div class="sis-vacio"><p>${texto}</p>${extra}</div>`;

// ─────────────────────────── Inicio ───────────────────────────

async function inicio(ctx) {
  const [personas, proyectos, equipos] = await Promise.all([listarPersonas(), listarProyectos(), Equipos.listarEquiposConEstado()]);
  const yo = ctx.personaId ? personas.find(p => p.id === ctx.personaId) : null;
  const nomProy = id => (proyectos.find(p => p.id === id) || {}).nombre || (id === OFICINA_ID ? 'Oficina' : 'Proyecto');

  let bienvenida = '';
  if (!personas.length || !yo) {
    bienvenida = `<section class="sis-tarjeta sis-destacada">
      <h2>${personas.length ? 'Elige quién eres' : 'Primero, crea tu persona'}</h2>
      <p>El Sistema anota quién hace cada cosa (salidas, alertas, abonos). ${personas.length ? 'Elígete arriba, en la lista de personas, o crea tu ficha aquí.' : 'Crea tu ficha para empezar; después RRHH puede agregar al resto del equipo en «Personas».'}</p>
      <form class="sis-form-linea" data-form="persona-rapida">
        <input name="nombre" placeholder="Tu nombre" required aria-label="Nombre">
        <input name="cargo" placeholder="Cargo (geomensor, RRHH…)" aria-label="Cargo">
        <button class="sis-btn primario">Crear y usar</button>
      </form>
    </section>`;
  }

  const activos = proyectos.filter(p => p.id !== OFICINA_ID && p.estado !== 'cerrado');
  const saludo = `<div class="sis-saludo">
      <h1>${yo ? `Hola, ${esc(yo.nombre.split(' ')[0])}` : 'Inicio'}</h1>
      <span class="sis-tenue">${ROLES[ctx.rol]} · Sistema v${VERSION_SISTEMA} · ${fechaLegible(hoyISO())}</span>
    </div>`;

  if (ctx.rol === 'rrhh') {
    const vigentes = equipos;
    const vencidas = vigentes.filter(e => e.calibracion.nivel === 'vencida');
    const porVencer = vigentes.filter(e => e.calibracion.nivel === 'por_vencer');
    const sinDato = vigentes.filter(e => e.calibracion.nivel === 'sin_dato');
    const conAlerta = vigentes.filter(e => e.alertasActivas.length);
    const enTerreno = vigentes.filter(e => e.ubicacion.lugar === 'terreno');
    const porProyecto = {};
    for (const e of enTerreno) (porProyecto[e.ubicacion.proyectoId] ||= []).push(e);

    const revisar = [...vencidas, ...porVencer, ...sinDato];
    return `${saludo}${bienvenida}
      <div class="sis-kpis">
        <a class="sis-kpi ${vencidas.length ? 'rojo' : ''}" href="#/equipos"><span>${ICONO.calib}Calibraciones vencidas</span><b>${vencidas.length}</b></a>
        <a class="sis-kpi ${porVencer.length ? 'ambar' : ''}" href="#/equipos"><span>${ICONO.calib}Por vencer (30 días)</span><b>${porVencer.length}</b></a>
        <a class="sis-kpi ${conAlerta.length ? 'rojo' : ''}" href="#/equipos"><span>${ICONO.alerta}Equipos con alerta</span><b>${conAlerta.length}</b></a>
        <a class="sis-kpi" href="#/equipos"><span>${ICONO.equipo}En terreno</span><b>${enTerreno.length}<small> de ${vigentes.length}</small></b></a>
      </div>
      <div class="sis-dos"><div>
        <section class="sis-tarjeta">
          <h2>Calibraciones por revisar</h2>
          ${revisar.length ? `<div class="sis-lista">${revisar.slice(0, 10).map(e => filaEquipo(e, { nombreProyecto: nomProy })).join('')}</div>${revisar.length > 10 ? `<p class="sis-tenue">y ${revisar.length - 10} más en Equipos → filtro «Calibración por revisar».</p>` : ''}`
            : vacio(vigentes.length ? 'Todas las calibraciones están al día.' : 'Aún no hay equipos cargados. Ve a Equipos → Administrar → Importar planilla.')}
        </section>
        <section class="sis-tarjeta">
        <h2>Equipos en terreno, por proyecto</h2>
        ${Object.keys(porProyecto).length ? Object.entries(porProyecto).map(([pid, lista]) => `
          <div class="sis-grupo"><a class="sis-grupo-cab" href="#/proyecto/${esc(pid)}">${ICONO.proyecto}${esc(nomProy(pid))} <span class="sis-tenue">${lista.length} equipo${lista.length > 1 ? 's' : ''}</span></a>
          <div class="sis-lista">${lista.map(e => filaEquipo(e)).join('')}</div></div>`).join('')
          : vacio('No hay equipos fuera de la oficina.')}
      </section>
      </div><aside>
        <section class="sis-tarjeta">
          <h2>Alertas abiertas</h2>
          ${conAlerta.length ? `<div class="sis-lista">${conAlerta.map(e => `<a class="sis-fila" href="#/equipos/${esc(e.id)}">
              <span class="sis-fila-txt"><b>${esc(e.nombre)}</b>${e.alertasActivas.map(a => `<span class="sis-tenue">${esc(a.descripcion)} · desde ${fechaLegible((a.fechaReporte || '').slice(0, 10))}</span>`).join('')}</span>
              <span class="sis-chips">${e.alertasActivas.map(a => `<span class="sis-chip rojo">${esc(estadoAlerta(a.estado))}</span>`).join('')}</span></a>`).join('')}</div>`
            : vacio('No hay alertas abiertas.')}
        </section>
      </aside></div>`;
  }

  return inicioTerreno(ctx, { personas, proyectos, equipos, yo, saludo, bienvenida, nomProy });
}

// ─────────── Inicio del encargado de terreno (v0.11): calendario, estado de proyectos y alertas ───────────
const DSEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const aFechaL = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const lunesDe = iso => { const f = aFechaL(iso); f.setDate(f.getDate() - ((f.getDay() + 6) % 7)); return f.toISOString().slice(0, 10); };
const diaCorto = iso => { const f = aFechaL(iso); return `${DSEM[f.getDay()]} ${f.getDate()}`; };
const CLASE_EV = { vuelo: 'vu', terreno: 'vu', datos: 'da', entrega: 'en', dgac: 'dg', calibracion: 'ca' };
const PRIORIDAD_EV = { vuelo: 5, terreno: 5, entrega: 4, dgac: 3, datos: 2 };

/** Franja de 14 días por proyecto: cada día toma el evento más importante y los días seguidos iguales se unen. */
export function htmlFranjaProyectos(eventos, proyectos, desde, { dias = 14, proyectoId = '' } = {}) {
  const fechas = Array.from({ length: dias }, (_, k) => sumarDias(desde, k)), hoy = hoyISO();
  const porProy = new Map();
  for (const e of eventos) {
    if (!e.proyectoId || e.tipo === 'calibracion' || (proyectoId && e.proyectoId !== proyectoId)) continue;
    const k = fechas.indexOf(e.fecha); if (k < 0) continue;
    const m = porProy.get(e.proyectoId) || new Array(dias).fill(null);
    if (!m[k] || PRIORIDAD_EV[e.tipo] > PRIORIDAD_EV[m[k].tipo]) m[k] = e;
    porProy.set(e.proyectoId, m);
  }
  const filas = [...porProy.entries()].map(([pid, m]) => {
    const segs = [];
    m.forEach((e, k) => { if (!e) return; const u = segs[segs.length - 1]; if (u && u.tipo === e.tipo && u.fin === k - 1) { u.fin = k; u.n++; } else segs.push({ tipo: e.tipo, ini: k, fin: k, e, n: 1 }); });
    const nombre = (proyectos.find(p => p.id === pid) || {}).nombre || 'Proyecto';
    return `<a class="ini-cal-nombre" href="#/proyecto/${esc(pid)}">${esc(nombre)}</a><div class="ini-cal-pista">${segs.map(sg => `<a class="ini-cal-seg ${CLASE_EV[sg.tipo]}" style="grid-column:${sg.ini + 1} / ${sg.fin + 2}" href="${esc(sg.e.enlace || '#')}" title="${esc(sg.e.texto)}">${esc({ vuelo: 'Vuelo', terreno: 'Terreno', datos: 'Datos', entrega: 'Entrega', dgac: 'DGAC' }[sg.tipo])}${sg.n > 1 ? '' : ''}</a>`).join('')}</div>`;
  });
  return `<div class="ini-cal">
      <span></span><div class="ini-cal-dias">${fechas.map(f => { const w = aFechaL(f).getDay(); return `<span class="${f === hoy ? 'hoy' : ''}${w === 0 || w === 6 ? ' finde' : ''}">${esc(diaCorto(f))}</span>`; }).join('')}</div>
      ${filas.join('') || '<span></span><p class="sis-tenue">Sin vuelos, terrenos ni entregas en estas dos semanas.</p>'}
    </div>
    <div class="ini-cal-ley"><span><i class="vu"></i>Vuelo o terreno</span><span><i class="da"></i>Llegada de datos</span><span><i class="en"></i>Entrega</span><span><i class="dg"></i>Límite DGAC</span></div>`;
}

async function inicioTerreno(ctx, { personas, proyectos, equipos, yo, saludo, bienvenida, nomProy }) {
  const hoy = hoyISO(), lunes = lunesDe(hoy), domingo = sumarDias(lunes, 6);
  const [vuelos, eventos] = await Promise.all([Vuelos.listarVuelos().catch(() => []), eventosEntre(lunes, sumarDias(lunes, 27)).catch(() => [])]);
  const activos = proyectos.filter(p => p.id !== OFICINA_ID && p.estado !== 'cerrado');
  const porEtapa = Object.fromEntries(ETAPAS_PROYECTO.map(([k]) => [k, []]));
  for (const p of proyectos.filter(x => x.id !== OFICINA_ID)) porEtapa[etapaProyecto(p)].push(p);
  const mesActual = hoy.slice(0, 7);
  const completadosMes = porEtapa.completado.filter(p => ((p.etapas && p.etapas.completado) || p.actualizadoEn || '').slice(0, 7) === mesActual);

  // Vuelos de la semana
  const semana = vuelos.filter(v => v.fechas.some(f => f >= lunes && f <= domingo));
  const voladosSem = semana.filter(v => ['volado', 'log', 'procesado'].includes(v.etapa)).length;
  // Alertas
  const equiposAlerta = equipos.filter(e => e.alertasActivas.length || ['vencida', 'por_vencer'].includes(e.calibracion.nivel));
  const etapaDe = id => { const p = proyectos.find(x => x.id === id); return p ? etapaProyecto(p) : null; };
  const permisos = vuelos.filter(v => ['planificacion', 'permisos', 'programado'].includes(v.etapa) && !v.dgac.enviado && !v.dgac.aprobado && v.fechas[0] && v.fechas[0] >= hoy && v.fechas[0] <= sumarDias(hoy, 30))
    .map(v => ({ ...v, limite: restarHabiles(v.fechas[0], 7) })).sort((a, b) => a.limite.localeCompare(b.limite));
  const logs = vuelos.filter(v => v.etapa === 'volado' && (!v.proyectoId || ['gabinete', 'entregables', 'completado'].includes(etapaDe(v.proyectoId))));
  const nAlertas = equiposAlerta.length + permisos.length + logs.length;
  // Entregas
  const entregas = eventos.filter(e => e.tipo === 'entrega' && e.fecha >= hoy && e.fecha <= sumarDias(hoy, 7));
  const aMiCargo = yo ? equipos.filter(e => e.ubicacion.lugar === 'terreno' && e.ubicacion.personaId === yo.id) : [];

  const kpi = (t, n, det, clase = '', href = '#/proyectos') => `<a class="sis-kpi ${clase}" href="${href}"><span>${t}</span><b>${n}</b><small class="sis-tenue">${det}</small></a>`;
  const caja = (k, t) => `<a class="ini-etapa ${k}" href="#/proyectos"><small>${t}</small><b>${porEtapa[k].length}</b><span>${esc(porEtapa[k].slice(0, 2).map(p => p.nombre).join(' · ') || '—')}${porEtapa[k].length > 2 ? ` · +${porEtapa[k].length - 2}` : ''}</span></a>`;
  return `${saludo}${bienvenida}
    <div class="sis-kpis">
      ${kpi('Proyectos activos', activos.length, `${porEtapa.terreno.length} en terreno · ${porEtapa.gabinete.length} en gabinete · ${porEtapa.entregables.length} en entregables`)}
      ${kpi('Vuelos esta semana', semana.length, semana.length ? `${voladosSem} volado${voladosSem === 1 ? '' : 's'} · ${semana.length - voladosSem} por volar` : 'sin vuelos programados', '', '#/vuelos')}
      ${kpi('Alertas', nAlertas, `${equiposAlerta.length} equipos · ${permisos.length} permisos · ${logs.length} log${logs.length === 1 ? '' : 's'}`, nAlertas ? 'ambar' : '', '#/inicio')}
      ${kpi('Entregas próximas (7 días)', entregas.length, entregas[0] ? `la más cercana: ${esc(diaCorto(entregas[0].fecha))}` : 'ninguna esta semana', entregas.length ? 'ambar' : '', '#/seguimiento')}
    </div>
    <div class="sis-dos ini-dos"><div>
      <section class="sis-tarjeta"><div class="sis-cab"><h2>Calendario · proyectos activos</h2><a class="sis-btn chico" href="#/proyectos/calendario">Ver mes completo</a></div>
        ${htmlFranjaProyectos(eventos, proyectos, lunes)}</section>
      <section class="sis-tarjeta"><div class="sis-cab"><h2>Estado de los proyectos</h2><a class="sis-btn chico" href="#/proyectos">Ir a Proyectos</a></div>
        <div class="ini-etapas">${caja('terreno', 'Terreno')}${caja('gabinete', 'Proceso en gabinete')}${caja('entregables', 'Entregables')}
          <a class="ini-etapa completado" href="#/proyectos/registro"><small>Completados (mes)</small><b>${completadosMes.length}</b><span>pasan al registro por mandante</span></a></div>
        ${!activos.length ? vacio('Aún no hay proyectos activos. Crea el primero con el encargo que te llegó.', '<a class="sis-btn primario" href="#/proyecto-editar/nuevo">+ Proyecto</a>') : ''}
      </section>
    </div><aside>
      <section class="sis-tarjeta"><h2>Alertas de equipos</h2>
        ${equiposAlerta.length ? `<div class="sis-lista">${equiposAlerta.slice(0, 8).map(e => filaEquipo(e, { nombreProyecto: nomProy })).join('')}</div>${equiposAlerta.length > 8 ? `<p class="sis-tenue">y ${equiposAlerta.length - 8} más en Equipos.</p>` : ''}`
          : vacio('Sin alertas: calibraciones al día y sin problemas reportados.')}
      </section>
      <section class="sis-tarjeta"><h2>Permisos</h2>
        ${permisos.length || logs.length ? `<div class="ini-avisos">
          ${permisos.map(v => `<a class="ini-aviso ${v.limite < hoy ? 'rojo' : 'ambar'}" href="#/vuelos/plan/${esc(v.id)}"><b>${esc(v.nombre)} · vuelo ${esc(diaCorto(v.fechas[0]))}</b><small>Solicitud DGAC sin registrar. ${v.limite < hoy ? `El plazo sugerido (7 días hábiles) venció el ${fechaLegible(v.limite)}.` : `Sugerido presentarla a más tardar el ${fechaLegible(v.limite)}.`}${v.docsPendientes ? ` Faltan ${v.docsPendientes} documentos.` : ''}</small></a>`).join('')}
          ${logs.map(v => `<a class="ini-aviso rojo" href="#/vuelos/plan/${esc(v.id)}"><b>${esc(v.nombre)} · log de vuelo pendiente</b><small>${v.proyectoId ? `${esc(nomProy(v.proyectoId))} ya está en ${esc(NOMBRE_ETAPA_PROYECTO[etapaDe(v.proyectoId)].toLowerCase())}.` : 'Vuelo volado.'} Cárgalo en el paso Permisos.</small></a>`).join('')}
        </div><p class="sis-tenue">Avisos informativos: no bloquean la programación.</p>` : vacio('Sin permisos pendientes para los vuelos del próximo mes.')}
      </section>
      ${yo ? `<section class="sis-tarjeta"><h2>Equipos a mi cargo</h2>${aMiCargo.length ? `<div class="sis-lista">${aMiCargo.map(e => filaEquipo(e, { nombreProyecto: nomProy })).join('')}</div>` : vacio('No tienes equipos a tu cargo. Se asignan con el checklist de salida en Equipos.')}</section>` : ''}
    </aside></div>`;
}

function estadoAlerta(e) {
  return { abierta: 'Abierta', en_mantencion: 'En mantención', recibida: 'Recibida de mantención', cerrada: 'Cerrada' }[e] || e;
}

// ─────────────────────────── Proyectos ───────────────────────────

async function proyectos(ctx, sub = null) {
  if (sub === 'calendario') {
    ctx.estado.cal = ctx.estado.cal || { modo: leerLS('env_cal_modo') || 'mes', ref: hoyISO(), proyecto: '' };
    return `<div class="sis-cab"><h1>Calendario</h1><a class="sis-btn primario" href="#/proyecto-editar/nuevo">+ Proyecto</a></div>${await vistaCalendario(ctx.estado.cal)}`;
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
  return `<div class="sis-cab"><div><h1>Proyectos activos</h1><span class="sis-tenue">${activos.length} proyecto${activos.length === 1 ? '' : 's'} · terreno → gabinete → entregables → completado</span></div>${selector}<a class="sis-btn primario" href="#/proyecto-editar/nuevo">+ Proyecto</a></div>
    ${activos.length ? cuerpo : vacio('Aún no hay proyectos activos. Crea el primero con el encargo que te llegó.')}
    ${oficina ? `<p class="sis-tenue">Trabajo que no es de un contrato: <a href="#/proyecto/${OFICINA_ID}">Oficina</a>. Los completados quedan en <a href="#/proyectos/registro">Registro por mandante</a>.</p>` : ''}
    ${eliminados.length ? `<details class="sis-papelera"><summary>Papelera de proyectos (${eliminados.length})</summary>
      <section class="sis-tarjeta"><div class="sis-lista">${eliminados.map(p => `<div class="sis-fila">
        <span class="sis-fila-txt"><b>${esc(p.nombre)}</b><span class="sis-tenue">Eliminado ${fechaHoraLegible(p.eliminadoEn)}</span></span>
        <button class="sis-btn chico" data-accion="restaurar-proyecto" data-id="${esc(p.id)}">Restaurar</button></div>`).join('')}</div></section></details>` : ''}`;
}

// ─────────── Registro por mandante (v0.11): base de datos de los proyectos completados ───────────
async function datosRegistro() {
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

async function proyecto(ctx, id) {
  const p = await obtenerProyecto(id);
  if (!p || p.eliminadoEn) return vacio('Este proyecto no existe o está en la papelera.', '<a class="sis-btn" href="#/proyectos">Volver a Proyectos</a>');
  const [personas, equipos, certs, planes, seg, mono] = await Promise.all([listarPersonas(), Equipos.listarEquiposConEstado(), Equipos.certificadosDeProyecto(id), Vuelos.planesDeProyecto(id), Seguimiento.resumenDeProyecto(id), Monografias.resumenDeProyecto(id)]);
  const nomPers = pid => (personas.find(x => x.id === pid) || {}).nombre || '';
  const enProyecto = equipos.filter(e => e.ubicacion.lugar === 'terreno' && e.ubicacion.proyectoId === id);
  const esOficina = id === OFICINA_ID;
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
        <a class="sis-btn chico" href="#/proyecto-editar/${esc(p.id)}">Editar</a>`}</div>
    </div>
    ${esOficina ? '' : (() => { const et = etapaProyecto(p), iEt = ETAPAS_PROYECTO.findIndex(([k]) => k === et); return `<section class="sis-tarjeta sis-etapa-ficha"><div class="sis-etapas-pasos">${ETAPAS_PROYECTO.map(([k, t], i) => `<button type="button" class="sis-etapa-paso${i < iEt ? ' hecho' : i === iEt ? ' actual' : ''}" data-accion="etapa-proyecto" data-id="${esc(p.id)}" data-e="${k}" ${i === iEt ? 'aria-current="step"' : ''}><span>${i < iEt ? '✓' : i + 1}</span>${t}${p.etapas && p.etapas[k] ? `<small>${fechaLegible(p.etapas[k])}</small>` : ''}</button>`).join('')}</div></section>`; })()}
    ${p.notas ? `<p class="sis-notas">${esc(p.notas)}</p>` : ''}
    <div class="sis-dos"><div>
      ${p.periodicidad && p.periodicidad.tipo === 'recurrente' ? (() => { const cs = ciclosEntre(p.periodicidad, hoyISO(), sumarDias(hoyISO(), 120)).slice(0, 3);
        return `<section class="sis-tarjeta"><div class="sis-cab"><h2>Próximos ciclos</h2><button class="sis-btn chico" data-accion="ver-calendario">▦ Calendario</button></div>
          ${cs.length ? `<div class="sis-lista">${cs.map(c => `<div class="sis-fila"><span class="sis-fila-txt"><b><span class="mono">${esc(c.numero)}</span> ${esc(c.nombre)}</b><span class="sis-tenue">Terreno ${fechaLegible(c.terreno[0])}${c.terreno[1] !== c.terreno[0] ? ` – ${fechaLegible(c.terreno[1])}` : ''} · datos ${fechaLegible(c.datos)} · entrega ${fechaLegible(c.entrega)}</span></span></div>`).join('')}</div>`
            : '<p class="sis-tenue">Sin ciclos en los próximos 4 meses: revisa la periodicidad (primer ciclo y término).</p>'}</section>`; })() : ''}
      <section class="sis-tarjeta">
        <div class="sis-cab"><h2>Vuelos</h2>${ctx.rol === 'terreno' ? `<a class="sis-btn chico" href="#/vuelos/proyecto/${esc(id)}">Planificación</a>` : ''}</div>
        ${planes.length ? `<div class="sis-lista">${planes.map(v => `<a class="sis-fila" href="#/vuelos/plan/${esc(v.id)}">
            <span class="sis-fila-txt"><b>${esc(v.nombre)}</b><span class="sis-tenue">${esc(v.dron)}</span></span>
            <span class="sis-chips">${v.resumen.area ? `<span class="sis-chip gris">${(v.resumen.area / 10000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} ha</span>` : ''}${v.resumen.gsd ? `<span class="sis-chip gris">GSD ${v.resumen.gsd.toLocaleString('es-CL', { maximumFractionDigits: 2 })} cm</span>` : ''}${v.resumen.densidad ? `<span class="sis-chip gris">${Math.round(v.resumen.densidad)} pts/m²</span>` : ''}${v.resumen.vuelos ? `<span class="sis-chip azul">${v.resumen.vuelos} vuelo${v.resumen.vuelos > 1 ? 's' : ''}</span>` : ''}</span></a>`).join('')}</div>`
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
    </div><aside>
      <section class="sis-tarjeta">
        <h2>Equipos ${esOficina ? 'asignados' : 'en el proyecto'}</h2>
        ${enProyecto.length ? `<div class="sis-lista">${enProyecto.map(e => filaEquipo(e)).join('')}</div>`
          : vacio('No hay equipos asignados. Se asignan con el checklist de salida en Equipos.', '<a class="sis-btn chico" href="#/equipos">Ir a Equipos</a>')}
      </section>
      <section class="sis-tarjeta">
        <h2>Certificados para el mandante</h2>
        ${certsHtml}
      </section>
      <section class="sis-tarjeta sis-pronto"><h2>Gastos del proyecto</h2><p>Cada gasto con su boleta, la rendición y el abono de RRHH. Llega con el módulo Gastos.</p></section>
    </aside></div>`;
}

async function proyectoEditar(ctx, id) {
  const nuevo = id === 'nuevo';
  const p = nuevo ? { estado: 'activo', tiposTrabajo: [], encargadoId: ctx.personaId || '', fechaEncargo: hoyISO() } : await obtenerProyecto(id);
  if (!p) return vacio('Este proyecto no existe.');
  if (p.id === OFICINA_ID) return vacio('«Oficina» es un proyecto especial y no se edita.', '<a class="sis-btn" href="#/proyectos">Volver</a>');
  const personas = await listarPersonas();
  const val = k => esc(p[k] ?? '');
  const tipos = tiposDeProyecto(p);
  return `<a class="sis-volver" href="${nuevo ? '#/proyectos' : `#/proyecto/${esc(p.id)}`}">← Volver</a>
    <h1>${nuevo ? 'Nuevo proyecto' : 'Editar proyecto'}</h1>
    <form class="sis-form" data-form="proyecto" data-id="${nuevo ? '' : esc(p.id)}">
      <fieldset><legend>Proyecto</legend>
        <label class="sis-campo"><span>Nombre *</span><input name="nombre" required value="${val('nombre')}" placeholder="Canal Norte — levantamiento y batimetría"></label>
        <label class="sis-campo"><span>Mandante</span><input name="mandante" value="${val('mandante')}" placeholder="Empresa que encarga el trabajo"></label>
        <div class="sis-campo"><span>Tipos de trabajo (uno o más; el detalle es opcional)</span>
          <div class="sis-categorias">${CATEGORIAS_TRABAJO.map(c => `<label class="sis-opcion sis-cat"><input type="checkbox" name="tipos" value="${c.k}" ${tipos.categorias.includes(c.k) ? 'checked' : ''}> ${c.t}</label>`).join('')}</div>
          <div class="sis-detalles">${CATEGORIAS_TRABAJO.map(c => `<div class="sis-detalle" data-cat="${c.k}"><b>${c.t}</b>
            ${c.det.map(([d, t]) => `<label class="sis-opcion chico"><input type="checkbox" name="detalle" value="${c.k}:${d}" ${tipos.detalles.includes(`${c.k}:${d}`) ? 'checked' : ''}> ${t}</label>`).join('')}
            ${c.texto ? `<input name="tipoOtro" class="sis-detalle-texto" value="${val('tipoOtro')}" placeholder="¿Cuál?" aria-label="Otro tipo de trabajo">` : ''}</div>`).join('')}</div></div>
        <div class="sis-par">
          <label class="sis-campo"><span>Comuna</span><input name="comuna" value="${val('comuna')}"></label>
          <label class="sis-campo"><span>Región</span><select name="region"><option value=""></option>${REGIONES.map(r => `<option ${p.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        </div>
        <div class="sis-par">
          <label class="sis-campo"><span>Encargado</span><select name="encargadoId"><option value="">—</option>${personas.map(x => `<option value="${esc(x.id)}" ${p.encargadoId === x.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>
          <label class="sis-campo"><span>Estado</span><select name="estado"><option value="activo">Activo</option><option value="cerrado" ${p.estado === 'cerrado' ? 'selected' : ''}>Cerrado</option></select></label>
        </div>
      </fieldset>
      <fieldset><legend>Encargo</legend>
        <p class="sis-tenue">Los trabajos llegan por correo: anota quién lo pidió y para cuándo.</p>
        <label class="sis-campo"><span>Encargado por</span><input name="solicitadoPor" value="${val('solicitadoPor')}" placeholder="Quién lo pidió (persona o área)"></label>
        <div class="sis-par">
          <label class="sis-campo"><span>Fecha del encargo</span><input type="date" name="fechaEncargo" value="${val('fechaEncargo')}"></label>
          <label class="sis-campo"><span>Plazo de entrega</span><input type="date" name="plazo" value="${val('plazo')}"></label>
        </div>
        ${(() => { const per = { ...BASE_RECURRENTE, ...(p.periodicidad || {}), tipo: (p.periodicidad && p.periodicidad.tipo) || 'unico' }; const v = k => esc(per[k] ?? '');
          return `<fieldset class="sis-periodicidad"><legend>Periodicidad</legend>
          <div class="sis-opciones"><label class="sis-opcion"><input type="radio" name="perTipo" value="unico" ${per.tipo !== 'recurrente' ? 'checked' : ''}> Único (una entrega)</label><label class="sis-opcion"><input type="radio" name="perTipo" value="recurrente" ${per.tipo === 'recurrente' ? 'checked' : ''}> Recurrente (servicio que se repite)</label></div>
          <div class="sis-per-rec">
            <div class="sis-par"><label class="sis-campo"><span>Se repite cada</span><span class="sis-en-linea"><input type="number" name="perCada" min="1" max="12" value="${v('cada')}"><select name="perUnidad"><option value="mes" ${per.unidad !== 'semana' ? 'selected' : ''}>mes(es)</option><option value="semana" ${per.unidad === 'semana' ? 'selected' : ''}>semana(s)</option></select></span></label>
              <label class="sis-campo"><span>Primer ciclo (mes o lunes de inicio)</span><input name="perDesde" value="${v('desde')}" placeholder="2025-10 o 2026-11-02"></label></div>
            <div class="sis-par"><label class="sis-campo"><span>N° de mes del contrato del primer ciclo</span><input type="number" name="perMesInicial" min="1" value="${v('mesInicial')}"></label>
              <label class="sis-campo"><span>Terreno (servicio mensual): parte en la</span><select name="perSemana">${SEMANAS.map(([k, t]) => `<option value="${k}" ${per.semana === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
            <div class="sis-par"><label class="sis-campo"><span>Días de terreno (hábiles)</span><input type="number" name="perDias" min="1" max="20" value="${v('diasTerreno')}"></label>
              <label class="sis-campo"><span>Los datos llegan</span><select name="perDatos">${DATOS.map(([k, t]) => `<option value="${k}" ${per.datos === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
            <div class="sis-par"><label class="sis-campo"><span>Entrega: días hábiles después de los datos</span><input type="number" name="perEntrega" min="0" max="60" value="${v('diasEntrega')}"></label>
              <label class="sis-campo"><span>Hasta (vacío: sin término)</span><input type="date" name="perHasta" value="${v('hasta')}"></label></div>
            <p class="sis-tenue">Cada ciclo aparece en el Calendario (terreno, llegada de datos y entrega) y, al crear el mes en Seguimiento, toma su nombre, N° de mes y fecha de llegada de los datos. Días hábiles = lunes a viernes.</p>
          </div></fieldset>`; })()}
        <label class="sis-campo"><span>Notas</span><textarea name="notas" rows="3" placeholder="Alcance, contacto en terreno, adjuntos recibidos…">${val('notas')}</textarea></label>
      </fieldset>
      <div class="sis-acciones"><button class="sis-btn primario">${nuevo ? 'Crear proyecto' : 'Guardar cambios'}</button>
        ${nuevo ? '' : `<button type="button" class="sis-btn" data-accion="cerrar-proyecto" data-id="${esc(p.id)}">${p.estado === 'cerrado' ? 'Reabrir' : 'Cerrar proyecto'}</button>
        <button type="button" class="sis-btn peligro" data-accion="eliminar-proyecto" data-id="${esc(p.id)}">Eliminar</button>`}</div>
      ${nuevo ? '' : '<p class="sis-tenue">«Cerrar» es para un trabajo terminado: queda en el historial. «Eliminar» es para un proyecto creado por error: va a la papelera y se puede restaurar desde Proyectos.</p>'}
    </form>`;
}

// ─────────────────────────── Personas ───────────────────────────

async function personas(ctx) {
  const lista = await listarPersonas();
  const editable = ctx.rol === 'rrhh';
  const editando = ctx.estado.personaEditar;
  const p = editando === 'nueva' ? { roles: [] } : (editando ? lista.find(x => x.id === editando) : null);
  const form = p ? `<section class="sis-tarjeta"><h2>${p.id ? 'Editar persona' : 'Nueva persona'}</h2>
      <form class="sis-form" data-form="persona" data-id="${esc(p.id || '')}">
        <div class="sis-par">
          <label class="sis-campo"><span>Nombre *</span><input name="nombre" required value="${esc(p.nombre || '')}"></label>
          <label class="sis-campo"><span>Cargo</span><input name="cargo" value="${esc(p.cargo || '')}" placeholder="Geomensor, topógrafo, piloto…"></label>
        </div>
        <div class="sis-campo"><span>Roles en el Sistema</span>
          <div class="sis-opciones">${ROLES_PERSONA.map(([k, t]) => `<label class="sis-opcion"><input type="checkbox" name="roles" value="${k}" ${(p.roles || []).includes(k) ? 'checked' : ''}> ${t}</label>`).join('')}</div></div>
        <div class="sis-acciones"><button class="sis-btn primario">Guardar</button><button type="button" class="sis-btn" data-accion="cancelar-persona">Cancelar</button></div>
      </form></section>` : '';
  return `<div class="sis-cab"><h1>Personas</h1>${editable && !p ? '<button class="sis-btn primario" data-accion="nueva-persona">+ Persona</button>' : ''}</div>
    <p class="sis-tenue">Quiénes usan el Sistema y qué rol cumplen. Una persona puede tener más de un rol. Los documentos del personal (licencias, exámenes) llegan más adelante, cuando el Sistema esté en el Nextcloud de la empresa.</p>
    ${form}
    ${ctx.estado.vincular ? await tarjetaVincular(lista.find(x => x.id === ctx.estado.vincular)) : ''}
    <section class="sis-tarjeta">${lista.length ? `<div class="sis-lista">${lista.map(x => `<div class="sis-fila">
        <span class="sis-fila-txt"><b>${esc(x.nombre)}</b><span class="sis-tenue">${esc(x.cargo || 'Sin cargo')}</span></span>
        <span class="sis-chips">${(x.roles || []).map(r => `<span class="sis-chip gris">${esc(NOMBRE_ROL_PERSONA[r] || r)}</span>`).join('')}
        <button class="sis-btn chico" data-accion="vincular" data-id="${esc(x.id)}">Vincular teléfono</button>
        ${editable ? `<button class="sis-btn chico" data-accion="editar-persona" data-id="${esc(x.id)}">Editar</button>` : ''}</span></div>`).join('')}</div>`
      : vacio('Aún no hay personas.')}</section>
    ${editable ? '' : '<p class="sis-tenue">Solo Administración / RRHH edita esta lista.</p>'}
    <section class="sis-tarjeta" id="empresa"><h2>Empresa</h2>
      <form class="sis-form" data-form="empresa">
        <label class="sis-campo"><span>Nombre que aparece arriba</span><input name="nombre" value="${esc(ctx.marca.nombre)}" maxlength="40"></label>
        <div class="sis-campo"><span>Color de marca</span><div class="sis-colores">${COLORES_MARCA.map(([c, t]) => `<label class="sis-color"><input type="radio" name="color" value="${c}" ${ctx.marca.color === c ? 'checked' : ''}><i style="background:${c}"></i>${t}</label>`).join('')}</div></div>
        <div class="sis-acciones"><button class="sis-btn primario">Guardar</button></div>
        <p class="sis-tenue">Por ahora se guarda en este equipo (teléfono o computador). Cuando el Sistema esté en el Nextcloud de la empresa, lo define RRHH para todos, junto con el logo.</p>
      </form></section>`;
}

// ─────────────────────────── Vincular teléfono (app de Terreno) ───────────────────────────
// Sin usuarios todavía: cada persona tiene un código corto. El QR abre la app de Terreno con la carpeta de la nube
// (?carpeta=) y el código (#vincular=); la app carga el perfil de la persona: sus proyectos y sus equipos en terreno.

const LETRAS_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const nuevoCodigo = () => Array.from({ length: 6 }, () => LETRAS_CODIGO[Math.floor(Math.random() * LETRAS_CODIGO.length)]).join('');
const leerLS = (k, d = '') => { try { return localStorage.getItem(k) || d; } catch { return d; } };
export const urlTerreno = () => resolverUrlTerreno(leerLS('env_terreno_url'), location.href);

async function tarjetaVincular(p) {
  if (!p) return '';
  const n = estadoNube();
  const base = urlTerreno().split('#')[0];
  const u = new URL(base);
  if (n.carpetaId) u.searchParams.set('carpeta', n.carpetaId);
  const enlace = `${u.toString()}#vincular=${p.codigoVinculo}`;
  let qr = '<p class="sis-tenue">No se pudo generar el QR (falta vendor/qrcode.js).</p>';
  try {
    if (!globalThis.qrcode) await cargarScript('vendor/qrcode.js');
    const q = globalThis.qrcode(0, 'M'); q.addData(enlace); q.make();
    qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
  } catch (e) { console.warn(e); }
  return `<section class="sis-tarjeta sis-vincular"><div class="sis-cab"><h2>Vincular teléfono · ${esc(p.nombre)}</h2><button class="sis-btn chico" data-accion="cerrar-vincular">Cerrar</button></div>
    <div class="sis-vincular-cuerpo">
      <div class="sis-qr" role="img" aria-label="Código QR para vincular la app de Terreno">${qr}</div>
      <div>
        <p>Escanea con la cámara del teléfono. Se abre la app de Terreno ya vinculada a <b>${esc(p.nombre)}</b>: sus proyectos, sus equipos en terreno y el botón para avisar un problema de un equipo.</p>
        <p>Si el QR no se puede leer, en la app de Terreno escribe el código:</p>
        <p class="sis-codigo">${esc(p.codigoVinculo)}</p>
        ${n.carpetaId ? '<p class="sis-tenue">El QR lleva la carpeta de la nube: el teléfono trae los datos al conectarse con Google.</p>' : '<div class="sis-aviso-linea">La nube no está conectada en este equipo: el QR funciona solo en este mismo navegador. Conecta la nube para vincular otro teléfono.</div>'}
        <form class="sis-form" data-form="terreno-url"><label class="sis-campo"><span>Dirección de la app de Terreno</span><input name="url" value="${esc(leerLS('env_terreno_url').includes('paquete-conexion/ejemplo.html') ? '' : leerLS('env_terreno_url'))}" placeholder="${esc(urlTerreno())}"></label>
          <div class="sis-acciones"><button class="sis-btn chico">Guardar dirección</button><button type="button" class="sis-btn chico" data-accion="nuevo-codigo" data-id="${esc(p.id)}">Cambiar código</button></div>
          <p class="sis-tenue">Déjala vacía para usar la app de Terreno publicada junto al Sistema (carpeta terreno/).</p></form>
      </div>
    </div></section>`;
}

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
  return { lista, nuevos: lista.filter(a => !vistos.has(a.id)).length, vistos, proyectos };
}

async function avisos(ctx) {
  const { lista, vistos, proyectos } = await avisosPara(ctx);
  const personas = await listarPersonas();
  const nomPers = id => (personas.find(x => x.id === id) || {}).nombre || 'Sin nombre';
  const nomProy = id => (proyectos.find(x => x.id === id) || {}).nombre || 'Sin proyecto';
  const ESTADO = { abierta: 'Abierta', mantencion: 'En mantención', recibida: 'Recibida' };
  guardarVistos(ctx.personaId || ctx.rol, new Set([...vistos, ...lista.map(a => a.id)]));
  return `<div class="sis-cab"><h1>Avisos de equipos</h1></div>
    <p class="sis-tenue">${ctx.rol === 'rrhh' ? 'Problemas y avisos de todos los equipos.' : 'Problemas y avisos de equipos en tus proyectos (donde eres el encargado).'} Llegan desde la app de Terreno por la nube. Los estados se cambian en Equipos → Alertas.</p>
    ${ctx.rol !== 'rrhh' && !ctx.personaId ? vacio('Elige quién eres arriba para ver los avisos de tus proyectos.') : ''}
    <section class="sis-tarjeta">${lista.length ? `<div class="sis-lista">${lista.map(a => `<a class="sis-fila${vistos.has(a.id) ? '' : ' sis-nuevo'}" href="#/equipos/${esc(a.equipoId)}">
        <span class="sis-fila-txt"><b>${esc(a.equipo)}</b><span>${esc(a.descripcion || '')}</span>
          <span class="sis-tenue">${esc(nomProy(a.proyectoId))} · ${esc(nomPers(a.reportadaPor))} · ${esc(fechaHoraLegible(a.fechaReporte))}${a.origen === 'app-terreno' ? ' · desde Terreno' : ''}</span></span>
        <span class="sis-chips">${vistos.has(a.id) ? '' : '<span class="sis-chip azul">Nuevo</span>'}<span class="sis-chip ${a.tipo === 'aviso' ? 'ambar' : 'rojo'}">${a.tipo === 'aviso' ? 'Aviso' : 'Problema'}</span><span class="sis-chip gris">${esc(ESTADO[a.estado] || a.estado)}</span></span></a>`).join('')}</div>`
      : vacio('No hay avisos abiertos.')}</section>`;
}

// ─────────────────────────── Próximamente ───────────────────────────

const PRONTO = {
  gastos: { titulo: 'Gastos', version: 'una próxima versión', texto: 'Cada gasto con la foto de su boleta, dentro de su proyecto (o en «Oficina»). La rendición pasa por borrador → emitida → devuelta → abonada, y RRHH registra el abono. Las boletas quedan respaldadas en la carpeta del proyecto.' },
  terreno: { titulo: 'Libreta de terreno', version: 'una próxima versión', texto: 'Terreno Topografía entra al Sistema: jornadas y levantamientos dentro de cada proyecto, con los equipos que salieron en el checklist. Mientras tanto, sigue usando la app de Terreno por separado.' },
};

function pronto(ctx, clave) {
  const x = PRONTO[clave];
  return `<section class="sis-tarjeta sis-pronto grande"><h1>${x.titulo}</h1><p><span class="sis-chip ambar">Llega en ${x.version}</span></p><p>${x.texto}</p></section>`;
}

export const VISTAS = { inicio, proyectos, proyecto, proyectoEditar, personas, pronto, avisos };

// ─────────────────────────── Acciones ───────────────────────────

/** Formularios y botones de las pantallas del Sistema. Devuelve true si hay que volver a pintar. */
export async function manejarEnvio(form, ctx) {
  const datos = new FormData(form);
  if (form.dataset.form === 'persona-rapida') {
    const p = await guardarPersona({ nombre: datos.get('nombre').trim(), cargo: (datos.get('cargo') || '').trim(), roles: [ctx.rol === 'rrhh' ? 'rrhh' : 'encargado'] }, { personaId: ctx.personaId });
    await ctx.usarPersona(p.id);
    ctx.avisar('Persona creada');
    return true;
  }
  if (form.dataset.form === 'persona') {
    const id = form.dataset.id || undefined;
    await guardarPersona({ id, nombre: datos.get('nombre').trim(), cargo: (datos.get('cargo') || '').trim(), roles: datos.getAll('roles') }, { personaId: ctx.personaId });
    ctx.estado.personaEditar = null;
    await ctx.recargarPersonas();
    ctx.avisar('Persona guardada');
    return true;
  }
  if (form.dataset.form === 'terreno-url') {
    const u = (datos.get('url') || '').trim();
    try { if (u) { new URL(u); localStorage.setItem('env_terreno_url', u); } else localStorage.removeItem('env_terreno_url'); } catch { throw new Error('La dirección debe empezar con https://'); }
    ctx.avisar('Dirección guardada');
    return true;
  }
  if (form.dataset.form === 'empresa') {
    ctx.cambiarMarca({ nombre: (datos.get('nombre') || '').trim() || 'Topoland', color: datos.get('color') || COLORES_MARCA[0][0] });
    ctx.avisar('Marca guardada');
    return true;
  }
  if (form.dataset.form === 'proyecto') {
    const id = form.dataset.id || undefined;
    const r = await guardarProyecto({
      id,
      nombre: datos.get('nombre').trim(),
      mandante: (datos.get('mandante') || '').trim(),
      tiposTrabajo: datos.getAll('tipos'),
      tiposDetalle: datos.getAll('detalle').filter(d => datos.getAll('tipos').includes(d.split(':')[0])),
      tipoOtro: datos.getAll('tipos').includes('otro') ? (datos.get('tipoOtro') || '').trim() : '',
      comuna: (datos.get('comuna') || '').trim(),
      region: datos.get('region') || '',
      encargadoId: datos.get('encargadoId') || null,
      estado: datos.get('estado') || 'activo',
      solicitadoPor: (datos.get('solicitadoPor') || '').trim(),
      fechaEncargo: datos.get('fechaEncargo') || '',
      plazo: datos.get('plazo') || '',
      periodicidad: datos.get('perTipo') === 'recurrente' ? {
        tipo: 'recurrente', cada: Math.max(1, Number(datos.get('perCada')) || 1), unidad: datos.get('perUnidad') === 'semana' ? 'semana' : 'mes',
        desde: (datos.get('perDesde') || '').trim(), mesInicial: Math.max(1, Number(datos.get('perMesInicial')) || 1), semana: datos.get('perSemana') || 'ultima',
        diasTerreno: Math.max(1, Number(datos.get('perDias')) || 1), datos: datos.get('perDatos') || 'lunes', diasEntrega: Math.max(0, Number(datos.get('perEntrega')) || 0), hasta: datos.get('perHasta') || '',
      } : { tipo: 'unico' },
      notas: (datos.get('notas') || '').trim(),
    }, { personaId: ctx.personaId });
    ctx.avisar(id ? 'Proyecto guardado' : 'Proyecto creado');
    ctx.ir(`#/proyecto/${r.id}`);
    return false;
  }
  return false;
}

const escribirLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

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
    case 'nueva-persona': ctx.estado.personaEditar = 'nueva'; return true;
    case 'editar-persona': ctx.estado.personaEditar = boton.dataset.id; return true;
    case 'cancelar-persona': ctx.estado.personaEditar = null; return true;
    case 'vincular': case 'nuevo-codigo': {
      const p = await obtenerPersona(boton.dataset.id);
      if (p && (!p.codigoVinculo || boton.dataset.accion === 'nuevo-codigo')) await guardarPersona({ id: p.id, codigoVinculo: nuevoCodigo() }, { personaId: ctx.personaId });
      if (boton.dataset.accion === 'nuevo-codigo') ctx.avisar('Código cambiado: el anterior ya no sirve');
      ctx.estado.vincular = boton.dataset.id; return true;
    }
    case 'cerrar-vincular': ctx.estado.vincular = null; return true;
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
  if (input.dataset.accion === 'cal-proyecto') { ctx.estado.cal = { ...(ctx.estado.cal || { modo: 'mes', ref: hoyISO() }), proyecto: input.value }; return true; }
  return false;
}

export { obtenerPersona };
