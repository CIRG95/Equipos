// modulos/monografias/ajuste.js — «Ajustar encuadre» de una imagen de la monografía (v0.9), igual que en la app de Terreno:
// llenar (recorta) o entera (con márgenes), zoom, mover (arrastrando o con deslizadores) y girar de a 90°.
// Guarda el mismo objeto que Terreno ({ modo, zoom, ox, oy, giro }), que el PDF (pieza-terreno.js) ya respeta.

import { escapar as esc } from '../../compartido/util.js';
import { calcRectImagen, cargarImagenEl } from './pieza-terreno.js';

const BASE = { modo: 'llenar', zoom: 1, ox: 0, oy: 0, giro: 0 };

/** Coloca la imagen dentro de su recuadro (px) como quedará en el PDF. img debe estar dentro de un recuadro con overflow:hidden. */
export function colocarImagen(img, nat, PW, PH, aj) {
  const giro = (((aj.giro || 0) % 360) + 360) % 360, swap = giro === 90 || giro === 270;
  const r = calcRectImagen(swap ? nat.h : nat.w, swap ? nat.w : nat.h, PW, PH, aj);
  const dw = swap ? r.h : r.w, dh = swap ? r.w : r.h;
  Object.assign(img.style, { position: 'absolute', maxWidth: 'none', width: dw + 'px', height: dh + 'px', left: (r.x + r.w / 2 - dw / 2) + 'px', top: (r.y + r.h / 2 - dh / 2) + 'px', transform: `rotate(${giro}deg)` });
  return r;
}

/**
 * Abre el diálogo. { titulo, url, bw, bh (mm del recuadro en el PDF), ajuste, porDefecto } → Promise con el ajuste o null si se cancela.
 */
export function abrirAjuste({ titulo, url, bw, bh, ajuste, porDefecto = 'llenar' }) {
  return new Promise(resolver => {
    const aj = { ...BASE, modo: porDefecto, ...(ajuste || {}) };
    const PW = Math.min(520, Math.max(260, window.innerWidth - 80)), PH = Math.max(60, Math.round(PW * bh / bw));
    const capa = document.createElement('div');
    capa.className = 'mn-modal';
    capa.setAttribute('role', 'dialog'); capa.setAttribute('aria-modal', 'true'); capa.setAttribute('aria-label', 'Ajustar encuadre');
    capa.innerHTML = `<div class="mn-modal-caja mn-aj">
      <div class="sis-cab"><h2>Ajustar encuadre · ${esc(titulo || '')}</h2><button class="sis-btn chico" data-aj="cancelar">Cerrar</button></div>
      <p class="sis-tenue">Así se verá en el PDF (${Math.round(bw)} × ${Math.round(bh)} mm). Arrastra la imagen para moverla.</p>
      <div class="mn-aj-caja" style="width:${PW}px; height:${PH}px"><img alt="" draggable="false"></div>
      <div class="mn-aj-modos"><button type="button" class="sis-btn chico" data-aj-modo="llenar">Llenar (recorta)</button><button type="button" class="sis-btn chico" data-aj-modo="ajustar">Entera (con márgenes)</button></div>
      <label class="sis-campo"><span>Zoom: <b data-aj-txt>100%</b></span><input type="range" min="1" max="4" step="0.05" data-aj-r="zoom"></label>
      <div class="mn-aj-fila"><label class="sis-campo"><span>Mover ← →</span><input type="range" min="-1" max="1" step="0.01" data-aj-r="ox"></label><label class="sis-campo"><span>Mover ↑ ↓</span><input type="range" min="-1" max="1" step="0.01" data-aj-r="oy"></label></div>
      <div class="sis-acciones"><button type="button" class="sis-btn chico" data-aj="giro-i">↺ Girar</button><button type="button" class="sis-btn chico" data-aj="giro-d">↻ Girar</button><button type="button" class="sis-btn chico" data-aj="reset">Restablecer</button></div>
      <div class="sis-acciones mn-aj-pie"><button type="button" class="sis-btn" data-aj="cancelar">Cancelar</button><button type="button" class="sis-btn primario" data-aj="aplicar">Aplicar</button></div>
    </div>`;
    document.body.appendChild(capa);
    const $ = s => capa.querySelector(s), img = $('img'), caja = $('.mn-aj-caja');
    let nat = null, rect = null;
    function pintar() {
      if (!nat) return;
      rect = colocarImagen(img, nat, PW, PH, aj);
      capa.querySelectorAll('[data-aj-modo]').forEach(b => b.classList.toggle('primario', b.dataset.ajModo === aj.modo));
      $('[data-aj-r="zoom"]').value = aj.zoom; $('[data-aj-r="ox"]').value = aj.ox; $('[data-aj-r="oy"]').value = aj.oy;
      $('[data-aj-txt]').textContent = Math.round(aj.zoom * 100) + '%';
    }
    const cerrar = valor => { capa.remove(); document.removeEventListener('keydown', tecla); resolver(valor); };
    const tecla = ev => { if (ev.key === 'Escape') cerrar(null); };
    document.addEventListener('keydown', tecla);
    cargarImagenEl(url).then(im => { nat = { w: im.naturalWidth, h: im.naturalHeight }; img.src = url; pintar(); }).catch(() => { caja.innerHTML = '<p class="sis-tenue" style="padding:12px">No se pudo cargar la imagen.</p>'; });
    capa.addEventListener('input', ev => { const k = ev.target.dataset.ajR; if (k) { aj[k] = parseFloat(ev.target.value); pintar(); } });
    capa.addEventListener('click', ev => {
      const m = ev.target.closest('[data-aj-modo]'); if (m) { aj.modo = m.dataset.ajModo; pintar(); return; }
      const b = ev.target.closest('[data-aj]'); if (!b) { if (ev.target === capa) cerrar(null); return; }
      const a = b.dataset.aj;
      if (a === 'cancelar') cerrar(null);
      else if (a === 'aplicar') cerrar({ ...aj });
      else if (a === 'giro-i') { aj.giro = ((aj.giro || 0) + 270) % 360; pintar(); }
      else if (a === 'giro-d') { aj.giro = ((aj.giro || 0) + 90) % 360; pintar(); }
      else if (a === 'reset') { Object.assign(aj, BASE, { modo: porDefecto }); pintar(); }
    });
    let arrastre = null;
    caja.addEventListener('pointerdown', ev => { arrastre = { x: ev.clientX, y: ev.clientY, ox: aj.ox, oy: aj.oy }; caja.setPointerCapture(ev.pointerId); caja.classList.add('arrastrando'); });
    caja.addEventListener('pointermove', ev => {
      if (!arrastre || !rect) return;
      if (rect.sx > 0.5) aj.ox = Math.min(1, Math.max(-1, arrastre.ox + (ev.clientX - arrastre.x) / rect.sx));
      if (rect.sy > 0.5) aj.oy = Math.min(1, Math.max(-1, arrastre.oy + (ev.clientY - arrastre.y) / rect.sy));
      pintar();
    });
    const fin = () => { arrastre = null; caja.classList.remove('arrastrando'); };
    caja.addEventListener('pointerup', fin); caja.addEventListener('pointercancel', fin);
  });
}
