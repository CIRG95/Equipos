// modulos/vuelos/pantallas.js — pantallas del módulo Vuelos: Planificar, Limpiar KML, Pronóstico, Planes y Drones.
// Usa las clases visuales del Sistema (sis-…) más las propias (vu-…) de vuelos.css.

import { escapar as esc, fechaLegible, descargar, hoyISO, cargarScript } from '../../compartido/util.js';
import { listarProyectos, OFICINA_ID } from '../../compartido/catalogos.js';
import {
  fijarPersona, listarDrones, guardarDron, restablecerDron, listarPlanes, obtenerPlan, guardarPlan, eliminarPlan,
} from './datos.js';
import { CAMPOS_DRON } from './drones.js';
import { calcularPlan, proyectar, areaM2, alturaParaGsd, gsdCm, giro, rumboMasCorto, fmt, fmtDuracion } from './calculo.js';
import { leerArchivo, analizarKml, limpiarParaDji, kmlDePoligono, nombreArchivoSeguro, limpiarAnillo, autoInterseccion } from './kml.js';
import { pedirPronostico, pedirKp, kpEnHora, evaluarHora, ENLACES_CONSULTA } from './pronostico.js';

const PESTANAS = [
  ['planificar', 'Planificar'], ['kml', 'Limpiar KML'], ['pronostico', 'Pronóstico'], ['planes', 'Planes guardados'], ['drones', 'Drones'],
];

const PARAMS_INICIALES = {
  dronId: 'm4e', modo: 'foto', porGsd: true, gsd: 2.5, altura: 100, traslapeFrontal: 80, traslapeLateral: 70,
  velocidad: '', exposicion: 1000, reserva: 25, minDespegue: 3, minCambio: 5, segGiro: 8, areaHa: '', rumbo: '', despegue: null,
};
const COLORES_BATERIA = ['#4FC3F7', '#C6F15A', '#FFD54F', '#FF8A80', '#CE93D8', '#80CBC4', '#FFAB40', '#B0BEC5'];
const GSD_TABLA = [3, 2.5, 2, 1.5];
const R_LAT = 110540, R_LON = 111320;
const CENTRO_CHILE = [-33.0, -70.6];
const ESRI = s => `https://server.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/{z}/{y}/{x}`;

/** Marco local de un anillo [lon, lat]: pasa de lon/lat a metros y de vuelta (el mismo de calculo.proyectar). */
function marco(anillo) {
  const { lat0, lon0 } = proyectar(anillo);
  const k = Math.cos(lat0 * Math.PI / 180) * R_LON;
  return {
    aXY: ([lon, lat]) => [(lon - lon0) * k, (lat - lat0) * R_LAT],
    aLatLon: ([x, y]) => [lat0 + y / R_LAT, lon0 + x / k],
    lat0, lon0,
  };
}

/** Polígono con la misma forma que entrega analizarKml, a partir de vértices [lon, lat]. */
function poligonoDesde(nombre, coords) {
  const anillo = limpiarAnillo(coords);
  const { puntos } = proyectar(anillo);
  const cruces = autoInterseccion(puntos);
  return { nombre, coords: anillo, anillo, vertices: anillo.length, area: areaM2(puntos), cruces, problemas: cruces ? ['El contorno se cruza consigo mismo.'] : [] };
}

