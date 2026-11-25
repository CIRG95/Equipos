// modulos/monografias/mapa-comun.js — v0.23 · Mapa común del proyecto.
// Muestra TODOS los puntos (PR) sobre un mapa y deja fijar, una sola vez, el encuadre, el símbolo, el color y los tamaños.
// Ese encuadre y estilo se aplican a todas las fichas: cada ficha dibuja solo su punto, buscado por el nombre de la hoja
// (ver croquisConEncuadre en croquis.js). Es un controlador que se acopla a un lugar de la pantalla y sobrevive a los
// re-dibujos de la vista (el mapa conserva su estado).

import { cargarScript, escapar as esc, leerLS } from '../../compartido/util.js';
import { FONDOS, SIMBOLOS, FUENTES, dibujarSimbolo, ESTILO_BASE } from './croquis.js';

export const ANCHO_MAPA = 640;

/**
 * { puntos: [{nombre, lat, lon}], cfg: encuadre guardado o null, aspecto: ancho/alto del recuadro del croquis, alCambiar }
 * → { el, montar(destino), ponerPuntos(p), ajustar(), config(), destruir() }
 */
export async function crearMapaComun({ puntos = [], cfg = null, aspecto = 1.6, alCambiar = () => {} } = {}) {
  if (!window.L) await cargarScript('vendor/leaflet/leaflet.js');
  const L = window.L, alto = Math.round(ANCHO_MAPA / (aspecto || 1.6));
  const prefs = leerLS('mn_croquis_prefs', {});
  const est = { ...ESTILO_BASE, ...prefs, ...((cfg && cfg.estilo) || {}) };
  let pts = puntos.slice(), mapa = null, capa = null, fondo = null, huboEncuadre = !!cfg;
  const el = document.createElement('div');
  el.className = 'mn-mc';
  const opciones = (lista, actual) => lista.map(([k, t]) => `<option value="${esc(k)}" ${actual === k ? 'selected' : ''}>${esc(t)}</option>`).join('');
  el.innerHTML = `
    <div class="mn-mc-mapa-caja"><div class="mn-mc-mapa" style="width:${ANCHO_MAPA}px; height:${alto}px"></div></div>
    <p class="sis-tenue mn-mc-msg" role="status"></p>
    <div class="mn-mc-ctl">
      <div class="mn-mc-grupo"><b>Encuadre</b>
        <button type="button" class="sis-btn chico" data-mc="ajustar">Ajustar a todos los puntos</button>
        <label class="sis-campo"><span>Fondo</span><select data-o="fondo">${opciones(Object.entries(FONDOS).map(([k, [t]]) => [k, t]), est.fondo)}</select></label>
        <label class="sis-check"><input type="checkbox" data-o="norte" ${est.norte ? 'checked' : ''}> Flecha de norte</label>
        <label class="sis-check"><input type="checkbox" data-o="escala" ${est.escala ? 'checked' : ''}> Escala gráfica</label></div>
      <div class="mn-mc-grupo"><b>Símbolo</b>
        <label class="sis-campo"><span>Forma</span><select data-o="simbolo">${opciones(SIMBOLOS, est.simbolo)}</select></label>
        <div class="sis-par"><label class="sis-campo"><span>Color</span><input type="color" data-o="color" value="${esc(est.color)}"></label>
          <label class="sis-campo"><span>Tamaño</span><input type="number" min="5" max="30" data-o="tamSimbolo" value="${esc(est.tamSimbolo)}"></label></div></div>
      <div class="mn-mc-grupo"><b>Nombre</b>
        <label class="sis-campo"><span>Tipo de letra</span><select data-o="fuente">${opciones(FUENTES, est.fuente)}</select></label>
        <div class="sis-par"><label class="sis-campo"><span>Alto (px)</span><input type="number" min="8" max="48" data-o="tamLetra" value="${esc(est.tamLetra)}"></label>
          <label class="sis-campo"><span>Color</span><input type="color" data-o="colorLetra" value="${esc(est.colorLetra)}"></label></div>
        <label class="sis-check"><input type="checkbox" data-o="negrita" ${est.negrita ? 'checked' : ''}> Negrita</label>
        <label class="sis-check"><input type="checkbox" data-o="linea" ${est.linea ? 'checked' : ''}> Nombre unido con línea</label></div>
    </div>`;
  const msg = el.querySelector('.mn-mc-msg');
  const d = () => est.tamSimbolo + 16;

  function dibujar() {
    if (!mapa) return;
    capa.clearLayers();
    for (const p of pts) {
      if (!isFinite(p.lat) || !isFinite(p.lon)) continue;
      const t = est.tamSimbolo * 2 + 6;
      const icono = L.divIcon({ className: 'mn-croquis-marca', html: `<canvas width="${t}" height="${t}"></canvas>`, iconSize: [t, t], iconAnchor: [t / 2, t / 2] });
      const m = L.marker([p.lat, p.lon], { icon: icono, keyboard: false, interactive: false }).addTo(capa);
      const cv = m.getElement() && m.getElement().querySelector('canvas'); if (cv) dibujarSimbolo(cv.getContext('2d'), est.simbolo, t / 2, t / 2, est.tamSimbolo, est.color);
      if (p.nombre) {
        const html = `<span style="position:absolute; transform:translateY(-50%); white-space:nowrap; font:${est.negrita ? 'bold ' : ''}${est.tamLetra}px '${est.fuente}', Arial; color:${est.colorLetra}; text-shadow:0 0 3px #000, 0 0 3px #000">${esc(p.nombre)}</span>`;
        L.marker([p.lat, p.lon], { icon: L.divIcon({ className: 'mn-croquis-nombre', html, iconSize: [0, 0], iconAnchor: [-(d() + 4), d()] }), keyboard: false, interactive: false }).addTo(capa);
      }
    }
    msg.textContent = pts.length ? `${pts.length} punto${pts.length === 1 ? '' : 's'} en el mapa. Mueve y acerca el mapa: lo que ves es lo que saldrá en cada ficha.` : 'Aún no hay puntos con coordenadas. Pega o escribe las coordenadas en la tabla.';
  }
  function ponerFondo() {
    if (fondo) fondo.remove();
    fondo = L.layerGroup((FONDOS[est.fondo] || FONDOS.hibrido)[1].map((u, i) => L.tileLayer(u, { maxZoom: 19, crossOrigin: 'anonymous', attribution: i ? '' : 'Mapa © Esri y sus colaboradores' }))).addTo(mapa);
  }
  function ajustar() {
    const v = pts.filter(p => isFinite(p.lat) && isFinite(p.lon));
    if (!mapa || !v.length) return;
    if (v.length === 1) mapa.setView([v[0].lat, v[0].lon], 16, { animate: false });
    else mapa.fitBounds(L.latLngBounds(v.map(p => [p.lat, p.lon])), { padding: [50, 50], maxZoom: 18, animate: false });
    huboEncuadre = true; alCambiar();
  }
  function iniciar() {
    mapa = L.map(el.querySelector('.mn-mc-mapa'), { zoomControl: true, attributionControl: true, zoomSnap: 1 });
    const v = pts.filter(p => isFinite(p.lat) && isFinite(p.lon));
    if (cfg && cfg.centro) mapa.setView(cfg.centro, cfg.zoom, { animate: false });
    else mapa.setView(v.length ? [v[0].lat, v[0].lon] : [-33.45, -70.66], v.length ? 14 : 5, { animate: false });
    capa = L.layerGroup().addTo(mapa); ponerFondo(); dibujar();
    if (!cfg && v.length) ajustar();
    mapa.on('moveend', () => { huboEncuadre = true; alCambiar(); });
  }
  const leer = ev => { const t = ev.target, k = t.dataset.o; if (!k) return false; est[k] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value; return k; };
  el.addEventListener('input', ev => { if (leer(ev)) { dibujar(); alCambiar(); } });
  el.addEventListener('change', ev => { const k = leer(ev); if (k) { if (k === 'fondo') ponerFondo(); dibujar(); alCambiar(); } });
  el.addEventListener('click', ev => { if (ev.target.closest('[data-mc="ajustar"]')) ajustar(); });

  return {
    el,
    montar(destino) { destino.replaceWith(el); if (!mapa) iniciar(); else mapa.invalidateSize(); },
    ponerPuntos(p) { const primera = !pts.length; pts = p.slice(); dibujar(); if (primera && pts.length && !huboEncuadre) ajustar(); },
    ajustar,
    tienePuntos: () => pts.some(p => isFinite(p.lat) && isFinite(p.lon)),
    config() {
      if (!mapa) return cfg;
      const c = mapa.getCenter();
      return { centro: [c.lat, c.lng], zoom: mapa.getZoom(), ancho: ANCHO_MAPA, alto, aspecto: aspecto || 1.6, estilo: { ...est } };
    },
    destruir() { try { if (mapa) mapa.remove(); } catch { /* */ } el.remove(); mapa = null; },
  };
}
