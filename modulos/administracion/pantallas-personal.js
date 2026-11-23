// modulos/administracion/pantallas-personal.js — ficha del trabajador y carpetas de documentación (Administración 0.2, Sistema v0.16).
// Ficha completa por persona (datos personales, documentos, acreditación, contrato, vacaciones y turnos, EPP, CV,
// ingreso y salida, contacto de emergencia) y carpetas de arranque o de licitación con «Descargar todo».
// La dotación, la distribución y el monitor de vacaciones están en pantallas-gestion.js.
// Acceso: Recursos Humanos y Jefatura. Rutas: #/personal/<personaId>[/<pestaña>] · #/personal/carpetas ·
// #/personal/carpeta/<id> · #/personal/carpeta-proyecto/<proyectoId> (crea o abre la carpeta de arranque del proyecto).

import { hoyISO, descargar, cargarScript, nombreEmpresa } from '../../compartido/util.js';
import { ROLES_PERSONA } from '../../app/catalogo.js';
import { gestiona, avisoConfidencial as aviso, iniciales, dotacion } from './pantallas-gestion.js';
import { contenidoArchivo, abrirArchivo } from '../../compartido/archivos.js';
import { armarZip, bytesDeDataURL, nombreSeguro } from '../../compartido/zip.js';
import { ultimoDoc, ESTADOS_VENC } from '../../compartido/vencimientos.js';
import { ALM, guardarDocumento, guardarFicha, guardarRegistro, aPapelera, personasDeBaja } from './datos.js';
import {
  tiposDe, docsDe, habilitacionPersona, acreditacion, estadoDocumentos, avisoContrato, eppPorReponer, cumplimientoLicitacion,
  nombreEnPaquete, mandanteDeProyecto, TURNOS, TIPOS_CONTRATO, TIPOS_AUSENCIA, NOMBRE_AUSENCIA, NOMBRE_CONTRATO, ESTADOS_PLATAFORMA,
  diasHabiles, resumenVacaciones, ubicacionPersona,
} from './modelo.js';
import { genteDeProyecto } from '../../compartido/cronograma.js';
import { esc, fechaLegible, vacio, plural, txt, chipVenc, chipHab, chipPlataforma, campo, input, fecha, select, firmaCambio, ICO } from './ui.js';

