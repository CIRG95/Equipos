"use strict";

/* =========================================================================
   0.9.0 · LO QUE VIENE DEL SISTEMA (Sistema v0.20, paquete de conexión 1.7)
   El teléfono registra; el Sistema prepara y configura.
   · Vinculado: el checklist de cada trabajo, el semáforo de nivelación y los tipos de catastro
     se editan en el Sistema (Configuración › Checklist de terreno) y aquí solo se usan.
   · Al elegir un proyecto del Sistema, la jornada trae cargado el checklist de sus tipos de trabajo
     y Registrar muestra solo los instrumentos que corresponden.
   · Sin vincular, la app funciona igual que antes, con lo de fábrica o lo editado en el teléfono.
   ========================================================================= */
SIS.cfgTerreno = null;        // configuración recibida del Sistema (null = usar la del teléfono)
SIS.checklistSel = null;      // { plantillas, instrumentos } del proyecto elegido al iniciar la jornada

/** Aplica (o quita) la configuración del Sistema. Se llama al iniciar, al vincular y al llegar datos. */
async function sisAplicarConfigTerreno() {
  const vinculado = !!(SIS.listo && sisPersona() && typeof TopolandConexion.configTerreno === "function");
  if (!vinculado) {
    if (SIS.cfgTerreno) { SIS.cfgTerreno = null; cargarPlantillas(); cargarConfig(); }
    document.body.dataset.vinculado = "";
    return;
  }
  try {
    const cfg = await TopolandConexion.configTerreno();
    SIS.cfgTerreno = cfg;
    state.plantillas = cfg.plantillas;
    state.config.toleranciaTramoVerdeMm = cfg.tolerancia.verdeMm;
    state.config.toleranciaTramoAmarillaMm = cfg.tolerancia.amarilloMm;
    document.body.dataset.vinculado = "1";
  } catch (e) { console.error(e); }
}

/** Al elegir el proyecto de la jornada: carga su checklist y oculta la elección de trabajos. */
async function sisChecklistProyectoUI(id) {
  const box = document.getElementById("checklistProyecto");
  const wrap = document.getElementById("wrapTrabajos");
  SIS.checklistSel = null;
  if (!box || !wrap) return;
  const mostrarElegir = () => { box.hidden = true; wrap.hidden = false; };
  if (!id || id === "oficina" || typeof TopolandConexion.checklistDeProyecto !== "function") { mostrarElegir(); return; }
  let r = null;
  try { r = await TopolandConexion.checklistDeProyecto(id); } catch (e) { console.error(e); }
  if (!r) { mostrarElegir(); return; }
  SIS.checklistSel = r;
  if (!r.plantillas.length) { mostrarElegir(); return; }
  document.querySelectorAll(".chip-trabajo").forEach((b) => {
    const quiero = r.plantillas.some((p) => p.id === b.dataset.id);
    if (b.classList.contains("on") !== quiero) b.click();
  });
  box.innerHTML = `<label>Checklist del proyecto</label>
    <div class="chk-proy">${r.plantillas.map((p) => `<span class="chk-proy-item">✓ ${escapeHtml(p.nombre)}</span>`).join("")}</div>
    <p class="muted" style="font-size:13px;">Viene del Sistema según los tipos de trabajo del proyecto. <button type="button" class="link-btn" id="btnCambiarChecklist">Cambiar</button></p>`;
  box.hidden = false; wrap.hidden = true;
  document.getElementById("btnCambiarChecklist").addEventListener("click", () => { box.hidden = true; wrap.hidden = false; });
}

/** Equipos que la persona lleva (checklist de salida del Sistema), como sugerencias de «Equipo utilizado». */
async function sisSugerirEquipos(datalistId) {
  if (!SIS.listo || !sisPersona() || typeof TopolandConexion.misEquiposEnTerreno !== "function") return;
  try {
    const dl = document.getElementById(datalistId);
    if (!dl) return;
    const ya = new Set([...dl.options].map((o) => o.value));
    (await TopolandConexion.misEquiposEnTerreno()).forEach((e) => {
      const v = e.nombre + (e.numeroSerie ? ", N° serie " + e.numeroSerie : "");
      if (!ya.has(v)) { const o = document.createElement("option"); o.value = v; dl.insertBefore(o, dl.firstChild); }
    });
  } catch (e) { console.error(e); }
}

/** En teléfono, Historial y Monografías salen de la barra; se abren desde Hoy y Registrar, con un botón para volver. */
function barraVolver(tab) {
  if (document.body.dataset.modo === "pc" || !["historial", "monografias"].includes(tab)) return;
  const sec = document.getElementById("tab-" + tab);
  if (!sec || sec.querySelector(".barra-volver")) return;
  const d = document.createElement("div");
  d.className = "barra-volver";
  d.innerHTML = `<button type="button" class="btn btn-outline btn-sm">← Volver</button><b>${tab === "historial" ? "Mis jornadas" : "Monografías"}</b>`;
  d.querySelector("button").addEventListener("click", () => irATab(SIS.tabAnterior && SIS.tabAnterior !== tab ? SIS.tabAnterior : "jornada"));
  sec.insertBefore(d, sec.firstChild);
}
