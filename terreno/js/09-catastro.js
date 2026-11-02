"use strict";

/* =========================================================================
   v0.1d — CATASTRO
   Levantamiento de elementos (postes, cámaras, tapas, muros…): código
   correlativo, tipo (lista editable en ⚙), estado, atributos según el tipo,
   descripción, notas, varias fotos (cámara o archivo) y ubicación con origen:
   foto → GPS → mapa → calculada (UTM o lat/lng) → vinculada a un punto medido.
   Al reemplazar la aproximada por la calculada, la aproximada se conserva.
   ========================================================================= */
const CATASTRO_TIPOS_DEFAULT = [
  "Poste: Material, Altura (m), Diámetro (cm)",
  "Cámara: Material, Largo (m), Ancho (m), Profundidad (m)",
  "Tapa: Material, Diámetro o lado (cm), Servicio",
  "Luminaria: Tipo de lámpara, Altura (m), N° de brazos",
  "Muro: Material, Largo (m), Alto (m), Espesor (cm)",
  "Señal: Código de señal, Altura (m)",
  "Árbol: Especie, Altura (m), DAP (cm)",
  "Válvula: Diámetro (mm), Servicio",
  "Otro: Material, Dimensiones"
].join("\n");
const CAT_ESTADOS = [
  { v: "bueno", t: "Bueno", c: "#2e8b57" },
  { v: "regular", t: "Regular", c: "#d99a1e" },
  { v: "malo", t: "Malo", c: "#c0392b" }
];
const CAT_COLOR_SIN = "#7a8a90";
const CAT_ROLES = [["general", "General"], ["detalle", "Detalle"], ["placa", "Placa / etiqueta"], ["otra", "Otra"]];

function esCatastro(lev) { return !!lev && lev.instrumento === "catastro"; }
function catEstadoInfo(v) { return CAT_ESTADOS.find((e) => e.v === v) || { v: "", t: "Sin evaluar", c: CAT_COLOR_SIN }; }
function catastroTiposTexto() {
  let t = null;
  try { t = localStorage.getItem("catastroTiposTexto"); } catch (_) {}
  return t && t.trim() ? t : CATASTRO_TIPOS_DEFAULT;
}
function catastroTipos() {
  return catastroTiposTexto().split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(":");
    return { nombre: (i < 0 ? l : l.slice(0, i)).trim(), attrs: (i < 0 ? "" : l.slice(i + 1)).split(",").map((x) => x.trim()).filter(Boolean) };
  }).filter((t) => t.nombre);
}
function catSiguienteCodigo(lev) {
  const cods = state.levantamientos.filter((l) => l.jornadaId === lev.jornadaId && esCatastro(l))
    .flatMap((l) => l.puntos.map((p) => ({ c: String((p.valores || {}).codigo || ""), t: p.timestamp || "" })))
    .sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  for (let i = cods.length - 1; i >= 0; i--) {
    const m = /^(.*?)(\d+)$/.exec(cods[i].c);
    if (m) return m[1] + String(parseInt(m[2], 10) + 1).padStart(m[2].length, "0");
  }
  return "CAT-001";
}
function catAtributosTexto(at) {
  return Object.keys(at || {}).filter((k) => String(at[k]).trim() !== "").map((k) => k + ": " + at[k]).join("; ");
}
function catNuevoDatos(lev) {
  let tipo = "";
  try { tipo = localStorage.getItem("catUltimoTipo") || ""; } catch (_) {}
  const tipos = catastroTipos();
  if (!tipos.some((t) => t.nombre === tipo)) tipo = tipos.length ? tipos[0].nombre : "";
  return { codigo: catSiguienteCodigo(lev), tipoElemento: tipo, estado: "", descripcion: "", atributos: {}, obs: "", fotos: [],
    lat: null, lng: null, ubicFuente: null, ubicAprox: null, coordCalc: null, vinculo: null };
}
function catDatosDePunto(p) {
  const v = p.valores || {};
  const fotos = (p.fotos && p.fotos.length ? p.fotos : (p.foto ? [{ id: uuid(), dataUrl: p.foto, rol: "general" }] : [])).map((f) => Object.assign({}, f));
  return { codigo: v.codigo || "", tipoElemento: v.tipoElemento || "", estado: v.estado || "", descripcion: v.descripcion || "",
    atributos: Object.assign({}, p.atributos || {}), obs: v.obs || "", fotos,
    lat: p.lat != null ? p.lat : null, lng: p.lng != null ? p.lng : null, ubicFuente: p.ubicFuente || null,
    ubicAprox: p.ubicAprox ? Object.assign({}, p.ubicAprox) : null, coordCalc: p.coordCalc ? Object.assign({}, p.coordCalc) : null,
    vinculo: p.vinculo ? Object.assign({}, p.vinculo) : null };
}
function catAplicarDatosAPunto(p, d) {
  p.valores = Object.assign(p.valores || {}, {
    codigo: d.codigo.trim(), tipoElemento: d.tipoElemento, estado: d.estado, descripcion: d.descripcion.trim(),
    atributos: catAtributosTexto(d.atributos), obs: d.obs.trim()
  });
  p.atributos = Object.assign({}, d.atributos);
  p.fotos = d.fotos.map((f) => Object.assign({}, f));
  p.foto = d.fotos.length ? d.fotos[0].dataUrl : null;
  p.lat = d.lat; p.lng = d.lng; p.ubicFuente = d.lat != null ? d.ubicFuente : null;
  p.ubicAprox = d.ubicAprox; p.coordCalc = d.coordCalc; p.vinculo = d.vinculo;
}