const PESTANAS_FICHA = [
  ['datos', 'Datos personales'], ['documentos', 'Documentos'], ['acreditacion', 'Acreditación por mandante'], ['contrato', 'Contrato'], ['vacaciones', 'Vacaciones y turnos'],
  ['epp', 'EPP'], ['cv', 'CV para licitaciones'], ['ingreso', 'Ingreso y salida'], ['emergencia', 'Contacto de emergencia'],
];

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
export async function personalFicha(v, id, tab = 'datos') {
  const { st } = v;
  if (!gestiona(v)) return dotacion(v);
  const deBaja = !st.personas.some(x => x.id === id);
  const p = st.personas.find(x => x.id === id) || (await personasDeBaja()).find(x => x.id === id);
  if (!p) return vacio('Esta persona no existe.', '<a class="sis-btn" href="#/personal">Volver a Personal</a>');
  if (!PESTANAS_FICHA.some(([k]) => k === tab)) tab = 'datos';
  const hoy = hoyISO(), base = { ...st.d, hoy, diasAviso: st.d.config.diasAviso };
  const fi = st.d.fichas.find(x => x.id === id) || { id };
  const h = habilitacionPersona(id, base);
  const u = ubicacionPersona(id, { ausencias: st.d.ausencias, proyectos: st.proyectos, fecha: hoy });
  const contenido = await ({ datos: tabDatos, documentos: tabDocumentos, acreditacion: tabAcreditacion, contrato: tabContrato, vacaciones: tabVacaciones, epp: tabEpp, cv: tabCv, ingreso: tabIngreso, emergencia: tabEmergencia }[tab])(v, p, fi, base);
  return `<div class="sis-miga"><a href="#/personal">Personal</a> / ${esc(p.nombre)}</div>
    <section class="sis-tarjeta ad-cab-persona">
      <span class="ad-avatar" aria-hidden="true">${esc(iniciales(p.nombre))}</span>
      <div class="ad-cab-txt"><h1>${esc(p.nombre)}</h1><span class="sis-tenue">${esc(p.cargo || 'Sin cargo')}${u.estado === 'proyecto' ? ` · hoy en ${u.proyectos.map(q => `<a href="#/proyecto/${esc(q.id)}">${esc(q.nombre)}</a>`).join(', ')}` : u.estado === 'ausente' ? ` · ${esc((NOMBRE_AUSENCIA[u.ausencia.tipo] || 'ausente').toLowerCase())} hasta el ${fechaLegible(u.ausencia.hasta || u.ausencia.desde)}` : ' · disponible'}${fi.turno ? ` · turno ${esc(fi.turno)}` : ''}</span></div>
      <div class="sis-chips">${deBaja ? '<span class="sis-chip gris">Dado de baja</span>' : ''}${chipHab(h)}<button type="button" class="sis-btn chico" data-a="zip-persona" data-id="${esc(p.id)}">${ICO.descargar}Descargar todo</button></div>
    </section>
    <div class="ad-ficha">
      <nav class="ad-lateral" aria-label="Partes de la ficha">${PESTANAS_FICHA.map(([k, t]) => `<a href="#/personal/${esc(id)}/${k}" class="${k === tab ? 'activo' : ''}"${k === tab ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
      <div class="ad-ficha-cuerpo">${contenido}</div>
    </div>
    ${firmaCambio(fi.actualizadoEn ? fi : p, v.nomPers)}`;
}

function tabDatos(v, p, fi) {
  const d = fi.personal || {};
  const activa = v.st.personas.some(x => x.id === p.id);
  return `${aviso}<section class="sis-tarjeta"><h2>Datos personales</h2>
    <form class="sis-form" data-f="datos-personales" data-id="${esc(p.id)}">
      <div class="sis-par">${campo('Nombre completo *', input('nombre', p.nombre, 'required'))}${campo('Cargo', input('cargo', p.cargo, 'placeholder="Geomensor, topógrafo, piloto, dibujante…"'))}</div>
      <div class="sis-par">${campo('RUT', input('rut', d.rut, 'placeholder="12.345.678-9"'))}${campo('Fecha de nacimiento', fecha('nacimiento', d.nacimiento))}</div>
      <div class="sis-par">${campo('Teléfono', input('telefono', d.telefono, 'type="tel"'))}${campo('Correo', input('correo', d.correo, 'type="email"'))}</div>
      ${campo('Dirección', input('direccion', d.direccion))}
      <div class="sis-par">${campo('Previsión (AFP)', input('prevision', d.prevision))}${campo('Salud (Fonasa o isapre)', input('salud', d.salud))}</div>
      <div class="sis-campo"><span>Roles en el Sistema</span><div class="sis-opciones">${ROLES_PERSONA.map(([k, t]) => `<label class="sis-opcion"><input type="checkbox" name="roles" value="${k}" ${(p.roles || []).includes(k) ? 'checked' : ''}> ${t}</label>`).join('')}</div>
        <small class="sis-tenue">Una persona puede tener más de un rol. La vinculación de su teléfono con la app de Terreno se hace en Configuración (botón de engranaje).</small></div>
      <div class="sis-acciones"><button class="sis-btn primario">Guardar datos</button>${activa ? `<button type="button" class="sis-btn peligro" data-a="trabajador-baja" data-id="${esc(p.id)}">Dar de baja</button>` : `<button type="button" class="sis-btn" data-a="trabajador-reincorporar" data-id="${esc(p.id)}">Reincorporar</button>`}</div>
    </form></section>`;
}

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
  const r = resumenVacaciones(p.id, { ...v.st.d, hoy: hoyISO() });
  const usados = r.tomadas;
  const chipEst = e => ({ solicitada: '<span class="sis-chip ambar">Por aprobar</span>', aprobada: '<span class="sis-chip verde">Aprobada</span>', rechazada: '<span class="sis-chip gris">Rechazada</span>' }[e] || '');
  return `<section class="sis-tarjeta"><h2>Turno y saldo</h2>
    <form class="sis-form" data-f="turno" data-id="${esc(p.id)}">
      <div class="sis-par">${campo('Sistema de turno', select('turno', TURNOS, fi.turno, { vacio: 'Sin turno' }))}${campo('Saldo de vacaciones (días hábiles)', input('saldo', fi.saldoVacaciones, 'type="number" min="0" step="0.5"'), { ayuda: `Tomadas: ${usados} días hábiles.${fi.contrato && fi.contrato.ingreso ? ` Devengadas según la fecha de ingreso: ${r.devengadas.toLocaleString('es-CL')} (saldo estimado ${(r.devengadas - usados).toLocaleString('es-CL')}). Deje el campo vacío para usar el estimado.` : ' Registre la fecha de ingreso en Contrato para estimar el saldo.'}` })}</div>
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
      ${auto(!!p.codigoVinculo, 'Teléfono vinculado a la aplicación de Terreno', p.codigoVinculo ? 'Código de vinculación generado.' : 'Genérelo en Configuración › Vinculación con la app de Terreno.')}
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

// ─────────────────────────── Carpetas de arranque y de licitación ───────────────────────────
// Una carpeta reúne los documentos exigidos y las personas elegidas, y se descarga ordenada (una carpeta por persona).
//   · de arranque: nace de un proyecto; toma su mandante (requisitos de acreditación) y su equipo de trabajo;
//   · de licitación: se arma a mano con los documentos que piden las bases.
const esArranque = l => !!l.proyectoId;
const nombreZip = l => nombreSeguro(`${esArranque(l) ? 'Arranque' : 'Licitacion'}_${l.nombre}`);

export function licitaciones(v) {
  const { st } = v;
  if (!gestiona(v)) return vacio('Esta sección es de Recursos Humanos y Jefatura.');
  const ls = st.d.licitaciones.slice().sort((a, b) => String(b.actualizadoEn).localeCompare(String(a.actualizadoEn)));
  const conCarpeta = new Set(ls.filter(esArranque).map(l => l.proyectoId));
  const activos = st.proyectos.filter(p => p.id !== 'oficina' && p.estado !== 'cerrado');
  const nomMan = id => (st.d.mandantes.find(m => m.id === id) || {}).nombre || 'Sin mandante';
  return `<div class="sis-cab"><div><h1>Carpetas de arranque y licitaciones</h1><span class="sis-tenue">Reúna la documentación del personal que exige un mandante y descárguela ordenada por persona, sin buscar papel por papel.</span></div></div>
    ${aviso}
    <div class="sis-columnas">
      <section class="sis-tarjeta"><h2>Carpeta de arranque de un proyecto</h2>
        <p class="sis-tenue">Toma el equipo de trabajo del proyecto y los documentos que exige su mandante.</p>
        ${activos.length ? `<form class="sis-form" data-f="carpeta-proyecto">${campo('Proyecto', select('proyectoId', activos.map(p => [p.id, `${p.nombre}${conCarpeta.has(p.id) ? ' · ya tiene carpeta' : ''}`]), '', { vacio: 'Seleccione', extra: 'required' }))}
          <div class="sis-acciones"><button class="sis-btn primario">Armar carpeta</button></div></form>` : vacio('No hay proyectos activos.')}</section>
      <section class="sis-tarjeta"><h2>Carpeta para una licitación</h2>
        <p class="sis-tenue">Indique los documentos que piden las bases y elija al personal que cumple.</p>
        <form class="sis-form" data-f="licitacion-nueva"><div class="sis-par">${campo('Nombre de la licitación', input('nombre', '', 'required placeholder="Ej.: Red GNSS 2027"'))}${campo('Mandante', select('mandanteId', st.d.mandantes.map(m => [m.id, m.nombre]), '', { vacio: 'Sin mandante' }))}</div>
        <div class="sis-acciones"><button class="sis-btn primario">Crear y continuar</button></div></form></section>
    </div>
    <section class="sis-tarjeta"><h2>Carpetas guardadas</h2>${ls.length ? `<div class="sis-lista">${ls.map(l => `<a class="sis-fila" href="#/personal/carpeta/${esc(l.id)}"><span class="sis-fila-txt"><b>${esc(l.nombre)}</b><span class="sis-tenue">${esc(nomMan(l.mandanteId))} · ${plural((l.requisitos || []).length, 'documento exigido', 'documentos exigidos')} · ${plural((l.personas || []).length, 'persona', 'personas')}${(l.descargas || []).length ? ` · descargada ${fechaLegible(String(l.descargas[l.descargas.length - 1].en).slice(0, 10))}` : ''}</span></span><span class="sis-chip ${esArranque(l) ? 'azul' : 'gris'}">${esArranque(l) ? 'Arranque' : 'Licitación'}</span></a>`).join('')}</div>` : vacio('Aún no hay carpetas.')}</section>`;
}

/** Datos de una carpeta de arranque a partir del proyecto: mandante, documentos exigidos y equipo de trabajo. */
function carpetaDesdeProyecto(st, p) {
  const man = mandanteDeProyecto(p, st.d.mandantes);
  const delMandante = man ? (man.requisitosPersona || []).map(r => r.tipoId) : [];
  const req = delMandante.length ? delMandante : tiposDe(st.d.tipos, 'persona').filter(t => t.obligatorio).map(t => t.id);
  return { nombre: p.nombre, proyectoId: p.id, mandanteId: man ? man.id : null, requisitos: req, personas: genteDeProyecto(p).filter(id => st.personas.some(x => x.id === id)), incluirCV: false };
}

/** #/personal/carpeta-proyecto/<proyectoId>: abre la carpeta de arranque del proyecto o la crea. */
export async function carpetaDeProyecto(v, proyectoId) {
  const { st } = v;
  if (!gestiona(v)) return vacio('Esta sección es de Recursos Humanos y Jefatura.');
  const p = st.proyectos.find(x => x.id === proyectoId);
  if (!p) return vacio('Este proyecto no existe.', '<a class="sis-btn" href="#/personal/carpetas">Volver</a>');
  const l = st.d.licitaciones.find(x => x.proyectoId === proyectoId) || await guardarRegistro(ALM.licitaciones, carpetaDesdeProyecto(st, p));
  location.replace(`#/personal/carpeta/${l.id}`);
  return '<p class="sis-tenue">Abriendo la carpeta de arranque…</p>';
}

export function licitacion(v, id) {
  const { st } = v;
  if (!gestiona(v)) return vacio('Esta sección es de Recursos Humanos y Jefatura.');
  const l = st.d.licitaciones.find(x => x.id === id);
  if (!l) return vacio('Esta carpeta no existe.', '<a class="sis-btn" href="#/personal/carpetas">Volver</a>');
  const proy = l.proyectoId ? st.proyectos.find(x => x.id === l.proyectoId) : null;
  const delProyecto = proy ? new Set(genteDeProyecto(proy)) : null;
  const tipos = tiposDe(st.d.tipos, 'persona');
  const req = l.requisitos || [], sel = new Set(l.personas || []);
  const filas = cumplimientoLicitacion(req, st.personas, { ...st.d, hoy: hoyISO(), diasAviso: st.d.config.diasAviso });
  const vis = l.soloCumplen ? filas.filter(f => f.cumple) : filas;
  const reqTipos = req.map(r => tipos.find(t => t.id === r)).filter(Boolean);
  const res = f => f.faltan ? `<span class="sis-chip rojo">No cumple · ${f.faltan}</span>` : f.avisos ? '<span class="sis-chip ambar">Cumple · revisar fechas</span>' : '<span class="sis-chip verde">Cumple todo</span>';
  const elegidas = filas.filter(f => sel.has(f.personaId));
  return `<div class="sis-miga"><a href="#/personal">Personal</a> / <a href="#/personal/carpetas">Carpetas</a> / ${esc(l.nombre)}</div>
    <div class="sis-cab"><div><h1>${esArranque(l) ? 'Carpeta de arranque · ' : ''}${esc(l.nombre)}</h1><span class="sis-tenue">${proy ? `Proyecto <a href="#/proyecto/${esc(proy.id)}">${esc(proy.nombre)}</a>. ` : ''}Complete los tres pasos: confirme los documentos exigidos, seleccione al personal y descargue la carpeta ordenada.</span></div>
      <div class="sis-acciones">${proy ? `<button type="button" class="sis-btn chico" data-a="lic-sincronizar" data-id="${esc(l.id)}">Actualizar desde el proyecto</button>` : ''}<button type="button" class="sis-btn chico peligro" data-a="lic-borrar" data-id="${esc(l.id)}">Eliminar carpeta</button></div></div>
    <section class="sis-tarjeta"><h2><span class="ad-paso">1</span>Seleccione los documentos exigidos</h2>
      <div class="ad-req">${tipos.map(t => `<button type="button" class="ad-req-btn${req.includes(t.id) ? ' activo' : ''}" aria-pressed="${req.includes(t.id)}" data-a="lic-req" data-id="${esc(l.id)}" data-tipo="${esc(t.id)}">${esc(t.nombre)}</button>`).join('')}</div></section>
    <section class="sis-tarjeta"><div class="sis-cab"><h2><span class="ad-paso">2</span>Revise el cumplimiento del personal</h2>
      <label class="sis-opcion"><input type="checkbox" data-c="lic-solo" data-id="${esc(l.id)}" ${l.soloCumplen ? 'checked' : ''}> Mostrar solo personal que cumple todos los requisitos</label></div>
      ${req.length ? `<div class="sis-tabla-scroll"><table class="sis-tabla ad-lic"><thead><tr><th><span class="ad-oculto">Seleccionar</span></th><th>Persona</th>${reqTipos.map(t => `<th>${esc(t.nombre)}</th>`).join('')}<th>Resultado</th></tr></thead>
        <tbody>${vis.map(f => `<tr><td><input type="checkbox" aria-label="Seleccionar a ${esc(f.persona.nombre)}" data-c="lic-persona" data-id="${esc(l.id)}" data-p="${esc(f.personaId)}" ${sel.has(f.personaId) ? 'checked' : ''}></td><td><b>${esc(f.persona.nombre)}</b>${delProyecto && delProyecto.has(f.personaId) ? '<small>En el equipo del proyecto</small>' : ''}</td>${f.celdas.map(c => `<td>${chipVenc(c.e)}</td>`).join('')}<td>${res(f)}</td></tr>`).join('')}</tbody></table></div>` : vacio('Seleccione al menos un documento en el paso 1.')}
    </section>
    <section class="sis-tarjeta ad-paquete"><div><h2><span class="ad-paso">3</span>Revise y descargue la carpeta</h2>
      <label class="sis-opcion"><input type="checkbox" data-c="lic-cv" data-id="${esc(l.id)}" ${l.incluirCV ? 'checked' : ''}> Incluir el CV de cada persona (generado desde los proyectos del sistema)</label>
      <div class="ad-arbol mono"><div><b>${esc(nombreZip(l))}.zip</b></div><div class="ad-arbol-h">└ 00_Listado_de_documentos.csv</div>${elegidas.length ? elegidas.map(f => `<div class="ad-arbol-h">└ ${esc(nombreSeguro(f.persona.nombre))}/ <span class="sis-tenue">(${f.celdas.filter(c => c.doc && c.doc.archivoId).length + (l.incluirCV ? 1 : 0)} archivos)</span></div>`).join('') : '<div class="ad-arbol-h sis-tenue">Seleccione al menos una persona en el paso 2.</div>'}</div></div>
      <div class="ad-paquete-acc"><button type="button" class="sis-btn primario" data-a="lic-zip" data-id="${esc(l.id)}" ${elegidas.length ? '' : 'disabled'}>${ICO.descargar}Descargar todo · ${plural(elegidas.length, 'persona', 'personas')}</button>
        <p class="sis-tenue">Cada carpeta lleva el nombre de la persona y los documentos siguen una nomenclatura estándar (por ejemplo, <span class="mono">02_Titulo_profesional.pdf</span>). El listado inicial resume el estado de cada documento por persona. Los documentos faltantes no se incluyen; revise la columna «Resultado» antes de presentar.</p></div>
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
  // Listado inicial: una fila por persona y una columna por documento exigido, con su estado y vencimiento.
  const tipos = (l.requisitos || []).map(r => v.st.d.tipos.find(t => t.id === r)).filter(Boolean);
  const sel = new Set(l.personas || []);
  const c = x => `"${String(x ?? '').replace(/"/g, '""')}"`;
  const filas = cumplimientoLicitacion(l.requisitos || [], v.st.personas, { ...v.st.d, hoy: hoyISO(), diasAviso: v.st.d.config.diasAviso }).filter(f => sel.has(f.personaId))
    .map(f => [f.persona.nombre, f.persona.cargo || '', ...f.celdas.map(x => `${ESTADOS_VENC[x.e.estado] ? ESTADOS_VENC[x.e.estado].texto : x.e.estado}${x.doc && x.doc.vence ? ` (vence ${fechaLegible(x.doc.vence)})` : ''}`), f.faltan ? `No cumple (${f.faltan})` : 'Cumple']);
  const csv = [['Persona', 'Cargo', ...tipos.map(t => t.nombre), 'Resultado'], ...filas].map(f => f.map(c).join(';')).join('\r\n');
  todas.unshift({ nombre: '00_Listado_de_documentos.csv', datos: new TextEncoder().encode('\ufeff' + csv) });
  descargar(`${nombreZip(l)}.zip`, new Blob([armarZip(todas)], { type: 'application/zip' }));
  await guardarRegistro(ALM.licitaciones, { id: l.id, descargas: [...(l.descargas || []), { por: v.ctx.personaId, en: new Date().toISOString() }].slice(-20) });
  v.avisar(faltan ? `Carpeta descargada. ${faltan} archivo(s) no se encontraron en este equipo: conecte la nube y vuelva a intentar.` : 'Carpeta descargada');
}

