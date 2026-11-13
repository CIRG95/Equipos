// modulos/administracion/pantallas-admin.js — Administración (Sistema v0.15): vehículos y su acreditación por mandante
// (SUCAL), viajes, fondos por rendir (lectura desde Gastos), guías de despacho, mandantes y configuración común.
// Rutas: #/administracion[/vehiculos] · #/administracion/vehiculo/<id> · /acreditacion · /viajes · /fondos · /guias · /mandantes · /configuracion

import { hoyISO } from '../../compartido/util.js';
import { ALM, guardarRegistro, guardarConfig, aPapelera } from './datos.js';
import {
  tiposDe, acreditacion, estadoDocumentos, ESTADOS_GUIA, ESTADOS_VIAJE, ESTADOS_PLATAFORMA,
} from './modelo.js';
import { esc, fechaLegible, vacio, plural, chipVenc, chipHab, chipPlataforma, pestanas, campo, input, fecha, select, firmaCambio } from './ui.js';
import { tablaDocumentos } from './pantallas-personal.js';
import { ESTADOS_VENC } from '../../compartido/vencimientos.js';

export const PESTANAS_ADMIN = [
  ['vehiculos', 'Vehículos', '#/administracion/vehiculos'], ['acreditacion', 'Acreditación de vehículos', '#/administracion/acreditacion'],
  ['viajes', 'Viajes', '#/administracion/viajes'], ['fondos', 'Fondos por rendir', '#/administracion/fondos'], ['guias', 'Guías de despacho', '#/administracion/guias'],
  ['mandantes', 'Mandantes', '#/administracion/mandantes'], ['configuracion', 'Configuración', '#/administracion/configuracion'],
];
const cab = (activa, extra = '') => `<div class="sis-cab"><div><h1>Administración</h1><span class="sis-tenue">Gestión de vehículos, viajes, fondos por rendir, guías de despacho y mandantes. Cada registro se asocia a un proyecto o a «Oficina».</span></div>${extra}</div>${pestanas(PESTANAS_ADMIN, activa)}`;
const nomProy = (v, id) => (id === 'oficina' ? 'Oficina' : (v.st.proyectos.find(p => p.id === id) || {}).nombre || 'Sin proyecto');
const base = v => ({ ...v.st.d, hoy: hoyISO(), diasAviso: v.st.d.config.diasAviso });
const peor = filas => filas.reduce((m, f) => (!f.doc && !f.tipo.obligatorio ? m : (ESTADOS_VENC[f.e.estado].orden < ESTADOS_VENC[m.estado].orden ? f.e : m)), { estado: 'vigente', dias: null });
const opcionesProyectos = v => v.st.proyectos.filter(p => p.estado !== 'cerrado').map(p => [p.id, p.nombre]);

// ─────────────────────────── Vehículos ───────────────────────────
export function vehiculos(v) {
  const vs = v.st.d.vehiculos.slice().sort((a, b) => a.patente.localeCompare(b.patente));
  const editar = v.st.editVehiculo === 'nuevo';
  return `${cab('vehiculos', `<button type="button" class="sis-btn primario" data-a="vehiculo-nuevo">+ Vehículo</button>`)}
    ${editar ? formVehiculo(v, {}) : ''}
    <section class="sis-tarjeta">${vs.length ? `<div class="sis-lista">${vs.map(x => {
      const filas = estadoDocumentos('vehiculo', x.id, base(v)), e = peor(filas);
      return `<a class="sis-fila" href="#/administracion/vehiculo/${esc(x.id)}"><span class="sis-fila-txt"><b class="mono">${esc(x.patente)}</b><span class="sis-tenue">${esc([x.marca, x.modelo, x.anio].filter(Boolean).join(' '))}${x.proyectoId ? ` · ${esc(nomProy(v, x.proyectoId))}` : ' · Oficina'}${x.kmProximaMantencion && x.km ? ` · mantención en ${Math.max(0, x.kmProximaMantencion - x.km).toLocaleString('es-CL')} km` : ''}</span></span>
        <span class="sis-chips">${e.estado === 'vigente' ? '<span class="sis-chip verde">Documentos al día</span>' : chipVenc(e)}</span></a>`;
    }).join('')}</div>` : vacio('Aún no hay vehículos registrados. Agregue el primero con «+ Vehículo».')}</section>
    <p class="sis-tenue">Los vencimientos de los vehículos se controlan con los mismos criterios aplicados a personas y equipos, y aparecen en Inicio y en el Calendario.</p>`;
}

