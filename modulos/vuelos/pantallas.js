// modulos/vuelos/pantallas.js — núcleo de las pantallas de Vuelos: estado, guardado, render y eventos.
// Las vistas viven en archivos por paso: vista-hojas.js (lista, encabezado, Resumen), paso-area.js, paso-vuelo.js,
// paso-clima.js (y Pronóstico rápido), paso-permisos.js (y la hoja para terreno), herramientas.js (KML, Drones), mapas.js.
// Cada uno es una fábrica crearX(v) que recibe el contexto compartido v (estado st, listas base y funciones del núcleo).

import { escapar as esc, descargar, cargarScript } from '../../compartido/util.js';
import { listarProyectos, listarPersonas, OFICINA_ID } from '../../compartido/catalogos.js';
import { guardarArchivo, abrirArchivo } from '../../compartido/archivos.js';
import { fijarPersona, listarDrones, guardarDron, restablecerDron, listarPlanes, obtenerPlan, guardarPlan, eliminarPlan } from './datos.js';
import { CAMPOS_DRON } from './drones.js';
import { alturaParaGsd, gsdCm, fmt, fmtDuracion, proyectar, areaM2 } from './calculo.js';
import { leerArchivo, analizarKml, limpiarParaDji, kmlDePoligono, kmlDeLinea, limpiarEje, nombreArchivoSeguro, limpiarAnillo, autoInterseccion } from './kml.js';
import { listarCapas, cargarCapaDesdeArchivo, quitarCapa } from './capas.js';
import { HORARIO_INICIAL, jornadasNecesarias } from './hoja.js';
import { nuevaHoja, migrarHoja, geometria, metaSector, nombreSector, calcularSector, alturaDe, resumenHoja, rumboMasCorto, dmAKm, kmADm, totales } from './hoja.js';
import * as Seguimiento from '../seguimiento/seguimiento.js';
import { diasHabilesDesde } from '../../compartido/periodicidad.js';
import { formaDe, metodoPropuesto, generarCortes, corredorDesdeEje, rumboCortesPropuesto } from './cortes.js';
import { caminosEn, caminosDeHoja, recuadro, despegueSobreCamino } from './redvial.js';
import { TIPO_KML } from './ui.js';
import { crearVistaHojas } from './vista-hojas.js';
import { crearPasoArea } from './paso-area.js';
import { crearPasoVuelo } from './paso-vuelo.js';
import { crearPasoClima } from './paso-clima.js';
import { crearPasoPermisos } from './paso-permisos.js';
import { crearHerramientas } from './herramientas.js';
import { crearMapas } from './mapas.js';
import { ubicacionDe } from './ubicacion.js';

const HERRAMIENTAS = [['hojas', 'Hojas de vuelo'], ['rapido', 'Pronóstico rápido'], ['kml', 'Limpiar KML'], ['drones', 'Drones']];

