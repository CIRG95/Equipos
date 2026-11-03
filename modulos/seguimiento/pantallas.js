// modulos/seguimiento/pantallas.js — pantallas del módulo Seguimiento.
// Lista de proyectos con seguimiento · ficha con pestañas Seguimiento (franjas terreno/gabinete) · Marcar avance · Configurar.
// Usa las clases sis-… del Sistema, las sg-… de seguimiento.css y las piezas comunes tooltip, deshacer y columnas.

import { escapar as esc, fechaLegible, hoyISO } from '../../compartido/util.js';
import { listarProyectos, listarPersonas, obtenerProyecto, OFICINA_ID } from '../../compartido/catalogos.js';
import { ciclosEntre, cicloDelMes, sumarHabiles } from '../../compartido/periodicidad.js';
import { activarTooltips, ocultarTooltip } from '../../compartido/tooltip.js';
import { avisarConDeshacer } from '../../compartido/deshacer.js';
import { columnasArrastrables } from '../../compartido/columnas.js';
import {
  fijarPersona, nuevoId, listarPlanes, planDeProyecto, guardarPlan, eliminarPlan, ciclosDePlan, guardarCiclo,
  eventosDeCiclo, agregarEventos, entregasDeCiclo, guardarEntrega,
} from './datos.js';
import {
  COLS_VUELO, SIGUIENTE, TEXTO_ESTADO, tramosDesdeCarpetas, estadoCiclo, estadoDe, productos, estadoProd, volado, todoListo,
  gabinete, cuenta, prepararCambios, plazoCiclo, mesSiguiente, nombreMes, carpetaMes, revisarArchivos, ejemploSaddn,
} from './modelo.js';

