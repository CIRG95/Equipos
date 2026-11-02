"use strict";

/* =========================================================================
   v0.5.6 — CONEXIÓN CON EL SISTEMA TOPOLAND (paquete TopolandConexion)
   Terreno sigue siendo su propia app: se vincula a una persona del Sistema y
   lee sus proyectos para elegirlos al iniciar la jornada. Nada de esto es
   obligatorio: sin vincular, la app funciona igual que antes.
   El paquete (js/topoland-conexion.js) es generado desde el Sistema: no editar.
   ========================================================================= */
const SIS = { listo: false, error: null, proyectos: [], proyectoIdSel: null };

function sisClienteId() {
  let c = (window.TOPOLAND_CONFIG || {}).googleClientId || "";
  if (!c) { try { c = localStorage.getItem("googleClientId") || ""; } catch (_) {} }
  return c;
}
function sisIniciar() {
  try {
    if (typeof TopolandConexion === "undefined") throw new Error("No se cargó el paquete de conexión");
    const info = TopolandConexion.iniciar({ clienteId: sisClienteId() });
    SIS.listo = true;
    TopolandConexion.alLlegarDatos(() => { sisRefrescar(); });
    TopolandConexion.alCambiarNube(() => { sisRenderConfig(); });
    if (info.carpetaPendiente) {   // abrió con el QR: trae la carpeta de la nube del Sistema
      let e = {}; try { e = TopolandConexion.estadoNube() || {}; } catch (_) {}
      if (e.conectado) {
        TopolandConexion.conectarNube().then(() => { toast("Nube del Sistema conectada"); sisRefrescar(); })
          .catch((err) => toast(err && err.message ? err.message : "No se pudo conectar la nube del Sistema"));
      } else toast("Abre ⚙ → Sistema Topoland y toca «Conectar nube del Sistema» para terminar.");
    }
    if (info.codigoPendiente && !info.persona) {
      TopolandConexion.vincular(info.codigoPendiente).then((p) => {
        if (p) toast("Vinculado con el Sistema: " + p.nombre);
        sisRefrescar();
      }).catch(() => {});
    }
  } catch (e) { SIS.error = e && e.message ? e.message : String(e); }
}
function sisPersona() {
  try { return SIS.listo ? TopolandConexion.persona() : null; } catch (_) { return null; }
}
function sisRefrescar() {
  sisRenderConfig();
  if (state.herramienta === "monografias" && !state.monografiaEnEdicionId && state.tabActual === "monografias") sisDespuesDeListado();
  if (!jornadaActiva() && state.tabActual === "jornada") sisCargarProyectosJornada();
}

/* ---------- Proyectos del Sistema al iniciar la jornada ---------- */
async function sisCargarProyectosJornada() {
  const cont = document.getElementById("proyectoSistema");
  if (!cont) return;
  SIS.proyectoIdSel = null;
  const p = sisPersona();
  if (!p) {
    cont.innerHTML = SIS.listo ? '<p class="muted" style="margin-top:6px;">Sin vincular con el Sistema. <a href="#" id="lnkVincularSistema">Vincular</a></p>' : "";
    const a = document.getElementById("lnkVincularSistema");
    if (a) a.addEventListener("click", (e) => { e.preventDefault(); document.getElementById("btnConfig").click(); });
    return;
  }
  let lista = [];
  try { lista = await TopolandConexion.misProyectos(); } catch (_) {}
  SIS.proyectos = lista;
  if (!document.getElementById("proyectoSistema")) return;
  cont.innerHTML = `<label>Proyecto del Sistema <span class="muted" style="font-weight:400;">(${escapeHtml(p.nombre)})</span></label>
    <select id="selProyectoSistema"><option value="">— elegir —</option>
      ${lista.map((x) => `<option value="${escapeHtml(x.id)}">${escapeHtml(x.nombre)}${x.mandante ? " · " + escapeHtml(x.mandante) : ""}</option>`).join("")}
      <option value="oficina">Oficina (sin proyecto de terreno)</option>
    </select>
    ${lista.length ? "" : '<p class="muted" style="margin-top:4px;">No eres encargado de ningún proyecto activo; puedes escribir uno abajo.</p>'}`;
  const sel = document.getElementById("selProyectoSistema");
  const inp = document.getElementById("inpProyecto");
  sel.addEventListener("change", () => {
    SIS.proyectoIdSel = sel.value || null;
    if (!sel.value) return;
    const x = lista.find((y) => y.id === sel.value);
    inp.value = x ? x.nombre : "Oficina";
  });
  inp.addEventListener("input", () => { SIS.proyectoIdSel = null; sel.value = ""; });
}