/* UTM (WGS84/SIRGAS, hemisferio sur por defecto) → lat/lng decimales */
function utmALatLng(norte, este, huso, sur) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const x = este - 500000, y = sur === false ? norte : norte - 10000000;
  const M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * Math.pow(e2, 3) / 256));
  const phi1 = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu)
    + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu) + (1097 * Math.pow(e1, 4) / 512) * Math.sin(8 * mu);
  const s = Math.sin(phi1), c = Math.cos(phi1), t = Math.tan(phi1);
  const N1 = a / Math.sqrt(1 - e2 * s * s), T1 = t * t, C1 = ep2 * c * c;
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * s * s, 1.5), D = x / (N1 * k0);
  const lat = phi1 - (N1 * t / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * Math.pow(D, 4) / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * Math.pow(D, 6) / 720);
  const lon = (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * Math.pow(D, 5) / 120) / c;
  return { lat: lat * 180 / Math.PI, lng: (huso * 6 - 183) + lon * 180 / Math.PI };
}
window.utmALatLng = utmALatLng;

function catFormHtml(d) {
  const tipos = catastroTipos();
  const nombres = tipos.map((t) => t.nombre);
  if (d.tipoElemento && !nombres.includes(d.tipoElemento)) nombres.push(d.tipoElemento);
  return `
    <label>Código</label>
    <input type="text" data-ct="codigo" value="${escapeHtml(d.codigo)}" autocapitalize="characters">
    <label>Tipo de elemento</label>
    <select data-ct="tipo">${nombres.map((n) => `<option value="${escapeHtml(n)}" ${n === d.tipoElemento ? "selected" : ""}>${escapeHtml(n)}</option>`).join("")}</select>
    <label>Estado</label>
    <div class="row" data-ct="estado" style="gap:6px;"></div>
    <label>Descripción</label>
    <textarea data-ct="desc" rows="2" placeholder="Ej: Poste de hormigón con luminaria, junto al cerco norte">${escapeHtml(d.descripcion)}</textarea>
    <div data-ct="attrs"></div>
    <label>Notas</label>
    <textarea data-ct="obs" rows="3" placeholder="Observaciones, daños, pendientes…">${escapeHtml(d.obs)}</textarea>
    <label>Fotos del elemento</label>
    <div data-ct="fotos"></div>
    ${selectorFotoHtml("ctFoto", { multiple: true })}
    <label>Ubicación</label>
    <div data-ct="ubic"></div>`;
}

