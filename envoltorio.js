// envoltorio.js — solo para probar el módulo hoy. En la app global se reemplaza por su menú por rol.
// Se empaqueta junto con compartido/ y modulos/equipos/ en equipos-app.js (script clásico), para que la app
// abra también con doble clic desde la carpeta, igual que Terreno Topografía.
// Entrega al módulo un contenedor, el rol (terreno | rrhh) y la persona que usa la app,
// y fija body[data-modo] = telefono | pc con la misma regla que Terreno Topografía.

import { listarPersonas, guardarPersona } from './compartido/catalogos.js';
import * as Equipos from './modulos/equipos/equipos.js';
import { iniciarPanelNube } from './envoltorio-nube.js';
const { montar, VERSION } = Equipos;
// Puerta de entrada disponible también para scripts clásicos (como los de Terreno Topografía).
window.ModuloEquipos = Equipos;

const selRol = document.getElementById('env-rol');
const selPersona = document.getElementById('env-persona');
const btnModo = document.getElementById('env-modo');
const subtitulo = document.getElementById('env-subtitulo');
const contenedor = document.getElementById('contenedor-modulo');
let montado = null;

const leer = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const escribir = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

// ── Modo de la pantalla (igual que modoApp() de Terreno: automático por ancho y mouse, o elegido) ──
const MODOS = ['auto', 'telefono', 'pc'];
const NOMBRE_MODO = { auto: 'automático', telefono: 'teléfono', pc: 'computador' };
function modoApp() {
  const p = leer('env_modo', 'auto');
  if (p !== 'auto') return p;
  try { return matchMedia('(min-width: 900px) and (pointer: fine)').matches ? 'pc' : 'telefono'; } catch { return 'telefono'; }
}
function aplicarModo() {
  const m = modoApp();
  document.body.dataset.modo = m;
  document.getElementById('env-version').textContent = `v${VERSION}${m === 'pc' ? ' · PC' : ''}`;
  btnModo.title = `Modo: ${NOMBRE_MODO[leer('env_modo', 'auto')]} (toca para cambiar)`;
}
btnModo.addEventListener('click', () => {
  const actual = leer('env_modo', 'auto');
  const sig = MODOS[(MODOS.indexOf(actual) + 1) % MODOS.length];
  escribir('env_modo', sig);
  aplicarModo();
  avisoModo(sig);
});
function avisoModo(m) {
  const t = document.createElement('div');
  t.textContent = `Modo ${NOMBRE_MODO[m]}`;
  t.style.cssText = 'position:fixed;top:90px;left:50%;transform:translateX(-50%);background:#16232B;color:#fff;padding:8px 14px;border-radius:12px;font-size:13px;z-index:90';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1400);
}
addEventListener('resize', aplicarModo);
addEventListener('hashchange', () => { if (/equipo=/.test(location.hash)) montarModulo(); });

// ── Rol y persona ──
async function cargarPersonas(seleccionar) {
  const personas = await listarPersonas();
  selPersona.innerHTML = '<option value="">Sin persona</option>' +
    personas.map(p => `<option value="${p.id}">${p.nombre.replace(/</g, '&lt;')}</option>`).join('');
  selPersona.value = seleccionar && personas.some(p => p.id === seleccionar) ? seleccionar : '';
}

function montarModulo() {
  if (montado) montado.desmontar();
  const nombre = selPersona.selectedOptions[0]?.textContent || 'Sin persona';
  subtitulo.textContent = `${selRol.value === 'rrhh' ? 'RRHH' : 'Terreno'} · ${nombre}`;
  // #equipo=<id> en la dirección (lo que trae la etiqueta QR) abre directo la ficha de ese equipo.
  const m = location.hash.match(/equipo=([\w-]+)/);
  montado = montar(contenedor, { rol: selRol.value, personaId: selPersona.value || null, equipoInicial: m ? m[1] : null });
  if (m) history.replaceState(null, '', location.pathname + location.search); // se usa una vez
}

async function arrancar() {
aplicarModo();
selRol.value = leer('env_rol', 'terreno');
await cargarPersonas(leer('env_persona', ''));

selRol.addEventListener('change', () => { escribir('env_rol', selRol.value); montarModulo(); });
selPersona.addEventListener('change', () => { escribir('env_persona', selPersona.value); montarModulo(); });
document.getElementById('env-nueva-persona').addEventListener('click', async () => {
  const nombre = prompt('Nombre de la persona');
  if (!nombre) return;
  const cargo = prompt('Cargo (geomensor, topógrafo, piloto, RRHH…)', '') || '';
  const p = await guardarPersona({ nombre: nombre.trim(), cargo: cargo.trim() });
  escribir('env_persona', p.id);
  await cargarPersonas(p.id);
  montarModulo();
});

montarModulo();
document.title = `Equipos v${VERSION} · prueba`;

// Nube: al llegar datos de otro dispositivo se recargan las personas y se refresca el módulo.
iniciarPanelNube({
  pastilla: document.getElementById('env-nube'),
  alLlegarDatos: async () => {
    await cargarPersonas(selPersona.value || leer('env_persona', ''));
    if (montado && montado.refrescar) montado.refrescar();
  },
});
window.__equiposCargado = true;
}

arrancar().catch(err => {
  console.error(err);
  contenedor.innerHTML = `<div class="eq-error" style="margin:16px">No se pudo iniciar el módulo: ${String(err.message || err).replace(/</g, '&lt;')}</div>`;
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker no registrado:', err));
}
