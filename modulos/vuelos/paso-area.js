// modulos/vuelos/paso-area.js — paso 1 de la hoja: origen del área, margen, corredor, sectores y zonas.

import { escapar as esc } from '../../compartido/util.js';
import { fmt, fmtDuracion } from './calculo.js';
import { deslizador } from './ui.js';
import { proyectar, areaM2 } from './calculo.js';
import { totales } from './hoja.js';
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

  function vistaArea() {
    const h = st.hoja, a = h.area, g = geo(), d = dron(), t = g && d ? totales(h, d, g) : null;
    const grande = t && (t.baterias > UMBRAL_BATERIAS || t.excede) && g.sectores.length === 1;
    return `${grande ? `<div class="vu-banner"><div><b>El área es grande: ${fmt(g.areaVuelo / 10000, 0)} ha · ${t.baterias} baterías · unas ${fmtDuracion(t.minVuelo)} de vuelo</b>
        <span>${t.excede ? 'Parte del recorrido queda más lejos de lo que alcanza una batería desde el despegue. ' : ''}Dividirla en sectores te deja planificar por día o por punto de despegue, con un rumbo y un KML para cada uno.</span></div>
        <button class="sis-btn primario" data-accion="dibujar" data-modo="corte">Dividir en sectores</button></div>` : ''}
      <div class="vu-dos">
        <div class="vu-izquierda">
          <section class="sis-tarjeta"><h2>Origen</h2>
            <div class="sis-acciones">
              <label class="sis-btn vu-archivo">Cargar KML / KMZ<input type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" data-archivo="area" hidden></label>
              <button class="sis-btn${st.dibujo && st.dibujo.modo === 'area' ? ' primario' : ''}" data-accion="dibujar" data-modo="area">Dibujar área</button>
              <button class="sis-btn${st.dibujo && st.dibujo.modo === 'eje' ? ' primario' : ''}" data-accion="dibujar" data-modo="eje">Dibujar eje</button>
            </div>
            ${st.candidatos ? vistaCandidatos() : ''}
            ${a.tipo ? `<p class="sis-tenue vu-area-info">${esc(a.archivo || '')} · ${a.tipo === 'corredor' ? `eje de ${fmt((a.eje.largo || 0) / 1000, 2)} km · ${a.eje.linea.length} vértices` : `${fmt(areaM2(proyectar(a.original.anillo).puntos) / 10000, 2)} ha · ${a.original.anillo.length} vértices`}</p>
              ${(a.problemas || []).length ? `<div class="vu-aviso"><b>Detalles que se corrigen al descargar:</b><ul>${a.problemas.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
              <div class="sis-acciones"><button class="sis-btn chico" data-accion="kml-original">Descargar ${a.tipo === 'corredor' ? 'eje' : 'área del mandante'} limpio (KML)</button></div>` : ''}
          </section>
          ${a.tipo === 'poligono' ? `<section class="sis-tarjeta"><h2>Margen</h2>
            ${deslizador('margen', 'Margen hacia afuera', a.margen || 0, { min: 0, max: 100, paso: 1, sufijo: 'm' })}
            <div class="vu-pildoras">${[0, 20, 30, 50].map(m => `<button type="button" class="vu-pildora${Number(a.margen) === m ? ' activo' : ''}" data-accion="margen" data-m="${m}">${m ? `${m} m` : 'Sin margen'}</button>`).join('')}</div>
            <label class="sis-check"><input type="checkbox" data-area="rectas" ${a.rectas !== false ? 'checked' : ''}> Esquinas rectas (como se hace a mano)</label>
            <p class="sis-tenue" id="vu-margen-info">${g ? `${fmt(areaM2(g.original) / 10000, 2)} ha → <b>${fmt(g.areaVuelo / 10000, 2)} ha</b> de vuelo` : ''}</p>
          </section>` : ''}
          ${a.tipo === 'corredor' ? `<section class="sis-tarjeta"><h2>Corredor</h2>
            ${deslizador('izq', a.corredor.mismo ? 'Ancho a cada lado' : 'Hacia la izquierda', a.corredor.izq, { min: 5, max: 300, paso: 1, sufijo: 'm' })}
            ${a.corredor.mismo ? '' : deslizador('der', 'Hacia la derecha', a.corredor.der, { min: 5, max: 300, paso: 1, sufijo: 'm' })}
            <label class="sis-check"><input type="checkbox" data-area="mismo" ${a.corredor.mismo ? 'checked' : ''}> Mismo ancho a los dos lados</label>
            ${a.corredor.mismo ? '' : '<button class="sis-btn chico" data-accion="invertir">Invertir izquierda y derecha</button>'}
            <p class="sis-tenue" id="vu-margen-info">${g ? textoCorredor(g) : ''}</p>
          </section>` : ''}
          ${g ? `<section class="sis-tarjeta"><h2>Sectores</h2><div id="vu-sectores">${htmlSectores()}</div>
            <div class="sis-acciones">
              <button class="sis-btn chico${st.dibujo && st.dibujo.modo === 'corte' ? ' primario' : ''}" data-accion="dibujar" data-modo="corte">✎ Trazar corte</button>
              ${a.cortes.length ? '<button class="sis-btn chico" data-accion="deshacer-corte">Deshacer último corte</button><button class="sis-btn chico" data-accion="quitar-cortes">Quitar todos</button>' : ''}
            </div>
            <p class="sis-tenue">Traza el corte por un camino, quebrada o cerco: toca afuera del área, sigue el borde tocando puntos y termina afuera. Los vértices blancos se pueden arrastrar.</p>
          </section>` : ''}
          <section class="sis-tarjeta"><h2>Zonas de referencia</h2><div id="vu-zonas">${htmlZonas()}</div></section>
        </div>
        <div class="vu-derecha">
          <div class="vu-mapa-caja"><div class="vu-mapa-lugar" data-mapa="area"></div><div class="vu-mapa-barra" id="vu-barra-area">${barraDibujo()}</div></div>
          <p class="sis-tenue vu-pie">Punteado blanco: área del mandante · naranjo: área de vuelo · colores: sectores · puntos azules: aeródromos. Imagen Esri con nombres y caminos.</p>
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
        ${g.sectores.length > 1 ? `<input class="vu-sector-nombre" data-sector-nombre="${i}" value="${esc((h.area.sectores[i] && h.area.sectores[i].nombre) || '')}" placeholder="S${i + 1}" aria-label="Nombre del sector ${i + 1}">` : '<b>Área completa</b>'}
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

  function barraDibujo() {
    const dib = st.dibujo;
    if (!dib) return st.hoja && !geo() ? '<span class="vu-barra-txt">Carga un KML/KMZ o dibuja el área o el eje.</span>' : '';
    const min = dib.modo === 'area' ? 3 : 2;
    const txt = { area: 'Toca el mapa para marcar los vértices del área', eje: 'Toca el mapa siguiendo el eje del corredor', corte: 'Toca afuera del área, sigue el camino y termina afuera' }[dib.modo];
    return `<span class="vu-barra-txt">${txt} · ${dib.puntos.length} punto${dib.puntos.length === 1 ? '' : 's'}</span>
      <button type="button" class="vu-barra-btn" data-accion="dibujo-deshacer" ${dib.puntos.length ? '' : 'disabled'}>Deshacer</button>
      <button type="button" class="vu-barra-btn fuerte" data-accion="dibujo-terminar" ${dib.puntos.length >= min ? '' : 'disabled'}>Terminar</button>
      <button type="button" class="vu-barra-btn" data-accion="dibujo-cancelar">Cancelar</button>`;
  }

  return { zonasDeHoja, vistaArea, textoCorredor, htmlSectores, htmlZonas, barraDibujo };
}
