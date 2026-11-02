"use strict";


function renderEditorMonografia(el) {
  const m = state.monografias.find((x) => x.id === state.monografiaEnEdicionId);
  if (!m) { state.monografiaEnEdicionId = null; renderMonografias(); return; }

  el.innerHTML = `
    <div class="card">
      <button class="btn btn-outline btn-sm" id="btnVolverMonografias" type="button">← Volver al listado</button>
      <div class="divider"></div>
      <h2>Ficha de la monografía</h2>

      <label>Título del documento</label>
      <input type="text" id="mTituloDocumento" value="${escapeHtml(m.tituloDocumento || "")}" placeholder="Monografía de PRs y Monolitos">
      <label>Cliente</label>
      <input type="text" id="mClienteNombre" value="${escapeHtml(m.clienteNombre)}" placeholder="Nombre del mandante">
      <label>Logo del cliente</label>
      <div id="campoClienteLogo"></div>
      <label>Nombre del proyecto</label>
      <input type="text" id="mNombreProyecto" value="${escapeHtml(m.nombreProyecto)}" placeholder='Ej: MATERIALIZACIÓN DE MONOLITOS PROYECTO "..."'>

      <div class="divider"></div>
      <label>Punto medido</label>
      <input type="text" id="mPuntoMedido" value="${escapeHtml(m.puntoMedido)}" placeholder="Ej: BN U-1">
      <label>Ubicación (sector / lugar)</label>
      <input type="text" id="mUbicacion" value="${escapeHtml(m.ubicacion || "")}" placeholder="Ej: PV El Romero Solar">
      <div class="row">
        <div style="flex:1;"><label>Localidad</label><input type="text" id="mLocalidad" value="${escapeHtml(m.localidad)}"></div>
        <div style="flex:1;"><label>Comuna</label><input type="text" id="mComuna" value="${escapeHtml(m.comuna || "")}"></div>
      </div>
      <label>Región</label>
      <input type="text" id="mRegion" value="${escapeHtml(m.region != null && m.region !== "" ? m.region : (m.provincia || ""))}">

      <div class="divider"></div>
      <label><input type="checkbox" id="mModUtm" ${m.modulos.utm ? "checked" : ""}> Coordenadas UTM</label>
      <div id="mWrapUtm" style="display:${m.modulos.utm ? "" : "none"};">
        <div class="row">
          <div style="flex:1;"><label>Datum</label><input type="text" id="mDatumUTM" value="${escapeHtml(m.datumUTM)}" placeholder="WGS84"></div>
          <div style="flex:1;"><label>Zona</label><input type="text" id="mZonaUTM" value="${escapeHtml(m.zonaUTM)}" placeholder="Norte 14 (GGM-10)"></div>
        </div>
        <div class="row">
          <div style="flex:1;"><label>Norte (m)</label><input type="text" inputmode="decimal" id="mNorte" value="${escapeHtml(m.norte)}"></div>
          <div style="flex:1;"><label>Este (m)</label><input type="text" inputmode="decimal" id="mEste" value="${escapeHtml(m.este)}"></div>
          <div style="flex:1;"><label>Cota Ortométrica (m)</label><input type="text" inputmode="decimal" id="mCota" value="${escapeHtml(m.cotaOrtometrica)}"></div>
        </div>
      </div>

      <div class="divider"></div>
      <label><input type="checkbox" id="mModGeo" ${m.modulos.geodesicas ? "checked" : ""}> Coordenadas Geodésicas</label>
      <div id="mWrapGeo" style="display:${m.modulos.geodesicas ? "" : "none"};">
        <div class="row">
          <div style="flex:1;"><label>Datum geodésico</label><input type="text" id="mDatumGeo" value="${escapeHtml(m.datumGeodesico)}" placeholder="ITRF2008"></div>
          <div style="flex:1;"><label>Geoide</label><input type="text" id="mGeoide" value="${escapeHtml(m.geoide)}" placeholder="EGM08"></div>
        </div>
        <div class="row">
          <div style="flex:1;"><label>Latitud (°)</label><input type="text" inputmode="decimal" id="mLat" value="${escapeHtml(m.latitud)}"></div>
          <div style="flex:1;"><label>Longitud (°)</label><input type="text" inputmode="decimal" id="mLng" value="${escapeHtml(m.longitud)}"></div>
          <div style="flex:1;"><label>Altura Elipsoidal (m)</label><input type="text" inputmode="decimal" id="mAltElip" value="${escapeHtml(m.alturaElipsoidal)}"></div>
        </div>
      </div>

      <div class="divider"></div>
      <label><input type="checkbox" id="mModCroquis" ${m.modulos.croquis ? "checked" : ""}> Croquis de ubicación</label>
      <div id="mWrapCroquis" style="display:${m.modulos.croquis ? "" : "none"};">
        <div id="campoCroquis"></div>
      </div>
      </div>

      <div class="divider"></div>
      <label><input type="checkbox" id="mModPano" ${m.modulos.panoramica ? "checked" : ""}> Vista panorámica</label>
      <div id="mWrapPano" style="display:${m.modulos.panoramica ? "" : "none"};">
        <div id="campoPano"></div>
      </div>
      </div>

      <div class="divider"></div>
      <p class="muted" style="margin-bottom:4px;"><strong>Presentación de las imágenes</strong></p>
      <div id="mWrapDispo">
        <label>Disposición croquis / panorámica</label>
        <select id="mDisposicion">
          <option value="lado" ${(m.disposicionImg || "lado") === "lado" ? "selected" : ""}>Lado a lado</option>
          <option value="apiladas" ${m.disposicionImg === "apiladas" ? "selected" : ""}>Una bajo la otra (ancho completo)</option>
        </select>
      </div>
      <label>Alto de cada imagen: <span id="mAltoTxt"></span> mm</label>
      <input type="range" id="mAltoImg" min="35" max="120" step="1" value="${Number(m.altoImagenes) || 56}">

      <div class="divider"></div>
      <label><input type="checkbox" id="mModFotos" ${m.modulos.fotos ? "checked" : ""}> Fotografías adicionales (con leyenda)</label>
      <div id="mWrapFotos" style="display:${m.modulos.fotos ? "" : "none"};">
        <div id="listaFotosExtra"></div>
        ${selectorFotoHtml("mFotoExtra", { multiple: true })}
        <label>Alto de las fotografías adicionales: <span id="mAltoExtraTxt"></span> mm</label>
        <input type="range" id="mAltoExtra" min="35" max="120" step="1" value="${Number(m.altoFotosExtra) || 60}">
      </div>

      <div class="divider"></div>
      <label><input type="checkbox" id="mModDesc" ${m.modulos.descripcion ? "checked" : ""}> Descripción</label>
      <div id="mWrapDesc" style="display:${m.modulos.descripcion ? "" : "none"};">
        <textarea id="mDescripcion" rows="4" placeholder="Ej: Perno de anclaje incrustado en hormigón...">${escapeHtml(m.descripcion)}</textarea>
        <div class="row">
          <div style="flex:1;"><label>Equipo GNSS</label><input type="text" id="mEquipoGNSS" value="${escapeHtml(m.equipoGNSS)}"></div>
          <div style="flex:1;"><label>Tipo de medición</label><input type="text" id="mTipoMedicion" value="${escapeHtml(m.tipoMedicion)}"></div>
        </div>
      </div>

      <div class="divider"></div>
      <label><input type="checkbox" id="mModFirma" ${m.modulos.firma ? "checked" : ""}> Datos de operador / revisó</label>
      <div id="mWrapFirma" style="display:${m.modulos.firma ? "" : "none"};">
        <div class="row">
          <div style="flex:1;"><label>Operador</label><input type="text" id="mOperadorNombre" value="${escapeHtml(m.operadorNombre)}"></div>
          <div style="flex:1;"><label>Cargo</label><input type="text" id="mOperadorCargo" value="${escapeHtml(m.operadorCargo)}"></div>
        </div>
        <label>Fecha de medición</label>
        <input type="date" id="mFechaMedicion" value="${m.fechaMedicion || ""}">
        <div class="row">
          <div style="flex:1;"><label>Revisó</label><input type="text" id="mRevisoNombre" value="${escapeHtml(m.revisoNombre)}"></div>
          <div style="flex:1;"><label>Fecha revisión</label><input type="date" id="mFechaRevision" value="${m.fechaRevision || ""}"></div>
        </div>
        <div class="row" style="margin-top:6px;">
          <button class="btn btn-outline btn-sm" id="btnUsarComunes" type="button" style="flex:1;">↓ Usar datos comunes</button>
          <button class="btn btn-outline btn-sm" id="btnGuardarComunes" type="button" style="flex:1;">↑ Guardar estos como comunes</button>
        </div>
      </div>

      <div class="divider"></div>
      <div class="modal-actions" style="display:flex; gap:8px;">
        <button class="btn btn-accent" id="btnGuardarMonografia" type="button" style="flex:1;">Guardar</button>
        <button class="btn btn-outline" id="btnVistaPrevia" type="button" style="flex:1;">👁 Vista previa</button>
        <button class="btn btn-outline" id="btnPdfDesdeEditor" type="button" style="flex:1;">Generar PDF</button>
      </div>
    </div>
  `;

  document.getElementById("btnVolverMonografias").addEventListener("click", () => { state.monografiaEnEdicionId = null; renderMonografias(); });

  // Toggle de visibilidad en vivo para cada módulo
  [["mModUtm", "mWrapUtm"], ["mModGeo", "mWrapGeo"], ["mModCroquis", "mWrapCroquis"], ["mModPano", "mWrapPano"], ["mModFotos", "mWrapFotos"], ["mModDesc", "mWrapDesc"], ["mModFirma", "mWrapFirma"]].forEach(([chkId, wrapId]) => {
    document.getElementById(chkId).addEventListener("change", (e) => {
      document.getElementById(wrapId).style.display = e.target.checked ? "" : "none";
    });
  });

  m.ajustes = m.ajustes || {};
  m.fotosExtra = m.fotosExtra || [];
  const repintadores = [];
  const repintarTodo = () => repintadores.forEach((f) => f());

  /* Campo de imagen: miniatura con el encuadre real, cámara/archivo, ajustar y quitar */
  function montarCampoImagen(cont, c) {
    async function pintar() {
      const url = c.get();
      cont.innerHTML = `
        <div class="row" style="align-items:center; gap:10px;">
          <div data-mini class="muted" style="flex:none; border:1px dashed var(--line); border-radius:6px; overflow:hidden; position:relative; background:#fff; font-size:10px; display:flex; align-items:center; justify-content:center;"></div>
          <div style="flex:1; min-width:0;">${selectorFotoHtml(c.id)}
            ${url ? `<div class="row" style="gap:8px; margin-top:6px;">
              <button class="btn btn-outline btn-sm" type="button" data-aj style="flex:1;">✂️ Ajustar encuadre</button>
              <button class="btn btn-outline btn-sm danger" type="button" data-q style="flex:1;">Quitar</button></div>` : ""}
          </div>
        </div>`;
      const [bw, bh] = c.dims();
      const mini = cont.querySelector("[data-mini]");
      const PW = 110, PH = Math.max(24, Math.min(90, Math.round(PW * bh / bw)));
      mini.style.width = PW + "px"; mini.style.height = PH + "px";
      if (!url) mini.textContent = "Sin imagen";
      else {
        try {
          const im = await cargarImagenEl(url);
          const aj = c.getAj(), giro = (((aj.giro || 0) % 360) + 360) % 360, swap = giro === 90 || giro === 270;
          const r = calcRectImagen(swap ? im.naturalHeight : im.naturalWidth, swap ? im.naturalWidth : im.naturalHeight, PW, PH, aj);
          const dw = swap ? r.h : r.w, dh = swap ? r.w : r.h;
          mini.innerHTML = `<img src="${url}" style="position:absolute; max-width:none; width:${dw}px; height:${dh}px; left:${r.x + r.w / 2 - dw / 2}px; top:${r.y + r.h / 2 - dh / 2}px; transform:rotate(${giro}deg);">`;
        } catch (_) { mini.textContent = "?"; }
      }
      wireSelectorFoto(cont, c.id, async (file) => {
        try {
          const r = await leerFotoArchivo(file, c.png ? { maxPx: 900, conservarPng: true } : { maxPx: 1600 });
          c.set(r.dataUrl); c.setAj(c.ajusteInicial || { modo: "llenar", zoom: 1, ox: 0, oy: 0, giro: 0 });
          pintar();
        } catch (_) { toast("No se pudo leer la imagen"); }
      });
      const bAj = cont.querySelector("[data-aj]");
      if (bAj) bAj.addEventListener("click", () => abrirAjusteImagen({
        titulo: c.titulo, dataUrl: c.get(), bw, bh, ajuste: c.getAj(), onOk: (aj) => { c.setAj(aj); pintar(); }
      }));
      const bQ = cont.querySelector("[data-q]");
      if (bQ) bQ.addEventListener("click", () => { c.set(null); pintar(); if (c.onQuitar) c.onQuitar(); });
    }
    repintadores.push(pintar);
    pintar();
  }
  const campoSimple = (contId, id, titulo, clave, dimClave, defMod, png) => montarCampoImagen(document.getElementById(contId), {
    id, titulo, png, ajusteInicial: { modo: defMod, zoom: 1, ox: 0, oy: 0, giro: 0 },
    get: () => m[clave], set: (u) => { m[clave] = u; },
    getAj: () => ajusteDe(m, clave, defMod), setAj: (aj) => { m.ajustes[clave] = aj; },
    dims: () => dimsMonografia(m)[dimClave]
  });
  campoSimple("campoClienteLogo", "mLogoCli", "Logo del cliente", "clienteLogo", "clienteLogo", "ajustar", true);
  campoSimple("campoCroquis", "mCroq", "Croquis de ubicación", "croquisImg", "croquisImg", "llenar", false);
  campoSimple("campoPano", "mPano", "Vista panorámica", "panoramicaImg", "panoramicaImg", "llenar", false);

  // Presentación: disposición y alto
  const selDisp = document.getElementById("mDisposicion");
  const rngAlto = document.getElementById("mAltoImg"), txtAlto = document.getElementById("mAltoTxt");
  const rngAltoE = document.getElementById("mAltoExtra"), txtAltoE = document.getElementById("mAltoExtraTxt");
  const pintarDispo = () => {
    txtAlto.textContent = rngAlto.value; txtAltoE.textContent = rngAltoE.value;
    document.getElementById("mWrapDispo").style.display = (document.getElementById("mModCroquis").checked && document.getElementById("mModPano").checked) ? "" : "none";
  };
  selDisp.addEventListener("change", () => { m.disposicionImg = selDisp.value; repintarTodo(); });
  rngAlto.addEventListener("input", () => { m.altoImagenes = Number(rngAlto.value); pintarDispo(); repintarTodo(); });
  rngAltoE.addEventListener("input", () => { m.altoFotosExtra = Number(rngAltoE.value); pintarDispo(); repintarTodo(); });
  ["mModCroquis", "mModPano"].forEach((id) => document.getElementById(id).addEventListener("change", () => {
    m.modulos.croquis = document.getElementById("mModCroquis").checked;
    m.modulos.panoramica = document.getElementById("mModPano").checked;
    pintarDispo(); repintarTodo();
  }));
  pintarDispo();

  // Fotografías adicionales
  function pintarExtras() {
    const lista = document.getElementById("listaFotosExtra");
    lista.innerHTML = "";
    m.fotosExtra.forEach((f, idx) => {
      const fila = document.createElement("div");
      fila.style.cssText = "border:1px solid var(--line); border-radius:8px; padding:8px; margin-bottom:8px;";
      fila.innerHTML = `<div data-campo></div>
        <input type="text" placeholder="Leyenda (ej: Vista hacia el norte)" value="${escapeHtml(f.leyenda || "")}" style="margin-top:6px;">
        <div class="row" style="gap:6px; margin-top:6px;">
          <button class="btn btn-outline btn-sm" type="button" data-sube style="flex:1;" ${idx === 0 ? "disabled" : ""}>↑</button>
          <button class="btn btn-outline btn-sm" type="button" data-baja style="flex:1;" ${idx === m.fotosExtra.length - 1 ? "disabled" : ""}>↓</button>
          <button class="btn btn-outline btn-sm danger" type="button" data-borra style="flex:2;">Eliminar foto</button></div>`;
      lista.appendChild(fila);
      fila.querySelector("input").addEventListener("input", (e) => { f.leyenda = e.target.value; });
      fila.querySelector("[data-sube]").addEventListener("click", () => { m.fotosExtra.splice(idx - 1, 0, m.fotosExtra.splice(idx, 1)[0]); pintarExtras(); });
      fila.querySelector("[data-baja]").addEventListener("click", () => { m.fotosExtra.splice(idx + 1, 0, m.fotosExtra.splice(idx, 1)[0]); pintarExtras(); });
      fila.querySelector("[data-borra]").addEventListener("click", () => { m.fotosExtra.splice(idx, 1); pintarExtras(); });
      montarCampoImagen(fila.querySelector("[data-campo]"), {
        id: "mExtra" + f.id, titulo: f.leyenda || ("Foto adicional " + (idx + 1)),
        get: () => f.img, set: (u) => { f.img = u; },
        getAj: () => Object.assign({ modo: "llenar", zoom: 1, ox: 0, oy: 0, giro: 0 }, f.aj || {}), setAj: (aj) => { f.aj = aj; },
        dims: () => dimsMonografia(m).extra
      });
    });
  }
  pintarExtras();
  wireSelectorFoto(document.getElementById("mWrapFotos"), "mFotoExtra", async (file) => {
    try {
      const r = await leerFotoArchivo(file);
      m.fotosExtra.push({ id: uuid(), img: r.dataUrl, leyenda: "", aj: { modo: "llenar", zoom: 1, ox: 0, oy: 0, giro: 0 } });
      pintarExtras();
    } catch (_) { toast("No se pudo leer la imagen"); }
  });


  function leerCamposAEstado() {
    m.tituloDocumento = document.getElementById("mTituloDocumento").value.trim();
    m.clienteNombre = document.getElementById("mClienteNombre").value.trim();
    m.nombreProyecto = document.getElementById("mNombreProyecto").value.trim();
    m.puntoMedido = document.getElementById("mPuntoMedido").value.trim();
    m.localidad = document.getElementById("mLocalidad").value.trim();
    m.ubicacion = document.getElementById("mUbicacion").value.trim();
    m.comuna = document.getElementById("mComuna").value.trim();
    m.region = document.getElementById("mRegion").value.trim();
    m.provincia = m.region;
    m.datumUTM = document.getElementById("mDatumUTM").value.trim();
    m.zonaUTM = document.getElementById("mZonaUTM").value.trim();
    m.norte = document.getElementById("mNorte").value.trim();
    m.este = document.getElementById("mEste").value.trim();
    m.cotaOrtometrica = document.getElementById("mCota").value.trim();
    m.datumGeodesico = document.getElementById("mDatumGeo").value.trim();
    m.geoide = document.getElementById("mGeoide").value.trim();
    m.latitud = geoSegunFormato(document.getElementById("mLat").value, "lat");
    m.longitud = geoSegunFormato(document.getElementById("mLng").value, "lng");
    document.getElementById("mLat").value = m.latitud; document.getElementById("mLng").value = m.longitud;
    m.alturaElipsoidal = document.getElementById("mAltElip").value.trim();
    m.descripcion = document.getElementById("mDescripcion").value.trim();
    m.equipoGNSS = document.getElementById("mEquipoGNSS").value.trim();
    m.tipoMedicion = document.getElementById("mTipoMedicion").value.trim();
    m.operadorNombre = document.getElementById("mOperadorNombre").value.trim();
    m.operadorCargo = document.getElementById("mOperadorCargo").value.trim();
    m.fechaMedicion = document.getElementById("mFechaMedicion").value;
    m.revisoNombre = document.getElementById("mRevisoNombre").value.trim();
    m.fechaRevision = document.getElementById("mFechaRevision").value;
    m.modulos = {
      utm: document.getElementById("mModUtm").checked,
      geodesicas: document.getElementById("mModGeo").checked,
      croquis: document.getElementById("mModCroquis").checked,
      panoramica: document.getElementById("mModPano").checked,
      descripcion: document.getElementById("mModDesc").checked,
      firma: document.getElementById("mModFirma").checked,
      fotos: document.getElementById("mModFotos").checked
    };
  }

  document.getElementById("btnUsarComunes").addEventListener("click", () => {
    const c = cargarMonoComunes();
    if (!MONO_COMUNES_CAMPOS.some((k) => c[k])) return toast("Aún no hay datos comunes (se escriben en el listado).");
    const mapa = { ubicacion: "mUbicacion", localidad: "mLocalidad", comuna: "mComuna", region: "mRegion", operadorNombre: "mOperadorNombre", operadorCargo: "mOperadorCargo", fechaMedicion: "mFechaMedicion", revisoNombre: "mRevisoNombre", fechaRevision: "mFechaRevision" };
    MONO_COMUNES_CAMPOS.forEach((k) => { if (c[k]) document.getElementById(mapa[k]).value = c[k]; });
    toast("Datos comunes cargados");
  });
  document.getElementById("btnGuardarComunes").addEventListener("click", () => {
    leerCamposAEstado();
    const c = cargarMonoComunes();
    MONO_COMUNES_CAMPOS.forEach((k) => { c[k] = m[k] || ""; });
    guardarMonoComunes(c);
    toast("Guardado como datos comunes");
  });
  document.getElementById("btnGuardarMonografia").addEventListener("click", async () => {
    leerCamposAEstado();
    await dbPut("monografias", m);
    guardarMonografiaDefaults(m);
    toast("Monografía guardada");
    state.monografiaEnEdicionId = null;
    renderMonografias();
  });
  document.getElementById("btnVistaPrevia").addEventListener("click", () => {
    leerCamposAEstado();
    abrirVistaPreviaMonografia(m.id, m);
  });
  document.getElementById("btnPdfDesdeEditor").addEventListener("click", async () => {
    leerCamposAEstado();
    await dbPut("monografias", m);
    guardarMonografiaDefaults(m);
    exportarMonografiaPdf(m.id);
  });
}
