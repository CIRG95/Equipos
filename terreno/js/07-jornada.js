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
        <p class="muted">Registra el inicio de tu jornada en terreno junto con tu ubicación.</p>
        <div class="divider"></div>
        <label>Proyecto</label>
        <input type="text" id="inpProyecto" list="listaProyectos" placeholder="Ej: PV El Romero Solar">
        <datalist id="listaProyectos">
          ${[...new Set(state.jornadas.map((j) => j.proyecto).filter(Boolean))].map((pr) => `<option value="${escapeHtml(pr)}">`).join("")}
        </datalist>
        <label>Operador</label>
        <input type="text" id="inpOperador" list="listaOperadores" placeholder="Nombre de quién levanta">
        <datalist id="listaOperadores">
          ${[...new Set(state.jornadas.map((j) => j.operador).filter(Boolean))].map((op) => `<option value="${escapeHtml(op)}">`).join("")}
        </datalist>
        <label>¿Qué trabajos harás hoy? <span class="muted" style="font-weight:400;">(arma los objetivos solos)</span></label>
        ${trabajosHtml()}
        <label>Ubicación de inicio</label>
        <div id="jornadaUbicPreview" class="muted" style="margin-bottom:10px;">Sin capturar aún</div>
        <div class="row">
          <button class="btn btn-outline" id="btnGpsJornada" type="button">📍 Usar GPS</button>
          <button class="btn btn-outline" id="btnMapaJornada" type="button">🗺️ Marcar en mapa</button>
        </div>
        <div class="divider"></div>
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

    const elegidos = new Set();
    document.querySelectorAll(".chip-trabajo").forEach((b) => b.addEventListener("click", () => {
      if (elegidos.has(b.dataset.id)) elegidos.delete(b.dataset.id); else elegidos.add(b.dataset.id);
      b.setAttribute("aria-pressed", elegidos.has(b.dataset.id) ? "true" : "false");
      b.classList.toggle("on", elegidos.has(b.dataset.id));
      actualizarGruposTrabajo();
    }));
    document.querySelectorAll(".grupo-trabajo").forEach((g) => g.addEventListener("click", () => {
      const abrir = g.getAttribute("aria-expanded") !== "true";
      document.querySelectorAll(".grupo-trabajo").forEach((x) => x.setAttribute("aria-expanded", "false"));
      document.querySelectorAll(".panel-trabajo").forEach((x) => { x.hidden = true; });
      if (abrir) { g.setAttribute("aria-expanded", "true"); document.getElementById("panel-" + g.dataset.g).hidden = false; }
    }));
    function actualizarGruposTrabajo() {
      document.querySelectorAll(".grupo-trabajo").forEach((g) => {
        const n = document.querySelectorAll("#panel-" + g.dataset.g + " .chip-trabajo.on").length;
        g.classList.toggle("on", n > 0);
        g.querySelector(".gt-n").textContent = n ? String(n) : "";
      });
    }
    let ubicTemp = null;
    document.getElementById("btnGpsJornada").addEventListener("click", async () => {
      toast("Buscando GPS…");
      const pos = await getUbicacionActual();
      if (!pos) return toast("No se pudo obtener el GPS. Prueba marcar en el mapa.");
      ubicTemp = pos;
      document.getElementById("jornadaUbicPreview").textContent = fmtCoord(pos.lat, pos.lng);
    });
    document.getElementById("btnMapaJornada").addEventListener("click", () => {
      abrirMapModal(ubicTemp?.lat, ubicTemp?.lng, (pos) => {
        ubicTemp = pos;
        document.getElementById("jornadaUbicPreview").textContent = fmtCoord(pos.lat, pos.lng);
      });
    });
    document.getElementById("btnIniciarJornada").addEventListener("click", async () => {
      const operador = inpOperador.value.trim();
      if (operador) localStorage.setItem("ultimoOperador", operador);
      const proyecto = document.getElementById("inpProyecto").value.trim();
      if (proyecto) localStorage.setItem("ultimoProyecto", proyecto);
      const nueva = {
        id: uuid(),
        fechaInicio: nowISO(),
        fechaTermino: null,
        horas: null,
        operador: operador || null,
        proyecto: proyecto || null,
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
    });
    return;
  }

  // Jornada en curso
  j.objetivos = j.objetivos || []; // compatibilidad con jornadas creadas antes de esta función
  const levs = levantamientosDeJornada(j.id);
  el.innerHTML = `
    ${tarjetaSiguientePasoHtml(j, levs)}
    <div class="card">
      <h2>Jornada en curso</h2>
      <p class="muted">Proyecto: ${j.proyecto ? "<strong>" + escapeHtml(j.proyecto) + "</strong>" : "sin proyecto"} <button class="btn btn-outline btn-sm" id="btnCambiarProyecto" type="button" style="margin-left:6px;">✏️</button></p>
      ${j.operador ? `<p class="muted">Operador: ${escapeHtml(j.operador)}</p>` : ""}
      <p class="muted">Iniciada: ${fmtFecha(j.fechaInicio)}</p>
      <p class="muted">Ubicación: ${fmtCoord(j.lat, j.lng)}</p>
      <div style="text-align:center; margin:18px 0;">
        <div style="font-family:var(--mono); font-size:34px; font-weight:700; color:var(--primary-dark);" id="relojJornada">
          ${fmtDuracion(Date.now() - new Date(j.fechaInicio).getTime())}
        </div>
        <div class="muted">tiempo transcurrido</div>
      </div>
      <p class="muted">${levs.length} levantamiento${levs.length === 1 ? "" : "s"} registrado${levs.length === 1 ? "" : "s"} en esta jornada</p>
      <div class="divider"></div>
      <button class="btn btn-danger" id="btnTerminarJornada" type="button">Terminar jornada</button>
    </div>
    ${jornadaEsDron(j) ? '<div id="pronosticoJornada"></div>' : ""}
    <div class="card">
      <h2>Objetivos del día</h2>
      ${j.objetivos.length ? j.objetivos.map((bloque) => `
        <div style="margin-bottom:14px;">
          <div style="font-weight:600; margin-bottom:6px;">${escapeHtml(bloque.plantillaNombre)}</div>
          ${bloque.items.map((it) => renderItemObjetivo(bloque.id, it)).join("")}
        </div>
      `).join("") : `<p class="muted">Sin objetivos agregados aún.</p>`}
      <div class="divider"></div>
      <label>Agregar plantilla de objetivos</label>
      <div class="row">
        <select id="selPlantillaObjetivo" style="flex:1;">
          ${state.plantillas.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join("")}
        </select>
        <button class="btn btn-outline btn-sm" id="btnAgregarObjetivo" type="button">Agregar</button>
      </div>
      ${!state.plantillas.length ? `<p class="muted">No tienes plantillas creadas — usa el ícono 📋 del header.</p>` : ""}
    </div>
  `;
  el.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => {
    const [tab, instr, tipo] = b.dataset.ir.split("|");
    if (instr) state.preseleccionLev = { instrumento: instr, tipo: tipo };
    irATab(tab);
  }));
  document.getElementById("btnTerminarJornada").addEventListener("click", async () => {
    if (levantamientoActivo()) {
      return toast("Primero finaliza el levantamiento en curso.");
    }
    if (!confirm("¿Terminar la jornada ahora?")) return;
    j.fechaTermino = nowISO();
    j.horas = (new Date(j.fechaTermino) - new Date(j.fechaInicio)) / 3600000;
    j.estado = "cerrada";
    await dbPut("jornadas", j);
    state.jornadaActivaId = null;
    marcarPendienteSync(j.id);
    toast("Jornada terminada — " + j.horas.toFixed(2) + " h");
    renderTabActual();
  });
  wireObjetivosJornada(j);
  montarPronosticoJornada(j);
  document.getElementById("btnCambiarProyecto").addEventListener("click", async () => {
    const nuevo = prompt("Proyecto de esta jornada:", j.proyecto || "");
    if (nuevo === null) return;
    j.proyecto = nuevo.trim() || null;
    if (j.proyecto) localStorage.setItem("ultimoProyecto", j.proyecto);
    await dbPut("jornadas", j);
    marcarPendienteSync(j.id);
    renderTabActual();
  });
}

