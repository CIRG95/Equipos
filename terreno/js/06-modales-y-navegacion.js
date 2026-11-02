"use strict";

/* =========================================================================
   MODAL: CONFIGURACIÓN
   ========================================================================= */
const configModalEl = document.getElementById("configModal");
document.getElementById("configModalClose").addEventListener("click", () => configModalEl.classList.add("hidden"));
document.getElementById("selModoApp").addEventListener("change", (e) => {
  try { localStorage.setItem(MODO_APP_KEY, e.target.value); } catch (_) {}
  aplicarModoApp();
  renderTabActual();
});
document.getElementById("btnConfig").addEventListener("click", () => {
  document.getElementById("txtCatastroTipos").value = catastroTiposTexto();
  document.getElementById("selModoApp").value = modoPreferido();
  aplicarModoApp();
  document.getElementById("inpToleranciaVerde").value = state.config.toleranciaTramoVerdeMm;
  document.getElementById("inpToleranciaAmarilla").value = state.config.toleranciaTramoAmarillaMm;
  document.getElementById("inpNombreEmpresa").value = state.config.marca.nombreEmpresa || "";
  logoEmpresaTemp = state.config.marca.logoEmpresa || null;
  pintarPreviewLogoEmpresa();
  const f = state.config.fuenteMonografia;
  document.getElementById("selTipoFuente").value = f.tipo;
  fuenteRegularTemp = f.personalizadaRegular || null;
  fuenteBoldTemp = f.personalizadaBold || null;
  document.getElementById("fuenteRegularNombre").textContent = f.personalizadaNombreRegular || "Sin archivo";
  document.getElementById("fuenteBoldNombre").textContent = f.personalizadaNombreBold || "Sin archivo";
  actualizarVisibilidadFuente();
  configModalEl.classList.remove("hidden");
});

let logoEmpresaTemp = null;
function pintarPreviewLogoEmpresa() {
  const wrap = document.getElementById("logoEmpresaPreview");
  wrap.innerHTML = logoEmpresaTemp ? `<img src="${logoEmpresaTemp}" style="width:100%; height:100%; object-fit:contain;">` : "Sin logo";
}
document.getElementById("inpLogoEmpresa").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { logoEmpresaTemp = reader.result; pintarPreviewLogoEmpresa(); };
  reader.readAsDataURL(file);
});

function actualizarVisibilidadFuente() {
  document.getElementById("wrapFuentePersonalizada").style.display = document.getElementById("selTipoFuente").value === "personalizada" ? "" : "none";
}
document.getElementById("selTipoFuente").addEventListener("change", actualizarVisibilidadFuente);

// Guarda el .ttf como base64 "pelado" (sin el prefijo data:...;base64,) porque
// es el formato que addFileToVFS de jsPDF espera para registrar una fuente.
let fuenteRegularTemp = null, fuenteBoldTemp = null;
function leerTtfComoBase64(input, nombreSpanId, onListo) {
  input.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!/\.ttf$/i.test(file.name)) { toast("Solo se admiten archivos .ttf"); input.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",").pop();
      onListo(base64, file.name);
      document.getElementById(nombreSpanId).textContent = file.name;
    };
    reader.readAsDataURL(file);
  });
}
leerTtfComoBase64(document.getElementById("inpFuenteRegular"), "fuenteRegularNombre", (b64) => { fuenteRegularTemp = b64; });
leerTtfComoBase64(document.getElementById("inpFuenteBold"), "fuenteBoldNombre", (b64) => { fuenteBoldTemp = b64; });

