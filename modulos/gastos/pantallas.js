// modulos/gastos/pantallas.js — pantallas del módulo Gastos (teléfono y PC).
// Encargado de terreno: «Mis gastos» por proyecto (el borrador se arma solo), nuevo gasto en 3 toques, mis rendiciones.
// Administración / RRHH: bandeja de rendiciones, revisión con boletas, devolver con motivo, depósitos de fondo y pago.
// Rutas (las arma app/sistema.js): #/gastos · #/gastos/proyecto/<id> · #/gastos/nuevo[/<proyectoId>] · #/gastos/gasto/<id> · #/gastos/rendicion/<id>

import { escapar as esc, fechaLegible, fechaHoraLegible, hoyISO, leerLS, escribirLS } from '../../compartido/util.js';
import { listarProyectos, listarPersonas, OFICINA_ID } from '../../compartido/catalogos.js';
import { urlArchivo, abrirArchivo } from '../../compartido/archivos.js';
import { avisarConDeshacer } from '../../compartido/deshacer.js';
import {
  fijarPersona, cargarTodo, obtenerGasto, guardarGasto, gastoAPapelera, restaurarGasto, enviarRendicion,
  devolverRendicion, pagarRendicion, registrarDeposito, quitarDeposito, restaurarDeposito,
} from './datos.js';
import {
  CATEGORIAS, ESTADOS, clp, leerMonto, suma, posiblesDuplicados, problemasGasto, eventosDe, estadoRendicion,
  gastoEditable, numeroSiguiente, libroCuenta, sugerenciaCierre, ultimo, porCategoria, ordenGastos,
} from './modelo.js';
import { descargarExcel, descargarPdf } from './exportar.js';

const ICO = {
  camara: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  boleta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
  sin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M4 4l16 16"/></svg>',
  excel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M9 11l5 6M14 11l-5 6"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/></svg>',
};
const chip = estado => `<span class="sis-chip ${ESTADOS[estado].color}">${ESTADOS[estado].texto}</span>`;
const vacio = (t, extra = '') => `<div class="sis-vacio"><p>${t}</p>${extra}</div>`;
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