function formVehiculo(v, x) {
  return `<section class="sis-tarjeta"><h2>${x.id ? 'Datos del vehículo' : 'Nuevo vehículo'}</h2>
    <form class="sis-form" data-f="vehiculo" data-id="${esc(x.id || '')}">
      <div class="sis-par">${campo('Patente *', input('patente', x.patente, 'required maxlength="10" style="text-transform:uppercase"'))}${campo('Marca', input('marca', x.marca))}${campo('Modelo', input('modelo', x.modelo))}</div>
      <div class="sis-par">${campo('Año', input('anio', x.anio, 'type="number" min="1990" max="2100"'))}${campo('Kilometraje actual', input('km', x.km, 'type="number" min="0"'))}${campo('Próxima mantención (km)', input('kmProximaMantencion', x.kmProximaMantencion, 'type="number" min="0"'))}</div>
      ${campo('Proyecto asignado', select('proyectoId', opcionesProyectos(v), x.proyectoId, { vacio: 'Oficina (sin proyecto)' }))}
      <div class="sis-acciones"><button class="sis-btn primario">Guardar</button>${x.id ? '' : '<button type="button" class="sis-btn" data-a="vehiculo-cancelar">Cancelar</button>'}${x.id ? `<button type="button" class="sis-btn peligro" data-a="vehiculo-borrar" data-id="${esc(x.id)}">Eliminar vehículo</button>` : ''}</div>
    </form></section>`;
}

export function vehiculo(v, id) {
  const x = v.st.d.vehiculos.find(y => y.id === id);
  if (!x) return `${cab('vehiculos')}${vacio('Este vehículo no existe.')}`;
  const ms = v.st.d.mandantes.filter(m => (m.requisitosVehiculo || []).length);
  return `${cab('vehiculos')}<div class="sis-miga"><a href="#/administracion/vehiculos">Vehículos</a> / <span class="mono">${esc(x.patente)}</span></div>
    <div class="sis-dos"><div>${tablaDocumentos(v, 'vehiculo', x.id)}</div><aside>
      <section class="sis-tarjeta"><h2>Acreditación por mandante</h2>${ms.length ? `<div class="sis-lista">${ms.map(m => { const h = acreditacion(m, 'vehiculo', x.id, base(v)); return `<a class="sis-fila" href="#/administracion/acreditacion/${esc(m.id)}/${esc(x.id)}"><span class="sis-fila-txt"><b>${esc(m.nombre)}</b><span class="sis-tenue">${esc(m.plataforma || '')}${h.pendientes.length ? ` · ${plural(h.pendientes.length, 'requisito pendiente', 'requisitos pendientes')}` : ''}</span></span><span class="sis-chips">${chipHab(h, { si: 'Habilitada', no: 'No habilitada', aviso: 'Habilitada · revisar fechas' })}</span></a>`; }).join('')}</div>` : vacio('Ningún mandante tiene requisitos de vehículos definidos.')}</section>
      ${formVehiculo(v, x)}
    </aside></div>${firmaCambio(x, v.nomPers)}`;
}