document.getElementById("btnGuardarConfig").addEventListener("click", () => {
  state.config.toleranciaTramoVerdeMm = parseFloat(document.getElementById("inpToleranciaVerde").value) || 2;
  state.config.toleranciaTramoAmarillaMm = parseFloat(document.getElementById("inpToleranciaAmarilla").value) || 10;
  state.config.marca = {
    nombreEmpresa: document.getElementById("inpNombreEmpresa").value.trim(),
    logoEmpresa: logoEmpresaTemp
  };
  const tipoFuente = document.getElementById("selTipoFuente").value;
  if (tipoFuente === "personalizada" && !fuenteRegularTemp) {
    toast("Sube al menos la fuente regular, o elige otro tipo de letra.");
    return;
  }
  state.config.fuenteMonografia = {
    tipo: tipoFuente,
    personalizadaRegular: fuenteRegularTemp,
    personalizadaBold: fuenteBoldTemp,
    personalizadaNombreRegular: document.getElementById("fuenteRegularNombre").textContent === "Sin archivo" ? "" : document.getElementById("fuenteRegularNombre").textContent,
    personalizadaNombreBold: document.getElementById("fuenteBoldNombre").textContent === "Sin archivo" ? "" : document.getElementById("fuenteBoldNombre").textContent
  };
  try {
    const tt = document.getElementById("txtCatastroTipos").value.trim();
    if (tt && tt !== CATASTRO_TIPOS_DEFAULT) localStorage.setItem("catastroTiposTexto", tt);
    else localStorage.removeItem("catastroTiposTexto");
  } catch (_) {}
  try {
    guardarConfig();
  } catch (e) {
    toast("La fuente es muy pesada para guardarla. Prueba con un archivo .ttf más liviano.");
    return;
  }
  toast("Configuración guardada");
  configModalEl.classList.add("hidden");
});

/* =========================================================================
   MODAL: PLANTILLAS DE OBJETIVOS
   ========================================================================= */
const plantillasModalEl = document.getElementById("plantillasModal");
document.getElementById("plantillasModalClose").addEventListener("click", () => plantillasModalEl.classList.add("hidden"));
document.getElementById("btnPlantillas").addEventListener("click", () => {
  renderPlantillasModal();
  plantillasModalEl.classList.remove("hidden");
});

function renderPlantillasModal(editandoId) {
  const body = document.getElementById("plantillasModalBody");
  if (editandoId) { renderEditorPlantilla(body, editandoId); return; }

  body.innerHTML = `
    ${state.plantillas.map((p) => `
      <div class="card" style="padding:10px 12px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div>
            <div style="font-weight:600;">${escapeHtml(p.nombre)}</div>
            <div class="muted" style="font-size:12px;">${p.items.length} ítem${p.items.length === 1 ? "" : "s"}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-outline btn-sm" data-editar="${p.id}" type="button">Editar</button>
            <button class="btn btn-danger btn-sm" data-borrar="${p.id}" type="button">Borrar</button>
          </div>
        </div>
      </div>
    `).join("")}
    <button class="btn btn-accent" id="btnNuevaPlantilla" type="button">+ Nueva plantilla</button>
  `;

  body.querySelectorAll("[data-editar]").forEach((btn) => {
    btn.addEventListener("click", () => renderPlantillasModal(btn.dataset.editar));
  });
  body.querySelectorAll("[data-borrar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = state.plantillas.find((x) => x.id === btn.dataset.borrar);
      if (!confirm(`¿Borrar la plantilla "${p.nombre}"? Las jornadas que ya la usaron no se ven afectadas.`)) return;
      state.plantillas = state.plantillas.filter((x) => x.id !== btn.dataset.borrar);
      guardarPlantillas();
      renderPlantillasModal();
    });
  });
  document.getElementById("btnNuevaPlantilla").addEventListener("click", () => {
    const nueva = { id: uuid(), nombre: "Nueva plantilla", items: [] };
    state.plantillas.push(nueva);
    guardarPlantillas();
    renderPlantillasModal(nueva.id);
  });
}