/** CV en PDF (jsPDF de vendor/): datos de la persona y proyectos del sistema. */
async function cvPdf(v, persona) {
  if (!(window.jspdf && window.jspdf.jsPDF)) await cargarScript('vendor/jspdf.umd.min.js');
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'letter' });
  const ps = proyectosDePersona(v.st, persona.id);
  let y = 22;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(persona.nombre, 20, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text(persona.cargo || '', 20, y); y += 5;
  doc.setFontSize(9); doc.setTextColor(90); doc.text(`${v.ctx.marca ? v.ctx.marca.nombre : nombreEmpresa()} · CV generado el ${fechaLegible(hoyISO())} desde el Sistema de trabajo`, 20, y); doc.setTextColor(0); y += 10;
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
  'lic-borrar': async (b, v) => { if (!confirm('¿Eliminar esta carpeta? Los documentos del personal no se eliminan.')) return false; await aPapelera(ALM.licitaciones, b.dataset.id); v.ir('#/personal/carpetas'); return false; },
  'lic-sincronizar': async (b, v) => {
    const l = v.st.d.licitaciones.find(x => x.id === b.dataset.id), p = l && v.st.proyectos.find(x => x.id === l.proyectoId);
    if (!p) return false;
    const base = carpetaDesdeProyecto(v.st, p);
    await guardarRegistro(ALM.licitaciones, { id: l.id, nombre: base.nombre, mandanteId: base.mandanteId, personas: base.personas, requisitos: (l.requisitos || []).length ? l.requisitos : base.requisitos });
    v.avisar('Carpeta actualizada con el equipo del proyecto'); return true;
  },
};

