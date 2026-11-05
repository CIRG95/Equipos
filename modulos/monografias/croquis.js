// modulos/monografias/croquis.js — croquis de ubicación desde un mapa (v0.11).
// Mapa híbrido (satélite Esri + nombres de ciudades y caminos) con el punto marcado con un símbolo a elección y su nombre
// con la letra configurable. «Usar como croquis» dibuja el mapa en una imagen (con flecha de norte) para la monografía.

import { cargarScript, escapar as esc } from '../../compartido/util.js';

const ESRI = s => `https://server.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/{z}/{y}/{x}`;
const CAPAS = [ESRI('World_Imagery'), ESRI('Reference/World_Transportation'), ESRI('Reference/World_Boundaries_and_Places')];
export const SIMBOLOS = [['circulo-cruz', 'Círculo con cruz'], ['triangulo', 'Triángulo'], ['cuadrado', 'Cuadrado'], ['circulo', 'Círculo lleno'], ['estrella', 'Estrella']];
export const FUENTES = [['Arial', 'Arial'], ['IBM Plex Sans', 'IBM Plex Sans'], ['Georgia', 'Georgia (serif)'], ['Courier New', 'Courier (monoespaciada)']];

/** Dibuja el símbolo del punto centrado en (x, y). */
function dibujarSimbolo(c, tipo, x, y, r, color) {
  c.save(); c.lineWidth = Math.max(2, r / 4); c.strokeStyle = '#FFFFFF'; c.fillStyle = color;
  c.beginPath();
  if (tipo === 'triangulo') { c.moveTo(x, y - r); c.lineTo(x + r * 0.9, y + r * 0.7); c.lineTo(x - r * 0.9, y + r * 0.7); c.closePath(); }
  else if (tipo === 'cuadrado') c.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
  else if (tipo === 'estrella') { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; c[k ? 'lineTo' : 'moveTo'](x + rr * Math.cos(a), y + rr * Math.sin(a)); } c.closePath(); }
  else c.arc(x, y, r, 0, Math.PI * 2);
  c.fill(); c.stroke();
  if (tipo === 'circulo-cruz') { c.beginPath(); c.moveTo(x - r * 0.65, y); c.lineTo(x + r * 0.65, y); c.moveTo(x, y - r * 0.65); c.lineTo(x, y + r * 0.65); c.stroke(); }
  c.restore();
}

function dibujarNorte(c, x, y, h) {
  c.save(); c.fillStyle = '#FFFFFF'; c.strokeStyle = '#1C1F23'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + h * 0.32, y + h * 0.75); c.lineTo(x, y + h * 0.58); c.lineTo(x - h * 0.32, y + h * 0.75); c.closePath(); c.fill(); c.stroke();
  c.font = `bold ${Math.round(h * 0.42)}px Arial`; c.textAlign = 'center'; c.lineWidth = 3; c.strokeText('N', x, y + h * 1.2); c.fillText('N', x, y + h * 1.2);
  c.restore();
}

