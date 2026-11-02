"use strict";

/* =========================================================================
   PLANILLAS 1 (v0.3): Estación Total — Instalación y calaje / Replanteo
   Los puntos guardan valores crudos + derivados (se recalculan solos).
   La lista de controles (instalación) o de diseño (replanteo) vive en el
   levantamiento: lev.controles / lev.diseno, importable por CSV NEZD.
   ========================================================================= */
function esPlanilla(lev) { return !!lev && lev.instrumento === "estacion"; }
function esReplanteo(lev) { return esPlanilla(lev) && lev.tipo === "replanteo"; }
function listaDe(lev) { return esReplanteo(lev) ? lev.diseno : lev.controles; }

function asegurarPlanilla(lev) {
  lev.norma = lev.norma || NORMA_DEFAULT;
  lev.angulos = lev.angulos || "sexa";
  if (lev.tolMm == null) lev.tolMm = esReplanteo(lev) ? TOL_REPLANTEO_MM_MOP : TOL_INSTALACION_MM_DEF;
  lev.controles = lev.controles || [];
  lev.diseno = lev.diseno || [];
}
function buscarEnLista(lev, nombre) {
  const n = String(nombre || "").trim().toLowerCase();
  if (!n) return null;
  return listaDe(lev).find((c) => c.nombre.trim().toLowerCase() === n) || null;
}
const fl = (s) => { const v = parseFloat(s); return isNaN(v) ? NaN : v; };

/* Recalcula los derivados de todos los puntos de la planilla */
function recalcularPlanilla(lev) {
  const tol = lev.tolMm;
  for (const p of lev.puntos) {
    const v = p.valores;
    if (esReplanteo(lev)) {
      const dN = fl(v.Nm) - fl(v.Nd), dE = fl(v.Em) - fl(v.Ed);
      const dH = Math.hypot(dN, dE) * 1000;
      const dZ = (fl(v.Zm) - fl(v.Zd)) * 1000;
      v.dN = isNaN(dN) ? "" : (dN * 1000).toFixed(0);
      v.dE = isNaN(dE) ? "" : (dE * 1000).toFixed(0);
      v.dH = isNaN(dH) ? "" : dH.toFixed(0);
      v.dZ = isNaN(dZ) ? "" : dZ.toFixed(0);
      if (isNaN(dH)) v.estadoTxt = "Incompleto";
      else v.estadoTxt = (dH <= tol && (isNaN(dZ) || Math.abs(dZ) <= tol)) ? "OK" : "FUERA";
    } else {
      const est = buscarEnLista(lev, v.estacion), cal = buscarEnLista(lev, v.calaje);
      if (est && cal) {
        v.azCalaje = fmtAngulo(azimutGrados(est.N, est.E, cal.N, cal.E), lev.angulos);
        v.distCalaje = distHoriz(est.N, est.E, cal.N, cal.E).toFixed(3);
      } else { v.azCalaje = ""; v.distCalaje = ""; }
      let faltan = false, fuera = false, hay = 0;
      [1, 2].forEach((k) => {
        const c = buscarEnLista(lev, v["comp" + k]);
        const n = fl(v["c" + k + "N"]), e = fl(v["c" + k + "E"]), z = fl(v["c" + k + "Z"]);
        if (!c || isNaN(n) || isNaN(e)) { v["dH" + k] = ""; v["dZ" + k] = ""; faltan = true; return; }
        hay++;
        const dH = distHoriz(c.N, c.E, n, e) * 1000;
        const dZ = (c.Z != null && !isNaN(z)) ? (z - c.Z) * 1000 : NaN;
        v["dH" + k] = dH.toFixed(0); v["dZ" + k] = isNaN(dZ) ? "" : dZ.toFixed(0);
        if (dH > tol || (!isNaN(dZ) && Math.abs(dZ) > tol)) fuera = true;
      });
      v.estadoTxt = fuera ? "FUERA" : (faltan ? (hay ? "Falta 1 comprobación" : "Incompleto") : "OK");
    }
  }
}
function colorEstado(t) { return t === "OK" ? "var(--ok)" : t === "FUERA" ? "var(--danger)" : "#B7791F"; }

