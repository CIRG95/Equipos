"use strict";

/* =========================================================================
   TAB: LEVANTAMIENTO
   ========================================================================= */
/* Recalcula en cadena todos los tramos de una Nivelación Cerrada a doble
   posición: desniveles, error entre posiciones y cota acumulada. Se llama
   siempre que se agrega o se borra un tramo, para que un tramo eliminado
   a mitad de camino no deje cotas desactualizadas en los siguientes. */
function recalcularTramosCerrada(lev) {
  let cotaAnterior = lev.cotaPartida;
  for (const p of lev.puntos) {
    const v = p.valores;
    const atras1 = parseFloat(v.atras1), adelante1 = parseFloat(v.adelante1);
    const atras2 = parseFloat(v.atras2), adelante2 = parseFloat(v.adelante2);
    const desnivel1 = atras1 - adelante1;   // Desnivel = Lect. Atrás − Lect. Adelante
    const desnivel2 = atras2 - adelante2;
    const desnivelAceptado = (desnivel1 + desnivel2) / 2;
    const errorTramoMm = (desnivel1 - desnivel2) * 1000;
    cotaAnterior = cotaAnterior + desnivelAceptado;
    v.desnivel1 = desnivel1.toFixed(4);
    v.desnivel2 = desnivel2.toFixed(4);
    v.errorTramoMm = errorTramoMm.toFixed(1);
    v.desnivelAceptado = desnivelAceptado.toFixed(4);
    v.cota = cotaAnterior.toFixed(4);
  }
}

/* Resumen de una Nivelación Cerrada: distancia total recorrida, y si el
   último tramo llega al punto final declarado, la cota calculada ahí.
   Si además el punto final es el mismo que el de partida (vuelta real al
   mismo BM), se compara el error de cierre contra la tolerancia. Si son
   puntos distintos (enlace entre dos PR), solo se informa la cota final
   calculada, porque no hay una cota de referencia contra la cual comparar. */
function calcularCierreNivelacion(lev) {
  const distanciaTotalM = lev.puntos.reduce((acc, p) => acc + (parseFloat(p.valores.distancia) || 0), 0);
  const ultimo = lev.puntos[lev.puntos.length - 1];
  const destino = lev.puntoFinal || lev.puntoPartida;
  const llego = !!(ultimo && ultimo.valores.puntoAdelante && destino &&
    ultimo.valores.puntoAdelante.trim().toLowerCase() === destino.trim().toLowerCase());
  const esLoopReal = destino.trim().toLowerCase() === lev.puntoPartida.trim().toLowerCase();

  let errorCierreMm = null, toleranciaMm = null, dentroDeTolerancia = null, cotaFinalCalculada = null;
  if (llego) {
    cotaFinalCalculada = parseFloat(ultimo.valores.cota);
    if (esLoopReal) {
      errorCierreMm = (cotaFinalCalculada - lev.cotaPartida) * 1000;
      toleranciaMm = toleranciaNivelacionMm(lev, distanciaTotalM / 1000);
      dentroDeTolerancia = Math.abs(errorCierreMm) <= toleranciaMm;
    }
  }
  return {
    distanciaTotalM, llego, esLoopReal, cotaFinalCalculada, errorCierreMm, toleranciaMm, dentroDeTolerancia,
    cotaActual: lev.puntos.length ? parseFloat(ultimo.valores.cota) : lev.cotaPartida
  };
}

