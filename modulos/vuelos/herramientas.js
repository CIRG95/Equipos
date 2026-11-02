// modulos/vuelos/herramientas.js — herramientas sueltas: Limpiar KML y Drones.

import { escapar as esc } from '../../compartido/util.js';
import { fmt } from './calculo.js';
import { chip, campo } from './ui.js';
import { CAMPOS_DRON } from './drones.js';

export function crearHerramientas(v) {
  const { st, base } = v;

  // ─────────── Limpiar KML ───────────
  function vistaKml() {
    const a = st.kml;
    const contornos = a ? a.poligonos.filter(p => !p.abierta) : [];
    return `<section class="sis-tarjeta">
      <h2>Limpiar un KML o KMZ para el control</h2>
      <p>Revisa el archivo (de Global Mapper, AutoCAD, Google Earth…) y deja cada polígono o línea como lo lee el control: un elemento por archivo, sin altura, sin vértices repetidos y con pocos vértices.</p>
      <div class="sis-acciones">
        <label class="sis-btn primario vu-archivo">Elegir archivo<input type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" data-archivo="kml" hidden></label>
        <label class="sis-campo vu-mini"><span>Máximo de vértices</span><input data-campo="maxVertices" value="${st.maxVertices}" inputmode="numeric"></label>
      </div>
      ${st.kmlError ? `<div class="sis-error">${esc(st.kmlError)}</div>` : ''}
    </section>
    ${a ? `<div class="vu-kml">
      <section class="sis-tarjeta">
      <h2>${esc(a.archivo)}</h2>
      <p class="sis-tenue">${a.placemarks} elemento${a.placemarks === 1 ? '' : 's'} · ${contornos.length} contorno${contornos.length === 1 ? '' : 's'} · ${a.ejes.length} línea${a.ejes.length === 1 ? '' : 's'} abierta${a.ejes.length === 1 ? '' : 's'}${a.puntos ? ` · ${a.puntos} punto${a.puntos > 1 ? 's' : ''} (se ignoran)` : ''}${a.carpetas ? ` · ${a.carpetas} carpeta${a.carpetas > 1 ? 's' : ''}` : ''}</p>
      ${contornos.length || a.ejes.length ? `<div class="sis-lista">
        ${contornos.map((p, n) => { const i = a.poligonos.indexOf(p); return `<div class="sis-fila vu-kml-fila">
          <span class="sis-fila-txt"><b>${n + 1}. ${esc(p.nombre)}</b><span class="sis-tenue">Contorno · ${fmt(p.area / 10000, 2)} ha · ${p.vertices} vértices</span>
            ${p.problemas.length ? `<ul class="vu-problemas">${p.problemas.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<span class="sis-chip verde">Sin problemas</span>'}</span>
          <span class="sis-acciones"><button class="sis-btn chico" data-accion="kml-limpio" data-i="${i}">Descargar KML</button>
            <button class="sis-btn chico" data-accion="kml-a-hoja" data-i="${i}">Nueva hoja</button></span></div>`; }).join('')}
        ${a.ejes.map((e, i) => `<div class="sis-fila vu-kml-fila">
          <span class="sis-fila-txt"><b>${esc(e.nombre)}</b><span class="sis-tenue">Línea abierta · ${fmt(e.largo / 1000, 2)} km · ${e.vertices} vértices</span>
            ${e.problemas.length ? `<ul class="vu-problemas">${e.problemas.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<span class="sis-chip verde">Sin problemas</span>'}</span>
          <span class="sis-acciones"><button class="sis-btn chico" data-accion="eje-limpio" data-i="${i}">Descargar línea</button>
            <button class="sis-btn chico" data-accion="eje-a-hoja" data-i="${i}">Nueva hoja (corredor)</button></span></div>`).join('')}
        </div><p class="sis-tenue">Cada elemento se descarga como un archivo aparte, que es lo que el control importa mejor.</p>`
        : '<div class="sis-vacio"><p>No encontré polígonos ni líneas en este archivo.</p></div>'}
      </section>
      ${contornos.length || a.ejes.length ? '<div class="vu-mapa-caja"><div class="vu-mapa-lugar" data-mapa="kml"></div></div>' : ''}
    </div>` : ''}`;
  }

  function vistaDrones() {
    return `<p class="sis-tenue">Valores de referencia tomados de las fichas técnicas. Revísalos con la ficha de tu equipo: si corriges uno, se usa tu valor en todos los cálculos. El Matrice 300 aparece una vez por sensor. Los Mavic 2 Enterprise no están porque se usan solo para termografía.</p>
      ${base.drones.map(d => `<section class="sis-tarjeta"><div class="sis-cab"><h2>${esc(d.nombre)}</h2>${d.corregido ? chip('Corregido', 'ambar') : ''}</div>
        <form class="sis-form vu-dron" data-form="dron" data-id="${d.id}"><div class="vu-grilla">
          ${CAMPOS_DRON.map(([k, t, u]) => campo(k, t, d[k], '', u)).join('')}
          ${d.lidar ? campo('lidarPps', 'LiDAR: puntos por segundo', d.lidar.puntosPorSegundo, '', 'pts/s') + campo('lidarFov', 'LiDAR: campo de visión', d.lidar.fovGrados, '', '°') : ''}
        </div><div class="sis-acciones"><button class="sis-btn chico primario">Guardar</button>
        ${d.corregido ? `<button type="button" class="sis-btn chico" data-accion="restablecer-dron" data-id="${d.id}">Volver a los valores de fábrica</button>` : ''}</div></form>
      </section>`).join('')}`;
  }

  return { vistaKml, vistaDrones };
}
