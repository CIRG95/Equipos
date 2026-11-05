// modulos/vuelos/ui.js — piezas de interfaz y constantes compartidas por las pantallas de Vuelos (sin estado).

import { escapar as esc } from '../../compartido/util.js';

export const COLORES_BATERIA = ['#4FC3F7', '#C6F15A', '#FFD54F', '#FF8A80', '#CE93D8', '#80CBC4', '#FFAB40', '#B0BEC5'];
export const COLORES_SECTOR = ['#4FC3F7', '#C6F15A', '#FFD54F', '#FF8A80', '#CE93D8', '#80CBC4'];
export const ESTADOS_HOJA = { borrador: ['Borrador', 'gris'], lista: ['Programado', 'verde'], volada: ['Volado', 'azul'] };
// v0.11: planificación paso a paso (el Resumen queda aparte, como portada de la hoja).
export const PASOS = [['identificacion', '1 · Identificación'], ['area', '2 · Área'], ['vuelo', '3 · Vuelo'], ['clima', '4 · Clima'], ['permisos', '5 · Permisos']];
export const GSD_TABLA = [3, 2.5, 2, 1.5];
export const UMBRAL_BATERIAS = 6;
export const TIPO_KML = 'application/vnd.google-earth.kml+xml';

export const dosD = n => String(n).padStart(2, '0');
export const chip = (t, clase = 'gris') => `<span class="sis-chip ${clase}">${t}</span>`;
export const campo = (nombre, etiqueta, valor, extra = '', sufijo = '') => `<label class="sis-campo"><span>${etiqueta}</span>
    <span class="vu-con-sufijo"><input name="${nombre}" value="${esc(valor)}" inputmode="decimal" ${extra}>${sufijo ? `<em>${sufijo}</em>` : ''}</span></label>`;
export const deslizador = (nombre, etiqueta, valor, { min, max, paso, sufijo, nota = '' }) => `<div class="vu-desl">
      <div class="vu-desl-cab"><label for="vu-${nombre}">${etiqueta}${nota ? ` <small>${nota}</small>` : ''}</label>
        <span class="vu-desl-valor"><input type="number" data-espejo="${nombre}" value="${esc(valor)}" step="${paso}" min="${min}" max="${max}" aria-label="${etiqueta}">${sufijo}</span></div>
      <input type="range" id="vu-${nombre}" name="${nombre}" min="${min}" max="${max}" step="${paso}" value="${esc(valor)}">
    </div>`;
export const kpi = (t, v, d = '', clase = '') => `<div class="vu-kpi ${clase}"><span>${t}</span><b>${v}</b>${d ? `<small>${d}</small>` : ''}</div>`;
export const fila = (t, v) => `<div><dt>${t}</dt><dd>${v}</dd></div>`;
export const fechaHora = iso => new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
