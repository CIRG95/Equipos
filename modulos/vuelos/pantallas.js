// modulos/vuelos/pantallas.js — pantallas del módulo Vuelos.
// Hojas de vuelo (Resumen · 1 Área · 2 Vuelo · 3 Clima · 4 Permisos) y herramientas sueltas:
// Pronóstico rápido, Limpiar KML y Drones. Usa las clases sis-… del Sistema y las vu-… de vuelos.css.

import { escapar as esc, fechaLegible, descargar, cargarScript } from '../../compartido/util.js';
import { listarProyectos, listarPersonas, OFICINA_ID } from '../../compartido/catalogos.js';
import { guardarArchivo, abrirArchivo } from '../../compartido/archivos.js';
import { fijarPersona, listarDrones, guardarDron, restablecerDron, listarPlanes, obtenerPlan, guardarPlan, eliminarPlan } from './datos.js';
import { CAMPOS_DRON } from './drones.js';
import { alturaParaGsd, gsdCm, fmt, fmtDuracion, proyectar, areaM2 } from './calculo.js';
import { leerArchivo, analizarKml, limpiarParaDji, kmlDePoligono, kmlDeLinea, limpiarEje, nombreArchivoSeguro, limpiarAnillo, autoInterseccion } from './kml.js';
import { pedirPronostico, pedirKp, kpEnHora, evaluarHora, ENLACES_CONSULTA } from './pronostico.js';
import { metarCercano, enlaceMetar } from './metar.js';
import { listarCapas, cargarCapaDesdeArchivo, quitarCapa, revisarZonas, TIPOS_CAPA } from './capas.js';
import { graficoPronostico, checklistClima, esquemaSVG } from './graficos.js';
import {
  nuevaHoja, migrarHoja, geometria, metaSector, nombreSector, calcularSector, totales, alturaDe, estadoPermiso,
  resumenHoja, diasHabiles, DOCUMENTOS_DGAC, CONSULTAS,
} from './hoja.js';

const HERRAMIENTAS = [['hojas', 'Hojas de vuelo'], ['rapido', 'Pronóstico rápido'], ['kml', 'Limpiar KML'], ['drones', 'Drones']];
const PASOS = [['resumen', 'Resumen'], ['area', '1 · Área'], ['vuelo', '2 · Vuelo'], ['clima', '3 · Clima'], ['permisos', '4 · Permisos']];
const COLORES_BATERIA = ['#4FC3F7', '#C6F15A', '#FFD54F', '#FF8A80', '#CE93D8', '#80CBC4', '#FFAB40', '#B0BEC5'];
const COLORES_SECTOR = ['#4FC3F7', '#C6F15A', '#FFD54F', '#FF8A80', '#CE93D8', '#80CBC4'];
const GSD_TABLA = [3, 2.5, 2, 1.5];
const CENTRO_CHILE = [-33.0, -70.6];
const ESRI = s => `https://server.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/{z}/{y}/{x}`;
const ESTADOS_HOJA = { borrador: ['Borrador', 'gris'], lista: ['Lista para volar', 'verde'], volada: ['Volada', 'azul'] };
const UMBRAL_BATERIAS = 6;
const TIPO_KML = 'application/vnd.google-earth.kml+xml';

const leerLS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const escribirLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const dosD = n => String(n).padStart(2, '0');

