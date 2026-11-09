/* topoland-conexion.js — GENERADO desde Sistema Topoland · app/conexion-terreno.js. No editar aquí. */
var TopolandConexion = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // app/conexion-terreno.js
  var conexion_terreno_exports = {};
  __export(conexion_terreno_exports, {
    VERSION: () => VERSION,
    alCambiarNube: () => alCambiarNube,
    alLlegarDatos: () => alLlegarDatos,
    alVincular: () => alVincular,
    codigoQR: () => codigoQR,
    conectarNube: () => conectarNube,
    desvincular: () => desvincular,
    estadoMonografias: () => estadoMonografias2,
    estadoNube: () => estadoNube,
    explicarVinculo: () => explicarVinculo,
    iniciar: () => iniciar4,
    marcarTramoVolado: () => marcarTramoVolado2,
    misEquiposEnTerreno: () => misEquiposEnTerreno,
    misProyectos: () => misProyectos,
    persona: () => persona3,
    publicarJornada: () => publicarJornada2,
    publicarMonografia: () => publicarMonografia2,
    reportar: () => reportar,
    sincronizar: () => sincronizar2,
    subirFoto: () => subirFoto,
    tramosDeProyecto: () => tramosDeProyecto2,
    vincular: () => vincular
  });

  // compartido/esquema.js
  var porProyecto = [["proyectoId", "proyectoId"]];
  var porEquipo = [["equipoId", "equipoId"]];
  var ESQUEMA = [
    // compartido
    { nombre: "compartido_proyectos" },
    { nombre: "compartido_personas" },
    { nombre: "compartido_archivos", indices: [["dueno", ["duenoTipo", "duenoId"]]] },
    // Equipos
    { nombre: "equipos_equipos" },
    { nombre: "equipos_eventos", indices: [["equipoId", "equipoId"], ["proyectoId", "proyectoId"]] },
    { nombre: "equipos_alertas", indices: porEquipo },
    { nombre: "equipos_modelos" },
    { nombre: "equipos_certificados", indices: porEquipo },
    { nombre: "equipos_mantenciones", indices: porEquipo },
    { nombre: "equipos_notas", indices: porEquipo },
    // Vuelos
    { nombre: "vuelos_planes", indices: porProyecto },
    { nombre: "vuelos_drones" },
    { nombre: "local_vuelos_capas" },
    // Seguimiento
    { nombre: "seguimiento_planes", indices: porProyecto },
    { nombre: "seguimiento_ciclos", indices: [["planId", "planId"]] },
    { nombre: "seguimiento_eventos", indices: [["cicloId", "cicloId"]] },
    { nombre: "seguimiento_entregas", indices: [["cicloId", "cicloId"]] },
    // Gastos (v0.13)
    { nombre: "gastos_gastos", indices: [["proyectoId", "proyectoId"], ["personaId", "personaId"], ["rendicionId", "rendicionId"]] },
    { nombre: "gastos_rendiciones", indices: [["proyectoId", "proyectoId"], ["personaId", "personaId"]] },
    { nombre: "gastos_eventos", indices: [["rendicionId", "rendicionId"]] },
    // Monografías (datos que llegan desde Terreno)
    { nombre: "terreno_monografias", indices: porProyecto },
    { nombre: "terreno_monografias_gabinete", indices: porProyecto },
    { nombre: "terreno_revisiones", indices: [["monografiaId", "monografiaId"], ["proyectoId", "proyectoId"]] },
    { nombre: "terreno_jornadas", indices: porProyecto }
  ];

  // compartido/almacen.js
  var NOMBRE_BD = "topoland";
  var registrados = /* @__PURE__ */ new Map();
  var promesaBD = null;
  var conexion = null;
  var cadena = Promise.resolve();
  function registrarAlmacenes(definiciones) {
    let nuevos = false;
    for (const d of definiciones) {
      const previo = registrados.get(d.nombre);
      if (!previo) {
        registrados.set(d.nombre, { ...d, indices: [...d.indices || []] });
        nuevos = true;
        continue;
      }
      for (const ind of d.indices || []) {
        if (!previo.indices.some(([n]) => n === ind[0])) {
          previo.indices.push(ind);
          nuevos = true;
        }
      }
    }
    if (nuevos) promesaBD = null;
  }
  function almacenesRegistrados() {
    return [...registrados.keys()];
  }
  registrarAlmacenes(ESQUEMA);
  var marcar = (k, v) => {
    try {
      globalThis[k] = v;
    } catch {
    }
  };
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
  var MENSAJE_BLOQUEO = "Los datos están abiertos en otra app o pestaña (por ejemplo, la app de Terreno en segundo plano). Ciérrala desde las apps recientes y vuelve a abrir.";
  function abrirConVersion(version) {
    return new Promise((resolver, rechazar) => {
      marcar("__topolandBdEsperando", true);
      const listo = () => {
        marcar("__topolandBdEsperando", false);
        marcar("__topolandBdBloqueada", false);
      };
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
        listo();
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
        listo();
        rechazar(req.error);
      };
      req.onblocked = () => {
        clearTimeout(aviso);
        marcar("__topolandBdBloqueada", true);
        aviso = setTimeout(() => {
          listo();
          rechazar(new Error(MENSAJE_BLOQUEO));
        }, 6e4);
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
  function hoyISO(fecha = /* @__PURE__ */ new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
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
  function normalizarTexto(t) {
    return String(t != null ? t : "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
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
    function desconectar() {
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
    const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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
    async function buscarCarpetas(nombre) {
      return buscar(`name='${esc(nombre)}' and mimeType='${CARPETA}' and trashed=false`);
    }
    async function crearCarpeta(nombre, padreId = null) {
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
      const hay = await buscar(`name='${esc(nombre)}' and '${padreId}' in parents and mimeType='${CARPETA}' and trashed=false`);
      const id = hay[0] ? hay[0].id : (await crearCarpeta(nombre, padreId)).id;
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
      desconectar,
      usarToken,
      buscarCarpetas,
      crearCarpeta,
      datosCarpeta,
      asegurarRuta,
      listarArchivos,
      subir,
      descargar: descargar2
    };
  }
  function idDeEnlaceDrive(texto) {
    const t = String(texto || "").trim();
    const m = t.match(/folders\/([\w-]{10,})/) || t.match(/[?&]id=([\w-]{10,})/);
    if (m) return m[1];
    return /^[\w-]{10,}$/.test(t) ? t : null;
  }

  // compartido/nube.js
  var CLAVE = "topoland_nube";
  var PREFIJOS = ["equipos_", "compartido_", "vuelos_", "seguimiento_", "terreno_", "gastos_"];
  var ALM_ARCHIVOS = "compartido_archivos";
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

  // compartido/catalogos.js
  var OFICINA_ID = "oficina";
  var ALM_PROYECTOS = "compartido_proyectos";
  var ALM_PERSONAS = "compartido_personas";
  registrarAlmacenes([{ nombre: ALM_PROYECTOS }, { nombre: ALM_PERSONAS }]);
  var proveedor = null;
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
  async function listarPersonas() {
    if (proveedor) return (await proveedor.listarPersonas()).sort(porNombre);
    return (await todos(ALM_PERSONAS)).filter(activo).sort(porNombre);
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
      ...meta.detalle ? { detalle: meta.detalle } : {},
      datos,
      nube: { estado: "local", ruta: meta.carpeta ? `${meta.carpeta}/${limpiar(nombre)}` : null }
    }, { personaId });
    return guardar(ALM, reg);
  }
  async function guardarArchivoDatos(dataURL, nombre, meta, ctx) {
    const blob = aBlob(dataURL);
    const archivo = new File([blob], nombre || `${meta.rol || "foto"}.${(blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg")}`, { type: blob.type });
    return guardarArchivo(archivo, meta, ctx);
  }
  async function archivosDeProyecto(proyectoId, modulo = null) {
    const lista = (await todos(ALM)).filter((a) => a.proyectoId === proyectoId && !a.eliminadoEn && (!modulo || a.modulo === modulo));
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

  // modulos/equipos/modelo.js
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
  var MARCAS_NO_APLICA = ["-", "—", "–", "N/A", "NA", "NO APLICA", "NO CORRESPONDE"];
  var PERIODO_CALIBRACION_MESES = 12;
  var DIAS_AVISO_CALIBRACION = 30;
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
  async function eventosDeEquipo(equipoId) {
    return (await porIndice(ALM2.eventos, "equipoId", equipoId)).sort(porFecha);
  }
  async function alertasDeEquipo(equipoId) {
    return (await porIndice(ALM2.alertas, "equipoId", equipoId)).filter(vivo).sort((a, b) => b.fechaReporte.localeCompare(a.fechaReporte));
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
  async function reportarAnomalia({ equipoId, descripcion, proyectoId = null, personaId = null, tipo = "problema", origen = null }) {
    const est2 = await estadoDeEquipo(equipoId);
    const quien = personaId || personaActual;
    const proyecto = proyectoId || est2 && est2.ubicacion.proyectoId || null;
    const ahora = ahoraISO();
    const alerta = sello({
      equipoId,
      descripcion,
      estado: "abierta",
      reportadaPor: quien,
      proyectoId: proyecto,
      tipo,
      origen,
      fechaReporte: ahora,
      historial: [{ estado: "abierta", fecha: ahora, personaId: quien, nota: descripcion }]
    });
    const ev = nuevoEvento({ equipoId, tipo: "alerta", alertaId: alerta.id, estadoAlerta: "abierta", personaId: quien, proyectoId: proyecto, nota: descripcion });
    await guardarVarios([{ almacen: ALM2.alertas, registro: alerta }, { almacen: ALM2.eventos, registro: ev }]);
    return alerta;
  }

  // modulos/equipos/importar.js
  var NO_APLICA = new Set(MARCAS_NO_APLICA.map(normalizarTexto).concat([""]));

  // modulos/equipos/ficha.js
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

  // modulos/equipos/equipos.js
  var ALMACENES = Object.values(ALM2);
  var iniciado = false;
  function iniciar2({ personaId } = {}) {
    if (!iniciado) {
      iniciarDatos({ personaId: personaId != null ? personaId : null });
      iniciado = true;
    } else if (personaId !== void 0) fijarPersona(personaId);
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
  async function listarEquiposConEstado({ incluirBaja = false } = {}) {
    iniciar2();
    return (await listarConEstado()).filter((e) => incluirBaja || e.ubicacion.lugar !== "baja").map(resumen);
  }
  async function reportarProblema({ equipoId, descripcion, tipo = "problema", proyectoId = null, personaId = null, origen = "app-terreno" }) {
    iniciar2();
    const a = await reportarAnomalia({ equipoId, descripcion, tipo: tipo === "aviso" ? "aviso" : "problema", proyectoId, personaId, origen });
    return { id: a.id, estado: a.estado, fechaReporte: a.fechaReporte };
  }

  // modulos/seguimiento/datos.js
  var SCHEMA_VERSION2 = 1;
  var ALM3 = { planes: "seguimiento_planes", ciclos: "seguimiento_ciclos", eventos: "seguimiento_eventos", entregas: "seguimiento_entregas" };
  var persona = null;
  function iniciarDatos2({ personaId = null } = {}) {
    registrarAlmacenes([
      { nombre: ALM3.planes, indices: [["proyectoId", "proyectoId"]] },
      { nombre: ALM3.ciclos, indices: [["planId", "planId"]] },
      { nombre: ALM3.eventos, indices: [["cicloId", "cicloId"]] },
      { nombre: ALM3.entregas, indices: [["cicloId", "cicloId"]] }
    ]);
    persona = personaId;
  }
  function fijarPersona2(p) {
    persona = p;
  }
  var sello2 = (r) => sellar(r, { personaId: persona, schemaVersion: SCHEMA_VERSION2 });
  var vivo2 = (r) => !r.eliminadoEn;
  var recientes = (a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || "");
  async function planDeProyecto(proyectoId) {
    return (await porIndice(ALM3.planes, "proyectoId", proyectoId)).filter(vivo2)[0] || null;
  }
  async function ciclosDePlan(planId) {
    return (await porIndice(ALM3.ciclos, "planId", planId)).filter(vivo2).sort(recientes);
  }
  async function eventosDeCiclo(cicloId) {
    return (await porIndice(ALM3.eventos, "cicloId", cicloId)).filter(vivo2);
  }
  async function agregarEventos(eventos) {
    const ahora = (/* @__PURE__ */ new Date()).toISOString();
    await guardarVarios(eventos.map((e) => ({ almacen: ALM3.eventos, registro: sello2({ ...e, creadoEn: ahora }) })));
  }

  // modulos/seguimiento/modelo.js
  var vacio = () => ({ terreno: "", por: "", prod: {}, entrega: "", nota: "", notaPor: "", notaEn: "" });
  function estadoCiclo(eventos) {
    const ord = eventos.filter((e) => !e.eliminadoEn).sort((a, b) => (a.creadoEn || "").localeCompare(b.creadoEn || "") || (a.orden || 0) - (b.orden || 0));
    const est2 = {};
    for (const e of ord) {
      const t = est2[e.tramoId] || (est2[e.tramoId] = vacio());
      if (e.tipo === "terreno") {
        t.terreno = e.valor || "";
        t.por = e.valor ? e.por || "" : "";
      } else if (e.tipo === "prod") t.prod[e.col] = e.valor;
      else if (e.tipo === "entrega") t.entrega = e.valor || "";
      else if (e.tipo === "nota") {
        t.nota = e.valor || "";
        t.notaPor = e.por || "";
        t.notaEn = e.creadoEn || "";
      }
    }
    return est2;
  }
  var estadoDe = (est2, tramoId) => est2[tramoId] || vacio();
  function prepararCambios(est2, cambios, { cicloId, planId, por = "" }) {
    var _a;
    const eventos = [], inversos = [];
    let orden = 0;
    for (const c of cambios) {
      const t = estadoDe(est2, c.tramoId);
      const antes = c.tipo === "terreno" ? t.terreno : c.tipo === "prod" ? t.prod[c.col] || "falta" : c.tipo === "entrega" ? t.entrega : t.nota;
      if ((antes || "") === (c.valor || "")) continue;
      const base = { cicloId, planId, tramoId: c.tramoId, tipo: c.tipo, col: c.col || null };
      eventos.push({ ...base, valor: c.valor, por: (_a = c.por) != null ? _a : por, orden: orden++ });
      inversos.push({ tramoId: c.tramoId, tipo: c.tipo, col: c.col || null, valor: antes || (c.tipo === "prod" ? "falta" : ""), por: c.tipo === "terreno" ? t.por : c.tipo === "nota" ? t.notaPor : "" });
    }
    return { eventos, inversos };
  }

  // modulos/seguimiento/seguimiento.js
  var ALMACENES2 = Object.values(ALM3);
  var iniciado2 = false;
  function iniciar3({ personaId } = {}) {
    if (!iniciado2) {
      iniciarDatos2({ personaId: personaId != null ? personaId : null });
      iniciado2 = true;
    } else if (personaId !== void 0) fijarPersona2(personaId);
  }
  async function tramosDeProyecto(proyectoId) {
    iniciar3();
    const plan = await planDeProyecto(proyectoId);
    if (!plan) return null;
    const ciclo = (await ciclosDePlan(plan.id))[0] || null;
    const est2 = ciclo ? estadoCiclo(await eventosDeCiclo(ciclo.id)) : {};
    return {
      ciclo: ciclo ? { id: ciclo.id, nombre: ciclo.nombre } : null,
      areas: plan.areas.map((a) => ({ nombre: a.nombre, tramos: a.tramos.map((t) => {
        var _a, _b;
        const e = estadoDe(est2, t.id);
        return { id: t.id, n: t.n, nombre: t.nombre, ini: (_a = t.ini) != null ? _a : null, fin: (_b = t.fin) != null ? _b : null, volado: !!e.terreno, fecha: e.terreno, por: e.por, nota: e.nota };
      }) }))
    };
  }
  async function marcarTramoVolado(proyectoId, tramoId, { volado: volado2 = true, fecha = hoyISO(), por = "", nota = null } = {}) {
    iniciar3();
    const plan = await planDeProyecto(proyectoId);
    const ciclo = plan && (await ciclosDePlan(plan.id))[0];
    if (!ciclo) throw new Error("Este proyecto no tiene un mes de seguimiento abierto.");
    const est2 = estadoCiclo(await eventosDeCiclo(ciclo.id));
    const cambios = [{ tramoId, tipo: "terreno", valor: volado2 ? fecha : "", por }];
    if (nota != null) cambios.push({ tramoId, tipo: "nota", valor: nota, por });
    const { eventos } = prepararCambios(est2, cambios, { cicloId: ciclo.id, planId: plan.id, por });
    if (eventos.length) await agregarEventos(eventos.map((e) => ({ ...e, origen: "app-terreno" })));
    return eventos.length;
  }

  // modulos/monografias/datos.js
  var SCHEMA_VERSION3 = 1;
  var ALM4 = { mono: "terreno_monografias", gabinete: "terreno_monografias_gabinete", revisiones: "terreno_revisiones", jornadas: "terreno_jornadas" };
  var ESTADOS = {
    enviada: { texto: "Enviada desde terreno", color: "gris" },
    "en-revision": { texto: "En revisión", color: "azul" },
    lista: { texto: "Lista", color: "verde" },
    "con-observacion": { texto: "Con observación", color: "ambar" },
    borrador: { texto: "Creada en gabinete", color: "gris" }
  };
  var IMAGENES = ["clienteLogo", "croquisImg", "panoramicaImg"];
  var persona2 = null;
  var registrado = false;
  function iniciarDatos3({ personaId = null } = {}) {
    if (!registrado) {
      registrarAlmacenes([
        { nombre: ALM4.mono, indices: [["proyectoId", "proyectoId"]] },
        { nombre: ALM4.gabinete, indices: [["proyectoId", "proyectoId"]] },
        { nombre: ALM4.revisiones, indices: [["monografiaId", "monografiaId"], ["proyectoId", "proyectoId"]] },
        { nombre: ALM4.jornadas, indices: [["proyectoId", "proyectoId"]] }
      ]);
      registrado = true;
    }
    persona2 = personaId;
  }
  var sello3 = (r, p = persona2) => sellar(r, { personaId: p, schemaVersion: SCHEMA_VERSION3 });
  var vivo3 = (r) => r && !r.eliminadoEn;
  async function huella(texto) {
    try {
      const b = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(texto));
      return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
    } catch {
      return `${texto.length}-${texto.slice(-64)}`;
    }
  }
  var esDataURL = (v) => typeof v === "string" && v.startsWith("data:");
  var fechaCarpeta = (iso) => String(iso || (/* @__PURE__ */ new Date()).toISOString()).slice(0, 10);
  async function guardarFoto(dataURL, { proyectoId, duenoTipo = "terreno_foto", duenoId = null, detalle = {}, personaId = persona2, nombreProyecto = "" } = {}) {
    if (!esDataURL(dataURL)) throw new Error("La foto debe venir como dataURL.");
    const h = await huella(dataURL);
    const previa = (await archivosDeProyecto(proyectoId, "terreno")).find((a) => a.detalle && a.detalle.huella === h);
    if (previa) return previa.id;
    const tipo = detalle.tipo || "otra";
    const carpeta = `Proyectos/${nombreProyecto || proyectoId}/Terreno/${fechaCarpeta(detalle.hora)}`;
    const nombre = `${tipo}${detalle.punto ? "_" + detalle.punto : ""}_${String(detalle.hora || "").replace(/[^0-9]/g, "").slice(0, 14) || Date.now()}.jpg`;
    const reg = await guardarArchivoDatos(dataURL, nombre, { modulo: "terreno", duenoTipo, duenoId: duenoId || proyectoId, rol: "foto", proyectoId, carpeta, detalle: { ...detalle, tipo, huella: h } }, { personaId });
    return reg.id;
  }
  async function guardarImagenesDe(m, { proyectoId, personaId = persona2, nombreProyecto = "" } = {}) {
    const copia = { ...m };
    const det = (tipo, extra = {}) => ({ tipo, monografiaId: m.id, punto: m.puntoMedido || "", hora: m.fechaMedicion || m.creado || "", autor: m.operadorNombre || "", ...extra });
    for (const k of IMAGENES) {
      if (esDataURL(m[k])) copia[k] = { archivo: await guardarFoto(m[k], { proyectoId, duenoTipo: "terreno_monografia", duenoId: m.id, personaId, nombreProyecto, detalle: det(k === "croquisImg" ? "croquis" : k === "panoramicaImg" ? "panoramica" : "logo") }) };
    }
    copia.fotosExtra = [];
    for (const f of m.fotosExtra || []) {
      const g = { ...f };
      if (esDataURL(f.img)) g.img = { archivo: await guardarFoto(f.img, { proyectoId, duenoTipo: "terreno_monografia", duenoId: m.id, personaId, nombreProyecto, detalle: det("detalle", { leyenda: f.leyenda || "" }) }) };
      copia.fotosExtra.push(g);
    }
    return copia;
  }
  async function publicarMonografia(m, { proyectoId, personaId = persona2, nombreProyecto = "" } = {}) {
    if (!m || !m.id) throw new Error("La monografía no tiene id.");
    if (!proyectoId) throw new Error("Falta el proyecto del Sistema.");
    const copia = await guardarImagenesDe(m, { proyectoId, personaId, nombreProyecto });
    const previa = await obtener(ALM4.mono, m.id);
    const reg = sello3({ ...copia, id: m.id, proyectoId, origen: "app-terreno", publicadoEn: (/* @__PURE__ */ new Date()).toISOString(), publicadoPor: personaId, creadoEn: previa ? previa.creadoEn : void 0 }, personaId);
    await guardar(ALM4.mono, reg);
    if (!previa) await agregarRevision({ monografiaId: m.id, proyectoId, estado: "enviada", observacion: "" }, personaId);
    return { id: m.id, estado: (await estadoDe2(m.id)).estado };
  }
  async function revisionesDe(monografiaId) {
    return (await porIndice(ALM4.revisiones, "monografiaId", monografiaId)).filter(vivo3).sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
  }
  async function agregarRevision({ monografiaId, proyectoId, estado: estado2, observacion = "" }, personaId = persona2) {
    if (!ESTADOS[estado2]) throw new Error("Estado desconocido: " + estado2);
    return guardar(ALM4.revisiones, sello3({ id: uuid(), monografiaId, proyectoId, estado: estado2, observacion: String(observacion || "").trim(), por: personaId }, personaId));
  }
  async function estadoDe2(monografiaId) {
    const r = (await revisionesDe(monografiaId)).pop();
    return r ? { estado: r.estado, observacion: r.observacion, revisadoPor: r.por, fecha: r.creadoEn } : { estado: "borrador", observacion: "", revisadoPor: null, fecha: null };
  }
  async function monografiasDeProyecto(proyectoId) {
    const [deTerreno, deGabinete, revs] = await Promise.all([porIndice(ALM4.mono, "proyectoId", proyectoId), porIndice(ALM4.gabinete, "proyectoId", proyectoId), porIndice(ALM4.revisiones, "proyectoId", proyectoId)]);
    const ultima = /* @__PURE__ */ new Map();
    for (const r of revs.filter(vivo3).sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))) ultima.set(r.monografiaId, r);
    const terreno = new Map(deTerreno.filter(vivo3).map((m) => [m.id, m]));
    const gab = new Map(deGabinete.filter(vivo3).map((m) => [m.id, m]));
    const ids = /* @__PURE__ */ new Set([...terreno.keys(), ...gab.keys()]);
    return [...ids].map((id) => {
      const t = terreno.get(id) || null, g = gab.get(id) || null, r = ultima.get(id);
      return {
        id,
        ficha: g || t,
        terreno: t,
        gabinete: g,
        nuevaDeTerreno: !!(t && g && g.basadoEn && t.actualizadoEn > g.basadoEn),
        estado: r ? r.estado : t ? "enviada" : "borrador",
        observacion: r ? r.observacion : "",
        revisadoPor: r ? r.por : null,
        fechaEstado: r ? r.creadoEn : null
      };
    });
  }
  async function estadoMonografias(proyectoId) {
    return (await monografiasDeProyecto(proyectoId)).filter((x) => x.terreno).map((x) => ({ id: x.id, punto: x.ficha.puntoMedido || "", estado: x.estado, observacion: x.observacion, revisadoPor: x.revisadoPor, fecha: x.fechaEstado }));
  }
  async function publicarJornada(jornada, levantamientos, { proyectoId, personaId = persona2, nombreProyecto = "" } = {}) {
    var _a, _b;
    if (!jornada || !jornada.id) throw new Error("La jornada no tiene id.");
    if (!proyectoId) throw new Error("Falta el proyecto del Sistema.");
    const levs = [];
    let nFotos = 0;
    for (const l of levantamientos || []) {
      const puntos = [];
      for (const p of l.puntos || []) {
        const q = { ...p };
        if (esDataURL(p.foto)) {
          q.foto = { archivo: await guardarFoto(p.foto, { proyectoId, duenoTipo: "terreno_jornada", duenoId: jornada.id, personaId, nombreProyecto, detalle: { tipo: "punto", jornadaId: jornada.id, punto: p.valores && (p.valores.nombre || p.valores.punto || p.valores.id) || "", lat: (_a = p.lat) != null ? _a : null, lng: (_b = p.lng) != null ? _b : null, hora: p.timestamp || "", autor: jornada.operador || "" } }) };
          nFotos++;
        }
        puntos.push(q);
      }
      const fotosReq = [];
      for (const f of l.fotosReq || []) {
        const g = { ...f };
        if (esDataURL(f.foto)) {
          g.foto = { archivo: await guardarFoto(f.foto, { proyectoId, duenoTipo: "terreno_jornada", duenoId: jornada.id, personaId, nombreProyecto, detalle: { tipo: "detalle", jornadaId: jornada.id, leyenda: f.nombre || f.texto || "", hora: f.hora || "", autor: jornada.operador || "" } }) };
          nFotos++;
        }
        fotosReq.push(g);
      }
      levs.push({ ...l, puntos, fotosReq });
    }
    const previa = await obtener(ALM4.jornadas, jornada.id);
    const { lat, lng, ...resto } = jornada;
    await guardar(ALM4.jornadas, sello3({ ...resto, lat: lat != null ? lat : null, lng: lng != null ? lng : null, id: jornada.id, proyectoId, levantamientos: levs, publicadoEn: (/* @__PURE__ */ new Date()).toISOString(), creadoEn: previa ? previa.creadoEn : void 0 }, personaId));
    return { id: jornada.id, fotos: nFotos };
  }

  // app/conexion-terreno.js
  var VERSION = "1.3 (Sistema v0.8.2)";
  var CLAVE_PERSONA = "topoland_conexion_persona";
  var CLAVE_CARPETA = "topoland_conexion_carpeta";
  var CLAVE_CODIGO = "topoland_conexion_codigo";
  var leer = (k) => {
    try {
      return JSON.parse(localStorage.getItem(k) || "null");
    } catch {
      return null;
    }
  };
  var escribir = (k, v) => {
    try {
      v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v));
    } catch {
    }
  };
  var codigoPendiente = null;
  var fijarCodigo = (c) => {
    codigoPendiente = c || null;
    escribir(CLAVE_CODIGO, codigoPendiente);
  };
  var oyentesDatos2 = /* @__PURE__ */ new Set();
  var oyentesVinculo = /* @__PURE__ */ new Set();
  var escuchando = false;
  async function intentarCodigoPendiente() {
    if (!codigoPendiente || persona3()) return null;
    try {
      const p = await vincular(codigoPendiente);
      if (p) for (const fn of oyentesVinculo) {
        try {
          fn(p);
        } catch (e) {
          console.warn(e);
        }
      }
      return p;
    } catch (e) {
      console.warn(e);
      return null;
    }
  }
  function iniciar4({ clienteId } = {}) {
    const p = persona3();
    iniciar2({ personaId: p ? p.id : null });
    iniciar3({ personaId: p ? p.id : null });
    iniciarDatos3({ personaId: p ? p.id : null });
    configurar({ clienteId: clienteId || void 0 });
    iniciar();
    codigoPendiente = leer(CLAVE_CODIGO);
    if (!escuchando) {
      escuchando = true;
      alDatosRemotos(async (...a) => {
        await intentarCodigoPendiente();
        for (const fn of oyentesDatos2) {
          try {
            await fn(...a);
          } catch (e) {
            console.warn(e);
          }
        }
      });
    }
    try {
      const u = new URL(location.href);
      const carpeta = u.searchParams.get("carpeta");
      if (carpeta) {
        escribir(CLAVE_CARPETA, carpeta);
        u.searchParams.delete("carpeta");
      }
      const m = /vincular=([A-Za-z0-9]{4,12})/.exec(u.hash);
      if (m) {
        fijarCodigo(m[1].toUpperCase());
        u.hash = u.hash.replace(/&?vincular=[A-Za-z0-9]+/, "").replace(/^#$/, "");
      }
      if (carpeta || m) history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch {
    }
    if (p && codigoPendiente) fijarCodigo(null);
    else if (codigoPendiente) intentarCodigoPendiente();
    return { persona: p, codigoPendiente, carpetaPendiente: leer(CLAVE_CARPETA) && !estado().carpetaId ? leer(CLAVE_CARPETA) : null };
  }
  function persona3() {
    return leer(CLAVE_PERSONA);
  }
  async function vincular(codigo) {
    const c = String(codigo || "").trim().toUpperCase();
    if (!c) return null;
    const p = (await listarPersonas()).find((x) => String(x.codigoVinculo || "").toUpperCase() === c);
    if (!p) return null;
    const datos = { id: p.id, nombre: p.nombre, cargo: p.cargo || "" };
    escribir(CLAVE_PERSONA, datos);
    iniciar2({ personaId: p.id });
    iniciar3({ personaId: p.id });
    iniciarDatos3({ personaId: p.id });
    fijarCodigo(null);
    return datos;
  }
  function desvincular() {
    escribir(CLAVE_PERSONA, null);
    fijarCodigo(null);
  }
  var alVincular = (fn) => {
    oyentesVinculo.add(fn);
    return () => oyentesVinculo.delete(fn);
  };
  async function explicarVinculo(codigo = codigoPendiente) {
    if (persona3()) return "";
    let n = 0;
    try {
      n = (await listarPersonas()).length;
    } catch {
    }
    const c = String(codigo || "").trim().toUpperCase();
    if (!n) return estado().conectado ? "Todavía no llegan las personas del Sistema. Espera a que termine la sincronización; el teléfono se vincula solo." : "Conecta la nube del Sistema (Google) para terminar de vincular: las personas vienen desde ahí.";
    if (!c) return "Escribe el código de 6 letras que muestra el Sistema en Personas → Vincular teléfono.";
    return `El código ${c} no está entre las personas del Sistema. Revisa que sea el vigente (Personas → Vincular teléfono) y sincroniza de nuevo.`;
  }
  var yo = () => {
    const p = persona3();
    if (!p) throw new Error("Primero vincula el teléfono a una persona.");
    return p;
  };
  async function misProyectos() {
    const p = yo();
    return (await listarProyectos()).filter((x) => x.id !== OFICINA_ID && x.estado !== "cerrado" && x.encargadoId === p.id).map((x) => ({ id: x.id, nombre: x.nombre, mandante: x.mandante || "", comuna: x.comuna || "", region: x.region || "", tiposTrabajo: x.tiposTrabajo || [] }));
  }
  async function misEquiposEnTerreno() {
    const p = yo();
    const mios = new Set((await misProyectos()).map((x) => x.id));
    return (await listarEquiposConEstado()).filter((e) => e.ubicacion.lugar === "terreno" && (e.ubicacion.personaId === p.id || mios.has(e.ubicacion.proyectoId))).map((e) => ({ id: e.id, nombre: e.nombre, numeroSerie: e.numeroSerie || "", proyectoId: e.ubicacion.proyectoId, calibracion: e.calibracion, alertasActivas: e.alertasActivas }));
  }
  async function reportar({ equipoId, tipo = "problema", descripcion }) {
    const p = yo();
    if (!equipoId) throw new Error("Elige el equipo.");
    if (!String(descripcion || "").trim()) throw new Error("Escribe qué pasa.");
    const eq = (await listarEquiposConEstado()).find((e) => e.id === equipoId);
    return reportarProblema({ equipoId, tipo, descripcion: String(descripcion).trim(), personaId: p.id, proyectoId: eq ? eq.ubicacion.proyectoId : null });
  }
  function tramosDeProyecto2(proyectoId) {
    return tramosDeProyecto(proyectoId);
  }
  function marcarTramoVolado2(proyectoId, tramoId, { volado: volado2 = true, fecha, nota = null } = {}) {
    const p = yo();
    return marcarTramoVolado(proyectoId, tramoId, { volado: volado2, ...fecha ? { fecha } : {}, por: p.nombre, nota });
  }
  async function opcionesProyecto(proyectoId) {
    const p = yo();
    if (!proyectoId) throw new Error("Elige el proyecto del Sistema.");
    const proy = await obtenerProyecto(proyectoId);
    if (!proy) throw new Error("Ese proyecto no está en este teléfono. Sincroniza con la nube del Sistema.");
    return { proyectoId, personaId: p.id, nombreProyecto: proy.nombre };
  }
  async function publicarMonografia2(m, { proyectoId } = {}) {
    return publicarMonografia(m, await opcionesProyecto(proyectoId));
  }
  async function publicarJornada2(jornada, levantamientos, { proyectoId } = {}) {
    return publicarJornada(jornada, levantamientos, await opcionesProyecto(proyectoId));
  }
  async function subirFoto(dataUrl, { proyectoId, tipo = "otra", monografiaId = null, puntoId = null, punto = "", lat = null, lng = null, hora = null, leyenda = "" } = {}) {
    const op = await opcionesProyecto(proyectoId);
    const archivoId = await guardarFoto(dataUrl, { ...op, duenoTipo: monografiaId ? "terreno_monografia" : "terreno_foto", duenoId: monografiaId, detalle: { tipo, monografiaId, puntoId, punto, lat, lng, hora: hora || (/* @__PURE__ */ new Date()).toISOString(), leyenda, autor: persona3().nombre } });
    return { archivoId };
  }
  async function estadoMonografias2(proyectoId) {
    yo();
    return estadoMonografias(proyectoId);
  }
  async function conectarNube() {
    await conectar();
    const carpeta = leer(CLAVE_CARPETA);
    if (carpeta && !estado().carpetaId) await usarCarpeta(carpeta);
    else await sincronizar();
    await intentarCodigoPendiente();
    return estado();
  }
  var estadoNube = () => estado();
  var alCambiarNube = (fn) => alEstado(fn);
  var alLlegarDatos = (fn) => {
    oyentesDatos2.add(fn);
    return () => oyentesDatos2.delete(fn);
  };
  var sincronizar2 = () => sincronizar();
  var codigoQR = () => codigoPendiente;
  return __toCommonJS(conexion_terreno_exports);
})();
