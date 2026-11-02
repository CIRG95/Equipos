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

  const nextcloudCfg = JSON.parse(localStorage.getItem("nextcloudConfig") || "null");
  if (nextcloudCfg) {
    state.nextcloud.url = nextcloudCfg.url;
    state.nextcloud.usuario = nextcloudCfg.usuario;
    state.nextcloud.appPassword = nextcloudCfg.appPassword;
    probarConexionNextcloud().then((ok) => {
      state.nextcloud.conectado = ok;
      actualizarEstadoNube();
      if (ok) {
        state.jornadas.forEach((j) => state.nextcloud.pendientes.add(j.id));
        sincronizarPendientesNextcloud();
      }
    });
  }

  if (localStorage.getItem("driveConectado") === "1" && state.drive.clientId) {
    esperarGIS().then(() => asegurarToken(false)).then((t) => {
      if (t) {
        state.jornadas.forEach((j) => state.drive.pendientes.add(j.id));
        sincronizarPendientesDrive();
      }
      actualizarEstadoNube();
    });
  }

  actualizarEstadoNube();

  window.addEventListener("online", () => {
    sincronizarPendientesDrive();
    sincronizarPendientesNextcloud();
  });
  setInterval(() => {
    if (state.drive.conectado) sincronizarPendientesDrive();
    if (state.nextcloud.conectado) sincronizarPendientesNextcloud();
  }, 120000);
}

init();
