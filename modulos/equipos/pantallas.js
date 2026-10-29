// modulos/equipos/pantallas.js — pantallas del módulo. Se montan dentro del contenedor que entrega
// el envoltorio (app de prueba hoy, app global mañana) y no asumen ser la app completa.
// Rol 'terreno': ver equipos, checklist de salida, regreso, reportar anomalías.
// Rol 'rrhh': todo lo anterior + altas, edición, importar planilla, alertas, calibraciones, catálogos, respaldo.

import { escapar as esc, fechaLegible, fechaHoraLegible, hoyISO } from '../../compartido/util.js';
import {
  listarProyectos, listarPersonas, guardarProyecto, guardarPersona, mapaNombres, catalogosEditables, OFICINA_ID,
} from '../../compartido/catalogos.js';
import { descargarRespaldo, importarRespaldo } from '../../compartido/respaldo.js';
import { enPapelera, restaurar } from '../../compartido/papelera.js';
import {
  COLUMNAS_PLANILLA, CATEGORIAS, ESTADOS_ALERTA, PASOS_ALERTA, LUGARES, TIPOS_EVENTO, ESTADOS_ACCESORIO,
  VERSION_MODULO, nombreCorto, alertaActiva, nuevoEquipo, PERIODO_CALIBRACION_MESES,
} from './modelo.js';
import {
  fijarPersona, listarConEstado, estadoDeEquipo, guardarEquipo, papeleraEquipo, cambiarBaja,
  registrarSalida, registrarRegreso, reportarAnomalia, cambiarEstadoAlerta,
  todasLasAlertas, usosConAlerta, avisosDe,
} from './datos.js';
import { prepararImportacion, aplicarImportacion } from './importar.js';
import { crearFicha } from './ficha.js';
import { descargarPlanilla } from './exportar.js';

// Íconos de trazo, mismo estilo que la barra de Terreno Topografía.
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONOS = {
  lista: svg('<path d="M12 3l3 5H9l3-5z"/><path d="M12 8v5M12 13l-6 8M12 13l6 8M12 13v8"/>'),
  salida: svg('<path d="M14 4h5a1 1 0 011 1v14a1 1 0 01-1 1h-5"/><path d="M10 12h10M16 8l4 4-4 4"/><path d="M4 12h2"/>'),
  regreso: svg('<path d="M10 4H5a1 1 0 00-1 1v14a1 1 0 001 1h5"/><path d="M20 12H8M12 8l-4 4 4 4"/>'),
  alertas: svg('<path d="M12 3l9.5 17h-19L12 3z"/><path d="M12 10v4M12 17.5v.5"/>'),
  admin: svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  vacio: svg('<path d="M12 3l3 5H9l3-5z"/><path d="M12 8v5M12 13l-6 8M12 13l6 8M12 13v8"/>'),
};

const PESTANAS = [
  { id: 'lista', texto: 'Equipos', vistas: ['lista', 'ficha', 'editar', 'especificaciones', 'accesorios', 'certificado', 'etiqueta'] },
  { id: 'salida', texto: 'Salida', vistas: ['salida', 'resultado'] },
  { id: 'regreso', texto: 'Regreso', vistas: ['regreso'] },
  { id: 'alertas', texto: 'Alertas', vistas: ['alertas', 'reportar'] },
  { id: 'admin', texto: 'Administrar', vistas: ['admin', 'importar', 'catalogos', 'respaldo', 'papelera', 'cert-proyecto'], soloRRHH: true },
];

