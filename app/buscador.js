// app/buscador.js — buscador global del encabezado (Sistema v0.15).
// Busca en proyectos, personas, equipos (nombre y N° de serie), vehículos (patente), puntos de las redes (PR) y
// monografías; para Dirección y RRHH también cotizaciones. El índice se arma al enfocar y se renueva cada minuto.

import { escapar as esc } from '../compartido/util.js';
import { listarProyectos, listarPersonas } from '../compartido/catalogos.js';
import * as Equipos from '../modulos/equipos/equipos.js';
import * as Administracion from '../modulos/administracion/administracion.js';
import * as Planificacion from '../modulos/planificacion/planificacion.js';
import { todasLasMonografias } from '../modulos/monografias/datos.js';

const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function armarIndice(rol) {
  const [proyectos, personas, equipos, adm, puntos, monos] = await Promise.all([
    listarProyectos(), listarPersonas(), Equipos.listarEquiposConEstado().catch(() => []), Administracion.datos().catch(() => null),
    Planificacion.puntosDeRedes().catch(() => []), todasLasMonografias().catch(() => []),
  ]);
  const nomProy = id => (proyectos.find(p => p.id === id) || {}).nombre || '';
  const idx = [];
  const poner = (tipo, titulo, detalle, enlace, extra = '') => idx.push({ tipo, titulo, detalle, enlace, clave: norm(`${titulo} ${detalle} ${extra}`) });
  for (const p of proyectos) poner('Proyecto', p.nombre, [p.mandante, p.comuna].filter(Boolean).join(' · '), `#/proyecto/${p.id}`);
  for (const p of personas) poner('Persona', p.nombre, p.cargo || '', rol === 'rrhh' ? `#/personal/${p.id}` : '#/personas');
  for (const e of equipos) poner('Equipo', e.nombre, [e.equipo, e.numeroSerie && `N° ${e.numeroSerie}`].filter(Boolean).join(' · '), `#/equipos/${e.id}`, e.numeroSerie || '');
  if (adm) {
    for (const v of adm.vehiculos) poner('Vehículo', v.patente, [v.marca, v.modelo].filter(Boolean).join(' '), rol === 'terreno' ? '#/proyectos' : `#/administracion/vehiculo/${v.id}`);
    if (rol !== 'terreno') for (const c of adm.cotizaciones) poner('Cotización', c.nombre, c.mandante || '', '#/comercial/cotizaciones');
    for (const m of adm.mandantes) poner('Mandante', m.nombre, m.plataforma || '', rol === 'terreno' ? '#/proyectos' : `#/administracion/mandantes/${m.id}`, (m.alias || []).join(' '));
  }
  for (const p of puntos) poner('Punto', p.nombre, `${p.tipo === 'control' ? 'Control' : 'PR'} · ${nomProy(p.proyectoId)}`, `#/planificacion/red/${p.redId}`);
  for (const m of monos) poner('Monografía', m.puntoMedido || m.nombre || 'Monografía', nomProy(m.proyectoId), `#/monografias/${m.proyectoId}/${m.id}`);
  return idx;
}

export function iniciarBuscador({ input, lista, rol }) {
  if (!input || !lista) return;
  let indice = null, armado = 0, rolIndice = '', sel = -1, res = [];
  const asegurar = async () => {
    if (!indice || Date.now() - armado > 60000 || rolIndice !== rol()) { indice = await armarIndice(rol()); armado = Date.now(); rolIndice = rol(); }
    return indice;
  };
  const cerrar = () => { lista.hidden = true; input.setAttribute('aria-expanded', 'false'); sel = -1; };
  const pintar = () => {
    lista.innerHTML = res.length ? res.map((r, k) => `<a href="${esc(r.enlace)}" role="option" class="${k === sel ? 'activo' : ''}" aria-selected="${k === sel}"><small>${esc(r.tipo)}</small><span>${esc(r.titulo)}<em>${esc(r.detalle)}</em></span></a>`).join('')
      : '<p class="sis-tenue" style="padding:10px">Sin resultados.</p>';
    lista.hidden = false; input.setAttribute('aria-expanded', 'true');
  };
  const buscar = async () => {
    const q = norm(input.value).trim();
    if (q.length < 2) { cerrar(); return; }
    const partes = q.split(/\s+/);
    res = (await asegurar()).filter(x => partes.every(p => x.clave.includes(p))).slice(0, 12);
    sel = res.length ? 0 : -1;
    pintar();
  };
  input.addEventListener('focus', () => { asegurar().catch(() => {}); });
  input.addEventListener('input', () => { buscar().catch(e => console.warn(e)); });
  input.addEventListener('keydown', ev => {
    if (lista.hidden) return;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); sel = Math.min(res.length - 1, sel + 1); pintar(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); sel = Math.max(0, sel - 1); pintar(); }
    else if (ev.key === 'Enter' && res[sel]) { ev.preventDefault(); location.hash = res[sel].enlace; input.value = ''; cerrar(); input.blur(); }
    else if (ev.key === 'Escape') cerrar();
  });
  lista.addEventListener('click', ev => { if (ev.target.closest('a')) { input.value = ''; cerrar(); } });
  document.addEventListener('click', ev => { if (!ev.target.closest('.sis-buscador')) cerrar(); });
}
