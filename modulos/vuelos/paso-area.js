// modulos/vuelos/paso-area.js — paso 1 de la hoja: origen del área, margen, corredor, sectores y zonas.

import { escapar as esc } from '../../compartido/util.js';
import { fmt, fmtDuracion } from './calculo.js';
import { deslizador } from './ui.js';
import { proyectar, areaM2 } from './calculo.js';
import { totales, kmADm } from './hoja.js';
import { formaDe, metodoPropuesto, METODOS, vistaPrevia, rumboCortesPropuesto } from './cortes.js';
import { revisarZonas, TIPOS_CAPA } from './capas.js';
import { COLORES_SECTOR, UMBRAL_BATERIAS } from './ui.js';

export function crearPasoArea(v) {
  const ref = n => (...a) => v[n](...a);
  const { st } = v;
  const geo = ref('geo');
  const dron = ref('dron');
  const capasActivas = ref('capasActivas');

  // ─────────── Paso 1 · Área ───────────
  function zonasDeHoja() {
    const g = geo();
    if (!g || !st.capas || !st.capas.length) return null;
    return revisarZonas(g.vuelo.map(g.marco.aLonLat), g.marco, st.capas, capasActivas());
  }

  // ─────────── Sub-pestañas del paso Área (v0.8): Origen · Forma · Sectores · Zonas y caminos ───────────
  const SUBS = [['origen', 'Origen'], ['forma', 'Forma'], ['sectores', 'Sectores'], ['zonas', 'Zonas y caminos']];
  function subActual() {
    const a = st.hoja.area;
    if (!a.tipo) return 'origen';
    return SUBS.some(([k]) => k === st.subArea) ? st.subArea : 'forma';
  }
  function htmlSubs(g) {
    const a = st.hoja.area, act = subActual();
    const zonas = g ? (zonasDeHoja() || []) : [];
    const cerca = zonas.filter(z => z.toca || z.distancia < 5000).length;
    const marca = { origen: a.tipo ? ' ✓' : '', forma: g ? ' ✓' : '', sectores: g && g.sectores.length > 1 ? ` · ${g.sectores.length}` : '', zonas: cerca ? ` · ${cerca}` : '' };
    return `<div class="vu-subs" role="tablist" aria-label="Partes del área">${SUBS.map(([k, t]) => `<button type="button" role="tab" aria-selected="${act === k}" class="vu-sub${act === k ? ' activo' : ''}${k === 'zonas' && cerca ? ' aviso' : ''}" data-accion="sub-area" data-s="${k}" ${!a.tipo && k !== 'origen' ? 'disabled' : ''}>${t}${marca[k]}</button>`).join('')}</div>`;
  }

  function htmlDm() {
    const dm = st.hoja.area.dm || {};
    return `<div class="vu-fila-campos">
        <label class="sis-campo"><span>DM del inicio del eje</span><input data-auto="dm" value="${esc(dm.texto || '')}" placeholder="ej. 0+000"></label>
        <label class="sis-check"><input type="checkbox" data-auto="desc" ${dm.desc ? 'checked' : ''}> El DM baja hacia el final del eje</label>
      </div>
      <p class="sis-tenue">Con el DM, los sectores se nombran por su tramo (10+000 – 15+000) y se puede cortar alineado al DM o por los tramos del Seguimiento.</p>`;
  }

  function htmlForma(g) {
    const a = st.hoja.area;
    if (a.tipo === 'corredor') return `<section class="sis-tarjeta"><h2>Corredor</h2>
        ${deslizador('izq', a.corredor.mismo ? 'Ancho a cada lado' : 'Hacia la izquierda', a.corredor.izq, { min: 5, max: 300, paso: 1, sufijo: 'm' })}
        ${a.corredor.mismo ? '' : deslizador('der', 'Hacia la derecha', a.corredor.der, { min: 5, max: 300, paso: 1, sufijo: 'm' })}
        <label class="sis-check"><input type="checkbox" data-area="mismo" ${a.corredor.mismo ? 'checked' : ''}> Mismo ancho a los dos lados</label>
        ${a.corredor.mismo ? '' : '<button class="sis-btn chico" data-accion="invertir">Invertir izquierda y derecha</button>'}
        <p class="sis-tenue" id="vu-margen-info">${g ? textoCorredor(g) : ''}</p>
        ${a.original ? '<button class="sis-btn chico" data-accion="a-poligono">Volver a volarla como polígono</button>' : ''}
      </section>
      <section class="sis-tarjeta"><h2>Cadenamiento</h2>${htmlDm()}</section>`;
    const f = g ? formaDe(st.hoja) : null;
    return `<section class="sis-tarjeta"><h2>Forma del área</h2>
        ${f && f.lineal ? `<div class="vu-forma"><b>Área lineal detectada</b>
            <dl><dt>Eje calculado</dt><dd>${fmt(f.largo / 1000, 2)} km</dd><dt>Ancho</dt><dd>mín. ${fmt(f.anchoMin, 0)} m · prom. ${fmt(f.anchoProm, 0)} m · máx. ${fmt(f.anchoMax, 0)} m</dd><dt>Superficie</dt><dd>${fmt(g.areaVuelo / 10000, 1)} ha</dd></dl>
            <p class="sis-tenue">El eje es la línea media entre los dos bordes (punteado blanco en el mapa). Con él se corta por DM y cada sector lleva su propio despegue.</p></div>
          <fieldset class="vu-como"><legend>Cómo volarla</legend>
            <label class="sis-check"><input type="radio" name="comoVolar" checked> <span><b>Polígono por sectores</b><small>Líneas paralelas dentro de cada sector, con su rumbo y su despegue.</small></span></label>
            <label class="sis-check"><input type="radio" name="comoVolar" data-accion-cambio="a-corredor"> <span><b>Corredor sobre el eje</b><small>Pasadas a lo largo del eje con el ancho medido (${fmt(Math.round(f.anchoMax / 2), 0)} m a cada lado). Para el modo corredor de DJI Pilot 2.</small></span></label>
          </fieldset>
          ${htmlDm()}`
        : g ? `<p><b>Área extensa</b> · ${fmt(g.areaVuelo / 10000, 1)} ha. Para dividirla, usa «En N sectores» en la pestaña Sectores (cortes paralelos con la dirección que elijas).</p>` : ''}
      </section>
      <section class="sis-tarjeta"><h2>Margen</h2>
        ${deslizador('margen', 'Margen hacia afuera', a.margen || 0, { min: 0, max: 100, paso: 1, sufijo: 'm' })}
        <div class="vu-pildoras">${[0, 20, 30, 50].map(m => `<button type="button" class="vu-pildora${Number(a.margen) === m ? ' activo' : ''}" data-accion="margen" data-m="${m}">${m ? `${m} m` : 'Sin margen'}</button>`).join('')}</div>
        <label class="sis-check"><input type="checkbox" data-area="rectas" ${a.rectas !== false ? 'checked' : ''}> Esquinas rectas (como se hace a mano)</label>
        <p class="sis-tenue" id="vu-margen-info">${g ? `${fmt(areaM2(g.original) / 10000, 2)} ha → <b>${fmt(g.areaVuelo / 10000, 2)} ha</b> de vuelo` : ''}</p>
      </section>`;
  }

  /** Texto de la vista previa de los cortes (sin calcular vuelos). */
  function htmlVistaPrevia() {
    const v0 = vistaPrevia(st.hoja);
    return v0 ? `Vista previa: <b>${v0.sectores} sector${v0.sectores === 1 ? '' : 'es'}</b> · ~${fmt(v0.haPorSector, 1)} ha cada uno` : '';
  }

  function htmlCortes(g) {
    const a = st.hoja.area, au = a.auto || {}, f = g ? formaDe(st.hoja) : null;
    const propuesto = metodoPropuesto(f);
    const modo = au.modo || propuesto;
    const opt = k => `<option value="${k}" ${modo === k ? 'selected' : ''}>${METODOS[k].texto}${k === propuesto ? ' (propuesto)' : ''}</option>`;
    const lineal = f && f.lineal;
    const num = (k, t, val, extra = '') => `<label class="sis-campo"><span>${t}</span><input type="number" data-auto="${k}" value="${esc(val)}" ${extra}></label>`;
    const sel = (k, t, val, ops) => `<label class="sis-campo"><span>${t}</span><select data-auto="${k}">${ops.map(([v, x]) => `<option value="${v}" ${val === v ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`;
    const campos = {
      distancia: () => `${num('cada', 'Cortar cada', au.cada ?? '5', 'min="0" step="any"')}${sel('unidad', 'Unidad', au.unidad || 'km', [['km', 'km'], ['m', 'm']])}`,
      superficie: () => `${num('sup', 'Superficie de cada sector', au.sup ?? '50', 'min="0" step="any"')}${sel('unidadSup', 'Unidad', au.unidadSup || 'ha', [['ha', 'ha'], ['km2', 'km²']])}`,
      dm: () => `${num('cada', 'Cortar cada', au.cada ?? '1', 'min="0" step="any"')}${sel('unidad', 'Unidad', au.unidad || 'km', [['km', 'km'], ['m', 'm']])}<label class="sis-campo"><span>Primer corte en el DM</span><input data-auto="primer" value="${esc(au.primer || '')}" placeholder="vacío: DM redondos"></label>`,
      tramos: () => '',
      n: () => `<label class="sis-campo vu-ancho"><span>Cantidad de sectores: <b id="vu-n-txt">${esc(au.n || 4)}</b></span><input type="range" min="2" max="30" step="1" data-auto="n" value="${esc(au.n || 4)}"></label>
        ${lineal && a.tipo === 'corredor' ? '' : `<div class="sis-campo vu-ancho"><span>Dirección de los cortes</span><div class="vu-rumbo-corte">
          <button type="button" class="sis-btn chico" data-accion="auto-rumbo" data-d="-5" aria-label="Girar 5 grados a la izquierda">⟲ 5°</button>
          <input type="number" min="0" max="179" data-auto="rumbo" value="${esc(au.rumbo === '' || au.rumbo == null ? Math.round(rumboCortesPropuesto(st.hoja)) : au.rumbo)}" aria-label="Rumbo de los cortes en grados">
          <button type="button" class="sis-btn chico" data-accion="auto-rumbo" data-d="5" aria-label="Girar 5 grados a la derecha">⟳ 5°</button>
          <button type="button" class="sis-btn chico" data-accion="auto-lado">Lado más largo</button></div></div>
        <label class="sis-check"><input type="checkbox" data-auto="igual" ${au.igual !== false ? 'checked' : ''}> Igual superficie (si no, igual distancia)</label>`}`,
      baterias: () => num('bat', 'Baterías por sector (máx.)', au.bat ?? '4', 'min="1" max="30"'),
      dias: () => num('horas', 'Horas de vuelo por día', au.horas ?? '6', 'min="1" max="14" step="0.5"'),
      manual: () => '',
    };
    return `<section class="sis-tarjeta"><h2>Cortes</h2>
      <label class="sis-campo"><span>Método de corte</span><select data-auto="modo">
        <optgroup label="Área lineal (usa el eje)">${lineal ? ['distancia', 'superficie', 'dm', 'tramos'].map(opt).join('') : '<option disabled>Solo para áreas lineales</option>'}</optgroup>
        <optgroup label="Cualquier área">${['n', 'baterias', 'dias'].map(opt).join('')}</optgroup>
        <optgroup label="A mano">${opt('manual')}</optgroup>
      </select></label>
      <div class="vu-fila-campos">${(campos[modo] || (() => ''))()}</div>
      <p class="sis-tenue">${esc(METODOS[modo] ? METODOS[modo].ayuda : '')}</p>
      <p class="vu-vista-previa" id="vu-vista-previa">${htmlVistaPrevia()}</p>
      <div class="sis-acciones">${modo === 'manual'
        ? `<button class="sis-btn chico${st.dibujo && st.dibujo.modo === 'corte' ? ' primario' : ''}" data-accion="dibujar" data-modo="corte">✎ Trazar corte</button>`
        : '<button class="sis-btn chico primario" data-accion="auto-cortar">Generar cortes</button>'}
        ${a.cortes.length ? '<button class="sis-btn chico" data-accion="deshacer-corte">Deshacer último corte</button><button class="sis-btn chico" data-accion="quitar-cortes">Quitar todos</button>' : ''}</div>
      <p class="sis-tenue">Los cortes generados quedan como los manuales: sus vértices blancos se arrastran en el mapa.</p>
    </section>`;
  }

  function vistaArea() {
    const h = st.hoja, a = h.area, g = geo(), d = dron(), t = g && d ? totales(h, d, g) : null;
    const grande = t && (t.baterias > UMBRAL_BATERIAS || t.excede) && g.sectores.length === 1;
    const sub = subActual();
    let tarjetas = '';
    if (sub === 'origen') tarjetas = `<section class="sis-tarjeta"><h2>Origen</h2>
            <div class="sis-acciones">
              <label class="sis-btn vu-archivo">Cargar KML / KMZ<input type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" data-archivo="area" hidden></label>
              <button class="sis-btn${st.dibujo && st.dibujo.modo === 'area' ? ' primario' : ''}" data-accion="dibujar" data-modo="area">Dibujar área</button>
              <button class="sis-btn${st.dibujo && st.dibujo.modo === 'eje' ? ' primario' : ''}" data-accion="dibujar" data-modo="eje">Dibujar eje</button>
            </div>
            ${st.candidatos ? vistaCandidatos() : ''}
            ${a.tipo ? `<p class="sis-tenue vu-area-info">${esc(a.archivo || '')} · ${a.tipo === 'corredor' ? `eje de ${fmt((a.eje.largo || 0) / 1000, 2)} km · ${a.eje.linea.length} vértices` : `${fmt(areaM2(proyectar(a.original.anillo).puntos) / 10000, 2)} ha · ${a.original.anillo.length} vértices`}</p>
              ${(a.problemas || []).length ? `<div class="vu-aviso"><b>Detalles que se corrigen al descargar:</b><ul>${a.problemas.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
              <div class="sis-acciones"><button class="sis-btn chico" data-accion="kml-original">Descargar ${a.tipo === 'corredor' ? 'eje' : 'área del mandante'} limpio (KML)</button>${g ? '<button class="sis-btn chico primario" data-accion="sub-area" data-s="forma">Siguiente: Forma →</button>' : ''}</div>` : ''}
          </section>`;
    else if (sub === 'forma') tarjetas = `${htmlForma(g)}${g ? '<div class="sis-acciones"><button class="sis-btn chico primario" data-accion="sub-area" data-s="sectores">Siguiente: Sectores →</button></div>' : ''}`;
    else if (sub === 'sectores') tarjetas = g ? `${htmlCortes(g)}<section class="sis-tarjeta"><h2>Sectores</h2><div id="vu-sectores">${htmlSectores()}</div></section>` : '';
    else tarjetas = `<section class="sis-tarjeta"><h2>Zonas de referencia</h2><div id="vu-zonas">${htmlZonas()}</div></section>${htmlCaminos()}`;
    return `${grande ? `<div class="vu-banner"><div><b>El área es grande: ${fmt(g.areaVuelo / 10000, 0)} ha · ${t.baterias} baterías · unas ${fmtDuracion(t.minVuelo)} de vuelo</b>
        <span>${t.excede ? 'Parte del recorrido queda más lejos de lo que alcanza una batería desde el despegue. ' : ''}Dividirla en sectores te deja planificar por día o por punto de despegue, con un rumbo y un KML para cada uno.</span></div>
        <button class="sis-btn primario" data-accion="sub-area" data-s="sectores">Dividir en sectores</button></div>` : ''}
      <div class="vu-dos vu-area">
        <div class="vu-izquierda">${htmlSubs(g)}${tarjetas}</div>
        <div class="vu-derecha">
          <div class="vu-mapa-caja vu-mapa-alto"><div class="vu-mapa-lugar" data-mapa="area"></div><div class="vu-mapa-barra" id="vu-barra-area">${barraDibujo()}</div></div>
          <p class="sis-tenue vu-pie">Punteado blanco: área del mandante y eje · naranjo: área de vuelo · colores: sectores · puntos azules: aeródromos.</p>
        </div>
      </div>`;
  }
  const textoCorredor = g => `${fmt(g.izq + g.der, 0)} m × ${fmt(g.sectores.reduce((s, x) => s + x.largo, 0) / 1000, 2)} km = <b>${fmt(g.areaVuelo / 10000, 2)} ha</b>. Las pasadas siguen el eje.`;

  function vistaCandidatos() {
    const c = st.candidatos;
    const contornos = c.poligonos.filter(p => !p.abierta);
    return `<div class="vu-candidatos"><p><b>${esc(c.archivo)}</b> trae ${contornos.length ? `${contornos.length} contorno${contornos.length > 1 ? 's' : ''}` : ''}${contornos.length && c.ejes.length ? ' y ' : ''}${c.ejes.length ? `${c.ejes.length} línea${c.ejes.length > 1 ? 's' : ''} abierta${c.ejes.length > 1 ? 's' : ''}` : ''}. ¿Cuál uso?</p>
      <div class="sis-lista">${c.ejes.map((e, i) => { const j = c.poligonos.findIndex(p => p.abierta && p.nombre === e.nombre); return `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(e.nombre)}</b><span class="sis-tenue">Línea de ${fmt(e.largo / 1000, 2)} km · ${e.vertices} vértices</span></span>
          <span class="sis-acciones"><button class="sis-btn chico primario" data-accion="usar-eje" data-i="${i}">Como eje de corredor</button>${j >= 0 ? `<button class="sis-btn chico" data-accion="usar-pol" data-i="${j}">Cerrarla como contorno</button>` : ''}</span></div>`; }).join('')}
        ${contornos.map(p => { const i = c.poligonos.indexOf(p); return `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(p.nombre)}</b><span class="sis-tenue">${fmt(p.area / 10000, 2)} ha · ${p.vertices} vértices</span></span>
          <span class="sis-acciones"><button class="sis-btn chico primario" data-accion="usar-pol" data-i="${i}">Usar este contorno</button></span></div>`; }).join('')}</div>
      <button class="vu-link" data-accion="cerrar-candidatos">Cancelar</button></div>`;
  }

  function htmlSectores() {
    const h = st.hoja, g = geo(), d = dron();
    if (!g) return '';
    const t = d ? totales(h, d, g) : null;
    return `${g.fallidos.length ? '<div class="vu-aviso">Un corte no atraviesa el área de lado a lado y no se aplicó: arrastra sus puntos o deshazlo.</div>' : ''}
      <div class="vu-sectores">${g.sectores.map((s, i) => { const r = t && t.sectores[i]; return `<div class="vu-sector">
        <i style="background:${COLORES_SECTOR[i % COLORES_SECTOR.length]}"></i>
        ${g.sectores.length > 1 ? `<input class="vu-sector-nombre" data-sector-nombre="${i}" value="${esc((h.area.sectores[i] && h.area.sectores[i].nombre) || '')}" placeholder="${esc(g.sectores[i].dm ? `${kmADm(g.sectores[i].dm[0])} – ${kmADm(g.sectores[i].dm[1])}` : `S${i + 1}`)}" aria-label="Nombre del sector ${i + 1}">` : '<b>Área completa</b>'}
        <span class="vu-sector-dato">${fmt(s.area / 10000, 1)} ha${r ? ` · ${r.vuelos} bat. · ${fmtDuracion(r.minTotal)}` : ''}</span>
        <span class="vu-sector-acc">${g.sectores.length > 1 ? `<button class="vu-link" data-accion="kml-sector" data-i="${i}">KML</button>` : ''}<button class="vu-link" data-accion="ir-sector" data-i="${i}">volar →</button></span>
      </div>`; }).join('')}</div>
      ${g.sectores.length > 1 && t ? `<p class="vu-total">Total: ${g.sectores.length} sectores · ${t.baterias} baterías · ${fmtDuracion(t.minJornada)} de jornada</p>
        <div class="sis-acciones"><button class="sis-btn chico" data-accion="kml-sectores">Descargar KML de cada sector</button></div>` : ''}`;
  }

  function htmlZonas() {
    const capas = st.capas || [];
    const form = `<div class="vu-capa-form"><select data-campo="tipoCapa" aria-label="Tipo de capa">${Object.entries(TIPOS_CAPA).map(([k, v]) => `<option value="${k}">${v.nombre}</option>`).join('')}</select>
      <label class="sis-btn chico vu-archivo">+ Cargar capa (KMZ, KML o JSON)<input type="file" accept=".kml,.kmz,.json,.geojson" data-archivo="capa" hidden></label></div>`;
    if (!capas.length) return `<p class="sis-tenue">Aún no hay capas. Carga los archivos de aeródromos, zonas restringidas (DGAC) o áreas protegidas (CONAF) y se revisan contra el área.</p>${form}`;
    const activas = capasActivas();
    const zonas = zonasDeHoja();
    return `${zonas && zonas.length ? `<div class="vu-zonas-res">${zonas.slice(0, 4).map(z => `<div class="${z.toca ? 'vu-rojo' : ''}"><i style="background:${TIPOS_CAPA[z.tipo].color}"></i><span>${z.toca ? '<b>Toca</b> ' : ''}${esc(z.nombre)}${z.toca ? '' : ` · a ${fmt(z.distancia / 1000, 1)} km`}<small>${esc(z.capa)}</small></span></div>`).join('')}</div>`
      : geo() ? '<p class="vu-verde">No hay zonas cargadas a menos de 60 km.</p>' : ''}
      <fieldset class="vu-capas"><legend>Capas</legend>${capas.map(c => `<label class="sis-check"><input type="checkbox" data-capa="${esc(c.id)}" ${activas.includes(c.id) ? 'checked' : ''}><i style="background:${TIPOS_CAPA[c.tipo].color}"></i>${esc(c.nombre)} <small>${esc(c.fecha || '')}${c.origen === 'usuario' ? ' · cargada aquí' : ''}</small>${c.origen === 'usuario' ? ` <button class="vu-link" data-accion="quitar-capa" data-id="${esc(c.id)}">quitar</button>` : ''}</label>`).join('')}</fieldset>
      ${form}
      <p class="sis-tenue">Referencial. La información aeronáutica oficial está en AIP Chile (DGAC).</p>`;
  }

  // Caminos: red vial del MOP (capa) y caminos propios de la hoja, para sugerir el despegue en el paso Vuelo.
  function htmlCaminos() {
    const cam = st.hoja.area.caminos || [];
    const dib = st.dibujo && st.dibujo.modo === 'camino';
    return `<section class="sis-tarjeta"><h2>Caminos</h2>
      <label class="sis-check"><input type="checkbox" data-redvial ${st.redVial ? 'checked' : ''}> Mostrar la red vial del MOP en los mapas</label>
      ${st.redVial ? `<p class="sis-tenue vu-caminos-info">${esc(st.redVialInfo || 'Cargando la red vial de la región…')}</p>` : ''}
      ${cam.length ? `<ul class="vu-caminos">${cam.map((c, k) => `<li><i></i>${esc(c.nombre || 'Camino')} <button class="vu-link" data-accion="quitar-camino" data-i="${k}">quitar</button></li>`).join('')}</ul>` : ''}
      <div class="sis-acciones">
        <button class="sis-btn chico${dib ? ' primario' : ''}" data-accion="dibujar" data-modo="camino">✎ Dibujar camino</button>
        <label class="sis-btn chico vu-archivo">Cargar camino (KML o KMZ)<input type="file" accept=".kml,.kmz" data-archivo="camino" hidden></label>
      </div>
      <p class="sis-tenue">Agrega huellas o accesos que no estén en la red del MOP. En el paso 2 (Vuelo) se sugiere el despegue de cada sector sobre estos caminos. Es solo una referencia: acceso, rejas, permisos y línea de vista se confirman en terreno.</p>
    </section>`;
  }

  function barraDibujo() {
    const dib = st.dibujo;
    if (!dib) return st.hoja && !geo() ? '<span class="vu-barra-txt">Carga un KML/KMZ o dibuja el área o el eje.</span>' : '';
    const min = dib.modo === 'area' ? 3 : 2;
    const txt = { area: 'Toca el mapa para marcar los vértices del área', eje: 'Toca el mapa siguiendo el eje del corredor', corte: 'Toca afuera del área, sigue el camino y termina afuera', camino: 'Toca el mapa siguiendo el camino o la huella' }[dib.modo];
    return `<span class="vu-barra-txt">${txt} · ${dib.puntos.length} punto${dib.puntos.length === 1 ? '' : 's'}</span>
      <button type="button" class="vu-barra-btn" data-accion="dibujo-deshacer" ${dib.puntos.length ? '' : 'disabled'}>Deshacer</button>
      <button type="button" class="vu-barra-btn fuerte" data-accion="dibujo-terminar" ${dib.puntos.length >= min ? '' : 'disabled'}>Terminar</button>
      <button type="button" class="vu-barra-btn" data-accion="dibujo-cancelar">Cancelar</button>`;
  }

  return { zonasDeHoja, vistaArea, textoCorredor, htmlSectores, htmlZonas, barraDibujo, htmlVistaPrevia };
}
