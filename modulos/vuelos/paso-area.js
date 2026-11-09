// modulos/vuelos/paso-area.js — paso 1 de la hoja: origen del área, margen, corredor, sectores y zonas.

import { escapar as esc } from '../../compartido/util.js';
import { fmt, fmtDuracion } from './calculo.js';
import { deslizador } from './ui.js';
import { proyectar, areaM2 } from './calculo.js';
import { totales, kmADm, kmEnEje, lineaEje, marcoDe, geometria } from './hoja.js';
import { largo } from './geom.js';
import { FORMATOS_CAMINO } from './formatos.js';
import { formaDe, metodoPropuesto, METODOS, METODOS_LINEALES, vistaPrevia, rumboCortesPropuesto, tramosVistaPrevia, generarCortes } from './cortes.js';
import { revisarZonas, TIPOS_CAPA } from './capas.js';
import { COLORES_SECTOR, UMBRAL_BATERIAS } from './ui.js';

export function crearPasoArea(v) {
  const ref = n => (...a) => v[n](...a);
  const { st, base } = v;
  const geo = ref('geo');
  const dron = ref('dron');
  const capasActivas = ref('capasActivas');
  const familias = ref('familias');

  // ─────────── Paso 1 · Área ───────────
  function zonasDeHoja() {
    const g = geo();
    if (!g || !st.capas || !st.capas.length) return null;
    return revisarZonas(g.vuelo.map(g.marco.aLonLat), g.marco, st.capas, capasActivas());
  }

  // ─────────── Sub-pestañas del paso Área (v0.8): Origen · Forma · Sectores · Zonas y caminos ───────────
  // v0.11: «Zonas y caminos» pasa a ser una leyenda desplegable dentro de Sectores.
  const SUBS = [['origen', 'Origen'], ['forma', 'Forma'], ['sectores', 'Sectores']];
  function subActual() {
    const a = st.hoja.area;
    if (!a.tipo) return 'origen';
    if (st.subArea === 'zonas') { st.subArea = 'sectores'; st.zonasAbiertas = true; }
    return SUBS.some(([k]) => k === st.subArea) ? st.subArea : 'forma';
  }
  function htmlSubs(g) {
    const a = st.hoja.area, act = subActual();
    const zonas = g ? (zonasDeHoja() || []) : [];
    const cerca = zonas.filter(z => z.toca || z.distancia < 5000).length;
    const marca = { origen: a.tipo ? ' ✓' : '', forma: g ? ' ✓' : '', sectores: `${g && g.sectores.length > 1 ? ` · ${g.sectores.length}` : ''}${cerca ? ' · !' : ''}` };
    return `<div class="vu-subs" role="tablist" aria-label="Partes del área">${SUBS.map(([k, t]) => `<button type="button" role="tab" aria-selected="${act === k}" class="vu-sub${act === k ? ' activo' : ''}${k === 'sectores' && cerca ? ' aviso' : ''}" data-accion="sub-area" data-s="${k}" ${!a.tipo && k !== 'origen' ? 'disabled' : ''}>${t}${marca[k]}</button>`).join('')}</div>`;
  }

  /** DM (km) del inicio y del fin del eje en el sentido de avance, o null si no hay eje. */
  function extremosEje() {
    const a = st.hoja.area, linea = lineaEje(a);
    if (!linea || linea.length < 2) return null;
    const m = marcoDe(linea), L = largo(linea.map(m.aXY));
    return { L, ini: kmEnEje(a, a.dm && a.dm.inv ? L : 0, L), fin: kmEnEje(a, a.dm && a.dm.inv ? 0 : L, L) };
  }
  function htmlDm() {
    const dm = st.hoja.area.dm || {}, x = extremosEje();
    return `<div class="vu-sentido">
        <div class="vu-sentido-fila"><span class="vu-marca-ini">Inicio</span><b class="vu-mono">${x ? kmADm(x.ini) : '—'}</b><span class="sis-tenue">${dm.inv ? 'último vértice del archivo' : 'primer vértice del archivo'}</span></div>
        <div class="vu-sentido-fila"><span class="vu-marca-fin">Fin</span><b class="vu-mono">${x ? kmADm(x.fin) : '—'}</b><span class="sis-tenue">${dm.inv ? 'primer vértice del archivo' : 'último vértice del archivo'}</span></div>
        <button type="button" class="sis-btn chico" data-accion="invertir-sentido">⇄ Invertir sentido</button>
        <p class="sis-tenue">El inicio y el fin se marcan en el mapa, con flechas en el sentido de avance. Al invertir, el DM, el orden de los sectores (S1 en el inicio) y sus nombres se recalculan.</p>
      </div>
      <div class="vu-fila-campos">
        <label class="sis-campo"><span>DM del inicio del eje</span><input data-auto="dm" value="${esc(dm.texto || '')}" placeholder="0+000"></label>
        <label class="sis-check"><input type="checkbox" data-auto="desc" ${dm.desc ? 'checked' : ''}> El DM decrece hacia el fin</label>
      </div>
      <p class="sis-tenue">Con el DM, los sectores se nombran por su tramo (10+000 – 15+000). Sin DM del inicio se cuenta desde 0+000.</p>`;
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
      <section class="sis-tarjeta"><h2>Sentido y cadenamiento del eje</h2>${htmlDm()}</section>`;
    const f = g ? formaDe(st.hoja) : null;
    return `<section class="sis-tarjeta"><h2>Forma del área</h2>
        ${f && f.lineal ? `<div class="vu-forma"><b>Área lineal detectada</b>
            <dl><dt>Eje calculado</dt><dd>${fmt(f.largo / 1000, 2)} km</dd><dt>Ancho</dt><dd>mín. ${fmt(f.anchoMin, 0)} m · prom. ${fmt(f.anchoProm, 0)} m · máx. ${fmt(f.anchoMax, 0)} m</dd><dt>Superficie</dt><dd>${fmt(g.areaVuelo / 10000, 1)} ha</dd></dl>
            <p class="sis-tenue">El eje es la línea media entre los dos bordes (punteado blanco en el mapa). Con él se corta por DM y cada sector lleva su propio despegue.</p></div>
          <fieldset class="vu-como"><legend>Cómo volarla</legend>
            <label class="sis-check"><input type="radio" name="comoVolar" checked> <span><b>Polígono por sectores</b><small>Líneas paralelas dentro de cada sector, con su rumbo y su despegue.</small></span></label>
            <label class="sis-check"><input type="radio" name="comoVolar" data-accion-cambio="a-corredor"> <span><b>Corredor sobre el eje</b><small>Pasadas a lo largo del eje con el ancho medido (${fmt(Math.round(f.anchoMax / 2), 0)} m a cada lado). Para el modo corredor de DJI Pilot 2.</small></span></label>
          </fieldset>
          <h3 class="vu-subtit">Sentido y cadenamiento del eje</h3>${htmlDm()}`
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
    const au = st.hoja.area.auto || {}, modo = au.modo || metodoPropuesto(formaDe(st.hoja));
    if (modo === 'medida') {
      const t = tramosVistaPrevia(st.hoja);
      if (!t) return '';
      const n = t.tramos.length, lista = n <= 6 ? t.tramos.join(' · ') : `${t.tramos.slice(0, 4).join(' · ')} · … · ${t.tramos[n - 1]}`;
      return `Vista previa: <b>${n} sector${n === 1 ? '' : 'es'}</b><span class="vu-mono vu-tramos">${esc(lista)}</span>`;
    }
    const v0 = vistaPrevia(st.hoja);
    return v0 ? `Vista previa: <b>${v0.sectores} sector${v0.sectores === 1 ? '' : 'es'}</b> · ~${fmt(v0.haPorSector, 1)} ha cada uno` : '';
  }

  /** v0.11.3: estado de los cortes (aplicados, propuesta por aplicar o edición manual) con Aplicar / Descartar. */
  function htmlPropuesta(modo) {
    const a = st.hoja.area, g = geometria(st.hoja), n = g ? g.sectores.length : 1;
    const aplicados = `<span class="vu-aplicados">Aplicado: <b>${n} sector${n === 1 ? '' : 'es'}</b>${a.aplicado && METODOS[a.aplicado.modo] ? ` · ${esc(METODOS[a.aplicado.modo].texto)}` : ''}</span>`;
    const p = st.propuesta;
    if (p) return `<div class="vu-propuesta"><span><b>Propuesta: ${p.sectores} sector${p.sectores === 1 ? '' : 'es'}</b>${p.baterias != null ? ` · ${p.baterias} baterías · ${fmtDuracion(p.minJornada)} de jornada` : ''}${p.fallidos ? ` · <span class="vu-rojo">${p.fallidos} corte${p.fallidos > 1 ? 's' : ''} no cruza${p.fallidos > 1 ? 'n' : ''}</span>` : ''}${p.nota ? `<small>${esc(p.nota)}</small>` : ''}<small>Se ve punteada en el mapa. ${aplicados}</small></span>
        <span class="vu-propuesta-acc"><button class="sis-btn primario" data-accion="aplicar-cortes">Aplicar</button><button class="sis-btn chico" data-accion="descartar-cortes">Descartar</button></span></div>`;
    if (st.respaldoCortes && MANUALES.includes(modo)) return `<div class="vu-propuesta"><span><b>Editando cortes a mano</b><small>Los cambios se ven en el mapa. «Descartar cambios» vuelve a como estaban.</small></span>
        <span class="vu-propuesta-acc"><button class="sis-btn primario" data-accion="aplicar-cortes">Aplicar</button><button class="sis-btn chico" data-accion="descartar-cortes">Descartar cambios</button></span></div>`;
    return `<p class="sis-tenue">${aplicados}</p>`;
  }

  function htmlCortes(g) {
    const a = st.hoja.area, au = a.auto || {}, f = g ? formaDe(st.hoja) : null;
    const propuesto = metodoPropuesto(f);
    const modo = au.modo || propuesto;
    const lineal = f && f.lineal;
    const num = (k, t, val, extra = '') => `<label class="sis-campo"><span>${t}</span><input type="number" data-auto="${k}" value="${esc(val)}" ${extra}></label>`;
    const sel = (k, t, val, ops) => `<label class="sis-campo"><span>${t}</span><select data-auto="${k}">${ops.map(([v, x]) => `<option value="${v}" ${val === v ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`;
    const marcando = st.dibujo && st.dibujo.modo === 'dmfijo';
    const fijos = au.fijos || [];
    const ultimo = fijos.length ? fijos[fijos.length - 1] : null;
    const campos = {
      medida: () => `<div class="sis-campo vu-ancho"><span>Cortes fijos (DM)</span>
          <div class="vu-chips">${fijos.length ? fijos.map((f, i) => `<span class="vu-chip-dm">${esc(f)}<button type="button" data-accion="quitar-fijo" data-i="${i}" aria-label="Quitar el corte ${esc(f)}">✕</button></span>`).join('') : '<span class="sis-tenue">Sin cortes fijos: se corta desde el inicio.</span>'}</div>
          <div class="vu-fila-dm"><input id="vu-nuevo-fijo" placeholder="ej. 4+900" aria-label="DM del corte fijo"><button type="button" class="sis-btn chico" data-accion="agregar-fijo">+ Agregar</button>
            <button type="button" class="sis-btn chico${marcando ? ' primario' : ''}" data-accion="dibujar" data-modo="dmfijo">◎ ${marcando ? 'Marcando en el mapa' : 'Marcar en el mapa'}</button></div></div>
        ${num('cada', ultimo ? `Después de ${esc(ultimo)}, cortar cada` : 'Cortar cada', au.cada ?? '5', 'min="0" step="any"')}${sel('unidad', 'Unidad', au.unidad || 'km', [['km', 'km'], ['m', 'm']])}`,
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
      ${htmlTipoCorte(modo)}
      ${htmlMiniaturas(g, modo, propuesto)}
      <h3 class="vu-subt">${esc(METODOS[modo] ? METODOS[modo].texto : '')}${modo === propuesto ? ' <small class="sis-tenue">(propuesto)</small>' : ''}</h3>
      <div class="vu-fila-campos">${(campos[modo] || (() => ''))()}</div>
      <p class="sis-tenue">${esc(METODOS[modo] ? METODOS[modo].ayuda : '')}</p>
      <p class="vu-vista-previa" id="vu-vista-previa">${htmlVistaPrevia()}</p>
      ${htmlPropuesta(modo)}
      <div class="sis-acciones">${modo === 'manual'
        ? `<button class="sis-btn chico${st.dibujo && st.dibujo.modo === 'corte' ? ' primario' : ''}" data-accion="dibujar" data-modo="corte">✎ Trazar corte</button>`
        : modo === 'vertices'
          ? `<button class="sis-btn chico${st.dibujo && st.dibujo.modo === 'vertice' ? ' primario' : ''}" data-accion="dibujar" data-modo="vertice">◎ ${st.dibujo && st.dibujo.modo === 'vertice' ? 'Tocando vértices en el mapa' : 'Tocar vértices'}</button>`
          : `<button class="sis-btn ${st.propuesta ? 'chico' : 'primario'}" data-accion="auto-cortar">✂ Cortar${st.propuesta ? ' de nuevo' : ''}</button>`}
        ${a.cortes.length && MANUALES.includes(modo) ? '<button class="sis-btn chico" data-accion="deshacer-corte">Deshacer último corte</button><button class="sis-btn chico" data-accion="quitar-cortes">Quitar todos</button>' : ''}</div>
      <p class="sis-tenue">«Cortar» muestra la propuesta punteada en el mapa sin tocar los sectores actuales; «Aplicar» la deja en la hoja. Los vértices blancos de los cortes aplicados se arrastran en el mapa.</p>
    </section>`;
  }

  // ─────────── Vista previa de cada método de corte (v0.11) ───────────
  function svgSectores(polis, sel, gris) {
    const todos = polis.flat();
    if (!todos.length) return '';
    const xs = todos.map(p => p[0]), ys = todos.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const W = 160, H = 96, m = 5, k = Math.min((W - 2 * m) / ((x1 - x0) || 1), (H - 2 * m) / ((y1 - y0) || 1));
    const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
    const pt = p => `${(ox + (p[0] - x0) * k).toFixed(1)},${(H - oy - (p[1] - y0) * k).toFixed(1)}`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" aria-hidden="true">${polis.map((pl, i) => { const paso = Math.max(1, Math.ceil(pl.length / 150));
      return `<polygon points="${pl.filter((_, j) => j % paso === 0).map(pt).join(' ')}" fill="${gris ? '#C9CED4' : COLORES_SECTOR[i % COLORES_SECTOR.length]}" fill-opacity="${sel ? 0.75 : 0.55}" stroke="#1C1F23" stroke-width="1.2" stroke-linejoin="round"></polygon>`; }).join('')}</svg>`;
  }
  const MANUALES = ['vertices', 'manual'];
  /** Automático o manual (v0.11.1): el tipo sale del método elegido. */
  function htmlTipoCorte(modo) {
    const manual = MANUALES.includes(modo);
    return `<div class="vu-tipo-corte" role="group" aria-label="Tipo de corte">
        <button type="button" class="${manual ? '' : 'activo'}" data-accion="tipo-corte" data-t="auto" aria-pressed="${!manual}"><b>Automático</b><small>La app propone los cortes</small></button>
        <button type="button" class="${manual ? 'activo' : ''}" data-accion="tipo-corte" data-t="manual" aria-pressed="${manual}"><b>Manual</b><small>Tú marcas cada corte en el mapa</small></button></div>`;
  }
  /** Métodos que se muestran según el tipo de corte y la forma del área. */
  function metodosVisibles(modo) {
    const a = st.hoja.area, f = formaDe(st.hoja), corredor = a.tipo === 'corredor';
    if (MANUALES.includes(modo)) return corredor ? ['manual'] : ['vertices', 'manual'];
    return [...(f && f.lineal ? METODOS_LINEALES : []), 'n', ...(corredor ? [] : ['cerrados']), 'baterias', 'dias'];
  }
  function htmlMiniaturas(g, modo, propuesto) {
    const h = st.hoja, a = h.area, au = a.auto || {};
    const lista = metodosVisibles(modo);
    const clave = JSON.stringify([lista, g.vuelo.length, g.vuelo[0], a.margen, a.rectas, a.corredor, a.dm, au, h.dronId, h.params, a.ejeCalc ? a.ejeCalc.largo : 0, MANUALES.includes(modo) ? [modo, a.cortes] : null]);
    if (!st.previas || st.previas.clave !== clave) {
      const datos = lista.map(k => {
        // Manuales: muestran los cortes que ya marcaste (si el método está en uso) o el área sin cortar.
        if (MANUALES.includes(k)) {
          const cortes = modo === k ? a.cortes : [];
          const gp = geometria({ ...h, area: { ...a, cortes, sectores: [] } });
          return { k, polis: gp ? gp.sectores.map(x => x.poligono) : [g.vuelo], n: gp ? gp.sectores.length : 1, pendiente: !cortes.length };
        }
        if (k === 'tramos') return { k, polis: [g.vuelo], n: 1, falta: 'usa los tramos del Seguimiento' };
        if (k === 'dm' && (!a.dm || a.dm.inicio == null)) return { k, polis: [g.vuelo], n: 1, falta: 'falta el DM del inicio' };
        try {
          const cortes = generarCortes({ ...h, area: { ...a, auto: { ...au, modo: k }, cortes: [], sectores: [] } }, { dron: dron(), primerDM: au.primerKm ?? null }).cortes;
          const gp = geometria({ ...h, area: { ...a, cortes, sectores: [] } });
          return { k, polis: gp ? gp.sectores.map(x => x.poligono) : [], n: gp ? gp.sectores.length : 0 };
        } catch (e) { return { k, falta: 'revisa los datos', polis: [g.vuelo], n: 1 }; }
      });
      geometria(h); // deja la geometría de la hoja en el caché
      st.previas = { clave, datos };
    }
    const pie = d => d.falta ? d.falta : d.pendiente ? (d.k === 'vertices' ? 'toca dos vértices' : 'traza en el mapa') : `${d.n} sector${d.n === 1 ? '' : 'es'}`;
    return `<div class="vu-metodos" role="group" aria-label="Vista previa de cada método de corte">${st.previas.datos.map(d => `<button type="button" class="vu-metodo${d.k === modo ? ' activo' : ''}${d.falta ? ' sin-datos' : ''}" data-accion="elegir-metodo" data-m="${d.k}" title="${esc(METODOS[d.k].ayuda)}">
        ${d.k === propuesto ? '<i class="vu-metodo-prop">propuesto</i>' : ''}${svgSectores(d.polis, d.k === modo, d.falta || d.pendiente)}<span>${esc(METODOS[d.k].texto)}</span><small>${pie(d)}</small></button>`).join('')}</div>
      <p class="sis-tenue">Toca una vista previa para usar ese método. Sus ajustes están abajo.</p>`;
  }

  // ─────────── Ubicación y dron (v0.11, en Origen) ───────────
  function htmlUbicacionDron() {
    const h = st.hoja, u = h.ubicacion || {}, d = dron(), fam = d.familia || d.id;
    const sensores = base.drones.filter(x => (x.familia || x.id) === fam);
    const extranjero = u.codigoPais && u.codigoPais !== 'CL';
    return `<section class="sis-tarjeta"><div class="sis-cab"><h2>Ubicación</h2>${h.area.tipo ? `<button class="sis-btn chico" data-accion="detectar-ubicacion">${st.ubicando ? 'Buscando…' : 'Detectar de nuevo'}</button>` : ''}</div>
        <div class="sis-par">
          <label class="sis-campo"><span>Comuna${u.auto ? ' (automática)' : ''}</span><input data-ubic="comuna" value="${esc(u.comuna || '')}" placeholder="${h.area.tipo ? 'Se detecta al cargar el área' : 'Carga el área'}"></label>
          <label class="sis-campo"><span>Región${u.auto ? ' (automática)' : ''}</span><input data-ubic="region" value="${esc(u.region || '')}"></label>
        </div>
        ${extranjero ? `<label class="sis-campo"><span>País</span><input data-ubic="pais" value="${esc(u.pais || '')}"></label>` : ''}
        ${st.ubicError ? `<p class="vu-rojo">${esc(st.ubicError)}</p>` : '<p class="sis-tenue">Se obtiene del centro del área (OpenStreetMap). En Chile solo se usan comuna y región. Puedes corregirla.</p>'}
      </section>
      <section class="sis-tarjeta"><h2>Dron y módulos</h2>
        <div class="${sensores.length > 1 ? 'sis-par' : ''}">
          <label class="sis-campo"><span>Dron</span><select name="familia">${familias().map(([k, tt]) => `<option value="${esc(k)}" ${k === fam ? 'selected' : ''}>${esc(tt)}</option>`).join('')}</select></label>
          ${sensores.length > 1 ? `<label class="sis-campo"><span>Módulo / sensor</span><select name="dronId">${sensores.map(x => `<option value="${x.id}" ${x.id === h.dronId ? 'selected' : ''}>${esc(x.sensor || x.nombre)}</option>`).join('')}</select></label>` : `<p class="sis-tenue">Sensor: ${esc(d.sensor || '—')}</p>`}
        </div>
        <p class="sis-tenue">Sensor ${fmt(d.sensorAnchoMm, 1)} × ${fmt(d.sensorAltoMm, 1)} mm · ${d.pixelesAncho} px · focal ${fmt(d.focalMm, 2)} mm${d.lidar ? ` · LiDAR ${fmt(d.lidar.fovGrados, 0)}°` : ''}. Los datos se corrigen en Equipos → Catálogo de sensores.</p>
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
          </section>${htmlUbicacionDron()}`;
    else if (sub === 'forma') tarjetas = `${htmlForma(g)}${g ? '<div class="sis-acciones"><button class="sis-btn chico primario" data-accion="sub-area" data-s="sectores">Siguiente: Sectores →</button></div>' : ''}`;
    else if (sub === 'sectores') {
      const zonas = g ? (zonasDeHoja() || []) : [], cerca = zonas.filter(z => z.toca || z.distancia < 5000).length;
      tarjetas = `${g ? htmlCortes(g) : ''}
        <details class="sis-tarjeta vu-zonas-det"${st.zonasAbiertas || (st.dibujo && st.dibujo.modo === 'camino') ? ' open' : ''}><summary><b>Zonas y caminos</b>${cerca ? ` <span class="sis-chip ambar">${cerca} cerca</span>` : ''}<span class="sis-tenue"> · aeródromos, zonas DGAC y caminos para el despegue</span></summary>
          <h3 class="vu-subtit">Zonas de referencia</h3><div id="vu-zonas">${htmlZonas()}</div>${htmlCaminos()}</details>`;
    }
    return `${grande ? `<div class="vu-banner"><div><b>El área es grande: ${fmt(g.areaVuelo / 10000, 0)} ha · ${t.baterias} baterías · unas ${fmtDuracion(t.minVuelo)} de vuelo</b>
        <span>${t.excede ? 'Parte del recorrido queda más lejos de lo que alcanza una batería desde el despegue. ' : ''}Dividirla en sectores te deja planificar por día o por punto de despegue, con un rumbo y un KML para cada uno.</span></div>
        <button class="sis-btn primario" data-accion="sub-area" data-s="sectores">Dividir en sectores</button></div>` : ''}
      <div class="vu-dos vu-area">
        <div class="vu-izquierda">${htmlSubs(g)}${tarjetas}</div>
        <div class="vu-derecha">
          <div class="vu-mapa-caja vu-mapa-alto"><div class="vu-mapa-lugar" data-mapa="area"></div><div class="vu-mapa-barra" id="vu-barra-area">${barraDibujo()}</div></div>
          <p class="sis-tenue vu-pie">Punteado blanco: área del mandante y eje · naranjo: área de vuelo · colores: sectores · puntos azules: aeródromos${lineaEje(a) ? ' · flechas: sentido de avance del DM' : ''}.</p>
        </div>
      </div>
      ${sub === 'sectores' && g ? `<section class="sis-tarjeta vu-sectores-ancho"><div id="vu-sectores">${htmlSectores()}</div></section>` : ''}`;
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

  /** Largo (m) de un sector sobre el eje, o null si el área no es lineal. */
  const largoSector = s => (s.largo != null ? s.largo : s.rango ? s.rango[1] - s.rango[0] : null);

  /** Cinta del cadenamiento: los sectores a escala de su largo (o de su superficie si no hay eje). */
  function htmlCinta(g, sel) {
    const pesos = g.sectores.map(s => largoSector(s) ?? s.area), total = pesos.reduce((x, y) => x + y, 0) || 1;
    const x = extremosEje(), conDm = g.sectores.some(s => s.dm);
    let acum = 0;
    const marcas = [];
    const paso = Math.max(1, Math.ceil(g.sectores.length / 8));
    g.sectores.forEach((s, i) => { if (i % paso === 0 && s.dm) marcas.push(`<span class="vu-cinta-km" style="left:${(acum / total * 100).toFixed(2)}%">${kmADm(x && x.fin < x.ini ? s.dm[1] : s.dm[0])}</span>`); acum += pesos[i]; });
    if (conDm && x) marcas.push(`<span class="vu-cinta-km fin">${kmADm(x.fin)}</span>`);
    return `<div class="vu-cinta" role="group" aria-label="Sectores a escala del eje">${g.sectores.map((s, i) => `<button type="button" class="vu-cinta-seg${i === sel ? ' sel' : ''}" style="flex-grow:${(pesos[i] / total * 1000).toFixed(2)}; background:${COLORES_SECTOR[i % COLORES_SECTOR.length]}" data-accion="sel-sector" data-i="${i}" title="S${i + 1}${s.dm ? ' · ' + kmADm(s.dm[0]) + ' – ' + kmADm(s.dm[1]) : ''}" aria-label="Sector ${i + 1}"></button>`).join('')}</div>
      ${marcas.length ? `<div class="vu-cinta-marcas">${marcas.join('')}</div>` : ''}`;
  }

  function htmlSectores() {
    const h = st.hoja, g = geo(), d = dron();
    if (!g) return '';
    const t = d ? totales(h, d, g) : null;
    const n = g.sectores.length, sel = Math.max(0, Math.min(h.area.sel || 0, n - 1));
    const lineal = g.sectores.some(s => largoSector(s) != null);
    const kmTotal = lineal ? g.sectores.reduce((x, s) => x + (largoSector(s) || 0), 0) / 1000 : null;
    const aviso = g.fallidos.length ? '<div class="vu-aviso">Un corte no atraviesa el área de lado a lado y no se aplicó: arrastra sus puntos o deshazlo.</div>' : '';
    const cab = `<div class="vu-sec-cab"><div><h2>Sectores${n > 1 ? ' · ' + n : ''}</h2>
        <span class="sis-tenue">Total: ${kmTotal != null ? fmt(kmTotal, 2) + ' km · ' : ''}${fmt(g.areaVuelo / 10000, 1)} ha${t ? ` · ${t.baterias} baterías · ${fmtDuracion(t.minJornada)} de jornada` : ''}</span></div>
        ${n > 1 ? '<button class="sis-btn chico" data-accion="kml-sectores">Descargar KML de cada sector</button>' : ''}</div>`;
    const fila = (s, i) => {
      const r = t && t.sectores[i], L = largoSector(s);
      return `<tr class="${i === sel ? 'sel' : ''}">
        <td><button type="button" class="vu-sec-id" data-accion="sel-sector" data-i="${i}" aria-label="Ver el sector ${i + 1} en el mapa"><i style="background:${COLORES_SECTOR[i % COLORES_SECTOR.length]}"></i>S${i + 1}</button></td>
        <td>${n > 1 ? `<input class="vu-sector-nombre" data-sector-nombre="${i}" value="${esc((h.area.sectores[i] && h.area.sectores[i].nombre) || '')}" placeholder="${esc(s.dm ? `${kmADm(s.dm[0])} – ${kmADm(s.dm[1])}` : `S${i + 1}`)}" aria-label="Nombre del sector ${i + 1}">` : '<b>Área completa</b>'}</td>
        <td class="num">${L != null ? fmt(L / 1000, 2) + ' km' : '—'}</td><td class="num">${fmt(s.area / 10000, 1)} ha</td>
        <td class="num">${r ? r.vuelos + ' bat.' : '—'}</td><td class="num">${r ? fmtDuracion(r.minTotal) : '—'}</td>
        <td class="acc">${n > 1 ? `<button class="vu-link" data-accion="kml-sector" data-i="${i}">KML</button>` : ''}<button class="vu-link" data-accion="ir-sector" data-i="${i}">volar →</button></td></tr>`;
    };
    return `${aviso}${cab}${n > 1 ? htmlCinta(g, sel) : ''}
      <div class="vu-sec-tabla"><table><thead><tr><th>Sector</th><th>Nombre (tramo)</th><th class="num">Largo</th><th class="num">Superficie</th><th class="num">Baterías</th><th class="num">Vuelo</th><th></th></tr></thead>
        <tbody>${g.sectores.map(fila).join('')}</tbody></table></div>`;
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
    return `<div class="vu-caminos-caja"><h3 class="vu-subtit">Caminos</h3>
      <label class="sis-check"><input type="checkbox" data-redvial ${st.redVial ? 'checked' : ''}> Mostrar la red vial del MOP en los mapas</label>
      ${st.redVial ? `<p class="sis-tenue vu-caminos-info">${esc(st.redVialInfo || 'Cargando la red vial de la región…')}</p>` : ''}
      ${(() => {
        // v0.11.1: agrupados por archivo (un shapefile puede traer cientos de tramos) y botón para quitarlos todos.
        if (!cam.length) return '';
        const grupos = new Map();
        for (const c of cam) { const k = c.grupo || c.nombre || 'Camino'; grupos.set(k, (grupos.get(k) || 0) + 1); }
        const lista = [...grupos];
        return `<ul class="vu-caminos">${lista.slice(0, 12).map(([k, n]) => `<li><i></i>${esc(k)}${n > 1 ? ` <span class="sis-tenue">· ${n} tramos</span>` : ''} <button class="vu-link" data-accion="quitar-camino" data-g="${esc(k)}">quitar</button></li>`).join('')}${lista.length > 12 ? `<li class="sis-tenue">… y ${lista.length - 12} más</li>` : ''}</ul>
          <button class="sis-btn chico" data-accion="quitar-camino">✕ Quitar todos los caminos (${cam.length})</button>`;
      })()}
      <div class="sis-acciones">
        <button class="sis-btn chico${dib ? ' primario' : ''}" data-accion="dibujar" data-modo="camino">✎ Dibujar camino</button>
        <label class="sis-btn chico vu-archivo">Cargar caminos<input type="file" accept="${FORMATOS_CAMINO}" multiple data-archivo="camino" hidden></label>
      </div>
      <p class="sis-tenue">Agrega huellas o accesos que no estén en la red del MOP. En el paso 2 (Vuelo) se sugiere el despegue de cada sector sobre estos caminos. Es solo una referencia: acceso, rejas, permisos y línea de vista se confirman en terreno.</p>
      <p class="sis-tenue">Formatos: KML, KMZ, Shapefile (.zip, o .shp con su .dbf y .prj seleccionados juntos), GeoJSON y GPX. Los shapefiles en UTM se convierten solos.</p>
    </div>`;
  }

  function barraDibujo() {
    const dib = st.dibujo;
    if (!dib) return st.hoja && !geo() ? '<span class="vu-barra-txt">Carga un KML/KMZ o dibuja el área o el eje.</span>' : '';
    if (dib.modo === 'dmfijo') return `<span class="vu-barra-txt">Toca el eje para agregar un corte fijo en ese DM</span><button type="button" class="vu-barra-btn fuerte" data-accion="dibujo-cancelar">Terminar</button>`;
    const min = dib.modo === 'area' ? 3 : 2;
    if (dib.modo === 'vertice') return `<span class="vu-barra-txt">${dib.puntos.length ? 'Ahora toca el otro vértice del corte' : 'Toca un vértice del área (punto blanco) para empezar el corte'}</span>
      ${dib.puntos.length ? '<button type="button" class="vu-barra-btn" data-accion="dibujo-deshacer">Deshacer</button>' : ''}<button type="button" class="vu-barra-btn fuerte" data-accion="dibujo-cancelar">Terminar</button>`;
    const txt = { area: 'Toca el mapa para marcar los vértices del área', eje: 'Toca el mapa siguiendo el eje del corredor', corte: 'Toca afuera del área, sigue el camino y termina afuera', camino: 'Toca el mapa siguiendo el camino o la huella' }[dib.modo];
    return `<span class="vu-barra-txt">${txt} · ${dib.puntos.length} punto${dib.puntos.length === 1 ? '' : 's'}</span>
      <button type="button" class="vu-barra-btn" data-accion="dibujo-deshacer" ${dib.puntos.length ? '' : 'disabled'}>Deshacer</button>
      <button type="button" class="vu-barra-btn fuerte" data-accion="dibujo-terminar" ${dib.puntos.length >= min ? '' : 'disabled'}>Terminar</button>
      <button type="button" class="vu-barra-btn" data-accion="dibujo-cancelar">Cancelar</button>`;
  }

  return { zonasDeHoja, vistaArea, textoCorredor, htmlSectores, htmlZonas, barraDibujo, htmlVistaPrevia };
}