export function montarPantallas(contenedor, ctx) {
  fijarPersona(ctx.personaId || null);
  const raiz = document.createElement('div');
  raiz.className = 'mod-vuelos';
  contenedor.appendChild(raiz);
  let activo = true;

  const st = {
    tab: ctx.planId ? 'planificar' : (ctx.tab || 'planificar'),
    params: { ...PARAMS_INICIALES },
    poligonos: [], polSel: 0, archivo: '',
    proyectoId: ctx.proyectoId || '', nombrePlan: '', planId: null,
    dibujando: false, dibujo: [],
    velA: 5, velB: 10, gsdExtra: [],
    kml: null, kmlError: '', maxVertices: 200,
    pron: null, pronError: '', pronCargando: false, kps: null, kpError: false, dia: hoyISO(),
    pronModo: 'plan', pronPlanId: '', pronLat: '', pronLon: '', pronDron: 'm4e', pronOrigen: '',
    mensaje: null,
  };
  let drones = [], proyectos = [], planes = [];

  const dronActual = () => drones.find(d => d.id === st.params.dronId) || drones[0];
  const polActual = () => st.poligonos[st.polSel] || null;
  const avisar = (texto, tipo = 'ok') => { st.mensaje = { texto, tipo }; };
  const familias = () => [...new Map(drones.map(d => [d.familia || d.id, d.familiaNombre || d.nombre])).entries()];

  async function cargarBase() {
    [drones, proyectos, planes] = await Promise.all([listarDrones(), listarProyectos(), listarPlanes()]);
  }

  async function abrirPlan(id) {
    const p = await obtenerPlan(id);
    if (!p) return;
    st.planId = p.id; st.nombrePlan = p.nombre; st.proyectoId = p.proyectoId || '';
    st.params = { ...PARAMS_INICIALES, ...p.params };
    st.poligonos = p.poligono ? [poligonoDesde(p.poligono.nombre, p.poligono.anillo)] : [];
    st.polSel = 0; st.archivo = p.poligono ? 'guardado en el plan' : '';
    st.tab = 'planificar'; st.dibujando = false;
  }

  // ─────────── Cálculo ───────────

  function base(P, d, extra = {}) {
    const modo = P.modo === 'lidar' && d.lidar ? 'lidar' : 'foto';
    const pol = polActual();
    const m = pol ? marco(pol.anillo) : null;
    return {
      dron: d, modo,
      traslapeFrontal: (Number(P.traslapeFrontal) || 0) / 100, traslapeLateral: (Number(P.traslapeLateral) || 0) / 100,
      exposicion: 1 / (Number(P.exposicion) || 1000), reserva: (Number(P.reserva) || 0) / 100,
      minDespegue: Number(P.minDespegue) || 0, minCambio: Number(P.minCambio) || 0, segGiro: Number(P.segGiro) || 0,
      puntos: pol ? proyectar(pol.anillo).puntos : null, areaHa: Number(P.areaHa) || 0,
      rumbo: P.rumbo === '' || P.rumbo == null ? undefined : Number(P.rumbo), fotosEnLidar: false,
      despegue: m ? (P.despegue ? m.aXY(P.despegue) : [0, 0]) : null,
      ...extra,
    };
  }

  const alturaDe = (P, d) => P.porGsd ? alturaParaGsd(d, Number(P.gsd) || 1) : Number(P.altura) || 1;

  function resultado() {
    const d = dronActual();
    if (!d) return null;
    const P = st.params;
    const altura = alturaDe(P, d);
    const b = base(P, d, { altura });
    if (!b.puntos && !b.areaHa) return { sinArea: true, altura, modo: b.modo, d, gsd: gsdCm(d, altura) };
    const previo = calcularPlan({ ...b, velocidad: 10 });
    const sugerida = Math.floor(previo.velSugerida * 10) / 10;
    const velocidad = Number(P.velocidad) || sugerida;
    return { ...calcularPlan({ ...b, velocidad }), altura, modo: b.modo, velocidad, sugerida, d, auto: !Number(P.velocidad) };
  }

  /** Tiempo de vuelo y baterías para cada GSD de la tabla, a dos velocidades. */
  function opcionesGsd(r) {
    const d = r.d, P = st.params;
    const actual = Math.round(r.gsd * 100) / 100;
    const lista = [...new Set([...GSD_TABLA, ...st.gsdExtra, actual])].sort((a, b) => b - a);
    return lista.map(g => {
      const altura = alturaParaGsd(d, g);
      const b = base(P, d, { altura, modo: 'foto' });
      const a = calcularPlan({ ...b, velocidad: st.velA });
      const z = calcularPlan({ ...b, velocidad: st.velB });
      return { gsd: g, altura, actual: Math.abs(g - actual) < 0.005, a, z, sobre120: altura > 120 };
    });
  }

  // ─────────── Vistas ───────────

  const opcionesProyectos = sel => `<option value="">Sin proyecto</option>` + proyectos.map(p => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.id === OFICINA_ID ? 'Oficina' : p.nombre)}</option>`).join('');
  const campo = (nombre, etiqueta, valor, extra = '', sufijo = '') => `<label class="sis-campo"><span>${etiqueta}</span>
    <span class="vu-con-sufijo"><input name="${nombre}" value="${esc(valor)}" inputmode="decimal" ${extra}>${sufijo ? `<em>${sufijo}</em>` : ''}</span></label>`;
  const deslizador = (nombre, etiqueta, valor, { min, max, paso, sufijo, nota = '', mostrar }) => `<div class="vu-desl">
      <div class="vu-desl-cab"><label for="vu-${nombre}">${etiqueta}${nota ? ` <small>${nota}</small>` : ''}</label>
        <span class="vu-desl-valor"><input type="number" data-espejo="${nombre}" value="${esc(mostrar ?? valor)}" step="${paso}" min="${min}" max="${max}" aria-label="${etiqueta}">${sufijo}</span></div>
      <input type="range" id="vu-${nombre}" name="${nombre}" min="${min}" max="${max}" step="${paso}" value="${esc(valor)}">
    </div>`;

  function vistaPlanificar() {
    const P = st.params, d = dronActual(), pol = polActual();
    const fam = d ? (d.familia || d.id) : '';
    const sensores = drones.filter(x => (x.familia || x.id) === fam);
    const altura = d ? alturaDe(P, d) : 100;
    const gsd = d ? gsdCm(d, altura) : 2.5;
    const r = resultado();
    const vMax = d ? d.velocidadMaxMs : 15;
    const vel = r && !r.sinArea ? r.velocidad : (Number(P.velocidad) || 5);
    return `<div class="vu-planificar">
      <div class="vu-izquierda">
      <form class="vu-form sis-form" data-form="plan" autocomplete="off">
        <section class="sis-tarjeta vu-t-area"><h2>Área</h2>
          <div class="sis-acciones">
            <label class="sis-btn vu-archivo">Cargar KML / KMZ<input type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" data-archivo="plan" hidden></label>
            <button type="button" class="sis-btn${st.dibujando ? ' primario' : ''}" data-accion="dibujar">${st.dibujando ? 'Dibujando…' : 'Dibujar en el mapa'}</button>
          </div>
          ${pol ? `<p class="sis-tenue vu-area-info">${esc(st.archivo || pol.nombre)} · ${fmt(pol.area / 10000, 2)} ha · ${pol.vertices} vértices</p>` : ''}
          ${st.poligonos.length > 1 ? `<label class="sis-campo"><span>Polígono</span><select data-campo="polSel">${st.poligonos.map((p, i) => `<option value="${i}" ${i === st.polSel ? 'selected' : ''}>${esc(p.nombre)} · ${fmt(p.area / 10000, 2)} ha</option>`).join('')}</select></label>` : ''}
          ${pol && pol.problemas && pol.problemas.length ? `<div class="vu-aviso"><b>Este polígono tiene detalles para el control:</b><ul>${pol.problemas.map(t => `<li>${esc(t)}</li>`).join('')}</ul><span>Al descargar el KML se corrigen, salvo los cruces.</span></div>` : ''}
          ${pol ? '' : campo('areaHa', 'O escribe el área (sin polígono)', P.areaHa, 'placeholder="0"', 'ha')}
        </section>
        <section class="sis-tarjeta vu-t-dron"><h2>Dron y vuelo</h2>
          <div class="${sensores.length > 1 ? 'sis-par' : ''}">
            <label class="sis-campo"><span>Dron</span><select name="familia">${familias().map(([k, t]) => `<option value="${esc(k)}" ${k === fam ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
            ${sensores.length > 1 ? `<label class="sis-campo"><span>Sensor</span><select name="dronId">${sensores.map(x => `<option value="${x.id}" ${x.id === P.dronId ? 'selected' : ''}>${esc(x.sensor || x.nombre)}</option>`).join('')}</select></label>` : ''}
          </div>
          ${d && d.lidar ? `<div class="sis-campo"><span>Producto</span><div class="sis-opciones">
            <label class="sis-opcion"><input type="radio" name="modo" value="foto" ${P.modo !== 'lidar' ? 'checked' : ''}> Fotogrametría</label>
            <label class="sis-opcion"><input type="radio" name="modo" value="lidar" ${P.modo === 'lidar' ? 'checked' : ''}> LiDAR</label></div></div>` : ''}
          <div class="vu-enlazados">
            ${deslizador('gsd', 'GSD', Math.round(gsd * 100) / 100, { min: 0.5, max: 8, paso: 0.05, sufijo: 'cm/px' })}
            ${deslizador('altura', 'Altura', Math.round(altura), { min: 15, max: 400, paso: 1, sufijo: 'm', nota: '(enlazada al GSD)' })}
          </div>
          ${deslizador('traslapeFrontal', 'Traslape frontal', P.traslapeFrontal, { min: 40, max: 90, paso: 1, sufijo: '%' })}
          ${deslizador('traslapeLateral', 'Traslape lateral', P.traslapeLateral, { min: 20, max: 90, paso: 1, sufijo: '%' })}
          ${deslizador('velocidad', 'Velocidad', Math.min(vMax, Math.round(vel * 10) / 10), { min: 1, max: vMax, paso: 0.1, sufijo: 'm/s', nota: P.velocidad === '' ? '(sugerida)' : '' })}
          <div class="vu-desl-pie" id="vu-vel-pie">${pieVelocidad(r)}</div>
          <details class="vu-detalles"><summary>Supuestos de terreno y cámara</summary>
            <div class="sis-par">
              ${campo('reserva', 'Reserva por batería', P.reserva, '', '%')}
              ${campo('minDespegue', 'Despegue y aterrizaje', P.minDespegue, '', 'min')}
            </div>
            <div class="sis-par">
              ${campo('minCambio', 'Cambio de batería', P.minCambio, '', 'min')}
              ${campo('segGiro', 'Giro entre líneas', P.segGiro, '', 's')}
            </div>
            ${campo('exposicion', 'Exposición 1/…', P.exposicion, '', 's')}
          </details>
        </section>
      </form>
      <section class="sis-tarjeta vu-t-guardar">
        <h2>Guardar y exportar</h2>
        <form class="vu-guardar sis-form" data-form="guardar">
          <label class="sis-campo"><span>Nombre del plan</span><input name="nombrePlan" value="${esc(st.nombrePlan || (pol ? pol.nombre : ''))}" required></label>
          <label class="sis-campo"><span>Proyecto</span><select name="proyectoId">${opcionesProyectos(st.proyectoId)}</select></label>
          <div class="sis-acciones">
            <button class="sis-btn primario">${st.planId ? 'Guardar cambios' : 'Guardar plan'}</button>
            ${pol ? '<button type="button" class="sis-btn" data-accion="descargar-kml-plan">Descargar KML</button>' : ''}
            ${pol ? '<button type="button" class="sis-btn" data-accion="pronostico-plan">Pronóstico</button>' : ''}
            ${st.planId ? '<button type="button" class="sis-btn" data-accion="nuevo-plan">Nuevo plan</button>' : ''}
          </div>
        </form>
      </section>
      </div>
      <div class="vu-derecha">
        <div id="vu-kpis">${htmlKpis(r)}</div>
        <div class="vu-mapa-caja">
          <div class="vu-mapa-lugar"></div>
          <div class="vu-mapa-barra" id="vu-barra">${htmlBarra(r)}</div>
        </div>
        <div id="vu-leyenda">${htmlLeyenda(r)}</div>
        <div id="vu-detalle">${htmlDetalle(r)}</div>
      </div>
    </div>`;
  }

  function pieVelocidad(r) {
    if (!r || r.sinArea) return '';
    const lim = r.limites.map(([t, v]) => `${t} ${fmt(v, 1)}`).join(' · ');
    return `<span>Sugerida ${fmt(r.sugerida, 1)} m/s · límites: ${lim} m/s</span>${r.auto ? '' : ' <button type="button" class="vu-link" data-accion="vel-auto">usar la sugerida</button>'}`;
  }

  const kpi = (t, v, clase = '') => `<div class="vu-kpi ${clase}"><span>${t}</span><b>${v}</b></div>`;
  const fila = (t, v) => `<div><dt>${t}</dt><dd>${v}</dd></div>`;

  function htmlKpis(r) {
    if (!r) return '';
    if (r.sinArea) return `<div class="vu-kpis">${kpi('Altura', `${fmt(r.altura, 0)} m`)}${kpi('GSD', `${fmt(r.gsd, 2)} cm/px`)}</div>`;
    return `<div class="vu-kpis">
      ${kpi('Altura', `${fmt(r.altura, 0)} m`, r.altura > 120 ? 'alerta' : '')}
      ${r.densidad ? kpi('Densidad LiDAR', `${fmt(r.densidad, 0)} pts/m²`) : kpi('GSD', `${fmt(r.gsd, 2)} cm`)}
      ${kpi('Líneas', fmt(r.nLineas))}
      ${r.modo === 'foto' ? kpi('Fotos', fmt(r.fotos)) : kpi('Velocidad', `${fmt(r.velocidad, 1)} m/s`)}
      ${kpi('En el aire', fmtDuracion(r.minMision))}
      ${kpi('Baterías', fmt(r.vuelos))}
      ${kpi('Jornada', fmtDuracion(r.minTotal))}
    </div>`;
  }

  function htmlBarra(r) {
    const pol = polActual();
    if (st.dibujando) {
      return `<span class="vu-barra-txt">Toca el mapa para marcar los vértices · ${st.dibujo.length} marcado${st.dibujo.length === 1 ? '' : 's'}</span>
        <button type="button" class="vu-barra-btn" data-accion="dibujo-deshacer" ${st.dibujo.length ? '' : 'disabled'}>Deshacer</button>
        <button type="button" class="vu-barra-btn fuerte" data-accion="dibujo-terminar" ${st.dibujo.length >= 3 ? '' : 'disabled'}>Terminar</button>
        <button type="button" class="vu-barra-btn" data-accion="dibujo-cancelar">Cancelar</button>`;
    }
    if (!pol) return '<span class="vu-barra-txt">Carga un KML/KMZ o usa «Dibujar en el mapa».</span>';
    if (!r || r.sinArea) return '';
    return `<span class="vu-barra-txt">Rumbo ${fmt(r.rumbo, 0)}°${st.params.rumbo === '' ? ' · lado más largo' : ''}</span>
      <button type="button" class="vu-barra-btn" data-accion="rumbo" data-d="-5" aria-label="Girar las líneas 5 grados a la izquierda">⟲ 5°</button>
      <button type="button" class="vu-barra-btn" data-accion="rumbo" data-d="5" aria-label="Girar las líneas 5 grados a la derecha">⟳ 5°</button>
      <button type="button" class="vu-barra-btn" data-accion="rumbo" data-d="90">Girar 90°</button>
      <button type="button" class="vu-barra-btn fuerte" data-accion="rumbo-corto">Más corto</button>
      ${st.params.rumbo !== '' ? '<button type="button" class="vu-barra-btn" data-accion="rumbo-auto">Auto</button>' : ''}`;
  }

  function htmlLeyenda(r) {
    if (!r || r.sinArea || !r.baterias || !r.baterias.length) return '';
    const dist = r.baterias.length && st.params.despegue !== undefined ? despegueTexto(r) : '';
    const extra = r.baterias.length > 8 ? `<span>y ${r.baterias.length - 8} baterías más</span>` : '';
    return `<div class="vu-leyenda">${r.baterias.slice(0, 8).map((b, i) => `<span><i style="background:${COLORES_BATERIA[i % COLORES_BATERIA.length]}"></i>Batería ${i + 1} · ${fmtDuracion(b.min)}</span>`).join('')}${extra}
      <span class="vu-leyenda-desp"><i class="vu-punto"></i>${dist}</span></div>
      <p class="sis-tenue vu-pie">Arrastra el punto para cambiar el despegue: el tiempo incluye ir y volver desde él en cada batería.</p>`;
  }

  function despegueTexto(r) {
    if (!r.despegueGirado || !r.baterias.length) return 'Despegue';
    const b = r.baterias[0];
    const m = Math.hypot(b.inicio[0] - r.despegueGirado[0], b.inicio[1] - r.despegueGirado[1]);
    return st.params.despegue ? `Despegue · ${fmt(m, 0)} m a la primera línea` : 'Despegue en el centro del área';
  }

  function htmlDetalle(r) {
    if (!r) return '';
    if (r.sinArea) return '';
    return `${r.avisos.length ? `<div class="vu-aviso"><ul>${r.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      ${r.modo === 'foto' ? htmlTablaGsd(r) : ''}
      <details class="vu-detalles"><summary>Detalle del cálculo</summary>
      <dl class="vu-tabla">
        ${fila('Área', `${fmt(r.area / 10000, 2)} ha`)}
        ${fila('Huella de la foto', `${fmt(r.huellaAncho, 0)} × ${fmt(r.huellaLargo, 0)} m`)}
        ${r.barrido ? fila('Ancho de barrido LiDAR', `${fmt(r.barrido, 0)} m`) : ''}
        ${fila('Separación entre líneas', `${fmt(r.sepLineas, 1)} m · ${fmt(r.nLineas)} líneas`)}
        ${r.modo === 'foto' ? fila('Distancia entre fotos', `${fmt(r.sepFotos, 1)} m · cada ${fmt(r.intervalo, 1)} s`) : fila('Densidad en una pasada', `${fmt(r.densidadPasada, 0)} pts/m²`)}
        ${fila('Distancia de las líneas', `${fmt(r.distancia / 1000, 2)} km`)}
        ${r.trasladoM ? fila('Traslado desde el despegue (ida y vuelta)', `${fmt(r.trasladoM / 1000, 2)} km`) : ''}
        ${fila('Velocidad', `${fmt(r.velocidad, 1)} m/s${r.auto ? ' (sugerida)' : ''}`)}
        ${fila('Tiempo útil por batería', `${fmt(r.minUtiles, 0)} min`)}
      </dl>
      <p class="sis-tenue">Estimación para planificar y cotizar. El GSD es sobre el punto de despegue: con desnivel cambia. El vuelo se programa en DJI Pilot 2.</p>
      </details>`;
  }

  function htmlTablaGsd(r) {
    const filas = opcionesGsd(r);
    const pol = polActual();
    return `<section class="sis-tarjeta vu-opciones">
      <div class="vu-opciones-cab">
        <h2>Opciones por GSD${pol ? ` · ${esc(st.nombrePlan || pol.nombre)}` : ''}</h2>
        <label class="vu-vel">Velocidades <input type="number" data-vel="velA" value="${st.velA}" min="1" max="25" step="0.5" aria-label="Velocidad A"> y <input type="number" data-vel="velB" value="${st.velB}" min="1" max="25" step="0.5" aria-label="Velocidad B"> m/s</label>
      </div>
      <div class="vu-tabla-scroll"><table class="vu-gsd">
        <thead><tr><th>GSD (cm/px)</th><th>Altura (m)</th><th>Tiempo a ${fmt(st.velA, 1)} m/s</th><th>Baterías</th><th>Tiempo a ${fmt(st.velB, 1)} m/s</th><th>Baterías</th><th></th></tr></thead>
        <tbody>${filas.map(f => `<tr class="${f.actual ? 'actual' : ''}${f.sobre120 ? ' sobre120' : ''}">
          <td>${fmt(f.gsd, 2)}${f.actual ? ' · actual' : ''}</td><td>${fmt(f.altura, 0)}${f.sobre120 ? ' ⚠' : ''}</td>
          <td>${fmtDuracion(f.a.minMision)}${st.velA > f.a.velSugerida + 0.05 ? ' <span class="vu-ojo" title="Sobre la velocidad sugerida para este GSD">*</span>' : ''}</td><td>${f.a.vuelos}</td>
          <td>${fmtDuracion(f.z.minMision)}${st.velB > f.z.velSugerida + 0.05 ? ' <span class="vu-ojo" title="Sobre la velocidad sugerida para este GSD">*</span>' : ''}</td><td>${f.z.vuelos}</td>
          <td><button type="button" class="vu-link" data-accion="usar-gsd" data-g="${f.gsd}">usar</button>${GSD_TABLA.includes(f.gsd) || f.actual ? '' : ` <button type="button" class="vu-link" data-accion="quitar-gsd" data-g="${f.gsd}" aria-label="Quitar">✕</button>`}</td>
        </tr>`).join('')}</tbody></table></div>
      <div class="vu-opciones-pie">
        <span class="vu-agregar"><input type="number" data-campo="gsdNuevo" placeholder="GSD" step="0.1" min="0.3" max="10" aria-label="GSD a agregar"><button type="button" class="sis-btn chico" data-accion="agregar-gsd">+ GSD</button></span>
        <button type="button" class="sis-btn chico" data-accion="copiar-tabla">Copiar para correo</button>
        <button type="button" class="sis-btn chico" data-accion="excel-tabla">Descargar Excel</button>
      </div>
      <p class="sis-tenue">Tiempo de vuelo en el aire con el dron y traslapes del plan. ⚠ sobre 120 m: requiere autorización DGAC. * sobre la velocidad sugerida (la foto puede salir movida).</p>
    </section>`;
  }

  function filasTablaTexto(r) {
    const filas = opcionesGsd(r);
    const cab = ['GSD (cm/px)', 'Altura (m)', `Tiempo a ${fmt(st.velA, 1)} m/s`, 'Baterías', `Tiempo a ${fmt(st.velB, 1)} m/s`, 'Baterías'];
    return [cab, ...filas.map(f => [fmt(f.gsd, 2), fmt(f.altura, 0) + (f.sobre120 ? ' *' : ''), fmtDuracion(f.a.minMision), String(f.a.vuelos), fmtDuracion(f.z.minMision), String(f.z.vuelos)])];
  }

  // ─────────── Mapas (Leaflet + Esri híbrido) ───────────
  const mapas = {}; // clave → { el, mapa, capas }

  async function cargarLeaflet() {
    if (window.L) return window.L;
    await cargarScript('vendor/leaflet/leaflet.js');
    return window.L;
  }

  async function mapaEn(lugar, clave) {
    let L;
    try { L = await cargarLeaflet(); } catch { return null; }
    if (!L || !raiz.contains(lugar)) return null;
    let m = mapas[clave];
    if (!m) {
      const el = document.createElement('div'); el.className = 'vu-mapa';
      const mapa = L.map(el, { zoomControl: true, attributionControl: true });
      L.tileLayer(ESRI('World_Imagery'), { maxZoom: 20, maxNativeZoom: 19, attribution: 'Imagen © Esri, Maxar, Earthstar Geographics' }).addTo(mapa);
      L.tileLayer(ESRI('Reference/World_Transportation'), { maxZoom: 20, maxNativeZoom: 19 }).addTo(mapa);
      L.tileLayer(ESRI('Reference/World_Boundaries_and_Places'), { maxZoom: 20, maxNativeZoom: 19 }).addTo(mapa);
      m = mapas[clave] = { el, mapa, capas: {}, pol: null, L };
      mapa.setView(CENTRO_CHILE, 7);
      if (clave === 'plan') mapa.on('click', alClicMapa);
    }
    if (m.el.parentNode !== lugar) lugar.appendChild(m.el);
    m.mapa.invalidateSize();
    return m;
  }

  function quitar(m, ...nombres) { for (const n of nombres) if (m.capas[n]) { m.capas[n].remove(); delete m.capas[n]; } }

  async function actualizarMapa() {
    const lugar = raiz.querySelector('.vu-planificar .vu-mapa-lugar');
    if (!lugar) return;
    const m = await mapaEn(lugar, 'plan');
    if (!m) { lugar.innerHTML = '<p class="sis-tenue vu-sin-mapa">El mapa necesita internet. El cálculo funciona igual.</p>'; return; }
    const { L, mapa } = m;
    const pol = polActual();
    m.el.classList.toggle('dibujando', st.dibujando);

    // Dibujo en curso
    quitar(m, 'dibujo');
    if (st.dibujando) {
      const ll = st.dibujo.map(([lon, lat]) => [lat, lon]);
      m.capas.dibujo = L.layerGroup([
        ...(ll.length >= 2 ? [L.polyline([...ll, ...(ll.length >= 3 ? [ll[0]] : [])], { color: '#FFFFFF', weight: 2, dashArray: '6 5' })] : []),
        ...ll.map(p => L.circleMarker(p, { radius: 5, color: '#FFFFFF', weight: 2, fillColor: '#E8611C', fillOpacity: 1 })),
      ]).addTo(mapa);
    }

    if (!pol) { quitar(m, 'pol', 'lineas', 'despegue', 'traslados'); m.pol = null; return; }
    if (m.pol !== pol) {
      quitar(m, 'pol');
      m.capas.pol = L.polygon(pol.anillo.map(([lon, lat]) => [lat, lon]), { color: '#E8611C', weight: 3, fillColor: '#E8611C', fillOpacity: 0.12, interactive: false }).addTo(mapa);
      mapa.fitBounds(m.capas.pol.getBounds(), { padding: [30, 30] });
      m.pol = pol;
    }
    pintarLineas(m);
  }

  function pintarLineas(m) {
    const { L, mapa } = m;
    const pol = polActual();
    const r = resultado();
    quitar(m, 'lineas', 'traslados');
    if (!pol || !r || r.sinArea || !r.tramos) return;
    const fr = marco(pol.anillo);
    const g = giro(r.rumbo);
    const aLL = p => fr.aLatLon(g.vuelta(p));
    const colorDe = {};
    r.baterias.forEach((b, i) => b.lineas.forEach(j => { colorDe[j] = COLORES_BATERIA[i % COLORES_BATERIA.length]; }));
    m.capas.lineas = L.layerGroup(r.tramos.slice(0, 800).map((t, j) => L.polyline([aLL(t.a), aLL(t.b)], { color: colorDe[j] || '#4FC3F7', weight: 2, opacity: 0.95, interactive: false }))).addTo(mapa);
    const desp = st.params.despegue ? [st.params.despegue[1], st.params.despegue[0]] : fr.aLatLon([0, 0]);
    m.capas.traslados = L.layerGroup(r.baterias.slice(0, 40).map(b => L.polyline([desp, aLL(b.inicio)], { color: '#FFFFFF', weight: 1.5, dashArray: '5 5', opacity: 0.9, interactive: false }))).addTo(mapa);
    if (!m.capas.despegue) {
      const icono = L.divIcon({ className: 'vu-despegue', html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 13] });
      m.capas.despegue = L.marker(desp, { draggable: true, icon: icono, title: 'Punto de despegue (arrástralo)', keyboard: true }).addTo(mapa);
      m.capas.despegue.on('dragend', ev => {
        const { lat, lng } = ev.target.getLatLng();
        st.params.despegue = [lng, lat];
        refrescarResultados();
      });
    } else {
      m.capas.despegue.setLatLng(desp);
    }
  }

  async function mapaKml() {
    const lugar = raiz.querySelector('.vu-kml-mapa');
    if (!lugar || !st.kml) return;
    const m = await mapaEn(lugar, 'kml');
    if (!m) { lugar.innerHTML = '<p class="sis-tenue vu-sin-mapa">El mapa necesita internet.</p>'; return; }
    if (m.kml === st.kml) return;
    quitar(m, 'kml');
    const { L } = m;
    const capas = st.kml.poligonos.map((p, i) => L.polygon(p.anillo.map(([lon, lat]) => [lat, lon]), { color: p.problemas.length ? '#FFB74D' : '#E8611C', weight: 3, fillOpacity: 0.12 })
      .bindTooltip(`${i + 1}. ${p.nombre}`, { sticky: true }));
    if (!capas.length) return;
    m.capas.kml = L.featureGroup(capas).addTo(m.mapa);
    m.mapa.fitBounds(m.capas.kml.getBounds(), { padding: [24, 24] });
    m.kml = st.kml;
  }

  // Al soltar un deslizador o escribir, se rehace solo la columna de resultados (el mapa no se vuelve a crear).
  function refrescarResultados() {
    const r = resultado();
    const poner = (id, html) => { const el = raiz.querySelector('#' + id); if (el) el.innerHTML = html; };
    poner('vu-kpis', htmlKpis(r));
    poner('vu-barra', htmlBarra(r));
    poner('vu-leyenda', htmlLeyenda(r));
    poner('vu-detalle', htmlDetalle(r));
    poner('vu-vel-pie', pieVelocidad(r));
    // La velocidad mostrada sigue a la sugerida mientras esté en automático.
    if (r && !r.sinArea && st.params.velocidad === '') ponerValor('velocidad', Math.round(r.velocidad * 10) / 10);
    const m = mapas.plan;
    if (m && m.el.isConnected) pintarLineas(m);
  }

  function ponerValor(nombre, valor) {
    const rango = raiz.querySelector(`input[type=range][name="${nombre}"]`);
    const espejo = raiz.querySelector(`input[data-espejo="${nombre}"]`);
    if (rango && document.activeElement !== rango) rango.value = valor;
    if (espejo && document.activeElement !== espejo) espejo.value = valor;
  }

  // ─────────── Limpiar KML ───────────

  function vistaKml() {
    const a = st.kml;
    return `<section class="sis-tarjeta">
      <h2>Limpiar un KML o KMZ para el control</h2>
      <p>Revisa el archivo que te enviaron y deja cada polígono como lo lee el control (DJI Pilot 2 u otro): un solo contorno por archivo, sin altura, cerrado, sin vértices repetidos y con pocos vértices.</p>
      <div class="sis-acciones">
        <label class="sis-btn primario vu-archivo">Elegir archivo<input type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" data-archivo="kml" hidden></label>
        <label class="sis-campo vu-mini"><span>Máximo de vértices</span><input data-campo="maxVertices" value="${st.maxVertices}" inputmode="numeric"></label>
      </div>
      ${st.kmlError ? `<div class="sis-error">${esc(st.kmlError)}</div>` : ''}
    </section>
    ${a ? `<div class="vu-kml">
      <section class="sis-tarjeta">
      <h2>${esc(a.archivo)}</h2>
      <p class="sis-tenue">${a.placemarks} elemento${a.placemarks === 1 ? '' : 's'} · ${a.poligonos.length} polígono${a.poligonos.length === 1 ? '' : 's'} utilizable${a.poligonos.length === 1 ? '' : 's'}${a.lineas ? ` · ${a.lineas} línea${a.lineas > 1 ? 's' : ''}` : ''}${a.puntos ? ` · ${a.puntos} punto${a.puntos > 1 ? 's' : ''} (se ignoran)` : ''}${a.carpetas ? ` · ${a.carpetas} carpeta${a.carpetas > 1 ? 's' : ''}` : ''}</p>
      ${a.poligonos.length ? `<div class="sis-lista">${a.poligonos.map((p, i) => `<div class="sis-fila vu-kml-fila">
        <span class="sis-fila-txt"><b>${i + 1}. ${esc(p.nombre)}</b><span class="sis-tenue">${fmt(p.area / 10000, 2)} ha · ${p.vertices} vértices</span>
          ${p.problemas.length ? `<ul class="vu-problemas">${p.problemas.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<span class="sis-chip verde">Sin problemas</span>'}</span>
        <span class="sis-acciones"><button class="sis-btn chico" data-accion="descargar-kml" data-i="${i}">Descargar KML</button>
          <button class="sis-btn chico" data-accion="usar-en-plan" data-i="${i}">Planificar</button></span></div>`).join('')}</div>
        <p class="sis-tenue">Cada polígono se descarga como un archivo aparte, que es lo que el control importa mejor.</p>`
        : '<div class="sis-vacio"><p>No encontré polígonos ni polilíneas de 3 o más vértices en este archivo.</p></div>'}
      </section>
      ${a.poligonos.length ? '<div class="vu-kml-mapa"></div>' : ''}
    </div>` : ''}`;
  }

  // ─────────── Pronóstico ───────────

  /** Planes con área (guardados y el que se está armando), para elegir dónde consultar. */
  function planesConArea() {
    const lista = planes.filter(p => p.poligono && p.poligono.anillo && p.poligono.anillo.length >= 3)
      .map(p => ({ id: p.id, nombre: p.nombre, anillo: p.poligono.anillo, dronId: p.dronId, proyectoId: p.proyectoId }));
    const pol = polActual();
    if (pol && !st.planId) lista.unshift({ id: 'actual', nombre: `${st.nombrePlan || pol.nombre} (sin guardar)`, anillo: pol.anillo, dronId: st.params.dronId });
    return lista;
  }

  function vistaPronostico() {
    const p = st.pron;
    const dron = drones.find(d => d.id === st.pronDron) || drones[0];
    const lista = planesConArea();
    if (st.pronModo === 'plan' && !lista.some(x => x.id === st.pronPlanId)) st.pronPlanId = lista[0] ? lista[0].id : '';
    const elegido = lista.find(x => x.id === st.pronPlanId);
    let cuerpo = '';
    if (st.pronCargando) cuerpo = '<p class="sis-tenue">Consultando el pronóstico…</p>';
    else if (st.pronError) cuerpo = `<div class="sis-error">${esc(st.pronError)}</div>`;
    else if (p) {
      const dias = [...new Set(p.horas.map(h => h.fecha))];
      const horas = p.horas.filter(h => h.fecha === st.dia && h.hora >= 6 && h.hora <= 21);
      const filas = horas.map(h => ({ h, kp: kpEnHora(st.kps, h.t), ev: null })).map(x => ({ ...x, ev: evaluarHora(x.h, dron, { kp: x.kp, solMin: 5 }) }));
      const ventana = mejorVentana(filas);
      const sol = p.dias.find(d => d.fecha === st.dia);
      const kpMax = filas.map(f => f.kp).filter(k => k != null);
      cuerpo = `<div class="vu-pron-origen"><b>${esc(st.pronOrigen || 'Ubicación consultada')}</b><span class="sis-tenue">${fmt(p.lat, 5)}, ${fmt(p.lon, 5)}${p.elevacionModelo != null ? ` · ${fmt(p.elevacionModelo, 0)} m s. n. m. (modelo)` : ''}</span></div>
        <div class="vu-dias">${dias.map(d => `<button class="sis-menu-chip${d === st.dia ? ' activo' : ''}" data-accion="dia" data-dia="${d}">${fechaLegible(d)}</button>`).join('')}</div>
        <div class="vu-resumen-dia">
          ${ventana ? `<span class="sis-chip verde">Ventana GO: ${String(ventana[0]).padStart(2, '0')}:00 – ${String(ventana[1] + 1).padStart(2, '0')}:00</span>` : '<span class="sis-chip rojo">Sin ventana GO este día</span>'}
          <span class="sis-chip gris">Sol: ${sol && sol.salida ? sol.salida.slice(11, 16) : '—'} – ${sol && sol.puesta ? sol.puesta.slice(11, 16) : '—'}</span>
          <span class="sis-chip gris">${kpMax.length ? `Kp máx. ${fmt(Math.max(...kpMax), 1)}` : 'Kp sin dato'}</span>
          <span class="sis-chip gris">Límites ${esc((dron.familiaNombre || dron.nombre).replace('DJI ', ''))}: viento ${dron.vientoMaxMs} · ráfaga ${dron.rafagaMaxMs} m/s</span>
        </div>
        <div class="vu-tabla-scroll"><table class="vu-pron">
          <thead><tr><th>Hora</th><th>Estado</th><th>Viento a 120 m</th><th>Ráfaga est.</th><th>Dir.</th><th>Lluvia</th><th>Nubes</th><th>Temp.</th><th>Sol</th><th>Kp</th></tr></thead>
          <tbody>${filas.map(({ h, kp, ev }) => `<tr class="vu-${ev.estado}">
            <td>${String(h.hora).padStart(2, '0')}:00</td>
            <td><span class="vu-estado vu-e-${ev.estado}" title="${esc(ev.motivos.join(' · '))}">${{ go: 'GO', marg: 'Marginal', no: 'NO', noche: 'Sin luz' }[ev.estado]}</span></td>
            <td>${fmt(h.v, 1)} <small>(${fmt(h.vMin, 1)}–${fmt(h.vMax, 1)})</small></td>
            <td>${fmt(h.g, 1)}</td>
            <td>${h.dir != null ? `<span class="vu-flecha" style="transform:rotate(${Math.round(h.dir + 180)}deg)" aria-label="${Math.round(h.dir)}°">↑</span>` : '—'}</td>
            <td>${h.prob != null ? `${fmt(h.prob)} %` : '—'}${h.lluvia >= 0.1 ? ` · ${fmt(h.lluvia, 1)} mm` : ''}</td>
            <td>${fmt(h.nubes)} %</td><td>${fmt(h.temp, 0)}°</td><td>${fmt(h.sol, 0)}°</td><td>${kp != null ? fmt(kp, 1) : '—'}</td>
          </tr>`).join('')}</tbody></table></div>
        <p class="sis-tenue">Viento: promedio de ${p.horas[0]?.modelos || 0} modelos (ECMWF, GFS, ICON) y entre paréntesis el rango entre ellos; si el rango es amplio, el pronóstico es inseguro. La ráfaga a 120 m es estimada. La flecha indica hacia dónde sopla. ${st.kps ? 'Kp: pronóstico de NOAA en ventanas de 3 horas (desde 5 afecta la precisión GNSS).' : 'No se pudo leer el índice Kp de NOAA (sin conexión o el servicio no respondió); revísalo en el enlace de NOAA.'} Modelos globales: en valles y faenas de cordillera el viento real puede diferir; mide en terreno.</p>`;
    }
    const modoBtn = (k, t) => `<button type="button" class="vu-seg${st.pronModo === k ? ' activo' : ''}" data-accion="pron-modo" data-m="${k}">${t}</button>`;
    return `<section class="sis-tarjeta">
      <h2>Pronóstico para volar</h2>
      <form class="vu-pron-form sis-form" data-form="pronostico">
        <div class="sis-campo"><span>¿Dónde consultar?</span><div class="vu-segmentos">${modoBtn('plan', 'Plan')}${modoBtn('gps', 'Mi ubicación')}${modoBtn('coord', 'Coordenadas')}</div></div>
        ${st.pronModo === 'plan' ? (lista.length ? `<label class="sis-campo"><span>Plan</span><select name="pronPlanId">${lista.map(x => `<option value="${esc(x.id)}" ${x.id === st.pronPlanId ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>
            ${elegido ? (() => { const { lat0, lon0 } = proyectar(elegido.anillo); const ha = areaM2(proyectar(elegido.anillo).puntos) / 10000; return `<div class="vu-plan-tarjeta"><b>${esc(elegido.nombre)}</b><span class="sis-tenue">${fmt(ha, 2)} ha · centro ${fmt(lat0, 5)}, ${fmt(lon0, 5)}</span></div>`; })() : ''}`
          : '<div class="sis-vacio"><p>No hay planes con área. Carga un KMZ en «Planificar» o usa tu ubicación o coordenadas.</p></div>') : ''}
        ${st.pronModo === 'coord' ? `<div class="sis-par">
          <label class="sis-campo"><span>Latitud</span><input name="lat" value="${esc(st.pronLat)}" placeholder="-32.83" inputmode="decimal" required></label>
          <label class="sis-campo"><span>Longitud</span><input name="lon" value="${esc(st.pronLon)}" placeholder="-70.60" inputmode="decimal" required></label>
        </div>` : ''}
        ${st.pronModo === 'gps' ? `<p class="sis-tenue">${st.pronOrigen === 'tu ubicación actual' ? `Ubicación: ${esc(st.pronLat)}, ${esc(st.pronLon)}` : 'Se pide la ubicación del teléfono o computador al consultar.'}</p>` : ''}
        <label class="sis-campo"><span>Dron (para sus límites de viento)</span><select name="pronDron">${familias().map(([k, t]) => { const x = drones.find(d => (d.familia || d.id) === k); return `<option value="${x.id}" ${(drones.find(d => d.id === st.pronDron) || {}).familia === k || x.id === st.pronDron ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>
        <div class="sis-acciones"><button class="sis-btn primario" ${st.pronModo === 'plan' && !elegido ? 'disabled' : ''}>Consultar pronóstico</button></div>
      </form>
      ${cuerpo}
    </section>
    <section class="sis-tarjeta"><h2>Antes de volar, revisa también</h2>
      <div class="vu-enlaces">${ENLACES_CONSULTA.map(([t, u]) => `<a class="sis-btn chico" href="${u}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join('')}</div>
      <p class="sis-tenue">Ayuda para planificar con datos de Open-Meteo y NOAA. No reemplaza la evaluación del piloto, los NOTAM ni la autorización de la DGAC.</p>
    </section>`;
  }

  function mejorVentana(filas) {
    let mejor = null, ini = null;
    filas.forEach((f, i) => {
      if (f.ev.estado === 'go') { if (ini == null) ini = i; }
      if (f.ev.estado !== 'go' || i === filas.length - 1) {
        const fin = f.ev.estado === 'go' ? i : i - 1;
        if (ini != null && (!mejor || fin - ini > mejor[1] - mejor[0])) mejor = [ini, fin];
        if (f.ev.estado !== 'go') ini = null;
      }
    });
    return mejor ? [filas[mejor[0]].h.hora, filas[mejor[1]].h.hora] : null;
  }

  // ─────────── Planes y drones ───────────

  async function vistaPlanes() {
    const nomProy = id => (proyectos.find(p => p.id === id) || {}).nombre || (id === OFICINA_ID ? 'Oficina' : 'Sin proyecto');
    return `<section class="sis-tarjeta"><h2>Planes guardados</h2>
      ${planes.length ? `<div class="sis-lista">${planes.map(p => {
        const d = drones.find(x => x.id === p.dronId);
        const r = p.resumen || {};
        return `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(p.nombre)}</b>
          <span class="sis-tenue">${esc(nomProy(p.proyectoId))} · ${esc(d ? d.nombre.replace('DJI ', '') : p.dronId)}</span>
          <span class="sis-chips">${r.area ? `<span class="sis-chip gris">${fmt(r.area / 10000, 1)} ha</span>` : ''}${r.gsd ? `<span class="sis-chip gris">GSD ${fmt(r.gsd, 2)} cm</span>` : ''}${r.densidad ? `<span class="sis-chip gris">${fmt(r.densidad)} pts/m²</span>` : ''}${r.vuelos ? `<span class="sis-chip azul">${r.vuelos} batería${r.vuelos > 1 ? 's' : ''} · ${fmtDuracion(r.minTotal)}</span>` : ''}</span></span>
          <span class="sis-acciones"><button class="sis-btn chico" data-accion="abrir-plan" data-id="${p.id}">Abrir</button>
          <button class="sis-btn chico peligro" data-accion="eliminar-plan" data-id="${p.id}">Eliminar</button></span></div>`;
      }).join('')}</div>` : '<div class="sis-vacio"><p>Todavía no hay planes. Arma uno en «Planificar» y guárdalo en su proyecto.</p></div>'}
    </section>`;
  }

  function vistaDrones() {
    return `<p class="sis-tenue">Valores de referencia tomados de las fichas técnicas. Revísalos con la ficha de tu equipo: si corriges uno, se usa tu valor en todos los cálculos. El Matrice 300 aparece una vez por sensor. Los Mavic 2 Enterprise no están porque se usan solo para termografía.</p>
      ${drones.map(d => `<section class="sis-tarjeta"><div class="sis-cab"><h2>${esc(d.nombre)}</h2>${d.corregido ? '<span class="sis-chip ambar">Corregido</span>' : ''}</div>
        <form class="sis-form vu-dron" data-form="dron" data-id="${d.id}"><div class="vu-grilla">
          ${CAMPOS_DRON.map(([k, t, u]) => campo(k, t, d[k], '', u)).join('')}
          ${d.lidar ? campo('lidarPps', 'LiDAR: puntos por segundo', d.lidar.puntosPorSegundo, '', 'pts/s') + campo('lidarFov', 'LiDAR: campo de visión', d.lidar.fovGrados, '', '°') : ''}
        </div><div class="sis-acciones"><button class="sis-btn chico primario">Guardar</button>
        ${d.corregido ? `<button type="button" class="sis-btn chico" data-accion="restablecer-dron" data-id="${d.id}">Volver a los valores de fábrica</button>` : ''}</div></form>
      </section>`).join('')}`;
  }

  async function render() {
    if (!activo) return;
    await cargarBase();
    const vistas = { planificar: vistaPlanificar, kml: vistaKml, pronostico: vistaPronostico, planes: vistaPlanes, drones: vistaDrones };
    const html = await vistas[st.tab]();
    if (!activo) return;
    raiz.innerHTML = `<nav class="vu-nav" aria-label="Vuelos">${PESTANAS.map(([id, t]) => `<button class="vu-pestana${id === st.tab ? ' activa' : ''}" data-accion="tab" data-tab="${id}">${t}</button>`).join('')}</nav>
      ${st.mensaje ? `<div class="vu-msg ${st.mensaje.tipo}">${esc(st.mensaje.texto)}</div>` : ''}
      <div class="sis-vista">${html}</div>`;
    st.mensaje = null;
    if (st.tab === 'planificar') actualizarMapa();
    if (st.tab === 'kml') mapaKml();
  }

  // ─────────── Eventos ───────────

  const num = v => String(v).replace(',', '.').trim();

  function leerFormPlan(form, objetivo) {
    const fd = new FormData(form);
    const P = st.params;
    const d0 = dronActual();
    for (const k of ['traslapeFrontal', 'traslapeLateral', 'reserva', 'minDespegue', 'minCambio', 'segGiro', 'exposicion', 'areaHa']) {
      if (fd.has(k)) P[k] = num(fd.get(k));
    }
    if (fd.has('modo')) P.modo = fd.get('modo');
    if (!objetivo) return;
    const nombre = objetivo.name || objetivo.dataset.espejo;
    const valor = num(objetivo.value);
    const d = d0;
    if (nombre === 'gsd' && Number(valor) > 0) {
      P.porGsd = true; P.gsd = valor;
      ponerValor('altura', Math.round(alturaParaGsd(d, Number(valor))));
    } else if (nombre === 'altura' && Number(valor) > 0) {
      P.porGsd = false; P.altura = valor;
      ponerValor('gsd', Math.round(gsdCm(d, Number(valor)) * 100) / 100);
    } else if (nombre === 'velocidad' && Number(valor) > 0) {
      P.velocidad = valor;
      const nota = raiz.querySelector('label[for="vu-velocidad"] small'); if (nota) nota.remove();
    } else if (['traslapeFrontal', 'traslapeLateral'].includes(nombre)) {
      P[nombre] = valor;
    }
    if (objetivo.dataset.espejo) ponerValor(nombre, valor); else if (objetivo.type === 'range') { const e = raiz.querySelector(`input[data-espejo="${nombre}"]`); if (e) e.value = valor; }
  }

  raiz.addEventListener('input', ev => {
    const t = ev.target;
    const form = t.closest('form[data-form="plan"]');
    if (form && t.type !== 'file' && t.tagName !== 'SELECT' && t.type !== 'radio') { leerFormPlan(form, t); refrescarResultados(); return; }
    if (t.dataset.vel) { const v = Number(num(t.value)); if (v > 0) { st[t.dataset.vel] = v; const det = raiz.querySelector('.vu-opciones'); if (det) { const r = resultado(); const nuevo = document.createElement('div'); nuevo.innerHTML = htmlTablaGsd(r); const sel = t.dataset.vel; det.replaceWith(nuevo.firstElementChild); const i = raiz.querySelector(`input[data-vel="${sel}"]`); if (i) { i.focus(); i.setSelectionRange?.(99, 99); } } } return; }
    if (t.dataset.campo === 'maxVertices') st.maxVertices = Math.max(4, Number(t.value) || 200);
    if (t.name === 'nombrePlan') st.nombrePlan = t.value;
  });

  raiz.addEventListener('change', async ev => {
    const t = ev.target;
    const form = t.closest('form[data-form="plan"]');
    if (t.dataset.archivo && t.files && t.files[0]) {
      const archivo = t.files[0];
      try {
        const analisis = analizarKml(await leerArchivo(archivo), archivo.name);
        if (t.dataset.archivo === 'kml') { st.kml = analisis; st.kmlError = ''; }
        else {
          if (!analisis.poligonos.length) throw new Error('El archivo no tiene polígonos ni polilíneas de 3 o más vértices.');
          st.poligonos = analisis.poligonos; st.polSel = 0; st.archivo = archivo.name; st.dibujando = false;
          st.params.despegue = null; st.params.rumbo = '';
          if (!st.nombrePlan) st.nombrePlan = analisis.poligonos[0].nombre;
          if (analisis.poligonos[0].area > 2000 * 10000) avisar(`El polígono tiene ${fmt(analisis.poligonos[0].area / 10000, 0)} ha: revisa que sea el área de vuelo.`, 'error');
        }
      } catch (e) {
        if (t.dataset.archivo === 'kml') { st.kml = null; st.kmlError = e.message; } else avisar(e.message, 'error');
      }
      await render();
      return;
    }
    if (t.dataset.campo === 'polSel') { st.polSel = Number(t.value); st.params.despegue = null; st.params.rumbo = ''; await render(); return; }
    if (form && (t.name === 'familia' || t.name === 'dronId' || t.name === 'modo')) {
      const altura = alturaDe(st.params, dronActual());
      if (t.name === 'familia') { const x = drones.find(d => (d.familia || d.id) === t.value); if (x) st.params.dronId = x.id; }
      if (t.name === 'dronId') st.params.dronId = t.value;
      if (t.name === 'modo') {
        st.params.modo = t.value;
        if (st.params.modo === 'lidar' && Number(st.params.traslapeLateral) > 60) st.params.traslapeLateral = '50';
        if (st.params.modo === 'foto' && Number(st.params.traslapeLateral) < 60) st.params.traslapeLateral = '70';
      }
      if (!st.params.porGsd) st.params.altura = String(Math.round(altura));
      if (Number(st.params.velocidad) > dronActual().velocidadMaxMs) st.params.velocidad = '';
      await render();
      return;
    }
    if (form) return; // los campos del plan ya se procesaron en «input» (rehacer aquí borraría el botón que se está tocando)
    if (t.name === 'proyectoId') st.proyectoId = t.value;
    if (t.name === 'pronPlanId') { st.pronPlanId = t.value; await render(); }
    if (t.name === 'pronDron') st.pronDron = t.value;
  });

  raiz.addEventListener('submit', async ev => {
    ev.preventDefault();
    const form = ev.target;
    try {
      if (form.dataset.form === 'plan') return;
      if (form.dataset.form === 'guardar') {
        const r = resultado();
        const pol = polActual();
        const fd = new FormData(form);
        const limpio = pol ? limpiarParaDji(pol, { maxVertices: st.maxVertices }) : null;
        const params = { ...st.params, ...(st.params.porGsd ? { gsd: String(Math.round(r.gsd * 100) / 100) } : {}) };
        const plan = await guardarPlan({
          ...(st.planId ? { id: st.planId } : {}),
          nombre: String(fd.get('nombrePlan')).trim(), proyectoId: fd.get('proyectoId') || null,
          dronId: st.params.dronId, params,
          poligono: limpio ? { nombre: pol.nombre, anillo: limpio.anillo } : null,
          resumen: r && !r.sinArea ? { area: r.area, gsd: r.modo === 'foto' ? r.gsd : null, altura: r.altura, densidad: r.densidad, vuelos: r.vuelos, minTotal: r.minTotal, fotos: r.fotos, modo: r.modo } : null,
        });
        st.planId = plan.id; st.nombrePlan = plan.nombre; st.proyectoId = plan.proyectoId || '';
        avisar('Plan guardado');
      } else if (form.dataset.form === 'pronostico') {
        const fd = new FormData(form);
        st.pronDron = fd.get('pronDron') || st.pronDron;
        if (st.pronModo === 'coord') {
          st.pronLat = num(fd.get('lat')); st.pronLon = num(fd.get('lon')); st.pronOrigen = 'Coordenadas escritas';
        } else if (st.pronModo === 'plan') {
          const x = planesConArea().find(y => y.id === (fd.get('pronPlanId') || st.pronPlanId));
          if (!x) throw new Error('Elige un plan con área.');
          const { lat0, lon0 } = proyectar(x.anillo);
          st.pronLat = lat0.toFixed(5); st.pronLon = lon0.toFixed(5); st.pronOrigen = `Centro de «${x.nombre.replace(' (sin guardar)', '')}»`;
        } else {
          if (!navigator.geolocation) throw new Error('Este navegador no entrega la ubicación.');
          const pos = await new Promise((ok, mal) => navigator.geolocation.getCurrentPosition(ok, mal, { enableHighAccuracy: false, timeout: 15000 }));
          st.pronLat = pos.coords.latitude.toFixed(5); st.pronLon = pos.coords.longitude.toFixed(5); st.pronOrigen = 'Tu ubicación actual';
        }
        await consultar();
        return;
      } else if (form.dataset.form === 'dron') {
        const fd = new FormData(form);
        const n = k => Number(num(fd.get(k)));
        const valores = Object.fromEntries(CAMPOS_DRON.map(([k]) => [k, n(k)]));
        if (fd.has('lidarPps')) valores.lidar = { puntosPorSegundo: n('lidarPps'), fovGrados: n('lidarFov') };
        if (Object.values(valores).some(v => typeof v === 'number' && !(v > 0))) throw new Error('Todos los valores deben ser números mayores que 0.');
        await guardarDron(form.dataset.id, valores);
        avisar('Datos del dron guardados');
      }
    } catch (e) { console.error(e); avisar(e.message || 'No se pudo completar', 'error'); }
    await render();
  });

  async function consultar() {
    const lat = Number(st.pronLat), lon = Number(st.pronLon);
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (!lat && !lon)) { st.pronError = 'Revisa la latitud y la longitud (grados decimales, por ejemplo -32.83 y -70.60).'; await render(); return; }
    st.pronCargando = true; st.pronError = ''; await render();
    try {
      const [p, kps] = await Promise.all([pedirPronostico(lat, lon), st.kps ? Promise.resolve(st.kps) : pedirKp()]);
      st.pron = p; st.kps = kps;
      if (!p.horas.some(h => h.fecha === st.dia)) st.dia = p.horas[0]?.fecha || st.dia;
    } catch (e) {
      st.pronError = `No se pudo consultar el pronóstico (${e.message}). Revisa la conexión a internet.`;
    }
    st.pronCargando = false;
    await render();
  }

  // Clic en el mapa mientras se dibuja (Leaflet entrega el evento por su lado).
  function alClicMapa(ev) {
    if (!st.dibujando || st.tab !== 'planificar') return;
    st.dibujo.push([ev.latlng.lng, ev.latlng.lat]);
    const barra = raiz.querySelector('#vu-barra'); if (barra) barra.innerHTML = htmlBarra(resultado());
    actualizarMapa();
  }

  raiz.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-accion]');
    if (!b) return;
    const a = b.dataset.accion;
    const P = st.params;
    try {
      if (a === 'tab') { st.tab = b.dataset.tab; }
      else if (a === 'dia') { st.dia = b.dataset.dia; }
      else if (a === 'pron-modo') { st.pronModo = b.dataset.m; }
      else if (a === 'rumbo' || a === 'rumbo-corto' || a === 'rumbo-auto') {
        const r = resultado(); if (!r || r.sinArea) return;
        if (a === 'rumbo') P.rumbo = String((((Math.round(r.rumbo) + Number(b.dataset.d)) % 180) + 180) % 180);
        else if (a === 'rumbo-auto') P.rumbo = '';
        else {
          const d = dronActual();
          const bb = base(P, d, { altura: alturaDe(P, d), velocidad: r.velocidad });
          P.rumbo = String(rumboMasCorto(bb));
          avisar(`Rumbo ${P.rumbo}°: el que da menos tiempo con este despegue (${fmtDuracion(calcularPlan({ ...bb, rumbo: Number(P.rumbo) }).minTotal)} de jornada).`);
          await render();
          return;
        }
        refrescarResultados();
        return;
      }
      else if (a === 'vel-auto') { P.velocidad = ''; refrescarResultados(); return; }
      else if (a === 'usar-gsd') {
        const g = Number(b.dataset.g); P.porGsd = true; P.gsd = String(g);
        ponerValor('gsd', g); ponerValor('altura', Math.round(alturaParaGsd(dronActual(), g)));
        refrescarResultados(); return;
      }
      else if (a === 'agregar-gsd') {
        const i = raiz.querySelector('input[data-campo="gsdNuevo"]'); const g = Math.round(Number(num(i && i.value)) * 100) / 100;
        if (!(g > 0.2 && g < 20)) { i && i.focus(); return; }
        if (!st.gsdExtra.includes(g)) st.gsdExtra.push(g);
        refrescarResultados(); return;
      }
      else if (a === 'quitar-gsd') { const g = Number(b.dataset.g); st.gsdExtra = st.gsdExtra.filter(x => x !== g); refrescarResultados(); return; }
      else if (a === 'copiar-tabla' || a === 'excel-tabla') {
        const r = resultado(); if (!r || r.sinArea) return;
        const filas = filasTablaTexto(r);
        const pol = polActual();
        const titulo = `${st.nombrePlan || (pol ? pol.nombre : 'Área')} · ${fmt(r.area / 10000, 2)} ha · ${r.d.nombre} · traslape ${P.traslapeFrontal}/${P.traslapeLateral} %`;
        if (a === 'copiar-tabla') {
          const anchos = filas[0].map((_, c) => Math.max(...filas.map(f => f[c].length)));
          const texto = [titulo, '', ...filas.map(f => f.map((v, c) => c === 0 ? v.padEnd(anchos[c]) : v.padStart(anchos[c])).join('   ')),
            '', 'Tiempo de vuelo estimado; no incluye traslados al lugar ni armado del equipo.' + (filas.some(f => f[1].endsWith('*')) ? ' * Sobre 120 m requiere autorización DGAC.' : '')].join('\n');
          await navigator.clipboard.writeText(texto);
          avisar('Tabla copiada: pégala en el correo.');
        } else {
          if (!globalThis.XLSX) await cargarScript('vendor/xlsx.full.min.js');
          const ws = XLSX.utils.aoa_to_sheet([[titulo], [], ...filas]);
          ws['!cols'] = [14, 12, 16, 10, 16, 10].map(w => ({ wch: w }));
          const libro = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(libro, ws, 'Opciones GSD');
          XLSX.writeFile(libro, `Opciones_GSD_${nombreArchivoSeguro(st.nombrePlan || (pol ? pol.nombre : 'area'))}.xlsx`);
          avisar('Excel descargado.');
        }
      }
      else if (a === 'dibujar') {
        if (st.dibujando) { st.dibujando = false; st.dibujo = []; }
        else { st.dibujando = true; st.dibujo = []; }
      }
      else if (a === 'dibujo-deshacer') { st.dibujo.pop(); const barra = raiz.querySelector('#vu-barra'); if (barra) barra.innerHTML = htmlBarra(resultado()); actualizarMapa(); return; }
      else if (a === 'dibujo-cancelar') { st.dibujando = false; st.dibujo = []; }
      else if (a === 'dibujo-terminar') {
        if (st.dibujo.length < 3) return;
        const pol = poligonoDesde('Área dibujada', st.dibujo);
        st.poligonos = [pol]; st.polSel = 0; st.archivo = 'dibujada en el mapa'; st.dibujando = false; st.dibujo = [];
        P.despegue = null; P.rumbo = '';
        if (!st.nombrePlan) st.nombrePlan = 'Área dibujada';
        if (pol.cruces) avisar('El contorno dibujado se cruza consigo mismo: dibújalo de nuevo siguiendo el borde.', 'error');
        else if (pol.area > 2000 * 10000) avisar(`El área dibujada tiene ${fmt(pol.area / 10000, 0)} ha: acerca el mapa al lugar y dibújala de nuevo.`, 'error');
      }
      else if (a === 'descargar-kml' || a === 'descargar-kml-plan') {
        const pol = a === 'descargar-kml' ? st.kml.poligonos[Number(b.dataset.i)] : polActual();
        const nombre = a === 'descargar-kml-plan' ? (st.nombrePlan || pol.nombre) : pol.nombre;
        const limpio = limpiarParaDji(pol, { maxVertices: st.maxVertices });
        descargar(`${nombreArchivoSeguro(nombre)}.kml`, kmlDePoligono(nombre, limpio.anillo), 'application/vnd.google-earth.kml+xml');
        avisar(limpio.verticesOriginales > limpio.vertices
          ? `Descargado: ${limpio.verticesOriginales} → ${limpio.vertices} vértices (tolerancia ${fmt(limpio.toleranciaM, 2)} m).`
          : `Descargado con ${limpio.vertices} vértices.`);
        if (pol.cruces) avisar('Descargado, pero el contorno se cruza consigo mismo: corrígelo antes de usarlo en el control.', 'error');
      }
      else if (a === 'usar-en-plan') {
        const pol = st.kml.poligonos[Number(b.dataset.i)];
        st.poligonos = [pol]; st.polSel = 0; st.archivo = st.kml.archivo; st.nombrePlan = pol.nombre; st.planId = null; st.tab = 'planificar';
        P.despegue = null; P.rumbo = '';
      }
      else if (a === 'pronostico-plan') {
        const pol = polActual(); if (!pol) return;
        st.pronModo = 'plan'; st.pronPlanId = st.planId || 'actual'; st.pronDron = P.dronId; st.tab = 'pronostico';
        const { lat0, lon0 } = proyectar(pol.anillo);
        st.pronLat = lat0.toFixed(5); st.pronLon = lon0.toFixed(5); st.pronOrigen = `Centro de «${st.nombrePlan || pol.nombre}»`;
        await consultar();
        return;
      }
      else if (a === 'nuevo-plan') { st.planId = null; st.nombrePlan = ''; st.poligonos = []; st.archivo = ''; st.params = { ...PARAMS_INICIALES }; st.gsdExtra = []; }
      else if (a === 'abrir-plan') { await abrirPlan(b.dataset.id); }
      else if (a === 'eliminar-plan') {
        if (!confirm('¿Eliminar este plan de vuelo?')) return;
        await eliminarPlan(b.dataset.id);
        if (st.planId === b.dataset.id) st.planId = null;
        avisar('Plan eliminado');
      }
      else if (a === 'restablecer-dron') { await restablecerDron(b.dataset.id); avisar('Valores de fábrica restablecidos'); }
      else return;
    } catch (e) { console.error(e); avisar(e.message || 'No se pudo completar', 'error'); }
    await render();
  });

  (async () => {
    if (ctx.planId) await abrirPlan(ctx.planId);
    await render();
  })();

  return {
    desmontar() { activo = false; for (const m of Object.values(mapas)) m.mapa.remove(); raiz.remove(); },
    refrescar() { if (st.tab === 'planes' || st.tab === 'drones') render(); },
  };
}
