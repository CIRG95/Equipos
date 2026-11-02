// app/revision.js — revisa que la instalación publicada esté completa y en la misma versión que la app.
// construir.sh genera version.json con la versión y la lista de archivos que el teléfono guarda sin conexión.
// Si falta un archivo (por ejemplo, se subió la carpeta raíz sin app/, modulos/ o vendor/) o las versiones no calzan,
// muestra un aviso arriba con qué falta. Solo funciona publicada (http/https) y con internet.

export async function revisarInstalacion(versionApp) {
  if (!location.protocol.startsWith('http') || navigator.onLine === false) return null;
  let v;
  try {
    const r = await fetch('version.json', { cache: 'no-store' });
    if (!r.ok) return { texto: 'No se encontró version.json en el sitio: la última subida puede estar incompleta.' };
    v = await r.json();
  } catch { return null; }
  const faltan = [];
  await Promise.all((v.archivos || []).map(async a => {
    try { const x = await fetch(a, { method: 'HEAD', cache: 'no-store' }); if (!x.ok) faltan.push(a.replace(/^\.\//, '')); } catch { /* sin red: no se puede saber */ }
  }));
  if (faltan.length) return { texto: `${faltan.length > 1 ? "Faltan" : "Falta"} ${faltan.length} archivo${faltan.length > 1 ? "s" : ""} en el sitio publicado: ${faltan.slice(0, 4).join(', ')}${faltan.length > 4 ? '…' : ''}. Vuelve a subir la versión completa, con sus carpetas.` };
  if (v.version !== versionApp) return { texto: `El sitio tiene la versión ${v.version} y esta pantalla es la ${versionApp}.`, recargar: true };
  return null;
}

export function mostrarAvisoInstalacion(aviso) {
  if (!aviso) return;
  const el = document.createElement('div');
  el.className = 'sis-aviso-instalacion';
  el.setAttribute('role', 'alert');
  el.innerHTML = `<span></span>${aviso.recargar ? '<button type="button" class="sis-btn chico">Recargar</button>' : ''}<button type="button" class="sis-cerrar" aria-label="Cerrar aviso">✕</button>`;
  el.querySelector('span').textContent = aviso.texto;
  el.addEventListener('click', ev => {
    if (ev.target.closest('.sis-cerrar')) el.remove();
    else if (ev.target.closest('.sis-btn')) location.reload();
  });
  document.body.prepend(el);
}
