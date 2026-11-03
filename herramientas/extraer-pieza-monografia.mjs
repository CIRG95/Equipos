// herramientas/extraer-pieza-monografia.mjs — arma modulos/monografias/pieza-terreno.js copiando TAL CUAL
// el código de monografías de la app de Terreno (formato, chequeo, imágenes y PDF), para que el PDF del
// Sistema salga idéntico al de Terreno. Uso:  node herramientas/extraer-pieza-monografia.mjs <carpeta terreno/js>
// No editar pieza-terreno.js a mano: si Terreno cambia su monografía, se vuelve a correr esto.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('Falta la carpeta terreno/js'); process.exit(1); }
const leer = f => readFileSync(join(dir, f), 'utf8').split('\n');
const version = (/v(\d+\.\d+\.\d+)/.exec(readFileSync(join(dir, '..', 'LEEME.md'), 'utf8')) || [])[1] || '?';

/** Toma la función (o const) que empieza en la línea que calza con «inicio» hasta la llave de cierre en columna 0. */
function bloque(lineas, inicio) {
  const i = lineas.findIndex(l => l.startsWith(inicio));
  if (i < 0) throw new Error('No encontré: ' + inicio);
  const abre = (lineas[i].match(/\{/g) || []).length, cierra = (lineas[i].match(/\}/g) || []).length;
  if (abre === cierra) return lineas[i]; // función o constante de una sola línea
  let j = i; while (j < lineas.length && lineas[j] !== '}') j++;
  return lineas.slice(i, j + 1).join('\n');
}
const f04 = leer('04-fotos-imagenes.js'), f11 = leer('11-monografias-lista.js'), f13 = leer('13-monografias-importador.js'), f15 = leer('15-pdf-y-excel.js'), f05 = leer('05-nube-y-calculos.js');
const partes = [
  bloque(f04, 'function cargarImagenEl'), bloque(f04, 'function calcRectImagen'), bloque(f04, 'async function renderizarImagenAjustada'),
  bloque(f13, 'function impNum'),
  bloque(f11, 'function monoResumenDatos'),
  bloque(f15, 'function ordenNatural'),
  bloque(f15, 'function formatoImagenJsPDF'),
  bloque(f15, 'const FUENTE_CARLITO_REGULAR'), bloque(f15, 'const FUENTE_CARLITO_BOLD'),
  bloque(f15, 'function registrarFuenteMonografia'), bloque(f15, 'function prepararFuentePdf'),
  bloque(f15, 'const MONO_NAVY'), bloque(f15, 'const MONO_NEGRO'), bloque(f15, 'const MONO_GRIS'),
  bloque(f15, 'function dimsMonografia'), bloque(f15, 'function ajusteDe'), bloque(f15, 'async function prepararImagenesMonografia'),
  bloque(f15, 'function construirMonografiaPdf'), bloque(f15, 'function fmtFechaCorta'),
];
// Valores por defecto de una monografía nueva (los de Terreno)
const defaults = bloque(f05, 'function cargarMonografiaDefaults').replace(/JSON\.parse\(localStorage\.getItem\(MONOGRAFIA_DEFAULTS_KEY\) \|\| "null"\) \|\| /, '');

const salida = `// modulos/monografias/pieza-terreno.js — GENERADO por herramientas/extraer-pieza-monografia.mjs desde Terreno v${version}.
// Es el código de monografías de la app de Terreno copiado sin cambios (formato, chequeo ✔ – ! ?, ajuste de
// imágenes y PDF con jsPDF + fuente Carlito), para que la monografía salga idéntica en el Sistema y en Terreno.
// NO EDITAR A MANO: si Terreno cambia su monografía, se vuelve a correr la herramienta.
/* eslint-disable */
// Lo que Terreno tiene en su estado global: aquí lo fija configurarPieza().
const state = { config: { marca: {}, fuenteMonografia: { tipo: 'carlito' } }, monografias: [] };
export function configurarPieza({ logoEmpresa = null, fuente = 'carlito', monografias = null } = {}) {
  state.config.marca = { ...state.config.marca, logoEmpresa };
  state.config.fuenteMonografia = { tipo: fuente };
  if (monografias) state.monografias = monografias;
}

${partes.join('\n\n')}

${defaults}

export const VERSION_TERRENO = '${version}';
export { cargarMonografiaDefaults as valoresPorDefecto, monoResumenDatos as chequeoMonografia, prepararImagenesMonografia, construirMonografiaPdf, dimsMonografia, ajusteDe, calcRectImagen, cargarImagenEl, ordenNatural, impNum, fmtFechaCorta };
`;
writeFileSync(new URL('../modulos/monografias/pieza-terreno.js', import.meta.url), salida);
console.log('pieza-terreno.js generada desde Terreno v' + version + ' (' + Math.round(salida.length / 1024) + ' KB)');
