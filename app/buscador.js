// app/buscador.js — buscador lateral del Sistema (v0.16; reemplaza al campo del encabezado de la v0.15).
// Panel al costado derecho que busca según la sección abierta, con filtros propios de esa sección:
//   · en Inicio busca en todo el Sistema (la única búsqueda cruzada) y los filtros son por tipo de registro;
//   · en Proyectos solo busca proyectos (etapa, mandante, tipo de trabajo); en Equipos solo equipos (tipo,
//     ubicación, calibración); en Personas solo personas, y así en cada sección. Los filtros no se mezclan:
//     cada sección recuerda los suyos.
// El índice se arma al abrir el panel y se renueva cada minuto o al cambiar de rol. La lógica pura (ámbitos,
// filtrado) está separada de la pantalla para probarla en pruebas/buscador.test.mjs.

import { escapar as esc, leerTexto, escribirTexto } from '../compartido/util.js';
import { listarProyectos, listarPersonas, OFICINA_ID } from '../compartido/catalogos.js';
import * as Equipos from '../modulos/equipos/equipos.js';
import * as Vuelos from '../modulos/vuelos/vuelos.js';
import * as Administracion from '../modulos/administracion/administracion.js';
import * as Planificacion from '../modulos/planificacion/planificacion.js';
import { todasLasMonografias } from '../modulos/monografias/datos.js';
import { NOMBRE_CATEGORIA, tiposDeProyecto, NOMBRE_ETAPA_PROYECTO, etapaProyecto, NOMBRE_ROL_PERSONA } from './catalogo.js';

export const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Ámbito de búsqueda de cada sección del menú: qué tipos de registro incluye y con qué filtros.
 * Cada filtro lee un campo de `f` del registro; las opciones salen de los propios datos.
 */
export const AMBITOS = {
  inicio: { titulo: 'Todo el Sistema', ayuda: 'Proyectos, personas, equipos, vehículos, puntos y monografías.', tipos: null, filtros: [['tipo', 'Tipo de registro']], cruzada: true },
  proyectos: { titulo: 'Proyectos', tipos: ['Proyecto'], filtros: [['etapa', 'Etapa'], ['mandante', 'Mandante'], ['trabajo', 'Tipo de trabajo']] },
  planificacion: { titulo: 'Planificación', ayuda: 'Puntos de las redes geodésicas.', tipos: ['Punto'], filtros: [['clase', 'Clase de punto'], ['proyecto', 'Proyecto']] },
  vuelos: { titulo: 'Vuelos', ayuda: 'Hojas de vuelo.', tipos: ['Vuelo'], filtros: [['etapa', 'Etapa'], ['proyecto', 'Proyecto']] },
  equipos: { titulo: 'Equipos', ayuda: 'Por nombre, modelo o N° de serie.', tipos: ['Equipo'], filtros: [['clase', 'Tipo de equipo'], ['ubicacion', 'Ubicación'], ['calibracion', 'Calibración']] },
  personal: { titulo: 'Personas', tipos: ['Persona'], filtros: [['rol', 'Rol en el Sistema']] },
  administracion: { titulo: 'Administración', ayuda: 'Vehículos y mandantes.', tipos: ['Vehículo', 'Mandante'], filtros: [['tipo', 'Tipo de registro']] },
  gastos: { titulo: 'Gastos', ayuda: 'Proyectos con rendiciones.', tipos: ['Proyecto'], filtros: [['etapa', 'Etapa'], ['mandante', 'Mandante']], enlace: x => `#/gastos/proyecto/${x.id}` },
  comercial: { titulo: 'Comercial', ayuda: 'Cotizaciones y licitaciones.', tipos: ['Cotización'], filtros: [['estado', 'Estado']] },
  herramientas: { titulo: 'Monografías', tipos: ['Monografía'], filtros: [['proyecto', 'Proyecto']] },
  conocimiento: { titulo: 'Conocimiento', ayuda: 'Puntos y monografías de todos los proyectos.', tipos: ['Punto', 'Monografía'], filtros: [['tipo', 'Tipo de registro'], ['proyecto', 'Proyecto']] },
};
export const ambitoDe = seccion => (AMBITOS[seccion] ? seccion : 'inicio');

/** Registros del índice que pertenecen al ámbito de la sección (antes de aplicar texto y filtros). */
export function delAmbito(indice, seccion) {
  const a = AMBITOS[ambitoDe(seccion)];
  return a.tipos ? indice.filter(x => a.tipos.includes(x.tipo)) : indice;
}

