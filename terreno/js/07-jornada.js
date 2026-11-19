"use strict";

/* =========================================================================
   TAB: JORNADA
   ========================================================================= */
function renderJornada() {
  const el = document.getElementById("tab-jornada");
  const j = jornadaActiva();

  if (!j) {
    const ultima = [...state.jornadas].sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio))[0];
    el.innerHTML = `
      <div class="card">
        <h2>Iniciar jornada</h2>
        <div id="proyectoSistema"></div>
        <div id="wrapProyectoLibre">
          <label>Proyecto</label>
          <input type="text" id="inpProyecto" list="listaProyectos" placeholder="Ej: PV El Romero Solar">
          <datalist id="listaProyectos">
            ${[...new Set(state.jornadas.map((j) => j.proyecto).filter(Boolean))].map((pr) => `<option value="${escapeHtml(pr)}">`).join("")}
          </datalist>
        </div>
        <div id="wrapOperador">
          <label>Operador</label>
          <input type="text" id="inpOperador" list="listaOperadores" placeholder="Nombre de quién levanta">
          <datalist id="listaOperadores">
            ${[...new Set(state.jornadas.map((j) => j.operador).filter(Boolean))].map((op) => `<option value="${escapeHtml(op)}">`).join("")}
          </datalist>
        </div>
        <label>¿Qué trabajos harás hoy? <span class="muted" style="font-weight:400;">(cargan su checklist)</span></label>
        ${trabajosHtml()}
        <label>Ubicación de inicio</label>
        <div class="ubic-auto muted" id="jornadaUbicPreview">Se toma sola con el GPS al iniciar.<button id="btnMapaJornada" type="button">Marcar en el mapa</button></div>
        <button class="btn btn-accent" id="btnIniciarJornada" type="button">Iniciar jornada</button>
      </div>
      ${ultima ? `
      <div class="card">
        <h2>Última jornada</h2>
        <p>${fmtFecha(ultima.fechaInicio)} → ${ultima.fechaTermino ? fmtHoraCorta(ultima.fechaTermino) : "—"}</p>
        <p class="muted">${ultima.operador ? "Operador: " + escapeHtml(ultima.operador) + " · " : ""}Duración: ${fmtDuracion(ultima.horas != null ? ultima.horas * 3600000 : null)} · ${fmtCoord(ultima.lat, ultima.lng)}</p>
      </div>` : ""}
    `;
    const inpOperador = document.getElementById("inpOperador");
    inpOperador.value = localStorage.getItem("ultimoOperador") || "";
    document.getElementById("inpProyecto").value = localStorage.getItem("ultimoProyecto") || "";
    sisCargarProyectosJornada();

    const elegidos = new Set();
    document.querySelectorAll(".chip-trabajo").forEach((b) => b.addEventListener("click", () => {
      if (elegidos.has(b.dataset.id)) elegidos.delete(b.dataset.id); else elegidos.add(b.dataset.id);
      b.setAttribute("aria-pressed", elegidos.has(b.dataset.id) ? "true" : "false");
      b.classList.toggle("on", elegidos.has(b.dataset.id));
    }));
    let ubicTemp = null;
    const prev = document.getElementById("jornadaUbicPreview");
    const mostrarUbic = (pos, origen) => {
      prev.firstChild.textContent = fmtCoord(pos.lat, pos.lng) + " · " + origen + " ";
      prev.classList.remove("muted");
    };
    // 0.6.1: si el permiso de ubicación ya está dado, la posición se toma sola; si no, al iniciar.
    try {
      if (navigator.permissions && navigator.geolocation) {
        navigator.permissions.query({ name: "geolocation" }).then((r) => {
          if (r.state !== "granted") return;
          getUbicacionActual().then((pos) => { if (pos && !ubicTemp && document.body.contains(prev)) { ubicTemp = pos; mostrarUbic(pos, "GPS"); } });
        }).catch(() => {});
      }
    } catch (_) {}
    document.getElementById("btnMapaJornada").addEventListener("click", () => {
      abrirMapModal(ubicTemp?.lat, ubicTemp?.lng, (pos) => { ubicTemp = pos; mostrarUbic(pos, "mapa"); });
    });
    document.getElementById("btnIniciarJornada").addEventListener("click", async () => {
      const operador = inpOperador.value.trim();
      if (operador) localStorage.setItem("ultimoOperador", operador);
      const proyecto = document.getElementById("inpProyecto").value.trim();
      if (proyecto) localStorage.setItem("ultimoProyecto", proyecto);
      try { if (SIS.proyectoIdSel) localStorage.setItem("ultimoProyectoId", SIS.proyectoIdSel); } catch (_) {}
      const nueva = {
        id: uuid(),
        fechaInicio: nowISO(),
        fechaTermino: null,
        horas: null,
        operador: operador || null,
        proyecto: proyecto || null,
        proyectoId: SIS.proyectoIdSel || null,   // v0.5.6: id del proyecto del Sistema («oficina» = sin proyecto de terreno)
        lat: ubicTemp?.lat ?? null,
        lng: ubicTemp?.lng ?? null,
        estado: "abierta",
        objetivos: state.plantillas.filter((p) => elegidos.has(p.id)).map((p) => ({
          id: uuid(), plantillaId: p.id, plantillaNombre: p.nombre,
          items: p.items.map((it) => ({ id: it.id, texto: it.texto, tipo: it.tipo, marcado: false, hora: null, valor: "", nota: "" }))
        }))
      };
      await dbPut("jornadas", nueva);
      state.jornadas.push(nueva);
      state.jornadaActivaId = nueva.id;
      marcarPendienteSync(nueva.id);
      toast("Jornada iniciada");
      renderTabActual();
      if (nueva.lat == null) tomarUbicacionJornada(nueva);
    });
    return;
  }

  // Jornada en curso (0.6.1): qué sigue → datos de la jornada → clima → gastos → checklist → cerrar
  j.objetivos = j.objetivos || []; // compatibilidad con jornadas creadas antes de esta función
  const levs = levantamientosDeJornada(j.id);
  state.chkAbiertos = state.chkAbiertos || new Set();
  const sinUbic = j.lat == null || j.lng == null;
  el.innerHTML = `
    ${tarjetaSiguientePasoHtml(j, levs)}
    <div class="card">
      <h2>Jornada en curso</h2>
      <p class="muted">Proyecto: ${j.proyecto ? "<strong>" + escapeHtml(j.proyecto) + "</strong>" : "sin proyecto"} <button class="btn btn-outline btn-sm" id="btnCambiarProyecto" type="button" style="margin-left:6px;" aria-label="Cambiar proyecto">✏️</button></p>
      ${j.operador ? `<p class="muted">Operador: ${escapeHtml(j.operador)}</p>` : ""}
      <p class="muted">Iniciada: ${fmtFecha(j.fechaInicio)}</p>
      <p class="muted"><span id="jornadaUbicTexto">Ubicación: ${sinUbic ? "sin ubicación" : fmtCoord(j.lat, j.lng)}</span>${sinUbic ? ' <button class="btn btn-outline btn-sm" id="btnUbicJornada" type="button">📍 Marcar</button>' : ""}</p>
      <div style="text-align:center; margin:14px 0 6px;">
        <div style="font-family:var(--mono); font-size:34px; font-weight:700; color:var(--primary-dark);" id="relojJornada">
          ${fmtDuracion(Date.now() - new Date(j.fechaInicio).getTime())}
        </div>
        <div class="muted">tiempo transcurrido</div>
      </div>
    </div>
    ${jornadaEsDron(j) ? `<details class="card pron-linea" id="detPronostico"${state.pronAbierto ? " open" : ""}>
      <summary><b>Pronóstico de vuelo</b><small id="pronLinea">${escapeHtml(lineaClima(j))}</small></summary>
      <div id="pronosticoJornada"></div></details>` : ""}
    ${typeof gastosTarjetaJornadaHtml === "function" ? gastosTarjetaJornadaHtml(j) : ""}
    <div class="card" id="cardChecklist">
      <h2>Checklist del día</h2>
      ${j.objetivos.length ? j.objetivos.map((bloque) => {
        const checks = bloque.items.filter((it) => it.tipo === "check");
        const hechos = checks.filter((it) => it.marcado).length;
        const ok = checks.length && hechos === checks.length;
        return `<details class="chk" data-chk="${bloque.id}"${state.chkAbiertos.has(bloque.id) ? " open" : ""}>
          <summary><span>${escapeHtml(bloque.plantillaNombre)}</span><span class="chk-n ${ok ? "ok" : ""}">${checks.length ? (ok ? "✓ " : "") + hechos + " de " + checks.length : "datos"}</span></summary>
          ${bloque.items.map((it) => renderItemObjetivo(bloque.id, it)).join("")}
        </details>`;
      }).join("") : `<p class="muted">Sin checklist: agrega uno abajo.</p>`}
      <details class="mas-acciones">
        <summary>＋ Agregar otro checklist</summary>
        <div class="row">
          <select id="selPlantillaObjetivo" style="flex:1;">
            ${state.plantillas.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join("")}
          </select>
          <button class="btn btn-outline btn-sm" id="btnAgregarObjetivo" type="button">Agregar</button>
        </div>
        ${!state.plantillas.length ? `<p class="muted">No tienes plantillas: créalas en ⚙ → General → Plantillas del checklist.</p>` : ""}
      </details>
    </div>
    ${tarjetaCierreHtml(j, levs)}
  `;
  if (typeof gastosEnlazarJornada === "function") gastosEnlazarJornada(j);
  el.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => {
    const [tab, instr, tipo] = b.dataset.ir.split("|");
    if (instr) state.preseleccionLev = { instrumento: instr, tipo: tipo };
    irATab(tab);
  }));
  el.querySelectorAll("[data-abrir-chk]").forEach((b) => b.addEventListener("click", () => {
    const d = el.querySelector(`details.chk[data-chk="${b.dataset.abrirChk}"]`);
    if (!d) return;
    d.open = true;
    state.chkAbiertos.add(d.dataset.chk);
    d.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  el.querySelectorAll("details.chk").forEach((d) => d.addEventListener("toggle", () => {
    if (d.open) state.chkAbiertos.add(d.dataset.chk); else state.chkAbiertos.delete(d.dataset.chk);
  }));
  const detPron = document.getElementById("detPronostico");
  if (detPron) detPron.addEventListener("toggle", () => { state.pronAbierto = detPron.open; });
  const btnUbic = document.getElementById("btnUbicJornada");
  if (btnUbic) btnUbic.addEventListener("click", () => {
    abrirMapModal(null, null, async (pos) => {
      j.lat = pos.lat; j.lng = pos.lng;
      await dbPut("jornadas", j);
      marcarPendienteSync(j.id);
      renderJornada();
    });
  });
  document.getElementById("btnTerminarJornada").addEventListener("click", async () => {
    if (levantamientoActivo()) {
      return toast("Primero finaliza el levantamiento en curso (pestaña Registrar).");
    }
    const r = resumenCierre(j, levs);
    const envia = jornadaSeEnviaAlCerrar(j);
    const aviso = [
      "¿Terminar la jornada ahora?", "",
      "Duración: " + fmtDuracion(r.ms),
      r.levs + " levantamiento(s) · " + r.puntos + " punto(s)",
      r.fotosFaltan ? "⚠ Faltan " + r.fotosFaltan + " foto(s) requerida(s)" : "",
      r.chkFaltan ? "⚠ Quedan " + r.chkFaltan + " ítem(s) del checklist sin marcar" : "",
      envia ? "\nSe enviará al Sistema (sin señal queda en cola y sale sola al volver)." : ""
    ].filter((x) => x !== "").join("\n");
    if (!confirm(aviso)) return;
    j.fechaTermino = nowISO();
    j.horas = (new Date(j.fechaTermino) - new Date(j.fechaInicio)) / 3600000;
    j.estado = "cerrada";
    await dbPut("jornadas", j);
    state.jornadaActivaId = null;
    marcarPendienteSync(j.id);
    toast("Jornada terminada — " + j.horas.toFixed(2) + " h");
    if (envia && typeof sisEnviarJornada === "function") await sisEnviarJornada(j);
    else if (typeof sisPreguntarEnviarJornada === "function") await sisPreguntarEnviarJornada(j);
    renderTabActual();
  });
  wireObjetivosJornada(j);
  montarPronosticoJornada(j);
  document.getElementById("btnCambiarProyecto").addEventListener("click", async () => {
    const nuevo = prompt("Proyecto de esta jornada:", j.proyecto || "");
    if (nuevo === null) return;
    j.proyecto = nuevo.trim() || null;
    j.proyectoId = null;   // se escribió a mano: ya no corresponde al proyecto del Sistema
    if (j.proyecto) localStorage.setItem("ultimoProyecto", j.proyecto);
    await dbPut("jornadas", j);
    marcarPendienteSync(j.id);
    renderTabActual();
  });
}

/* 0.6.1 — La ubicación de inicio se toma sola después de iniciar, sin detener a nadie. */
function tomarUbicacionJornada(j) {
  getUbicacionActual().then(async (pos) => {
    if (!pos) { toast("No se pudo tomar el GPS: marca la ubicación desde la jornada."); return; }
    if (j.lat != null) return;
    j.lat = pos.lat; j.lng = pos.lng;
    await dbPut("jornadas", j);
    marcarPendienteSync(j.id);
    if (state.tabActual === "jornada" && jornadaActiva() === j) renderJornada();
  }).catch(() => {});
}

/* 0.6.1 — Resumen para cerrar la jornada: lo que se hizo y lo que falta. */
function resumenCierre(j, levs) {
  const fin = j.fechaTermino ? new Date(j.fechaTermino) : new Date();
  return {
    ms: fin - new Date(j.fechaInicio),
    levs: levs.length,
    puntos: levs.reduce((a, l) => a + (l.puntos || []).length, 0),
    fotosFaltan: levs.reduce((a, l) => a + (l.fotosReq || []).filter((f) => !f.foto).length, 0),
    chkFaltan: (j.objetivos || []).flatMap((b) => b.items).filter((it) => it.tipo === "check" && !it.marcado).length
  };
}
function jornadaSeEnviaAlCerrar(j) {
  return typeof sisPuedePublicar === "function" && sisPuedePublicar() && !!j.proyectoId && typeof TopolandConexion.publicarJornada === "function";
}
function tarjetaCierreHtml(j, levs) {
  const r = resumenCierre(j, levs);
  const envia = jornadaSeEnviaAlCerrar(j);
  return `<div class="card">
    <h2>Cerrar jornada</h2>
    <div class="cierre-resumen">
      <div><b>${r.levs}</b>levantamiento(s)</div>
      <div><b>${r.puntos}</b>punto(s)</div>
      <div><b>${r.fotosFaltan}</b>foto(s) por tomar</div>
      <div><b>${r.chkFaltan}</b>ítem(s) del checklist</div>
    </div>
    <p class="muted" style="font-size:13px;">${envia ? "Al terminar, la jornada se envía al Sistema. Sin señal queda en cola y sale sola al volver." : j.proyectoId ? "Vincula el teléfono con el Sistema (⚙ → Sistema) para que se envíe al terminar." : "Esta jornada no tiene proyecto del Sistema: se guarda en el teléfono y en tu nube."}</p>
    <button class="btn btn-danger" id="btnTerminarJornada" type="button">Terminar jornada</button>
  </div>`;
}
/* 0.6.1 — Una línea con lo guardado del pronóstico (el detalle se abre al tocar). */
function lineaClima(j) {
  const c = j.clima;
  if (!c) return "sin consultar · toca para ver";
  const partes = [];
  if (c.ventana) partes.push("ventana " + c.ventana);
  if (c.rafaga && c.rafaga.v != null) partes.push("ráfaga " + Math.round(c.rafaga.v) + " km/h");
  if (c.kpMax != null) partes.push("Kp " + c.kpMax);
  return partes.length ? partes.join(" · ") : "guardado · toca para ver";
}

/* Dibuja el control correcto para un ítem de objetivo según su tipo. */
function renderItemObjetivo(bloqueId, it) {
  const key = bloqueId + "::" + it.id;
  if (it.tipo === "check") {
    return `
      <div class="chk-item">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1;">
          <input type="checkbox" data-obj-check="${key}" ${it.marcado ? "checked" : ""}>
          <span style="flex:1;">${escapeHtml(it.texto)}</span>
        </label>
        ${it.hora ? `<span class="muted" style="font-size:12px;">${fmtHoraCorta(it.hora)}</span>` : ""}
        <button type="button" class="chk-nota-btn" data-nota-abrir="${key}">${it.nota ? "nota ✎" : "+ nota"}</button>
      </div>
      <input type="text" class="chk-nota" data-obj-nota="${key}" value="${escapeHtml(it.nota || "")}" placeholder="Nota" ${it.nota ? "" : "hidden"}>
    `;
  }
  return `
    <label>${escapeHtml(it.texto)}</label>
    <input type="${it.tipo === "numero" ? "number" : "text"}" data-obj-valor="${key}" value="${escapeHtml(it.valor != null ? String(it.valor) : "")}" style="margin-bottom:8px;">
  `;
}

/* Conecta los eventos de la tarjeta "Objetivos del día": marcar ítems,
   escribir notas/valores, y adjuntar una nueva plantilla como bloque. */
function wireObjetivosJornada(j) {
  document.querySelectorAll("[data-obj-check]").forEach((chk) => {
    chk.addEventListener("change", async () => {
      const [bloqueId, itemId] = chk.dataset.objCheck.split("::");
      const it = j.objetivos.find((b) => b.id === bloqueId).items.find((x) => x.id === itemId);
      it.marcado = chk.checked;
      it.hora = chk.checked ? nowISO() : null;
      await dbPut("jornadas", j);
      marcarPendienteSync(j.id);
      renderJornada();
    });
  });
  document.querySelectorAll("[data-nota-abrir]").forEach((b) => b.addEventListener("click", () => {
    const inp = document.querySelector(`[data-obj-nota="${b.dataset.notaAbrir}"]`);
    if (!inp) return;
    inp.hidden = false;
    inp.focus();
  }));
  document.querySelectorAll("[data-obj-nota]").forEach((inp) => {
    inp.addEventListener("change", async () => {
      const [bloqueId, itemId] = inp.dataset.objNota.split("::");
      j.objetivos.find((b) => b.id === bloqueId).items.find((x) => x.id === itemId).nota = inp.value;
      await dbPut("jornadas", j);
      marcarPendienteSync(j.id);
    });
  });
  document.querySelectorAll("[data-obj-valor]").forEach((inp) => {
    inp.addEventListener("change", async () => {
      const [bloqueId, itemId] = inp.dataset.objValor.split("::");
      j.objetivos.find((b) => b.id === bloqueId).items.find((x) => x.id === itemId).valor = inp.value;
      await dbPut("jornadas", j);
      marcarPendienteSync(j.id);
    });
  });
  const btnAgregar = document.getElementById("btnAgregarObjetivo");
  if (btnAgregar) {
    btnAgregar.addEventListener("click", async () => {
      const p = state.plantillas.find((x) => x.id === document.getElementById("selPlantillaObjetivo").value);
      if (!p) return;
      j.objetivos.push({
        id: uuid(),
        plantillaId: p.id,
        plantillaNombre: p.nombre,
        items: p.items.map((it) => ({ id: it.id, texto: it.texto, tipo: it.tipo, marcado: false, hora: null, valor: "", nota: "" }))
      });
      await dbPut("jornadas", j);
      marcarPendienteSync(j.id);
      toast("Objetivos agregados");
      renderJornada();
    });
  }
}
function actualizarRelojJornada() {
  const j = jornadaActiva();
  const relojEl = document.getElementById("relojJornada");
  if (j && relojEl) relojEl.textContent = fmtDuracion(Date.now() - new Date(j.fechaInicio).getTime());
}
setInterval(actualizarRelojJornada, 1000);

/* v0.5 — Jornada guiada: qué sigue y qué falta, con atajos */
const LEV_SUGERIDO = {
  niv: ["nivel", "cerrada", "Nivelación cerrada"],
  est: ["estacion", "instalacion", "Estación Total · instalación"],
  rep: ["estacion", "replanteo", "Replanteo"],
  rtk: ["gnss", "rtk", "RTK"],
  ees: ["escaner", "estacion", "Escáner · estación"],
  red: ["gnss", "estatico", "GNSS estático"]
};
function tarjetaSiguientePasoHtml(j, levs) {
  const act = levantamientoActivo();
  const filas = [];
  if (act) {
    const pend = (act.fotosReq || []).filter((f) => !f.foto).length;
    filas.push(`<button class="paso" type="button" data-ir="levantamiento"><span>Continuar: ${escapeHtml(act.tipoNombre)}</span><small>${act.puntos.length} registro(s)${pend ? " · faltan " + pend + " foto(s)" : ""}</small></button>`);
  } else {
    const hechos = new Set(levs.map((l) => l.instrumento + "." + l.tipo));
    (j.objetivos || []).forEach((b) => {
      const sug = LEV_SUGERIDO[String(b.plantillaId || "").slice(0, 3)];
      if (!sug) return;
      const ya = hechos.has(sug[0] + "." + sug[1]);
      filas.push(`<button class="paso ${ya ? "hecho" : ""}" type="button" data-ir="levantamiento|${sug[0]}|${sug[1]}"><span>${ya ? "✓ " : ""}Iniciar ${escapeHtml(sug[2])}</span><small>${ya ? "ya hecho hoy; toca para otro" : "según tus objetivos"}</small></button>`);
    });
  }
  const objs = (j.objetivos || []).flatMap((b) => b.items).filter((it) => it.tipo === "check");
  const pendObj = objs.filter((it) => !it.marcado).length;
  const totalPend = pendObj;
  const estado = `<div class="paso-estado ${totalPend ? "pend" : "ok"}">${objs.length ? (totalPend ? "Faltan " + totalPend + " de " + objs.length + " ítems del checklist" : "Checklist completo") : "Sin checklist: agrégalo más abajo"}</div>`;
  if (!act) {
    // 0.6.1: un vuelo no es un levantamiento; su registro está en el checklist del dron
    (j.objetivos || []).filter((b) => b.plantillaId === "aer" || b.plantillaId === "lid").forEach((b) => {
      const checks = b.items.filter((it) => it.tipo === "check");
      const faltan = checks.filter((it) => !it.marcado).length;
      filas.push(`<button class="paso ${faltan ? "" : "hecho"}" type="button" data-abrir-chk="${b.id}"><span>${faltan ? "" : "✓ "}Registrar el vuelo · ${escapeHtml(b.plantillaNombre)}</span><small>${faltan ? "faltan " + faltan + " de " + checks.length + " ítems, vuelos y baterías" : "checklist completo"}</small></button>`);
    });
  }
  return `<div class="card"><h2>Siguiente paso</h2>
    ${filas.length ? filas.join("") : `<button class="paso" type="button" data-ir="levantamiento"><span>Registrar un levantamiento</span><small>elige instrumento y tipo</small></button>`}
    ${estado}</div>`;
}


/* v0.5.2 — Pronóstico de vuelo (paquete PronosticoVuelo del módulo Vuelos del sistema).
   Aparece en la jornada cuando el trabajo es de dron (aerofotogrametría o LiDAR). */
function jornadaEsDron(j) {
  return (j.objetivos || []).some((b) => b.plantillaId === "aer" || b.plantillaId === "lid");
}
function montarPronosticoJornada(j) {
  const cont = document.getElementById("pronosticoJornada");
  if (!cont) return;
  try {
    if (typeof PronosticoVuelo === "undefined") { cont.innerHTML = '<p class="muted">No se cargó el pronóstico de vuelo.</p>'; return; }
    const d = new Date(j.fechaInicio);
    const pad = (n) => String(n).padStart(2, "0");
    const fecha = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    let dronId = (j.clima && j.clima.dron) || null;
    if (!dronId) { try { dronId = localStorage.getItem("ultimoDron"); } catch (_) {} }
    PronosticoVuelo.montar(cont, {
      lat: j.lat, lon: j.lng, lugar: j.proyecto || "", dronId: dronId || "m4e", fecha,
      ultimo: j.clima || null,
      alGuardar: async (resumen) => {
        j.clima = resumen;
        await dbPut("jornadas", j);
        marcarPendienteSync(j.id);
        toast("Pronóstico guardado en la jornada");
        const linea = document.getElementById("pronLinea");
        if (linea) linea.textContent = lineaClima(j);
      },
      alCambiarDron: (id) => { try { localStorage.setItem("ultimoDron", id); } catch (_) {} }
    });
  } catch (err) {
    cont.innerHTML = '<p class="muted">No se pudo mostrar el pronóstico de vuelo.</p>';
    if (window.mostrarErrorApp) window.mostrarErrorApp(err);
  }
}


/* v0.5.3 — Elección de trabajos al iniciar la jornada: cuatro títulos (Dron, Topografía,
   Escaneo 3D, Batimetría); al tocar uno se abren sus opciones. Los ids son los de las
   plantillas de objetivos; lo que no calce en un grupo (plantillas propias) va a «Otros». */
const TRABAJOS_GRUPOS = [
  { g: "dron", titulo: "Dron", subs: [{ items: [["aer", "Aerofotogrametría"], ["lid", "LiDAR"]] }] },
  { g: "topo", titulo: "Topografía", subs: [
    { sub: "Nivel", items: [["niv", "Nivelación"]] },
    { sub: "Estación total", items: [["est", "Levantamiento y poligonal"], ["rep", "Replanteo"]] },
    { sub: "GNSS", items: [["rtk", "Levantamiento RTK"], ["red", "GNSS estático → Red geodésica"]] }
  ] },
  { g: "esc", titulo: "Escaneo 3D", subs: [{ items: [["ees", "Estático (FARO)"], ["esl", "Móvil (SLAM)"]] }] },
  { g: "bat", titulo: "Batimetría", subs: [{ items: [["bat", "Con bote"]] }] }
];
const TRABAJO_ETIQUETA = { est: "Estación total · levantamiento", rep: "Replanteo", rtk: "GNSS RTK", red: "GNSS estático → red" };
function trabajosHtml() {
  // 0.6.1: un solo nivel; los títulos ordenan pero no hay que abrir nada
  const hay = (id) => state.plantillas.some((p) => p.id === id);
  const usados = new Set();
  const grupos = TRABAJOS_GRUPOS.map((gr) => ({
    titulo: gr.titulo, items: gr.subs.flatMap((sb) => sb.items).filter(([id]) => hay(id))
  })).filter((gr) => gr.items.length);
  grupos.forEach((gr) => gr.items.forEach(([id]) => usados.add(id)));
  const otros = state.plantillas.filter((p) => !usados.has(p.id));
  if (otros.length) grupos.push({ titulo: "Otros", items: otros.map((p) => [p.id, p.nombre]) });
  if (!grupos.length) return '<span class="muted">Crea plantillas en ⚙ → General → Plantillas del checklist.</span>';
  const chip = ([id, txt]) => `<button type="button" class="chip-trabajo" data-id="${id}" aria-pressed="false">${escapeHtml(TRABAJO_ETIQUETA[id] || txt)}</button>`;
  return `<div class="trabajos-plano">${grupos.map((gr) =>
    `<div class="tp-grupo">${escapeHtml(gr.titulo)}</div><div class="chips-trabajo">${gr.items.map(chip).join("")}</div>`).join("")}</div>`;
}
