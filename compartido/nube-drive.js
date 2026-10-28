// compartido/nube-drive.js — adaptador de Google Drive para compartido/nube.js.
// Mismo método de conexión que Terreno Topografía (Google Identity Services, token en el navegador),
// pero con el permiso «drive» en vez de «drive.file»: es lo que permite que dos personas trabajen en
// la misma carpeta compartida (con «drive.file» cada uno vería solo lo que subió él mismo).
// La app solo lee y escribe dentro de la carpeta elegida.

import { cargarScript } from './util.js';

const SCOPE = 'https://www.googleapis.com/auth/drive';
const CARPETA = 'application/vnd.google-apps.folder';
const URL_GIS = 'https://accounts.google.com/gsi/client';

export function crearAdaptadorDrive({ clienteId, api = 'https://www.googleapis.com' } = {}) {
  let token = null;
  let vence = 0;
  let clienteToken = null;
  let pendientes = [];

  const leerGuardado = () => {
    try {
      const g = JSON.parse(localStorage.getItem('topoland_nube_token') || 'null');
      if (g && g.vence > Date.now()) { token = g.token; vence = g.vence; }
    } catch { /* sin almacenamiento */ }
  };
  const guardarToken = () => { try { localStorage.setItem('topoland_nube_token', JSON.stringify({ token, vence })); } catch { /* */ } };
  leerGuardado();

  function tokenVigente() { return token && Date.now() < vence; }

  /** Pide permiso a Google. Debe llamarse desde un toque del usuario (si no, el navegador bloquea la ventana). */
  async function conectar({ forzarConsentimiento = false } = {}) {
    if (!clienteId) throw new Error('Falta el Client ID de Google (config.js o el panel de nube).');
    if (!/^https?:/.test(location.protocol)) throw new Error('Google solo permite conectar desde una dirección web (GitHub Pages), no con doble clic desde la carpeta.');
    if (!(globalThis.google && google.accounts && google.accounts.oauth2)) await cargarScript(URL_GIS);
    return new Promise((resolver, rechazar) => {
      pendientes.push({ resolver, rechazar });
      if (!clienteToken) {
        clienteToken = google.accounts.oauth2.initTokenClient({
          client_id: clienteId,
          scope: SCOPE,
          callback: resp => {
            const ps = pendientes; pendientes = [];
            if (resp.error) { ps.forEach(p => p.rechazar(new Error(`Google respondió: ${resp.error}`))); return; }
            token = resp.access_token;
            vence = Date.now() + (Number(resp.expires_in) || 3600) * 1000 - 60000;
            guardarToken();
            ps.forEach(p => p.resolver(true));
          },
          error_callback: err => {
            const ps = pendientes; pendientes = [];
            ps.forEach(p => p.rechazar(new Error(err && err.type === 'popup_closed' ? 'Se cerró la ventana de Google sin conectar.' : 'No se pudo abrir la ventana de Google (¿bloqueador de ventanas?).')));
          },
        });
      }
      clienteToken.requestAccessToken({ prompt: forzarConsentimiento ? 'consent' : '' });
    });
  }

  /** Solo para pruebas: usar un token ya obtenido. */
  function usarToken(t, segundos = 3600) { token = t; vence = Date.now() + segundos * 1000; guardarToken(); }

  function desconectar() {
    if (token && globalThis.google && google.accounts && google.accounts.oauth2) { try { google.accounts.oauth2.revoke(token, () => {}); } catch { /* */ } }
    token = null; vence = 0;
    try { localStorage.removeItem('topoland_nube_token'); } catch { /* */ }
  }

  async function pedir(ruta, opciones = {}) {
    if (!tokenVigente()) { const e = new Error('La conexión con Google venció. Toca «Reconectar».'); e.sinToken = true; throw e; }
    const res = await fetch(api + ruta, { ...opciones, headers: { Authorization: `Bearer ${token}`, ...(opciones.headers || {}) } });
    if (res.status === 401) { token = null; vence = 0; const e = new Error('La conexión con Google venció. Toca «Reconectar».'); e.sinToken = true; throw e; }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const e = new Error(`Drive respondió ${res.status}: ${txt.slice(0, 200)}`);
      e.status = res.status;
      throw e;
    }
    return res;
  }

  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const CAMPOS = 'files(id,name,mimeType,modifiedTime,parents)';
  const extra = '&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1000';

  async function buscar(q) {
    const r = await pedir(`/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(CAMPOS)}${extra}`);
    return (await r.json()).files || [];
  }

  async function datosCarpeta(id) {
    const r = await pedir(`/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,capabilities(canAddChildren)&supportsAllDrives=true`);
    return r.json();
  }

  /** Carpetas con ese nombre a las que el usuario tiene acceso (propias o compartidas con él). */
  async function buscarCarpetas(nombre) {
    return buscar(`name='${esc(nombre)}' and mimeType='${CARPETA}' and trashed=false`);
  }

  async function crearCarpeta(nombre, padreId = null) {
    const r = await pedir('/drive/v3/files?supportsAllDrives=true&fields=id,name', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombre, mimeType: CARPETA, ...(padreId ? { parents: [padreId] } : {}) }),
    });
    return r.json();
  }

  const cacheCarpetas = new Map();
  async function carpetaHija(padreId, nombre) {
    const k = `${padreId}/${nombre}`;
    if (cacheCarpetas.has(k)) return cacheCarpetas.get(k);
    const hay = await buscar(`name='${esc(nombre)}' and '${padreId}' in parents and mimeType='${CARPETA}' and trashed=false`);
    const id = hay[0] ? hay[0].id : (await crearCarpeta(nombre, padreId)).id;
    cacheCarpetas.set(k, id);
    return id;
  }

  /** Asegura una ruta «A/B/C» dentro de la carpeta raíz y devuelve el id de la última. */
  async function asegurarRuta(raizId, ruta) {
    let id = raizId;
    for (const parte of ruta.split('/').filter(Boolean)) id = await carpetaHija(id, parte);
    return id;
  }

  async function listarArchivos(carpetaId) {
    return buscar(`'${carpetaId}' in parents and trashed=false and mimeType!='${CARPETA}'`);
  }

  async function subir({ carpetaId, nombre, blob, mime, archivoId = null }) {
    if (archivoId) {
      const r = await pedir(`/upload/drive/v3/files/${encodeURIComponent(archivoId)}?uploadType=media&supportsAllDrives=true&fields=id,modifiedTime`, {
        method: 'PATCH', headers: { 'Content-Type': mime }, body: blob,
      });
      return r.json();
    }
    const limite = 'topoland' + Math.random().toString(16).slice(2);
    const meta = { name: nombre, parents: [carpetaId], mimeType: mime };
    const cuerpo = new Blob([
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
      `--${limite}\r\nContent-Type: ${mime}\r\n\r\n`, blob, `\r\n--${limite}--`,
    ]);
    const r = await pedir('/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,modifiedTime', {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${limite}` }, body: cuerpo,
    });
    return r.json();
  }

  async function descargar(archivoId) {
    const r = await pedir(`/drive/v3/files/${encodeURIComponent(archivoId)}?alt=media&supportsAllDrives=true`);
    return r.blob();
  }

  return {
    nombre: 'Google Drive', tokenVigente, conectar, desconectar, usarToken,
    buscarCarpetas, crearCarpeta, datosCarpeta, asegurarRuta, listarArchivos, subir, descargar,
  };
}

/** Extrae el id de carpeta de un enlace de Drive (…/folders/<id>) o devuelve el texto si ya es un id. */
export function idDeEnlaceDrive(texto) {
  const t = String(texto || '').trim();
  const m = t.match(/folders\/([\w-]{10,})/) || t.match(/[?&]id=([\w-]{10,})/);
  if (m) return m[1];
  return /^[\w-]{10,}$/.test(t) ? t : null;
}
