// modulos/vuelos/vista-hojas.js — lista de hojas de vuelo, encabezado de la hoja y Resumen.

import { escapar as esc, fechaLegible } from '../../compartido/util.js';
import { fmt, fmtDuracion } from './calculo.js';
import { chip, kpi, fechaHora, dosD } from './ui.js';
import { OFICINA_ID } from '../../compartido/catalogos.js';
import { totales, estadoPermiso, nombreSector, DOCUMENTOS_DGAC, CONSULTAS, jornadasNecesarias, HORARIO_INICIAL, kmADm } from './hoja.js';
import { diasHabilesDesde, restarHabiles } from '../../compartido/periodicidad.js';
import { ESTADOS_HOJA, PASOS } from './ui.js';
import { resumenMetar } from './metar-ui.js';

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

  // ─────────── Resumen (v0.10): avance, área con cinta, jornadas necesarias, clima por jornada y plazo DGAC ───────────
  const COLORES_DIA = ['#4FC3F7', '#C6F15A', '#FFD54F', '#FF8A80', '#B39DDB', '#80CBC4', '#F48FB1', '#AED581'];
  const colorDia = k => COLORES_DIA[k % COLORES_DIA.length];

  /** Miniatura SVG del área con cada sector pintado según la jornada en que se vuela. */
  function miniatura(g, diaDe) {
    const todos = g.sectores.flatMap(s => s.poligono);
    if (!todos.length) return '';
    const xs = todos.map(p => p[0]), ys = todos.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const W = 700, H = 220, m = 12, k = Math.min((W - 2 * m) / ((x1 - x0) || 1), (H - 2 * m) / ((y1 - y0) || 1));
    const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
    const pt = p => `${(ox + (p[0] - x0) * k).toFixed(1)},${(H - oy - (p[1] - y0) * k).toFixed(1)}`;
    const poli = (s, i) => { const paso = Math.max(1, Math.ceil(s.poligono.length / 400)); return `<polygon points="${s.poligono.filter((_, j) => j % paso === 0).map(pt).join(' ')}" fill="${colorDia(diaDe[i] ?? 0)}" fill-opacity=".8" stroke="${colorDia(diaDe[i] ?? 0)}" stroke-width="7" stroke-linejoin="round" paint-order="stroke"><title>${esc(nombreSector(st.hoja, i, g.sectores.length))}</title></polygon>`; };
    return `<svg class="vu-res-mapa" viewBox="0 0 ${W} ${H}" role="img" aria-label="Esquema del área con sus sectores">${g.sectores.map(poli).join('')}</svg>`;
  }

  /** Cinta de sectores: proporcional al largo en áreas lineales, a la superficie en las demás. */
  function cinta(g, t, diaDe) {
    const h = st.hoja, n = g.sectores.length;
    const medida = s => (s.rango ? s.rango[1] - s.rango[0] : s.largo) || s.area || 1;
    const total = g.sectores.reduce((a, s) => a + medida(s), 0) || 1;
    const lineal = g.sectores.some(s => s.dm);
    const ext = lineal ? [g.sectores[0].dm, g.sectores[n - 1].dm] : null;
    return `<div class="vu-cinta-res">${lineal ? `<div class="vu-cinta-ext"><span>${esc(kmADm(Math.min(...ext.flat())))}</span><span>${n} sectores</span><span>${esc(kmADm(Math.max(...ext.flat())))}</span></div>` : ''}
      <div class="vu-cinta-barra">${g.sectores.map((s, i) => `<i style="flex: 0 0 ${(100 * medida(s) / total).toFixed(3)}%; background: ${colorDia(diaDe[i] ?? 0)}" title="${esc(nombreSector(h, i, n))} · ${fmt(s.area / 10000, 1)} ha${t.sectores[i] ? ` · ${t.sectores[i].vuelos} bat. · ${fmtDuracion(t.sectores[i].minTotal)}` : ''}${diaDe[i] != null ? ` · día ${diaDe[i] + 1}` : ''}"></i>`).join('')}</div></div>`;
  }

  function vistaResumen() {
    const h = st.hoja, g = geo(), d = dron(), t = g && d ? totales(h, d, g) : null, c = h.clima, perm = estadoPermiso(h);
    const zonas = g ? zonasDeHoja() : [];
    const climaObs = c && c.checklist && c.checklist.some(x => !x.cumple);
    const jor = t ? jornadasNecesarias(h, d, g, t) : null;
    const diaDe = {};
    if (jor) jor.dias.forEach((di, k) => di.sectores.forEach(i => { diaDe[i] = k; }));
    const hor = { ...HORARIO_INICIAL, ...(h.params.horario || {}) };
    const fechas = jor && h.fecha ? diasHabilesDesde(h.fecha, jor.dias.length) : [];
    const programado = Array.isArray(h.programa) && h.programa.length;
    const limiteDgac = h.fecha ? restarHabiles((h.programa && h.programa[0] && h.programa[0].fecha) || h.fecha, 7) : null;
    const hoy = new Date().toISOString().slice(0, 10);
    const pasos = [
      ['area', 'Área', g ? (g.fallidos.length ? 'aviso' : 'ok') : 'pend', g ? `${g.sectores.length} sector${g.sectores.length === 1 ? '' : 'es'}` : 'falta el área'],
      ['vuelo', 'Vuelo', t ? (t.excede ? 'aviso' : 'ok') : 'pend', t ? `${t.baterias} baterías${jor && jor.dias.length ? ` · ${jor.dias.length} jornada${jor.dias.length === 1 ? '' : 's'}` : ''}` : '—'],
      ['clima', 'Clima', c ? (climaObs ? 'aviso' : 'ok') : 'pend', c ? (c.ventana ? `ventana ${c.ventana}` : 'sin ventana') : 'sin consultar'],
      ['permisos', 'Permisos', perm.nivel === 'ok' ? 'ok' : (perm.nivel === 'aviso' || (limiteDgac && limiteDgac <= hoy && !h.permisos.dgac.enviado) ? 'aviso' : 'pend'), h.permisos.dgac.enviado || h.permisos.dgac.aprobado ? perm.texto.toLowerCase() : (limiteDgac ? `enviar DGAC antes del ${fechaLegible(limiteDgac)}` : perm.detalle)],
    ];
    const listos = pasos.filter(p => p[2] === 'ok').length;
    const siguiente = pasos.find(p => p[2] !== 'ok');
    const icono = (e, n) => e === 'ok' ? '✓' : e === 'aviso' ? '!' : n;
    return `<section class="sis-tarjeta vu-res-avance">
        <div class="vu-res-pasos">${pasos.map(([k, tt, e, det], n) => `<button type="button" class="vu-res-paso ${e}" data-accion="paso" data-paso="${k}"><span class="vu-res-ic">${icono(e, n + 1)}</span><span><b>${tt}</b><small>${esc(det)}</small></span></button>`).join('')}
          ${siguiente ? `<button class="sis-btn primario" data-accion="paso" data-paso="${siguiente[0]}">Siguiente: ${{ area: 'cargar el área', vuelo: 'ajustar el vuelo', clima: 'consultar el clima', permisos: 'permisos y consultas' }[siguiente[0]]} →</button>` : '<span class="sis-chip verde">Todo listo</span>'}</div>
        <div class="vu-res-progreso"><i style="width: ${listos * 25}%"></i></div>
      </section>
      <section class="sis-tarjeta vu-datos-hoja"><div class="vu-datos-grilla">
          <label class="sis-campo"><span>Nombre</span><input data-hoja="nombre" value="${esc(h.nombre)}" placeholder="El Pimiento — vuelo 1"></label>
          <label class="sis-campo"><span>Proyecto</span><select data-hoja="proyectoId">${opcionesProyectos(h.proyectoId)}</select></label>
          <label class="sis-campo"><span>Primer día de vuelo</span><input type="date" data-hoja="fecha" value="${esc(h.fecha || '')}"></label>
          <label class="sis-campo"><span>Piloto</span><select data-hoja="pilotoId"><option value="">—</option>${base.personas.map(p => `<option value="${esc(p.id)}" ${p.id === h.pilotoId ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>
        </div></section>
      <div class="vu-res-dos">
        <section class="sis-tarjeta vu-res-card">
          <div class="vu-res-tit"><h2>1 · Área</h2><button class="vu-link" data-accion="paso" data-paso="area">${g ? 'Editar área' : 'Cargar área'} →</button></div>
          ${g ? `${miniatura(g, diaDe)}
            <div class="vu-res-datos">
              <div><small>Origen</small><b>${esc(h.area.archivo || '—')}</b></div>
              <div><small>${g.tipo === 'corredor' ? 'Corredor' : 'Superficie'}</small><b>${g.tipo === 'corredor' ? `${fmt(g.sectores.reduce((s, x) => s + x.largo, 0) / 1000, 2)} km · ${fmt(g.izq + g.der, 0)} m` : `${fmt(g.areaVuelo / 10000, 1)} ha${Number(h.area.margen) ? ` · +${h.area.margen} m` : ''}`}</b></div>
              <div><small>Sectores</small><b>${g.sectores.length}${g.sectores.length > 1 ? ` · ~${g.tipo === 'corredor' || g.sectores.some(s => s.rango) ? `${fmt(g.sectores.reduce((a, s) => a + ((s.rango ? s.rango[1] - s.rango[0] : s.largo) || 0), 0) / g.sectores.length / 1000, 1)} km` : `${fmt(g.areaVuelo / g.sectores.length / 10000, 1)} ha`} c/u` : ''}</b></div>
              <div class="${zonas && zonas.some(z => z.toca || z.distancia < 5000) ? 'aviso' : ''}"><small>Zonas</small><b>${zonas === null ? 'sin capas cargadas' : zonas.length ? zonas.slice(0, 1).map(z => `${z.toca ? 'toca ' : ''}${esc(z.nombre)}${z.toca ? '' : ` a ${fmt(z.distancia / 1000, 1)} km`}`).join('') : 'no toca zonas cargadas'}</b></div>
            </div>
            ${g.sectores.length > 1 && t ? `${cinta(g, t, diaDe)}<p class="sis-tenue vu-res-nota">Pasa el mouse por la cinta para ver cada sector. Los colores son las jornadas de vuelo.</p>` : ''}`
            : '<p class="sis-tenue">Carga el KMZ/KML del área (o la línea del corredor), o dibújala en el mapa.</p>'}
        </section>
        <section class="sis-tarjeta vu-res-card">
          <div class="vu-res-tit"><h2>2 · Vuelo</h2><button class="vu-link" data-accion="paso" data-paso="vuelo">Ajustar →</button></div>
          ${t ? `<div class="vu-mini-kpis">${kpi('GSD', h.params.modo === 'lidar' ? '—' : `${fmt(t.gsd, 2)} cm`)}${kpi('Altura', `${fmt(t.altura, 0)} m`)}${kpi('Baterías', t.baterias)}${kpi('Fotos', fmt(t.fotos))}</div>
            <p class="vu-res-linea"><span>Traslapes ${h.params.traslapeFrontal}/${h.params.traslapeLateral} % · ${t.sectores[0] ? fmt(t.sectores[0].velocidad, 1) : '—'} m/s</span><span>En el aire ${fmtDuracion(t.minVuelo)} · jornada ${fmtDuracion(t.minJornada)}</span></p>
            <div class="vu-jornadas">
              <div class="vu-jornadas-cab"><b>Jornadas necesarias: ${jor ? jor.dias.length : '—'}</b>
                <span class="vu-horario">Horario <input type="time" data-horario="inicio" value="${esc(hor.inicio)}" aria-label="Hora de inicio">–<input type="time" data-horario="fin" value="${esc(hor.fin)}" aria-label="Hora de término">
                  · pausa <input type="number" min="0" max="240" step="5" data-horario="pausa" value="${esc(hor.pausa)}" aria-label="Pausa en minutos"> min
                  · traslado entre sectores <input type="number" min="0" max="240" step="5" data-horario="traslado" value="${esc(hor.traslado)}" aria-label="Traslado entre sectores en minutos"> min</span></div>
              ${jor && jor.util ? `<div class="vu-dias">${jor.dias.map((di, k) => { const a = di.sectores[0], b = di.sectores[di.sectores.length - 1], n = g.sectores.length;
                const rango = n > 1 ? (a === b ? nombreSector(h, a, n) : g.sectores[a].dm && g.sectores[b].dm ? `${kmADm(Math.min(...g.sectores[a].dm, ...g.sectores[b].dm))} – ${kmADm(Math.max(...g.sectores[a].dm, ...g.sectores[b].dm))}` : `${nombreSector(h, a, n)} a ${nombreSector(h, b, n)}`) : 'Área completa';
                return `<b>Día ${k + 1}${fechas[k] ? `<small>${esc(diaCorto(fechas[k]))}</small>` : ''}</b><div class="vu-dia-barra"><i style="width: ${Math.min(100, 100 * di.min / jor.util).toFixed(1)}%; background: ${colorDia(k)}"></i></div><span class="vu-dia-min${di.excede ? ' vu-rojo' : ''}">${fmtDuracion(di.min)}</span>
                  <span></span><small class="vu-dia-det">${esc(rango)} · ${di.sectores.length} sector${di.sectores.length === 1 ? '' : 'es'} · ${di.baterias} batería${di.baterias === 1 ? '' : 's'}${di.excede ? ' · <b>no cabe en el horario: divide el sector</b>' : ''}</small><span></span>`; }).join('')}</div>
                <p class="sis-tenue vu-res-nota">Cada día toma sectores completos, en orden${g.sectores.some(s => s.dm) ? ' (sentido del eje)' : ''}, hasta llenar ${fmtDuracion(jor.util)} útiles. ${h.fecha ? 'Días hábiles desde el primer día de vuelo.' : 'Pon el primer día de vuelo para ver las fechas.'}</p>
                <div class="sis-acciones"><button class="sis-btn chico${programado ? '' : ' primario'}" data-accion="programar" ${h.fecha ? '' : 'disabled'}>${programado ? `Actualizar el calendario (${h.programa.length} días)` : `Agregar ${jor.dias.length === 1 ? 'la jornada' : `las ${jor.dias.length} jornadas`} al calendario`}</button>${programado ? '<button class="sis-btn chico" data-accion="desprogramar">Quitar del calendario</button>' : ''}</div>`
                : '<p class="vu-rojo">Revisa el horario: el término debe ser después del inicio.</p>'}
            </div>` : '<p class="sis-tenue">Cuando cargues el área, aquí aparece el plan de vuelo.</p>'}
        </section>
      </div>
      <div class="vu-res-dos">
        <section class="sis-tarjeta vu-res-card">
          <div class="vu-res-tit"><h2>3 · Clima</h2><button class="vu-link" data-accion="paso" data-paso="clima">${c ? 'Ver pronóstico' : 'Consultar'} →</button></div>
          ${fechas.length ? `<div class="vu-clima-dias">${fechas.map((f, k) => { const esta = c && c.fecha === f;
            const cl = esta ? (c.ventana ? (climaObs ? 'aviso' : 'ok') : 'mal') : 'gris';
            return `<div class="vu-clima-dia ${cl}"><b>Día ${k + 1}</b><small>${esc(diaCorto(f))}</small><span>${esta ? (c.ventana ? `Ventana ${esc(c.ventana)}` : 'Sin ventana') + (c.rafaga ? ` · ráfaga ${fmt(c.rafaga.v, 1)} m/s` : '') : 'sin consultar'}</span></div>`; }).join('')}</div>` : ''}
          ${c ? `<p class="sis-tenue vu-res-nota">Consultado ${fechaHora(c.consultadoEn)} para el ${fechaLegible(c.fecha)}.${(() => { const m = resumenMetar(h.metar); return m ? ` METAR ${esc(m.icao)}: ${esc(m.categoria)}${m.viento ? ` · ${fmt(m.viento.ms, 1)} m/s` : ''}.` : ''; })()}</p>
            ${(c.checklist || []).filter(x => !x.cumple).length ? `<ul class="vu-res-obs">${c.checklist.filter(x => !x.cumple).map(x => `<li>${esc(x.texto)}: ${esc(x.detalle)}</li>`).join('')}</ul>` : ''}`
            : '<p class="sis-tenue vu-res-nota">Consulta el pronóstico de cada día de vuelo: viento a 120 m, ráfagas, lluvia, nubes, temperatura, Kp y METAR.</p>'}
        </section>
        <section class="sis-tarjeta vu-res-card">
          <div class="vu-res-tit"><h2>4 · Permisos y consultas</h2><button class="vu-link" data-accion="paso" data-paso="permisos">Abrir →</button></div>
          ${(() => { const dg = h.permisos.dgac; const et = [
              ['Enviar', dg.enviado ? `enviada ${fechaLegible(dg.enviado)}` : limiteDgac ? `antes del ${fechaLegible(limiteDgac)}` : 'mín. 7 días hábiles antes', dg.enviado ? 'ok' : (limiteDgac && limiteDgac <= hoy ? 'mal' : 'actual')],
              ['En trámite', dg.enviado && !dg.aprobado ? 'esperando respuesta' : '', dg.aprobado ? 'ok' : dg.enviado ? 'actual' : ''],
              ['Aprobada', dg.aprobado ? (dg.vence ? `hasta ${fechaLegible(dg.vence)}` : 'sin término') : '', dg.aprobado ? 'ok' : ''],
              ['Vuelo', h.fecha ? fechaLegible(h.fecha) : 'sin fecha', ''],
            ]; return `<div class="vu-etapas">${et.map(([a, b, e]) => `<div class="vu-etapa ${e}"><b>${a}</b><small>${esc(b)}</small></div>`).join('')}</div>`; })()}
          <div class="vu-res-chips">${CONSULTAS.map(([k, tt]) => { const x = ultimaConsulta(h, k); return chip(`${tt.split(/[:(]/)[0].trim()} · ${x ? `revisado ${fechaLegible(x.fecha.slice(0, 10))}` : 'pendiente'}`, x ? 'verde' : 'gris'); }).join('')}
            ${chip(`Documentos ${DOCUMENTOS_DGAC.filter(([k]) => h.permisos.docs[k]).length}/${DOCUMENTOS_DGAC.length}`, DOCUMENTOS_DGAC.every(([k]) => h.permisos.docs[k]) ? 'verde' : 'gris')}</div>
          <p class="sis-tenue vu-res-nota">La fecha límite sale de la regla de 7 días hábiles antes del primer día de vuelo.</p>
        </section>
      </div>`;
  }
  const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const diaCorto = iso => { const [y, m, dd] = iso.split('-').map(Number); return `${DIAS_SEM[new Date(y, m - 1, dd, 12).getDay()]} ${dd}-${String(m).padStart(2, '0')}`; };

  return { vistaHojas, encabezadoHoja, vistaResumen, ultimaConsulta };
}
