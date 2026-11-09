// modulos/monografias/pasos.js — Monografías paso a paso (v0.12, según los bocetos del 9-nov).
//   #/monografias/<p>/comun            Paso 1 · Datos comunes (una vez para todas las fichas)
//   #/monografias/<p>/<id>[/coordenadas] Paso 2 · Coordenadas y croquis de cada ficha
//   #/monografias/<p>/<id>/ubicacion   Paso 3 · Ubicación y descripción de cada ficha
//   #/monografias/<p>/revisar          Revisar todas y generar el PDF
// Abajo a la derecha, un chequeo flotante dice cuánto lleva la ficha y qué falta (tocar un ítem lleva a su paso).

import { escapar as esc, descargar, fechaLegible, fechaHoraLegible, uuid, leerLS, escribirLS } from '../../compartido/util.js';
import { listarProyectos, obtenerProyecto, listarPersonas } from '../../compartido/catalogos.js';
import { urlArchivo, guardarArchivo, guardarArchivoDatos, archivosDe } from '../../compartido/archivos.js';
import { listarEquiposConEstado } from '../equipos/equipos.js';
import { ubicacionDe } from '../vuelos/ubicacion.js';
import { DATUMS_CHILE, GEOIDES, ZONAS_POR_PAIS, leerGrados, escribirGrados } from './coordenadas.js';
import { abrirCroquis } from './croquis.js';
import * as D from './datos.js';
import { configurarPieza, chequeoMonografia, valoresPorDefecto, dimsMonografia, ajusteDe, cargarImagenEl } from './pieza-terreno.js';
import { abrirAjuste, colocarImagen } from './ajuste.js';
import { pdfDe, urlImagen, logoEmpresa, fijarLogoEmpresa, ordenNatural } from './pdf.js';
import { eliminarMonografia } from './borrado.js';
import * as C from './comun.js';

