// modulos/administracion/pantallas-gestion.js — gestión de personal (Administración 0.2, Sistema v0.16).
// Pantallas de la sección Personas para Recursos Humanos y Jefatura:
//   Dotación (#/personal): quién trabaja en la empresa, dónde está hoy, habilitación y alertas; alta y baja de trabajadores.
//   Distribución (#/personal/distribucion): personas por proyecto (se arrastran entre proyectos) y ocupación por semana.
//   Vacaciones y ausencias (#/personal/vacaciones): solicitudes, saldos, línea de tiempo y registro.
// El encargado de terreno ve solo la habilitación y «Mis vacaciones» (saldo y solicitud propia).

import { hoyISO, descargar } from '../../compartido/util.js';
import { guardarPersona, guardarProyecto } from '../../compartido/catalogos.js';
import { ROLES_PERSONA, NOMBRE_ROL_PERSONA } from '../../app/catalogo.js';
import { ALM, guardarRegistro, guardarFicha, personasDeBaja } from './datos.js';
import {
  habilitacionPersona, estadoDocumentos, avisoContrato, eppPorReponer, resumenVacaciones, ubicacionPersona, crucesAusencia, ocupacionSemanal,
  proyectosActivosDe, diasHabiles, TIPOS_AUSENCIA, NOMBRE_AUSENCIA, NOMBRE_TURNO,
} from './modelo.js';
import { esc, fechaLegible, vacio, plural, chipHab, campo, input, fecha, select, ICO } from './ui.js';

export const gestiona = v => v.ctx.rol === 'rrhh' || v.ctx.rol === 'direccion';
export const iniciales = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');
const avatar = (p, clase = '') => `<span class="ad-avatar ${clase}" aria-hidden="true">${esc(iniciales(p.nombre))}</span>`;
const mas = (iso, n) => { const f = new Date(`${iso}T12:00:00`); f.setDate(f.getDate() + n); return f.toISOString().slice(0, 10); };
const lunesDe = iso => { const f = new Date(`${iso}T12:00:00`); return mas(iso, -((f.getDay() + 6) % 7)); };
const diaMes = iso => { const [, m, d] = iso.split('-'); return `${Number(d)}/${Number(m)}`; };
const num = n => (n == null ? '—' : Number(n).toLocaleString('es-CL', { maximumFractionDigits: 1 }));

export const avisoConfidencial = `<div class="ad-confidencial">${ICO.candado}<span>Información confidencial del personal. Solo tienen acceso Recursos Humanos y Jefatura; los encargados de terreno ven únicamente si cada persona está habilitada.</span></div>`;

function chipHoy(u) {
  if (u.estado === 'ausente') return `<span class="sis-chip rojo">${esc(NOMBRE_AUSENCIA[u.ausencia.tipo] || 'Ausente')} hasta el ${fechaLegible(u.ausencia.hasta || u.ausencia.desde)}</span>`;
  if (u.estado === 'proyecto') return u.proyectos.slice(0, 2).map(p => `<span class="sis-chip azul">${esc(p.nombre)}</span>`).join('') + (u.proyectos.length > 2 ? `<span class="sis-chip azul">+${u.proyectos.length - 2}</span>` : '');
  return '<span class="sis-chip verde">Disponible</span>';
}

/** Una fila por trabajador con todo lo que se muestra en la dotación. */
function filasDotacion(st) {
  const hoy = hoyISO(), base = { ...st.d, hoy, diasAviso: st.d.config.diasAviso };
  return st.personas.map(p => {
    const fi = st.d.fichas.find(x => x.id === p.id) || {};
    const docs = estadoDocumentos('persona', p.id, base);
    return {
      p, fi, h: habilitacionPersona(p.id, base), u: ubicacionPersona(p.id, { ausencias: st.d.ausencias, proyectos: st.proyectos, fecha: hoy }),
      porVencer: docs.filter(f => f.e.estado === 'por_vencer').length,
      malos: docs.filter(f => (f.doc || f.tipo.obligatorio) && ['vencido', 'falta'].includes(f.e.estado)).length,
      contrato: avisoContrato(fi, base), epp: eppPorReponer(fi, base).length, vac: resumenVacaciones(p.id, { ...st.d, hoy }),
    };
  });
}