// ─────────────────────────── Acreditación de vehículos ───────────────────────────
export function acreditacionVehiculos(v, mandanteId, vehiculoId) {
  const ms = v.st.d.mandantes.filter(m => (m.requisitosVehiculo || []).length);
  if (!ms.length) return `${cab('acreditacion')}${vacio('Ningún mandante tiene requisitos de vehículos. Defínalos en Mandantes.')}`;
  const m = ms.find(x => x.id === mandanteId) || ms[0];
  const vs = v.st.d.vehiculos.slice().sort((a, b) => a.patente.localeCompare(b.patente));
  if (!vs.length) return `${cab('acreditacion')}${vacio('Aún no hay vehículos registrados.', '<a class="sis-btn" href="#/administracion/vehiculos">Ir a Vehículos</a>')}`;
  const hs = vs.map(x => acreditacion(m, 'vehiculo', x.id, base(v)));
  const sel = vs.find(x => x.id === vehiculoId) || vs[0], hsel = hs[vs.indexOf(sel)];
  const celda = f => {
    const e = f.e;
    if (e.estado === 'opcional') return '<span class="sis-chip gris">No subido · opcional</span>';
    if (f.plataforma === 'rechazado') return '<span class="sis-chip rojo">Rechazado</span>';
    if (['vencido', 'falta'].includes(e.estado)) return chipVenc(e);
    if (e.estado === 'pendiente') return '<span class="sis-chip ambar">Borrador</span>';
    if (e.estado === 'por_vencer') return chipVenc(e);
    return f.plataforma === 'aprobado' ? '<span class="sis-chip verde">Aprobado</span>' : '<span class="sis-chip verde">Vigente</span>';
  };
  const resultado = h => chipHab(h, { si: 'Habilitada', no: 'No habilitada', aviso: 'Habilitada · revisar fechas' });
  return `${cab('acreditacion')}
    <div class="sis-cab"><p class="sis-tenue">Seleccione el mandante para revisar los requisitos de acreditación vehicular. Los requisitos se definen en la ficha de cada mandante.</p>
      <div class="ad-segmento" role="group" aria-label="Mandante">${ms.map(x => `<a href="#/administracion/acreditacion/${esc(x.id)}" class="${x.id === m.id ? 'activo' : ''}">${esc(x.nombre)}${x.plataforma ? ` · ${esc(x.plataforma)}` : ''}</a>`).join('')}</div></div>
    <section class="sis-tarjeta"><h2>Resumen · ${esc(m.nombre)}</h2>
      <div class="sis-tabla-scroll"><table class="sis-tabla ad-matriz"><thead><tr><th>Documento</th><th>Obligatorio</th>${vs.map(x => `<th><a class="ad-patente${x.id === sel.id ? ' activo' : ''}" href="#/administracion/acreditacion/${esc(m.id)}/${esc(x.id)}">${esc(x.patente)}</a></th>`).join('')}</tr></thead>
      <tbody>${hs[0].filas.map((f0, k) => `<tr><td>${esc(f0.tipo.nombre)}</td><td>${f0.tipo.obligatorio ? 'Sí' : 'No'}</td>${hs.map(h => `<td>${celda(h.filas[k])}</td>`).join('')}</tr>`).join('')}
      <tr class="ad-resultado"><td><b>Resultado</b></td><td></td>${hs.map(h => `<td>${resultado(h)}</td>`).join('')}</tr></tbody></table></div></section>
    <section class="sis-tarjeta"><div class="sis-cab"><h2>Detalle · camioneta <span class="mono">${esc(sel.patente)}</span> en ${esc(m.nombre)}</h2><a class="sis-btn chico" href="#/administracion/vehiculo/${esc(sel.id)}">Actualizar documentos</a></div>
      <p class="sis-tenue">Seleccione una patente en el resumen para ver su detalle. Las fechas y el estado se registran según la plataforma del mandante; el archivo se almacena en la nube y corresponde al mismo documento cargado en dicha plataforma.</p>
      <div class="sis-tabla-scroll"><table class="sis-tabla"><thead><tr><th>Documento</th><th>Inicio</th><th>Término</th><th>Estado en ${esc(m.plataforma || m.nombre)}</th><th>Vigencia</th><th>Actualizado</th></tr></thead>
      <tbody>${hsel.filas.map(f => `<tr><td>${esc(f.tipo.nombre)}</td><td class="mono">${f.doc && f.doc.inicio ? fechaLegible(f.doc.inicio) : '—'}</td><td class="mono">${f.doc && f.doc.vence ? fechaLegible(f.doc.vence) : '—'}</td><td>${chipPlataforma(f.plataforma)}</td><td>${f.doc ? chipVenc(f.e, { conDias: true }) : chipVenc(f.e)}</td><td class="mono sis-tenue">${f.doc && f.doc.actualizadoEn ? fechaLegible(f.doc.actualizadoEn.slice(0, 10)) : '—'}</td></tr>`).join('')}</tbody></table></div>
      <p class="sis-tenue">Se controlan dos estados de forma independiente: el estado en la plataforma del mandante (aprobado, borrador o rechazado) y la vigencia según la fecha de término. Un documento obligatorio en borrador se considera pendiente. El conductor también debe estar acreditado; esta condición se revisa en la ficha de cada persona.</p></section>`;
}

