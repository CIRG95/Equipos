// app/vistas.js — pantallas propias del Sistema: Inicio, Proyectos, Personas y «Próximamente».
// Las pantallas de Equipos las pone el propio módulo (montar()); aquí solo se leen sus datos por la puerta de entrada.

import { escapar as esc, fechaLegible, fechaHoraLegible, hoyISO, diasEntre } from '../compartido/util.js';
import { enviarAPapelera, enPapelera, restaurar } from '../compartido/papelera.js';
import {
  listarProyectos, obtenerProyecto, guardarProyecto, listarPersonas, obtenerPersona, guardarPersona, OFICINA_ID,
} from '../compartido/catalogos.js';
import * as Equipos from '../modulos/equipos/equipos.js';
import * as Vuelos from '../modulos/vuelos/vuelos.js';
import { ROLES, COLORES_MARCA, CATEGORIAS_TRABAJO, NOMBRE_CATEGORIA, tiposDeProyecto, textosTipos, ROLES_PERSONA, NOMBRE_ROL_PERSONA, REGIONES } from './catalogo.js';
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

  // Encargado de terreno
  const aMiCargo = yo ? equipos.filter(e => e.ubicacion.lugar === 'terreno' && e.ubicacion.personaId === yo.id) : [];
  const avisos = aMiCargo.filter(e => e.alertasActivas.length || ['vencida', 'por_vencer'].includes(e.calibracion.nivel));
  const misProyectos = yo ? activos.filter(p => p.encargadoId === yo.id) : [];
  const otros = activos.filter(p => !misProyectos.includes(p));
  const tarjetaProy = p => `<a class="sis-proy" href="#/proyecto/${esc(p.id)}">
      <b>${esc(p.nombre)}</b><span class="sis-tenue">${esc(p.mandante || 'Sin mandante')}${p.comuna ? ` · ${esc(p.comuna)}` : ''}</span>
      <span class="sis-chips">${tiposDeProyecto(p).categorias.map(t => `<span class="sis-chip gris">${esc(NOMBRE_CATEGORIA[t])}</span>`).join('')}</span></a>`;

  return `${saludo}${bienvenida}
    <div class="sis-dos"><div>
    ${avisos.length ? `<section class="sis-tarjeta sis-aviso"><h2>${ICONO.alerta} Ojo con estos equipos a tu cargo</h2>
      <div class="sis-lista">${avisos.map(e => filaEquipo(e, { nombreProyecto: nomProy })).join('')}</div>
      <p class="sis-tenue">Se pueden usar igual: el uso con alerta queda registrado.</p></section>` : ''}
      <section class="sis-tarjeta">
        <div class="sis-cab"><h2>Proyectos activos</h2><a class="sis-btn chico" href="#/proyecto-editar/nuevo">+ Proyecto</a></div>
        ${misProyectos.length ? `<p class="sis-sub">A mi cargo</p><div class="sis-proys">${misProyectos.map(tarjetaProy).join('')}</div>` : ''}
        ${otros.length ? `${misProyectos.length ? '<p class="sis-sub">Otros</p>' : ''}<div class="sis-proys">${otros.map(tarjetaProy).join('')}</div>` : ''}
        ${!activos.length ? vacio('Aún no hay proyectos. Crea el primero con el encargo que te llegó.') : ''}
      </section>
    </div><aside>
      <section class="sis-tarjeta">
        <h2>Equipos a mi cargo</h2>
        ${aMiCargo.length ? `<div class="sis-lista">${aMiCargo.map(e => filaEquipo(e, { nombreProyecto: nomProy })).join('')}</div>`
          : vacio(yo ? 'No tienes equipos a tu cargo. Se asignan al confirmar el checklist de salida en Equipos.' : 'Elige tu persona para ver tus equipos.',
            yo ? '<a class="sis-btn" href="#/equipos">Ir a Equipos</a>' : '')}
      </section>
    </aside></div>`;
}

function estadoAlerta(e) {
  return { abierta: 'Abierta', en_mantencion: 'En mantención', recibida: 'Recibida de mantención', cerrada: 'Cerrada' }[e] || e;
}

// ─────────────────────────── Proyectos ───────────────────────────

