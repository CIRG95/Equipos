// app/sistema.js — envoltorio GLOBAL del Sistema de trabajo Topoland (Sistema v0.1).
// Reemplaza al envoltorio de prueba de Equipos: menú por rol, persona, modo teléfono/PC, nube,
// y monta cada módulo en el contenedor por su puerta de entrada.
// Se empaqueta con esbuild en sistema-app.js (script clásico), igual que equipos-app.js.

import { listarPersonas, guardarPersona } from '../compartido/catalogos.js';
import * as Equipos from '../modulos/equipos/equipos.js';
import * as Vuelos from '../modulos/vuelos/vuelos.js';
import { iniciarPanelNube } from './nube-panel.js';
import { VISTAS, manejarEnvio, manejarClic, manejarCambio } from './vistas.js';
import { ROLES } from './catalogo.js';
import { VERSION_SISTEMA, MODULOS_INCLUIDOS } from './version.js';

window.ModuloEquipos = Equipos; // puerta de entrada para scripts clásicos (Terreno, más adelante)

const $ = id => document.getElementById(id);
const selRol = $('sis-rol');
const selPersona = $('sis-persona');
const contenedor = $('sis-contenido');
const menu = $('sis-menu');
let montado = null;          // módulo montado ({ desmontar, refrescar }) o null si es una pantalla del Sistema
let rutaActual = '';
let timerAviso = null;
const estado = { verCerrados: false, personaEditar: null }; // estado de pantallas del Sistema

const leer = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const escribir = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

// ── Modo de la pantalla (misma regla que Terreno y Equipos; comparte la preferencia env_modo) ──
const MODOS = ['auto', 'telefono', 'pc'];
const NOMBRE_MODO = { auto: 'automático', telefono: 'teléfono', pc: 'computador' };
function modoApp() {
  const p = leer('env_modo', 'auto');
  if (p !== 'auto') return p;
  try { return matchMedia('(min-width: 900px) and (pointer: fine)').matches ? 'pc' : 'telefono'; } catch { return 'telefono'; }
}
function aplicarModo() { document.body.dataset.modo = modoApp(); }
$('sis-modo').addEventListener('click', () => {
  const sig = MODOS[(MODOS.indexOf(leer('env_modo', 'auto')) + 1) % MODOS.length];
  escribir('env_modo', sig);
  aplicarModo();
  avisar(`Modo ${NOMBRE_MODO[sig]}`);
});
addEventListener('resize', aplicarModo);

function avisar(texto) {
  const el = $('sis-aviso');
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => { el.hidden = true; }, 3000);
}

