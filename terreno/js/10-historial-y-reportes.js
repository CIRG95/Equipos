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
      <div class="row">
        <button class="btn btn-outline btn-sm" data-exportar-excel="${j.id}" type="button">📊 Excel</button>
        <button class="btn btn-outline btn-sm" data-exportar-pdf="${j.id}" type="button">📄 PDF</button>
      </div>
      <details class="mas-acciones">
        <summary>⋯ Más acciones</summary>
        <button class="btn btn-outline danger btn-sm" onclick="eliminarJornada('${j.id}')" type="button">Eliminar jornada y sus levantamientos</button>
      </details>
    </div>`;
  }).join("") + `<p class="preview-note">ℹ️ El Excel trae una hoja por levantamiento con los datos numéricos listos para post-proceso. El PDF incluye además las fotos de cada punto.</p>`;
  el.querySelectorAll("[data-exportar-excel]").forEach((b) => b.addEventListener("click", () => exportarExcel(b.dataset.exportarExcel)));
  el.querySelectorAll("[data-exportar-pdf]").forEach((b) => b.addEventListener("click", () => exportarPdf(b.dataset.exportarPdf)));
}

async function eliminarJornada(id) {
  if (!confirm("Esto elimina la jornada y todos sus levantamientos asociados.\nQuedan en la papelera (⚙ → Datos) y en los respaldos.\n\n¿Continuar?")) return;
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

/* Reportes (0.6.1): se exportan desde cada jornada del Historial. */
function exportarExcel(jornadaId) {
  const j = state.jornadas.find((x) => x.id === jornadaId);
  if (!j) return;
  const wb = construirWorkbook(jornadaId);
  XLSX.writeFile(wb, "terreno_" + j.fechaInicio.slice(0, 10) + ".xlsx");
  toast("Excel generado");
}
