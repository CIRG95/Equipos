// compartido/deshacer.js — aviso flotante con botón «Deshacer» (5 s).
// Uso: avisarConDeshacer('3 tramos marcados listos', async () => { ...revertir... });
// Sin función de deshacer, es un aviso simple.

let caja = null, timer = null;

export function avisarConDeshacer(texto, alDeshacer) {
  if (!caja || !caja.isConnected) {
    caja = document.createElement('div');
    caja.className = 'sis-deshacer';
    caja.setAttribute('role', 'status');
    document.body.appendChild(caja);
  }
  caja.innerHTML = '<span></span>';
  caja.firstChild.textContent = texto;
  if (alDeshacer) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = 'Deshacer';
    b.addEventListener('click', async () => { caja.hidden = true; clearTimeout(timer); try { await alDeshacer(); } catch (e) { console.error(e); } }, { once: true });
    caja.appendChild(b);
  }
  caja.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { caja.hidden = true; }, alDeshacer ? 6000 : 3500);
}
