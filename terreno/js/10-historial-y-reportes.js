"use strict";

/* =========================================================================
   TAB: HISTORIAL
   ========================================================================= */
function renderHistorial() {
  const el = document.getElementById("tab-historial");
  const jornadasOrdenadas = [...state.jornadas].sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio));

  if (jornadasOrdenadas.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
        <p><strong>Aún no hay registros</strong></p>
        <p class="muted">Las jornadas y levantamientos que registres aparecerán aquí.</p>
      </div>`;
    return;
  }

  el.innerHTML = jornadasOrdenadas.map((j) => {
    const levs = levantamientosDeJornada(j.id);
    return `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <h2>${fmtFecha(j.fechaInicio)}</h2>
          <p class="muted">${j.proyecto ? "📁 " + escapeHtml(j.proyecto) + " · " : ""}${j.operador ? escapeHtml(j.operador) + " · " : ""}${fmtCoord(j.lat, j.lng)}</p>
        </div>
        <span class="badge ${j.estado === "abierta" ? "open" : "closed"}">${j.estado === "abierta" ? "En curso" : fmtDuracion(j.horas * 3600000)}</span>
      </div>
      <div class="divider"></div>
      ${levs.length === 0 ? `<p class="muted">Sin levantamientos.</p>` : levs.map((l) => `
        <details class="levantamiento-detail">
          <summary>${escapeHtml(l.instrumentoNombre)} · ${escapeHtml(l.tipoNombre)} — ${l.puntos.length} punto${l.puntos.length === 1 ? "" : "s"}
            <span class="badge ${l.estado === "en_curso" ? "open" : "closed"}" style="margin-left:6px;">${l.estado === "en_curso" ? "en curso" : "cerrado"}</span>
          </summary>
          <p class="muted" style="margin:8px 0;">${l.equipo ? escapeHtml(l.equipo) : "Sin equipo especificado"} · ${fmtHoraCorta(l.fechaInicio)}${l.fechaFin ? " – " + fmtHoraCorta(l.fechaFin) : ""}</p>
          ${sesEsEstatico(l) && l.puntos.length > 0 ? svgPlanoEstatico(l) : ""}
          ${esCatastro(l) && l.puntos.length > 0 ? `<p class="muted" style="margin-bottom:6px;">${catResumen(l)}</p>` + svgPlanoCatastro(l) : ""}
          ${l.puntos.length > 0 ? `
          <div class="table-wrap"><table>
            <thead><tr>${INSTRUMENTOS[l.instrumento].tipos[l.tipo].columnas.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}${sesEsEstatico(l) ? "<th>Sesión</th>" : ""}<th>Foto</th><th></th></tr></thead>
            <tbody>
              ${l.puntos.map((p, pi) => `<tr>${INSTRUMENTOS[l.instrumento].tipos[l.tipo].columnas.map((c) => `<td>${escapeHtml(p.valores[c.key] ?? "")}</td>`).join("")}${sesEsEstatico(l) ? `<td>${escapeHtml(sesNombre(l, p))}</td>` : ""}<td>${(p.fotos && p.fotos.length > 1) ? p.fotos.map((f) => `<img src="${f.dataUrl}" class="thumb" style="width:30px;height:30px;" onclick="verFoto('${f.dataUrl}')">`).join("") : (p.foto ? `<img src="${p.foto}" class="thumb" style="width:30px;height:30px;" onclick="verFoto('${p.foto}')">` : "—")}</td><td><button class="btn btn-outline btn-sm" onclick="abrirEditorPunto('${l.id}', ${pi})" type="button">✏️</button></td></tr>`).join("")}
            </tbody>
          </table></div>` : ""}
          <button class="btn btn-outline btn-sm" style="margin-top:10px;" onclick="abrirEditorLevantamiento('${l.id}')" type="button">✏️ Editar datos</button>
          <button class="btn btn-outline danger btn-sm" style="margin-top:10px;" onclick="eliminarLevantamiento('${l.id}')" type="button">Eliminar levantamiento</button>
        </details>
      `).join("")}
      <div class="divider"></div>
      <button class="btn btn-outline danger btn-sm" onclick="eliminarJornada('${j.id}')" type="button">Eliminar jornada y sus levantamientos</button>
    </div>`;
  }).join("");
}

async function eliminarJornada(id) {
  if (!confirm("Esto elimina la jornada y todos sus levantamientos asociados. ¿Continuar?")) return;
  const levs = levantamientosDeJornada(id);
  for (const l of levs) {
    await dbEliminarSuave("levantamientos", l);
  }
  state.levantamientos = state.levantamientos.filter((l) => l.jornadaId !== id);
  const jorn = state.jornadas.find((x) => x.id === id);
  if (jorn) await dbEliminarSuave("jornadas", jorn);
  state.jornadas = state.jornadas.filter((j) => j.id !== id);
  if (state.jornadaActivaId === id) state.jornadaActivaId = null;
  toast("Jornada eliminada");
  renderTabActual();
}
async function eliminarLevantamiento(id) {
  if (!confirm("¿Eliminar este levantamiento?")) return;
  const lv = state.levantamientos.find((l) => l.id === id);
  if (lv) await dbEliminarSuave("levantamientos", lv);
  state.levantamientos = state.levantamientos.filter((l) => l.id !== id);
  if (state.levantamientoActivoId === id) state.levantamientoActivoId = null;
  toast("Levantamiento eliminado");
  renderTabActual();
}
window.eliminarJornada = eliminarJornada;
window.eliminarLevantamiento = eliminarLevantamiento;

/* =========================================================================
   TAB: REPORTES
   ========================================================================= */
function renderReportes() {
  const el = document.getElementById("tab-reportes");
  const jornadasOrdenadas = [...state.jornadas].sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio));

  if (jornadasOrdenadas.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3a1 1 0 001 1h14a1 1 0 001-1v-3"/></svg>
        <p><strong>Nada que exportar todavía</strong></p>
        <p class="muted">Registra una jornada y sus levantamientos para generar reportes.</p>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="card">
      <h2>Generar reporte</h2>
      <label>Jornada</label>
      <select id="selReporteJornada">
        ${jornadasOrdenadas.map((j) => `<option value="${j.id}">${fmtFecha(j.fechaInicio)} (${levantamientosDeJornada(j.id).length} levant.)</option>`).join("")}
      </select>
      <div id="reporteLevsInfo" class="muted" style="margin-top:10px;"></div>
      <div class="divider"></div>
      <div class="row">
        <button class="btn btn-outline" id="btnExportExcel" type="button">📊 Exportar Excel</button>
        <button class="btn btn-outline" id="btnExportPdf" type="button">📄 Exportar PDF</button>
      </div>
      <p class="preview-note">ℹ️ El Excel trae una hoja por levantamiento con los datos numéricos listos para post-proceso. El PDF incluye además las fotos de cada punto, útil como respaldo o base de monografía.</p>
    </div>
  `;

  const sel = document.getElementById("selReporteJornada");
  function actualizarInfo() {
    const levs = levantamientosDeJornada(sel.value);
    document.getElementById("reporteLevsInfo").textContent =
      levs.length + " levantamiento(s), " + levs.reduce((a, l) => a + l.puntos.length, 0) + " punto(s) en total.";
  }
  sel.addEventListener("change", actualizarInfo);
  actualizarInfo();

  document.getElementById("btnExportExcel").addEventListener("click", () => exportarExcel(sel.value));
  document.getElementById("btnExportPdf").addEventListener("click", () => exportarPdf(sel.value));
}

function exportarExcel(jornadaId) {
  const j = state.jornadas.find((x) => x.id === jornadaId);
  if (!j) return;
  const wb = construirWorkbook(jornadaId);
  XLSX.writeFile(wb, "terreno_" + j.fechaInicio.slice(0, 10) + ".xlsx");
  toast("Excel generado");
}