/* ---------- Importar / agregar a la lista (CSV NEZD) ---------- */
function abrirImportLista(lev, alTerminar) {
  const rep = esReplanteo(lev);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-sheet">
      <button class="close-x" id="impX" type="button">&times;</button>
      <h3>${rep ? "Puntos de diseño" : "Puntos de control"} (CSV NEZD)</h3>
      <p class="muted">Formato: <code>punto, N, E, Z, D</code> (D = descripción, opcional). Separador coma, punto y coma o tabulador. Puedes pegar el texto, cargar un archivo o escribir una línea a mano.</p>
      <label>Archivo CSV / TXT</label>
      <input type="file" id="impArchivo" accept=".csv,.txt,.tsv,text/plain,text/csv">
      <label>o pega / escribe aquí</label>
      <textarea id="impTexto" rows="7" placeholder="PR-1;6366412.318;344215.402;820.115;Pilar&#10;T-2,6366380.100,344260.500,819.900"></textarea>
      <p class="muted" id="impMsg"></p>
      <div class="modal-actions">
        <button class="btn btn-outline" type="button" id="impAgregar" style="flex:1;">Agregar / actualizar</button>
        <button class="btn btn-accent" type="button" id="impReemplazar" style="flex:1;">Reemplazar lista</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const cerrar = () => overlay.remove();
  overlay.querySelector("#impX").addEventListener("click", cerrar);
  overlay.querySelector("#impArchivo").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    overlay.querySelector("#impTexto").value = await f.text();
  });
  const aplicar = async (reemplazar) => {
    const r = parsearCsvNEZD(overlay.querySelector("#impTexto").value);
    if (!r.puntos.length) { overlay.querySelector("#impMsg").textContent = "No encontré puntos válidos (necesito al menos punto, N y E)."; return; }
    const lista = reemplazar ? [] : listaDe(lev).slice();
    r.puntos.forEach((np) => {
      const i = lista.findIndex((c) => c.nombre.trim().toLowerCase() === np.nombre.trim().toLowerCase());
      if (i >= 0) lista[i] = np; else lista.push(np);
    });
    if (rep) lev.diseno = lista; else lev.controles = lista;
    recalcularPlanilla(lev);
    await dbPut("levantamientos", lev);
    marcarPendienteSync(lev.jornadaId);
    cerrar();
    toast(r.puntos.length + " punto(s) cargado(s)" + (r.omitidas.length ? " · " + r.omitidas.length + " línea(s) omitida(s)" : ""));
    alTerminar();
  };
  overlay.querySelector("#impAgregar").addEventListener("click", () => aplicar(false));
  overlay.querySelector("#impReemplazar").addEventListener("click", () => {
    if (listaDe(lev).length && !confirm("Se reemplazará toda la lista actual. ¿Continuar?")) return;
    aplicar(true);
  });
}

function exportarCsvPlanilla(lev) {
  let filas;
  if (esReplanteo(lev)) {
    filas = lev.puntos.filter((p) => !isNaN(fl(p.valores.Nm))).map((p) => [p.valores.punto, p.valores.Nm, p.valores.Em, p.valores.Zm || "", ((p.valores.estadoTxt || "") + (p.valores.dH ? " dH=" + p.valores.dH + "mm" : "") + (p.valores.obs ? " " + p.valores.obs : "")).trim()]);
  } else {
    filas = lev.controles.map((c) => [c.nombre, fmtN(c.N), fmtN(c.E), fmtN(c.Z), c.D || ""]);
  }
  if (!filas.length) return toast("No hay datos para exportar.");
  const csv = filas.map((f) => f.map((x) => String(x == null ? "" : x).replace(/[;\r\n]/g, " ")).join(";")).join("\r\n");
  descargarTexto((esReplanteo(lev) ? "replanteo-medido" : "controles") + "-NEZD.csv", csv);
}

