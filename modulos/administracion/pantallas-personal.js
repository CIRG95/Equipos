// modulos/administracion/pantallas-personal.js — Personal para Recursos Humanos (Sistema v0.15).
// Resumen de habilitación, ficha completa por persona (documentos, acreditación, contrato, vacaciones y turnos, EPP,
// CV, ingreso y salida, contacto de emergencia) y paquetes de documentación para licitaciones con «Descargar todo».
// Rutas: #/personal · #/personal/<personaId>[/<pestaña>] · #/personal/licitaciones · #/personal/licitacion/<id>

import { hoyISO, descargar, cargarScript } from '../../compartido/util.js';
import { contenidoArchivo, abrirArchivo } from '../../compartido/archivos.js';
import { armarZip, bytesDeDataURL, nombreSeguro } from '../../compartido/zip.js';
import { ultimoDoc } from '../../compartido/vencimientos.js';
import { ALM, guardarDocumento, guardarFicha, guardarRegistro, aPapelera } from './datos.js';
import {
  tiposDe, docsDe, habilitacionPersona, acreditacion, estadoDocumentos, avisoContrato, eppPorReponer, cumplimientoLicitacion,
  nombreEnPaquete, mandanteDeProyecto, TURNOS, TIPOS_CONTRATO, TIPOS_AUSENCIA, NOMBRE_AUSENCIA, NOMBRE_CONTRATO, ESTADOS_PLATAFORMA,
} from './modelo.js';
import { esc, fechaLegible, vacio, plural, chipVenc, chipHab, chipPlataforma, pestanas, campo, input, fecha, select, firmaCambio, ICO } from './ui.js';

const PESTANAS_FICHA = [
  ['documentos', 'Documentos'], ['acreditacion', 'Acreditación por mandante'], ['contrato', 'Contrato'], ['vacaciones', 'Vacaciones y turnos'],
  ['epp', 'EPP'], ['cv', 'CV para licitaciones'], ['ingreso', 'Ingreso y salida'], ['emergencia', 'Contacto de emergencia'],
];

const aviso = `<div class="ad-confidencial">${ICO.candado}<span>Información confidencial. Los encargados de terreno solo visualizan si una persona está habilitada. Los documentos se muestran únicamente con el rol de Recursos Humanos.</span></div>`;

// ─────────────────────────── Resumen ───────────────────────────
export async function personalResumen(v) {
  const { st } = v;
  const hoy = hoyISO(), base = { ...st.d, hoy, diasAviso: st.d.config.diasAviso };
  const filas = st.personas.map(p => {
    const h = habilitacionPersona(p.id, base);
    const docs = estadoDocumentos('persona', p.id, base);
    const porVencer = docs.filter(f => f.e.estado === 'por_vencer').length;
    const malos = docs.filter(f => (f.doc || f.tipo.obligatorio) && ['vencido', 'falta'].includes(f.e.estado)).length;
    return { p, h, porVencer, malos };
  });
  if (v.ctx.rol !== 'rrhh') {
    return `<div class="sis-cab"><h1>Habilitación del personal</h1></div>
      <p class="sis-tenue">Indica si cada persona tiene su documentación obligatoria al día. El detalle de los documentos lo administra Recursos Humanos.</p>
      <section class="sis-tarjeta">${filas.length ? `<div class="sis-lista">${filas.map(f => `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(f.p.nombre)}</b><span class="sis-tenue">${esc(f.p.cargo || 'Sin cargo')}</span></span><span class="sis-chips">${chipHab(f.h, { aviso: 'Habilitado' })}</span></div>`).join('')}</div>` : vacio('Aún no hay personas registradas.')}</section>`;
  }
  const filtro = st.filtroPersonal || 'todos';
  const vis = filas.filter(f => filtro === 'todos' || (filtro === 'no' && f.h.nivel === 'no') || (filtro === 'aviso' && (f.porVencer || f.h.nivel === 'aviso')));
  const n = k => filas.filter(k).length;
  return `<div class="sis-cab"><div><h1>Personal</h1><span class="sis-tenue">Control de la documentación del personal. Seleccione una persona para revisar y actualizar su ficha.</span></div>
      <a class="sis-btn primario" href="#/personal/licitaciones">Armar paquete de licitación</a></div>
    ${aviso}
    <div class="sis-kpis ad-kpis4">
      <div class="sis-kpi"><span>Personas</span><b>${filas.length}</b></div>
      <div class="sis-kpi"><span>Habilitadas</span><b>${n(f => f.h.habilitado)}</b></div>
      <div class="sis-kpi ${n(f => f.porVencer) ? 'ambar' : ''}"><span>Con documentos por vencer (${st.d.config.diasAviso} días)</span><b>${n(f => f.porVencer)}</b></div>
      <div class="sis-kpi ${n(f => f.malos) ? 'rojo' : ''}"><span>Con documentos vencidos o faltantes</span><b>${n(f => f.malos)}</b></div>
    </div>
    <div class="ad-filtros" role="group" aria-label="Filtro">${[['todos', 'Todas'], ['no', 'No habilitadas'], ['aviso', 'Con vencimientos próximos']].map(([k, t]) => `<button type="button" class="sis-btn chico${filtro === k ? ' activo' : ''}" aria-pressed="${filtro === k}" data-a="filtro-personal" data-k="${k}">${t}</button>`).join('')}</div>
    <section class="sis-tarjeta">${vis.length ? `<div class="sis-lista">${vis.map(f => `<a class="sis-fila" href="#/personal/${esc(f.p.id)}">
        <span class="sis-fila-txt"><b>${esc(f.p.nombre)}</b><span class="sis-tenue">${esc(f.p.cargo || 'Sin cargo')}${f.malos ? ` · ${plural(f.malos, 'documento vencido o faltante', 'documentos vencidos o faltantes')}` : ''}${f.porVencer ? ` · ${f.porVencer} por vencer` : ''}</span></span>
        <span class="sis-chips">${chipHab(f.h)}</span></a>`).join('')}</div>` : vacio(filas.length ? 'Ninguna persona coincide con el filtro.' : 'Aún no hay personas. Agréguelas en Personas.')}</section>
    <p class="sis-tenue">«Habilitado» considera los documentos marcados como obligatorios en Administración › Configuración. La acreditación ante cada mandante se revisa en la ficha de la persona.</p>`;
}

