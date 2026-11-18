// modulos/vuelos/amarre.js — bases de amarre (PR) y jornadas de vuelo por baterías (Vuelos 0.10, Sistema v0.17).
// Reglas puras, sin pantalla ni base de datos; se prueban en pruebas/amarre.test.mjs.
//
// Amarre: con los PR ya instalados (capa KMZ del proyecto) se elige la MENOR cantidad de PR base que deja todos los
// sectores dentro del radio de amarre (punto más lejano del sector a la base ≤ radio). Si hay varias soluciones con la
// misma cantidad, gana la de menor distancia total y con las bases más cerca de un camino. Los sectores que ningún
// PR alcanza reciben PR nuevos sugeridos sobre los caminos (el mínimo que los cubra). El encargado puede cambiar la
// base de cualquier sector (hoja.area.amarre.asignado[i] = prId).
//
// Jornadas por baterías: los sectores se vuelan agrupados por su base. Cada jornada usa las baterías disponibles
// (un bloque); con «recarga» se suma un segundo bloque después de volver a cargar y almorzar. Un grupo que no cabe
// sigue al día siguiente con la misma base. Solo aplica a jornadas de vuelo: GNSS, estación total y demás se
// planifican por horario de trabajo.

import { cascoConvexo, dist, distPuntoSegmento } from './geom.js';

export const AMARRE_INICIAL = { radioKm: 5 };
export const JORNADA_INICIAL = { modo: 'baterias', baterias: 4, recarga: false, minCarga: 90, minAlmuerzo: 60, minIdaVuelta: 40, minBase: 20 };

/** Nombres de punto que no son PR (marcadores sin nombre de Google Earth): se muestran, pero no se usan por defecto. */
export const esNombreGenerico = n => !String(n || '').trim() || /^(marcador|placemark|punto|point|sin t[ií]tulo|untitled)/i.test(String(n).trim());

/** Distancia del punto más lejano del sector a una base: basta mirar los vértices del casco convexo. */
export function alcance(poligono, xy) {
  let m = 0;
  for (const v of cascoConvexo(poligono)) { const d = dist(v, xy); if (d > m) m = d; }
  return m;
}

/** Distancia de un punto al camino más cercano (Infinity si no hay caminos). caminos = [[xy…]…] en el marco local. */
export function distACamino(xy, caminos) {
  let m = Infinity;
  for (const c of caminos) for (let k = 1; k < c.length; k++) { const d = distPuntoSegmento(xy, c[k - 1], c[k]); if (d < m) m = d; }
  return m;
}

/** Mayor distancia entre dos vértices del sector (casco convexo). */
export function diametro(poligono) {
  const h = cascoConvexo(poligono);
  let m = 0;
  for (let a = 0; a < h.length; a++) for (let b = a + 1; b < h.length; b++) { const d = dist(h[a], h[b]); if (d > m) m = d; }
  return m;
}

/** Combinaciones de k elementos de 0..m-1 (generador). */
function* combinaciones(m, k, desde = 0, previo = []) {
  if (previo.length === k) { yield previo; return; }
  for (let j = desde; j <= m - (k - previo.length); j++) yield* combinaciones(m, k, j + 1, [...previo, j]);
}
const nCk = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };

/**
 * Mínimo de PR (índices de `candidatos`) que cubre `objetivo` (índices de sectores). D[i][j] = alcance del sector i desde el
 * candidato j. Busca exacto mientras las combinaciones sean pocas; si no, voraz. Desempate: menor suma de distancias del
 * sector a su base más cercana + penalización por distancia de la base al camino.
 */
function coberturaMinima(objetivo, D, R, penal) {
  const m = D.length ? D[0].length : 0;
  if (!objetivo.length || !m) return [];
  const cubre = j => objetivo.filter(i => D[i][j] <= R);
  const util = [...Array(m).keys()].filter(j => cubre(j).length);
  const costo = sel => objetivo.reduce((s, i) => s + Math.min(...sel.map(j => (D[i][j] <= R ? D[i][j] : Infinity))), 0) + sel.reduce((s, j) => s + penal[j], 0);
  const cubreTodo = sel => objetivo.every(i => sel.some(j => D[i][j] <= R));
  for (let k = 1; k <= Math.min(util.length, 6); k++) {
    if (nCk(util.length, k) > 60000) break;
    let mejor = null, mejorCosto = Infinity;
    for (const c of combinaciones(util.length, k)) {
      const sel = c.map(x => util[x]);
      if (!cubreTodo(sel)) continue;
      const cs = costo(sel);
      if (cs < mejorCosto) { mejorCosto = cs; mejor = sel; }
    }
    if (mejor) return mejor;
  }
  // Voraz: el que cubre más sectores pendientes; a igualdad, el de menor costo.
  const sel = [], pend = new Set(objetivo);
  while (pend.size) {
    let mj = -1, mn = 0, mc = Infinity;
    for (const j of util) {
      if (sel.includes(j)) continue;
      const n = [...pend].filter(i => D[i][j] <= R).length;
      const c = [...pend].reduce((s, i) => s + (D[i][j] <= R ? D[i][j] : 0), 0) + penal[j];
      if (n > mn || (n === mn && n > 0 && c < mc)) { mj = j; mn = n; mc = c; }
    }
    if (mj < 0) break;
    sel.push(mj);
    for (const i of [...pend]) if (D[i][mj] <= R) pend.delete(i);
  }
  return sel;
}

