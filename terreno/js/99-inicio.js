"use strict";

/* =========================================================================
   INICIALIZACIÓN
   ========================================================================= */
async function init() {
  aplicarModoApp();
  try {
    db = await openDB();
  } catch (e) {
    document.getElementById("tab-jornada").innerHTML = `
      <div class="card"><h2>No se puede guardar datos aquí</h2>
      <p class="muted" style="margin-top:6px;">Este lugar donde abriste la app (por ejemplo la vista previa de Claude o de un visor de archivos) no permite guardar datos.</p>
      <div class="divider"></div>
      <p>Descarga el archivo y ábrelo desde <strong>Archivos / Descargas</strong> con <strong>Chrome o Brave</strong> (Abrir con → navegador).</p>
      <p class="muted" style="margin-top:8px;">Tus datos no se pierden: siguen en el navegador donde ya los usabas.</p></div>`;
    return;
  }
  cargarConfig();
  cargarPlantillas();
  state.jornadas = (await dbGetAll("jornadas")).filter(noEliminado);
  state.levantamientos = (await dbGetAll("levantamientos")).filter(noEliminado);
  state.monografias = (await dbGetAll("monografias")).filter(noEliminado);
  const jAbierta = state.jornadas.find((j) => j.estado === "abierta");
  if (jAbierta) state.jornadaActivaId = jAbierta.id;
  const lAbierto = state.levantamientos.find((l) => l.estado === "en_curso");
  if (lAbierto) state.levantamientoActivoId = lAbierto.id;

  sisIniciar();
  renderTabActual();
  sesInit();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  // Cargar configuración guardada de cada proveedor y reconectar en silencio
  state.drive.clientId = localStorage.getItem("googleClientId") || "";
  // v0.2.1: OneDrive se quitó; se borran sus restos guardados en este navegador
  ["onedriveClientId", "onedriveRefreshToken", "onedriveConectado"].forEach((k) => { try { localStorage.removeItem(k); } catch (e) {} });

  // v0.6.0: la cola de subida se retoma desde el teléfono. Solo la primera vez (sin cola guardada) se sube todo.
  const habiaCola = cargarColaSync();
  if (!habiaCola) { state.jornadas.forEach((j) => { state.drive.pendientes.add(j.id); state.nextcloud.pendientes.add(j.id); }); guardarColaSync(); }

  let nextcloudCfg = null;
  try { nextcloudCfg = JSON.parse(localStorage.getItem("nextcloudConfig") || "null"); } catch (_) {}
  if (nextcloudCfg) {
    state.nextcloud.url = nextcloudCfg.url;
    state.nextcloud.usuario = nextcloudCfg.usuario;
    state.nextcloud.appPassword = nextcloudCfg.appPassword;
  }

  actualizarEstadoNube();
  reconectarNubes("inicio");

  // Al volver la señal se reconecta y sube lo pendiente, también si la app se abrió sin conexión.
  window.addEventListener("online", () => {
    actualizarEstadoNube();
    const n = pendientesDeSubida();
    toast(n ? "Conexión recuperada: subiendo " + n + (n === 1 ? " jornada" : " jornadas") + "…" : "Conexión recuperada");
    reconectarNubes("online");
  });
  window.addEventListener("offline", () => { actualizarEstadoNube(); toast("Sin conexión: se sigue guardando en el teléfono"); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { actualizarEstadoNube(); reconectarNubes("visible"); } });
  setInterval(() => { reconectarNubes("reloj"); }, 120000);

  // Pide al navegador que no borre los datos de la app si falta espacio (importante con días de terreno sin subir).
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (_) {}
}

/* v0.6.0 — Reconexión de las nubes. Se llama al abrir, al volver la señal, al volver a la app y cada 2 minutos.
   No hace nada sin conexión. Nextcloud se reconecta solo (usuario y clave de aplicación guardados). Google entrega
   sesiones de una hora: si sigue vigente o Google la renueva en silencio, sube sola; si pide confirmación, queda
   «por subir» y basta tocar la pastilla de la nube. La nube del Sistema (paquete de conexión) sigue la misma regla. */
let reconectando = false;
async function reconectarNubes(motivo) {
  if (!hayConexion() || reconectando) return;
  reconectando = true;
  try {
    if (state.nextcloud.url && state.nextcloud.usuario) {
      if (!state.nextcloud.conectado) { try { state.nextcloud.conectado = await probarConexionNextcloud(); } catch (_) { state.nextcloud.conectado = false; } }
      if (state.nextcloud.conectado) sincronizarPendientesNextcloud();
    }
    if (localStorage.getItem("driveConectado") === "1" && state.drive.clientId) {
      const vigente = state.drive.accessToken && Date.now() < state.drive.tokenExpiry;
      // La renovación silenciosa se intenta al abrir y al volver la señal; no cada 2 minutos (Google podría abrir una ventana).
      if (vigente || motivo !== "reloj") {
        const gis = await Promise.race([esperarGIS().then(() => true), new Promise((r) => setTimeout(() => r(false), 8000))]);
        if (gis) { const t = await Promise.race([asegurarToken(false), new Promise((r) => setTimeout(() => r(null), 15000))]); if (t) sincronizarPendientesDrive(); }
      }
    }
    try {
      if (SIS.listo && motivo !== "reloj") { const e = TopolandConexion.estadoNube() || {}; if (e.conectado && e.carpetaId && !e.sincronizando && e.pendiente) TopolandConexion.sincronizar().catch(() => {}); }
    } catch (_) {}
  } finally {
    reconectando = false;
    actualizarEstadoNube();
  }
}

init();
