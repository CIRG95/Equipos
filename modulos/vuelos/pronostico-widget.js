// modulos/vuelos/pronostico-widget.js — pronóstico de vuelo listo para montar en otra app (la app de Terreno).
// Reúne pronostico.js + metar.js + graficos.js en una tarjeta: elegir dron, consultar, días, gráfico, checklist y METAR.
// Se arma como script clásico con construir-pronostico.sh → global window.PronosticoVuelo.
// La fuente de verdad es este módulo (Vuelos): si cambia el pronóstico, se rearma el paquete y se copia a Terreno.

import { pedirPronostico, pedirKp, kpEnHora, evaluarHora, elevacionSol, ENLACES_CONSULTA } from './pronostico.js';
import { cercanas, decodificar, comparar } from './metar.js';
import { htmlPanelMetar } from './metar-ui.js';
import { graficoPronostico, checklistClima } from './graficos.js';
import { DRONES_BASE } from './drones.js';

export const VERSION = '1.1 (Vuelos 0.6)';
export const DRONES = DRONES_BASE.map(d => ({ id: d.id, nombre: d.nombre, vientoMaxMs: d.vientoMaxMs, rafagaMaxMs: d.rafagaMaxMs }));
export const piezas = { pedirPronostico, pedirKp, kpEnHora, evaluarHora, elevacionSol, cercanas, decodificar, comparar, graficoPronostico, checklistClima };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dos = n => String(n).padStart(2, '0');
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const fechaCorta = iso => { const d = new Date(iso + 'T12:00:00'); return `${DIAS[d.getDay()]} ${d.getDate()}`; };
const n1 = v => v == null || !isFinite(v) ? '—' : v.toLocaleString('es-CL', { maximumFractionDigits: 1 });

function filasDelDia(p, dron, kps, dia) {
  return p.horas.filter(x => x.fecha === dia && x.hora >= 6 && x.hora <= 21)
    .map(h => { const kp = kpEnHora(kps, h.t); return { h, kp, ev: evaluarHora(h, dron, { kp, solMin: 5 }) }; });
}
function mejorVentana(filas) {
  let mejor = null, ini = null;
  filas.forEach((f, i) => {
    if (f.ev.estado === 'go' && ini == null) ini = i;
    if (f.ev.estado !== 'go' || i === filas.length - 1) {
      const fin = f.ev.estado === 'go' ? i : i - 1;
      if (ini != null && (!mejor || fin - ini > mejor[1] - mejor[0])) mejor = [ini, fin];
      if (f.ev.estado !== 'go') ini = null;
    }
  });
  return mejor ? [filas[mejor[0]].h.hora, filas[mejor[1]].h.hora] : null;
}

/** Análisis de un día: filas por hora, ventana GO, sol, Kp y checklist. */
export function analizarDia(p, dron, kps, dia) {
  const filas = filasDelDia(p, dron, kps, dia);
  const ventana = mejorVentana(filas);
  const sol = p.dias.find(x => x.fecha === dia);
  const kpsDia = filas.map(f => f.kp).filter(k => k != null);
  const enVentana = ventana ? filas.filter(f => f.h.hora >= ventana[0] && f.h.hora <= ventana[1]) : filas.filter(f => f.ev.estado !== 'noche');
  return { filas, ventana, sol, kpMax: kpsDia.length ? Math.max(...kpsDia) : null, checklist: checklistClima(enVentana.length ? enVentana : filas, dron) };
}

/**
 * Monta la tarjeta del pronóstico en `el`.
 * opciones: { lat, lon, lugar, dronId | dron, fecha, ultimo, alGuardar(resumen), alCambiarDron(id) }
 * Devuelve { consultar(), resumen(), actualizar(opciones), destruir() }.
 */
