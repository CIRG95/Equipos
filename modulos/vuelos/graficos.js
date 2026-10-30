// modulos/vuelos/graficos.js — gráfico de pronóstico por hora y esquema del área (SVG, sin librerías).

import { escapar as esc } from '../../compartido/util.js';
import { fmt } from './calculo.js';

const COLOR_ESTADO = { go: '#0F766E', marg: '#C2410C', no: '#B42318', noche: '#B9B5AC' };
const TEXTO_ESTADO = { go: 'GO', marg: 'Marg.', no: 'NO', noche: 'Luz' };

/**
 * Pronóstico gráfico: barras de viento sostenido (color = estado), línea de ráfaga, banda entre modelos,
 * límites del dron y, debajo, filas de dirección, lluvia, nubes, temperatura y Kp alineadas por hora.
 * filas: [{ h, kp, ev }] (como en la tabla del pronóstico).
 */
export function graficoPronostico(filas, dron) {
  if (!filas.length) return '<p class="sis-tenue">Sin horas para mostrar.</p>';
  const n = filas.length, W = Math.max(640, n * 46), X0 = 34, H = 190;
  const ymax = Math.max(16, Math.ceil((Math.max(...filas.map(f => Math.max(f.h.g || 0, f.h.vMax || 0, f.h.v || 0))) + 1) / 2) * 2);
  const cw = (W - X0 - 6) / n;
  const y = v => 10 + (H - 22) * (1 - Math.min(v, ymax) / ymax);
  const partes = [];
  for (const val of [0, Math.round(ymax / 2), ymax]) partes.push(`<line x1="${X0}" x2="${W}" y1="${y(val).toFixed(1)}" y2="${y(val).toFixed(1)}" stroke="#EFEDE8"/><text x="${X0 - 6}" y="${(y(val) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#5B6168">${val}</text>`);
  const limite = (v, color, t) => `<line x1="${X0}" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${color}" stroke-dasharray="5 4"/><text x="${W - 4}" y="${(y(v) - 4).toFixed(1)}" text-anchor="end" font-size="11" fill="${color}">${t}</text>`;
  partes.push(limite(dron.rafagaMaxMs, '#B42318', `Ráfaga máx. ${fmt(dron.rafagaMaxMs, 0)}`));
  if (Math.abs(dron.vientoMaxMs - dron.rafagaMaxMs) > 0.6) partes.push(limite(dron.vientoMaxMs, '#C2410C', `Sostenido máx. ${fmt(dron.vientoMaxMs, 0)}`));
  const pts = [];
  filas.forEach((f, i) => {
    const cx = X0 + cw * i + cw / 2, h = f.h;
    if (h.vMin != null && h.vMax != null) partes.push(`<rect x="${(cx - cw * 0.32).toFixed(1)}" y="${y(h.vMax).toFixed(1)}" width="${(cw * 0.64).toFixed(1)}" height="${Math.max(1, y(h.vMin) - y(h.vMax)).toFixed(1)}" rx="3" fill="#1C1F23" fill-opacity="0.08"/>`);
    if (h.v != null) partes.push(`<rect x="${(cx - cw * 0.2).toFixed(1)}" y="${y(h.v).toFixed(1)}" width="${(cw * 0.4).toFixed(1)}" height="${(y(0) - y(h.v)).toFixed(1)}" rx="3" fill="${COLOR_ESTADO[f.ev.estado]}"><title>${String(h.hora).padStart(2, '0')}:00 · viento ${fmt(h.v, 1)} m/s · ráfaga ${fmt(h.g, 1)}</title></rect>`);
    if (h.g != null) pts.push(`${cx.toFixed(1)},${y(h.g).toFixed(1)}`);
  });
  if (pts.length) partes.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="#1C1F23" stroke-width="1.8"/>` + pts.map(p => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="2.3" fill="#1C1F23"/>`).join(''));
  partes.push(`<text x="${X0 - 6}" y="8" text-anchor="end" font-size="10" fill="#5B6168">m/s</text>`);
  const svg = `<svg class="vu-graf-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Viento a 120 m por hora: barras de viento sostenido, línea de ráfaga y límites del dron">${partes.join('')}</svg>`;

  const celda = (contenido, marca) => `<div class="vu-graf-celda${marca ? ' ' + marca : ''}">${contenido}</div>`;
  const fila = (titulo, f) => `<div class="vu-graf-fila" style="grid-template-columns:${X0}px repeat(${n}, minmax(0,1fr))"><span class="vu-graf-tit">${titulo}</span>${filas.map(f).join('')}</div>`;
  const filasHtml = [
    fila('', x => celda(`<b>${String(x.h.hora).padStart(2, '0')}</b><span class="vu-graf-estado" style="background:${COLOR_ESTADO[x.ev.estado]}" title="${esc(x.ev.motivos.join(' · '))}">${TEXTO_ESTADO[x.ev.estado]}</span>`)),
    fila('Dir.', x => celda(x.h.dir != null ? `<span class="vu-flecha" style="transform:rotate(${Math.round(x.h.dir + 180)}deg)" title="Viento desde ${Math.round(x.h.dir)}°">↑</span>` : '—')),
    fila('Lluvia', x => celda(x.h.prob != null ? `${fmt(x.h.prob)}%` : '—', (x.h.lluvia >= 0.2 || x.h.prob >= 40) ? 'azul' : '')),
    fila('Nubes', x => celda(`${fmt(x.h.nubes)}%`, x.h.nubes >= 50 ? 'gris' : '')),
    fila('Temp.', x => celda(`${fmt(x.h.temp, 0)}°`, x.h.temp < 5 ? 'azul' : '')),
    fila('Kp', x => celda(x.kp != null ? fmt(x.kp, 0) : '—', x.kp >= 4 ? 'ambar' : '')),
  ].join('');
  return `<div class="vu-graf" style="--ancho:${W}px"><div class="vu-graf-interior" style="width:${W}px">${svg}${filasHtml}</div></div>`;
}