/** Opciones de cada filtro del ámbito, con cuántos registros tiene cada una: [{ k, texto, opciones: [[valor, n]] }]. */
export function opcionesFiltros(indice, seccion) {
  const a = AMBITOS[ambitoDe(seccion)], base = delAmbito(indice, seccion);
  return a.filtros.map(([k, texto]) => {
    const cuenta = new Map();
    for (const x of base) for (const v of [].concat(x.f[k] ?? []).filter(Boolean)) cuenta.set(v, (cuenta.get(v) || 0) + 1);
    return { k, texto, opciones: [...cuenta.entries()].sort((p, q) => q[1] - p[1] || String(p[0]).localeCompare(String(q[0]), 'es')) };
  }).filter(f => f.opciones.length > 1);
}

/**
 * Busca dentro del ámbito de la sección. `filtros` = { campo: [valores] }: dentro de un campo basta que coincida uno;
 * entre campos deben cumplirse todos. Sin texto ni filtros, en Inicio no devuelve nada (hay que escribir) y en las
 * demás secciones lista todo el ámbito.
 */
export function buscar(indice, seccion, texto, filtros = {}) {
  const a = AMBITOS[ambitoDe(seccion)];
  const partes = norm(texto).trim().split(/\s+/).filter(Boolean);
  const activos = Object.entries(filtros).filter(([k, vs]) => vs && vs.length && a.filtros.some(([c]) => c === k));
  if (a.cruzada && !partes.length && !activos.length) return [];
  if (partes.length === 1 && partes[0].length < 2 && !activos.length && a.cruzada) return [];
  return delAmbito(indice, seccion).filter(x => partes.every(p => x.clave.includes(p))
    && activos.every(([k, vs]) => [].concat(x.f[k] ?? []).some(v => vs.includes(v))));
}

const UBICACION = { oficina: 'En oficina', terreno: 'En terreno', mantencion: 'En mantención', baja: 'De baja' };
const CALIBRACION = { vencida: 'Vencida', por_vencer: 'Por vencer', ok: 'Al día', sin_dato: 'Sin fecha', no_aplica: 'No requiere' };
const ESTADO_COT = { preparacion: 'En preparación', enviada: 'Enviada', ganada: 'Ganada', perdida: 'Perdida' };

async function armarIndice(rol) {
  const [proyectos, personas, equipos, adm, puntos, monos, vuelos] = await Promise.all([
    listarProyectos(), listarPersonas(), Equipos.listarEquiposConEstado().catch(() => []), Administracion.datos().catch(() => null),
    Planificacion.puntosDeRedes().catch(() => []), todasLasMonografias().catch(() => []), Vuelos.listarVuelos().catch(() => []),
  ]);
  const nomProy = id => (proyectos.find(p => p.id === id) || {}).nombre || '';
  const gestiona = rol !== 'terreno';
  const idx = [];
  const poner = (tipo, id, titulo, detalle, enlace, f = {}, extra = '') => idx.push({ tipo, id, titulo: titulo || tipo, detalle, enlace, f: { tipo, ...f }, clave: norm(`${titulo} ${detalle} ${extra}`) });
  for (const p of proyectos) {
    if (p.id === OFICINA_ID) continue;
    poner('Proyecto', p.id, p.nombre, [p.mandante, p.comuna].filter(Boolean).join(' · '), `#/proyecto/${p.id}`,
      { etapa: NOMBRE_ETAPA_PROYECTO[etapaProyecto(p)], mandante: (p.mandante || '').trim() || 'Sin mandante', trabajo: tiposDeProyecto(p).categorias.map(c => NOMBRE_CATEGORIA[c]) }, `${p.region || ''} ${p.alcance || ''}`);
  }
  for (const p of personas) poner('Persona', p.id, p.nombre, p.cargo || '', gestiona ? `#/personal/${p.id}` : '#/personal', { rol: (p.roles || []).map(r => NOMBRE_ROL_PERSONA[r] || r) });
  for (const e of equipos) {
    poner('Equipo', e.id, e.nombre, [e.equipo, e.numeroSerie && `N° ${e.numeroSerie}`].filter(Boolean).join(' · '), `#/equipos/${e.id}`,
      { clase: e.equipo || 'Sin tipo', ubicacion: UBICACION[e.ubicacion && e.ubicacion.lugar] || '', calibracion: CALIBRACION[e.calibracion && e.calibracion.nivel] || '' }, `${e.numeroSerie || ''} ${e.marca || ''} ${e.modelo || ''}`);
  }
  if (adm) {
    for (const v of adm.vehiculos) poner('Vehículo', v.id, v.patente, [v.marca, v.modelo].filter(Boolean).join(' '), gestiona ? `#/administracion/vehiculo/${v.id}` : '#/proyectos');
    if (gestiona) for (const c of adm.cotizaciones) poner('Cotización', c.id, c.nombre, c.mandante || '', '#/comercial/cotizaciones', { estado: ESTADO_COT[c.estado] || '' });
    for (const m of adm.mandantes) poner('Mandante', m.id, m.nombre, m.plataforma || '', gestiona ? `#/administracion/mandantes/${m.id}` : '#/proyectos', {}, (m.alias || []).join(' '));
  }
  for (const p of puntos) poner('Punto', `${p.redId}:${p.nombre}`, p.nombre, `${p.tipo === 'control' ? 'Control' : 'PR'} · ${nomProy(p.proyectoId)}`, `#/planificacion/red/${p.redId}`, { clase: p.tipo === 'control' ? 'Control' : 'PR', proyecto: nomProy(p.proyectoId) });
  for (const m of monos) poner('Monografía', m.id, m.puntoMedido || m.nombre || 'Monografía', nomProy(m.proyectoId), `#/monografias/${m.proyectoId}/${m.id}`, { proyecto: nomProy(m.proyectoId) });
  for (const v of vuelos) poner('Vuelo', v.id, v.nombre || 'Hoja de vuelo', [nomProy(v.proyectoId), v.fecha].filter(Boolean).join(' · '), `#/vuelos/plan/${v.id}`, { etapa: v.etapaTexto || '', proyecto: nomProy(v.proyectoId) });
  return idx;
}

