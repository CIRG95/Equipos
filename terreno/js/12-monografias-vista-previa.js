"use strict";

/* =========================================================================
   v0.1h — VISTA PREVIA DE MONOGRAFÍAS
   Se genera el PDF real y se muestra página por página (pdf.js, incluido y
   cargado solo al abrir la primera vista previa), así lo que ves es lo que se
   exporta. Funciona sin internet. Si el visor no carga, se ofrece el PDF.
   ========================================================================= */
let _pdfjsPromise = null;
async function textoRecurso(idEl, url) {
  const el = document.getElementById(idEl);
  if (el && el.textContent) return el.textContent;       // archivo único: viene embebido
  const r = await fetch(url);                              // versión con carpeta: desde vendor/
  if (!r.ok) throw new Error("No se pudo cargar " + url);
  return r.text();
}
function cargarPdfJs() {
  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions.workerSrc) return Promise.resolve(window.pdfjsLib);
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = (async () => {
    if (!window.pdfjsLib) {
      const lib = await textoRecurso("src-pdfjs", "vendor/pdf.min.js");
      const s = document.createElement("script");
      s.textContent = lib;
      document.head.appendChild(s);
    }
    const worker = await textoRecurso("src-pdfjs-worker", "vendor/pdf.worker.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([worker], { type: "text/javascript" }));
    return window.pdfjsLib;
  })().catch((e) => { _pdfjsPromise = null; throw e; });
  return _pdfjsPromise;
}

async function abrirVistaPreviaMonografia(monografiaId, mObj) {
  const m = mObj || state.monografias.find((x) => x.id === monografiaId);
  if (!m) return;
  const nombreArchivo = "monografia_" + (m.puntoMedido || "punto").replace(/[^a-z0-9_-]+/gi, "_") + ".pdf";
  const ov = document.createElement("div");
  ov.style.cssText = "position:fixed; inset:0; z-index:65; background:#4b5560; display:flex; flex-direction:column;";
  ov.innerHTML = `
    <div style="display:flex; align-items:center; gap:6px; padding:8px 10px; background:var(--primary-dark, #1d5c63); color:#fff;">
      <div style="flex:1; min-width:0; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Vista previa — ${escapeHtml(m.puntoMedido || "(sin punto)")}</div>
      <button class="btn btn-sm" type="button" data-z="-" style="background:#fff; color:#1d3a40;" aria-label="Alejar">−</button>
      <span data-zt style="min-width:42px; text-align:center; font-size:12px;">100%</span>
      <button class="btn btn-sm" type="button" data-z="+" style="background:#fff; color:#1d3a40;" aria-label="Acercar">+</button>
      <button class="btn btn-sm" type="button" data-dl style="background:#fff; color:#1d3a40;">⬇ PDF</button>
      <button class="btn btn-sm" type="button" data-x style="background:#fff; color:#1d3a40;" aria-label="Cerrar">✕</button>
    </div>
    <div data-area style="flex:1; overflow:auto; padding:10px; -webkit-overflow-scrolling:touch;">
      <div data-estado style="color:#fff; text-align:center; padding:30px 0;"><span class="spinner"></span> Generando vista previa…</div>
    </div>`;
  document.body.appendChild(ov);
  const q = (s) => ov.querySelector(s);
  let cerrado = false, doc = null, pdf = null, zoom = 1, token = 0;
  q("[data-x]").addEventListener("click", () => { cerrado = true; token++; try { if (pdf) pdf.destroy(); } catch (_) {} ov.remove(); });
  q("[data-dl]").addEventListener("click", () => { if (doc) { doc.save(nombreArchivo); toast("PDF generado"); } });

  async function pintar() {
    const mi = ++token;
    const area = q("[data-area]");
    const ancho = Math.max(200, area.clientWidth - 20);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    area.querySelectorAll("canvas").forEach((c) => c.remove());
    const estado = q("[data-estado]"); if (estado) estado.style.display = "none";
    for (let i = 1; i <= pdf.numPages; i++) {
      if (mi !== token || cerrado) return;
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const css = (ancho / base.width) * zoom;
      const vp = page.getViewport({ scale: css * dpr });
      const c = document.createElement("canvas");
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      c.style.cssText = "display:block; margin:0 auto 12px; background:#fff; box-shadow:0 2px 10px rgba(0,0,0,.35); width:" + (vp.width / dpr) + "px; height:" + (vp.height / dpr) + "px;";
      area.appendChild(c);
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    }
    q("[data-zt]").textContent = Math.round(zoom * 100) + "%";
  }
  ov.querySelectorAll("[data-z]").forEach((b) => b.addEventListener("click", () => {
    if (!pdf) return;
    zoom = Math.min(3, Math.max(0.5, zoom + (b.dataset.z === "+" ? 0.25 : -0.25)));
    pintar();
  }));

  try {
    doc = construirMonografiaPdf(m, await prepararImagenesMonografia(m));
    if (cerrado) return;
    try {
      const lib = await cargarPdfJs();
      pdf = await lib.getDocument({ data: new Uint8Array(doc.output("arraybuffer")) }).promise;
    } catch (e) {
      console.warn("Visor PDF no disponible:", e);
      q("[data-estado]").innerHTML = `No se pudo abrir el visor integrado.<br><br><button class="btn btn-accent" type="button" data-abrir>Abrir / descargar el PDF</button>`;
      q("[data-abrir]").addEventListener("click", () => doc.save(nombreArchivo));
      return;
    }
    await pintar();
  } catch (e) {
    console.error(e);
    const est = q("[data-estado]"); if (est) est.textContent = "No se pudo generar la vista previa.";
  }
}
window.abrirVistaPreviaMonografia = abrirVistaPreviaMonografia;

