"use strict";

/* =========================================================================
   FOTOS REQUERIDAS POR LEVANTAMIENTO (v0.3.1)
   Cada levantamiento en curso muestra una lista de fotos que debes sacar
   para el informe (aunque no lleve monografía). La lista parte con una
   sugerencia según el tipo y es editable. Al finalizar avisa las pendientes.
   Datos: lev.fotosReq = [{ id, nombre, foto, timestamp, lat, lng }]
   ========================================================================= */
const FOTOS_REQ_DEFAULT = {
  "nivel.simple":   ["Equipo instalado", "Punto de partida", "Vista general del trabajo"],
  "nivel.cerrada":  ["Equipo instalado", "Punto de partida (BM)", "Punto final", "Vista general del trabajo"],
  "gnss.estatico":  ["Antena instalada sobre el punto", "Entorno / obstrucciones del punto"],
  "gnss.rtk":       ["Base instalada", "Punto de control / hito"],
  "estacion.instalacion": ["Estación instalada", "Punto de calaje", "Vista general del trabajo"],
  "estacion.replanteo":   ["Instrumento instalado", "Hito replanteado (ejemplo)", "Vista general del trabajo"],
  "escaner.estacion": ["Escáner instalado", "Vista general del sector"],
  "catastro.elementos": ["Vista general del sector"]
};
function fotosReqSugeridas(lev) {
  return FOTOS_REQ_DEFAULT[lev.instrumento + "." + lev.tipo] || ["Vista general del trabajo"];
}
function asegurarFotosReq(lev) {
  if (!Array.isArray(lev.fotosReq)) {
    lev.fotosReq = fotosReqSugeridas(lev).map((n) => ({ id: uuid(), nombre: n, foto: null, timestamp: null, lat: null, lng: null }));
    return true;
  }
  return false;
}
function fotosReqPendientes(lev) { return (lev.fotosReq || []).filter((f) => !f.foto); }

function fotosReqCardHtml(lev) {
  const pend = fotosReqPendientes(lev).length, tot = lev.fotosReq.length;
  return `<div class="card" id="cardFotosReq">
    <h2>📷 Fotos requeridas <span class="badge ${pend ? "open" : "closed"}" style="margin-left:6px;">${tot - pend}/${tot}</span></h2>
    <p class="muted">Fotos que debes sacar en este levantamiento para el informe.</p>
    ${lev.fotosReq.map((f) => `
      <div class="fr-item" data-id="${f.id}" style="padding:8px 0; border-top:1px solid var(--line, #ddd);">
        <div class="row" style="align-items:center; gap:8px;">
          <div style="flex:3;"><strong>${f.foto ? "✓" : "○"} ${escapeHtml(f.nombre)}</strong>
            ${f.timestamp ? `<br><span class="muted">${fmtHoraCorta(f.timestamp)}${f.lat != null ? " · " + fmtCoord(f.lat, f.lng) : ""}</span>` : ""}</div>
          ${f.foto ? `<img src="${f.foto}" class="thumb" style="width:52px;height:52px;" onclick="verFoto('${f.foto}')">` : ""}
          <button class="btn btn-outline btn-sm fr-del" type="button" title="Quitar de la lista">✕</button>
        </div>
        ${selectorFotoHtml("frFoto" + f.id)}
      </div>`).join("")}
    <div class="divider"></div>
    <button class="btn btn-outline btn-sm" type="button" id="frAgregar">+ Agregar foto requerida</button>
  </div>`;
}

/* Inserta la tarjeta antes de la última (la de registros + Finalizar) y la cablea */
function agregarFotosReq(el, lev) {
  if (asegurarFotosReq(lev)) { dbPut("levantamientos", lev); }
  const ultima = el.lastElementChild;
  if (!ultima) return;
  ultima.insertAdjacentHTML("beforebegin", fotosReqCardHtml(lev));
  const card = el.querySelector("#cardFotosReq");
  const guardar = async () => { await dbPut("levantamientos", lev); marcarPendienteSync(lev.jornadaId); };

  lev.fotosReq.forEach((f) => {
    wireSelectorFoto(card, "frFoto" + f.id, async (file) => {
      let r;
      try { r = await leerFotoArchivo(file); } catch (_) { return toast("No se pudo leer la imagen"); }
      f.foto = r.dataUrl; f.timestamp = nowISO();
      const pos = r.gps || await getUbicacionActual();
      f.lat = pos ? pos.lat : null; f.lng = pos ? pos.lng : null;
      await guardar();
      renderTabActual();
    });
  });
  card.querySelectorAll(".fr-del").forEach((b) => b.addEventListener("click", async () => {
    const id = b.closest(".fr-item").dataset.id;
    const f = lev.fotosReq.find((x) => x.id === id);
    if (f && f.foto && !confirm("Esta foto ya está sacada. ¿Quitarla de todas formas?")) return;
    lev.fotosReq = lev.fotosReq.filter((x) => x.id !== id);
    await guardar(); renderTabActual();
  }));
  card.querySelector("#frAgregar").addEventListener("click", async () => {
    const n = (prompt("Nombre de la foto requerida (ej: Placa del hito)") || "").trim();
    if (!n) return;
    lev.fotosReq.push({ id: uuid(), nombre: n, foto: null, timestamp: null, lat: null, lng: null });
    await guardar(); renderTabActual();
  });

  // Aviso al finalizar (captura antes de que actúe el botón de cada pantalla)
  if (el._frGuard) el.removeEventListener("click", el._frGuard, true);
  el._frGuard = (e) => {
    if (!e.target.closest || !e.target.closest("#btnFinalizarLevantamiento")) return;
    const pend = fotosReqPendientes(lev);
    if (pend.length && !confirm("Faltan " + pend.length + " foto(s) requerida(s):\n• " + pend.map((f) => f.nombre).join("\n• ") + "\n\n¿Finalizar de todas formas?")) {
      e.stopImmediatePropagation(); e.preventDefault();
    }
  };
  el.addEventListener("click", el._frGuard, true);
}
