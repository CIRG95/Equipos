// compartido/catalogos.js — proyectos y personas.
// HOY: catálogos temporales y locales (almacenes compartido_proyectos / compartido_personas).
// EN LA APP GLOBAL: se llama a configurarProveedorCatalogos({...}) con las funciones reales
// y ningún módulo se entera del cambio, porque todos leen solo a través de este archivo.

import { registrarAlmacenes, todos, obtener, guardar } from './almacen.js';
import { sellar } from './util.js';

export const OFICINA_ID = 'oficina'; // id fijo y conocido del proyecto especial «Oficina»
const ALM_PROYECTOS = 'compartido_proyectos';
const ALM_PERSONAS = 'compartido_personas';

registrarAlmacenes([{ nombre: ALM_PROYECTOS }, { nombre: ALM_PERSONAS }]);

let proveedor = null;

/**
 * La app global entrega aquí sus catálogos reales. Debe implementar:
 * listarProyectos(), obtenerProyecto(id), listarPersonas(), obtenerPersona(id)
 * (guardarProyecto / guardarPersona son opcionales: si faltan, el módulo no ofrece crear).
 */
export function configurarProveedorCatalogos(p) { proveedor = p; }
export function catalogosEditables() { return !proveedor || (!!proveedor.guardarProyecto && !!proveedor.guardarPersona); }

const activo = r => !r.eliminadoEn && r.activo !== false;
const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');

async function asegurarOficina() {
  const o = await obtener(ALM_PROYECTOS, OFICINA_ID);
  if (!o) await guardar(ALM_PROYECTOS, sellar({ id: OFICINA_ID, nombre: 'Oficina', mandante: 'Topoland', especial: true }));
}

export async function listarProyectos({ incluirOficina = true } = {}) {
  let lista;
  if (proveedor) lista = await proveedor.listarProyectos();
  else { await asegurarOficina(); lista = (await todos(ALM_PROYECTOS)).filter(activo); }
  lista = lista.filter(p => incluirOficina || p.id !== OFICINA_ID);
  return lista.sort((a, b) => (a.id === OFICINA_ID ? -1 : b.id === OFICINA_ID ? 1 : porNombre(a, b)));
}

export async function obtenerProyecto(id) {
  if (!id) return null;
  if (proveedor) return proveedor.obtenerProyecto(id);
  if (id === OFICINA_ID) await asegurarOficina();
  return obtener(ALM_PROYECTOS, id);
}

export async function guardarProyecto(datos, { personaId = null } = {}) {
  if (proveedor) return proveedor.guardarProyecto(datos);
  const r = { ...(datos.id ? await obtener(ALM_PROYECTOS, datos.id) : {}), ...datos };
  return guardar(ALM_PROYECTOS, sellar(r, { personaId }));
}

export async function listarPersonas() {
  if (proveedor) return (await proveedor.listarPersonas()).sort(porNombre);
  return (await todos(ALM_PERSONAS)).filter(activo).sort(porNombre);
}

export async function obtenerPersona(id) {
  if (!id) return null;
  if (proveedor) return proveedor.obtenerPersona(id);
  return obtener(ALM_PERSONAS, id);
}

export async function guardarPersona(datos, { personaId = null } = {}) {
  if (proveedor) return proveedor.guardarPersona(datos);
  const r = { ...(datos.id ? await obtener(ALM_PERSONAS, datos.id) : {}), ...datos };
  return guardar(ALM_PERSONAS, sellar(r, { personaId }));
}

/** Mapa id → nombre, práctico para pintar listas sin consultar uno por uno. */
export async function mapaNombres() {
  const [proyectos, personas] = await Promise.all([listarProyectos(), listarPersonas()]);
  return {
    proyecto: Object.fromEntries(proyectos.map(p => [p.id, p.nombre])),
    persona: Object.fromEntries(personas.map(p => [p.id, p.nombre])),
  };
}