async function proyectos(ctx) {
  const [lista, personas, equipos] = await Promise.all([listarProyectos(), listarPersonas(), Equipos.listarEquiposConEstado()]);
  const verCerrados = ctx.estado.verCerrados;
  const nomPers = id => (personas.find(p => p.id === id) || {}).nombre || '';
  const enProyecto = id => equipos.filter(e => e.ubicacion.lugar === 'terreno' && e.ubicacion.proyectoId === id).length;
  const visibles = lista.filter(p => p.id === OFICINA_ID || verCerrados || p.estado !== 'cerrado');
  const nCerrados = lista.filter(p => p.estado === 'cerrado').length;
  const eliminados = (await enPapelera('compartido_proyectos')).map(x => x.registro);

  return `<div class="sis-cab"><h1>Proyectos</h1><a class="sis-btn primario" href="#/proyecto-editar/nuevo">+ Proyecto</a></div>
    <p class="sis-tenue">El proyecto es el eje: de aquí cuelgan los equipos que salen, los certificados para el mandante y, en las próximas versiones, los gastos y las jornadas.</p>
    ${nCerrados ? `<label class="sis-check"><input type="checkbox" data-accion="ver-cerrados" ${verCerrados ? 'checked' : ''}> Mostrar cerrados (${nCerrados})</label>` : ''}
    <div class="sis-proys grande">${visibles.map(p => `<a class="sis-proy" href="#/proyecto/${esc(p.id)}">
        <span class="sis-proy-cab"><b>${esc(p.nombre)}</b>${p.id === OFICINA_ID ? '<span class="sis-chip gris">Especial</span>' : p.estado === 'cerrado' ? '<span class="sis-chip gris">Cerrado</span>' : '<span class="sis-chip verde">Activo</span>'}</span>
        <span class="sis-tenue">${esc(p.mandante || (p.id === OFICINA_ID ? 'Trabajo que no es de un contrato' : 'Sin mandante'))}${p.comuna ? ` · ${esc(p.comuna)}` : ''}${p.encargadoId ? ` · ${esc(nomPers(p.encargadoId))}` : ''}</span>
        <span class="sis-chips">${tiposDeProyecto(p).categorias.map(t => `<span class="sis-chip gris">${esc(NOMBRE_CATEGORIA[t])}</span>`).join('')}${enProyecto(p.id) ? `<span class="sis-chip azul">${enProyecto(p.id)} equipo${enProyecto(p.id) > 1 ? 's' : ''} en terreno</span>` : ''}</span>
      </a>`).join('')}</div>
    ${eliminados.length ? `<details class="sis-papelera"><summary>Papelera de proyectos (${eliminados.length})</summary>
      <section class="sis-tarjeta"><div class="sis-lista">${eliminados.map(p => `<div class="sis-fila">
        <span class="sis-fila-txt"><b>${esc(p.nombre)}</b><span class="sis-tenue">Eliminado ${fechaHoraLegible(p.eliminadoEn)}</span></span>
        <button class="sis-btn chico" data-accion="restaurar-proyecto" data-id="${esc(p.id)}">Restaurar</button></div>`).join('')}</div></section></details>` : ''}`;
}