// ─────────────────────────── Viajes ───────────────────────────
export function viajes(v) {
  const vs = v.st.d.viajes.slice().sort((a, b) => String(b.desde || '').localeCompare(String(a.desde || '')));
  const chip = e => { const x = ESTADOS_VIAJE.find(([k]) => k === e) || ESTADOS_VIAJE[0]; return `<span class="sis-chip ${x[2]}">${x[1]}</span>`; };
  return `${cab('viajes')}
    <section class="sis-tarjeta"><h2>Registrar viaje</h2><form class="sis-form" data-f="viaje">
      <div class="sis-par">${campo('Proyecto *', select('proyectoId', opcionesProyectos(v), '', { vacio: 'Seleccione', extra: 'required' }))}${campo('Estado', select('estado', ESTADOS_VIAJE.map(([k, t]) => [k, t]), 'pendiente'))}</div>
      <div class="campo-personas"><span class="sis-tenue">Personas</span><div class="sis-opciones">${v.st.personas.map(p => `<label class="sis-opcion chico"><input type="checkbox" name="personas" value="${esc(p.id)}"> ${esc(p.nombre)}</label>`).join('')}</div></div>
      <div class="sis-par">${campo('Traslado', input('traslado', '', 'placeholder="Vuelo SCL–CJC, camioneta…"'))}${campo('Alojamiento', input('alojamiento', '', 'placeholder="Ciudad y lugar"'))}</div>
      <div class="sis-par">${campo('Desde', fecha('desde'))}${campo('Hasta', fecha('hasta'))}</div>
      <div class="sis-acciones"><button class="sis-btn primario">Registrar viaje</button></div></form></section>
    <section class="sis-tarjeta"><h2>Viajes registrados</h2>${vs.length ? `<div class="sis-tabla-scroll"><table class="sis-tabla"><thead><tr><th>Proyecto</th><th>Personas</th><th>Traslado</th><th>Alojamiento</th><th>Fechas</th><th>Estado</th><th></th></tr></thead><tbody>${vs.map(x => `<tr>
      <td><a href="#/proyecto/${esc(x.proyectoId)}">${esc(nomProy(v, x.proyectoId))}</a></td><td>${esc((x.personas || []).map(v.nomPers).join(', ') || '—')}</td><td>${esc(x.traslado || '—')}</td><td>${esc(x.alojamiento || '—')}</td>
      <td class="mono">${x.desde ? fechaLegible(x.desde) : '—'}${x.hasta ? ` al ${fechaLegible(x.hasta)}` : ''}</td><td>${chip(x.estado)}</td>
      <td>${select('estado', ESTADOS_VIAJE.map(([k, t]) => [k, t]), x.estado, { extra: `data-c="viaje-estado" data-id="${esc(x.id)}" aria-label="Estado del viaje"` })}</td></tr>`).join('')}</tbody></table></div>` : vacio('Sin viajes registrados.')}</section>`;
}

// ─────────────────────────── Fondos por rendir (desde Gastos, sin duplicar datos) ───────────────────────────
export async function fondos(v) {
  const clp = n => `$${Math.round(n || 0).toLocaleString('es-CL')}`;
  const filas = [];
  for (const p of v.st.proyectos.filter(x => x.estado !== 'cerrado')) {
    const r = await v.gastos(p.id);
    if (r && (r.gastos || r.depositos)) filas.push({ p, r });
  }
  return `${cab('fondos')}
    <p class="sis-tenue">Resumen tomado del módulo Gastos (no se ingresa aquí). Las boletas se registran desde la aplicación de Terreno o desde Gastos, con fotografía obligatoria, incluidas las cargas de combustible.</p>
    <section class="sis-tarjeta">${filas.length ? `<div class="sis-tabla-scroll"><table class="sis-tabla"><thead><tr><th>Proyecto</th><th>Fondo depositado</th><th>Gastado</th><th>Sin enviar</th><th>Por pagar</th><th></th></tr></thead><tbody>${filas.map(({ p, r }) => `<tr>
      <td><a href="#/proyecto/${esc(p.id)}">${esc(p.nombre)}</a></td><td class="mono">${clp(r.depositos)}</td><td class="mono">${clp(r.gastado)}</td><td class="mono">${r.sinEnviar ? clp(r.sinEnviar) : '—'}</td><td class="mono">${r.porPagar ? clp(r.porPagar) : '—'}</td>
      <td><a class="sis-btn chico" href="#/gastos/proyecto/${esc(p.id)}">Rendiciones</a></td></tr>`).join('')}</tbody></table></div>` : vacio('Sin fondos ni gastos en los proyectos activos.')}</section>`;
}