// ─────────────────────────── Dotación ───────────────────────────
export async function dotacion(v) {
  const { st } = v;
  const filas = filasDotacion(st);
  if (!gestiona(v)) {
    return `<div class="sis-cab"><h1>Habilitación del personal</h1></div>
      <p class="sis-tenue">Indica si cada persona tiene su documentación obligatoria al día y si se encuentra disponible. El detalle de los documentos lo administra Recursos Humanos.</p>
      <section class="sis-tarjeta">${filas.length ? `<div class="sis-lista">${filas.map(f => `<div class="sis-fila ge-fila">${avatar(f.p, 'chico')}<span class="sis-fila-txt"><b>${esc(f.p.nombre)}</b><span class="sis-tenue">${esc(f.p.cargo || 'Sin cargo')}</span></span><span class="sis-chips">${f.u.estado === 'ausente' ? '<span class="sis-chip ambar">Ausente hoy</span>' : ''}${chipHab(f.h, { aviso: 'Habilitado' })}</span></div>`).join('')}</div>` : vacio('Aún no hay personas registradas.')}</section>`;
  }
  const filtro = st.filtroPersonal || 'todos';
  const FILTROS = [
    ['todos', 'Todas', () => true], ['proyecto', 'En proyecto', f => f.u.estado === 'proyecto'], ['disponible', 'Disponibles', f => f.u.estado === 'disponible'],
    ['ausente', 'Ausentes', f => f.u.estado === 'ausente'], ['no', 'No habilitadas', f => f.h.nivel === 'no'], ['aviso', 'Con vencimientos', f => f.porVencer || f.malos || f.contrato || f.epp],
  ];
  const cuenta = k => filas.filter(FILTROS.find(x => x[0] === k)[2]).length;
  const vis = filas.filter(FILTROS.find(x => x[0] === filtro)[2]);
  const bajas = await personasDeBaja();
  const alertas = f => [
    f.porVencer ? `<span class="sis-chip ambar">${f.porVencer} por vencer</span>` : '',
    f.contrato ? `<span class="sis-chip ${f.contrato.estado === 'vencido' ? 'rojo' : 'ambar'}">Contrato ${f.contrato.estado === 'vencido' ? 'terminado' : 'por terminar'}</span>` : '',
    f.epp ? '<span class="sis-chip ambar">EPP por reponer</span>' : '',
    f.vac.porAprobar ? '<span class="sis-chip ambar">Ausencia por aprobar</span>' : '',
  ].join('');
  return `<div class="sis-cab"><div><h1>Personal</h1><span class="sis-tenue">Dotación de la empresa: ubicación de cada trabajador, habilitación y alertas. Seleccione a una persona para abrir su ficha.</span></div>
      <div class="sis-acciones"><button type="button" class="sis-btn" data-a="dotacion-csv">${ICO.descargar}Exportar</button><button type="button" class="sis-btn primario" data-a="trabajador-nuevo">+ Trabajador</button></div></div>
    ${avisoConfidencial}
    ${st.nuevoTrabajador ? `<section class="sis-tarjeta sis-destacada"><h2>Nuevo trabajador</h2>
      <form class="sis-form" data-f="trabajador">
        <div class="sis-par">${campo('Nombre completo *', input('nombre', '', 'required autofocus'))}${campo('Cargo', input('cargo', '', 'placeholder="Geomensor, topógrafo, piloto, dibujante…"'))}</div>
        <div class="sis-campo"><span>Roles en el Sistema</span><div class="sis-opciones">${ROLES_PERSONA.map(([k, t]) => `<label class="sis-opcion"><input type="checkbox" name="roles" value="${k}"> ${t}</label>`).join('')}</div></div>
        <div class="sis-acciones"><button class="sis-btn primario">Crear y abrir la ficha</button><button type="button" class="sis-btn" data-a="trabajador-cancelar">Cancelar</button></div>
      </form></section>` : ''}
    <div class="sis-kpis ge-kpis5">
      <div class="sis-kpi"><span>Dotación</span><b>${filas.length}</b></div>
      <div class="sis-kpi"><span>En proyecto hoy</span><b>${cuenta('proyecto')}</b></div>
      <div class="sis-kpi"><span>Disponibles hoy</span><b>${cuenta('disponible')}</b></div>
      <div class="sis-kpi ${cuenta('ausente') ? 'ambar' : ''}"><span>Ausentes hoy</span><b>${cuenta('ausente')}</b></div>
      <div class="sis-kpi ${cuenta('no') ? 'rojo' : ''}"><span>No habilitadas</span><b>${cuenta('no')}</b></div>
    </div>
    <div class="ad-filtros" role="group" aria-label="Filtro">${FILTROS.map(([k, t]) => `<button type="button" class="sis-btn chico${filtro === k ? ' activo' : ''}" aria-pressed="${filtro === k}" data-a="filtro-personal" data-k="${k}">${t}${k === 'todos' ? '' : ` <small>${cuenta(k)}</small>`}</button>`).join('')}</div>
    <section class="sis-tarjeta">${vis.length ? `<div class="sis-lista">${vis.map(f => `<a class="sis-fila ge-fila" href="#/personal/${esc(f.p.id)}">${avatar(f.p, 'chico')}
        <span class="sis-fila-txt"><b>${esc(f.p.nombre)}</b><span class="sis-tenue">${esc(f.p.cargo || 'Sin cargo')}${f.fi.turno ? ` · turno ${esc(f.fi.turno === 'otro' ? 'especial' : f.fi.turno.replace('x', '×'))}` : ''}${f.vac.saldo != null ? ` · ${num(f.vac.saldo)} días de vacaciones${f.vac.estimado ? ' (estimado)' : ''}` : ''}</span></span>
        <span class="sis-chips">${chipHoy(f.u)}${alertas(f)}${chipHab(f.h)}</span></a>`).join('')}</div>` : vacio(filas.length ? 'Ninguna persona coincide con el filtro.' : 'Aún no hay trabajadores registrados. Use «+ Trabajador» para agregar el primero.')}</section>
    <p class="sis-tenue">«Habilitado» considera los documentos obligatorios definidos en Administración › Configuración. La acreditación ante cada mandante se revisa en la ficha de la persona.</p>
    ${bajas.length ? `<details class="sis-papelera"><summary>Personal dado de baja (${bajas.length})</summary><section class="sis-tarjeta"><div class="sis-lista">${bajas.map(p => `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(p.nombre)}</b><span class="sis-tenue">${esc(p.cargo || 'Sin cargo')}${p.bajaEn ? ` · baja el ${fechaLegible(p.bajaEn)}` : ''}</span></span><span class="sis-chips"><a class="sis-btn chico" href="#/personal/${esc(p.id)}">Ficha</a><button type="button" class="sis-btn chico" data-a="trabajador-reincorporar" data-id="${esc(p.id)}">Reincorporar</button></span></div>`).join('')}</div>
      <p class="sis-tenue">La ficha y los documentos se conservan. Una persona dada de baja no aparece en las listas para asignar proyectos ni equipos.</p></section></details>` : ''}`;
}

