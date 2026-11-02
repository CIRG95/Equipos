"use strict";

/* =========================================================================
   PANEL WEB (v0.4) — diseño «D»: mapa de fondo + panel de datos a la
   izquierda + resumen a la derecha + hoja de registro imprimible.
   - En PC: mapa Leaflet detrás, resumen del levantamiento en #pcInspector.
   - En teléfono: el mismo resumen aparece como tarjeta arriba del
     levantamiento en curso.
   No cambia datos ni columnas: solo lee lo que ya existe.
   ========================================================================= */
const COLOR_INSTR = { nivel: "#1D5C63", gnss: "#2E7D4F", estacion: "#C24A17", escaner: "#6B4FA0", catastro: "#8A5A12" };

function levParaResumen() {
  const j = jornadaActiva();
  if (!j) return null;
  const act = levantamientoActivo();
  if (act) return act;
  const delaJ = state.levantamientos.filter((l) => l.jornadaId === j.id && !l.eliminado);
  return delaJ.length ? delaJ[delaJ.length - 1] : null;
}

function resumenKpis(lev) {
  // Devuelve { kpis:[[etq,valor]], estado:{txt,cls}|null, nota }
  const n = lev.puntos.length;
  if (lev.instrumento === "nivel" && lev.tipo === "cerrada" && lev.puntoPartida) {
    const c = calcularCierreNivelacion(lev);
    const k = [["Distancia", c.distanciaTotalM.toFixed(0) + " m"], ["Tramos", String(n)]];
    if (c.llego && c.esLoopReal) {
      k.push(["Error de cierre", c.errorCierreMm.toFixed(1) + " mm"]);
      return { kpis: k, estado: { txt: (c.dentroDeTolerancia ? "Dentro" : "Fuera") + " de tolerancia (±" + c.toleranciaMm.toFixed(1) + " mm)", ok: c.dentroDeTolerancia }, nota: textoToleranciaNivelacion(lev) };
    }
    return { kpis: k.concat([["Cota actual", c.cotaActual.toFixed(4)]]), estado: null, nota: textoToleranciaNivelacion(lev) };
  }
  if (esPlanilla(lev)) {
    const ok = lev.puntos.filter((p) => p.valores.estadoTxt === "OK").length;
    const fu = lev.puntos.filter((p) => p.valores.estadoTxt === "FUERA").length;
    return { kpis: [[esReplanteo(lev) ? "Puntos" : "Instalaciones", String(n)], ["Tolerancia", (lev.tolMm || "—") + " mm"]],
      estado: n ? { txt: ok + " OK · " + fu + " fuera de tolerancia", ok: fu === 0 } : null, nota: NORMAS[normaDe(lev)] ? NORMAS[normaDe(lev)].nombre.split(" (")[0] : "" };
  }
  const conFoto = lev.puntos.filter((p) => p.foto || (p.fotos && p.fotos.length)).length;
  return { kpis: [["Puntos", String(n)], ["Con foto", String(conFoto)]], estado: null, nota: "" };
}

