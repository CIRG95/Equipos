"use strict";

/* =========================================================================
   v0.5.9 — GASTOS (paquete de conexión 1.4)
   Registrar el gasto en el momento y en el lugar: foto de la boleta, monto y
   categoría. Mismas reglas y datos que el módulo Gastos del Sistema:
   · el gasto queda en el borrador de la cuenta persona × proyecto;
   · la rendición se envía desde el Sistema al cerrar el proyecto;
   · la foto de la boleta (o del comprobante que llega al correo) es obligatoria;
   · sin señal se guarda en el teléfono y sube con la próxima sincronización.
   Terreno solo agrega y corrige gastos propios (borrador o rendición devuelta).
   ========================================================================= */
const GT = { proyectoId: null, proyectos: [], datos: null, cargando: false, error: null, hoja: null, avisoTimer: null, oyente: false };
const GT_KEY_PROY = "gastosProyecto";
const GT_ICONOS = { "Combustible": "⛽", "Alimentación": "🍽️", "Alojamiento": "🛏️", "Peajes": "🛣️", "Movilización": "🚕", "Materiales": "🧰", "Otros": "📦" };
const GT_ESTADOS = { borrador: ["Borrador", "gris"], enviada: ["Enviada", "azul"], devuelta: ["Devuelta", "ambar"], pagada: ["Pagada", "verde"] };
const GT_SVG = {
  camara: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  galeria: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  boleta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/></svg>',
};

