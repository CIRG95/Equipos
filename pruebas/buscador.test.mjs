import { test } from 'node:test';
import assert from 'node:assert/strict';

// El buscador importa módulos que usan la base del navegador solo al armar el índice; las reglas se prueban sin base.
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };
const { AMBITOS, ambitoDe, buscar, delAmbito, opcionesFiltros, norm } = await import('../app/buscador.js');

const r = (tipo, titulo, detalle, f = {}) => ({ tipo, id: titulo, titulo, detalle, enlace: '#', f: { tipo, ...f }, clave: norm(`${titulo} ${detalle}`) });
const indice = [
  r('Proyecto', 'Canal Norte', 'Aguas del Valle · Los Andes', { etapa: 'Terreno', mandante: 'Aguas del Valle', trabajo: ['Dron', 'GNSS'] }),
  r('Proyecto', 'Línea 9 Sur', 'Metro · Santiago', { etapa: 'Proceso en gabinete', mandante: 'Metro', trabajo: ['Estación total'] }),
  r('Equipo', 'Trimble R10', 'GNSS · N° 5512', { clase: 'GNSS', ubicacion: 'En terreno', calibracion: 'Al día' }),
  r('Equipo', 'Leica TS16', 'Estación total · N° 8841', { clase: 'Estación total', ubicacion: 'En oficina', calibracion: 'Vencida' }),
  r('Persona', 'Norma Canales', 'Geomensora', { rol: ['Encargado de terreno'] }),
  r('Punto', 'PR-12', 'PR · Canal Norte', { clase: 'PR', proyecto: 'Canal Norte' }),
];

test('cada sección busca solo en su ámbito; la búsqueda cruzada es solo de Inicio', () => {
  assert.deepEqual(buscar(indice, 'inicio', 'canal').map(x => x.tipo).sort(), ['Persona', 'Proyecto', 'Punto']);
  assert.deepEqual(buscar(indice, 'proyectos', 'canal').map(x => x.titulo), ['Canal Norte']);
  assert.deepEqual(buscar(indice, 'equipos', 'canal'), []);
  assert.deepEqual(buscar(indice, 'personal', 'canal').map(x => x.titulo), ['Norma Canales']);
  assert.equal(Object.values(AMBITOS).filter(a => a.cruzada).length, 1);
});

test('sin texto: Inicio no lista nada y una sección lista todo su ámbito', () => {
  assert.deepEqual(buscar(indice, 'inicio', ''), []);
  assert.equal(buscar(indice, 'equipos', '').length, 2);
  assert.equal(delAmbito(indice, 'proyectos').length, 2);
});

test('los filtros son del ámbito: dentro de un campo suman, entre campos restringen', () => {
  assert.deepEqual(buscar(indice, 'equipos', '', { ubicacion: ['En terreno'] }).map(x => x.titulo), ['Trimble R10']);
  assert.equal(buscar(indice, 'equipos', '', { ubicacion: ['En terreno', 'En oficina'] }).length, 2);
  assert.deepEqual(buscar(indice, 'equipos', '', { ubicacion: ['En oficina'], calibracion: ['Al día'] }), []);
  assert.deepEqual(buscar(indice, 'proyectos', '', { trabajo: ['GNSS'] }).map(x => x.titulo), ['Canal Norte']);
});

test('un filtro de otra sección no afecta (no se cruzan)', () => {
  // «ubicacion» es de Equipos: en Proyectos se ignora.
  assert.equal(buscar(indice, 'proyectos', '', { ubicacion: ['En terreno'] }).length, 2);
});

test('opciones de filtro con su cantidad; se omiten los filtros con una sola opción', () => {
  const ops = opcionesFiltros(indice, 'equipos');
  assert.deepEqual(ops.map(o => o.k), ['clase', 'ubicacion', 'calibracion']);
  assert.deepEqual(ops[0].opciones, [['Estación total', 1], ['GNSS', 1]]);
  assert.deepEqual(opcionesFiltros(indice, 'personal'), []);
  assert.ok(opcionesFiltros(indice, 'inicio')[0].opciones.some(([v, n]) => v === 'Proyecto' && n === 2));
});

test('busca sin tildes ni mayúsculas y con varias palabras', () => {
  assert.deepEqual(buscar(indice, 'inicio', 'LINEA sur').map(x => x.titulo), ['Línea 9 Sur']);
  assert.deepEqual(buscar(indice, 'equipos', '8841').map(x => x.titulo), ['Leica TS16']);
  assert.equal(ambitoDe('seccion-desconocida'), 'inicio');
});
