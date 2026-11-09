"use strict";

/* =========================================================================
   v0.1a — RESPALDO: exportar / importar todos los datos en un archivo .json
   (no incluye credenciales de nube). Importar FUSIONA por id: lo que ya existe
   con el mismo id se actualiza; lo demás se agrega. No borra nada.
   ========================================================================= */
async function construirRespaldo() {
  return {
    app: "terreno-topografia",
    schemaVersion: SCHEMA_VERSION,
    version: APP_VERSION,
    fecha: nowISO(),
    dispositivoId: getDeviceId(),
    // Se lee de la base (no de la memoria) para incluir también la papelera
    jornadas: await dbGetAll("jornadas"),
    levantamientos: await dbGetAll("levantamientos"),
    monografias: await dbGetAll("monografias"),
    plantillas: state.plantillas,
    marca: state.config.marca || null,
    monografiaDefaults: (() => { try { return JSON.parse(localStorage.getItem(MONOGRAFIA_DEFAULTS_KEY) || "null"); } catch (_) { return null; } })()
  };
}
async function exportarRespaldo() {
  const datos = await construirRespaldo();
  const blob = new Blob([JSON.stringify(datos)], { type: "application/json" });
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const nombre = "respaldo-terreno-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes()) + ".json";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  const act = (l) => l.filter(noEliminado).length;
  const n = act(datos.jornadas) + " jornada(s), " + act(datos.levantamientos) + " levantamiento(s), " + act(datos.monografias) + " monografía(s)";
  const el = document.getElementById("respaldoEstado");
  if (el) el.textContent = "Respaldo generado: " + nombre + " — " + n;
  toast("Respaldo exportado");
}
async function importarRespaldo(file) {
  const estado = document.getElementById("respaldoEstado");
  try {
    const datos = JSON.parse(await file.text());
    if (!datos || !Array.isArray(datos.jornadas) || !Array.isArray(datos.levantamientos)) throw new Error("formato");
    const mono = Array.isArray(datos.monografias) ? datos.monografias : [];
    const act = (l) => l.filter(noEliminado).length;
    const msg = "Se importarán " + act(datos.jornadas) + " jornada(s), " + act(datos.levantamientos) +
      " levantamiento(s) y " + act(mono) + " monografía(s).\n\nSi un registro ya existe aquí, se conserva la versión más reciente; nada se borra.\n\n¿Continuar?";
    if (!confirm(msg)) return;
    let omitidos = 0;
    const fusionar = async (store, lista, nuevos) => {
      for (const reg of nuevos) {
        const actual = await dbGet(store, reg.id);
        if (actual && actual.actualizadoEn && (!reg.actualizadoEn || actual.actualizadoEn > reg.actualizadoEn)) { omitidos++; continue; }   // lo local, ya sellado, es más reciente que un respaldo sin sellos o más antiguo
        await dbPut(store, reg, { raw: true });   // conserva sellos originales
        const i = lista.findIndex((x) => x.id === reg.id);
        if (reg.eliminado) { if (i >= 0) lista.splice(i, 1); }
        else if (i >= 0) lista[i] = reg; else lista.push(reg);
      }
    };
    await fusionar("jornadas", state.jornadas, datos.jornadas);
    await fusionar("levantamientos", state.levantamientos, datos.levantamientos);
    await fusionar("monografias", state.monografias, mono);
    if (Array.isArray(datos.plantillas)) {
      datos.plantillas.forEach((pl) => { if (!state.plantillas.some((x) => x.id === pl.id)) state.plantillas.push(pl); });
      guardarPlantillas();
    }
    if (datos.marca && !(state.config.marca && (state.config.marca.logoEmpresa || state.config.marca.nombreEmpresa))) {
      state.config.marca = datos.marca; try { guardarConfig(); } catch (_) {}
    }
    if (datos.monografiaDefaults) { try { localStorage.setItem(MONOGRAFIA_DEFAULTS_KEY, JSON.stringify(datos.monografiaDefaults)); } catch (_) {} }
    if (!state.jornadaActivaId) { const j = state.jornadas.find((x) => x.estado === "abierta"); if (j) state.jornadaActivaId = j.id; }
    if (!state.levantamientoActivoId) { const l = state.levantamientos.find((x) => x.estado === "en_curso"); if (l) state.levantamientoActivoId = l.id; }
    if (sesTodas().some((x) => x.s.estado === "midiendo")) { tmrPedirWakeLock(); sesArrancarTick(); }
    renderHeader(); renderTabActual(); actualizarInfoPapelera();
    if (estado) estado.textContent = "Importado: " + act(datos.jornadas) + " jornada(s), " + act(datos.levantamientos) + " levantamiento(s), " + act(mono) + " monografía(s)." + (omitidos ? " " + omitidos + " registro(s) ya tenían una versión más reciente aquí y se conservaron." : "");
    toast("Respaldo importado");
  } catch (err) {
    if (estado) estado.textContent = "No se pudo importar: el archivo no es un respaldo válido de Terreno Topografía.";
    toast("Archivo de respaldo no válido");
  }
}
async function contarPapelera() {
  let n = 0;
  for (const st of ["jornadas", "levantamientos", "monografias"]) n += (await dbGetAll(st)).filter((x) => x.eliminado).length;
  return n;
}
async function actualizarInfoPapelera() {
  const el = document.getElementById("papeleraInfo");
  if (!el) return;
  const n = await contarPapelera();
  el.textContent = n ? "Papelera: " + n + " registro(s) eliminado(s) (siguen en los respaldos)." : "Papelera vacía.";
  const b = document.getElementById("btnVaciarPapelera");
  if (b) b.style.display = n ? "" : "none";
}
async function vaciarPapelera() {
  const n = await contarPapelera();
  if (!n) return;
  if (!confirm("¿Eliminar definitivamente los " + n + " registro(s) de la papelera? Esto no se puede deshacer.")) return;
  for (const st of ["jornadas", "levantamientos", "monografias"]) {
    for (const x of (await dbGetAll(st)).filter((r) => r.eliminado)) await dbDelete(st, x.id);
  }
  await actualizarInfoPapelera();
  toast("Papelera vaciada");
}
document.getElementById("btnConfig").addEventListener("click", () => { actualizarInfoPapelera(); renderAcercaVersion(); });
document.getElementById("btnVaciarPapelera").addEventListener("click", vaciarPapelera);
document.getElementById("btnCatastroTiposDefault").addEventListener("click", () => { document.getElementById("txtCatastroTipos").value = CATASTRO_TIPOS_DEFAULT; });

