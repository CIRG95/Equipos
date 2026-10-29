// app/nube-panel.js — panel «☁ Nube» del Sistema (copiado del envoltorio de Equipos 0.1f).
// Usa compartido/nube.js; los módulos no saben nada de la nube.

import * as nube from '../compartido/nube.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hora = iso => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }); };
const sesion = { leer: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, escribir: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* */ } } };

export function iniciarPanelNube({ pastilla, alLlegarDatos }) {
  const config = window.TOPOLAND_CONFIG || {};
  nube.configurar({ clienteId: config.googleClientId || undefined, api: config.driveApi || undefined });
  nube.iniciar();
  window.TopolandNube = nube; // para revisar desde la consola

  // ?carpeta=<id> en la dirección = invitación de un compañero
  const url = new URL(location.href);
  if (url.searchParams.get('carpeta')) {
    sesion.escribir('topoland_invitacion', url.searchParams.get('carpeta'));
    url.searchParams.delete('carpeta');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  const dlg = document.createElement('dialog');
  dlg.className = 'nube-panel';
  document.body.appendChild(dlg);
  let carpetasEncontradas = null;
  let ocupado = false;
  let mensaje = null;

  function textoPastilla(e) {
    if (!e.configurado || !e.carpetaId) return '☁ Conectar nube';
    if (!e.conectado) return '☁ Reconectar';
    if (e.sincronizando) return '☁ Sincronizando…';
    if (e.error) return '☁ Error';
    if (e.pendiente) return '☁ Pendiente';
    return `☁ Al día · ${e.ultimaSync ? new Date(e.ultimaSync).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}`;
  }

  nube.alEstado(e => {
    pastilla.textContent = textoPastilla(e);
    pastilla.dataset.estado = e.error ? 'error' : (e.conectado && e.carpetaId ? 'ok' : 'off');
    if (dlg.open && !ocupado) pintar();
  });
  nube.alDatosRemotos(r => { if (alLlegarDatos) alLlegarDatos(r); });

  async function accion(fn, okTexto) {
    ocupado = true; mensaje = null; pintar();
    try { await fn(); if (okTexto) mensaje = { tipo: 'ok', texto: okTexto }; }
    catch (e) { console.warn(e); mensaje = { tipo: 'error', texto: e.message }; }
    finally { ocupado = false; pintar(); }
  }

  function pintar() {
    const e = nube.estado();
    const invitacion = sesion.leer('topoland_invitacion');
    const http = /^https?:/.test(location.protocol);
    let cuerpo = '';

    if (!http) {
      cuerpo = `<p class="np-aviso">Para conectar con Google, abre la app desde su dirección web (GitHub Pages). Abierta con doble clic desde la carpeta, Google no permite iniciar sesión.</p>`;
    } else if (!e.configurado) {
      cuerpo = `<p>Falta el <b>Client ID</b> de tu proyecto de Google Cloud (el que termina en <code>.apps.googleusercontent.com</code>). Lo ideal es escribirlo una vez en <code>config.js</code>; también puedes pegarlo aquí (queda solo en este dispositivo).</p>
        <form data-np="cliente"><input name="cliente" placeholder="1234…apps.googleusercontent.com" required><button class="np-btn primario">Guardar</button></form>`;
    } else if (!e.conectado) {
      cuerpo = `<p>${e.carpetaId ? `Carpeta: <b>${esc(e.carpetaNombre)}</b>. La conexión con Google dura una hora; vuelve a conectar para seguir sincronizando.` : 'Conecta tu cuenta de Google para guardar y compartir los datos en Drive.'}</p>
        <button class="np-btn primario" data-np="conectar">${e.carpetaId ? 'Reconectar con Google' : 'Conectar con Google'}</button>
        ${invitacion && !e.carpetaId ? '<p class="np-ok">Te invitaron a una carpeta compartida: después de conectar, podrás usarla.</p>' : ''}`;
    } else if (!e.carpetaId) {
      cuerpo = `${invitacion ? `<div class="np-caja"><b>Te invitaron a una carpeta compartida</b>
          <label class="np-check"><input type="checkbox" id="np-limpiar" checked> Empezar desde la nube (borra los datos de prueba de este dispositivo, para no duplicar equipos)</label>
          <button class="np-btn primario" data-np="invitacion">Usar la carpeta compartida</button></div>` : ''}
        <div class="np-caja"><b>Crear una carpeta nueva</b><p>Se crea «${esc(nube.NOMBRE_CARPETA_PRUEBA)}» en tu Drive. Después la compartes con tu compañero.</p>
          <button class="np-btn ${invitacion ? '' : 'primario'}" data-np="crear">Crear carpeta</button></div>
        <div class="np-caja"><b>Usar una carpeta que ya existe</b>
          <button class="np-btn" data-np="buscar">Buscar «${esc(nube.NOMBRE_CARPETA_PRUEBA)}»</button>
          ${carpetasEncontradas ? (carpetasEncontradas.length ? `<ul class="np-lista">${carpetasEncontradas.map(c => `<li><span>${esc(c.name)}</span> <button class="np-btn chico" data-np="usar" data-id="${esc(c.id)}">Usar</button></li>`).join('')}</ul>` : '<p class="np-tenue">No encontré carpetas con ese nombre a las que tengas acceso.</p>') : ''}
          <form data-np="enlace"><input name="enlace" placeholder="o pega el enlace de la carpeta de Drive" required><button class="np-btn">Usar</button></form>
          <label class="np-check"><input type="checkbox" id="np-limpiar2"> Empezar desde la nube (borra los datos de prueba de este dispositivo)</label></div>`;
    } else {
      const inv = nube.enlaceInvitacion();
      cuerpo = `<dl class="np-datos">
          <div><dt>Carpeta</dt><dd><a href="https://drive.google.com/drive/folders/${esc(e.carpetaId)}" target="_blank" rel="noopener">${esc(e.carpetaNombre)} ↗</a></dd></div>
          <div><dt>Última sincronización</dt><dd>${hora(e.ultimaSync)}${e.ultimoResumen ? ` · ${e.ultimoResumen.recibidos} recibidos${e.ultimoResumen.archivosSubidos ? `, ${e.ultimoResumen.archivosSubidos} archivos subidos` : ''}` : ''}</dd></div>
          <div><dt>Estado</dt><dd>${e.sincronizando ? 'Sincronizando…' : e.error ? `<span class="np-error-txt">${esc(e.error)}</span>` : e.pendiente ? 'Hay cambios por subir' : 'Al día'}</dd></div>
        </dl>
        <button class="np-btn primario" data-np="sincronizar">Sincronizar ahora</button>
        <div class="np-caja"><b>Invitar a tu compañero</b>
          <ol><li>En Drive, comparte la carpeta con su cuenta de Google como <b>Editor</b>.</li>
          <li>Envíale este enlace; al abrirlo y conectar, usará la misma carpeta.</li></ol>
          <div class="np-enlace"><input readonly value="${esc(inv)}"><button class="np-btn chico" data-np="copiar">Copiar</button></div></div>
        <div class="np-pie"><button class="np-btn chico" data-np="cambiar">Cambiar de carpeta</button><button class="np-btn chico" data-np="desconectar">Desconectar</button></div>`;
    }
    dlg.innerHTML = `<div class="np-cab"><b>☁ Nube · Google Drive</b><button class="np-x" data-np="cerrar" aria-label="Cerrar">✕</button></div>
      ${mensaje ? `<p class="np-msg ${mensaje.tipo}">${esc(mensaje.texto)}</p>` : ''}
      ${ocupado ? '<p class="np-tenue">Un momento…</p>' : ''}
      <div class="np-cuerpo"${ocupado ? ' inert' : ''}>${cuerpo}</div>
      <p class="np-tenue np-nota">Los datos se guardan primero en este dispositivo y se sincronizan solos cada minuto y medio si hay conexión. Cada dispositivo escribe su propio archivo en <code>datos/</code>; los PDF y fotos quedan ordenados en carpetas (<code>Equipos/</code>).</p>`;
  }

  dlg.addEventListener('click', ev => {
    const b = ev.target.closest('[data-np]');
    if (!b || b.tagName === 'FORM') { if (ev.target === dlg) dlg.close(); return; }
    const limpiar = () => !!(dlg.querySelector('#np-limpiar2') || {}).checked;
    switch (b.dataset.np) {
      case 'cerrar': dlg.close(); break;
      case 'conectar': accion(() => nube.conectar(), 'Conectado con Google'); break;
      case 'crear': accion(() => nube.crearCarpeta(), 'Carpeta creada y sincronizada'); break;
      case 'buscar': accion(async () => { carpetasEncontradas = await nube.buscarCarpetas(); }); break;
      case 'usar': accion(() => nube.usarCarpeta(b.dataset.id, { empezarDesdeNube: limpiar() }), 'Carpeta conectada y sincronizada'); break;
      case 'invitacion': {
        const borrar = !!(dlg.querySelector('#np-limpiar') || {}).checked;
        if (borrar && !confirm('Se borrarán los equipos y datos de prueba de ESTE dispositivo y se bajarán los de la carpeta compartida. ¿Seguir?')) return;
        accion(async () => { await nube.usarCarpeta(sesion.leer('topoland_invitacion'), { empezarDesdeNube: borrar }); sesion.escribir('topoland_invitacion', null); }, 'Listo: ya trabajas en la carpeta compartida');
        break;
      }
      case 'sincronizar': accion(() => nube.sincronizar(), 'Sincronizado'); break;
      case 'copiar': {
        const inp = dlg.querySelector('.np-enlace input');
        (navigator.clipboard ? navigator.clipboard.writeText(inp.value) : Promise.reject()).then(() => { mensaje = { tipo: 'ok', texto: 'Enlace copiado' }; pintar(); })
          .catch(() => { inp.select(); document.execCommand('copy'); });
        break;
      }
      case 'cambiar':
        if (!confirm('¿Dejar de usar esta carpeta? Los datos de este dispositivo no se borran.')) return;
        nube.desconectar({ olvidarCarpeta: true }); carpetasEncontradas = null; mensaje = null; pintar(); break;
      case 'desconectar': nube.desconectar(); mensaje = { tipo: 'ok', texto: 'Desconectado. Los datos siguen en este dispositivo.' }; pintar(); break;
    }
  });

  dlg.addEventListener('submit', ev => {
    ev.preventDefault();
    const f = ev.target;
    if (f.dataset.np === 'cliente') { nube.configurar({ clienteId: f.cliente.value }); mensaje = { tipo: 'ok', texto: 'Client ID guardado' }; pintar(); }
    if (f.dataset.np === 'enlace') {
      const limpiar = !!(dlg.querySelector('#np-limpiar2') || {}).checked;
      accion(() => nube.usarCarpeta(f.enlace.value, { empezarDesdeNube: limpiar }), 'Carpeta conectada y sincronizada');
    }
  });

  pastilla.addEventListener('click', () => { mensaje = null; pintar(); dlg.showModal(); });
  if (sesion.leer('topoland_invitacion') && !nube.estado().carpetaId) setTimeout(() => { pintar(); dlg.showModal(); }, 400);
}
