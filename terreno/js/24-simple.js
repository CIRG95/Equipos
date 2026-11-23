"use strict";

/* =========================================================================
   0.8.0 · MODO SIMPLE para ayudantes y alarifes (Sistema v0.19)
   Si en la ficha del Sistema la persona es «Ayudante» (y no «Encargado de terreno»),
   la app abre en «Inicio» con cuatro botones grandes:
     Mi jornada · Foto o punto · Gasto · Charla de seguridad.
   Monografías e Historial se ocultan (quedan para el encargado). Todo funciona sin conexión:
   lo registrado se guarda en el teléfono y se envía al Sistema al sincronizar.
   ========================================================================= */
const SIMPLE = { activo: false, charla: false, proyectos: [], companeros: [], proyectoId: null, guardando: false };
const TEMAS_CHARLA = ["Trabajo en altura", "Tránsito vehicular", "Exposición al sol", "Manejo de equipos", "Terreno irregular"];

function simpleSvg(d) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`; }

/** Consulta la ficha en el Sistema y activa o quita el modo simple. */
async function simpleAplicar() {
  let modo = "completo";
  try { if (SIS.listo && typeof SistemaConexion.miModo === "function") modo = (await SistemaConexion.miModo()).modo; } catch (_) {}
  const antes = SIMPLE.activo;
  SIMPLE.activo = modo === "simple";
  document.body.dataset.simple = SIMPLE.activo ? "1" : "";
  simpleBotonTab();
  if (SIMPLE.activo && !antes) irATab("simple");
  else if (!SIMPLE.activo && antes && ["simple", "monografias", "historial"].includes(state.tabActual)) irATab("jornada");
}

/** Pestaña «Inicio» en la barra inferior (solo en modo simple). */
function simpleBotonTab() {
  const nav = document.querySelector("nav.tabbar");
  if (!nav) return;
  let b = nav.querySelector('button[data-tab="simple"]');
  if (!SIMPLE.activo) { if (b) b.remove(); return; }
  if (!document.getElementById("tab-simple")) {
    const s = document.createElement("section");
    s.id = "tab-simple"; s.className = "tab-section";
    document.querySelector("main").appendChild(s);
  }
  if (!b) {
    b = document.createElement("button");
    b.dataset.tab = "simple";
    b.innerHTML = simpleSvg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>') + "Inicio";
    b.addEventListener("click", () => irATab("simple"));
    nav.insertBefore(b, nav.firstChild);
  }
}

function simpleRender() {
  const cont = document.getElementById("tab-simple");
  if (!cont) return;
  if (SIMPLE.charla) { simpleRenderCharla(cont); return; }
  const p = sisPersona();
  const j = jornadaActiva();
  const boton = (id, titulo, sub, icono, clase = "") => `<button type="button" class="simple-btn ${clase}" data-simple="${id}">${simpleSvg(icono)}<b>${titulo}</b><small>${sub}</small></button>`;
  cont.innerHTML = `
    <div class="simple-hola"><h2>${p ? "Hola, " + escapeHtml(String(p.nombre).split(" ")[0]) : "Hola"}</h2>
      <p class="muted">${j ? "Jornada en curso · " + escapeHtml(j.proyecto || "") : "¿Qué vas a hacer?"}</p></div>
    <div class="simple-grilla">
      ${boton("jornada", "Mi jornada", j ? "En curso: ver o terminar" : "Empezar el día", '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>', j ? "activo" : "")}
      ${boton("punto", "Foto o punto", "Registrar en terreno", '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>')}
      ${boton("gasto", "Gasto", "Boleta o factura", '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>')}
      ${boton("charla", "Charla de seguridad", "Antes de empezar", '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>')}
    </div>
    ${p ? "" : '<p class="muted" style="margin-top:12px;">Este teléfono no está vinculado. Pídele el código a tu encargado.</p>'}`;
  cont.querySelectorAll("[data-simple]").forEach((b) => b.addEventListener("click", () => {
    const a = b.dataset.simple;
    if (a === "jornada") irATab("jornada");
    else if (a === "punto") irATab("levantamiento");
    else if (a === "gasto") irATab("gastos");
    else if (a === "charla") simpleAbrirCharla();
  }));
}

/* ---------- Charla de seguridad ---------- */
async function simpleAbrirCharla() {
  SIMPLE.charla = true;
  try { SIMPLE.proyectos = await SistemaConexion.misProyectos(); } catch (_) { SIMPLE.proyectos = []; }
  const j = jornadaActiva();
  const deJornada = j && SIMPLE.proyectos.find((x) => x.nombre === j.proyecto);
  SIMPLE.proyectoId = (deJornada || SIMPLE.proyectos[0] || {}).id || null;
  await simpleCargarCompaneros();
  simpleRender();
}
async function simpleCargarCompaneros() {
  try { SIMPLE.companeros = SIMPLE.proyectoId ? await SistemaConexion.companerosDeProyecto(SIMPLE.proyectoId) : []; } catch (_) { SIMPLE.companeros = []; }
}

function simpleRenderCharla(cont) {
  const yo = sisPersona() || {};
  const sinProy = !SIMPLE.proyectos.length;
  cont.innerHTML = `
    <div class="simple-volver"><button type="button" class="btn btn-outline btn-sm" id="simpleVolver">← Volver</button></div>
    <div class="card"><h2>Charla de seguridad</h2>
      ${sinProy ? '<p class="muted" style="margin-top:6px;">No tienes proyectos asignados. Pídele a tu encargado que te sume a la cuadrilla.</p>' : `
      <form id="simpleCharla" class="simple-form">
        <label>Proyecto<select name="proyecto">${SIMPLE.proyectos.map((x) => `<option value="${escapeHtml(x.id)}" ${x.id === SIMPLE.proyectoId ? "selected" : ""}>${escapeHtml(x.nombre)}</option>`).join("")}</select></label>
        <fieldset><legend>Tema</legend><div class="simple-chips">${TEMAS_CHARLA.map((t, i) => `<label class="simple-chip"><input type="radio" name="temaBase" value="${escapeHtml(t)}" ${i === 0 ? "checked" : ""}><span>${escapeHtml(t)}</span></label>`).join("")}
          <label class="simple-chip"><input type="radio" name="temaBase" value=""><span>Otro</span></label></div>
          <input name="temaOtro" placeholder="Escribe el tema" hidden></fieldset>
        <fieldset><legend>¿Quiénes estuvieron?</legend>
          ${SIMPLE.companeros.map((x) => `<label class="simple-check"><input type="checkbox" name="asistentes" value="${escapeHtml(x.id)}" ${x.id === yo.id ? "checked" : ""}> ${escapeHtml(x.nombre)}</label>`).join("") || '<p class="muted">Sin cuadrilla registrada en el Sistema.</p>'}
          <input name="otros" placeholder="Otros (nombres separados por coma)"></fieldset>
        <button class="btn" type="submit" ${SIMPLE.guardando ? "disabled" : ""}>Guardar charla</button>
        <p class="muted" style="margin-top:6px;">Se guarda en el teléfono y llega al Sistema al sincronizar.</p>
      </form>`}
    </div>`;
  document.getElementById("simpleVolver").addEventListener("click", () => { SIMPLE.charla = false; simpleRender(); });
  const f = document.getElementById("simpleCharla");
  if (!f) return;
  f.proyecto.addEventListener("change", async () => { SIMPLE.proyectoId = f.proyecto.value; await simpleCargarCompaneros(); simpleRender(); });
  f.querySelectorAll('[name="temaBase"]').forEach((r) => r.addEventListener("change", () => { f.temaOtro.hidden = f.temaBase.value !== ""; if (!f.temaOtro.hidden) f.temaOtro.focus(); }));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (SIMPLE.guardando) return;
    const tema = f.temaBase.value || f.temaOtro.value.trim();
    if (!tema) { toast("Escribe el tema de la charla"); return; }
    const asistentes = [...f.querySelectorAll('[name="asistentes"]:checked')].map((x) => x.value);
    const otros = f.otros.value.split(",").map((s) => s.trim()).filter(Boolean);
    if (!asistentes.length && !otros.length) { toast("Marca quiénes estuvieron"); return; }
    SIMPLE.guardando = true;
    try {
      await SistemaConexion.registrarCharla({ proyectoId: f.proyecto.value, tema, asistentes, otros });
      SIMPLE.charla = false;
      toast("Charla registrada");
      Promise.resolve().then(() => SistemaConexion.sincronizar()).catch(() => {});
    } catch (err) { toast(err && err.message ? err.message : "No se pudo guardar la charla"); }
    SIMPLE.guardando = false;
    simpleRender();
  });
}
