// app/vistas-inicio.js — pantalla Inicio del Sistema (v0.14.1: separada de vistas.js).


import { escapar as esc, fechaLegible, hoyISO, diasEntre } from '../compartido/util.js';
import { listarProyectos, listarPersonas, OFICINA_ID } from '../compartido/catalogos.js';
import * as Equipos from '../modulos/equipos/equipos.js';
import * as Vuelos from '../modulos/vuelos/vuelos.js';
import { eventosEntre } from './calendario.js';
import { sumarDias, restarHabiles } from '../compartido/periodicidad.js';
import { ROLES, NOMBRE_ETAPA_PROYECTO, etapaProyecto } from './catalogo.js';
import { VERSION_SISTEMA } from './version.js';
import { ICONO, filaEquipo, vacio, estadoAlerta, aFechaL, lunesDe, diaCorto } from './vistas-ui.js';
import * as Administracion from '../modulos/administracion/administracion.js';
import { ordenarPendientes } from '../compartido/vencimientos.js';
import { pendientesEncargo, sinAcuse, resumenCronograma, genteDeProyecto } from './encargo.js';
import { agruparPendientes, accionPrincipal, semaforoProyecto, contarSemaforo } from './hoy.js';

// ─────────── v0.19 · Hoy: lo primero, y lo demás agrupado por lo que hay que hacer ───────────
const NIVEL_PEND = { rojo: ['Urgente', 'rojo'], ambar: ['Pronto', 'ambar'] };
const filaPend = x => `<a class="ini-pend-fila" href="${esc(x.enlace)}"><span class="sis-chip ${NIVEL_PEND[x.nivel] ? NIVEL_PEND[x.nivel][1] : 'gris'}">${esc(x.etiqueta || (NIVEL_PEND[x.nivel] || ['Pendiente'])[0])}</span><span class="ini-pend-txt"><b>${esc(x.titulo)}</b>${x.detalle ? `<span>${esc(x.detalle)}</span>` : ''}</span></a>`;

/** Botón grande con lo primero que conviene hacer hoy. */
function tarjetaPrincipal(a) {
  return `<section class="sis-tarjeta ini-principal ${a.nivel}" aria-labelledby="ini-prin-t"><div class="ini-principal-txt"><small>${a.pendiente ? 'Lo primero de hoy' : 'Todo al día'}</small>
      <h2 id="ini-prin-t">${esc(a.texto)}</h2>${a.detalle ? `<p>${esc(a.detalle)}</p>` : ''}</div>
    <a class="sis-btn primario grande" href="${esc(a.enlace)}">${a.pendiente ? 'Hacerlo ahora' : esc(a.texto)}</a></section>`;
}

/** Pendientes agrupados por lo que hay que hacer («Renovar documentos», «Calibrar equipos»…). */
function tarjetaPendientes(items, ctx, { titulo = 'Para hacer' } = {}) {
  const grupos = agruparPendientes(items);
  if (!grupos.length) return `<section class="sis-tarjeta" aria-labelledby="ini-pend-t"><h2 id="ini-pend-t">${titulo}</h2>${vacio(!ctx.personaId ? 'Elige quién eres para ver lo tuyo.' : 'Nada pendiente. Todo al día.')}</section>`;
  const total = grupos.reduce((n, g) => n + g.items.length, 0);
  return `<section class="sis-tarjeta" aria-labelledby="ini-pend-t"><div class="sis-cab"><h2 id="ini-pend-t">${titulo}</h2><span class="sis-tenue">${total} en ${grupos.length} grupo${grupos.length > 1 ? 's' : ''}</span></div>
    ${grupos.map((g, k) => `<details class="ini-grupo" ${k < 3 ? 'open' : ''}><summary><b>${esc(g.verbo)}</b><span class="sis-chip ${g.urgentes ? 'rojo' : 'ambar'}">${g.items.length}</span></summary>
      <div class="ini-pend">${g.items.slice(0, 5).map(filaPend).join('')}</div>${g.items.length > 5 ? `<p class="sis-tenue">y ${g.items.length - 5} más.</p>` : ''}</details>`).join('')}
  </section>`;
}