/* ---------- Sección en ⚙ ---------- */
function sisRenderConfig() {
  const el = document.getElementById("sistemaConfig");
  if (!el) return;
  if (!SIS.listo) {
    el.innerHTML = `<p class="muted">La conexión con el Sistema no está disponible${SIS.error ? " (" + escapeHtml(SIS.error) + ")" : ""}. La app funciona igual.</p>`;
    return;
  }
  const p = sisPersona();
  let n = {};
  try { n = TopolandConexion.estadoNube() || {}; } catch (_) {}
  const hora = n.ultimaSync ? new Date(n.ultimaSync).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "";
  const sinCarpeta = !n.carpetaId;
  const btnNube = `<button class="btn btn-outline" data-sis="nube" type="button" style="flex:1;">${sinCarpeta ? "Conectar nube del Sistema" : "Sincronizar ahora"}</button>`;
  const campoCarpeta = sinCarpeta ? `
    <label style="margin-top:12px;">Carpeta de la nube del Sistema</label>
    <p class="muted" style="font-size:12px;">Si no puedes usar el QR: en Google Drive abre la carpeta del Sistema, copia su enlace y pégalo aquí (con la misma cuenta de Google).</p>
    <input type="text" id="inpCarpetaSistema" placeholder="https://drive.google.com/drive/folders/…" autocapitalize="off" autocorrect="off">
    <button class="btn btn-outline" data-sis="carpeta" type="button" style="width:100%; margin-top:8px;">Usar esta carpeta</button>` : "";
  el.innerHTML = p ? `
    <p>Vinculado como <strong>${escapeHtml(p.nombre)}</strong>${p.cargo ? " · " + escapeHtml(p.cargo) : ""}.</p>
    <p class="muted">${n.carpetaId ? "Nube del Sistema: " + escapeHtml(n.carpetaNombre || "conectada") + (hora ? " · última sincronización " + hora : "") + (n.pendiente ? " · hay cambios por subir" : "") : "Sin carpeta de la nube del Sistema: los proyectos que ves son los de este teléfono."}</p>
    <div class="row" style="gap:8px; margin-top:8px;">
      ${btnNube}
      <button class="btn btn-outline" data-sis="desvincular" type="button" style="flex:1;">Desvincular</button>
    </div>${campoCarpeta}`
  : `
    <p class="muted">Escanea el QR del Sistema (Personas → Vincular teléfono) o escribe el código de 6 letras.</p>
    <input type="text" id="inpCodigoSistema" maxlength="8" autocapitalize="characters" placeholder="ABC234" style="text-transform:uppercase; letter-spacing:.2em; font-family:var(--mono);">
    <div class="row" style="gap:8px; margin-top:8px;">
      <button class="btn btn-accent" data-sis="vincular" type="button" style="flex:1;">Vincular</button>
      ${btnNube}
    </div>
    <p class="muted" style="font-size:12px; margin-top:6px;">En un teléfono nuevo, primero conecta la nube del Sistema (necesita la carpeta) para traer las personas.</p>${campoCarpeta}`;
}
document.addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-sis]");
  if (!b || !SIS.listo) return;
  try {
    if (b.dataset.sis === "vincular") {
      const r = await TopolandConexion.vincular(document.getElementById("inpCodigoSistema").value);
      toast(r ? "Vinculado: " + r.nombre : "No encontré ese código en este teléfono. Si es nuevo, conecta la nube primero.");
    } else if (b.dataset.sis === "nube" || b.dataset.sis === "carpeta") {
      if (!sisClienteId()) return toast("Falta el ID de cliente de Google (el del Sistema).");
      if (b.dataset.sis === "carpeta") {
        const v = (document.getElementById("inpCarpetaSistema").value || "").trim();
        if (!v) return toast("Pega el enlace de la carpeta de Drive.");
        // El paquete 1.2 toma la carpeta que dejó el QR en esta clave; aquí se deja la que pegó la persona.
        try { localStorage.setItem("topoland_conexion_carpeta", JSON.stringify(v)); } catch (_) {}
      }
      toast("Conectando…");
      const e = TopolandConexion.estadoNube() || {};
      if (e.carpetaId && e.conectado) { await TopolandConexion.sincronizar(); toast("Nube del Sistema al día"); }
      else {
        await TopolandConexion.conectarNube();
        const n2 = TopolandConexion.estadoNube() || {};
        toast(n2.carpetaId ? "Nube del Sistema conectada" : "Falta la carpeta: escanea el QR del Sistema o pega el enlace de la carpeta.");
      }
    } else if (b.dataset.sis === "desvincular") {
      if (!confirm("¿Desvincular este teléfono de la persona del Sistema?")) return;
      TopolandConexion.desvincular();
      toast("Teléfono desvinculado");
    }
  } catch (err) { toast(err && err.message ? err.message : "No se pudo"); }
  sisRefrescar();
});
document.getElementById("btnConfig").addEventListener("click", sisRenderConfig);