const LUPA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
const MAX = 60;

/**
 * panel: <aside> lateral · boton: botón del encabezado · rol(): rol actual · seccion(): sección del menú abierta.
 * Devuelve { alNavegar() } para que el envoltorio avise los cambios de sección.
 */
export function iniciarBuscador({ panel, boton, rol, seccion }) {
  if (!panel || !boton) return { alNavegar() {} };
  let indice = null, armado = 0, rolIndice = '', sel = -1, res = [], ambito = ambitoDe(seccion());
  const filtros = {}; // por ámbito: { proyectos: { etapa: ['Terreno'] }, equipos: {…} } — no se cruzan
  let texto = '';
  const esPC = () => document.body.dataset.modo === 'pc';

  panel.innerHTML = `<div class="bus-cab"><div><b class="bus-titulo"></b><small class="bus-ayuda"></small></div><button type="button" class="redondo" data-bus="cerrar" aria-label="Cerrar la búsqueda">×</button></div>
    <div class="bus-campo">${LUPA}<input type="search" autocomplete="off" aria-label="Texto a buscar" aria-controls="bus-res"></div>
    <div class="bus-filtros"></div>
    <div class="bus-cuenta" aria-live="polite"></div>
    <div class="bus-res" id="bus-res" role="listbox"></div>`;
  const input = panel.querySelector('input'), cajaRes = panel.querySelector('.bus-res'), cajaFiltros = panel.querySelector('.bus-filtros');

  const asegurar = async () => {
    if (!indice || Date.now() - armado > 60000 || rolIndice !== rol()) { indice = await armarIndice(rol()); armado = Date.now(); rolIndice = rol(); }
    return indice;
  };
  const abierto = () => !panel.hidden;

  function pintarCabecera() {
    const a = AMBITOS[ambito];
    panel.querySelector('.bus-titulo').textContent = a.cruzada ? 'Buscar en todo el Sistema' : `Buscar en ${a.titulo}`;
    panel.querySelector('.bus-ayuda').textContent = a.cruzada ? 'Búsqueda cruzada: solo disponible desde Inicio.' : (a.ayuda || `Solo ${a.titulo.toLowerCase()}. Para buscar en todo, vaya a Inicio.`);
    input.placeholder = a.cruzada ? 'PR, N° de serie, patente, persona, proyecto…' : `Buscar en ${a.titulo.toLowerCase()}…`;
  }

  function pintarFiltros() {
    const f = filtros[ambito] || {};
    const grupos = opcionesFiltros(indice || [], ambito);
    const hay = Object.values(f).some(v => v && v.length);
    cajaFiltros.innerHTML = grupos.map(g => `<div class="bus-grupo"><span>${esc(g.texto)}</span><div>${g.opciones.slice(0, 14).map(([v, n]) => { const on = (f[g.k] || []).includes(v); return `<button type="button" class="bus-chip${on ? ' activo' : ''}" aria-pressed="${on}" data-bus="filtro" data-k="${esc(g.k)}" data-v="${esc(v)}">${esc(v)} <small>${n}</small></button>`; }).join('')}</div></div>`).join('')
      + (hay ? '<button type="button" class="bus-limpiar" data-bus="limpiar">Quitar filtros</button>' : '');
  }

  function pintarResultados() {
    const a = AMBITOS[ambito];
    const cuenta = panel.querySelector('.bus-cuenta');
    if (a.cruzada && !res.length && !texto.trim() && !Object.values(filtros[ambito] || {}).some(v => v && v.length)) {
      cuenta.textContent = '';
      cajaRes.innerHTML = '<p class="bus-vacio">Escriba al menos dos letras o elija un tipo de registro.</p>';
      return;
    }
    cuenta.textContent = res.length ? `${res.length} resultado${res.length === 1 ? '' : 's'}${res.length > MAX ? ` · se muestran ${MAX}` : ''}` : '';
    cajaRes.innerHTML = res.length ? res.slice(0, MAX).map((r, k) => `<a href="${esc(a.enlace && r.tipo === 'Proyecto' ? a.enlace(r) : r.enlace)}" role="option" class="${k === sel ? 'activo' : ''}" aria-selected="${k === sel}">${a.tipos && a.tipos.length === 1 ? '' : `<small>${esc(r.tipo)}</small>`}<span>${esc(r.titulo)}<em>${esc(r.detalle)}</em></span></a>`).join('')
      : `<p class="bus-vacio">Sin resultados en ${esc(a.cruzada ? 'el Sistema' : a.titulo)}.${a.cruzada ? '' : ' La búsqueda en todo el Sistema está en Inicio.'}</p>`;
  }

  async function actualizar() {
    const idx = await asegurar();
    res = buscar(idx, ambito, texto, filtros[ambito] || {});
    sel = res.length && texto.trim() ? 0 : -1;
    pintarFiltros(); pintarResultados();
  }

  // En el computador el panel va bajo el encabezado, que cambia de alto según el ancho de la ventana.
  const medir = () => { const h = document.querySelector('.sis-header'); if (h) document.documentElement.style.setProperty('--alto-cabecera', `${h.offsetHeight}px`); };
  addEventListener('resize', medir);
  function abrir() {
    medir();
    panel.hidden = false; document.body.classList.add('con-busqueda'); boton.setAttribute('aria-expanded', 'true');
    escribirTexto('env_busqueda', '1');
    pintarCabecera();
    actualizar().catch(e => console.warn(e));
    input.focus(); input.select();
  }
  function cerrar() {
    panel.hidden = true; document.body.classList.remove('con-busqueda'); boton.setAttribute('aria-expanded', 'false');
    escribirTexto('env_busqueda', '');
  }

  boton.addEventListener('click', () => (abierto() ? cerrar() : abrir()));
  input.addEventListener('input', () => { texto = input.value; actualizar().catch(e => console.warn(e)); });
  input.addEventListener('keydown', ev => {
    const n = Math.min(res.length, MAX);
    if (ev.key === 'ArrowDown') { ev.preventDefault(); sel = Math.min(n - 1, sel + 1); pintarResultados(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); sel = Math.max(0, sel - 1); pintarResultados(); }
    else if (ev.key === 'Enter' && res[sel]) { ev.preventDefault(); const a = cajaRes.querySelectorAll('a')[sel]; if (a) a.click(); }
    else if (ev.key === 'Escape') cerrar();
    const act = cajaRes.querySelector('a.activo'); if (act) act.scrollIntoView({ block: 'nearest' });
  });
  panel.addEventListener('click', ev => {
    const b = ev.target.closest('[data-bus]');
    if (b) {
      if (b.dataset.bus === 'cerrar') cerrar();
      else if (b.dataset.bus === 'limpiar') { filtros[ambito] = {}; actualizar(); }
      else if (b.dataset.bus === 'filtro') {
        const f = (filtros[ambito] = filtros[ambito] || {}), lista = new Set(f[b.dataset.k] || []);
        lista.has(b.dataset.v) ? lista.delete(b.dataset.v) : lista.add(b.dataset.v);
        f[b.dataset.k] = [...lista];
        actualizar();
      }
      return;
    }
    // En el teléfono el panel ocupa la pantalla: al elegir un resultado se cierra. En el computador queda abierto.
    if (ev.target.closest('.bus-res a') && !esPC()) cerrar();
  });
  document.addEventListener('keydown', ev => {
    const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test((ev.target.tagName || '')) || ev.target.isContentEditable;
    if ((ev.key === 'k' && (ev.ctrlKey || ev.metaKey)) || (ev.key === '/' && !enCampo)) { ev.preventDefault(); abrir(); }
  });

  if (leerTexto('env_busqueda') === '1' && esPC()) { medir(); panel.hidden = false; document.body.classList.add('con-busqueda'); boton.setAttribute('aria-expanded', 'true'); pintarCabecera(); actualizar().catch(() => {}); }

  return {
    /** El envoltorio avisa cada cambio de pantalla: el panel pasa al ámbito de la sección nueva con sus propios filtros. */
    alNavegar() {
      const nuevo = ambitoDe(seccion());
      if (nuevo === ambito && rolIndice === rol()) return;
      ambito = nuevo;
      if (abierto()) { pintarCabecera(); actualizar().catch(e => console.warn(e)); }
    },
  };
}
