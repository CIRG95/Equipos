// app/vistas-config.js — Configuración del Sistema (v0.16): botón de engranaje del encabezado, ruta #/configuracion.
// Reúne lo que antes estaba al final de «Personas»: nombre y color de la empresa, vinculación de teléfonos con la
// app de Terreno, modo de pantalla, nube y versión. «Personas» queda solo para la gestión de personal.

import { escapar as esc, cargarScript, leerTexto as leerLS, fechaHoraLegible } from '../compartido/util.js';
import { estado as estadoNube } from '../compartido/nube.js';
import { listarPersonas } from '../compartido/catalogos.js';
import { resolverUrlTerreno } from './url-terreno.js';
import { COLORES_MARCA, NOMBRE_ROL_PERSONA } from './catalogo.js';
import { VERSION_SISTEMA, MODULOS_INCLUIDOS } from './version.js';
import { vacio } from './vistas-ui.js';
import { obtener } from '../compartido/almacen.js';

const LETRAS_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const nuevoCodigo = () => Array.from({ length: 6 }, () => LETRAS_CODIGO[Math.floor(Math.random() * LETRAS_CODIGO.length)]).join('');
export const urlTerreno = () => resolverUrlTerreno(leerLS('env_terreno_url'), location.href);

// Sin usuarios todavía: cada persona tiene un código corto. El QR abre la app de Terreno con la carpeta de la nube
// (?carpeta=) y el código (#vincular=); la app carga el perfil de la persona: sus proyectos y sus equipos en terreno.
async function tarjetaVincular(p) {
  if (!p) return '';
  const n = estadoNube();
  const u = new URL(urlTerreno().split('#')[0]);
  if (n.carpetaId) u.searchParams.set('carpeta', n.carpetaId);
  const enlace = `${u.toString()}#vincular=${p.codigoVinculo}`;
  let qr = '<p class="sis-tenue">No se pudo generar el código QR (falta vendor/qrcode.js).</p>';
  try {
    if (!globalThis.qrcode) await cargarScript('vendor/qrcode.js');
    const q = globalThis.qrcode(0, 'M'); q.addData(enlace); q.make();
    qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
  } catch (e) { console.warn(e); }
  return `<div class="sis-vincular"><div class="sis-cab"><h3>Vincular el teléfono de ${esc(p.nombre)}</h3><button type="button" class="sis-btn chico" data-accion="cerrar-vincular">Cerrar</button></div>
    <div class="sis-vincular-cuerpo">
      <div class="sis-qr" role="img" aria-label="Código QR para vincular la app de Terreno">${qr}</div>
      <div>
        <p>Escanee el código con la cámara del teléfono. Se abre la app de Terreno vinculada a <b>${esc(p.nombre)}</b>: sus proyectos, sus equipos en terreno, sus gastos y los avisos de equipos.</p>
        <p>Si el código no se puede leer, escriba en la app de Terreno:</p>
        <p class="sis-codigo">${esc(p.codigoVinculo)}</p>
        ${n.carpetaId ? '<p class="sis-tenue">El código incluye la carpeta de la nube: el teléfono descarga los datos al conectarse con Google.</p>' : '<div class="sis-aviso-linea">La nube no está conectada en este equipo: el código funciona solo en este mismo navegador. Conecte la nube para vincular otro teléfono.</div>'}
        <div class="sis-acciones"><button type="button" class="sis-btn chico" data-accion="nuevo-codigo" data-id="${esc(p.id)}">Cambiar código</button></div>
      </div>
    </div></div>`;
}