function catFormWire(root, lev, d) {
  const $ = (k) => root.querySelector('[data-ct="' + k + '"]');
  $("codigo").addEventListener("input", (e) => { d.codigo = e.target.value; });
  $("desc").addEventListener("input", (e) => { d.descripcion = e.target.value; });
  $("obs").addEventListener("input", (e) => { d.obs = e.target.value; });

  const pintarEstado = () => {
    const opciones = [{ v: "", t: "Sin evaluar", c: CAT_COLOR_SIN }].concat(CAT_ESTADOS);
    $("estado").innerHTML = opciones.map((o) => `<button type="button" class="btn btn-sm ${d.estado === o.v ? "" : "btn-outline"}" data-est="${o.v}"
      style="flex:1; ${d.estado === o.v ? "background:" + o.c + "; border-color:" + o.c + "; color:#fff;" : ""}">${o.t}</button>`).join("");
    $("estado").querySelectorAll("[data-est]").forEach((b) => b.addEventListener("click", () => { d.estado = b.dataset.est; pintarEstado(); }));
  };
  const pintarAttrs = () => {
    const t = catastroTipos().find((x) => x.nombre === d.tipoElemento);
    const labels = t ? t.attrs : [];
    const cont = $("attrs");
    cont.innerHTML = labels.length ? `<p class="muted" style="margin:10px 0 0;"><strong>Atributos de ${escapeHtml(d.tipoElemento)}</strong></p>` +
      labels.map((l, i) => `<label>${escapeHtml(l)}</label><input type="text" data-attr="${i}" value="${escapeHtml(d.atributos[l] ?? "")}">`).join("") : "";
    cont.querySelectorAll("[data-attr]").forEach((inp) => inp.addEventListener("input", () => { d.atributos[labels[Number(inp.dataset.attr)]] = inp.value; }));
    // se descartan atributos de otros tipos que quedaron sin uso
    Object.keys(d.atributos).forEach((k) => { if (!labels.includes(k)) delete d.atributos[k]; });
  };
  $("tipo").addEventListener("change", (e) => {
    d.tipoElemento = e.target.value;
    try { localStorage.setItem("catUltimoTipo", d.tipoElemento); } catch (_) {}
    pintarAttrs();
  });

  const pintarFotos = () => {
    const cont = $("fotos");
    if (!d.fotos.length) { cont.innerHTML = `<p class="muted">Sin fotos todavía. Usa 📷 Cámara o 🖼️ Archivo.</p>`; return; }
    cont.innerHTML = d.fotos.map((f, i) => `
      <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
        <img src="${f.dataUrl}" class="thumb" style="width:64px; height:64px; flex:none;" data-ver="${i}">
        <div style="flex:1; min-width:0;">
          <select data-rol="${i}">${CAT_ROLES.map(([v, t]) => `<option value="${v}" ${f.rol === v ? "selected" : ""}>${t}</option>`).join("")}</select>
          <div class="muted" style="font-size:12px;">${f.lat != null ? "📍 trae ubicación" : "sin ubicación propia"}</div>
        </div>
        <button class="btn btn-outline btn-sm danger" type="button" data-quitar="${i}">✕</button>
      </div>`).join("");
    cont.querySelectorAll("[data-ver]").forEach((im) => im.addEventListener("click", () => verFoto(d.fotos[Number(im.dataset.ver)].dataUrl)));
    cont.querySelectorAll("[data-rol]").forEach((s) => s.addEventListener("change", () => { d.fotos[Number(s.dataset.rol)].rol = s.value; catResolverUbicacion(d).then(pintarUbic); }));
    cont.querySelectorAll("[data-quitar]").forEach((b) => b.addEventListener("click", () => { d.fotos.splice(Number(b.dataset.quitar), 1); pintarFotos(); }));
  };

  async function pintarUbic() {
    const cont = $("ubic");
    const txt = d.lat != null ? fmtCoord(d.lat, d.lng) + " · " + fmtFuenteUbic(d.ubicFuente) : "Sin ubicación";
    cont.innerHTML = `
      <div class="muted" style="margin-bottom:4px;">${escapeHtml(txt)}</div>
      ${d.ubicAprox && d.ubicFuente !== d.ubicAprox.fuente ? `<div class="muted" style="font-size:12px; margin-bottom:4px;">Aproximada original: ${escapeHtml(fmtCoord(d.ubicAprox.lat, d.ubicAprox.lng))} (${escapeHtml(fmtFuenteUbic(d.ubicAprox.fuente))}) <a href="#" data-volver>volver a ella</a></div>` : ""}
      ${d.vinculo ? `<div class="muted" style="font-size:12px; margin-bottom:4px;">🔗 Vinculado a: ${escapeHtml(d.vinculo.etiqueta || "")}</div>` : ""}
      <div class="row" style="gap:6px; flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" type="button" data-u="gps" style="flex:1;">📍 GPS ahora</button>
        <button class="btn btn-outline btn-sm" type="button" data-u="mapa" style="flex:1;">🗺️ Mapa</button>
      </div>
      <div class="row" style="gap:6px; flex-wrap:wrap; margin-top:6px;">
        <button class="btn btn-outline btn-sm" type="button" data-u="calc" style="flex:1;">🧮 Coordenada calculada</button>
        <button class="btn btn-outline btn-sm" type="button" data-u="vinc" style="flex:1;">🔗 Vincular a punto medido</button>
      </div>`;
    cont.querySelector("[data-u=gps]").addEventListener("click", async () => {
      cont.querySelector(".muted").innerHTML = '<span class="spinner"></span> Capturando GPS…';
      const pos = await getUbicacionActual();
      if (!pos) { toast("GPS no disponible"); return pintarUbic(); }
      if (d.ubicFuente === "calculada" && !confirm("La ubicación actual es calculada. ¿Reemplazarla por el GPS?")) return pintarUbic();
      d.lat = pos.lat; d.lng = pos.lng; d.ubicFuente = "gps"; pintarUbic();
    });
    cont.querySelector("[data-u=mapa]").addEventListener("click", () => abrirMapModal(d.lat, d.lng, (pos) => {
      if (d.ubicFuente === "calculada" && !confirm("La ubicación actual es calculada. ¿Reemplazarla por la del mapa?")) return;
      d.lat = pos.lat; d.lng = pos.lng; d.ubicFuente = "mapa"; pintarUbic();
    }));
    cont.querySelector("[data-u=calc]").addEventListener("click", () => catPedirCoordCalculada(d, pintarUbic));
    cont.querySelector("[data-u=vinc]").addEventListener("click", () => catPedirVinculo(lev, d, pintarUbic));
    const v = cont.querySelector("[data-volver]");
    if (v) v.addEventListener("click", (e) => {
      e.preventDefault();
      d.lat = d.ubicAprox.lat; d.lng = d.ubicAprox.lng; d.ubicFuente = d.ubicAprox.fuente; d.coordCalc = null; d.vinculo = null; pintarUbic();
    });
  }

  wireSelectorFoto(root, "ctFoto", async (file, origen) => {
    let r;
    try { r = await leerFotoArchivo(file); } catch (_) { toast("No se pudo leer la imagen"); return; }
    d.fotos.push({ id: uuid(), dataUrl: r.dataUrl, rol: d.fotos.length ? "detalle" : "general", lat: r.gps ? r.gps.lat : null, lng: r.gps ? r.gps.lng : null, origen });
    pintarFotos();
    await catResolverUbicacion(d, origen);
    pintarUbic();
  });

  pintarEstado(); pintarAttrs(); pintarFotos(); pintarUbic();
  // Ubicación inicial al abrir el formulario de un elemento nuevo
  if (d.lat == null) getUbicacionActual().then((pos) => { if (pos && d.lat == null) { d.lat = pos.lat; d.lng = pos.lng; d.ubicFuente = "gps"; pintarUbic(); } });
}

