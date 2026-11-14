// modulos/administracion/pantallas-comercial.js — Dirección y área comercial (Sistema v0.15): estado general de la empresa,
// cotizaciones y licitaciones (enviada, ganada, perdida y motivo) y estimador de cotizaciones con las tarifas de la empresa.
// Rutas: #/comercial · #/comercial/cotizaciones · #/comercial/estimador

import { hoyISO } from '../../compartido/util.js';
import { guardarProyecto } from '../../compartido/catalogos.js';
import { ALM, guardarRegistro, aPapelera } from './datos.js';
import { ESTADOS_COTIZACION, resumenCotizaciones, estimar } from './modelo.js';
import { esc, fechaLegible, vacio, plural, pestanas, campo, input, fecha, select } from './ui.js';

const PESTANAS = [['tablero', 'Estado general', '#/comercial'], ['cotizaciones', 'Cotizaciones', '#/comercial/cotizaciones'], ['estimador', 'Estimador', '#/comercial/estimador']];
const clp = n => (n == null || n === '' || !isFinite(Number(n)) ? '—' : `$${Math.round(Number(n)).toLocaleString('es-CL')}`);
const chipCot = e => { const x = ESTADOS_COTIZACION.find(([k]) => k === e) || ESTADOS_COTIZACION[0]; return `<span class="sis-chip ${x[2]}">${x[1]}</span>`; };

export async function tablero(v) {
  const hoy = hoyISO();
  const ps = v.st.proyectos.filter(p => p.id !== 'oficina');
  const activos = ps.filter(p => p.estado !== 'cerrado');
  const atrasados = activos.filter(p => p.plazo && p.plazo < hoy && (!p.periodicidad || p.periodicidad.tipo !== 'recurrente'));
  const entregables = activos.filter(p => p.etapa === 'entregables');
  const enTerreno = new Set(activos.filter(p => !p.etapa || p.etapa === 'terreno').flatMap(p => [...(p.cuadrilla || []), p.encargadoId].filter(Boolean)));
  const equipos = await v.equipos();
  const eqTerreno = equipos.filter(e => e.ubicacion.lugar === 'terreno');
  const porTipo = {};
  for (const e of equipos) { const t = e.equipo || 'Otros'; porTipo[t] = porTipo[t] || { total: 0, terreno: 0 }; porTipo[t].total++; if (e.ubicacion.lugar === 'terreno') porTipo[t].terreno++; }
  const rc = resumenCotizaciones(v.st.d.cotizaciones);
  const conMonto = activos.filter(p => Number(p.montoCotizado) > 0);
  const rent = [];
  for (const p of conMonto) { const g = await v.gastos(p.id); rent.push({ p, gastado: g ? g.gastado : 0 }); }
  const barra = (a, b) => `<div class="ad-barra" role="img" aria-label="${a} de ${b}"><i style="width:${b ? Math.round(100 * a / b) : 0}%"></i></div>`;
  return `<div class="sis-cab"><div><h1>Estado general de la empresa</h1><span class="sis-tenue">Indicadores generados automáticamente a partir de los proyectos, equipos y cotizaciones registrados. No requieren ingreso manual.</span></div></div>
    ${pestanas(PESTANAS, 'tablero')}
    <div class="sis-kpis ad-kpis4">
      <a class="sis-kpi" href="#/proyectos"><span>Proyectos activos</span><b>${activos.length}</b></a>
      <a class="sis-kpi ${atrasados.length ? 'rojo' : ''}" href="#/proyectos"><span>Con plazo vencido</span><b>${atrasados.length}</b></a>
      <a class="sis-kpi ${entregables.length ? 'ambar' : ''}" href="#/proyectos"><span>En entregables</span><b>${entregables.length}</b></a>
      <div class="sis-kpi"><span>Personal en terreno</span><b>${enTerreno.size}<small> de ${v.st.personas.length}</small></b></div>
    </div>
    <div class="sis-dos"><div>
      <section class="sis-tarjeta"><div class="sis-cab"><h2>Cotizaciones y licitaciones</h2><a class="sis-btn chico" href="#/comercial/cotizaciones">Ver todas</a></div>
        <div class="ad-columnas">${ESTADOS_COTIZACION.map(([k, t]) => `<div class="ad-col"><b>${t} · ${rc.por[k].length}</b>${rc.por[k].slice(0, 4).map(c => `<div class="ad-col-item">${esc(c.nombre)}<small>${esc(c.mandante || '')}${c.estado === 'perdida' && c.motivo ? ` · motivo: ${esc(c.motivo)}` : ''}</small></div>`).join('') || '<small class="sis-tenue ad-col-vacia">Sin registros</small>'}</div>`).join('')}</div>
        <p class="sis-tenue">${rc.tasa != null ? `Tasa de adjudicación: ${rc.tasa} % de las cotizaciones resueltas.` : 'Aún no hay cotizaciones resueltas.'}</p></section>
      <section class="sis-tarjeta"><h2>Rentabilidad por proyecto</h2>
        <p class="sis-tenue">Comparación entre lo cotizado y lo gastado según el módulo Gastos. Ingrese el monto cotizado en la edición de cada proyecto.</p>
        ${rent.length ? `<div class="sis-tabla-scroll"><table class="sis-tabla"><thead><tr><th>Proyecto</th><th>Etapa</th><th>Cotizado</th><th>Gastado</th><th>Consumido</th></tr></thead><tbody>${rent.map(r => { const pct = Math.round(100 * r.gastado / Number(r.p.montoCotizado)); return `<tr><td><a href="#/proyecto/${esc(r.p.id)}">${esc(r.p.nombre)}</a></td><td>${esc({ terreno: 'Terreno', gabinete: 'Gabinete', entregables: 'Entregables' }[r.p.etapa] || 'Terreno')}</td><td class="mono">${clp(r.p.montoCotizado)}</td><td class="mono">${clp(r.gastado)}</td><td><span class="sis-chip ${pct > 90 ? 'rojo' : pct > 70 ? 'ambar' : 'verde'}">${pct} %</span></td></tr>`; }).join('')}</tbody></table></div>` : vacio('Ningún proyecto activo tiene monto cotizado registrado.')}
      </section>
    </div><aside>
      <section class="sis-tarjeta"><h2>Ocupación de equipos</h2>
        <p class="sis-tenue">${eqTerreno.length} de ${equipos.length} equipos en terreno.</p>
        ${Object.entries(porTipo).sort((a, b) => b[1].total - a[1].total).slice(0, 6).map(([t, x]) => `<div class="ad-ocup"><span>${esc(t)} · ${x.terreno} de ${x.total}</span>${barra(x.terreno, x.total)}</div>`).join('') || vacio('Sin equipos registrados.')}
      </section>
      ${atrasados.length ? `<section class="sis-tarjeta"><h2>Proyectos con plazo vencido</h2><div class="sis-lista">${atrasados.map(p => `<a class="sis-fila" href="#/proyecto/${esc(p.id)}"><span class="sis-fila-txt"><b>${esc(p.nombre)}</b><span class="sis-tenue">Plazo ${fechaLegible(p.plazo)} · ${esc(v.nomPers(p.encargadoId) || 'sin encargado')}</span></span></a>`).join('')}</div></section>` : ''}
    </aside></div>`;
}

