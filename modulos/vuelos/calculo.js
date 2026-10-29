// modulos/vuelos/calculo.js — cálculos de planificación (funciones puras, sin pantalla ni base de datos).
// Aproximaciones para cotizar y planificar; el vuelo real se programa en DJI Pilot 2.

const R_LAT = 110540;   // m por grado de latitud
const R_LON = 111320;   // m por grado de longitud en el ecuador

/** Proyección local plana alrededor del centro del polígono (suficiente para áreas de algunos km). */
export function proyectar(anillo) {
  const lat0 = anillo.reduce((s, p) => s + p[1], 0) / anillo.length;
  const lon0 = anillo.reduce((s, p) => s + p[0], 0) / anillo.length;
  const k = Math.cos(lat0 * Math.PI / 180) * R_LON;
  return { lat0, lon0, puntos: anillo.map(([lon, lat]) => [(lon - lon0) * k, (lat - lat0) * R_LAT]) };
}

export function areaM2(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export function perimetroM(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) s += Math.hypot(pts[(i + 1) % pts.length][0] - pts[i][0], pts[(i + 1) % pts.length][1] - pts[i][1]);
  return s;
}

/** Rumbo (grados, 0 = norte, horario) del lado más largo: las líneas de vuelo van paralelas a él. */
export function rumboLadoMasLargo(pts) {
  let mejor = 0, ang = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    const l = Math.hypot(x2 - x1, y2 - y1);
    if (l > mejor) { mejor = l; ang = Math.atan2(x2 - x1, y2 - y1) * 180 / Math.PI; }
  }
  return ((ang % 180) + 180) % 180;
}