// ─────────────────────────── Tabla de documentos (personas y vehículos) ───────────────────────────
export function tablaDocumentos(v, duenoTipo, duenoId, { titulo = 'Documentos' } = {}) {
  const { st } = v;
  const hoy = hoyISO(), base = { ...st.d, hoy, diasAviso: st.d.config.diasAviso };
  const filas = estadoDocumentos(duenoTipo, duenoId, base);
  // Mandantes que exigen cada tipo (para registrar el estado en su plataforma, p. ej. SUCAL)
  const exigen = tipoId => st.d.mandantes.filter(m => ((duenoTipo === 'vehiculo' ? m.requisitosVehiculo : m.requisitosPersona) || []).some(r => r.tipoId === tipoId));
  const editando = st.editDoc && st.editDoc.duenoId === duenoId ? st.editDoc.tipoId : null;
  const fila = f => {
    const ms = exigen(f.tipo.id);
    const plat = ms.map(m => `<span class="ad-plat"><small>${esc(m.plataforma || m.nombre)}</small>${chipPlataforma(f.doc && f.doc.estadoMandante ? f.doc.estadoMandante[m.id] : null)}</span>`).join('');
    return `<tr${editando === f.tipo.id ? ' class="ad-editando"' : ''}>
      <td><b>${esc(f.tipo.nombre)}</b>${f.tipo.obligatorio ? '' : '<small class="sis-tenue"> · opcional</small>'}</td>
      <td class="mono">${f.doc && f.doc.inicio ? fechaLegible(f.doc.inicio) : '—'}</td>
      <td class="mono">${f.tipo.vence ? (f.doc && f.doc.vence ? fechaLegible(f.doc.vence) : '—') : 'No vence'}</td>
      <td>${chipVenc(f.e, { conDias: true })}</td>
      <td>${plat || '<span class="sis-tenue">—</span>'}</td>
      <td class="ad-acciones-celda">${f.doc && f.doc.archivoId ? `<button type="button" class="sis-btn chico" data-a="ver-archivo" data-id="${esc(f.doc.archivoId)}" aria-label="Ver ${esc(f.tipo.nombre)}">${ICO.ver}Ver</button>` : ''}
        <button type="button" class="sis-btn chico" data-a="doc-editar" data-dueno="${duenoTipo}" data-id="${esc(duenoId)}" data-tipo="${esc(f.tipo.id)}">${f.doc ? 'Actualizar' : 'Cargar'}</button></td>
    </tr>${editando === f.tipo.id ? `<tr class="ad-form-fila"><td colspan="6">${formDocumento(v, duenoTipo, duenoId, f, ms)}</td></tr>` : ''}`;
  };
  return `<section class="sis-tarjeta"><div class="sis-cab"><h2>${esc(titulo)}</h2></div>
    <div class="sis-tabla-scroll"><table class="sis-tabla ad-docs"><thead><tr><th>Documento</th><th>Inicio</th><th>Término</th><th>Vigencia</th><th>Estado en plataforma</th><th>Acción</th></tr></thead>
    <tbody>${filas.map(fila).join('')}</tbody></table></div>
    <p class="sis-tenue">Use «Cargar» o «Actualizar» para registrar fechas y adjuntar el archivo. La vigencia se calcula con la fecha de término; el estado en la plataforma del mandante se registra por separado.</p></section>`;
}

function formDocumento(v, duenoTipo, duenoId, f, mandantes) {
  const d = f.doc || {};
  return `<form class="sis-form ad-form-doc" data-f="documento" data-dueno="${duenoTipo}" data-id="${esc(duenoId)}" data-tipo="${esc(f.tipo.id)}">
    <p><b>${esc(f.tipo.nombre)}</b> · ${d.id ? 'actualizar el documento vigente o cargar uno nuevo' : 'cargar documento'}</p>
    <div class="sis-par">${campo('Fecha de inicio', fecha('inicio', d.inicio))}${f.tipo.vence ? campo('Fecha de término (vencimiento)', fecha('vence', d.vence, 'required')) : '<p class="sis-tenue">Este documento no vence.</p>'}</div>
    ${campo('Archivo (PDF o foto)', '<input type="file" name="archivo" accept="application/pdf,image/*">', { ayuda: d.archivoId ? 'Si no adjunta un archivo nuevo, se mantiene el actual.' : '' })}
    ${mandantes.length ? `<div class="sis-par">${mandantes.map(m => campo(`Estado en ${m.plataforma || m.nombre}`, select(`plat_${m.id}`, ESTADOS_PLATAFORMA.map(([k, t]) => [k, t]), d.estadoMandante ? d.estadoMandante[m.id] : '', { vacio: 'Sin subir' }))).join('')}</div>` : ''}
    ${campo('Observación', input('observacion', d.observacion, 'placeholder="Opcional"'))}
    <label class="sis-opcion"><input type="checkbox" name="nuevo" ${d.id ? '' : 'checked disabled'}> Registrar como documento nuevo (renovación); el anterior queda en el historial</label>
    <div class="sis-acciones"><button class="sis-btn primario">Guardar documento</button><button type="button" class="sis-btn" data-a="doc-cancelar">Cancelar</button></div>
  </form>`;
}

