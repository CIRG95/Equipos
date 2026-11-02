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

  // ../sistema/modulos/vuelos/pronostico-widget.js
  var pronostico_widget_exports = {};
  __export(pronostico_widget_exports, {
    DRONES: () => DRONES,
    VERSION: () => VERSION,
    analizarDia: () => analizarDia,
    montar: () => montar,
    piezas: () => piezas
  });

  // ../sistema/modulos/vuelos/pronostico.js
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

  // ../sistema/modulos/vuelos/metar.js
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

  // ../sistema/compartido/util.js
  function escapar(t) {
    return String(t != null ? t : "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // ../sistema/modulos/vuelos/calculo.js
  function fmt(n, dec = 0) {
    if (n == null || !isFinite(n)) return "—";
    return n.toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  // ../sistema/modulos/vuelos/graficos.js
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

  // ../sistema/modulos/vuelos/drones.js
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

  // ../sistema/modulos/vuelos/pronostico-widget.js
  var VERSION = "1.0 (Vuelos 0.3)";
  var DRONES = DRONES_BASE.map((d) => ({ id: d.id, nombre: d.nombre, vientoMaxMs: d.vientoMaxMs, rafagaMaxMs: d.rafagaMaxMs }));
  var piezas = { pedirPronostico, pedirKp, kpEnHora, evaluarHora, elevacionSol, metarCercano, vientoDeMetar, enlaceMetar, graficoPronostico, checklistClima };
  var esc = (s) => String(s != null ? s : "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var dos = (n) => String(n).padStart(2, "0");
  var DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  var fechaCorta = (iso) => {
    const d = /* @__PURE__ */ new Date(iso + "T12:00:00");
    return `${DIAS[d.getDay()]} ${d.getDate()}`;
  };
  var n1 = (v) => v == null || !isFinite(v) ? "—" : v.toLocaleString("es-CL", { maximumFractionDigits: 1 });
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
    const st = { pron: null, kps: null, metar: null, dia: null, cargando: false, error: "", errorMetar: "" };
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
        metar: st.metar ? { icao: st.metar.icao, nombre: st.metar.nombre, km: st.metar.km, metar: st.metar.metar, taf: st.metar.taf } : null
      };
    }
    const checklistHtml = (chk, titulo) => `<div class="pv-caja"><h3>${esc(titulo)}</h3><ul class="pv-chk">${chk.map((x) => `<li class="${x.cumple ? "si" : "no"}"><span>${esc(x.texto)}</span><b>${esc(x.detalle)}</b></li>`).join("")}</ul></div>`;
    function metarHtml() {
      const m = st.metar;
      if (m) return `<div class="pv-caja"><h3>METAR · TAF</h3><p class="pv-tenue">${esc(m.icao)} · ${esc(m.nombre)} · a ${Math.round(m.km)} km${m.viento ? ` · viento ${m.viento.dir != null ? m.viento.dir + "°" : "variable"} ${n1(m.viento.v)} m/s${m.viento.g ? ` ráf. ${n1(m.viento.g)}` : ""}` : ""}</p>
      <pre class="pv-metar">${esc(m.metar)}${m.taf ? "\n\n" + esc(m.taf) : ""}</pre><a class="pv-link" href="${enlaceMetar(m.icao)}" target="_blank" rel="noopener">Ver en NOAA ↗</a></div>`;
      if (st.errorMetar) return `<div class="pv-caja"><h3>METAR · TAF</h3><p class="pv-tenue">${esc(st.errorMetar)}</p><a class="pv-link" href="https://aipchile.dgac.gob.cl/" target="_blank" rel="noopener">Revisar en AIP Chile ↗</a></div>`;
      return "";
    }
    function render() {
      const d = dron();
      const cab = `<div class="pv-cab">
      <div><h2>Pronóstico de vuelo</h2>${o.lugar ? `<p class="pv-tenue">${esc(o.lugar)}</p>` : ""}</div>
      <div class="pv-acc">
        ${o.dron ? "" : `<select class="pv-dron" aria-label="Dron">${DRONES.map((x) => `<option value="${x.id}" ${x.id === d.id ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select>`}
        <button type="button" class="pv-btn pri" data-pv="consultar" ${st.cargando || o.lat == null ? "disabled" : ""}>${st.cargando ? "Consultando…" : st.pron ? "Actualizar" : "Consultar"}</button>
      </div></div>`;
      let cuerpo = "";
      if (o.lat == null || o.lon == null) cuerpo = '<p class="pv-tenue">Falta la ubicación (centro del área o del tramo) para consultar.</p>';
      else if (st.error) cuerpo = `<div class="pv-error">${esc(st.error)}</div>${o.ultimo ? ultimoHtml(o.ultimo) : ""}`;
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
      else cuerpo = '<p class="pv-tenue">Consulta los próximos 3 días: viento a 120 m, ráfagas, lluvia, nubes, temperatura, Kp y METAR cercano.</p>';
      el.innerHTML = cab + cuerpo + `<div class="pv-enlaces">${ENLACES_CONSULTA.map(([t, u]) => `<a class="pv-link" href="${u}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join("")}</div>`;
    }
    function ultimoHtml(u) {
      const f = new Date(u.consultadoEn);
      return `<p class="pv-tenue">Última consulta guardada: ${f.toLocaleDateString("es-CL")} ${dos(f.getHours())}:${dos(f.getMinutes())}${u.ventana ? ` · ventana ${esc(u.ventana)}` : ""}. Sin conexión se muestra esto.</p>${u.checklist ? checklistHtml(u.checklist, "Checklist (última consulta)") : ""}`;
    }
    async function consultar() {
      if (o.lat == null || o.lon == null) return;
      st.cargando = true;
      st.error = "";
      st.errorMetar = "";
      render();
      try {
        const [p, kps] = await Promise.all([pedirPronostico(o.lat, o.lon), st.kps ? Promise.resolve(st.kps) : pedirKp()]);
        st.pron = p;
        st.kps = kps;
      } catch (e) {
        st.pron = null;
        st.error = `No se pudo consultar el pronóstico (${e.message}). Revisa la conexión a internet.`;
      }
      try {
        st.metar = await metarCercano(o.lat, o.lon);
        if (!st.metar) st.errorMetar = "No hay aeródromos con METAR a menos de ~120 km.";
      } catch {
        st.metar = null;
        st.errorMetar = "No se pudo leer el METAR (sin conexión o el servicio no respondió).";
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