function renderLevantamiento() {
  const el = document.getElementById("tab-levantamiento");
  const j = jornadaActiva();
  const lev = levantamientoActivo();

  if (!j) {
    el.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
        <p><strong>No hay jornada activa</strong></p>
        <p class="muted">Inicia una jornada en la pestaña "Jornada" antes de registrar un levantamiento.</p>
      </div>`;
    return;
  }

  if (lev) {
    if (lev.instrumento === "nivel" && lev.tipo === "cerrada") renderNivelacionCerradaEnCurso(el, lev);
    else if (esCatastro(lev)) renderCatastroEnCurso(el, lev);
    else if (esPlanilla(lev)) renderPlanillaEnCurso(el, lev);
    else renderLevantamientoEnCurso(el, lev);
    agregarFotosReq(el, lev);
    try { agregarResumenTelefono(el, lev); } catch (e) { console.error(e); }
    return;
  }

  // Selector de instrumento / tipo + vista previa
  el.innerHTML = `
    <div class="card">
      <h2>Nuevo levantamiento</h2>
      <label>Instrumento</label>
      <select id="selInstrumento"></select>
      <label>Tipo de levantamiento</label>
      <select id="selTipo"></select>
      <label>Equipo utilizado</label>
      <input type="text" id="inpEquipo" placeholder="Ej: Nivel Leica NA324, N° serie 12345">
      <div id="wrapCerradaInicio" style="display:none;">
        <div class="divider"></div>
        <p class="muted" style="margin-bottom:8px;"><strong>Punto de partida (BM)</strong></p>
        <label>Código del punto de partida</label>
        <input type="text" id="inpPuntoPartida" placeholder="Ej: PR-1">
        <label>Cota de partida (m)</label>
        <input type="number" step="any" id="inpCotaPartida" placeholder="Ej: 100.000">
        <label>Código del punto final</label>
        <input type="text" id="inpPuntoFinal" placeholder="Ej: PR-2 (o el mismo PR-1 si vuelves a cerrar ahí)">
        <label>Norma</label>
        <select id="inpNorma">${Object.keys(NORMAS).map((k) => `<option value="${k}">${escapeHtml(NORMAS[k].nombre)}</option>`).join("")}</select>
        <div id="wrapClase">
          <label>Clase de nivelación</label>
          <div class="row" id="btnsClase" style="gap:8px;">
            ${Object.keys(NIVELACION_CLASES).map((k) => `<button type="button" class="btn btn-sm btn-outline" data-clase="${k}" style="flex:1;">${NIVELACION_CLASES[k].nombre}</button>`).join("")}
          </div>
          <p class="preview-note" id="claseInfo"></p>
        </div>
        <div id="wrapK" style="display:none;">
          <label>Tolerancia k (mm por √km)</label>
          <input type="number" step="any" id="inpK" value="${state.config.tolerancia.k}">
        </div>
        <p class="preview-note">ℹ️ La cota del punto final se calcula sola al llegar — no hace falta que la sepas de antemano. Si el punto final es el mismo que el de partida, además se compara contra la tolerancia de cierre.</p>
      </div>
      <div class="divider"></div>
      <p class="muted" style="margin-bottom:8px;"><strong>Vista previa de la planilla</strong></p>
      <div class="table-wrap"><table id="previewTabla"><thead></thead><tbody></tbody></table></div>
      <p class="preview-note">ℹ️ Además de estas columnas, cada punto guarda automáticamente hora, ubicación GPS y una foto del comprobante o hito.</p>
      <div class="divider"></div>
      <button class="btn btn-accent" id="btnIniciarLevantamiento" type="button">Iniciar levantamiento</button>
    </div>
  `;

  const selInstrumento = document.getElementById("selInstrumento");
  const selTipo = document.getElementById("selTipo");
  Object.keys(INSTRUMENTOS).forEach((key) => {
    const opt = document.createElement("option");
    opt.value = key; opt.textContent = INSTRUMENTOS[key].nombre;
    selInstrumento.appendChild(opt);
  });

  function esCerradaDoble() {
    return selInstrumento.value === "nivel" && selTipo.value === "cerrada";
  }
  function poblarTipos() {
    const instr = INSTRUMENTOS[selInstrumento.value];
    selTipo.innerHTML = "";
    Object.keys(instr.tipos).forEach((key) => {
      const opt = document.createElement("option");
      opt.value = key; opt.textContent = instr.tipos[key].nombre;
      selTipo.appendChild(opt);
    });
    actualizarPreview();
  }
  function actualizarPreview() {
    const instr = INSTRUMENTOS[selInstrumento.value];
    const tipo = instr.tipos[selTipo.value];
    const thead = document.querySelector("#previewTabla thead");
    const tbody = document.querySelector("#previewTabla tbody");
    thead.innerHTML = "<tr>" + tipo.columnas.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("") +
      "<th>Foto</th><th>Hora</th><th>Ubicación</th></tr>";
    tbody.innerHTML = "<tr>" + tipo.columnas.map(() => `<td class="muted">…</td>`).join("") +
      `<td class="muted">📷</td><td class="muted">…</td><td class="muted">…</td></tr>`;
    document.getElementById("wrapCerradaInicio").style.display = esCerradaDoble() ? "" : "none";
  }
  selInstrumento.addEventListener("change", poblarTipos);
  selTipo.addEventListener("change", actualizarPreview);
  poblarTipos();
  if (state.preseleccionLev && INSTRUMENTOS[state.preseleccionLev.instrumento]) {
    selInstrumento.value = state.preseleccionLev.instrumento; poblarTipos();
    if (INSTRUMENTOS[selInstrumento.value].tipos[state.preseleccionLev.tipo]) selTipo.value = state.preseleccionLev.tipo;
    actualizarPreview();
    state.preseleccionLev = null;
  }

  let claseSel = NIVELACION_CLASE_DEFAULT;
  function pintarClase() {
    const mop = document.getElementById("inpNorma").value === "MOP";
    document.getElementById("wrapClase").style.display = mop ? "" : "none";
    document.getElementById("wrapK").style.display = mop ? "none" : "";
    document.querySelectorAll("#btnsClase button").forEach((b) => {
      b.className = "btn btn-sm " + (b.dataset.clase === claseSel ? "btn-accent" : "btn-outline");
    });
    const c = NIVELACION_CLASES[claseSel];
    document.getElementById("claseInfo").textContent = "MOP " + c.nombre + ": cierre ±" + String(c.k).replace(".", ",") + "·√K mm (K en km) · puntos de cambio ≥ " + c.pcMinM + " m · cierre máx. " + c.cierreMaxM + " m · " + c.uso + ".";
  }
  document.querySelectorAll("#btnsClase button").forEach((b) => b.addEventListener("click", () => { claseSel = b.dataset.clase; pintarClase(); }));
  document.getElementById("inpNorma").addEventListener("change", pintarClase);
  pintarClase();

  document.getElementById("btnIniciarLevantamiento").addEventListener("click", async () => {
    const instrKey = selInstrumento.value;
    const tipoKey = selTipo.value;
    if (esCerradaDoble()) {
      const pp = document.getElementById("inpPuntoPartida").value.trim();
      const cp = document.getElementById("inpCotaPartida").value.trim();
      const pf = document.getElementById("inpPuntoFinal").value.trim();
      if (!pp || cp === "" || !pf) return toast("Ingresa punto de partida, cota de partida y punto final.");
    }
    const nuevo = {
      id: uuid(),
      jornadaId: j.id,
      instrumento: instrKey,
      instrumentoNombre: INSTRUMENTOS[instrKey].nombre,
      tipo: tipoKey,
      tipoNombre: INSTRUMENTOS[instrKey].tipos[tipoKey].nombre,
      equipo: document.getElementById("inpEquipo").value.trim(),
      fechaInicio: nowISO(),
      fechaFin: null,
      estado: "en_curso",
      puntos: []
    };
    if (esCerradaDoble()) {
      nuevo.puntoPartida = document.getElementById("inpPuntoPartida").value.trim();
      nuevo.cotaPartida = parseFloat(document.getElementById("inpCotaPartida").value);
      nuevo.puntoFinal = document.getElementById("inpPuntoFinal").value.trim();
      nuevo.norma = document.getElementById("inpNorma").value;
      if (nuevo.norma === "MOP") nuevo.clase = claseSel;
      else { nuevo.clase = "personal"; nuevo.kPersonal = parseFloat(document.getElementById("inpK").value) || state.config.tolerancia.k; }
    }
    await dbPut("levantamientos", nuevo);
    state.levantamientos.push(nuevo);
    state.levantamientoActivoId = nuevo.id;
    marcarPendienteSync(nuevo.jornadaId);
    toast("Levantamiento iniciado");
    renderTabActual();
  });
}

/* Arma la lista de puntos a graficar en el perfil: el de partida, cada
   tramo agregado (con su cota real ya calculada), y si aún no se llegó
   al punto final declarado, un marcador "pendiente" a la derecha. */
function construirPuntosPerfil(lev) {
  const puntos = [{ label: lev.puntoPartida, cota: lev.cotaPartida, dist: 0, extremo: true }];
  let distAcum = 0;
  lev.puntos.forEach((p) => {
    distAcum += parseFloat(p.valores.distancia) || 0;
    const esFinal = lev.puntoFinal && p.valores.puntoAdelante &&
      p.valores.puntoAdelante.trim().toLowerCase() === lev.puntoFinal.trim().toLowerCase();
    puntos.push({ label: p.valores.puntoAdelante, cota: parseFloat(p.valores.cota), dist: distAcum, extremo: esFinal });
  });
  const yaLlego = puntos.some((pt, i) => i > 0 && pt.extremo);
  if (!yaLlego && lev.puntoFinal) {
    puntos.push({ label: lev.puntoFinal, cota: null, dist: distAcum > 0 ? distAcum * 1.3 : 100, extremo: true, pendiente: true });
  }
  return puntos;
}

/* Dibuja el perfil de elevación en vivo: eje horizontal = distancia
   acumulada, eje vertical = cota. Se regenera completo en cada render,
   así que siempre refleja el estado actual de los tramos guardados. */
function svgPerfilNivelacion(lev) {
  const puntos = construirPuntosPerfil(lev);
  const w = 320, h = 160, mL = 40, mR = 16, mT = 20, mB = 30;
  const distMax = Math.max(puntos[puntos.length - 1].dist, 1);
  const cotasConocidas = puntos.filter((p) => p.cota != null).map((p) => p.cota);
  let minCota = Math.min(...cotasConocidas), maxCota = Math.max(...cotasConocidas);
  if (minCota === maxCota) { minCota -= 1; maxCota += 1; }
  const rango = maxCota - minCota;
  minCota -= rango * 0.2; maxCota += rango * 0.2;

  const x = (d) => mL + (d / distMax) * (w - mL - mR);
  const y = (c) => h - mB - ((c - minCota) / (maxCota - minCota)) * (h - mT - mB);
  const yPendiente = y(cotasConocidas[cotasConocidas.length - 1]);

  let path = "";
  puntos.forEach((p, i) => {
    const px = x(p.dist), py = p.cota != null ? y(p.cota) : yPendiente;
    path += (i === 0 ? "M" : "L") + px.toFixed(1) + "," + py.toFixed(1) + " ";
  });

  const grid = [minCota + rango * 0.2, (minCota + maxCota) / 2, maxCota - rango * 0.2].map((c) => {
    const py = y(c);
    return `<line x1="${mL}" y1="${py.toFixed(1)}" x2="${w - mR}" y2="${py.toFixed(1)}" stroke="var(--line)" stroke-dasharray="2,3"/>` +
      `<text x="${mL - 4}" y="${(py + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--muted)">${c.toFixed(1)}</text>`;
  }).join("");

  const marcadores = puntos.map((p) => {
    const px = x(p.dist), py = p.cota != null ? y(p.cota) : yPendiente;
    if (p.extremo && p.pendiente) {
      return `<circle cx="${px}" cy="${py}" r="7" fill="none" stroke="var(--accent)" stroke-dasharray="2,2" stroke-width="1.5"/>` +
        `<text x="${px}" y="${(py - 12).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--accent)" font-weight="700">${escapeHtml(p.label || "?")}</text>`;
    }
    if (p.extremo) {
      return `<path d="M${(px - 6).toFixed(1)},${(py - 6).toFixed(1)} L${(px + 6).toFixed(1)},${(py + 6).toFixed(1)} M${(px - 6).toFixed(1)},${(py + 6).toFixed(1)} L${(px + 6).toFixed(1)},${(py - 6).toFixed(1)}" stroke="var(--danger)" stroke-width="2.5"/>` +
        `<text x="${px}" y="${(py - 12).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--danger)" font-weight="700">${escapeHtml(p.label || "")}</text>` +
        `<text x="${px}" y="${(py + 22).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--muted)" font-family="var(--mono)">${p.cota.toFixed(3)}</text>`;
    }
    return `<path d="M${px.toFixed(1)},${(py - 6).toFixed(1)} L${(px + 6).toFixed(1)},${(py + 5).toFixed(1)} L${(px - 6).toFixed(1)},${(py + 5).toFixed(1)} Z" fill="var(--primary)"/>` +
      `<text x="${px}" y="${(py - 11).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--primary-dark)">${escapeHtml(p.label || "")}</text>`;
  }).join("");

  return `<div class="table-wrap" style="padding:6px 4px;"><svg viewBox="0 0 ${w} ${h}" style="width:100%; display:block;">` +
    grid + `<path d="${path.trim()}" fill="none" stroke="var(--primary)" stroke-width="2"/>` + marcadores + `</svg></div>`;
}

function renderCotasCompensadas(lev) {
  const comp = compensarNivelacion(lev);
  if (!comp) return "";
  return `<details style="margin-top:6px;"><summary>Cotas compensadas (partes iguales)</summary>
    <div class="table-wrap"><table><thead><tr><th>Punto</th><th>Cota obs. (m)</th><th>Corr. (mm)</th><th>Cota comp. (m)</th></tr></thead><tbody>
    ${comp.map((c) => `<tr><td>${escapeHtml(c.punto || "")}</td><td class="num">${c.cotaObs.toFixed(4)}</td><td class="num">${c.corrMm.toFixed(1)}</td><td class="num"><strong>${c.cotaComp.toFixed(4)}</strong></td></tr>`).join("")}
    </tbody></table></div></details>`;
}

function renderNivelacionCerradaEnCurso(el, lev) {
  const columnas = INSTRUMENTOS.nivel.tipos.cerrada.columnas;
  const cierre = calcularCierreNivelacion(lev);
  const puntoAtrasSugerido = lev.puntos.length
    ? lev.puntos[lev.puntos.length - 1].valores.puntoAdelante
    : lev.puntoPartida;

  el.innerHTML = `
    <div class="card">
      <h2>Perfil de la nivelación</h2>
      <p class="muted" style="margin-bottom:8px;">${escapeHtml(lev.puntoPartida)} → ${escapeHtml(lev.puntoFinal)} · ${lev.puntos.length} tramo${lev.puntos.length === 1 ? "" : "s"}</p>
      ${svgPerfilNivelacion(lev)}
    </div>

    <div class="card">
      <h2><span class="num">${lev.puntos.length + 1}</span>Nivelación Cerrada — doble posición</h2>
      <p class="muted">${lev.equipo ? escapeHtml(lev.equipo) : "Sin equipo especificado"} · iniciado ${fmtHoraCorta(lev.fechaInicio)}</p>
      <button class="btn btn-outline btn-sm" type="button" style="margin-top:6px;" onclick="abrirEditorLevantamiento('${lev.id}')">✏️ Editar datos del levantamiento</button>
      <div class="divider"></div>
      <div class="row">
        <div><p class="muted" style="margin-bottom:2px;">Punto partida</p><p style="font-family:var(--mono); font-weight:700;">${escapeHtml(lev.puntoPartida)} (${lev.cotaPartida.toFixed(4)} m)</p></div>
        <div><p class="muted" style="margin-bottom:2px;">Cota actual</p><p style="font-family:var(--mono); font-weight:700;">${cierre.cotaActual.toFixed(4)} m</p></div>
        <div><p class="muted" style="margin-bottom:2px;">Distancia acumulada</p><p style="font-family:var(--mono); font-weight:700;">${cierre.distanciaTotalM.toFixed(1)} m</p></div>
      </div>
      ${cierre.llego && cierre.esLoopReal ? `
        <div class="divider"></div>
        <p class="muted" style="margin-bottom:4px;"><strong>Cierre detectado</strong> (el último tramo vuelve a ${escapeHtml(lev.puntoPartida)})</p>
        <div class="rs-estado ${cierre.dentroDeTolerancia ? "ok" : "mal"}">
          Error de cierre: ${cierre.errorCierreMm.toFixed(1)} mm — tolerancia ±${cierre.toleranciaMm.toFixed(1)} mm — ${cierre.dentroDeTolerancia ? "✓ DENTRO DE TOLERANCIA" : "✕ FUERA DE TOLERANCIA"}
        </div>
        <p class="preview-note">Norma: ${escapeHtml(textoToleranciaNivelacion(lev))}${lev.clase && NIVELACION_CLASES[lev.clase] && normaDe(lev) === "MOP" && cierre.distanciaTotalM > NIVELACION_CLASES[lev.clase].cierreMaxM ? ` · ⚠ supera el largo de cierre sugerido (${NIVELACION_CLASES[lev.clase].cierreMaxM} m)` : ""}</p>
        ${cierre.dentroDeTolerancia ? renderCotasCompensadas(lev) : `<p class="preview-note">No se compensa: el cierre está fuera de tolerancia (MOP: repetir o revisar).</p>`}
      ` : ""}
      ${cierre.llego && !cierre.esLoopReal ? `
        <div class="divider"></div>
        <p class="muted" style="margin-bottom:4px;"><strong>Llegada a ${escapeHtml(lev.puntoFinal)}</strong></p>
        <div class="rs-estado ok">Cota calculada: ${cierre.cotaFinalCalculada.toFixed(4)} m</div>
        <p class="preview-note">ℹ️ Como es un enlace entre dos puntos distintos, no hay error de cierre que calcular — solo la cota final.</p>
      ` : ""}
      <div class="divider"></div>
      <form id="formTramo">
        <label>Punto Atrás</label>
        <input type="text" name="puntoAtras" value="${escapeHtml(puntoAtrasSugerido || "")}">
        <label>Punto Adelante</label>
        <input type="text" name="puntoAdelante" placeholder="Ej: PC-1 (o el punto de partida si cierra acá)">
        <label>Distancia del tramo (m)</label>
        <input type="number" step="any" name="distancia">
        <div class="divider"></div>
        <p class="muted" style="margin-bottom:4px;"><strong>Posición 1</strong></p>
        <div class="row">
          <div><label>Lect. Atrás (m)</label><input type="number" step="any" name="atras1"></div>
          <div><label>Lect. Adelante (m)</label><input type="number" step="any" name="adelante1"></div>
        </div>
        <p class="muted" style="margin:12px 0 4px;"><strong>Posición 2</strong></p>
        <div class="row">
          <div><label>Lect. Atrás (m)</label><input type="number" step="any" name="atras2"></div>
          <div><label>Lect. Adelante (m)</label><input type="number" step="any" name="adelante2"></div>
        </div>
        <div id="semaforoTramo" style="display:none; margin-top:10px; padding:10px 12px; border-radius:8px; font-size:13px; font-weight:600;"></div>
        <label>Observaciones</label>
        <input type="text" name="obs">
        <label>Foto (comprobante / hito)</label>
        ${selectorFotoHtml("inpFoto")}
        <div id="fotoPreviewWrap" style="margin-top:8px;"></div>
        <label>Ubicación del punto</label>
        <div class="row" style="align-items:center;">
          <span class="muted" id="puntoUbicText" style="flex:2;">Capturando GPS…</span>
          <button class="btn btn-outline btn-sm" type="button" id="btnRecapturarUbic" style="flex:1;">🗺️ Ajustar</button>
        </div>
        <div class="divider"></div>
        <button class="btn btn-accent" type="submit">Agregar tramo</button>
      </form>
    </div>

    <div class="card">
      <h2>Tramos registrados (${lev.puntos.length})</h2>
      ${lev.puntos.length === 0 ? `<p class="muted">Aún no hay tramos.</p>` : `
      <div class="table-wrap"><table>
        <thead><tr>${columnas.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}<th>Foto</th><th>Hora</th><th></th></tr></thead>
        <tbody>
          ${lev.puntos.map((p, i) => {
            const errMm = parseFloat(p.valores.errorTramoMm);
            const nivel = clasificarErrorTramo(errMm);
            return `
            <tr>
              ${columnas.map((c) => {
                const val = escapeHtml(p.valores[c.key] ?? "");
                const estilo = c.key === "errorTramoMm" ? `style="color:${colorNivel(nivel)}; font-weight:700;"` : "";
                return `<td class="${c.tipo === "number" ? "num" : ""}" ${estilo}>${val}</td>`;
              }).join("")}
              <td>${p.foto ? `<img src="${p.foto}" class="thumb" style="width:34px;height:34px;" onclick="verFoto('${p.foto}')">` : "—"}</td>
              <td>${fmtHoraCorta(p.timestamp)}</td>
              <td style="white-space:nowrap;"><button class="btn btn-outline btn-sm" onclick="abrirEditorPunto('${lev.id}', ${i})" type="button">✏️</button> <button class="btn btn-outline btn-sm" onclick="eliminarPunto('${lev.id}', ${i})" type="button">✕</button></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table></div>`}
      <div class="divider"></div>
      <button class="btn btn-outline danger" id="btnFinalizarLevantamiento" type="button">Finalizar levantamiento</button>
    </div>
  `;

  let ubicPunto = null;
  let ubicFuente = null;
  getUbicacionActual().then((pos) => {
    if (ubicFuente) return;
    ubicPunto = pos;
    ubicFuente = pos ? "gps" : null;
    const t = document.getElementById("puntoUbicText");
    if (t) t.textContent = pos ? fmtCoord(pos.lat, pos.lng) + " · GPS" : "GPS no disponible — usa 'Ajustar'";
  });
  document.getElementById("btnRecapturarUbic").addEventListener("click", () => {
    abrirMapModal(ubicPunto?.lat, ubicPunto?.lng, (pos) => {
      ubicPunto = pos;
      ubicFuente = "mapa";
      document.getElementById("puntoUbicText").textContent = fmtCoord(pos.lat, pos.lng) + " · mapa (manual)";
    });
  });

  let fotoDataUrl = null;
  wireSelectorFoto(el, "inpFoto", async (file, origen) => {
    const ubicText = document.getElementById("puntoUbicText");
    if (ubicText) ubicText.innerHTML = '<span class="spinner"></span> Procesando foto…';
    let r;
    try { r = await leerFotoArchivo(file); } catch (_) { toast("No se pudo leer la imagen"); return; }
    fotoDataUrl = r.dataUrl;
    document.getElementById("fotoPreviewWrap").innerHTML = `<img src="${fotoDataUrl}" class="thumb" style="width:90px;height:90px;">`;
    if (r.gps) {
      ubicPunto = r.gps; ubicFuente = "foto";
      if (ubicText) ubicText.textContent = fmtCoord(r.gps.lat, r.gps.lng) + " · metadatos de la foto";
    } else if (origen === "archivo" && ubicPunto) {
      // Foto subida desde la galería sin ubicación: no se pisa la que ya había
      if (ubicText) ubicText.textContent = fmtCoord(ubicPunto.lat, ubicPunto.lng) + " · " + (ubicFuente === "mapa" ? "mapa (manual)" : "GPS") + " (la foto no trae ubicación)";
    } else {
      const pos = await getUbicacionActual();
      if (pos) { ubicPunto = pos; ubicFuente = "gps"; if (ubicText) ubicText.textContent = fmtCoord(pos.lat, pos.lng) + " · GPS al momento de la foto"; }
      else if (ubicText) ubicText.textContent = "Sin ubicación — usa 'Ajustar'";
    }
  });

  // Semáforo en vivo: apenas están las 4 lecturas, calcula y muestra el color
  const form = document.getElementById("formTramo");
  const semaforoEl = document.getElementById("semaforoTramo");
  function actualizarSemaforoVivo() {
    const a1 = form.elements.atras1.value, d1 = form.elements.adelante1.value;
    const a2 = form.elements.atras2.value, d2 = form.elements.adelante2.value;
    if (a1 === "" || d1 === "" || a2 === "" || d2 === "") {
      semaforoEl.style.display = "none";
      return;
    }
    const desnivel1 = parseFloat(a1) - parseFloat(d1);
    const desnivel2 = parseFloat(a2) - parseFloat(d2);
    const errorMm = (desnivel1 - desnivel2) * 1000;
    const nivel = clasificarErrorTramo(errorMm);
    const color = colorNivel(nivel);
    semaforoEl.style.display = "block";
    semaforoEl.style.background = nivel === "verde" ? "#EAF3EC" : nivel === "amarillo" ? "#FBF3E1" : "#FBEAEA";
    semaforoEl.style.color = color;
    semaforoEl.textContent = "Error entre posiciones: " + errorMm.toFixed(1) + " mm — " + textoNivel(nivel);
  }
  ["atras1", "adelante1", "atras2", "adelante2"].forEach((name) => {
    form.elements[name].addEventListener("input", actualizarSemaforoVivo);
  });

  document.getElementById("formTramo").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const valores = {};
    ["puntoAtras", "puntoAdelante", "distancia", "atras1", "adelante1", "atras2", "adelante2", "obs"].forEach((k) => {
      valores[k] = form.elements[k].value;
    });
    if (!valores.puntoAdelante.trim()) return toast("Ingresa el punto adelante del tramo.");
    if ([valores.atras1, valores.adelante1, valores.atras2, valores.adelante2].some((v) => v === "")) {
      return toast("Completa las 4 lecturas (posición 1 y posición 2).");
    }

    const desnivel1 = parseFloat(valores.atras1) - parseFloat(valores.adelante1);
    const desnivel2 = parseFloat(valores.atras2) - parseFloat(valores.adelante2);
    const errorTramoMm = (desnivel1 - desnivel2) * 1000;
    const nivel = clasificarErrorTramo(errorTramoMm);
    if (nivel === "rojo") {
      const seguir = confirm(
        "El error entre posición 1 y posición 2 es de " + errorTramoMm.toFixed(1) + " mm — " +
        "esto suele ser un error de tipeo o de registro (revisa si anotaste bien las 4 lecturas).\n\n" +
        "¿Guardar de todas formas?"
      );
      if (!seguir) return;
    }

    const punto = {
      id: uuid(),
      numero: lev.puntos.length + 1,
      valores,
      foto: fotoDataUrl,
      lat: ubicPunto?.lat ?? null,
      lng: ubicPunto?.lng ?? null,
      ubicFuente: ubicFuente,
      timestamp: nowISO()
    };
    lev.puntos.push(punto);
    recalcularTramosCerrada(lev);
    await dbPut("levantamientos", lev);
    marcarPendienteSync(lev.jornadaId);
    toast("Tramo " + punto.numero + " agregado");
    renderTabActual();
  });

  document.getElementById("btnFinalizarLevantamiento").addEventListener("click", async () => {
    if (lev.puntos.length === 0 && !confirm("No hay tramos registrados. ¿Finalizar de todas formas?")) return;
    lev.estado = "cerrado";
    lev.fechaFin = nowISO();
    await dbPut("levantamientos", lev);
    state.levantamientoActivoId = null;
    marcarPendienteSync(lev.jornadaId);
    toast("Levantamiento finalizado");
    renderTabActual();
  });
}

