"use strict";

/* =========================================================================
   v0.5.6 — CONEXIÓN CON EL SISTEMA (paquete de conexión)
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
      } else toast("Abre ⚙ → Sistema y sigue los pasos para terminar.");
    }
    // Paquete 1.3: el código del QR queda guardado y se vincula solo cuando llegan las personas desde la nube.
    if (typeof TopolandConexion.alVincular === "function") {
      TopolandConexion.alVincular((p) => { toast("Vinculado con el Sistema: " + p.nombre); sisRefrescar(); });
    } else if (info.codigoPendiente && !info.persona) {
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
    if (a) a.addEventListener("click", (e) => { e.preventDefault(); document.getElementById("btnConfig").click(); cfgIrA("sistema"); });
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
  const cid = !!sisClienteId();
  if (n.sincronizando) { if (!SIS.syncDesde) SIS.syncDesde = Date.now(); } else SIS.syncDesde = 0;
  const seg = SIS.syncDesde ? Math.round((Date.now() - SIS.syncDesde) / 1000) : 0;
  const hora = n.ultimaSync ? new Date(n.ultimaSync).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const ok1 = !!n.conectado, ok2 = !!n.carpetaId, ok3 = !!n.ultimaSync && ok2, ok4 = !!p;
  const actual = !cid ? 0 : !ok1 ? 1 : !ok2 ? 2 : !ok3 ? 3 : !ok4 ? 4 : 5;
  const cls = (k, ok) => "sis-paso" + (ok ? " hecho" : actual === k ? " actual" : "");
  const marca = (ok) => ok ? "✔" : "○";
  const err = [SIS.ultimoError, n.error].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
  let qr = ""; try { qr = (!ok4 && TopolandConexion.codigoQR && TopolandConexion.codigoQR()) || ""; } catch (_) {}
  const resumen = ok4
    ? `<p><strong>Listo.</strong> Vinculado como <strong>${escapeHtml(p.nombre)}</strong>${p.cargo ? " · " + escapeHtml(p.cargo) : ""}.</p>`
    : "";
  if (ok4 && ok2) {
    // Ya vinculado y con carpeta: vista corta. La sesión de Google dura 1 hora; si venció, basta un toque para renovarla.
    const diag = `Sitio: ${escapeHtml(location.origin)}<br>Internet: ${navigator.onLine ? "sí" : "no"}<br>Sesión de Google: ${ok1 ? "sí" : "vencida"}<br>Carpeta: ${escapeHtml(n.carpetaNombre || "conectada")}<br>Última sincronización: ${hora || "—"}`;
    el.innerHTML = `
      <div class="sis-paso hecho">
        <h4>✔ Conectado con el Sistema</h4>
        <p style="margin:2px 0;">Vinculado como <strong>${escapeHtml(p.nombre)}</strong>${p.cargo ? " · " + escapeHtml(p.cargo) : ""}.</p>
        <p class="muted" style="font-size:12px; margin:2px 0;">Nube: <strong>${escapeHtml(n.carpetaNombre || "conectada")}</strong>${hora ? " · última sincronización " + hora : ""}${n.pendiente ? " · hay cambios por subir" : ""}</p>
        ${n.sincronizando ? `<p class="muted" style="font-size:12px;">Sincronizando desde hace ${seg} s…</p>
          <button class="btn btn-outline" data-sis="reiniciar" type="button" style="width:100%;">Reiniciar la app</button>`
        : ok1 ? `<button class="btn btn-accent" data-sis="sync" type="button" style="width:100%; margin-top:8px;">Sincronizar ahora</button>`
        : `<p class="muted" style="font-size:12px; margin-top:6px;">La sesión de Google se cierra sola cada hora. Tus datos no se pierden: toca para renovarla y sincronizar.</p>
          <button class="btn btn-accent" data-sis="google" type="button" style="width:100%;">Renovar sesión de Google</button>`}
      </div>
      ${err.length ? `<div class="sis-err"><strong>Último error:</strong><br>${err.map(escapeHtml).join("<br>")}</div>` : ""}
      <details style="margin-top:12px; font-size:12px;" class="muted">
        <summary>Más opciones</summary>
        <div style="margin-top:6px;">${diag}</div>
        ${ok1 ? `<button class="btn btn-outline btn-sm" data-sis="probar" type="button" style="width:100%; margin-top:8px;">Ver qué hay en la carpeta de Drive</button>
        <div id="sisProbar" style="margin-top:6px; word-break:break-word;">${SIS.probar || ""}</div>` : ""}
        <button class="btn btn-outline btn-sm danger" data-sis="desvincular" type="button" style="width:100%; margin-top:8px;">Desvincular este teléfono</button>
      </details>`;
    return;
  }
  el.innerHTML = `
    <p class="muted">Conecta este teléfono con el Sistema en 4 pasos. Haz cada uno en orden.</p>
    ${resumen}
    ${!cid ? `<div class="sis-err">Falta el ID de cliente de Google (el del Sistema). Sin él no se puede conectar la nube. Avisa a quien administra el Sistema.</div>` : ""}

    <div class="${cls(1, ok1)}">
      <h4>${marca(ok1)} Paso 1 · Entrar con Google</h4>
      <p class="muted" style="font-size:12px;">Usa la misma cuenta de Google que usa el Sistema en el computador. Si el navegador bloquea la ventana de Google, permítela (en Brave: desactiva «Shields» para este sitio).</p>
      ${ok1 ? "" : `<button class="btn btn-accent" data-sis="google" type="button" style="width:100%;">Entrar con Google</button>`}
    </div>

    <div class="${cls(2, ok2)}">
      <h4>${marca(ok2)} Paso 2 · Carpeta de la nube del Sistema</h4>
      ${ok2 ? `<p class="muted" style="font-size:12px;">Carpeta: <strong>${escapeHtml(n.carpetaNombre || "conectada")}</strong></p>`
        : `<p class="muted" style="font-size:12px;">En el computador, abre esa carpeta en Google Drive, copia su enlace y pégalo aquí. La carpeta debe estar compartida contigo como «Editor».</p>
      <input type="text" id="inpCarpetaSistema" placeholder="https://drive.google.com/drive/folders/…" autocapitalize="off" autocorrect="off">
      <button class="btn btn-accent" data-sis="carpeta" type="button" style="width:100%; margin-top:8px;">Usar esta carpeta</button>`}
    </div>

    <div class="${cls(3, ok3)}">
      <h4>${marca(ok3)} Paso 3 · Traer los datos del Sistema</h4>
      <p class="muted" style="font-size:12px;">${ok3 ? "Última sincronización: " + hora + (n.pendiente ? " · hay cambios por subir" : "") : "Descarga las personas y proyectos que subió el Sistema. Antes, en el computador, sincroniza el Sistema."}</p>
      ${ok2 && n.sincronizando ? `<p class="muted" style="font-size:12px;">Sincronizando desde hace ${seg} s. Con una carpeta grande puede tardar; si pasa de 2 minutos, reinicia la app.</p>
        <button class="btn btn-outline" data-sis="reiniciar" type="button" style="width:100%;">Reiniciar la app</button>`
        : ok2 ? `<button class="btn btn-outline" data-sis="sync" type="button" style="width:100%;">Sincronizar ahora</button>` : ""}
      ${ok2 ? `<button class="btn btn-outline btn-sm" data-sis="probar" type="button" style="width:100%; margin-top:8px;">Ver qué hay en la carpeta de Drive</button>
      <div id="sisProbar" class="muted" style="font-size:12px; margin-top:6px; word-break:break-word;">${SIS.probar || ""}</div>` : ""}
    </div>

    <div class="${cls(4, ok4)}">
      <h4>${marca(ok4)} Paso 4 · Vincular tu persona</h4>
      ${ok4 ? `<button class="btn btn-outline" data-sis="desvincular" type="button" style="width:100%;">Desvincular este teléfono</button>`
        : `${qr ? `<p class="muted" style="font-size:12px;">Código del QR guardado: <strong style="font-family:var(--mono); letter-spacing:.15em;">${escapeHtml(qr)}</strong>. Se vincula solo al terminar el paso 3.</p>`
          : `<p class="muted" style="font-size:12px;">En el Sistema: Personas → Vincular teléfono. Escribe aquí el código de 6 letras.</p>`}
      <input type="text" id="inpCodigoSistema" maxlength="8" autocapitalize="characters" placeholder="ABC234" value="${escapeHtml(qr)}" style="text-transform:uppercase; letter-spacing:.2em; font-family:var(--mono);">
      <button class="btn btn-accent" data-sis="vincular" type="button" style="width:100%; margin-top:8px;">Vincular</button>`}
    </div>

    ${err.length ? `<div class="sis-err"><strong>Último error:</strong><br>${err.map(escapeHtml).join("<br>")}</div>` : ""}
    <details style="margin-top:12px; font-size:12px;" class="muted">
      <summary>Datos para diagnóstico</summary>
      <div>Sitio: ${escapeHtml(location.origin)}<br>Internet: ${navigator.onLine ? "sí" : "no"}<br>ID de cliente Google: ${cid ? "sí" : "no"}<br>Sesión de Google: ${ok1 ? "sí" : "no"}<br>Carpeta: ${ok2 ? "sí" : "no"}<br>Sincronizada: ${ok3 ? "sí (" + hora + ")" : "no"}<br>Persona vinculada: ${ok4 ? "sí" : "no"}</div>
    </details>`;
}
document.addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-sis]");
  if (!b || !SIS.listo) return;
  SIS.ultimoError = "";
  try {
    const k = b.dataset.sis;
    if (k === "vincular") {
      const cod = (document.getElementById("inpCodigoSistema").value || "").trim();
      if (!cod) return toast("Escribe el código de 6 letras.");
      const r = await TopolandConexion.vincular(cod);
      if (!r) {
        const motivo = typeof TopolandConexion.explicarVinculo === "function" ? await TopolandConexion.explicarVinculo(cod) : "";
        throw new Error(motivo || "No encontré ese código. Revisa que el paso 3 haya terminado y que el código esté vigente en el Sistema.");
      }
      toast("Vinculado: " + r.nombre);
    } else if (k === "reiniciar") {
      location.reload(); return;
    } else if (k === "probar") {
      await sisProbarCarpeta(); return;
    } else if (k === "google" || k === "carpeta" || k === "sync") {
      if (!sisClienteId()) throw new Error("Falta el ID de cliente de Google (el del Sistema).");
      if (k === "carpeta") {
        const v = (document.getElementById("inpCarpetaSistema").value || "").trim();
        if (!v) throw new Error("Pega el enlace de la carpeta de Drive.");
        // El paquete 1.2 toma la carpeta que dejó el QR en esta clave; aquí se deja la que pegó la persona.
        try { localStorage.setItem("topoland_conexion_carpeta", JSON.stringify(v)); } catch (_) {}
      }
      toast("Conectando…");
      const e = TopolandConexion.estadoNube() || {};
      if (e.sincronizando) throw new Error("Ya hay una sincronización en curso. Espera a que termine o reinicia la app.");
      if (k === "sync" && e.carpetaId && e.conectado) {
        const r = await TopolandConexion.sincronizar();
        if (r === null) throw new Error("No se pudo sincronizar: falta sesión de Google o carpeta.");
        toast("Nube del Sistema al día");
      } else {
        await TopolandConexion.conectarNube();
        const n2 = TopolandConexion.estadoNube() || {};
        if (k === "carpeta" && !n2.carpetaId) throw new Error("No se pudo usar esa carpeta. Revisa el enlace y que esté compartida contigo como Editor.");
        toast(n2.carpetaId ? "Nube del Sistema conectada" : "Sesión de Google lista. Sigue con el paso 2.");
      }
    } else if (k === "desvincular") {
      if (!confirm("¿Desvincular este teléfono de la persona del Sistema?")) return;
      TopolandConexion.desvincular();
      toast("Teléfono desvinculado");
    }
  } catch (err) {
    SIS.ultimoError = err && err.message ? err.message : String(err || "Error desconocido");
    toast(SIS.ultimoError);
  }
  sisRefrescar();
});
try { TopolandConexion.alCambiarNube(() => { if (SIS.listo) sisRenderConfig(); }); } catch (_) {}

/* Mira la carpeta de Drive directamente (solo lectura) para saber si el computador subió datos. */
async function sisProbarCarpeta() {
  const box = () => document.getElementById("sisProbar");
  const poner = (h) => { SIS.probar = h; if (box()) box().innerHTML = h; };
  poner("Consultando Drive…");
  let token = null;
  try { token = (JSON.parse(localStorage.getItem("topoland_nube_token") || "null") || {}).token; } catch (_) {}
  const n = TopolandConexion.estadoNube() || {};
  if (!token || !n.carpetaId) return poner("No hay sesión de Google o carpeta. Repite los pasos 1 y 2.");
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 20000);
  const q = async (qs) => {
    const r = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=100&fields=files(id,name,mimeType,size,modifiedTime)&q=" + encodeURIComponent(qs), { headers: { Authorization: "Bearer " + token }, signal: ctl.signal });
    if (!r.ok) throw new Error("Drive respondió " + r.status);
    return (await r.json()).files || [];
  };
  try {
    const hijos = await q(`'${n.carpetaId}' in parents and trashed=false`);
    const datos = hijos.find((f) => f.name === "datos" && f.mimeType === "application/vnd.google-apps.folder");
    let html = `Carpeta «${escapeHtml(n.carpetaNombre || "")}»: ${hijos.length} elemento(s). `;
    if (!datos) html += "<strong>No tiene la subcarpeta «datos»</strong>: el Sistema del computador todavía no subió nada a esta carpeta.";
    else {
      const arch = (await q(`'${datos.id}' in parents and trashed=false`)).filter((f) => /\.json$/.test(f.name));
      html += arch.length ? `En «datos» hay ${arch.length} archivo(s):<br>` + arch.map((f) => `• ${escapeHtml(f.name.slice(0, 14))}… · ${f.size ? (f.size / 1048576).toFixed(2) + " MB" : "?"} · ${new Date(f.modifiedTime).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`).join("<br>")
        : "<strong>«datos» está vacía</strong>: sincroniza el Sistema en el computador.";
    }
    poner(html);
  } catch (e) {
    poner("No se pudo leer la carpeta: " + escapeHtml(e.name === "AbortError" ? "Google no respondió en 20 s" : (e.message || String(e))));
  } finally { clearTimeout(to); }
}
setInterval(() => {
  const c = document.getElementById("configModal");
  if (SIS.listo && c && !c.classList.contains("hidden") && document.querySelector('[data-cfgpane="sistema"]').style.display !== "none") {
    const act = document.activeElement;
    if (!act || act.tagName !== "INPUT") sisRenderConfig();
  }
}, 5000);

/* ---------- Subpestañas de Ajustes ---------- */
function cfgIrA(tab) {
  document.querySelectorAll(".cfg-pane").forEach((p) => { p.style.display = p.dataset.cfgpane === tab ? "" : "none"; });
  document.querySelectorAll(".cfg-tab").forEach((t) => t.classList.toggle("on", t.dataset.cfgtab === tab));
  if (tab === "sistema") sisRenderConfig();
}
document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-cfgtab]");
  if (t) cfgIrA(t.dataset.cfgtab);
});
document.getElementById("btnConfig").addEventListener("click", () => cfgIrA("general"));
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