function renderEditorPlantilla(body, id) {
  const p = state.plantillas.find((x) => x.id === id);
  if (!p) { renderPlantillasModal(); return; }

  body.innerHTML = `
    <label>Nombre de la plantilla</label>
    <input type="text" id="inpNombrePlantilla" value="${escapeHtml(p.nombre)}">
    <div class="divider"></div>
    <div id="itemsPlantillaWrap">
      ${p.items.map((it) => `
        <div class="row" style="align-items:center; gap:6px; margin-bottom:6px;">
          <input type="text" data-item-texto="${it.id}" value="${escapeHtml(it.texto)}" placeholder="Descripción del ítem" style="flex:2;">
          <select data-item-tipo="${it.id}" style="flex:1;">
            <option value="check" ${it.tipo === "check" ? "selected" : ""}>Casillero</option>
            <option value="numero" ${it.tipo === "numero" ? "selected" : ""}>Número</option>
            <option value="texto" ${it.tipo === "texto" ? "selected" : ""}>Texto</option>
          </select>
          <button class="btn btn-danger btn-sm" data-item-borrar="${it.id}" type="button" title="Borrar ítem">✕</button>
        </div>
      `).join("")}
    </div>
    <button class="btn btn-outline btn-sm" id="btnAgregarItem" type="button">+ Agregar ítem</button>
    <div class="divider"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" id="btnVolverPlantillas" type="button">Volver</button>
      <button class="btn btn-accent" id="btnGuardarPlantilla" type="button">Guardar</button>
    </div>
  `;

  document.getElementById("btnAgregarItem").addEventListener("click", () => {
    p.items.push({ id: uuid(), texto: "", tipo: "check" });
    renderEditorPlantilla(body, id);
  });
  body.querySelectorAll("[data-item-borrar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      p.items = p.items.filter((it) => it.id !== btn.dataset.itemBorrar);
      renderEditorPlantilla(body, id);
    });
  });
  document.getElementById("btnVolverPlantillas").addEventListener("click", () => renderPlantillasModal());
  document.getElementById("btnGuardarPlantilla").addEventListener("click", () => {
    p.nombre = document.getElementById("inpNombrePlantilla").value.trim() || "Sin nombre";
    p.items.forEach((it) => {
      it.texto = body.querySelector(`[data-item-texto="${it.id}"]`).value.trim();
      it.tipo = body.querySelector(`[data-item-tipo="${it.id}"]`).value;
    });
    p.items = p.items.filter((it) => it.texto); // descarta ítems vacíos sin descripción
    guardarPlantillas();
    toast("Plantilla guardada");
    renderPlantillasModal();
  });
}

/* =========================================================================
   NAVEGACIÓN DE TABS
   ========================================================================= */
function irATab(nombre) {
  state.tabActual = nombre;
  document.querySelectorAll(".tab-section").forEach((s) => s.classList.remove("active"));
  document.getElementById("tab-" + nombre).classList.add("active");
  document.querySelectorAll("nav.tabbar button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === nombre);
  });
  renderTabActual();
}
document.querySelectorAll("nav.tabbar button").forEach((b) => {
  b.addEventListener("click", () => irATab(b.dataset.tab));
});

function renderTabActual() {
  if (state.tabActual === "jornada") renderJornada();
  else if (state.tabActual === "levantamiento") renderLevantamiento();
  else if (state.tabActual === "historial") renderHistorial();
  else if (state.tabActual === "reportes") renderReportes();
  else if (state.tabActual === "monografias") renderMonografias();
  renderHeader();
  try { if (typeof renderPanelWeb === "function") renderPanelWeb(); } catch (e) { console.error(e); }
}

function renderHeader() {
  const pill = document.getElementById("headerPill");
  const sub = document.getElementById("headerSubtitle");
  const j = jornadaActiva();
  if (j) {
    pill.textContent = fmtDuracion(Date.now() - new Date(j.fechaInicio).getTime());
    pill.classList.add("pill-live");
    sub.textContent = "Jornada iniciada " + fmtHoraCorta(j.fechaInicio);
  } else {
    pill.textContent = "—";
    pill.classList.remove("pill-live");
    sub.textContent = "Sin jornada activa";
  }
  actualizarEstadoNube();
}

/* =========================================================================
   MODAL: SINCRONIZACIÓN EN LA NUBE
   ========================================================================= */
const nubeModalEl = document.getElementById("nubeModal");
document.getElementById("nubeModalClose").addEventListener("click", () => nubeModalEl.classList.add("hidden"));
document.getElementById("nubePill").addEventListener("click", () => {
  document.getElementById("inpGoogleClientId").value = state.drive.clientId || "";
  document.getElementById("inpNextcloudUrl").value = state.nextcloud.url || "";
  document.getElementById("inpNextcloudUsuario").value = state.nextcloud.usuario || "";
  document.getElementById("inpNextcloudPassword").value = state.nextcloud.appPassword || "";
  actualizarEstadoNube();
  nubeModalEl.classList.remove("hidden");
});

document.getElementById("btnConectarDrive").addEventListener("click", async () => {
  const cid = document.getElementById("inpGoogleClientId").value.trim();
  if (!cid) return toast("Ingresa el Client ID primero.");
  if (cid !== state.drive.clientId) state.drive.tokenClientObj = null;
  state.drive.clientId = cid;
  localStorage.setItem("googleClientId", cid);
  const token = await asegurarToken(true);
  if (token) {
    toast("Conectado a Google Drive");
    state.jornadas.forEach((j) => marcarPendienteSync(j.id));
  } else {
    toast("No se pudo conectar. Revisa el Client ID y los orígenes autorizados.");
  }
  actualizarEstadoNube();
});
document.getElementById("btnDesconectarDrive").addEventListener("click", () => {
  state.drive.conectado = false;
  state.drive.accessToken = null;
  state.drive.tokenExpiry = 0;
  localStorage.removeItem("driveConectado");
  actualizarEstadoNube();
  toast("Google Drive desconectado");
});