/* "Acerca de esta versión": lo mismo que trae el README, dentro de la app. */
const APP_NOTAS = {
  cambios: [
    "Versión 0.5.9: pestaña «Gastos». Registra el gasto en el momento: foto de la boleta (o del comprobante del correo), monto y categoría. Queda en el borrador de tu cuenta del proyecto, el mismo que ves en el Sistema; la rendición se envía a RRHH desde el Sistema al cerrar el proyecto.",
    "En la jornada en curso aparece la tarjeta «Gastos del proyecto» con el total sin rendir y el botón «Nuevo gasto».",
    "Muestra fondo recibido, gastado y saldo si RRHH depositó fondo; aviso de posible gasto repetido (misma fecha y monto); rendiciones devueltas con el motivo y los gastos observados para corregirlos."
  ],
  probar: [
    "Sin señal (modo avión): registrar un gasto con foto, cerrar y abrir la app, y ver que sigue ahí; al volver la señal debe subir solo («☁ Al día»).",
    "Cámara desde «Tomar foto» y comprobante PDF o captura desde «Galería o PDF».",
    "El gasto registrado en Terreno debe verse en el Sistema → Gastos del mismo proyecto."
  ],
  conocidos: [
    "Gastos necesita el teléfono vinculado con el Sistema (⚙ → Sistema). La foto de la boleta es obligatoria en Terreno.",
    "Enviar la rendición, depósitos y pagos se hacen en el Sistema.",
    "El mapa necesita internet; sin internet se ve el fondo liso y los puntos igual.",
    "Hay dos conexiones de Google distintas: la de Terreno (⚙ Nube, por jornada) y la del Sistema (⚙ Sistema). Se unificarán con la nube común.",
    "Consultar el pronóstico necesita internet (Open-Meteo, NOAA). Open-Meteo es gratis solo para uso no comercial.",
    "El Excel sigue sin tocar. CNR y SERVIU siguen sin valores propios."
  ]
};
function renderAcercaVersion() {
  const el = document.getElementById("acercaVersion");
  if (!el) return;
  const lista = (a) => "<ul style='margin:4px 0 8px 18px; padding:0;'>" + a.map((x) => "<li>" + escapeHtml(x) + "</li>").join("") + "</ul>";
  el.innerHTML = "<details><summary><strong>Acerca de esta versión (v" + APP_VERSION + ")</strong></summary>" +
    "<p class='muted' style='margin:6px 0 2px;'><strong>Qué cambia</strong></p>" + lista(APP_NOTAS.cambios) +
    "<p class='muted' style='margin:6px 0 2px;'><strong>Qué se está probando</strong></p>" + lista(APP_NOTAS.probar) +
    "<p class='muted' style='margin:6px 0 2px;'><strong>Conocido / pendiente</strong></p>" + lista(APP_NOTAS.conocidos) +
    "<p class='muted' style='font-size:12px;'>Formato de datos v" + SCHEMA_VERSION + " · dispositivo " + escapeHtml(getDeviceId().slice(0, 8)) + "</p></details>";
}
document.getElementById("btnExportarRespaldo").addEventListener("click", exportarRespaldo);
document.getElementById("inpImportarRespaldo").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (f) await importarRespaldo(f);
});