// ─────────────────────────── Ficha de una persona ───────────────────────────
export async function personalFicha(v, id, tab = 'documentos') {
  const { st } = v;
  if (v.ctx.rol !== 'rrhh') return personalResumen(v);
  const p = st.personas.find(x => x.id === id);
  if (!p) return vacio('Esta persona no existe.', '<a class="sis-btn" href="#/personal">Volver a Personal</a>');
  if (!PESTANAS_FICHA.some(([k]) => k === tab)) tab = 'documentos';
  const hoy = hoyISO(), base = { ...st.d, hoy, diasAviso: st.d.config.diasAviso };
  const fi = st.d.fichas.find(x => x.id === id) || { id };
  const h = habilitacionPersona(id, base);
  const proyActual = st.proyectos.find(x => x.estado !== 'cerrado' && ((x.cuadrilla || []).includes(id) || x.encargadoId === id));
  const contenido = await ({ documentos: tabDocumentos, acreditacion: tabAcreditacion, contrato: tabContrato, vacaciones: tabVacaciones, epp: tabEpp, cv: tabCv, ingreso: tabIngreso, emergencia: tabEmergencia }[tab])(v, p, fi, base);
  return `<div class="sis-miga"><a href="#/personal">Personal</a> / ${esc(p.nombre)}</div>
    <section class="sis-tarjeta ad-cab-persona">
      <span class="ad-avatar" aria-hidden="true">${esc(iniciales(p.nombre))}</span>
      <div class="ad-cab-txt"><h1>${esc(p.nombre)}</h1><span class="sis-tenue">${esc(p.cargo || 'Sin cargo')}${proyActual ? ` · hoy en <a href="#/proyecto/${esc(proyActual.id)}">${esc(proyActual.nombre)}</a>` : ''}${fi.turno ? ` · turno ${esc(fi.turno)}` : ''}</span></div>
      <div class="sis-chips">${chipHab(h)}<button type="button" class="sis-btn chico" data-a="zip-persona" data-id="${esc(p.id)}">${ICO.descargar}Descargar todo</button></div>
    </section>
    <div class="ad-ficha">
      <nav class="ad-lateral" aria-label="Partes de la ficha">${PESTANAS_FICHA.map(([k, t]) => `<a href="#/personal/${esc(id)}/${k}" class="${k === tab ? 'activo' : ''}"${k === tab ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
      <div class="ad-ficha-cuerpo">${contenido}</div>
    </div>
    ${firmaCambio(fi.actualizadoEn ? fi : p, v.nomPers)}`;
}
const iniciales = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');

function tabDocumentos(v, p) {
  return `${aviso}${tablaDocumentos(v, 'persona', p.id)}
    <p class="sis-tenue">«Descargar todo» genera un archivo .zip con una carpeta a nombre de la persona y sus documentos vigentes.</p>`;
}

function tabAcreditacion(v, p, fi, base) {
  const ms = v.st.d.mandantes;
  if (!ms.length) return vacio('No hay mandantes registrados. Agréguelos en Administración › Mandantes.');
  return ms.map(m => {
    if (!(m.requisitosPersona || []).length) return `<section class="sis-tarjeta"><div class="sis-cab"><h2>${esc(m.nombre)}${m.plataforma ? ` <small class="sis-tenue">· ${esc(m.plataforma)}</small>` : ''}</h2><span class="sis-chip gris">Sin requisitos definidos</span></div>
      <p class="sis-tenue">Defina los documentos que exige este mandante para el personal en Administración › Mandantes.</p></section>`;
    const h = acreditacion(m, 'persona', p.id, base);
    return `<section class="sis-tarjeta"><div class="sis-cab"><h2>${esc(m.nombre)}${m.plataforma ? ` <small class="sis-tenue">· ${esc(m.plataforma)}</small>` : ''}</h2>${chipHab(h, { si: 'Acreditado', no: 'No acreditado', aviso: 'Acreditado · revisar fechas' })}</div>
      <div class="sis-lista">${h.filas.map(f => `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(f.tipo.nombre)}</b><span class="sis-tenue">${f.tipo.obligatorio ? 'Obligatorio' : 'Opcional'}${f.doc && f.doc.vence ? ` · término ${fechaLegible(f.doc.vence)}` : ''}</span></span><span class="sis-chips">${chipPlataforma(f.plataforma)}${chipVenc(f.e)}</span></div>`).join('')}</div></section>`;
  }).join('') + '<p class="sis-tenue">Los requisitos de acreditación se definen en la ficha de cada mandante. Para actualizar un documento, use la pestaña Documentos.</p>';
}

function tabContrato(v, p, fi, base) {
  const c = fi.contrato || {};
  const av = avisoContrato(fi, base);
  return `<section class="sis-tarjeta"><h2>Contrato</h2>
    ${av ? `<div class="sis-aviso-linea">El contrato ${av.estado === 'vencido' ? 'terminó' : 'termina'} el ${fechaLegible(c.termino)}. Gestione la renovación o el término con anticipación.</div>` : ''}
    <form class="sis-form" data-f="contrato" data-id="${esc(p.id)}">
      <div class="sis-par">${campo('Tipo de contrato', select('tipo', TIPOS_CONTRATO, c.tipo, { vacio: 'Seleccione' }))}${campo('Fecha de ingreso', fecha('ingreso', c.ingreso))}</div>
      <div class="sis-par">${campo('Fecha de término', fecha('termino', c.termino), { ayuda: 'Solo para contratos a plazo fijo o por obra. El sistema notifica 30 días antes.' })}${campo('Anexos', input('anexos', c.anexos, 'placeholder="Ej.: anexo de turnos 2024"'))}</div>
      <div class="sis-acciones"><button class="sis-btn primario">Guardar contrato</button></div>
    </form>
    <p class="sis-tenue">El documento del contrato se adjunta en la pestaña Documentos («Contrato de trabajo y anexos»).</p></section>`;
}

function tabVacaciones(v, p, fi) {
  const aus = v.st.d.ausencias.filter(a => a.personaId === p.id).sort((a, b) => String(b.desde).localeCompare(String(a.desde)));
  const usados = aus.filter(a => a.tipo === 'vacaciones' && a.estado === 'aprobada').reduce((s, a) => s + diasHabiles(a.desde, a.hasta || a.desde), 0);
  const chipEst = e => ({ solicitada: '<span class="sis-chip ambar">Por aprobar</span>', aprobada: '<span class="sis-chip verde">Aprobada</span>', rechazada: '<span class="sis-chip gris">Rechazada</span>' }[e] || '');
  return `<section class="sis-tarjeta"><h2>Turno y saldo</h2>
    <form class="sis-form" data-f="turno" data-id="${esc(p.id)}">
      <div class="sis-par">${campo('Sistema de turno', select('turno', TURNOS, fi.turno, { vacio: 'Sin turno' }))}${campo('Saldo de vacaciones (días hábiles)', input('saldo', fi.saldoVacaciones, 'type="number" min="0" step="0.5"'), { ayuda: `Aprobadas y registradas: ${usados} días hábiles.` })}</div>
      <div class="sis-par">${campo('Próxima subida a faena', fecha('subida', fi.subida))}${campo('Próxima bajada', fecha('bajada', fi.bajada))}</div>
      <div class="sis-acciones"><button class="sis-btn primario">Guardar</button></div>
    </form></section>
    <section class="sis-tarjeta"><h2>Vacaciones y permisos</h2>
      ${aus.length ? `<div class="sis-lista">${aus.map(a => `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(NOMBRE_AUSENCIA[a.tipo] || 'Ausencia')} · ${fechaLegible(a.desde)} al ${fechaLegible(a.hasta || a.desde)}</b><span class="sis-tenue">${diasHabiles(a.desde, a.hasta || a.desde)} días hábiles${a.nota ? ` · ${esc(a.nota)}` : ''}</span></span>
        <span class="sis-chips">${chipEst(a.estado)}${a.estado !== 'aprobada' ? `<button type="button" class="sis-btn chico" data-a="ausencia-estado" data-id="${esc(a.id)}" data-e="aprobada">Aprobar</button>` : ''}${a.estado === 'solicitada' ? `<button type="button" class="sis-btn chico" data-a="ausencia-estado" data-id="${esc(a.id)}" data-e="rechazada">Rechazar</button>` : ''}<button type="button" class="sis-btn chico peligro" data-a="ausencia-borrar" data-id="${esc(a.id)}">Eliminar</button></span></div>`).join('')}</div>` : vacio('Sin vacaciones ni permisos registrados.')}
      <form class="sis-form ad-form-linea" data-f="ausencia" data-id="${esc(p.id)}">
        <div class="sis-par">${campo('Tipo', select('tipo', TIPOS_AUSENCIA, 'vacaciones'))}${campo('Estado', select('estado', [['solicitada', 'Por aprobar'], ['aprobada', 'Aprobada']], 'aprobada'))}</div>
        <div class="sis-par">${campo('Desde', fecha('desde', '', 'required'))}${campo('Hasta', fecha('hasta', '', 'required'))}</div>
        ${campo('Nota', input('nota', '', 'placeholder="Opcional"'))}
        <div class="sis-acciones"><button class="sis-btn primario">Registrar</button></div>
      </form>
      <p class="sis-tenue">Las vacaciones aparecen en el calendario único, para no planificar terrenos con personas ausentes.</p></section>`;
}
function diasHabiles(a, b) { let n = 0; const f = new Date(`${a}T12:00:00`), fin = new Date(`${b}T12:00:00`); while (f <= fin) { const w = f.getDay(); if (w && w !== 6) n++; f.setDate(f.getDate() + 1); } return n; }

function tabEpp(v, p, fi, base) {
  const t = fi.tallas || {};
  const items = fi.epp || [];
  const reponer = new Set(eppPorReponer(fi, base).map(x => x.item));
  return `<section class="sis-tarjeta"><h2>Tallas</h2>
    <form class="sis-form" data-f="tallas" data-id="${esc(p.id)}"><div class="sis-par">${campo('Polera / chaqueta', input('polera', t.polera))}${campo('Pantalón', input('pantalon', t.pantalon))}${campo('Calzado', input('calzado', t.calzado))}</div>
    <div class="sis-acciones"><button class="sis-btn primario">Guardar tallas</button></div></form></section>
    <section class="sis-tarjeta"><h2>Entregas de EPP</h2>
    ${items.length ? `<div class="sis-tabla-scroll"><table class="sis-tabla"><thead><tr><th>Elemento</th><th>Entregado</th><th>Reponer</th><th>Respaldo firmado</th><th></th></tr></thead><tbody>${items.map((x, k) => `<tr>
      <td>${esc(x.item)}</td><td class="mono">${x.entregado ? fechaLegible(x.entregado) : '—'}</td><td>${x.reponer ? `<span class="mono">${fechaLegible(x.reponer)}</span> ${reponer.has(x.item) ? '<span class="sis-chip ambar">Reponer pronto</span>' : ''}` : '—'}</td>
      <td><label class="sis-opcion chico"><input type="checkbox" data-c="epp-firmado" data-id="${esc(p.id)}" data-k="${k}" ${x.firmado ? 'checked' : ''}> Firmado</label></td>
      <td><button type="button" class="sis-btn chico peligro" data-a="epp-quitar" data-id="${esc(p.id)}" data-k="${k}">Quitar</button></td></tr>`).join('')}</tbody></table></div>` : vacio('Sin entregas registradas.')}
    <form class="sis-form ad-form-linea" data-f="epp" data-id="${esc(p.id)}"><div class="sis-par">${campo('Elemento', input('item', '', 'required placeholder="Zapatos de seguridad, casco, arnés…"'))}${campo('Fecha de entrega', fecha('entregado', hoyISO()))}${campo('Fecha de reposición', fecha('reponer'))}</div>
      <div class="sis-acciones"><button class="sis-btn primario">Registrar entrega</button></div></form></section>`;
}

/** Proyectos en que participó la persona (encargado o integrante de la cuadrilla): base del CV. */
export function proyectosDePersona(st, personaId) {
  return st.proyectos.filter(x => x.id !== 'oficina' && (x.encargadoId === personaId || (x.cuadrilla || []).includes(personaId)))
    .map(x => ({ p: x, anio: String(x.fechaEncargo || x.creadoEn || '').slice(0, 4), rol: x.encargadoId === personaId ? 'Encargado' : 'Integrante de la cuadrilla' }))
    .sort((a, b) => b.anio.localeCompare(a.anio));
}

function tabCv(v, p) {
  const ps = proyectosDePersona(v.st, p.id);
  return `<section class="sis-tarjeta"><div class="sis-cab"><h2>CV para licitaciones</h2><button type="button" class="sis-btn chico" data-a="cv-pdf" data-id="${esc(p.id)}">${ICO.descargar}Descargar CV (PDF)</button></div>
    <p class="sis-tenue">Se genera automáticamente a partir de los proyectos registrados en el sistema en que la persona fue encargada o integrante de la cuadrilla.</p>
    ${ps.length ? `<div class="sis-lista">${ps.map(x => `<a class="sis-fila" href="#/proyecto/${esc(x.p.id)}"><span class="mono ad-anio">${esc(x.anio || '—')}</span><span class="sis-fila-txt"><b>${esc(x.p.nombre)}</b><span class="sis-tenue">${esc(x.p.mandante || 'Sin mandante')} · ${esc(x.rol)}${v.ctx.textosTipos(x.p).length ? ` · ${esc(v.ctx.textosTipos(x.p).join('; '))}` : ''}</span></span></a>`).join('')}</div>` : vacio('Aún no participa en proyectos registrados. Se agrega como encargado o en la cuadrilla del proyecto.')}</section>`;
}

async function tabIngreso(v, p, fi, base) {
  const ing = fi.ingreso || {};
  const h = habilitacionPersona(p.id, base);
  const equipos = (await v.equipos()).filter(e => e.ubicacion.lugar === 'terreno' && e.ubicacion.personaId === p.id);
  const auto = (ok, t, det) => `<div class="sis-fila"><span class="sis-fila-txt"><b>${t}</b><span class="sis-tenue">${det}</span></span><span class="sis-chips">${ok ? '<span class="sis-chip verde">Cumplido</span>' : '<span class="sis-chip ambar">Pendiente</span>'}<span class="sis-chip gris">Automático</span></span></div>`;
  const manual = (k, t, det) => `<label class="sis-fila ad-check"><span class="sis-fila-txt"><b>${t}</b><span class="sis-tenue">${det}</span></span><span class="sis-chips"><input type="checkbox" data-c="ingreso" data-id="${esc(p.id)}" data-k="${k}" ${ing[k] ? 'checked' : ''}> <span>Confirmado</span></span></label>`;
  return `<section class="sis-tarjeta"><h2>Ingreso y salida</h2>
    <p class="sis-tenue">Lista de verificación para los procesos de contratación y desvinculación. Los puntos automáticos se validan con los módulos Equipos y Personal.</p>
    <div class="sis-lista">
      ${auto(h.habilitado, 'Documentos obligatorios completos', h.habilitado ? 'Documentación obligatoria al día.' : `${h.pendientes.length} documento(s) pendiente(s) en la pestaña Documentos.`)}
      ${auto(!!p.codigoVinculo, 'Teléfono vinculado a la aplicación de Terreno', p.codigoVinculo ? 'Código de vinculación generado.' : 'Genérelo en Personas › Vincular teléfono.')}
      ${manual('correo', 'Cuenta de correo y acceso a la nube de la empresa', 'Alta al ingresar y baja al desvincular.')}
      ${manual('induccion', 'Inducción interna de seguridad', 'Charla de inducción al ingresar.')}
      ${manual('epp', 'Entrega inicial de EPP', 'Registre el detalle en la pestaña EPP.')}
      <div class="sis-fila"><span class="sis-fila-txt"><b>Equipos a su cargo</b><span class="sis-tenue">${equipos.length ? `${plural(equipos.length, 'equipo', 'equipos')} en terreno a su nombre: deben devolverse antes de la desvinculación.` : 'Sin equipos a su cargo.'}</span></span><span class="sis-chips">${equipos.map(e => `<a class="sis-chip azul" href="#/equipos/${esc(e.id)}">${esc(e.nombre)}</a>`).join('')}</span></div>
    </div></section>`;
}

function tabEmergencia(v, p, fi) {
  const e = fi.emergencia || {};
  return `<section class="sis-tarjeta"><h2>Contacto de emergencia</h2>
    <form class="sis-form" data-f="emergencia" data-id="${esc(p.id)}">
      <div class="sis-par">${campo('Nombre', input('nombre', e.nombre))}${campo('Relación', input('relacion', e.relacion))}</div>
      ${campo('Teléfono', input('telefono', e.telefono, 'type="tel"'))}
      <div class="sis-acciones"><button class="sis-btn primario">Guardar contacto</button></div>
    </form>
    <p class="sis-tenue">Visible para el encargado del proyecto mientras la persona se encuentre en faena.</p></section>`;
}

// ─────────────────────────── Licitaciones ───────────────────────────
export function licitaciones(v) {
  const { st } = v;
  if (v.ctx.rol !== 'rrhh') return vacio('Esta sección es de Recursos Humanos.');
  const ls = st.d.licitaciones.slice().sort((a, b) => String(b.actualizadoEn).localeCompare(String(a.actualizadoEn)));
  return `<div class="sis-miga"><a href="#/personal">Personal</a> / Licitaciones</div>
    <div class="sis-cab"><div><h1>Paquetes de licitación</h1><span class="sis-tenue">Prepare la documentación del personal exigida en las bases de una licitación y descárguela ordenada por persona.</span></div></div>
    <section class="sis-tarjeta"><h2>Nuevo paquete</h2>
      <form class="sis-form ad-form-linea" data-f="licitacion-nueva"><div class="sis-par">${campo('Nombre de la licitación', input('nombre', '', 'required placeholder="Ej.: Red GNSS 2027"'))}${campo('Mandante', select('mandanteId', st.d.mandantes.map(m => [m.id, m.nombre]), '', { vacio: 'Sin mandante' }))}</div>
      <div class="sis-acciones"><button class="sis-btn primario">Crear y continuar</button></div></form></section>
    <section class="sis-tarjeta"><h2>Paquetes guardados</h2>${ls.length ? `<div class="sis-lista">${ls.map(l => `<a class="sis-fila" href="#/personal/licitacion/${esc(l.id)}"><span class="sis-fila-txt"><b>${esc(l.nombre)}</b><span class="sis-tenue">${esc((st.d.mandantes.find(m => m.id === l.mandanteId) || {}).nombre || 'Sin mandante')} · ${plural((l.requisitos || []).length, 'documento exigido', 'documentos exigidos')} · ${plural((l.personas || []).length, 'persona', 'personas')}</span></span></a>`).join('')}</div>` : vacio('Aún no hay paquetes.')}</section>`;
}

export function licitacion(v, id) {
  const { st } = v;
  if (v.ctx.rol !== 'rrhh') return vacio('Esta sección es de Recursos Humanos.');
  const l = st.d.licitaciones.find(x => x.id === id);
  if (!l) return vacio('Este paquete no existe.', '<a class="sis-btn" href="#/personal/licitaciones">Volver</a>');
  const tipos = tiposDe(st.d.tipos, 'persona');
  const req = l.requisitos || [], sel = new Set(l.personas || []);
  const filas = cumplimientoLicitacion(req, st.personas, { ...st.d, hoy: hoyISO(), diasAviso: st.d.config.diasAviso });
  const vis = l.soloCumplen ? filas.filter(f => f.cumple) : filas;
  const reqTipos = req.map(r => tipos.find(t => t.id === r)).filter(Boolean);
  const res = f => f.faltan ? `<span class="sis-chip rojo">No cumple · ${f.faltan}</span>` : f.avisos ? '<span class="sis-chip ambar">Cumple · revisar fechas</span>' : '<span class="sis-chip verde">Cumple todo</span>';
  const elegidas = filas.filter(f => sel.has(f.personaId));
  return `<div class="sis-miga"><a href="#/personal">Personal</a> / <a href="#/personal/licitaciones">Licitaciones</a> / ${esc(l.nombre)}</div>
    <div class="sis-cab"><div><h1>${esc(l.nombre)}</h1><span class="sis-tenue">Complete los tres pasos: indique los documentos exigidos en las bases, seleccione al personal y descargue el paquete ordenado.</span></div>
      <button type="button" class="sis-btn chico peligro" data-a="lic-borrar" data-id="${esc(l.id)}">Eliminar paquete</button></div>
    <section class="sis-tarjeta"><h2><span class="ad-paso">1</span>Seleccione los documentos exigidos</h2>
      <div class="ad-req">${tipos.map(t => `<button type="button" class="ad-req-btn${req.includes(t.id) ? ' activo' : ''}" aria-pressed="${req.includes(t.id)}" data-a="lic-req" data-id="${esc(l.id)}" data-tipo="${esc(t.id)}">${esc(t.nombre)}</button>`).join('')}</div></section>
    <section class="sis-tarjeta"><div class="sis-cab"><h2><span class="ad-paso">2</span>Revise el cumplimiento del personal</h2>
      <label class="sis-opcion"><input type="checkbox" data-c="lic-solo" data-id="${esc(l.id)}" ${l.soloCumplen ? 'checked' : ''}> Mostrar solo personal que cumple todos los requisitos</label></div>
      ${req.length ? `<div class="sis-tabla-scroll"><table class="sis-tabla ad-lic"><thead><tr><th><span class="ad-oculto">Seleccionar</span></th><th>Persona</th>${reqTipos.map(t => `<th>${esc(t.nombre)}</th>`).join('')}<th>Resultado</th></tr></thead>
        <tbody>${vis.map(f => `<tr><td><input type="checkbox" aria-label="Seleccionar a ${esc(f.persona.nombre)}" data-c="lic-persona" data-id="${esc(l.id)}" data-p="${esc(f.personaId)}" ${sel.has(f.personaId) ? 'checked' : ''}></td><td><b>${esc(f.persona.nombre)}</b></td>${f.celdas.map(c => `<td>${chipVenc(c.e)}</td>`).join('')}<td>${res(f)}</td></tr>`).join('')}</tbody></table></div>` : vacio('Seleccione al menos un documento en el paso 1.')}
    </section>
    <section class="sis-tarjeta ad-paquete"><div><h2><span class="ad-paso">3</span>Revise y descargue el paquete</h2>
      <label class="sis-opcion"><input type="checkbox" data-c="lic-cv" data-id="${esc(l.id)}" ${l.incluirCV ? 'checked' : ''}> Incluir el CV de cada persona (generado desde los proyectos del sistema)</label>
      <div class="ad-arbol mono"><div><b>${esc(nombreSeguro(`Licitacion_${l.nombre}`))}.zip</b></div>${elegidas.length ? elegidas.map(f => `<div class="ad-arbol-h">└ ${esc(nombreSeguro(f.persona.nombre))}/ <span class="sis-tenue">(${f.celdas.filter(c => c.doc && c.doc.archivoId).length + (l.incluirCV ? 1 : 0)} archivos)</span></div>`).join('') : '<div class="ad-arbol-h sis-tenue">Seleccione al menos una persona en el paso 2.</div>'}</div></div>
      <div class="ad-paquete-acc"><button type="button" class="sis-btn primario" data-a="lic-zip" data-id="${esc(l.id)}" ${elegidas.length ? '' : 'disabled'}>${ICO.descargar}Descargar todo · ${plural(elegidas.length, 'persona', 'personas')}</button>
        <p class="sis-tenue">Cada carpeta lleva el nombre de la persona y los documentos siguen una nomenclatura estándar (por ejemplo, <span class="mono">02_Titulo_profesional.pdf</span>). Los documentos vencidos o faltantes no se incluyen; revise la columna «Resultado» antes de presentar.</p></div>
    </section>`;
}

// ─────────────────────────── Paquetes .zip ───────────────────────────
async function entradasPersona(v, persona, tipoIds, { carpeta, incluirCV }) {
  const docs = docsDe(v.st.d.documentos, 'persona', persona.id);
  const tipos = tipoIds.map(id => v.st.d.tipos.find(t => t.id === id)).filter(Boolean);
  const out = [];
  let faltan = 0;
  for (let k = 0; k < tipos.length; k++) {
    const d = ultimoDoc(docs, tipos[k].id);
    if (!d || !d.archivoId) continue;
    const c = await contenidoArchivo(d.archivoId);
    if (!c) { faltan++; continue; }
    out.push({ nombre: `${carpeta}/${nombreSeguro(nombreEnPaquete(k, tipos[k], c))}`, datos: bytesDeDataURL(c.datos) });
  }
  if (incluirCV) out.push({ nombre: `${carpeta}/00_CV_${nombreSeguro(persona.nombre)}.pdf`, datos: await cvPdf(v, persona) });
  return { out, faltan };
}

export async function zipPersona(v, personaId) {
  const p = v.st.personas.find(x => x.id === personaId);
  const tipos = tiposDe(v.st.d.tipos, 'persona').map(t => t.id);
  const carpeta = nombreSeguro(p.nombre);
  const { out, faltan } = await entradasPersona(v, p, tipos, { carpeta, incluirCV: false });
  if (!out.length) { v.avisar('La persona no tiene documentos con archivo adjunto.'); return; }
  descargar(`${carpeta}.zip`, new Blob([armarZip(out)], { type: 'application/zip' }));
  v.avisar(faltan ? `Descargado. ${faltan} archivo(s) no se encontraron: conecte la nube y vuelva a intentar.` : 'Documentos descargados');
}

export async function zipLicitacion(v, id) {
  const l = v.st.d.licitaciones.find(x => x.id === id);
  const todas = [];
  let faltan = 0;
  for (const pid of l.personas || []) {
    const p = v.st.personas.find(x => x.id === pid);
    if (!p) continue;
    const r = await entradasPersona(v, p, l.requisitos || [], { carpeta: nombreSeguro(p.nombre), incluirCV: !!l.incluirCV });
    todas.push(...r.out); faltan += r.faltan;
  }
  if (!todas.length) { v.avisar('Las personas seleccionadas no tienen archivos de los documentos exigidos.'); return; }
  descargar(`${nombreSeguro(`Licitacion_${l.nombre}`)}.zip`, new Blob([armarZip(todas)], { type: 'application/zip' }));
  await guardarRegistro(ALM.licitaciones, { id: l.id, descargas: [...(l.descargas || []), { por: v.ctx.personaId, en: new Date().toISOString() }].slice(-20) });
  v.avisar(faltan ? `Paquete descargado. ${faltan} archivo(s) no se encontraron en este equipo.` : 'Paquete descargado');
}

/** CV en PDF (jsPDF de vendor/): datos de la persona y proyectos del sistema. */
async function cvPdf(v, persona) {
  if (!(window.jspdf && window.jspdf.jsPDF)) await cargarScript('vendor/jspdf.umd.min.js');
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'letter' });
  const ps = proyectosDePersona(v.st, persona.id);
  let y = 22;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(persona.nombre, 20, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text(persona.cargo || '', 20, y); y += 5;
  doc.setFontSize(9); doc.setTextColor(90); doc.text(`${v.ctx.marca ? v.ctx.marca.nombre : 'Topoland'} · CV generado el ${fechaLegible(hoyISO())} desde el Sistema de trabajo`, 20, y); doc.setTextColor(0); y += 10;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Experiencia en proyectos', 20, y); y += 7;
  doc.setFontSize(10);
  if (!ps.length) { doc.setFont('helvetica', 'normal'); doc.text('Sin proyectos registrados en el sistema.', 20, y); }
  for (const x of ps) {
    if (y > 255) { doc.addPage(); y = 22; }
    doc.setFont('helvetica', 'bold'); doc.text(`${x.anio || '—'}  ${x.p.nombre}`.slice(0, 95), 20, y); y += 5;
    doc.setFont('helvetica', 'normal');
    const det = [x.p.mandante, x.rol, v.ctx.textosTipos(x.p).join('; ')].filter(Boolean).join(' · ');
    for (const linea of doc.splitTextToSize(det, 170)) { doc.text(linea, 26, y); y += 5; }
    y += 2;
  }
  return new Uint8Array(doc.output('arraybuffer'));
}

// ─────────────────────────── Acciones y formularios ───────────────────────────
export const acciones = {
  'filtro-personal': (b, v) => { v.st.filtroPersonal = b.dataset.k; return true; },
  'doc-editar': (b, v) => { v.st.editDoc = { duenoTipo: b.dataset.dueno, duenoId: b.dataset.id, tipoId: b.dataset.tipo }; return true; },
  'doc-cancelar': (b, v) => { v.st.editDoc = null; return true; },
  'ver-archivo': async b => { await abrirArchivo(b.dataset.id); return false; },
  'zip-persona': async (b, v) => { await zipPersona(v, b.dataset.id); return false; },
  'cv-pdf': async (b, v) => { const p = v.st.personas.find(x => x.id === b.dataset.id); descargar(`CV_${nombreSeguro(p.nombre)}.pdf`, new Blob([await cvPdf(v, p)], { type: 'application/pdf' })); return false; },
  'ausencia-estado': async (b, v) => { await guardarRegistro(ALM.ausencias, { id: b.dataset.id, estado: b.dataset.e }); v.avisar(b.dataset.e === 'aprobada' ? 'Ausencia aprobada' : 'Ausencia rechazada'); return true; },
  'ausencia-borrar': async (b, v) => { if (!confirm('¿Eliminar este registro de ausencia?')) return false; await aPapelera(ALM.ausencias, b.dataset.id); v.avisar('Registro eliminado'); return true; },
  'epp-quitar': async (b, v) => { const fi = v.st.d.fichas.find(x => x.id === b.dataset.id) || {}; const epp = (fi.epp || []).filter((_, k) => k !== Number(b.dataset.k)); await guardarFicha(b.dataset.id, { epp }); return true; },
  'lic-req': async (b, v) => { const l = v.st.d.licitaciones.find(x => x.id === b.dataset.id); const r = new Set(l.requisitos || []); r.has(b.dataset.tipo) ? r.delete(b.dataset.tipo) : r.add(b.dataset.tipo); const orden = tiposDe(v.st.d.tipos, 'persona').map(t => t.id); await guardarRegistro(ALM.licitaciones, { id: l.id, requisitos: orden.filter(t => r.has(t)) }); return true; },
  'lic-zip': async (b, v) => { await zipLicitacion(v, b.dataset.id); return true; },
  'lic-borrar': async (b, v) => { if (!confirm('¿Eliminar este paquete de licitación? Los documentos del personal no se eliminan.')) return false; await aPapelera(ALM.licitaciones, b.dataset.id); v.ir('#/personal/licitaciones'); return false; },
};

export const cambios = {
  'epp-firmado': async (i, v) => { const fi = v.st.d.fichas.find(x => x.id === i.dataset.id) || {}; const epp = (fi.epp || []).map((x, k) => (k === Number(i.dataset.k) ? { ...x, firmado: i.checked } : x)); await guardarFicha(i.dataset.id, { epp }); return true; },
  ingreso: async (i, v) => { const fi = v.st.d.fichas.find(x => x.id === i.dataset.id) || {}; await guardarFicha(i.dataset.id, { ingreso: { ...(fi.ingreso || {}), [i.dataset.k]: i.checked } }); return true; },
  'lic-solo': async (i) => { await guardarRegistro(ALM.licitaciones, { id: i.dataset.id, soloCumplen: i.checked }); return true; },
  'lic-cv': async (i) => { await guardarRegistro(ALM.licitaciones, { id: i.dataset.id, incluirCV: i.checked }); return true; },
  'lic-persona': async (i, v) => { const l = v.st.d.licitaciones.find(x => x.id === i.dataset.id); const s = new Set(l.personas || []); i.checked ? s.add(i.dataset.p) : s.delete(i.dataset.p); await guardarRegistro(ALM.licitaciones, { id: l.id, personas: [...s] }); return true; },
};

const txt = (fd, k) => String(fd.get(k) || '').trim();
export const formularios = {
  documento: async (f, fd, v) => {
    const { dueno, id, tipo } = f.dataset;
    const tipoR = v.st.d.tipos.find(t => t.id === tipo);
    const previo = ultimoDoc(docsDe(v.st.d.documentos, dueno, id), tipo);
    const archivo = fd.get('archivo') && fd.get('archivo').size ? fd.get('archivo') : null;
    const nuevo = !previo || fd.get('nuevo') === 'on';
    const estadoMandante = { ...((!nuevo && previo && previo.estadoMandante) || {}) };
    for (const m of v.st.d.mandantes) if (fd.has(`plat_${m.id}`)) { const val = fd.get(`plat_${m.id}`); if (val) estadoMandante[m.id] = val; else delete estadoMandante[m.id]; }
    const nombreDueno = dueno === 'persona' ? (v.st.personas.find(p => p.id === id) || {}).nombre : (v.st.d.vehiculos.find(x => x.id === id) || {}).patente;
    const carpeta = dueno === 'persona' ? `RRHH/Personas/${nombreSeguro(nombreDueno)}` : `Vehiculos/${nombreSeguro(nombreDueno)}`;
    await guardarDocumento({ ...(nuevo ? {} : previo), duenoTipo: dueno, duenoId: id, tipoId: tipo, inicio: fd.get('inicio') || '', vence: tipoR && tipoR.vence ? fd.get('vence') || '' : '', estadoMandante, observacion: txt(fd, 'observacion') }, { archivo, carpeta });
    v.st.editDoc = null;
    v.avisar('Documento guardado');
    return true;
  },
  contrato: async (f, fd, v) => { await guardarFicha(f.dataset.id, { contrato: { tipo: fd.get('tipo') || '', ingreso: fd.get('ingreso') || '', termino: fd.get('termino') || '', anexos: txt(fd, 'anexos') } }); v.avisar('Contrato guardado'); return true; },
  turno: async (f, fd, v) => { await guardarFicha(f.dataset.id, { turno: fd.get('turno') || '', saldoVacaciones: fd.get('saldo') === '' ? '' : Number(fd.get('saldo')), subida: fd.get('subida') || '', bajada: fd.get('bajada') || '' }); v.avisar('Turno guardado'); return true; },
  ausencia: async (f, fd, v) => {
    const desde = fd.get('desde'), hasta = fd.get('hasta') || desde;
    if (hasta < desde) throw new Error('La fecha «hasta» es anterior a «desde».');
    await guardarRegistro(ALM.ausencias, { personaId: f.dataset.id, tipo: fd.get('tipo'), estado: fd.get('estado'), desde, hasta, nota: txt(fd, 'nota') });
    v.avisar('Ausencia registrada'); return true;
  },
  tallas: async (f, fd, v) => { await guardarFicha(f.dataset.id, { tallas: { polera: txt(fd, 'polera'), pantalon: txt(fd, 'pantalon'), calzado: txt(fd, 'calzado') } }); v.avisar('Tallas guardadas'); return true; },
  epp: async (f, fd, v) => { const fi = v.st.d.fichas.find(x => x.id === f.dataset.id) || {}; await guardarFicha(f.dataset.id, { epp: [...(fi.epp || []), { item: txt(fd, 'item'), entregado: fd.get('entregado') || '', reponer: fd.get('reponer') || '', firmado: false }] }); v.avisar('Entrega registrada'); return true; },
  emergencia: async (f, fd, v) => { await guardarFicha(f.dataset.id, { emergencia: { nombre: txt(fd, 'nombre'), relacion: txt(fd, 'relacion'), telefono: txt(fd, 'telefono') } }); v.avisar('Contacto guardado'); return true; },
  'licitacion-nueva': async (f, fd, v) => {
    const m = v.st.d.mandantes.find(x => x.id === fd.get('mandanteId'));
    const req = m ? (m.requisitosPersona || []).map(r => r.tipoId) : [];
    const l = await guardarRegistro(ALM.licitaciones, { nombre: txt(fd, 'nombre'), mandanteId: fd.get('mandanteId') || null, requisitos: req, personas: [], incluirCV: true });
    v.ir(`#/personal/licitacion/${l.id}`); return false;
  },
};

export { mandanteDeProyecto, NOMBRE_CONTRATO };
