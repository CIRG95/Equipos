// modulos/vuelos/mapas.js — mapas Leaflet de Vuelos (área, vuelo, KML) con el mapa base elegido en mapa-base.js.

import { cargarScript } from '../../compartido/util.js';
import { calcularSector, metaSector, nombreSector, lineaEje, kmEnEje, kmADm, marcoDe, geometria, ladosSector, opcionesDespegue } from './hoja.js';
import { largo, distanciaEnEje, puntoEnEje } from './geom.js';
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
      mapa.on('click', ev => { if (m.medir && m.medir.activo) agregarPuntoMedir(m, ev.latlng); else alClicMapa(clave, ev); });
      agregarMedir(m);
      mapa.on('mousemove', ev => alMoverMapa(clave, ev));
    }
    if (m.el.parentNode !== lugar) lugar.appendChild(m.el);
    m.mapa.invalidateSize();
    return m;
  }

  // ─────────── Medir en el mapa (v0.11.3): distancia acumulada y, con 3 puntos o más, superficie ───────────
  const fmtDist = d => (d >= 1000 ? `${(d / 1000).toLocaleString('es-CL', { maximumFractionDigits: 3 })} km` : `${Math.round(d).toLocaleString('es-CL')} m`);
  const fmtSup = a => (a >= 10000 ? `${(a / 10000).toLocaleString('es-CL', { maximumFractionDigits: 2 })} ha` : `${Math.round(a).toLocaleString('es-CL')} m²`);
  function superficieLL(pts) {
    // Proyección local equirectangular (error < 0,5 % en áreas de pocos km).
    const lat0 = pts[0].lat * Math.PI / 180, kx = 111320 * Math.cos(lat0), ky = 110540;
    const xy = pts.map(p => [(p.lng - pts[0].lng) * kx, (p.lat - pts[0].lat) * ky]);
    let a = 0; for (let i = 0; i < xy.length; i++) { const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % xy.length]; a += x1 * y2 - x2 * y1; }
    return Math.abs(a) / 2;
  }
  function agregarMedir(m) {
    const { L, mapa } = m;
    m.medir = { activo: false, pts: [] };
    const Control = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const caja = L.DomUtil.create('div', 'leaflet-bar vu-medir');
        caja.innerHTML = `<button type="button" class="vu-medir-btn" data-m="toggle" title="Medir distancia y superficie" aria-label="Medir"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 17L17 3l4 4L7 21z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2" stroke="currentColor" stroke-width="1.6"/></svg></button>
          <div class="vu-medir-panel" hidden><b class="vu-medir-res">Toca puntos en el mapa</b><span><button type="button" data-m="deshacer">Deshacer</button><button type="button" data-m="borrar">Borrar</button><button type="button" data-m="toggle">Terminar</button></span></div>`;
        L.DomEvent.disableClickPropagation(caja); L.DomEvent.disableScrollPropagation(caja);
        caja.addEventListener('click', e => {
          const b = e.target.closest('button[data-m]'); if (!b) return;
          const acc = b.dataset.m;
          if (acc === 'toggle') { m.medir.activo = !m.medir.activo; if (!m.medir.activo && m.medir.pts.length < 2) m.medir.pts = []; }
          else if (acc === 'deshacer') m.medir.pts.pop();
          else if (acc === 'borrar') m.medir.pts = [];
          pintarMedir(m);
        });
        m.medir.caja = caja;
        return caja;
      },
    });
    new Control().addTo(mapa);
  }
  function agregarPuntoMedir(m, ll) { m.medir.pts.push(ll); pintarMedir(m); }
  function pintarMedir(m) {
    const { L, mapa } = m, md = m.medir, pts = md.pts;
    if (md.capa) { md.capa.remove(); md.capa = null; }
    m.el.classList.toggle('vu-midiendo', md.activo);
    md.caja.querySelector('.vu-medir-btn').classList.toggle('activo', md.activo);
    md.caja.querySelector('.vu-medir-panel').hidden = !md.activo && pts.length < 2;
    let dist = 0; for (let i = 1; i < pts.length; i++) dist += mapa.distance(pts[i - 1], pts[i]);
    const sup = pts.length >= 3 ? superficieLL(pts) : 0;
    const txt = pts.length < 2 ? (md.activo ? 'Toca puntos en el mapa' : '') : `${fmtDist(dist)}${sup ? ` · cerrado ${fmtSup(sup)} (perímetro ${fmtDist(dist + mapa.distance(pts[pts.length - 1], pts[0]))})` : ''}`;
    md.caja.querySelector('.vu-medir-res').textContent = txt;
    if (!pts.length) return;
    const capas = [];
    if (pts.length >= 3) capas.push(L.polygon(pts, { color: '#FFD54F', weight: 0, fillOpacity: 0.15, interactive: false }));
    if (pts.length >= 2) capas.push(L.polyline(pts, { color: '#FFD54F', weight: 3, dashArray: '6 4', interactive: false }));
    pts.forEach((p, k) => capas.push(L.circleMarker(p, { radius: 4, color: '#1C1F23', weight: 1.5, fillColor: '#FFD54F', fillOpacity: 1, interactive: false })));
    if (pts.length >= 2) capas.push(L.marker(pts[pts.length - 1], { interactive: false, icon: L.divIcon({ className: 'vu-medir-etq', html: `<span>${fmtDist(dist)}</span>`, iconSize: null, iconAnchor: [-8, 12] }) }));
    md.capa = L.layerGroup(capas).addTo(mapa);
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
    if (st.dibujo.modo === 'vertice') {
      const g = geo();
      if (!g) return;
      const LL = aLL(g), vs = g.vuelo.map(LL);
      m.capas.dibujo = L.layerGroup([
        ...vs.map(p => L.circleMarker(p, { radius: 5, color: '#1C1F23', weight: 1.5, fillColor: '#FFFFFF', fillOpacity: 1, interactive: false })),
        ...pts.map(p => L.circleMarker(p, { radius: 8, color: '#FFFFFF', weight: 3, fillColor: '#E8611C', fillOpacity: 1, interactive: false })),
      ]).addTo(mapa);
      return;
    }
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
    try { st.redVialDatos = await caminosEn(bb); st.redVialInfo = `${st.redVialDatos.length} tramos de caminos del MOP a menos de 3 km del área. ${ATRIBUCION}.`; }
    catch { st.redVialDatos = []; st.redVialInfo = 'No se pudo leer la red vial (falta vendor/capas/redvial).'; st.redVialClave = null; }
    return true;
  }
  // v0.11.1: los caminos se dibujan en canvas (no SVG), agrupados por tipo de carpeta, y la capa se arma una sola vez
  // mientras no cambien la red vial ni los caminos de la hoja (antes se rehacían miles de líneas en cada repintado).
  function pintarCaminos(m) {
    const { L, mapa } = m;
    const mop = st.redVial ? (st.redVialDatos || []) : [];
    const propios = (st.hoja && st.hoja.area.caminos) || [];
    const clave = `${st.redVial ? st.redVialClave : '-'}|${mop.length}|${propios.length}|${propios.length ? propios[propios.length - 1].linea.length : 0}`;
    if (m.caminos && m.caminos.clave === clave) {
      if (m.caminos.grupo && !mapa.hasLayer(m.caminos.grupo)) m.caminos.grupo.addTo(mapa);
      return;
    }
    if (m.caminos && m.caminos.grupo) m.caminos.grupo.remove();
    m.lienzo = m.lienzo || L.canvas({ padding: 0.5, tolerance: 6 });
    const ll = l => l.map(([lon, lat]) => [lat, lon]);
    const capas = [];
    if (mop.length) {
      // Bordes: una sola línea múltiple por grosor.
      const pav = mop.filter(c => /pavimento/i.test(c.carpeta)), resto = mop.filter(c => !/pavimento/i.test(c.carpeta));
      for (const [lista, w] of [[resto, 4], [pav, 5]]) if (lista.length) capas.push(L.polyline(lista.map(c => ll(c.linea)), { renderer: m.lienzo, color: '#3A3A3A', weight: w, opacity: 0.55, interactive: false }));
      if (mop.length <= 400) {
        for (const c of mop) capas.push(L.polyline(ll(c.linea), { renderer: m.lienzo, color: COLOR_CARPETA(c.carpeta), weight: /pavimento/i.test(c.carpeta) ? 3 : 2, opacity: 0.85, dashArray: /suelo/i.test(c.carpeta) ? '4 4' : null }).bindTooltip(describirCamino(c) || 'Camino', { sticky: true }));
      } else {
        // Muchos caminos: una línea múltiple por tipo de carpeta (sin nombre por camino).
        const grupos = new Map();
        for (const c of mop) { const k = c.carpeta || 'Sin dato'; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(ll(c.linea)); }
        for (const [k, lineas] of grupos) capas.push(L.polyline(lineas, { renderer: m.lienzo, color: COLOR_CARPETA(k), weight: /pavimento/i.test(k) ? 3 : 2, opacity: 0.85, dashArray: /suelo/i.test(k) ? '4 4' : null }).bindTooltip(`Red vial MOP · ${k}`, { sticky: true }));
      }
    }
    if (propios.length) capas.push(L.polyline(propios.map(c => ll(c.linea)), { renderer: m.lienzo, color: '#FFD54F', weight: 3, opacity: 0.95 }).bindTooltip(propios.length === 1 ? (propios[0].nombre || 'Camino agregado') : `Caminos agregados (${propios.length})`, { sticky: true }));
    m.caminos = { clave, grupo: capas.length ? L.layerGroup(capas).addTo(mapa) : null };
    if (mapa.attributionControl) { mapa.attributionControl.removeAttribution(ATRIBUCION); if (mop.length) mapa.attributionControl.addAttribution(ATRIBUCION); }
  }
  async function redVialYRepintar(m, pintar) {
    if (await asegurarRedVial()) { pintar(m); const info = raiz.querySelector('.vu-caminos-info'); if (info) info.textContent = st.redVialInfo; }
  }

  function pintarArea(m) {
    const { L, mapa } = m;
    const g = geo(), h = st.hoja;
    quitar(m, 'original', 'sectores', 'cortes', 'eje', 'sentido', 'propuesta');
    pintarZonas(m);
    pintarCaminos(m);
    if (!g) return;
    const LL = aLL(g);
    if (g.tipo === 'poligono' && Number(h.area.margen)) m.capas.original = L.polygon(g.original.map(LL), { color: '#FFFFFF', weight: 2, dashArray: '6 5', fill: false, interactive: false }).addTo(mapa);
    if (g.tipo === 'corredor') m.capas.eje = L.polyline(g.eje.map(LL), { color: '#FFFFFF', weight: 2, dashArray: '3 5', interactive: false }).addTo(mapa);
    else if (h.area.ejeCalc && h.area.ejeCalc.linea) m.capas.eje = L.polyline(h.area.ejeCalc.linea.map(([lon, lat]) => [lat, lon]), { color: '#FFFFFF', weight: 2, dashArray: '3 5' }).bindTooltip('Eje calculado', { sticky: true }).addTo(mapa);
    const varios = g.sectores.length > 1;
    const sel = Math.max(0, Math.min(h.area.sel || 0, g.sectores.length - 1));
    m.capas.sectores = L.layerGroup(g.sectores.map((s, i) => {
      const elegido = varios && i === sel;
      const p = L.polygon(s.poligono.map(LL), { color: elegido ? '#FFFFFF' : '#E8611C', weight: elegido ? 5 : 3, fillColor: COLORES_SECTOR[i % COLORES_SECTOR.length], fillOpacity: varios ? (elegido ? 0.5 : 0.25) : 0.1, interactive: g.sectores.length > 8 });
      // Con muchos sectores las etiquetas fijas se tapan entre sí: se muestran al pasar el mouse.
      if (varios) p.bindTooltip(nombreSector(h, i, g.sectores.length), { permanent: g.sectores.length <= 8, sticky: g.sectores.length > 8, direction: 'center', className: 'vu-etiqueta' });
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
    pintarSentido(m);
    if (m.capas.sectores) m.capas.sectores.eachLayer(l => { if (l.options.weight === 5) l.bringToFront(); });
    // v0.11.3: propuesta por aplicar, punteada y sin relleno sobre los sectores actuales.
    if (st.propuesta && st.propuesta.cortes.length) {
      const gp = geometria({ ...h, area: { ...h.area, cortes: st.propuesta.cortes, sectores: [], sel: 0 } });
      if (gp) m.capas.propuesta = L.layerGroup(gp.sectores.map((s2, k) => L.polygon(s2.poligono.map(aLL(gp)), { color: '#FFD54F', weight: 3, dashArray: '8 6', fill: false, interactive: false })
        .bindTooltip(String(k + 1), { permanent: gp.sectores.length <= 20, direction: 'center', className: 'vu-etiqueta-prop' }))).addTo(mapa);
      geometria(h);
    }
    encuadrar(m, g.vuelo.map(LL), `area:${JSON.stringify(g.vuelo[0])}:${g.vuelo.length}`);
    if (st.zoomSector && varios) { st.zoomSector = false; const b = L.latLngBounds(g.sectores[sel].poligono.map(LL)); if (b.isValid()) mapa.fitBounds(b, { padding: [60, 60], maxZoom: 16 }); }
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
    quitar(m, 'sectores', 'lineas', 'traslados', 'sugerido', 'lados', 'opsDesp');
    if (!g) return;
    pintarCaminos(m);
    const LL = aLL(g), i = secSel();
    const sug = st.sugDesp && st.sugDesp.lista && st.sugDesp.lista.find(x => x.i === i && x.res && !x.usado);
    if (sug) m.capas.sugerido = L.circleMarker([sug.res.lonLat[1], sug.res.lonLat[0]], { radius: 8, color: '#FFFFFF', weight: 2, fillColor: '#2E7D32', fillOpacity: 1 }).bindTooltip('Despegue sugerido sobre el camino', { direction: 'top' }).addTo(mapa);
    const r = calcularSector(h, dron(), g, i);
    m.capas.sectores = L.layerGroup(g.sectores.map((s, k) => L.polygon(s.poligono.map(LL), { color: k === i ? '#E8611C' : '#FFFFFF', weight: k === i ? 3 : 1, opacity: k === i ? 1 : 0.55, dashArray: k === i ? null : '4 6', fillColor: '#E8611C', fillOpacity: k === i ? 0.1 : 0, interactive: k !== i })
      .on('click', () => { if (k !== i) { h.area.sel = k; cambio(); render(); } }))).addTo(mapa);
    if (!r) return;
    // Números de los lados del sector (orientar paralelo a un lado).
    const lados = ladosSector(g, i);
    if (lados.length) m.capas.lados = L.layerGroup(lados.map(l => L.marker(LL(l.medio), { interactive: false, keyboard: false, icon: L.divIcon({ className: 'vu-lado-num', html: `<span>${l.n}</span>`, iconSize: [22, 22], iconAnchor: [11, 11] }) }))).addTo(mapa);
    m.capas.lineas = L.layerGroup(r.baterias.flatMap((b, k) => b.piezas.map(pz => L.polyline(pz.slice(0, 5000).map(LL), { color: COLORES_BATERIA[k % COLORES_BATERIA.length], weight: 2, opacity: 0.95, interactive: false })))).addTo(mapa);
    if (!r.corredor) {
      const ops = opcionesDespegue(st.hoja, dron(), g, i);
      m.capas.opsDesp = L.layerGroup(ops.map((o, k) => L.marker(LL(o.xy), { keyboard: false, icon: L.divIcon({ className: `vu-desp-mapa${o.mejor ? ' mejor' : ''}`, html: `<span>${String.fromCharCode(65 + k)}</span>`, iconSize: [22, 22], iconAnchor: [11, 11] }) })
        .bindTooltip(`${o.texto} · ${Math.round(o.minTotal)} min`, { direction: 'top' })
        .on('click', () => { metaSector(st.hoja, i).despegue = o.lonLat; cambio(); refrescarVuelo(); }))).addTo(mapa);
    }
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

  // ─────────── Sentido del eje (v0.9): inicio, fin y flechas de avance ───────────
  function ejeActual() {
    const a = st.hoja && st.hoja.area, linea = a && lineaEje(a);
    if (!linea || linea.length < 2) return null;
    const marco = marcoDe(linea), xy = linea.map(marco.aXY);
    return { a, marco, xy, L: largo(xy) };
  }
  function pintarSentido(m) {
    const { L, mapa } = m, e = ejeActual();
    if (!e) return;
    const inv = !!(e.a.dm && e.a.dm.inv), aLL = p => { const [lon, lat] = e.marco.aLonLat(p); return [lat, lon]; };
    const sIni = inv ? e.L : 0, sFin = inv ? 0 : e.L;
    const etiqueta = (s, txt, clase) => L.marker(aLL(puntoEnEje(e.xy, s).p), { interactive: false, keyboard: false, icon: L.divIcon({ className: 'vu-extremo ' + clase, html: `<span>${txt}</span>`, iconSize: null }) });
    const capas = [etiqueta(sIni, `Inicio · ${kmADm(kmEnEje(e.a, sIni, e.L))}`, 'ini'), etiqueta(sFin, `Fin · ${kmADm(kmEnEje(e.a, sFin, e.L))}`, 'fin')];
    for (const f of [0.2, 0.4, 0.6, 0.8]) {
      const s = e.L * f, p0 = puntoEnEje(e.xy, s).p, p1 = puntoEnEje(e.xy, Math.min(e.L, s + Math.max(5, e.L * 0.002))).p;
      let ang = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]) * 180 / Math.PI; // rumbo en grados desde el norte
      if (inv) ang += 180;
      capas.push(L.marker(aLL(p0), { interactive: false, keyboard: false, icon: L.divIcon({ className: 'vu-flecha', html: `<span style="transform:rotate(${ang.toFixed(1)}deg)">▲</span>`, iconSize: [18, 18], iconAnchor: [9, 9] }) }));
    }
    m.capas.sentido = L.layerGroup(capas).addTo(mapa);
  }
  /** Punto del eje más cercano a un clic: { s (m desde el primer vértice), km, latlng }. */
  function puntoEjeCercano(latlng) {
    const e = ejeActual();
    if (!e) return null;
    const q = e.marco.aXY([latlng.lng, latlng.lat]), s = distanciaEnEje(e.xy, q), p = puntoEnEje(e.xy, s).p, [lon, lat] = e.marco.aLonLat(p);
    return { s, km: kmEnEje(e.a, s, e.L), latlng: [lat, lon] };
  }
  let movPendiente = null;
  function alMoverMapa(clave, ev) {
    if (clave !== 'area' || !st.dibujo || st.dibujo.modo !== 'dmfijo') { if (mapas.area && mapas.area.capas.cursorDm) quitar(mapas.area, 'cursorDm'); return; }
    if (movPendiente) { movPendiente = ev; return; }
    movPendiente = ev;
    requestAnimationFrame(() => {
      const e2 = movPendiente; movPendiente = null;
      const m = mapas.area, r = m && puntoEjeCercano(e2.latlng);
      if (!m || !r) return;
      quitar(m, 'cursorDm');
      m.capas.cursorDm = m.L.circleMarker(r.latlng, { radius: 7, color: '#1C1F23', weight: 3, fillColor: '#FFFFFF', fillOpacity: 1, interactive: false })
        .bindTooltip(`DM ${kmADm(r.km)} · toca para cortar aquí`, { permanent: true, direction: 'right', offset: [10, 0], className: 'vu-tip-dm' }).addTo(m.mapa);
    });
  }

  function alClicMapa(clave, ev) {
    if (clave !== 'area' || !st.dibujo) return;
    if (st.dibujo.modo === 'dmfijo') {
      const r = puntoEjeCercano(ev.latlng);
      if (r && v.agregarFijo(kmADm(r.km))) render();
      return;
    }
    if (st.dibujo.modo === 'vertice') {
      // Se toma el vértice del área de vuelo más cercano al toque (hasta 28 px).
      const g = geo(), m = mapas.area;
      if (!g || !m) return;
      const LL = aLL(g), cp = m.mapa.latLngToContainerPoint(ev.latlng);
      let mejor = null, dmin = 28;
      g.vuelo.forEach(p => { const q = m.mapa.latLngToContainerPoint(LL(p)), d = Math.hypot(q.x - cp.x, q.y - cp.y); if (d < dmin) { dmin = d; mejor = p; } });
      if (!mejor) { v.avisar('Toca más cerca de un vértice del área (los puntos blancos).', 'error'); render(); return; }
      const ll = g.marco.aLonLat(mejor);
      const pts = st.dibujo.puntos;
      if (pts.length && Math.abs(pts[0][0] - ll[0]) < 1e-9 && Math.abs(pts[0][1] - ll[1]) < 1e-9) return;
      pts.push(ll);
      if (pts.length === 2) {
        const h = st.hoja;
        h.area.auto = { ...(h.area.auto || {}), modo: 'vertices' };
        h.area.cortes.push(pts.slice());
        st.dibujo.puntos = [];
        const g2 = geometria(h);
        if (g2 && g2.fallidos.length) { h.area.cortes.pop(); v.avisar('Ese corte no queda dentro del área: elige dos vértices que se vean por dentro.', 'error'); }
        else v.avisar(`Corte agregado: ${g2 ? g2.sectores.length : '—'} sectores. Toca otros dos vértices para seguir, o «Terminar».`);
        cambio(); render(); return;
      }
      const b = raiz.querySelector('#vu-barra-area'); if (b) b.innerHTML = barraDibujo();
      if (mapas.area) pintarDibujo(mapas.area);
      return;
    }
    st.dibujo.puntos.push([ev.latlng.lng, ev.latlng.lat]);
    const b = raiz.querySelector('#vu-barra-area'); if (b) b.innerHTML = barraDibujo();
    if (mapas.area) pintarDibujo(mapas.area);
  }

  return { mapaArea, mapaVuelo, mapaKml, pintarArea, pintarVuelo, pintarDibujo };
}
