// app/vistas-inicio.js — pantalla Inicio del Sistema (v0.14.1: separada de vistas.js).


import { escapar as esc, fechaLegible, fechaHoraLegible, hoyISO, diasEntre, cargarScript, descargar } from '../compartido/util.js';
import { resolverUrlTerreno } from './url-terreno.js';
import { estado as estadoNube } from '../compartido/nube.js';
import { enviarAPapelera, enPapelera, restaurar, eliminarDefinitivo } from '../compartido/papelera.js';
import {
  listarProyectos, obtenerProyecto, guardarProyecto, listarPersonas, obtenerPersona, guardarPersona, OFICINA_ID,
} from '../compartido/catalogos.js';
import * as Equipos from '../modulos/equipos/equipos.js';
import * as Vuelos from '../modulos/vuelos/vuelos.js';
import * as Seguimiento from '../modulos/seguimiento/seguimiento.js';
import * as Monografias from '../modulos/monografias/monografias.js';
import * as Gastos from '../modulos/gastos/gastos.js';
import { clp, ESTADOS as ESTADOS_GASTOS } from '../modulos/gastos/modelo.js';
import { vistaCalendario, mover as moverCalendario, eventosEntre } from './calendario.js';
import { BASE_RECURRENTE, SEMANAS, DATOS, ciclosEntre, textoPeriodicidad, sumarDias, restarHabiles } from '../compartido/periodicidad.js';
import { ESTADOS as ESTADOS_MONO } from '../modulos/monografias/datos.js';
import { ROLES, COLORES_MARCA, CATEGORIAS_TRABAJO, NOMBRE_CATEGORIA, tiposDeProyecto, textosTipos, ROLES_PERSONA, NOMBRE_ROL_PERSONA, REGIONES, ETAPAS_PROYECTO, NOMBRE_ETAPA_PROYECTO, etapaProyecto } from './catalogo.js';
import { VERSION_SISTEMA } from './version.js';
import { ICONO, chipCal, filaEquipo, vacio, estadoAlerta, aFechaL, lunesDe, diaCorto } from './vistas-ui.js';

// ─────────────────────────── Inicio ───────────────────────────

export async function inicio(ctx) {
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