export function cotizaciones(v) {
  const cs = v.st.d.cotizaciones.slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  const ed = v.st.editCot ? (v.st.editCot === 'nueva' ? { estado: 'preparacion', fecha: hoyISO() } : cs.find(c => c.id === v.st.editCot)) : null;
  return `<div class="sis-cab"><div><h1>Cotizaciones y licitaciones</h1><span class="sis-tenue">Registre cada cotización enviada y su resultado. Con el tiempo se aprecia qué tipo de trabajo se adjudica la empresa y por qué se pierden.</span></div>${ed ? '' : '<button type="button" class="sis-btn primario" data-a="cot-nueva">+ Cotización</button>'}</div>
    ${pestanas(PESTANAS, 'cotizaciones')}
    ${ed ? `<section class="sis-tarjeta"><h2>${ed.id ? 'Editar cotización' : 'Nueva cotización'}</h2><form class="sis-form" data-f="cotizacion" data-id="${esc(ed.id || '')}">
      <div class="sis-par">${campo('Nombre *', input('nombre', ed.nombre, 'required'))}${campo('Mandante', input('mandante', ed.mandante))}</div>
      <div class="sis-par">${campo('Tipo de trabajo', input('tipo', ed.tipo, 'placeholder="Red GNSS, vuelo, batimetría…"'))}${campo('Fecha de envío', fecha('fecha', ed.fecha))}${campo('Monto ($)', input('monto', ed.monto, 'type="number" min="0"'))}</div>
      <div class="sis-par">${campo('Estado', select('estado', ESTADOS_COTIZACION.map(([k, t]) => [k, t]), ed.estado))}${campo('Motivo (si se perdió)', input('motivo', ed.motivo, 'placeholder="Precio, plazo, experiencia…"'))}</div>
      <div class="sis-acciones"><button class="sis-btn primario">Guardar</button><button type="button" class="sis-btn" data-a="cot-cancelar">Cancelar</button>${ed.id ? `<button type="button" class="sis-btn peligro" data-a="cot-borrar" data-id="${esc(ed.id)}">Eliminar</button>` : ''}</div>
    </form></section>` : ''}
    <section class="sis-tarjeta">${cs.length ? `<div class="sis-tabla-scroll"><table class="sis-tabla"><thead><tr><th>Cotización</th><th>Mandante</th><th>Envío</th><th>Monto</th><th>Estado</th><th></th></tr></thead><tbody>${cs.map(c => `<tr>
      <td><b>${esc(c.nombre)}</b>${c.tipo ? `<small>${esc(c.tipo)}</small>` : ''}</td><td>${esc(c.mandante || '—')}</td><td class="mono">${c.fecha ? fechaLegible(c.fecha) : '—'}</td><td class="mono">${clp(c.monto)}</td>
      <td>${chipCot(c.estado)}${c.estado === 'perdida' && c.motivo ? `<small>${esc(c.motivo)}</small>` : ''}</td>
      <td class="ad-acciones-celda"><button type="button" class="sis-btn chico" data-a="cot-editar" data-id="${esc(c.id)}">Editar</button>${c.estado === 'ganada' ? (c.proyectoId ? `<a class="sis-btn chico" href="#/proyecto/${esc(c.proyectoId)}">Ver proyecto</a>` : `<button type="button" class="sis-btn chico" data-a="cot-proyecto" data-id="${esc(c.id)}">Crear proyecto</button>`) : ''}</td></tr>`).join('')}</tbody></table></div>` : vacio('Aún no hay cotizaciones registradas.')}</section>`;
}