function resumenLevantamientoHtml(lev) {
  const r = resumenKpis(lev);
  const j = state.jornadas.find((x) => x.id === lev.jornadaId);
  const av = j ? calcularAvanceObjetivos(j) : { pct: null, hechosCheck: 0, totalCheck: 0 };
  const fr = lev.fotosReq || [];
  const frOk = fr.filter((f) => f.foto);
  const comp = (lev.instrumento === "nivel" && lev.tipo === "cerrada" && lev.puntoPartida) ? compensarNivelacion(lev) : null;
  return `
    <div class="rs-titulo">${escapeHtml(lev.instrumentoNombre)} — ${escapeHtml(lev.tipoNombre)}</div>
    <div class="muted">${lev.estado === "en_curso" ? "En curso" : "Cerrado"}${r.nota ? " · " + escapeHtml(r.nota) : ""}</div>
    <div class="rs-kpis">${r.kpis.map((k) => `<div class="rs-kpi"><span>${escapeHtml(k[0])}</span><strong>${escapeHtml(k[1])}</strong></div>`).join("")}</div>
    ${r.estado ? `<div class="rs-estado ${r.estado.ok ? "ok" : "mal"}">${escapeHtml(r.estado.txt)}</div>` : ""}
    ${fr.length ? `<div class="rs-sec"><strong>Fotos requeridas</strong><span class="badge ${frOk.length === fr.length ? "closed" : "open"}">${frOk.length} de ${fr.length}</span></div>
      <div class="rs-fotos">${fr.map((f) => f.foto ? `<img src="${f.foto}" class="thumb" style="width:52px;height:52px;" title="${escapeHtml(f.nombre)}" onclick="verFoto('${f.foto}')">` : `<span class="rs-falta" title="${escapeHtml(f.nombre)}">${escapeHtml(f.nombre)}</span>`).join("")}</div>` : ""}
    ${av.pct != null ? `<div class="rs-sec"><strong>Objetivos del día</strong><span class="muted">${av.pct} % · ${av.hechosCheck} de ${av.totalCheck}</span></div>
      <div class="rs-barra"><div style="width:${av.pct}%"></div></div>` : ""}
    ${comp ? `<div class="rs-sec"><strong>Cotas compensadas</strong></div>
      <table class="rs-tabla">${comp.map((c) => `<tr><td>${escapeHtml(c.punto || "")}</td><td>${c.corrMm >= 0 ? "+" : ""}${c.corrMm.toFixed(1)}</td><td>${c.cotaComp.toFixed(4)}</td></tr>`).join("")}</table>` : ""}
    <button class="btn" type="button" style="margin-top:14px;" onclick="abrirRegistro('${lev.id}')">Ver registro completo</button>`;
}

/* ---------- Hoja de registro (imprimible) ---------- */
function abrirRegistro(levId) {
  const lev = state.levantamientos.find((l) => l.id === levId);
  if (!lev) return;
  const j = state.jornadas.find((x) => x.id === lev.jornadaId) || {};
  const columnas = INSTRUMENTOS[lev.instrumento].tipos[lev.tipo].columnas;
  const r = resumenKpis(lev);
  const cerrada = lev.instrumento === "nivel" && lev.tipo === "cerrada" && lev.puntoPartida;
  const fr = (lev.fotosReq || []).filter((f) => f.foto);
  const celda = (c, p) => {
    let st = "";
    if (c.key === "estadoTxt") st = `color:${colorEstado(p.valores.estadoTxt)};font-weight:700;`;
    if (c.key === "errorTramoMm") st = `color:${colorNivel(clasificarErrorTramo(parseFloat(p.valores.errorTramoMm)))};font-weight:700;`;
    return `<td class="${c.tipo === "number" ? "num" : ""}" style="${st}">${escapeHtml(p.valores[c.key] ?? "")}</td>`;
  };
  const comp = cerrada ? compensarNivelacion(lev) : null;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "registroSheet";
  overlay.innerHTML = `
    <div class="reg-hoja">
      <div class="reg-acciones">
        <button class="btn btn-outline btn-sm" type="button" id="regCerrar">Volver</button>
        <button class="btn btn-sm" type="button" id="regImprimir">Imprimir / PDF</button>
      </div>
      <div class="reg-sub">Registro de levantamiento</div>
      <h2 class="reg-titulo">${escapeHtml(lev.instrumentoNombre)} — ${escapeHtml(lev.tipoNombre)}</h2>
      <div class="reg-ficha">
        <div><span>PROYECTO</span>${escapeHtml(j.proyecto || "—")}</div>
        <div><span>FECHA</span>${j.fechaInicio ? fmtFecha(j.fechaInicio) : "—"}</div>
        <div><span>OPERADOR</span>${escapeHtml(j.operador || "—")}</div>
        <div><span>EQUIPO</span>${escapeHtml(lev.equipo || "—")}</div>
        <div><span>INICIO / FIN</span>${fmtHoraCorta(lev.fechaInicio)}${lev.fechaFin ? " – " + fmtHoraCorta(lev.fechaFin) : ""}</div>
        <div><span>NORMA / CRITERIO</span>${escapeHtml(r.nota || "—")}</div>
        ${cerrada ? `<div><span>PARTIDA</span>${escapeHtml(lev.puntoPartida)} · ${Number(lev.cotaPartida).toFixed(4)} m</div><div><span>CIERRE EN</span>${escapeHtml(lev.puntoFinal)}</div>` : ""}
      </div>
      <div class="reg-scroll"><table class="reg-tabla">
        <thead><tr>${columnas.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr></thead>
        <tbody>${lev.puntos.map((p) => `<tr>${columnas.map((c) => celda(c, p)).join("")}</tr>`).join("") || `<tr><td colspan="${columnas.length}" class="muted">Sin registros.</td></tr>`}</tbody>
      </table></div>
      ${comp ? `<div class="reg-bloque"><strong>Cotas compensadas (partes iguales)</strong><div class="reg-scroll"><table class="reg-tabla"><thead><tr><th>Punto</th><th>Cota obs.</th><th>Corr. (mm)</th><th>Cota comp.</th></tr></thead><tbody>${comp.map((c) => `<tr><td>${escapeHtml(c.punto || "")}</td><td class="num">${c.cotaObs.toFixed(4)}</td><td class="num">${c.corrMm.toFixed(1)}</td><td class="num"><strong>${c.cotaComp.toFixed(4)}</strong></td></tr>`).join("")}</tbody></table></div></div>` : ""}
      <div class="reg-bloque"><strong>Cierre / resultado</strong>
        <div class="reg-kpis">${r.kpis.map((k) => `<span>${escapeHtml(k[0])}: <b>${escapeHtml(k[1])}</b></span>`).join("")}</div>
        ${r.estado ? `<div class="rs-estado ${r.estado.ok ? "ok" : "mal"}">${escapeHtml(r.estado.txt)}</div>` : ""}</div>
      ${fr.length ? `<div class="reg-bloque"><strong>Fotos requeridas</strong><div class="rs-fotos">${fr.map((f) => `<figure><img src="${f.foto}" style="width:110px;height:84px;object-fit:cover;"><figcaption>${escapeHtml(f.nombre)}</figcaption></figure>`).join("")}</div></div>` : ""}
      <div class="reg-firma"><div></div><span>Operador · ${escapeHtml(j.operador || "")}</span></div>
      <div class="reg-firma"><div></div><span>Revisó</span></div>
    </div>`;
  document.body.appendChild(overlay);
  const cerrar = () => { overlay.remove(); document.body.classList.remove("imprimiendo-registro"); };
  overlay.querySelector("#regCerrar").addEventListener("click", cerrar);
  overlay.querySelector("#regImprimir").addEventListener("click", () => {
    document.body.classList.add("imprimiendo-registro");
    setTimeout(() => { window.print(); }, 50);
  });
  window.addEventListener("afterprint", () => document.body.classList.remove("imprimiendo-registro"), { once: true });
}
window.abrirRegistro = abrirRegistro;