export function montarPantallas(contenedor, contexto) {
  const esRRHH = contexto.rol === 'rrhh';
  const persona = contexto.personaId || null;
  fijarPersona(persona);

  const raiz = document.createElement('div');
  raiz.className = 'mod-equipos';
  raiz.innerHTML = '<div class="eq-zona"></div><div class="eq-aviso" role="status" hidden></div>';
  contenedor.appendChild(raiz);
  const zona = raiz.querySelector('.eq-zona');
  const avisoEl = raiz.querySelector('.eq-aviso');

  const st = {
    vista: contexto.equipoInicial ? 'ficha' : 'lista', equipoId: contexto.equipoInicial || null,
    filtro: 'todos', busqueda: '', verCerradas: false, importacion: null, resultado: null, alertaEquipoId: null,
    fichaTab: 'accesorios', verPlaca: false, certProyectoId: null, reporteDesdeFicha: false,
  };
  let nombres = { proyecto: {}, persona: {} };
  let cacheLista = [];
  let activo = true;
  let timerAviso = null;

  const proy = id => id === OFICINA_ID ? 'Oficina' : (nombres.proyecto[id] || (id ? 'Proyecto desconocido' : '—'));
  const pers = id => nombres.persona[id] || (id ? 'Persona desconocida' : 'sin responsable');

  function avisar(texto, tipo = 'ok') {
    avisoEl.textContent = texto;
    avisoEl.dataset.tipo = tipo;
    avisoEl.hidden = false;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { avisoEl.hidden = true; }, 4000);
  }

  async function ir(vista, extra = {}) {
    Object.assign(st, { vista }, extra);
    await render();
    // Volver arriba sin asumir quién hace el desplazamiento (la ventana o un contenedor de la app global).
    window.scrollTo(0, 0);
    for (let p = raiz.parentElement; p; p = p.parentElement) if (p.scrollTop) p.scrollTop = 0;
  }

  async function render() {
    try {
      nombres = await mapaNombres();
      const alertasAbiertas = (await todasLasAlertas()).filter(alertaActiva).length;
      const cuerpo = await VISTAS[st.vista]();
      if (!activo) return;
      zona.innerHTML = navegacion(alertasAbiertas) + `<main class="eq-cuerpo">${cuerpo}</main>`;
      if (st.vista === 'lista') pintarResultados();
    } catch (err) {
      console.error(err);
      zona.innerHTML = `<div class="eq-error"><b>Algo falló al cargar.</b><br>${esc(err.message)}</div>`;
    }
  }

  function navegacion(nAlertas) {
    const botones = PESTANAS.filter(p => !p.soloRRHH || esRRHH).map(p => {
      const actual = p.vistas.includes(st.vista);
      const badge = p.id === 'alertas' && nAlertas ? `<span class="eq-badge">${nAlertas}</span>` : '';
      return `<button class="eq-pestana${actual ? ' activa' : ''}" data-accion="ir" data-vista="${p.id}">${ICONOS[p.id]}${p.texto}${badge}</button>`;
    }).join('');
    return `<nav class="eq-nav">${botones}</nav>`;
  }

  // ─────────── Fragmentos ───────────

  function chipUbicacion(u) {
    if (u.lugar === 'terreno') return `<span class="eq-chip terreno">${esc(proy(u.proyectoId))} · ${esc(pers(u.personaId))}</span>`;
    return `<span class="eq-chip ${u.lugar}">${LUGARES[u.lugar]}</span>`;
  }

  function chipCalibracion(c) {
    if (c.nivel === 'no_aplica') return '<span class="eq-chip gris">No requiere calibración</span>';
    if (c.nivel === 'sin_dato') return '<span class="eq-chip ambar">Falta fecha de calibración</span>';
    if (c.nivel === 'vencida') return `<span class="eq-chip rojo">Calibración vencida hace ${-c.dias} d</span>`;
    if (c.nivel === 'por_vencer') return `<span class="eq-chip ambar">Calibración vence en ${c.dias} d</span>`;
    return `<span class="eq-chip verde">Calibración al día · ${fechaLegible(c.proxima)}</span>`;
  }

  const chipAlertas = n => n ? `<span class="eq-chip rojo">⚠ ${n} alerta${n > 1 ? 's' : ''}</span>` : '';

  function opcionesProyectos(lista, seleccionado, { vacio = 'Elige proyecto…' } = {}) {
    return `<option value="">${vacio}</option>` + lista.map(p =>
      `<option value="${esc(p.id)}"${p.id === seleccionado ? ' selected' : ''}>${esc(p.nombre)}${p.mandante && p.id !== OFICINA_ID ? ' — ' + esc(p.mandante) : ''}</option>`).join('');
  }

  function opcionesPersonas(lista, seleccionado) {
    return '<option value="">Elige persona…</option>' + lista.map(p =>
      `<option value="${esc(p.id)}"${p.id === seleccionado ? ' selected' : ''}>${esc(p.nombre)}${p.cargo ? ' — ' + esc(p.cargo) : ''}</option>`).join('');
  }

  function describirEvento(e) {
    let t;
    switch (e.tipo) {
      case 'salida': t = `Salida a <b>${esc(proy(e.proyectoId))}</b> · responsable ${esc(pers(e.personaId))}`; break;
      case 'traspaso': t = `Traspaso de ${esc(proy(e.desdeProyectoId))} a <b>${esc(proy(e.proyectoId))}</b> · responsable ${esc(pers(e.personaId))}`; break;
      case 'regreso': t = `Regreso a oficina desde ${esc(proy(e.desdeProyectoId))}`; break;
      case 'uso': t = `Uso en ${esc(proy(e.proyectoId))} por ${esc(pers(e.personaId))}`; break;
      case 'alerta': t = `Alerta: <b>${ESTADOS_ALERTA[e.estadoAlerta] || e.estadoAlerta}</b>`; break;
      default: t = TIPOS_EVENTO[e.tipo] || e.tipo;
    }
    const extras = [];
    if (e.nota) extras.push(esc(e.nota));
    if ((e.faltantes || []).length) extras.push(`<span class="eq-txt-ambar">Faltó: ${esc(e.faltantes.join(', '))}</span>`);
    if ((e.alertasAbiertas || []).length && e.tipo !== 'alerta') extras.push('<span class="eq-txt-rojo">Con alerta activa al momento</span>');
    const quien = e.creadoPor ? ` · registró ${esc(pers(e.creadoPor))}` : '';
    return `<li><div class="eq-ev-fecha">${fechaHoraLegible(e.fecha)}${quien}</div><div>${t}</div>${extras.map(x => `<div class="eq-ev-extra">${x}</div>`).join('')}</li>`;
  }

  function checkAccesorio(equipoId, a) {
    const extra = [a.cantidad > 1 ? `×${a.cantidad}` : '', a.estado !== 'bueno' ? `<span class="eq-txt-ambar">(${ESTADOS_ACCESORIO[a.estado].toLowerCase()})</span>` : ''].filter(Boolean).join(' ');
    return `<label class="eq-comp"><input type="checkbox" data-comp="${equipoId}" value="${esc(a.nombre)}"> ${esc(a.nombre)} ${extra}</label>`;
  }

  // ─────────── Vistas ───────────

  const FILTROS = [
    ['todos', 'Todos', e => e.ubicacion.lugar !== 'baja'],
    ['oficina', 'En oficina', e => e.ubicacion.lugar === 'oficina'],
    ['terreno', 'En terreno', e => e.ubicacion.lugar === 'terreno'],
    ['mantencion', 'En mantención', e => e.ubicacion.lugar === 'mantencion'],
    ['alertas', 'Con alerta', e => e.alertasActivas.length > 0],
    ['calibracion', 'Calibración por revisar', e => ['vencida', 'por_vencer', 'sin_dato'].includes(e.calibracion.nivel) && e.ubicacion.lugar !== 'baja'],
    ['baja', 'De baja', e => e.ubicacion.lugar === 'baja'],
  ];

  const VISTAS = {
    async lista() {
      cacheLista = (await listarConEstado()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      if (!cacheLista.length) {
        return `<section class="eq-vacio">
          ${ICONOS.vacio}
          <b>Aún no hay equipos</b>
          ${esRRHH
            ? `<p>Carga la planilla que ya usas (EQUIPO, MARCA, MODELO, DESCRIPCIÓN, N° SERIE, FECHA CALIBRACIÓN) o crea los equipos uno por uno.</p>
               <div class="eq-acciones"><button class="eq-btn primario" data-accion="ir" data-vista="importar">Importar planilla</button>
               <button class="eq-btn" data-accion="nuevo-equipo">Nuevo equipo</button></div>`
            : '<p>RRHH todavía no carga los equipos de la empresa.</p>'}
        </section>`;
      }
      const chips = FILTROS.map(([id, texto, fn]) => {
        const n = cacheLista.filter(fn).length;
        if (!n && id !== 'todos' && id !== st.filtro) return '';
        return `<button class="eq-filtro${st.filtro === id ? ' activo' : ''}" data-accion="filtro" data-filtro="${id}">${texto} <span>${n}</span></button>`;
      }).join('');
      return `
        <div class="eq-barra">
          <input type="search" class="eq-buscar" placeholder="Buscar por equipo, modelo, N° serie…" value="${esc(st.busqueda)}" data-campo="busqueda">
          ${esRRHH ? '<button class="eq-btn primario" data-accion="nuevo-equipo">+ Equipo</button>' : ''}
        </div>
        <div class="eq-filtros">${chips}</div>
        <div id="eq-resultados"></div>`;
    },

    async editar() {
      const eq = st.equipoId ? (await estadoDeEquipo(st.equipoId))?.equipo : nuevoEquipo();
      if (!eq) return '<p>El equipo no existe.</p>';
      const campo = (nombre, etiqueta, tipo = 'text', extra = '') =>
        `<label class="eq-campo"><span>${etiqueta}</span><input type="${tipo}" name="${nombre}" value="${esc(eq[nombre] ?? '')}" ${extra}></label>`;
      return `
        <button class="eq-volver" data-accion="${st.equipoId ? 'ver' : 'ir'}" data-vista="lista" data-id="${st.equipoId || ''}">← Volver</button>
        <h2>${st.equipoId ? 'Editar equipo' : 'Nuevo equipo'}</h2>
        <form class="eq-form" data-form="equipo">
          <fieldset><legend>Columnas de la planilla</legend>
            ${campo('equipo', 'EQUIPO', 'text', 'required list="eq-tipos" placeholder="Estacion Total, GNSS, Nivel Topografico…"')}
            <datalist id="eq-tipos">${[...new Set(cacheLista.map(x => x.equipo.equipo).filter(Boolean))].map(v => `<option value="${esc(v)}">`).join('')}</datalist>
            ${campo('marca', 'MARCA', 'text', 'list="eq-marcas"')}
            <datalist id="eq-marcas">${[...new Set(cacheLista.map(x => x.equipo.marca).filter(Boolean))].map(v => `<option value="${esc(v)}">`).join('')}</datalist>
            ${campo('modelo', 'MODELO')}
            ${campo('descripcion', 'DESCRIPCIÓN', 'text', 'placeholder="1&quot; R500 · Aumento 32x · Base · Rover · Control…"')}
            ${campo('numeroSerie', 'N° SERIE')}
            ${campo('fechaUltimaCalibracion', 'FECHA CALIBRACIÓN', 'date')}
            <label class="eq-comp"><input type="checkbox" name="calibracionNoAplica"${eq.calibracionNoAplica ? ' checked' : ''}> No requiere calibración (en la planilla: «-»)</label>
          </fieldset>
          <fieldset><legend>Datos del módulo</legend>
            <label class="eq-campo"><span>Categoría</span><select name="categoria">${CATEGORIAS.map(c => `<option${c === eq.categoria ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
            ${campo('codigoInterno', 'Código interno (etiqueta)')}
            ${campo('periodoCalibracionMeses', 'Calibrar cada (meses)', 'number', 'min="1" max="60"')}
            ${campo('fechaAlta', 'Fecha de alta', 'date')}
            <p class="eq-tenue" style="margin-top:12px">Accesorios, certificados, fotos y especificaciones se editan en la ficha del equipo.</p>
            <label class="eq-campo"><span>Observaciones</span><textarea name="observaciones" rows="2">${esc(eq.observaciones)}</textarea></label>
          </fieldset>
          <div class="eq-acciones"><button class="eq-btn primario" type="submit">Guardar</button></div>
        </form>`;
    },

    async salida() {
      const [lista, proyectos, personas] = await Promise.all([listarConEstado(), listarProyectos({ incluirOficina: false }), listarPersonas()]);
      const disponibles = lista.filter(e => e.ubicacion.lugar === 'oficina').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      const enTerreno = lista.filter(e => e.ubicacion.lugar === 'terreno').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      const fuera = lista.filter(e => e.ubicacion.lugar === 'mantencion');
      const item = (e, traspaso) => {
        const avisos = avisosDe(e);
        const comps = e.equipo.accesorios;
        return `<div class="eq-check-item">
          <label class="eq-check-cab"><input type="checkbox" name="equipo" value="${e.equipo.id}" data-accion-cambio="mostrar-componentes">
            <span><b>${esc(e.nombre)}</b><small>N° serie <span class="eq-mono">${esc(e.equipo.numeroSerie || '—')}</span>${traspaso ? ` · hoy en ${esc(proy(e.ubicacion.proyectoId))}` : ''}</small></span></label>
          ${avisos.length ? `<div class="eq-avisos">${avisos.map(a => `<div>⚠ ${esc(a)}</div>`).join('')}<div class="eq-tenue">No bloquea la salida; queda registrado.</div></div>` : ''}
          <div class="eq-componentes" hidden>
            ${comps.length ? `<div class="eq-tenue">Marca lo que va en la caja:</div>${comps.map(a => checkAccesorio(e.equipo.id, a)).join('')}
              <button type="button" class="eq-btn chico" data-accion="marcar-todo" data-id="${e.equipo.id}">Está todo</button>`
              : '<div class="eq-tenue">Este equipo no tiene accesorios registrados.</div>'}
          </div>
        </div>`;
      };
      return `
        <div class="eq-intro"><h2>Checklist de salida</h2>
        <p class="eq-tenue">Asigna los equipos a un proyecto y a un responsable antes de salir. Sirve también para revisar que no falte nada.</p></div>
        <form class="eq-form" data-form="salida">
          <fieldset><legend>1. Destino</legend>
            <label class="eq-campo"><span>Proyecto</span><select name="proyectoId" required>${opcionesProyectos(proyectos, '')}</select></label>
            ${catalogosEditables() ? '<button type="button" class="eq-btn chico" data-accion="nuevo-proyecto">+ Proyecto nuevo</button>' : ''}
            <label class="eq-campo"><span>Responsable (encargado del trabajo)</span><select name="personaId" required>${opcionesPersonas(personas, persona)}</select></label>
          </fieldset>
          <fieldset><legend>2. Equipos en oficina (${disponibles.length})</legend>
            ${disponibles.map(e => item(e, false)).join('') || '<p class="eq-tenue">No hay equipos en oficina.</p>'}
          </fieldset>
          ${enTerreno.length ? `<fieldset><legend>Traspaso desde otro proyecto (${enTerreno.length})</legend>
            <p class="eq-tenue">El equipo pasa directo al nuevo proyecto sin volver a oficina.</p>
            ${enTerreno.map(e => item(e, true)).join('')}</fieldset>` : ''}
          ${fuera.length ? `<p class="eq-tenue">En mantención (no disponibles): ${fuera.map(e => esc(e.nombre)).join(', ')}</p>` : ''}
          <label class="eq-campo"><span>Nota (opcional)</span><input name="nota"></label>
          <div class="eq-acciones"><button class="eq-btn primario" type="submit">Registrar salida</button></div>
        </form>`;
    },

    async resultado() {
      const r = st.resultado || { titulo: 'Listo', items: [] };
      return `<div class="eq-intro"><h2>${esc(r.titulo)}</h2><p class="eq-tenue">Quedó registrado en el historial de cada equipo.</p></div>
        <ul class="eq-resultado">${r.items.map(i => `<li><b>${esc(i.nombre)}</b>${i.tipo === 'traspaso' ? ' (traspaso)' : ''}
          ${(i.faltantes || []).length ? `<div class="eq-txt-ambar">Faltó: ${esc(i.faltantes.join(', '))}</div>` : '<div class="eq-txt-verde">Completo</div>'}
          ${(i.avisos || []).map(a => `<div class="eq-txt-rojo">⚠ ${esc(a)}</div>`).join('')}</li>`).join('')}</ul>
        <div class="eq-acciones bloque"><button class="eq-btn relleno" data-accion="ir" data-vista="lista">Ver equipos</button>
          ${r.proyectoId ? `<button class="eq-btn" data-accion="cert-de-proyecto" data-id="${r.proyectoId}">Certificados de este proyecto</button>` : ''}</div>`;
    },

    async regreso() {
      const lista = (await listarConEstado()).filter(e => e.ubicacion.lugar === 'terreno');
      if (!lista.length) return `<div class="eq-vacio">${ICONOS.vacio}<b>No hay equipos en terreno</b><p>Cuando salgan con el checklist, aparecerán aquí para registrar su regreso.</p></div>`;
      const grupos = {};
      for (const e of lista) (grupos[e.ubicacion.proyectoId] ||= []).push(e);
      const bloques = Object.entries(grupos).map(([pid, eqs]) => `
        <fieldset><legend>${esc(proy(pid))}</legend>
          ${eqs.map(e => `<div class="eq-check-item">
            <label class="eq-check-cab"><input type="checkbox" name="equipo" value="${e.equipo.id}" data-accion-cambio="mostrar-componentes">
              <span><b>${esc(e.nombre)}</b><small>N° serie <span class="eq-mono">${esc(e.equipo.numeroSerie || '—')}</span> · ${esc(pers(e.ubicacion.personaId))} · desde ${fechaLegible(e.ubicacion.desde)}</small></span></label>
            <div class="eq-componentes" hidden>
              ${e.equipo.accesorios.map(a => checkAccesorio(e.equipo.id, a)).join('')}
              ${e.equipo.accesorios.length ? `<button type="button" class="eq-btn chico" data-accion="marcar-todo" data-id="${e.equipo.id}">Volvió todo</button>` : ''}
            </div></div>`).join('')}
        </fieldset>`).join('');
      return `<div class="eq-intro"><h2>Regreso a oficina</h2>
        <p class="eq-tenue">Marca los equipos que vuelven y revisa que vuelva todo lo que salió.</p></div>
        <form class="eq-form" data-form="regreso">${bloques}
          <label class="eq-campo"><span>Nota (opcional)</span><input name="nota"></label>
          <div class="eq-acciones"><button class="eq-btn primario" type="submit">Registrar regreso</button></div></form>`;
    },

    async alertas() {
      const [alertas, lista] = await Promise.all([todasLasAlertas(), listarConEstado()]);
      const porId = Object.fromEntries(lista.map(e => [e.equipo.id, e]));
      const visibles = alertas.filter(a => st.verCerradas || alertaActiva(a));
      const tarjetas = [];
      for (const a of visibles) {
        const e = porId[a.equipoId];
        const usos = (await usosConAlerta(a.id, a.equipoId)).filter(u => u.tipo !== 'alerta');
        tarjetas.push(`<div class="eq-alerta${a.estado === 'cerrada' ? ' cerrada' : ''}">
          <div class="eq-alerta-cab"><b>${esc(e ? e.nombre : 'Equipo eliminado')}</b> <span class="eq-chip ${a.estado === 'cerrada' ? 'gris' : 'rojo'}">${ESTADOS_ALERTA[a.estado]}</span></div>
          <p>${esc(a.descripcion)}</p>
          <div class="eq-tenue">Reportó ${esc(pers(a.reportadaPor))} el ${fechaHoraLegible(a.fechaReporte)} en ${esc(proy(a.proyectoId))}</div>
          ${usos.length ? `<div class="eq-txt-rojo">Usado ${usos.length} ${usos.length === 1 ? 'vez' : 'veces'} con la alerta abierta (${[...new Set(usos.map(u => pers(u.personaId)))].map(esc).join(', ')})</div>` : ''}
          <details><summary>Seguimiento</summary><ul class="eq-historial">${a.historial.map(h =>
            `<li><div class="eq-ev-fecha">${fechaHoraLegible(h.fecha)} · ${esc(pers(h.personaId))}</div><div>${ESTADOS_ALERTA[h.estado]}${h.nota ? ' — ' + esc(h.nota) : ''}</div></li>`).join('')}</ul></details>
          <div class="eq-acciones">
            ${e ? `<button class="eq-btn chico" data-accion="ver" data-id="${a.equipoId}">Ver equipo</button>` : ''}
            ${esRRHH ? PASOS_ALERTA[a.estado].map(p => `<button class="eq-btn chico" data-accion="alerta-paso" data-id="${a.id}" data-estado="${p.estado}">${p.texto}</button>`).join('') : ''}
          </div></div>`);
      }
      return `<div class="eq-intro"><h2>Alertas</h2>
        <p class="eq-tenue">Terreno abre la alerta; ${esRRHH ? 'tú' : 'RRHH'} la envía a mantención, la recibe y la cierra. Una alerta no impide usar el equipo, pero cada uso queda anotado.</p>
        <div class="eq-acciones bloque"><button class="eq-btn primario" data-accion="reportar">Reportar anomalía</button></div>
        <label class="eq-comp"><input type="checkbox" data-accion-cambio="ver-cerradas"${st.verCerradas ? ' checked' : ''}> Mostrar cerradas</label></div>
        ${tarjetas.join('') || `<div class="eq-vacio">${ICONOS.alertas}<b>Sin alertas activas</b><p>Los equipos no tienen anomalías reportadas.</p></div>`}`;
    },

    async reportar() {
      const lista = (await listarConEstado()).filter(e => e.ubicacion.lugar !== 'baja').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      return `${st.reporteDesdeFicha ? `<button class="eq-volver" data-accion="ver" data-id="${st.equipoId}">← Ficha del equipo</button>` : '<button class="eq-volver" data-accion="ir" data-vista="alertas">← Alertas</button>'}
        <form class="eq-form" data-form="reportar"><fieldset><legend>Reportar anomalía</legend>
          <label class="eq-campo"><span>Equipo</span><select name="equipoId" required><option value="">Elige equipo…</option>
            ${lista.map(e => `<option value="${e.equipo.id}"${e.equipo.id === st.alertaEquipoId ? ' selected' : ''}>${esc(e.nombre)} — N° ${esc(e.equipo.numeroSerie || '—')}</option>`).join('')}</select></label>
          <label class="eq-campo"><span>¿Qué pasa?</span><textarea name="descripcion" rows="4" required placeholder="Ej.: el compensador marca error al nivelar; la batería 2 no carga."></textarea></label>
          <p class="eq-tenue" style="margin-top:12px">RRHH queda informado. Puedes seguir usando el equipo si es seguro; cada uso queda registrado con la alerta.</p></fieldset>
          <div class="eq-acciones"><button class="eq-btn primario" type="submit">Enviar alerta</button></div>
        </form>`;
    },

    async admin() {
      const item = (accion, vista, ico, titulo, texto) =>
        `<button class="eq-menu-item" data-accion="${accion}"${vista ? ` data-vista="${vista}"` : ''}>
          <span class="eq-menu-ico">${ico}</span><span class="eq-menu-txt"><b>${titulo}</b><span>${texto}</span></span><span class="eq-menu-flecha">›</span></button>`;
      return `<div class="eq-intro"><h2>Administrar</h2><p class="eq-tenue">Altas, carga de la planilla y mantención de los datos del módulo.</p></div>
        <div class="eq-menu">
          ${item('ir', 'importar', '📊', 'Importar planilla', 'Excel o CSV con las columnas que ya usa RRHH')}
          ${item('descargar-planilla', '', '⬇️', 'Descargar planilla', 'Excel con tus columnas + ubicación, calibración y certificados')}
          ${item('nuevo-equipo', '', '➕', 'Nuevo equipo', 'Alta manual de un equipo')}
          ${item('ir', 'cert-proyecto', '📄', 'Certificados por proyecto', 'Certificados vigentes de los equipos de un proyecto')}
          ${item('ir', 'catalogos', '👥', 'Proyectos y personas', 'Catálogos temporales para probar')}
          ${item('ir', 'respaldo', '💾', 'Respaldo', 'Descargar o cargar un .json')}
          ${item('ir', 'papelera', '🗑️', 'Papelera', 'Equipos eliminados')}
        </div>
        <p class="eq-tenue" style="text-align:center;margin-top:14px">Módulo Equipos v${VERSION_MODULO}</p>`;
    },

    async importar() {
      const imp = st.importacion;
      const intro = `<button class="eq-volver" data-accion="ir" data-vista="admin">← Administrar</button>
        <div class="eq-intro"><h2>Importar planilla de equipos</h2>
        <p class="eq-tenue">Lee la primera hoja de un .xlsx o un .csv con las columnas EQUIPO · MARCA · MODELO · DESCRIPCIÓN · N° SERIE · FECHA CALIBRACIÓN (el orden no importa).
        Un «-» en la fecha se lee como «no requiere calibración». Antes de guardar verás cada fila. Los equipos que ya existen se reconocen por N° de serie.</p>
        <label class="eq-archivo" style="width:100%">📄 Elegir archivo (.xlsx o .csv)<input type="file" accept=".xlsx,.xls,.csv" data-accion-cambio="leer-planilla"></label></div>`;
      if (!imp) return intro;
      const cols = imp.columnas.filter(c => c.encabezado).map(c => {
        const col = COLUMNAS_PLANILLA.find(x => x.campo === c.campo);
        return `<li>${esc(c.encabezado)} → ${col ? `<b>${col.etiqueta}</b>` : c.ignorar ? '<span class="eq-tenue">informativa (la calcula la app), no se importa</span>' : '<span class="eq-tenue">se guarda como dato extra</span>'}</li>`;
      }).join('');
      const filas = imp.registros.map((r, i) => `<tr class="${r.accion === 'omitir' ? 'omitida' : ''}">
        <td>${r.filaExcel}</td>
        <td><select data-imp="accion" data-i="${i}">
          <option value="nuevo"${r.accion === 'nuevo' ? ' selected' : ''}${r.existente ? ' disabled' : ''}>Nuevo</option>
          ${r.existente ? `<option value="actualizar"${r.accion === 'actualizar' ? ' selected' : ''}>Actualizar</option>` : ''}
          <option value="omitir"${r.accion === 'omitir' ? ' selected' : ''}>Omitir</option></select></td>
        ${celdasPlanilla(r.datos)}
        <td><select data-imp="categoria" data-i="${i}"${r.existente ? ' disabled' : ''}>${CATEGORIAS.map(c => `<option${c === r.categoria ? ' selected' : ''}>${c}</option>`).join('')}</select></td>
        <td>${r.problemas.map(p => `<div class="eq-txt-ambar">${esc(p)}</div>`).join('')}${r.existente ? '<div class="eq-tenue">Ya existe: se actualizan solo las columnas de la planilla</div>' : ''}</td>
      </tr>`).join('');
      const n = k => imp.registros.filter(r => r.accion === k).length;
      return `${intro}
        <section class="eq-seccion"><h3>${esc(imp.archivo)} · hoja «${esc(imp.hoja)}» · encabezados en la fila ${imp.filaEncabezados}</h3>
          <ul class="eq-lista-simple">${cols}</ul>
          ${imp.faltan.length ? `<div class="eq-avisos">No encontré: ${imp.faltan.join(', ')}. Esos campos quedarán vacíos.</div>` : ''}
        </section>
        <div class="eq-tabla-scroll"><table class="eq-tabla-imp">
          <thead><tr><th>Fila</th><th>Acción</th>${COLUMNAS_PLANILLA.map(c => `<th>${c.etiqueta}</th>`).join('')}<th>Categoría</th><th>Revisar</th></tr></thead>
          <tbody>${filas}</tbody></table></div>
        <div class="eq-acciones">
          <button class="eq-btn primario" data-accion="aplicar-importacion">Importar: ${n('nuevo')} nuevos, ${n('actualizar')} a actualizar, ${n('omitir')} omitidos</button>
          <button class="eq-btn" data-accion="cancelar-importacion">Cancelar</button>
        </div>`;
    },

    async catalogos() {
      const [proyectos, personas] = await Promise.all([listarProyectos(), listarPersonas()]);
      const editable = catalogosEditables();
      return `<button class="eq-volver" data-accion="ir" data-vista="admin">← Administrar</button>
        <div class="eq-intro"><h2>Proyectos y personas</h2>
        <p class="eq-tenue">Catálogos temporales para probar. En la app global se reemplazan por los reales sin cambiar este módulo.</p></div>
        <section class="eq-seccion"><h3>Proyectos</h3>
          <ul class="eq-lista-simple">${proyectos.map(p => `<li>${esc(p.nombre)}${p.mandante ? ` <span class="eq-tenue">— ${esc(p.mandante)}</span>` : ''}${p.id === OFICINA_ID ? ' <span class="eq-tenue">(fijo)</span>' : ''}</li>`).join('')}</ul>
          ${editable ? `<form class="eq-form fila" data-form="proyecto"><input name="nombre" placeholder="Nombre del proyecto" required><input name="mandante" placeholder="Mandante"><button class="eq-btn" type="submit">Agregar</button></form>` : ''}
        </section>
        <section class="eq-seccion"><h3>Personas</h3>
          <ul class="eq-lista-simple">${personas.map(p => `<li>${esc(p.nombre)}${p.cargo ? ` <span class="eq-tenue">— ${esc(p.cargo)}</span>` : ''}</li>`).join('') || '<li class="eq-tenue">Sin personas</li>'}</ul>
          ${editable ? `<form class="eq-form fila" data-form="persona"><input name="nombre" placeholder="Nombre" required><input name="cargo" placeholder="Cargo (geomensor, topógrafo, piloto…)"><button class="eq-btn" type="submit">Agregar</button></form>` : ''}
        </section>`;
    },

    async respaldo() {
      return `<button class="eq-volver" data-accion="ir" data-vista="admin">← Administrar</button>
        <div class="eq-intro"><h2>Respaldo</h2>
        <p class="eq-tenue"><b>Respaldo (.json):</b> todo lo de la app (equipos, historial, alertas, certificados con sus PDF y fotos). Sirve para recuperar la app. Al cargarlo se mezcla por registro: gana el más reciente y no se borra nada.</p>
        <p class="eq-tenue"><b>Planilla Excel:</b> tus columnas de siempre más ubicación, próxima calibración, certificado vigente y alertas, con hojas de accesorios y certificados. Se abre sin la app y se puede volver a importar.</p>
        <div class="eq-acciones bloque"><button class="eq-btn relleno" data-accion="exportar">Descargar respaldo (.json)</button>
          <button class="eq-btn" data-accion="descargar-planilla">Descargar planilla Excel</button>
          <label class="eq-archivo" style="flex:1 1 100%">Cargar respaldo (.json)<input type="file" accept=".json" data-accion-cambio="importar-respaldo"></label></div></div>`;
    },

    async papelera() {
      const items = (await enPapelera('equipos_equipos'));
      const otros = [...await enPapelera('equipos_certificados'), ...await enPapelera('equipos_mantenciones'), ...await enPapelera('compartido_archivos')];
      const etiquetaOtro = ({ almacen, registro: r }) => almacen === 'equipos_certificados' ? `Certificado ${esc(r.codigo)} (${fechaLegible(r.fecha)})`
        : almacen === 'equipos_mantenciones' ? `Mantención ${esc(r.tipo)} del ${fechaLegible(r.fecha)}` : `Archivo ${esc(r.nombre)}`;
      return `<button class="eq-volver" data-accion="ir" data-vista="admin">← Administrar</button>
        <div class="eq-intro"><h2>Papelera</h2>
        ${items.length ? `<ul class="eq-lista-simple">${items.map(({ almacen, registro }) =>
          `<li>${esc(nombreCorto(registro))} · N° ${esc(registro.numeroSerie || '—')} <span class="eq-tenue">eliminado ${fechaHoraLegible(registro.eliminadoEn)}</span>
            <button class="eq-btn chico" data-accion="restaurar" data-almacen="${almacen}" data-id="${registro.id}">Restaurar</button></li>`).join('')}</ul>`
          : '<p class="eq-tenue">No hay equipos en la papelera.</p>'}
        ${otros.length ? `<h3 style="margin-top:14px">Certificados, mantenciones y archivos</h3><ul class="eq-lista-simple">${otros.map(o =>
          `<li>${etiquetaOtro(o)} <span class="eq-tenue">eliminado ${fechaHoraLegible(o.registro.eliminadoEn)}</span>
            <button class="eq-btn chico" data-accion="restaurar" data-almacen="${o.almacen}" data-id="${o.registro.id}">Restaurar</button></li>`).join('')}</ul>` : ''}</div>`;
    },
  };

  // La ficha y sus vistas viven en ficha.js.
  const enlaceEquipo = contexto.enlaceEquipo || (id => `${location.href.split('#')[0]}#equipo=${id}`);
  const ficha = crearFicha({ st, esc, proy, pers, avisar, ir, render: () => render(), esRRHH, persona, chipUbicacion, chipCalibracion, describirEvento, enlaceEquipo });
  Object.assign(VISTAS, ficha.VISTAS);

  /** Celdas de una fila en el orden de la planilla. */
  function celdasPlanilla(d) {
    return COLUMNAS_PLANILLA.map(c => {
      let v = d[c.campo];
      if (c.campo === 'fechaUltimaCalibracion') return `<td class="eq-mono">${d.calibracionNoAplica ? '-' : fechaLegible(v)}</td>`;
      if (c.campo === 'numeroSerie') return `<td class="eq-mono">${esc(v)}</td>`;
      if (c.campo === 'descripcion') return `<td class="eq-detalle">${esc(v)}</td>`;
      if (c.campo === 'marca' || c.campo === 'modelo') return `<td class="eq-nw">${esc(v)}</td>`;
      return `<td>${esc(v)}</td>`;
    }).join('');
  }

  function pintarResultados() {
    const cont = zona.querySelector('#eq-resultados');
    if (!cont) return;
    const fn = (FILTROS.find(f => f[0] === st.filtro) || FILTROS[0])[2];
    const q = st.busqueda.trim().toLowerCase();
    const lista = cacheLista.filter(fn).filter(e => !q || [e.equipo.equipo, e.equipo.modelo, e.equipo.numeroSerie, e.equipo.marca, e.equipo.descripcion, e.equipo.codigoInterno, e.equipo.categoria]
      .some(v => String(v || '').toLowerCase().includes(q)));
    if (!lista.length) { cont.innerHTML = '<p class="eq-tenue">Ningún equipo coincide.</p>'; return; }
    const tarjetas = lista.map(e => `<button class="eq-tarjeta" data-accion="ver" data-id="${e.equipo.id}">
        <div class="eq-tarjeta-nombre">${esc(e.nombre)}</div>
        ${e.equipo.descripcion ? `<div class="eq-tenue">${esc(e.equipo.descripcion)}</div>` : ''}
        <div class="eq-tenue">N° serie <span class="eq-mono">${esc(e.equipo.numeroSerie || '—')}</span></div>
        <div class="eq-chips">${chipUbicacion(e.ubicacion)} ${chipCalibracion(e.calibracion)} ${chipAlertas(e.alertasActivas.length)}</div>
      </button>`).join('');
    const filas = lista.map(e => `<tr data-accion="ver" data-id="${e.equipo.id}">
        ${celdasPlanilla(e.equipo)}
        <td>${chipUbicacion(e.ubicacion)}</td><td>${chipCalibracion(e.calibracion)}</td><td>${chipAlertas(e.alertasActivas.length)}</td></tr>`).join('');
    cont.innerHTML = `<div class="eq-tarjetas">${tarjetas}</div>
      <div class="eq-tabla-scroll eq-solo-ancho"><table class="eq-tabla">
        <thead><tr>${COLUMNAS_PLANILLA.map(c => `<th>${c.etiqueta}</th>`).join('')}<th>Ubicación</th><th>Calibración</th><th>Alertas</th></tr></thead>
        <tbody>${filas}</tbody></table></div>`;
  }

  // ─────────── Eventos de la interfaz ───────────

  function leerChecklist(form) {
    return [...form.querySelectorAll('input[name="equipo"]:checked')].map(chk => {
      const id = chk.value;
      const checklist = [...form.querySelectorAll(`input[data-comp="${id}"]`)].map(c => ({ nombre: c.value, ok: c.checked }));
      return { equipoId: id, checklist };
    });
  }

  async function alClic(ev) {
    const el = ev.target.closest('[data-accion]');
    if (!el || !raiz.contains(el)) return;
    const { accion, id } = el.dataset;
    try {
      if (await ficha.clic(accion, el)) return;
      switch (accion) {
        case 'ir': await ir(el.dataset.vista); break;
        case 'filtro': st.filtro = el.dataset.filtro; zona.querySelectorAll('.eq-filtro').forEach(b => b.classList.toggle('activo', b === el)); pintarResultados(); break;
        case 'ver': await ir('ficha', { equipoId: id, verPlaca: false }); break;
        case 'cert-de-proyecto': await ir('cert-proyecto', { certProyectoId: id }); break;
        case 'nuevo-equipo': await ir('editar', { equipoId: null }); break;
        case 'editar': await ir('editar', { equipoId: id }); break;
        case 'reportar': await ir('reportar', { alertaEquipoId: id || null, reporteDesdeFicha: st.vista === 'ficha' }); break;
        case 'marcar-todo': el.closest('.eq-componentes').querySelectorAll('input[type=checkbox]').forEach(c => { c.checked = true; }); break;
        case 'baja': {
          const deBaja = el.dataset.valor === '1';
          const nota = prompt(deBaja ? '¿Motivo de la baja?' : '¿Nota de reactivación? (opcional)', '');
          if (nota === null) return;
          await cambiarBaja(id, deBaja, nota);
          avisar(deBaja ? 'Equipo dado de baja' : 'Equipo reactivado');
          await render();
          break;
        }
        case 'papelera-equipo':
          if (!confirm('¿Enviar este equipo a la papelera? Se puede restaurar desde Administrar → Papelera.')) return;
          await papeleraEquipo(id); avisar('Equipo enviado a la papelera'); await ir('lista'); break;
        case 'restaurar': await restaurar(el.dataset.almacen, id, { personaId: persona }); avisar('Restaurado'); await render(); break;
        case 'alerta-paso': {
          const nota = prompt('Nota (opcional): proveedor, n° de orden, qué se reparó…', '');
          if (nota === null) return;
          await cambiarEstadoAlerta(id, el.dataset.estado, nota);
          avisar(`Alerta: ${ESTADOS_ALERTA[el.dataset.estado]}`);
          await render();
          break;
        }
        case 'nuevo-proyecto': {
          const nombre = prompt('Nombre del proyecto');
          if (!nombre) return;
          const mandante = prompt('Mandante (opcional)', '') || '';
          await guardarProyecto({ nombre: nombre.trim(), mandante: mandante.trim() }, { personaId: persona });
          avisar('Proyecto agregado'); await render(); break;
        }
        case 'aplicar-importacion': {
          const res = await aplicarImportacion(st.importacion.registros);
          st.importacion = null;
          avisar(`Importación lista: ${res.nuevos} nuevos, ${res.actualizados} actualizados, ${res.omitidos} omitidos`);
          await ir('lista', { filtro: 'todos' });
          break;
        }
        case 'cancelar-importacion': st.importacion = null; await render(); break;
        case 'descargar-planilla': {
          avisar('Armando la planilla…');
          const r = await descargarPlanilla();
          avisar(`Planilla descargada: ${r.archivo} (${r.equipos} equipos)`);
          break;
        }
        case 'exportar': await descargarRespaldo(['equipos_', 'compartido_'], 'equipos_respaldo'); avisar('Respaldo descargado'); break;
      }
    } catch (err) { console.error(err); avisar(err.message, 'error'); }
  }

  async function alCambiar(ev) {
    const el = ev.target;
    try {
      if (el.dataset.imp) {
        const r = st.importacion.registros[+el.dataset.i];
        r[el.dataset.imp] = el.value;
        if (el.dataset.imp === 'accion') await render();
        return;
      }
      if (await ficha.cambio(el)) return;
      switch (el.dataset.accionCambio) {
        case 'mostrar-componentes': el.closest('.eq-check-item').querySelector('.eq-componentes').hidden = !el.checked; break;
        case 'ver-cerradas': st.verCerradas = el.checked; await render(); break;
        case 'leer-planilla':
          if (!el.files[0]) return;
          avisar('Leyendo planilla…');
          st.importacion = await prepararImportacion(el.files[0]);
          await render();
          avisar(`${st.importacion.registros.length} filas leídas: revisa antes de importar`);
          break;
        case 'importar-respaldo': {
          if (!el.files[0]) return;
          const res = await importarRespaldo(JSON.parse(await el.files[0].text()));
          avisar(`Respaldo cargado: ${res.nuevos} nuevos, ${res.actualizados} actualizados`);
          el.value = '';
          break;
        }
      }
    } catch (err) { console.error(err); avisar(err.message, 'error'); el.value = ''; }
  }

  function alEscribir(ev) {
    if (ev.target.dataset.campo === 'busqueda') { st.busqueda = ev.target.value; pintarResultados(); }
  }

  async function alEnviar(ev) {
    const form = ev.target.closest('form[data-form]');
    if (!form) return;
    ev.preventDefault();
    const fd = Object.fromEntries(new FormData(form));
    try {
      if (await ficha.enviar(form, fd)) return;
      switch (form.dataset.form) {
        case 'equipo': {
          const datos = {
            ...fd,
            id: st.equipoId || undefined,
            fechaUltimaCalibracion: fd.fechaUltimaCalibracion || null,
            periodoCalibracionMeses: Number(fd.periodoCalibracionMeses) || PERIODO_CALIBRACION_MESES,
            calibracionNoAplica: fd.calibracionNoAplica === 'on',
          };
          if (!datos.id) delete datos.id;
          const eq = await guardarEquipo(datos);
          avisar('Equipo guardado');
          await ir('ficha', { equipoId: eq.id });
          break;
        }
        case 'salida': {
          const items = leerChecklist(form);
          if (!items.length) { avisar('Marca al menos un equipo', 'error'); return; }
          const res = await registrarSalida(items, { proyectoId: fd.proyectoId, personaId: fd.personaId, nota: fd.nota });
          await ir('resultado', { resultado: { titulo: `Salida registrada a ${proy(fd.proyectoId)}`, items: res, proyectoId: fd.proyectoId } });
          break;
        }
        case 'regreso': {
          const items = leerChecklist(form);
          if (!items.length) { avisar('Marca al menos un equipo', 'error'); return; }
          const res = await registrarRegreso(items, { nota: fd.nota });
          await ir('resultado', { resultado: { titulo: 'Regreso a oficina registrado', items: res } });
          break;
        }
        case 'reportar':
          await reportarAnomalia({ equipoId: fd.equipoId, descripcion: fd.descripcion.trim(), personaId: persona });
          avisar('Alerta enviada a RRHH');
          if (st.reporteDesdeFicha && fd.equipoId === st.equipoId) await ir('ficha', { fichaTab: 'mantencion', reporteDesdeFicha: false });
          else await ir('alertas');
          break;
        case 'proyecto':
          await guardarProyecto({ nombre: fd.nombre.trim(), mandante: fd.mandante.trim() }, { personaId: persona });
          await render(); break;
        case 'persona':
          await guardarPersona({ nombre: fd.nombre.trim(), cargo: fd.cargo.trim() }, { personaId: persona });
          await render(); break;
      }
    } catch (err) { console.error(err); avisar(err.message, 'error'); }
  }

  raiz.addEventListener('click', alClic);
  raiz.addEventListener('change', alCambiar);
  raiz.addEventListener('input', alEscribir);
  raiz.addEventListener('submit', alEnviar);
  render();

  return {
    desmontar() {
      activo = false;
      clearTimeout(timerAviso);
      raiz.remove();
    },
    /** Llegaron datos de otro dispositivo: se redibuja si no hay un formulario a medio llenar. */
    refrescar() {
      const escribiendo = raiz.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      const seguras = ['lista', 'ficha', 'alertas', 'regreso', 'resultado', 'cert-proyecto', 'admin', 'papelera'];
      if (!escribiendo && seguras.includes(st.vista) && !(st.vista === 'ficha' && raiz.querySelector('details[open]'))) render();
      else avisar('Llegaron datos nuevos de la nube; se verán al cambiar de pantalla');
    },
  };
}