export async function configuracion(ctx) {
  const personas = await listarPersonas();
  const gestiona = ctx.rol !== 'terreno';
  const n = estadoNube();
  const modo = leerLS('env_modo', 'auto');
  const urlGuardada = leerLS('env_terreno_url', '');
  return `<div class="sis-cab"><div><h1>Configuración</h1><span class="sis-tenue">Ajustes del Sistema en este equipo y vinculación con la app de Terreno.</span></div></div>
    <div class="cfg-grilla">
      <section class="sis-tarjeta" id="empresa"><h2>Empresa</h2>
        <form class="sis-form" data-form="empresa">
          <label class="sis-campo"><span>Nombre que aparece en el encabezado</span><input name="nombre" value="${esc(ctx.marca.nombre)}" maxlength="40" ${gestiona ? '' : 'disabled'}></label>
          <div class="sis-campo"><span>Color de la marca</span><div class="sis-colores">${COLORES_MARCA.map(([c, t]) => `<label class="sis-color"><input type="radio" name="color" value="${c}" ${ctx.marca.color === c ? 'checked' : ''} ${gestiona ? '' : 'disabled'}><i style="background:${c}"></i>${t}</label>`).join('')}</div></div>
          ${gestiona ? '<div class="sis-acciones"><button class="sis-btn primario">Guardar</button></div><p class="sis-tenue">Se guarda para todos los equipos que sincronizan con la misma nube.</p>' : '<p class="sis-tenue">El nombre y el color los define Administración o Jefatura.</p>'}
        </form></section>

      <section class="sis-tarjeta"><h2>Pantalla</h2>
        <p class="sis-tenue">El modo automático usa la vista de computador en pantallas anchas con mouse y la de teléfono en el resto.</p>
        <div class="sis-vistas" role="tablist" aria-label="Modo de pantalla">${[['auto', 'Automático'], ['telefono', 'Teléfono'], ['pc', 'Computador']].map(([k, t]) => `<button type="button" role="tab" aria-selected="${modo === k}" class="${modo === k ? 'activo' : ''}" data-accion="modo-pantalla" data-m="${k}">${t}</button>`).join('')}</div>
      </section>

      <section class="sis-tarjeta cfg-ancha" id="vinculacion"><h2>Vinculación con la app de Terreno</h2>
        <p class="sis-tenue">Cada persona vincula su teléfono una sola vez. Desde entonces, lo que registra en terreno (jornadas, monografías, gastos, avisos de equipos) llega a este Sistema, y la app conserva la conexión aunque trabaje sin señal.</p>
        ${ctx.estado.vincular ? await tarjetaVincular(personas.find(x => x.id === ctx.estado.vincular)) : ''}
        ${personas.length ? `<div class="sis-lista">${personas.map(x => `<div class="sis-fila">
            <span class="sis-fila-txt"><b>${esc(x.nombre)}</b><span class="sis-tenue">${esc(x.cargo || (x.roles || []).map(r => NOMBRE_ROL_PERSONA[r] || r).join(', ') || 'Sin cargo')}</span></span>
            <span class="sis-chips">${x.codigoVinculo ? '<span class="sis-chip verde">Con código</span>' : '<span class="sis-chip gris">Sin código</span>'}
            <button type="button" class="sis-btn chico" data-accion="vincular" data-id="${esc(x.id)}">${x.codigoVinculo ? 'Ver código QR' : 'Generar código QR'}</button></span></div>`).join('')}</div>`
          : vacio('Aún no hay personas. Agréguelas en Personas.')}
        <form class="sis-form cfg-url" data-form="terreno-url"><label class="sis-campo"><span>Dirección de la app de Terreno</span><input name="url" value="${esc(urlGuardada.includes('paquete-conexion/ejemplo.html') ? '' : urlGuardada)}" placeholder="${esc(urlTerreno())}"></label>
          <div class="sis-acciones"><button class="sis-btn chico">Guardar dirección</button></div>
          <p class="sis-tenue">Déjela vacía para usar la app de Terreno publicada junto al Sistema (carpeta terreno/).</p></form>
      </section>

      <section class="sis-tarjeta"><h2>Nube</h2>
        <div class="sis-datos">
          <div class="sis-dato"><span>Proveedor</span><b>${esc(n.proveedor)}</b></div>
          <div class="sis-dato"><span>Estado</span><b>${n.conectado ? 'Conectada' : n.configurado ? 'Sesión por renovar' : 'Sin configurar'}</b></div>
          <div class="sis-dato"><span>Carpeta</span><b>${esc(n.carpetaNombre || '—')}</b></div>
          <div class="sis-dato"><span>Última sincronización</span><b>${n.ultimaSync ? esc(fechaHoraLegible(n.ultimaSync)) : '—'}</b></div>
        </div>
        ${n.pendiente ? '<p class="sis-aviso-linea">Hay cambios de este equipo que aún no se suben.</p>' : ''}
        <div class="sis-acciones"><button type="button" class="sis-btn chico" data-accion="abrir-nube">Abrir panel de la nube</button></div>
        <p class="sis-tenue">Los datos se guardan primero en este equipo y se sincronizan cuando hay conexión.</p>
      </section>

      ${await tarjetaTiempos()}

      <section class="sis-tarjeta"><h2>Acerca del Sistema</h2>
        <div class="sis-datos"><div class="sis-dato"><span>Versión</span><b>v${VERSION_SISTEMA}</b></div><div class="sis-dato"><span>Perfil en uso</span><b>${esc(ctx.nombreRol)}</b></div></div>
        <p class="sis-tenue">${esc(MODULOS_INCLUIDOS)}</p>
      </section>
    </div>`;
}

/** v0.18 · Parámetros técnicos: la tabla de tiempos de ocupación GNSS es norma de la empresa (antes estaba en Planificación). */
async function tarjetaTiempos() {
  const cfg = (await obtener('admin_config', 'general').catch(() => null)) || {};
  const tabla = cfg.tablaTiempos && cfg.tablaTiempos.length ? cfg.tablaTiempos : [];
  const fila = (t = {}) => `<tr><td><input name="km" type="number" min="0" step="0.1" value="${esc(t.hastaKm ?? '')}" aria-label="Vector hasta (km)"></td><td><input name="min" type="number" min="0" step="1" value="${esc(t.minutos ?? '')}" aria-label="Tiempo mínimo (min)"></td></tr>`;
  return `<section class="sis-tarjeta" id="tiempos"><h2>Parámetros técnicos · tiempos de ocupación GNSS</h2>
    <p class="sis-tenue">Tiempos mínimos de observación estática según la longitud del vector (Manual de Carreteras, Volumen 2). Las redes de PR de todos los proyectos calculan con ella la duración de cada sesión.</p>
    <form class="sis-form" data-form="tabla-tiempos"><div class="sis-tabla-scroll"><table class="sis-tabla"><thead><tr><th>Vector hasta (km)</th><th>Tiempo mínimo (min)</th></tr></thead><tbody>
      ${tabla.map(fila).join('')}${fila()}</tbody></table></div>
      <p class="sis-tenue">Complete la última fila para agregar un rango; deje vacías las casillas de un rango para quitarlo.</p>
      <div class="sis-acciones"><button class="sis-btn primario">Guardar tabla</button></div></form></section>`;
}
