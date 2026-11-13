// modulos/administracion/pantallas.js — montaje y eventos del módulo Administración (Sistema v0.15).
// Secciones (las elige app/sistema.js según la ruta): personal · administracion · comercial · conocimiento · seguridad.

import { listarProyectos, listarPersonas } from '../../compartido/catalogos.js';
import { escapar as esc } from '../../compartido/util.js';
import { fijarPersona, cargarTodo } from './datos.js';
import * as Personal from './pantallas-personal.js';
import * as Admin from './pantallas-admin.js';
import * as Comercial from './pantallas-comercial.js';
import * as Conocimiento from './pantallas-conocimiento.js';
import * as Seguridad from './pantallas-seguridad.js';

const ACCIONES = { ...Personal.acciones, ...Admin.acciones, ...Comercial.acciones, ...Conocimiento.acciones, ...Seguridad.acciones };
const CAMBIOS = { ...Personal.cambios, ...Admin.cambios, ...Comercial.cambios, ...Conocimiento.cambios };
const FORMULARIOS = { ...Personal.formularios, ...Admin.formularios, ...Comercial.formularios, ...Conocimiento.formularios, ...Seguridad.formularios };

/**
 * ctx: { rol, personaId, seccion, ruta: [partes después de la sección], avisar, ir, marca, textosTipos,
 *        equipos() → lista de equipos con estado, gastos(proyectoId) → resumen de gastos, reportarEquipo(datos) }
 */
export function montarPantallas(contenedor, ctx) {
  fijarPersona(ctx.personaId || null);
  const raiz = document.createElement('div');
  raiz.className = 'mod-admin';
  contenedor.appendChild(raiz);
  let activo = true, mapa = null, cacheEquipos = null;
  const st = { d: null, personas: [], proyectos: [] };
  const v = {
    st, ctx,
    avisar: ctx.avisar, ir: h => (location.hash === h ? recargar() : (location.hash = h)),
    nomPers: id => (st.personas.find(p => p.id === id) || {}).nombre || '',
    equipos: async () => (cacheEquipos = cacheEquipos || await ctx.equipos().catch(() => [])),
    gastos: id => ctx.gastos(id).catch(() => null),
    reportarEquipo: d => ctx.reportarEquipo({ ...d, personaId: ctx.personaId, origen: 'sistema-seguridad' }),
  };

  async function vista() {
    const [a, b, c] = ctx.ruta || [];
    switch (ctx.seccion) {
      case 'personal':
        if (a === 'licitaciones') return Personal.licitaciones(v);
        if (a === 'licitacion') return Personal.licitacion(v, b);
        if (a) return Personal.personalFicha(v, a, b);
        return Personal.personalResumen(v);
      case 'administracion':
        if (a === 'vehiculo') return Admin.vehiculo(v, b);
        if (a === 'acreditacion') return Admin.acreditacionVehiculos(v, b, c);
        if (a === 'viajes') return Admin.viajes(v);
        if (a === 'fondos') return Admin.fondos(v);
        if (a === 'guias') return Admin.guias(v);
        if (a === 'mandantes') return Admin.mandantes(v, b);
        if (a === 'configuracion') return Admin.configuracion(v);
        return Admin.vehiculos(v);
      case 'comercial':
        if (a === 'cotizaciones') return Comercial.cotizaciones(v);
        if (a === 'estimador') return Comercial.estimador(v);
        return Comercial.tablero(v);
      case 'conocimiento':
        if (a === 'biblioteca') return Conocimiento.biblioteca(v);
        if (a === 'lecciones') return Conocimiento.lecciones(v);
        return Conocimiento.mapaPuntos(v);
      case 'seguridad':
        return Seguridad.seguridad(v, a);
      default:
        return '';
    }
  }

  async function recargar() {
    if (!activo) return;
    [st.d, st.personas, st.proyectos] = await Promise.all([cargarTodo(), listarPersonas(), listarProyectos()]);
    cacheEquipos = null;
    const html = await vista();
    if (!activo) return;
    const y = window.scrollY;
    if (mapa) { try { mapa.remove(); } catch { /* */ } mapa = null; }
    raiz.innerHTML = html;
    window.scrollTo(0, y);
    if (ctx.seccion === 'conocimiento' && !(ctx.ruta || [])[0]) mapa = await Conocimiento.iniciarMapaPuntos(v, raiz);
  }
  const fallo = e => { console.error(e); ctx.avisar(e.message || String(e)); };

  raiz.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-a]');
    if (!b || !ACCIONES[b.dataset.a]) return;
    ev.preventDefault();
    try { if (await ACCIONES[b.dataset.a](b, v)) await recargar(); } catch (e) { fallo(e); }
  });
  raiz.addEventListener('change', async ev => {
    const i = ev.target.closest('[data-c]');
    if (!i || !CAMBIOS[i.dataset.c]) return;
    try { if (await CAMBIOS[i.dataset.c](i, v)) await recargar(); } catch (e) { fallo(e); }
  });
  raiz.addEventListener('submit', async ev => {
    const f = ev.target.closest('form[data-f]');
    if (!f || !FORMULARIOS[f.dataset.f]) return;
    ev.preventDefault();
    const boton = f.querySelector('button:not([type="button"])');
    if (boton) boton.disabled = true;
    try { if (await FORMULARIOS[f.dataset.f](f, new FormData(f), v)) await recargar(); } catch (e) { fallo(e); if (boton) boton.disabled = false; }
  });

  recargar().catch(e => { console.error(e); raiz.innerHTML = `<div class="sis-error">No se pudo cargar: ${esc(e.message)}</div>`; });
  return {
    desmontar() { activo = false; if (mapa) { try { mapa.remove(); } catch { /* */ } } raiz.remove(); },
    // Al llegar datos de la nube no se repinta mientras se escribe en un formulario.
    refrescar() { if (!raiz.contains(document.activeElement) || !document.activeElement.closest('form')) recargar(); },
  };
}
