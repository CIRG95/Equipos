// modulos/vuelos/paso-vuelo.js — paso 2 de la hoja: dron, GSD/altura, traslapes, velocidad, KPIs, leyenda y tabla de opciones por GSD.

import { escapar as esc } from '../../compartido/util.js';
import { fmt, fmtDuracion } from './calculo.js';
import { campo, deslizador, kpi, fila } from './ui.js';
import { alturaParaGsd, gsdCm } from './calculo.js';
import { calcularSector, totales, alturaDe, metaSector, nombreSector } from './hoja.js';
import { COLORES_BATERIA, COLORES_SECTOR, GSD_TABLA } from './ui.js';

export function crearPasoVuelo(v) {
  const ref = n => (...a) => v[n](...a);
  const { st, base } = v;
  const geo = ref('geo');
  const dron = ref('dron');
  const secSel = ref('secSel');
  const familias = ref('familias');

  // ─────────── Paso 2 · Vuelo ───────────
  function vistaVuelo() {
    const h = st.hoja, P = h.params, d = dron(), g = geo();
    if (!g) return `<section class="sis-tarjeta sis-vacio"><p>Primero carga o dibuja el área.</p><button class="sis-btn primario" data-accion="paso" data-paso="area">Ir a Área</button></section>`;
    const i = secSel();
    const r = calcularSector(h, d, g, i);
    const fam = d.familia || d.id;
    const sensores = base.drones.filter(x => (x.familia || x.id) === fam);
    const altura = alturaDe(P, d), gsd = gsdCm(d, altura);
    const vMax = d.velocidadMaxMs;
    return `${g.sectores.length > 1 ? `<div class="vu-sector-chips">${g.sectores.map((_, k) => `<button class="vu-pildora${k === i ? ' activo' : ''}" data-accion="ir-sector" data-i="${k}"><i style="background:${COLORES_SECTOR[k % COLORES_SECTOR.length]}"></i>${esc(nombreSector(h, k, g.sectores.length))}</button>`).join('')}<span class="sis-tenue" id="vu-total-hoja">${htmlTotalHoja()}</span></div>` : ''}
      <div class="vu-dos">
        <div class="vu-izquierda">
          <form class="sis-form vu-form" data-form="plan" autocomplete="off">
          <section class="sis-tarjeta"><h2>Dron y vuelo</h2>
            <div class="${sensores.length > 1 ? 'sis-par' : ''}">
              <label class="sis-campo"><span>Dron</span><select name="familia">${familias().map(([k, tt]) => `<option value="${esc(k)}" ${k === fam ? 'selected' : ''}>${esc(tt)}</option>`).join('')}</select></label>
              ${sensores.length > 1 ? `<label class="sis-campo"><span>Sensor</span><select name="dronId">${sensores.map(x => `<option value="${x.id}" ${x.id === h.dronId ? 'selected' : ''}>${esc(x.sensor || x.nombre)}</option>`).join('')}</select></label>` : ''}
            </div>
            ${d.lidar ? `<div class="sis-campo"><span>Producto</span><div class="sis-opciones">
              <label class="sis-opcion"><input type="radio" name="modo" value="foto" ${P.modo !== 'lidar' ? 'checked' : ''}> Fotogrametría</label>
              <label class="sis-opcion"><input type="radio" name="modo" value="lidar" ${P.modo === 'lidar' ? 'checked' : ''}> LiDAR</label></div></div>` : ''}
            <div class="vu-enlazados">
              ${deslizador('gsd', 'GSD', Math.round(gsd * 100) / 100, { min: 0.5, max: 8, paso: 0.05, sufijo: 'cm/px' })}
              ${deslizador('altura', 'Altura', Math.round(altura), { min: 15, max: 400, paso: 1, sufijo: 'm', nota: '(enlazada al GSD)' })}
            </div>
            ${deslizador('traslapeFrontal', 'Traslape frontal', P.traslapeFrontal, { min: 40, max: 90, paso: 1, sufijo: '%' })}
            ${deslizador('traslapeLateral', 'Traslape lateral', P.traslapeLateral, { min: 20, max: 90, paso: 1, sufijo: '%' })}
            ${deslizador('velocidad', 'Velocidad', Math.min(vMax, Math.round((r ? r.velocidad : 5) * 10) / 10), { min: 1, max: vMax, paso: 0.1, sufijo: 'm/s', nota: P.velocidad === '' ? '(sugerida)' : '' })}
            <div class="vu-desl-pie" id="vu-vel-pie">${pieVelocidad(r)}</div>
            <details class="vu-detalles"><summary>Supuestos de terreno y cámara</summary>
              <div class="sis-par">${campo('reserva', 'Reserva por batería', P.reserva, '', '%')}${campo('minDespegue', 'Despegue y aterrizaje', P.minDespegue, '', 'min')}</div>
              <div class="sis-par">${campo('minCambio', 'Cambio de batería', P.minCambio, '', 'min')}${campo('segGiro', 'Giro entre líneas', P.segGiro, '', 's')}</div>
              ${campo('exposicion', 'Exposición 1/…', P.exposicion, '', 's')}
            </details>
          </section>
          </form>
          <section class="sis-tarjeta"><h2>Exportar</h2>
            <div class="sis-acciones">
              ${g.tipo === 'corredor' ? `<button class="sis-btn primario" data-accion="kml-eje-sector" data-i="${i}">Descargar eje (KML para el control)</button><button class="sis-btn" data-accion="kml-sector" data-i="${i}">Corredor como polígono</button>` : `<button class="sis-btn primario" data-accion="kml-sector" data-i="${i}">Descargar KML${g.sectores.length > 1 ? ' del sector' : ''}</button>`}
            </div>
            <p class="sis-tenue">${g.tipo === 'corredor' ? 'En DJI Pilot 2 usa el eje con el modo corredor y el mismo ancho; aquí se simulan las pasadas, el tiempo y las baterías.' : 'El KML es el área de vuelo (con margen), limpio para el control.'}</p>
          </section>
        </div>
        <div class="vu-derecha">
          <div id="vu-kpis">${htmlKpis(r)}</div>
          <div class="vu-mapa-caja">
            <div class="vu-mapa-lugar" data-mapa="vuelo"></div>
            <div class="vu-mapa-barra" id="vu-barra">${htmlBarraRumbo(r)}</div>
            <div class="vu-leyenda-mapa" id="vu-leyenda">${htmlLeyenda(r)}</div>
          </div>
          <p class="sis-tenue vu-pie">Arrastra el punto para cambiar el despegue: el tiempo incluye ir y volver desde él en cada batería.</p>
          <div id="vu-detalle">${htmlDetalle(r)}</div>
        </div>
      </div>`;
  }

  function htmlTotalHoja() {
    const g = geo(), t = totales(st.hoja, dron(), g);
    return t ? `Hoja completa: ${t.baterias} baterías · ${fmtDuracion(t.minJornada)}` : '';
  }

  function pieVelocidad(r) {
    if (!r) return '';
    const lim = r.limites.map(([t, v]) => `${t} ${fmt(v, 1)}`).join(' · ');
    return `<span>Sugerida ${fmt(r.sugerida, 1)} m/s · límites: ${lim} m/s</span>${r.auto ? '' : ' <button type="button" class="vu-link" data-accion="vel-auto">usar la sugerida</button>'}`;
  }

  function htmlKpis(r) {
    if (!r) return '';
    return `<div class="vu-kpis">
      ${kpi('Altura', `${fmt(r.altura, 0)} m`, '', r.altura > 120 ? 'alerta' : '')}
      ${r.densidad ? kpi('Densidad', `${fmt(r.densidad, 0)} pts/m²`) : kpi('GSD', `${fmt(r.gsd, 2)} cm`)}
      ${kpi(r.corredor ? 'Pasadas' : 'Líneas', fmt(r.nLineas))}
      ${r.modo === 'foto' ? kpi('Fotos', fmt(r.fotos)) : kpi('Velocidad', `${fmt(r.velocidad, 1)} m/s`)}
      ${kpi('En el aire', fmtDuracion(r.minMision))}
      ${kpi('Baterías', fmt(r.vuelos), '', r.baterias.some(b => b.excede) ? 'alerta' : '')}
      ${kpi('Jornada', fmtDuracion(r.minTotal))}
    </div>`;
  }

  function htmlBarraRumbo(r) {
    if (!r) return '';
    if (r.corredor) return `<span class="vu-barra-txt">Corredor · ${fmt(r.nLineas)} pasada${r.nLineas === 1 ? '' : 's'} siguiendo el eje</span>`;
    const meta = metaSector(st.hoja, secSel());
    const auto = meta.rumbo === '' || meta.rumbo == null;
    return `<span class="vu-barra-txt">Rumbo ${fmt(r.rumbo, 0)}°${auto ? ' · lado más largo' : ''}</span>
      <button type="button" class="vu-barra-btn" data-accion="rumbo" data-d="-5" aria-label="Girar las líneas 5 grados a la izquierda">⟲ 5°</button>
      <button type="button" class="vu-barra-btn" data-accion="rumbo" data-d="5" aria-label="Girar las líneas 5 grados a la derecha">⟳ 5°</button>
      <button type="button" class="vu-barra-btn" data-accion="rumbo" data-d="90">90°</button>
      <button type="button" class="vu-barra-btn fuerte" data-accion="rumbo-corto">Más corto</button>
      ${auto ? '' : '<button type="button" class="vu-barra-btn" data-accion="rumbo-auto">Auto</button>'}`;
  }

  /** Leyenda compacta dentro del mapa: hasta 6 baterías a la vista; más, plegada en una línea. */
  function htmlLeyenda(r) {
    if (!r || !r.baterias.length) return '';
    const n = r.baterias.length;
    if (r.baterias.some(b => b.excede)) return `<div class="vu-leyenda-caja alerta"><b>Hay tramos que no alcanzan con una batería</b><span>Acerca el despegue o divide el área en sectores.</span></div>`;
    const item = (b, i) => `<span class="vu-ley-item"><i style="background:${COLORES_BATERIA[i % COLORES_BATERIA.length]}"></i>B${i + 1}<em>${fmt(b.min, 0)}′</em></span>`;
    const total = `${n} batería${n > 1 ? 's' : ''} · ${fmtDuracion(r.minMision)}`;
    if (n <= 6) return `<div class="vu-leyenda-caja"><b>${total}</b><div class="vu-ley-lista">${r.baterias.map(item).join('')}<span class="vu-ley-item"><i class="vu-punto"></i>Despegue</span></div></div>`;
    if (!st.leyendaAbierta) return `<button type="button" class="vu-leyenda-caja plegada" data-accion="leyenda"><span class="vu-ley-colores">${COLORES_BATERIA.slice(0, 4).map(c => `<i style="background:${c}"></i>`).join('')}</span><b>${total}</b> ▾</button>`;
    return `<div class="vu-leyenda-caja"><button type="button" class="vu-ley-cab" data-accion="leyenda"><b>${total}</b><span>▴ ocultar</span></button><div class="vu-ley-lista dos">${r.baterias.map(item).join('')}</div></div>`;
  }

  function htmlDetalle(r) {
    if (!r) return '';
    return `${r.avisos.length ? `<div class="vu-aviso"><ul>${r.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      ${r.modo === 'foto' ? htmlTablaGsd(r) : ''}
      <details class="vu-detalles"><summary>Detalle del cálculo</summary>
      <dl class="vu-tabla">
        ${fila('Área del sector', `${fmt(r.area / 10000, 2)} ha`)}
        ${fila('Huella de la foto', `${fmt(r.huellaAncho, 0)} × ${fmt(r.huellaLargo, 0)} m`)}
        ${r.barrido ? fila('Ancho de barrido LiDAR', `${fmt(r.barrido, 0)} m`) : ''}
        ${fila(`Separación entre ${r.corredor ? 'pasadas' : 'líneas'}`, `${fmt(r.sepLineas, 1)} m · ${fmt(r.nLineas)}`)}
        ${r.modo === 'foto' ? fila('Distancia entre fotos', `${fmt(r.sepFotos, 1)} m · cada ${fmt(r.intervalo, 1)} s`) : fila('Densidad en una pasada', `${fmt(r.densidadPasada, 0)} pts/m²`)}
        ${fila('Distancia de vuelo', `${fmt(r.distancia / 1000, 2)} km`)}
        ${r.trasladoM ? fila('Traslado desde el despegue (ida y vuelta)', `${fmt(r.trasladoM / 1000, 2)} km`) : ''}
        ${fila('Velocidad', `${fmt(r.velocidad, 1)} m/s${r.auto ? ' (sugerida)' : ''}`)}
        ${fila('Tiempo útil por batería', `${fmt(r.minUtiles, 0)} min`)}
      </dl>
      <p class="sis-tenue">Estimación para planificar y cotizar. El GSD es sobre el punto de despegue: con desnivel cambia. El vuelo se programa en DJI Pilot 2.</p>
      </details>`;
  }

  function opcionesGsd(r) {
    const h = st.hoja, d = dron(), g = geo(), i = secSel();
    const actual = Math.round(r.gsd * 100) / 100;
    const lista = [...new Set([...GSD_TABLA, ...st.gsdExtra, actual])].sort((a, b) => b - a);
    return lista.map(gs => {
      const altura = alturaParaGsd(d, gs);
      const a = calcularSector(h, d, g, i, { altura, modo: 'foto', velocidad: st.velA });
      const z = calcularSector(h, d, g, i, { altura, modo: 'foto', velocidad: st.velB });
      return { gsd: gs, altura, actual: Math.abs(gs - actual) < 0.005, a, z, sobre120: altura > 120 };
    });
  }

  function htmlTablaGsd(r) {
    const filas = opcionesGsd(r);
    return `<section class="sis-tarjeta vu-opciones">
      <div class="vu-opciones-cab"><h2>Opciones por GSD</h2>
        <label class="vu-vel">Velocidades <input type="number" data-vel="velA" value="${st.velA}" min="1" max="25" step="0.5" aria-label="Velocidad A"> y <input type="number" data-vel="velB" value="${st.velB}" min="1" max="25" step="0.5" aria-label="Velocidad B"> m/s</label></div>
      <div class="vu-tabla-scroll"><table class="vu-gsd">
        <thead><tr><th>GSD (cm/px)</th><th>Altura (m)</th><th>Tiempo a ${fmt(st.velA, 1)} m/s</th><th>Baterías</th><th>Tiempo a ${fmt(st.velB, 1)} m/s</th><th>Baterías</th><th></th></tr></thead>
        <tbody>${filas.map(f => `<tr class="${f.actual ? 'actual' : ''}${f.sobre120 ? ' sobre120' : ''}">
          <td>${fmt(f.gsd, 2)}${f.actual ? ' · actual' : ''}</td><td>${fmt(f.altura, 0)}${f.sobre120 ? ' ⚠' : ''}</td>
          <td>${fmtDuracion(f.a.minMision)}${st.velA > f.a.velSugerida + 0.05 ? ' <span class="vu-ojo" title="Sobre la velocidad sugerida para este GSD">*</span>' : ''}</td><td>${f.a.vuelos}</td>
          <td>${fmtDuracion(f.z.minMision)}${st.velB > f.z.velSugerida + 0.05 ? ' <span class="vu-ojo" title="Sobre la velocidad sugerida para este GSD">*</span>' : ''}</td><td>${f.z.vuelos}</td>
          <td><button type="button" class="vu-link" data-accion="usar-gsd" data-g="${f.gsd}">usar</button>${GSD_TABLA.includes(f.gsd) || f.actual ? '' : ` <button type="button" class="vu-link" data-accion="quitar-gsd" data-g="${f.gsd}" aria-label="Quitar">✕</button>`}</td>
        </tr>`).join('')}</tbody></table></div>
      <div class="vu-opciones-pie">
        <span class="vu-agregar"><input type="number" data-campo="gsdNuevo" placeholder="GSD" step="0.1" min="0.3" max="10" aria-label="GSD a agregar"><button type="button" class="sis-btn chico" data-accion="agregar-gsd">+ GSD</button></span>
        <button type="button" class="sis-btn chico" data-accion="copiar-tabla">Copiar para correo</button>
        <button type="button" class="sis-btn chico" data-accion="excel-tabla">Descargar Excel</button>
      </div>
      <p class="sis-tenue">Tiempo en el aire${geo().sectores.length > 1 ? ' del sector' : ''} con el dron y traslapes del plan. ⚠ sobre 120 m: requiere autorización DGAC. * sobre la velocidad sugerida.</p>
    </section>`;
  }

  return { vistaVuelo, htmlTotalHoja, pieVelocidad, htmlKpis, htmlBarraRumbo, htmlLeyenda, htmlDetalle, opcionesGsd, htmlTablaGsd };
}