const leerLS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const escribirLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

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
    dibujo: null, // { modo: 'area'|'eje'|'corte'|'camino'|'dmfijo', puntos: [] }
    leyendaAbierta: false, velA: 5, velB: 10, gsdExtra: [],
    pron: null, pronError: '', pronCargando: false, kps: null, dia: null,
    metar: null, metarError: '',
    rapLat: '', rapLon: '', rapOrigen: '', rapDron: 'm4e',
    kml: null, kmlError: '', maxVertices: 200,
    capas: null, capasActivas: leerLS('vu_capas_activas', null), redVial: leerLS('vu_red_vial', false), redVialInfo: '', sugDesp: null,
    mensaje: null, filtroProyecto: ctx.proyectoId || '',
  };
  const base = { drones: [], proyectos: [], personas: [], hojas: [] };
  const mapas = {};

  const avisar = (texto, tipo = 'ok') => { st.mensaje = { texto, tipo }; };
  const dron = () => base.drones.find(d => d.id === (st.hoja && st.hoja.dronId)) || base.drones[0];
  const familias = () => [...new Map(base.drones.map(d => [d.familia || d.id, d.familiaNombre || d.nombre])).entries()];
  const geo = () => (st.hoja ? geometria(st.hoja) : null);
  const nomProy = id => !id ? 'Sin proyecto' : id === OFICINA_ID ? 'Oficina' : ((base.proyectos.find(p => p.id === id) || {}).nombre || 'Proyecto');
  const nomPers = id => (base.personas.find(p => p.id === id) || {}).nombre || '';
  const secSel = () => { const g = geo(); return g ? Math.max(0, Math.min(st.hoja.area.sel || 0, g.sectores.length - 1)) : 0; };
  const capasActivas = () => st.capasActivas || (st.capas || []).map(c => c.id);

  async function cargarBase() {
    [base.drones, base.proyectos, base.personas, base.hojas] = await Promise.all([listarDrones(), listarProyectos(), listarPersonas(), listarPlanes()]);
    base.hojas = base.hojas.map(migrarHoja);
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
    st.paso = p ? 'resumen' : 'identificacion';
    st.pron = null; st.metar = null; st.metarError = ''; st.dia = null; st.candidatos = null; st.dibujo = null; st.gsdExtra = [];
    st.tramos = null; st.ubicError = ''; st.previas = null; st.pronError = '';
    st.vista = 'hoja';
    for (const m of Object.values(mapas)) m.encuadre = null;
  }

  // ─────────── Contexto compartido y vistas por paso ───────────
  const v = { st, base, ctx, raiz, mapas, geo, dron, familias, nomProy, nomPers, secSel, capasActivas, avisar, cambio, render, guardarAhora, refrescarArea, refrescarVuelo };
  Object.assign(v, crearVistaHojas(v), crearPasoArea(v), crearPasoVuelo(v), crearPasoClima(v), crearPasoPermisos(v), crearHerramientas(v), crearMapas(v));
  const {
    vistaHojas, encabezadoHoja, vistaResumen, vistaIdentificacion, pieDePaso, vistaArea, textoCorredor, htmlSectores, htmlZonas, barraDibujo, htmlVistaPrevia,
    vistaVuelo, htmlLados, htmlTotalHoja, pieVelocidad, htmlKpis, htmlBarraRumbo, htmlLeyenda, htmlDetalle, opcionesGsd, htmlTablaGsd,
    vistaClima, vistaRapido, consultarClima, consultarTramos, guardarResumenClima, vistaPermisos, imprimir, vistaKml, vistaDrones,
    mapaArea, mapaVuelo, mapaKml, pintarArea, pintarVuelo, pintarDibujo,
  } = v;

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
    if (r && !r.corredor) poner('vu-lados', htmlLados(r));
    if (r && st.hoja.params.velocidad === '') ponerValor('velocidad', Math.round(r.velocidad * 10) / 10);
    const rr = raiz.querySelector('#vu-rumbo-rango');
    if (r && rr && document.activeElement !== rr) { rr.value = Math.round(((r.rumbo % 180) + 180) % 180); const num = raiz.querySelector('#vu-rumbo-num'); if (num) num.textContent = `${fmt(r.rumbo, 0)}°`; }
    if (mapas.vuelo && mapas.vuelo.el.isConnected) pintarVuelo(mapas.vuelo);
  }
  async function buscarDespegue(h, todos) {
    const g = geo(); if (!g) return;
    const lista = todos ? g.sectores.map((_, k) => k) : [secSel()];
    st.sugDesp = { hojaId: h.id || 'nueva', cargando: true, lista: [] };
    poner('vu-desp-sug', '<p class="sis-tenue">Buscando en los caminos cercanos…</p>');
    let mop = [];
    try { mop = await caminosEn(recuadro(lista.flatMap(k => g.sectores[k].poligono.map(g.marco.aLonLat)), 2)); }
    catch { avisar('No se pudo leer la red vial del MOP: se usan solo los caminos agregados en la hoja.', 'error'); }
    const caminos = [...caminosDeHoja(h), ...mop];
    st.sugDesp = { hojaId: h.id || 'nueva', lista: lista.map(i => ({ i, res: caminos.length ? despegueSobreCamino(h, dron(), g, i, caminos) : null })) };
    const n = st.sugDesp.lista.filter(x => x.res).length;
    if (!n) avisar('No hay caminos a menos de 1,5 km. Dibuja uno en Área → Caminos.', 'error');
    else if (!st.mensaje || st.mensaje.tipo !== 'error') avisar(`Despegue sugerido para ${n} sector${n === 1 ? '' : 'es'}: revisa y toca «Usar».`);
  }

  /** Clima de la hoja: al entrar al paso ya consulta hoy y los próximos 10 días (y los tramos si el área es larga). */
  let consultandoClima = false;
  async function consultarHojaAuto(forzar = false) {
    const g = geo();
    if (!g || consultandoClima || (!forzar && (st.pron || st.pronError))) return;
    consultandoClima = true;
    try {
      const [lon, lat] = g.marco.aLonLat([0, 0]);
      await consultarClima(lat, lon);
      if (st.pron) { guardarResumenClima(); consultarTramos(); }
    } finally { consultandoClima = false; }
    if (activo) render();
  }
  v.consultarHojaAuto = consultarHojaAuto;

  /** Comuna y región del centro del área (v0.11). forzar: vuelve a consultar aunque ya haya una. */
  async function detectarUbicacion(forzar = false) {
    const h = st.hoja, g = geo();
    if (!h || !g || st.ubicando) return;
    if (!forzar && h.ubicacion && (h.ubicacion.comuna || h.ubicacion.region)) return;
    const [lon, lat] = g.marco.aLonLat([0, 0]);
    st.ubicando = true; st.ubicError = '';
    try {
      const u = await ubicacionDe(lat, lon);
      if (st.hoja === h) { h.ubicacion = { ...u, auto: true }; cambio(); }
    } catch { st.ubicError = 'No se pudo detectar la ubicación (sin conexión). Escríbela a mano.'; }
    st.ubicando = false;
    if (activo && st.vista === 'hoja' && st.hoja === h) render();
  }
  v.detectarUbicacion = detectarUbicacion;

  /** Agrega un corte fijo (texto DM o km) a «Cortes a medida». Devuelve false si no se entendió. */
  function agregarFijo(texto) {
    const h = st.hoja, km = dmAKm(String(texto || '').trim());
    if (km == null) { avisar('Escribe el DM del corte, por ejemplo 4+900.', 'error'); render(); return false; }
    const au = h.area.auto = h.area.auto || {};
    au.modo = 'medida';
    const lista = new Map((au.fijos || []).map(f => [Math.round(dmAKm(f) * 1000), f]));
    lista.set(Math.round(km * 1000), kmADm(km));
    const sube = !(h.area.dm && h.area.dm.desc);
    au.fijos = [...lista.entries()].sort((x, y) => (sube ? x[0] - y[0] : y[0] - x[0])).map(e => e[1]);
    cambio();
    return true;
  }
  v.agregarFijo = agregarFijo;

  async function cortarAutomatico(h) {
    const a = h.area;
    a.auto = a.auto || {};
    if (a.auto.modo === 'inicio') { a.auto.modo = 'distancia'; a.auto.unidad = 'm'; } // hojas de la v0.7
    const forma = formaDe(h);
    if (!a.auto.modo) a.auto.modo = metodoPropuesto(forma);
    const extra = { dron: dron(), primerDM: a.auto.primerKm ?? null };
    if (a.auto.modo === 'medida' && (!a.dm || a.dm.inicio == null)) { a.dm = { ...(a.dm || {}), texto: '0+000', inicio: 0 }; } // el DM cuenta desde 0+000
    if (a.auto.modo === 'tramos') {
      if (!h.proyectoId) { avisar('La hoja no tiene proyecto: elígelo en el encabezado para usar sus tramos.', 'error'); return; }
      const t = await Seguimiento.tramosDeProyecto(h.proyectoId);
      if (!t) { avisar('El proyecto no tiene seguimiento con tramos.', 'error'); return; }
      extra.tramosKm = [];
      for (const ar of t.areas) for (const x of ar.tramos) { if (x.ini != null) extra.tramosKm.push(x.ini); if (x.fin != null) extra.tramosKm.push(x.fin); }
      if (!extra.tramosKm.length) { avisar('Los tramos del seguimiento no tienen DM (como 45+200) en su nombre.', 'error'); return; }
    }
    let r;
    try { r = generarCortes(h, extra); } catch (e) { avisar(e.message, 'error'); return; }
    a.cortes = r.cortes; a.sectores = []; a.sel = 0;
    cambio();
    const g = geometria(h);
    if (!r.cortes.length) { avisar(r.nota || 'No hizo falta cortar.'); return; }
    const t = totales(h, dron(), g);
    avisar(`Listo: ${g.sectores.length} sectores${t ? ` · ${t.baterias} baterías · ${fmtDuracion(t.minJornada)} de jornada` : ''}${g.fallidos.length ? ` · ${g.fallidos.length} corte${g.fallidos.length > 1 ? 's' : ''} no cruzó el área (arrástralo o quítalo)` : ''}.${r.nota ? ' ' + r.nota : ''}`, g.fallidos.length ? 'error' : 'ok');
  }

  function refrescarArea() {
    const g = geo();
    poner('vu-sectores', htmlSectores()); poner('vu-zonas', htmlZonas()); poner('vu-vista-previa', htmlVistaPrevia());
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
      const vistas = { resumen: vistaResumen, identificacion: vistaIdentificacion, area: vistaArea, vuelo: vistaVuelo, clima: vistaClima, permisos: vistaPermisos };
      html = encabezadoHoja() + `<div class="vu-paso-cuerpo">${(vistas[st.paso] || vistaResumen)()}</div>${pieDePaso()}`;
    } else {
      if (st.vista === 'hoja') st.vista = 'hojas';
      html = ({ hojas: vistaHojas, rapido: vistaRapido, kml: vistaKml, drones: vistaDrones })[st.vista]();
    }
    if (!activo) return;
    const herr = st.vista === 'hoja' ? 'hojas' : st.vista;
    // v0.11: las herramientas (Pronóstico rápido, Limpieza de KMZ, Catálogo de sensores) las monta el Sistema en su propia pestaña.
    raiz.innerHTML = `${ctx.conNav ? `<nav class="vu-nav" aria-label="Vuelos">${HERRAMIENTAS.map(([id, t]) => `<button class="vu-pestana${id === herr ? ' activa' : ''}" data-accion="vista" data-vista="${id}">${t}</button>`).join('')}</nav>` : ''}
      ${st.mensaje ? `<div class="vu-msg ${st.mensaje.tipo}">${esc(st.mensaje.texto)}</div>` : ''}
      <div class="sis-vista">${html}</div>`;
    st.mensaje = null;
    if (st.vista === 'hoja' && st.hoja && st.hoja.area.tipo && !st.hoja.ubicacion && !st.ubicError && !st.ubicando) detectarUbicacion();
    if (st.vista === 'hoja' && st.paso === 'area') mapaArea();
    if (st.vista === 'hoja' && st.paso === 'vuelo') mapaVuelo();
    if (st.vista === 'kml') mapaKml();
  }

  // ─────────── Archivos ───────────
  function usarPoligono(p, archivo) {
    const a = st.hoja.area;
    Object.assign(a, { tipo: 'poligono', original: { nombre: p.nombre, anillo: limpiarAnillo(p.coords || p.anillo) }, eje: null, ejeCalc: null, auto: {}, archivo, cortes: [], sectores: [], sel: 0, problemas: p.problemas || [] });
    st.subArea = 'forma';
    if (!st.hoja.nombre) st.hoja.nombre = p.nombre;
    st.candidatos = null; st.dibujo = null;
    if (p.area > 2000 * 10000) avisar(`El polígono tiene ${fmt(p.area / 10000, 0)} ha: revisa que sea el área de vuelo.`, 'error');
    cambio();
  }
  function usarEje(e, archivo) {
    const a = st.hoja.area;
    Object.assign(a, { tipo: 'corredor', eje: { nombre: e.nombre, linea: e.linea, largo: e.largo }, original: null, ejeCalc: null, auto: {}, archivo, cortes: [], sectores: [], sel: 0, problemas: e.problemas || [] });
    st.subArea = 'forma';
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
    if (tipo === 'docpermiso' || tipo === 'log') {
      const h = st.hoja;
      if (!h.id) await guardarAhora();
      const carpeta = `Vuelos/${nombreArchivoSeguro(h.nombre)}/${tipo === 'log' ? 'Logs' : 'Permisos'}`;
      if (tipo === 'log') {
        h.permisos.logs = h.permisos.logs || [];
        for (const f of t.files) {
          const reg = await guardarArchivo(f, { modulo: 'vuelos', duenoTipo: 'vuelos_hoja', duenoId: h.id, rol: 'log', proyectoId: h.proyectoId, carpeta }, { personaId: ctx.personaId });
          h.permisos.logs.push({ id: reg.id, nombre: f.name, fecha: new Date().toISOString(), personaId: ctx.personaId, archivoId: reg.id });
        }
        avisar(t.files.length > 1 ? `${t.files.length} logs cargados` : 'Log cargado'); cambio(); return;
      }
      const reg = await guardarArchivo(archivo, { modulo: 'vuelos', duenoTipo: 'vuelos_hoja', duenoId: h.id, rol: 'documento', proyectoId: h.proyectoId, carpeta }, { personaId: ctx.personaId });
      const est = h.permisos.docsEstado = h.permisos.docsEstado || {};
      est[t.dataset.k] = { ...(est[t.dataset.k] || {}), archivoId: reg.id, estado: 'adjunto' };
      avisar('Documento adjunto'); cambio(); return;
    }
    if (tipo === 'capa') {
      const sel = raiz.querySelector('select[data-campo="tipoCapa"]');
      const n = await cargarCapaDesdeArchivo(archivo, sel ? sel.value : 'referencia');
      st.capas = await listarCapas();
      avisar(`Capa cargada: ${n} elemento${n === 1 ? '' : 's'}.`); return;
    }
    const analisis = analizarKml(await leerArchivo(archivo), archivo.name);
    if (tipo === 'camino') {
      const lineas = analisis.ejes;
      if (!lineas.length) throw new Error('El archivo no trae líneas (caminos).');
      const h = st.hoja; h.area.caminos = h.area.caminos || [];
      for (const l of lineas) h.area.caminos.push({ nombre: l.nombre || archivo.name, linea: l.linea });
      avisar(`${lineas.length} camino${lineas.length === 1 ? '' : 's'} agregado${lineas.length === 1 ? '' : 's'}.`); cambio(); return;
    }
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
      if (t.dataset.ubic) { st.hoja.ubicacion = { ...(st.hoja.ubicacion || {}), [t.dataset.ubic]: t.value, auto: false }; cambio(); return; }
      if (t.dataset.identif) { st.hoja[t.dataset.identif] = t.value; cambio(); return; }
      if (t.dataset.rumboRango != null) {
        metaSector(st.hoja, secSel()).rumbo = String(Number(t.value));
        const num = raiz.querySelector('#vu-rumbo-num'); if (num) num.textContent = `${t.value}°`;
        cambio(); refrescarVuelo(); return;
      }
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
      if (t.dataset.archivo && t.files && t.files[0]) { await alCargarArchivo(t); t.value = ''; await render(); if (st.hoja && t.dataset.archivo === 'area') detectarUbicacion(); return; }
      if (t.dataset.campo === 'filtroProyecto') { st.filtroProyecto = t.value; await render(); return; }
      if (t.dataset.campo === 'verProcesados') { st.verProcesados = t.checked; await render(); return; }
      if (t.name === 'rapDron') { st.rapDron = t.value; return; }
      if (!st.hoja || st.vista !== 'hoja') return;
      const h = st.hoja;
      if (t.hasAttribute('data-clima-dia')) { if (t.value) { st.dia = t.value; guardarResumenClima(); } await render(); return; }
      if (t.dataset.horario) {
        h.params.horario = { ...HORARIO_INICIAL, ...(h.params.horario || {}), [t.dataset.horario]: t.type === 'number' ? (Number(t.value) || 0) : t.value };
        cambio(); await render(); return;
      }
      if (t.dataset.hoja && (t.tagName === 'SELECT' || t.type === 'date')) {
        h[t.dataset.hoja] = t.value || null; if (t.dataset.hoja === 'fecha') st.dia = null;
        if (t.dataset.hoja === 'proyectoId') { const p = base.proyectos.find(x => x.id === t.value); if (p) { if (!h.mandante) h.mandante = p.mandante || ''; if (!h.jefe) h.jefe = p.solicitadoPor || ''; } }
        cambio(); await render(); return;
      }
      if (t.name === 'familia') { const alt = alturaDe(h.params, dron()); const x = base.drones.find(d => (d.familia || d.id) === t.value); if (x) h.dronId = x.id; if (!h.params.porGsd) h.params.altura = String(Math.round(alt)); if (Number(h.params.velocidad) > dron().velocidadMaxMs) h.params.velocidad = ''; cambio(); await render(); return; }
      if (t.name === 'dronId') { h.dronId = t.value; cambio(); await render(); return; }
      if (t.hasAttribute('data-sector-sel')) { h.area.sel = Number(t.value); st.dibujo = null; cambio(); await render(); return; }
      if (t.name === 'modo') { h.params.modo = t.value; if (t.value === 'lidar' && Number(h.params.traslapeLateral) > 60) h.params.traslapeLateral = '50'; if (t.value === 'foto' && Number(h.params.traslapeLateral) < 60) h.params.traslapeLateral = '70'; cambio(); await render(); return; }
      if (t.dataset.auto) {
        const a = h.area, k = t.dataset.auto;
        a.dm = a.dm || {}; a.auto = a.auto || {};
        if (k === 'dm') { const km = dmAKm(t.value); a.dm.texto = t.value.trim(); a.dm.inicio = t.value.trim() ? km : null; if (t.value.trim() && km == null) avisar('No entendí el DM: escríbelo como 10+000.', 'error'); }
        else if (k === 'desc') a.dm.desc = t.checked;
        else if (k === 'igual') a.auto.igual = t.checked;
        else if (k === 'primer') { a.auto.primer = t.value.trim(); a.auto.primerKm = t.value.trim() ? dmAKm(t.value) : null; }
        else a.auto[k] = t.value.trim();
        if (k === 'n') { const x = raiz.querySelector('#vu-n-txt'); if (x) x.textContent = t.value; }
        cambio();
        if (k === 'modo' || k === 'unidad' || k === 'unidadSup') { await render(); return; }
        refrescarArea(); return;
      }
      if (t.dataset.accionCambio === 'a-corredor') {
        if (corredorDesdeEje(h)) { avisar('Ahora se vuela como corredor sobre el eje calculado. Ajusta el ancho si hace falta.'); cambio(); }
        await render(); return;
      }
      if (t.dataset.area === 'rectas') { h.area.rectas = t.checked; cambio(); refrescarArea(); return; }
      if (t.dataset.area === 'mismo') { h.area.corredor.mismo = t.checked; if (!t.checked) h.area.corredor.der = h.area.corredor.izq; cambio(); await render(); return; }
      if (t.hasAttribute('data-redvial')) { st.redVial = t.checked; escribirLS('vu_red_vial', st.redVial); await render(); return; }
      if (t.dataset.capa) { const todas = capasActivas(); st.capasActivas = t.checked ? [...new Set([...todas, t.dataset.capa])] : todas.filter(x => x !== t.dataset.capa); escribirLS('vu_capas_activas', st.capasActivas); refrescarArea(); return; }
      if (t.dataset.dgac && t.dataset.dgac !== 'numero') { h.permisos.dgac[t.dataset.dgac] = t.value; cambio(); await render(); return; }
      if (t.dataset.doc) { h.permisos.docs[t.dataset.doc] = t.checked; cambio(); return; }
      if (t.dataset.zona) { h.permisos.zona = t.dataset.zona; cambio(); await render(); return; }
      if (t.dataset.docest || t.dataset.docvence) {
        const k = t.dataset.docest || t.dataset.docvence, est = h.permisos.docsEstado = h.permisos.docsEstado || {};
        est[k] = { ...(est[k] || {}), [t.dataset.docest ? 'estado' : 'vence']: t.value };
        cambio(); await render(); return;
      }
    } catch (e) { console.error(e); avisar(e.message || 'No se pudo completar', 'error'); await render(); }
  });

  // Enter en el DM de un corte fijo = «+ Agregar»
  raiz.addEventListener('keydown', async ev => {
    if (ev.key !== 'Enter' || !ev.target || ev.target.id !== 'vu-nuevo-fijo') return;
    ev.preventDefault();
    if (agregarFijo(ev.target.value)) await render();
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
      else if (a === 'estado') { h.estado = b.dataset.e; if (b.dataset.e !== 'volada') h.procesado = false; cambio(); await guardarAhora(); }
      else if (a === 'procesado') { h.procesado = b.dataset.v === '1'; if (h.procesado && !(h.permisos.logs || []).length) avisar('Marcado procesado, pero falta cargar el log del vuelo (paso Permisos).', 'error'); cambio(); await guardarAhora(); }
      else if (a === 'sel-vuelo') { st.selHoja = b.dataset.id; }
      else if (a === 'filtro-etapa') { st.filtroEtapa = b.dataset.e || ''; }
      else if (a === 'quitar-log') { if (!confirm('¿Quitar este log de la hoja? El archivo queda en el respaldo.')) return; h.permisos.logs.splice(Number(b.dataset.i), 1); cambio(); }
      else if (a === 'imprimir') { await guardarAhora(); imprimir(); return; }
      else if (a === 'dia') { st.dia = b.dataset.dia; if (st.vista === 'hoja') guardarResumenClima(); }
      else if (a === 'consultar-hoja') { await consultarHojaAuto(true); return; }
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
        if (modo === 'corte' || modo === 'dmfijo' || modo === 'vertice') st.subArea = 'sectores';
        if (modo === 'vertice' && st.dibujo) { h.area.auto = { ...(h.area.auto || {}), modo: 'vertices' }; cambio(); }
        if (modo === 'area' || modo === 'eje') st.subArea = 'origen';
        if (modo === 'camino') st.subArea = 'zonas';
        if (st.dibujo && modo === 'corte') avisar('Traza el corte: toca afuera del área, sigue el camino y termina afuera. Luego «Terminar».');
      }
      else if (a === 'dibujo-deshacer') { st.dibujo.puntos.pop(); const bb = raiz.querySelector('#vu-barra-area'); if (bb) bb.innerHTML = barraDibujo(); if (mapas.area) pintarDibujo(mapas.area); return; }
      else if (a === 'dibujo-cancelar') { st.dibujo = null; }
      else if (a === 'dibujo-terminar') {
        const { modo, puntos } = st.dibujo;
        if (modo === 'area') {
          const coords = limpiarAnillo(puntos); const { puntos: xy } = proyectar(coords);
          usarPoligono({ nombre: 'Área dibujada', coords, area: areaM2(xy), problemas: [] }, 'dibujada en el mapa');
          setTimeout(() => detectarUbicacion(true), 0);
          if (autoInterseccion(xy)) avisar('El contorno dibujado se cruza consigo mismo: dibújalo de nuevo siguiendo el borde.', 'error');
        } else if (modo === 'camino') {
          if (puntos.length < 2) { avisar('Marca al menos dos puntos del camino.', 'error'); return; }
          h.area.caminos = h.area.caminos || []; h.area.caminos.push({ nombre: `Camino dibujado ${h.area.caminos.length + 1}`, linea: puntos });
          avisar('Camino agregado: se usa para sugerir el despegue en el paso Vuelo.'); cambio();
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
      else if (a === 'quitar-camino') { h.area.caminos.splice(Number(b.dataset.i), 1); cambio(); }
      else if (a === 'despegue-buscar') { await buscarDespegue(h, b.dataset.todos === '1'); }
      else if (a === 'despegue-usar') {
        const i = Number(b.dataset.i), e = st.sugDesp && st.sugDesp.lista.find(x => x.i === i);
        if (e && e.res) { metaSector(h, i).despegue = e.res.lonLat; e.usado = true; h.area.sel = i; avisar(`Despegue de ${nombreSector(h, i, geo().sectores.length)} movido al camino.`); cambio(); }
      }
      else if (a === 'sub-area') { st.subArea = b.dataset.s; st.paso = 'area'; if (st.dibujo && (st.dibujo.modo === 'corte' || st.dibujo.modo === 'dmfijo') && st.subArea !== 'sectores') st.dibujo = null; }
      // Sentido del eje y cortes a medida (v0.9)
      else if (a === 'invertir-sentido') {
        const ar = h.area, n = (geo() || { sectores: [] }).sectores.length;
        ar.dm = ar.dm || {}; ar.dm.inv = !ar.dm.inv;
        // Los datos de cada sector (nombre, despegue, rumbo) siguen a su sector: se invierte su orden.
        if (ar.sectores && ar.sectores.length === n) ar.sectores.reverse();
        if (n) ar.sel = n - 1 - Math.min(ar.sel || 0, n - 1);
        avisar(`Sentido invertido: el inicio quedó en el ${ar.dm.inv ? 'último' : 'primer'} vértice del eje.`); cambio();
      }
      else if (a === 'agregar-fijo') { if (!agregarFijo((raiz.querySelector('#vu-nuevo-fijo') || {}).value)) return; }
      else if (a === 'quitar-fijo') { h.area.auto.fijos.splice(Number(b.dataset.i), 1); cambio(); }
      else if (a === 'sel-sector') { h.area.sel = Number(b.dataset.i); st.zoomSector = true; cambio(); refrescarArea(); return; }
      else if (a === 'auto-rumbo' || a === 'auto-lado') {
        h.area.auto = h.area.auto || {};
        const actual = h.area.auto.rumbo === '' || h.area.auto.rumbo == null ? Math.round(rumboCortesPropuesto(h)) : Number(h.area.auto.rumbo);
        h.area.auto.rumbo = String(a === 'auto-lado' ? Math.round(rumboCortesPropuesto(h)) : (((actual + Number(b.dataset.d)) % 180) + 180) % 180);
        cambio();
      }
      else if (a === 'a-poligono') {
        const ar = h.area;
        if (ar.original) { Object.assign(ar, { tipo: 'poligono', eje: null, cortes: [], sectores: [], sel: 0 }); avisar('Se vuelve a volar como polígono.'); cambio(); }
      }
      else if (a === 'auto-cortar') await cortarAutomatico(h);
      else if (a === 'elegir-metodo') {
        const m = b.dataset.m, antes = (h.area.auto || {}).modo;
        h.area.auto = { ...(h.area.auto || {}), modo: m };
        st.dibujo = null;
        if (m === 'vertices') {
          if (antes !== 'vertices') { h.area.cortes = []; h.area.sectores = []; h.area.sel = 0; }
          st.dibujo = { modo: 'vertice', puntos: [] };
          avisar('Toca un vértice del área y luego otro: el corte une ambos vértices.');
          cambio();
        } else await cortarAutomatico(h);
      }
      else if (a === 'detectar-ubicacion') { await detectarUbicacion(true); return; }
      else if (a === 'programar') {
        const g = geo(), jor = jornadasNecesarias(h, dron(), g);
        if (!jor || !jor.dias.length || !h.fecha) { avisar('Falta el área o el primer día de vuelo.', 'error'); }
        else {
          const fechas = diasHabilesDesde(h.fecha, jor.dias.length), n = g.sectores.length;
          h.programa = jor.dias.map((di, k) => ({ fecha: fechas[k], dia: k + 1, de: jor.dias.length, sectores: di.sectores.map(i => nombreSector(h, i, n)), min: Math.round(di.min), baterias: di.baterias }));
          avisar(`Listo: ${h.programa.length} jornada${h.programa.length === 1 ? '' : 's'} en el calendario (Proyectos → Calendario).`); cambio();
        }
      }
      else if (a === 'desprogramar') { h.programa = []; avisar('Se quitaron las jornadas del calendario.'); cambio(); }
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
          const { rumbo: mejor, minTotal: minimo } = rumboMasCorto(h, dron(), g, i, r.velocidad);
          meta.rumbo = String(mejor);
          avisar(`Rumbo ${mejor}°: el que da menos tiempo con este despegue (${fmtDuracion(minimo)} de jornada).`);
          cambio(); await render(); return;
        }
        cambio(); refrescarVuelo(); return;
      }
      else if (a === 'rumbo-lado') { metaSector(h, secSel()).rumbo = String(Number(b.dataset.r)); cambio(); refrescarVuelo(); return; }
      else if (a === 'rumbo-todos') {
        const g = geo(); for (let k = 0; k < g.sectores.length; k++) metaSector(h, k).rumbo = String(Number(b.dataset.r));
        avisar(`Rumbo ${b.dataset.r}° en los ${g.sectores.length} sectores.`); cambio();
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
      else if (a === 'metar-leer' || a === 'metar-borrar') {
        const ta = raiz.querySelector('[data-metar-texto]');
        const valor = a === 'metar-borrar' ? null : { texto: (ta && ta.value || '').trim(), leidoEn: new Date().toISOString() };
        if (valor && !valor.texto) { if (ta) ta.focus(); return; }
        if (st.vista === 'hoja' && h) { h.metar = valor; cambio(); } else st.rapMetar = valor;
      }
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
    if (['usar-pol', 'usar-eje', 'kml-a-hoja', 'eje-a-hoja'].includes(a)) detectarUbicacion(true);
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