/* Prioridad de ubicación: manual/calculada/vinculada no se pisan; luego foto (GPS EXIF) → GPS del teléfono. */
async function catResolverUbicacion(d, origen) {
  if (["mapa", "calculada", "vinculado"].includes(d.ubicFuente)) return;
  const conGps = d.fotos.find((f) => f.rol === "general" && f.lat != null) || d.fotos.find((f) => f.lat != null);
  if (conGps) { d.lat = conGps.lat; d.lng = conGps.lng; d.ubicFuente = "foto"; return; }
  if (origen === "archivo" && d.lat != null) return; // foto de galería sin ubicación: no pisar
  if (origen === "camara") {
    const pos = await getUbicacionActual();
    if (pos) { d.lat = pos.lat; d.lng = pos.lng; d.ubicFuente = "gps"; }
  }
}
function catGuardarAprox(d) {
  if (d.lat != null && !["calculada", "vinculado"].includes(d.ubicFuente) && !d.ubicAprox) d.ubicAprox = { lat: d.lat, lng: d.lng, fuente: d.ubicFuente };
}

function catPedirCoordCalculada(d, onOk) {
  let huso = 19;
  try { huso = parseInt(localStorage.getItem("catHuso") || "19", 10) || 19; } catch (_) {}
  const ov = document.createElement("div");
  ov.className = "modal-overlay";
  ov.innerHTML = `
    <div class="modal-sheet">
      <button class="close-x" data-x type="button">&times;</button>
      <h3>Coordenada calculada</h3>
      <p class="muted">Reemplaza la ubicación aproximada. La aproximada queda guardada y puedes volver a ella.</p>
      <div class="row" style="gap:6px; margin:8px 0;">
        <button class="btn btn-sm btn-accent" type="button" data-fmt="utm" style="flex:1;">UTM</button>
        <button class="btn btn-sm btn-outline" type="button" data-fmt="geo" style="flex:1;">Lat / Lng</button>
      </div>
      <div data-utm>
        <label>Norte (m)</label><input type="text" inputmode="decimal" data-f="norte" value="${d.coordCalc && d.coordCalc.norte != null ? d.coordCalc.norte : ""}">
        <label>Este (m)</label><input type="text" inputmode="decimal" data-f="este" value="${d.coordCalc && d.coordCalc.este != null ? d.coordCalc.este : ""}">
        <label>Huso (Chile: 18 o 19) · hemisferio sur</label><input type="number" data-f="huso" value="${d.coordCalc && d.coordCalc.huso ? d.coordCalc.huso : huso}">
      </div>
      <div data-geo style="display:none;">
        <label>Latitud (°)</label><input type="text" inputmode="decimal" data-f="lat" value="${d.coordCalc && d.coordCalc.fmt === "geo" ? d.coordCalc.lat : ""}">
        <label>Longitud (°)</label><input type="text" inputmode="decimal" data-f="lng" value="${d.coordCalc && d.coordCalc.fmt === "geo" ? d.coordCalc.lng : ""}">
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" type="button" data-x style="flex:1;">Cancelar</button>
        <button class="btn btn-accent" type="button" data-ok style="flex:1;">Usar esta coordenada</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  let fmt = d.coordCalc && d.coordCalc.fmt === "geo" ? "geo" : "utm";
  const q = (s) => ov.querySelector(s);
  const num = (k) => parseFloat(String(q('[data-f="' + k + '"]').value).replace(",", "."));
  const pintar = () => {
    q("[data-utm]").style.display = fmt === "utm" ? "" : "none";
    q("[data-geo]").style.display = fmt === "geo" ? "" : "none";
    ov.querySelectorAll("[data-fmt]").forEach((b) => { b.className = "btn btn-sm " + (b.dataset.fmt === fmt ? "btn-accent" : "btn-outline"); });
  };
  pintar();
  ov.querySelectorAll("[data-fmt]").forEach((b) => b.addEventListener("click", () => { fmt = b.dataset.fmt; pintar(); }));
  ov.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", () => ov.remove()));
  q("[data-ok]").addEventListener("click", () => {
    let lat, lng, cc;
    if (fmt === "utm") {
      const n = num("norte"), e = num("este"), h = parseInt(q('[data-f="huso"]').value, 10);
      if (!isFinite(n) || !isFinite(e) || !(h >= 1 && h <= 60)) return toast("Revisa Norte, Este y Huso.");
      const r = utmALatLng(n, e, h, true);
      lat = r.lat; lng = r.lng; cc = { fmt: "utm", norte: n, este: e, huso: h };
      try { localStorage.setItem("catHuso", String(h)); } catch (_) {}
    } else {
      lat = num("lat"); lng = num("lng");
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return toast("Revisa latitud y longitud.");
      cc = { fmt: "geo", lat, lng };
    }
    catGuardarAprox(d);
    d.lat = lat; d.lng = lng; d.ubicFuente = "calculada"; d.coordCalc = cc; d.vinculo = null;
    ov.remove(); onOk();
  });
}

/* Puntos de la jornada (de cualquier levantamiento) con ubicación, para vincular */
function catPuntosVinculables(lev) {
  const out = [];
  state.levantamientos.filter((l) => l.jornadaId === lev.jornadaId).forEach((l) => {
    const cols = INSTRUMENTOS[l.instrumento].tipos[l.tipo].columnas;
    l.puntos.forEach((p) => {
      if (l.id === lev.id && esCatastro(l)) return;
      if (p.lat == null) return;
      const cod = (p.valores || {})[cols[0].key] || ("punto " + p.numero);
      out.push({ levId: l.id, puntoId: p.id, etiqueta: l.instrumentoNombre + " · " + cod, lat: p.lat, lng: p.lng });
    });
  });
  return out;
}
function catPedirVinculo(lev, d, onOk) {
  const lista = catPuntosVinculables(lev);
  if (!lista.length) return toast("No hay puntos medidos con ubicación en esta jornada.");
  const ov = document.createElement("div");
  ov.className = "modal-overlay";
  ov.innerHTML = `
    <div class="modal-sheet">
      <button class="close-x" data-x type="button">&times;</button>
      <h3>Vincular a un punto medido</h3>
      <p class="muted">Usa la ubicación de un punto de esta jornada (por ejemplo, el punto GNSS que mediste junto al elemento).</p>
      <select data-sel>${lista.map((x, i) => `<option value="${i}">${escapeHtml(x.etiqueta)} — ${escapeHtml(fmtCoord(x.lat, x.lng))}</option>`).join("")}</select>
      <div class="modal-actions">
        <button class="btn btn-outline" type="button" data-x style="flex:1;">Cancelar</button>
        <button class="btn btn-accent" type="button" data-ok style="flex:1;">Vincular y usar su ubicación</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", () => ov.remove()));
  ov.querySelector("[data-ok]").addEventListener("click", () => {
    const x = lista[Number(ov.querySelector("[data-sel]").value)];
    catGuardarAprox(d);
    d.lat = x.lat; d.lng = x.lng; d.ubicFuente = "vinculado"; d.vinculo = { levId: x.levId, puntoId: x.puntoId, etiqueta: x.etiqueta }; d.coordCalc = null;
    ov.remove(); onOk();
  });
}