/* ---------- Utilidades ---------- */
function gtClp(n) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? "−" : "") + "$ " + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function gtLeerMonto(t) {
  const s = String(t == null ? "" : t).replace(/[^\d,]/g, "");
  if (!s) return null;
  const [e, d] = s.split(",");
  const n = Number(e || "0") + (d ? Number("0." + d) : 0);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function gtHoy() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function gtFecha(iso) {
  if (!iso) return "";
  if (iso === gtHoy()) return "hoy";
  const [a, m, d] = iso.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return Number(d) + " " + meses[Number(m) - 1] + (a !== gtHoy().slice(0, 4) ? " " + a : "");
}
const gtPlural = (n, s, p) => n + " " + (n === 1 ? s : p);
const gtChip = (e) => `<span class="gt-chip ${GT_ESTADOS[e][1]}">${GT_ESTADOS[e][0]}</span>`;
function gtConectado() { return typeof sisPersona === "function" && !!sisPersona() && typeof TopolandConexion !== "undefined" && typeof TopolandConexion.misGastos === "function"; }
function gtNombreProyecto(id) { const p = GT.proyectos.find((x) => x.id === id); return p ? p.nombre : "Proyecto"; }

/** Proyecto que se muestra: el de la jornada abierta, el último usado, el primero propio o «Oficina». */
function gtProyectoInicial() {
  const ok = (id) => id && GT.proyectos.some((p) => p.id === id);
  const j = typeof jornadaActiva === "function" ? jornadaActiva() : null;
  if (j && ok(j.proyectoId)) return j.proyectoId;
  let ult = ""; try { ult = localStorage.getItem(GT_KEY_PROY) || ""; } catch (_) {}
  if (ok(ult)) return ult;
  return (GT.proyectos[0] || { id: "oficina" }).id;
}

/* ---------- Estado de la nube (texto corto) ---------- */
function gtNubeHtml() {
  let e = {}; try { e = TopolandConexion.estadoNube() || {}; } catch (_) {}
  if (e.sincronizando) return '<span class="gt-nube sube">☁ Subiendo…</span>';
  if (!e.conectado) return '<span class="gt-nube local" title="Se sube cuando conectes la nube del Sistema">📱 Guardado en el teléfono</span>';
  if (e.pendiente) return '<span class="gt-nube pend">☁ Pendiente de subir</span>';
  return '<span class="gt-nube ok">☁ Al día</span>';
}

/* ---------- Pestaña Gastos ---------- */
async function renderGastos() {
  const el = document.getElementById("tab-gastos");
  if (!el) return;
  if (!gtConectado()) {
    el.innerHTML = `<div class="card gt-vacio-card">
      <div class="gt-ico-grande">${GT_SVG.boleta}</div>
      <h2>Gastos del proyecto</h2>
      <p class="muted">Para registrar gastos, vincula este teléfono con el Sistema (⚙ → Sistema). Así cada boleta queda en tu cuenta del proyecto y RRHH la ve al rendir.</p>
      ${typeof SIS !== "undefined" && SIS.listo ? '<button class="btn" id="gtVincular" type="button">Vincular con el Sistema</button>' : '<p class="muted">No se cargó el paquete de conexión con el Sistema.</p>'}
    </div>`;
    const b = document.getElementById("gtVincular");
    if (b) b.addEventListener("click", () => { document.getElementById("btnConfig").click(); if (typeof cfgIrA === "function") cfgIrA("sistema"); });
    return;
  }
  gtEscucharDatos();
  if (!GT.datos) el.innerHTML = '<div class="card"><p class="muted">Cargando gastos…</p></div>';
  try {
    GT.proyectos = await TopolandConexion.proyectosGastos();
    if (!GT.proyectoId || !GT.proyectos.some((p) => p.id === GT.proyectoId)) GT.proyectoId = gtProyectoInicial();
    GT.datos = await TopolandConexion.misGastos(GT.proyectoId);
    GT.error = null;
  } catch (e) { console.error(e); GT.error = e && e.message ? e.message : String(e); }
  if (state.tabActual !== "gastos") return;
  gtPintar(el);
  gtActualizarAviso();
}

function gtPintar(el) {
  if (GT.error) { el.innerHTML = `<div class="card"><h2>Gastos</h2><p class="muted">${escapeHtml(GT.error)}</p></div>`; return; }
  const d = GT.datos, b = d.borrador;
  const devuelta = d.devueltas[0] || null;
  const j = typeof jornadaActiva === "function" ? jornadaActiva() : null;
  const opciones = GT.proyectos.map((p) => `<option value="${escapeHtml(p.id)}" ${p.id === GT.proyectoId ? "selected" : ""}>${escapeHtml(p.nombre)}${j && j.proyectoId === p.id ? " · jornada en curso" : ""}</option>`).join("");
  const conFondo = b.fondo > 0;
  const kpis = conFondo ? `<div class="gt-kpis">
      <div class="gt-kpi"><small>Fondo recibido</small><b>${gtClp(b.fondo)}</b></div>
      <div class="gt-kpi"><small>Gastado</small><b>${gtClp(b.gastado)}</b></div>
      <div class="gt-kpi ${b.saldo < 0 ? "persona" : b.saldo > 0 ? "empresa" : ""}"><small>${b.saldo < 0 ? "Te deben" : b.saldo > 0 ? "Te queda del fondo" : "Saldo"}</small><b>${gtClp(Math.abs(b.saldo))}</b></div>
    </div>` : `<div class="gt-total"><small>Total sin rendir</small><b>${gtClp(b.gastado)}</b><span>${gtPlural(b.gastos.length, "gasto", "gastos")} · reembolso</span></div>`;

  el.innerHTML = `
    <div class="gt-cab">
      <div><h2 class="gt-titulo">Gastos</h2>${gtNubeHtml()}</div>
      <label class="gt-proy"><span>Proyecto</span><select id="gtProyecto">${opciones}</select></label>
    </div>
    ${d.devueltas.map((r) => `<div class="gt-devuelta"><b>Rendición N° ${r.numero} devuelta por RRHH</b><span>«${escapeHtml(r.motivo)}»</span><small>Corrige los gastos marcados aquí o agrega el que falta; después se reenvía desde el Sistema.</small></div>`).join("")}
    <div class="card gt-borrador">
      <div class="gt-tit"><h2>${devuelta ? "Gastos nuevos" : "Rendición N° " + d.numeroSiguiente + " · borrador"}</h2></div>
      ${b.gastos.length || conFondo ? kpis : ""}
      <button class="btn btn-accent gt-nuevo" id="gtNuevo" type="button">${GT_SVG.camara}<span>Nuevo gasto</span></button>
      ${b.gastos.length ? `<div class="gt-lista">${b.gastos.map((g) => gtFilaHtml(g)).join("")}</div>`
        : `<p class="muted gt-vacio">Sin gastos en este proyecto todavía. Toca «Nuevo gasto» y saca la foto de la boleta.</p>`}
      <p class="muted gt-pie">La rendición se envía a RRHH desde el Sistema al cerrar el proyecto.</p>
    </div>
    ${d.devueltas.map((r) => `<div class="card"><div class="gt-tit"><h2>Rendición N° ${r.numero}</h2>${gtChip("devuelta")}</div>
      <div class="gt-lista">${r.gastos.map((g) => gtFilaHtml(g, r.observados.includes(g.id))).join("")}</div></div>`).join("")}
    <div class="card">
      <h2>Mis rendiciones</h2>
      ${d.rendiciones.length ? `<div class="gt-lista">${d.rendiciones.map(gtRendicionHtml).join("")}</div>` : '<p class="muted gt-vacio">Cuando se envíe tu primera rendición, aparece aquí con su estado.</p>'}
    </div>`;

  document.getElementById("gtProyecto").addEventListener("change", (e) => {
    GT.proyectoId = e.target.value;
    try { localStorage.setItem(GT_KEY_PROY, GT.proyectoId); } catch (_) {}
    renderGastos();
  });
  document.getElementById("gtNuevo").addEventListener("click", () => abrirFormGasto());
  el.querySelectorAll("[data-gasto]").forEach((x) => x.addEventListener("click", () => {
    const id = x.dataset.gasto;
    const g = [...b.gastos, ...d.devueltas.flatMap((r) => r.gastos)].find((y) => y.id === id);
    if (g) abrirFormGasto(g);
  }));
  gtPintarMiniaturas(el);
}

function gtFilaHtml(g, observado) {
  return `<button type="button" class="gt-fila${observado ? " observado" : ""}" data-gasto="${escapeHtml(g.id)}">
    <span class="gt-mini" data-boleta="${escapeHtml(g.archivoId || "")}">${GT_SVG.boleta}</span>
    <span class="gt-fila-txt"><b>${escapeHtml(g.comercio || g.categoria)}</b><small>${GT_ICONOS[g.categoria] || ""} ${escapeHtml(g.categoria)} · ${gtFecha(g.fecha)}${g.nota ? " · " + escapeHtml(g.nota) : ""}</small></span>
    ${observado ? '<span class="gt-chip ambar">Observado</span>' : ""}
    <b class="gt-monto">${gtClp(g.monto)}</b>
  </button>`;
}

function gtRendicionHtml(r) {
  let sub = gtPlural(r.n, "gasto", "gastos") + " · " + gtClp(r.total);
  if (r.estado === "enviada") sub += " · en revisión de RRHH";
  if (r.estado === "devuelta") sub += " · «" + escapeHtml(r.motivo) + "»";
  if (r.estado === "pagada" && r.pagado) sub += r.pagado.monto ? " · pagada " + gtFecha(r.pagado.fecha) + " · " + gtClp(r.pagado.monto) : " · cerrada " + gtFecha(r.pagado.fecha);
  return `<div class="gt-fila estatica"><span class="gt-fila-txt"><b>N° ${r.numero} · ${escapeHtml(r.proyecto)}</b><small>${sub}</small></span>${gtChip(r.estado)}</div>`;
}

/** Miniaturas de boletas después de pintar (pueden venir de la nube). */
async function gtPintarMiniaturas(raiz) {
  for (const m of raiz.querySelectorAll(".gt-mini[data-boleta]")) {
    const id = m.dataset.boleta;
    if (!id) continue;
    try {
      const bol = await TopolandConexion.boleta(id);
      if (!bol || !m.isConnected) continue;
      if ((bol.mime || "").startsWith("image/")) m.innerHTML = `<img src="${bol.url}" alt="">`;
      else m.innerHTML = GT_SVG.pdf;
    } catch (_) {}
  }
}

/* ---------- Aviso en la pestaña (rendición devuelta) ---------- */
async function gtActualizarAviso() {
  const btn = document.querySelector('nav.tabbar button[data-tab="gastos"]');
  if (!btn) return;
  let n = 0;
  try { if (gtConectado()) n = (await TopolandConexion.gastosDevueltos()).length; } catch (_) {}
  btn.classList.toggle("con-aviso", n > 0);
  btn.title = n ? gtPlural(n, "rendición devuelta", "rendiciones devueltas") + " por RRHH" : "";
}

function gtEscucharDatos() {
  if (GT.oyente || typeof TopolandConexion === "undefined") return;
  GT.oyente = true;
  TopolandConexion.alLlegarDatos(() => {
    gtActualizarAviso();
    if (state.tabActual === "gastos" && !GT.hoja) renderGastos();
  });
  TopolandConexion.alCambiarNube(() => {
    const n = document.querySelector("#tab-gastos .gt-nube");
    if (n) n.outerHTML = gtNubeHtml();
  });
}

/* ---------- Formulario: nuevo gasto / corregir ---------- */
function abrirFormGasto(g) {
  if (!gtConectado()) { irATab("gastos"); return; }
  cerrarFormGasto();
  const editar = !!g;
  const cats = TopolandConexion.CATEGORIAS_GASTO || Object.keys(GT_ICONOS);
  const proyectoId = g ? g.proyectoId : (GT.proyectoId || gtProyectoInicial());
  const proyectos = GT.proyectos.length ? GT.proyectos : [{ id: proyectoId, nombre: "Proyecto" }];
  const hoja = document.createElement("div");
  hoja.className = "gt-hoja";
  hoja.innerHTML = `<div class="gt-hoja-caja" role="dialog" aria-modal="true" aria-label="${editar ? "Corregir gasto" : "Nuevo gasto"}">
    <div class="gt-hoja-cab"><h2>${editar ? "Gasto" : "Nuevo gasto"}</h2><button type="button" class="close-x gt-cerrar" aria-label="Cerrar">&times;</button></div>
    <form class="gt-form" novalidate>
      <div class="gt-foto ${g && g.archivoId ? "con-foto" : ""}">
        <div class="gt-previa">${g && g.archivoId ? '<span class="muted">Cargando boleta…</span>' : `<div class="gt-foto-vacia">${GT_SVG.boleta}<b>Foto de la boleta</b><small>También sirve el comprobante que llega al correo</small></div>`}</div>
        <div class="gt-foto-botones">
          <label class="btn gt-btn-foto">${GT_SVG.camara}<span>${g && g.archivoId ? "Otra foto" : "Tomar foto"}</span><input type="file" accept="image/*" capture="environment" data-archivo hidden></label>
          <label class="btn btn-outline gt-btn-foto">${GT_SVG.galeria}<span>Galería o PDF</span><input type="file" accept="image/*,application/pdf" data-archivo hidden></label>
        </div>
      </div>
      <label for="gtMonto">Monto (CLP)</label>
      <input type="text" id="gtMonto" class="gt-monto-in" inputmode="numeric" autocomplete="off" placeholder="$ 0" value="${g ? gtClp(g.monto) : ""}">
      <label>Categoría</label>
      <div class="gt-cats" role="radiogroup">${cats.map((c) => `<button type="button" role="radio" class="gt-cat${g && g.categoria === c ? " on" : ""}" aria-checked="${g && g.categoria === c ? "true" : "false"}" data-cat="${escapeHtml(c)}"><span>${GT_ICONOS[c] || "•"}</span>${escapeHtml(c)}</button>`).join("")}</div>
      <div class="gt-par">
        <div><label for="gtFechaIn">Fecha</label><input type="date" id="gtFechaIn" value="${g ? g.fecha : gtHoy()}" max="${gtHoy()}"></div>
        <div><label for="gtProyIn">Proyecto</label><select id="gtProyIn" ${g && g.rendicionId ? "disabled" : ""}>${proyectos.map((p) => `<option value="${escapeHtml(p.id)}" ${p.id === proyectoId ? "selected" : ""}>${escapeHtml(p.nombre)}</option>`).join("")}</select></div>
      </div>
      <details class="gt-mas" ${g && (g.comercio || g.nota) ? "open" : ""}><summary>Comercio y nota (opcional)</summary>
        <label for="gtComercio">Comercio</label><input type="text" id="gtComercio" value="${escapeHtml(g ? g.comercio : "")}" placeholder="Ej.: estación de servicio, hostal">
        <label for="gtNota">Nota</label><input type="text" id="gtNota" value="${escapeHtml(g ? g.nota : "")}" placeholder="Ej.: combustible camioneta para el traslado">
      </details>
      <div class="gt-problemas" aria-live="polite"></div>
      <div class="gt-acciones">
        <button type="submit" class="btn" data-ir="cerrar">Guardar</button>
        ${editar ? '<button type="button" class="btn btn-outline danger" data-eliminar>Eliminar</button>' : '<button type="submit" class="btn btn-outline" data-ir="otro">Guardar y agregar otro</button>'}
      </div>
    </form></div>`;
  document.body.appendChild(hoja);
  document.body.classList.add("gt-sin-scroll");
  GT.hoja = { el: hoja, gasto: g || null, archivo: null, previa: null, categoria: g ? g.categoria : "", confirmarDup: false };

  const $h = (s) => hoja.querySelector(s);
  $h(".gt-cerrar").addEventListener("click", cerrarFormGasto);
  hoja.addEventListener("click", (e) => { if (e.target === hoja) cerrarFormGasto(); });
  hoja.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarFormGasto(); });

  if (g && g.archivoId) {
    TopolandConexion.boleta(g.archivoId).then((bol) => {
      if (!GT.hoja || GT.hoja.el !== hoja) return;
      gtPrevia(bol ? bol.url : null, bol ? bol.mime : "", bol ? bol.nombre : "");
    }).catch(() => gtPrevia(null));
  }
  hoja.querySelectorAll("input[data-archivo]").forEach((inp) => inp.addEventListener("change", () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type) && f.type !== "application/pdf") { gtProblema("La boleta debe ser una foto o un PDF."); return; }
    if (GT.hoja.previa) URL.revokeObjectURL(GT.hoja.previa);
    GT.hoja.archivo = f;
    GT.hoja.previa = URL.createObjectURL(f);
    gtPrevia(GT.hoja.previa, f.type, f.name);
    $h(".gt-foto").classList.add("con-foto");
    $h(".gt-btn-foto span").textContent = "Otra foto";
    gtProblema("");
    if (!$h("#gtMonto").value) $h("#gtMonto").focus();
    inp.value = "";
  }));
  $h("#gtMonto").addEventListener("input", (e) => {
    const n = gtLeerMonto(e.target.value);
    e.target.value = n == null ? "" : gtClp(n);
    GT.hoja.confirmarDup = false;
  });
  $h("#gtFechaIn").addEventListener("change", () => { GT.hoja.confirmarDup = false; });
  hoja.querySelectorAll(".gt-cat").forEach((c) => c.addEventListener("click", () => {
    GT.hoja.categoria = c.dataset.cat;
    hoja.querySelectorAll(".gt-cat").forEach((x) => { const on = x === c; x.classList.toggle("on", on); x.setAttribute("aria-checked", on ? "true" : "false"); });
  }));
  $h("form").addEventListener("submit", (e) => { e.preventDefault(); gtGuardar(e.submitter && e.submitter.dataset.ir === "otro"); });
  const del = $h("[data-eliminar]");
  if (del) del.addEventListener("click", gtEliminar);
  if (!editar) setTimeout(() => { const m = $h("#gtMonto"); if (m && document.body.dataset.modo === "pc") m.focus(); }, 50);
}

