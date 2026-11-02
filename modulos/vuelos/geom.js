// modulos/vuelos/geom.js — geometría plana en metros (marco local): margen, corredor, cortes y recorrido por batería.
// Todo trabaja con puntos [x, y] en metros. La conversión a lon/lat la hace quien llama (marco local).

const EPS = 1e-9;
export const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const unit = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

export function areaFirmada(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) s += cross(pts[i], pts[(i + 1) % pts.length]);
  return s / 2;
}
export const antihorario = pts => (areaFirmada(pts) < 0 ? pts.slice().reverse() : pts);

/** Intersección de dos rectas (p + t·r) y (q + u·s). Devuelve el punto o null si son paralelas. */
function cruceRectas(p, r, q, s) {
  const d = cross(r, s);
  if (Math.abs(d) < EPS) return null;
  const t = cross(sub(q, p), s) / d;
  return add(p, mul(r, t));
}

/** Quita vértices repetidos o alineados (dejan aristas de largo 0 que rompen el desplazamiento). */
function limpiarVertices(pts, cerrado) {
  const out = [];
  for (const p of pts) if (!out.length || dist(out[out.length - 1], p) > 0.01) out.push(p);
  if (cerrado && out.length > 1 && dist(out[0], out[out.length - 1]) < 0.01) out.pop();
  return out;
}

/**
 * Margen hacia afuera de un polígono. rectas = esquinas en punta (como se hace a mano); si no, redondeadas.
 * Las puntas muy agudas se recortan (bisel) para no generar picos largos.
 */
export function margenPoligono(puntos, d, { rectas = true } = {}) {
  let pts = antihorario(limpiarVertices(puntos, true));
  if (!(d > 0) || pts.length < 3) return pts;
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    const e1 = unit(sub(b, a)), e2 = unit(sub(c, b));
    const n1 = [e1[1], -e1[0]], n2 = [e2[1], -e2[0]]; // hacia afuera (derecha) en sentido antihorario
    const giro = cross(e1, e2); // > 0: vértice convexo
    if (giro <= EPS) { // cóncavo o recto: intersección de las dos paralelas
      const x = cruceRectas(add(a, mul(n1, d)), e1, add(b, mul(n2, d)), e2);
      out.push(x || add(b, mul(n1, d)));
      continue;
    }
    if (rectas) {
      const x = cruceRectas(add(a, mul(n1, d)), e1, add(b, mul(n2, d)), e2);
      if (x && dist(x, b) <= 3 * d) out.push(x);
      else { out.push(add(b, mul(n1, d))); out.push(add(b, mul(n2, d))); } // bisel en puntas muy agudas
    } else {
      const a1 = Math.atan2(n1[1], n1[0]);
      let a2 = Math.atan2(n2[1], n2[0]);
      while (a2 < a1) a2 += 2 * Math.PI; // de n1 a n2 girando en sentido antihorario (por afuera)
      const pasos = Math.max(2, Math.ceil((a2 - a1) / (Math.PI / 12)));
      for (let k = 0; k <= pasos; k++) { const t = a1 + (a2 - a1) * k / pasos; out.push(add(b, [Math.cos(t) * d, Math.sin(t) * d])); }
    }
  }
  return out;
}

/** Desplaza una polilínea abierta a la izquierda (+) o a la derecha (−), con uniones en punta limitadas. */
export function desplazarLinea(linea, o) {
  const pts = limpiarVertices(linea, false);
  if (pts.length < 2 || Math.abs(o) < EPS) return pts.slice();
  const n = pts.length, out = [];
  const normal = (p, q) => { const e = unit(sub(q, p)); return [-e[1], e[0]]; }; // izquierda
  out.push(add(pts[0], mul(normal(pts[0], pts[1]), o)));
  for (let i = 1; i < n - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const n1 = normal(a, b), n2 = normal(b, c);
    const x = cruceRectas(add(a, mul(n1, o)), sub(b, a), add(b, mul(n2, o)), sub(c, b));
    if (x && dist(x, b) <= 3 * Math.abs(o)) out.push(x);
    else { out.push(add(b, mul(n1, o))); out.push(add(b, mul(n2, o))); }
  }
  out.push(add(pts[n - 1], mul(normal(pts[n - 2], pts[n - 1]), o)));
  return out;
}

