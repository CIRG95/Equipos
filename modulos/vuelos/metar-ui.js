// modulos/vuelos/metar-ui.js — tarjeta del METAR (la usan el paso Clima, el Pronóstico rápido y el paquete para Terreno).
// Muestra los aeródromos con METAR más cercanos, un recuadro para pegar el reporte y lo que la app entiende de él.
// acc: nombre del atributo de las acciones de quien la usa ('data-accion' en Vuelos, 'data-pv' en el paquete).

import { cercanas, representatividad, enlaces, decodificar, comparar, antiguedadMin } from './metar.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NIVEL = { ok: 'mt-ok', aviso: 'mt-aviso', no: 'mt-no' };
const COLOR_CAT = { VFR: 'mt-ok', MVFR: 'mt-aviso', IFR: 'mt-no', LIFR: 'mt-no' };

/** Hora local de Chile (aaaa-mm-ddThh:00) de un instante, para buscar la fila del pronóstico. */
function horaLocal(fecha) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(fecha).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:00`;
}
const horaTexto = f => f.toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

/** Lo que se guarda: { texto, leidoEn }. Se decodifica al mostrar, con leidoEn como «ahora» para resolver la fecha. */
export function resumenMetar(guardado) {
  if (!guardado || !guardado.texto) return null;
  const d = decodificar(guardado.texto, new Date(guardado.leidoEn || Date.now()));
  const m = d.metars[0];
  return m ? { icao: m.icao, hora: m.hora.toISOString(), texto: m.texto, categoria: m.categoria, viento: m.viento, taf: d.taf } : null;
}

export function htmlPanelMetar({ lat, lon, elevArea = null, guardado = null, dron, horasPron = null, acc = 'data-accion', titulo = 'METAR · TAF' }) {
  const cerca = lat != null && lon != null ? cercanas(lat, lon, 3) : [];
  const lista = cerca.length ? `<ul class="mt-lista">${cerca.map(e => {
    const r = representatividad(e, elevArea);
    return `<li><div><b class="mt-icao">${esc(e.icao)}</b> ${esc(e.nombre)}<span class="mt-tenue"> · ${Math.round(e.km)} km ${e.hacia} · ${e.elev} m${e.taf ? ' · con TAF' : ''}</span>
      ${r.buena ? '' : `<span class="mt-ref">Solo referencia: ${esc(r.motivos.join(' y '))}</span>`}</div>
      <div class="mt-enlaces">${enlaces(e.icao).map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t} ↗</a>`).join('')}</div></li>`;
  }).join('')}</ul>` : '<p class="mt-tenue">Carga el área para ver los aeródromos con METAR más cercanos.</p>';

  let leido = '';
  if (guardado && guardado.texto) {
    const d = decodificar(guardado.texto, new Date(guardado.leidoEn || Date.now()));
    const m = d.metars[0];
    if (!m) leido = '<p class="mt-no">No reconocí un METAR en el texto pegado. Copia la línea que empieza con METAR o con el código del aeródromo (por ejemplo SCEL 021400Z…).</p>';
    else {
      const fila = horasPron ? horasPron.find(h => h.t === horaLocal(m.hora)) : null;
      const comp = comparar(m, dron, fila);
      const edad = antiguedadMin(m);
      leido = `<div class="mt-leido">
        <div class="mt-cab"><b>${esc(m.tipo)} ${esc(m.icao)}</b><span class="mt-chip ${COLOR_CAT[m.categoria]}">${m.categoria}</span>
          <span class="mt-tenue">${esc(horaTexto(m.hora))} hora de Chile${edad >= 0 && edad < 60 * 24 * 3 ? ` · hace ${edad < 90 ? edad + ' min' : Math.round(edad / 60) + ' h'}` : ''}</span></div>
        ${edad > 90 ? '<p class="mt-aviso">Este reporte tiene más de hora y media: revisa si hay uno más nuevo.</p>' : ''}
        <ul class="mt-comp">${comp.map(c => `<li class="${NIVEL[c.nivel]}">${esc(c.texto)}</li>`).join('')}</ul>
        <pre class="mt-crudo">${esc(m.texto)}${d.metars.length > 1 ? `\n(+${d.metars.length - 1} reporte${d.metars.length > 2 ? 's' : ''} anterior${d.metars.length > 2 ? 'es' : ''})` : ''}${d.taf ? '\n\n' + esc(d.taf) : ''}</pre>
        <button type="button" class="mt-btn" ${acc}="metar-borrar">Borrar METAR</button></div>`;
    }
  }
  return `<div class="mt-panel"><h3 class="mt-tit">${esc(titulo)}</h3>
    <p class="mt-tenue">Aeródromos con METAR más cercanos. Abre uno, copia el reporte y pégalo abajo: la app lo lee y lo compara con el dron y el pronóstico.</p>
    ${lista}
    <label class="mt-pegar"><span>Pegar METAR (y TAF si quieres)</span><textarea rows="3" data-metar-texto placeholder="METAR SCEL 021400Z 20008KT 9999 FEW030 22/08 Q1015 NOSIG=">${esc(guardado && guardado.texto && !leido.includes('mt-leido') ? guardado.texto : '')}</textarea></label>
    <button type="button" class="mt-btn mt-pri" ${acc}="metar-leer">Leer METAR</button>
    ${leido}</div>`;
}