// ─────────────────────────── Guías de despacho ───────────────────────────
export async function guias(v) {
  const gs = v.st.d.guias.slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  const equipos = await v.equipos();
  const nomEq = id => { const e = equipos.find(x => x.id === id); return e ? `${e.nombre}${e.numeroSerie ? ` N° ${e.numeroSerie}` : ''}` : 'Equipo'; };
  const chip = e => { const x = ESTADOS_GUIA.find(([k]) => k === e) || ESTADOS_GUIA[0]; return `<span class="sis-chip ${x[2]}">${x[1]}</span>`; };
  const pSel = v.st.guiaProyecto || '';
  const enTerreno = pSel ? equipos.filter(e => e.ubicacion.lugar === 'terreno' && e.ubicacion.proyectoId === pSel) : [];
  return `${cab('guias')}
    <section class="sis-tarjeta"><h2>Nueva guía de despacho</h2>
      <p class="sis-tenue">Seleccione el proyecto: se marcan los equipos que salieron con el checklist de salida. Deje solo los de mayor valor, como se solicita habitualmente.</p>
      <form class="sis-form" data-f="guia">
        <div class="sis-par">${campo('Proyecto *', select('proyectoId', opcionesProyectos(v), pSel, { vacio: 'Seleccione', extra: 'required data-c="guia-proyecto"' }))}${campo('N° de guía', input('numero', '', 'placeholder="Se completa al emitirla"'))}${campo('Fecha', fecha('fecha', new Date().toISOString().slice(0, 10)))}</div>
        ${pSel ? (enTerreno.length ? `<div class="sis-opciones">${enTerreno.map(e => `<label class="sis-opcion"><input type="checkbox" name="equipos" value="${esc(e.id)}" checked> ${esc(nomEq(e.id))}</label>`).join('')}</div>` : '<p class="sis-tenue">Este proyecto no tiene equipos en terreno registrados por checklist.</p>') : ''}
        <div class="sis-acciones"><button class="sis-btn primario" ${pSel ? '' : 'disabled'}>Crear borrador</button></div>
      </form></section>
    <section class="sis-tarjeta"><h2>Guías</h2>${gs.length ? `<div class="sis-lista">${gs.map(g => `<div class="sis-fila"><span class="sis-fila-txt"><b>${g.numero ? `Guía N° ${esc(g.numero)}` : 'Guía sin número'} · ${esc(nomProy(v, g.proyectoId))}</b><span class="sis-tenue">${g.fecha ? fechaLegible(g.fecha) : ''} · ${esc((g.equipoIds || []).map(nomEq).join(', ') || 'sin equipos')}</span></span>
      <span class="sis-chips">${chip(g.estado)}${select('estado', ESTADOS_GUIA.map(([k, t]) => [k, t]), g.estado, { extra: `data-c="guia-estado" data-id="${esc(g.id)}" aria-label="Estado de la guía"` })}<button type="button" class="sis-btn chico" data-a="guia-copiar" data-id="${esc(g.id)}">Copiar listado</button><button type="button" class="sis-btn chico peligro" data-a="guia-borrar" data-id="${esc(g.id)}">Eliminar</button></span></div>`).join('')}</div>` : vacio('Sin guías registradas.')}</section>`;
}

