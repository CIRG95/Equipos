// modulos/vuelos/paso-clima.js — paso 3 de la hoja (pronóstico, checklist, METAR, viento medido) y Pronóstico rápido.
// El análisis por día viene de pronostico-widget.js: el mismo que usa la app de Terreno.

import { escapar as esc, fechaLegible } from '../../compartido/util.js';
import { fmt } from './calculo.js';
import { chip, fila, fechaHora, dosD } from './ui.js';
import { pedirPronostico, pedirKp, ENLACES_CONSULTA } from './pronostico.js';
import { cargarEstaciones } from './metar.js';
import { htmlPanelMetar, resumenMetar } from './metar-ui.js';
import { graficoPronostico } from './graficos.js';
import { analizarDia as analizarDiaPron } from './pronostico-widget.js';

export function crearPasoClima(v) {
  const ref = n => (...a) => v[n](...a);
  const { st, base } = v;
  const geo = ref('geo');
  const dron = ref('dron');
  const familias = ref('familias');
  const render = ref('render');
  const cambio = ref('cambio');

  // ─────────── Paso 3 · Clima ───────────
  function analizarDia(p, d) {
    const dias = [...new Set(p.horas.map(x => x.fecha))];
    if (!st.dia || !dias.includes(st.dia)) st.dia = (st.hoja && dias.includes(st.hoja.fecha)) ? st.hoja.fecha : dias[0];
    const r = analizarDiaPron(p, d, st.kps, st.dia);
    return { dias, ...r, chk: r.checklist };
  }

  function bloquePronostico(p, d, origen) {
    const b = analizarDia(p, d);
    const html = `<div class="vu-pron-origen"><b>${esc(origen)}</b><span class="sis-tenue">${fmt(p.lat, 5)}, ${fmt(p.lon, 5)}${p.elevacionModelo != null ? ` · ${fmt(p.elevacionModelo, 0)} m s. n. m. (modelo)` : ''}</span></div>
        <div class="vu-dias">${b.dias.map(x => `<button class="sis-menu-chip${x === st.dia ? ' activo' : ''}" data-accion="dia" data-dia="${x}">${fechaLegible(x)}${st.hoja && x === st.hoja.fecha ? ' · vuelo' : ''}</button>`).join('')}</div>
        <div class="vu-resumen-dia">
          ${b.ventana ? chip(`Ventana GO ${dosD(b.ventana[0])}:00 – ${dosD(b.ventana[1] + 1)}:00`, 'verde') : chip('Sin ventana GO este día', 'rojo')}
          ${chip(`Sol ${b.sol && b.sol.salida ? b.sol.salida.slice(11, 16) : '—'} – ${b.sol && b.sol.puesta ? b.sol.puesta.slice(11, 16) : '—'}`)}
          ${chip(b.kpMax != null ? `Kp máx. ${fmt(b.kpMax, 0)}` : 'Kp sin dato')}
        </div>
        <p class="sis-tenue vu-graf-ley">Barra: viento sostenido a 120 m (color = estado) · línea: ráfaga estimada · banda gris: diferencia entre ECMWF, GFS e ICON.</p>
        ${graficoPronostico(b.filas, d)}
        <p class="sis-tenue">Promedio de ${p.horas[0]?.modelos || 0} modelos; si la banda es ancha, el pronóstico es inseguro. ${st.kps ? 'Kp: NOAA, ventanas de 3 h.' : 'No se pudo leer el Kp de NOAA.'} Modelos globales: en valles y faenas de cordillera el viento real puede diferir.</p>`;
    return { ...b, html };
  }

  function htmlChecklist(chk, titulo) {
    return `<section class="sis-tarjeta"><h2>${titulo}</h2><dl class="vu-tabla">${chk.map(x => fila(esc(x.texto), `<span class="${x.cumple ? 'vu-verde' : 'vu-rojo'}">${esc(x.detalle)}</span>`)).join('')}</dl>
      <p class="sis-tenue">Límites del dron elegido (Vuelos → Drones).</p></section>`;
  }

  // METAR: aeródromos cercanos + pegar el reporte (los servicios de METAR no dejan leerlos desde la página).
  cargarEstaciones().then(() => { if (st.paso === 'clima' || st.vista === 'rapido') render(); }).catch(() => {});
  function htmlMetar(lat, lon, guardado) {
    return `<section class="sis-tarjeta">${htmlPanelMetar({ lat, lon, elevArea: st.pron ? st.pron.elevacionModelo : null, guardado, dron: st.vista === 'rapido' ? (base.drones.find(x => x.id === st.rapDron) || base.drones[0]) : dron(), horasPron: st.pron ? st.pron.horas : null })}</section>`;
  }

  function vistaClima() {
    const h = st.hoja, d = dron(), g = geo();
    if (!g) return `<section class="sis-tarjeta sis-vacio"><p>Primero carga el área: el pronóstico se consulta en su centro.</p><button class="sis-btn primario" data-accion="paso" data-paso="area">Ir a Área</button></section>`;
    let cuerpo = '', lado = '';
    if (st.pronCargando) cuerpo = '<p class="sis-tenue">Consultando el pronóstico…</p>';
    else if (st.pronError) cuerpo = `<div class="sis-error">${esc(st.pronError)}</div>`;
    else if (st.pron) { const b = bloquePronostico(st.pron, d, `Centro de «${h.nombre || 'el área'}»`); cuerpo = b.html; lado = htmlChecklist(b.chk, b.ventana ? `Checklist · ventana ${dosD(b.ventana[0])}–${dosD(b.ventana[1] + 1)} h` : 'Checklist · horas con luz'); }
    else if (h.clima) cuerpo = `<p class="sis-tenue">Última consulta: ${fechaHora(h.clima.consultadoEn)}. Vuelve a consultar para ver el gráfico actualizado.</p>`;
    else cuerpo = '<p class="sis-tenue">Consulta el pronóstico de los próximos 3 días en el centro del área.</p>';
    return `<div class="vu-dos ancho">
      <div class="vu-izquierda">
        <section class="sis-tarjeta"><div class="sis-cab"><h2>Pronóstico · ${h.fecha ? fechaLegible(h.fecha) : 'sin fecha'}</h2>
          <button class="sis-btn primario chico" data-accion="consultar-hoja">${st.pron ? 'Actualizar' : 'Consultar pronóstico'}</button></div>
          ${cuerpo}
        </section>
      </div>
      <div class="vu-derecha">
        ${lado || (h.clima && h.clima.checklist ? htmlChecklist(h.clima.checklist, 'Checklist (última consulta)') : '')}
        ${(() => { const [lon, lat] = g.marco.aLonLat([0, 0]); return htmlMetar(lat, lon, h.metar); })()}
        <section class="sis-tarjeta"><h2>Viento medido en terreno</h2>
          ${h.viento.length ? `<dl class="vu-tabla">${h.viento.map((v, k) => fila(`${esc(v.hora)}${v.nota ? ` · ${esc(v.nota)}` : ''}`, `${fmt(v.ms, 1)} m/s <button class="vu-link" data-accion="quitar-viento" data-k="${k}" aria-label="Quitar">✕</button>`)).join('')}</dl>` : ''}
          <form class="vu-viento" data-form="viento"><input name="hora" placeholder="hh:mm" aria-label="Hora" value="${new Date().toTimeString().slice(0, 5)}"><input name="ms" placeholder="m/s" inputmode="decimal" aria-label="Viento en m/s" required><input name="nota" placeholder="Nota (opcional)" aria-label="Nota"><button class="sis-btn chico">Anotar</button></form>
          <p class="sis-tenue">Anemómetro en el despegue. Queda en la hoja para comparar con el pronóstico.</p>
        </section>
        <section class="sis-tarjeta"><h2>Antes de volar, revisa también</h2>
          <div class="vu-enlaces">${ENLACES_CONSULTA.map(([t, u]) => `<a class="sis-btn chico" href="${u}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join('')}</div>
        </section>
      </div>
    </div>`;
  }

  async function consultarClima(lat, lon) {
    st.pronCargando = true; st.pronError = ''; await render();
    try {
      const [p, kps] = await Promise.all([pedirPronostico(lat, lon), st.kps ? Promise.resolve(st.kps) : pedirKp()]);
      st.pron = p; st.kps = kps; st.dia = null;
    } catch (e) { st.pronError = `No se pudo consultar el pronóstico (${e.message}). Revisa la conexión a internet.`; st.pron = null; }
    st.pronCargando = false;
  }

  function guardarResumenClima() {
    const h = st.hoja, d = dron();
    if (!st.pron || !h) return;
    const b = analizarDia(st.pron, d);
    const raf = b.filas.filter(f => f.h.g != null && f.ev.estado !== 'noche').sort((x, y) => y.h.g - x.h.g)[0];
    h.clima = {
      consultadoEn: new Date().toISOString(), fecha: st.dia, lat: st.pron.lat, lon: st.pron.lon,
      ventana: b.ventana ? `${dosD(b.ventana[0])}:00–${dosD(b.ventana[1] + 1)}:00` : '',
      rafaga: raf ? { v: raf.h.g, hora: raf.h.hora } : null, kpMax: b.kpMax,
      sol: b.sol && b.sol.salida ? [b.sol.salida.slice(11, 16), b.sol.puesta ? b.sol.puesta.slice(11, 16) : '—'] : null,
      modelos: st.pron.horas[0]?.modelos || 0, checklist: b.chk,
      horas: b.filas.map(f => ({ hora: f.h.hora, v: f.h.v, g: f.h.g, dir: f.h.dir, prob: f.h.prob, nubes: f.h.nubes, temp: f.h.temp, kp: f.kp, estado: f.ev.estado })),
    };
    cambio();
  }

  // ─────────── Pronóstico rápido ───────────
  function vistaRapido() {
    const d = base.drones.find(x => x.id === st.rapDron) || base.drones[0];
    let cuerpo = '', lado = '';
    if (st.pronCargando) cuerpo = '<p class="sis-tenue">Consultando el pronóstico…</p>';
    else if (st.pronError) cuerpo = `<div class="sis-error">${esc(st.pronError)}</div>`;
    else if (st.pron) { const b = bloquePronostico(st.pron, d, st.rapOrigen); cuerpo = b.html; lado = htmlChecklist(b.chk, b.ventana ? 'Checklist · ventana GO' : 'Checklist · horas con luz'); }
    return `<div class="vu-dos ancho">
      <div class="vu-izquierda">
        <section class="sis-tarjeta"><h2>Pronóstico rápido</h2>
          <p class="sis-tenue">Para un lugar sin hoja de vuelo. Para un trabajo, usa el paso Clima de su hoja.</p>
          <form class="sis-form" data-form="rapido">
            <div class="sis-par">
              <label class="sis-campo"><span>Latitud</span><input name="lat" value="${esc(st.rapLat)}" placeholder="-32.83" inputmode="decimal"></label>
              <label class="sis-campo"><span>Longitud</span><input name="lon" value="${esc(st.rapLon)}" placeholder="-70.60" inputmode="decimal"></label>
            </div>
            <label class="sis-campo"><span>Dron (para sus límites)</span><select name="rapDron">${familias().map(([k, t]) => { const x = base.drones.find(y => (y.familia || y.id) === k); return `<option value="${x.id}" ${(d.familia || d.id) === k ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>
            <div class="sis-acciones"><button class="sis-btn primario">Consultar coordenadas</button><button type="button" class="sis-btn" data-accion="gps">Usar mi ubicación</button></div>
          </form>
          ${cuerpo}
        </section>
      </div>
      <div class="vu-derecha">${lado}${st.rapLat && st.rapLon ? htmlMetar(Number(st.rapLat), Number(st.rapLon), st.rapMetar) : ''}</div>
    </div>`;
  }

  return { vistaClima, vistaRapido, consultarClima, guardarResumenClima, resumenMetar };
}
