/* pronostico-vuelo.js — GENERADO desde Sistema Topoland · modulos/vuelos. No editar aquí. */
var PronosticoVuelo = (() => {
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

  // modulos/vuelos/pronostico-widget.js
  var pronostico_widget_exports = {};
  __export(pronostico_widget_exports, {
    DRONES: () => DRONES,
    VERSION: () => VERSION,
    analizarDia: () => analizarDia,
    montar: () => montar,
    piezas: () => piezas
  });

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

  // vendor/capas/metar-estaciones.json
  var metar_estaciones_default = { fuente: "NOAA AviationWeather.gov · stationinfo", fecha: "2026-11-02", campos: ["icao", "nombre", "lat", "lon", "elev", "emite (M=METAR, T=TAF)"], estaciones: [["SACP", "Chepes", -31.333, -66.6, 663, "M"], ["SACT", "Gobernador Gordillo", -30.349, -66.295, 454, "M"], ["SAME", "Mendoza/Plumerillo Arpt", -32.832, -68.793, 709, "MT"], ["SAMI", "San Martin", -33.083, -68.417, 653, "M"], ["SAMJ", "Jachal", -30.25, -68.74, 1168, "M"], ["SAMM", "Malargue Arpt", -35.481, -69.583, 1428, "M"], ["SAMR", "San Rafael Arpt", -34.585, -68.414, 756, "MT"], ["SAMS", "San Carlos", -33.771, -69.034, 951, "M"], ["SAMU", "Uspallata", -32.601, -69.335, 1918, "M"], ["SANI", "Tinogasta", -28.041, -67.577, 1225, "M"], ["SANL", "La Rioja/Capt Vincen", -29.383, -66.795, 438, "MT"], ["SANO", "Chilecito", -29.224, -67.439, 918, "M"], ["SANU", "San Juan Arpt", -31.572, -68.418, 596, "MT"], ["SAOU", "San Luis Arpt", -33.273, -66.356, 704, "MT"], ["SAVB", "El Bolson Arpt", -41.948, -71.533, 332, "M"], ["SAVC", "Comodoro Rivadavia Arpt", -45.79, -67.471, 58, "MT"], ["SAVE", "Esquel Arpt", -42.906, -71.147, 799, "MT"], ["SAVP", "Paso De Indios", -43.856, -69.044, 514, "M"], ["SAWA", "Lago Argentino Arpt", -50.327, -72.276, 182, "M"], ["SAWC", "El Calafate Arpt", -50.284, -72.052, 204, "MT"], ["SAWE", "Rio Grande/Quijada Intl", -53.781, -67.754, 22, "MT"], ["SAWG", "Rio Gallegos Intl", -51.609, -69.306, 18, "MT"], ["SAWH", "Ushuaia/Malvinas Arpt", -54.844, -68.308, 22, "MT"], ["SAWJ", "San Julian Aero", -49.307, -67.803, 48, "M"], ["SAWP", "Perito Moreno Arpt", -46.537, -70.983, 429, "M"], ["SAWR", "Gobernador Gregores", -48.783, -70.167, 357, "M"], ["SAWU", "Santa Cruz Arpt", -50.017, -68.579, 113, "M"], ["SAZN", "Neuquen Arpt", -38.95, -68.141, 273, "MT"], ["SAZS", "San Carlos de Bariloche Arpt", -41.151, -71.157, 843, "MT"], ["SAZY", "Chapelco", -40.075, -71.137, 783, "MT"], ["SCAP", "Alto Palena Arpt", -43.612, -71.802, 252, "M"], ["SCAR", "Arica/Chacalluta Arpt", -18.351, -70.336, 57, "MT"], ["SCAS", "Puerto Aysen Arpt", -45.399, -72.67, 8, "M"], ["SCAT", "Desierto Atacama Arpt", -27.262, -70.774, 209, "MT"], ["SCBA", "Balmaceda/Vidal Arpt", -45.913, -71.694, 516, "MT"], ["SCCC", "Chile Chico Arpt", -46.581, -71.693, 305, "M"], ["SCCF", "Calama/El Loa Intl", -22.496, -68.905, 2290, "MT"], ["SCCH", "Chillan/OHiggins Arpt", -36.583, -72.031, 148, "MT"], ["SCCI", "Punta Arenas Arpt", -53.003, -70.855, 37, "MT"], ["SCCY", "Coyhaique/Vidal Arpt", -45.595, -72.11, 301, "MT"], ["SCDA", "Iquique/Diego Aracena Arpt", -20.535, -70.181, 41, "MT"], ["SCEL", "Santiago/Benítez Intl", -33.393, -70.786, 478, "MT"], ["SCER", "Quintero Santia", -32.79, -71.522, 15, "M"], ["SCFA", "Antofagasta/Sabella Arpt", -23.45, -70.441, 113, "MT"], ["SCFM", "Porvenir/Martinez Arpt", -53.254, -70.319, 28, "MT"], ["SCFT", "Futaleufú Arpt", -43.189, -71.853, 345, "M"], ["SCGE", "Los Angeles/Dolores", -37.403, -72.422, 122, "MT"], ["SCGZ", "Guardiamarina/Zahart", -54.932, -67.631, 21, "MT"], ["SCHA", "Copiapo Arpt", -27.296, -70.414, 301, "MT"], ["SCHR", "Cochrane Arpt", -47.244, -72.586, 203, "MT"], ["SCIC", "Curico/Freire Arpt", -34.966, -71.217, 230, "MT"], ["SCIE", "Concepcion/Sur Intl", -36.773, -73.063, 8, "MT"], ["SCJO", "Osorno/Siebert Arpt", -40.605, -73.061, 61, "MT"], ["SCLL", "Vallenar Arpt", -28.596, -70.756, 538, "M"], ["SCLR", "Los Alerces Arpt", -42.7809, -72.6452, 105, "M"], ["SCMK", "Melinka Arpt", -43.897, -73.741, 22, "MT"], ["SCNT", "Puerta Natales/Galla", -51.672, -72.528, 68, "MT"], ["SCON", "Puerto Quellon Arpt", -43.134, -73.633, 11, "M"], ["SCPQ", "Monopulli Arpt", -42.347, -73.718, 166, "MT"], ["SCQP", "Temuco Arpt", -38.925, -72.648, 97, "MT"], ["SCRA", "Chanaral Arpt", -26.332, -70.607, 27, "M"], ["SCRD", "Valparaiso/Rodelillo Arpt", -33.068, -71.557, 342, "MT"], ["SCRG", "Rancagua/Indepencia Arpt", -34.174, -70.776, 488, "MT"], ["SCSE", "La Serena/La Florida Arpt", -29.918, -71.201, 141, "MT"], ["SCSN", "Santo Domingo Arpt", -33.656, -71.615, 73, "MT"], ["SCTB", "Santiago/Sanchez Arpt", -33.456, -70.547, 655, "MT"], ["SCTC", "Temuco/Maquehue", -38.77, -72.637, 93, "MT"], ["SCTE", "Puerto Montt/Tepua Arpt", -41.439, -73.094, 85, "MT"], ["SCTN", "Chaitén Arpt", -42.933, -72.699, 8, "MT"], ["SCVD", "Valdivia/Pichoy Arpt", -39.65, -73.086, 19, "MT"], ["SCVM", "Concon/Vina Del Mar Arpt", -32.947, -71.479, 136, "MT"], ["SLCB", "Cochabamba/Wilstermann Intl", -17.421, -66.179, 2560, "MT"], ["SLCN", "Charaña", -17.592, -69.442, 4070, "M"], ["SLOR", "Oruro/Mendoza Arpt", -17.962, -67.077, 3720, "MT"], ["SLUY", "Andina Intl", -20.4413, -66.8576, 3394, "M"], ["SPLO", "Ilo Arpt", -17.692, -71.343, 25, "MT"], ["SPTN", "Tacna Arpt", -18.049, -70.277, 459, "MT"]] };

  // modulos/vuelos/metar.js
  var NUDO = 0.514444;
  var PIE = 0.3048;
  var MILLA = 1609.34;
  var RUMBOS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  var estaciones = null;
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
  function representatividad(est, elevArea = null) {
    const motivos = [];
    if (est.km > 50) motivos.push(`está a ${Math.round(est.km)} km`);
    if (elevArea != null && Math.abs(elevArea - est.elev) > 500) motivos.push(`${Math.round(Math.abs(elevArea - est.elev))} m de diferencia de altura`);
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
  function decodificarUno(texto, ahora = /* @__PURE__ */ new Date()) {
    const t = String(texto).replace(/=+\s*$/, "").trim();
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
  function decodificar(texto, ahora = /* @__PURE__ */ new Date()) {
    const limpio = String(texto || "").replace(/\r/g, "");
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
  function horaLocal(fecha) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(fecha).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:00`;
  }
  var horaTexto = (f) => f.toLocaleString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
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
        const fila = horasPron ? horasPron.find((h) => h.t === horaLocal(m.hora)) : null;
        const comp = comparar(m, dron, fila);
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

  // compartido/util.js
  function escapar(t) {
    return String(t != null ? t : "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // modulos/vuelos/calculo.js
  function fmt(n, dec = 0) {
    if (n == null || !isFinite(n)) return "—";
    return n.toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });
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
    const svg = `<svg class="vu-graf-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Viento a 120 m por hora: barras de viento sostenido, línea de ráfaga y límites del dron">${partes.join("")}</svg>`;
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
    return `<div class="vu-graf" style="--ancho:${W}px"><div class="vu-graf-interior" style="width:${W}px">${svg}${filasHtml}</div></div>`;
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

  // modulos/vuelos/pronostico-widget.js
  var VERSION = "1.1 (Vuelos 0.5)";
  var DRONES = DRONES_BASE.map((d) => ({ id: d.id, nombre: d.nombre, vientoMaxMs: d.vientoMaxMs, rafagaMaxMs: d.rafagaMaxMs }));
  var piezas = { pedirPronostico, pedirKp, kpEnHora, evaluarHora, elevacionSol, cercanas, decodificar, comparar, graficoPronostico, checklistClima };
  var esc2 = (s) => String(s != null ? s : "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var dos = (n) => String(n).padStart(2, "0");
  var DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  var fechaCorta = (iso) => {
    const d = /* @__PURE__ */ new Date(iso + "T12:00:00");
    return `${DIAS[d.getDay()]} ${d.getDate()}`;
  };
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
  function montar(el, opciones = {}) {
    const o = { dronId: "m4e", ...opciones };
    const st = { pron: null, kps: null, metar: opciones.ultimo && opciones.ultimo.metar && opciones.ultimo.metar.texto ? opciones.ultimo.metar : null, dia: null, cargando: false, error: "" };
    const dron = () => o.dron || DRONES.find((d) => d.id === o.dronId) || DRONES[0];
    el.classList.add("pv");
    function resumen() {
      var _a;
      if (!st.pron) return null;
      const b = analizarDia(st.pron, dron(), st.kps, st.dia);
      const raf = b.filas.filter((f) => f.h.g != null && f.ev.estado !== "noche").sort((x, y) => y.h.g - x.h.g)[0];
      return {
        consultadoEn: (/* @__PURE__ */ new Date()).toISOString(),
        fecha: st.dia,
        lat: st.pron.lat,
        lon: st.pron.lon,
        lugar: o.lugar || "",
        dron: dron().id,
        ventana: b.ventana ? `${dos(b.ventana[0])}:00–${dos(b.ventana[1] + 1)}:00` : "",
        rafaga: raf ? { v: raf.h.g, hora: raf.h.hora } : null,
        kpMax: b.kpMax,
        sol: b.sol && b.sol.salida ? [b.sol.salida.slice(11, 16), b.sol.puesta ? b.sol.puesta.slice(11, 16) : "—"] : null,
        modelos: ((_a = st.pron.horas[0]) == null ? void 0 : _a.modelos) || 0,
        checklist: b.checklist,
        horas: b.filas.map((f) => ({ hora: f.h.hora, v: f.h.v, g: f.h.g, dir: f.h.dir, prob: f.h.prob, nubes: f.h.nubes, temp: f.h.temp, kp: f.kp, estado: f.ev.estado })),
        metar: st.metar
        // { texto, leidoEn }: el METAR pegado
      };
    }
    const checklistHtml = (chk, titulo) => `<div class="pv-caja"><h3>${esc2(titulo)}</h3><ul class="pv-chk">${chk.map((x) => `<li class="${x.cumple ? "si" : "no"}"><span>${esc2(x.texto)}</span><b>${esc2(x.detalle)}</b></li>`).join("")}</ul></div>`;
    const metarHtml = () => `<div class="pv-caja">${htmlPanelMetar({ lat: o.lat, lon: o.lon, elevArea: st.pron ? st.pron.elevacionModelo : null, guardado: st.metar, dron: dron(), horasPron: st.pron ? st.pron.horas : null, acc: "data-pv" })}</div>`;
    function render() {
      const d = dron();
      const cab = `<div class="pv-cab">
      <div><h2>Pronóstico de vuelo</h2>${o.lugar ? `<p class="pv-tenue">${esc2(o.lugar)}</p>` : ""}</div>
      <div class="pv-acc">
        ${o.dron ? "" : `<select class="pv-dron" aria-label="Dron">${DRONES.map((x) => `<option value="${x.id}" ${x.id === d.id ? "selected" : ""}>${esc2(x.nombre)}</option>`).join("")}</select>`}
        <button type="button" class="pv-btn pri" data-pv="consultar" ${st.cargando || o.lat == null ? "disabled" : ""}>${st.cargando ? "Consultando…" : st.pron ? "Actualizar" : "Consultar"}</button>
      </div></div>`;
      let cuerpo = "";
      if (o.lat == null || o.lon == null) cuerpo = '<p class="pv-tenue">Falta la ubicación (centro del área o del tramo) para consultar.</p>';
      else if (st.error) cuerpo = `<div class="pv-error">${esc2(st.error)}</div>${o.ultimo ? ultimoHtml(o.ultimo) : ""}`;
      else if (st.pron) {
        const dias = [...new Set(st.pron.horas.map((x) => x.fecha))];
        if (!st.dia || !dias.includes(st.dia)) st.dia = o.fecha && dias.includes(o.fecha) ? o.fecha : dias[0];
        const b = analizarDia(st.pron, d, st.kps, st.dia);
        cuerpo = `<div class="pv-dias">${dias.map((x) => `<button type="button" class="pv-chip${x === st.dia ? " act" : ""}" data-pv="dia" data-dia="${x}">${fechaCorta(x)}${x === o.fecha ? " · vuelo" : ""}</button>`).join("")}</div>
        <div class="pv-res">
          <span class="pv-pas ${b.ventana ? "go" : "no"}">${b.ventana ? `Ventana GO ${dos(b.ventana[0])}:00 – ${dos(b.ventana[1] + 1)}:00` : "Sin ventana GO este día"}</span>
          <span class="pv-pas">Sol ${b.sol && b.sol.salida ? b.sol.salida.slice(11, 16) : "—"} – ${b.sol && b.sol.puesta ? b.sol.puesta.slice(11, 16) : "—"}</span>
          <span class="pv-pas">${b.kpMax != null ? `Kp máx. ${b.kpMax}` : "Kp sin dato"}</span>
        </div>
        ${graficoPronostico(b.filas, d)}
        <p class="pv-tenue">Barra: viento a 120 m (color = estado) · línea: ráfaga · banda gris: diferencia entre ECMWF, GFS e ICON. En valles de cordillera el viento real puede diferir.</p>
        <div class="pv-dos">${checklistHtml(b.checklist, b.ventana ? `Checklist · ventana ${dos(b.ventana[0])}–${dos(b.ventana[1] + 1)} h` : "Checklist · horas con luz")}${metarHtml()}</div>
        ${o.alGuardar ? '<button type="button" class="pv-btn" data-pv="guardar">Guardar en la jornada</button>' : ""}`;
      } else if (o.ultimo) cuerpo = ultimoHtml(o.ultimo);
      else cuerpo = '<p class="pv-tenue">Consulta los próximos 3 días: viento a 120 m, ráfagas, lluvia, nubes, temperatura y Kp.</p>';
      if (o.lat != null && !st.pron) cuerpo += metarHtml();
      el.innerHTML = cab + cuerpo + `<div class="pv-enlaces">${ENLACES_CONSULTA.map(([t, u]) => `<a class="pv-link" href="${u}" target="_blank" rel="noopener">${esc2(t)} ↗</a>`).join("")}</div>`;
    }
    function ultimoHtml(u) {
      const f = new Date(u.consultadoEn);
      return `<p class="pv-tenue">Última consulta guardada: ${f.toLocaleDateString("es-CL")} ${dos(f.getHours())}:${dos(f.getMinutes())}${u.ventana ? ` · ventana ${esc2(u.ventana)}` : ""}. Sin conexión se muestra esto.</p>${u.checklist ? checklistHtml(u.checklist, "Checklist (última consulta)") : ""}`;
    }
    async function consultar() {
      if (o.lat == null || o.lon == null) return;
      st.cargando = true;
      st.error = "";
      render();
      try {
        const [p, kps] = await Promise.all([pedirPronostico(o.lat, o.lon), st.kps ? Promise.resolve(st.kps) : pedirKp()]);
        st.pron = p;
        st.kps = kps;
      } catch (e) {
        st.pron = null;
        st.error = `No se pudo consultar el pronóstico (${e.message}). Revisa la conexión a internet.`;
      }
      st.cargando = false;
      render();
    }
    function alClick(e) {
      const b = e.target.closest("[data-pv]");
      if (!b || !el.contains(b)) return;
      if (b.dataset.pv === "consultar") consultar();
      else if (b.dataset.pv === "dia") {
        st.dia = b.dataset.dia;
        render();
      } else if (b.dataset.pv === "metar-leer") {
        const ta = el.querySelector("[data-metar-texto]");
        const t = (ta && ta.value || "").trim();
        if (!t) return;
        st.metar = { texto: t, leidoEn: (/* @__PURE__ */ new Date()).toISOString() };
        render();
        if (o.alGuardar && st.pron) {
          const r = resumen();
          if (r) o.alGuardar(r);
        }
      } else if (b.dataset.pv === "metar-borrar") {
        st.metar = null;
        render();
      } else if (b.dataset.pv === "guardar" && o.alGuardar) {
        const r = resumen();
        if (r) {
          o.alGuardar(r);
          b.textContent = "Guardado ✓";
        }
      }
    }
    function alCambiar(e) {
      if (!e.target.classList.contains("pv-dron")) return;
      o.dronId = e.target.value;
      if (o.alCambiarDron) o.alCambiarDron(o.dronId);
      render();
    }
    el.addEventListener("click", alClick);
    el.addEventListener("change", alCambiar);
    render();
    return {
      consultar,
      resumen,
      actualizar(nuevas) {
        Object.assign(o, nuevas);
        if (nuevas.lat != null || nuevas.lon != null) {
          st.pron = null;
          st.metar = null;
        }
        render();
      },
      destruir() {
        el.removeEventListener("click", alClick);
        el.removeEventListener("change", alCambiar);
        el.innerHTML = "";
        el.classList.remove("pv");
      }
    };
  }
  return __toCommonJS(pronostico_widget_exports);
})();