const ICO = {
  ok: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  proc: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="4" cy="8" r="1.4" fill="currentColor"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="12" cy="8" r="1.4" fill="currentColor"/></svg>',
  papel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" fill="#FFF3C4" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M15 3v4h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 12h7M9 15.5h7M9 9h3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  carpeta: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 4.5v8h13v-6.5H7.5L6 4.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
};
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const corta = iso => { if (!iso || iso === 'si') return iso === 'si' ? 'volado' : ''; const d = new Date(iso + 'T12:00:00'); return `${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
const leerLS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const escribirLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const extremos = nombre => { const p = String(nombre).split(' – '); return [p[0], p[p.length - 1]]; };

export function montarPantallas(contenedor, ctx) {
  fijarPersona(ctx.personaId || null);
  const raiz = document.createElement('div');
  raiz.className = 'mod-seguimiento';
  contenedor.appendChild(raiz);
  let activo = true;

  const st = {
    proyectoId: ctx.proyectoId || null, tab: ctx.tab === 'marcar' ? 'marcar' : ctx.tab === 'config' ? 'config' : 'seg',
    plan: null, ciclos: [], ciclo: null, eventos: [], est: {}, entregas: [],
    area: 0, sel: new Set(), abiertos: new Set(), filtro: '', plegar: leerLS('sg_plegar', true),
    revision: null, brillo: new Set(), pop: '', planes: [], resumenes: {},
  };
  const base = { proyectos: [], personas: [] };
  const P = () => st.plan;
  const area = () => st.plan.areas[Math.min(st.area, st.plan.areas.length - 1)];
  const colsVis = () => st.plan.cols.filter(c => c.visible);
  const nomProy = id => !id ? '' : id === OFICINA_ID ? 'Oficina' : ((base.proyectos.find(p => p.id === id) || {}).nombre || 'Proyecto');
  const yo = () => (base.personas.find(p => p.id === ctx.personaId) || {}).nombre || '';
  const est = id => estadoDe(st.est, id);

  // ─────────── Carga ───────────
  async function cargar() {
    [base.proyectos, base.personas] = await Promise.all([listarProyectos(), listarPersonas()]);
    if (!st.proyectoId) {
      st.planes = await listarPlanes();
      st.resumenes = {};
      for (const pl of st.planes) {
        const c = (await ciclosDePlan(pl.id))[0] || null;
        const e = c ? estadoCiclo(await eventosDeCiclo(c.id)) : {};
        st.resumenes[pl.id] = { ciclo: c, cuenta: cuenta(pl, e, pl.areas.flatMap(a => a.tramos)), plazo: plazoCiclo(pl, c, hoyISO()) };
      }
      return;
    }
    st.plan = await planDeProyecto(st.proyectoId);
    if (!st.plan) return;
    st.ciclos = await ciclosDePlan(st.plan.id);
    if (!st.ciclo || !st.ciclos.some(c => c.id === st.ciclo.id)) st.ciclo = st.ciclos[0] || null;
    else st.ciclo = st.ciclos.find(c => c.id === st.ciclo.id);
    await cargarEventos();
  }
  async function cargarEventos() {
    st.eventos = st.ciclo ? await eventosDeCiclo(st.ciclo.id) : [];
    st.entregas = st.ciclo ? await entregasDeCiclo(st.ciclo.id) : [];
    st.est = estadoCiclo(st.eventos);
  }

  // ─────────── Cambios con Deshacer ───────────
  async function aplicar(cambios, texto) {
    const { eventos, inversos } = prepararCambios(st.est, cambios, { cicloId: st.ciclo.id, planId: st.plan.id, por: yo() });
    if (!eventos.length) { if (texto) avisarConDeshacer('No había nada que cambiar'); return; }
    await agregarEventos(eventos);
    await cargarEventos();
    render();
    if (texto) avisarConDeshacer(texto, async () => { await aplicar(inversos, null); avisarConDeshacer('Cambio deshecho'); });
  }

  let timerPlan = null, timerCiclo = null;
  function guardarPlanLuego() { clearTimeout(timerPlan); timerPlan = setTimeout(() => guardarPlan(st.plan), 500); }

  // ─────────── Render ───────────
  async function render() {
    if (!activo) return;
    let html;
    if (!st.proyectoId) html = vistaLista();
    else if (!st.plan) html = vistaNuevo();
    else html = vistaProyecto();
    raiz.innerHTML = `<div class="sis-vista">${html}</div>`;
    aplicarPlantilla();
    st.brillo.clear(); st.pop = '';
  }
  async function recargar() { await cargar(); await render(); }

  // ─────────── Lista de seguimientos ───────────
  function vistaLista() {
    const filas = st.planes.map(pl => {
      const r = st.resumenes[pl.id] || {}, c = r.cuenta || { total: 0, ok: 0 }, pz = r.plazo;
      const pct = c.productos ? Math.round(100 * c.productosListos / c.productos) : 0;
      return `<a class="sg-fila-proy" href="#/seguimiento/${esc(pl.proyectoId)}">
        <span class="sg-fp-nom"><b>${esc(nomProy(pl.proyectoId))}</b><small>${pl.tipo === 'mensual' ? 'Mensual' : 'Trabajo único'}${r.ciclo ? ` · ${esc(r.ciclo.nombre || '')}` : ''}</small></span>
        <span class="sg-fp-barra"><span class="sg-mini"><i style="width:${pct}%"></i></span><small class="mono">${c.productosListos}/${c.productos} productos · ${c.ok}/${c.total} entregados</small></span>
        <span>${pz ? pastillaPlazo(pz, c) : '<span class="sis-tenue">sin plazo</span>'}</span></a>`;
    }).join('');
    const sinPlan = base.proyectos.filter(p => p.id !== OFICINA_ID && !st.planes.some(pl => pl.proyectoId === p.id));
    return `<div class="sis-cab"><h1>Seguimiento de entregas</h1></div>
      <p class="sis-tenue">Qué hay y qué falta en cada trabajo abierto: tramos volados, productos en gabinete y entregas.</p>
      <section class="sis-tarjeta">${filas ? `<div class="sg-lista-proy">${filas}</div>` : '<div class="sis-vacio"><p>Todavía no hay seguimientos. Crea uno para un proyecto.</p></div>'}</section>
      ${sinPlan.length ? `<section class="sis-tarjeta"><h2>Nuevo seguimiento</h2>
        <div class="sg-nuevo-lista">${sinPlan.map(p => `<a class="sis-btn chico" href="#/seguimiento/${esc(p.id)}">${esc(p.nombre)}</a>`).join('')}</div></section>`
        : '<p class="sis-tenue">Para crear un seguimiento, primero crea el proyecto en Proyectos.</p>'}`;
  }

  function pastillaPlazo(pz, c) {
    if (c && c.total && c.ok === c.total) return '<span class="sis-chip verde">Entregado</span>';
    if (pz.quedan < 0) return `<span class="sis-chip rojo">Vencido hace ${-pz.quedan} d. háb.</span>`;
    if (pz.quedan === 0) return '<span class="sis-chip ambar">Vence hoy</span>';
    return `<span class="sis-chip ${pz.quedan <= 2 ? 'ambar' : 'gris'}">Vence ${corta(pz.vence)} · ${pz.quedan} d. háb.</span>`;
  }

  // ─────────── Crear seguimiento ───────────
  function vistaNuevo() {
    return `<div class="sis-miga"><a href="#/seguimiento">Seguimiento</a> / <a href="#/proyecto/${esc(st.proyectoId)}">${esc(nomProy(st.proyectoId))}</a></div>
      <h1>Nuevo seguimiento · ${esc(nomProy(st.proyectoId))}</h1>
      <form class="sis-form sis-tarjeta sg-form-nuevo" data-form="nuevo">
        <div class="sis-campo"><span>Tipo de trabajo</span><div class="sis-opciones">
          <label class="sis-opcion"><input type="radio" name="tipo" value="mensual" checked> Mensual (un ciclo por mes)</label>
          <label class="sis-opcion"><input type="radio" name="tipo" value="unico"> Único</label></div></div>
        <div class="sis-par"><label class="sis-campo"><span>Mes</span><input name="mes" value="${esc(nombreMes(hoyISO()))}"></label>
          <label class="sis-campo"><span>N° de mes del contrato</span><input name="mesContrato" type="number" min="1" value="1"></label></div>
        <div class="sis-campo"><span>Columnas</span><div class="sis-opciones">
          <label class="sis-opcion"><input type="radio" name="cols" value="vuelo" checked> Vuelo: NP, MDS, OF, KMZ</label>
          <label class="sis-opcion"><input type="radio" name="cols" value="simple"> Simple: un producto</label></div></div>
        <label class="sis-campo"><span>Tramos: pega los nombres de las carpetas (uno por línea)</span>
          <textarea name="carpetas" rows="6" placeholder="001_10+200 - 4+900&#10;002_15+200 - 10+200&#10;…"></textarea></label>
        <p class="sis-tenue">En el explorador de Windows: selecciona las carpetas de los tramos, Shift + clic derecho → «Copiar como ruta», y pega aquí. Se leen el número y los DM. Se pueden cambiar después en Configurar.</p>
        <label class="sis-check"><input type="checkbox" name="ejemplo"> Cargar el ejemplo de la línea de impulsión con avance ficticio (para probar)</label>
        <div class="sis-acciones"><button class="sis-btn primario">Crear seguimiento</button></div>
      </form>`;
  }

  async function crear(fd) {
    const ejemplo = fd.get('ejemplo') === 'on';
    const tipo = fd.get('tipo') === 'unico' ? 'unico' : 'mensual';
    let plan;
    if (ejemplo) plan = ejemploSaddn(nuevoId);
    else {
      const cols = fd.get('cols') === 'simple'
        ? [{ id: 'terreno', tipo: 'terreno', nombre: 'Terreno', ancho: 128, visible: true }, { id: 'p1', tipo: 'producto', nombre: 'Producto', ext: '', ancho: 90, visible: true }, { id: 'entrega', tipo: 'entrega', nombre: 'Entrega', ancho: 116, visible: true }]
        : COLS_VUELO();
      const tramos = tramosDesdeCarpetas(fd.get('carpetas') || '', nuevoId);
      plan = { tipo, plazo: { tipo: 'mes', dias: 10 }, cols, areas: [{ id: nuevoId(), nombre: 'Área 1', carpeta: '', tramos: tramos.length ? tramos : [{ id: nuevoId(), n: '001', nombre: 'Tramo 1', carpeta: '' }] }] };
    }
    plan.proyectoId = st.proyectoId;
    const guardado = await guardarPlan(plan);
    const ciclo = await guardarCiclo({ planId: guardado.id, proyectoId: st.proyectoId, nombre: plan.tipo === 'mensual' ? String(fd.get('mes') || '').trim() : 'Trabajo', mesContrato: plan.tipo === 'mensual' ? (Number(fd.get('mesContrato')) || 1) : null, datos: hoyISO() });
    if (ejemplo) await sembrarEjemplo(guardado, ciclo);
    st.ciclo = ciclo;
  }

  async function sembrarEjemplo(plan, ciclo) {
    const L = plan.areas[0].tramos, cambios = [];
    const vol = (t, f) => cambios.push({ tramoId: t.id, tipo: 'terreno', valor: f, por: 'Edgardo' });
    const prods = (t, vals) => ['np', 'mds', 'of', 'kmz'].forEach((c, k) => cambios.push({ tramoId: t.id, tipo: 'prod', col: c, valor: vals[k] }));
    const ent = t => cambios.push({ tramoId: t.id, tipo: 'entrega', valor: 'E1' });
    const fecha = d => { const x = new Date(); x.setDate(x.getDate() - d); return hoyISO(x); };
    L.forEach((t, i) => {
      if (i <= 19 && i !== 8) { vol(t, fecha(i <= 7 ? 14 : i <= 14 ? 13 : 12)); prods(t, ['listo', 'listo', 'listo', 'listo']); ent(t); }
      else if (i === 8) { vol(t, fecha(13)); prods(t, ['listo', 'listo', 'listo', 'proc']); cambios.push({ tramoId: t.id, tipo: 'nota', valor: 'El KMZ se quedó pegado al exportar desde Global Mapper. Reintentar con teselas más chicas.', por: 'Camilo' }); }
      else if (i <= 21) { vol(t, fecha(11)); prods(t, ['listo', 'listo', 'proc', 'falta']); }
      else if (i >= 30) { vol(t, fecha(11)); }
    });
    cambios.push({ tramoId: L[21].id, tipo: 'nota', valor: 'Viento fuerte desde las 14:00, se cortó acá. Quedan 022 a 029 para la próxima salida.', por: 'Edgardo' });
    for (const a of plan.areas.slice(1)) { vol(a.tramos[0], fecha(11)); prods(a.tramos[0], ['listo', 'listo', 'listo', 'listo']); ent(a.tramos[0]); }
    await guardarEntrega({ cicloId: ciclo.id, planId: plan.id, codigo: 'E1', fecha: fecha(4) });
    const { eventos } = prepararCambios({}, cambios, { cicloId: ciclo.id, planId: plan.id });
    await agregarEventos(eventos);
  }

  // ─────────── Ficha del proyecto ───────────
  function vistaProyecto() {
    const pl = P(), c = st.ciclo;
    const pz = plazoCiclo(pl, c, hoyISO());
    const k = cuenta(pl, st.est, pl.areas.flatMap(a => a.tramos));
    const idx = st.ciclos.findIndex(x => c && x.id === c.id);
    return `<div class="sis-encabezado">
        <div>
          <div class="sis-miga"><a href="#/seguimiento">Seguimiento</a> / <a href="#/proyecto/${esc(st.proyectoId)}">${esc(nomProy(st.proyectoId))}</a></div>
          <h1>${esc(nomProy(st.proyectoId))}</h1>
          <div class="sis-meta">
            <span>${pl.tipo === 'mensual' ? 'Servicio mensual' : 'Trabajo único'}</span>
            ${c && c.mesContrato ? `<span>Mes ${c.mesContrato} del contrato · <span class="mono">${esc(carpetaMes(c))}</span></span>` : ''}
            ${c && c.datos ? `<span>Datos recibidos ${esc(fechaLegible(c.datos))}</span>` : ''}
            ${pz ? pastillaPlazo(pz, k) : ''}
          </div>
        </div>
        ${pl.tipo === 'mensual' ? `<div class="sg-ciclos">
          <button class="sis-btn chico" data-acc="ciclo" data-v="${idx + 1}" ${idx >= st.ciclos.length - 1 ? 'disabled' : ''} aria-label="Mes anterior">‹</button>
          <b>${esc(c ? c.nombre || 'Sin nombre' : '—')}</b>
          <button class="sis-btn chico" data-acc="ciclo" data-v="${idx - 1}" ${idx <= 0 ? 'disabled' : ''} aria-label="Mes siguiente">›</button>
          <button class="sis-btn chico" data-acc="nuevo-ciclo">+ Nuevo mes</button></div>` : ''}
      </div>
      <nav class="sg-pestanas" role="tablist">
        <button role="tab" data-acc="tab" data-v="seg" aria-selected="${st.tab === 'seg'}">Seguimiento</button>
        <button role="tab" data-acc="tab" data-v="marcar" aria-selected="${st.tab === 'marcar'}">Marcar avance</button>
        <button role="tab" data-acc="tab" data-v="config" aria-selected="${st.tab === 'config'}">Configurar</button>
      </nav>
      ${!c ? '<div class="sis-vacio"><p>Este seguimiento no tiene meses. Crea el primero.</p><button class="sis-btn primario" data-acc="nuevo-ciclo">+ Nuevo mes</button></div>'
        : st.tab === 'marcar' ? vistaMarcar() : st.tab === 'config' ? vistaConfig() : vistaSeguimiento(k)}`;
  }

  // ─────────── Pestaña Seguimiento ───────────
  function vistaSeguimiento(k) {
    const pl = P();
    const grandes = pl.areas.map((a, i) => [a, i]).filter(([a]) => a.tramos.length > 1);
    const chicas = pl.areas.map((a, i) => [a, i]).filter(([a]) => a.tramos.length === 1);
    return `<div class="sg-kpis">
        <div class="sg-kpi"><small>Terreno</small><b>${k.total - k.sinvolar}<span>/${k.total}</span></b><small>tramos volados</small></div>
        <div class="sg-kpi"><small>Cargado en entregas</small><b class="sg-c-ok">${k.ok}</b><small>${st.entregas.map(e => `${esc(e.codigo)} · ${corta(e.fecha)}`).join(' · ') || 'sin entregas aún'}</small></div>
        <div class="sg-kpi"><small>Procesando</small><b class="sg-c-proc">${k.proc + k.listo}</b><small>${k.listo ? `${k.listo} listos para entregar` : 'en gabinete'}</small></div>
        <div class="sg-kpi"><small>Falta en gabinete</small><b class="sg-c-falta">${k.falta}</b><small>volados, sin empezar</small></div>
        <div class="sg-kpi"><small>Falta volar</small><b class="sg-c-falta">${k.sinvolar}</b><small>pendientes de terreno</small></div>
      </div>
      ${grandes.map(([a, i]) => tarjetaFranja(a, i)).join('')}
      <div class="sg-dos">
        ${chicas.length ? `<section class="sis-tarjeta"><h2>Otras áreas</h2><div class="sg-chicas">${chicas.map(([a, i]) => `<div><span>${esc(a.nombre)}</span>
          <div class="sg-barra chica">${segmento(a.tramos[0], i, 'terreno')}</div><div class="sg-barra chica">${segmento(a.tramos[0], i, 'gab')}</div></div>`).join('')}</div>
          <p class="sis-tenue">Arriba terreno · abajo gabinete</p></section>` : ''}
        <section class="sis-tarjeta"><h2>Qué falta</h2>${queFalta()}</section>
      </div>
      <div class="sg-leyenda">
        <span><i class="s-falta"></i>Falta</span><span><i class="s-proc"></i>Procesando</span>
        <span><i class="s-ok"></i>Terreno: volado · Gabinete: cargado en una entrega</span><span><i class="s-na"></i>Gabinete no aplica (aún no se vuela)</span>
      </div>`;
  }

  function tarjetaFranja(a, i) {
    const T = a.tramos;
    const [ini] = extremos(T[0].nombre), [, fin] = extremos(T[T.length - 1].nombre);
    return `<section class="sis-tarjeta"><div class="sg-cab-franja"><h2>${esc(a.nombre)}</h2><span class="sis-tenue">Pasa el mouse o toca un tramo para ver el detalle</span></div>
      <div class="sg-franja">
        <span>Terreno</span><div class="sg-barra">${T.map(t => segmento(t, i, 'terreno')).join('')}</div>
        <span>Gabinete</span><div class="sg-barra">${T.map(t => segmento(t, i, 'gab')).join('')}</div>
        <span></span><div class="sg-ejes mono"><span>${esc(ini)}</span><span>${esc(fin)}</span></div>
      </div></section>`;
  }

  function segmento(tr, ai, tipo) {
    const t = est(tr.id);
    let cls;
    if (tipo === 'terreno') cls = volado(t) ? 's-ok' : 's-falta';
    else { const g = gabinete(P(), t); cls = g === 'na' ? 's-na' : g === 'ok' ? 's-ok' : g === 'falta' ? 's-falta' : 's-proc'; }
    const largo = tr.ini != null && tr.fin != null ? Math.max(0.3, tr.fin - tr.ini) : 5;
    return `<button type="button" class="sg-seg ${cls}" style="flex-grow:${largo.toFixed(2)}" data-tip="seg" data-a="${ai}" data-t="${esc(tr.id)}" aria-label="${esc(tr.n)} ${esc(tr.nombre)}"></button>`;
  }

  function textoTramo(tr) {
    const t = est(tr.id), g = gabinete(P(), t);
    const gtxt = { na: 'no aplica, falta volar', falta: 'sin empezar', proc: 'procesando', listo: 'listo para entregar', ok: `cargado en ${t.entrega}` }[g];
    const prods = volado(t) ? productos(P()).map(c => { const e = estadoProd(t, c); return `${c.nombre} ${e === 'listo' ? '✓' : e === 'proc' ? 'en curso' : 'falta'}`; }).join(' · ') : '';
    return `<b>${esc(tr.n)} · ${esc(tr.nombre)}</b>\nTerreno: ${volado(t) ? `volado${t.terreno !== 'si' ? ' ' + esc(corta(t.terreno)) : ''}${t.por ? ' · ' + esc(t.por) : ''}` : 'falta volar'}\nGabinete: ${gtxt}${prods ? '\n' + esc(prods) : ''}${t.nota ? `\nNota: ${esc(t.nota)}` : ''}`;
  }

  function queFalta() {
    const pl = P(), out = [];
    const clase = tr => { const t = est(tr.id); if (!volado(t)) return 'volar'; return ({ falta: 'procesar', proc: 'terminar', listo: 'entregar' })[gabinete(pl, t)] || null; };
    pl.areas.forEach(a => {
      const T = a.tramos; let i = 0;
      while (i < T.length) {
        const k = clase(T[i]); if (!k) { i++; continue; }
        let j = i; while (j < T.length && clase(T[j]) === k) j++;
        const rango = j - i > 1 ? `${extremos(T[i].nombre)[0]} → ${extremos(T[j - 1].nombre)[1]} · ${j - i} tramos` : `${T[i].n} · ${T[i].nombre}`;
        const det = k === 'terminar' && j - i === 1 ? productos(pl).filter(c => estadoProd(est(T[i].id), c) !== 'listo').map(c => c.nombre).join(', ') : '';
        out.push(`<div class="sg-falta-${k}"><i></i><div><b>${{ volar: 'Volar', procesar: 'Procesar', terminar: 'Terminar', entregar: 'Cargar en entrega' }[k]} ${esc(rango)}</b><span>${esc(a.nombre)}${det ? ' · falta ' + esc(det) : ''}</span></div></div>`);
        i = j;
      }
    });
    return out.length ? `<div class="sg-falta">${out.join('')}</div>` : '<div class="sg-felicita">No falta nada: todo está cargado en entregas.</div>';
  }

  // ─────────── Pestaña Marcar avance ───────────
  const pasaFiltro = tr => { if (!st.filtro) return true; const t = est(tr.id); return st.filtro === 'sinvolar' ? !volado(t) : gabinete(P(), t) === st.filtro; };
  const grupo = tr => { const t = est(tr.id); return t.entrega ? 'ok' : !volado(t) ? 'sinvolar' : null; };
  const plantilla = () => `36px 54px minmax(170px,1fr) ${colsVis().map(c => c.ancho + 'px').join(' ')} 52px`;
  const anchoMin = () => 36 + 54 + 190 + colsVis().reduce((s, c) => s + c.ancho, 0) + 52 + 16;
  function aplicarPlantilla() {
    const t = raiz.querySelector('.sg-tabla'); if (!t) return;
    t.style.setProperty('--cols', plantilla()); t.style.setProperty('--min', anchoMin() + 'px');
  }

  function vistaMarcar() {
    const pl = P(), a = area(), c = cuenta(pl, st.est, a.tramos);
    const chips = [['sinvolar', 'Falta volar', 's-falta', c.sinvolar], ['falta', 'Falta en gabinete', 's-falta-borde', c.falta], ['proc', 'Procesando', 's-proc', c.proc], ['listo', 'Listo para entregar', 's-listo', c.listo], ['ok', 'Cargado en entrega', 's-ok', c.ok]];
    return `${pl.areas.length > 1 ? `<div class="sg-areas" role="group" aria-label="Áreas">${pl.areas.map((ar, i) => { const x = cuenta(pl, st.est, ar.tramos); return `<button type="button" data-acc="area" data-v="${i}" aria-pressed="${i === st.area}">${esc(ar.nombre)} <small class="mono">${x.ok}/${x.total}</small></button>`; }).join('')}</div>` : ''}
      <div class="sg-resumen">
        ${chips.map(([k, t, cl, n]) => `<button type="button" class="sg-filtro" data-acc="filtro" data-v="${k}" aria-pressed="${st.filtro === k}"><i class="${cl}"></i>${t} <b class="mono">${n}</b></button>`).join('')}
        <label class="sg-interruptor"><input type="checkbox" data-acc="plegar" ${st.plegar ? 'checked' : ''}> Agrupar tramos iguales</label>
      </div>
      ${c.total && c.ok === c.total ? `<div class="sg-felicita">${esc(a.nombre)} está completa: todos los tramos cargados en entregas.</div>` : ''}
      ${st.revision ? panelRevision() : ''}
      <div class="sg-tabla-caja">
        ${st.sel.size ? barraLote() : ''}
        <div class="sg-scroll"><div class="sg-tabla" role="table" aria-label="Avance por tramo">${cabecera()}${filas()}</div></div>
        <div class="sg-pie-tabla">
          <span><i class="sg-mini-cuadro falta"></i>Falta</span><span><i class="sg-mini-cuadro proc"></i>Procesando</span>
          <span><i class="sg-mini-cuadro listo"></i>Listo en la carpeta</span><span><i class="sg-mini-cuadro ent"></i>Cargado en una entrega</span>
          <span class="sg-ayuda">Toca un cuadro para avanzarlo · arrastra los títulos para moverlos · arrastra su borde para el ancho</span>
        </div>
      </div>
      <div class="sis-acciones sg-revisar" data-solo-pc>
        <label class="sis-btn">${ICO.carpeta} Revisar carpeta del mes<input type="file" data-archivo="carpeta" webkitdirectory directory multiple hidden></label>
        <span class="sis-tenue">Eliges la carpeta${st.ciclo && st.ciclo.mesContrato ? ` <span class="mono">${esc(carpetaMes(st.ciclo))}</span>` : ''} y se marca listo lo que ya está (por carpeta del tramo y extensión). Solo se leen los nombres: no se sube nada. Chrome puede decir «subir»: no sale del PC.</span>
      </div>`;
  }

  function panelRevision() {
    const r = st.revision;
    return `<section class="sis-tarjeta sg-revision"><h2>Revisión de la carpeta</h2>
      <p>${r.archivos} archivos leídos · ${r.encontrados} productos encontrados en las carpetas de los tramos.</p>
      ${r.cambios.length ? `<p><b>${r.cambios.filter(c => c.tipo === 'prod').length} producto${r.cambios.filter(c => c.tipo === 'prod').length === 1 ? '' : 's'}</b> pasan a «listo»${r.cambios.some(c => c.tipo === 'terreno') ? ` y <b>${r.cambios.filter(c => c.tipo === 'terreno').length}</b> tramo(s) quedan como volados` : ''}.</p>` : '<p>Todo lo que está en la carpeta ya estaba marcado.</p>'}
      ${r.noEstan.length ? `<p class="sg-c-falta">Marcados listos pero no aparecen: ${r.noEstan.slice(0, 6).map(x => `${esc(x.tramo.n)} ${esc(x.col.nombre)}`).join(', ')}${r.noEstan.length > 6 ? '…' : ''}. Revisa si están en otra carpeta.</p>` : ''}
      ${!r.encontrados ? '<p class="sis-tenue">No calzó ninguna carpeta: revisa en Configurar que cada tramo tenga el nombre de su carpeta y cada producto su extensión.</p>' : ''}
      <div class="sis-acciones">${r.cambios.length ? '<button class="sis-btn primario" data-acc="revision-aplicar">Aplicar</button>' : ''}<button class="sis-btn" data-acc="revision-cerrar">${r.cambios.length ? 'Cancelar' : 'Cerrar'}</button></div></section>`;
  }

  function cabecera() {
    const vis = area().tramos.filter(pasaFiltro);
    const todos = vis.length && vis.every(t => st.sel.has(t.id));
    return `<div class="sg-fila sg-cab" role="row">
      <span class="sg-c" role="columnheader"><input type="checkbox" aria-label="Seleccionar todos" data-acc="sel-todos" ${todos ? 'checked' : ''}></span>
      <span role="columnheader">N°</span><span role="columnheader">Tramo</span>
      ${colsVis().map(c => `<span class="sis-th" role="columnheader" data-col="${esc(c.id)}" title="${esc(c.nombre)}${c.ext ? ` (${esc(c.ext)})` : ''} · arrastra para mover"><span class="sis-th-grip" aria-hidden="true">⋮⋮</span><span class="sg-th-t">${esc(c.nombre)}</span><span class="sis-th-borde" data-borde="${esc(c.id)}" aria-hidden="true"></span></span>`).join('')}
      <span class="sg-c" role="columnheader">Nota</span></div>`;
  }

  function filas() {
    const T = area().tramos, out = [];
    if (st.filtro) { const v = T.filter(pasaFiltro); return v.length ? v.map(fila).join('') : '<div class="sg-fila"><span></span><span></span><span class="sis-tenue">No hay tramos en este estado.</span></div>'; }
    let i = 0;
    while (i < T.length) {
      const g = st.plegar ? grupo(T[i]) : null;
      if (g) {
        let j = i; while (j < T.length && grupo(T[j]) === g) j++;
        if (j - i >= (g === 'ok' ? 2 : 3)) {
          const key = `${st.ciclo.id}:${st.area}:${T[i].id}`, abierto = st.abiertos.has(key);
          const ents = [...new Set(T.slice(i, j).map(t => est(t.id).entrega))].join(', ');
          out.push(`<button type="button" class="sg-plegada ${g}" data-acc="grupo" data-v="${esc(key)}" aria-expanded="${abierto}"><span class="mono">${esc(T[i].n)} – ${esc(T[j - 1].n)}</span><span>${esc(extremos(T[i].nombre)[0])} → ${esc(extremos(T[j - 1].nombre)[1])} · ${j - i} tramos ${g === 'ok' ? `cargados en ${esc(ents)}` : 'falta volar'}</span><span class="sg-ver">${abierto ? '▴ juntar' : '▾ ver'}</span></button>`);
          if (abierto) for (let k = i; k < j; k++) out.push(fila(T[k]));
          i = j; continue;
        }
      }
      out.push(fila(T[i])); i++;
    }
    return out.join('');
  }

  function fila(tr) {
    const t = est(tr.id);
    return `<div class="sg-fila${st.sel.has(tr.id) ? ' sel' : ''}${st.brillo.has(tr.id) ? ' brilla' : ''}" role="row" data-t="${esc(tr.id)}">
      <span class="sg-c" role="cell"><input type="checkbox" aria-label="Seleccionar ${esc(tr.n)}" data-acc="sel" ${st.sel.has(tr.id) ? 'checked' : ''}></span>
      <span class="sg-n mono" role="cell">${esc(tr.n)}</span>
      <span class="sg-nom" role="cell"><b>${esc(tr.nombre)}</b>${tr.carpeta ? `<small class="mono">${esc(tr.carpeta)}</small>` : ''}</span>
      ${colsVis().map(c => `<span class="sg-c" role="cell">${celda(tr, t, c)}</span>`).join('')}
      <span class="sg-c" role="cell">${t.nota
        ? `<button type="button" class="sg-nota con" data-acc="nota" data-tip="nota" aria-label="Nota: ${esc(t.nota)}">${ICO.papel}</button>`
        : '<button type="button" class="sg-nota vacia" data-acc="nota" aria-label="Agregar nota"></button>'}</span></div>`;
  }

  function celda(tr, t, c) {
    if (c.tipo === 'terreno') return volado(t)
      ? `<button type="button" class="sg-terr si" data-acc="terreno" title="${t.por ? `Volado por ${esc(t.por)}. ` : ''}Toca para desmarcar"><i></i>${esc(corta(t.terreno))}</button>`
      : '<button type="button" class="sg-terr no" data-acc="terreno" title="Toca para marcarlo volado hoy"><i></i>falta volar</button>';
    if (c.tipo === 'producto') {
      if (!volado(t)) return '<span class="sg-na" title="Aún no se vuela">—</span>';
      const e = estadoProd(t, c);
      return `<button type="button" class="sg-prod ${e}${st.pop === `${tr.id}:${c.id}` ? ' pop' : ''}" data-acc="prod" data-col="${esc(c.id)}" aria-label="${esc(c.nombre)}: ${TEXTO_ESTADO[e]}" title="${esc(c.nombre)} ${esc(c.ext || '')}: ${TEXTO_ESTADO[e]}">${e === 'listo' ? ICO.ok : e === 'proc' ? ICO.proc : ''}</button>`;
    }
    if (c.tipo === 'entrega') {
      if (t.entrega) { const e = st.entregas.find(x => x.codigo === t.entrega); return `<button type="button" class="sg-chip-ent" data-acc="entrega">${esc(t.entrega)}${e ? ' · ' + esc(corta(e.fecha).split(' ')[1]) : ''}</button>`; }
      return todoListo(P(), t) ? '<button type="button" class="sg-add-ent" data-acc="entrega">+ entrega</button>' : '';
    }
    return '';
  }

  function barraLote() {
    return `<div class="sg-lote"><b>${st.sel.size} seleccionado${st.sel.size > 1 ? 's' : ''}</b><span class="sis-tenue">Marcar como:</span>
      <button type="button" class="sis-btn chico" data-acc="lote" data-v="volado">Volado hoy</button>
      <button type="button" class="sis-btn chico sg-b-proc" data-acc="lote" data-v="proc">Procesando</button>
      <button type="button" class="sis-btn chico sg-b-listo" data-acc="lote" data-v="listo">Listo</button>
      <button type="button" class="sis-btn chico sg-b-ent" data-acc="lote-entrega">Cargar en entrega ▾</button>
      <button type="button" class="sg-quitar" data-acc="sel-limpiar">Quitar selección</button></div>`;
  }

  // ─────────── Pestaña Configurar ───────────
  function vistaConfig() {
    const pl = P(), c = st.ciclo, n = pl.cols.length;
    return `<div class="sg-config">
      <section class="sis-tarjeta"><h2>Este mes</h2>
        ${pl.tipo === 'mensual' ? `<div class="sis-par"><label class="sis-campo"><span>Mes</span><input data-ciclo="nombre" value="${esc(c.nombre || '')}"></label>
          <label class="sis-campo"><span>N° de mes del contrato</span><input type="number" min="1" data-ciclo="mesContrato" value="${esc(c.mesContrato || '')}"></label></div>
          <p class="sis-tenue">Carpeta del mes: <span class="mono" id="sg-carpeta-mes">${esc(carpetaMes(c))}</span></p>` : ''}
        <label class="sis-campo"><span>Llegada de los datos</span><input type="date" data-ciclo="datos" value="${esc(c.datos || '')}"></label>
      </section>
      <section class="sis-tarjeta"><h2>Plazo de entrega</h2>
        <label class="sis-check"><input type="radio" name="plazo" data-plazo="habiles" ${pl.plazo.tipo === 'habiles' ? 'checked' : ''}> <input type="number" min="1" max="60" data-plan="dias" value="${esc(pl.plazo.dias || 10)}" class="sg-num" aria-label="Días hábiles"> días hábiles después de que llegan los datos</label>
        <label class="sis-check"><input type="radio" name="plazo" data-plazo="mes" ${pl.plazo.tipo === 'mes' ? 'checked' : ''}> Dentro de un mes desde que llegan los datos</label>
        <label class="sis-check"><input type="radio" name="plazo" data-plazo="ninguno" ${pl.plazo.tipo === 'ninguno' ? 'checked' : ''}> Sin plazo</label>
        <div class="sis-campo"><span>Tipo de trabajo</span><div class="sis-opciones">
          <label class="sis-opcion"><input type="radio" name="tipo" data-tipo="mensual" ${pl.tipo === 'mensual' ? 'checked' : ''}> Mensual</label>
          <label class="sis-opcion"><input type="radio" name="tipo" data-tipo="unico" ${pl.tipo === 'unico' ? 'checked' : ''}> Único</label></div></div>
      </section>
      <section class="sis-tarjeta"><h2>Columnas</h2>
        <p class="sis-tenue">De arriba hacia abajo = de izquierda a derecha. También se arrastran en la tabla. La nota va siempre al final.</p>
        ${pl.cols.map((col, i) => `<div class="sg-col-fila">
          <button type="button" class="sg-ico" data-acc="col-subir" data-v="${i}" aria-label="Subir ${esc(col.nombre)}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="sg-ico" data-acc="col-bajar" data-v="${i}" aria-label="Bajar ${esc(col.nombre)}" ${i === n - 1 ? 'disabled' : ''}>↓</button>
          <input data-col-nombre="${i}" value="${esc(col.nombre)}" aria-label="Nombre de la columna">
          ${col.tipo === 'producto' ? `<input class="mono" data-col-ext="${i}" value="${esc(col.ext || '')}" placeholder=".ext" aria-label="Extensión del archivo">` : `<span class="sis-tenue">${col.tipo}</span>`}
          <label class="sg-vis"><input type="checkbox" data-col-vis="${i}" ${col.visible ? 'checked' : ''}> ver</label>
          ${col.tipo === 'producto' ? `<button type="button" class="sg-ico" data-acc="col-quitar" data-v="${i}" aria-label="Quitar ${esc(col.nombre)}">✕</button>` : '<span></span>'}
        </div>`).join('')}
        <button type="button" class="sis-btn chico" data-acc="col-agregar">+ Agregar producto</button>
      </section>
      <section class="sis-tarjeta sg-config-ancho"><h2>Áreas y tramos</h2>
        ${pl.areas.map((a, i) => `<details class="sg-area-cfg"${pl.areas.length === 1 ? ' open' : ''}><summary><b>${esc(a.nombre)}</b> · ${a.tramos.length} tramo${a.tramos.length === 1 ? '' : 's'}</summary>
          <div class="sis-par"><label class="sis-campo"><span>Nombre</span><input data-area-nombre="${i}" value="${esc(a.nombre)}"></label>
            <label class="sis-campo"><span>Carpeta del área</span><input class="mono" data-area-carpeta="${i}" value="${esc(a.carpeta || '')}" placeholder="01 Línea de impulsión 4+900 - 160+000"></label></div>
          <label class="sis-campo"><span>Tramos (nombres de carpeta, uno por línea)</span><textarea rows="5" data-area-tramos="${i}" class="mono">${esc(a.tramos.map(t => t.carpeta || t.nombre).join('\n'))}</textarea></label>
          <div class="sis-acciones"><button type="button" class="sis-btn chico" data-acc="tramos-guardar" data-v="${i}">Actualizar tramos</button>
            ${pl.areas.length > 1 ? `<button type="button" class="sis-btn chico peligro" data-acc="area-quitar" data-v="${i}">Quitar área</button>` : ''}</div>
          <p class="sis-tenue">Los tramos con la misma carpeta conservan su avance; los nuevos parten vacíos.</p></details>`).join('')}
        <div class="sis-acciones"><button type="button" class="sis-btn chico" data-acc="area-agregar">+ Agregar área</button>
          <button type="button" class="sis-btn chico peligro" data-acc="plan-eliminar">Eliminar seguimiento</button></div>
      </section></div>`;
  }

  // ─────────── Menús flotantes ───────────
  function cerrarFlotantes() { raiz.querySelectorAll('.sg-flot').forEach(x => x.remove()); }
  function menuEntrega(anchor, ids) {
    cerrarFlotantes();
    const r = anchor.getBoundingClientRect();
    const algunaCargada = ids.some(id => est(id).entrega);
    const sig = `E${st.entregas.length + 1}`;
    const div = document.createElement('div');
    div.className = 'sg-flot';
    div.innerHTML = `<div class="sg-velo" data-acc="cerrar"></div><div class="sg-menu" role="menu" style="left:${Math.max(8, Math.min(r.left, innerWidth - 250))}px;top:${Math.min(r.bottom + 6, innerHeight - 230)}px">
      <div class="sis-tenue">Solo se cargan tramos con todo listo</div>
      ${st.entregas.map(e => `<button type="button" role="menuitem" data-acc="ent-elegir" data-v="${esc(e.codigo)}"><b>${esc(e.codigo)}</b> · ${esc(fechaLegible(e.fecha))}</button>`).join('')}
      <button type="button" role="menuitem" data-acc="ent-elegir" data-v="+">+ Nueva entrega (${sig} · hoy)</button>
      ${algunaCargada ? '<hr><button type="button" role="menuitem" data-acc="ent-elegir" data-v="-">Quitar de la entrega</button>' : ''}</div>`;
    div.dataset.ids = JSON.stringify(ids);
    raiz.appendChild(div);
    div.querySelector('[role=menuitem]').focus();
  }
  function panelNota(tr) {
    cerrarFlotantes(); ocultarTooltip();
    const t = est(tr.id);
    const div = document.createElement('div');
    div.className = 'sg-flot';
    div.innerHTML = `<div class="sg-velo oscuro" data-acc="cerrar"></div><div class="sg-panel" role="dialog" aria-modal="true" aria-labelledby="sg-nota-tit">
      <div class="sis-tenue">${esc(area().nombre)}</div><h2 id="sg-nota-tit">Nota · ${esc(tr.n)} · ${esc(tr.nombre)}</h2>
      ${t.nota && t.notaPor ? `<p class="sis-tenue">Escrita por ${esc(t.notaPor)}</p>` : ''}
      <label class="sis-campo"><span>Qué pasó o qué hay que recordar</span><textarea id="sg-nota-txt" rows="5" placeholder="Ej.: se cortó por viento, falta reprocesar el KMZ…">${esc(t.nota)}</textarea></label>
      <div class="sis-acciones">${t.nota ? '<button type="button" class="sg-borrar" data-acc="nota-borrar">Borrar nota</button>' : ''}<span style="flex:1"></span>
        <button type="button" class="sis-btn" data-acc="cerrar">Cancelar</button><button type="button" class="sis-btn primario" data-acc="nota-guardar">Guardar</button></div></div>`;
    div.dataset.t = tr.id;
    raiz.appendChild(div);
    const ta = div.querySelector('textarea'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  // ─────────── Acciones ───────────
  const tramoDe = id => area().tramos.find(t => t.id === id);
  async function cargarEnEntrega(ids, codigo) {
    if (codigo === '+') { codigo = `E${st.entregas.length + 1}`; await guardarEntrega({ cicloId: st.ciclo.id, planId: st.plan.id, codigo, fecha: hoyISO() }); }
    const listos = codigo === '-' ? ids : ids.filter(id => todoListo(P(), est(id)));
    const no = ids.length - listos.length;
    listos.forEach(id => st.brillo.add(id));
    st.sel.clear();
    await aplicar(listos.map(id => ({ tramoId: id, tipo: 'entrega', valor: codigo === '-' ? '' : codigo })),
      codigo === '-' ? `${listos.length} tramo${listos.length === 1 ? '' : 's'} fuera de la entrega` : `${listos.length} tramo${listos.length === 1 ? '' : 's'} cargado${listos.length === 1 ? '' : 's'} en ${codigo}${no ? ` · ${no} aún no están listos` : ''}`);
  }
  async function lote(v) {
    const ids = [...st.sel], cambios = [];
    let saltados = 0;
    for (const id of ids) {
      const t = est(id);
      if (v === 'volado') { if (!volado(t)) cambios.push({ tramoId: id, tipo: 'terreno', valor: hoyISO(), por: yo() }); continue; }
      if (!volado(t)) { saltados++; continue; }
      productos(P()).forEach(c => cambios.push({ tramoId: id, tipo: 'prod', col: c.id, valor: v }));
      if (v !== 'listo' && t.entrega) cambios.push({ tramoId: id, tipo: 'entrega', valor: '' });
      if (v === 'listo') st.brillo.add(id);
    }
    const n = ids.length - saltados;
    await aplicar(cambios, `${n} tramo${n === 1 ? '' : 's'} ${v === 'volado' ? 'marcados volados' : 'marcados ' + TEXTO_ESTADO[v]}${saltados ? ` · ${saltados} sin volar quedaron igual` : ''}`);
  }
  function moverCol(i, j) { const c = st.plan.cols; if (j < 0 || j >= c.length) return; [c[i], c[j]] = [c[j], c[i]]; }

  raiz.addEventListener('click', async ev => {
    const el = ev.target.closest('[data-acc]'); if (!el || !raiz.contains(el)) return;
    const acc = el.dataset.acc, v = el.dataset.v;
    const filaEl = el.closest('[data-t]');
    const tr = filaEl && !el.classList.contains('sg-seg') ? tramoDe(filaEl.dataset.t) : null;
    try {
      switch (acc) {
        case 'tab': st.tab = v; st.sel.clear(); st.revision = null; render(); break;
        case 'area': st.area = Number(v); st.sel.clear(); st.filtro = ''; render(); break;
        case 'filtro': st.filtro = st.filtro === v ? '' : v; render(); break;
        case 'plegar': st.plegar = el.checked; escribirLS('sg_plegar', st.plegar); render(); break;
        case 'grupo': st.abiertos.has(v) ? st.abiertos.delete(v) : st.abiertos.add(v); render(); break;
        case 'sel': if (tr) { el.checked ? st.sel.add(tr.id) : st.sel.delete(tr.id); render(); } break;
        case 'sel-todos': if (el.checked) area().tramos.filter(pasaFiltro).forEach(t => st.sel.add(t.id)); else st.sel.clear(); render(); break;
        case 'sel-limpiar': st.sel.clear(); render(); break;
        case 'terreno': if (tr) { const t = est(tr.id); await aplicar([{ tramoId: tr.id, tipo: 'terreno', valor: volado(t) ? '' : hoyISO(), por: volado(t) ? '' : yo() }], volado(t) ? `${tr.n} quedó como no volado` : `${tr.n} marcado volado hoy`); } break;
        case 'prod': if (tr) {
          const c = st.plan.cols.find(x => x.id === el.dataset.col), t = est(tr.id), sig = SIGUIENTE[estadoProd(t, c)];
          const cambios = [{ tramoId: tr.id, tipo: 'prod', col: c.id, valor: sig }];
          if (sig !== 'listo' && t.entrega) cambios.push({ tramoId: tr.id, tipo: 'entrega', valor: '' });
          st.pop = `${tr.id}:${c.id}`;
          const queda = { ...t, prod: { ...t.prod, [c.id]: sig } };
          if (todoListo(P(), queda)) st.brillo.add(tr.id);
          await aplicar(cambios, null);
        } break;
        case 'entrega': if (tr) menuEntrega(el, [tr.id]); break;
        case 'lote': await lote(v); break;
        case 'lote-entrega': menuEntrega(el, [...st.sel]); break;
        case 'ent-elegir': { const f = el.closest('.sg-flot'); const ids = JSON.parse(f.dataset.ids || '[]'); cerrarFlotantes(); await cargarEnEntrega(ids, v); break; }
        case 'nota': if (tr) panelNota(tr); break;
        case 'nota-guardar': case 'nota-borrar': {
          const f = el.closest('.sg-flot'), id = f.dataset.t, texto = acc === 'nota-borrar' ? '' : f.querySelector('textarea').value.trim();
          cerrarFlotantes();
          await aplicar([{ tramoId: id, tipo: 'nota', valor: texto, por: yo() }], texto ? 'Nota guardada' : 'Nota borrada');
          break;
        }
        case 'cerrar': cerrarFlotantes(); break;
        case 'revision-aplicar': { const r = st.revision; st.revision = null; await aplicar(r.cambios, `${r.cambios.length} cambio${r.cambios.length === 1 ? '' : 's'} desde la carpeta`); break; }
        case 'revision-cerrar': st.revision = null; render(); break;
        case 'ciclo': { const c = st.ciclos[Number(v)]; if (c) { st.ciclo = c; st.sel.clear(); await cargarEventos(); render(); } break; }
        case 'nuevo-ciclo': {
          const ult = st.ciclos[0];
          let sig = ult ? mesSiguiente(ult.nombre, ult.mesContrato) : { nombre: nombreMes(hoyISO()), mesContrato: 1 };
          // Proyecto recurrente (v0.10): el mes nuevo sale de su periodicidad, con la llegada de datos y la entrega calculadas.
          const proy = await obtenerProyecto(st.proyectoId), per = proy && proy.periodicidad && proy.periodicidad.tipo === 'recurrente' ? proy.periodicidad : null;
          let extra = { datos: '' };
          if (per) {
            const c = ult && ult.mesContrato ? ciclosEntre(per, '1900-01-01', '2100-12-31').find(x => x.n === Number(ult.mesContrato) + 1) : cicloDelMes(per, hoyISO());
            if (c) { sig = { nombre: c.nombre, mesContrato: c.n }; extra = { datos: c.datos, entrega: c.entrega, terreno: c.terreno, diasEntrega: Number(per.diasEntrega) || 0 }; }
          }
          st.ciclo = await guardarCiclo({ planId: st.plan.id, proyectoId: st.proyectoId, nombre: sig.nombre || 'Mes nuevo', mesContrato: st.plan.tipo === 'mensual' ? sig.mesContrato : null, ...extra });
          await recargar(); avisarConDeshacer(`${st.ciclo.nombre} creado con los mismos tramos, sin avance`); break;
        }
        case 'col-subir': case 'col-bajar': { const i = Number(v); moverCol(i, acc === 'col-subir' ? i - 1 : i + 1); await guardarPlan(st.plan); render(); break; }
        case 'col-quitar': { const c = st.plan.cols.splice(Number(v), 1)[0]; await guardarPlan(st.plan); render(); avisarConDeshacer(`Columna ${c.nombre} quitada`, async () => { st.plan.cols.splice(Number(v), 0, c); await guardarPlan(st.plan); render(); }); break; }
        case 'col-agregar': { const k = st.plan.cols.findIndex(c => c.tipo === 'entrega'); st.plan.cols.splice(k < 0 ? st.plan.cols.length : k, 0, { id: 'p' + nuevoId().slice(0, 8), tipo: 'producto', nombre: 'Nuevo', ext: '', ancho: 70, visible: true }); await guardarPlan(st.plan); render(); break; }
        case 'tramos-guardar': {
          const i = Number(v), a = st.plan.areas[i], ta = raiz.querySelector(`[data-area-tramos="${i}"]`);
          const nuevos = tramosDesdeCarpetas(ta.value, nuevoId);
          const previos = new Map(a.tramos.map(t => [t.carpeta || t.nombre, t]));
          a.tramos = nuevos.map(t => { const p = previos.get(t.carpeta); return p ? { ...t, id: p.id } : t; });
          await guardarPlan(st.plan); render(); avisarConDeshacer(`${a.nombre}: ${a.tramos.length} tramos`); break;
        }
        case 'area-agregar': st.plan.areas.push({ id: nuevoId(), nombre: `Área ${st.plan.areas.length + 1}`, carpeta: '', tramos: [{ id: nuevoId(), n: '001', nombre: 'Tramo 1', carpeta: '' }] }); await guardarPlan(st.plan); render(); break;
        case 'area-quitar': { const i = Number(v), a = st.plan.areas.splice(i, 1)[0]; st.area = 0; await guardarPlan(st.plan); render(); avisarConDeshacer(`Área ${a.nombre} quitada`, async () => { st.plan.areas.splice(i, 0, a); await guardarPlan(st.plan); render(); }); break; }
        case 'plan-eliminar': {
          if (el.dataset.confirmar !== 'si') { el.dataset.confirmar = 'si'; el.textContent = 'Toca de nuevo para eliminar (queda en la papelera)'; break; }
          await eliminarPlan(st.plan.id); location.hash = '#/seguimiento'; break;
        }
      }
    } catch (e) { console.error(e); avisarConDeshacer(`No se pudo: ${e.message}`); }
  });

  raiz.addEventListener('change', async ev => {
    const t = ev.target;
    try {
      if (t.dataset.archivo === 'carpeta' && t.files && t.files.length) {
        const rutas = [...t.files].map(f => f.webkitRelativePath || f.name);
        st.revision = { ...revisarArchivos(st.plan, st.est, rutas), archivos: rutas.length };
        t.value = ''; render(); return;
      }
      if (t.dataset.plazo) { st.plan.plazo.tipo = t.dataset.plazo; await guardarPlan(st.plan); return; }
      if (t.dataset.tipo) { st.plan.tipo = t.dataset.tipo; await guardarPlan(st.plan); render(); return; }
      if (t.dataset.colVis != null) { st.plan.cols[Number(t.dataset.colVis)].visible = t.checked; await guardarPlan(st.plan); return; }
      if (t.dataset.ciclo === 'datos') { st.ciclo.datos = t.value; if (st.ciclo.entrega && t.value) st.ciclo.entrega = sumarHabiles(t.value, st.ciclo.diasEntrega || 0); await guardarCiclo(st.ciclo); render(); return; }
    } catch (e) { console.error(e); avisarConDeshacer(`No se pudo: ${e.message}`); }
  });

  raiz.addEventListener('input', ev => {
    const t = ev.target;
    if (t.dataset.ciclo && t.dataset.ciclo !== 'datos') {
      st.ciclo[t.dataset.ciclo] = t.dataset.ciclo === 'mesContrato' ? (Number(t.value) || null) : t.value;
      const m = raiz.querySelector('#sg-carpeta-mes'); if (m) m.textContent = carpetaMes(st.ciclo);
      clearTimeout(timerCiclo); timerCiclo = setTimeout(() => guardarCiclo(st.ciclo), 500); return;
    }
    if (t.dataset.plan === 'dias') { st.plan.plazo.dias = Number(t.value) || 1; guardarPlanLuego(); return; }
    if (t.dataset.colNombre != null) { st.plan.cols[Number(t.dataset.colNombre)].nombre = t.value; guardarPlanLuego(); return; }
    if (t.dataset.colExt != null) { let x = t.value.trim(); if (x && !x.startsWith('.')) x = '.' + x; st.plan.cols[Number(t.dataset.colExt)].ext = x; guardarPlanLuego(); return; }
    if (t.dataset.areaNombre != null) { st.plan.areas[Number(t.dataset.areaNombre)].nombre = t.value; guardarPlanLuego(); return; }
    if (t.dataset.areaCarpeta != null) { st.plan.areas[Number(t.dataset.areaCarpeta)].carpeta = t.value.trim(); guardarPlanLuego(); }
  });

  raiz.addEventListener('submit', async ev => {
    ev.preventDefault();
    const form = ev.target;
    if (form.dataset.form !== 'nuevo') return;
    try { await crear(new FormData(form)); await recargar(); avisarConDeshacer('Seguimiento creado'); }
    catch (e) { console.error(e); avisarConDeshacer(`No se pudo crear: ${e.message}`); }
  });

  const alTecla = ev => { if (ev.key === 'Escape') cerrarFlotantes(); };
  document.addEventListener('keydown', alTecla);

  const quitarTips = activarTooltips(raiz, el => {
    if (el.dataset.tip === 'nota') { const tr = tramoDe(el.closest('[data-t]').dataset.t); const t = tr && est(tr.id); return t ? `<b>Nota · ${esc(tr.n)}</b>\n${esc(t.nota)}${t.notaPor ? `\n<span style="opacity:.75">${esc(t.notaPor)}</span>` : ''}\n<span style="opacity:.75">Toca para editar</span>` : ''; }
    const a = st.plan && st.plan.areas[Number(el.dataset.a)]; const tr = a && a.tramos.find(x => x.id === el.dataset.t);
    return tr ? textoTramo(tr) : '';
  });

  const quitarColumnas = columnasArrastrables(raiz, {
    caja: () => raiz.querySelector('.sg-scroll'),
    ancho: id => st.plan.cols.find(c => c.id === id).ancho,
    alAncho: (id, w) => { st.plan.cols.find(c => c.id === id).ancho = w; aplicarPlantilla(); },
    alSoltarAncho: async (id, w) => { await guardarPlan(st.plan); avisarConDeshacer(`Ancho de ${st.plan.cols.find(c => c.id === id).nombre}: ${w} px`); },
    alMover: async (id, destino) => {
      const vis = colsVis().map(c => c.id), antes = vis.join();
      const resto = vis.filter(x => x !== id); resto.splice(destino, 0, id);
      if (resto.join() === antes) { render(); return; }
      const previo = st.plan.cols.slice();
      st.plan.cols = [...resto.map(x => st.plan.cols.find(c => c.id === x)), ...st.plan.cols.filter(c => !c.visible)];
      await guardarPlan(st.plan); render();
      avisarConDeshacer(`Columna ${st.plan.cols.find(c => c.id === id).nombre} movida`, async () => { st.plan.cols = previo; await guardarPlan(st.plan); render(); });
    },
  });

  recargar().catch(e => { console.error(e); raiz.innerHTML = `<div class="sis-error">No se pudo cargar el seguimiento: ${esc(e.message)}</div>`; });

  return {
    desmontar() { activo = false; if (timerPlan) { clearTimeout(timerPlan); guardarPlan(st.plan); } if (timerCiclo) { clearTimeout(timerCiclo); guardarCiclo(st.ciclo); } quitarTips(); quitarColumnas(); document.removeEventListener('keydown', alTecla); raiz.remove(); },
    refrescar() { recargar(); },
  };
}
