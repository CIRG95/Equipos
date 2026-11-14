// modulos/planificacion/modelo.js — cálculos de la planificación técnica (Sistema v0.15). Funciones puras, en metros.
//   · Red geodésica GNSS: sugerencia de PR (el de partida junto a un camino), vectores por triangulación de Delaunay,
//     pre-análisis por mínimos cuadrados, refuerzo de puntos débiles, sesiones con rotación de receptores y tiempos.
//   · Marcas de vuelo (GCP): distribución en área o corredor, con puntos de control y de chequeo.
// Pruebas: pruebas/planificacion.test.mjs.

// ───────── Marco local (equirectangular, como Vuelos; error < 0,5 % en áreas de pocos km) ─────────
const R_LAT = 110540, R_LON = 111320;
export function marcoLocal(lonlats) {
  const lon0 = lonlats.reduce((s, p) => s + p[0], 0) / lonlats.length, lat0 = lonlats.reduce((s, p) => s + p[1], 0) / lonlats.length;
  const k = Math.cos(lat0 * Math.PI / 180) * R_LON;
  return { lon0, lat0, aXY: ([lon, lat]) => [(lon - lon0) * k, (lat - lat0) * R_LAT], aLonLat: ([x, y]) => [lon0 + x / k, lat0 + y / R_LAT] };
}

