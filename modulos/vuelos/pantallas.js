// modulos/vuelos/pantallas.js — pantallas del módulo Vuelos: Planificar, Limpiar KML, Pronóstico, Planes y Drones.
// Usa las clases visuales del Sistema (sis-…) más las propias (vu-…) de vuelos.css.

import { escapar as esc, fechaLegible, descargar, hoyISO } from '../../compartido/util.js';
import { listarProyectos, OFICINA_ID } from '../../compartido/catalogos.js';
import {
  fijarPersona, listarDrones, guardarDron, restablecerDron, listarPlanes, obtenerPlan, guardarPlan, eliminarPlan,
} from './datos.js';
import { CAMPOS_DRON } from './drones.js';
import { calcularPlan, proyectar, alturaParaGsd, gsdCm, fmt, fmtDuracion } from './calculo.js';
import { leerArchivo, analizarKml, limpiarParaDji, kmlDePoligono, nombreArchivoSeguro } from './kml.js';
import { pedirPronostico, pedirKp, kpEnHora, evaluarHora, ENLACES_CONSULTA } from './pronostico.js';

const PESTANAS = [
  ['planificar', 'Planificar'], ['kml', 'Limpiar KML'], ['pronostico', 'Pronóstico'], ['planes', 'Planes guardados'], ['drones', 'Drones'],
];