// ── Menú por rol ──
const ic = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONOS_MENU = {
  inicio: ic('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  proyectos: ic('<path d="M3 7h6l2 2h10v10H3z"/>'),
  equipos: ic('<path d="M12 3v11"/><path d="M5 21l7-7 7 7"/><circle cx="12" cy="3" r="1.5"/>'),
  vuelos: ic('<path d="M12 9v6M9 12h6"/><circle cx="5" cy="5" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3"/>'),
  gastos: ic('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
  terreno: ic('<path d="M4 20l5-14 5 9 3-5 3 10z"/>'),
  personas: ic('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.8c1.9.8 3.1 2.6 3.5 5.2"/>'),
  mas: ic('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'),
};
const MENU = [
  { ruta: 'inicio', texto: 'Inicio', roles: ['terreno', 'rrhh'] },
  { ruta: 'proyectos', texto: 'Proyectos', roles: ['terreno', 'rrhh'], tambien: ['proyecto', 'proyecto-editar'] },
  { ruta: 'equipos', texto: 'Equipos', roles: ['terreno', 'rrhh'] },
  { ruta: 'vuelos', texto: 'Vuelos', roles: ['terreno'] },
  { ruta: 'gastos', texto: 'Gastos', roles: ['terreno', 'rrhh'], pronto: true },
  { ruta: 'terreno', texto: 'Libreta de terreno', roles: ['terreno'], pronto: true },
  { ruta: 'personas', texto: 'Personas', roles: ['rrhh', 'terreno'] },
];
const CABEN_ABAJO = 5; // en el teléfono, si hay más secciones, las últimas van en «Más»

function pintarMenu(base) {
  const items = MENU.filter(m => m.roles.includes(selRol.value));
  const enlace = m => {
    const activo = m.ruta === base || (m.tambien || []).includes(base);
    return `<a href="#/${m.ruta}" class="sis-menu-item${activo ? ' activo' : ''}${m.pronto ? ' pronto' : ''}"${activo ? ' aria-current="page"' : ''} title="${m.texto}">${ICONOS_MENU[m.ruta] || ''}<span>${m.texto}</span>${m.pronto ? '<small>pronto</small>' : ''}</a>`;
  };
  const principales = items.length > CABEN_ABAJO ? items.slice(0, CABEN_ABAJO - 1) : items;
  const extra = items.slice(principales.length);
  const extraActivo = extra.some(m => m.ruta === base || (m.tambien || []).includes(base));
  menu.classList.remove('abierto');
  menu.innerHTML = principales.map(enlace).join('') +
    (extra.length ? `<div class="sis-menu-extra" id="sis-menu-extra">${extra.map(enlace).join('')}</div>
      <button type="button" class="sis-menu-mas${extraActivo ? ' activo' : ''}" aria-expanded="false" aria-controls="sis-menu-extra">${ICONOS_MENU.mas}<span>Más</span></button>` : '');
}

// ── Persona y rol ──
async function cargarPersonas(seleccionar) {
  const personas = await listarPersonas();
  selPersona.innerHTML = '<option value="">Sin persona</option>' +
    personas.map(p => `<option value="${p.id}">${p.nombre.replace(/</g, '&lt;')}</option>`).join('');
  selPersona.value = seleccionar && personas.some(p => p.id === seleccionar) ? seleccionar : '';
}

// ── Marca de la empresa (nombre y color). Por ahora por equipo, en localStorage. ──
const MARCA_DEFECTO = { nombre: 'Topoland', color: '#1D5C63' };
function leerMarca() {
  try { return { ...MARCA_DEFECTO, ...JSON.parse(leer('env_marca', '{}')) }; } catch { return { ...MARCA_DEFECTO }; }
}
function aplicarMarca() {
  const m = leerMarca();
  document.documentElement.style.setProperty('--marca', m.color);
  document.querySelector('.sis-marca b').textContent = m.nombre;
  document.querySelector('.sis-logo').textContent = (m.nombre.trim()[0] || 'T').toUpperCase();
}

const ctx = () => ({
  marca: leerMarca(),
  cambiarMarca: m => { escribir('env_marca', JSON.stringify(m)); aplicarMarca(); },
  rol: selRol.value,
  personaId: selPersona.value || null,
  estado,
  avisar,
  ir: r => { if (location.hash === r) mostrar(); else location.hash = r; },
  usarPersona: async id => { escribir('env_persona', id); await cargarPersonas(id); },
  recargarPersonas: () => cargarPersonas(selPersona.value),
});

// ── Rutas: #/inicio, #/proyectos, #/proyecto/<id>, #/proyecto-editar/<id|nuevo>, #/equipos[/<equipoId>], #/personas, #/gastos, #/terreno ──
function leerRuta() {
  const qr = location.hash.match(/^#equipo=([\w-]+)/); // enlace de la etiqueta QR de Equipos
  if (qr) { history.replaceState(null, '', `#/equipos/${qr[1]}`); }
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { base: partes[0] || 'inicio', arg: partes[1] || null };
}

async function mostrar() {
  const { base, arg } = leerRuta();
  const item = MENU.find(m => m.ruta === base || (m.tambien || []).includes(base));
  if (!item || !item.roles.includes(selRol.value)) { location.hash = '#/inicio'; return; }
  pintarMenu(base);
  const clave = `${base}/${arg || ''}/${selRol.value}/${selPersona.value}`;

  if (base === 'vuelos') {
    // #/vuelos · #/vuelos/plan/<id> · #/vuelos/proyecto/<proyectoId>
    const partes = location.hash.replace(/^#\/?/, '').split('/');
    desmontar();
    contenedor.innerHTML = '';
    contenedor.dataset.vista = 'modulo';
    montado = Vuelos.montar(contenedor, {
      rol: selRol.value, personaId: selPersona.value || null,
      planId: partes[1] === 'plan' ? partes[2] : null, proyectoId: partes[1] === 'proyecto' ? partes[2] : null,
    });
    rutaActual = clave;
    window.scrollTo(0, 0);
    return;
  }

  if (base === 'equipos') {
    // El módulo trae su propia sub-barra de pestañas. Se vuelve a montar al cambiar de equipo, rol o persona.
    desmontar();
    contenedor.innerHTML = '';
    contenedor.dataset.vista = 'modulo';
    montado = Equipos.montar(contenedor, { rol: selRol.value, personaId: selPersona.value || null, equipoInicial: arg });
    rutaActual = clave;
    window.scrollTo(0, 0);
    return;
  }

  desmontar();
  const cambioDePantalla = !rutaActual.startsWith(`${base}/${arg || ''}/`);
  rutaActual = clave;
  contenedor.dataset.vista = 'sistema';
  if (cambioDePantalla) window.scrollTo(0, 0);
  try {
    let html;
    if (base === 'gastos' || base === 'terreno') html = VISTAS.pronto(ctx(), base);
    else if (base === 'proyecto') html = await VISTAS.proyecto(ctx(), arg);
    else if (base === 'proyecto-editar') html = await VISTAS.proyectoEditar(ctx(), arg || 'nuevo');
    else html = await VISTAS[base](ctx());
    if (rutaActual !== clave) return; // el usuario ya se fue a otra pantalla
    contenedor.innerHTML = `<div class="sis-vista">${html}</div>`;
  } catch (err) {
    console.error(err);
    contenedor.innerHTML = `<div class="sis-error"><b>Algo falló al cargar.</b><br>${String(err.message || err).replace(/</g, '&lt;')}</div>`;
  }
}

function desmontar() {
  if (montado) { try { montado.desmontar(); } catch (e) { console.warn(e); } montado = null; }
}

// Eventos de las pantallas del Sistema (los del módulo los maneja el módulo).
contenedor.addEventListener('submit', async ev => {
  if (contenedor.dataset.vista !== 'sistema') return;
  const form = ev.target.closest('form[data-form]');
  if (!form) return;
  ev.preventDefault();
  try { if (await manejarEnvio(form, ctx())) { rutaActual = ''; await mostrar(); } }
  catch (e) { console.error(e); avisar(`No se pudo guardar: ${e.message}`); }
});
contenedor.addEventListener('click', async ev => {
  if (contenedor.dataset.vista !== 'sistema') return;
  const b = ev.target.closest('button[data-accion]');
  if (!b) return;
  try { if (await manejarClic(b, ctx())) { rutaActual = ''; await mostrar(); } }
  catch (e) { console.error(e); avisar(e.message); }
});
contenedor.addEventListener('change', async ev => {
  if (contenedor.dataset.vista !== 'sistema') return;
  const i = ev.target.closest('input[data-accion]');
  if (i && await manejarCambio(i, ctx())) { rutaActual = ''; await mostrar(); }
});

async function arrancar() {
  aplicarModo();
  aplicarMarca();
  $('sis-version').textContent = `v${VERSION_SISTEMA}`;
  $('sis-version').title = `Sistema v${VERSION_SISTEMA} = ${MODULOS_INCLUIDOS}`;
  document.title = `${leerMarca().nombre} · Sistema v${VERSION_SISTEMA}`;
  selRol.innerHTML = Object.entries(ROLES).map(([k, t]) => `<option value="${k}">${t}</option>`).join('');
  selRol.value = leer('env_rol', 'terreno') === 'rrhh' ? 'rrhh' : 'terreno';
  await cargarPersonas(leer('env_persona', ''));
  Equipos.iniciar({ personaId: selPersona.value || null });
  Vuelos.iniciar({ personaId: selPersona.value || null });

  selRol.addEventListener('change', () => { escribir('env_rol', selRol.value); rutaActual = ''; mostrar(); });
  selPersona.addEventListener('change', () => { escribir('env_persona', selPersona.value); rutaActual = ''; mostrar(); });
  addEventListener('hashchange', mostrar);
  document.addEventListener('click', ev => { if (!ev.target.closest('#sis-menu')) menu.classList.remove('abierto'); });
  // Tocar la sección en la que ya se está vuelve a su pantalla inicial (p. ej. de la ficha de un equipo a la lista).
  menu.addEventListener('click', ev => {
    const mas = ev.target.closest('.sis-menu-mas');
    if (mas) { const abierto = menu.classList.toggle('abierto'); mas.setAttribute('aria-expanded', String(abierto)); return; }
    const a = ev.target.closest('a[href]');
    if (a && a.getAttribute('href') === location.hash) { ev.preventDefault(); estado.personaEditar = null; rutaActual = ''; mostrar(); }
  });
  await mostrar();

  iniciarPanelNube({
    pastilla: $('sis-nube'),
    alLlegarDatos: async () => {
      await cargarPersonas(selPersona.value || leer('env_persona', ''));
      if (montado && montado.refrescar) montado.refrescar();
      else if (!contenedor.querySelector('form')) { rutaActual = ''; mostrar(); } // no borrar lo que se está escribiendo
    },
  });
  window.__sistemaCargado = true;
}

arrancar().catch(err => {
  console.error(err);
  contenedor.innerHTML = `<div class="sis-error">No se pudo iniciar el Sistema: ${String(err.message || err).replace(/</g, '&lt;')}</div>`;
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker no registrado:', err));
}

export { guardarPersona };