/* ---------- Formulario (agregar y editar comparten campos) ---------- */
function camposPlanillaHtml(lev, v) {
  v = v || {};
  const dl = `<datalist id="dlLista">${listaDe(lev).map((c) => `<option value="${escapeHtml(c.nombre)}">`).join("")}</datalist>`;
  const inp = (name, label, extra) => `<label>${label}</label><input type="${(extra && extra.t) || "number"}" ${(extra && extra.t) === "text" ? "" : 'step="any"'} name="${name}" value="${escapeHtml(v[name] ?? "")}" ${(extra && extra.list) ? 'list="dlLista" autocomplete="off"' : ""} ${(extra && extra.inputmode) ? `inputmode="${extra.inputmode}"` : ""}>`;
  const t = { t: "text", list: true };
  if (esReplanteo(lev)) {
    return dl + `
      ${inp("punto", "Punto a replantear", t)}
      <div class="row">
        <div>${inp("Nd", "N diseño (m)")}</div><div>${inp("Ed", "E diseño (m)")}</div><div>${inp("Zd", "Z diseño (m)")}</div>
      </div>
      <p class="muted" style="margin:10px 0 0;"><strong>Medido en terreno (as-built)</strong></p>
      <div class="row">
        <div>${inp("Nm", "N medido (m)")}</div><div>${inp("Em", "E medido (m)")}</div><div>${inp("Zm", "Z medido (m)")}</div>
      </div>
      <div class="plan-live" style="margin-top:8px; padding:10px 12px; border-radius:8px; font-size:13px; font-weight:600; display:none;"></div>
      ${inp("obs", "Observaciones", { t: "text" })}`;
  }
  return dl + `
    ${inp("estacion", "Estación (donde instalas)", t)}
    ${inp("alturaInstr", "Altura instrumento (m)")}
    <div class="plan-panel"></div>
    ${inp("calaje", "Calaje (punto de referencia)", t)}
    ${inp("hPrisma", "Altura prisma en calaje (m)")}
    <p class="muted" style="margin:10px 0 0;"><strong>Comprobación 1</strong> — coordenadas medidas</p>
    ${inp("comp1", "Punto de comprobación 1", t)}
    <div class="row"><div>${inp("c1N", "N medido")}</div><div>${inp("c1E", "E medido")}</div><div>${inp("c1Z", "Z medido")}</div></div>
    <p class="muted" style="margin:10px 0 0;"><strong>Comprobación 2</strong> — coordenadas medidas</p>
    ${inp("comp2", "Punto de comprobación 2", t)}
    <div class="row"><div>${inp("c2N", "N medido")}</div><div>${inp("c2E", "E medido")}</div><div>${inp("c2Z", "Z medido")}</div></div>
    <div class="plan-live" style="margin-top:8px; padding:10px 12px; border-radius:8px; font-size:13px; font-weight:600; display:none;"></div>
    ${inp("obs", "Observaciones", { t: "text" })}`;
}
function leerCamposPlanilla(lev, form) {
  const v = {};
  Array.from(form.elements).forEach((el) => { if (el.name) v[el.name] = el.value; });
  return v;
}