/** Indicador que solo aparece si hay algo que contar (no se muestran tarjetas en cero). */
const kpiSi = (n, t, href, clase = '', det = '') => n ? `<a class="sis-kpi ${clase}" href="${href}"><span>${t}</span><b>${n}</b>${det ? `<small class="sis-tenue">${det}</small>` : ''}</a>` : '';
const filaKpis = (...k) => { const h = k.filter(Boolean).join(''); return h ? `<div class="sis-kpis">${h}</div>` : ''; };

/** Pendientes de equipos (calibraciones) y de Administración para el rol actual; `extra` suma los de cada pantalla. */
async function misPendientes(ctx, { personas, proyectos, equipos, extra = [] }) {
  const hoy = hoyISO();
  const items = [...extra];
  const nomProy = id => (proyectos.find(p => p.id === id) || {}).nombre || 'Oficina';
  const eqs = ctx.rol === 'rrhh' ? equipos : ctx.rol === 'terreno' && ctx.personaId ? equipos.filter(e => e.ubicacion.lugar === 'terreno' && e.ubicacion.personaId === ctx.personaId) : [];
  for (const e of eqs) {
    const c = e.calibracion, donde = e.ubicacion.lugar === 'terreno' ? ` · en terreno: ${nomProy(e.ubicacion.proyectoId)}` : '';
    if (c.nivel === 'vencida') items.push({ nivel: 'rojo', categoria: 'Equipos', titulo: `Calibración vencida · ${e.nombre}`, detalle: `Venció el ${fechaLegible(c.proxima)}${donde}.`, enlace: `#/equipos/${e.id}`, fecha: c.proxima });
    else if (c.nivel === 'por_vencer') items.push({ nivel: 'ambar', etiqueta: `En ${c.dias} días`, categoria: 'Equipos', titulo: `Calibración · ${e.nombre}`, detalle: `Vence el ${fechaLegible(c.proxima)}${donde}.`, enlace: `#/equipos/${e.id}`, fecha: c.proxima });
    else if (c.nivel === 'sin_dato' && ctx.rol === 'rrhh') items.push({ nivel: 'ambar', etiqueta: 'Falta', categoria: 'Equipos', titulo: `Fecha de calibración · ${e.nombre}`, detalle: 'Registre el certificado de calibración.', enlace: `#/equipos/${e.id}`, fecha: null });
  }
  if (ctx.rol === 'direccion') {
    for (const p of proyectos.filter(x => x.id !== OFICINA_ID && x.estado !== 'cerrado' && x.plazo && x.plazo < hoy && (!x.periodicidad || x.periodicidad.tipo !== 'recurrente'))) items.push({ nivel: 'rojo', etiqueta: 'Atrasado', categoria: 'Proyectos', titulo: `Plazo vencido · ${p.nombre}`, detalle: `Plazo de entrega: ${fechaLegible(p.plazo)}.`, enlace: `#/proyecto/${p.id}`, fecha: p.plazo });
  }
  const nomPers = id => (personas.find(x => x.id === id) || {}).nombre || '';
  items.push(...pendientesEncargo({ rol: ctx.rol, personaId: ctx.personaId, proyectos, hoy, nombre: nomPers }));
  for (const x of await Administracion.pendientes({ rol: ctx.rol, personaId: ctx.personaId, personas, proyectos, hoy }).catch(e => { console.warn(e); return []; })) items.push(x);
  return items;
}

// ─────────────────────────── Inicio ───────────────────────────