function gtPrevia(url, mime, nombre) {
  if (!GT.hoja) return;
  const p = GT.hoja.el.querySelector(".gt-previa");
  if (!url) { p.innerHTML = '<span class="muted">La boleta está en la nube; se verá cuando haya conexión.</span>'; return; }
  if ((mime || "").startsWith("image/")) p.innerHTML = `<img src="${url}" alt="Boleta">`;
  else p.innerHTML = `<a class="gt-pdf" href="${url}" target="_blank" rel="noopener">${GT_SVG.pdf}<span>${escapeHtml(nombre || "Comprobante PDF")}</span></a>`;
}

function gtProblema(html) {
  if (!GT.hoja) return;
  GT.hoja.el.querySelector(".gt-problemas").innerHTML = html ? `<div class="gt-alerta">${html}</div>` : "";
}

async function gtGuardar(otro) {
  const H = GT.hoja;
  if (!H || H.guardando) return;
  const $h = (s) => H.el.querySelector(s);
  const datos = {
    id: H.gasto ? H.gasto.id : undefined,
    monto: gtLeerMonto($h("#gtMonto").value),
    categoria: H.categoria,
    fecha: $h("#gtFechaIn").value,
    proyectoId: $h("#gtProyIn").value,
    comercio: $h("#gtComercio").value,
    nota: $h("#gtNota").value,
  };
  const faltan = [];
  if (!H.archivo && !(H.gasto && H.gasto.archivoId)) faltan.push("Falta la foto de la boleta o del comprobante.");
  if (!(datos.monto > 0)) faltan.push("Falta el monto.");
  if (!datos.categoria) faltan.push("Elige una categoría.");
  if (!datos.fecha) faltan.push("Falta la fecha.");
  if (faltan.length) { gtProblema(faltan.map(escapeHtml).join("<br>")); return; }

  const botones = H.el.querySelectorAll(".gt-acciones button");
  H.guardando = true;
  botones.forEach((b) => { b.disabled = true; });
  const pulsado = H.el.querySelector(`.gt-acciones [data-ir="${otro ? "otro" : "cerrar"}"]`);
  const textoBtn = pulsado ? pulsado.textContent : "";
  if (pulsado) pulsado.textContent = "Guardando…";
  try {
    const r = await TopolandConexion.guardarGasto(datos, { archivo: H.archivo, confirmarDuplicado: H.confirmarDup });
    if (r.duplicados) {
      const x = r.duplicados[0];
      H.confirmarDup = true;
      gtProblema(`<b>¿Gasto repetido?</b> Ya tienes un gasto de ${gtClp(x.monto)} del ${gtFecha(x.fecha)}${x.comercio ? " (" + escapeHtml(x.comercio) + ")" : ""}. Si es otro gasto, vuelve a tocar Guardar.`);
      return;
    }
    try { localStorage.setItem(GT_KEY_PROY, datos.proyectoId); } catch (_) {}
    GT.proyectoId = datos.proyectoId;
    toast(H.gasto ? "Gasto corregido" : "Gasto de " + gtClp(datos.monto) + " guardado");
    if (otro) { abrirFormGasto(); }
    else cerrarFormGasto();
    if (state.tabActual === "gastos") renderGastos();
    else gtActualizarTarjetaJornada();
  } catch (e) {
    console.error(e);
    gtProblema(escapeHtml(e && e.message ? e.message : String(e)));
  } finally {
    if (GT.hoja === H) {
      H.guardando = false;
      botones.forEach((b) => { b.disabled = false; });
      if (pulsado) pulsado.textContent = textoBtn;
    }
  }
}