/** Puntos de los caminos cada `paso` metros (candidatos para PR nuevos), dentro de un recuadro. */
function puntosDeCaminos(caminos, paso, caja) {
  const out = [];
  const dentro = p => !caja || (p[0] >= caja[0] && p[0] <= caja[2] && p[1] >= caja[1] && p[1] <= caja[3]);
  for (const c of caminos) {
    let resto = 0;
    for (let k = 1; k < c.length; k++) {
      const a = c[k - 1], b = c[k], L = dist(a, b);
      let s = resto;
      while (s <= L) { const t = L ? s / L : 0, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; if (dentro(p)) out.push(p); s += paso; }
      resto = s - L;
    }
    if (out.length > 4000) break;
  }
  return out;
}

/**
 * Bases de amarre de una hoja.
 *   sectores: [[xy…]…] polígonos de los sectores (marco local) · prs: [{ id, nombre, xy }] · caminos: [[xy…]…]
 *   opciones: { radioKm, asignado: { [i]: prId } }
 * Devuelve { radio, bases: [{ id, nombre, xy, nuevo, sectores: [i], maxDist, aCamino }], porSector: [{ base, dist, fuera, manual }],
 *            minimas, nuevos, sinCubrir: [i] }.
 */
export function calcularAmarre({ sectores, prs = [], caminos = [], radioKm = AMARRE_INICIAL.radioKm, asignado = {} }) {
  const R = Math.max(0.1, Number(radioKm) || AMARRE_INICIAL.radioKm) * 1000;
  const n = sectores.length;
  const D = sectores.map(pol => prs.map(p => alcance(pol, p.xy)));
  const penal = prs.map(p => { const d = distACamino(p.xy, caminos); return Number.isFinite(d) ? d * 0.5 : 0; });
  const todos = [...Array(n).keys()];
  const alcanzables = todos.filter(i => prs.some((_, j) => D[i][j] <= R));
  const sel = coberturaMinima(alcanzables, D, R, penal);

  // Sectores que ningún PR existente alcanza: PR nuevos sobre los caminos (o, sin caminos, en el centro del grupo).
  const sinPR = todos.filter(i => !alcanzables.includes(i));
  const nuevos = [];
  if (sinPR.length) {
    const xs = sinPR.flatMap(i => sectores[i].map(p => p[0])), ys = sinPR.flatMap(i => sectores[i].map(p => p[1]));
    const caja = [Math.min(...xs) - R, Math.min(...ys) - R, Math.max(...xs) + R, Math.max(...ys) + R];
    const diag = Math.hypot(caja[2] - caja[0], caja[3] - caja[1]);
    let cand = puntosDeCaminos(caminos, Math.max(100, diag / 400), caja);
    const centro = pol => { const h = cascoConvexo(pol); return [h.reduce((s, p) => s + p[0], 0) / h.length, h.reduce((s, p) => s + p[1], 0) / h.length]; };
    const enCamino = cand.length;
    cand = cand.concat(sinPR.map(i => centro(sectores[i])));
    const Dn = sectores.map(pol => cand.map(c => alcance(pol, c)));
    const penN = cand.map((c, k) => (k < enCamino ? 0 : 5 * R)); // preferir siempre un punto sobre un camino
    const elegidos = coberturaMinima(sinPR, Dn, R, penN);
    elegidos.forEach((k, x) => nuevos.push({ id: `nuevo-${x + 1}`, nombre: `PR nuevo ${x + 1}`, xy: cand[k], nuevo: true, sobreCamino: k < enCamino, D: Dn.map(f => f[k]) }));
  }

  // Asignación: cada sector a la base elegida más cercana que lo alcanza; los cambios manuales mandan.
  const elegidas = [...sel.map(j => ({ ...prs[j], nuevo: false, D: D.map(f => f[j]) })), ...nuevos];
  const todasBases = [...prs.map((p, j) => ({ ...p, nuevo: false, D: D.map(f => f[j]) })), ...nuevos];
  const porSector = todos.map(i => {
    const man = asignado[i] && todasBases.find(b => b.id === asignado[i]);
    if (man) return { base: man.id, dist: man.D[i], fuera: man.D[i] > R, manual: true };
    let mejor = null;
    for (const b of elegidas) if (b.D[i] <= R && (!mejor || b.D[i] < mejor.D[i])) mejor = b;
    if (!mejor) for (const b of elegidas) if (!mejor || b.D[i] < mejor.D[i]) mejor = b;
    return mejor ? { base: mejor.id, dist: mejor.D[i], fuera: mejor.D[i] > R, manual: false } : { base: null, dist: Infinity, fuera: true, manual: false };
  });
  const usadas = [...new Set(porSector.map(s => s.base).filter(Boolean))];
  const bases = usadas.map(id => {
    const b = todasBases.find(x => x.id === id);
    const secs = todos.filter(i => porSector[i].base === id);
    return { id: b.id, nombre: b.nombre, xy: b.xy, nuevo: !!b.nuevo, sectores: secs, maxDist: Math.max(...secs.map(i => porSector[i].dist)), aCamino: distACamino(b.xy, caminos) };
  }).sort((a, b) => Math.min(...a.sectores) - Math.min(...b.sectores));
  // Sectores que no caben en el radio desde ningún punto (la mitad de su mayor dimensión ya supera el radio): hay que dividirlos.
  const grandes = todos.filter(i => porSector[i].fuera && diametro(sectores[i]) / 2 > R);
  return { radio: R, bases, porSector, minimas: sel.length, nuevos: nuevos.length, sinCubrir: todos.filter(i => porSector[i].fuera), grandes };
}