export function montarPantallas(contenedor, ctx) {
  fijarPersona(ctx.personaId || null);
  const raiz = document.createElement('div');
  raiz.className = 'mod-vuelos';
  contenedor.appendChild(raiz);
  let activo = true;

  const st = {
    vista: ctx.planId || ctx.proyectoId ? 'hoja' : (ctx.tab || 'hojas'),
    paso: 'resumen',
    hoja: null, candidatos: null,
    dibujo: null, // { modo: 'area'|'eje'|'corte', puntos: [] }
    leyendaAbierta: false, velA: 5, velB: 10, gsdExtra: [],
    pron: null, pronError: '', pronCargando: false, kps: null, dia: null,
    metar: null, metarError: '',
    rapLat: '', rapLon: '', rapOrigen: '', rapDron: 'm4e',
    kml: null, kmlError: '', maxVertices: 200,
    capas: null, capasActivas: leerLS('vu_capas_activas', null),
    mensaje: null, filtroProyecto: ctx.proyectoId || '',
  };
  let drones = [], proyectos = [], personas = [], hojas = [];

  const avisar = (texto, tipo = 'ok') => { st.mensaje = { texto, tipo }; };
  const dron = () => drones.find(d => d.id === (st.hoja && st.hoja.dronId)) || drones[0];
  const familias = () => [...new Map(drones.map(d => [d.familia || d.id, d.familiaNombre || d.nombre])).entries()];
  const geo = () => (st.hoja ? geometria(st.hoja) : null);
  const nomProy = id => !id ? 'Sin proyecto' : id === OFICINA_ID ? 'Oficina' : ((proyectos.find(p => p.id === id) || {}).nombre || 'Proyecto');
  const nomPers = id => (personas.find(p => p.id === id) || {}).nombre || '';
  const secSel = () => { const g = geo(); return g ? Math.max(0, Math.min(st.hoja.area.sel || 0, g.sectores.length - 1)) : 0; };
  const capasActivas = () => st.capasActivas || (st.capas || []).map(c => c.id);

  async function cargarBase() {
    [drones, proyectos, personas, hojas] = await Promise.all([listarDrones(), listarProyectos(), listarPersonas(), listarPlanes()]);
    hojas = hojas.map(migrarHoja);
  }

  // ─────────── Guardado automático ───────────
  let timerGuardar = null;
  const hayContenido = h => !!(h.id || h.nombre || h.area.original || h.area.eje);
  function programarGuardado() { clearTimeout(timerGuardar); timerGuardar = setTimeout(guardarAhora, 700); }
  async function guardarAhora() {
    clearTimeout(timerGuardar);
    const h = st.hoja;
    if (!h || !hayContenido(h)) return;
    const g = geometria(h), d = dron();
    const nombre = h.nombre || (h.area.original && h.area.original.nombre) || (h.area.eje && h.area.eje.nombre) || 'Hoja de vuelo';
    const { problemas, ...area } = h.area;
    const r = await guardarPlan({ ...h, area: { ...area, problemas }, nombre, dronId: h.dronId, schemaVersion: 2, resumen: g && d ? resumenHoja(h, d, g) : null });
    const nueva = !h.id;
    h.id = r.id; h.creadoEn = r.creadoEn; if (!h.nombre) h.nombre = nombre;
    if (nueva && activo) try { history.replaceState(null, '', `#/vuelos/plan/${r.id}`); } catch { /* sin historial */ }
    const marca = raiz.querySelector('#vu-guardado'); if (marca) marca.textContent = 'Guardado';
  }
  function cambio() { const m = raiz.querySelector('#vu-guardado'); if (m) m.textContent = 'Guardando…'; programarGuardado(); }

  async function abrirHoja(id) {
    const p = id ? await obtenerPlan(id) : null;
    st.hoja = p ? migrarHoja(p) : nuevaHoja({ proyectoId: ctx.proyectoId || st.filtroProyecto, personaId: ctx.personaId });
    st.paso = p ? 'resumen' : 'area';
    st.pron = null; st.metar = null; st.metarError = ''; st.dia = null; st.candidatos = null; st.dibujo = null; st.gsdExtra = [];
    st.vista = 'hoja';
    for (const m of Object.values(mapas)) m.encuadre = null;
  }

  // ─────────── Piezas de interfaz ───────────
  const chip = (t, clase = 'gris') => `<span class="sis-chip ${clase}">${t}</span>`;
  const campo = (nombre, etiqueta, valor, extra = '', sufijo = '') => `<label class="sis-campo"><span>${etiqueta}</span>
    <span class="vu-con-sufijo"><input name="${nombre}" value="${esc(valor)}" inputmode="decimal" ${extra}>${sufijo ? `<em>${sufijo}</em>` : ''}</span></label>`;
  const deslizador = (nombre, etiqueta, valor, { min, max, paso, sufijo, nota = '' }) => `<div class="vu-desl">
      <div class="vu-desl-cab"><label for="vu-${nombre}">${etiqueta}${nota ? ` <small>${nota}</small>` : ''}</label>
        <span class="vu-desl-valor"><input type="number" data-espejo="${nombre}" value="${esc(valor)}" step="${paso}" min="${min}" max="${max}" aria-label="${etiqueta}">${sufijo}</span></div>
      <input type="range" id="vu-${nombre}" name="${nombre}" min="${min}" max="${max}" step="${paso}" value="${esc(valor)}">
    </div>`;
  const opcionesProyectos = sel => `<option value="">Sin proyecto</option>` + proyectos.map(p => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.id === OFICINA_ID ? 'Oficina' : p.nombre)}</option>`).join('');
  const kpi = (t, v, d = '', clase = '') => `<div class="vu-kpi ${clase}"><span>${t}</span><b>${v}</b>${d ? `<small>${d}</small>` : ''}</div>`;
  const fila = (t, v) => `<div><dt>${t}</dt><dd>${v}</dd></div>`;
  const fechaHora = iso => new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });

  // ─────────── Lista de hojas ───────────
  function vistaHojas() {
    const lista = hojas.filter(h => !st.filtroProyecto || h.proyectoId === st.filtroProyecto);
    return `<div class="sis-cab"><h1>Hojas de vuelo</h1><button class="sis-btn primario" data-accion="nueva-hoja">+ Nueva hoja de vuelo</button></div>
      <p class="sis-tenue">Una hoja por trabajo de vuelo: área, plan de vuelo, clima y permisos en un solo lugar, con la hoja para terreno.</p>
      <label class="sis-campo vu-filtro"><span>Proyecto</span><select data-campo="filtroProyecto"><option value="">Todos</option>${proyectos.map(p => `<option value="${esc(p.id)}" ${p.id === st.filtroProyecto ? 'selected' : ''}>${esc(p.id === OFICINA_ID ? 'Oficina' : p.nombre)}</option>`).join('')}</select></label>
      <section class="sis-tarjeta">${lista.length ? `<div class="sis-lista">${lista.map(h => {
        const r = h.resumen || {}; const [et, cl] = ESTADOS_HOJA[h.estado] || ESTADOS_HOJA.borrador;
        return `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(h.nombre || 'Hoja sin nombre')}</b>
          <span class="sis-tenue">${esc(nomProy(h.proyectoId))} · ${h.fecha ? fechaLegible(h.fecha) : 'sin fecha'}${h.pilotoId ? ` · ${esc(nomPers(h.pilotoId))}` : ''}</span>
          <span class="sis-chips">${chip(et, cl)}${r.area ? chip(`${fmt(r.area / 10000, 1)} ha`) : ''}${r.sectores > 1 ? chip(`${r.sectores} sectores`) : ''}${r.corredor ? chip('Corredor') : ''}${r.vuelos ? chip(`${r.vuelos} batería${r.vuelos > 1 ? 's' : ''} · ${fmtDuracion(r.minTotal)}`, 'azul') : ''}</span></span>
          <span class="sis-acciones"><button class="sis-btn chico" data-accion="abrir-hoja" data-id="${h.id}">Abrir</button>
          <button class="sis-btn chico peligro" data-accion="eliminar-hoja" data-id="${h.id}">Eliminar</button></span></div>`;
      }).join('')}</div>` : '<div class="sis-vacio"><p>Todavía no hay hojas de vuelo. Crea una y carga el KMZ del área (o la línea del corredor).</p></div>'}</section>`;
  }

  // ─────────── Encabezado de la hoja ───────────
  const consultasHechas = h => CONSULTAS.every(([k]) => h.permisos.consultas.some(c => c.tipo === k));
  const ultimaConsulta = (h, tipo) => h.permisos.consultas.filter(c => c.tipo === tipo).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

  function encabezadoHoja() {
    const h = st.hoja, g = geo(), d = dron(), t = g && d ? totales(h, d, g) : null;
    const [et, cl] = ESTADOS_HOJA[h.estado] || ESTADOS_HOJA.borrador;
    const perm = estadoPermiso(h);
    const c = h.clima;
    const climaObs = c && c.checklist && c.checklist.some(x => !x.cumple);
    const marcas = {
      area: g ? (g.fallidos.length ? 'aviso' : 'ok') : '',
      vuelo: t ? (t.excede ? 'aviso' : 'ok') : '',
      clima: c ? (climaObs ? 'aviso' : 'ok') : '',
      permisos: perm.nivel === 'ok' && consultasHechas(h) ? 'ok' : (h.permisos.dgac.preparado || h.permisos.consultas.length ? 'aviso' : ''),
    };
    return `<div class="sis-encabezado vu-hoja-cab">
        <div>
          <div class="sis-miga"><a href="#/vuelos" data-accion="volver-lista">Hojas de vuelo</a>${h.proyectoId ? ` / <a href="#/proyecto/${esc(h.proyectoId)}">${esc(nomProy(h.proyectoId))}</a>` : ''}</div>
          <h1>Hoja de vuelo · ${esc(h.nombre || 'sin nombre')}</h1>
          <div class="sis-meta">
            <span>Fecha: <b>${h.fecha ? fechaLegible(h.fecha) : '—'}</b></span>
            <span>Piloto: <b>${esc(nomPers(h.pilotoId) || '—')}</b></span>
            <span>Dron: <b>${esc(d ? (d.familiaNombre || d.nombre).replace('DJI ', '') : '—')}</b></span>
            ${t ? `<span>${h.params.modo === 'lidar' ? 'LiDAR' : 'Fotogrametría'} · GSD ${fmt(t.gsd, 2)} cm · ${fmt(t.altura, 0)} m</span>` : ''}
            <span class="sis-tenue" id="vu-guardado">${h.id ? 'Guardado' : 'Se guarda sola al cargar el área o ponerle nombre'}</span>
          </div>
        </div>
        <div class="sis-acciones">${chip(et, cl)}
          <button class="sis-btn chico" data-accion="imprimir" ${g ? '' : 'disabled'}>Hoja para terreno (PDF)</button>
          ${h.estado === 'borrador' ? '<button class="sis-btn chico primario" data-accion="estado" data-e="lista">Marcar lista</button>' : h.estado === 'lista' ? '<button class="sis-btn chico primario" data-accion="estado" data-e="volada">Marcar volada</button>' : '<button class="sis-btn chico" data-accion="estado" data-e="borrador">Volver a borrador</button>'}
        </div>
      </div>
      <div class="vu-tira">
        ${kpi('Área de vuelo', g ? `${fmt(g.areaVuelo / 10000, 1)} ha` : '—', g ? (g.tipo === 'corredor' ? `corredor de ${fmt(g.izq + g.der, 0)} m` : (Number(h.area.margen) ? `+${h.area.margen} m de margen` : 'sin margen')) : 'falta el área')}
        ${kpi('Vuelo', t ? `${t.baterias} bat. · ${fmtDuracion(t.minVuelo)}` : '—', t ? `jornada ${fmtDuracion(t.minJornada)}${g.sectores.length > 1 ? ` · ${g.sectores.length} sectores` : ''}` : '', t && t.excede ? 'alerta' : '')}
        ${kpi('Ventana GO', c ? (c.ventana || 'Sin ventana') : '—', c ? fechaLegible(c.fecha) : 'consulta el clima', c ? (c.ventana ? 'bien' : 'alerta') : '')}
        ${kpi('Ráfaga máx.', c && c.rafaga ? `${fmt(c.rafaga.v, 1)} m/s` : '—', c && c.rafaga ? `${dosD(c.rafaga.hora)}:00 · límite ${d ? fmt(d.rafagaMaxMs, 0) : '—'}` : '', c && c.rafaga && d && c.rafaga.v > d.rafagaMaxMs ? 'alerta' : '')}
        ${kpi('Kp · luz', c ? `${c.kpMax != null ? fmt(c.kpMax, 0) : '—'} · ${c.sol ? c.sol.join('–') : '—'}` : '—', c ? 'Kp ≤ 4 para GNSS' : '')}
        ${kpi('Permiso DGAC', perm.texto, perm.detalle, perm.nivel === 'ok' ? 'bien' : perm.nivel === 'aviso' ? 'alerta' : '')}
      </div>
      <nav class="vu-pasos" aria-label="Pasos de la hoja">${PASOS.map(([k, t]) => `<button class="vu-paso${st.paso === k ? ' activo' : ''}" data-accion="paso" data-paso="${k}">${t}${marcas[k] === 'ok' ? ' <i class="vu-ok" aria-label="listo">✓</i>' : marcas[k] === 'aviso' ? ' <i class="vu-alerta" aria-label="revisar">!</i>' : ''}</button>`).join('')}</nav>`;
  }

  // ─────────── Resumen ───────────
  function vistaResumen() {
    const h = st.hoja, g = geo(), d = dron(), t = g && d ? totales(h, d, g) : null, c = h.clima, perm = estadoPermiso(h);
    const cab = (n, titulo, estado, clase, paso, accion) => `<div class="vu-res-cab"><span class="vu-num">${n}</span><h2>${titulo}</h2>${estado ? chip(estado, clase) : ''}<button class="vu-link" data-accion="paso" data-paso="${paso}">${accion} →</button></div>`;
    const zonas = g ? zonasDeHoja() : [];
    const climaObs = c && c.checklist && c.checklist.some(x => !x.cumple);
    return `<section class="sis-tarjeta vu-datos-hoja"><h2>Datos de la hoja</h2>
        <div class="vu-datos-grilla">
          <label class="sis-campo"><span>Nombre</span><input data-hoja="nombre" value="${esc(h.nombre)}" placeholder="El Pimiento — vuelo 1"></label>
          <label class="sis-campo"><span>Proyecto</span><select data-hoja="proyectoId">${opcionesProyectos(h.proyectoId)}</select></label>
          <label class="sis-campo"><span>Fecha del vuelo</span><input type="date" data-hoja="fecha" value="${esc(h.fecha || '')}"></label>
          <label class="sis-campo"><span>Piloto</span><select data-hoja="pilotoId"><option value="">—</option>${personas.map(p => `<option value="${esc(p.id)}" ${p.id === h.pilotoId ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>
        </div>
      </section>
      <div class="vu-res-grilla">
        <section class="sis-tarjeta">${cab(1, 'Área', g ? (g.fallidos.length ? 'Revisar cortes' : 'Lista') : 'Falta el área', g ? (g.fallidos.length ? 'ambar' : 'verde') : 'gris', 'area', g ? 'Editar área' : 'Cargar área')}
          ${g ? `<dl class="vu-tabla">
            ${fila('Origen', esc(h.area.archivo || '—'))}
            ${g.tipo === 'corredor' ? fila('Corredor', `${fmt(g.izq, 0)} m izq. · ${fmt(g.der, 0)} m der. · ${fmt(g.sectores.reduce((s, x) => s + x.largo, 0) / 1000, 2)} km`) : fila('Margen', Number(h.area.margen) ? `+${h.area.margen} m · ${fmt(areaM2(g.original) / 10000, 2)} → ${fmt(g.areaVuelo / 10000, 2)} ha` : 'sin margen')}
            ${fila('Sectores', g.sectores.length > 1 ? g.sectores.map((_, i) => esc(nombreSector(h, i, g.sectores.length))).join(' · ') : 'uno (área completa)')}
            ${fila('Zonas', zonas === null ? 'sin capas cargadas' : zonas.length ? zonas.slice(0, 2).map(z => `${z.toca ? '<b class="vu-rojo">toca</b> ' : ''}${esc(z.nombre)}${z.toca ? '' : ` a ${fmt(z.distancia / 1000, 1)} km`}`).join(' · ') : 'no toca zonas cargadas')}
          </dl>` : '<p class="sis-tenue">Carga el KMZ/KML del área (o la línea del corredor), o dibújala en el mapa.</p>'}
        </section>
        <section class="sis-tarjeta">${cab(2, 'Vuelo', t ? (t.excede ? 'Revisar' : 'Listo') : '', t ? (t.excede ? 'ambar' : 'verde') : 'gris', 'vuelo', 'Ajustar')}
          ${t ? `<div class="vu-mini-kpis">${kpi('GSD', `${fmt(t.gsd, 2)} cm`)}${kpi('Altura', `${fmt(t.altura, 0)} m`)}${kpi('Baterías', t.baterias)}${kpi('Fotos', fmt(t.fotos))}</div>
            <dl class="vu-tabla">${fila('Traslapes · velocidad', `${h.params.traslapeFrontal}/${h.params.traslapeLateral} % · ${t.sectores[0] ? fmt(t.sectores[0].velocidad, 1) : '—'} m/s${h.params.velocidad === '' ? ' (sugerida)' : ''}`)}
            ${fila('En el aire · jornada', `${fmtDuracion(t.minVuelo)} · ${fmtDuracion(t.minJornada)}`)}
            ${g.sectores.length > 1 ? fila('Por sector', t.sectores.map((r, i) => `${esc(nombreSector(h, i, g.sectores.length))} ${r ? fmtDuracion(r.minTotal) : '—'}`).join(' · ')) : ''}</dl>` : '<p class="sis-tenue">Cuando cargues el área, aquí aparece el plan de vuelo.</p>'}
        </section>
        <section class="sis-tarjeta">${cab(3, 'Clima', c ? (climaObs ? 'Con observaciones' : 'Cumple') : '', c ? (climaObs ? 'ambar' : 'verde') : 'gris', 'clima', c ? 'Ver pronóstico' : 'Consultar')}
          ${c ? `<p class="sis-tenue">Consultado ${fechaHora(c.consultadoEn)} para el ${fechaLegible(c.fecha)}.</p>
            <dl class="vu-tabla">${(c.checklist || []).map(x => fila(esc(x.texto), `<span class="${x.cumple ? 'vu-verde' : 'vu-rojo'}">${esc(x.detalle)}</span>`)).join('')}
            ${c.metar ? fila(`METAR ${esc(c.metar.icao)}`, `a ${fmt(c.metar.km, 0)} km`) : ''}</dl>` : '<p class="sis-tenue">Consulta el pronóstico del día del vuelo: viento a 120 m, ráfagas, lluvia, nubes, temperatura, Kp y METAR.</p>'}
        </section>
        <section class="sis-tarjeta">${cab(4, 'Permisos y consultas', perm.texto, perm.nivel === 'ok' ? 'verde' : perm.nivel === 'aviso' ? 'ambar' : 'gris', 'permisos', 'Abrir')}
          <dl class="vu-tabla">
            ${fila('Solicitud DGAC', `${esc(perm.texto)} · ${esc(perm.detalle)}`)}
            ${fila('Documentos', `${DOCUMENTOS_DGAC.filter(([k]) => h.permisos.docs[k]).length} de ${DOCUMENTOS_DGAC.length}`)}
            ${CONSULTAS.map(([k, tt]) => { const x = ultimaConsulta(h, k); return fila(tt, x ? `Revisado ${fechaHora(x.fecha)}` : '<span class="vu-rojo">Pendiente</span>'); }).join('')}
          </dl>
        </section>
      </div>`;
  }

  // ─────────── Paso 1 · Área ───────────
  function zonasDeHoja() {
    const g = geo();
    if (!g || !st.capas || !st.capas.length) return null;
    return revisarZonas(g.vuelo.map(g.marco.aLonLat), g.marco, st.capas, capasActivas());
  }

  function vistaArea() {
    const h = st.hoja, a = h.area, g = geo(), d = dron(), t = g && d ? totales(h, d, g) : null;
    const grande = t && (t.baterias > UMBRAL_BATERIAS || t.excede) && g.sectores.length === 1;
    return `${grande ? `<div class="vu-banner"><div><b>El área es grande: ${fmt(g.areaVuelo / 10000, 0)} ha · ${t.baterias} baterías · unas ${fmtDuracion(t.minVuelo)} de vuelo</b>
        <span>${t.excede ? 'Parte del recorrido queda más lejos de lo que alcanza una batería desde el despegue. ' : ''}Dividirla en sectores te deja planificar por día o por punto de despegue, con un rumbo y un KML para cada uno.</span></div>
        <button class="sis-btn primario" data-accion="dibujar" data-modo="corte">Dividir en sectores</button></div>` : ''}
      <div class="vu-dos">
        <div class="vu-izquierda">
          <section class="sis-tarjeta"><h2>Origen</h2>
            <div class="sis-acciones">
              <label class="sis-btn vu-archivo">Cargar KML / KMZ<input type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" data-archivo="area" hidden></label>
              <button class="sis-btn${st.dibujo && st.dibujo.modo === 'area' ? ' primario' : ''}" data-accion="dibujar" data-modo="area">Dibujar área</button>
              <button class="sis-btn${st.dibujo && st.dibujo.modo === 'eje' ? ' primario' : ''}" data-accion="dibujar" data-modo="eje">Dibujar eje</button>
            </div>
            ${st.candidatos ? vistaCandidatos() : ''}
            ${a.tipo ? `<p class="sis-tenue vu-area-info">${esc(a.archivo || '')} · ${a.tipo === 'corredor' ? `eje de ${fmt((a.eje.largo || 0) / 1000, 2)} km · ${a.eje.linea.length} vértices` : `${fmt(areaM2(proyectar(a.original.anillo).puntos) / 10000, 2)} ha · ${a.original.anillo.length} vértices`}</p>
              ${(a.problemas || []).length ? `<div class="vu-aviso"><b>Detalles que se corrigen al descargar:</b><ul>${a.problemas.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
              <div class="sis-acciones"><button class="sis-btn chico" data-accion="kml-original">Descargar ${a.tipo === 'corredor' ? 'eje' : 'área del mandante'} limpio (KML)</button></div>` : ''}
          </section>
          ${a.tipo === 'poligono' ? `<section class="sis-tarjeta"><h2>Margen</h2>
            ${deslizador('margen', 'Margen hacia afuera', a.margen || 0, { min: 0, max: 100, paso: 1, sufijo: 'm' })}
            <div class="vu-pildoras">${[0, 20, 30, 50].map(m => `<button type="button" class="vu-pildora${Number(a.margen) === m ? ' activo' : ''}" data-accion="margen" data-m="${m}">${m ? `${m} m` : 'Sin margen'}</button>`).join('')}</div>
            <label class="sis-check"><input type="checkbox" data-area="rectas" ${a.rectas !== false ? 'checked' : ''}> Esquinas rectas (como se hace a mano)</label>
            <p class="sis-tenue" id="vu-margen-info">${g ? `${fmt(areaM2(g.original) / 10000, 2)} ha → <b>${fmt(g.areaVuelo / 10000, 2)} ha</b> de vuelo` : ''}</p>
          </section>` : ''}
          ${a.tipo === 'corredor' ? `<section class="sis-tarjeta"><h2>Corredor</h2>
            ${deslizador('izq', a.corredor.mismo ? 'Ancho a cada lado' : 'Hacia la izquierda', a.corredor.izq, { min: 5, max: 300, paso: 1, sufijo: 'm' })}
            ${a.corredor.mismo ? '' : deslizador('der', 'Hacia la derecha', a.corredor.der, { min: 5, max: 300, paso: 1, sufijo: 'm' })}
            <label class="sis-check"><input type="checkbox" data-area="mismo" ${a.corredor.mismo ? 'checked' : ''}> Mismo ancho a los dos lados</label>
            ${a.corredor.mismo ? '' : '<button class="sis-btn chico" data-accion="invertir">Invertir izquierda y derecha</button>'}
            <p class="sis-tenue" id="vu-margen-info">${g ? textoCorredor(g) : ''}</p>
          </section>` : ''}
          ${g ? `<section class="sis-tarjeta"><h2>Sectores</h2><div id="vu-sectores">${htmlSectores()}</div>
            <div class="sis-acciones">
              <button class="sis-btn chico${st.dibujo && st.dibujo.modo === 'corte' ? ' primario' : ''}" data-accion="dibujar" data-modo="corte">✎ Trazar corte</button>
              ${a.cortes.length ? '<button class="sis-btn chico" data-accion="deshacer-corte">Deshacer último corte</button><button class="sis-btn chico" data-accion="quitar-cortes">Quitar todos</button>' : ''}
            </div>
            <p class="sis-tenue">Traza el corte por un camino, quebrada o cerco: toca afuera del área, sigue el borde tocando puntos y termina afuera. Los vértices blancos se pueden arrastrar.</p>
          </section>` : ''}
          <section class="sis-tarjeta"><h2>Zonas de referencia</h2><div id="vu-zonas">${htmlZonas()}</div></section>
        </div>
        <div class="vu-derecha">
          <div class="vu-mapa-caja"><div class="vu-mapa-lugar" data-mapa="area"></div><div class="vu-mapa-barra" id="vu-barra-area">${barraDibujo()}</div></div>
          <p class="sis-tenue vu-pie">Punteado blanco: área del mandante · naranjo: área de vuelo · colores: sectores · puntos azules: aeródromos. Imagen Esri con nombres y caminos.</p>
        </div>
      </div>`;
  }
  const textoCorredor = g => `${fmt(g.izq + g.der, 0)} m × ${fmt(g.sectores.reduce((s, x) => s + x.largo, 0) / 1000, 2)} km = <b>${fmt(g.areaVuelo / 10000, 2)} ha</b>. Las pasadas siguen el eje.`;

  function vistaCandidatos() {
    const c = st.candidatos;
    const contornos = c.poligonos.filter(p => !p.abierta);
    return `<div class="vu-candidatos"><p><b>${esc(c.archivo)}</b> trae ${contornos.length ? `${contornos.length} contorno${contornos.length > 1 ? 's' : ''}` : ''}${contornos.length && c.ejes.length ? ' y ' : ''}${c.ejes.length ? `${c.ejes.length} línea${c.ejes.length > 1 ? 's' : ''} abierta${c.ejes.length > 1 ? 's' : ''}` : ''}. ¿Cuál uso?</p>
      <div class="sis-lista">${c.ejes.map((e, i) => { const j = c.poligonos.findIndex(p => p.abierta && p.nombre === e.nombre); return `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(e.nombre)}</b><span class="sis-tenue">Línea de ${fmt(e.largo / 1000, 2)} km · ${e.vertices} vértices</span></span>
          <span class="sis-acciones"><button class="sis-btn chico primario" data-accion="usar-eje" data-i="${i}">Como eje de corredor</button>${j >= 0 ? `<button class="sis-btn chico" data-accion="usar-pol" data-i="${j}">Cerrarla como contorno</button>` : ''}</span></div>`; }).join('')}
        ${contornos.map(p => { const i = c.poligonos.indexOf(p); return `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(p.nombre)}</b><span class="sis-tenue">${fmt(p.area / 10000, 2)} ha · ${p.vertices} vértices</span></span>
          <span class="sis-acciones"><button class="sis-btn chico primario" data-accion="usar-pol" data-i="${i}">Usar este contorno</button></span></div>`; }).join('')}</div>
      <button class="vu-link" data-accion="cerrar-candidatos">Cancelar</button></div>`;
  }

  function htmlSectores() {
    const h = st.hoja, g = geo(), d = dron();
    if (!g) return '';
    const t = d ? totales(h, d, g) : null;
    return `${g.fallidos.length ? '<div class="vu-aviso">Un corte no atraviesa el área de lado a lado y no se aplicó: arrastra sus puntos o deshazlo.</div>' : ''}
      <div class="vu-sectores">${g.sectores.map((s, i) => { const r = t && t.sectores[i]; return `<div class="vu-sector">
        <i style="background:${COLORES_SECTOR[i % COLORES_SECTOR.length]}"></i>
        ${g.sectores.length > 1 ? `<input class="vu-sector-nombre" data-sector-nombre="${i}" value="${esc((h.area.sectores[i] && h.area.sectores[i].nombre) || '')}" placeholder="S${i + 1}" aria-label="Nombre del sector ${i + 1}">` : '<b>Área completa</b>'}
        <span class="vu-sector-dato">${fmt(s.area / 10000, 1)} ha${r ? ` · ${r.vuelos} bat. · ${fmtDuracion(r.minTotal)}` : ''}</span>
        <span class="vu-sector-acc">${g.sectores.length > 1 ? `<button class="vu-link" data-accion="kml-sector" data-i="${i}">KML</button>` : ''}<button class="vu-link" data-accion="ir-sector" data-i="${i}">volar →</button></span>
      </div>`; }).join('')}</div>
      ${g.sectores.length > 1 && t ? `<p class="vu-total">Total: ${g.sectores.length} sectores · ${t.baterias} baterías · ${fmtDuracion(t.minJornada)} de jornada</p>
        <div class="sis-acciones"><button class="sis-btn chico" data-accion="kml-sectores">Descargar KML de cada sector</button></div>` : ''}`;
  }

  function htmlZonas() {
    const capas = st.capas || [];
    const form = `<div class="vu-capa-form"><select data-campo="tipoCapa" aria-label="Tipo de capa">${Object.entries(TIPOS_CAPA).map(([k, v]) => `<option value="${k}">${v.nombre}</option>`).join('')}</select>
      <label class="sis-btn chico vu-archivo">+ Cargar capa (KMZ, KML o JSON)<input type="file" accept=".kml,.kmz,.json,.geojson" data-archivo="capa" hidden></label></div>`;
    if (!capas.length) return `<p class="sis-tenue">Aún no hay capas. Carga los archivos de aeródromos, zonas restringidas (DGAC) o áreas protegidas (CONAF) y se revisan contra el área.</p>${form}`;
    const activas = capasActivas();
    const zonas = zonasDeHoja();
    return `${zonas && zonas.length ? `<div class="vu-zonas-res">${zonas.slice(0, 4).map(z => `<div class="${z.toca ? 'vu-rojo' : ''}"><i style="background:${TIPOS_CAPA[z.tipo].color}"></i><span>${z.toca ? '<b>Toca</b> ' : ''}${esc(z.nombre)}${z.toca ? '' : ` · a ${fmt(z.distancia / 1000, 1)} km`}<small>${esc(z.capa)}</small></span></div>`).join('')}</div>`
      : geo() ? '<p class="vu-verde">No hay zonas cargadas a menos de 60 km.</p>' : ''}
      <fieldset class="vu-capas"><legend>Capas</legend>${capas.map(c => `<label class="sis-check"><input type="checkbox" data-capa="${esc(c.id)}" ${activas.includes(c.id) ? 'checked' : ''}><i style="background:${TIPOS_CAPA[c.tipo].color}"></i>${esc(c.nombre)} <small>${esc(c.fecha || '')}${c.origen === 'usuario' ? ' · cargada aquí' : ''}</small>${c.origen === 'usuario' ? ` <button class="vu-link" data-accion="quitar-capa" data-id="${esc(c.id)}">quitar</button>` : ''}</label>`).join('')}</fieldset>
      ${form}
      <p class="sis-tenue">Referencial. La información aeronáutica oficial está en AIP Chile (DGAC).</p>`;
  }

  function barraDibujo() {
    const dib = st.dibujo;
    if (!dib) return st.hoja && !geo() ? '<span class="vu-barra-txt">Carga un KML/KMZ o dibuja el área o el eje.</span>' : '';
    const min = dib.modo === 'area' ? 3 : 2;
    const txt = { area: 'Toca el mapa para marcar los vértices del área', eje: 'Toca el mapa siguiendo el eje del corredor', corte: 'Toca afuera del área, sigue el camino y termina afuera' }[dib.modo];
    return `<span class="vu-barra-txt">${txt} · ${dib.puntos.length} punto${dib.puntos.length === 1 ? '' : 's'}</span>
      <button type="button" class="vu-barra-btn" data-accion="dibujo-deshacer" ${dib.puntos.length ? '' : 'disabled'}>Deshacer</button>
      <button type="button" class="vu-barra-btn fuerte" data-accion="dibujo-terminar" ${dib.puntos.length >= min ? '' : 'disabled'}>Terminar</button>
      <button type="button" class="vu-barra-btn" data-accion="dibujo-cancelar">Cancelar</button>`;
  }

  // ─────────── Paso 2 · Vuelo ───────────
  function vistaVuelo() {
    const h = st.hoja, P = h.params, d = dron(), g = geo();
    if (!g) return `<section class="sis-tarjeta sis-vacio"><p>Primero carga o dibuja el área.</p><button class="sis-btn primario" data-accion="paso" data-paso="area">Ir a Área</button></section>`;
    const i = secSel();
    const r = calcularSector(h, d, g, i);
    const fam = d.familia || d.id;
    const sensores = drones.filter(x => (x.familia || x.id) === fam);
    const altura = alturaDe(P, d), gsd = gsdCm(d, altura);
    const vMax = d.velocidadMaxMs;
    return `${g.sectores.length > 1 ? `<div class="vu-sector-chips">${g.sectores.map((_, k) => `<button class="vu-pildora${k === i ? ' activo' : ''}" data-accion="ir-sector" data-i="${k}"><i style="background:${COLORES_SECTOR[k % COLORES_SECTOR.length]}"></i>${esc(nombreSector(h, k, g.sectores.length))}</button>`).join('')}<span class="sis-tenue" id="vu-total-hoja">${htmlTotalHoja()}</span></div>` : ''}
      <div class="vu-dos">
        <div class="vu-izquierda">
          <form class="sis-form vu-form" data-form="plan" autocomplete="off">
          <section class="sis-tarjeta"><h2>Dron y vuelo</h2>
            <div class="${sensores.length > 1 ? 'sis-par' : ''}">
              <label class="sis-campo"><span>Dron</span><select name="familia">${familias().map(([k, tt]) => `<option value="${esc(k)}" ${k === fam ? 'selected' : ''}>${esc(tt)}</option>`).join('')}</select></label>
              ${sensores.length > 1 ? `<label class="sis-campo"><span>Sensor</span><select name="dronId">${sensores.map(x => `<option value="${x.id}" ${x.id === h.dronId ? 'selected' : ''}>${esc(x.sensor || x.nombre)}</option>`).join('')}</select></label>` : ''}
            </div>
            ${d.lidar ? `<div class="sis-campo"><span>Producto</span><div class="sis-opciones">
              <label class="sis-opcion"><input type="radio" name="modo" value="foto" ${P.modo !== 'lidar' ? 'checked' : ''}> Fotogrametría</label>
              <label class="sis-opcion"><input type="radio" name="modo" value="lidar" ${P.modo === 'lidar' ? 'checked' : ''}> LiDAR</label></div></div>` : ''}
            <div class="vu-enlazados">
              ${deslizador('gsd', 'GSD', Math.round(gsd * 100) / 100, { min: 0.5, max: 8, paso: 0.05, sufijo: 'cm/px' })}
              ${deslizador('altura', 'Altura', Math.round(altura), { min: 15, max: 400, paso: 1, sufijo: 'm', nota: '(enlazada al GSD)' })}
            </div>
            ${deslizador('traslapeFrontal', 'Traslape frontal', P.traslapeFrontal, { min: 40, max: 90, paso: 1, sufijo: '%' })}
            ${deslizador('traslapeLateral', 'Traslape lateral', P.traslapeLateral, { min: 20, max: 90, paso: 1, sufijo: '%' })}
            ${deslizador('velocidad', 'Velocidad', Math.min(vMax, Math.round((r ? r.velocidad : 5) * 10) / 10), { min: 1, max: vMax, paso: 0.1, sufijo: 'm/s', nota: P.velocidad === '' ? '(sugerida)' : '' })}
            <div class="vu-desl-pie" id="vu-vel-pie">${pieVelocidad(r)}</div>
            <details class="vu-detalles"><summary>Supuestos de terreno y cámara</summary>
              <div class="sis-par">${campo('reserva', 'Reserva por batería', P.reserva, '', '%')}${campo('minDespegue', 'Despegue y aterrizaje', P.minDespegue, '', 'min')}</div>
              <div class="sis-par">${campo('minCambio', 'Cambio de batería', P.minCambio, '', 'min')}${campo('segGiro', 'Giro entre líneas', P.segGiro, '', 's')}</div>
              ${campo('exposicion', 'Exposición 1/…', P.exposicion, '', 's')}
            </details>
          </section>
          </form>
          <section class="sis-tarjeta"><h2>Exportar</h2>
            <div class="sis-acciones">
              ${g.tipo === 'corredor' ? `<button class="sis-btn primario" data-accion="kml-eje-sector" data-i="${i}">Descargar eje (KML para el control)</button><button class="sis-btn" data-accion="kml-sector" data-i="${i}">Corredor como polígono</button>` : `<button class="sis-btn primario" data-accion="kml-sector" data-i="${i}">Descargar KML${g.sectores.length > 1 ? ' del sector' : ''}</button>`}
            </div>
            <p class="sis-tenue">${g.tipo === 'corredor' ? 'En DJI Pilot 2 usa el eje con el modo corredor y el mismo ancho; aquí se simulan las pasadas, el tiempo y las baterías.' : 'El KML es el área de vuelo (con margen), limpio para el control.'}</p>
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
    return t ? `Hoja completa: ${t.baterias} baterías · ${fmtDuracion(t.minJornada)}` : '';
  }

  function pieVelocidad(r) {
    if (!r) return '';
    const lim = r.limites.map(([t, v]) => `${t} ${fmt(v, 1)}`).join(' · ');
    return `<span>Sugerida ${fmt(r.sugerida, 1)} m/s · límites: ${lim} m/s</span>${r.auto ? '' : ' <button type="button" class="vu-link" data-accion="vel-auto">usar la sugerida</button>'}`;
  }

  function htmlKpis(r) {
    if (!r) return '';
    return `<div class="vu-kpis">
      ${kpi('Altura', `${fmt(r.altura, 0)} m`, '', r.altura > 120 ? 'alerta' : '')}
      ${r.densidad ? kpi('Densidad', `${fmt(r.densidad, 0)} pts/m²`) : kpi('GSD', `${fmt(r.gsd, 2)} cm`)}
      ${kpi(r.corredor ? 'Pasadas' : 'Líneas', fmt(r.nLineas))}
      ${r.modo === 'foto' ? kpi('Fotos', fmt(r.fotos)) : kpi('Velocidad', `${fmt(r.velocidad, 1)} m/s`)}
      ${kpi('En el aire', fmtDuracion(r.minMision))}
      ${kpi('Baterías', fmt(r.vuelos), '', r.baterias.some(b => b.excede) ? 'alerta' : '')}
      ${kpi('Jornada', fmtDuracion(r.minTotal))}
    </div>`;
  }

  function htmlBarraRumbo(r) {
    if (!r) return '';
    if (r.corredor) return `<span class="vu-barra-txt">Corredor · ${fmt(r.nLineas)} pasada${r.nLineas === 1 ? '' : 's'} siguiendo el eje</span>`;
    const meta = metaSector(st.hoja, secSel());
    const auto = meta.rumbo === '' || meta.rumbo == null;
    return `<span class="vu-barra-txt">Rumbo ${fmt(r.rumbo, 0)}°${auto ? ' · lado más largo' : ''}</span>
      <button type="button" class="vu-barra-btn" data-accion="rumbo" data-d="-5" aria-label="Girar las líneas 5 grados a la izquierda">⟲ 5°</button>
      <button type="button" class="vu-barra-btn" data-accion="rumbo" data-d="5" aria-label="Girar las líneas 5 grados a la derecha">⟳ 5°</button>
      <button type="button" class="vu-barra-btn" data-accion="rumbo" data-d="90">90°</button>
      <button type="button" class="vu-barra-btn fuerte" data-accion="rumbo-corto">Más corto</button>
      ${auto ? '' : '<button type="button" class="vu-barra-btn" data-accion="rumbo-auto">Auto</button>'}`;
  }

  /** Leyenda compacta dentro del mapa: hasta 6 baterías a la vista; más, plegada en una línea. */
  function htmlLeyenda(r) {
    if (!r || !r.baterias.length) return '';
    const n = r.baterias.length;
    if (r.baterias.some(b => b.excede)) return `<div class="vu-leyenda-caja alerta"><b>Hay tramos que no alcanzan con una batería</b><span>Acerca el despegue o divide el área en sectores.</span></div>`;
    const item = (b, i) => `<span class="vu-ley-item"><i style="background:${COLORES_BATERIA[i % COLORES_BATERIA.length]}"></i>B${i + 1}<em>${fmt(b.min, 0)}′</em></span>`;
    const total = `${n} batería${n > 1 ? 's' : ''} · ${fmtDuracion(r.minMision)}`;
    if (n <= 6) return `<div class="vu-leyenda-caja"><b>${total}</b><div class="vu-ley-lista">${r.baterias.map(item).join('')}<span class="vu-ley-item"><i class="vu-punto"></i>Despegue</span></div></div>`;
    if (!st.leyendaAbierta) return `<button type="button" class="vu-leyenda-caja plegada" data-accion="leyenda"><span class="vu-ley-colores">${COLORES_BATERIA.slice(0, 4).map(c => `<i style="background:${c}"></i>`).join('')}</span><b>${total}</b> ▾</button>`;
    return `<div class="vu-leyenda-caja"><button type="button" class="vu-ley-cab" data-accion="leyenda"><b>${total}</b><span>▴ ocultar</span></button><div class="vu-ley-lista dos">${r.baterias.map(item).join('')}</div></div>`;
  }

  function htmlDetalle(r) {
    if (!r) return '';
    return `${r.avisos.length ? `<div class="vu-aviso"><ul>${r.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      ${r.modo === 'foto' ? htmlTablaGsd(r) : ''}
      <details class="vu-detalles"><summary>Detalle del cálculo</summary>
      <dl class="vu-tabla">
        ${fila('Área del sector', `${fmt(r.area / 10000, 2)} ha`)}
        ${fila('Huella de la foto', `${fmt(r.huellaAncho, 0)} × ${fmt(r.huellaLargo, 0)} m`)}
        ${r.barrido ? fila('Ancho de barrido LiDAR', `${fmt(r.barrido, 0)} m`) : ''}
        ${fila(`Separación entre ${r.corredor ? 'pasadas' : 'líneas'}`, `${fmt(r.sepLineas, 1)} m · ${fmt(r.nLineas)}`)}
        ${r.modo === 'foto' ? fila('Distancia entre fotos', `${fmt(r.sepFotos, 1)} m · cada ${fmt(r.intervalo, 1)} s`) : fila('Densidad en una pasada', `${fmt(r.densidadPasada, 0)} pts/m²`)}
        ${fila('Distancia de vuelo', `${fmt(r.distancia / 1000, 2)} km`)}
        ${r.trasladoM ? fila('Traslado desde el despegue (ida y vuelta)', `${fmt(r.trasladoM / 1000, 2)} km`) : ''}
        ${fila('Velocidad', `${fmt(r.velocidad, 1)} m/s${r.auto ? ' (sugerida)' : ''}`)}
        ${fila('Tiempo útil por batería', `${fmt(r.minUtiles, 0)} min`)}
      </dl>
      <p class="sis-tenue">Estimación para planificar y cotizar. El GSD es sobre el punto de despegue: con desnivel cambia. El vuelo se programa en DJI Pilot 2.</p>
      </details>`;
  }

  function opcionesGsd(r) {
    const h = st.hoja, d = dron(), g = geo(), i = secSel();
    const actual = Math.round(r.gsd * 100) / 100;
    const lista = [...new Set([...GSD_TABLA, ...st.gsdExtra, actual])].sort((a, b) => b - a);
    return lista.map(gs => {
      const altura = alturaParaGsd(d, gs);
      const a = calcularSector(h, d, g, i, { altura, modo: 'foto', velocidad: st.velA });
      const z = calcularSector(h, d, g, i, { altura, modo: 'foto', velocidad: st.velB });
      return { gsd: gs, altura, actual: Math.abs(gs - actual) < 0.005, a, z, sobre120: altura > 120 };
    });
  }

  function htmlTablaGsd(r) {
    const filas = opcionesGsd(r);
    return `<section class="sis-tarjeta vu-opciones">
      <div class="vu-opciones-cab"><h2>Opciones por GSD</h2>
        <label class="vu-vel">Velocidades <input type="number" data-vel="velA" value="${st.velA}" min="1" max="25" step="0.5" aria-label="Velocidad A"> y <input type="number" data-vel="velB" value="${st.velB}" min="1" max="25" step="0.5" aria-label="Velocidad B"> m/s</label></div>
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
      <p class="sis-tenue">Tiempo en el aire${geo().sectores.length > 1 ? ' del sector' : ''} con el dron y traslapes del plan. ⚠ sobre 120 m: requiere autorización DGAC. * sobre la velocidad sugerida.</p>
    </section>`;
  }

  // ─────────── Paso 3 · Clima ───────────
  function filasDelDia(p, d, dia) {
    return p.horas.filter(x => x.fecha === dia && x.hora >= 6 && x.hora <= 21)
      .map(x => ({ h: x, kp: kpEnHora(st.kps, x.t) })).map(x => ({ ...x, ev: evaluarHora(x.h, d, { kp: x.kp, solMin: 5 }) }));
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

  function analizarDia(p, d) {
    const dias = [...new Set(p.horas.map(x => x.fecha))];
    if (!st.dia || !dias.includes(st.dia)) st.dia = (st.hoja && dias.includes(st.hoja.fecha)) ? st.hoja.fecha : dias[0];
    const filas = filasDelDia(p, d, st.dia);
    const ventana = mejorVentana(filas);
    const sol = p.dias.find(x => x.fecha === st.dia);
    const kps = filas.map(f => f.kp).filter(k => k != null);
    const enVentana = ventana ? filas.filter(f => f.h.hora >= ventana[0] && f.h.hora <= ventana[1]) : filas.filter(f => f.ev.estado !== 'noche');
    const chk = checklistClima(enVentana.length ? enVentana : filas, d);
    return { dias, filas, ventana, sol, kps, chk };
  }

  function bloquePronostico(p, d, origen) {
    const b = analizarDia(p, d);
    const html = `<div class="vu-pron-origen"><b>${esc(origen)}</b><span class="sis-tenue">${fmt(p.lat, 5)}, ${fmt(p.lon, 5)}${p.elevacionModelo != null ? ` · ${fmt(p.elevacionModelo, 0)} m s. n. m. (modelo)` : ''}</span></div>
        <div class="vu-dias">${b.dias.map(x => `<button class="sis-menu-chip${x === st.dia ? ' activo' : ''}" data-accion="dia" data-dia="${x}">${fechaLegible(x)}${st.hoja && x === st.hoja.fecha ? ' · vuelo' : ''}</button>`).join('')}</div>
        <div class="vu-resumen-dia">
          ${b.ventana ? chip(`Ventana GO ${dosD(b.ventana[0])}:00 – ${dosD(b.ventana[1] + 1)}:00`, 'verde') : chip('Sin ventana GO este día', 'rojo')}
          ${chip(`Sol ${b.sol && b.sol.salida ? b.sol.salida.slice(11, 16) : '—'} – ${b.sol && b.sol.puesta ? b.sol.puesta.slice(11, 16) : '—'}`)}
          ${chip(b.kps.length ? `Kp máx. ${fmt(Math.max(...b.kps), 0)}` : 'Kp sin dato')}
        </div>
        <p class="sis-tenue vu-graf-ley">Barra: viento sostenido a 120 m (color = estado) · línea: ráfaga estimada · banda gris: diferencia entre ECMWF, GFS e ICON.</p>
        ${graficoPronostico(b.filas, d)}
        <p class="sis-tenue">Promedio de ${p.horas[0]?.modelos || 0} modelos; si la banda es ancha, el pronóstico es inseguro. ${st.kps ? 'Kp: NOAA, ventanas de 3 h.' : 'No se pudo leer el Kp de NOAA.'} Modelos globales: en valles y faenas de cordillera el viento real puede diferir.</p>`;
    return { ...b, html };
  }

  function htmlChecklist(chk, titulo) {
    return `<section class="sis-tarjeta"><h2>${titulo}</h2><dl class="vu-tabla">${chk.map(x => fila(esc(x.texto), `<span class="${x.cumple ? 'vu-verde' : 'vu-rojo'}">${esc(x.detalle)}</span>`)).join('')}</dl>
      <p class="sis-tenue">Límites del dron elegido (Vuelos → Drones).</p></section>`;
  }

  function htmlMetar() {
    const m = st.metar;
    return `<section class="sis-tarjeta"><h2>METAR · TAF</h2>
      ${m ? `<p class="sis-tenue">${esc(m.icao)} · ${esc(m.nombre)} · a ${fmt(m.km, 0)} km${m.viento ? ` · viento ${m.viento.dir != null ? m.viento.dir + '°' : 'variable'} ${fmt(m.viento.v, 1)} m/s${m.viento.g ? ` ráf. ${fmt(m.viento.g, 1)}` : ''}` : ''}</p>
        <pre class="vu-metar">${esc(m.metar)}${m.taf ? '\n\n' + esc(m.taf) : ''}</pre><a class="vu-link" href="${enlaceMetar(m.icao)}" target="_blank" rel="noopener">Ver en NOAA ↗</a>`
        : st.metarError ? `<p class="sis-tenue">${esc(st.metarError)}</p><a class="sis-btn chico" href="https://aipchile.dgac.gob.cl/" target="_blank" rel="noopener">Revisar METAR en AIP Chile ↗</a>`
        : '<p class="sis-tenue">Se busca al consultar el pronóstico (el aeródromo con reporte más cercano, datos de NOAA).</p>'}
    </section>`;
  }

  function vistaClima() {
    const h = st.hoja, d = dron(), g = geo();
    if (!g) return `<section class="sis-tarjeta sis-vacio"><p>Primero carga el área: el pronóstico se consulta en su centro.</p><button class="sis-btn primario" data-accion="paso" data-paso="area">Ir a Área</button></section>`;
    let cuerpo = '', lado = '';
    if (st.pronCargando) cuerpo = '<p class="sis-tenue">Consultando el pronóstico…</p>';
    else if (st.pronError) cuerpo = `<div class="sis-error">${esc(st.pronError)}</div>`;
    else if (st.pron) { const b = bloquePronostico(st.pron, d, `Centro de «${h.nombre || 'el área'}»`); cuerpo = b.html; lado = htmlChecklist(b.chk, b.ventana ? `Checklist · ventana ${dosD(b.ventana[0])}–${dosD(b.ventana[1] + 1)} h` : 'Checklist · horas con luz'); }
    else if (h.clima) cuerpo = `<p class="sis-tenue">Última consulta: ${fechaHora(h.clima.consultadoEn)}. Vuelve a consultar para ver el gráfico actualizado.</p>`;
    else cuerpo = '<p class="sis-tenue">Consulta el pronóstico de los próximos 3 días en el centro del área.</p>';
    return `<div class="vu-dos ancho">
      <div class="vu-izquierda">
        <section class="sis-tarjeta"><div class="sis-cab"><h2>Pronóstico · ${h.fecha ? fechaLegible(h.fecha) : 'sin fecha'}</h2>
          <button class="sis-btn primario chico" data-accion="consultar-hoja">${st.pron ? 'Actualizar' : 'Consultar pronóstico'}</button></div>
          ${cuerpo}
        </section>
      </div>
      <div class="vu-derecha">
        ${lado || (h.clima && h.clima.checklist ? htmlChecklist(h.clima.checklist, 'Checklist (última consulta)') : '')}
        ${htmlMetar()}
        <section class="sis-tarjeta"><h2>Viento medido en terreno</h2>
          ${h.viento.length ? `<dl class="vu-tabla">${h.viento.map((v, k) => fila(`${esc(v.hora)}${v.nota ? ` · ${esc(v.nota)}` : ''}`, `${fmt(v.ms, 1)} m/s <button class="vu-link" data-accion="quitar-viento" data-k="${k}" aria-label="Quitar">✕</button>`)).join('')}</dl>` : ''}
          <form class="vu-viento" data-form="viento"><input name="hora" placeholder="hh:mm" aria-label="Hora" value="${new Date().toTimeString().slice(0, 5)}"><input name="ms" placeholder="m/s" inputmode="decimal" aria-label="Viento en m/s" required><input name="nota" placeholder="Nota (opcional)" aria-label="Nota"><button class="sis-btn chico">Anotar</button></form>
          <p class="sis-tenue">Anemómetro en el despegue. Queda en la hoja para comparar con el pronóstico.</p>
        </section>
        <section class="sis-tarjeta"><h2>Antes de volar, revisa también</h2>
          <div class="vu-enlaces">${ENLACES_CONSULTA.map(([t, u]) => `<a class="sis-btn chico" href="${u}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join('')}</div>
        </section>
      </div>
    </div>`;
  }

  async function consultarClima(lat, lon) {
    st.pronCargando = true; st.pronError = ''; st.metarError = ''; await render();
    try {
      const [p, kps] = await Promise.all([pedirPronostico(lat, lon), st.kps ? Promise.resolve(st.kps) : pedirKp()]);
      st.pron = p; st.kps = kps; st.dia = null;
    } catch (e) { st.pronError = `No se pudo consultar el pronóstico (${e.message}). Revisa la conexión a internet.`; st.pron = null; }
    try { st.metar = await metarCercano(lat, lon); if (!st.metar) st.metarError = 'No hay aeródromos con METAR a menos de ~120 km.'; }
    catch { st.metar = null; st.metarError = 'No se pudo leer el METAR desde la app (sin conexión o el servicio no respondió).'; }
    st.pronCargando = false;
  }

  function guardarResumenClima() {
    const h = st.hoja, d = dron();
    if (!st.pron || !h) return;
    const b = analizarDia(st.pron, d);
    const raf = b.filas.filter(f => f.h.g != null && f.ev.estado !== 'noche').sort((x, y) => y.h.g - x.h.g)[0];
    h.clima = {
      consultadoEn: new Date().toISOString(), fecha: st.dia, lat: st.pron.lat, lon: st.pron.lon,
      ventana: b.ventana ? `${dosD(b.ventana[0])}:00–${dosD(b.ventana[1] + 1)}:00` : '',
      rafaga: raf ? { v: raf.h.g, hora: raf.h.hora } : null, kpMax: b.kps.length ? Math.max(...b.kps) : null,
      sol: b.sol && b.sol.salida ? [b.sol.salida.slice(11, 16), b.sol.puesta ? b.sol.puesta.slice(11, 16) : '—'] : null,
      modelos: st.pron.horas[0]?.modelos || 0, checklist: b.chk,
      horas: b.filas.map(f => ({ hora: f.h.hora, v: f.h.v, g: f.h.g, dir: f.h.dir, prob: f.h.prob, nubes: f.h.nubes, temp: f.h.temp, kp: f.kp, estado: f.ev.estado })),
      metar: st.metar ? { icao: st.metar.icao, nombre: st.metar.nombre, km: st.metar.km, metar: st.metar.metar, taf: st.metar.taf } : null,
    };
    cambio();
  }

  // ─────────── Paso 4 · Permisos y consultas ───────────
  function fechaMenosHabiles(fecha, n) {
    const d = new Date(fecha + 'T12:00:00');
    while (n > 0) { d.setDate(d.getDate() - 1); const w = d.getDay(); if (w !== 0 && w !== 6) n--; }
    return d.toISOString().slice(0, 10);
  }

  function vistaPermisos() {
    const h = st.hoja, g = h.permisos.dgac, perm = estadoPermiso(h);
    const habiles = g.enviado && h.fecha ? diasHabiles(g.enviado, h.fecha) : null;
    const hito = (k, t) => `<label class="vu-hito${g[k] ? ' hecho' : ''}"><span class="vu-hito-punto" aria-hidden="true"></span><span>${t}</span><input type="date" data-dgac="${k}" value="${esc(g[k] || '')}" aria-label="${t}"></label>`;
    return `<div class="vu-dos ancho">
      <div class="vu-izquierda">
        <section class="sis-tarjeta"><div class="sis-cab"><h2>Solicitud a la DGAC</h2>${chip(perm.texto, perm.nivel === 'ok' ? 'verde' : perm.nivel === 'aviso' ? 'ambar' : 'gris')}</div>
          <div class="vu-hitos">${hito('preparado', 'En preparación')}${hito('enviado', 'Enviada a la DGAC')}${hito('aprobado', 'Aprobada')}${hito('vence', 'Vigente hasta')}</div>
          <label class="sis-campo"><span>N° de solicitud o autorización</span><input data-dgac="numero" value="${esc(g.numero || '')}"></label>
          ${habiles != null && habiles < 7 && !g.aprobado ? `<div class="vu-aviso">Se envió ${habiles} día${habiles === 1 ? '' : 's'} hábil${habiles === 1 ? '' : 'es'} antes del vuelo; la DGAC pide al menos 7.</div>` : ''}
          ${!g.enviado && h.fecha ? `<p class="sis-tenue">Para volar el ${fechaLegible(h.fecha)}, conviene enviarla a más tardar el ${fechaLegible(fechaMenosHabiles(h.fecha, 7))} (7 días hábiles).</p>` : ''}
        </section>
        <section class="sis-tarjeta"><h2>Documentos de la solicitud</h2>
          ${DOCUMENTOS_DGAC.map(([k, t]) => `<label class="sis-check vu-doc"><input type="checkbox" data-doc="${k}" ${h.permisos.docs[k] ? 'checked' : ''}> ${t}</label>`).join('')}
          <div class="sis-acciones">${geo() ? '<button class="sis-btn chico" data-accion="kml-vuelo">Descargar KML de la zona (área de vuelo)</button>' : ''}</div>
          <p class="sis-tenue">Más adelante la credencial del piloto y la inscripción del dron se leerán desde Personas y Equipos.</p>
        </section>
      </div>
      <div class="vu-derecha">
        <section class="sis-tarjeta"><h2>Consultas oficiales · con registro</h2>
          ${CONSULTAS.map(([k, t, u]) => { const x = ultimaConsulta(h, k); return `<div class="vu-consulta">
            <div><a href="${u}" target="_blank" rel="noopener"><b>${t}</b> ↗</a>${x ? `<span class="sis-tenue">Revisado ${fechaHora(x.fecha)}${x.personaId ? ` · ${esc(nomPers(x.personaId))}` : ''}</span>` : '<span class="vu-rojo">Pendiente</span>'}</div>
            <div class="sis-acciones">${x && x.archivoId ? `<button class="sis-btn chico" data-accion="ver-captura" data-id="${esc(x.archivoId)}">Ver captura</button>` : ''}
              <button class="sis-btn chico" data-accion="consulta" data-tipo="${k}">Marcar revisado</button>
              <label class="sis-btn chico vu-archivo">+ Captura<input type="file" accept="image/*,application/pdf" data-archivo="captura" data-tipo="${k}" hidden></label></div>
          </div>`; }).join('')}
          <p class="sis-tenue">Revisa el NOTAM el mismo día del vuelo. Cada revisión queda con fecha, persona y, si la adjuntas, la captura.</p>
        </section>
        <section class="sis-tarjeta"><h2>Otras consultas</h2>
          <div class="vu-enlaces">${ENLACES_CONSULTA.filter(([t]) => !/AIP/.test(t)).map(([t, u]) => `<a class="sis-btn chico" href="${u}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join('')}</div>
        </section>
      </div>
    </div>`;
  }

  // ─────────── Hoja para terreno (impresión / PDF) ───────────
  function imprimir() {
    const h = st.hoja, d = dron(), g = geo();
    if (!g) return;
    const t = totales(h, d, g);
    const lineas = [];
    t.sectores.forEach(r => r && r.baterias.forEach((b, k) => b.piezas.forEach(pz => lineas.push({ pts: pz, color: COLORES_BATERIA[k % COLORES_BATERIA.length] }))));
    const centro = pts => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
    const svg = esquemaSVG({
      borde: g.tipo === 'poligono' && Number(h.area.margen) ? g.original : null,
      poligonos: g.sectores.map(s => s.poligono), lineas,
      puntos: t.sectores.filter(Boolean).map(r => ({ xy: r.despegueXY })),
      etiquetas: g.sectores.length > 1 ? g.sectores.map((s, i) => ({ xy: centro(s.poligono), texto: nombreSector(h, i, g.sectores.length) })) : [],
    });
    const c = h.clima, perm = estadoPermiso(h);
    const filaT = (a, b) => `<tr><th>${a}</th><td>${b}</td></tr>`;
    const despLL = r => { const [lon, lat] = g.marco.aLonLat(r.despegueXY); return `${lat.toFixed(5)}, ${lon.toFixed(5)}`; };
    const vacias = Array(Math.max(0, 6 - h.viento.length)).fill({ hora: '', ms: '', nota: '' });
    const html = `<div class="vu-imp">
      <header><div><b>${esc(document.querySelector('.sis-marca b')?.textContent || 'Topoland')}</b> · Hoja de vuelo</div><div>${esc(h.nombre || '')}</div></header>
      <table class="vu-imp-datos">${filaT('Proyecto', esc(nomProy(h.proyectoId)))}${filaT('Fecha', h.fecha ? fechaLegible(h.fecha) : '')}${filaT('Piloto', esc(nomPers(h.pilotoId)))}${filaT('Dron', esc(d.nombre))}
        ${filaT('Producto', `${h.params.modo === 'lidar' ? 'LiDAR' : 'Fotogrametría'} · GSD ${fmt(t.gsd, 2)} cm · altura ${fmt(t.altura, 0)} m · traslapes ${h.params.traslapeFrontal}/${h.params.traslapeLateral} %`)}
        ${filaT('Área de vuelo', `${fmt(g.areaVuelo / 10000, 2)} ha${g.tipo === 'corredor' ? ` · corredor de ${fmt(g.izq + g.der, 0)} m` : Number(h.area.margen) ? ` · margen de ${h.area.margen} m` : ''}`)}
        ${filaT('Vuelo', `${t.baterias} baterías · ${fmtDuracion(t.minVuelo)} en el aire · jornada ${fmtDuracion(t.minJornada)}`)}</table>
      <div class="vu-imp-mapa">${svg}</div>
      <table class="vu-imp-tabla"><thead><tr><th>Sector</th><th>ha</th><th>Rumbo</th><th>Velocidad</th><th>Baterías (min)</th><th>Jornada</th><th>Despegue (lat, lon)</th></tr></thead>
        <tbody>${t.sectores.map((r, i) => r ? `<tr><td>${esc(nombreSector(h, i, g.sectores.length))}</td><td>${fmt(r.area / 10000, 1)}</td><td>${r.corredor ? 'eje' : fmt(r.rumbo, 0) + '°'}</td><td>${fmt(r.velocidad, 1)} m/s</td><td>${r.baterias.map((b, k) => `B${k + 1} ${fmt(b.min, 0)}′`).join(' · ')}</td><td>${fmtDuracion(r.minTotal)}</td><td>${despLL(r)}</td></tr>` : '').join('')}</tbody></table>
      <div class="vu-imp-dos">
        <div><h3>Clima${c ? ` · ${fechaLegible(c.fecha)}` : ''}</h3>${c ? `<p>Ventana GO: <b>${esc(c.ventana || 'sin ventana')}</b> · Sol ${c.sol ? c.sol.join('–') : '—'} · Kp máx. ${c.kpMax != null ? fmt(c.kpMax, 0) : '—'}</p>
          <table class="vu-imp-tabla chica"><thead><tr><th>Hora</th><th>Viento</th><th>Ráfaga</th><th>Lluvia</th><th>Estado</th></tr></thead><tbody>${(c.horas || []).filter((_, k) => k % 2 === 0).map(x => `<tr><td>${dosD(x.hora)}</td><td>${fmt(x.v, 1)}</td><td>${fmt(x.g, 1)}</td><td>${x.prob != null ? fmt(x.prob) + '%' : '—'}</td><td>${{ go: 'GO', marg: 'Marg.', no: 'NO', noche: '—' }[x.estado]}</td></tr>`).join('')}</tbody></table>
          ${c.metar ? `<p class="mono">${esc(c.metar.metar)}</p>` : ''}` : '<p>Sin consulta de clima.</p>'}
          <h3>Checklist</h3><ul class="vu-imp-chk">${(c && c.checklist || []).map(x => `<li>☐ ${esc(x.texto)} — ${esc(x.detalle)}</li>`).join('')}<li>☐ NOTAM revisado el día del vuelo</li><li>☐ Baterías cargadas (${t.baterias + 1} como mínimo)</li></ul></div>
        <div><h3>Permisos</h3><p>DGAC: <b>${esc(perm.texto)}</b> · ${esc(perm.detalle)}${h.permisos.dgac.numero ? ` · N° ${esc(h.permisos.dgac.numero)}` : ''}</p>
          <ul class="vu-imp-chk">${DOCUMENTOS_DGAC.map(([k, tt]) => `<li>${h.permisos.docs[k] ? '☑' : '☐'} ${tt}</li>`).join('')}</ul>
          <h3>Viento medido en terreno</h3><table class="vu-imp-tabla chica"><thead><tr><th>Hora</th><th>m/s</th><th>Nota</th></tr></thead><tbody>${[...h.viento, ...vacias].map(v => `<tr><td>${esc(v.hora)}</td><td>${v.ms === '' ? '' : fmt(v.ms, 1)}</td><td>${esc(v.nota || '')}</td></tr>`).join('')}</tbody></table>
          <h3>Observaciones</h3><div class="vu-imp-obs"></div></div>
      </div>
      <footer>Generado ${new Date().toLocaleString('es-CL')} · Estimación para planificar; el vuelo se programa en DJI Pilot 2. Información aeronáutica oficial: AIP Chile (DGAC).</footer>
    </div>`;
    let caja = document.getElementById('vu-impresion');
    if (!caja) { caja = document.createElement('div'); caja.id = 'vu-impresion'; document.body.appendChild(caja); }
    caja.innerHTML = html;
    document.body.classList.add('vu-imprimiendo');
    const fin = () => { document.body.classList.remove('vu-imprimiendo'); removeEventListener('afterprint', fin); };
    addEventListener('afterprint', fin);
    setTimeout(() => { window.print(); setTimeout(fin, 1500); }, 50);
  }

  // ─────────── Pronóstico rápido ───────────
  function vistaRapido() {
    const d = drones.find(x => x.id === st.rapDron) || drones[0];
    let cuerpo = '', lado = '';
    if (st.pronCargando) cuerpo = '<p class="sis-tenue">Consultando el pronóstico…</p>';
    else if (st.pronError) cuerpo = `<div class="sis-error">${esc(st.pronError)}</div>`;
    else if (st.pron) { const b = bloquePronostico(st.pron, d, st.rapOrigen); cuerpo = b.html; lado = htmlChecklist(b.chk, b.ventana ? 'Checklist · ventana GO' : 'Checklist · horas con luz'); }
    return `<div class="vu-dos ancho">
      <div class="vu-izquierda">
        <section class="sis-tarjeta"><h2>Pronóstico rápido</h2>
          <p class="sis-tenue">Para un lugar sin hoja de vuelo. Para un trabajo, usa el paso Clima de su hoja.</p>
          <form class="sis-form" data-form="rapido">
            <div class="sis-par">
              <label class="sis-campo"><span>Latitud</span><input name="lat" value="${esc(st.rapLat)}" placeholder="-32.83" inputmode="decimal"></label>
              <label class="sis-campo"><span>Longitud</span><input name="lon" value="${esc(st.rapLon)}" placeholder="-70.60" inputmode="decimal"></label>
            </div>
            <label class="sis-campo"><span>Dron (para sus límites)</span><select name="rapDron">${familias().map(([k, t]) => { const x = drones.find(y => (y.familia || y.id) === k); return `<option value="${x.id}" ${(d.familia || d.id) === k ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>
            <div class="sis-acciones"><button class="sis-btn primario">Consultar coordenadas</button><button type="button" class="sis-btn" data-accion="gps">Usar mi ubicación</button></div>
          </form>
          ${cuerpo}
        </section>
      </div>
      <div class="vu-derecha">${lado}${st.pron ? htmlMetar() : ''}</div>
    </div>`;
  }

  // ─────────── Limpiar KML ───────────
  function vistaKml() {
    const a = st.kml;
    const contornos = a ? a.poligonos.filter(p => !p.abierta) : [];
    return `<section class="sis-tarjeta">
      <h2>Limpiar un KML o KMZ para el control</h2>
      <p>Revisa el archivo (de Global Mapper, AutoCAD, Google Earth…) y deja cada polígono o línea como lo lee el control: un elemento por archivo, sin altura, sin vértices repetidos y con pocos vértices.</p>
      <div class="sis-acciones">
        <label class="sis-btn primario vu-archivo">Elegir archivo<input type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" data-archivo="kml" hidden></label>
        <label class="sis-campo vu-mini"><span>Máximo de vértices</span><input data-campo="maxVertices" value="${st.maxVertices}" inputmode="numeric"></label>
      </div>
      ${st.kmlError ? `<div class="sis-error">${esc(st.kmlError)}</div>` : ''}
    </section>
    ${a ? `<div class="vu-kml">
      <section class="sis-tarjeta">
      <h2>${esc(a.archivo)}</h2>
      <p class="sis-tenue">${a.placemarks} elemento${a.placemarks === 1 ? '' : 's'} · ${contornos.length} contorno${contornos.length === 1 ? '' : 's'} · ${a.ejes.length} línea${a.ejes.length === 1 ? '' : 's'} abierta${a.ejes.length === 1 ? '' : 's'}${a.puntos ? ` · ${a.puntos} punto${a.puntos > 1 ? 's' : ''} (se ignoran)` : ''}${a.carpetas ? ` · ${a.carpetas} carpeta${a.carpetas > 1 ? 's' : ''}` : ''}</p>
      ${contornos.length || a.ejes.length ? `<div class="sis-lista">
        ${contornos.map((p, n) => { const i = a.poligonos.indexOf(p); return `<div class="sis-fila vu-kml-fila">
          <span class="sis-fila-txt"><b>${n + 1}. ${esc(p.nombre)}</b><span class="sis-tenue">Contorno · ${fmt(p.area / 10000, 2)} ha · ${p.vertices} vértices</span>
            ${p.problemas.length ? `<ul class="vu-problemas">${p.problemas.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<span class="sis-chip verde">Sin problemas</span>'}</span>
          <span class="sis-acciones"><button class="sis-btn chico" data-accion="kml-limpio" data-i="${i}">Descargar KML</button>
            <button class="sis-btn chico" data-accion="kml-a-hoja" data-i="${i}">Nueva hoja</button></span></div>`; }).join('')}
        ${a.ejes.map((e, i) => `<div class="sis-fila vu-kml-fila">
          <span class="sis-fila-txt"><b>${esc(e.nombre)}</b><span class="sis-tenue">Línea abierta · ${fmt(e.largo / 1000, 2)} km · ${e.vertices} vértices</span>
            ${e.problemas.length ? `<ul class="vu-problemas">${e.problemas.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<span class="sis-chip verde">Sin problemas</span>'}</span>
          <span class="sis-acciones"><button class="sis-btn chico" data-accion="eje-limpio" data-i="${i}">Descargar línea</button>
            <button class="sis-btn chico" data-accion="eje-a-hoja" data-i="${i}">Nueva hoja (corredor)</button></span></div>`).join('')}
        </div><p class="sis-tenue">Cada elemento se descarga como un archivo aparte, que es lo que el control importa mejor.</p>`
        : '<div class="sis-vacio"><p>No encontré polígonos ni líneas en este archivo.</p></div>'}
      </section>
      ${contornos.length || a.ejes.length ? '<div class="vu-mapa-caja"><div class="vu-mapa-lugar" data-mapa="kml"></div></div>' : ''}
    </div>` : ''}`;
  }

  function vistaDrones() {
    return `<p class="sis-tenue">Valores de referencia tomados de las fichas técnicas. Revísalos con la ficha de tu equipo: si corriges uno, se usa tu valor en todos los cálculos. El Matrice 300 aparece una vez por sensor. Los Mavic 2 Enterprise no están porque se usan solo para termografía.</p>
      ${drones.map(d => `<section class="sis-tarjeta"><div class="sis-cab"><h2>${esc(d.nombre)}</h2>${d.corregido ? chip('Corregido', 'ambar') : ''}</div>
        <form class="sis-form vu-dron" data-form="dron" data-id="${d.id}"><div class="vu-grilla">
          ${CAMPOS_DRON.map(([k, t, u]) => campo(k, t, d[k], '', u)).join('')}
          ${d.lidar ? campo('lidarPps', 'LiDAR: puntos por segundo', d.lidar.puntosPorSegundo, '', 'pts/s') + campo('lidarFov', 'LiDAR: campo de visión', d.lidar.fovGrados, '', '°') : ''}
        </div><div class="sis-acciones"><button class="sis-btn chico primario">Guardar</button>
        ${d.corregido ? `<button type="button" class="sis-btn chico" data-accion="restablecer-dron" data-id="${d.id}">Volver a los valores de fábrica</button>` : ''}</div></form>
      </section>`).join('')}`;
  }

  // ─────────── Mapas (Leaflet + Esri híbrido) ───────────
  const mapas = {};
  async function cargarLeaflet() { if (window.L) return window.L; await cargarScript('vendor/leaflet/leaflet.js'); return window.L; }
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
      m = mapas[clave] = { el, mapa, capas: {}, L, encuadre: null };
      mapa.setView(CENTRO_CHILE, 7);
      mapa.on('click', ev => alClicMapa(clave, ev));
    }
    if (m.el.parentNode !== lugar) lugar.appendChild(m.el);
    m.mapa.invalidateSize();
    return m;
  }
  const quitar = (m, ...ns) => { for (const n of ns) if (m.capas[n]) { m.capas[n].remove(); delete m.capas[n]; } };
  const aLL = g => p => g.marco.aLatLng(p);

  function encuadrar(m, puntosLL, firma) {
    if (m.encuadre === firma) return;
    const b = m.L.latLngBounds(puntosLL);
    if (b.isValid()) m.mapa.fitBounds(b, { padding: [30, 30] });
    m.encuadre = firma;
  }

  function pintarDibujo(m) {
    const { L, mapa } = m;
    quitar(m, 'dibujo');
    if (!st.dibujo) return;
    const pts = st.dibujo.puntos.map(([lon, lat]) => [lat, lon]);
    const cerrar = st.dibujo.modo === 'area' && pts.length >= 3;
    m.capas.dibujo = L.layerGroup([
      ...(pts.length >= 2 ? [L.polyline(cerrar ? [...pts, pts[0]] : pts, { color: '#FFFFFF', weight: 2.5, dashArray: '7 5', interactive: false })] : []),
      ...pts.map(p => L.circleMarker(p, { radius: 5, color: '#FFFFFF', weight: 2, fillColor: '#E8611C', fillOpacity: 1, interactive: false })),
    ]).addTo(mapa);
  }

  async function mapaArea() {
    const lugar = raiz.querySelector('[data-mapa="area"]');
    if (!lugar) return;
    const m = await mapaEn(lugar, 'area');
    if (!m) { lugar.innerHTML = '<p class="sis-tenue vu-sin-mapa">El mapa necesita internet. El cálculo funciona igual.</p>'; return; }
    m.el.classList.toggle('dibujando', !!st.dibujo);
    pintarArea(m);
    pintarDibujo(m);
  }

  function pintarArea(m) {
    const { L, mapa } = m;
    const g = geo(), h = st.hoja;
    quitar(m, 'original', 'sectores', 'cortes', 'eje');
    pintarZonas(m);
    if (!g) return;
    const LL = aLL(g);
    if (g.tipo === 'poligono' && Number(h.area.margen)) m.capas.original = L.polygon(g.original.map(LL), { color: '#FFFFFF', weight: 2, dashArray: '6 5', fill: false, interactive: false }).addTo(mapa);
    if (g.tipo === 'corredor') m.capas.eje = L.polyline(g.eje.map(LL), { color: '#FFFFFF', weight: 2, dashArray: '3 5', interactive: false }).addTo(mapa);
    const varios = g.sectores.length > 1;
    m.capas.sectores = L.layerGroup(g.sectores.map((s, i) => {
      const p = L.polygon(s.poligono.map(LL), { color: '#E8611C', weight: 3, fillColor: COLORES_SECTOR[i % COLORES_SECTOR.length], fillOpacity: varios ? 0.25 : 0.1, interactive: false });
      if (varios) p.bindTooltip(nombreSector(h, i, g.sectores.length), { permanent: true, direction: 'center', className: 'vu-etiqueta' });
      return p;
    })).addTo(mapa);
    const capas = [];
    h.area.cortes.forEach((c, k) => {
      capas.push(L.polyline(c.map(([lon, lat]) => [lat, lon]), { color: '#FFFFFF', weight: 3, dashArray: '9 6', interactive: false }));
      c.forEach((p, j) => {
        const mk = L.marker([p[1], p[0]], { draggable: true, icon: L.divIcon({ className: 'vu-vertice', html: '<span></span>', iconSize: [16, 16], iconAnchor: [8, 8] }), title: 'Arrastra para mover el corte' });
        mk.on('dragend', ev => { const q = ev.target.getLatLng(); h.area.cortes[k][j] = [q.lng, q.lat]; cambio(); refrescarArea(); });
        capas.push(mk);
      });
    });
    m.capas.cortes = L.layerGroup(capas).addTo(mapa);
    encuadrar(m, g.vuelo.map(LL), `area:${JSON.stringify(g.vuelo[0])}:${g.vuelo.length}`);
  }

  function pintarZonas(m) {
    const { L, mapa } = m;
    quitar(m, 'zonas');
    const capas0 = st.capas || [];
    if (!capas0.length) return;
    const activas = capasActivas();
    const g = geo();
    const centro = g ? g.marco.aLonLat([0, 0]) : null;
    const cerca = el => { if (!centro) return true; const p = el.tipo === 'punto' ? el.coords : el.coords[0]; return Math.abs(p[0] - centro[0]) < 0.8 && Math.abs(p[1] - centro[1]) < 0.8; };
    const capas = [];
    for (const c of capas0) {
      if (!activas.includes(c.id)) continue;
      const color = TIPOS_CAPA[c.tipo].color;
      for (const el of c.elementos) {
        if (!cerca(el) || capas.length > 3000) continue;
        if (el.tipo === 'punto') capas.push(L.circleMarker([el.coords[1], el.coords[0]], { radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).bindTooltip(el.nombre || c.nombre));
        else if (el.tipo === 'poligono') capas.push(L.polygon(el.coords.map(([lon, lat]) => [lat, lon]), { color, weight: 1.5, fillColor: color, fillOpacity: 0.15, dashArray: c.tipo === 'restringida' ? '4 3' : null }).bindTooltip(el.nombre || c.nombre, { sticky: true }));
        else capas.push(L.polyline(el.coords.map(([lon, lat]) => [lat, lon]), { color, weight: 1.5, opacity: 0.8 }).bindTooltip(el.nombre || c.nombre, { sticky: true }));
      }
    }
    m.capas.zonas = L.layerGroup(capas).addTo(mapa);
  }

  async function mapaVuelo() {
    const lugar = raiz.querySelector('[data-mapa="vuelo"]');
    if (!lugar) return;
    const m = await mapaEn(lugar, 'vuelo');
    if (!m) { lugar.innerHTML = '<p class="sis-tenue vu-sin-mapa">El mapa necesita internet. El cálculo funciona igual.</p>'; return; }
    pintarVuelo(m);
  }

  function pintarVuelo(m) {
    const { L, mapa } = m;
    const g = geo(), h = st.hoja;
    quitar(m, 'sectores', 'lineas', 'traslados');
    if (!g) return;
    const LL = aLL(g), i = secSel();
    const r = calcularSector(h, dron(), g, i);
    m.capas.sectores = L.layerGroup(g.sectores.map((s, k) => L.polygon(s.poligono.map(LL), { color: '#E8611C', weight: k === i ? 3 : 1.5, opacity: k === i ? 1 : 0.6, fillColor: '#E8611C', fillOpacity: k === i ? 0.1 : 0.03, interactive: k !== i })
      .on('click', () => { if (k !== i) { h.area.sel = k; cambio(); render(); } }))).addTo(mapa);
    if (!r) return;
    m.capas.lineas = L.layerGroup(r.baterias.flatMap((b, k) => b.piezas.map(pz => L.polyline(pz.slice(0, 5000).map(LL), { color: COLORES_BATERIA[k % COLORES_BATERIA.length], weight: 2, opacity: 0.95, interactive: false })))).addTo(mapa);
    const desp = LL(r.despegueXY);
    m.capas.traslados = L.layerGroup(r.baterias.slice(0, 40).map(b => L.polyline([desp, LL(b.inicio)], { color: '#FFFFFF', weight: 1.5, dashArray: '5 5', opacity: 0.9, interactive: false }))).addTo(mapa);
    if (!m.capas.despegue) {
      const icono = L.divIcon({ className: 'vu-despegue', html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 13] });
      m.capas.despegue = L.marker(desp, { draggable: true, icon: icono, title: 'Punto de despegue (arrástralo)', keyboard: true, zIndexOffset: 1000 }).addTo(mapa);
      m.capas.despegue.on('dragend', ev => { const q = ev.target.getLatLng(); metaSector(st.hoja, secSel()).despegue = [q.lng, q.lat]; cambio(); refrescarVuelo(); });
    } else m.capas.despegue.setLatLng(desp);
    encuadrar(m, g.sectores[i].poligono.map(LL), `vuelo:${i}:${JSON.stringify(g.sectores[i].poligono[0])}`);
  }

  async function mapaKml() {
    const lugar = raiz.querySelector('[data-mapa="kml"]');
    if (!lugar || !st.kml) return;
    const m = await mapaEn(lugar, 'kml');
    if (!m) { lugar.innerHTML = '<p class="sis-tenue vu-sin-mapa">El mapa necesita internet.</p>'; return; }
    if (m.kml === st.kml) return;
    quitar(m, 'kml');
    const { L } = m;
    const capas = [
      ...st.kml.poligonos.filter(p => !p.abierta).map((p, i) => L.polygon(p.anillo.map(([lon, lat]) => [lat, lon]), { color: p.problemas.length ? '#FFB74D' : '#E8611C', weight: 3, fillOpacity: 0.12 }).bindTooltip(`${i + 1}. ${p.nombre}`, { sticky: true })),
      ...st.kml.ejes.map(e => L.polyline(e.linea.map(([lon, lat]) => [lat, lon]), { color: '#4FC3F7', weight: 3 }).bindTooltip(e.nombre, { sticky: true })),
    ];
    if (!capas.length) return;
    m.capas.kml = L.featureGroup(capas).addTo(m.mapa);
    m.mapa.fitBounds(m.capas.kml.getBounds(), { padding: [24, 24] });
    m.kml = st.kml;
  }

  function alClicMapa(clave, ev) {
    if (clave !== 'area' || !st.dibujo) return;
    st.dibujo.puntos.push([ev.latlng.lng, ev.latlng.lat]);
    const b = raiz.querySelector('#vu-barra-area'); if (b) b.innerHTML = barraDibujo();
    if (mapas.area) pintarDibujo(mapas.area);
  }

  // ─────────── Refrescos parciales (sin rehacer el mapa ni los deslizadores) ───────────
  function poner(id, html) { const el = raiz.querySelector('#' + id); if (el) el.innerHTML = html; }
  function ponerValor(nombre, valor) {
    const rango = raiz.querySelector(`input[type=range][name="${nombre}"]`), espejo = raiz.querySelector(`input[data-espejo="${nombre}"]`);
    if (rango && document.activeElement !== rango) rango.value = valor;
    if (espejo && document.activeElement !== espejo) espejo.value = valor;
  }
  function refrescarVuelo() {
    const g = geo(); if (!g) return;
    const r = calcularSector(st.hoja, dron(), g, secSel());
    poner('vu-kpis', htmlKpis(r)); poner('vu-barra', htmlBarraRumbo(r)); poner('vu-leyenda', htmlLeyenda(r));
    poner('vu-detalle', htmlDetalle(r)); poner('vu-vel-pie', pieVelocidad(r)); poner('vu-total-hoja', htmlTotalHoja());
    if (r && st.hoja.params.velocidad === '') ponerValor('velocidad', Math.round(r.velocidad * 10) / 10);
    if (mapas.vuelo && mapas.vuelo.el.isConnected) pintarVuelo(mapas.vuelo);
  }
  function refrescarArea() {
    const g = geo();
    poner('vu-sectores', htmlSectores()); poner('vu-zonas', htmlZonas());
    const info = raiz.querySelector('#vu-margen-info');
    if (info && g) info.innerHTML = g.tipo === 'corredor' ? textoCorredor(g) : `${fmt(areaM2(g.original) / 10000, 2)} ha → <b>${fmt(g.areaVuelo / 10000, 2)} ha</b> de vuelo`;
    if (mapas.area && mapas.area.el.isConnected) pintarArea(mapas.area);
  }

  // ─────────── Render ───────────
  async function render() {
    if (!activo) return;
    await cargarBase();
    if (!st.capas) { try { st.capas = await listarCapas(); } catch { st.capas = []; } }
    let html;
    if (st.vista === 'hoja' && st.hoja) {
      const vistas = { resumen: vistaResumen, area: vistaArea, vuelo: vistaVuelo, clima: vistaClima, permisos: vistaPermisos };
      html = encabezadoHoja() + `<div class="vu-paso-cuerpo">${vistas[st.paso]()}</div>`;
    } else {
      if (st.vista === 'hoja') st.vista = 'hojas';
      html = ({ hojas: vistaHojas, rapido: vistaRapido, kml: vistaKml, drones: vistaDrones })[st.vista]();
    }
    if (!activo) return;
    const herr = st.vista === 'hoja' ? 'hojas' : st.vista;
    raiz.innerHTML = `<nav class="vu-nav" aria-label="Vuelos">${HERRAMIENTAS.map(([id, t]) => `<button class="vu-pestana${id === herr ? ' activa' : ''}" data-accion="vista" data-vista="${id}">${t}</button>`).join('')}</nav>
      ${st.mensaje ? `<div class="vu-msg ${st.mensaje.tipo}">${esc(st.mensaje.texto)}</div>` : ''}
      <div class="sis-vista">${html}</div>`;
    st.mensaje = null;
    if (st.vista === 'hoja' && st.paso === 'area') mapaArea();
    if (st.vista === 'hoja' && st.paso === 'vuelo') mapaVuelo();
    if (st.vista === 'kml') mapaKml();
  }

  // ─────────── Archivos ───────────
  function usarPoligono(p, archivo) {
    const a = st.hoja.area;
    Object.assign(a, { tipo: 'poligono', original: { nombre: p.nombre, anillo: limpiarAnillo(p.coords || p.anillo) }, eje: null, archivo, cortes: [], sectores: [], sel: 0, problemas: p.problemas || [] });
    if (!st.hoja.nombre) st.hoja.nombre = p.nombre;
    st.candidatos = null; st.dibujo = null;
    if (p.area > 2000 * 10000) avisar(`El polígono tiene ${fmt(p.area / 10000, 0)} ha: revisa que sea el área de vuelo.`, 'error');
    cambio();
  }
  function usarEje(e, archivo) {
    const a = st.hoja.area;
    Object.assign(a, { tipo: 'corredor', eje: { nombre: e.nombre, linea: e.linea, largo: e.largo }, original: null, archivo, cortes: [], sectores: [], sel: 0, problemas: e.problemas || [] });
    if (!st.hoja.nombre) st.hoja.nombre = e.nombre;
    st.candidatos = null; st.dibujo = null;
    cambio();
  }

  async function alCargarArchivo(t) {
    const archivo = t.files[0];
    const tipo = t.dataset.archivo;
    if (tipo === 'captura') {
      const h = st.hoja;
      if (!h.id) await guardarAhora();
      const reg = await guardarArchivo(archivo, { modulo: 'vuelos', duenoTipo: 'vuelos_hoja', duenoId: h.id, rol: 'documento', proyectoId: h.proyectoId, carpeta: `Vuelos/${nombreArchivoSeguro(h.nombre)}/Consultas` }, { personaId: ctx.personaId });
      h.permisos.consultas.push({ id: reg.id, tipo: t.dataset.tipo, fecha: new Date().toISOString(), personaId: ctx.personaId, archivoId: reg.id });
      avisar('Captura guardada'); cambio(); return;
    }
    if (tipo === 'capa') {
      const sel = raiz.querySelector('select[data-campo="tipoCapa"]');
      const n = await cargarCapaDesdeArchivo(archivo, sel ? sel.value : 'referencia');
      st.capas = await listarCapas();
      avisar(`Capa cargada: ${n} elemento${n === 1 ? '' : 's'}.`); return;
    }
    const analisis = analizarKml(await leerArchivo(archivo), archivo.name);
    if (tipo === 'kml') { st.kml = analisis; st.kmlError = ''; return; }
    const contornos = analisis.poligonos.filter(p => !p.abierta);
    if (!contornos.length && !analisis.ejes.length) throw new Error('El archivo no trae polígonos ni líneas.');
    if (contornos.length === 1 && !analisis.ejes.length) usarPoligono(contornos[0], archivo.name);
    else st.candidatos = { ...analisis, archivo: archivo.name };
  }

  // ─────────── Eventos ───────────
  const num = v => String(v).replace(',', '.').trim();

  function leerPlan(objetivo) {
    const P = st.hoja.params, d = dron();
    const nombre = objetivo.name || objetivo.dataset.espejo;
    const valor = num(objetivo.value);
    if (['reserva', 'minDespegue', 'minCambio', 'segGiro', 'exposicion'].includes(nombre)) P[nombre] = valor;
    else if (nombre === 'gsd' && Number(valor) > 0) { P.porGsd = true; P.gsd = valor; ponerValor('altura', Math.round(alturaParaGsd(d, Number(valor)))); }
    else if (nombre === 'altura' && Number(valor) > 0) { P.porGsd = false; P.altura = valor; ponerValor('gsd', Math.round(gsdCm(d, Number(valor)) * 100) / 100); }
    else if (nombre === 'velocidad' && Number(valor) > 0) { P.velocidad = valor; const nota = raiz.querySelector('label[for="vu-velocidad"] small'); if (nota) nota.remove(); }
    else if (['traslapeFrontal', 'traslapeLateral'].includes(nombre)) P[nombre] = valor;
    else return false;
    if (objetivo.dataset.espejo) ponerValor(nombre, valor);
    else if (objetivo.type === 'range') { const e = raiz.querySelector(`input[data-espejo="${nombre}"]`); if (e) e.value = valor; }
    return true;
  }

  function leerArea(objetivo) {
    const a = st.hoja.area;
    const nombre = objetivo.name || objetivo.dataset.espejo;
    if (!['margen', 'izq', 'der'].includes(nombre)) return false;
    const v = Number(num(objetivo.value));
    if (!(v >= 0)) return false;
    if (nombre === 'margen') a.margen = Math.min(500, v);
    else if (nombre === 'izq') a.corredor.izq = Math.max(1, v);
    else a.corredor.der = Math.max(1, v);
    if (objetivo.dataset.espejo) ponerValor(nombre, v);
    else { const e = raiz.querySelector(`input[data-espejo="${nombre}"]`); if (e) e.value = v; }
    return true;
  }

  raiz.addEventListener('input', ev => {
    const t = ev.target;
    if (st.vista === 'hoja' && st.hoja) {
      if (t.closest('form[data-form="plan"]') && t.tagName !== 'SELECT' && t.type !== 'radio') { if (leerPlan(t)) { cambio(); refrescarVuelo(); } return; }
      if (st.paso === 'area' && (t.name || t.dataset.espejo) && leerArea(t)) { cambio(); refrescarArea(); return; }
      if (t.dataset.hoja && t.tagName === 'INPUT' && t.type !== 'date') { st.hoja[t.dataset.hoja] = t.value; cambio(); return; }
      if (t.dataset.sectorNombre != null) { metaSector(st.hoja, Number(t.dataset.sectorNombre)).nombre = t.value.trim(); cambio(); if (mapas.area) pintarArea(mapas.area); return; }
      if (t.dataset.dgac === 'numero') { st.hoja.permisos.dgac.numero = t.value; cambio(); return; }
    }
    if (t.dataset.vel) {
      const v = Number(num(t.value));
      if (v > 0) {
        st[t.dataset.vel] = v;
        const det = raiz.querySelector('.vu-opciones'), g = geo();
        if (det && g) { const r = calcularSector(st.hoja, dron(), g, secSel()); const n = document.createElement('div'); n.innerHTML = htmlTablaGsd(r); const sel = t.dataset.vel; det.replaceWith(n.firstElementChild); const i = raiz.querySelector(`input[data-vel="${sel}"]`); if (i) i.focus(); }
      }
      return;
    }
    if (t.dataset.campo === 'maxVertices') st.maxVertices = Math.max(4, Number(t.value) || 200);
  });

  raiz.addEventListener('change', async ev => {
    const t = ev.target;
    try {
      if (t.dataset.archivo && t.files && t.files[0]) { await alCargarArchivo(t); t.value = ''; await render(); return; }
      if (t.dataset.campo === 'filtroProyecto') { st.filtroProyecto = t.value; await render(); return; }
      if (t.name === 'rapDron') { st.rapDron = t.value; return; }
      if (!st.hoja || st.vista !== 'hoja') return;
      const h = st.hoja;
      if (t.dataset.hoja && (t.tagName === 'SELECT' || t.type === 'date')) { h[t.dataset.hoja] = t.value || null; if (t.dataset.hoja === 'fecha') st.dia = null; cambio(); await render(); return; }
      if (t.name === 'familia') { const alt = alturaDe(h.params, dron()); const x = drones.find(d => (d.familia || d.id) === t.value); if (x) h.dronId = x.id; if (!h.params.porGsd) h.params.altura = String(Math.round(alt)); if (Number(h.params.velocidad) > dron().velocidadMaxMs) h.params.velocidad = ''; cambio(); await render(); return; }
      if (t.name === 'dronId') { h.dronId = t.value; cambio(); await render(); return; }
      if (t.name === 'modo') { h.params.modo = t.value; if (t.value === 'lidar' && Number(h.params.traslapeLateral) > 60) h.params.traslapeLateral = '50'; if (t.value === 'foto' && Number(h.params.traslapeLateral) < 60) h.params.traslapeLateral = '70'; cambio(); await render(); return; }
      if (t.dataset.area === 'rectas') { h.area.rectas = t.checked; cambio(); refrescarArea(); return; }
      if (t.dataset.area === 'mismo') { h.area.corredor.mismo = t.checked; if (!t.checked) h.area.corredor.der = h.area.corredor.izq; cambio(); await render(); return; }
      if (t.dataset.capa) { const todas = capasActivas(); st.capasActivas = t.checked ? [...new Set([...todas, t.dataset.capa])] : todas.filter(x => x !== t.dataset.capa); escribirLS('vu_capas_activas', st.capasActivas); refrescarArea(); return; }
      if (t.dataset.dgac && t.dataset.dgac !== 'numero') { h.permisos.dgac[t.dataset.dgac] = t.value; cambio(); await render(); return; }
      if (t.dataset.doc) { h.permisos.docs[t.dataset.doc] = t.checked; cambio(); return; }
    } catch (e) { console.error(e); avisar(e.message || 'No se pudo completar', 'error'); await render(); }
  });

  raiz.addEventListener('submit', async ev => {
    ev.preventDefault();
    const form = ev.target;
    const fd = new FormData(form);
    try {
      if (form.dataset.form === 'plan') return;
      if (form.dataset.form === 'viento') {
        const ms = Number(num(fd.get('ms')));
        if (!(ms >= 0)) throw new Error('Escribe el viento en m/s.');
        st.hoja.viento.push({ hora: String(fd.get('hora') || '').trim(), ms, nota: String(fd.get('nota') || '').trim() });
        cambio();
      } else if (form.dataset.form === 'rapido') {
        st.rapLat = num(fd.get('lat')); st.rapLon = num(fd.get('lon')); st.rapDron = fd.get('rapDron') || st.rapDron; st.rapOrigen = 'Coordenadas escritas';
        const lat = Number(st.rapLat), lon = Number(st.rapLon);
        if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (!lat && !lon)) throw new Error('Revisa la latitud y la longitud (grados decimales, por ejemplo -32.83 y -70.60).');
        await consultarClima(lat, lon);
      } else if (form.dataset.form === 'dron') {
        const n = k => Number(num(fd.get(k)));
        const valores = Object.fromEntries(CAMPOS_DRON.map(([k]) => [k, n(k)]));
        if (fd.has('lidarPps')) valores.lidar = { puntosPorSegundo: n('lidarPps'), fovGrados: n('lidarFov') };
        if (Object.values(valores).some(v => typeof v === 'number' && !(v > 0))) throw new Error('Todos los valores deben ser números mayores que 0.');
        await guardarDron(form.dataset.id, valores);
        avisar('Datos del dron guardados');
      }
    } catch (e) { console.error(e); avisar(e.message, 'error'); }
    await render();
  });

  function descargarPoligono(nombre, anillo) {
    const limpio = limpiarParaDji({ nombre, coords: anillo, vertices: anillo.length }, { maxVertices: st.maxVertices });
    descargar(`${nombreArchivoSeguro(nombre)}.kml`, kmlDePoligono(nombre, limpio.anillo), TIPO_KML);
  }
  function descargarKmlSector(i) {
    const h = st.hoja, g = geo();
    const nombre = g.sectores.length > 1 ? `${h.nombre || 'area'} ${nombreSector(h, i, g.sectores.length)}` : (h.nombre || 'area');
    descargarPoligono(nombre, g.sectores[i].poligono.map(g.marco.aLonLat));
  }

  raiz.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-accion]');
    if (!b) return;
    const a = b.dataset.accion;
    if (a === 'volver-lista') ev.preventDefault();
    const h = st.hoja;
    try {
      if (a === 'vista') { if (st.hoja) await guardarAhora(); st.vista = b.dataset.vista; st.pron = null; st.metar = null; st.pronError = ''; if (st.vista === 'hojas') st.hoja = null; }
      else if (a === 'volver-lista') { await guardarAhora(); st.vista = 'hojas'; st.hoja = null; try { history.replaceState(null, '', '#/vuelos'); } catch { /* */ } }
      else if (a === 'nueva-hoja') { await abrirHoja(null); }
      else if (a === 'abrir-hoja') { await abrirHoja(b.dataset.id); try { history.replaceState(null, '', `#/vuelos/plan/${b.dataset.id}`); } catch { /* */ } }
      else if (a === 'eliminar-hoja') { if (!confirm('¿Eliminar esta hoja de vuelo? Queda en la papelera.')) return; await eliminarPlan(b.dataset.id); avisar('Hoja eliminada'); }
      else if (a === 'paso') { st.paso = b.dataset.paso; st.dibujo = null; await guardarAhora(); }
      else if (a === 'estado') { h.estado = b.dataset.e; cambio(); await guardarAhora(); }
      else if (a === 'imprimir') { await guardarAhora(); imprimir(); return; }
      else if (a === 'dia') { st.dia = b.dataset.dia; if (st.vista === 'hoja') guardarResumenClima(); }
      else if (a === 'consultar-hoja') { const g = geo(); const [lon, lat] = g.marco.aLonLat([0, 0]); await consultarClima(lat, lon); guardarResumenClima(); }
      else if (a === 'gps') {
        if (!navigator.geolocation) throw new Error('Este navegador no entrega la ubicación.');
        const pos = await new Promise((ok, mal) => navigator.geolocation.getCurrentPosition(ok, mal, { enableHighAccuracy: false, timeout: 15000 }));
        st.rapLat = pos.coords.latitude.toFixed(5); st.rapLon = pos.coords.longitude.toFixed(5); st.rapOrigen = 'Tu ubicación actual';
        await consultarClima(pos.coords.latitude, pos.coords.longitude);
      }
      // Área
      else if (a === 'dibujar') {
        const modo = b.dataset.modo;
        st.dibujo = st.dibujo && st.dibujo.modo === modo ? null : { modo, puntos: [] };
        st.paso = 'area';
        if (st.dibujo && modo === 'corte') avisar('Traza el corte: toca afuera del área, sigue el camino y termina afuera. Luego «Terminar».');
      }
      else if (a === 'dibujo-deshacer') { st.dibujo.puntos.pop(); const bb = raiz.querySelector('#vu-barra-area'); if (bb) bb.innerHTML = barraDibujo(); if (mapas.area) pintarDibujo(mapas.area); return; }
      else if (a === 'dibujo-cancelar') { st.dibujo = null; }
      else if (a === 'dibujo-terminar') {
        const { modo, puntos } = st.dibujo;
        if (modo === 'area') {
          const coords = limpiarAnillo(puntos); const { puntos: xy } = proyectar(coords);
          usarPoligono({ nombre: 'Área dibujada', coords, area: areaM2(xy), problemas: [] }, 'dibujada en el mapa');
          if (autoInterseccion(xy)) avisar('El contorno dibujado se cruza consigo mismo: dibújalo de nuevo siguiendo el borde.', 'error');
        } else if (modo === 'eje') {
          const { puntos: xy } = proyectar(puntos); let L = 0; for (let k = 1; k < xy.length; k++) L += Math.hypot(xy[k][0] - xy[k - 1][0], xy[k][1] - xy[k - 1][1]);
          usarEje({ nombre: 'Eje dibujado', linea: puntos, largo: L }, 'dibujado en el mapa');
        } else {
          h.area.cortes.push(puntos); const g = geometria(h);
          if (g.fallidos.length) avisar('El corte no atraviesa el área de lado a lado: empieza y termina afuera del área.', 'error'); else avisar(`Listo: ${g.sectores.length} sectores. Ponles nombre si quieres.`);
          cambio();
        }
        st.dibujo = null;
      }
      else if (a === 'deshacer-corte') { h.area.cortes.pop(); cambio(); }
      else if (a === 'quitar-cortes') { h.area.cortes = []; h.area.sel = 0; cambio(); }
      else if (a === 'margen') { h.area.margen = Number(b.dataset.m); cambio(); }
      else if (a === 'invertir') { h.area.corredor.invertir = !h.area.corredor.invertir; cambio(); }
      else if (a === 'usar-eje') usarEje(st.candidatos.ejes[Number(b.dataset.i)], st.candidatos.archivo);
      else if (a === 'usar-pol') usarPoligono(st.candidatos.poligonos[Number(b.dataset.i)], st.candidatos.archivo);
      else if (a === 'cerrar-candidatos') st.candidatos = null;
      else if (a === 'quitar-capa') { await quitarCapa(b.dataset.id); st.capas = await listarCapas(); }
      else if (a === 'kml-original') {
        if (h.area.tipo === 'corredor') { const e = limpiarEje({ ...h.area.eje, vertices: h.area.eje.linea.length }, { maxVertices: st.maxVertices }); descargar(`${nombreArchivoSeguro(h.area.eje.nombre)}_eje.kml`, kmlDeLinea(h.area.eje.nombre, e.linea), TIPO_KML); }
        else descargarPoligono(h.area.original.nombre, h.area.original.anillo);
        avisar('KML descargado');
      }
      else if (a === 'kml-vuelo') { const g = geo(); descargarPoligono(h.nombre || 'zona de vuelo', g.vuelo.map(g.marco.aLonLat)); avisar('KML de la zona descargado'); }
      else if (a === 'kml-sector') { descargarKmlSector(Number(b.dataset.i)); avisar('KML descargado'); }
      else if (a === 'kml-sectores') { const g = geo(); for (let k = 0; k < g.sectores.length; k++) { descargarKmlSector(k); await new Promise(r => setTimeout(r, 400)); } avisar(`${g.sectores.length} KML descargados`); }
      else if (a === 'kml-eje-sector') {
        const g = geo(), i = Number(b.dataset.i), linea = g.sectores[i].eje.map(g.marco.aLonLat);
        const nombre = `${h.nombre || 'eje'}${g.sectores.length > 1 ? ' ' + nombreSector(h, i, g.sectores.length) : ''}`;
        descargar(`${nombreArchivoSeguro(nombre)}_eje.kml`, kmlDeLinea(nombre, limpiarEje({ linea, vertices: linea.length }, { maxVertices: st.maxVertices }).linea), TIPO_KML);
        avisar('Eje descargado');
      }
      else if (a === 'ir-sector') { h.area.sel = Number(b.dataset.i); st.paso = 'vuelo'; st.dibujo = null; cambio(); }
      // Vuelo
      else if (a === 'rumbo' || a === 'rumbo-auto' || a === 'rumbo-corto') {
        const g = geo(), i = secSel(), meta = metaSector(h, i), r = calcularSector(h, dron(), g, i);
        if (!r || r.corredor) return;
        if (a === 'rumbo') meta.rumbo = String((((Math.round(r.rumbo) + Number(b.dataset.d)) % 180) + 180) % 180);
        else if (a === 'rumbo-auto') meta.rumbo = '';
        else {
          let mejor = 0, minimo = Infinity;
          const prueba = rr => calcularSector(h, dron(), g, i, { rumbo: rr, velocidad: r.velocidad }).minTotal;
          for (let rr = 0; rr < 180; rr += 5) { const m = prueba(rr); if (m < minimo - 1e-6) { minimo = m; mejor = rr; } }
          for (let rr = mejor - 4; rr <= mejor + 4; rr++) { const x = (rr + 180) % 180; const m = prueba(x); if (m < minimo - 1e-6) { minimo = m; mejor = x; } }
          meta.rumbo = String(mejor);
          avisar(`Rumbo ${mejor}°: el que da menos tiempo con este despegue (${fmtDuracion(minimo)} de jornada).`);
          cambio(); await render(); return;
        }
        cambio(); refrescarVuelo(); return;
      }
      else if (a === 'vel-auto') { h.params.velocidad = ''; cambio(); refrescarVuelo(); return; }
      else if (a === 'leyenda') { st.leyendaAbierta = !st.leyendaAbierta; poner('vu-leyenda', htmlLeyenda(calcularSector(h, dron(), geo(), secSel()))); return; }
      else if (a === 'usar-gsd') { const g = Number(b.dataset.g); h.params.porGsd = true; h.params.gsd = String(g); ponerValor('gsd', g); ponerValor('altura', Math.round(alturaParaGsd(dron(), g))); cambio(); refrescarVuelo(); return; }
      else if (a === 'agregar-gsd') { const i = raiz.querySelector('input[data-campo="gsdNuevo"]'); const g = Math.round(Number(num(i && i.value)) * 100) / 100; if (!(g > 0.2 && g < 20)) { if (i) i.focus(); return; } if (!st.gsdExtra.includes(g)) st.gsdExtra.push(g); refrescarVuelo(); return; }
      else if (a === 'quitar-gsd') { const g = Number(b.dataset.g); st.gsdExtra = st.gsdExtra.filter(x => x !== g); refrescarVuelo(); return; }
      else if (a === 'copiar-tabla' || a === 'excel-tabla') {
        const g = geo(), i = secSel(), r = calcularSector(h, dron(), g, i);
        const filas = opcionesGsd(r);
        const tabla = [['GSD (cm/px)', 'Altura (m)', `Tiempo a ${fmt(st.velA, 1)} m/s`, 'Baterías', `Tiempo a ${fmt(st.velB, 1)} m/s`, 'Baterías'],
          ...filas.map(f => [fmt(f.gsd, 2), fmt(f.altura, 0) + (f.sobre120 ? ' *' : ''), fmtDuracion(f.a.minMision), String(f.a.vuelos), fmtDuracion(f.z.minMision), String(f.z.vuelos)])];
        const titulo = `${h.nombre || 'Área'}${g.sectores.length > 1 ? ' · ' + nombreSector(h, i, g.sectores.length) : ''} · ${fmt(r.area / 10000, 2)} ha · ${dron().nombre} · traslape ${h.params.traslapeFrontal}/${h.params.traslapeLateral} %`;
        if (a === 'copiar-tabla') {
          const anchos = tabla[0].map((_, c) => Math.max(...tabla.map(f => f[c].length)));
          await navigator.clipboard.writeText([titulo, '', ...tabla.map(f => f.map((v, c) => c === 0 ? v.padEnd(anchos[c]) : v.padStart(anchos[c])).join('   ')), '', 'Tiempo de vuelo estimado; no incluye traslados al lugar ni armado del equipo.' + (tabla.some(f => f[1].endsWith('*')) ? ' * Sobre 120 m requiere autorización DGAC.' : '')].join('\n'));
          avisar('Tabla copiada: pégala en el correo.');
        } else {
          if (!globalThis.XLSX) await cargarScript('vendor/xlsx.full.min.js');
          const ws = XLSX.utils.aoa_to_sheet([[titulo], [], ...tabla]);
          ws['!cols'] = [14, 12, 16, 10, 16, 10].map(w => ({ wch: w }));
          const libro = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(libro, ws, 'Opciones GSD');
          XLSX.writeFile(libro, `Opciones_GSD_${nombreArchivoSeguro(h.nombre || 'area')}.xlsx`);
          avisar('Excel descargado.');
        }
      }
      // Clima y permisos
      else if (a === 'quitar-viento') { h.viento.splice(Number(b.dataset.k), 1); cambio(); }
      else if (a === 'consulta') { h.permisos.consultas.push({ id: globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), tipo: b.dataset.tipo, fecha: new Date().toISOString(), personaId: ctx.personaId }); avisar('Consulta registrada'); cambio(); }
      else if (a === 'ver-captura') { await abrirArchivo(b.dataset.id); return; }
      // Herramientas
      else if (a === 'kml-limpio') { const p = st.kml.poligonos[Number(b.dataset.i)]; const limpio = limpiarParaDji(p, { maxVertices: st.maxVertices }); descargar(`${nombreArchivoSeguro(p.nombre)}.kml`, kmlDePoligono(p.nombre, limpio.anillo), TIPO_KML); avisar(limpio.verticesOriginales > limpio.vertices ? `Descargado: ${limpio.verticesOriginales} → ${limpio.vertices} vértices.` : `Descargado con ${limpio.vertices} vértices.`); if (p.cruces) avisar('Descargado, pero el contorno se cruza consigo mismo: corrígelo antes de usarlo.', 'error'); }
      else if (a === 'eje-limpio') { const e = limpiarEje(st.kml.ejes[Number(b.dataset.i)], { maxVertices: st.maxVertices }); descargar(`${nombreArchivoSeguro(e.nombre)}.kml`, kmlDeLinea(e.nombre, e.linea), TIPO_KML); avisar(`Línea descargada con ${e.vertices} vértices.`); }
      else if (a === 'kml-a-hoja') { const p = st.kml.poligonos[Number(b.dataset.i)], arch = st.kml.archivo; await abrirHoja(null); usarPoligono(p, arch); st.paso = 'area'; }
      else if (a === 'eje-a-hoja') { const e = st.kml.ejes[Number(b.dataset.i)], arch = st.kml.archivo; await abrirHoja(null); usarEje(e, arch); st.paso = 'area'; }
      else if (a === 'restablecer-dron') { await restablecerDron(b.dataset.id); avisar('Valores de fábrica restablecidos'); }
      else return;
    } catch (e) { console.error(e); avisar(e.message || 'No se pudo completar', 'error'); }
    await render();
  });

  (async () => {
    if (ctx.planId) await abrirHoja(ctx.planId);
    else if (ctx.proyectoId) await abrirHoja(null);
    await render();
  })();

  return {
    desmontar() { activo = false; guardarAhora(); for (const m of Object.values(mapas)) m.mapa.remove(); raiz.remove(); },
    refrescar() { if (st.vista === 'hojas' || st.vista === 'drones') render(); },
  };
}
