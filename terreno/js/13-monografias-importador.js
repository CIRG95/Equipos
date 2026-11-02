"use strict";

/* =========================================================================
   v0.1e — IMPORTAR PUNTOS DESDE TXT / CSV A MONOGRAFÍAS
   Tú defines el separador y el orden de las columnas (Punto, Latitud, Longitud,
   Este, Norte, Altura elipsoidal, Cota ortométrica). Se crea una monografía por
   punto, con los datos de cliente/proyecto/datum/equipo que ya tienes. Si falta
   UTM o geográficas, se calcula una desde la otra (WGS84/SIRGAS, hemisferio sur).
   ========================================================================= */
const IMP_CAMPOS = [
  ["", "— ignorar —"], ["punto", "Punto"], ["lat", "Latitud"], ["lng", "Longitud"], ["este", "Este"], ["norte", "Norte"],
  ["hElip", "Altura elipsoidal"], ["cota", "Cota ortométrica"]
];
const IMP_ORDEN_DEFECTO = ["punto", "lat", "lng", "este", "norte", "hElip", "cota"];

/* lat/lng → UTM (WGS84, hemisferio sur por defecto). Inversa de utmALatLng. */
function latLngAUtm(lat, lng, huso, sur) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2), rad = Math.PI / 180;
  const phi = lat * rad, lam = lng * rad, lam0 = (huso * 6 - 183) * rad;
  const s = Math.sin(phi), c = Math.cos(phi), t = Math.tan(phi);
  const N = a / Math.sqrt(1 - e2 * s * s), T = t * t, C = ep2 * c * c, A = c * (lam - lam0);
  const M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * Math.pow(e2, 3) / 256) * phi - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(2 * phi)
    + (15 * e2 * e2 / 256 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(4 * phi) - (35 * Math.pow(e2, 3) / 3072) * Math.sin(6 * phi));
  const este = k0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(A, 5) / 120) + 500000;
  let norte = k0 * (M + N * t * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(A, 6) / 720));
  if (sur !== false) norte += 10000000;
  return { norte, este };
}
window.latLngAUtm = latLngAUtm;