export function montarPantallas(contenedor, ctx) {
  fijarPersona(ctx.personaId || null);
  const raiz = document.createElement('div');
  raiz.className = 'mod-gastos';
  contenedor.appendChild(raiz);
  let activo = true;
  const esRrhh = ctx.rol === 'rrhh';

  const st = {
    vista: ctx.vista || null, id: ctx.id || null,
    d: { gastos: [], rendiciones: [], eventos: [] }, proyectos: [], personas: [],
    archivo: null, previa: null, confirmarDup: false, obs: new Set(), filtro: leerLS('gastos_filtro_rrhh', 'enviada'),
  };
  const nomProy = id => id === OFICINA_ID ? 'Oficina' : ((st.proyectos.find(p => p.id === id) || {}).nombre || 'Proyecto sin nombre');
  const nomPers = id => (st.personas.find(p => p.id === id) || {}).nombre || 'Sin persona';
  const rendicion = id => st.d.rendiciones.find(r => r.id === id) || null;
  const estadoDe = r => estadoRendicion(eventosDe(st.d.eventos, r.id));
  const gastosDe = r => st.d.gastos.filter(g => g.rendicionId === r.id).sort(ordenGastos);
  const libro = (personaId, proyectoId) => libroCuenta({ ...st.d, personaId, proyectoId });
  const filaDe = r => libro(r.personaId, r.proyectoId).filas[r.id];
  const ir = h => { if (location.hash === h) recargar(); else location.hash = h; };

  /** Proyecto de trabajo de terreno: el de la ruta, el último usado o el primero activo (Oficina si no hay). */
  function proyectoActual() {
    const pedido = st.vista === 'proyecto' || st.vista === 'nuevo' ? st.id : null;
    const ok = id => id && st.proyectos.some(p => p.id === id);
    const id = ok(pedido) ? pedido : ok(leerLS('gastos_proyecto', '')) ? leerLS('gastos_proyecto', '') : (st.proyectos.find(p => p.id !== OFICINA_ID && p.estado !== 'cerrado') || {}).id || OFICINA_ID;
    return id;
  }

  // ─────────── Carga y render ───────────
  async function cargar() {
    [st.proyectos, st.personas, st.d] = await Promise.all([listarProyectos(), listarPersonas(), cargarTodo()]);
  }
  async function recargar() { await cargar(); render(); }

  function render() {
    if (!activo) return;
    let html;
    try {
      if (st.vista === 'nuevo' || st.vista === 'gasto') html = vistaGasto();
      else if (st.vista === 'rendicion') html = vistaRendicion();
      else html = esRrhh ? vistaBandeja() : vistaMisGastos();
    } catch (e) { console.error(e); html = `<div class="sis-error">${esc(e.message || e)}</div>`; }
    raiz.innerHTML = `<div class="sis-vista">${html}</div>`;
    pintarBoletas();
  }

  /** Las miniaturas de boletas se cargan después del render (pueden venir de la nube). */
  async function pintarBoletas() {
    for (const img of raiz.querySelectorAll('img[data-boleta]')) {
      const url = await urlArchivo(img.dataset.boleta).catch(() => null);
      if (url && img.isConnected) { img.src = url; img.hidden = false; }
    }
  }

  const kpis = f => `<div class="gs-kpis">
      <div class="gs-kpi"><small>Fondo recibido</small><b>${clp(f.fondo)}</b>${f.anterior ? `<span>incluye ${clp(f.anterior)} de la rendición anterior</span>` : ''}</div>
      <div class="gs-kpi"><small>Gastado${f.n != null ? ` (${f.n})` : ''}</small><b>${clp(f.gastado)}</b></div>
      <div class="gs-kpi ${f.saldo < 0 ? 'persona' : f.saldo > 0 ? 'empresa' : ''}"><small>${f.saldo < 0 ? 'Saldo a favor de la persona' : f.saldo > 0 ? 'Saldo a favor de la empresa' : 'Saldo'}</small><b>${clp(Math.abs(f.saldo))}</b></div>
    </div>`;

  const filaGasto = (g, { enlace = true, obs = null, marcar = false } = {}) => {
    const nota = g.sinBoleta ? `Sin boleta · ${esc(g.motivoSinBoleta || '')}` : '';
    const cuerpo = `<span class="gs-mini">${g.sinBoleta || !g.archivoId ? ICO.sin : `<img data-boleta="${esc(g.archivoId)}" alt="" hidden>${ICO.boleta}`}</span>
      <span class="sis-fila-txt"><b>${esc(g.comercio || g.categoria)}</b><span class="sis-tenue">${esc(g.categoria)} · ${g.fecha === hoyISO() ? 'hoy' : fechaLegible(g.fecha)}${nota ? ` · ${nota}` : ''}${g.nota ? ` · ${esc(g.nota)}` : ''}</span></span>
      ${obs && obs.has(g.id) ? '<span class="sis-chip ambar">Observado</span>' : ''}
      <b class="gs-monto">${clp(g.monto)}</b>`;
    if (marcar) return `<div class="sis-fila gs-gasto"><label class="gs-obs" title="Marcar como observado"><input type="checkbox" data-accion="observar" data-id="${esc(g.id)}" ${st.obs.has(g.id) ? 'checked' : ''}><span>Observado</span></label>
      ${g.archivoId && !g.sinBoleta ? `<button type="button" class="gs-ver" data-accion="ver-boleta" data-id="${esc(g.archivoId)}" aria-label="Ver la boleta de ${esc(g.comercio || g.categoria)}">${cuerpo}</button>` : `<span class="gs-ver">${cuerpo}</span>`}</div>`;
    return enlace ? `<a class="sis-fila gs-gasto${obs && obs.has(g.id) ? ' gs-observado' : ''}" href="#/gastos/gasto/${esc(g.id)}">${cuerpo}</a>`
      : `<div class="sis-fila gs-gasto${obs && obs.has(g.id) ? ' gs-observado' : ''}">${g.archivoId && !g.sinBoleta ? `<button type="button" class="gs-ver" data-accion="ver-boleta" data-id="${esc(g.archivoId)}" aria-label="Ver la boleta">${cuerpo}</button>` : cuerpo}</div>`;
  };

  // ─────────── Terreno: Mis gastos ───────────
  function vistaMisGastos() {
    if (!ctx.personaId) return `<h1>Gastos</h1>${vacio('Elige quién eres arriba (persona) para registrar y rendir tus gastos.')}`;
    const pid = proyectoActual();
    const lb = libro(ctx.personaId, pid);
    const b = lb.borrador;
    const devueltas = Object.values(lb.filas).filter(f => f.estado === 'devuelta');
    const mias = st.d.rendiciones.filter(r => r.personaId === ctx.personaId).sort((a, c) => (c.numero || 0) - (a.numero || 0));
    const nSig = numeroSiguiente(st.d.rendiciones, ctx.personaId);
    const opciones = st.proyectos.filter(p => p.estado !== 'cerrado' || p.id === pid)
      .map(p => `<option value="${esc(p.id)}" ${p.id === pid ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('');
    const gastosB = [...b.gastos].sort(ordenGastos).reverse();
    return `<div class="gs-cab"><h1>Gastos</h1>
        <label class="gs-proy"><span>Proyecto</span><select data-accion="proyecto">${opciones}</select></label></div>
      ${devueltas.map(f => { const ev = ultimo(eventosDe(st.d.eventos, f.rendicion.id), 'devuelta'); return `<a class="gs-devuelta" href="#/gastos/rendicion/${esc(f.rendicion.id)}">
        <b>Rendición N° ${f.rendicion.numero} devuelta</b><span>RRHH: «${esc(ev ? ev.motivo : '')}». Toca para corregir y reenviar.</span></a>`; }).join('')}
      <section class="sis-tarjeta gs-borrador">
        <div class="gs-tit"><h2>${devueltas.length ? 'Gastos nuevos' : `Rendición N° ${nSig} · borrador`}</h2><span class="sis-tenue">${devueltas.length ? `Van en el reenvío de la rendición N° ${devueltas[0].rendicion.numero}` : esc(nomProy(pid))}</span></div>
        ${!devueltas.length && (b.fondo || b.gastado) ? kpis({ ...b, n: b.gastos.length }) : ''}
        ${!devueltas.length && !b.fondo && b.gastado ? '<p class="sis-tenue">Sin fondo depositado: es un reembolso. Si RRHH te deposita, el saldo se descuenta solo.</p>' : ''}
        <a class="sis-btn primario gs-nuevo" href="#/gastos/nuevo/${esc(pid)}">${ICO.camara}Nuevo gasto (foto de la boleta)</a>
        ${gastosB.length ? `<div class="sis-lista gs-lista">${gastosB.map(g => filaGasto(g)).join('')}</div>`
          : vacio(devueltas.length ? 'Sin gastos nuevos. Los gastos de la rendición devuelta se corrigen dentro de ella.' : 'Todavía no hay gastos sin enviar en este proyecto.')}
        ${gastosB.length && !devueltas.length ? `<div class="sis-acciones gs-enviar">
          <button class="sis-btn primario" data-accion="enviar" data-proyecto="${esc(pid)}">Enviar rendición a RRHH · ${clp(b.gastado)}</button></div>` : ''}
      </section>
      <section class="sis-tarjeta">
        <h2>Mis rendiciones</h2>
        ${mias.length ? `<div class="sis-lista">${mias.map(r => filaRendicion(r)).join('')}</div>` : vacio('Cuando envíes tu primera rendición, aparece aquí con su estado.')}
      </section>`;
  }

  function filaRendicion(r, { conPersona = false } = {}) {
    const est = estadoDe(r), gs = gastosDe(r), ev = eventosDe(st.d.eventos, r.id);
    let sub = `${plural(gs.length, 'gasto', 'gastos')} · ${clp(suma(gs))}`;
    if (est === 'enviada') sub += ' · Esperando revisión de RRHH';
    if (est === 'devuelta') { const d = ultimo(ev, 'devuelta'); sub += ` · RRHH: «${esc(d ? d.motivo : '')}»`; }
    if (est === 'pagada') { const p = ultimo(ev, 'pagada'); sub += ` · ${p.monto ? `Pagada el ${fechaLegible(p.fecha)} · ${clp(p.monto)}` : `Cerrada el ${fechaLegible(p.fecha)}`}`; }
    return `<a class="sis-fila" href="#/gastos/rendicion/${esc(r.id)}"><span class="sis-fila-txt"><b>N° ${r.numero} · ${esc(nomProy(r.proyectoId))}${conPersona ? ` · ${esc(nomPers(r.personaId))}` : ''}</b><span class="sis-tenue">${sub}</span></span>${chip(est)}</a>`;
  }

  // ─────────── Nuevo gasto / editar ───────────
  function vistaGasto() {
    const editar = st.vista === 'gasto';
    const g = editar ? st.d.gastos.find(x => x.id === st.id) : null;
    if (editar && !g) return vacio('Este gasto no existe o está en la papelera.', '<a class="sis-btn" href="#/gastos">Volver a Gastos</a>');
    if (!ctx.personaId && !editar) return `<h1>Nuevo gasto</h1>${vacio('Elige quién eres arriba (persona) para registrar gastos.')}`;
    const r = g && g.rendicionId ? rendicion(g.rendicionId) : null;
    const puede = !g || (gastoEditable(g, r ? estadoDe(r) : 'borrador') && (esRrhh || g.personaId === ctx.personaId));
    const pid = g ? g.proyectoId : proyectoActual();
    const volver = r ? `#/gastos/rendicion/${esc(r.id)}` : `#/gastos/proyecto/${esc(pid)}`;
    const v = k => esc(g ? g[k] ?? '' : '');
    const dis = puede ? '' : 'disabled';
    const previa = st.previa ? (st.archivo && st.archivo.type === 'application/pdf' ? `<span class="gs-pdf">${ICO.pdf}${esc(st.archivo.name)}</span>` : `<img src="${st.previa}" alt="Boleta">`)
      : g && g.archivoId ? `<img data-boleta="${esc(g.archivoId)}" alt="Boleta" hidden><span class="gs-foto-txt">${ICO.camara}<b>Cambiar foto</b></span>`
      : `<span class="gs-foto-txt">${ICO.camara}<b>Foto de la boleta</b><small>Toca para tomarla o elegirla de la galería</small></span>`;
    return `<a class="sis-volver" href="${volver}">← Volver</a>
      <h1>${editar ? 'Gasto' : 'Nuevo gasto'}</h1>
      ${!puede ? `<div class="sis-aviso-linea">Este gasto está en la rendición N° ${r.numero} (${ESTADOS[estadoDe(r)].texto.toLowerCase()}): no se puede cambiar.${g.archivoId ? ' <button type="button" class="sis-btn chico" data-accion="ver-boleta" data-id="' + esc(g.archivoId) + '">Ver boleta</button>' : ''}</div>` : ''}
      <form class="sis-form sis-tarjeta gs-form" data-form="gasto" novalidate>
        <label class="gs-foto${g && g.sinBoleta ? ' apagada' : ''}"><input type="file" name="boleta" accept="image/*,application/pdf" ${dis}>${previa}</label>
        <label class="sis-campo"><span>Monto (CLP)</span><input name="monto" class="gs-monto-in" inputmode="numeric" autocomplete="off" placeholder="$ 0" value="${g ? esc(clp(g.monto)) : ''}" ${dis}></label>
        <div class="sis-campo"><span>Categoría</span><div class="gs-cats">${CATEGORIAS.map(c => `<label class="sis-opcion chico"><input type="radio" name="categoria" value="${c}" ${g && g.categoria === c ? 'checked' : ''} ${dis}>${c}</label>`).join('')}</div></div>
        <div class="sis-par">
          <label class="sis-campo"><span>Fecha</span><input type="date" name="fecha" value="${g ? v('fecha') : hoyISO()}" max="${hoyISO()}" ${dis}></label>
          <label class="sis-campo"><span>Proyecto</span><select name="proyectoId" ${dis || (g && g.rendicionId ? 'disabled' : '')}>${st.proyectos.filter(p => p.estado !== 'cerrado' || p.id === pid).map(p => `<option value="${esc(p.id)}" ${p.id === pid ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>
        </div>
        <details class="gs-mas" ${g && (g.comercio || g.nota) ? 'open' : ''}><summary>Comercio y nota (opcional)</summary>
          <label class="sis-campo"><span>Comercio</span><input name="comercio" value="${v('comercio')}" placeholder="Ej.: estación de servicio, hostal" ${dis}></label>
          <label class="sis-campo"><span>Nota</span><input name="nota" value="${v('nota')}" placeholder="Ej.: combustible camioneta para el traslado" ${dis}></label>
        </details>
        <label class="sis-check"><input type="checkbox" name="sinBoleta" ${g && g.sinBoleta ? 'checked' : ''} ${dis}> No tengo boleta</label>
        <label class="sis-campo gs-motivo"><span>Motivo (queda marcado para RRHH)</span><input name="motivoSinBoleta" value="${v('motivoSinBoleta')}" placeholder="Ej.: peaje con TAG, estacionamiento sin comprobante" ${dis}></label>
        <div class="gs-problemas" aria-live="polite"></div>
        ${puede ? `<div class="sis-acciones">
          <button class="sis-btn primario" name="ir" value="volver">Guardar</button>
          ${editar ? '' : '<button class="sis-btn" name="ir" value="otro">Guardar y agregar otro</button>'}
          ${editar ? '<button type="button" class="sis-btn peligro" data-accion="eliminar-gasto">Eliminar</button>' : ''}
        </div>` : ''}
      </form>`;
  }

  async function guardarFormGasto(form, ir_) {
    const fd = new FormData(form);
    const editar = st.vista === 'gasto';
    const previo = editar ? await obtenerGasto(st.id) : null;
    const g = {
      ...(previo || { personaId: ctx.personaId, rendicionId: null }),
      monto: leerMonto(fd.get('monto')), categoria: fd.get('categoria') || '', fecha: fd.get('fecha') || '',
      proyectoId: fd.get('proyectoId') || (previo && previo.proyectoId) || '',
      comercio: String(fd.get('comercio') || '').trim(), nota: String(fd.get('nota') || '').trim(),
      sinBoleta: fd.get('sinBoleta') === 'on', motivoSinBoleta: String(fd.get('motivoSinBoleta') || '').trim(),
      tieneBoletaNueva: !!st.archivo,
    };
    if (!g.sinBoleta) g.motivoSinBoleta = '';
    const caja = form.querySelector('.gs-problemas');
    const probs = problemasGasto(g);
    if (probs.length) { caja.innerHTML = `<div class="sis-aviso-linea">${probs.map(esc).join('<br>')}</div>`; return; }
    const dups = posiblesDuplicados(g, st.d.gastos);
    if (dups.length && !st.confirmarDup) {
      const x = dups[0];
      caja.innerHTML = `<div class="sis-aviso-linea"><b>¿Gasto repetido?</b> Ya tienes un gasto de ${clp(x.monto)} el ${fechaLegible(x.fecha)}${x.comercio ? ` (${esc(x.comercio)})` : ''}. Si es otro gasto, vuelve a tocar Guardar.</div>`;
      st.confirmarDup = true;
      return;
    }
    const carpeta = `Gastos/${nomProy(g.proyectoId)}/${nomPers(g.personaId)}`;
    await guardarGasto(g, { archivo: g.sinBoleta ? null : st.archivo, carpeta });
    escribirLS('gastos_proyecto', g.proyectoId);
    soltarPrevia();
    st.confirmarDup = false;
    avisarConDeshacer(editar ? 'Gasto guardado' : `Gasto de ${clp(g.monto)} guardado`);
    if (ir_ === 'otro') { await cargar(); render(); window.scrollTo(0, 0); raiz.querySelector('input[name=boleta]')?.focus(); return; }
    const r = g.rendicionId ? rendicion(g.rendicionId) : null;
    ir(r ? `#/gastos/rendicion/${r.id}` : `#/gastos/proyecto/${g.proyectoId}`);
  }

  function soltarPrevia() { if (st.previa) URL.revokeObjectURL(st.previa); st.previa = null; st.archivo = null; }

  // ─────────── Rendición (terreno y RRHH) ───────────
  function vistaRendicion() {
    const r = rendicion(st.id);
    if (!r) return vacio('Esta rendición no existe.', '<a class="sis-btn" href="#/gastos">Volver a Gastos</a>');
    if (!esRrhh && r.personaId !== ctx.personaId) return vacio('Esta rendición es de otra persona.', '<a class="sis-btn" href="#/gastos">Volver a Gastos</a>');
    // Al abrir la rendición se da por visto su aviso: RRHH ve los envíos; terreno, las devoluciones y pagos.
    if (ctx.marcarVisto) for (const e of eventosDe(st.d.eventos, r.id)) if (esRrhh ? e.tipo === 'enviada' : e.tipo === 'devuelta' || e.tipo === 'pagada') ctx.marcarVisto(e.id);
    const est = estadoDe(r), ev = eventosDe(st.d.eventos, r.id), gs = gastosDe(r), f = filaDe(r);
    const dev = est === 'devuelta' ? ultimo(ev, 'devuelta') : null;
    const obs = new Set(dev ? dev.observados || [] : []);
    const envio = ev.find(e => e.tipo === 'enviada');
    const nuevos = !esRrhh && est === 'devuelta' ? st.d.gastos.filter(g => !g.rendicionId && g.personaId === r.personaId && g.proyectoId === r.proyectoId) : [];
    const sug = sugerenciaCierre(f.saldo);
    const marcar = esRrhh && est === 'enviada';

    const historial = [...ev, ...f.listaDepositos.filter(d => d.rendicionId !== r.id)].sort((a, b) => (a.creadoEn || '').localeCompare(b.creadoEn || ''));
    const textoEv = e => ({
      enviada: `Enviada · ${clp(e.total)} en ${plural((e.gastoIds || []).length, 'gasto', 'gastos')}`,
      devuelta: `Devuelta por RRHH: «${esc(e.motivo)}»${(e.observados || []).length ? ` · ${plural(e.observados.length, 'gasto observado', 'gastos observados')}` : ''}`,
      pagada: e.monto ? `Pagada: ${clp(e.monto)} el ${fechaLegible(e.fecha)}` : e.reintegro ? `Cerrada: la persona devolvió ${clp(e.reintegro)} el ${fechaLegible(e.fecha)}` : `Cerrada el ${fechaLegible(e.fecha)}${f.arrastra > 0 ? ` · el saldo de ${clp(f.arrastra)} pasa a la siguiente rendición` : ''}`,
      deposito: `Depósito de fondo: ${clp(e.monto)} el ${fechaLegible(e.fecha)}`,
    }[e.tipo] + (e.nota ? ` · ${esc(e.nota)}` : ''));

    return `<div class="sis-miga"><a href="#/gastos">Gastos</a> / Rendición N° ${r.numero}</div>
      <div class="sis-encabezado"><div>
          <h1>Rendición N° ${r.numero} · ${esc(nomProy(r.proyectoId))}</h1>
          <div class="sis-meta"><span>Persona: <b>${esc(nomPers(r.personaId))}</b></span>${envio ? `<span>Enviada: <b>${fechaLegible(envio.fecha)}</b></span>` : ''}<span>${plural(gs.length, 'gasto', 'gastos')}</span></div>
        </div>
        <div class="sis-acciones">${chip(est)}
          <button class="sis-btn chico" data-accion="excel">${ICO.excel}Excel</button>
          <button class="sis-btn chico" data-accion="pdf">${ICO.pdf}PDF con boletas</button></div>
      </div>
      ${dev ? `<div class="gs-devuelta fija"><b>Devuelta por RRHH</b><span>«${esc(dev.motivo)}»${!esRrhh ? ' Corrige los gastos marcados (o agrega el que falta) y reenvía.' : ''}</span></div>` : ''}
      ${kpis({ ...f, n: gs.length })}
      ${est === 'pagada' ? '' : `<p class="sis-tenue gs-sug">${esc(sug.texto)}${sug.tipo === 'pagar' ? (esRrhh ? ' · se paga al cerrar.' : ' · RRHH te lo reembolsa al pagar.') : sug.tipo === 'empresa' ? ' · se devuelve o pasa a la siguiente rendición.' : ''}</p>`}
      <div class="sis-dos gs-dos"><div>
        <section class="sis-tarjeta">
          <div class="sis-cab"><h2>Gastos</h2>${!esRrhh && est === 'devuelta' ? `<a class="sis-btn chico" href="#/gastos/nuevo/${esc(r.proyectoId)}">+ Agregar gasto</a>` : ''}</div>
          ${marcar ? '<p class="sis-tenue">Toca una boleta para verla en grande. Marca «Observado» lo que la persona debe corregir y luego devuelve con el motivo.</p>' : ''}
          <div class="sis-lista gs-lista">${gs.map(g => filaGasto(g, { enlace: !esRrhh && est === 'devuelta', obs, marcar })).join('')}</div>
          ${nuevos.length ? `<h3 class="gs-sub">Gastos nuevos que van en el reenvío</h3><div class="sis-lista gs-lista">${nuevos.map(g => filaGasto(g)).join('')}</div>` : ''}
          ${porCategoria(gs).length > 1 ? `<div class="gs-cats-total">${porCategoria(gs).map(([c, v]) => `<span>${esc(c)} <b>${clp(v)}</b></span>`).join('')}</div>` : ''}
          ${!esRrhh && est === 'devuelta' ? `<div class="sis-acciones gs-enviar"><button class="sis-btn primario" data-accion="reenviar">Reenviar a RRHH · ${clp(suma(gs) + suma(nuevos))}</button></div>` : ''}
        </section>
        <section class="sis-tarjeta"><h2>Historial</h2>
          <ol class="gs-historial">${historial.map(e => `<li class="gs-h-${e.tipo}"><span>${textoEv(e)}</span><small>${fechaHoraLegible(e.creadoEn)}${e.por ? ` · ${esc(nomPers(e.por))}` : ''}</small>
            ${esRrhh && e.tipo === 'deposito' && est !== 'pagada' ? `<button type="button" class="sis-btn chico" data-accion="quitar-deposito" data-id="${esc(e.id)}">Quitar</button>` : ''}</li>`).join('')}</ol>
        </section>
      </div><aside>
        ${esRrhh ? accionesRrhh(r, est, f, sug) : ''}
      </aside></div>`;
  }

  function accionesRrhh(r, est, f, sug) {
    if (est === 'pagada') {
      const p = ultimo(eventosDe(st.d.eventos, r.id), 'pagada');
      return `<section class="sis-tarjeta"><h2>Cerrada</h2><p>${p.monto ? `Se pagaron ${clp(p.monto)} el ${fechaLegible(p.fecha)}.` : p.reintegro ? `La persona devolvió ${clp(p.reintegro)} el ${fechaLegible(p.fecha)}.` : `Cerrada el ${fechaLegible(p.fecha)}.`}</p></section>`;
    }
    const deposito = `<section class="sis-tarjeta"><h2>Registrar depósito de fondo</h2>
        <form class="sis-form" data-form="deposito">
          <div class="sis-par"><label class="sis-campo"><span>Monto (CLP)</span><input name="monto" class="gs-monto-in" inputmode="numeric" placeholder="$ 0"></label>
          <label class="sis-campo"><span>Fecha del depósito</span><input type="date" name="fecha" value="${hoyISO()}"></label></div>
          <label class="sis-campo"><span>Nota (opcional)</span><input name="nota" placeholder="Ej.: transferencia complementaria"></label>
          <div class="sis-acciones"><button class="sis-btn">Registrar depósito</button></div>
        </form></section>`;
    if (est === 'devuelta') return `${deposito}<section class="sis-tarjeta"><h2>Esperando corrección</h2><p class="sis-tenue">La persona corrige y reenvía. Te llega un aviso en la campanita.</p></section>`;
    const cierre = sug.tipo === 'pagar'
      ? `<label class="sis-campo"><span>Monto pagado a la persona (CLP)</span><input name="monto" class="gs-monto-in" inputmode="numeric" value="${esc(clp(sug.monto))}"></label>`
      : sug.tipo === 'empresa'
        ? `<div class="sis-opciones gs-opciones">
            <label class="sis-opcion"><input type="radio" name="cierre" value="reintegro" checked> La persona devuelve ${clp(sug.monto)}</label>
            <label class="sis-opcion"><input type="radio" name="cierre" value="siguiente"> Pasa a la siguiente rendición</label></div>`
        : '<p class="sis-tenue">No hay saldo que pagar: se cierra sin movimiento de dinero.</p>';
    return `<section class="sis-tarjeta gs-cierre"><h2>${sug.tipo === 'pagar' ? `Registrar pago del saldo (${clp(sug.monto)})` : 'Cerrar la rendición'}</h2>
        <p class="sis-tenue">${esc(sug.texto)}</p>
        <form class="sis-form" data-form="pagar" data-tipo="${sug.tipo}">
          ${cierre}
          <label class="sis-campo"><span>Fecha</span><input type="date" name="fecha" value="${hoyISO()}"></label>
          <label class="sis-campo"><span>Nota (opcional)</span><input name="nota" placeholder="Ej.: transferencia N° de operación"></label>
          <div class="sis-acciones"><button class="sis-btn primario">${sug.tipo === 'pagar' ? 'Registrar pago' : 'Cerrar rendición'}</button></div>
        </form></section>
      <section class="sis-tarjeta"><h2>Devolver con motivo</h2>
        <form class="sis-form" data-form="devolver">
          <label class="sis-campo"><span>Motivo</span><textarea name="motivo" rows="3" placeholder="Ej.: falta la boleta del hostal del 28-10"></textarea></label>
          <p class="sis-tenue">${st.obs.size ? plural(st.obs.size, 'gasto marcado como observado', 'gastos marcados como observados') : 'Puedes marcar los gastos observados en la lista.'}</p>
          <div class="sis-acciones"><button class="sis-btn">Devolver a la persona</button></div>
        </form></section>
      ${deposito}`;
  }

  // ─────────── RRHH: bandeja ───────────
  function vistaBandeja() {
    const filtroProy = st.vista === 'proyecto' ? st.id : null;
    const todas = st.d.rendiciones.filter(r => !filtroProy || r.proyectoId === filtroProy).map(r => ({ r, est: estadoDe(r), f: filaDe(r) }));
    const mes = hoyISO().slice(0, 7);
    const pagadasMes = todas.filter(x => x.est === 'pagada' && (ultimo(eventosDe(st.d.eventos, x.r.id), 'pagada') || {}).fecha?.startsWith(mes));
    const porPagar = todas.filter(x => x.est === 'enviada' && x.f.saldo < 0).reduce((t, x) => t + -x.f.saldo, 0);
    const cuenta = { enviada: 0, devuelta: 0, pagada: 0 };
    todas.forEach(x => { cuenta[x.est] = (cuenta[x.est] || 0) + 1; });
    const lista = todas.filter(x => st.filtro === 'todas' || x.est === st.filtro).sort((a, b) => (b.r.creadoEn || '').localeCompare(a.r.creadoEn || ''));
    const tab = (k, t, n) => `<button type="button" role="tab" data-accion="filtro" data-f="${k}" aria-selected="${st.filtro === k}">${t}${n != null ? ` <span class="sis-chip gris">${n}</span>` : ''}</button>`;
    return `<div class="sis-cab"><h1>Rendiciones${filtroProy ? ` · ${esc(nomProy(filtroProy))}` : ''}</h1>${filtroProy ? '<a class="sis-btn chico" href="#/gastos">Ver todas</a>' : ''}</div>
      <div class="sis-kpis gs-kpis-rrhh">
        <div class="sis-kpi ${cuenta.enviada ? 'ambar' : ''}"><span>Por revisar</span><b>${cuenta.enviada}</b></div>
        <div class="sis-kpi"><span>Devueltas</span><b>${cuenta.devuelta}</b></div>
        <div class="sis-kpi"><span>Pagadas este mes</span><b>${pagadasMes.length}</b></div>
        <div class="sis-kpi"><span>Por pagar</span><b>${clp(porPagar)}</b></div>
      </div>
      <div class="gs-pestanas" role="tablist">${tab('enviada', 'Por revisar', cuenta.enviada)}${tab('devuelta', 'Devueltas', cuenta.devuelta)}${tab('pagada', 'Pagadas', cuenta.pagada)}${tab('todas', 'Todas')}</div>
      <section class="sis-tarjeta">${lista.length ? `<div class="gs-tabla-caja"><table class="gs-tabla">
          <thead><tr><th>N°</th><th>Persona</th><th>Proyecto</th><th>Gastos</th><th class="num">Total</th><th class="num">Saldo</th><th>Estado</th><th>Enviada</th></tr></thead>
          <tbody>${lista.map(({ r, est, f }) => `<tr data-ir="#/gastos/rendicion/${esc(r.id)}"><td><a href="#/gastos/rendicion/${esc(r.id)}">N° ${r.numero}</a></td><td>${esc(nomPers(r.personaId))}</td><td>${esc(nomProy(r.proyectoId))}</td>
            <td>${gastosDe(r).length}</td><td class="num">${clp(f.gastado)}</td><td class="num ${f.saldo < 0 ? 'gs-c-persona' : f.saldo > 0 ? 'gs-c-empresa' : ''}">${f.saldo ? `${clp(Math.abs(f.saldo))} <small>${f.saldo < 0 ? 'a la persona' : 'a la empresa'}</small>` : '—'}</td>
            <td>${chip(est)}</td><td>${f.envio ? fechaLegible(f.envio) : '—'}</td></tr>`).join('')}</tbody></table></div>`
        : vacio(st.filtro === 'enviada' ? 'No hay rendiciones por revisar.' : 'No hay rendiciones en esta lista.')}</section>
      ${vistaFondos(filtroProy)}`;
  }

  /** Fondos por rendir: registrar depósitos (antes de gastar) y ver el saldo de cada cuenta persona × proyecto. */
  function vistaFondos(filtroProy) {
    const claves = new Set();
    for (const x of [...st.d.gastos, ...st.d.rendiciones, ...st.d.eventos.filter(e => e.tipo === 'deposito')]) {
      if (x.personaId && x.proyectoId && (!filtroProy || x.proyectoId === filtroProy)) claves.add(`${x.personaId}|${x.proyectoId}`);
    }
    const cuentas = [...claves].map(k => { const [pe, pr] = k.split('|'); const lb = libro(pe, pr); return { pe, pr, lb }; })
      .sort((a, b) => nomPers(a.pe).localeCompare(nomPers(b.pe), 'es') || nomProy(a.pr).localeCompare(nomProy(b.pr), 'es'));
    const deps = st.d.eventos.filter(e => e.tipo === 'deposito' && (!filtroProy || e.proyectoId === filtroProy)).sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || '')).slice(0, 8);
    return `<section class="sis-tarjeta"><h2>Fondos por rendir</h2>
        <p class="sis-tenue">Registra el dinero depositado antes (o después) de gastar. Cada rendición descuenta su fondo y muestra el saldo.</p>
        <form class="sis-form gs-form-deposito" data-form="deposito-cuenta">
          <div class="gs-dep-campos">
            <label class="sis-campo"><span>Persona</span><select name="personaId"><option value="">Elegir…</option>${st.personas.map(p => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('')}</select></label>
            <label class="sis-campo"><span>Proyecto</span><select name="proyectoId">${st.proyectos.filter(p => p.estado !== 'cerrado').map(p => `<option value="${esc(p.id)}" ${p.id === filtroProy ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>
            <label class="sis-campo"><span>Monto (CLP)</span><input name="monto" class="gs-monto-in" inputmode="numeric" placeholder="$ 0"></label>
            <label class="sis-campo"><span>Fecha</span><input type="date" name="fecha" value="${hoyISO()}"></label>
            <label class="sis-campo"><span>Nota (opcional)</span><input name="nota"></label>
          </div>
          <div class="sis-acciones"><button class="sis-btn primario">Registrar depósito</button></div>
        </form>
        ${cuentas.length ? `<h3 class="gs-sub">Saldo por persona y proyecto</h3><div class="gs-tabla-caja"><table class="gs-tabla">
          <thead><tr><th>Persona</th><th>Proyecto</th><th class="num">Depositado</th><th class="num">Gastado</th><th class="num">Sin enviar</th><th class="num">Fondo en mano</th></tr></thead>
          <tbody>${cuentas.map(({ pe, pr, lb }) => `<tr><td>${esc(nomPers(pe))}</td><td>${esc(nomProy(pr))}</td><td class="num">${clp(lb.totalDepositos)}</td><td class="num">${clp(lb.totalGastado)}</td>
            <td class="num">${lb.borrador.gastos.length ? clp(lb.borrador.gastado) : '—'}</td><td class="num">${lb.borrador.saldo > 0 ? clp(lb.borrador.saldo) : '—'}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${deps.length ? `<h3 class="gs-sub">Últimos depósitos</h3><div class="sis-lista">${deps.map(d => `<div class="sis-fila"><span class="sis-fila-txt"><b>${clp(d.monto)} · ${esc(nomPers(d.personaId))}</b><span class="sis-tenue">${esc(nomProy(d.proyectoId))} · ${fechaLegible(d.fecha)}${d.rendicionId && rendicion(d.rendicionId) ? ` · rendición N° ${rendicion(d.rendicionId).numero}` : ''}${d.nota ? ` · ${esc(d.nota)}` : ''}</span></span>
          <button type="button" class="sis-btn chico" data-accion="quitar-deposito" data-id="${esc(d.id)}">Quitar</button></div>`).join('')}</div>` : ''}
      </section>`;
  }

  // ─────────── Datos para Excel y PDF ───────────
  function datosSalida(r) {
    const ev = eventosDe(st.d.eventos, r.id), dev = ultimo(ev, 'devuelta');
    return { numero: r.numero, persona: nomPers(r.personaId), proyecto: nomProy(r.proyectoId), estado: estadoDe(r), envio: filaDe(r).envio,
      gastos: gastosDe(r), fila: filaDe(r), observados: estadoDe(r) === 'devuelta' && dev ? dev.observados || [] : [] };
  }

  // ─────────── Eventos ───────────
  raiz.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-accion]');
    if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') {
      const tr = ev.target.closest('tr[data-ir]');
      if (tr && !ev.target.closest('a')) location.hash = tr.dataset.ir;
      return;
    }
    const a = b.dataset.accion;
    try {
      if (a === 'ver-boleta') { ev.preventDefault(); await abrirArchivo(b.dataset.id); }
      else if (a === 'filtro') { st.filtro = b.dataset.f; escribirLS('gastos_filtro_rrhh', st.filtro); render(); }
      else if (a === 'enviar') {
        const pid = b.dataset.proyecto;
        const lb = libro(ctx.personaId, pid);
        if (!confirm(`¿Enviar a RRHH la rendición de ${nomProy(pid)} con ${plural(lb.borrador.gastos.length, 'gasto', 'gastos')} por ${clp(lb.borrador.gastado)}?\nDespués de enviarla no se pueden cambiar los gastos (salvo que RRHH la devuelva).`)) return;
        b.disabled = true;
        const r = await enviarRendicion({ personaId: ctx.personaId, proyectoId: pid });
        avisarConDeshacer(`Rendición N° ${r.numero} enviada a RRHH`);
        ir(`#/gastos/rendicion/${r.id}`);
      } else if (a === 'reenviar') {
        const r = rendicion(st.id);
        b.disabled = true;
        await enviarRendicion({ personaId: r.personaId, proyectoId: r.proyectoId, rendicionId: r.id });
        avisarConDeshacer(`Rendición N° ${r.numero} reenviada a RRHH`);
        await recargar();
      } else if (a === 'eliminar-gasto') {
        const id = st.id, g = st.d.gastos.find(x => x.id === id);
        await gastoAPapelera(id);
        const destino = g && g.rendicionId ? `#/gastos/rendicion/${g.rendicionId}` : `#/gastos/proyecto/${g ? g.proyectoId : ''}`;
        avisarConDeshacer('Gasto eliminado', async () => { await restaurarGasto(id); await recargar(); });
        ir(destino);
      } else if (a === 'quitar-deposito') {
        const id = b.dataset.id;
        await quitarDeposito(id);
        await recargar();
        avisarConDeshacer('Depósito quitado', async () => { await restaurarDeposito(id); await recargar(); });
      } else if (a === 'excel') { await descargarExcel(datosSalida(rendicion(st.id))); }
      else if (a === 'pdf') {
        const texto = b.innerHTML; b.disabled = true;
        try { await descargarPdf(datosSalida(rendicion(st.id)), { alAvanzar: (i, n) => { b.textContent = `Boletas ${i}/${n}…`; } }); }
        finally { b.innerHTML = texto; b.disabled = false; }
      }
    } catch (e) { console.error(e); avisarConDeshacer(e.message || String(e)); b.disabled = false; }
  });

  raiz.addEventListener('change', async ev => {
    const t = ev.target;
    if (t.matches('select[data-accion=proyecto]')) { escribirLS('gastos_proyecto', t.value); ir(`#/gastos/proyecto/${t.value}`); return; }
    if (t.matches('input[data-accion=observar]')) { t.checked ? st.obs.add(t.dataset.id) : st.obs.delete(t.dataset.id); const p = raiz.querySelector('form[data-form=devolver] .sis-tenue'); if (p) p.textContent = st.obs.size ? plural(st.obs.size, 'gasto marcado como observado', 'gastos marcados como observados') : 'Puedes marcar los gastos observados en la lista.'; return; }
    if (t.matches('input[name=boleta]') && t.files && t.files[0]) {
      soltarPrevia();
      st.archivo = t.files[0];
      st.previa = URL.createObjectURL(st.archivo);
      const lbl = t.closest('.gs-foto');
      lbl.classList.add('con-foto');
      lbl.querySelectorAll('img, .gs-foto-txt, .gs-pdf').forEach(x => x.remove());
      lbl.insertAdjacentHTML('beforeend', st.archivo.type === 'application/pdf' ? `<span class="gs-pdf">${ICO.pdf}${esc(st.archivo.name)}</span>` : `<img src="${st.previa}" alt="Boleta">`);
      const sb = raiz.querySelector('input[name=sinBoleta]'); if (sb) sb.checked = false;
      raiz.querySelector('input[name=monto]')?.focus();
      return;
    }
    if (t.matches('input[name=monto], input[name=fecha], input[name=sinBoleta]')) st.confirmarDup = false;
  });

  // Monto con separador de miles mientras se escribe.
  raiz.addEventListener('input', ev => {
    const t = ev.target;
    if (!t.matches('.gs-monto-in')) return;
    const n = leerMonto(t.value);
    t.value = n == null ? '' : clp(n);
  });

  raiz.addEventListener('submit', async ev => {
    const form = ev.target.closest('form[data-form]');
    if (!form) return;
    ev.preventDefault();
    const fd = new FormData(form);
    const boton = ev.submitter;
    try {
      if (boton) boton.disabled = true;
      const tipo = form.dataset.form;
      if (tipo === 'gasto') await guardarFormGasto(form, boton && boton.value);
      else if (tipo === 'devolver') {
        await devolverRendicion(rendicion(st.id), { motivo: fd.get('motivo'), observados: [...st.obs] });
        st.obs.clear();
        avisarConDeshacer('Rendición devuelta a la persona');
        await recargar();
      } else if (tipo === 'pagar') {
        const r = rendicion(st.id), f = filaDe(r), t = form.dataset.tipo;
        const monto = t === 'pagar' ? leerMonto(fd.get('monto')) || 0 : 0;
        const reintegro = t === 'empresa' && fd.get('cierre') === 'reintegro' ? f.saldo : 0;
        await pagarRendicion(r, { fecha: fd.get('fecha') || hoyISO(), monto, reintegro, nota: String(fd.get('nota') || '').trim(), saldo: f.saldo });
        avisarConDeshacer(monto ? `Pago de ${clp(monto)} registrado` : 'Rendición cerrada');
        await recargar();
      } else if (tipo === 'deposito' || tipo === 'deposito-cuenta') {
        const r = tipo === 'deposito' ? rendicion(st.id) : null;
        const monto = leerMonto(fd.get('monto'));
        await registrarDeposito({ personaId: r ? r.personaId : fd.get('personaId'), proyectoId: r ? r.proyectoId : fd.get('proyectoId'), monto, fecha: fd.get('fecha') || hoyISO(), rendicionId: r ? r.id : null, nota: String(fd.get('nota') || '').trim() });
        avisarConDeshacer(`Depósito de ${clp(monto)} registrado`);
        await recargar();
      }
    } catch (e) { console.error(e); avisarConDeshacer(e.message || String(e)); }
    finally { if (boton && boton.isConnected) boton.disabled = false; }
  });

  recargar();
  return {
    desmontar() { activo = false; soltarPrevia(); raiz.remove(); },
    refrescar() { if (!raiz.querySelector('form[data-form=gasto]')) recargar(); },
  };
}
