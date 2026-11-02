"use strict";

/* =========================================================================
   v0.1b/c — SESIONES DE MEDICIÓN, CUENTA REGRESIVA COMÚN Y PLANO (GNSS estático)
   - Un levantamiento estático tiene sesiones; cada punto pertenece a una sesión.
   - La cuenta regresiva es COMÚN a la sesión y parte desde la ÚLTIMA base que se
     agrega (la ventana común de observación empieza cuando arranca la última).
   - Al terminar: alarma + vibración + notificación hasta que la detengas.
   - Plano simple: triángulo azul = midiendo, verde = sesión completada.
   Todo se guarda dentro del levantamiento (lev.sesiones, punto.sesionId).
   ========================================================================= */
const APP_VERSION = "0.5.6";
const SES_PREFS_KEY = "sesionPrefs";
const SES_COLOR = { midiendo: "#1F5FBF", completada: "#2E9E5B", sin: "#8A949A" };
let tmrAudioCtx = null;
let sesAlarmaIntervalo = null;
let tmrWakeLock = null;
let sesTickId = null;

function sesPrefs() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(SES_PREFS_KEY) || "{}"); } catch (_) {}
  return Object.assign({ minutos: 30, sonido: "alarma", vibrar: true, reiniciar: true }, p);
}
function sesGuardarPrefs(p) { try { localStorage.setItem(SES_PREFS_KEY, JSON.stringify(p)); } catch (_) {} }
function tmrFmt(ms) {
  const tot = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(tot / 3600), m = Math.floor((tot % 3600) / 60), sec = tot % 60;
  const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
  return h > 0 ? h + ":" + mm + ":" + ss : mm + ":" + ss;
}
function hhmm(ms) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

