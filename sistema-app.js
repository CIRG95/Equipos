/* sistema-app.js — ARCHIVO GENERADO con construir.sh. No editar: los cambios van en app/, compartido/ o modulos/. */
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // compartido/almacen.js
  var NOMBRE_BD = "topoland";
  var registrados = /* @__PURE__ */ new Map();
  var promesaBD = null;
  var conexion = null;
  var cadena = Promise.resolve();
  function registrarAlmacenes(definiciones) {
    let nuevos = false;
    for (const d of definiciones) {
      if (!registrados.has(d.nombre)) {
        registrados.set(d.nombre, d);
        nuevos = true;
      }
    }
    if (nuevos) promesaBD = null;
  }
  function almacenesRegistrados() {
    return [...registrados.keys()];
  }
  var oyentes = /* @__PURE__ */ new Set();
  function alCambiar(fn) {
    oyentes.add(fn);
    return () => oyentes.delete(fn);
  }
  function avisarCambio(almacenes, opciones) {
    if (opciones && opciones.silencioso) return;
    for (const fn of oyentes) {
      try {
        fn(almacenes);
      } catch (e) {
        console.warn(e);
      }
    }
  }
  function abrirConVersion(version) {
    return new Promise((resolver, rechazar) => {
      const req = version ? indexedDB.open(NOMBRE_BD, version) : indexedDB.open(NOMBRE_BD);
      req.onupgradeneeded = () => {
        const bd = req.result;
        const tx = req.transaction;
        for (const d of registrados.values()) {
          const almacen = bd.objectStoreNames.contains(d.nombre) ? tx.objectStore(d.nombre) : bd.createObjectStore(d.nombre, { keyPath: d.keyPath || "id" });
          for (const [nombreIndice, ruta] of d.indices || []) {
            if (!almacen.indexNames.contains(nombreIndice)) almacen.createIndex(nombreIndice, ruta);
          }
        }
      };
      let aviso = null;
      req.onsuccess = () => {
        clearTimeout(aviso);
        const bd = req.result;
        bd.onversionchange = () => {
          bd.close();
          if (conexion === bd) conexion = null;
          promesaBD = null;
        };
        resolver(bd);
      };
      req.onerror = () => {
        clearTimeout(aviso);
        rechazar(req.error);
      };
      req.onblocked = () => {
        clearTimeout(aviso);
        aviso = setTimeout(() => rechazar(new Error("La app está abierta en otra pestaña con una versión anterior. Ciérrala y vuelve a intentar.")), 1e4);
      };
    });
  }
  function faltaAlgo(bd) {
    for (const d of registrados.values()) {
      if (!bd.objectStoreNames.contains(d.nombre)) return true;
      if ((d.indices || []).length) {
        const tx = bd.transaction(d.nombre, "readonly");
        const s = tx.objectStore(d.nombre);
        if (d.indices.some(([n]) => !s.indexNames.contains(n))) return true;
      }
    }
    return false;
  }
  function abrir() {
    if (promesaBD) return promesaBD;
    const p = cadena.then(async () => {
      let bd = conexion || await abrirConVersion();
      if (faltaAlgo(bd)) {
        const v = bd.version + 1;
        bd.close();
        conexion = null;
        bd = await abrirConVersion(v);
      }
      conexion = bd;
      return bd;
    });
    cadena = p.catch(() => {
    });
    promesaBD = p;
    p.catch(() => {
      if (promesaBD === p) promesaBD = null;
    });
    return p;
  }
  function pedir(req) {
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  function terminar(tx) {
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  }
  async function obtener(almacen, id) {
    const bd = await abrir();
    return pedir(bd.transaction(almacen, "readonly").objectStore(almacen).get(id));
  }
  async function todos(almacen) {
    const bd = await abrir();
    return pedir(bd.transaction(almacen, "readonly").objectStore(almacen).getAll());
  }
  async function porIndice(almacen, indice, valor) {
    const bd = await abrir();
    return pedir(bd.transaction(almacen, "readonly").objectStore(almacen).index(indice).getAll(valor));
  }
  async function guardar(almacen, registro, opciones) {
    const bd = await abrir();
    const tx = bd.transaction(almacen, "readwrite");
    tx.objectStore(almacen).put(registro);
    await terminar(tx);
    avisarCambio([almacen], opciones);
    return registro;
  }
  async function guardarVarios(operaciones, opciones) {
    if (!operaciones.length) return;
    const bd = await abrir();
    const nombres = [...new Set(operaciones.map((o) => o.almacen))];
    const tx = bd.transaction(nombres, "readwrite");
    for (const o of operaciones) tx.objectStore(o.almacen).put(o.registro);
    await terminar(tx);
    avisarCambio(nombres, opciones);
  }
  async function vaciar(almacenes) {
    if (!almacenes.length) return;
    const bd = await abrir();
    const tx = bd.transaction(almacenes, "readwrite");
    for (const a of almacenes) tx.objectStore(a).clear();
    await terminar(tx);
    avisarCambio(almacenes, { silencioso: true });
  }
  async function borrarDefinitivo(almacen, id) {
    const bd = await abrir();
    const tx = bd.transaction(almacen, "readwrite");
    tx.objectStore(almacen).delete(id);
    await terminar(tx);
    avisarCambio([almacen]);
  }

  // compartido/util.js
  function uuid() {
    if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : r & 3 | 8).toString(16);
    });
  }
  var CLAVE_DISPOSITIVO = "topoland_dispositivoId";
  var dispositivoEnMemoria = null;
  function dispositivoId() {
    if (dispositivoEnMemoria) return dispositivoEnMemoria;
    try {
      let id = localStorage.getItem(CLAVE_DISPOSITIVO);
      if (!id) {
        id = uuid();
        localStorage.setItem(CLAVE_DISPOSITIVO, id);
      }
      dispositivoEnMemoria = id;
    } catch (e) {
      dispositivoEnMemoria = uuid();
    }
    return dispositivoEnMemoria;
  }
  function ahoraISO() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  function hoyISO(fecha2 = /* @__PURE__ */ new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${fecha2.getFullYear()}-${p(fecha2.getMonth() + 1)}-${p(fecha2.getDate())}`;
  }
  function sellar(registro, { personaId = null, schemaVersion = 1 } = {}) {
    const ahora = ahoraISO();
    if (!registro.id) registro.id = uuid();
    if (!registro.creadoEn) registro.creadoEn = ahora;
    if (!registro.creadoPor) registro.creadoPor = personaId;
    registro.actualizadoEn = ahora;
    registro.dispositivoId = dispositivoId();
    registro.modificadoPor = personaId;
    registro.schemaVersion = schemaVersion;
    return registro;
  }
  function sumarMeses(fechaISO, meses) {
    if (!fechaISO) return null;
    const [a, m, d] = fechaISO.split("-").map(Number);
    const f = new Date(a, m - 1 + Number(meses), d);
    if (f.getDate() !== d) f.setDate(0);
    return hoyISO(f);
  }
  function diasEntre(aISO, bISO) {
    const a = /* @__PURE__ */ new Date(aISO + "T12:00:00");
    const b = /* @__PURE__ */ new Date(bISO + "T12:00:00");
    return Math.round((b - a) / 864e5);
  }
  function fechaLegible(fechaISO) {
    if (!fechaISO) return "—";
    const [a, m, d] = fechaISO.slice(0, 10).split("-");
    return `${d}-${m}-${a}`;
  }
  function fechaHoraLegible(iso) {
    if (!iso) return "—";
    const f = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(f.getDate())}-${p(f.getMonth() + 1)}-${f.getFullYear()} ${p(f.getHours())}:${p(f.getMinutes())}`;
  }
  function normalizarTexto(t) {
    return String(t != null ? t : "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function escapar(t) {
    return String(t != null ? t : "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function descargar(nombre, contenido, tipo = "application/json") {
    const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2e3);
  }
  var scriptsCargados = /* @__PURE__ */ new Map();
  function cargarScript(url) {
    if (scriptsCargados.has(url)) return scriptsCargados.get(url);
    const p = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = res;
      s.onerror = () => {
        scriptsCargados.delete(url);
        rej(new Error("No se pudo cargar " + url));
      };
      document.head.appendChild(s);
    });
    scriptsCargados.set(url, p);
    return p;
  }

  // compartido/catalogos.js
  var OFICINA_ID = "oficina";
  var ALM_PROYECTOS = "compartido_proyectos";
  var ALM_PERSONAS = "compartido_personas";
  registrarAlmacenes([{ nombre: ALM_PROYECTOS }, { nombre: ALM_PERSONAS }]);
  var proveedor = null;
  function catalogosEditables() {
    return !proveedor || !!proveedor.guardarProyecto && !!proveedor.guardarPersona;
  }
  var activo = (r) => !r.eliminadoEn && r.activo !== false;
  var porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es");
  async function asegurarOficina() {
    const o = await obtener(ALM_PROYECTOS, OFICINA_ID);
    if (!o) await guardar(ALM_PROYECTOS, sellar({ id: OFICINA_ID, nombre: "Oficina", mandante: "Topoland", especial: true }));
  }
  async function listarProyectos({ incluirOficina = true } = {}) {
    let lista;
    if (proveedor) lista = await proveedor.listarProyectos();
    else {
      await asegurarOficina();
      lista = (await todos(ALM_PROYECTOS)).filter(activo);
    }
    lista = lista.filter((p) => incluirOficina || p.id !== OFICINA_ID);
    return lista.sort((a, b) => a.id === OFICINA_ID ? -1 : b.id === OFICINA_ID ? 1 : porNombre(a, b));
  }
  async function obtenerProyecto(id) {
    if (!id) return null;
    if (proveedor) return proveedor.obtenerProyecto(id);
    if (id === OFICINA_ID) await asegurarOficina();
    return obtener(ALM_PROYECTOS, id);
  }
  async function guardarProyecto(datos, { personaId = null } = {}) {
    if (proveedor) return proveedor.guardarProyecto(datos);
    const r = { ...datos.id ? await obtener(ALM_PROYECTOS, datos.id) : {}, ...datos };
    return guardar(ALM_PROYECTOS, sellar(r, { personaId }));
  }
  async function listarPersonas() {
    if (proveedor) return (await proveedor.listarPersonas()).sort(porNombre);
    return (await todos(ALM_PERSONAS)).filter(activo).sort(porNombre);
  }
  async function guardarPersona(datos, { personaId = null } = {}) {
    if (proveedor) return proveedor.guardarPersona(datos);
    const r = { ...datos.id ? await obtener(ALM_PERSONAS, datos.id) : {}, ...datos };
    return guardar(ALM_PERSONAS, sellar(r, { personaId }));
  }
  async function mapaNombres() {
    const [proyectos2, personas2] = await Promise.all([listarProyectos(), listarPersonas()]);
    return {
      proyecto: Object.fromEntries(proyectos2.map((p) => [p.id, p.nombre])),
      persona: Object.fromEntries(personas2.map((p) => [p.id, p.nombre]))
    };
  }

  // modulos/equipos/equipos.js
  var equipos_exports = {};
  __export(equipos_exports, {
    ALMACENES: () => ALMACENES,
    VERSION: () => VERSION,
    abrirArchivo: () => abrirArchivo,
    alertasActivas: () => alertasActivas,
    certificadoVigente: () => certificadoVigente,
    certificadosDeProyecto: () => certificadosDeProyecto,
    equiposDeProyecto: () => equiposDeProyecto,
    iniciar: () => iniciar2,
    listarEquiposConEstado: () => listarEquiposConEstado,
    montar: () => montar,
    obtenerEquipo: () => obtenerEquipo,
    registrarUsoConAlerta: () => registrarUsoConAlerta
  });

  // compartido/papelera.js
  function estaEliminado(r) {
    return !!(r && r.eliminadoEn);
  }
  async function enviarAPapelera(almacen, id, { personaId = null, schemaVersion = 1 } = {}) {
    const r = await obtener(almacen, id);
    if (!r) return null;
    r.eliminadoEn = ahoraISO();
    r.eliminadoPor = personaId;
    sellar(r, { personaId, schemaVersion: r.schemaVersion || schemaVersion });
    return guardar(almacen, r);
  }
  async function restaurar(almacen, id, { personaId = null } = {}) {
    const r = await obtener(almacen, id);
    if (!r) return null;
    delete r.eliminadoEn;
    delete r.eliminadoPor;
    sellar(r, { personaId, schemaVersion: r.schemaVersion || 1 });
    return guardar(almacen, r);
  }
  async function enPapelera(prefijo = "") {
    const salida = [];
    for (const nombre of almacenesRegistrados()) {
      if (!nombre.startsWith(prefijo)) continue;
      for (const r of await todos(nombre)) if (estaEliminado(r)) salida.push({ almacen: nombre, registro: r });
    }
    return salida.sort((a, b) => b.registro.eliminadoEn.localeCompare(a.registro.eliminadoEn));
  }

  // compartido/nube.js
  var nube_exports = {};
  __export(nube_exports, {
    NOMBRE_CARPETA_PRUEBA: () => NOMBRE_CARPETA_PRUEBA,
    alDatosRemotos: () => alDatosRemotos,
    alEstado: () => alEstado,
    buscarCarpetas: () => buscarCarpetas,
    conectar: () => conectar,
    conectarConToken: () => conectarConToken,
    configurar: () => configurar,
    crearCarpeta: () => crearCarpeta,
    descargarArchivo: () => descargarArchivo,
    desconectar: () => desconectar,
    enlaceInvitacion: () => enlaceInvitacion,
    estado: () => estado,
    iniciar: () => iniciar,
    sincronizar: () => sincronizar,
    usarCarpeta: () => usarCarpeta
  });

  // compartido/nube-drive.js
  var SCOPE = "https://www.googleapis.com/auth/drive";
  var CARPETA = "application/vnd.google-apps.folder";
  var URL_GIS = "https://accounts.google.com/gsi/client";
  function crearAdaptadorDrive({ clienteId, api = "https://www.googleapis.com" } = {}) {
    let token = null;
    let vence = 0;
    let clienteToken = null;
    let pendientes = [];
    const leerGuardado = () => {
      try {
        const g = JSON.parse(localStorage.getItem("topoland_nube_token") || "null");
        if (g && g.vence > Date.now()) {
          token = g.token;
          vence = g.vence;
        }
      } catch {
      }
    };
    const guardarToken = () => {
      try {
        localStorage.setItem("topoland_nube_token", JSON.stringify({ token, vence }));
      } catch {
      }
    };
    leerGuardado();
    function tokenVigente() {
      return token && Date.now() < vence;
    }
    async function conectar2({ forzarConsentimiento = false } = {}) {
      if (!clienteId) throw new Error("Falta el Client ID de Google (config.js o el panel de nube).");
      if (!/^https?:/.test(location.protocol)) throw new Error("Google solo permite conectar desde una dirección web (GitHub Pages), no con doble clic desde la carpeta.");
      if (!(globalThis.google && google.accounts && google.accounts.oauth2)) await cargarScript(URL_GIS);
      return new Promise((resolver, rechazar) => {
        pendientes.push({ resolver, rechazar });
        if (!clienteToken) {
          clienteToken = google.accounts.oauth2.initTokenClient({
            client_id: clienteId,
            scope: SCOPE,
            callback: (resp) => {
              const ps = pendientes;
              pendientes = [];
              if (resp.error) {
                ps.forEach((p) => p.rechazar(new Error(`Google respondió: ${resp.error}`)));
                return;
              }
              token = resp.access_token;
              vence = Date.now() + (Number(resp.expires_in) || 3600) * 1e3 - 6e4;
              guardarToken();
              ps.forEach((p) => p.resolver(true));
            },
            error_callback: (err) => {
              const ps = pendientes;
              pendientes = [];
              ps.forEach((p) => p.rechazar(new Error(err && err.type === "popup_closed" ? "Se cerró la ventana de Google sin conectar." : "No se pudo abrir la ventana de Google (¿bloqueador de ventanas?).")));
            }
          });
        }
        clienteToken.requestAccessToken({ prompt: forzarConsentimiento ? "consent" : "" });
      });
    }
    function usarToken(t, segundos = 3600) {
      token = t;
      vence = Date.now() + segundos * 1e3;
      guardarToken();
    }
    function desconectar2() {
      if (token && globalThis.google && google.accounts && google.accounts.oauth2) {
        try {
          google.accounts.oauth2.revoke(token, () => {
          });
        } catch {
        }
      }
      token = null;
      vence = 0;
      try {
        localStorage.removeItem("topoland_nube_token");
      } catch {
      }
    }
    async function pedir2(ruta, opciones = {}) {
      if (!tokenVigente()) {
        const e = new Error("La conexión con Google venció. Toca «Reconectar».");
        e.sinToken = true;
        throw e;
      }
      const res = await fetch(api + ruta, { ...opciones, headers: { Authorization: `Bearer ${token}`, ...opciones.headers || {} } });
      if (res.status === 401) {
        token = null;
        vence = 0;
        const e = new Error("La conexión con Google venció. Toca «Reconectar».");
        e.sinToken = true;
        throw e;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        const e = new Error(`Drive respondió ${res.status}: ${txt.slice(0, 200)}`);
        e.status = res.status;
        throw e;
      }
      return res;
    }
    const esc2 = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const CAMPOS = "files(id,name,mimeType,modifiedTime,parents)";
    const extra = "&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1000";
    async function buscar(q) {
      const r = await pedir2(`/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(CAMPOS)}${extra}`);
      return (await r.json()).files || [];
    }
    async function datosCarpeta(id) {
      const r = await pedir2(`/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,capabilities(canAddChildren)&supportsAllDrives=true`);
      return r.json();
    }
    async function buscarCarpetas2(nombre) {
      return buscar(`name='${esc2(nombre)}' and mimeType='${CARPETA}' and trashed=false`);
    }
    async function crearCarpeta2(nombre, padreId = null) {
      const r = await pedir2("/drive/v3/files?supportsAllDrives=true&fields=id,name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nombre, mimeType: CARPETA, ...padreId ? { parents: [padreId] } : {} })
      });
      return r.json();
    }
    const cacheCarpetas = /* @__PURE__ */ new Map();
    async function carpetaHija(padreId, nombre) {
      const k = `${padreId}/${nombre}`;
      if (cacheCarpetas.has(k)) return cacheCarpetas.get(k);
      const hay = await buscar(`name='${esc2(nombre)}' and '${padreId}' in parents and mimeType='${CARPETA}' and trashed=false`);
      const id = hay[0] ? hay[0].id : (await crearCarpeta2(nombre, padreId)).id;
      cacheCarpetas.set(k, id);
      return id;
    }
    async function asegurarRuta(raizId, ruta) {
      let id = raizId;
      for (const parte of ruta.split("/").filter(Boolean)) id = await carpetaHija(id, parte);
      return id;
    }
    async function listarArchivos(carpetaId) {
      return buscar(`'${carpetaId}' in parents and trashed=false and mimeType!='${CARPETA}'`);
    }
    async function subir({ carpetaId, nombre, blob, mime, archivoId = null }) {
      if (archivoId) {
        const r2 = await pedir2(`/upload/drive/v3/files/${encodeURIComponent(archivoId)}?uploadType=media&supportsAllDrives=true&fields=id,modifiedTime`, {
          method: "PATCH",
          headers: { "Content-Type": mime },
          body: blob
        });
        return r2.json();
      }
      const limite = "topoland" + Math.random().toString(16).slice(2);
      const meta = { name: nombre, parents: [carpetaId], mimeType: mime };
      const cuerpo = new Blob([
        `--${limite}\r
Content-Type: application/json; charset=UTF-8\r
\r
${JSON.stringify(meta)}\r
`,
        `--${limite}\r
Content-Type: ${mime}\r
\r
`,
        blob,
        `\r
--${limite}--`
      ]);
      const r = await pedir2("/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,modifiedTime", {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${limite}` },
        body: cuerpo
      });
      return r.json();
    }
    async function descargar2(archivoId) {
      const r = await pedir2(`/drive/v3/files/${encodeURIComponent(archivoId)}?alt=media&supportsAllDrives=true`);
      return r.blob();
    }
    return {
      nombre: "Google Drive",
      tokenVigente,
      conectar: conectar2,
      desconectar: desconectar2,
      usarToken,
      buscarCarpetas: buscarCarpetas2,
      crearCarpeta: crearCarpeta2,
      datosCarpeta,
      asegurarRuta,
      listarArchivos,
      subir,
      descargar: descargar2
    };
  }
  function idDeEnlaceDrive(texto3) {
    const t = String(texto3 || "").trim();
    const m = t.match(/folders\/([\w-]{10,})/) || t.match(/[?&]id=([\w-]{10,})/);
    if (m) return m[1];
    return /^[\w-]{10,}$/.test(t) ? t : null;
  }

  // compartido/nube.js
  var CLAVE = "topoland_nube";
  var PREFIJOS = ["equipos_", "compartido_", "vuelos_"];
  var ALM_ARCHIVOS = "compartido_archivos";
  var NOMBRE_CARPETA_PRUEBA = "Topoland Equipos (prueba)";
  var cfg = leerCfg();
  var adaptador = null;
  var opcionesAdaptador = {};
  var est = { sincronizando: false, error: null, ultimaSync: cfg.ultimaSync || null, ultimoResumen: null };
  var oyentesEstado = /* @__PURE__ */ new Set();
  var oyentesDatos = /* @__PURE__ */ new Set();
  var temporizador = null;
  var intervalo = null;
  var otraVez = false;
  function leerCfg() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE) || "{}");
    } catch {
      return {};
    }
  }
  function guardarCfg() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(cfg));
    } catch {
    }
  }
  var sincronizable = (nombre) => PREFIJOS.some((p) => nombre.startsWith(p));
  function estado() {
    return {
      proveedor: "Google Drive",
      clienteId: cfg.clienteId || "",
      configurado: !!cfg.clienteId,
      conectado: !!(adaptador && adaptador.tokenVigente()),
      carpetaId: cfg.carpetaId || null,
      carpetaNombre: cfg.carpetaNombre || null,
      pendiente: !!cfg.sucio,
      ...est
    };
  }
  function emitir() {
    const e = estado();
    for (const fn of oyentesEstado) {
      try {
        fn(e);
      } catch (x) {
        console.warn(x);
      }
    }
  }
  function alEstado(fn) {
    oyentesEstado.add(fn);
    fn(estado());
    return () => oyentesEstado.delete(fn);
  }
  function alDatosRemotos(fn) {
    oyentesDatos.add(fn);
    return () => oyentesDatos.delete(fn);
  }
  function configurar({ clienteId, api } = {}) {
    if (clienteId && clienteId !== cfg.clienteId) {
      cfg.clienteId = clienteId.trim();
      guardarCfg();
      adaptador = null;
    }
    if (api) {
      opcionesAdaptador.api = api;
      adaptador = null;
    }
    if (!adaptador && cfg.clienteId) adaptador = crearAdaptadorDrive({ clienteId: cfg.clienteId, ...opcionesAdaptador });
    emitir();
  }
  async function conectar({ forzarConsentimiento = false } = {}) {
    configurar();
    if (!adaptador) throw new Error("Falta el Client ID de Google.");
    await adaptador.conectar({ forzarConsentimiento });
    est.error = null;
    emitir();
    if (cfg.carpetaId) programar(200);
  }
  function conectarConToken(token, segundos = 3600) {
    configurar();
    adaptador.usarToken(token, segundos);
    emitir();
  }
  function desconectar({ olvidarCarpeta = false } = {}) {
    if (adaptador) adaptador.desconectar();
    if (olvidarCarpeta) {
      delete cfg.carpetaId;
      delete cfg.carpetaNombre;
      delete cfg.vistos;
      delete cfg.miArchivoId;
      guardarCfg();
    }
    emitir();
  }
  async function buscarCarpetas(nombre = NOMBRE_CARPETA_PRUEBA) {
    return adaptador.buscarCarpetas(nombre);
  }
  async function crearCarpeta(nombre = NOMBRE_CARPETA_PRUEBA) {
    const c = await adaptador.crearCarpeta(nombre);
    return usarCarpeta(c.id, { nombre: c.name || nombre });
  }
  async function usarCarpeta(idOEnlace, { nombre = null, empezarDesdeNube = false } = {}) {
    const id = idDeEnlaceDrive(idOEnlace);
    if (!id) throw new Error("No reconozco ese enlace o id de carpeta de Drive.");
    const d = await adaptador.datosCarpeta(id);
    if (d.mimeType && d.mimeType !== "application/vnd.google-apps.folder") throw new Error("Ese enlace no es una carpeta.");
    if (d.capabilities && d.capabilities.canAddChildren === false) throw new Error("Tienes acceso de solo lectura a esa carpeta. Pide que te la compartan como «Editor».");
    if (empezarDesdeNube) {
      await vaciar(almacenesRegistrados().filter(sincronizable));
      cfg.sucio = false;
    }
    cfg.carpetaId = id;
    cfg.carpetaNombre = nombre || d.name || id;
    cfg.vistos = {};
    delete cfg.miArchivoId;
    guardarCfg();
    emitir();
    await sincronizar();
    return estado();
  }
  function enlaceInvitacion(baseUrl = location.href) {
    if (!cfg.carpetaId) return null;
    const u = new URL(baseUrl.split("#")[0]);
    u.searchParams.set("carpeta", cfg.carpetaId);
    return u.toString();
  }
  function programar(ms = 4e3) {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      sincronizar().catch(() => {
      });
    }, ms);
  }
  function iniciar({ cada = 9e4 } = {}) {
    configurar();
    alCambiar((almacenes) => {
      if (!almacenes.some(sincronizable)) return;
      cfg.sucio = true;
      guardarCfg();
      emitir();
      if (estado().conectado && cfg.carpetaId) programar();
    });
    clearInterval(intervalo);
    intervalo = setInterval(() => {
      if (estado().conectado && cfg.carpetaId && document.visibilityState === "visible") sincronizar().catch(() => {
      });
    }, cada);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && estado().conectado && cfg.carpetaId) programar(500);
    });
    addEventListener("online", () => {
      if (estado().conectado && cfg.carpetaId) programar(500);
    });
    if (estado().conectado && cfg.carpetaId) programar(800);
  }
  var sinDatos = (r) => {
    const { datos, ...resto } = r;
    return resto;
  };
  async function fotografia() {
    const almacenes = {};
    for (const nombre of almacenesRegistrados().filter(sincronizable)) {
      const regs = await todos(nombre);
      almacenes[nombre] = nombre === ALM_ARCHIVOS ? regs.map(sinDatos) : regs;
    }
    return { app: "topoland", formato: 1, dispositivoId: dispositivoId(), escritoEn: ahoraISO(), almacenes };
  }
  async function mezclar(remoto) {
    const conocidos = new Set(almacenesRegistrados());
    const ops = [];
    let cambios = 0;
    for (const [nombre, registros] of Object.entries(remoto.almacenes || {})) {
      if (!conocidos.has(nombre) || !sincronizable(nombre)) continue;
      for (const r of registros) {
        if (!r || !r.id) continue;
        const local = await obtener(nombre, r.id);
        if (local && (local.actualizadoEn || "") >= (r.actualizadoEn || "")) continue;
        const nuevo = { ...r };
        if (nombre === ALM_ARCHIVOS && local && local.datos && !nuevo.datos) nuevo.datos = local.datos;
        ops.push({ almacen: nombre, registro: nuevo });
        cambios++;
      }
    }
    if (ops.length) await guardarVarios(ops, { silencioso: true });
    return cambios;
  }
  async function subirArchivosPendientes(raiz) {
    let n = 0;
    for (const a of await todos(ALM_ARCHIVOS)) {
      if (a.eliminadoEn || !a.datos || a.nube && a.nube.estado === "subido") continue;
      const ruta = a.nube && a.nube.ruta || `Archivos/${a.nombre}`;
      const partes = ruta.split("/");
      const nombreArchivo = partes.pop();
      const carpetaId = await adaptador.asegurarRuta(raiz, partes.join("/"));
      const blob = await (await fetch(a.datos)).blob();
      const r = await adaptador.subir({ carpetaId, nombre: nombreArchivo, blob, mime: a.mime || blob.type });
      a.nube = { ...a.nube || {}, estado: "subido", id: r.id, ruta };
      a.actualizadoEn = ahoraISO();
      await guardar(ALM_ARCHIVOS, a, { silencioso: true });
      n++;
    }
    return n;
  }
  async function sincronizar() {
    if (!adaptador || !adaptador.tokenVigente() || !cfg.carpetaId) return null;
    if (est.sincronizando) {
      otraVez = true;
      return null;
    }
    est.sincronizando = true;
    est.error = null;
    emitir();
    const resumen2 = { recibidos: 0, archivosSubidos: 0, enviado: false };
    try {
      const raiz = cfg.carpetaId;
      const carpetaDatos = await adaptador.asegurarRuta(raiz, "datos");
      const mio = `${dispositivoId()}.json`;
      cfg.vistos = cfg.vistos || {};
      for (const f of await adaptador.listarArchivos(carpetaDatos)) {
        if (!f.name.endsWith(".json")) continue;
        if (f.name === mio) {
          cfg.miArchivoId = f.id;
          continue;
        }
        if (cfg.vistos[f.id] === f.modifiedTime) continue;
        const remoto = JSON.parse(await (await adaptador.descargar(f.id)).text());
        resumen2.recibidos += await mezclar(remoto);
        cfg.vistos[f.id] = f.modifiedTime;
      }
      resumen2.archivosSubidos = await subirArchivosPendientes(raiz);
      if (cfg.sucio || resumen2.recibidos || resumen2.archivosSubidos || !cfg.miArchivoId) {
        cfg.sucio = false;
        guardarCfg();
        const blob = new Blob([JSON.stringify(await fotografia())], { type: "application/json" });
        const r = await adaptador.subir({ carpetaId: carpetaDatos, nombre: mio, blob, mime: "application/json", archivoId: cfg.miArchivoId || null });
        cfg.miArchivoId = r.id;
        resumen2.enviado = true;
      }
      cfg.ultimaSync = est.ultimaSync = ahoraISO();
      est.ultimoResumen = resumen2;
      guardarCfg();
      if (resumen2.recibidos) for (const fn of oyentesDatos) {
        try {
          fn(resumen2);
        } catch (x) {
          console.warn(x);
        }
      }
      return resumen2;
    } catch (e) {
      console.warn("Sincronización:", e);
      est.error = e.message;
      if (!e.sinToken) {
        cfg.sucio = true;
        guardarCfg();
      }
      throw e;
    } finally {
      est.sincronizando = false;
      emitir();
      if (otraVez) {
        otraVez = false;
        programar(1e3);
      }
    }
  }
  async function descargarArchivo(registro) {
    if (!registro || !registro.nube || !registro.nube.id) return null;
    if (!adaptador || !adaptador.tokenVigente()) return null;
    return adaptador.descargar(registro.nube.id);
  }

  // compartido/archivos.js
  var ALM = "compartido_archivos";
  registrarAlmacenes([{ nombre: ALM, indices: [["dueno", ["duenoTipo", "duenoId"]]] }]);
  var TAMANO_MAXIMO = 15 * 1024 * 1024;
  var LADO_MAXIMO_FOTO = 1600;
  function leerComoDataURL(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
  }
  async function reducirFoto(archivo) {
    try {
      const url = URL.createObjectURL(archivo);
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      URL.revokeObjectURL(url);
      const escala = Math.min(1, LADO_MAXIMO_FOTO / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return { datos: c.toDataURL("image/jpeg", 0.85), mime: "image/jpeg" };
    } catch {
      return { datos: await leerComoDataURL(archivo), mime: archivo.type || "application/octet-stream" };
    }
  }
  var limpiar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_");
  async function guardarArchivo(archivo, meta, { personaId = null } = {}) {
    if (archivo.size > TAMANO_MAXIMO) throw new Error(`«${archivo.name}» pesa ${(archivo.size / 1048576).toFixed(1)} MB; el máximo es 15 MB.`);
    const esFoto = (archivo.type || "").startsWith("image/") && meta.rol !== "documento";
    const { datos, mime } = esFoto ? await reducirFoto(archivo) : { datos: await leerComoDataURL(archivo), mime: archivo.type || "application/pdf" };
    const nombre = archivo.name || `${meta.rol || "archivo"}.${mime.split("/")[1] || "bin"}`;
    const reg = sellar({
      modulo: meta.modulo || "",
      duenoTipo: meta.duenoTipo,
      duenoId: meta.duenoId,
      rol: meta.rol || "documento",
      proyectoId: meta.proyectoId || null,
      nombre,
      mime,
      tamano: Math.round((datos.length - datos.indexOf(",") - 1) * 0.75),
      datos,
      nube: { estado: "local", ruta: meta.carpeta ? `${meta.carpeta}/${limpiar(nombre)}` : null }
    }, { personaId });
    return guardar(ALM, reg);
  }
  async function infoArchivo(id) {
    const a = id ? await obtener(ALM, id) : null;
    if (!a || a.eliminadoEn) return null;
    const { datos, ...resto } = a;
    return resto;
  }
  async function archivosDe(duenoTipo, duenoId) {
    const lista = (await todos(ALM)).filter((a) => a.duenoTipo === duenoTipo && a.duenoId === duenoId && !a.eliminadoEn);
    return lista.map(({ datos, ...resto }) => resto).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  }
  function aBlob(dataURL) {
    const [cab, b64] = dataURL.split(",");
    const mime = (cab.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  var urlsCreadas = /* @__PURE__ */ new Map();
  async function urlArchivo(id) {
    if (urlsCreadas.has(id)) return urlsCreadas.get(id);
    const a = id ? await obtener(ALM, id) : null;
    if (!a || a.eliminadoEn) return null;
    if (!a.datos) {
      const blob = await descargarArchivo(a).catch(() => null);
      if (!blob) return null;
      a.datos = await leerComoDataURL(blob);
      await guardar(ALM, a, { silencioso: true });
    }
    const url = URL.createObjectURL(aBlob(a.datos));
    urlsCreadas.set(id, url);
    return url;
  }
  async function abrirArchivo(id) {
    const info = await infoArchivo(id);
    const url = await urlArchivo(id);
    if (!url) throw new Error(info && info.nube && info.nube.id ? "El archivo está en la nube: conéctate (☁) para abrirlo." : "No se encontró el archivo.");
    const ventana = window.open(url, "_blank");
    if (!ventana) {
      const a = document.createElement("a");
      a.href = url;
      a.download = (info == null ? void 0 : info.nombre) || "archivo";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }
  async function archivoAPapelera(id, { personaId = null } = {}) {
    urlsCreadas.delete(id);
    return enviarAPapelera(ALM, id, { personaId });
  }
  function tamanoLegible(bytes) {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  // modulos/equipos/modelo.js
  var VERSION_MODULO = "0.1f";
  var SCHEMA_VERSION = 1;
  var ALM2 = {
    equipos: "equipos_equipos",
    eventos: "equipos_eventos",
    // solo se agregan, nunca se editan
    alertas: "equipos_alertas",
    modelos: "equipos_modelos",
    // especificaciones y documentos compartidos por modelo (marca + modelo)
    certificados: "equipos_certificados",
    mantenciones: "equipos_mantenciones",
    notas: "equipos_notas"
    // notas de terreno
  };
  var DEFINICIONES_ALMACENES = [
    { nombre: ALM2.equipos },
    { nombre: ALM2.eventos, indices: [["equipoId", "equipoId"], ["proyectoId", "proyectoId"]] },
    { nombre: ALM2.alertas, indices: [["equipoId", "equipoId"]] },
    { nombre: ALM2.modelos },
    { nombre: ALM2.certificados, indices: [["equipoId", "equipoId"]] },
    { nombre: ALM2.mantenciones, indices: [["equipoId", "equipoId"]] },
    { nombre: ALM2.notas, indices: [["equipoId", "equipoId"]] }
  ];
  var ESPECIFICACIONES = {
    "Estación total": [
      { clave: "precisionAngular", etiqueta: "Precisión angular", sufijo: '"' },
      { clave: "precisionDistancia", etiqueta: "Precisión distancia", sufijo: "mm + ppm" },
      { clave: "alcanceSinPrisma", etiqueta: "Alcance sin prisma", sufijo: "m" },
      { clave: "alcancePrisma", etiqueta: "Alcance con prisma", sufijo: "m" },
      { clave: "egl", etiqueta: "Guía EGL", opciones: ["Sí", "No"] },
      { clave: "motorizada", etiqueta: "Motorizada / robótica", opciones: ["Sí", "No"] }
    ],
    "Nivel": [
      { clave: "aumento", etiqueta: "Aumento", sufijo: "x" },
      { clave: "precisionKm", etiqueta: "Precisión doble nivelación", sufijo: "mm/km" },
      { clave: "tipoNivel", etiqueta: "Tipo", opciones: ["Automático", "Digital"] }
    ],
    "GNSS": [
      { clave: "precisionRtk", etiqueta: "Precisión RTK (H / V)", sufijo: "" },
      { clave: "precisionEstatica", etiqueta: "Precisión estática (H / V)", sufijo: "" },
      { clave: "constelaciones", etiqueta: "Constelaciones", sufijo: "" },
      { clave: "radio", etiqueta: "Radio interna", sufijo: "" },
      { clave: "canales", etiqueta: "Canales", sufijo: "" }
    ],
    "Dron (RPAS)": [
      { clave: "camara", etiqueta: "Cámara / sensor", sufijo: "" },
      { clave: "rtk", etiqueta: "RTK", opciones: ["Sí", "No"] },
      { clave: "autonomia", etiqueta: "Autonomía", sufijo: "min" },
      { clave: "alcanceTransmision", etiqueta: "Alcance de transmisión", sufijo: "km" },
      { clave: "peso", etiqueta: "Peso de despegue", sufijo: "g" }
    ],
    "Escáner láser": [
      { clave: "tipoEscaner", etiqueta: "Tipo", opciones: ["Estático", "Móvil (SLAM)"] },
      { clave: "alcance", etiqueta: "Alcance", sufijo: "m" },
      { clave: "puntosSegundo", etiqueta: "Puntos por segundo", sufijo: "" },
      { clave: "precisionEscaner", etiqueta: "Precisión", sufijo: "mm" }
    ]
  };
  var ESPECIFICACIONES_GENERICAS = [{ clave: "resumen", etiqueta: "Características", sufijo: "" }];
  function camposEspecificacion(categoria) {
    return ESPECIFICACIONES[categoria] || ESPECIFICACIONES_GENERICAS;
  }
  function especificacionesDeDescripcion(categoria, descripcion) {
    const d = String(descripcion || "");
    const s = {};
    let m;
    if (categoria === "Estación total") {
      if (m = d.match(/(\d+(?:[.,]\d+)?)\s*(?:"|''|”|″|seg)/i)) s.precisionAngular = m[1];
      if (m = d.match(/\b(?:R|NP|NR)\s*(\d{3,4})\s*m?\b/i)) s.alcanceSinPrisma = m[1];
      if (/\bEGL\b/i.test(d)) s.egl = "Sí";
    } else if (categoria === "Nivel") {
      if (m = d.match(/(\d{2})\s*x\b/i)) s.aumento = m[1];
    } else if (categoria === "Dron (RPAS)") {
      if (/\bRTK\b/i.test(d)) s.rtk = "Sí";
    }
    return s;
  }
  var ESTADOS_ACCESORIO = { bueno: "Bueno", danado: "Dañado", falta: "Falta" };
  var TIPOS_MANTENCION = ["Calibración", "Preventiva", "Correctiva (reparación)", "Revisión"];
  var CAMPOS_ADMIN = [
    { clave: "nActivoFijo", etiqueta: "N° activo fijo" },
    { clave: "fechaCompra", etiqueta: "Fecha de compra", tipo: "date" },
    { clave: "proveedorCompra", etiqueta: "Proveedor" },
    { clave: "valorCompra", etiqueta: "Valor de compra ($)", tipo: "number" },
    { clave: "garantiaHasta", etiqueta: "Garantía hasta", tipo: "date" },
    { clave: "seguroCompania", etiqueta: "Seguro: compañía" },
    { clave: "seguroPoliza", etiqueta: "Seguro: póliza" },
    { clave: "seguroVence", etiqueta: "Seguro: vence", tipo: "date", venceAviso: "Seguro" },
    { clave: "dgacRegistro", etiqueta: "Registro DGAC", soloCategoria: "Dron (RPAS)" },
    { clave: "dgacVence", etiqueta: "Registro DGAC: vence", tipo: "date", venceAviso: "Registro DGAC", soloCategoria: "Dron (RPAS)" }
  ];
  var COLUMNAS_PLANILLA = [
    { campo: "equipo", etiqueta: "EQUIPO" },
    { campo: "marca", etiqueta: "MARCA" },
    { campo: "modelo", etiqueta: "MODELO" },
    { campo: "descripcion", etiqueta: "DESCRIPCIÓN" },
    { campo: "numeroSerie", etiqueta: "N° SERIE" },
    { campo: "fechaUltimaCalibracion", etiqueta: "FECHA CALIBRACIÓN" }
  ];
  var COLUMNAS_INFORMATIVAS = [
    "CATEGORÍA",
    "UBICACIÓN",
    "PROYECTO",
    "RESPONSABLE",
    "PRÓXIMA CALIBRACIÓN",
    "ESTADO CALIBRACIÓN",
    "CERTIFICADO VIGENTE",
    "FECHA CERTIFICADO",
    "ALERTAS ACTIVAS",
    "ACCESORIOS POR REVISAR",
    "CÓDIGO INTERNO",
    "OBSERVACIONES"
  ];
  var MARCAS_NO_APLICA = ["-", "—", "–", "N/A", "NA", "NO APLICA", "NO CORRESPONDE"];
  var CATEGORIAS = [
    "Estación total",
    "GNSS",
    "Nivel",
    "Dron (RPAS)",
    "Escáner láser",
    "Ecosonda",
    "GPR",
    "Controlador",
    "Otro"
  ];
  var MARCAS_CONOCIDAS = [
    "Leica",
    "Topcon",
    "Geomax",
    "Trimble",
    "Sokkia",
    "Nikon",
    "Spectra",
    "South",
    "Stonex",
    "CHC",
    "Pentax",
    "DJI",
    "FARO",
    "GeoSLAM",
    "Emlid"
  ];
  var COMPONENTES_SUGERIDOS = {
    "Estación total": ["Estuche", "Trípode", "Batería 1", "Batería 2", "Cargador", "Prisma", "Bastón porta prisma"],
    "GNSS": ["Estuche", "Receptor", "Bastón", "Batería 1", "Batería 2", "Cargador", "Antena de radio", "Controlador", "Base nivelante / trípode", "Huincha de altura"],
    "Nivel": ["Estuche", "Trípode", "Mira", "Sapo"],
    "Dron (RPAS)": ["Estuche", "Control remoto", "Batería 1", "Batería 2", "Batería 3", "Cargador", "Hélices de repuesto", "Tarjeta de memoria"],
    "Escáner láser": ["Estuche", "Trípode", "Batería 1", "Batería 2", "Cargador", "Tarjeta de memoria", "Esferas / dianas"],
    "Ecosonda": ["Estuche", "Transductor", "Cables", "Soporte"],
    "GPR": ["Antena", "Unidad de control", "Batería", "Cargador", "Carro / odómetro"],
    "Controlador": ["Cargador", "Lápiz", "Soporte de bastón"],
    "Otro": []
  };
  var PERIODO_CALIBRACION_MESES = 12;
  var DIAS_AVISO_CALIBRACION = 30;
  var ESTADOS_ALERTA = {
    abierta: "Abierta",
    en_mantencion: "En mantención",
    recibida: "Recibida de mantención",
    cerrada: "Cerrada"
  };
  var PASOS_ALERTA = {
    abierta: [
      { estado: "en_mantencion", texto: "Enviar a mantención" },
      { estado: "cerrada", texto: "Cerrar sin mantención" }
    ],
    en_mantencion: [{ estado: "recibida", texto: "Marcar recibido" }],
    recibida: [{ estado: "cerrada", texto: "Cerrar alerta" }],
    cerrada: []
  };
  var LUGARES = {
    oficina: "En oficina",
    terreno: "En terreno",
    mantencion: "En mantención",
    baja: "De baja"
  };
  var TIPOS_EVENTO = {
    alta: "Alta del equipo",
    salida: "Salida a proyecto",
    traspaso: "Traspaso entre proyectos",
    regreso: "Regreso a oficina",
    uso: "Uso registrado",
    calibracion: "Calibración",
    alerta: "Alerta",
    baja: "Dado de baja",
    reactivacion: "Reactivado"
  };
  function nuevoEquipo(datos = {}) {
    return {
      // — columnas de la planilla de equipos —
      equipo: "",
      // tipo, como lo escribe la planilla («Estacion Total», «Nivel Topografico»…)
      marca: "",
      modelo: "",
      descripcion: "",
      // precisión/alcance, aumento o rol (Base, Rover, RTK, Control…), tal cual
      numeroSerie: "",
      fechaUltimaCalibracion: null,
      // aaaa-mm-dd
      calibracionNoAplica: false,
      // true cuando la planilla trae «-» (drones, escáner)
      // — campos que agrega el módulo —
      categoria: "Otro",
      codigoInterno: "",
      periodoCalibracionMeses: PERIODO_CALIBRACION_MESES,
      laboratorio: "",
      accesorios: [],
      // [{ id, nombre, cantidad, serie, estado: bueno|danado|falta }]; arma el checklist
      fotoId: null,
      // archivo (compartido/archivos.js) con la foto del equipo
      placaId: null,
      // foto de la placa con el N° de serie
      admin: {},
      // datos administrativos (CAMPOS_ADMIN), solo RRHH
      fechaAlta: hoyISO(),
      observaciones: "",
      deBaja: false,
      columnasExtra: {},
      // columnas de la planilla que no tienen campo propio: no se pierden
      origen: "manual",
      // 'manual' | 'planilla'
      ...datos
    };
  }
  function inferirMarca(texto3) {
    const t = normalizarTexto(texto3);
    return MARCAS_CONOCIDAS.find((m) => t.includes(normalizarTexto(m))) || "";
  }
  function categoriaDeFila(equipo, resto = "") {
    const c = inferirCategoria(equipo);
    return c !== "Otro" ? c : inferirCategoria(`${equipo} ${resto}`);
  }
  function migrarEquipo(eq) {
    if (!eq) return eq;
    if (eq.descripcion === void 0) eq.descripcion = eq.detalle || "";
    delete eq.detalle;
    if (eq.calibracionNoAplica === void 0) eq.calibracionNoAplica = false;
    if (!Array.isArray(eq.accesorios)) {
      eq.accesorios = (eq.componentes || []).map((nombre, i) => ({ id: `a${i}`, nombre, cantidad: 1, serie: "", estado: "bueno" }));
    }
    delete eq.componentes;
    if (!eq.admin) eq.admin = {};
    return eq;
  }
  function claveModelo(eq) {
    const k = normalizarTexto(`${eq.marca || ""} ${eq.modelo || ""}`).replace(/ /g, "-");
    return k ? `modelo-${k}` : null;
  }
  function vencimientosAdmin(eq, hoy = hoyISO()) {
    const salida = [];
    for (const c of CAMPOS_ADMIN) {
      if (!c.venceAviso) continue;
      if (c.soloCategoria && c.soloCategoria !== eq.categoria) continue;
      const f = eq.admin && eq.admin[c.clave];
      if (!f) continue;
      const dias = diasEntre(hoy, f);
      salida.push({ nombre: c.venceAviso, fecha: f, dias, nivel: dias < 0 ? "vencida" : dias <= DIAS_AVISO_CALIBRACION ? "por_vencer" : "ok" });
    }
    return salida;
  }
  function periodosDeUso(eventosAsc, hoy = hoyISO()) {
    const periodos = [];
    let actual = null;
    const cerrar = (fecha2) => {
      if (actual) {
        actual.hasta = fecha2;
        periodos.push(actual);
        actual = null;
      }
    };
    for (const e of eventosAsc) {
      if (e.tipo === "salida" || e.tipo === "traspaso") {
        cerrar(e.fecha);
        actual = { proyectoId: e.proyectoId, personaId: e.personaId, desde: e.fecha, hasta: null };
      } else if (e.tipo === "regreso" || e.tipo === "alerta" && e.estadoAlerta === "en_mantencion") cerrar(e.fecha);
    }
    if (actual) periodos.push(actual);
    for (const p of periodos) {
      const fin = p.hasta ? p.hasta.slice(0, 10) : hoy;
      p.dias = Math.max(1, diasEntre(p.desde.slice(0, 10), fin) + 1);
    }
    return periodos.reverse();
  }
  function inferirCategoria(texto3) {
    const t = " " + normalizarTexto(texto3) + " ";
    const reglas = [
      ["GNSS", /GNSS|GPS|HIPER|\bR10\b|\bR12\b|\bR8\b|\bR2\b|GS1\d|GS0\d|RECEPTOR|ZENITH/],
      ["Estación total", /ESTACION|\bET\b|TOTAL STATION|\bTS ?\d|\bGTS|\bGPT|\bGM ?\d|\bOS ?\d|\bES ?\d|ZOOM|FLEXLINE|NIKON N/],
      ["Nivel", /\bNIVEL\b|\bNA ?\d|\bAT ?B|\bLS ?\d|AUTOLEVEL/],
      ["Dron (RPAS)", /DRON|DRONE|RPAS|MAVIC|PHANTOM|MATRICE|EBEE|INSPIRE/],
      ["Escáner láser", /ESCANER|SCANNER|FARO|FOCUS|SLAM|\bZEB|HORIZON|\bRTC360|\bBLK/],
      ["Ecosonda", /ECOSONDA|BATIM|ECHO/],
      ["GPR", /\bGPR\b|GEORADAR|GEORRADAR/],
      ["Controlador", /COLECTOR|CONTROLADOR|LIBRETA|\bTSC\d|\bFC ?\d|DATA ?COLLECTOR/]
    ];
    for (const [cat, re] of reglas) if (re.test(t)) return cat;
    return "Otro";
  }
  function estadoCalibracion(equipo, hoy = hoyISO()) {
    if (equipo.calibracionNoAplica) return { nivel: "no_aplica", proxima: null, dias: null };
    if (!equipo.fechaUltimaCalibracion) return { nivel: "sin_dato", proxima: null, dias: null };
    const proxima = sumarMeses(equipo.fechaUltimaCalibracion, equipo.periodoCalibracionMeses || PERIODO_CALIBRACION_MESES);
    const dias = diasEntre(hoy, proxima);
    const nivel = dias < 0 ? "vencida" : dias <= DIAS_AVISO_CALIBRACION ? "por_vencer" : "ok";
    return { nivel, proxima, dias };
  }
  function calcularUbicacion(equipo, eventosAsc) {
    let u = { lugar: "oficina", proyectoId: OFICINA_ID, personaId: null, desde: equipo.fechaAlta || equipo.creadoEn };
    for (const e of eventosAsc) {
      if (e.tipo === "salida" || e.tipo === "traspaso") u = { lugar: "terreno", proyectoId: e.proyectoId, personaId: e.personaId, desde: e.fecha };
      else if (e.tipo === "regreso") u = { lugar: "oficina", proyectoId: OFICINA_ID, personaId: null, desde: e.fecha };
      else if (e.tipo === "alerta" && e.estadoAlerta === "en_mantencion") u = { lugar: "mantencion", proyectoId: null, personaId: null, desde: e.fecha };
      else if (e.tipo === "alerta" && e.estadoAlerta === "recibida" && u.lugar === "mantencion") u = { lugar: "oficina", proyectoId: OFICINA_ID, personaId: null, desde: e.fecha };
    }
    if (equipo.deBaja) u = { ...u, lugar: "baja" };
    return u;
  }
  function alertaActiva(a) {
    return !a.eliminadoEn && a.estado !== "cerrada";
  }
  function claveSerie(s) {
    return normalizarTexto(s).replace(/ /g, "");
  }
  function nombreCorto(eq) {
    const marcaYa = eq.marca && normalizarTexto(eq.modelo).includes(normalizarTexto(eq.marca));
    const partes = [eq.equipo, [marcaYa ? "" : eq.marca, eq.modelo].filter(Boolean).join(" ")].filter(Boolean);
    const unicas = partes.filter((p, i) => i === 0 || !normalizarTexto(partes[0]).includes(normalizarTexto(p)));
    return unicas.join(" · ") || eq.numeroSerie || "Equipo sin nombre";
  }

  // modulos/equipos/datos.js
  var personaActual = null;
  function iniciarDatos({ personaId = null } = {}) {
    registrarAlmacenes(DEFINICIONES_ALMACENES);
    personaActual = personaId;
  }
  function fijarPersona(personaId) {
    personaActual = personaId;
  }
  var sello = (r) => sellar(r, { personaId: personaActual, schemaVersion: SCHEMA_VERSION });
  var vivo = (r) => !r.eliminadoEn;
  var porFecha = (a, b) => (a.fecha || "").localeCompare(b.fecha || "");
  function nuevoEvento(datos) {
    return sello({
      equipoId: null,
      tipo: "",
      fecha: ahoraISO(),
      proyectoId: null,
      personaId: null,
      desdeProyectoId: null,
      checklist: [],
      faltantes: [],
      alertasAbiertas: [],
      avisos: [],
      nota: "",
      ...datos
    });
  }
  async function leerEquipo(id) {
    return migrarEquipo(await obtener(ALM2.equipos, id));
  }
  async function listarEquipos({ incluirEliminados = false } = {}) {
    const lista = (await todos(ALM2.equipos)).map(migrarEquipo);
    return incluirEliminados ? lista : lista.filter(vivo);
  }
  async function guardarEquipo(datos) {
    const existente = datos.id ? await leerEquipo(datos.id) : null;
    const eq = sello(existente ? { ...existente, ...datos } : nuevoEquipo(datos));
    if (existente) {
      await guardar(ALM2.equipos, eq);
      return eq;
    }
    const ev = nuevoEvento({ equipoId: eq.id, tipo: "alta", proyectoId: OFICINA_ID, nota: eq.origen === "planilla" ? "Importado desde la planilla de RRHH" : "" });
    await guardarVarios([{ almacen: ALM2.equipos, registro: eq }, { almacen: ALM2.eventos, registro: ev }]);
    return eq;
  }
  async function papeleraEquipo(id) {
    return enviarAPapelera(ALM2.equipos, id, { personaId: personaActual, schemaVersion: SCHEMA_VERSION });
  }
  async function cambiarBaja(equipoId, deBaja, nota = "") {
    const eq = await leerEquipo(equipoId);
    eq.deBaja = deBaja;
    const ev = nuevoEvento({ equipoId, tipo: deBaja ? "baja" : "reactivacion", nota });
    await guardarVarios([{ almacen: ALM2.equipos, registro: sello(eq) }, { almacen: ALM2.eventos, registro: ev }]);
  }
  async function eventosDeEquipo(equipoId) {
    return (await porIndice(ALM2.eventos, "equipoId", equipoId)).sort(porFecha);
  }
  async function alertasDeEquipo(equipoId) {
    return (await porIndice(ALM2.alertas, "equipoId", equipoId)).filter(vivo).sort((a, b) => b.fechaReporte.localeCompare(a.fechaReporte));
  }
  async function todasLasAlertas() {
    return (await todos(ALM2.alertas)).filter(vivo).sort((a, b) => b.fechaReporte.localeCompare(a.fechaReporte));
  }
  function componerEstado(eq, eventosAsc, alertas) {
    return {
      equipo: eq,
      nombre: nombreCorto(eq),
      ubicacion: calcularUbicacion(eq, eventosAsc),
      calibracion: estadoCalibracion(eq),
      vencimientos: vencimientosAdmin(eq),
      alertasActivas: alertas.filter(alertaActiva)
    };
  }
  async function estadoDeEquipo(equipoId) {
    const eq = await leerEquipo(equipoId);
    if (!eq || eq.eliminadoEn) return null;
    const [eventos, alertas] = await Promise.all([eventosDeEquipo(equipoId), alertasDeEquipo(equipoId)]);
    return { ...componerEstado(eq, eventos, alertas), eventos, alertas };
  }
  async function listarConEstado() {
    var _a, _b;
    const [equipos, eventos, alertas] = await Promise.all([listarEquipos(), todos(ALM2.eventos), todos(ALM2.alertas)]);
    const evPor = {}, alPor = {};
    for (const e of eventos.sort(porFecha)) (evPor[_a = e.equipoId] || (evPor[_a] = [])).push(e);
    for (const a of alertas.filter(vivo)) (alPor[_b = a.equipoId] || (alPor[_b] = [])).push(a);
    return equipos.map((eq) => componerEstado(eq, evPor[eq.id] || [], alPor[eq.id] || []));
  }
  function avisosDe(estado3) {
    const avisos = [];
    for (const a of estado3.alertasActivas) avisos.push(`Alerta activa: ${a.descripcion}`);
    if (estado3.calibracion.nivel === "vencida") avisos.push(`Calibración vencida (${fechaLegible(estado3.calibracion.proxima)})`);
    if (estado3.calibracion.nivel === "por_vencer") avisos.push(`Calibración vence el ${fechaLegible(estado3.calibracion.proxima)}`);
    for (const v of estado3.vencimientos || []) {
      if (v.nivel === "vencida") avisos.push(`${v.nombre} vencido (${fechaLegible(v.fecha)})`);
      if (v.nivel === "por_vencer") avisos.push(`${v.nombre} vence el ${fechaLegible(v.fecha)}`);
    }
    return avisos;
  }
  async function registrarSalida(items, { proyectoId, personaId, nota = "" }) {
    const ops = [];
    const resultado = [];
    for (const it of items) {
      const est2 = await estadoDeEquipo(it.equipoId);
      if (!est2) continue;
      const tipo = est2.ubicacion.lugar === "terreno" ? "traspaso" : "salida";
      const ev = nuevoEvento({
        equipoId: it.equipoId,
        tipo,
        proyectoId,
        personaId,
        desdeProyectoId: est2.ubicacion.proyectoId,
        checklist: it.checklist,
        faltantes: it.checklist.filter((c) => !c.ok).map((c) => c.nombre),
        alertasAbiertas: est2.alertasActivas.map((a) => a.id),
        avisos: avisosDe(est2),
        nota
      });
      ops.push({ almacen: ALM2.eventos, registro: ev });
      resultado.push({ nombre: est2.nombre, tipo, faltantes: ev.faltantes, avisos: ev.avisos });
    }
    await guardarVarios(ops);
    return resultado;
  }
  async function registrarRegreso(items, { nota = "" } = {}) {
    const ops = [];
    const resultado = [];
    for (const it of items) {
      const est2 = await estadoDeEquipo(it.equipoId);
      if (!est2) continue;
      const ev = nuevoEvento({
        equipoId: it.equipoId,
        tipo: "regreso",
        proyectoId: OFICINA_ID,
        personaId: est2.ubicacion.personaId,
        desdeProyectoId: est2.ubicacion.proyectoId,
        checklist: it.checklist,
        faltantes: it.checklist.filter((c) => !c.ok).map((c) => c.nombre),
        alertasAbiertas: est2.alertasActivas.map((a) => a.id),
        nota
      });
      ops.push({ almacen: ALM2.eventos, registro: ev });
      const eq = est2.equipo;
      let cambio = false;
      for (const c of it.checklist) {
        const acc = eq.accesorios.find((a) => a.nombre === c.nombre);
        if (!acc) continue;
        if (!c.ok && acc.estado !== "falta") {
          acc.estado = "falta";
          cambio = true;
        } else if (c.ok && acc.estado === "falta") {
          acc.estado = "bueno";
          cambio = true;
        }
      }
      if (cambio) ops.push({ almacen: ALM2.equipos, registro: sello(eq) });
      resultado.push({ nombre: est2.nombre, faltantes: ev.faltantes });
    }
    await guardarVarios(ops);
    return resultado;
  }
  async function registrarUso(equipoId, personaId, proyectoId, nota = "") {
    const est2 = await estadoDeEquipo(equipoId);
    if (!est2) return null;
    const ev = nuevoEvento({
      equipoId,
      tipo: "uso",
      personaId,
      proyectoId,
      alertasAbiertas: est2.alertasActivas.map((a) => a.id),
      avisos: avisosDe(est2),
      nota
    });
    await guardar(ALM2.eventos, ev);
    return { evento: ev, alertas: est2.alertasActivas };
  }
  async function reportarAnomalia({ equipoId, descripcion, proyectoId = null, personaId = null }) {
    const est2 = await estadoDeEquipo(equipoId);
    const quien = personaId || personaActual;
    const proyecto2 = proyectoId || est2 && est2.ubicacion.proyectoId || null;
    const ahora = ahoraISO();
    const alerta = sello({
      equipoId,
      descripcion,
      estado: "abierta",
      reportadaPor: quien,
      proyectoId: proyecto2,
      fechaReporte: ahora,
      historial: [{ estado: "abierta", fecha: ahora, personaId: quien, nota: descripcion }]
    });
    const ev = nuevoEvento({ equipoId, tipo: "alerta", alertaId: alerta.id, estadoAlerta: "abierta", personaId: quien, proyectoId: proyecto2, nota: descripcion });
    await guardarVarios([{ almacen: ALM2.alertas, registro: alerta }, { almacen: ALM2.eventos, registro: ev }]);
    return alerta;
  }
  async function cambiarEstadoAlerta(alertaId, estado3, nota = "") {
    const a = await obtener(ALM2.alertas, alertaId);
    if (!a) return null;
    const ahora = ahoraISO();
    a.estado = estado3;
    a.historial = [...a.historial || [], { estado: estado3, fecha: ahora, personaId: personaActual, nota }];
    if (estado3 === "cerrada") a.fechaCierre = ahora;
    const ev = nuevoEvento({ equipoId: a.equipoId, tipo: "alerta", alertaId, estadoAlerta: estado3, personaId: personaActual, nota });
    await guardarVarios([{ almacen: ALM2.alertas, registro: sello(a) }, { almacen: ALM2.eventos, registro: ev }]);
    return a;
  }
  async function usosConAlerta(alertaId, equipoId) {
    return (await eventosDeEquipo(equipoId)).filter((e) => (e.alertasAbiertas || []).includes(alertaId));
  }
  var carpetaEquipo = (eq) => `Equipos/${[eq.marca, eq.modelo, eq.numeroSerie].filter(Boolean).join(" ")}`;
  async function fijarFoto(equipoId, rol, archivo) {
    const eq = await leerEquipo(equipoId);
    const campo = rol === "placa" ? "placaId" : "fotoId";
    const a = await guardarArchivo(archivo, { modulo: "equipos", duenoTipo: "equipo", duenoId: equipoId, rol, carpeta: `${carpetaEquipo(eq)}/Fotos` }, { personaId: personaActual });
    if (eq[campo]) await archivoAPapelera(eq[campo], { personaId: personaActual });
    eq[campo] = a.id;
    await guardar(ALM2.equipos, sello(eq));
    return a;
  }
  async function guardarAccesorios(equipoId, lista) {
    const eq = await leerEquipo(equipoId);
    eq.accesorios = lista.filter((a) => a.nombre && a.nombre.trim()).map((a) => ({
      id: a.id && !/^a\d+$/.test(a.id) ? a.id : uuid(),
      nombre: a.nombre.trim(),
      cantidad: Math.max(1, Number(a.cantidad) || 1),
      serie: (a.serie || "").trim(),
      estado: a.estado || "bueno"
    }));
    await guardar(ALM2.equipos, sello(eq));
    return eq.accesorios;
  }
  async function cambiarEstadoAccesorio(equipoId, accesorioId, estado3) {
    const eq = await leerEquipo(equipoId);
    const acc = eq.accesorios.find((a) => a.id === accesorioId);
    if (!acc) return;
    acc.estado = estado3;
    if (/^a\d+$/.test(acc.id)) eq.accesorios.forEach((a) => {
      if (/^a\d+$/.test(a.id)) a.id = uuid();
    });
    await guardar(ALM2.equipos, sello(eq));
  }
  async function obtenerModelo(eq) {
    const id = claveModelo(eq);
    return id ? await obtener(ALM2.modelos, id) || null : null;
  }
  async function guardarEspecificaciones(eq, specs, otras = "") {
    const id = claveModelo(eq);
    if (!id) throw new Error("El equipo necesita marca o modelo para guardar sus especificaciones.");
    const actual = await obtener(ALM2.modelos, id) || { id, marca: eq.marca, modelo: eq.modelo, categoria: eq.categoria };
    actual.specs = specs;
    actual.otras = otras;
    return guardar(ALM2.modelos, sello(actual));
  }
  async function subirDocumento(eq, { nivel, rol, archivo }) {
    const deModelo = nivel === "modelo";
    const duenoId = deModelo ? claveModelo(eq) : eq.id;
    if (!duenoId) throw new Error("El equipo necesita marca o modelo para guardar documentos del modelo.");
    const carpeta = deModelo ? `Equipos/Modelos/${[eq.marca, eq.modelo].filter(Boolean).join(" ")}` : `${carpetaEquipo(eq)}/Documentos`;
    return guardarArchivo(archivo, { modulo: "equipos", duenoTipo: deModelo ? "modelo" : "equipo-doc", duenoId, rol, carpeta }, { personaId: personaActual });
  }
  async function listarCertificados(equipoId) {
    return (await porIndice(ALM2.certificados, "equipoId", equipoId)).filter(vivo).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || b.creadoEn.localeCompare(a.creadoEn));
  }
  async function todosLosCertificados() {
    return (await todos(ALM2.certificados)).filter(vivo).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  }
  async function agregarCertificado(equipoId, { codigo, fecha: fecha2, laboratorio = "", archivo = null, actualizarFecha = true }) {
    const eq = await leerEquipo(equipoId);
    let archivoId = null;
    if (archivo) {
      const a = await guardarArchivo(archivo, { modulo: "equipos", duenoTipo: "certificado", duenoId: equipoId, rol: "certificado", carpeta: `${carpetaEquipo(eq)}/Certificados` }, { personaId: personaActual });
      archivoId = a.id;
    }
    const cert = sello({ equipoId, codigo: codigo.trim(), fecha: fecha2, laboratorio: laboratorio.trim(), archivoId });
    const ops = [{ almacen: ALM2.certificados, registro: cert }];
    if (actualizarFecha && !eq.calibracionNoAplica && (!eq.fechaUltimaCalibracion || fecha2 >= eq.fechaUltimaCalibracion)) {
      eq.fechaUltimaCalibracion = fecha2;
      if (laboratorio) eq.laboratorio = laboratorio;
      ops.push({ almacen: ALM2.equipos, registro: sello(eq) });
    }
    ops.push({ almacen: ALM2.eventos, registro: nuevoEvento({ equipoId, tipo: "calibracion", nota: [`Certificado ${cert.codigo} del ${fechaLegible(fecha2)}`, laboratorio].filter(Boolean).join(" · ") }) });
    await guardarVarios(ops);
    return cert;
  }
  async function adjuntarPdfCertificado(certId, archivo) {
    const c = await obtener(ALM2.certificados, certId);
    const eq = await leerEquipo(c.equipoId);
    const a = await guardarArchivo(archivo, { modulo: "equipos", duenoTipo: "certificado", duenoId: c.equipoId, rol: "certificado", carpeta: `${carpetaEquipo(eq)}/Certificados` }, { personaId: personaActual });
    c.archivoId = a.id;
    return guardar(ALM2.certificados, sello(c));
  }
  async function papeleraCertificado(id) {
    return enviarAPapelera(ALM2.certificados, id, { personaId: personaActual, schemaVersion: SCHEMA_VERSION });
  }
  async function listarMantenciones(equipoId) {
    return (await porIndice(ALM2.mantenciones, "equipoId", equipoId)).filter(vivo).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  }
  async function agregarMantencion(equipoId, datos) {
    const m = sello({
      equipoId,
      fecha: datos.fecha,
      tipo: datos.tipo,
      proveedor: datos.proveedor || "",
      orden: datos.orden || "",
      costo: datos.costo ? Number(datos.costo) : null,
      descripcion: datos.descripcion || "",
      alertaId: datos.alertaId || null
    });
    await guardar(ALM2.mantenciones, m);
    return m;
  }
  async function papeleraMantencion(id) {
    return enviarAPapelera(ALM2.mantenciones, id, { personaId: personaActual, schemaVersion: SCHEMA_VERSION });
  }
  async function listarNotas(equipoId) {
    return (await porIndice(ALM2.notas, "equipoId", equipoId)).filter(vivo).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  }
  async function agregarNota(equipoId, texto3) {
    return guardar(ALM2.notas, sello({ equipoId, texto: texto3.trim(), archivada: false }));
  }
  async function archivarNota(id, archivada = true) {
    const n = await obtener(ALM2.notas, id);
    n.archivada = archivada;
    return guardar(ALM2.notas, sello(n));
  }
  async function guardarAdmin(equipoId, admin) {
    const eq = await leerEquipo(equipoId);
    eq.admin = { ...eq.admin, ...admin };
    return guardar(ALM2.equipos, sello(eq));
  }
  function personaActiva() {
    return personaActual;
  }

  // compartido/respaldo.js
  async function exportarRespaldo(prefijos = [""]) {
    const almacenes = {};
    for (const nombre of almacenesRegistrados()) {
      if (prefijos.some((p) => nombre.startsWith(p))) almacenes[nombre] = await todos(nombre);
    }
    return { app: "topoland", formato: 1, exportadoEn: ahoraISO(), dispositivoId: dispositivoId(), almacenes };
  }
  async function descargarRespaldo(prefijos, nombreBase = "respaldo") {
    const datos = await exportarRespaldo(prefijos);
    descargar(`${nombreBase}_${hoyISO()}.json`, JSON.stringify(datos, null, 2));
    return datos;
  }
  async function importarRespaldo(datos) {
    if (!datos || datos.app !== "topoland" || !datos.almacenes) throw new Error("El archivo no es un respaldo válido.");
    const conocidos = new Set(almacenesRegistrados());
    const resumen2 = { nuevos: 0, actualizados: 0, sinCambio: 0, omitidosAlmacen: [] };
    const ops = [];
    for (const [nombre, registros] of Object.entries(datos.almacenes)) {
      if (!conocidos.has(nombre)) {
        resumen2.omitidosAlmacen.push(nombre);
        continue;
      }
      for (const r of registros) {
        if (!r || !r.id) continue;
        const actual = await obtener(nombre, r.id);
        if (!actual) {
          ops.push({ almacen: nombre, registro: r });
          resumen2.nuevos++;
        } else if ((r.actualizadoEn || "") > (actual.actualizadoEn || "")) {
          ops.push({ almacen: nombre, registro: r });
          resumen2.actualizados++;
        } else resumen2.sinCambio++;
      }
    }
    await guardarVarios(ops);
    return resumen2;
  }

  // compartido/planilla.js
  var urlSheetJS = "vendor/xlsx.full.min.js";
  function leerCSV(texto3) {
    texto3 = texto3.replace(/^﻿/, "");
    const primera = texto3.split(/\r?\n/)[0] || "";
    const sep = (primera.match(/;/g) || []).length >= (primera.match(/,/g) || []).length ? ";" : ",";
    const filas = [];
    let fila = [];
    let campo = "";
    let entreComillas = false;
    for (let i = 0; i < texto3.length; i++) {
      const c = texto3[i];
      if (entreComillas) {
        if (c === '"' && texto3[i + 1] === '"') {
          campo += '"';
          i++;
        } else if (c === '"') entreComillas = false;
        else campo += c;
      } else if (c === '"') entreComillas = true;
      else if (c === sep) {
        fila.push(campo);
        campo = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto3[i + 1] === "\n") i++;
        fila.push(campo);
        filas.push(fila);
        fila = [];
        campo = "";
      } else campo += c;
    }
    if (campo !== "" || fila.length) {
      fila.push(campo);
      filas.push(fila);
    }
    return filas;
  }
  async function leerArchivoTabla(archivo, nombreHoja = null) {
    const nombre = (archivo.name || "").toLowerCase();
    if (nombre.endsWith(".csv") || nombre.endsWith(".txt")) {
      return { hojas: ["CSV"], hoja: "CSV", filas: leerCSV(await archivo.text()) };
    }
    if (!globalThis.XLSX) await cargarScript(urlSheetJS);
    const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array", cellDates: true });
    const hoja2 = nombreHoja && libro.SheetNames.includes(nombreHoja) ? nombreHoja : libro.SheetNames[0];
    const filas = XLSX.utils.sheet_to_json(libro.Sheets[hoja2], { header: 1, raw: true, defval: "" });
    return { hojas: libro.SheetNames, hoja: hoja2, filas };
  }
  function encontrarEncabezados(filas, palabrasClave, minimo = 2) {
    const claves = palabrasClave.map(normalizarTexto);
    for (let i = 0; i < Math.min(filas.length, 30); i++) {
      const celdas = filas[i].map(normalizarTexto);
      const hits = claves.filter((k) => celdas.some((c) => c.includes(k))).length;
      if (hits >= minimo) return i;
    }
    return -1;
  }
  function aFechaISO(v) {
    const p = (n) => String(n).padStart(2, "0");
    const armar = (a, m2, d) => {
      if (a < 100) a += 2e3;
      if (m2 < 1 || m2 > 12 || d < 1 || d > 31 || a < 1950 || a > 2100) return null;
      return `${a}-${p(m2)}-${p(d)}`;
    };
    if (v === null || v === void 0 || v === "") return null;
    if (v instanceof Date && !isNaN(v)) {
      const f = new Date(v.getTime() + 12 * 36e5);
      return armar(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate());
    }
    if (typeof v === "number" && v > 2e4 && v < 8e4) {
      const f = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5);
      return armar(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate());
    }
    const t = String(v).trim();
    let m;
    if (m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)) return armar(+m[1], +m[2], +m[3]);
    if (m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)) return armar(+m[3], +m[2], +m[1]);
    if (m = t.match(/^(\d{1,2})[-/.](\d{4})$/)) return armar(+m[2], +m[1], 1);
    if (/^\d+(\.\d+)?$/.test(t)) return aFechaISO(Number(t));
    return null;
  }

  // modulos/equipos/importar.js
  var CLAVES = [
    { campo: "fechaUltimaCalibracion", claves: ["CALIBRACION", "CALIBRADO"] },
    { campo: "numeroSerie", claves: ["SERIE", "SERIAL"] },
    { campo: "modelo", claves: ["MODELO"] },
    { campo: "descripcion", claves: ["DESCRIPCION", "DETALLE"] },
    { campo: "marca", claves: ["MARCA", "FABRICANTE"] },
    { campo: "equipo", claves: ["EQUIPO", "INSTRUMENTO", "TIPO"] }
  ];
  var NO_APLICA = new Set(MARCAS_NO_APLICA.map(normalizarTexto).concat([""]));
  function asignarColumnas(encabezados) {
    const usados = /* @__PURE__ */ new Set();
    const informativas = new Set(COLUMNAS_INFORMATIVAS.map(normalizarTexto));
    const columnas = encabezados.map((h, indice) => {
      const encabezado = String(h != null ? h : "").trim();
      return { indice, encabezado, campo: null, ignorar: informativas.has(normalizarTexto(encabezado)) };
    });
    for (const { campo, claves } of CLAVES) {
      const col = columnas.find((c) => !c.campo && !c.ignorar && c.encabezado && claves.some((k) => normalizarTexto(c.encabezado).includes(k)));
      if (col && !usados.has(campo)) {
        col.campo = campo;
        usados.add(campo);
      }
    }
    const faltan = COLUMNAS_PLANILLA.filter((c) => !usados.has(c.campo)).map((c) => c.etiqueta);
    return { columnas, faltan };
  }
  var texto = (v) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v != null ? v : "").trim();
  async function prepararImportacion(archivo) {
    const { filas, hoja: hoja2, hojas } = await leerArchivoTabla(archivo);
    const iEnc = encontrarEncabezados(filas, ["EQUIPO", "MARCA", "MODELO", "SERIE", "CALIBRACION", "DESCRIPCION", "DETALLE"], 2);
    if (iEnc < 0) throw new Error("No encontré la fila de encabezados (EQUIPO, MODELO, N° SERIE…). Revisa que la primera hoja sea la de equipos.");
    const { columnas, faltan } = asignarColumnas(filas[iEnc]);
    const existentes = await listarEquipos();
    const porSerie = new Map(existentes.filter((e) => e.numeroSerie).map((e) => [claveSerie(e.numeroSerie), e]));
    const vistosEnArchivo = /* @__PURE__ */ new Map();
    const registros = [];
    for (let i = iEnc + 1; i < filas.length; i++) {
      const fila = filas[i];
      if (!fila || fila.every((c) => texto(c) === "")) continue;
      const datos = { equipo: "", marca: "", modelo: "", descripcion: "", numeroSerie: "", fechaUltimaCalibracion: null, calibracionNoAplica: false };
      const extra = {};
      const problemas = [];
      for (const col of columnas) {
        const v = fila[col.indice];
        if (col.ignorar) continue;
        if (!col.campo) {
          if (texto(v) !== "" && col.encabezado) extra[col.encabezado] = texto(v);
          continue;
        }
        if (col.campo === "fechaUltimaCalibracion") {
          const f = aFechaISO(v);
          const tv = texto(v);
          if (f) datos.fechaUltimaCalibracion = f;
          else if (tv !== "" && NO_APLICA.has(normalizarTexto(tv))) datos.calibracionNoAplica = true;
          else if (texto(v) !== "") {
            problemas.push(`Fecha no reconocida: «${texto(v)}» (queda guardada como texto)`);
            extra[`${col.encabezado} (original)`] = texto(v);
          }
        } else datos[col.campo] = texto(v);
      }
      if (!datos.equipo && !datos.modelo && !datos.numeroSerie) continue;
      if (!datos.marca) datos.marca = inferirMarca([datos.equipo, datos.modelo, datos.descripcion].join(" "));
      const reg = {
        filaExcel: i + 1,
        datos,
        extra,
        problemas,
        categoria: categoriaDeFila(datos.equipo, `${datos.modelo} ${datos.descripcion}`),
        existente: null,
        accion: "nuevo"
      };
      if (!datos.numeroSerie) problemas.push("Sin N° de serie: se crea igual, pero no se podrá reconocer en una próxima importación");
      else {
        const k = claveSerie(datos.numeroSerie);
        if (vistosEnArchivo.has(k)) {
          problemas.push(`N° de serie repetido en la planilla (fila ${vistosEnArchivo.get(k)})`);
          reg.accion = "omitir";
        }
        vistosEnArchivo.set(k, reg.filaExcel);
        if (porSerie.has(k) && reg.accion !== "omitir") {
          reg.existente = porSerie.get(k);
          reg.accion = "actualizar";
        }
      }
      registros.push(reg);
    }
    return { archivo: archivo.name, hoja: hoja2, hojas, filaEncabezados: iEnc + 1, columnas, faltan, registros };
  }
  async function aplicarImportacion(registros) {
    const resumen2 = { nuevos: 0, actualizados: 0, omitidos: 0 };
    for (const r of registros) {
      if (r.accion === "omitir") {
        resumen2.omitidos++;
        continue;
      }
      if (r.accion === "actualizar" && r.existente) {
        const cambios = { id: r.existente.id };
        for (const [k, v] of Object.entries(r.datos)) if (v !== "" && v !== null && v !== false) cambios[k] = v;
        if (r.datos.fechaUltimaCalibracion) cambios.calibracionNoAplica = false;
        cambios.columnasExtra = { ...r.existente.columnasExtra || {}, ...r.extra };
        await guardarEquipo(cambios);
        resumen2.actualizados++;
      } else {
        await guardarEquipo({
          ...r.datos,
          categoria: r.categoria,
          columnasExtra: r.extra,
          origen: "planilla"
        });
        resumen2.nuevos++;
      }
    }
    return resumen2;
  }

  // modulos/equipos/ficha.js
  var urlQR = "vendor/qrcode.js";
  var dib = (d) => `<svg viewBox="0 0 120 160" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  var TRIPODE = '<path d="M60 92L30 152M60 92l30 60M60 92v62"/><path d="M42 92h36"/>';
  var DIBUJOS = {
    "Estación total": dib(`${TRIPODE}<rect x="42" y="34" width="36" height="52" rx="5"/><circle cx="60" cy="54" r="9"/><path d="M50 78h20"/><path d="M78 46h6v20h-6"/>`),
    "GNSS": dib('<ellipse cx="60" cy="26" rx="28" ry="10"/><path d="M32 26v8c0 6 13 10 28 10s28-4 28-10v-8"/><path d="M60 44v112"/><path d="M60 92h18v22H60"/>'),
    "Nivel": dib(`${TRIPODE}<rect x="26" y="60" width="68" height="20" rx="6"/><path d="M94 66h10v8H94M26 66h-8v8h8"/><path d="M48 80l-4 12h32l-4-12"/>`),
    "Dron (RPAS)": dib('<rect x="46" y="68" width="28" height="22" rx="6"/><path d="M46 72L22 56M74 72l24-16M46 86L22 102M74 86l24 16"/><ellipse cx="22" cy="54" rx="16" ry="4"/><ellipse cx="98" cy="54" rx="16" ry="4"/><ellipse cx="22" cy="104" rx="16" ry="4"/><ellipse cx="98" cy="104" rx="16" ry="4"/><circle cx="60" cy="96" r="5"/>'),
    "Escáner láser": dib(`${TRIPODE}<rect x="44" y="22" width="32" height="64" rx="10"/><circle cx="60" cy="50" r="8"/><path d="M48 40h24"/>`),
    "Otro": dib('<rect x="24" y="50" width="72" height="60" rx="6"/><path d="M48 50V38h24v12"/><path d="M24 74h72"/>')
  };
  var dibujo = (cat) => DIBUJOS[cat] || DIBUJOS.Otro;
  var SUBTABS = [
    { id: "accesorios", texto: "Accesorios" },
    { id: "certificados", texto: "Certificados" },
    { id: "historial", texto: "Historial" },
    { id: "mantencion", texto: "Mantención" },
    { id: "notas", texto: "Notas" },
    { id: "documentos", texto: "Documentos" },
    { id: "admin", texto: "Administración", soloRRHH: true }
  ];
  var ROLES_DOC = { ficha_tecnica: "Ficha técnica", manual: "Manual", guia: "Guía rápida", documento: "Otro documento" };
  function crearFicha(ctx2) {
    const { st, esc: esc2, proy, pers, avisar: avisar2, ir, render, esRRHH } = ctx2;
    const pesos = (n) => "$" + Math.round(n).toLocaleString("es-CL");
    async function vistaFicha() {
      const est2 = await estadoDeEquipo(st.equipoId);
      if (!est2) return '<p>El equipo no existe o está en la papelera.</p><button class="eq-btn" data-accion="ir" data-vista="lista">Volver</button>';
      const eq = est2.equipo;
      const tab = SUBTABS.some((s) => s.id === st.fichaTab && (!s.soloRRHH || esRRHH)) ? st.fichaTab : "accesorios";
      const [modelo, certs, mants, notas, docsModelo, docsUnidad] = await Promise.all([
        obtenerModelo(eq),
        listarCertificados(eq.id),
        listarMantenciones(eq.id),
        listarNotas(eq.id),
        claveModelo(eq) ? archivosDe("modelo", claveModelo(eq)) : [],
        archivosDe("equipo-doc", eq.id)
      ]);
      const conteo = {
        accesorios: eq.accesorios.length,
        certificados: certs.length,
        mantencion: est2.alertasActivas.length,
        notas: notas.filter((n) => !n.archivada).length,
        documentos: docsModelo.length + docsUnidad.length
      };
      const ctxTab = { est: est2, eq, modelo, certs, mants, notas, docsModelo, docsUnidad };
      const cuerpoTab = await TABS[tab](ctxTab);
      return `
      <button class="eq-volver" data-accion="ir" data-vista="lista">← Equipos</button>
      ${await cabecera(est2, modelo, certs)}
      ${est2.alertasActivas.length ? `<button class="eq-banda-alerta" data-accion="ficha-tab" data-tab="mantencion">
        ⚠ ${est2.alertasActivas.length === 1 ? esc2(est2.alertasActivas[0].descripcion) : `${est2.alertasActivas.length} alertas activas`}
        <span>${ESTADOS_ALERTA[est2.alertasActivas[0].estado]} · ver</span></button>` : ""}
      <nav class="eq-subtabs" role="tablist">${SUBTABS.filter((s) => !s.soloRRHH || esRRHH).map((s) => `<button role="tab" class="eq-subtab${s.id === tab ? " activa" : ""}${s.id === "mantencion" && conteo.mantencion ? " alerta" : ""}" data-accion="ficha-tab" data-tab="${s.id}">${s.texto}${conteo[s.id] ? ` <span>${conteo[s.id]}</span>` : ""}</button>`).join("")}</nav>
      <section class="eq-subpanel">${cuerpoTab}</section>`;
    }
    async function cabecera(est2, modelo, certs) {
      const eq = est2.equipo;
      const [urlFoto, urlPlaca] = await Promise.all([urlArchivo(eq.fotoId), urlArchivo(eq.placaId)]);
      const verPlaca = st.verPlaca && urlPlaca;
      const principal = verPlaca ? urlPlaca : urlFoto;
      const u = est2.ubicacion;
      const vig = certs[0];
      const deducidas = especificacionesDeDescripcion(eq.categoria, eq.descripcion);
      const guardadas = modelo && modelo.specs || {};
      const specs = camposEspecificacion(eq.categoria).map((c) => {
        const v = guardadas[c.clave] || deducidas[c.clave];
        if (!v) return "";
        const calc = !guardadas[c.clave];
        const unidad = c.sufijo && /^[\d.,\s]+$/.test(String(v)) ? c.sufijo === '"' ? '"' : ` <small>${esc2(c.sufijo)}</small>` : "";
        return `<div class="eq-spec"><dt>${c.etiqueta}</dt><dd>${esc2(String(v).trim())}${unidad}${calc ? ' <span class="eq-calc" title="Deducido de la descripción; confírmalo en Especificaciones">?</span>' : ""}</dd></div>`;
      }).join("");
      const datos = [
        ["Marca", eq.marca],
        ["Modelo", eq.modelo],
        ["N° serie", eq.numeroSerie, true],
        ["Calibración", eq.calibracionNoAplica ? "No aplica" : fechaLegible(eq.fechaUltimaCalibracion), true],
        ...!eq.calibracionNoAplica && est2.calibracion.proxima ? [["Próxima", fechaLegible(est2.calibracion.proxima), true]] : [],
        ["Certificado", vig ? vig.codigo : "—"]
      ].map(([k, v, mono]) => `<div class="eq-spec"><dt>${k}</dt><dd${mono ? ' class="eq-mono"' : ""}>${esc2(v || "—")}</dd></div>`).join("");
      const venc = (est2.vencimientos || []).filter((v) => v.nivel !== "ok").map((v) => `<span class="eq-chip ${v.nivel === "vencida" ? "rojo" : "ambar"}">${esc2(v.nombre)} ${v.nivel === "vencida" ? "vencido" : `vence en ${v.dias} d`}</span>`).join(" ");
      return `<header class="eq-ficha">
      <div class="eq-ficha-foto">
        <div class="eq-foto-marco">${principal ? `<img src="${principal}" alt="Foto de ${esc2(est2.nombre)}">` : `<div class="eq-foto-dibujo">${dibujo(eq.categoria)}<small>Sin foto</small></div>`}</div>
        <div class="eq-foto-acciones">
          ${urlFoto && urlPlaca ? `<button class="eq-btn chico${!verPlaca ? " activo" : ""}" data-accion="ver-foto" data-cual="foto">Equipo</button><button class="eq-btn chico${verPlaca ? " activo" : ""}" data-accion="ver-foto" data-cual="placa">Placa</button>` : ""}
          <label class="eq-btn chico">📷 ${urlFoto ? "Cambiar foto" : "Foto"}<input type="file" accept="image/*" capture="environment" data-accion-cambio="subir-foto" data-rol="foto" hidden></label>
          <label class="eq-btn chico">🏷 ${urlPlaca ? "Cambiar placa" : "Foto placa"}<input type="file" accept="image/*" capture="environment" data-accion-cambio="subir-foto" data-rol="placa" hidden></label>
        </div>
      </div>
      <div class="eq-ficha-info">
        <div class="eq-cat">${esc2(eq.categoria)}${eq.codigoInterno ? " · " + esc2(eq.codigoInterno) : ""}</div>
        <h2>${esc2(est2.nombre)}</h2>
        ${eq.descripcion ? `<p class="eq-ficha-desc">${esc2(eq.descripcion)}</p>` : ""}
        <div class="eq-chips">${ctx2.chipUbicacion(u)} ${ctx2.chipCalibracion(est2.calibracion)} ${venc}</div>
        ${u.lugar === "terreno" ? `<p class="eq-tenue" style="margin:6px 0 0">En ${esc2(proy(u.proyectoId))} desde ${fechaLegible(u.desde)} · responsable ${esc2(pers(u.personaId))}</p>` : ""}
        <dl class="eq-specs">${datos}</dl>
        <div class="eq-specs-cab"><span>Especificaciones técnicas${modelo ? "" : ""}</span>
          ${esRRHH && claveModelo(eq) ? '<button class="eq-enlace" data-accion="ir" data-vista="especificaciones">Editar</button>' : ""}</div>
        ${specs || modelo && modelo.otras ? `<dl class="eq-specs">${specs}</dl>${modelo && modelo.otras ? `<p class="eq-tenue eq-pre">${esc2(modelo.otras)}</p>` : ""}` : `<p class="eq-tenue">Sin especificaciones${esRRHH ? ". Se escriben una vez por modelo y las comparten todas las unidades iguales." : "."}</p>`}
        <div class="eq-acciones">
          <button class="eq-btn chico" data-accion="reportar" data-id="${eq.id}">⚠ Reportar anomalía</button>
          ${esRRHH ? `<button class="eq-btn chico" data-accion="editar" data-id="${eq.id}">Editar</button>` : ""}
          <button class="eq-btn chico" data-accion="ir" data-vista="etiqueta">QR</button>
        </div>
      </div>
    </header>`;
    }
    const TABS = {
      async accesorios({ eq }) {
        if (!eq.accesorios.length) return `<div class="eq-sub-vacio"><p>Sin accesorios registrados. La lista arma el checklist de salida y regreso.</p>
        ${esRRHH ? '<button class="eq-btn" data-accion="ir" data-vista="accesorios">Agregar accesorios</button>' : ""}</div>`;
        const filas = eq.accesorios.map((a) => `<tr>
        <td>${esc2(a.nombre)}</td><td class="eq-mono eq-centro">${a.cantidad || 1}</td><td class="eq-mono">${esc2(a.serie || "—")}</td>
        <td><select class="eq-estado-acc ${a.estado}" data-accion-cambio="estado-accesorio" data-id="${a.id}">
          ${Object.entries(ESTADOS_ACCESORIO).map(([k, v]) => `<option value="${k}"${k === a.estado ? " selected" : ""}>${v}</option>`).join("")}</select></td></tr>`).join("");
        const malos = eq.accesorios.filter((a) => a.estado !== "bueno").length;
        return `<div class="eq-sub-cab"><span class="eq-tenue">${eq.accesorios.length} accesorios${malos ? ` · <b class="eq-txt-ambar">${malos} por revisar</b>` : ""}</span>
          ${esRRHH ? '<button class="eq-btn chico" data-accion="ir" data-vista="accesorios">Editar lista</button>' : ""}</div>
        <div class="eq-tabla-scroll"><table class="eq-tabla-sub"><thead><tr><th>Accesorio</th><th>Cant.</th><th>N° serie</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table></div>
        <p class="eq-tenue">Lo que no vuelve en el checklist de regreso queda en «Falta».</p>`;
      },
      async certificados({ eq, certs }) {
        const filas = certs.map((c, i) => `<tr>
        <td>${c.archivoId ? `<button class="eq-enlace eq-mono" data-accion="abrir-archivo" data-id="${c.archivoId}" title="Abrir PDF">${esc2(c.codigo)}</button>` : `<span class="eq-mono">${esc2(c.codigo)}</span> <span class="eq-tenue">(sin PDF)</span>`}
          ${i === 0 ? ' <span class="eq-chip verde">Vigente</span>' : ""}</td>
        <td class="eq-mono">${fechaLegible(c.fecha)}</td>
        ${esRRHH ? `<td class="eq-fin">${!c.archivoId ? `<label class="eq-enlace">Adjuntar PDF<input type="file" accept="application/pdf,image/*" hidden data-accion-cambio="pdf-certificado" data-id="${c.id}"></label>` : ""}
          <button class="eq-x" data-accion="papelera-certificado" data-id="${c.id}" title="Enviar a la papelera">✕</button></td>` : ""}
      </tr>`).join("");
        return `<div class="eq-sub-cab"><span class="eq-tenue">Toca el código para abrir el PDF.</span>
          ${esRRHH ? '<button class="eq-btn chico primario" data-accion="ir" data-vista="certificado">+ Agregar certificado</button>' : ""}</div>
        ${certs.length ? `<div class="eq-tabla-scroll"><table class="eq-tabla-sub"><thead><tr><th>Código del certificado</th><th>Fecha mantención</th>${esRRHH ? "<th></th>" : ""}</tr></thead><tbody>${filas}</tbody></table></div>` : `<div class="eq-sub-vacio"><p>Aún no hay certificados${eq.calibracionNoAplica ? " (este equipo no requiere calibración)" : ""}.</p></div>`}`;
      },
      async historial({ est: est2 }) {
        const periodos = periodosDeUso(est2.eventos);
        const total = periodos.reduce((s, p) => s + p.dias, 0);
        const filas = periodos.map((p) => `<tr><td>${esc2(proy(p.proyectoId))}</td><td>${esc2(pers(p.personaId))}</td>
        <td class="eq-mono">${fechaLegible(p.desde)}</td><td class="eq-mono">${p.hasta ? fechaLegible(p.hasta) : "<b>en uso</b>"}</td><td class="eq-mono eq-centro">${p.dias}</td></tr>`).join("");
        return `${periodos.length ? `<div class="eq-sub-cab"><span class="eq-tenue">${periodos.length} salida${periodos.length > 1 ? "s" : ""} · <b>${total} días en terreno</b></span></div>
        <div class="eq-tabla-scroll"><table class="eq-tabla-sub"><thead><tr><th>Proyecto</th><th>Responsable</th><th>Desde</th><th>Hasta</th><th>Días</th></tr></thead><tbody>${filas}</tbody></table></div>` : '<div class="eq-sub-vacio"><p>Este equipo aún no ha salido a terreno.</p></div>'}
        <details class="eq-detalles"><summary>Todos los movimientos (${est2.eventos.length})</summary>
          <ul class="eq-historial">${[...est2.eventos].reverse().map(ctx2.describirEvento).join("")}</ul></details>`;
      },
      async mantencion({ est: est2, eq, mants }) {
        const tarjeta = async (a) => {
          const usos = (await usosConAlerta(a.id, eq.id)).filter((u) => u.tipo !== "alerta");
          return `<div class="eq-alerta${a.estado === "cerrada" ? " cerrada" : ""}">
          <div class="eq-alerta-cab"><span>${fechaLegible(a.fechaReporte)} · ${esc2(pers(a.reportadaPor))}</span><span class="eq-chip ${a.estado === "cerrada" ? "gris" : "rojo"}">${ESTADOS_ALERTA[a.estado]}</span></div>
          <p>${esc2(a.descripcion)}</p>
          ${usos.length ? `<div class="eq-txt-rojo">Usado ${usos.length} ${usos.length === 1 ? "vez" : "veces"} con la alerta abierta</div>` : ""}
          ${esRRHH && PASOS_ALERTA[a.estado].length ? `<div class="eq-acciones">${PASOS_ALERTA[a.estado].map((p) => `<button class="eq-btn chico" data-accion="alerta-paso" data-id="${a.id}" data-estado="${p.estado}">${p.texto}</button>`).join("")}</div>` : ""}
        </div>`;
        };
        const activas = await Promise.all(est2.alertasActivas.map(tarjeta));
        const cerradas = await Promise.all(est2.alertas.filter((a) => !alertaActiva(a)).map(tarjeta));
        const filas = mants.map((m) => `<tr><td class="eq-mono">${fechaLegible(m.fecha)}</td><td>${esc2(m.tipo)}</td><td>${esc2(m.proveedor || "—")}</td>
        <td class="eq-mono">${esc2(m.orden || "—")}</td>${esRRHH ? `<td class="eq-mono">${m.costo ? pesos(m.costo) : "—"}</td>` : ""}<td class="eq-detalle">${esc2(m.descripcion || "")}</td>
        ${esRRHH ? `<td class="eq-fin"><button class="eq-x" data-accion="papelera-mantencion" data-id="${m.id}" title="Enviar a la papelera">✕</button></td>` : ""}</tr>`).join("");
        const costoTotal = mants.reduce((s, m) => s + (m.costo || 0), 0);
        return `${activas.length ? `<h3>Alertas activas</h3>${activas.join("")}` : '<p class="eq-tenue">Sin alertas activas.</p>'}
        <div class="eq-acciones"><button class="eq-btn chico" data-accion="reportar" data-id="${eq.id}">⚠ Reportar anomalía</button></div>
        <div class="eq-sub-cab" style="margin-top:14px"><h3 style="margin:0">Mantenciones${esRRHH && costoTotal ? ` <small class="eq-tenue">· total ${pesos(costoTotal)}</small>` : ""}</h3></div>
        ${mants.length ? `<div class="eq-tabla-scroll"><table class="eq-tabla-sub"><thead><tr><th>Fecha</th><th>Tipo</th><th>Proveedor</th><th>N° orden</th>${esRRHH ? "<th>Costo</th>" : ""}<th>Qué se hizo</th>${esRRHH ? "<th></th>" : ""}</tr></thead><tbody>${filas}</tbody></table></div>` : '<p class="eq-tenue">Sin mantenciones registradas.</p>'}
        ${esRRHH ? `<details class="eq-detalles"><summary>+ Registrar mantención</summary>
          <form class="eq-form eq-mini" data-form="mantencion">
            <div class="eq-fila2"><label class="eq-campo"><span>Fecha</span><input type="date" name="fecha" value="${hoyISO()}" required></label>
            <label class="eq-campo"><span>Tipo</span><select name="tipo">${TIPOS_MANTENCION.map((t) => `<option>${t}</option>`).join("")}</select></label></div>
            <div class="eq-fila2"><label class="eq-campo"><span>Proveedor / servicio técnico</span><input name="proveedor"></label>
            <label class="eq-campo"><span>N° de orden</span><input name="orden"></label></div>
            <label class="eq-campo"><span>Costo ($)</span><input type="number" name="costo" min="0" step="1"></label>
            <label class="eq-campo"><span>Qué se hizo</span><textarea name="descripcion" rows="2"></textarea></label>
            ${est2.alertasActivas.length ? `<label class="eq-campo"><span>Corresponde a la alerta</span><select name="alertaId"><option value="">— ninguna —</option>${est2.alertasActivas.map((a) => `<option value="${a.id}">${esc2(a.descripcion.slice(0, 60))}</option>`).join("")}</select></label>` : ""}
            <div class="eq-acciones"><button class="eq-btn primario" type="submit">Guardar mantención</button></div>
          </form></details>` : ""}
        ${cerradas.length ? `<details class="eq-detalles"><summary>Alertas cerradas (${cerradas.length})</summary>${cerradas.join("")}</details>` : ""}`;
      },
      async notas({ notas }) {
        const yo = personaActiva();
        const item = (n) => `<li class="eq-nota${n.archivada ? " archivada" : ""}"><div>${esc2(n.texto)}</div>
        <div class="eq-nota-pie"><span>${esc2(pers(n.creadoPor))} · ${fechaLegible(n.creadoEn)}</span>
        ${esRRHH || n.creadoPor === yo ? `<button class="eq-enlace" data-accion="archivar-nota" data-id="${n.id}" data-valor="${n.archivada ? "0" : "1"}">${n.archivada ? "Reactivar" : "Archivar"}</button>` : ""}</div></li>`;
        const activas = notas.filter((n) => !n.archivada);
        const archivadas = notas.filter((n) => n.archivada);
        return `<form class="eq-form eq-mini" data-form="nota">
          <label class="eq-campo"><span>Nota para el próximo que lo use</span><textarea name="texto" rows="2" required placeholder="Ej.: la batería 2 dura poco; el tornillo de la base está suelto."></textarea></label>
          <div class="eq-acciones"><button class="eq-btn chico relleno" type="submit">Agregar nota</button></div></form>
        ${activas.length ? `<ul class="eq-notas">${activas.map(item).join("")}</ul>` : '<p class="eq-tenue">Sin notas. Úsalas para detalles que no son una alerta.</p>'}
        ${archivadas.length ? `<details class="eq-detalles"><summary>Archivadas (${archivadas.length})</summary><ul class="eq-notas">${archivadas.map(item).join("")}</ul></details>` : ""}`;
      },
      async documentos({ eq, docsModelo, docsUnidad }) {
        const lista = (docs) => docs.length ? `<ul class="eq-docs">${docs.map((d) => `<li>
          <button class="eq-enlace" data-accion="abrir-archivo" data-id="${d.id}">${esc2(d.nombre)}</button>
          <span class="eq-tenue">${ROLES_DOC[d.rol] || ""} · ${tamanoLegible(d.tamano)}</span>
          ${esRRHH ? `<button class="eq-x" data-accion="papelera-archivo" data-id="${d.id}" title="Enviar a la papelera">✕</button>` : ""}</li>`).join("")}</ul>` : '<p class="eq-tenue">Sin documentos.</p>';
        const subir = (nivel) => esRRHH ? `<form class="eq-form eq-mini fila" data-form="documento" data-nivel="${nivel}">
          <select name="rol">${Object.entries(ROLES_DOC).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
          <label class="eq-archivo">Elegir PDF<input type="file" name="archivo" accept="application/pdf,image/*" required></label>
          <button class="eq-btn chico relleno" type="submit">Subir</button></form>` : "";
        const iguales = (await listarConEstado()).filter((x) => claveModelo(x.equipo) === claveModelo(eq)).length;
        return `<h3>Del modelo ${esc2([eq.marca, eq.modelo].filter(Boolean).join(" "))}${iguales > 1 ? ` <small class="eq-tenue">· compartido por ${iguales} unidades</small>` : ""}</h3>
        ${claveModelo(eq) ? lista(docsModelo) + subir("modelo") : '<p class="eq-tenue">Falta marca o modelo.</p>'}
        <h3 style="margin-top:16px">De esta unidad</h3>
        ${lista(docsUnidad)}${subir("unidad")}`;
      },
      async admin({ est: est2, eq }) {
        const campos = CAMPOS_ADMIN.filter((c) => !c.soloCategoria || c.soloCategoria === eq.categoria).map((c) => {
          var _a;
          return `<label class="eq-campo"><span>${c.etiqueta}</span><input type="${c.tipo || "text"}" name="${c.clave}" value="${esc2((_a = eq.admin[c.clave]) != null ? _a : "")}"${c.tipo === "number" ? ' min="0" step="1"' : ""}></label>`;
        }).join("");
        const extra = Object.entries(eq.columnasExtra || {}).map(([k, v]) => `<div class="eq-spec"><dt>${esc2(k)}</dt><dd>${esc2(v)}</dd></div>`).join("");
        return `<form class="eq-form eq-mini" data-form="admin"><div class="eq-grid-admin">${campos}</div>
          <div class="eq-acciones"><button class="eq-btn chico relleno" type="submit">Guardar datos administrativos</button></div></form>
        <dl class="eq-specs">
          <div class="eq-spec"><dt>Fecha de alta</dt><dd class="eq-mono">${fechaLegible(eq.fechaAlta)}</dd></div>
          <div class="eq-spec"><dt>Origen</dt><dd>${eq.origen === "planilla" ? "Planilla importada" : "Ingreso manual"}</dd></div>
          <div class="eq-spec"><dt>Calibrar cada</dt><dd>${eq.periodoCalibracionMeses || PERIODO_CALIBRACION_MESES} meses</dd></div>
          ${extra}
        </dl>
        ${eq.observaciones ? `<p class="eq-tenue eq-pre">${esc2(eq.observaciones)}</p>` : ""}
        <div class="eq-acciones eq-zona-peligro">
          <button class="eq-btn chico" data-accion="baja" data-id="${eq.id}" data-valor="${eq.deBaja ? "0" : "1"}">${eq.deBaja ? "Reactivar equipo" : "Dar de baja"}</button>
          <button class="eq-btn chico peligro" data-accion="papelera-equipo" data-id="${eq.id}">Enviar a la papelera</button>
        </div>`;
      }
    };
    const VISTAS2 = {
      ficha: vistaFicha,
      async especificaciones() {
        const est2 = await estadoDeEquipo(st.equipoId);
        const eq = est2.equipo;
        const modelo = await obtenerModelo(eq);
        const guardadas = modelo && modelo.specs || {};
        const deducidas = especificacionesDeDescripcion(eq.categoria, eq.descripcion);
        const iguales = (await listarConEstado()).filter((x) => claveModelo(x.equipo) === claveModelo(eq)).length;
        const campos = camposEspecificacion(eq.categoria).map((c) => {
          var _a, _b;
          const v = (_b = (_a = guardadas[c.clave]) != null ? _a : deducidas[c.clave]) != null ? _b : "";
          const control = c.opciones ? `<select name="${c.clave}"><option value=""></option>${c.opciones.map((o) => `<option${o === v ? " selected" : ""}>${o}</option>`).join("")}</select>` : `<input name="${c.clave}" value="${esc2(v)}">`;
          return `<label class="eq-campo"><span>${c.etiqueta}${c.sufijo ? ` (${esc2(c.sufijo)})` : ""}${!guardadas[c.clave] && deducidas[c.clave] ? " · <i>deducido de la descripción</i>" : ""}</span>${control}</label>`;
        }).join("");
        return `<button class="eq-volver" data-accion="ver" data-id="${eq.id}">← ${esc2(est2.nombre)}</button>
        <form class="eq-form" data-form="especificaciones"><fieldset><legend>Especificaciones · ${esc2([eq.marca, eq.modelo].join(" "))}</legend>
          <p class="eq-tenue">Se guardan por modelo: ${iguales > 1 ? `las ${iguales} unidades ${esc2(eq.marca)} ${esc2(eq.modelo)} las comparten.` : "si llega otra unidad igual, las tendrá también."}</p>
          ${campos}
          <label class="eq-campo"><span>Otras especificaciones</span><textarea name="otras" rows="3">${esc2(modelo && modelo.otras || "")}</textarea></label>
        </fieldset><div class="eq-acciones"><button class="eq-btn primario" type="submit">Guardar especificaciones</button></div></form>`;
      },
      async accesorios() {
        const est2 = await estadoDeEquipo(st.equipoId);
        const eq = est2.equipo;
        return `<button class="eq-volver" data-accion="ver" data-id="${eq.id}">← ${esc2(est2.nombre)}</button>
        <form class="eq-form" data-form="accesorios"><fieldset><legend>Accesorios</legend>
          <p class="eq-tenue">Lo que sale en la caja con el equipo. Arma el checklist de salida y regreso.</p>
          <div class="eq-acc-cab"><span>Accesorio</span><span>Cant.</span><span>N° serie</span><span></span></div>
          <div class="eq-acc-filas">${eq.accesorios.map(filaAccesorio).join("")}</div>
          <div class="eq-acciones"><button type="button" class="eq-btn chico" data-accion="acc-agregar">+ Agregar</button>
            <button type="button" class="eq-btn chico" data-accion="acc-sugerir" data-categoria="${esc2(eq.categoria)}">Sugerir según categoría</button></div>
        </fieldset><div class="eq-acciones"><button class="eq-btn primario" type="submit">Guardar accesorios</button></div></form>`;
      },
      async certificado() {
        const est2 = await estadoDeEquipo(st.equipoId);
        const eq = est2.equipo;
        return `<button class="eq-volver" data-accion="ver" data-id="${eq.id}">← ${esc2(est2.nombre)}</button>
        <form class="eq-form" data-form="certificado"><fieldset><legend>Agregar certificado</legend>
          <label class="eq-campo"><span>Código del certificado</span><input name="codigo" required placeholder="Ej.: CC-2025-1143"></label>
          <label class="eq-campo"><span>Fecha de mantención</span><input type="date" name="fecha" value="${hoyISO()}" required></label>
          <label class="eq-campo"><span>Laboratorio / servicio técnico (opcional)</span><input name="laboratorio" value="${esc2(eq.laboratorio || "")}"></label>
          <label class="eq-campo"><span>PDF del certificado</span><input type="file" name="archivo" accept="application/pdf,image/*"></label>
          ${eq.calibracionNoAplica ? "" : '<label class="eq-comp"><input type="checkbox" name="actualizarFecha" checked> Actualizar la FECHA CALIBRACIÓN del equipo</label>'}
        </fieldset><div class="eq-acciones"><button class="eq-btn primario" type="submit">Guardar certificado</button></div></form>`;
      },
      async etiqueta() {
        const est2 = await estadoDeEquipo(st.equipoId);
        const eq = est2.equipo;
        const enlace = ctx2.enlaceEquipo(eq.id);
        const svgQR = await qrSVG(enlace);
        return `<button class="eq-volver" data-accion="ver" data-id="${eq.id}">← ${esc2(est2.nombre)}</button>
        <div class="eq-intro"><h2>Etiqueta QR</h2>
          <p class="eq-tenue">Imprímela y pégala en la caja. Al escanearla con el teléfono se abre esta ficha${/^https?:/.test(enlace) ? "" : ". <b>Para que el QR funcione desde otro teléfono, genera la etiqueta desde la versión publicada en GitHub Pages</b> (abierta desde el PC, el enlace apunta a un archivo local)"}.</p></div>
        <div class="eq-etiqueta" id="eq-etiqueta">
          <div class="eq-etq-qr">${svgQR}</div>
          <div class="eq-etq-txt"><b>${esc2(est2.nombre)}</b><span>N° serie ${esc2(eq.numeroSerie || "—")}</span>${eq.codigoInterno ? `<span>${esc2(eq.codigoInterno)}</span>` : ""}<small>Topoland</small></div>
        </div>
        <div class="eq-acciones bloque"><button class="eq-btn relleno" data-accion="imprimir-etiqueta">Imprimir etiqueta</button></div>`;
      },
      async "cert-proyecto"() {
        const proyectos2 = await listarProyectos({ incluirOficina: false });
        const pid = st.certProyectoId || "";
        let tabla = "";
        if (pid) {
          const eqs = (await listarConEstado()).filter((e) => e.ubicacion.proyectoId === pid && e.ubicacion.lugar === "terreno");
          const filas = await Promise.all(eqs.map(async (e) => {
            const c = (await listarCertificados(e.equipo.id))[0];
            return `<tr><td><button class="eq-enlace" data-accion="ver" data-id="${e.equipo.id}">${esc2(e.nombre)}</button></td><td class="eq-mono">${esc2(e.equipo.numeroSerie)}</td>
            <td>${c ? c.archivoId ? `<button class="eq-enlace eq-mono" data-accion="abrir-archivo" data-id="${c.archivoId}">${esc2(c.codigo)}</button>` : `<span class="eq-mono">${esc2(c.codigo)}</span> <span class="eq-tenue">(sin PDF)</span>` : e.equipo.calibracionNoAplica ? '<span class="eq-tenue">No requiere</span>' : '<span class="eq-txt-rojo">Sin certificado</span>'}</td>
            <td class="eq-mono">${c ? fechaLegible(c.fecha) : "—"}</td></tr>`;
          }));
          tabla = eqs.length ? `<div class="eq-tabla-scroll"><table class="eq-tabla-sub"><thead><tr><th>Equipo</th><th>N° serie</th><th>Código del certificado</th><th>Fecha mantención</th></tr></thead><tbody>${filas.join("")}</tbody></table></div>
          <p class="eq-tenue">Toca cada código para abrir su PDF.</p>` : '<p class="eq-tenue">No hay equipos asignados hoy a este proyecto.</p>';
        }
        return `<button class="eq-volver" data-accion="ir" data-vista="${esRRHH ? "admin" : "lista"}">← Volver</button>
        <div class="eq-intro"><h2>Certificados por proyecto</h2>
          <p class="eq-tenue">Los equipos que están hoy en el proyecto, con su certificado vigente. Para presentar al mandante o a la inspección.</p>
          <label class="eq-campo"><span>Proyecto</span><select data-accion-cambio="cert-proyecto"><option value="">Elige proyecto…</option>
            ${proyectos2.map((p) => `<option value="${p.id}"${p.id === pid ? " selected" : ""}>${esc2(p.nombre)}</option>`).join("")}</select></label></div>
        ${tabla}`;
      }
    };
    function filaAccesorio(a = { id: "", nombre: "", cantidad: 1, serie: "", estado: "bueno" }) {
      return `<div class="eq-acc-fila" data-id="${esc2(a.id)}" data-estado="${esc2(a.estado || "bueno")}">
      <input name="acc-nombre" value="${esc2(a.nombre)}" placeholder="Batería, radio, bastón…">
      <input name="acc-cantidad" type="number" min="1" value="${a.cantidad || 1}">
      <input name="acc-serie" value="${esc2(a.serie || "")}" placeholder="opcional">
      <button type="button" class="eq-x" data-accion="acc-quitar" title="Quitar">✕</button></div>`;
    }
    async function qrSVG(texto3) {
      try {
        if (!globalThis.qrcode) await cargarScript(urlQR);
        const q = globalThis.qrcode(0, "M");
        q.addData(texto3);
        q.make();
        return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      } catch (e) {
        console.warn(e);
        return '<div class="eq-tenue">No se pudo generar el QR (falta vendor/qrcode.js).</div>';
      }
    }
    function imprimirEtiqueta() {
      var _a;
      const html = (_a = document.getElementById("eq-etiqueta")) == null ? void 0 : _a.outerHTML;
      if (!html) return;
      const w = window.open("", "_blank");
      if (!w) {
        avisar2("El navegador bloqueó la ventana de impresión", "error");
        return;
      }
      w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Etiqueta</title><style>
      body{margin:0;padding:10mm;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}
      .eq-etiqueta{display:flex;gap:4mm;align-items:center;width:70mm;padding:3mm;border:0.3mm solid #000;border-radius:2mm}
      .eq-etq-qr svg{width:26mm;height:26mm;display:block}
      .eq-etq-txt{display:flex;flex-direction:column;gap:1mm;font-size:8pt;line-height:1.2}
      .eq-etq-txt b{font-size:9.5pt}.eq-etq-txt small{color:#555;font-size:7pt}
      </style></head><body>${html}<script>window.onload=function(){window.print()}<\/script></body></html>`);
      w.document.close();
    }
    async function clic(accion, el) {
      switch (accion) {
        case "ficha-tab":
          st.fichaTab = el.dataset.tab;
          await render();
          return true;
        case "ver-foto":
          st.verPlaca = el.dataset.cual === "placa";
          await render();
          return true;
        case "abrir-archivo":
          await abrirArchivo(el.dataset.id);
          return true;
        case "papelera-archivo":
          if (!confirm("¿Enviar este documento a la papelera?")) return true;
          await archivoAPapelera(el.dataset.id, { personaId: personaActiva() });
          avisar2("Documento enviado a la papelera");
          await render();
          return true;
        case "papelera-certificado":
          if (!confirm("¿Enviar este certificado a la papelera?")) return true;
          await papeleraCertificado(el.dataset.id);
          avisar2("Certificado enviado a la papelera");
          await render();
          return true;
        case "papelera-mantencion":
          if (!confirm("¿Enviar esta mantención a la papelera?")) return true;
          await papeleraMantencion(el.dataset.id);
          await render();
          return true;
        case "archivar-nota":
          await archivarNota(el.dataset.id, el.dataset.valor === "1");
          await render();
          return true;
        case "acc-agregar": {
          const cont = el.closest("form").querySelector(".eq-acc-filas");
          cont.insertAdjacentHTML("beforeend", filaAccesorio());
          cont.lastElementChild.querySelector("input").focus();
          return true;
        }
        case "acc-quitar":
          el.closest(".eq-acc-fila").remove();
          return true;
        case "acc-sugerir": {
          const cont = el.closest("form").querySelector(".eq-acc-filas");
          const actuales = [...cont.querySelectorAll('input[name="acc-nombre"]')].map((i) => i.value.trim().toLowerCase());
          for (const n of COMPONENTES_SUGERIDOS[el.dataset.categoria] || []) {
            if (!actuales.includes(n.toLowerCase())) cont.insertAdjacentHTML("beforeend", filaAccesorio({ id: "", nombre: n, cantidad: 1, serie: "", estado: "bueno" }));
          }
          return true;
        }
        case "imprimir-etiqueta":
          imprimirEtiqueta();
          return true;
      }
      return false;
    }
    async function cambio(el) {
      switch (el.dataset.accionCambio) {
        case "subir-foto":
          if (!el.files[0]) return true;
          avisar2("Guardando foto…");
          await fijarFoto(st.equipoId, el.dataset.rol, el.files[0]);
          st.verPlaca = el.dataset.rol === "placa";
          avisar2(el.dataset.rol === "placa" ? "Foto de la placa guardada" : "Foto guardada");
          await render();
          return true;
        case "estado-accesorio":
          await cambiarEstadoAccesorio(st.equipoId, el.dataset.id, el.value);
          el.className = `eq-estado-acc ${el.value}`;
          avisar2("Estado del accesorio actualizado");
          return true;
        case "pdf-certificado":
          if (!el.files[0]) return true;
          await adjuntarPdfCertificado(el.dataset.id, el.files[0]);
          avisar2("PDF adjuntado");
          await render();
          return true;
        case "cert-proyecto":
          st.certProyectoId = el.value;
          await render();
          return true;
      }
      return false;
    }
    async function enviar(form, fd) {
      const eqId = st.equipoId;
      switch (form.dataset.form) {
        case "especificaciones": {
          const est2 = await estadoDeEquipo(eqId);
          const specs = {};
          for (const c of camposEspecificacion(est2.equipo.categoria)) if (fd[c.clave]) specs[c.clave] = String(fd[c.clave]).trim();
          await guardarEspecificaciones(est2.equipo, specs, (fd.otras || "").trim());
          avisar2("Especificaciones guardadas");
          await ir("ficha");
          return true;
        }
        case "accesorios": {
          const lista = [...form.querySelectorAll(".eq-acc-fila")].map((f) => ({
            id: f.dataset.id,
            estado: f.dataset.estado,
            nombre: f.querySelector('[name="acc-nombre"]').value,
            cantidad: f.querySelector('[name="acc-cantidad"]').value,
            serie: f.querySelector('[name="acc-serie"]').value
          }));
          await guardarAccesorios(eqId, lista);
          avisar2("Accesorios guardados");
          await ir("ficha", { fichaTab: "accesorios" });
          return true;
        }
        case "certificado": {
          const archivo = fd.archivo && fd.archivo.size ? fd.archivo : null;
          await agregarCertificado(eqId, { codigo: fd.codigo, fecha: fd.fecha, laboratorio: fd.laboratorio || "", archivo, actualizarFecha: fd.actualizarFecha === "on" });
          avisar2("Certificado guardado");
          await ir("ficha", { fichaTab: "certificados" });
          return true;
        }
        case "mantencion":
          await agregarMantencion(eqId, fd);
          avisar2("Mantención registrada");
          await render();
          return true;
        case "nota":
          await agregarNota(eqId, fd.texto);
          avisar2("Nota agregada");
          await render();
          return true;
        case "documento": {
          if (!fd.archivo || !fd.archivo.size) {
            avisar2("Elige un archivo", "error");
            return true;
          }
          const est2 = await estadoDeEquipo(eqId);
          avisar2("Subiendo…");
          await subirDocumento(est2.equipo, { nivel: form.dataset.nivel, rol: fd.rol, archivo: fd.archivo });
          avisar2("Documento guardado");
          await render();
          return true;
        }
        case "admin": {
          const admin = {};
          for (const c of CAMPOS_ADMIN) if (c.clave in fd) admin[c.clave] = c.tipo === "number" ? fd[c.clave] === "" ? "" : Number(fd[c.clave]) : String(fd[c.clave]).trim();
          await guardarAdmin(eqId, admin);
          avisar2("Datos administrativos guardados");
          await render();
          return true;
        }
      }
      return false;
    }
    return { VISTAS: VISTAS2, clic, cambio, enviar };
  }

  // modulos/equipos/exportar.js
  var urlSheetJS2 = "vendor/xlsx.full.min.js";
  var fecha = (iso) => {
    if (!iso) return "";
    const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return a && m && d ? Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5) : "";
  };
  var ESTADO_CAL = { ok: "Al día", por_vencer: "Por vencer", vencida: "Vencida", sin_dato: "Falta fecha", no_aplica: "No requiere" };
  function hoja(XLSX2, filas, anchos, colsFecha = []) {
    const ws = XLSX2.utils.aoa_to_sheet(filas);
    ws["!cols"] = anchos.map((w) => ({ wch: w }));
    if (filas.length > 1) ws["!autofilter"] = { ref: XLSX2.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length - 1, c: filas[0].length - 1 } }) };
    for (const c of colsFecha) {
      for (let r = 1; r < filas.length; r++) {
        const cel = ws[XLSX2.utils.encode_cell({ r, c })];
        if (cel && cel.t === "n") cel.z = "dd-mm-yyyy";
      }
    }
    return ws;
  }
  async function descargarPlanilla() {
    if (!globalThis.XLSX) await cargarScript(urlSheetJS2);
    const XLSX2 = globalThis.XLSX;
    const [lista, certs, nombres] = await Promise.all([listarConEstado(), todosLosCertificados(), mapaNombres()]);
    const proy = (id) => id === OFICINA_ID ? "Oficina" : nombres.proyecto[id] || "";
    const pers = (id) => nombres.persona[id] || "";
    const vigente = {};
    for (const c of certs) if (!vigente[c.equipoId]) vigente[c.equipoId] = c;
    const orden = (a, b) => (a.equipo.equipo || "").localeCompare(b.equipo.equipo || "", "es") || a.nombre.localeCompare(b.nombre, "es");
    const activos = lista.filter((e) => e.ubicacion.lugar !== "baja").sort(orden);
    const deBaja = lista.filter((e) => e.ubicacion.lugar === "baja").sort(orden);
    const enc = [...COLUMNAS_PLANILLA.map((c) => c.etiqueta), ...COLUMNAS_INFORMATIVAS];
    const filasEq = [enc];
    for (const e of [...activos, ...deBaja]) {
      const eq = e.equipo;
      const c = vigente[eq.id];
      const planilla = COLUMNAS_PLANILLA.map((col) => {
        var _a;
        if (col.campo === "fechaUltimaCalibracion") return eq.calibracionNoAplica ? "-" : fecha(eq.fechaUltimaCalibracion);
        return (_a = eq[col.campo]) != null ? _a : "";
      });
      const u = e.ubicacion;
      filasEq.push([
        ...planilla,
        eq.categoria || "",
        LUGARES[u.lugar] || u.lugar,
        u.lugar === "terreno" ? proy(u.proyectoId) : "",
        u.lugar === "terreno" ? pers(u.personaId) : "",
        fecha(e.calibracion.proxima),
        ESTADO_CAL[e.calibracion.nivel] || "",
        c ? c.codigo : "",
        c ? fecha(c.fecha) : "",
        e.alertasActivas.map((a) => a.descripcion).join(" | "),
        eq.accesorios.filter((a) => a.estado !== "bueno").map((a) => `${a.nombre} (${ESTADOS_ACCESORIO[a.estado].toLowerCase()})`).join(", "),
        eq.codigoInterno || "",
        eq.observaciones || ""
      ]);
    }
    const iFecha = COLUMNAS_PLANILLA.findIndex((c) => c.campo === "fechaUltimaCalibracion");
    const nP = COLUMNAS_PLANILLA.length;
    const wsEq = hoja(
      XLSX2,
      filasEq,
      [18, 13, 14, 20, 20, 13, 15, 14, 24, 18, 13, 13, 16, 13, 40, 30, 12, 30],
      [iFecha, nP + 4, nP + 7]
    );
    const filasAcc = [["EQUIPO", "N° SERIE EQUIPO", "ACCESORIO", "CANTIDAD", "N° SERIE ACCESORIO", "ESTADO"]];
    for (const e of activos) for (const a of e.equipo.accesorios) {
      filasAcc.push([nombreCorto(e.equipo), e.equipo.numeroSerie || "", a.nombre, a.cantidad || 1, a.serie || "", ESTADOS_ACCESORIO[a.estado] || a.estado]);
    }
    const wsAcc = hoja(XLSX2, filasAcc, [30, 20, 26, 10, 20, 10]);
    const porId = Object.fromEntries(lista.map((e) => [e.equipo.id, e]));
    const filasCert = [["EQUIPO", "N° SERIE", "CÓDIGO DEL CERTIFICADO", "FECHA MANTENCIÓN", "LABORATORIO", "PDF EN LA APP"]];
    for (const c of certs) {
      const e = porId[c.equipoId];
      if (!e) continue;
      filasCert.push([e.nombre, e.equipo.numeroSerie || "", c.codigo, fecha(c.fecha), c.laboratorio || "", c.archivoId ? "Sí" : "No"]);
    }
    const wsCert = hoja(XLSX2, filasCert, [30, 20, 24, 16, 26, 12], [3]);
    const libro = XLSX2.utils.book_new();
    XLSX2.utils.book_append_sheet(libro, wsEq, "Equipos");
    XLSX2.utils.book_append_sheet(libro, wsAcc, "Accesorios");
    XLSX2.utils.book_append_sheet(libro, wsCert, "Certificados");
    const archivo = `Equipos_Topoland_${hoyISO()}.xlsx`;
    XLSX2.writeFile(libro, archivo, { compression: true });
    return { archivo, equipos: activos.length + deBaja.length };
  }

  // modulos/equipos/pantallas.js
  var svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  var ICONOS = {
    lista: svg('<path d="M12 3l3 5H9l3-5z"/><path d="M12 8v5M12 13l-6 8M12 13l6 8M12 13v8"/>'),
    salida: svg('<path d="M14 4h5a1 1 0 011 1v14a1 1 0 01-1 1h-5"/><path d="M10 12h10M16 8l4 4-4 4"/><path d="M4 12h2"/>'),
    regreso: svg('<path d="M10 4H5a1 1 0 00-1 1v14a1 1 0 001 1h5"/><path d="M20 12H8M12 8l-4 4 4 4"/>'),
    alertas: svg('<path d="M12 3l9.5 17h-19L12 3z"/><path d="M12 10v4M12 17.5v.5"/>'),
    admin: svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
    vacio: svg('<path d="M12 3l3 5H9l3-5z"/><path d="M12 8v5M12 13l-6 8M12 13l6 8M12 13v8"/>')
  };
  var PESTANAS = [
    { id: "lista", texto: "Equipos", vistas: ["lista", "ficha", "editar", "especificaciones", "accesorios", "certificado", "etiqueta"] },
    { id: "salida", texto: "Salida", vistas: ["salida", "resultado"] },
    { id: "regreso", texto: "Regreso", vistas: ["regreso"] },
    { id: "alertas", texto: "Alertas", vistas: ["alertas", "reportar"] },
    { id: "admin", texto: "Administrar", vistas: ["admin", "importar", "catalogos", "respaldo", "papelera", "cert-proyecto"], soloRRHH: true }
  ];
  function montarPantallas(contenedor2, contexto) {
    const esRRHH = contexto.rol === "rrhh";
    const persona2 = contexto.personaId || null;
    fijarPersona(persona2);
    const raiz = document.createElement("div");
    raiz.className = "mod-equipos";
    raiz.innerHTML = '<div class="eq-zona"></div><div class="eq-aviso" role="status" hidden></div>';
    contenedor2.appendChild(raiz);
    const zona = raiz.querySelector(".eq-zona");
    const avisoEl = raiz.querySelector(".eq-aviso");
    const st = {
      vista: contexto.equipoInicial ? "ficha" : "lista",
      equipoId: contexto.equipoInicial || null,
      filtro: "todos",
      busqueda: "",
      verCerradas: false,
      importacion: null,
      resultado: null,
      alertaEquipoId: null,
      fichaTab: "accesorios",
      verPlaca: false,
      certProyectoId: null,
      reporteDesdeFicha: false
    };
    let nombres = { proyecto: {}, persona: {} };
    let cacheLista = [];
    let activo2 = true;
    let timerAviso2 = null;
    const proy = (id) => id === OFICINA_ID ? "Oficina" : nombres.proyecto[id] || (id ? "Proyecto desconocido" : "—");
    const pers = (id) => nombres.persona[id] || (id ? "Persona desconocida" : "sin responsable");
    function avisar2(texto3, tipo = "ok") {
      avisoEl.textContent = texto3;
      avisoEl.dataset.tipo = tipo;
      avisoEl.hidden = false;
      clearTimeout(timerAviso2);
      timerAviso2 = setTimeout(() => {
        avisoEl.hidden = true;
      }, 4e3);
    }
    async function ir(vista, extra = {}) {
      Object.assign(st, { vista }, extra);
      await render();
      window.scrollTo(0, 0);
      for (let p = raiz.parentElement; p; p = p.parentElement) if (p.scrollTop) p.scrollTop = 0;
    }
    async function render() {
      try {
        nombres = await mapaNombres();
        const alertasAbiertas = (await todasLasAlertas()).filter(alertaActiva).length;
        const cuerpo = await VISTAS2[st.vista]();
        if (!activo2) return;
        zona.innerHTML = navegacion(alertasAbiertas) + `<main class="eq-cuerpo">${cuerpo}</main>`;
        if (st.vista === "lista") pintarResultados();
      } catch (err) {
        console.error(err);
        zona.innerHTML = `<div class="eq-error"><b>Algo falló al cargar.</b><br>${escapar(err.message)}</div>`;
      }
    }
    function navegacion(nAlertas) {
      const botones = PESTANAS.filter((p) => !p.soloRRHH || esRRHH).map((p) => {
        const actual = p.vistas.includes(st.vista);
        const badge = p.id === "alertas" && nAlertas ? `<span class="eq-badge">${nAlertas}</span>` : "";
        return `<button class="eq-pestana${actual ? " activa" : ""}" data-accion="ir" data-vista="${p.id}">${ICONOS[p.id]}${p.texto}${badge}</button>`;
      }).join("");
      return `<nav class="eq-nav">${botones}</nav>`;
    }
    function chipUbicacion(u) {
      if (u.lugar === "terreno") return `<span class="eq-chip terreno">${escapar(proy(u.proyectoId))} · ${escapar(pers(u.personaId))}</span>`;
      return `<span class="eq-chip ${u.lugar}">${LUGARES[u.lugar]}</span>`;
    }
    function chipCalibracion(c) {
      if (c.nivel === "no_aplica") return '<span class="eq-chip gris">No requiere calibración</span>';
      if (c.nivel === "sin_dato") return '<span class="eq-chip ambar">Falta fecha de calibración</span>';
      if (c.nivel === "vencida") return `<span class="eq-chip rojo">Calibración vencida hace ${-c.dias} d</span>`;
      if (c.nivel === "por_vencer") return `<span class="eq-chip ambar">Calibración vence en ${c.dias} d</span>`;
      return `<span class="eq-chip verde">Calibración al día · ${fechaLegible(c.proxima)}</span>`;
    }
    const chipAlertas2 = (n) => n ? `<span class="eq-chip rojo">⚠ ${n} alerta${n > 1 ? "s" : ""}</span>` : "";
    function opcionesProyectos(lista, seleccionado, { vacio: vacio2 = "Elige proyecto…" } = {}) {
      return `<option value="">${vacio2}</option>` + lista.map((p) => `<option value="${escapar(p.id)}"${p.id === seleccionado ? " selected" : ""}>${escapar(p.nombre)}${p.mandante && p.id !== OFICINA_ID ? " — " + escapar(p.mandante) : ""}</option>`).join("");
    }
    function opcionesPersonas(lista, seleccionado) {
      return '<option value="">Elige persona…</option>' + lista.map((p) => `<option value="${escapar(p.id)}"${p.id === seleccionado ? " selected" : ""}>${escapar(p.nombre)}${p.cargo ? " — " + escapar(p.cargo) : ""}</option>`).join("");
    }
    function describirEvento(e) {
      let t;
      switch (e.tipo) {
        case "salida":
          t = `Salida a <b>${escapar(proy(e.proyectoId))}</b> · responsable ${escapar(pers(e.personaId))}`;
          break;
        case "traspaso":
          t = `Traspaso de ${escapar(proy(e.desdeProyectoId))} a <b>${escapar(proy(e.proyectoId))}</b> · responsable ${escapar(pers(e.personaId))}`;
          break;
        case "regreso":
          t = `Regreso a oficina desde ${escapar(proy(e.desdeProyectoId))}`;
          break;
        case "uso":
          t = `Uso en ${escapar(proy(e.proyectoId))} por ${escapar(pers(e.personaId))}`;
          break;
        case "alerta":
          t = `Alerta: <b>${ESTADOS_ALERTA[e.estadoAlerta] || e.estadoAlerta}</b>`;
          break;
        default:
          t = TIPOS_EVENTO[e.tipo] || e.tipo;
      }
      const extras = [];
      if (e.nota) extras.push(escapar(e.nota));
      if ((e.faltantes || []).length) extras.push(`<span class="eq-txt-ambar">Faltó: ${escapar(e.faltantes.join(", "))}</span>`);
      if ((e.alertasAbiertas || []).length && e.tipo !== "alerta") extras.push('<span class="eq-txt-rojo">Con alerta activa al momento</span>');
      const quien = e.creadoPor ? ` · registró ${escapar(pers(e.creadoPor))}` : "";
      return `<li><div class="eq-ev-fecha">${fechaHoraLegible(e.fecha)}${quien}</div><div>${t}</div>${extras.map((x) => `<div class="eq-ev-extra">${x}</div>`).join("")}</li>`;
    }
    function checkAccesorio(equipoId, a) {
      const extra = [a.cantidad > 1 ? `×${a.cantidad}` : "", a.estado !== "bueno" ? `<span class="eq-txt-ambar">(${ESTADOS_ACCESORIO[a.estado].toLowerCase()})</span>` : ""].filter(Boolean).join(" ");
      return `<label class="eq-comp"><input type="checkbox" data-comp="${equipoId}" value="${escapar(a.nombre)}"> ${escapar(a.nombre)} ${extra}</label>`;
    }
    const FILTROS = [
      ["todos", "Todos", (e) => e.ubicacion.lugar !== "baja"],
      ["oficina", "En oficina", (e) => e.ubicacion.lugar === "oficina"],
      ["terreno", "En terreno", (e) => e.ubicacion.lugar === "terreno"],
      ["mantencion", "En mantención", (e) => e.ubicacion.lugar === "mantencion"],
      ["alertas", "Con alerta", (e) => e.alertasActivas.length > 0],
      ["calibracion", "Calibración por revisar", (e) => ["vencida", "por_vencer", "sin_dato"].includes(e.calibracion.nivel) && e.ubicacion.lugar !== "baja"],
      ["baja", "De baja", (e) => e.ubicacion.lugar === "baja"]
    ];
    const VISTAS2 = {
      async lista() {
        cacheLista = (await listarConEstado()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        if (!cacheLista.length) {
          return `<section class="eq-vacio">
          ${ICONOS.vacio}
          <b>Aún no hay equipos</b>
          ${esRRHH ? `<p>Carga la planilla que ya usas (EQUIPO, MARCA, MODELO, DESCRIPCIÓN, N° SERIE, FECHA CALIBRACIÓN) o crea los equipos uno por uno.</p>
               <div class="eq-acciones"><button class="eq-btn primario" data-accion="ir" data-vista="importar">Importar planilla</button>
               <button class="eq-btn" data-accion="nuevo-equipo">Nuevo equipo</button></div>` : "<p>RRHH todavía no carga los equipos de la empresa.</p>"}
        </section>`;
        }
        const chips = FILTROS.map(([id, texto3, fn]) => {
          const n = cacheLista.filter(fn).length;
          if (!n && id !== "todos" && id !== st.filtro) return "";
          return `<button class="eq-filtro${st.filtro === id ? " activo" : ""}" data-accion="filtro" data-filtro="${id}">${texto3} <span>${n}</span></button>`;
        }).join("");
        return `
        <div class="eq-barra">
          <input type="search" class="eq-buscar" placeholder="Buscar por equipo, modelo, N° serie…" value="${escapar(st.busqueda)}" data-campo="busqueda">
          ${esRRHH ? '<button class="eq-btn primario" data-accion="nuevo-equipo">+ Equipo</button>' : ""}
        </div>
        <div class="eq-filtros">${chips}</div>
        <div id="eq-resultados"></div>`;
      },
      async editar() {
        var _a;
        const eq = st.equipoId ? (_a = await estadoDeEquipo(st.equipoId)) == null ? void 0 : _a.equipo : nuevoEquipo();
        if (!eq) return "<p>El equipo no existe.</p>";
        const campo = (nombre, etiqueta, tipo = "text", extra = "") => {
          var _a2;
          return `<label class="eq-campo"><span>${etiqueta}</span><input type="${tipo}" name="${nombre}" value="${escapar((_a2 = eq[nombre]) != null ? _a2 : "")}" ${extra}></label>`;
        };
        return `
        <button class="eq-volver" data-accion="${st.equipoId ? "ver" : "ir"}" data-vista="lista" data-id="${st.equipoId || ""}">← Volver</button>
        <h2>${st.equipoId ? "Editar equipo" : "Nuevo equipo"}</h2>
        <form class="eq-form" data-form="equipo">
          <fieldset><legend>Columnas de la planilla</legend>
            ${campo("equipo", "EQUIPO", "text", 'required list="eq-tipos" placeholder="Estacion Total, GNSS, Nivel Topografico…"')}
            <datalist id="eq-tipos">${[...new Set(cacheLista.map((x) => x.equipo.equipo).filter(Boolean))].map((v) => `<option value="${escapar(v)}">`).join("")}</datalist>
            ${campo("marca", "MARCA", "text", 'list="eq-marcas"')}
            <datalist id="eq-marcas">${[...new Set(cacheLista.map((x) => x.equipo.marca).filter(Boolean))].map((v) => `<option value="${escapar(v)}">`).join("")}</datalist>
            ${campo("modelo", "MODELO")}
            ${campo("descripcion", "DESCRIPCIÓN", "text", 'placeholder="1&quot; R500 · Aumento 32x · Base · Rover · Control…"')}
            ${campo("numeroSerie", "N° SERIE")}
            ${campo("fechaUltimaCalibracion", "FECHA CALIBRACIÓN", "date")}
            <label class="eq-comp"><input type="checkbox" name="calibracionNoAplica"${eq.calibracionNoAplica ? " checked" : ""}> No requiere calibración (en la planilla: «-»)</label>
          </fieldset>
          <fieldset><legend>Datos del módulo</legend>
            <label class="eq-campo"><span>Categoría</span><select name="categoria">${CATEGORIAS.map((c) => `<option${c === eq.categoria ? " selected" : ""}>${c}</option>`).join("")}</select></label>
            ${campo("codigoInterno", "Código interno (etiqueta)")}
            ${campo("periodoCalibracionMeses", "Calibrar cada (meses)", "number", 'min="1" max="60"')}
            ${campo("fechaAlta", "Fecha de alta", "date")}
            <p class="eq-tenue" style="margin-top:12px">Accesorios, certificados, fotos y especificaciones se editan en la ficha del equipo.</p>
            <label class="eq-campo"><span>Observaciones</span><textarea name="observaciones" rows="2">${escapar(eq.observaciones)}</textarea></label>
          </fieldset>
          <div class="eq-acciones"><button class="eq-btn primario" type="submit">Guardar</button></div>
        </form>`;
      },
      async salida() {
        const [lista, proyectos2, personas2] = await Promise.all([listarConEstado(), listarProyectos({ incluirOficina: false }), listarPersonas()]);
        const disponibles = lista.filter((e) => e.ubicacion.lugar === "oficina").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        const enTerreno = lista.filter((e) => e.ubicacion.lugar === "terreno").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        const fuera = lista.filter((e) => e.ubicacion.lugar === "mantencion");
        const item = (e, traspaso) => {
          const avisos = avisosDe(e);
          const comps = e.equipo.accesorios;
          return `<div class="eq-check-item">
          <label class="eq-check-cab"><input type="checkbox" name="equipo" value="${e.equipo.id}" data-accion-cambio="mostrar-componentes">
            <span><b>${escapar(e.nombre)}</b><small>N° serie <span class="eq-mono">${escapar(e.equipo.numeroSerie || "—")}</span>${traspaso ? ` · hoy en ${escapar(proy(e.ubicacion.proyectoId))}` : ""}</small></span></label>
          ${avisos.length ? `<div class="eq-avisos">${avisos.map((a) => `<div>⚠ ${escapar(a)}</div>`).join("")}<div class="eq-tenue">No bloquea la salida; queda registrado.</div></div>` : ""}
          <div class="eq-componentes" hidden>
            ${comps.length ? `<div class="eq-tenue">Marca lo que va en la caja:</div>${comps.map((a) => checkAccesorio(e.equipo.id, a)).join("")}
              <button type="button" class="eq-btn chico" data-accion="marcar-todo" data-id="${e.equipo.id}">Está todo</button>` : '<div class="eq-tenue">Este equipo no tiene accesorios registrados.</div>'}
          </div>
        </div>`;
        };
        return `
        <div class="eq-intro"><h2>Checklist de salida</h2>
        <p class="eq-tenue">Asigna los equipos a un proyecto y a un responsable antes de salir. Sirve también para revisar que no falte nada.</p></div>
        <form class="eq-form" data-form="salida">
          <fieldset><legend>1. Destino</legend>
            <label class="eq-campo"><span>Proyecto</span><select name="proyectoId" required>${opcionesProyectos(proyectos2, "")}</select></label>
            ${catalogosEditables() ? '<button type="button" class="eq-btn chico" data-accion="nuevo-proyecto">+ Proyecto nuevo</button>' : ""}
            <label class="eq-campo"><span>Responsable (encargado del trabajo)</span><select name="personaId" required>${opcionesPersonas(personas2, persona2)}</select></label>
          </fieldset>
          <fieldset><legend>2. Equipos en oficina (${disponibles.length})</legend>
            ${disponibles.map((e) => item(e, false)).join("") || '<p class="eq-tenue">No hay equipos en oficina.</p>'}
          </fieldset>
          ${enTerreno.length ? `<fieldset><legend>Traspaso desde otro proyecto (${enTerreno.length})</legend>
            <p class="eq-tenue">El equipo pasa directo al nuevo proyecto sin volver a oficina.</p>
            ${enTerreno.map((e) => item(e, true)).join("")}</fieldset>` : ""}
          ${fuera.length ? `<p class="eq-tenue">En mantención (no disponibles): ${fuera.map((e) => escapar(e.nombre)).join(", ")}</p>` : ""}
          <label class="eq-campo"><span>Nota (opcional)</span><input name="nota"></label>
          <div class="eq-acciones"><button class="eq-btn primario" type="submit">Registrar salida</button></div>
        </form>`;
      },
      async resultado() {
        const r = st.resultado || { titulo: "Listo", items: [] };
        return `<div class="eq-intro"><h2>${escapar(r.titulo)}</h2><p class="eq-tenue">Quedó registrado en el historial de cada equipo.</p></div>
        <ul class="eq-resultado">${r.items.map((i) => `<li><b>${escapar(i.nombre)}</b>${i.tipo === "traspaso" ? " (traspaso)" : ""}
          ${(i.faltantes || []).length ? `<div class="eq-txt-ambar">Faltó: ${escapar(i.faltantes.join(", "))}</div>` : '<div class="eq-txt-verde">Completo</div>'}
          ${(i.avisos || []).map((a) => `<div class="eq-txt-rojo">⚠ ${escapar(a)}</div>`).join("")}</li>`).join("")}</ul>
        <div class="eq-acciones bloque"><button class="eq-btn relleno" data-accion="ir" data-vista="lista">Ver equipos</button>
          ${r.proyectoId ? `<button class="eq-btn" data-accion="cert-de-proyecto" data-id="${r.proyectoId}">Certificados de este proyecto</button>` : ""}</div>`;
      },
      async regreso() {
        var _a;
        const lista = (await listarConEstado()).filter((e) => e.ubicacion.lugar === "terreno");
        if (!lista.length) return `<div class="eq-vacio">${ICONOS.vacio}<b>No hay equipos en terreno</b><p>Cuando salgan con el checklist, aparecerán aquí para registrar su regreso.</p></div>`;
        const grupos = {};
        for (const e of lista) (grupos[_a = e.ubicacion.proyectoId] || (grupos[_a] = [])).push(e);
        const bloques = Object.entries(grupos).map(([pid, eqs]) => `
        <fieldset><legend>${escapar(proy(pid))}</legend>
          ${eqs.map((e) => `<div class="eq-check-item">
            <label class="eq-check-cab"><input type="checkbox" name="equipo" value="${e.equipo.id}" data-accion-cambio="mostrar-componentes">
              <span><b>${escapar(e.nombre)}</b><small>N° serie <span class="eq-mono">${escapar(e.equipo.numeroSerie || "—")}</span> · ${escapar(pers(e.ubicacion.personaId))} · desde ${fechaLegible(e.ubicacion.desde)}</small></span></label>
            <div class="eq-componentes" hidden>
              ${e.equipo.accesorios.map((a) => checkAccesorio(e.equipo.id, a)).join("")}
              ${e.equipo.accesorios.length ? `<button type="button" class="eq-btn chico" data-accion="marcar-todo" data-id="${e.equipo.id}">Volvió todo</button>` : ""}
            </div></div>`).join("")}
        </fieldset>`).join("");
        return `<div class="eq-intro"><h2>Regreso a oficina</h2>
        <p class="eq-tenue">Marca los equipos que vuelven y revisa que vuelva todo lo que salió.</p></div>
        <form class="eq-form" data-form="regreso">${bloques}
          <label class="eq-campo"><span>Nota (opcional)</span><input name="nota"></label>
          <div class="eq-acciones"><button class="eq-btn primario" type="submit">Registrar regreso</button></div></form>`;
      },
      async alertas() {
        const [alertas, lista] = await Promise.all([todasLasAlertas(), listarConEstado()]);
        const porId = Object.fromEntries(lista.map((e) => [e.equipo.id, e]));
        const visibles = alertas.filter((a) => st.verCerradas || alertaActiva(a));
        const tarjetas = [];
        for (const a of visibles) {
          const e = porId[a.equipoId];
          const usos = (await usosConAlerta(a.id, a.equipoId)).filter((u) => u.tipo !== "alerta");
          tarjetas.push(`<div class="eq-alerta${a.estado === "cerrada" ? " cerrada" : ""}">
          <div class="eq-alerta-cab"><b>${escapar(e ? e.nombre : "Equipo eliminado")}</b> <span class="eq-chip ${a.estado === "cerrada" ? "gris" : "rojo"}">${ESTADOS_ALERTA[a.estado]}</span></div>
          <p>${escapar(a.descripcion)}</p>
          <div class="eq-tenue">Reportó ${escapar(pers(a.reportadaPor))} el ${fechaHoraLegible(a.fechaReporte)} en ${escapar(proy(a.proyectoId))}</div>
          ${usos.length ? `<div class="eq-txt-rojo">Usado ${usos.length} ${usos.length === 1 ? "vez" : "veces"} con la alerta abierta (${[...new Set(usos.map((u) => pers(u.personaId)))].map(escapar).join(", ")})</div>` : ""}
          <details><summary>Seguimiento</summary><ul class="eq-historial">${a.historial.map((h) => `<li><div class="eq-ev-fecha">${fechaHoraLegible(h.fecha)} · ${escapar(pers(h.personaId))}</div><div>${ESTADOS_ALERTA[h.estado]}${h.nota ? " — " + escapar(h.nota) : ""}</div></li>`).join("")}</ul></details>
          <div class="eq-acciones">
            ${e ? `<button class="eq-btn chico" data-accion="ver" data-id="${a.equipoId}">Ver equipo</button>` : ""}
            ${esRRHH ? PASOS_ALERTA[a.estado].map((p) => `<button class="eq-btn chico" data-accion="alerta-paso" data-id="${a.id}" data-estado="${p.estado}">${p.texto}</button>`).join("") : ""}
          </div></div>`);
        }
        return `<div class="eq-intro"><h2>Alertas</h2>
        <p class="eq-tenue">Terreno abre la alerta; ${esRRHH ? "tú" : "RRHH"} la envía a mantención, la recibe y la cierra. Una alerta no impide usar el equipo, pero cada uso queda anotado.</p>
        <div class="eq-acciones bloque"><button class="eq-btn primario" data-accion="reportar">Reportar anomalía</button></div>
        <label class="eq-comp"><input type="checkbox" data-accion-cambio="ver-cerradas"${st.verCerradas ? " checked" : ""}> Mostrar cerradas</label></div>
        ${tarjetas.join("") || `<div class="eq-vacio">${ICONOS.alertas}<b>Sin alertas activas</b><p>Los equipos no tienen anomalías reportadas.</p></div>`}`;
      },
      async reportar() {
        const lista = (await listarConEstado()).filter((e) => e.ubicacion.lugar !== "baja").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        return `${st.reporteDesdeFicha ? `<button class="eq-volver" data-accion="ver" data-id="${st.equipoId}">← Ficha del equipo</button>` : '<button class="eq-volver" data-accion="ir" data-vista="alertas">← Alertas</button>'}
        <form class="eq-form" data-form="reportar"><fieldset><legend>Reportar anomalía</legend>
          <label class="eq-campo"><span>Equipo</span><select name="equipoId" required><option value="">Elige equipo…</option>
            ${lista.map((e) => `<option value="${e.equipo.id}"${e.equipo.id === st.alertaEquipoId ? " selected" : ""}>${escapar(e.nombre)} — N° ${escapar(e.equipo.numeroSerie || "—")}</option>`).join("")}</select></label>
          <label class="eq-campo"><span>¿Qué pasa?</span><textarea name="descripcion" rows="4" required placeholder="Ej.: el compensador marca error al nivelar; la batería 2 no carga."></textarea></label>
          <p class="eq-tenue" style="margin-top:12px">RRHH queda informado. Puedes seguir usando el equipo si es seguro; cada uso queda registrado con la alerta.</p></fieldset>
          <div class="eq-acciones"><button class="eq-btn primario" type="submit">Enviar alerta</button></div>
        </form>`;
      },
      async admin() {
        const item = (accion, vista, ico, titulo, texto3) => `<button class="eq-menu-item" data-accion="${accion}"${vista ? ` data-vista="${vista}"` : ""}>
          <span class="eq-menu-ico">${ico}</span><span class="eq-menu-txt"><b>${titulo}</b><span>${texto3}</span></span><span class="eq-menu-flecha">›</span></button>`;
        return `<div class="eq-intro"><h2>Administrar</h2><p class="eq-tenue">Altas, carga de la planilla y mantención de los datos del módulo.</p></div>
        <div class="eq-menu">
          ${item("ir", "importar", "📊", "Importar planilla", "Excel o CSV con las columnas que ya usa RRHH")}
          ${item("descargar-planilla", "", "⬇️", "Descargar planilla", "Excel con tus columnas + ubicación, calibración y certificados")}
          ${item("nuevo-equipo", "", "➕", "Nuevo equipo", "Alta manual de un equipo")}
          ${item("ir", "cert-proyecto", "📄", "Certificados por proyecto", "Certificados vigentes de los equipos de un proyecto")}
          ${item("ir", "catalogos", "👥", "Proyectos y personas", "Catálogos temporales para probar")}
          ${item("ir", "respaldo", "💾", "Respaldo", "Descargar o cargar un .json")}
          ${item("ir", "papelera", "🗑️", "Papelera", "Equipos eliminados")}
        </div>
        <p class="eq-tenue" style="text-align:center;margin-top:14px">Módulo Equipos v${VERSION_MODULO}</p>`;
      },
      async importar() {
        const imp = st.importacion;
        const intro = `<button class="eq-volver" data-accion="ir" data-vista="admin">← Administrar</button>
        <div class="eq-intro"><h2>Importar planilla de equipos</h2>
        <p class="eq-tenue">Lee la primera hoja de un .xlsx o un .csv con las columnas EQUIPO · MARCA · MODELO · DESCRIPCIÓN · N° SERIE · FECHA CALIBRACIÓN (el orden no importa).
        Un «-» en la fecha se lee como «no requiere calibración». Antes de guardar verás cada fila. Los equipos que ya existen se reconocen por N° de serie.</p>
        <label class="eq-archivo" style="width:100%">📄 Elegir archivo (.xlsx o .csv)<input type="file" accept=".xlsx,.xls,.csv" data-accion-cambio="leer-planilla"></label></div>`;
        if (!imp) return intro;
        const cols = imp.columnas.filter((c) => c.encabezado).map((c) => {
          const col = COLUMNAS_PLANILLA.find((x) => x.campo === c.campo);
          return `<li>${escapar(c.encabezado)} → ${col ? `<b>${col.etiqueta}</b>` : c.ignorar ? '<span class="eq-tenue">informativa (la calcula la app), no se importa</span>' : '<span class="eq-tenue">se guarda como dato extra</span>'}</li>`;
        }).join("");
        const filas = imp.registros.map((r, i) => `<tr class="${r.accion === "omitir" ? "omitida" : ""}">
        <td>${r.filaExcel}</td>
        <td><select data-imp="accion" data-i="${i}">
          <option value="nuevo"${r.accion === "nuevo" ? " selected" : ""}${r.existente ? " disabled" : ""}>Nuevo</option>
          ${r.existente ? `<option value="actualizar"${r.accion === "actualizar" ? " selected" : ""}>Actualizar</option>` : ""}
          <option value="omitir"${r.accion === "omitir" ? " selected" : ""}>Omitir</option></select></td>
        ${celdasPlanilla(r.datos)}
        <td><select data-imp="categoria" data-i="${i}"${r.existente ? " disabled" : ""}>${CATEGORIAS.map((c) => `<option${c === r.categoria ? " selected" : ""}>${c}</option>`).join("")}</select></td>
        <td>${r.problemas.map((p) => `<div class="eq-txt-ambar">${escapar(p)}</div>`).join("")}${r.existente ? '<div class="eq-tenue">Ya existe: se actualizan solo las columnas de la planilla</div>' : ""}</td>
      </tr>`).join("");
        const n = (k) => imp.registros.filter((r) => r.accion === k).length;
        return `${intro}
        <section class="eq-seccion"><h3>${escapar(imp.archivo)} · hoja «${escapar(imp.hoja)}» · encabezados en la fila ${imp.filaEncabezados}</h3>
          <ul class="eq-lista-simple">${cols}</ul>
          ${imp.faltan.length ? `<div class="eq-avisos">No encontré: ${imp.faltan.join(", ")}. Esos campos quedarán vacíos.</div>` : ""}
        </section>
        <div class="eq-tabla-scroll"><table class="eq-tabla-imp">
          <thead><tr><th>Fila</th><th>Acción</th>${COLUMNAS_PLANILLA.map((c) => `<th>${c.etiqueta}</th>`).join("")}<th>Categoría</th><th>Revisar</th></tr></thead>
          <tbody>${filas}</tbody></table></div>
        <div class="eq-acciones">
          <button class="eq-btn primario" data-accion="aplicar-importacion">Importar: ${n("nuevo")} nuevos, ${n("actualizar")} a actualizar, ${n("omitir")} omitidos</button>
          <button class="eq-btn" data-accion="cancelar-importacion">Cancelar</button>
        </div>`;
      },
      async catalogos() {
        const [proyectos2, personas2] = await Promise.all([listarProyectos(), listarPersonas()]);
        const editable = catalogosEditables();
        return `<button class="eq-volver" data-accion="ir" data-vista="admin">← Administrar</button>
        <div class="eq-intro"><h2>Proyectos y personas</h2>
        <p class="eq-tenue">Catálogos temporales para probar. En la app global se reemplazan por los reales sin cambiar este módulo.</p></div>
        <section class="eq-seccion"><h3>Proyectos</h3>
          <ul class="eq-lista-simple">${proyectos2.map((p) => `<li>${escapar(p.nombre)}${p.mandante ? ` <span class="eq-tenue">— ${escapar(p.mandante)}</span>` : ""}${p.id === OFICINA_ID ? ' <span class="eq-tenue">(fijo)</span>' : ""}</li>`).join("")}</ul>
          ${editable ? `<form class="eq-form fila" data-form="proyecto"><input name="nombre" placeholder="Nombre del proyecto" required><input name="mandante" placeholder="Mandante"><button class="eq-btn" type="submit">Agregar</button></form>` : ""}
        </section>
        <section class="eq-seccion"><h3>Personas</h3>
          <ul class="eq-lista-simple">${personas2.map((p) => `<li>${escapar(p.nombre)}${p.cargo ? ` <span class="eq-tenue">— ${escapar(p.cargo)}</span>` : ""}</li>`).join("") || '<li class="eq-tenue">Sin personas</li>'}</ul>
          ${editable ? `<form class="eq-form fila" data-form="persona"><input name="nombre" placeholder="Nombre" required><input name="cargo" placeholder="Cargo (geomensor, topógrafo, piloto…)"><button class="eq-btn" type="submit">Agregar</button></form>` : ""}
        </section>`;
      },
      async respaldo() {
        return `<button class="eq-volver" data-accion="ir" data-vista="admin">← Administrar</button>
        <div class="eq-intro"><h2>Respaldo</h2>
        <p class="eq-tenue"><b>Respaldo (.json):</b> todo lo de la app (equipos, historial, alertas, certificados con sus PDF y fotos). Sirve para recuperar la app. Al cargarlo se mezcla por registro: gana el más reciente y no se borra nada.</p>
        <p class="eq-tenue"><b>Planilla Excel:</b> tus columnas de siempre más ubicación, próxima calibración, certificado vigente y alertas, con hojas de accesorios y certificados. Se abre sin la app y se puede volver a importar.</p>
        <div class="eq-acciones bloque"><button class="eq-btn relleno" data-accion="exportar">Descargar respaldo (.json)</button>
          <button class="eq-btn" data-accion="descargar-planilla">Descargar planilla Excel</button>
          <label class="eq-archivo" style="flex:1 1 100%">Cargar respaldo (.json)<input type="file" accept=".json" data-accion-cambio="importar-respaldo"></label></div></div>`;
      },
      async papelera() {
        const items = await enPapelera("equipos_equipos");
        const otros = [...await enPapelera("equipos_certificados"), ...await enPapelera("equipos_mantenciones"), ...await enPapelera("compartido_archivos")];
        const etiquetaOtro = ({ almacen, registro: r }) => almacen === "equipos_certificados" ? `Certificado ${escapar(r.codigo)} (${fechaLegible(r.fecha)})` : almacen === "equipos_mantenciones" ? `Mantención ${escapar(r.tipo)} del ${fechaLegible(r.fecha)}` : `Archivo ${escapar(r.nombre)}`;
        return `<button class="eq-volver" data-accion="ir" data-vista="admin">← Administrar</button>
        <div class="eq-intro"><h2>Papelera</h2>
        ${items.length ? `<ul class="eq-lista-simple">${items.map(({ almacen, registro }) => `<li>${escapar(nombreCorto(registro))} · N° ${escapar(registro.numeroSerie || "—")} <span class="eq-tenue">eliminado ${fechaHoraLegible(registro.eliminadoEn)}</span>
            <button class="eq-btn chico" data-accion="restaurar" data-almacen="${almacen}" data-id="${registro.id}">Restaurar</button></li>`).join("")}</ul>` : '<p class="eq-tenue">No hay equipos en la papelera.</p>'}
        ${otros.length ? `<h3 style="margin-top:14px">Certificados, mantenciones y archivos</h3><ul class="eq-lista-simple">${otros.map((o) => `<li>${etiquetaOtro(o)} <span class="eq-tenue">eliminado ${fechaHoraLegible(o.registro.eliminadoEn)}</span>
            <button class="eq-btn chico" data-accion="restaurar" data-almacen="${o.almacen}" data-id="${o.registro.id}">Restaurar</button></li>`).join("")}</ul>` : ""}</div>`;
      }
    };
    const enlaceEquipo = contexto.enlaceEquipo || ((id) => `${location.href.split("#")[0]}#equipo=${id}`);
    const ficha = crearFicha({ st, esc: escapar, proy, pers, avisar: avisar2, ir, render: () => render(), esRRHH, persona: persona2, chipUbicacion, chipCalibracion, describirEvento, enlaceEquipo });
    Object.assign(VISTAS2, ficha.VISTAS);
    function celdasPlanilla(d) {
      return COLUMNAS_PLANILLA.map((c) => {
        let v = d[c.campo];
        if (c.campo === "fechaUltimaCalibracion") return `<td class="eq-mono">${d.calibracionNoAplica ? "-" : fechaLegible(v)}</td>`;
        if (c.campo === "numeroSerie") return `<td class="eq-mono">${escapar(v)}</td>`;
        if (c.campo === "descripcion") return `<td class="eq-detalle">${escapar(v)}</td>`;
        if (c.campo === "marca" || c.campo === "modelo") return `<td class="eq-nw">${escapar(v)}</td>`;
        return `<td>${escapar(v)}</td>`;
      }).join("");
    }
    function pintarResultados() {
      const cont = zona.querySelector("#eq-resultados");
      if (!cont) return;
      const fn = (FILTROS.find((f) => f[0] === st.filtro) || FILTROS[0])[2];
      const q = st.busqueda.trim().toLowerCase();
      const lista = cacheLista.filter(fn).filter((e) => !q || [e.equipo.equipo, e.equipo.modelo, e.equipo.numeroSerie, e.equipo.marca, e.equipo.descripcion, e.equipo.codigoInterno, e.equipo.categoria].some((v) => String(v || "").toLowerCase().includes(q)));
      if (!lista.length) {
        cont.innerHTML = '<p class="eq-tenue">Ningún equipo coincide.</p>';
        return;
      }
      const tarjetas = lista.map((e) => `<button class="eq-tarjeta" data-accion="ver" data-id="${e.equipo.id}">
        <div class="eq-tarjeta-nombre">${escapar(e.nombre)}</div>
        ${e.equipo.descripcion ? `<div class="eq-tenue">${escapar(e.equipo.descripcion)}</div>` : ""}
        <div class="eq-tenue">N° serie <span class="eq-mono">${escapar(e.equipo.numeroSerie || "—")}</span></div>
        <div class="eq-chips">${chipUbicacion(e.ubicacion)} ${chipCalibracion(e.calibracion)} ${chipAlertas2(e.alertasActivas.length)}</div>
      </button>`).join("");
      const filas = lista.map((e) => `<tr data-accion="ver" data-id="${e.equipo.id}">
        ${celdasPlanilla(e.equipo)}
        <td>${chipUbicacion(e.ubicacion)}</td><td>${chipCalibracion(e.calibracion)}</td><td>${chipAlertas2(e.alertasActivas.length)}</td></tr>`).join("");
      cont.innerHTML = `<div class="eq-tarjetas">${tarjetas}</div>
      <div class="eq-tabla-scroll eq-solo-ancho"><table class="eq-tabla">
        <thead><tr>${COLUMNAS_PLANILLA.map((c) => `<th>${c.etiqueta}</th>`).join("")}<th>Ubicación</th><th>Calibración</th><th>Alertas</th></tr></thead>
        <tbody>${filas}</tbody></table></div>`;
    }
    function leerChecklist(form) {
      return [...form.querySelectorAll('input[name="equipo"]:checked')].map((chk) => {
        const id = chk.value;
        const checklist = [...form.querySelectorAll(`input[data-comp="${id}"]`)].map((c) => ({ nombre: c.value, ok: c.checked }));
        return { equipoId: id, checklist };
      });
    }
    async function alClic(ev) {
      const el = ev.target.closest("[data-accion]");
      if (!el || !raiz.contains(el)) return;
      const { accion, id } = el.dataset;
      try {
        if (await ficha.clic(accion, el)) return;
        switch (accion) {
          case "ir":
            await ir(el.dataset.vista);
            break;
          case "filtro":
            st.filtro = el.dataset.filtro;
            zona.querySelectorAll(".eq-filtro").forEach((b) => b.classList.toggle("activo", b === el));
            pintarResultados();
            break;
          case "ver":
            await ir("ficha", { equipoId: id, verPlaca: false });
            break;
          case "cert-de-proyecto":
            await ir("cert-proyecto", { certProyectoId: id });
            break;
          case "nuevo-equipo":
            await ir("editar", { equipoId: null });
            break;
          case "editar":
            await ir("editar", { equipoId: id });
            break;
          case "reportar":
            await ir("reportar", { alertaEquipoId: id || null, reporteDesdeFicha: st.vista === "ficha" });
            break;
          case "marcar-todo":
            el.closest(".eq-componentes").querySelectorAll("input[type=checkbox]").forEach((c) => {
              c.checked = true;
            });
            break;
          case "baja": {
            const deBaja = el.dataset.valor === "1";
            const nota = prompt(deBaja ? "¿Motivo de la baja?" : "¿Nota de reactivación? (opcional)", "");
            if (nota === null) return;
            await cambiarBaja(id, deBaja, nota);
            avisar2(deBaja ? "Equipo dado de baja" : "Equipo reactivado");
            await render();
            break;
          }
          case "papelera-equipo":
            if (!confirm("¿Enviar este equipo a la papelera? Se puede restaurar desde Administrar → Papelera.")) return;
            await papeleraEquipo(id);
            avisar2("Equipo enviado a la papelera");
            await ir("lista");
            break;
          case "restaurar":
            await restaurar(el.dataset.almacen, id, { personaId: persona2 });
            avisar2("Restaurado");
            await render();
            break;
          case "alerta-paso": {
            const nota = prompt("Nota (opcional): proveedor, n° de orden, qué se reparó…", "");
            if (nota === null) return;
            await cambiarEstadoAlerta(id, el.dataset.estado, nota);
            avisar2(`Alerta: ${ESTADOS_ALERTA[el.dataset.estado]}`);
            await render();
            break;
          }
          case "nuevo-proyecto": {
            const nombre = prompt("Nombre del proyecto");
            if (!nombre) return;
            const mandante = prompt("Mandante (opcional)", "") || "";
            await guardarProyecto({ nombre: nombre.trim(), mandante: mandante.trim() }, { personaId: persona2 });
            avisar2("Proyecto agregado");
            await render();
            break;
          }
          case "aplicar-importacion": {
            const res = await aplicarImportacion(st.importacion.registros);
            st.importacion = null;
            avisar2(`Importación lista: ${res.nuevos} nuevos, ${res.actualizados} actualizados, ${res.omitidos} omitidos`);
            await ir("lista", { filtro: "todos" });
            break;
          }
          case "cancelar-importacion":
            st.importacion = null;
            await render();
            break;
          case "descargar-planilla": {
            avisar2("Armando la planilla…");
            const r = await descargarPlanilla();
            avisar2(`Planilla descargada: ${r.archivo} (${r.equipos} equipos)`);
            break;
          }
          case "exportar":
            await descargarRespaldo(["equipos_", "compartido_"], "equipos_respaldo");
            avisar2("Respaldo descargado");
            break;
        }
      } catch (err) {
        console.error(err);
        avisar2(err.message, "error");
      }
    }
    async function alCambiar2(ev) {
      const el = ev.target;
      try {
        if (el.dataset.imp) {
          const r = st.importacion.registros[+el.dataset.i];
          r[el.dataset.imp] = el.value;
          if (el.dataset.imp === "accion") await render();
          return;
        }
        if (await ficha.cambio(el)) return;
        switch (el.dataset.accionCambio) {
          case "mostrar-componentes":
            el.closest(".eq-check-item").querySelector(".eq-componentes").hidden = !el.checked;
            break;
          case "ver-cerradas":
            st.verCerradas = el.checked;
            await render();
            break;
          case "leer-planilla":
            if (!el.files[0]) return;
            avisar2("Leyendo planilla…");
            st.importacion = await prepararImportacion(el.files[0]);
            await render();
            avisar2(`${st.importacion.registros.length} filas leídas: revisa antes de importar`);
            break;
          case "importar-respaldo": {
            if (!el.files[0]) return;
            const res = await importarRespaldo(JSON.parse(await el.files[0].text()));
            avisar2(`Respaldo cargado: ${res.nuevos} nuevos, ${res.actualizados} actualizados`);
            el.value = "";
            break;
          }
        }
      } catch (err) {
        console.error(err);
        avisar2(err.message, "error");
        el.value = "";
      }
    }
    function alEscribir(ev) {
      if (ev.target.dataset.campo === "busqueda") {
        st.busqueda = ev.target.value;
        pintarResultados();
      }
    }
    async function alEnviar(ev) {
      const form = ev.target.closest("form[data-form]");
      if (!form) return;
      ev.preventDefault();
      const fd = Object.fromEntries(new FormData(form));
      try {
        if (await ficha.enviar(form, fd)) return;
        switch (form.dataset.form) {
          case "equipo": {
            const datos = {
              ...fd,
              id: st.equipoId || void 0,
              fechaUltimaCalibracion: fd.fechaUltimaCalibracion || null,
              periodoCalibracionMeses: Number(fd.periodoCalibracionMeses) || PERIODO_CALIBRACION_MESES,
              calibracionNoAplica: fd.calibracionNoAplica === "on"
            };
            if (!datos.id) delete datos.id;
            const eq = await guardarEquipo(datos);
            avisar2("Equipo guardado");
            await ir("ficha", { equipoId: eq.id });
            break;
          }
          case "salida": {
            const items = leerChecklist(form);
            if (!items.length) {
              avisar2("Marca al menos un equipo", "error");
              return;
            }
            const res = await registrarSalida(items, { proyectoId: fd.proyectoId, personaId: fd.personaId, nota: fd.nota });
            await ir("resultado", { resultado: { titulo: `Salida registrada a ${proy(fd.proyectoId)}`, items: res, proyectoId: fd.proyectoId } });
            break;
          }
          case "regreso": {
            const items = leerChecklist(form);
            if (!items.length) {
              avisar2("Marca al menos un equipo", "error");
              return;
            }
            const res = await registrarRegreso(items, { nota: fd.nota });
            await ir("resultado", { resultado: { titulo: "Regreso a oficina registrado", items: res } });
            break;
          }
          case "reportar":
            await reportarAnomalia({ equipoId: fd.equipoId, descripcion: fd.descripcion.trim(), personaId: persona2 });
            avisar2("Alerta enviada a RRHH");
            if (st.reporteDesdeFicha && fd.equipoId === st.equipoId) await ir("ficha", { fichaTab: "mantencion", reporteDesdeFicha: false });
            else await ir("alertas");
            break;
          case "proyecto":
            await guardarProyecto({ nombre: fd.nombre.trim(), mandante: fd.mandante.trim() }, { personaId: persona2 });
            await render();
            break;
          case "persona":
            await guardarPersona({ nombre: fd.nombre.trim(), cargo: fd.cargo.trim() }, { personaId: persona2 });
            await render();
            break;
        }
      } catch (err) {
        console.error(err);
        avisar2(err.message, "error");
      }
    }
    raiz.addEventListener("click", alClic);
    raiz.addEventListener("change", alCambiar2);
    raiz.addEventListener("input", alEscribir);
    raiz.addEventListener("submit", alEnviar);
    render();
    return {
      desmontar() {
        activo2 = false;
        clearTimeout(timerAviso2);
        raiz.remove();
      },
      /** Llegaron datos de otro dispositivo: se redibuja si no hay un formulario a medio llenar. */
      refrescar() {
        const escribiendo = raiz.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
        const seguras = ["lista", "ficha", "alertas", "regreso", "resultado", "cert-proyecto", "admin", "papelera"];
        if (!escribiendo && seguras.includes(st.vista) && !(st.vista === "ficha" && raiz.querySelector("details[open]"))) render();
        else avisar2("Llegaron datos nuevos de la nube; se verán al cambiar de pantalla");
      }
    };
  }

  // modulos/equipos/equipos.js
  var VERSION = VERSION_MODULO;
  var ALMACENES = Object.values(ALM2);
  var iniciado = false;
  function iniciar2({ personaId } = {}) {
    if (!iniciado) {
      iniciarDatos({ personaId: personaId != null ? personaId : null });
      iniciado = true;
    } else if (personaId !== void 0) fijarPersona(personaId);
  }
  function montar(contenedor2, contexto) {
    iniciar2({ personaId: contexto.personaId });
    return montarPantallas(contenedor2, contexto);
  }
  function resumen(est2) {
    if (!est2) return null;
    return {
      id: est2.equipo.id,
      nombre: est2.nombre,
      equipo: est2.equipo.equipo,
      marca: est2.equipo.marca,
      modelo: est2.equipo.modelo,
      descripcion: est2.equipo.descripcion,
      numeroSerie: est2.equipo.numeroSerie,
      categoria: est2.equipo.categoria,
      componentes: est2.equipo.accesorios.map((a) => a.nombre),
      // nombres (compatibilidad con v0.1)
      accesorios: est2.equipo.accesorios.map((a) => ({ ...a })),
      // [{ id, nombre, cantidad, serie, estado }]
      fechaUltimaCalibracion: est2.equipo.fechaUltimaCalibracion,
      calibracion: { ...est2.calibracion },
      // { nivel: ok|por_vencer|vencida|sin_dato|no_aplica, proxima, dias }
      ubicacion: { ...est2.ubicacion },
      // { lugar: oficina|terreno|mantencion|baja, proyectoId, personaId, desde }
      alertasActivas: est2.alertasActivas.map((a) => ({ id: a.id, estado: a.estado, descripcion: a.descripcion, fechaReporte: a.fechaReporte }))
    };
  }
  async function obtenerEquipo(equipoId) {
    iniciar2();
    return resumen(await estadoDeEquipo(equipoId));
  }
  async function equiposDeProyecto(proyectoId) {
    iniciar2();
    return (await listarConEstado()).filter((e) => e.ubicacion.proyectoId === proyectoId && e.ubicacion.lugar !== "baja").map(resumen);
  }
  async function alertasActivas(equipoId) {
    iniciar2();
    const est2 = await estadoDeEquipo(equipoId);
    return est2 ? resumen(est2).alertasActivas : [];
  }
  async function registrarUsoConAlerta(equipoId, personaId, proyectoId) {
    iniciar2();
    const r = await registrarUso(equipoId, personaId, proyectoId);
    if (!r) return { registrado: false, alertas: [] };
    return {
      registrado: true,
      eventoId: r.evento.id,
      alertas: r.alertas.map((a) => ({ id: a.id, estado: a.estado, descripcion: a.descripcion }))
    };
  }
  async function certificadoVigente(equipoId) {
    iniciar2();
    const c = (await listarCertificados(equipoId))[0];
    return c ? { id: c.id, codigo: c.codigo, fecha: c.fecha, laboratorio: c.laboratorio, archivoId: c.archivoId } : null;
  }
  async function certificadosDeProyecto(proyectoId) {
    const eqs = await equiposDeProyecto(proyectoId);
    return Promise.all(eqs.map(async (e) => ({ equipo: e, certificado: await certificadoVigente(e.id) })));
  }
  async function listarEquiposConEstado({ incluirBaja = false } = {}) {
    iniciar2();
    return (await listarConEstado()).filter((e) => incluirBaja || e.ubicacion.lugar !== "baja").map(resumen);
  }

  // modulos/vuelos/drones.js
  var DRONES_BASE = [
    {
      id: "m4e",
      familia: "m4e",
      familiaNombre: "DJI Matrice 4E",
      sensor: "Cámara gran angular",
      nombre: "DJI Matrice 4E (cámara gran angular)",
      sensorAnchoMm: 17.3,
      sensorAltoMm: 13,
      focalMm: 12.29,
      pixelesAncho: 5280,
      pixelesAlto: 3956,
      obturador: "mecanico",
      velocidadMaxMs: 21,
      autonomiaMin: 49,
      intervaloMinS: 0.5,
      vientoMaxMs: 12,
      rafagaMaxMs: 12,
      lidar: null
    },
    {
      id: "m300-l2",
      familia: "m300",
      familiaNombre: "DJI Matrice 300 RTK",
      sensor: "Zenmuse L2",
      nombre: "DJI Matrice 300 RTK · Zenmuse L2",
      sensorAnchoMm: 17.3,
      sensorAltoMm: 13,
      focalMm: 12.29,
      pixelesAncho: 5280,
      pixelesAlto: 3956,
      obturador: "mecanico",
      velocidadMaxMs: 15,
      autonomiaMin: 30,
      intervaloMinS: 0.7,
      vientoMaxMs: 12,
      rafagaMaxMs: 15,
      lidar: { puntosPorSegundo: 24e4, fovGrados: 70 }
    },
    {
      id: "m300-l1",
      familia: "m300",
      familiaNombre: "DJI Matrice 300 RTK",
      sensor: "Zenmuse L1",
      nombre: "DJI Matrice 300 RTK · Zenmuse L1",
      sensorAnchoMm: 13.2,
      sensorAltoMm: 8.8,
      focalMm: 8.8,
      pixelesAncho: 5472,
      pixelesAlto: 3648,
      obturador: "mecanico",
      velocidadMaxMs: 15,
      autonomiaMin: 30,
      intervaloMinS: 1,
      vientoMaxMs: 12,
      rafagaMaxMs: 15,
      lidar: { puntosPorSegundo: 24e4, fovGrados: 70.4 }
    },
    {
      id: "p4rtk",
      familia: "p4rtk",
      familiaNombre: "DJI Phantom 4 RTK",
      sensor: "Cámara integrada",
      nombre: "DJI Phantom 4 RTK",
      sensorAnchoMm: 13.2,
      sensorAltoMm: 8.8,
      focalMm: 8.8,
      pixelesAncho: 5472,
      pixelesAlto: 3648,
      obturador: "mecanico",
      velocidadMaxMs: 14,
      autonomiaMin: 30,
      intervaloMinS: 2,
      vientoMaxMs: 10,
      rafagaMaxMs: 10,
      lidar: null
    }
  ];
  var CAMPOS_DRON = [
    ["sensorAnchoMm", "Ancho del sensor", "mm"],
    ["sensorAltoMm", "Alto del sensor", "mm"],
    ["focalMm", "Distancia focal real", "mm"],
    ["pixelesAncho", "Ancho de la imagen", "px"],
    ["pixelesAlto", "Alto de la imagen", "px"],
    ["velocidadMaxMs", "Velocidad máxima de misión", "m/s"],
    ["autonomiaMin", "Autonomía por batería (ficha)", "min"],
    ["intervaloMinS", "Intervalo mínimo entre fotos", "s"],
    ["vientoMaxMs", "Viento sostenido máximo", "m/s"],
    ["rafagaMaxMs", "Ráfaga máxima", "m/s"]
  ];

  // modulos/vuelos/datos.js
  var SCHEMA_VERSION2 = 2;
  var ALM3 = { planes: "vuelos_planes", drones: "vuelos_drones" };
  var ALM_CAPAS = "local_vuelos_capas";
  var persona = null;
  function iniciarDatos2({ personaId = null } = {}) {
    registrarAlmacenes([{ nombre: ALM3.planes, indices: [["proyectoId", "proyectoId"]] }, { nombre: ALM3.drones }, { nombre: ALM_CAPAS }]);
    persona = personaId;
  }
  function fijarPersona2(p) {
    persona = p;
  }
  var sello2 = (r) => sellar(r, { personaId: persona, schemaVersion: SCHEMA_VERSION2 });
  var vivo2 = (r) => !r.eliminadoEn;
  async function listarDrones() {
    const cambios = Object.fromEntries((await todos(ALM3.drones)).filter(vivo2).map((d) => [d.id, d]));
    return DRONES_BASE.map((d) => ({ ...d, ...cambios[d.id] ? limpiarCambios(cambios[d.id]) : {}, corregido: !!cambios[d.id] }));
  }
  function limpiarCambios(c) {
    const { creadoEn, creadoPor, actualizadoEn, dispositivoId: dispositivoId2, modificadoPor, schemaVersion, ...resto } = c;
    return resto;
  }
  async function guardarDron(id, valores) {
    const actual = await obtener(ALM3.drones, id) || { id };
    delete actual.eliminadoEn;
    delete actual.eliminadoPor;
    return guardar(ALM3.drones, sello2({ ...actual, ...valores, id }));
  }
  async function restablecerDron(id) {
    return enviarAPapelera(ALM3.drones, id, { personaId: persona });
  }
  async function listarPlanes() {
    return (await todos(ALM3.planes)).filter(vivo2).sort((a, b) => (b.actualizadoEn || "").localeCompare(a.actualizadoEn || ""));
  }
  async function planesDeProyecto(proyectoId) {
    return (await porIndice(ALM3.planes, "proyectoId", proyectoId)).filter(vivo2);
  }
  async function obtenerPlan(id) {
    const p = await obtener(ALM3.planes, id);
    return p && vivo2(p) ? p : null;
  }
  async function guardarPlan(plan) {
    return guardar(ALM3.planes, sello2({ ...plan }));
  }
  async function eliminarPlan(id) {
    return enviarAPapelera(ALM3.planes, id, { personaId: persona });
  }
  async function listarCapasUsuario() {
    return (await todos(ALM_CAPAS)).filter(vivo2);
  }
  async function guardarCapaUsuario(capa) {
    return guardar(ALM_CAPAS, sello2({ ...capa }), { silencioso: true });
  }
  async function borrarCapaUsuario(id) {
    return borrarDefinitivo(ALM_CAPAS, id);
  }

  // modulos/vuelos/geom.js
  var EPS = 1e-9;
  var dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
  var sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  var add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  var mul = (a, k) => [a[0] * k, a[1] * k];
  var cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  var unit = (v) => {
    const l = Math.hypot(v[0], v[1]) || 1;
    return [v[0] / l, v[1] / l];
  };
  function areaFirmada(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) s += cross(pts[i], pts[(i + 1) % pts.length]);
    return s / 2;
  }
  var antihorario = (pts) => areaFirmada(pts) < 0 ? pts.slice().reverse() : pts;
  function cruceRectas(p, r, q, s) {
    const d = cross(r, s);
    if (Math.abs(d) < EPS) return null;
    const t = cross(sub(q, p), s) / d;
    return add(p, mul(r, t));
  }
  function limpiarVertices(pts, cerrado) {
    const out = [];
    for (const p of pts) if (!out.length || dist(out[out.length - 1], p) > 0.01) out.push(p);
    if (cerrado && out.length > 1 && dist(out[0], out[out.length - 1]) < 0.01) out.pop();
    return out;
  }
  function margenPoligono(puntos, d, { rectas = true } = {}) {
    let pts = antihorario(limpiarVertices(puntos, true));
    if (!(d > 0) || pts.length < 3) return pts;
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
      const e1 = unit(sub(b, a)), e2 = unit(sub(c, b));
      const n1 = [e1[1], -e1[0]], n2 = [e2[1], -e2[0]];
      const giro2 = cross(e1, e2);
      if (giro2 <= EPS) {
        const x = cruceRectas(add(a, mul(n1, d)), e1, add(b, mul(n2, d)), e2);
        out.push(x || add(b, mul(n1, d)));
        continue;
      }
      if (rectas) {
        const x = cruceRectas(add(a, mul(n1, d)), e1, add(b, mul(n2, d)), e2);
        if (x && dist(x, b) <= 3 * d) out.push(x);
        else {
          out.push(add(b, mul(n1, d)));
          out.push(add(b, mul(n2, d)));
        }
      } else {
        const a1 = Math.atan2(n1[1], n1[0]);
        let a2 = Math.atan2(n2[1], n2[0]);
        while (a2 < a1) a2 += 2 * Math.PI;
        const pasos = Math.max(2, Math.ceil((a2 - a1) / (Math.PI / 12)));
        for (let k = 0; k <= pasos; k++) {
          const t = a1 + (a2 - a1) * k / pasos;
          out.push(add(b, [Math.cos(t) * d, Math.sin(t) * d]));
        }
      }
    }
    return out;
  }
  function desplazarLinea(linea, o) {
    const pts = limpiarVertices(linea, false);
    if (pts.length < 2 || Math.abs(o) < EPS) return pts.slice();
    const n = pts.length, out = [];
    const normal = (p, q) => {
      const e = unit(sub(q, p));
      return [-e[1], e[0]];
    };
    out.push(add(pts[0], mul(normal(pts[0], pts[1]), o)));
    for (let i = 1; i < n - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const n1 = normal(a, b), n2 = normal(b, c);
      const x = cruceRectas(add(a, mul(n1, o)), sub(b, a), add(b, mul(n2, o)), sub(c, b));
      if (x && dist(x, b) <= 3 * Math.abs(o)) out.push(x);
      else {
        out.push(add(b, mul(n1, o)));
        out.push(add(b, mul(n2, o)));
      }
    }
    out.push(add(pts[n - 1], mul(normal(pts[n - 2], pts[n - 1]), o)));
    return out;
  }
  function largo(linea) {
    let s = 0;
    for (let i = 1; i < linea.length; i++) s += dist(linea[i - 1], linea[i]);
    return s;
  }
  function poligonoCorredor(eje, izq, der) {
    const l = desplazarLinea(eje, izq), r = desplazarLinea(eje, -der);
    return antihorario([...l, ...r.slice().reverse()]);
  }
  function pasadasCorredor(eje, izq, der, sep) {
    const ancho = izq + der;
    const n = Math.max(1, Math.ceil(ancho / Math.max(1, sep)));
    const ini = -der + (ancho - (n - 1) * sep) / 2;
    const pasadas = [];
    for (let k = 0; k < n; k++) pasadas.push(desplazarLinea(eje, ini + k * sep));
    return pasadas;
  }
  function cruceSegmentos(p, p2, q, q2) {
    const r = sub(p2, p), s = sub(q2, q), d = cross(r, s);
    if (Math.abs(d) < EPS) return null;
    const t = cross(sub(q, p), s) / d, u = cross(sub(q, p), r) / d;
    if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
    return { t, u, punto: add(p, mul(r, t)) };
  }
  function cortarPoligono(poli, corte) {
    const n = poli.length;
    const cruces = [];
    for (let i = 0; i + 1 < corte.length; i++) {
      for (let e = 0; e < n; e++) {
        const x = cruceSegmentos(corte[i], corte[i + 1], poli[e], poli[(e + 1) % n]);
        if (x) cruces.push({ seg: i, t: x.t, borde: e, u: x.u, punto: x.punto });
      }
    }
    cruces.sort((a, b) => a.seg - b.seg || a.t - b.t);
    const unicos = cruces.filter((c, k) => !k || dist(c.punto, cruces[k - 1].punto) > 0.01);
    if (unicos.length < 2) return null;
    const [P, Q] = unicos;
    const medio = [];
    for (let i = P.seg + 1; i <= Q.seg; i++) medio.push(corte[i]);
    const camino = [P.punto, ...medio.filter((m) => dist(m, P.punto) > 0.01 && dist(m, Q.punto) > 0.01), Q.punto];
    const recorrer = (desde, hasta, uDesde, uHasta) => {
      const out = [];
      if (desde === hasta && uHasta > uDesde) return out;
      let e = desde;
      do {
        e = (e + 1) % n;
        out.push(poli[e]);
      } while (e !== hasta && out.length <= n);
      return out;
    };
    const A = [...camino, ...recorrer(Q.borde, P.borde, Q.u, P.u)];
    const B = [...camino.slice().reverse(), ...recorrer(P.borde, Q.borde, P.u, Q.u)];
    const ok = (x) => x.length >= 3 && Math.abs(areaFirmada(x)) > 1;
    if (!ok(A) || !ok(B)) return null;
    return [antihorario(A), antihorario(B)];
  }
  function aplicarCortes(poli, cortes) {
    let sectores = [poli];
    const fallidos = [];
    cortes.forEach((c, k) => {
      for (let i = 0; i < sectores.length; i++) {
        const r = cortarPoligono(sectores[i], c);
        if (r) {
          sectores.splice(i, 1, r[0], r[1]);
          return;
        }
      }
      fallidos.push(k);
    });
    return { sectores, fallidos };
  }
  function cortarEje(eje, cortes) {
    const puntos = [];
    for (const c of cortes) {
      for (let i = 0; i + 1 < eje.length; i++) {
        for (let j = 0; j + 1 < c.length; j++) {
          const x = cruceSegmentos(eje[i], eje[i + 1], c[j], c[j + 1]);
          if (x) puntos.push({ seg: i, t: x.t, punto: x.punto });
        }
      }
    }
    puntos.sort((a, b) => a.seg - b.seg || a.t - b.t);
    const tramos = [];
    let actual = [eje[0]], seg = 0;
    for (const p of puntos) {
      for (let i = seg + 1; i <= p.seg; i++) actual.push(eje[i]);
      actual.push(p.punto);
      if (largo(actual) > 1) tramos.push(actual);
      actual = [p.punto];
      seg = p.seg;
    }
    for (let i = seg + 1; i < eje.length; i++) actual.push(eje[i]);
    if (largo(actual) > 1) tramos.push(actual);
    return tramos;
  }
  function recorrerPorBaterias(pasadas, { v, segGiro = 0, segUtiles, despegue = null }) {
    const segs = [];
    pasadas.forEach((p, k) => {
      const linea = k % 2 === 0 ? p : p.slice().reverse();
      if (k > 0 && segs.length) segs.push({ a: segs[segs.length - 1].b, b: linea[0], enlace: true });
      for (let i = 0; i + 1 < linea.length; i++) segs.push({ a: linea[i], b: linea[i + 1], giro: i + 2 === linea.length && k < pasadas.length - 1 });
    });
    const vuelta = (p) => despegue ? dist(p, despegue) / v : 0;
    const baterias = [];
    let bat = null;
    const abrir2 = (p) => {
      const ida = despegue ? dist(despegue, p) / v : 0;
      bat = { piezas: [[p]], seg: ida, traslado: ida, inicio: p, fin: p, excede: false, vuelo: 0 };
    };
    const cerrar = () => {
      if (!bat) return;
      const r = vuelta(bat.fin);
      bat.seg += r;
      bat.traslado += r;
      baterias.push(bat);
      bat = null;
    };
    for (const s of segs) {
      const L = dist(s.a, s.b);
      let hecho = 0;
      let guard = 0;
      while (hecho < L - 0.01 && guard++ < 1e4) {
        if (!bat) abrir2(hecho ? add(s.a, mul(sub(s.b, s.a), hecho / L)) : s.a);
        const resta = L - hecho;
        const punto = (x2) => add(s.a, mul(sub(s.b, s.a), (hecho + x2) / L));
        const cabe = (x2) => bat.seg + x2 / v + (s.giro && x2 >= resta - 0.01 ? segGiro : 0) + vuelta(punto(x2)) <= segUtiles;
        let x;
        if (cabe(resta)) x = resta;
        else {
          let lo = 0, hi = resta;
          for (let k = 0; k < 40; k++) {
            const m = (lo + hi) / 2;
            if (cabe(m)) lo = m;
            else hi = m;
          }
          x = lo;
          if (x < 1 && bat.vuelo < 1) {
            x = resta;
            bat.excede = true;
          }
        }
        if (x < 0.01) {
          cerrar();
          continue;
        }
        const p2 = punto(x);
        bat.seg += x / v;
        bat.vuelo += x;
        if (s.giro && x >= resta - 0.01) bat.seg += segGiro;
        bat.piezas[0].push(p2);
        bat.fin = p2;
        hecho += x;
        if (hecho < L - 0.01) cerrar();
      }
    }
    cerrar();
    return { baterias: baterias.map((b) => ({ ...b, piezas: b.piezas.filter((p) => p.length >= 2) })), segVuelo: baterias.reduce((t, b) => t + b.seg, 0) };
  }
  function distPuntoSegmento(p, a, b) {
    const ab = sub(b, a), L2 = ab[0] * ab[0] + ab[1] * ab[1];
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L2)) : 0;
    return dist(p, add(a, mul(ab, t)));
  }
  function puntoEnPoligono(p, poli) {
    let dentro = false;
    for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
      const [xi, yi] = poli[i], [xj, yj] = poli[j];
      if (yi > p[1] !== yj > p[1] && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) dentro = !dentro;
    }
    return dentro;
  }
  function distPoligonos(A, B) {
    if (puntoEnPoligono(A[0], B) || puntoEnPoligono(B[0], A)) return 0;
    let m = Infinity;
    for (let i = 0; i < A.length; i++) {
      const a1 = A[i], a2 = A[(i + 1) % A.length];
      for (let j = 0; j < B.length; j++) {
        const b1 = B[j], b2 = B[(j + 1) % B.length];
        if (cruceSegmentos(a1, a2, b1, b2)) return 0;
        m = Math.min(m, distPuntoSegmento(a1, b1, b2), distPuntoSegmento(b1, a1, a2));
      }
    }
    return m;
  }
  function distPuntoPoligono(p, A) {
    if (puntoEnPoligono(p, A)) return 0;
    let m = Infinity;
    for (let i = 0; i < A.length; i++) m = Math.min(m, distPuntoSegmento(p, A[i], A[(i + 1) % A.length]));
    return m;
  }

  // modulos/vuelos/calculo.js
  var R_LAT = 110540;
  var R_LON = 111320;
  function proyectar(anillo) {
    const lat0 = anillo.reduce((s, p) => s + p[1], 0) / anillo.length;
    const lon0 = anillo.reduce((s, p) => s + p[0], 0) / anillo.length;
    const k = Math.cos(lat0 * Math.PI / 180) * R_LON;
    return { lat0, lon0, puntos: anillo.map(([lon, lat]) => [(lon - lon0) * k, (lat - lat0) * R_LAT]) };
  }
  function areaM2(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      s += x1 * y2 - x2 * y1;
    }
    return Math.abs(s) / 2;
  }
  function rumboLadoMasLargo(pts) {
    let mejor = 0, ang = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      const l = Math.hypot(x2 - x1, y2 - y1);
      if (l > mejor) {
        mejor = l;
        ang = Math.atan2(x2 - x1, y2 - y1) * 180 / Math.PI;
      }
    }
    return (ang % 180 + 180) % 180;
  }
  function giro(rumboGrados) {
    const a = (90 - rumboGrados) * Math.PI / 180;
    const c = Math.cos(-a), s = Math.sin(-a);
    return {
      ida: ([x, y]) => [x * c - y * s, x * s + y * c],
      vuelta: ([x, y]) => [x * c + y * s, -x * s + y * c]
    };
  }
  function lineasDeVuelo(pts, rumboGrados, sep) {
    const a = (90 - rumboGrados) * Math.PI / 180;
    const c = Math.cos(-a), s = Math.sin(-a);
    const rot = pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
    const ys = rot.map((p) => p[1]);
    const ymin = Math.min(...ys), ymax = Math.max(...ys);
    const ancho = ymax - ymin;
    const n = Math.max(1, Math.ceil(ancho / sep));
    const inicio2 = ymin + (ancho - (n - 1) * sep) / 2;
    const lineas = [];
    for (let k = 0; k < n; k++) {
      const y = inicio2 + k * sep;
      const xs = [];
      for (let i = 0; i < rot.length; i++) {
        const [x1, y1] = rot[i], [x2, y2] = rot[(i + 1) % rot.length];
        if (y1 <= y && y2 > y || y2 <= y && y1 > y) xs.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
      }
      xs.sort((p, q) => p - q);
      for (let j = 0; j + 1 < xs.length; j += 2) lineas.push({ y, x1: xs[j], x2: xs[j + 1], largo: xs[j + 1] - xs[j] });
    }
    return { lineas, n, ancho };
  }
  var gsdCm = (d, alturaM) => d.sensorAnchoMm * alturaM * 100 / (d.focalMm * d.pixelesAncho);
  var alturaParaGsd = (d, gsd) => gsd * d.focalMm * d.pixelesAncho / (d.sensorAnchoMm * 100);
  function calcularPlan(p) {
    var _a;
    const d = p.dron;
    const gsd = gsdCm(d, p.altura);
    const huellaAncho = gsd * d.pixelesAncho / 100;
    const huellaLargo = gsd * d.pixelesAlto / 100;
    const sepFotos = huellaLargo * (1 - p.traslapeFrontal);
    const barrido = p.modo === "lidar" && d.lidar ? 2 * p.altura * Math.tan(d.lidar.fovGrados / 2 * Math.PI / 180) : null;
    const sepLineas = (barrido || huellaAncho) * (1 - p.traslapeLateral);
    let area, distanciaLineas, nLineas, segmentos = [], rumbo = null, pasadas = null, girado = false;
    if (p.eje && p.eje.length >= 2) {
      pasadas = pasadasCorredor(p.eje, p.izq, p.der, sepLineas);
      nLineas = pasadas.length;
      distanciaLineas = pasadas.reduce((t, x) => t + largo(x), 0);
      area = largo(p.eje) * (p.izq + p.der);
    } else if (p.puntos && p.puntos.length >= 3) {
      area = areaM2(p.puntos);
      rumbo = (_a = p.rumbo) != null ? _a : rumboLadoMasLargo(p.puntos);
      const r = lineasDeVuelo(p.puntos, rumbo, sepLineas);
      segmentos = r.lineas;
      nLineas = r.lineas.length;
      distanciaLineas = r.lineas.reduce((t, l) => t + l.largo, 0);
      pasadas = segmentos.map((l) => [[l.x1, l.y], [l.x2, l.y]]);
      girado = true;
    } else {
      area = (p.areaHa || 0) * 1e4;
      distanciaLineas = area / sepLineas;
      nLineas = Math.max(1, Math.round(Math.sqrt(area) / sepLineas));
    }
    const distanciaGiros = Math.max(0, nLineas - 1) * sepLineas;
    const distancia = distanciaLineas + distanciaGiros;
    const fotos = p.modo === "lidar" && !p.fotosEnLidar ? 0 : pasadas ? pasadas.reduce((t, x) => t + Math.ceil(largo(x) / sepFotos) + 1, 0) : Math.ceil(distanciaLineas / sepFotos);
    const velBarrido = 0.5 * (gsd / 100) / p.exposicion;
    const velIntervalo = sepFotos / d.intervaloMinS;
    const limites = [
      ["máxima del dron", d.velocidadMaxMs],
      ...p.modo === "foto" || p.fotosEnLidar ? [["sin barrido (½ px)", velBarrido], ["intervalo de la cámara", velIntervalo]] : []
    ];
    const velSugerida = Math.min(...limites.map((l) => l[1]));
    const v = p.velocidad;
    const minUtiles = d.autonomiaMin * (1 - p.reserva) - p.minDespegue;
    let segMision, vuelos, baterias = [], trasladoM = 0, despegueGirado = null;
    if (pasadas && pasadas.length) {
      const g = girado ? giro(rumbo) : null;
      despegueGirado = p.despegue ? g ? g.ida(p.despegue) : p.despegue : null;
      const rep = recorrerPorBaterias(pasadas, { v, segGiro: p.segGiro, segUtiles: Math.max(60, minUtiles * 60), despegue: despegueGirado });
      baterias = rep.baterias.map((b) => ({ ...b, min: b.seg / 60, piezas: g ? b.piezas.map((pz) => pz.map(g.vuelta)) : b.piezas, inicio: g ? g.vuelta(b.inicio) : b.inicio }));
      segMision = rep.segVuelo;
      trasladoM = baterias.reduce((t, b) => t + b.traslado, 0) * v;
      vuelos = Math.max(1, baterias.length);
    } else {
      segMision = distancia / v + nLineas * p.segGiro;
      vuelos = Math.max(1, Math.ceil(segMision / 60 / Math.max(1, minUtiles)));
    }
    const minTotal = segMision / 60 + vuelos * p.minDespegue + (vuelos - 1) * p.minCambio;
    const intervalo2 = sepFotos / v;
    const densidad = barrido ? d.lidar.puntosPorSegundo / (v * sepLineas) : null;
    const densidadPasada = barrido ? d.lidar.puntosPorSegundo / (v * barrido) : null;
    const avisos = [];
    if (v > d.velocidadMaxMs) avisos.push(`La velocidad supera la máxima de misión del dron (${fmt(d.velocidadMaxMs, 1)} m/s).`);
    if ((p.modo === "foto" || p.fotosEnLidar) && v > velBarrido) avisos.push(`A ${fmt(v, 1)} m/s la foto se arrastra más de medio píxel: baja a ${fmt(velBarrido, 1)} m/s o usa una exposición más corta.`);
    if ((p.modo === "foto" || p.fotosEnLidar) && intervalo2 < d.intervaloMinS) avisos.push(`Habría que disparar cada ${fmt(intervalo2, 2)} s y la cámara necesita ${fmt(d.intervaloMinS, 1)} s: baja la velocidad a ${fmt(velIntervalo, 1)} m/s o el traslape frontal.`);
    if (p.altura > 120) avisos.push("La altura supera los 120 m (400 ft): revisa la autorización DGAC.");
    if (minUtiles <= 0) avisos.push("Con la reserva elegida no queda tiempo útil por batería: revisa autonomía y reserva.");
    if (baterias.some((b) => b.excede)) avisos.push("Parte del recorrido queda más lejos de lo que alcanza una batería ida y vuelta desde el despegue: acerca el despegue o divide el área en sectores.");
    return {
      gsd,
      huellaAncho,
      huellaLargo,
      sepFotos,
      sepLineas,
      barrido,
      area,
      rumbo,
      segmentos,
      nLineas,
      distancia,
      fotos,
      intervalo: intervalo2,
      velBarrido,
      velIntervalo,
      velSugerida,
      limites,
      minMision: segMision / 60,
      minUtiles,
      vuelos,
      minTotal,
      densidad,
      densidadPasada,
      avisos,
      baterias,
      trasladoM,
      corredor: !!pasadas && !girado,
      pasadasLocal: pasadas && !girado ? pasadas : null
    };
  }
  function fmt(n, dec = 0) {
    if (n == null || !isFinite(n)) return "—";
    return n.toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function fmtDuracion(min) {
    if (!isFinite(min)) return "—";
    const total = Math.round(min);
    const h = Math.floor(total / 60), m = total % 60;
    return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
  }

  // modulos/vuelos/kml.js
  async function leerArchivo(archivo) {
    const buf = new Uint8Array(await archivo.arrayBuffer());
    const esZip = buf[0] === 80 && buf[1] === 75;
    if (!esZip) return new TextDecoder("utf-8").decode(buf);
    return extraerKmlDeZip(buf);
  }
  async function extraerKmlDeZip(buf) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let fin = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 101010256) {
      fin = i;
      break;
    }
    if (fin < 0) throw new Error("El KMZ está dañado: no se encontró el índice del zip.");
    const total = dv.getUint16(fin + 10, true);
    let p = dv.getUint32(fin + 16, true);
    const entradas = [];
    for (let k = 0; k < total; k++) {
      if (dv.getUint32(p, true) !== 33639248) break;
      const metodo = dv.getUint16(p + 10, true);
      const comprimido = dv.getUint32(p + 20, true);
      const largoNombre = dv.getUint16(p + 28, true);
      const largoExtra = dv.getUint16(p + 30, true);
      const largoComent = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const nombre = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + largoNombre));
      entradas.push({ nombre, metodo, comprimido, local });
      p += 46 + largoNombre + largoExtra + largoComent;
    }
    const kml = entradas.find((e) => /(^|\/)doc\.kml$/i.test(e.nombre)) || entradas.find((e) => /\.kml$/i.test(e.nombre));
    if (!kml) throw new Error("El KMZ no trae ningún archivo .kml adentro.");
    const ini = kml.local + 30 + dv.getUint16(kml.local + 26, true) + dv.getUint16(kml.local + 28, true);
    const datos = buf.subarray(ini, ini + kml.comprimido);
    if (kml.metodo === 0) return new TextDecoder("utf-8").decode(datos);
    if (kml.metodo !== 8) throw new Error("El KMZ usa una compresión que no reconozco.");
    if (typeof DecompressionStream === "undefined") throw new Error("Este navegador no puede abrir KMZ. Actualiza Chrome o descomprime el KMZ y carga el .kml.");
    const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(flujo).text();
  }
  var hijos = (el, nombre) => [...el.getElementsByTagNameNS("*", nombre)];
  var texto2 = (el, nombre) => {
    const x = el.getElementsByTagNameNS("*", nombre)[0];
    return x ? x.textContent.trim() : "";
  };
  function leerCoordenadas(t) {
    return t.trim().replace(/\s*,\s*/g, ",").split(/\s+/).filter(Boolean).map((c) => c.split(",").map(Number)).filter((c) => c.length >= 2 && c.every(isFinite));
  }
  function analizarKml(textoKml, nombreArchivo = "") {
    const doc = new DOMParser().parseFromString(textoKml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("El archivo no es un KML válido.");
    const placemarks = hijos(doc, "Placemark");
    const res = { archivo: nombreArchivo, poligonos: [], ejes: [], lineas: 0, puntos: 0, carpetas: hijos(doc, "Folder").length, placemarks: placemarks.length };
    let n = 0;
    for (const pm of placemarks) {
      const nombre = texto2(pm, "name") || "";
      const modo = texto2(pm, "altitudeMode");
      for (const pol of hijos(pm, "Polygon")) {
        const ext = pol.getElementsByTagNameNS("*", "outerBoundaryIs")[0];
        const coords = ext ? leerCoordenadas(texto2(ext, "coordinates")) : [];
        const hoyos = pol.getElementsByTagNameNS("*", "innerBoundaryIs").length;
        if (coords.length >= 3) res.poligonos.push(revisar(coords, { nombre: nombre || `Polígono ${++n}`, hoyos, modo, origen: "poligono" }));
      }
      for (const ls of hijos(pm, "LineString")) {
        res.lineas++;
        const coords = leerCoordenadas(texto2(ls, "coordinates"));
        const nom = nombre || `Línea ${++n}`;
        const abierta = coords.length >= 2 && !igual(coords[0], coords[coords.length - 1]);
        if (abierta) res.ejes.push(revisarEje(coords, { nombre: nom, modo }));
        if (coords.length >= 3) res.poligonos.push({ ...revisar(coords, { nombre: nom, hoyos: 0, modo, origen: "linea" }), abierta });
      }
      res.puntos += hijos(pm, "Point").length;
    }
    return res;
  }
  function revisarEje(coords, info) {
    const conAltura = coords.some((c) => c.length > 2 && c[2] !== 0) || info.modo && info.modo !== "clampToGround";
    const linea = [];
    let duplicados = 0;
    for (const c of coords) {
      const p = [c[0], c[1]];
      if (linea.length && igual(linea[linea.length - 1], p)) duplicados++;
      else linea.push(p);
    }
    const { puntos } = proyectar(linea);
    let largo2 = 0;
    for (let i = 1; i < puntos.length; i++) largo2 += Math.hypot(puntos[i][0] - puntos[i - 1][0], puntos[i][1] - puntos[i - 1][1]);
    const problemas = [];
    if (conAltura) problemas.push("Trae altura o un modo de altitud distinto de «sobre el terreno».");
    if (duplicados) problemas.push(`${duplicados} vértice${duplicados > 1 ? "s" : ""} repetido${duplicados > 1 ? "s" : ""}.`);
    if (linea.length > 200) problemas.push(`${linea.length} vértices: muchos para el control; se simplifica.`);
    if (!coords.every((c) => Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90)) problemas.push("Las coordenadas no parecen latitud/longitud (WGS84). ¿Viene en UTM?");
    return { ...info, linea, vertices: linea.length, largo: largo2, problemas };
  }
  function leerCapa(textoKml) {
    const doc = new DOMParser().parseFromString(textoKml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("El archivo no es un KML válido.");
    const elementos = [];
    for (const pm of hijos(doc, "Placemark")) {
      const nombre = texto2(pm, "name") || "";
      for (const pol of hijos(pm, "Polygon")) {
        const ext = pol.getElementsByTagNameNS("*", "outerBoundaryIs")[0];
        const c = ext ? leerCoordenadas(texto2(ext, "coordinates")).map((x) => [x[0], x[1]]) : [];
        if (c.length >= 3) elementos.push({ tipo: "poligono", nombre, coords: c });
      }
      for (const ls of hijos(pm, "LineString")) {
        const c = leerCoordenadas(texto2(ls, "coordinates")).map((x) => [x[0], x[1]]);
        if (c.length >= 2) elementos.push({ tipo: "linea", nombre, coords: c });
      }
      for (const pt of hijos(pm, "Point")) {
        const c = leerCoordenadas(texto2(pt, "coordinates"));
        if (c.length) elementos.push({ tipo: "punto", nombre, coords: [c[0][0], c[0][1]] });
      }
    }
    return elementos;
  }
  function limpiarEje(eje, { maxVertices = 200 } = {}) {
    const { puntos, lat0, lon0 } = proyectar(eje.linea);
    let simplificado = puntos, tolerancia = 0;
    if (puntos.length > maxVertices) {
      tolerancia = 0.05;
      while (simplificado.length > maxVertices && tolerancia < 50) {
        const prueba = dp(puntos, tolerancia);
        if (prueba.length < 2) break;
        simplificado = prueba;
        tolerancia *= 1.5;
      }
    }
    const k = Math.cos(lat0 * Math.PI / 180) * 111320;
    const linea = tolerancia ? simplificado.map(([x, y]) => [lon0 + x / k, lat0 + y / 110540]) : eje.linea;
    return { ...eje, linea, vertices: linea.length, verticesOriginales: eje.vertices, toleranciaM: tolerancia ? tolerancia / 1.5 : 0 };
  }
  function kmlDeLinea(nombre, linea) {
    const coords = linea.map(([lon, lat]) => `${lon.toFixed(8)},${lat.toFixed(8)},0`).join(" ");
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>${escXml(nombre)}</name>
<Placemark>
<name>${escXml(nombre)}</name>
<LineString>
<tessellate>1</tessellate>
<altitudeMode>clampToGround</altitudeMode>
<coordinates>${coords}</coordinates>
</LineString>
</Placemark>
</Document>
</kml>
`;
  }
  var igual = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  function revisar(coords, info) {
    const conAltura = coords.some((c) => c.length > 2 && c[2] !== 0) || info.modo && info.modo !== "clampToGround";
    const cerrado = igual(coords[0], coords[coords.length - 1]);
    let duplicados = 0;
    for (let i = 1; i < coords.length; i++) if (igual(coords[i], coords[i - 1])) duplicados++;
    const anillo = limpiarAnillo(coords);
    const { puntos } = proyectar(anillo);
    const cruces = autoInterseccion(puntos);
    const lonLat = coords.every((c) => Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90);
    const problemas = [];
    if (info.origen === "linea") problemas.push("Es una línea, no un polígono: se cierra al limpiar (o úsala como eje de corredor).");
    if (conAltura) problemas.push("Trae altura o un modo de altitud distinto de «sobre el terreno».");
    if (info.hoyos) problemas.push(`Tiene ${info.hoyos} hoyo${info.hoyos > 1 ? "s" : ""} interior${info.hoyos > 1 ? "es" : ""}: el control no los usa y se quitan.`);
    if (!cerrado && info.origen === "poligono") problemas.push("El contorno no está cerrado.");
    if (duplicados) problemas.push(`${duplicados} vértice${duplicados > 1 ? "s" : ""} repetido${duplicados > 1 ? "s" : ""}.`);
    if (anillo.length > 200) problemas.push(`${anillo.length} vértices: muchos para el control; se simplifica.`);
    if (cruces) problemas.push("El contorno se cruza consigo mismo: hay que corregirlo a mano (no se arregla solo).");
    if (!lonLat) problemas.push("Las coordenadas no parecen latitud/longitud (WGS84). ¿Viene en UTM?");
    return { ...info, coords, anillo, vertices: anillo.length, area: areaM2(puntos), conAltura, cerrado, duplicados, cruces, lonLat, problemas };
  }
  function limpiarAnillo(coords) {
    const out = [];
    for (const c of coords) {
      const p = [c[0], c[1]];
      if (!out.length || !igual(out[out.length - 1], p)) out.push(p);
    }
    if (out.length > 1 && igual(out[0], out[out.length - 1])) out.pop();
    return out;
  }
  function seCruzan(a, b, c, d) {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  }
  function autoInterseccion(pts) {
    const n = pts.length;
    if (n > 3e3) return false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        if (seCruzan(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
      }
    }
    return false;
  }
  function dp(pts, tol) {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]];
    let max = 0, idx = 0;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    for (let i = 1; i < pts.length - 1; i++) {
      const d = L < 1e-9 ? Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]) : Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / L;
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max <= tol) return [a, b];
    return [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)];
  }
  function limpiarParaDji(pol, { maxVertices = 200 } = {}) {
    let anillo = limpiarAnillo(pol.coords);
    const { puntos, lat0, lon0 } = proyectar(anillo);
    let tolerancia = 0;
    let simplificado = puntos;
    if (puntos.length > maxVertices) {
      tolerancia = 0.05;
      const cerrado = [...puntos, puntos[0]];
      while (simplificado.length > maxVertices && tolerancia < 50) {
        const prueba = dp(cerrado, tolerancia).slice(0, -1);
        if (prueba.length < 3) break;
        simplificado = prueba;
        tolerancia *= 1.5;
      }
      const k = Math.cos(lat0 * Math.PI / 180) * 111320;
      anillo = simplificado.map(([x, y]) => [lon0 + x / k, lat0 + y / 110540]);
    }
    if (firmaArea(anillo) < 0) anillo = anillo.slice().reverse();
    return { ...pol, anillo, vertices: anillo.length, toleranciaM: tolerancia ? tolerancia / 1.5 : 0, verticesOriginales: pol.vertices };
  }
  function firmaArea(r) {
    let s = 0;
    for (let i = 0; i < r.length; i++) s += r[i][0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * r[i][1];
    return s / 2;
  }
  var escXml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
  function kmlDePoligono(nombre, anillo) {
    const coords = [...anillo, anillo[0]].map(([lon, lat]) => `${lon.toFixed(8)},${lat.toFixed(8)},0`).join(" ");
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>${escXml(nombre)}</name>
<Placemark>
<name>${escXml(nombre)}</name>
<Polygon>
<altitudeMode>clampToGround</altitudeMode>
<outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs>
</Polygon>
</Placemark>
</Document>
</kml>
`;
  }
  function nombreArchivoSeguro(t) {
    return (String(t || "area").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "area").slice(0, 60);
  }

  // modulos/vuelos/pronostico.js
  var MODELOS = [["ecmwf_ifs025", "ECMWF"], ["gfs_seamless", "GFS"], ["icon_seamless", "ICON"]];
  var VARIABLES = [
    "wind_speed_10m",
    "wind_speed_80m",
    "wind_speed_100m",
    "wind_speed_120m",
    "wind_direction_120m",
    "wind_direction_100m",
    "wind_gusts_10m",
    "precipitation",
    "precipitation_probability",
    "cloud_cover",
    "temperature_2m"
  ];
  async function pedirPronostico(lat, lon, dias = 3) {
    const url = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      hourly: VARIABLES.join(","),
      models: MODELOS.map((m) => m[0]).join(","),
      wind_speed_unit: "ms",
      timezone: "America/Santiago",
      forecast_days: String(dias),
      daily: "sunrise,sunset"
    });
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Open-Meteo respondió ${r.status}`);
    return ordenar(await r.json(), lat, lon);
  }
  function serie(h, variable, modelo) {
    return h[`${variable}_${modelo}`] || h[variable] || [];
  }
  var primero = (...vals) => {
    var _a;
    return (_a = vals.find((v) => v != null && isFinite(v))) != null ? _a : null;
  };
  function ordenar(json, lat, lon) {
    const h = json.hourly || {};
    const horas = (h.time || []).map((t, i) => {
      const porModelo = MODELOS.map(([m, nombre]) => {
        const v10 = serie(h, "wind_speed_10m", m)[i];
        const vAlt = primero(serie(h, "wind_speed_120m", m)[i], serie(h, "wind_speed_100m", m)[i], serie(h, "wind_speed_80m", m)[i]);
        const g10 = serie(h, "wind_gusts_10m", m)[i];
        const gAlt = g10 != null && vAlt != null && v10 ? Math.max(vAlt, g10 * vAlt / v10) : primero(g10);
        return {
          nombre,
          v: vAlt,
          g: gAlt,
          dir: primero(serie(h, "wind_direction_120m", m)[i], serie(h, "wind_direction_100m", m)[i]),
          lluvia: serie(h, "precipitation", m)[i],
          prob: serie(h, "precipitation_probability", m)[i],
          nubes: serie(h, "cloud_cover", m)[i],
          temp: serie(h, "temperature_2m", m)[i]
        };
      }).filter((x) => x.v != null);
      const prom = (k) => {
        const xs = porModelo.map((x) => x[k]).filter((v) => v != null && isFinite(v));
        return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
      };
      const vs = porModelo.map((x) => x.v);
      return {
        t,
        fecha: t.slice(0, 10),
        hora: Number(t.slice(11, 13)),
        v: prom("v"),
        vMin: vs.length ? Math.min(...vs) : null,
        vMax: vs.length ? Math.max(...vs) : null,
        g: prom("g"),
        dir: prom("dir"),
        lluvia: prom("lluvia"),
        prob: prom("prob"),
        nubes: prom("nubes"),
        temp: prom("temp"),
        modelos: porModelo.length,
        sol: elevacionSol(t, lat, lon)
      };
    });
    const d = json.daily || {};
    const serieDiaria = (nombre) => d[nombre] || d[Object.keys(d).find((k) => k.startsWith(nombre + "_")) || ""] || [];
    const salidas = serieDiaria("sunrise"), puestas = serieDiaria("sunset");
    const dias = (d.time || []).map((f, i) => ({ fecha: f, salida: salidas[i] || null, puesta: puestas[i] || null }));
    return { lat, lon, horas, dias, elevacionModelo: json.elevation };
  }
  async function pedirKp() {
    try {
      const r = await fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json");
      if (!r.ok) return null;
      const filas = await r.json();
      const aIso = (t) => {
        const x = String(t).trim().replace(" ", "T");
        return /Z|[+-]\d\d:?\d\d$/.test(x) ? x : x + "Z";
      };
      const kps = (Array.isArray(filas) ? filas : []).map((f) => {
        var _a, _b, _c;
        return Array.isArray(f) ? { t: f[0], kp: f[1] } : { t: f && ((_a = f.time_tag) != null ? _a : f.time), kp: f && ((_c = (_b = f.kp) != null ? _b : f.Kp) != null ? _c : f.kp_index) };
      }).filter((x) => x.t && x.t !== "time_tag" && x.kp != null && isFinite(Number(x.kp))).map((x) => ({ t: aIso(x.t), kp: Number(x.kp) }));
      return kps.length ? kps : null;
    } catch {
      return null;
    }
  }
  function kpEnHora(kps, horaLocalIso) {
    if (!kps || !kps.length) return null;
    const t = (/* @__PURE__ */ new Date(horaLocalIso + ":00-03:00")).getTime();
    const fila = kps.filter((k) => {
      const ini = new Date(k.t).getTime();
      return t >= ini && t < ini + 3 * 36e5;
    });
    return fila.length ? Math.max(...fila.map((f) => f.kp)) : null;
  }
  function elevacionSol(horaLocalIso, lat, lon) {
    const d = /* @__PURE__ */ new Date(horaLocalIso + ":00-03:00");
    const dia = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5;
    const g = 2 * Math.PI / 365 * (dia - 1 + (d.getUTCHours() - 12) / 24);
    const decl = 6918e-6 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 6758e-6 * Math.cos(2 * g) + 907e-6 * Math.sin(2 * g) - 2697e-6 * Math.cos(3 * g) + 148e-5 * Math.sin(3 * g);
    const eqt = 229.18 * (75e-6 + 1868e-6 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const minutosSolares = d.getUTCHours() * 60 + d.getUTCMinutes() + eqt + 4 * lon;
    const ha = (minutosSolares / 4 - 180) * Math.PI / 180;
    const la = lat * Math.PI / 180;
    const cosZ = Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha);
    return 90 - Math.acos(Math.min(1, Math.max(-1, cosZ))) * 180 / Math.PI;
  }
  function evaluarHora(h, dron, { kp = null, solMin = 0 } = {}) {
    if (h.sol != null && h.sol < solMin) return { estado: "noche", motivos: ["Sin luz suficiente"] };
    const no = [], marg = [];
    if (h.v != null && h.v > dron.vientoMaxMs) no.push(`Viento ${h.v.toFixed(1)} m/s`);
    else if (h.v != null && h.v > 0.8 * dron.vientoMaxMs) marg.push(`Viento ${h.v.toFixed(1)} m/s`);
    if (h.g != null && h.g > dron.rafagaMaxMs) no.push(`Ráfaga ${h.g.toFixed(1)} m/s`);
    else if (h.g != null && h.g > 0.8 * dron.rafagaMaxMs) marg.push(`Ráfaga ${h.g.toFixed(1)} m/s`);
    if (h.lluvia != null && h.lluvia >= 0.2) no.push("Lluvia");
    else if (h.prob != null && h.prob >= 40) marg.push(`Prob. lluvia ${Math.round(h.prob)} %`);
    if (h.vMax != null && h.vMin != null && h.vMax - h.vMin > 4) marg.push("Modelos no coinciden");
    if (h.temp != null && h.temp < 0) marg.push("Bajo 0 °C (baterías)");
    if (kp != null && kp >= 5) marg.push(`Kp ${kp} (GNSS)`);
    return { estado: no.length ? "no" : marg.length ? "marg" : "go", motivos: [...no, ...marg] };
  }
  var ENLACES_CONSULTA = [
    ["NOTAM — AIP Chile (oficial)", "https://aipchile.dgac.gob.cl/notam"],
    ["Mapa interactivo — AIP Chile", "https://aipchile.dgac.gob.cl/"],
    ["UAS Control (zonas)", "https://uascontrol.io/"],
    ["Visor de zonas — Vuelatudrone", "https://vuelatudrone.cl/visor-zonas-vuelo/index.html?v=2"],
    ["Windy", "https://www.windy.com/"]
  ];

  // modulos/vuelos/metar.js
  var AWC = "https://aviationweather.gov/api/data/metar";
  async function metarCercano(lat, lon) {
    const d = 1.1;
    const url = `${AWC}?${new URLSearchParams({ bbox: `${(lat - d).toFixed(2)},${(lon - d).toFixed(2)},${(lat + d).toFixed(2)},${(lon + d).toFixed(2)}`, format: "json", taf: "true", hours: "3" })}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`AWC respondió ${r.status}`);
    const lista = await r.json();
    if (!Array.isArray(lista) || !lista.length) return null;
    const km = (a, b, c, e) => Math.hypot((c - a) * 110.54, (e - b) * 111.32 * Math.cos(a * Math.PI / 180));
    const porEstacion = /* @__PURE__ */ new Map();
    for (const m2 of lista) {
      if (!m2 || !m2.icaoId) continue;
      const prev = porEstacion.get(m2.icaoId);
      if (!prev || String(m2.reportTime || m2.obsTime) > String(prev.reportTime || prev.obsTime)) porEstacion.set(m2.icaoId, m2);
    }
    const estaciones = [...porEstacion.values()].map((m2) => ({ ...m2, km: km(lat, lon, m2.lat, m2.lon) })).sort((a, b) => a.km - b.km);
    const m = estaciones[0];
    return { icao: m.icaoId, nombre: m.name || m.icaoId, km: m.km, metar: m.rawOb || "", taf: m.rawTaf || "", hora: m.reportTime || "", viento: vientoDeMetar(m.rawOb || "") };
  }
  function vientoDeMetar(raw) {
    const x = /\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)\b/.exec(raw);
    if (!x) return null;
    const f = x[4] === "KT" ? 0.5144 : 1;
    return { dir: x[1] === "VRB" ? null : Number(x[1]), v: Number(x[2]) * f, g: x[3] ? Number(x[3]) * f : null };
  }
  var enlaceMetar = (icao) => icao ? `https://aviationweather.gov/data/metar/?id=${icao}&taf=1` : "https://aipchile.dgac.gob.cl/";

  // modulos/vuelos/capas.js
  var TIPOS_CAPA = {
    aerodromo: { nombre: "Aeródromos", color: "#1D4ED8" },
    restringida: { nombre: "Zonas restringidas o prohibidas", color: "#B42318" },
    protegida: { nombre: "Áreas protegidas", color: "#3F7D3A" },
    referencia: { nombre: "Referencia (caminos, otros)", color: "#8A8F96" }
  };
  var cache = null;
  async function listarCapas() {
    if (cache) return cache;
    const deApp = [];
    try {
      const r = await fetch("vendor/capas/indice.json", { cache: "no-cache" });
      if (r.ok) {
        const indice = await r.json();
        for (const c of indice.capas || []) {
          try {
            const blob = await (await fetch(`vendor/capas/${c.archivo}`)).blob();
            const elementos = await elementosDeArchivo(new File([blob], c.archivo));
            deApp.push({ id: `app:${c.archivo}`, nombre: c.nombre, tipo: c.tipo, fecha: c.fecha || "", fuente: c.fuente || "", origen: "app", elementos });
          } catch (e) {
            console.warn("Capa no leída", c.archivo, e);
          }
        }
      }
    } catch {
    }
    const delUsuario = (await listarCapasUsuario()).map((c) => ({ ...c, origen: "usuario" }));
    cache = [...deApp, ...delUsuario];
    return cache;
  }
  function leerGeoJSON(json) {
    const out = [];
    const nombreDe = (p) => p && (p.name || p.nombre || p.Name || p.NOMBRE) || "";
    const agregar = (g, nombre) => {
      if (!g) return;
      if (g.type === "Point") out.push({ tipo: "punto", nombre, coords: g.coordinates.slice(0, 2) });
      else if (g.type === "MultiPoint") g.coordinates.forEach((c) => out.push({ tipo: "punto", nombre, coords: c.slice(0, 2) }));
      else if (g.type === "LineString") out.push({ tipo: "linea", nombre, coords: g.coordinates.map((c) => c.slice(0, 2)) });
      else if (g.type === "MultiLineString") g.coordinates.forEach((l) => out.push({ tipo: "linea", nombre, coords: l.map((c) => c.slice(0, 2)) }));
      else if (g.type === "Polygon") out.push({ tipo: "poligono", nombre, coords: g.coordinates[0].map((c) => c.slice(0, 2)) });
      else if (g.type === "MultiPolygon") g.coordinates.forEach((p) => out.push({ tipo: "poligono", nombre, coords: p[0].map((c) => c.slice(0, 2)) }));
      else if (g.type === "GeometryCollection") g.geometries.forEach((x) => agregar(x, nombre));
    };
    for (const f of json.features || []) agregar(f.geometry, nombreDe(f.properties));
    return out;
  }
  async function elementosDeArchivo(archivo) {
    if (/\.(geo)?json$/i.test(archivo.name)) return leerGeoJSON(JSON.parse(await archivo.text()));
    return leerCapa(await leerArchivo(archivo));
  }
  async function cargarCapaDesdeArchivo(archivo, tipo, nombre) {
    const elementos = await elementosDeArchivo(archivo);
    if (!elementos.length) throw new Error("El archivo no trae puntos, líneas ni polígonos.");
    await guardarCapaUsuario({ nombre: nombre || archivo.name.replace(/\.(kmz|kml|geojson|json)$/i, ""), tipo, fecha: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), fuente: archivo.name, elementos });
    cache = null;
    return elementos.length;
  }
  async function quitarCapa(id) {
    await borrarCapaUsuario(id);
    cache = null;
  }
  function revisarZonas(area, marco, capas, activas) {
    const A = area.map(marco.aXY);
    const resultados = [];
    for (const c of capas) {
      if (!activas.includes(c.id) || c.tipo === "referencia") continue;
      let mejor = null;
      for (const el of c.elementos) {
        const ref = el.tipo === "punto" ? el.coords : el.coords[0];
        const [x0, y0] = marco.aXY(ref);
        if (Math.hypot(x0, y0) > 6e4 + 5e4) continue;
        let d;
        if (el.tipo === "punto") d = distPuntoPoligono(marco.aXY(el.coords), A);
        else if (el.tipo === "poligono") d = distPoligonos(A, el.coords.map(marco.aXY));
        else {
          const L = el.coords.map(marco.aXY);
          d = Infinity;
          for (const p of A) for (let i = 0; i + 1 < L.length; i++) d = Math.min(d, distPuntoSegmento(p, L[i], L[i + 1]));
        }
        if (!mejor || d < mejor.distancia) mejor = { tipo: c.tipo, nombre: el.nombre || c.nombre, capa: c.nombre, distancia: d, toca: d === 0 };
      }
      if (mejor && mejor.distancia < 6e4) resultados.push(mejor);
    }
    return resultados.sort((a, b) => a.distancia - b.distancia);
  }

  // modulos/vuelos/graficos.js
  var COLOR_ESTADO = { go: "#0F766E", marg: "#C2410C", no: "#B42318", noche: "#B9B5AC" };
  var TEXTO_ESTADO = { go: "GO", marg: "Marg.", no: "NO", noche: "Luz" };
  function graficoPronostico(filas, dron) {
    if (!filas.length) return '<p class="sis-tenue">Sin horas para mostrar.</p>';
    const n = filas.length, W = Math.max(640, n * 46), X0 = 34, H = 190;
    const ymax = Math.max(16, Math.ceil((Math.max(...filas.map((f) => Math.max(f.h.g || 0, f.h.vMax || 0, f.h.v || 0))) + 1) / 2) * 2);
    const cw = (W - X0 - 6) / n;
    const y = (v) => 10 + (H - 22) * (1 - Math.min(v, ymax) / ymax);
    const partes = [];
    for (const val of [0, Math.round(ymax / 2), ymax]) partes.push(`<line x1="${X0}" x2="${W}" y1="${y(val).toFixed(1)}" y2="${y(val).toFixed(1)}" stroke="#EFEDE8"/><text x="${X0 - 6}" y="${(y(val) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#5B6168">${val}</text>`);
    const limite = (v, color, t) => `<line x1="${X0}" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${color}" stroke-dasharray="5 4"/><text x="${W - 4}" y="${(y(v) - 4).toFixed(1)}" text-anchor="end" font-size="11" fill="${color}">${t}</text>`;
    partes.push(limite(dron.rafagaMaxMs, "#B42318", `Ráfaga máx. ${fmt(dron.rafagaMaxMs, 0)}`));
    if (Math.abs(dron.vientoMaxMs - dron.rafagaMaxMs) > 0.6) partes.push(limite(dron.vientoMaxMs, "#C2410C", `Sostenido máx. ${fmt(dron.vientoMaxMs, 0)}`));
    const pts = [];
    filas.forEach((f, i) => {
      const cx = X0 + cw * i + cw / 2, h = f.h;
      if (h.vMin != null && h.vMax != null) partes.push(`<rect x="${(cx - cw * 0.32).toFixed(1)}" y="${y(h.vMax).toFixed(1)}" width="${(cw * 0.64).toFixed(1)}" height="${Math.max(1, y(h.vMin) - y(h.vMax)).toFixed(1)}" rx="3" fill="#1C1F23" fill-opacity="0.08"/>`);
      if (h.v != null) partes.push(`<rect x="${(cx - cw * 0.2).toFixed(1)}" y="${y(h.v).toFixed(1)}" width="${(cw * 0.4).toFixed(1)}" height="${(y(0) - y(h.v)).toFixed(1)}" rx="3" fill="${COLOR_ESTADO[f.ev.estado]}"><title>${String(h.hora).padStart(2, "0")}:00 · viento ${fmt(h.v, 1)} m/s · ráfaga ${fmt(h.g, 1)}</title></rect>`);
      if (h.g != null) pts.push(`${cx.toFixed(1)},${y(h.g).toFixed(1)}`);
    });
    if (pts.length) partes.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="#1C1F23" stroke-width="1.8"/>` + pts.map((p) => `<circle cx="${p.split(",")[0]}" cy="${p.split(",")[1]}" r="2.3" fill="#1C1F23"/>`).join(""));
    partes.push(`<text x="${X0 - 6}" y="8" text-anchor="end" font-size="10" fill="#5B6168">m/s</text>`);
    const svg2 = `<svg class="vu-graf-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Viento a 120 m por hora: barras de viento sostenido, línea de ráfaga y límites del dron">${partes.join("")}</svg>`;
    const celda = (contenido, marca) => `<div class="vu-graf-celda${marca ? " " + marca : ""}">${contenido}</div>`;
    const fila = (titulo, f) => `<div class="vu-graf-fila" style="grid-template-columns:${X0}px repeat(${n}, minmax(0,1fr))"><span class="vu-graf-tit">${titulo}</span>${filas.map(f).join("")}</div>`;
    const filasHtml = [
      fila("", (x) => celda(`<b>${String(x.h.hora).padStart(2, "0")}</b><span class="vu-graf-estado" style="background:${COLOR_ESTADO[x.ev.estado]}" title="${escapar(x.ev.motivos.join(" · "))}">${TEXTO_ESTADO[x.ev.estado]}</span>`)),
      fila("Dir.", (x) => celda(x.h.dir != null ? `<span class="vu-flecha" style="transform:rotate(${Math.round(x.h.dir + 180)}deg)" title="Viento desde ${Math.round(x.h.dir)}°">↑</span>` : "—")),
      fila("Lluvia", (x) => celda(x.h.prob != null ? `${fmt(x.h.prob)}%` : "—", x.h.lluvia >= 0.2 || x.h.prob >= 40 ? "azul" : "")),
      fila("Nubes", (x) => celda(`${fmt(x.h.nubes)}%`, x.h.nubes >= 50 ? "gris" : "")),
      fila("Temp.", (x) => celda(`${fmt(x.h.temp, 0)}°`, x.h.temp < 5 ? "azul" : "")),
      fila("Kp", (x) => celda(x.kp != null ? fmt(x.kp, 0) : "—", x.kp >= 4 ? "ambar" : ""))
    ].join("");
    return `<div class="vu-graf" style="--ancho:${W}px"><div class="vu-graf-interior" style="width:${W}px">${svg2}${filasHtml}</div></div>`;
  }
  function checklistClima(filas, dron) {
    const horasCon = (cond) => filas.filter(cond).map((f) => f.h.hora);
    const rango = (hs) => {
      if (!hs.length) return "";
      const grupos = [];
      let ini = hs[0], prev = hs[0];
      for (const h of hs.slice(1)) {
        if (h !== prev + 1) {
          grupos.push([ini, prev]);
          ini = h;
        }
        prev = h;
      }
      grupos.push([ini, prev]);
      return grupos.map(([a, b]) => a === b ? `${a} h` : `${a}–${b + 1} h`).join(", ");
    };
    const items = [
      [`Viento sostenido ≤ ${fmt(dron.vientoMaxMs, 0)} m/s`, horasCon((f) => f.h.v != null && f.h.v > dron.vientoMaxMs)],
      [`Ráfagas ≤ ${fmt(dron.rafagaMaxMs, 0)} m/s`, horasCon((f) => f.h.g != null && f.h.g > dron.rafagaMaxMs)],
      ["Sin lluvia", horasCon((f) => f.h.lluvia >= 0.2 || f.h.prob >= 40)],
      ["Nubosidad < 50 %", horasCon((f) => f.h.nubes >= 50)],
      ["Temperatura ≥ 5 °C (baterías)", horasCon((f) => f.h.temp != null && f.h.temp < 5)],
      ["Kp ≤ 4 (GNSS)", horasCon((f) => f.kp != null && f.kp > 4)],
      ["Luz (sol sobre 5°)", horasCon((f) => f.ev.estado === "noche")]
    ];
    return items.map(([t, malas]) => ({ texto: t, cumple: !malas.length, detalle: malas.length ? `No ${rango(malas)}` : "Cumple" }));
  }
  function esquemaSVG({ poligonos = [], lineas = [], puntos = [], etiquetas = [], borde = null }, { W = 640, H = 380 } = {}) {
    const todos2 = [...poligonos.flat(), ...lineas.flatMap((l) => l.pts), ...puntos.map((p) => p.xy)];
    if (!todos2.length) return "";
    const xs = todos2.map((p) => p[0]), ys = todos2.map((p) => p[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const m = 14, k = Math.min((W - 2 * m) / (maxx - minx || 1), (H - 2 * m) / (maxy - miny || 1));
    const ox = (W - (maxx - minx) * k) / 2, oy = (H - (maxy - miny) * k) / 2;
    const t = ([x, y]) => [ox + (x - minx) * k, H - (oy + (y - miny) * k)];
    const pl = (pts) => pts.map(t).map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
    const escala = (() => {
      const opciones = [10, 20, 50, 100, 200, 500, 1e3, 2e3, 5e3];
      const objetivo = W / 5 / k;
      const v = opciones.reduce((a, b) => Math.abs(b - objetivo) < Math.abs(a - objetivo) ? b : a);
      return { m: v, px: v * k };
    })();
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Esquema del área de vuelo">
    <rect width="${W}" height="${H}" fill="#FFFFFF"/>
    ${borde ? `<polygon points="${pl(borde)}" fill="none" stroke="#8A8F96" stroke-dasharray="5 4"/>` : ""}
    ${poligonos.map((p, i) => `<polygon points="${pl(p)}" fill="${["#E1F5FE", "#F1F8E9", "#FFFDE7", "#FFEBEE", "#F3E5F5", "#E0F2F1"][i % 6]}" stroke="#E8611C" stroke-width="2"/>`).join("")}
    ${lineas.map((l) => `<polyline points="${pl(l.pts)}" fill="none" stroke="${l.color}" stroke-width="1.4"/>`).join("")}
    ${puntos.map((p) => {
      const [x, y] = t(p.xy);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#1C1F23" stroke="#fff" stroke-width="2"/>`;
    }).join("")}
    ${etiquetas.map((e) => {
      const [x, y] = t(e.xy);
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="14" font-weight="700" text-anchor="middle" fill="#1C1F23" stroke="#fff" stroke-width="3" paint-order="stroke">${escapar(e.texto)}</text>`;
    }).join("")}
    <g transform="translate(${W - 30},28)"><path d="M0 -16 L6 2 L0 -3 L-6 2 Z" fill="#1C1F23"/><text y="16" font-size="11" text-anchor="middle">N</text></g>
    <g transform="translate(16,${H - 16})"><line x1="0" x2="${escala.px.toFixed(1)}" y1="0" y2="0" stroke="#1C1F23" stroke-width="2"/><text x="${(escala.px / 2).toFixed(1)}" y="-5" font-size="11" text-anchor="middle">${escala.m >= 1e3 ? fmt(escala.m / 1e3, 0) + " km" : escala.m + " m"}</text></g>
  </svg>`;
  }

  // modulos/vuelos/hoja.js
  var R_LAT2 = 110540;
  var R_LON2 = 111320;
  var PARAMS_INICIALES = {
    modo: "foto",
    porGsd: true,
    gsd: 2.5,
    altura: 100,
    traslapeFrontal: 80,
    traslapeLateral: 70,
    velocidad: "",
    exposicion: 1e3,
    reserva: 25,
    minDespegue: 3,
    minCambio: 5,
    segGiro: 8
  };
  var DOCUMENTOS_DGAC = [
    ["kmz", "KMZ de la zona"],
    ["carta", "Carta o autorización del mandante"],
    ["seguro", "Seguro aprobado por la JAC"],
    ["credencial", "Credencial del piloto vigente"],
    ["inscripcion", "Inscripción del dron"]
  ];
  var CONSULTAS = [
    ["notam", "NOTAM en AIP Chile", "https://aipchile.dgac.gob.cl/notam"],
    ["aip", "Mapa interactivo AIP Chile", "https://aipchile.dgac.gob.cl/"]
  ];
  function nuevaHoja({ proyectoId = "", personaId = null, dronId = "m4e" } = {}) {
    return {
      nombre: "",
      proyectoId: proyectoId || null,
      fecha: hoyISO(),
      pilotoId: personaId,
      estado: "borrador",
      dronId,
      params: { ...PARAMS_INICIALES },
      area: {
        tipo: null,
        original: null,
        eje: null,
        archivo: "",
        margen: 0,
        rectas: true,
        corredor: { izq: 40, der: 40, mismo: true, invertir: false },
        cortes: [],
        sectores: [],
        sel: 0
      },
      clima: null,
      permisos: { dgac: { preparado: "", enviado: "", aprobado: "", vence: "", numero: "" }, docs: {}, consultas: [] },
      viento: []
    };
  }
  function migrarHoja(p) {
    if (p.area) {
      const h2 = nuevaHoja();
      return { ...h2, ...p, params: { ...PARAMS_INICIALES, ...p.params }, area: { ...h2.area, ...p.area, corredor: { ...h2.area.corredor, ...p.area.corredor || {} } }, permisos: { ...h2.permisos, ...p.permisos || {}, dgac: { ...h2.permisos.dgac, ...(p.permisos || {}).dgac || {} } } };
    }
    const h = nuevaHoja({ proyectoId: p.proyectoId, dronId: p.dronId || "m4e" });
    const { despegue = null, rumbo = "", dronId, areaHa, ...params } = p.params || {};
    return {
      ...h,
      id: p.id,
      nombre: p.nombre || "",
      creadoEn: p.creadoEn,
      creadoPor: p.creadoPor,
      dronId: p.dronId || dronId || "m4e",
      params: { ...PARAMS_INICIALES, ...params },
      area: { ...h.area, tipo: p.poligono ? "poligono" : null, original: p.poligono ? { nombre: p.poligono.nombre, anillo: p.poligono.anillo } : null, archivo: p.poligono ? "guardado en el plan" : "", sectores: [{ despegue, rumbo }], areaHa: areaHa || "" }
    };
  }
  function marcoDe(coords) {
    const { lat0, lon0 } = proyectar(coords);
    const k = Math.cos(lat0 * Math.PI / 180) * R_LON2;
    return {
      lat0,
      lon0,
      aXY: ([lon, lat]) => [(lon - lon0) * k, (lat - lat0) * R_LAT2],
      aLonLat: ([x, y]) => [lon0 + x / k, lat0 + y / R_LAT2],
      aLatLng: ([x, y]) => [lat0 + y / R_LAT2, lon0 + x / k]
    };
  }
  var centroide = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  var cacheGeo = { clave: "", valor: null };
  function geometria(hoja2) {
    const a = hoja2.area;
    const fuente = a.tipo === "corredor" ? a.eje && a.eje.linea : a.original && a.original.anillo;
    if (!fuente || fuente.length < 2) return null;
    const clave = JSON.stringify([a.tipo, fuente.length, fuente[0], fuente[fuente.length - 1], a.margen, a.rectas, a.corredor, a.cortes]);
    if (cacheGeo.clave === clave) return cacheGeo.valor;
    const marco = marcoDe(fuente);
    const cortes = (a.cortes || []).map((c) => c.map(marco.aXY));
    let valor;
    if (a.tipo === "corredor") {
      let eje = fuente.map(marco.aXY);
      if (a.corredor.invertir) eje = eje.slice().reverse();
      const izq = Number(a.corredor.izq) || 0, der = a.corredor.mismo ? izq : Number(a.corredor.der) || 0;
      const tramos = cortarEje(eje, cortes);
      const sectores = tramos.map((t) => ({ eje: t, poligono: poligonoCorredor(t, izq, der), largo: largo(t) }));
      sectores.forEach((s) => {
        s.area = areaM2(s.poligono);
      });
      valor = { marco, tipo: "corredor", eje, izq, der, vuelo: poligonoCorredor(eje, izq, der), original: null, sectores, fallidos: cortes.length && tramos.length < cortes.length + 1 ? ["algún corte no cruza el eje"] : [] };
    } else {
      const original = fuente.map(marco.aXY);
      const vuelo = Number(a.margen) > 0 ? margenPoligono(original, Number(a.margen), { rectas: a.rectas !== false }) : original;
      const { sectores, fallidos } = aplicarCortes(vuelo, cortes);
      valor = { marco, tipo: "poligono", original, vuelo, sectores: sectores.map((p) => ({ poligono: p, area: areaM2(p) })), fallidos };
    }
    valor.areaVuelo = areaM2(valor.vuelo);
    cacheGeo = { clave, valor };
    return valor;
  }
  function metaSector(hoja2, i) {
    const s = hoja2.area.sectores;
    while (s.length <= i) s.push({ despegue: null, rumbo: "", nombre: "" });
    return s[i];
  }
  function nombreSector(hoja2, i, total) {
    const m = hoja2.area.sectores[i];
    if (m && m.nombre) return m.nombre;
    return total > 1 ? `S${i + 1}` : "Área completa";
  }
  var alturaDe = (P, d) => P.porGsd ? alturaParaGsd(d, Number(P.gsd) || 1) : Number(P.altura) || 1;
  function baseCalculo(hoja2, d, extra = {}) {
    const P = hoja2.params;
    return {
      dron: d,
      modo: P.modo === "lidar" && d.lidar ? "lidar" : "foto",
      altura: alturaDe(P, d),
      traslapeFrontal: (Number(P.traslapeFrontal) || 0) / 100,
      traslapeLateral: (Number(P.traslapeLateral) || 0) / 100,
      exposicion: 1 / (Number(P.exposicion) || 1e3),
      reserva: (Number(P.reserva) || 0) / 100,
      minDespegue: Number(P.minDespegue) || 0,
      minCambio: Number(P.minCambio) || 0,
      segGiro: Number(P.segGiro) || 0,
      fotosEnLidar: false,
      ...extra
    };
  }
  function calcularSector(hoja2, d, geo, i, extra = {}) {
    const sec = geo.sectores[i];
    if (!sec) return null;
    const meta = metaSector(hoja2, i);
    const geomSector = geo.tipo === "corredor" ? { eje: sec.eje, izq: geo.izq, der: geo.der } : { puntos: sec.poligono, rumbo: meta.rumbo === "" || meta.rumbo == null ? void 0 : Number(meta.rumbo) };
    const despegue = meta.despegue ? geo.marco.aXY(meta.despegue) : centroide(sec.poligono);
    const b = baseCalculo(hoja2, d, { ...geomSector, despegue, ...extra });
    const P = hoja2.params;
    if (extra.velocidad) return { ...calcularPlan(b), velocidad: extra.velocidad, despegueXY: despegue, altura: b.altura, modo: b.modo };
    const previo = calcularPlan({ ...b, velocidad: 10 });
    const sugerida = Math.floor(previo.velSugerida * 10) / 10;
    const velocidad = Number(P.velocidad) || sugerida;
    return { ...calcularPlan({ ...b, velocidad }), velocidad, sugerida, auto: !Number(P.velocidad), despegueXY: despegue, modo: b.modo, altura: b.altura };
  }
  function totales(hoja2, d, geo) {
    if (!geo || !d) return null;
    const rs = geo.sectores.map((_, i) => calcularSector(hoja2, d, geo, i));
    return {
      sectores: rs,
      baterias: rs.reduce((s, r) => s + (r ? r.vuelos : 0), 0),
      minVuelo: rs.reduce((s, r) => s + (r ? r.minMision : 0), 0),
      minJornada: rs.reduce((s, r) => s + (r ? r.minTotal : 0), 0),
      fotos: rs.reduce((s, r) => s + (r ? r.fotos : 0), 0),
      gsd: rs[0] ? rs[0].gsd : gsdCm(d, alturaDe(hoja2.params, d)),
      altura: rs[0] ? rs[0].altura : alturaDe(hoja2.params, d),
      excede: rs.some((r) => r && r.baterias.some((b) => b.excede))
    };
  }
  function diasHabiles(desde, hasta) {
    if (!desde || !hasta) return null;
    let n = 0;
    const d = /* @__PURE__ */ new Date(desde + "T12:00:00"), f = /* @__PURE__ */ new Date(hasta + "T12:00:00");
    if (f <= d) return 0;
    while (d < f) {
      d.setDate(d.getDate() + 1);
      const w = d.getDay();
      if (w !== 0 && w !== 6) n++;
    }
    return n;
  }
  function estadoPermiso(hoja2) {
    const g = hoja2.permisos.dgac;
    if (g.aprobado) {
      if (g.vence && g.vence < hoja2.fecha) return { texto: "Vencido", nivel: "aviso", detalle: `venció ${g.vence}` };
      return { texto: "Aprobado", nivel: "ok", detalle: g.vence ? `vigente hasta ${g.vence}` : "sin fecha de término" };
    }
    if (g.enviado) {
      const h = diasHabiles(g.enviado, hoja2.fecha);
      return { texto: "Enviado", nivel: "aviso", detalle: h != null && h < 7 ? `solo ${h} días hábiles antes del vuelo (piden 7)` : "esperando respuesta" };
    }
    if (g.preparado) return { texto: "En preparación", nivel: "aviso", detalle: "falta enviarlo" };
    return { texto: "Sin iniciar", nivel: "gris", detalle: "mín. 7 días hábiles antes" };
  }
  function resumenHoja(hoja2, d, geo) {
    const t = totales(hoja2, d, geo);
    if (!t) return null;
    return { area: geo.areaVuelo, gsd: hoja2.params.modo === "lidar" ? null : t.gsd, altura: t.altura, vuelos: t.baterias, minTotal: t.minJornada, fotos: t.fotos, sectores: geo.sectores.length, corredor: geo.tipo === "corredor", modo: hoja2.params.modo, densidad: t.sectores[0] ? t.sectores[0].densidad : null };
  }

  // modulos/vuelos/pantallas.js
  var HERRAMIENTAS = [["hojas", "Hojas de vuelo"], ["rapido", "Pronóstico rápido"], ["kml", "Limpiar KML"], ["drones", "Drones"]];
  var PASOS = [["resumen", "Resumen"], ["area", "1 · Área"], ["vuelo", "2 · Vuelo"], ["clima", "3 · Clima"], ["permisos", "4 · Permisos"]];
  var COLORES_BATERIA = ["#4FC3F7", "#C6F15A", "#FFD54F", "#FF8A80", "#CE93D8", "#80CBC4", "#FFAB40", "#B0BEC5"];
  var COLORES_SECTOR = ["#4FC3F7", "#C6F15A", "#FFD54F", "#FF8A80", "#CE93D8", "#80CBC4"];
  var GSD_TABLA = [3, 2.5, 2, 1.5];
  var CENTRO_CHILE = [-33, -70.6];
  var ESRI = (s) => `https://server.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/{z}/{y}/{x}`;
  var ESTADOS_HOJA = { borrador: ["Borrador", "gris"], lista: ["Lista para volar", "verde"], volada: ["Volada", "azul"] };
  var UMBRAL_BATERIAS = 6;
  var TIPO_KML = "application/vnd.google-earth.kml+xml";
  var leerLS = (k, d) => {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  };
  var escribirLS = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
    }
  };
  var dosD = (n) => String(n).padStart(2, "0");
  function montarPantallas2(contenedor2, ctx2) {
    fijarPersona2(ctx2.personaId || null);
    const raiz = document.createElement("div");
    raiz.className = "mod-vuelos";
    contenedor2.appendChild(raiz);
    let activo2 = true;
    const st = {
      vista: ctx2.planId || ctx2.proyectoId ? "hoja" : ctx2.tab || "hojas",
      paso: "resumen",
      hoja: null,
      candidatos: null,
      dibujo: null,
      // { modo: 'area'|'eje'|'corte', puntos: [] }
      leyendaAbierta: false,
      velA: 5,
      velB: 10,
      gsdExtra: [],
      pron: null,
      pronError: "",
      pronCargando: false,
      kps: null,
      dia: null,
      metar: null,
      metarError: "",
      rapLat: "",
      rapLon: "",
      rapOrigen: "",
      rapDron: "m4e",
      kml: null,
      kmlError: "",
      maxVertices: 200,
      capas: null,
      capasActivas: leerLS("vu_capas_activas", null),
      mensaje: null,
      filtroProyecto: ctx2.proyectoId || ""
    };
    let drones = [], proyectos2 = [], personas2 = [], hojas = [];
    const avisar2 = (texto3, tipo = "ok") => {
      st.mensaje = { texto: texto3, tipo };
    };
    const dron = () => drones.find((d) => d.id === (st.hoja && st.hoja.dronId)) || drones[0];
    const familias = () => [...new Map(drones.map((d) => [d.familia || d.id, d.familiaNombre || d.nombre])).entries()];
    const geo = () => st.hoja ? geometria(st.hoja) : null;
    const nomProy = (id) => !id ? "Sin proyecto" : id === OFICINA_ID ? "Oficina" : (proyectos2.find((p) => p.id === id) || {}).nombre || "Proyecto";
    const nomPers = (id) => (personas2.find((p) => p.id === id) || {}).nombre || "";
    const secSel = () => {
      const g = geo();
      return g ? Math.max(0, Math.min(st.hoja.area.sel || 0, g.sectores.length - 1)) : 0;
    };
    const capasActivas = () => st.capasActivas || (st.capas || []).map((c) => c.id);
    async function cargarBase() {
      [drones, proyectos2, personas2, hojas] = await Promise.all([listarDrones(), listarProyectos(), listarPersonas(), listarPlanes()]);
      hojas = hojas.map(migrarHoja);
    }
    let timerGuardar = null;
    const hayContenido = (h) => !!(h.id || h.nombre || h.area.original || h.area.eje);
    function programarGuardado() {
      clearTimeout(timerGuardar);
      timerGuardar = setTimeout(guardarAhora, 700);
    }
    async function guardarAhora() {
      clearTimeout(timerGuardar);
      const h = st.hoja;
      if (!h || !hayContenido(h)) return;
      const g = geometria(h), d = dron();
      const nombre = h.nombre || h.area.original && h.area.original.nombre || h.area.eje && h.area.eje.nombre || "Hoja de vuelo";
      const { problemas, ...area } = h.area;
      const r = await guardarPlan({ ...h, area: { ...area, problemas }, nombre, dronId: h.dronId, schemaVersion: 2, resumen: g && d ? resumenHoja(h, d, g) : null });
      const nueva = !h.id;
      h.id = r.id;
      h.creadoEn = r.creadoEn;
      if (!h.nombre) h.nombre = nombre;
      if (nueva && activo2) try {
        history.replaceState(null, "", `#/vuelos/plan/${r.id}`);
      } catch {
      }
      const marca = raiz.querySelector("#vu-guardado");
      if (marca) marca.textContent = "Guardado";
    }
    function cambio() {
      const m = raiz.querySelector("#vu-guardado");
      if (m) m.textContent = "Guardando…";
      programarGuardado();
    }
    async function abrirHoja(id) {
      const p = id ? await obtenerPlan(id) : null;
      st.hoja = p ? migrarHoja(p) : nuevaHoja({ proyectoId: ctx2.proyectoId || st.filtroProyecto, personaId: ctx2.personaId });
      st.paso = p ? "resumen" : "area";
      st.pron = null;
      st.metar = null;
      st.metarError = "";
      st.dia = null;
      st.candidatos = null;
      st.dibujo = null;
      st.gsdExtra = [];
      st.vista = "hoja";
      for (const m of Object.values(mapas)) m.encuadre = null;
    }
    const chip = (t, clase = "gris") => `<span class="sis-chip ${clase}">${t}</span>`;
    const campo = (nombre, etiqueta, valor, extra = "", sufijo = "") => `<label class="sis-campo"><span>${etiqueta}</span>
    <span class="vu-con-sufijo"><input name="${nombre}" value="${escapar(valor)}" inputmode="decimal" ${extra}>${sufijo ? `<em>${sufijo}</em>` : ""}</span></label>`;
    const deslizador = (nombre, etiqueta, valor, { min, max, paso, sufijo, nota = "" }) => `<div class="vu-desl">
      <div class="vu-desl-cab"><label for="vu-${nombre}">${etiqueta}${nota ? ` <small>${nota}</small>` : ""}</label>
        <span class="vu-desl-valor"><input type="number" data-espejo="${nombre}" value="${escapar(valor)}" step="${paso}" min="${min}" max="${max}" aria-label="${etiqueta}">${sufijo}</span></div>
      <input type="range" id="vu-${nombre}" name="${nombre}" min="${min}" max="${max}" step="${paso}" value="${escapar(valor)}">
    </div>`;
    const opcionesProyectos = (sel) => `<option value="">Sin proyecto</option>` + proyectos2.map((p) => `<option value="${escapar(p.id)}" ${p.id === sel ? "selected" : ""}>${escapar(p.id === OFICINA_ID ? "Oficina" : p.nombre)}</option>`).join("");
    const kpi = (t, v, d = "", clase = "") => `<div class="vu-kpi ${clase}"><span>${t}</span><b>${v}</b>${d ? `<small>${d}</small>` : ""}</div>`;
    const fila = (t, v) => `<div><dt>${t}</dt><dd>${v}</dd></div>`;
    const fechaHora = (iso) => new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
    function vistaHojas() {
      const lista = hojas.filter((h) => !st.filtroProyecto || h.proyectoId === st.filtroProyecto);
      return `<div class="sis-cab"><h1>Hojas de vuelo</h1><button class="sis-btn primario" data-accion="nueva-hoja">+ Nueva hoja de vuelo</button></div>
      <p class="sis-tenue">Una hoja por trabajo de vuelo: área, plan de vuelo, clima y permisos en un solo lugar, con la hoja para terreno.</p>
      <label class="sis-campo vu-filtro"><span>Proyecto</span><select data-campo="filtroProyecto"><option value="">Todos</option>${proyectos2.map((p) => `<option value="${escapar(p.id)}" ${p.id === st.filtroProyecto ? "selected" : ""}>${escapar(p.id === OFICINA_ID ? "Oficina" : p.nombre)}</option>`).join("")}</select></label>
      <section class="sis-tarjeta">${lista.length ? `<div class="sis-lista">${lista.map((h) => {
        const r = h.resumen || {};
        const [et, cl] = ESTADOS_HOJA[h.estado] || ESTADOS_HOJA.borrador;
        return `<div class="sis-fila"><span class="sis-fila-txt"><b>${escapar(h.nombre || "Hoja sin nombre")}</b>
          <span class="sis-tenue">${escapar(nomProy(h.proyectoId))} · ${h.fecha ? fechaLegible(h.fecha) : "sin fecha"}${h.pilotoId ? ` · ${escapar(nomPers(h.pilotoId))}` : ""}</span>
          <span class="sis-chips">${chip(et, cl)}${r.area ? chip(`${fmt(r.area / 1e4, 1)} ha`) : ""}${r.sectores > 1 ? chip(`${r.sectores} sectores`) : ""}${r.corredor ? chip("Corredor") : ""}${r.vuelos ? chip(`${r.vuelos} batería${r.vuelos > 1 ? "s" : ""} · ${fmtDuracion(r.minTotal)}`, "azul") : ""}</span></span>
          <span class="sis-acciones"><button class="sis-btn chico" data-accion="abrir-hoja" data-id="${h.id}">Abrir</button>
          <button class="sis-btn chico peligro" data-accion="eliminar-hoja" data-id="${h.id}">Eliminar</button></span></div>`;
      }).join("")}</div>` : '<div class="sis-vacio"><p>Todavía no hay hojas de vuelo. Crea una y carga el KMZ del área (o la línea del corredor).</p></div>'}</section>`;
    }
    const consultasHechas = (h) => CONSULTAS.every(([k]) => h.permisos.consultas.some((c) => c.tipo === k));
    const ultimaConsulta = (h, tipo) => h.permisos.consultas.filter((c) => c.tipo === tipo).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    function encabezadoHoja() {
      const h = st.hoja, g = geo(), d = dron(), t = g && d ? totales(h, d, g) : null;
      const [et, cl] = ESTADOS_HOJA[h.estado] || ESTADOS_HOJA.borrador;
      const perm = estadoPermiso(h);
      const c = h.clima;
      const climaObs = c && c.checklist && c.checklist.some((x) => !x.cumple);
      const marcas = {
        area: g ? g.fallidos.length ? "aviso" : "ok" : "",
        vuelo: t ? t.excede ? "aviso" : "ok" : "",
        clima: c ? climaObs ? "aviso" : "ok" : "",
        permisos: perm.nivel === "ok" && consultasHechas(h) ? "ok" : h.permisos.dgac.preparado || h.permisos.consultas.length ? "aviso" : ""
      };
      return `<div class="sis-encabezado vu-hoja-cab">
        <div>
          <div class="sis-miga"><a href="#/vuelos" data-accion="volver-lista">Hojas de vuelo</a>${h.proyectoId ? ` / <a href="#/proyecto/${escapar(h.proyectoId)}">${escapar(nomProy(h.proyectoId))}</a>` : ""}</div>
          <h1>Hoja de vuelo · ${escapar(h.nombre || "sin nombre")}</h1>
          <div class="sis-meta">
            <span>Fecha: <b>${h.fecha ? fechaLegible(h.fecha) : "—"}</b></span>
            <span>Piloto: <b>${escapar(nomPers(h.pilotoId) || "—")}</b></span>
            <span>Dron: <b>${escapar(d ? (d.familiaNombre || d.nombre).replace("DJI ", "") : "—")}</b></span>
            ${t ? `<span>${h.params.modo === "lidar" ? "LiDAR" : "Fotogrametría"} · GSD ${fmt(t.gsd, 2)} cm · ${fmt(t.altura, 0)} m</span>` : ""}
            <span class="sis-tenue" id="vu-guardado">${h.id ? "Guardado" : "Se guarda sola al cargar el área o ponerle nombre"}</span>
          </div>
        </div>
        <div class="sis-acciones">${chip(et, cl)}
          <button class="sis-btn chico" data-accion="imprimir" ${g ? "" : "disabled"}>Hoja para terreno (PDF)</button>
          ${h.estado === "borrador" ? '<button class="sis-btn chico primario" data-accion="estado" data-e="lista">Marcar lista</button>' : h.estado === "lista" ? '<button class="sis-btn chico primario" data-accion="estado" data-e="volada">Marcar volada</button>' : '<button class="sis-btn chico" data-accion="estado" data-e="borrador">Volver a borrador</button>'}
        </div>
      </div>
      <div class="vu-tira">
        ${kpi("Área de vuelo", g ? `${fmt(g.areaVuelo / 1e4, 1)} ha` : "—", g ? g.tipo === "corredor" ? `corredor de ${fmt(g.izq + g.der, 0)} m` : Number(h.area.margen) ? `+${h.area.margen} m de margen` : "sin margen" : "falta el área")}
        ${kpi("Vuelo", t ? `${t.baterias} bat. · ${fmtDuracion(t.minVuelo)}` : "—", t ? `jornada ${fmtDuracion(t.minJornada)}${g.sectores.length > 1 ? ` · ${g.sectores.length} sectores` : ""}` : "", t && t.excede ? "alerta" : "")}
        ${kpi("Ventana GO", c ? c.ventana || "Sin ventana" : "—", c ? fechaLegible(c.fecha) : "consulta el clima", c ? c.ventana ? "bien" : "alerta" : "")}
        ${kpi("Ráfaga máx.", c && c.rafaga ? `${fmt(c.rafaga.v, 1)} m/s` : "—", c && c.rafaga ? `${dosD(c.rafaga.hora)}:00 · límite ${d ? fmt(d.rafagaMaxMs, 0) : "—"}` : "", c && c.rafaga && d && c.rafaga.v > d.rafagaMaxMs ? "alerta" : "")}
        ${kpi("Kp · luz", c ? `${c.kpMax != null ? fmt(c.kpMax, 0) : "—"} · ${c.sol ? c.sol.join("–") : "—"}` : "—", c ? "Kp ≤ 4 para GNSS" : "")}
        ${kpi("Permiso DGAC", perm.texto, perm.detalle, perm.nivel === "ok" ? "bien" : perm.nivel === "aviso" ? "alerta" : "")}
      </div>
      <nav class="vu-pasos" aria-label="Pasos de la hoja">${PASOS.map(([k, t2]) => `<button class="vu-paso${st.paso === k ? " activo" : ""}" data-accion="paso" data-paso="${k}">${t2}${marcas[k] === "ok" ? ' <i class="vu-ok" aria-label="listo">✓</i>' : marcas[k] === "aviso" ? ' <i class="vu-alerta" aria-label="revisar">!</i>' : ""}</button>`).join("")}</nav>`;
    }
    function vistaResumen() {
      const h = st.hoja, g = geo(), d = dron(), t = g && d ? totales(h, d, g) : null, c = h.clima, perm = estadoPermiso(h);
      const cab = (n, titulo, estado3, clase, paso, accion) => `<div class="vu-res-cab"><span class="vu-num">${n}</span><h2>${titulo}</h2>${estado3 ? chip(estado3, clase) : ""}<button class="vu-link" data-accion="paso" data-paso="${paso}">${accion} →</button></div>`;
      const zonas = g ? zonasDeHoja() : [];
      const climaObs = c && c.checklist && c.checklist.some((x) => !x.cumple);
      return `<section class="sis-tarjeta vu-datos-hoja"><h2>Datos de la hoja</h2>
        <div class="vu-datos-grilla">
          <label class="sis-campo"><span>Nombre</span><input data-hoja="nombre" value="${escapar(h.nombre)}" placeholder="El Pimiento — vuelo 1"></label>
          <label class="sis-campo"><span>Proyecto</span><select data-hoja="proyectoId">${opcionesProyectos(h.proyectoId)}</select></label>
          <label class="sis-campo"><span>Fecha del vuelo</span><input type="date" data-hoja="fecha" value="${escapar(h.fecha || "")}"></label>
          <label class="sis-campo"><span>Piloto</span><select data-hoja="pilotoId"><option value="">—</option>${personas2.map((p) => `<option value="${escapar(p.id)}" ${p.id === h.pilotoId ? "selected" : ""}>${escapar(p.nombre)}</option>`).join("")}</select></label>
        </div>
      </section>
      <div class="vu-res-grilla">
        <section class="sis-tarjeta">${cab(1, "Área", g ? g.fallidos.length ? "Revisar cortes" : "Lista" : "Falta el área", g ? g.fallidos.length ? "ambar" : "verde" : "gris", "area", g ? "Editar área" : "Cargar área")}
          ${g ? `<dl class="vu-tabla">
            ${fila("Origen", escapar(h.area.archivo || "—"))}
            ${g.tipo === "corredor" ? fila("Corredor", `${fmt(g.izq, 0)} m izq. · ${fmt(g.der, 0)} m der. · ${fmt(g.sectores.reduce((s, x) => s + x.largo, 0) / 1e3, 2)} km`) : fila("Margen", Number(h.area.margen) ? `+${h.area.margen} m · ${fmt(areaM2(g.original) / 1e4, 2)} → ${fmt(g.areaVuelo / 1e4, 2)} ha` : "sin margen")}
            ${fila("Sectores", g.sectores.length > 1 ? g.sectores.map((_, i) => escapar(nombreSector(h, i, g.sectores.length))).join(" · ") : "uno (área completa)")}
            ${fila("Zonas", zonas === null ? "sin capas cargadas" : zonas.length ? zonas.slice(0, 2).map((z) => `${z.toca ? '<b class="vu-rojo">toca</b> ' : ""}${escapar(z.nombre)}${z.toca ? "" : ` a ${fmt(z.distancia / 1e3, 1)} km`}`).join(" · ") : "no toca zonas cargadas")}
          </dl>` : '<p class="sis-tenue">Carga el KMZ/KML del área (o la línea del corredor), o dibújala en el mapa.</p>'}
        </section>
        <section class="sis-tarjeta">${cab(2, "Vuelo", t ? t.excede ? "Revisar" : "Listo" : "", t ? t.excede ? "ambar" : "verde" : "gris", "vuelo", "Ajustar")}
          ${t ? `<div class="vu-mini-kpis">${kpi("GSD", `${fmt(t.gsd, 2)} cm`)}${kpi("Altura", `${fmt(t.altura, 0)} m`)}${kpi("Baterías", t.baterias)}${kpi("Fotos", fmt(t.fotos))}</div>
            <dl class="vu-tabla">${fila("Traslapes · velocidad", `${h.params.traslapeFrontal}/${h.params.traslapeLateral} % · ${t.sectores[0] ? fmt(t.sectores[0].velocidad, 1) : "—"} m/s${h.params.velocidad === "" ? " (sugerida)" : ""}`)}
            ${fila("En el aire · jornada", `${fmtDuracion(t.minVuelo)} · ${fmtDuracion(t.minJornada)}`)}
            ${g.sectores.length > 1 ? fila("Por sector", t.sectores.map((r, i) => `${escapar(nombreSector(h, i, g.sectores.length))} ${r ? fmtDuracion(r.minTotal) : "—"}`).join(" · ")) : ""}</dl>` : '<p class="sis-tenue">Cuando cargues el área, aquí aparece el plan de vuelo.</p>'}
        </section>
        <section class="sis-tarjeta">${cab(3, "Clima", c ? climaObs ? "Con observaciones" : "Cumple" : "", c ? climaObs ? "ambar" : "verde" : "gris", "clima", c ? "Ver pronóstico" : "Consultar")}
          ${c ? `<p class="sis-tenue">Consultado ${fechaHora(c.consultadoEn)} para el ${fechaLegible(c.fecha)}.</p>
            <dl class="vu-tabla">${(c.checklist || []).map((x) => fila(escapar(x.texto), `<span class="${x.cumple ? "vu-verde" : "vu-rojo"}">${escapar(x.detalle)}</span>`)).join("")}
            ${c.metar ? fila(`METAR ${escapar(c.metar.icao)}`, `a ${fmt(c.metar.km, 0)} km`) : ""}</dl>` : '<p class="sis-tenue">Consulta el pronóstico del día del vuelo: viento a 120 m, ráfagas, lluvia, nubes, temperatura, Kp y METAR.</p>'}
        </section>
        <section class="sis-tarjeta">${cab(4, "Permisos y consultas", perm.texto, perm.nivel === "ok" ? "verde" : perm.nivel === "aviso" ? "ambar" : "gris", "permisos", "Abrir")}
          <dl class="vu-tabla">
            ${fila("Solicitud DGAC", `${escapar(perm.texto)} · ${escapar(perm.detalle)}`)}
            ${fila("Documentos", `${DOCUMENTOS_DGAC.filter(([k]) => h.permisos.docs[k]).length} de ${DOCUMENTOS_DGAC.length}`)}
            ${CONSULTAS.map(([k, tt]) => {
        const x = ultimaConsulta(h, k);
        return fila(tt, x ? `Revisado ${fechaHora(x.fecha)}` : '<span class="vu-rojo">Pendiente</span>');
      }).join("")}
          </dl>
        </section>
      </div>`;
    }
    function zonasDeHoja() {
      const g = geo();
      if (!g || !st.capas || !st.capas.length) return null;
      return revisarZonas(g.vuelo.map(g.marco.aLonLat), g.marco, st.capas, capasActivas());
    }
    function vistaArea() {
      const h = st.hoja, a = h.area, g = geo(), d = dron(), t = g && d ? totales(h, d, g) : null;
      const grande = t && (t.baterias > UMBRAL_BATERIAS || t.excede) && g.sectores.length === 1;
      return `${grande ? `<div class="vu-banner"><div><b>El área es grande: ${fmt(g.areaVuelo / 1e4, 0)} ha · ${t.baterias} baterías · unas ${fmtDuracion(t.minVuelo)} de vuelo</b>
        <span>${t.excede ? "Parte del recorrido queda más lejos de lo que alcanza una batería desde el despegue. " : ""}Dividirla en sectores te deja planificar por día o por punto de despegue, con un rumbo y un KML para cada uno.</span></div>
        <button class="sis-btn primario" data-accion="dibujar" data-modo="corte">Dividir en sectores</button></div>` : ""}
      <div class="vu-dos">
        <div class="vu-izquierda">
          <section class="sis-tarjeta"><h2>Origen</h2>
            <div class="sis-acciones">
              <label class="sis-btn vu-archivo">Cargar KML / KMZ<input type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" data-archivo="area" hidden></label>
              <button class="sis-btn${st.dibujo && st.dibujo.modo === "area" ? " primario" : ""}" data-accion="dibujar" data-modo="area">Dibujar área</button>
              <button class="sis-btn${st.dibujo && st.dibujo.modo === "eje" ? " primario" : ""}" data-accion="dibujar" data-modo="eje">Dibujar eje</button>
            </div>
            ${st.candidatos ? vistaCandidatos() : ""}
            ${a.tipo ? `<p class="sis-tenue vu-area-info">${escapar(a.archivo || "")} · ${a.tipo === "corredor" ? `eje de ${fmt((a.eje.largo || 0) / 1e3, 2)} km · ${a.eje.linea.length} vértices` : `${fmt(areaM2(proyectar(a.original.anillo).puntos) / 1e4, 2)} ha · ${a.original.anillo.length} vértices`}</p>
              ${(a.problemas || []).length ? `<div class="vu-aviso"><b>Detalles que se corrigen al descargar:</b><ul>${a.problemas.map((p) => `<li>${escapar(p)}</li>`).join("")}</ul></div>` : ""}
              <div class="sis-acciones"><button class="sis-btn chico" data-accion="kml-original">Descargar ${a.tipo === "corredor" ? "eje" : "área del mandante"} limpio (KML)</button></div>` : ""}
          </section>
          ${a.tipo === "poligono" ? `<section class="sis-tarjeta"><h2>Margen</h2>
            ${deslizador("margen", "Margen hacia afuera", a.margen || 0, { min: 0, max: 100, paso: 1, sufijo: "m" })}
            <div class="vu-pildoras">${[0, 20, 30, 50].map((m) => `<button type="button" class="vu-pildora${Number(a.margen) === m ? " activo" : ""}" data-accion="margen" data-m="${m}">${m ? `${m} m` : "Sin margen"}</button>`).join("")}</div>
            <label class="sis-check"><input type="checkbox" data-area="rectas" ${a.rectas !== false ? "checked" : ""}> Esquinas rectas (como se hace a mano)</label>
            <p class="sis-tenue" id="vu-margen-info">${g ? `${fmt(areaM2(g.original) / 1e4, 2)} ha → <b>${fmt(g.areaVuelo / 1e4, 2)} ha</b> de vuelo` : ""}</p>
          </section>` : ""}
          ${a.tipo === "corredor" ? `<section class="sis-tarjeta"><h2>Corredor</h2>
            ${deslizador("izq", a.corredor.mismo ? "Ancho a cada lado" : "Hacia la izquierda", a.corredor.izq, { min: 5, max: 300, paso: 1, sufijo: "m" })}
            ${a.corredor.mismo ? "" : deslizador("der", "Hacia la derecha", a.corredor.der, { min: 5, max: 300, paso: 1, sufijo: "m" })}
            <label class="sis-check"><input type="checkbox" data-area="mismo" ${a.corredor.mismo ? "checked" : ""}> Mismo ancho a los dos lados</label>
            ${a.corredor.mismo ? "" : '<button class="sis-btn chico" data-accion="invertir">Invertir izquierda y derecha</button>'}
            <p class="sis-tenue" id="vu-margen-info">${g ? textoCorredor(g) : ""}</p>
          </section>` : ""}
          ${g ? `<section class="sis-tarjeta"><h2>Sectores</h2><div id="vu-sectores">${htmlSectores()}</div>
            <div class="sis-acciones">
              <button class="sis-btn chico${st.dibujo && st.dibujo.modo === "corte" ? " primario" : ""}" data-accion="dibujar" data-modo="corte">✎ Trazar corte</button>
              ${a.cortes.length ? '<button class="sis-btn chico" data-accion="deshacer-corte">Deshacer último corte</button><button class="sis-btn chico" data-accion="quitar-cortes">Quitar todos</button>' : ""}
            </div>
            <p class="sis-tenue">Traza el corte por un camino, quebrada o cerco: toca afuera del área, sigue el borde tocando puntos y termina afuera. Los vértices blancos se pueden arrastrar.</p>
          </section>` : ""}
          <section class="sis-tarjeta"><h2>Zonas de referencia</h2><div id="vu-zonas">${htmlZonas()}</div></section>
        </div>
        <div class="vu-derecha">
          <div class="vu-mapa-caja"><div class="vu-mapa-lugar" data-mapa="area"></div><div class="vu-mapa-barra" id="vu-barra-area">${barraDibujo()}</div></div>
          <p class="sis-tenue vu-pie">Punteado blanco: área del mandante · naranjo: área de vuelo · colores: sectores · puntos azules: aeródromos. Imagen Esri con nombres y caminos.</p>
        </div>
      </div>`;
    }
    const textoCorredor = (g) => `${fmt(g.izq + g.der, 0)} m × ${fmt(g.sectores.reduce((s, x) => s + x.largo, 0) / 1e3, 2)} km = <b>${fmt(g.areaVuelo / 1e4, 2)} ha</b>. Las pasadas siguen el eje.`;
    function vistaCandidatos() {
      const c = st.candidatos;
      const contornos = c.poligonos.filter((p) => !p.abierta);
      return `<div class="vu-candidatos"><p><b>${escapar(c.archivo)}</b> trae ${contornos.length ? `${contornos.length} contorno${contornos.length > 1 ? "s" : ""}` : ""}${contornos.length && c.ejes.length ? " y " : ""}${c.ejes.length ? `${c.ejes.length} línea${c.ejes.length > 1 ? "s" : ""} abierta${c.ejes.length > 1 ? "s" : ""}` : ""}. ¿Cuál uso?</p>
      <div class="sis-lista">${c.ejes.map((e, i) => {
        const j = c.poligonos.findIndex((p) => p.abierta && p.nombre === e.nombre);
        return `<div class="sis-fila"><span class="sis-fila-txt"><b>${escapar(e.nombre)}</b><span class="sis-tenue">Línea de ${fmt(e.largo / 1e3, 2)} km · ${e.vertices} vértices</span></span>
          <span class="sis-acciones"><button class="sis-btn chico primario" data-accion="usar-eje" data-i="${i}">Como eje de corredor</button>${j >= 0 ? `<button class="sis-btn chico" data-accion="usar-pol" data-i="${j}">Cerrarla como contorno</button>` : ""}</span></div>`;
      }).join("")}
        ${contornos.map((p) => {
        const i = c.poligonos.indexOf(p);
        return `<div class="sis-fila"><span class="sis-fila-txt"><b>${escapar(p.nombre)}</b><span class="sis-tenue">${fmt(p.area / 1e4, 2)} ha · ${p.vertices} vértices</span></span>
          <span class="sis-acciones"><button class="sis-btn chico primario" data-accion="usar-pol" data-i="${i}">Usar este contorno</button></span></div>`;
      }).join("")}</div>
      <button class="vu-link" data-accion="cerrar-candidatos">Cancelar</button></div>`;
    }
    function htmlSectores() {
      const h = st.hoja, g = geo(), d = dron();
      if (!g) return "";
      const t = d ? totales(h, d, g) : null;
      return `${g.fallidos.length ? '<div class="vu-aviso">Un corte no atraviesa el área de lado a lado y no se aplicó: arrastra sus puntos o deshazlo.</div>' : ""}
      <div class="vu-sectores">${g.sectores.map((s, i) => {
        const r = t && t.sectores[i];
        return `<div class="vu-sector">
        <i style="background:${COLORES_SECTOR[i % COLORES_SECTOR.length]}"></i>
        ${g.sectores.length > 1 ? `<input class="vu-sector-nombre" data-sector-nombre="${i}" value="${escapar(h.area.sectores[i] && h.area.sectores[i].nombre || "")}" placeholder="S${i + 1}" aria-label="Nombre del sector ${i + 1}">` : "<b>Área completa</b>"}
        <span class="vu-sector-dato">${fmt(s.area / 1e4, 1)} ha${r ? ` · ${r.vuelos} bat. · ${fmtDuracion(r.minTotal)}` : ""}</span>
        <span class="vu-sector-acc">${g.sectores.length > 1 ? `<button class="vu-link" data-accion="kml-sector" data-i="${i}">KML</button>` : ""}<button class="vu-link" data-accion="ir-sector" data-i="${i}">volar →</button></span>
      </div>`;
      }).join("")}</div>
      ${g.sectores.length > 1 && t ? `<p class="vu-total">Total: ${g.sectores.length} sectores · ${t.baterias} baterías · ${fmtDuracion(t.minJornada)} de jornada</p>
        <div class="sis-acciones"><button class="sis-btn chico" data-accion="kml-sectores">Descargar KML de cada sector</button></div>` : ""}`;
    }
    function htmlZonas() {
      const capas = st.capas || [];
      const form = `<div class="vu-capa-form"><select data-campo="tipoCapa" aria-label="Tipo de capa">${Object.entries(TIPOS_CAPA).map(([k, v]) => `<option value="${k}">${v.nombre}</option>`).join("")}</select>
      <label class="sis-btn chico vu-archivo">+ Cargar capa (KMZ, KML o JSON)<input type="file" accept=".kml,.kmz,.json,.geojson" data-archivo="capa" hidden></label></div>`;
      if (!capas.length) return `<p class="sis-tenue">Aún no hay capas. Carga los archivos de aeródromos, zonas restringidas (DGAC) o áreas protegidas (CONAF) y se revisan contra el área.</p>${form}`;
      const activas = capasActivas();
      const zonas = zonasDeHoja();
      return `${zonas && zonas.length ? `<div class="vu-zonas-res">${zonas.slice(0, 4).map((z) => `<div class="${z.toca ? "vu-rojo" : ""}"><i style="background:${TIPOS_CAPA[z.tipo].color}"></i><span>${z.toca ? "<b>Toca</b> " : ""}${escapar(z.nombre)}${z.toca ? "" : ` · a ${fmt(z.distancia / 1e3, 1)} km`}<small>${escapar(z.capa)}</small></span></div>`).join("")}</div>` : geo() ? '<p class="vu-verde">No hay zonas cargadas a menos de 60 km.</p>' : ""}
      <fieldset class="vu-capas"><legend>Capas</legend>${capas.map((c) => `<label class="sis-check"><input type="checkbox" data-capa="${escapar(c.id)}" ${activas.includes(c.id) ? "checked" : ""}><i style="background:${TIPOS_CAPA[c.tipo].color}"></i>${escapar(c.nombre)} <small>${escapar(c.fecha || "")}${c.origen === "usuario" ? " · cargada aquí" : ""}</small>${c.origen === "usuario" ? ` <button class="vu-link" data-accion="quitar-capa" data-id="${escapar(c.id)}">quitar</button>` : ""}</label>`).join("")}</fieldset>
      ${form}
      <p class="sis-tenue">Referencial. La información aeronáutica oficial está en AIP Chile (DGAC).</p>`;
    }
    function barraDibujo() {
      const dib2 = st.dibujo;
      if (!dib2) return st.hoja && !geo() ? '<span class="vu-barra-txt">Carga un KML/KMZ o dibuja el área o el eje.</span>' : "";
      const min = dib2.modo === "area" ? 3 : 2;
      const txt = { area: "Toca el mapa para marcar los vértices del área", eje: "Toca el mapa siguiendo el eje del corredor", corte: "Toca afuera del área, sigue el camino y termina afuera" }[dib2.modo];
      return `<span class="vu-barra-txt">${txt} · ${dib2.puntos.length} punto${dib2.puntos.length === 1 ? "" : "s"}</span>
      <button type="button" class="vu-barra-btn" data-accion="dibujo-deshacer" ${dib2.puntos.length ? "" : "disabled"}>Deshacer</button>
      <button type="button" class="vu-barra-btn fuerte" data-accion="dibujo-terminar" ${dib2.puntos.length >= min ? "" : "disabled"}>Terminar</button>
      <button type="button" class="vu-barra-btn" data-accion="dibujo-cancelar">Cancelar</button>`;
    }
    function vistaVuelo() {
      const h = st.hoja, P = h.params, d = dron(), g = geo();
      if (!g) return `<section class="sis-tarjeta sis-vacio"><p>Primero carga o dibuja el área.</p><button class="sis-btn primario" data-accion="paso" data-paso="area">Ir a Área</button></section>`;
      const i = secSel();
      const r = calcularSector(h, d, g, i);
      const fam = d.familia || d.id;
      const sensores = drones.filter((x) => (x.familia || x.id) === fam);
      const altura = alturaDe(P, d), gsd = gsdCm(d, altura);
      const vMax = d.velocidadMaxMs;
      return `${g.sectores.length > 1 ? `<div class="vu-sector-chips">${g.sectores.map((_, k) => `<button class="vu-pildora${k === i ? " activo" : ""}" data-accion="ir-sector" data-i="${k}"><i style="background:${COLORES_SECTOR[k % COLORES_SECTOR.length]}"></i>${escapar(nombreSector(h, k, g.sectores.length))}</button>`).join("")}<span class="sis-tenue" id="vu-total-hoja">${htmlTotalHoja()}</span></div>` : ""}
      <div class="vu-dos">
        <div class="vu-izquierda">
          <form class="sis-form vu-form" data-form="plan" autocomplete="off">
          <section class="sis-tarjeta"><h2>Dron y vuelo</h2>
            <div class="${sensores.length > 1 ? "sis-par" : ""}">
              <label class="sis-campo"><span>Dron</span><select name="familia">${familias().map(([k, tt]) => `<option value="${escapar(k)}" ${k === fam ? "selected" : ""}>${escapar(tt)}</option>`).join("")}</select></label>
              ${sensores.length > 1 ? `<label class="sis-campo"><span>Sensor</span><select name="dronId">${sensores.map((x) => `<option value="${x.id}" ${x.id === h.dronId ? "selected" : ""}>${escapar(x.sensor || x.nombre)}</option>`).join("")}</select></label>` : ""}
            </div>
            ${d.lidar ? `<div class="sis-campo"><span>Producto</span><div class="sis-opciones">
              <label class="sis-opcion"><input type="radio" name="modo" value="foto" ${P.modo !== "lidar" ? "checked" : ""}> Fotogrametría</label>
              <label class="sis-opcion"><input type="radio" name="modo" value="lidar" ${P.modo === "lidar" ? "checked" : ""}> LiDAR</label></div></div>` : ""}
            <div class="vu-enlazados">
              ${deslizador("gsd", "GSD", Math.round(gsd * 100) / 100, { min: 0.5, max: 8, paso: 0.05, sufijo: "cm/px" })}
              ${deslizador("altura", "Altura", Math.round(altura), { min: 15, max: 400, paso: 1, sufijo: "m", nota: "(enlazada al GSD)" })}
            </div>
            ${deslizador("traslapeFrontal", "Traslape frontal", P.traslapeFrontal, { min: 40, max: 90, paso: 1, sufijo: "%" })}
            ${deslizador("traslapeLateral", "Traslape lateral", P.traslapeLateral, { min: 20, max: 90, paso: 1, sufijo: "%" })}
            ${deslizador("velocidad", "Velocidad", Math.min(vMax, Math.round((r ? r.velocidad : 5) * 10) / 10), { min: 1, max: vMax, paso: 0.1, sufijo: "m/s", nota: P.velocidad === "" ? "(sugerida)" : "" })}
            <div class="vu-desl-pie" id="vu-vel-pie">${pieVelocidad(r)}</div>
            <details class="vu-detalles"><summary>Supuestos de terreno y cámara</summary>
              <div class="sis-par">${campo("reserva", "Reserva por batería", P.reserva, "", "%")}${campo("minDespegue", "Despegue y aterrizaje", P.minDespegue, "", "min")}</div>
              <div class="sis-par">${campo("minCambio", "Cambio de batería", P.minCambio, "", "min")}${campo("segGiro", "Giro entre líneas", P.segGiro, "", "s")}</div>
              ${campo("exposicion", "Exposición 1/…", P.exposicion, "", "s")}
            </details>
          </section>
          </form>
          <section class="sis-tarjeta"><h2>Exportar</h2>
            <div class="sis-acciones">
              ${g.tipo === "corredor" ? `<button class="sis-btn primario" data-accion="kml-eje-sector" data-i="${i}">Descargar eje (KML para el control)</button><button class="sis-btn" data-accion="kml-sector" data-i="${i}">Corredor como polígono</button>` : `<button class="sis-btn primario" data-accion="kml-sector" data-i="${i}">Descargar KML${g.sectores.length > 1 ? " del sector" : ""}</button>`}
            </div>
            <p class="sis-tenue">${g.tipo === "corredor" ? "En DJI Pilot 2 usa el eje con el modo corredor y el mismo ancho; aquí se simulan las pasadas, el tiempo y las baterías." : "El KML es el área de vuelo (con margen), limpio para el control."}</p>
          </section>
        </div>
        <div class="vu-derecha">
          <div id="vu-kpis">${htmlKpis(r)}</div>
          <div class="vu-mapa-caja">
            <div class="vu-mapa-lugar" data-mapa="vuelo"></div>
            <div class="vu-mapa-barra" id="vu-barra">${htmlBarraRumbo(r)}</div>
            <div class="vu-leyenda-mapa" id="vu-leyenda">${htmlLeyenda(r)}</div>
          </div>
          <p class="sis-tenue vu-pie">Arrastra el punto para cambiar el despegue: el tiempo incluye ir y volver desde él en cada batería.</p>
          <div id="vu-detalle">${htmlDetalle(r)}</div>
        </div>
      </div>`;
    }
    function htmlTotalHoja() {
      const g = geo(), t = totales(st.hoja, dron(), g);
      return t ? `Hoja completa: ${t.baterias} baterías · ${fmtDuracion(t.minJornada)}` : "";
    }
    function pieVelocidad(r) {
      if (!r) return "";
      const lim = r.limites.map(([t, v]) => `${t} ${fmt(v, 1)}`).join(" · ");
      return `<span>Sugerida ${fmt(r.sugerida, 1)} m/s · límites: ${lim} m/s</span>${r.auto ? "" : ' <button type="button" class="vu-link" data-accion="vel-auto">usar la sugerida</button>'}`;
    }
    function htmlKpis(r) {
      if (!r) return "";
      return `<div class="vu-kpis">
      ${kpi("Altura", `${fmt(r.altura, 0)} m`, "", r.altura > 120 ? "alerta" : "")}
      ${r.densidad ? kpi("Densidad", `${fmt(r.densidad, 0)} pts/m²`) : kpi("GSD", `${fmt(r.gsd, 2)} cm`)}
      ${kpi(r.corredor ? "Pasadas" : "Líneas", fmt(r.nLineas))}
      ${r.modo === "foto" ? kpi("Fotos", fmt(r.fotos)) : kpi("Velocidad", `${fmt(r.velocidad, 1)} m/s`)}
      ${kpi("En el aire", fmtDuracion(r.minMision))}
      ${kpi("Baterías", fmt(r.vuelos), "", r.baterias.some((b) => b.excede) ? "alerta" : "")}
      ${kpi("Jornada", fmtDuracion(r.minTotal))}
    </div>`;
    }
    function htmlBarraRumbo(r) {
      if (!r) return "";
      if (r.corredor) return `<span class="vu-barra-txt">Corredor · ${fmt(r.nLineas)} pasada${r.nLineas === 1 ? "" : "s"} siguiendo el eje</span>`;
      const meta = metaSector(st.hoja, secSel());
      const auto = meta.rumbo === "" || meta.rumbo == null;
      return `<span class="vu-barra-txt">Rumbo ${fmt(r.rumbo, 0)}°${auto ? " · lado más largo" : ""}</span>
      <button type="button" class="vu-barra-btn" data-accion="rumbo" data-d="-5" aria-label="Girar las líneas 5 grados a la izquierda">⟲ 5°</button>
      <button type="button" class="vu-barra-btn" data-accion="rumbo" data-d="5" aria-label="Girar las líneas 5 grados a la derecha">⟳ 5°</button>
      <button type="button" class="vu-barra-btn" data-accion="rumbo" data-d="90">90°</button>
      <button type="button" class="vu-barra-btn fuerte" data-accion="rumbo-corto">Más corto</button>
      ${auto ? "" : '<button type="button" class="vu-barra-btn" data-accion="rumbo-auto">Auto</button>'}`;
    }
    function htmlLeyenda(r) {
      if (!r || !r.baterias.length) return "";
      const n = r.baterias.length;
      if (r.baterias.some((b) => b.excede)) return `<div class="vu-leyenda-caja alerta"><b>Hay tramos que no alcanzan con una batería</b><span>Acerca el despegue o divide el área en sectores.</span></div>`;
      const item = (b, i) => `<span class="vu-ley-item"><i style="background:${COLORES_BATERIA[i % COLORES_BATERIA.length]}"></i>B${i + 1}<em>${fmt(b.min, 0)}′</em></span>`;
      const total = `${n} batería${n > 1 ? "s" : ""} · ${fmtDuracion(r.minMision)}`;
      if (n <= 6) return `<div class="vu-leyenda-caja"><b>${total}</b><div class="vu-ley-lista">${r.baterias.map(item).join("")}<span class="vu-ley-item"><i class="vu-punto"></i>Despegue</span></div></div>`;
      if (!st.leyendaAbierta) return `<button type="button" class="vu-leyenda-caja plegada" data-accion="leyenda"><span class="vu-ley-colores">${COLORES_BATERIA.slice(0, 4).map((c) => `<i style="background:${c}"></i>`).join("")}</span><b>${total}</b> ▾</button>`;
      return `<div class="vu-leyenda-caja"><button type="button" class="vu-ley-cab" data-accion="leyenda"><b>${total}</b><span>▴ ocultar</span></button><div class="vu-ley-lista dos">${r.baterias.map(item).join("")}</div></div>`;
    }
    function htmlDetalle(r) {
      if (!r) return "";
      return `${r.avisos.length ? `<div class="vu-aviso"><ul>${r.avisos.map((a) => `<li>${escapar(a)}</li>`).join("")}</ul></div>` : ""}
      ${r.modo === "foto" ? htmlTablaGsd(r) : ""}
      <details class="vu-detalles"><summary>Detalle del cálculo</summary>
      <dl class="vu-tabla">
        ${fila("Área del sector", `${fmt(r.area / 1e4, 2)} ha`)}
        ${fila("Huella de la foto", `${fmt(r.huellaAncho, 0)} × ${fmt(r.huellaLargo, 0)} m`)}
        ${r.barrido ? fila("Ancho de barrido LiDAR", `${fmt(r.barrido, 0)} m`) : ""}
        ${fila(`Separación entre ${r.corredor ? "pasadas" : "líneas"}`, `${fmt(r.sepLineas, 1)} m · ${fmt(r.nLineas)}`)}
        ${r.modo === "foto" ? fila("Distancia entre fotos", `${fmt(r.sepFotos, 1)} m · cada ${fmt(r.intervalo, 1)} s`) : fila("Densidad en una pasada", `${fmt(r.densidadPasada, 0)} pts/m²`)}
        ${fila("Distancia de vuelo", `${fmt(r.distancia / 1e3, 2)} km`)}
        ${r.trasladoM ? fila("Traslado desde el despegue (ida y vuelta)", `${fmt(r.trasladoM / 1e3, 2)} km`) : ""}
        ${fila("Velocidad", `${fmt(r.velocidad, 1)} m/s${r.auto ? " (sugerida)" : ""}`)}
        ${fila("Tiempo útil por batería", `${fmt(r.minUtiles, 0)} min`)}
      </dl>
      <p class="sis-tenue">Estimación para planificar y cotizar. El GSD es sobre el punto de despegue: con desnivel cambia. El vuelo se programa en DJI Pilot 2.</p>
      </details>`;
    }
    function opcionesGsd(r) {
      const h = st.hoja, d = dron(), g = geo(), i = secSel();
      const actual = Math.round(r.gsd * 100) / 100;
      const lista = [.../* @__PURE__ */ new Set([...GSD_TABLA, ...st.gsdExtra, actual])].sort((a, b) => b - a);
      return lista.map((gs) => {
        const altura = alturaParaGsd(d, gs);
        const a = calcularSector(h, d, g, i, { altura, modo: "foto", velocidad: st.velA });
        const z = calcularSector(h, d, g, i, { altura, modo: "foto", velocidad: st.velB });
        return { gsd: gs, altura, actual: Math.abs(gs - actual) < 5e-3, a, z, sobre120: altura > 120 };
      });
    }
    function htmlTablaGsd(r) {
      const filas = opcionesGsd(r);
      return `<section class="sis-tarjeta vu-opciones">
      <div class="vu-opciones-cab"><h2>Opciones por GSD</h2>
        <label class="vu-vel">Velocidades <input type="number" data-vel="velA" value="${st.velA}" min="1" max="25" step="0.5" aria-label="Velocidad A"> y <input type="number" data-vel="velB" value="${st.velB}" min="1" max="25" step="0.5" aria-label="Velocidad B"> m/s</label></div>
      <div class="vu-tabla-scroll"><table class="vu-gsd">
        <thead><tr><th>GSD (cm/px)</th><th>Altura (m)</th><th>Tiempo a ${fmt(st.velA, 1)} m/s</th><th>Baterías</th><th>Tiempo a ${fmt(st.velB, 1)} m/s</th><th>Baterías</th><th></th></tr></thead>
        <tbody>${filas.map((f) => `<tr class="${f.actual ? "actual" : ""}${f.sobre120 ? " sobre120" : ""}">
          <td>${fmt(f.gsd, 2)}${f.actual ? " · actual" : ""}</td><td>${fmt(f.altura, 0)}${f.sobre120 ? " ⚠" : ""}</td>
          <td>${fmtDuracion(f.a.minMision)}${st.velA > f.a.velSugerida + 0.05 ? ' <span class="vu-ojo" title="Sobre la velocidad sugerida para este GSD">*</span>' : ""}</td><td>${f.a.vuelos}</td>
          <td>${fmtDuracion(f.z.minMision)}${st.velB > f.z.velSugerida + 0.05 ? ' <span class="vu-ojo" title="Sobre la velocidad sugerida para este GSD">*</span>' : ""}</td><td>${f.z.vuelos}</td>
          <td><button type="button" class="vu-link" data-accion="usar-gsd" data-g="${f.gsd}">usar</button>${GSD_TABLA.includes(f.gsd) || f.actual ? "" : ` <button type="button" class="vu-link" data-accion="quitar-gsd" data-g="${f.gsd}" aria-label="Quitar">✕</button>`}</td>
        </tr>`).join("")}</tbody></table></div>
      <div class="vu-opciones-pie">
        <span class="vu-agregar"><input type="number" data-campo="gsdNuevo" placeholder="GSD" step="0.1" min="0.3" max="10" aria-label="GSD a agregar"><button type="button" class="sis-btn chico" data-accion="agregar-gsd">+ GSD</button></span>
        <button type="button" class="sis-btn chico" data-accion="copiar-tabla">Copiar para correo</button>
        <button type="button" class="sis-btn chico" data-accion="excel-tabla">Descargar Excel</button>
      </div>
      <p class="sis-tenue">Tiempo en el aire${geo().sectores.length > 1 ? " del sector" : ""} con el dron y traslapes del plan. ⚠ sobre 120 m: requiere autorización DGAC. * sobre la velocidad sugerida.</p>
    </section>`;
    }
    function filasDelDia(p, d, dia) {
      return p.horas.filter((x) => x.fecha === dia && x.hora >= 6 && x.hora <= 21).map((x) => ({ h: x, kp: kpEnHora(st.kps, x.t) })).map((x) => ({ ...x, ev: evaluarHora(x.h, d, { kp: x.kp, solMin: 5 }) }));
    }
    function mejorVentana(filas) {
      let mejor = null, ini = null;
      filas.forEach((f, i) => {
        if (f.ev.estado === "go") {
          if (ini == null) ini = i;
        }
        if (f.ev.estado !== "go" || i === filas.length - 1) {
          const fin = f.ev.estado === "go" ? i : i - 1;
          if (ini != null && (!mejor || fin - ini > mejor[1] - mejor[0])) mejor = [ini, fin];
          if (f.ev.estado !== "go") ini = null;
        }
      });
      return mejor ? [filas[mejor[0]].h.hora, filas[mejor[1]].h.hora] : null;
    }
    function analizarDia(p, d) {
      const dias = [...new Set(p.horas.map((x) => x.fecha))];
      if (!st.dia || !dias.includes(st.dia)) st.dia = st.hoja && dias.includes(st.hoja.fecha) ? st.hoja.fecha : dias[0];
      const filas = filasDelDia(p, d, st.dia);
      const ventana = mejorVentana(filas);
      const sol = p.dias.find((x) => x.fecha === st.dia);
      const kps = filas.map((f) => f.kp).filter((k) => k != null);
      const enVentana = ventana ? filas.filter((f) => f.h.hora >= ventana[0] && f.h.hora <= ventana[1]) : filas.filter((f) => f.ev.estado !== "noche");
      const chk = checklistClima(enVentana.length ? enVentana : filas, d);
      return { dias, filas, ventana, sol, kps, chk };
    }
    function bloquePronostico(p, d, origen) {
      var _a;
      const b = analizarDia(p, d);
      const html = `<div class="vu-pron-origen"><b>${escapar(origen)}</b><span class="sis-tenue">${fmt(p.lat, 5)}, ${fmt(p.lon, 5)}${p.elevacionModelo != null ? ` · ${fmt(p.elevacionModelo, 0)} m s. n. m. (modelo)` : ""}</span></div>
        <div class="vu-dias">${b.dias.map((x) => `<button class="sis-menu-chip${x === st.dia ? " activo" : ""}" data-accion="dia" data-dia="${x}">${fechaLegible(x)}${st.hoja && x === st.hoja.fecha ? " · vuelo" : ""}</button>`).join("")}</div>
        <div class="vu-resumen-dia">
          ${b.ventana ? chip(`Ventana GO ${dosD(b.ventana[0])}:00 – ${dosD(b.ventana[1] + 1)}:00`, "verde") : chip("Sin ventana GO este día", "rojo")}
          ${chip(`Sol ${b.sol && b.sol.salida ? b.sol.salida.slice(11, 16) : "—"} – ${b.sol && b.sol.puesta ? b.sol.puesta.slice(11, 16) : "—"}`)}
          ${chip(b.kps.length ? `Kp máx. ${fmt(Math.max(...b.kps), 0)}` : "Kp sin dato")}
        </div>
        <p class="sis-tenue vu-graf-ley">Barra: viento sostenido a 120 m (color = estado) · línea: ráfaga estimada · banda gris: diferencia entre ECMWF, GFS e ICON.</p>
        ${graficoPronostico(b.filas, d)}
        <p class="sis-tenue">Promedio de ${((_a = p.horas[0]) == null ? void 0 : _a.modelos) || 0} modelos; si la banda es ancha, el pronóstico es inseguro. ${st.kps ? "Kp: NOAA, ventanas de 3 h." : "No se pudo leer el Kp de NOAA."} Modelos globales: en valles y faenas de cordillera el viento real puede diferir.</p>`;
      return { ...b, html };
    }
    function htmlChecklist(chk, titulo) {
      return `<section class="sis-tarjeta"><h2>${titulo}</h2><dl class="vu-tabla">${chk.map((x) => fila(escapar(x.texto), `<span class="${x.cumple ? "vu-verde" : "vu-rojo"}">${escapar(x.detalle)}</span>`)).join("")}</dl>
      <p class="sis-tenue">Límites del dron elegido (Vuelos → Drones).</p></section>`;
    }
    function htmlMetar() {
      const m = st.metar;
      return `<section class="sis-tarjeta"><h2>METAR · TAF</h2>
      ${m ? `<p class="sis-tenue">${escapar(m.icao)} · ${escapar(m.nombre)} · a ${fmt(m.km, 0)} km${m.viento ? ` · viento ${m.viento.dir != null ? m.viento.dir + "°" : "variable"} ${fmt(m.viento.v, 1)} m/s${m.viento.g ? ` ráf. ${fmt(m.viento.g, 1)}` : ""}` : ""}</p>
        <pre class="vu-metar">${escapar(m.metar)}${m.taf ? "\n\n" + escapar(m.taf) : ""}</pre><a class="vu-link" href="${enlaceMetar(m.icao)}" target="_blank" rel="noopener">Ver en NOAA ↗</a>` : st.metarError ? `<p class="sis-tenue">${escapar(st.metarError)}</p><a class="sis-btn chico" href="https://aipchile.dgac.gob.cl/" target="_blank" rel="noopener">Revisar METAR en AIP Chile ↗</a>` : '<p class="sis-tenue">Se busca al consultar el pronóstico (el aeródromo con reporte más cercano, datos de NOAA).</p>'}
    </section>`;
    }
    function vistaClima() {
      const h = st.hoja, d = dron(), g = geo();
      if (!g) return `<section class="sis-tarjeta sis-vacio"><p>Primero carga el área: el pronóstico se consulta en su centro.</p><button class="sis-btn primario" data-accion="paso" data-paso="area">Ir a Área</button></section>`;
      let cuerpo = "", lado = "";
      if (st.pronCargando) cuerpo = '<p class="sis-tenue">Consultando el pronóstico…</p>';
      else if (st.pronError) cuerpo = `<div class="sis-error">${escapar(st.pronError)}</div>`;
      else if (st.pron) {
        const b = bloquePronostico(st.pron, d, `Centro de «${h.nombre || "el área"}»`);
        cuerpo = b.html;
        lado = htmlChecklist(b.chk, b.ventana ? `Checklist · ventana ${dosD(b.ventana[0])}–${dosD(b.ventana[1] + 1)} h` : "Checklist · horas con luz");
      } else if (h.clima) cuerpo = `<p class="sis-tenue">Última consulta: ${fechaHora(h.clima.consultadoEn)}. Vuelve a consultar para ver el gráfico actualizado.</p>`;
      else cuerpo = '<p class="sis-tenue">Consulta el pronóstico de los próximos 3 días en el centro del área.</p>';
      return `<div class="vu-dos ancho">
      <div class="vu-izquierda">
        <section class="sis-tarjeta"><div class="sis-cab"><h2>Pronóstico · ${h.fecha ? fechaLegible(h.fecha) : "sin fecha"}</h2>
          <button class="sis-btn primario chico" data-accion="consultar-hoja">${st.pron ? "Actualizar" : "Consultar pronóstico"}</button></div>
          ${cuerpo}
        </section>
      </div>
      <div class="vu-derecha">
        ${lado || (h.clima && h.clima.checklist ? htmlChecklist(h.clima.checklist, "Checklist (última consulta)") : "")}
        ${htmlMetar()}
        <section class="sis-tarjeta"><h2>Viento medido en terreno</h2>
          ${h.viento.length ? `<dl class="vu-tabla">${h.viento.map((v, k) => fila(`${escapar(v.hora)}${v.nota ? ` · ${escapar(v.nota)}` : ""}`, `${fmt(v.ms, 1)} m/s <button class="vu-link" data-accion="quitar-viento" data-k="${k}" aria-label="Quitar">✕</button>`)).join("")}</dl>` : ""}
          <form class="vu-viento" data-form="viento"><input name="hora" placeholder="hh:mm" aria-label="Hora" value="${(/* @__PURE__ */ new Date()).toTimeString().slice(0, 5)}"><input name="ms" placeholder="m/s" inputmode="decimal" aria-label="Viento en m/s" required><input name="nota" placeholder="Nota (opcional)" aria-label="Nota"><button class="sis-btn chico">Anotar</button></form>
          <p class="sis-tenue">Anemómetro en el despegue. Queda en la hoja para comparar con el pronóstico.</p>
        </section>
        <section class="sis-tarjeta"><h2>Antes de volar, revisa también</h2>
          <div class="vu-enlaces">${ENLACES_CONSULTA.map(([t, u]) => `<a class="sis-btn chico" href="${u}" target="_blank" rel="noopener">${escapar(t)} ↗</a>`).join("")}</div>
        </section>
      </div>
    </div>`;
    }
    async function consultarClima(lat, lon) {
      st.pronCargando = true;
      st.pronError = "";
      st.metarError = "";
      await render();
      try {
        const [p, kps] = await Promise.all([pedirPronostico(lat, lon), st.kps ? Promise.resolve(st.kps) : pedirKp()]);
        st.pron = p;
        st.kps = kps;
        st.dia = null;
      } catch (e) {
        st.pronError = `No se pudo consultar el pronóstico (${e.message}). Revisa la conexión a internet.`;
        st.pron = null;
      }
      try {
        st.metar = await metarCercano(lat, lon);
        if (!st.metar) st.metarError = "No hay aeródromos con METAR a menos de ~120 km.";
      } catch {
        st.metar = null;
        st.metarError = "No se pudo leer el METAR desde la app (sin conexión o el servicio no respondió).";
      }
      st.pronCargando = false;
    }
    function guardarResumenClima() {
      var _a;
      const h = st.hoja, d = dron();
      if (!st.pron || !h) return;
      const b = analizarDia(st.pron, d);
      const raf = b.filas.filter((f) => f.h.g != null && f.ev.estado !== "noche").sort((x, y) => y.h.g - x.h.g)[0];
      h.clima = {
        consultadoEn: (/* @__PURE__ */ new Date()).toISOString(),
        fecha: st.dia,
        lat: st.pron.lat,
        lon: st.pron.lon,
        ventana: b.ventana ? `${dosD(b.ventana[0])}:00–${dosD(b.ventana[1] + 1)}:00` : "",
        rafaga: raf ? { v: raf.h.g, hora: raf.h.hora } : null,
        kpMax: b.kps.length ? Math.max(...b.kps) : null,
        sol: b.sol && b.sol.salida ? [b.sol.salida.slice(11, 16), b.sol.puesta ? b.sol.puesta.slice(11, 16) : "—"] : null,
        modelos: ((_a = st.pron.horas[0]) == null ? void 0 : _a.modelos) || 0,
        checklist: b.chk,
        horas: b.filas.map((f) => ({ hora: f.h.hora, v: f.h.v, g: f.h.g, dir: f.h.dir, prob: f.h.prob, nubes: f.h.nubes, temp: f.h.temp, kp: f.kp, estado: f.ev.estado })),
        metar: st.metar ? { icao: st.metar.icao, nombre: st.metar.nombre, km: st.metar.km, metar: st.metar.metar, taf: st.metar.taf } : null
      };
      cambio();
    }
    function fechaMenosHabiles(fecha2, n) {
      const d = /* @__PURE__ */ new Date(fecha2 + "T12:00:00");
      while (n > 0) {
        d.setDate(d.getDate() - 1);
        const w = d.getDay();
        if (w !== 0 && w !== 6) n--;
      }
      return d.toISOString().slice(0, 10);
    }
    function vistaPermisos() {
      const h = st.hoja, g = h.permisos.dgac, perm = estadoPermiso(h);
      const habiles = g.enviado && h.fecha ? diasHabiles(g.enviado, h.fecha) : null;
      const hito = (k, t) => `<label class="vu-hito${g[k] ? " hecho" : ""}"><span class="vu-hito-punto" aria-hidden="true"></span><span>${t}</span><input type="date" data-dgac="${k}" value="${escapar(g[k] || "")}" aria-label="${t}"></label>`;
      return `<div class="vu-dos ancho">
      <div class="vu-izquierda">
        <section class="sis-tarjeta"><div class="sis-cab"><h2>Solicitud a la DGAC</h2>${chip(perm.texto, perm.nivel === "ok" ? "verde" : perm.nivel === "aviso" ? "ambar" : "gris")}</div>
          <div class="vu-hitos">${hito("preparado", "En preparación")}${hito("enviado", "Enviada a la DGAC")}${hito("aprobado", "Aprobada")}${hito("vence", "Vigente hasta")}</div>
          <label class="sis-campo"><span>N° de solicitud o autorización</span><input data-dgac="numero" value="${escapar(g.numero || "")}"></label>
          ${habiles != null && habiles < 7 && !g.aprobado ? `<div class="vu-aviso">Se envió ${habiles} día${habiles === 1 ? "" : "s"} hábil${habiles === 1 ? "" : "es"} antes del vuelo; la DGAC pide al menos 7.</div>` : ""}
          ${!g.enviado && h.fecha ? `<p class="sis-tenue">Para volar el ${fechaLegible(h.fecha)}, conviene enviarla a más tardar el ${fechaLegible(fechaMenosHabiles(h.fecha, 7))} (7 días hábiles).</p>` : ""}
        </section>
        <section class="sis-tarjeta"><h2>Documentos de la solicitud</h2>
          ${DOCUMENTOS_DGAC.map(([k, t]) => `<label class="sis-check vu-doc"><input type="checkbox" data-doc="${k}" ${h.permisos.docs[k] ? "checked" : ""}> ${t}</label>`).join("")}
          <div class="sis-acciones">${geo() ? '<button class="sis-btn chico" data-accion="kml-vuelo">Descargar KML de la zona (área de vuelo)</button>' : ""}</div>
          <p class="sis-tenue">Más adelante la credencial del piloto y la inscripción del dron se leerán desde Personas y Equipos.</p>
        </section>
      </div>
      <div class="vu-derecha">
        <section class="sis-tarjeta"><h2>Consultas oficiales · con registro</h2>
          ${CONSULTAS.map(([k, t, u]) => {
        const x = ultimaConsulta(h, k);
        return `<div class="vu-consulta">
            <div><a href="${u}" target="_blank" rel="noopener"><b>${t}</b> ↗</a>${x ? `<span class="sis-tenue">Revisado ${fechaHora(x.fecha)}${x.personaId ? ` · ${escapar(nomPers(x.personaId))}` : ""}</span>` : '<span class="vu-rojo">Pendiente</span>'}</div>
            <div class="sis-acciones">${x && x.archivoId ? `<button class="sis-btn chico" data-accion="ver-captura" data-id="${escapar(x.archivoId)}">Ver captura</button>` : ""}
              <button class="sis-btn chico" data-accion="consulta" data-tipo="${k}">Marcar revisado</button>
              <label class="sis-btn chico vu-archivo">+ Captura<input type="file" accept="image/*,application/pdf" data-archivo="captura" data-tipo="${k}" hidden></label></div>
          </div>`;
      }).join("")}
          <p class="sis-tenue">Revisa el NOTAM el mismo día del vuelo. Cada revisión queda con fecha, persona y, si la adjuntas, la captura.</p>
        </section>
        <section class="sis-tarjeta"><h2>Otras consultas</h2>
          <div class="vu-enlaces">${ENLACES_CONSULTA.filter(([t]) => !/AIP/.test(t)).map(([t, u]) => `<a class="sis-btn chico" href="${u}" target="_blank" rel="noopener">${escapar(t)} ↗</a>`).join("")}</div>
        </section>
      </div>
    </div>`;
    }
    function imprimir() {
      var _a;
      const h = st.hoja, d = dron(), g = geo();
      if (!g) return;
      const t = totales(h, d, g);
      const lineas = [];
      t.sectores.forEach((r) => r && r.baterias.forEach((b, k) => b.piezas.forEach((pz) => lineas.push({ pts: pz, color: COLORES_BATERIA[k % COLORES_BATERIA.length] }))));
      const centro = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
      const svg2 = esquemaSVG({
        borde: g.tipo === "poligono" && Number(h.area.margen) ? g.original : null,
        poligonos: g.sectores.map((s) => s.poligono),
        lineas,
        puntos: t.sectores.filter(Boolean).map((r) => ({ xy: r.despegueXY })),
        etiquetas: g.sectores.length > 1 ? g.sectores.map((s, i) => ({ xy: centro(s.poligono), texto: nombreSector(h, i, g.sectores.length) })) : []
      });
      const c = h.clima, perm = estadoPermiso(h);
      const filaT = (a, b) => `<tr><th>${a}</th><td>${b}</td></tr>`;
      const despLL = (r) => {
        const [lon, lat] = g.marco.aLonLat(r.despegueXY);
        return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      };
      const vacias = Array(Math.max(0, 6 - h.viento.length)).fill({ hora: "", ms: "", nota: "" });
      const html = `<div class="vu-imp">
      <header><div><b>${escapar(((_a = document.querySelector(".sis-marca b")) == null ? void 0 : _a.textContent) || "Topoland")}</b> · Hoja de vuelo</div><div>${escapar(h.nombre || "")}</div></header>
      <table class="vu-imp-datos">${filaT("Proyecto", escapar(nomProy(h.proyectoId)))}${filaT("Fecha", h.fecha ? fechaLegible(h.fecha) : "")}${filaT("Piloto", escapar(nomPers(h.pilotoId)))}${filaT("Dron", escapar(d.nombre))}
        ${filaT("Producto", `${h.params.modo === "lidar" ? "LiDAR" : "Fotogrametría"} · GSD ${fmt(t.gsd, 2)} cm · altura ${fmt(t.altura, 0)} m · traslapes ${h.params.traslapeFrontal}/${h.params.traslapeLateral} %`)}
        ${filaT("Área de vuelo", `${fmt(g.areaVuelo / 1e4, 2)} ha${g.tipo === "corredor" ? ` · corredor de ${fmt(g.izq + g.der, 0)} m` : Number(h.area.margen) ? ` · margen de ${h.area.margen} m` : ""}`)}
        ${filaT("Vuelo", `${t.baterias} baterías · ${fmtDuracion(t.minVuelo)} en el aire · jornada ${fmtDuracion(t.minJornada)}`)}</table>
      <div class="vu-imp-mapa">${svg2}</div>
      <table class="vu-imp-tabla"><thead><tr><th>Sector</th><th>ha</th><th>Rumbo</th><th>Velocidad</th><th>Baterías (min)</th><th>Jornada</th><th>Despegue (lat, lon)</th></tr></thead>
        <tbody>${t.sectores.map((r, i) => r ? `<tr><td>${escapar(nombreSector(h, i, g.sectores.length))}</td><td>${fmt(r.area / 1e4, 1)}</td><td>${r.corredor ? "eje" : fmt(r.rumbo, 0) + "°"}</td><td>${fmt(r.velocidad, 1)} m/s</td><td>${r.baterias.map((b, k) => `B${k + 1} ${fmt(b.min, 0)}′`).join(" · ")}</td><td>${fmtDuracion(r.minTotal)}</td><td>${despLL(r)}</td></tr>` : "").join("")}</tbody></table>
      <div class="vu-imp-dos">
        <div><h3>Clima${c ? ` · ${fechaLegible(c.fecha)}` : ""}</h3>${c ? `<p>Ventana GO: <b>${escapar(c.ventana || "sin ventana")}</b> · Sol ${c.sol ? c.sol.join("–") : "—"} · Kp máx. ${c.kpMax != null ? fmt(c.kpMax, 0) : "—"}</p>
          <table class="vu-imp-tabla chica"><thead><tr><th>Hora</th><th>Viento</th><th>Ráfaga</th><th>Lluvia</th><th>Estado</th></tr></thead><tbody>${(c.horas || []).filter((_, k) => k % 2 === 0).map((x) => `<tr><td>${dosD(x.hora)}</td><td>${fmt(x.v, 1)}</td><td>${fmt(x.g, 1)}</td><td>${x.prob != null ? fmt(x.prob) + "%" : "—"}</td><td>${{ go: "GO", marg: "Marg.", no: "NO", noche: "—" }[x.estado]}</td></tr>`).join("")}</tbody></table>
          ${c.metar ? `<p class="mono">${escapar(c.metar.metar)}</p>` : ""}` : "<p>Sin consulta de clima.</p>"}
          <h3>Checklist</h3><ul class="vu-imp-chk">${(c && c.checklist || []).map((x) => `<li>☐ ${escapar(x.texto)} — ${escapar(x.detalle)}</li>`).join("")}<li>☐ NOTAM revisado el día del vuelo</li><li>☐ Baterías cargadas (${t.baterias + 1} como mínimo)</li></ul></div>
        <div><h3>Permisos</h3><p>DGAC: <b>${escapar(perm.texto)}</b> · ${escapar(perm.detalle)}${h.permisos.dgac.numero ? ` · N° ${escapar(h.permisos.dgac.numero)}` : ""}</p>
          <ul class="vu-imp-chk">${DOCUMENTOS_DGAC.map(([k, tt]) => `<li>${h.permisos.docs[k] ? "☑" : "☐"} ${tt}</li>`).join("")}</ul>
          <h3>Viento medido en terreno</h3><table class="vu-imp-tabla chica"><thead><tr><th>Hora</th><th>m/s</th><th>Nota</th></tr></thead><tbody>${[...h.viento, ...vacias].map((v) => `<tr><td>${escapar(v.hora)}</td><td>${v.ms === "" ? "" : fmt(v.ms, 1)}</td><td>${escapar(v.nota || "")}</td></tr>`).join("")}</tbody></table>
          <h3>Observaciones</h3><div class="vu-imp-obs"></div></div>
      </div>
      <footer>Generado ${(/* @__PURE__ */ new Date()).toLocaleString("es-CL")} · Estimación para planificar; el vuelo se programa en DJI Pilot 2. Información aeronáutica oficial: AIP Chile (DGAC).</footer>
    </div>`;
      let caja = document.getElementById("vu-impresion");
      if (!caja) {
        caja = document.createElement("div");
        caja.id = "vu-impresion";
        document.body.appendChild(caja);
      }
      caja.innerHTML = html;
      document.body.classList.add("vu-imprimiendo");
      const fin = () => {
        document.body.classList.remove("vu-imprimiendo");
        removeEventListener("afterprint", fin);
      };
      addEventListener("afterprint", fin);
      setTimeout(() => {
        window.print();
        setTimeout(fin, 1500);
      }, 50);
    }
    function vistaRapido() {
      const d = drones.find((x) => x.id === st.rapDron) || drones[0];
      let cuerpo = "", lado = "";
      if (st.pronCargando) cuerpo = '<p class="sis-tenue">Consultando el pronóstico…</p>';
      else if (st.pronError) cuerpo = `<div class="sis-error">${escapar(st.pronError)}</div>`;
      else if (st.pron) {
        const b = bloquePronostico(st.pron, d, st.rapOrigen);
        cuerpo = b.html;
        lado = htmlChecklist(b.chk, b.ventana ? "Checklist · ventana GO" : "Checklist · horas con luz");
      }
      return `<div class="vu-dos ancho">
      <div class="vu-izquierda">
        <section class="sis-tarjeta"><h2>Pronóstico rápido</h2>
          <p class="sis-tenue">Para un lugar sin hoja de vuelo. Para un trabajo, usa el paso Clima de su hoja.</p>
          <form class="sis-form" data-form="rapido">
            <div class="sis-par">
              <label class="sis-campo"><span>Latitud</span><input name="lat" value="${escapar(st.rapLat)}" placeholder="-32.83" inputmode="decimal"></label>
              <label class="sis-campo"><span>Longitud</span><input name="lon" value="${escapar(st.rapLon)}" placeholder="-70.60" inputmode="decimal"></label>
            </div>
            <label class="sis-campo"><span>Dron (para sus límites)</span><select name="rapDron">${familias().map(([k, t]) => {
        const x = drones.find((y) => (y.familia || y.id) === k);
        return `<option value="${x.id}" ${(d.familia || d.id) === k ? "selected" : ""}>${escapar(t)}</option>`;
      }).join("")}</select></label>
            <div class="sis-acciones"><button class="sis-btn primario">Consultar coordenadas</button><button type="button" class="sis-btn" data-accion="gps">Usar mi ubicación</button></div>
          </form>
          ${cuerpo}
        </section>
      </div>
      <div class="vu-derecha">${lado}${st.pron ? htmlMetar() : ""}</div>
    </div>`;
    }
    function vistaKml() {
      const a = st.kml;
      const contornos = a ? a.poligonos.filter((p) => !p.abierta) : [];
      return `<section class="sis-tarjeta">
      <h2>Limpiar un KML o KMZ para el control</h2>
      <p>Revisa el archivo (de Global Mapper, AutoCAD, Google Earth…) y deja cada polígono o línea como lo lee el control: un elemento por archivo, sin altura, sin vértices repetidos y con pocos vértices.</p>
      <div class="sis-acciones">
        <label class="sis-btn primario vu-archivo">Elegir archivo<input type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" data-archivo="kml" hidden></label>
        <label class="sis-campo vu-mini"><span>Máximo de vértices</span><input data-campo="maxVertices" value="${st.maxVertices}" inputmode="numeric"></label>
      </div>
      ${st.kmlError ? `<div class="sis-error">${escapar(st.kmlError)}</div>` : ""}
    </section>
    ${a ? `<div class="vu-kml">
      <section class="sis-tarjeta">
      <h2>${escapar(a.archivo)}</h2>
      <p class="sis-tenue">${a.placemarks} elemento${a.placemarks === 1 ? "" : "s"} · ${contornos.length} contorno${contornos.length === 1 ? "" : "s"} · ${a.ejes.length} línea${a.ejes.length === 1 ? "" : "s"} abierta${a.ejes.length === 1 ? "" : "s"}${a.puntos ? ` · ${a.puntos} punto${a.puntos > 1 ? "s" : ""} (se ignoran)` : ""}${a.carpetas ? ` · ${a.carpetas} carpeta${a.carpetas > 1 ? "s" : ""}` : ""}</p>
      ${contornos.length || a.ejes.length ? `<div class="sis-lista">
        ${contornos.map((p, n) => {
        const i = a.poligonos.indexOf(p);
        return `<div class="sis-fila vu-kml-fila">
          <span class="sis-fila-txt"><b>${n + 1}. ${escapar(p.nombre)}</b><span class="sis-tenue">Contorno · ${fmt(p.area / 1e4, 2)} ha · ${p.vertices} vértices</span>
            ${p.problemas.length ? `<ul class="vu-problemas">${p.problemas.map((t) => `<li>${escapar(t)}</li>`).join("")}</ul>` : '<span class="sis-chip verde">Sin problemas</span>'}</span>
          <span class="sis-acciones"><button class="sis-btn chico" data-accion="kml-limpio" data-i="${i}">Descargar KML</button>
            <button class="sis-btn chico" data-accion="kml-a-hoja" data-i="${i}">Nueva hoja</button></span></div>`;
      }).join("")}
        ${a.ejes.map((e, i) => `<div class="sis-fila vu-kml-fila">
          <span class="sis-fila-txt"><b>${escapar(e.nombre)}</b><span class="sis-tenue">Línea abierta · ${fmt(e.largo / 1e3, 2)} km · ${e.vertices} vértices</span>
            ${e.problemas.length ? `<ul class="vu-problemas">${e.problemas.map((t) => `<li>${escapar(t)}</li>`).join("")}</ul>` : '<span class="sis-chip verde">Sin problemas</span>'}</span>
          <span class="sis-acciones"><button class="sis-btn chico" data-accion="eje-limpio" data-i="${i}">Descargar línea</button>
            <button class="sis-btn chico" data-accion="eje-a-hoja" data-i="${i}">Nueva hoja (corredor)</button></span></div>`).join("")}
        </div><p class="sis-tenue">Cada elemento se descarga como un archivo aparte, que es lo que el control importa mejor.</p>` : '<div class="sis-vacio"><p>No encontré polígonos ni líneas en este archivo.</p></div>'}
      </section>
      ${contornos.length || a.ejes.length ? '<div class="vu-mapa-caja"><div class="vu-mapa-lugar" data-mapa="kml"></div></div>' : ""}
    </div>` : ""}`;
    }
    function vistaDrones() {
      return `<p class="sis-tenue">Valores de referencia tomados de las fichas técnicas. Revísalos con la ficha de tu equipo: si corriges uno, se usa tu valor en todos los cálculos. El Matrice 300 aparece una vez por sensor. Los Mavic 2 Enterprise no están porque se usan solo para termografía.</p>
      ${drones.map((d) => `<section class="sis-tarjeta"><div class="sis-cab"><h2>${escapar(d.nombre)}</h2>${d.corregido ? chip("Corregido", "ambar") : ""}</div>
        <form class="sis-form vu-dron" data-form="dron" data-id="${d.id}"><div class="vu-grilla">
          ${CAMPOS_DRON.map(([k, t, u]) => campo(k, t, d[k], "", u)).join("")}
          ${d.lidar ? campo("lidarPps", "LiDAR: puntos por segundo", d.lidar.puntosPorSegundo, "", "pts/s") + campo("lidarFov", "LiDAR: campo de visión", d.lidar.fovGrados, "", "°") : ""}
        </div><div class="sis-acciones"><button class="sis-btn chico primario">Guardar</button>
        ${d.corregido ? `<button type="button" class="sis-btn chico" data-accion="restablecer-dron" data-id="${d.id}">Volver a los valores de fábrica</button>` : ""}</div></form>
      </section>`).join("")}`;
    }
    const mapas = {};
    async function cargarLeaflet() {
      if (window.L) return window.L;
      await cargarScript("vendor/leaflet/leaflet.js");
      return window.L;
    }
    async function mapaEn(lugar, clave) {
      let L;
      try {
        L = await cargarLeaflet();
      } catch {
        return null;
      }
      if (!L || !raiz.contains(lugar)) return null;
      let m = mapas[clave];
      if (!m) {
        const el = document.createElement("div");
        el.className = "vu-mapa";
        const mapa = L.map(el, { zoomControl: true, attributionControl: true });
        L.tileLayer(ESRI("World_Imagery"), { maxZoom: 20, maxNativeZoom: 19, attribution: "Imagen © Esri, Maxar, Earthstar Geographics" }).addTo(mapa);
        L.tileLayer(ESRI("Reference/World_Transportation"), { maxZoom: 20, maxNativeZoom: 19 }).addTo(mapa);
        L.tileLayer(ESRI("Reference/World_Boundaries_and_Places"), { maxZoom: 20, maxNativeZoom: 19 }).addTo(mapa);
        m = mapas[clave] = { el, mapa, capas: {}, L, encuadre: null };
        mapa.setView(CENTRO_CHILE, 7);
        mapa.on("click", (ev) => alClicMapa(clave, ev));
      }
      if (m.el.parentNode !== lugar) lugar.appendChild(m.el);
      m.mapa.invalidateSize();
      return m;
    }
    const quitar = (m, ...ns) => {
      for (const n of ns) if (m.capas[n]) {
        m.capas[n].remove();
        delete m.capas[n];
      }
    };
    const aLL = (g) => (p) => g.marco.aLatLng(p);
    function encuadrar(m, puntosLL, firma) {
      if (m.encuadre === firma) return;
      const b = m.L.latLngBounds(puntosLL);
      if (b.isValid()) m.mapa.fitBounds(b, { padding: [30, 30] });
      m.encuadre = firma;
    }
    function pintarDibujo(m) {
      const { L, mapa } = m;
      quitar(m, "dibujo");
      if (!st.dibujo) return;
      const pts = st.dibujo.puntos.map(([lon, lat]) => [lat, lon]);
      const cerrar = st.dibujo.modo === "area" && pts.length >= 3;
      m.capas.dibujo = L.layerGroup([
        ...pts.length >= 2 ? [L.polyline(cerrar ? [...pts, pts[0]] : pts, { color: "#FFFFFF", weight: 2.5, dashArray: "7 5", interactive: false })] : [],
        ...pts.map((p) => L.circleMarker(p, { radius: 5, color: "#FFFFFF", weight: 2, fillColor: "#E8611C", fillOpacity: 1, interactive: false }))
      ]).addTo(mapa);
    }
    async function mapaArea() {
      const lugar = raiz.querySelector('[data-mapa="area"]');
      if (!lugar) return;
      const m = await mapaEn(lugar, "area");
      if (!m) {
        lugar.innerHTML = '<p class="sis-tenue vu-sin-mapa">El mapa necesita internet. El cálculo funciona igual.</p>';
        return;
      }
      m.el.classList.toggle("dibujando", !!st.dibujo);
      pintarArea(m);
      pintarDibujo(m);
    }
    function pintarArea(m) {
      const { L, mapa } = m;
      const g = geo(), h = st.hoja;
      quitar(m, "original", "sectores", "cortes", "eje");
      pintarZonas(m);
      if (!g) return;
      const LL = aLL(g);
      if (g.tipo === "poligono" && Number(h.area.margen)) m.capas.original = L.polygon(g.original.map(LL), { color: "#FFFFFF", weight: 2, dashArray: "6 5", fill: false, interactive: false }).addTo(mapa);
      if (g.tipo === "corredor") m.capas.eje = L.polyline(g.eje.map(LL), { color: "#FFFFFF", weight: 2, dashArray: "3 5", interactive: false }).addTo(mapa);
      const varios = g.sectores.length > 1;
      m.capas.sectores = L.layerGroup(g.sectores.map((s, i) => {
        const p = L.polygon(s.poligono.map(LL), { color: "#E8611C", weight: 3, fillColor: COLORES_SECTOR[i % COLORES_SECTOR.length], fillOpacity: varios ? 0.25 : 0.1, interactive: false });
        if (varios) p.bindTooltip(nombreSector(h, i, g.sectores.length), { permanent: true, direction: "center", className: "vu-etiqueta" });
        return p;
      })).addTo(mapa);
      const capas = [];
      h.area.cortes.forEach((c, k) => {
        capas.push(L.polyline(c.map(([lon, lat]) => [lat, lon]), { color: "#FFFFFF", weight: 3, dashArray: "9 6", interactive: false }));
        c.forEach((p, j) => {
          const mk = L.marker([p[1], p[0]], { draggable: true, icon: L.divIcon({ className: "vu-vertice", html: "<span></span>", iconSize: [16, 16], iconAnchor: [8, 8] }), title: "Arrastra para mover el corte" });
          mk.on("dragend", (ev) => {
            const q = ev.target.getLatLng();
            h.area.cortes[k][j] = [q.lng, q.lat];
            cambio();
            refrescarArea();
          });
          capas.push(mk);
        });
      });
      m.capas.cortes = L.layerGroup(capas).addTo(mapa);
      encuadrar(m, g.vuelo.map(LL), `area:${JSON.stringify(g.vuelo[0])}:${g.vuelo.length}`);
    }
    function pintarZonas(m) {
      const { L, mapa } = m;
      quitar(m, "zonas");
      const capas0 = st.capas || [];
      if (!capas0.length) return;
      const activas = capasActivas();
      const g = geo();
      const centro = g ? g.marco.aLonLat([0, 0]) : null;
      const cerca = (el) => {
        if (!centro) return true;
        const p = el.tipo === "punto" ? el.coords : el.coords[0];
        return Math.abs(p[0] - centro[0]) < 0.8 && Math.abs(p[1] - centro[1]) < 0.8;
      };
      const capas = [];
      for (const c of capas0) {
        if (!activas.includes(c.id)) continue;
        const color = TIPOS_CAPA[c.tipo].color;
        for (const el of c.elementos) {
          if (!cerca(el) || capas.length > 3e3) continue;
          if (el.tipo === "punto") capas.push(L.circleMarker([el.coords[1], el.coords[0]], { radius: 6, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }).bindTooltip(el.nombre || c.nombre));
          else if (el.tipo === "poligono") capas.push(L.polygon(el.coords.map(([lon, lat]) => [lat, lon]), { color, weight: 1.5, fillColor: color, fillOpacity: 0.15, dashArray: c.tipo === "restringida" ? "4 3" : null }).bindTooltip(el.nombre || c.nombre, { sticky: true }));
          else capas.push(L.polyline(el.coords.map(([lon, lat]) => [lat, lon]), { color, weight: 1.5, opacity: 0.8 }).bindTooltip(el.nombre || c.nombre, { sticky: true }));
        }
      }
      m.capas.zonas = L.layerGroup(capas).addTo(mapa);
    }
    async function mapaVuelo() {
      const lugar = raiz.querySelector('[data-mapa="vuelo"]');
      if (!lugar) return;
      const m = await mapaEn(lugar, "vuelo");
      if (!m) {
        lugar.innerHTML = '<p class="sis-tenue vu-sin-mapa">El mapa necesita internet. El cálculo funciona igual.</p>';
        return;
      }
      pintarVuelo(m);
    }
    function pintarVuelo(m) {
      const { L, mapa } = m;
      const g = geo(), h = st.hoja;
      quitar(m, "sectores", "lineas", "traslados");
      if (!g) return;
      const LL = aLL(g), i = secSel();
      const r = calcularSector(h, dron(), g, i);
      m.capas.sectores = L.layerGroup(g.sectores.map((s, k) => L.polygon(s.poligono.map(LL), { color: "#E8611C", weight: k === i ? 3 : 1.5, opacity: k === i ? 1 : 0.6, fillColor: "#E8611C", fillOpacity: k === i ? 0.1 : 0.03, interactive: k !== i }).on("click", () => {
        if (k !== i) {
          h.area.sel = k;
          cambio();
          render();
        }
      }))).addTo(mapa);
      if (!r) return;
      m.capas.lineas = L.layerGroup(r.baterias.flatMap((b, k) => b.piezas.map((pz) => L.polyline(pz.slice(0, 5e3).map(LL), { color: COLORES_BATERIA[k % COLORES_BATERIA.length], weight: 2, opacity: 0.95, interactive: false })))).addTo(mapa);
      const desp = LL(r.despegueXY);
      m.capas.traslados = L.layerGroup(r.baterias.slice(0, 40).map((b) => L.polyline([desp, LL(b.inicio)], { color: "#FFFFFF", weight: 1.5, dashArray: "5 5", opacity: 0.9, interactive: false }))).addTo(mapa);
      if (!m.capas.despegue) {
        const icono = L.divIcon({ className: "vu-despegue", html: "<span></span>", iconSize: [26, 26], iconAnchor: [13, 13] });
        m.capas.despegue = L.marker(desp, { draggable: true, icon: icono, title: "Punto de despegue (arrástralo)", keyboard: true, zIndexOffset: 1e3 }).addTo(mapa);
        m.capas.despegue.on("dragend", (ev) => {
          const q = ev.target.getLatLng();
          metaSector(st.hoja, secSel()).despegue = [q.lng, q.lat];
          cambio();
          refrescarVuelo();
        });
      } else m.capas.despegue.setLatLng(desp);
      encuadrar(m, g.sectores[i].poligono.map(LL), `vuelo:${i}:${JSON.stringify(g.sectores[i].poligono[0])}`);
    }
    async function mapaKml() {
      const lugar = raiz.querySelector('[data-mapa="kml"]');
      if (!lugar || !st.kml) return;
      const m = await mapaEn(lugar, "kml");
      if (!m) {
        lugar.innerHTML = '<p class="sis-tenue vu-sin-mapa">El mapa necesita internet.</p>';
        return;
      }
      if (m.kml === st.kml) return;
      quitar(m, "kml");
      const { L } = m;
      const capas = [
        ...st.kml.poligonos.filter((p) => !p.abierta).map((p, i) => L.polygon(p.anillo.map(([lon, lat]) => [lat, lon]), { color: p.problemas.length ? "#FFB74D" : "#E8611C", weight: 3, fillOpacity: 0.12 }).bindTooltip(`${i + 1}. ${p.nombre}`, { sticky: true })),
        ...st.kml.ejes.map((e) => L.polyline(e.linea.map(([lon, lat]) => [lat, lon]), { color: "#4FC3F7", weight: 3 }).bindTooltip(e.nombre, { sticky: true }))
      ];
      if (!capas.length) return;
      m.capas.kml = L.featureGroup(capas).addTo(m.mapa);
      m.mapa.fitBounds(m.capas.kml.getBounds(), { padding: [24, 24] });
      m.kml = st.kml;
    }
    function alClicMapa(clave, ev) {
      if (clave !== "area" || !st.dibujo) return;
      st.dibujo.puntos.push([ev.latlng.lng, ev.latlng.lat]);
      const b = raiz.querySelector("#vu-barra-area");
      if (b) b.innerHTML = barraDibujo();
      if (mapas.area) pintarDibujo(mapas.area);
    }
    function poner(id, html) {
      const el = raiz.querySelector("#" + id);
      if (el) el.innerHTML = html;
    }
    function ponerValor(nombre, valor) {
      const rango = raiz.querySelector(`input[type=range][name="${nombre}"]`), espejo = raiz.querySelector(`input[data-espejo="${nombre}"]`);
      if (rango && document.activeElement !== rango) rango.value = valor;
      if (espejo && document.activeElement !== espejo) espejo.value = valor;
    }
    function refrescarVuelo() {
      const g = geo();
      if (!g) return;
      const r = calcularSector(st.hoja, dron(), g, secSel());
      poner("vu-kpis", htmlKpis(r));
      poner("vu-barra", htmlBarraRumbo(r));
      poner("vu-leyenda", htmlLeyenda(r));
      poner("vu-detalle", htmlDetalle(r));
      poner("vu-vel-pie", pieVelocidad(r));
      poner("vu-total-hoja", htmlTotalHoja());
      if (r && st.hoja.params.velocidad === "") ponerValor("velocidad", Math.round(r.velocidad * 10) / 10);
      if (mapas.vuelo && mapas.vuelo.el.isConnected) pintarVuelo(mapas.vuelo);
    }
    function refrescarArea() {
      const g = geo();
      poner("vu-sectores", htmlSectores());
      poner("vu-zonas", htmlZonas());
      const info = raiz.querySelector("#vu-margen-info");
      if (info && g) info.innerHTML = g.tipo === "corredor" ? textoCorredor(g) : `${fmt(areaM2(g.original) / 1e4, 2)} ha → <b>${fmt(g.areaVuelo / 1e4, 2)} ha</b> de vuelo`;
      if (mapas.area && mapas.area.el.isConnected) pintarArea(mapas.area);
    }
    async function render() {
      if (!activo2) return;
      await cargarBase();
      if (!st.capas) {
        try {
          st.capas = await listarCapas();
        } catch {
          st.capas = [];
        }
      }
      let html;
      if (st.vista === "hoja" && st.hoja) {
        const vistas = { resumen: vistaResumen, area: vistaArea, vuelo: vistaVuelo, clima: vistaClima, permisos: vistaPermisos };
        html = encabezadoHoja() + `<div class="vu-paso-cuerpo">${vistas[st.paso]()}</div>`;
      } else {
        if (st.vista === "hoja") st.vista = "hojas";
        html = { hojas: vistaHojas, rapido: vistaRapido, kml: vistaKml, drones: vistaDrones }[st.vista]();
      }
      if (!activo2) return;
      const herr = st.vista === "hoja" ? "hojas" : st.vista;
      raiz.innerHTML = `<nav class="vu-nav" aria-label="Vuelos">${HERRAMIENTAS.map(([id, t]) => `<button class="vu-pestana${id === herr ? " activa" : ""}" data-accion="vista" data-vista="${id}">${t}</button>`).join("")}</nav>
      ${st.mensaje ? `<div class="vu-msg ${st.mensaje.tipo}">${escapar(st.mensaje.texto)}</div>` : ""}
      <div class="sis-vista">${html}</div>`;
      st.mensaje = null;
      if (st.vista === "hoja" && st.paso === "area") mapaArea();
      if (st.vista === "hoja" && st.paso === "vuelo") mapaVuelo();
      if (st.vista === "kml") mapaKml();
    }
    function usarPoligono(p, archivo) {
      const a = st.hoja.area;
      Object.assign(a, { tipo: "poligono", original: { nombre: p.nombre, anillo: limpiarAnillo(p.coords || p.anillo) }, eje: null, archivo, cortes: [], sectores: [], sel: 0, problemas: p.problemas || [] });
      if (!st.hoja.nombre) st.hoja.nombre = p.nombre;
      st.candidatos = null;
      st.dibujo = null;
      if (p.area > 2e3 * 1e4) avisar2(`El polígono tiene ${fmt(p.area / 1e4, 0)} ha: revisa que sea el área de vuelo.`, "error");
      cambio();
    }
    function usarEje(e, archivo) {
      const a = st.hoja.area;
      Object.assign(a, { tipo: "corredor", eje: { nombre: e.nombre, linea: e.linea, largo: e.largo }, original: null, archivo, cortes: [], sectores: [], sel: 0, problemas: e.problemas || [] });
      if (!st.hoja.nombre) st.hoja.nombre = e.nombre;
      st.candidatos = null;
      st.dibujo = null;
      cambio();
    }
    async function alCargarArchivo(t) {
      const archivo = t.files[0];
      const tipo = t.dataset.archivo;
      if (tipo === "captura") {
        const h = st.hoja;
        if (!h.id) await guardarAhora();
        const reg = await guardarArchivo(archivo, { modulo: "vuelos", duenoTipo: "vuelos_hoja", duenoId: h.id, rol: "documento", proyectoId: h.proyectoId, carpeta: `Vuelos/${nombreArchivoSeguro(h.nombre)}/Consultas` }, { personaId: ctx2.personaId });
        h.permisos.consultas.push({ id: reg.id, tipo: t.dataset.tipo, fecha: (/* @__PURE__ */ new Date()).toISOString(), personaId: ctx2.personaId, archivoId: reg.id });
        avisar2("Captura guardada");
        cambio();
        return;
      }
      if (tipo === "capa") {
        const sel = raiz.querySelector('select[data-campo="tipoCapa"]');
        const n = await cargarCapaDesdeArchivo(archivo, sel ? sel.value : "referencia");
        st.capas = await listarCapas();
        avisar2(`Capa cargada: ${n} elemento${n === 1 ? "" : "s"}.`);
        return;
      }
      const analisis = analizarKml(await leerArchivo(archivo), archivo.name);
      if (tipo === "kml") {
        st.kml = analisis;
        st.kmlError = "";
        return;
      }
      const contornos = analisis.poligonos.filter((p) => !p.abierta);
      if (!contornos.length && !analisis.ejes.length) throw new Error("El archivo no trae polígonos ni líneas.");
      if (contornos.length === 1 && !analisis.ejes.length) usarPoligono(contornos[0], archivo.name);
      else st.candidatos = { ...analisis, archivo: archivo.name };
    }
    const num = (v) => String(v).replace(",", ".").trim();
    function leerPlan(objetivo) {
      const P = st.hoja.params, d = dron();
      const nombre = objetivo.name || objetivo.dataset.espejo;
      const valor = num(objetivo.value);
      if (["reserva", "minDespegue", "minCambio", "segGiro", "exposicion"].includes(nombre)) P[nombre] = valor;
      else if (nombre === "gsd" && Number(valor) > 0) {
        P.porGsd = true;
        P.gsd = valor;
        ponerValor("altura", Math.round(alturaParaGsd(d, Number(valor))));
      } else if (nombre === "altura" && Number(valor) > 0) {
        P.porGsd = false;
        P.altura = valor;
        ponerValor("gsd", Math.round(gsdCm(d, Number(valor)) * 100) / 100);
      } else if (nombre === "velocidad" && Number(valor) > 0) {
        P.velocidad = valor;
        const nota = raiz.querySelector('label[for="vu-velocidad"] small');
        if (nota) nota.remove();
      } else if (["traslapeFrontal", "traslapeLateral"].includes(nombre)) P[nombre] = valor;
      else return false;
      if (objetivo.dataset.espejo) ponerValor(nombre, valor);
      else if (objetivo.type === "range") {
        const e = raiz.querySelector(`input[data-espejo="${nombre}"]`);
        if (e) e.value = valor;
      }
      return true;
    }
    function leerArea(objetivo) {
      const a = st.hoja.area;
      const nombre = objetivo.name || objetivo.dataset.espejo;
      if (!["margen", "izq", "der"].includes(nombre)) return false;
      const v = Number(num(objetivo.value));
      if (!(v >= 0)) return false;
      if (nombre === "margen") a.margen = Math.min(500, v);
      else if (nombre === "izq") a.corredor.izq = Math.max(1, v);
      else a.corredor.der = Math.max(1, v);
      if (objetivo.dataset.espejo) ponerValor(nombre, v);
      else {
        const e = raiz.querySelector(`input[data-espejo="${nombre}"]`);
        if (e) e.value = v;
      }
      return true;
    }
    raiz.addEventListener("input", (ev) => {
      const t = ev.target;
      if (st.vista === "hoja" && st.hoja) {
        if (t.closest('form[data-form="plan"]') && t.tagName !== "SELECT" && t.type !== "radio") {
          if (leerPlan(t)) {
            cambio();
            refrescarVuelo();
          }
          return;
        }
        if (st.paso === "area" && (t.name || t.dataset.espejo) && leerArea(t)) {
          cambio();
          refrescarArea();
          return;
        }
        if (t.dataset.hoja && t.tagName === "INPUT" && t.type !== "date") {
          st.hoja[t.dataset.hoja] = t.value;
          cambio();
          return;
        }
        if (t.dataset.sectorNombre != null) {
          metaSector(st.hoja, Number(t.dataset.sectorNombre)).nombre = t.value.trim();
          cambio();
          if (mapas.area) pintarArea(mapas.area);
          return;
        }
        if (t.dataset.dgac === "numero") {
          st.hoja.permisos.dgac.numero = t.value;
          cambio();
          return;
        }
      }
      if (t.dataset.vel) {
        const v = Number(num(t.value));
        if (v > 0) {
          st[t.dataset.vel] = v;
          const det = raiz.querySelector(".vu-opciones"), g = geo();
          if (det && g) {
            const r = calcularSector(st.hoja, dron(), g, secSel());
            const n = document.createElement("div");
            n.innerHTML = htmlTablaGsd(r);
            const sel = t.dataset.vel;
            det.replaceWith(n.firstElementChild);
            const i = raiz.querySelector(`input[data-vel="${sel}"]`);
            if (i) i.focus();
          }
        }
        return;
      }
      if (t.dataset.campo === "maxVertices") st.maxVertices = Math.max(4, Number(t.value) || 200);
    });
    raiz.addEventListener("change", async (ev) => {
      const t = ev.target;
      try {
        if (t.dataset.archivo && t.files && t.files[0]) {
          await alCargarArchivo(t);
          t.value = "";
          await render();
          return;
        }
        if (t.dataset.campo === "filtroProyecto") {
          st.filtroProyecto = t.value;
          await render();
          return;
        }
        if (t.name === "rapDron") {
          st.rapDron = t.value;
          return;
        }
        if (!st.hoja || st.vista !== "hoja") return;
        const h = st.hoja;
        if (t.dataset.hoja && (t.tagName === "SELECT" || t.type === "date")) {
          h[t.dataset.hoja] = t.value || null;
          if (t.dataset.hoja === "fecha") st.dia = null;
          cambio();
          await render();
          return;
        }
        if (t.name === "familia") {
          const alt = alturaDe(h.params, dron());
          const x = drones.find((d) => (d.familia || d.id) === t.value);
          if (x) h.dronId = x.id;
          if (!h.params.porGsd) h.params.altura = String(Math.round(alt));
          if (Number(h.params.velocidad) > dron().velocidadMaxMs) h.params.velocidad = "";
          cambio();
          await render();
          return;
        }
        if (t.name === "dronId") {
          h.dronId = t.value;
          cambio();
          await render();
          return;
        }
        if (t.name === "modo") {
          h.params.modo = t.value;
          if (t.value === "lidar" && Number(h.params.traslapeLateral) > 60) h.params.traslapeLateral = "50";
          if (t.value === "foto" && Number(h.params.traslapeLateral) < 60) h.params.traslapeLateral = "70";
          cambio();
          await render();
          return;
        }
        if (t.dataset.area === "rectas") {
          h.area.rectas = t.checked;
          cambio();
          refrescarArea();
          return;
        }
        if (t.dataset.area === "mismo") {
          h.area.corredor.mismo = t.checked;
          if (!t.checked) h.area.corredor.der = h.area.corredor.izq;
          cambio();
          await render();
          return;
        }
        if (t.dataset.capa) {
          const todas = capasActivas();
          st.capasActivas = t.checked ? [.../* @__PURE__ */ new Set([...todas, t.dataset.capa])] : todas.filter((x) => x !== t.dataset.capa);
          escribirLS("vu_capas_activas", st.capasActivas);
          refrescarArea();
          return;
        }
        if (t.dataset.dgac && t.dataset.dgac !== "numero") {
          h.permisos.dgac[t.dataset.dgac] = t.value;
          cambio();
          await render();
          return;
        }
        if (t.dataset.doc) {
          h.permisos.docs[t.dataset.doc] = t.checked;
          cambio();
          return;
        }
      } catch (e) {
        console.error(e);
        avisar2(e.message || "No se pudo completar", "error");
        await render();
      }
    });
    raiz.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const form = ev.target;
      const fd = new FormData(form);
      try {
        if (form.dataset.form === "plan") return;
        if (form.dataset.form === "viento") {
          const ms = Number(num(fd.get("ms")));
          if (!(ms >= 0)) throw new Error("Escribe el viento en m/s.");
          st.hoja.viento.push({ hora: String(fd.get("hora") || "").trim(), ms, nota: String(fd.get("nota") || "").trim() });
          cambio();
        } else if (form.dataset.form === "rapido") {
          st.rapLat = num(fd.get("lat"));
          st.rapLon = num(fd.get("lon"));
          st.rapDron = fd.get("rapDron") || st.rapDron;
          st.rapOrigen = "Coordenadas escritas";
          const lat = Number(st.rapLat), lon = Number(st.rapLon);
          if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !lat && !lon) throw new Error("Revisa la latitud y la longitud (grados decimales, por ejemplo -32.83 y -70.60).");
          await consultarClima(lat, lon);
        } else if (form.dataset.form === "dron") {
          const n = (k) => Number(num(fd.get(k)));
          const valores = Object.fromEntries(CAMPOS_DRON.map(([k]) => [k, n(k)]));
          if (fd.has("lidarPps")) valores.lidar = { puntosPorSegundo: n("lidarPps"), fovGrados: n("lidarFov") };
          if (Object.values(valores).some((v) => typeof v === "number" && !(v > 0))) throw new Error("Todos los valores deben ser números mayores que 0.");
          await guardarDron(form.dataset.id, valores);
          avisar2("Datos del dron guardados");
        }
      } catch (e) {
        console.error(e);
        avisar2(e.message, "error");
      }
      await render();
    });
    function descargarPoligono(nombre, anillo) {
      const limpio = limpiarParaDji({ nombre, coords: anillo, vertices: anillo.length }, { maxVertices: st.maxVertices });
      descargar(`${nombreArchivoSeguro(nombre)}.kml`, kmlDePoligono(nombre, limpio.anillo), TIPO_KML);
    }
    function descargarKmlSector(i) {
      const h = st.hoja, g = geo();
      const nombre = g.sectores.length > 1 ? `${h.nombre || "area"} ${nombreSector(h, i, g.sectores.length)}` : h.nombre || "area";
      descargarPoligono(nombre, g.sectores[i].poligono.map(g.marco.aLonLat));
    }
    raiz.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-accion]");
      if (!b) return;
      const a = b.dataset.accion;
      if (a === "volver-lista") ev.preventDefault();
      const h = st.hoja;
      try {
        if (a === "vista") {
          if (st.hoja) await guardarAhora();
          st.vista = b.dataset.vista;
          st.pron = null;
          st.metar = null;
          st.pronError = "";
          if (st.vista === "hojas") st.hoja = null;
        } else if (a === "volver-lista") {
          await guardarAhora();
          st.vista = "hojas";
          st.hoja = null;
          try {
            history.replaceState(null, "", "#/vuelos");
          } catch {
          }
        } else if (a === "nueva-hoja") {
          await abrirHoja(null);
        } else if (a === "abrir-hoja") {
          await abrirHoja(b.dataset.id);
          try {
            history.replaceState(null, "", `#/vuelos/plan/${b.dataset.id}`);
          } catch {
          }
        } else if (a === "eliminar-hoja") {
          if (!confirm("¿Eliminar esta hoja de vuelo? Queda en la papelera.")) return;
          await eliminarPlan(b.dataset.id);
          avisar2("Hoja eliminada");
        } else if (a === "paso") {
          st.paso = b.dataset.paso;
          st.dibujo = null;
          await guardarAhora();
        } else if (a === "estado") {
          h.estado = b.dataset.e;
          cambio();
          await guardarAhora();
        } else if (a === "imprimir") {
          await guardarAhora();
          imprimir();
          return;
        } else if (a === "dia") {
          st.dia = b.dataset.dia;
          if (st.vista === "hoja") guardarResumenClima();
        } else if (a === "consultar-hoja") {
          const g = geo();
          const [lon, lat] = g.marco.aLonLat([0, 0]);
          await consultarClima(lat, lon);
          guardarResumenClima();
        } else if (a === "gps") {
          if (!navigator.geolocation) throw new Error("Este navegador no entrega la ubicación.");
          const pos = await new Promise((ok, mal) => navigator.geolocation.getCurrentPosition(ok, mal, { enableHighAccuracy: false, timeout: 15e3 }));
          st.rapLat = pos.coords.latitude.toFixed(5);
          st.rapLon = pos.coords.longitude.toFixed(5);
          st.rapOrigen = "Tu ubicación actual";
          await consultarClima(pos.coords.latitude, pos.coords.longitude);
        } else if (a === "dibujar") {
          const modo = b.dataset.modo;
          st.dibujo = st.dibujo && st.dibujo.modo === modo ? null : { modo, puntos: [] };
          st.paso = "area";
          if (st.dibujo && modo === "corte") avisar2("Traza el corte: toca afuera del área, sigue el camino y termina afuera. Luego «Terminar».");
        } else if (a === "dibujo-deshacer") {
          st.dibujo.puntos.pop();
          const bb = raiz.querySelector("#vu-barra-area");
          if (bb) bb.innerHTML = barraDibujo();
          if (mapas.area) pintarDibujo(mapas.area);
          return;
        } else if (a === "dibujo-cancelar") {
          st.dibujo = null;
        } else if (a === "dibujo-terminar") {
          const { modo, puntos } = st.dibujo;
          if (modo === "area") {
            const coords = limpiarAnillo(puntos);
            const { puntos: xy } = proyectar(coords);
            usarPoligono({ nombre: "Área dibujada", coords, area: areaM2(xy), problemas: [] }, "dibujada en el mapa");
            if (autoInterseccion(xy)) avisar2("El contorno dibujado se cruza consigo mismo: dibújalo de nuevo siguiendo el borde.", "error");
          } else if (modo === "eje") {
            const { puntos: xy } = proyectar(puntos);
            let L = 0;
            for (let k = 1; k < xy.length; k++) L += Math.hypot(xy[k][0] - xy[k - 1][0], xy[k][1] - xy[k - 1][1]);
            usarEje({ nombre: "Eje dibujado", linea: puntos, largo: L }, "dibujado en el mapa");
          } else {
            h.area.cortes.push(puntos);
            const g = geometria(h);
            if (g.fallidos.length) avisar2("El corte no atraviesa el área de lado a lado: empieza y termina afuera del área.", "error");
            else avisar2(`Listo: ${g.sectores.length} sectores. Ponles nombre si quieres.`);
            cambio();
          }
          st.dibujo = null;
        } else if (a === "deshacer-corte") {
          h.area.cortes.pop();
          cambio();
        } else if (a === "quitar-cortes") {
          h.area.cortes = [];
          h.area.sel = 0;
          cambio();
        } else if (a === "margen") {
          h.area.margen = Number(b.dataset.m);
          cambio();
        } else if (a === "invertir") {
          h.area.corredor.invertir = !h.area.corredor.invertir;
          cambio();
        } else if (a === "usar-eje") usarEje(st.candidatos.ejes[Number(b.dataset.i)], st.candidatos.archivo);
        else if (a === "usar-pol") usarPoligono(st.candidatos.poligonos[Number(b.dataset.i)], st.candidatos.archivo);
        else if (a === "cerrar-candidatos") st.candidatos = null;
        else if (a === "quitar-capa") {
          await quitarCapa(b.dataset.id);
          st.capas = await listarCapas();
        } else if (a === "kml-original") {
          if (h.area.tipo === "corredor") {
            const e = limpiarEje({ ...h.area.eje, vertices: h.area.eje.linea.length }, { maxVertices: st.maxVertices });
            descargar(`${nombreArchivoSeguro(h.area.eje.nombre)}_eje.kml`, kmlDeLinea(h.area.eje.nombre, e.linea), TIPO_KML);
          } else descargarPoligono(h.area.original.nombre, h.area.original.anillo);
          avisar2("KML descargado");
        } else if (a === "kml-vuelo") {
          const g = geo();
          descargarPoligono(h.nombre || "zona de vuelo", g.vuelo.map(g.marco.aLonLat));
          avisar2("KML de la zona descargado");
        } else if (a === "kml-sector") {
          descargarKmlSector(Number(b.dataset.i));
          avisar2("KML descargado");
        } else if (a === "kml-sectores") {
          const g = geo();
          for (let k = 0; k < g.sectores.length; k++) {
            descargarKmlSector(k);
            await new Promise((r) => setTimeout(r, 400));
          }
          avisar2(`${g.sectores.length} KML descargados`);
        } else if (a === "kml-eje-sector") {
          const g = geo(), i = Number(b.dataset.i), linea = g.sectores[i].eje.map(g.marco.aLonLat);
          const nombre = `${h.nombre || "eje"}${g.sectores.length > 1 ? " " + nombreSector(h, i, g.sectores.length) : ""}`;
          descargar(`${nombreArchivoSeguro(nombre)}_eje.kml`, kmlDeLinea(nombre, limpiarEje({ linea, vertices: linea.length }, { maxVertices: st.maxVertices }).linea), TIPO_KML);
          avisar2("Eje descargado");
        } else if (a === "ir-sector") {
          h.area.sel = Number(b.dataset.i);
          st.paso = "vuelo";
          st.dibujo = null;
          cambio();
        } else if (a === "rumbo" || a === "rumbo-auto" || a === "rumbo-corto") {
          const g = geo(), i = secSel(), meta = metaSector(h, i), r = calcularSector(h, dron(), g, i);
          if (!r || r.corredor) return;
          if (a === "rumbo") meta.rumbo = String(((Math.round(r.rumbo) + Number(b.dataset.d)) % 180 + 180) % 180);
          else if (a === "rumbo-auto") meta.rumbo = "";
          else {
            let mejor = 0, minimo = Infinity;
            const prueba = (rr) => calcularSector(h, dron(), g, i, { rumbo: rr, velocidad: r.velocidad }).minTotal;
            for (let rr = 0; rr < 180; rr += 5) {
              const m = prueba(rr);
              if (m < minimo - 1e-6) {
                minimo = m;
                mejor = rr;
              }
            }
            for (let rr = mejor - 4; rr <= mejor + 4; rr++) {
              const x = (rr + 180) % 180;
              const m = prueba(x);
              if (m < minimo - 1e-6) {
                minimo = m;
                mejor = x;
              }
            }
            meta.rumbo = String(mejor);
            avisar2(`Rumbo ${mejor}°: el que da menos tiempo con este despegue (${fmtDuracion(minimo)} de jornada).`);
            cambio();
            await render();
            return;
          }
          cambio();
          refrescarVuelo();
          return;
        } else if (a === "vel-auto") {
          h.params.velocidad = "";
          cambio();
          refrescarVuelo();
          return;
        } else if (a === "leyenda") {
          st.leyendaAbierta = !st.leyendaAbierta;
          poner("vu-leyenda", htmlLeyenda(calcularSector(h, dron(), geo(), secSel())));
          return;
        } else if (a === "usar-gsd") {
          const g = Number(b.dataset.g);
          h.params.porGsd = true;
          h.params.gsd = String(g);
          ponerValor("gsd", g);
          ponerValor("altura", Math.round(alturaParaGsd(dron(), g)));
          cambio();
          refrescarVuelo();
          return;
        } else if (a === "agregar-gsd") {
          const i = raiz.querySelector('input[data-campo="gsdNuevo"]');
          const g = Math.round(Number(num(i && i.value)) * 100) / 100;
          if (!(g > 0.2 && g < 20)) {
            if (i) i.focus();
            return;
          }
          if (!st.gsdExtra.includes(g)) st.gsdExtra.push(g);
          refrescarVuelo();
          return;
        } else if (a === "quitar-gsd") {
          const g = Number(b.dataset.g);
          st.gsdExtra = st.gsdExtra.filter((x) => x !== g);
          refrescarVuelo();
          return;
        } else if (a === "copiar-tabla" || a === "excel-tabla") {
          const g = geo(), i = secSel(), r = calcularSector(h, dron(), g, i);
          const filas = opcionesGsd(r);
          const tabla = [
            ["GSD (cm/px)", "Altura (m)", `Tiempo a ${fmt(st.velA, 1)} m/s`, "Baterías", `Tiempo a ${fmt(st.velB, 1)} m/s`, "Baterías"],
            ...filas.map((f) => [fmt(f.gsd, 2), fmt(f.altura, 0) + (f.sobre120 ? " *" : ""), fmtDuracion(f.a.minMision), String(f.a.vuelos), fmtDuracion(f.z.minMision), String(f.z.vuelos)])
          ];
          const titulo = `${h.nombre || "Área"}${g.sectores.length > 1 ? " · " + nombreSector(h, i, g.sectores.length) : ""} · ${fmt(r.area / 1e4, 2)} ha · ${dron().nombre} · traslape ${h.params.traslapeFrontal}/${h.params.traslapeLateral} %`;
          if (a === "copiar-tabla") {
            const anchos = tabla[0].map((_, c) => Math.max(...tabla.map((f) => f[c].length)));
            await navigator.clipboard.writeText([titulo, "", ...tabla.map((f) => f.map((v, c) => c === 0 ? v.padEnd(anchos[c]) : v.padStart(anchos[c])).join("   ")), "", "Tiempo de vuelo estimado; no incluye traslados al lugar ni armado del equipo." + (tabla.some((f) => f[1].endsWith("*")) ? " * Sobre 120 m requiere autorización DGAC." : "")].join("\n"));
            avisar2("Tabla copiada: pégala en el correo.");
          } else {
            if (!globalThis.XLSX) await cargarScript("vendor/xlsx.full.min.js");
            const ws = XLSX.utils.aoa_to_sheet([[titulo], [], ...tabla]);
            ws["!cols"] = [14, 12, 16, 10, 16, 10].map((w) => ({ wch: w }));
            const libro = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(libro, ws, "Opciones GSD");
            XLSX.writeFile(libro, `Opciones_GSD_${nombreArchivoSeguro(h.nombre || "area")}.xlsx`);
            avisar2("Excel descargado.");
          }
        } else if (a === "quitar-viento") {
          h.viento.splice(Number(b.dataset.k), 1);
          cambio();
        } else if (a === "consulta") {
          h.permisos.consultas.push({ id: globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), tipo: b.dataset.tipo, fecha: (/* @__PURE__ */ new Date()).toISOString(), personaId: ctx2.personaId });
          avisar2("Consulta registrada");
          cambio();
        } else if (a === "ver-captura") {
          await abrirArchivo(b.dataset.id);
          return;
        } else if (a === "kml-limpio") {
          const p = st.kml.poligonos[Number(b.dataset.i)];
          const limpio = limpiarParaDji(p, { maxVertices: st.maxVertices });
          descargar(`${nombreArchivoSeguro(p.nombre)}.kml`, kmlDePoligono(p.nombre, limpio.anillo), TIPO_KML);
          avisar2(limpio.verticesOriginales > limpio.vertices ? `Descargado: ${limpio.verticesOriginales} → ${limpio.vertices} vértices.` : `Descargado con ${limpio.vertices} vértices.`);
          if (p.cruces) avisar2("Descargado, pero el contorno se cruza consigo mismo: corrígelo antes de usarlo.", "error");
        } else if (a === "eje-limpio") {
          const e = limpiarEje(st.kml.ejes[Number(b.dataset.i)], { maxVertices: st.maxVertices });
          descargar(`${nombreArchivoSeguro(e.nombre)}.kml`, kmlDeLinea(e.nombre, e.linea), TIPO_KML);
          avisar2(`Línea descargada con ${e.vertices} vértices.`);
        } else if (a === "kml-a-hoja") {
          const p = st.kml.poligonos[Number(b.dataset.i)], arch = st.kml.archivo;
          await abrirHoja(null);
          usarPoligono(p, arch);
          st.paso = "area";
        } else if (a === "eje-a-hoja") {
          const e = st.kml.ejes[Number(b.dataset.i)], arch = st.kml.archivo;
          await abrirHoja(null);
          usarEje(e, arch);
          st.paso = "area";
        } else if (a === "restablecer-dron") {
          await restablecerDron(b.dataset.id);
          avisar2("Valores de fábrica restablecidos");
        } else return;
      } catch (e) {
        console.error(e);
        avisar2(e.message || "No se pudo completar", "error");
      }
      await render();
    });
    (async () => {
      if (ctx2.planId) await abrirHoja(ctx2.planId);
      else if (ctx2.proyectoId) await abrirHoja(null);
      await render();
    })();
    return {
      desmontar() {
        activo2 = false;
        guardarAhora();
        for (const m of Object.values(mapas)) m.mapa.remove();
        raiz.remove();
      },
      refrescar() {
        if (st.vista === "hojas" || st.vista === "drones") render();
      }
    };
  }

  // modulos/vuelos/vuelos.js
  var ALMACENES2 = Object.values(ALM3);
  var iniciado2 = false;
  function iniciar3({ personaId } = {}) {
    if (!iniciado2) {
      iniciarDatos2({ personaId: personaId != null ? personaId : null });
      iniciado2 = true;
    } else if (personaId !== void 0) fijarPersona2(personaId);
  }
  function montar2(contenedor2, contexto) {
    iniciar3({ personaId: contexto.personaId });
    return montarPantallas2(contenedor2, contexto);
  }
  async function planesDeProyecto2(proyectoId) {
    iniciar3();
    const [planes, drones] = await Promise.all([planesDeProyecto(proyectoId), listarDrones()]);
    return planes.map((p) => ({ id: p.id, nombre: p.nombre, dronId: p.dronId, dron: (drones.find((d) => d.id === p.dronId) || {}).nombre || p.dronId, resumen: p.resumen || {} }));
  }

  // app/nube-panel.js
  var esc = (s) => String(s != null ? s : "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var hora = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  };
  var sesion = { leer: (k) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  }, escribir: (k, v) => {
    try {
      v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v);
    } catch {
    }
  } };
  function iniciarPanelNube({ pastilla, alLlegarDatos }) {
    const config = window.TOPOLAND_CONFIG || {};
    configurar({ clienteId: config.googleClientId || void 0, api: config.driveApi || void 0 });
    iniciar();
    window.TopolandNube = nube_exports;
    const url = new URL(location.href);
    if (url.searchParams.get("carpeta")) {
      sesion.escribir("topoland_invitacion", url.searchParams.get("carpeta"));
      url.searchParams.delete("carpeta");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    const dlg = document.createElement("dialog");
    dlg.className = "nube-panel";
    document.body.appendChild(dlg);
    let carpetasEncontradas = null;
    let ocupado = false;
    let mensaje = null;
    function textoPastilla(e) {
      if (!e.configurado || !e.carpetaId) return "Conectar nube";
      if (!e.conectado) return "Reconectar nube";
      if (e.sincronizando) return "Sincronizando…";
      if (e.error) return "Nube con error";
      if (e.pendiente) return "Nube pendiente";
      return `Nube al día · ${e.ultimaSync ? new Date(e.ultimaSync).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }) : ""}`;
    }
    alEstado((e) => {
      pastilla.textContent = textoPastilla(e);
      pastilla.dataset.estado = e.error ? "error" : e.conectado && e.carpetaId ? "ok" : "off";
      if (dlg.open && !ocupado) pintar();
    });
    alDatosRemotos((r) => {
      if (alLlegarDatos) alLlegarDatos(r);
    });
    async function accion(fn, okTexto) {
      ocupado = true;
      mensaje = null;
      pintar();
      try {
        await fn();
        if (okTexto) mensaje = { tipo: "ok", texto: okTexto };
      } catch (e) {
        console.warn(e);
        mensaje = { tipo: "error", texto: e.message };
      } finally {
        ocupado = false;
        pintar();
      }
    }
    function pintar() {
      const e = estado();
      const invitacion = sesion.leer("topoland_invitacion");
      const http = /^https?:/.test(location.protocol);
      let cuerpo = "";
      if (!http) {
        cuerpo = `<p class="np-aviso">Para conectar con Google, abre la app desde su dirección web (GitHub Pages). Abierta con doble clic desde la carpeta, Google no permite iniciar sesión.</p>`;
      } else if (!e.configurado) {
        cuerpo = `<p>Falta el <b>Client ID</b> de tu proyecto de Google Cloud (el que termina en <code>.apps.googleusercontent.com</code>). Lo ideal es escribirlo una vez en <code>config.js</code>; también puedes pegarlo aquí (queda solo en este dispositivo).</p>
        <form data-np="cliente"><input name="cliente" placeholder="1234…apps.googleusercontent.com" required><button class="np-btn primario">Guardar</button></form>`;
      } else if (!e.conectado) {
        cuerpo = `<p>${e.carpetaId ? `Carpeta: <b>${esc(e.carpetaNombre)}</b>. La conexión con Google dura una hora; vuelve a conectar para seguir sincronizando.` : "Conecta tu cuenta de Google para guardar y compartir los datos en Drive."}</p>
        <button class="np-btn primario" data-np="conectar">${e.carpetaId ? "Reconectar con Google" : "Conectar con Google"}</button>
        ${invitacion && !e.carpetaId ? '<p class="np-ok">Te invitaron a una carpeta compartida: después de conectar, podrás usarla.</p>' : ""}`;
      } else if (!e.carpetaId) {
        cuerpo = `${invitacion ? `<div class="np-caja"><b>Te invitaron a una carpeta compartida</b>
          <label class="np-check"><input type="checkbox" id="np-limpiar" checked> Empezar desde la nube (borra los datos de prueba de este dispositivo, para no duplicar equipos)</label>
          <button class="np-btn primario" data-np="invitacion">Usar la carpeta compartida</button></div>` : ""}
        <div class="np-caja"><b>Crear una carpeta nueva</b><p>Se crea «${esc(NOMBRE_CARPETA_PRUEBA)}» en tu Drive. Después la compartes con tu compañero.</p>
          <button class="np-btn ${invitacion ? "" : "primario"}" data-np="crear">Crear carpeta</button></div>
        <div class="np-caja"><b>Usar una carpeta que ya existe</b>
          <button class="np-btn" data-np="buscar">Buscar «${esc(NOMBRE_CARPETA_PRUEBA)}»</button>
          ${carpetasEncontradas ? carpetasEncontradas.length ? `<ul class="np-lista">${carpetasEncontradas.map((c) => `<li><span>${esc(c.name)}</span> <button class="np-btn chico" data-np="usar" data-id="${esc(c.id)}">Usar</button></li>`).join("")}</ul>` : '<p class="np-tenue">No encontré carpetas con ese nombre a las que tengas acceso.</p>' : ""}
          <form data-np="enlace"><input name="enlace" placeholder="o pega el enlace de la carpeta de Drive" required><button class="np-btn">Usar</button></form>
          <label class="np-check"><input type="checkbox" id="np-limpiar2"> Empezar desde la nube (borra los datos de prueba de este dispositivo)</label></div>`;
      } else {
        const inv = enlaceInvitacion();
        cuerpo = `<dl class="np-datos">
          <div><dt>Carpeta</dt><dd><a href="https://drive.google.com/drive/folders/${esc(e.carpetaId)}" target="_blank" rel="noopener">${esc(e.carpetaNombre)} ↗</a></dd></div>
          <div><dt>Última sincronización</dt><dd>${hora(e.ultimaSync)}${e.ultimoResumen ? ` · ${e.ultimoResumen.recibidos} recibidos${e.ultimoResumen.archivosSubidos ? `, ${e.ultimoResumen.archivosSubidos} archivos subidos` : ""}` : ""}</dd></div>
          <div><dt>Estado</dt><dd>${e.sincronizando ? "Sincronizando…" : e.error ? `<span class="np-error-txt">${esc(e.error)}</span>` : e.pendiente ? "Hay cambios por subir" : "Al día"}</dd></div>
        </dl>
        <button class="np-btn primario" data-np="sincronizar">Sincronizar ahora</button>
        <div class="np-caja"><b>Invitar a tu compañero</b>
          <ol><li>En Drive, comparte la carpeta con su cuenta de Google como <b>Editor</b>.</li>
          <li>Envíale este enlace; al abrirlo y conectar, usará la misma carpeta.</li></ol>
          <div class="np-enlace"><input readonly value="${esc(inv)}"><button class="np-btn chico" data-np="copiar">Copiar</button></div></div>
        <div class="np-pie"><button class="np-btn chico" data-np="cambiar">Cambiar de carpeta</button><button class="np-btn chico" data-np="desconectar">Desconectar</button></div>`;
      }
      dlg.innerHTML = `<div class="np-cab"><b>☁ Nube · Google Drive</b><button class="np-x" data-np="cerrar" aria-label="Cerrar">✕</button></div>
      ${mensaje ? `<p class="np-msg ${mensaje.tipo}">${esc(mensaje.texto)}</p>` : ""}
      ${ocupado ? '<p class="np-tenue">Un momento…</p>' : ""}
      <div class="np-cuerpo"${ocupado ? " inert" : ""}>${cuerpo}</div>
      <p class="np-tenue np-nota">Los datos se guardan primero en este dispositivo y se sincronizan solos cada minuto y medio si hay conexión. Cada dispositivo escribe su propio archivo en <code>datos/</code>; los PDF y fotos quedan ordenados en carpetas (<code>Equipos/</code>).</p>`;
    }
    dlg.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-np]");
      if (!b || b.tagName === "FORM") {
        if (ev.target === dlg) dlg.close();
        return;
      }
      const limpiar2 = () => !!(dlg.querySelector("#np-limpiar2") || {}).checked;
      switch (b.dataset.np) {
        case "cerrar":
          dlg.close();
          break;
        case "conectar":
          accion(() => conectar(), "Conectado con Google");
          break;
        case "crear":
          accion(() => crearCarpeta(), "Carpeta creada y sincronizada");
          break;
        case "buscar":
          accion(async () => {
            carpetasEncontradas = await buscarCarpetas();
          });
          break;
        case "usar":
          accion(() => usarCarpeta(b.dataset.id, { empezarDesdeNube: limpiar2() }), "Carpeta conectada y sincronizada");
          break;
        case "invitacion": {
          const borrar = !!(dlg.querySelector("#np-limpiar") || {}).checked;
          if (borrar && !confirm("Se borrarán los equipos y datos de prueba de ESTE dispositivo y se bajarán los de la carpeta compartida. ¿Seguir?")) return;
          accion(async () => {
            await usarCarpeta(sesion.leer("topoland_invitacion"), { empezarDesdeNube: borrar });
            sesion.escribir("topoland_invitacion", null);
          }, "Listo: ya trabajas en la carpeta compartida");
          break;
        }
        case "sincronizar":
          accion(() => sincronizar(), "Sincronizado");
          break;
        case "copiar": {
          const inp = dlg.querySelector(".np-enlace input");
          (navigator.clipboard ? navigator.clipboard.writeText(inp.value) : Promise.reject()).then(() => {
            mensaje = { tipo: "ok", texto: "Enlace copiado" };
            pintar();
          }).catch(() => {
            inp.select();
            document.execCommand("copy");
          });
          break;
        }
        case "cambiar":
          if (!confirm("¿Dejar de usar esta carpeta? Los datos de este dispositivo no se borran.")) return;
          desconectar({ olvidarCarpeta: true });
          carpetasEncontradas = null;
          mensaje = null;
          pintar();
          break;
        case "desconectar":
          desconectar();
          mensaje = { tipo: "ok", texto: "Desconectado. Los datos siguen en este dispositivo." };
          pintar();
          break;
      }
    });
    dlg.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = ev.target;
      if (f.dataset.np === "cliente") {
        configurar({ clienteId: f.cliente.value });
        mensaje = { tipo: "ok", texto: "Client ID guardado" };
        pintar();
      }
      if (f.dataset.np === "enlace") {
        const limpiar2 = !!(dlg.querySelector("#np-limpiar2") || {}).checked;
        accion(() => usarCarpeta(f.enlace.value, { empezarDesdeNube: limpiar2 }), "Carpeta conectada y sincronizada");
      }
    });
    pastilla.addEventListener("click", () => {
      mensaje = null;
      pintar();
      dlg.showModal();
    });
    if (sesion.leer("topoland_invitacion") && !estado().carpetaId) setTimeout(() => {
      pintar();
      dlg.showModal();
    }, 400);
  }

  // app/catalogo.js
  var ROLES = {
    terreno: "Encargado de terreno",
    rrhh: "Administración / RRHH"
  };
  var CATEGORIAS_TRABAJO = [
    { k: "dron", t: "Dron", det: [["aerofoto", "Aerofotogrametría"], ["lidar", "LiDAR"], ["termografia", "Termografía"]] },
    { k: "nivelacion", t: "Nivelación", det: [["simple", "Simple"], ["cerrada", "Cerrada"]] },
    { k: "gnss", t: "GNSS", det: [["rtk", "RTK"], ["estatico", "Estático"], ["red", "Red geodésica"]] },
    { k: "estacion", t: "Estación total", det: [["levantamiento", "Levantamiento"], ["poligonal", "Poligonal"], ["replanteo", "Replanteo"], ["cubicacion", "Cubicación"], ["catastro", "Catastro"]] },
    { k: "escaneo", t: "Escaneos", det: [["estatico", "Estático (FARO)"], ["slam", "Móvil (SLAM)"]] },
    { k: "batimetria", t: "Batimetría", det: [["bote", "Con bote"]] },
    { k: "otro", t: "Otro", det: [["gpr", "GPR"], ["otro", "Otro"]], texto: true }
  ];
  var NOMBRE_CATEGORIA = Object.fromEntries(CATEGORIAS_TRABAJO.map((c) => [c.k, c.t]));
  var NOMBRE_DETALLE = Object.fromEntries(CATEGORIAS_TRABAJO.flatMap((c) => c.det.map(([d, t]) => [`${c.k}:${d}`, t])));
  var TIPO_ANTIGUO = {
    aerofoto: "dron:aerofoto",
    lidar: "dron:lidar",
    termografia: "dron:termografia",
    levantamiento: "estacion:levantamiento",
    rtk: "gnss:rtk",
    replanteo: "estacion:replanteo",
    cubicacion: "estacion:cubicacion",
    red: "gnss:red",
    escaneo: "escaneo:estatico",
    slam: "escaneo:slam",
    batimetria: "batimetria:bote",
    gpr: "otro:gpr"
  };
  function tiposDeProyecto(p) {
    const cats = /* @__PURE__ */ new Set();
    const det = new Set(p.tiposDetalle || []);
    for (const t of p.tiposTrabajo || []) {
      if (NOMBRE_CATEGORIA[t]) cats.add(t);
      else if (TIPO_ANTIGUO[t]) {
        const v = TIPO_ANTIGUO[t];
        cats.add(v.split(":")[0]);
        det.add(v);
      }
    }
    for (const d of det) cats.add(d.split(":")[0]);
    const orden = CATEGORIAS_TRABAJO.map((c) => c.k);
    return { categorias: [...cats].sort((a, b) => orden.indexOf(a) - orden.indexOf(b)), detalles: [...det] };
  }
  function textosTipos(p) {
    const { categorias, detalles } = tiposDeProyecto(p);
    return categorias.map((c) => {
      const ds = detalles.filter((d) => d.startsWith(c + ":")).map((d) => d === "otro:otro" && p.tipoOtro ? p.tipoOtro : NOMBRE_DETALLE[d]).filter(Boolean);
      if (c === "otro" && !ds.length && p.tipoOtro) ds.push(p.tipoOtro);
      return ds.length ? `${NOMBRE_CATEGORIA[c]} · ${ds.join(", ")}` : NOMBRE_CATEGORIA[c];
    });
  }
  var ROLES_PERSONA = [
    ["encargado", "Encargado de terreno"],
    ["ayudante", "Ayudante"],
    ["rrhh", "Administración / RRHH"],
    ["dibujo", "Dibujo / gabinete"],
    ["direccion", "Dirección / comercial"]
  ];
  var NOMBRE_ROL_PERSONA = Object.fromEntries(ROLES_PERSONA);
  var REGIONES = [
    "Arica y Parinacota",
    "Tarapacá",
    "Antofagasta",
    "Atacama",
    "Coquimbo",
    "Valparaíso",
    "Metropolitana",
    "O'Higgins",
    "Maule",
    "Ñuble",
    "Biobío",
    "La Araucanía",
    "Los Ríos",
    "Los Lagos",
    "Aysén",
    "Magallanes"
  ];
  var COLORES_MARCA = [
    ["#1D5C63", "Azul petróleo"],
    ["#1D4ED8", "Azul"],
    ["#0F766E", "Verde"],
    ["#C2410C", "Naranjo"],
    ["#1C1F23", "Grafito"]
  ];

  // app/version.js
  var VERSION_SISTEMA = "0.4";
  var MODULOS_INCLUIDOS = "Equipos 0.1f + Vuelos 0.3";

  // app/vistas.js
  var ICONO = {
    equipo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11"/><path d="M5 21l7-7 7 7"/><circle cx="12" cy="3" r="1.5"/></svg>',
    alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4"/><path d="M12 17.5v.5"/></svg>',
    calib: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    proyecto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h6l2 2h10v10H3z"/></svg>',
    pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/></svg>'
  };
  var nivelCal = {
    vencida: (c) => `<span class="sis-chip rojo">Calibración vencida hace ${-c.dias} d</span>`,
    por_vencer: (c) => `<span class="sis-chip ambar">Calibración vence en ${c.dias} d</span>`,
    sin_dato: () => '<span class="sis-chip ambar">Falta fecha de calibración</span>',
    ok: (c) => `<span class="sis-chip verde">Calibración al día · ${fechaLegible(c.proxima)}</span>`,
    no_aplica: () => '<span class="sis-chip gris">No requiere calibración</span>'
  };
  var chipCal = (c) => (nivelCal[c.nivel] || nivelCal.sin_dato)(c);
  var chipAlertas = (n) => n ? `<span class="sis-chip rojo">${n} alerta${n > 1 ? "s" : ""} abierta${n > 1 ? "s" : ""}</span>` : "";
  var LUGAR = { oficina: "En oficina", terreno: "En terreno", mantencion: "En mantención", baja: "De baja" };
  function filaEquipo(e, { nombreProyecto } = {}) {
    const lugar = e.ubicacion.lugar === "terreno" && nombreProyecto ? `<span class="sis-chip azul">${escapar(nombreProyecto(e.ubicacion.proyectoId))}</span>` : `<span class="sis-chip gris">${LUGAR[e.ubicacion.lugar] || ""}</span>`;
    return `<a class="sis-fila" href="#/equipos/${escapar(e.id)}">
    <span class="sis-fila-txt"><b>${escapar(e.nombre)}</b><span class="sis-tenue">${escapar([e.equipo, e.numeroSerie && `N° ${e.numeroSerie}`].filter(Boolean).join(" · "))}</span></span>
    <span class="sis-chips">${lugar}${chipCal(e.calibracion)}${chipAlertas(e.alertasActivas.length)}</span>
  </a>`;
  }
  var vacio = (texto3, extra = "") => `<div class="sis-vacio"><p>${texto3}</p>${extra}</div>`;
  async function inicio(ctx2) {
    var _a;
    const [personas2, proyectos2, equipos] = await Promise.all([listarPersonas(), listarProyectos(), listarEquiposConEstado()]);
    const yo = ctx2.personaId ? personas2.find((p) => p.id === ctx2.personaId) : null;
    const nomProy = (id) => (proyectos2.find((p) => p.id === id) || {}).nombre || (id === OFICINA_ID ? "Oficina" : "Proyecto");
    let bienvenida = "";
    if (!personas2.length || !yo) {
      bienvenida = `<section class="sis-tarjeta sis-destacada">
      <h2>${personas2.length ? "Elige quién eres" : "Primero, crea tu persona"}</h2>
      <p>El Sistema anota quién hace cada cosa (salidas, alertas, abonos). ${personas2.length ? "Elígete arriba, en la lista de personas, o crea tu ficha aquí." : "Crea tu ficha para empezar; después RRHH puede agregar al resto del equipo en «Personas»."}</p>
      <form class="sis-form-linea" data-form="persona-rapida">
        <input name="nombre" placeholder="Tu nombre" required aria-label="Nombre">
        <input name="cargo" placeholder="Cargo (geomensor, RRHH…)" aria-label="Cargo">
        <button class="sis-btn primario">Crear y usar</button>
      </form>
    </section>`;
    }
    const activos = proyectos2.filter((p) => p.id !== OFICINA_ID && p.estado !== "cerrado");
    const saludo = `<div class="sis-saludo">
      <h1>${yo ? `Hola, ${escapar(yo.nombre.split(" ")[0])}` : "Inicio"}</h1>
      <span class="sis-tenue">${ROLES[ctx2.rol]} · Sistema v${VERSION_SISTEMA} · ${fechaLegible(hoyISO())}</span>
    </div>`;
    if (ctx2.rol === "rrhh") {
      const vigentes = equipos;
      const vencidas = vigentes.filter((e) => e.calibracion.nivel === "vencida");
      const porVencer = vigentes.filter((e) => e.calibracion.nivel === "por_vencer");
      const sinDato = vigentes.filter((e) => e.calibracion.nivel === "sin_dato");
      const conAlerta = vigentes.filter((e) => e.alertasActivas.length);
      const enTerreno = vigentes.filter((e) => e.ubicacion.lugar === "terreno");
      const porProyecto = {};
      for (const e of enTerreno) (porProyecto[_a = e.ubicacion.proyectoId] || (porProyecto[_a] = [])).push(e);
      const revisar2 = [...vencidas, ...porVencer, ...sinDato];
      return `${saludo}${bienvenida}
      <div class="sis-kpis">
        <a class="sis-kpi ${vencidas.length ? "rojo" : ""}" href="#/equipos"><span>${ICONO.calib}Calibraciones vencidas</span><b>${vencidas.length}</b></a>
        <a class="sis-kpi ${porVencer.length ? "ambar" : ""}" href="#/equipos"><span>${ICONO.calib}Por vencer (30 días)</span><b>${porVencer.length}</b></a>
        <a class="sis-kpi ${conAlerta.length ? "rojo" : ""}" href="#/equipos"><span>${ICONO.alerta}Equipos con alerta</span><b>${conAlerta.length}</b></a>
        <a class="sis-kpi" href="#/equipos"><span>${ICONO.equipo}En terreno</span><b>${enTerreno.length}<small> de ${vigentes.length}</small></b></a>
      </div>
      <div class="sis-dos"><div>
        <section class="sis-tarjeta">
          <h2>Calibraciones por revisar</h2>
          ${revisar2.length ? `<div class="sis-lista">${revisar2.slice(0, 10).map((e) => filaEquipo(e, { nombreProyecto: nomProy })).join("")}</div>${revisar2.length > 10 ? `<p class="sis-tenue">y ${revisar2.length - 10} más en Equipos → filtro «Calibración por revisar».</p>` : ""}` : vacio(vigentes.length ? "Todas las calibraciones están al día." : "Aún no hay equipos cargados. Ve a Equipos → Administrar → Importar planilla.")}
        </section>
        <section class="sis-tarjeta">
        <h2>Equipos en terreno, por proyecto</h2>
        ${Object.keys(porProyecto).length ? Object.entries(porProyecto).map(([pid, lista]) => `
          <div class="sis-grupo"><a class="sis-grupo-cab" href="#/proyecto/${escapar(pid)}">${ICONO.proyecto}${escapar(nomProy(pid))} <span class="sis-tenue">${lista.length} equipo${lista.length > 1 ? "s" : ""}</span></a>
          <div class="sis-lista">${lista.map((e) => filaEquipo(e)).join("")}</div></div>`).join("") : vacio("No hay equipos fuera de la oficina.")}
      </section>
      </div><aside>
        <section class="sis-tarjeta">
          <h2>Alertas abiertas</h2>
          ${conAlerta.length ? `<div class="sis-lista">${conAlerta.map((e) => `<a class="sis-fila" href="#/equipos/${escapar(e.id)}">
              <span class="sis-fila-txt"><b>${escapar(e.nombre)}</b>${e.alertasActivas.map((a) => `<span class="sis-tenue">${escapar(a.descripcion)} · desde ${fechaLegible((a.fechaReporte || "").slice(0, 10))}</span>`).join("")}</span>
              <span class="sis-chips">${e.alertasActivas.map((a) => `<span class="sis-chip rojo">${escapar(estadoAlerta(a.estado))}</span>`).join("")}</span></a>`).join("")}</div>` : vacio("No hay alertas abiertas.")}
        </section>
      </aside></div>`;
    }
    const aMiCargo = yo ? equipos.filter((e) => e.ubicacion.lugar === "terreno" && e.ubicacion.personaId === yo.id) : [];
    const avisos = aMiCargo.filter((e) => e.alertasActivas.length || ["vencida", "por_vencer"].includes(e.calibracion.nivel));
    const misProyectos = yo ? activos.filter((p) => p.encargadoId === yo.id) : [];
    const otros = activos.filter((p) => !misProyectos.includes(p));
    const tarjetaProy = (p) => `<a class="sis-proy" href="#/proyecto/${escapar(p.id)}">
      <b>${escapar(p.nombre)}</b><span class="sis-tenue">${escapar(p.mandante || "Sin mandante")}${p.comuna ? ` · ${escapar(p.comuna)}` : ""}</span>
      <span class="sis-chips">${tiposDeProyecto(p).categorias.map((t) => `<span class="sis-chip gris">${escapar(NOMBRE_CATEGORIA[t])}</span>`).join("")}</span></a>`;
    return `${saludo}${bienvenida}
    <div class="sis-dos"><div>
    ${avisos.length ? `<section class="sis-tarjeta sis-aviso"><h2>${ICONO.alerta} Ojo con estos equipos a tu cargo</h2>
      <div class="sis-lista">${avisos.map((e) => filaEquipo(e, { nombreProyecto: nomProy })).join("")}</div>
      <p class="sis-tenue">Se pueden usar igual: el uso con alerta queda registrado.</p></section>` : ""}
      <section class="sis-tarjeta">
        <div class="sis-cab"><h2>Proyectos activos</h2><a class="sis-btn chico" href="#/proyecto-editar/nuevo">+ Proyecto</a></div>
        ${misProyectos.length ? `<p class="sis-sub">A mi cargo</p><div class="sis-proys">${misProyectos.map(tarjetaProy).join("")}</div>` : ""}
        ${otros.length ? `${misProyectos.length ? '<p class="sis-sub">Otros</p>' : ""}<div class="sis-proys">${otros.map(tarjetaProy).join("")}</div>` : ""}
        ${!activos.length ? vacio("Aún no hay proyectos. Crea el primero con el encargo que te llegó.") : ""}
      </section>
    </div><aside>
      <section class="sis-tarjeta">
        <h2>Equipos a mi cargo</h2>
        ${aMiCargo.length ? `<div class="sis-lista">${aMiCargo.map((e) => filaEquipo(e, { nombreProyecto: nomProy })).join("")}</div>` : vacio(
      yo ? "No tienes equipos a tu cargo. Se asignan al confirmar el checklist de salida en Equipos." : "Elige tu persona para ver tus equipos.",
      yo ? '<a class="sis-btn" href="#/equipos">Ir a Equipos</a>' : ""
    )}
      </section>
    </aside></div>`;
  }
  function estadoAlerta(e) {
    return { abierta: "Abierta", en_mantencion: "En mantención", recibida: "Recibida de mantención", cerrada: "Cerrada" }[e] || e;
  }
  async function proyectos(ctx2) {
    const [lista, personas2, equipos] = await Promise.all([listarProyectos(), listarPersonas(), listarEquiposConEstado()]);
    const verCerrados = ctx2.estado.verCerrados;
    const nomPers = (id) => (personas2.find((p) => p.id === id) || {}).nombre || "";
    const enProyecto = (id) => equipos.filter((e) => e.ubicacion.lugar === "terreno" && e.ubicacion.proyectoId === id).length;
    const visibles = lista.filter((p) => p.id === OFICINA_ID || verCerrados || p.estado !== "cerrado");
    const nCerrados = lista.filter((p) => p.estado === "cerrado").length;
    const eliminados = (await enPapelera("compartido_proyectos")).map((x) => x.registro);
    return `<div class="sis-cab"><h1>Proyectos</h1><a class="sis-btn primario" href="#/proyecto-editar/nuevo">+ Proyecto</a></div>
    <p class="sis-tenue">El proyecto es el eje: de aquí cuelgan los equipos que salen, los certificados para el mandante y, en las próximas versiones, los gastos y las jornadas.</p>
    ${nCerrados ? `<label class="sis-check"><input type="checkbox" data-accion="ver-cerrados" ${verCerrados ? "checked" : ""}> Mostrar cerrados (${nCerrados})</label>` : ""}
    <div class="sis-proys grande">${visibles.map((p) => `<a class="sis-proy" href="#/proyecto/${escapar(p.id)}">
        <span class="sis-proy-cab"><b>${escapar(p.nombre)}</b>${p.id === OFICINA_ID ? '<span class="sis-chip gris">Especial</span>' : p.estado === "cerrado" ? '<span class="sis-chip gris">Cerrado</span>' : '<span class="sis-chip verde">Activo</span>'}</span>
        <span class="sis-tenue">${escapar(p.mandante || (p.id === OFICINA_ID ? "Trabajo que no es de un contrato" : "Sin mandante"))}${p.comuna ? ` · ${escapar(p.comuna)}` : ""}${p.encargadoId ? ` · ${escapar(nomPers(p.encargadoId))}` : ""}</span>
        <span class="sis-chips">${tiposDeProyecto(p).categorias.map((t) => `<span class="sis-chip gris">${escapar(NOMBRE_CATEGORIA[t])}</span>`).join("")}${enProyecto(p.id) ? `<span class="sis-chip azul">${enProyecto(p.id)} equipo${enProyecto(p.id) > 1 ? "s" : ""} en terreno</span>` : ""}</span>
      </a>`).join("")}</div>
    ${eliminados.length ? `<details class="sis-papelera"><summary>Papelera de proyectos (${eliminados.length})</summary>
      <section class="sis-tarjeta"><div class="sis-lista">${eliminados.map((p) => `<div class="sis-fila">
        <span class="sis-fila-txt"><b>${escapar(p.nombre)}</b><span class="sis-tenue">Eliminado ${fechaHoraLegible(p.eliminadoEn)}</span></span>
        <button class="sis-btn chico" data-accion="restaurar-proyecto" data-id="${escapar(p.id)}">Restaurar</button></div>`).join("")}</div></section></details>` : ""}`;
  }
  async function proyecto(ctx2, id) {
    const p = await obtenerProyecto(id);
    if (!p || p.eliminadoEn) return vacio("Este proyecto no existe o está en la papelera.", '<a class="sis-btn" href="#/proyectos">Volver a Proyectos</a>');
    const [personas2, equipos, certs, planes] = await Promise.all([listarPersonas(), listarEquiposConEstado(), certificadosDeProyecto(id), planesDeProyecto2(id)]);
    const nomPers = (pid) => (personas2.find((x) => x.id === pid) || {}).nombre || "";
    const enProyecto = equipos.filter((e) => e.ubicacion.lugar === "terreno" && e.ubicacion.proyectoId === id);
    const esOficina = id === OFICINA_ID;
    const plazo = p.plazo ? (() => {
      const d = diasEntre(hoyISO(), p.plazo);
      return `${fechaLegible(p.plazo)}${d >= 0 ? ` · faltan ${d} d` : ` · vencido hace ${-d} d`}`;
    })() : "";
    const meta = (t, v) => v ? `<span>${t}: <b>${v}</b></span>` : "";
    const certsHtml = certs.length ? `<div class="sis-lista">${certs.map(({ equipo, certificado }) => `<div class="sis-fila">
            <span class="sis-fila-txt"><b>${escapar(equipo.nombre)}</b><span class="sis-tenue">${certificado ? `${escapar(certificado.codigo || "Certificado")} · ${fechaLegible(certificado.fecha)}${certificado.laboratorio ? ` · ${escapar(certificado.laboratorio)}` : ""}` : "Sin certificado cargado"}</span></span>
            ${certificado && certificado.archivoId ? `<button class="sis-btn chico" data-accion="abrir-pdf" data-id="${escapar(certificado.archivoId)}">${ICONO.pdf}PDF</button>` : '<span class="sis-chip ambar">Falta PDF</span>'}
          </div>`).join("")}</div>
          <p class="sis-tenue">Para entregar al mandante los certificados de los equipos que están en este proyecto.</p>` : vacio("Cuando salgan equipos a este proyecto, aquí aparecen sus certificados vigentes.");
    return `<div class="sis-encabezado">
      <div>
        <div class="sis-miga"><a href="#/proyectos">Proyectos</a> / ${escapar(p.nombre)}</div>
        <h1>${escapar(p.nombre)}</h1>
        <div class="sis-meta">
          <span>Mandante: <b>${escapar(p.mandante || (esOficina ? "Trabajo que no es de un contrato" : "—"))}</b></span>
          ${esOficina ? "" : `${meta("Encargado", escapar(nomPers(p.encargadoId)))}${meta("Ubicación", escapar([p.comuna, p.region].filter(Boolean).join(", ")))}
          ${meta("Encargado por", escapar(p.solicitadoPor || ""))}${meta("Encargo", p.fechaEncargo ? fechaLegible(p.fechaEncargo) : "")}${meta("Plazo", plazo)}`}
        </div>
        ${textosTipos(p).length ? `<div class="sis-chips" style="margin-top:10px">${textosTipos(p).map((t) => `<span class="sis-chip gris">${escapar(t)}</span>`).join("")}</div>` : ""}
      </div>
      <div class="sis-acciones">${esOficina ? '<span class="sis-chip gris">Especial</span>' : `<span class="sis-chip ${p.estado === "cerrado" ? "gris" : "verde"}">${p.estado === "cerrado" ? "Cerrado" : "Activo"}</span>
        <a class="sis-btn chico" href="#/proyecto-editar/${escapar(p.id)}">Editar</a>`}</div>
    </div>
    ${p.notas ? `<p class="sis-notas">${escapar(p.notas)}</p>` : ""}
    <div class="sis-dos"><div>
      <section class="sis-tarjeta">
        <div class="sis-cab"><h2>Hojas de vuelo</h2>${ctx2.rol === "terreno" ? `<a class="sis-btn chico" href="#/vuelos/proyecto/${escapar(id)}">+ Hoja de vuelo</a>` : ""}</div>
        ${planes.length ? `<div class="sis-lista">${planes.map((v) => `<a class="sis-fila" href="#/vuelos/plan/${escapar(v.id)}">
            <span class="sis-fila-txt"><b>${escapar(v.nombre)}</b><span class="sis-tenue">${escapar(v.dron)}</span></span>
            <span class="sis-chips">${v.resumen.area ? `<span class="sis-chip gris">${(v.resumen.area / 1e4).toLocaleString("es-CL", { maximumFractionDigits: 1 })} ha</span>` : ""}${v.resumen.gsd ? `<span class="sis-chip gris">GSD ${v.resumen.gsd.toLocaleString("es-CL", { maximumFractionDigits: 2 })} cm</span>` : ""}${v.resumen.densidad ? `<span class="sis-chip gris">${Math.round(v.resumen.densidad)} pts/m²</span>` : ""}${v.resumen.vuelos ? `<span class="sis-chip azul">${v.resumen.vuelos} vuelo${v.resumen.vuelos > 1 ? "s" : ""}</span>` : ""}</span></a>`).join("")}</div>` : '<div class="sis-vacio"><p>Sin hojas de vuelo. Desde aquí se arma la hoja: área, plan de vuelo, clima y permisos.</p></div>'}
      </section>
      <section class="sis-tarjeta sis-pronto"><h2>Jornadas de terreno</h2><p>Llega cuando Terreno Topografía entre al Sistema.</p></section>
    </div><aside>
      <section class="sis-tarjeta">
        <h2>Equipos ${esOficina ? "asignados" : "en el proyecto"}</h2>
        ${enProyecto.length ? `<div class="sis-lista">${enProyecto.map((e) => filaEquipo(e)).join("")}</div>` : vacio("No hay equipos asignados. Se asignan con el checklist de salida en Equipos.", '<a class="sis-btn chico" href="#/equipos">Ir a Equipos</a>')}
      </section>
      <section class="sis-tarjeta">
        <h2>Certificados para el mandante</h2>
        ${certsHtml}
      </section>
      <section class="sis-tarjeta sis-pronto"><h2>Gastos del proyecto</h2><p>Cada gasto con su boleta, la rendición y el abono de RRHH. Llega con el módulo Gastos.</p></section>
    </aside></div>`;
  }
  async function proyectoEditar(ctx2, id) {
    const nuevo = id === "nuevo";
    const p = nuevo ? { estado: "activo", tiposTrabajo: [], encargadoId: ctx2.personaId || "", fechaEncargo: hoyISO() } : await obtenerProyecto(id);
    if (!p) return vacio("Este proyecto no existe.");
    if (p.id === OFICINA_ID) return vacio("«Oficina» es un proyecto especial y no se edita.", '<a class="sis-btn" href="#/proyectos">Volver</a>');
    const personas2 = await listarPersonas();
    const val = (k) => {
      var _a;
      return escapar((_a = p[k]) != null ? _a : "");
    };
    const tipos = tiposDeProyecto(p);
    return `<a class="sis-volver" href="${nuevo ? "#/proyectos" : `#/proyecto/${escapar(p.id)}`}">← Volver</a>
    <h1>${nuevo ? "Nuevo proyecto" : "Editar proyecto"}</h1>
    <form class="sis-form" data-form="proyecto" data-id="${nuevo ? "" : escapar(p.id)}">
      <fieldset><legend>Proyecto</legend>
        <label class="sis-campo"><span>Nombre *</span><input name="nombre" required value="${val("nombre")}" placeholder="Canal Norte — levantamiento y batimetría"></label>
        <label class="sis-campo"><span>Mandante</span><input name="mandante" value="${val("mandante")}" placeholder="Empresa que encarga el trabajo"></label>
        <div class="sis-campo"><span>Tipos de trabajo (uno o más; el detalle es opcional)</span>
          <div class="sis-categorias">${CATEGORIAS_TRABAJO.map((c) => `<label class="sis-opcion sis-cat"><input type="checkbox" name="tipos" value="${c.k}" ${tipos.categorias.includes(c.k) ? "checked" : ""}> ${c.t}</label>`).join("")}</div>
          <div class="sis-detalles">${CATEGORIAS_TRABAJO.map((c) => `<div class="sis-detalle" data-cat="${c.k}"><b>${c.t}</b>
            ${c.det.map(([d, t]) => `<label class="sis-opcion chico"><input type="checkbox" name="detalle" value="${c.k}:${d}" ${tipos.detalles.includes(`${c.k}:${d}`) ? "checked" : ""}> ${t}</label>`).join("")}
            ${c.texto ? `<input name="tipoOtro" class="sis-detalle-texto" value="${val("tipoOtro")}" placeholder="¿Cuál?" aria-label="Otro tipo de trabajo">` : ""}</div>`).join("")}</div></div>
        <div class="sis-par">
          <label class="sis-campo"><span>Comuna</span><input name="comuna" value="${val("comuna")}"></label>
          <label class="sis-campo"><span>Región</span><select name="region"><option value=""></option>${REGIONES.map((r) => `<option ${p.region === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
        </div>
        <div class="sis-par">
          <label class="sis-campo"><span>Encargado</span><select name="encargadoId"><option value="">—</option>${personas2.map((x) => `<option value="${escapar(x.id)}" ${p.encargadoId === x.id ? "selected" : ""}>${escapar(x.nombre)}</option>`).join("")}</select></label>
          <label class="sis-campo"><span>Estado</span><select name="estado"><option value="activo">Activo</option><option value="cerrado" ${p.estado === "cerrado" ? "selected" : ""}>Cerrado</option></select></label>
        </div>
      </fieldset>
      <fieldset><legend>Encargo</legend>
        <p class="sis-tenue">Los trabajos llegan por correo: anota quién lo pidió y para cuándo.</p>
        <label class="sis-campo"><span>Encargado por</span><input name="solicitadoPor" value="${val("solicitadoPor")}" placeholder="Quién lo pidió (persona o área)"></label>
        <div class="sis-par">
          <label class="sis-campo"><span>Fecha del encargo</span><input type="date" name="fechaEncargo" value="${val("fechaEncargo")}"></label>
          <label class="sis-campo"><span>Plazo de entrega</span><input type="date" name="plazo" value="${val("plazo")}"></label>
        </div>
        <label class="sis-campo"><span>Notas</span><textarea name="notas" rows="3" placeholder="Alcance, contacto en terreno, adjuntos recibidos…">${val("notas")}</textarea></label>
      </fieldset>
      <div class="sis-acciones"><button class="sis-btn primario">${nuevo ? "Crear proyecto" : "Guardar cambios"}</button>
        ${nuevo ? "" : `<button type="button" class="sis-btn" data-accion="cerrar-proyecto" data-id="${escapar(p.id)}">${p.estado === "cerrado" ? "Reabrir" : "Cerrar proyecto"}</button>
        <button type="button" class="sis-btn peligro" data-accion="eliminar-proyecto" data-id="${escapar(p.id)}">Eliminar</button>`}</div>
      ${nuevo ? "" : '<p class="sis-tenue">«Cerrar» es para un trabajo terminado: queda en el historial. «Eliminar» es para un proyecto creado por error: va a la papelera y se puede restaurar desde Proyectos.</p>'}
    </form>`;
  }
  async function personas(ctx2) {
    const lista = await listarPersonas();
    const editable = ctx2.rol === "rrhh";
    const editando = ctx2.estado.personaEditar;
    const p = editando === "nueva" ? { roles: [] } : editando ? lista.find((x) => x.id === editando) : null;
    const form = p ? `<section class="sis-tarjeta"><h2>${p.id ? "Editar persona" : "Nueva persona"}</h2>
      <form class="sis-form" data-form="persona" data-id="${escapar(p.id || "")}">
        <div class="sis-par">
          <label class="sis-campo"><span>Nombre *</span><input name="nombre" required value="${escapar(p.nombre || "")}"></label>
          <label class="sis-campo"><span>Cargo</span><input name="cargo" value="${escapar(p.cargo || "")}" placeholder="Geomensor, topógrafo, piloto…"></label>
        </div>
        <div class="sis-campo"><span>Roles en el Sistema</span>
          <div class="sis-opciones">${ROLES_PERSONA.map(([k, t]) => `<label class="sis-opcion"><input type="checkbox" name="roles" value="${k}" ${(p.roles || []).includes(k) ? "checked" : ""}> ${t}</label>`).join("")}</div></div>
        <div class="sis-acciones"><button class="sis-btn primario">Guardar</button><button type="button" class="sis-btn" data-accion="cancelar-persona">Cancelar</button></div>
      </form></section>` : "";
    return `<div class="sis-cab"><h1>Personas</h1>${editable && !p ? '<button class="sis-btn primario" data-accion="nueva-persona">+ Persona</button>' : ""}</div>
    <p class="sis-tenue">Quiénes usan el Sistema y qué rol cumplen. Una persona puede tener más de un rol. Los documentos del personal (licencias, exámenes) llegan más adelante, cuando el Sistema esté en el Nextcloud de la empresa.</p>
    ${form}
    <section class="sis-tarjeta">${lista.length ? `<div class="sis-lista">${lista.map((x) => `<div class="sis-fila">
        <span class="sis-fila-txt"><b>${escapar(x.nombre)}</b><span class="sis-tenue">${escapar(x.cargo || "Sin cargo")}</span></span>
        <span class="sis-chips">${(x.roles || []).map((r) => `<span class="sis-chip gris">${escapar(NOMBRE_ROL_PERSONA[r] || r)}</span>`).join("")}
        ${editable ? `<button class="sis-btn chico" data-accion="editar-persona" data-id="${escapar(x.id)}">Editar</button>` : ""}</span></div>`).join("")}</div>` : vacio("Aún no hay personas.")}</section>
    ${editable ? "" : '<p class="sis-tenue">Solo Administración / RRHH edita esta lista.</p>'}
    <section class="sis-tarjeta" id="empresa"><h2>Empresa</h2>
      <form class="sis-form" data-form="empresa">
        <label class="sis-campo"><span>Nombre que aparece arriba</span><input name="nombre" value="${escapar(ctx2.marca.nombre)}" maxlength="40"></label>
        <div class="sis-campo"><span>Color de marca</span><div class="sis-colores">${COLORES_MARCA.map(([c, t]) => `<label class="sis-color"><input type="radio" name="color" value="${c}" ${ctx2.marca.color === c ? "checked" : ""}><i style="background:${c}"></i>${t}</label>`).join("")}</div></div>
        <div class="sis-acciones"><button class="sis-btn primario">Guardar</button></div>
        <p class="sis-tenue">Por ahora se guarda en este equipo (teléfono o computador). Cuando el Sistema esté en el Nextcloud de la empresa, lo define RRHH para todos, junto con el logo.</p>
      </form></section>`;
  }
  var PRONTO = {
    gastos: { titulo: "Gastos", version: "una próxima versión", texto: "Cada gasto con la foto de su boleta, dentro de su proyecto (o en «Oficina»). La rendición pasa por borrador → emitida → devuelta → abonada, y RRHH registra el abono. Las boletas quedan respaldadas en la carpeta del proyecto." },
    terreno: { titulo: "Libreta de terreno", version: "una próxima versión", texto: "Terreno Topografía entra al Sistema: jornadas y levantamientos dentro de cada proyecto, con los equipos que salieron en el checklist. Mientras tanto, sigue usando la app de Terreno por separado." }
  };
  function pronto(ctx2, clave) {
    const x = PRONTO[clave];
    return `<section class="sis-tarjeta sis-pronto grande"><h1>${x.titulo}</h1><p><span class="sis-chip ambar">Llega en ${x.version}</span></p><p>${x.texto}</p></section>`;
  }
  var VISTAS = { inicio, proyectos, proyecto, proyectoEditar, personas, pronto };
  async function manejarEnvio(form, ctx2) {
    const datos = new FormData(form);
    if (form.dataset.form === "persona-rapida") {
      const p = await guardarPersona({ nombre: datos.get("nombre").trim(), cargo: (datos.get("cargo") || "").trim(), roles: [ctx2.rol === "rrhh" ? "rrhh" : "encargado"] }, { personaId: ctx2.personaId });
      await ctx2.usarPersona(p.id);
      ctx2.avisar("Persona creada");
      return true;
    }
    if (form.dataset.form === "persona") {
      const id = form.dataset.id || void 0;
      await guardarPersona({ id, nombre: datos.get("nombre").trim(), cargo: (datos.get("cargo") || "").trim(), roles: datos.getAll("roles") }, { personaId: ctx2.personaId });
      ctx2.estado.personaEditar = null;
      await ctx2.recargarPersonas();
      ctx2.avisar("Persona guardada");
      return true;
    }
    if (form.dataset.form === "empresa") {
      ctx2.cambiarMarca({ nombre: (datos.get("nombre") || "").trim() || "Topoland", color: datos.get("color") || COLORES_MARCA[0][0] });
      ctx2.avisar("Marca guardada");
      return true;
    }
    if (form.dataset.form === "proyecto") {
      const id = form.dataset.id || void 0;
      const r = await guardarProyecto({
        id,
        nombre: datos.get("nombre").trim(),
        mandante: (datos.get("mandante") || "").trim(),
        tiposTrabajo: datos.getAll("tipos"),
        tiposDetalle: datos.getAll("detalle").filter((d) => datos.getAll("tipos").includes(d.split(":")[0])),
        tipoOtro: datos.getAll("tipos").includes("otro") ? (datos.get("tipoOtro") || "").trim() : "",
        comuna: (datos.get("comuna") || "").trim(),
        region: datos.get("region") || "",
        encargadoId: datos.get("encargadoId") || null,
        estado: datos.get("estado") || "activo",
        solicitadoPor: (datos.get("solicitadoPor") || "").trim(),
        fechaEncargo: datos.get("fechaEncargo") || "",
        plazo: datos.get("plazo") || "",
        notas: (datos.get("notas") || "").trim()
      }, { personaId: ctx2.personaId });
      ctx2.avisar(id ? "Proyecto guardado" : "Proyecto creado");
      ctx2.ir(`#/proyecto/${r.id}`);
      return false;
    }
    return false;
  }
  async function manejarClic(boton, ctx2) {
    switch (boton.dataset.accion) {
      case "abrir-pdf":
        await abrirArchivo(boton.dataset.id);
        return false;
      case "nueva-persona":
        ctx2.estado.personaEditar = "nueva";
        return true;
      case "editar-persona":
        ctx2.estado.personaEditar = boton.dataset.id;
        return true;
      case "cancelar-persona":
        ctx2.estado.personaEditar = null;
        return true;
      case "eliminar-proyecto": {
        const p = await obtenerProyecto(boton.dataset.id);
        if (!p || p.id === OFICINA_ID) return false;
        const enUso = (await listarEquiposConEstado()).filter((e) => e.ubicacion.lugar === "terreno" && e.ubicacion.proyectoId === p.id);
        if (enUso.length) {
          alert(`No se puede eliminar «${p.nombre}»: tiene ${enUso.length} equipo${enUso.length > 1 ? "s" : ""} en terreno. Primero registra su regreso o traspaso en Equipos.`);
          return false;
        }
        if (!confirm(`¿Eliminar el proyecto «${p.nombre}»?

Va a la papelera y se puede restaurar desde Proyectos.`)) return false;
        await enviarAPapelera("compartido_proyectos", p.id, { personaId: ctx2.personaId });
        ctx2.avisar("Proyecto eliminado");
        ctx2.ir("#/proyectos");
        return false;
      }
      case "restaurar-proyecto":
        await restaurar("compartido_proyectos", boton.dataset.id, { personaId: ctx2.personaId });
        ctx2.avisar("Proyecto restaurado");
        return true;
      case "cerrar-proyecto": {
        const p = await obtenerProyecto(boton.dataset.id);
        await guardarProyecto({ id: p.id, estado: p.estado === "cerrado" ? "activo" : "cerrado" }, { personaId: ctx2.personaId });
        ctx2.avisar(p.estado === "cerrado" ? "Proyecto reabierto" : "Proyecto cerrado");
        ctx2.ir(`#/proyecto/${p.id}`);
        return false;
      }
    }
    return false;
  }
  async function manejarCambio(input, ctx2) {
    if (input.dataset.accion === "ver-cerrados") {
      ctx2.estado.verCerrados = input.checked;
      return true;
    }
    return false;
  }

  // app/sistema.js
  window.ModuloEquipos = equipos_exports;
  var $ = (id) => document.getElementById(id);
  var selRol = $("sis-rol");
  var selPersona = $("sis-persona");
  var contenedor = $("sis-contenido");
  var menu = $("sis-menu");
  var montado = null;
  var rutaActual = "";
  var timerAviso = null;
  var estado2 = { verCerrados: false, personaEditar: null };
  var leer = (k, d) => {
    var _a;
    try {
      return (_a = localStorage.getItem(k)) != null ? _a : d;
    } catch {
      return d;
    }
  };
  var escribir = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
    }
  };
  var MODOS = ["auto", "telefono", "pc"];
  var NOMBRE_MODO = { auto: "automático", telefono: "teléfono", pc: "computador" };
  function modoApp() {
    const p = leer("env_modo", "auto");
    if (p !== "auto") return p;
    try {
      return matchMedia("(min-width: 900px) and (pointer: fine)").matches ? "pc" : "telefono";
    } catch {
      return "telefono";
    }
  }
  function aplicarModo() {
    document.body.dataset.modo = modoApp();
  }
  $("sis-modo").addEventListener("click", () => {
    const sig = MODOS[(MODOS.indexOf(leer("env_modo", "auto")) + 1) % MODOS.length];
    escribir("env_modo", sig);
    aplicarModo();
    avisar(`Modo ${NOMBRE_MODO[sig]}`);
  });
  addEventListener("resize", aplicarModo);
  function avisar(texto3) {
    const el = $("sis-aviso");
    el.textContent = texto3;
    el.hidden = false;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => {
      el.hidden = true;
    }, 3e3);
  }
  var ic = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  var ICONOS_MENU = {
    inicio: ic('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
    proyectos: ic('<path d="M3 7h6l2 2h10v10H3z"/>'),
    equipos: ic('<path d="M12 3v11"/><path d="M5 21l7-7 7 7"/><circle cx="12" cy="3" r="1.5"/>'),
    vuelos: ic('<path d="M12 9v6M9 12h6"/><circle cx="5" cy="5" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3"/>'),
    gastos: ic('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
    terreno: ic('<path d="M4 20l5-14 5 9 3-5 3 10z"/>'),
    personas: ic('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.8c1.9.8 3.1 2.6 3.5 5.2"/>'),
    mas: ic('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>')
  };
  var MENU = [
    { ruta: "inicio", texto: "Inicio", roles: ["terreno", "rrhh"] },
    { ruta: "proyectos", texto: "Proyectos", roles: ["terreno", "rrhh"], tambien: ["proyecto", "proyecto-editar"] },
    { ruta: "equipos", texto: "Equipos", roles: ["terreno", "rrhh"] },
    { ruta: "vuelos", texto: "Vuelos", roles: ["terreno"] },
    { ruta: "gastos", texto: "Gastos", roles: ["terreno", "rrhh"], pronto: true },
    { ruta: "terreno", texto: "Libreta de terreno", roles: ["terreno"], pronto: true },
    { ruta: "personas", texto: "Personas", roles: ["rrhh", "terreno"] }
  ];
  var CABEN_ABAJO = 5;
  function pintarMenu(base) {
    const items = MENU.filter((m) => m.roles.includes(selRol.value));
    const enlace = (m) => {
      const activo2 = m.ruta === base || (m.tambien || []).includes(base);
      return `<a href="#/${m.ruta}" class="sis-menu-item${activo2 ? " activo" : ""}${m.pronto ? " pronto" : ""}"${activo2 ? ' aria-current="page"' : ""} title="${m.texto}">${ICONOS_MENU[m.ruta] || ""}<span>${m.texto}</span>${m.pronto ? "<small>pronto</small>" : ""}</a>`;
    };
    const principales = items.length > CABEN_ABAJO ? items.slice(0, CABEN_ABAJO - 1) : items;
    const extra = items.slice(principales.length);
    const extraActivo = extra.some((m) => m.ruta === base || (m.tambien || []).includes(base));
    menu.classList.remove("abierto");
    menu.innerHTML = principales.map(enlace).join("") + (extra.length ? `<div class="sis-menu-extra" id="sis-menu-extra">${extra.map(enlace).join("")}</div>
      <button type="button" class="sis-menu-mas${extraActivo ? " activo" : ""}" aria-expanded="false" aria-controls="sis-menu-extra">${ICONOS_MENU.mas}<span>Más</span></button>` : "");
  }
  async function cargarPersonas(seleccionar) {
    const personas2 = await listarPersonas();
    selPersona.innerHTML = '<option value="">Sin persona</option>' + personas2.map((p) => `<option value="${p.id}">${p.nombre.replace(/</g, "&lt;")}</option>`).join("");
    selPersona.value = seleccionar && personas2.some((p) => p.id === seleccionar) ? seleccionar : "";
  }
  var MARCA_DEFECTO = { nombre: "Topoland", color: "#1D5C63" };
  function leerMarca() {
    try {
      return { ...MARCA_DEFECTO, ...JSON.parse(leer("env_marca", "{}")) };
    } catch {
      return { ...MARCA_DEFECTO };
    }
  }
  function aplicarMarca() {
    const m = leerMarca();
    document.documentElement.style.setProperty("--marca", m.color);
    document.querySelector(".sis-marca b").textContent = m.nombre;
    document.querySelector(".sis-logo").textContent = (m.nombre.trim()[0] || "T").toUpperCase();
  }
  var ctx = () => ({
    marca: leerMarca(),
    cambiarMarca: (m) => {
      escribir("env_marca", JSON.stringify(m));
      aplicarMarca();
    },
    rol: selRol.value,
    personaId: selPersona.value || null,
    estado: estado2,
    avisar,
    ir: (r) => {
      if (location.hash === r) mostrar();
      else location.hash = r;
    },
    usarPersona: async (id) => {
      escribir("env_persona", id);
      await cargarPersonas(id);
    },
    recargarPersonas: () => cargarPersonas(selPersona.value)
  });
  function leerRuta() {
    const qr = location.hash.match(/^#equipo=([\w-]+)/);
    if (qr) {
      history.replaceState(null, "", `#/equipos/${qr[1]}`);
    }
    const partes = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    return { base: partes[0] || "inicio", arg: partes[1] || null };
  }
  async function mostrar() {
    const { base, arg } = leerRuta();
    const item = MENU.find((m) => m.ruta === base || (m.tambien || []).includes(base));
    if (!item || !item.roles.includes(selRol.value)) {
      location.hash = "#/inicio";
      return;
    }
    pintarMenu(base);
    const clave = `${base}/${arg || ""}/${selRol.value}/${selPersona.value}`;
    if (base === "vuelos") {
      const partes = location.hash.replace(/^#\/?/, "").split("/");
      desmontar();
      contenedor.innerHTML = "";
      contenedor.dataset.vista = "modulo";
      montado = montar2(contenedor, {
        rol: selRol.value,
        personaId: selPersona.value || null,
        planId: partes[1] === "plan" ? partes[2] : null,
        proyectoId: partes[1] === "proyecto" ? partes[2] : null
      });
      rutaActual = clave;
      window.scrollTo(0, 0);
      return;
    }
    if (base === "equipos") {
      desmontar();
      contenedor.innerHTML = "";
      contenedor.dataset.vista = "modulo";
      montado = montar(contenedor, { rol: selRol.value, personaId: selPersona.value || null, equipoInicial: arg });
      rutaActual = clave;
      window.scrollTo(0, 0);
      return;
    }
    desmontar();
    const cambioDePantalla = !rutaActual.startsWith(`${base}/${arg || ""}/`);
    rutaActual = clave;
    contenedor.dataset.vista = "sistema";
    if (cambioDePantalla) window.scrollTo(0, 0);
    try {
      let html;
      if (base === "gastos" || base === "terreno") html = VISTAS.pronto(ctx(), base);
      else if (base === "proyecto") html = await VISTAS.proyecto(ctx(), arg);
      else if (base === "proyecto-editar") html = await VISTAS.proyectoEditar(ctx(), arg || "nuevo");
      else html = await VISTAS[base](ctx());
      if (rutaActual !== clave) return;
      contenedor.innerHTML = `<div class="sis-vista">${html}</div>`;
    } catch (err) {
      console.error(err);
      contenedor.innerHTML = `<div class="sis-error"><b>Algo falló al cargar.</b><br>${String(err.message || err).replace(/</g, "&lt;")}</div>`;
    }
  }
  function desmontar() {
    if (montado) {
      try {
        montado.desmontar();
      } catch (e) {
        console.warn(e);
      }
      montado = null;
    }
  }
  contenedor.addEventListener("submit", async (ev) => {
    if (contenedor.dataset.vista !== "sistema") return;
    const form = ev.target.closest("form[data-form]");
    if (!form) return;
    ev.preventDefault();
    try {
      if (await manejarEnvio(form, ctx())) {
        rutaActual = "";
        await mostrar();
      }
    } catch (e) {
      console.error(e);
      avisar(`No se pudo guardar: ${e.message}`);
    }
  });
  contenedor.addEventListener("click", async (ev) => {
    if (contenedor.dataset.vista !== "sistema") return;
    const b = ev.target.closest("button[data-accion]");
    if (!b) return;
    try {
      if (await manejarClic(b, ctx())) {
        rutaActual = "";
        await mostrar();
      }
    } catch (e) {
      console.error(e);
      avisar(e.message);
    }
  });
  contenedor.addEventListener("change", async (ev) => {
    if (contenedor.dataset.vista !== "sistema") return;
    const i = ev.target.closest("input[data-accion]");
    if (i && await manejarCambio(i, ctx())) {
      rutaActual = "";
      await mostrar();
    }
  });
  async function arrancar() {
    aplicarModo();
    aplicarMarca();
    $("sis-version").textContent = `v${VERSION_SISTEMA}`;
    $("sis-version").title = `Sistema v${VERSION_SISTEMA} = ${MODULOS_INCLUIDOS}`;
    document.title = `${leerMarca().nombre} · Sistema v${VERSION_SISTEMA}`;
    selRol.innerHTML = Object.entries(ROLES).map(([k, t]) => `<option value="${k}">${t}</option>`).join("");
    selRol.value = leer("env_rol", "terreno") === "rrhh" ? "rrhh" : "terreno";
    await cargarPersonas(leer("env_persona", ""));
    iniciar2({ personaId: selPersona.value || null });
    iniciar3({ personaId: selPersona.value || null });
    selRol.addEventListener("change", () => {
      escribir("env_rol", selRol.value);
      rutaActual = "";
      mostrar();
    });
    selPersona.addEventListener("change", () => {
      escribir("env_persona", selPersona.value);
      rutaActual = "";
      mostrar();
    });
    addEventListener("hashchange", mostrar);
    document.addEventListener("click", (ev) => {
      if (!ev.target.closest("#sis-menu")) menu.classList.remove("abierto");
    });
    menu.addEventListener("click", (ev) => {
      const mas = ev.target.closest(".sis-menu-mas");
      if (mas) {
        const abierto = menu.classList.toggle("abierto");
        mas.setAttribute("aria-expanded", String(abierto));
        return;
      }
      const a = ev.target.closest("a[href]");
      if (a && a.getAttribute("href") === location.hash) {
        ev.preventDefault();
        estado2.personaEditar = null;
        rutaActual = "";
        mostrar();
      }
    });
    await mostrar();
    iniciarPanelNube({
      pastilla: $("sis-nube"),
      alLlegarDatos: async () => {
        await cargarPersonas(selPersona.value || leer("env_persona", ""));
        if (montado && montado.refrescar) montado.refrescar();
        else if (!contenedor.querySelector("form")) {
          rutaActual = "";
          mostrar();
        }
      }
    });
    window.__sistemaCargado = true;
  }
  arrancar().catch((err) => {
    console.error(err);
    contenedor.innerHTML = `<div class="sis-error">No se pudo iniciar el Sistema: ${String(err.message || err).replace(/</g, "&lt;")}</div>`;
  });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service worker no registrado:", err));
  }
})();