/** Checklist meteorológico sobre unas horas (ventana GO o todo el día con luz). */
export function checklistClima(filas, dron) {
  const horasCon = (cond) => filas.filter(cond).map(f => f.h.hora);
  const rango = hs => {
    if (!hs.length) return '';
    const grupos = []; let ini = hs[0], prev = hs[0];
    for (const h of hs.slice(1)) { if (h !== prev + 1) { grupos.push([ini, prev]); ini = h; } prev = h; }
    grupos.push([ini, prev]);
    return grupos.map(([a, b]) => a === b ? `${a} h` : `${a}–${b + 1} h`).join(', ');
  };
  const items = [
    [`Viento sostenido ≤ ${fmt(dron.vientoMaxMs, 0)} m/s`, horasCon(f => f.h.v != null && f.h.v > dron.vientoMaxMs)],
    [`Ráfagas ≤ ${fmt(dron.rafagaMaxMs, 0)} m/s`, horasCon(f => f.h.g != null && f.h.g > dron.rafagaMaxMs)],
    ['Sin lluvia', horasCon(f => f.h.lluvia >= 0.2 || f.h.prob >= 40)],
    ['Nubosidad < 50 %', horasCon(f => f.h.nubes >= 50)],
    ['Temperatura ≥ 5 °C (baterías)', horasCon(f => f.h.temp != null && f.h.temp < 5)],
    ['Kp ≤ 4 (GNSS)', horasCon(f => f.kp != null && f.kp > 4)],
    ['Luz (sol sobre 5°)', horasCon(f => f.ev.estado === 'noche')],
  ];
  return items.map(([t, malas]) => ({ texto: t, cumple: !malas.length, detalle: malas.length ? `No ${rango(malas)}` : 'Cumple' }));
}

/** Esquema del área para la hoja impresa: sectores, líneas por batería y despegues (norte arriba). */
export function esquemaSVG({ poligonos = [], lineas = [], puntos = [], etiquetas = [], borde = null }, { W = 640, H = 380 } = {}) {
  const todos = [...poligonos.flat(), ...lineas.flatMap(l => l.pts), ...puntos.map(p => p.xy)];
  if (!todos.length) return '';
  const xs = todos.map(p => p[0]), ys = todos.map(p => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const m = 14, k = Math.min((W - 2 * m) / ((maxx - minx) || 1), (H - 2 * m) / ((maxy - miny) || 1));
  const ox = (W - (maxx - minx) * k) / 2, oy = (H - (maxy - miny) * k) / 2;
  const t = ([x, y]) => [ox + (x - minx) * k, H - (oy + (y - miny) * k)];
  const pl = pts => pts.map(t).map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
  const escala = (() => { const opciones = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000]; const objetivo = (W / 5) / k; const v = opciones.reduce((a, b) => Math.abs(b - objetivo) < Math.abs(a - objetivo) ? b : a); return { m: v, px: v * k }; })();
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Esquema del área de vuelo">
    <rect width="${W}" height="${H}" fill="#FFFFFF"/>
    ${borde ? `<polygon points="${pl(borde)}" fill="none" stroke="#8A8F96" stroke-dasharray="5 4"/>` : ''}
    ${poligonos.map((p, i) => `<polygon points="${pl(p)}" fill="${['#E1F5FE', '#F1F8E9', '#FFFDE7', '#FFEBEE', '#F3E5F5', '#E0F2F1'][i % 6]}" stroke="#E8611C" stroke-width="2"/>`).join('')}
    ${lineas.map(l => `<polyline points="${pl(l.pts)}" fill="none" stroke="${l.color}" stroke-width="1.4"/>`).join('')}
    ${puntos.map(p => { const [x, y] = t(p.xy); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#1C1F23" stroke="#fff" stroke-width="2"/>`; }).join('')}
    ${etiquetas.map(e => { const [x, y] = t(e.xy); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="14" font-weight="700" text-anchor="middle" fill="#1C1F23" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(e.texto)}</text>`; }).join('')}
    <g transform="translate(${W - 30},28)"><path d="M0 -16 L6 2 L0 -3 L-6 2 Z" fill="#1C1F23"/><text y="16" font-size="11" text-anchor="middle">N</text></g>
    <g transform="translate(16,${H - 16})"><line x1="0" x2="${escala.px.toFixed(1)}" y1="0" y2="0" stroke="#1C1F23" stroke-width="2"/><text x="${(escala.px / 2).toFixed(1)}" y="-5" font-size="11" text-anchor="middle">${escala.m >= 1000 ? fmt(escala.m / 1000, 0) + ' km' : escala.m + ' m'}</text></g>
  </svg>`;
}