export function largo(linea) { let s = 0; for (let i = 1; i < linea.length; i++) s += dist(linea[i - 1], linea[i]); return s; }

/** Polígono del corredor alrededor de un eje: izq metros a la izquierda y der a la derecha. */
export function poligonoCorredor(eje, izq, der) {
  const l = desplazarLinea(eje, izq), r = desplazarLinea(eje, -der);
  return antihorario([...l, ...r.slice().reverse()]);
}

/** Pasadas del corredor: polilíneas paralelas al eje, centradas en el ancho, separadas `sep` metros. */
export function pasadasCorredor(eje, izq, der, sep) {
  const ancho = izq + der;
  const n = Math.max(1, Math.ceil(ancho / Math.max(1, sep)));
  const ini = -der + (ancho - (n - 1) * sep) / 2;
  const pasadas = [];
  for (let k = 0; k < n; k++) pasadas.push(desplazarLinea(eje, ini + k * sep));
  return pasadas;
}

// ─────────── Cortes ───────────

function cruceSegmentos(p, p2, q, q2) {
  const r = sub(p2, p), s = sub(q2, q), d = cross(r, s);
  if (Math.abs(d) < EPS) return null;
  const t = cross(sub(q, p), s) / d, u = cross(sub(q, p), r) / d;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { t, u, punto: add(p, mul(r, t)) };
}

/**
 * Parte un polígono con una polilínea que lo atraviesa (entra y sale).
 * Devuelve [A, B] o null si el corte no cruza el polígono de lado a lado.
 */
export function cortarPoligono(poli, corte) {
  const n = poli.length;
  const cruces = [];
  for (let i = 0; i + 1 < corte.length; i++) {
    for (let e = 0; e < n; e++) {
      const x = cruceSegmentos(corte[i], corte[i + 1], poli[e], poli[(e + 1) % n]);
      if (x) cruces.push({ seg: i, t: x.t, borde: e, u: x.u, punto: x.punto });
    }
  }
  cruces.sort((a, b) => a.seg - b.seg || a.t - b.t);
  // Se quitan cruces repetidos (el corte pasa justo por un vértice).
  const unicos = cruces.filter((c, k) => !k || dist(c.punto, cruces[k - 1].punto) > 0.01);
  if (unicos.length < 2) return null;
  const [P, Q] = unicos;
  const medio = [];
  for (let i = P.seg + 1; i <= Q.seg; i++) medio.push(corte[i]);
  const camino = [P.punto, ...medio.filter(m => dist(m, P.punto) > 0.01 && dist(m, Q.punto) > 0.01), Q.punto];
  // Vértices del polígono desde el borde de Q hasta el borde de P (sentido del anillo), y al revés.
  const recorrer = (desde, hasta, uDesde, uHasta) => {
    const out = [];
    if (desde === hasta && uHasta > uDesde) return out;
    let e = desde;
    do { e = (e + 1) % n; out.push(poli[e]); } while (e !== hasta && out.length <= n);
    return out;
  };
  const A = [...camino, ...recorrer(Q.borde, P.borde, Q.u, P.u)];
  const B = [...camino.slice().reverse(), ...recorrer(P.borde, Q.borde, P.u, Q.u)];
  const ok = x => x.length >= 3 && Math.abs(areaFirmada(x)) > 1;
  if (!ok(A) || !ok(B)) return null;
  return [antihorario(A), antihorario(B)];
}

/** Aplica los cortes en orden: cada uno parte el primer sector que atraviesa. Devuelve { sectores, fallidos }. */
export function aplicarCortes(poli, cortes) {
  let sectores = [poli];
  const fallidos = [];
  cortes.forEach((c, k) => {
    for (let i = 0; i < sectores.length; i++) {
      const r = cortarPoligono(sectores[i], c);
      if (r) { sectores.splice(i, 1, r[0], r[1]); return; }
    }
    fallidos.push(k);
  });
  return { sectores, fallidos };
}