/* Comportamiento en vivo: plan de instalación, autollenado y semáforo */
function cablearFormPlanilla(lev, form) {
  const live = form.querySelector(".plan-live");
  const panel = form.querySelector(".plan-panel");
  const tol = lev.tolMm;
  function plan() {
    if (!panel) return;
    const est = buscarEnLista(lev, form.elements.estacion.value);
    if (!est) {
      panel.innerHTML = listaDe(lev).length ? '<p class="muted">Elige la estación de la lista para ver el plan de instalación.</p>' : '<p class="muted">Carga primero los puntos de control (botón «Importar / agregar») para recibir sugerencias.</p>';
      return;
    }
    const otros = lev.controles.filter((c) => c !== est).map((c) => ({ c, az: azimutGrados(est.N, est.E, c.N, c.E), d: distHoriz(est.N, est.E, c.N, c.E) })).sort((a, b) => a.d - b.d);
    panel.innerHTML = `<p class="muted" style="margin:8px 0 4px;"><strong>Plan desde ${escapeHtml(est.nombre)}</strong> (por cercanía; la visibilidad la confirmas en terreno)</p>
      <div class="table-wrap"><table><thead><tr><th></th><th>Punto</th><th>Azimut</th><th>Dist (m)</th></tr></thead><tbody>
      ${otros.map((o, i) => `<tr><td>${i === 0 ? "Calaje ▸" : i < 3 ? "Comprob. ▸" : ""}</td><td>${escapeHtml(o.c.nombre)}</td><td>${fmtAngulo(o.az, lev.angulos)}</td><td class="num">${o.d.toFixed(3)}</td></tr>`).join("")}
      </tbody></table></div>`;
    if (otros[0] && !form.elements.calaje.value) form.elements.calaje.value = otros[0].c.nombre;
    if (otros[1] && !form.elements.comp1.value) form.elements.comp1.value = otros[1].c.nombre;
    if (otros[2] && !form.elements.comp2.value) form.elements.comp2.value = otros[2].c.nombre;
  }
  function semaforo() {
    const v = leerCamposPlanilla(lev, form);
    const tmp = { ...lev, puntos: [{ valores: v }] };
    recalcularPlanilla(tmp);
    const r = tmp.puntos[0].valores;
    let txt;
    if (esReplanteo(lev)) {
      if (r.dH === "" || r.dH == null) { live.style.display = "none"; return; }
      txt = `ΔN ${r.dN} · ΔE ${r.dE} mm → dH ${r.dH} mm${r.dZ !== "" ? " · dZ " + r.dZ + " mm" : ""} (tol. ${tol} mm) — ${r.estadoTxt}`;
    } else {
      if (r.dH1 === "" && r.dH2 === "") { live.style.display = "none"; return; }
      txt = `Comprob. 1: ${r.dH1 === "" ? "—" : r.dH1 + " mm"}${r.dZ1 ? " (dZ " + r.dZ1 + ")" : ""} · Comprob. 2: ${r.dH2 === "" ? "—" : r.dH2 + " mm"}${r.dZ2 ? " (dZ " + r.dZ2 + ")" : ""} · tol. ${tol} mm — ${r.estadoTxt}`;
    }
    live.style.display = "block";
    live.style.color = colorEstado(r.estadoTxt);
    live.style.background = r.estadoTxt === "OK" ? "#EAF3EC" : r.estadoTxt === "FUERA" ? "#FBEAEA" : "#FBF3E1";
    live.textContent = txt;
  }
  function hints() {
    ["calaje", "comp1", "comp2"].forEach((n) => {
      const el = form.elements[n]; if (!el) return;
      let h = el.parentNode.querySelector(".hint-" + n);
      const c = buscarEnLista(lev, el.value);
      if (!h) { h = document.createElement("p"); h.className = "muted hint-" + n; h.style.margin = "2px 0 0"; el.insertAdjacentElement("afterend", h); }
      h.textContent = c ? `Control: N ${fmtN(c.N)} · E ${fmtN(c.E)} · Z ${c.Z == null ? "—" : fmtN(c.Z)}` : "";
    });
  }
  if (esReplanteo(lev)) {
    form.elements.punto.addEventListener("change", () => {
      const c = buscarEnLista(lev, form.elements.punto.value);
      if (c) { form.elements.Nd.value = c.N; form.elements.Ed.value = c.E; form.elements.Zd.value = c.Z == null ? "" : c.Z; }
      semaforo();
    });
  } else {
    form.elements.estacion.addEventListener("input", plan);
  }
  form.addEventListener("input", () => { semaforo(); hints(); });
  form.addEventListener("change", () => { semaforo(); hints(); });
  plan(); semaforo(); hints();
}