/** Imagen (dataURL JPEG) del mapa tal como se ve, con el punto, su nombre y la flecha de norte. */
async function capturar(mapa, L, op) {
  const tam = mapa.getSize(), z = mapa.getZoom(), b = mapa.getPixelBounds(), escala = 2;
  const cv = document.createElement('canvas');
  cv.width = tam.x * escala; cv.height = tam.y * escala;
  const c = cv.getContext('2d');
  c.scale(escala, escala);
  c.fillStyle = '#C9B48F'; c.fillRect(0, 0, tam.x, tam.y);
  const cargar = url => new Promise((ok, mal) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => ok(im); im.onerror = mal; im.src = url; });
  const t0x = Math.floor(b.min.x / 256), t1x = Math.floor(b.max.x / 256), t0y = Math.floor(b.min.y / 256), t1y = Math.floor(b.max.y / 256);
  for (const plantilla of CAPAS) {
    const tareas = [];
    for (let tx = t0x; tx <= t1x; tx++) for (let ty = t0y; ty <= t1y; ty++) {
      const url = plantilla.replace('{z}', z).replace('{x}', tx).replace('{y}', ty);
      tareas.push(cargar(url).then(im => c.drawImage(im, tx * 256 - b.min.x, ty * 256 - b.min.y, 256, 256)).catch(() => {}));
    }
    await Promise.all(tareas);
  }
  const p = mapa.latLngToContainerPoint(op.punto);
  dibujarSimbolo(c, op.simbolo, p.x, p.y, op.tamSimbolo, op.color);
  if (op.nombre) {
    c.save(); c.font = `${op.negrita ? 'bold ' : ''}${op.tamLetra}px "${op.fuente}", Arial, sans-serif`; c.textBaseline = 'middle';
    c.lineWidth = Math.max(3, op.tamLetra / 5); c.strokeStyle = 'rgba(0,0,0,.75)'; c.fillStyle = op.colorLetra;
    const x = p.x + op.tamSimbolo + 6; c.strokeText(op.nombre, x, p.y); c.fillText(op.nombre, x, p.y); c.restore();
  }
  if (op.norte) dibujarNorte(c, 28, 14, 34);
  return cv.toDataURL('image/jpeg', 0.9);
}

/**
 * Abre el diálogo del croquis. op: { lat, lon, nombre, aspecto (ancho/alto del recuadro del PDF) }.
 * Devuelve una promesa con el dataURL del croquis o null si se cancela.
 */