/* ---------- plano de catastro (círculos por estado; borde punteado = ubicación aproximada) ---------- */
function svgPlanoCatastro(lev, filtro) {
  filtro = filtro || {};
  const todos = lev.puntos.filter((p) => (!filtro.tipo || p.valores.tipoElemento === filtro.tipo) && (filtro.estado == null || filtro.estado === "" || (filtro.estado === "__sin" ? !p.valores.estado : p.valores.estado === filtro.estado)));
  const pts = todos.filter((p) => p.lat != null && p.lng != null);
  const sinUbic = todos.length - pts.length;
  if (!pts.length) return `<p class="muted">Aún no hay elementos con ubicación para dibujar${sinUbic ? " (" + sinUbic + " sin ubicación)" : ""}.</p>`;
  const W = 340, H = 260, PAD = 34;
  const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length, kx = Math.cos(lat0 * Math.PI / 180);
  const xs = pts.map((p) => p.lng * kx), ys = pts.map((p) => p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const dx = maxX - minX, dy = maxY - minY, eps = 1e-9;
  let esc = Math.min(dx > eps ? (W - 2 * PAD) / dx : Infinity, dy > eps ? (H - 2 * PAD) / dy : Infinity);
  if (!isFinite(esc)) esc = null;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const X = (x) => esc ? W / 2 + (x - cx) * esc : W / 2, Y = (y) => esc ? H / 2 - (y - cy) * esc : H / 2;
  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%; background:#fff; border:1px solid var(--line); border-radius:8px;" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="#fff"/>`;
  svg += `<g stroke="#444" stroke-width="1.4" fill="none"><path d="M${W - 22} 40 L${W - 22} 16 M${W - 22} 16 l-4 8 M${W - 22} 16 l4 8"/></g><text x="${W - 22}" y="13" font-size="11" font-weight="700" text-anchor="middle" fill="#444">N</text>`;
  if (esc) {
    const objetivo = 70 * (111320 / esc), pot = Math.pow(10, Math.floor(Math.log10(objetivo))), n = objetivo / pot;
    const bonito = (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * pot, px = bonito / (111320 / esc);
    svg += `<g stroke="#444" stroke-width="1.5"><line x1="12" y1="${H - 14}" x2="${12 + px}" y2="${H - 14}"/><line x1="12" y1="${H - 18}" x2="12" y2="${H - 10}"/><line x1="${12 + px}" y1="${H - 18}" x2="${12 + px}" y2="${H - 10}"/></g>`;
    svg += `<text x="${12 + px / 2}" y="${H - 20}" font-size="9" text-anchor="middle" fill="#444">${bonito >= 1000 ? (bonito / 1000) + " km" : bonito + " m"}</text>`;
  }
  pts.forEach((p) => {
    const px = X(p.lng * kx), py = Y(p.lat), col = catEstadoInfo(p.valores.estado).c;
    const calc = p.ubicFuente === "calculada" || p.ubicFuente === "vinculado";
    svg += `<circle cx="${px}" cy="${py}" r="8" fill="${col}" fill-opacity="${calc ? 1 : 0.8}" stroke="#1a2a30" stroke-width="${calc ? 2.2 : 1.2}" ${calc ? "" : 'stroke-dasharray="3,2"'}/>`;
    svg += `<text x="${px}" y="${py + 21}" font-size="10" text-anchor="middle" fill="#1a2a30" paint-order="stroke" stroke="#fff" stroke-width="3">${escapeHtml(String(p.valores.codigo || "").slice(0, 14))}</text>`;
  });
  svg += `</svg>`;
  return svg + `
    <div class="muted" style="font-size:12px; margin-top:6px; display:flex; flex-wrap:wrap; gap:10px;">
      ${CAT_ESTADOS.map((e) => `<span><span style="color:${e.c};">●</span> ${e.t}</span>`).join("")}
      <span><span style="color:${CAT_COLOR_SIN};">●</span> sin evaluar</span>
      <span>borde punteado = ubicación aproximada · borde continuo = calculada</span>
    </div>
    ${sinUbic ? `<p class="preview-note">${sinUbic} elemento(s) sin ubicación no se dibujan.</p>` : ""}`;
}

function catResumen(lev) {
  const c = { bueno: 0, regular: 0, malo: 0, sin: 0 };
  lev.puntos.forEach((p) => { const e = p.valores.estado; if (c[e] != null) c[e]++; else c.sin++; });
  const sinU = lev.puntos.filter((p) => p.lat == null).length;
  return `${lev.puntos.length} elemento${lev.puntos.length === 1 ? "" : "s"} · ${c.bueno} bueno · ${c.regular} regular · ${c.malo} malo${c.sin ? " · " + c.sin + " sin evaluar" : ""}${sinU ? " · " + sinU + " sin ubicación" : ""}`;
}

function renderCatastroEnCurso(el, lev) {
  const d = catNuevoDatos(lev);
  const filtro = { tipo: "", estado: "" };
  el.innerHTML = `
    <div class="card">
      <h2><span class="num">${lev.puntos.length + 1}</span>Catastro — nuevo elemento</h2>
      <p class="muted">${lev.equipo ? escapeHtml(lev.equipo) : "Sin equipo especificado"} · iniciado ${fmtHoraCorta(lev.fechaInicio)}</p>
      <button class="btn btn-outline btn-sm" type="button" style="margin-top:6px;" onclick="abrirEditorLevantamiento('${lev.id}')">✏️ Editar datos del levantamiento</button>
      <div class="divider"></div>
      <form id="formCatastro">
        <div id="catForm">${catFormHtml(d)}</div>
        <div class="divider"></div>
        <button class="btn btn-accent" type="submit">Agregar elemento</button>
      </form>
    </div>
    <div class="card">
      <h2>Plano del catastro</h2>
      <div id="catPlano"></div>
    </div>
    <div class="card">
      <h2>Elementos registrados</h2>
      <p class="muted" id="catResumen" style="margin-bottom:8px;"></p>
      <div class="row" style="gap:6px;">
        <select id="catFTipo" style="flex:1;"></select>
        <select id="catFEstado" style="flex:1;"></select>
      </div>
      <div id="catLista" style="margin-top:8px;"></div>
      <div class="divider"></div>
      <button class="btn btn-outline danger" id="btnFinalizarLevantamiento" type="button">Finalizar levantamiento</button>
    </div>`;
  catFormWire(el.querySelector("#catForm"), lev, d);

  const selT = el.querySelector("#catFTipo"), selE = el.querySelector("#catFEstado");
  const tiposUsados = Array.from(new Set(lev.puntos.map((p) => p.valores.tipoElemento).filter(Boolean)));
  selT.innerHTML = `<option value="">Todos los tipos</option>` + tiposUsados.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  selE.innerHTML = `<option value="">Todos los estados</option>` + CAT_ESTADOS.map((e) => `<option value="${e.v}">${e.t}</option>`).join("") + `<option value="__sin">Sin evaluar</option>`;
  function pintarLista() {
    filtro.tipo = selT.value; filtro.estado = selE.value;
    const pasa = (p) => (!filtro.tipo || p.valores.tipoElemento === filtro.tipo) &&
      (!filtro.estado || (filtro.estado === "__sin" ? !p.valores.estado : p.valores.estado === filtro.estado));
    el.querySelector("#catResumen").textContent = catResumen(lev);
    el.querySelector("#catPlano").innerHTML = svgPlanoCatastro(lev, { tipo: filtro.tipo, estado: filtro.estado === "__sin" ? "__sin" : filtro.estado });
    const filas = lev.puntos.map((p, i) => ({ p, i })).filter((x) => pasa(x.p));
    el.querySelector("#catLista").innerHTML = !lev.puntos.length ? `<p class="muted">Aún no hay elementos.</p>` : !filas.length ? `<p class="muted">Ningún elemento coincide con el filtro.</p>` :
      filas.map(({ p, i }) => {
        const e = catEstadoInfo(p.valores.estado);
        const fotos = (p.fotos && p.fotos.length ? p.fotos : (p.foto ? [{ dataUrl: p.foto }] : []));
        return `<div style="border:1px solid var(--line); border-radius:10px; padding:8px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <strong>${escapeHtml(p.valores.codigo || "(sin código)")}</strong>
            <span class="badge" style="background:${e.c}; color:#fff;">${e.t}</span>
          </div>
          <div class="muted" style="font-size:13px;">${escapeHtml(p.valores.tipoElemento || "")}${p.valores.descripcion ? " — " + escapeHtml(p.valores.descripcion) : ""}</div>
          ${p.valores.atributos ? `<div class="muted" style="font-size:12px;">${escapeHtml(p.valores.atributos)}</div>` : ""}
          <div style="display:flex; gap:6px; align-items:center; margin-top:6px; flex-wrap:wrap;">
            ${fotos.slice(0, 4).map((f) => `<img src="${f.dataUrl}" class="thumb" style="width:40px; height:40px;" onclick="verFoto('${f.dataUrl}')">`).join("")}
            ${fotos.length > 4 ? `<span class="muted">+${fotos.length - 4}</span>` : ""}
            <span class="muted" style="font-size:12px; flex:1;" title="${p.lat != null ? fmtCoord(p.lat, p.lng) : "Sin ubicación"}">${fmtFuenteUbic(p.ubicFuente)}</span>
            <button class="btn btn-outline btn-sm" onclick="abrirEditorCatastro('${lev.id}', ${i})" type="button">✏️</button>
            <button class="btn btn-outline btn-sm" onclick="eliminarPunto('${lev.id}', ${i})" type="button">✕</button>
          </div>
        </div>`;
      }).join("");
  }
  selT.addEventListener("change", pintarLista); selE.addEventListener("change", pintarLista);
  pintarLista();

  el.querySelector("#formCatastro").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!d.codigo.trim()) return toast("Ingresa un código para el elemento.");
    if (lev.puntos.some((p) => String(p.valores.codigo).trim().toLowerCase() === d.codigo.trim().toLowerCase()) &&
        !confirm("Ya existe un elemento con el código " + d.codigo.trim() + ". ¿Agregar de todas formas?")) return;
    const punto = { id: uuid(), numero: lev.puntos.length + 1, valores: {}, timestamp: nowISO() };
    catAplicarDatosAPunto(punto, d);
    lev.puntos.push(punto);
    await dbPut("levantamientos", lev);
    marcarPendienteSync(lev.jornadaId);
    toast("Elemento " + punto.valores.codigo + " agregado");
    renderTabActual();
  });
  el.querySelector("#btnFinalizarLevantamiento").addEventListener("click", async () => {
    if (lev.puntos.length === 0 && !confirm("No hay elementos registrados. ¿Finalizar de todas formas?")) return;
    lev.estado = "cerrado"; lev.fechaFin = nowISO();
    await dbPut("levantamientos", lev);
    state.levantamientoActivoId = null;
    marcarPendienteSync(lev.jornadaId);
    toast("Levantamiento finalizado");
    renderTabActual();
  });
}