/** Segmentos de las líneas de vuelo que caen dentro del polígono, con líneas paralelas al rumbo y separadas `sep` m. */
export function lineasDeVuelo(pts, rumboGrados, sep) {
  // Se rota el polígono para que las líneas queden horizontales (a lo largo de x).
  const a = (90 - rumboGrados) * Math.PI / 180;
  const c = Math.cos(-a), s = Math.sin(-a);
  const rot = pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
  const ys = rot.map(p => p[1]);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const ancho = ymax - ymin;
  const n = Math.max(1, Math.ceil(ancho / sep));
  const inicio = ymin + (ancho - (n - 1) * sep) / 2; // centra las líneas en el polígono
  const lineas = [];
  for (let k = 0; k < n; k++) {
    const y = inicio + k * sep;
    const xs = [];
    for (let i = 0; i < rot.length; i++) {
      const [x1, y1] = rot[i], [x2, y2] = rot[(i + 1) % rot.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
    }
    xs.sort((p, q) => p - q);
    for (let j = 0; j + 1 < xs.length; j += 2) lineas.push({ y, x1: xs[j], x2: xs[j + 1], largo: xs[j + 1] - xs[j] });
  }
  return { lineas, n, ancho };
}

export const gsdCm = (d, alturaM) => d.sensorAnchoMm * alturaM * 100 / (d.focalMm * d.pixelesAncho);
export const alturaParaGsd = (d, gsd) => gsd * d.focalMm * d.pixelesAncho / (d.sensorAnchoMm * 100);

/**
 * Plan completo.
 * p: { dron, modo: 'foto'|'lidar', altura, traslapeFrontal, traslapeLateral, velocidad, exposicion (s),
 *      reserva (0-1), minDespegue, minCambio, segGiro, puntos (proyectados) | areaHa (sin polígono) }
 */
export function calcularPlan(p) {
  const d = p.dron;
  const gsd = gsdCm(d, p.altura);
  const huellaAncho = gsd * d.pixelesAncho / 100;   // m, perpendicular a la línea
  const huellaLargo = gsd * d.pixelesAlto / 100;    // m, en el sentido del vuelo
  const sepFotos = huellaLargo * (1 - p.traslapeFrontal);
  const barrido = p.modo === 'lidar' && d.lidar ? 2 * p.altura * Math.tan(d.lidar.fovGrados / 2 * Math.PI / 180) : null;
  const sepLineas = (barrido || huellaAncho) * (1 - p.traslapeLateral);

  // Distancia: con polígono, por intersección real de las líneas; sin polígono, aproximación por área.
  let area, distanciaLineas, nLineas, segmentos = [], rumbo = null;
  if (p.puntos && p.puntos.length >= 3) {
    area = areaM2(p.puntos);
    rumbo = p.rumbo ?? rumboLadoMasLargo(p.puntos);
    const r = lineasDeVuelo(p.puntos, rumbo, sepLineas);
    segmentos = r.lineas;
    nLineas = r.lineas.length;
    distanciaLineas = r.lineas.reduce((s, l) => s + l.largo, 0);
  } else {
    area = (p.areaHa || 0) * 10000;
    distanciaLineas = area / sepLineas;
    nLineas = Math.max(1, Math.round(Math.sqrt(area) / sepLineas));
  }
  const distanciaGiros = Math.max(0, nLineas - 1) * sepLineas;
  const distancia = distanciaLineas + distanciaGiros;
  const fotos = p.modo === 'lidar' && !p.fotosEnLidar ? 0
    : (segmentos.length ? segmentos.reduce((s, l) => s + Math.ceil(l.largo / sepFotos) + 1, 0) : Math.ceil(distanciaLineas / sepFotos));

  // Velocidades límite
  const velBarrido = 0.5 * (gsd / 100) / p.exposicion;          // máx. 0,5 px de arrastre
  const velIntervalo = sepFotos / d.intervaloMinS;              // la cámara alcanza a disparar
  const limites = [
    ['máxima del dron', d.velocidadMaxMs],
    ...(p.modo === 'foto' || p.fotosEnLidar ? [['sin barrido (½ px)', velBarrido], ['intervalo de la cámara', velIntervalo]] : []),
  ];
  const velSugerida = Math.min(...limites.map(l => l[1]));
  const v = p.velocidad;

  // Tiempos
  const segMision = distancia / v + nLineas * p.segGiro;
  const minUtiles = d.autonomiaMin * (1 - p.reserva) - p.minDespegue;
  const vuelos = Math.max(1, Math.ceil(segMision / 60 / Math.max(1, minUtiles)));
  const minTotal = segMision / 60 + vuelos * p.minDespegue + (vuelos - 1) * p.minCambio;

  const intervalo = sepFotos / v;
  const densidad = barrido ? d.lidar.puntosPorSegundo / (v * sepLineas) : null;
  const densidadPasada = barrido ? d.lidar.puntosPorSegundo / (v * barrido) : null;

  const avisos = [];
  if (v > d.velocidadMaxMs) avisos.push(`La velocidad supera la máxima de misión del dron (${fmt(d.velocidadMaxMs, 1)} m/s).`);
  if ((p.modo === 'foto' || p.fotosEnLidar) && v > velBarrido) avisos.push(`A ${fmt(v, 1)} m/s la foto se arrastra más de medio píxel: baja a ${fmt(velBarrido, 1)} m/s o usa una exposición más corta.`);
  if ((p.modo === 'foto' || p.fotosEnLidar) && intervalo < d.intervaloMinS) avisos.push(`Habría que disparar cada ${fmt(intervalo, 2)} s y la cámara necesita ${fmt(d.intervaloMinS, 1)} s: baja la velocidad a ${fmt(velIntervalo, 1)} m/s o el traslape frontal.`);
  if (p.altura > 120) avisos.push('La altura supera los 120 m (400 ft): revisa la autorización DGAC.');
  if (minUtiles <= 0) avisos.push('Con la reserva elegida no queda tiempo útil por batería: revisa autonomía y reserva.');

  return {
    gsd, huellaAncho, huellaLargo, sepFotos, sepLineas, barrido, area, rumbo, segmentos,
    nLineas, distancia, fotos, intervalo, velBarrido, velIntervalo, velSugerida, limites,
    minMision: segMision / 60, minUtiles, vuelos, minTotal, densidad, densidadPasada, avisos,
  };
}

export function fmt(n, dec = 0) {
  if (n == null || !isFinite(n)) return '—';
  return n.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmtDuracion(min) {
  if (!isFinite(min)) return '—';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}
