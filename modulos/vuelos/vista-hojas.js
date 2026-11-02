// modulos/vuelos/vista-hojas.js — lista de hojas de vuelo, encabezado de la hoja y Resumen.

import { escapar as esc, fechaLegible } from '../../compartido/util.js';
import { fmt, fmtDuracion } from './calculo.js';
import { chip, kpi, fila, fechaHora, dosD } from './ui.js';
import { OFICINA_ID } from '../../compartido/catalogos.js';
import { areaM2 } from './calculo.js';
import { totales, estadoPermiso, nombreSector, DOCUMENTOS_DGAC, CONSULTAS } from './hoja.js';
import { ESTADOS_HOJA, PASOS } from './ui.js';

export function crearVistaHojas(v) {
  const ref = n => (...a) => v[n](...a);
  const { st, base } = v;
  const geo = ref('geo');
  const dron = ref('dron');
  const nomProy = ref('nomProy');
  const nomPers = ref('nomPers');
  const zonasDeHoja = ref('zonasDeHoja');

  const opcionesProyectos = sel => `<option value="">Sin proyecto</option>` + base.proyectos.map(p => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.id === OFICINA_ID ? 'Oficina' : p.nombre)}</option>`).join('');

  // ─────────── Lista de hojas ───────────
  function vistaHojas() {
    const lista = base.hojas.filter(h => !st.filtroProyecto || h.proyectoId === st.filtroProyecto);
    return `<div class="sis-cab"><h1>Hojas de vuelo</h1><button class="sis-btn primario" data-accion="nueva-hoja">+ Nueva hoja de vuelo</button></div>
      <p class="sis-tenue">Una hoja por trabajo de vuelo: área, plan de vuelo, clima y permisos en un solo lugar, con la hoja para terreno.</p>
      <label class="sis-campo vu-filtro"><span>Proyecto</span><select data-campo="filtroProyecto"><option value="">Todos</option>${base.proyectos.map(p => `<option value="${esc(p.id)}" ${p.id === st.filtroProyecto ? 'selected' : ''}>${esc(p.id === OFICINA_ID ? 'Oficina' : p.nombre)}</option>`).join('')}</select></label>
      <section class="sis-tarjeta">${lista.length ? `<div class="sis-lista">${lista.map(h => {
        const r = h.resumen || {}; const [et, cl] = ESTADOS_HOJA[h.estado] || ESTADOS_HOJA.borrador;
        return `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(h.nombre || 'Hoja sin nombre')}</b>
          <span class="sis-tenue">${esc(nomProy(h.proyectoId))} · ${h.fecha ? fechaLegible(h.fecha) : 'sin fecha'}${h.pilotoId ? ` · ${esc(nomPers(h.pilotoId))}` : ''}</span>
          <span class="sis-chips">${chip(et, cl)}${r.area ? chip(`${fmt(r.area / 10000, 1)} ha`) : ''}${r.sectores > 1 ? chip(`${r.sectores} sectores`) : ''}${r.corredor ? chip('Corredor') : ''}${r.vuelos ? chip(`${r.vuelos} batería${r.vuelos > 1 ? 's' : ''} · ${fmtDuracion(r.minTotal)}`, 'azul') : ''}</span></span>
          <span class="sis-acciones"><button class="sis-btn chico" data-accion="abrir-hoja" data-id="${h.id}">Abrir</button>
          <button class="sis-btn chico peligro" data-accion="eliminar-hoja" data-id="${h.id}">Eliminar</button></span></div>`;
      }).join('')}</div>` : '<div class="sis-vacio"><p>Todavía no hay hojas de vuelo. Crea una y carga el KMZ del área (o la línea del corredor).</p></div>'}</section>`;
  }

  // ─────────── Encabezado de la hoja ───────────
  const consultasHechas = h => CONSULTAS.every(([k]) => h.permisos.consultas.some(c => c.tipo === k));
  const ultimaConsulta = (h, tipo) => h.permisos.consultas.filter(c => c.tipo === tipo).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

  function encabezadoHoja() {
    const h = st.hoja, g = geo(), d = dron(), t = g && d ? totales(h, d, g) : null;
    const [et, cl] = ESTADOS_HOJA[h.estado] || ESTADOS_HOJA.borrador;
    const perm = estadoPermiso(h);
    const c = h.clima;
    const climaObs = c && c.checklist && c.checklist.some(x => !x.cumple);
    const marcas = {
      area: g ? (g.fallidos.length ? 'aviso' : 'ok') : '',
      vuelo: t ? (t.excede ? 'aviso' : 'ok') : '',
      clima: c ? (climaObs ? 'aviso' : 'ok') : '',
      permisos: perm.nivel === 'ok' && consultasHechas(h) ? 'ok' : (h.permisos.dgac.preparado || h.permisos.consultas.length ? 'aviso' : ''),
    };
    return `<div class="sis-encabezado vu-hoja-cab">
        <div>
          <div class="sis-miga"><a href="#/vuelos" data-accion="volver-lista">Hojas de vuelo</a>${h.proyectoId ? ` / <a href="#/proyecto/${esc(h.proyectoId)}">${esc(nomProy(h.proyectoId))}</a>` : ''}</div>
          <h1>Hoja de vuelo · ${esc(h.nombre || 'sin nombre')}</h1>
          <div class="sis-meta">
            <span>Fecha: <b>${h.fecha ? fechaLegible(h.fecha) : '—'}</b></span>
            <span>Piloto: <b>${esc(nomPers(h.pilotoId) || '—')}</b></span>
            <span>Dron: <b>${esc(d ? (d.familiaNombre || d.nombre).replace('DJI ', '') : '—')}</b></span>
            ${t ? `<span>${h.params.modo === 'lidar' ? 'LiDAR' : 'Fotogrametría'} · GSD ${fmt(t.gsd, 2)} cm · ${fmt(t.altura, 0)} m</span>` : ''}
            <span class="sis-tenue" id="vu-guardado">${h.id ? 'Guardado' : 'Se guarda sola al cargar el área o ponerle nombre'}</span>
          </div>
        </div>
        <div class="sis-acciones">${chip(et, cl)}
          <button class="sis-btn chico" data-accion="imprimir" ${g ? '' : 'disabled'}>Hoja para terreno (PDF)</button>
          ${h.estado === 'borrador' ? '<button class="sis-btn chico primario" data-accion="estado" data-e="lista">Marcar lista</button>' : h.estado === 'lista' ? '<button class="sis-btn chico primario" data-accion="estado" data-e="volada">Marcar volada</button>' : '<button class="sis-btn chico" data-accion="estado" data-e="borrador">Volver a borrador</button>'}
        </div>
      </div>
      <div class="vu-tira">
        ${kpi('Área de vuelo', g ? `${fmt(g.areaVuelo / 10000, 1)} ha` : '—', g ? (g.tipo === 'corredor' ? `corredor de ${fmt(g.izq + g.der, 0)} m` : (Number(h.area.margen) ? `+${h.area.margen} m de margen` : 'sin margen')) : 'falta el área')}
        ${kpi('Vuelo', t ? `${t.baterias} bat. · ${fmtDuracion(t.minVuelo)}` : '—', t ? `jornada ${fmtDuracion(t.minJornada)}${g.sectores.length > 1 ? ` · ${g.sectores.length} sectores` : ''}` : '', t && t.excede ? 'alerta' : '')}
        ${kpi('Ventana GO', c ? (c.ventana || 'Sin ventana') : '—', c ? fechaLegible(c.fecha) : 'consulta el clima', c ? (c.ventana ? 'bien' : 'alerta') : '')}
        ${kpi('Ráfaga máx.', c && c.rafaga ? `${fmt(c.rafaga.v, 1)} m/s` : '—', c && c.rafaga ? `${dosD(c.rafaga.hora)}:00 · límite ${d ? fmt(d.rafagaMaxMs, 0) : '—'}` : '', c && c.rafaga && d && c.rafaga.v > d.rafagaMaxMs ? 'alerta' : '')}
        ${kpi('Kp · luz', c ? `${c.kpMax != null ? fmt(c.kpMax, 0) : '—'} · ${c.sol ? c.sol.join('–') : '—'}` : '—', c ? 'Kp ≤ 4 para GNSS' : '')}
        ${kpi('Permiso DGAC', perm.texto, perm.detalle, perm.nivel === 'ok' ? 'bien' : perm.nivel === 'aviso' ? 'alerta' : '')}
      </div>
      <nav class="vu-pasos" aria-label="Pasos de la hoja">${PASOS.map(([k, t]) => `<button class="vu-paso${st.paso === k ? ' activo' : ''}" data-accion="paso" data-paso="${k}">${t}${marcas[k] === 'ok' ? ' <i class="vu-ok" aria-label="listo">✓</i>' : marcas[k] === 'aviso' ? ' <i class="vu-alerta" aria-label="revisar">!</i>' : ''}</button>`).join('')}</nav>`;
  }

  // ─────────── Resumen ───────────
  function vistaResumen() {
    const h = st.hoja, g = geo(), d = dron(), t = g && d ? totales(h, d, g) : null, c = h.clima, perm = estadoPermiso(h);
    const cab = (n, titulo, estado, clase, paso, accion) => `<div class="vu-res-cab"><span class="vu-num">${n}</span><h2>${titulo}</h2>${estado ? chip(estado, clase) : ''}<button class="vu-link" data-accion="paso" data-paso="${paso}">${accion} →</button></div>`;
    const zonas = g ? zonasDeHoja() : [];
    const climaObs = c && c.checklist && c.checklist.some(x => !x.cumple);
    return `<section class="sis-tarjeta vu-datos-hoja"><h2>Datos de la hoja</h2>
        <div class="vu-datos-grilla">
          <label class="sis-campo"><span>Nombre</span><input data-hoja="nombre" value="${esc(h.nombre)}" placeholder="El Pimiento — vuelo 1"></label>
          <label class="sis-campo"><span>Proyecto</span><select data-hoja="proyectoId">${opcionesProyectos(h.proyectoId)}</select></label>
          <label class="sis-campo"><span>Fecha del vuelo</span><input type="date" data-hoja="fecha" value="${esc(h.fecha || '')}"></label>
          <label class="sis-campo"><span>Piloto</span><select data-hoja="pilotoId"><option value="">—</option>${base.personas.map(p => `<option value="${esc(p.id)}" ${p.id === h.pilotoId ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>
        </div>
      </section>
      <div class="vu-res-grilla">
        <section class="sis-tarjeta">${cab(1, 'Área', g ? (g.fallidos.length ? 'Revisar cortes' : 'Lista') : 'Falta el área', g ? (g.fallidos.length ? 'ambar' : 'verde') : 'gris', 'area', g ? 'Editar área' : 'Cargar área')}
          ${g ? `<dl class="vu-tabla">
            ${fila('Origen', esc(h.area.archivo || '—'))}
            ${g.tipo === 'corredor' ? fila('Corredor', `${fmt(g.izq, 0)} m izq. · ${fmt(g.der, 0)} m der. · ${fmt(g.sectores.reduce((s, x) => s + x.largo, 0) / 1000, 2)} km`) : fila('Margen', Number(h.area.margen) ? `+${h.area.margen} m · ${fmt(areaM2(g.original) / 10000, 2)} → ${fmt(g.areaVuelo / 10000, 2)} ha` : 'sin margen')}
            ${fila('Sectores', g.sectores.length > 1 ? g.sectores.map((_, i) => esc(nombreSector(h, i, g.sectores.length))).join(' · ') : 'uno (área completa)')}
            ${fila('Zonas', zonas === null ? 'sin capas cargadas' : zonas.length ? zonas.slice(0, 2).map(z => `${z.toca ? '<b class="vu-rojo">toca</b> ' : ''}${esc(z.nombre)}${z.toca ? '' : ` a ${fmt(z.distancia / 1000, 1)} km`}`).join(' · ') : 'no toca zonas cargadas')}
          </dl>` : '<p class="sis-tenue">Carga el KMZ/KML del área (o la línea del corredor), o dibújala en el mapa.</p>'}
        </section>
        <section class="sis-tarjeta">${cab(2, 'Vuelo', t ? (t.excede ? 'Revisar' : 'Listo') : '', t ? (t.excede ? 'ambar' : 'verde') : 'gris', 'vuelo', 'Ajustar')}
          ${t ? `<div class="vu-mini-kpis">${kpi('GSD', `${fmt(t.gsd, 2)} cm`)}${kpi('Altura', `${fmt(t.altura, 0)} m`)}${kpi('Baterías', t.baterias)}${kpi('Fotos', fmt(t.fotos))}</div>
            <dl class="vu-tabla">${fila('Traslapes · velocidad', `${h.params.traslapeFrontal}/${h.params.traslapeLateral} % · ${t.sectores[0] ? fmt(t.sectores[0].velocidad, 1) : '—'} m/s${h.params.velocidad === '' ? ' (sugerida)' : ''}`)}
            ${fila('En el aire · jornada', `${fmtDuracion(t.minVuelo)} · ${fmtDuracion(t.minJornada)}`)}
            ${g.sectores.length > 1 ? fila('Por sector', t.sectores.map((r, i) => `${esc(nombreSector(h, i, g.sectores.length))} ${r ? fmtDuracion(r.minTotal) : '—'}`).join(' · ')) : ''}</dl>` : '<p class="sis-tenue">Cuando cargues el área, aquí aparece el plan de vuelo.</p>'}
        </section>
        <section class="sis-tarjeta">${cab(3, 'Clima', c ? (climaObs ? 'Con observaciones' : 'Cumple') : '', c ? (climaObs ? 'ambar' : 'verde') : 'gris', 'clima', c ? 'Ver pronóstico' : 'Consultar')}
          ${c ? `<p class="sis-tenue">Consultado ${fechaHora(c.consultadoEn)} para el ${fechaLegible(c.fecha)}.</p>
            <dl class="vu-tabla">${(c.checklist || []).map(x => fila(esc(x.texto), `<span class="${x.cumple ? 'vu-verde' : 'vu-rojo'}">${esc(x.detalle)}</span>`)).join('')}
            ${c.metar ? fila(`METAR ${esc(c.metar.icao)}`, `a ${fmt(c.metar.km, 0)} km`) : ''}</dl>` : '<p class="sis-tenue">Consulta el pronóstico del día del vuelo: viento a 120 m, ráfagas, lluvia, nubes, temperatura, Kp y METAR.</p>'}
        </section>
        <section class="sis-tarjeta">${cab(4, 'Permisos y consultas', perm.texto, perm.nivel === 'ok' ? 'verde' : perm.nivel === 'aviso' ? 'ambar' : 'gris', 'permisos', 'Abrir')}
          <dl class="vu-tabla">
            ${fila('Solicitud DGAC', `${esc(perm.texto)} · ${esc(perm.detalle)}`)}
            ${fila('Documentos', `${DOCUMENTOS_DGAC.filter(([k]) => h.permisos.docs[k]).length} de ${DOCUMENTOS_DGAC.length}`)}
            ${CONSULTAS.map(([k, tt]) => { const x = ultimaConsulta(h, k); return fila(tt, x ? `Revisado ${fechaHora(x.fecha)}` : '<span class="vu-rojo">Pendiente</span>'); }).join('')}
          </dl>
        </section>
      </div>`;
  }

  return { vistaHojas, encabezadoHoja, vistaResumen, ultimaConsulta };
}