function abrirEditorCatastro(levId, index) {
  const lev = state.levantamientos.find((l) => l.id === levId);
  if (!lev || !lev.puntos[index]) return;
  const p = lev.puntos[index];
  const d = catDatosDePunto(p);
  const ov = document.createElement("div");
  ov.className = "modal-overlay";
  ov.innerHTML = `
    <div class="modal-sheet">
      <button class="close-x" data-x type="button">&times;</button>
      <h3>Editar elemento ${escapeHtml(p.valores.codigo || p.numero)}</h3>
      <div class="divider"></div>
      <form data-form>
        <div data-body>${catFormHtml(d)}</div>
        <div class="modal-actions">
          <button class="btn btn-outline" type="button" data-x style="flex:1;">Cancelar</button>
          <button class="btn btn-accent" type="submit" style="flex:1;">Guardar cambios</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", () => ov.remove()));
  catFormWire(ov.querySelector("[data-body]"), lev, d);
  ov.querySelector("[data-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!d.codigo.trim()) return toast("Ingresa un código para el elemento.");
    catAplicarDatosAPunto(p, d);
    p.editado = nowISO();
    await dbPut("levantamientos", lev);
    marcarPendienteSync(lev.jornadaId);
    ov.remove();
    toast("Elemento actualizado");
    renderTabActual();
  });
}
window.abrirEditorCatastro = abrirEditorCatastro;