document.getElementById("btnConectarNextcloud").addEventListener("click", async () => {
  const url = document.getElementById("inpNextcloudUrl").value.trim();
  const usuario = document.getElementById("inpNextcloudUsuario").value.trim();
  const appPassword = document.getElementById("inpNextcloudPassword").value.trim();
  if (!url || !usuario || !appPassword) return toast("Completa URL, usuario y contraseña de aplicación.");
  toast("Probando conexión a Nextcloud…");
  const ok = await conectarNextcloud(url, usuario, appPassword);
  if (ok) {
    toast("Conectado a Nextcloud");
    state.jornadas.forEach((j) => marcarPendienteSync(j.id));
  } else {
    toast("No se pudo conectar. Revisa URL, usuario, contraseña y que el servidor permita CORS.");
  }
  actualizarEstadoNube();
});
document.getElementById("btnDesconectarNextcloud").addEventListener("click", () => {
  desconectarNextcloud();
  actualizarEstadoNube();
  toast("Nextcloud desconectado");
});

document.getElementById("btnSyncManualTodos").addEventListener("click", () => {
  state.jornadas.forEach((j) => {
    state.drive.pendientes.add(j.id);
    state.nextcloud.pendientes.add(j.id);
  });
  sincronizarPendientesDrive();
  sincronizarPendientesNextcloud();
});
setInterval(() => { if (jornadaActiva()) renderHeader(); if (state.tabActual === "jornada" && jornadaActiva()) actualizarRelojJornada(); }, 1000 * 15);

/* =========================================================================
   MODAL: SELECTOR DE MAPA (reutilizable para jornada y para puntos)
   ========================================================================= */
const mapModalEl = document.getElementById("mapModal");
document.getElementById("mapModalClose").addEventListener("click", cerrarMapModal);

function abrirMapModal(latInicial, lngInicial, onConfirm) {
  state.mapModalCallback = onConfirm;
  mapModalEl.classList.remove("hidden");
  const lat = latInicial != null ? latInicial : -33.45;
  const lng = lngInicial != null ? lngInicial : -70.66;
  setTimeout(() => {
    if (!state.leafletMap) {
      state.leafletMap = L.map("mapPicker").setView([lat, lng], latInicial != null ? 16 : 5);
      agregarCapasBase(state.leafletMap);
      state.leafletMap.on("click", (e) => colocarMarcador(e.latlng.lat, e.latlng.lng));
    } else {
      state.leafletMap.setView([lat, lng], latInicial != null ? 16 : 5);
      state.leafletMap.invalidateSize();
    }
    if (latInicial != null) colocarMarcador(lat, lng);
  }, 60);
}
function colocarMarcador(lat, lng) {
  state.puntoUbicacionTemp = { lat, lng };
  if (state.leafletMarker) {
    state.leafletMarker.setLatLng([lat, lng]);
  } else {
    state.leafletMarker = L.marker([lat, lng]).addTo(state.leafletMap);
  }
}
function cerrarMapModal() {
  mapModalEl.classList.add("hidden");
}
document.getElementById("btnUsarGpsModal").addEventListener("click", async () => {
  toast("Buscando GPS…");
  const pos = await getUbicacionActual();
  if (!pos) return toast("No se pudo obtener el GPS. Marca manualmente en el mapa.");
  state.leafletMap.setView([pos.lat, pos.lng], 17);
  colocarMarcador(pos.lat, pos.lng);
});
document.getElementById("btnConfirmarMapa").addEventListener("click", () => {
  if (!state.puntoUbicacionTemp) return toast("Toca el mapa para marcar un punto primero.");
  if (state.mapModalCallback) state.mapModalCallback(state.puntoUbicacionTemp);
  cerrarMapModal();
});

/* =========================================================================
   MODAL: VISOR DE FOTO
   ========================================================================= */
const photoModalEl = document.getElementById("photoModal");
document.getElementById("photoModalClose").addEventListener("click", () => photoModalEl.classList.add("hidden"));
function verFoto(dataUrl) {
  document.getElementById("photoModalImg").src = dataUrl;
  photoModalEl.classList.remove("hidden");
}
