// modulos/vuelos/vista-amarre.js — Resumen de la hoja: bases de amarre (PR) y jornadas de vuelo por baterías (v0.10).
// Fábrica crearVistaAmarre(v) como las demás vistas: usa el estado compartido del núcleo (pantallas.js).
//   · amarreDeHoja: PR del proyecto (capa KMZ) → menor cantidad de bases que cubre los sectores (amarre.js)
//   · jornadasDeHoja: por baterías (agrupadas por base, con recarga opcional) o por horario (como antes)

import { escapar as esc } from '../../compartido/util.js';
import { fmt } from './calculo.js';
import { nombreSector, jornadasNecesarias, minutosUtiles, HORARIO_INICIAL } from './hoja.js';
import { calcularAmarre, jornadasPorBaterias, AMARRE_INICIAL, JORNADA_INICIAL } from './amarre.js';
import { prsActivos, resumenCapas } from './capas-proyecto.js';

/** PR que sirven de base para una hoja: los existentes del proyecto (capas) y los planificados en sus redes de PR (v0.18a). */
export function prsParaAmarre(h, proyecto, redes = []) {
  const capas = (proyecto && proyecto.capas) || {};
  const norm = t => String(t || '').trim().toLowerCase();
  const yaEn = new Set(prsActivos(capas).map(x => norm(x.nombre)));
  const deRed = redes.filter(r => r.proyectoId === h.proyectoId).flatMap(r => (r.puntos || []))
    .filter(x => Number.isFinite(x.lon) && Number.isFinite(x.lat) && !yaEn.has(norm(x.nombre)) && (yaEn.add(norm(x.nombre)) || true))
    .map(x => ({ id: `red-${x.id}`, nombre: x.nombre, lon: x.lon, lat: x.lat, usar: true, planificado: true }));
  return [...prsActivos(capas), ...deRed];
}

/** v0.21: bases de amarre de una hoja sin la vista (lo usa también la exportación KMZ). null si no hay PR. */
export function calcularAmarreHoja(h, g, proyecto, redes = []) {
  if (!g || !g.sectores.length) return null;
  const capas = (proyecto && proyecto.capas) || {};
  const prs = prsParaAmarre(h, proyecto, redes);
  if (!prs.length) return null;
  const am = { ...AMARRE_INICIAL, asignado: {}, ...(h.area.amarre || {}) };
  const aXY = g.marco.aXY;
  const caminos = [...(capas.caminos || []), ...(h.area.caminos || [])].map(c => c.linea.map(aXY));
  const valor = calcularAmarre({ sectores: g.sectores.map(s => s.poligono), prs: prs.map(x => ({ id: x.id, nombre: x.nombre, xy: aXY([x.lon, x.lat]) })), caminos, radioKm: am.radioKm, asignado: am.asignado || {} });
  valor.bases.forEach(b => { b.ll = g.marco.aLonLat(b.xy); });
  valor.todos = prs.map(x => ({ ...x, xy: aXY([x.lon, x.lat]) }));
  return valor;
}