export function estimador(v) {
  const t = v.st.d.config.tarifas || {};
  const e = v.st.est || { dias: 5, personas: 2, equipos: 3, gabinete: 4 };
  const r = estimar(e, t);
  const n = (k, t2) => campo(t2, `<input type="number" min="0" value="${esc(e[k])}" data-c="est" data-k="${k}">`);
  return `<div class="sis-cab"><div><h1>Estimador de cotizaciones</h1><span class="sis-tenue">Ingrese los parámetros estimados para obtener una base de cotización estandarizada.</span></div></div>
    ${pestanas(PESTANAS, 'estimador')}
    <div class="sis-dos"><div><section class="sis-tarjeta"><h2>Parámetros</h2><div class="sis-par">${n('dias', 'Días de terreno')}${n('personas', 'Personas en terreno')}</div><div class="sis-par">${n('equipos', 'Equipos en terreno')}${n('gabinete', 'Días de gabinete')}</div></section></div>
    <aside><section class="sis-tarjeta"><h2>Resultado</h2>
      <dl class="ad-resultado-est"><dt>Días-persona</dt><dd class="mono">${r.diasPersona}</dd><dt>Días-equipo</dt><dd class="mono">${r.diasEquipo}</dd><dt>Días de gabinete</dt><dd class="mono">${r.diasGabinete}</dd>
        <dt>Valor base</dt><dd class="mono"><b>${r.total != null ? clp(r.total) : '—'}</b></dd></dl>
      <p class="sis-tenue">${r.total != null ? 'Calculado con las tarifas de Administración › Configuración.' : 'El valor se obtiene multiplicando cada total por la tarifa de la empresa. Defina las tarifas en Administración › Configuración.'}</p>
    </section></aside></div>`;
}

export const acciones = {
  'cot-nueva': (b, v) => { v.st.editCot = 'nueva'; return true; },
  'cot-editar': (b, v) => { v.st.editCot = b.dataset.id; return true; },
  'cot-cancelar': (b, v) => { v.st.editCot = null; return true; },
  'cot-borrar': async (b, v) => { if (!confirm('¿Eliminar esta cotización?')) return false; await aPapelera(ALM.cotizaciones, b.dataset.id); v.st.editCot = null; return true; },
  'cot-proyecto': async (b, v) => {
    const c = v.st.d.cotizaciones.find(x => x.id === b.dataset.id);
    const p = await guardarProyecto({ nombre: c.nombre, mandante: c.mandante || '', estado: 'activo', etapa: 'terreno', fechaEncargo: hoyISO(), montoCotizado: c.monto || '', tiposTrabajo: [] }, { personaId: v.ctx.personaId });
    await guardarRegistro(ALM.cotizaciones, { id: c.id, proyectoId: p.id });
    v.avisar('Proyecto creado desde la cotización'); v.ir(`#/proyecto-editar/${p.id}`); return false;
  },
};
export const cambios = {
  est: (i, v) => { v.st.est = { ...(v.st.est || { dias: 5, personas: 2, equipos: 3, gabinete: 4 }), [i.dataset.k]: Math.max(0, Number(i.value) || 0) }; return true; },
};
export const formularios = {
  cotizacion: async (f, fd, v) => {
    await guardarRegistro(ALM.cotizaciones, { id: f.dataset.id || undefined, nombre: String(fd.get('nombre')).trim(), mandante: String(fd.get('mandante') || '').trim(), tipo: String(fd.get('tipo') || '').trim(), fecha: fd.get('fecha') || '', monto: fd.get('monto') === '' ? '' : Number(fd.get('monto')), estado: fd.get('estado'), motivo: String(fd.get('motivo') || '').trim() });
    v.st.editCot = null; v.avisar('Cotización guardada'); return true;
  },
};
export { plural };