/* =========================================================================
   v0.5.7 — MONOGRAFÍAS Y JORNADAS HACIA EL SISTEMA (paquete 1.2)
   Los botones solo aparecen si el paquete trae publicarMonografia y el teléfono
   está vinculado. La monografía, su chequeo y su PDF no cambian; lo único nuevo
   en el registro es proyectoId (opcional). El estado que devuelve el Sistema se
   guarda aparte, en localStorage (sisMonoEstados), para no tocar el registro.
   ========================================================================= */
const SIS_ESTADOS_KEY = "sisMonoEstados";
const SIS_ETIQUETAS = { enviada: "Enviada", "en-revision": "En revisión", lista: "Lista", "con-observacion": "Con observación" };
const SIS_COLORES = { enviada: "#5B6B66", "en-revision": "#B4500F", lista: "#2e8b57", "con-observacion": "#B42318" };

function sisPuedePublicar() {
  try { return SIS.listo && !!sisPersona() && typeof TopolandConexion.publicarMonografia === "function"; } catch (_) { return false; }
}
function sisLeerEstados() { try { return JSON.parse(localStorage.getItem(SIS_ESTADOS_KEY) || "{}") || {}; } catch (_) { return {}; } }
function sisGuardarEstados(c) { try { localStorage.setItem(SIS_ESTADOS_KEY, JSON.stringify(c)); } catch (_) {} }

async function sisEnviarMonografia(m) {
  if (!m.proyectoId) throw new Error("Elige el proyecto del Sistema de esta monografía.");
  const r = await TopolandConexion.publicarMonografia(m, { proyectoId: m.proyectoId });
  const c = sisLeerEstados();
  c[m.id] = { estado: (r && r.estado) || "enviada", observacion: "", revisadoPor: null, fecha: nowISO(), enviadaEn: nowISO() };
  sisGuardarEstados(c);
  return r;
}
/* Trae el estado de cada proyecto con monografías enviadas; true si algo cambió. */
async function sisActualizarEstados() {
  if (!sisPuedePublicar() || typeof TopolandConexion.estadoMonografias !== "function") return false;
  const c = sisLeerEstados();
  const proyectos = [...new Set(state.monografias.filter((m) => m.proyectoId && c[m.id]).map((m) => m.proyectoId))];
  const antes = JSON.stringify(c);
  for (const pid of proyectos) {
    try {
      (await TopolandConexion.estadoMonografias(pid)).forEach((e) => {
        if (c[e.id]) c[e.id] = { ...c[e.id], estado: e.estado, observacion: e.observacion || "", revisadoPor: e.revisadoPor || null, fecha: e.fecha || c[e.id].fecha };
      });
    } catch (_) {}
  }
  const cambio = JSON.stringify(c) !== antes;
  if (cambio) sisGuardarEstados(c);
  return cambio;
}
function sisEstadoMonoHtml(m) {
  if (!sisPuedePublicar()) return "";
  const e = sisLeerEstados()[m.id];
  if (!e) return "";
  const col = SIS_COLORES[e.estado] || "#5B6B66";
  return `<div style="margin-top:4px;"><span style="display:inline-block; font-size:11px; font-weight:600; padding:1px 8px; border-radius:999px; border:1px solid ${col}; color:${col};">${escapeHtml(SIS_ETIQUETAS[e.estado] || e.estado)}</span></div>` +
    (e.estado === "con-observacion" && e.observacion ? `<div style="margin-top:4px; font-size:12px; color:#B42318;">⚠ ${escapeHtml(e.observacion)}</div>` : "");
}
function sisBotonMonoHtml(m) {
  return sisPuedePublicar() && m.proyectoId ? `<button class="btn btn-outline btn-sm" data-sis-mono="${m.id}" type="button" style="margin-top:6px;">⬆ Enviar al Sistema</button>` : "";
}
function sisBotonTodasHtml() {
  return sisPuedePublicar() ? `<button class="btn btn-outline" id="btnSisEnviarTodas" type="button" style="width:100%; margin-top:8px;">⬆ Enviar todas al Sistema</button>` : "";
}
/* Tras pintar el listado: pide los estados y, si cambiaron, repinta el listado. */
function sisDespuesDeListado() {
  if (!sisPuedePublicar()) return;
  sisActualizarEstados().then((cambio) => {
    if (cambio && state.herramienta === "monografias" && !state.monografiaEnEdicionId && state.tabActual === "monografias") renderMonografias();
  });
}