/* ---------- audio / pantalla encendida ---------- */
function tmrAsegurarAudio() {
  try {
    if (!tmrAudioCtx) tmrAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (tmrAudioCtx.state === "suspended") tmrAudioCtx.resume();
    return tmrAudioCtx;
  } catch (_) { return null; }
}
function tmrTono(ctx, freq, t0, dur, tipo, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = tipo; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function tmrReproducir(sonido) {
  const ctx = tmrAsegurarAudio();
  if (!ctx) return;
  const t = ctx.currentTime + 0.03;
  if (sonido === "campana") {
    tmrTono(ctx, 660, t, 1.3, "sine", 0.7);
    tmrTono(ctx, 1320, t, 0.8, "sine", 0.3);
    tmrTono(ctx, 660, t + 0.8, 1.3, "sine", 0.7);
  } else if (sonido === "suave") {
    tmrTono(ctx, 523, t, 0.7, "sine", 0.6);
    tmrTono(ctx, 659, t + 0.5, 0.9, "sine", 0.6);
  } else {
    for (let i = 0; i < 3; i++) tmrTono(ctx, 880, t + i * 0.28, 0.16, "square", 0.45);
  }
}
async function tmrPedirWakeLock() {
  try {
    if (!("wakeLock" in navigator) || tmrWakeLock) return;
    tmrWakeLock = await navigator.wakeLock.request("screen");
    tmrWakeLock.addEventListener("release", () => { tmrWakeLock = null; });
  } catch (_) {}
}
function tmrLiberarWakeLock() {
  try { if (tmrWakeLock) { tmrWakeLock.release(); tmrWakeLock = null; } } catch (_) {}
}

/* ---------- modelo de sesiones ---------- */
function sesEsEstatico(lev) { return !!lev && lev.instrumento === "gnss" && lev.tipo === "estatico"; }
function sesTodas() {
  const out = [];
  state.levantamientos.forEach((lev) => (lev.sesiones || []).forEach((s) => out.push({ lev, s })));
  return out;
}
function sesBuscar(id) { return sesTodas().find((x) => x.s.id === id) || null; }
function sesIdsDe(p) { return Array.isArray(p.sesionIds) ? p.sesionIds : (p.sesionId ? [p.sesionId] : []); }
function sesPuntos(lev, s) { return lev.puntos.filter((p) => sesIdsDe(p).includes(s.id)); }
function sesDetenido(p) { return !!(p.valores && p.valores.horaFin); }
function sesCodigo(p) { return (p.valores && p.valores.punto) || ("P" + p.numero); }
function sesSeleccion(lev) {
  const ids = (lev.sesionesSel || []).filter((id) => (lev.sesiones || []).some((x) => x.id === id));
  return ids.length ? ids : (lev.sesionActivaId ? [lev.sesionActivaId] : []);
}
function sesNombre(lev, p) {
  const nombres = sesIdsDe(p).map((id) => ((lev.sesiones || []).find((x) => x.id === id) || {}).nombre).filter(Boolean);
  return nombres.length ? nombres.join(", ") : "—";
}
function sesCrear(lev, nombre) {
  const pr = sesPrefs();
  lev.sesiones = lev.sesiones || [];
  const s = {
    id: uuid(), nombre: nombre || "Sesión " + (lev.sesiones.length + 1),
    duracionMin: pr.minutos, sonido: pr.sonido, vibrar: pr.vibrar, reiniciarAlAgregar: pr.reiniciar,
    finAuto: false,            // false = la hora fin de las bases la marcas tú (botón ⏹)
    estado: "pendiente", inicioMs: null, finMs: null, cierreMs: null, alarmaPendiente: false
  };
  lev.sesiones.push(s);
  lev.sesionActivaId = s.id;
  lev.sesionesSel = [s.id];
  return s;
}
// Garantiza que un levantamiento estático tenga al menos una sesión. Devuelve true si creó una.
function sesAsegurar(lev) {
  if (!sesEsEstatico(lev) || (lev.sesiones && lev.sesiones.length)) return false;
  sesCrear(lev);
  return true;
}
function sesLimpiarHorasFinAuto(lev, s) {
  sesPuntos(lev, s).forEach((p) => { if (p.horaFinAuto) { p.valores.horaFin = ""; p.horaFinAuto = false; } });
}
function sesRellenarHorasFin(lev, s) {
  const hf = hhmm(s.finMs);
  sesPuntos(lev, s).forEach((p) => { if (!p.fija && !sesDetenido(p)) { p.valores.horaFin = hf; p.horaFinAuto = true; } });
}
function sesIniciarConteo(lev, s) {
  const ahora = Date.now();
  s.estado = "midiendo";
  s.inicioMs = ahora;
  s.finMs = ahora + s.duracionMin * 60000;
  s.cierreMs = null;
  s.alarmaPendiente = false;
  sesLimpiarHorasFinAuto(lev, s);
  tmrAsegurarAudio(); tmrPedirWakeLock(); sesArrancarTick();
}

/* ---------- motor de cuenta regresiva ---------- */
function sesArrancarTick() {
  if (sesTickId) return;
  sesTickId = setInterval(sesTick, 1000);
  sesTick();
}
function sesTick() {
  const ahora = Date.now();
  let hayActivas = false;
  sesTodas().forEach(({ lev, s }) => {
    if (s.estado !== "midiendo") return;
    if (s.finMs <= ahora) sesCompletar(lev, s);
    else hayActivas = true;
  });
  document.querySelectorAll("[data-ses-id]").forEach((el) => {
    const x = sesBuscar(el.dataset.sesId);
    if (x && x.s.estado === "midiendo") el.textContent = tmrFmt(x.s.finMs - ahora);
  });
  document.querySelectorAll("[data-pt-ini]").forEach((el) => {
    const t = Date.parse(el.dataset.ptIni);
    if (!isNaN(t)) el.textContent = tmrFmt(Math.ceil((Date.now() - t) / 1000) * 1000);
  });
  sesActualizarPildora();
  if (!hayActivas && !sesAlarmaIntervalo && !document.querySelector("[data-pt-ini]")) {
    tmrLiberarWakeLock();
    clearInterval(sesTickId); sesTickId = null;
  }
}
async function sesCompletar(lev, s) {
  s.estado = "completada";
  s.alarmaPendiente = true;
  if (s.finAuto) { sesRellenarHorasFin(lev, s); s.cierreMs = s.finMs; }   // modo automático (bases no fijas)
  sesMostrarAlarma();
  if (s.vibrar && navigator.vibrate) { try { navigator.vibrate([600, 250, 600, 250, 600]); } catch (_) {} }
  sesNotificar(lev, s);
  sesRefrescarPanel();
  try { await dbPut("levantamientos", lev); marcarPendienteSync(lev.jornadaId); } catch (_) {}
}

/* Cierra la sesión en este instante (si seguía contando, queda completada). */
function sesCerrarAhora(s) {
  const ahora = Date.now();
  s.cierreMs = ahora;
  if (s.estado !== "completada") { s.estado = "completada"; s.finMs = ahora; }
  s.alarmaPendiente = false;
}
/* Una sesión se cierra sola cuando se detuvieron todas sus bases NO fijas
   (las 📌 fijas siguen midiendo para otras sesiones). */
function sesEvaluarCierres(lev) {
  (lev.sesiones || []).forEach((s) => {
    if (s.cierreMs) return;
    const libres = sesPuntos(lev, s).filter((p) => !p.fija);
    if (libres.length && libres.every(sesDetenido)) sesCerrarAhora(s);
  });
  sesMostrarAlarma();
}
async function sesDetenerPunto(lev, p) {
  if (sesDetenido(p)) return;
  p.valores.horaFin = hhmm(Date.now());
  p.horaFinAuto = false;
  sesEvaluarCierres(lev);
  await sesGuardarLev(lev);
  toast(sesCodigo(p) + ": medición detenida " + p.valores.horaFin);
  sesRefrescarPanel(); sesTick();
}
async function sesAlternarFija(lev, p) {
  p.fija = !p.fija;
  await sesGuardarLev(lev);
  sesRefrescarPanel();
}
async function sesCerrarSesionManual(lev, s) {
  const fijas = sesPuntos(lev, s).filter((p) => p.fija && !sesDetenido(p)).length;
  if (!confirm("¿Cerrar " + s.nombre + " ahora? Se registra la hora de término y se detienen sus bases" +
    (fijas ? " (las " + fijas + " base(s) 📌 fijas siguen midiendo)." : "."))) return;
  const hf = hhmm(Date.now());
  sesPuntos(lev, s).forEach((p) => { if (!p.fija && !sesDetenido(p)) { p.valores.horaFin = hf; p.horaFinAuto = false; } });
  sesCerrarAhora(s);
  sesEvaluarCierres(lev);
  await sesGuardarLev(lev);
  sesRefrescarPanel(); sesTick();
}
async function sesTerminarTodo(lev) {
  if (!confirm("¿Registrar la hora de término ahora en TODAS las bases que siguen midiendo y cerrar todas las sesiones abiertas?")) return;
  const hf = hhmm(Date.now());
  lev.puntos.forEach((p) => { if (!sesDetenido(p)) { p.valores.horaFin = hf; p.horaFinAuto = false; } });
  (lev.sesiones || []).forEach((s) => { if (!s.cierreMs) sesCerrarAhora(s); });
  sesMostrarAlarma();
  await sesGuardarLev(lev);
  toast("Todo terminado a las " + hf);
  sesRefrescarPanel(); sesTick();
}

function sesNotificar(lev, s) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
    const titulo = "⏰ " + s.nombre + " — tiempo cumplido";
    const opciones = { body: "Observación de " + s.duracionMin + " min terminada.", tag: "ses-" + s.id, requireInteraction: true };
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.showNotification) reg.showNotification(titulo, opciones);
        else new Notification(titulo, opciones);
      }).catch(() => {});
    } else new Notification(titulo, opciones);
  } catch (_) {}
}
function sesActualizarPildora() {
  let pill = document.getElementById("tmrPill");
  const activas = sesTodas().filter((x) => x.s.estado === "midiendo").sort((a, b) => a.s.finMs - b.s.finMs);
  if (!activas.length) { if (pill) pill.remove(); return; }
  if (!pill) {
    pill = document.createElement("button");
    pill.id = "tmrPill"; pill.type = "button";
    pill.style.cssText = "position:fixed; left:12px; bottom:76px; z-index:55; background:#1D5C63; color:#fff; border:none; border-radius:999px; padding:8px 14px; font-weight:700; font-family:var(--mono); box-shadow:0 2px 8px rgba(0,0,0,.3);";
    pill.addEventListener("click", () => irATab("levantamiento"));
    document.body.appendChild(pill);
  }
  const x = activas[0];
  pill.textContent = "⏱ " + x.s.nombre + " " + tmrFmt(x.s.finMs - Date.now()) + (activas.length > 1 ? "  +" + (activas.length - 1) : "");
}
function sesMostrarAlarma() {
  const pendientes = sesTodas().filter((x) => x.s.alarmaPendiente);
  let ov = document.getElementById("tmrAlarmaOverlay");
  if (!pendientes.length) {
    if (ov) ov.remove();
    clearInterval(sesAlarmaIntervalo); sesAlarmaIntervalo = null;
    if (navigator.vibrate) { try { navigator.vibrate(0); } catch (_) {} }
    return;
  }
  const { lev, s } = pendientes[0];
  const bases = sesPuntos(lev, s).map((p) => p.valores.punto).filter(Boolean).join(", ");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "tmrAlarmaOverlay";
    ov.className = "modal-overlay";
    ov.style.cssText = "z-index:90; align-items:center;";
    document.body.appendChild(ov);
  }
  ov.innerHTML = `
    <div class="modal-sheet" style="border-radius:16px; margin:16px; text-align:center;">
      <div style="font-size:48px;">⏰</div>
      <h3 style="margin:6px 0;">¡Tiempo cumplido!</h3>
      <p style="font-size:18px; font-weight:700;">${escapeHtml(s.nombre)}</p>
      <p class="muted">${bases ? "Bases: " + escapeHtml(bases) + " · " : ""}${s.duracionMin} min de observación${pendientes.length > 1 ? " · " + (pendientes.length - 1) + " aviso(s) más" : ""}</p>
      <div class="modal-actions" style="flex-direction:column;">
        <button class="btn btn-accent" type="button" id="tmrDetener">Detener alarma</button>
        <button class="btn btn-outline" type="button" id="tmrMas10">+10 min más</button>
      </div>
    </div>`;
  ov.querySelector("#tmrDetener").addEventListener("click", async () => {
    s.alarmaPendiente = false;
    try { await dbPut("levantamientos", lev); } catch (_) {}
    sesMostrarAlarma(); sesRefrescarPanel();
  });
  ov.querySelector("#tmrMas10").addEventListener("click", async () => {
    s.estado = "midiendo"; s.alarmaPendiente = false; s.cierreMs = null; s.finMs = Date.now() + 10 * 60000;
    sesLimpiarHorasFinAuto(lev, s);
    try { await dbPut("levantamientos", lev); } catch (_) {}
    tmrPedirWakeLock(); sesArrancarTick(); sesMostrarAlarma(); sesRefrescarPanel();
  });
  if (!sesAlarmaIntervalo) {
    tmrReproducir(s.sonido);
    sesAlarmaIntervalo = setInterval(() => {
      const x = sesTodas().find((y) => y.s.alarmaPendiente);
      if (!x) return;
      tmrReproducir(x.s.sonido);
      if (x.s.vibrar && navigator.vibrate) { try { navigator.vibrate([500, 200, 500]); } catch (_) {} }
    }, 2200);
  }
}

