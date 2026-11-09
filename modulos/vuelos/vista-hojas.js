// modulos/vuelos/vista-hojas.js — lista de hojas de vuelo, encabezado de la hoja y Resumen.

import { fondoEstatico } from './mapa-estatico.js';
import { COLORES_DIA } from './ui.js';
import { escapar as esc, fechaLegible } from '../../compartido/util.js';
import { fmt, fmtDuracion } from './calculo.js';
import { chip, kpi, fechaHora, dosD } from './ui.js';
import { OFICINA_ID } from '../../compartido/catalogos.js';
import { totales, estadoPermiso, nombreSector, CONSULTAS, jornadasNecesarias, HORARIO_INICIAL, kmADm, etapaVuelo, ETAPAS_VUELO, NOMBRE_ETAPA_VUELO, documentosPermiso } from './hoja.js';
import { pedirPronostico, pedirKp } from './pronostico.js';
import { analizarDia as analizarDiaPron } from './pronostico-widget.js';
import { textoUbicacion } from './ubicacion.js';
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
  const render = ref('render');

  const opcionesProyectos = sel => `<option value="">Sin proyecto</option>` + base.proyectos.map(p => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.id === OFICINA_ID ? 'Oficina' : p.nombre)}</option>`).join('');

  // ─────────── Resumen de vuelos (v0.11): estados, tarjeta desplegada con «Abrir vuelo» y pronóstico al costado ───────────
  const centroHoja = h => {
    if (h.resumen && h.resumen.centro) return h.resumen.centro;
    const pts = (h.area && ((h.area.original && h.area.original.anillo) || (h.area.eje && h.area.eje.linea))) || [];
    if (!pts.length) return null;
    return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
  };
  const proximaFecha = h => { const hoy = new Date().toISOString().slice(0, 10); const dias = (h.programa && h.programa.length ? h.programa.map(x => x.fecha) : [h.fecha]).filter(Boolean).sort(); return dias.find(f => f >= hoy) || dias[dias.length - 1] || null; };

  async function pronosticoLateral(h) {
    const c = centroHoja(h);
    if (!c) { st.pronLista = { id: h.id, sinArea: true }; return; }
    st.pronLista = { id: h.id, cargando: true };
    try {
      const [p, kps] = await Promise.all([pedirPronostico(c[1], c[0], 1), st.kps ? Promise.resolve(st.kps) : pedirKp()]);
      st.kps = kps;
      const d = base.drones.find(x => x.id === h.dronId) || base.drones[0];
      const dia = p.horas[0] ? p.horas[0].fecha : null;
      st.pronLista = { id: h.id, p, a: dia ? analizarDiaPron(p, d, kps, dia) : null, d };
    } catch (e) { st.pronLista = { id: h.id, error: 'Sin conexión para el pronóstico.' }; }
    if (st.vista === 'hojas') render();
  }

  function htmlPronLateral(h) {
    const x = st.pronLista;
    const lugar = (h.ubicacion && textoUbicacion(h.ubicacion)) || nomProy(h.proyectoId);
    let cuerpo;
    if (!x || x.id !== h.id) { pronosticoLateral(h); cuerpo = '<p class="sis-tenue">Consultando el pronóstico…</p>'; }
    else if (x.sinArea) cuerpo = '<p class="sis-tenue">Este vuelo aún no tiene área: el pronóstico aparece al cargarla.</p>';
    else if (x.cargando) cuerpo = '<p class="sis-tenue">Consultando el pronóstico…</p>';
    else if (x.error) cuerpo = `<p class="sis-tenue">${esc(x.error)}</p>`;
    else {
      const f = x.a.filas, ahora = new Date().getHours();
      const fNow = f.find(r => r.h.hora === ahora) || f[0];
      const conLuz = f.filter(r => r.ev.estado !== 'noche');
      const vMax = Math.max(...conLuz.map(r => r.h.v || 0)), gMax = Math.max(...conLuz.map(r => r.h.g || 0));
      const temps = f.map(r => r.h.temp).filter(t => t != null);
      const col = { go: '#A7D7C5', marg: '#F3C9A0', no: '#E8A08A', noche: '#D9DCE0' };
      cuerpo = `<div class="vu-pl-temp"><b>${fNow && fNow.h.temp != null ? fmt(fNow.h.temp, 0) + '°' : '—'}</b><span>${temps.length ? `mín ${fmt(Math.min(...temps), 0)}° · máx ${fmt(Math.max(...temps), 0)}°` : ''}</span></div>
        <div class="vu-pl-grilla">
          <div class="${vMax > x.d.vientoMaxMs * 0.8 ? 'alerta' : ''}"><small>Viento 120 m (máx.)</small><b>${fmt(vMax, 1)} m/s</b></div>
          <div class="${gMax > x.d.rafagaMaxMs * 0.8 ? 'alerta' : ''}"><small>Ráfaga (máx.)</small><b>${fmt(gMax, 1)} m/s</b></div>
          <div><small>Índice Kp</small><b>${x.a.kpMax != null ? fmt(x.a.kpMax, 0) : '—'}</b></div>
          <div><small>Luz útil</small><b>${x.a.sol && x.a.sol.salida ? `${x.a.sol.salida.slice(11, 16)}–${(x.a.sol.puesta || '').slice(11, 16)}` : '—'}</b></div>
        </div>
        <div class="vu-pl-horas" role="img" aria-label="Estado por hora: verde se puede volar, naranjo marginal, rojo no">${f.map(r => `<i style="background:${col[r.ev.estado]}" title="${dosD(r.h.hora)}:00 · ${esc(r.ev.estado === 'go' ? 'GO' : r.ev.estado === 'marg' ? 'marginal' : r.ev.estado === 'no' ? 'NO' : 'noche')}${r.ev.motivos.length ? ' · ' + esc(r.ev.motivos.join(', ')) : ''}"></i>`).join('')}</div>
        <div class="vu-pl-eje"><span>00 h</span><span>12 h</span><span>23 h</span></div>
        <p class="vu-pl-ventana">${x.a.ventana ? `Ventana GO <b>${dosD(x.a.ventana[0])}:00 – ${dosD(x.a.ventana[1] + 1)}:00</b>` : '<b class="vu-rojo">Sin ventana GO hoy</b>'}</p>`;
    }
    return `<aside class="sis-tarjeta vu-pron-lateral"><small class="sis-tenue">Pronóstico de hoy · vuelo seleccionado</small><h2>${esc(lugar)}</h2>${cuerpo}
      <p class="sis-tenue">Límites del ${esc((base.drones.find(y => y.id === h.dronId) || {}).familiaNombre || 'dron')}. Al elegir otro vuelo, cambia el lugar.</p></aside>`;
  }

  function vistaHojas() {
    const filtroProy = h => !st.filtroProyecto || h.proyectoId === st.filtroProyecto;
    const todas = base.hojas.filter(filtroProy).filter(h => st.verProcesados || etapaVuelo(h) !== 'procesado');
    const cuenta = Object.fromEntries(ETAPAS_VUELO.map(([k]) => [k, base.hojas.filter(filtroProy).filter(h => etapaVuelo(h) === k).length]));
    const lista = todas.filter(h => !st.filtroEtapa || etapaVuelo(h) === st.filtroEtapa)
      .sort((a, b) => (proximaFecha(a) || '9999').localeCompare(proximaFecha(b) || '9999'));
    const sel = lista.find(h => h.id === st.selHoja) || lista[0];
    const claseEt = Object.fromEntries(ETAPAS_VUELO.map(([k, , c]) => [k, c]));
    const tarjeta = h => {
      const r = h.resumen || {}, et = etapaVuelo(h), abierta = sel && h.id === sel.id, f = proximaFecha(h);
      const etapas = ETAPAS_VUELO.map(([k, t], i) => { const iAct = ETAPAS_VUELO.findIndex(e => e[0] === et); return `<span class="${i < iAct ? 'hecho' : i === iAct ? 'actual' : ''}">${t}</span>`; }).join('');
      if (!abierta) return `<button type="button" class="vu-vuelo" data-accion="sel-vuelo" data-id="${esc(h.id)}">
          <span class="vu-vuelo-txt"><b>${esc(h.nombre || 'Vuelo sin nombre')}</b><small>${esc([nomProy(h.proyectoId), (base.drones.find(d => d.id === h.dronId) || {}).familiaNombre, r.area ? `${fmt(r.area / 10000, 1)} ha` : '', textoUbicacion(h.ubicacion)].filter(Boolean).join(' · '))}</small></span>
          ${chip(NOMBRE_ETAPA_VUELO[et], claseEt[et])}<small class="vu-vuelo-fecha">${f ? esc(diaCorto(f)) : 'sin fecha'}</small></button>`;
      const perm = estadoPermiso(h);
      return `<article class="vu-vuelo abierto">
          <div class="vu-vuelo-cab"><span class="vu-vuelo-txt"><b>${esc(h.nombre || 'Vuelo sin nombre')}</b><small>${esc([nomProy(h.proyectoId), h.mandante, (base.drones.find(d => d.id === h.dronId) || {}).familiaNombre, r.modo === 'lidar' ? 'LiDAR' : 'Fotogrametría', r.gsd ? `GSD ${fmt(r.gsd, 2)} cm` : ''].filter(Boolean).join(' · '))}</small></span>${chip(NOMBRE_ETAPA_VUELO[et], claseEt[et])}</div>
          <div class="vu-etapas-vuelo">${etapas}</div>
          <div class="vu-vuelo-datos">
            <div><small>Ubicación</small><b>${esc(textoUbicacion(h.ubicacion) || '—')}</b></div>
            <div><small>${r.corredor ? 'Corredor' : 'Superficie'}</small><b>${r.area ? `${fmt(r.area / 10000, 1)} ha${r.largo ? ` · ${fmt(r.largo / 1000, 1)} km` : ''}` : '—'}${r.sectores > 1 ? ` · ${r.sectores} sectores` : ''}</b></div>
            <div><small>Próxima jornada</small><b>${f ? esc(diaCorto(f)) : 'sin fecha'}${h.programa && h.programa.length > 1 ? ` · ${h.programa.length} días` : ''}</b></div>
            <div><small>Permiso DGAC</small><b>${esc(perm.texto)}</b></div>
          </div>
          <div class="vu-vuelo-acc"><button type="button" class="sis-btn primario vu-abrir" data-accion="abrir-hoja" data-id="${esc(h.id)}">Abrir vuelo</button>
            <button type="button" class="sis-btn chico peligro" data-accion="eliminar-hoja" data-id="${esc(h.id)}">Eliminar</button></div>
        </article>`;
    };
    return `<div class="sis-cab"><h1>Vuelos</h1><button class="sis-btn primario" data-accion="nueva-hoja">Planificación</button></div>
      <p class="sis-tenue">Los vuelos que se están realizando o que hay que hacer, con su estado. «Planificación» arma un vuelo nuevo paso a paso.</p>
      <div class="vu-filtros">
        <div class="vu-chips-filtro" role="group" aria-label="Filtrar por estado">
          <button type="button" class="vu-chip-f${!st.filtroEtapa ? ' activo' : ''}" data-accion="filtro-etapa" data-e="">Todos ${todas.length}</button>
          ${ETAPAS_VUELO.filter(([k]) => k !== 'procesado' || st.verProcesados).map(([k, t]) => `<button type="button" class="vu-chip-f${st.filtroEtapa === k ? ' activo' : ''}" data-accion="filtro-etapa" data-e="${k}">${t} ${cuenta[k]}</button>`).join('')}
        </div>
        <label class="sis-campo vu-filtro"><span>Proyecto</span><select data-campo="filtroProyecto"><option value="">Todos</option>${base.proyectos.map(p => `<option value="${esc(p.id)}" ${p.id === st.filtroProyecto ? 'selected' : ''}>${esc(p.id === OFICINA_ID ? 'Oficina' : p.nombre)}</option>`).join('')}</select></label>
        <label class="sis-check"><input type="checkbox" data-campo="verProcesados" ${st.verProcesados ? 'checked' : ''}> Mostrar procesados (${cuenta.procesado})</label>
      </div>
      <div class="vu-resumen-vuelos">
        <div class="vu-lista-vuelos">${lista.length ? lista.map(tarjeta).join('') : `<div class="sis-vacio"><p>${base.hojas.length ? 'No hay vuelos con este filtro.' : 'Todavía no hay vuelos. Toca «Planificación» y carga el KMZ del área.'}</p></div>`}</div>
        ${sel ? htmlPronLateral(sel) : ''}
      </div>
      ${base.papelera.length ? `<details class="sis-papelera"><summary>Papelera de vuelos (${base.papelera.length})</summary>
        <section class="sis-tarjeta"><div class="sis-lista">${base.papelera.map(h => `<div class="sis-fila">
          <span class="sis-fila-txt"><b>${esc(h.nombre || 'Vuelo sin nombre')}</b><span class="sis-tenue">${esc(nomProy(h.proyectoId))} · eliminado ${esc(String(h.eliminadoEn || '').slice(0, 10))}</span></span>
          <button class="sis-btn chico" data-accion="restaurar-hoja" data-id="${esc(h.id)}">Restaurar</button>
          <button class="sis-btn chico peligro" data-accion="purgar-hoja" data-id="${esc(h.id)}" data-nombre="${esc(h.nombre || 'Vuelo sin nombre')}">Eliminar definitivamente</button></div>`).join('')}</div>
          ${base.papelera.length > 1 ? `<button class="sis-btn chico peligro" data-accion="vaciar-papelera-vuelos">Vaciar la papelera (${base.papelera.length})</button>` : ''}</section></details>` : ''}`;
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
      identificacion: faltantes('identificacion').length ? (h.nombre ? 'aviso' : '') : 'ok',
      area: g ? (g.fallidos.length ? 'aviso' : 'ok') : '',
      vuelo: t ? (t.excede ? 'aviso' : 'ok') : '',
      clima: c ? (climaObs ? 'aviso' : 'ok') : '',
      permisos: perm.nivel === 'ok' && consultasHechas(h) && !faltantes('permisos').length ? 'ok' : (h.permisos.dgac.preparado || h.permisos.consultas.length || Object.keys(h.permisos.docsEstado || {}).length ? 'aviso' : ''),
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
        <div class="sis-acciones">${chip(NOMBRE_ETAPA_VUELO[etapaVuelo(h)], (ETAPAS_VUELO.find(e => e[0] === etapaVuelo(h)) || [])[2] || 'gris')}
          <button class="sis-btn chico" data-accion="imprimir" ${g ? '' : 'disabled'}>Hoja para terreno (PDF)</button>
          ${h.estado === 'borrador' ? '<button class="sis-btn chico primario" data-accion="estado" data-e="lista">Programar</button>'
            : h.estado === 'lista' ? '<button class="sis-btn chico primario" data-accion="estado" data-e="volada">Marcar volado</button><button class="sis-btn chico" data-accion="estado" data-e="borrador">Volver a planificación</button>'
            : h.procesado ? '<button class="sis-btn chico" data-accion="procesado" data-v="0">Quitar «procesado»</button>'
            : `${(h.permisos.logs || []).length ? '' : '<button class="sis-btn chico primario" data-accion="paso" data-paso="permisos">Cargar log</button>'}<button class="sis-btn chico${(h.permisos.logs || []).length ? ' primario' : ''}" data-accion="procesado" data-v="1">Marcar procesado</button><button class="sis-btn chico" data-accion="estado" data-e="lista">Volver a programado</button>`}
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
      <nav class="vu-pasos vu-stepper" aria-label="Pasos de la planificación">
        <button class="vu-paso vu-paso-res${st.paso === 'resumen' ? ' activo' : ''}" data-accion="paso" data-paso="resumen">Resumen</button>
        ${PASOS.map(([k, t], n) => { const mk = marcas[k]; return `<button class="vu-paso${st.paso === k ? ' activo' : ''} ${mk || 'pend'}" data-accion="paso" data-paso="${k}" ${st.paso === k ? 'aria-current="step"' : ''}><span class="vu-paso-n">${mk === 'ok' ? '✓' : mk === 'aviso' ? '!' : n + 1}</span>${t.replace(/^\d · /, '')}</button>`; }).join('')}</nav>`;
  }

  // ─────────── Resumen (v0.10): avance, área con cinta, jornadas necesarias, clima por jornada y plazo DGAC ───────────
  const colorDia = k => COLORES_DIA[k % COLORES_DIA.length];

  /** Miniatura SVG del área con cada sector pintado según la jornada en que se vuela. */
  function miniatura(g, diaDe) {
    const todos = g.sectores.flatMap(s => s.poligono);
    if (!todos.length) return '';
    // v0.11.3: sobre imagen híbrida fija (Esri), sin mover ni hacer zoom. Sin internet queda el esquema sobre gris.
    const W = 700, H = 260, aLL = g.marco.aLonLat;
    const f = fondoEstatico(todos.map(aLL), W, H, { margen: 18 });
    const pt = p => f.xy(aLL(p)).map(x => x.toFixed(1)).join(',');
    const poli = (s, i) => { const paso = Math.max(1, Math.ceil(s.poligono.length / 400)); return `<polygon points="${s.poligono.filter((_, j) => j % paso === 0).map(pt).join(' ')}" fill="${colorDia(diaDe[i] ?? 0)}" fill-opacity=".35" stroke="${colorDia(diaDe[i] ?? 0)}" stroke-width="3" stroke-linejoin="round"><title>${esc(nombreSector(st.hoja, i, g.sectores.length))}</title></polygon>`; };
    return `<div class="vu-mapa-fijo" style="aspect-ratio: ${W} / ${H}"><div class="vu-mapa-fijo-teselas" aria-hidden="true">${f.html}</div>
      <svg class="vu-res-mapa" viewBox="0 0 ${W} ${H}" role="img" aria-label="Esquema del área con sus sectores sobre imagen satelital">${g.sectores.map(poli).join('')}</svg>
      <small class="vu-mapa-fijo-atr">Imagen © Esri, Maxar</small></div>`;
  }

  /** v0.11.3: baterías de una jornada, en orden, con sector, minutos y traslado. */
  function htmlBateriasDia(h, g, t, di) {
    const filas = [];
    let n = 0;
    for (const i of di.sectores) {
      const r = t.sectores[i];
      if (!r || !r.baterias) continue;
      r.baterias.forEach((b, k) => { n++; filas.push(`<li><b>B${n}</b><span>${esc(nombreSector(h, i, g.sectores.length))}${r.baterias.length > 1 ? ` · ${k + 1}/${r.baterias.length}` : ''}</span><span class="vu-mono">${fmtDuracion(b.seg / 60)}</span><small>${b.traslado ? `incluye ${fmtDuracion(b.traslado / 60)} de ida y vuelta` : ''}${b.excede ? ' · <b class="vu-rojo">no alcanza</b>' : ''}</small></li>`); });
    }
    return filas.length ? `<details class="vu-bat-dia"><summary>Ver las ${filas.length} batería${filas.length === 1 ? '' : 's'}</summary><ol>${filas.join('')}</ol></details>` : '<span></span>';
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
                  <span></span><small class="vu-dia-det">${esc(rango)} · ${di.sectores.length} sector${di.sectores.length === 1 ? '' : 'es'} · ${di.baterias} batería${di.baterias === 1 ? '' : 's'}${di.excede ? ' · <b>no cabe en el horario: divide el sector</b>' : ''}</small><span></span>
                  <span></span>${htmlBateriasDia(h, g, t, di)}<span></span>`; }).join('')}</div>
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
            ${(() => { const ds = documentosPermiso(h), listos = ds.filter(x => x.listo).length; return chip(`Documentos ${listos}/${ds.length}`, listos === ds.length ? 'verde' : 'gris'); })()}</div>
          <p class="sis-tenue vu-res-nota">La fecha límite sale de la regla de 7 días hábiles antes del primer día de vuelo.</p>
        </section>
      </div>`;
  }
  // ─────────── Paso 1 · Identificación (v0.11) ───────────
  const proyectoDe = h => base.proyectos.find(p => p.id === h.proyectoId) || null;
  function vistaIdentificacion() {
    const h = st.hoja, p = proyectoDe(h);
    return `<section class="sis-tarjeta vu-identif"><h2>¿Qué se vuela y quién lo encargó?</h2>
        <div class="vu-datos-grilla">
          <label class="sis-campo vu-ancho"><span>Nombre del proyecto o vuelo *</span><input data-hoja="nombre" value="${esc(h.nombre)}" placeholder="Planta Norte — vuelo 1"></label>
          <label class="sis-campo"><span>Proyecto</span><select data-hoja="proyectoId">${opcionesProyectos(h.proyectoId)}</select></label>
          <label class="sis-campo"><span>Mandante *</span><input data-identif="mandante" value="${esc(h.mandante || '')}" placeholder="${esc((p && p.mandante) || 'Empresa que encarga el trabajo')}"></label>
          <label class="sis-campo"><span>Jefe que encargó el trabajo *</span><input data-identif="jefe" value="${esc(h.jefe || '')}" placeholder="${esc((p && p.solicitadoPor) || 'Nombre y cargo')}"></label>
          <label class="sis-campo"><span>Primer día de vuelo</span><input type="date" data-hoja="fecha" value="${esc(h.fecha || '')}"></label>
          <label class="sis-campo"><span>Piloto</span><select data-hoja="pilotoId"><option value="">—</option>${base.personas.map(x => `<option value="${esc(x.id)}" ${x.id === h.pilotoId ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>
        </div>
        <p class="sis-tenue">Al elegir el proyecto se completan el mandante y quien lo encargó desde su ficha. Se pueden cambiar para este vuelo.</p>
      </section>`;
  }

  /** Datos importantes que faltan en un paso (no bloquean: solo se avisan). */
  function faltantes(paso) {
    const h = st.hoja, g = geo(), d = dron(), out = [];
    if (paso === 'identificacion') {
      if (!h.nombre) out.push('el nombre del proyecto o vuelo');
      if (!h.mandante && !(proyectoDe(h) || {}).mandante) out.push('el mandante');
      if (!h.jefe && !(proyectoDe(h) || {}).solicitadoPor) out.push('quién encargó el trabajo');
      if (!h.fecha) out.push('el primer día de vuelo');
      if (!h.pilotoId) out.push('el piloto');
    } else if (paso === 'area') {
      if (!g) out.push('el área (KMZ, KML o dibujada)');
      else {
        if (!(h.ubicacion && (h.ubicacion.comuna || h.ubicacion.region))) out.push('la comuna y la región');
        if (g.fallidos.length) out.push('revisar los cortes que no cruzan el área');
        const t = d ? totales(h, d, g) : null;
        if (t && g.sectores.length === 1 && (t.baterias > 6 || t.excede)) out.push('dividir el área en sectores (es grande)');
      }
    } else if (paso === 'vuelo') {
      const t = g && d ? totales(h, d, g) : null;
      if (!t) out.push('el área');
      else if (t.excede) out.push('acercar el despegue o dividir: hay tramos que no alcanzan con una batería');
    } else if (paso === 'clima') {
      if (!h.clima) out.push('consultar el pronóstico del día de vuelo');
      else if (h.clima.checklist && h.clima.checklist.some(x => !x.cumple)) out.push('revisar el checklist del clima');
    } else if (paso === 'permisos') {
      const pend = documentosPermiso(h).filter(x => !x.listo).length;
      if (pend) out.push(`${pend} documento${pend === 1 ? '' : 's'} de la solicitud`);
      if (!h.permisos.dgac.enviado && !h.permisos.dgac.aprobado) out.push('enviar la solicitud a la DGAC');
      if (h.estado === 'volada' && !(h.permisos.logs || []).length) out.push('cargar el log del vuelo');
    }
    return out;
  }

  function pieDePaso() {
    const k = PASOS.findIndex(([p]) => p === st.paso);
    if (k < 0) return '';
    const falta = faltantes(st.paso), ant = PASOS[k - 1], sig = PASOS[k + 1];
    return `<div class="vu-pie-paso${falta.length ? ' con-aviso' : ''}">
      <div class="vu-pie-aviso">${falta.length ? `<b>Falta información importante:</b> ${esc(falta.join(' · '))}. Puedes seguir y completarla después.` : '<span class="vu-verde">✓ Paso completo</span>'}</div>
      <div class="sis-acciones">${ant ? `<button class="sis-btn" data-accion="paso" data-paso="${ant[0]}">← Anterior</button>` : '<button class="sis-btn" data-accion="paso" data-paso="resumen">← Resumen</button>'}
        ${sig ? `<button class="sis-btn primario" data-accion="paso" data-paso="${sig[0]}">Siguiente: ${esc(sig[1].replace(/^\d · /, ''))} →</button>` : '<button class="sis-btn primario" data-accion="paso" data-paso="resumen">Terminar: ver resumen</button>'}</div>
    </div>`;
  }

  const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const diaCorto = iso => { const [y, m, dd] = iso.split('-').map(Number); return `${DIAS_SEM[new Date(y, m - 1, dd, 12).getDay()]} ${dd}-${String(m).padStart(2, '0')}`; };

  return { vistaHojas, encabezadoHoja, vistaResumen, ultimaConsulta, vistaIdentificacion, pieDePaso, faltantes };
}