/** Parte un eje (polilínea) donde lo cruzan los cortes. Devuelve los tramos en orden. */
export function cortarEje(eje, cortes) {
  const puntos = []; // { seg, t, punto }
  for (const c of cortes) {
    for (let i = 0; i + 1 < eje.length; i++) {
      for (let j = 0; j + 1 < c.length; j++) {
        const x = cruceSegmentos(eje[i], eje[i + 1], c[j], c[j + 1]);
        if (x) puntos.push({ seg: i, t: x.t, punto: x.punto });
      }
    }
  }
  puntos.sort((a, b) => a.seg - b.seg || a.t - b.t);
  const tramos = [];
  let actual = [eje[0]], seg = 0;
  for (const p of puntos) {
    for (let i = seg + 1; i <= p.seg; i++) actual.push(eje[i]);
    actual.push(p.punto);
    if (largo(actual) > 1) tramos.push(actual);
    actual = [p.punto]; seg = p.seg;
  }
  for (let i = seg + 1; i < eje.length; i++) actual.push(eje[i]);
  if (largo(actual) > 1) tramos.push(actual);
  return tramos;
}

// ─────────── Recorrido por batería ───────────

/**
 * Recorre un camino (lista de pasadas, cada una una polilínea) en zigzag y lo reparte en baterías.
 * Entre pasadas se vuela en línea recta y se suma `segGiro`. Cada batería sale del despegue y vuelve a él.
 * Si una pasada es más larga que una batería, se corta a la mitad: la batería siguiente retoma desde ahí.
 * Devuelve { baterias: [{ piezas: [[pt…]…], seg, traslado, inicio, fin, excede }], segVuelo }.
 */
export function recorrerPorBaterias(pasadas, { v, segGiro = 0, segUtiles, despegue = null }) {
  // Segmentos en orden: { a, b, giro } — giro: se suma segGiro al terminar (fin de pasada).
  const segs = [];
  pasadas.forEach((p, k) => {
    const linea = k % 2 === 0 ? p : p.slice().reverse();
    if (k > 0 && segs.length) segs.push({ a: segs[segs.length - 1].b, b: linea[0], enlace: true });
    for (let i = 0; i + 1 < linea.length; i++) segs.push({ a: linea[i], b: linea[i + 1], giro: i + 2 === linea.length && k < pasadas.length - 1 });
  });
  const vuelta = p => (despegue ? dist(p, despegue) / v : 0);
  const baterias = [];
  let bat = null;
  const abrir = p => { const ida = despegue ? dist(despegue, p) / v : 0; bat = { piezas: [[p]], seg: ida, traslado: ida, inicio: p, fin: p, excede: false, vuelo: 0 }; };
  const cerrar = () => { if (!bat) return; const r = vuelta(bat.fin); bat.seg += r; bat.traslado += r; baterias.push(bat); bat = null; };
  for (const s of segs) {
    const L = dist(s.a, s.b);
    let hecho = 0; // metros ya volados de este segmento
    let guard = 0;
    while (hecho < L - 0.01 && guard++ < 10000) {
      if (!bat) abrir(hecho ? add(s.a, mul(sub(s.b, s.a), hecho / L)) : s.a);
      const resta = L - hecho;
      const punto = x => add(s.a, mul(sub(s.b, s.a), (hecho + x) / L));
      const cabe = x => bat.seg + x / v + (s.giro && x >= resta - 0.01 ? segGiro : 0) + vuelta(punto(x)) <= segUtiles;
      let x;
      if (cabe(resta)) x = resta;
      else {
        let lo = 0, hi = resta;
        for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (cabe(m)) lo = m; else hi = m; }
        x = lo;
        if (x < 1 && bat.vuelo < 1) { x = resta; bat.excede = true; } // ni con una batería nueva alcanza: se vuela igual y se avisa
      }
      if (x < 0.01) { cerrar(); continue; }
      const p2 = punto(x);
      bat.seg += x / v; bat.vuelo += x;
      if (s.giro && x >= resta - 0.01) bat.seg += segGiro;
      bat.piezas[0].push(p2);
      bat.fin = p2;
      hecho += x;
      if (hecho < L - 0.01) cerrar(); // se acabó la batería a mitad del segmento
    }
  }
  cerrar();
  return { baterias: baterias.map(b => ({ ...b, piezas: b.piezas.filter(p => p.length >= 2) })), segVuelo: baterias.reduce((t, b) => t + b.seg, 0) };
}

/** Distancia mínima de un punto a un segmento. */
export function distPuntoSegmento(p, a, b) {
  const ab = sub(b, a), L2 = ab[0] * ab[0] + ab[1] * ab[1];
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L2)) : 0;
  return dist(p, add(a, mul(ab, t)));
}