function csvDotacion(st) {
  const c = x => `"${String(x ?? '').replace(/"/g, '""')}"`;
  const filas = filasDotacion(st).map(f => {
    const per = f.fi.personal || {}, con = f.fi.contrato || {};
    return [f.p.nombre, per.rut, f.p.cargo, (f.p.roles || []).map(r => NOMBRE_ROL_PERSONA[r] || r).join(', '), per.telefono, per.correo, con.tipo, con.ingreso, con.termino, f.fi.turno,
      f.u.estado === 'ausente' ? 'Ausente' : f.u.estado === 'proyecto' ? f.u.proyectos.map(p => p.nombre).join(' / ') : 'Disponible',
      f.h.nivel === 'no' ? 'No habilitado' : 'Habilitado', f.malos, f.porVencer, f.vac.saldo ?? ''];
  });
  return [['Nombre', 'RUT', 'Cargo', 'Roles', 'Teléfono', 'Correo', 'Contrato', 'Ingreso', 'Término', 'Turno', 'Ubicación hoy', 'Habilitación', 'Documentos vencidos o faltantes', 'Documentos por vencer', 'Saldo de vacaciones'], ...filas].map(f => f.map(c).join(';')).join('\r\n');
}

// ─────────────────────────── Distribución ───────────────────────────
export function distribucion(v) {
  const { st } = v;
  if (!gestiona(v)) return vacio('Esta sección es de Recursos Humanos y Jefatura.');
  const hoy = hoyISO(), base = { ...st.d, hoy, diasAviso: st.d.config.diasAviso };
  const modo = st.distModo === 'semana' ? 'semana' : 'proyecto';
  const activos = st.proyectos.filter(p => p.id !== 'oficina' && p.estado !== 'cerrado');
  const segmento = `<div class="ad-segmento" role="tablist" aria-label="Vista">${[['proyecto', 'Por proyecto'], ['semana', 'Por semana']].map(([k, t]) => `<button type="button" role="tab" aria-selected="${modo === k}" class="${modo === k ? 'activo' : ''}" data-a="dist-modo" data-k="${k}">${t}</button>`).join('')}</div>`;
  const cab = `<div class="sis-cab"><div><h1>Distribución del personal</h1><span class="sis-tenue">Ubicación de cada trabajador en los proyectos activos. Los cambios se reflejan en el equipo de trabajo de cada proyecto.</span></div>${segmento}</div>`;

  if (modo === 'semana') {
    const lunes = lunesDe(hoy), semanas = Array.from({ length: 6 }, (_, k) => mas(lunes, 7 * k));
    return `${cab}
      <section class="sis-tarjeta"><div class="sis-tabla-scroll"><table class="sis-tabla ge-semanas"><thead><tr><th>Trabajador</th>${semanas.map((s, k) => `<th class="${k === 0 ? 'actual' : ''}">${k === 0 ? 'Esta semana' : `Semana del ${diaMes(s)}`}</th>`).join('')}</tr></thead>
        <tbody>${st.personas.map(p => `<tr><td><a href="#/personal/${esc(p.id)}"><b>${esc(p.nombre)}</b></a><small>${esc(p.cargo || '')}</small></td>${ocupacionSemanal(p.id, semanas, { ausencias: st.d.ausencias, proyectos: st.proyectos }).map(c => `<td>${c.ausencia ? `<span class="ge-celda aus" title="${esc(NOMBRE_AUSENCIA[c.ausencia.tipo] || 'Ausencia')} del ${fechaLegible(c.ausencia.desde)} al ${fechaLegible(c.ausencia.hasta || c.ausencia.desde)}">${esc(NOMBRE_AUSENCIA[c.ausencia.tipo] || 'Ausencia')}${c.ausencia.estado === 'solicitada' ? ' (por aprobar)' : ''}</span>` : ''}${c.proyectos.map(q => `<a class="ge-celda proy" href="#/proyecto/${esc(q.id)}" title="${esc(q.nombre)}">${esc(q.nombre)}</a>`).join('')}${!c.ausencia && !c.proyectos.length ? '<span class="ge-celda libre">Disponible</span>' : ''}${c.ausencia && c.proyectos.length ? '<span class="ge-cruce" title="Ausencia que coincide con un proyecto">!</span>' : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="sis-tenue">Considera el cronograma de cada proyecto (o su fecha de encargo y plazo) y las ausencias registradas. El signo «!» indica una ausencia que coincide con un proyecto asignado.</p></section>`;
  }

  const u = id => ubicacionPersona(id, { ausencias: st.d.ausencias, proyectos: st.proyectos, fecha: hoy });
  const ficha = (p, proy) => {
    const x = u(p.id), h = habilitacionPersona(p.id, base), otros = proyectosActivosDe(p.id, st.proyectos).filter(q => !proy || q.id !== proy.id).length;
    const encargado = proy && proy.encargadoId === p.id;
    return `<div class="ge-ficha${x.estado === 'ausente' ? ' ausente' : ''}" draggable="true" data-persona="${esc(p.id)}" data-desde="${esc(proy ? proy.id : '')}">${avatar(p, 'mini')}
      <span class="ge-ficha-txt"><b>${esc(p.nombre)}</b><small>${esc(p.cargo || 'Sin cargo')}${encargado ? ' · encargado' : ''}</small></span>
      <span class="ge-ficha-marcas">${x.estado === 'ausente' ? `<i class="ge-punto rojo" title="${esc(NOMBRE_AUSENCIA[x.ausencia.tipo] || 'Ausente')} hasta el ${fechaLegible(x.ausencia.hasta || x.ausencia.desde)}"></i>` : ''}${h.nivel === 'no' ? '<i class="ge-punto ambar" title="No habilitado: documentos pendientes"></i>' : ''}${proy && otros ? `<small title="Participa en ${otros} proyecto(s) más">+${otros}</small>` : ''}</span>
      ${proy && !encargado ? `<button type="button" class="ge-quitar" data-a="dist-quitar" data-persona="${esc(p.id)}" data-proy="${esc(proy.id)}" aria-label="Quitar a ${esc(p.nombre)} de ${esc(proy.nombre)}">×</button>` : ''}</div>`;
  };
  const libres = st.personas.filter(p => !proyectosActivosDe(p.id, st.proyectos).length);
  const columna = proy => {
    const gente = [...new Set([proy.encargadoId, ...(proy.cuadrilla || [])].filter(Boolean))].map(id => st.personas.find(x => x.id === id)).filter(Boolean);
    const fuera = st.personas.filter(p => !gente.includes(p));
    return `<div class="ge-col" data-proy="${esc(proy.id)}"><div class="ge-col-cab"><a href="#/proyecto/${esc(proy.id)}"><b>${esc(proy.nombre)}</b></a><small>${esc(proy.mandante || 'Sin mandante')} · ${plural(gente.length, 'persona', 'personas')}</small></div>
      <div class="ge-col-cuerpo">${gente.map(p => ficha(p, proy)).join('') || '<p class="sis-tenue">Sin personas asignadas.</p>'}</div>
      ${fuera.length ? `<select class="ge-agregar" data-c="dist-agregar" data-proy="${esc(proy.id)}" aria-label="Agregar persona a ${esc(proy.nombre)}"><option value="">+ Agregar persona…</option>${fuera.map(p => `<option value="${esc(p.id)}">${esc(p.nombre)}${u(p.id).estado === 'ausente' ? ' (ausente hoy)' : ''}</option>`).join('')}</select>` : ''}</div>`;
  };
  return `${cab}
    <p class="sis-tenue ge-ayuda" data-solo-pc>Arrastre a una persona hasta un proyecto para asignarla; entre proyectos, se traslada. También puede usar «+ Agregar persona» y el botón «×».</p>
    <div class="ge-tablero">
      <div class="ge-col libres" data-proy=""><div class="ge-col-cab"><b>Sin proyecto asignado</b><small>${plural(libres.length, 'persona', 'personas')}</small></div>
        <div class="ge-col-cuerpo">${libres.map(p => ficha(p, null)).join('') || '<p class="sis-tenue">Todo el personal tiene proyecto.</p>'}</div></div>
      ${activos.map(columna).join('')}
    </div>
    ${activos.length ? '' : vacio('Aún no hay proyectos activos. Se crean con «Encargar proyecto».')}
    <p class="sis-tenue">El punto rojo indica ausencia hoy; el ámbar, documentación pendiente. El encargado de un proyecto se cambia desde «Editar» en la ficha del proyecto.</p>`;
}

/** Suma o quita a una persona del equipo de trabajo de un proyecto. */
async function moverPersona(v, personaId, { a = null, de = null }) {
  const proy = id => v.st.proyectos.find(p => p.id === id);
  if (de && de !== a) {
    const p = proy(de);
    if (p && p.encargadoId === personaId) { v.avisar('El encargado se cambia desde «Editar» en la ficha del proyecto.'); return false; }
    if (p) await guardarProyecto({ id: p.id, cuadrilla: (p.cuadrilla || []).filter(x => x !== personaId) }, { personaId: v.ctx.personaId });
  }
  if (a && a !== de) {
    const p = proy(a);
    if (p && !(p.cuadrilla || []).includes(personaId) && p.encargadoId !== personaId) await guardarProyecto({ id: p.id, cuadrilla: [...(p.cuadrilla || []), personaId] }, { personaId: v.ctx.personaId });
  }
  return true;
}

/** Arrastrar y soltar personas entre columnas (computador). Se llama una vez al montar el módulo. */
export function iniciarArrastre(v, raiz, recargar) {
  let llevando = null;
  raiz.addEventListener('dragstart', ev => {
    const f = ev.target.closest && ev.target.closest('.ge-ficha');
    if (!f) return;
    llevando = { persona: f.dataset.persona, de: f.dataset.desde || null };
    ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', llevando.persona);
    f.classList.add('llevando');
  });
  raiz.addEventListener('dragend', () => { llevando = null; raiz.querySelectorAll('.llevando, .sobre').forEach(x => x.classList.remove('llevando', 'sobre')); });
  raiz.addEventListener('dragover', ev => {
    const col = ev.target.closest && ev.target.closest('.ge-col');
    if (!col || !llevando) return;
    ev.preventDefault();
    raiz.querySelectorAll('.ge-col.sobre').forEach(x => x !== col && x.classList.remove('sobre'));
    col.classList.add('sobre');
  });
  raiz.addEventListener('drop', async ev => {
    const col = ev.target.closest && ev.target.closest('.ge-col');
    if (!col || !llevando) return;
    ev.preventDefault();
    const { persona, de } = llevando, a = col.dataset.proy || null;
    llevando = null;
    if (a === de) return;
    try { if (await moverPersona(v, persona, { a, de })) { v.avisar(a ? 'Persona asignada al proyecto' : 'Persona retirada del proyecto'); } await recargar(); } catch (e) { console.error(e); v.avisar(e.message); }
  });
}

// ─────────────────────────── Vacaciones y ausencias ───────────────────────────
const chipEstado = e => ({ solicitada: '<span class="sis-chip ambar">Por aprobar</span>', aprobada: '<span class="sis-chip verde">Aprobada</span>', rechazada: '<span class="sis-chip gris">Rechazada</span>' }[e] || '');

function formAusencia(v, { personaFija = null, solicitud = false } = {}) {
  return `<form class="sis-form" data-f="ausencia" data-id="${esc(personaFija || '')}"${solicitud ? ' data-solicitud="1"' : ''}>
    <div class="sis-par">${personaFija ? '' : campo('Trabajador', select('personaId', v.st.personas.map(p => [p.id, p.nombre]), '', { vacio: 'Seleccione', extra: 'required' }))}${campo('Tipo', select('tipo', solicitud ? TIPOS_AUSENCIA.filter(([k]) => ['vacaciones', 'permiso'].includes(k)) : TIPOS_AUSENCIA, 'vacaciones'))}${solicitud ? '' : campo('Estado', select('estado', [['aprobada', 'Aprobada'], ['solicitada', 'Por aprobar']], 'aprobada'))}</div>
    <div class="sis-par">${campo('Desde', fecha('desde', '', 'required'))}${campo('Hasta', fecha('hasta', '', 'required'))}</div>
    ${campo('Nota', input('nota', '', 'placeholder="Opcional"'))}
    <div class="sis-acciones"><button class="sis-btn primario">${solicitud ? 'Enviar solicitud' : 'Registrar'}</button></div></form>`;
}

function lineaDeTiempo(st, hoy) {
  const inicio = lunesDe(hoy), DIAS = 56, fin = mas(inicio, DIAS - 1);
  const aus = st.d.ausencias.filter(a => a.estado !== 'rechazada' && (a.hasta || a.desde) >= inicio && a.desde <= fin);
  const gente = st.personas.filter(p => aus.some(a => a.personaId === p.id));
  if (!gente.length) return vacio('Sin ausencias registradas en las próximas ocho semanas.');
  const col = iso => Math.max(0, Math.min(DIAS, Math.round((new Date(`${iso}T12:00:00`) - new Date(`${inicio}T12:00:00`)) / 86400000)));
  const semanas = Array.from({ length: 8 }, (_, k) => mas(inicio, 7 * k));
  return `<div class="ge-linea"><span></span><div class="ge-linea-cab">${semanas.map(s => `<span>${diaMes(s)}</span>`).join('')}</div>
    ${gente.map(p => `<a class="ge-linea-nombre" href="#/personal/${esc(p.id)}/vacaciones">${esc(p.nombre)}</a><div class="ge-linea-pista"><em class="ge-hoy" style="left:${(100 * (col(hoy) + 0.5) / DIAS).toFixed(2)}%" title="Hoy"></em>${aus.filter(a => a.personaId === p.id).map(a => { const i = col(a.desde < inicio ? inicio : a.desde), f = col((a.hasta || a.desde) > fin ? fin : (a.hasta || a.desde)) + 1; return `<i class="${a.tipo}${a.estado === 'solicitada' ? ' pend' : ''}" style="left:${(100 * i / DIAS).toFixed(2)}%;width:${(100 * Math.max(1, f - i) / DIAS).toFixed(2)}%" title="${esc(NOMBRE_AUSENCIA[a.tipo] || 'Ausencia')} · ${fechaLegible(a.desde)} al ${fechaLegible(a.hasta || a.desde)}${a.estado === 'solicitada' ? ' · por aprobar' : ''}"></i>`; }).join('')}</div>`).join('')}</div>
    <div class="ge-linea-ley"><span><i class="vacaciones"></i>Vacaciones</span><span><i class="permiso"></i>Permiso</span><span><i class="licencia"></i>Licencia médica</span><span><i class="descanso"></i>Descanso de turno</span><span><i class="pend"></i>Por aprobar</span></div>`;
}

export function vacaciones(v) {
  const { st } = v;
  const hoy = hoyISO();
  if (!gestiona(v)) return misVacaciones(v, hoy);
  const nom = id => v.nomPers(id) || 'Persona';
  const solicitudes = st.d.ausencias.filter(a => a.estado === 'solicitada').sort((a, b) => String(a.desde).localeCompare(String(b.desde)));
  const hoyFuera = st.d.ausencias.filter(a => a.estado === 'aprobada' && a.desde <= hoy && hoy <= (a.hasta || a.desde));
  const prox = st.d.ausencias.filter(a => a.estado === 'aprobada' && a.desde > hoy && a.desde <= mas(hoy, 30));
  const saldos = st.personas.map(p => ({ p, fi: st.d.fichas.find(x => x.id === p.id) || {}, r: resumenVacaciones(p.id, { ...st.d, hoy }) }));
  return `<div class="sis-cab"><div><h1>Vacaciones y ausencias</h1><span class="sis-tenue">Solicitudes, saldos y ausencias programadas de todo el personal. Antes de aprobar se advierte si la ausencia coincide con un proyecto asignado.</span></div></div>
    <div class="sis-kpis ad-kpis4">
      <div class="sis-kpi ${solicitudes.length ? 'ambar' : ''}"><span>Solicitudes por aprobar</span><b>${solicitudes.length}</b></div>
      <div class="sis-kpi"><span>Ausentes hoy</span><b>${hoyFuera.length}</b>${hoyFuera.length ? `<small class="sis-tenue">${esc(hoyFuera.map(a => nom(a.personaId).split(' ')[0]).join(', '))}</small>` : ''}</div>
      <div class="sis-kpi"><span>Ausencias en los próximos 30 días</span><b>${prox.length}</b></div>
      <div class="sis-kpi"><span>Días de vacaciones por tomar</span><b>${num(saldos.reduce((s, x) => s + (x.r.saldo > 0 ? x.r.saldo : 0), 0))}</b></div>
    </div>
    <div class="sis-dos"><div>
      <section class="sis-tarjeta"><h2>Solicitudes por aprobar</h2>
        ${solicitudes.length ? `<div class="sis-lista">${solicitudes.map(a => { const cr = crucesAusencia(a, st.proyectos); return `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(nom(a.personaId))} · ${esc(NOMBRE_AUSENCIA[a.tipo] || 'Ausencia')}</b><span>${fechaLegible(a.desde)} al ${fechaLegible(a.hasta || a.desde)} · ${plural(diasHabiles(a.desde, a.hasta || a.desde), 'día hábil', 'días hábiles')}${a.nota ? ` · ${esc(a.nota)}` : ''}</span>
            ${cr.length ? `<span class="ge-cruce-txt">Coincide con ${cr.map(p => `<a href="#/proyecto/${esc(p.id)}">${esc(p.nombre)}</a>`).join(', ')}: coordine un reemplazo antes de aprobar.</span>` : '<span class="sis-tenue">Sin proyectos asignados en esas fechas.</span>'}</span>
          <span class="sis-chips"><button type="button" class="sis-btn chico primario" data-a="ausencia-estado" data-id="${esc(a.id)}" data-e="aprobada">Aprobar</button><button type="button" class="sis-btn chico" data-a="ausencia-estado" data-id="${esc(a.id)}" data-e="rechazada">Rechazar</button></span></div>`; }).join('')}</div>` : vacio('No hay solicitudes pendientes.')}</section>
      <section class="sis-tarjeta"><h2>Próximas ocho semanas</h2>${lineaDeTiempo(st, hoy)}</section>
      <section class="sis-tarjeta"><div class="sis-cab"><h2>Saldos de vacaciones</h2></div>
        <div class="sis-tabla-scroll"><table class="sis-tabla"><thead><tr><th>Trabajador</th><th>Ingreso</th><th>Devengadas</th><th>Tomadas</th><th>Saldo</th><th>Próxima ausencia</th></tr></thead>
          <tbody>${saldos.map(({ p, fi, r }) => `<tr><td><a href="#/personal/${esc(p.id)}/vacaciones"><b>${esc(p.nombre)}</b></a>${fi.turno ? `<small>Turno ${esc(NOMBRE_TURNO[fi.turno] || fi.turno)}</small>` : ''}</td><td class="mono">${fi.contrato && fi.contrato.ingreso ? fechaLegible(fi.contrato.ingreso) : '—'}</td><td class="mono">${fi.contrato && fi.contrato.ingreso ? num(r.devengadas) : '—'}</td><td class="mono">${num(r.tomadas)}</td>
            <td class="mono"><b>${num(r.saldo)}</b>${r.estimado ? '<small>estimado</small>' : ''}${r.saldo != null && r.saldo > 30 ? '<small class="enc-rojo">acumula más de dos períodos</small>' : ''}</td>
            <td>${r.proximas[0] ? `${esc(NOMBRE_AUSENCIA[r.proximas[0].tipo] || 'Ausencia')} · ${fechaLegible(r.proximas[0].desde)} ${chipEstado(r.proximas[0].estado)}` : '—'}</td></tr>`).join('')}</tbody></table></div>
        <p class="sis-tenue">«Devengadas» se estima con la fecha de ingreso del contrato (15 días hábiles por año). Si Recursos Humanos registra un saldo en la ficha, ese valor prevalece.</p></section>
    </div><aside>
      <section class="sis-tarjeta"><h2>Registrar ausencia</h2>${formAusencia(v)}
        <p class="sis-tenue">Las ausencias aparecen en el calendario, en la distribución del personal y al armar el equipo de un proyecto.</p></section>
    </aside></div>`;
}

function misVacaciones(v, hoy) {
  const { st } = v, yo = st.personas.find(p => p.id === v.ctx.personaId);
  if (!yo) return `<div class="sis-cab"><h1>Mis vacaciones</h1></div>${vacio('Seleccione su persona en el encabezado para ver su saldo y solicitar vacaciones.')}`;
  const r = resumenVacaciones(yo.id, { ...st.d, hoy });
  const mias = st.d.ausencias.filter(a => a.personaId === yo.id).sort((a, b) => String(b.desde).localeCompare(String(a.desde)));
  return `<div class="sis-cab"><div><h1>Mis vacaciones</h1><span class="sis-tenue">Saldo, solicitudes y ausencias registradas de ${esc(yo.nombre)}.</span></div></div>
    <div class="sis-kpis ad-kpis4">
      <div class="sis-kpi"><span>Saldo disponible</span><b>${num(r.saldo)} <small>días hábiles</small></b>${r.estimado ? '<small class="sis-tenue">estimado según la fecha de ingreso</small>' : ''}</div>
      <div class="sis-kpi"><span>Días tomados</span><b>${num(r.tomadas)}</b></div>
      <div class="sis-kpi ${r.porAprobar ? 'ambar' : ''}"><span>Solicitudes por aprobar</span><b>${r.porAprobar}</b></div>
      <div class="sis-kpi"><span>Próxima ausencia</span><b class="ge-kpi-txt">${r.proximas[0] ? fechaLegible(r.proximas[0].desde) : '—'}</b></div>
    </div>
    <div class="sis-dos"><div><section class="sis-tarjeta"><h2>Mis solicitudes y ausencias</h2>
      ${mias.length ? `<div class="sis-lista">${mias.map(a => `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(NOMBRE_AUSENCIA[a.tipo] || 'Ausencia')} · ${fechaLegible(a.desde)} al ${fechaLegible(a.hasta || a.desde)}</b><span class="sis-tenue">${plural(diasHabiles(a.desde, a.hasta || a.desde), 'día hábil', 'días hábiles')}${a.nota ? ` · ${esc(a.nota)}` : ''}</span></span><span class="sis-chips">${chipEstado(a.estado)}${a.estado === 'solicitada' ? `<button type="button" class="sis-btn chico" data-a="ausencia-anular" data-id="${esc(a.id)}">Anular</button>` : ''}</span></div>`).join('')}</div>` : vacio('Sin solicitudes ni ausencias registradas.')}</section></div>
    <aside><section class="sis-tarjeta"><h2>Solicitar vacaciones o permiso</h2>${formAusencia(v, { personaFija: yo.id, solicitud: true })}
      <p class="sis-tenue">La solicitud queda «por aprobar» y la resuelve Recursos Humanos o Jefatura.</p></section></aside></div>`;
}

// ─────────────────────────── Acciones y formularios ───────────────────────────
export const acciones = {
  'trabajador-nuevo': (b, v) => { v.st.nuevoTrabajador = true; return true; },
  'trabajador-cancelar': (b, v) => { v.st.nuevoTrabajador = false; return true; },
  'trabajador-reincorporar': async (b, v) => { await guardarPersona({ id: b.dataset.id, activo: true, bajaEn: null }, { personaId: v.ctx.personaId }); await v.ctx.recargarPersonas(); v.avisar('Trabajador reincorporado'); return true; },
  'trabajador-baja': async (b, v) => {
    const p = v.st.personas.find(x => x.id === b.dataset.id);
    if (!p) return false;
    const act = proyectosActivosDe(p.id, v.st.proyectos);
    if (!confirm(`¿Dar de baja a ${p.nombre}?\n\n${act.length ? `Participa en ${act.length} proyecto(s) activo(s): quedará en ellos hasta que se le reemplace.\n\n` : ''}Su ficha y sus documentos se conservan y se puede reincorporar desde Personal.`)) return false;
    await guardarPersona({ id: p.id, activo: false, bajaEn: hoyISO() }, { personaId: v.ctx.personaId });
    await v.ctx.recargarPersonas();
    v.avisar('Trabajador dado de baja'); v.ir('#/personal'); return false;
  },
  'dotacion-csv': (b, v) => { descargar(`Dotacion_${hoyISO()}.csv`, '﻿' + csvDotacion(v.st), 'text/csv;charset=utf-8'); v.avisar('Dotación exportada'); return false; },
  'dist-modo': (b, v) => { v.st.distModo = b.dataset.k; return true; },
  'dist-quitar': async (b, v) => { if (await moverPersona(v, b.dataset.persona, { de: b.dataset.proy })) v.avisar('Persona retirada del proyecto'); return true; },
  'ausencia-anular': async (b, v) => { await guardarRegistro(ALM.ausencias, { id: b.dataset.id, estado: 'rechazada', nota: 'Anulada por el trabajador' }); v.avisar('Solicitud anulada'); return true; },
};

export const cambios = {
  'dist-agregar': async (i, v) => { if (!i.value) return false; await moverPersona(v, i.value, { a: i.dataset.proy }); v.avisar('Persona asignada al proyecto'); return true; },
};

const txt = (fd, k) => String(fd.get(k) || '').trim();
export const formularios = {
  trabajador: async (f, fd, v) => {
    const p = await guardarPersona({ nombre: txt(fd, 'nombre'), cargo: txt(fd, 'cargo'), roles: fd.getAll('roles') }, { personaId: v.ctx.personaId });
    v.st.nuevoTrabajador = false;
    await v.ctx.recargarPersonas();
    v.avisar('Trabajador creado: complete su ficha'); v.ir(`#/personal/${p.id}`); return false;
  },
  'datos-personales': async (f, fd, v) => {
    const id = f.dataset.id;
    await guardarPersona({ id, nombre: txt(fd, 'nombre'), cargo: txt(fd, 'cargo'), roles: fd.getAll('roles') }, { personaId: v.ctx.personaId });
    await guardarFicha(id, { personal: { rut: txt(fd, 'rut'), nacimiento: fd.get('nacimiento') || '', telefono: txt(fd, 'telefono'), correo: txt(fd, 'correo'), direccion: txt(fd, 'direccion'), prevision: txt(fd, 'prevision'), salud: txt(fd, 'salud') } });
    await v.ctx.recargarPersonas();
    v.avisar('Datos guardados'); return true;
  },
};