// ─────────────────────────── Mandantes ───────────────────────────
export function mandantes(v, id) {
  const ms = v.st.d.mandantes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const m = id === 'nuevo' ? { requisitosPersona: [], requisitosVehiculo: [] } : ms.find(x => x.id === id);
  const reqs = (lista, aplica) => tiposDe(v.st.d.tipos, aplica).map(t => { const r = (lista || []).find(x => x.tipoId === t.id); return `<div class="ad-req-fila"><label class="sis-opcion"><input type="checkbox" name="req_${aplica}" value="${esc(t.id)}" ${r ? 'checked' : ''}> ${esc(t.nombre)}</label><label class="sis-opcion chico"><input type="checkbox" name="obl_${aplica}" value="${esc(t.id)}" ${!r || r.obligatorio !== false ? 'checked' : ''}> obligatorio</label></div>`; }).join('');
  return `${cab('mandantes', '<a class="sis-btn primario" href="#/administracion/mandantes/nuevo">+ Mandante</a>')}
    <div class="sis-dos"><div><section class="sis-tarjeta"><h2>Mandantes</h2>${ms.length ? `<div class="sis-lista">${ms.map(x => `<a class="sis-fila${m && x.id === m.id ? ' sis-nuevo' : ''}" href="#/administracion/mandantes/${esc(x.id)}"><span class="sis-fila-txt"><b>${esc(x.nombre)}</b><span class="sis-tenue">${esc(x.plataforma || 'Sin plataforma')} · ${plural((x.requisitosPersona || []).length, 'requisito de personal', 'requisitos de personal')} · ${plural((x.requisitosVehiculo || []).length, 'requisito de vehículos', 'requisitos de vehículos')}</span></span></a>`).join('')}</div>` : vacio('Sin mandantes.')}</section>
      <p class="sis-tenue">Los proyectos se asocian a su mandante por nombre (por ejemplo, «Codelco RT» → Codelco) o eligiéndolo en la edición del proyecto. Los requisitos definidos aquí se usan en la acreditación de personas y vehículos.</p></div>
    <aside>${m ? `<section class="sis-tarjeta"><h2>${m.id ? esc(m.nombre) : 'Nuevo mandante'}</h2><form class="sis-form" data-f="mandante" data-id="${esc(m.id || '')}">
      <div class="sis-par">${campo('Nombre *', input('nombre', m.nombre, 'required'))}${campo('Plataforma de acreditación', input('plataforma', m.plataforma, 'placeholder="SUCAL, SIGA…"'))}</div>
      ${campo('Otros nombres (separados por coma)', input('alias', (m.alias || []).join(', ')), { ayuda: 'Ayudan a reconocer el mandante en el nombre escrito en los proyectos.' })}
      <fieldset><legend>Requisitos para el personal</legend>${reqs(m.requisitosPersona, 'persona')}</fieldset>
      <fieldset><legend>Requisitos para vehículos</legend>${reqs(m.requisitosVehiculo, 'vehiculo')}</fieldset>
      ${campo('Notas', `<textarea name="notas" rows="3">${esc(m.notas || '')}</textarea>`)}
      <div class="sis-acciones"><button class="sis-btn primario">Guardar mandante</button>${m.id ? `<button type="button" class="sis-btn peligro" data-a="mandante-borrar" data-id="${esc(m.id)}">Eliminar</button>` : ''}</div>
    </form>${firmaCambio(m, v.nomPers)}</section>` : '<section class="sis-tarjeta"><p class="sis-tenue">Seleccione un mandante para editar sus requisitos.</p></section>'}</aside></div>`;
}