function renderLevantamientoEnCurso(el, lev) {
  const columnas = INSTRUMENTOS[lev.instrumento].tipos[lev.tipo].columnas;
  lev.valoresSticky = lev.valoresSticky || {};

  const esEstatico = sesEsEstatico(lev);
  if (esEstatico && sesAsegurar(lev)) { dbPut("levantamientos", lev); }
  el.innerHTML = `
    ${esEstatico ? '<div id="panelSesiones">' + sesHtmlPanel(lev) + '</div>' : ""}
    <div class="card">
      <h2><span class="num">${lev.puntos.length + 1}</span>${escapeHtml(lev.instrumentoNombre)} — ${escapeHtml(lev.tipoNombre)}</h2>
      <p class="muted">${lev.equipo ? escapeHtml(lev.equipo) : "Sin equipo especificado"} · iniciado ${fmtHoraCorta(lev.fechaInicio)}</p>
      <button class="btn btn-outline btn-sm" type="button" style="margin-top:6px;" onclick="abrirEditorLevantamiento('${lev.id}')">✏️ Editar datos del levantamiento</button>
      <div class="divider"></div>
      <form id="formPunto">
        ${columnas.map((c) => `
          <label>${escapeHtml(c.label)}${c.sticky ? ' <span class="muted" style="font-weight:400;">(se mantiene hasta que la cambies)</span>' : ""}</label>
          <input type="${c.tipo}" name="${c.key}" ${c.tipo === "number" ? 'step="any"' : ""} ${c.sticky && lev.valoresSticky[c.key] != null ? `value="${escapeHtml(lev.valoresSticky[c.key])}"` : ""}>
        `).join("")}
        ${esEstatico ? sesSelectHtml(lev) : ""}
        <label>Foto (comprobante / hito)</label>
        ${selectorFotoHtml("inpFoto")}
        <div id="fotoPreviewWrap" style="margin-top:8px;"></div>
        <label>Ubicación del punto</label>
        <div class="row" style="align-items:center;">
          <span class="muted" id="puntoUbicText" style="flex:2;">Capturando GPS…</span>
          <button class="btn btn-outline btn-sm" type="button" id="btnRecapturarUbic" style="flex:1;">🗺️ Ajustar</button>
        </div>
        <div class="divider"></div>
        <button class="btn btn-accent" type="submit">Agregar punto</button>
      </form>
    </div>

    <div class="card">
      <h2>Puntos registrados (${lev.puntos.length})</h2>
      ${lev.puntos.length === 0 ? `<p class="muted">Aún no hay puntos.</p>` : `
      <div class="table-wrap"><table>
        <thead><tr>${columnas.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}<th>Foto</th><th>Ubic.</th><th>Hora</th><th></th></tr></thead>
        <tbody>
          ${lev.puntos.map((p, i) => `
            <tr>
              ${columnas.map((c) => `<td class="${c.tipo === "number" ? "num" : ""}">${escapeHtml(p.valores[c.key] ?? "")}</td>`).join("")}
              <td>${p.foto ? `<img src="${p.foto}" class="thumb" style="width:34px;height:34px;" onclick="verFoto('${p.foto}')">` : "—"}</td>
              <td title="${p.lat != null ? fmtCoord(p.lat, p.lng) : "Sin ubicación"}">${fmtFuenteUbic(p.ubicFuente)}</td>
              <td>${fmtHoraCorta(p.timestamp)}</td>
              <td style="white-space:nowrap;"><button class="btn btn-outline btn-sm" onclick="abrirEditorPunto('${lev.id}', ${i})" type="button">✏️</button> <button class="btn btn-outline btn-sm" onclick="eliminarPunto('${lev.id}', ${i})" type="button">✕</button></td>
            </tr>`).join("")}
        </tbody>
      </table></div>`}
      <div class="divider"></div>
      <button class="btn btn-outline danger" id="btnFinalizarLevantamiento" type="button">Finalizar levantamiento</button>
    </div>
  `;

  if (esEstatico) { sesWirePanel(lev); sesWireSelect(lev); sesArrancarTick(); }

  // Captura automática de ubicación al entrar (se puede refinar después con la foto)
  let ubicPunto = null;
  let ubicFuente = null; // "gps" | "foto" | "mapa"
  getUbicacionActual().then((pos) => {
    if (ubicFuente) return; // ya se fijó por otra vía (ej. la foto llegó primero)
    ubicPunto = pos;
    ubicFuente = pos ? "gps" : null;
    const t = document.getElementById("puntoUbicText");
    if (t) t.textContent = pos ? fmtCoord(pos.lat, pos.lng) + " · GPS" : "GPS no disponible — usa 'Ajustar'";
  });
  document.getElementById("btnRecapturarUbic").addEventListener("click", () => {
    abrirMapModal(ubicPunto?.lat, ubicPunto?.lng, (pos) => {
      ubicPunto = pos;
      ubicFuente = "mapa";
      document.getElementById("puntoUbicText").textContent = fmtCoord(pos.lat, pos.lng) + " · mapa (manual)";
    });
  });

  // Foto: al elegirla, se intenta leer su ubicación EXIF; si no trae, se
  // recaptura el GPS del teléfono en ese instante (más preciso que el de
  // cuando se abrió el formulario, sobre todo si hubo que caminar).
  let fotoDataUrl = null;
  wireSelectorFoto(el, "inpFoto", async (file, origen) => {
    const ubicText = document.getElementById("puntoUbicText");
    if (ubicText) ubicText.innerHTML = '<span class="spinner"></span> Procesando foto…';
    let r;
    try { r = await leerFotoArchivo(file); } catch (_) { toast("No se pudo leer la imagen"); return; }
    fotoDataUrl = r.dataUrl;
    document.getElementById("fotoPreviewWrap").innerHTML = `<img src="${fotoDataUrl}" class="thumb" style="width:90px;height:90px;">`;
    if (r.gps) {
      ubicPunto = r.gps; ubicFuente = "foto";
      if (ubicText) ubicText.textContent = fmtCoord(r.gps.lat, r.gps.lng) + " · metadatos de la foto";
    } else if (origen === "archivo" && ubicPunto) {
      // Foto subida desde la galería sin ubicación: no se pisa la que ya había
      if (ubicText) ubicText.textContent = fmtCoord(ubicPunto.lat, ubicPunto.lng) + " · " + (ubicFuente === "mapa" ? "mapa (manual)" : "GPS") + " (la foto no trae ubicación)";
    } else {
      const pos = await getUbicacionActual();
      if (pos) { ubicPunto = pos; ubicFuente = "gps"; if (ubicText) ubicText.textContent = fmtCoord(pos.lat, pos.lng) + " · GPS al momento de la foto"; }
      else if (ubicText) ubicText.textContent = "Sin ubicación — usa 'Ajustar'";
    }
  });

  document.getElementById("formPunto").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const valores = {};
    columnas.forEach((c) => { valores[c.key] = form.elements[c.key].value; });
    columnas.forEach((c) => { if (c.sticky) lev.valoresSticky[c.key] = valores[c.key]; });
    // v0.1a: en estático, el punto pertenece a una o más sesiones; la hora de inicio se rellena sola
    let sesDelPunto = [];
    if (esEstatico) {
      const ids = Array.from(form.querySelectorAll('input[name="sesionIds"]:checked')).map((i) => i.value);
      sesDelPunto = (lev.sesiones || []).filter((x) => ids.includes(x.id));
      lev.sesionesSel = ids;
      if (valores.horaInicio === "") valores.horaInicio = hhmm(Date.now());
    }
    const punto = {
      id: uuid(),
      numero: lev.puntos.length + 1,
      valores,
      foto: fotoDataUrl,
      lat: ubicPunto?.lat ?? null,
      lng: ubicPunto?.lng ?? null,
      ubicFuente: ubicFuente,
      sesionIds: sesDelPunto.map((x) => x.id),
      sesionId: sesDelPunto.length ? sesDelPunto[0].id : null,
      fija: esEstatico && !!(form.querySelector('input[name="fija"]') || {}).checked,
      timestamp: nowISO()
    };
    lev.puntos.push(punto);
    let msg = "Punto " + punto.numero + " agregado";
    sesDelPunto.forEach((ses) => {
      // Cuenta común: arranca (o se reinicia) con la última base agregada
      let reiniciar = ses.reiniciarAlAgregar || ses.estado === "pendiente";
      if (ses.estado === "completada") {
        reiniciar = confirm(ses.nombre + " ya cumplió su observación.\n\nAceptar = reabrirla y reiniciar la cuenta desde esta base.\nCancelar = agregar el punto sin reiniciar la cuenta.");
      }
      if (reiniciar) {
        sesIniciarConteo(lev, ses);
        msg += " · " + ses.nombre + ": cuenta de " + ses.duracionMin + " min";
      }
    });
    await dbPut("levantamientos", lev);
    marcarPendienteSync(lev.jornadaId);
    toast(msg);
    renderTabActual();
  });

  document.getElementById("btnFinalizarLevantamiento").addEventListener("click", async () => {
    if (lev.puntos.length === 0 && !confirm("No hay puntos registrados. ¿Finalizar de todas formas?")) return;
    lev.estado = "cerrado";
    lev.fechaFin = nowISO();
    await dbPut("levantamientos", lev);
    state.levantamientoActivoId = null;
    marcarPendienteSync(lev.jornadaId);
    toast("Levantamiento finalizado");
    renderTabActual();
  });
}