export function puntoEnPoligono(p, poli) {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i], [xj, yj] = poli[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Distancia entre dos polígonos (0 si se tocan o uno contiene al otro). */
export function distPoligonos(A, B) {
  if (puntoEnPoligono(A[0], B) || puntoEnPoligono(B[0], A)) return 0;
  let m = Infinity;
  for (let i = 0; i < A.length; i++) {
    const a1 = A[i], a2 = A[(i + 1) % A.length];
    for (let j = 0; j < B.length; j++) {
      const b1 = B[j], b2 = B[(j + 1) % B.length];
      if (cruceSegmentos(a1, a2, b1, b2)) return 0;
      m = Math.min(m, distPuntoSegmento(a1, b1, b2), distPuntoSegmento(b1, a1, a2));
    }
  }
  return m;
}

export function distPuntoPoligono(p, A) {
  if (puntoEnPoligono(p, A)) return 0;
  let m = Infinity;
  for (let i = 0; i < A.length; i++) m = Math.min(m, distPuntoSegmento(p, A[i], A[(i + 1) % A.length]));
  return m;
}

// ─────────── Cortes transversales (corredores) ───────────

/** Punto y dirección (unitaria) del eje a la distancia s desde su inicio. */
export function puntoEnEje(eje, s) {
  let acum = 0;
  for (let i = 0; i + 1 < eje.length; i++) {
    const l = dist(eje[i], eje[i + 1]);
    if (s <= acum + l || i + 2 === eje.length) {
      const t = l ? Math.max(0, Math.min(1, (s - acum) / l)) : 0;
      return { p: add(eje[i], mul(sub(eje[i + 1], eje[i]), t)), dir: unit(sub(eje[i + 1], eje[i])) };
    }
    acum += l;
  }
  return { p: eje[0], dir: [1, 0] };
}

/** Cortes perpendiculares al eje en las distancias dadas (m desde el inicio). semi: medio largo de cada corte. */
export function cortesTransversales(eje, distancias, semi) {
  const L = largo(eje);
  return distancias.filter(s => s > 1 && s < L - 1).map(s => {
    const { p, dir } = puntoEnEje(eje, s);
    const n = [-dir[1], dir[0]];
    return [add(p, mul(n, semi)), add(p, mul(n, -semi))];
  });
}

/** Distancia a lo largo del eje del punto más cercano a q (para ubicar sectores en el DM). */
export function distanciaEnEje(eje, q) {
  let mejor = { d: Infinity, s: 0 }, acum = 0;
  for (let i = 0; i + 1 < eje.length; i++) {
    const a = eje[i], b = eje[i + 1], ab = sub(b, a), l = Math.hypot(ab[0], ab[1]);
    const t = l ? Math.max(0, Math.min(1, ((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1]) / (l * l))) : 0;
    const p = add(a, mul(ab, t)), d = dist(p, q);
    if (d < mejor.d) mejor = { d, s: acum + t * l };
    acum += l;
  }
  return mejor.s;
}

// ─────────── Eje automático de un área lineal y cortes paralelos (v0.8) ───────────

/** Puntos a distancias iguales a lo largo de una polilínea (n puntos, incluye extremos). */
export function remuestrear(linea, n) {
  const L = largo(linea);
  if (n < 2 || !L) return [linea[0], linea[linea.length - 1]];
  const out = [];
  let i = 0, acum = 0;
  for (let k = 0; k < n; k++) {
    const s = L * k / (n - 1);
    while (i + 2 < linea.length && acum + dist(linea[i], linea[i + 1]) < s) { acum += dist(linea[i], linea[i + 1]); i++; }
    const l = dist(linea[i], linea[i + 1]) || 1;
    out.push(add(linea[i], mul(sub(linea[i + 1], linea[i]), Math.max(0, Math.min(1, (s - acum) / l)))));
  }
  return out;
}

/** Simplificación Douglas-Peucker (tolerancia en metros), iterativa. */
export function simplificar(linea, tol) {
  if (linea.length < 3) return linea.slice();
  const marca = new Uint8Array(linea.length); marca[0] = marca[linea.length - 1] = 1;
  const pila = [[0, linea.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop();
    let max = -1, idx = -1;
    for (let i = a + 1; i < b; i++) { const d = distPuntoSegmento(linea[i], linea[a], linea[b]); if (d > max) { max = d; idx = i; } }
    if (max > tol) { marca[idx] = 1; pila.push([a, idx], [idx, b]); }
  }
  return linea.filter((_, i) => marca[i]);
}

/**
 * Eje (línea media) de un polígono alargado: se buscan los dos vértices más lejanos, se separan los dos bordes
 * y se une el punto medio entre ellos. Devuelve { eje, largo, anchos: [{ s, ancho }], anchoMin, anchoProm, anchoMax, razon }.
 */
export function ejeDePoligono(poli) {
  const pts = limpiarVertices(poli, true);
  const n = pts.length;
  if (n < 4) return null;
  // Extremos: los dos vértices más lejanos (sobre una muestra si el polígono es muy grande).
  const paso = Math.max(1, Math.ceil(n / 1500));
  let mejor = { d: -1, i: 0, j: 0 };
  for (let i = 0; i < n; i += paso) for (let j = i + paso; j < n; j += paso) { const d = dist(pts[i], pts[j]); if (d > mejor.d) mejor = { d, i, j }; }
  // Afinar alrededor de cada extremo.
  const afinar = (fijo, idx) => { let b = idx, bd = dist(pts[fijo], pts[idx]); for (let k = -paso; k <= paso; k++) { const m = (idx + k + n) % n, d = dist(pts[fijo], pts[m]); if (d > bd) { bd = d; b = m; } } return b; };
  let { i, j } = mejor; j = afinar(i, j); i = afinar(j, i);
  if (i > j) [i, j] = [j, i];
  const A = pts.slice(i, j + 1);                                   // de i a j por un lado
  const B = [...pts.slice(j), ...pts.slice(0, i + 1)].reverse();   // de i a j por el otro
  const La = largo(A), Lb = largo(B);
  const m = Math.max(50, Math.min(4000, Math.round(Math.max(La, Lb) / 25)));
  const ra = remuestrear(A, m), rb = remuestrear(B, m);
  const medio = ra.map((p, k) => mul(add(p, rb[k]), 0.5));
  // Ancho en cada punto del eje: distancia al borde más cercano de cada lado (en una ventana, porque los dos bordes
  // no miden lo mismo en las curvas y emparejarlos por fracción del largo sobrestima el ancho).
  const W = Math.max(10, Math.round(m / 40));
  const cercano = (q, cadena, k) => { let best = Infinity; for (let i = Math.max(0, k - W); i <= Math.min(m - 2, k + W); i++) best = Math.min(best, distPuntoSegmento(q, cadena[i], cadena[i + 1])); return best; };
  const anchosBrutos = medio.map((q, k) => cercano(q, ra, k) + cercano(q, rb, k));
  const eje = simplificar(medio, 1.5);
  const L = largo(medio);
  // Ancho representativo: se descartan los extremos (donde los bordes se juntan).
  const util = anchosBrutos.slice(Math.floor(m * 0.03), Math.ceil(m * 0.97));
  const orden = util.slice().sort((x, y) => x - y);
  const q = f => orden[Math.min(orden.length - 1, Math.max(0, Math.round(f * (orden.length - 1))))];
  const anchoProm = util.reduce((s, x) => s + x, 0) / (util.length || 1);
  return {
    eje, largo: L, anchos: anchosBrutos.map((w, k) => ({ s: L * k / (m - 1), ancho: w })),
    anchoMin: q(0.05), anchoProm, anchoMax: q(0.95), razon: anchoProm ? L / anchoProm : 0,
  };
}

/** ¿Es un área lineal (larga y angosta)? */
export const esAreaLineal = e => !!e && e.razon >= 8 && e.largo >= 1000;

/** Ancho del área en la distancia s del eje (interpolado del perfil de anchos). */
export function anchoEn(perfil, s) {
  if (!perfil || !perfil.length) return 0;
  let k = perfil.findIndex(p => p.s >= s);
  if (k <= 0) return perfil[Math.max(0, k)].ancho;
  if (k < 0) return perfil[perfil.length - 1].ancho;
  const a = perfil[k - 1], b = perfil[k], t = (s - a.s) / ((b.s - a.s) || 1);
  return a.ancho + (b.ancho - a.ancho) * t;
}

/** Distancias del eje donde la superficie acumulada llega a cada múltiplo de m2 (con el perfil de anchos). */
export function distanciasPorSuperficie(perfil, L, m2) {
  if (!(m2 > 0) || !perfil || !perfil.length) return [];
  const out = []; let acum = 0, meta = m2;
  for (let k = 1; k < perfil.length; k++) {
    const ds = perfil[k].s - perfil[k - 1].s, w = (perfil[k].ancho + perfil[k - 1].ancho) / 2;
    if (acum + ds * w >= meta) { const falta = meta - acum; out.push(perfil[k - 1].s + falta / (w || 1)); meta += m2; }
    acum += ds * w;
  }
  return out.filter(s => s > 1 && s < L - 1);
}

/** Casco convexo (cadena monótona). */
export function cascoConvexo(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const x of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], x) <= 0) lo.pop(); lo.push(x); }
  for (let i = p.length - 1; i >= 0; i--) { const x = p[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], x) <= 0) hi.pop(); hi.push(x); }
  hi.pop(); lo.pop();
  return lo.concat(hi);
}

