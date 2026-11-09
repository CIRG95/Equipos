// modulos/vuelos/paso-clima.js — paso 3 de la hoja (pronóstico, checklist, METAR, viento medido) y Pronóstico rápido.
// El análisis por día viene de pronostico-widget.js: el mismo que usa la app de Terreno.

import { escapar as esc, fechaLegible } from '../../compartido/util.js';
import { fmt } from './calculo.js';
import { chip, fila, dosD } from './ui.js';
import { pedirPronostico, pedirKp, ENLACES_CONSULTA } from './pronostico.js';
import { cargarEstaciones } from './metar.js';
import { htmlPanelMetar, resumenMetar } from './metar-ui.js';
import { graficoPronostico } from './graficos.js';
import { analizarDia as analizarDiaPron } from './pronostico-widget.js';
import { lineaEje, marcoDe, kmEnEje, kmADm, nombreSector } from './hoja.js';
import { largo, puntoEnEje } from './geom.js';
import { ubicacionDe } from './ubicacion.js';

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

  const DSEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const diaTxt = iso => { const [y, m, dd] = iso.split('-').map(Number); return `${DSEM[new Date(y, m - 1, dd, 12).getDay()]} ${dd}`; };
  function bloquePronostico(p, d, origen) {
    const b = analizarDia(p, d);
    const hoy = new Date().toISOString().slice(0, 10);
    const tira = b.dias.map(x => { const a = analizarDiaPron(p, d, st.kps, x), tMax = Math.max(...a.filas.map(f => f.h.temp ?? -99));
      const cl = a.ventana ? (a.filas.some(f => f.ev.estado === 'marg' && f.h.hora >= a.ventana[0] && f.h.hora <= a.ventana[1]) ? 'marg' : 'go') : 'no';
      return `<button type="button" class="vu-dia-btn ${cl}${x === st.dia ? ' activo' : ''}" data-accion="dia" data-dia="${x}"><b>${x === hoy ? 'Hoy' : esc(diaTxt(x))}</b><span>${tMax > -99 ? fmt(tMax, 0) + '°' : ''}</span><small>${a.ventana ? `${dosD(a.ventana[0])}–${dosD(a.ventana[1] + 1)} h` : 'sin ventana'}</small>${st.hoja && x === st.hoja.fecha ? '<i>vuelo</i>' : ''}</button>`; }).join('');
    const html = `<div class="vu-pron-origen"><b>${esc(origen)}</b><span class="sis-tenue">${fmt(p.lat, 5)}, ${fmt(p.lon, 5)}${p.elevacionModelo != null ? ` · ${fmt(p.elevacionModelo, 0)} m s. n. m. (modelo)` : ''}</span></div>
        <div class="vu-clima-cal"><label class="sis-campo"><span>Día a consultar</span><input type="date" data-clima-dia value="${esc(st.dia || '')}" min="${esc(b.dias[0] || '')}" max="${esc(b.dias[b.dias.length - 1] || '')}"></label>
          <span class="sis-tenue">Pronóstico de ${b.dias.length} días. Más allá de 7 días es menos confiable.</span></div>
        <div class="vu-dias-tira" role="group" aria-label="Próximos días">${tira}</div>
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
    else { cuerpo = '<p class="sis-tenue">Consultando el pronóstico de hoy y los próximos 10 días…</p>'; setTimeout(() => v.consultarHojaAuto && v.consultarHojaAuto(), 0); }
    return `<div class="vu-dos ancho">
      <div class="vu-izquierda">
        <section class="sis-tarjeta"><div class="sis-cab"><h2>Pronóstico · ${st.dia ? fechaLegible(st.dia) : (h.fecha ? fechaLegible(h.fecha) : 'hoy')}</h2>
          <button class="sis-btn chico" data-accion="consultar-hoja">Actualizar</button></div>
          ${cuerpo}
        </section>
        ${htmlTramos()}
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

  // ─────────── Pronóstico por tramo (v0.11): áreas largas o que cruzan varias comunas ───────────
  /** Puntos donde consultar si el área es larga (> 30 km): a lo largo del eje o en los sectores. */
  function puntosTramos() {
    const h = st.hoja, g = geo();
    if (!g) return null;
    const linea = lineaEje(h.area);
    if (linea && linea.length >= 2) {
      const m = marcoDe(linea), xy = linea.map(m.aXY), L = largo(xy);
      if (L < 30000) return null;
      const n = Math.min(6, Math.max(2, Math.round(L / 30000)));
      return Array.from({ length: n }, (_, k) => {
        const s0 = L * k / n, s1 = L * (k + 1) / n, [lon, lat] = m.aLonLat(puntoEnEje(xy, (s0 + s1) / 2).p);
        const km = x => kmEnEje(h.area, x, L);
        return { lat, lon, nombre: `${kmADm(Math.min(km(s0), km(s1)))} – ${kmADm(Math.max(km(s0), km(s1)))}` };
      });
    }
    const xs = g.vuelo.map(p => p[0]), ys = g.vuelo.map(p => p[1]);
    const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (diag < 30000 || g.sectores.length < 2) return null;
    const paso = Math.max(1, Math.ceil(g.sectores.length / 6));
    return g.sectores.filter((_, i) => i % paso === 0).map((sec, j) => {
      const i = j * paso, c = [sec.poligono.reduce((a, p) => a + p[0], 0) / sec.poligono.length, sec.poligono.reduce((a, p) => a + p[1], 0) / sec.poligono.length];
      const [lon, lat] = g.marco.aLonLat(c);
      return { lat, lon, nombre: `${nombreSector(h, i, g.sectores.length)}${paso > 1 ? ` a ${nombreSector(h, Math.min(g.sectores.length - 1, i + paso - 1), g.sectores.length)}` : ''}` };
    });
  }

  async function consultarTramos() {
    const h = st.hoja, pts = puntosTramos();
    if (!pts) { st.tramos = null; return; }
    st.tramos = { hojaId: h.id || 'nueva', cargando: true, lista: [] };
    try {
      const pron = await Promise.all(pts.map(p => pedirPronostico(p.lat, p.lon, 10).catch(() => null)));
      st.tramos = { hojaId: h.id || 'nueva', lista: pts.map((p, k) => ({ ...p, pron: pron[k] })) };
    } catch { st.tramos = { hojaId: h.id || 'nueva', error: true, lista: [] }; }
    render();
    // Nombre de la comuna de cada tramo (OpenStreetMap pide una consulta por segundo).
    for (const t of st.tramos.lista) {
      try { const u = await ubicacionDe(t.lat, t.lon); t.comuna = u.comuna; } catch { /* sin nombre */ }
      await new Promise(r => setTimeout(r, 1100));
    }
    if (st.paso === 'clima') render();
  }

  function htmlTramos() {
    const t = st.tramos, h = st.hoja, d = dron();
    if (!t || t.hojaId !== (h.id || 'nueva')) return '';
    if (t.cargando) return '<section class="sis-tarjeta"><h2>Pronóstico por tramo</h2><p class="sis-tenue">Consultando cada tramo…</p></section>';
    const dia = st.dia;
    const res = t.lista.filter(x => x.pron).map(x => {
      const a = analizarDiaPron(x.pron, d, st.kps, dia), luz = a.filas.filter(f => f.ev.estado !== 'noche');
      return { ...x, a, vMax: Math.max(...luz.map(f => f.h.v || 0)), gMax: Math.max(...luz.map(f => f.h.g || 0)), lluvia: luz.some(f => (f.h.lluvia || 0) >= 0.2), tMin: Math.min(...a.filas.map(f => f.h.temp ?? 99)) };
    });
    // Se juntan los tramos seguidos cuyo pronóstico es parecido: solo se separa donde cambia.
    const grupos = [];
    for (const r of res) {
      const u = grupos[grupos.length - 1], vent = r.a.ventana ? r.a.ventana.join('-') : 'no';
      if (u && u.vent === vent && Math.abs(u.vMax - r.vMax) < 2 && u.lluvia === r.lluvia) { u.hasta = r; u.vMax = Math.max(u.vMax, r.vMax); u.gMax = Math.max(u.gMax, r.gMax); u.comunas.add(r.comuna); continue; }
      grupos.push({ ...r, desde: r, hasta: r, vent, comunas: new Set([r.comuna]) });
    }
    const L = res.length;
    return `<section class="sis-tarjeta"><div class="sis-cab"><h2>Pronóstico por tramo · ${dia ? fechaLegible(dia) : ''}</h2><span class="sis-tenue">${L} punto${L === 1 ? '' : 's'} a lo largo del área${grupos.length < L ? ` · ${grupos.length} tramo${grupos.length === 1 ? '' : 's'} con pronóstico distinto` : ''}</span></div>
      <div class="vu-tramos-clima">${grupos.map(gr => {
        const nombre = gr.desde === gr.hasta ? gr.desde.nombre : `${gr.desde.nombre.split(' – ')[0]} – ${gr.hasta.nombre.split(' – ').pop()}`;
        const com = [...gr.comunas].filter(Boolean).join(', ');
        return `<div class="vu-tramo-clima ${gr.a.ventana ? 'go' : 'no'}"><b>${esc(nombre)}</b><small>${esc(com || '…')}</small>
          <span>Viento 120 m hasta ${fmt(gr.vMax, 1)} m/s · ráfaga ${fmt(gr.gMax, 1)} m/s${gr.lluvia ? ' · lluvia' : ''}${gr.tMin < 2 ? ` · ${fmt(gr.tMin, 0)} °C al amanecer` : ''}</span>
          <b class="${gr.a.ventana ? 'vu-verde' : 'vu-rojo'}">${gr.a.ventana ? `Volar ${dosD(gr.a.ventana[0])}:00 – ${dosD(gr.a.ventana[1] + 1)}:00` : 'Sin ventana GO'}</b></div>`; }).join('')}</div>
      <p class="sis-tenue">El área es larga y atraviesa microclimas distintos: se consulta cada tramo por separado y se juntan los tramos con un pronóstico parecido.</p></section>`;
  }

  async function consultarClima(lat, lon) {
    st.pronCargando = true; st.pronError = ''; await render();
    try {
      const [p, kps] = await Promise.all([pedirPronostico(lat, lon, 10), st.kps ? Promise.resolve(st.kps) : pedirKp()]);
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

  return { vistaClima, vistaRapido, consultarClima, consultarTramos, guardarResumenClima, resumenMetar };
}