/**
 * Jornadas de vuelo por baterías.
 *   sectores: [{ i, vuelos, minTotal }] en el orden de vuelo · grupos: [[i…]…] (sectores por base, en orden) o null
 *   cfg: JORNADA_INICIAL + { traslado (min entre sectores) } · util: minutos de trabajo del día (horario)
 * Devuelve { dias: [{ sectores: [i], parciales: [i], bases: [k], bloques: [n baterías], baterias, min, excede }], util }.
 * Cada batería dura minTotal / vuelos del sector (incluye despegue y cambio). Al empezar un grupo se suma la instalación
 * de la base; con recarga, el día tiene dos bloques separados por ida y vuelta + carga (el almuerzo va dentro de la carga).
 */
export function jornadasPorBaterias(sectores, grupos, cfg = {}, util = 0) {
  const c = { ...JORNADA_INICIAL, ...cfg };
  const B = Math.max(1, Math.round(Number(c.baterias) || 1));
  const bloquesDia = c.recarga ? 2 : 1;
  const pausaRecarga = (Number(c.minIdaVuelta) || 0) + Math.max(Number(c.minCarga) || 0, Number(c.minAlmuerzo) || 0);
  const porI = new Map(sectores.map(s => [s.i, s]));
  const orden = (grupos && grupos.length ? grupos : [sectores.map(s => s.i)]).map(g => g.filter(i => porI.has(i)));
  // Unidades = una batería de un sector, en el orden de vuelo.
  const unidades = [];
  orden.forEach((g, k) => g.forEach(i => { const s = porI.get(i), n = Math.max(1, s.vuelos || 1); for (let b = 0; b < n; b++) unidades.push({ i, b, grupo: k, min: (s.minTotal || 0) / n }); }));
  const dias = [];
  let dia = null, bloque = 0, enBloque = 0, ultimo = null;
  const nuevoDia = () => { dia = { sectores: [], parciales: [], bases: [], bloques: [0], baterias: 0, min: 0, excede: false, lista: [] }; dias.push(dia); bloque = 0; enBloque = 0; ultimo = null; };
  for (const u of unidades) {
    if (!dia) nuevoDia();
    if (enBloque >= B) {
      if (bloque + 1 < bloquesDia) { bloque++; enBloque = 0; dia.bloques.push(0); dia.min += pausaRecarga; }
      else nuevoDia();
    }
    let extra = 0;
    if (!ultimo || ultimo.grupo !== u.grupo) extra += Number(c.minBase) || 0;
    else if (ultimo.i !== u.i) extra += Number(c.traslado) || 0;
    // Si el horario no alcanza para esta batería, pasa al día siguiente (salvo que sea la primera del día).
    if (util && dia.baterias && dia.min + extra + u.min > util) { nuevoDia(); extra = Number(c.minBase) || 0; }
    dia.min += extra + u.min;
    dia.baterias++; enBloque++; dia.bloques[bloque]++; dia.lista.push({ i: u.i, b: u.b });
    if (!dia.sectores.includes(u.i)) dia.sectores.push(u.i);
    if (!dia.bases.includes(u.grupo)) dia.bases.push(u.grupo);
    if (util && dia.min > util) dia.excede = true;
    ultimo = u;
  }
  // Sectores repartidos entre dos o más días.
  const cuenta = new Map();
  dias.forEach(d => d.sectores.forEach(i => cuenta.set(i, (cuenta.get(i) || 0) + 1)));
  dias.forEach(d => { d.parciales = d.sectores.filter(i => cuenta.get(i) > 1); d.min = Math.round(d.min); });
  return { dias, util };
}
