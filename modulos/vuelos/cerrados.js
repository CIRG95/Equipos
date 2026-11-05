// modulos/vuelos/cerrados.js — cortes «por polígonos cerrados» (v0.11).
// Para un área irregular, busca la partición más rectangular cortando desde sus vértices cóncavos:
// cada corte sale de un vértice cóncavo, sigue la prolongación de uno de sus lados y termina en el borde.
// Es voraz: en cada paso aplica el corte que más mejora la «rectangularidad» (superficie / rectángulo mínimo),
// sin dejar sectores muy chicos. Los cortes se devuelven como segmentos [V, H] (metros, marco local), con los dos
// extremos sobre el borde; geometria() los prolonga un poco hacia afuera para aplicarlos como los demás cortes.

import { areaFirmada, antihorario, simplificar, cascoConvexo, dist } from './geom.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const unit = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const area = p => Math.abs(areaFirmada(p));

/** Superficie del rectángulo mínimo (orientado) que contiene al polígono. */
export function rectanguloMinimo(poli) {
  const h = cascoConvexo(poli);
  if (h.length < 3) return 0;
  let mejor = Infinity;
  for (let i = 0; i < h.length; i++) {
    const d = unit(sub(h[(i + 1) % h.length], h[i])), n = [-d[1], d[0]];
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const p of h) { const x = p[0] * d[0] + p[1] * d[1], y = p[0] * n[0] + p[1] * n[1]; if (x < a0) a0 = x; if (x > a1) a1 = x; if (y < b0) b0 = y; if (y > b1) b1 = y; }
    mejor = Math.min(mejor, (a1 - a0) * (b1 - b0));
  }
  return mejor;
}

/** Rectangularidad: 1 = rectángulo perfecto. */
export const rectangularidad = p => { const r = rectanguloMinimo(p); return r > 0 ? Math.min(1, area(p) / r) : 0; };

/** Simplifica un anillo cerrado (Douglas-Peucker) conservando vértices originales. */
function simplificarAnillo(ring, tol) {
  if (ring.length < 5) return ring.slice();
  // Se parte en el vértice más lejano del primero para que el anillo no pierda una esquina.
  let k = 0, m = -1;
  ring.forEach((p, i) => { const d = dist(p, ring[0]); if (d > m) { m = d; k = i; } });
  const a = simplificar(ring.slice(0, k + 1), tol), b = simplificar([...ring.slice(k), ring[0]], tol);
  return [...a, ...b.slice(1, -1)];
}

/** Vértices cóncavos significativos (giro > minGiro grados) de un anillo antihorario simplificado. */
function concavos(simple, minGiro) {
  const out = [];
  const n = simple.length;
  for (let i = 0; i < n; i++) {
    const a = simple[(i - 1 + n) % n], v = simple[i], b = simple[(i + 1) % n];
    const e1 = unit(sub(v, a)), e2 = unit(sub(b, v));
    const giro = Math.atan2(cross(e1, e2), e1[0] * e2[0] + e1[1] * e2[1]) * 180 / Math.PI;
    if (giro < -minGiro) out.push({ v, dirs: [e1, unit(sub(v, b))] }); // prolongación de los dos lados hacia adentro
  }
  return out;
}

/** Primer cruce del rayo v + t·d (t > tMin) con el anillo, sin contar las aristas que tocan v. → { punto, borde, u, t } */
function rayo(ring, v, d, tMin) {
  let mejor = null;
  for (let e = 0; e < ring.length; e++) {
    const p = ring[e], q = ring[(e + 1) % ring.length];
    if (dist(p, v) < 1e-6 || dist(q, v) < 1e-6) continue;
    const s = sub(q, p), den = cross(d, s);
    if (Math.abs(den) < 1e-12) continue;
    const w = sub(p, v), t = cross(w, s) / den, u = cross(w, d) / den;
    if (t > tMin && u >= -1e-9 && u <= 1 + 1e-9 && (!mejor || t < mejor.t)) mejor = { t, u: Math.max(0, Math.min(1, u)), borde: e, punto: [v[0] + d[0] * t, v[1] + d[1] * t] };
  }
  return mejor;
}

/** ¿El segmento a–b corta alguna arista del anillo fuera de sus extremos? */
function cruzaBorde(ring, a, b) {
  const r = sub(b, a);
  for (let e = 0; e < ring.length; e++) {
    const p = ring[e], q = ring[(e + 1) % ring.length], s = sub(q, p), den = cross(r, s);
    if (Math.abs(den) < 1e-12) continue;
    const w = sub(p, a), t = cross(w, s) / den, u = cross(w, r) / den;
    if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6) return true;
  }
  return false;
}