/** Rumbo (0–179°, desde el norte) del lado más largo del rectángulo mínimo que contiene al polígono. */
export function rumboLadoLargo(poli) {
  const h = cascoConvexo(poli);
  let mejor = { area: Infinity, rumbo: 0 };
  for (let g = 0; g < 180; g++) {
    const a = g * Math.PI / 180, d = [Math.sin(a), Math.cos(a)], n = [Math.cos(a), -Math.sin(a)];
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const p of h) { const x = p[0] * d[0] + p[1] * d[1], y = p[0] * n[0] + p[1] * n[1]; a0 = Math.min(a0, x); a1 = Math.max(a1, x); b0 = Math.min(b0, y); b1 = Math.max(b1, y); }
    const area = (a1 - a0) * (b1 - b0);
    if (area < mejor.area - 1e-6) mejor = { area, rumbo: (a1 - a0) >= (b1 - b0) ? g : (g + 90) % 180 };
  }
  return mejor.rumbo;
}

/** Recorta un polígono con el semiplano { p · n <= c } (Sutherland–Hodgman). */
function recortarSemiplano(poli, n, c) {
  const out = [], f = p => p[0] * n[0] + p[1] * n[1] - c;
  for (let i = 0; i < poli.length; i++) {
    const a = poli[i], b = poli[(i + 1) % poli.length], fa = f(a), fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

/**
 * Cortes rectos paralelos que dividen el polígono en n partes. rumboCortes: dirección de las líneas de corte (0–179°, desde el norte).
 * igualSuperficie: cada parte con la misma superficie (si no, a igual distancia). Devuelve cortes [[p, q]] en metros.
 */
export function cortesParalelos(poli, n, rumboCortes, { igualSuperficie = true } = {}) {
  if (!(n >= 2)) return [];
  const a = rumboCortes * Math.PI / 180, d = [Math.sin(a), Math.cos(a)], nn = [Math.cos(a), -Math.sin(a)]; // nn: normal a los cortes
  const proy = poli.map(p => p[0] * nn[0] + p[1] * nn[1]);
  const c0 = Math.min(...proy), c1 = Math.max(...proy);
  const largoCorte = Math.max(...poli.map(p => p[0] * d[0] + p[1] * d[1])) - Math.min(...poli.map(p => p[0] * d[0] + p[1] * d[1]));
  const total = Math.abs(areaFirmada(poli));
  const posiciones = [];
  for (let k = 1; k < n; k++) {
    if (!igualSuperficie) { posiciones.push(c0 + (c1 - c0) * k / n); continue; }
    const meta = total * k / n;
    let lo = c0, hi = c1;
    for (let it = 0; it < 40 && hi - lo > 0.05; it++) { const m = (lo + hi) / 2; if (Math.abs(areaFirmada(recortarSemiplano(poli, nn, m))) < meta) lo = m; else hi = m; }
    posiciones.push((lo + hi) / 2);
  }
  // Cada corte: recta {p · nn = c}, larga como todo el polígono más un margen.
  const centroD = (Math.max(...poli.map(p => p[0] * d[0] + p[1] * d[1])) + Math.min(...poli.map(p => p[0] * d[0] + p[1] * d[1]))) / 2;
  const semi = largoCorte / 2 + 50;
  return posiciones.map(c => { const base = add(mul(nn, c), mul(d, centroD)); return [add(base, mul(d, -semi)), add(base, mul(d, semi))]; });
}
