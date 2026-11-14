// app/vistas.js — pantallas propias del Sistema: Personas, Avisos y «Próximamente», más las acciones de todas.
// v0.14.1: Inicio pasó a vistas-inicio.js, Proyectos a vistas-proyectos.js y las piezas comunes a vistas-ui.js.
// Las pantallas de los módulos las pone cada módulo (montar()); aquí solo se leen sus datos por la puerta de entrada.


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
import { leerTexto as leerLS, escribirTexto as escribirLS } from '../compartido/util.js';
import { guardarArchivo } from '../compartido/archivos.js';
import * as Administracion from '../modulos/administracion/administracion.js';
import { habilitacionPersona } from '../modulos/administracion/modelo.js';
import { inicio, htmlFranjaProyectos } from './vistas-inicio.js';
import { proyectos, proyecto, proyectoEditar, datosRegistro } from './vistas-proyectos.js';

export { htmlFranjaProyectos };

// ─────────────────────────── Personas ───────────────────────────

async function personas(ctx) {
  const lista = await listarPersonas();
  const adm = await Administracion.datos().catch(() => null);
  const hab = id => (adm ? habilitacionPersona(id, { ...adm, hoy: hoyISO(), diasAviso: adm.config.diasAviso }) : null);
  const chipH = h => (!h ? '' : h.nivel === 'no' ? '<span class="sis-chip rojo">No habilitado</span>' : '<span class="sis-chip verde">Habilitado</span>');
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
    <p class="sis-tenue">Personas que usan el Sistema y su rol. Una persona puede tener más de un rol. La habilitación considera los documentos obligatorios; ${editable ? 'el detalle se administra en «Documentación».' : 'el detalle lo administra Recursos Humanos.'}</p>
    ${form}
    ${ctx.estado.vincular ? await tarjetaVincular(lista.find(x => x.id === ctx.estado.vincular)) : ''}
    <section class="sis-tarjeta">${lista.length ? `<div class="sis-lista">${lista.map(x => `<div class="sis-fila">
        <span class="sis-fila-txt"><b>${esc(x.nombre)}</b><span class="sis-tenue">${esc(x.cargo || 'Sin cargo')}</span></span>
        <span class="sis-chips">${chipH(hab(x.id))}${(x.roles || []).map(r => `<span class="sis-chip gris">${esc(NOMBRE_ROL_PERSONA[r] || r)}</span>`).join('')}
        ${editable ? `<a class="sis-btn chico" href="#/personal/${esc(x.id)}">Ficha</a>` : ''}
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

// ─────────────────────────── Próximamente ───────────────────────────

const PRONTO = {
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
      alcance: (datos.get('alcance') || '').trim(),
      entregablesPedidos: (datos.get('entregablesPedidos') || '').trim(),
      ...(datos.has('mandanteId') ? { mandanteId: datos.get('mandanteId') || null } : {}),
      ...(datos.has('montoCotizado') ? { montoCotizado: datos.get('montoCotizado') === '' ? '' : Number(datos.get('montoCotizado')) } : {}),
      ...(datos.has('conCuadrilla') ? { cuadrilla: datos.getAll('cuadrilla'), vehiculoIds: datos.getAll('vehiculoIds') } : {}),
    }, { personaId: ctx.personaId });
    ctx.avisar(id ? 'Proyecto guardado' : 'Proyecto creado');
    ctx.ir(`#/proyecto/${r.id}`);
    return false;
  }
  if (form.dataset.form === 'entregable') {
    const p = await obtenerProyecto(form.dataset.id);
    const e = { id: nuevoCodigo() + Date.now().toString(36), nombre: (datos.get('nombre') || '').trim(), version: (datos.get('version') || '').trim(), revisoId: datos.get('revisoId') || null, enviado: datos.get('enviado') || '', estado: datos.get('enviado') ? 'enviado' : 'pendiente' };
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
    await guardarArchivo(f, { modulo: 'proyectos', duenoTipo: 'encargo', duenoId: p.id, rol: 'documento', proyectoId: p.id, carpeta: `Proyectos/${p.nombre.replace(/[\\/:*?"<>|]+/g, '_')}/Encargo` }, { personaId: ctx.personaId });
    ctx.avisar('Archivo adjuntado'); return true;
  }
  if (input.dataset.accion === 'cal-proyecto') { ctx.estado.cal = { ...(ctx.estado.cal || { modo: 'mes', ref: hoyISO() }), proyecto: input.value }; return true; }
  return false;
}

export { obtenerPersona };
