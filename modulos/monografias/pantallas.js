// modulos/monografias/pantallas.js — pantallas de Monografías (PC): proyectos → monografías del proyecto → ficha.
// La ficha usa los mismos campos que la monografía de Terreno; el chequeo y el PDF vienen de pieza-terreno.js.

import { escapar as esc, descargar, fechaLegible, fechaHoraLegible, uuid } from '../../compartido/util.js';
import { listarProyectos, obtenerProyecto, listarPersonas, OFICINA_ID } from '../../compartido/catalogos.js';
import { urlArchivo, guardarArchivo, guardarArchivoDatos, archivosDe } from '../../compartido/archivos.js';
import { DATUMS_CHILE, GEOIDES, ZONAS_POR_PAIS, leerGrados, escribirGrados } from './coordenadas.js';
import { abrirCroquis } from './croquis.js';
import * as D from './datos.js';
import { configurarPieza, chequeoMonografia, valoresPorDefecto, dimsMonografia, ajusteDe, cargarImagenEl } from './pieza-terreno.js';
import { abrirAjuste, colocarImagen } from './ajuste.js';
import { pdfDe, urlImagen, logoEmpresa, fijarLogoEmpresa, ordenNatural } from './pdf.js';

const CAMPOS = [
  ['General', [['tituloDocumento', 'Título del documento'], ['clienteNombre', 'Cliente'], ['nombreProyecto', 'Nombre del proyecto']]],
  ['Punto', [['puntoMedido', 'Punto medido'], ['ubicacion', 'Ubicación (sector / lugar)'], ['localidad', 'Localidad'], ['comuna', 'Comuna'], ['region', 'Región']]],
  ['utm', [['datumUTM', 'Datum'], ['zonaUTM', 'Zona'], ['norte', 'Norte (m)'], ['este', 'Este (m)'], ['cotaOrtometrica', 'Cota ortométrica (m)']]],
  ['geodesicas', [['datumGeodesico', 'Datum geodésico'], ['geoide', 'Geoide'], ['latitud', 'Latitud'], ['longitud', 'Longitud'], ['alturaElipsoidal', 'Altura elipsoidal (m)']]],
  ['firma', [['equipoGNSS', 'Equipo GNSS'], ['tipoMedicion', 'Tipo de medición'], ['operadorNombre', 'Operador'], ['operadorCargo', 'Cargo'], ['fechaMedicion', 'Fecha de medición', 'date'], ['revisoNombre', 'Revisó'], ['fechaRevision', 'Fecha de revisión', 'date']]],
];
const MODULOS = [['utm', 'Coordenadas UTM'], ['geodesicas', 'Coordenadas geodésicas'], ['croquis', 'Croquis de ubicación'], ['panoramica', 'Vista panorámica'], ['descripcion', 'Descripción'], ['observacion', 'Observación'], ['fotos', 'Fotografías adicionales'], ['firma', 'Datos operador / Revisó']];
// v0.11: grupos que se pueden aplicar a todas las fichas del proyecto.
const GRUPO_UBICACION = ['ubicacion', 'localidad', 'comuna', 'region'];
const GRUPO_FIRMA = ['equipoGNSS', 'tipoMedicion', 'operadorNombre', 'operadorCargo', 'fechaMedicion', 'revisoNombre', 'fechaRevision'];
const PROPIOS_FICHA = ['equipoGNSS', 'fechaMedicion']; // con «fecha y equipos propios», la ficha no los recibe de las demás
const claveCliente = t => String(t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const leerComun = id => { try { return JSON.parse(localStorage.getItem(`mono_comun_${id}`) || '{}'); } catch { return {}; } };
const guardarComun = (id, v) => { try { localStorage.setItem(`mono_comun_${id}`, JSON.stringify(v)); } catch { /* */ } };
const TIPO_FOTO = { panoramica: 'Panorámica', croquis: 'Croquis', placa: 'Placa', detalle: 'Detalle', punto: 'Punto', logo: 'Logo', otra: 'Foto' };
const ranura = { croquisImg: 'Croquis de ubicación', panoramicaImg: 'Vista panorámica', clienteLogo: 'Logo del cliente' };
const MODO_DEF = { clienteLogo: 'ajustar', croquisImg: 'llenar', panoramicaImg: 'llenar' };
// Ancho en pantalla (px) de la miniatura de cada recuadro; el alto sale de las medidas del PDF.
const ANCHO_MINI = { croquisImg: 300, panoramicaImg: 300, clienteLogo: 180, extra: 220 };

export function montarPantallas(raiz, ctx) {
  const st = { proyectoId: ctx.proyectoId || null, monoId: ctx.monografiaId || null, lista: [], ficha: null, fotos: [], elegir: null, mensaje: null, filtro: '', nombres: {}, guardando: null, vivo: true };
  raiz.innerHTML = '<div class="mn"></div>';
  const cont = raiz.querySelector('.mn');
  const avisar = (texto, tipo = 'ok') => { st.mensaje = { texto, tipo }; };
  const ir = (proy, mono) => { location.hash = `#/monografias${proy ? '/' + proy : ''}${mono ? '/' + mono : ''}`; };

  // ─────────── Vistas ───────────
  async function vistaProyectos() {
    const proys = (await listarProyectos()).filter(p => p.id !== OFICINA_ID && p.estado !== 'cerrado');
    const filas = await Promise.all(proys.map(async p => ({ p, r: await D.resumenDeProyecto(p.id) })));
    filas.sort((a, b) => b.r.total - a.r.total || a.p.nombre.localeCompare(b.p.nombre, 'es'));
    return `<div class="mn-cab"><h1>Monografías</h1><p class="sis-tenue">Por proyecto: lo que llega desde la app de Terreno (monografías, jornadas y fotos), la revisión en gabinete y el PDF.</p></div>
      <section class="sis-tarjeta"><div class="sis-lista">${filas.map(({ p, r }) => `<a class="sis-fila" href="#/monografias/${esc(p.id)}">
          <span class="sis-fila-txt"><b>${esc(p.nombre)}</b><span class="sis-tenue">${esc(p.mandante || '')}${r.jornadas.length ? ` · ${r.jornadas.length} jornada${r.jornadas.length > 1 ? 's' : ''} de terreno` : ''}</span></span>
          <span class="sis-chips">${r.total ? Object.entries(r.porEstado).map(([e, n]) => `<span class="sis-chip ${D.ESTADOS[e].color}">${n} ${esc(D.ESTADOS[e].texto.toLowerCase())}</span>`).join('') : '<span class="sis-chip gris">sin monografías</span>'}</span></a>`).join('') || '<div class="sis-vacio"><p>No hay proyectos activos.</p></div>'}</div></section>`;
  }

  async function vistaProyecto() {
    const p = await obtenerProyecto(st.proyectoId);
    if (!p) return '<section class="sis-tarjeta sis-vacio"><p>No se encontró el proyecto.</p></section>';
    st.proyecto = p;
    st.lista = await D.monografiasDeProyecto(st.proyectoId);
    configurarPieza({ monografias: st.lista.map(x => x.ficha) });
    const jornadas = await D.jornadasDeProyecto(st.proyectoId);
    const fotos = await D.fotosDeProyecto(st.proyectoId);
    const lista = st.lista.filter(x => !st.filtro || x.estado === st.filtro).sort((a, b) => ordenNatural(a.ficha, b.ficha));
    const cuenta = e => st.lista.filter(x => x.estado === e).length;
    const faltan = f => chequeoMonografia(f).filter(c => !c.ok).length;
    return `<a class="sis-volver" href="#/monografias">← Monografías</a>
      <div class="mn-cab"><h1>${esc(p.nombre)}</h1><p class="sis-tenue">${esc(p.mandante || '')} · ${st.lista.length} monografía${st.lista.length === 1 ? '' : 's'} · ${jornadas.length} jornada${jornadas.length === 1 ? '' : 's'} y ${fotos.length} foto${fotos.length === 1 ? '' : 's'} desde Terreno</p></div>
      <section class="sis-tarjeta mn-config"><h2>Configurar</h2>
        <div class="mn-config-fila">
          <label class="sis-campo"><span>Cantidad de fichas a crear</span><span class="sis-en-linea"><input type="number" min="1" max="60" value="1" id="mn-n-fichas" aria-label="Cantidad de fichas"><button type="button" class="sis-btn" data-mn="crear-n">Crear fichas</button></span></label>
          <div class="mn-config-logo"><span class="mn-logo-mini">${logoEmpresa() ? `<img src="${logoEmpresa()}" alt="Logo de la empresa">` : '<span class="sis-tenue">Sin logo</span>'}</span>
            <span><b>Logo de la empresa</b><small class="sis-tenue">Va en el recuadro superior derecho del PDF.</small><span class="sis-acciones"><label class="sis-btn chico">${logoEmpresa() ? 'Cambiar' : 'Cargar logo'}<input type="file" accept="image/*" data-mn-archivo="logo" hidden></label>${logoEmpresa() ? '<button class="sis-btn chico" data-mn="quitar-logo">Quitar</button>' : ''}</span></span></div>
        </div>
        <p class="sis-tenue">Cada ficha se abre en su propia pestaña. En la ficha eliges si el PDF lleva Descripción, Observación o ambas, y si la ubicación y los datos del operador se aplican a todas las fichas.</p>
      </section>
      <div class="mn-barra">
        <div class="mn-filtros">${[['', `Todas · ${st.lista.length}`], ...Object.keys(D.ESTADOS).filter(cuenta).map(e => [e, `${D.ESTADOS[e].texto} · ${cuenta(e)}`])].map(([e, t]) => `<button type="button" class="vu-pildora${st.filtro === e ? ' activo' : ''}" data-mn="filtro" data-e="${e}">${esc(t)}</button>`).join('')}</div>
        <div class="sis-acciones"><button class="sis-btn" data-mn="nueva">+ Monografía en gabinete</button><button class="sis-btn primario" data-mn="pdf-todas" ${lista.length ? '' : 'disabled'}>PDF de ${st.filtro ? 'estas' : 'todas'} (${lista.length})</button></div>
      </div>
      <section class="sis-tarjeta">${lista.length ? `<table class="mn-tabla"><thead><tr><th>Punto</th><th>Estado</th><th>Faltan</th><th>Medición</th><th>Operador</th><th></th></tr></thead><tbody>
        ${lista.map(x => { const f = x.ficha, n = faltan(f); return `<tr>
          <td><a href="#/monografias/${esc(st.proyectoId)}/${esc(x.id)}"><b>${esc(f.puntoMedido || '(sin punto)')}</b></a>${x.nuevaDeTerreno ? '<small class="mn-nueva">Terreno envió cambios</small>' : ''}</td>
          <td><span class="sis-chip ${D.ESTADOS[x.estado].color}">${esc(D.ESTADOS[x.estado].texto)}</span>${x.observacion ? `<small class="mn-obs">${esc(x.observacion)}</small>` : ''}</td>
          <td>${n ? `<span class="sis-chip ambar">${n}</span>` : '<span class="sis-chip verde">completa</span>'}</td>
          <td>${f.fechaMedicion ? esc(fechaLegible(f.fechaMedicion)) : '—'}</td><td>${esc(f.operadorNombre || '—')}</td>
          <td class="mn-acc"><a class="sis-btn chico" href="#/monografias/${esc(st.proyectoId)}/${esc(x.id)}">Abrir</a><button class="sis-btn chico" data-mn="pdf" data-id="${esc(x.id)}">PDF</button></td></tr>`; }).join('')}
        </tbody></table>` : `<div class="sis-vacio"><p>${st.lista.length ? 'Ninguna con ese estado.' : 'Aún no llegan monografías de este proyecto. En la app de Terreno: elige el proyecto del Sistema en la monografía y toca «Enviar al Sistema». También puedes crear una aquí.'}</p></div>`}</section>
      ${jornadas.length ? `<section class="sis-tarjeta"><h2>Jornadas de terreno</h2><div class="sis-lista">${jornadas.slice(0, 12).map(j => `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(j.fechaInicio ? fechaHoraLegible(j.fechaInicio) : 'Jornada')}</b><span class="sis-tenue">${esc(j.operador || '')}${j.horas != null ? ` · ${Number(j.horas).toLocaleString('es-CL', { maximumFractionDigits: 1 })} h` : ''}</span></span>
          <span class="sis-chips"><span class="sis-chip gris">${(j.levantamientos || []).length} levantamiento${(j.levantamientos || []).length === 1 ? '' : 's'}</span><span class="sis-chip gris">${(j.levantamientos || []).reduce((s, l) => s + (l.puntos || []).length, 0)} puntos</span></span></div>`).join('')}</div></section>` : ''}
`;
  }

  function campo(k, t, tipo = 'text', lista = null) {
    const f = st.ficha;
    return `<label class="sis-campo"><span>${esc(t)}</span><input type="${tipo}" data-f="${k}" value="${esc(f[k] ?? '')}"${/norte|este|cota|altura/i.test(k) ? ' inputmode="decimal"' : ''}${lista ? ` list="mn-l-${k}"` : ''}>${lista ? `<datalist id="mn-l-${k}">${lista.map(v => `<option value="${esc(v)}">`).join('')}</datalist>` : ''}</label>`;
  }
  /** Clientes conocidos (mandantes de los proyectos y los que tienen logo guardado) con su logo. */
  async function clientes() {
    const nombres = new Map();
    for (const p of await listarProyectos()) if (p.mandante && p.mandante.trim()) nombres.set(claveCliente(p.mandante), p.mandante.trim());
    if (st.ficha && st.ficha.clienteNombre) nombres.set(claveCliente(st.ficha.clienteNombre), st.ficha.clienteNombre);
    try { for (const n of JSON.parse(localStorage.getItem('mono_clientes') || '[]')) nombres.set(claveCliente(n), n); } catch { /* */ }
    return Promise.all([...nombres.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(async ([k, nombre]) => ({ k, nombre, logo: ((await archivosDe('cliente_logo', k))[0] || {}).id || null })));
  }
  function chequeoHtml() {
    const filas = chequeoMonografia(st.ficha);
    return `<div class="mn-chequeo">${filas.map(f => `<div class="mn-ch"><span class="mn-ch-ic ${f.ok ? (f.dup ? 'dup' : f.calc ? 'calc' : 'ok') : 'falta'}" aria-hidden="true">${f.ok ? (f.dup ? '!' : f.calc ? '?' : '✔') : '–'}</span><span>${esc(f.k)}${f.det ? `<small>${esc(f.det)}</small>` : ''}${f.dup ? `<small class="mn-av">${esc(f.dup)}</small>` : ''}${f.calc ? `<small class="mn-av">${esc(f.calc)}</small>` : ''}</span></div>`).join('')}</div>
      <p class="sis-tenue mn-ley">✔ ingresado · – falta · ! repetido en el proyecto · ? calculado por la app de Terreno</p>`;
  }
  /** Miniatura con el encuadre real del PDF (se coloca la imagen después de pintar: ver colocarMinis). */
  function miniHtml(url, dim, ancho, datos, titulo) {
    return `<div class="mn-mini" style="width:${ancho}px; aspect-ratio:${dim[0].toFixed(1)} / ${dim[1].toFixed(1)}" ${datos}>${url ? `<img src="${esc(url)}" alt="${esc(titulo)}" draggable="false">` : '<span class="sis-tenue">Sin imagen</span>'}</div>`;
  }
  async function imagenHtml(clave, titulo) {
    const url = await urlImagen(st.ficha[clave]), dim = dimsMonografia(st.ficha)[clave];
    return `<div class="mn-slot"><div class="mn-slot-tit">${esc(titulo)}</div>
      ${miniHtml(url, dim, ANCHO_MINI[clave], `data-mini="${clave}"`, titulo)}
      <div class="sis-acciones"><button class="sis-btn chico" data-mn="elegir" data-slot="${clave}">Elegir de terreno</button><label class="sis-btn chico">Subir<input type="file" accept="image/*" data-mn-archivo="${clave}" hidden></label>${url ? `<button class="sis-btn chico" data-mn="ajustar" data-slot="${clave}">✂ Ajustar encuadre</button><button class="sis-btn chico" data-mn="quitar-img" data-slot="${clave}">Quitar</button>` : ''}</div></div>`;
  }
  /** Presentación de las imágenes (los mismos campos que en Terreno: disposicionImg, altoImagenes, altoFotosExtra). */
  function presentacionHtml(mod) {
    const f = st.ficha, ambas = mod.croquis && mod.panoramica;
    if (!mod.croquis && !mod.panoramica && !mod.fotos) return '';
    const alto = Number(f.altoImagenes) || 56, altoE = Number(f.altoFotosExtra) || 60;
    return `<section class="sis-tarjeta"><h2>Presentación de las imágenes</h2>
      ${ambas ? `<label class="sis-campo"><span>Disposición croquis / panorámica</span><select data-pres="disposicionImg"><option value="lado" ${(f.disposicionImg || 'lado') === 'lado' ? 'selected' : ''}>Lado a lado</option><option value="apiladas" ${f.disposicionImg === 'apiladas' ? 'selected' : ''}>Una bajo la otra (ancho completo)</option></select></label>` : ''}
      ${mod.croquis || mod.panoramica ? `<label class="sis-campo"><span>Alto de cada imagen: <b data-pres-txt="altoImagenes">${alto}</b> mm</span><input type="range" min="35" max="120" step="1" data-pres="altoImagenes" value="${alto}"></label>` : ''}
      ${mod.fotos ? `<label class="sis-campo"><span>Alto de las fotografías adicionales: <b data-pres-txt="altoFotosExtra">${altoE}</b> mm</span><input type="range" min="35" max="120" step="1" data-pres="altoFotosExtra" value="${altoE}"></label>` : ''}
      <p class="sis-tenue">Cada imagen se encuadra con «✂ Ajustar encuadre»: llenar o entera, zoom, mover y girar, como en la app de Terreno.</p></section>`;
  }
  /** Coloca cada miniatura con su ajuste (como quedará en el PDF). */
  function colocarMinis() {
    for (const caja of cont.querySelectorAll('.mn-mini')) {
      const img = caja.querySelector('img');
      if (!img || !st.ficha) continue;
      const clave = caja.dataset.mini, i = caja.dataset.miniExtra;
      const aj = i != null ? { modo: 'llenar', zoom: 1, ox: 0, oy: 0, giro: 0, ...((st.ficha.fotosExtra[Number(i)] || {}).aj || {}) } : ajusteDe(st.ficha, clave, MODO_DEF[clave]);
      cargarImagenEl(img.src).then(im => colocarImagen(img, { w: im.naturalWidth, h: im.naturalHeight }, caja.clientWidth, caja.clientHeight, aj)).catch(() => {});
    }
  }
  async function vistaFicha() {
    if (!st.proyecto || st.proyecto.id !== st.proyectoId) st.proyecto = await obtenerProyecto(st.proyectoId);
    const x = (await D.monografiasDeProyecto(st.proyectoId)).find(y => y.id === st.monoId);
    if (!x) return `<a class="sis-volver" href="#/monografias/${esc(st.proyectoId)}">← Volver</a><section class="sis-tarjeta sis-vacio"><p>No se encontró la monografía.</p></section>`;
    st.x = x;
    if (!st.ficha || st.ficha.id !== x.id) st.ficha = JSON.parse(JSON.stringify(x.ficha));
    st.lista = await D.monografiasDeProyecto(st.proyectoId);
    configurarPieza({ monografias: st.lista.map(y => y.id === x.id ? st.ficha : y.ficha) });
    st.fotos = await D.fotosDeProyecto(st.proyectoId);
    const f = st.ficha, mod = f.modulos || (f.modulos = { utm: true, geodesicas: true, croquis: true, panoramica: true, descripcion: true, firma: true, fotos: false });
    const hist = await D.historialDe(x.id);
    const dimE = dimsMonografia(f).extra;
    const comun = leerComun(st.proyectoId);
    const cls = await clientes();
    const pais = f.paisUTM || 'Chile';
    const extras = await Promise.all((f.fotosExtra || []).map(async (e, i) => { const u = await urlImagen(e.img); return `<div class="mn-extra">${miniHtml(u, dimE, ANCHO_MINI.extra, `data-mini-extra="${i}"`, `Foto ${i + 1}`)}<div class="mn-extra-datos"><input data-extra="${i}" value="${esc(e.leyenda || '')}" placeholder="Leyenda" aria-label="Leyenda de la foto ${i + 1}"><div class="sis-acciones">${u ? `<button class="sis-btn chico" data-mn="ajustar" data-i="${i}">✂ Ajustar encuadre</button>` : ''}<button class="sis-btn chico" data-mn="quitar-extra" data-i="${i}">Quitar</button></div></div></div>`; }));
    const fichas = st.lista.slice().sort((a, b) => ordenNatural(a.ficha, b.ficha));
    const tarjeta = (titulo, cuerpo, extra = '') => `<section class="sis-tarjeta"><div class="sis-cab"><h2>${titulo}</h2>${extra}</div>${cuerpo}</section>`;
    const checkComun = (k, t) => `<label class="sis-check mn-comun"><input type="checkbox" data-comun="${k}" ${comun[k] ? 'checked' : ''}> ${t}</label>`;
    return `<a class="sis-volver" href="#/monografias/${esc(st.proyectoId)}">← ${esc(st.proyecto ? st.proyecto.nombre : 'Proyecto')}</a>
      <nav class="mn-fichas" aria-label="Fichas del proyecto">${fichas.map((y, i) => `<a href="#/monografias/${esc(st.proyectoId)}/${esc(y.id)}" class="${y.id === x.id ? 'activa' : ''}"${y.id === x.id ? ' aria-current="page"' : ''}>Ficha ${i + 1}<small>${esc(y.ficha.puntoMedido || 'sin punto')}</small></a>`).join('')}<button type="button" class="mn-ficha-mas" data-mn="nueva" aria-label="Agregar ficha">+</button></nav>
      <div class="mn-cab mn-cab-ficha"><div><h1>Monografía · ${esc(f.puntoMedido || '(sin punto)')}</h1>
        <p class="sis-tenue">${x.terreno ? `Enviada desde Terreno${x.terreno.publicadoEn ? ' el ' + esc(fechaHoraLegible(x.terreno.publicadoEn)) : ''}` : 'Creada en gabinete'}${x.gabinete ? ' · revisada en gabinete' : ''} · <span id="mn-guardado">Guardado</span></p></div>
        <div class="sis-acciones"><button class="sis-btn" data-mn="ver-pdf">Vista previa PDF</button><button class="sis-btn primario" data-mn="pdf" data-id="${esc(x.id)}">Descargar PDF</button></div></div>
      ${x.nuevaDeTerreno ? `<div class="sis-tarjeta sis-aviso mn-aviso"><b>Terreno envió una versión más nueva de esta monografía.</b> <span>La que ves es la revisada en gabinete.</span> <button class="sis-btn chico" data-mn="usar-terreno">Usar la de Terreno</button></div>` : ''}
      <section class="sis-tarjeta mn-config-ficha"><div class="mn-config-fila">
        <div><b>El PDF lleva</b><div class="mn-mods-txt"><label class="sis-check"><input type="checkbox" data-mod="descripcion" ${mod.descripcion ? 'checked' : ''}> Descripción</label><label class="sis-check"><input type="checkbox" data-mod="observacion" ${mod.observacion ? 'checked' : ''}> Observación</label></div></div>
        <div class="mn-config-logo"><span class="mn-logo-mini">${logoEmpresa() ? `<img src="${logoEmpresa()}" alt="Logo de la empresa">` : '<span class="sis-tenue">Sin logo</span>'}</span><span><b>Logo de la empresa</b><small class="sis-tenue">Recuadro superior derecho</small><label class="sis-btn chico">${logoEmpresa() ? 'Cambiar' : 'Cargar logo'}<input type="file" accept="image/*" data-mn-archivo="logo" hidden></label></span></div>
      </div></section>
      <div class="mn-dos"><div>
        ${tarjeta('General', `<div class="mn-campos">
            <label class="sis-campo"><span>Cliente</span><select data-cliente>${cls.map(c => `<option value="${esc(c.k)}" ${claveCliente(f.clienteNombre) === c.k ? 'selected' : ''}>${esc(c.nombre)}${c.logo ? ' · con logo' : ''}</option>`).join('')}${!f.clienteNombre ? '<option value="" selected>— Elegir —</option>' : ''}<option value="__nuevo">+ Nuevo cliente…</option></select></label>
            ${campo('tituloDocumento', 'Título del documento')}${campo('nombreProyecto', 'Nombre del proyecto')}</div>
          ${await imagenHtml('clienteLogo', 'Logo del cliente')}
          <p class="sis-tenue">El logo que subas queda guardado para ese cliente y se pone solo en sus próximas fichas.</p>`, '<button class="sis-btn chico" data-mn="traer-proyecto">Traer del proyecto</button>')}
        ${tarjeta('Punto', `<div class="mn-campos">${campo('puntoMedido', 'Nombre del punto (esta ficha)')}${CAMPOS[1][1].slice(1).map(c => campo(...c)).join('')}</div>${checkComun('ubicacion', 'Ubicación, localidad, comuna y región iguales en todas las fichas')}`)}
        ${mod.utm ? tarjeta('Coordenadas UTM (finales del postproceso)', `<div class="mn-campos">
            <label class="sis-campo"><span>País de trabajo</span><select data-pais>${Object.keys(ZONAS_POR_PAIS).map(k => `<option ${k === pais ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
            ${campo('datumUTM', 'Datum', 'text', DATUMS_CHILE)}${campo('zonaUTM', 'Zona', 'text', ZONAS_POR_PAIS[pais] || [])}${campo('norte', 'Norte (m)')}${campo('este', 'Este (m)')}${campo('cotaOrtometrica', 'Cota ortométrica (m)')}</div>`) : ''}
        ${mod.geodesicas ? tarjeta('Coordenadas geodésicas', `<div class="mn-campos">${campo('datumGeodesico', 'Datum geodésico', 'text', DATUMS_CHILE)}${campo('geoide', 'Geoide', 'text', GEOIDES)}${campo('latitud', 'Latitud')}${campo('longitud', 'Longitud')}${campo('alturaElipsoidal', 'Altura elipsoidal (m)')}</div>
            <div class="mn-formato"><span>Mostrar como</span><span class="sis-vistas"><button type="button" class="${(f.formatoGeo || 'dms') === 'dd' ? 'activo' : ''}" data-mn="formato" data-v="dd">DD.dddd°</button><button type="button" class="${(f.formatoGeo || 'dms') === 'dms' ? 'activo' : ''}" data-mn="formato" data-v="dms">D°M'S"</button></span>
              <label>Decimales <input type="number" min="0" max="8" data-decimales value="${esc(f.decimalesGeo ?? 4)}" aria-label="Decimales"></label><button type="button" class="sis-btn chico" data-mn="formato" data-v="${f.formatoGeo || 'dms'}">Aplicar formato</button></div>`) : ''}
        ${mod.croquis || mod.panoramica ? tarjeta('Imágenes', `<div class="mn-imgs-dos">${mod.croquis ? `<div>${await imagenHtml('croquisImg', ranura.croquisImg)}<button class="sis-btn chico primario mn-gen-croquis" data-mn="croquis-mapa">🗺 Generar desde el mapa</button></div>` : ''}${mod.panoramica ? `<div>${await imagenHtml('panoramicaImg', ranura.panoramicaImg)}</div>` : ''}</div>`) : ''}
        ${mod.firma ? tarjeta('Equipo, operador y revisión', `<div class="mn-campos">${CAMPOS[4][1].map(c => campo(...c)).join('')}</div>${checkComun('firma', 'Aplicar a todas las fichas del proyecto')}
            ${comun.firma ? `<label class="sis-check mn-comun"><input type="checkbox" data-propios ${f.firmaPropia ? 'checked' : ''}> Esta ficha tiene su propia fecha de medición y equipo</label>` : ''}`) : ''}
        ${mod.descripcion ? tarjeta('Descripción', `<textarea data-f="descripcion" rows="4">${esc(f.descripcion || '')}</textarea><p class="sis-tenue">Una línea por renglón, como en la plantilla.</p>`) : ''}
        ${mod.observacion ? tarjeta('Observación', `<textarea data-f="observacionPdf" rows="3" placeholder="Ej.: monolito con daño en la placa">${esc(f.observacionPdf || '')}</textarea><p class="sis-tenue">Va en el PDF después de la descripción, como «Observación: …».</p>`) : ''}
      </div><aside>
        <section class="sis-tarjeta"><h2>Chequeo</h2>${chequeoHtml()}</section>
        <section class="sis-tarjeta"><h2>Estado de revisión</h2>
          <p><span class="sis-chip ${D.ESTADOS[x.estado].color}">${esc(D.ESTADOS[x.estado].texto)}</span>${x.observacion ? ` <span class="mn-obs">${esc(x.observacion)}</span>` : ''}</p>
          <label class="sis-campo"><span>Observación para terreno (si hay que corregir algo)</span><textarea id="mn-obs" rows="2" placeholder="Ej.: retomar la foto de la placa">${x.estado === 'con-observacion' ? esc(x.observacion) : ''}</textarea></label>
          <div class="sis-acciones"><button class="sis-btn chico" data-mn="estado" data-e="en-revision">En revisión</button><button class="sis-btn chico" data-mn="estado" data-e="con-observacion">Con observación</button><button class="sis-btn chico primario" data-mn="estado" data-e="lista">Lista</button></div>
          ${hist.length ? `<details class="mn-hist"><summary>Historial (${hist.length})</summary><ul>${hist.slice().reverse().map(r => `<li>${esc(fechaHoraLegible(r.creadoEn))} · ${esc(D.ESTADOS[r.estado].texto)}${r.por ? ' · ' + esc(st.nombres[r.por] || '') : ''}${r.observacion ? ' — ' + esc(r.observacion) : ''}</li>`).join('')}</ul></details>` : ''}
        </section>
        <section class="sis-tarjeta"><h2>Qué incluye el PDF</h2><div class="mn-mods">${MODULOS.map(([k, t]) => `<label class="sis-check"><input type="checkbox" data-mod="${k}" ${mod[k] ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div></section>
        ${presentacionHtml(mod)}
        ${mod.fotos ? `<section class="sis-tarjeta"><h2>Fotografías adicionales</h2>${extras.join('')}<div class="sis-acciones"><button class="sis-btn chico" data-mn="elegir" data-slot="extra">+ Elegir de terreno</button><label class="sis-btn chico">+ Subir<input type="file" accept="image/*" data-mn-archivo="extra" hidden></label></div></section>` : ''}
      </aside></div>
      ${st.elegir ? await selectorFotos() : ''}`;
  }
  async function selectorFotos() {
    const fotos = await Promise.all(st.fotos.map(async a => ({ a, url: await urlArchivo(a.id) })));
    return `<div class="mn-modal" role="dialog" aria-modal="true" aria-label="Elegir foto de terreno"><div class="mn-modal-caja">
      <div class="sis-cab"><h2>Fotos de terreno del proyecto · ${esc(st.elegir === 'extra' ? 'Fotografía adicional' : ranura[st.elegir])}</h2><button class="sis-btn chico" data-mn="cerrar-elegir">Cerrar</button></div>
      ${fotos.length ? `<div class="mn-grilla">${fotos.map(({ a, url }) => { const d = a.detalle || {}; return `<button type="button" class="mn-foto" data-mn="usar-foto" data-id="${esc(a.id)}">${url ? `<img src="${esc(url)}" alt="">` : '<span class="sis-tenue">En la nube</span>'}<span><b>${esc(TIPO_FOTO[d.tipo] || 'Foto')}${d.punto ? ' · ' + esc(d.punto) : ''}</b><small>${esc(d.hora ? fechaHoraLegible(d.hora) : '')}${d.autor ? ' · ' + esc(d.autor) : ''}</small>${d.leyenda ? `<small>${esc(d.leyenda)}</small>` : ''}</span></button>`; }).join('')}</div>`
        : '<div class="sis-vacio"><p>Aún no llegan fotos de este proyecto desde Terreno.</p></div>'}
    </div></div>`;
  }

  // ─────────── Render ───────────
  async function render() {
    if (!st.vivo) return;
    try {
      if (!Object.keys(st.nombres).length) for (const p of await listarPersonas()) st.nombres[p.id] = p.nombre;
      const html = st.monoId ? await vistaFicha() : st.proyectoId ? await vistaProyecto() : await vistaProyectos();
      cont.innerHTML = `${st.mensaje ? `<div class="vu-msg ${st.mensaje.tipo === 'error' ? 'error' : ''}" role="status">${esc(st.mensaje.texto)}</div>` : ''}${html}`;
      st.mensaje = null;
      if (st.monoId) colocarMinis();
    } catch (e) { console.error(e); cont.innerHTML = `<section class="sis-tarjeta sis-error"><p>${esc(e.message || 'Error')}</p></section>`; }
  }

  // ─────────── Guardado de la ficha ───────────
  function marcarGuardado(t) { const el = cont.querySelector('#mn-guardado'); if (el) el.textContent = t; }
  async function guardarAhora() {
    clearTimeout(st.guardando); st.guardando = null;
    const x = st.x;
    await D.guardarGabinete({ ...st.ficha, proyectoId: st.proyectoId, basadoEn: x.gabinete ? x.gabinete.basadoEn : (x.terreno ? x.terreno.actualizadoEn : null) });
    if (x.estado === 'enviada') { await D.agregarRevision({ monografiaId: x.id, proyectoId: st.proyectoId, estado: 'en-revision' }); x.estado = 'en-revision'; }
    x.gabinete = x.gabinete || { basadoEn: x.terreno ? x.terreno.actualizadoEn : null };
    marcarGuardado('Guardado');
  }
  /** v0.11: copia los grupos marcados «para todas las fichas» a las demás monografías del proyecto. */
  async function propagar(campos) {
    const comun = leerComun(st.proyectoId), f = st.ficha;
    const grupos = [...(comun.ubicacion ? GRUPO_UBICACION : []), ...(comun.firma ? GRUPO_FIRMA : [])].filter(k => campos.includes(k));
    if (!grupos.length) return 0;
    let n = 0;
    for (const y of await D.monografiasDeProyecto(st.proyectoId)) {
      if (y.id === f.id) continue;
      const otra = JSON.parse(JSON.stringify(y.ficha));
      let cambia = false;
      for (const k of grupos) {
        if (otra.firmaPropia && PROPIOS_FICHA.includes(k)) continue;
        if (f.firmaPropia && PROPIOS_FICHA.includes(k)) continue;
        if ((otra[k] ?? '') !== (f[k] ?? '')) { otra[k] = f[k]; cambia = true; }
      }
      if (cambia) { await D.guardarGabinete({ ...otra, proyectoId: st.proyectoId, basadoEn: y.gabinete ? y.gabinete.basadoEn : (y.terreno ? y.terreno.actualizadoEn : null) }); n++; }
    }
    return n;
  }
  let camposCambiados = new Set();
  function cambio({ refrescar = false, campo = null } = {}) {
    marcarGuardado('Guardando…');
    if (campo) camposCambiados.add(campo);
    clearTimeout(st.guardando);
    st.guardando = setTimeout(async () => {
      await guardarAhora();
      const lista = [...camposCambiados]; camposCambiados = new Set();
      const n = await propagar(lista);
      if (n) marcarGuardado(`Guardado · aplicado a ${n} ficha${n === 1 ? '' : 's'} más`);
      if (refrescar) await render(); else refrescarChequeo();
    }, 500);
  }
  function refrescarChequeo() { const s = cont.querySelector('.mn-chequeo'); if (s) s.parentElement.innerHTML = '<h2>Chequeo</h2>' + chequeoHtml(); }

  async function descargarPdf(lista, nombre) {
    avisar('Generando PDF…'); await render();
    const blob = await pdfDe(lista);
    if (blob) { descargar(nombre, blob, 'application/pdf'); avisar(`PDF listo: ${lista.length} monografía${lista.length === 1 ? '' : 's'}.`); }
  }
  const nombreArchivo = s => String(s || 'punto').replace(/[^a-z0-9_-]+/gi, '_');

  // ─────────── Eventos ───────────
  cont.addEventListener('input', ev => {
    const t = ev.target;
    if (!st.ficha) return;
    if (t.dataset.f) { st.ficha[t.dataset.f] = t.value; cambio({ campo: t.dataset.f }); }
    else if (t.dataset.pres && t.type === 'range') { const x = cont.querySelector(`[data-pres-txt="${t.dataset.pres}"]`); if (x) x.textContent = t.value; }
    else if (t.dataset.extra != null) { st.ficha.fotosExtra[Number(t.dataset.extra)].leyenda = t.value; cambio(); }
  });
  cont.addEventListener('change', async ev => {
    const t = ev.target;
    try {
      if (t.dataset.mod && st.ficha) { st.ficha.modulos[t.dataset.mod] = t.checked; cambio({ refrescar: true }); return; }
      if (t.dataset.comun && st.ficha) {
        const c = leerComun(st.proyectoId); c[t.dataset.comun] = t.checked; guardarComun(st.proyectoId, c);
        if (t.checked) { const n = await propagar(t.dataset.comun === 'ubicacion' ? GRUPO_UBICACION : GRUPO_FIRMA); avisar(n ? `Aplicado a ${n} ficha${n === 1 ? '' : 's'} más del proyecto.` : 'Las demás fichas ya tienen esos datos.'); }
        await render(); return;
      }
      if (t.hasAttribute('data-propios') && st.ficha) { st.ficha.firmaPropia = t.checked; cambio(); return; }
      if (t.hasAttribute('data-pais') && st.ficha) { st.ficha.paisUTM = t.value; cambio({ refrescar: true }); return; }
      if (t.hasAttribute('data-decimales') && st.ficha) { st.ficha.decimalesGeo = Math.max(0, Math.min(8, Number(t.value) || 0)); cambio(); return; }
      if (t.hasAttribute('data-cliente') && st.ficha) {
        let k = t.value, nombre;
        if (k === '__nuevo') {
          nombre = (prompt('Nombre del cliente:') || '').trim();
          if (!nombre) { await render(); return; }
          try { const l = JSON.parse(localStorage.getItem('mono_clientes') || '[]'); if (!l.includes(nombre)) l.push(nombre); localStorage.setItem('mono_clientes', JSON.stringify(l)); } catch { /* */ }
          k = claveCliente(nombre);
        } else nombre = ((await clientes()).find(c => c.k === k) || {}).nombre || '';
        st.ficha.clienteNombre = nombre;
        const logo = (await archivosDe('cliente_logo', k))[0];
        if (logo) { st.ficha.clienteLogo = { archivo: logo.id }; if (st.ficha.ajustes) delete st.ficha.ajustes.clienteLogo; }
        await guardarAhora(); await render(); return;
      }
      if (t.dataset.pres && st.ficha) { st.ficha[t.dataset.pres] = t.type === 'range' ? Number(t.value) : t.value; cambio({ refrescar: true }); return; }
      if (t.dataset.mnArchivo && t.files && t.files[0]) {
        const archivo = t.files[0], slot = t.dataset.mnArchivo; t.value = '';
        if (slot === 'logo') { const r = new FileReader(); r.onload = async () => { fijarLogoEmpresa(r.result); avisar('Logo guardado'); await render(); }; r.readAsDataURL(archivo); return; }
        const deCliente = slot === 'clienteLogo' && st.ficha.clienteNombre;
        const reg = await guardarArchivo(archivo, { modulo: 'terreno', duenoTipo: deCliente ? 'cliente_logo' : 'terreno_monografia', duenoId: deCliente ? claveCliente(st.ficha.clienteNombre) : st.ficha.id, rol: 'foto', proyectoId: st.proyectoId, carpeta: `Proyectos/${st.proyecto ? st.proyecto.nombre : st.proyectoId}/Monografías`, detalle: { tipo: slot === 'croquisImg' ? 'croquis' : slot === 'panoramicaImg' ? 'panoramica' : slot === 'clienteLogo' ? 'logo' : 'detalle', punto: st.ficha.puntoMedido || '', origen: 'gabinete' } });
        ponerImagen(slot, { archivo: reg.id });
        await guardarAhora(); await render();
      }
    } catch (e) { console.error(e); avisar(e.message || 'No se pudo', 'error'); await render(); }
  });
  function ponerImagen(slot, valor) {
    if (slot === 'extra') { st.ficha.fotosExtra = st.ficha.fotosExtra || []; st.ficha.fotosExtra.push({ id: uuid(), img: valor, leyenda: '', aj: { modo: 'llenar', zoom: 1, ox: 0, oy: 0, giro: 0 } }); }
    else { st.ficha[slot] = valor; if (st.ficha.ajustes) delete st.ficha.ajustes[slot]; } // imagen nueva: encuadre desde cero, como en Terreno
  }
  cont.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-mn]');
    if (!b) return;
    const a = b.dataset.mn;
    try {
      if (a === 'filtro') { st.filtro = b.dataset.e; }
      else if (a === 'nueva') {
        const d = valoresPorDefecto(), p = st.proyecto || await obtenerProyecto(st.proyectoId);
        const m = { ...d, id: uuid(), proyectoId: st.proyectoId, nombreProyecto: d.nombreProyecto || (p ? p.nombre : ''), clienteNombre: d.clienteNombre || (p ? p.mandante || '' : ''), puntoMedido: '', ubicacion: '', localidad: '', comuna: p ? p.comuna || '' : '', region: p ? p.region || '' : '', norte: '', este: '', cotaOrtometrica: '', latitud: '', longitud: '', alturaElipsoidal: '', croquisImg: null, panoramicaImg: null, descripcion: '', operadorNombre: '', operadorCargo: 'Geomensor', fechaMedicion: '', revisoNombre: '', fechaRevision: '', fotosExtra: [], creado: new Date().toISOString() };
        await D.guardarGabinete(m);
        st.ficha = null; ir(st.proyectoId, m.id); return;
      }
      else if (a === 'crear-n') {
        const n = Math.max(1, Math.min(60, Number((cont.querySelector('#mn-n-fichas') || {}).value) || 1));
        const p = st.proyecto || await obtenerProyecto(st.proyectoId), d = valoresPorDefecto();
        const ya = (await D.monografiasDeProyecto(st.proyectoId)).length;
        let primera = null;
        for (let i = 0; i < n; i++) {
          const m = { ...d, id: uuid(), proyectoId: st.proyectoId, nombreProyecto: d.nombreProyecto || (p ? p.nombre : ''), clienteNombre: d.clienteNombre || (p ? p.mandante || '' : ''), puntoMedido: `PR-${ya + i + 1}`, ubicacion: '', localidad: '', comuna: p ? p.comuna || '' : '', region: p ? p.region || '' : '', norte: '', este: '', cotaOrtometrica: '', latitud: '', longitud: '', alturaElipsoidal: '', croquisImg: null, panoramicaImg: null, descripcion: '', operadorNombre: '', operadorCargo: 'Geomensor', fechaMedicion: '', revisoNombre: '', fechaRevision: '', fotosExtra: [], creado: new Date().toISOString() };
          await D.guardarGabinete(m);
          primera = primera || m.id;
        }
        st.ficha = null; ir(st.proyectoId, primera); return;
      }
      else if (a === 'traer-proyecto') {
        const p = st.proyecto || await obtenerProyecto(st.proyectoId);
        if (p) { Object.assign(st.ficha, { nombreProyecto: p.nombre, clienteNombre: st.ficha.clienteNombre || p.mandante || '', comuna: p.comuna || st.ficha.comuna, region: p.region || st.ficha.region }); await guardarAhora(); avisar('Datos tomados del proyecto.'); }
      }
      else if (a === 'formato') {
        const f = st.ficha, dec = f.decimalesGeo ?? 4;
        f.formatoGeo = b.dataset.v;
        const la = leerGrados(f.latitud), lo = leerGrados(f.longitud);
        if (la != null) f.latitud = escribirGrados(la, 'lat', f.formatoGeo, dec);
        if (lo != null) f.longitud = escribirGrados(lo, 'lon', f.formatoGeo, dec);
        await guardarAhora();
        avisar(la != null || lo != null ? 'Coordenadas geodésicas con el formato elegido.' : 'Escribe la latitud y la longitud para darles formato.');
      }
      else if (a === 'croquis-mapa') {
        const f = st.ficha, d = dimsMonografia(f).croquisImg;
        const url = await abrirCroquis({ lat: leerGrados(f.latitud), lon: leerGrados(f.longitud), nombre: f.puntoMedido || '', aspecto: d[0] / d[1] });
        if (!url) return;
        const reg = await guardarArchivoDatos(url, `croquis_${nombreArchivo(f.puntoMedido)}.jpg`, { modulo: 'terreno', duenoTipo: 'terreno_monografia', duenoId: f.id, rol: 'foto', proyectoId: st.proyectoId, carpeta: `Proyectos/${st.proyecto ? st.proyecto.nombre : st.proyectoId}/Monografías`, detalle: { tipo: 'croquis', punto: f.puntoMedido || '', origen: 'gabinete' } }, { personaId: ctx.personaId });
        ponerImagen('croquisImg', { archivo: reg.id });
        await guardarAhora(); avisar('Croquis generado desde el mapa. Puedes ajustar su encuadre.');
      }
      else if (a === 'pdf') {
        const x = (st.lista || []).find(y => y.id === b.dataset.id) || st.x;
        if (st.ficha && st.ficha.id === b.dataset.id) await guardarAhora();
        const f = st.ficha && st.ficha.id === b.dataset.id ? st.ficha : x.ficha;
        await descargarPdf([f], `monografia_${nombreArchivo(f.puntoMedido)}.pdf`);
      }
      else if (a === 'pdf-todas') {
        const lista = st.lista.filter(x => !st.filtro || x.estado === st.filtro).map(x => x.ficha).sort(ordenNatural);
        await descargarPdf(lista, `monografias_${nombreArchivo(st.proyecto ? st.proyecto.nombre : 'proyecto')}_${new Date().toISOString().slice(0, 10)}.pdf`);
      }
      else if (a === 'ver-pdf') {
        await guardarAhora();
        const w = window.open('', '_blank');
        const blob = await pdfDe([st.ficha]);
        const url = URL.createObjectURL(blob);
        if (w) w.location.href = url; else descargar(`monografia_${nombreArchivo(st.ficha.puntoMedido)}.pdf`, blob, 'application/pdf');
        return;
      }
      else if (a === 'estado') {
        const e = b.dataset.e, obs = (cont.querySelector('#mn-obs') || {}).value || '';
        if (e === 'con-observacion' && !obs.trim()) { avisar('Escribe la observación para terreno.', 'error'); }
        else {
          if (st.guardando) await guardarAhora();
          await D.agregarRevision({ monografiaId: st.x.id, proyectoId: st.proyectoId, estado: e, observacion: e === 'con-observacion' ? obs : '' });
          if (e === 'lista' && !st.ficha.revisoNombre && ctx.personaId && st.nombres[ctx.personaId]) { st.ficha.revisoNombre = st.nombres[ctx.personaId]; st.ficha.fechaRevision = new Date().toISOString().slice(0, 10); await guardarAhora(); }
          avisar(e === 'con-observacion' ? 'Observación enviada: el encargado la verá en la app de Terreno.' : `Estado: ${D.ESTADOS[e].texto}.`);
        }
      }
      else if (a === 'usar-terreno') { await D.usarVersionDeTerreno(st.x.id); st.ficha = null; avisar('Se tomó la versión que envió Terreno.'); }
      else if (a === 'elegir') { st.elegir = b.dataset.slot; }
      else if (a === 'cerrar-elegir') { st.elegir = null; }
      else if (a === 'usar-foto') { ponerImagen(st.elegir, { archivo: b.dataset.id }); st.elegir = null; await guardarAhora(); }
      else if (a === 'ajustar') {
        const f = st.ficha, d = dimsMonografia(f), i = b.dataset.i;
        const extra = i != null ? f.fotosExtra[Number(i)] : null, clave = b.dataset.slot;
        const url = await urlImagen(extra ? extra.img : f[clave]);
        if (!url) return;
        const dim = extra ? d.extra : d[clave];
        const aj = await abrirAjuste({ titulo: extra ? (extra.leyenda || `Fotografía ${Number(i) + 1}`) : ranura[clave], url, bw: dim[0], bh: dim[1], ajuste: extra ? extra.aj : (f.ajustes || {})[clave], porDefecto: extra ? 'llenar' : MODO_DEF[clave] });
        if (!aj) return;
        if (extra) extra.aj = aj; else { f.ajustes = f.ajustes || {}; f.ajustes[clave] = aj; }
        await guardarAhora(); avisar('Encuadre aplicado: así queda en el PDF.');
      }
      else if (a === 'quitar-img') { st.ficha[b.dataset.slot] = null; if (st.ficha.ajustes) delete st.ficha.ajustes[b.dataset.slot]; await guardarAhora(); }
      else if (a === 'quitar-extra') { st.ficha.fotosExtra.splice(Number(b.dataset.i), 1); await guardarAhora(); }
      else if (a === 'quitar-logo') { fijarLogoEmpresa(null); }
      else return;
    } catch (e) { console.error(e); avisar(e.message || 'No se pudo', 'error'); }
    await render();
  });

  render();
  return { desmontar() { st.vivo = false; if (st.guardando) guardarAhora(); }, refrescar: render };
}