/* Selector de proyecto y botón enviar dentro de la ficha de la monografía */
async function sisMonoEditor(m, leerCampos) {
  const cont = document.getElementById("mProyectoSistema");
  if (!cont || !sisPersona()) return;
  let lista = [];
  try { lista = await TopolandConexion.misProyectos(); } catch (_) {}
  if (!document.getElementById("mProyectoSistema")) return;
  const opciones = lista.map((x) => [x.id, x.nombre]).concat([["oficina", "Oficina (sin proyecto de terreno)"]]);
  if (m.proyectoId && !opciones.some(([id]) => id === m.proyectoId)) opciones.push([m.proyectoId, "(proyecto actual)"]);
  cont.innerHTML = `<label>Proyecto del Sistema</label>
    <select id="mSelProyectoSistema"><option value="">— sin elegir —</option>${opciones.map(([id, n]) => `<option value="${escapeHtml(id)}" ${id === m.proyectoId ? "selected" : ""}>${escapeHtml(n)}</option>`).join("")}</select>`;
  if (sisPuedePublicar()) {
    cont.insertAdjacentHTML("beforeend", `<button class="btn btn-outline" id="btnEnviarSistema" type="button" style="width:100%; margin-top:8px;">⬆ Enviar al Sistema</button><div id="mEstadoSistema">${sisEstadoMonoHtml(m)}</div>`);
    document.getElementById("btnEnviarSistema").addEventListener("click", async () => {
      leerCampos();
      await dbPut("monografias", m);
      try { toast("Enviando…"); await sisEnviarMonografia(m); toast("Monografía enviada al Sistema"); }
      catch (e) { toast(e && e.message ? e.message : "No se pudo enviar"); }
      const est = document.getElementById("mEstadoSistema"); if (est) est.innerHTML = sisEstadoMonoHtml(m);
    });
  }
}

/* Jornada: al cerrar, ofrecer enviarla (con confirmación) */
async function sisPreguntarEnviarJornada(j) {
  if (!sisPuedePublicar() || !j.proyectoId || typeof TopolandConexion.publicarJornada !== "function") return;
  if (!confirm("¿Enviar esta jornada al Sistema (con sus levantamientos y fotos)?")) return;
  try {
    toast("Enviando jornada…");
    const r = await TopolandConexion.publicarJornada(j, state.levantamientos.filter((l) => l.jornadaId === j.id && !l.eliminado), { proyectoId: j.proyectoId });
    toast("Jornada enviada al Sistema" + (r && r.fotos ? " (" + r.fotos + " fotos)" : ""));
  } catch (e) { toast(e && e.message ? e.message : "No se pudo enviar la jornada"); }
}

document.addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-sis-mono], #btnSisEnviarTodas");
  if (!b || !sisPuedePublicar()) return;
  try {
    if (b.id === "btnSisEnviarTodas") {
      const con = state.monografias.filter((m) => m.proyectoId), sin = state.monografias.length - con.length;
      if (!con.length) return toast("Ninguna monografía tiene proyecto del Sistema. Elígelo en su ficha.");
      if (!confirm("Se enviarán " + con.length + " monografía(s) al Sistema." + (sin ? "\n" + sin + " sin proyecto del Sistema no se envían." : "") + "\n\n¿Continuar?")) return;
      let ok = 0, fallos = 0;
      toast("Enviando…");
      for (const m of con) { try { await sisEnviarMonografia(m); ok++; } catch (_) { fallos++; } }
      toast(ok + " enviada(s)" + (fallos ? ", " + fallos + " con error" : ""));
    } else {
      const m = state.monografias.find((x) => x.id === b.dataset.sisMono);
      if (!m) return;
      toast("Enviando…");
      await sisEnviarMonografia(m);
      toast("Monografía enviada al Sistema");
    }
  } catch (err) { toast(err && err.message ? err.message : "No se pudo enviar"); }
  if (state.herramienta === "monografias" && !state.monografiaEnEdicionId) renderMonografias();
});