/* Detecta el separador a partir de las primeras líneas */
function impDetectarSep(lineas) {
  const l = lineas.slice(0, 5).join("\n");
  if (l.includes("\t")) return "tab";
  if (l.includes(";")) return ";";
  if (l.includes(",") && lineas.slice(0, 5).every((x) => !/\s/.test(x.replace(/\s*,\s*/g, ",").trim()))) return ",";
  return "espacio";
}
function impPartir(linea, sep) {
  let c;
  if (sep === "tab") c = linea.split("\t");
  else if (sep === ";") c = linea.split(";");
  else if (sep === ",") c = linea.split(",");
  else c = linea.trim().split(/\s+/);
  return c.map((x) => x.trim().replace(/^(["'])(.*)\1$/, "$2"));
}
/* Número con punto o coma decimal; las geográficas también aceptan 32°49'55.56"S */
function impNum(s, decimal, esGeo) {
  if (s == null) return null;
  let t = String(s).trim();
  if (!t) return null;
  if (esGeo) {
    const m = /^([+-]?)\s*(\d+(?:[.,]\d+)?)\s*[°º]\s*(?:(\d+(?:[.,]\d+)?)\s*['′]\s*)?(?:(\d+(?:[.,]\d+)?)\s*["″]\s*)?([NSEWOnsewo])?$/.exec(t);
    if (m) {
      const f = (x) => parseFloat(String(x || 0).replace(",", "."));
      let v = f(m[2]) + f(m[3]) / 60 + f(m[4]) / 3600;
      if (m[1] === "-" || /^[SsWwOo]$/.test(m[5] || "")) v = -v;
      return { v, txt: t.replace(/\s+/g, " ") };   // se conserva tal cual venía (° ' ") 
    }
    // También: 29 06 58.76 S · S 29:06:58.76 · -29 6 58.76 (grados, minutos y segundos separados por espacio, : o °'")
    const g = /^([NSEWOnsewo])?\s*([+-]?)\s*(\d+(?:[.,]\d+)?)[\s:°º'′"″]+(\d+(?:[.,]\d+)?)(?:[\s:'′"″]+(\d+(?:[.,]\d+)?))?\s*['′"″]?\s*([NSEWOnsewo])?$/.exec(t);
    if (g && !(g[1] && g[6])) {
      const f = (x) => parseFloat(String(x || 0).replace(",", "."));
      const gr = f(g[3]), mi = f(g[4]), se = f(g[5]);
      if (mi < 60 && se < 60) {
        let v = gr + mi / 60 + se / 3600;
        const h = g[1] || g[6] || "";
        if (g[2] === "-" || /^[SsWwOo]$/.test(h)) v = -v;
        return { v, txt: t.replace(/\s+/g, " ") };
      }
    }
  }
  if (decimal === "coma") t = t.replace(",", ".");   // por defecto el punto es el decimal; la coma nunca se interpreta como decimal
  if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return null;
  return { v: parseFloat(t), txt: t.replace(/^\+/, "") };
}
function impAdivinarMapa(cabecera, n) {
  const guess = (h) => {
    const x = h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (/^(punto|pto|nombre|name|id|codigo|code|vertice|pr)\b/.test(x)) return "punto";
    if (/^(lat)/.test(x)) return "lat";
    if (/^(lon|lng|long)/.test(x)) return "lng";
    if (/^(este|east|e\b|x\b)/.test(x)) return "este";
    if (/^(norte|north|n\b|y\b)/.test(x)) return "norte";
    if (/(elip|ellip|h_?elip|^h\b)/.test(x)) return "hElip";
    if (/(ortom|cota|orto|^z\b|elev|alt)/.test(x)) return "cota";
    return "";
  };
  if (cabecera) {
    const g = cabecera.map(guess);
    if (g.filter(Boolean).length >= 2) return g.concat(Array(Math.max(0, n - g.length)).fill(""));
  }
  let guardado = null;
  try { guardado = JSON.parse(localStorage.getItem("impMonoMapa") || "null"); } catch (_) {}
  // el orden recordado solo se reutiliza si el archivo tiene el mismo número de columnas
  const base = Array.isArray(guardado) && guardado.length === n ? guardado : IMP_ORDEN_DEFECTO;
  return Array.from({ length: n }, (_, i) => base[i] || "");
}

function abrirImportadorMonografias() {
  const defs = cargarMonografiaDefaults();
  let huso = 19;
  try { huso = parseInt(localStorage.getItem("catHuso") || "19", 10) || 19; } catch (_) {}
  const zm = parseInt(defs.zonaUTM, 10); if (zm >= 1 && zm <= 60) huso = zm;
  const jAct = jornadaActiva();
  const ov = document.createElement("div");
  ov.className = "modal-overlay";
  ov.innerHTML = `
    <div class="modal-sheet" style="max-height:92vh; overflow-y:auto;">
      <button class="close-x" data-x type="button">&times;</button>
      <h3>Importar puntos desde TXT / CSV</h3>
      <p class="muted">Una línea por punto. Elige el archivo (o pega el texto), el separador y a qué corresponde cada columna.</p>
      <label>Archivo</label>
      <input type="file" data-f="archivo" accept=".txt,.csv,.tsv,.dat,.xyz,.pts,text/plain,text/csv">
      <label>…o pega el texto aquí</label>
      <textarea data-f="texto" rows="4" placeholder="PR-1  -32.83210  -70.59530  350684.085  6366199.000  612.345  590.210" style="font-family:var(--mono); font-size:12px;"></textarea>
      <div class="row" style="gap:8px;">
        <div style="flex:1;"><label>Separador</label>
          <select data-f="sep"><option value="auto">Automático</option><option value="espacio">Espacio(s)</option><option value="tab">Tabulador</option><option value=",">Coma</option><option value=";">Punto y coma</option></select></div>
        <div style="flex:1;"><label>Decimal</label>
          <select data-f="dec"><option value="punto">Punto (123.45)</option><option value="coma">Coma (123,45)</option></select></div>
        <div style="flex:1;"><label>Huso UTM (sur)</label><input type="number" data-f="huso" min="1" max="60" value="${huso}"></div>
      </div>
      <label style="display:flex; align-items:center; gap:8px; font-weight:400; margin-top:8px;"><input type="checkbox" data-f="cab" style="width:auto;"> La primera línea es encabezado</label>
      <div data-mapa style="margin-top:8px;"></div>
      <div data-prev style="margin-top:8px;"></div>
      <div data-opts style="display:none;">
        <div class="divider"></div>
        <p class="muted" style="margin-bottom:4px;"><strong>Se aplicará a todas las monografías creadas</strong> (el resto sale de tus últimos datos de cliente, datum, equipo…)</p>
        <label>Nombre del proyecto</label><input type="text" data-f="proy" value="${escapeHtml(defs.nombreProyecto || (jAct && jAct.proyecto) || "")}">
        <div class="row" style="gap:8px;">
          <div style="flex:1;"><label>Operador</label><input type="text" data-f="oper" value="${escapeHtml((jAct && jAct.operador) || "")}"></div>
          <div style="flex:1;"><label>Fecha de medición</label><input type="date" data-f="fecha"></div>
        </div>
        <label>Si el punto ya tiene monografía (mismo código y proyecto)</label>
        <select data-f="dup"><option value="omitir">Omitir</option><option value="actualizar">Actualizar sus coordenadas</option><option value="crear">Crear otra</option></select>
        <label style="display:flex; align-items:center; gap:8px; font-weight:400; margin-top:8px;"><input type="checkbox" data-f="calc" checked style="width:auto;"> Completar lo que falte: UTM desde geográficas, y viceversa</label>
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" type="button" data-x style="flex:1;">Cancelar</button>
        <button class="btn btn-accent" type="button" data-ok style="flex:1;" disabled>Crear monografías</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const q = (s) => ov.querySelector(s), f = (k) => q('[data-f="' + k + '"]');
  ov.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", () => ov.remove()));
  let lineas = [], mapa = [], filas = [], sepUsado = "espacio";

  function recalcular() {
    const texto = f("texto").value;
    lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^(#|\/\/)/.test(l));
    const hayCab = f("cab").checked;
    const sepSel = f("sep").value;
    sepUsado = sepSel === "auto" ? impDetectarSep(lineas) : sepSel;
    const partidas = lineas.map((l) => impPartir(l, sepUsado));
    const cabecera = hayCab && partidas.length ? partidas[0] : null;
    const datos = hayCab ? partidas.slice(1) : partidas;
    const n = Math.max(0, ...partidas.slice(0, 30).map((c) => c.length));
    if (mapa.length !== n) mapa = impAdivinarMapa(cabecera, n);
    pintarMapa(n, cabecera);
    procesar(datos);
  }
  function pintarMapa(n, cabecera) {
    const cont = q("[data-mapa]");
    if (!n) { cont.innerHTML = ""; return; }
    cont.innerHTML = `<p class="muted" style="margin-bottom:4px;"><strong>Columnas</strong> — ¿a qué corresponde cada una? (separador detectado: ${sepUsado === "tab" ? "tabulador" : sepUsado})</p>
      <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:4px;">${mapa.map((v, i) => `
        <div style="min-width:104px;"><div class="muted" style="font-size:11px;">${cabecera ? escapeHtml(cabecera[i] || "") : "col " + (i + 1)}</div>
        <select data-col="${i}" style="font-size:12px;">${IMP_CAMPOS.map(([k, t]) => `<option value="${k}" ${k === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>`).join("")}</div>`;
    cont.querySelectorAll("[data-col]").forEach((s) => s.addEventListener("change", () => { mapa[Number(s.dataset.col)] = s.value; recalcularFilas(); }));
  }
  let datosCrudos = [];
  function procesar(datos) { datosCrudos = datos; recalcularFilas(); }
  function recalcularFilas() {
    const idx = (k) => mapa.indexOf(k);
    filas = datosCrudos.map((c, i) => {
      const r = { n: i + 1, avisos: [], ok: true };
      const get = (k) => (idx(k) >= 0 ? c[idx(k)] : undefined);
      r.punto = String(get("punto") || "").trim();
      const num = (k, geo) => { const raw = get(k); if (raw == null || raw === "") return null; const x = impNum(raw, f("dec").value, geo); if (!x) r.ok = false; if (!x) r.avisos.push(IMP_CAMPOS.find((z) => z[0] === k)[1] + " no es un número: «" + raw + "»" + (/^[+-]?\d+,\d+$/.test(raw) ? " (¿usa coma decimal? cambia «Decimal»)" : "")); return x; };
      r.lat = num("lat", true); r.lng = num("lng", true); r.este = num("este"); r.norte = num("norte");
      r.hElip = num("hElip"); r.cota = num("cota");
      if (!r.punto) { r.avisos.push("sin nombre de punto"); r.ok = false; }
      if (r.lat && Math.abs(r.lat.v) > 90) { r.avisos.push("latitud fuera de rango (¿columnas invertidas?)"); r.ok = false; }
      if (r.lng && Math.abs(r.lng.v) > 180) { r.avisos.push("longitud fuera de rango"); r.ok = false; }
      return r;
    });
    pintarPrevia();
  }
  function pintarPrevia() {
    const cont = q("[data-prev]");
    if (!filas.length) { cont.innerHTML = lineas.length ? `<p class="muted">No hay filas para importar.</p>` : ""; q("[data-opts]").style.display = "none"; q("[data-ok]").disabled = true; return; }
    const t = (x) => x ? escapeHtml(x.txt) : "";
    cont.innerHTML = `<p class="muted" style="margin-bottom:4px;"><strong>Vista previa</strong> — ${filas.length} fila(s)</p>
      <div class="table-wrap" style="max-height:220px; overflow:auto;"><table><thead><tr><th></th><th>Punto</th><th>Lat</th><th>Lng</th><th>Este</th><th>Norte</th><th>H elip</th><th>Cota</th></tr></thead><tbody>
      ${filas.map((r, i) => `<tr style="${r.avisos.length ? "background:#FBF3E1;" : ""}"><td><input type="checkbox" data-sel="${i}" ${r.ok ? "checked" : ""} style="width:auto;"></td>
        <td title="${escapeHtml(r.avisos.join("; "))}">${escapeHtml(r.punto)}${r.avisos.length ? " ⚠️" : ""}</td><td>${t(r.lat)}</td><td>${t(r.lng)}</td><td>${t(r.este)}</td><td>${t(r.norte)}</td><td>${t(r.hElip)}</td><td>${t(r.cota)}</td></tr>`).join("")}
      </tbody></table></div>
      ${filas.some((r) => r.avisos.length) ? `<p class="preview-note">⚠️ Las filas inválidas quedan desmarcadas; pasa el cursor por el punto para ver el motivo.</p>` : ""}`;
    cont.querySelectorAll("[data-sel]").forEach((c) => c.addEventListener("change", actualizarBoton));
    q("[data-opts]").style.display = "";
    actualizarBoton();
  }
  function actualizarBoton() {
    const n = ov.querySelectorAll("[data-sel]:checked").length;
    const b = q("[data-ok]"); b.disabled = !n; b.textContent = n ? "Crear " + n + " monografía" + (n === 1 ? "" : "s") : "Crear monografías";
  }
  f("archivo").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    let t = await file.text();
    if (t.includes("�")) { try { t = new TextDecoder("latin1").decode(await file.arrayBuffer()); } catch (_) {} } // archivos de Windows (ANSI)
    f("texto").value = t.replace(/^﻿/, ""); mapa = []; recalcular();
  });
  ["input"].forEach((ev) => f("texto").addEventListener(ev, () => { mapa = []; recalcular(); }));
  f("sep").addEventListener("change", () => { mapa = []; recalcular(); });
  f("dec").addEventListener("change", () => recalcularFilas());
  f("cab").addEventListener("change", () => { mapa = []; recalcular(); });

  q("[data-ok]").addEventListener("click", async () => {
    try { localStorage.setItem("impMonoMapa", JSON.stringify(mapa)); localStorage.setItem("catHuso", String(parseInt(f("huso").value, 10) || huso)); } catch (_) {}
    const h = parseInt(f("huso").value, 10) || huso;
    const seleccion = Array.from(ov.querySelectorAll("[data-sel]:checked")).map((c) => filas[Number(c.dataset.sel)]);
    const proy = f("proy").value.trim(), oper = f("oper").value.trim(), fecha = f("fecha").value, dup = f("dup").value, calc = f("calc").checked;
    let creadas = 0, actualizadas = 0, omitidas = 0, calculadas = 0, ultima = null;
    for (const r of seleccion) {
      let lat = r.lat ? r.lat.txt : "", lng = r.lng ? r.lng.txt : "", este = r.este ? r.este.txt : "", norte = r.norte ? r.norte.txt : "";
      let calcUtm = false, calcGeo = false;
      if (calc) {
        if (lat && lng && !(este && norte)) { const u = latLngAUtm(r.lat.v, r.lng.v, h, true); este = u.este.toFixed(3); norte = u.norte.toFixed(3); calculadas++; calcUtm = true; }
        else if (este && norte && !(lat && lng)) { const g = utmALatLng(parseFloat(norte), parseFloat(este), h, true); lat = g.lat.toFixed(8); lng = g.lng.toFixed(8); calculadas++; calcGeo = true; }
      }
      const existente = state.monografias.find((m) => (m.puntoMedido || "").trim().toLowerCase() === r.punto.toLowerCase() && (m.nombreProyecto || "") === (proy || ""));
      if (existente && dup === "omitir") { omitidas++; continue; }
      const m = existente && dup === "actualizar" ? existente : crearMonografiaDesdeDefaults();
      m.puntoMedido = r.punto;
      if (proy) m.nombreProyecto = proy;
      if (oper) m.operadorNombre = oper;
      if (fecha) m.fechaMedicion = fecha;
      if (!m.zonaUTM) m.zonaUTM = h + "S";
      lat = geoSegunFormato(lat, "lat"); lng = geoSegunFormato(lng, "lng");
      m.latitud = lat; m.longitud = lng; m.este = este; m.norte = norte;
      // Marca de lo que calculó la app (se muestra con ? mientras los valores no se editen a mano)
      m.calc = {};
      if (calcUtm) m.calc.utm = { norte, este };
      if (calcGeo) m.calc.geo = { lat, lng };
      m.alturaElipsoidal = r.hElip ? r.hElip.txt : ""; m.cotaOrtometrica = r.cota ? r.cota.txt : "";
      if (existente && dup === "actualizar") actualizadas++; else { state.monografias.push(m); creadas++; }
      await dbPut("monografias", m);
      ultima = m;
    }
    if (ultima) guardarMonografiaDefaults(ultima);
    ov.remove();
    toast(creadas + " creada(s)" + (actualizadas ? ", " + actualizadas + " actualizada(s)" : "") + (omitidas ? ", " + omitidas + " omitida(s) por ya existir" : "") + (calculadas ? " · " + calculadas + " con coordenadas calculadas" : ""));
    renderMonografias();
  });
}
window.abrirImportadorMonografias = abrirImportadorMonografias;