/* ---------- Pantalla principal de la planilla ---------- */
function renderPlanillaEnCurso(el, lev) {
  asegurarPlanilla(lev);
  const rep = esReplanteo(lev);
  const columnas = INSTRUMENTOS.estacion.tipos[lev.tipo].columnas;
  const lista = listaDe(lev);
  const medidos = new Set(lev.puntos.map((p) => String(p.valores.punto || "").trim().toLowerCase()));
  const resumen = { ok: 0, fuera: 0 };
  lev.puntos.forEach((p) => { if (p.valores.estadoTxt === "OK") resumen.ok++; else if (p.valores.estadoTxt === "FUERA") resumen.fuera++; });

  el.innerHTML = `
    <div class="card">
      <h2><span class="num">${lev.puntos.length + 1}</span>Estación Total — ${escapeHtml(lev.tipoNombre)}</h2>
      <p class="muted">${lev.equipo ? escapeHtml(lev.equipo) : "Sin equipo especificado"} · iniciado ${fmtHoraCorta(lev.fechaInicio)}</p>
      <button class="btn btn-outline btn-sm" type="button" style="margin-top:6px;" onclick="abrirEditorLevantamiento('${lev.id}')">✏️ Editar datos del levantamiento</button>
      <div class="divider"></div>
      <div class="row">
        <div><label>Norma</label>
          <select id="plNorma">${Object.keys(NORMAS).map((k) => `<option value="${k}" ${normaDe(lev) === k ? "selected" : ""}>${escapeHtml(NORMAS[k].nombre)}</option>`).join("")}</select></div>
        <div><label>Tolerancia (mm)</label><input type="number" step="any" id="plTol" value="${lev.tolMm}"></div>
        <div><label>Ángulos</label>
          <select id="plAng"><option value="sexa" ${lev.angulos === "sexa" ? "selected" : ""}>Sexagesimal</option><option value="cent" ${lev.angulos === "cent" ? "selected" : ""}>Centesimal</option></select></div>
      </div>
      <p class="preview-note">ℹ️ ${rep ? "MOP 2.307.203: replanteo horizontal ±10 cm (100 mm), valor por defecto." : "La tolerancia de las comprobaciones la eliges aquí (20 mm sugerido; el MOP no fija un valor para instalaciones)."} ${normaDe(lev) !== "MOP" ? "Con esta norma defines tú el valor." : ""}</p>
      <div class="divider"></div>
      <p class="muted" style="margin-bottom:6px;"><strong>${rep ? "Puntos de diseño" : "Puntos de control"}:</strong> ${lista.length}${rep && lista.length ? ` · medidos ${lista.filter((c) => medidos.has(c.nombre.trim().toLowerCase())).length}` : ""}</p>
      <div class="row" style="gap:8px;">
        <button class="btn btn-outline btn-sm" type="button" id="plImportar" style="flex:1;">⬆️ Importar / agregar (CSV NEZD)</button>
        <button class="btn btn-outline btn-sm" type="button" id="plExportar" style="flex:1;">⬇️ Exportar CSV NEZD</button>
      </div>
      ${lista.length ? `<details style="margin-top:8px;"><summary>Ver lista</summary>
        <div class="table-wrap"><table><thead><tr><th>Punto</th><th>N</th><th>E</th><th>Z</th><th>D</th></tr></thead><tbody>
        ${lista.map((c) => `<tr><td>${medidos.has(c.nombre.trim().toLowerCase()) ? "✓ " : ""}${escapeHtml(c.nombre)}</td><td class="num">${fmtN(c.N)}</td><td class="num">${fmtN(c.E)}</td><td class="num">${fmtN(c.Z)}</td><td>${escapeHtml(c.D || "")}</td></tr>`).join("")}
        </tbody></table></div></details>` : ""}
    </div>

    <div class="card">
      <h2>${rep ? "Registrar punto replanteado" : "Registrar instalación"}</h2>
      <form id="formPlanilla">
        ${camposPlanillaHtml(lev)}
        <div class="divider"></div>
        <button class="btn btn-accent" type="submit">${rep ? "Agregar punto" : "Agregar instalación"}</button>
      </form>
    </div>

    <div class="card">
      <h2>${rep ? "Puntos registrados" : "Instalaciones registradas"} (${lev.puntos.length})</h2>
      ${lev.puntos.length ? `<p class="muted">OK: ${resumen.ok} · Fuera de tolerancia: ${resumen.fuera}</p>` : ""}
      ${lev.puntos.length === 0 ? `<p class="muted">Aún no hay registros.</p>` : `
      <div class="table-wrap"><table>
        <thead><tr>${columnas.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}<th>Hora</th><th></th></tr></thead>
        <tbody>${lev.puntos.map((p, i) => `<tr>
          ${columnas.map((c) => {
            const val = escapeHtml(p.valores[c.key] ?? "");
            const est = c.key === "estadoTxt" ? `style="color:${colorEstado(p.valores.estadoTxt)}; font-weight:700;"` : "";
            return `<td class="${c.tipo === "number" ? "num" : ""}" ${est}>${val}</td>`;
          }).join("")}
          <td>${fmtHoraCorta(p.timestamp)}</td>
          <td style="white-space:nowrap;"><button class="btn btn-outline btn-sm" onclick="abrirEditorPunto('${lev.id}', ${i})" type="button">✏️</button> <button class="btn btn-outline btn-sm" onclick="eliminarPunto('${lev.id}', ${i})" type="button">✕</button></td>
        </tr>`).join("")}</tbody>
      </table></div>`}
      <div class="divider"></div>
      <button class="btn btn-outline danger" id="btnFinalizarLevantamiento" type="button">Finalizar levantamiento</button>
    </div>`;

  const guardarYRefrescar = async () => {
    recalcularPlanilla(lev);
    await dbPut("levantamientos", lev);
    marcarPendienteSync(lev.jornadaId);
    renderTabActual();
  };
  el.querySelector("#plNorma").addEventListener("change", (e) => {
    lev.norma = e.target.value;
    if (lev.norma === "MOP" && rep) lev.tolMm = TOL_REPLANTEO_MM_MOP;
    guardarYRefrescar();
  });
  el.querySelector("#plTol").addEventListener("change", (e) => {
    const t = parseFloat(e.target.value);
    if (isNaN(t) || t <= 0) return toast("Tolerancia inválida.");
    lev.tolMm = t; guardarYRefrescar();
  });
  el.querySelector("#plAng").addEventListener("change", (e) => { lev.angulos = e.target.value; guardarYRefrescar(); });
  el.querySelector("#plImportar").addEventListener("click", () => abrirImportLista(lev, () => renderTabActual()));
  el.querySelector("#plExportar").addEventListener("click", () => exportarCsvPlanilla(lev));

  const form = el.querySelector("#formPlanilla");
  cablearFormPlanilla(lev, form);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = leerCamposPlanilla(lev, form);
    if (rep && (!String(v.punto).trim() || isNaN(fl(v.Nd)) || isNaN(fl(v.Ed)))) return toast("Indica el punto y sus coordenadas de diseño N, E.");
    if (!rep && !String(v.estacion).trim()) return toast("Indica la estación.");
    lev.puntos.push({ id: uuid(), numero: lev.puntos.length + 1, valores: v, foto: null, lat: null, lng: null, ubicFuente: null, timestamp: nowISO() });
    recalcularPlanilla(lev);
    const p = lev.puntos[lev.puntos.length - 1];
    await dbPut("levantamientos", lev);
    marcarPendienteSync(lev.jornadaId);
    toast((rep ? "Punto " : "Instalación ") + p.numero + " — " + p.valores.estadoTxt);
    renderTabActual();
  });
  el.querySelector("#btnFinalizarLevantamiento").addEventListener("click", async () => {
    if (lev.puntos.length === 0 && !confirm("No hay registros. ¿Finalizar de todas formas?")) return;
    lev.estado = "cerrado"; lev.fechaFin = nowISO();
    await dbPut("levantamientos", lev);
    state.levantamientoActivoId = null;
    marcarPendienteSync(lev.jornadaId);
    toast("Levantamiento finalizado");
    renderTabActual();
  });
}

