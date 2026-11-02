"use strict";

/* =========================================================================
   SINCRONIZACIÓN EN LA NUBE — GOOGLE DRIVE / NEXTCLOUD
   Guarda siempre primero en IndexedDB (fuente de verdad, funciona sin
   señal). Cuando hay conexión y algún proveedor conectado, sube en
   segundo plano: jornada.json (respaldo liviano, sin fotos embebidas),
   reporte.xlsx, reporte.pdf y las fotos de cada punto, organizadas como:
   Terreno Topografía / Jornada AAAA-MM-DD - id / Fotos.
   Los dos proveedores son independientes entre sí: se puede activar
   uno, ambos o ninguno.
   ========================================================================= */

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

function marcarPendienteSync(jornadaId) {
  if (!jornadaId) return;
  state.drive.pendientes.add(jornadaId);
  state.nextcloud.pendientes.add(jornadaId);
  actualizarEstadoNube();
  clearTimeout(state.drive._syncTimer);
  state.drive._syncTimer = setTimeout(sincronizarPendientesDrive, 4000);
  clearTimeout(state.nextcloud._syncTimer);
  state.nextcloud._syncTimer = setTimeout(sincronizarPendientesNextcloud, 4000);
}

function jsonLigeroDeJornada(j, levs) {
  return {
    jornada: Object.assign({}, j),
    levantamientos: levs.map((l) => Object.assign({}, l, {
      fotosReq: Array.isArray(l.fotosReq) ? l.fotosReq.map((f) => Object.assign({}, f, { foto: f.foto ? true : null })) : l.fotosReq,
      puntos: l.puntos.map((p) => {
        const copia = Object.assign({}, p);
        delete copia.foto;
        return copia;
      })
    }))
  };
}

function actualizarEstadoNube() {
  const pill = document.getElementById("nubePill");
  const provs = [state.drive, state.nextcloud];
  const conectados = provs.filter((p) => p.conectado).length;
  const sincronizando = provs.some((p) => p.sincronizando);
  const pendientes = provs.some((p) => p.conectado && p.pendientes.size > 0);
  if (pill) {
    if (sincronizando) { pill.textContent = "☁ Sincronizando…"; pill.classList.add("pill-live"); }
    else if (conectados === 0) { pill.textContent = "☁ Conectar nube"; pill.classList.remove("pill-live"); }
    else if (pendientes) { pill.textContent = "☁ Pendiente"; pill.classList.add("pill-live"); }
    else { pill.textContent = "☁ Sincronizado (" + conectados + ")"; pill.classList.remove("pill-live"); }
  }
  const setEstado = (id, conectado) => {
    const el = document.getElementById(id);
    if (el) el.textContent = conectado ? "✓ Conectado — sincroniza automáticamente" : "No conectado";
  };
  setEstado("estadoGoogle", state.drive.conectado);
  setEstado("estadoNextcloud", state.nextcloud.conectado);
}

/* ---------- GOOGLE DRIVE (OAuth vía Google Identity Services) ---------- */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
let tokenResolvers = [];

function esperarGIS() {
  return new Promise((resolve) => {
    if (window.google && google.accounts && google.accounts.oauth2) return resolve();
    const iv = setInterval(() => {
      if (window.google && google.accounts && google.accounts.oauth2) {
        clearInterval(iv);
        resolve();
      }
    }, 150);
  });
}

async function pedirToken(interactive) {
  if (!state.drive.clientId) return null;
  await esperarGIS();
  return new Promise((resolve) => {
    tokenResolvers.push({ resolve });
    if (!state.drive.tokenClientObj) {
      state.drive.tokenClientObj = google.accounts.oauth2.initTokenClient({
        client_id: state.drive.clientId,
        scope: DRIVE_SCOPE,
        callback: (resp) => {
          const resolvers = tokenResolvers;
          tokenResolvers = [];
          if (resp.error) {
            state.drive.conectado = false;
            actualizarEstadoNube();
            resolvers.forEach((r) => r.resolve(null));
            return;
          }
          state.drive.accessToken = resp.access_token;
          state.drive.tokenExpiry = Date.now() + (resp.expires_in * 1000 - 60000);
          state.drive.conectado = true;
          localStorage.setItem("driveConectado", "1");
          actualizarEstadoNube();
          resolvers.forEach((r) => r.resolve(resp.access_token));
        }
      });
    }
    state.drive.tokenClientObj.requestAccessToken({ prompt: interactive ? "consent" : "" });
  });
}