async function eliminarPunto(levId, index) {
  const lev = state.levantamientos.find((l) => l.id === levId);
  if (!lev) return;
  if (!confirm("¿Eliminar este punto?")) return;
  lev.puntos.splice(index, 1);
  lev.puntos.forEach((p, i) => { p.numero = i + 1; });
  if (lev.instrumento === "nivel" && lev.tipo === "cerrada") recalcularTramosCerrada(lev);
  if (esPlanilla(lev)) recalcularPlanilla(lev);
  await dbPut("levantamientos", lev);
  marcarPendienteSync(lev.jornadaId);
  toast("Punto eliminado");
  renderTabActual();
}
window.eliminarPunto = eliminarPunto;
window.verFoto = verFoto;

/* =========================================================================
   EDICIÓN DE PUNTOS Y DATOS DE INICIO DEL LEVANTAMIENTO
   Permite corregir en terreno: valores (altura antena, código, horas…),
   foto (cambiar/quitar), ubicación, y los datos con que se inició el
   levantamiento (equipo; y en nivelación cerrada: partida/cota/final).
   ========================================================================= */
function abrirEditorPunto(levId, index) {
  const lev = state.levantamientos.find((l) => l.id === levId);
  if (!lev || !lev.puntos[index]) return;
  if (esCatastro(lev)) return abrirEditorCatastro(levId, index);
  if (esPlanilla(lev)) return abrirEditorPlanilla(levId, index);
  const p = lev.puntos[index];
  const esCerrada = lev.instrumento === "nivel" && lev.tipo === "cerrada";
  const columnas = INSTRUMENTOS[lev.instrumento].tipos[lev.tipo].columnas;
  // En nivelación cerrada los derivados (desniveles, error, cota) se recalculan solos
  const camposEditables = esCerrada
    ? columnas.filter((c) => ["puntoAtras","puntoAdelante","distancia","atras1","adelante1","atras2","adelante2","obs"].includes(c.key))
    : columnas;

  let foto = p.foto || null;
  let ubic = p.lat != null ? { lat: p.lat, lng: p.lng } : null;
  let ubicFuente = p.ubicFuente || null;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-sheet">
      <button class="close-x" id="edPuntoClose" type="button">&times;</button>
      <h3>Editar ${esCerrada ? "tramo" : "punto"} ${p.numero}</h3>
      <div class="divider"></div>
      <form id="formEditarPunto">
        ${camposEditables.map((c) => {
          const tipo = c.tipo === "check" ? "text" : c.tipo;
          return `<label>${escapeHtml(c.label)}</label>
            <input type="${tipo}" name="${c.key}" ${tipo === "number" ? 'step="any"' : ""} value="${escapeHtml(p.valores[c.key] ?? "")}">`;
        }).join("")}
        ${sesEsEstatico(lev) ? `<label>Sesión(es) de esta base</label>
          <div>${(lev.sesiones || []).map((x) => `<label style="display:flex; align-items:center; gap:8px; margin:4px 0; font-weight:400;"><input type="checkbox" name="edSesion" value="${x.id}" ${sesIdsDe(p).includes(x.id) ? "checked" : ""} style="width:auto;"> ${escapeHtml(x.nombre)}</label>`).join("")}</div>
          <label style="display:flex; align-items:center; gap:8px; margin-top:8px; font-weight:400;"><input type="checkbox" name="edFija" ${p.fija ? "checked" : ""} style="width:auto;"> 📌 Base fija (sigue midiendo al cerrar una sesión)</label>` : ""}
        <label>Foto</label>
        <div id="edFotoWrap" style="margin:4px 0 8px;"></div>
        ${selectorFotoHtml("edInpFoto")}
        <div class="row" style="gap:8px; margin-top:6px;">
          <button class="btn btn-outline btn-sm danger" type="button" id="edQuitarFoto" style="flex:1;">Quitar foto</button>
        </div>
        <label>Ubicación del punto</label>
        <div class="row" style="align-items:center; gap:8px;">
          <span class="muted" id="edUbicText" style="flex:2;"></span>
          <button class="btn btn-outline btn-sm" type="button" id="edGps" style="flex:1;">📍 GPS ahora</button>
          <button class="btn btn-outline btn-sm" type="button" id="edMapa" style="flex:1;">🗺️ Mapa</button>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" type="button" id="edCancelar" style="flex:1;">Cancelar</button>
          <button class="btn btn-accent" type="submit" style="flex:1;">Guardar cambios</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  const cerrar = () => overlay.remove();
  overlay.querySelector("#edPuntoClose").addEventListener("click", cerrar);
  overlay.querySelector("#edCancelar").addEventListener("click", cerrar);

  const pintarFoto = () => {
    overlay.querySelector("#edFotoWrap").innerHTML = foto
      ? `<img src="${foto}" class="thumb" style="width:90px;height:90px;">`
      : `<span class="muted">Sin foto</span>`;
  };
  const pintarUbic = () => {
    overlay.querySelector("#edUbicText").textContent = ubic
      ? fmtCoord(ubic.lat, ubic.lng) + " · " + fmtFuenteUbic(ubicFuente).replace(/^\S+\s/, "")
      : "Sin ubicación";
  };
  pintarFoto(); pintarUbic();

  overlay.querySelector("#edQuitarFoto").addEventListener("click", () => { foto = null; pintarFoto(); });
  wireSelectorFoto(overlay, "edInpFoto", async (file) => {
    let r;
    try { r = await leerFotoArchivo(file); } catch (_) { toast("No se pudo leer la imagen"); return; }
    foto = r.dataUrl; pintarFoto();
    // Si la foto trae ubicación EXIF, ofrece usarla sin pisar la ubicación a ciegas
    if (r.gps && confirm("La foto trae su propia ubicación. ¿Usarla como ubicación del punto?")) {
      ubic = r.gps; ubicFuente = "foto"; pintarUbic();
    }
  });
  overlay.querySelector("#edGps").addEventListener("click", async () => {
    overlay.querySelector("#edUbicText").innerHTML = '<span class="spinner"></span> Capturando GPS…';
    const pos = await getUbicacionActual();
    if (pos) { ubic = pos; ubicFuente = "gps"; }
    else toast("GPS no disponible");
    pintarUbic();
  });
  overlay.querySelector("#edMapa").addEventListener("click", () => {
    abrirMapModal(ubic?.lat, ubic?.lng, (pos) => { ubic = pos; ubicFuente = "mapa"; pintarUbic(); });
  });

  overlay.querySelector("#formEditarPunto").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const nuevosValores = {};
    camposEditables.forEach((c) => { nuevosValores[c.key] = f.elements[c.key].value; });

    if (esCerrada) {
      const v = nuevosValores;
      if (!v.puntoAdelante.trim()) return toast("Ingresa el punto adelante del tramo.");
      if ([v.atras1, v.adelante1, v.atras2, v.adelante2].some((x) => x === "")) return toast("Completa las 4 lecturas.");
    }
    Object.assign(p.valores, nuevosValores);
    if (sesEsEstatico(lev)) {
      p.sesionIds = Array.from(f.querySelectorAll('input[name="edSesion"]:checked')).map((i) => i.value);
      p.sesionId = p.sesionIds[0] || null;
      p.fija = !!f.querySelector('input[name="edFija"]').checked;
    }
    p.foto = foto;
    p.lat = ubic ? ubic.lat : null;
    p.lng = ubic ? ubic.lng : null;
    p.ubicFuente = ubic ? ubicFuente : null;
    p.editado = nowISO();
    if (esCerrada) recalcularTramosCerrada(lev);

    await dbPut("levantamientos", lev);
    marcarPendienteSync(lev.jornadaId);
    cerrar();
    toast((esCerrada ? "Tramo " : "Punto ") + p.numero + " actualizado");
    renderTabActual();
  });
}