const claveCliente = t => String(t || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ranura = { croquisImg: 'Croquis de ubicación', panoramicaImg: 'Vista panorámica', clienteLogo: 'Logo del cliente' };
const MODO_DEF = { clienteLogo: 'ajustar', croquisImg: 'llenar', panoramicaImg: 'llenar' };
const ANCHO_MINI = { croquisImg: 320, panoramicaImg: 320, clienteLogo: 160, extra: 220 };
const TIPO_FOTO = { panoramica: 'Panorámica', croquis: 'Croquis', placa: 'Placa', detalle: 'Detalle', punto: 'Punto', logo: 'Logo', otra: 'Foto' };
const NOMBRE_PASO = { coordenadas: 'Coordenadas y croquis', ubicacion: 'Ubicación y descripción' };
const nombreArchivo = s => String(s || 'punto').replace(/[^a-z0-9_-]+/gi, '_');
const nombreDe = f => (f && String(f.puntoMedido || '').trim()) || '(sin nombre)';
const leerComun = id => C.normalizarComun(leerLS(`mono_comun_${id}`, {}));
const guardarComun = (id, c) => escribirLS(`mono_comun_${id}`, c);
const textoEquipo = e => `${[e.marca, e.modelo].filter(Boolean).join(' ') || e.nombre}${e.numeroSerie ? ` · S/N ${e.numeroSerie}` : ''}`;

export function montarPasos(raiz, ctx) {
  const p0 = ctx.monografiaId;
  const st = {
    proyectoId: ctx.proyectoId, vista: p0 === 'comun' ? 'comun' : p0 === 'revisar' ? 'revisar' : 'ficha', monoId: p0 === 'comun' || p0 === 'revisar' ? null : p0,
    paso: ctx.paso === 'ubicacion' ? 'ubicacion' : 'coordenadas', lista: [], ficha: null, x: null, comun: leerComun(ctx.proyectoId), fotos: [], elegir: null, pegar: null,
    mensaje: null, guardando: null, comunPend: new Set(), vivo: true, nombres: {}, estadoSel: null, intentoComuna: false, abierto: leerLS('mn_flotante', typeof window !== 'undefined' && window.innerWidth >= 1200),
  };
  raiz.innerHTML = '<div class="mn mn-asis"></div>';
  const cont = raiz.querySelector('.mn');
  const avisar = (texto, tipo = 'ok') => { st.mensaje = { texto, tipo }; };
  const rutaComun = () => `#/monografias/${st.proyectoId}/comun`;
  const rutaRevisar = () => `#/monografias/${st.proyectoId}/revisar`;
  const rutaFicha = (id, paso = 'coordenadas') => `#/monografias/${st.proyectoId}/${id}${paso === 'ubicacion' ? '/ubicacion' : ''}`;
  const basadoEn = x => (x.gabinete ? x.gabinete.basadoEn : (x.terreno ? x.terreno.actualizadoEn : null)) || null;

  // ─────────── Datos ───────────
  async function cargar() {
    st.proyecto = await obtenerProyecto(st.proyectoId);
    st.lista = (await D.monografiasDeProyecto(st.proyectoId)).sort((a, b) => ordenNatural(a.ficha, b.ficha));
    if (st.vista === 'ficha') {
      st.x = st.lista.find(y => y.id === st.monoId) || null;
      if (st.x && (!st.ficha || st.ficha.id !== st.x.id)) st.ficha = JSON.parse(JSON.stringify(st.x.ficha));
    }
    configurarPieza({ monografias: st.lista.map(y => (st.ficha && y.id === st.ficha.id ? st.ficha : y.ficha)) });
    if (!Object.keys(st.nombres).length) for (const p of await listarPersonas()) st.nombres[p.id] = p.nombre;
  }
  const fichaDe = y => (st.ficha && y.id === st.ficha.id ? st.ficha : y.ficha);
  const chequeo = f => C.chequeoFicha(f, chequeoMonografia(C.efectiva(f)), st.comun);

  /** Guarda la versión de gabinete de una ficha (y la pasa a «En revisión» si venía recién enviada). */
  async function guardarFicha(x, f, { marcarRevision = false } = {}) {
    await D.guardarGabinete({ ...f, proyectoId: st.proyectoId, basadoEn: basadoEn(x) });
    if (marcarRevision && x.estado === 'enviada') { await D.agregarRevision({ monografiaId: x.id, proyectoId: st.proyectoId, estado: 'en-revision' }); x.estado = 'en-revision'; }
    x.gabinete = x.gabinete || { basadoEn: basadoEn(x) };
    x.ficha = f;
  }
  async function guardarAhora() {
    clearTimeout(st.guardando); st.guardando = null;
    if (st.ficha && st.x) { await guardarFicha(st.x, st.ficha, { marcarRevision: true }); marcar('Guardado'); }
  }
  function marcar(t) { const el = cont.querySelector('#mn-guardado'); if (el) el.textContent = t; }
  function cambio({ refrescar = false } = {}) {
    marcar('Guardando…');
    clearTimeout(st.guardando);
    st.guardando = setTimeout(async () => { await guardarAhora(); if (refrescar) render(); else refrescarFlotante(); }, 450);
  }
  /** Aplica cambios a todas las fichas del proyecto (los datos comunes y lo que incluye el PDF). */
  async function aplicarATodas(fn) {
    let n = 0;
    for (const x of st.lista) {
      const f = JSON.parse(JSON.stringify(x.ficha)), antes = JSON.stringify(f);
      fn(f);
      if (JSON.stringify(f) !== antes) { await guardarFicha(x, f); n++; }
    }
    return n;
  }
  function cambioComun(k) {
    guardarComun(st.proyectoId, st.comun);
    if (k) st.comunPend.add(k);
    marcar('Guardando…');
    clearTimeout(st.guardando);
    st.guardando = setTimeout(async () => {
      const ks = [...st.comunPend].filter(c => st.comun.todas[c]); st.comunPend.clear();
      const n = ks.length ? await aplicarATodas(f => { for (const c of ks) f[c] = st.comun.valores[c] ?? ''; }) : 0;
      marcar(n ? `Guardado · aplicado a ${n} ficha${n === 1 ? '' : 's'}` : 'Guardado');
      refrescarFlotante();
    }, 450);
  }

  // ─────────── Partes comunes de la vista ───────────
  /** Secuencia de pasos: Datos comunes → (coordenadas, ubicación) por ficha → Revisar. */
  function secuencia() {
    const s = [{ clave: 'comun', ruta: rutaComun(), texto: 'Datos comunes', sub: 'Todas las fichas' }];
    for (const y of st.lista) for (const paso of ['coordenadas', 'ubicacion']) s.push({ clave: `${y.id}:${paso}`, ruta: rutaFicha(y.id, paso), id: y.id, paso, texto: nombreDe(fichaDe(y)), sub: NOMBRE_PASO[paso] });
    s.push({ clave: 'revisar', ruta: rutaRevisar(), texto: 'Revisar PDF de todas', sub: `${st.lista.length} ficha${st.lista.length === 1 ? '' : 's'}` });
    return s;
  }
  const claveActual = () => (st.vista === 'ficha' ? `${st.monoId}:${st.paso}` : st.vista);

  function navHtml(sec, i) {
    const items = [];
    let n = 0;
    for (let k = 0; k < sec.length; k++) {
      const s = sec[k];
      if (s.id && s.id !== st.monoId) { // las otras fichas: una sola línea con su avance
        if (s.paso !== 'coordenadas') continue;
        const c = C.cuenta(chequeo(fichaDe(st.lista.find(y => y.id === s.id))));
        items.push(`<a class="mn-paso${c.ok === c.total ? ' hecho' : ''}" href="${s.ruta}"><i>${c.ok === c.total ? '✓' : ++n}</i><span><b>${esc(s.texto)}</b><small>${c.ok} de ${c.total}</small></span></a>`);
        if (c.ok === c.total) n++;
        continue;
      }
      n++;
      items.push(`<a class="mn-paso${k === i ? ' actual' : k < i ? ' hecho' : ''}" href="${s.ruta}"${k === i ? ' aria-current="step"' : ''}><i>${k < i ? '✓' : n}</i><span><b>${esc(s.texto)}</b><small>${esc(s.sub)}</small></span></a>`);
    }
    return `<nav class="mn-pasos" aria-label="Pasos">${items.join('')}</nav>`;
  }

  function cabHtml(sec, i) {
    const s = sec[i] || {};
    const detalle = st.vista === 'comun' ? 'Paso 1 · Datos comunes' : st.vista === 'revisar' ? 'Revisar y PDF' : `Paso ${st.paso === 'ubicacion' ? 3 : 2} · ${esc(s.texto)}`;
    return `<a class="sis-volver" href="#/monografias/${esc(st.proyectoId)}">← ${esc(st.proyecto ? st.proyecto.nombre : 'Proyecto')}</a>
      <div class="mn-cab mn-asis-cab"><div><h1>Monografías · ${esc(st.proyecto ? st.proyecto.nombre : '')}</h1>
        <p class="sis-tenue">${st.lista.length} ficha${st.lista.length === 1 ? '' : 's'} · ${detalle}${st.vista !== 'revisar' ? ' · <span id="mn-guardado">Guardado</span>' : ''}</p></div>
        <div class="sis-acciones"><button class="sis-btn" data-a="ver-pdf" ${st.lista.length ? '' : 'disabled'}>Vista previa del PDF</button></div></div>`;
  }

  function pieHtml(sec, i) {
    const ant = sec[i - 1], sig = sec[i + 1];
    const centro = st.vista === 'comun' ? 'Paso 1 de 3 · después se repiten los pasos 2 y 3 en cada ficha'
      : st.vista === 'revisar' ? 'Último paso'
      : `Ficha ${st.lista.findIndex(y => y.id === st.monoId) + 1} de ${st.lista.length} · ${esc(nombreDe(st.ficha))} · Paso ${st.paso === 'ubicacion' ? 3 : 2} de 3`;
    const etq = s => (s.id ? `${s.texto} · ${s.paso === 'ubicacion' ? 'Ubicación' : 'Coordenadas'}` : s.texto);
    return `<div class="mn-pie">${ant ? `<a class="sis-btn" href="${ant.ruta}">‹ ${esc(etq(ant))}</a>` : '<span></span>'}<span class="sis-tenue">${centro}</span>
      ${sig ? `<a class="sis-btn primario" href="${sig.ruta}">Siguiente: ${esc(etq(sig))} ›</a>` : '<span></span>'}</div>`;
  }

  /** Campo de texto. dest: 'f' (la ficha) o 'c' (datos comunes). */
  function entrada(dest, k, t, { tipo = 'text', lista = null, valor, ayuda = '' } = {}) {
    const v = valor ?? (dest === 'f' ? st.ficha[k] : st.comun.valores[k]) ?? '';
    return `<label class="sis-campo"><span>${esc(t)}</span><input type="${tipo}" data-${dest}="${k}" value="${esc(v)}"${/norte|este|cota|altura/i.test(k) ? ' inputmode="decimal"' : ''}${lista ? ` list="mn-l-${k}"` : ''}>${lista ? `<datalist id="mn-l-${k}">${lista.map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}${ayuda}</label>`;
  }
  function miniHtml(url, dim, ancho, datos, titulo) {
    return `<div class="mn-mini" style="width:${ancho}px; max-width:100%; aspect-ratio:${dim[0].toFixed(1)} / ${dim[1].toFixed(1)}" ${datos}>${url ? `<img src="${esc(url)}" alt="${esc(titulo)}" draggable="false">` : '<span class="sis-tenue">Sin imagen</span>'}</div>`;
  }
  function colocarMinis() {
    for (const caja of cont.querySelectorAll('.mn-mini')) {
      const img = caja.querySelector('img'), f = st.ficha || (st.lista[0] && st.lista[0].ficha);
      if (!img || !f) continue;
      const clave = caja.dataset.mini, i = caja.dataset.miniExtra;
      const aj = i != null ? { modo: 'llenar', zoom: 1, ox: 0, oy: 0, giro: 0, ...((f.fotosExtra[Number(i)] || {}).aj || {}) } : ajusteDe(f, clave, MODO_DEF[clave]);
      cargarImagenEl(img.src).then(im => colocarImagen(img, { w: im.naturalWidth, h: im.naturalHeight }, caja.clientWidth, caja.clientHeight, aj)).catch(() => {});
    }
  }
  async function botonesImagen(clave, url) {
    return `<div class="sis-acciones">${clave === 'croquisImg' ? '<button class="sis-btn chico primario" data-a="croquis-mapa">🗺 Armar en el mapa</button>' : ''}
      <label class="sis-btn chico">${clave === 'panoramicaImg' ? 'Cargar foto' : 'Subir'}<input type="file" accept="image/*" data-archivo="${clave}" hidden></label>
      <button class="sis-btn chico" data-a="elegir" data-slot="${clave}">Desde las fotos de Terreno</button>
      ${url ? `<button class="sis-btn chico" data-a="ajustar" data-slot="${clave}">✂ Ajustar encuadre</button><button class="sis-btn chico" data-a="quitar-img" data-slot="${clave}">Quitar</button>` : ''}</div>`;
  }

  // ─────────── Paso 1 · Datos comunes ───────────
  async function clientes() {
    const nombres = new Map();
    for (const p of await listarProyectos()) if (p.mandante && p.mandante.trim()) nombres.set(claveCliente(p.mandante), p.mandante.trim());
    const actual = C.valorComun(st.comun, st.lista.map(fichaDe), 'clienteNombre').v;
    if (actual) nombres.set(claveCliente(actual), actual);
    for (const n of leerLS('mono_clientes', [])) nombres.set(claveCliente(n), n);
    return Promise.all([...nombres.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(async ([k, nombre]) => ({ k, nombre, logo: ((await archivosDe('cliente_logo', k))[0] || {}).id || null })));
  }
  async function vistaComun() {
    const fichas = st.lista.map(fichaDe), c = st.comun;
    const val = k => C.valorComun(c, fichas, k);
    const fila = (k, control) => {
      const { distintas } = val(k);
      return `<div class="mn-c${c.todas[k] ? '' : ' propio'}">${control}<label class="mn-todas"><input type="checkbox" data-todas="${k}" ${c.todas[k] ? 'checked' : ''}> Todas las fichas</label>
        ${!c.todas[k] ? '<small class="sis-tenue">Se pide en cada ficha (paso 3).</small>' : distintas && fichas.length > 1 ? `<small class="mn-av">Distinto en ${distintas} ficha${distintas === 1 ? '' : 's'}: al cambiarlo se iguala.</small>` : ''}</div>`;
    };
    const cls = await clientes(), cli = val('clienteNombre').v;
    const logoCli = fichas.find(f => f.clienteLogo) ? fichas.find(f => f.clienteLogo).clienteLogo : null, urlLogoCli = await urlImagen(logoCli);
    const tipo = val('tipoMedicion').v || 'GNSS estático';
    const cat = tipo === 'Estación total' ? 'Estación total' : 'GNSS';
    const equipos = (await listarEquiposConEstado()).filter(e => e.categoria === cat)
      .sort((a, b) => (b.ubicacion.proyectoId === st.proyectoId) - (a.ubicacion.proyectoId === st.proyectoId) || textoEquipo(a).localeCompare(textoEquipo(b), 'es'));
    const eqVal = val('equipoGNSS').v, eqSel = equipos.find(e => textoEquipo(e) === eqVal);
    const avisoEq = eqSel && eqSel.calibracion.nivel === 'vencida' ? `<small class="mn-av">Calibración vencida (${esc(fechaLegible(eqSel.calibracion.proxima))}).</small>`
      : eqSel && eqSel.calibracion.nivel === 'por_vencer' ? `<small class="mn-av">La calibración vence el ${esc(fechaLegible(eqSel.calibracion.proxima))}.</small>` : '';
    const personas = Object.values(st.nombres);
    const av = C.avanceComun(c, fichas);
    return `<section class="sis-tarjeta"><div class="sis-cab"><h2>Documento y cliente</h2><span class="sis-tenue">Se escriben una vez; la casilla decide si van en todas las fichas</span></div>
        <div class="mn-grilla-c">
          ${fila('clienteNombre', `<label class="sis-campo"><span>Cliente</span><select data-cliente>${cls.map(x => `<option value="${esc(x.k)}" ${claveCliente(cli) === x.k ? 'selected' : ''}>${esc(x.nombre)}${x.logo ? ' · con logo' : ''}</option>`).join('')}${!cli ? '<option value="" selected>— Elegir —</option>' : ''}<option value="__nuevo">+ Nuevo cliente…</option></select></label>`)}
          ${fila('nombreProyecto', entrada('c', 'nombreProyecto', 'Nombre del proyecto', { valor: val('nombreProyecto').v }))}
          ${fila('tituloDocumento', entrada('c', 'tituloDocumento', 'Título del documento', { valor: val('tituloDocumento').v }))}
          <div class="mn-c mn-logo-cli">${miniHtml(urlLogoCli, [36, 16], ANCHO_MINI.clienteLogo, 'data-mini="clienteLogo"', 'Logo del cliente')}
            <span><b>Logo del cliente</b><small class="sis-tenue">Queda guardado con el cliente.</small><label class="sis-btn chico">${urlLogoCli ? 'Cambiar' : 'Cargar'}<input type="file" accept="image/*" data-archivo="clienteLogo" hidden></label></span></div>
        </div></section>
      <section class="sis-tarjeta"><div class="sis-cab"><h2>Medición y responsables</h2></div>
        <div class="mn-grilla-c">
          ${fila('tipoMedicion', `<div class="sis-campo"><span>Tipo de medición</span><div class="vu-pildoras">${C.TIPOS_MEDICION.map(t => `<button type="button" class="vu-pildora${t === tipo ? ' activo' : ''}" data-a="tipo" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`)}
          ${fila('equipoGNSS', `<label class="sis-campo"><span>Equipo ${cat === 'GNSS' ? 'GNSS' : '(estación total)'}</span><select data-equipo>
              ${!eqVal ? '<option value="" selected>— Elegir —</option>' : ''}${equipos.map(e => `<option value="${esc(textoEquipo(e))}" ${textoEquipo(e) === eqVal ? 'selected' : ''}>${esc(textoEquipo(e))}${e.ubicacion.proyectoId === st.proyectoId ? ' · en este proyecto' : ''}${e.calibracion.nivel === 'vencida' ? ' · calibración vencida' : ''}</option>`).join('')}
              ${eqVal && !eqSel ? `<option selected value="${esc(eqVal)}">${esc(eqVal)}</option>` : ''}<option value="__otro">Otro (escribir)…</option></select>${avisoEq}${!equipos.length ? `<small class="sis-tenue">No hay equipos ${esc(cat)} en Equipos: elige «Otro» para escribirlo.</small>` : ''}</label>`)}
          ${fila('datumUTM', entrada('c', 'datumUTM', 'Datum UTM', { lista: DATUMS_CHILE, valor: val('datumUTM').v }))}
          ${fila('zonaUTM', entrada('c', 'zonaUTM', 'Huso UTM', { lista: ZONAS_POR_PAIS.Chile, valor: val('zonaUTM').v }))}
          ${fila('datumGeodesico', entrada('c', 'datumGeodesico', 'Datum geodésico', { lista: DATUMS_CHILE, valor: val('datumGeodesico').v }))}
          ${fila('geoide', entrada('c', 'geoide', 'Geoide', { lista: GEOIDES, valor: val('geoide').v }))}
          ${fila('fechaMedicion', entrada('c', 'fechaMedicion', 'Fecha de medición', { tipo: 'date', valor: val('fechaMedicion').v }))}
          ${fila('operadorNombre', entrada('c', 'operadorNombre', 'Operador', { lista: personas, valor: val('operadorNombre').v }))}
          ${fila('operadorCargo', entrada('c', 'operadorCargo', 'Cargo', { lista: ['Geomensor', 'Topógrafo', 'Ingeniero en Geomensura', 'Jefe de terreno'], valor: val('operadorCargo').v }))}
          ${fila('revisoNombre', entrada('c', 'revisoNombre', 'Revisó', { lista: personas, valor: val('revisoNombre').v }))}
          ${fila('fechaRevision', entrada('c', 'fechaRevision', 'Fecha de revisión', { tipo: 'date', valor: val('fechaRevision').v }))}
        </div></section>
      <section class="sis-tarjeta"><div class="sis-cab"><h2>Qué incluye el PDF</h2><span class="sis-tenue">Se aplica a todas las fichas</span></div>
        <div class="mn-mods">${C.MODULOS_PDF.map(([k, t]) => `<label class="sis-check"><input type="checkbox" data-mod="${k}" ${c.modulos[k] ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div>
        <div class="mn-config-logo"><span class="mn-logo-mini">${logoEmpresa() ? `<img src="${logoEmpresa()}" alt="Logo de la empresa">` : '<span class="sis-tenue">Sin logo</span>'}</span>
          <span><b>Logo de la empresa</b><small class="sis-tenue">Va en el recuadro superior derecho.</small><span class="sis-acciones"><label class="sis-btn chico">${logoEmpresa() ? 'Cambiar' : 'Cargar logo'}<input type="file" accept="image/*" data-archivo="logo" hidden></label>${logoEmpresa() ? '<button class="sis-btn chico" data-a="quitar-logo">Quitar</button>' : ''}</span></span></div>
      </section>
      <section class="sis-tarjeta"><div class="sis-cab"><h2>Fichas · ${st.lista.length}</h2><button class="sis-btn chico" data-a="pegar-abrir">Pegar desde Excel</button></div>
        <label class="sis-campo"><span>Nombres de las fichas nuevas</span><span class="sis-en-linea"><input id="mn-nombres" placeholder="PR-1 a PR-12 · o PR-1, PR-2, PR-3" aria-label="Nombres de las fichas"><button type="button" class="sis-btn primario" data-a="crear-nombres">Crear fichas</button></span></label>
        <p class="sis-tenue">Escribe un rango («PR-1 a PR-12») o una lista separada por comas. Si ya existe una ficha con ese nombre, no se repite. Con «Pegar desde Excel» se crean con sus coordenadas ya puestas (Nombre | Este | Norte | Cota).</p>
        ${st.lista.length ? `<div class="mn-chips-fichas">${st.lista.map(y => { const k = C.cuenta(chequeo(fichaDe(y))); return `<a class="sis-chip ${k.ok === k.total ? 'verde' : 'gris'}" href="${rutaFicha(y.id)}">${esc(nombreDe(fichaDe(y)))} · ${k.ok}/${k.total}</a>`; }).join('')}</div>` : ''}
      </section>
      <section class="sis-tarjeta"><div class="sis-cab"><h2>Formato de coordenadas geográficas</h2></div>
        <div class="mn-formato"><span class="sis-vistas">${[['dd', 'dd.dddd°'], ['dms', 'D°M\'S"']].map(([v, t]) => `<button type="button" class="${c.formatoGeo === v ? 'activo' : ''}" data-a="formato" data-v="${v}">${t}</button>`).join('')}</span>
          <label>Decimales <input type="number" min="0" max="8" data-dec value="${esc(c.decimalesGeo)}" aria-label="Decimales"></label></div>
        <p class="sis-tenue">Al cambiarlo se reescriben la latitud y la longitud de todas las fichas.</p></section>
      ${st.pegar != null ? pegarHtml() : ''}
      <span hidden data-avance="${av.ok}/${av.total}"></span>`;
  }
  function pegarHtml() {
    const filas = C.leerTabla(st.pegar);
    const existe = new Set(st.lista.map(y => nombreDe(fichaDe(y)).toLowerCase()));
    return `<div class="mn-modal" role="dialog" aria-modal="true" aria-label="Pegar desde Excel"><div class="mn-modal-caja">
      <div class="sis-cab"><h2>Pegar desde Excel</h2><button class="sis-btn chico" data-a="pegar-cerrar">Cerrar</button></div>
      <p class="sis-tenue">Copia en Excel las columnas <b>Nombre | Este | Norte | Cota</b> (con o sin títulos) y pégalas aquí. Las geográficas se calculan con el huso del paso 1.</p>
      <textarea data-pegar rows="7" placeholder="PR-1	352100,500	6972345,250	812,40">${esc(st.pegar)}</textarea>
      <div class="mn-pegar-prev">${filas.length ? `<table class="mn-tabla"><thead><tr><th>Nombre</th><th>Este</th><th>Norte</th><th>Cota</th><th></th></tr></thead><tbody>${filas.slice(0, 50).map(r => `<tr><td>${esc(r.nombre)}</td><td>${r.este ?? '—'}</td><td>${r.norte ?? '—'}</td><td>${r.cota ?? '—'}</td><td>${existe.has(r.nombre.toLowerCase()) ? '<span class="sis-chip ambar">se actualiza</span>' : '<span class="sis-chip verde">nueva</span>'}</td></tr>`).join('')}</tbody></table>${filas.length > 50 ? `<p class="sis-tenue">… y ${filas.length - 50} más.</p>` : ''}` : '<p class="sis-tenue">Aún no hay filas.</p>'}</div>
      <div class="sis-acciones"><button class="sis-btn primario" data-a="pegar-aplicar" ${filas.length ? '' : 'disabled'}>Crear o actualizar ${filas.length} ficha${filas.length === 1 ? '' : 's'}</button></div>
    </div></div>`;
  }

  // ─────────── Paso 2 · Coordenadas y croquis ───────────
  async function vistaCoordenadas() {
    const f = st.ficha, mod = C.efectiva(f).modulos, c = st.comun;
    const convertible = C.datumConvertible(f.datumUTM) && C.datumConvertible(f.datumGeodesico);
    const calcGeo = f.calc && f.calc.geo && f.calc.geo.lat === f.latitud && f.calc.geo.lng === f.longitud && f.latitud;
    const calcUtm = f.calc && f.calc.utm && f.calc.utm.este === f.este && f.calc.utm.norte === f.norte && f.este;
    const dims = dimsMonografia(C.efectiva(f));
    const urlC = await urlImagen(f.croquisImg), urlP = await urlImagen(f.panoramicaImg);
    const disp = f.disposicionImg || 'lado', alto = Number(f.altoImagenes) || 56;
    return `<section class="sis-tarjeta"><div class="sis-cab"><h2>Coordenadas</h2></div>
        <div class="mn-campos">${entrada('f', 'puntoMedido', 'Nombre del punto')}</div>
        <div class="mn-coords">
          <div><h3>UTM · ${esc(f.datumUTM || 'sin datum')} · Huso ${esc(f.zonaUTM || '—')}${calcUtm ? ' <span class="sis-chip gris">calculadas</span>' : ''}</h3>
            ${entrada('f', 'este', 'Este (m)')}${entrada('f', 'norte', 'Norte (m)')}${entrada('f', 'cotaOrtometrica', 'Cota ortométrica (m)')}</div>
          <div><h3>Geográficas · ${esc(f.datumGeodesico || '')}${calcGeo ? ' <span class="sis-chip gris">calculadas</span>' : ''}</h3>
            <div class="sis-vistas mn-fmt-chico">${[['dd', 'dd.dddd°'], ['dms', 'D°M\'S"']].map(([v, t]) => `<button type="button" class="${c.formatoGeo === v ? 'activo' : ''}" data-a="formato" data-v="${v}">${t}</button>`).join('')}</div>
            ${entrada('f', 'latitud', 'Latitud')}${entrada('f', 'longitud', 'Longitud')}${entrada('f', 'alturaElipsoidal', 'Altura elipsoidal (m)')}</div>
        </div>
        <p class="sis-tenue">${convertible ? 'Escribe UTM o geográficas y la otra se calcula sola (si la otra está vacía o ya era calculada).' : `Con ${esc(f.datumUTM)} no se calcula la conversión: escribe ambas.`} El datum, el huso y el geoide salen del paso 1.</p>
        ${convertible ? `<div class="sis-acciones"><button class="sis-btn chico" data-a="recalcular" data-v="geo">Calcular geográficas desde UTM</button><button class="sis-btn chico" data-a="recalcular" data-v="utm">Calcular UTM desde geográficas</button></div>` : ''}
      </section>
      ${mod.croquis ? `<section class="sis-tarjeta"><div class="sis-cab"><h2>Croquis de ubicación</h2><span class="sis-tenue">El punto se ubica solo con las coordenadas</span></div>
        ${miniHtml(urlC, dims.croquisImg, ANCHO_MINI.croquisImg, 'data-mini="croquisImg"', 'Croquis')}
        ${await botonesImagen('croquisImg', urlC)}
        <p class="sis-tenue">En el mapa eliges el fondo (híbrido, calles o imagen), el símbolo, los tamaños y arrastras el nombre; «Usar como croquis» congela la imagen para el PDF.</p></section>` : ''}
      ${mod.panoramica || mod.croquis ? `<section class="sis-tarjeta"><div class="sis-cab"><h2>Vista panorámica y presentación de las imágenes</h2></div>
        ${mod.panoramica ? `${miniHtml(urlP, dims.panoramicaImg, ANCHO_MINI.panoramicaImg, 'data-mini="panoramicaImg"', 'Vista panorámica')}${await botonesImagen('panoramicaImg', urlP)}` : ''}
        ${st.comun.modulos.panoramica && st.comun.modulos.croquis ? `<div class="sis-campo"><span>Disposición</span><div class="vu-pildoras">${[['lado', 'Croquis | Foto'], ['apiladas', 'Croquis arriba, foto abajo'], ['solo-croquis', 'Solo croquis']].map(([v, t]) => `<button type="button" class="vu-pildora${disp === v ? ' activo' : ''}" data-a="disposicion" data-v="${v}">${t}</button>`).join('')}</div></div>` : ''}
        <label class="sis-campo"><span>Alto de las imágenes: <b data-pres-txt="altoImagenes">${(alto / 10).toLocaleString('es-CL', { maximumFractionDigits: 1 })}</b> cm</span><input type="range" min="35" max="120" step="1" data-pres="altoImagenes" value="${alto}"></label>
      </section>` : ''}`;
  }

  // ─────────── Paso 3 · Ubicación y descripción ───────────
  async function vistaUbicacion() {
    const f = st.ficha, mod = C.efectiva(f).modulos, i = st.lista.findIndex(y => y.id === f.id), ant = i > 0 ? fichaDe(st.lista[i - 1]) : null;
    const propios = C.CAMPOS_COMUNES.filter(([k]) => !st.comun.todas[k]);
    const dato = (t, v, paso) => `<a class="mn-dato" href="${paso === 'comun' ? rutaComun() : rutaFicha(f.id, paso)}"><small>${esc(t)}</small><b>${esc(v || '—')}</b></a>`;
    const est = f.comunaEstimada ? ' <span class="sis-chip ambar">estimado</span>' : '';
    const frases = [...C.FRASES_BASE, ...leerLS('mono_frases', [])];
    const extras = await Promise.all((f.fotosExtra || []).map(async (e, k) => { const u = await urlImagen(e.img); return `<div class="mn-extra">${miniHtml(u, dimsMonografia(f).extra, ANCHO_MINI.extra, `data-mini-extra="${k}"`, `Foto ${k + 1}`)}<div class="mn-extra-datos"><input data-extra="${k}" value="${esc(e.leyenda || '')}" placeholder="Leyenda" aria-label="Leyenda de la foto ${k + 1}"><div class="sis-acciones">${u ? `<button class="sis-btn chico" data-a="ajustar" data-i="${k}">✂ Ajustar encuadre</button>` : ''}<button class="sis-btn chico" data-a="quitar-extra" data-i="${k}">Quitar</button></div></div></div>`; }));
    return `<section class="sis-tarjeta"><div class="sis-cab"><h2>Ubicación</h2>${ant ? '<button class="sis-btn chico" data-a="copiar-anterior">Copiar sector y localidad de la ficha anterior</button>' : ''}</div>
        <div class="mn-campos">${entrada('f', 'ubicacion', 'Sector / Lugar')}${entrada('f', 'localidad', 'Localidad')}
          <label class="sis-campo"><span>Comuna${est}</span><input data-f="comuna" value="${esc(f.comuna || '')}"></label>
          <label class="sis-campo"><span>Región${est}</span><input data-f="region" value="${esc(f.region || '')}"></label></div>
        <p class="sis-tenue">Comuna y región se estiman con las coordenadas del paso 2 (OpenStreetMap, necesita internet); se pueden corregir.</p>
        <div class="sis-acciones">${f.comunaEstimada ? '<button class="sis-btn chico primario" data-a="confirmar-comuna">Confirmar comuna y región</button>' : ''}<button class="sis-btn chico" data-a="estimar-comuna">Estimar con las coordenadas</button></div>
      </section>
      <section class="sis-tarjeta"><div class="sis-cab"><h2>Coordenadas y medición</h2><span class="sis-tenue">Solo lectura: tocar un dato lleva a donde se cambia</span></div>
        <div class="mn-datos">${dato('Este', f.este && `${f.este} m`, 'coordenadas')}${dato('Norte', f.norte && `${f.norte} m`, 'coordenadas')}${dato('Cota', f.cotaOrtometrica && `${f.cotaOrtometrica} m`, 'coordenadas')}
          ${dato('Latitud', f.latitud, 'coordenadas')}${dato('Longitud', f.longitud, 'coordenadas')}
          ${dato('Equipo', f.equipoGNSS, st.comun.todas.equipoGNSS ? 'comun' : 'ubicacion')}${dato('Tipo de medición', f.tipoMedicion, st.comun.todas.tipoMedicion ? 'comun' : 'ubicacion')}${dato('Fecha de medición', f.fechaMedicion && fechaLegible(f.fechaMedicion), st.comun.todas.fechaMedicion ? 'comun' : 'ubicacion')}</div>
      </section>
      ${propios.length ? `<section class="sis-tarjeta"><div class="sis-cab"><h2>Datos propios de esta ficha</h2><a class="sis-tenue" href="${rutaComun()}">Se eligen en el paso 1</a></div>
        <div class="mn-campos">${propios.map(([k, t, , tipo]) => entrada('f', k, t, { tipo: tipo || 'text', lista: k === 'datumUTM' || k === 'datumGeodesico' ? DATUMS_CHILE : k === 'zonaUTM' ? ZONAS_POR_PAIS.Chile : k === 'geoide' ? GEOIDES : k === 'tipoMedicion' ? C.TIPOS_MEDICION : /Nombre$/.test(k) ? Object.values(st.nombres) : null })).join('')}</div></section>` : ''}
      ${mod.descripcion || mod.observacion ? `<section class="sis-tarjeta"><div class="sis-cab"><h2>Descripción y observación</h2></div>
        ${mod.descripcion ? `<label class="sis-campo"><span>Descripción</span><textarea data-f="descripcion" rows="4" id="mn-desc">${esc(f.descripcion || '')}</textarea></label>
          <div class="mn-frases"><span class="sis-tenue">Frases:</span>${frases.map(t => `<button type="button" class="vu-pildora" data-a="frase" data-t="${esc(t)}">${esc(t)}</button>`).join('')}<button type="button" class="sis-btn chico" data-a="guardar-frase" title="Guarda el texto seleccionado (o la última línea) como frase">+ Guardar frase</button></div>` : ''}
        ${mod.observacion ? `<label class="sis-campo"><span>Observación</span><textarea data-f="observacionPdf" rows="3" placeholder="Ej.: monolito con daño en la placa">${esc(f.observacionPdf || '')}</textarea></label><p class="sis-tenue">Va en el PDF después de la descripción, como «Observación: …».</p>` : ''}
      </section>` : ''}
      ${mod.fotos ? `<section class="sis-tarjeta"><div class="sis-cab"><h2>Fotografías adicionales</h2></div>${extras.join('')}
        <div class="sis-acciones"><button class="sis-btn chico" data-a="elegir" data-slot="extra">+ Desde las fotos de Terreno</button><label class="sis-btn chico">+ Subir<input type="file" accept="image/*" data-archivo="extra" hidden></label></div>
        <label class="sis-campo"><span>Alto de las fotografías: <b data-pres-txt="altoFotosExtra">${((Number(f.altoFotosExtra) || 60) / 10).toLocaleString('es-CL', { maximumFractionDigits: 1 })}</b> cm</span><input type="range" min="35" max="120" step="1" data-pres="altoFotosExtra" value="${Number(f.altoFotosExtra) || 60}"></label></section>` : ''}`;
  }

  // ─────────── Revisar ───────────
  function vistaRevisar() {
    if (!st.lista.length) return `<section class="sis-tarjeta sis-vacio"><p>Aún no hay fichas. Créalas en el <a href="${rutaComun()}">paso 1</a>.</p></section>`;
    const listas = st.lista.filter(y => y.estado === 'lista').length;
    return `<section class="sis-tarjeta"><div class="sis-cab"><h2>Todas las fichas</h2><span class="sis-acciones">
        <button class="sis-btn" data-a="pdf-todas" data-solo="lista" ${listas ? '' : 'disabled'}>PDF solo las listas (${listas})</button>
        <button class="sis-btn primario" data-a="pdf-todas">PDF de todas (${st.lista.length})</button></span></div>
      <table class="mn-tabla"><thead><tr><th>Ficha</th><th>Estado</th><th>Avance</th><th>Falta</th><th>Medición</th><th></th></tr></thead><tbody>
      ${st.lista.map(y => { const f = fichaDe(y), ch = chequeo(f), k = C.cuenta(ch), falta = ch.filter(r => !r.ok); return `<tr>
        <td><a href="${rutaFicha(y.id)}"><b>${esc(nombreDe(f))}</b></a>${y.nuevaDeTerreno ? '<small class="mn-nueva">Terreno envió cambios</small>' : ''}</td>
        <td><span class="sis-chip ${D.ESTADOS[y.estado].color}">${esc(D.ESTADOS[y.estado].texto)}</span>${y.observacion ? `<small class="mn-obs">${esc(y.observacion)}</small>` : ''}</td>
        <td><span class="sis-chip ${k.ok === k.total ? 'verde' : 'ambar'}">${k.ok} de ${k.total}</span></td>
        <td class="mn-falta">${falta.length ? falta.slice(0, 4).map(r => `<a href="${r.paso === 'comun' ? rutaComun() : rutaFicha(y.id, r.paso)}">${esc(r.k)}</a>`).join(', ') + (falta.length > 4 ? ` y ${falta.length - 4} más` : '') : '—'}</td>
        <td>${f.fechaMedicion ? esc(fechaLegible(f.fechaMedicion)) : '—'}</td>
        <td class="mn-acc"><a class="sis-btn chico" href="${rutaFicha(y.id)}">Abrir</a><button class="sis-btn chico" data-a="pdf" data-id="${esc(y.id)}">PDF</button><button class="sis-btn chico peligro" data-a="eliminar" data-id="${esc(y.id)}" data-nombre="${esc(nombreDe(f))}">Eliminar</button></td></tr>`; }).join('')}
      </tbody></table></section>`;
  }

  // ─────────── Chequeo flotante ───────────
  function flotanteHtml() {
    if (st.vista === 'revisar') return '';
    if (st.vista === 'comun') {
      const av = C.avanceComun(st.comun, st.lista.map(fichaDe));
      return `<aside class="mn-flotante${st.abierto ? ' abierto' : ''}" aria-label="Chequeo"><button type="button" class="mn-flot-cab" data-a="flotante" aria-expanded="${st.abierto}">
        ${anillo(av.ok, av.total)}<span><b>Datos comunes · ${av.ok} de ${av.total}</b>${av.faltan.length ? `<small>Faltan: ${esc(av.faltan.join(', '))}</small>` : '<small>Completos</small>'}</span><i>${st.abierto ? '▾' : '▴'}</i></button></aside>`;
    }
    const f = st.ficha, x = st.x, ch = chequeo(f), k = C.cuenta(ch);
    const estSel = st.estadoSel || x.estado;
    return `<aside class="mn-flotante${st.abierto ? ' abierto' : ''}" aria-label="Chequeo de la ficha">
      <button type="button" class="mn-flot-cab" data-a="flotante" aria-expanded="${st.abierto}">${anillo(k.ok, k.total)}<span><b>Chequeo · ${esc(nombreDe(f))} · ${k.ok} de ${k.total}</b><small>${k.ok === k.total ? 'Completa' : `Faltan: ${esc(ch.filter(r => !r.ok).map(r => r.k).slice(0, 3).join(', '))}${ch.filter(r => !r.ok).length > 3 ? '…' : ''}`}</small></span><i>${st.abierto ? '▾' : '▴'}</i></button>
      ${st.abierto ? `<div class="mn-flot-cuerpo">
        <div class="mn-flot-est"><b>Estado de revisión</b><div class="vu-pildoras">${[['en-revision', 'En revisión'], ['lista', 'Lista'], ['con-observacion', 'Con observación']].map(([e, t]) => `<button type="button" class="vu-pildora${estSel === e ? ' activo' : ''}" data-a="estado" data-e="${e}">${t}</button>`).join('')}</div>
          ${estSel === 'con-observacion' ? `<label class="sis-campo"><span>Observación para terreno</span><textarea id="mn-obs" rows="2" placeholder="Ej.: retomar la foto de la placa">${x.estado === 'con-observacion' ? esc(x.observacion) : ''}</textarea></label><button class="sis-btn chico primario" data-a="estado" data-e="con-observacion" data-enviar="1">Enviar observación</button>` : ''}</div>
        <ul class="mn-flot-lista">${ch.map(r => `<li><a href="${r.paso === 'comun' ? rutaComun() : rutaFicha(f.id, r.paso)}" class="${r.ok ? 'ok' : 'falta'}"><i>${r.ok ? '✓' : '○'}</i><span>${esc(r.k)}${r.aviso ? `<small class="mn-av">${esc(r.aviso)}</small>` : ''}</span><small>${r.paso === 'comun' ? 'Paso 1' : r.paso === 'coordenadas' ? 'Paso 2' : 'Paso 3'}</small></a></li>`).join('')}</ul>
        <p class="sis-tenue">Tocar un ítem lleva al paso donde se completa.</p>
        <div class="mn-chips-fichas">${st.lista.map(y => { const c2 = C.cuenta(chequeo(fichaDe(y))); return `<a class="sis-chip ${y.id === f.id ? 'azul' : c2.ok === c2.total ? 'verde' : 'gris'}" href="${rutaFicha(y.id)}">${esc(nombreDe(fichaDe(y)))} · ${c2.ok}/${c2.total}</a>`; }).join('')}</div>
        <div class="mn-flot-pie"><button class="sis-btn chico peligro" data-a="eliminar" data-id="${esc(f.id)}" data-nombre="${esc(nombreDe(f))}">Eliminar ficha</button></div>
      </div>` : ''}</aside>`;
  }
  function anillo(ok, total) {
    const r = 15, c = 2 * Math.PI * r, frac = total ? ok / total : 0;
    return `<svg class="mn-anillo" viewBox="0 0 36 36" width="36" height="36" aria-hidden="true"><circle cx="18" cy="18" r="${r}" fill="none" stroke="#E2E0DA" stroke-width="4"/><circle cx="18" cy="18" r="${r}" fill="none" stroke="${frac === 1 ? '#2E7D32' : '#E8743B'}" stroke-width="4" stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 18 18)" stroke-linecap="round"/></svg>`;
  }
  function refrescarFlotante() {
    const viejo = cont.querySelector('.mn-flotante');
    if (!viejo) return;
    const t = document.createElement('div'); t.innerHTML = flotanteHtml();
    if (t.firstElementChild) viejo.replaceWith(t.firstElementChild);
  }

  async function selectorFotos() {
    const fotos = await Promise.all(st.fotos.map(async a => ({ a, url: await urlArchivo(a.id) })));
    return `<div class="mn-modal" role="dialog" aria-modal="true" aria-label="Elegir foto de terreno"><div class="mn-modal-caja">
      <div class="sis-cab"><h2>Fotos de terreno del proyecto · ${esc(st.elegir === 'extra' ? 'Fotografía adicional' : ranura[st.elegir])}</h2><button class="sis-btn chico" data-a="cerrar-elegir">Cerrar</button></div>
      ${fotos.length ? `<div class="mn-grilla">${fotos.map(({ a, url }) => { const d = a.detalle || {}; return `<button type="button" class="mn-foto" data-a="usar-foto" data-id="${esc(a.id)}">${url ? `<img src="${esc(url)}" alt="">` : '<span class="sis-tenue">En la nube</span>'}<span><b>${esc(TIPO_FOTO[d.tipo] || 'Foto')}${d.punto ? ' · ' + esc(d.punto) : ''}</b><small>${esc(d.hora ? fechaHoraLegible(d.hora) : '')}${d.autor ? ' · ' + esc(d.autor) : ''}</small></span></button>`; }).join('')}</div>`
        : '<div class="sis-vacio"><p>Aún no llegan fotos de este proyecto desde Terreno.</p></div>'}
    </div></div>`;
  }

  // ─────────── Render ───────────
  async function render() {
    if (!st.vivo) return;
    try {
      await cargar();
      if (!st.proyecto) { cont.innerHTML = '<section class="sis-tarjeta sis-vacio"><p>No se encontró el proyecto.</p></section>'; return; }
      if (st.vista === 'ficha' && !st.x) { cont.innerHTML = `<a class="sis-volver" href="#/monografias/${esc(st.proyectoId)}">← Volver</a><section class="sis-tarjeta sis-vacio"><p>No se encontró la ficha (puede estar en la papelera).</p></section>`; return; }
      const sec = secuencia(), i = Math.max(0, sec.findIndex(s => s.clave === claveActual()));
      let cuerpo;
      if (st.vista === 'comun') cuerpo = await vistaComun();
      else if (st.vista === 'revisar') cuerpo = vistaRevisar();
      else {
        if (st.elegir || !st.fotos.length) st.fotos = await D.fotosDeProyecto(st.proyectoId);
        const x = st.x;
        cuerpo = `${x.nuevaDeTerreno ? `<div class="sis-tarjeta sis-aviso mn-aviso"><b>Terreno envió una versión más nueva de esta ficha.</b> <span>La que ves es la revisada en gabinete.</span> <button class="sis-btn chico" data-a="usar-terreno">Usar la de Terreno</button></div>` : ''}
          ${st.paso === 'ubicacion' ? await vistaUbicacion() : await vistaCoordenadas()}`;
      }
      cont.innerHTML = `${st.mensaje ? `<div class="vu-msg ${st.mensaje.tipo === 'error' ? 'error' : ''}" role="status">${esc(st.mensaje.texto)}</div>` : ''}
        ${cabHtml(sec, i)}<div class="mn-asis-cuerpo${st.vista === 'revisar' ? ' sin-flot' : ''}">${navHtml(sec, i)}<div class="mn-asis-main">${cuerpo}${pieHtml(sec, i)}</div>${flotanteHtml()}</div>
        ${st.elegir ? await selectorFotos() : ''}`;
      st.mensaje = null;
      colocarMinis();
      if (st.vista === 'ficha' && st.paso === 'ubicacion') estimarSiFalta();
    } catch (e) { console.error(e); cont.innerHTML = `<section class="sis-tarjeta sis-error"><p>${esc(e.message || 'Error')}</p></section>`; }
  }

  // ─────────── Acciones ───────────
  function convertir(desde, { forzar = false } = {}) {
    const f = st.ficha;
    if (!C.datumConvertible(f.datumUTM) || !C.datumConvertible(f.datumGeodesico)) return false;
    const fmt = st.comun.formatoGeo, dec = st.comun.decimalesGeo;
    if (desde === 'utm') {
      const libre = forzar || (!f.latitud && !f.longitud) || (f.calc && f.calc.geo && f.calc.geo.lat === f.latitud && f.calc.geo.lng === f.longitud);
      const g = C.utmAGeo(C.numero(f.este), C.numero(f.norte), f.zonaUTM);
      if (!g || !libre) return false;
      f.latitud = escribirGrados(g.lat, 'lat', fmt, dec); f.longitud = escribirGrados(g.lon, 'lon', fmt, dec);
      f.calc = { ...(f.calc || {}), geo: { lat: f.latitud, lng: f.longitud } };
    } else {
      const libre = forzar || (!f.este && !f.norte) || (f.calc && f.calc.utm && f.calc.utm.este === f.este && f.calc.utm.norte === f.norte);
      const u = C.geoAUtm(leerGrados(f.latitud), leerGrados(f.longitud), f.zonaUTM);
      if (!u || !libre || leerGrados(f.latitud) == null || leerGrados(f.longitud) == null) return false;
      f.este = C.metros(u.este); f.norte = C.metros(u.norte);
      f.calc = { ...(f.calc || {}), utm: { este: f.este, norte: f.norte } };
    }
    return true;
  }
  async function estimarSiFalta(forzar = false) {
    const f = st.ficha;
    if (!forzar && (st.intentoComuna || (f.comuna && f.region))) return;
    st.intentoComuna = true;
    let lat = leerGrados(f.latitud), lon = leerGrados(f.longitud);
    if ((lat == null || lon == null) && C.numero(f.este) != null) { const g = C.utmAGeo(C.numero(f.este), C.numero(f.norte), f.zonaUTM); if (g) ({ lat, lon } = g); }
    if (lat == null || lon == null) { if (forzar) { avisar('La ficha aún no tiene coordenadas.', 'error'); render(); } return; }
    try {
      const u = await ubicacionDe(lat, lon);
      if (!st.vivo || st.ficha !== f) return;
      if (forzar || !f.comuna) f.comuna = u.comuna || f.comuna;
      if (forzar || !f.region) f.region = u.region || f.region;
      f.comunaEstimada = true;
      await guardarAhora(); avisar('Comuna y región estimadas con las coordenadas: confírmalas.'); render();
    } catch (e) { if (forzar) { avisar('No se pudo estimar la comuna (¿sin internet?). Escríbela a mano.', 'error'); render(); } }
  }
  async function crearFichas(filas) {
    const p = st.proyecto, d = valoresPorDefecto();
    const porNombre = new Map(st.lista.map(y => [nombreDe(fichaDe(y)).toLowerCase(), y]));
    let nuevas = 0, act = 0, primera = null;
    for (const r of filas) {
      const extra = {};
      if (r.este != null && r.norte != null) { extra.este = C.metros(r.este); extra.norte = C.metros(r.norte); }
      if (r.cota != null) extra.cotaOrtometrica = C.metros(r.cota);
      const y = porNombre.get(String(r.nombre).toLowerCase());
      let f;
      if (y) { if (!Object.keys(extra).length) continue; f = { ...JSON.parse(JSON.stringify(y.ficha)), ...extra }; }
      else f = C.fichaNueva({ id: uuid(), proyectoId: st.proyectoId, nombre: r.nombre, defaults: d, comun: st.comun, proyecto: p, extra });
      if (extra.este) { const prev = st.ficha; st.ficha = f; convertir('utm', { forzar: true }); st.ficha = prev; }
      if (y) { await guardarFicha(y, f); act++; } else { await D.guardarGabinete(f); nuevas++; primera = primera || f.id; }
    }
    return { nuevas, act, primera };
  }
  async function subirImagen(archivo, slot) {
    const cli = C.valorComun(st.comun, st.lista.map(fichaDe), 'clienteNombre').v;
    const deCliente = slot === 'clienteLogo' && cli;
    const f = st.ficha;
    const reg = await guardarArchivo(archivo, { modulo: 'terreno', duenoTipo: deCliente ? 'cliente_logo' : 'terreno_monografia', duenoId: deCliente ? claveCliente(cli) : (f ? f.id : st.proyectoId), rol: 'foto', proyectoId: st.proyectoId,
      carpeta: `Proyectos/${st.proyecto ? st.proyecto.nombre : st.proyectoId}/Monografías`, detalle: { tipo: slot === 'croquisImg' ? 'croquis' : slot === 'panoramicaImg' ? 'panoramica' : slot === 'clienteLogo' ? 'logo' : 'detalle', punto: f ? f.puntoMedido || '' : '', origen: 'gabinete' } });
    return { archivo: reg.id };
  }
  function ponerImagen(slot, valor) {
    const f = st.ficha;
    if (slot === 'extra') { f.fotosExtra = f.fotosExtra || []; f.fotosExtra.push({ id: uuid(), img: valor, leyenda: '', aj: { modo: 'llenar', zoom: 1, ox: 0, oy: 0, giro: 0 } }); }
    else { f[slot] = valor; if (f.ajustes) delete f.ajustes[slot]; }
  }
  async function descargarPdf(lista, nombre) {
    avisar('Generando PDF…'); await render();
    const blob = await pdfDe(lista);
    if (blob) { descargar(nombre, blob, 'application/pdf'); avisar(`PDF listo: ${lista.length} ficha${lista.length === 1 ? '' : 's'}.`); }
  }

  cont.addEventListener('input', ev => {
    const t = ev.target;
    if (t.dataset.f != null && st.ficha) {
      st.ficha[t.dataset.f] = t.value;
      if (t.dataset.f === 'comuna' || t.dataset.f === 'region') st.ficha.comunaEstimada = false;
      cambio();
    } else if (t.dataset.c != null) { st.comun.valores[t.dataset.c] = t.value; cambioComun(t.dataset.c); }
    else if (t.dataset.extra != null && st.ficha) { st.ficha.fotosExtra[Number(t.dataset.extra)].leyenda = t.value; cambio(); }
    else if (t.dataset.pres && t.type === 'range') { const x = cont.querySelector(`[data-pres-txt="${t.dataset.pres}"]`); if (x) x.textContent = (Number(t.value) / 10).toLocaleString('es-CL', { maximumFractionDigits: 1 }); }
    else if (t.hasAttribute('data-pegar')) {
      st.pegar = t.value;
      const caja = cont.querySelector('.mn-pegar-prev'), tmp = document.createElement('div'); tmp.innerHTML = pegarHtml();
      if (caja) caja.replaceWith(tmp.querySelector('.mn-pegar-prev'));
      const b = cont.querySelector('[data-a="pegar-aplicar"]'), nb = tmp.querySelector('[data-a="pegar-aplicar"]'); if (b && nb) b.replaceWith(nb);
    }
  });

  cont.addEventListener('change', async ev => {
    const t = ev.target;
    try {
      if (t.dataset.f != null && st.ficha) {
        const k = t.dataset.f;
        const desde = ['este', 'norte'].includes(k) ? 'utm' : ['latitud', 'longitud'].includes(k) ? 'geo' : null;
        if (desde === 'geo') { const v = leerGrados(st.ficha[k]); if (v != null) st.ficha[k] = escribirGrados(v, k === 'latitud' ? 'lat' : 'lon', st.comun.formatoGeo, st.comun.decimalesGeo); }
        if (desde && convertir(desde)) { await guardarAhora(); await render(); }
        else if (k === 'puntoMedido') { await guardarAhora(); await render(); }
        return;
      }
      if (t.dataset.todas) {
        st.comun.todas[t.dataset.todas] = t.checked; guardarComun(st.proyectoId, st.comun);
        if (t.checked) { const k = t.dataset.todas, v = C.valorComun(st.comun, st.lista.map(fichaDe), k).v; st.comun.valores[k] = v; const n = await aplicarATodas(f => { f[k] = v ?? ''; }); if (n) avisar(`«${C.ETIQUETA[k]}» igualado en ${n} ficha${n === 1 ? '' : 's'}.`); }
        await render(); return;
      }
      if (t.dataset.mod) {
        st.comun.modulos[t.dataset.mod] = t.checked; guardarComun(st.proyectoId, st.comun);
        await aplicarATodas(f => { f.modulos = { ...(f.modulos || {}), [t.dataset.mod]: t.checked }; });
        await render(); return;
      }
      if (t.hasAttribute('data-dec')) { st.comun.decimalesGeo = Math.max(0, Math.min(8, Number(t.value) || 0)); guardarComun(st.proyectoId, st.comun); await reformatear(); await render(); return; }
      if (t.hasAttribute('data-equipo')) {
        let v = t.value;
        if (v === '__otro') { v = (prompt('Equipo (marca, modelo y número de serie):') || '').trim(); if (!v) { await render(); return; } }
        st.comun.valores.equipoGNSS = v; cambioComun('equipoGNSS'); clearTimeout(st.guardando); st.comunPend.clear();
        if (st.comun.todas.equipoGNSS) await aplicarATodas(f => { f.equipoGNSS = v; });
        await render(); return;
      }
      if (t.hasAttribute('data-cliente')) {
        let k = t.value, nombre;
        if (k === '__nuevo') {
          nombre = (prompt('Nombre del cliente:') || '').trim();
          if (!nombre) { await render(); return; }
          const l = leerLS('mono_clientes', []); if (!l.includes(nombre)) { l.push(nombre); escribirLS('mono_clientes', l); }
          k = claveCliente(nombre);
        } else nombre = ((await clientes()).find(c => c.k === k) || {}).nombre || '';
        st.comun.valores.clienteNombre = nombre; guardarComun(st.proyectoId, st.comun);
        const logo = (await archivosDe('cliente_logo', k))[0];
        if (st.comun.todas.clienteNombre) await aplicarATodas(f => { f.clienteNombre = nombre; if (logo) { f.clienteLogo = { archivo: logo.id }; if (f.ajustes) delete f.ajustes.clienteLogo; } });
        await render(); return;
      }
      if (t.dataset.pres && st.ficha) { st.ficha[t.dataset.pres] = Number(t.value); await guardarAhora(); return; }
      if (t.dataset.archivo && t.files && t.files[0]) {
        const archivo = t.files[0], slot = t.dataset.archivo; t.value = '';
        if (slot === 'logo') { const r = new FileReader(); r.onload = async () => { fijarLogoEmpresa(r.result); avisar('Logo de la empresa guardado.'); await render(); }; r.readAsDataURL(archivo); return; }
        const valor = await subirImagen(archivo, slot);
        if (slot === 'clienteLogo') { await aplicarATodas(f => { f.clienteLogo = valor; if (f.ajustes) delete f.ajustes.clienteLogo; }); avisar('Logo del cliente guardado en todas las fichas.'); }
        else { ponerImagen(slot, valor); await guardarAhora(); }
        await render();
      }
    } catch (e) { console.error(e); avisar(e.message || 'No se pudo', 'error'); await render(); }
  });

  /** Reescribe latitud y longitud de todas las fichas en el formato elegido. */
  async function reformatear() {
    const { formatoGeo: fmt, decimalesGeo: dec } = st.comun;
    const rees = f => {
      const la = leerGrados(f.latitud), lo = leerGrados(f.longitud), eraCalc = f.calc && f.calc.geo && f.calc.geo.lat === f.latitud && f.calc.geo.lng === f.longitud;
      if (la != null) f.latitud = escribirGrados(la, 'lat', fmt, dec);
      if (lo != null) f.longitud = escribirGrados(lo, 'lon', fmt, dec);
      if (eraCalc) f.calc.geo = { lat: f.latitud, lng: f.longitud };
      f.formatoGeo = fmt; f.decimalesGeo = dec;
    };
    if (st.ficha) { rees(st.ficha); await guardarAhora(); }
    await aplicarATodas(rees);
  }

  cont.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a, f = st.ficha;
    try {
      if (a === 'flotante') { st.abierto = !st.abierto; escribirLS('mn_flotante', st.abierto); refrescarFlotante(); return; }
      if (a === 'tipo') { st.comun.valores.tipoMedicion = b.dataset.v; cambioComun('tipoMedicion'); clearTimeout(st.guardando); st.comunPend.clear(); if (st.comun.todas.tipoMedicion) await aplicarATodas(x => { x.tipoMedicion = b.dataset.v; }); }
      else if (a === 'crear-nombres') {
        const nombres = C.nombresDeTexto((cont.querySelector('#mn-nombres') || {}).value);
        if (!nombres.length) { avisar('Escribe los nombres: «PR-1 a PR-12» o «PR-1, PR-2».', 'error'); }
        else { const r = await crearFichas(nombres.map(nombre => ({ nombre }))); avisar(r.nuevas ? `${r.nuevas} ficha${r.nuevas === 1 ? '' : 's'} nueva${r.nuevas === 1 ? '' : 's'}.` : 'Esas fichas ya existían.'); }
      }
      else if (a === 'pegar-abrir') { st.pegar = ''; }
      else if (a === 'pegar-cerrar') { st.pegar = null; }
      else if (a === 'pegar-aplicar') {
        const r = await crearFichas(C.leerTabla(st.pegar)); st.pegar = null;
        avisar(`${r.nuevas} ficha${r.nuevas === 1 ? '' : 's'} nueva${r.nuevas === 1 ? '' : 's'}${r.act ? ` y ${r.act} actualizada${r.act === 1 ? '' : 's'}` : ''}, con sus coordenadas.`);
      }
      else if (a === 'formato') { st.comun.formatoGeo = b.dataset.v; guardarComun(st.proyectoId, st.comun); await reformatear(); }
      else if (a === 'quitar-logo') { fijarLogoEmpresa(null); }
      else if (a === 'recalcular') { if (convertir(b.dataset.v === 'geo' ? 'utm' : 'geo', { forzar: true })) { await guardarAhora(); avisar(b.dataset.v === 'geo' ? 'Geográficas calculadas desde UTM.' : 'UTM calculadas desde las geográficas.'); } else avisar('Faltan coordenadas o el huso para calcular.', 'error'); }
      else if (a === 'croquis-mapa') {
        let lat = leerGrados(f.latitud), lon = leerGrados(f.longitud);
        if ((lat == null || lon == null) && C.numero(f.este) != null) { const g = C.utmAGeo(C.numero(f.este), C.numero(f.norte), f.zonaUTM); if (g) ({ lat, lon } = g); }
        const d = dimsMonografia(C.efectiva(f)).croquisImg;
        const url = await abrirCroquis({ lat, lon, nombre: f.puntoMedido || '', aspecto: d[0] / d[1] });
        if (!url) return;
        const reg = await guardarArchivoDatos(url, `croquis_${nombreArchivo(f.puntoMedido)}.jpg`, { modulo: 'terreno', duenoTipo: 'terreno_monografia', duenoId: f.id, rol: 'foto', proyectoId: st.proyectoId, carpeta: `Proyectos/${st.proyecto ? st.proyecto.nombre : st.proyectoId}/Monografías`, detalle: { tipo: 'croquis', punto: f.puntoMedido || '', origen: 'gabinete' } }, { personaId: ctx.personaId });
        ponerImagen('croquisImg', { archivo: reg.id }); await guardarAhora(); avisar('Croquis listo. Puedes ajustar su encuadre.');
      }
      else if (a === 'elegir') { st.elegir = b.dataset.slot; }
      else if (a === 'cerrar-elegir') { st.elegir = null; }
      else if (a === 'usar-foto') { ponerImagen(st.elegir, { archivo: b.dataset.id }); st.elegir = null; await guardarAhora(); }
      else if (a === 'ajustar') {
        const d = dimsMonografia(C.efectiva(f)), i = b.dataset.i, extra = i != null ? f.fotosExtra[Number(i)] : null, clave = b.dataset.slot;
        const url = await urlImagen(extra ? extra.img : f[clave]);
        if (!url) return;
        const dim = extra ? d.extra : d[clave];
        const aj = await abrirAjuste({ titulo: extra ? (extra.leyenda || `Fotografía ${Number(i) + 1}`) : ranura[clave], url, bw: dim[0], bh: dim[1], ajuste: extra ? extra.aj : (f.ajustes || {})[clave], porDefecto: extra ? 'llenar' : MODO_DEF[clave] });
        if (!aj) return;
        if (extra) extra.aj = aj; else { f.ajustes = f.ajustes || {}; f.ajustes[clave] = aj; }
        await guardarAhora(); avisar('Encuadre aplicado: así queda en el PDF.');
      }
      else if (a === 'quitar-img') { f[b.dataset.slot] = null; if (f.ajustes) delete f.ajustes[b.dataset.slot]; await guardarAhora(); }
      else if (a === 'quitar-extra') { f.fotosExtra.splice(Number(b.dataset.i), 1); await guardarAhora(); }
      else if (a === 'disposicion') { f.disposicionImg = b.dataset.v; await guardarAhora(); }
      else if (a === 'copiar-anterior') {
        const i = st.lista.findIndex(y => y.id === f.id), ant = i > 0 ? fichaDe(st.lista[i - 1]) : null;
        if (ant) { f.ubicacion = ant.ubicacion || ''; f.localidad = ant.localidad || ''; await guardarAhora(); avisar(`Sector y localidad copiados de ${nombreDe(ant)}.`); }
      }
      else if (a === 'estimar-comuna') { await estimarSiFalta(true); return; }
      else if (a === 'confirmar-comuna') { f.comunaEstimada = false; await guardarAhora(); }
      else if (a === 'frase') {
        const ta = cont.querySelector('#mn-desc'), txt = b.dataset.t;
        f.descripcion = f.descripcion && !/\s$/.test(f.descripcion) ? `${f.descripcion} ${txt}` : `${f.descripcion || ''}${txt}`;
        if (ta) { ta.value = f.descripcion; ta.focus(); }
        cambio(); return;
      }
      else if (a === 'guardar-frase') {
        const ta = cont.querySelector('#mn-desc');
        const sel = ta && ta.selectionEnd > ta.selectionStart ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : String(f.descripcion || '').split('\n').filter(l => l.trim()).pop() || '';
        const t2 = sel.trim();
        if (!t2) { avisar('Escribe o selecciona el texto que quieres guardar como frase.', 'error'); }
        else { const l = leerLS('mono_frases', []); if (!l.includes(t2) && !C.FRASES_BASE.includes(t2)) { l.push(t2); escribirLS('mono_frases', l.slice(-20)); } avisar('Frase guardada.'); }
      }
      else if (a === 'estado') {
        const e = b.dataset.e;
        if (e === 'con-observacion' && !b.dataset.enviar) { st.estadoSel = e; refrescarFlotante(); return; }
        const obs = (cont.querySelector('#mn-obs') || {}).value || '';
        if (e === 'con-observacion' && !obs.trim()) { avisar('Escribe la observación para terreno.', 'error'); }
        else {
          if (st.guardando) await guardarAhora();
          await D.agregarRevision({ monografiaId: st.x.id, proyectoId: st.proyectoId, estado: e, observacion: e === 'con-observacion' ? obs : '' });
          if (e === 'lista' && !f.revisoNombre && ctx.personaId && st.nombres[ctx.personaId]) { f.revisoNombre = st.nombres[ctx.personaId]; f.fechaRevision = new Date().toISOString().slice(0, 10); await guardarAhora(); }
          st.estadoSel = null;
          avisar(e === 'con-observacion' ? 'Observación enviada: el encargado la verá en la app de Terreno.' : `Estado: ${D.ESTADOS[e].texto}.`);
        }
      }
      else if (a === 'eliminar') {
        if (!confirm(`¿Eliminar la ficha «${b.dataset.nombre}»?\n\nVa a la papelera del proyecto y se puede restaurar.`)) return;
        clearTimeout(st.guardando); st.guardando = null;
        await eliminarMonografia(b.dataset.id, ctx.personaId);
        avisar(`«${b.dataset.nombre}» quedó en la papelera.`);
        if (st.ficha && st.ficha.id === b.dataset.id) { st.ficha = null; location.hash = rutaRevisar(); return; }
      }
      else if (a === 'usar-terreno') { await D.usarVersionDeTerreno(st.x.id); st.ficha = null; avisar('Se tomó la versión que envió Terreno.'); }
      else if (a === 'pdf') {
        const y = st.lista.find(z => z.id === b.dataset.id);
        if (f && f.id === b.dataset.id) await guardarAhora();
        const ff = fichaDe(y); await descargarPdf([ff], `monografia_${nombreArchivo(ff.puntoMedido)}.pdf`);
      }
      else if (a === 'pdf-todas') {
        const lista = st.lista.filter(y => !b.dataset.solo || y.estado === b.dataset.solo).map(fichaDe);
        await descargarPdf(lista, `monografias_${nombreArchivo(st.proyecto ? st.proyecto.nombre : 'proyecto')}_${new Date().toISOString().slice(0, 10)}.pdf`);
      }
      else if (a === 'ver-pdf') {
        if (st.guardando) await guardarAhora();
        const w = window.open('', '_blank');
        const lista = f ? [f] : st.lista.map(fichaDe);
        const blob = await pdfDe(lista);
        if (!blob) return;
        if (w) w.location.href = URL.createObjectURL(blob); else descargar(`monografia_${nombreArchivo(f ? f.puntoMedido : 'todas')}.pdf`, blob, 'application/pdf');
        return;
      }
      else return;
    } catch (e) { console.error(e); avisar(e.message || 'No se pudo', 'error'); }
    await render();
  });

  render();
  return { desmontar() { st.vivo = false; if (st.guardando && st.ficha) guardarAhora(); }, refrescar: render };
}