function abrirEditorPlanilla(levId, index) {
  const lev = state.levantamientos.find((l) => l.id === levId);
  if (!lev || !lev.puntos[index]) return;
  asegurarPlanilla(lev);
  const p = lev.puntos[index];
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-sheet">
      <button class="close-x" id="edPlX" type="button">&times;</button>
      <h3>Editar ${esReplanteo(lev) ? "punto" : "instalación"} ${p.numero}</h3>
      <div class="divider"></div>
      <form id="formEditarPlanilla">
        ${camposPlanillaHtml(lev, p.valores)}
        <div class="modal-actions">
          <button class="btn btn-outline" type="button" id="edPlCancelar" style="flex:1;">Cancelar</button>
          <button class="btn btn-accent" type="submit" style="flex:1;">Guardar cambios</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  const cerrar = () => overlay.remove();
  overlay.querySelector("#edPlX").addEventListener("click", cerrar);
  overlay.querySelector("#edPlCancelar").addEventListener("click", cerrar);
  const form = overlay.querySelector("#formEditarPlanilla");
  cablearFormPlanilla(lev, form);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    Object.assign(p.valores, leerCamposPlanilla(lev, form));
    p.editado = nowISO();
    recalcularPlanilla(lev);
    await dbPut("levantamientos", lev);
    marcarPendienteSync(lev.jornadaId);
    cerrar();
    toast("Registro " + p.numero + " actualizado");
    renderTabActual();
  });
}
window.abrirEditorPlanilla = abrirEditorPlanilla;