async function proyecto(ctx, id) {
  const p = await obtenerProyecto(id);
  if (!p || p.eliminadoEn) return vacio('Este proyecto no existe o está en la papelera.', '<a class="sis-btn" href="#/proyectos">Volver a Proyectos</a>');
  const [personas, equipos, certs, planes] = await Promise.all([listarPersonas(), Equipos.listarEquiposConEstado(), Equipos.certificadosDeProyecto(id), Vuelos.planesDeProyecto(id)]);
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
          ${meta('Encargado por', esc(p.solicitadoPor || ''))}${meta('Encargo', p.fechaEncargo ? fechaLegible(p.fechaEncargo) : '')}${meta('Plazo', plazo)}`}
        </div>
        ${textosTipos(p).length ? `<div class="sis-chips" style="margin-top:10px">${textosTipos(p).map(t => `<span class="sis-chip gris">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="sis-acciones">${esOficina ? '<span class="sis-chip gris">Especial</span>' : `<span class="sis-chip ${p.estado === 'cerrado' ? 'gris' : 'verde'}">${p.estado === 'cerrado' ? 'Cerrado' : 'Activo'}</span>
        <a class="sis-btn chico" href="#/proyecto-editar/${esc(p.id)}">Editar</a>`}</div>
    </div>
    ${p.notas ? `<p class="sis-notas">${esc(p.notas)}</p>` : ''}
    <div class="sis-dos"><div>
      <section class="sis-tarjeta">
        <div class="sis-cab"><h2>Planes de vuelo</h2>${ctx.rol === 'terreno' ? `<a class="sis-btn chico" href="#/vuelos/proyecto/${esc(id)}">+ Planificar vuelo</a>` : ''}</div>
        ${planes.length ? `<div class="sis-lista">${planes.map(v => `<a class="sis-fila" href="#/vuelos/plan/${esc(v.id)}">
            <span class="sis-fila-txt"><b>${esc(v.nombre)}</b><span class="sis-tenue">${esc(v.dron)}</span></span>
            <span class="sis-chips">${v.resumen.area ? `<span class="sis-chip gris">${(v.resumen.area / 10000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} ha</span>` : ''}${v.resumen.gsd ? `<span class="sis-chip gris">GSD ${v.resumen.gsd.toLocaleString('es-CL', { maximumFractionDigits: 2 })} cm</span>` : ''}${v.resumen.densidad ? `<span class="sis-chip gris">${Math.round(v.resumen.densidad)} pts/m²</span>` : ''}${v.resumen.vuelos ? `<span class="sis-chip azul">${v.resumen.vuelos} vuelo${v.resumen.vuelos > 1 ? 's' : ''}</span>` : ''}</span></a>`).join('')}</div>`
          : '<div class="sis-vacio"><p>Sin planes de vuelo. Desde aquí se calcula GSD, líneas, tiempo y baterías con el KMZ del área.</p></div>'}
      </section>
      <section class="sis-tarjeta sis-pronto"><h2>Jornadas de terreno</h2><p>Llega cuando Terreno Topografía entre al Sistema.</p></section>
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
    <section class="sis-tarjeta">${lista.length ? `<div class="sis-lista">${lista.map(x => `<div class="sis-fila">
        <span class="sis-fila-txt"><b>${esc(x.nombre)}</b><span class="sis-tenue">${esc(x.cargo || 'Sin cargo')}</span></span>
        <span class="sis-chips">${(x.roles || []).map(r => `<span class="sis-chip gris">${esc(NOMBRE_ROL_PERSONA[r] || r)}</span>`).join('')}
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

// ─────────────────────────── Próximamente ───────────────────────────

const PRONTO = {
  gastos: { titulo: 'Gastos', version: 'una próxima versión', texto: 'Cada gasto con la foto de su boleta, dentro de su proyecto (o en «Oficina»). La rendición pasa por borrador → emitida → devuelta → abonada, y RRHH registra el abono. Las boletas quedan respaldadas en la carpeta del proyecto.' },
  terreno: { titulo: 'Libreta de terreno', version: 'una próxima versión', texto: 'Terreno Topografía entra al Sistema: jornadas y levantamientos dentro de cada proyecto, con los equipos que salieron en el checklist. Mientras tanto, sigue usando la app de Terreno por separado.' },
};

function pronto(ctx, clave) {
  const x = PRONTO[clave];
  return `<section class="sis-tarjeta sis-pronto grande"><h1>${x.titulo}</h1><p><span class="sis-chip ambar">Llega en ${x.version}</span></p><p>${x.texto}</p></section>`;
}

export const VISTAS = { inicio, proyectos, proyecto, proyectoEditar, personas, pronto };

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
      notas: (datos.get('notas') || '').trim(),
    }, { personaId: ctx.personaId });
    ctx.avisar(id ? 'Proyecto guardado' : 'Proyecto creado');
    ctx.ir(`#/proyecto/${r.id}`);
    return false;
  }
  return false;
}

export async function manejarClic(boton, ctx) {
  switch (boton.dataset.accion) {
    case 'abrir-pdf': await Equipos.abrirArchivo(boton.dataset.id); return false;
    case 'nueva-persona': ctx.estado.personaEditar = 'nueva'; return true;
    case 'editar-persona': ctx.estado.personaEditar = boton.dataset.id; return true;
    case 'cancelar-persona': ctx.estado.personaEditar = null; return true;
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
      await guardarProyecto({ id: p.id, estado: p.estado === 'cerrado' ? 'activo' : 'cerrado' }, { personaId: ctx.personaId });
      ctx.avisar(p.estado === 'cerrado' ? 'Proyecto reabierto' : 'Proyecto cerrado');
      ctx.ir(`#/proyecto/${p.id}`);
      return false;
    }
  }
  return false;
}

export async function manejarCambio(input, ctx) {
  if (input.dataset.accion === 'ver-cerrados') { ctx.estado.verCerrados = input.checked; return true; }
  return false;
}

export { obtenerPersona };
