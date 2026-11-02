// modulos/vuelos/mapas.js — mapas Leaflet de Vuelos (área, vuelo, KML) con el mapa base elegido en mapa-base.js.

import { cargarScript } from '../../compartido/util.js';
import { calcularSector, metaSector, nombreSector } from './hoja.js';
import { TIPOS_CAPA } from './capas.js';
import { COLORES_BATERIA, COLORES_SECTOR } from './ui.js';
import { agregarMapaBase } from './mapa-base.js';
import { caminosEn, recuadro, COLOR_CARPETA, describirCamino, ATRIBUCION } from './redvial.js';

export function crearMapas(v) {
  const ref = n => (...a) => v[n](...a);
  const { st } = v;
  const geo = ref('geo');
  const dron = ref('dron');
  const secSel = ref('secSel');
  const capasActivas = ref('capasActivas');
  const cambio = ref('cambio');
  const render = ref('render');
  const refrescarArea = ref('refrescarArea');
  const refrescarVuelo = ref('refrescarVuelo');
  const barraDibujo = ref('barraDibujo');
  const { raiz } = v;
  const CENTRO_CHILE = [-33.0, -70.6];

  // ─────────── Mapas (Leaflet + Esri híbrido) ───────────
  const mapas = v.mapas;
  async function cargarLeaflet() { if (window.L) return window.L; await cargarScript('vendor/leaflet/leaflet.js'); return window.L; }
  async function mapaEn(lugar, clave) {
    let L;
    try { L = await cargarLeaflet(); } catch { return null; }
    if (!L || !raiz.contains(lugar)) return null;
    let m = mapas[clave];
    if (!m) {
      const el = document.createElement('div'); el.className = 'vu-mapa';
      const mapa = L.map(el, { zoomControl: true, attributionControl: true });
      agregarMapaBase(L, mapa);
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
    redVialYRepintar(m, pintarArea);
  }

  // Red vial del MOP (si está activada) y caminos propios de la hoja. Se baja solo la región del área.
  async function asegurarRedVial() {
    const g = geo();
    if (!st.redVial || !g) return false;
    const bb = recuadro(g.vuelo.map(g.marco.aLonLat), 3);
    const clave = bb.map(x => x.toFixed(2)).join(',');
    if (st.redVialClave === clave) return false;
    st.redVialClave = clave;
    try { st.redVialDatos = await caminosEn(bb); st.redVialInfo = `${st.redVialDatos.length} caminos del MOP cerca del área. ${ATRIBUCION}.`; }
    catch { st.redVialDatos = []; st.redVialInfo = 'No se pudo leer la red vial (falta vendor/capas/redvial).'; st.redVialClave = null; }
    return true;
  }
  function pintarCaminos(m) {
    const { L, mapa } = m;
    quitar(m, 'caminos');
    const capas = [];
    const mop = st.redVial ? (st.redVialDatos || []) : [];
    for (const c of mop.slice(0, 4000)) capas.push(L.polyline(c.linea.map(([lon, lat]) => [lat, lon]), { color: '#3A3A3A', weight: /pavimento/i.test(c.carpeta) ? 5 : 4, opacity: 0.55, interactive: false }));
    for (const c of mop.slice(0, 4000)) capas.push(L.polyline(c.linea.map(([lon, lat]) => [lat, lon]), { color: COLOR_CARPETA(c.carpeta), weight: /pavimento/i.test(c.carpeta) ? 3 : 2, opacity: 0.85, dashArray: /suelo/i.test(c.carpeta) ? '4 4' : null }).bindTooltip(describirCamino(c) || 'Camino', { sticky: true }));
    for (const c of (st.hoja && st.hoja.area.caminos) || []) capas.push(L.polyline(c.linea.map(([lon, lat]) => [lat, lon]), { color: '#FFD54F', weight: 3, opacity: 0.95 }).bindTooltip(c.nombre || 'Camino agregado', { sticky: true }));
    if (capas.length) m.capas.caminos = L.layerGroup(capas).addTo(mapa);
    if (mapa.attributionControl) { mapa.attributionControl.removeAttribution(ATRIBUCION); if (mop.length) mapa.attributionControl.addAttribution(ATRIBUCION); }
  }
  async function redVialYRepintar(m, pintar) {
    if (await asegurarRedVial()) { pintar(m); const info = raiz.querySelector('.vu-caminos-info'); if (info) info.textContent = st.redVialInfo; }
  }

  function pintarArea(m) {
    const { L, mapa } = m;
    const g = geo(), h = st.hoja;
    quitar(m, 'original', 'sectores', 'cortes', 'eje');
    pintarZonas(m);
    pintarCaminos(m);
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
    redVialYRepintar(m, pintarVuelo);
  }

  function pintarVuelo(m) {
    const { L, mapa } = m;
    const g = geo(), h = st.hoja;
    quitar(m, 'sectores', 'lineas', 'traslados', 'sugerido');
    if (!g) return;
    pintarCaminos(m);
    const LL = aLL(g), i = secSel();
    const sug = st.sugDesp && st.sugDesp.lista && st.sugDesp.lista.find(x => x.i === i && x.res && !x.usado);
    if (sug) m.capas.sugerido = L.circleMarker([sug.res.lonLat[1], sug.res.lonLat[0]], { radius: 8, color: '#FFFFFF', weight: 2, fillColor: '#2E7D32', fillOpacity: 1 }).bindTooltip('Despegue sugerido sobre el camino', { direction: 'top' }).addTo(mapa);
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

  return { mapaArea, mapaVuelo, mapaKml, pintarArea, pintarVuelo, pintarDibujo };
}