export async function inicio(ctx) {
  const [personas, proyectos, equipos] = await Promise.all([listarPersonas(), listarProyectos(), Equipos.listarEquiposConEstado()]);
  const yo = ctx.personaId ? personas.find(p => p.id === ctx.personaId) : null;
  const nomProy = id => (proyectos.find(p => p.id === id) || {}).nombre || (id === OFICINA_ID ? 'Oficina' : 'Proyecto');

  let bienvenida = '';
  if (!personas.length || !yo) {
    bienvenida = `<section class="sis-tarjeta sis-destacada"><h2>¿Quién eres?</h2>
      <p>Elígete una vez y el Sistema te muestra lo tuyo y anota quién hace cada cosa.</p>
      <div class="sis-acciones"><a class="sis-btn primario" href="#/quien">Elegir quién soy</a></div></section>`;
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

    const pend = await misPendientes(ctx, { personas, proyectos, equipos });
    return `${saludo}${bienvenida}${tarjetaPrincipal(accionPrincipal('rrhh', pend))}
      ${filaKpis(kpiSi(vencidas.length, `${ICONO.calib}Calibraciones vencidas`, '#/equipos', 'rojo'), kpiSi(porVencer.length, `${ICONO.calib}Calibraciones por vencer`, '#/equipos', 'ambar'), kpiSi(conAlerta.length, `${ICONO.alerta}Equipos con problema`, '#/equipos', 'rojo'))}
      <div class="sis-dos"><div>
        ${tarjetaPendientes(pend, ctx)}
      </div><aside>
        ${conAlerta.length ? `<section class="sis-tarjeta"><h2>Equipos con problema</h2><div class="sis-lista">${conAlerta.map(e => `<a class="sis-fila" href="#/equipos/${esc(e.id)}">
              <span class="sis-fila-txt"><b>${esc(e.nombre)}</b>${e.alertasActivas.map(a => `<span class="sis-tenue">${esc(a.descripcion)} · desde ${fechaLegible((a.fechaReporte || '').slice(0, 10))}</span>`).join('')}</span>
              <span class="sis-chips">${e.alertasActivas.map(a => `<span class="sis-chip rojo">${esc(estadoAlerta(a.estado))}</span>`).join('')}</span></a>`).join('')}</div></section>` : ''}
        <section class="sis-tarjeta"><h2>Equipos en terreno</h2>
        ${Object.keys(porProyecto).length ? Object.entries(porProyecto).map(([pid, lista]) => `
          <div class="sis-grupo"><a class="sis-grupo-cab" href="#/proyecto/${esc(pid)}">${ICONO.proyecto}${esc(nomProy(pid))} <span class="sis-tenue">${lista.length} equipo${lista.length > 1 ? 's' : ''}</span></a>
          <div class="sis-lista">${lista.map(e => filaEquipo(e)).join('')}</div></div>`).join('')
          : vacio('Todos los equipos están en la oficina.')}</section>
      </aside></div>`;
  }

  if (ctx.rol === 'direccion') {
    // v0.19 · Tablero de Jefatura: un semáforo por proyecto y solo las decisiones que le tocan.
    const hoy = hoyISO();
    const nomPers = id => (personas.find(x => x.id === id) || {}).nombre || '';
    const PESO = { rojo: 0, ambar: 1, verde: 2 };
    const tablero = activos.map(p => ({ p, s: semaforoProyecto(p, hoy) })).sort((a, b) => PESO[a.s.color] - PESO[b.s.color] || String(a.p.plazo || '9999').localeCompare(String(b.p.plazo || '9999')));
    const n = contarSemaforo(tablero.map(x => x.s));
    const pend = await misPendientes(ctx, { personas, proyectos, equipos });
    const fila = ({ p, s: se }) => `<a class="ini-semaforo-fila" href="#/proyecto/${esc(p.id)}"><i class="ini-luz ${se.color}" role="img" aria-label="${{ rojo: 'Rojo', ambar: 'Ámbar', verde: 'Verde' }[se.color]}"></i>
        <span class="sis-fila-txt"><b>${esc(p.nombre)}</b><span>${esc(se.motivo)}</span><span class="sis-tenue">${esc(p.mandante || 'Sin mandante')}${p.encargadoId ? ` · ${esc(nomPers(p.encargadoId))}` : ''}${p.plazo ? ` · plazo ${fechaLegible(p.plazo)}` : ''}</span></span>
        ${se.pct ? `<span class="sg-mini ini-avance" title="Avance: ${se.pct} %"><i style="width:${se.pct}%"></i></span>` : ''}</a>`;
    return `${saludo}${bienvenida}${tarjetaPrincipal(accionPrincipal('direccion', pend))}
      <div class="sis-dos"><div>
        <section class="sis-tarjeta" aria-labelledby="ini-sem-t"><div class="sis-cab"><div><h2 id="ini-sem-t">Cómo van los proyectos</h2><span class="sis-tenue">Rojo: necesita una decisión. Ámbar: atención. Verde: avanza bien.</span></div>
            <div class="sis-chips">${n.rojo ? `<span class="sis-chip rojo">${n.rojo} en rojo</span>` : ''}${n.ambar ? `<span class="sis-chip ambar">${n.ambar} en ámbar</span>` : ''}${n.verde ? `<span class="sis-chip verde">${n.verde} en verde</span>` : ''}</div></div>
          ${tablero.length ? `<div class="ini-semaforo">${tablero.map(fila).join('')}</div>` : vacio('Aún no hay proyectos activos.', '<a class="sis-btn primario" href="#/encargo/nuevo">+ Encargar proyecto</a>')}
        </section>
      </div><aside>
        ${tarjetaPendientes(pend, ctx, { titulo: 'Tus decisiones' })}
        <section class="sis-tarjeta"><h2>Atajos</h2><div class="ini-atajos">
          <a class="sis-btn" href="#/encargo/nuevo">+ Encargar proyecto</a><a class="sis-btn" href="#/personal/distribucion">Dónde está cada persona</a>
          <a class="sis-btn" href="#/comercial">Estado comercial</a><a class="sis-btn" href="#/equipos">Equipos</a></div></section>
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

  const pend = await misPendientes(ctx, { personas, proyectos, equipos, extra: [
        ...permisos.map(v => ({ nivel: v.limite < hoy ? 'rojo' : 'ambar', etiqueta: v.limite < hoy ? 'Plazo vencido' : `Hasta ${diaCorto(v.limite)}`, categoria: 'Permisos DGAC', titulo: `Pedir permiso DGAC · ${v.nombre}`, detalle: `Vuelo el ${fechaLegible(v.fechas[0])}. ${v.limite < hoy ? `El plazo sugerido (7 días hábiles) venció el ${fechaLegible(v.limite)}.` : `Presentar a más tardar el ${fechaLegible(v.limite)}.`}${v.docsPendientes ? ` Faltan ${v.docsPendientes} documentos.` : ''}`, enlace: `#/vuelos/plan/${v.id}`, fecha: v.limite })),
        ...logs.map(v => ({ nivel: 'rojo', etiqueta: 'Pendiente', categoria: 'Permisos DGAC', titulo: `Subir el log del vuelo · ${v.nombre}`, detalle: `${v.proyectoId ? `${nomProy(v.proyectoId)} ya está en ${NOMBRE_ETAPA_PROYECTO[etapaDe(v.proyectoId)].toLowerCase()}. ` : ''}Cárguelo en el paso Permisos de la hoja de vuelo.`, enlace: `#/vuelos/plan/${v.id}`, fecha: null })),
        ...entregas.filter(e => !yo || (proyectos.find(p => p.id === e.proyectoId) || {}).encargadoId === yo.id).map(e => ({ nivel: 'ambar', etiqueta: `En ${diasEntre(hoy, e.fecha)} días`, categoria: 'Entregas', titulo: e.texto, detalle: `Fecha de entrega: ${fechaLegible(e.fecha)}.`, enlace: e.enlace || '#/seguimiento', fecha: e.fecha })),
  ] });
  return `${saludo}${bienvenida}${tarjetaPrincipal(accionPrincipal('terreno', pend))}
    ${filaKpis(kpiSi(semana.length, 'Vuelos esta semana', '#/vuelos', '', `${voladosSem} volado${voladosSem === 1 ? '' : 's'} · ${semana.length - voladosSem} por volar`),
      kpiSi(entregas.length, 'Entregas en 7 días', '#/seguimiento', 'ambar', entregas[0] ? `la primera: ${esc(diaCorto(entregas[0].fecha))}` : ''),
      kpiSi(equiposAlerta.length, 'Equipos con aviso', '#/equipos', 'ambar'))}
    <div class="sis-dos ini-dos"><div>
      ${tarjetaPendientes(pend, ctx)}
      ${(() => { // v0.17 · Mis proyectos: lo encargado por Jefatura y lo propio, con su avance técnico
        const mios = activos.filter(p => yo && genteDeProyecto(p).includes(yo.id));
        const fila = p => { const deJ = p.encargo && p.encargo.emitidoPor && p.encargo.emitidoPor !== (yo && yo.id); const r = resumenCronograma(p.cronograma, hoy);
          return `<a class="sis-fila" href="#/proyecto/${esc(p.id)}"><span class="sis-fila-txt"><b>${esc(p.nombre)}</b><span class="sis-tenue">${esc(p.mandante || 'Sin mandante')}${p.plazo ? ` · plazo ${fechaLegible(p.plazo)}` : ''}${r.total ? ` · ${r.hechas}/${r.total} actividades` : ''}</span></span>
            <span class="sis-chips">${sinAcuse(p) && p.encargadoId === (yo && yo.id) ? '<span class="sis-chip rojo">Confirmar que lo recibí</span>' : ''}${r.atrasadas.length ? `<span class="sis-chip ambar">${r.atrasadas.length} atrasada${r.atrasadas.length > 1 ? 's' : ''}</span>` : ''}<span class="sis-chip ${deJ ? 'azul' : 'gris'}">${deJ ? 'Encargo de Jefatura' : 'Propio'}</span>${p.capas ? '<span class="sis-chip gris">Capas</span>' : ''}</span></a>`; };
        return `<section class="sis-tarjeta"><div class="sis-cab"><h2>Mis proyectos</h2><a class="sis-btn chico primario" href="#/proyecto-tecnico/nuevo">+ Nuevo proyecto</a></div>
          ${mios.length ? `<div class="sis-lista">${mios.map(fila).join('')}</div>` : '<p class="sis-tenue">No tienes proyectos a tu cargo. Lo que encargue Jefatura llega aquí; si un trabajo llegó por correo, créelo con «Nuevo proyecto».</p>'}</section>`; })()}
      <section class="sis-tarjeta"><div class="sis-cab"><h2>Calendario · proyectos activos</h2><a class="sis-btn chico" href="#/proyectos/calendario">Ver mes completo</a></div>
        ${htmlFranjaProyectos(eventos, proyectos, lunes)}</section>
    </div><aside>
      ${equiposAlerta.length ? `<section class="sis-tarjeta"><h2>Equipos con aviso</h2>
        ${equiposAlerta.length ? `<div class="sis-lista">${equiposAlerta.slice(0, 8).map(e => filaEquipo(e, { nombreProyecto: nomProy })).join('')}</div>${equiposAlerta.length > 8 ? `<p class="sis-tenue">y ${equiposAlerta.length - 8} más en Equipos.</p>` : ''}`
          : ''}
      </section>` : ''}
      ${yo ? `<section class="sis-tarjeta"><h2>Equipos a mi cargo</h2>${aMiCargo.length ? `<div class="sis-lista">${aMiCargo.map(e => filaEquipo(e, { nombreProyecto: nomProy })).join('')}</div>` : vacio('No tienes equipos a tu cargo. Se asignan con el checklist de salida en Equipos.')}</section>` : ''}
    </aside></div>`;
}