async function asegurarToken(interactive) {
  if (state.drive.accessToken && Date.now() < state.drive.tokenExpiry) return state.drive.accessToken;
  return pedirToken(!!interactive);
}

async function driveFetch(url, options) {
  options = options || {};
  const token = await asegurarToken(false);
  if (!token) throw new Error("sin token de Drive");
  const headers = Object.assign({ Authorization: "Bearer " + token }, options.headers || {});
  const res = await fetch(url, Object.assign({}, options, { headers }));
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("Drive API " + res.status + ": " + text.slice(0, 200));
  }
  return res;
}

async function buscarCarpeta(nombre, parentId) {
  const nombreEscapado = nombre.replace(/'/g, "\\'");
  let q = `name = '${nombreEscapado}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) q += ` and '${parentId}' in parents`;
  const res = await driveFetch("https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q) + "&fields=files(id,name)");
  const data = await res.json();
  return data.files && data.files[0] ? data.files[0].id : null;
}
async function crearCarpeta(nombre, parentId) {
  const res = await driveFetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: nombre,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined
    })
  });
  const data = await res.json();
  return data.id;
}
async function buscarOCrearCarpeta(nombre, parentId) {
  const existente = await buscarCarpeta(nombre, parentId);
  if (existente) return existente;
  return crearCarpeta(nombre, parentId);
}

async function subirArchivo(opts) {
  const boundary = "terreno_" + Date.now() + "_" + Math.random().toString(16).slice(2);
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";
  const metadata = { name: opts.name };
  if (opts.parents) metadata.parents = opts.parents;
  const metaPart = new Blob(
    [delimiter, "Content-Type: application/json; charset=UTF-8\r\n\r\n", JSON.stringify(metadata), delimiter, "Content-Type: " + opts.mimeType + "\r\n\r\n"],
    { type: "text/plain" }
  );
  const body = new Blob([metaPart, opts.blob, closeDelim]);
  const url = opts.fileId
    ? "https://www.googleapis.com/upload/drive/v3/files/" + opts.fileId + "?uploadType=multipart"
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  const res = await driveFetch(url, {
    method: opts.fileId ? "PATCH" : "POST",
    headers: { "Content-Type": "multipart/related; boundary=" + boundary },
    body
  });
  return res.json();
}

async function sincronizarPendientesDrive() {
  if (!state.drive.conectado || state.drive.pendientes.size === 0 || state.drive.sincronizando) {
    actualizarEstadoNube();
    return;
  }
  const token = await asegurarToken(false);
  if (!token) { actualizarEstadoNube(); return; }
  state.drive.sincronizando = true;
  actualizarEstadoNube();
  for (const jornadaId of Array.from(state.drive.pendientes)) {
    try {
      await sincronizarJornadaDrive(jornadaId);
      state.drive.pendientes.delete(jornadaId);
    } catch (err) {
      console.warn("Drive pendiente jornada " + jornadaId + ":", err.message);
    }
  }
  state.drive.sincronizando = false;
  actualizarEstadoNube();
}

async function sincronizarJornadaDrive(jornadaId) {
  const j = state.jornadas.find((x) => x.id === jornadaId);
  if (!j) return;
  const levs = levantamientosDeJornada(jornadaId);

  if (!state.drive.rootFolderId) state.drive.rootFolderId = await buscarOCrearCarpeta("Terreno Topografía", null);
  if (!j.driveFolderId) {
    const nombreCarpeta = "Jornada " + j.fechaInicio.slice(0, 10) + " - " + j.id.slice(0, 6);
    j.driveFolderId = await buscarOCrearCarpeta(nombreCarpeta, state.drive.rootFolderId);
    await dbPut("jornadas", j);
  }
  if (!j.driveFotosFolderId) {
    j.driveFotosFolderId = await buscarOCrearCarpeta("Fotos", j.driveFolderId);
    await dbPut("jornadas", j);
  }

  const jsonBlob = new Blob([JSON.stringify(jsonLigeroDeJornada(j, levs), null, 2)], { type: "application/json" });
  const jsonRes = await subirArchivo({
    fileId: j.driveJsonFileId, name: "jornada.json", mimeType: "application/json",
    parents: j.driveJsonFileId ? undefined : [j.driveFolderId], blob: jsonBlob
  });
  j.driveJsonFileId = jsonRes.id;

  const wb = construirWorkbook(jornadaId);
  const xlsxArray = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const xlsxBlob = new Blob([xlsxArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const xlsxRes = await subirArchivo({
    fileId: j.driveXlsxFileId, name: "reporte.xlsx", mimeType: xlsxBlob.type,
    parents: j.driveXlsxFileId ? undefined : [j.driveFolderId], blob: xlsxBlob
  });
  j.driveXlsxFileId = xlsxRes.id;

  const pdfDoc = await construirPdfDoc(jornadaId);
  const pdfRes = await subirArchivo({
    fileId: j.drivePdfFileId, name: "reporte.pdf", mimeType: "application/pdf",
    parents: j.drivePdfFileId ? undefined : [j.driveFolderId], blob: pdfDoc.output("blob")
  });
  j.drivePdfFileId = pdfRes.id;

  await dbPut("jornadas", j);

  for (const l of levs) {
    let huboCambios = false;
    for (const p of l.puntos) {
      if (p.foto && !p.fotoDriveId) {
        const blob = await dataUrlToBlob(p.foto);
        const nombre = l.tipoNombre + "_punto" + p.numero + "_" + l.id.slice(0, 6) + ".jpg";
        const res = await subirArchivo({ name: nombre, mimeType: "image/jpeg", parents: [j.driveFotosFolderId], blob });
        p.fotoDriveId = res.id;
        huboCambios = true;
      }
    }
    if (huboCambios) await dbPut("levantamientos", l);
  }
}

/* ---------- NEXTCLOUD (WebDAV, usuario + contraseña de aplicación) ---------- */
function nextcloudBaseUrl() {
  return state.nextcloud.url.replace(/\/$/, "") + "/remote.php/dav/files/" + encodeURIComponent(state.nextcloud.usuario);
}
async function nextcloudFetch(path, options) {
  options = options || {};
  const headers = Object.assign(
    { Authorization: "Basic " + btoa(state.nextcloud.usuario + ":" + state.nextcloud.appPassword) },
    options.headers || {}
  );
  const url = nextcloudBaseUrl() + "/" + path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const res = await fetch(url, Object.assign({}, options, { headers }));
  // 405 al crear carpeta = "ya existe", no es un error real
  if (!res.ok && res.status !== 405) throw new Error("Nextcloud respondió " + res.status);
  return res;
}
async function probarConexionNextcloud() {
  try {
    await nextcloudFetch("", { method: "PROPFIND", headers: { Depth: "0" } });
    return true;
  } catch (err) {
    return false;
  }
}
async function asegurarCarpetaNextcloud(path) {
  const partes = path.split("/").filter(Boolean);
  let acumulado = "";
  for (const parte of partes) {
    acumulado += (acumulado ? "/" : "") + parte;
    await nextcloudFetch(acumulado, { method: "MKCOL" });
  }
}
async function subirArchivoNextcloud(path, blob) {
  await nextcloudFetch(path, { method: "PUT", body: blob });
}
async function conectarNextcloud(url, usuario, appPassword) {
  state.nextcloud.url = url.replace(/\/$/, "");
  state.nextcloud.usuario = usuario;
  state.nextcloud.appPassword = appPassword;
  const ok = await probarConexionNextcloud();
  state.nextcloud.conectado = ok;
  if (ok) localStorage.setItem("nextcloudConfig", JSON.stringify({ url: state.nextcloud.url, usuario, appPassword }));
  return ok;
}
function desconectarNextcloud() {
  state.nextcloud.conectado = false;
  localStorage.removeItem("nextcloudConfig");
}

async function sincronizarPendientesNextcloud() {
  if (!state.nextcloud.conectado || state.nextcloud.pendientes.size === 0 || state.nextcloud.sincronizando) {
    actualizarEstadoNube();
    return;
  }
  state.nextcloud.sincronizando = true;
  actualizarEstadoNube();
  for (const jornadaId of Array.from(state.nextcloud.pendientes)) {
    try {
      await sincronizarJornadaNextcloud(jornadaId);
      state.nextcloud.pendientes.delete(jornadaId);
    } catch (err) {
      console.warn("Nextcloud pendiente jornada " + jornadaId + ":", err.message);
    }
  }
  state.nextcloud.sincronizando = false;
  actualizarEstadoNube();
}

async function sincronizarJornadaNextcloud(jornadaId) {
  const j = state.jornadas.find((x) => x.id === jornadaId);
  if (!j) return;
  const levs = levantamientosDeJornada(jornadaId);
  const carpeta = "Terreno Topografía/Jornada " + j.fechaInicio.slice(0, 10) + " - " + j.id.slice(0, 6);

  await asegurarCarpetaNextcloud(carpeta);
  await asegurarCarpetaNextcloud(carpeta + "/Fotos");

  await subirArchivoNextcloud(carpeta + "/jornada.json",
    new Blob([JSON.stringify(jsonLigeroDeJornada(j, levs), null, 2)], { type: "application/json" }));

  const wb = construirWorkbook(jornadaId);
  const xlsxArray = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  await subirArchivoNextcloud(carpeta + "/reporte.xlsx",
    new Blob([xlsxArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));

  const pdfDoc = await construirPdfDoc(jornadaId);
  await subirArchivoNextcloud(carpeta + "/reporte.pdf", pdfDoc.output("blob"));

  for (const l of levs) {
    let huboCambios = false;
    for (const p of l.puntos) {
      if (p.foto && !p.fotoNextcloudSubida) {
        const blob = await dataUrlToBlob(p.foto);
        const nombre = l.tipoNombre + "_punto" + p.numero + "_" + l.id.slice(0, 6) + ".jpg";
        await subirArchivoNextcloud(carpeta + "/Fotos/" + nombre, blob);
        p.fotoNextcloudSubida = true;
        huboCambios = true;
      }
    }
    if (huboCambios) await dbPut("levantamientos", l);
  }
}

/* Calcula la tolerancia de cierre (en mm) para una distancia dada (en km),
   según el criterio que el usuario configuró en Ajustes. */
function calcularToleranciaMm(distanciaKm) {
  const cfg = state.config.tolerancia;
  if (cfg.modo === "fijo") return cfg.fijo;
  return cfg.k * Math.sqrt(Math.max(distanciaKm, 0));
}

/* Clasifica el error entre posición 1 y posición 2 de un tramo en 3 niveles.
   Verde = lectura confiable. Amarillo = revisar. Rojo = probable error de
   tipeo o de registro (ej. anotar 2.xxx en vez de 0.xxx). */
function clasificarErrorTramo(errorMm) {
  const abs = Math.abs(errorMm);
  if (abs <= state.config.toleranciaTramoVerdeMm) return "verde";
  if (abs <= state.config.toleranciaTramoAmarillaMm) return "amarillo";
  return "rojo";
}
function colorNivel(nivel) {
  if (nivel === "verde") return "var(--ok)";
  if (nivel === "amarillo") return "#B7791F";
  return "var(--danger)";
}
function textoNivel(nivel) {
  if (nivel === "verde") return "✓ Dentro de tolerancia";
  if (nivel === "amarillo") return "⚠ Revisar";
  return "✕ Probable error de registro — revisar";
}

/* Avance de objetivos de una jornada, para el resumen ejecutivo del PDF.
   Solo cuenta ítems tipo "check" (los de número/texto no tienen un estado
   binario hecho/pendiente). Si no hay ítems check en ningún bloque, pct
   queda en null y el PDF omite la línea de avance. */
function calcularAvanceObjetivos(j) {
  const objetivos = j.objetivos || [];
  let totalCheck = 0, hechosCheck = 0;
  objetivos.forEach((b) => b.items.forEach((it) => {
    if (it.tipo === "check") { totalCheck++; if (it.marcado) hechosCheck++; }
  }));
  return { totalCheck, hechosCheck, pct: totalCheck ? Math.round((hechosCheck / totalCheck) * 100) : null };
}
function clasificarAvance(pct) {
  if (pct == null) return "sin-datos";
  if (pct >= 80) return "verde";
  if (pct >= 40) return "amarillo";
  return "rojo";
}
/* Mismos 3 niveles que el semáforo de tolerancia, pero en RGB para jsPDF
   (que no entiende variables CSS). Colores calcados de los de la app. */
function colorNivelRGB(nivel) {
  if (nivel === "verde") return [46, 125, 79];
  if (nivel === "amarillo") return [183, 121, 31];
  if (nivel === "rojo") return [179, 38, 30];
  return [90, 90, 90];
}
/* Un ítem de objetivo está "pendiente" si es check sin marcar, o si es
   número/texto sin valor cargado todavía. Se usa para ordenar el checklist
   del PDF con lo pendiente primero. */
function estaPendienteObjetivo(it) {
  if (it.tipo === "check") return !it.marcado;
  return it.valor === "" || it.valor == null;
}
function estadoObjetivoTexto(it) {
  if (it.tipo === "check") return it.marcado ? "Hecho" : "Pendiente";
  return (it.valor !== "" && it.valor != null) ? String(it.valor) : "Pendiente";
}

function cargarConfig() {
  const guardada = JSON.parse(localStorage.getItem("config") || "null");
  if (guardada && guardada.tolerancia) state.config.tolerancia = guardada.tolerancia;
  if (guardada && guardada.toleranciaTramoVerdeMm != null) state.config.toleranciaTramoVerdeMm = guardada.toleranciaTramoVerdeMm;
  if (guardada && guardada.toleranciaTramoAmarillaMm != null) state.config.toleranciaTramoAmarillaMm = guardada.toleranciaTramoAmarillaMm;
  if (guardada && guardada.marca) state.config.marca = guardada.marca;
  if (guardada && guardada.fuenteMonografia) state.config.fuenteMonografia = guardada.fuenteMonografia;
}
function guardarConfig() {
  localStorage.setItem("config", JSON.stringify(state.config));
}

/* Carga las plantillas guardadas por el usuario (localStorage). Si nunca se
   ha guardado nada (primer uso), parte con las plantillas de fábrica. */
function cargarPlantillas() {
  const guardadas = JSON.parse(localStorage.getItem("plantillas") || "null");
  state.plantillas = guardadas && guardadas.length ? guardadas : JSON.parse(JSON.stringify(PLANTILLAS_DEFAULT));
  // v0.3.2: renueva las plantillas de fábrica sin pisar lo que el usuario editó
  if (localStorage.getItem("plantillasVersion") !== "0.3.2") {
    if (guardadas && guardadas.length) {
      const antiguas = new Map(PLANTILLAS_ANTIGUAS.map((p) => [p.id, JSON.stringify(p)]));
      state.plantillas = state.plantillas.filter((p) => antiguas.get(p.id) !== JSON.stringify(p));
      PLANTILLAS_DEFAULT.forEach((d) => { if (!state.plantillas.some((x) => x.id === d.id)) state.plantillas.push(JSON.parse(JSON.stringify(d))); });
    }
    localStorage.setItem("plantillasVersion", "0.3.2");
    guardarPlantillas();
  }
}
function guardarPlantillas() {
  localStorage.setItem("plantillas", JSON.stringify(state.plantillas));
}

/* Valores "pegajosos" (sticky) para la ficha de una monografía nueva: nombre
   de cliente, proyecto, datum/zona UTM, datum/geoide geodésico, equipo GNSS
   y qué módulos van activos — se recuerdan del último registro guardado,
   igual que el operador en Jornada, para no reescribirlos en cada punto de
   un mismo proyecto. */
const MONOGRAFIA_DEFAULTS_KEY = "monografiaDefaults";
function cargarMonografiaDefaults() {
  return JSON.parse(localStorage.getItem(MONOGRAFIA_DEFAULTS_KEY) || "null") || {
    tituloDocumento: "Monografía de PRs y Monolitos",
    clienteNombre: "", clienteLogo: null, nombreProyecto: "",
    datumUTM: "WGS84", zonaUTM: "", datumGeodesico: "ITRF2008", geoide: "EGM08",
    equipoGNSS: "", tipoMedicion: "Estática",
    modulos: { utm: true, geodesicas: true, croquis: true, panoramica: true, descripcion: true, firma: true, fotos: false }
  };
}
function guardarMonografiaDefaults(m) {
  localStorage.setItem(MONOGRAFIA_DEFAULTS_KEY, JSON.stringify({
    tituloDocumento: m.tituloDocumento,
    clienteNombre: m.clienteNombre, clienteLogo: m.clienteLogo, nombreProyecto: m.nombreProyecto,
    datumUTM: m.datumUTM, zonaUTM: m.zonaUTM, datumGeodesico: m.datumGeodesico, geoide: m.geoide,
    equipoGNSS: m.equipoGNSS, tipoMedicion: m.tipoMedicion, modulos: m.modulos
  }));
}