/* ---------- plano simple (SVG, fondo blanco) ---------- */
function svgPlanoEstatico(lev) {
  const pts = lev.puntos.map((p, i) => ({ p, i })).filter((x) => x.p.lat != null && x.p.lng != null);
  const sinUbic = lev.puntos.length - pts.length;
  if (!pts.length) {
    return `<p class="muted">Aún no hay puntos con ubicación para dibujar${sinUbic ? " (" + sinUbic + " sin ubicación)" : ""}.</p>`;
  }
  const W = 340, H = 260, PAD = 34;
  const lat0 = pts.reduce((a, x) => a + x.p.lat, 0) / pts.length;
  const kx = Math.cos(lat0 * Math.PI / 180);
  const xs = pts.map((x) => x.p.lng * kx), ys = pts.map((x) => x.p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const dx = maxX - minX, dy = maxY - minY;
  const eps = 1e-9;
  let esc = Math.min(dx > eps ? (W - 2 * PAD) / dx : Infinity, dy > eps ? (H - 2 * PAD) / dy : Infinity);
  if (!isFinite(esc)) esc = null;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const X = (x) => esc ? W / 2 + (x - cx) * esc : W / 2;
  const Y = (y) => esc ? H / 2 - (y - cy) * esc : H / 2;
  // Azul: alguna de sus sesiones está contando. Verde: sus sesiones ya cumplieron el tiempo. Gris: sin sesión.
  const colorDe = (p) => {
    const ses = sesIdsDe(p).map((id) => (lev.sesiones || []).find((x) => x.id === id)).filter(Boolean);
    if (ses.some((x) => x.estado === "midiendo" || x.estado === "pendiente")) return SES_COLOR.midiendo;
    if (ses.some((x) => x.estado === "completada")) return SES_COLOR.completada;
    return SES_COLOR.sin;
  };

  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%; background:#fff; border:1px solid var(--line); border-radius:8px;" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="${W}" height="${H}" fill="#fff"/>`;
  svg += `<g stroke="#444" stroke-width="1.4" fill="none"><path d="M${W - 22} 40 L${W - 22} 16 M${W - 22} 16 l-4 8 M${W - 22} 16 l4 8"/></g><text x="${W - 22}" y="13" font-size="11" font-weight="700" text-anchor="middle" fill="#444">N</text>`;
  if (esc) {
    const objetivo = 70 * (111320 / esc);
    const pot = Math.pow(10, Math.floor(Math.log10(objetivo)));
    const n = objetivo / pot;
    const bonito = (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * pot;
    const px = bonito / (111320 / esc);
    svg += `<g stroke="#444" stroke-width="1.5"><line x1="12" y1="${H - 14}" x2="${12 + px}" y2="${H - 14}"/><line x1="12" y1="${H - 18}" x2="12" y2="${H - 10}"/><line x1="${12 + px}" y1="${H - 18}" x2="${12 + px}" y2="${H - 10}"/></g>`;
    svg += `<text x="${12 + px / 2}" y="${H - 20}" font-size="9" text-anchor="middle" fill="#444">${bonito >= 1000 ? (bonito / 1000) + " km" : bonito + " m"}</text>`;
  }
  // Una cadena por sesión (una base fija puede estar en varias): bases en orden de numeración
  (lev.sesiones || []).forEach((ses) => {
    const g = pts.filter((x) => sesIdsDe(x.p).includes(ses.id));
    if (g.length < 2) return;
    const col = ses.estado === "completada" ? SES_COLOR.completada : SES_COLOR.midiendo;
    svg += `<polyline points="${g.map((x) => X(x.p.lng * kx) + "," + Y(x.p.lat)).join(" ")}" fill="none" stroke="${col}" stroke-width="2" stroke-opacity="0.85"/>`;
    const a = g[g.length - 2], b = g[g.length - 1];
    const mx = (X(a.p.lng * kx) + X(b.p.lng * kx)) / 2, my = (Y(a.p.lat) + Y(b.p.lat)) / 2;
    svg += `<text x="${mx}" y="${my - 5}" font-size="9" text-anchor="middle" fill="${col}" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="3">${escapeHtml(ses.nombre)}</text>`;
  });
  const r = 9;
  pts.forEach((x) => {
    const px = X(x.p.lng * kx), py = Y(x.p.lat);
    svg += `<polygon points="${px},${py - r * 1.1} ${px - r},${py + r * 0.8} ${px + r},${py + r * 0.8}" fill="${colorDe(x.p)}" stroke="#1a2a30" stroke-width="${x.p.fija ? 2.2 : 1}"/>`;
    svg += `<text x="${px}" y="${py + r + 12}" font-size="10" text-anchor="middle" fill="#1a2a30" paint-order="stroke" stroke="#fff" stroke-width="3">${escapeHtml(String(sesCodigo(x.p)).slice(0, 14))}${x.p.fija ? " 📌" : ""}</text>`;
  });
  svg += `</svg>`;
  return svg + `
    <div class="muted" style="font-size:12px; margin-top:6px; display:flex; flex-wrap:wrap; gap:10px;">
      <span><span style="color:${SES_COLOR.midiendo};">▲</span> midiendo</span>
      <span><span style="color:${SES_COLOR.completada};">▲</span> sesión completada</span>
      <span><span style="color:${SES_COLOR.sin};">▲</span> sin sesión</span>
      <span>📌 base fija</span>
    </div>
    <p class="preview-note">ℹ️ Posición aproximada (GPS / foto del equipo), no precisión topográfica.${sinUbic ? " " + sinUbic + " punto(s) sin ubicación no se dibujan." : ""}</p>`;
}

/* ---------- panel de sesiones (tarjeta) ---------- */
function sesHtmlBases(lev) {
  const activos = lev.puntos.filter((p) => !sesDetenido(p));
  if (!activos.length) return `<p class="muted">No hay bases midiendo en este momento.</p>`;
  return activos.map((p) => `
    <div style="display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--line);">
      <div style="flex:1; min-width:0;">
        <div style="font-weight:700;">${escapeHtml(sesCodigo(p))}${p.fija ? " 📌" : ""}</div>
        <div class="muted" style="font-size:12px;">desde ${escapeHtml(p.valores.horaInicio || hhmm(Date.parse(p.timestamp)))} · <span data-pt-ini="${escapeHtml(p.timestamp)}">${tmrFmt(Date.now() - Date.parse(p.timestamp))}</span> · ${escapeHtml(sesNombre(lev, p))}</div>
      </div>
      <button class="btn btn-outline btn-sm" type="button" data-pt-fija="${p.id}">${p.fija ? "📌 fija" : "fija"}</button>
      <button class="btn btn-accent btn-sm" type="button" data-pt-detener="${p.id}">⏹ Detener</button>
    </div>`).join("");
}
function sesHtmlPanel(lev) {
  const sesiones = lev.sesiones || [];
  const filas = sesiones.map((s) => {
    const pts = sesPuntos(lev, s);
    const badge = s.cierreMs ? `<span class="badge closed">cerrada</span>`
      : s.estado === "midiendo" ? `<span class="badge open">midiendo</span>`
      : s.estado === "completada" ? `<span class="badge open">tiempo cumplido · falta cerrar</span>`
      : `<span class="badge">sin iniciar</span>`;
    const ventana = !s.inicioMs ? ""
      : s.cierreMs ? ` · ventana común ${hhmm(s.inicioMs)} – ${hhmm(s.cierreMs)}`
      : s.estado === "midiendo" ? ` · ventana común desde ${hhmm(s.inicioMs)} (fin previsto ${hhmm(s.finMs)})`
      : ` · ventana común desde ${hhmm(s.inicioMs)} (cuenta cumplida ${hhmm(s.finMs)})`;
    const miembros = pts.map((p) => escapeHtml(sesCodigo(p)) + (p.fija ? " 📌" : "") + " " + escapeHtml(p.valores.horaInicio || "…") + "→" + (sesDetenido(p) ? escapeHtml(p.valores.horaFin) : "…")).join(" · ");
    return `
      <div style="border:1px solid var(--line); border-radius:10px; padding:10px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <strong>${escapeHtml(s.nombre)}</strong>
          ${badge}
        </div>
        <div class="muted" style="font-size:12px; margin-top:2px;">${pts.length} base${pts.length === 1 ? "" : "s"} · cuenta de ${s.duracionMin} min${ventana}</div>
        ${miembros ? `<div class="muted" style="font-size:12px; margin-top:2px;">${miembros}</div>` : ""}
        ${s.estado === "midiendo" ? `<div data-ses-id="${s.id}" style="font-family:var(--mono); font-size:28px; font-weight:700; color:${SES_COLOR.midiendo}; margin:6px 0;">${tmrFmt(s.finMs - Date.now())}</div>` : ""}
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
          <button class="btn btn-outline btn-sm" type="button" data-ses-reiniciar="${s.id}">${s.estado === "pendiente" ? "▶ Iniciar cuenta" : "↻ Reiniciar cuenta"}</button>
          ${s.cierreMs ? "" : `<button class="btn btn-outline btn-sm" type="button" data-ses-cerrar="${s.id}">🔒 Cerrar sesión</button>`}
          <button class="btn btn-outline btn-sm" type="button" data-ses-editar="${s.id}">✏️</button>
          <button class="btn btn-outline btn-sm" type="button" data-ses-eliminar="${s.id}">✕</button>
        </div>
      </div>`;
  }).join("");
  const abiertas = lev.puntos.some((p) => !sesDetenido(p)) || sesiones.some((x) => !x.cierreMs);
  return `
    <div class="card">
      <h2>📡 Bases midiendo</h2>
      ${sesHtmlBases(lev)}
      <p class="preview-note">📌 <strong>fija</strong> = la base sigue midiendo cuando se cierra una sesión (puede pertenecer a varias sesiones).</p>
      ${abiertas ? `<button class="btn btn-outline danger btn-sm" type="button" id="btnTerminarTodo" style="margin-top:6px;">⏹ Terminar todo ahora</button>` : ""}
    </div>
    <div class="card">
      <h2>🛰️ Sesiones de medición</h2>
      <p class="muted" style="margin-bottom:8px;">La cuenta es común a la sesión y parte desde la <strong>última base</strong> que agregues. Una sesión se cierra con el botón, o sola cuando se detienen todas sus bases no fijas.</p>
      ${filas}
      <button class="btn btn-outline btn-sm" type="button" id="btnNuevaSesion">+ Nueva sesión</button>
    </div>
    <div class="card">
      <h2>Plano de puntos</h2>
      ${svgPlanoEstatico(lev)}
    </div>`;
}
function sesSelectHtml(lev) {
  const sel = sesSeleccion(lev);
  return `<label>Sesión(es) de esta base</label>
    <div id="sesChecks">${sesChecksInner(lev, sel)}</div>
    <label style="display:flex; align-items:center; gap:8px; margin-top:8px; font-weight:400;">
      <input type="checkbox" name="fija" style="width:auto;"> 📌 Base fija: sigue midiendo cuando termine la sesión
    </label>`;
}
function sesChecksInner(lev, sel) {
  return (lev.sesiones || []).map((x) => `<label style="display:flex; align-items:center; gap:8px; margin:4px 0; font-weight:400;"><input type="checkbox" name="sesionIds" value="${x.id}" ${sel.includes(x.id) ? "checked" : ""} style="width:auto;"> ${escapeHtml(x.nombre)}</label>`).join("");
}
function sesActualizarSelect(lev) {
  const cont = document.getElementById("sesChecks");
  if (cont) cont.innerHTML = sesChecksInner(lev, sesSeleccion(lev));
}
function sesRefrescarPanel() {
  const panel = document.getElementById("panelSesiones");
  if (!panel) return;
  const lev = levantamientoActivo();
  if (!sesEsEstatico(lev)) return;
  panel.innerHTML = sesHtmlPanel(lev);
  sesWirePanel(lev);
  sesActualizarSelect(lev);
}
async function sesGuardarLev(lev) {
  await dbPut("levantamientos", lev);
  marcarPendienteSync(lev.jornadaId);
}
function sesWirePanel(lev) {
  const panel = document.getElementById("panelSesiones");
  if (!panel) return;
  const sesPorId = (id) => (lev.sesiones || []).find((x) => x.id === id);
  const ptPorId = (id) => lev.puntos.find((x) => x.id === id);
  panel.querySelector("#btnNuevaSesion").addEventListener("click", () => abrirEditorSesion(lev.id, null));
  const tt = panel.querySelector("#btnTerminarTodo");
  if (tt) tt.addEventListener("click", () => sesTerminarTodo(lev));
  panel.querySelectorAll("[data-pt-detener]").forEach((b) => b.addEventListener("click", () => { const q = ptPorId(b.dataset.ptDetener); if (q) sesDetenerPunto(lev, q); }));
  panel.querySelectorAll("[data-pt-fija]").forEach((b) => b.addEventListener("click", () => { const q = ptPorId(b.dataset.ptFija); if (q) sesAlternarFija(lev, q); }));
  panel.querySelectorAll("[data-ses-reiniciar]").forEach((b) => b.addEventListener("click", async () => {
    const x = sesPorId(b.dataset.sesReiniciar); if (!x) return;
    sesIniciarConteo(lev, x); await sesGuardarLev(lev);
    toast(x.nombre + ": cuenta de " + x.duracionMin + " min iniciada"); sesRefrescarPanel();
  }));
  panel.querySelectorAll("[data-ses-cerrar]").forEach((b) => b.addEventListener("click", () => { const x = sesPorId(b.dataset.sesCerrar); if (x) sesCerrarSesionManual(lev, x); }));
  panel.querySelectorAll("[data-ses-editar]").forEach((b) => b.addEventListener("click", () => abrirEditorSesion(lev.id, b.dataset.sesEditar)));
  panel.querySelectorAll("[data-ses-eliminar]").forEach((b) => b.addEventListener("click", async () => {
    const x = sesPorId(b.dataset.sesEliminar); if (!x) return;
    const n = sesPuntos(lev, x).length;
    if (!confirm("¿Eliminar " + x.nombre + "?" + (n ? " Sus " + n + " base(s) se quedan sin esta sesión (no se borran)." : ""))) return;
    lev.puntos.forEach((q) => { if (sesIdsDe(q).includes(x.id)) { q.sesionIds = sesIdsDe(q).filter((id) => id !== x.id); q.sesionId = q.sesionIds[0] || null; } });
    lev.sesiones = lev.sesiones.filter((y) => y.id !== x.id);
    lev.sesionesSel = (lev.sesionesSel || []).filter((id) => id !== x.id);
    if (lev.sesionActivaId === x.id) lev.sesionActivaId = lev.sesiones.length ? lev.sesiones[lev.sesiones.length - 1].id : null;
    await sesGuardarLev(lev); sesRefrescarPanel(); sesTick();
  }));
}
function sesWireSelect(lev) {
  const cont = document.getElementById("sesChecks");
  if (!cont) return;
  cont.addEventListener("change", async () => {
    lev.sesionesSel = Array.from(cont.querySelectorAll("input:checked")).map((i) => i.value);
    await sesGuardarLev(lev);
  });
}

function abrirEditorSesion(levId, sesId) {
  const lev = state.levantamientos.find((l) => l.id === levId);
  if (!lev) return;
  const s = sesId ? (lev.sesiones || []).find((x) => x.id === sesId) : null;
  const pr = sesPrefs();
  const v = s || { nombre: "Sesión " + ((lev.sesiones || []).length + 1), duracionMin: pr.minutos, sonido: pr.sonido, vibrar: pr.vibrar, reiniciarAlAgregar: pr.reiniciar, finAuto: false };
  const miembrosActuales = s ? sesPuntos(lev, s).map((p) => p.id) : [];
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-sheet">
      <button class="close-x" id="sesEdClose" type="button">&times;</button>
      <h3>${s ? "Editar sesión" : "Nueva sesión de medición"}</h3>
      <div class="divider"></div>
      <form id="formSesion">
        <label>Nombre</label>
        <input type="text" name="nombre" value="${escapeHtml(v.nombre)}">
        <label>Duración de la observación (minutos)</label>
        <input type="number" name="minutos" min="0.1" step="any" value="${v.duracionMin}">
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
          ${[15, 30, 45, 60, 90, 120].map((m) => `<button class="btn btn-outline btn-sm" type="button" data-chip="${m}">${m >= 60 && m % 60 === 0 ? (m / 60) + " h" : m + " min"}</button>`).join("")}
        </div>
        ${lev.puntos.length ? `
        <label>Bases que integran esta sesión</label>
        <p class="muted" style="font-size:12px; margin:0 0 4px;">Incluye aquí las bases 📌 fijas que siguen midiendo. Las bases nuevas que agregues después se suman solas.</p>
        <div style="max-height:150px; overflow-y:auto; border:1px solid var(--line); border-radius:8px; padding:6px 10px;">
          ${lev.puntos.map((p) => {
            const marcado = s ? miembrosActuales.includes(p.id) : (!sesDetenido(p) && !!p.fija);
            return `<label style="display:flex; align-items:center; gap:8px; margin:4px 0; font-weight:400;"><input type="checkbox" name="miembro" value="${p.id}" ${marcado ? "checked" : ""} style="width:auto;"> ${escapeHtml(sesCodigo(p))}${p.fija ? " 📌" : ""} <span class="muted" style="font-size:12px;">${sesDetenido(p) ? "detenida " + escapeHtml(p.valores.horaFin) : "midiendo"}</span></label>`;
          }).join("")}
        </div>` : ""}
        <label>Sonido de aviso</label>
        <select name="sonido">
          <option value="alarma" ${v.sonido === "alarma" ? "selected" : ""}>Alarma (3 pitidos fuertes)</option>
          <option value="campana" ${v.sonido === "campana" ? "selected" : ""}>Campana</option>
          <option value="suave" ${v.sonido === "suave" ? "selected" : ""}>Suave</option>
        </select>
        <label style="display:flex; align-items:center; gap:8px; margin-top:10px; font-weight:400;"><input type="checkbox" name="vibrar" ${v.vibrar ? "checked" : ""} style="width:auto;"> Vibrar al terminar</label>
        <label style="display:flex; align-items:center; gap:8px; margin-top:10px; font-weight:400;"><input type="checkbox" name="reiniciar" ${v.reiniciarAlAgregar ? "checked" : ""} style="width:auto;"> Reiniciar la cuenta al agregar cada base (cuenta común desde la última)</label>
        <label style="display:flex; align-items:center; gap:8px; margin-top:10px; font-weight:400;"><input type="checkbox" name="finAuto" ${v.finAuto ? "checked" : ""} style="width:auto;"> Registrar la hora fin automáticamente al cumplirse la cuenta (bases no fijas). Si no, tú marcas ⏹ en cada base.</label>
        <div class="row" style="gap:8px; margin-top:10px;">
          <button class="btn btn-outline" type="button" id="sesProbar" style="flex:1;">🔊 Probar sonido</button>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" type="button" id="sesCancelar" style="flex:1;">Cancelar</button>
          <button class="btn btn-accent" type="submit" style="flex:1;">Guardar</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  const cerrar = () => overlay.remove();
  overlay.querySelector("#sesEdClose").addEventListener("click", cerrar);
  overlay.querySelector("#sesCancelar").addEventListener("click", cerrar);
  const f = overlay.querySelector("#formSesion");
  overlay.querySelectorAll("[data-chip]").forEach((b) => b.addEventListener("click", () => { f.elements.minutos.value = b.dataset.chip; }));
  overlay.querySelector("#sesProbar").addEventListener("click", () => tmrReproducir(f.elements.sonido.value));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const minutos = parseFloat(f.elements.minutos.value);
    if (!(minutos > 0)) return toast("Ingresa los minutos de observación.");
    const nombre = f.elements.nombre.value.trim() || v.nombre;
    const datos = { duracionMin: minutos, sonido: f.elements.sonido.value, vibrar: f.elements.vibrar.checked, reiniciarAlAgregar: f.elements.reiniciar.checked, finAuto: f.elements.finAuto.checked };
    sesGuardarPrefs({ minutos, sonido: datos.sonido, vibrar: datos.vibrar, reiniciar: datos.reiniciarAlAgregar });
    const ses = s || sesCrear(lev, nombre);
    Object.assign(ses, datos, { nombre });
    if (s && s.estado === "midiendo") s.finMs = s.inicioMs + minutos * 60000;
    const marcados = Array.from(overlay.querySelectorAll('input[name="miembro"]:checked')).map((i) => i.value);
    lev.puntos.forEach((p) => {
      const ids = sesIdsDe(p).filter((id) => id !== ses.id);
      if (marcados.includes(p.id)) ids.push(ses.id);
      p.sesionIds = ids; p.sesionId = ids[0] || null;
    });
    await sesGuardarLev(lev);
    cerrar();
    sesRefrescarPanel(); sesActualizarSelect(lev); sesTick();
    toast(s ? "Sesión actualizada" : "Sesión creada");
  });
}
window.abrirEditorSesion = abrirEditorSesion;

function sesInit() {
  try { localStorage.removeItem("temporizadoresEstatico"); } catch (_) {} // formato de v0.1 (reemplazado)
  const ver = document.getElementById("appVersion");
  if (ver) ver.textContent = "v" + APP_VERSION + (esModoPC() ? " · PC" : "");
  document.title = "Terreno Topografía v" + APP_VERSION;
  const todas = sesTodas();
  if (todas.some((x) => x.s.estado === "midiendo")) { tmrPedirWakeLock(); sesArrancarTick(); }
  if (todas.some((x) => x.s.alarmaPendiente)) sesMostrarAlarma();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { tmrPedirWakeLock(); sesTick(); }
  });
}