/* ---------- Mapa de fondo (solo PC) ---------- */
let pcMapa = null, pcCapa = null, pcClave = "", pcMovido = false, pcProg = false, pcPts = [], pcEncuadrado = false;
/* v0.5.4 — El mapa de fondo ya no se mueve solo: se encuadra una vez al abrir la jornada o
   cambiar de levantamiento, y si lo mueves tú no se vuelve a tocar. «⌖» lo recentra a mano. */
function pcAjustar(fn) {
  pcProg = true; fn();
  setTimeout(() => { pcProg = false; }, 800);
}
function pcCentrar() {
  if (!pcMapa || !pcPts.length) return;
  pcAjustar(() => { if (pcPts.length > 1) pcMapa.fitBounds(pcPts, { padding: [80, 80], maxZoom: 18 }); else pcMapa.setView(pcPts[0], 17); });
  pcMovido = false;
}
function asegurarMapaPC() {
  if (pcMapa || typeof L === "undefined") return pcMapa;
  const el = document.getElementById("pcMapa");
  if (!el) return null;
  pcMapa = L.map(el, { zoomControl: false, attributionControl: true }).setView([-32.83, -70.6], 12);
  L.control.zoom({ position: "bottomright" }).addTo(pcMapa);
  const Centrar = L.Control.extend({
    options: { position: "bottomright" },
    onAdd() {
      const bar = L.DomUtil.create("div", "leaflet-bar");
      const a = L.DomUtil.create("a", "pc-centrar", bar);
      a.href = "#"; a.title = "Centrar en los puntos"; a.setAttribute("role", "button"); a.setAttribute("aria-label", "Centrar en los puntos"); a.textContent = "⌖";
      L.DomEvent.disableClickPropagation(bar);
      L.DomEvent.on(a, "click", (e) => { L.DomEvent.preventDefault(e); pcCentrar(); });
      return bar;
    }
  });
  new Centrar().addTo(pcMapa);
  pcMapa.on("movestart zoomstart", () => { if (!pcProg) pcMovido = true; });
  agregarCapasBase(pcMapa);
  pcCapa = L.layerGroup().addTo(pcMapa);
  window.addEventListener("resize", () => { if (pcMapa) pcMapa.invalidateSize(); });
  return pcMapa;
}
function nombrePunto(l, p) {
  const v = p.valores || {};
  return v.punto || v.puntoAdelante || v.codigo || v.estacion || ("#" + p.numero);
}
function actualizarMapaPC(act) {
  const m = asegurarMapaPC();
  if (!m) return;
  setTimeout(() => m.invalidateSize(), 50);
  pcCapa.clearLayers();
  const j = jornadaActiva();
  if (!j) return;
  const pts = [];
  if (j.lat != null) {
    L.circleMarker([j.lat, j.lng], { radius: 6, color: "#16232B", weight: 2, fillColor: "#fff", fillOpacity: 1 }).bindTooltip("Inicio de jornada").addTo(pcCapa);
    pts.push([j.lat, j.lng]);
  }
  state.levantamientos.filter((l) => l.jornadaId === j.id && !l.eliminado).forEach((l) => {
    const activo = act && l.id === act.id;
    const color = COLOR_INSTR[l.instrumento] || "#1D5C63";
    l.puntos.forEach((p) => {
      if (p.lat == null) return;
      L.circleMarker([p.lat, p.lng], { radius: activo ? 8 : 6, color, weight: 3, fillColor: "#fff", fillOpacity: 1 })
        .bindTooltip(String(nombrePunto(l, p)), { permanent: !!activo, direction: "top", offset: [0, -6] }).addTo(pcCapa);
      pts.push([p.lat, p.lng]);
    });
  });
  pcPts = pts;
  const clave = j.id + ":" + (act ? act.id : "");
  if (clave !== pcClave) {   // jornada o levantamiento nuevo: encuadra una vez
    pcClave = clave; pcMovido = false;
    if (pts.length) pcCentrar();
  } else if (!pcMovido && pts.length && !pcEncuadrado) {
    pcCentrar();             // la clave ya existía pero aún no había puntos
  }
  pcEncuadrado = pts.length > 0;
}