/* Dibuja el control correcto para un ítem de objetivo según su tipo. */
function renderItemObjetivo(bloqueId, it) {
  const key = bloqueId + "::" + it.id;
  if (it.tipo === "check") {
    return `
      <label style="display:flex; align-items:center; gap:8px; margin-bottom:2px; cursor:pointer;">
        <input type="checkbox" data-obj-check="${key}" ${it.marcado ? "checked" : ""}>
        <span style="flex:1;">${escapeHtml(it.texto)}</span>
        ${it.hora ? `<span class="muted" style="font-size:12px;">${fmtHoraCorta(it.hora)}</span>` : ""}
      </label>
      <input type="text" data-obj-nota="${key}" value="${escapeHtml(it.nota || "")}" placeholder="Nota (opcional)" style="margin:2px 0 10px; font-size:13px;">
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
  const estado = `<div class="paso-estado ${totalPend ? "pend" : "ok"}">${objs.length ? (totalPend ? "Faltan " + totalPend + " de " + objs.length + " ítems de objetivos" : "Todos los objetivos marcados") : "Sin objetivos: agrégalos más abajo"}</div>`;
  return `<div class="card"><h2>Siguiente paso</h2>
    ${filas.length ? filas.join("") : `<p class="muted">Inicia un levantamiento desde la pestaña Levantamiento.</p><button class="paso" type="button" data-ir="levantamiento"><span>Ir a Levantamiento</span><small>elige instrumento y tipo</small></button>`}
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
function trabajosHtml() {
  const hay = (id) => state.plantillas.some((p) => p.id === id);
  const usados = new Set();
  const grupos = TRABAJOS_GRUPOS.map((gr) => ({
    ...gr, subs: gr.subs.map((sb) => ({ ...sb, items: sb.items.filter(([id]) => hay(id)) })).filter((sb) => sb.items.length)
  })).filter((gr) => gr.subs.length);
  grupos.forEach((gr) => gr.subs.forEach((sb) => sb.items.forEach(([id]) => usados.add(id))));
  const otros = state.plantillas.filter((p) => !usados.has(p.id));
  if (otros.length) grupos.push({ g: "otros", titulo: "Otros", subs: [{ items: otros.map((p) => [p.id, p.nombre]) }] });
  if (!grupos.length) return '<span class="muted">Crea plantillas con el ícono 📋.</span>';
  const chip = ([id, txt]) => `<button type="button" class="chip-trabajo" data-id="${id}" aria-pressed="false">${escapeHtml(txt)}</button>`;
  return `<div class="grupos-trabajo">${grupos.map((gr) =>
    `<button type="button" class="grupo-trabajo" data-g="${gr.g}" aria-expanded="false">${escapeHtml(gr.titulo)} <span class="gt-n"></span></button>`).join("")}</div>
    ${grupos.map((gr) => `<div class="panel-trabajo" id="panel-${gr.g}" hidden>${gr.subs.map((sb) =>
      (sb.sub ? `<div class="sub-trabajo">${escapeHtml(sb.sub)}</div>` : "") + `<div class="chips-trabajo">${sb.items.map(chip).join("")}</div>`).join("")}</div>`).join("")}`;
}
