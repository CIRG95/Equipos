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
  el.innerHTML = p ? `
    <p>Vinculado como <strong>${escapeHtml(p.nombre)}</strong>${p.cargo ? " · " + escapeHtml(p.cargo) : ""}.</p>
    <p class="muted">${n.carpetaId ? "Nube del Sistema: " + escapeHtml(n.carpetaNombre || "conectada") + (hora ? " · última sincronización " + hora : "") + (n.pendiente ? " · hay cambios por subir" : "") : "Sin nube del Sistema: los proyectos que ves son los de este teléfono."}</p>
    <div class="row" style="gap:8px; margin-top:8px;">
      <button class="btn btn-outline" data-sis="nube" type="button" style="flex:1;">${n.conectado ? "Sincronizar ahora" : "Conectar nube del Sistema"}</button>
      <button class="btn btn-outline" data-sis="desvincular" type="button" style="flex:1;">Desvincular</button>
    </div>`
  : `
    <p class="muted">Escanea el QR del Sistema (Personas → Vincular teléfono) o escribe el código de 6 letras.</p>
    <input type="text" id="inpCodigoSistema" maxlength="8" autocapitalize="characters" placeholder="ABC234" style="text-transform:uppercase; letter-spacing:.2em; font-family:var(--mono);">
    <div class="row" style="gap:8px; margin-top:8px;">
      <button class="btn btn-accent" data-sis="vincular" type="button" style="flex:1;">Vincular</button>
      <button class="btn btn-outline" data-sis="nube" type="button" style="flex:1;">${n.conectado ? "Sincronizar" : "Conectar nube del Sistema"}</button>
    </div>
    <p class="muted" style="font-size:12px; margin-top:6px;">En un teléfono nuevo, primero conecta la nube para traer las personas.</p>`;
}
document.addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-sis]");
  if (!b || !SIS.listo) return;
  try {
    if (b.dataset.sis === "vincular") {
      const r = await TopolandConexion.vincular(document.getElementById("inpCodigoSistema").value);
      toast(r ? "Vinculado: " + r.nombre : "No encontré ese código en este teléfono. Si es nuevo, conecta la nube primero.");
    } else if (b.dataset.sis === "nube") {
      if (!sisClienteId()) return toast("Falta el ID de cliente de Google (el del Sistema).");
      const e = TopolandConexion.estadoNube();
      toast("Conectando…");
      if (e.conectado) await TopolandConexion.sincronizar(); else await TopolandConexion.conectarNube();
      toast("Nube del Sistema al día");
    } else if (b.dataset.sis === "desvincular") {
      if (!confirm("¿Desvincular este teléfono de la persona del Sistema?")) return;
      TopolandConexion.desvincular();
      toast("Teléfono desvinculado");
    }
  } catch (err) { toast(err && err.message ? err.message : "No se pudo"); }
  sisRefrescar();
});
document.getElementById("btnConfig").addEventListener("click", sisRenderConfig);
