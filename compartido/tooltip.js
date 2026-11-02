// compartido/tooltip.js — globo de información al pasar el mouse o enfocar un elemento con data-tip.
// Uso: const quitar = activarTooltips(raiz, el => '<b>Título</b>\nTexto');  (devuelve html o '' para no mostrar)
// Un solo globo para toda la app (position: fixed), así no lo corta un contenedor con scroll.

let globo = null;
function crearGlobo() {
  if (globo && globo.isConnected) return globo;
  globo = document.createElement('div');
  globo.className = 'sis-tip';
  globo.setAttribute('role', 'tooltip');
  globo.hidden = true;
  document.body.appendChild(globo);
  return globo;
}

export function ocultarTooltip() { if (globo) globo.hidden = true; }

export function mostrarTooltip(el, html) {
  const g = crearGlobo();
  if (!html) { g.hidden = true; return; }
  g.innerHTML = html;
  g.hidden = false;
  const r = el.getBoundingClientRect(), w = g.offsetWidth, h = g.offsetHeight;
  const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8));
  let y = r.bottom + 8; if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 8);
  g.style.left = `${x}px`; g.style.top = `${y}px`;
}

export function activarTooltips(raiz, obtenerHtml) {
  const sobre = ev => { const el = ev.target.closest('[data-tip]'); if (el && raiz.contains(el)) mostrarTooltip(el, obtenerHtml(el)); else ocultarTooltip(); };
  const fuera = () => ocultarTooltip();
  raiz.addEventListener('mouseover', sobre);
  raiz.addEventListener('focusin', sobre);
  raiz.addEventListener('mouseleave', fuera);
  addEventListener('scroll', fuera, true);
  return () => { raiz.removeEventListener('mouseover', sobre); raiz.removeEventListener('focusin', sobre); raiz.removeEventListener('mouseleave', fuera); removeEventListener('scroll', fuera, true); ocultarTooltip(); };
}