const PARAMS_INICIALES = {
  dronId: 'm4e', modo: 'foto', porGsd: true, gsd: 2.5, altura: 100, traslapeFrontal: 80, traslapeLateral: 70,
  velocidad: '', exposicion: 1000, reserva: 25, minDespegue: 3, minCambio: 5, segGiro: 8, areaHa: '', rumbo: '',
};

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
    kml: null, kmlError: '', maxVertices: 200,
    pron: null, pronError: '', pronCargando: false, kps: null, dia: hoyISO(), pronLat: '', pronLon: '', pronDron: 'm4e', pronOrigen: '',
    mensaje: null,
  };
  let drones = [], proyectos = [];

  const dronActual = () => drones.find(d => d.id === st.params.dronId) || drones[0];
  const polActual = () => st.poligonos[st.polSel] || null;
  const avisar = (texto, tipo = 'ok') => { st.mensaje = { texto, tipo }; };

  async function cargarBase() {
    [drones, proyectos] = await Promise.all([listarDrones(), listarProyectos()]);
  }

  async function abrirPlan(id) {
    const p = await obtenerPlan(id);
    if (!p) return;
    st.planId = p.id; st.nombrePlan = p.nombre; st.proyectoId = p.proyectoId || '';
    st.params = { ...PARAMS_INICIALES, ...p.params };
    st.poligonos = p.poligono ? [{ nombre: p.poligono.nombre, anillo: p.poligono.anillo, coords: p.poligono.anillo, vertices: p.poligono.anillo.length, problemas: [] }] : [];
    st.polSel = 0; st.archivo = p.poligono ? 'guardado en el plan' : '';
    st.tab = 'planificar';
  }

  // ─────────── Cálculo ───────────

  function resultado() {
    const d = dronActual();
    if (!d) return null;
    const P = st.params;
    const modo = P.modo === 'lidar' && d.lidar ? 'lidar' : 'foto';
    const altura = P.porGsd ? alturaParaGsd(d, Number(P.gsd) || 1) : Number(P.altura) || 1;
    const pol = polActual();
    const puntos = pol ? proyectar(pol.anillo).puntos : null;
    const base = {
      dron: d, modo, altura,
      traslapeFrontal: (Number(P.traslapeFrontal) || 0) / 100, traslapeLateral: (Number(P.traslapeLateral) || 0) / 100,
      exposicion: 1 / (Number(P.exposicion) || 1000), reserva: (Number(P.reserva) || 0) / 100,
      minDespegue: Number(P.minDespegue) || 0, minCambio: Number(P.minCambio) || 0, segGiro: Number(P.segGiro) || 0,
      puntos, areaHa: Number(P.areaHa) || 0, rumbo: P.rumbo === '' ? undefined : Number(P.rumbo), fotosEnLidar: false,
    };
    if (!puntos && !base.areaHa) return { sinArea: true, altura, modo, d };
    // Velocidad: si no se indica, la sugerida (la menor de las velocidades límite).
    const previo = calcularPlan({ ...base, velocidad: 10 });
    const velocidad = Number(P.velocidad) || Math.floor(previo.velSugerida * 10) / 10;
    return { ...calcularPlan({ ...base, velocidad }), altura, modo, velocidad, d, auto: !Number(P.velocidad) };
  }

  // ─────────── Vistas ───────────

  const opcionesProyectos = sel => `<option value="">Sin proyecto</option>` + proyectos.map(p => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.id === OFICINA_ID ? 'Oficina' : p.nombre)}</option>`).join('');
  const campo = (nombre, etiqueta, valor, extra = '', sufijo = '') => `<label class="sis-campo"><span>${etiqueta}</span>
    <span class="vu-con-sufijo"><input name="${nombre}" value="${esc(valor)}" inputmode="decimal" ${extra}>${sufijo ? `<em>${sufijo}</em>` : ''}</span></label>`;

  function vistaPlanificar() {
    const P = st.params, d = dronActual(), pol = polActual();
    return `<div class="vu-planificar">
      <form class="vu-form sis-form" data-form="plan" autocomplete="off">
        <fieldset><legend>Área</legend>
          <label class="sis-btn vu-archivo">Cargar KML / KMZ<input type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" data-archivo="plan" hidden></label>
          ${st.archivo ? `<p class="sis-tenue">Archivo: <b>${esc(st.archivo)}</b></p>` : ''}
          ${st.poligonos.length > 1 ? `<label class="sis-campo"><span>Polígono</span><select data-campo="polSel">${st.poligonos.map((p, i) => `<option value="${i}" ${i === st.polSel ? 'selected' : ''}>${esc(p.nombre)} · ${fmt(p.area / 10000, 2)} ha</option>`).join('')}</select></label>` : ''}
          ${pol && pol.problemas && pol.problemas.length ? `<div class="vu-aviso"><b>Este polígono tiene detalles para el control:</b><ul>${pol.problemas.map(t => `<li>${esc(t)}</li>`).join('')}</ul><span>Al descargar el KML limpio se corrigen, salvo los cruces.</span></div>` : ''}
          ${pol ? '' : campo('areaHa', 'O escribe el área (sin polígono)', P.areaHa, 'placeholder="0"', 'ha')}
        </fieldset>
        <fieldset><legend>Dron y vuelo</legend>
          <label class="sis-campo"><span>Dron</span><select name="dronId">${drones.map(x => `<option value="${x.id}" ${x.id === P.dronId ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>
          ${d && d.lidar ? `<div class="sis-campo"><span>Producto</span><div class="sis-opciones">
            <label class="sis-opcion"><input type="radio" name="modo" value="foto" ${P.modo !== 'lidar' ? 'checked' : ''}> Fotogrametría</label>
            <label class="sis-opcion"><input type="radio" name="modo" value="lidar" ${P.modo === 'lidar' ? 'checked' : ''}> LiDAR</label></div></div>` : ''}
          <div class="sis-campo"><span>Definir por</span><div class="sis-opciones">
            <label class="sis-opcion"><input type="radio" name="porGsd" value="1" ${P.porGsd ? 'checked' : ''}> GSD objetivo</label>
            <label class="sis-opcion"><input type="radio" name="porGsd" value="0" ${!P.porGsd ? 'checked' : ''}> Altura</label></div></div>
          ${P.porGsd ? campo('gsd', 'GSD objetivo', P.gsd, '', 'cm/px') : campo('altura', 'Altura sobre el terreno', P.altura, '', 'm')}
          <div class="sis-par">
            ${campo('traslapeFrontal', 'Traslape frontal', P.traslapeFrontal, '', '%')}
            ${campo('traslapeLateral', 'Traslape lateral', P.traslapeLateral, '', '%')}
          </div>
          <div class="sis-par">
            ${campo('velocidad', 'Velocidad', P.velocidad, 'placeholder="automática"', 'm/s')}
            ${campo('rumbo', 'Rumbo de las líneas', P.rumbo, 'placeholder="automático"', '°')}
          </div>
        </fieldset>
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
      </form>
      <div class="vu-resultado" id="vu-resultado">${htmlResultado()}</div>
    </div>`;
  }

  function htmlResultado() {
    const r = resultado();
    if (!r) return '';
    if (r.sinArea) return `<section class="sis-tarjeta"><h2>Resultado</h2>
      <p class="sis-tenue">Carga un KML/KMZ del área o escribe las hectáreas para calcular líneas, fotos, tiempo y baterías.</p>
      <div class="vu-kpis">${kpi('Altura', `${fmt(r.altura, 0)} m`)}${kpi('GSD', `${fmt(gsdCm(r.d, r.altura), 2)} cm/px`)}</div></section>`;
    const pol = polActual();
    return `<section class="sis-tarjeta">
      <h2>Resultado${r.d.corregido ? ' <span class="sis-chip gris">datos del dron corregidos</span>' : ''}</h2>
      <div class="vu-kpis">
        ${kpi('Altura', `${fmt(r.altura, 0)} m`)}
        ${kpi('GSD', `${fmt(r.gsd, 2)} cm/px`)}
        ${r.densidad ? kpi('Densidad LiDAR', `${fmt(r.densidad, 0)} pts/m²`) : kpi('Fotos', fmt(r.fotos))}
        ${kpi('Vuelos / baterías', fmt(r.vuelos))}
        ${kpi('Tiempo en el aire', fmtDuracion(r.minMision))}
        ${kpi('Jornada de vuelo', fmtDuracion(r.minTotal))}
      </div>
      ${r.avisos.length ? `<div class="vu-aviso"><ul>${r.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      ${pol ? svgPreview(pol, r) : ''}
      <dl class="vu-tabla">
        ${fila('Área', `${fmt(r.area / 10000, 2)} ha`)}
        ${r.rumbo != null ? fila('Rumbo de las líneas', `${fmt(r.rumbo, 0)}°${st.params.rumbo === '' ? ' (lado más largo)' : ''}`) : ''}
        ${fila('Huella de la foto', `${fmt(r.huellaAncho, 0)} × ${fmt(r.huellaLargo, 0)} m`)}
        ${r.barrido ? fila('Ancho de barrido LiDAR', `${fmt(r.barrido, 0)} m`) : ''}
        ${fila('Separación entre líneas', `${fmt(r.sepLineas, 1)} m · ${fmt(r.nLineas)} líneas`)}
        ${r.modo === 'foto' ? fila('Distancia entre fotos', `${fmt(r.sepFotos, 1)} m · cada ${fmt(r.intervalo, 1)} s`) : fila('Densidad en una pasada', `${fmt(r.densidadPasada, 0)} pts/m²`)}
        ${fila('Distancia de vuelo', `${fmt(r.distancia / 1000, 2)} km`)}
        ${fila('Velocidad', `${fmt(r.velocidad, 1)} m/s${r.auto ? ' (sugerida)' : ''}`)}
        ${fila('Límites de velocidad', r.limites.map(([t, v]) => `${t}: ${fmt(v, 1)}`).join(' · ') + ' m/s')}
        ${fila('Tiempo útil por batería', `${fmt(r.minUtiles, 0)} min`)}
      </dl>
      <p class="sis-tenue">Estimación para planificar y cotizar. El GSD es sobre el punto de despegue: en terreno con desnivel cambia. El vuelo se programa en DJI Pilot 2.</p>
    </section>
    <section class="sis-tarjeta">
      <h2>Guardar y exportar</h2>
      <form class="vu-guardar" data-form="guardar">
        <label class="sis-campo"><span>Nombre del plan</span><input name="nombrePlan" value="${esc(st.nombrePlan || (pol ? pol.nombre : ''))}" required></label>
        <label class="sis-campo"><span>Proyecto</span><select name="proyectoId">${opcionesProyectos(st.proyectoId)}</select></label>
        <div class="sis-acciones">
          <button class="sis-btn primario">${st.planId ? 'Guardar cambios' : 'Guardar plan'}</button>
          ${pol ? '<button type="button" class="sis-btn" data-accion="descargar-kml-plan">Descargar KML limpio</button>' : ''}
          ${pol ? '<button type="button" class="sis-btn" data-accion="pronostico-plan">Ver pronóstico</button>' : ''}
          ${st.planId ? '<button type="button" class="sis-btn" data-accion="nuevo-plan">Nuevo plan</button>' : ''}
        </div>
      </form>
    </section>`;
  }

  const kpi = (t, v) => `<div class="vu-kpi"><span>${t}</span><b>${v}</b></div>`;
  const fila = (t, v) => `<div><dt>${t}</dt><dd>${v}</dd></div>`;

  function svgPreview(pol, r) {
    const { puntos } = proyectar(pol.anillo);
    const xs = puntos.map(p => p[0]), ys = puntos.map(p => p[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const W = 360, H = 220, m = 12;
    const k = Math.min((W - 2 * m) / ((maxx - minx) || 1), (H - 2 * m) / ((maxy - miny) || 1));
    const ox = (W - (maxx - minx) * k) / 2, oy = (H - (maxy - miny) * k) / 2;
    const tx = ([x, y]) => [ox + (x - minx) * k, H - (oy + (y - miny) * k)];
    const pts = puntos.map(tx).map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
    let lineas = '';
    if (r.segmentos && r.segmentos.length && r.rumbo != null) {
      const a = (90 - r.rumbo) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const desrot = (x, y) => [x * c - y * s, x * s + y * c];
      lineas = r.segmentos.slice(0, 400).map(l => {
        const [p1, p2] = [tx(desrot(l.x1, l.y)), tx(desrot(l.x2, l.y))];
        return `<line x1="${p1[0].toFixed(1)}" y1="${p1[1].toFixed(1)}" x2="${p2[0].toFixed(1)}" y2="${p2[1].toFixed(1)}"/>`;
      }).join('');
    }
    return `<svg class="vu-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Polígono del área con ${r.nLineas} líneas de vuelo">
      <polygon points="${pts}" class="vu-pol"/><g class="vu-lineas">${lineas}</g></svg>
      <p class="sis-tenue vu-pie">Vista esquemática (norte arriba): contorno y líneas de vuelo.</p>`;
  }

  function vistaKml() {
    const a = st.kml;
    return `<section class="sis-tarjeta">
      <h2>Limpiar un KML o KMZ para DJI Pilot 2</h2>
      <p>Revisa el archivo que te enviaron y deja cada polígono como lo lee el control: un solo contorno por archivo, sin altura, cerrado, sin vértices repetidos y con pocos vértices.</p>
      <div class="sis-acciones">
        <label class="sis-btn primario vu-archivo">Elegir archivo<input type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" data-archivo="kml" hidden></label>
        <label class="sis-campo vu-mini"><span>Máximo de vértices</span><input data-campo="maxVertices" value="${st.maxVertices}" inputmode="numeric"></label>
      </div>
      ${st.kmlError ? `<div class="sis-error">${esc(st.kmlError)}</div>` : ''}
    </section>
    ${a ? `<section class="sis-tarjeta">
      <h2>${esc(a.archivo)}</h2>
      <p class="sis-tenue">${a.placemarks} elemento${a.placemarks === 1 ? '' : 's'} · ${a.poligonos.length} polígono${a.poligonos.length === 1 ? '' : 's'} utilizable${a.poligonos.length === 1 ? '' : 's'}${a.lineas ? ` · ${a.lineas} línea${a.lineas > 1 ? 's' : ''}` : ''}${a.puntos ? ` · ${a.puntos} punto${a.puntos > 1 ? 's' : ''} (se ignoran)` : ''}${a.carpetas ? ` · ${a.carpetas} carpeta${a.carpetas > 1 ? 's' : ''}` : ''}</p>
      ${a.poligonos.length ? `<div class="sis-lista">${a.poligonos.map((p, i) => `<div class="sis-fila vu-kml-fila">
        <span class="sis-fila-txt"><b>${esc(p.nombre)}</b><span class="sis-tenue">${fmt(p.area / 10000, 2)} ha · ${p.vertices} vértices</span>
          ${p.problemas.length ? `<ul class="vu-problemas">${p.problemas.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<span class="sis-chip verde">Sin problemas</span>'}</span>
        <span class="sis-acciones"><button class="sis-btn chico" data-accion="descargar-kml" data-i="${i}">Descargar limpio</button>
          <button class="sis-btn chico" data-accion="usar-en-plan" data-i="${i}">Planificar</button></span></div>`).join('')}</div>
        <p class="sis-tenue">Cada polígono se descarga como un archivo aparte, que es lo que el control importa mejor.</p>`
        : '<div class="sis-vacio"><p>No encontré polígonos ni polilíneas de 3 o más vértices en este archivo.</p></div>'}
    </section>` : ''}`;
  }

  function vistaPronostico() {
    const p = st.pron;
    const dron = drones.find(d => d.id === st.pronDron) || drones[0];
    let cuerpo = '';
    if (st.pronCargando) cuerpo = '<p class="sis-tenue">Consultando el pronóstico…</p>';
    else if (st.pronError) cuerpo = `<div class="sis-error">${esc(st.pronError)}</div>`;
    else if (p) {
      const dias = [...new Set(p.horas.map(h => h.fecha))];
      const horas = p.horas.filter(h => h.fecha === st.dia && h.hora >= 6 && h.hora <= 21);
      const filas = horas.map(h => ({ h, kp: kpEnHora(st.kps, h.t), ev: null })).map(x => ({ ...x, ev: evaluarHora(x.h, dron, { kp: x.kp, solMin: 5 }) }));
      const ventana = mejorVentana(filas);
      const sol = p.dias.find(d => d.fecha === st.dia);
      cuerpo = `<div class="vu-dias">${dias.map(d => `<button class="sis-menu-chip${d === st.dia ? ' activo' : ''}" data-accion="dia" data-dia="${d}">${fechaLegible(d)}</button>`).join('')}</div>
        <div class="vu-resumen-dia">
          ${ventana ? `<span class="sis-chip verde">Ventana GO: ${ventana[0]}:00 – ${ventana[1] + 1}:00</span>` : '<span class="sis-chip rojo">Sin ventana GO este día</span>'}
          ${sol ? `<span class="sis-chip gris">Sol: ${sol.salida?.slice(11, 16) || '—'} – ${sol.puesta?.slice(11, 16) || '—'}</span>` : ''}
          <span class="sis-chip gris">Límites ${esc(dron.nombre.replace('DJI ', ''))}: viento ${dron.vientoMaxMs} · ráfaga ${dron.rafagaMaxMs} m/s</span>
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
        <p class="sis-tenue">Viento: promedio de ${p.horas[0]?.modelos || 0} modelos (ECMWF, GFS, ICON) y entre paréntesis el rango entre ellos; si el rango es amplio, el pronóstico es inseguro. La ráfaga a 120 m es estimada. La flecha indica hacia dónde sopla. ${st.kps ? '' : 'No se pudo leer el índice Kp (NOAA). '}Modelos globales: en valles y faenas de cordillera el viento real puede diferir; mide en terreno.</p>`;
    }
    return `<section class="sis-tarjeta">
      <h2>Pronóstico para volar</h2>
      <form class="vu-pron-form" data-form="pronostico">
        <div class="sis-par">
          <label class="sis-campo"><span>Latitud</span><input name="lat" value="${esc(st.pronLat)}" placeholder="-32.83" inputmode="decimal" required></label>
          <label class="sis-campo"><span>Longitud</span><input name="lon" value="${esc(st.pronLon)}" placeholder="-70.60" inputmode="decimal" required></label>
        </div>
        <label class="sis-campo"><span>Dron (para sus límites)</span><select name="pronDron">${drones.map(x => `<option value="${x.id}" ${x.id === st.pronDron ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>
        ${st.pronOrigen ? `<p class="sis-tenue">Ubicación: ${esc(st.pronOrigen)}</p>` : ''}
        <div class="sis-acciones"><button class="sis-btn primario">Consultar pronóstico</button>
          <button type="button" class="sis-btn" data-accion="gps">Usar mi ubicación</button>
          ${polActual() ? '<button type="button" class="sis-btn" data-accion="pronostico-plan">Centro del polígono</button>' : ''}</div>
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

  async function vistaPlanes() {
    const planes = await listarPlanes();
    const nomProy = id => (proyectos.find(p => p.id === id) || {}).nombre || (id === OFICINA_ID ? 'Oficina' : 'Sin proyecto');
    return `<section class="sis-tarjeta"><h2>Planes guardados</h2>
      ${planes.length ? `<div class="sis-lista">${planes.map(p => {
        const d = drones.find(x => x.id === p.dronId);
        const r = p.resumen || {};
        return `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(p.nombre)}</b>
          <span class="sis-tenue">${esc(nomProy(p.proyectoId))} · ${esc(d ? d.nombre.replace('DJI ', '') : p.dronId)}</span>
          <span class="sis-chips">${r.area ? `<span class="sis-chip gris">${fmt(r.area / 10000, 1)} ha</span>` : ''}${r.gsd ? `<span class="sis-chip gris">GSD ${fmt(r.gsd, 2)} cm</span>` : ''}${r.densidad ? `<span class="sis-chip gris">${fmt(r.densidad)} pts/m²</span>` : ''}${r.vuelos ? `<span class="sis-chip azul">${r.vuelos} vuelo${r.vuelos > 1 ? 's' : ''} · ${fmtDuracion(r.minTotal)}</span>` : ''}</span></span>
          <span class="sis-acciones"><button class="sis-btn chico" data-accion="abrir-plan" data-id="${p.id}">Abrir</button>
          <button class="sis-btn chico peligro" data-accion="eliminar-plan" data-id="${p.id}">Eliminar</button></span></div>`;
      }).join('')}</div>` : '<div class="sis-vacio"><p>Todavía no hay planes. Arma uno en «Planificar» y guárdalo en su proyecto.</p></div>'}
    </section>`;
  }

  function vistaDrones() {
    return `<p class="sis-tenue">Valores de referencia tomados de las fichas técnicas. Revísalos con la ficha de tu equipo: si corriges uno, se usa tu valor en todos los cálculos. Los Mavic 2 Enterprise no están porque se usan solo para termografía.</p>
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
  }

  // ─────────── Eventos ───────────

  function leerFormPlan(form) {
    const fd = new FormData(form);
    const P = st.params;
    for (const k of ['dronId', 'gsd', 'altura', 'traslapeFrontal', 'traslapeLateral', 'velocidad', 'rumbo', 'reserva', 'minDespegue', 'minCambio', 'segGiro', 'exposicion', 'areaHa']) {
      if (fd.has(k)) P[k] = String(fd.get(k)).replace(',', '.').trim();
    }
    if (fd.has('modo')) P.modo = fd.get('modo');
    if (fd.has('porGsd')) P.porGsd = fd.get('porGsd') === '1';
  }

  raiz.addEventListener('input', ev => {
    const form = ev.target.closest('form[data-form="plan"]');
    if (form) { leerFormPlan(form); const r = raiz.querySelector('#vu-resultado'); if (r) r.innerHTML = htmlResultado(); return; }
    if (ev.target.dataset.campo === 'maxVertices') st.maxVertices = Math.max(4, Number(ev.target.value) || 200);
    if (ev.target.name === 'nombrePlan') st.nombrePlan = ev.target.value;
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
          st.poligonos = analisis.poligonos; st.polSel = 0; st.archivo = archivo.name;
          if (!st.nombrePlan) st.nombrePlan = analisis.poligonos[0].nombre;
        }
      } catch (e) {
        if (t.dataset.archivo === 'kml') { st.kml = null; st.kmlError = e.message; } else avisar(e.message, 'error');
      }
      await render();
      return;
    }
    if (t.dataset.campo === 'polSel') { st.polSel = Number(t.value); await render(); return; }
    if (form && (t.name === 'dronId' || t.name === 'modo' || t.name === 'porGsd')) {
      leerFormPlan(form);
      if (t.name === 'porGsd') { // conserva el equivalente al cambiar de GSD a altura
        const d = dronActual(); const r = resultado();
        if (r && !st.params.porGsd) st.params.altura = String(Math.round(r.altura));
        if (r && st.params.porGsd && r.gsd) st.params.gsd = String(Math.round(r.gsd * 100) / 100);
        if (!d) return;
      }
      if (t.name === 'modo' && st.params.modo === 'lidar' && Number(st.params.traslapeLateral) > 60) st.params.traslapeLateral = '50';
      if (t.name === 'modo' && st.params.modo === 'foto' && Number(st.params.traslapeLateral) < 60) st.params.traslapeLateral = '70';
      await render();
    }
    if (t.name === 'proyectoId') st.proyectoId = t.value;
  });

  raiz.addEventListener('submit', async ev => {
    ev.preventDefault();
    const form = ev.target;
    try {
      if (form.dataset.form === 'guardar') {
        const r = resultado();
        const pol = polActual();
        const fd = new FormData(form);
        const limpio = pol ? limpiarParaDji(pol, { maxVertices: st.maxVertices }) : null;
        const plan = await guardarPlan({
          ...(st.planId ? { id: st.planId } : {}),
          nombre: String(fd.get('nombrePlan')).trim(), proyectoId: fd.get('proyectoId') || null,
          dronId: st.params.dronId, params: { ...st.params },
          poligono: limpio ? { nombre: pol.nombre, anillo: limpio.anillo } : null,
          resumen: r && !r.sinArea ? { area: r.area, gsd: r.modo === 'foto' ? r.gsd : null, altura: r.altura, densidad: r.densidad, vuelos: r.vuelos, minTotal: r.minTotal, fotos: r.fotos, modo: r.modo } : null,
        });
        st.planId = plan.id; st.nombrePlan = plan.nombre; st.proyectoId = plan.proyectoId || '';
        avisar('Plan guardado');
      } else if (form.dataset.form === 'pronostico') {
        const fd = new FormData(form);
        st.pronLat = String(fd.get('lat')).replace(',', '.'); st.pronLon = String(fd.get('lon')).replace(',', '.');
        st.pronDron = fd.get('pronDron'); st.pronOrigen = st.pronOrigen || 'coordenadas escritas';
        await consultar();
        return;
      } else if (form.dataset.form === 'dron') {
        const fd = new FormData(form);
        const num = k => Number(String(fd.get(k)).replace(',', '.'));
        const valores = Object.fromEntries(CAMPOS_DRON.map(([k]) => [k, num(k)]));
        if (fd.has('lidarPps')) valores.lidar = { puntosPorSegundo: num('lidarPps'), fovGrados: num('lidarFov') };
        if (Object.values(valores).some(v => typeof v === 'number' && !(v > 0))) throw new Error('Todos los valores deben ser números mayores que 0.');
        await guardarDron(form.dataset.id, valores);
        avisar('Datos del dron guardados');
      }
    } catch (e) { console.error(e); avisar(e.message, 'error'); }
    await render();
  });

  async function consultar() {
    const lat = Number(st.pronLat), lon = Number(st.pronLon);
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { st.pronError = 'Revisa la latitud y la longitud (grados decimales, por ejemplo -32.83 y -70.60).'; await render(); return; }
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

  raiz.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-accion]');
    if (!b) return;
    const a = b.dataset.accion;
    try {
      if (a === 'tab') { st.tab = b.dataset.tab; }
      else if (a === 'dia') { st.dia = b.dataset.dia; }
      else if (a === 'descargar-kml' || a === 'descargar-kml-plan') {
        const pol = a === 'descargar-kml' ? st.kml.poligonos[Number(b.dataset.i)] : polActual();
        const limpio = limpiarParaDji(pol, { maxVertices: st.maxVertices });
        descargar(`${nombreArchivoSeguro(pol.nombre)}_DJI.kml`, kmlDePoligono(pol.nombre, limpio.anillo), 'application/vnd.google-earth.kml+xml');
        avisar(limpio.verticesOriginales > limpio.vertices
          ? `Descargado: ${limpio.verticesOriginales} → ${limpio.vertices} vértices (tolerancia ${fmt(limpio.toleranciaM, 2)} m).`
          : `Descargado con ${limpio.vertices} vértices.`);
        if (pol.cruces) avisar('Descargado, pero el contorno se cruza consigo mismo: corrígelo antes de usarlo en el control.', 'error');
      }
      else if (a === 'usar-en-plan') {
        const pol = st.kml.poligonos[Number(b.dataset.i)];
        st.poligonos = [pol]; st.polSel = 0; st.archivo = st.kml.archivo; st.nombrePlan = pol.nombre; st.planId = null; st.tab = 'planificar';
      }
      else if (a === 'pronostico-plan') {
        const pol = polActual(); if (!pol) return;
        const { lat0, lon0 } = proyectar(pol.anillo);
        st.pronLat = lat0.toFixed(5); st.pronLon = lon0.toFixed(5); st.pronDron = st.params.dronId; st.pronOrigen = `centro de «${pol.nombre}»`;
        st.tab = 'pronostico';
        await consultar();
        return;
      }
      else if (a === 'gps') {
        if (!navigator.geolocation) { avisar('Este navegador no entrega la ubicación.', 'error'); }
        else {
          const pos = await new Promise((ok, mal) => navigator.geolocation.getCurrentPosition(ok, mal, { enableHighAccuracy: false, timeout: 15000 }));
          st.pronLat = pos.coords.latitude.toFixed(5); st.pronLon = pos.coords.longitude.toFixed(5); st.pronOrigen = 'tu ubicación actual';
          await consultar();
          return;
        }
      }
      else if (a === 'nuevo-plan') { st.planId = null; st.nombrePlan = ''; st.poligonos = []; st.archivo = ''; st.params = { ...PARAMS_INICIALES }; }
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

  (async () => { if (ctx.planId) await abrirPlan(ctx.planId); await render(); })();

  return {
    desmontar() { activo = false; raiz.remove(); },
    refrescar() { if (st.tab === 'planes' || st.tab === 'drones') render(); },
  };
}
