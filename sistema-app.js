/* sistema-app.js — ARCHIVO GENERADO con construir.sh. No editar: los cambios van en app/, compartido/ o modulos/. */
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

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
  async function porIndice(almacen, indice2, valor) {
    const bd = await abrir();
    return pedir(bd.transaction(almacen, "readonly").objectStore(almacen).index(indice2).getAll(valor));
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
  function diasEntre(aISO3, bISO) {
    const a = /* @__PURE__ */ new Date(aISO3 + "T12:00:00");
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
  async function obtenerPersona(id) {
    if (!id) return null;
    if (proveedor) return proveedor.obtenerPersona(id);
    return obtener(ALM_PERSONAS, id);
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
    listarAlertas: () => listarAlertas,
    listarEquiposConEstado: () => listarEquiposConEstado,
    montar: () => montar,
    obtenerEquipo: () => obtenerEquipo,
    registrarUsoConAlerta: () => registrarUsoConAlerta,
    reportarProblema: () => reportarProblema
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
    const esc3 = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const CAMPOS2 = "files(id,name,mimeType,modifiedTime,parents)";
    const extra = "&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1000";
    async function buscar(q) {
      const r = await pedir2(`/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(CAMPOS2)}${extra}`);
      return (await r.json()).files || [];
    }
    async function datosCarpeta(id) {
      const r = await pedir2(`/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,capabilities(canAddChildren)&supportsAllDrives=true`);
      return r.json();
    }
    async function buscarCarpetas2(nombre) {
      return buscar(`name='${esc3(nombre)}' and mimeType='${CARPETA}' and trashed=false`);
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
      const hay = await buscar(`name='${esc3(nombre)}' and '${padreId}' in parents and mimeType='${CARPETA}' and trashed=false`);
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
  var PREFIJOS = ["equipos_", "compartido_", "vuelos_", "seguimiento_", "terreno_", "gastos_"];
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
      ...meta.detalle ? { detalle: meta.detalle } : {},
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
  async function guardarArchivoDatos(dataURL, nombre, meta, ctx2) {
    const blob = aBlob(dataURL);
    const archivo = new File([blob], nombre || `${meta.rol || "foto"}.${(blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg")}`, { type: blob.type });
    return guardarArchivo(archivo, meta, ctx2);
  }
  async function archivosDeProyecto(proyectoId, modulo = null) {
    const lista = (await todos(ALM)).filter((a) => a.proyectoId === proyectoId && !a.eliminadoEn && (!modulo || a.modulo === modulo));
    return lista.map(({ datos, ...resto }) => resto).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
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
  function camposEspecificacion(categoria2) {
    return ESPECIFICACIONES[categoria2] || ESPECIFICACIONES_GENERICAS;
  }
  function especificacionesDeDescripcion(categoria2, descripcion) {
    const d = String(descripcion || "");
    const s = {};
    let m;
    if (categoria2 === "Estación total") {
      if (m = d.match(/(\d+(?:[.,]\d+)?)\s*(?:"|''|”|″|seg)/i)) s.precisionAngular = m[1];
      if (m = d.match(/\b(?:R|NP|NR)\s*(\d{3,4})\s*m?\b/i)) s.alcanceSinPrisma = m[1];
      if (/\bEGL\b/i.test(d)) s.egl = "Sí";
    } else if (categoria2 === "Nivel") {
      if (m = d.match(/(\d{2})\s*x\b/i)) s.aumento = m[1];
    } else if (categoria2 === "Dron (RPAS)") {
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
    const avisos2 = [];
    for (const a of estado3.alertasActivas) avisos2.push(`Alerta activa: ${a.descripcion}`);
    if (estado3.calibracion.nivel === "vencida") avisos2.push(`Calibración vencida (${fechaLegible(estado3.calibracion.proxima)})`);
    if (estado3.calibracion.nivel === "por_vencer") avisos2.push(`Calibración vence el ${fechaLegible(estado3.calibracion.proxima)}`);
    for (const v of estado3.vencimientos || []) {
      if (v.nivel === "vencida") avisos2.push(`${v.nombre} vencido (${fechaLegible(v.fecha)})`);
      if (v.nivel === "por_vencer") avisos2.push(`${v.nombre} vence el ${fechaLegible(v.fecha)}`);
    }
    return avisos2;
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
  async function reportarAnomalia({ equipoId, descripcion, proyectoId = null, personaId = null, tipo = "problema", origen = null }) {
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
      tipo,
      origen,
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
    const campo2 = rol === "placa" ? "placaId" : "fotoId";
    const a = await guardarArchivo(archivo, { modulo: "equipos", duenoTipo: "equipo", duenoId: equipoId, rol, carpeta: `${carpetaEquipo(eq)}/Fotos` }, { personaId: personaActual });
    if (eq[campo2]) await archivoAPapelera(eq[campo2], { personaId: personaActual });
    eq[campo2] = a.id;
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

  // modulos/vuelos/drones.js
  var DRONES_BASE = [
    {
      id: "m4e",
      familia: "m4e",
      familiaNombre: "DJI Matrice 4E",
      sensor: "Cámara gran angular",
      nombre: "DJI Matrice 4E (cámara gran angular)",
      // Focal efectiva 12,20 mm (ficha: 12,29 mm): con ella la altura para un GSD calza con DJI Pilot 2 (3,5 cm/px → 130,3 m).
      sensorAnchoMm: 17.3,
      sensorAltoMm: 13,
      focalMm: 12.2,
      focalFichaMm: 12.29,
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
      // v0.11.1 · Matrice 400 + Zenmuse L3 (ficha DJI): RGB 4/3" de 100 MP (12288 × 8192), 28 mm equivalentes, FOV horizontal 62°.
      // DJI no publica la focal real: 14,4 mm sale del FOV horizontal (17,3 mm / 2 / tan 31°) y calza con «GSD 3 cm a 300 m».
      // LiDAR: 80° de FOV (escaneo lineal); pulsos 100, 350, 1000 o 2000 kHz (350 kHz para volar bajo 300 m).
      // Autonomía: la ficha da 59 min solo con H30T; con la L3 (1,6 kg + conector) se estiman 45 min: corregir con vuelos reales.
      id: "m400-l3",
      familia: "m400",
      familiaNombre: "DJI Matrice 400",
      sensor: "Zenmuse L3",
      nombre: "DJI Matrice 400 · Zenmuse L3",
      sensorAnchoMm: 17.3,
      sensorAltoMm: 11.53,
      focalMm: 14.4,
      pixelesAncho: 12288,
      pixelesAlto: 8192,
      obturador: "mecanico",
      velocidadMaxMs: 20,
      autonomiaMin: 45,
      intervaloMinS: 1,
      vientoMaxMs: 12,
      rafagaMaxMs: 12,
      lidar: { puntosPorSegundo: 35e4, fovGrados: 80 }
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

  // modulos/equipos/sensores.js
  var fmt1 = (n) => Number(n).toLocaleString("es-CL", { maximumFractionDigits: 2 });
  function sensoresDe(eq) {
    const t = `${eq.marca || ""} ${eq.modelo || ""} ${eq.equipo || ""}`.toLowerCase().replace(/\s+/g, " ");
    const clave2 = [["matrice 4e", "m4e"], ["m4e", "m4e"], ["matrice 300", "m300"], ["m300", "m300"], ["matrice 400", "m400"], ["m400", "m400"], ["phantom 4 rtk", "p4rtk"], ["p4 rtk", "p4rtk"], ["p4rtk", "p4rtk"]].find(([k]) => t.includes(k));
    return clave2 ? DRONES_BASE.filter((d) => d.familia === clave2[1]) : [];
  }
  var textoSensor = (d) => `${d.sensor}: ${fmt1(d.sensorAnchoMm)} × ${fmt1(d.sensorAltoMm)} mm · ${d.pixelesAncho} × ${d.pixelesAlto} px · focal ${fmt1(d.focalMm)} mm${d.lidar ? ` · LiDAR ${fmt1(d.lidar.fovGrados)}° · ${Math.round(d.lidar.puntosPorSegundo / 1e3)} mil pts/s` : ""}`;

  // compartido/planilla.js
  var urlSheetJS = "vendor/xlsx.full.min.js";
  function leerCSV(texto3) {
    texto3 = texto3.replace(/^﻿/, "");
    const primera = texto3.split(/\r?\n/)[0] || "";
    const sep = (primera.match(/;/g) || []).length >= (primera.match(/,/g) || []).length ? ";" : ",";
    const filas = [];
    let fila2 = [];
    let campo2 = "";
    let entreComillas = false;
    for (let i = 0; i < texto3.length; i++) {
      const c = texto3[i];
      if (entreComillas) {
        if (c === '"' && texto3[i + 1] === '"') {
          campo2 += '"';
          i++;
        } else if (c === '"') entreComillas = false;
        else campo2 += c;
      } else if (c === '"') entreComillas = true;
      else if (c === sep) {
        fila2.push(campo2);
        campo2 = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto3[i + 1] === "\n") i++;
        fila2.push(campo2);
        filas.push(fila2);
        fila2 = [];
        campo2 = "";
      } else campo2 += c;
    }
    if (campo2 !== "" || fila2.length) {
      fila2.push(campo2);
      filas.push(fila2);
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
    const columnas = encabezados.map((h, indice2) => {
      const encabezado = String(h != null ? h : "").trim();
      return { indice: indice2, encabezado, campo: null, ignorar: informativas.has(normalizarTexto(encabezado)) };
    });
    for (const { campo: campo2, claves } of CLAVES) {
      const col = columnas.find((c) => !c.campo && !c.ignorar && c.encabezado && claves.some((k) => normalizarTexto(c.encabezado).includes(k)));
      if (col && !usados.has(campo2)) {
        col.campo = campo2;
        usados.add(campo2);
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
      const fila2 = filas[i];
      if (!fila2 || fila2.every((c) => texto(c) === "")) continue;
      const datos = { equipo: "", marca: "", modelo: "", descripcion: "", numeroSerie: "", fechaUltimaCalibracion: null, calibracionNoAplica: false };
      const extra = {};
      const problemas = [];
      for (const col of columnas) {
        const v = fila2[col.indice];
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
    const { st, esc: esc3, proy, pers, avisar: avisar2, ir, render, esRRHH } = ctx2;
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
        ⚠ ${est2.alertasActivas.length === 1 ? esc3(est2.alertasActivas[0].descripcion) : `${est2.alertasActivas.length} alertas activas`}
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
        const unidad = c.sufijo && /^[\d.,\s]+$/.test(String(v)) ? c.sufijo === '"' ? '"' : ` <small>${esc3(c.sufijo)}</small>` : "";
        return `<div class="eq-spec"><dt>${c.etiqueta}</dt><dd>${esc3(String(v).trim())}${unidad}${calc ? ' <span class="eq-calc" title="Deducido de la descripción; confírmalo en Especificaciones">?</span>' : ""}</dd></div>`;
      }).join("");
      const datos = [
        ["Marca", eq.marca],
        ["Modelo", eq.modelo],
        ["N° serie", eq.numeroSerie, true],
        ["Calibración", eq.calibracionNoAplica ? "No aplica" : fechaLegible(eq.fechaUltimaCalibracion), true],
        ...!eq.calibracionNoAplica && est2.calibracion.proxima ? [["Próxima", fechaLegible(est2.calibracion.proxima), true]] : [],
        ["Certificado", vig ? vig.codigo : "—"]
      ].map(([k, v, mono]) => `<div class="eq-spec"><dt>${k}</dt><dd${mono ? ' class="eq-mono"' : ""}>${esc3(v || "—")}</dd></div>`).join("");
      const venc = (est2.vencimientos || []).filter((v) => v.nivel !== "ok").map((v) => `<span class="eq-chip ${v.nivel === "vencida" ? "rojo" : "ambar"}">${esc3(v.nombre)} ${v.nivel === "vencida" ? "vencido" : `vence en ${v.dias} d`}</span>`).join(" ");
      return `<header class="eq-ficha">
      <div class="eq-ficha-foto">
        <div class="eq-foto-marco">${principal ? `<img src="${principal}" alt="Foto de ${esc3(est2.nombre)}">` : `<div class="eq-foto-dibujo">${dibujo(eq.categoria)}<small>Sin foto</small></div>`}</div>
        <div class="eq-foto-acciones">
          ${urlFoto && urlPlaca ? `<button class="eq-btn chico${!verPlaca ? " activo" : ""}" data-accion="ver-foto" data-cual="foto">Equipo</button><button class="eq-btn chico${verPlaca ? " activo" : ""}" data-accion="ver-foto" data-cual="placa">Placa</button>` : ""}
          <label class="eq-btn chico">📷 ${urlFoto ? "Cambiar foto" : "Foto"}<input type="file" accept="image/*" capture="environment" data-accion-cambio="subir-foto" data-rol="foto" hidden></label>
          <label class="eq-btn chico">🏷 ${urlPlaca ? "Cambiar placa" : "Foto placa"}<input type="file" accept="image/*" capture="environment" data-accion-cambio="subir-foto" data-rol="placa" hidden></label>
        </div>
      </div>
      <div class="eq-ficha-info">
        <div class="eq-cat">${esc3(eq.categoria)}${eq.codigoInterno ? " · " + esc3(eq.codigoInterno) : ""}</div>
        <h2>${esc3(est2.nombre)}</h2>
        ${eq.descripcion ? `<p class="eq-ficha-desc">${esc3(eq.descripcion)}</p>` : ""}
        <div class="eq-chips">${ctx2.chipUbicacion(u)} ${ctx2.chipCalibracion(est2.calibracion)} ${venc}</div>
        ${u.lugar === "terreno" ? `<p class="eq-tenue" style="margin:6px 0 0">En ${esc3(proy(u.proyectoId))} desde ${fechaLegible(u.desde)} · responsable ${esc3(pers(u.personaId))}</p>` : ""}
        <dl class="eq-specs">${datos}</dl>
        ${sensoresDe(eq).length ? `<div class="eq-sensores"><b>Cámara y módulos (catálogo de sensores)</b>${sensoresDe(eq).map((x) => `<div>${esc3(textoSensor(x))}</div>`).join("")}<small>Estos datos usa Vuelos para calcular altura, franja y líneas. Se corrigen en Equipos → Catálogo de sensores.</small></div>` : ""}
        <div class="eq-specs-cab"><span>Especificaciones técnicas${modelo ? "" : ""}</span>
          ${esRRHH && claveModelo(eq) ? '<button class="eq-enlace" data-accion="ir" data-vista="especificaciones">Editar</button>' : ""}</div>
        ${specs || modelo && modelo.otras ? `<dl class="eq-specs">${specs}</dl>${modelo && modelo.otras ? `<p class="eq-tenue eq-pre">${esc3(modelo.otras)}</p>` : ""}` : `<p class="eq-tenue">Sin especificaciones${esRRHH ? ". Se escriben una vez por modelo y las comparten todas las unidades iguales." : "."}</p>`}
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
        <td>${esc3(a.nombre)}</td><td class="eq-mono eq-centro">${a.cantidad || 1}</td><td class="eq-mono">${esc3(a.serie || "—")}</td>
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
        <td>${c.archivoId ? `<button class="eq-enlace eq-mono" data-accion="abrir-archivo" data-id="${c.archivoId}" title="Abrir PDF">${esc3(c.codigo)}</button>` : `<span class="eq-mono">${esc3(c.codigo)}</span> <span class="eq-tenue">(sin PDF)</span>`}
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
        const filas = periodos.map((p) => `<tr><td>${esc3(proy(p.proyectoId))}</td><td>${esc3(pers(p.personaId))}</td>
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
          <div class="eq-alerta-cab"><span>${fechaLegible(a.fechaReporte)} · ${esc3(pers(a.reportadaPor))}</span><span class="eq-chip ${a.estado === "cerrada" ? "gris" : "rojo"}">${ESTADOS_ALERTA[a.estado]}</span></div>
          <p>${esc3(a.descripcion)}</p>
          ${usos.length ? `<div class="eq-txt-rojo">Usado ${usos.length} ${usos.length === 1 ? "vez" : "veces"} con la alerta abierta</div>` : ""}
          ${esRRHH && PASOS_ALERTA[a.estado].length ? `<div class="eq-acciones">${PASOS_ALERTA[a.estado].map((p) => `<button class="eq-btn chico" data-accion="alerta-paso" data-id="${a.id}" data-estado="${p.estado}">${p.texto}</button>`).join("")}</div>` : ""}
        </div>`;
        };
        const activas = await Promise.all(est2.alertasActivas.map(tarjeta));
        const cerradas = await Promise.all(est2.alertas.filter((a) => !alertaActiva(a)).map(tarjeta));
        const filas = mants.map((m) => `<tr><td class="eq-mono">${fechaLegible(m.fecha)}</td><td>${esc3(m.tipo)}</td><td>${esc3(m.proveedor || "—")}</td>
        <td class="eq-mono">${esc3(m.orden || "—")}</td>${esRRHH ? `<td class="eq-mono">${m.costo ? pesos(m.costo) : "—"}</td>` : ""}<td class="eq-detalle">${esc3(m.descripcion || "")}</td>
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
            ${est2.alertasActivas.length ? `<label class="eq-campo"><span>Corresponde a la alerta</span><select name="alertaId"><option value="">— ninguna —</option>${est2.alertasActivas.map((a) => `<option value="${a.id}">${esc3(a.descripcion.slice(0, 60))}</option>`).join("")}</select></label>` : ""}
            <div class="eq-acciones"><button class="eq-btn primario" type="submit">Guardar mantención</button></div>
          </form></details>` : ""}
        ${cerradas.length ? `<details class="eq-detalles"><summary>Alertas cerradas (${cerradas.length})</summary>${cerradas.join("")}</details>` : ""}`;
      },
      async notas({ notas }) {
        const yo = personaActiva();
        const item = (n) => `<li class="eq-nota${n.archivada ? " archivada" : ""}"><div>${esc3(n.texto)}</div>
        <div class="eq-nota-pie"><span>${esc3(pers(n.creadoPor))} · ${fechaLegible(n.creadoEn)}</span>
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
          <button class="eq-enlace" data-accion="abrir-archivo" data-id="${d.id}">${esc3(d.nombre)}</button>
          <span class="eq-tenue">${ROLES_DOC[d.rol] || ""} · ${tamanoLegible(d.tamano)}</span>
          ${esRRHH ? `<button class="eq-x" data-accion="papelera-archivo" data-id="${d.id}" title="Enviar a la papelera">✕</button>` : ""}</li>`).join("")}</ul>` : '<p class="eq-tenue">Sin documentos.</p>';
        const subir = (nivel) => esRRHH ? `<form class="eq-form eq-mini fila" data-form="documento" data-nivel="${nivel}">
          <select name="rol">${Object.entries(ROLES_DOC).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
          <label class="eq-archivo">Elegir PDF<input type="file" name="archivo" accept="application/pdf,image/*" required></label>
          <button class="eq-btn chico relleno" type="submit">Subir</button></form>` : "";
        const iguales = (await listarConEstado()).filter((x) => claveModelo(x.equipo) === claveModelo(eq)).length;
        return `<h3>Del modelo ${esc3([eq.marca, eq.modelo].filter(Boolean).join(" "))}${iguales > 1 ? ` <small class="eq-tenue">· compartido por ${iguales} unidades</small>` : ""}</h3>
        ${claveModelo(eq) ? lista(docsModelo) + subir("modelo") : '<p class="eq-tenue">Falta marca o modelo.</p>'}
        <h3 style="margin-top:16px">De esta unidad</h3>
        ${lista(docsUnidad)}${subir("unidad")}`;
      },
      async admin({ est: est2, eq }) {
        const campos = CAMPOS_ADMIN.filter((c) => !c.soloCategoria || c.soloCategoria === eq.categoria).map((c) => {
          var _a;
          return `<label class="eq-campo"><span>${c.etiqueta}</span><input type="${c.tipo || "text"}" name="${c.clave}" value="${esc3((_a = eq.admin[c.clave]) != null ? _a : "")}"${c.tipo === "number" ? ' min="0" step="1"' : ""}></label>`;
        }).join("");
        const extra = Object.entries(eq.columnasExtra || {}).map(([k, v]) => `<div class="eq-spec"><dt>${esc3(k)}</dt><dd>${esc3(v)}</dd></div>`).join("");
        return `<form class="eq-form eq-mini" data-form="admin"><div class="eq-grid-admin">${campos}</div>
          <div class="eq-acciones"><button class="eq-btn chico relleno" type="submit">Guardar datos administrativos</button></div></form>
        <dl class="eq-specs">
          <div class="eq-spec"><dt>Fecha de alta</dt><dd class="eq-mono">${fechaLegible(eq.fechaAlta)}</dd></div>
          <div class="eq-spec"><dt>Origen</dt><dd>${eq.origen === "planilla" ? "Planilla importada" : "Ingreso manual"}</dd></div>
          <div class="eq-spec"><dt>Calibrar cada</dt><dd>${eq.periodoCalibracionMeses || PERIODO_CALIBRACION_MESES} meses</dd></div>
          ${extra}
        </dl>
        ${eq.observaciones ? `<p class="eq-tenue eq-pre">${esc3(eq.observaciones)}</p>` : ""}
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
          const control = c.opciones ? `<select name="${c.clave}"><option value=""></option>${c.opciones.map((o) => `<option${o === v ? " selected" : ""}>${o}</option>`).join("")}</select>` : `<input name="${c.clave}" value="${esc3(v)}">`;
          return `<label class="eq-campo"><span>${c.etiqueta}${c.sufijo ? ` (${esc3(c.sufijo)})` : ""}${!guardadas[c.clave] && deducidas[c.clave] ? " · <i>deducido de la descripción</i>" : ""}</span>${control}</label>`;
        }).join("");
        return `<button class="eq-volver" data-accion="ver" data-id="${eq.id}">← ${esc3(est2.nombre)}</button>
        <form class="eq-form" data-form="especificaciones"><fieldset><legend>Especificaciones · ${esc3([eq.marca, eq.modelo].join(" "))}</legend>
          <p class="eq-tenue">Se guardan por modelo: ${iguales > 1 ? `las ${iguales} unidades ${esc3(eq.marca)} ${esc3(eq.modelo)} las comparten.` : "si llega otra unidad igual, las tendrá también."}</p>
          ${campos}
          <label class="eq-campo"><span>Otras especificaciones</span><textarea name="otras" rows="3">${esc3(modelo && modelo.otras || "")}</textarea></label>
        </fieldset><div class="eq-acciones"><button class="eq-btn primario" type="submit">Guardar especificaciones</button></div></form>`;
      },
      async accesorios() {
        const est2 = await estadoDeEquipo(st.equipoId);
        const eq = est2.equipo;
        return `<button class="eq-volver" data-accion="ver" data-id="${eq.id}">← ${esc3(est2.nombre)}</button>
        <form class="eq-form" data-form="accesorios"><fieldset><legend>Accesorios</legend>
          <p class="eq-tenue">Lo que sale en la caja con el equipo. Arma el checklist de salida y regreso.</p>
          <div class="eq-acc-cab"><span>Accesorio</span><span>Cant.</span><span>N° serie</span><span></span></div>
          <div class="eq-acc-filas">${eq.accesorios.map(filaAccesorio).join("")}</div>
          <div class="eq-acciones"><button type="button" class="eq-btn chico" data-accion="acc-agregar">+ Agregar</button>
            <button type="button" class="eq-btn chico" data-accion="acc-sugerir" data-categoria="${esc3(eq.categoria)}">Sugerir según categoría</button></div>
        </fieldset><div class="eq-acciones"><button class="eq-btn primario" type="submit">Guardar accesorios</button></div></form>`;
      },
      async certificado() {
        const est2 = await estadoDeEquipo(st.equipoId);
        const eq = est2.equipo;
        return `<button class="eq-volver" data-accion="ver" data-id="${eq.id}">← ${esc3(est2.nombre)}</button>
        <form class="eq-form" data-form="certificado"><fieldset><legend>Agregar certificado</legend>
          <label class="eq-campo"><span>Código del certificado</span><input name="codigo" required placeholder="Ej.: CC-2025-1143"></label>
          <label class="eq-campo"><span>Fecha de mantención</span><input type="date" name="fecha" value="${hoyISO()}" required></label>
          <label class="eq-campo"><span>Laboratorio / servicio técnico (opcional)</span><input name="laboratorio" value="${esc3(eq.laboratorio || "")}"></label>
          <label class="eq-campo"><span>PDF del certificado</span><input type="file" name="archivo" accept="application/pdf,image/*"></label>
          ${eq.calibracionNoAplica ? "" : '<label class="eq-comp"><input type="checkbox" name="actualizarFecha" checked> Actualizar la FECHA CALIBRACIÓN del equipo</label>'}
        </fieldset><div class="eq-acciones"><button class="eq-btn primario" type="submit">Guardar certificado</button></div></form>`;
      },
      async etiqueta() {
        const est2 = await estadoDeEquipo(st.equipoId);
        const eq = est2.equipo;
        const enlace = ctx2.enlaceEquipo(eq.id);
        const svgQR = await qrSVG(enlace);
        return `<button class="eq-volver" data-accion="ver" data-id="${eq.id}">← ${esc3(est2.nombre)}</button>
        <div class="eq-intro"><h2>Etiqueta QR</h2>
          <p class="eq-tenue">Imprímela y pégala en la caja. Al escanearla con el teléfono se abre esta ficha${/^https?:/.test(enlace) ? "" : ". <b>Para que el QR funcione desde otro teléfono, genera la etiqueta desde la versión publicada en GitHub Pages</b> (abierta desde el PC, el enlace apunta a un archivo local)"}.</p></div>
        <div class="eq-etiqueta" id="eq-etiqueta">
          <div class="eq-etq-qr">${svgQR}</div>
          <div class="eq-etq-txt"><b>${esc3(est2.nombre)}</b><span>N° serie ${esc3(eq.numeroSerie || "—")}</span>${eq.codigoInterno ? `<span>${esc3(eq.codigoInterno)}</span>` : ""}<small>Topoland</small></div>
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
            return `<tr><td><button class="eq-enlace" data-accion="ver" data-id="${e.equipo.id}">${esc3(e.nombre)}</button></td><td class="eq-mono">${esc3(e.equipo.numeroSerie)}</td>
            <td>${c ? c.archivoId ? `<button class="eq-enlace eq-mono" data-accion="abrir-archivo" data-id="${c.archivoId}">${esc3(c.codigo)}</button>` : `<span class="eq-mono">${esc3(c.codigo)}</span> <span class="eq-tenue">(sin PDF)</span>` : e.equipo.calibracionNoAplica ? '<span class="eq-tenue">No requiere</span>' : '<span class="eq-txt-rojo">Sin certificado</span>'}</td>
            <td class="eq-mono">${c ? fechaLegible(c.fecha) : "—"}</td></tr>`;
          }));
          tabla = eqs.length ? `<div class="eq-tabla-scroll"><table class="eq-tabla-sub"><thead><tr><th>Equipo</th><th>N° serie</th><th>Código del certificado</th><th>Fecha mantención</th></tr></thead><tbody>${filas.join("")}</tbody></table></div>
          <p class="eq-tenue">Toca cada código para abrir su PDF.</p>` : '<p class="eq-tenue">No hay equipos asignados hoy a este proyecto.</p>';
        }
        return `<button class="eq-volver" data-accion="ir" data-vista="${esRRHH ? "admin" : "lista"}">← Volver</button>
        <div class="eq-intro"><h2>Certificados por proyecto</h2>
          <p class="eq-tenue">Los equipos que están hoy en el proyecto, con su certificado vigente. Para presentar al mandante o a la inspección.</p>
          <label class="eq-campo"><span>Proyecto</span><select data-accion-cambio="cert-proyecto"><option value="">Elige proyecto…</option>
            ${proyectos2.map((p) => `<option value="${p.id}"${p.id === pid ? " selected" : ""}>${esc3(p.nombre)}</option>`).join("")}</select></label></div>
        ${tabla}`;
      }
    };
    function filaAccesorio(a = { id: "", nombre: "", cantidad: 1, serie: "", estado: "bueno" }) {
      return `<div class="eq-acc-fila" data-id="${esc3(a.id)}" data-estado="${esc3(a.estado || "bueno")}">
      <input name="acc-nombre" value="${esc3(a.nombre)}" placeholder="Batería, radio, bastón…">
      <input name="acc-cantidad" type="number" min="1" value="${a.cantidad || 1}">
      <input name="acc-serie" value="${esc3(a.serie || "")}" placeholder="opcional">
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
    { id: "lista", texto: "Equipos", vistas: ["lista", "alta", "ficha", "editar", "especificaciones", "accesorios", "certificado", "etiqueta"] },
    { id: "salida", texto: "Salida", vistas: ["salida", "resultado"] },
    { id: "regreso", texto: "Regreso", vistas: ["regreso"] },
    { id: "alertas", texto: "Alertas", vistas: ["alertas", "reportar"] },
    { id: "admin", texto: "Administrar", vistas: ["admin", "importar", "catalogos", "respaldo", "papelera", "cert-proyecto"], soloRRHH: true }
  ];
  function leerVista() {
    try {
      return localStorage.getItem("eq_vista_lista") === "lista" ? "lista" : "tarjetas";
    } catch {
      return "tarjetas";
    }
  }
  function guardarVista(v) {
    try {
      localStorage.setItem("eq_vista_lista", v);
    } catch {
    }
  }
  function montarPantallas(contenedor2, contexto) {
    const esRRHH = contexto.rol === "rrhh";
    const persona4 = contexto.personaId || null;
    fijarPersona(persona4);
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
      reporteDesdeFicha: false,
      categoria: "",
      vistaLista: leerVista(),
      alta: null
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
    function opcionesProyectos(lista, seleccionado, { vacio: vacio3 = "Elige proyecto…" } = {}) {
      return `<option value="">${vacio3}</option>` + lista.map((p) => `<option value="${escapar(p.id)}"${p.id === seleccionado ? " selected" : ""}>${escapar(p.nombre)}${p.mandante && p.id !== OFICINA_ID ? " — " + escapar(p.mandante) : ""}</option>`).join("");
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
        if (!cacheLista.length && st.alta) return VISTAS2.alta();
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
        const vivos = cacheLista.filter((e) => e.ubicacion.lugar !== "baja");
        const cats = CATEGORIAS.filter((c) => vivos.some((e) => e.equipo.categoria === c));
        const catChips = `<button class="eq-tipo-chip${!st.categoria ? " activo" : ""}" data-accion="categoria" data-c="">Todos <span>${vivos.length}</span></button>` + cats.map((c) => `<button class="eq-tipo-chip${st.categoria === c ? " activo" : ""}" data-accion="categoria" data-c="${escapar(c)}">${escapar(c)} <span>${vivos.filter((e) => e.equipo.categoria === c).length}</span></button>`).join("");
        return `
        <div class="eq-barra">
          <input type="search" class="eq-buscar" placeholder="Buscar por modelo, N° serie, código…" value="${escapar(st.busqueda)}" data-campo="busqueda">
          <span class="eq-vistas" role="tablist" aria-label="Vista"><button type="button" role="tab" aria-selected="${st.vistaLista === "tarjetas"}" class="${st.vistaLista === "tarjetas" ? "activo" : ""}" data-accion="vista-lista" data-v="tarjetas">Tarjetas</button><button type="button" role="tab" aria-selected="${st.vistaLista === "lista"}" class="${st.vistaLista === "lista" ? "activo" : ""}" data-accion="vista-lista" data-v="lista">Lista</button></span>
          ${esRRHH ? '<button class="eq-btn primario" data-accion="nuevo-equipo">+ Equipo</button>' : ""}
        </div>
        <div class="eq-con-lado">
          <div class="eq-lado-principal">
            <div class="eq-cats" role="group" aria-label="Tipo de equipo">${catChips}</div>
            <div class="eq-filtros"><span class="eq-tenue">Estado:</span>${chips}</div>
            <div id="eq-resultados"></div>
          </div>
          <aside class="eq-lado" aria-label="${st.alta ? "Agregar equipo" : "Resumen de equipos"}">${st.alta ? await VISTAS2.alta(true) : htmlLadoResumen(esRRHH)}</aside>
        </div>`;
      },
      async alta(enLado = false) {
        const a = st.alta || (st.alta = { paso: 1, d: {} });
        const d = a.d, cat = d.categoria || "";
        const PASOS_ALTA = ["Tipo", "Marca y modelo", "Serie y registro", "Calibración y documentos", "Resumen"];
        const val = (k) => {
          var _a;
          return escapar((_a = d[k]) != null ? _a : "");
        };
        const campo2 = (k, t, tipo = "text", extra = "") => `<label class="eq-campo"><span>${t}</span><input type="${tipo}" name="${k}" value="${val(k)}" ${extra}></label>`;
        const esDron = cat === "Dron (RPAS)";
        const marcas = [.../* @__PURE__ */ new Set([...MARCAS_CONOCIDAS, ...cacheLista.map((x) => x.equipo.marca).filter(Boolean)])];
        let cuerpo = "";
        if (a.paso === 1) cuerpo = `<p class="eq-tenue">¿Qué tipo de equipo es?</p><div class="eq-tipos">${CATEGORIAS.map((c) => `<button type="button" class="eq-tipo${c === cat ? " activo" : ""}" data-accion="alta-tipo" data-c="${escapar(c)}">${escapar(c)}</button>`).join("")}</div>`;
        else if (a.paso === 2) {
          const sugeridos = esDron ? [...new Map(DRONES_BASE.map((x) => [x.familia, x])).values()] : [];
          cuerpo = `${sugeridos.length ? `<p class="eq-tenue">Elige un modelo del catálogo para cargar los datos de su cámara, o escríbelo.</p><div class="eq-tipos">${sugeridos.map((x) => `<button type="button" class="eq-tipo${d.modelo && x.familiaNombre.includes(d.modelo) ? " activo" : ""}" data-accion="alta-modelo" data-m="${escapar(x.familiaNombre.replace("DJI ", ""))}">${escapar(x.familiaNombre)}</button>`).join("")}</div>` : ""}
          ${campo2("equipo", "Nombre del equipo (como en la planilla)", "text", `required placeholder="${escapar(cat === "Otro" ? "Equipo" : cat)}"`)}
          <label class="eq-campo"><span>Marca</span><input name="marca" value="${val("marca")}" list="eq-marcas-alta"></label><datalist id="eq-marcas-alta">${marcas.map((m) => `<option value="${escapar(m)}">`).join("")}</datalist>
          ${campo2("modelo", "Modelo")}
          ${campo2("descripcion", "Descripción", "text", 'placeholder="Precisión, aumento o rol (Base, Rover…)"')}
          ${(() => {
            const sens = sensoresDe(d);
            return sens.length ? `<div class="eq-sensores"><b>Datos de la cámara (catálogo)</b>${sens.map((x) => `<div>${escapar(textoSensor(x))}</div>`).join("")}<small>Vuelos usa estos datos. Se corrigen en Equipos → Catálogo de sensores.</small></div>` : "";
          })()}`;
        } else if (a.paso === 3) cuerpo = `${campo2("numeroSerie", "N° de serie", "text", "required")}${campo2("codigoInterno", "Código interno (etiqueta)")}
          ${esDron ? `${campo2("dgacRegistro", "Registro DGAC del RPA")}` : ""}${campo2("fechaAlta", "Fecha de alta", "date")}`;
        else if (a.paso === 4) cuerpo = `<label class="eq-comp"><input type="checkbox" name="calibracionNoAplica" ${d.calibracionNoAplica ? "checked" : ""}> No requiere calibración</label>
          ${campo2("fechaUltimaCalibracion", "Última calibración", "date")}${campo2("periodoCalibracionMeses", "Calibrar cada (meses)", "number", 'min="1" max="60"')}
          ${campo2("seguroVence", "Seguro: vence", "date")}${esDron ? campo2("dgacVence", "Registro DGAC: vence", "date") : ""}
          <p class="eq-tenue">Los vencimientos aparecen como alertas en Inicio. Los certificados y fotos se agregan después en la ficha.</p>`;
        else cuerpo = `<dl class="eq-resumen-alta">${[["Tipo", cat], ["Equipo", d.equipo], ["Marca y modelo", [d.marca, d.modelo].filter(Boolean).join(" ")], ["Descripción", d.descripcion], ["N° de serie", d.numeroSerie], ["Código interno", d.codigoInterno], ["Registro DGAC", d.dgacRegistro], ["Calibración", d.calibracionNoAplica ? "No requiere" : d.fechaUltimaCalibracion || "sin fecha"], ["Seguro vence", d.seguroVence]].filter(([, v]) => v).map(([t, v]) => `<div><dt>${t}</dt><dd>${escapar(v)}</dd></div>`).join("")}</dl>
          <label class="eq-campo"><span>Observaciones</span><textarea name="observaciones" rows="2">${val("observaciones")}</textarea></label>`;
        const faltan = a.paso === 2 && !d.equipo ? "Falta el nombre del equipo." : a.paso === 3 && !d.numeroSerie ? "Falta el N° de serie: sin él no se puede rastrear el equipo." : "";
        return `${enLado ? `<div class="eq-lado-cab"><b>Agregar equipo</b><small>Paso ${a.paso} de 5</small><button type="button" class="eq-btn chico" data-accion="alta-cancelar">Cancelar</button></div>` : '<button class="eq-volver" data-accion="alta-cancelar">← Cancelar</button>\n        <h2>Nuevo equipo</h2>'}
        <div class="eq-pasos-alta">${PASOS_ALTA.map((t, i) => `<span class="${i + 1 < a.paso ? "hecho" : i + 1 === a.paso ? "actual" : ""}"><i>${i + 1 < a.paso ? "✓" : i + 1}</i>${t}</span>`).join("")}</div>
        <form class="eq-form eq-form-alta" data-form="alta">
          <fieldset><legend>${a.paso}. ${PASOS_ALTA[a.paso - 1]}</legend>${cuerpo}</fieldset>
          ${faltan ? `<div class="eq-aviso-alta">${escapar(faltan)}</div>` : ""}
          <div class="eq-acciones">${a.paso > 1 ? '<button type="submit" class="eq-btn" name="mover" value="-1">← Anterior</button>' : ""}
            ${a.paso < 5 ? a.paso > 1 ? '<button type="submit" class="eq-btn primario" name="mover" value="1">Siguiente →</button>' : "" : '<button type="submit" class="eq-btn primario" name="mover" value="guardar">Guardar equipo</button>'}</div>
        </form>`;
      },
      async editar() {
        var _a;
        const eq = st.equipoId ? (_a = await estadoDeEquipo(st.equipoId)) == null ? void 0 : _a.equipo : nuevoEquipo();
        if (!eq) return "<p>El equipo no existe.</p>";
        const campo2 = (nombre, etiqueta, tipo = "text", extra = "") => {
          var _a2;
          return `<label class="eq-campo"><span>${etiqueta}</span><input type="${tipo}" name="${nombre}" value="${escapar((_a2 = eq[nombre]) != null ? _a2 : "")}" ${extra}></label>`;
        };
        return `
        <button class="eq-volver" data-accion="${st.equipoId ? "ver" : "ir"}" data-vista="lista" data-id="${st.equipoId || ""}">← Volver</button>
        <h2>${st.equipoId ? "Editar equipo" : "Nuevo equipo"}</h2>
        <form class="eq-form" data-form="equipo">
          <fieldset><legend>Columnas de la planilla</legend>
            ${campo2("equipo", "EQUIPO", "text", 'required list="eq-tipos" placeholder="Estacion Total, GNSS, Nivel Topografico…"')}
            <datalist id="eq-tipos">${[...new Set(cacheLista.map((x) => x.equipo.equipo).filter(Boolean))].map((v) => `<option value="${escapar(v)}">`).join("")}</datalist>
            ${campo2("marca", "MARCA", "text", 'list="eq-marcas"')}
            <datalist id="eq-marcas">${[...new Set(cacheLista.map((x) => x.equipo.marca).filter(Boolean))].map((v) => `<option value="${escapar(v)}">`).join("")}</datalist>
            ${campo2("modelo", "MODELO")}
            ${campo2("descripcion", "DESCRIPCIÓN", "text", 'placeholder="1&quot; R500 · Aumento 32x · Base · Rover · Control…"')}
            ${campo2("numeroSerie", "N° SERIE")}
            ${campo2("fechaUltimaCalibracion", "FECHA CALIBRACIÓN", "date")}
            <label class="eq-comp"><input type="checkbox" name="calibracionNoAplica"${eq.calibracionNoAplica ? " checked" : ""}> No requiere calibración (en la planilla: «-»)</label>
          </fieldset>
          <fieldset><legend>Datos del módulo</legend>
            <label class="eq-campo"><span>Categoría</span><select name="categoria">${CATEGORIAS.map((c) => `<option${c === eq.categoria ? " selected" : ""}>${c}</option>`).join("")}</select></label>
            ${campo2("codigoInterno", "Código interno (etiqueta)")}
            ${campo2("periodoCalibracionMeses", "Calibrar cada (meses)", "number", 'min="1" max="60"')}
            ${campo2("fechaAlta", "Fecha de alta", "date")}
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
          const avisos2 = avisosDe(e);
          const comps = e.equipo.accesorios;
          return `<div class="eq-check-item">
          <label class="eq-check-cab"><input type="checkbox" name="equipo" value="${e.equipo.id}" data-accion-cambio="mostrar-componentes">
            <span><b>${escapar(e.nombre)}</b><small>N° serie <span class="eq-mono">${escapar(e.equipo.numeroSerie || "—")}</span>${traspaso ? ` · hoy en ${escapar(proy(e.ubicacion.proyectoId))}` : ""}</small></span></label>
          ${avisos2.length ? `<div class="eq-avisos">${avisos2.map((a) => `<div>⚠ ${escapar(a)}</div>`).join("")}<div class="eq-tenue">No bloquea la salida; queda registrado.</div></div>` : ""}
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
            <label class="eq-campo"><span>Responsable (encargado del trabajo)</span><select name="personaId" required>${opcionesPersonas(personas2, persona4)}</select></label>
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
    const ficha = crearFicha({ st, esc: escapar, proy, pers, avisar: avisar2, ir, render: () => render(), esRRHH, persona: persona4, chipUbicacion, chipCalibracion, describirEvento, enlaceEquipo });
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
    const fmtN = (n) => Number(n).toLocaleString("es-CL", { maximumFractionDigits: 1 });
    function datosClave(eq) {
      const sens = sensoresDe(eq);
      if (sens.length > 1) return { chips: sens.map((x) => x.sensor) };
      if (sens.length === 1) {
        const x = sens[0];
        return { cajas: [["Sensor", `${fmtN(x.sensorAnchoMm)} × ${fmtN(x.sensorAltoMm)} mm`], ["Imagen", `${x.pixelesAncho} px`], x.lidar ? ["LiDAR", `${Math.round(x.lidar.puntosPorSegundo / 1e3)} mil pts/s`] : [x.focalFichaMm ? "Focal efectiva" : "Focal", `${fmtN(x.focalMm)} mm`]] };
      }
      const esp = eq.especificaciones || {};
      return { cajas: camposEspecificacion(eq.categoria).filter((c) => esp[c.clave]).slice(0, 3).map((c) => [c.etiqueta, `${esp[c.clave]}${c.sufijo ? " " + c.sufijo : ""}`]) };
    }
    function htmlTarjeta(e) {
      const eq = e.equipo, serie2 = String(eq.numeroSerie || "");
      const sub3 = [eq.categoria || "Otro", serie2 ? `serie ···${serie2.slice(-4)}` : "sin N° de serie", eq.descripcion].filter(Boolean).join(" · ");
      const dc = datosClave(eq);
      const pie = e.alertasActivas.length ? chipAlertas2(e.alertasActivas.length) : chipCalibracion(e.calibracion);
      return `<button class="eq-tarjeta eq-tarjeta-foto" data-accion="ver" data-id="${eq.id}">
        <div class="eq-tf-cab"><div class="eq-tf-foto"${eq.fotoId ? ` data-foto="${escapar(eq.fotoId)}"` : ""}>${dibujo(eq.categoria)}</div>
          <div class="eq-tf-tit"><div class="eq-tf-fila"><b>${escapar(e.nombre)}</b>${chipUbicacion(e.ubicacion)}</div><small>${escapar(sub3)}</small></div></div>
        ${dc.chips ? `<div class="eq-tf-chips">${dc.chips.map((t) => `<span>${escapar(t)}</span>`).join("")}</div>` : dc.cajas.length ? `<div class="eq-tf-datos">${dc.cajas.map(([t, v]) => `<div><small>${escapar(t)}</small><b>${escapar(v)}</b></div>`).join("")}</div>` : ""}
        <div class="eq-tf-pie">${pie}</div>
      </button>`;
    }
    const fotos = /* @__PURE__ */ new Map();
    async function cargarFotos(cont) {
      for (const el of cont.querySelectorAll("[data-foto]")) {
        const id = el.dataset.foto;
        try {
          if (!fotos.has(id)) fotos.set(id, await urlArchivo(id));
          const url = fotos.get(id);
          if (url && el.isConnected) el.innerHTML = `<img src="${url}" alt="" loading="lazy">`;
        } catch {
        }
      }
    }
    function htmlLadoResumen(esRRHH2) {
      const vivos = cacheLista.filter((e) => e.ubicacion.lugar !== "baja");
      const cuenta2 = (l) => vivos.filter((e) => e.ubicacion.lugar === l).length;
      const lugares = Object.keys(LUGARES).filter((l) => l !== "baja" && cuenta2(l));
      const urgentes = vivos.filter((e) => e.alertasActivas.length || ["vencida", "por_vencer"].includes(e.calibracion.nivel)).sort((a, b) => {
        var _a, _b;
        return ((_a = a.calibracion.dias) != null ? _a : 999) - ((_b = b.calibracion.dias) != null ? _b : 999);
      }).slice(0, 6);
      return `<div class="eq-lado-cab"><b>Resumen</b><small>${vivos.length} equipos</small></div>
      <dl class="eq-lado-cuentas">${lugares.map((l) => `<div><dt>${escapar(LUGARES[l])}</dt><dd>${cuenta2(l)}</dd></div>`).join("")}</dl>
      <b class="eq-lado-sub">Por atender</b>
      ${urgentes.length ? `<ul class="eq-lado-lista">${urgentes.map((e) => `<li><button type="button" data-accion="ver" data-id="${e.equipo.id}"><span>${escapar(e.nombre)}</span>${e.alertasActivas.length ? chipAlertas2(e.alertasActivas.length) : chipCalibracion(e.calibracion)}</button></li>`).join("")}</ul>` : '<p class="eq-tenue">Nada vencido ni por vencer.</p>'}
      ${esRRHH2 ? '<button type="button" class="eq-btn primario eq-lado-btn" data-accion="nuevo-equipo">Agregar equipo</button><p class="eq-tenue">El alta se hace aquí, paso a paso, sin salir del listado.</p>' : ""}`;
    }
    function pintarResultados() {
      const cont = zona.querySelector("#eq-resultados");
      if (!cont) return;
      const fn = (FILTROS.find((f) => f[0] === st.filtro) || FILTROS[0])[2];
      const q = st.busqueda.trim().toLowerCase();
      const lista = cacheLista.filter(fn).filter((e) => !st.categoria || e.equipo.categoria === st.categoria).filter((e) => !q || [e.equipo.equipo, e.equipo.modelo, e.equipo.numeroSerie, e.equipo.marca, e.equipo.descripcion, e.equipo.codigoInterno, e.equipo.categoria].some((v) => String(v || "").toLowerCase().includes(q)));
      if (!lista.length) {
        cont.innerHTML = '<p class="eq-tenue">Ningún equipo coincide.</p>';
        return;
      }
      const tarjetas = lista.map(htmlTarjeta).join("");
      const filas = lista.map((e) => `<tr data-accion="ver" data-id="${e.equipo.id}">
        ${celdasPlanilla(e.equipo)}
        <td>${chipUbicacion(e.ubicacion)}</td><td>${chipCalibracion(e.calibracion)}</td><td>${chipAlertas2(e.alertasActivas.length)}</td></tr>`).join("");
      if (st.vistaLista === "tarjetas") {
        cont.innerHTML = `<div class="eq-tarjetas eq-siempre">${tarjetas}</div>`;
        cargarFotos(cont);
        return;
      }
      cont.innerHTML = `<div class="eq-tabla-scroll eq-siempre"><table class="eq-tabla">
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
          case "nuevo-equipo": {
            const enPc = document.body.dataset.modo === "pc" && st.vista === "lista";
            await ir(enPc ? "lista" : "alta", { equipoId: null, alta: { paso: 1, d: { fechaAlta: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), periodoCalibracionMeses: PERIODO_CALIBRACION_MESES } } });
            break;
          }
          case "alta-tipo": {
            const c = el.dataset.c;
            st.alta.d.categoria = c;
            if (["Dron (RPAS)", "Escáner láser"].includes(c)) st.alta.d.calibracionNoAplica = true;
            if (!st.alta.d.equipo) st.alta.d.equipo = c === "Dron (RPAS)" ? "Dron" : c;
            st.alta.paso = 2;
            await render();
            break;
          }
          case "alta-modelo": {
            st.alta.d.modelo = el.dataset.m;
            st.alta.d.marca = st.alta.d.marca || "DJI";
            await render();
            break;
          }
          case "alta-cancelar":
            st.alta = null;
            await ir("lista");
            break;
          case "categoria":
            st.categoria = el.dataset.c;
            await render();
            break;
          case "vista-lista":
            st.vistaLista = el.dataset.v;
            guardarVista(el.dataset.v);
            await render();
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
            await restaurar(el.dataset.almacen, id, { personaId: persona4 });
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
            await guardarProyecto({ nombre: nombre.trim(), mandante: mandante.trim() }, { personaId: persona4 });
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
          case "alta": {
            const a = st.alta, mover2 = ev.submitter ? ev.submitter.value : "1";
            for (const [k, v] of Object.entries(fd)) if (k !== "mover") a.d[k] = v;
            if (a.paso === 4) a.d.calibracionNoAplica = fd.calibracionNoAplica === "on";
            if (mover2 === "guardar") {
              const { dgacRegistro, seguroVence, dgacVence, ...d } = a.d;
              const eq = await guardarEquipo({
                ...d,
                fechaUltimaCalibracion: d.fechaUltimaCalibracion || null,
                periodoCalibracionMeses: Number(d.periodoCalibracionMeses) || PERIODO_CALIBRACION_MESES,
                admin: { ...dgacRegistro ? { dgacRegistro } : {}, ...seguroVence ? { seguroVence } : {}, ...dgacVence ? { dgacVence } : {} },
                origen: "manual"
              });
              st.alta = null;
              avisar2("Equipo guardado");
              await ir("ficha", { equipoId: eq.id });
              break;
            }
            a.paso = Math.max(1, Math.min(5, a.paso + Number(mover2)));
            await render();
            break;
          }
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
            await reportarAnomalia({ equipoId: fd.equipoId, descripcion: fd.descripcion.trim(), personaId: persona4 });
            avisar2("Alerta enviada a RRHH");
            if (st.reporteDesdeFicha && fd.equipoId === st.equipoId) await ir("ficha", { fichaTab: "mantencion", reporteDesdeFicha: false });
            else await ir("alertas");
            break;
          case "proyecto":
            await guardarProyecto({ nombre: fd.nombre.trim(), mandante: fd.mandante.trim() }, { personaId: persona4 });
            await render();
            break;
          case "persona":
            await guardarPersona({ nombre: fd.nombre.trim(), cargo: fd.cargo.trim() }, { personaId: persona4 });
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
  async function reportarProblema({ equipoId, descripcion, tipo = "problema", proyectoId = null, personaId = null, origen = "app-terreno" }) {
    iniciar2();
    const a = await reportarAnomalia({ equipoId, descripcion, tipo: tipo === "aviso" ? "aviso" : "problema", proyectoId, personaId, origen });
    return { id: a.id, estado: a.estado, fechaReporte: a.fechaReporte };
  }
  async function listarAlertas({ soloActivas = true } = {}) {
    iniciar2();
    const [alertas, equipos] = await Promise.all([todasLasAlertas(), listarConEstado()]);
    const nombre = (id) => {
      const e = equipos.find((x) => x.equipo.id === id);
      return e ? e.nombre : "Equipo";
    };
    return alertas.filter((a) => !a.eliminadoEn && (!soloActivas || alertaActiva(a))).sort((a, b) => (b.fechaReporte || "").localeCompare(a.fechaReporte || "")).map((a) => ({
      id: a.id,
      equipoId: a.equipoId,
      equipo: nombre(a.equipoId),
      tipo: a.tipo || "problema",
      estado: a.estado,
      descripcion: a.descripcion,
      proyectoId: a.proyectoId || null,
      reportadaPor: a.reportadaPor || null,
      fechaReporte: a.fechaReporte,
      origen: a.origen || null
    }));
  }

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
    return DRONES_BASE.map((d) => {
      const c = cambios[d.id] ? limpiarCambios(cambios[d.id]) : null;
      if (c && d.focalFichaMm && Number(c.focalMm) === d.focalFichaMm) delete c.focalMm;
      return { ...d, ...c || {}, corregido: !!c };
    });
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
  function pasadasPorLado(semi, sep) {
    const q = semi / Math.max(1e-9, sep);
    const ent = Math.floor(q + 1e-9);
    return Math.max(1, q - ent > 0.5 + 1e-9 ? ent + 1 : ent);
  }
  function pasadasCorredor(eje, izq, der, sep) {
    const s = Math.max(1, sep), nI = pasadasPorLado(izq, s), nD = pasadasPorLado(der, s);
    const pasadas = [];
    for (let k = nD; k >= 1; k--) pasadas.push(desplazarLinea(eje, -(k - 0.5) * s));
    for (let k = 1; k <= nI; k++) pasadas.push(desplazarLinea(eje, (k - 0.5) * s));
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
  function recorrerPorBaterias(pasadas, op) {
    if (!op.despegue || !pasadas.length) return recorrerDesde(pasadas, op);
    const inv = (p) => p.slice().reverse();
    const opciones = [(x) => x, (x) => x.map(inv), (x) => x.slice().reverse(), (x) => x.slice().reverse().map(inv)];
    let mejor = null;
    for (const f of opciones) {
      const r = recorrerDesde(f(pasadas), op);
      if (!mejor || r.baterias.length < mejor.baterias.length || r.baterias.length === mejor.baterias.length && r.segVuelo < mejor.segVuelo - 1e-6) mejor = r;
    }
    return mejor;
  }
  function recorrerDesde(pasadas, { v, segGiro = 0, segUtiles, despegue = null }) {
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
  function puntoEnEje(eje, s) {
    let acum = 0;
    for (let i = 0; i + 1 < eje.length; i++) {
      const l = dist(eje[i], eje[i + 1]);
      if (s <= acum + l || i + 2 === eje.length) {
        const t = l ? Math.max(0, Math.min(1, (s - acum) / l)) : 0;
        return { p: add(eje[i], mul(sub(eje[i + 1], eje[i]), t)), dir: unit(sub(eje[i + 1], eje[i])) };
      }
      acum += l;
    }
    return { p: eje[0], dir: [1, 0] };
  }
  function cortesTransversales(eje, distancias, semi) {
    const L = largo(eje);
    return distancias.filter((s) => s > 1 && s < L - 1).map((s) => {
      const { p, dir } = puntoEnEje(eje, s);
      const n = [-dir[1], dir[0]];
      return [add(p, mul(n, semi)), add(p, mul(n, -semi))];
    });
  }
  function distanciaEnEje(eje, q) {
    let mejor = { d: Infinity, s: 0 }, acum = 0;
    for (let i = 0; i + 1 < eje.length; i++) {
      const a = eje[i], b = eje[i + 1], ab = sub(b, a), l = Math.hypot(ab[0], ab[1]);
      const t = l ? Math.max(0, Math.min(1, ((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1]) / (l * l))) : 0;
      const p = add(a, mul(ab, t)), d = dist(p, q);
      if (d < mejor.d) mejor = { d, s: acum + t * l };
      acum += l;
    }
    return mejor.s;
  }
  function remuestrear(linea, n) {
    const L = largo(linea);
    if (n < 2 || !L) return [linea[0], linea[linea.length - 1]];
    const out = [];
    let i = 0, acum = 0;
    for (let k = 0; k < n; k++) {
      const s = L * k / (n - 1);
      while (i + 2 < linea.length && acum + dist(linea[i], linea[i + 1]) < s) {
        acum += dist(linea[i], linea[i + 1]);
        i++;
      }
      const l = dist(linea[i], linea[i + 1]) || 1;
      out.push(add(linea[i], mul(sub(linea[i + 1], linea[i]), Math.max(0, Math.min(1, (s - acum) / l)))));
    }
    return out;
  }
  function simplificar(linea, tol) {
    if (linea.length < 3) return linea.slice();
    const marca = new Uint8Array(linea.length);
    marca[0] = marca[linea.length - 1] = 1;
    const pila = [[0, linea.length - 1]];
    while (pila.length) {
      const [a, b] = pila.pop();
      let max = -1, idx = -1;
      for (let i = a + 1; i < b; i++) {
        const d = distPuntoSegmento(linea[i], linea[a], linea[b]);
        if (d > max) {
          max = d;
          idx = i;
        }
      }
      if (max > tol) {
        marca[idx] = 1;
        pila.push([a, idx], [idx, b]);
      }
    }
    return linea.filter((_, i) => marca[i]);
  }
  function ejeDePoligono(poli) {
    const pts = limpiarVertices(poli, true);
    const n = pts.length;
    if (n < 4) return null;
    const paso = Math.max(1, Math.ceil(n / 1500));
    let mejor = { d: -1, i: 0, j: 0 };
    for (let i2 = 0; i2 < n; i2 += paso) for (let j2 = i2 + paso; j2 < n; j2 += paso) {
      const d = dist(pts[i2], pts[j2]);
      if (d > mejor.d) mejor = { d, i: i2, j: j2 };
    }
    const afinar = (fijo, idx) => {
      let b = idx, bd = dist(pts[fijo], pts[idx]);
      for (let k = -paso; k <= paso; k++) {
        const m2 = (idx + k + n) % n, d = dist(pts[fijo], pts[m2]);
        if (d > bd) {
          bd = d;
          b = m2;
        }
      }
      return b;
    };
    let { i, j } = mejor;
    j = afinar(i, j);
    i = afinar(j, i);
    if (i > j) [i, j] = [j, i];
    const A = pts.slice(i, j + 1);
    const B = [...pts.slice(j), ...pts.slice(0, i + 1)].reverse();
    const La = largo(A), Lb = largo(B);
    const m = Math.max(50, Math.min(4e3, Math.round(Math.max(La, Lb) / 25)));
    const ra = remuestrear(A, m), rb = remuestrear(B, m);
    const medio = ra.map((p, k) => mul(add(p, rb[k]), 0.5));
    const W = Math.max(10, Math.round(m / 40));
    const cercano = (q2, cadena2, k) => {
      let best = Infinity;
      for (let i2 = Math.max(0, k - W); i2 <= Math.min(m - 2, k + W); i2++) best = Math.min(best, distPuntoSegmento(q2, cadena2[i2], cadena2[i2 + 1]));
      return best;
    };
    const anchosBrutos = medio.map((q2, k) => cercano(q2, ra, k) + cercano(q2, rb, k));
    const eje = simplificar(medio, 1.5);
    const L = largo(medio);
    const util = anchosBrutos.slice(Math.floor(m * 0.03), Math.ceil(m * 0.97));
    const orden = util.slice().sort((x, y) => x - y);
    const q = (f) => orden[Math.min(orden.length - 1, Math.max(0, Math.round(f * (orden.length - 1))))];
    const anchoProm = util.reduce((s, x) => s + x, 0) / (util.length || 1);
    return {
      eje,
      largo: L,
      anchos: anchosBrutos.map((w, k) => ({ s: L * k / (m - 1), ancho: w })),
      anchoMin: q(0.05),
      anchoProm,
      anchoMax: q(0.95),
      razon: anchoProm ? L / anchoProm : 0
    };
  }
  var esAreaLineal = (e) => !!e && e.razon >= 8 && e.largo >= 1e3;
  function anchoEn(perfil, s) {
    if (!perfil || !perfil.length) return 0;
    let k = perfil.findIndex((p) => p.s >= s);
    if (k <= 0) return perfil[Math.max(0, k)].ancho;
    if (k < 0) return perfil[perfil.length - 1].ancho;
    const a = perfil[k - 1], b = perfil[k], t = (s - a.s) / (b.s - a.s || 1);
    return a.ancho + (b.ancho - a.ancho) * t;
  }
  function distanciasPorSuperficie(perfil, L, m2) {
    if (!(m2 > 0) || !perfil || !perfil.length) return [];
    const out = [];
    let acum = 0, meta = m2;
    for (let k = 1; k < perfil.length; k++) {
      const ds = perfil[k].s - perfil[k - 1].s, w = (perfil[k].ancho + perfil[k - 1].ancho) / 2;
      if (acum + ds * w >= meta) {
        const falta = meta - acum;
        out.push(perfil[k - 1].s + falta / (w || 1));
        meta += m2;
      }
      acum += ds * w;
    }
    return out.filter((s) => s > 1 && s < L - 1);
  }
  function cascoConvexo(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const x of p) {
      while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], x) <= 0) lo.pop();
      lo.push(x);
    }
    for (let i = p.length - 1; i >= 0; i--) {
      const x = p[i];
      while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], x) <= 0) hi.pop();
      hi.push(x);
    }
    hi.pop();
    lo.pop();
    return lo.concat(hi);
  }
  function rumboLadoLargo(poli) {
    const h = cascoConvexo(poli);
    let mejor = { area: Infinity, rumbo: 0 };
    for (let g = 0; g < 180; g++) {
      const a = g * Math.PI / 180, d = [Math.sin(a), Math.cos(a)], n = [Math.cos(a), -Math.sin(a)];
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const p of h) {
        const x = p[0] * d[0] + p[1] * d[1], y = p[0] * n[0] + p[1] * n[1];
        a0 = Math.min(a0, x);
        a1 = Math.max(a1, x);
        b0 = Math.min(b0, y);
        b1 = Math.max(b1, y);
      }
      const area2 = (a1 - a0) * (b1 - b0);
      if (area2 < mejor.area - 1e-6) mejor = { area: area2, rumbo: a1 - a0 >= b1 - b0 ? g : (g + 90) % 180 };
    }
    return mejor.rumbo;
  }
  function recortarSemiplano(poli, n, c) {
    const out = [], f = (p) => p[0] * n[0] + p[1] * n[1] - c;
    for (let i = 0; i < poli.length; i++) {
      const a = poli[i], b = poli[(i + 1) % poli.length], fa = f(a), fb = f(b);
      if (fa <= 0) out.push(a);
      if (fa < 0 && fb > 0 || fa > 0 && fb < 0) {
        const t = fa / (fa - fb);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  }
  function cortesParalelos(poli, n, rumboCortes, { igualSuperficie = true } = {}) {
    if (!(n >= 2)) return [];
    const a = rumboCortes * Math.PI / 180, d = [Math.sin(a), Math.cos(a)], nn = [Math.cos(a), -Math.sin(a)];
    const proy = poli.map((p) => p[0] * nn[0] + p[1] * nn[1]);
    const c0 = Math.min(...proy), c1 = Math.max(...proy);
    const largoCorte = Math.max(...poli.map((p) => p[0] * d[0] + p[1] * d[1])) - Math.min(...poli.map((p) => p[0] * d[0] + p[1] * d[1]));
    const total = Math.abs(areaFirmada(poli));
    const posiciones = [];
    for (let k = 1; k < n; k++) {
      if (!igualSuperficie) {
        posiciones.push(c0 + (c1 - c0) * k / n);
        continue;
      }
      const meta = total * k / n;
      let lo = c0, hi = c1;
      for (let it = 0; it < 40 && hi - lo > 0.05; it++) {
        const m = (lo + hi) / 2;
        if (Math.abs(areaFirmada(recortarSemiplano(poli, nn, m))) < meta) lo = m;
        else hi = m;
      }
      posiciones.push((lo + hi) / 2);
    }
    const centroD = (Math.max(...poli.map((p) => p[0] * d[0] + p[1] * d[1])) + Math.min(...poli.map((p) => p[0] * d[0] + p[1] * d[1]))) / 2;
    const semi = largoCorte / 2 + 50;
    return posiciones.map((c) => {
      const base = add(mul(nn, c), mul(d, centroD));
      return [add(base, mul(d, -semi)), add(base, mul(d, semi))];
    });
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
    let area2, distanciaLineas, nLineas, segmentos = [], rumbo2 = null, pasadas = null, girado = false;
    if (p.eje && p.eje.length >= 2) {
      pasadas = pasadasCorredor(p.eje, p.izq, p.der, sepLineas);
      nLineas = pasadas.length;
      distanciaLineas = pasadas.reduce((t, x) => t + largo(x), 0);
      area2 = largo(p.eje) * (p.izq + p.der);
    } else if (p.puntos && p.puntos.length >= 3) {
      area2 = areaM2(p.puntos);
      rumbo2 = (_a = p.rumbo) != null ? _a : rumboLadoMasLargo(p.puntos);
      const r = lineasDeVuelo(p.puntos, rumbo2, sepLineas);
      segmentos = r.lineas;
      nLineas = r.lineas.length;
      distanciaLineas = r.lineas.reduce((t, l) => t + l.largo, 0);
      pasadas = segmentos.map((l) => [[l.x1, l.y], [l.x2, l.y]]);
      girado = true;
    } else {
      area2 = (p.areaHa || 0) * 1e4;
      distanciaLineas = area2 / sepLineas;
      nLineas = Math.max(1, Math.round(Math.sqrt(area2) / sepLineas));
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
      const g = girado ? giro(rumbo2) : null;
      despegueGirado = p.despegue ? g ? g.ida(p.despegue) : p.despegue : null;
      const rep = recorrerPorBaterias(pasadas, { v, segGiro: p.segGiro, segUtiles: Math.max(60, minUtiles * 60), despegue: despegueGirado });
      baterias = rep.baterias.map((b) => ({ ...b, min: b.seg / 60, piezas: g ? b.piezas.map((pz) => pz.map(g.vuelta)) : b.piezas, inicio: g ? g.vuelta(b.inicio) : b.inicio, fin: g ? g.vuelta(b.fin) : b.fin }));
      segMision = rep.segVuelo;
      trasladoM = baterias.reduce((t, b) => t + b.traslado, 0) * v;
      vuelos = Math.max(1, baterias.length);
    } else {
      segMision = distancia / v + nLineas * p.segGiro;
      vuelos = Math.max(1, Math.ceil(segMision / 60 / Math.max(1, minUtiles)));
    }
    const minTotal = segMision / 60 + vuelos * p.minDespegue + (vuelos - 1) * p.minCambio;
    const franja = barrido || huellaAncho;
    const lado = (semi) => {
      const q = semi / sepLineas;
      return { semi, cociente: q, residuo: q - Math.floor(q + 1e-9), pasadas: pasadasPorLado(semi, sepLineas) };
    };
    const detalle = { franja, sepLineas, lados: p.eje && p.eje.length >= 2 ? { izq: lado(p.izq), der: lado(p.der) } : null };
    const segRutaDji = distancia / v + Math.max(0, nLineas - 1) * p.segGiro + 20;
    const intervalo2 = sepFotos / v;
    const densidad = barrido ? d.lidar.puntosPorSegundo / (v * sepLineas) : null;
    const densidadPasada = barrido ? d.lidar.puntosPorSegundo / (v * barrido) : null;
    const avisos2 = [];
    if (v > d.velocidadMaxMs) avisos2.push(`La velocidad supera la máxima de misión del dron (${fmt(d.velocidadMaxMs, 1)} m/s).`);
    if ((p.modo === "foto" || p.fotosEnLidar) && v > velBarrido) avisos2.push(`A ${fmt(v, 1)} m/s la foto se arrastra más de medio píxel: baja a ${fmt(velBarrido, 1)} m/s o usa una exposición más corta.`);
    if ((p.modo === "foto" || p.fotosEnLidar) && intervalo2 < d.intervaloMinS) avisos2.push(`Habría que disparar cada ${fmt(intervalo2, 2)} s y la cámara necesita ${fmt(d.intervaloMinS, 1)} s: baja la velocidad a ${fmt(velIntervalo, 1)} m/s o el traslape frontal.`);
    if (p.altura > 120) avisos2.push("La altura supera los 120 m (400 ft): revisa la autorización DGAC.");
    if (minUtiles <= 0) avisos2.push("Con la reserva elegida no queda tiempo útil por batería: revisa autonomía y reserva.");
    if (baterias.some((b) => b.excede)) avisos2.push("Parte del recorrido queda más lejos de lo que alcanza una batería ida y vuelta desde el despegue: acerca el despegue o divide el área en sectores.");
    return {
      gsd,
      huellaAncho,
      huellaLargo,
      sepFotos,
      sepLineas,
      barrido,
      area: area2,
      rumbo: rumbo2,
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
      avisos: avisos2,
      baterias,
      trasladoM,
      corredor: !!pasadas && !girado,
      pasadasLocal: pasadas && !girado ? pasadas : null,
      detalle,
      minRutaDji: segRutaDji / 60
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

  // modulos/vuelos/cerrados.js
  var sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
  var cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
  var unit2 = (v) => {
    const l = Math.hypot(v[0], v[1]) || 1;
    return [v[0] / l, v[1] / l];
  };
  var area = (p) => Math.abs(areaFirmada(p));
  function rectanguloMinimo(poli) {
    const h = cascoConvexo(poli);
    if (h.length < 3) return 0;
    let mejor = Infinity;
    for (let i = 0; i < h.length; i++) {
      const d = unit2(sub2(h[(i + 1) % h.length], h[i])), n = [-d[1], d[0]];
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const p of h) {
        const x = p[0] * d[0] + p[1] * d[1], y = p[0] * n[0] + p[1] * n[1];
        if (x < a0) a0 = x;
        if (x > a1) a1 = x;
        if (y < b0) b0 = y;
        if (y > b1) b1 = y;
      }
      mejor = Math.min(mejor, (a1 - a0) * (b1 - b0));
    }
    return mejor;
  }
  var rectangularidad = (p) => {
    const r = rectanguloMinimo(p);
    return r > 0 ? Math.min(1, area(p) / r) : 0;
  };
  function simplificarAnillo(ring, tol) {
    if (ring.length < 5) return ring.slice();
    let k = 0, m = -1;
    ring.forEach((p, i) => {
      const d = dist(p, ring[0]);
      if (d > m) {
        m = d;
        k = i;
      }
    });
    const a = simplificar(ring.slice(0, k + 1), tol), b = simplificar([...ring.slice(k), ring[0]], tol);
    return [...a, ...b.slice(1, -1)];
  }
  function concavos(simple, minGiro) {
    const out = [];
    const n = simple.length;
    for (let i = 0; i < n; i++) {
      const a = simple[(i - 1 + n) % n], v = simple[i], b = simple[(i + 1) % n];
      const e1 = unit2(sub2(v, a)), e2 = unit2(sub2(b, v));
      const giro2 = Math.atan2(cross2(e1, e2), e1[0] * e2[0] + e1[1] * e2[1]) * 180 / Math.PI;
      if (giro2 < -minGiro) out.push({ v, dirs: [e1, unit2(sub2(v, b))] });
    }
    return out;
  }
  function rayo(ring, v, d, tMin) {
    let mejor = null;
    for (let e = 0; e < ring.length; e++) {
      const p = ring[e], q = ring[(e + 1) % ring.length];
      if (dist(p, v) < 1e-6 || dist(q, v) < 1e-6) continue;
      const s = sub2(q, p), den = cross2(d, s);
      if (Math.abs(den) < 1e-12) continue;
      const w = sub2(p, v), t = cross2(w, s) / den, u = cross2(w, d) / den;
      if (t > tMin && u >= -1e-9 && u <= 1 + 1e-9 && (!mejor || t < mejor.t)) mejor = { t, u: Math.max(0, Math.min(1, u)), borde: e, punto: [v[0] + d[0] * t, v[1] + d[1] * t] };
    }
    return mejor;
  }
  function cruzaBorde(ring, a, b) {
    const r = sub2(b, a);
    for (let e = 0; e < ring.length; e++) {
      const p = ring[e], q = ring[(e + 1) % ring.length], s = sub2(q, p), den = cross2(r, s);
      if (Math.abs(den) < 1e-12) continue;
      const w = sub2(p, a), t = cross2(w, s) / den, u = cross2(w, r) / den;
      if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6) return true;
    }
    return false;
  }
  function partir(ring, iV, hit) {
    const R = ring.slice();
    let iH;
    const p = R[hit.borde], q = R[(hit.borde + 1) % R.length];
    if (dist(hit.punto, p) < 0.05) iH = hit.borde;
    else if (dist(hit.punto, q) < 0.05) iH = (hit.borde + 1) % R.length;
    else {
      R.splice(hit.borde + 1, 0, hit.punto);
      iH = hit.borde + 1;
      if (iV > hit.borde) iV++;
    }
    const tramo = (i, j) => {
      const out = [R[i]];
      let k = i;
      while (k !== j) {
        k = (k + 1) % R.length;
        out.push(R[k]);
      }
      return out;
    };
    return [antihorario(tramo(iV, iH)), antihorario(tramo(iH, iV))];
  }
  function cortesCerrados(poli, { maxCortes = 12, minFrac = 0.06, mejoraMin = 0.015 } = {}) {
    const total = area(poli);
    if (!(total > 0)) return [];
    const tam = Math.sqrt(total);
    const tol = Math.max(2, tam * 0.01);
    let piezas = [antihorario(poli.slice())];
    const cortes = [];
    const puntaje = (p) => area(p) * rectangularidad(p);
    for (let paso = 0; paso < maxCortes; paso++) {
      let mejor = null;
      piezas.forEach((pz, ip) => {
        const base = puntaje(pz), aPz = area(pz);
        if (aPz < total * minFrac * 2) return;
        const simple = antihorario(simplificarAnillo(pz, tol));
        for (const c of concavos(simple, 12)) {
          const iV = pz.findIndex((p) => dist(p, c.v) < 1e-6);
          if (iV < 0) continue;
          for (const d of c.dirs) {
            const hit = rayo(pz, c.v, d, 0.5);
            if (!hit || hit.t < tam * 0.02) continue;
            const medio = [(c.v[0] + hit.punto[0]) / 2, (c.v[1] + hit.punto[1]) / 2];
            if (cruzaBorde(pz, c.v, hit.punto)) continue;
            const [A, B] = partir(pz, iV, hit);
            const aA = area(A), aB = area(B);
            if (aA < total * minFrac || aB < total * minFrac || Math.abs(aA + aB - aPz) > aPz * 0.01) continue;
            const gan = (puntaje(A) + puntaje(B) - base) / total;
            if (gan > mejoraMin && (!mejor || gan > mejor.gan)) mejor = { gan, ip, A, B, corte: [c.v, hit.punto], medio };
          }
        }
      });
      if (!mejor) break;
      piezas.splice(mejor.ip, 1, mejor.A, mejor.B);
      cortes.push(mejor.corte);
    }
    return cortes;
  }
  function prolongarCorte(corte, poli) {
    if (!corte || corte.length < 2) return corte;
    const signo = areaFirmada(poli) >= 0 ? 1 : -1;
    const normalExt = (a, b) => {
      const d = unit2(sub2(b, a));
      return [signo * d[1], -signo * d[0]];
    };
    function hacia(p, dirCorte) {
      let mejorD = Infinity, n = null;
      const N = poli.length;
      for (let i = 0; i < N; i++) {
        const a = poli[i], b = poli[(i + 1) % N];
        if (dist(p, a) < 0.3) {
          const pr = poli[(i - 1 + N) % N], n1 = normalExt(pr, a), n2 = normalExt(a, b);
          return unit2([n1[0] + n2[0], n1[1] + n2[1]]);
        }
        const ab = sub2(b, a), L2 = ab[0] * ab[0] + ab[1] * ab[1];
        const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L2)) : 0;
        const dd = dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t]);
        if (dd < mejorD) {
          mejorD = dd;
          n = normalExt(a, b);
        }
      }
      return mejorD < 0.3 ? n : dirCorte;
    }
    const ini = corte[0], fin = corte[corte.length - 1];
    const dIni = hacia(ini, unit2(sub2(ini, corte[1]))), dFin = hacia(fin, unit2(sub2(fin, corte[corte.length - 2])));
    return [[ini[0] + dIni[0] * 0.3, ini[1] + dIni[1] * 0.3], ...corte, [fin[0] + dFin[0] * 0.3, fin[1] + dFin[1] * 0.3]];
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
  var ZONAS_VUELO = [
    ["no_poblada", "Área no poblada · DAN 91"],
    ["poblada", "Área poblada · DAN 151"],
    ["especial", "Zona especial"]
  ];
  var DOCS_PERMISO = {
    comunes: [
      ["aoc", "Certificado AOC", true],
      ["registro", "Registro del RPA", false],
      ["licencia", "Licencia / credencial de operador", true],
      ["formulario", "Formulario de solicitud", false],
      ["kmz", "KMZ del polígono", false],
      ["lugar", "Permiso del lugar a volar", false],
      ["seguro", "Seguro de responsabilidad civil vigente", true],
      ["espacio", "Verificación del espacio aéreo (aeródromos y zonas)", false],
      ["faena", "Acreditación en faena del mandante (si aplica)", false],
      ["resolucion", "Respuesta o resolución de la DGAC", true]
    ],
    no_poblada: [["dan91", "Solicitud al Subdepartamento de Operaciones (SDO) · Formulario DAN 91 Anexo D", false]],
    poblada: [
      ["apendiceA", "Autorización Apéndice A DAN 151 vigente", true],
      ["carta151", "Carta tipo de solicitud (DAN 151 · interés público)", false],
      ["carpeta", "Carpeta operativa: credencial de operador, tarjeta de registro del RPA y resolución del seguro aprobado por la JAC", false]
    ],
    especial: [
      ["permisoInst", "Permiso escrito de la institución o administración del lugar", false],
      ["aprobDgac", "Aprobación formal de la DGAC", true]
    ]
  };
  var ESTADOS_DOC = [["falta", "Falta"], ["tramite", "En trámite"], ["adjunto", "Listo / adjunto"], ["no_aplica", "No aplica"]];
  var DOC_ANTIGUO = { kmz: "kmz", carta: "lugar", seguro: "seguro", credencial: "licencia", inscripcion: "registro" };
  function documentosPermiso(h) {
    const p = h.permisos || {}, zona = p.zona || "no_poblada", est2 = p.docsEstado || {};
    const tieneArea = !!(h.area && (h.area.original || h.area.eje));
    return [...DOCS_PERMISO.comunes, ...DOCS_PERMISO[zona] || []].map(([k, t, vence]) => {
      const e = est2[k] || {};
      let estado3 = e.estado;
      if (!estado3) estado3 = k === "kmz" && tieneArea || Object.entries(DOC_ANTIGUO).some(([a, n]) => n === k && (p.docs || {})[a]) ? "adjunto" : "falta";
      return { k, t, vence, estado: estado3, fechaVence: e.vence || "", archivoId: e.archivoId || null, listo: estado3 === "adjunto" || estado3 === "no_aplica" };
    });
  }
  var CONSULTAS = [
    ["notam", "NOTAM en AIP Chile", "https://aipchile.dgac.gob.cl/notam"],
    ["aip", "Mapa interactivo AIP Chile", "https://aipchile.dgac.gob.cl/"],
    ["uas", "UAS Control: zonas y «Verificar conformidad» del área", "https://uascontrol.io/"]
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
      permisos: { dgac: { preparado: "", enviado: "", aprobado: "", vence: "", numero: "" }, docs: {}, consultas: [], zona: "no_poblada", docsEstado: {}, logs: [] },
      mandante: "",
      jefe: "",
      ubicacion: null,
      procesado: false,
      viento: []
    };
  }
  function migrarHoja(p) {
    if (p.area) {
      const h2 = nuevaHoja();
      return { ...h2, ...p, params: { ...PARAMS_INICIALES, ...p.params }, area: { ...h2.area, ...p.area, corredor: { ...h2.area.corredor, ...p.area.corredor || {} } }, permisos: { ...h2.permisos, ...p.permisos || {}, dgac: { ...h2.permisos.dgac, ...(p.permisos || {}).dgac || {} } } };
    }
    const h = nuevaHoja({ proyectoId: p.proyectoId, dronId: p.dronId || "m4e" });
    const { despegue = null, rumbo: rumbo2 = "", dronId, areaHa, ...params } = p.params || {};
    return {
      ...h,
      id: p.id,
      nombre: p.nombre || "",
      creadoEn: p.creadoEn,
      creadoPor: p.creadoPor,
      dronId: p.dronId || dronId || "m4e",
      params: { ...PARAMS_INICIALES, ...params },
      area: { ...h.area, tipo: p.poligono ? "poligono" : null, original: p.poligono ? { nombre: p.poligono.nombre, anillo: p.poligono.anillo } : null, archivo: p.poligono ? "guardado en el plan" : "", sectores: [{ despegue, rumbo: rumbo2 }], areaHa: areaHa || "" }
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
    const clave2 = JSON.stringify([a.tipo, fuente, a.margen, a.rectas, a.corredor, a.cortes, a.dm, a.ejeCalc ? a.ejeCalc.linea : null]);
    if (cacheGeo.clave === clave2) return cacheGeo.valor;
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
      const ejeOrig = fuente.map(marco.aXY), Lo = largo(ejeOrig);
      for (const s of sectores) s.rango = [distanciaEnEje(ejeOrig, s.eje[0]), distanciaEnEje(ejeOrig, s.eje[s.eje.length - 1])].sort((x, y) => x - y);
      if (a.dm && a.dm.inicio != null) for (const s of sectores) s.dm = s.rango.map((x) => kmEnEje(a, x, Lo)).sort((x, y) => x - y);
      if (a.dm && a.dm.inv) sectores.sort((x, y) => y.rango[0] + y.rango[1] - (x.rango[0] + x.rango[1]));
      valor = { marco, tipo: "corredor", eje, izq, der, vuelo: poligonoCorredor(eje, izq, der), original: null, sectores, fallidos: cortes.length && tramos.length < cortes.length + 1 ? ["algún corte no cruza el eje"] : [] };
    } else {
      const original = fuente.map(marco.aXY);
      const vuelo = Number(a.margen) > 0 ? margenPoligono(original, Number(a.margen), { rectas: a.rectas !== false }) : original;
      const { sectores, fallidos } = aplicarCortes(vuelo, cortes.map((c) => prolongarCorte(c, vuelo)));
      let secs = sectores.map((p) => ({ poligono: p, area: areaM2(p) }));
      if (a.ejeCalc && a.ejeCalc.linea && secs.length > 1) {
        const ejeXY = a.ejeCalc.linea.map(marco.aXY), Le = largo(ejeXY);
        for (const sec of secs) {
          const pts = sec.poligono, paso = Math.max(1, Math.ceil(pts.length / 300));
          let mn = Infinity, mx = -Infinity;
          for (let i = 0; i < pts.length; i += paso) {
            const d = distanciaEnEje(ejeXY, pts[i]);
            if (d < mn) mn = d;
            if (d > mx) mx = d;
          }
          sec.rango = [mn, mx];
          if (a.dm && a.dm.inicio != null) sec.dm = [kmEnEje(a, mn, Le), kmEnEje(a, mx, Le)].sort((x, y) => x - y);
        }
        const signo = a.dm && a.dm.inv ? -1 : 1;
        secs.sort((x, y) => signo * (x.rango[0] + x.rango[1] - (y.rango[0] + y.rango[1])));
      }
      valor = { marco, tipo: "poligono", original, vuelo, sectores: secs, fallidos };
    }
    valor.areaVuelo = areaM2(valor.vuelo);
    cacheGeo = { clave: clave2, valor };
    return valor;
  }
  function ladosSector(geo, i, max = 8) {
    const sec = geo && geo.sectores[i];
    if (!sec || geo.tipo === "corredor") return [];
    const pl = sec.poligono, xs = pl.map((p) => p[0]), ys = pl.map((p) => p[1]);
    const tam = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const simple = simplificar([...pl, pl[0]], Math.max(1, tam * 0.015)).slice(0, -1);
    const lados = [];
    for (let k = 0; k < simple.length; k++) {
      const a = simple[k], b = simple[(k + 1) % simple.length], largo2 = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (largo2 < tam * 0.08) continue;
      const ang = Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI;
      const medio = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const comun = geo.sectores.map((o, j) => j).filter((j) => j !== i && (() => {
        const q = geo.sectores[j].poligono;
        for (let e = 0; e < q.length; e++) if (distPuntoSegmento(medio, q[e], q[(e + 1) % q.length]) < 1) return true;
        return false;
      })());
      lados.push({ a, b, medio, largo: largo2, rumbo: Math.round((ang % 180 + 180) % 180), comun });
    }
    return lados.sort((x, y) => y.largo - x.largo).slice(0, max).map((l, k) => ({ ...l, n: k + 1 }));
  }
  function metaSector(hoja2, i) {
    const s = hoja2.area.sectores;
    while (s.length <= i) s.push({ despegue: null, rumbo: "", nombre: "" });
    return s[i];
  }
  function nombreSector(hoja2, i, total) {
    const m = hoja2.area.sectores[i];
    if (m && m.nombre) return m.nombre;
    const g = hoja2.area.dm ? geometria(hoja2) : null;
    const s = g && g.sectores[i];
    if (s && s.dm && total > 1) return `${kmADm(s.dm[0])} – ${kmADm(s.dm[1])}`;
    return total > 1 ? `S${i + 1}` : "Área completa";
  }
  var desdeInicio = (a, s, L) => a.dm && a.dm.inv ? L - s : s;
  function kmEnEje(a, s, L) {
    const dm = a.dm || {}, ini = dm.inicio != null ? dm.inicio : 0, x = desdeInicio(a, s, L) / 1e3;
    return dm.desc ? ini - x : ini + x;
  }
  function sDeKm(a, km, L) {
    const dm = a.dm || {}, ini = dm.inicio != null ? dm.inicio : 0;
    return desdeInicio(a, (dm.desc ? ini - km : km - ini) * 1e3, L);
  }
  function lineaEje(a) {
    return a.tipo === "corredor" ? a.eje && a.eje.linea : a.ejeCalc && a.ejeCalc.linea || null;
  }
  function dmAKm(t) {
    const m = /^\s*(\d+)\s*\+\s*(\d{1,3})(?:[.,](\d+))?\s*$/.exec(String(t));
    if (m) return Number(m[1]) + Number(m[2].padEnd(3, "0")) / 1e3;
    const n = Number(String(t).replace(",", "."));
    return isFinite(n) && String(t).trim() !== "" ? n : null;
  }
  function kmADm(x) {
    const k = Math.floor(x + 1e-9);
    return `${k}+${String(Math.round((x - k) * 1e3)).padStart(3, "0")}`;
  }
  function distanciasCorte(L, op) {
    const out = [];
    const aS = (km) => (op.desc ? op.dmInicio - km : km - op.dmInicio) * 1e3;
    if (op.modo === "inicio") {
      const c = Number(op.cada);
      if (c > 10) for (let s = c; s < L; s += c) out.push(s);
    } else if (op.modo === "dm") {
      const c = Number(op.cada);
      if (!(c > 10) || op.dmInicio == null) return out;
      const ref = op.primerDM != null ? op.primerDM : 0;
      const kmFin = op.desc ? op.dmInicio - L / 1e3 : op.dmInicio + L / 1e3;
      const [a, b] = [op.dmInicio, kmFin].sort((x, y) => x - y);
      const paso = c / 1e3;
      for (let k = ref + Math.ceil((a - ref) / paso) * paso; k <= b + 1e-9; k += paso) out.push(aS(k));
    } else if (op.modo === "tramos" && op.dmInicio != null) out.push(...(op.tramosKm || []).map(aS));
    return [...new Set(out.map((s) => Math.round(s * 10) / 10))].filter((s) => s > 1 && s < L - 1).sort((x, y) => x - y);
  }
  function distanciasPorBaterias(hoja2, d, n, ejeDado = null) {
    const a = hoja2.area;
    let eje, izq, der;
    if (ejeDado) ({ eje, izq, der } = ejeDado);
    else {
      const marco = marcoDe(a.eje.linea);
      eje = a.eje.linea.map(marco.aXY);
      izq = Number(a.corredor.izq) || 0;
      der = a.corredor.mismo ? izq : Number(a.corredor.der) || 0;
    }
    const L = largo(eje);
    const pedazo = (s02, s1) => {
      const pts = [puntoEnEje(eje, s02).p];
      let acum = 0;
      for (let i = 0; i + 1 < eje.length; i++) {
        acum += Math.hypot(eje[i + 1][0] - eje[i][0], eje[i + 1][1] - eje[i][1]);
        if (acum > s02 && acum < s1) pts.push(eje[i + 1]);
      }
      pts.push(puntoEnEje(eje, s1).p);
      return pts;
    };
    const baterias = (s02, s1) => {
      const sub3 = pedazo(s02, s1), medio = puntoEnEje(eje, (s02 + s1) / 2).p;
      const b = baseCalculo(hoja2, d, { eje: sub3, izq, der, despegue: medio });
      const v = Number(hoja2.params.velocidad) || Math.floor(calcularPlan({ ...b, velocidad: 10 }).velSugerida * 10) / 10;
      return calcularPlan({ ...b, velocidad: v }).vuelos;
    };
    const out = [];
    let s0 = 0;
    while (L - s0 > 1 && out.length < 200) {
      if (baterias(s0, L) <= n) break;
      let lo = s0 + 20, hi = L;
      if (baterias(s0, lo) > n) {
        out.push(lo);
        s0 = lo;
        continue;
      }
      while (hi - lo > 25) {
        const m = (lo + hi) / 2;
        if (baterias(s0, m) <= n) lo = m;
        else hi = m;
      }
      out.push(Math.round(lo));
      s0 = lo;
    }
    return out;
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
    const despegue = extra.despegue || (meta.despegue ? geo.marco.aXY(meta.despegue) : centroide(sec.poligono));
    const b = baseCalculo(hoja2, d, { ...geomSector, despegue, ...extra });
    const P = hoja2.params;
    if (extra.velocidad) return { ...calcularPlan(b), velocidad: extra.velocidad, despegueXY: despegue, altura: b.altura, modo: b.modo };
    const previo = calcularPlan({ ...b, velocidad: 10 });
    const sugerida = Math.floor(previo.velSugerida * 10) / 10;
    const velocidad = Number(P.velocidad) || sugerida;
    return { ...calcularPlan({ ...b, velocidad }), velocidad, sugerida, auto: !Number(P.velocidad), despegueXY: despegue, modo: b.modo, altura: b.altura };
  }
  function rumboMasCorto(hoja2, d, geo, i, velocidad) {
    const prueba = (r) => calcularSector(hoja2, d, geo, i, { rumbo: r, velocidad }).minTotal;
    let mejor = 0, minimo = Infinity;
    for (let r = 0; r < 180; r += 5) {
      const m = prueba(r);
      if (m < minimo - 1e-6) {
        minimo = m;
        mejor = r;
      }
    }
    for (let r = mejor - 4; r <= mejor + 4; r++) {
      const rr = (r + 180) % 180;
      const m = prueba(rr);
      if (m < minimo - 1e-6) {
        minimo = m;
        mejor = rr;
      }
    }
    return { rumbo: mejor, minTotal: minimo };
  }
  var memoDespegue = /* @__PURE__ */ new Map();
  function opcionesDespegue(hoja2, d, geo, i) {
    const sec0 = geo.sectores[i];
    if (!sec0) return [];
    const { despegue, ...meta } = metaSector(hoja2, i);
    const clave2 = JSON.stringify([hoja2.id, i, d, hoja2.params, meta, sec0.area, sec0.poligono.length, sec0.poligono[0], sec0.poligono[1]]);
    if (memoDespegue.has(clave2)) return memoDespegue.get(clave2);
    const res = opcionesDespegueSinMemo(hoja2, d, geo, i);
    if (memoDespegue.size > 60) memoDespegue.clear();
    memoDespegue.set(clave2, res);
    return res;
  }
  function opcionesDespegueSinMemo(hoja2, d, geo, i) {
    const sec = geo.sectores[i];
    const r = calcularSector(hoja2, d, geo, i, { despegue: centroide(sec.poligono) });
    if (!r || !r.baterias || !r.baterias.length) return [];
    const bs = r.baterias;
    const cand = [{ k: "inicio", texto: "Inicio de las líneas (primera pasada)", xy: bs[0].inicio }];
    bs.slice(0, -1).forEach((b, k) => cand.push({ k: `cambio${k + 1}`, texto: `Cambio de batería ${k + 1} → ${k + 2}`, xy: b.fin }));
    cand.push({ k: "final", texto: "Final de las líneas (última pasada)", xy: bs[bs.length - 1].fin });
    cand.push({ k: "centro", texto: "Centro del sector", xy: centroide(sec.poligono) });
    const out = cand.filter((c) => c.xy && isFinite(c.xy[0])).map((c) => ({ ...c, lonLat: geo.marco.aLonLat(c.xy), minTotal: calcularSector(hoja2, d, geo, i, { despegue: c.xy }).minTotal }));
    const min = Math.min(...out.map((o) => o.minTotal));
    return out.map((o) => ({ ...o, mejor: o.minTotal <= min + 1e-6 }));
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
  var ETAPAS_VUELO = [
    ["planificacion", "Planificación", "gris"],
    ["permisos", "Permisos", "ambar"],
    ["programado", "Programado", "azul"],
    ["volado", "Volado", "verde"],
    ["log", "Log cargado", "verde"],
    ["procesado", "Procesado", "gris"]
  ];
  var NOMBRE_ETAPA_VUELO = Object.fromEntries(ETAPAS_VUELO.map(([k, t]) => [k, t]));
  function etapaVuelo(h) {
    const logs = h.permisos && h.permisos.logs || [];
    if (h.procesado) return "procesado";
    if (h.estado === "volada") return logs.length ? "log" : "volado";
    if (h.estado === "lista") return "programado";
    const conArea = !!(h.resumen || h.area && (h.area.original || h.area.eje));
    return conArea ? "permisos" : "planificacion";
  }
  function resumenHoja(hoja2, d, geo) {
    const t = totales(hoja2, d, geo);
    if (!t) return null;
    const largoLineal = geo.tipo === "corredor" ? geo.sectores.reduce((s, x) => s + (x.largo || 0), 0) : hoja2.area.ejeCalc && hoja2.area.ejeCalc.linea ? hoja2.area.ejeCalc.largo : 0;
    const [lon, lat] = geo.marco.aLonLat([0, 0]);
    return { area: geo.areaVuelo, gsd: hoja2.params.modo === "lidar" ? null : t.gsd, altura: t.altura, vuelos: t.baterias, minTotal: t.minJornada, fotos: t.fotos, sectores: geo.sectores.length, corredor: geo.tipo === "corredor", modo: hoja2.params.modo, densidad: t.sectores[0] ? t.sectores[0].densidad : null, largo: largoLineal || 0, centro: [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] };
  }
  var HORARIO_INICIAL = { inicio: "08:30", fin: "17:30", pausa: 60, traslado: 0 };
  var aMin = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  function minutosUtiles(horario) {
    const h = { ...HORARIO_INICIAL, ...horario || {} };
    const a = aMin(h.inicio), b = aMin(h.fin);
    return a == null || b == null || b <= a ? 0 : Math.max(0, b - a - (Number(h.pausa) || 0));
  }
  function jornadasNecesarias(hoja2, d, g, t = null) {
    if (!g || !d) return null;
    const tot = t || totales(hoja2, d, g);
    if (!tot) return null;
    const h = { ...HORARIO_INICIAL, ...hoja2.params.horario || {} };
    const util = minutosUtiles(h), traslado = Number(h.traslado) || 0;
    if (!util) return { util: 0, dias: [] };
    const dias = [];
    let dia = null;
    tot.sectores.forEach((r, i) => {
      if (!r) return;
      const costo = r.minTotal + (dia && dia.sectores.length ? traslado : 0);
      if (!dia || dia.sectores.length && dia.min + costo > util) {
        dia = { sectores: [], min: 0, baterias: 0, excede: false };
        dias.push(dia);
      }
      dia.min += dia.sectores.length ? costo : r.minTotal;
      dia.baterias += r.vuelos;
      dia.sectores.push(i);
      if (dia.min > util) dia.excede = true;
    });
    return { util, dias };
  }

  // modulos/vuelos/kml.js
  async function leerArchivo(archivo) {
    const buf = new Uint8Array(await archivo.arrayBuffer());
    const esZip = buf[0] === 80 && buf[1] === 75;
    if (!esZip) return new TextDecoder("utf-8").decode(buf);
    return extraerKmlDeZip(buf);
  }
  async function extraerKmlDeZip(buf) {
    const entradas = leerZip(buf);
    const kml = entradas.find((e) => /(^|\/)doc\.kml$/i.test(e.nombre)) || entradas.find((e) => /\.kml$/i.test(e.nombre));
    if (!kml) throw new Error("El KMZ no trae ningún archivo .kml adentro.");
    return new TextDecoder("utf-8").decode(await kml.datos());
  }
  function leerZip(buf) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let fin = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 101010256) {
      fin = i;
      break;
    }
    if (fin < 0) throw new Error("El archivo comprimido está dañado: no se encontró el índice del zip.");
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
      entradas.push({ nombre, datos: async () => {
        const ini = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
        const datos = buf.subarray(ini, ini + comprimido);
        if (metodo === 0) return datos;
        if (metodo !== 8) throw new Error("El zip usa una compresión que no reconozco.");
        if (typeof DecompressionStream === "undefined") throw new Error("Este navegador no puede abrir archivos comprimidos. Actualiza Chrome o descomprime el archivo.");
        const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return new Uint8Array(await new Response(flujo).arrayBuffer());
      } });
      p += 46 + largoNombre + largoExtra + largoComent;
    }
    return entradas;
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
        const indice2 = await r.json();
        for (const c of indice2.capas || []) {
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
  function revisarZonas(area2, marco, capas, activas) {
    const A = area2.map(marco.aXY);
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

  // modulos/seguimiento/datos.js
  var SCHEMA_VERSION3 = 1;
  var ALM4 = { planes: "seguimiento_planes", ciclos: "seguimiento_ciclos", eventos: "seguimiento_eventos", entregas: "seguimiento_entregas" };
  var persona2 = null;
  function iniciarDatos3({ personaId = null } = {}) {
    registrarAlmacenes([
      { nombre: ALM4.planes, indices: [["proyectoId", "proyectoId"]] },
      { nombre: ALM4.ciclos, indices: [["planId", "planId"]] },
      { nombre: ALM4.eventos, indices: [["cicloId", "cicloId"]] },
      { nombre: ALM4.entregas, indices: [["cicloId", "cicloId"]] }
    ]);
    persona2 = personaId;
  }
  function fijarPersona3(p) {
    persona2 = p;
  }
  var nuevoId = () => uuid();
  var sello3 = (r) => sellar(r, { personaId: persona2, schemaVersion: SCHEMA_VERSION3 });
  var vivo3 = (r) => !r.eliminadoEn;
  var recientes = (a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || "");
  async function listarPlanes2() {
    return (await todos(ALM4.planes)).filter(vivo3);
  }
  async function planDeProyecto(proyectoId) {
    return (await porIndice(ALM4.planes, "proyectoId", proyectoId)).filter(vivo3)[0] || null;
  }
  async function guardarPlan2(plan) {
    return guardar(ALM4.planes, sello3({ ...plan }));
  }
  async function eliminarPlan2(id) {
    return enviarAPapelera(ALM4.planes, id, { personaId: persona2 });
  }
  async function ciclosDePlan(planId) {
    return (await porIndice(ALM4.ciclos, "planId", planId)).filter(vivo3).sort(recientes);
  }
  async function guardarCiclo(ciclo) {
    return guardar(ALM4.ciclos, sello3({ ...ciclo }));
  }
  async function eventosDeCiclo(cicloId) {
    return (await porIndice(ALM4.eventos, "cicloId", cicloId)).filter(vivo3);
  }
  async function agregarEventos(eventos) {
    const ahora = (/* @__PURE__ */ new Date()).toISOString();
    await guardarVarios(eventos.map((e) => ({ almacen: ALM4.eventos, registro: sello3({ ...e, creadoEn: ahora }) })));
  }
  async function entregasDeCiclo(cicloId) {
    return (await porIndice(ALM4.entregas, "cicloId", cicloId)).filter(vivo3).sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
  }
  async function guardarEntrega(entrega) {
    return guardar(ALM4.entregas, sello3({ ...entrega }));
  }

  // modulos/seguimiento/modelo.js
  var SIGUIENTE = { falta: "proc", proc: "listo", listo: "falta" };
  var TEXTO_ESTADO = { falta: "falta", proc: "en proceso", listo: "listo" };
  var MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  var COLS_VUELO = () => [
    { id: "terreno", tipo: "terreno", nombre: "Terreno", ancho: 128, visible: true },
    { id: "np", tipo: "producto", nombre: "NP", ext: ".laz", ancho: 60, visible: true },
    { id: "mds", tipo: "producto", nombre: "MDS", ext: ".asc", ancho: 60, visible: true },
    { id: "of", tipo: "producto", nombre: "OF", ext: ".ecw", ancho: 60, visible: true },
    { id: "kmz", tipo: "producto", nombre: "KMZ", ext: ".kmz", ancho: 60, visible: true },
    { id: "entrega", tipo: "entrega", nombre: "Entrega", ancho: 116, visible: true }
  ];
  function dmAKm2(t) {
    const m = /(\d+)\s*\+\s*(\d{1,3})/.exec(String(t));
    return m ? Number(m[1]) + Number(m[2].padEnd(3, "0")) / 1e3 : null;
  }
  function kmADm2(x) {
    const k = Math.floor(x + 1e-9);
    return `${k}+${String(Math.round((x - k) * 1e3)).padStart(3, "0")}`;
  }
  function tramosDesdeCarpetas(texto3, nuevoId2) {
    const lineas = String(texto3).split(/\r?\n/).map((l) => l.trim().replace(/^"|"$/g, "").replace(/[\\/]+$/, "")).filter(Boolean);
    const vistos = /* @__PURE__ */ new Set(), out = [];
    lineas.forEach((l, i) => {
      const carpeta = l.split(/[\\/]/).pop().trim();
      if (!carpeta || vistos.has(carpeta)) return;
      vistos.add(carpeta);
      const m = /^(\d{1,4})[_\s.-]+(.+)$/.exec(carpeta);
      const n = m ? m[1].padStart(3, "0") : String(i + 1).padStart(3, "0");
      const resto = m ? m[2].trim() : carpeta;
      const dms = resto.split(/\s+-\s+|\s+–\s+/).map(dmAKm2);
      let nombre = resto, ini = null, fin = null;
      if (dms.length === 2 && dms[0] != null && dms[1] != null) {
        ini = Math.min(...dms);
        fin = Math.max(...dms);
        nombre = `${kmADm2(ini)} – ${kmADm2(fin)}`;
      }
      out.push({ id: nuevoId2(), n, nombre, carpeta, ini, fin });
    });
    return out.sort((a, b) => a.n.localeCompare(b.n, "es", { numeric: true }));
  }
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
  var productos = (plan) => plan.cols.filter((c) => c.tipo === "producto");
  var estadoProd = (t, c) => t.prod[c.id] || "falta";
  var volado = (t) => !!t.terreno;
  var todoListo = (plan, t) => volado(t) && productos(plan).every((c) => estadoProd(t, c) === "listo");
  function gabinete(plan, t) {
    if (!volado(t)) return "na";
    if (t.entrega) return "ok";
    const es = productos(plan).map((c) => estadoProd(t, c));
    if (es.every((e) => e === "falta")) return "falta";
    return es.every((e) => e === "listo") ? "listo" : "proc";
  }
  function cuenta(plan, est2, tramos) {
    const c = { sinvolar: 0, falta: 0, proc: 0, listo: 0, ok: 0, total: tramos.length, productos: 0, productosListos: 0 };
    const P = productos(plan);
    for (const tr of tramos) {
      const t = estadoDe(est2, tr.id), g = gabinete(plan, t);
      if (g === "na") c.sinvolar++;
      else c[g]++;
      c.productos += P.length;
      c.productosListos += P.filter((col) => volado(t) && estadoProd(t, col) === "listo").length;
    }
    return c;
  }
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
  var aFecha = (iso) => /* @__PURE__ */ new Date(iso + "T12:00:00");
  var aISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function sumarHabiles(iso, n) {
    const d = aFecha(iso);
    let k = 0;
    while (k < n) {
      d.setDate(d.getDate() + 1);
      const w = d.getDay();
      if (w && w !== 6) k++;
    }
    return aISO(d);
  }
  function habilesEntre(a, b) {
    if (a === b) return 0;
    const s = a < b ? 1 : -1, d = aFecha(s > 0 ? a : b), f = aFecha(s > 0 ? b : a);
    let n = 0;
    while (d < f) {
      d.setDate(d.getDate() + 1);
      const w = d.getDay();
      if (w && w !== 6) n++;
    }
    return n * s;
  }
  function plazoCiclo(plan, ciclo, hoy) {
    const p = plan.plazo || { tipo: "ninguno" };
    if (ciclo && ciclo.entrega) return { vence: ciclo.entrega, quedan: habilesEntre(hoy, ciclo.entrega) };
    if (!ciclo || !ciclo.datos || p.tipo === "ninguno") return null;
    let vence;
    if (p.tipo === "habiles") vence = sumarHabiles(ciclo.datos, Math.max(1, Number(p.dias) || 1));
    else {
      const d = aFecha(ciclo.datos);
      d.setMonth(d.getMonth() + 1);
      vence = aISO(d);
    }
    return { vence, quedan: habilesEntre(hoy, vence) };
  }
  function mesSiguiente(nombre, n) {
    const m = /^(\p{L}+)\s+(\d{4})$/u.exec(String(nombre || "").trim());
    const k = m ? MESES.findIndex((x) => x.toLowerCase() === m[1].toLowerCase()) : -1;
    if (k < 0) return { nombre: "", mesContrato: (Number(n) || 0) + 1 };
    const y = Number(m[2]) + (k === 11 ? 1 : 0);
    return { nombre: `${MESES[(k + 1) % 12]} ${y}`, mesContrato: (Number(n) || 0) + 1 };
  }
  var nombreMes = (fecha2) => {
    const d = aFecha(fecha2);
    return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
  };
  var carpetaMes = (ciclo) => ciclo && ciclo.mesContrato ? `${String(ciclo.mesContrato).padStart(3, "0")} ${(ciclo.nombre || "").split(" ")[0]}`.trim() : "";
  var norm = (s) => String(s || "").normalize("NFC").trim().toLowerCase();
  function revisarArchivos(plan, est2, rutas) {
    const P = productos(plan).filter((c) => c.ext);
    const partes = rutas.map((r) => String(r).split(/[\\/]/).map(norm));
    const cambios = [], noEstan = [], encontrados = [];
    for (const area2 of plan.areas) {
      for (const tr of area2.tramos) {
        if (!tr.carpeta) continue;
        const c = norm(tr.carpeta), ca = norm(area2.carpeta);
        let deTramo = partes.filter((p) => p.slice(0, -1).includes(c));
        if (ca && deTramo.some((p) => p.includes(ca))) deTramo = deTramo.filter((p) => p.includes(ca));
        const t = estadoDe(est2, tr.id);
        for (const col of P) {
          const hay = deTramo.some((p) => p[p.length - 1].endsWith(norm(col.ext)));
          if (hay) {
            encontrados.push({ tramoId: tr.id, col: col.id });
            if (estadoProd(t, col) !== "listo") cambios.push({ tramoId: tr.id, tipo: "prod", col: col.id, valor: "listo" });
          } else if (volado(t) && estadoProd(t, col) === "listo") noEstan.push({ tramo: tr, col });
        }
        if (deTramo.length && !volado(t) && P.some((col) => deTramo.some((p) => p[p.length - 1].endsWith(norm(col.ext))))) cambios.unshift({ tramoId: tr.id, tipo: "terreno", valor: "si", por: "" });
      }
    }
    return { cambios, noEstan, encontrados: encontrados.length };
  }
  function ejemploSaddn(nuevoId2) {
    const nombres = ["000_Muelle + Farellón", "001_10+200 - 4+900", "002_15+200 - 10+200", "003_20+200 - 15+200", "004_25+200 - 21+600"];
    for (let n = 5; n <= 31; n++) {
      const a = 25.2 + (n - 5) * 5;
      nombres.push(`${String(n).padStart(3, "0")}_${kmADm2(n === 31 ? 160 : a + 5)} - ${kmADm2(a)}`);
    }
    return {
      tipo: "mensual",
      plazo: { tipo: "habiles", dias: 10 },
      cols: COLS_VUELO(),
      areas: [
        { id: nuevoId2(), nombre: "01 Línea de impulsión", carpeta: "01 Línea de impulsión 4+900 - 160+000", tramos: tramosDesdeCarpetas(nombres.join("\n"), nuevoId2) },
        { id: nuevoId2(), nombre: "03 Distribución DCH", carpeta: "03 Distribución DCH", tramos: [{ id: nuevoId2(), n: "001", nombre: "Distribución DCH", carpeta: "03 Distribución DCH" }] },
        { id: nuevoId2(), nombre: "04 Reservorio", carpeta: "04 Reservorio", tramos: [{ id: nuevoId2(), n: "001", nombre: "Reservorio", carpeta: "04 Reservorio" }] }
      ]
    };
  }

  // compartido/periodicidad.js
  var MESES2 = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  var SEMANAS = [["primera", "primera semana"], ["segunda", "segunda semana"], ["tercera", "tercera semana"], ["cuarta", "cuarta semana"], ["ultima", "última semana completa"]];
  var DATOS = [["lunes", "el lunes siguiente"], ["siguiente", "el día hábil siguiente"], ["mismo", "el último día de terreno"]];
  var BASE_RECURRENTE = { tipo: "recurrente", cada: 1, unidad: "mes", semana: "ultima", desde: "", mesInicial: 1, diasTerreno: 4, datos: "lunes", diasEntrega: 5, hasta: "" };
  var aFecha2 = (iso) => {
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12);
  };
  var aISO2 = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
  var habil = (f) => f.getDay() !== 0 && f.getDay() !== 6;
  function sumarDias(iso, n) {
    const f = aFecha2(iso);
    f.setDate(f.getDate() + n);
    return aISO2(f);
  }
  function sumarHabiles2(iso, n) {
    const f = aFecha2(iso);
    let k = 0;
    while (k < n) {
      f.setDate(f.getDate() + 1);
      if (habil(f)) k++;
    }
    return aISO2(f);
  }
  function restarHabiles(iso, n) {
    const f = aFecha2(iso);
    let k = 0;
    while (k < n) {
      f.setDate(f.getDate() - 1);
      if (habil(f)) k++;
    }
    return aISO2(f);
  }
  function diasHabilesDesde(iso, n) {
    const out = [], f = aFecha2(iso);
    while (!habil(f)) f.setDate(f.getDate() + 1);
    while (out.length < n) {
      if (habil(f)) out.push(aISO2(f));
      f.setDate(f.getDate() + 1);
    }
    return out;
  }
  var nombreMes2 = (y, m) => `${MESES2[m]} ${y}`;
  function lunesDelMes(y, m, semana, diasTerreno = 4) {
    const lunes = [];
    for (let d = 1; d <= 31; d++) {
      const f = new Date(y, m, d, 12);
      if (f.getMonth() !== m) break;
      if (f.getDay() === 1) lunes.push(f);
    }
    const k = { primera: 0, segunda: 1, tercera: 2, cuarta: 3 }[semana];
    if (k != null) return aISO2(lunes[Math.min(k, lunes.length - 1)]);
    for (let i = lunes.length - 1; i >= 0; i--) {
      const dias = diasHabilesDesde(aISO2(lunes[i]), Math.max(1, diasTerreno));
      if (aFecha2(dias[dias.length - 1]).getMonth() === m) return aISO2(lunes[i]);
    }
    return aISO2(lunes[0]);
  }
  function fechasDelCiclo(p, inicio2) {
    const terreno = diasHabilesDesde(inicio2, Math.max(1, Number(p.diasTerreno) || 1));
    const fin = terreno[terreno.length - 1];
    const datos = p.datos === "mismo" ? fin : p.datos === "siguiente" ? sumarHabiles2(fin, 1) : (() => {
      const f = aFecha2(fin);
      do {
        f.setDate(f.getDate() + 1);
      } while (f.getDay() !== 1);
      return aISO2(f);
    })();
    return { terreno: [terreno[0], fin], diasTerreno: terreno, datos, entrega: sumarHabiles2(datos, Math.max(0, Number(p.diasEntrega) || 0)) };
  }
  function ciclosEntre(per, desde, hasta) {
    const p = { ...BASE_RECURRENTE, ...per || {} };
    if (p.tipo !== "recurrente" || !p.desde) return [];
    const cada = Math.max(1, Number(p.cada) || 1), out = [];
    for (let k = 0; k < 600; k++) {
      let inicio2, nombre;
      if (p.unidad === "semana") {
        const f = aFecha2(p.desde);
        while (f.getDay() !== 1) f.setDate(f.getDate() - 1);
        f.setDate(f.getDate() + 7 * cada * k);
        inicio2 = aISO2(f);
        nombre = `Semana del ${f.getDate()} de ${MESES2[f.getMonth()].toLowerCase()}`;
      } else {
        const [y0, m0] = p.desde.split("-").map(Number), t = m0 - 1 + cada * k, y = y0 + Math.floor(t / 12), m = t % 12;
        inicio2 = lunesDelMes(y, m, p.semana, p.diasTerreno);
        nombre = nombreMes2(y, m);
      }
      if (p.hasta && inicio2 > p.hasta) break;
      const c = fechasDelCiclo(p, inicio2);
      if (c.terreno[0] > hasta) break;
      const n = (Number(p.mesInicial) || 1) + k, numero = String(n).padStart(3, "0");
      if (c.entrega >= desde) out.push({ n, numero, nombre, carpeta: `${numero} ${nombre.split(" ")[0]}`, ...c });
    }
    return out;
  }
  function cicloDelMes(per, iso) {
    const d = aFecha2(iso), ini = aISO2(new Date(d.getFullYear(), d.getMonth(), 1, 12)), fin = aISO2(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
    return ciclosEntre(per, ini, sumarDias(fin, 60)).find((c) => c.terreno[0] >= ini) || null;
  }
  function textoPeriodicidad(per) {
    if (!per || per.tipo !== "recurrente") return "Único";
    const p = { ...BASE_RECURRENTE, ...per };
    const cada = Number(p.cada) > 1 ? `cada ${p.cada} ${p.unidad === "semana" ? "semanas" : "meses"}` : p.unidad === "semana" ? "semanal" : "mensual";
    return `Recurrente · ${cada} · terreno ${p.diasTerreno} día${Number(p.diasTerreno) === 1 ? "" : "s"} · entrega ${p.diasEntrega} días hábiles después de los datos`;
  }

  // compartido/tooltip.js
  var globo = null;
  function crearGlobo() {
    if (globo && globo.isConnected) return globo;
    globo = document.createElement("div");
    globo.className = "sis-tip";
    globo.setAttribute("role", "tooltip");
    globo.hidden = true;
    document.body.appendChild(globo);
    return globo;
  }
  function ocultarTooltip() {
    if (globo) globo.hidden = true;
  }
  function mostrarTooltip(el, html) {
    const g = crearGlobo();
    if (!html) {
      g.hidden = true;
      return;
    }
    g.innerHTML = html;
    g.hidden = false;
    const r = el.getBoundingClientRect(), w = g.offsetWidth, h = g.offsetHeight;
    const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8));
    let y = r.bottom + 8;
    if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 8);
    g.style.left = `${x}px`;
    g.style.top = `${y}px`;
  }
  function activarTooltips(raiz, obtenerHtml) {
    const sobre = (ev) => {
      const el = ev.target.closest("[data-tip]");
      if (el && raiz.contains(el)) mostrarTooltip(el, obtenerHtml(el));
      else ocultarTooltip();
    };
    const fuera = () => ocultarTooltip();
    raiz.addEventListener("mouseover", sobre);
    raiz.addEventListener("focusin", sobre);
    raiz.addEventListener("mouseleave", fuera);
    addEventListener("scroll", fuera, true);
    return () => {
      raiz.removeEventListener("mouseover", sobre);
      raiz.removeEventListener("focusin", sobre);
      raiz.removeEventListener("mouseleave", fuera);
      removeEventListener("scroll", fuera, true);
      ocultarTooltip();
    };
  }

  // compartido/deshacer.js
  var caja = null;
  var timer = null;
  function avisarConDeshacer(texto3, alDeshacer) {
    if (!caja || !caja.isConnected) {
      caja = document.createElement("div");
      caja.className = "sis-deshacer";
      caja.setAttribute("role", "status");
      document.body.appendChild(caja);
    }
    caja.innerHTML = "<span></span>";
    caja.firstChild.textContent = texto3;
    if (alDeshacer) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Deshacer";
      b.addEventListener("click", async () => {
        caja.hidden = true;
        clearTimeout(timer);
        try {
          await alDeshacer();
        } catch (e) {
          console.error(e);
        }
      }, { once: true });
      caja.appendChild(b);
    }
    caja.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      caja.hidden = true;
    }, alDeshacer ? 6e3 : 3500);
  }

  // compartido/columnas.js
  function columnasArrastrables(raiz, op) {
    let arr = null;
    const abajo = (e) => {
      const borde = e.target.closest("[data-borde]");
      if (borde && raiz.contains(borde)) {
        arr = { tipo: "ancho", id: borde.dataset.borde, x0: e.clientX, w0: op.ancho(borde.dataset.borde), el: borde, w: null };
        borde.classList.add("activo");
        e.preventDefault();
        return;
      }
      const th = e.target.closest(".sis-th[data-col]");
      if (th && raiz.contains(th) && e.button === 0) arr = { tipo: "mover", id: th.dataset.col, x0: e.clientX, activo: false, th, destino: -1 };
    };
    const mover2 = (e) => {
      if (!arr) return;
      const dx = e.clientX - arr.x0;
      if (arr.tipo === "ancho") {
        arr.w = Math.max(44, Math.min(360, Math.round(arr.w0 + dx)));
        op.alAncho(arr.id, arr.w);
        return;
      }
      if (!arr.activo) {
        if (Math.abs(dx) < 6) return;
        arr.activo = true;
        arr.th.classList.add("moviendo");
      }
      arr.th.style.transform = `translateX(${dx}px)`;
      const ths = [...raiz.querySelectorAll(".sis-th[data-col]")].filter((x) => x !== arr.th);
      let i = ths.findIndex((x) => {
        const r = x.getBoundingClientRect();
        return e.clientX < r.left + r.width / 2;
      });
      if (i < 0) i = ths.length;
      arr.destino = i;
      const caja2 = op.caja();
      if (!caja2 || !ths.length) return;
      const rc = caja2.getBoundingClientRect();
      const ref = i < ths.length ? ths[i].getBoundingClientRect().left : ths[ths.length - 1].getBoundingClientRect().right;
      let m = caja2.querySelector(".sis-col-marca");
      if (!m) {
        m = document.createElement("div");
        m.className = "sis-col-marca";
        caja2.appendChild(m);
      }
      m.style.left = `${ref - rc.left + caja2.scrollLeft}px`;
      if (e.clientX > rc.right - 40) caja2.scrollLeft += 12;
      else if (e.clientX < rc.left + 40) caja2.scrollLeft -= 12;
    };
    const arriba = () => {
      if (!arr) return;
      const a = arr;
      arr = null;
      if (a.tipo === "ancho") {
        a.el.classList.remove("activo");
        if (a.w != null && a.w !== a.w0) op.alSoltarAncho(a.id, a.w);
        return;
      }
      if (!a.activo) return;
      a.th.classList.remove("moviendo");
      a.th.style.transform = "";
      const m = op.caja() && op.caja().querySelector(".sis-col-marca");
      if (m) m.remove();
      op.alMover(a.id, a.destino);
    };
    const cancelar = () => {
      if (arr && arr.th) {
        arr.th.classList.remove("moviendo");
        arr.th.style.transform = "";
      }
      arr = null;
    };
    raiz.addEventListener("pointerdown", abajo);
    addEventListener("pointermove", mover2);
    addEventListener("pointerup", arriba);
    addEventListener("pointercancel", cancelar);
    return () => {
      raiz.removeEventListener("pointerdown", abajo);
      removeEventListener("pointermove", mover2);
      removeEventListener("pointerup", arriba);
      removeEventListener("pointercancel", cancelar);
    };
  }

  // modulos/seguimiento/pantallas.js
  var ICO = {
    ok: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    proc: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="4" cy="8" r="1.4" fill="currentColor"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="12" cy="8" r="1.4" fill="currentColor"/></svg>',
    papel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" fill="#FFF3C4" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M15 3v4h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 12h7M9 15.5h7M9 9h3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    carpeta: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 4.5v8h13v-6.5H7.5L6 4.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'
  };
  var DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  var corta = (iso) => {
    if (!iso || iso === "si") return iso === "si" ? "volado" : "";
    const d = /* @__PURE__ */ new Date(iso + "T12:00:00");
    return `${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
  };
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
  var extremos = (nombre) => {
    const p = String(nombre).split(" – ");
    return [p[0], p[p.length - 1]];
  };
  function montarPantallas2(contenedor2, ctx2) {
    fijarPersona3(ctx2.personaId || null);
    const raiz = document.createElement("div");
    raiz.className = "mod-seguimiento";
    contenedor2.appendChild(raiz);
    let activo2 = true;
    const st = {
      proyectoId: ctx2.proyectoId || null,
      tab: ctx2.tab === "marcar" ? "marcar" : ctx2.tab === "config" ? "config" : "seg",
      plan: null,
      ciclos: [],
      ciclo: null,
      eventos: [],
      est: {},
      entregas: [],
      area: 0,
      sel: /* @__PURE__ */ new Set(),
      abiertos: /* @__PURE__ */ new Set(),
      filtro: "",
      plegar: leerLS("sg_plegar", true),
      revision: null,
      brillo: /* @__PURE__ */ new Set(),
      pop: "",
      planes: [],
      resumenes: {}
    };
    const base = { proyectos: [], personas: [] };
    const P = () => st.plan;
    const area2 = () => st.plan.areas[Math.min(st.area, st.plan.areas.length - 1)];
    const colsVis = () => st.plan.cols.filter((c) => c.visible);
    const nomProy = (id) => !id ? "" : id === OFICINA_ID ? "Oficina" : (base.proyectos.find((p) => p.id === id) || {}).nombre || "Proyecto";
    const yo = () => (base.personas.find((p) => p.id === ctx2.personaId) || {}).nombre || "";
    const est2 = (id) => estadoDe(st.est, id);
    async function cargar() {
      [base.proyectos, base.personas] = await Promise.all([listarProyectos(), listarPersonas()]);
      if (!st.proyectoId) {
        st.planes = await listarPlanes2();
        st.resumenes = {};
        for (const pl of st.planes) {
          const c = (await ciclosDePlan(pl.id))[0] || null;
          const e = c ? estadoCiclo(await eventosDeCiclo(c.id)) : {};
          st.resumenes[pl.id] = { ciclo: c, cuenta: cuenta(pl, e, pl.areas.flatMap((a) => a.tramos)), plazo: plazoCiclo(pl, c, hoyISO()) };
        }
        return;
      }
      st.plan = await planDeProyecto(st.proyectoId);
      if (!st.plan) return;
      st.ciclos = await ciclosDePlan(st.plan.id);
      if (!st.ciclo || !st.ciclos.some((c) => c.id === st.ciclo.id)) st.ciclo = st.ciclos[0] || null;
      else st.ciclo = st.ciclos.find((c) => c.id === st.ciclo.id);
      await cargarEventos();
    }
    async function cargarEventos() {
      st.eventos = st.ciclo ? await eventosDeCiclo(st.ciclo.id) : [];
      st.entregas = st.ciclo ? await entregasDeCiclo(st.ciclo.id) : [];
      st.est = estadoCiclo(st.eventos);
    }
    async function aplicar(cambios, texto3) {
      const { eventos, inversos } = prepararCambios(st.est, cambios, { cicloId: st.ciclo.id, planId: st.plan.id, por: yo() });
      if (!eventos.length) {
        if (texto3) avisarConDeshacer("No había nada que cambiar");
        return;
      }
      await agregarEventos(eventos);
      await cargarEventos();
      render();
      if (texto3) avisarConDeshacer(texto3, async () => {
        await aplicar(inversos, null);
        avisarConDeshacer("Cambio deshecho");
      });
    }
    let timerPlan = null, timerCiclo = null;
    function guardarPlanLuego() {
      clearTimeout(timerPlan);
      timerPlan = setTimeout(() => guardarPlan2(st.plan), 500);
    }
    async function render() {
      if (!activo2) return;
      let html;
      if (!st.proyectoId) html = vistaLista();
      else if (!st.plan) html = vistaNuevo();
      else html = vistaProyecto();
      raiz.innerHTML = `<div class="sis-vista">${html}</div>`;
      aplicarPlantilla();
      st.brillo.clear();
      st.pop = "";
    }
    async function recargar() {
      await cargar();
      await render();
    }
    function vistaLista() {
      const filas2 = st.planes.map((pl) => {
        const r = st.resumenes[pl.id] || {}, c = r.cuenta || { total: 0, ok: 0 }, pz = r.plazo;
        const pct = c.productos ? Math.round(100 * c.productosListos / c.productos) : 0;
        return `<a class="sg-fila-proy" href="#/seguimiento/${escapar(pl.proyectoId)}">
        <span class="sg-fp-nom"><b>${escapar(nomProy(pl.proyectoId))}</b><small>${pl.tipo === "mensual" ? "Mensual" : "Trabajo único"}${r.ciclo ? ` · ${escapar(r.ciclo.nombre || "")}` : ""}</small></span>
        <span class="sg-fp-barra"><span class="sg-mini"><i style="width:${pct}%"></i></span><small class="mono">${c.productosListos}/${c.productos} productos · ${c.ok}/${c.total} entregados</small></span>
        <span>${pz ? pastillaPlazo(pz, c) : '<span class="sis-tenue">sin plazo</span>'}</span></a>`;
      }).join("");
      const sinPlan = base.proyectos.filter((p) => p.id !== OFICINA_ID && !st.planes.some((pl) => pl.proyectoId === p.id));
      return `<div class="sis-cab"><h1>Entregas</h1></div>
      <p class="sis-tenue">Qué hay y qué falta en cada trabajo abierto: tramos volados, productos en gabinete y entregas.</p>
      <section class="sis-tarjeta">${filas2 ? `<div class="sg-lista-proy">${filas2}</div>` : '<div class="sis-vacio"><p>Todavía no hay seguimientos. Crea uno para un proyecto.</p></div>'}</section>
      ${sinPlan.length ? `<section class="sis-tarjeta"><h2>Nuevo seguimiento</h2>
        <div class="sg-nuevo-lista">${sinPlan.map((p) => `<a class="sis-btn chico" href="#/seguimiento/${escapar(p.id)}">${escapar(p.nombre)}</a>`).join("")}</div></section>` : '<p class="sis-tenue">Para crear un seguimiento, primero crea el proyecto en Proyectos.</p>'}`;
    }
    function pastillaPlazo(pz, c) {
      if (c && c.total && c.ok === c.total) return '<span class="sis-chip verde">Entregado</span>';
      if (pz.quedan < 0) return `<span class="sis-chip rojo">Vencido hace ${-pz.quedan} d. háb.</span>`;
      if (pz.quedan === 0) return '<span class="sis-chip ambar">Vence hoy</span>';
      return `<span class="sis-chip ${pz.quedan <= 2 ? "ambar" : "gris"}">Vence ${corta(pz.vence)} · ${pz.quedan} d. háb.</span>`;
    }
    function vistaNuevo() {
      return `<div class="sis-miga"><a href="#/seguimiento">Seguimiento</a> / <a href="#/proyecto/${escapar(st.proyectoId)}">${escapar(nomProy(st.proyectoId))}</a></div>
      <h1>Nuevo seguimiento · ${escapar(nomProy(st.proyectoId))}</h1>
      <form class="sis-form sis-tarjeta sg-form-nuevo" data-form="nuevo">
        <div class="sis-campo"><span>Tipo de trabajo</span><div class="sis-opciones">
          <label class="sis-opcion"><input type="radio" name="tipo" value="mensual" checked> Mensual (un ciclo por mes)</label>
          <label class="sis-opcion"><input type="radio" name="tipo" value="unico"> Único</label></div></div>
        <div class="sis-par"><label class="sis-campo"><span>Mes</span><input name="mes" value="${escapar(nombreMes(hoyISO()))}"></label>
          <label class="sis-campo"><span>N° de mes del contrato</span><input name="mesContrato" type="number" min="1" value="1"></label></div>
        <div class="sis-campo"><span>Columnas</span><div class="sis-opciones">
          <label class="sis-opcion"><input type="radio" name="cols" value="vuelo" checked> Vuelo: NP, MDS, OF, KMZ</label>
          <label class="sis-opcion"><input type="radio" name="cols" value="simple"> Simple: un producto</label></div></div>
        <label class="sis-campo"><span>Tramos: pega los nombres de las carpetas (uno por línea)</span>
          <textarea name="carpetas" rows="6" placeholder="001_10+200 - 4+900&#10;002_15+200 - 10+200&#10;…"></textarea></label>
        <p class="sis-tenue">En el explorador de Windows: selecciona las carpetas de los tramos, Shift + clic derecho → «Copiar como ruta», y pega aquí. Se leen el número y los DM. Se pueden cambiar después en Configurar.</p>
        <label class="sis-check"><input type="checkbox" name="ejemplo"> Cargar el ejemplo de la línea de impulsión con avance ficticio (para probar)</label>
        <div class="sis-acciones"><button class="sis-btn primario">Crear seguimiento</button></div>
      </form>`;
    }
    async function crear(fd) {
      const ejemplo = fd.get("ejemplo") === "on";
      const tipo = fd.get("tipo") === "unico" ? "unico" : "mensual";
      let plan;
      if (ejemplo) plan = ejemploSaddn(nuevoId);
      else {
        const cols = fd.get("cols") === "simple" ? [{ id: "terreno", tipo: "terreno", nombre: "Terreno", ancho: 128, visible: true }, { id: "p1", tipo: "producto", nombre: "Producto", ext: "", ancho: 90, visible: true }, { id: "entrega", tipo: "entrega", nombre: "Entrega", ancho: 116, visible: true }] : COLS_VUELO();
        const tramos = tramosDesdeCarpetas(fd.get("carpetas") || "", nuevoId);
        plan = { tipo, plazo: { tipo: "mes", dias: 10 }, cols, areas: [{ id: nuevoId(), nombre: "Área 1", carpeta: "", tramos: tramos.length ? tramos : [{ id: nuevoId(), n: "001", nombre: "Tramo 1", carpeta: "" }] }] };
      }
      plan.proyectoId = st.proyectoId;
      const guardado = await guardarPlan2(plan);
      const ciclo = await guardarCiclo({ planId: guardado.id, proyectoId: st.proyectoId, nombre: plan.tipo === "mensual" ? String(fd.get("mes") || "").trim() : "Trabajo", mesContrato: plan.tipo === "mensual" ? Number(fd.get("mesContrato")) || 1 : null, datos: hoyISO() });
      if (ejemplo) await sembrarEjemplo(guardado, ciclo);
      st.ciclo = ciclo;
    }
    async function sembrarEjemplo(plan, ciclo) {
      const L = plan.areas[0].tramos, cambios = [];
      const vol = (t, f) => cambios.push({ tramoId: t.id, tipo: "terreno", valor: f, por: "Edgardo" });
      const prods = (t, vals) => ["np", "mds", "of", "kmz"].forEach((c, k) => cambios.push({ tramoId: t.id, tipo: "prod", col: c, valor: vals[k] }));
      const ent = (t) => cambios.push({ tramoId: t.id, tipo: "entrega", valor: "E1" });
      const fecha2 = (d) => {
        const x = /* @__PURE__ */ new Date();
        x.setDate(x.getDate() - d);
        return hoyISO(x);
      };
      L.forEach((t, i) => {
        if (i <= 19 && i !== 8) {
          vol(t, fecha2(i <= 7 ? 14 : i <= 14 ? 13 : 12));
          prods(t, ["listo", "listo", "listo", "listo"]);
          ent(t);
        } else if (i === 8) {
          vol(t, fecha2(13));
          prods(t, ["listo", "listo", "listo", "proc"]);
          cambios.push({ tramoId: t.id, tipo: "nota", valor: "El KMZ se quedó pegado al exportar desde Global Mapper. Reintentar con teselas más chicas.", por: "Camilo" });
        } else if (i <= 21) {
          vol(t, fecha2(11));
          prods(t, ["listo", "listo", "proc", "falta"]);
        } else if (i >= 30) {
          vol(t, fecha2(11));
        }
      });
      cambios.push({ tramoId: L[21].id, tipo: "nota", valor: "Viento fuerte desde las 14:00, se cortó acá. Quedan 022 a 029 para la próxima salida.", por: "Edgardo" });
      for (const a of plan.areas.slice(1)) {
        vol(a.tramos[0], fecha2(11));
        prods(a.tramos[0], ["listo", "listo", "listo", "listo"]);
        ent(a.tramos[0]);
      }
      await guardarEntrega({ cicloId: ciclo.id, planId: plan.id, codigo: "E1", fecha: fecha2(4) });
      const { eventos } = prepararCambios({}, cambios, { cicloId: ciclo.id, planId: plan.id });
      await agregarEventos(eventos);
    }
    function vistaProyecto() {
      const pl = P(), c = st.ciclo;
      const pz = plazoCiclo(pl, c, hoyISO());
      const k = cuenta(pl, st.est, pl.areas.flatMap((a) => a.tramos));
      const idx = st.ciclos.findIndex((x) => c && x.id === c.id);
      return `<div class="sis-encabezado">
        <div>
          <div class="sis-miga"><a href="#/seguimiento">Seguimiento</a> / <a href="#/proyecto/${escapar(st.proyectoId)}">${escapar(nomProy(st.proyectoId))}</a></div>
          <h1>${escapar(nomProy(st.proyectoId))}</h1>
          <div class="sis-meta">
            <span>${pl.tipo === "mensual" ? "Servicio mensual" : "Trabajo único"}</span>
            ${c && c.mesContrato ? `<span>Mes ${c.mesContrato} del contrato · <span class="mono">${escapar(carpetaMes(c))}</span></span>` : ""}
            ${c && c.datos ? `<span>Datos recibidos ${escapar(fechaLegible(c.datos))}</span>` : ""}
            ${pz ? pastillaPlazo(pz, k) : ""}
          </div>
        </div>
        ${pl.tipo === "mensual" ? `<div class="sg-ciclos">
          <button class="sis-btn chico" data-acc="ciclo" data-v="${idx + 1}" ${idx >= st.ciclos.length - 1 ? "disabled" : ""} aria-label="Mes anterior">‹</button>
          <b>${escapar(c ? c.nombre || "Sin nombre" : "—")}</b>
          <button class="sis-btn chico" data-acc="ciclo" data-v="${idx - 1}" ${idx <= 0 ? "disabled" : ""} aria-label="Mes siguiente">›</button>
          <button class="sis-btn chico" data-acc="nuevo-ciclo">+ Nuevo mes</button></div>` : ""}
      </div>
      <nav class="sg-pestanas" role="tablist">
        <button role="tab" data-acc="tab" data-v="seg" aria-selected="${st.tab === "seg"}">Seguimiento</button>
        <button role="tab" data-acc="tab" data-v="marcar" aria-selected="${st.tab === "marcar"}">Marcar avance</button>
        <button role="tab" data-acc="tab" data-v="config" aria-selected="${st.tab === "config"}">Configurar</button>
      </nav>
      ${!c ? '<div class="sis-vacio"><p>Este seguimiento no tiene meses. Crea el primero.</p><button class="sis-btn primario" data-acc="nuevo-ciclo">+ Nuevo mes</button></div>' : st.tab === "marcar" ? vistaMarcar() : st.tab === "config" ? vistaConfig() : vistaSeguimiento(k)}`;
    }
    function vistaSeguimiento(k) {
      const pl = P();
      const grandes = pl.areas.map((a, i) => [a, i]).filter(([a]) => a.tramos.length > 1);
      const chicas = pl.areas.map((a, i) => [a, i]).filter(([a]) => a.tramos.length === 1);
      return `<div class="sg-kpis">
        <div class="sg-kpi"><small>Terreno</small><b>${k.total - k.sinvolar}<span>/${k.total}</span></b><small>tramos volados</small></div>
        <div class="sg-kpi"><small>Cargado en entregas</small><b class="sg-c-ok">${k.ok}</b><small>${st.entregas.map((e) => `${escapar(e.codigo)} · ${corta(e.fecha)}`).join(" · ") || "sin entregas aún"}</small></div>
        <div class="sg-kpi"><small>Procesando</small><b class="sg-c-proc">${k.proc + k.listo}</b><small>${k.listo ? `${k.listo} listos para entregar` : "en gabinete"}</small></div>
        <div class="sg-kpi"><small>Falta en gabinete</small><b class="sg-c-falta">${k.falta}</b><small>volados, sin empezar</small></div>
        <div class="sg-kpi"><small>Falta volar</small><b class="sg-c-falta">${k.sinvolar}</b><small>pendientes de terreno</small></div>
      </div>
      ${grandes.map(([a, i]) => tarjetaFranja(a, i)).join("")}
      <div class="sg-dos">
        ${chicas.length ? `<section class="sis-tarjeta"><h2>Otras áreas</h2><div class="sg-chicas">${chicas.map(([a, i]) => `<div><span>${escapar(a.nombre)}</span>
          <div class="sg-barra chica">${segmento(a.tramos[0], i, "terreno")}</div><div class="sg-barra chica">${segmento(a.tramos[0], i, "gab")}</div></div>`).join("")}</div>
          <p class="sis-tenue">Arriba terreno · abajo gabinete</p></section>` : ""}
        <section class="sis-tarjeta"><h2>Qué falta</h2>${queFalta()}</section>
      </div>
      <div class="sg-leyenda">
        <span><i class="s-falta"></i>Falta</span><span><i class="s-proc"></i>Procesando</span>
        <span><i class="s-ok"></i>Terreno: volado · Gabinete: cargado en una entrega</span><span><i class="s-na"></i>Gabinete no aplica (aún no se vuela)</span>
      </div>`;
    }
    function tarjetaFranja(a, i) {
      const T = a.tramos;
      const [ini] = extremos(T[0].nombre), [, fin] = extremos(T[T.length - 1].nombre);
      return `<section class="sis-tarjeta"><div class="sg-cab-franja"><h2>${escapar(a.nombre)}</h2><span class="sis-tenue">Pasa el mouse o toca un tramo para ver el detalle</span></div>
      <div class="sg-franja">
        <span>Terreno</span><div class="sg-barra">${T.map((t) => segmento(t, i, "terreno")).join("")}</div>
        <span>Gabinete</span><div class="sg-barra">${T.map((t) => segmento(t, i, "gab")).join("")}</div>
        <span></span><div class="sg-ejes mono"><span>${escapar(ini)}</span><span>${escapar(fin)}</span></div>
      </div></section>`;
    }
    function segmento(tr, ai, tipo) {
      const t = est2(tr.id);
      let cls;
      if (tipo === "terreno") cls = volado(t) ? "s-ok" : "s-falta";
      else {
        const g = gabinete(P(), t);
        cls = g === "na" ? "s-na" : g === "ok" ? "s-ok" : g === "falta" ? "s-falta" : "s-proc";
      }
      const largo2 = tr.ini != null && tr.fin != null ? Math.max(0.3, tr.fin - tr.ini) : 5;
      return `<button type="button" class="sg-seg ${cls}" style="flex-grow:${largo2.toFixed(2)}" data-tip="seg" data-a="${ai}" data-t="${escapar(tr.id)}" aria-label="${escapar(tr.n)} ${escapar(tr.nombre)}"></button>`;
    }
    function textoTramo(tr) {
      const t = est2(tr.id), g = gabinete(P(), t);
      const gtxt = { na: "no aplica, falta volar", falta: "sin empezar", proc: "procesando", listo: "listo para entregar", ok: `cargado en ${t.entrega}` }[g];
      const prods = volado(t) ? productos(P()).map((c) => {
        const e = estadoProd(t, c);
        return `${c.nombre} ${e === "listo" ? "✓" : e === "proc" ? "en curso" : "falta"}`;
      }).join(" · ") : "";
      return `<b>${escapar(tr.n)} · ${escapar(tr.nombre)}</b>
Terreno: ${volado(t) ? `volado${t.terreno !== "si" ? " " + escapar(corta(t.terreno)) : ""}${t.por ? " · " + escapar(t.por) : ""}` : "falta volar"}
Gabinete: ${gtxt}${prods ? "\n" + escapar(prods) : ""}${t.nota ? `
Nota: ${escapar(t.nota)}` : ""}`;
    }
    function queFalta() {
      const pl = P(), out = [];
      const clase = (tr) => {
        const t = est2(tr.id);
        if (!volado(t)) return "volar";
        return { falta: "procesar", proc: "terminar", listo: "entregar" }[gabinete(pl, t)] || null;
      };
      pl.areas.forEach((a) => {
        const T = a.tramos;
        let i = 0;
        while (i < T.length) {
          const k = clase(T[i]);
          if (!k) {
            i++;
            continue;
          }
          let j = i;
          while (j < T.length && clase(T[j]) === k) j++;
          const rango = j - i > 1 ? `${extremos(T[i].nombre)[0]} → ${extremos(T[j - 1].nombre)[1]} · ${j - i} tramos` : `${T[i].n} · ${T[i].nombre}`;
          const det = k === "terminar" && j - i === 1 ? productos(pl).filter((c) => estadoProd(est2(T[i].id), c) !== "listo").map((c) => c.nombre).join(", ") : "";
          out.push(`<div class="sg-falta-${k}"><i></i><div><b>${{ volar: "Volar", procesar: "Procesar", terminar: "Terminar", entregar: "Cargar en entrega" }[k]} ${escapar(rango)}</b><span>${escapar(a.nombre)}${det ? " · falta " + escapar(det) : ""}</span></div></div>`);
          i = j;
        }
      });
      return out.length ? `<div class="sg-falta">${out.join("")}</div>` : '<div class="sg-felicita">No falta nada: todo está cargado en entregas.</div>';
    }
    const pasaFiltro = (tr) => {
      if (!st.filtro) return true;
      const t = est2(tr.id);
      return st.filtro === "sinvolar" ? !volado(t) : gabinete(P(), t) === st.filtro;
    };
    const grupo = (tr) => {
      const t = est2(tr.id);
      return t.entrega ? "ok" : !volado(t) ? "sinvolar" : null;
    };
    const plantilla = () => `36px 54px minmax(170px,1fr) ${colsVis().map((c) => c.ancho + "px").join(" ")} 52px`;
    const anchoMin = () => 36 + 54 + 190 + colsVis().reduce((s, c) => s + c.ancho, 0) + 52 + 16;
    function aplicarPlantilla() {
      const t = raiz.querySelector(".sg-tabla");
      if (!t) return;
      t.style.setProperty("--cols", plantilla());
      t.style.setProperty("--min", anchoMin() + "px");
    }
    function vistaMarcar() {
      const pl = P(), a = area2(), c = cuenta(pl, st.est, a.tramos);
      const chips = [["sinvolar", "Falta volar", "s-falta", c.sinvolar], ["falta", "Falta en gabinete", "s-falta-borde", c.falta], ["proc", "Procesando", "s-proc", c.proc], ["listo", "Listo para entregar", "s-listo", c.listo], ["ok", "Cargado en entrega", "s-ok", c.ok]];
      return `${pl.areas.length > 1 ? `<div class="sg-areas" role="group" aria-label="Áreas">${pl.areas.map((ar, i) => {
        const x = cuenta(pl, st.est, ar.tramos);
        return `<button type="button" data-acc="area" data-v="${i}" aria-pressed="${i === st.area}">${escapar(ar.nombre)} <small class="mono">${x.ok}/${x.total}</small></button>`;
      }).join("")}</div>` : ""}
      <div class="sg-resumen">
        ${chips.map(([k, t, cl, n]) => `<button type="button" class="sg-filtro" data-acc="filtro" data-v="${k}" aria-pressed="${st.filtro === k}"><i class="${cl}"></i>${t} <b class="mono">${n}</b></button>`).join("")}
        <label class="sg-interruptor"><input type="checkbox" data-acc="plegar" ${st.plegar ? "checked" : ""}> Agrupar tramos iguales</label>
      </div>
      ${c.total && c.ok === c.total ? `<div class="sg-felicita">${escapar(a.nombre)} está completa: todos los tramos cargados en entregas.</div>` : ""}
      ${st.revision ? panelRevision() : ""}
      <div class="sg-tabla-caja">
        ${st.sel.size ? barraLote() : ""}
        <div class="sg-scroll"><div class="sg-tabla" role="table" aria-label="Avance por tramo">${cabecera()}${filas()}</div></div>
        <div class="sg-pie-tabla">
          <span><i class="sg-mini-cuadro falta"></i>Falta</span><span><i class="sg-mini-cuadro proc"></i>Procesando</span>
          <span><i class="sg-mini-cuadro listo"></i>Listo en la carpeta</span><span><i class="sg-mini-cuadro ent"></i>Cargado en una entrega</span>
          <span class="sg-ayuda">Toca un cuadro para avanzarlo · arrastra los títulos para moverlos · arrastra su borde para el ancho</span>
        </div>
      </div>
      <div class="sis-acciones sg-revisar" data-solo-pc>
        <label class="sis-btn">${ICO.carpeta} Revisar carpeta del mes<input type="file" data-archivo="carpeta" webkitdirectory directory multiple hidden></label>
        <span class="sis-tenue">Eliges la carpeta${st.ciclo && st.ciclo.mesContrato ? ` <span class="mono">${escapar(carpetaMes(st.ciclo))}</span>` : ""} y se marca listo lo que ya está (por carpeta del tramo y extensión). Solo se leen los nombres: no se sube nada. Chrome puede decir «subir»: no sale del PC.</span>
      </div>`;
    }
    function panelRevision() {
      const r = st.revision;
      return `<section class="sis-tarjeta sg-revision"><h2>Revisión de la carpeta</h2>
      <p>${r.archivos} archivos leídos · ${r.encontrados} productos encontrados en las carpetas de los tramos.</p>
      ${r.cambios.length ? `<p><b>${r.cambios.filter((c) => c.tipo === "prod").length} producto${r.cambios.filter((c) => c.tipo === "prod").length === 1 ? "" : "s"}</b> pasan a «listo»${r.cambios.some((c) => c.tipo === "terreno") ? ` y <b>${r.cambios.filter((c) => c.tipo === "terreno").length}</b> tramo(s) quedan como volados` : ""}.</p>` : "<p>Todo lo que está en la carpeta ya estaba marcado.</p>"}
      ${r.noEstan.length ? `<p class="sg-c-falta">Marcados listos pero no aparecen: ${r.noEstan.slice(0, 6).map((x) => `${escapar(x.tramo.n)} ${escapar(x.col.nombre)}`).join(", ")}${r.noEstan.length > 6 ? "…" : ""}. Revisa si están en otra carpeta.</p>` : ""}
      ${!r.encontrados ? '<p class="sis-tenue">No calzó ninguna carpeta: revisa en Configurar que cada tramo tenga el nombre de su carpeta y cada producto su extensión.</p>' : ""}
      <div class="sis-acciones">${r.cambios.length ? '<button class="sis-btn primario" data-acc="revision-aplicar">Aplicar</button>' : ""}<button class="sis-btn" data-acc="revision-cerrar">${r.cambios.length ? "Cancelar" : "Cerrar"}</button></div></section>`;
    }
    function cabecera() {
      const vis = area2().tramos.filter(pasaFiltro);
      const todos2 = vis.length && vis.every((t) => st.sel.has(t.id));
      return `<div class="sg-fila sg-cab" role="row">
      <span class="sg-c" role="columnheader"><input type="checkbox" aria-label="Seleccionar todos" data-acc="sel-todos" ${todos2 ? "checked" : ""}></span>
      <span role="columnheader">N°</span><span role="columnheader">Tramo</span>
      ${colsVis().map((c) => `<span class="sis-th" role="columnheader" data-col="${escapar(c.id)}" title="${escapar(c.nombre)}${c.ext ? ` (${escapar(c.ext)})` : ""} · arrastra para mover"><span class="sis-th-grip" aria-hidden="true">⋮⋮</span><span class="sg-th-t">${escapar(c.nombre)}</span><span class="sis-th-borde" data-borde="${escapar(c.id)}" aria-hidden="true"></span></span>`).join("")}
      <span class="sg-c" role="columnheader">Nota</span></div>`;
    }
    function filas() {
      const T = area2().tramos, out = [];
      if (st.filtro) {
        const v = T.filter(pasaFiltro);
        return v.length ? v.map(fila2).join("") : '<div class="sg-fila"><span></span><span></span><span class="sis-tenue">No hay tramos en este estado.</span></div>';
      }
      let i = 0;
      while (i < T.length) {
        const g = st.plegar ? grupo(T[i]) : null;
        if (g) {
          let j = i;
          while (j < T.length && grupo(T[j]) === g) j++;
          if (j - i >= (g === "ok" ? 2 : 3)) {
            const key = `${st.ciclo.id}:${st.area}:${T[i].id}`, abierto = st.abiertos.has(key);
            const ents = [...new Set(T.slice(i, j).map((t) => est2(t.id).entrega))].join(", ");
            out.push(`<button type="button" class="sg-plegada ${g}" data-acc="grupo" data-v="${escapar(key)}" aria-expanded="${abierto}"><span class="mono">${escapar(T[i].n)} – ${escapar(T[j - 1].n)}</span><span>${escapar(extremos(T[i].nombre)[0])} → ${escapar(extremos(T[j - 1].nombre)[1])} · ${j - i} tramos ${g === "ok" ? `cargados en ${escapar(ents)}` : "falta volar"}</span><span class="sg-ver">${abierto ? "▴ juntar" : "▾ ver"}</span></button>`);
            if (abierto) for (let k = i; k < j; k++) out.push(fila2(T[k]));
            i = j;
            continue;
          }
        }
        out.push(fila2(T[i]));
        i++;
      }
      return out.join("");
    }
    function fila2(tr) {
      const t = est2(tr.id);
      return `<div class="sg-fila${st.sel.has(tr.id) ? " sel" : ""}${st.brillo.has(tr.id) ? " brilla" : ""}" role="row" data-t="${escapar(tr.id)}">
      <span class="sg-c" role="cell"><input type="checkbox" aria-label="Seleccionar ${escapar(tr.n)}" data-acc="sel" ${st.sel.has(tr.id) ? "checked" : ""}></span>
      <span class="sg-n mono" role="cell">${escapar(tr.n)}</span>
      <span class="sg-nom" role="cell"><b>${escapar(tr.nombre)}</b>${tr.carpeta ? `<small class="mono">${escapar(tr.carpeta)}</small>` : ""}</span>
      ${colsVis().map((c) => `<span class="sg-c" role="cell">${celda(tr, t, c)}</span>`).join("")}
      <span class="sg-c" role="cell">${t.nota ? `<button type="button" class="sg-nota con" data-acc="nota" data-tip="nota" aria-label="Nota: ${escapar(t.nota)}">${ICO.papel}</button>` : '<button type="button" class="sg-nota vacia" data-acc="nota" aria-label="Agregar nota"></button>'}</span></div>`;
    }
    function celda(tr, t, c) {
      if (c.tipo === "terreno") return volado(t) ? `<button type="button" class="sg-terr si" data-acc="terreno" title="${t.por ? `Volado por ${escapar(t.por)}. ` : ""}Toca para desmarcar"><i></i>${escapar(corta(t.terreno))}</button>` : '<button type="button" class="sg-terr no" data-acc="terreno" title="Toca para marcarlo volado hoy"><i></i>falta volar</button>';
      if (c.tipo === "producto") {
        if (!volado(t)) return '<span class="sg-na" title="Aún no se vuela">—</span>';
        const e = estadoProd(t, c);
        return `<button type="button" class="sg-prod ${e}${st.pop === `${tr.id}:${c.id}` ? " pop" : ""}" data-acc="prod" data-col="${escapar(c.id)}" aria-label="${escapar(c.nombre)}: ${TEXTO_ESTADO[e]}" title="${escapar(c.nombre)} ${escapar(c.ext || "")}: ${TEXTO_ESTADO[e]}">${e === "listo" ? ICO.ok : e === "proc" ? ICO.proc : ""}</button>`;
      }
      if (c.tipo === "entrega") {
        if (t.entrega) {
          const e = st.entregas.find((x) => x.codigo === t.entrega);
          return `<button type="button" class="sg-chip-ent" data-acc="entrega">${escapar(t.entrega)}${e ? " · " + escapar(corta(e.fecha).split(" ")[1]) : ""}</button>`;
        }
        return todoListo(P(), t) ? '<button type="button" class="sg-add-ent" data-acc="entrega">+ entrega</button>' : "";
      }
      return "";
    }
    function barraLote() {
      return `<div class="sg-lote"><b>${st.sel.size} seleccionado${st.sel.size > 1 ? "s" : ""}</b><span class="sis-tenue">Marcar como:</span>
      <button type="button" class="sis-btn chico" data-acc="lote" data-v="volado">Volado hoy</button>
      <button type="button" class="sis-btn chico sg-b-proc" data-acc="lote" data-v="proc">Procesando</button>
      <button type="button" class="sis-btn chico sg-b-listo" data-acc="lote" data-v="listo">Listo</button>
      <button type="button" class="sis-btn chico sg-b-ent" data-acc="lote-entrega">Cargar en entrega ▾</button>
      <button type="button" class="sg-quitar" data-acc="sel-limpiar">Quitar selección</button></div>`;
    }
    function vistaConfig() {
      const pl = P(), c = st.ciclo, n = pl.cols.length;
      return `<div class="sg-config">
      <section class="sis-tarjeta"><h2>Este mes</h2>
        ${pl.tipo === "mensual" ? `<div class="sis-par"><label class="sis-campo"><span>Mes</span><input data-ciclo="nombre" value="${escapar(c.nombre || "")}"></label>
          <label class="sis-campo"><span>N° de mes del contrato</span><input type="number" min="1" data-ciclo="mesContrato" value="${escapar(c.mesContrato || "")}"></label></div>
          <p class="sis-tenue">Carpeta del mes: <span class="mono" id="sg-carpeta-mes">${escapar(carpetaMes(c))}</span></p>` : ""}
        <label class="sis-campo"><span>Llegada de los datos</span><input type="date" data-ciclo="datos" value="${escapar(c.datos || "")}"></label>
      </section>
      <section class="sis-tarjeta"><h2>Plazo de entrega</h2>
        <label class="sis-check"><input type="radio" name="plazo" data-plazo="habiles" ${pl.plazo.tipo === "habiles" ? "checked" : ""}> <input type="number" min="1" max="60" data-plan="dias" value="${escapar(pl.plazo.dias || 10)}" class="sg-num" aria-label="Días hábiles"> días hábiles después de que llegan los datos</label>
        <label class="sis-check"><input type="radio" name="plazo" data-plazo="mes" ${pl.plazo.tipo === "mes" ? "checked" : ""}> Dentro de un mes desde que llegan los datos</label>
        <label class="sis-check"><input type="radio" name="plazo" data-plazo="ninguno" ${pl.plazo.tipo === "ninguno" ? "checked" : ""}> Sin plazo</label>
        <div class="sis-campo"><span>Tipo de trabajo</span><div class="sis-opciones">
          <label class="sis-opcion"><input type="radio" name="tipo" data-tipo="mensual" ${pl.tipo === "mensual" ? "checked" : ""}> Mensual</label>
          <label class="sis-opcion"><input type="radio" name="tipo" data-tipo="unico" ${pl.tipo === "unico" ? "checked" : ""}> Único</label></div></div>
      </section>
      <section class="sis-tarjeta"><h2>Columnas</h2>
        <p class="sis-tenue">De arriba hacia abajo = de izquierda a derecha. También se arrastran en la tabla. La nota va siempre al final.</p>
        ${pl.cols.map((col, i) => `<div class="sg-col-fila">
          <button type="button" class="sg-ico" data-acc="col-subir" data-v="${i}" aria-label="Subir ${escapar(col.nombre)}" ${i === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="sg-ico" data-acc="col-bajar" data-v="${i}" aria-label="Bajar ${escapar(col.nombre)}" ${i === n - 1 ? "disabled" : ""}>↓</button>
          <input data-col-nombre="${i}" value="${escapar(col.nombre)}" aria-label="Nombre de la columna">
          ${col.tipo === "producto" ? `<input class="mono" data-col-ext="${i}" value="${escapar(col.ext || "")}" placeholder=".ext" aria-label="Extensión del archivo">` : `<span class="sis-tenue">${col.tipo}</span>`}
          <label class="sg-vis"><input type="checkbox" data-col-vis="${i}" ${col.visible ? "checked" : ""}> ver</label>
          ${col.tipo === "producto" ? `<button type="button" class="sg-ico" data-acc="col-quitar" data-v="${i}" aria-label="Quitar ${escapar(col.nombre)}">✕</button>` : "<span></span>"}
        </div>`).join("")}
        <button type="button" class="sis-btn chico" data-acc="col-agregar">+ Agregar producto</button>
      </section>
      <section class="sis-tarjeta sg-config-ancho"><h2>Áreas y tramos</h2>
        ${pl.areas.map((a, i) => `<details class="sg-area-cfg"${pl.areas.length === 1 ? " open" : ""}><summary><b>${escapar(a.nombre)}</b> · ${a.tramos.length} tramo${a.tramos.length === 1 ? "" : "s"}</summary>
          <div class="sis-par"><label class="sis-campo"><span>Nombre</span><input data-area-nombre="${i}" value="${escapar(a.nombre)}"></label>
            <label class="sis-campo"><span>Carpeta del área</span><input class="mono" data-area-carpeta="${i}" value="${escapar(a.carpeta || "")}" placeholder="01 Línea de impulsión 4+900 - 160+000"></label></div>
          <label class="sis-campo"><span>Tramos (nombres de carpeta, uno por línea)</span><textarea rows="5" data-area-tramos="${i}" class="mono">${escapar(a.tramos.map((t) => t.carpeta || t.nombre).join("\n"))}</textarea></label>
          <div class="sis-acciones"><button type="button" class="sis-btn chico" data-acc="tramos-guardar" data-v="${i}">Actualizar tramos</button>
            ${pl.areas.length > 1 ? `<button type="button" class="sis-btn chico peligro" data-acc="area-quitar" data-v="${i}">Quitar área</button>` : ""}</div>
          <p class="sis-tenue">Los tramos con la misma carpeta conservan su avance; los nuevos parten vacíos.</p></details>`).join("")}
        <div class="sis-acciones"><button type="button" class="sis-btn chico" data-acc="area-agregar">+ Agregar área</button>
          <button type="button" class="sis-btn chico peligro" data-acc="plan-eliminar">Eliminar seguimiento</button></div>
      </section></div>`;
    }
    function cerrarFlotantes() {
      raiz.querySelectorAll(".sg-flot").forEach((x) => x.remove());
    }
    function menuEntrega(anchor, ids) {
      cerrarFlotantes();
      const r = anchor.getBoundingClientRect();
      const algunaCargada = ids.some((id) => est2(id).entrega);
      const sig = `E${st.entregas.length + 1}`;
      const div = document.createElement("div");
      div.className = "sg-flot";
      div.innerHTML = `<div class="sg-velo" data-acc="cerrar"></div><div class="sg-menu" role="menu" style="left:${Math.max(8, Math.min(r.left, innerWidth - 250))}px;top:${Math.min(r.bottom + 6, innerHeight - 230)}px">
      <div class="sis-tenue">Solo se cargan tramos con todo listo</div>
      ${st.entregas.map((e) => `<button type="button" role="menuitem" data-acc="ent-elegir" data-v="${escapar(e.codigo)}"><b>${escapar(e.codigo)}</b> · ${escapar(fechaLegible(e.fecha))}</button>`).join("")}
      <button type="button" role="menuitem" data-acc="ent-elegir" data-v="+">+ Nueva entrega (${sig} · hoy)</button>
      ${algunaCargada ? '<hr><button type="button" role="menuitem" data-acc="ent-elegir" data-v="-">Quitar de la entrega</button>' : ""}</div>`;
      div.dataset.ids = JSON.stringify(ids);
      raiz.appendChild(div);
      div.querySelector("[role=menuitem]").focus();
    }
    function panelNota(tr) {
      cerrarFlotantes();
      ocultarTooltip();
      const t = est2(tr.id);
      const div = document.createElement("div");
      div.className = "sg-flot";
      div.innerHTML = `<div class="sg-velo oscuro" data-acc="cerrar"></div><div class="sg-panel" role="dialog" aria-modal="true" aria-labelledby="sg-nota-tit">
      <div class="sis-tenue">${escapar(area2().nombre)}</div><h2 id="sg-nota-tit">Nota · ${escapar(tr.n)} · ${escapar(tr.nombre)}</h2>
      ${t.nota && t.notaPor ? `<p class="sis-tenue">Escrita por ${escapar(t.notaPor)}</p>` : ""}
      <label class="sis-campo"><span>Qué pasó o qué hay que recordar</span><textarea id="sg-nota-txt" rows="5" placeholder="Ej.: se cortó por viento, falta reprocesar el KMZ…">${escapar(t.nota)}</textarea></label>
      <div class="sis-acciones">${t.nota ? '<button type="button" class="sg-borrar" data-acc="nota-borrar">Borrar nota</button>' : ""}<span style="flex:1"></span>
        <button type="button" class="sis-btn" data-acc="cerrar">Cancelar</button><button type="button" class="sis-btn primario" data-acc="nota-guardar">Guardar</button></div></div>`;
      div.dataset.t = tr.id;
      raiz.appendChild(div);
      const ta = div.querySelector("textarea");
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
    const tramoDe = (id) => area2().tramos.find((t) => t.id === id);
    async function cargarEnEntrega(ids, codigo) {
      if (codigo === "+") {
        codigo = `E${st.entregas.length + 1}`;
        await guardarEntrega({ cicloId: st.ciclo.id, planId: st.plan.id, codigo, fecha: hoyISO() });
      }
      const listos = codigo === "-" ? ids : ids.filter((id) => todoListo(P(), est2(id)));
      const no = ids.length - listos.length;
      listos.forEach((id) => st.brillo.add(id));
      st.sel.clear();
      await aplicar(
        listos.map((id) => ({ tramoId: id, tipo: "entrega", valor: codigo === "-" ? "" : codigo })),
        codigo === "-" ? `${listos.length} tramo${listos.length === 1 ? "" : "s"} fuera de la entrega` : `${listos.length} tramo${listos.length === 1 ? "" : "s"} cargado${listos.length === 1 ? "" : "s"} en ${codigo}${no ? ` · ${no} aún no están listos` : ""}`
      );
    }
    async function lote(v) {
      const ids = [...st.sel], cambios = [];
      let saltados = 0;
      for (const id of ids) {
        const t = est2(id);
        if (v === "volado") {
          if (!volado(t)) cambios.push({ tramoId: id, tipo: "terreno", valor: hoyISO(), por: yo() });
          continue;
        }
        if (!volado(t)) {
          saltados++;
          continue;
        }
        productos(P()).forEach((c) => cambios.push({ tramoId: id, tipo: "prod", col: c.id, valor: v }));
        if (v !== "listo" && t.entrega) cambios.push({ tramoId: id, tipo: "entrega", valor: "" });
        if (v === "listo") st.brillo.add(id);
      }
      const n = ids.length - saltados;
      await aplicar(cambios, `${n} tramo${n === 1 ? "" : "s"} ${v === "volado" ? "marcados volados" : "marcados " + TEXTO_ESTADO[v]}${saltados ? ` · ${saltados} sin volar quedaron igual` : ""}`);
    }
    function moverCol(i, j) {
      const c = st.plan.cols;
      if (j < 0 || j >= c.length) return;
      [c[i], c[j]] = [c[j], c[i]];
    }
    raiz.addEventListener("click", async (ev) => {
      const el = ev.target.closest("[data-acc]");
      if (!el || !raiz.contains(el)) return;
      const acc = el.dataset.acc, v = el.dataset.v;
      const filaEl = el.closest("[data-t]");
      const tr = filaEl && !el.classList.contains("sg-seg") ? tramoDe(filaEl.dataset.t) : null;
      try {
        switch (acc) {
          case "tab":
            st.tab = v;
            st.sel.clear();
            st.revision = null;
            render();
            break;
          case "area":
            st.area = Number(v);
            st.sel.clear();
            st.filtro = "";
            render();
            break;
          case "filtro":
            st.filtro = st.filtro === v ? "" : v;
            render();
            break;
          case "plegar":
            st.plegar = el.checked;
            escribirLS("sg_plegar", st.plegar);
            render();
            break;
          case "grupo":
            st.abiertos.has(v) ? st.abiertos.delete(v) : st.abiertos.add(v);
            render();
            break;
          case "sel":
            if (tr) {
              el.checked ? st.sel.add(tr.id) : st.sel.delete(tr.id);
              render();
            }
            break;
          case "sel-todos":
            if (el.checked) area2().tramos.filter(pasaFiltro).forEach((t) => st.sel.add(t.id));
            else st.sel.clear();
            render();
            break;
          case "sel-limpiar":
            st.sel.clear();
            render();
            break;
          case "terreno":
            if (tr) {
              const t = est2(tr.id);
              await aplicar([{ tramoId: tr.id, tipo: "terreno", valor: volado(t) ? "" : hoyISO(), por: volado(t) ? "" : yo() }], volado(t) ? `${tr.n} quedó como no volado` : `${tr.n} marcado volado hoy`);
            }
            break;
          case "prod":
            if (tr) {
              const c = st.plan.cols.find((x) => x.id === el.dataset.col), t = est2(tr.id), sig = SIGUIENTE[estadoProd(t, c)];
              const cambios = [{ tramoId: tr.id, tipo: "prod", col: c.id, valor: sig }];
              if (sig !== "listo" && t.entrega) cambios.push({ tramoId: tr.id, tipo: "entrega", valor: "" });
              st.pop = `${tr.id}:${c.id}`;
              const queda = { ...t, prod: { ...t.prod, [c.id]: sig } };
              if (todoListo(P(), queda)) st.brillo.add(tr.id);
              await aplicar(cambios, null);
            }
            break;
          case "entrega":
            if (tr) menuEntrega(el, [tr.id]);
            break;
          case "lote":
            await lote(v);
            break;
          case "lote-entrega":
            menuEntrega(el, [...st.sel]);
            break;
          case "ent-elegir": {
            const f = el.closest(".sg-flot");
            const ids = JSON.parse(f.dataset.ids || "[]");
            cerrarFlotantes();
            await cargarEnEntrega(ids, v);
            break;
          }
          case "nota":
            if (tr) panelNota(tr);
            break;
          case "nota-guardar":
          case "nota-borrar": {
            const f = el.closest(".sg-flot"), id = f.dataset.t, texto3 = acc === "nota-borrar" ? "" : f.querySelector("textarea").value.trim();
            cerrarFlotantes();
            await aplicar([{ tramoId: id, tipo: "nota", valor: texto3, por: yo() }], texto3 ? "Nota guardada" : "Nota borrada");
            break;
          }
          case "cerrar":
            cerrarFlotantes();
            break;
          case "revision-aplicar": {
            const r = st.revision;
            st.revision = null;
            await aplicar(r.cambios, `${r.cambios.length} cambio${r.cambios.length === 1 ? "" : "s"} desde la carpeta`);
            break;
          }
          case "revision-cerrar":
            st.revision = null;
            render();
            break;
          case "ciclo": {
            const c = st.ciclos[Number(v)];
            if (c) {
              st.ciclo = c;
              st.sel.clear();
              await cargarEventos();
              render();
            }
            break;
          }
          case "nuevo-ciclo": {
            const ult = st.ciclos[0];
            let sig = ult ? mesSiguiente(ult.nombre, ult.mesContrato) : { nombre: nombreMes(hoyISO()), mesContrato: 1 };
            const proy = await obtenerProyecto(st.proyectoId), per = proy && proy.periodicidad && proy.periodicidad.tipo === "recurrente" ? proy.periodicidad : null;
            let extra = { datos: "" };
            if (per) {
              const c = ult && ult.mesContrato ? ciclosEntre(per, "1900-01-01", "2100-12-31").find((x) => x.n === Number(ult.mesContrato) + 1) : cicloDelMes(per, hoyISO());
              if (c) {
                sig = { nombre: c.nombre, mesContrato: c.n };
                extra = { datos: c.datos, entrega: c.entrega, terreno: c.terreno, diasEntrega: Number(per.diasEntrega) || 0 };
              }
            }
            st.ciclo = await guardarCiclo({ planId: st.plan.id, proyectoId: st.proyectoId, nombre: sig.nombre || "Mes nuevo", mesContrato: st.plan.tipo === "mensual" ? sig.mesContrato : null, ...extra });
            await recargar();
            avisarConDeshacer(`${st.ciclo.nombre} creado con los mismos tramos, sin avance`);
            break;
          }
          case "col-subir":
          case "col-bajar": {
            const i = Number(v);
            moverCol(i, acc === "col-subir" ? i - 1 : i + 1);
            await guardarPlan2(st.plan);
            render();
            break;
          }
          case "col-quitar": {
            const c = st.plan.cols.splice(Number(v), 1)[0];
            await guardarPlan2(st.plan);
            render();
            avisarConDeshacer(`Columna ${c.nombre} quitada`, async () => {
              st.plan.cols.splice(Number(v), 0, c);
              await guardarPlan2(st.plan);
              render();
            });
            break;
          }
          case "col-agregar": {
            const k = st.plan.cols.findIndex((c) => c.tipo === "entrega");
            st.plan.cols.splice(k < 0 ? st.plan.cols.length : k, 0, { id: "p" + nuevoId().slice(0, 8), tipo: "producto", nombre: "Nuevo", ext: "", ancho: 70, visible: true });
            await guardarPlan2(st.plan);
            render();
            break;
          }
          case "tramos-guardar": {
            const i = Number(v), a = st.plan.areas[i], ta = raiz.querySelector(`[data-area-tramos="${i}"]`);
            const nuevos = tramosDesdeCarpetas(ta.value, nuevoId);
            const previos = new Map(a.tramos.map((t) => [t.carpeta || t.nombre, t]));
            a.tramos = nuevos.map((t) => {
              const p = previos.get(t.carpeta);
              return p ? { ...t, id: p.id } : t;
            });
            await guardarPlan2(st.plan);
            render();
            avisarConDeshacer(`${a.nombre}: ${a.tramos.length} tramos`);
            break;
          }
          case "area-agregar":
            st.plan.areas.push({ id: nuevoId(), nombre: `Área ${st.plan.areas.length + 1}`, carpeta: "", tramos: [{ id: nuevoId(), n: "001", nombre: "Tramo 1", carpeta: "" }] });
            await guardarPlan2(st.plan);
            render();
            break;
          case "area-quitar": {
            const i = Number(v), a = st.plan.areas.splice(i, 1)[0];
            st.area = 0;
            await guardarPlan2(st.plan);
            render();
            avisarConDeshacer(`Área ${a.nombre} quitada`, async () => {
              st.plan.areas.splice(i, 0, a);
              await guardarPlan2(st.plan);
              render();
            });
            break;
          }
          case "plan-eliminar": {
            if (el.dataset.confirmar !== "si") {
              el.dataset.confirmar = "si";
              el.textContent = "Toca de nuevo para eliminar (queda en la papelera)";
              break;
            }
            await eliminarPlan2(st.plan.id);
            location.hash = "#/seguimiento";
            break;
          }
        }
      } catch (e) {
        console.error(e);
        avisarConDeshacer(`No se pudo: ${e.message}`);
      }
    });
    raiz.addEventListener("change", async (ev) => {
      const t = ev.target;
      try {
        if (t.dataset.archivo === "carpeta" && t.files && t.files.length) {
          const rutas = [...t.files].map((f) => f.webkitRelativePath || f.name);
          st.revision = { ...revisarArchivos(st.plan, st.est, rutas), archivos: rutas.length };
          t.value = "";
          render();
          return;
        }
        if (t.dataset.plazo) {
          st.plan.plazo.tipo = t.dataset.plazo;
          await guardarPlan2(st.plan);
          return;
        }
        if (t.dataset.tipo) {
          st.plan.tipo = t.dataset.tipo;
          await guardarPlan2(st.plan);
          render();
          return;
        }
        if (t.dataset.colVis != null) {
          st.plan.cols[Number(t.dataset.colVis)].visible = t.checked;
          await guardarPlan2(st.plan);
          return;
        }
        if (t.dataset.ciclo === "datos") {
          st.ciclo.datos = t.value;
          if (st.ciclo.entrega && t.value) st.ciclo.entrega = sumarHabiles2(t.value, st.ciclo.diasEntrega || 0);
          await guardarCiclo(st.ciclo);
          render();
          return;
        }
      } catch (e) {
        console.error(e);
        avisarConDeshacer(`No se pudo: ${e.message}`);
      }
    });
    raiz.addEventListener("input", (ev) => {
      const t = ev.target;
      if (t.dataset.ciclo && t.dataset.ciclo !== "datos") {
        st.ciclo[t.dataset.ciclo] = t.dataset.ciclo === "mesContrato" ? Number(t.value) || null : t.value;
        const m = raiz.querySelector("#sg-carpeta-mes");
        if (m) m.textContent = carpetaMes(st.ciclo);
        clearTimeout(timerCiclo);
        timerCiclo = setTimeout(() => guardarCiclo(st.ciclo), 500);
        return;
      }
      if (t.dataset.plan === "dias") {
        st.plan.plazo.dias = Number(t.value) || 1;
        guardarPlanLuego();
        return;
      }
      if (t.dataset.colNombre != null) {
        st.plan.cols[Number(t.dataset.colNombre)].nombre = t.value;
        guardarPlanLuego();
        return;
      }
      if (t.dataset.colExt != null) {
        let x = t.value.trim();
        if (x && !x.startsWith(".")) x = "." + x;
        st.plan.cols[Number(t.dataset.colExt)].ext = x;
        guardarPlanLuego();
        return;
      }
      if (t.dataset.areaNombre != null) {
        st.plan.areas[Number(t.dataset.areaNombre)].nombre = t.value;
        guardarPlanLuego();
        return;
      }
      if (t.dataset.areaCarpeta != null) {
        st.plan.areas[Number(t.dataset.areaCarpeta)].carpeta = t.value.trim();
        guardarPlanLuego();
      }
    });
    raiz.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const form = ev.target;
      if (form.dataset.form !== "nuevo") return;
      try {
        await crear(new FormData(form));
        await recargar();
        avisarConDeshacer("Seguimiento creado");
      } catch (e) {
        console.error(e);
        avisarConDeshacer(`No se pudo crear: ${e.message}`);
      }
    });
    const alTecla = (ev) => {
      if (ev.key === "Escape") cerrarFlotantes();
    };
    document.addEventListener("keydown", alTecla);
    const quitarTips = activarTooltips(raiz, (el) => {
      if (el.dataset.tip === "nota") {
        const tr2 = tramoDe(el.closest("[data-t]").dataset.t);
        const t = tr2 && est2(tr2.id);
        return t ? `<b>Nota · ${escapar(tr2.n)}</b>
${escapar(t.nota)}${t.notaPor ? `
<span style="opacity:.75">${escapar(t.notaPor)}</span>` : ""}
<span style="opacity:.75">Toca para editar</span>` : "";
      }
      const a = st.plan && st.plan.areas[Number(el.dataset.a)];
      const tr = a && a.tramos.find((x) => x.id === el.dataset.t);
      return tr ? textoTramo(tr) : "";
    });
    const quitarColumnas = columnasArrastrables(raiz, {
      caja: () => raiz.querySelector(".sg-scroll"),
      ancho: (id) => st.plan.cols.find((c) => c.id === id).ancho,
      alAncho: (id, w) => {
        st.plan.cols.find((c) => c.id === id).ancho = w;
        aplicarPlantilla();
      },
      alSoltarAncho: async (id, w) => {
        await guardarPlan2(st.plan);
        avisarConDeshacer(`Ancho de ${st.plan.cols.find((c) => c.id === id).nombre}: ${w} px`);
      },
      alMover: async (id, destino) => {
        const vis = colsVis().map((c) => c.id), antes = vis.join();
        const resto = vis.filter((x) => x !== id);
        resto.splice(destino, 0, id);
        if (resto.join() === antes) {
          render();
          return;
        }
        const previo = st.plan.cols.slice();
        st.plan.cols = [...resto.map((x) => st.plan.cols.find((c) => c.id === x)), ...st.plan.cols.filter((c) => !c.visible)];
        await guardarPlan2(st.plan);
        render();
        avisarConDeshacer(`Columna ${st.plan.cols.find((c) => c.id === id).nombre} movida`, async () => {
          st.plan.cols = previo;
          await guardarPlan2(st.plan);
          render();
        });
      }
    });
    recargar().catch((e) => {
      console.error(e);
      raiz.innerHTML = `<div class="sis-error">No se pudo cargar el seguimiento: ${escapar(e.message)}</div>`;
    });
    return {
      desmontar() {
        activo2 = false;
        if (timerPlan) {
          clearTimeout(timerPlan);
          guardarPlan2(st.plan);
        }
        if (timerCiclo) {
          clearTimeout(timerCiclo);
          guardarCiclo(st.ciclo);
        }
        quitarTips();
        quitarColumnas();
        document.removeEventListener("keydown", alTecla);
        raiz.remove();
      },
      refrescar() {
        recargar();
      }
    };
  }

  // modulos/seguimiento/seguimiento.js
  var ALMACENES2 = Object.values(ALM4);
  var iniciado2 = false;
  function iniciar3({ personaId } = {}) {
    if (!iniciado2) {
      iniciarDatos3({ personaId: personaId != null ? personaId : null });
      iniciado2 = true;
    } else if (personaId !== void 0) fijarPersona3(personaId);
  }
  function montar2(contenedor2, contexto) {
    iniciar3({ personaId: contexto.personaId });
    return montarPantallas2(contenedor2, contexto);
  }
  async function resumenDeProyecto(proyectoId) {
    iniciar3();
    const plan = await planDeProyecto(proyectoId);
    if (!plan) return null;
    const ciclo = (await ciclosDePlan(plan.id))[0] || null;
    const tramos = plan.areas.flatMap((a) => a.tramos);
    const est2 = ciclo ? estadoCiclo(await eventosDeCiclo(ciclo.id)) : {};
    return { plan, ciclo, cuenta: cuenta(plan, est2, tramos), plazo: plazoCiclo(plan, ciclo, hoyISO()) };
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

  // modulos/vuelos/formatos.js
  var FORMATOS_CAMINO = ".kml,.kmz,.zip,.shp,.dbf,.prj,.cpg,.geojson,.json,.gpx";
  async function lineasDeArchivos(archivos) {
    const lista = [...archivos];
    const shp = lista.find((f) => /\.shp$/i.test(f.name));
    if (shp) {
      const par = (ext) => lista.find((f) => f.name.toLowerCase() === shp.name.toLowerCase().replace(/\.shp$/, ext));
      const leerBuf = async (f) => f ? new Uint8Array(await f.arrayBuffer()) : null;
      const leerTxt = async (f) => f ? f.text() : "";
      return lineasDeShapefile({ shp: await leerBuf(shp), dbf: await leerBuf(par(".dbf")), prj: await leerTxt(par(".prj")), cpg: await leerTxt(par(".cpg")), nombre: shp.name });
    }
    const out = { lineas: [], aviso: "" };
    for (const f of lista) {
      const r = await lineasDeUnArchivo(f);
      out.lineas.push(...r.lineas);
      if (r.aviso) out.aviso = r.aviso;
    }
    return out;
  }
  async function lineasDeUnArchivo(f) {
    const nombre = f.name;
    if (/\.(geo)?json$/i.test(nombre)) return { lineas: lineasDeGeoJSON(JSON.parse(await f.text()), nombre) };
    if (/\.gpx$/i.test(nombre)) return { lineas: lineasDeGpx(await f.text(), nombre) };
    if (/\.zip$/i.test(nombre)) {
      const ent = leerZip(new Uint8Array(await f.arrayBuffer()));
      const e = (ext) => ent.find((x) => new RegExp(`\\.${ext}$`, "i").test(x.nombre) && !/__MACOSX/.test(x.nombre));
      const shp = e("shp");
      if (shp) {
        const base = shp.nombre.replace(/\.shp$/i, "").toLowerCase();
        const par = (ext) => ent.find((x) => x.nombre.toLowerCase() === `${base}.${ext}`) || e(ext);
        const dec = async (x) => x ? new TextDecoder().decode(await x.datos()) : "";
        return lineasDeShapefile({ shp: await shp.datos(), dbf: par("dbf") ? await par("dbf").datos() : null, prj: await dec(par("prj")), cpg: await dec(par("cpg")), nombre: shp.nombre.split("/").pop() });
      }
      const kml = e("kml");
      if (kml) return { lineas: analizarKml(new TextDecoder().decode(await kml.datos()), nombre).ejes.map((l) => ({ nombre: l.nombre || nombre, linea: l.linea })) };
      const gj = e("geojson") || e("json");
      if (gj) return { lineas: lineasDeGeoJSON(JSON.parse(new TextDecoder().decode(await gj.datos())), nombre) };
      throw new Error("El zip no trae un shapefile (.shp), KML ni GeoJSON.");
    }
    if (/\.(dbf|prj|cpg)$/i.test(nombre)) return { lineas: [] };
    return { lineas: analizarKml(await leerArchivo(f), nombre).ejes.map((l) => ({ nombre: l.nombre || nombre, linea: l.linea })) };
  }
  function lineasDeGeoJSON(json, nombreArchivo = "") {
    const out = [];
    const nom = (p) => p && (p.name || p.nombre || p.Name || p.NOMBRE || p.ROL || p.rol) || nombreArchivo;
    const agregar = (g, nombre) => {
      if (!g) return;
      const c2 = (l) => l.map((c) => [c[0], c[1]]);
      if (g.type === "LineString") out.push({ nombre, linea: c2(g.coordinates) });
      else if (g.type === "MultiLineString") g.coordinates.forEach((l) => out.push({ nombre, linea: c2(l) }));
      else if (g.type === "GeometryCollection") g.geometries.forEach((x) => agregar(x, nombre));
    };
    if (json.type === "FeatureCollection") for (const f of json.features || []) agregar(f.geometry, String(nom(f.properties)));
    else if (json.type === "Feature") agregar(json.geometry, String(nom(json.properties)));
    else agregar(json, nombreArchivo);
    return out.filter((l) => l.linea.length >= 2);
  }
  function lineasDeGpx(xml, nombreArchivo = "") {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const out = [];
    const pts = (el, tag) => [...el.getElementsByTagNameNS("*", tag)].map((p) => [Number(p.getAttribute("lon")), Number(p.getAttribute("lat"))]).filter((c) => c.every(isFinite));
    const nom = (el) => {
      const n = [...el.children].find((c) => c.localName === "name");
      return n ? n.textContent.trim() : nombreArchivo;
    };
    for (const t of doc.getElementsByTagNameNS("*", "trk")) for (const seg of t.getElementsByTagNameNS("*", "trkseg")) out.push({ nombre: nom(t), linea: pts(seg, "trkpt") });
    for (const r of doc.getElementsByTagNameNS("*", "rte")) out.push({ nombre: nom(r), linea: pts(r, "rtept") });
    return out.filter((l) => l.linea.length >= 2);
  }
  function lineasDeShapefile({ shp, dbf, prj, cpg, nombre = "" }) {
    const geoms = leerShp(shp);
    const nombres = dbf ? nombresDbf(dbf, cpg) : [];
    const proy = proyeccionDePrj(prj, geoms);
    const lineas = [];
    geoms.forEach((partes, k) => partes.forEach((pts) => {
      if (pts.length >= 2) lineas.push({ nombre: nombres[k] || `${nombre.replace(/\.shp$/i, "")} ${k + 1}`, linea: pts.map(proy.aLonLat) });
    }));
    return { lineas, aviso: proy.aviso };
  }
  function leerShp(buf) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (dv.getInt32(0, false) !== 9994) throw new Error("El .shp no es un shapefile válido.");
    const largo2 = dv.getInt32(24, false) * 2, tipo = dv.getInt32(32, true);
    if (![3, 5, 13, 15, 23, 25].includes(tipo)) throw new Error("El shapefile no trae líneas: es de puntos u otro tipo.");
    const out = [];
    let p = 100;
    while (p + 8 <= Math.min(largo2, buf.length)) {
      const lc = dv.getInt32(p + 4, false) * 2, c = p + 8;
      const t = dv.getInt32(c, true);
      const partes = [];
      if (t !== 0) {
        const nPartes = dv.getInt32(c + 36, true), nPts = dv.getInt32(c + 40, true);
        const ini = [];
        for (let i = 0; i < nPartes; i++) ini.push(dv.getInt32(c + 44 + 4 * i, true));
        const base = c + 44 + 4 * nPartes;
        for (let i = 0; i < nPartes; i++) {
          const a = ini[i], b = i + 1 < nPartes ? ini[i + 1] : nPts, pts = [];
          for (let j = a; j < b; j++) pts.push([dv.getFloat64(base + 16 * j, true), dv.getFloat64(base + 16 * j + 8, true)]);
          partes.push(pts);
        }
      }
      out.push(partes);
      p = c + lc;
    }
    return out;
  }
  function nombresDbf(buf, cpg = "") {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const n = dv.getUint32(4, true), largoCab = dv.getUint16(8, true), largoReg = dv.getUint16(10, true);
    const dec = new TextDecoder(/utf-?8/i.test(cpg) ? "utf-8" : "windows-1252");
    const campos = [];
    for (let p = 32, off = 1; p < largoCab - 1 && buf[p] !== 13; p += 32) {
      const nombre = dec.decode(buf.subarray(p, p + 11)).replace(/\0.*$/, "").trim();
      const tipo = String.fromCharCode(buf[p + 11]), largo2 = buf[p + 16];
      campos.push({ nombre, tipo, off, largo: largo2 });
      off += largo2;
    }
    const pref = ["NOMBRE", "NOMBRE_CAM", "NAME", "ROL", "ROL_LABEL", "CODIGO", "COD", "ID"];
    const campo2 = pref.map((x) => campos.find((c) => c.nombre.toUpperCase() === x)).find(Boolean) || campos.find((c) => c.tipo === "C");
    if (!campo2) return [];
    const out = [];
    for (let i = 0; i < n; i++) {
      const ini = largoCab + i * largoReg + campo2.off;
      out.push(dec.decode(buf.subarray(ini, ini + campo2.largo)).trim());
    }
    return out;
  }
  var WGS84 = { a: 6378137, f: 1 / 298.257223563 };
  function proyeccionDePrj(prj, geoms = []) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    const wkt = (prj || "").trim();
    if (wkt && !/PROJCS|PROJCRS/i.test(wkt)) return { aLonLat: (p2) => [p2[0], p2[1]], aviso: "" };
    let tm = null;
    if (wkt) {
      const par = (n) => {
        const m = wkt.match(new RegExp(`PARAMETER\\[\\s*"${n}"\\s*,\\s*(-?[\\d.]+)`, "i"));
        return m ? Number(m[1]) : null;
      };
      const cm = (_b = (_a = par("central_meridian")) != null ? _a : par("longitude_of_origin")) != null ? _b : par("Longitude of natural origin");
      const zona = wkt.match(/UTM[ _]?zone[ _]?(\d{1,2})\s*([NS])?/i);
      if (cm != null) tm = { lon0: cm, k0: (_d = (_c = par("scale_factor")) != null ? _c : par("Scale factor at natural origin")) != null ? _d : 0.9996, fe: (_f = (_e = par("false_easting")) != null ? _e : par("False easting")) != null ? _f : 5e5, fn: (_h = (_g = par("false_northing")) != null ? _g : par("False northing")) != null ? _h : 0, lat0: (_i = par("latitude_of_origin")) != null ? _i : 0 };
      else if (zona) tm = utm(Number(zona[1]), (zona[2] || "S").toUpperCase() === "S");
      if (!tm) throw new Error("No reconozco la proyección del .prj: exporta el shapefile en WGS84 (geográficas) o en UTM.");
      const aviso = /PSAD|SAD.?69|Provisional_S_American/i.test(wkt) ? "El shapefile está en PSAD56/SAD69: se convirtió sin cambio de datum (puede desplazarse unos 200 m)." : "";
      return { aLonLat: (p2) => tmInversa(p2[0], p2[1], tm), aviso };
    }
    const p = geoms.flat(2)[0];
    if (!p || Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90) return { aLonLat: (q) => [q[0], q[1]], aviso: "" };
    tm = utm(19, true);
    return { aLonLat: (q) => tmInversa(q[0], q[1], tm), aviso: "El shapefile no trae .prj: se asumió UTM 19 Sur (WGS84). Revisa que el camino caiga en su lugar." };
  }
  var utm = (zona, sur) => ({ lon0: zona * 6 - 183, k0: 0.9996, fe: 5e5, fn: sur ? 1e7 : 0, lat0: 0 });
  function tmInversa(x, y, { lon0, k0, fe, fn, lat0 = 0 }) {
    const { a, f } = WGS84, e2 = f * (2 - f), ep2 = e2 / (1 - e2), rad = Math.PI / 180;
    const M = (phi) => a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi) + (15 * e2 * e2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) - 35 * e2 ** 3 / 3072 * Math.sin(6 * phi));
    const m = M(lat0 * rad) + (y - fn) / k0;
    const mu = m / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256));
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    const phi1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + 151 * e1 ** 3 / 96 * Math.sin(6 * mu) + 1097 * e1 ** 4 / 512 * Math.sin(8 * mu);
    const s = Math.sin(phi1), c = Math.cos(phi1), t = Math.tan(phi1);
    const C1 = ep2 * c * c, T1 = t * t, N1 = a / Math.sqrt(1 - e2 * s * s), R1 = a * (1 - e2) / (1 - e2 * s * s) ** 1.5, D = (x - fe) / (N1 * k0);
    const lat = phi1 - N1 * t / R1 * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
    const lon = lon0 * rad + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / c;
    return [lon / rad, lat / rad];
  }

  // modulos/vuelos/cortes.js
  var METODOS = {
    medida: { texto: "Cortes a medida", grupo: "lineal", ayuda: "Cortes fijos en los DM que elijas (escritos o marcados en el eje) y, después del último, cortes cada X m o km hasta el fin del eje. El último sector termina en el fin del eje." },
    distancia: { texto: "Por distancia", grupo: "lineal", ayuda: "Cortes perpendiculares al eje cada X m o km, desde el inicio del eje." },
    superficie: { texto: "Por superficie", grupo: "lineal", ayuda: "Cortes perpendiculares al eje para que cada sector tenga la superficie indicada." },
    dm: { texto: "Alineados al DM", grupo: "lineal", ayuda: "Cortes en DM redondos (cada 1 km: 11+000, 12+000…) o desde un primer DM. Necesita el DM del inicio del eje (pestaña Forma)." },
    tramos: { texto: "Tramos del Seguimiento", grupo: "lineal", ayuda: "Corta en los DM de inicio y fin de los tramos del Seguimiento del proyecto de la hoja. Necesita el DM del inicio del eje." },
    n: { texto: "En N sectores", grupo: "todas", ayuda: "Cortes rectos y paralelos, con la dirección que elijas, que dividen el área en N sectores de igual superficie (o igual distancia)." },
    baterias: { texto: "Por baterías", grupo: "todas", ayuda: "Corta para que cada sector se vuele con esa cantidad de baterías o menos, con el despegue al centro del sector." },
    dias: { texto: "Por días de vuelo", grupo: "todas", ayuda: "Arma un sector por día según las horas de vuelo que tienes por día (incluye traslados y cambios de batería)." },
    cerrados: { texto: "Por polígonos cerrados", grupo: "todas", ayuda: "Para áreas irregulares: corta desde los vértices cóncavos (las esquinas hacia adentro) siguiendo la prolongación de sus lados, para dejar sectores lo más rectangulares posible. Cada sector propone su dirección de vuelo." },
    vertices: { texto: "Manual por vértices", grupo: "manual", ayuda: "Toca un vértice del área y luego otro: el corte une ambos vértices. Repite para cada corte." },
    manual: { texto: "Manual (trazado libre)", grupo: "manual", ayuda: "Traza el corte por un camino, quebrada o cerco: toca afuera del área, sigue el borde tocando puntos y termina afuera." }
  };
  function formaDe(hoja2) {
    const a = hoja2.area, g = geometria(hoja2);
    if (!g) return null;
    if (g.tipo === "corredor") {
      const ancho = g.izq + g.der, L = largo(g.eje);
      return { lineal: true, corredor: true, largo: L, anchoMin: ancho, anchoProm: ancho, anchoMax: ancho };
    }
    const clave2 = JSON.stringify([a.original && a.original.anillo.length, a.original && a.original.anillo[0], a.margen, a.rectas]);
    if (!a.ejeCalc || a.ejeCalc.clave !== clave2) {
      const e = ejeDePoligono(g.vuelo);
      a.ejeCalc = e && esAreaLineal(e) ? {
        clave: clave2,
        linea: e.eje.map(g.marco.aLonLat),
        largo: e.largo,
        anchoMin: e.anchoMin,
        anchoProm: e.anchoProm,
        anchoMax: e.anchoMax,
        perfil: e.anchos.filter((_, k, arr) => k % Math.max(1, Math.ceil(arr.length / 400)) === 0 || k === arr.length - 1).map((p) => [Math.round(p.s * 10) / 10, Math.round(p.ancho * 10) / 10])
      } : { clave: clave2, linea: null };
    }
    const c = a.ejeCalc;
    return c.linea ? { lineal: true, corredor: false, largo: c.largo, anchoMin: c.anchoMin, anchoProm: c.anchoProm, anchoMax: c.anchoMax } : { lineal: false, corredor: false };
  }
  var metodoPropuesto = (forma) => forma && forma.lineal ? "medida" : "n";
  var METODOS_LINEALES = ["medida", "distancia", "superficie", "dm", "tramos"];
  function ejeDe(hoja2, g) {
    const a = hoja2.area;
    if (g.tipo === "corredor") {
      const eje2 = a.eje.linea.map(g.marco.aXY), L2 = largo(eje2), ancho = g.izq + g.der;
      return { eje: eje2, L: L2, perfil: [{ s: 0, ancho }, { s: L2, ancho }], semi: () => Math.max(g.izq, g.der) + 40, izq: g.izq, der: g.der };
    }
    if (!a.ejeCalc || !a.ejeCalc.linea) return null;
    const eje = a.ejeCalc.linea.map(g.marco.aXY), L = largo(eje);
    const perfil = a.ejeCalc.perfil.map(([s, ancho]) => ({ s: s * L / (a.ejeCalc.largo || L), ancho }));
    const medio = a.ejeCalc.anchoProm / 2;
    return { eje, L, perfil, semi: (s) => anchoEn(perfil, s) * 0.6 + 30, izq: medio, der: medio };
  }
  function rumboCortesPropuesto(hoja2) {
    const g = geometria(hoja2);
    return g ? (rumboLadoLargo(g.vuelo) + 90) % 180 : 0;
  }
  var metros = (v, u) => Number(String(v).replace(",", ".")) * (u === "km" ? 1e3 : 1);
  var m2De = (v, u) => Number(String(v).replace(",", ".")) * (u === "km2" ? 1e6 : 1e4);
  function kmCortesAMedida(kmIni, kmFin, fijosKm, cada) {
    const sube = kmFin >= kmIni, dentro = (k) => sube ? k > kmIni + 1e-6 && k < kmFin - 1e-6 : k < kmIni - 1e-6 && k > kmFin + 1e-6;
    const orden = (x, y) => sube ? x - y : y - x;
    const fijos = [...new Set(fijosKm.filter((k) => k != null && isFinite(k)).map((k) => Math.round(k * 1e3) / 1e3))].filter(dentro).sort(orden);
    const out = [...fijos];
    const paso = Number(cada) / 1e3;
    if (paso > 5e-4) {
      let k = (fijos.length ? fijos[fijos.length - 1] : kmIni) + (sube ? paso : -paso);
      for (let n = 0; dentro(k) && n < 2e3; n++) {
        out.push(Math.round(k * 1e3) / 1e3);
        k += sube ? paso : -paso;
      }
    }
    return out;
  }
  function kmExtremos(hoja2, e) {
    const a = hoja2.area;
    return [kmEnEje(a, a.dm && a.dm.inv ? e.L : 0, e.L), kmEnEje(a, a.dm && a.dm.inv ? 0 : e.L, e.L)];
  }
  function distanciasLineales(hoja2, e, au, extra) {
    const a = hoja2.area, dm = a.dm || {}, inv = !!dm.inv, L = e.L;
    const espejo = (arr) => inv ? arr.map((s) => L - s).sort((x, y) => x - y) : arr;
    if (au.modo === "medida") {
      const [k0, k1] = kmExtremos(hoja2, e);
      const fijos = (au.fijos || []).map(dmAKm);
      return kmCortesAMedida(k0, k1, fijos, metros(au.cada || 5, au.unidad || "km")).map((k) => sDeKm(a, k, L)).filter((s) => s > 1 && s < L - 1).sort((x, y) => x - y);
    }
    if (au.modo === "distancia") return espejo(distanciasCorte(L, { modo: "inicio", cada: metros(au.cada || 5, au.unidad || "km") }));
    if (au.modo === "superficie") {
      const perfil = inv ? e.perfil.map((p) => ({ s: L - p.s, ancho: p.ancho })).reverse() : e.perfil;
      return espejo(distanciasPorSuperficie(perfil, L, m2De(au.sup || 50, au.unidadSup || "ha")));
    }
    if (au.modo === "dm") return espejo(distanciasCorte(L, { modo: "dm", cada: metros(au.cada || 1, au.unidad || "km"), dmInicio: dm.inicio, desc: !!dm.desc, primerDM: extra.primerDM }));
    if (au.modo === "tramos") return espejo(distanciasCorte(L, { modo: "tramos", dmInicio: dm.inicio, desc: !!dm.desc, tramosKm: extra.tramosKm || [] }));
    return [];
  }
  function tramosVistaPrevia(hoja2) {
    const g = geometria(hoja2), au = hoja2.area.auto || {};
    if (!g) return null;
    formaDe(hoja2);
    const e = ejeDe(hoja2, g);
    if (!e) return null;
    const [k0, k1] = kmExtremos(hoja2, e);
    const cortes = kmCortesAMedida(k0, k1, (au.fijos || []).map(dmAKm), metros(au.cada || 5, au.unidad || "km"));
    const pts = [k0, ...cortes, k1];
    return { inicio: k0, fin: k1, tramos: pts.slice(1).map((k, i) => [pts[i], k]).map(([x, y]) => `${kmADm(Math.min(x, y))} – ${kmADm(Math.max(x, y))}`) };
  }
  function cortesEnDistancias(g, e, distancias) {
    return distancias.flatMap((s) => cortesTransversales(e.eje, [s], e.semi(s))).map((c) => c.map(g.marco.aLonLat));
  }
  function vistaPrevia(hoja2) {
    var _a;
    const g = geometria(hoja2), au = hoja2.area.auto || {};
    if (!g) return null;
    const modo = au.modo === "inicio" ? "distancia" : au.modo || metodoPropuesto(formaDe(hoja2));
    if (modo === "n") {
      const n2 = Math.max(2, Math.min(60, Number(au.n) || 4));
      return { sectores: n2, haPorSector: g.areaVuelo / n2 / 1e4 };
    }
    if (!METODOS_LINEALES.includes(modo)) return null;
    formaDe(hoja2);
    const e = ejeDe(hoja2, g);
    if (!e) return null;
    if ((modo === "dm" || modo === "tramos") && (!hoja2.area.dm || hoja2.area.dm.inicio == null)) return null;
    if (modo === "tramos") return null;
    const n = distanciasLineales(hoja2, e, { ...au, modo }, { primerDM: (_a = au.primerKm) != null ? _a : null }).length + 1;
    return { sectores: n, haPorSector: g.areaVuelo / n / 1e4 };
  }
  function generarCortes(hoja2, extra = {}) {
    const g0 = geometria(hoja2), au = hoja2.area.auto || {};
    if (!g0) throw new Error("Primero carga o dibuja el área.");
    const sinCortes = { ...hoja2, area: { ...hoja2.area, cortes: [], sectores: [] } };
    const g = geometria(sinCortes);
    const forma = formaDe(hoja2);
    const modo = au.modo || metodoPropuesto(forma);
    const d = extra.dron;
    if (METODOS_LINEALES.includes(modo)) {
      const e = forma && forma.lineal ? ejeDe(hoja2, g) : null;
      if (!e) throw new Error("Este método usa el eje del área y el área no es lineal. Usa «En N sectores».");
      if ((modo === "dm" || modo === "tramos") && (!hoja2.area.dm || hoja2.area.dm.inicio == null)) throw new Error("Escribe primero el DM del inicio del eje (pestaña Forma), por ejemplo 10+000.");
      const dist2 = distanciasLineales(hoja2, e, au, extra);
      if (!dist2.length && modo === "medida") return { cortes: [], nota: "Con esos datos no hay cortes dentro del eje: queda un solo sector." };
      if (!dist2.length) throw new Error(modo === "tramos" ? "Ningún DM de los tramos cae dentro del eje: revisa el DM del inicio y si baja." : "Con esos datos no hay cortes dentro del área.");
      return { cortes: cortesEnDistancias(g, e, dist2) };
    }
    if (modo === "n") {
      const n = Math.max(2, Math.min(60, Number(au.n) || 4));
      const rumbo2 = au.rumbo === "" || au.rumbo == null ? rumboCortesPropuesto(hoja2) : Number(au.rumbo);
      if (g.tipo === "corredor") {
        const e = ejeDe(hoja2, g);
        return { cortes: cortesEnDistancias(g, e, Array.from({ length: n - 1 }, (_, k) => e.L * (k + 1) / n)) };
      }
      return { cortes: cortesParalelos(g.vuelo, n, rumbo2, { igualSuperficie: au.igual !== false }).map((c) => c.map(g.marco.aLonLat)) };
    }
    if (modo === "baterias") {
      if (!d) throw new Error("Elige el dron.");
      const n = Math.max(1, Number(au.bat) || 4);
      if (forma && forma.lineal) {
        const e = ejeDe(hoja2, g);
        const dist2 = g.tipo === "corredor" ? distanciasPorBaterias(sinCortes, d, n) : distanciasPorBaterias(sinCortes, d, n, { eje: e.eje, izq: e.izq, der: e.der });
        if (!dist2.length) return { cortes: [], nota: `Toda el área se vuela con ${n} batería${n === 1 ? "" : "s"} o menos: no hace falta cortar.` };
        return { cortes: cortesEnDistancias(g, e, dist2) };
      }
      return buscarN(hoja2, sinCortes, g, (r) => r.vuelos <= n, `Toda el área se vuela con ${n} batería${n === 1 ? "" : "s"} o menos: no hace falta cortar.`, d);
    }
    if (modo === "dias") {
      if (!d) throw new Error("Elige el dron.");
      const horas = Number(String(au.horas || 6).replace(",", "."));
      if (!(horas > 0)) throw new Error("Escribe las horas de vuelo por día.");
      return buscarN(hoja2, sinCortes, g, (r) => r.minTotal <= horas * 60, "Toda el área cabe en un día de vuelo: no hace falta cortar.", d);
    }
    if (modo === "cerrados") {
      if (g.tipo === "corredor") throw new Error("El corredor ya se corta a lo largo del eje: usa «En N sectores» o un método lineal.");
      const c = cortesCerrados(g.vuelo);
      if (!c.length) return { cortes: [], nota: "El área ya es casi rectangular (o sus esquinas hacia adentro son muy chicas): no hace falta cortarla. Usa «Manual por vértices» si quieres otro corte." };
      return { cortes: c.map((x) => x.map(g.marco.aLonLat)) };
    }
    if (modo === "vertices") throw new Error("Con «Manual por vértices» se tocan dos vértices del área en el mapa («Tocar vértices»).");
    throw new Error("Con el método manual se traza cada corte en el mapa («Trazar corte»).");
  }
  function buscarN(hoja2, sinCortes, g, cumple, notaUno, d) {
    const forma = formaDe(hoja2), au = hoja2.area.auto || {};
    const e = forma && forma.lineal ? ejeDe(hoja2, g) : null;
    const rumbo2 = au.rumbo === "" || au.rumbo == null ? rumboCortesPropuesto(hoja2) : Number(au.rumbo);
    const cortesN = (n) => {
      if (n <= 1) return [];
      if (e) return cortesEnDistancias(g, e, Array.from({ length: n - 1 }, (_, k) => e.L * (k + 1) / n));
      return cortesParalelos(g.vuelo, n, rumbo2, { igualSuperficie: true }).map((c) => c.map(g.marco.aLonLat));
    };
    const ok = (n) => {
      const prueba = { ...sinCortes, area: { ...sinCortes.area, cortes: cortesN(n), sectores: [] } };
      const gp = geometria(prueba);
      if (!gp || gp.fallidos.length) return false;
      return gp.sectores.every((_, i) => {
        const r = calcularSector(prueba, d, gp, i);
        return r && cumple(r);
      });
    };
    if (ok(1)) return { cortes: [], nota: notaUno };
    let lo = 1, hi = 2;
    while (hi < 60 && !ok(hi)) {
      lo = hi;
      hi = Math.min(60, hi * 2);
    }
    while (hi - lo > 1) {
      const m = Math.floor((lo + hi) / 2);
      if (ok(m)) hi = m;
      else lo = m;
    }
    return { cortes: cortesN(hi), nota: hi >= 60 && !ok(60) ? "Con 60 sectores todavía hay alguno que no cumple: revisa los datos." : "" };
  }
  function corredorDesdeEje(hoja2) {
    const a = hoja2.area, c = a.ejeCalc;
    if (!c || !c.linea) return false;
    const medio = Math.max(5, Math.round(c.anchoMax / 2));
    const L = c.largo;
    Object.assign(a, { tipo: "corredor", eje: { nombre: `Eje de ${a.original && a.original.nombre || "el área"}`, linea: c.linea, largo: L }, corredor: { izq: medio, der: medio, mismo: true }, cortes: [], sectores: [], sel: 0 });
    return true;
  }

  // modulos/vuelos/redvial.js
  var ATRIBUCION = "Red vial: Dirección de Vialidad MOP, 31-oct-2026";
  var indice = null;
  var regiones = /* @__PURE__ */ new Map();
  async function cargarIndice() {
    if (indice) return indice;
    const r = await fetch("vendor/capas/redvial/indice.json");
    if (!r.ok) throw new Error("No se encontró la red vial (vendor/capas/redvial).");
    indice = await r.json();
    return indice;
  }
  function cargarRegion(archivo) {
    if (!regiones.has(archivo)) {
      regiones.set(archivo, fetch(`vendor/capas/redvial/${archivo}`).then((r) => {
        if (!r.ok) throw new Error("sin archivo");
        return r.json();
      }).then((j) => j.caminos.map(([rol, nombre, clasificacion, carpeta, linea]) => ({ rol, nombre, clasificacion, carpeta, linea, bbox: bboxDe(linea), origen: "mop" }))).catch((e) => {
        regiones.delete(archivo);
        throw e;
      }));
    }
    return regiones.get(archivo);
  }
  var bboxDe = (linea) => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y] of linea) {
      if (x < a) a = x;
      if (y < b) b = y;
      if (x > c) c = x;
      if (y > d) d = y;
    }
    return [a, b, c, d];
  };
  var tocaBbox = (b, bb) => !(b[0] > bb[2] || b[2] < bb[0] || b[1] > bb[3] || b[3] < bb[1]);
  function recortarLinea(linea, bb, tol = 3e-5) {
    const dentro = ([x, y]) => x >= bb[0] && x <= bb[2] && y >= bb[1] && y <= bb[3];
    const out = [];
    let actual = null;
    for (let k = 0; k < linea.length; k++) {
      const p = linea[k], cerca = dentro(p) || k > 0 && dentro(linea[k - 1]) || k + 1 < linea.length && dentro(linea[k + 1]);
      if (cerca) {
        if (!actual) actual = [];
        actual.push(p);
      } else if (actual) {
        out.push(actual);
        actual = null;
      }
    }
    if (actual) out.push(actual);
    return out.filter((l) => l.length >= 2).map((l) => simplificarLL(l, tol));
  }
  function simplificarLL(l, tol) {
    if (l.length < 3 || !(tol > 0)) return l;
    const marca = new Uint8Array(l.length);
    marca[0] = marca[l.length - 1] = 1;
    const pila = [[0, l.length - 1]];
    while (pila.length) {
      const [a, b] = pila.pop();
      const [ax, ay] = l[a], [bx, by] = l[b], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      let max = -1, idx = -1;
      for (let k = a + 1; k < b; k++) {
        const [px, py] = l[k];
        const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
        const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
        if (d > max) {
          max = d;
          idx = k;
        }
      }
      if (max > tol) {
        marca[idx] = 1;
        pila.push([a, idx], [idx, b]);
      }
    }
    return l.filter((_, k) => marca[k]).map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);
  }
  var ultimo = null;
  async function caminosEn(bbox) {
    const clave2 = bbox.map((x) => x.toFixed(3)).join(",");
    if (ultimo && ultimo.clave === clave2) return ultimo.caminos;
    const ind = await cargarIndice();
    const tocan = ind.regiones.filter((r) => tocaBbox(r.bbox, bbox));
    const listas = await Promise.all(tocan.map((r) => cargarRegion(r.archivo)));
    const caminos = [];
    for (const c of listas.flat()) {
      if (!tocaBbox(c.bbox, bbox)) continue;
      for (const linea of recortarLinea(c.linea, bbox)) caminos.push({ ...c, linea, bbox: bboxDe(linea) });
    }
    ultimo = { clave: clave2, caminos };
    return caminos;
  }
  function recuadro(puntos, km = 2) {
    const xs = puntos.map((p) => p[0]), ys = puntos.map((p) => p[1]);
    const lat = (Math.min(...ys) + Math.max(...ys)) / 2;
    const dy = km / 111.32, dx = km / (111.32 * Math.cos(lat * Math.PI / 180));
    return [Math.min(...xs) - dx, Math.min(...ys) - dy, Math.max(...xs) + dx, Math.max(...ys) + dy];
  }
  function caminosDeHoja(hoja2) {
    return (hoja2.area.caminos || []).map((c) => ({ rol: "", nombre: c.nombre || "Camino agregado", clasificacion: "Agregado en la hoja", carpeta: "", linea: c.linea, origen: "hoja" }));
  }
  var COLOR_CARPETA = (c) => /doble/i.test(c) ? "#F5F5F5" : /pavimento/i.test(c) ? "#E0E0E0" : /ripio|grava/i.test(c) ? "#E8C27A" : /suelo/i.test(c) ? "#C9A26B" : "#BDBDBD";
  var describirCamino = (c) => [c.rol, c.nombre, c.carpeta].filter(Boolean).join(" · ");
  function despegueSobreCamino(hoja2, d, geo, i, caminos, { radio = 1500 } = {}) {
    const sec = geo.sectores[i];
    if (!sec) return null;
    const actual = calcularSector(hoja2, d, geo, i);
    if (!actual) return null;
    const extra = { velocidad: actual.velocidad, ...actual.rumbo != null && !actual.corredor ? { rumbo: actual.rumbo } : {} };
    const poli = sec.poligono;
    const lejos = (p) => puntoEnPoligono(p, poli) ? 0 : distPuntoPoligono(p, poli);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of poli) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    x0 -= radio;
    y0 -= radio;
    x1 += radio;
    y1 += radio;
    const cerca = [];
    caminos.forEach((c, ci) => {
      const xy = c.linea.map(geo.marco.aXY);
      let a = Infinity, b = Infinity, c2 = -Infinity, d2 = -Infinity;
      for (const [x, y] of xy) {
        if (x < a) a = x;
        if (y < b) b = y;
        if (x > c2) c2 = x;
        if (y > d2) d2 = y;
      }
      if (!(a > x1 || c2 < x0 || b > y1 || d2 < y0)) cerca.push({ ci, xy });
    });
    if (!cerca.length) return null;
    const muestras = (paso, centro = null, rCentro = 0) => {
      const out = [];
      for (const { ci, xy } of cerca) {
        for (let k = 0; k + 1 < xy.length; k++) {
          const a = xy[k], b = xy[k + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (centro && distPuntoSegmento(centro, a, b) > rCentro) continue;
          const n = Math.max(1, Math.ceil(l / paso));
          for (let j = 0; j < n; j++) {
            const p = [a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n];
            if (p[0] < x0 || p[0] > x1 || p[1] < y0 || p[1] > y1) continue;
            if (centro && Math.hypot(p[0] - centro[0], p[1] - centro[1]) > rCentro) continue;
            const dd = lejos(p);
            if (dd <= radio) out.push({ p, ci, dd });
          }
        }
      }
      return out;
    };
    let cand = muestras(100);
    if (!cand.length) return null;
    if (cand.length > 300) {
      const k = Math.ceil(cand.length / 300);
      cand = cand.filter((_, j) => j % k === 0);
    }
    const evaluar = (c) => {
      const r = calcularSector(hoja2, d, geo, i, { ...extra, despegue: c.p });
      return r ? r.minTotal : Infinity;
    };
    let mejor = null;
    for (const c of cand) {
      const t = evaluar(c);
      if (!mejor || t < mejor.t - 1e-6 || Math.abs(t - mejor.t) < 1e-6 && c.dd < mejor.c.dd) mejor = { c, t };
    }
    let fino = muestras(15, mejor.c.p, 150);
    if (fino.length > 60) {
      const k = Math.ceil(fino.length / 60);
      fino = fino.filter((_, j) => j % k === 0);
    }
    for (const c of fino) {
      const t = evaluar(c);
      if (t < mejor.t - 1e-6) mejor = { c, t };
    }
    const camino = caminos[mejor.c.ci];
    return {
      xy: mejor.c.p,
      lonLat: geo.marco.aLonLat(mejor.c.p),
      minTotal: mejor.t,
      minActual: actual.minTotal,
      ahorro: actual.minTotal - mejor.t,
      camino,
      distSector: mejor.c.dd,
      probados: cand.length
    };
  }

  // modulos/vuelos/ui.js
  var COLORES_BATERIA = ["#4FC3F7", "#C6F15A", "#FFD54F", "#FF8A80", "#CE93D8", "#80CBC4", "#FFAB40", "#B0BEC5"];
  var COLORES_SECTOR = ["#4FC3F7", "#C6F15A", "#FFD54F", "#FF8A80", "#CE93D8", "#80CBC4"];
  var ESTADOS_HOJA = { borrador: ["Borrador", "gris"], lista: ["Programado", "verde"], volada: ["Volado", "azul"] };
  var PASOS = [["identificacion", "1 · Identificación"], ["area", "2 · Área"], ["vuelo", "3 · Vuelo"], ["clima", "4 · Clima"], ["permisos", "5 · Permisos"]];
  var GSD_TABLA = [3, 2.5, 2, 1.5];
  var UMBRAL_BATERIAS = 6;
  var TIPO_KML = "application/vnd.google-earth.kml+xml";
  var dosD = (n) => String(n).padStart(2, "0");
  var chip = (t, clase = "gris") => `<span class="sis-chip ${clase}">${t}</span>`;
  var campo = (nombre, etiqueta, valor, extra = "", sufijo = "") => `<label class="sis-campo"><span>${etiqueta}</span>
    <span class="vu-con-sufijo"><input name="${nombre}" value="${escapar(valor)}" inputmode="decimal" ${extra}>${sufijo ? `<em>${sufijo}</em>` : ""}</span></label>`;
  var deslizador = (nombre, etiqueta, valor, { min, max, paso, sufijo, nota = "" }) => `<div class="vu-desl">
      <div class="vu-desl-cab"><label for="vu-${nombre}">${etiqueta}${nota ? ` <small>${nota}</small>` : ""}</label>
        <span class="vu-desl-valor"><input type="number" data-espejo="${nombre}" value="${escapar(valor)}" step="${paso}" min="${min}" max="${max}" aria-label="${etiqueta}">${sufijo}</span></div>
      <input type="range" id="vu-${nombre}" name="${nombre}" min="${min}" max="${max}" step="${paso}" value="${escapar(valor)}">
    </div>`;
  var kpi = (t, v, d = "", clase = "") => `<div class="vu-kpi ${clase}"><span>${t}</span><b>${v}</b>${d ? `<small>${d}</small>` : ""}</div>`;
  var fila = (t, v) => `<div><dt>${t}</dt><dd>${v}</dd></div>`;
  var fechaHora = (iso) => new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });

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
    const fila2 = kps.filter((k) => {
      const ini = new Date(k.t).getTime();
      return t >= ini && t < ini + 3 * 36e5;
    });
    return fila2.length ? Math.max(...fila2.map((f) => f.kp)) : null;
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

  // vendor/capas/metar-estaciones.json
  var metar_estaciones_default = { fuente: "NOAA AviationWeather.gov · stationinfo", fecha: "2026-11-02", campos: ["icao", "nombre", "lat", "lon", "elev", "emite (M=METAR, T=TAF)"], estaciones: [["SACP", "Chepes", -31.333, -66.6, 663, "M"], ["SACT", "Gobernador Gordillo", -30.349, -66.295, 454, "M"], ["SAME", "Mendoza/Plumerillo Arpt", -32.832, -68.793, 709, "MT"], ["SAMI", "San Martin", -33.083, -68.417, 653, "M"], ["SAMJ", "Jachal", -30.25, -68.74, 1168, "M"], ["SAMM", "Malargue Arpt", -35.481, -69.583, 1428, "M"], ["SAMR", "San Rafael Arpt", -34.585, -68.414, 756, "MT"], ["SAMS", "San Carlos", -33.771, -69.034, 951, "M"], ["SAMU", "Uspallata", -32.601, -69.335, 1918, "M"], ["SANI", "Tinogasta", -28.041, -67.577, 1225, "M"], ["SANL", "La Rioja/Capt Vincen", -29.383, -66.795, 438, "MT"], ["SANO", "Chilecito", -29.224, -67.439, 918, "M"], ["SANU", "San Juan Arpt", -31.572, -68.418, 596, "MT"], ["SAOU", "San Luis Arpt", -33.273, -66.356, 704, "MT"], ["SAVB", "El Bolson Arpt", -41.948, -71.533, 332, "M"], ["SAVC", "Comodoro Rivadavia Arpt", -45.79, -67.471, 58, "MT"], ["SAVE", "Esquel Arpt", -42.906, -71.147, 799, "MT"], ["SAVP", "Paso De Indios", -43.856, -69.044, 514, "M"], ["SAWA", "Lago Argentino Arpt", -50.327, -72.276, 182, "M"], ["SAWC", "El Calafate Arpt", -50.284, -72.052, 204, "MT"], ["SAWE", "Rio Grande/Quijada Intl", -53.781, -67.754, 22, "MT"], ["SAWG", "Rio Gallegos Intl", -51.609, -69.306, 18, "MT"], ["SAWH", "Ushuaia/Malvinas Arpt", -54.844, -68.308, 22, "MT"], ["SAWJ", "San Julian Aero", -49.307, -67.803, 48, "M"], ["SAWP", "Perito Moreno Arpt", -46.537, -70.983, 429, "M"], ["SAWR", "Gobernador Gregores", -48.783, -70.167, 357, "M"], ["SAWU", "Santa Cruz Arpt", -50.017, -68.579, 113, "M"], ["SAZN", "Neuquen Arpt", -38.95, -68.141, 273, "MT"], ["SAZS", "San Carlos de Bariloche Arpt", -41.151, -71.157, 843, "MT"], ["SAZY", "Chapelco", -40.075, -71.137, 783, "MT"], ["SCAP", "Alto Palena Arpt", -43.612, -71.802, 252, "M"], ["SCAR", "Arica/Chacalluta Arpt", -18.351, -70.336, 57, "MT"], ["SCAS", "Puerto Aysen Arpt", -45.399, -72.67, 8, "M"], ["SCAT", "Desierto Atacama Arpt", -27.262, -70.774, 209, "MT"], ["SCBA", "Balmaceda/Vidal Arpt", -45.913, -71.694, 516, "MT"], ["SCCC", "Chile Chico Arpt", -46.581, -71.693, 305, "M"], ["SCCF", "Calama/El Loa Intl", -22.496, -68.905, 2290, "MT"], ["SCCH", "Chillan/OHiggins Arpt", -36.583, -72.031, 148, "MT"], ["SCCI", "Punta Arenas Arpt", -53.003, -70.855, 37, "MT"], ["SCCY", "Coyhaique/Vidal Arpt", -45.595, -72.11, 301, "MT"], ["SCDA", "Iquique/Diego Aracena Arpt", -20.535, -70.181, 41, "MT"], ["SCEL", "Santiago/Benítez Intl", -33.393, -70.786, 478, "MT"], ["SCER", "Quintero Santia", -32.79, -71.522, 15, "M"], ["SCFA", "Antofagasta/Sabella Arpt", -23.45, -70.441, 113, "MT"], ["SCFM", "Porvenir/Martinez Arpt", -53.254, -70.319, 28, "MT"], ["SCFT", "Futaleufú Arpt", -43.189, -71.853, 345, "M"], ["SCGE", "Los Angeles/Dolores", -37.403, -72.422, 122, "MT"], ["SCGZ", "Guardiamarina/Zahart", -54.932, -67.631, 21, "MT"], ["SCHA", "Copiapo Arpt", -27.296, -70.414, 301, "MT"], ["SCHR", "Cochrane Arpt", -47.244, -72.586, 203, "MT"], ["SCIC", "Curico/Freire Arpt", -34.966, -71.217, 230, "MT"], ["SCIE", "Concepcion/Sur Intl", -36.773, -73.063, 8, "MT"], ["SCJO", "Osorno/Siebert Arpt", -40.605, -73.061, 61, "MT"], ["SCLL", "Vallenar Arpt", -28.596, -70.756, 538, "M"], ["SCLR", "Los Alerces Arpt", -42.7809, -72.6452, 105, "M"], ["SCMK", "Melinka Arpt", -43.897, -73.741, 22, "MT"], ["SCNT", "Puerta Natales/Galla", -51.672, -72.528, 68, "MT"], ["SCON", "Puerto Quellon Arpt", -43.134, -73.633, 11, "M"], ["SCPQ", "Monopulli Arpt", -42.347, -73.718, 166, "MT"], ["SCQP", "Temuco Arpt", -38.925, -72.648, 97, "MT"], ["SCRA", "Chanaral Arpt", -26.332, -70.607, 27, "M"], ["SCRD", "Valparaiso/Rodelillo Arpt", -33.068, -71.557, 342, "MT"], ["SCRG", "Rancagua/Indepencia Arpt", -34.174, -70.776, 488, "MT"], ["SCSE", "La Serena/La Florida Arpt", -29.918, -71.201, 141, "MT"], ["SCSN", "Santo Domingo Arpt", -33.656, -71.615, 73, "MT"], ["SCTB", "Santiago/Sanchez Arpt", -33.456, -70.547, 655, "MT"], ["SCTC", "Temuco/Maquehue", -38.77, -72.637, 93, "MT"], ["SCTE", "Puerto Montt/Tepua Arpt", -41.439, -73.094, 85, "MT"], ["SCTN", "Chaitén Arpt", -42.933, -72.699, 8, "MT"], ["SCVD", "Valdivia/Pichoy Arpt", -39.65, -73.086, 19, "MT"], ["SCVM", "Concon/Vina Del Mar Arpt", -32.947, -71.479, 136, "MT"], ["SLCB", "Cochabamba/Wilstermann Intl", -17.421, -66.179, 2560, "MT"], ["SLCN", "Charaña", -17.592, -69.442, 4070, "M"], ["SLOR", "Oruro/Mendoza Arpt", -17.962, -67.077, 3720, "MT"], ["SLUY", "Andina Intl", -20.4413, -66.8576, 3394, "M"], ["SPLO", "Ilo Arpt", -17.692, -71.343, 25, "MT"], ["SPTN", "Tacna Arpt", -18.049, -70.277, 459, "MT"]] };

  // modulos/vuelos/metar.js
  var NUDO = 0.514444;
  var PIE = 0.3048;
  var MILLA = 1609.34;
  var RUMBOS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  var estaciones = null;
  async function cargarEstaciones() {
    return estaciones;
  }
  function fijarEstaciones(lista) {
    estaciones = lista.map(([icao, nombre, lat, lon, elev, emite]) => ({ icao, nombre, lat, lon, elev, taf: emite.includes("T") }));
  }
  fijarEstaciones(metar_estaciones_default.estaciones);
  var kmEntre = (a, b, c, d) => Math.hypot((c - a) * 110.54, (d - b) * 111.32 * Math.cos(a * Math.PI / 180));
  var rumbo = (a, b, c, d) => (Math.atan2((d - b) * Math.cos(a * Math.PI / 180), c - a) * 180 / Math.PI + 360) % 360;
  function cercanas(lat, lon, n = 3) {
    if (!estaciones) return [];
    return estaciones.map((e) => ({ ...e, km: kmEntre(lat, lon, e.lat, e.lon), rumbo: rumbo(lat, lon, e.lat, e.lon) })).sort((a, b) => a.km - b.km).slice(0, n).map((e) => ({ ...e, hacia: `al ${RUMBOS[Math.round(e.rumbo / 45) % 8]}` }));
  }
  function representatividad(est2, elevArea = null) {
    const motivos = [];
    if (est2.km > 50) motivos.push(`está a ${Math.round(est2.km)} km`);
    if (elevArea != null && Math.abs(elevArea - est2.elev) > 500) motivos.push(`${Math.round(Math.abs(elevArea - est2.elev))} m de diferencia de altura`);
    return { buena: !motivos.length, motivos };
  }
  var enlaces = (icao) => [
    ["AIP Chile", "https://aipchile.dgac.gob.cl/metar"],
    ["MeteoChile", "https://www.meteochile.gob.cl/PortalDMC-web/metaer/home.xhtml"],
    ["NOAA (texto)", `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icao)}&format=raw&taf=true&hours=3`]
  ];
  var FENOMENOS = {
    RA: "lluvia",
    DZ: "llovizna",
    SN: "nieve",
    SG: "cinarra",
    GR: "granizo",
    GS: "granizo pequeño",
    PL: "hielo granulado",
    UP: "precipitación",
    FG: "niebla",
    BR: "neblina",
    HZ: "calima",
    FU: "humo",
    DU: "polvo",
    SA: "arena",
    VA: "ceniza",
    TS: "tormenta",
    SH: "chubascos",
    SQ: "turbonada",
    FC: "tromba",
    DS: "tempestad de polvo",
    SS: "tempestad de arena",
    PO: "remolinos de polvo",
    FZ: "engelante",
    MI: "baja",
    BC: "en bancos",
    PR: "parcial",
    DR: "arrastrada",
    BL: "levantada",
    VC: "en las cercanías"
  };
  var CANT = { FEW: "pocas (1–2/8)", SCT: "dispersas (3–4/8)", BKN: "fragmentadas (5–7/8)", OVC: "cubierto (8/8)", VV: "cielo invisible" };
  function fenomeno(tok) {
    const m = /^([+-]|VC)?((?:MI|BC|PR|DR|BL|SH|TS|FZ))?((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS)+)?$/.exec(tok);
    if (!m || !m[2] && !m[3]) return null;
    const partes = [];
    if (m[3]) for (let i = 0; i < m[3].length; i += 2) partes.push(FENOMENOS[m[3].slice(i, i + 2)]);
    if (m[2]) partes.push(FENOMENOS[m[2]]);
    if (m[1] === "-") partes.push("débil");
    else if (m[1] === "+") partes.push("fuerte");
    else if (m[1] === "VC") partes.push("en las cercanías");
    return { codigo: tok, texto: partes.filter(Boolean).join(" ") };
  }
  function horaReporte(ddhhmm, ahora = /* @__PURE__ */ new Date()) {
    const d = Number(ddhhmm.slice(0, 2)), h = Number(ddhhmm.slice(2, 4)), mi = Number(ddhhmm.slice(4, 6));
    let f = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), d, h, mi));
    if (f - ahora > 36e5 * 24) f = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 1, d, h, mi));
    return f;
  }
  function categoria(techoPies, visM) {
    const sm = visM == null ? null : visM / MILLA;
    if (techoPies != null && techoPies < 500 || sm != null && sm < 1) return "LIFR";
    if (techoPies != null && techoPies < 1e3 || sm != null && sm < 3) return "IFR";
    if (techoPies != null && techoPies <= 3e3 || sm != null && sm <= 5) return "MVFR";
    return "VFR";
  }
  function decodificarUno(texto3, ahora = /* @__PURE__ */ new Date()) {
    const t = String(texto3).replace(/=+\s*$/, "").trim();
    const cab = /^(?:(METAR|SPECI)\s+)?(?:COR\s+)?([A-Z]{4})\s+(\d{6})Z\s+(.*)$/s.exec(t);
    if (!cab) return null;
    const r = {
      tipo: cab[1] || "METAR",
      icao: cab[2],
      hora: horaReporte(cab[3], ahora),
      texto: `${cab[1] || "METAR"} ${cab[2]} ${cab[3]}Z ${cab[4]}`.replace(/\s+/g, " ").trim(),
      viento: null,
      visibilidadM: null,
      cavok: false,
      nubes: [],
      fenomenos: [],
      temp: null,
      rocio: null,
      qnh: null,
      tendencia: ""
    };
    const toks = cab[4].split(/\s+/);
    for (let i = 0; i < toks.length; i++) {
      const k = toks[i];
      if (k === "RMK") break;
      if (/^(NOSIG|BECMG|TEMPO)$/.test(k)) {
        r.tendencia = toks.slice(i).join(" ");
        break;
      }
      let m;
      if (m = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/.exec(k)) {
        const f = m[4] === "KT" ? NUDO : 1;
        r.viento = { dir: m[1] === "VRB" ? null : Number(m[1]), ms: Number(m[2]) * f, rafMs: m[3] ? Number(m[3]) * f : null, kt: m[4] === "KT" ? Number(m[2]) : Number(m[2]) / NUDO, rafKt: m[3] ? m[4] === "KT" ? Number(m[3]) : Number(m[3]) / NUDO : null };
      } else if ((m = /^(\d{3})V(\d{3})$/.exec(k)) && r.viento) {
        r.viento.varDe = Number(m[1]);
        r.viento.varA = Number(m[2]);
      } else if (k === "CAVOK") {
        r.cavok = true;
        r.visibilidadM = 1e4;
      } else if (/^\d{4}$/.test(k) && r.visibilidadM == null) r.visibilidadM = k === "9999" ? 1e4 : Number(k);
      else if (m = /^(P)?(\d+)(?:\/(\d+))?SM$/.exec(k)) r.visibilidadM = (m[3] ? Number(m[2]) / Number(m[3]) : Number(m[2])) * MILLA;
      else if (m = /^(FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)(CB|TCU)?$/.exec(k)) r.nubes.push({ cant: m[1], texto: CANT[m[1]], pies: m[2] === "///" ? null : Number(m[2]) * 100, m: m[2] === "///" ? null : Math.round(Number(m[2]) * 100 * PIE), tipo: m[3] || "" });
      else if (/^(NSC|SKC|CLR|NCD)$/.test(k)) r.sinNubes = true;
      else if (m = /^(M?\d{2})\/(M?\d{2})?$/.exec(k)) {
        const n = (s) => s ? Number(s.replace("M", "-")) : null;
        r.temp = n(m[1]);
        r.rocio = n(m[2]);
      } else if (m = /^Q(\d{4})$/.exec(k)) r.qnh = Number(m[1]);
      else if (m = /^A(\d{4})$/.exec(k)) r.qnh = Math.round(Number(m[1]) / 100 * 33.8639);
      else {
        const f = fenomeno(k);
        if (f) r.fenomenos.push(f);
      }
    }
    const techo = r.nubes.filter((n) => ["BKN", "OVC", "VV"].includes(n.cant) && n.pies != null).map((n) => n.pies);
    r.techoPies = techo.length ? Math.min(...techo) : null;
    r.categoria = categoria(r.techoPies, r.visibilidadM);
    return r;
  }
  function decodificar(texto3, ahora = /* @__PURE__ */ new Date()) {
    const limpio = String(texto3 || "").replace(/\r/g, "");
    const metars = [];
    const re = /(?:^|\s)((?:METAR|SPECI)\s+(?:COR\s+)?[A-Z]{4}\s+\d{6}Z[^=\n]*|[A-Z]{4}\s+\d{6}Z\s+(?:AUTO\s+)?(?:\d{3}|VRB)\d{2,3}(?:G\d{2,3})?(?:KT|MPS)[^=\n]*)/g;
    let m;
    while (m = re.exec(limpio)) {
      const d = decodificarUno(m[1].replace(/\bAUTO\b/, ""), ahora);
      if (d && !metars.some((x) => x.texto === d.texto)) metars.push(d);
    }
    const taf = /TAF\s+(?:AMD\s+|COR\s+)?[A-Z]{4}\s+\d{6}Z[\s\S]*?(?:=|$)/.exec(limpio);
    metars.sort((a, b) => b.hora - a.hora);
    return { metars, taf: taf ? taf[0].replace(/\s+/g, " ").trim() : "" };
  }
  function comparar(m, dron, horaPron = null) {
    const out = [];
    if (m.viento) {
      const v = m.viento.ms, g = m.viento.rafMs;
      out.push({
        texto: `Viento ${m.viento.dir == null ? "variable" : m.viento.dir + "°"} ${v.toFixed(1)} m/s${g ? `, ráfagas ${g.toFixed(1)} m/s` : ""} (en el aeródromo, a 10 m)`,
        nivel: v > dron.vientoMaxMs || g && g > dron.rafagaMaxMs ? "no" : v > 0.8 * dron.vientoMaxMs || g && g > 0.8 * dron.rafagaMaxMs ? "aviso" : "ok"
      });
    }
    if (m.visibilidadM != null) out.push({ texto: m.cavok ? "CAVOK: visibilidad 10 km o más, sin nubes bajas" : `Visibilidad ${m.visibilidadM >= 1e4 ? "10 km o más" : (m.visibilidadM / 1e3).toFixed(1) + " km"}`, nivel: m.visibilidadM < 3e3 ? "no" : m.visibilidadM < 5e3 ? "aviso" : "ok" });
    if (m.techoPies != null) out.push({ texto: `Techo de nubes a ${Math.round(m.techoPies * PIE)} m (${m.techoPies} pies)`, nivel: m.techoPies * PIE < 300 ? "aviso" : "ok" });
    for (const f of m.fenomenos) out.push({ texto: `Fenómeno: ${f.texto} (${f.codigo})`, nivel: /TS|GR|\+/.test(f.codigo) ? "no" : /RA|DZ|SN|FG|SH/.test(f.codigo) ? "aviso" : "ok" });
    if (m.temp != null) out.push({ texto: `Temperatura ${m.temp} °C${m.rocio != null ? ` · punto de rocío ${m.rocio} °C` : ""}`, nivel: m.temp < 5 ? "aviso" : "ok" });
    if (m.temp != null && m.rocio != null && m.temp - m.rocio <= 2) out.push({ texto: "Temperatura y rocío muy cerca: posible niebla o condensación en la cámara", nivel: "aviso" });
    if (horaPron && horaPron.v != null && m.viento) {
      out.push({ texto: `El pronóstico decía ${horaPron.v.toFixed(1)} m/s a 120 m para esa hora; el METAR mide ${m.viento.ms.toFixed(1)} m/s a 10 m. A 120 m el viento suele ser mayor que en superficie.`, nivel: m.viento.ms > horaPron.v + 3 ? "aviso" : "ok" });
    }
    return out;
  }
  var antiguedadMin = (m, ahora = /* @__PURE__ */ new Date()) => Math.round((ahora - m.hora) / 6e4);

  // modulos/vuelos/metar-ui.js
  var esc = (s) => String(s != null ? s : "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var NIVEL = { ok: "mt-ok", aviso: "mt-aviso", no: "mt-no" };
  var COLOR_CAT = { VFR: "mt-ok", MVFR: "mt-aviso", IFR: "mt-no", LIFR: "mt-no" };
  function horaLocal(fecha2) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(fecha2).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:00`;
  }
  var horaTexto = (f) => f.toLocaleString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  function resumenMetar(guardado) {
    if (!guardado || !guardado.texto) return null;
    const d = decodificar(guardado.texto, new Date(guardado.leidoEn || Date.now()));
    const m = d.metars[0];
    return m ? { icao: m.icao, hora: m.hora.toISOString(), texto: m.texto, categoria: m.categoria, viento: m.viento, taf: d.taf } : null;
  }
  function htmlPanelMetar({ lat, lon, elevArea = null, guardado = null, dron, horasPron = null, acc = "data-accion", titulo = "METAR · TAF" }) {
    const cerca = lat != null && lon != null ? cercanas(lat, lon, 3) : [];
    const lista = cerca.length ? `<ul class="mt-lista">${cerca.map((e) => {
      const r = representatividad(e, elevArea);
      return `<li><div><b class="mt-icao">${esc(e.icao)}</b> ${esc(e.nombre)}<span class="mt-tenue"> · ${Math.round(e.km)} km ${e.hacia} · ${e.elev} m${e.taf ? " · con TAF" : ""}</span>
      ${r.buena ? "" : `<span class="mt-ref">Solo referencia: ${esc(r.motivos.join(" y "))}</span>`}</div>
      <div class="mt-enlaces">${enlaces(e.icao).map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t} ↗</a>`).join("")}</div></li>`;
    }).join("")}</ul>` : '<p class="mt-tenue">Carga el área para ver los aeródromos con METAR más cercanos.</p>';
    let leido = "";
    if (guardado && guardado.texto) {
      const d = decodificar(guardado.texto, new Date(guardado.leidoEn || Date.now()));
      const m = d.metars[0];
      if (!m) leido = '<p class="mt-no">No reconocí un METAR en el texto pegado. Copia la línea que empieza con METAR o con el código del aeródromo (por ejemplo SCEL 021400Z…).</p>';
      else {
        const fila2 = horasPron ? horasPron.find((h) => h.t === horaLocal(m.hora)) : null;
        const comp = comparar(m, dron, fila2);
        const edad = antiguedadMin(m);
        leido = `<div class="mt-leido">
        <div class="mt-cab"><b>${esc(m.tipo)} ${esc(m.icao)}</b><span class="mt-chip ${COLOR_CAT[m.categoria]}">${m.categoria}</span>
          <span class="mt-tenue">${esc(horaTexto(m.hora))} hora de Chile${edad >= 0 && edad < 60 * 24 * 3 ? ` · hace ${edad < 90 ? edad + " min" : Math.round(edad / 60) + " h"}` : ""}</span></div>
        ${edad > 90 ? '<p class="mt-aviso">Este reporte tiene más de hora y media: revisa si hay uno más nuevo.</p>' : ""}
        <ul class="mt-comp">${comp.map((c) => `<li class="${NIVEL[c.nivel]}">${esc(c.texto)}</li>`).join("")}</ul>
        <pre class="mt-crudo">${esc(m.texto)}${d.metars.length > 1 ? `
(+${d.metars.length - 1} reporte${d.metars.length > 2 ? "s" : ""} anterior${d.metars.length > 2 ? "es" : ""})` : ""}${d.taf ? "\n\n" + esc(d.taf) : ""}</pre>
        <button type="button" class="mt-btn" ${acc}="metar-borrar">Borrar METAR</button></div>`;
      }
    }
    return `<div class="mt-panel"><h3 class="mt-tit">${esc(titulo)}</h3>
    <p class="mt-tenue">Aeródromos con METAR más cercanos. Abre uno, copia el reporte y pégalo abajo: la app lo lee y lo compara con el dron y el pronóstico.</p>
    ${lista}
    <label class="mt-pegar"><span>Pegar METAR (y TAF si quieres)</span><textarea rows="3" data-metar-texto placeholder="METAR SCEL 021400Z 20008KT 9999 FEW030 22/08 Q1015 NOSIG=">${esc(guardado && guardado.texto && !leido.includes("mt-leido") ? guardado.texto : "")}</textarea></label>
    <button type="button" class="mt-btn mt-pri" ${acc}="metar-leer">Leer METAR</button>
    ${leido}</div>`;
  }

  // modulos/vuelos/graficos.js
  var COLOR_ESTADO = { go: "#0F766E", marg: "#C2410C", no: "#B42318", noche: "#B9B5AC" };
  var TEXTO_ESTADO2 = { go: "GO", marg: "Marg.", no: "NO", noche: "Luz" };
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
    const fila2 = (titulo, f) => `<div class="vu-graf-fila" style="grid-template-columns:${X0}px repeat(${n}, minmax(0,1fr))"><span class="vu-graf-tit">${titulo}</span>${filas.map(f).join("")}</div>`;
    const filasHtml = [
      fila2("", (x) => celda(`<b>${String(x.h.hora).padStart(2, "0")}</b><span class="vu-graf-estado" style="background:${COLOR_ESTADO[x.ev.estado]}" title="${escapar(x.ev.motivos.join(" · "))}">${TEXTO_ESTADO2[x.ev.estado]}</span>`)),
      fila2("Dir.", (x) => celda(x.h.dir != null ? `<span class="vu-flecha" style="transform:rotate(${Math.round(x.h.dir + 180)}deg)" title="Viento desde ${Math.round(x.h.dir)}°">↑</span>` : "—")),
      fila2("Lluvia", (x) => celda(x.h.prob != null ? `${fmt(x.h.prob)}%` : "—", x.h.lluvia >= 0.2 || x.h.prob >= 40 ? "azul" : "")),
      fila2("Nubes", (x) => celda(`${fmt(x.h.nubes)}%`, x.h.nubes >= 50 ? "gris" : "")),
      fila2("Temp.", (x) => celda(`${fmt(x.h.temp, 0)}°`, x.h.temp < 5 ? "azul" : "")),
      fila2("Kp", (x) => celda(x.kp != null ? fmt(x.kp, 0) : "—", x.kp >= 4 ? "ambar" : ""))
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

  // modulos/vuelos/pronostico-widget.js
  var DRONES = DRONES_BASE.map((d) => ({ id: d.id, nombre: d.nombre, vientoMaxMs: d.vientoMaxMs, rafagaMaxMs: d.rafagaMaxMs }));
  function filasDelDia(p, dron, kps, dia) {
    return p.horas.filter((x) => x.fecha === dia && x.hora >= 6 && x.hora <= 21).map((h) => {
      const kp = kpEnHora(kps, h.t);
      return { h, kp, ev: evaluarHora(h, dron, { kp, solMin: 5 }) };
    });
  }
  function mejorVentana(filas) {
    let mejor = null, ini = null;
    filas.forEach((f, i) => {
      if (f.ev.estado === "go" && ini == null) ini = i;
      if (f.ev.estado !== "go" || i === filas.length - 1) {
        const fin = f.ev.estado === "go" ? i : i - 1;
        if (ini != null && (!mejor || fin - ini > mejor[1] - mejor[0])) mejor = [ini, fin];
        if (f.ev.estado !== "go") ini = null;
      }
    });
    return mejor ? [filas[mejor[0]].h.hora, filas[mejor[1]].h.hora] : null;
  }
  function analizarDia(p, dron, kps, dia) {
    const filas = filasDelDia(p, dron, kps, dia);
    const ventana = mejorVentana(filas);
    const sol = p.dias.find((x) => x.fecha === dia);
    const kpsDia = filas.map((f) => f.kp).filter((k) => k != null);
    const enVentana = ventana ? filas.filter((f) => f.h.hora >= ventana[0] && f.h.hora <= ventana[1]) : filas.filter((f) => f.ev.estado !== "noche");
    return { filas, ventana, sol, kpMax: kpsDia.length ? Math.max(...kpsDia) : null, checklist: checklistClima(enVentana.length ? enVentana : filas, dron) };
  }

  // modulos/vuelos/ubicacion.js
  var cache2 = /* @__PURE__ */ new Map();
  var limpiarRegion = (t) => String(t || "").replace(/^Regi[oó]n\s+(de\s+la\s+|del\s+|de\s+)?/i, "").trim();
  async function ubicacionDe(lat, lon) {
    const clave2 = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    if (cache2.has(clave2)) return cache2.get(clave2);
    const url = "https://nominatim.openstreetmap.org/reverse?" + new URLSearchParams({ format: "jsonv2", lat: lat.toFixed(5), lon: lon.toFixed(5), zoom: "10", addressdetails: "1", "accept-language": "es" });
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`OpenStreetMap respondió ${r.status}`);
    const j = await r.json();
    const a = j.address || {};
    const out = {
      comuna: a.municipality || a.city || a.town || a.village || a.county || "",
      region: limpiarRegion(a.state || a.region || ""),
      pais: a.country || "",
      codigoPais: (a.country_code || "").toUpperCase()
    };
    cache2.set(clave2, out);
    return out;
  }
  function textoUbicacion(u) {
    if (!u) return "";
    return [u.comuna, u.region, u.codigoPais && u.codigoPais !== "CL" ? u.pais : ""].filter(Boolean).join(", ");
  }

  // modulos/vuelos/vista-hojas.js
  function crearVistaHojas(v) {
    const ref = (n) => (...a) => v[n](...a);
    const { st, base } = v;
    const geo = ref("geo");
    const dron = ref("dron");
    const nomProy = ref("nomProy");
    const nomPers = ref("nomPers");
    const zonasDeHoja = ref("zonasDeHoja");
    const render = ref("render");
    const opcionesProyectos = (sel) => `<option value="">Sin proyecto</option>` + base.proyectos.map((p) => `<option value="${escapar(p.id)}" ${p.id === sel ? "selected" : ""}>${escapar(p.id === OFICINA_ID ? "Oficina" : p.nombre)}</option>`).join("");
    const centroHoja = (h) => {
      if (h.resumen && h.resumen.centro) return h.resumen.centro;
      const pts = h.area && (h.area.original && h.area.original.anillo || h.area.eje && h.area.eje.linea) || [];
      if (!pts.length) return null;
      return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
    };
    const proximaFecha = (h) => {
      const hoy = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const dias = (h.programa && h.programa.length ? h.programa.map((x) => x.fecha) : [h.fecha]).filter(Boolean).sort();
      return dias.find((f) => f >= hoy) || dias[dias.length - 1] || null;
    };
    async function pronosticoLateral(h) {
      const c = centroHoja(h);
      if (!c) {
        st.pronLista = { id: h.id, sinArea: true };
        return;
      }
      st.pronLista = { id: h.id, cargando: true };
      try {
        const [p, kps] = await Promise.all([pedirPronostico(c[1], c[0], 1), st.kps ? Promise.resolve(st.kps) : pedirKp()]);
        st.kps = kps;
        const d = base.drones.find((x) => x.id === h.dronId) || base.drones[0];
        const dia = p.horas[0] ? p.horas[0].fecha : null;
        st.pronLista = { id: h.id, p, a: dia ? analizarDia(p, d, kps, dia) : null, d };
      } catch (e) {
        st.pronLista = { id: h.id, error: "Sin conexión para el pronóstico." };
      }
      if (st.vista === "hojas") render();
    }
    function htmlPronLateral(h) {
      const x = st.pronLista;
      const lugar = h.ubicacion && textoUbicacion(h.ubicacion) || nomProy(h.proyectoId);
      let cuerpo;
      if (!x || x.id !== h.id) {
        pronosticoLateral(h);
        cuerpo = '<p class="sis-tenue">Consultando el pronóstico…</p>';
      } else if (x.sinArea) cuerpo = '<p class="sis-tenue">Este vuelo aún no tiene área: el pronóstico aparece al cargarla.</p>';
      else if (x.cargando) cuerpo = '<p class="sis-tenue">Consultando el pronóstico…</p>';
      else if (x.error) cuerpo = `<p class="sis-tenue">${escapar(x.error)}</p>`;
      else {
        const f = x.a.filas, ahora = (/* @__PURE__ */ new Date()).getHours();
        const fNow = f.find((r) => r.h.hora === ahora) || f[0];
        const conLuz = f.filter((r) => r.ev.estado !== "noche");
        const vMax = Math.max(...conLuz.map((r) => r.h.v || 0)), gMax = Math.max(...conLuz.map((r) => r.h.g || 0));
        const temps = f.map((r) => r.h.temp).filter((t) => t != null);
        const col = { go: "#A7D7C5", marg: "#F3C9A0", no: "#E8A08A", noche: "#D9DCE0" };
        cuerpo = `<div class="vu-pl-temp"><b>${fNow && fNow.h.temp != null ? fmt(fNow.h.temp, 0) + "°" : "—"}</b><span>${temps.length ? `mín ${fmt(Math.min(...temps), 0)}° · máx ${fmt(Math.max(...temps), 0)}°` : ""}</span></div>
        <div class="vu-pl-grilla">
          <div class="${vMax > x.d.vientoMaxMs * 0.8 ? "alerta" : ""}"><small>Viento 120 m (máx.)</small><b>${fmt(vMax, 1)} m/s</b></div>
          <div class="${gMax > x.d.rafagaMaxMs * 0.8 ? "alerta" : ""}"><small>Ráfaga (máx.)</small><b>${fmt(gMax, 1)} m/s</b></div>
          <div><small>Índice Kp</small><b>${x.a.kpMax != null ? fmt(x.a.kpMax, 0) : "—"}</b></div>
          <div><small>Luz útil</small><b>${x.a.sol && x.a.sol.salida ? `${x.a.sol.salida.slice(11, 16)}–${(x.a.sol.puesta || "").slice(11, 16)}` : "—"}</b></div>
        </div>
        <div class="vu-pl-horas" role="img" aria-label="Estado por hora: verde se puede volar, naranjo marginal, rojo no">${f.map((r) => `<i style="background:${col[r.ev.estado]}" title="${dosD(r.h.hora)}:00 · ${escapar(r.ev.estado === "go" ? "GO" : r.ev.estado === "marg" ? "marginal" : r.ev.estado === "no" ? "NO" : "noche")}${r.ev.motivos.length ? " · " + escapar(r.ev.motivos.join(", ")) : ""}"></i>`).join("")}</div>
        <div class="vu-pl-eje"><span>00 h</span><span>12 h</span><span>23 h</span></div>
        <p class="vu-pl-ventana">${x.a.ventana ? `Ventana GO <b>${dosD(x.a.ventana[0])}:00 – ${dosD(x.a.ventana[1] + 1)}:00</b>` : '<b class="vu-rojo">Sin ventana GO hoy</b>'}</p>`;
      }
      return `<aside class="sis-tarjeta vu-pron-lateral"><small class="sis-tenue">Pronóstico de hoy · vuelo seleccionado</small><h2>${escapar(lugar)}</h2>${cuerpo}
      <p class="sis-tenue">Límites del ${escapar((base.drones.find((y) => y.id === h.dronId) || {}).familiaNombre || "dron")}. Al elegir otro vuelo, cambia el lugar.</p></aside>`;
    }
    function vistaHojas() {
      const filtroProy = (h) => !st.filtroProyecto || h.proyectoId === st.filtroProyecto;
      const todas = base.hojas.filter(filtroProy).filter((h) => st.verProcesados || etapaVuelo(h) !== "procesado");
      const cuenta2 = Object.fromEntries(ETAPAS_VUELO.map(([k]) => [k, base.hojas.filter(filtroProy).filter((h) => etapaVuelo(h) === k).length]));
      const lista = todas.filter((h) => !st.filtroEtapa || etapaVuelo(h) === st.filtroEtapa).sort((a, b) => (proximaFecha(a) || "9999").localeCompare(proximaFecha(b) || "9999"));
      const sel = lista.find((h) => h.id === st.selHoja) || lista[0];
      const claseEt = Object.fromEntries(ETAPAS_VUELO.map(([k, , c]) => [k, c]));
      const tarjeta = (h) => {
        const r = h.resumen || {}, et = etapaVuelo(h), abierta = sel && h.id === sel.id, f = proximaFecha(h);
        const etapas = ETAPAS_VUELO.map(([k, t], i) => {
          const iAct = ETAPAS_VUELO.findIndex((e) => e[0] === et);
          return `<span class="${i < iAct ? "hecho" : i === iAct ? "actual" : ""}">${t}</span>`;
        }).join("");
        if (!abierta) return `<button type="button" class="vu-vuelo" data-accion="sel-vuelo" data-id="${escapar(h.id)}">
          <span class="vu-vuelo-txt"><b>${escapar(h.nombre || "Vuelo sin nombre")}</b><small>${escapar([nomProy(h.proyectoId), (base.drones.find((d) => d.id === h.dronId) || {}).familiaNombre, r.area ? `${fmt(r.area / 1e4, 1)} ha` : "", textoUbicacion(h.ubicacion)].filter(Boolean).join(" · "))}</small></span>
          ${chip(NOMBRE_ETAPA_VUELO[et], claseEt[et])}<small class="vu-vuelo-fecha">${f ? escapar(diaCorto2(f)) : "sin fecha"}</small></button>`;
        const perm = estadoPermiso(h);
        return `<article class="vu-vuelo abierto">
          <div class="vu-vuelo-cab"><span class="vu-vuelo-txt"><b>${escapar(h.nombre || "Vuelo sin nombre")}</b><small>${escapar([nomProy(h.proyectoId), h.mandante, (base.drones.find((d) => d.id === h.dronId) || {}).familiaNombre, r.modo === "lidar" ? "LiDAR" : "Fotogrametría", r.gsd ? `GSD ${fmt(r.gsd, 2)} cm` : ""].filter(Boolean).join(" · "))}</small></span>${chip(NOMBRE_ETAPA_VUELO[et], claseEt[et])}</div>
          <div class="vu-etapas-vuelo">${etapas}</div>
          <div class="vu-vuelo-datos">
            <div><small>Ubicación</small><b>${escapar(textoUbicacion(h.ubicacion) || "—")}</b></div>
            <div><small>${r.corredor ? "Corredor" : "Superficie"}</small><b>${r.area ? `${fmt(r.area / 1e4, 1)} ha${r.largo ? ` · ${fmt(r.largo / 1e3, 1)} km` : ""}` : "—"}${r.sectores > 1 ? ` · ${r.sectores} sectores` : ""}</b></div>
            <div><small>Próxima jornada</small><b>${f ? escapar(diaCorto2(f)) : "sin fecha"}${h.programa && h.programa.length > 1 ? ` · ${h.programa.length} días` : ""}</b></div>
            <div><small>Permiso DGAC</small><b>${escapar(perm.texto)}</b></div>
          </div>
          <div class="vu-vuelo-acc"><button type="button" class="sis-btn primario vu-abrir" data-accion="abrir-hoja" data-id="${escapar(h.id)}">Abrir vuelo</button>
            <button type="button" class="sis-btn chico peligro" data-accion="eliminar-hoja" data-id="${escapar(h.id)}">Eliminar</button></div>
        </article>`;
      };
      return `<div class="sis-cab"><h1>Vuelos</h1><button class="sis-btn primario" data-accion="nueva-hoja">Planificación</button></div>
      <p class="sis-tenue">Los vuelos que se están realizando o que hay que hacer, con su estado. «Planificación» arma un vuelo nuevo paso a paso.</p>
      <div class="vu-filtros">
        <div class="vu-chips-filtro" role="group" aria-label="Filtrar por estado">
          <button type="button" class="vu-chip-f${!st.filtroEtapa ? " activo" : ""}" data-accion="filtro-etapa" data-e="">Todos ${todas.length}</button>
          ${ETAPAS_VUELO.filter(([k]) => k !== "procesado" || st.verProcesados).map(([k, t]) => `<button type="button" class="vu-chip-f${st.filtroEtapa === k ? " activo" : ""}" data-accion="filtro-etapa" data-e="${k}">${t} ${cuenta2[k]}</button>`).join("")}
        </div>
        <label class="sis-campo vu-filtro"><span>Proyecto</span><select data-campo="filtroProyecto"><option value="">Todos</option>${base.proyectos.map((p) => `<option value="${escapar(p.id)}" ${p.id === st.filtroProyecto ? "selected" : ""}>${escapar(p.id === OFICINA_ID ? "Oficina" : p.nombre)}</option>`).join("")}</select></label>
        <label class="sis-check"><input type="checkbox" data-campo="verProcesados" ${st.verProcesados ? "checked" : ""}> Mostrar procesados (${cuenta2.procesado})</label>
      </div>
      <div class="vu-resumen-vuelos">
        <div class="vu-lista-vuelos">${lista.length ? lista.map(tarjeta).join("") : `<div class="sis-vacio"><p>${base.hojas.length ? "No hay vuelos con este filtro." : "Todavía no hay vuelos. Toca «Planificación» y carga el KMZ del área."}</p></div>`}</div>
        ${sel ? htmlPronLateral(sel) : ""}
      </div>`;
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
        identificacion: faltantes("identificacion").length ? h.nombre ? "aviso" : "" : "ok",
        area: g ? g.fallidos.length ? "aviso" : "ok" : "",
        vuelo: t ? t.excede ? "aviso" : "ok" : "",
        clima: c ? climaObs ? "aviso" : "ok" : "",
        permisos: perm.nivel === "ok" && consultasHechas(h) && !faltantes("permisos").length ? "ok" : h.permisos.dgac.preparado || h.permisos.consultas.length || Object.keys(h.permisos.docsEstado || {}).length ? "aviso" : ""
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
        <div class="sis-acciones">${chip(NOMBRE_ETAPA_VUELO[etapaVuelo(h)], (ETAPAS_VUELO.find((e) => e[0] === etapaVuelo(h)) || [])[2] || "gris")}
          <button class="sis-btn chico" data-accion="imprimir" ${g ? "" : "disabled"}>Hoja para terreno (PDF)</button>
          ${h.estado === "borrador" ? '<button class="sis-btn chico primario" data-accion="estado" data-e="lista">Programar</button>' : h.estado === "lista" ? '<button class="sis-btn chico primario" data-accion="estado" data-e="volada">Marcar volado</button><button class="sis-btn chico" data-accion="estado" data-e="borrador">Volver a planificación</button>' : h.procesado ? '<button class="sis-btn chico" data-accion="procesado" data-v="0">Quitar «procesado»</button>' : `${(h.permisos.logs || []).length ? "" : '<button class="sis-btn chico primario" data-accion="paso" data-paso="permisos">Cargar log</button>'}<button class="sis-btn chico${(h.permisos.logs || []).length ? " primario" : ""}" data-accion="procesado" data-v="1">Marcar procesado</button><button class="sis-btn chico" data-accion="estado" data-e="lista">Volver a programado</button>`}
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
      <nav class="vu-pasos vu-stepper" aria-label="Pasos de la planificación">
        <button class="vu-paso vu-paso-res${st.paso === "resumen" ? " activo" : ""}" data-accion="paso" data-paso="resumen">Resumen</button>
        ${PASOS.map(([k, t2], n) => {
        const mk = marcas[k];
        return `<button class="vu-paso${st.paso === k ? " activo" : ""} ${mk || "pend"}" data-accion="paso" data-paso="${k}" ${st.paso === k ? 'aria-current="step"' : ""}><span class="vu-paso-n">${mk === "ok" ? "✓" : mk === "aviso" ? "!" : n + 1}</span>${t2.replace(/^\d · /, "")}</button>`;
      }).join("")}</nav>`;
    }
    const COLORES_DIA = ["#4FC3F7", "#C6F15A", "#FFD54F", "#FF8A80", "#B39DDB", "#80CBC4", "#F48FB1", "#AED581"];
    const colorDia = (k) => COLORES_DIA[k % COLORES_DIA.length];
    function miniatura(g, diaDe) {
      const todos2 = g.sectores.flatMap((s) => s.poligono);
      if (!todos2.length) return "";
      const xs = todos2.map((p) => p[0]), ys = todos2.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const W = 700, H = 220, m = 12, k = Math.min((W - 2 * m) / (x1 - x0 || 1), (H - 2 * m) / (y1 - y0 || 1));
      const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
      const pt = (p) => `${(ox + (p[0] - x0) * k).toFixed(1)},${(H - oy - (p[1] - y0) * k).toFixed(1)}`;
      const poli = (s, i) => {
        var _a, _b;
        const paso = Math.max(1, Math.ceil(s.poligono.length / 400));
        return `<polygon points="${s.poligono.filter((_, j) => j % paso === 0).map(pt).join(" ")}" fill="${colorDia((_a = diaDe[i]) != null ? _a : 0)}" fill-opacity=".8" stroke="${colorDia((_b = diaDe[i]) != null ? _b : 0)}" stroke-width="7" stroke-linejoin="round" paint-order="stroke"><title>${escapar(nombreSector(st.hoja, i, g.sectores.length))}</title></polygon>`;
      };
      return `<svg class="vu-res-mapa" viewBox="0 0 ${W} ${H}" role="img" aria-label="Esquema del área con sus sectores">${g.sectores.map(poli).join("")}</svg>`;
    }
    function cinta(g, t, diaDe) {
      const h = st.hoja, n = g.sectores.length;
      const medida = (s) => (s.rango ? s.rango[1] - s.rango[0] : s.largo) || s.area || 1;
      const total = g.sectores.reduce((a, s) => a + medida(s), 0) || 1;
      const lineal = g.sectores.some((s) => s.dm);
      const ext = lineal ? [g.sectores[0].dm, g.sectores[n - 1].dm] : null;
      return `<div class="vu-cinta-res">${lineal ? `<div class="vu-cinta-ext"><span>${escapar(kmADm(Math.min(...ext.flat())))}</span><span>${n} sectores</span><span>${escapar(kmADm(Math.max(...ext.flat())))}</span></div>` : ""}
      <div class="vu-cinta-barra">${g.sectores.map((s, i) => {
        var _a;
        return `<i style="flex: 0 0 ${(100 * medida(s) / total).toFixed(3)}%; background: ${colorDia((_a = diaDe[i]) != null ? _a : 0)}" title="${escapar(nombreSector(h, i, n))} · ${fmt(s.area / 1e4, 1)} ha${t.sectores[i] ? ` · ${t.sectores[i].vuelos} bat. · ${fmtDuracion(t.sectores[i].minTotal)}` : ""}${diaDe[i] != null ? ` · día ${diaDe[i] + 1}` : ""}"></i>`;
      }).join("")}</div></div>`;
    }
    function vistaResumen() {
      const h = st.hoja, g = geo(), d = dron(), t = g && d ? totales(h, d, g) : null, c = h.clima, perm = estadoPermiso(h);
      const zonas = g ? zonasDeHoja() : [];
      const climaObs = c && c.checklist && c.checklist.some((x) => !x.cumple);
      const jor = t ? jornadasNecesarias(h, d, g, t) : null;
      const diaDe = {};
      if (jor) jor.dias.forEach((di, k) => di.sectores.forEach((i) => {
        diaDe[i] = k;
      }));
      const hor = { ...HORARIO_INICIAL, ...h.params.horario || {} };
      const fechas = jor && h.fecha ? diasHabilesDesde(h.fecha, jor.dias.length) : [];
      const programado = Array.isArray(h.programa) && h.programa.length;
      const limiteDgac = h.fecha ? restarHabiles(h.programa && h.programa[0] && h.programa[0].fecha || h.fecha, 7) : null;
      const hoy = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const pasos = [
        ["area", "Área", g ? g.fallidos.length ? "aviso" : "ok" : "pend", g ? `${g.sectores.length} sector${g.sectores.length === 1 ? "" : "es"}` : "falta el área"],
        ["vuelo", "Vuelo", t ? t.excede ? "aviso" : "ok" : "pend", t ? `${t.baterias} baterías${jor && jor.dias.length ? ` · ${jor.dias.length} jornada${jor.dias.length === 1 ? "" : "s"}` : ""}` : "—"],
        ["clima", "Clima", c ? climaObs ? "aviso" : "ok" : "pend", c ? c.ventana ? `ventana ${c.ventana}` : "sin ventana" : "sin consultar"],
        ["permisos", "Permisos", perm.nivel === "ok" ? "ok" : perm.nivel === "aviso" || limiteDgac && limiteDgac <= hoy && !h.permisos.dgac.enviado ? "aviso" : "pend", h.permisos.dgac.enviado || h.permisos.dgac.aprobado ? perm.texto.toLowerCase() : limiteDgac ? `enviar DGAC antes del ${fechaLegible(limiteDgac)}` : perm.detalle]
      ];
      const listos = pasos.filter((p) => p[2] === "ok").length;
      const siguiente = pasos.find((p) => p[2] !== "ok");
      const icono = (e, n) => e === "ok" ? "✓" : e === "aviso" ? "!" : n;
      return `<section class="sis-tarjeta vu-res-avance">
        <div class="vu-res-pasos">${pasos.map(([k, tt, e, det], n) => `<button type="button" class="vu-res-paso ${e}" data-accion="paso" data-paso="${k}"><span class="vu-res-ic">${icono(e, n + 1)}</span><span><b>${tt}</b><small>${escapar(det)}</small></span></button>`).join("")}
          ${siguiente ? `<button class="sis-btn primario" data-accion="paso" data-paso="${siguiente[0]}">Siguiente: ${{ area: "cargar el área", vuelo: "ajustar el vuelo", clima: "consultar el clima", permisos: "permisos y consultas" }[siguiente[0]]} →</button>` : '<span class="sis-chip verde">Todo listo</span>'}</div>
        <div class="vu-res-progreso"><i style="width: ${listos * 25}%"></i></div>
      </section>
      <section class="sis-tarjeta vu-datos-hoja"><div class="vu-datos-grilla">
          <label class="sis-campo"><span>Nombre</span><input data-hoja="nombre" value="${escapar(h.nombre)}" placeholder="El Pimiento — vuelo 1"></label>
          <label class="sis-campo"><span>Proyecto</span><select data-hoja="proyectoId">${opcionesProyectos(h.proyectoId)}</select></label>
          <label class="sis-campo"><span>Primer día de vuelo</span><input type="date" data-hoja="fecha" value="${escapar(h.fecha || "")}"></label>
          <label class="sis-campo"><span>Piloto</span><select data-hoja="pilotoId"><option value="">—</option>${base.personas.map((p) => `<option value="${escapar(p.id)}" ${p.id === h.pilotoId ? "selected" : ""}>${escapar(p.nombre)}</option>`).join("")}</select></label>
        </div></section>
      <div class="vu-res-dos">
        <section class="sis-tarjeta vu-res-card">
          <div class="vu-res-tit"><h2>1 · Área</h2><button class="vu-link" data-accion="paso" data-paso="area">${g ? "Editar área" : "Cargar área"} →</button></div>
          ${g ? `${miniatura(g, diaDe)}
            <div class="vu-res-datos">
              <div><small>Origen</small><b>${escapar(h.area.archivo || "—")}</b></div>
              <div><small>${g.tipo === "corredor" ? "Corredor" : "Superficie"}</small><b>${g.tipo === "corredor" ? `${fmt(g.sectores.reduce((s, x) => s + x.largo, 0) / 1e3, 2)} km · ${fmt(g.izq + g.der, 0)} m` : `${fmt(g.areaVuelo / 1e4, 1)} ha${Number(h.area.margen) ? ` · +${h.area.margen} m` : ""}`}</b></div>
              <div><small>Sectores</small><b>${g.sectores.length}${g.sectores.length > 1 ? ` · ~${g.tipo === "corredor" || g.sectores.some((s) => s.rango) ? `${fmt(g.sectores.reduce((a, s) => a + ((s.rango ? s.rango[1] - s.rango[0] : s.largo) || 0), 0) / g.sectores.length / 1e3, 1)} km` : `${fmt(g.areaVuelo / g.sectores.length / 1e4, 1)} ha`} c/u` : ""}</b></div>
              <div class="${zonas && zonas.some((z) => z.toca || z.distancia < 5e3) ? "aviso" : ""}"><small>Zonas</small><b>${zonas === null ? "sin capas cargadas" : zonas.length ? zonas.slice(0, 1).map((z) => `${z.toca ? "toca " : ""}${escapar(z.nombre)}${z.toca ? "" : ` a ${fmt(z.distancia / 1e3, 1)} km`}`).join("") : "no toca zonas cargadas"}</b></div>
            </div>
            ${g.sectores.length > 1 && t ? `${cinta(g, t, diaDe)}<p class="sis-tenue vu-res-nota">Pasa el mouse por la cinta para ver cada sector. Los colores son las jornadas de vuelo.</p>` : ""}` : '<p class="sis-tenue">Carga el KMZ/KML del área (o la línea del corredor), o dibújala en el mapa.</p>'}
        </section>
        <section class="sis-tarjeta vu-res-card">
          <div class="vu-res-tit"><h2>2 · Vuelo</h2><button class="vu-link" data-accion="paso" data-paso="vuelo">Ajustar →</button></div>
          ${t ? `<div class="vu-mini-kpis">${kpi("GSD", h.params.modo === "lidar" ? "—" : `${fmt(t.gsd, 2)} cm`)}${kpi("Altura", `${fmt(t.altura, 0)} m`)}${kpi("Baterías", t.baterias)}${kpi("Fotos", fmt(t.fotos))}</div>
            <p class="vu-res-linea"><span>Traslapes ${h.params.traslapeFrontal}/${h.params.traslapeLateral} % · ${t.sectores[0] ? fmt(t.sectores[0].velocidad, 1) : "—"} m/s</span><span>En el aire ${fmtDuracion(t.minVuelo)} · jornada ${fmtDuracion(t.minJornada)}</span></p>
            <div class="vu-jornadas">
              <div class="vu-jornadas-cab"><b>Jornadas necesarias: ${jor ? jor.dias.length : "—"}</b>
                <span class="vu-horario">Horario <input type="time" data-horario="inicio" value="${escapar(hor.inicio)}" aria-label="Hora de inicio">–<input type="time" data-horario="fin" value="${escapar(hor.fin)}" aria-label="Hora de término">
                  · pausa <input type="number" min="0" max="240" step="5" data-horario="pausa" value="${escapar(hor.pausa)}" aria-label="Pausa en minutos"> min
                  · traslado entre sectores <input type="number" min="0" max="240" step="5" data-horario="traslado" value="${escapar(hor.traslado)}" aria-label="Traslado entre sectores en minutos"> min</span></div>
              ${jor && jor.util ? `<div class="vu-dias">${jor.dias.map((di, k) => {
        const a = di.sectores[0], b = di.sectores[di.sectores.length - 1], n = g.sectores.length;
        const rango = n > 1 ? a === b ? nombreSector(h, a, n) : g.sectores[a].dm && g.sectores[b].dm ? `${kmADm(Math.min(...g.sectores[a].dm, ...g.sectores[b].dm))} – ${kmADm(Math.max(...g.sectores[a].dm, ...g.sectores[b].dm))}` : `${nombreSector(h, a, n)} a ${nombreSector(h, b, n)}` : "Área completa";
        return `<b>Día ${k + 1}${fechas[k] ? `<small>${escapar(diaCorto2(fechas[k]))}</small>` : ""}</b><div class="vu-dia-barra"><i style="width: ${Math.min(100, 100 * di.min / jor.util).toFixed(1)}%; background: ${colorDia(k)}"></i></div><span class="vu-dia-min${di.excede ? " vu-rojo" : ""}">${fmtDuracion(di.min)}</span>
                  <span></span><small class="vu-dia-det">${escapar(rango)} · ${di.sectores.length} sector${di.sectores.length === 1 ? "" : "es"} · ${di.baterias} batería${di.baterias === 1 ? "" : "s"}${di.excede ? " · <b>no cabe en el horario: divide el sector</b>" : ""}</small><span></span>`;
      }).join("")}</div>
                <p class="sis-tenue vu-res-nota">Cada día toma sectores completos, en orden${g.sectores.some((s) => s.dm) ? " (sentido del eje)" : ""}, hasta llenar ${fmtDuracion(jor.util)} útiles. ${h.fecha ? "Días hábiles desde el primer día de vuelo." : "Pon el primer día de vuelo para ver las fechas."}</p>
                <div class="sis-acciones"><button class="sis-btn chico${programado ? "" : " primario"}" data-accion="programar" ${h.fecha ? "" : "disabled"}>${programado ? `Actualizar el calendario (${h.programa.length} días)` : `Agregar ${jor.dias.length === 1 ? "la jornada" : `las ${jor.dias.length} jornadas`} al calendario`}</button>${programado ? '<button class="sis-btn chico" data-accion="desprogramar">Quitar del calendario</button>' : ""}</div>` : '<p class="vu-rojo">Revisa el horario: el término debe ser después del inicio.</p>'}
            </div>` : '<p class="sis-tenue">Cuando cargues el área, aquí aparece el plan de vuelo.</p>'}
        </section>
      </div>
      <div class="vu-res-dos">
        <section class="sis-tarjeta vu-res-card">
          <div class="vu-res-tit"><h2>3 · Clima</h2><button class="vu-link" data-accion="paso" data-paso="clima">${c ? "Ver pronóstico" : "Consultar"} →</button></div>
          ${fechas.length ? `<div class="vu-clima-dias">${fechas.map((f, k) => {
        const esta = c && c.fecha === f;
        const cl = esta ? c.ventana ? climaObs ? "aviso" : "ok" : "mal" : "gris";
        return `<div class="vu-clima-dia ${cl}"><b>Día ${k + 1}</b><small>${escapar(diaCorto2(f))}</small><span>${esta ? (c.ventana ? `Ventana ${escapar(c.ventana)}` : "Sin ventana") + (c.rafaga ? ` · ráfaga ${fmt(c.rafaga.v, 1)} m/s` : "") : "sin consultar"}</span></div>`;
      }).join("")}</div>` : ""}
          ${c ? `<p class="sis-tenue vu-res-nota">Consultado ${fechaHora(c.consultadoEn)} para el ${fechaLegible(c.fecha)}.${(() => {
        const m = resumenMetar(h.metar);
        return m ? ` METAR ${escapar(m.icao)}: ${escapar(m.categoria)}${m.viento ? ` · ${fmt(m.viento.ms, 1)} m/s` : ""}.` : "";
      })()}</p>
            ${(c.checklist || []).filter((x) => !x.cumple).length ? `<ul class="vu-res-obs">${c.checklist.filter((x) => !x.cumple).map((x) => `<li>${escapar(x.texto)}: ${escapar(x.detalle)}</li>`).join("")}</ul>` : ""}` : '<p class="sis-tenue vu-res-nota">Consulta el pronóstico de cada día de vuelo: viento a 120 m, ráfagas, lluvia, nubes, temperatura, Kp y METAR.</p>'}
        </section>
        <section class="sis-tarjeta vu-res-card">
          <div class="vu-res-tit"><h2>4 · Permisos y consultas</h2><button class="vu-link" data-accion="paso" data-paso="permisos">Abrir →</button></div>
          ${(() => {
        const dg = h.permisos.dgac;
        const et = [
          ["Enviar", dg.enviado ? `enviada ${fechaLegible(dg.enviado)}` : limiteDgac ? `antes del ${fechaLegible(limiteDgac)}` : "mín. 7 días hábiles antes", dg.enviado ? "ok" : limiteDgac && limiteDgac <= hoy ? "mal" : "actual"],
          ["En trámite", dg.enviado && !dg.aprobado ? "esperando respuesta" : "", dg.aprobado ? "ok" : dg.enviado ? "actual" : ""],
          ["Aprobada", dg.aprobado ? dg.vence ? `hasta ${fechaLegible(dg.vence)}` : "sin término" : "", dg.aprobado ? "ok" : ""],
          ["Vuelo", h.fecha ? fechaLegible(h.fecha) : "sin fecha", ""]
        ];
        return `<div class="vu-etapas">${et.map(([a, b, e]) => `<div class="vu-etapa ${e}"><b>${a}</b><small>${escapar(b)}</small></div>`).join("")}</div>`;
      })()}
          <div class="vu-res-chips">${CONSULTAS.map(([k, tt]) => {
        const x = ultimaConsulta(h, k);
        return chip(`${tt.split(/[:(]/)[0].trim()} · ${x ? `revisado ${fechaLegible(x.fecha.slice(0, 10))}` : "pendiente"}`, x ? "verde" : "gris");
      }).join("")}
            ${(() => {
        const ds = documentosPermiso(h), listos2 = ds.filter((x) => x.listo).length;
        return chip(`Documentos ${listos2}/${ds.length}`, listos2 === ds.length ? "verde" : "gris");
      })()}</div>
          <p class="sis-tenue vu-res-nota">La fecha límite sale de la regla de 7 días hábiles antes del primer día de vuelo.</p>
        </section>
      </div>`;
    }
    const proyectoDe = (h) => base.proyectos.find((p) => p.id === h.proyectoId) || null;
    function vistaIdentificacion() {
      const h = st.hoja, p = proyectoDe(h);
      return `<section class="sis-tarjeta vu-identif"><h2>¿Qué se vuela y quién lo encargó?</h2>
        <div class="vu-datos-grilla">
          <label class="sis-campo vu-ancho"><span>Nombre del proyecto o vuelo *</span><input data-hoja="nombre" value="${escapar(h.nombre)}" placeholder="Planta Norte — vuelo 1"></label>
          <label class="sis-campo"><span>Proyecto</span><select data-hoja="proyectoId">${opcionesProyectos(h.proyectoId)}</select></label>
          <label class="sis-campo"><span>Mandante *</span><input data-identif="mandante" value="${escapar(h.mandante || "")}" placeholder="${escapar(p && p.mandante || "Empresa que encarga el trabajo")}"></label>
          <label class="sis-campo"><span>Jefe que encargó el trabajo *</span><input data-identif="jefe" value="${escapar(h.jefe || "")}" placeholder="${escapar(p && p.solicitadoPor || "Nombre y cargo")}"></label>
          <label class="sis-campo"><span>Primer día de vuelo</span><input type="date" data-hoja="fecha" value="${escapar(h.fecha || "")}"></label>
          <label class="sis-campo"><span>Piloto</span><select data-hoja="pilotoId"><option value="">—</option>${base.personas.map((x) => `<option value="${escapar(x.id)}" ${x.id === h.pilotoId ? "selected" : ""}>${escapar(x.nombre)}</option>`).join("")}</select></label>
        </div>
        <p class="sis-tenue">Al elegir el proyecto se completan el mandante y quien lo encargó desde su ficha. Se pueden cambiar para este vuelo.</p>
      </section>`;
    }
    function faltantes(paso) {
      const h = st.hoja, g = geo(), d = dron(), out = [];
      if (paso === "identificacion") {
        if (!h.nombre) out.push("el nombre del proyecto o vuelo");
        if (!h.mandante && !(proyectoDe(h) || {}).mandante) out.push("el mandante");
        if (!h.jefe && !(proyectoDe(h) || {}).solicitadoPor) out.push("quién encargó el trabajo");
        if (!h.fecha) out.push("el primer día de vuelo");
        if (!h.pilotoId) out.push("el piloto");
      } else if (paso === "area") {
        if (!g) out.push("el área (KMZ, KML o dibujada)");
        else {
          if (!(h.ubicacion && (h.ubicacion.comuna || h.ubicacion.region))) out.push("la comuna y la región");
          if (g.fallidos.length) out.push("revisar los cortes que no cruzan el área");
          const t = d ? totales(h, d, g) : null;
          if (t && g.sectores.length === 1 && (t.baterias > 6 || t.excede)) out.push("dividir el área en sectores (es grande)");
        }
      } else if (paso === "vuelo") {
        const t = g && d ? totales(h, d, g) : null;
        if (!t) out.push("el área");
        else if (t.excede) out.push("acercar el despegue o dividir: hay tramos que no alcanzan con una batería");
      } else if (paso === "clima") {
        if (!h.clima) out.push("consultar el pronóstico del día de vuelo");
        else if (h.clima.checklist && h.clima.checklist.some((x) => !x.cumple)) out.push("revisar el checklist del clima");
      } else if (paso === "permisos") {
        const pend = documentosPermiso(h).filter((x) => !x.listo).length;
        if (pend) out.push(`${pend} documento${pend === 1 ? "" : "s"} de la solicitud`);
        if (!h.permisos.dgac.enviado && !h.permisos.dgac.aprobado) out.push("enviar la solicitud a la DGAC");
        if (h.estado === "volada" && !(h.permisos.logs || []).length) out.push("cargar el log del vuelo");
      }
      return out;
    }
    function pieDePaso() {
      const k = PASOS.findIndex(([p]) => p === st.paso);
      if (k < 0) return "";
      const falta = faltantes(st.paso), ant = PASOS[k - 1], sig = PASOS[k + 1];
      return `<div class="vu-pie-paso${falta.length ? " con-aviso" : ""}">
      <div class="vu-pie-aviso">${falta.length ? `<b>Falta información importante:</b> ${escapar(falta.join(" · "))}. Puedes seguir y completarla después.` : '<span class="vu-verde">✓ Paso completo</span>'}</div>
      <div class="sis-acciones">${ant ? `<button class="sis-btn" data-accion="paso" data-paso="${ant[0]}">← Anterior</button>` : '<button class="sis-btn" data-accion="paso" data-paso="resumen">← Resumen</button>'}
        ${sig ? `<button class="sis-btn primario" data-accion="paso" data-paso="${sig[0]}">Siguiente: ${escapar(sig[1].replace(/^\d · /, ""))} →</button>` : '<button class="sis-btn primario" data-accion="paso" data-paso="resumen">Terminar: ver resumen</button>'}</div>
    </div>`;
    }
    const DIAS_SEM = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
    const diaCorto2 = (iso) => {
      const [y, m, dd] = iso.split("-").map(Number);
      return `${DIAS_SEM[new Date(y, m - 1, dd, 12).getDay()]} ${dd}-${String(m).padStart(2, "0")}`;
    };
    return { vistaHojas, encabezadoHoja, vistaResumen, ultimaConsulta, vistaIdentificacion, pieDePaso, faltantes };
  }

  // modulos/vuelos/paso-area.js
  function crearPasoArea(v) {
    const ref = (n) => (...a) => v[n](...a);
    const { st, base } = v;
    const geo = ref("geo");
    const dron = ref("dron");
    const capasActivas = ref("capasActivas");
    const familias = ref("familias");
    function zonasDeHoja() {
      const g = geo();
      if (!g || !st.capas || !st.capas.length) return null;
      return revisarZonas(g.vuelo.map(g.marco.aLonLat), g.marco, st.capas, capasActivas());
    }
    const SUBS = [["origen", "Origen"], ["forma", "Forma"], ["sectores", "Sectores"]];
    function subActual() {
      const a = st.hoja.area;
      if (!a.tipo) return "origen";
      if (st.subArea === "zonas") {
        st.subArea = "sectores";
        st.zonasAbiertas = true;
      }
      return SUBS.some(([k]) => k === st.subArea) ? st.subArea : "forma";
    }
    function htmlSubs(g) {
      const a = st.hoja.area, act = subActual();
      const zonas = g ? zonasDeHoja() || [] : [];
      const cerca = zonas.filter((z) => z.toca || z.distancia < 5e3).length;
      const marca = { origen: a.tipo ? " ✓" : "", forma: g ? " ✓" : "", sectores: `${g && g.sectores.length > 1 ? ` · ${g.sectores.length}` : ""}${cerca ? " · !" : ""}` };
      return `<div class="vu-subs" role="tablist" aria-label="Partes del área">${SUBS.map(([k, t]) => `<button type="button" role="tab" aria-selected="${act === k}" class="vu-sub${act === k ? " activo" : ""}${k === "sectores" && cerca ? " aviso" : ""}" data-accion="sub-area" data-s="${k}" ${!a.tipo && k !== "origen" ? "disabled" : ""}>${t}${marca[k]}</button>`).join("")}</div>`;
    }
    function extremosEje() {
      const a = st.hoja.area, linea = lineaEje(a);
      if (!linea || linea.length < 2) return null;
      const m = marcoDe(linea), L = largo(linea.map(m.aXY));
      return { L, ini: kmEnEje(a, a.dm && a.dm.inv ? L : 0, L), fin: kmEnEje(a, a.dm && a.dm.inv ? 0 : L, L) };
    }
    function htmlDm() {
      const dm = st.hoja.area.dm || {}, x = extremosEje();
      return `<div class="vu-sentido">
        <div class="vu-sentido-fila"><span class="vu-marca-ini">Inicio</span><b class="vu-mono">${x ? kmADm(x.ini) : "—"}</b><span class="sis-tenue">${dm.inv ? "último vértice del archivo" : "primer vértice del archivo"}</span></div>
        <div class="vu-sentido-fila"><span class="vu-marca-fin">Fin</span><b class="vu-mono">${x ? kmADm(x.fin) : "—"}</b><span class="sis-tenue">${dm.inv ? "primer vértice del archivo" : "último vértice del archivo"}</span></div>
        <button type="button" class="sis-btn chico" data-accion="invertir-sentido">⇄ Invertir sentido</button>
        <p class="sis-tenue">El inicio y el fin se marcan en el mapa, con flechas en el sentido de avance. Al invertir, el DM, el orden de los sectores (S1 en el inicio) y sus nombres se recalculan.</p>
      </div>
      <div class="vu-fila-campos">
        <label class="sis-campo"><span>DM del inicio del eje</span><input data-auto="dm" value="${escapar(dm.texto || "")}" placeholder="0+000"></label>
        <label class="sis-check"><input type="checkbox" data-auto="desc" ${dm.desc ? "checked" : ""}> El DM decrece hacia el fin</label>
      </div>
      <p class="sis-tenue">Con el DM, los sectores se nombran por su tramo (10+000 – 15+000). Sin DM del inicio se cuenta desde 0+000.</p>`;
    }
    function htmlForma(g) {
      const a = st.hoja.area;
      if (a.tipo === "corredor") return `<section class="sis-tarjeta"><h2>Corredor</h2>
        ${deslizador("izq", a.corredor.mismo ? "Ancho a cada lado" : "Hacia la izquierda", a.corredor.izq, { min: 5, max: 300, paso: 1, sufijo: "m" })}
        ${a.corredor.mismo ? "" : deslizador("der", "Hacia la derecha", a.corredor.der, { min: 5, max: 300, paso: 1, sufijo: "m" })}
        <label class="sis-check"><input type="checkbox" data-area="mismo" ${a.corredor.mismo ? "checked" : ""}> Mismo ancho a los dos lados</label>
        ${a.corredor.mismo ? "" : '<button class="sis-btn chico" data-accion="invertir">Invertir izquierda y derecha</button>'}
        <p class="sis-tenue" id="vu-margen-info">${g ? textoCorredor(g) : ""}</p>
        ${a.original ? '<button class="sis-btn chico" data-accion="a-poligono">Volver a volarla como polígono</button>' : ""}
      </section>
      <section class="sis-tarjeta"><h2>Sentido y cadenamiento del eje</h2>${htmlDm()}</section>`;
      const f = g ? formaDe(st.hoja) : null;
      return `<section class="sis-tarjeta"><h2>Forma del área</h2>
        ${f && f.lineal ? `<div class="vu-forma"><b>Área lineal detectada</b>
            <dl><dt>Eje calculado</dt><dd>${fmt(f.largo / 1e3, 2)} km</dd><dt>Ancho</dt><dd>mín. ${fmt(f.anchoMin, 0)} m · prom. ${fmt(f.anchoProm, 0)} m · máx. ${fmt(f.anchoMax, 0)} m</dd><dt>Superficie</dt><dd>${fmt(g.areaVuelo / 1e4, 1)} ha</dd></dl>
            <p class="sis-tenue">El eje es la línea media entre los dos bordes (punteado blanco en el mapa). Con él se corta por DM y cada sector lleva su propio despegue.</p></div>
          <fieldset class="vu-como"><legend>Cómo volarla</legend>
            <label class="sis-check"><input type="radio" name="comoVolar" checked> <span><b>Polígono por sectores</b><small>Líneas paralelas dentro de cada sector, con su rumbo y su despegue.</small></span></label>
            <label class="sis-check"><input type="radio" name="comoVolar" data-accion-cambio="a-corredor"> <span><b>Corredor sobre el eje</b><small>Pasadas a lo largo del eje con el ancho medido (${fmt(Math.round(f.anchoMax / 2), 0)} m a cada lado). Para el modo corredor de DJI Pilot 2.</small></span></label>
          </fieldset>
          <h3 class="vu-subtit">Sentido y cadenamiento del eje</h3>${htmlDm()}` : g ? `<p><b>Área extensa</b> · ${fmt(g.areaVuelo / 1e4, 1)} ha. Para dividirla, usa «En N sectores» en la pestaña Sectores (cortes paralelos con la dirección que elijas).</p>` : ""}
      </section>
      <section class="sis-tarjeta"><h2>Margen</h2>
        ${deslizador("margen", "Margen hacia afuera", a.margen || 0, { min: 0, max: 100, paso: 1, sufijo: "m" })}
        <div class="vu-pildoras">${[0, 20, 30, 50].map((m) => `<button type="button" class="vu-pildora${Number(a.margen) === m ? " activo" : ""}" data-accion="margen" data-m="${m}">${m ? `${m} m` : "Sin margen"}</button>`).join("")}</div>
        <label class="sis-check"><input type="checkbox" data-area="rectas" ${a.rectas !== false ? "checked" : ""}> Esquinas rectas (como se hace a mano)</label>
        <p class="sis-tenue" id="vu-margen-info">${g ? `${fmt(areaM2(g.original) / 1e4, 2)} ha → <b>${fmt(g.areaVuelo / 1e4, 2)} ha</b> de vuelo` : ""}</p>
      </section>`;
    }
    function htmlVistaPrevia() {
      const au = st.hoja.area.auto || {}, modo = au.modo || metodoPropuesto(formaDe(st.hoja));
      if (modo === "medida") {
        const t = tramosVistaPrevia(st.hoja);
        if (!t) return "";
        const n = t.tramos.length, lista = n <= 6 ? t.tramos.join(" · ") : `${t.tramos.slice(0, 4).join(" · ")} · … · ${t.tramos[n - 1]}`;
        return `Vista previa: <b>${n} sector${n === 1 ? "" : "es"}</b><span class="vu-mono vu-tramos">${escapar(lista)}</span>`;
      }
      const v0 = vistaPrevia(st.hoja);
      return v0 ? `Vista previa: <b>${v0.sectores} sector${v0.sectores === 1 ? "" : "es"}</b> · ~${fmt(v0.haPorSector, 1)} ha cada uno` : "";
    }
    function htmlCortes(g) {
      const a = st.hoja.area, au = a.auto || {}, f = g ? formaDe(st.hoja) : null;
      const propuesto = metodoPropuesto(f);
      const modo = au.modo || propuesto;
      const opt = (k) => `<option value="${k}" ${modo === k ? "selected" : ""}>${METODOS[k].texto}${k === propuesto ? " (propuesto)" : ""}</option>`;
      const lineal = f && f.lineal;
      const num = (k, t, val, extra = "") => `<label class="sis-campo"><span>${t}</span><input type="number" data-auto="${k}" value="${escapar(val)}" ${extra}></label>`;
      const sel = (k, t, val, ops) => `<label class="sis-campo"><span>${t}</span><select data-auto="${k}">${ops.map(([v2, x]) => `<option value="${v2}" ${val === v2 ? "selected" : ""}>${x}</option>`).join("")}</select></label>`;
      const marcando = st.dibujo && st.dibujo.modo === "dmfijo";
      const fijos = au.fijos || [];
      const ultimo2 = fijos.length ? fijos[fijos.length - 1] : null;
      const campos = {
        medida: () => {
          var _a;
          return `<div class="sis-campo vu-ancho"><span>Cortes fijos (DM)</span>
          <div class="vu-chips">${fijos.length ? fijos.map((f2, i) => `<span class="vu-chip-dm">${escapar(f2)}<button type="button" data-accion="quitar-fijo" data-i="${i}" aria-label="Quitar el corte ${escapar(f2)}">✕</button></span>`).join("") : '<span class="sis-tenue">Sin cortes fijos: se corta desde el inicio.</span>'}</div>
          <div class="vu-fila-dm"><input id="vu-nuevo-fijo" placeholder="ej. 4+900" aria-label="DM del corte fijo"><button type="button" class="sis-btn chico" data-accion="agregar-fijo">+ Agregar</button>
            <button type="button" class="sis-btn chico${marcando ? " primario" : ""}" data-accion="dibujar" data-modo="dmfijo">◎ ${marcando ? "Marcando en el mapa" : "Marcar en el mapa"}</button></div></div>
        ${num("cada", ultimo2 ? `Después de ${escapar(ultimo2)}, cortar cada` : "Cortar cada", (_a = au.cada) != null ? _a : "5", 'min="0" step="any"')}${sel("unidad", "Unidad", au.unidad || "km", [["km", "km"], ["m", "m"]])}`;
        },
        distancia: () => {
          var _a;
          return `${num("cada", "Cortar cada", (_a = au.cada) != null ? _a : "5", 'min="0" step="any"')}${sel("unidad", "Unidad", au.unidad || "km", [["km", "km"], ["m", "m"]])}`;
        },
        superficie: () => {
          var _a;
          return `${num("sup", "Superficie de cada sector", (_a = au.sup) != null ? _a : "50", 'min="0" step="any"')}${sel("unidadSup", "Unidad", au.unidadSup || "ha", [["ha", "ha"], ["km2", "km²"]])}`;
        },
        dm: () => {
          var _a;
          return `${num("cada", "Cortar cada", (_a = au.cada) != null ? _a : "1", 'min="0" step="any"')}${sel("unidad", "Unidad", au.unidad || "km", [["km", "km"], ["m", "m"]])}<label class="sis-campo"><span>Primer corte en el DM</span><input data-auto="primer" value="${escapar(au.primer || "")}" placeholder="vacío: DM redondos"></label>`;
        },
        tramos: () => "",
        n: () => `<label class="sis-campo vu-ancho"><span>Cantidad de sectores: <b id="vu-n-txt">${escapar(au.n || 4)}</b></span><input type="range" min="2" max="30" step="1" data-auto="n" value="${escapar(au.n || 4)}"></label>
        ${lineal && a.tipo === "corredor" ? "" : `<div class="sis-campo vu-ancho"><span>Dirección de los cortes</span><div class="vu-rumbo-corte">
          <button type="button" class="sis-btn chico" data-accion="auto-rumbo" data-d="-5" aria-label="Girar 5 grados a la izquierda">⟲ 5°</button>
          <input type="number" min="0" max="179" data-auto="rumbo" value="${escapar(au.rumbo === "" || au.rumbo == null ? Math.round(rumboCortesPropuesto(st.hoja)) : au.rumbo)}" aria-label="Rumbo de los cortes en grados">
          <button type="button" class="sis-btn chico" data-accion="auto-rumbo" data-d="5" aria-label="Girar 5 grados a la derecha">⟳ 5°</button>
          <button type="button" class="sis-btn chico" data-accion="auto-lado">Lado más largo</button></div></div>
        <label class="sis-check"><input type="checkbox" data-auto="igual" ${au.igual !== false ? "checked" : ""}> Igual superficie (si no, igual distancia)</label>`}`,
        baterias: () => {
          var _a;
          return num("bat", "Baterías por sector (máx.)", (_a = au.bat) != null ? _a : "4", 'min="1" max="30"');
        },
        dias: () => {
          var _a;
          return num("horas", "Horas de vuelo por día", (_a = au.horas) != null ? _a : "6", 'min="1" max="14" step="0.5"');
        },
        manual: () => ""
      };
      return `<section class="sis-tarjeta"><h2>Cortes</h2>
      ${htmlTipoCorte(modo)}
      ${htmlMiniaturas(g, modo, propuesto)}
      <h3 class="vu-subt">${escapar(METODOS[modo] ? METODOS[modo].texto : "")}${modo === propuesto ? ' <small class="sis-tenue">(propuesto)</small>' : ""}</h3>
      <div class="vu-fila-campos">${(campos[modo] || (() => ""))()}</div>
      <p class="sis-tenue">${escapar(METODOS[modo] ? METODOS[modo].ayuda : "")}</p>
      <p class="vu-vista-previa" id="vu-vista-previa">${htmlVistaPrevia()}</p>
      <div class="sis-acciones">${modo === "manual" ? `<button class="sis-btn chico${st.dibujo && st.dibujo.modo === "corte" ? " primario" : ""}" data-accion="dibujar" data-modo="corte">✎ Trazar corte</button>` : modo === "vertices" ? `<button class="sis-btn chico${st.dibujo && st.dibujo.modo === "vertice" ? " primario" : ""}" data-accion="dibujar" data-modo="vertice">◎ ${st.dibujo && st.dibujo.modo === "vertice" ? "Tocando vértices en el mapa" : "Tocar vértices"}</button>` : '<button class="sis-btn chico primario" data-accion="auto-cortar">Generar cortes</button>'}
        ${a.cortes.length ? '<button class="sis-btn chico" data-accion="deshacer-corte">Deshacer último corte</button><button class="sis-btn chico" data-accion="quitar-cortes">Quitar todos</button>' : ""}</div>
      <p class="sis-tenue">Los cortes generados quedan como los manuales: sus vértices blancos se arrastran en el mapa.</p>
    </section>`;
    }
    function svgSectores(polis, sel, gris) {
      const todos2 = polis.flat();
      if (!todos2.length) return "";
      const xs = todos2.map((p) => p[0]), ys = todos2.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const W = 160, H = 96, m = 5, k = Math.min((W - 2 * m) / (x1 - x0 || 1), (H - 2 * m) / (y1 - y0 || 1));
      const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
      const pt = (p) => `${(ox + (p[0] - x0) * k).toFixed(1)},${(H - oy - (p[1] - y0) * k).toFixed(1)}`;
      return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" aria-hidden="true">${polis.map((pl, i) => {
        const paso = Math.max(1, Math.ceil(pl.length / 150));
        return `<polygon points="${pl.filter((_, j) => j % paso === 0).map(pt).join(" ")}" fill="${gris ? "#C9CED4" : COLORES_SECTOR[i % COLORES_SECTOR.length]}" fill-opacity="${sel ? 0.75 : 0.55}" stroke="#1C1F23" stroke-width="1.2" stroke-linejoin="round"></polygon>`;
      }).join("")}</svg>`;
    }
    const MANUALES = ["vertices", "manual"];
    function htmlTipoCorte(modo) {
      const manual = MANUALES.includes(modo);
      return `<div class="vu-tipo-corte" role="group" aria-label="Tipo de corte">
        <button type="button" class="${manual ? "" : "activo"}" data-accion="tipo-corte" data-t="auto" aria-pressed="${!manual}"><b>Automático</b><small>La app propone los cortes</small></button>
        <button type="button" class="${manual ? "activo" : ""}" data-accion="tipo-corte" data-t="manual" aria-pressed="${manual}"><b>Manual</b><small>Tú marcas cada corte en el mapa</small></button></div>`;
    }
    function metodosVisibles(modo) {
      const a = st.hoja.area, f = formaDe(st.hoja), corredor = a.tipo === "corredor";
      if (MANUALES.includes(modo)) return corredor ? ["manual"] : ["vertices", "manual"];
      return [...f && f.lineal ? METODOS_LINEALES : [], "n", ...corredor ? [] : ["cerrados"], "baterias", "dias"];
    }
    function htmlMiniaturas(g, modo, propuesto) {
      const h = st.hoja, a = h.area, au = a.auto || {};
      const lista = metodosVisibles(modo);
      const clave2 = JSON.stringify([lista, g.vuelo.length, g.vuelo[0], a.margen, a.rectas, a.corredor, a.dm, au, h.dronId, h.params, a.ejeCalc ? a.ejeCalc.largo : 0, MANUALES.includes(modo) ? [modo, a.cortes] : null]);
      if (!st.previas || st.previas.clave !== clave2) {
        const datos = lista.map((k) => {
          var _a;
          if (MANUALES.includes(k)) {
            const cortes = modo === k ? a.cortes : [];
            const gp = geometria({ ...h, area: { ...a, cortes, sectores: [] } });
            return { k, polis: gp ? gp.sectores.map((x) => x.poligono) : [g.vuelo], n: gp ? gp.sectores.length : 1, pendiente: !cortes.length };
          }
          if (k === "tramos") return { k, polis: [g.vuelo], n: 1, falta: "usa los tramos del Seguimiento" };
          if (k === "dm" && (!a.dm || a.dm.inicio == null)) return { k, polis: [g.vuelo], n: 1, falta: "falta el DM del inicio" };
          try {
            const cortes = generarCortes({ ...h, area: { ...a, auto: { ...au, modo: k }, cortes: [], sectores: [] } }, { dron: dron(), primerDM: (_a = au.primerKm) != null ? _a : null }).cortes;
            const gp = geometria({ ...h, area: { ...a, cortes, sectores: [] } });
            return { k, polis: gp ? gp.sectores.map((x) => x.poligono) : [], n: gp ? gp.sectores.length : 0 };
          } catch (e) {
            return { k, falta: "revisa los datos", polis: [g.vuelo], n: 1 };
          }
        });
        geometria(h);
        st.previas = { clave: clave2, datos };
      }
      const pie = (d) => d.falta ? d.falta : d.pendiente ? d.k === "vertices" ? "toca dos vértices" : "traza en el mapa" : `${d.n} sector${d.n === 1 ? "" : "es"}`;
      return `<div class="vu-metodos" role="group" aria-label="Vista previa de cada método de corte">${st.previas.datos.map((d) => `<button type="button" class="vu-metodo${d.k === modo ? " activo" : ""}${d.falta ? " sin-datos" : ""}" data-accion="elegir-metodo" data-m="${d.k}" title="${escapar(METODOS[d.k].ayuda)}">
        ${d.k === propuesto ? '<i class="vu-metodo-prop">propuesto</i>' : ""}${svgSectores(d.polis, d.k === modo, d.falta || d.pendiente)}<span>${escapar(METODOS[d.k].texto)}</span><small>${pie(d)}</small></button>`).join("")}</div>
      <p class="sis-tenue">Toca una vista previa para usar ese método. Sus ajustes están abajo.</p>`;
    }
    function htmlUbicacionDron() {
      const h = st.hoja, u = h.ubicacion || {}, d = dron(), fam = d.familia || d.id;
      const sensores = base.drones.filter((x) => (x.familia || x.id) === fam);
      const extranjero = u.codigoPais && u.codigoPais !== "CL";
      return `<section class="sis-tarjeta"><div class="sis-cab"><h2>Ubicación</h2>${h.area.tipo ? `<button class="sis-btn chico" data-accion="detectar-ubicacion">${st.ubicando ? "Buscando…" : "Detectar de nuevo"}</button>` : ""}</div>
        <div class="sis-par">
          <label class="sis-campo"><span>Comuna${u.auto ? " (automática)" : ""}</span><input data-ubic="comuna" value="${escapar(u.comuna || "")}" placeholder="${h.area.tipo ? "Se detecta al cargar el área" : "Carga el área"}"></label>
          <label class="sis-campo"><span>Región${u.auto ? " (automática)" : ""}</span><input data-ubic="region" value="${escapar(u.region || "")}"></label>
        </div>
        ${extranjero ? `<label class="sis-campo"><span>País</span><input data-ubic="pais" value="${escapar(u.pais || "")}"></label>` : ""}
        ${st.ubicError ? `<p class="vu-rojo">${escapar(st.ubicError)}</p>` : '<p class="sis-tenue">Se obtiene del centro del área (OpenStreetMap). En Chile solo se usan comuna y región. Puedes corregirla.</p>'}
      </section>
      <section class="sis-tarjeta"><h2>Dron y módulos</h2>
        <div class="${sensores.length > 1 ? "sis-par" : ""}">
          <label class="sis-campo"><span>Dron</span><select name="familia">${familias().map(([k, tt]) => `<option value="${escapar(k)}" ${k === fam ? "selected" : ""}>${escapar(tt)}</option>`).join("")}</select></label>
          ${sensores.length > 1 ? `<label class="sis-campo"><span>Módulo / sensor</span><select name="dronId">${sensores.map((x) => `<option value="${x.id}" ${x.id === h.dronId ? "selected" : ""}>${escapar(x.sensor || x.nombre)}</option>`).join("")}</select></label>` : `<p class="sis-tenue">Sensor: ${escapar(d.sensor || "—")}</p>`}
        </div>
        <p class="sis-tenue">Sensor ${fmt(d.sensorAnchoMm, 1)} × ${fmt(d.sensorAltoMm, 1)} mm · ${d.pixelesAncho} px · focal ${fmt(d.focalMm, 2)} mm${d.lidar ? ` · LiDAR ${fmt(d.lidar.fovGrados, 0)}°` : ""}. Los datos se corrigen en Equipos → Catálogo de sensores.</p>
      </section>`;
    }
    function vistaArea() {
      const h = st.hoja, a = h.area, g = geo(), d = dron(), t = g && d ? totales(h, d, g) : null;
      const grande = t && (t.baterias > UMBRAL_BATERIAS || t.excede) && g.sectores.length === 1;
      const sub3 = subActual();
      let tarjetas = "";
      if (sub3 === "origen") tarjetas = `<section class="sis-tarjeta"><h2>Origen</h2>
            <div class="sis-acciones">
              <label class="sis-btn vu-archivo">Cargar KML / KMZ<input type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" data-archivo="area" hidden></label>
              <button class="sis-btn${st.dibujo && st.dibujo.modo === "area" ? " primario" : ""}" data-accion="dibujar" data-modo="area">Dibujar área</button>
              <button class="sis-btn${st.dibujo && st.dibujo.modo === "eje" ? " primario" : ""}" data-accion="dibujar" data-modo="eje">Dibujar eje</button>
            </div>
            ${st.candidatos ? vistaCandidatos() : ""}
            ${a.tipo ? `<p class="sis-tenue vu-area-info">${escapar(a.archivo || "")} · ${a.tipo === "corredor" ? `eje de ${fmt((a.eje.largo || 0) / 1e3, 2)} km · ${a.eje.linea.length} vértices` : `${fmt(areaM2(proyectar(a.original.anillo).puntos) / 1e4, 2)} ha · ${a.original.anillo.length} vértices`}</p>
              ${(a.problemas || []).length ? `<div class="vu-aviso"><b>Detalles que se corrigen al descargar:</b><ul>${a.problemas.map((p) => `<li>${escapar(p)}</li>`).join("")}</ul></div>` : ""}
              <div class="sis-acciones"><button class="sis-btn chico" data-accion="kml-original">Descargar ${a.tipo === "corredor" ? "eje" : "área del mandante"} limpio (KML)</button>${g ? '<button class="sis-btn chico primario" data-accion="sub-area" data-s="forma">Siguiente: Forma →</button>' : ""}</div>` : ""}
          </section>${htmlUbicacionDron()}`;
      else if (sub3 === "forma") tarjetas = `${htmlForma(g)}${g ? '<div class="sis-acciones"><button class="sis-btn chico primario" data-accion="sub-area" data-s="sectores">Siguiente: Sectores →</button></div>' : ""}`;
      else if (sub3 === "sectores") {
        const zonas = g ? zonasDeHoja() || [] : [], cerca = zonas.filter((z) => z.toca || z.distancia < 5e3).length;
        tarjetas = `${g ? htmlCortes(g) : ""}
        <details class="sis-tarjeta vu-zonas-det"${st.zonasAbiertas || st.dibujo && st.dibujo.modo === "camino" ? " open" : ""}><summary><b>Zonas y caminos</b>${cerca ? ` <span class="sis-chip ambar">${cerca} cerca</span>` : ""}<span class="sis-tenue"> · aeródromos, zonas DGAC y caminos para el despegue</span></summary>
          <h3 class="vu-subtit">Zonas de referencia</h3><div id="vu-zonas">${htmlZonas()}</div>${htmlCaminos()}</details>`;
      }
      return `${grande ? `<div class="vu-banner"><div><b>El área es grande: ${fmt(g.areaVuelo / 1e4, 0)} ha · ${t.baterias} baterías · unas ${fmtDuracion(t.minVuelo)} de vuelo</b>
        <span>${t.excede ? "Parte del recorrido queda más lejos de lo que alcanza una batería desde el despegue. " : ""}Dividirla en sectores te deja planificar por día o por punto de despegue, con un rumbo y un KML para cada uno.</span></div>
        <button class="sis-btn primario" data-accion="sub-area" data-s="sectores">Dividir en sectores</button></div>` : ""}
      <div class="vu-dos vu-area">
        <div class="vu-izquierda">${htmlSubs(g)}${tarjetas}</div>
        <div class="vu-derecha">
          <div class="vu-mapa-caja vu-mapa-alto"><div class="vu-mapa-lugar" data-mapa="area"></div><div class="vu-mapa-barra" id="vu-barra-area">${barraDibujo()}</div></div>
          <p class="sis-tenue vu-pie">Punteado blanco: área del mandante y eje · naranjo: área de vuelo · colores: sectores · puntos azules: aeródromos${lineaEje(a) ? " · flechas: sentido de avance del DM" : ""}.</p>
        </div>
      </div>
      ${sub3 === "sectores" && g ? `<section class="sis-tarjeta vu-sectores-ancho"><div id="vu-sectores">${htmlSectores()}</div></section>` : ""}`;
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
    const largoSector = (s) => s.largo != null ? s.largo : s.rango ? s.rango[1] - s.rango[0] : null;
    function htmlCinta(g, sel) {
      const pesos = g.sectores.map((s) => {
        var _a;
        return (_a = largoSector(s)) != null ? _a : s.area;
      }), total = pesos.reduce((x2, y) => x2 + y, 0) || 1;
      const x = extremosEje(), conDm = g.sectores.some((s) => s.dm);
      let acum = 0;
      const marcas = [];
      const paso = Math.max(1, Math.ceil(g.sectores.length / 8));
      g.sectores.forEach((s, i) => {
        if (i % paso === 0 && s.dm) marcas.push(`<span class="vu-cinta-km" style="left:${(acum / total * 100).toFixed(2)}%">${kmADm(x && x.fin < x.ini ? s.dm[1] : s.dm[0])}</span>`);
        acum += pesos[i];
      });
      if (conDm && x) marcas.push(`<span class="vu-cinta-km fin">${kmADm(x.fin)}</span>`);
      return `<div class="vu-cinta" role="group" aria-label="Sectores a escala del eje">${g.sectores.map((s, i) => `<button type="button" class="vu-cinta-seg${i === sel ? " sel" : ""}" style="flex-grow:${(pesos[i] / total * 1e3).toFixed(2)}; background:${COLORES_SECTOR[i % COLORES_SECTOR.length]}" data-accion="sel-sector" data-i="${i}" title="S${i + 1}${s.dm ? " · " + kmADm(s.dm[0]) + " – " + kmADm(s.dm[1]) : ""}" aria-label="Sector ${i + 1}"></button>`).join("")}</div>
      ${marcas.length ? `<div class="vu-cinta-marcas">${marcas.join("")}</div>` : ""}`;
    }
    function htmlSectores() {
      const h = st.hoja, g = geo(), d = dron();
      if (!g) return "";
      const t = d ? totales(h, d, g) : null;
      const n = g.sectores.length, sel = Math.max(0, Math.min(h.area.sel || 0, n - 1));
      const lineal = g.sectores.some((s) => largoSector(s) != null);
      const kmTotal = lineal ? g.sectores.reduce((x, s) => x + (largoSector(s) || 0), 0) / 1e3 : null;
      const aviso = g.fallidos.length ? '<div class="vu-aviso">Un corte no atraviesa el área de lado a lado y no se aplicó: arrastra sus puntos o deshazlo.</div>' : "";
      const cab = `<div class="vu-sec-cab"><div><h2>Sectores${n > 1 ? " · " + n : ""}</h2>
        <span class="sis-tenue">Total: ${kmTotal != null ? fmt(kmTotal, 2) + " km · " : ""}${fmt(g.areaVuelo / 1e4, 1)} ha${t ? ` · ${t.baterias} baterías · ${fmtDuracion(t.minJornada)} de jornada` : ""}</span></div>
        ${n > 1 ? '<button class="sis-btn chico" data-accion="kml-sectores">Descargar KML de cada sector</button>' : ""}</div>`;
      const fila2 = (s, i) => {
        const r = t && t.sectores[i], L = largoSector(s);
        return `<tr class="${i === sel ? "sel" : ""}">
        <td><button type="button" class="vu-sec-id" data-accion="sel-sector" data-i="${i}" aria-label="Ver el sector ${i + 1} en el mapa"><i style="background:${COLORES_SECTOR[i % COLORES_SECTOR.length]}"></i>S${i + 1}</button></td>
        <td>${n > 1 ? `<input class="vu-sector-nombre" data-sector-nombre="${i}" value="${escapar(h.area.sectores[i] && h.area.sectores[i].nombre || "")}" placeholder="${escapar(s.dm ? `${kmADm(s.dm[0])} – ${kmADm(s.dm[1])}` : `S${i + 1}`)}" aria-label="Nombre del sector ${i + 1}">` : "<b>Área completa</b>"}</td>
        <td class="num">${L != null ? fmt(L / 1e3, 2) + " km" : "—"}</td><td class="num">${fmt(s.area / 1e4, 1)} ha</td>
        <td class="num">${r ? r.vuelos + " bat." : "—"}</td><td class="num">${r ? fmtDuracion(r.minTotal) : "—"}</td>
        <td class="acc">${n > 1 ? `<button class="vu-link" data-accion="kml-sector" data-i="${i}">KML</button>` : ""}<button class="vu-link" data-accion="ir-sector" data-i="${i}">volar →</button></td></tr>`;
      };
      return `${aviso}${cab}${n > 1 ? htmlCinta(g, sel) : ""}
      <div class="vu-sec-tabla"><table><thead><tr><th>Sector</th><th>Nombre (tramo)</th><th class="num">Largo</th><th class="num">Superficie</th><th class="num">Baterías</th><th class="num">Vuelo</th><th></th></tr></thead>
        <tbody>${g.sectores.map(fila2).join("")}</tbody></table></div>`;
    }
    function htmlZonas() {
      const capas = st.capas || [];
      const form = `<div class="vu-capa-form"><select data-campo="tipoCapa" aria-label="Tipo de capa">${Object.entries(TIPOS_CAPA).map(([k, v2]) => `<option value="${k}">${v2.nombre}</option>`).join("")}</select>
      <label class="sis-btn chico vu-archivo">+ Cargar capa (KMZ, KML o JSON)<input type="file" accept=".kml,.kmz,.json,.geojson" data-archivo="capa" hidden></label></div>`;
      if (!capas.length) return `<p class="sis-tenue">Aún no hay capas. Carga los archivos de aeródromos, zonas restringidas (DGAC) o áreas protegidas (CONAF) y se revisan contra el área.</p>${form}`;
      const activas = capasActivas();
      const zonas = zonasDeHoja();
      return `${zonas && zonas.length ? `<div class="vu-zonas-res">${zonas.slice(0, 4).map((z) => `<div class="${z.toca ? "vu-rojo" : ""}"><i style="background:${TIPOS_CAPA[z.tipo].color}"></i><span>${z.toca ? "<b>Toca</b> " : ""}${escapar(z.nombre)}${z.toca ? "" : ` · a ${fmt(z.distancia / 1e3, 1)} km`}<small>${escapar(z.capa)}</small></span></div>`).join("")}</div>` : geo() ? '<p class="vu-verde">No hay zonas cargadas a menos de 60 km.</p>' : ""}
      <fieldset class="vu-capas"><legend>Capas</legend>${capas.map((c) => `<label class="sis-check"><input type="checkbox" data-capa="${escapar(c.id)}" ${activas.includes(c.id) ? "checked" : ""}><i style="background:${TIPOS_CAPA[c.tipo].color}"></i>${escapar(c.nombre)} <small>${escapar(c.fecha || "")}${c.origen === "usuario" ? " · cargada aquí" : ""}</small>${c.origen === "usuario" ? ` <button class="vu-link" data-accion="quitar-capa" data-id="${escapar(c.id)}">quitar</button>` : ""}</label>`).join("")}</fieldset>
      ${form}
      <p class="sis-tenue">Referencial. La información aeronáutica oficial está en AIP Chile (DGAC).</p>`;
    }
    function htmlCaminos() {
      const cam = st.hoja.area.caminos || [];
      const dib2 = st.dibujo && st.dibujo.modo === "camino";
      return `<div class="vu-caminos-caja"><h3 class="vu-subtit">Caminos</h3>
      <label class="sis-check"><input type="checkbox" data-redvial ${st.redVial ? "checked" : ""}> Mostrar la red vial del MOP en los mapas</label>
      ${st.redVial ? `<p class="sis-tenue vu-caminos-info">${escapar(st.redVialInfo || "Cargando la red vial de la región…")}</p>` : ""}
      ${(() => {
        if (!cam.length) return "";
        const grupos = /* @__PURE__ */ new Map();
        for (const c of cam) {
          const k = c.grupo || c.nombre || "Camino";
          grupos.set(k, (grupos.get(k) || 0) + 1);
        }
        const lista = [...grupos];
        return `<ul class="vu-caminos">${lista.slice(0, 12).map(([k, n]) => `<li><i></i>${escapar(k)}${n > 1 ? ` <span class="sis-tenue">· ${n} tramos</span>` : ""} <button class="vu-link" data-accion="quitar-camino" data-g="${escapar(k)}">quitar</button></li>`).join("")}${lista.length > 12 ? `<li class="sis-tenue">… y ${lista.length - 12} más</li>` : ""}</ul>
          <button class="sis-btn chico" data-accion="quitar-camino">✕ Quitar todos los caminos (${cam.length})</button>`;
      })()}
      <div class="sis-acciones">
        <button class="sis-btn chico${dib2 ? " primario" : ""}" data-accion="dibujar" data-modo="camino">✎ Dibujar camino</button>
        <label class="sis-btn chico vu-archivo">Cargar caminos<input type="file" accept="${FORMATOS_CAMINO}" multiple data-archivo="camino" hidden></label>
      </div>
      <p class="sis-tenue">Agrega huellas o accesos que no estén en la red del MOP. En el paso 2 (Vuelo) se sugiere el despegue de cada sector sobre estos caminos. Es solo una referencia: acceso, rejas, permisos y línea de vista se confirman en terreno.</p>
      <p class="sis-tenue">Formatos: KML, KMZ, Shapefile (.zip, o .shp con su .dbf y .prj seleccionados juntos), GeoJSON y GPX. Los shapefiles en UTM se convierten solos.</p>
    </div>`;
    }
    function barraDibujo() {
      const dib2 = st.dibujo;
      if (!dib2) return st.hoja && !geo() ? '<span class="vu-barra-txt">Carga un KML/KMZ o dibuja el área o el eje.</span>' : "";
      if (dib2.modo === "dmfijo") return `<span class="vu-barra-txt">Toca el eje para agregar un corte fijo en ese DM</span><button type="button" class="vu-barra-btn fuerte" data-accion="dibujo-cancelar">Terminar</button>`;
      const min = dib2.modo === "area" ? 3 : 2;
      if (dib2.modo === "vertice") return `<span class="vu-barra-txt">${dib2.puntos.length ? "Ahora toca el otro vértice del corte" : "Toca un vértice del área (punto blanco) para empezar el corte"}</span>
      ${dib2.puntos.length ? '<button type="button" class="vu-barra-btn" data-accion="dibujo-deshacer">Deshacer</button>' : ""}<button type="button" class="vu-barra-btn fuerte" data-accion="dibujo-cancelar">Terminar</button>`;
      const txt = { area: "Toca el mapa para marcar los vértices del área", eje: "Toca el mapa siguiendo el eje del corredor", corte: "Toca afuera del área, sigue el camino y termina afuera", camino: "Toca el mapa siguiendo el camino o la huella" }[dib2.modo];
      return `<span class="vu-barra-txt">${txt} · ${dib2.puntos.length} punto${dib2.puntos.length === 1 ? "" : "s"}</span>
      <button type="button" class="vu-barra-btn" data-accion="dibujo-deshacer" ${dib2.puntos.length ? "" : "disabled"}>Deshacer</button>
      <button type="button" class="vu-barra-btn fuerte" data-accion="dibujo-terminar" ${dib2.puntos.length >= min ? "" : "disabled"}>Terminar</button>
      <button type="button" class="vu-barra-btn" data-accion="dibujo-cancelar">Cancelar</button>`;
    }
    return { zonasDeHoja, vistaArea, textoCorredor, htmlSectores, htmlZonas, barraDibujo, htmlVistaPrevia };
  }

  // modulos/vuelos/paso-vuelo.js
  function crearPasoVuelo(v) {
    const ref = (n) => (...a) => v[n](...a);
    const { st, base } = v;
    const geo = ref("geo");
    const dron = ref("dron");
    const secSel = ref("secSel");
    const familias = ref("familias");
    function vistaVuelo() {
      const h = st.hoja, P = h.params, d = dron(), g = geo();
      if (!g) return `<section class="sis-tarjeta sis-vacio"><p>Primero carga o dibuja el área.</p><button class="sis-btn primario" data-accion="paso" data-paso="area">Ir a Área</button></section>`;
      const i = secSel();
      const r = calcularSector(h, d, g, i);
      const fam = d.familia || d.id;
      const sensores = base.drones.filter((x) => (x.familia || x.id) === fam);
      const altura = alturaDe(P, d), gsd = gsdCm(d, altura);
      const vMax = d.velocidadMaxMs;
      const n = g.sectores.length;
      return `${n > 1 ? `<div class="vu-sector-sel"><label class="vu-sector-elegir"><span>Sector</span><select data-sector-sel aria-label="Sector que se muestra">${g.sectores.map((s, k) => `<option value="${k}" ${k === i ? "selected" : ""}>${escapar(nombreSector(h, k, n))} · ${fmt(s.area / 1e4, 1)} ha</option>`).join("")}</select></label>
        <span class="vu-sector-nav"><button type="button" class="sis-btn vu-sec-btn" data-accion="ir-sector" data-i="${(i + n - 1) % n}">‹ Sector anterior</button>
          <b class="vu-sector-de">Sector ${i + 1} de ${n}</b>
          <button type="button" class="sis-btn primario vu-sec-btn" data-accion="ir-sector" data-i="${(i + 1) % n}">Sector siguiente ›</button></span>
        <span class="sis-tenue" id="vu-total-hoja">${htmlTotalHoja()}</span></div>` : ""}
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
          ${r && !r.corredor ? `<section class="sis-tarjeta"><h2>Punto de despegue</h2><div id="vu-desp-ops">${htmlDespegue(r)}</div></section>` : ""}
          <section class="sis-tarjeta"><h2>Despegue sobre un camino</h2>
            <div id="vu-desp-sug">${htmlDespegueSugerido()}</div>
            <div class="sis-acciones">
              <button class="sis-btn chico primario" data-accion="despegue-buscar" data-todos="0">Buscar sobre un camino</button>
              ${g.sectores.length > 1 ? '<button class="sis-btn chico" data-accion="despegue-buscar" data-todos="1">Para todos los sectores</button>' : ""}
            </div>
            <p class="sis-tenue">Prueba puntos de la red vial del MOP y de los caminos agregados en Área (hasta 1,5 km del sector) y elige el de menos tiempo de jornada. Es una referencia: el acceso, la propiedad y la línea de vista se confirman en terreno.</p>
          </section>
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
          ${r && !r.corredor ? `<div class="vu-rumbo-desl"><label for="vu-rumbo-rango"><b>Rumbo de las líneas</b> <span id="vu-rumbo-num" class="mono">${fmt(r.rumbo, 0)}°</span></label>
            <input id="vu-rumbo-rango" type="range" min="0" max="179" step="1" value="${Math.round((r.rumbo % 180 + 180) % 180)}" data-rumbo-rango aria-label="Rumbo de las líneas de vuelo">
            <div class="vu-rumbo-esc" aria-hidden="true"><span>0° N</span><span>45°</span><span>90° E</span><span>135°</span><span>179°</span></div>
            <p class="sis-tenue">Mueve la barra: las líneas giran en el mapa y se recalculan líneas, distancia, baterías y tiempo.</p>
            <div id="vu-lados">${htmlLados(r)}</div></div>` : ""}
          <p class="sis-tenue vu-pie">Arrastra el punto para cambiar el despegue: el tiempo incluye ir y volver desde él en cada batería.</p>
          <div id="vu-detalle">${htmlDetalle(r)}</div>
        </div>
      </div>`;
    }
    function htmlDespegueSugerido() {
      const s = st.sugDesp, h = st.hoja;
      if (!s || s.hojaId !== (h.id || "nueva")) return "";
      if (s.cargando) return '<p class="sis-tenue">Buscando en los caminos cercanos…</p>';
      const g = geo();
      if (!g) return "";
      return `<ul class="vu-sug">${s.lista.map(({ i, res, usado }) => {
        const nom = escapar(nombreSector(h, i, g.sectores.length));
        if (!res) return `<li><b>${nom}</b>: no hay caminos a menos de 1,5 km. Dibuja uno en Área → Caminos.</li>`;
        const mop = [res.camino.rol, res.camino.carpeta].filter(Boolean).join(" · ");
        const cam = mop ? `${escapar(mop)}<small>${escapar(res.camino.nombre || "")}</small>` : `${escapar(res.camino.nombre || "Camino")}<br>`;
        const lugar = res.distSector < 1 ? "dentro del sector" : `a ${fmt(res.distSector, 0)} m del sector`;
        const ahorro = res.ahorro >= 0.5 ? `ahorra <b>${fmtDuracion(res.ahorro)}</b>` : res.ahorro > -0.5 ? "igual que el despegue actual" : `${fmtDuracion(-res.ahorro)} más que el despegue actual`;
        return `<li><b>${nom}</b>: ${cam}${lugar} · ${fmtDuracion(res.minTotal)} de jornada (${ahorro})
        ${usado ? '<span class="vu-verde">✓ en uso</span>' : `<button class="sis-btn chico" data-accion="despegue-usar" data-i="${i}">Usar</button>`}</li>`;
      }).join("")}</ul>`;
    }
    function htmlLados(r) {
      const g = geo(), i = secSel(), h = st.hoja, n = g.sectores.length;
      const lados = ladosSector(g, i);
      const actual = Math.round((r.rumbo % 180 + 180) % 180);
      const sug = rumboSugerido(r);
      const sugHtml = sug ? `<div class="vu-rumbo-sug${sug.rumbo === actual ? " en-uso" : ""}"><span><b>Rumbo sugerido: ${sug.rumbo}°</b><small>${fmtDuracion(sug.minTotal)} de jornada con este despegue${sug.ahorro >= 0.5 ? ` · ahorra ${fmtDuracion(sug.ahorro)}` : ""}</small></span>
        ${sug.rumbo === actual ? '<span class="vu-verde">✓ en uso</span>' : `<button type="button" class="sis-btn primario chico" data-accion="rumbo-lado" data-r="${sug.rumbo}">Usar ${sug.rumbo}°</button>`}</div>` : "";
      if (!lados.length) return sugHtml;
      return `${sugHtml}<div class="vu-lados-cab"><b>Orientar paralelo a un lado</b><span class="sis-tenue">Los números están en el mapa.</span></div>
      <div class="vu-lados-lista">${lados.map((l) => `<button type="button" class="vu-lado${Math.abs(l.rumbo - actual) < 1 ? " activo" : ""}" data-accion="rumbo-lado" data-r="${l.rumbo}"><b>${l.n}</b><span>${fmt(l.largo, 0)} m · ${l.rumbo}°${l.comun.length ? `<small>común con ${l.comun.map((j) => escapar(nombreSector(h, j, n))).join(", ")}</small>` : ""}</span></button>`).join("")}</div>
      ${n > 1 ? `<div class="sis-acciones"><button type="button" class="sis-btn chico" data-accion="rumbo-todos" data-r="${actual}">Usar ${actual}° en todos los sectores</button></div>` : ""}`;
    }
    let cacheRumbo = null;
    function rumboSugerido(r) {
      const h = st.hoja, g = geo(), i = secSel(), meta = metaSector(h, i);
      const clave2 = JSON.stringify([h.id, i, h.dronId, h.params, meta.despegue, g.sectores.length, g.sectores[i].area]);
      if (!cacheRumbo || cacheRumbo.clave !== clave2) {
        const m = rumboMasCorto(h, dron(), g, i, r.velocidad);
        cacheRumbo = { clave: clave2, rumbo: m.rumbo, minTotal: m.minTotal };
      }
      return { ...cacheRumbo, ahorro: r.minTotal - cacheRumbo.minTotal };
    }
    function htmlDespegue(r) {
      const h = st.hoja, g = geo(), i = secSel(), d = dron();
      const ops = opcionesDespegue(h, d, g, i);
      if (!ops.length) return "";
      const actual = r.despegueXY, cerca = (o) => Math.hypot(o.xy[0] - actual[0], o.xy[1] - actual[1]) < 5;
      return `<div class="vu-desp-ops">${ops.map((o, k) => `<button type="button" class="vu-desp-op${cerca(o) ? " activo" : ""}" data-accion="despegue-op" data-lon="${o.lonLat[0]}" data-lat="${o.lonLat[1]}">
        <b class="vu-desp-letra">${String.fromCharCode(65 + k)}</b><span>${escapar(o.texto)}<small>${fmtDuracion(o.minTotal)}${o.mejor ? " · <b>el más rápido</b>" : ""}</small></span>${cerca(o) ? '<i class="vu-verde">en uso</i>' : ""}</button>`).join("")}</div>
      <p class="sis-tenue">Las letras están en el mapa. La ruta parte por la esquina de las líneas más cercana al despegue. También puedes arrastrar el punto.</p>`;
    }
    function htmlTotalHoja() {
      const g = geo(), t = totales(st.hoja, dron(), g);
      return t ? `Hoja completa: ${t.baterias} baterías · ${fmtDuracion(t.minJornada)}` : "";
    }
    function pieVelocidad(r) {
      if (!r) return "";
      const lim = r.limites.map(([t, v2]) => `${t} ${fmt(v2, 1)}`).join(" · ");
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
      ${kpi("Ruta (DJI)", fmtDuracion(r.minRutaDji))}
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
      ${htmlDetalleLineas(r)}
      ${r.modo === "foto" ? htmlTablaGsd(r) : ""}
      <details class="vu-detalles"><summary>Más detalle del cálculo</summary>
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
    function htmlDetalleLineas(r) {
      const dt = r.detalle;
      if (!dt) return "";
      const lado = (t, x) => `<tr><th>${t}</th><td class="mono">${fmt(x.semi, 1)} / ${fmt(dt.sepLineas, 2)} = ${fmt(x.cociente, 2)}</td><td>${x.residuo > 0.5 + 1e-9 ? `residuo ${fmt(x.residuo, 2)} &gt; 0,50 → sube` : x.cociente < 1 ? "mínimo 1 por lado" : `residuo ${fmt(x.residuo, 2)} ≤ 0,50 → trunca`}</td><td><b>${x.pasadas}</b></td></tr>`;
      return `<section class="sis-tarjeta vu-calc-lineas"><h2>Detalle del cálculo</h2>
      <dl class="vu-tabla">
        ${fila(r.barrido ? "Ancho de barrido LiDAR" : "Franja = altura × ancho del sensor / focal", `${fmt(dt.franja, 1)} m`)}
        ${fila(`Separación = franja × (1 − ${fmt(st.hoja.params.traslapeLateral, 0)} %)`, `${fmt(dt.sepLineas, 2)} m`)}
        ${fila(r.corredor ? "Líneas (el eje no se vuela)" : "Líneas", fmt(r.nLineas))}
      </dl>
      ${dt.lados ? `<div class="vu-tabla-scroll"><table class="vu-lados"><thead><tr><th>Lado</th><th>Semiancho / separación</th><th>Regla</th><th>Pasadas</th></tr></thead>
        <tbody>${lado("Izquierda", dt.lados.izq)}${lado("Derecha", dt.lados.der)}</tbody></table></div>
        <p class="sis-tenue">Cada pasada va a (k − ½) × separación del eje. Regla validada con DJI Pilot 2.</p>` : ""}
      <dl class="vu-tabla">${fila("Duración de la ruta (como DJI)", fmtDuracion(r.minRutaDji))}${fila("Jornada (despegues, cambios de batería y traslados)", fmtDuracion(r.minTotal))}</dl>
    </section>`;
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
    return { vistaVuelo, htmlLados, htmlDespegue, htmlTotalHoja, pieVelocidad, htmlKpis, htmlBarraRumbo, htmlLeyenda, htmlDetalle, opcionesGsd, htmlTablaGsd };
  }

  // modulos/vuelos/paso-clima.js
  function crearPasoClima(v) {
    const ref = (n) => (...a) => v[n](...a);
    const { st, base } = v;
    const geo = ref("geo");
    const dron = ref("dron");
    const familias = ref("familias");
    const render = ref("render");
    const cambio = ref("cambio");
    function analizarDia2(p, d) {
      const dias = [...new Set(p.horas.map((x) => x.fecha))];
      if (!st.dia || !dias.includes(st.dia)) st.dia = st.hoja && dias.includes(st.hoja.fecha) ? st.hoja.fecha : dias[0];
      const r = analizarDia(p, d, st.kps, st.dia);
      return { dias, ...r, chk: r.checklist };
    }
    const DSEM2 = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
    const diaTxt = (iso) => {
      const [y, m, dd] = iso.split("-").map(Number);
      return `${DSEM2[new Date(y, m - 1, dd, 12).getDay()]} ${dd}`;
    };
    function bloquePronostico(p, d, origen) {
      var _a;
      const b = analizarDia2(p, d);
      const hoy = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const tira = b.dias.map((x) => {
        const a = analizarDia(p, d, st.kps, x), tMax = Math.max(...a.filas.map((f) => {
          var _a2;
          return (_a2 = f.h.temp) != null ? _a2 : -99;
        }));
        const cl = a.ventana ? a.filas.some((f) => f.ev.estado === "marg" && f.h.hora >= a.ventana[0] && f.h.hora <= a.ventana[1]) ? "marg" : "go" : "no";
        return `<button type="button" class="vu-dia-btn ${cl}${x === st.dia ? " activo" : ""}" data-accion="dia" data-dia="${x}"><b>${x === hoy ? "Hoy" : escapar(diaTxt(x))}</b><span>${tMax > -99 ? fmt(tMax, 0) + "°" : ""}</span><small>${a.ventana ? `${dosD(a.ventana[0])}–${dosD(a.ventana[1] + 1)} h` : "sin ventana"}</small>${st.hoja && x === st.hoja.fecha ? "<i>vuelo</i>" : ""}</button>`;
      }).join("");
      const html = `<div class="vu-pron-origen"><b>${escapar(origen)}</b><span class="sis-tenue">${fmt(p.lat, 5)}, ${fmt(p.lon, 5)}${p.elevacionModelo != null ? ` · ${fmt(p.elevacionModelo, 0)} m s. n. m. (modelo)` : ""}</span></div>
        <div class="vu-clima-cal"><label class="sis-campo"><span>Día a consultar</span><input type="date" data-clima-dia value="${escapar(st.dia || "")}" min="${escapar(b.dias[0] || "")}" max="${escapar(b.dias[b.dias.length - 1] || "")}"></label>
          <span class="sis-tenue">Pronóstico de ${b.dias.length} días. Más allá de 7 días es menos confiable.</span></div>
        <div class="vu-dias-tira" role="group" aria-label="Próximos días">${tira}</div>
        <div class="vu-resumen-dia">
          ${b.ventana ? chip(`Ventana GO ${dosD(b.ventana[0])}:00 – ${dosD(b.ventana[1] + 1)}:00`, "verde") : chip("Sin ventana GO este día", "rojo")}
          ${chip(`Sol ${b.sol && b.sol.salida ? b.sol.salida.slice(11, 16) : "—"} – ${b.sol && b.sol.puesta ? b.sol.puesta.slice(11, 16) : "—"}`)}
          ${chip(b.kpMax != null ? `Kp máx. ${fmt(b.kpMax, 0)}` : "Kp sin dato")}
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
    cargarEstaciones().then(() => {
      if (st.paso === "clima" || st.vista === "rapido") render();
    }).catch(() => {
    });
    function htmlMetar(lat, lon, guardado) {
      return `<section class="sis-tarjeta">${htmlPanelMetar({ lat, lon, elevArea: st.pron ? st.pron.elevacionModelo : null, guardado, dron: st.vista === "rapido" ? base.drones.find((x) => x.id === st.rapDron) || base.drones[0] : dron(), horasPron: st.pron ? st.pron.horas : null })}</section>`;
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
      } else {
        cuerpo = '<p class="sis-tenue">Consultando el pronóstico de hoy y los próximos 10 días…</p>';
        setTimeout(() => v.consultarHojaAuto && v.consultarHojaAuto(), 0);
      }
      return `<div class="vu-dos ancho">
      <div class="vu-izquierda">
        <section class="sis-tarjeta"><div class="sis-cab"><h2>Pronóstico · ${st.dia ? fechaLegible(st.dia) : h.fecha ? fechaLegible(h.fecha) : "hoy"}</h2>
          <button class="sis-btn chico" data-accion="consultar-hoja">Actualizar</button></div>
          ${cuerpo}
        </section>
        ${htmlTramos()}
      </div>
      <div class="vu-derecha">
        ${lado || (h.clima && h.clima.checklist ? htmlChecklist(h.clima.checklist, "Checklist (última consulta)") : "")}
        ${(() => {
        const [lon, lat] = g.marco.aLonLat([0, 0]);
        return htmlMetar(lat, lon, h.metar);
      })()}
        <section class="sis-tarjeta"><h2>Viento medido en terreno</h2>
          ${h.viento.length ? `<dl class="vu-tabla">${h.viento.map((v2, k) => fila(`${escapar(v2.hora)}${v2.nota ? ` · ${escapar(v2.nota)}` : ""}`, `${fmt(v2.ms, 1)} m/s <button class="vu-link" data-accion="quitar-viento" data-k="${k}" aria-label="Quitar">✕</button>`)).join("")}</dl>` : ""}
          <form class="vu-viento" data-form="viento"><input name="hora" placeholder="hh:mm" aria-label="Hora" value="${(/* @__PURE__ */ new Date()).toTimeString().slice(0, 5)}"><input name="ms" placeholder="m/s" inputmode="decimal" aria-label="Viento en m/s" required><input name="nota" placeholder="Nota (opcional)" aria-label="Nota"><button class="sis-btn chico">Anotar</button></form>
          <p class="sis-tenue">Anemómetro en el despegue. Queda en la hoja para comparar con el pronóstico.</p>
        </section>
        <section class="sis-tarjeta"><h2>Antes de volar, revisa también</h2>
          <div class="vu-enlaces">${ENLACES_CONSULTA.map(([t, u]) => `<a class="sis-btn chico" href="${u}" target="_blank" rel="noopener">${escapar(t)} ↗</a>`).join("")}</div>
        </section>
      </div>
    </div>`;
    }
    function puntosTramos() {
      const h = st.hoja, g = geo();
      if (!g) return null;
      const linea = lineaEje(h.area);
      if (linea && linea.length >= 2) {
        const m = marcoDe(linea), xy = linea.map(m.aXY), L = largo(xy);
        if (L < 3e4) return null;
        const n = Math.min(6, Math.max(2, Math.round(L / 3e4)));
        return Array.from({ length: n }, (_, k) => {
          const s0 = L * k / n, s1 = L * (k + 1) / n, [lon, lat] = m.aLonLat(puntoEnEje(xy, (s0 + s1) / 2).p);
          const km = (x) => kmEnEje(h.area, x, L);
          return { lat, lon, nombre: `${kmADm(Math.min(km(s0), km(s1)))} – ${kmADm(Math.max(km(s0), km(s1)))}` };
        });
      }
      const xs = g.vuelo.map((p) => p[0]), ys = g.vuelo.map((p) => p[1]);
      const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      if (diag < 3e4 || g.sectores.length < 2) return null;
      const paso = Math.max(1, Math.ceil(g.sectores.length / 6));
      return g.sectores.filter((_, i) => i % paso === 0).map((sec, j) => {
        const i = j * paso, c = [sec.poligono.reduce((a, p) => a + p[0], 0) / sec.poligono.length, sec.poligono.reduce((a, p) => a + p[1], 0) / sec.poligono.length];
        const [lon, lat] = g.marco.aLonLat(c);
        return { lat, lon, nombre: `${nombreSector(h, i, g.sectores.length)}${paso > 1 ? ` a ${nombreSector(h, Math.min(g.sectores.length - 1, i + paso - 1), g.sectores.length)}` : ""}` };
      });
    }
    async function consultarTramos() {
      const h = st.hoja, pts = puntosTramos();
      if (!pts) {
        st.tramos = null;
        return;
      }
      st.tramos = { hojaId: h.id || "nueva", cargando: true, lista: [] };
      try {
        const pron = await Promise.all(pts.map((p) => pedirPronostico(p.lat, p.lon, 10).catch(() => null)));
        st.tramos = { hojaId: h.id || "nueva", lista: pts.map((p, k) => ({ ...p, pron: pron[k] })) };
      } catch {
        st.tramos = { hojaId: h.id || "nueva", error: true, lista: [] };
      }
      render();
      for (const t of st.tramos.lista) {
        try {
          const u = await ubicacionDe(t.lat, t.lon);
          t.comuna = u.comuna;
        } catch {
        }
        await new Promise((r) => setTimeout(r, 1100));
      }
      if (st.paso === "clima") render();
    }
    function htmlTramos() {
      const t = st.tramos, h = st.hoja, d = dron();
      if (!t || t.hojaId !== (h.id || "nueva")) return "";
      if (t.cargando) return '<section class="sis-tarjeta"><h2>Pronóstico por tramo</h2><p class="sis-tenue">Consultando cada tramo…</p></section>';
      const dia = st.dia;
      const res = t.lista.filter((x) => x.pron).map((x) => {
        const a = analizarDia(x.pron, d, st.kps, dia), luz = a.filas.filter((f) => f.ev.estado !== "noche");
        return { ...x, a, vMax: Math.max(...luz.map((f) => f.h.v || 0)), gMax: Math.max(...luz.map((f) => f.h.g || 0)), lluvia: luz.some((f) => (f.h.lluvia || 0) >= 0.2), tMin: Math.min(...a.filas.map((f) => {
          var _a;
          return (_a = f.h.temp) != null ? _a : 99;
        })) };
      });
      const grupos = [];
      for (const r of res) {
        const u = grupos[grupos.length - 1], vent = r.a.ventana ? r.a.ventana.join("-") : "no";
        if (u && u.vent === vent && Math.abs(u.vMax - r.vMax) < 2 && u.lluvia === r.lluvia) {
          u.hasta = r;
          u.vMax = Math.max(u.vMax, r.vMax);
          u.gMax = Math.max(u.gMax, r.gMax);
          u.comunas.add(r.comuna);
          continue;
        }
        grupos.push({ ...r, desde: r, hasta: r, vent, comunas: /* @__PURE__ */ new Set([r.comuna]) });
      }
      const L = res.length;
      return `<section class="sis-tarjeta"><div class="sis-cab"><h2>Pronóstico por tramo · ${dia ? fechaLegible(dia) : ""}</h2><span class="sis-tenue">${L} punto${L === 1 ? "" : "s"} a lo largo del área${grupos.length < L ? ` · ${grupos.length} tramo${grupos.length === 1 ? "" : "s"} con pronóstico distinto` : ""}</span></div>
      <div class="vu-tramos-clima">${grupos.map((gr) => {
        const nombre = gr.desde === gr.hasta ? gr.desde.nombre : `${gr.desde.nombre.split(" – ")[0]} – ${gr.hasta.nombre.split(" – ").pop()}`;
        const com = [...gr.comunas].filter(Boolean).join(", ");
        return `<div class="vu-tramo-clima ${gr.a.ventana ? "go" : "no"}"><b>${escapar(nombre)}</b><small>${escapar(com || "…")}</small>
          <span>Viento 120 m hasta ${fmt(gr.vMax, 1)} m/s · ráfaga ${fmt(gr.gMax, 1)} m/s${gr.lluvia ? " · lluvia" : ""}${gr.tMin < 2 ? ` · ${fmt(gr.tMin, 0)} °C al amanecer` : ""}</span>
          <b class="${gr.a.ventana ? "vu-verde" : "vu-rojo"}">${gr.a.ventana ? `Volar ${dosD(gr.a.ventana[0])}:00 – ${dosD(gr.a.ventana[1] + 1)}:00` : "Sin ventana GO"}</b></div>`;
      }).join("")}</div>
      <p class="sis-tenue">El área es larga y atraviesa microclimas distintos: se consulta cada tramo por separado y se juntan los tramos con un pronóstico parecido.</p></section>`;
    }
    async function consultarClima(lat, lon) {
      st.pronCargando = true;
      st.pronError = "";
      await render();
      try {
        const [p, kps] = await Promise.all([pedirPronostico(lat, lon, 10), st.kps ? Promise.resolve(st.kps) : pedirKp()]);
        st.pron = p;
        st.kps = kps;
        st.dia = null;
      } catch (e) {
        st.pronError = `No se pudo consultar el pronóstico (${e.message}). Revisa la conexión a internet.`;
        st.pron = null;
      }
      st.pronCargando = false;
    }
    function guardarResumenClima() {
      var _a;
      const h = st.hoja, d = dron();
      if (!st.pron || !h) return;
      const b = analizarDia2(st.pron, d);
      const raf = b.filas.filter((f) => f.h.g != null && f.ev.estado !== "noche").sort((x, y) => y.h.g - x.h.g)[0];
      h.clima = {
        consultadoEn: (/* @__PURE__ */ new Date()).toISOString(),
        fecha: st.dia,
        lat: st.pron.lat,
        lon: st.pron.lon,
        ventana: b.ventana ? `${dosD(b.ventana[0])}:00–${dosD(b.ventana[1] + 1)}:00` : "",
        rafaga: raf ? { v: raf.h.g, hora: raf.h.hora } : null,
        kpMax: b.kpMax,
        sol: b.sol && b.sol.salida ? [b.sol.salida.slice(11, 16), b.sol.puesta ? b.sol.puesta.slice(11, 16) : "—"] : null,
        modelos: ((_a = st.pron.horas[0]) == null ? void 0 : _a.modelos) || 0,
        checklist: b.chk,
        horas: b.filas.map((f) => ({ hora: f.h.hora, v: f.h.v, g: f.h.g, dir: f.h.dir, prob: f.h.prob, nubes: f.h.nubes, temp: f.h.temp, kp: f.kp, estado: f.ev.estado }))
      };
      cambio();
    }
    function vistaRapido() {
      const d = base.drones.find((x) => x.id === st.rapDron) || base.drones[0];
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
        const x = base.drones.find((y) => (y.familia || y.id) === k);
        return `<option value="${x.id}" ${(d.familia || d.id) === k ? "selected" : ""}>${escapar(t)}</option>`;
      }).join("")}</select></label>
            <div class="sis-acciones"><button class="sis-btn primario">Consultar coordenadas</button><button type="button" class="sis-btn" data-accion="gps">Usar mi ubicación</button></div>
          </form>
          ${cuerpo}
        </section>
      </div>
      <div class="vu-derecha">${lado}${st.rapLat && st.rapLon ? htmlMetar(Number(st.rapLat), Number(st.rapLon), st.rapMetar) : ""}</div>
    </div>`;
    }
    return { vistaClima, vistaRapido, consultarClima, consultarTramos, guardarResumenClima, resumenMetar };
  }

  // modulos/vuelos/paso-permisos.js
  function crearPasoPermisos(v) {
    const ref = (n) => (...a) => v[n](...a);
    const { st } = v;
    const geo = ref("geo");
    const dron = ref("dron");
    const nomProy = ref("nomProy");
    const nomPers = ref("nomPers");
    const ultimaConsulta = ref("ultimaConsulta");
    function fechaMenosHabiles(fecha2, n) {
      const d = /* @__PURE__ */ new Date(fecha2 + "T12:00:00");
      while (n > 0) {
        d.setDate(d.getDate() - 1);
        const w = d.getDay();
        if (w !== 0 && w !== 6) n--;
      }
      return d.toISOString().slice(0, 10);
    }
    const GUIA_ZONA = {
      no_poblada: "Áreas no pobladas (DAN 91): solicitud de autorización ante el Subdepartamento de Operaciones (SDO) de la DGAC con el formulario DAN 91 Anexo D.",
      poblada: "Áreas pobladas (DAN 151): autorización Apéndice A de la DAN 151 vigente y carpeta operativa con la credencial de operador, la tarjeta de registro del RPA y la resolución del seguro aprobado por la JAC.",
      especial: "Zonas especiales (parques nacionales, recintos militares o carcelarios, instalaciones críticas): permiso escrito de la institución o administración del lugar más la aprobación formal de la DGAC."
    };
    function vistaPermisos() {
      const h = st.hoja, g = h.permisos.dgac, perm = estadoPermiso(h), P = h.permisos;
      const habiles = g.enviado && h.fecha ? diasHabiles(g.enviado, h.fecha) : null;
      const hito = (k, t) => `<label class="vu-hito${g[k] ? " hecho" : ""}"><span class="vu-hito-punto" aria-hidden="true"></span><span>${t}</span><input type="date" data-dgac="${k}" value="${escapar(g[k] || "")}" aria-label="${t}"></label>`;
      const primerDia = h.programa && h.programa[0] && h.programa[0].fecha || h.fecha;
      const limite = primerDia ? restarHabiles(primerDia, 7) : null;
      const hoy = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const docs = documentosPermiso(h), listos = docs.filter((x) => x.listo).length;
      const logs = P.logs || [];
      const zona = P.zona || "no_poblada";
      return `<section class="sis-tarjeta vu-perm-cab">
        <div class="sis-cab"><h2>Permisos del vuelo</h2>${limite ? chip(g.enviado || g.aprobado ? `Solicitud enviada ${g.enviado ? fechaLegible(g.enviado) : ""}` : `Presentar a más tardar el ${fechaLegible(limite)} (7 días hábiles antes)`, g.enviado || g.aprobado ? "verde" : limite < hoy ? "rojo" : "ambar") : chip("Pon el primer día de vuelo para calcular el plazo", "gris")}</div>
        <div class="sis-campo"><span>Tipo de zona de vuelo</span><div class="vu-zonas-tipo" role="radiogroup" aria-label="Tipo de zona">${ZONAS_VUELO.map(([k, t]) => `<label class="vu-zona-op${zona === k ? " activo" : ""}"><input type="radio" name="zonaVuelo" data-zona="${k}" ${zona === k ? "checked" : ""}> ${t}</label>`).join("")}</div></div>
        <p class="vu-guia-zona">${escapar(GUIA_ZONA[zona])} Las solicitudes al Subdepartamento de Operaciones se presentan con al menos 7 días de anticipación.</p>
        <p class="sis-tenue">Los avisos son informativos: el vuelo se puede programar aunque falten documentos. La idea es acostumbrarnos a pedirlos todos.</p>
      </section>
      <div class="vu-dos ancho">
      <div class="vu-izquierda">
        <section class="sis-tarjeta"><div class="sis-cab"><h2>Documentos de la solicitud</h2>${chip(`${listos}/${docs.length} listos`, listos === docs.length ? "verde" : "gris")}</div>
          <div class="vu-docs">${docs.map((x) => `<div class="vu-doc-fila ${x.estado}">
              <span class="vu-doc-nombre">${escapar(x.t)}</span>
              <select data-docest="${x.k}" aria-label="Estado de ${escapar(x.t)}">${ESTADOS_DOC.map(([k, t]) => `<option value="${k}" ${x.estado === k ? "selected" : ""}>${t}</option>`).join("")}</select>
              ${x.vence ? `<input type="date" data-docvence="${x.k}" value="${escapar(x.fechaVence)}" aria-label="Vencimiento de ${escapar(x.t)}" title="Vence">` : "<span></span>"}
              <span class="vu-doc-acc">${x.archivoId ? `<button class="vu-link" data-accion="ver-captura" data-id="${escapar(x.archivoId)}">Ver</button>` : ""}<label class="vu-link vu-archivo">${x.archivoId ? "Cambiar" : "Adjuntar"}<input type="file" accept="image/*,application/pdf,.kml,.kmz,.doc,.docx" data-archivo="docpermiso" data-k="${x.k}" hidden></label></span>
            </div>`).join("")}</div>
          ${docs.some((x) => x.fechaVence && x.fechaVence < (h.fecha || hoy)) ? '<div class="vu-aviso">Hay documentos vencidos para la fecha del vuelo.</div>' : ""}
          <div class="sis-acciones">${geo() ? '<button class="sis-btn chico" data-accion="kml-vuelo">Descargar KMZ/KML de la zona (área de vuelo)</button>' : ""}</div>
          <p class="sis-tenue">Revisa la lista contra la edición vigente de la DAN 151 (Res. Exenta 1033, 2025) y la DAN 91.</p>
        </section>
        <section class="sis-tarjeta"><div class="sis-cab"><h2>Solicitud a la DGAC</h2>${chip(perm.texto, perm.nivel === "ok" ? "verde" : perm.nivel === "aviso" ? "ambar" : "gris")}</div>
          <div class="vu-hitos">${hito("preparado", "En preparación")}${hito("enviado", "Enviada a la DGAC")}${hito("aprobado", "Aprobada")}${hito("vence", "Vigente hasta")}</div>
          <label class="sis-campo"><span>N° de solicitud o autorización</span><input data-dgac="numero" value="${escapar(g.numero || "")}"></label>
          ${habiles != null && habiles < 7 && !g.aprobado ? `<div class="vu-aviso">Se envió ${habiles} día${habiles === 1 ? "" : "s"} hábil${habiles === 1 ? "" : "es"} antes del vuelo; la DGAC pide al menos 7.</div>` : ""}
        </section>
        <section class="sis-tarjeta vu-log ${h.estado === "volada" && !logs.length ? "alerta" : ""}"><div class="sis-cab"><h2>Log del vuelo</h2>${logs.length ? chip(`${logs.length} cargado${logs.length === 1 ? "" : "s"}`, "verde") : h.estado === "volada" ? chip("Falta cargarlo", "rojo") : chip("Después de volar", "gris")}</div>
          ${logs.length ? `<div class="sis-lista">${logs.map((l, i) => `<div class="sis-fila"><span class="sis-fila-txt"><b>${escapar(l.nombre)}</b><span class="sis-tenue">${fechaHora(l.fecha)}${l.personaId ? ` · ${escapar(nomPers(l.personaId))}` : ""}</span></span>
              <span class="sis-acciones"><button class="sis-btn chico" data-accion="ver-captura" data-id="${escapar(l.archivoId)}">Ver</button><button class="sis-btn chico peligro" data-accion="quitar-log" data-i="${i}">Quitar</button></span></div>`).join("")}</div>` : ""}
          <label class="sis-btn ${h.estado === "volada" && !logs.length ? "primario" : ""} vu-archivo">Cargar log del vuelo<input type="file" multiple data-archivo="log" hidden></label>
          <p class="sis-tenue">Al terminar cada jornada, sube el registro de vuelo (DJI Pilot 2: FlightRecord). Desde que el proyecto pasa a gabinete, Inicio avisa si falta.</p>
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
          <div class="vu-enlaces">${ENLACES_CONSULTA.filter(([t]) => !/AIP|UAS/.test(t)).map(([t, u]) => `<a class="sis-btn chico" href="${u}" target="_blank" rel="noopener">${escapar(t)} ↗</a>`).join("")}</div>
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
          ` : "<p>Sin consulta de clima.</p>"}
          ${(() => {
        const m = resumenMetar(h.metar);
        return m ? `<p><b>METAR ${escapar(m.icao)}</b> (${escapar(m.categoria)})</p><p class="mono">${escapar(m.texto)}</p>` : "<p>METAR: ☐ revisado el día del vuelo</p>";
      })()}
          <h3>Checklist</h3><ul class="vu-imp-chk">${(c && c.checklist || []).map((x) => `<li>☐ ${escapar(x.texto)} — ${escapar(x.detalle)}</li>`).join("")}<li>☐ NOTAM revisado el día del vuelo</li><li>☐ Baterías cargadas (${t.baterias + 1} como mínimo)</li></ul></div>
        <div><h3>Permisos</h3><p>DGAC: <b>${escapar(perm.texto)}</b> · ${escapar(perm.detalle)}${h.permisos.dgac.numero ? ` · N° ${escapar(h.permisos.dgac.numero)}` : ""}</p>
          <ul class="vu-imp-chk">${documentosPermiso(h).map((x) => `<li>${x.listo ? "☑" : "☐"} ${escapar(x.t)}</li>`).join("")}</ul>
          <h3>Viento medido en terreno</h3><table class="vu-imp-tabla chica"><thead><tr><th>Hora</th><th>m/s</th><th>Nota</th></tr></thead><tbody>${[...h.viento, ...vacias].map((v2) => `<tr><td>${escapar(v2.hora)}</td><td>${v2.ms === "" ? "" : fmt(v2.ms, 1)}</td><td>${escapar(v2.nota || "")}</td></tr>`).join("")}</tbody></table>
          <h3>Observaciones</h3><div class="vu-imp-obs"></div></div>
      </div>
      <footer>Generado ${(/* @__PURE__ */ new Date()).toLocaleString("es-CL")} · Estimación para planificar; el vuelo se programa en DJI Pilot 2. Información aeronáutica oficial: AIP Chile (DGAC).</footer>
    </div>`;
      let caja2 = document.getElementById("vu-impresion");
      if (!caja2) {
        caja2 = document.createElement("div");
        caja2.id = "vu-impresion";
        document.body.appendChild(caja2);
      }
      caja2.innerHTML = html;
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
    return { vistaPermisos, imprimir };
  }

  // modulos/vuelos/herramientas.js
  function crearHerramientas(v) {
    const { st, base } = v;
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
      ${base.drones.map((d) => `<section class="sis-tarjeta"><div class="sis-cab"><h2>${escapar(d.nombre)}</h2>${d.corregido ? chip("Corregido", "ambar") : ""}</div>
        <form class="sis-form vu-dron" data-form="dron" data-id="${d.id}"><div class="vu-grilla">
          ${CAMPOS_DRON.map(([k, t, u]) => campo(k, t, d[k], "", u)).join("")}
          ${d.lidar ? campo("lidarPps", "LiDAR: puntos por segundo", d.lidar.puntosPorSegundo, "", "pts/s") + campo("lidarFov", "LiDAR: campo de visión", d.lidar.fovGrados, "", "°") : ""}
        </div><div class="sis-acciones"><button class="sis-btn chico primario">Guardar</button>
        ${d.corregido ? `<button type="button" class="sis-btn chico" data-accion="restablecer-dron" data-id="${d.id}">Volver a los valores de fábrica</button>` : ""}</div></form>
      </section>`).join("")}`;
    }
    return { vistaKml, vistaDrones };
  }

  // modulos/vuelos/mapa-base.js
  var CLAVE_LS = "vu_mapa_base";
  var ESRI_PUBLICO = (s) => `https://server.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/{z}/{y}/{x}`;
  var clave = () => window.TOPOLAND_CONFIG && window.TOPOLAND_CONFIG.esriClave || "";
  function capasBase(L) {
    const k = clave();
    const op = { maxZoom: 20, maxNativeZoom: 19 };
    const esri = k ? L.layerGroup([
      L.tileLayer(`https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(k)}`, { ...op, attribution: "Imagen © Esri, Maxar, Earthstar Geographics" }),
      L.tileLayer(`https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/{z}/{y}/{x}?token=${encodeURIComponent(k)}`, { ...op, tileSize: 512, zoomOffset: -1 })
    ]) : L.layerGroup([
      L.tileLayer(ESRI_PUBLICO("World_Imagery"), { ...op, attribution: "Imagen © Esri, Maxar, Earthstar Geographics" }),
      L.tileLayer(ESRI_PUBLICO("Reference/World_Transportation"), op),
      L.tileLayer(ESRI_PUBLICO("Reference/World_Boundaries_and_Places"), op)
    ]);
    const sentinel = L.tileLayer("https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg", {
      maxZoom: 20,
      maxNativeZoom: 15,
      attribution: '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)'
    });
    return { "Satélite Esri": esri, "Sentinel-2 2016 (libre, 10 m)": sentinel };
  }
  function agregarMapaBase(L, mapa) {
    const capas = capasBase(L);
    let elegida = "Satélite Esri";
    try {
      const x = localStorage.getItem(CLAVE_LS);
      if (x && capas[x]) elegida = x;
    } catch {
    }
    capas[elegida].addTo(mapa);
    L.control.layers(capas, null, { position: "topleft", collapsed: true }).addTo(mapa);
    mapa.on("baselayerchange", (e) => {
      try {
        localStorage.setItem(CLAVE_LS, e.name);
      } catch {
      }
    });
    return capas;
  }

  // modulos/vuelos/mapas.js
  function crearMapas(v) {
    const ref = (n) => (...a) => v[n](...a);
    const { st } = v;
    const geo = ref("geo");
    const dron = ref("dron");
    const secSel = ref("secSel");
    const capasActivas = ref("capasActivas");
    const cambio = ref("cambio");
    const render = ref("render");
    const refrescarArea = ref("refrescarArea");
    const refrescarVuelo = ref("refrescarVuelo");
    const barraDibujo = ref("barraDibujo");
    const { raiz } = v;
    const CENTRO_CHILE = [-33, -70.6];
    const mapas = v.mapas;
    async function cargarLeaflet() {
      if (window.L) return window.L;
      await cargarScript("vendor/leaflet/leaflet.js");
      return window.L;
    }
    async function mapaEn(lugar, clave2) {
      let L;
      try {
        L = await cargarLeaflet();
      } catch {
        return null;
      }
      if (!L || !raiz.contains(lugar)) return null;
      let m = mapas[clave2];
      if (!m) {
        const el = document.createElement("div");
        el.className = "vu-mapa";
        const mapa = L.map(el, { zoomControl: true, attributionControl: true });
        agregarMapaBase(L, mapa);
        m = mapas[clave2] = { el, mapa, capas: {}, L, encuadre: null };
        mapa.setView(CENTRO_CHILE, 7);
        mapa.on("click", (ev) => alClicMapa(clave2, ev));
        mapa.on("mousemove", (ev) => alMoverMapa(clave2, ev));
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
      if (st.dibujo.modo === "vertice") {
        const g = geo();
        if (!g) return;
        const LL = aLL(g), vs = g.vuelo.map(LL);
        m.capas.dibujo = L.layerGroup([
          ...vs.map((p) => L.circleMarker(p, { radius: 5, color: "#1C1F23", weight: 1.5, fillColor: "#FFFFFF", fillOpacity: 1, interactive: false })),
          ...pts.map((p) => L.circleMarker(p, { radius: 8, color: "#FFFFFF", weight: 3, fillColor: "#E8611C", fillOpacity: 1, interactive: false }))
        ]).addTo(mapa);
        return;
      }
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
      redVialYRepintar(m, pintarArea);
    }
    async function asegurarRedVial() {
      const g = geo();
      if (!st.redVial || !g) return false;
      const bb = recuadro(g.vuelo.map(g.marco.aLonLat), 3);
      const clave2 = bb.map((x) => x.toFixed(2)).join(",");
      if (st.redVialClave === clave2) return false;
      st.redVialClave = clave2;
      try {
        st.redVialDatos = await caminosEn(bb);
        st.redVialInfo = `${st.redVialDatos.length} tramos de caminos del MOP a menos de 3 km del área. ${ATRIBUCION}.`;
      } catch {
        st.redVialDatos = [];
        st.redVialInfo = "No se pudo leer la red vial (falta vendor/capas/redvial).";
        st.redVialClave = null;
      }
      return true;
    }
    function pintarCaminos(m) {
      const { L, mapa } = m;
      const mop = st.redVial ? st.redVialDatos || [] : [];
      const propios = st.hoja && st.hoja.area.caminos || [];
      const clave2 = `${st.redVial ? st.redVialClave : "-"}|${mop.length}|${propios.length}|${propios.length ? propios[propios.length - 1].linea.length : 0}`;
      if (m.caminos && m.caminos.clave === clave2) {
        if (m.caminos.grupo && !mapa.hasLayer(m.caminos.grupo)) m.caminos.grupo.addTo(mapa);
        return;
      }
      if (m.caminos && m.caminos.grupo) m.caminos.grupo.remove();
      m.lienzo = m.lienzo || L.canvas({ padding: 0.5, tolerance: 6 });
      const ll = (l) => l.map(([lon, lat]) => [lat, lon]);
      const capas = [];
      if (mop.length) {
        const pav = mop.filter((c) => /pavimento/i.test(c.carpeta)), resto = mop.filter((c) => !/pavimento/i.test(c.carpeta));
        for (const [lista, w] of [[resto, 4], [pav, 5]]) if (lista.length) capas.push(L.polyline(lista.map((c) => ll(c.linea)), { renderer: m.lienzo, color: "#3A3A3A", weight: w, opacity: 0.55, interactive: false }));
        if (mop.length <= 400) {
          for (const c of mop) capas.push(L.polyline(ll(c.linea), { renderer: m.lienzo, color: COLOR_CARPETA(c.carpeta), weight: /pavimento/i.test(c.carpeta) ? 3 : 2, opacity: 0.85, dashArray: /suelo/i.test(c.carpeta) ? "4 4" : null }).bindTooltip(describirCamino(c) || "Camino", { sticky: true }));
        } else {
          const grupos = /* @__PURE__ */ new Map();
          for (const c of mop) {
            const k = c.carpeta || "Sin dato";
            if (!grupos.has(k)) grupos.set(k, []);
            grupos.get(k).push(ll(c.linea));
          }
          for (const [k, lineas] of grupos) capas.push(L.polyline(lineas, { renderer: m.lienzo, color: COLOR_CARPETA(k), weight: /pavimento/i.test(k) ? 3 : 2, opacity: 0.85, dashArray: /suelo/i.test(k) ? "4 4" : null }).bindTooltip(`Red vial MOP · ${k}`, { sticky: true }));
        }
      }
      if (propios.length) capas.push(L.polyline(propios.map((c) => ll(c.linea)), { renderer: m.lienzo, color: "#FFD54F", weight: 3, opacity: 0.95 }).bindTooltip(propios.length === 1 ? propios[0].nombre || "Camino agregado" : `Caminos agregados (${propios.length})`, { sticky: true }));
      m.caminos = { clave: clave2, grupo: capas.length ? L.layerGroup(capas).addTo(mapa) : null };
      if (mapa.attributionControl) {
        mapa.attributionControl.removeAttribution(ATRIBUCION);
        if (mop.length) mapa.attributionControl.addAttribution(ATRIBUCION);
      }
    }
    async function redVialYRepintar(m, pintar) {
      if (await asegurarRedVial()) {
        pintar(m);
        const info = raiz.querySelector(".vu-caminos-info");
        if (info) info.textContent = st.redVialInfo;
      }
    }
    function pintarArea(m) {
      const { L, mapa } = m;
      const g = geo(), h = st.hoja;
      quitar(m, "original", "sectores", "cortes", "eje", "sentido");
      pintarZonas(m);
      pintarCaminos(m);
      if (!g) return;
      const LL = aLL(g);
      if (g.tipo === "poligono" && Number(h.area.margen)) m.capas.original = L.polygon(g.original.map(LL), { color: "#FFFFFF", weight: 2, dashArray: "6 5", fill: false, interactive: false }).addTo(mapa);
      if (g.tipo === "corredor") m.capas.eje = L.polyline(g.eje.map(LL), { color: "#FFFFFF", weight: 2, dashArray: "3 5", interactive: false }).addTo(mapa);
      else if (h.area.ejeCalc && h.area.ejeCalc.linea) m.capas.eje = L.polyline(h.area.ejeCalc.linea.map(([lon, lat]) => [lat, lon]), { color: "#FFFFFF", weight: 2, dashArray: "3 5" }).bindTooltip("Eje calculado", { sticky: true }).addTo(mapa);
      const varios = g.sectores.length > 1;
      const sel = Math.max(0, Math.min(h.area.sel || 0, g.sectores.length - 1));
      m.capas.sectores = L.layerGroup(g.sectores.map((s, i) => {
        const elegido = varios && i === sel;
        const p = L.polygon(s.poligono.map(LL), { color: elegido ? "#FFFFFF" : "#E8611C", weight: elegido ? 5 : 3, fillColor: COLORES_SECTOR[i % COLORES_SECTOR.length], fillOpacity: varios ? elegido ? 0.5 : 0.25 : 0.1, interactive: g.sectores.length > 8 });
        if (varios) p.bindTooltip(nombreSector(h, i, g.sectores.length), { permanent: g.sectores.length <= 8, sticky: g.sectores.length > 8, direction: "center", className: "vu-etiqueta" });
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
      pintarSentido(m);
      if (m.capas.sectores) m.capas.sectores.eachLayer((l) => {
        if (l.options.weight === 5) l.bringToFront();
      });
      encuadrar(m, g.vuelo.map(LL), `area:${JSON.stringify(g.vuelo[0])}:${g.vuelo.length}`);
      if (st.zoomSector && varios) {
        st.zoomSector = false;
        const b = L.latLngBounds(g.sectores[sel].poligono.map(LL));
        if (b.isValid()) mapa.fitBounds(b, { padding: [60, 60], maxZoom: 16 });
      }
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
      redVialYRepintar(m, pintarVuelo);
    }
    function pintarVuelo(m) {
      const { L, mapa } = m;
      const g = geo(), h = st.hoja;
      quitar(m, "sectores", "lineas", "traslados", "sugerido", "lados", "opsDesp");
      if (!g) return;
      pintarCaminos(m);
      const LL = aLL(g), i = secSel();
      const sug = st.sugDesp && st.sugDesp.lista && st.sugDesp.lista.find((x) => x.i === i && x.res && !x.usado);
      if (sug) m.capas.sugerido = L.circleMarker([sug.res.lonLat[1], sug.res.lonLat[0]], { radius: 8, color: "#FFFFFF", weight: 2, fillColor: "#2E7D32", fillOpacity: 1 }).bindTooltip("Despegue sugerido sobre el camino", { direction: "top" }).addTo(mapa);
      const r = calcularSector(h, dron(), g, i);
      m.capas.sectores = L.layerGroup(g.sectores.map((s, k) => L.polygon(s.poligono.map(LL), { color: k === i ? "#E8611C" : "#FFFFFF", weight: k === i ? 3 : 1, opacity: k === i ? 1 : 0.55, dashArray: k === i ? null : "4 6", fillColor: "#E8611C", fillOpacity: k === i ? 0.1 : 0, interactive: k !== i }).on("click", () => {
        if (k !== i) {
          h.area.sel = k;
          cambio();
          render();
        }
      }))).addTo(mapa);
      if (!r) return;
      const lados = ladosSector(g, i);
      if (lados.length) m.capas.lados = L.layerGroup(lados.map((l) => L.marker(LL(l.medio), { interactive: false, keyboard: false, icon: L.divIcon({ className: "vu-lado-num", html: `<span>${l.n}</span>`, iconSize: [22, 22], iconAnchor: [11, 11] }) }))).addTo(mapa);
      m.capas.lineas = L.layerGroup(r.baterias.flatMap((b, k) => b.piezas.map((pz) => L.polyline(pz.slice(0, 5e3).map(LL), { color: COLORES_BATERIA[k % COLORES_BATERIA.length], weight: 2, opacity: 0.95, interactive: false })))).addTo(mapa);
      if (!r.corredor) {
        const ops = opcionesDespegue(st.hoja, dron(), g, i);
        m.capas.opsDesp = L.layerGroup(ops.map((o, k) => L.marker(LL(o.xy), { keyboard: false, icon: L.divIcon({ className: `vu-desp-mapa${o.mejor ? " mejor" : ""}`, html: `<span>${String.fromCharCode(65 + k)}</span>`, iconSize: [22, 22], iconAnchor: [11, 11] }) }).bindTooltip(`${o.texto} · ${Math.round(o.minTotal)} min`, { direction: "top" }).on("click", () => {
          metaSector(st.hoja, i).despegue = o.lonLat;
          cambio();
          refrescarVuelo();
        }))).addTo(mapa);
      }
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
    function ejeActual() {
      const a = st.hoja && st.hoja.area, linea = a && lineaEje(a);
      if (!linea || linea.length < 2) return null;
      const marco = marcoDe(linea), xy = linea.map(marco.aXY);
      return { a, marco, xy, L: largo(xy) };
    }
    function pintarSentido(m) {
      const { L, mapa } = m, e = ejeActual();
      if (!e) return;
      const inv = !!(e.a.dm && e.a.dm.inv), aLL2 = (p) => {
        const [lon, lat] = e.marco.aLonLat(p);
        return [lat, lon];
      };
      const sIni = inv ? e.L : 0, sFin = inv ? 0 : e.L;
      const etiqueta = (s, txt, clase) => L.marker(aLL2(puntoEnEje(e.xy, s).p), { interactive: false, keyboard: false, icon: L.divIcon({ className: "vu-extremo " + clase, html: `<span>${txt}</span>`, iconSize: null }) });
      const capas = [etiqueta(sIni, `Inicio · ${kmADm(kmEnEje(e.a, sIni, e.L))}`, "ini"), etiqueta(sFin, `Fin · ${kmADm(kmEnEje(e.a, sFin, e.L))}`, "fin")];
      for (const f of [0.2, 0.4, 0.6, 0.8]) {
        const s = e.L * f, p0 = puntoEnEje(e.xy, s).p, p1 = puntoEnEje(e.xy, Math.min(e.L, s + Math.max(5, e.L * 2e-3))).p;
        let ang = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]) * 180 / Math.PI;
        if (inv) ang += 180;
        capas.push(L.marker(aLL2(p0), { interactive: false, keyboard: false, icon: L.divIcon({ className: "vu-flecha", html: `<span style="transform:rotate(${ang.toFixed(1)}deg)">▲</span>`, iconSize: [18, 18], iconAnchor: [9, 9] }) }));
      }
      m.capas.sentido = L.layerGroup(capas).addTo(mapa);
    }
    function puntoEjeCercano(latlng) {
      const e = ejeActual();
      if (!e) return null;
      const q = e.marco.aXY([latlng.lng, latlng.lat]), s = distanciaEnEje(e.xy, q), p = puntoEnEje(e.xy, s).p, [lon, lat] = e.marco.aLonLat(p);
      return { s, km: kmEnEje(e.a, s, e.L), latlng: [lat, lon] };
    }
    let movPendiente = null;
    function alMoverMapa(clave2, ev) {
      if (clave2 !== "area" || !st.dibujo || st.dibujo.modo !== "dmfijo") {
        if (mapas.area && mapas.area.capas.cursorDm) quitar(mapas.area, "cursorDm");
        return;
      }
      if (movPendiente) {
        movPendiente = ev;
        return;
      }
      movPendiente = ev;
      requestAnimationFrame(() => {
        const e2 = movPendiente;
        movPendiente = null;
        const m = mapas.area, r = m && puntoEjeCercano(e2.latlng);
        if (!m || !r) return;
        quitar(m, "cursorDm");
        m.capas.cursorDm = m.L.circleMarker(r.latlng, { radius: 7, color: "#1C1F23", weight: 3, fillColor: "#FFFFFF", fillOpacity: 1, interactive: false }).bindTooltip(`DM ${kmADm(r.km)} · toca para cortar aquí`, { permanent: true, direction: "right", offset: [10, 0], className: "vu-tip-dm" }).addTo(m.mapa);
      });
    }
    function alClicMapa(clave2, ev) {
      if (clave2 !== "area" || !st.dibujo) return;
      if (st.dibujo.modo === "dmfijo") {
        const r = puntoEjeCercano(ev.latlng);
        if (r && v.agregarFijo(kmADm(r.km))) render();
        return;
      }
      if (st.dibujo.modo === "vertice") {
        const g = geo(), m = mapas.area;
        if (!g || !m) return;
        const LL = aLL(g), cp = m.mapa.latLngToContainerPoint(ev.latlng);
        let mejor = null, dmin = 28;
        g.vuelo.forEach((p) => {
          const q = m.mapa.latLngToContainerPoint(LL(p)), d = Math.hypot(q.x - cp.x, q.y - cp.y);
          if (d < dmin) {
            dmin = d;
            mejor = p;
          }
        });
        if (!mejor) {
          v.avisar("Toca más cerca de un vértice del área (los puntos blancos).", "error");
          render();
          return;
        }
        const ll = g.marco.aLonLat(mejor);
        const pts = st.dibujo.puntos;
        if (pts.length && Math.abs(pts[0][0] - ll[0]) < 1e-9 && Math.abs(pts[0][1] - ll[1]) < 1e-9) return;
        pts.push(ll);
        if (pts.length === 2) {
          const h = st.hoja;
          h.area.auto = { ...h.area.auto || {}, modo: "vertices" };
          h.area.cortes.push(pts.slice());
          st.dibujo.puntos = [];
          const g2 = geometria(h);
          if (g2 && g2.fallidos.length) {
            h.area.cortes.pop();
            v.avisar("Ese corte no queda dentro del área: elige dos vértices que se vean por dentro.", "error");
          } else v.avisar(`Corte agregado: ${g2 ? g2.sectores.length : "—"} sectores. Toca otros dos vértices para seguir, o «Terminar».`);
          cambio();
          render();
          return;
        }
        const b2 = raiz.querySelector("#vu-barra-area");
        if (b2) b2.innerHTML = barraDibujo();
        if (mapas.area) pintarDibujo(mapas.area);
        return;
      }
      st.dibujo.puntos.push([ev.latlng.lng, ev.latlng.lat]);
      const b = raiz.querySelector("#vu-barra-area");
      if (b) b.innerHTML = barraDibujo();
      if (mapas.area) pintarDibujo(mapas.area);
    }
    return { mapaArea, mapaVuelo, mapaKml, pintarArea, pintarVuelo, pintarDibujo };
  }

  // modulos/vuelos/pantallas.js
  var HERRAMIENTAS = [["hojas", "Hojas de vuelo"], ["rapido", "Pronóstico rápido"], ["kml", "Limpiar KML"], ["drones", "Drones"]];
  var leerLS2 = (k, d) => {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  };
  var escribirLS2 = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
    }
  };
  function montarPantallas3(contenedor2, ctx2) {
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
      // { modo: 'area'|'eje'|'corte'|'camino'|'dmfijo', puntos: [] }
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
      capasActivas: leerLS2("vu_capas_activas", null),
      redVial: leerLS2("vu_red_vial", false),
      redVialInfo: "",
      sugDesp: null,
      mensaje: null,
      filtroProyecto: ctx2.proyectoId || ""
    };
    const base = { drones: [], proyectos: [], personas: [], hojas: [] };
    const mapas = {};
    const avisar2 = (texto3, tipo = "ok") => {
      st.mensaje = { texto: texto3, tipo };
    };
    const dron = () => base.drones.find((d) => d.id === (st.hoja && st.hoja.dronId)) || base.drones[0];
    const familias = () => [...new Map(base.drones.map((d) => [d.familia || d.id, d.familiaNombre || d.nombre])).entries()];
    const geo = () => st.hoja ? geometria(st.hoja) : null;
    const nomProy = (id) => !id ? "Sin proyecto" : id === OFICINA_ID ? "Oficina" : (base.proyectos.find((p) => p.id === id) || {}).nombre || "Proyecto";
    const nomPers = (id) => (base.personas.find((p) => p.id === id) || {}).nombre || "";
    const secSel = () => {
      const g = geo();
      return g ? Math.max(0, Math.min(st.hoja.area.sel || 0, g.sectores.length - 1)) : 0;
    };
    const capasActivas = () => st.capasActivas || (st.capas || []).map((c) => c.id);
    async function cargarBase() {
      [base.drones, base.proyectos, base.personas, base.hojas] = await Promise.all([listarDrones(), listarProyectos(), listarPersonas(), listarPlanes()]);
      base.hojas = base.hojas.map(migrarHoja);
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
      const { problemas, ...area2 } = h.area;
      const r = await guardarPlan({ ...h, area: { ...area2, problemas }, nombre, dronId: h.dronId, schemaVersion: 2, resumen: g && d ? resumenHoja(h, d, g) : null });
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
      st.paso = p ? "resumen" : "identificacion";
      st.pron = null;
      st.metar = null;
      st.metarError = "";
      st.dia = null;
      st.candidatos = null;
      st.dibujo = null;
      st.gsdExtra = [];
      st.tramos = null;
      st.ubicError = "";
      st.previas = null;
      st.pronError = "";
      st.vista = "hoja";
      for (const m of Object.values(mapas)) m.encuadre = null;
    }
    const v = { st, base, ctx: ctx2, raiz, mapas, geo, dron, familias, nomProy, nomPers, secSel, capasActivas, avisar: avisar2, cambio, render, guardarAhora, refrescarArea, refrescarVuelo };
    Object.assign(v, crearVistaHojas(v), crearPasoArea(v), crearPasoVuelo(v), crearPasoClima(v), crearPasoPermisos(v), crearHerramientas(v), crearMapas(v));
    const {
      vistaHojas,
      encabezadoHoja,
      vistaResumen,
      vistaIdentificacion,
      pieDePaso,
      vistaArea,
      textoCorredor,
      htmlSectores,
      htmlZonas,
      barraDibujo,
      htmlVistaPrevia,
      vistaVuelo,
      htmlLados,
      htmlDespegue,
      htmlTotalHoja,
      pieVelocidad,
      htmlKpis,
      htmlBarraRumbo,
      htmlLeyenda,
      htmlDetalle,
      opcionesGsd,
      htmlTablaGsd,
      vistaClima,
      vistaRapido,
      consultarClima,
      consultarTramos,
      guardarResumenClima,
      vistaPermisos,
      imprimir,
      vistaKml,
      vistaDrones,
      mapaArea,
      mapaVuelo,
      mapaKml,
      pintarArea,
      pintarVuelo,
      pintarDibujo
    } = v;
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
      if (r && !r.corredor) {
        poner("vu-lados", htmlLados(r));
        poner("vu-desp-ops", htmlDespegue(r));
      }
      if (r && st.hoja.params.velocidad === "") ponerValor("velocidad", Math.round(r.velocidad * 10) / 10);
      const rr = raiz.querySelector("#vu-rumbo-rango");
      if (r && rr && document.activeElement !== rr) {
        rr.value = Math.round((r.rumbo % 180 + 180) % 180);
        const num2 = raiz.querySelector("#vu-rumbo-num");
        if (num2) num2.textContent = `${fmt(r.rumbo, 0)}°`;
      }
      if (mapas.vuelo && mapas.vuelo.el.isConnected) pintarVuelo(mapas.vuelo);
    }
    async function buscarDespegue(h, todos2) {
      const g = geo();
      if (!g) return;
      const lista = todos2 ? g.sectores.map((_, k) => k) : [secSel()];
      st.sugDesp = { hojaId: h.id || "nueva", cargando: true, lista: [] };
      poner("vu-desp-sug", '<p class="sis-tenue">Buscando en los caminos cercanos…</p>');
      let mop = [];
      try {
        mop = await caminosEn(recuadro(lista.flatMap((k) => g.sectores[k].poligono.map(g.marco.aLonLat)), 2));
      } catch {
        avisar2("No se pudo leer la red vial del MOP: se usan solo los caminos agregados en la hoja.", "error");
      }
      const caminos = [...caminosDeHoja(h), ...mop];
      st.sugDesp = { hojaId: h.id || "nueva", lista: lista.map((i) => ({ i, res: caminos.length ? despegueSobreCamino(h, dron(), g, i, caminos) : null })) };
      const n = st.sugDesp.lista.filter((x) => x.res).length;
      if (!n) avisar2("No hay caminos a menos de 1,5 km. Dibuja uno en Área → Caminos.", "error");
      else if (!st.mensaje || st.mensaje.tipo !== "error") avisar2(`Despegue sugerido para ${n} sector${n === 1 ? "" : "es"}: revisa y toca «Usar».`);
    }
    let consultandoClima = false;
    async function consultarHojaAuto(forzar = false) {
      const g = geo();
      if (!g || consultandoClima || !forzar && (st.pron || st.pronError)) return;
      consultandoClima = true;
      try {
        const [lon, lat] = g.marco.aLonLat([0, 0]);
        await consultarClima(lat, lon);
        if (st.pron) {
          guardarResumenClima();
          consultarTramos();
        }
      } finally {
        consultandoClima = false;
      }
      if (activo2) render();
    }
    v.consultarHojaAuto = consultarHojaAuto;
    async function detectarUbicacion(forzar = false) {
      const h = st.hoja, g = geo();
      if (!h || !g || st.ubicando) return;
      if (!forzar && h.ubicacion && (h.ubicacion.comuna || h.ubicacion.region)) return;
      const [lon, lat] = g.marco.aLonLat([0, 0]);
      st.ubicando = true;
      st.ubicError = "";
      try {
        const u = await ubicacionDe(lat, lon);
        if (st.hoja === h) {
          h.ubicacion = { ...u, auto: true };
          cambio();
        }
      } catch {
        st.ubicError = "No se pudo detectar la ubicación (sin conexión). Escríbela a mano.";
      }
      st.ubicando = false;
      if (activo2 && st.vista === "hoja" && st.hoja === h) render();
    }
    v.detectarUbicacion = detectarUbicacion;
    function agregarFijo(texto3) {
      const h = st.hoja, km = dmAKm(String(texto3 || "").trim());
      if (km == null) {
        avisar2("Escribe el DM del corte, por ejemplo 4+900.", "error");
        render();
        return false;
      }
      const au = h.area.auto = h.area.auto || {};
      au.modo = "medida";
      const lista = new Map((au.fijos || []).map((f) => [Math.round(dmAKm(f) * 1e3), f]));
      lista.set(Math.round(km * 1e3), kmADm(km));
      const sube = !(h.area.dm && h.area.dm.desc);
      au.fijos = [...lista.entries()].sort((x, y) => sube ? x[0] - y[0] : y[0] - x[0]).map((e) => e[1]);
      cambio();
      return true;
    }
    v.agregarFijo = agregarFijo;
    async function elegirMetodo(h, m) {
      const antes = (h.area.auto || {}).modo;
      h.area.auto = { ...h.area.auto || {}, modo: m };
      st.dibujo = null;
      if (m === "vertices" || m === "manual") {
        if (antes !== m) {
          h.area.cortes = [];
          h.area.sectores = [];
          h.area.sel = 0;
        }
        st.dibujo = { modo: m === "vertices" ? "vertice" : "corte", puntos: [] };
        avisar2(m === "vertices" ? "Toca un vértice del área y luego otro: el corte une ambos vértices." : "Traza el corte: toca afuera del área, sigue el camino y termina afuera. Luego «Terminar».");
        cambio();
      } else await cortarAutomatico(h);
    }
    async function cortarAutomatico(h) {
      var _a;
      const a = h.area;
      a.auto = a.auto || {};
      if (a.auto.modo === "inicio") {
        a.auto.modo = "distancia";
        a.auto.unidad = "m";
      }
      const forma = formaDe(h);
      if (!a.auto.modo) a.auto.modo = metodoPropuesto(forma);
      const extra = { dron: dron(), primerDM: (_a = a.auto.primerKm) != null ? _a : null };
      if (a.auto.modo === "medida" && (!a.dm || a.dm.inicio == null)) {
        a.dm = { ...a.dm || {}, texto: "0+000", inicio: 0 };
      }
      if (a.auto.modo === "tramos") {
        if (!h.proyectoId) {
          avisar2("La hoja no tiene proyecto: elígelo en el encabezado para usar sus tramos.", "error");
          return;
        }
        const t2 = await tramosDeProyecto(h.proyectoId);
        if (!t2) {
          avisar2("El proyecto no tiene seguimiento con tramos.", "error");
          return;
        }
        extra.tramosKm = [];
        for (const ar of t2.areas) for (const x of ar.tramos) {
          if (x.ini != null) extra.tramosKm.push(x.ini);
          if (x.fin != null) extra.tramosKm.push(x.fin);
        }
        if (!extra.tramosKm.length) {
          avisar2("Los tramos del seguimiento no tienen DM (como 45+200) en su nombre.", "error");
          return;
        }
      }
      let r;
      try {
        r = generarCortes(h, extra);
      } catch (e) {
        avisar2(e.message, "error");
        return;
      }
      a.cortes = r.cortes;
      a.sectores = [];
      a.sel = 0;
      cambio();
      const g = geometria(h);
      if (!r.cortes.length) {
        avisar2(r.nota || "No hizo falta cortar.");
        return;
      }
      const t = totales(h, dron(), g);
      avisar2(`Listo: ${g.sectores.length} sectores${t ? ` · ${t.baterias} baterías · ${fmtDuracion(t.minJornada)} de jornada` : ""}${g.fallidos.length ? ` · ${g.fallidos.length} corte${g.fallidos.length > 1 ? "s" : ""} no cruzó el área (arrástralo o quítalo)` : ""}.${r.nota ? " " + r.nota : ""}`, g.fallidos.length ? "error" : "ok");
    }
    function refrescarArea() {
      const g = geo();
      poner("vu-sectores", htmlSectores());
      poner("vu-zonas", htmlZonas());
      poner("vu-vista-previa", htmlVistaPrevia());
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
        const vistas = { resumen: vistaResumen, identificacion: vistaIdentificacion, area: vistaArea, vuelo: vistaVuelo, clima: vistaClima, permisos: vistaPermisos };
        html = encabezadoHoja() + `<div class="vu-paso-cuerpo">${(vistas[st.paso] || vistaResumen)()}</div>${pieDePaso()}`;
      } else {
        if (st.vista === "hoja") st.vista = "hojas";
        html = { hojas: vistaHojas, rapido: vistaRapido, kml: vistaKml, drones: vistaDrones }[st.vista]();
      }
      if (!activo2) return;
      const herr = st.vista === "hoja" ? "hojas" : st.vista;
      raiz.innerHTML = `${ctx2.conNav ? `<nav class="vu-nav" aria-label="Vuelos">${HERRAMIENTAS.map(([id, t]) => `<button class="vu-pestana${id === herr ? " activa" : ""}" data-accion="vista" data-vista="${id}">${t}</button>`).join("")}</nav>` : ""}
      ${st.mensaje ? `<div class="vu-msg ${st.mensaje.tipo}">${escapar(st.mensaje.texto)}</div>` : ""}
      <div class="sis-vista">${html}</div>`;
      st.mensaje = null;
      if (st.vista === "hoja" && st.hoja && st.hoja.area.tipo && !st.hoja.ubicacion && !st.ubicError && !st.ubicando) detectarUbicacion();
      if (st.vista === "hoja" && st.paso === "area") mapaArea();
      if (st.vista === "hoja" && st.paso === "vuelo") mapaVuelo();
      if (st.vista === "kml") mapaKml();
    }
    function usarPoligono(p, archivo) {
      const a = st.hoja.area;
      Object.assign(a, { tipo: "poligono", original: { nombre: p.nombre, anillo: limpiarAnillo(p.coords || p.anillo) }, eje: null, ejeCalc: null, auto: {}, archivo, cortes: [], sectores: [], sel: 0, problemas: p.problemas || [] });
      st.subArea = "forma";
      if (!st.hoja.nombre) st.hoja.nombre = p.nombre;
      st.candidatos = null;
      st.dibujo = null;
      if (p.area > 2e3 * 1e4) avisar2(`El polígono tiene ${fmt(p.area / 1e4, 0)} ha: revisa que sea el área de vuelo.`, "error");
      cambio();
    }
    function usarEje(e, archivo) {
      const a = st.hoja.area;
      Object.assign(a, { tipo: "corredor", eje: { nombre: e.nombre, linea: e.linea, largo: e.largo }, original: null, ejeCalc: null, auto: {}, archivo, cortes: [], sectores: [], sel: 0, problemas: e.problemas || [] });
      st.subArea = "forma";
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
      if (tipo === "docpermiso" || tipo === "log") {
        const h = st.hoja;
        if (!h.id) await guardarAhora();
        const carpeta = `Vuelos/${nombreArchivoSeguro(h.nombre)}/${tipo === "log" ? "Logs" : "Permisos"}`;
        if (tipo === "log") {
          h.permisos.logs = h.permisos.logs || [];
          for (const f of t.files) {
            const reg2 = await guardarArchivo(f, { modulo: "vuelos", duenoTipo: "vuelos_hoja", duenoId: h.id, rol: "log", proyectoId: h.proyectoId, carpeta }, { personaId: ctx2.personaId });
            h.permisos.logs.push({ id: reg2.id, nombre: f.name, fecha: (/* @__PURE__ */ new Date()).toISOString(), personaId: ctx2.personaId, archivoId: reg2.id });
          }
          avisar2(t.files.length > 1 ? `${t.files.length} logs cargados` : "Log cargado");
          cambio();
          return;
        }
        const reg = await guardarArchivo(archivo, { modulo: "vuelos", duenoTipo: "vuelos_hoja", duenoId: h.id, rol: "documento", proyectoId: h.proyectoId, carpeta }, { personaId: ctx2.personaId });
        const est2 = h.permisos.docsEstado = h.permisos.docsEstado || {};
        est2[t.dataset.k] = { ...est2[t.dataset.k] || {}, archivoId: reg.id, estado: "adjunto" };
        avisar2("Documento adjunto");
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
      if (tipo === "camino") {
        const { lineas, aviso } = await lineasDeArchivos(t.files);
        if (!lineas.length) throw new Error("El archivo no trae líneas (caminos).");
        const h = st.hoja;
        h.area.caminos = h.area.caminos || [];
        const g = geometria(h), bb = g ? recuadro(g.vuelo.map(g.marco.aLonLat), 3) : null;
        const grupo = [...t.files].map((f) => f.name).find((n) => !/\.(dbf|prj|cpg)$/i.test(n)) || archivo.name;
        let nuevas = [], fuera = 0;
        for (const l of lineas) {
          const partes = bb ? recortarLinea(l.linea, bb) : [simplificarLL(l.linea, 3e-5)];
          if (!partes.length) fuera++;
          for (const linea of partes) nuevas.push({ nombre: l.nombre || grupo, grupo, linea });
        }
        const MAX_VERTICES = 6e4, total = (n) => n.reduce((s, c) => s + c.linea.length, 0);
        const yaHay = total(h.area.caminos);
        let recortado = false;
        while (nuevas.length && yaHay + total(nuevas) > MAX_VERTICES) {
          nuevas = nuevas.slice(0, Math.floor(nuevas.length * 0.8));
          recortado = true;
        }
        if (!nuevas.length) throw new Error(bb ? "Ningún camino del archivo pasa a menos de 3 km del área." : "El archivo no trae caminos que se puedan usar.");
        h.area.caminos.push(...nuevas);
        avisar2(`${nuevas.length} tramo${nuevas.length === 1 ? "" : "s"} de camino agregado${nuevas.length === 1 ? "" : "s"}${bb && fuera > 0 ? ` (se omitieron ${fuera} caminos a más de 3 km del área)` : ""}${recortado ? ". El archivo era muy grande: se cargó solo una parte; carga un archivo recortado a la zona" : ""}.${aviso ? " " + aviso : ""}${bb ? "" : " Sin área cargada no se pudo recortar: carga primero el área."}`, aviso || recortado ? "error" : "ok");
        cambio();
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
    const num = (v2) => String(v2).replace(",", ".").trim();
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
      const v2 = Number(num(objetivo.value));
      if (!(v2 >= 0)) return false;
      if (nombre === "margen") a.margen = Math.min(500, v2);
      else if (nombre === "izq") a.corredor.izq = Math.max(1, v2);
      else a.corredor.der = Math.max(1, v2);
      if (objetivo.dataset.espejo) ponerValor(nombre, v2);
      else {
        const e = raiz.querySelector(`input[data-espejo="${nombre}"]`);
        if (e) e.value = v2;
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
        if (t.dataset.ubic) {
          st.hoja.ubicacion = { ...st.hoja.ubicacion || {}, [t.dataset.ubic]: t.value, auto: false };
          cambio();
          return;
        }
        if (t.dataset.identif) {
          st.hoja[t.dataset.identif] = t.value;
          cambio();
          return;
        }
        if (t.dataset.rumboRango != null) {
          metaSector(st.hoja, secSel()).rumbo = String(Number(t.value));
          const num2 = raiz.querySelector("#vu-rumbo-num");
          if (num2) num2.textContent = `${t.value}°`;
          cambio();
          refrescarVuelo();
          return;
        }
      }
      if (t.dataset.vel) {
        const v2 = Number(num(t.value));
        if (v2 > 0) {
          st[t.dataset.vel] = v2;
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
          if (st.hoja && t.dataset.archivo === "area") detectarUbicacion();
          return;
        }
        if (t.dataset.campo === "filtroProyecto") {
          st.filtroProyecto = t.value;
          await render();
          return;
        }
        if (t.dataset.campo === "verProcesados") {
          st.verProcesados = t.checked;
          await render();
          return;
        }
        if (t.name === "rapDron") {
          st.rapDron = t.value;
          return;
        }
        if (!st.hoja || st.vista !== "hoja") return;
        const h = st.hoja;
        if (t.hasAttribute("data-clima-dia")) {
          if (t.value) {
            st.dia = t.value;
            guardarResumenClima();
          }
          await render();
          return;
        }
        if (t.dataset.horario) {
          h.params.horario = { ...HORARIO_INICIAL, ...h.params.horario || {}, [t.dataset.horario]: t.type === "number" ? Number(t.value) || 0 : t.value };
          cambio();
          await render();
          return;
        }
        if (t.dataset.hoja && (t.tagName === "SELECT" || t.type === "date")) {
          h[t.dataset.hoja] = t.value || null;
          if (t.dataset.hoja === "fecha") st.dia = null;
          if (t.dataset.hoja === "proyectoId") {
            const p = base.proyectos.find((x) => x.id === t.value);
            if (p) {
              if (!h.mandante) h.mandante = p.mandante || "";
              if (!h.jefe) h.jefe = p.solicitadoPor || "";
            }
          }
          cambio();
          await render();
          return;
        }
        if (t.name === "familia") {
          const alt = alturaDe(h.params, dron());
          const x = base.drones.find((d) => (d.familia || d.id) === t.value);
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
        if (t.hasAttribute("data-sector-sel")) {
          h.area.sel = Number(t.value);
          st.dibujo = null;
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
        if (t.dataset.auto) {
          const a = h.area, k = t.dataset.auto;
          a.dm = a.dm || {};
          a.auto = a.auto || {};
          if (k === "dm") {
            const km = dmAKm(t.value);
            a.dm.texto = t.value.trim();
            a.dm.inicio = t.value.trim() ? km : null;
            if (t.value.trim() && km == null) avisar2("No entendí el DM: escríbelo como 10+000.", "error");
          } else if (k === "desc") a.dm.desc = t.checked;
          else if (k === "igual") a.auto.igual = t.checked;
          else if (k === "primer") {
            a.auto.primer = t.value.trim();
            a.auto.primerKm = t.value.trim() ? dmAKm(t.value) : null;
          } else a.auto[k] = t.value.trim();
          if (k === "n") {
            const x = raiz.querySelector("#vu-n-txt");
            if (x) x.textContent = t.value;
          }
          cambio();
          if (k === "modo" || k === "unidad" || k === "unidadSup") {
            await render();
            return;
          }
          refrescarArea();
          return;
        }
        if (t.dataset.accionCambio === "a-corredor") {
          if (corredorDesdeEje(h)) {
            avisar2("Ahora se vuela como corredor sobre el eje calculado. Ajusta el ancho si hace falta.");
            cambio();
          }
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
        if (t.hasAttribute("data-redvial")) {
          st.redVial = t.checked;
          escribirLS2("vu_red_vial", st.redVial);
          await render();
          return;
        }
        if (t.dataset.capa) {
          const todas = capasActivas();
          st.capasActivas = t.checked ? [.../* @__PURE__ */ new Set([...todas, t.dataset.capa])] : todas.filter((x) => x !== t.dataset.capa);
          escribirLS2("vu_capas_activas", st.capasActivas);
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
        if (t.dataset.zona) {
          h.permisos.zona = t.dataset.zona;
          cambio();
          await render();
          return;
        }
        if (t.dataset.docest || t.dataset.docvence) {
          const k = t.dataset.docest || t.dataset.docvence, est2 = h.permisos.docsEstado = h.permisos.docsEstado || {};
          est2[k] = { ...est2[k] || {}, [t.dataset.docest ? "estado" : "vence"]: t.value };
          cambio();
          await render();
          return;
        }
      } catch (e) {
        console.error(e);
        avisar2(e.message || "No se pudo completar", "error");
        await render();
      }
    });
    raiz.addEventListener("keydown", async (ev) => {
      if (ev.key !== "Enter" || !ev.target || ev.target.id !== "vu-nuevo-fijo") return;
      ev.preventDefault();
      if (agregarFijo(ev.target.value)) await render();
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
          if (Object.values(valores).some((v2) => typeof v2 === "number" && !(v2 > 0))) throw new Error("Todos los valores deben ser números mayores que 0.");
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
          if (b.dataset.e !== "volada") h.procesado = false;
          cambio();
          await guardarAhora();
        } else if (a === "procesado") {
          h.procesado = b.dataset.v === "1";
          if (h.procesado && !(h.permisos.logs || []).length) avisar2("Marcado procesado, pero falta cargar el log del vuelo (paso Permisos).", "error");
          cambio();
          await guardarAhora();
        } else if (a === "sel-vuelo") {
          st.selHoja = b.dataset.id;
        } else if (a === "filtro-etapa") {
          st.filtroEtapa = b.dataset.e || "";
        } else if (a === "quitar-log") {
          if (!confirm("¿Quitar este log de la hoja? El archivo queda en el respaldo.")) return;
          h.permisos.logs.splice(Number(b.dataset.i), 1);
          cambio();
        } else if (a === "imprimir") {
          await guardarAhora();
          imprimir();
          return;
        } else if (a === "dia") {
          st.dia = b.dataset.dia;
          if (st.vista === "hoja") guardarResumenClima();
        } else if (a === "consultar-hoja") {
          await consultarHojaAuto(true);
          return;
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
          if (modo === "corte" || modo === "dmfijo" || modo === "vertice") st.subArea = "sectores";
          if (modo === "vertice" && st.dibujo) {
            h.area.auto = { ...h.area.auto || {}, modo: "vertices" };
            cambio();
          }
          if (modo === "area" || modo === "eje") st.subArea = "origen";
          if (modo === "camino") st.subArea = "zonas";
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
            setTimeout(() => detectarUbicacion(true), 0);
            if (autoInterseccion(xy)) avisar2("El contorno dibujado se cruza consigo mismo: dibújalo de nuevo siguiendo el borde.", "error");
          } else if (modo === "camino") {
            if (puntos.length < 2) {
              avisar2("Marca al menos dos puntos del camino.", "error");
              return;
            }
            h.area.caminos = h.area.caminos || [];
            h.area.caminos.push({ nombre: `Camino dibujado ${h.area.caminos.length + 1}`, linea: puntos });
            avisar2("Camino agregado: se usa para sugerir el despegue en el paso Vuelo.");
            cambio();
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
        } else if (a === "quitar-camino") {
          const gr = b.dataset.g;
          h.area.caminos = gr != null ? (h.area.caminos || []).filter((c) => (c.grupo || c.nombre || "Camino") !== gr) : [];
          st.sugDesp = null;
          cambio();
          avisar2(gr != null ? `Se quitó «${gr}».` : "Se quitaron todos los caminos agregados.");
        } else if (a === "despegue-buscar") {
          await buscarDespegue(h, b.dataset.todos === "1");
        } else if (a === "despegue-usar") {
          const i = Number(b.dataset.i), e = st.sugDesp && st.sugDesp.lista.find((x) => x.i === i);
          if (e && e.res) {
            metaSector(h, i).despegue = e.res.lonLat;
            e.usado = true;
            h.area.sel = i;
            avisar2(`Despegue de ${nombreSector(h, i, geo().sectores.length)} movido al camino.`);
            cambio();
          }
        } else if (a === "sub-area") {
          st.subArea = b.dataset.s;
          st.paso = "area";
          if (st.dibujo && (st.dibujo.modo === "corte" || st.dibujo.modo === "dmfijo") && st.subArea !== "sectores") st.dibujo = null;
        } else if (a === "invertir-sentido") {
          const ar = h.area, n = (geo() || { sectores: [] }).sectores.length;
          ar.dm = ar.dm || {};
          ar.dm.inv = !ar.dm.inv;
          if (ar.sectores && ar.sectores.length === n) ar.sectores.reverse();
          if (n) ar.sel = n - 1 - Math.min(ar.sel || 0, n - 1);
          avisar2(`Sentido invertido: el inicio quedó en el ${ar.dm.inv ? "último" : "primer"} vértice del eje.`);
          cambio();
        } else if (a === "agregar-fijo") {
          if (!agregarFijo((raiz.querySelector("#vu-nuevo-fijo") || {}).value)) return;
        } else if (a === "quitar-fijo") {
          h.area.auto.fijos.splice(Number(b.dataset.i), 1);
          cambio();
        } else if (a === "sel-sector") {
          h.area.sel = Number(b.dataset.i);
          st.zoomSector = true;
          cambio();
          refrescarArea();
          return;
        } else if (a === "auto-rumbo" || a === "auto-lado") {
          h.area.auto = h.area.auto || {};
          const actual = h.area.auto.rumbo === "" || h.area.auto.rumbo == null ? Math.round(rumboCortesPropuesto(h)) : Number(h.area.auto.rumbo);
          h.area.auto.rumbo = String(a === "auto-lado" ? Math.round(rumboCortesPropuesto(h)) : ((actual + Number(b.dataset.d)) % 180 + 180) % 180);
          cambio();
        } else if (a === "a-poligono") {
          const ar = h.area;
          if (ar.original) {
            Object.assign(ar, { tipo: "poligono", eje: null, cortes: [], sectores: [], sel: 0 });
            avisar2("Se vuelve a volar como polígono.");
            cambio();
          }
        } else if (a === "auto-cortar") await cortarAutomatico(h);
        else if (a === "tipo-corte") {
          const manual = b.dataset.t === "manual", antes = (h.area.auto || {}).modo || metodoPropuesto(formaDe(h));
          if (manual !== ["vertices", "manual"].includes(antes)) await elegirMetodo(h, manual ? h.area.tipo === "corredor" ? "manual" : "vertices" : metodoPropuesto(formaDe(h)));
        } else if (a === "elegir-metodo") await elegirMetodo(h, b.dataset.m);
        else if (a === "detectar-ubicacion") {
          await detectarUbicacion(true);
          return;
        } else if (a === "programar") {
          const g = geo(), jor = jornadasNecesarias(h, dron(), g);
          if (!jor || !jor.dias.length || !h.fecha) {
            avisar2("Falta el área o el primer día de vuelo.", "error");
          } else {
            const fechas = diasHabilesDesde(h.fecha, jor.dias.length), n = g.sectores.length;
            h.programa = jor.dias.map((di, k) => ({ fecha: fechas[k], dia: k + 1, de: jor.dias.length, sectores: di.sectores.map((i) => nombreSector(h, i, n)), min: Math.round(di.min), baterias: di.baterias }));
            avisar2(`Listo: ${h.programa.length} jornada${h.programa.length === 1 ? "" : "s"} en el calendario (Proyectos → Calendario).`);
            cambio();
          }
        } else if (a === "desprogramar") {
          h.programa = [];
          avisar2("Se quitaron las jornadas del calendario.");
          cambio();
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
            const { rumbo: mejor, minTotal: minimo } = rumboMasCorto(h, dron(), g, i, r.velocidad);
            meta.rumbo = String(mejor);
            avisar2(`Rumbo ${mejor}°: el que da menos tiempo con este despegue (${fmtDuracion(minimo)} de jornada).`);
            cambio();
            await render();
            return;
          }
          cambio();
          refrescarVuelo();
          return;
        } else if (a === "despegue-op") {
          metaSector(h, secSel()).despegue = [Number(b.dataset.lon), Number(b.dataset.lat)];
          cambio();
          refrescarVuelo();
          return;
        } else if (a === "rumbo-lado") {
          metaSector(h, secSel()).rumbo = String(Number(b.dataset.r));
          cambio();
          refrescarVuelo();
          return;
        } else if (a === "rumbo-todos") {
          const g = geo();
          for (let k = 0; k < g.sectores.length; k++) metaSector(h, k).rumbo = String(Number(b.dataset.r));
          avisar2(`Rumbo ${b.dataset.r}° en los ${g.sectores.length} sectores.`);
          cambio();
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
            await navigator.clipboard.writeText([titulo, "", ...tabla.map((f) => f.map((v2, c) => c === 0 ? v2.padEnd(anchos[c]) : v2.padStart(anchos[c])).join("   ")), "", "Tiempo de vuelo estimado; no incluye traslados al lugar ni armado del equipo." + (tabla.some((f) => f[1].endsWith("*")) ? " * Sobre 120 m requiere autorización DGAC." : "")].join("\n"));
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
        } else if (a === "metar-leer" || a === "metar-borrar") {
          const ta = raiz.querySelector("[data-metar-texto]");
          const valor = a === "metar-borrar" ? null : { texto: (ta && ta.value || "").trim(), leidoEn: (/* @__PURE__ */ new Date()).toISOString() };
          if (valor && !valor.texto) {
            if (ta) ta.focus();
            return;
          }
          if (st.vista === "hoja" && h) {
            h.metar = valor;
            cambio();
          } else st.rapMetar = valor;
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
      if (["usar-pol", "usar-eje", "kml-a-hoja", "eje-a-hoja"].includes(a)) detectarUbicacion(true);
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
  var ALMACENES3 = Object.values(ALM3);
  var iniciado3 = false;
  function iniciar4({ personaId } = {}) {
    if (!iniciado3) {
      iniciarDatos2({ personaId: personaId != null ? personaId : null });
      iniciado3 = true;
    } else if (personaId !== void 0) fijarPersona2(personaId);
  }
  function montar3(contenedor2, contexto) {
    iniciar4({ personaId: contexto.personaId });
    return montarPantallas3(contenedor2, contexto);
  }
  async function planesDeProyecto2(proyectoId) {
    iniciar4();
    const [planes, drones] = await Promise.all([planesDeProyecto(proyectoId), listarDrones()]);
    return planes.map((p) => ({ id: p.id, nombre: p.nombre, dronId: p.dronId, dron: (drones.find((d) => d.id === p.dronId) || {}).nombre || p.dronId, resumen: p.resumen || {} }));
  }
  async function listarVuelos() {
    iniciar4();
    return (await listarPlanes()).map(migrarHoja).map((h) => ({
      id: h.id,
      nombre: h.nombre || "Vuelo sin nombre",
      proyectoId: h.proyectoId,
      pilotoId: h.pilotoId,
      fecha: h.fecha,
      fechas: Array.isArray(h.programa) && h.programa.length ? h.programa.map((x) => x.fecha) : h.fecha ? [h.fecha] : [],
      etapa: etapaVuelo(h),
      etapaTexto: NOMBRE_ETAPA_VUELO[etapaVuelo(h)],
      logs: (h.permisos.logs || []).length,
      dgac: h.permisos.dgac,
      docsPendientes: documentosPermiso(h).filter((x) => !x.listo).length,
      resumen: h.resumen || {},
      estado: h.estado
    }));
  }

  // modulos/monografias/datos.js
  var SCHEMA_VERSION4 = 1;
  var ALM5 = { mono: "terreno_monografias", gabinete: "terreno_monografias_gabinete", revisiones: "terreno_revisiones", jornadas: "terreno_jornadas" };
  var ESTADOS = {
    enviada: { texto: "Enviada desde terreno", color: "gris" },
    "en-revision": { texto: "En revisión", color: "azul" },
    lista: { texto: "Lista", color: "verde" },
    "con-observacion": { texto: "Con observación", color: "ambar" },
    borrador: { texto: "Creada en gabinete", color: "gris" }
  };
  var IMAGENES = ["clienteLogo", "croquisImg", "panoramicaImg"];
  var persona3 = null;
  var registrado = false;
  function iniciarDatos4({ personaId = null } = {}) {
    if (!registrado) {
      registrarAlmacenes([
        { nombre: ALM5.mono, indices: [["proyectoId", "proyectoId"]] },
        { nombre: ALM5.gabinete, indices: [["proyectoId", "proyectoId"]] },
        { nombre: ALM5.revisiones, indices: [["monografiaId", "monografiaId"], ["proyectoId", "proyectoId"]] },
        { nombre: ALM5.jornadas, indices: [["proyectoId", "proyectoId"]] }
      ]);
      registrado = true;
    }
    persona3 = personaId;
  }
  function fijarPersona4(p) {
    persona3 = p;
  }
  var sello4 = (r, p = persona3) => sellar(r, { personaId: p, schemaVersion: SCHEMA_VERSION4 });
  var vivo4 = (r) => r && !r.eliminadoEn;
  async function fotosDeProyecto(proyectoId) {
    return (await archivosDeProyecto(proyectoId, "terreno")).filter((a) => (a.mime || "").startsWith("image/"));
  }
  async function revisionesDe(monografiaId) {
    return (await porIndice(ALM5.revisiones, "monografiaId", monografiaId)).filter(vivo4).sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
  }
  async function agregarRevision({ monografiaId, proyectoId, estado: estado3, observacion = "" }, personaId = persona3) {
    if (!ESTADOS[estado3]) throw new Error("Estado desconocido: " + estado3);
    return guardar(ALM5.revisiones, sello4({ id: uuid(), monografiaId, proyectoId, estado: estado3, observacion: String(observacion || "").trim(), por: personaId }, personaId));
  }
  async function historialDe(monografiaId) {
    return revisionesDe(monografiaId);
  }
  async function monografiasDeProyecto(proyectoId) {
    const [deTerreno, deGabinete, revs] = await Promise.all([porIndice(ALM5.mono, "proyectoId", proyectoId), porIndice(ALM5.gabinete, "proyectoId", proyectoId), porIndice(ALM5.revisiones, "proyectoId", proyectoId)]);
    const ultima = /* @__PURE__ */ new Map();
    for (const r of revs.filter(vivo4).sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))) ultima.set(r.monografiaId, r);
    const terreno = new Map(deTerreno.filter(vivo4).map((m) => [m.id, m]));
    const gab = new Map(deGabinete.filter(vivo4).map((m) => [m.id, m]));
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
  async function guardarGabinete(m) {
    const t = await obtener(ALM5.mono, m.id);
    return guardar(ALM5.gabinete, sello4({ ...m, basadoEn: m.basadoEn || (t ? t.actualizadoEn : null) }));
  }
  async function usarVersionDeTerreno(id) {
    const t = await obtener(ALM5.mono, id);
    if (!t) return null;
    const g = await obtener(ALM5.gabinete, id);
    const nueva = { ...t, basadoEn: t.actualizadoEn, proyectoId: t.proyectoId };
    delete nueva.origen;
    return guardar(ALM5.gabinete, sello4({ ...nueva, creadoEn: g ? g.creadoEn : void 0 }));
  }
  async function jornadasDeProyecto(proyectoId) {
    return (await porIndice(ALM5.jornadas, "proyectoId", proyectoId)).filter(vivo4).sort((a, b) => String(b.fechaInicio || "").localeCompare(String(a.fechaInicio || "")));
  }
  async function resumenDeProyecto2(proyectoId) {
    const [monos, jornadas] = await Promise.all([monografiasDeProyecto(proyectoId), jornadasDeProyecto(proyectoId)]);
    const por = {};
    for (const m of monos) por[m.estado] = (por[m.estado] || 0) + 1;
    return { total: monos.length, porEstado: por, jornadas };
  }

  // modulos/monografias/coordenadas.js
  var DATUMS_CHILE = ["SIRGAS-Chile 2021", "SIRGAS-Chile 2016", "SIRGAS-Chile 2013", "SIRGAS-Chile 2002", "WGS84", "PSAD56", "SAD69"];
  var GEOIDES = ["EGM2008", "EGM96", "Modelo geoidal local"];
  var ZONAS_POR_PAIS = {
    Chile: ["18 S", "19 S", "17 S (Juan Fernández)", "12 S (Isla de Pascua)"],
    "Perú": ["17 S", "18 S", "19 S"],
    Argentina: ["19 S", "20 S", "21 S"],
    Bolivia: ["19 S", "20 S", "21 S"]
  };
  function leerGrados(texto3) {
    let t = String(texto3 != null ? texto3 : "").trim().replace(/,/g, ".").toUpperCase();
    if (!t) return null;
    const sur = /[SWO]\s*$/.test(t) || /^[SWO]/.test(t) || t.startsWith("-");
    t = t.replace(/[NSEWO]/g, " ").replace(/^-/, "").trim();
    const nums = t.match(/\d+(?:\.\d+)?/g);
    if (!nums) return null;
    const [g, m = 0, s = 0] = nums.map(Number);
    const v = g + m / 60 + s / 3600;
    if (!isFinite(v)) return null;
    return sur ? -v : v;
  }
  function escribirGrados(v, eje, formato = "dms", dec = 4) {
    if (v == null || !isFinite(v)) return "";
    const n = Math.max(0, Math.min(8, Number(dec) || 0));
    if (formato === "dd") return `${v.toFixed(n).replace(".", ",")}°`;
    const hem = eje === "lat" ? v < 0 ? "S" : "N" : v < 0 ? "O" : "E";
    const a = Math.abs(v);
    let g = Math.floor(a), m = Math.floor((a - g) * 60), s = ((a - g) * 60 - m) * 60;
    if (Number(s.toFixed(n)) >= 60) {
      s = 0;
      m += 1;
    }
    if (m >= 60) {
      m = 0;
      g += 1;
    }
    return `${g}°${String(m).padStart(2, "0")}'${s.toFixed(n).replace(".", ",").padStart(n ? n + 3 : 2, "0")}" ${hem}`;
  }

  // modulos/monografias/croquis.js
  var ESRI = (s) => `https://server.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/{z}/{y}/{x}`;
  var CAPAS = [ESRI("World_Imagery"), ESRI("Reference/World_Transportation"), ESRI("Reference/World_Boundaries_and_Places")];
  var SIMBOLOS = [["circulo-cruz", "Círculo con cruz"], ["triangulo", "Triángulo"], ["cuadrado", "Cuadrado"], ["circulo", "Círculo lleno"], ["estrella", "Estrella"]];
  var FUENTES = [["Arial", "Arial"], ["IBM Plex Sans", "IBM Plex Sans"], ["Georgia", "Georgia (serif)"], ["Courier New", "Courier (monoespaciada)"]];
  function dibujarSimbolo(c, tipo, x, y, r, color) {
    c.save();
    c.lineWidth = Math.max(2, r / 4);
    c.strokeStyle = "#FFFFFF";
    c.fillStyle = color;
    c.beginPath();
    if (tipo === "triangulo") {
      c.moveTo(x, y - r);
      c.lineTo(x + r * 0.9, y + r * 0.7);
      c.lineTo(x - r * 0.9, y + r * 0.7);
      c.closePath();
    } else if (tipo === "cuadrado") c.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
    else if (tipo === "estrella") {
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
        c[k ? "lineTo" : "moveTo"](x + rr * Math.cos(a), y + rr * Math.sin(a));
      }
      c.closePath();
    } else c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    if (tipo === "circulo-cruz") {
      c.beginPath();
      c.moveTo(x - r * 0.65, y);
      c.lineTo(x + r * 0.65, y);
      c.moveTo(x, y - r * 0.65);
      c.lineTo(x, y + r * 0.65);
      c.stroke();
    }
    c.restore();
  }
  function dibujarNorte(c, x, y, h) {
    c.save();
    c.fillStyle = "#FFFFFF";
    c.strokeStyle = "#1C1F23";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + h * 0.32, y + h * 0.75);
    c.lineTo(x, y + h * 0.58);
    c.lineTo(x - h * 0.32, y + h * 0.75);
    c.closePath();
    c.fill();
    c.stroke();
    c.font = `bold ${Math.round(h * 0.42)}px Arial`;
    c.textAlign = "center";
    c.lineWidth = 3;
    c.strokeText("N", x, y + h * 1.2);
    c.fillText("N", x, y + h * 1.2);
    c.restore();
  }
  async function capturar(mapa, L, op) {
    const tam = mapa.getSize(), z = mapa.getZoom(), b = mapa.getPixelBounds(), escala = 2;
    const cv = document.createElement("canvas");
    cv.width = tam.x * escala;
    cv.height = tam.y * escala;
    const c = cv.getContext("2d");
    c.scale(escala, escala);
    c.fillStyle = "#C9B48F";
    c.fillRect(0, 0, tam.x, tam.y);
    const cargar = (url) => new Promise((ok, mal) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => ok(im);
      im.onerror = mal;
      im.src = url;
    });
    const t0x = Math.floor(b.min.x / 256), t1x = Math.floor(b.max.x / 256), t0y = Math.floor(b.min.y / 256), t1y = Math.floor(b.max.y / 256);
    for (const plantilla of CAPAS) {
      const tareas = [];
      for (let tx = t0x; tx <= t1x; tx++) for (let ty = t0y; ty <= t1y; ty++) {
        const url = plantilla.replace("{z}", z).replace("{x}", tx).replace("{y}", ty);
        tareas.push(cargar(url).then((im) => c.drawImage(im, tx * 256 - b.min.x, ty * 256 - b.min.y, 256, 256)).catch(() => {
        }));
      }
      await Promise.all(tareas);
    }
    const p = mapa.latLngToContainerPoint(op.punto);
    dibujarSimbolo(c, op.simbolo, p.x, p.y, op.tamSimbolo, op.color);
    if (op.nombre) {
      c.save();
      c.font = `${op.negrita ? "bold " : ""}${op.tamLetra}px "${op.fuente}", Arial, sans-serif`;
      c.textBaseline = "middle";
      c.lineWidth = Math.max(3, op.tamLetra / 5);
      c.strokeStyle = "rgba(0,0,0,.75)";
      c.fillStyle = op.colorLetra;
      const x = p.x + op.tamSimbolo + 6;
      c.strokeText(op.nombre, x, p.y);
      c.fillText(op.nombre, x, p.y);
      c.restore();
    }
    if (op.norte) dibujarNorte(c, 28, 14, 34);
    return cv.toDataURL("image/jpeg", 0.9);
  }
  async function abrirCroquis({ lat, lon, nombre = "", aspecto = 1.6 }) {
    if (!window.L) await cargarScript("vendor/leaflet/leaflet.js");
    const L = window.L;
    const tieneCoord = isFinite(lat) && isFinite(lon) && (lat || lon);
    const punto = tieneCoord ? [lat, lon] : [-33.45, -70.66];
    const prefs = (() => {
      try {
        return JSON.parse(localStorage.getItem("mn_croquis_prefs") || "{}");
      } catch {
        return {};
      }
    })();
    const op = { simbolo: "circulo-cruz", color: "#E53935", tamSimbolo: 10, fuente: "Arial", tamLetra: 16, negrita: true, colorLetra: "#FFFFFF", norte: true, ...prefs, nombre, punto };
    const ancho = Math.min(760, window.innerWidth - 48), alto = Math.round(ancho / aspecto);
    const caja2 = document.createElement("div");
    caja2.className = "mn-modal";
    caja2.setAttribute("role", "dialog");
    caja2.setAttribute("aria-modal", "true");
    caja2.setAttribute("aria-label", "Croquis de ubicación");
    caja2.innerHTML = `<div class="mn-modal-caja mn-croquis">
    <div class="sis-cab"><h2>Croquis de ubicación</h2><button type="button" class="sis-btn chico" data-c="cancelar">Cerrar</button></div>
    <p class="sis-tenue">${tieneCoord ? "El punto está en sus coordenadas geodésicas." : "La monografía aún no tiene latitud y longitud: toca el mapa para ubicar el punto."} Toca el mapa para mover el punto; acerca o aleja para encuadrar como quieres que salga.</p>
    <div class="mn-croquis-cuerpo">
      <div class="mn-croquis-mapa" style="width:${ancho}px; height:${alto}px"></div>
      <div class="mn-croquis-op">
        <label class="sis-campo"><span>Nombre del punto</span><input data-o="nombre" value="${escapar(op.nombre)}"></label>
        <label class="sis-campo"><span>Símbolo</span><select data-o="simbolo">${SIMBOLOS.map(([k, t]) => `<option value="${k}" ${op.simbolo === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <div class="sis-par"><label class="sis-campo"><span>Color</span><input type="color" data-o="color" value="${op.color}"></label><label class="sis-campo"><span>Tamaño</span><input type="number" min="5" max="30" data-o="tamSimbolo" value="${op.tamSimbolo}"></label></div>
        <label class="sis-campo"><span>Tipo de letra</span><select data-o="fuente">${FUENTES.map(([k, t]) => `<option value="${k}" ${op.fuente === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <div class="sis-par"><label class="sis-campo"><span>Alto de letra (px)</span><input type="number" min="8" max="48" data-o="tamLetra" value="${op.tamLetra}"></label><label class="sis-campo"><span>Color de letra</span><input type="color" data-o="colorLetra" value="${op.colorLetra}"></label></div>
        <label class="sis-check"><input type="checkbox" data-o="negrita" ${op.negrita ? "checked" : ""}> Negrita</label>
        <label class="sis-check"><input type="checkbox" data-o="norte" ${op.norte ? "checked" : ""}> Flecha de norte</label>
        <p class="mn-croquis-msg sis-tenue" role="status"></p>
        <div class="sis-acciones"><button type="button" class="sis-btn primario" data-c="usar">Usar como croquis</button></div>
      </div>
    </div></div>`;
    document.body.appendChild(caja2);
    const lugar = caja2.querySelector(".mn-croquis-mapa");
    const mapa = L.map(lugar, { zoomControl: true, attributionControl: true }).setView(punto, tieneCoord ? 13 : 5);
    CAPAS.forEach((u, i) => L.tileLayer(u, { maxZoom: 19, crossOrigin: "anonymous", attribution: i ? "" : "Imagen © Esri, Maxar, Earthstar Geographics" }).addTo(mapa));
    const icono = () => L.divIcon({ className: "mn-croquis-marca", html: `<canvas width="${op.tamSimbolo * 2 + 6}" height="${op.tamSimbolo * 2 + 6}"></canvas><span style="font:${op.negrita ? "bold " : ""}${op.tamLetra}px '${op.fuente}', Arial; color:${op.colorLetra}">${escapar(op.nombre)}</span>`, iconSize: [op.tamSimbolo * 2 + 6, op.tamSimbolo * 2 + 6], iconAnchor: [op.tamSimbolo + 3, op.tamSimbolo + 3] });
    const marca = L.marker(punto, { icon: icono(), keyboard: false }).addTo(mapa);
    const pintarMarca = () => {
      marca.setIcon(icono());
      const cv = marca.getElement() && marca.getElement().querySelector("canvas");
      if (cv) dibujarSimbolo(cv.getContext("2d"), op.simbolo, cv.width / 2, cv.height / 2, op.tamSimbolo, op.color);
    };
    pintarMarca();
    mapa.on("click", (e) => {
      op.punto = [e.latlng.lat, e.latlng.lng];
      marca.setLatLng(e.latlng);
    });
    return new Promise((resolver) => {
      const cerrar = (v) => {
        try {
          localStorage.setItem("mn_croquis_prefs", JSON.stringify({ simbolo: op.simbolo, color: op.color, tamSimbolo: op.tamSimbolo, fuente: op.fuente, tamLetra: op.tamLetra, negrita: op.negrita, colorLetra: op.colorLetra, norte: op.norte }));
        } catch {
        }
        mapa.remove();
        caja2.remove();
        resolver(v);
      };
      caja2.addEventListener("input", (ev) => {
        const k = ev.target.dataset.o;
        if (!k) return;
        op[k] = ev.target.type === "checkbox" ? ev.target.checked : ev.target.type === "number" ? Number(ev.target.value) : ev.target.value;
        pintarMarca();
      });
      caja2.addEventListener("change", (ev) => {
        const k = ev.target.dataset.o;
        if (!k) return;
        op[k] = ev.target.type === "checkbox" ? ev.target.checked : ev.target.type === "number" ? Number(ev.target.value) : ev.target.value;
        pintarMarca();
      });
      caja2.addEventListener("click", async (ev) => {
        const b = ev.target.closest("[data-c]");
        if (!b) return;
        if (b.dataset.c === "cancelar") return cerrar(null);
        const msg = caja2.querySelector(".mn-croquis-msg");
        msg.textContent = "Dibujando el croquis…";
        b.disabled = true;
        try {
          cerrar(await capturar(mapa, L, op));
        } catch (e) {
          console.warn(e);
          msg.textContent = "No se pudo dibujar el mapa (sin conexión o el servidor de mapas no lo permite). Sube una imagen del croquis.";
          b.disabled = false;
        }
      });
    });
  }

  // modulos/monografias/pieza-terreno.js
  var state = { config: { marca: {}, fuenteMonografia: { tipo: "carlito" } }, monografias: [] };
  function configurarPieza({ logoEmpresa: logoEmpresa2 = null, fuente = "carlito", monografias = null } = {}) {
    state.config.marca = { ...state.config.marca, logoEmpresa: logoEmpresa2 };
    state.config.fuenteMonografia = { tipo: fuente };
    if (monografias) state.monografias = monografias;
  }
  function cargarImagenEl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  function calcRectImagen(iw, ih, bw, bh, aj) {
    aj = aj || {};
    const modo = aj.modo === "ajustar" ? "ajustar" : "llenar";
    const zoom = Math.min(4, Math.max(1, Number(aj.zoom) || 1));
    const base = modo === "ajustar" ? Math.min(bw / iw, bh / ih) : Math.max(bw / iw, bh / ih);
    const s = base * zoom;
    const w = iw * s, h = ih * s;
    const sx = Math.max(0, (w - bw) / 2), sy = Math.max(0, (h - bh) / 2);
    const ox = Math.min(1, Math.max(-1, Number(aj.ox) || 0)), oy = Math.min(1, Math.max(-1, Number(aj.oy) || 0));
    return { x: (bw - w) / 2 + ox * sx, y: (bh - h) / 2 + oy * sy, w, h, sx, sy };
  }
  async function renderizarImagenAjustada(dataUrl, bw, bh, aj, opts) {
    opts = opts || {};
    const img = await cargarImagenEl(dataUrl);
    const PX = opts.pxPorMm || 8;
    const cw = Math.max(2, Math.round(bw * PX)), ch = Math.max(2, Math.round(bh * PX));
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const ctx2 = c.getContext("2d");
    if (!opts.png) {
      ctx2.fillStyle = "#fff";
      ctx2.fillRect(0, 0, cw, ch);
    }
    const giro2 = ((Number((aj || {}).giro) || 0) % 360 + 360) % 360;
    const swap = giro2 === 90 || giro2 === 270;
    const iw = swap ? img.naturalHeight : img.naturalWidth, ih = swap ? img.naturalWidth : img.naturalHeight;
    const r = calcRectImagen(iw, ih, cw, ch, aj);
    ctx2.save();
    ctx2.beginPath();
    ctx2.rect(0, 0, cw, ch);
    ctx2.clip();
    ctx2.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx2.rotate(giro2 * Math.PI / 180);
    ctx2.drawImage(img, -(swap ? r.h : r.w) / 2, -(swap ? r.w : r.h) / 2, swap ? r.h : r.w, swap ? r.w : r.h);
    ctx2.restore();
    return opts.png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.9);
  }
  function impNum(s, decimal, esGeo) {
    if (s == null) return null;
    let t = String(s).trim();
    if (!t) return null;
    if (esGeo) {
      const m = /^([+-]?)\s*(\d+(?:[.,]\d+)?)\s*[°º]\s*(?:(\d+(?:[.,]\d+)?)\s*['′]\s*)?(?:(\d+(?:[.,]\d+)?)\s*["″]\s*)?([NSEWOnsewo])?$/.exec(t);
      if (m) {
        const f = (x) => parseFloat(String(x || 0).replace(",", "."));
        let v = f(m[2]) + f(m[3]) / 60 + f(m[4]) / 3600;
        if (m[1] === "-" || /^[SsWwOo]$/.test(m[5] || "")) v = -v;
        return { v, txt: t.replace(/\s+/g, " ") };
      }
      const g = /^([NSEWOnsewo])?\s*([+-]?)\s*(\d+(?:[.,]\d+)?)[\s:°º'′"″]+(\d+(?:[.,]\d+)?)(?:[\s:'′"″]+(\d+(?:[.,]\d+)?))?\s*['′"″]?\s*([NSEWOnsewo])?$/.exec(t);
      if (g && !(g[1] && g[6])) {
        const f = (x) => parseFloat(String(x || 0).replace(",", "."));
        const gr = f(g[3]), mi = f(g[4]), se = f(g[5]);
        if (mi < 60 && se < 60) {
          let v = gr + mi / 60 + se / 3600;
          const h = g[1] || g[6] || "";
          if (g[2] === "-" || /^[SsWwOo]$/.test(h)) v = -v;
          return { v, txt: t.replace(/\s+/g, " ") };
        }
      }
    }
    if (decimal === "coma") t = t.replace(",", ".");
    if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return null;
    return { v: parseFloat(t), txt: t.replace(/^\+/, "") };
  }
  function monoResumenDatos(m) {
    const mod = m.modulos || {};
    const t = (v) => String(v == null ? "" : v).trim();
    const num = (v) => {
      const x = parseFloat(t(v).replace(",", "."));
      return isFinite(x) ? x : null;
    };
    const mismas = state.monografias.filter((x) => x.id !== m.id && t(x.nombreProyecto) === t(m.nombreProyecto));
    const nombres = (arr) => arr.map((x) => t(x.puntoMedido) || "(sin punto)").join(", ");
    const dup = (fn) => mismas.filter(fn);
    const eq = (a, b) => {
      const x = num(a), y = num(b);
      return x != null && y != null && Math.abs(x - y) < 1e-9;
    };
    const geo = (v) => {
      const r = impNum(t(v), "punto", true);
      return r ? r.v : null;
    };
    const eqGeo = (a, b) => {
      const x = geo(a), y = geo(b);
      return x != null && y != null && Math.abs(x - y) < 1e-9;
    };
    const filas = [];
    const dPunto = dup((x) => t(x.puntoMedido).toLowerCase() === t(m.puntoMedido).toLowerCase() && t(m.puntoMedido) !== "");
    filas.push({ k: "Punto", ok: !!t(m.puntoMedido), det: t(m.puntoMedido), dup: dPunto.length ? "código repetido en este proyecto (" + dPunto.length + " más)" : "" });
    if (mod.utm !== false) {
      const ok = !!(t(m.norte) && t(m.este));
      const d = ok ? dup((x) => eq(x.norte, m.norte) && eq(x.este, m.este)) : [];
      filas.push({
        k: "Coordenadas UTM",
        ok,
        det: ok ? "N " + t(m.norte) + " · E " + t(m.este) : t(m.norte) || t(m.este) ? "incompletas" : "",
        dup: d.length ? "mismas coordenadas que " + nombres(d) : "",
        calc: ok && m.calc && m.calc.utm && t(m.calc.utm.norte) === t(m.norte) && t(m.calc.utm.este) === t(m.este) ? "calculadas por la app desde las geográficas" : ""
      });
    }
    if (mod.geodesicas !== false) {
      const ok = !!(t(m.latitud) && t(m.longitud));
      const d = ok ? dup((x) => eqGeo(x.latitud, m.latitud) && eqGeo(x.longitud, m.longitud)) : [];
      filas.push({
        k: "Geográficas",
        ok,
        det: ok ? t(m.latitud) + ", " + t(m.longitud) : t(m.latitud) || t(m.longitud) ? "incompletas" : "",
        dup: d.length ? "mismas coordenadas que " + nombres(d) : "",
        calc: ok && m.calc && m.calc.geo && t(m.calc.geo.lat) === t(m.latitud) && t(m.calc.geo.lng) === t(m.longitud) ? "calculadas por la app desde UTM" : ""
      });
      const okH = !!t(m.alturaElipsoidal);
      const dH = okH ? dup((x) => eq(x.alturaElipsoidal, m.alturaElipsoidal)) : [];
      filas.push({ k: "H. elipsoidal", ok: okH, det: t(m.alturaElipsoidal), dup: dH.length ? "mismo valor que " + nombres(dH) : "" });
    }
    if (mod.utm !== false || mod.geodesicas !== false) {
      const okC = !!t(m.cotaOrtometrica);
      const dC = okC ? dup((x) => eq(x.cotaOrtometrica, m.cotaOrtometrica)) : [];
      filas.push({ k: "Cota ortométrica", ok: okC, det: t(m.cotaOrtometrica), dup: dC.length ? "mismo valor que " + nombres(dC) : "" });
    }
    if (mod.croquis !== false) filas.push({ k: "Croquis", ok: !!m.croquisImg });
    if (mod.panoramica !== false) filas.push({ k: "Fotografía panorámica", ok: !!m.panoramicaImg });
    if (mod.fotos) {
      const n = (m.fotosExtra || []).filter((f) => f.img).length;
      filas.push({ k: "Fotos adicionales", ok: n > 0, det: n ? n + " foto" + (n === 1 ? "" : "s") : "" });
    }
    return filas;
  }
  function ordenNatural(a, b) {
    return String(a.puntoMedido || "").localeCompare(String(b.puntoMedido || ""), "es", { numeric: true, sensitivity: "base" });
  }
  var FUENTE_CARLITO_REGULAR = "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";
  var FUENTE_CARLITO_BOLD = "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";
  function registrarFuenteMonografia(doc) {
    doc.addFileToVFS("Carlito-Regular.ttf", FUENTE_CARLITO_REGULAR);
    doc.addFont("Carlito-Regular.ttf", "Carlito", "normal");
    doc.addFileToVFS("Carlito-Bold.ttf", FUENTE_CARLITO_BOLD);
    doc.addFont("Carlito-Bold.ttf", "Carlito", "bold");
  }
  function prepararFuentePdf(doc) {
    const cfg2 = state.config.fuenteMonografia || { tipo: "carlito" };
    if (cfg2.tipo === "helvetica") return "helvetica";
    if (cfg2.tipo === "times") return "times";
    if (cfg2.tipo === "personalizada" && cfg2.personalizadaRegular) {
      try {
        doc.addFileToVFS("FuentePersonalizada-Regular.ttf", cfg2.personalizadaRegular);
        doc.addFont("FuentePersonalizada-Regular.ttf", "DocFuente", "normal");
        if (cfg2.personalizadaBold) {
          doc.addFileToVFS("FuentePersonalizada-Bold.ttf", cfg2.personalizadaBold);
          doc.addFont("FuentePersonalizada-Bold.ttf", "DocFuente", "bold");
        } else {
          doc.addFont("FuentePersonalizada-Regular.ttf", "DocFuente", "bold");
        }
        return "DocFuente";
      } catch (e) {
        registrarFuenteMonografia(doc);
        return "Carlito";
      }
    }
    registrarFuenteMonografia(doc);
    return "Carlito";
  }
  var MONO_NAVY = [31, 58, 95];
  var MONO_NEGRO = [20, 22, 21];
  var MONO_GRIS = [90, 90, 90];
  function dimsMonografia(m) {
    const mod = m.modulos || {};
    const lado = (m.disposicionImg || "lado") === "lado" && mod.croquis && mod.panoramica;
    const wB = lado ? 95 : 190;
    const hB = Math.min(120, Math.max(30, Number(m.altoImagenes) || 56));
    const hE = Math.min(120, Math.max(30, Number(m.altoFotosExtra) || 60));
    return {
      lado,
      hB,
      hE,
      clienteLogo: [36, 16],
      logoEmpresa: [34, 16],
      croquisImg: [wB - 1, hB - 1],
      panoramicaImg: [wB - 1, hB - 1],
      extra: [94, hE - 1]
    };
  }
  function ajusteDe(m, clave2, porDefecto) {
    return Object.assign({ modo: porDefecto || "llenar", zoom: 1, ox: 0, oy: 0, giro: 0 }, (m.ajustes || {})[clave2] || {});
  }
  async function prepararImagenesMonografia(m) {
    const d = dimsMonografia(m), mod = m.modulos || {}, out = { extras: {} };
    const marca = state.config.marca || {};
    const hacer = async (url, dim, aj, png) => {
      try {
        return await renderizarImagenAjustada(url, dim[0], dim[1], aj, { png });
      } catch (_) {
        return null;
      }
    };
    if (m.clienteLogo) out.clienteLogo = await hacer(m.clienteLogo, d.clienteLogo, ajusteDe(m, "clienteLogo", "ajustar"), true);
    if (marca.logoEmpresa) out.logoEmpresa = await hacer(marca.logoEmpresa, d.logoEmpresa, { modo: "ajustar" }, true);
    if (mod.croquis && m.croquisImg) out.croquisImg = await hacer(m.croquisImg, d.croquisImg, ajusteDe(m, "croquisImg"), false);
    if (mod.panoramica && m.panoramicaImg) out.panoramicaImg = await hacer(m.panoramicaImg, d.panoramicaImg, ajusteDe(m, "panoramicaImg"), false);
    if (mod.fotos) {
      for (const f of m.fotosExtra || []) if (f.img) out.extras[f.id] = await hacer(f.img, d.extra, Object.assign({ modo: "llenar" }, f.aj || {}), false);
    }
    return out;
  }
  function construirMonografiaPdf(m, imgs, docExistente) {
    imgs = imgs || { extras: {} };
    const { jsPDF } = window.jspdf;
    const doc = docExistente || new jsPDF();
    if (docExistente) doc.addPage();
    const nombreFuente = docExistente ? docExistente.__nombreFuente : prepararFuentePdf(doc);
    doc.__nombreFuente = nombreFuente;
    const X0 = 10, W = 190;
    let y = 12;
    const marca = state.config.marca;
    function caja2(x, w, h, relleno) {
      if (relleno) {
        doc.setFillColor(...MONO_NAVY);
        doc.rect(x, y, w, h, "F");
      }
      doc.setDrawColor(...MONO_NAVY);
      doc.setLineWidth(0.3);
      doc.rect(x, y, w, h);
    }
    function txt(s, x, yy, opts) {
      opts = opts || {};
      doc.setFont(nombreFuente, opts.bold ? "bold" : "normal");
      doc.setFontSize(opts.size || 9);
      doc.setTextColor(...opts.color || MONO_NEGRO);
      doc.text(s, x, yy, { align: opts.align || "left" });
    }
    const hA = 26;
    const wCliente = 42, wLogo = 42, wTitulo = W - wCliente - wLogo;
    caja2(X0, wCliente, hA);
    caja2(X0 + wCliente, wTitulo, hA);
    caja2(X0 + wCliente + wTitulo, wLogo, hA);
    txt("Cliente:", X0 + 2, y + 5, { size: 7.5 });
    if (imgs.clienteLogo) {
      try {
        doc.addImage(imgs.clienteLogo, "PNG", X0 + 3, y + 7, wCliente - 6, hA - 10, void 0, "FAST");
      } catch (e) {
      }
    }
    txt(m.tituloDocumento || "Monografía de PRs y Monolitos", X0 + wCliente + wTitulo / 2, y + hA / 2 + 2, { bold: true, size: 15, align: "center", color: MONO_NEGRO });
    if (imgs.logoEmpresa) {
      try {
        doc.addImage(imgs.logoEmpresa, "PNG", X0 + wCliente + wTitulo + 4, y + 5, wLogo - 8, hA - 10, void 0, "FAST");
      } catch (e) {
      }
    }
    y += hA;
    if (m.nombreProyecto) {
      const hB = 10;
      caja2(X0, W, hB);
      const tituloProy = m.nombreProyecto.toUpperCase();
      let szProy = 10.5;
      doc.setFont(nombreFuente, "bold");
      while (szProy > 6.5) {
        doc.setFontSize(szProy);
        if (doc.getTextWidth(tituloProy) <= W - 8) break;
        szProy -= 0.5;
      }
      txt(tituloProy, X0 + W / 2, y + hB / 2 + 2, { bold: true, size: szProy, align: "center" });
      y += hB;
    }
    const hC = 15;
    const wPunto = W * 0.62, wUbic = W - wPunto;
    caja2(X0, wPunto, hC);
    caja2(X0 + wPunto, wUbic, hC);
    txt("Punto medido:", X0 + 3, y + hC / 2 + 1.5, { size: 9 });
    txt(m.puntoMedido || "—", X0 + wPunto / 2 + 14, y + hC / 2 + 2, { bold: true, size: 15, align: "center" });
    const unir = (...a) => a.map((v) => (v || "").trim()).filter(Boolean).join(", ");
    const l1 = unir(m.ubicacion, m.localidad) || "—";
    const l2 = unir(m.comuna, m.region || m.provincia);
    const ajustar = (s, maxW, size) => {
      doc.setFont(nombreFuente, "normal");
      let z = size;
      doc.setFontSize(z);
      while (z > 5.5 && doc.getTextWidth(s) > maxW) {
        z -= 0.5;
        doc.setFontSize(z);
      }
      return z;
    };
    txt("Ubicación:", X0 + wPunto + 3, y + 6, { size: 9 });
    const maxU = wUbic - 26 - 2;
    txt(l1, X0 + wPunto + 26, y + 6, { size: ajustar(l1, maxU, 9) });
    if (l2) txt(l2, X0 + wPunto + 26, y + 11.5, { size: ajustar(l2, maxU, 9) });
    y += hC;
    const utmOn = m.modulos.utm, geoOn = m.modulos.geodesicas;
    if (utmOn || geoOn) {
      let subcolsUTM = function(x0, w0) {
        return [{ l: "Punto", w: w0 * 0.17 }, { l: "Norte(m)", w: w0 * 0.28 }, { l: "Este(m)", w: w0 * 0.28 }, { l: "Cota Ortométrica(m)", w: w0 * 0.27 }];
      }, subcolsGEO = function(x0, w0) {
        return [{ l: "Punto", w: w0 * 0.17 }, { l: "Latitud (°)", w: w0 * 0.28 }, { l: "Longitud (°)", w: w0 * 0.28 }, { l: "Altura Elip(m)", w: w0 * 0.27 }];
      }, sizeParaAncho = function(texto3, anchoDisponible, bold) {
        let tam = 8;
        doc.setFont(nombreFuente, bold ? "bold" : "normal");
        doc.setFontSize(tam);
        while (tam > 5 && doc.getTextWidth(texto3) > anchoDisponible) {
          tam -= 0.5;
          doc.setFontSize(tam);
        }
        return tam;
      }, filaCols = function(x0, w0, cols, valores, bold) {
        let cx = x0;
        cols.forEach((c, i) => {
          doc.setDrawColor(...MONO_NAVY);
          doc.setLineWidth(0.25);
          doc.rect(cx, y, c.w, bold ? hHead : 6);
          const tam = sizeParaAncho(valores[i], c.w - 2, bold);
          txt(valores[i], cx + c.w / 2, y + (bold ? hHead : 6) / 2 + 1.5, { bold, size: tam, align: "center", color: bold ? [255, 255, 255] : MONO_NEGRO });
          cx += c.w;
        });
      };
      const mitad = utmOn && geoOn;
      const wBloque = mitad ? W / 2 : W;
      const hEnc = 5.5;
      if (utmOn) {
        caja2(X0, wBloque, hEnc);
        txt("Coordenadas UTM - " + [m.datumUTM, m.zonaUTM].filter(Boolean).join("- Zona "), X0 + 2, y + hEnc - 1.5, { bold: true, size: 8 });
      }
      if (geoOn) {
        const x = mitad ? X0 + wBloque : X0;
        caja2(x, wBloque, hEnc);
        txt("Coordenadas Geodésicas - " + (m.datumGeodesico || ""), x + 2, y + hEnc - 1.5, { bold: true, size: 8 });
      }
      y += hEnc;
      const hNota = 4.5;
      if (utmOn) {
        caja2(X0, wBloque, hNota);
        txt("Geoide: " + (m.geoide || "—"), X0 + 2, y + hNota - 1.2, { size: 7 });
      }
      if (geoOn) {
        const x = mitad ? X0 + wBloque : X0;
        caja2(x, wBloque, hNota);
        const esGMS = /[°º'′"″]/.test(String(m.latitud || "") + String(m.longitud || ""));
        txt(esGMS ? "Coordenadas en grados, minutos y segundos" : "Coordenadas en grados decimales", x + 2, y + hNota - 1.2, { size: 7, color: MONO_GRIS });
      }
      y += hNota;
      const hHead = 6.5;
      if (utmOn) {
        doc.setFillColor(...MONO_NAVY);
        doc.rect(X0, y, wBloque, hHead, "F");
        filaCols(X0, wBloque, subcolsUTM(X0, wBloque), ["Punto", "Norte(m)", "Este(m)", "Cota Ortométrica(m)"], true);
      }
      if (geoOn) {
        const x = mitad ? X0 + wBloque : X0;
        doc.setFillColor(...MONO_NAVY);
        doc.rect(x, y, wBloque, hHead, "F");
        filaCols(x, wBloque, subcolsGEO(x, wBloque), ["Punto", "Latitud (°)", "Longitud (°)", "Altura Elip(m)"], true);
      }
      y += hHead;
      if (utmOn) filaCols(X0, wBloque, subcolsUTM(X0, wBloque), [m.puntoMedido || "—", m.norte || "—", m.este || "—", m.cotaOrtometrica || "—"], false);
      if (geoOn) filaCols(mitad ? X0 + wBloque : X0, wBloque, subcolsGEO(X0, wBloque), [m.puntoMedido || "—", m.latitud || "—", m.longitud || "—", m.alturaElipsoidal || "—"], false);
      y += 6.5;
    }
    const croqOn = m.modulos.croquis, panoOn = m.modulos.panoramica;
    if (croqOn || panoOn) {
      const dm = dimsMonografia(m);
      const mitad = croqOn && panoOn && dm.lado;
      const wBloque = mitad ? W / 2 : W;
      const imgH = dm.hB;
      const bloques = [];
      if (croqOn) bloques.push({ titulo: "Croquis Ubicación", img: imgs.croquisImg });
      if (panoOn) bloques.push({ titulo: "Vista Panorámica", img: imgs.panoramicaImg });
      const filas = mitad ? [bloques] : bloques.map((b) => [b]);
      filas.forEach((fila2) => {
        if (y + 6 + imgH > 282) {
          doc.addPage();
          y = 14;
        }
        const hEnc = 5.5;
        fila2.forEach((b, k) => {
          const x = X0 + k * wBloque;
          caja2(x, wBloque, hEnc);
          txt(b.titulo, x + 2, y + hEnc - 1.5, { bold: true, size: 8 });
        });
        y += hEnc;
        fila2.forEach((b, k) => {
          const x = X0 + k * wBloque;
          caja2(x, wBloque, imgH);
          if (b.img) {
            try {
              doc.addImage(b.img, "JPEG", x + 0.5, y + 0.5, wBloque - 1, imgH - 1, void 0, "FAST");
            } catch (e) {
            }
          }
        });
        y += imgH;
      });
    }
    if (m.modulos.descripcion) {
      if (y > 255) {
        doc.addPage();
        y = 14;
      }
      const lineasTexto = (m.descripcion || "").split("\n").filter((l) => l.trim());
      if (m.equipoGNSS) lineasTexto.push("Equipo GNSS: " + m.equipoGNSS);
      if (m.tipoMedicion) lineasTexto.push("Tipo de Medición: " + m.tipoMedicion);
      const hDescTxt = Math.max(lineasTexto.length * 4.3 + 2, 6);
      const hEnc = 5.5;
      caja2(X0, W, hEnc);
      txt("Descripción:", X0 + 2, y + hEnc - 1.5, { bold: true, size: 8.5 });
      y += hEnc;
      caja2(X0, W, hDescTxt);
      let ly = y + 4;
      doc.setFont(nombreFuente, "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...MONO_NEGRO);
      lineasTexto.forEach((l) => {
        doc.text(l, X0 + 2, ly);
        ly += 4.3;
      });
      y += hDescTxt;
    }
    if (m.modulos.fotos && (m.fotosExtra || []).length) {
      const dm = dimsMonografia(m);
      const fotos = m.fotosExtra.filter((f) => f.img);
      const wF = W / 2, hEnc = 5.5, hLey = 6;
      for (let i = 0; i < fotos.length; i += 2) {
        if (y + hEnc + dm.hE + hLey > 285) {
          doc.addPage();
          y = 14;
        }
        if (i === 0) {
          caja2(X0, W, hEnc);
          txt("Fotografías adicionales", X0 + 2, y + hEnc - 1.5, { bold: true, size: 8 });
          y += hEnc;
        }
        [fotos[i], fotos[i + 1]].forEach((f, k) => {
          if (!f) return;
          const x = X0 + k * wF;
          caja2(x, wF, dm.hE);
          const r = imgs.extras[f.id];
          if (r) {
            try {
              doc.addImage(r, "JPEG", x + 0.5, y + 0.5, wF - 1, dm.hE - 1, void 0, "FAST");
            } catch (e) {
            }
          }
        });
        y += dm.hE;
        [fotos[i], fotos[i + 1]].forEach((f, k) => {
          if (!f) return;
          const x = X0 + k * wF;
          caja2(x, wF, hLey);
          txt(String(f.leyenda || "").slice(0, 70), x + 2, y + hLey - 1.8, { size: 8 });
        });
        y += hLey;
      }
    }
    if (m.modulos.firma) {
      if (y > 260) {
        doc.addPage();
        y = 14;
      }
      const wMitad = W / 2;
      const hEnc = 6;
      caja2(X0, wMitad, hEnc);
      caja2(X0 + wMitad, wMitad, hEnc);
      txt("Datos operador", X0 + wMitad / 2, y + hEnc - 2, { bold: true, size: 9, align: "center" });
      txt("Revisó", X0 + wMitad + wMitad / 2, y + hEnc - 2, { bold: true, size: 9, align: "center" });
      y += hEnc;
      const filasIzq = ["Nombre: " + (m.operadorNombre || "—"), "Cargo: " + (m.operadorCargo || "—"), "Fecha Medición: " + (m.fechaMedicion ? fmtFechaCorta(m.fechaMedicion) : "—")];
      const filasDer = [m.revisoNombre || "—", m.fechaRevision ? fmtFechaCorta(m.fechaRevision) : ""].filter(Boolean);
      const hDatos = Math.max(filasIzq.length, 1) * 5 + 3;
      caja2(X0, wMitad, hDatos);
      caja2(X0 + wMitad, wMitad, hDatos);
      let ly = y + 5;
      filasIzq.forEach((l) => {
        txt(l, X0 + 2, ly, { size: 8.5 });
        ly += 5;
      });
      ly = y + 5;
      filasDer.forEach((l) => {
        txt(l, X0 + wMitad + wMitad / 2, ly, { size: 8.5, align: "center" });
        ly += 5;
      });
      y += hDatos;
    }
    return doc;
  }
  function fmtFechaCorta(isoDate) {
    if (!isoDate) return "—";
    const [a, m, d] = isoDate.split("-");
    return d + "-" + m + "-" + a;
  }
  function cargarMonografiaDefaults() {
    return {
      tituloDocumento: "Monografía de PRs y Monolitos",
      clienteNombre: "",
      clienteLogo: null,
      nombreProyecto: "",
      datumUTM: "WGS84",
      zonaUTM: "",
      datumGeodesico: "ITRF2008",
      geoide: "EGM08",
      equipoGNSS: "",
      tipoMedicion: "Estática",
      modulos: { utm: true, geodesicas: true, croquis: true, panoramica: true, descripcion: true, firma: true, fotos: false }
    };
  }

  // modulos/monografias/ajuste.js
  var BASE = { modo: "llenar", zoom: 1, ox: 0, oy: 0, giro: 0 };
  function colocarImagen(img, nat, PW, PH, aj) {
    const giro2 = ((aj.giro || 0) % 360 + 360) % 360, swap = giro2 === 90 || giro2 === 270;
    const r = calcRectImagen(swap ? nat.h : nat.w, swap ? nat.w : nat.h, PW, PH, aj);
    const dw = swap ? r.h : r.w, dh = swap ? r.w : r.h;
    Object.assign(img.style, { position: "absolute", maxWidth: "none", width: dw + "px", height: dh + "px", left: r.x + r.w / 2 - dw / 2 + "px", top: r.y + r.h / 2 - dh / 2 + "px", transform: `rotate(${giro2}deg)` });
    return r;
  }
  function abrirAjuste({ titulo, url, bw, bh, ajuste, porDefecto = "llenar" }) {
    return new Promise((resolver) => {
      const aj = { ...BASE, modo: porDefecto, ...ajuste || {} };
      const PW = Math.min(520, Math.max(260, window.innerWidth - 80)), PH = Math.max(60, Math.round(PW * bh / bw));
      const capa = document.createElement("div");
      capa.className = "mn-modal";
      capa.setAttribute("role", "dialog");
      capa.setAttribute("aria-modal", "true");
      capa.setAttribute("aria-label", "Ajustar encuadre");
      capa.innerHTML = `<div class="mn-modal-caja mn-aj">
      <div class="sis-cab"><h2>Ajustar encuadre · ${escapar(titulo || "")}</h2><button class="sis-btn chico" data-aj="cancelar">Cerrar</button></div>
      <p class="sis-tenue">Así se verá en el PDF (${Math.round(bw)} × ${Math.round(bh)} mm). Arrastra la imagen para moverla.</p>
      <div class="mn-aj-caja" style="width:${PW}px; height:${PH}px"><img alt="" draggable="false"></div>
      <div class="mn-aj-modos"><button type="button" class="sis-btn chico" data-aj-modo="llenar">Llenar (recorta)</button><button type="button" class="sis-btn chico" data-aj-modo="ajustar">Entera (con márgenes)</button></div>
      <label class="sis-campo"><span>Zoom: <b data-aj-txt>100%</b></span><input type="range" min="1" max="4" step="0.05" data-aj-r="zoom"></label>
      <div class="mn-aj-fila"><label class="sis-campo"><span>Mover ← →</span><input type="range" min="-1" max="1" step="0.01" data-aj-r="ox"></label><label class="sis-campo"><span>Mover ↑ ↓</span><input type="range" min="-1" max="1" step="0.01" data-aj-r="oy"></label></div>
      <div class="sis-acciones"><button type="button" class="sis-btn chico" data-aj="giro-i">↺ Girar</button><button type="button" class="sis-btn chico" data-aj="giro-d">↻ Girar</button><button type="button" class="sis-btn chico" data-aj="reset">Restablecer</button></div>
      <div class="sis-acciones mn-aj-pie"><button type="button" class="sis-btn" data-aj="cancelar">Cancelar</button><button type="button" class="sis-btn primario" data-aj="aplicar">Aplicar</button></div>
    </div>`;
      document.body.appendChild(capa);
      const $2 = (s) => capa.querySelector(s), img = $2("img"), caja2 = $2(".mn-aj-caja");
      let nat = null, rect = null;
      function pintar() {
        if (!nat) return;
        rect = colocarImagen(img, nat, PW, PH, aj);
        capa.querySelectorAll("[data-aj-modo]").forEach((b) => b.classList.toggle("primario", b.dataset.ajModo === aj.modo));
        $2('[data-aj-r="zoom"]').value = aj.zoom;
        $2('[data-aj-r="ox"]').value = aj.ox;
        $2('[data-aj-r="oy"]').value = aj.oy;
        $2("[data-aj-txt]").textContent = Math.round(aj.zoom * 100) + "%";
      }
      const cerrar = (valor) => {
        capa.remove();
        document.removeEventListener("keydown", tecla);
        resolver(valor);
      };
      const tecla = (ev) => {
        if (ev.key === "Escape") cerrar(null);
      };
      document.addEventListener("keydown", tecla);
      cargarImagenEl(url).then((im) => {
        nat = { w: im.naturalWidth, h: im.naturalHeight };
        img.src = url;
        pintar();
      }).catch(() => {
        caja2.innerHTML = '<p class="sis-tenue" style="padding:12px">No se pudo cargar la imagen.</p>';
      });
      capa.addEventListener("input", (ev) => {
        const k = ev.target.dataset.ajR;
        if (k) {
          aj[k] = parseFloat(ev.target.value);
          pintar();
        }
      });
      capa.addEventListener("click", (ev) => {
        const m = ev.target.closest("[data-aj-modo]");
        if (m) {
          aj.modo = m.dataset.ajModo;
          pintar();
          return;
        }
        const b = ev.target.closest("[data-aj]");
        if (!b) {
          if (ev.target === capa) cerrar(null);
          return;
        }
        const a = b.dataset.aj;
        if (a === "cancelar") cerrar(null);
        else if (a === "aplicar") cerrar({ ...aj });
        else if (a === "giro-i") {
          aj.giro = ((aj.giro || 0) + 270) % 360;
          pintar();
        } else if (a === "giro-d") {
          aj.giro = ((aj.giro || 0) + 90) % 360;
          pintar();
        } else if (a === "reset") {
          Object.assign(aj, BASE, { modo: porDefecto });
          pintar();
        }
      });
      let arrastre = null;
      caja2.addEventListener("pointerdown", (ev) => {
        arrastre = { x: ev.clientX, y: ev.clientY, ox: aj.ox, oy: aj.oy };
        caja2.setPointerCapture(ev.pointerId);
        caja2.classList.add("arrastrando");
      });
      caja2.addEventListener("pointermove", (ev) => {
        if (!arrastre || !rect) return;
        if (rect.sx > 0.5) aj.ox = Math.min(1, Math.max(-1, arrastre.ox + (ev.clientX - arrastre.x) / rect.sx));
        if (rect.sy > 0.5) aj.oy = Math.min(1, Math.max(-1, arrastre.oy + (ev.clientY - arrastre.y) / rect.sy));
        pintar();
      });
      const fin = () => {
        arrastre = null;
        caja2.classList.remove("arrastrando");
      };
      caja2.addEventListener("pointerup", fin);
      caja2.addEventListener("pointercancel", fin);
    });
  }

  // modulos/monografias/pdf.js
  var CLAVE_LOGO = "mono_logo_empresa";
  function logoEmpresa() {
    try {
      return localStorage.getItem(CLAVE_LOGO) || null;
    } catch {
      return null;
    }
  }
  function fijarLogoEmpresa(dataURL) {
    try {
      dataURL ? localStorage.setItem(CLAVE_LOGO, dataURL) : localStorage.removeItem(CLAVE_LOGO);
    } catch {
    }
  }
  async function urlImagen(v) {
    if (!v) return null;
    if (typeof v === "string") return v;
    if (v.archivo) return urlArchivo(v.archivo);
    return null;
  }
  async function materializar(m) {
    const c = { ...m, modulos: { ...m.modulos || {} } };
    for (const k of IMAGENES) c[k] = await urlImagen(m[k]);
    c.fotosExtra = [];
    for (const f of m.fotosExtra || []) c.fotosExtra.push({ ...f, img: await urlImagen(f.img) });
    const obs = String(m.observacionPdf || "").split("\n").map((l) => l.trim()).filter(Boolean);
    if (c.modulos.observacion && obs.length) {
      const desc = c.modulos.descripcion ? String(c.descripcion || "") : "";
      c.descripcion = [desc, `Observación: ${obs[0]}`, ...obs.slice(1)].filter(Boolean).join("\n");
      c.modulos.descripcion = true;
    }
    return c;
  }
  async function jsPDFListo() {
    if (!(window.jspdf && window.jspdf.jsPDF)) await cargarScript("vendor/jspdf.umd.min.js");
  }
  async function pdfDe(lista, { alAvanzar } = {}) {
    await jsPDFListo();
    configurarPieza({ logoEmpresa: logoEmpresa() });
    let doc = null, i = 0;
    for (const m0 of lista) {
      alAvanzar && alAvanzar(++i, lista.length);
      const m = await materializar(m0);
      doc = construirMonografiaPdf(m, await prepararImagenesMonografia(m), doc);
    }
    return doc ? doc.output("blob") : null;
  }

  // modulos/monografias/pantallas.js
  var CAMPOS = [
    ["General", [["tituloDocumento", "Título del documento"], ["clienteNombre", "Cliente"], ["nombreProyecto", "Nombre del proyecto"]]],
    ["Punto", [["puntoMedido", "Punto medido"], ["ubicacion", "Ubicación (sector / lugar)"], ["localidad", "Localidad"], ["comuna", "Comuna"], ["region", "Región"]]],
    ["utm", [["datumUTM", "Datum"], ["zonaUTM", "Zona"], ["norte", "Norte (m)"], ["este", "Este (m)"], ["cotaOrtometrica", "Cota ortométrica (m)"]]],
    ["geodesicas", [["datumGeodesico", "Datum geodésico"], ["geoide", "Geoide"], ["latitud", "Latitud"], ["longitud", "Longitud"], ["alturaElipsoidal", "Altura elipsoidal (m)"]]],
    ["firma", [["equipoGNSS", "Equipo GNSS"], ["tipoMedicion", "Tipo de medición"], ["operadorNombre", "Operador"], ["operadorCargo", "Cargo"], ["fechaMedicion", "Fecha de medición", "date"], ["revisoNombre", "Revisó"], ["fechaRevision", "Fecha de revisión", "date"]]]
  ];
  var MODULOS = [["utm", "Coordenadas UTM"], ["geodesicas", "Coordenadas geodésicas"], ["croquis", "Croquis de ubicación"], ["panoramica", "Vista panorámica"], ["descripcion", "Descripción"], ["observacion", "Observación"], ["fotos", "Fotografías adicionales"], ["firma", "Datos operador / Revisó"]];
  var GRUPO_UBICACION = ["ubicacion", "localidad", "comuna", "region"];
  var GRUPO_FIRMA = ["equipoGNSS", "tipoMedicion", "operadorNombre", "operadorCargo", "fechaMedicion", "revisoNombre", "fechaRevision"];
  var PROPIOS_FICHA = ["equipoGNSS", "fechaMedicion"];
  var claveCliente = (t) => String(t || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  var leerComun = (id) => {
    try {
      return JSON.parse(localStorage.getItem(`mono_comun_${id}`) || "{}");
    } catch {
      return {};
    }
  };
  var guardarComun = (id, v) => {
    try {
      localStorage.setItem(`mono_comun_${id}`, JSON.stringify(v));
    } catch {
    }
  };
  var TIPO_FOTO = { panoramica: "Panorámica", croquis: "Croquis", placa: "Placa", detalle: "Detalle", punto: "Punto", logo: "Logo", otra: "Foto" };
  var ranura = { croquisImg: "Croquis de ubicación", panoramicaImg: "Vista panorámica", clienteLogo: "Logo del cliente" };
  var MODO_DEF = { clienteLogo: "ajustar", croquisImg: "llenar", panoramicaImg: "llenar" };
  var ANCHO_MINI = { croquisImg: 300, panoramicaImg: 300, clienteLogo: 180, extra: 220 };
  function montarPantallas4(raiz, ctx2) {
    const st = { proyectoId: ctx2.proyectoId || null, monoId: ctx2.monografiaId || null, lista: [], ficha: null, fotos: [], elegir: null, mensaje: null, filtro: "", nombres: {}, guardando: null, vivo: true };
    raiz.innerHTML = '<div class="mn"></div>';
    const cont = raiz.querySelector(".mn");
    const avisar2 = (texto3, tipo = "ok") => {
      st.mensaje = { texto: texto3, tipo };
    };
    const ir = (proy, mono) => {
      location.hash = `#/monografias${proy ? "/" + proy : ""}${mono ? "/" + mono : ""}`;
    };
    async function vistaProyectos() {
      const proys = (await listarProyectos()).filter((p) => p.id !== OFICINA_ID && p.estado !== "cerrado");
      const filas = await Promise.all(proys.map(async (p) => ({ p, r: await resumenDeProyecto2(p.id) })));
      filas.sort((a, b) => b.r.total - a.r.total || a.p.nombre.localeCompare(b.p.nombre, "es"));
      return `<div class="mn-cab"><h1>Monografías</h1><p class="sis-tenue">Por proyecto: lo que llega desde la app de Terreno (monografías, jornadas y fotos), la revisión en gabinete y el PDF.</p></div>
      <section class="sis-tarjeta"><div class="sis-lista">${filas.map(({ p, r }) => `<a class="sis-fila" href="#/monografias/${escapar(p.id)}">
          <span class="sis-fila-txt"><b>${escapar(p.nombre)}</b><span class="sis-tenue">${escapar(p.mandante || "")}${r.jornadas.length ? ` · ${r.jornadas.length} jornada${r.jornadas.length > 1 ? "s" : ""} de terreno` : ""}</span></span>
          <span class="sis-chips">${r.total ? Object.entries(r.porEstado).map(([e, n]) => `<span class="sis-chip ${ESTADOS[e].color}">${n} ${escapar(ESTADOS[e].texto.toLowerCase())}</span>`).join("") : '<span class="sis-chip gris">sin monografías</span>'}</span></a>`).join("") || '<div class="sis-vacio"><p>No hay proyectos activos.</p></div>'}</div></section>`;
    }
    async function vistaProyecto() {
      const p = await obtenerProyecto(st.proyectoId);
      if (!p) return '<section class="sis-tarjeta sis-vacio"><p>No se encontró el proyecto.</p></section>';
      st.proyecto = p;
      st.lista = await monografiasDeProyecto(st.proyectoId);
      configurarPieza({ monografias: st.lista.map((x) => x.ficha) });
      const jornadas = await jornadasDeProyecto(st.proyectoId);
      const fotos = await fotosDeProyecto(st.proyectoId);
      const lista = st.lista.filter((x) => !st.filtro || x.estado === st.filtro).sort((a, b) => ordenNatural(a.ficha, b.ficha));
      const cuenta2 = (e) => st.lista.filter((x) => x.estado === e).length;
      const faltan = (f) => monoResumenDatos(f).filter((c) => !c.ok).length;
      return `<a class="sis-volver" href="#/monografias">← Monografías</a>
      <div class="mn-cab"><h1>${escapar(p.nombre)}</h1><p class="sis-tenue">${escapar(p.mandante || "")} · ${st.lista.length} monografía${st.lista.length === 1 ? "" : "s"} · ${jornadas.length} jornada${jornadas.length === 1 ? "" : "s"} y ${fotos.length} foto${fotos.length === 1 ? "" : "s"} desde Terreno</p></div>
      <section class="sis-tarjeta mn-config"><h2>Configurar</h2>
        <div class="mn-config-fila">
          <label class="sis-campo"><span>Cantidad de fichas a crear</span><span class="sis-en-linea"><input type="number" min="1" max="60" value="1" id="mn-n-fichas" aria-label="Cantidad de fichas"><button type="button" class="sis-btn" data-mn="crear-n">Crear fichas</button></span></label>
          <div class="mn-config-logo"><span class="mn-logo-mini">${logoEmpresa() ? `<img src="${logoEmpresa()}" alt="Logo de la empresa">` : '<span class="sis-tenue">Sin logo</span>'}</span>
            <span><b>Logo de la empresa</b><small class="sis-tenue">Va en el recuadro superior derecho del PDF.</small><span class="sis-acciones"><label class="sis-btn chico">${logoEmpresa() ? "Cambiar" : "Cargar logo"}<input type="file" accept="image/*" data-mn-archivo="logo" hidden></label>${logoEmpresa() ? '<button class="sis-btn chico" data-mn="quitar-logo">Quitar</button>' : ""}</span></span></div>
        </div>
        <p class="sis-tenue">Cada ficha se abre en su propia pestaña. En la ficha eliges si el PDF lleva Descripción, Observación o ambas, y si la ubicación y los datos del operador se aplican a todas las fichas.</p>
      </section>
      <div class="mn-barra">
        <div class="mn-filtros">${[["", `Todas · ${st.lista.length}`], ...Object.keys(ESTADOS).filter(cuenta2).map((e) => [e, `${ESTADOS[e].texto} · ${cuenta2(e)}`])].map(([e, t]) => `<button type="button" class="vu-pildora${st.filtro === e ? " activo" : ""}" data-mn="filtro" data-e="${e}">${escapar(t)}</button>`).join("")}</div>
        <div class="sis-acciones"><button class="sis-btn" data-mn="nueva">+ Monografía en gabinete</button><button class="sis-btn primario" data-mn="pdf-todas" ${lista.length ? "" : "disabled"}>PDF de ${st.filtro ? "estas" : "todas"} (${lista.length})</button></div>
      </div>
      <section class="sis-tarjeta">${lista.length ? `<table class="mn-tabla"><thead><tr><th>Punto</th><th>Estado</th><th>Faltan</th><th>Medición</th><th>Operador</th><th></th></tr></thead><tbody>
        ${lista.map((x) => {
        const f = x.ficha, n = faltan(f);
        return `<tr>
          <td><a href="#/monografias/${escapar(st.proyectoId)}/${escapar(x.id)}"><b>${escapar(f.puntoMedido || "(sin punto)")}</b></a>${x.nuevaDeTerreno ? '<small class="mn-nueva">Terreno envió cambios</small>' : ""}</td>
          <td><span class="sis-chip ${ESTADOS[x.estado].color}">${escapar(ESTADOS[x.estado].texto)}</span>${x.observacion ? `<small class="mn-obs">${escapar(x.observacion)}</small>` : ""}</td>
          <td>${n ? `<span class="sis-chip ambar">${n}</span>` : '<span class="sis-chip verde">completa</span>'}</td>
          <td>${f.fechaMedicion ? escapar(fechaLegible(f.fechaMedicion)) : "—"}</td><td>${escapar(f.operadorNombre || "—")}</td>
          <td class="mn-acc"><a class="sis-btn chico" href="#/monografias/${escapar(st.proyectoId)}/${escapar(x.id)}">Abrir</a><button class="sis-btn chico" data-mn="pdf" data-id="${escapar(x.id)}">PDF</button></td></tr>`;
      }).join("")}
        </tbody></table>` : `<div class="sis-vacio"><p>${st.lista.length ? "Ninguna con ese estado." : "Aún no llegan monografías de este proyecto. En la app de Terreno: elige el proyecto del Sistema en la monografía y toca «Enviar al Sistema». También puedes crear una aquí."}</p></div>`}</section>
      ${jornadas.length ? `<section class="sis-tarjeta"><h2>Jornadas de terreno</h2><div class="sis-lista">${jornadas.slice(0, 12).map((j) => `<div class="sis-fila"><span class="sis-fila-txt"><b>${escapar(j.fechaInicio ? fechaHoraLegible(j.fechaInicio) : "Jornada")}</b><span class="sis-tenue">${escapar(j.operador || "")}${j.horas != null ? ` · ${Number(j.horas).toLocaleString("es-CL", { maximumFractionDigits: 1 })} h` : ""}</span></span>
          <span class="sis-chips"><span class="sis-chip gris">${(j.levantamientos || []).length} levantamiento${(j.levantamientos || []).length === 1 ? "" : "s"}</span><span class="sis-chip gris">${(j.levantamientos || []).reduce((s, l) => s + (l.puntos || []).length, 0)} puntos</span></span></div>`).join("")}</div></section>` : ""}
`;
    }
    function campo2(k, t, tipo = "text", lista = null) {
      var _a;
      const f = st.ficha;
      return `<label class="sis-campo"><span>${escapar(t)}</span><input type="${tipo}" data-f="${k}" value="${escapar((_a = f[k]) != null ? _a : "")}"${/norte|este|cota|altura/i.test(k) ? ' inputmode="decimal"' : ""}${lista ? ` list="mn-l-${k}"` : ""}>${lista ? `<datalist id="mn-l-${k}">${lista.map((v) => `<option value="${escapar(v)}">`).join("")}</datalist>` : ""}</label>`;
    }
    async function clientes() {
      const nombres = /* @__PURE__ */ new Map();
      for (const p of await listarProyectos()) if (p.mandante && p.mandante.trim()) nombres.set(claveCliente(p.mandante), p.mandante.trim());
      if (st.ficha && st.ficha.clienteNombre) nombres.set(claveCliente(st.ficha.clienteNombre), st.ficha.clienteNombre);
      try {
        for (const n of JSON.parse(localStorage.getItem("mono_clientes") || "[]")) nombres.set(claveCliente(n), n);
      } catch {
      }
      return Promise.all([...nombres.entries()].sort((a, b) => a[1].localeCompare(b[1], "es")).map(async ([k, nombre]) => ({ k, nombre, logo: ((await archivosDe("cliente_logo", k))[0] || {}).id || null })));
    }
    function chequeoHtml() {
      const filas = monoResumenDatos(st.ficha);
      return `<div class="mn-chequeo">${filas.map((f) => `<div class="mn-ch"><span class="mn-ch-ic ${f.ok ? f.dup ? "dup" : f.calc ? "calc" : "ok" : "falta"}" aria-hidden="true">${f.ok ? f.dup ? "!" : f.calc ? "?" : "✔" : "–"}</span><span>${escapar(f.k)}${f.det ? `<small>${escapar(f.det)}</small>` : ""}${f.dup ? `<small class="mn-av">${escapar(f.dup)}</small>` : ""}${f.calc ? `<small class="mn-av">${escapar(f.calc)}</small>` : ""}</span></div>`).join("")}</div>
      <p class="sis-tenue mn-ley">✔ ingresado · – falta · ! repetido en el proyecto · ? calculado por la app de Terreno</p>`;
    }
    function miniHtml(url, dim, ancho, datos, titulo) {
      return `<div class="mn-mini" style="width:${ancho}px; aspect-ratio:${dim[0].toFixed(1)} / ${dim[1].toFixed(1)}" ${datos}>${url ? `<img src="${escapar(url)}" alt="${escapar(titulo)}" draggable="false">` : '<span class="sis-tenue">Sin imagen</span>'}</div>`;
    }
    async function imagenHtml(clave2, titulo) {
      const url = await urlImagen(st.ficha[clave2]), dim = dimsMonografia(st.ficha)[clave2];
      return `<div class="mn-slot"><div class="mn-slot-tit">${escapar(titulo)}</div>
      ${miniHtml(url, dim, ANCHO_MINI[clave2], `data-mini="${clave2}"`, titulo)}
      <div class="sis-acciones"><button class="sis-btn chico" data-mn="elegir" data-slot="${clave2}">Elegir de terreno</button><label class="sis-btn chico">Subir<input type="file" accept="image/*" data-mn-archivo="${clave2}" hidden></label>${url ? `<button class="sis-btn chico" data-mn="ajustar" data-slot="${clave2}">✂ Ajustar encuadre</button><button class="sis-btn chico" data-mn="quitar-img" data-slot="${clave2}">Quitar</button>` : ""}</div></div>`;
    }
    function presentacionHtml(mod) {
      const f = st.ficha, ambas = mod.croquis && mod.panoramica;
      if (!mod.croquis && !mod.panoramica && !mod.fotos) return "";
      const alto = Number(f.altoImagenes) || 56, altoE = Number(f.altoFotosExtra) || 60;
      return `<section class="sis-tarjeta"><h2>Presentación de las imágenes</h2>
      ${ambas ? `<label class="sis-campo"><span>Disposición croquis / panorámica</span><select data-pres="disposicionImg"><option value="lado" ${(f.disposicionImg || "lado") === "lado" ? "selected" : ""}>Lado a lado</option><option value="apiladas" ${f.disposicionImg === "apiladas" ? "selected" : ""}>Una bajo la otra (ancho completo)</option></select></label>` : ""}
      ${mod.croquis || mod.panoramica ? `<label class="sis-campo"><span>Alto de cada imagen: <b data-pres-txt="altoImagenes">${alto}</b> mm</span><input type="range" min="35" max="120" step="1" data-pres="altoImagenes" value="${alto}"></label>` : ""}
      ${mod.fotos ? `<label class="sis-campo"><span>Alto de las fotografías adicionales: <b data-pres-txt="altoFotosExtra">${altoE}</b> mm</span><input type="range" min="35" max="120" step="1" data-pres="altoFotosExtra" value="${altoE}"></label>` : ""}
      <p class="sis-tenue">Cada imagen se encuadra con «✂ Ajustar encuadre»: llenar o entera, zoom, mover y girar, como en la app de Terreno.</p></section>`;
    }
    function colocarMinis() {
      for (const caja2 of cont.querySelectorAll(".mn-mini")) {
        const img = caja2.querySelector("img");
        if (!img || !st.ficha) continue;
        const clave2 = caja2.dataset.mini, i = caja2.dataset.miniExtra;
        const aj = i != null ? { modo: "llenar", zoom: 1, ox: 0, oy: 0, giro: 0, ...(st.ficha.fotosExtra[Number(i)] || {}).aj || {} } : ajusteDe(st.ficha, clave2, MODO_DEF[clave2]);
        cargarImagenEl(img.src).then((im) => colocarImagen(img, { w: im.naturalWidth, h: im.naturalHeight }, caja2.clientWidth, caja2.clientHeight, aj)).catch(() => {
        });
      }
    }
    async function vistaFicha() {
      var _a;
      if (!st.proyecto || st.proyecto.id !== st.proyectoId) st.proyecto = await obtenerProyecto(st.proyectoId);
      const x = (await monografiasDeProyecto(st.proyectoId)).find((y) => y.id === st.monoId);
      if (!x) return `<a class="sis-volver" href="#/monografias/${escapar(st.proyectoId)}">← Volver</a><section class="sis-tarjeta sis-vacio"><p>No se encontró la monografía.</p></section>`;
      st.x = x;
      if (!st.ficha || st.ficha.id !== x.id) st.ficha = JSON.parse(JSON.stringify(x.ficha));
      st.lista = await monografiasDeProyecto(st.proyectoId);
      configurarPieza({ monografias: st.lista.map((y) => y.id === x.id ? st.ficha : y.ficha) });
      st.fotos = await fotosDeProyecto(st.proyectoId);
      const f = st.ficha, mod = f.modulos || (f.modulos = { utm: true, geodesicas: true, croquis: true, panoramica: true, descripcion: true, firma: true, fotos: false });
      const hist = await historialDe(x.id);
      const dimE = dimsMonografia(f).extra;
      const comun = leerComun(st.proyectoId);
      const cls = await clientes();
      const pais = f.paisUTM || "Chile";
      const extras = await Promise.all((f.fotosExtra || []).map(async (e, i) => {
        const u = await urlImagen(e.img);
        return `<div class="mn-extra">${miniHtml(u, dimE, ANCHO_MINI.extra, `data-mini-extra="${i}"`, `Foto ${i + 1}`)}<div class="mn-extra-datos"><input data-extra="${i}" value="${escapar(e.leyenda || "")}" placeholder="Leyenda" aria-label="Leyenda de la foto ${i + 1}"><div class="sis-acciones">${u ? `<button class="sis-btn chico" data-mn="ajustar" data-i="${i}">✂ Ajustar encuadre</button>` : ""}<button class="sis-btn chico" data-mn="quitar-extra" data-i="${i}">Quitar</button></div></div></div>`;
      }));
      const fichas = st.lista.slice().sort((a, b) => ordenNatural(a.ficha, b.ficha));
      const tarjeta = (titulo, cuerpo, extra = "") => `<section class="sis-tarjeta"><div class="sis-cab"><h2>${titulo}</h2>${extra}</div>${cuerpo}</section>`;
      const checkComun = (k, t) => `<label class="sis-check mn-comun"><input type="checkbox" data-comun="${k}" ${comun[k] ? "checked" : ""}> ${t}</label>`;
      return `<a class="sis-volver" href="#/monografias/${escapar(st.proyectoId)}">← ${escapar(st.proyecto ? st.proyecto.nombre : "Proyecto")}</a>
      <nav class="mn-fichas" aria-label="Fichas del proyecto">${fichas.map((y, i) => `<a href="#/monografias/${escapar(st.proyectoId)}/${escapar(y.id)}" class="${y.id === x.id ? "activa" : ""}"${y.id === x.id ? ' aria-current="page"' : ""}>Ficha ${i + 1}<small>${escapar(y.ficha.puntoMedido || "sin punto")}</small></a>`).join("")}<button type="button" class="mn-ficha-mas" data-mn="nueva" aria-label="Agregar ficha">+</button></nav>
      <div class="mn-cab mn-cab-ficha"><div><h1>Monografía · ${escapar(f.puntoMedido || "(sin punto)")}</h1>
        <p class="sis-tenue">${x.terreno ? `Enviada desde Terreno${x.terreno.publicadoEn ? " el " + escapar(fechaHoraLegible(x.terreno.publicadoEn)) : ""}` : "Creada en gabinete"}${x.gabinete ? " · revisada en gabinete" : ""} · <span id="mn-guardado">Guardado</span></p></div>
        <div class="sis-acciones"><button class="sis-btn" data-mn="ver-pdf">Vista previa PDF</button><button class="sis-btn primario" data-mn="pdf" data-id="${escapar(x.id)}">Descargar PDF</button></div></div>
      ${x.nuevaDeTerreno ? `<div class="sis-tarjeta sis-aviso mn-aviso"><b>Terreno envió una versión más nueva de esta monografía.</b> <span>La que ves es la revisada en gabinete.</span> <button class="sis-btn chico" data-mn="usar-terreno">Usar la de Terreno</button></div>` : ""}
      <section class="sis-tarjeta mn-config-ficha"><div class="mn-config-fila">
        <div><b>El PDF lleva</b><div class="mn-mods-txt"><label class="sis-check"><input type="checkbox" data-mod="descripcion" ${mod.descripcion ? "checked" : ""}> Descripción</label><label class="sis-check"><input type="checkbox" data-mod="observacion" ${mod.observacion ? "checked" : ""}> Observación</label></div></div>
        <div class="mn-config-logo"><span class="mn-logo-mini">${logoEmpresa() ? `<img src="${logoEmpresa()}" alt="Logo de la empresa">` : '<span class="sis-tenue">Sin logo</span>'}</span><span><b>Logo de la empresa</b><small class="sis-tenue">Recuadro superior derecho</small><label class="sis-btn chico">${logoEmpresa() ? "Cambiar" : "Cargar logo"}<input type="file" accept="image/*" data-mn-archivo="logo" hidden></label></span></div>
      </div></section>
      <div class="mn-dos"><div>
        ${tarjeta("General", `<div class="mn-campos">
            <label class="sis-campo"><span>Cliente</span><select data-cliente>${cls.map((c) => `<option value="${escapar(c.k)}" ${claveCliente(f.clienteNombre) === c.k ? "selected" : ""}>${escapar(c.nombre)}${c.logo ? " · con logo" : ""}</option>`).join("")}${!f.clienteNombre ? '<option value="" selected>— Elegir —</option>' : ""}<option value="__nuevo">+ Nuevo cliente…</option></select></label>
            ${campo2("tituloDocumento", "Título del documento")}${campo2("nombreProyecto", "Nombre del proyecto")}</div>
          ${await imagenHtml("clienteLogo", "Logo del cliente")}
          <p class="sis-tenue">El logo que subas queda guardado para ese cliente y se pone solo en sus próximas fichas.</p>`, '<button class="sis-btn chico" data-mn="traer-proyecto">Traer del proyecto</button>')}
        ${tarjeta("Punto", `<div class="mn-campos">${campo2("puntoMedido", "Nombre del punto (esta ficha)")}${CAMPOS[1][1].slice(1).map((c) => campo2(...c)).join("")}</div>${checkComun("ubicacion", "Ubicación, localidad, comuna y región iguales en todas las fichas")}`)}
        ${mod.utm ? tarjeta("Coordenadas UTM (finales del postproceso)", `<div class="mn-campos">
            <label class="sis-campo"><span>País de trabajo</span><select data-pais>${Object.keys(ZONAS_POR_PAIS).map((k) => `<option ${k === pais ? "selected" : ""}>${k}</option>`).join("")}</select></label>
            ${campo2("datumUTM", "Datum", "text", DATUMS_CHILE)}${campo2("zonaUTM", "Zona", "text", ZONAS_POR_PAIS[pais] || [])}${campo2("norte", "Norte (m)")}${campo2("este", "Este (m)")}${campo2("cotaOrtometrica", "Cota ortométrica (m)")}</div>`) : ""}
        ${mod.geodesicas ? tarjeta("Coordenadas geodésicas", `<div class="mn-campos">${campo2("datumGeodesico", "Datum geodésico", "text", DATUMS_CHILE)}${campo2("geoide", "Geoide", "text", GEOIDES)}${campo2("latitud", "Latitud")}${campo2("longitud", "Longitud")}${campo2("alturaElipsoidal", "Altura elipsoidal (m)")}</div>
            <div class="mn-formato"><span>Mostrar como</span><span class="sis-vistas"><button type="button" class="${(f.formatoGeo || "dms") === "dd" ? "activo" : ""}" data-mn="formato" data-v="dd">DD.dddd°</button><button type="button" class="${(f.formatoGeo || "dms") === "dms" ? "activo" : ""}" data-mn="formato" data-v="dms">D°M'S"</button></span>
              <label>Decimales <input type="number" min="0" max="8" data-decimales value="${escapar((_a = f.decimalesGeo) != null ? _a : 4)}" aria-label="Decimales"></label><button type="button" class="sis-btn chico" data-mn="formato" data-v="${f.formatoGeo || "dms"}">Aplicar formato</button></div>`) : ""}
        ${mod.croquis || mod.panoramica ? tarjeta("Imágenes", `<div class="mn-imgs-dos">${mod.croquis ? `<div>${await imagenHtml("croquisImg", ranura.croquisImg)}<button class="sis-btn chico primario mn-gen-croquis" data-mn="croquis-mapa">🗺 Generar desde el mapa</button></div>` : ""}${mod.panoramica ? `<div>${await imagenHtml("panoramicaImg", ranura.panoramicaImg)}</div>` : ""}</div>`) : ""}
        ${mod.firma ? tarjeta("Equipo, operador y revisión", `<div class="mn-campos">${CAMPOS[4][1].map((c) => campo2(...c)).join("")}</div>${checkComun("firma", "Aplicar a todas las fichas del proyecto")}
            ${comun.firma ? `<label class="sis-check mn-comun"><input type="checkbox" data-propios ${f.firmaPropia ? "checked" : ""}> Esta ficha tiene su propia fecha de medición y equipo</label>` : ""}`) : ""}
        ${mod.descripcion ? tarjeta("Descripción", `<textarea data-f="descripcion" rows="4">${escapar(f.descripcion || "")}</textarea><p class="sis-tenue">Una línea por renglón, como en la plantilla.</p>`) : ""}
        ${mod.observacion ? tarjeta("Observación", `<textarea data-f="observacionPdf" rows="3" placeholder="Ej.: monolito con daño en la placa">${escapar(f.observacionPdf || "")}</textarea><p class="sis-tenue">Va en el PDF después de la descripción, como «Observación: …».</p>`) : ""}
      </div><aside>
        <section class="sis-tarjeta"><h2>Chequeo</h2>${chequeoHtml()}</section>
        <section class="sis-tarjeta"><h2>Estado de revisión</h2>
          <p><span class="sis-chip ${ESTADOS[x.estado].color}">${escapar(ESTADOS[x.estado].texto)}</span>${x.observacion ? ` <span class="mn-obs">${escapar(x.observacion)}</span>` : ""}</p>
          <label class="sis-campo"><span>Observación para terreno (si hay que corregir algo)</span><textarea id="mn-obs" rows="2" placeholder="Ej.: retomar la foto de la placa">${x.estado === "con-observacion" ? escapar(x.observacion) : ""}</textarea></label>
          <div class="sis-acciones"><button class="sis-btn chico" data-mn="estado" data-e="en-revision">En revisión</button><button class="sis-btn chico" data-mn="estado" data-e="con-observacion">Con observación</button><button class="sis-btn chico primario" data-mn="estado" data-e="lista">Lista</button></div>
          ${hist.length ? `<details class="mn-hist"><summary>Historial (${hist.length})</summary><ul>${hist.slice().reverse().map((r) => `<li>${escapar(fechaHoraLegible(r.creadoEn))} · ${escapar(ESTADOS[r.estado].texto)}${r.por ? " · " + escapar(st.nombres[r.por] || "") : ""}${r.observacion ? " — " + escapar(r.observacion) : ""}</li>`).join("")}</ul></details>` : ""}
        </section>
        <section class="sis-tarjeta"><h2>Qué incluye el PDF</h2><div class="mn-mods">${MODULOS.map(([k, t]) => `<label class="sis-check"><input type="checkbox" data-mod="${k}" ${mod[k] ? "checked" : ""}> ${escapar(t)}</label>`).join("")}</div></section>
        ${presentacionHtml(mod)}
        ${mod.fotos ? `<section class="sis-tarjeta"><h2>Fotografías adicionales</h2>${extras.join("")}<div class="sis-acciones"><button class="sis-btn chico" data-mn="elegir" data-slot="extra">+ Elegir de terreno</button><label class="sis-btn chico">+ Subir<input type="file" accept="image/*" data-mn-archivo="extra" hidden></label></div></section>` : ""}
      </aside></div>
      ${st.elegir ? await selectorFotos() : ""}`;
    }
    async function selectorFotos() {
      const fotos = await Promise.all(st.fotos.map(async (a) => ({ a, url: await urlArchivo(a.id) })));
      return `<div class="mn-modal" role="dialog" aria-modal="true" aria-label="Elegir foto de terreno"><div class="mn-modal-caja">
      <div class="sis-cab"><h2>Fotos de terreno del proyecto · ${escapar(st.elegir === "extra" ? "Fotografía adicional" : ranura[st.elegir])}</h2><button class="sis-btn chico" data-mn="cerrar-elegir">Cerrar</button></div>
      ${fotos.length ? `<div class="mn-grilla">${fotos.map(({ a, url }) => {
        const d = a.detalle || {};
        return `<button type="button" class="mn-foto" data-mn="usar-foto" data-id="${escapar(a.id)}">${url ? `<img src="${escapar(url)}" alt="">` : '<span class="sis-tenue">En la nube</span>'}<span><b>${escapar(TIPO_FOTO[d.tipo] || "Foto")}${d.punto ? " · " + escapar(d.punto) : ""}</b><small>${escapar(d.hora ? fechaHoraLegible(d.hora) : "")}${d.autor ? " · " + escapar(d.autor) : ""}</small>${d.leyenda ? `<small>${escapar(d.leyenda)}</small>` : ""}</span></button>`;
      }).join("")}</div>` : '<div class="sis-vacio"><p>Aún no llegan fotos de este proyecto desde Terreno.</p></div>'}
    </div></div>`;
    }
    async function render() {
      if (!st.vivo) return;
      try {
        if (!Object.keys(st.nombres).length) for (const p of await listarPersonas()) st.nombres[p.id] = p.nombre;
        const html = st.monoId ? await vistaFicha() : st.proyectoId ? await vistaProyecto() : await vistaProyectos();
        cont.innerHTML = `${st.mensaje ? `<div class="vu-msg ${st.mensaje.tipo === "error" ? "error" : ""}" role="status">${escapar(st.mensaje.texto)}</div>` : ""}${html}`;
        st.mensaje = null;
        if (st.monoId) colocarMinis();
      } catch (e) {
        console.error(e);
        cont.innerHTML = `<section class="sis-tarjeta sis-error"><p>${escapar(e.message || "Error")}</p></section>`;
      }
    }
    function marcarGuardado(t) {
      const el = cont.querySelector("#mn-guardado");
      if (el) el.textContent = t;
    }
    async function guardarAhora() {
      clearTimeout(st.guardando);
      st.guardando = null;
      const x = st.x;
      await guardarGabinete({ ...st.ficha, proyectoId: st.proyectoId, basadoEn: x.gabinete ? x.gabinete.basadoEn : x.terreno ? x.terreno.actualizadoEn : null });
      if (x.estado === "enviada") {
        await agregarRevision({ monografiaId: x.id, proyectoId: st.proyectoId, estado: "en-revision" });
        x.estado = "en-revision";
      }
      x.gabinete = x.gabinete || { basadoEn: x.terreno ? x.terreno.actualizadoEn : null };
      marcarGuardado("Guardado");
    }
    async function propagar(campos) {
      var _a, _b;
      const comun = leerComun(st.proyectoId), f = st.ficha;
      const grupos = [...comun.ubicacion ? GRUPO_UBICACION : [], ...comun.firma ? GRUPO_FIRMA : []].filter((k) => campos.includes(k));
      if (!grupos.length) return 0;
      let n = 0;
      for (const y of await monografiasDeProyecto(st.proyectoId)) {
        if (y.id === f.id) continue;
        const otra = JSON.parse(JSON.stringify(y.ficha));
        let cambia = false;
        for (const k of grupos) {
          if (otra.firmaPropia && PROPIOS_FICHA.includes(k)) continue;
          if (f.firmaPropia && PROPIOS_FICHA.includes(k)) continue;
          if (((_a = otra[k]) != null ? _a : "") !== ((_b = f[k]) != null ? _b : "")) {
            otra[k] = f[k];
            cambia = true;
          }
        }
        if (cambia) {
          await guardarGabinete({ ...otra, proyectoId: st.proyectoId, basadoEn: y.gabinete ? y.gabinete.basadoEn : y.terreno ? y.terreno.actualizadoEn : null });
          n++;
        }
      }
      return n;
    }
    let camposCambiados = /* @__PURE__ */ new Set();
    function cambio({ refrescar = false, campo: campo3 = null } = {}) {
      marcarGuardado("Guardando…");
      if (campo3) camposCambiados.add(campo3);
      clearTimeout(st.guardando);
      st.guardando = setTimeout(async () => {
        await guardarAhora();
        const lista = [...camposCambiados];
        camposCambiados = /* @__PURE__ */ new Set();
        const n = await propagar(lista);
        if (n) marcarGuardado(`Guardado · aplicado a ${n} ficha${n === 1 ? "" : "s"} más`);
        if (refrescar) await render();
        else refrescarChequeo();
      }, 500);
    }
    function refrescarChequeo() {
      const s = cont.querySelector(".mn-chequeo");
      if (s) s.parentElement.innerHTML = "<h2>Chequeo</h2>" + chequeoHtml();
    }
    async function descargarPdf(lista, nombre) {
      avisar2("Generando PDF…");
      await render();
      const blob = await pdfDe(lista);
      if (blob) {
        descargar(nombre, blob, "application/pdf");
        avisar2(`PDF listo: ${lista.length} monografía${lista.length === 1 ? "" : "s"}.`);
      }
    }
    const nombreArchivo = (s) => String(s || "punto").replace(/[^a-z0-9_-]+/gi, "_");
    cont.addEventListener("input", (ev) => {
      const t = ev.target;
      if (!st.ficha) return;
      if (t.dataset.f) {
        st.ficha[t.dataset.f] = t.value;
        cambio({ campo: t.dataset.f });
      } else if (t.dataset.pres && t.type === "range") {
        const x = cont.querySelector(`[data-pres-txt="${t.dataset.pres}"]`);
        if (x) x.textContent = t.value;
      } else if (t.dataset.extra != null) {
        st.ficha.fotosExtra[Number(t.dataset.extra)].leyenda = t.value;
        cambio();
      }
    });
    cont.addEventListener("change", async (ev) => {
      const t = ev.target;
      try {
        if (t.dataset.mod && st.ficha) {
          st.ficha.modulos[t.dataset.mod] = t.checked;
          cambio({ refrescar: true });
          return;
        }
        if (t.dataset.comun && st.ficha) {
          const c = leerComun(st.proyectoId);
          c[t.dataset.comun] = t.checked;
          guardarComun(st.proyectoId, c);
          if (t.checked) {
            const n = await propagar(t.dataset.comun === "ubicacion" ? GRUPO_UBICACION : GRUPO_FIRMA);
            avisar2(n ? `Aplicado a ${n} ficha${n === 1 ? "" : "s"} más del proyecto.` : "Las demás fichas ya tienen esos datos.");
          }
          await render();
          return;
        }
        if (t.hasAttribute("data-propios") && st.ficha) {
          st.ficha.firmaPropia = t.checked;
          cambio();
          return;
        }
        if (t.hasAttribute("data-pais") && st.ficha) {
          st.ficha.paisUTM = t.value;
          cambio({ refrescar: true });
          return;
        }
        if (t.hasAttribute("data-decimales") && st.ficha) {
          st.ficha.decimalesGeo = Math.max(0, Math.min(8, Number(t.value) || 0));
          cambio();
          return;
        }
        if (t.hasAttribute("data-cliente") && st.ficha) {
          let k = t.value, nombre;
          if (k === "__nuevo") {
            nombre = (prompt("Nombre del cliente:") || "").trim();
            if (!nombre) {
              await render();
              return;
            }
            try {
              const l = JSON.parse(localStorage.getItem("mono_clientes") || "[]");
              if (!l.includes(nombre)) l.push(nombre);
              localStorage.setItem("mono_clientes", JSON.stringify(l));
            } catch {
            }
            k = claveCliente(nombre);
          } else nombre = ((await clientes()).find((c) => c.k === k) || {}).nombre || "";
          st.ficha.clienteNombre = nombre;
          const logo = (await archivosDe("cliente_logo", k))[0];
          if (logo) {
            st.ficha.clienteLogo = { archivo: logo.id };
            if (st.ficha.ajustes) delete st.ficha.ajustes.clienteLogo;
          }
          await guardarAhora();
          await render();
          return;
        }
        if (t.dataset.pres && st.ficha) {
          st.ficha[t.dataset.pres] = t.type === "range" ? Number(t.value) : t.value;
          cambio({ refrescar: true });
          return;
        }
        if (t.dataset.mnArchivo && t.files && t.files[0]) {
          const archivo = t.files[0], slot = t.dataset.mnArchivo;
          t.value = "";
          if (slot === "logo") {
            const r = new FileReader();
            r.onload = async () => {
              fijarLogoEmpresa(r.result);
              avisar2("Logo guardado");
              await render();
            };
            r.readAsDataURL(archivo);
            return;
          }
          const deCliente = slot === "clienteLogo" && st.ficha.clienteNombre;
          const reg = await guardarArchivo(archivo, { modulo: "terreno", duenoTipo: deCliente ? "cliente_logo" : "terreno_monografia", duenoId: deCliente ? claveCliente(st.ficha.clienteNombre) : st.ficha.id, rol: "foto", proyectoId: st.proyectoId, carpeta: `Proyectos/${st.proyecto ? st.proyecto.nombre : st.proyectoId}/Monografías`, detalle: { tipo: slot === "croquisImg" ? "croquis" : slot === "panoramicaImg" ? "panoramica" : slot === "clienteLogo" ? "logo" : "detalle", punto: st.ficha.puntoMedido || "", origen: "gabinete" } });
          ponerImagen(slot, { archivo: reg.id });
          await guardarAhora();
          await render();
        }
      } catch (e) {
        console.error(e);
        avisar2(e.message || "No se pudo", "error");
        await render();
      }
    });
    function ponerImagen(slot, valor) {
      if (slot === "extra") {
        st.ficha.fotosExtra = st.ficha.fotosExtra || [];
        st.ficha.fotosExtra.push({ id: uuid(), img: valor, leyenda: "", aj: { modo: "llenar", zoom: 1, ox: 0, oy: 0, giro: 0 } });
      } else {
        st.ficha[slot] = valor;
        if (st.ficha.ajustes) delete st.ficha.ajustes[slot];
      }
    }
    cont.addEventListener("click", async (ev) => {
      var _a;
      const b = ev.target.closest("[data-mn]");
      if (!b) return;
      const a = b.dataset.mn;
      try {
        if (a === "filtro") {
          st.filtro = b.dataset.e;
        } else if (a === "nueva") {
          const d = cargarMonografiaDefaults(), p = st.proyecto || await obtenerProyecto(st.proyectoId);
          const m = { ...d, id: uuid(), proyectoId: st.proyectoId, nombreProyecto: d.nombreProyecto || (p ? p.nombre : ""), clienteNombre: d.clienteNombre || (p ? p.mandante || "" : ""), puntoMedido: "", ubicacion: "", localidad: "", comuna: p ? p.comuna || "" : "", region: p ? p.region || "" : "", norte: "", este: "", cotaOrtometrica: "", latitud: "", longitud: "", alturaElipsoidal: "", croquisImg: null, panoramicaImg: null, descripcion: "", operadorNombre: "", operadorCargo: "Geomensor", fechaMedicion: "", revisoNombre: "", fechaRevision: "", fotosExtra: [], creado: (/* @__PURE__ */ new Date()).toISOString() };
          await guardarGabinete(m);
          st.ficha = null;
          ir(st.proyectoId, m.id);
          return;
        } else if (a === "crear-n") {
          const n = Math.max(1, Math.min(60, Number((cont.querySelector("#mn-n-fichas") || {}).value) || 1));
          const p = st.proyecto || await obtenerProyecto(st.proyectoId), d = cargarMonografiaDefaults();
          const ya = (await monografiasDeProyecto(st.proyectoId)).length;
          let primera = null;
          for (let i = 0; i < n; i++) {
            const m = { ...d, id: uuid(), proyectoId: st.proyectoId, nombreProyecto: d.nombreProyecto || (p ? p.nombre : ""), clienteNombre: d.clienteNombre || (p ? p.mandante || "" : ""), puntoMedido: `PR-${ya + i + 1}`, ubicacion: "", localidad: "", comuna: p ? p.comuna || "" : "", region: p ? p.region || "" : "", norte: "", este: "", cotaOrtometrica: "", latitud: "", longitud: "", alturaElipsoidal: "", croquisImg: null, panoramicaImg: null, descripcion: "", operadorNombre: "", operadorCargo: "Geomensor", fechaMedicion: "", revisoNombre: "", fechaRevision: "", fotosExtra: [], creado: (/* @__PURE__ */ new Date()).toISOString() };
            await guardarGabinete(m);
            primera = primera || m.id;
          }
          st.ficha = null;
          ir(st.proyectoId, primera);
          return;
        } else if (a === "traer-proyecto") {
          const p = st.proyecto || await obtenerProyecto(st.proyectoId);
          if (p) {
            Object.assign(st.ficha, { nombreProyecto: p.nombre, clienteNombre: st.ficha.clienteNombre || p.mandante || "", comuna: p.comuna || st.ficha.comuna, region: p.region || st.ficha.region });
            await guardarAhora();
            avisar2("Datos tomados del proyecto.");
          }
        } else if (a === "formato") {
          const f = st.ficha, dec = (_a = f.decimalesGeo) != null ? _a : 4;
          f.formatoGeo = b.dataset.v;
          const la = leerGrados(f.latitud), lo = leerGrados(f.longitud);
          if (la != null) f.latitud = escribirGrados(la, "lat", f.formatoGeo, dec);
          if (lo != null) f.longitud = escribirGrados(lo, "lon", f.formatoGeo, dec);
          await guardarAhora();
          avisar2(la != null || lo != null ? "Coordenadas geodésicas con el formato elegido." : "Escribe la latitud y la longitud para darles formato.");
        } else if (a === "croquis-mapa") {
          const f = st.ficha, d = dimsMonografia(f).croquisImg;
          const url = await abrirCroquis({ lat: leerGrados(f.latitud), lon: leerGrados(f.longitud), nombre: f.puntoMedido || "", aspecto: d[0] / d[1] });
          if (!url) return;
          const reg = await guardarArchivoDatos(url, `croquis_${nombreArchivo(f.puntoMedido)}.jpg`, { modulo: "terreno", duenoTipo: "terreno_monografia", duenoId: f.id, rol: "foto", proyectoId: st.proyectoId, carpeta: `Proyectos/${st.proyecto ? st.proyecto.nombre : st.proyectoId}/Monografías`, detalle: { tipo: "croquis", punto: f.puntoMedido || "", origen: "gabinete" } }, { personaId: ctx2.personaId });
          ponerImagen("croquisImg", { archivo: reg.id });
          await guardarAhora();
          avisar2("Croquis generado desde el mapa. Puedes ajustar su encuadre.");
        } else if (a === "pdf") {
          const x = (st.lista || []).find((y) => y.id === b.dataset.id) || st.x;
          if (st.ficha && st.ficha.id === b.dataset.id) await guardarAhora();
          const f = st.ficha && st.ficha.id === b.dataset.id ? st.ficha : x.ficha;
          await descargarPdf([f], `monografia_${nombreArchivo(f.puntoMedido)}.pdf`);
        } else if (a === "pdf-todas") {
          const lista = st.lista.filter((x) => !st.filtro || x.estado === st.filtro).map((x) => x.ficha).sort(ordenNatural);
          await descargarPdf(lista, `monografias_${nombreArchivo(st.proyecto ? st.proyecto.nombre : "proyecto")}_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.pdf`);
        } else if (a === "ver-pdf") {
          await guardarAhora();
          const w = window.open("", "_blank");
          const blob = await pdfDe([st.ficha]);
          const url = URL.createObjectURL(blob);
          if (w) w.location.href = url;
          else descargar(`monografia_${nombreArchivo(st.ficha.puntoMedido)}.pdf`, blob, "application/pdf");
          return;
        } else if (a === "estado") {
          const e = b.dataset.e, obs = (cont.querySelector("#mn-obs") || {}).value || "";
          if (e === "con-observacion" && !obs.trim()) {
            avisar2("Escribe la observación para terreno.", "error");
          } else {
            if (st.guardando) await guardarAhora();
            await agregarRevision({ monografiaId: st.x.id, proyectoId: st.proyectoId, estado: e, observacion: e === "con-observacion" ? obs : "" });
            if (e === "lista" && !st.ficha.revisoNombre && ctx2.personaId && st.nombres[ctx2.personaId]) {
              st.ficha.revisoNombre = st.nombres[ctx2.personaId];
              st.ficha.fechaRevision = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
              await guardarAhora();
            }
            avisar2(e === "con-observacion" ? "Observación enviada: el encargado la verá en la app de Terreno." : `Estado: ${ESTADOS[e].texto}.`);
          }
        } else if (a === "usar-terreno") {
          await usarVersionDeTerreno(st.x.id);
          st.ficha = null;
          avisar2("Se tomó la versión que envió Terreno.");
        } else if (a === "elegir") {
          st.elegir = b.dataset.slot;
        } else if (a === "cerrar-elegir") {
          st.elegir = null;
        } else if (a === "usar-foto") {
          ponerImagen(st.elegir, { archivo: b.dataset.id });
          st.elegir = null;
          await guardarAhora();
        } else if (a === "ajustar") {
          const f = st.ficha, d = dimsMonografia(f), i = b.dataset.i;
          const extra = i != null ? f.fotosExtra[Number(i)] : null, clave2 = b.dataset.slot;
          const url = await urlImagen(extra ? extra.img : f[clave2]);
          if (!url) return;
          const dim = extra ? d.extra : d[clave2];
          const aj = await abrirAjuste({ titulo: extra ? extra.leyenda || `Fotografía ${Number(i) + 1}` : ranura[clave2], url, bw: dim[0], bh: dim[1], ajuste: extra ? extra.aj : (f.ajustes || {})[clave2], porDefecto: extra ? "llenar" : MODO_DEF[clave2] });
          if (!aj) return;
          if (extra) extra.aj = aj;
          else {
            f.ajustes = f.ajustes || {};
            f.ajustes[clave2] = aj;
          }
          await guardarAhora();
          avisar2("Encuadre aplicado: así queda en el PDF.");
        } else if (a === "quitar-img") {
          st.ficha[b.dataset.slot] = null;
          if (st.ficha.ajustes) delete st.ficha.ajustes[b.dataset.slot];
          await guardarAhora();
        } else if (a === "quitar-extra") {
          st.ficha.fotosExtra.splice(Number(b.dataset.i), 1);
          await guardarAhora();
        } else if (a === "quitar-logo") {
          fijarLogoEmpresa(null);
        } else return;
      } catch (e) {
        console.error(e);
        avisar2(e.message || "No se pudo", "error");
      }
      await render();
    });
    render();
    return { desmontar() {
      st.vivo = false;
      if (st.guardando) guardarAhora();
    }, refrescar: render };
  }

  // modulos/monografias/monografias.js
  var ALMACENES4 = Object.values(ALM5);
  var iniciado4 = false;
  function iniciar5({ personaId } = {}) {
    if (!iniciado4) {
      iniciarDatos4({ personaId: personaId != null ? personaId : null });
      iniciado4 = true;
    } else if (personaId !== void 0) fijarPersona4(personaId);
  }
  function montar4(contenedor2, contexto) {
    iniciar5({ personaId: contexto.personaId });
    return montarPantallas4(contenedor2, contexto);
  }
  async function resumenDeProyecto3(proyectoId) {
    iniciar5();
    return resumenDeProyecto2(proyectoId);
  }

  // app/nube-panel.js
  var esc2 = (s) => String(s != null ? s : "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
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
        cuerpo = `<p>${e.carpetaId ? `Carpeta: <b>${esc2(e.carpetaNombre)}</b>. La conexión con Google dura una hora; vuelve a conectar para seguir sincronizando.` : "Conecta tu cuenta de Google para guardar y compartir los datos en Drive."}</p>
        <button class="np-btn primario" data-np="conectar">${e.carpetaId ? "Reconectar con Google" : "Conectar con Google"}</button>
        ${invitacion && !e.carpetaId ? '<p class="np-ok">Te invitaron a una carpeta compartida: después de conectar, podrás usarla.</p>' : ""}`;
      } else if (!e.carpetaId) {
        cuerpo = `${invitacion ? `<div class="np-caja"><b>Te invitaron a una carpeta compartida</b>
          <label class="np-check"><input type="checkbox" id="np-limpiar" checked> Empezar desde la nube (borra los datos de prueba de este dispositivo, para no duplicar equipos)</label>
          <button class="np-btn primario" data-np="invitacion">Usar la carpeta compartida</button></div>` : ""}
        <div class="np-caja"><b>Crear una carpeta nueva</b><p>Se crea «${esc2(NOMBRE_CARPETA_PRUEBA)}» en tu Drive. Después la compartes con tu compañero.</p>
          <button class="np-btn ${invitacion ? "" : "primario"}" data-np="crear">Crear carpeta</button></div>
        <div class="np-caja"><b>Usar una carpeta que ya existe</b>
          <button class="np-btn" data-np="buscar">Buscar «${esc2(NOMBRE_CARPETA_PRUEBA)}»</button>
          ${carpetasEncontradas ? carpetasEncontradas.length ? `<ul class="np-lista">${carpetasEncontradas.map((c) => `<li><span>${esc2(c.name)}</span> <button class="np-btn chico" data-np="usar" data-id="${esc2(c.id)}">Usar</button></li>`).join("")}</ul>` : '<p class="np-tenue">No encontré carpetas con ese nombre a las que tengas acceso.</p>' : ""}
          <form data-np="enlace"><input name="enlace" placeholder="o pega el enlace de la carpeta de Drive" required><button class="np-btn">Usar</button></form>
          <label class="np-check"><input type="checkbox" id="np-limpiar2"> Empezar desde la nube (borra los datos de prueba de este dispositivo)</label></div>`;
      } else {
        const inv = enlaceInvitacion();
        cuerpo = `<dl class="np-datos">
          <div><dt>Carpeta</dt><dd><a href="https://drive.google.com/drive/folders/${esc2(e.carpetaId)}" target="_blank" rel="noopener">${esc2(e.carpetaNombre)} ↗</a></dd></div>
          <div><dt>Última sincronización</dt><dd>${hora(e.ultimaSync)}${e.ultimoResumen ? ` · ${e.ultimoResumen.recibidos} recibidos${e.ultimoResumen.archivosSubidos ? `, ${e.ultimoResumen.archivosSubidos} archivos subidos` : ""}` : ""}</dd></div>
          <div><dt>Estado</dt><dd>${e.sincronizando ? "Sincronizando…" : e.error ? `<span class="np-error-txt">${esc2(e.error)}</span>` : e.pendiente ? "Hay cambios por subir" : "Al día"}</dd></div>
        </dl>
        <button class="np-btn primario" data-np="sincronizar">Sincronizar ahora</button>
        <div class="np-caja"><b>Invitar a tu compañero</b>
          <ol><li>En Drive, comparte la carpeta con su cuenta de Google como <b>Editor</b>.</li>
          <li>Envíale este enlace; al abrirlo y conectar, usará la misma carpeta.</li></ol>
          <div class="np-enlace"><input readonly value="${esc2(inv)}"><button class="np-btn chico" data-np="copiar">Copiar</button></div></div>
        <div class="np-pie"><button class="np-btn chico" data-np="cambiar">Cambiar de carpeta</button><button class="np-btn chico" data-np="desconectar">Desconectar</button></div>`;
      }
      dlg.innerHTML = `<div class="np-cab"><b>☁ Nube · Google Drive</b><button class="np-x" data-np="cerrar" aria-label="Cerrar">✕</button></div>
      ${mensaje ? `<p class="np-msg ${mensaje.tipo}">${esc2(mensaje.texto)}</p>` : ""}
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

  // app/url-terreno.js
  var RUTA_TERRENO = "terreno/";
  var ANTIGUA = "paquete-conexion/ejemplo.html";
  function resolverUrlTerreno(guardada, paginaSistema) {
    const g = (guardada || "").trim();
    if (g && !g.includes(ANTIGUA)) return g;
    return new URL(RUTA_TERRENO, String(paginaSistema).split("#")[0]).toString();
  }

  // app/calendario.js
  var TIPOS = {
    vuelo: { texto: "Vuelos y terreno", clase: "cal-vuelo" },
    terreno: { texto: "Vuelos y terreno", clase: "cal-vuelo" },
    datos: { texto: "Llegada de datos", clase: "cal-datos" },
    entrega: { texto: "Entregas", clase: "cal-entrega" },
    dgac: { texto: "Permisos DGAC", clase: "cal-dgac" },
    calibracion: { texto: "Calibraciones", clase: "cal-calib" }
  };
  var LEYENDA = [["vuelo", "Vuelos y terreno"], ["datos", "Llegada de datos"], ["entrega", "Entregas"], ["dgac", "Permisos DGAC"], ["calibracion", "Calibraciones"]];
  var DIAS2 = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  var aFecha3 = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d, 12);
  };
  var lunesDe = (iso) => {
    const f = aFecha3(iso);
    const w = (f.getDay() + 6) % 7;
    f.setDate(f.getDate() - w);
    return aISO2(f);
  };
  async function eventosEntre(desde, hasta) {
    const [proyectos2, hojas, equipos] = await Promise.all([listarProyectos(), listarPlanes().catch(() => []), listarEquiposConEstado().catch(() => [])]);
    const nomProy = new Map(proyectos2.map((p) => [p.id, p.nombre]));
    const ev = [];
    const poner = (fecha2, e) => {
      if (fecha2 && fecha2 >= desde && fecha2 <= hasta) ev.push({ fecha: fecha2, ...e });
    };
    for (const p of proyectos2) {
      if (p.id === OFICINA_ID || p.estado === "cerrado") continue;
      const per = p.periodicidad;
      if (per && per.tipo === "recurrente") {
        for (const c of ciclosEntre(per, desde, sumarDias(hasta, 0))) {
          c.diasTerreno.forEach((f, k) => poner(f, { tipo: "terreno", texto: `${p.nombre} · terreno ${c.numero}${c.diasTerreno.length > 1 ? ` (${k + 1}/${c.diasTerreno.length})` : ""}`, corto: `Terreno ${c.numero} · ${p.nombre}`, enlace: `#/proyecto/${p.id}`, personaId: p.encargadoId, proyectoId: p.id }));
          poner(c.datos, { tipo: "datos", texto: `${p.nombre} · llegan los datos ${c.numero}`, corto: `Datos ${c.numero} · ${p.nombre}`, enlace: `#/seguimiento/${p.id}`, personaId: p.encargadoId, proyectoId: p.id });
          poner(c.entrega, { tipo: "entrega", texto: `${p.nombre} · entrega ${c.nombre}`, corto: `Entrega ${c.numero} · ${p.nombre}`, enlace: `#/seguimiento/${p.id}`, personaId: p.encargadoId, proyectoId: p.id });
        }
      } else if (p.plazo) poner(p.plazo, { tipo: "entrega", texto: `${p.nombre} · entrega`, corto: `Entrega · ${p.nombre}`, enlace: `#/proyecto/${p.id}`, personaId: p.encargadoId, proyectoId: p.id });
    }
    for (const h of hojas) {
      if (h.estado === "archivada") continue;
      const nombre = h.nombre || "Hoja de vuelo";
      const dias = Array.isArray(h.programa) && h.programa.length ? h.programa : h.fecha ? [{ fecha: h.fecha }] : [];
      dias.forEach((d) => poner(d.fecha, { tipo: "vuelo", texto: `${nombre}${d.de > 1 ? ` · día ${d.dia}/${d.de}` : " · vuelo"}`, corto: `Vuelo${d.de > 1 ? ` ${d.dia}/${d.de}` : ""} · ${nombre}`, detalle: d.sectores ? `${d.sectores.length} sectores · ${d.baterias} baterías` : "", enlace: `#/vuelos/plan/${h.id}`, personaId: h.pilotoId, proyectoId: h.proyectoId }));
      const dg = h.permisos && h.permisos.dgac || {};
      if (dias.length && !dg.enviado && !dg.aprobado && h.estado !== "volada") poner(restarHabiles(dias[0].fecha, 7), { tipo: "dgac", texto: `${nombre} · enviar DGAC (límite)`, corto: `Límite DGAC · ${nombre}`, enlace: `#/vuelos/plan/${h.id}`, personaId: h.pilotoId, proyectoId: h.proyectoId });
    }
    for (const e of equipos) {
      const c = e.calibracion || {};
      if (c.proxima) poner(String(c.proxima).slice(0, 10), { tipo: "calibracion", texto: `${e.nombre || e.modelo || "Equipo"}${e.numeroSerie ? ` ···${String(e.numeroSerie).slice(-4)}` : ""} · calibración vence`, corto: `Calibración · ${e.nombre || e.modelo || "Equipo"}`, enlace: `#/equipos/${e.id}`, personaId: e.ubicacion && e.ubicacion.personaId, proyectoId: e.ubicacion && e.ubicacion.proyectoId });
    }
    ev.forEach((e) => {
      e.proyecto = nomProy.get(e.proyectoId) || "";
    });
    return ev.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo));
  }
  var chip2 = (e, corto = false) => `<a class="cal-ev ${TIPOS[e.tipo].clase}" href="${escapar(e.enlace || "#")}" title="${escapar(e.texto)}${e.detalle ? " · " + escapar(e.detalle) : ""}">${escapar(corto ? e.corto || e.texto : e.texto)}</a>`;
  async function vistaCalendario(estado3) {
    const hoy = hoyISO();
    const ref = estado3.ref || hoy, modo = estado3.modo || "mes";
    const f = aFecha3(ref);
    let desde, hasta, titulo;
    if (modo === "mes") {
      desde = lunesDe(aISO2(new Date(f.getFullYear(), f.getMonth(), 1, 12)));
      hasta = sumarDias(desde, 41);
      titulo = `${MESES2[f.getMonth()]} ${f.getFullYear()}`;
    } else {
      desde = lunesDe(ref);
      hasta = sumarDias(desde, 6);
      titulo = `Semana del ${fechaLegible(desde)} al ${fechaLegible(hasta)}`;
    }
    const [todos2, proyectos2, personas2] = await Promise.all([eventosEntre(sumarDias(desde, 0), sumarDias(hasta, 14)), listarProyectos(), listarPersonas()]);
    const ev = todos2.filter((e) => !estado3.proyecto || e.proyectoId === estado3.proyecto);
    const delDia = (iso) => ev.filter((e) => e.fecha === iso);
    const dias = (n) => Array.from({ length: n }, (_, k) => sumarDias(desde, k));
    let cuerpo;
    if (modo === "mes") {
      cuerpo = `<div class="cal-grilla cal-mes"><div class="cal-cab">${DIAS2.map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="cal-celdas">${dias(42).map((d) => {
        const fd = aFecha3(d), fuera = fd.getMonth() !== f.getMonth(), es = delDia(d);
        return `<div class="cal-dia${fuera ? " fuera" : ""}${fd.getDay() % 6 === 0 ? " finde" : ""}${d === hoy ? " hoy" : ""}"><span class="cal-num">${fd.getDate()}</span>${es.slice(0, 4).map((e) => chip2(e, true)).join("")}${es.length > 4 ? `<button type="button" class="cal-mas" data-accion="cal-ir" data-ref="${d}" data-modo="semana">+${es.length - 4} más</button>` : ""}</div>`;
      }).join("")}</div></div>`;
    } else if (modo === "semana") {
      cuerpo = `<div class="cal-semana">${dias(7).map((d, k) => {
        const fd = aFecha3(d), es = delDia(d);
        return `<div class="cal-col${d === hoy ? " hoy" : ""}"><div class="cal-col-cab"><span>${DIAS2[k]}</span><b>${fd.getDate()}</b></div>${es.map((e) => `${chip2(e)}${e.detalle ? `<small class="cal-det">${escapar(e.detalle)}</small>` : ""}`).join("") || '<span class="cal-vacio">—</span>'}</div>`;
      }).join("")}</div>`;
    } else {
      const semana = dias(7), ids = [...new Set(ev.filter((e) => e.fecha <= hasta).map((e) => e.personaId || ""))];
      const nom = (id) => id ? (personas2.find((p) => p.id === id) || {}).nombre || "Persona" : "Sin persona asignada";
      cuerpo = `<div class="cal-personas" style="grid-template-columns: 180px repeat(7, minmax(0, 1fr))">
      <span></span>${semana.map((d, k) => `<span class="cal-pcab${d === hoy ? " hoy" : ""}">${DIAS2[k]} ${aFecha3(d).getDate()}</span>`).join("")}
      ${ids.length ? ids.sort((a, b) => nom(a).localeCompare(nom(b), "es")).map((id) => `<b class="cal-pnom">${escapar(nom(id))}</b>${semana.map((d) => `<div class="cal-pcel">${ev.filter((e) => e.fecha === d && (e.personaId || "") === id).map((e) => chip2(e, true)).join("")}</div>`).join("")}`).join("") : '<p class="sis-tenue" style="grid-column: 1 / -1">No hay nada programado esta semana.</p>'}
    </div>`;
    }
    const proximos = ev.filter((e) => e.fecha >= hoy && e.fecha <= sumarDias(hoy, 14));
    return `<div class="cal-barra">
      <div class="cal-nav"><button class="sis-btn chico" data-accion="cal-mover" data-d="-1" aria-label="Anterior">‹</button><b>${escapar(titulo)}</b><button class="sis-btn chico" data-accion="cal-mover" data-d="1" aria-label="Siguiente">›</button><button class="sis-btn chico" data-accion="cal-ir" data-ref="${hoy}">Hoy</button></div>
      <div class="cal-modos" role="tablist" aria-label="Vista del calendario">${[["mes", "Mes"], ["semana", "Semana"], ["persona", "Por persona"]].map(([k, t]) => `<button type="button" role="tab" aria-selected="${modo === k}" class="${modo === k ? "activo" : ""}" data-accion="cal-modo" data-modo="${k}">${t}</button>`).join("")}</div>
    </div>
    <div class="cal-filtros">${LEYENDA.map(([k, t]) => `<span class="cal-ley ${TIPOS[k].clase}">${t}</span>`).join("")}
      <label class="cal-proy">Proyecto <select data-accion="cal-proyecto"><option value="">Todos</option>${proyectos2.filter((p) => p.id !== OFICINA_ID && p.estado !== "cerrado").map((p) => `<option value="${escapar(p.id)}" ${estado3.proyecto === p.id ? "selected" : ""}>${escapar(p.nombre)}</option>`).join("")}</select></label></div>
    <div class="cal-dos"><div class="cal-principal">${cuerpo}</div>
      <aside class="sis-tarjeta cal-proximos"><h2>Próximos 14 días</h2>${proximos.length ? `<div class="cal-lista">${proximos.map((e) => `<span class="cal-fecha">${e.fecha === hoy ? "hoy" : escapar(fechaCorta(e.fecha))}</span>${chip2(e)}`).join("")}</div>` : '<p class="sis-tenue">Nada en las próximas dos semanas.</p>'}
        <p class="sis-tenue">Se llena solo con las jornadas de las hojas de vuelo («Agregar al calendario» en su Resumen), la periodicidad de cada proyecto, el límite DGAC y las calibraciones que vencen.</p></aside></div>`;
  }
  var DS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  var fechaCorta = (iso) => {
    const f = aFecha3(iso);
    return `${DS[f.getDay()]} ${f.getDate()}`;
  };
  function mover(estado3, d) {
    const f = aFecha3(estado3.ref || hoyISO());
    if ((estado3.modo || "mes") === "mes") return aISO2(new Date(f.getFullYear(), f.getMonth() + d, 1, 12));
    return sumarDias(aISO2(f), 7 * d);
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
  var ETAPAS_PROYECTO = [["terreno", "Terreno"], ["gabinete", "Proceso en gabinete"], ["entregables", "Entregables"], ["completado", "Completado"]];
  var NOMBRE_ETAPA_PROYECTO = Object.fromEntries(ETAPAS_PROYECTO);
  var etapaProyecto = (p) => p.estado === "cerrado" ? "completado" : NOMBRE_ETAPA_PROYECTO[p.etapa] && p.etapa !== "completado" ? p.etapa : "terreno";

  // app/version.js
  var VERSION_SISTEMA = "0.11.2";
  var MODULOS_INCLUIDOS = "Equipos 0.2 (+ avisos) + Vuelos 0.9 + Seguimiento 0.2 + Monografías 0.3 (desde Terreno)";

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
  var vacio2 = (texto3, extra = "") => `<div class="sis-vacio"><p>${texto3}</p>${extra}</div>`;
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
      const porProyecto2 = {};
      for (const e of enTerreno) (porProyecto2[_a = e.ubicacion.proyectoId] || (porProyecto2[_a] = [])).push(e);
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
          ${revisar2.length ? `<div class="sis-lista">${revisar2.slice(0, 10).map((e) => filaEquipo(e, { nombreProyecto: nomProy })).join("")}</div>${revisar2.length > 10 ? `<p class="sis-tenue">y ${revisar2.length - 10} más en Equipos → filtro «Calibración por revisar».</p>` : ""}` : vacio2(vigentes.length ? "Todas las calibraciones están al día." : "Aún no hay equipos cargados. Ve a Equipos → Administrar → Importar planilla.")}
        </section>
        <section class="sis-tarjeta">
        <h2>Equipos en terreno, por proyecto</h2>
        ${Object.keys(porProyecto2).length ? Object.entries(porProyecto2).map(([pid, lista]) => `
          <div class="sis-grupo"><a class="sis-grupo-cab" href="#/proyecto/${escapar(pid)}">${ICONO.proyecto}${escapar(nomProy(pid))} <span class="sis-tenue">${lista.length} equipo${lista.length > 1 ? "s" : ""}</span></a>
          <div class="sis-lista">${lista.map((e) => filaEquipo(e)).join("")}</div></div>`).join("") : vacio2("No hay equipos fuera de la oficina.")}
      </section>
      </div><aside>
        <section class="sis-tarjeta">
          <h2>Alertas abiertas</h2>
          ${conAlerta.length ? `<div class="sis-lista">${conAlerta.map((e) => `<a class="sis-fila" href="#/equipos/${escapar(e.id)}">
              <span class="sis-fila-txt"><b>${escapar(e.nombre)}</b>${e.alertasActivas.map((a) => `<span class="sis-tenue">${escapar(a.descripcion)} · desde ${fechaLegible((a.fechaReporte || "").slice(0, 10))}</span>`).join("")}</span>
              <span class="sis-chips">${e.alertasActivas.map((a) => `<span class="sis-chip rojo">${escapar(estadoAlerta(a.estado))}</span>`).join("")}</span></a>`).join("")}</div>` : vacio2("No hay alertas abiertas.")}
        </section>
      </aside></div>`;
    }
    return inicioTerreno(ctx2, { personas: personas2, proyectos: proyectos2, equipos, yo, saludo, bienvenida, nomProy });
  }
  var DSEM = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  var aFechaL = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d, 12);
  };
  var lunesDe2 = (iso) => {
    const f = aFechaL(iso);
    f.setDate(f.getDate() - (f.getDay() + 6) % 7);
    return f.toISOString().slice(0, 10);
  };
  var diaCorto = (iso) => {
    const f = aFechaL(iso);
    return `${DSEM[f.getDay()]} ${f.getDate()}`;
  };
  var CLASE_EV = { vuelo: "vu", terreno: "vu", datos: "da", entrega: "en", dgac: "dg", calibracion: "ca" };
  var PRIORIDAD_EV = { vuelo: 5, terreno: 5, entrega: 4, dgac: 3, datos: 2 };
  function htmlFranjaProyectos(eventos, proyectos2, desde, { dias = 14, proyectoId = "" } = {}) {
    const fechas = Array.from({ length: dias }, (_, k) => sumarDias(desde, k)), hoy = hoyISO();
    const porProy = /* @__PURE__ */ new Map();
    for (const e of eventos) {
      if (!e.proyectoId || e.tipo === "calibracion" || proyectoId && e.proyectoId !== proyectoId) continue;
      const k = fechas.indexOf(e.fecha);
      if (k < 0) continue;
      const m = porProy.get(e.proyectoId) || new Array(dias).fill(null);
      if (!m[k] || PRIORIDAD_EV[e.tipo] > PRIORIDAD_EV[m[k].tipo]) m[k] = e;
      porProy.set(e.proyectoId, m);
    }
    const filas = [...porProy.entries()].map(([pid, m]) => {
      const segs = [];
      m.forEach((e, k) => {
        if (!e) return;
        const u = segs[segs.length - 1];
        if (u && u.tipo === e.tipo && u.fin === k - 1) {
          u.fin = k;
          u.n++;
        } else segs.push({ tipo: e.tipo, ini: k, fin: k, e, n: 1 });
      });
      const nombre = (proyectos2.find((p) => p.id === pid) || {}).nombre || "Proyecto";
      return `<a class="ini-cal-nombre" href="#/proyecto/${escapar(pid)}">${escapar(nombre)}</a><div class="ini-cal-pista">${segs.map((sg) => `<a class="ini-cal-seg ${CLASE_EV[sg.tipo]}" style="grid-column:${sg.ini + 1} / ${sg.fin + 2}" href="${escapar(sg.e.enlace || "#")}" title="${escapar(sg.e.texto)}">${escapar({ vuelo: "Vuelo", terreno: "Terreno", datos: "Datos", entrega: "Entrega", dgac: "DGAC" }[sg.tipo])}${sg.n > 1 ? "" : ""}</a>`).join("")}</div>`;
    });
    return `<div class="ini-cal">
      <span></span><div class="ini-cal-dias">${fechas.map((f) => {
      const w = aFechaL(f).getDay();
      return `<span class="${f === hoy ? "hoy" : ""}${w === 0 || w === 6 ? " finde" : ""}">${escapar(diaCorto(f))}</span>`;
    }).join("")}</div>
      ${filas.join("") || '<span></span><p class="sis-tenue">Sin vuelos, terrenos ni entregas en estas dos semanas.</p>'}
    </div>
    <div class="ini-cal-ley"><span><i class="vu"></i>Vuelo o terreno</span><span><i class="da"></i>Llegada de datos</span><span><i class="en"></i>Entrega</span><span><i class="dg"></i>Límite DGAC</span></div>`;
  }
  async function inicioTerreno(ctx2, { personas: personas2, proyectos: proyectos2, equipos, yo, saludo, bienvenida, nomProy }) {
    const hoy = hoyISO(), lunes = lunesDe2(hoy), domingo = sumarDias(lunes, 6);
    const [vuelos, eventos] = await Promise.all([listarVuelos().catch(() => []), eventosEntre(lunes, sumarDias(lunes, 27)).catch(() => [])]);
    const activos = proyectos2.filter((p) => p.id !== OFICINA_ID && p.estado !== "cerrado");
    const porEtapa = Object.fromEntries(ETAPAS_PROYECTO.map(([k]) => [k, []]));
    for (const p of proyectos2.filter((x) => x.id !== OFICINA_ID)) porEtapa[etapaProyecto(p)].push(p);
    const mesActual = hoy.slice(0, 7);
    const completadosMes = porEtapa.completado.filter((p) => (p.etapas && p.etapas.completado || p.actualizadoEn || "").slice(0, 7) === mesActual);
    const semana = vuelos.filter((v) => v.fechas.some((f) => f >= lunes && f <= domingo));
    const voladosSem = semana.filter((v) => ["volado", "log", "procesado"].includes(v.etapa)).length;
    const equiposAlerta = equipos.filter((e) => e.alertasActivas.length || ["vencida", "por_vencer"].includes(e.calibracion.nivel));
    const etapaDe = (id) => {
      const p = proyectos2.find((x) => x.id === id);
      return p ? etapaProyecto(p) : null;
    };
    const permisos = vuelos.filter((v) => ["planificacion", "permisos", "programado"].includes(v.etapa) && !v.dgac.enviado && !v.dgac.aprobado && v.fechas[0] && v.fechas[0] >= hoy && v.fechas[0] <= sumarDias(hoy, 30)).map((v) => ({ ...v, limite: restarHabiles(v.fechas[0], 7) })).sort((a, b) => a.limite.localeCompare(b.limite));
    const logs = vuelos.filter((v) => v.etapa === "volado" && (!v.proyectoId || ["gabinete", "entregables", "completado"].includes(etapaDe(v.proyectoId))));
    const nAlertas = equiposAlerta.length + permisos.length + logs.length;
    const entregas = eventos.filter((e) => e.tipo === "entrega" && e.fecha >= hoy && e.fecha <= sumarDias(hoy, 7));
    const aMiCargo = yo ? equipos.filter((e) => e.ubicacion.lugar === "terreno" && e.ubicacion.personaId === yo.id) : [];
    const kpi2 = (t, n, det, clase = "", href = "#/proyectos") => `<a class="sis-kpi ${clase}" href="${href}"><span>${t}</span><b>${n}</b><small class="sis-tenue">${det}</small></a>`;
    const caja2 = (k, t) => `<a class="ini-etapa ${k}" href="#/proyectos"><small>${t}</small><b>${porEtapa[k].length}</b><span>${escapar(porEtapa[k].slice(0, 2).map((p) => p.nombre).join(" · ") || "—")}${porEtapa[k].length > 2 ? ` · +${porEtapa[k].length - 2}` : ""}</span></a>`;
    return `${saludo}${bienvenida}
    <div class="sis-kpis">
      ${kpi2("Proyectos activos", activos.length, `${porEtapa.terreno.length} en terreno · ${porEtapa.gabinete.length} en gabinete · ${porEtapa.entregables.length} en entregables`)}
      ${kpi2("Vuelos esta semana", semana.length, semana.length ? `${voladosSem} volado${voladosSem === 1 ? "" : "s"} · ${semana.length - voladosSem} por volar` : "sin vuelos programados", "", "#/vuelos")}
      ${kpi2("Alertas", nAlertas, `${equiposAlerta.length} equipos · ${permisos.length} permisos · ${logs.length} log${logs.length === 1 ? "" : "s"}`, nAlertas ? "ambar" : "", "#/inicio")}
      ${kpi2("Entregas próximas (7 días)", entregas.length, entregas[0] ? `la más cercana: ${escapar(diaCorto(entregas[0].fecha))}` : "ninguna esta semana", entregas.length ? "ambar" : "", "#/seguimiento")}
    </div>
    <div class="sis-dos ini-dos"><div>
      <section class="sis-tarjeta"><div class="sis-cab"><h2>Calendario · proyectos activos</h2><a class="sis-btn chico" href="#/proyectos/calendario">Ver mes completo</a></div>
        ${htmlFranjaProyectos(eventos, proyectos2, lunes)}</section>
      <section class="sis-tarjeta"><div class="sis-cab"><h2>Estado de los proyectos</h2><a class="sis-btn chico" href="#/proyectos">Ir a Proyectos</a></div>
        <div class="ini-etapas">${caja2("terreno", "Terreno")}${caja2("gabinete", "Proceso en gabinete")}${caja2("entregables", "Entregables")}
          <a class="ini-etapa completado" href="#/proyectos/registro"><small>Completados (mes)</small><b>${completadosMes.length}</b><span>pasan al registro por mandante</span></a></div>
        ${!activos.length ? vacio2("Aún no hay proyectos activos. Crea el primero con el encargo que te llegó.", '<a class="sis-btn primario" href="#/proyecto-editar/nuevo">+ Proyecto</a>') : ""}
      </section>
    </div><aside>
      <section class="sis-tarjeta"><h2>Alertas de equipos</h2>
        ${equiposAlerta.length ? `<div class="sis-lista">${equiposAlerta.slice(0, 8).map((e) => filaEquipo(e, { nombreProyecto: nomProy })).join("")}</div>${equiposAlerta.length > 8 ? `<p class="sis-tenue">y ${equiposAlerta.length - 8} más en Equipos.</p>` : ""}` : vacio2("Sin alertas: calibraciones al día y sin problemas reportados.")}
      </section>
      <section class="sis-tarjeta"><h2>Permisos</h2>
        ${permisos.length || logs.length ? `<div class="ini-avisos">
          ${permisos.map((v) => `<a class="ini-aviso ${v.limite < hoy ? "rojo" : "ambar"}" href="#/vuelos/plan/${escapar(v.id)}"><b>${escapar(v.nombre)} · vuelo ${escapar(diaCorto(v.fechas[0]))}</b><small>Solicitud DGAC sin registrar. ${v.limite < hoy ? `El plazo sugerido (7 días hábiles) venció el ${fechaLegible(v.limite)}.` : `Sugerido presentarla a más tardar el ${fechaLegible(v.limite)}.`}${v.docsPendientes ? ` Faltan ${v.docsPendientes} documentos.` : ""}</small></a>`).join("")}
          ${logs.map((v) => `<a class="ini-aviso rojo" href="#/vuelos/plan/${escapar(v.id)}"><b>${escapar(v.nombre)} · log de vuelo pendiente</b><small>${v.proyectoId ? `${escapar(nomProy(v.proyectoId))} ya está en ${escapar(NOMBRE_ETAPA_PROYECTO[etapaDe(v.proyectoId)].toLowerCase())}.` : "Vuelo volado."} Cárgalo en el paso Permisos.</small></a>`).join("")}
        </div><p class="sis-tenue">Avisos informativos: no bloquean la programación.</p>` : vacio2("Sin permisos pendientes para los vuelos del próximo mes.")}
      </section>
      ${yo ? `<section class="sis-tarjeta"><h2>Equipos a mi cargo</h2>${aMiCargo.length ? `<div class="sis-lista">${aMiCargo.map((e) => filaEquipo(e, { nombreProyecto: nomProy })).join("")}</div>` : vacio2("No tienes equipos a tu cargo. Se asignan con el checklist de salida en Equipos.")}</section>` : ""}
    </aside></div>`;
  }
  function estadoAlerta(e) {
    return { abierta: "Abierta", en_mantencion: "En mantención", recibida: "Recibida de mantención", cerrada: "Cerrada" }[e] || e;
  }
  async function proyectos(ctx2, sub3 = null) {
    if (sub3 === "calendario") {
      ctx2.estado.cal = ctx2.estado.cal || { modo: leerLS3("env_cal_modo") || "mes", ref: hoyISO(), proyecto: "" };
      return `<div class="sis-cab"><h1>Calendario</h1><a class="sis-btn primario" href="#/proyecto-editar/nuevo">+ Proyecto</a></div>${await vistaCalendario(ctx2.estado.cal)}`;
    }
    if (sub3 === "registro") return registroMandantes(ctx2);
    const [lista, personas2, equipos, vuelos, eventos] = await Promise.all([listarProyectos(), listarPersonas(), listarEquiposConEstado(), listarVuelos().catch(() => []), eventosEntre(hoyISO(), sumarDias(hoyISO(), 90)).catch(() => [])]);
    const nomPers = (id) => (personas2.find((p) => p.id === id) || {}).nombre || "";
    const enProyecto = (id) => equipos.filter((e) => e.ubicacion.lugar === "terreno" && e.ubicacion.proyectoId === id).length;
    const activos = lista.filter((p) => p.id !== OFICINA_ID && p.estado !== "cerrado");
    const eliminados = (await enPapelera("compartido_proyectos")).map((x) => x.registro);
    const segs = Object.fromEntries(await Promise.all(activos.map(async (p) => [p.id, await resumenDeProyecto(p.id).catch(() => null)])));
    const vista = leerLS3("env_proyectos_vista2") === "etapas" ? "etapas" : "tarjetas";
    const selector = `<div class="sis-vistas" role="tablist" aria-label="Vista de proyectos"><button type="button" role="tab" aria-selected="${vista === "tarjetas"}" class="${vista === "tarjetas" ? "activo" : ""}" data-accion="vista-proyectos" data-v="tarjetas">Tarjetas</button><button type="button" role="tab" aria-selected="${vista === "etapas"}" class="${vista === "etapas" ? "activo" : ""}" data-accion="vista-proyectos" data-v="etapas">Por etapa</button></div>`;
    const tarjeta = (p) => {
      const et = etapaProyecto(p), iEt = ETAPAS_PROYECTO.findIndex(([k]) => k === et);
      const vs = vuelos.filter((v) => v.proyectoId === p.id), sg = segs[p.id], prox = eventos.find((e) => e.proyectoId === p.id && e.tipo !== "calibracion");
      const sig = ETAPAS_PROYECTO[iEt + 1];
      let avance = "";
      if (sg) {
        const c = sg.cuenta;
        avance = `${c.total - c.sinvolar}/${c.total} tramos volados · ${c.productosListos}/${c.productos} productos · ${c.ok}/${c.total} entregados`;
      } else if (vs.length) {
        const n = (k) => vs.filter((v) => v.etapa === k).length;
        avance = `${vs.length} vuelo${vs.length === 1 ? "" : "s"}: ${[["planificacion", "en planificación"], ["permisos", "en permisos"], ["programado", "programados"], ["volado", "volados sin log"], ["log", "con log"], ["procesado", "procesados"]].filter(([k]) => n(k)).map(([k, t]) => `${n(k)} ${t}`).join(" · ")}`;
      }
      return `<article class="sis-proy-card ${et}">
      <div class="sis-proy-card-cab"><small>${escapar(p.mandante || "Sin mandante")}</small><span class="sis-chip etapa-${et}">${escapar(NOMBRE_ETAPA_PROYECTO[et])}</span></div>
      <a class="sis-proy-card-nombre" href="#/proyecto/${escapar(p.id)}">${escapar(p.nombre)}</a>
      <div class="sis-etapas-barra" role="img" aria-label="Etapa: ${escapar(NOMBRE_ETAPA_PROYECTO[et])}">${ETAPAS_PROYECTO.map(([k], i) => `<i class="${i <= iEt ? "hecho" : ""}"></i>`).join("")}</div>
      <div class="sis-etapas-txt">${ETAPAS_PROYECTO.map(([k, t], i) => `<span class="${i === iEt ? "actual" : ""}">${t.replace("Proceso en ", "")}</span>`).join("")}</div>
      ${avance ? `<p class="sis-tenue">${escapar(avance)}</p>` : ""}
      <div class="sis-chips">${tiposDeProyecto(p).categorias.map((t) => `<span class="sis-chip gris">${escapar(NOMBRE_CATEGORIA[t])}</span>`).join("")}${enProyecto(p.id) ? `<span class="sis-chip azul">${enProyecto(p.id)} equipo${enProyecto(p.id) > 1 ? "s" : ""} en terreno</span>` : ""}</div>
      <div class="sis-proy-card-pie"><span>${p.encargadoId ? `Encargado: ${escapar(nomPers(p.encargadoId))}` : p.comuna ? escapar(p.comuna) : ""}</span><span>${prox ? `Próximo: ${escapar(prox.corto ? prox.corto.split(" · ")[0] : prox.texto)} ${escapar(diaCorto(prox.fecha))}` : p.plazo ? `Plazo ${fechaLegible(p.plazo)}` : ""}</span></div>
      ${sig ? `<button type="button" class="sis-btn chico" data-accion="etapa-proyecto" data-id="${escapar(p.id)}" data-e="${sig[0]}">Pasar a ${escapar(sig[1].toLowerCase())} →</button>` : ""}
    </article>`;
    };
    const cuerpo = vista === "etapas" ? `<div class="sis-columnas-etapa">${ETAPAS_PROYECTO.filter(([k]) => k !== "completado").map(([k, t]) => {
      const ps = activos.filter((p) => etapaProyecto(p) === k);
      return `<div class="sis-col-etapa"><h2>${t} <span class="sis-tenue">${ps.length}</span></h2>${ps.map(tarjeta).join("") || '<p class="sis-tenue">Sin proyectos.</p>'}</div>`;
    }).join("")}</div>` : `<div class="sis-proy-cards">${activos.map(tarjeta).join("")}</div>`;
    const oficina = lista.find((p) => p.id === OFICINA_ID);
    return `<div class="sis-cab"><div><h1>Proyectos activos</h1><span class="sis-tenue">${activos.length} proyecto${activos.length === 1 ? "" : "s"} · terreno → gabinete → entregables → completado</span></div>${selector}<a class="sis-btn primario" href="#/proyecto-editar/nuevo">+ Proyecto</a></div>
    ${activos.length ? cuerpo : vacio2("Aún no hay proyectos activos. Crea el primero con el encargo que te llegó.")}
    ${oficina ? `<p class="sis-tenue">Trabajo que no es de un contrato: <a href="#/proyecto/${OFICINA_ID}">Oficina</a>. Los completados quedan en <a href="#/proyectos/registro">Registro por mandante</a>.</p>` : ""}
    ${eliminados.length ? `<details class="sis-papelera"><summary>Papelera de proyectos (${eliminados.length})</summary>
      <section class="sis-tarjeta"><div class="sis-lista">${eliminados.map((p) => `<div class="sis-fila">
        <span class="sis-fila-txt"><b>${escapar(p.nombre)}</b><span class="sis-tenue">Eliminado ${fechaHoraLegible(p.eliminadoEn)}</span></span>
        <button class="sis-btn chico" data-accion="restaurar-proyecto" data-id="${escapar(p.id)}">Restaurar</button></div>`).join("")}</div></section></details>` : ""}`;
  }
  async function datosRegistro() {
    const [lista, vuelos, monos] = await Promise.all([listarProyectos(), listarVuelos().catch(() => []), Promise.resolve(null)]);
    const cerrados = lista.filter((p) => p.id !== OFICINA_ID && p.estado === "cerrado");
    return cerrados.map((p) => {
      const vs = vuelos.filter((v) => v.proyectoId === p.id);
      const fin = p.etapas && p.etapas.completado || (p.actualizadoEn || "").slice(0, 10);
      const ini = p.fechaEncargo || (p.creadoEn || "").slice(0, 10);
      return {
        p,
        mandante: (p.mandante || "").trim() || "Sin mandante",
        fin,
        ini,
        dias: fin && ini ? Math.max(0, diasEntre(ini, fin)) : null,
        ha: vs.reduce((t, v) => t + (v.resumen.area || 0), 0) / 1e4,
        km: vs.reduce((t, v) => t + (v.resumen.largo || 0), 0) / 1e3,
        vuelos: vs.length,
        tipos: tiposDeProyecto(p).categorias.map((t) => NOMBRE_CATEGORIA[t]).join(", ")
      };
    });
  }
  async function registroMandantes(ctx2) {
    const filas = await datosRegistro();
    const grupos = /* @__PURE__ */ new Map();
    for (const f of filas) {
      if (!grupos.has(f.mandante)) grupos.set(f.mandante, []);
      grupos.get(f.mandante).push(f);
    }
    const mandantes = [...grupos.keys()].sort((a, b) => grupos.get(b).length - grupos.get(a).length || a.localeCompare(b));
    const sel = mandantes.includes(ctx2.estado.mandante) ? ctx2.estado.mandante : mandantes[0];
    const fs = (grupos.get(sel) || []).sort((a, b) => (b.fin || "").localeCompare(a.fin || ""));
    const conDias = fs.filter((f) => f.dias != null);
    const num = (n, d = 0) => n.toLocaleString("es-CL", { maximumFractionDigits: d });
    return `<div class="sis-cab"><div><h1>Registro por mandante</h1><span class="sis-tenue">Proyectos completados, agrupados por mandante. Sirve como base de datos para cotizar y planificar.</span></div>
      ${filas.length ? '<button class="sis-btn" data-accion="exportar-registro">Exportar CSV</button>' : ""}</div>
    ${!filas.length ? vacio2("Aún no hay proyectos completados. Al pasar un proyecto a «Completado» queda aquí, bajo su mandante.") : `
    <div class="sis-registro">
      <div class="sis-mandantes" role="tablist" aria-label="Mandantes">${mandantes.map((m) => `<button type="button" role="tab" aria-selected="${m === sel}" class="sis-mandante${m === sel ? " activo" : ""}" data-accion="ver-mandante" data-m="${escapar(m)}"><span>${escapar(m)}</span><b>${grupos.get(m).length}</b></button>`).join("")}</div>
      <section class="sis-tarjeta">
        <h2>${escapar(sel)}</h2>
        <div class="sis-kpis">
          <div class="sis-kpi"><span>Proyectos</span><b>${fs.length}</b></div>
          <div class="sis-kpi"><span>Superficie volada</span><b>${num(fs.reduce((t, f) => t + f.ha, 0))} <small>ha</small></b></div>
          <div class="sis-kpi"><span>Longitud lineal</span><b>${num(fs.reduce((t, f) => t + f.km, 0), 1)} <small>km</small></b></div>
          <div class="sis-kpi"><span>Plazo medio</span><b>${conDias.length ? num(conDias.reduce((t, f) => t + f.dias, 0) / conDias.length) : "—"} <small>días</small></b></div>
        </div>
        <div class="sis-tabla-scroll"><table class="sis-tabla">
          <thead><tr><th>Proyecto</th><th>Cierre</th><th>Tipos</th><th>Vuelos</th><th>Superficie</th><th>Plazo</th></tr></thead>
          <tbody>${fs.map((f) => `<tr><td><a href="#/proyecto/${escapar(f.p.id)}">${escapar(f.p.nombre)}</a>${f.p.comuna ? `<small>${escapar(f.p.comuna)}</small>` : ""}</td><td>${f.fin ? fechaLegible(f.fin) : "—"}</td><td>${escapar(f.tipos || "—")}</td><td>${f.vuelos || "—"}</td><td>${f.ha ? `${num(f.ha, 1)} ha` : "—"}${f.km ? ` · ${num(f.km, 1)} km` : ""}</td><td>${f.dias != null ? `${f.dias} d` : "—"}</td></tr>`).join("")}</tbody>
        </table></div>
      </section>
    </div>`}`;
  }
  async function proyecto(ctx2, id) {
    const p = await obtenerProyecto(id);
    if (!p || p.eliminadoEn) return vacio2("Este proyecto no existe o está en la papelera.", '<a class="sis-btn" href="#/proyectos">Volver a Proyectos</a>');
    const [personas2, equipos, certs, planes, seg, mono] = await Promise.all([listarPersonas(), listarEquiposConEstado(), certificadosDeProyecto(id), planesDeProyecto2(id), resumenDeProyecto(id), resumenDeProyecto3(id)]);
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
          <p class="sis-tenue">Para entregar al mandante los certificados de los equipos que están en este proyecto.</p>` : vacio2("Cuando salgan equipos a este proyecto, aquí aparecen sus certificados vigentes.");
    return `<div class="sis-encabezado">
      <div>
        <div class="sis-miga"><a href="#/proyectos">Proyectos</a> / ${escapar(p.nombre)}</div>
        <h1>${escapar(p.nombre)}</h1>
        <div class="sis-meta">
          <span>Mandante: <b>${escapar(p.mandante || (esOficina ? "Trabajo que no es de un contrato" : "—"))}</b></span>
          ${esOficina ? "" : `${meta("Encargado", escapar(nomPers(p.encargadoId)))}${meta("Ubicación", escapar([p.comuna, p.region].filter(Boolean).join(", ")))}
          ${meta("Encargado por", escapar(p.solicitadoPor || ""))}${meta("Encargo", p.fechaEncargo ? fechaLegible(p.fechaEncargo) : "")}${p.periodicidad && p.periodicidad.tipo === "recurrente" ? meta("Periodicidad", escapar(textoPeriodicidad(p.periodicidad).replace("Recurrente · ", ""))) : meta("Plazo", plazo)}`}
        </div>
        ${textosTipos(p).length ? `<div class="sis-chips" style="margin-top:10px">${textosTipos(p).map((t) => `<span class="sis-chip gris">${escapar(t)}</span>`).join("")}</div>` : ""}
      </div>
      <div class="sis-acciones">${esOficina ? '<span class="sis-chip gris">Especial</span>' : `<span class="sis-chip ${p.estado === "cerrado" ? "gris" : "verde"}">${p.estado === "cerrado" ? "Cerrado" : "Activo"}</span>
        <a class="sis-btn chico" href="#/proyecto-editar/${escapar(p.id)}">Editar</a>`}</div>
    </div>
    ${esOficina ? "" : (() => {
      const et = etapaProyecto(p), iEt = ETAPAS_PROYECTO.findIndex(([k]) => k === et);
      return `<section class="sis-tarjeta sis-etapa-ficha"><div class="sis-etapas-pasos">${ETAPAS_PROYECTO.map(([k, t], i) => `<button type="button" class="sis-etapa-paso${i < iEt ? " hecho" : i === iEt ? " actual" : ""}" data-accion="etapa-proyecto" data-id="${escapar(p.id)}" data-e="${k}" ${i === iEt ? 'aria-current="step"' : ""}><span>${i < iEt ? "✓" : i + 1}</span>${t}${p.etapas && p.etapas[k] ? `<small>${fechaLegible(p.etapas[k])}</small>` : ""}</button>`).join("")}</div></section>`;
    })()}
    ${p.notas ? `<p class="sis-notas">${escapar(p.notas)}</p>` : ""}
    <div class="sis-dos"><div>
      ${p.periodicidad && p.periodicidad.tipo === "recurrente" ? (() => {
      const cs = ciclosEntre(p.periodicidad, hoyISO(), sumarDias(hoyISO(), 120)).slice(0, 3);
      return `<section class="sis-tarjeta"><div class="sis-cab"><h2>Próximos ciclos</h2><button class="sis-btn chico" data-accion="ver-calendario">▦ Calendario</button></div>
          ${cs.length ? `<div class="sis-lista">${cs.map((c) => `<div class="sis-fila"><span class="sis-fila-txt"><b><span class="mono">${escapar(c.numero)}</span> ${escapar(c.nombre)}</b><span class="sis-tenue">Terreno ${fechaLegible(c.terreno[0])}${c.terreno[1] !== c.terreno[0] ? ` – ${fechaLegible(c.terreno[1])}` : ""} · datos ${fechaLegible(c.datos)} · entrega ${fechaLegible(c.entrega)}</span></span></div>`).join("")}</div>` : '<p class="sis-tenue">Sin ciclos en los próximos 4 meses: revisa la periodicidad (primer ciclo y término).</p>'}</section>`;
    })() : ""}
      <section class="sis-tarjeta">
        <div class="sis-cab"><h2>Vuelos</h2>${ctx2.rol === "terreno" ? `<a class="sis-btn chico" href="#/vuelos/proyecto/${escapar(id)}">Planificación</a>` : ""}</div>
        ${planes.length ? `<div class="sis-lista">${planes.map((v) => `<a class="sis-fila" href="#/vuelos/plan/${escapar(v.id)}">
            <span class="sis-fila-txt"><b>${escapar(v.nombre)}</b><span class="sis-tenue">${escapar(v.dron)}</span></span>
            <span class="sis-chips">${v.resumen.area ? `<span class="sis-chip gris">${(v.resumen.area / 1e4).toLocaleString("es-CL", { maximumFractionDigits: 1 })} ha</span>` : ""}${v.resumen.gsd ? `<span class="sis-chip gris">GSD ${v.resumen.gsd.toLocaleString("es-CL", { maximumFractionDigits: 2 })} cm</span>` : ""}${v.resumen.densidad ? `<span class="sis-chip gris">${Math.round(v.resumen.densidad)} pts/m²</span>` : ""}${v.resumen.vuelos ? `<span class="sis-chip azul">${v.resumen.vuelos} vuelo${v.resumen.vuelos > 1 ? "s" : ""}</span>` : ""}</span></a>`).join("")}</div>` : '<div class="sis-vacio"><p>Sin hojas de vuelo. Desde aquí se arma la hoja: área, plan de vuelo, clima y permisos.</p></div>'}
      </section>
      <section class="sis-tarjeta">
        <div class="sis-cab"><h2>Entregas</h2>${seg ? `<a class="sis-btn chico" href="#/seguimiento/${escapar(id)}">Abrir</a>` : ctx2.rol === "terreno" && !esOficina ? `<a class="sis-btn chico" href="#/seguimiento/${escapar(id)}">+ Seguimiento</a>` : ""}</div>
        ${seg ? (() => {
      const c = seg.cuenta, pct = c.productos ? Math.round(100 * c.productosListos / c.productos) : 0;
      return `<p class="sis-tenue">${seg.ciclo ? escapar(seg.ciclo.nombre || "") + " · " : ""}${c.total - c.sinvolar}/${c.total} tramos volados · ${c.productosListos}/${c.productos} productos · ${c.ok}/${c.total} entregados</p>
          <div class="sg-mini" style="margin-top:6px"><i style="width:${pct}%"></i></div>${seg.plazo ? `<p class="sis-tenue" style="margin-top:6px">Entrega: ${fechaLegible(seg.plazo.vence)}${seg.plazo.quedan >= 0 ? ` · quedan ${seg.plazo.quedan} días hábiles` : ` · vencida hace ${-seg.plazo.quedan} días hábiles`}</p>` : ""}`;
    })() : '<div class="sis-vacio"><p>Sin seguimiento. Sirve para llevar qué tramos están volados, procesados y entregados.</p></div>'}
      </section>
      ${esOficina ? "" : `<section class="sis-tarjeta">
        <div class="sis-cab"><h2>Monografías y terreno</h2>${ctx2.rol === "terreno" ? `<a class="sis-btn chico" href="#/monografias/${escapar(id)}">Abrir</a>` : ""}</div>
        ${mono.total || mono.jornadas.length ? `<div class="sis-chips">${Object.entries(mono.porEstado).map(([e, n]) => `<span class="sis-chip ${ESTADOS[e].color}">${n} ${escapar(ESTADOS[e].texto.toLowerCase())}</span>`).join("")}</div>
          <p class="sis-tenue" style="margin-top:6px">${mono.total} monografía${mono.total === 1 ? "" : "s"} · ${mono.jornadas.length} jornada${mono.jornadas.length === 1 ? "" : "s"} de terreno${mono.jornadas[0] && mono.jornadas[0].fechaInicio ? ` · última ${fechaLegible(String(mono.jornadas[0].fechaInicio).slice(0, 10))}` : ""}</p>` : '<div class="sis-vacio"><p>Llegan desde la app de Terreno: jornadas, fotos y monografías del proyecto (botón «Enviar al Sistema»).</p></div>'}
      </section>`}
    </div><aside>
      <section class="sis-tarjeta">
        <h2>Equipos ${esOficina ? "asignados" : "en el proyecto"}</h2>
        ${enProyecto.length ? `<div class="sis-lista">${enProyecto.map((e) => filaEquipo(e)).join("")}</div>` : vacio2("No hay equipos asignados. Se asignan con el checklist de salida en Equipos.", '<a class="sis-btn chico" href="#/equipos">Ir a Equipos</a>')}
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
    if (!p) return vacio2("Este proyecto no existe.");
    if (p.id === OFICINA_ID) return vacio2("«Oficina» es un proyecto especial y no se edita.", '<a class="sis-btn" href="#/proyectos">Volver</a>');
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
        ${(() => {
      const per = { ...BASE_RECURRENTE, ...p.periodicidad || {}, tipo: p.periodicidad && p.periodicidad.tipo || "unico" };
      const v = (k) => {
        var _a;
        return escapar((_a = per[k]) != null ? _a : "");
      };
      return `<fieldset class="sis-periodicidad"><legend>Periodicidad</legend>
          <div class="sis-opciones"><label class="sis-opcion"><input type="radio" name="perTipo" value="unico" ${per.tipo !== "recurrente" ? "checked" : ""}> Único (una entrega)</label><label class="sis-opcion"><input type="radio" name="perTipo" value="recurrente" ${per.tipo === "recurrente" ? "checked" : ""}> Recurrente (servicio que se repite)</label></div>
          <div class="sis-per-rec">
            <div class="sis-par"><label class="sis-campo"><span>Se repite cada</span><span class="sis-en-linea"><input type="number" name="perCada" min="1" max="12" value="${v("cada")}"><select name="perUnidad"><option value="mes" ${per.unidad !== "semana" ? "selected" : ""}>mes(es)</option><option value="semana" ${per.unidad === "semana" ? "selected" : ""}>semana(s)</option></select></span></label>
              <label class="sis-campo"><span>Primer ciclo (mes o lunes de inicio)</span><input name="perDesde" value="${v("desde")}" placeholder="2025-10 o 2026-11-02"></label></div>
            <div class="sis-par"><label class="sis-campo"><span>N° de mes del contrato del primer ciclo</span><input type="number" name="perMesInicial" min="1" value="${v("mesInicial")}"></label>
              <label class="sis-campo"><span>Terreno (servicio mensual): parte en la</span><select name="perSemana">${SEMANAS.map(([k, t]) => `<option value="${k}" ${per.semana === k ? "selected" : ""}>${t}</option>`).join("")}</select></label></div>
            <div class="sis-par"><label class="sis-campo"><span>Días de terreno (hábiles)</span><input type="number" name="perDias" min="1" max="20" value="${v("diasTerreno")}"></label>
              <label class="sis-campo"><span>Los datos llegan</span><select name="perDatos">${DATOS.map(([k, t]) => `<option value="${k}" ${per.datos === k ? "selected" : ""}>${t}</option>`).join("")}</select></label></div>
            <div class="sis-par"><label class="sis-campo"><span>Entrega: días hábiles después de los datos</span><input type="number" name="perEntrega" min="0" max="60" value="${v("diasEntrega")}"></label>
              <label class="sis-campo"><span>Hasta (vacío: sin término)</span><input type="date" name="perHasta" value="${v("hasta")}"></label></div>
            <p class="sis-tenue">Cada ciclo aparece en el Calendario (terreno, llegada de datos y entrega) y, al crear el mes en Seguimiento, toma su nombre, N° de mes y fecha de llegada de los datos. Días hábiles = lunes a viernes.</p>
          </div></fieldset>`;
    })()}
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
    ${ctx2.estado.vincular ? await tarjetaVincular(lista.find((x) => x.id === ctx2.estado.vincular)) : ""}
    <section class="sis-tarjeta">${lista.length ? `<div class="sis-lista">${lista.map((x) => `<div class="sis-fila">
        <span class="sis-fila-txt"><b>${escapar(x.nombre)}</b><span class="sis-tenue">${escapar(x.cargo || "Sin cargo")}</span></span>
        <span class="sis-chips">${(x.roles || []).map((r) => `<span class="sis-chip gris">${escapar(NOMBRE_ROL_PERSONA[r] || r)}</span>`).join("")}
        <button class="sis-btn chico" data-accion="vincular" data-id="${escapar(x.id)}">Vincular teléfono</button>
        ${editable ? `<button class="sis-btn chico" data-accion="editar-persona" data-id="${escapar(x.id)}">Editar</button>` : ""}</span></div>`).join("")}</div>` : vacio2("Aún no hay personas.")}</section>
    ${editable ? "" : '<p class="sis-tenue">Solo Administración / RRHH edita esta lista.</p>'}
    <section class="sis-tarjeta" id="empresa"><h2>Empresa</h2>
      <form class="sis-form" data-form="empresa">
        <label class="sis-campo"><span>Nombre que aparece arriba</span><input name="nombre" value="${escapar(ctx2.marca.nombre)}" maxlength="40"></label>
        <div class="sis-campo"><span>Color de marca</span><div class="sis-colores">${COLORES_MARCA.map(([c, t]) => `<label class="sis-color"><input type="radio" name="color" value="${c}" ${ctx2.marca.color === c ? "checked" : ""}><i style="background:${c}"></i>${t}</label>`).join("")}</div></div>
        <div class="sis-acciones"><button class="sis-btn primario">Guardar</button></div>
        <p class="sis-tenue">Por ahora se guarda en este equipo (teléfono o computador). Cuando el Sistema esté en el Nextcloud de la empresa, lo define RRHH para todos, junto con el logo.</p>
      </form></section>`;
  }
  var LETRAS_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  var nuevoCodigo = () => Array.from({ length: 6 }, () => LETRAS_CODIGO[Math.floor(Math.random() * LETRAS_CODIGO.length)]).join("");
  var leerLS3 = (k, d = "") => {
    try {
      return localStorage.getItem(k) || d;
    } catch {
      return d;
    }
  };
  var urlTerreno = () => resolverUrlTerreno(leerLS3("env_terreno_url"), location.href);
  async function tarjetaVincular(p) {
    if (!p) return "";
    const n = estado();
    const base = urlTerreno().split("#")[0];
    const u = new URL(base);
    if (n.carpetaId) u.searchParams.set("carpeta", n.carpetaId);
    const enlace = `${u.toString()}#vincular=${p.codigoVinculo}`;
    let qr = '<p class="sis-tenue">No se pudo generar el QR (falta vendor/qrcode.js).</p>';
    try {
      if (!globalThis.qrcode) await cargarScript("vendor/qrcode.js");
      const q = globalThis.qrcode(0, "M");
      q.addData(enlace);
      q.make();
      qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
    } catch (e) {
      console.warn(e);
    }
    return `<section class="sis-tarjeta sis-vincular"><div class="sis-cab"><h2>Vincular teléfono · ${escapar(p.nombre)}</h2><button class="sis-btn chico" data-accion="cerrar-vincular">Cerrar</button></div>
    <div class="sis-vincular-cuerpo">
      <div class="sis-qr" role="img" aria-label="Código QR para vincular la app de Terreno">${qr}</div>
      <div>
        <p>Escanea con la cámara del teléfono. Se abre la app de Terreno ya vinculada a <b>${escapar(p.nombre)}</b>: sus proyectos, sus equipos en terreno y el botón para avisar un problema de un equipo.</p>
        <p>Si el QR no se puede leer, en la app de Terreno escribe el código:</p>
        <p class="sis-codigo">${escapar(p.codigoVinculo)}</p>
        ${n.carpetaId ? '<p class="sis-tenue">El QR lleva la carpeta de la nube: el teléfono trae los datos al conectarse con Google.</p>' : '<div class="sis-aviso-linea">La nube no está conectada en este equipo: el QR funciona solo en este mismo navegador. Conecta la nube para vincular otro teléfono.</div>'}
        <form class="sis-form" data-form="terreno-url"><label class="sis-campo"><span>Dirección de la app de Terreno</span><input name="url" value="${escapar(leerLS3("env_terreno_url").includes("paquete-conexion/ejemplo.html") ? "" : leerLS3("env_terreno_url"))}" placeholder="${escapar(urlTerreno())}"></label>
          <div class="sis-acciones"><button class="sis-btn chico">Guardar dirección</button><button type="button" class="sis-btn chico" data-accion="nuevo-codigo" data-id="${escapar(p.id)}">Cambiar código</button></div>
          <p class="sis-tenue">Déjala vacía para usar la app de Terreno publicada junto al Sistema (carpeta terreno/).</p></form>
      </div>
    </div></section>`;
  }
  var claveVistos = (pid) => `env_avisos_vistos_${pid || "nadie"}`;
  var leerVistos = (pid) => {
    try {
      return new Set(JSON.parse(localStorage.getItem(claveVistos(pid)) || "[]"));
    } catch {
      return /* @__PURE__ */ new Set();
    }
  };
  var guardarVistos = (pid, set) => {
    try {
      localStorage.setItem(claveVistos(pid), JSON.stringify([...set].slice(-500)));
    } catch {
    }
  };
  async function avisosPara(ctx2) {
    const [alertas, proyectos2] = await Promise.all([listarAlertas(), listarProyectos()]);
    let lista;
    if (ctx2.rol === "rrhh") lista = alertas;
    else if (!ctx2.personaId) lista = [];
    else {
      const mios = new Set(proyectos2.filter((p) => p.encargadoId === ctx2.personaId).map((p) => p.id));
      lista = alertas.filter((a) => mios.has(a.proyectoId) || a.reportadaPor === ctx2.personaId);
    }
    const vistos = leerVistos(ctx2.personaId || ctx2.rol);
    return { lista, nuevos: lista.filter((a) => !vistos.has(a.id)).length, vistos, proyectos: proyectos2 };
  }
  async function avisos(ctx2) {
    const { lista, vistos, proyectos: proyectos2 } = await avisosPara(ctx2);
    const personas2 = await listarPersonas();
    const nomPers = (id) => (personas2.find((x) => x.id === id) || {}).nombre || "Sin nombre";
    const nomProy = (id) => (proyectos2.find((x) => x.id === id) || {}).nombre || "Sin proyecto";
    const ESTADO = { abierta: "Abierta", mantencion: "En mantención", recibida: "Recibida" };
    guardarVistos(ctx2.personaId || ctx2.rol, /* @__PURE__ */ new Set([...vistos, ...lista.map((a) => a.id)]));
    return `<div class="sis-cab"><h1>Avisos de equipos</h1></div>
    <p class="sis-tenue">${ctx2.rol === "rrhh" ? "Problemas y avisos de todos los equipos." : "Problemas y avisos de equipos en tus proyectos (donde eres el encargado)."} Llegan desde la app de Terreno por la nube. Los estados se cambian en Equipos → Alertas.</p>
    ${ctx2.rol !== "rrhh" && !ctx2.personaId ? vacio2("Elige quién eres arriba para ver los avisos de tus proyectos.") : ""}
    <section class="sis-tarjeta">${lista.length ? `<div class="sis-lista">${lista.map((a) => `<a class="sis-fila${vistos.has(a.id) ? "" : " sis-nuevo"}" href="#/equipos/${escapar(a.equipoId)}">
        <span class="sis-fila-txt"><b>${escapar(a.equipo)}</b><span>${escapar(a.descripcion || "")}</span>
          <span class="sis-tenue">${escapar(nomProy(a.proyectoId))} · ${escapar(nomPers(a.reportadaPor))} · ${escapar(fechaHoraLegible(a.fechaReporte))}${a.origen === "app-terreno" ? " · desde Terreno" : ""}</span></span>
        <span class="sis-chips">${vistos.has(a.id) ? "" : '<span class="sis-chip azul">Nuevo</span>'}<span class="sis-chip ${a.tipo === "aviso" ? "ambar" : "rojo"}">${a.tipo === "aviso" ? "Aviso" : "Problema"}</span><span class="sis-chip gris">${escapar(ESTADO[a.estado] || a.estado)}</span></span></a>`).join("")}</div>` : vacio2("No hay avisos abiertos.")}</section>`;
  }
  var PRONTO = {
    gastos: { titulo: "Gastos", version: "una próxima versión", texto: "Cada gasto con la foto de su boleta, dentro de su proyecto (o en «Oficina»). La rendición pasa por borrador → emitida → devuelta → abonada, y RRHH registra el abono. Las boletas quedan respaldadas en la carpeta del proyecto." },
    terreno: { titulo: "Libreta de terreno", version: "una próxima versión", texto: "Terreno Topografía entra al Sistema: jornadas y levantamientos dentro de cada proyecto, con los equipos que salieron en el checklist. Mientras tanto, sigue usando la app de Terreno por separado." }
  };
  function pronto(ctx2, clave2) {
    const x = PRONTO[clave2];
    return `<section class="sis-tarjeta sis-pronto grande"><h1>${x.titulo}</h1><p><span class="sis-chip ambar">Llega en ${x.version}</span></p><p>${x.texto}</p></section>`;
  }
  var VISTAS = { inicio, proyectos, proyecto, proyectoEditar, personas, pronto, avisos };
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
    if (form.dataset.form === "terreno-url") {
      const u = (datos.get("url") || "").trim();
      try {
        if (u) {
          new URL(u);
          localStorage.setItem("env_terreno_url", u);
        } else localStorage.removeItem("env_terreno_url");
      } catch {
        throw new Error("La dirección debe empezar con https://");
      }
      ctx2.avisar("Dirección guardada");
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
        periodicidad: datos.get("perTipo") === "recurrente" ? {
          tipo: "recurrente",
          cada: Math.max(1, Number(datos.get("perCada")) || 1),
          unidad: datos.get("perUnidad") === "semana" ? "semana" : "mes",
          desde: (datos.get("perDesde") || "").trim(),
          mesInicial: Math.max(1, Number(datos.get("perMesInicial")) || 1),
          semana: datos.get("perSemana") || "ultima",
          diasTerreno: Math.max(1, Number(datos.get("perDias")) || 1),
          datos: datos.get("perDatos") || "lunes",
          diasEntrega: Math.max(0, Number(datos.get("perEntrega")) || 0),
          hasta: datos.get("perHasta") || ""
        } : { tipo: "unico" },
        notas: (datos.get("notas") || "").trim()
      }, { personaId: ctx2.personaId });
      ctx2.avisar(id ? "Proyecto guardado" : "Proyecto creado");
      ctx2.ir(`#/proyecto/${r.id}`);
      return false;
    }
    return false;
  }
  var escribirLS3 = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
    }
  };
  async function manejarClic(boton, ctx2) {
    const cal = () => ctx2.estado.cal = ctx2.estado.cal || { modo: leerLS3("env_cal_modo") || "mes", ref: hoyISO(), proyecto: "" };
    switch (boton.dataset.accion) {
      case "vista-proyectos":
        escribirLS3("env_proyectos_vista2", boton.dataset.v);
        return true;
      case "ver-calendario":
        cal().proyecto = location.hash.split("/")[2] || "";
        ctx2.ir("#/proyectos/calendario");
        return false;
      case "ver-mandante":
        ctx2.estado.mandante = boton.dataset.m;
        return true;
      case "exportar-registro": {
        const filas = await datosRegistro();
        const c = (v) => `"${String(v != null ? v : "").replace(/"/g, '""')}"`;
        const csv = [
          ["Mandante", "Proyecto", "Comuna", "Región", "Tipos", "Encargo", "Cierre", "Plazo (días)", "Vuelos", "Superficie (ha)", "Longitud (km)"].map(c).join(";"),
          ...filas.sort((a, b) => a.mandante.localeCompare(b.mandante) || (a.fin || "").localeCompare(b.fin || "")).map((f) => [f.mandante, f.p.nombre, f.p.comuna, f.p.region, f.tipos, f.ini, f.fin, f.dias, f.vuelos, f.ha.toFixed(1).replace(".", ","), f.km.toFixed(2).replace(".", ",")].map(c).join(";"))
        ].join("\r\n");
        descargar(`Registro_por_mandante_${hoyISO()}.csv`, "\uFEFF" + csv, "text/csv;charset=utf-8");
        ctx2.avisar("Registro exportado");
        return false;
      }
      case "etapa-proyecto": {
        const p = await obtenerProyecto(boton.dataset.id), e = boton.dataset.e;
        if (!p || !NOMBRE_ETAPA_PROYECTO[e]) return false;
        if (e === "completado" && !confirm(`¿Marcar «${p.nombre}» como completado?

Sale de los proyectos activos y queda en el registro de ${p.mandante || "su mandante"}.`)) return false;
        await guardarProyecto({ id: p.id, etapa: e, etapas: { ...p.etapas || {}, [e]: hoyISO() }, estado: e === "completado" ? "cerrado" : "activo" }, { personaId: ctx2.personaId });
        ctx2.avisar(`${p.nombre}: ${NOMBRE_ETAPA_PROYECTO[e].toLowerCase()}`);
        return true;
      }
      case "cal-modo":
        cal().modo = boton.dataset.modo;
        escribirLS3("env_cal_modo", boton.dataset.modo);
        return true;
      case "cal-mover":
        cal().ref = mover(cal(), Number(boton.dataset.d));
        return true;
      case "cal-ir":
        cal().ref = boton.dataset.ref;
        if (boton.dataset.modo) cal().modo = boton.dataset.modo;
        return true;
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
      case "vincular":
      case "nuevo-codigo": {
        const p = await obtenerPersona(boton.dataset.id);
        if (p && (!p.codigoVinculo || boton.dataset.accion === "nuevo-codigo")) await guardarPersona({ id: p.id, codigoVinculo: nuevoCodigo() }, { personaId: ctx2.personaId });
        if (boton.dataset.accion === "nuevo-codigo") ctx2.avisar("Código cambiado: el anterior ya no sirve");
        ctx2.estado.vincular = boton.dataset.id;
        return true;
      }
      case "cerrar-vincular":
        ctx2.estado.vincular = null;
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
        await guardarProyecto(p.estado === "cerrado" ? { id: p.id, estado: "activo", etapa: "gabinete" } : { id: p.id, estado: "cerrado", etapa: "completado", etapas: { ...p.etapas || {}, completado: hoyISO() } }, { personaId: ctx2.personaId });
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
    if (input.dataset.accion === "cal-proyecto") {
      ctx2.estado.cal = { ...ctx2.estado.cal || { modo: "mes", ref: hoyISO() }, proyecto: input.value };
      return true;
    }
    return false;
  }

  // app/revision.js
  async function revisarInstalacion(versionApp) {
    if (!location.protocol.startsWith("http") || navigator.onLine === false) return null;
    let v;
    try {
      const r = await fetch("version.json", { cache: "no-store" });
      if (!r.ok) return { texto: "No se encontró version.json en el sitio: la última subida puede estar incompleta." };
      v = await r.json();
    } catch {
      return null;
    }
    const faltan = [];
    await Promise.all((v.archivos || []).map(async (a) => {
      try {
        const x = await fetch(a, { method: "HEAD", cache: "no-store" });
        if (!x.ok) faltan.push(a.replace(/^\.\//, ""));
      } catch {
      }
    }));
    if (faltan.length) return { texto: `${faltan.length > 1 ? "Faltan" : "Falta"} ${faltan.length} archivo${faltan.length > 1 ? "s" : ""} en el sitio publicado: ${faltan.slice(0, 4).join(", ")}${faltan.length > 4 ? "…" : ""}. Vuelve a subir la versión completa, con sus carpetas.` };
    if (v.version !== versionApp) return { texto: `El sitio tiene la versión ${v.version} y esta pantalla es la ${versionApp}.`, recargar: true };
    return null;
  }
  function mostrarAvisoInstalacion(aviso) {
    if (!aviso) return;
    const el = document.createElement("div");
    el.className = "sis-aviso-instalacion";
    el.setAttribute("role", "alert");
    el.innerHTML = `<span></span>${aviso.recargar ? '<button type="button" class="sis-btn chico">Recargar</button>' : ""}<button type="button" class="sis-cerrar" aria-label="Cerrar aviso">✕</button>`;
    el.querySelector("span").textContent = aviso.texto;
    el.addEventListener("click", (ev) => {
      if (ev.target.closest(".sis-cerrar")) el.remove();
      else if (ev.target.closest(".sis-btn")) location.reload();
    });
    document.body.prepend(el);
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
    seguimiento: ic('<path d="M4 18h4V9H4zM10 18h4V5h-4zM16 18h4v-6h-4z"/><path d="M3 21h18"/>'),
    monografias: ic('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><circle cx="12" cy="13" r="2.5"/><path d="M12 10.5V9M12 17v-1.5"/>'),
    gastos: ic('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
    terreno: ic('<path d="M4 20l5-14 5 9 3-5 3 10z"/>'),
    herramientas: ic('<path d="M14.7 6.3a4 4 0 00-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 005.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'),
    personas: ic('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.8c1.9.8 3.1 2.6 3.5 5.2"/>'),
    mas: ic('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>')
  };
  var MENU = [
    { ruta: "inicio", texto: "Inicio", roles: ["terreno", "rrhh"], tambien: ["avisos"] },
    { ruta: "proyectos", texto: "Proyectos", roles: ["terreno", "rrhh"], tambien: ["proyecto", "proyecto-editar", "seguimiento"] },
    { ruta: "vuelos", texto: "Vuelos", roles: ["terreno"] },
    { ruta: "equipos", texto: "Equipos", roles: ["terreno", "rrhh"], tambien: ["sensores"] },
    { ruta: "herramientas", texto: "Herramientas", roles: ["terreno"], tambien: ["monografias"] },
    { ruta: "personas", texto: "Personas", roles: ["rrhh", "terreno"] },
    { ruta: "gastos", texto: "Gastos", roles: ["terreno", "rrhh"], pronto: true }
  ];
  var SUBNAV = {
    proyectos: [
      ["#/proyectos", "Activos", (r) => ["proyectos", "proyecto", "proyecto-editar"].includes(r.base) && !["calendario", "registro"].includes(r.arg)],
      ["#/proyectos/calendario", "Calendario", (r) => r.base === "proyectos" && r.arg === "calendario"],
      ["#/seguimiento", "Entregas", (r) => r.base === "seguimiento"],
      ["#/proyectos/registro", "Registro por mandante", (r) => r.base === "proyectos" && r.arg === "registro"]
    ],
    equipos: [
      ["#/equipos", "Equipos", (r) => r.base === "equipos"],
      ["#/sensores", "Catálogo de sensores", (r) => r.base === "sensores"]
    ],
    herramientas: [
      ["#/monografias", "Monografías", (r) => r.base === "monografias"],
      ["#/herramientas/kml", "Limpieza de KMZ", (r) => r.base === "herramientas" && r.arg === "kml"],
      ["#/herramientas/pronostico", "Pronóstico rápido", (r) => r.base === "herramientas" && r.arg === "pronostico"]
    ]
  };
  function htmlSubnav(item, ruta) {
    const subs = SUBNAV[item.ruta];
    if (!subs) return "";
    return `<nav class="sis-subnav" aria-label="${item.texto}">${subs.map(([href, t, act]) => `<a href="${href}" class="${act(ruta) ? "activo" : ""}"${act(ruta) ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>`;
  }
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
  async function pintarAvisos() {
    const b = $("sis-avisos");
    if (!b) return;
    try {
      const { nuevos, lista } = await avisosPara(ctx());
      b.hidden = !lista.length && selRol.value !== "rrhh";
      b.querySelector("b").textContent = nuevos || "";
      b.classList.toggle("con-nuevos", nuevos > 0);
      b.setAttribute("aria-label", nuevos ? `${nuevos} aviso${nuevos > 1 ? "s" : ""} nuevo${nuevos > 1 ? "s" : ""} de equipos` : "Avisos de equipos");
    } catch (e) {
      console.warn(e);
    }
  }
  async function mostrar() {
    const { base, arg } = leerRuta();
    const item = MENU.find((m) => m.ruta === base || (m.tambien || []).includes(base));
    if (!item || !item.roles.includes(selRol.value)) {
      location.hash = "#/inicio";
      return;
    }
    if (base === "herramientas" && !arg) {
      location.hash = "#/monografias";
      return;
    }
    pintarMenu(base);
    pintarAvisos();
    const clave2 = `${base}/${arg || ""}/${selRol.value}/${selPersona.value}`;
    const subnav = htmlSubnav(item, { base, arg });
    const lugarModulo = () => {
      desmontar();
      contenedor.innerHTML = `${subnav}<div class="sis-modulo"></div>`;
      contenedor.dataset.vista = "modulo";
      return contenedor.querySelector(".sis-modulo");
    };
    if (base === "herramientas" || base === "sensores") {
      const tab = base === "sensores" ? "drones" : arg === "kml" ? "kml" : "rapido";
      montado = montar3(lugarModulo(), { rol: selRol.value, personaId: selPersona.value || null, tab });
      rutaActual = clave2;
      window.scrollTo(0, 0);
      return;
    }
    if (base === "vuelos") {
      const partes = location.hash.replace(/^#\/?/, "").split("/");
      montado = montar3(lugarModulo(), {
        rol: selRol.value,
        personaId: selPersona.value || null,
        planId: partes[1] === "plan" ? partes[2] : null,
        proyectoId: partes[1] === "proyecto" ? partes[2] : null
      });
      rutaActual = clave2;
      window.scrollTo(0, 0);
      return;
    }
    if (base === "seguimiento") {
      const partes = location.hash.replace(/^#\/?/, "").split("/");
      montado = montar2(lugarModulo(), { rol: selRol.value, personaId: selPersona.value || null, proyectoId: partes[1] || null, tab: partes[2] || null });
      rutaActual = clave2;
      window.scrollTo(0, 0);
      return;
    }
    if (base === "monografias") {
      const partes = location.hash.replace(/^#\/?/, "").split("/");
      montado = montar4(lugarModulo(), { rol: selRol.value, personaId: selPersona.value || null, proyectoId: partes[1] || null, monografiaId: partes[2] || null });
      rutaActual = clave2;
      window.scrollTo(0, 0);
      return;
    }
    if (base === "equipos") {
      montado = montar(lugarModulo(), { rol: selRol.value, personaId: selPersona.value || null, equipoInicial: arg });
      rutaActual = clave2;
      window.scrollTo(0, 0);
      return;
    }
    desmontar();
    const cambioDePantalla = !rutaActual.startsWith(`${base}/${arg || ""}/`);
    rutaActual = clave2;
    contenedor.dataset.vista = "sistema";
    if (cambioDePantalla) window.scrollTo(0, 0);
    try {
      let html;
      if (base === "gastos" || base === "terreno") html = VISTAS.pronto(ctx(), base);
      else if (base === "proyecto") html = await VISTAS.proyecto(ctx(), arg);
      else if (base === "proyecto-editar") html = await VISTAS.proyectoEditar(ctx(), arg || "nuevo");
      else if (base === "proyectos") html = await VISTAS.proyectos(ctx(), arg);
      else html = await VISTAS[base](ctx());
      if (rutaActual !== clave2) return;
      contenedor.innerHTML = `${subnav}<div class="sis-vista">${html}</div>`;
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
    const i = ev.target.closest("input[data-accion], select[data-accion]");
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
    iniciar4({ personaId: selPersona.value || null });
    iniciar3({ personaId: selPersona.value || null });
    iniciar5({ personaId: selPersona.value || null });
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
        pintarAvisos();
        if (montado && montado.refrescar) montado.refrescar();
        else if (!contenedor.querySelector("form")) {
          rutaActual = "";
          mostrar();
        }
      }
    });
    window.__sistemaCargado = true;
    revisarInstalacion(VERSION_SISTEMA).then(mostrarAvisoInstalacion).catch(() => {
    });
  }
  arrancar().catch((err) => {
    console.error(err);
    contenedor.innerHTML = `<div class="sis-error">No se pudo iniciar el Sistema: ${String(err.message || err).replace(/</g, "&lt;")}</div>`;
  });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service worker no registrado:", err));
  }
})();