function abrirEditorLevantamiento(levId) {
  const lev = state.levantamientos.find((l) => l.id === levId);
  if (!lev) return;
  const esCerrada = lev.instrumento === "nivel" && lev.tipo === "cerrada";

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-sheet">
      <button class="close-x" id="edLevClose" type="button">&times;</button>
      <h3>Editar datos del levantamiento</h3>
      <p class="muted">${escapeHtml(lev.instrumentoNombre)} — ${escapeHtml(lev.tipoNombre)}</p>
      <div class="divider"></div>
      <form id="formEditarLev">
        <label>Equipo utilizado</label>
        <input type="text" name="equipo" value="${escapeHtml(lev.equipo || "")}">
        ${esCerrada ? `
          <label>Punto de partida</label>
          <input type="text" name="puntoPartida" value="${escapeHtml(lev.puntoPartida)}">
          <label>Cota de partida (m)</label>
          <input type="number" step="any" name="cotaPartida" value="${escapeHtml(lev.cotaPartida)}">
          <label>Punto final</label>
          <input type="text" name="puntoFinal" value="${escapeHtml(lev.puntoFinal)}">
          ${normaDe(lev) === "MOP" ? `<label>Clase de nivelación (MOP)</label>
          <select name="clase">${Object.keys(NIVELACION_CLASES).map((k) => `<option value="${k}" ${lev.clase === k ? "selected" : ""}>${NIVELACION_CLASES[k].nombre} — ${String(NIVELACION_CLASES[k].k).replace(".", ",")}·√K mm</option>`).join("")}${lev.clase ? "" : '<option value="" selected>(sin clase: config. general)</option>'}</select>` : ""}
          <p class="preview-note">ℹ️ Si cambias la cota de partida, las cotas de todos los tramos se recalculan solas.</p>` : ""}
        <div class="modal-actions">
          <button class="btn btn-outline" type="button" id="edLevCancelar" style="flex:1;">Cancelar</button>
          <button class="btn btn-accent" type="submit" style="flex:1;">Guardar cambios</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  const cerrar = () => overlay.remove();
  overlay.querySelector("#edLevClose").addEventListener("click", cerrar);
  overlay.querySelector("#edLevCancelar").addEventListener("click", cerrar);

  overlay.querySelector("#formEditarLev").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    lev.equipo = f.elements.equipo.value.trim();
    if (esCerrada) {
      const pp = f.elements.puntoPartida.value.trim();
      const cp = parseFloat(f.elements.cotaPartida.value);
      const pf = f.elements.puntoFinal.value.trim();
      if (!pp || isNaN(cp) || !pf) return toast("Completa punto de partida, cota y punto final.");
      lev.puntoPartida = pp; lev.cotaPartida = cp; lev.puntoFinal = pf;
      if (f.elements.clase && f.elements.clase.value) lev.clase = f.elements.clase.value;
      recalcularTramosCerrada(lev);
    }
    await dbPut("levantamientos", lev);
    marcarPendienteSync(lev.jornadaId);
    cerrar();
    toast("Levantamiento actualizado");
    renderTabActual();
  });
}
window.abrirEditorPunto = abrirEditorPunto;
window.abrirEditorLevantamiento = abrirEditorLevantamiento;
