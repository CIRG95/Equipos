"use strict";

/* =========================================================================
   UTILIDADES
   ========================================================================= */
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}
function nowISO() { return new Date().toISOString(); }
function fmtFecha(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}
function fmtHoraCorta(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}
function fmtDuracion(ms) {
  if (ms == null || ms < 0) return "—";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h + "h " + String(m).padStart(2, "0") + "m";
}
function fmtCoord(lat, lng) {
  if (lat == null || lng == null) return "Sin ubicación";
  return lat.toFixed(5) + ", " + lng.toFixed(5);
}
function fmtFuenteUbic(fuente) {
  if (fuente === "foto") return "📷 foto";
  if (fuente === "gps") return "📍 GPS";
  if (fuente === "mapa") return "🗺️ manual";
  if (fuente === "calculada") return "🧮 calculada";
  if (fuente === "vinculado") return "🔗 punto medido";
  return "—";
}
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}
function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function getUbicacionActual() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
    );
  });
}

/* Lee coordenadas GPS desde los metadatos EXIF de una foto JPEG, si existen.
   Devuelve {lat,lng} o null si la foto no trae esa información (muy común,
   varios teléfonos la omiten por privacidad salvo que la app de cámara
   tenga permiso de ubicación activado). */
function leerGPSDeExif(arrayBuffer) {
  try {
    const view = new DataView(arrayBuffer);
    if (view.getUint16(0) !== 0xffd8) return null; // no es JPEG
    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      if (marker === 0xffe1) {
        const exifStart = offset + 4;
        if (view.getUint32(exifStart) !== 0x45786966) return null; // no dice "Exif"
        const tiffOffset = exifStart + 6;
        const little = view.getUint16(tiffOffset) === 0x4949;
        const ifd0Offset = tiffOffset + view.getUint32(tiffOffset + 4, little);

        const numEntries0 = view.getUint16(ifd0Offset, little);
        let gpsIFDOffset = null;
        for (let i = 0; i < numEntries0; i++) {
          const entryOffset = ifd0Offset + 2 + i * 12;
          if (view.getUint16(entryOffset, little) === 0x8825) {
            gpsIFDOffset = tiffOffset + view.getUint32(entryOffset + 8, little);
            break;
          }
        }
        if (gpsIFDOffset == null) return null; // la foto no trae bloque GPS

        const numGPSEntries = view.getUint16(gpsIFDOffset, little);
        const gps = {};
        for (let i = 0; i < numGPSEntries; i++) {
          const entryOffset = gpsIFDOffset + 2 + i * 12;
          const tag = view.getUint16(entryOffset, little);
          if (tag === 1) gps.latRef = String.fromCharCode(view.getUint8(entryOffset + 8));
          else if (tag === 3) gps.lngRef = String.fromCharCode(view.getUint8(entryOffset + 8));
          else if (tag === 2 || tag === 4) {
            const valueOffset = tiffOffset + view.getUint32(entryOffset + 8, little);
            const vals = [];
            for (let j = 0; j < 3; j++) {
              const num = view.getUint32(valueOffset + j * 8, little);
              const den = view.getUint32(valueOffset + j * 8 + 4, little);
              vals.push(den ? num / den : 0);
            }
            if (tag === 2) gps.lat = vals; else gps.lng = vals;
          }
        }
        if (!gps.lat || !gps.lng) return null;
        const aDecimal = (dms) => dms[0] + dms[1] / 60 + dms[2] / 3600;
        let lat = aDecimal(gps.lat);
        let lng = aDecimal(gps.lng);
        if (gps.latRef === "S") lat = -lat;
        if (gps.lngRef === "W") lng = -lng;
        return { lat, lng };
      } else if ((marker & 0xff00) !== 0xff00) {
        return null; // estructura inesperada, mejor no seguir leyendo
      } else {
        offset += 2 + view.getUint16(offset + 2);
      }
    }
    return null;
  } catch (err) {
    return null; // cualquier problema leyendo la foto: se sigue con GPS normal
  }
}

/* v0.2 — MODO DE LA APP: teléfono (terreno) o PC (gabinete).
   Una sola app: el modo solo decide qué se muestra y qué tan ancho se ve.
   «Automático» mira la pantalla (ancha + mouse = PC); se puede forzar desde ⚙.
   Para limitar una función a un modo, basta marcar su elemento con
   data-solo-pc o data-solo-telefono (el CSS lo oculta en el otro modo). */
const MODO_APP_KEY = "modoApp";
function modoPreferido() {
  let v = "auto";
  try { v = localStorage.getItem(MODO_APP_KEY) || "auto"; } catch (_) {}
  return v === "pc" || v === "telefono" ? v : "auto";
}
function modoApp() {
  const p = modoPreferido();
  if (p !== "auto") return p;
  try { return window.matchMedia("(min-width: 900px) and (pointer: fine)").matches ? "pc" : "telefono"; } catch (_) { return "telefono"; }
}
function esModoPC() { return modoApp() === "pc"; }
function aplicarModoApp() {
  const m = modoApp();
  document.body.dataset.modo = m;
  const ver = document.getElementById("appVersion");
  if (ver && typeof APP_VERSION !== "undefined") ver.textContent = "v" + APP_VERSION + (m === "pc" ? " · PC" : "");
  const et = document.getElementById("modoAppActual");
  if (et) et.textContent = "Ahora se ve en modo " + (m === "pc" ? "computador" : "teléfono") + ".";
  try { if (typeof renderPanelWeb === "function" && typeof state !== "undefined" && state.jornadas) renderPanelWeb(); } catch (_) {}
  return m;
}
try {
  const mq = window.matchMedia("(min-width: 900px) and (pointer: fine)");
  const alCambiar = () => { if (modoPreferido() === "auto") aplicarModoApp(); };
  if (mq.addEventListener) mq.addEventListener("change", alCambiar); else if (mq.addListener) mq.addListener(alCambiar);
} catch (_) {}