export async function abrirCroquis({ lat, lon, nombre = '', aspecto = 1.6 }) {
  if (!window.L) await cargarScript('vendor/leaflet/leaflet.js');
  const L = window.L;
  const tieneCoord = isFinite(lat) && isFinite(lon) && (lat || lon);
  const punto = tieneCoord ? [lat, lon] : [-33.45, -70.66];
  const prefs = (() => { try { return JSON.parse(localStorage.getItem('mn_croquis_prefs') || '{}'); } catch { return {}; } })();
  const op = { simbolo: 'circulo-cruz', color: '#E53935', tamSimbolo: 10, fuente: 'Arial', tamLetra: 16, negrita: true, colorLetra: '#FFFFFF', norte: true, ...prefs, nombre, punto };
  const ancho = Math.min(760, window.innerWidth - 48), alto = Math.round(ancho / aspecto);
  const caja = document.createElement('div');
  caja.className = 'mn-modal';
  caja.setAttribute('role', 'dialog'); caja.setAttribute('aria-modal', 'true'); caja.setAttribute('aria-label', 'Croquis de ubicación');
  caja.innerHTML = `<div class="mn-modal-caja mn-croquis">
    <div class="sis-cab"><h2>Croquis de ubicación</h2><button type="button" class="sis-btn chico" data-c="cancelar">Cerrar</button></div>
    <p class="sis-tenue">${tieneCoord ? 'El punto está en sus coordenadas geodésicas.' : 'La monografía aún no tiene latitud y longitud: toca el mapa para ubicar el punto.'} Toca el mapa para mover el punto; acerca o aleja para encuadrar como quieres que salga.</p>
    <div class="mn-croquis-cuerpo">
      <div class="mn-croquis-mapa" style="width:${ancho}px; height:${alto}px"></div>
      <div class="mn-croquis-op">
        <label class="sis-campo"><span>Nombre del punto</span><input data-o="nombre" value="${esc(op.nombre)}"></label>
        <label class="sis-campo"><span>Símbolo</span><select data-o="simbolo">${SIMBOLOS.map(([k, t]) => `<option value="${k}" ${op.simbolo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <div class="sis-par"><label class="sis-campo"><span>Color</span><input type="color" data-o="color" value="${op.color}"></label><label class="sis-campo"><span>Tamaño</span><input type="number" min="5" max="30" data-o="tamSimbolo" value="${op.tamSimbolo}"></label></div>
        <label class="sis-campo"><span>Tipo de letra</span><select data-o="fuente">${FUENTES.map(([k, t]) => `<option value="${k}" ${op.fuente === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <div class="sis-par"><label class="sis-campo"><span>Alto de letra (px)</span><input type="number" min="8" max="48" data-o="tamLetra" value="${op.tamLetra}"></label><label class="sis-campo"><span>Color de letra</span><input type="color" data-o="colorLetra" value="${op.colorLetra}"></label></div>
        <label class="sis-check"><input type="checkbox" data-o="negrita" ${op.negrita ? 'checked' : ''}> Negrita</label>
        <label class="sis-check"><input type="checkbox" data-o="norte" ${op.norte ? 'checked' : ''}> Flecha de norte</label>
        <p class="mn-croquis-msg sis-tenue" role="status"></p>
        <div class="sis-acciones"><button type="button" class="sis-btn primario" data-c="usar">Usar como croquis</button></div>
      </div>
    </div></div>`;
  document.body.appendChild(caja);
  const lugar = caja.querySelector('.mn-croquis-mapa');
  const mapa = L.map(lugar, { zoomControl: true, attributionControl: true }).setView(punto, tieneCoord ? 13 : 5);
  CAPAS.forEach((u, i) => L.tileLayer(u, { maxZoom: 19, crossOrigin: 'anonymous', attribution: i ? '' : 'Imagen © Esri, Maxar, Earthstar Geographics' }).addTo(mapa));
  const icono = () => L.divIcon({ className: 'mn-croquis-marca', html: `<canvas width="${op.tamSimbolo * 2 + 6}" height="${op.tamSimbolo * 2 + 6}"></canvas><span style="font:${op.negrita ? 'bold ' : ''}${op.tamLetra}px '${op.fuente}', Arial; color:${op.colorLetra}">${esc(op.nombre)}</span>`, iconSize: [op.tamSimbolo * 2 + 6, op.tamSimbolo * 2 + 6], iconAnchor: [op.tamSimbolo + 3, op.tamSimbolo + 3] });
  const marca = L.marker(punto, { icon: icono(), keyboard: false }).addTo(mapa);
  const pintarMarca = () => { marca.setIcon(icono()); const cv = marca.getElement() && marca.getElement().querySelector('canvas'); if (cv) dibujarSimbolo(cv.getContext('2d'), op.simbolo, cv.width / 2, cv.height / 2, op.tamSimbolo, op.color); };
  pintarMarca();
  mapa.on('click', e => { op.punto = [e.latlng.lat, e.latlng.lng]; marca.setLatLng(e.latlng); });
  return new Promise(resolver => {
    const cerrar = v => { try { localStorage.setItem('mn_croquis_prefs', JSON.stringify({ simbolo: op.simbolo, color: op.color, tamSimbolo: op.tamSimbolo, fuente: op.fuente, tamLetra: op.tamLetra, negrita: op.negrita, colorLetra: op.colorLetra, norte: op.norte })); } catch { /* */ } mapa.remove(); caja.remove(); resolver(v); };
    caja.addEventListener('input', ev => { const k = ev.target.dataset.o; if (!k) return; op[k] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.type === 'number' ? Number(ev.target.value) : ev.target.value; pintarMarca(); });
    caja.addEventListener('change', ev => { const k = ev.target.dataset.o; if (!k) return; op[k] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.type === 'number' ? Number(ev.target.value) : ev.target.value; pintarMarca(); });
    caja.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-c]'); if (!b) return;
      if (b.dataset.c === 'cancelar') return cerrar(null);
      const msg = caja.querySelector('.mn-croquis-msg');
      msg.textContent = 'Dibujando el croquis…'; b.disabled = true;
      try { cerrar(await capturar(mapa, L, op)); }
      catch (e) { console.warn(e); msg.textContent = 'No se pudo dibujar el mapa (sin conexión o el servidor de mapas no lo permite). Sube una imagen del croquis.'; b.disabled = false; }
    });
  });
}