// ─────────────────────────── Configuración ───────────────────────────
export function configuracion(v) {
  const c = v.st.d.config;
  const tipos = [...tiposDe(v.st.d.tipos, 'persona'), ...tiposDe(v.st.d.tipos, 'vehiculo')];
  return `${cab('configuracion')}
    <section class="sis-tarjeta"><h2>Tipos de documento</h2>
      <p class="sis-tenue">Catálogo común para personas y vehículos. «Obligatorio» define la habilitación general; cada mandante puede exigir documentos adicionales.</p>
      <div class="sis-tabla-scroll"><table class="sis-tabla"><thead><tr><th>Documento</th><th>Aplica a</th><th>Vence</th><th>Obligatorio</th><th></th></tr></thead><tbody>${tipos.map(t => `<tr>
        <td>${esc(t.nombre)}</td><td>${t.aplica === 'persona' ? 'Personas' : 'Vehículos'}</td>
        <td><input type="checkbox" aria-label="Vence" data-c="tipo-vence" data-id="${esc(t.id)}" ${t.vence ? 'checked' : ''}></td>
        <td><input type="checkbox" aria-label="Obligatorio" data-c="tipo-obligatorio" data-id="${esc(t.id)}" ${t.obligatorio ? 'checked' : ''}></td>
        <td><button type="button" class="sis-btn chico peligro" data-a="tipo-borrar" data-id="${esc(t.id)}">Quitar</button></td></tr>`).join('')}</tbody></table></div>
      <form class="sis-form ad-form-linea" data-f="tipo"><div class="sis-par">${campo('Nuevo documento', input('nombre', '', 'required placeholder="Ej.: Curso de primeros auxilios"'))}${campo('Aplica a', select('aplica', [['persona', 'Personas'], ['vehiculo', 'Vehículos']], 'persona'))}</div>
        <div class="sis-opciones"><label class="sis-opcion"><input type="checkbox" name="vence" checked> Vence</label><label class="sis-opcion"><input type="checkbox" name="obligatorio"> Obligatorio</label></div>
        <div class="sis-acciones"><button class="sis-btn primario">Agregar documento</button></div></form></section>
    <section class="sis-tarjeta"><h2>Plazo de aviso</h2><form class="sis-form ad-form-linea" data-f="config-aviso">
      ${campo('Días de anticipación para «por vencer»', input('diasAviso', c.diasAviso, 'type="number" min="1" max="180"'), { ayuda: 'Se aplica a documentos, contratos, EPP y vehículos.' })}
      <div class="sis-acciones"><button class="sis-btn primario">Guardar</button></div></form></section>
    <p class="sis-tenue">La tabla de tiempos de ocupación GNSS se administra en <a href="#/planificacion">Planificación</a>, junto a la planificación de redes.</p>
    <section class="sis-tarjeta"><h2>Tarifas para el estimador de cotizaciones</h2><form class="sis-form" data-f="config-tarifas">
      <div class="sis-par">${campo('Día-persona en terreno ($)', input('diaPersona', c.tarifas.diaPersona, 'type="number" min="0"'))}${campo('Día-equipo ($)', input('diaEquipo', c.tarifas.diaEquipo, 'type="number" min="0"'))}${campo('Día de gabinete ($)', input('diaGabinete', c.tarifas.diaGabinete, 'type="number" min="0"'))}</div>
      <p class="sis-tenue">Las tarifas son definidas por Administración y la Dirección; mientras estén vacías, el estimador muestra solo los totales en días.</p>
      <div class="sis-acciones"><button class="sis-btn primario">Guardar tarifas</button></div></form></section>`;
}

// ─────────────────────────── Acciones y formularios ───────────────────────────
const txt = (fd, k) => String(fd.get(k) || '').trim();
const num = (fd, k) => (fd.get(k) === '' || fd.get(k) == null ? '' : Number(fd.get(k)));

export const acciones = {
  'vehiculo-nuevo': (b, v) => { v.st.editVehiculo = 'nuevo'; return true; },
  'vehiculo-cancelar': (b, v) => { v.st.editVehiculo = null; return true; },
  'vehiculo-borrar': async (b, v) => { if (!confirm('¿Eliminar este vehículo? Va a la papelera junto con su ficha; sus documentos se conservan.')) return false; await aPapelera(ALM.vehiculos, b.dataset.id); v.avisar('Vehículo eliminado'); v.ir('#/administracion/vehiculos'); return false; },
  'guia-borrar': async (b, v) => { if (!confirm('¿Eliminar esta guía?')) return false; await aPapelera(ALM.guias, b.dataset.id); return true; },
  'guia-copiar': async (b, v) => {
    const g = v.st.d.guias.find(x => x.id === b.dataset.id); const eq = await v.equipos();
    const t = [`Guía de despacho · ${nomProy(v, g.proyectoId)} · ${fechaLegible(g.fecha)}`, ...(g.equipoIds || []).map(id => { const e = eq.find(x => x.id === id); return e ? `- ${e.nombre}${e.numeroSerie ? ` · N° de serie ${e.numeroSerie}` : ''}` : '- Equipo'; })].join('\n');
    try { await navigator.clipboard.writeText(t); v.avisar('Listado copiado'); } catch { prompt('Copie el listado:', t); }
    return false;
  },
  'mandante-borrar': async (b, v) => { if (!confirm('¿Eliminar este mandante? Sus requisitos dejarán de aplicarse.')) return false; await aPapelera(ALM.mandantes, b.dataset.id); v.ir('#/administracion/mandantes'); return false; },
  'tipo-borrar': async (b, v) => { if (!confirm('¿Quitar este tipo de documento del catálogo? Los documentos ya cargados se conservan.')) return false; await aPapelera(ALM.tipos, b.dataset.id); return true; },
};