/* ---------- Orquestación (se llama al final de renderTabActual) ---------- */
function renderPanelWeb() {
  document.body.dataset.tab = state.tabActual;
  const pc = esModoPC();
  const insp = document.getElementById("pcInspector");
  const lev = levParaResumen();
  if (pc) {
    if (insp) {
      const mostrar = !!lev && (state.tabActual === "jornada" || state.tabActual === "levantamiento");
      insp.style.display = mostrar ? "" : "none";
      if (mostrar) insp.innerHTML = resumenLevantamientoHtml(lev);
      document.body.classList.toggle("insp-visible", mostrar);
    }
    actualizarMapaPC(levantamientoActivo());
  } else if (insp) {
    insp.style.display = "none";
  }
}
/* Teléfono: tarjeta de resumen arriba del levantamiento en curso */
function agregarResumenTelefono(el, lev) {
  if (esModoPC()) return;
  const card = document.createElement("div");
  card.className = "card resumen-tel";
  card.innerHTML = `<details><summary style="cursor:pointer; font-weight:700; color:var(--primary-dark);">Resumen del levantamiento</summary><div style="margin-top:10px;">${resumenLevantamientoHtml(lev)}</div></details>`;
  el.insertBefore(card, el.firstChild);
}

/* Capas base. OpenStreetMap bloquea las apps abiertas desde un archivo (sin
   «referer»), por eso la capa por defecto es satelital de Esri. Se recuerda la elegida. */
function agregarCapasBase(map) {
  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri, Maxar, Earthstar Geographics" });
  const topo = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri, HERE, Garmin, USGS" });
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
  const sin = L.layerGroup();
  const capas = { "Satélite": sat, "Topográfico": topo, "Calles (OSM)": osm, "Sin mapa": sin };
  let elegida = "Satélite";
  try { elegida = localStorage.getItem("mapaBase") || elegida; } catch (_) {}
  (capas[elegida] || sat).addTo(map);
  L.control.layers(capas, null, { position: "bottomleft", collapsed: true }).addTo(map);
  map.on("baselayerchange", (e) => { try { localStorage.setItem("mapaBase", e.name); } catch (_) {} });
}