function panelComunesHtml() {
  const c = cargarMonoComunes();
  const proys = Array.from(new Set(state.monografias.map((m) => (m.nombreProyecto || "").trim()).filter(Boolean)));
  return `
    <details class="card" id="comunesPanel" style="padding:12px 14px;" ${state.comunesAbierto ? "open" : ""}>
      <summary style="cursor:pointer; font-weight:700;">👥 Datos comunes (ubicación · levantó / revisó) ${c.activo ? '<span class="muted" style="font-weight:400;">· activado</span>' : ""}</summary>
      <p class="muted" style="margin:6px 0;">Lo que se repite en todas las fichas de un terreno (ubicación, quién levantó y revisó, fechas). Se escribe una vez aquí. Cada ficha sigue pudiendo editarse por separado.</p>
      <label style="display:flex; gap:8px; align-items:center;"><input type="checkbox" id="comActivo" ${c.activo ? "checked" : ""}> Usar en las monografías nuevas e importadas</label>
      <label>Ubicación (sector / lugar del terreno)</label>
      <input type="text" id="comUbicacion" value="${escapeHtml(c.ubicacion)}" placeholder="Ej: PV El Romero Solar">
      <div class="row">
        <div style="flex:1;"><label>Localidad</label><input type="text" id="comLocalidad" value="${escapeHtml(c.localidad)}"></div>
        <div style="flex:1;"><label>Comuna</label><input type="text" id="comComuna" value="${escapeHtml(c.comuna)}"></div>
      </div>
      <label>Región</label>
      <input type="text" id="comRegion" value="${escapeHtml(c.region)}" placeholder="Ej: Región de Atacama">
      <div class="row">
        <div style="flex:1;"><label>Operador</label><input type="text" id="comOperador" value="${escapeHtml(c.operadorNombre)}"></div>
        <div style="flex:1;"><label>Cargo</label><input type="text" id="comCargo" value="${escapeHtml(c.operadorCargo)}"></div>
      </div>
      <label>Fecha de medición</label>
      <input type="date" id="comFechaMed" value="${c.fechaMedicion}">
      <div class="row">
        <div style="flex:1;"><label>Revisó</label><input type="text" id="comRevisor" value="${escapeHtml(c.revisoNombre)}"></div>
        <div style="flex:1;"><label>Fecha revisión</label><input type="date" id="comFechaRev" value="${c.fechaRevision}"></div>
      </div>
      <label>Formato de latitud / longitud</label>
      <div class="row">
        <select id="comFormatoGeo" style="flex:2;">
          <option value="" ${!c.formatoGeo ? "selected" : ""}>Dejar como viene</option>
          <option value="dec" ${c.formatoGeo === "dec" ? "selected" : ""}>Decimal (-29.11632)</option>
          <option value="dms" ${c.formatoGeo === "dms" ? "selected" : ""}>Grados° minutos' segundos" (29°06'58.76"S)</option>
        </select>
        <select id="comDecimales" style="flex:1;" title="Decimales (de grado, o de segundo)">
          ${[2, 3, 4, 5, 6, 7, 8].map((n) => `<option value="${n}" ${c.decimales === n ? "selected" : ""}>${n} dec.</option>`).join("")}
        </select>
      </div>
      <p class="muted" style="font-size:12px; margin:2px 0 6px;">Vale para fichas nuevas, importadas y lo que escribas en el editor. «Aplicar» también convierte las ya creadas.</p>
      <label>Aplicar a las monografías ya creadas</label>
      <div class="row">
        <select id="comAlcance" style="flex:2;">
          <option value="">Todas (${state.monografias.length})</option>
          ${proys.map((p) => `<option value="${escapeHtml(p)}">Solo proyecto: ${escapeHtml(p)}</option>`).join("")}
        </select>
        <button class="btn btn-accent" id="btnComAplicar" type="button" style="flex:1;">Aplicar</button>
      </div>
      <p class="muted" style="margin-top:6px; font-size:12px;">Solo se copian los campos que tengan valor; no se borra nada. Los datos comunes quedan en este dispositivo.</p>
    </details>`;
}
function wirePanelComunes(el) {
  const p = el.querySelector("#comunesPanel"); if (!p) return;
  p.addEventListener("toggle", () => { state.comunesAbierto = p.open; });
  const leer = () => ({
    activo: p.querySelector("#comActivo").checked,
    ubicacion: p.querySelector("#comUbicacion").value.trim(),
    localidad: p.querySelector("#comLocalidad").value.trim(),
    comuna: p.querySelector("#comComuna").value.trim(),
    region: p.querySelector("#comRegion").value.trim(),
    formatoGeo: p.querySelector("#comFormatoGeo").value,
    decimales: parseInt(p.querySelector("#comDecimales").value, 10),
    operadorNombre: p.querySelector("#comOperador").value.trim(),
    operadorCargo: p.querySelector("#comCargo").value.trim(),
    fechaMedicion: p.querySelector("#comFechaMed").value,
    revisoNombre: p.querySelector("#comRevisor").value.trim(),
    fechaRevision: p.querySelector("#comFechaRev").value
  });
  p.querySelector("#comFormatoGeo").addEventListener("change", (e) => {   // al cambiar de formato, decimales típicos
    p.querySelector("#comDecimales").value = e.target.value === "dms" ? "5" : "6";
    guardarMonoComunes(leer());
  });
  p.querySelector("#comDecimales").addEventListener("change", () => guardarMonoComunes(leer()));
  p.querySelectorAll("input").forEach((i) => i.addEventListener("change", () => {
    guardarMonoComunes(leer());
    const sm = p.querySelector("summary");
    if (i.id === "comActivo") sm.innerHTML = sm.innerHTML.replace(/<span class="muted"[^>]*>· activado<\/span>/, "") + (i.checked ? ' <span class="muted" style="font-weight:400;">· activado</span>' : "");
  }));
  p.querySelector("#btnComAplicar").addEventListener("click", async () => {
    const c = leer(); guardarMonoComunes(c);
    if (!MONO_COMUNES_CAMPOS.some((k) => c[k]) && !c.formatoGeo) return toast("Escribe al menos un dato común o elige un formato.");
    const alc = p.querySelector("#comAlcance").value;
    const objetivo = state.monografias.filter((m) => !alc || (m.nombreProyecto || "").trim() === alc);
    if (!objetivo.length) return toast("No hay monografías para aplicar.");
    if (!confirm("Copiar los datos comunes a " + objetivo.length + " monografía(s)" + (alc ? " del proyecto «" + alc + "»" : "") + "?\nLo que ya tengan en esos campos se reemplaza" + (c.formatoGeo ? " y las geográficas se pasan a " + (c.formatoGeo === "dms" ? "grados° minutos' segundos\"" : "decimal") : "") + ".")) return;
    let cambiadas = 0, sinEntender = 0;
    for (const m of objetivo) {
      const antes = normalizarGeoMono({ latitud: m.latitud, longitud: m.longitud }, c).sinEntender;
      sinEntender += antes ? 1 : 0;
      if (aplicarComunesA(m, c)) { await dbPut("monografias", m); cambiadas++; }
    }
    toast("Aplicado a " + cambiadas + " monografía(s)" + (sinEntender ? " · " + sinEntender + " con coordenadas que no se pudieron leer (revísalas)" : ""));
    renderMonografias();
  });
}
/* v0.1l — Pestaña «Herramientas»: utilidades que funcionan solas, sin jornada abierta. */
function renderHerramientas() {
  const el = document.getElementById("tab-monografias");
  const n = state.monografias.length;
  el.innerHTML = `
    <div class="card">
      <h2>Herramientas</h2>
      <p class="muted">Utilidades que se usan solas, sin necesidad de tener una jornada abierta.</p>
    </div>
    <div class="card" style="padding:12px 14px; cursor:pointer;" id="herrMonografias" role="button" tabindex="0">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="font-size:28px;">📐</div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:700;">Monografías</div>
          <div class="muted" style="font-size:12px;">Crear fichas de PRs y monolitos desde cero, desde un punto o importando TXT/CSV · ${n} guardada${n === 1 ? "" : "s"}</div>
        </div>
        <div style="font-size:20px;" aria-hidden="true">›</div>
      </div>
    </div>
    <p class="muted" style="text-align:center; font-size:12px;">Aquí se irán sumando más herramientas.</p>`;
  const ir = () => { state.herramienta = "monografias"; renderMonografias(); };
  const card = el.querySelector("#herrMonografias");
  card.addEventListener("click", ir);
  card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ir(); } });
}
function renderMonografias() {
  const el = document.getElementById("tab-monografias");
  if (state.monografiaEnEdicionId) { renderEditorMonografia(el); return; }
  if (state.herramienta !== "monografias") { renderHerramientas(); return; }

  el.innerHTML = `
    <div class="card">
      <button class="btn btn-outline btn-sm" id="btnVolverHerramientas" type="button" style="margin-bottom:8px;">← Herramientas</button>
      <h2>Monografías GNSS</h2>
      <p class="muted">Fichas de punto para entregar a mandantes — basadas en tu plantilla de monografía de PRs y monolitos.</p>
      <div class="row">
        <button class="btn btn-accent" id="btnNuevaMonografia" type="button" style="flex:1;">+ Nueva desde cero</button>
        <button class="btn btn-outline" id="btnMonografiaDesdePunto" type="button" style="flex:1;">+ Desde punto GNSS</button>
      </div>
      <button class="btn btn-outline" id="btnMonografiaImportar" type="button" style="width:100%; margin-top:8px;">📄 Importar puntos desde TXT / CSV</button>
      <button class="btn btn-outline" id="btnMonografiasJuntas" type="button" style="width:100%; margin-top:8px;">⬇ Descargar todas juntas (un PDF)</button>
      ${typeof sisBotonTodasHtml === "function" ? sisBotonTodasHtml() : ""}
    </div>
    ${panelComunesHtml()}
    ${state.monografias.length ? state.monografias.slice().sort((a, b) => new Date(b.creado) - new Date(a.creado)).map((m) => `
      <div class="card" style="padding:12px 14px;" data-card-mono="${m.id}">
        <div data-toggle-mono="${m.id}" style="display:flex; justify-content:space-between; align-items:center; gap:8px; cursor:pointer;">
          <div style="min-width:0;">
            <div style="font-weight:700;">${escapeHtml(m.puntoMedido || "(sin punto)")} <span class="muted" data-chev style="font-weight:400;">${state.monoAbiertas && state.monoAbiertas.has(m.id) ? "▴" : "▾"}</span></div>
            <div class="muted" style="font-size:12px;">${escapeHtml(m.nombreProyecto || "Sin proyecto")}${m.clienteNombre ? " · " + escapeHtml(m.clienteNombre) : ""}</div>
            <div style="margin-top:2px;">${monoAvisosCorto(m)}</div>
            ${typeof sisEstadoMonoHtml === "function" ? sisEstadoMonoHtml(m) + sisBotonMonoHtml(m) : ""}
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-outline btn-sm" data-editar-monografia="${m.id}" type="button">Editar</button>
            <button class="btn btn-outline btn-sm" data-ver-monografia="${m.id}" type="button" aria-label="Vista previa" title="Vista previa">👁</button>
            <button class="btn btn-outline btn-sm" data-pdf-monografia="${m.id}" type="button">PDF</button>
            <button class="btn btn-danger btn-sm" data-borrar-monografia="${m.id}" type="button">✕</button>
          </div>
        </div>
        <div data-resumen-mono="${m.id}" style="display:${state.monoAbiertas && state.monoAbiertas.has(m.id) ? "block" : "none"};">${monoResumenHtml(m)}</div>
      </div>
    `).join("") : `<div class="empty-state"><p class="muted">Todavía no has creado ninguna monografía.</p></div>`}
  `;

  document.getElementById("btnVolverHerramientas").addEventListener("click", () => { state.herramienta = null; renderMonografias(); });
  wirePanelComunes(el);
  if (typeof sisDespuesDeListado === "function") sisDespuesDeListado();
  document.getElementById("btnNuevaMonografia").addEventListener("click", async () => {
    const m = crearMonografiaDesdeDefaults();
    state.monografias.push(m);
    await dbPut("monografias", m);
    state.monografiaEnEdicionId = m.id;
    renderMonografias();
  });
  document.getElementById("btnMonografiaDesdePunto").addEventListener("click", () => abrirSelectorPuntoGnss());
  document.getElementById("btnMonografiaImportar").addEventListener("click", () => abrirImportadorMonografias());
  document.getElementById("btnMonografiasJuntas").addEventListener("click", () => state.monografias.length ? abrirDescargaTodasMonografias() : toast("Todavía no hay monografías."));
  state.monoAbiertas = state.monoAbiertas || new Set();
  el.querySelectorAll("[data-toggle-mono]").forEach((h) => h.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    const id = h.dataset.toggleMono, cont = el.querySelector('[data-resumen-mono="' + id + '"]');
    const abrir = cont.style.display === "none";
    cont.style.display = abrir ? "block" : "none";
    h.querySelector("[data-chev]").textContent = abrir ? "▴" : "▾";
    if (abrir) state.monoAbiertas.add(id); else state.monoAbiertas.delete(id);
  }));
  el.querySelectorAll("[data-editar-monografia]").forEach((btn) => {
    btn.addEventListener("click", () => { state.monografiaEnEdicionId = btn.dataset.editarMonografia; renderMonografias(); });
  });
  el.querySelectorAll("[data-ver-monografia]").forEach((btn) => {
    btn.addEventListener("click", () => abrirVistaPreviaMonografia(btn.dataset.verMonografia));
  });
  el.querySelectorAll("[data-pdf-monografia]").forEach((btn) => {
    btn.addEventListener("click", () => exportarMonografiaPdf(btn.dataset.pdfMonografia));
  });
  el.querySelectorAll("[data-borrar-monografia]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Borrar esta monografía?")) return;
      const mono = state.monografias.find((m) => m.id === btn.dataset.borrarMonografia);
      if (mono) await dbEliminarSuave("monografias", mono);
      state.monografias = state.monografias.filter((m) => m.id !== btn.dataset.borrarMonografia);
      renderMonografias();
    });
  });
}