export const cambios = {
  'epp-firmado': async (i, v) => { const fi = v.st.d.fichas.find(x => x.id === i.dataset.id) || {}; const epp = (fi.epp || []).map((x, k) => (k === Number(i.dataset.k) ? { ...x, firmado: i.checked } : x)); await guardarFicha(i.dataset.id, { epp }); return true; },
  ingreso: async (i, v) => { const fi = v.st.d.fichas.find(x => x.id === i.dataset.id) || {}; await guardarFicha(i.dataset.id, { ingreso: { ...(fi.ingreso || {}), [i.dataset.k]: i.checked } }); return true; },
  'lic-solo': async (i) => { await guardarRegistro(ALM.licitaciones, { id: i.dataset.id, soloCumplen: i.checked }); return true; },
  'lic-cv': async (i) => { await guardarRegistro(ALM.licitaciones, { id: i.dataset.id, incluirCV: i.checked }); return true; },
  'lic-persona': async (i, v) => { const l = v.st.d.licitaciones.find(x => x.id === i.dataset.id); const s = new Set(l.personas || []); i.checked ? s.add(i.dataset.p) : s.delete(i.dataset.p); await guardarRegistro(ALM.licitaciones, { id: l.id, personas: [...s] }); return true; },
};

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
    const personaId = f.dataset.id || fd.get('personaId');
    if (!personaId) throw new Error('Seleccione al trabajador.');
    const solicitud = f.dataset.solicitud === '1';
    await guardarRegistro(ALM.ausencias, { personaId, tipo: fd.get('tipo'), estado: solicitud ? 'solicitada' : (fd.get('estado') || 'aprobada'), desde, hasta, nota: txt(fd, 'nota'), solicitadaPor: v.ctx.personaId || null });
    v.avisar(solicitud ? 'Solicitud enviada: queda por aprobar' : 'Ausencia registrada'); return true;
  },
  tallas: async (f, fd, v) => { await guardarFicha(f.dataset.id, { tallas: { polera: txt(fd, 'polera'), pantalon: txt(fd, 'pantalon'), calzado: txt(fd, 'calzado') } }); v.avisar('Tallas guardadas'); return true; },
  epp: async (f, fd, v) => { const fi = v.st.d.fichas.find(x => x.id === f.dataset.id) || {}; await guardarFicha(f.dataset.id, { epp: [...(fi.epp || []), { item: txt(fd, 'item'), entregado: fd.get('entregado') || '', reponer: fd.get('reponer') || '', firmado: false }] }); v.avisar('Entrega registrada'); return true; },
  emergencia: async (f, fd, v) => { await guardarFicha(f.dataset.id, { emergencia: { nombre: txt(fd, 'nombre'), relacion: txt(fd, 'relacion'), telefono: txt(fd, 'telefono') } }); v.avisar('Contacto guardado'); return true; },
  'licitacion-nueva': async (f, fd, v) => {
    const m = v.st.d.mandantes.find(x => x.id === fd.get('mandanteId'));
    const req = m ? (m.requisitosPersona || []).map(r => r.tipoId) : [];
    const l = await guardarRegistro(ALM.licitaciones, { nombre: txt(fd, 'nombre'), mandanteId: fd.get('mandanteId') || null, requisitos: req, personas: [], incluirCV: true });
    v.ir(`#/personal/carpeta/${l.id}`); return false;
  },
  'carpeta-proyecto': async (f, fd, v) => { v.ir(`#/personal/carpeta-proyecto/${fd.get('proyectoId')}`); return false; },
};

export { mandanteDeProyecto, NOMBRE_CONTRATO };