async function gtEliminar() {
  const H = GT.hoja;
  if (!H || !H.gasto) return;
  const g = H.gasto;
  if (!confirm(`¿Eliminar el gasto de ${gtClp(g.monto)} (${g.categoria})?`)) return;
  try {
    await TopolandConexion.eliminarGasto(g.id);
    cerrarFormGasto();
    gtAvisoDeshacer("Gasto eliminado", async () => { await TopolandConexion.restaurarGasto(g.id); renderGastos(); });
    renderGastos();
  } catch (e) { gtProblema(escapeHtml(e && e.message ? e.message : String(e))); }
}

function cerrarFormGasto() {
  if (!GT.hoja) return;
  if (GT.hoja.previa) URL.revokeObjectURL(GT.hoja.previa);
  GT.hoja.el.remove();
  GT.hoja = null;
  document.body.classList.remove("gt-sin-scroll");
}

/** Aviso con botón «Deshacer» (5 s). */
function gtAvisoDeshacer(msg, deshacer) {
  let a = document.getElementById("gtDeshacer");
  if (!a) { a = document.createElement("div"); a.id = "gtDeshacer"; a.className = "gt-deshacer"; document.body.appendChild(a); }
  a.innerHTML = `<span>${escapeHtml(msg)}</span><button type="button">Deshacer</button>`;
  a.classList.add("show");
  clearTimeout(GT.avisoTimer);
  GT.avisoTimer = setTimeout(() => a.classList.remove("show"), 5000);
  a.querySelector("button").addEventListener("click", async () => {
    clearTimeout(GT.avisoTimer);
    a.remove();
    try { await deshacer(); toast("Gasto restaurado"); } catch (e) { toast(e && e.message ? e.message : "No se pudo deshacer"); }
  });
}