/* Modal liviano (reutiliza el overlay de mapModal como contenedor genérico no
   aplica — se arma uno simple al vuelo) para elegir un punto GNSS ya
   capturado y prellenar una monografía nueva con su código/foto/ubicación. */
function abrirSelectorPuntoGnss() {
  const disponibles = puntosGnssDisponibles();
  if (!disponibles.length) { toast("No tienes puntos GNSS capturados todavía en Levantamiento."); return; }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-sheet">
      <button class="close-x" id="selectorPuntoClose">&times;</button>
      <h3>Elegir punto GNSS</h3>
      <p class="muted">Se prellenan código, foto y ubicación de referencia — las coordenadas finales las completas tú.</p>
      <div class="divider"></div>
      <div style="max-height:50vh; overflow-y:auto;">
        ${disponibles.map((d, i) => `
          <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--line);">
            ${d.punto.foto ? `<img src="${d.punto.foto}" class="thumb" style="width:40px;height:40px;">` : ""}
            <div style="flex:1;">
              <div style="font-weight:600;">${escapeHtml(d.punto.valores.punto || "(sin código)")}</div>
              <div class="muted" style="font-size:12px;">${l_Nombre(d.lev)} · ${d.jornada ? fmtFecha(d.jornada.fechaInicio) : "—"}</div>
            </div>
            <button class="btn btn-outline btn-sm" data-elegir-punto="${i}" type="button">Usar</button>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  function l_Nombre(l) { return l.tipoNombre || "GNSS"; }
  overlay.querySelector("#selectorPuntoClose").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelectorAll("[data-elegir-punto]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const d = disponibles[parseInt(btn.dataset.elegirPunto, 10)];
      const m = crearMonografiaDesdeDefaults();
      m.puntoMedido = d.punto.valores.punto || "";
      m.panoramicaImg = d.punto.foto || null;
      m.operadorNombre = (d.jornada && d.jornada.operador) || m.operadorNombre || "";
      m.fechaMedicion = d.punto.timestamp ? d.punto.timestamp.slice(0, 10) : (m.fechaMedicion || "");
      m.equipoGNSS = m.equipoGNSS || "";
      if (!m.nombreProyecto && d.jornada && d.jornada.proyecto) m.nombreProyecto = d.jornada.proyecto;
      if (d.jornada && d.jornada.proyectoId) m.proyectoId = d.jornada.proyectoId;   // v0.5.7
      m.tipoMedicion = d.lev.tipoNombre === "RTK" ? "RTK" : "Estática";
      // Coordenadas de referencia (GPS del punto, no es precisión de post-proceso):
      // se dejan en Geodésicas como punto de partida — el usuario las reemplaza
      // por las coordenadas finales procesadas en oficina.
      if (d.punto.lat != null) m.latitud = geoSegunFormato(d.punto.lat.toFixed(6), "lat");
      if (d.punto.lng != null) m.longitud = geoSegunFormato(d.punto.lng.toFixed(6), "lng");
      state.monografias.push(m);
      await dbPut("monografias", m);
      overlay.remove();
      state.monografiaEnEdicionId = m.id;
      renderMonografias();
    });
  });
}