export function montar(el, opciones = {}) {
  const o = { dronId: 'm4e', ...opciones };
  const st = { pron: null, kps: null, metar: (opciones.ultimo && opciones.ultimo.metar && opciones.ultimo.metar.texto) ? opciones.ultimo.metar : null, dia: null, cargando: false, error: '' };
  const dron = () => o.dron || DRONES.find(d => d.id === o.dronId) || DRONES[0];
  el.classList.add('pv');

  function resumen() {
    if (!st.pron) return null;
    const b = analizarDia(st.pron, dron(), st.kps, st.dia);
    const raf = b.filas.filter(f => f.h.g != null && f.ev.estado !== 'noche').sort((x, y) => y.h.g - x.h.g)[0];
    return {
      consultadoEn: new Date().toISOString(), fecha: st.dia, lat: st.pron.lat, lon: st.pron.lon, lugar: o.lugar || '',
      dron: dron().id, ventana: b.ventana ? `${dos(b.ventana[0])}:00–${dos(b.ventana[1] + 1)}:00` : '',
      rafaga: raf ? { v: raf.h.g, hora: raf.h.hora } : null, kpMax: b.kpMax,
      sol: b.sol && b.sol.salida ? [b.sol.salida.slice(11, 16), b.sol.puesta ? b.sol.puesta.slice(11, 16) : '—'] : null,
      modelos: st.pron.horas[0]?.modelos || 0, checklist: b.checklist,
      horas: b.filas.map(f => ({ hora: f.h.hora, v: f.h.v, g: f.h.g, dir: f.h.dir, prob: f.h.prob, nubes: f.h.nubes, temp: f.h.temp, kp: f.kp, estado: f.ev.estado })),
      metar: st.metar, // { texto, leidoEn }: el METAR pegado
    };
  }

  const checklistHtml = (chk, titulo) => `<div class="pv-caja"><h3>${esc(titulo)}</h3><ul class="pv-chk">${chk.map(x =>
    `<li class="${x.cumple ? 'si' : 'no'}"><span>${esc(x.texto)}</span><b>${esc(x.detalle)}</b></li>`).join('')}</ul></div>`;

  // METAR: los servicios no dejan leerlo desde la app; se muestran los aeródromos cercanos y se pega el reporte.
  const metarHtml = () => `<div class="pv-caja">${htmlPanelMetar({ lat: o.lat, lon: o.lon, elevArea: st.pron ? st.pron.elevacionModelo : null, guardado: st.metar, dron: dron(), horasPron: st.pron ? st.pron.horas : null, acc: 'data-pv' })}</div>`;

  function render() {
    const d = dron();
    const cab = `<div class="pv-cab">
      <div><h2>Pronóstico de vuelo</h2>${o.lugar ? `<p class="pv-tenue">${esc(o.lugar)}</p>` : ''}</div>
      <div class="pv-acc">
        ${o.dron ? '' : `<select class="pv-dron" aria-label="Dron">${DRONES.map(x => `<option value="${x.id}" ${x.id === d.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>`}
        <button type="button" class="pv-btn pri" data-pv="consultar" ${st.cargando || o.lat == null ? 'disabled' : ''}>${st.cargando ? 'Consultando…' : st.pron ? 'Actualizar' : 'Consultar'}</button>
      </div></div>`;
    let cuerpo = '';
    if (o.lat == null || o.lon == null) cuerpo = '<p class="pv-tenue">Falta la ubicación (centro del área o del tramo) para consultar.</p>';
    else if (st.error) cuerpo = `<div class="pv-error">${esc(st.error)}</div>${o.ultimo ? ultimoHtml(o.ultimo) : ''}`;
    else if (st.pron) {
      const dias = [...new Set(st.pron.horas.map(x => x.fecha))];
      if (!st.dia || !dias.includes(st.dia)) st.dia = o.fecha && dias.includes(o.fecha) ? o.fecha : dias[0];
      const b = analizarDia(st.pron, d, st.kps, st.dia);
      cuerpo = `<div class="pv-dias">${dias.map(x => `<button type="button" class="pv-chip${x === st.dia ? ' act' : ''}" data-pv="dia" data-dia="${x}">${fechaCorta(x)}${x === o.fecha ? ' · vuelo' : ''}</button>`).join('')}</div>
        <div class="pv-res">
          <span class="pv-pas ${b.ventana ? 'go' : 'no'}">${b.ventana ? `Ventana GO ${dos(b.ventana[0])}:00 – ${dos(b.ventana[1] + 1)}:00` : 'Sin ventana GO este día'}</span>
          <span class="pv-pas">Sol ${b.sol && b.sol.salida ? b.sol.salida.slice(11, 16) : '—'} – ${b.sol && b.sol.puesta ? b.sol.puesta.slice(11, 16) : '—'}</span>
          <span class="pv-pas">${b.kpMax != null ? `Kp máx. ${b.kpMax}` : 'Kp sin dato'}</span>
        </div>
        ${graficoPronostico(b.filas, d)}
        <p class="pv-tenue">Barra: viento a 120 m (color = estado) · línea: ráfaga · banda gris: diferencia entre ECMWF, GFS e ICON. En valles de cordillera el viento real puede diferir.</p>
        <div class="pv-dos">${checklistHtml(b.checklist, b.ventana ? `Checklist · ventana ${dos(b.ventana[0])}–${dos(b.ventana[1] + 1)} h` : 'Checklist · horas con luz')}${metarHtml()}</div>
        ${o.alGuardar ? '<button type="button" class="pv-btn" data-pv="guardar">Guardar en la jornada</button>' : ''}`;
    } else if (o.ultimo) cuerpo = ultimoHtml(o.ultimo);
    else cuerpo = '<p class="pv-tenue">Consulta los próximos 3 días: viento a 120 m, ráfagas, lluvia, nubes, temperatura y Kp.</p>';
    if (o.lat != null && !st.pron) cuerpo += metarHtml();
    el.innerHTML = cab + cuerpo + `<div class="pv-enlaces">${ENLACES_CONSULTA.map(([t, u]) => `<a class="pv-link" href="${u}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join('')}</div>`;
  }

  function ultimoHtml(u) {
    const f = new Date(u.consultadoEn);
    return `<p class="pv-tenue">Última consulta guardada: ${f.toLocaleDateString('es-CL')} ${dos(f.getHours())}:${dos(f.getMinutes())}${u.ventana ? ` · ventana ${esc(u.ventana)}` : ''}. Sin conexión se muestra esto.</p>${u.checklist ? checklistHtml(u.checklist, 'Checklist (última consulta)') : ''}`;
  }

  async function consultar() {
    if (o.lat == null || o.lon == null) return;
    st.cargando = true; st.error = ''; render();
    try {
      const [p, kps] = await Promise.all([pedirPronostico(o.lat, o.lon), st.kps ? Promise.resolve(st.kps) : pedirKp()]);
      st.pron = p; st.kps = kps;
    } catch (e) { st.pron = null; st.error = `No se pudo consultar el pronóstico (${e.message}). Revisa la conexión a internet.`; }
    st.cargando = false; render();
  }

  function alClick(e) {
    const b = e.target.closest('[data-pv]'); if (!b || !el.contains(b)) return;
    if (b.dataset.pv === 'consultar') consultar();
    else if (b.dataset.pv === 'dia') { st.dia = b.dataset.dia; render(); }
    else if (b.dataset.pv === 'metar-leer') { const ta = el.querySelector('[data-metar-texto]'); const t = (ta && ta.value || '').trim(); if (!t) return; st.metar = { texto: t, leidoEn: new Date().toISOString() }; render(); if (o.alGuardar && st.pron) { const r = resumen(); if (r) o.alGuardar(r); } }
    else if (b.dataset.pv === 'metar-borrar') { st.metar = null; render(); }
    else if (b.dataset.pv === 'guardar' && o.alGuardar) { const r = resumen(); if (r) { o.alGuardar(r); b.textContent = 'Guardado ✓'; } }
  }
  function alCambiar(e) {
    if (!e.target.classList.contains('pv-dron')) return;
    o.dronId = e.target.value; if (o.alCambiarDron) o.alCambiarDron(o.dronId); render();
  }
  el.addEventListener('click', alClick);
  el.addEventListener('change', alCambiar);
  render();
  return {
    consultar, resumen,
    actualizar(nuevas) { Object.assign(o, nuevas); if (nuevas.lat != null || nuevas.lon != null) { st.pron = null; st.metar = null; } render(); },
    destruir() { el.removeEventListener('click', alClick); el.removeEventListener('change', alCambiar); el.innerHTML = ''; el.classList.remove('pv'); },
  };
}
