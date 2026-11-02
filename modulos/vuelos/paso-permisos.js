// modulos/vuelos/paso-permisos.js — paso 4 de la hoja (DGAC, documentos, consultas con registro) y la hoja para terreno (impresión).

import { escapar as esc, fechaLegible } from '../../compartido/util.js';
import { fmt, fmtDuracion } from './calculo.js';
import { chip, fechaHora, dosD } from './ui.js';
import { ENLACES_CONSULTA } from './pronostico.js';
import { esquemaSVG } from './graficos.js';
import { totales, estadoPermiso, diasHabiles, nombreSector, DOCUMENTOS_DGAC, CONSULTAS } from './hoja.js';
import { COLORES_BATERIA } from './ui.js';

export function crearPasoPermisos(v) {
  const ref = n => (...a) => v[n](...a);
  const { st } = v;
  const geo = ref('geo');
  const dron = ref('dron');
  const nomProy = ref('nomProy');
  const nomPers = ref('nomPers');
  const ultimaConsulta = ref('ultimaConsulta');

  // ─────────── Paso 4 · Permisos y consultas ───────────
  function fechaMenosHabiles(fecha, n) {
    const d = new Date(fecha + 'T12:00:00');
    while (n > 0) { d.setDate(d.getDate() - 1); const w = d.getDay(); if (w !== 0 && w !== 6) n--; }
    return d.toISOString().slice(0, 10);
  }

  function vistaPermisos() {
    const h = st.hoja, g = h.permisos.dgac, perm = estadoPermiso(h);
    const habiles = g.enviado && h.fecha ? diasHabiles(g.enviado, h.fecha) : null;
    const hito = (k, t) => `<label class="vu-hito${g[k] ? ' hecho' : ''}"><span class="vu-hito-punto" aria-hidden="true"></span><span>${t}</span><input type="date" data-dgac="${k}" value="${esc(g[k] || '')}" aria-label="${t}"></label>`;
    return `<div class="vu-dos ancho">
      <div class="vu-izquierda">
        <section class="sis-tarjeta"><div class="sis-cab"><h2>Solicitud a la DGAC</h2>${chip(perm.texto, perm.nivel === 'ok' ? 'verde' : perm.nivel === 'aviso' ? 'ambar' : 'gris')}</div>
          <div class="vu-hitos">${hito('preparado', 'En preparación')}${hito('enviado', 'Enviada a la DGAC')}${hito('aprobado', 'Aprobada')}${hito('vence', 'Vigente hasta')}</div>
          <label class="sis-campo"><span>N° de solicitud o autorización</span><input data-dgac="numero" value="${esc(g.numero || '')}"></label>
          ${habiles != null && habiles < 7 && !g.aprobado ? `<div class="vu-aviso">Se envió ${habiles} día${habiles === 1 ? '' : 's'} hábil${habiles === 1 ? '' : 'es'} antes del vuelo; la DGAC pide al menos 7.</div>` : ''}
          ${!g.enviado && h.fecha ? `<p class="sis-tenue">Para volar el ${fechaLegible(h.fecha)}, conviene enviarla a más tardar el ${fechaLegible(fechaMenosHabiles(h.fecha, 7))} (7 días hábiles).</p>` : ''}
        </section>
        <section class="sis-tarjeta"><h2>Documentos de la solicitud</h2>
          ${DOCUMENTOS_DGAC.map(([k, t]) => `<label class="sis-check vu-doc"><input type="checkbox" data-doc="${k}" ${h.permisos.docs[k] ? 'checked' : ''}> ${t}</label>`).join('')}
          <div class="sis-acciones">${geo() ? '<button class="sis-btn chico" data-accion="kml-vuelo">Descargar KML de la zona (área de vuelo)</button>' : ''}</div>
          <p class="sis-tenue">Más adelante la credencial del piloto y la inscripción del dron se leerán desde Personas y Equipos.</p>
        </section>
      </div>
      <div class="vu-derecha">
        <section class="sis-tarjeta"><h2>Consultas oficiales · con registro</h2>
          ${CONSULTAS.map(([k, t, u]) => { const x = ultimaConsulta(h, k); return `<div class="vu-consulta">
            <div><a href="${u}" target="_blank" rel="noopener"><b>${t}</b> ↗</a>${x ? `<span class="sis-tenue">Revisado ${fechaHora(x.fecha)}${x.personaId ? ` · ${esc(nomPers(x.personaId))}` : ''}</span>` : '<span class="vu-rojo">Pendiente</span>'}</div>
            <div class="sis-acciones">${x && x.archivoId ? `<button class="sis-btn chico" data-accion="ver-captura" data-id="${esc(x.archivoId)}">Ver captura</button>` : ''}
              <button class="sis-btn chico" data-accion="consulta" data-tipo="${k}">Marcar revisado</button>
              <label class="sis-btn chico vu-archivo">+ Captura<input type="file" accept="image/*,application/pdf" data-archivo="captura" data-tipo="${k}" hidden></label></div>
          </div>`; }).join('')}
          <p class="sis-tenue">Revisa el NOTAM el mismo día del vuelo. Cada revisión queda con fecha, persona y, si la adjuntas, la captura.</p>
        </section>
        <section class="sis-tarjeta"><h2>Otras consultas</h2>
          <div class="vu-enlaces">${ENLACES_CONSULTA.filter(([t]) => !/AIP/.test(t)).map(([t, u]) => `<a class="sis-btn chico" href="${u}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join('')}</div>
        </section>
      </div>
    </div>`;
  }

  // ─────────── Hoja para terreno (impresión / PDF) ───────────
  function imprimir() {
    const h = st.hoja, d = dron(), g = geo();
    if (!g) return;
    const t = totales(h, d, g);
    const lineas = [];
    t.sectores.forEach(r => r && r.baterias.forEach((b, k) => b.piezas.forEach(pz => lineas.push({ pts: pz, color: COLORES_BATERIA[k % COLORES_BATERIA.length] }))));
    const centro = pts => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
    const svg = esquemaSVG({
      borde: g.tipo === 'poligono' && Number(h.area.margen) ? g.original : null,
      poligonos: g.sectores.map(s => s.poligono), lineas,
      puntos: t.sectores.filter(Boolean).map(r => ({ xy: r.despegueXY })),
      etiquetas: g.sectores.length > 1 ? g.sectores.map((s, i) => ({ xy: centro(s.poligono), texto: nombreSector(h, i, g.sectores.length) })) : [],
    });
    const c = h.clima, perm = estadoPermiso(h);
    const filaT = (a, b) => `<tr><th>${a}</th><td>${b}</td></tr>`;
    const despLL = r => { const [lon, lat] = g.marco.aLonLat(r.despegueXY); return `${lat.toFixed(5)}, ${lon.toFixed(5)}`; };
    const vacias = Array(Math.max(0, 6 - h.viento.length)).fill({ hora: '', ms: '', nota: '' });
    const html = `<div class="vu-imp">
      <header><div><b>${esc(document.querySelector('.sis-marca b')?.textContent || 'Topoland')}</b> · Hoja de vuelo</div><div>${esc(h.nombre || '')}</div></header>
      <table class="vu-imp-datos">${filaT('Proyecto', esc(nomProy(h.proyectoId)))}${filaT('Fecha', h.fecha ? fechaLegible(h.fecha) : '')}${filaT('Piloto', esc(nomPers(h.pilotoId)))}${filaT('Dron', esc(d.nombre))}
        ${filaT('Producto', `${h.params.modo === 'lidar' ? 'LiDAR' : 'Fotogrametría'} · GSD ${fmt(t.gsd, 2)} cm · altura ${fmt(t.altura, 0)} m · traslapes ${h.params.traslapeFrontal}/${h.params.traslapeLateral} %`)}
        ${filaT('Área de vuelo', `${fmt(g.areaVuelo / 10000, 2)} ha${g.tipo === 'corredor' ? ` · corredor de ${fmt(g.izq + g.der, 0)} m` : Number(h.area.margen) ? ` · margen de ${h.area.margen} m` : ''}`)}
        ${filaT('Vuelo', `${t.baterias} baterías · ${fmtDuracion(t.minVuelo)} en el aire · jornada ${fmtDuracion(t.minJornada)}`)}</table>
      <div class="vu-imp-mapa">${svg}</div>
      <table class="vu-imp-tabla"><thead><tr><th>Sector</th><th>ha</th><th>Rumbo</th><th>Velocidad</th><th>Baterías (min)</th><th>Jornada</th><th>Despegue (lat, lon)</th></tr></thead>
        <tbody>${t.sectores.map((r, i) => r ? `<tr><td>${esc(nombreSector(h, i, g.sectores.length))}</td><td>${fmt(r.area / 10000, 1)}</td><td>${r.corredor ? 'eje' : fmt(r.rumbo, 0) + '°'}</td><td>${fmt(r.velocidad, 1)} m/s</td><td>${r.baterias.map((b, k) => `B${k + 1} ${fmt(b.min, 0)}′`).join(' · ')}</td><td>${fmtDuracion(r.minTotal)}</td><td>${despLL(r)}</td></tr>` : '').join('')}</tbody></table>
      <div class="vu-imp-dos">
        <div><h3>Clima${c ? ` · ${fechaLegible(c.fecha)}` : ''}</h3>${c ? `<p>Ventana GO: <b>${esc(c.ventana || 'sin ventana')}</b> · Sol ${c.sol ? c.sol.join('–') : '—'} · Kp máx. ${c.kpMax != null ? fmt(c.kpMax, 0) : '—'}</p>
          <table class="vu-imp-tabla chica"><thead><tr><th>Hora</th><th>Viento</th><th>Ráfaga</th><th>Lluvia</th><th>Estado</th></tr></thead><tbody>${(c.horas || []).filter((_, k) => k % 2 === 0).map(x => `<tr><td>${dosD(x.hora)}</td><td>${fmt(x.v, 1)}</td><td>${fmt(x.g, 1)}</td><td>${x.prob != null ? fmt(x.prob) + '%' : '—'}</td><td>${{ go: 'GO', marg: 'Marg.', no: 'NO', noche: '—' }[x.estado]}</td></tr>`).join('')}</tbody></table>
          ${c.metar ? `<p class="mono">${esc(c.metar.metar)}</p>` : ''}` : '<p>Sin consulta de clima.</p>'}
          <h3>Checklist</h3><ul class="vu-imp-chk">${(c && c.checklist || []).map(x => `<li>☐ ${esc(x.texto)} — ${esc(x.detalle)}</li>`).join('')}<li>☐ NOTAM revisado el día del vuelo</li><li>☐ Baterías cargadas (${t.baterias + 1} como mínimo)</li></ul></div>
        <div><h3>Permisos</h3><p>DGAC: <b>${esc(perm.texto)}</b> · ${esc(perm.detalle)}${h.permisos.dgac.numero ? ` · N° ${esc(h.permisos.dgac.numero)}` : ''}</p>
          <ul class="vu-imp-chk">${DOCUMENTOS_DGAC.map(([k, tt]) => `<li>${h.permisos.docs[k] ? '☑' : '☐'} ${tt}</li>`).join('')}</ul>
          <h3>Viento medido en terreno</h3><table class="vu-imp-tabla chica"><thead><tr><th>Hora</th><th>m/s</th><th>Nota</th></tr></thead><tbody>${[...h.viento, ...vacias].map(v => `<tr><td>${esc(v.hora)}</td><td>${v.ms === '' ? '' : fmt(v.ms, 1)}</td><td>${esc(v.nota || '')}</td></tr>`).join('')}</tbody></table>
          <h3>Observaciones</h3><div class="vu-imp-obs"></div></div>
      </div>
      <footer>Generado ${new Date().toLocaleString('es-CL')} · Estimación para planificar; el vuelo se programa en DJI Pilot 2. Información aeronáutica oficial: AIP Chile (DGAC).</footer>
    </div>`;
    let caja = document.getElementById('vu-impresion');
    if (!caja) { caja = document.createElement('div'); caja.id = 'vu-impresion'; document.body.appendChild(caja); }
    caja.innerHTML = html;
    document.body.classList.add('vu-imprimiendo');
    const fin = () => { document.body.classList.remove('vu-imprimiendo'); removeEventListener('afterprint', fin); };
    addEventListener('afterprint', fin);
    setTimeout(() => { window.print(); setTimeout(fin, 1500); }, 50);
  }

  return { vistaPermisos, imprimir };
}
