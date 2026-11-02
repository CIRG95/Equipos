"use strict";

/* =========================================================================
   v0.1d — FOTOS Y AJUSTE DE IMÁGENES
   - Toda foto entra por cámara O por archivo/galería (mismo tratamiento).
   - Al entrar se lee la ubicación EXIF (si trae) y luego se reduce (máx. 1600 px)
     para que la base de datos y los respaldos no crezcan sin control.
   - Ajuste de imagen: modo "llenar" (recorta sin deformar) o "ajustar" (se ve
     entera con márgenes), zoom, desplazamiento y giro de 90°. El mismo cálculo
     se usa en la vista previa y en el PDF, así lo que ves es lo que sale.
   ========================================================================= */
function cargarImagenEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
function leerArchivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
/* Reduce una imagen (dataURL) a un máximo de maxPx por lado. Si falla, devuelve la original. */
async function reducirDataUrl(dataUrl, maxPx, calidad, conservarPng) {
  try {
    const img = await cargarImagenEl(dataUrl);
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!w0 || !h0) return dataUrl;
    const esc = Math.min(1, maxPx / Math.max(w0, h0));
    const png = conservarPng && /^data:image\/png/i.test(dataUrl);
    if (esc === 1 && (png || /^data:image\/jpe?g/i.test(dataUrl)) && dataUrl.length < 700000) return dataUrl;
    const c = document.createElement("canvas");
    c.width = Math.round(w0 * esc); c.height = Math.round(h0 * esc);
    const ctx = c.getContext("2d");
    if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", calidad || 0.82);
  } catch (_) { return dataUrl; }
}
/* Lee un archivo de imagen (cámara o galería): devuelve { dataUrl, gps } */
async function leerFotoArchivo(file, opts) {
  opts = opts || {};
  let gps = null;
  try { gps = leerGPSDeExif(await file.arrayBuffer()); } catch (_) {}
  let dataUrl = await leerArchivoComoDataUrl(file);
  dataUrl = await reducirDataUrl(dataUrl, opts.maxPx || 1600, 0.82, !!opts.conservarPng);
  return { dataUrl, gps };
}
/* Botones "📷 Cámara" y "🖼️ Archivo" (dos inputs ocultos). */
function selectorFotoHtml(id, opts) {
  opts = opts || {};
  return `<div class="row" style="gap:8px; align-items:center;">
    <label class="btn btn-outline btn-sm" style="flex:1; text-align:center; margin:0; cursor:pointer;">📷 Cámara
      <input type="file" accept="image/*" capture="environment" id="${id}Cam" style="display:none;"></label>
    <label class="btn btn-outline btn-sm" style="flex:1; text-align:center; margin:0; cursor:pointer;">🖼️ Archivo / galería
      <input type="file" accept="image/*" ${opts.multiple ? "multiple" : ""} id="${id}File" style="display:none;"></label>
  </div>`;
}
function wireSelectorFoto(root, id, onFile) {
  ["Cam", "File"].forEach((suf) => {
    const inp = root.querySelector("#" + id + suf);
    if (!inp) return;
    inp.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      for (const f of files) await onFile(f, suf === "Cam" ? "camara" : "archivo");
    });
  });
}

/* Cálculo común (vista previa y PDF). iw/ih = imagen ya girada; bw/bh = caja.
   aj = { modo:"llenar"|"ajustar", zoom:1..4, ox:-1..1, oy:-1..1, giro:0|90|180|270 } */
function calcRectImagen(iw, ih, bw, bh, aj) {
  aj = aj || {};
  const modo = aj.modo === "ajustar" ? "ajustar" : "llenar";
  const zoom = Math.min(4, Math.max(1, Number(aj.zoom) || 1));
  const base = modo === "ajustar" ? Math.min(bw / iw, bh / ih) : Math.max(bw / iw, bh / ih);
  const s = base * zoom;
  const w = iw * s, h = ih * s;
  const sx = Math.max(0, (w - bw) / 2), sy = Math.max(0, (h - bh) / 2);
  const ox = Math.min(1, Math.max(-1, Number(aj.ox) || 0)), oy = Math.min(1, Math.max(-1, Number(aj.oy) || 0));
  return { x: (bw - w) / 2 + ox * sx, y: (bh - h) / 2 + oy * sy, w, h, sx, sy };
}
/* Dibuja la imagen ajustada en un canvas del tamaño de la caja (bw×bh mm a ~8 px/mm)
   y devuelve un dataURL: en el PDF solo se coloca ese resultado, ya sin deformación. */