/** Parte el anillo con la cuerda del vértice iV al punto H sobre el borde «borde». Devuelve [A, B] antihorarios. */
function partir(ring, iV, hit) {
  const R = ring.slice();
  let iH;
  const p = R[hit.borde], q = R[(hit.borde + 1) % R.length];
  if (dist(hit.punto, p) < 0.05) iH = hit.borde;
  else if (dist(hit.punto, q) < 0.05) iH = (hit.borde + 1) % R.length;
  else { R.splice(hit.borde + 1, 0, hit.punto); iH = hit.borde + 1; if (iV > hit.borde) iV++; }
  const tramo = (i, j) => { const out = [R[i]]; let k = i; while (k !== j) { k = (k + 1) % R.length; out.push(R[k]); } return out; };
  return [antihorario(tramo(iV, iH)), antihorario(tramo(iH, iV))];
}

/**
 * Cortes por polígonos cerrados. poli: área de vuelo (metros). Devuelve [[V, H], …] en el orden en que se aplican.
 * opciones: maxCortes (12), minFrac (fracción mínima de superficie de un sector, 0,06), mejora mínima (0,015).
 */
export function cortesCerrados(poli, { maxCortes = 12, minFrac = 0.06, mejoraMin = 0.015 } = {}) {
  const total = area(poli);
  if (!(total > 0)) return [];
  const tam = Math.sqrt(total);
  const tol = Math.max(2, tam * 0.01);
  let piezas = [antihorario(poli.slice())];
  const cortes = [];
  const puntaje = p => area(p) * rectangularidad(p);
  for (let paso = 0; paso < maxCortes; paso++) {
    let mejor = null;
    piezas.forEach((pz, ip) => {
      const base = puntaje(pz), aPz = area(pz);
      if (aPz < total * minFrac * 2) return;
      const simple = antihorario(simplificarAnillo(pz, tol));
      for (const c of concavos(simple, 12)) {
        const iV = pz.findIndex(p => dist(p, c.v) < 1e-6);
        if (iV < 0) continue;
        for (const d of c.dirs) {
          const hit = rayo(pz, c.v, d, 0.5);
          if (!hit || hit.t < tam * 0.02) continue;
          const medio = [(c.v[0] + hit.punto[0]) / 2, (c.v[1] + hit.punto[1]) / 2];
          if (cruzaBorde(pz, c.v, hit.punto)) continue;
          const [A, B] = partir(pz, iV, hit);
          const aA = area(A), aB = area(B);
          if (aA < total * minFrac || aB < total * minFrac || Math.abs(aA + aB - aPz) > aPz * 0.01) continue;
          const gan = (puntaje(A) + puntaje(B) - base) / total;
          if (gan > mejoraMin && (!mejor || gan > mejor.gan)) mejor = { gan, ip, A, B, corte: [c.v, hit.punto], medio };
        }
      }
    });
    if (!mejor) break;
    piezas.splice(mejor.ip, 1, mejor.A, mejor.B);
    cortes.push(mejor.corte);
  }
  return cortes;
}

/**
 * Prolonga un corte para aplicarlo con cortarPoligono (v0.11): el extremo que cae sobre el borde del área se prolonga
 * 0,3 m hacia afuera (normal del borde); el que no, 0,3 m en la dirección del corte. Así un corte de vértice a vértice
 * (o de un vértice al borde) parte el sector igual que uno trazado desde afuera.
 */
export function prolongarCorte(corte, poli) {
  if (!corte || corte.length < 2) return corte;
  const signo = areaFirmada(poli) >= 0 ? 1 : -1; // antihorario: la normal exterior de a→b es (dy, −dx)
  const normalExt = (a, b) => { const d = unit(sub(b, a)); return [signo * d[1], -signo * d[0]]; };
  function hacia(p, dirCorte) {
    let mejorD = Infinity, n = null;
    const N = poli.length;
    for (let i = 0; i < N; i++) {
      const a = poli[i], b = poli[(i + 1) % N];
      if (dist(p, a) < 0.3) { const pr = poli[(i - 1 + N) % N], n1 = normalExt(pr, a), n2 = normalExt(a, b); return unit([n1[0] + n2[0], n1[1] + n2[1]]); }
      const ab = sub(b, a), L2 = ab[0] * ab[0] + ab[1] * ab[1];
      const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L2)) : 0;
      const dd = dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t]);
      if (dd < mejorD) { mejorD = dd; n = normalExt(a, b); }
    }
    return mejorD < 0.3 ? n : dirCorte;
  }
  const ini = corte[0], fin = corte[corte.length - 1];
  const dIni = hacia(ini, unit(sub(ini, corte[1]))), dFin = hacia(fin, unit(sub(fin, corte[corte.length - 2])));
  return [[ini[0] + dIni[0] * 0.3, ini[1] + dIni[1] * 0.3], ...corte, [fin[0] + dFin[0] * 0.3, fin[1] + dFin[1] * 0.3]];
}