/* ---------- Tarjeta en la jornada en curso ---------- */
function gastosTarjetaJornadaHtml(j) {
  if (!gtConectado() || !j || !j.proyectoId) return "";
  return `<div class="card gt-jornada" id="gtJornada">
    <div class="gt-jornada-txt"><h2>Gastos del proyecto</h2><p class="muted" id="gtJornadaRes">Cargando…</p></div>
    <button class="btn btn-accent btn-sm gt-jornada-btn" id="gtJornadaNuevo" type="button">${GT_SVG.camara}<span>Nuevo gasto</span></button>
  </div>`;
}
function gastosEnlazarJornada(j) {
  const b = document.getElementById("gtJornadaNuevo");
  if (!b) return;
  b.addEventListener("click", async () => {
    try {
      if (!GT.proyectos.length) GT.proyectos = await TopolandConexion.proyectosGastos();
    } catch (_) {}
    GT.proyectoId = j.proyectoId;
    abrirFormGasto();
  });
  const t = document.querySelector("#gtJornada .gt-jornada-txt");
  if (t) { t.style.cursor = "pointer"; t.addEventListener("click", () => { GT.proyectoId = j.proyectoId; irATab("gastos"); }); }
  gtActualizarTarjetaJornada();
}
async function gtActualizarTarjetaJornada() {
  const r = document.getElementById("gtJornadaRes");
  const j = typeof jornadaActiva === "function" ? jornadaActiva() : null;
  if (!r || !j || !j.proyectoId) return;
  try {
    const d = await TopolandConexion.misGastos(j.proyectoId);
    const b = d.borrador;
    r.innerHTML = b.gastos.length
      ? `${gtPlural(b.gastos.length, "gasto", "gastos")} sin rendir · <b class="gt-mono">${gtClp(b.gastado)}</b>${b.fondo > 0 ? ` · fondo ${b.saldo >= 0 ? "disponible" : "excedido"} <b class="gt-mono">${gtClp(Math.abs(b.saldo))}</b>` : ""}`
      : "Sin gastos todavía. Saca la foto de la boleta apenas pagues.";
  } catch (_) { r.textContent = ""; }
}
