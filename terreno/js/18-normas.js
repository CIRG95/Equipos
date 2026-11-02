"use strict";

/* =========================================================================
   NORMAS Y CLASES (v0.3 — Planillas 1)
   MOP = Manual de Carreteras (Vol. 2, Ed. 2025; Vol. 5). Es la norma por
   defecto. CNR y SERVIU quedan listadas pero SIN valores propios todavía:
   se comportan como "Personalizada" (tú defines la tolerancia) hasta que
   carguemos sus tablas. Nada de esto toca las columnas de reportes/Excel.
   ========================================================================= */
const NORMAS = {
  MOP:   { nombre: "MOP — Manual de Carreteras", valores: true },
  CNR:   { nombre: "CNR (sin valores aún: tú defines)", valores: false },
  SERVIU:{ nombre: "SERVIU (sin valores aún: tú defines)", valores: false },
  PERSONAL: { nombre: "Personalizada", valores: false }
};
const NORMA_DEFAULT = "MOP";

/* Manual de Carreteras 2.305.302(1): tolerancia de cierre = k·√K mm, K en km.
   Puntos de cambio y cierre máx. son de referencia para terreno. */
const NIVELACION_CLASES = {
  alta:     { nombre: "Alta",     k: 0.3, pcMinM: 25, cierreMaxM: 200,  uso: "Control de estructuras" },
  normal:   { nombre: "Normal",   k: 10,  pcMinM: 50, cierreMaxM: 1000, uso: "Referencias viales" },
  corriente:{ nombre: "Corriente",k: 20,  pcMinM: 70, cierreMaxM: 2000, uso: "Densificación de PR auxiliares" }
};
const NIVELACION_CLASE_DEFAULT = "normal";

const TOL_REPLANTEO_MM_MOP = 100;   // 2.307.203: 10 cm horizontal
const TOL_INSTALACION_MM_DEF = 20;  // sugerida por la app; se elige en pantalla

function normaDe(lev) { return (lev && lev.norma && NORMAS[lev.norma]) ? lev.norma : NORMA_DEFAULT; }

/* Tolerancia de cierre de nivelación (mm) para un levantamiento.
   Levantamientos antiguos (sin clase) siguen con la config global. */
function toleranciaNivelacionMm(lev, distanciaKm) {
  const K = Math.sqrt(Math.max(distanciaKm, 0));
  if (lev && lev.clase && normaDe(lev) === "MOP" && NIVELACION_CLASES[lev.clase]) {
    return NIVELACION_CLASES[lev.clase].k * K;
  }
  if (lev && lev.clase && lev.norma && normaDe(lev) !== "MOP" && lev.kPersonal > 0) {
    return lev.kPersonal * K;
  }
  return calcularToleranciaMm(distanciaKm);
}
function textoToleranciaNivelacion(lev) {
  if (lev && lev.clase && normaDe(lev) === "MOP" && NIVELACION_CLASES[lev.clase]) {
    const c = NIVELACION_CLASES[lev.clase];
    return "MOP clase " + c.nombre + " (" + String(c.k).replace(".", ",") + "·√K mm)";
  }
  if (lev && lev.clase && lev.kPersonal > 0) return NORMAS[normaDe(lev)].nombre.split(" (")[0] + " (" + lev.kPersonal + "·√K mm)";
  return "Config. general";
}

/* Compensación por partes iguales (MOP): solo si el cierre está en tolerancia
   y la nivelación vuelve al punto de partida. No modifica los datos
   guardados: es una vista de cotas compensadas. */
function compensarNivelacion(lev) {
  const c = calcularCierreNivelacion(lev);
  if (!(c.llego && c.esLoopReal && c.dentroDeTolerancia) || !lev.puntos.length) return null;
  const n = lev.puntos.length;
  const errM = c.errorCierreMm / 1000;
  return lev.puntos.map((p, i) => {
    const corr = -errM * (i + 1) / n;
    const obs = parseFloat(p.valores.cota);
    return { punto: p.valores.puntoAdelante, cotaObs: obs, corrMm: corr * 1000, cotaComp: obs + corr };
  });
}

/* ---------- Ángulos ---------- */
function fmtAngulo(grados, modo) {
  if (grados == null || isNaN(grados)) return "—";
  const g = ((grados % 360) + 360) % 360;
  if (modo === "cent") return (g * 400 / 360).toFixed(4) + " g";
  let d = Math.floor(g), m = Math.floor((g - d) * 60), s = Math.round(((g - d) * 60 - m) * 60);
  if (s === 60) { s = 0; m++; } if (m === 60) { m = 0; d++; }
  return d + "°" + String(m).padStart(2, "0") + "'" + String(s).padStart(2, "0") + '"';
}
function azimutGrados(n1, e1, n2, e2) { return Math.atan2(e2 - e1, n2 - n1) * 180 / Math.PI; }
function distHoriz(n1, e1, n2, e2) { return Math.hypot(n2 - n1, e2 - e1); }

/* ---------- CSV NEZD: punto, N, E, Z, D ---------- */
function numCsv(s, coma) {
  s = String(s == null ? "" : s).trim();
  if (s === "") return NaN;
  if (coma && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return parseFloat(s);
}
function parsearCsvNEZD(texto) {
  const lineas = String(texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const salida = [], omitidas = [];
  lineas.forEach((l, i) => {
    const delim = l.includes("\t") ? "\t" : l.includes(";") ? ";" : ",";
    const cols = l.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
    const coma = delim !== ",";
    const N = numCsv(cols[1], coma), E = numCsv(cols[2], coma);
    if (!cols[0] || isNaN(N) || isNaN(E)) { if (i > 0 || !/^p/i.test(cols[0] || "")) omitidas.push(i + 1); return; }
    const Z = numCsv(cols[3], coma);
    salida.push({ nombre: cols[0], N, E, Z: isNaN(Z) ? null : Z, D: cols.slice(4).join(" ") });
  });
  return { puntos: salida, omitidas };
}
function descargarTexto(nombre, texto, mime) {
  const blob = new Blob([texto], { type: (mime || "text/csv") + ";charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function fmtN(v, d) { return (v == null || isNaN(v)) ? "" : Number(v).toFixed(d == null ? 3 : d); }