export function crearVistaAmarre(v) {
  const { base, st } = v;
  const proyectoDe = h => base.proyectos.find(p => p.id === h.proyectoId) || null;
  const memo = new WeakMap();

  /** Bases de amarre de la hoja, o null si el proyecto no tiene PR cargados. */
  function amarreDeHoja(h, g) {
    if (!g || !g.sectores.length) return null;
    const p = proyectoDe(h), capas = (p && p.capas) || {};
    const prs = prsParaAmarre(h, p, base.redes || []);
    if (!prs.length) return null;
    const am = { ...AMARRE_INICIAL, asignado: {}, ...(h.area.amarre || {}) };
    const clave = JSON.stringify([prs, (capas.caminos || []).length, (h.area.caminos || []).length, am]);
    const porGeo = memo.get(g);
    if (porGeo && porGeo.clave === clave) return porGeo.valor;
    const valor = calcularAmarreHoja(h, g, p, base.redes || []);
    memo.set(g, { clave, valor });
    return valor;
  }

  const cfgJornada = h => ({ ...JORNADA_INICIAL, ...(h.params.jornada || {}) });

  /**
   * Jornadas de la hoja con la forma de jornadasNecesarias ({ util, dias: [{ sectores, min, baterias, excede }] }) más
   * { modo, cfg, amarre, comparacion } cuando son por baterías.
   */
  function jornadasDeHoja(h, d, g, t) {
    if (!g || !d || !t) return null;
    const cfg = cfgJornada(h);
    if (cfg.modo === 'horario') return { ...jornadasNecesarias(h, d, g, t), modo: 'horario', cfg };
    const hor = { ...HORARIO_INICIAL, ...(h.params.horario || {}) };
    const am = amarreDeHoja(h, g);
    const grupos = am ? am.bases.map(b => b.sectores) : null;
    const secs = t.sectores.map((r, i) => (r ? { i, vuelos: r.vuelos, minTotal: r.minTotal } : null)).filter(Boolean);
    const calc = recarga => {
      const util = minutosUtiles(hor) + (recarga ? (Number(hor.pausa) || 0) : 0); // con recarga, el almuerzo va dentro de la pausa de recarga
      return jornadasPorBaterias(secs, grupos, { ...cfg, recarga, traslado: Number(hor.traslado) || 0 }, util);
    };
    const r = calc(!!cfg.recarga);
    return { ...r, modo: 'baterias', cfg, amarre: am, comparacion: { sin: cfg.recarga ? calc(false).dias.length : r.dias.length, con: cfg.recarga ? r.dias.length : calc(true).dias.length } };
  }

  const num = (k, val, attrs = '') => `<input type="number" data-jornada="${k}" value="${esc(val)}" ${attrs} aria-label="${k}">`;

  /** Controles del modo de jornada (por baterías o por horario), dentro de la tarjeta «2 · Vuelo». */
  function htmlControlesJornada(h, jor) {
    const c = cfgJornada(h), hor = { ...HORARIO_INICIAL, ...(h.params.horario || {}) };
    const campo = (t, k, val, attrs, unidad = '') => `<label class="vu-jcampo"><span>${t}</span><span class="vu-jvalor">${num(k, val, attrs)}${unidad ? `<small>${unidad}</small>` : ''}</span></label>`;
    const campoH = (t, k, val, unidad) => `<label class="vu-jcampo"><span>${t}</span><span class="vu-jvalor"><input type="number" min="0" max="240" step="5" data-horario="${k}" value="${esc(val)}" aria-label="${t}"><small>${unidad}</small></span></label>`;
    const horario = `<label class="vu-jcampo vu-jhora"><span>Horario de trabajo</span><span class="vu-jvalor"><input type="time" data-horario="inicio" value="${esc(hor.inicio)}" aria-label="Hora de inicio"><small>a</small><input type="time" data-horario="fin" value="${esc(hor.fin)}" aria-label="Hora de término"></span></label>`;
    return `<div class="vu-jornada-modo"><div class="vu-seg" role="radiogroup" aria-label="Cálculo de jornadas">
        <label><input type="radio" name="jornadaModo" data-jornada="modo" value="baterias" ${c.modo !== 'horario' ? 'checked' : ''}><span>Por baterías</span></label>
        <label><input type="radio" name="jornadaModo" data-jornada="modo" value="horario" ${c.modo === 'horario' ? 'checked' : ''}><span>Por horario</span></label></div>
      <b class="vu-jtotal">${jor ? jor.dias.length : '—'} <small>jornada${jor && jor.dias.length === 1 ? '' : 's'}</small></b></div>
      <details class="vu-jajustes"${st.ajustesAbiertos ? ' open' : ''}><summary><span>${c.modo === 'horario' ? `${esc(hor.inicio)}–${esc(hor.fin)} · pausa ${esc(hor.pausa)} min` : `${c.baterias} baterías · base ${c.minBase} min · ${esc(hor.inicio)}–${esc(hor.fin)}${c.recarga ? ' · con recarga a mediodía' : ''}`}${Number(hor.traslado) ? ` · traslado ${hor.traslado} min` : ''}</span><b>Ajustar</b></summary>
      <div class="vu-jgrilla">${horario}
        ${c.modo === 'horario' ? campoH('Pausa', 'pausa', hor.pausa, 'min') : `${campo('Baterías disponibles', 'baterias', c.baterias, 'min="1" max="40" step="1"')}${campo('Instalar la base', 'minBase', c.minBase, 'min="0" max="180" step="5"', 'min')}`}
        ${campoH('Traslado entre sectores', 'traslado', hor.traslado, 'min')}</div>
      ${c.modo === 'horario' ? '' : `<div class="vu-jrecarga${c.recarga ? ' activa' : ''}">
          <label class="vu-check"><input type="checkbox" data-jornada="recarga" ${c.recarga ? 'checked' : ''}> Volver a cargar baterías a mediodía</label>
          ${c.recarga ? `<div class="vu-jgrilla">${campo('Ida y vuelta al punto de carga', 'minIdaVuelta', c.minIdaVuelta, 'min="0" max="300" step="5"', 'min')}${campo('Carga de las baterías', 'minCarga', c.minCarga, 'min="0" max="300" step="5"', 'min')}${campo('Almuerzo (durante la carga)', 'minAlmuerzo', c.minAlmuerzo, 'min="0" max="180" step="5"', 'min')}</div>` : ''}
        </div>`}
      </details>
      ${jor && jor.comparacion && jor.comparacion.sin !== jor.comparacion.con ? `<p class="vu-comparar">Sin recarga: <b>${jor.comparacion.sin}</b> jornada${jor.comparacion.sin === 1 ? '' : 's'} · con recarga: <b>${jor.comparacion.con}</b>.${jor.comparacion.con < jor.comparacion.sin && !c.recarga ? ' Conviene volver a cargar si el punto de carga está cerca.' : ''}</p>` : ''}`;
  }

  /** Detalle de cada día por baterías: bases del día, bloques y sectores repartidos. */
  function detalleDia(h, g, jor, di) {
    if (jor.modo !== 'baterias') return '';
    const am = jor.amarre, n = g.sectores.length;
    const bases = am ? di.bases.map(k => am.bases[k]).filter(Boolean).map(b => esc(b.nombre)).join(' y ') : '';
    return `${bases ? `base ${bases} · ` : ''}${di.bloques.length > 1 ? `${di.bloques[0]} + ${di.bloques[1]} baterías` : `${di.baterias} batería${di.baterias === 1 ? '' : 's'}`}${di.parciales.length ? ` · ${di.parciales.map(i => esc(nombreSector(h, i, n))).join(', ')} sigue${di.parciales.length > 1 ? 'n' : ''} otro día` : ''}`;
  }

  /** Tarjeta «Bases de amarre (PR)». */
  function htmlAmarre(h, g) {
    if (!g) return '';
    const p = proyectoDe(h);
    const am = amarreDeHoja(h, g);
    const radio = (h.area.amarre && h.area.amarre.radioKm) || AMARRE_INICIAL.radioKm;
    const cargar = `<label class="sis-btn chico vu-archivo">${p && p.capas ? 'Agregar capas' : 'Cargar KMZ con caminos y PR'}<input type="file" accept=".kml,.kmz" multiple data-archivo="capas-proyecto" hidden></label>`;
    if (!p) return `<section class="sis-tarjeta vu-res-card"><div class="vu-res-tit"><h2>Bases de amarre (PR)</h2></div><p class="sis-tenue">Asigna la hoja a un proyecto para usar sus capas de caminos y PR.</p></section>`;
    if (!am) return `<section class="sis-tarjeta vu-res-card"><div class="vu-res-tit"><h2>Bases de amarre (PR)</h2>${cargar}</div>
      <p class="sis-tenue">Carga un KMZ o KML del proyecto: las líneas se toman como caminos y los puntos como PR ya instalados. El Sistema elige la menor cantidad de PR base que deja cada sector a ${fmt(radio, 1)} km o menos, y sugiere PR nuevos sobre los caminos donde no alcance ninguno.</p>
      ${p.capas ? `<p class="sis-tenue">Capas del proyecto: ${esc(resumenCapas(p.capas) || 'sin PR activos')}. Revisa en la ficha del proyecto qué puntos son PR.</p>` : ''}</section>`;
    const n = g.sectores.length;
    const opciones = i => [...am.todos.map(x => [x.id, x.nombre]), ...am.bases.filter(b => b.nuevo).map(b => [b.id, b.nombre])]
      .map(([id, nom]) => `<option value="${esc(id)}" ${am.porSector[i].base === id ? 'selected' : ''}>${esc(nom)}</option>`).join('');
    const hayManual = am.porSector.some(s => s.manual);
    return `<section class="sis-tarjeta vu-res-card vu-amarre">
      <div class="vu-res-tit"><h2>Bases de amarre (PR)</h2>${cargar}</div>
      <div class="vu-amarre-cab">
        <label>Radio de amarre <input type="number" data-amarre="radioKm" min="0.5" max="50" step="0.5" value="${esc(radio)}" aria-label="Radio de amarre en kilómetros"> km</label>
        <span class="sis-chip ${am.sinCubrir.length ? 'rojo' : am.nuevos ? 'ambar' : 'verde'}">${am.bases.length} base${am.bases.length === 1 ? '' : 's'} para ${n} sector${n === 1 ? '' : 'es'}${am.nuevos ? ` · ${am.nuevos} PR nuevo${am.nuevos === 1 ? '' : 's'}` : am.sinCubrir.length ? '' : ' · sin instalaciones nuevas'}${am.sinCubrir.length ? ` · ${am.sinCubrir.length} fuera del radio` : ''}</span>
        ${hayManual ? '<button class="sis-btn chico" data-accion="amarre-auto">Volver a la propuesta</button>' : ''}
      </div>
      ${am.grandes.length ? `<p class="sis-aviso-linea">${am.grandes.map(i => esc(nombreSector(h, i, n))).join(', ')} ${am.grandes.length === 1 ? 'es más grande' : 'son más grandes'} que el radio de amarre: desde ningún punto se alcanza todo el sector a ${fmt(am.radio / 1000, 1)} km. Divida ${am.grandes.length === 1 ? 'el sector' : 'esos sectores'} en el paso Área (Sectores) o aumente el radio.</p>` : ''}
      ${am.sinCubrir.length > am.grandes.length ? `<p class="sis-aviso-linea">${am.sinCubrir.filter(i => !am.grandes.includes(i)).map(i => esc(nombreSector(h, i, n))).join(', ')} quedan fuera del radio con la base elegida.</p>` : ''}
      <div class="vu-bases">${am.bases.map((b, k) => `<div class="vu-base ${b.nuevo ? 'nuevo' : ''}">
          <span class="vu-base-ic" style="background:${COLORES_BASE[k % COLORES_BASE.length]}">${k + 1}</span>
          <div><b>${esc(b.nombre)}</b>${b.nuevo ? ' <span class="sis-chip ambar">Instalar</span>' : String(b.id).startsWith('red-') ? ' <span class="sis-chip azul">Planificado en la red</span>' : ''}
            <small>${b.sectores.map(i => esc(nombreSector(h, i, n))).join(', ')} · punto más lejano a ${fmt(b.maxDist / 1000, 1)} km${Number.isFinite(b.aCamino) ? ` · ${b.aCamino < 50 ? 'sobre el camino' : `a ${fmt(b.aCamino, 0)} m del camino`}` : ''}</small>
            ${b.nuevo ? `<small class="vu-mono">${b.ll[1].toFixed(6)}, ${b.ll[0].toFixed(6)}</small>` : ''}</div></div>`).join('')}</div>
      <details class="vu-amarre-det"${hayManual || am.sinCubrir.length ? ' open' : ''}><summary>Base de cada sector</summary>
        <div class="vu-amarre-tabla">${g.sectores.map((_, i) => i).sort((x, y) => (am.porSector[y].fuera - am.porSector[x].fuera) || x - y).map(i => { const s = am.porSector[i]; return `<label class="vu-asec${s.fuera ? ' fuera' : ''}"><b>${esc(nombreSector(h, i, n))}</b>
          <select data-amarre-sector="${i}" aria-label="Base de ${esc(nombreSector(h, i, n))}">${opciones(i)}</select>
          <small class="vu-mono">${Number.isFinite(s.dist) ? `${fmt(s.dist / 1000, 1)} km` : '—'}${s.fuera ? ' · fuera del radio' : ''}${s.manual ? ' · elegida' : ''}</small></label>`; }).join('')}</div></details>
      <p class="sis-tenue vu-res-nota">Las jornadas por baterías vuelan cada grupo con su base. ${am.nuevos ? 'Los PR nuevos se deben instalar y medir antes del vuelo: ordénalo en «Trabajos del proyecto».' : ''}</p>
    </section>`;
  }

  /** Marcas para la miniatura: PR del proyecto (gris) y bases elegidas (color del grupo). */
  function marcasAmarre(h, g) {
    const am = amarreDeHoja(h, g);
    if (!am) return [];
    const usadas = new Set(am.bases.map(b => b.id));
    return [
      ...am.todos.filter(x => !usadas.has(x.id)).map(x => ({ ll: [x.lon, x.lat], nombre: x.nombre, color: '#8A8F96', base: false })),
      ...am.bases.map((b, k) => ({ ll: b.ll, nombre: b.nombre, color: COLORES_BASE[k % COLORES_BASE.length], base: true, nuevo: b.nuevo })),
    ];
  }

  return { amarreDeHoja, jornadasDeHoja, htmlControlesJornada, detalleDia, htmlAmarre, marcasAmarre, cfgJornada };
}

export const COLORES_BASE = ['#0F6E56', '#534AB7', '#993C1D', '#185FA5', '#854F0B', '#993556'];