async function renderizarImagenAjustada(dataUrl, bw, bh, aj, opts) {
  opts = opts || {};
  const img = await cargarImagenEl(dataUrl);
  const PX = opts.pxPorMm || 8;
  const cw = Math.max(2, Math.round(bw * PX)), ch = Math.max(2, Math.round(bh * PX));
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  const ctx = c.getContext("2d");
  if (!opts.png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch); }
  const giro = (((Number((aj || {}).giro) || 0) % 360) + 360) % 360;
  const swap = giro === 90 || giro === 270;
  const iw = swap ? img.naturalHeight : img.naturalWidth, ih = swap ? img.naturalWidth : img.naturalHeight;
  const r = calcRectImagen(iw, ih, cw, ch, aj);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, cw, ch); ctx.clip();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.rotate(giro * Math.PI / 180);
  ctx.drawImage(img, -(swap ? r.h : r.w) / 2, -(swap ? r.w : r.h) / 2, swap ? r.h : r.w, swap ? r.w : r.h);
  ctx.restore();
  return opts.png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.9);
}

/* Ventana de ajuste: caja con la proporción real que tendrá en el PDF. */
function abrirAjusteImagen(cfg) {
  // cfg: { titulo, dataUrl, bw, bh (mm), ajuste, onOk(ajuste) }
  const aj = Object.assign({ modo: "llenar", zoom: 1, ox: 0, oy: 0, giro: 0 }, cfg.ajuste || {});
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const PW = Math.min(320, Math.max(220, window.innerWidth - 80));
  const PH = Math.max(60, Math.round(PW * cfg.bh / cfg.bw));
  overlay.innerHTML = `
    <div class="modal-sheet">
      <button class="close-x" id="ajClose" type="button">&times;</button>
      <h3>Ajustar imagen</h3>
      <p class="muted">${escapeHtml(cfg.titulo || "")} · así se verá en el PDF (arrastra para mover)</p>
      <div id="ajCaja" style="position:relative; width:${PW}px; height:${PH}px; margin:10px auto; overflow:hidden; background:#fff; border:2px solid var(--primary); border-radius:4px; touch-action:none; cursor:grab;">
        <img id="ajImg" draggable="false" style="position:absolute; max-width:none; user-select:none; pointer-events:none;">
      </div>
      <div class="row" style="gap:6px; margin-bottom:6px;">
        <button class="btn btn-sm" type="button" data-modo="llenar" style="flex:1;">Llenar (recorta)</button>
        <button class="btn btn-sm" type="button" data-modo="ajustar" style="flex:1;">Entera (con márgenes)</button>
      </div>
      <label>Zoom: <span id="ajZoomTxt"></span></label>
      <input type="range" id="ajZoom" min="1" max="4" step="0.05">
      <div class="row" style="gap:6px;">
        <div style="flex:1;"><label>Mover ← →</label><input type="range" id="ajOx" min="-1" max="1" step="0.01"></div>
        <div style="flex:1;"><label>Mover ↑ ↓</label><input type="range" id="ajOy" min="-1" max="1" step="0.01"></div>
      </div>
      <div class="row" style="gap:6px; margin-top:8px;">
        <button class="btn btn-outline btn-sm" type="button" id="ajGiroI" style="flex:1;">↺ Girar</button>
        <button class="btn btn-outline btn-sm" type="button" id="ajGiroD" style="flex:1;">↻ Girar</button>
        <button class="btn btn-outline btn-sm" type="button" id="ajReset" style="flex:1;">Restablecer</button>
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" type="button" id="ajCancelar" style="flex:1;">Cancelar</button>
        <button class="btn btn-accent" type="button" id="ajAplicar" style="flex:1;">Aplicar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const $ = (s) => overlay.querySelector(s);
  const cerrar = () => overlay.remove();
  $("#ajClose").addEventListener("click", cerrar);
  $("#ajCancelar").addEventListener("click", cerrar);
  const img = $("#ajImg");
  let nat = null;
  function pintar() {
    if (!nat) return;
    const giro = (((aj.giro || 0) % 360) + 360) % 360;
    const swap = giro === 90 || giro === 270;
    const iw = swap ? nat.h : nat.w, ih = swap ? nat.w : nat.h;
    const r = calcRectImagen(iw, ih, PW, PH, aj);
    const dw = swap ? r.h : r.w, dh = swap ? r.w : r.h;
    img.style.width = dw + "px"; img.style.height = dh + "px";
    img.style.left = (r.x + r.w / 2 - dw / 2) + "px";
    img.style.top = (r.y + r.h / 2 - dh / 2) + "px";
    img.style.transform = "rotate(" + giro + "deg)";
    overlay.querySelectorAll("[data-modo]").forEach((b) => {
      b.className = "btn btn-sm " + (b.dataset.modo === aj.modo ? "btn-accent" : "btn-outline");
    });
    $("#ajZoom").value = aj.zoom; $("#ajZoomTxt").textContent = Math.round(aj.zoom * 100) + "%";
    $("#ajOx").value = aj.ox; $("#ajOy").value = aj.oy;
    overlay._r = r;
  }
  cargarImagenEl(cfg.dataUrl).then((im) => { nat = { w: im.naturalWidth, h: im.naturalHeight }; img.src = cfg.dataUrl; pintar(); });
  overlay.querySelectorAll("[data-modo]").forEach((b) => b.addEventListener("click", () => { aj.modo = b.dataset.modo; pintar(); }));
  $("#ajZoom").addEventListener("input", (e) => { aj.zoom = parseFloat(e.target.value); pintar(); });
  $("#ajOx").addEventListener("input", (e) => { aj.ox = parseFloat(e.target.value); pintar(); });
  $("#ajOy").addEventListener("input", (e) => { aj.oy = parseFloat(e.target.value); pintar(); });
  $("#ajGiroI").addEventListener("click", () => { aj.giro = ((aj.giro || 0) + 270) % 360; pintar(); });
  $("#ajGiroD").addEventListener("click", () => { aj.giro = ((aj.giro || 0) + 90) % 360; pintar(); });
  $("#ajReset").addEventListener("click", () => { aj.modo = "llenar"; aj.zoom = 1; aj.ox = 0; aj.oy = 0; aj.giro = 0; pintar(); });
  // Arrastrar con el dedo / mouse
  const caja = $("#ajCaja");
  let drag = null;
  caja.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, ox: aj.ox, oy: aj.oy }; caja.setPointerCapture(e.pointerId); caja.style.cursor = "grabbing"; });
  caja.addEventListener("pointermove", (e) => {
    if (!drag || !overlay._r) return;
    const r = overlay._r;
    if (r.sx > 0.5) aj.ox = Math.min(1, Math.max(-1, drag.ox + (e.clientX - drag.x) / r.sx));
    if (r.sy > 0.5) aj.oy = Math.min(1, Math.max(-1, drag.oy + (e.clientY - drag.y) / r.sy));
    pintar();
  });
  const fin = () => { drag = null; caja.style.cursor = "grab"; };
  caja.addEventListener("pointerup", fin); caja.addEventListener("pointercancel", fin);
  $("#ajAplicar").addEventListener("click", () => { cerrar(); cfg.onOk(Object.assign({}, aj)); });
}
window.abrirAjusteImagen = abrirAjusteImagen;

function jornadaActiva() {
  return state.jornadas.find((j) => j.id === state.jornadaActivaId) || null;
}
function levantamientoActivo() {
  return state.levantamientos.find((l) => l.id === state.levantamientoActivoId) || null;
}
function levantamientosDeJornada(jornadaId) {
  return state.levantamientos.filter((l) => l.jornadaId === jornadaId);
}