export const cambios = {
  'viaje-estado': async i => { await guardarRegistro(ALM.viajes, { id: i.dataset.id, estado: i.value }); return true; },
  'guia-estado': async i => { await guardarRegistro(ALM.guias, { id: i.dataset.id, estado: i.value }); return true; },
  'guia-proyecto': (i, v) => { v.st.guiaProyecto = i.value; return true; },
  'tipo-vence': async i => { await guardarRegistro(ALM.tipos, { id: i.dataset.id, vence: i.checked }); return true; },
  'tipo-obligatorio': async i => { await guardarRegistro(ALM.tipos, { id: i.dataset.id, obligatorio: i.checked }); return true; },
};

export const formularios = {
  vehiculo: async (f, fd, v) => {
    const id = f.dataset.id || undefined;
    const r = await guardarRegistro(ALM.vehiculos, { id, patente: txt(fd, 'patente').toUpperCase(), marca: txt(fd, 'marca'), modelo: txt(fd, 'modelo'), anio: txt(fd, 'anio'), km: num(fd, 'km'), kmProximaMantencion: num(fd, 'kmProximaMantencion'), proyectoId: fd.get('proyectoId') || null });
    v.st.editVehiculo = null; v.avisar('Vehículo guardado');
    if (!id) { v.ir(`#/administracion/vehiculo/${r.id}`); return false; }
    return true;
  },
  viaje: async (f, fd, v) => { await guardarRegistro(ALM.viajes, { proyectoId: fd.get('proyectoId'), personas: fd.getAll('personas'), traslado: txt(fd, 'traslado'), alojamiento: txt(fd, 'alojamiento'), desde: fd.get('desde') || '', hasta: fd.get('hasta') || '', estado: fd.get('estado') || 'pendiente' }); v.avisar('Viaje registrado'); return true; },
  guia: async (f, fd, v) => { await guardarRegistro(ALM.guias, { proyectoId: fd.get('proyectoId'), numero: txt(fd, 'numero'), fecha: fd.get('fecha') || '', equipoIds: fd.getAll('equipos'), estado: 'borrador' }); v.st.guiaProyecto = ''; v.avisar('Guía creada en borrador'); return true; },
  mandante: async (f, fd, v) => {
    const reqs = aplica => fd.getAll(`req_${aplica}`).map(tipoId => ({ tipoId, obligatorio: fd.getAll(`obl_${aplica}`).includes(tipoId) }));
    const r = await guardarRegistro(ALM.mandantes, { id: f.dataset.id || undefined, nombre: txt(fd, 'nombre'), plataforma: txt(fd, 'plataforma'), alias: txt(fd, 'alias').split(',').map(s => s.trim()).filter(Boolean), requisitosPersona: reqs('persona'), requisitosVehiculo: reqs('vehiculo'), notas: txt(fd, 'notas') });
    v.avisar('Mandante guardado'); v.ir(`#/administracion/mandantes/${r.id}`); return false;
  },
  tipo: async (f, fd, v) => { const orden = v.st.d.tipos.filter(t => t.aplica === fd.get('aplica')).length + 1; await guardarRegistro(ALM.tipos, { nombre: txt(fd, 'nombre'), aplica: fd.get('aplica'), vence: fd.get('vence') === 'on', obligatorio: fd.get('obligatorio') === 'on', orden }); v.avisar('Documento agregado al catálogo'); return true; },
  'config-aviso': async (f, fd, v) => { await guardarConfig({ diasAviso: Math.max(1, Number(fd.get('diasAviso')) || 30) }); v.avisar('Plazo de aviso guardado'); return true; },
  'config-tarifas': async (f, fd, v) => { await guardarConfig({ tarifas: { diaPersona: txt(fd, 'diaPersona'), diaEquipo: txt(fd, 'diaEquipo'), diaGabinete: txt(fd, 'diaGabinete') } }); v.avisar('Tarifas guardadas'); return true; },
};

export { ESTADOS_PLATAFORMA };
