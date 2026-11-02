// compartido/columnas.js — columnas de una tabla que se mueven arrastrando el título y cambian de ancho
// arrastrando su borde. Funciona con mouse y con el dedo (pointer events).
// Marcado esperado en la cabecera: <span class="sis-th" data-col="id">…<span class="sis-th-borde" data-borde="id"></span></span>
// y un contenedor con scroll horizontal (opciones.caja) donde se dibuja la marca de destino.
// opciones: { caja: () => Element, ancho: id => número, alAncho(id, px), alSoltarAncho(id, px), alMover(id, indiceDestino) }

export function columnasArrastrables(raiz, op) {
  let arr = null;
  const abajo = e => {
    const borde = e.target.closest('[data-borde]');
    if (borde && raiz.contains(borde)) {
      arr = { tipo: 'ancho', id: borde.dataset.borde, x0: e.clientX, w0: op.ancho(borde.dataset.borde), el: borde, w: null };
      borde.classList.add('activo'); e.preventDefault(); return;
    }
    const th = e.target.closest('.sis-th[data-col]');
    if (th && raiz.contains(th) && e.button === 0) arr = { tipo: 'mover', id: th.dataset.col, x0: e.clientX, activo: false, th, destino: -1 };
  };
  const mover = e => {
    if (!arr) return;
    const dx = e.clientX - arr.x0;
    if (arr.tipo === 'ancho') { arr.w = Math.max(44, Math.min(360, Math.round(arr.w0 + dx))); op.alAncho(arr.id, arr.w); return; }
    if (!arr.activo) { if (Math.abs(dx) < 6) return; arr.activo = true; arr.th.classList.add('moviendo'); }
    arr.th.style.transform = `translateX(${dx}px)`;
    const ths = [...raiz.querySelectorAll('.sis-th[data-col]')].filter(x => x !== arr.th);
    let i = ths.findIndex(x => { const r = x.getBoundingClientRect(); return e.clientX < r.left + r.width / 2; });
    if (i < 0) i = ths.length;
    arr.destino = i;
    const caja = op.caja(); if (!caja || !ths.length) return;
    const rc = caja.getBoundingClientRect();
    const ref = i < ths.length ? ths[i].getBoundingClientRect().left : ths[ths.length - 1].getBoundingClientRect().right;
    let m = caja.querySelector('.sis-col-marca');
    if (!m) { m = document.createElement('div'); m.className = 'sis-col-marca'; caja.appendChild(m); }
    m.style.left = `${ref - rc.left + caja.scrollLeft}px`;
    if (e.clientX > rc.right - 40) caja.scrollLeft += 12; else if (e.clientX < rc.left + 40) caja.scrollLeft -= 12;
  };
  const arriba = () => {
    if (!arr) return;
    const a = arr; arr = null;
    if (a.tipo === 'ancho') { a.el.classList.remove('activo'); if (a.w != null && a.w !== a.w0) op.alSoltarAncho(a.id, a.w); return; }
    if (!a.activo) return;
    a.th.classList.remove('moviendo'); a.th.style.transform = '';
    const m = op.caja() && op.caja().querySelector('.sis-col-marca'); if (m) m.remove();
    op.alMover(a.id, a.destino);
  };
  const cancelar = () => { if (arr && arr.th) { arr.th.classList.remove('moviendo'); arr.th.style.transform = ''; } arr = null; };
  raiz.addEventListener('pointerdown', abajo);
  addEventListener('pointermove', mover);
  addEventListener('pointerup', arriba);
  addEventListener('pointercancel', cancelar);
  return () => { raiz.removeEventListener('pointerdown', abajo); removeEventListener('pointermove', mover); removeEventListener('pointerup', arriba); removeEventListener('pointercancel', cancelar); };
}