// ───────── Geometría básica ─────────
export const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export function puntoEnPoligono(p, poli) {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i], [xj, yj] = poli[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
function proySegmento(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  return [a[0] + t * dx, a[1] + t * dy];
}
export function distBorde(p, poli) {
  let m = Infinity;
  for (let i = 0; i < poli.length; i++) m = Math.min(m, dist(p, proySegmento(p, poli[i], poli[(i + 1) % poli.length])));
  return m;
}
export function areaPoligono(poli) { let a = 0; for (let i = 0; i < poli.length; i++) { const [x1, y1] = poli[i], [x2, y2] = poli[(i + 1) % poli.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; }
const centroide = poli => [poli.reduce((s, p) => s + p[0], 0) / poli.length, poli.reduce((s, p) => s + p[1], 0) / poli.length];
function caja(poli) { const xs = poli.map(p => p[0]), ys = poli.map(p => p[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; }
export function largoLinea(l) { let s = 0; for (let i = 1; i < l.length; i++) s += dist(l[i - 1], l[i]); return s; }
/** Punto a la distancia s sobre la línea, con la dirección del tramo. */
export function puntoEnLinea(l, s) {
  let acc = 0;
  for (let i = 1; i < l.length; i++) {
    const d = dist(l[i - 1], l[i]);
    if (acc + d >= s || i === l.length - 1) { const t = d ? Math.min(1, Math.max(0, (s - acc) / d)) : 0; return { p: [l[i - 1][0] + t * (l[i][0] - l[i - 1][0]), l[i - 1][1] + t * (l[i][1] - l[i - 1][1])], dir: d ? [(l[i][0] - l[i - 1][0]) / d, (l[i][1] - l[i - 1][1]) / d] : [1, 0] }; }
    acc += d;
  }
  return { p: l[0], dir: [1, 0] };
}

// ───────── Sugerencia de PR ─────────
/**
 * Distribuye n PR dentro del área (polígono xy). El primero (partida) va junto a un camino dentro del área, en el acceso
 * más cercano al borde; sin caminos, en el vértice más cercano a un punto de control o al centroide.
 * Los demás se reparten por «el punto más lejano» sobre una malla interior, para cubrir el área de forma pareja.
 * fijos: puntos de control ya existentes (cuentan como cubiertos, no se mueven).
 */
export function sugerirPR(poli, { n = 6, caminos = [], fijos = [], margen = null } = {}) {
  if (!poli || poli.length < 3 || n < 1) return { partida: null, puntos: [] };
  const b = caja(poli), lado = Math.sqrt(areaPoligono(poli));
  const m = margen ?? Math.min(30, lado * 0.04);
  // Partida: muestras sobre los caminos, dentro del área y con margen; se elige la más cercana al borde (acceso).
  let partida = null;
  for (const c of caminos) {
    const L = largoLinea(c), paso = Math.max(10, L / 400);
    for (let s = 0; s <= L; s += paso) {
      const { p } = puntoEnLinea(c, s);
      if (!puntoEnPoligono(p, poli)) continue;
      const db = distBorde(p, poli);
      if (db < m) continue;
      if (!partida || db < partida.db) partida = { p, db };
    }
  }
  let inicio;
  if (partida) inicio = partida.p;
  else {
    const ref = fijos.length ? fijos[0] : centroide(poli);
    const v = poli.slice().sort((x, y) => dist(x, ref) - dist(y, ref))[0];
    const c = centroide(poli), d = dist(v, c) || 1;
    inicio = [v[0] + (c[0] - v[0]) / d * Math.min(m * 1.5, d * 0.5), v[1] + (c[1] - v[1]) / d * Math.min(m * 1.5, d * 0.5)];
  }
  // Malla de candidatos interiores
  const paso = Math.max(5, lado / 40), cand = [];
  for (let x = b.x0; x <= b.x1; x += paso) for (let y = b.y0; y <= b.y1; y += paso) { const p = [x, y]; if (puntoEnPoligono(p, poli) && distBorde(p, poli) >= m) cand.push(p); }
  for (const v of poli) { const c = centroide(poli), d = dist(v, c) || 1; const q = [v[0] + (c[0] - v[0]) / d * m * 1.2, v[1] + (c[1] - v[1]) / d * m * 1.2]; if (puntoEnPoligono(q, poli)) cand.push(q); }
  const elegidos = [inicio];
  const minD = cand.map(p => Math.min(dist(p, inicio), ...fijos.map(f => dist(p, f))));
  while (elegidos.length < n && cand.length) {
    let k = 0; for (let i = 1; i < cand.length; i++) if (minD[i] > minD[k]) k = i;
    if (minD[k] <= 0) break;
    const p = cand[k]; elegidos.push(p);
    for (let i = 0; i < cand.length; i++) minD[i] = Math.min(minD[i], dist(cand[i], p));
  }
  return { partida: partida ? 'camino' : 'vertice', puntos: elegidos };
}

// ───────── Triangulación de Delaunay (Bowyer–Watson; redes de decenas de puntos) ─────────
export function delaunay(pts) {
  const n = pts.length;
  if (n < 2) return [];
  if (n === 2) return [[0, 1]];
  const b = caja(pts), d = Math.max(b.x1 - b.x0, b.y1 - b.y0) || 1, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const P = [...pts, [cx - 20 * d, cy - d], [cx, cy + 20 * d], [cx + 20 * d, cy - d]];
  let tris = [[n, n + 1, n + 2]];
  const circ = ([a, bb, c]) => {
    const [ax, ay] = P[a], [bx, by] = P[bb], [cx2, cy2] = P[c];
    const D = 2 * (ax * (by - cy2) + bx * (cy2 - ay) + cx2 * (ay - by));
    if (Math.abs(D) < 1e-12) return { x: 0, y: 0, r2: Infinity };
    const ux = ((ax * ax + ay * ay) * (by - cy2) + (bx * bx + by * by) * (cy2 - ay) + (cx2 * cx2 + cy2 * cy2) * (ay - by)) / D;
    const uy = ((ax * ax + ay * ay) * (cx2 - bx) + (bx * bx + by * by) * (ax - cx2) + (cx2 * cx2 + cy2 * cy2) * (bx - ax)) / D;
    return { x: ux, y: uy, r2: (ax - ux) ** 2 + (ay - uy) ** 2 };
  };
  let cs = tris.map(circ);
  for (let i = 0; i < n; i++) {
    const [px, py] = P[i];
    const malos = [], buenos = [], csB = [];
    tris.forEach((t, k) => ((px - cs[k].x) ** 2 + (py - cs[k].y) ** 2 < cs[k].r2 ? malos.push(t) : (buenos.push(t), csB.push(cs[k]))));
    const bordes = new Map();
    for (const t of malos) for (const [a, c] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) { const k = a < c ? `${a},${c}` : `${c},${a}`; bordes.set(k, bordes.has(k) ? null : [a, c]); }
    tris = buenos; cs = csB;
    for (const e of bordes.values()) if (e) { const t = [e[0], e[1], i]; tris.push(t); cs.push(circ(t)); }
  }
  const aristas = new Set();
  for (const t of tris) {
    if (t.some(v => v >= n)) continue;
    for (const [a, c] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) aristas.add(a < c ? `${a},${c}` : `${c},${a}`);
  }
  if (!aristas.size) for (let i = 1; i < n; i++) aristas.add(`${i - 1},${i}`); // puntos colineales
  return [...aristas].map(k => k.split(',').map(Number));
}

/** Vectores sugeridos: aristas de Delaunay sin las muy largas (salvo que un punto quede con menos de 2). */
export function vectoresSugeridos(pts) {
  const ar = delaunay(pts).map(([a, b]) => ({ a, b, L: dist(pts[a], pts[b]) }));
  if (ar.length < 4) return ar.map(x => [x.a, x.b]);
  const med = ar.map(x => x.L).sort((p, q) => p - q)[Math.floor(ar.length / 2)];
  const grado = new Array(pts.length).fill(0);
  for (const x of ar) { grado[x.a]++; grado[x.b]++; }
  const quedan = [];
  for (const x of ar.sort((p, q) => q.L - p.L)) {
    if (x.L > 2.2 * med && grado[x.a] > 2 && grado[x.b] > 2) { grado[x.a]--; grado[x.b]--; continue; }
    quedan.push([x.a, x.b]);
  }
  return quedan;
}

// ───────── Pre-análisis por mínimos cuadrados ─────────
/**
 * Modelo simplificado y conservador para planificar: cada vector GNSS aporta ΔE y ΔN independientes con
 * σ = a + b·L (a en mm, b en ppm). E y N comparten la misma matriz cofactor, así que el error horizontal de cada punto
 * resulta circular: radio al 95 % = 2,4477·σ. Se fijan los puntos de control (si no hay, el primer PR).
 * Devuelve por punto: grado (vectores), σ95 en mm (Infinity si queda desconectado) y la redundancia mínima de sus vectores.
 */
export function preAnalisis(pts, vectores, { fijos = [], a = 5, b = 1 } = {}) {
  const n = pts.length;
  const fijo = new Set(fijos.length ? fijos : [0]);
  const conectado = conexos(n, vectores, fijo);
  // Solo entran al ajuste los puntos unidos a un punto fijo: los desconectados quedan con σ infinita.
  const libres = [...Array(n).keys()].filter(i => !fijo.has(i) && conectado[i]);
  const col = new Map(libres.map((i, k) => [i, k]));
  const m = libres.length;
  const N = Array.from({ length: m }, () => new Float64Array(m));
  const obs = vectores.filter(([i, j]) => conectado[i] && conectado[j]).map(([i, j]) => { const L = dist(pts[i], pts[j]); const s = a + b * L / 1000; return { i, j, L, s, p: 1 / (s * s) }; });
  for (const o of obs) {
    const ci = col.get(o.i), cj = col.get(o.j);
    if (ci != null) N[ci][ci] += o.p;
    if (cj != null) N[cj][cj] += o.p;
    if (ci != null && cj != null) { N[ci][cj] -= o.p; N[cj][ci] -= o.p; }
  }
  const Q = invertir(N);
  const grado = new Array(n).fill(0);
  for (const [i, j] of vectores) { grado[i]++; grado[j]++; }
  // Redundancia local de cada vector: r = 1 − p·(a Q aᵀ)
  const qq = (i, j) => (col.get(i) != null && col.get(j) != null && Q ? Q[col.get(i)][col.get(j)] : 0);
  const red = obs.map(o => { const v = qq(o.i, o.i) + qq(o.j, o.j) - 2 * qq(o.i, o.j); return Q ? Math.max(0, Math.min(1, 1 - o.p * v)) : 0; });
  const puntos = pts.map((_, i) => {
    let s95;
    if (fijo.has(i)) s95 = 0;
    else if (!conectado[i] || !Q) s95 = Infinity;
    else { const v = Q[col.get(i)][col.get(i)]; s95 = v > 0 && isFinite(v) ? 2.4477 * Math.sqrt(v) : Infinity; }
    const rs = obs.map((o, k) => (o.i === i || o.j === i ? red[k] : null)).filter(x => x != null);
    return { grado: grado[i], s95, rMin: rs.length ? Math.min(...rs) : 0, fijo: fijo.has(i) };
  });
  return { puntos, vectores: obs.map((o, k) => ({ ...o, r: red[k] })), redundanciaTotal: Math.max(0, obs.length - m) };
}

function conexos(n, vectores, fijos) {
  const ady = Array.from({ length: n }, () => []);
  for (const [i, j] of vectores) { ady[i].push(j); ady[j].push(i); }
  const vis = new Array(n).fill(false), cola = [...fijos];
  for (const f of fijos) vis[f] = true;
  while (cola.length) { const u = cola.shift(); for (const w of ady[u]) if (!vis[w]) { vis[w] = true; cola.push(w); } }
  return vis;
}

/** Inversa por Gauss-Jordan con pivoteo parcial; null si es singular. */
export function invertir(M) {
  const n = M.length;
  if (!n) return [];
  const A = M.map((f, i) => { const r = new Float64Array(2 * n); r.set(f); r[n + i] = 1; return r; });
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-14) return null; // singular
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c];
    for (let k = 0; k < 2 * n; k++) A[c][k] /= d;
    for (let r = 0; r < n; r++) if (r !== c && A[r][c]) { const f = A[r][c]; for (let k = 0; k < 2 * n; k++) A[r][k] -= f * A[c][k]; }
  }
  return A.map(r => Array.from(r.slice(n)));
}

/** Semáforo de un punto: 'ok' | 'aviso' | 'malo', con el motivo. tol = tolerancia horizontal al 95 % en mm. */
export function evaluarPunto(r, tol = 20) {
  if (r.fijo) return { nivel: 'ok', motivo: 'Punto de control (fijo)' };
  if (!isFinite(r.s95)) return { nivel: 'malo', motivo: 'Sin conexión con los puntos de control' };
  if (r.grado < 2) return { nivel: 'malo', motivo: 'Un solo vector: sin control de errores' };
  if (r.s95 > tol) return { nivel: 'malo', motivo: `Precisión estimada ${r.s95.toFixed(1)} mm, sobre la tolerancia de ${tol} mm` };
  if (r.grado === 2) return { nivel: 'aviso', motivo: 'Dos vectores: redundancia baja' };
  if (r.rMin < 0.2) return { nivel: 'aviso', motivo: 'Vector con redundancia local baja' };
  if (r.s95 > 0.7 * tol) return { nivel: 'aviso', motivo: `Precisión estimada ${r.s95.toFixed(1)} mm, cerca de la tolerancia` };
  return { nivel: 'ok', motivo: `Precisión estimada ${r.s95.toFixed(1)} mm` };
}

/** Agrega vectores a los puntos débiles (hacia el vecino más cercano no conectado, prefiriendo puntos fijos o sólidos). */
export function reforzar(pts, vectores, { fijos = [], a = 5, b = 1, tol = 20 } = {}) {
  const v = vectores.map(x => [...x]);
  const existe = (i, j) => v.some(([p, q]) => (p === i && q === j) || (p === j && q === i));
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const pa = preAnalisis(pts, v, { fijos, a, b });
    const debiles = pa.puntos.map((r, i) => ({ i, e: evaluarPunto(r, tol) })).filter(x => x.e.nivel !== 'ok');
    if (!debiles.length) break;
    for (const { i } of debiles) {
      const cands = pts.map((p, j) => ({ j, d: dist(pts[i], p), fuerte: fijos.includes(j) || evaluarPunto(pa.puntos[j], tol).nivel === 'ok' }))
        .filter(c => c.j !== i && !existe(i, c.j)).sort((x, y) => (y.fuerte - x.fuerte) || x.d - y.d);
      if (cands[0]) v.push([i, cands[0].j]);
    }
  }
  return v;
}

// ───────── Sesiones y tiempos ─────────
/** Minutos de ocupación para un vector de L metros según la tabla [{ hastaKm, minutos }] (null si no hay tabla o no alcanza). */
export function tiempoPara(L, tabla = []) {
  const t = tabla.slice().sort((x, y) => x.hastaKm - y.hastaKm).find(f => L / 1000 <= f.hastaKm);
  return t ? t.minutos : null;
}

/**
 * Agrupa los vectores en sesiones con R receptores. Cada sesión ocupa R puntos (comparte al menos uno con la anterior,
 * para encadenar) y da R − 1 vectores independientes. Duración de la sesión: la del vector planificado más largo que contiene.
 * → [{ puntos: [i…], vectores: [[i, j]…], largoMax, minutos }]
 */
export function planificarSesiones(pts, vectores, { receptores = 3, tabla = [] } = {}) {
  const R = Math.max(2, receptores);
  const pend = new Set(vectores.map(([i, j]) => (i < j ? `${i},${j}` : `${j},${i}`)));
  const clave = (i, j) => (i < j ? `${i},${j}` : `${j},${i}`);
  const sesiones = [];
  let anterior = null, guardia = 0;
  while (pend.size && guardia++ < 500) {
    // Arranque: un vector pendiente que toque la sesión anterior (encadenar); si no, el pendiente más largo.
    const lista = [...pend].map(k => k.split(',').map(Number));
    let ini = anterior ? lista.find(([i, j]) => anterior.includes(i) || anterior.includes(j)) : null;
    if (!ini) ini = lista.sort((x, y) => dist(pts[y[0]], pts[y[1]]) - dist(pts[x[0]], pts[x[1]]))[0];
    const sel = [...ini];
    while (sel.length < R) {
      let mejor = null, ganancia = 0;
      for (let k = 0; k < pts.length; k++) {
        if (sel.includes(k)) continue;
        const g = sel.filter(s => pend.has(clave(s, k))).length;
        if (g > ganancia) { ganancia = g; mejor = k; }
      }
      if (mejor == null) {
        // Sin más vectores pendientes alcanzables: se completa con el punto de la sesión anterior más cercano (encadena).
        const c = (anterior || []).filter(k => !sel.includes(k)).sort((x, y) => dist(pts[x], pts[sel[0]]) - dist(pts[y], pts[sel[0]]))[0];
        if (c == null) break; sel.push(c);
      } else sel.push(mejor);
    }
    const vs = [];
    for (let x = 0; x < sel.length; x++) for (let y = x + 1; y < sel.length; y++) { const k = clave(sel[x], sel[y]); if (pend.has(k)) { vs.push([sel[x], sel[y]]); pend.delete(k); } }
    const largoMax = Math.max(0, ...vs.map(([i, j]) => dist(pts[i], pts[j])));
    sesiones.push({ puntos: sel, vectores: vs, largoMax, minutos: tiempoPara(largoMax, tabla) });
    anterior = sel;
  }
  return sesiones;
}

// ───────── Marcas de vuelo (GCP) ─────────
/**
 * Área: esquinas (casco simplificado), perímetro cada «espaciado» y malla interior; las de chequeo van en los centros
 * de la malla (desfasados medio paso), cerca del 25 % del total. Todo con un margen hacia adentro.
 * → [{ p: [x, y], tipo: 'control' | 'chequeo' }]
 */
export function marcasArea(poli, { espaciado = 150, margen = 15 } = {}) {
  if (!poli || poli.length < 3) return [];
  const s = Math.max(20, espaciado), c = centroide(poli), out = [];
  const adentro = p => { const d = dist(p, c) || 1; return [p[0] + (c[0] - p[0]) / d * margen, p[1] + (c[1] - p[1]) / d * margen]; };
  const lejos = (p, min) => out.every(m => dist(m.p, p) >= min);
  for (const v of esquinas(poli)) { const q = adentro(v); if (puntoEnPoligono(q, poli)) out.push({ p: q, tipo: 'control' }); }
  // Perímetro
  const anillo = [...poli, poli[0]], L = largoLinea(anillo);
  for (let d = 0; d < L; d += s) { const q = adentro(puntoEnLinea(anillo, d).p); if (puntoEnPoligono(q, poli) && lejos(q, s * 0.6)) out.push({ p: q, tipo: 'control' }); }
  // Interior
  const b = caja(poli);
  for (let x = b.x0 + s; x < b.x1; x += s) for (let y = b.y0 + s; y < b.y1; y += s) { const q = [x, y]; if (puntoEnPoligono(q, poli) && distBorde(q, poli) > s * 0.5 && lejos(q, s * 0.6)) out.push({ p: q, tipo: 'control' }); }
  // Chequeo: centros de la malla, los más alejados de los controles, ~25 %
  const cand = [];
  for (let x = b.x0 + s * 0.5; x < b.x1; x += s) for (let y = b.y0 + s * 0.5; y < b.y1; y += s) { const q = [x, y]; if (puntoEnPoligono(q, poli) && distBorde(q, poli) > margen * 2) cand.push(q); }
  const meta = Math.max(3, Math.round(out.length * 0.25));
  const ctrl = out.map(m => m.p);
  cand.sort((p, q) => Math.min(...ctrl.map(k => dist(k, q))) - Math.min(...ctrl.map(k => dist(k, p))));
  for (const q of cand) { if (out.filter(m => m.tipo === 'chequeo').length >= meta) break; if (lejos(q, s * 0.4)) out.push({ p: q, tipo: 'chequeo' }); }
  return out;
}

/** Corredor: pares en los extremos y marcas alternadas a cada lado del eje; una de cada tres interiores es de chequeo. */
export function marcasCorredor(eje, { espaciado = 200, ancho = 100 } = {}) {
  if (!eje || eje.length < 2) return [];
  const L = largoLinea(eje), s = Math.max(20, espaciado), o = Math.max(5, ancho / 2 * 0.8), out = [];
  const lado = (d, sg) => { const { p, dir } = puntoEnLinea(eje, d); return [p[0] - dir[1] * o * sg, p[1] + dir[0] * o * sg]; };
  out.push({ p: lado(0, 1), tipo: 'control' }, { p: lado(0, -1), tipo: 'control' });
  const n = Math.max(1, Math.round(L / s));
  for (let k = 1; k < n; k++) out.push({ p: lado(k * L / n, k % 2 ? 1 : -1), tipo: k % 3 === 2 ? 'chequeo' : 'control' });
  out.push({ p: lado(L, 1), tipo: 'control' }, { p: lado(L, -1), tipo: 'control' });
  return out;
}

/** Esquinas del área: vértices del casco convexo con giro marcado (máximo 8). */
export function esquinas(poli) {
  const pts = poli.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const inf = [], sup = [];
  for (const p of pts) { while (inf.length >= 2 && cruz(inf[inf.length - 2], inf[inf.length - 1], p) <= 0) inf.pop(); inf.push(p); }
  for (const p of pts.reverse()) { while (sup.length >= 2 && cruz(sup[sup.length - 2], sup[sup.length - 1], p) <= 0) sup.pop(); sup.push(p); }
  const casco = [...inf.slice(0, -1), ...sup.slice(0, -1)];
  const giro = i => { const a = casco[(i - 1 + casco.length) % casco.length], b = casco[i], c = casco[(i + 1) % casco.length]; const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]]; const cos = (u[0] * v[0] + u[1] * v[1]) / ((Math.hypot(...u) * Math.hypot(...v)) || 1); return Math.acos(Math.max(-1, Math.min(1, cos))); };
  return casco.map((p, i) => ({ p, g: giro(i) })).sort((a, b) => b.g - a.g).slice(0, 8).filter(x => x.g > 0.35).map(x => x.p);
}
