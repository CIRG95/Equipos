// app/vistas-encargo.js — «Encargar proyecto» (Sistema v0.16): asistente en 5 pasos para crear o editar un proyecto.
// Reemplaza al formulario largo de «Nuevo proyecto»: datos básicos → cronograma → información → equipo → revisar.
// Lo usan Jefatura (encarga a un geomensor, topógrafo o piloto) y el encargado de terreno (registra el encargo recibido).
// Mientras se completa, el panel «Calidad del encargo» indica qué información falta para trabajar sin llamadas.
// Rutas: #/encargo/nuevo · #/encargo/<proyectoId>. Las reglas puras están en app/encargo.js.

import { escapar as esc, hoyISO, fechaLegible } from '../compartido/util.js';
import { listarProyectos, obtenerProyecto, listarPersonas, OFICINA_ID } from '../compartido/catalogos.js';
import { archivosDe } from '../compartido/archivos.js';
import { BASE_RECURRENTE, SEMANAS, DATOS } from '../compartido/periodicidad.js';
import * as Administracion from '../modulos/administracion/administracion.js';
import { habilitacionPersona } from '../modulos/administracion/modelo.js';
import { CATEGORIAS_TRABAJO, tiposDeProyecto, REGIONES, NOMBRE_ROL_PERSONA } from './catalogo.js';
import { vacio } from './vistas-ui.js';
import { INFO_ENCARGO, calidadEncargo, sugerirCronograma, resumenCronograma, barraActividad, rangoProyecto, seCruzan, genteDeProyecto } from './encargo.js';

const PASOS = [['1', 'Datos básicos', 'Qué se pide y para quién'], ['2', 'Cronograma', 'Plazos estimados de cada actividad'], ['3', 'Información', 'Antecedentes que recibe el encargado'], ['4', 'Equipo de trabajo', 'Quiénes realizan el proyecto'], ['5', 'Revisar y encargar', 'Resumen antes de emitir']];
const SUGERENCIAS_ENTREGABLES = {
  dron: ['Ortofoto', 'Modelo digital de superficie', 'Nube de puntos', 'Curvas de nivel'], gnss: ['Monografías', 'Informe de red geodésica'],
  nivelacion: ['Registro de nivelación', 'Perfil longitudinal'], estacion: ['Plano topográfico', 'Planilla de coordenadas', 'Cubicación'],
  escaneo: ['Nube de puntos registrada', 'Modelo 3D'], batimetria: ['Plano batimétrico'], otro: ['Informe técnico'],
};
const iniciales = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');
const json = o => JSON.stringify(o).replace(/</g, '\\u003c');

export function htmlPeriodicidad(p) {
  const per = { ...BASE_RECURRENTE, ...(p.periodicidad || {}), tipo: (p.periodicidad && p.periodicidad.tipo) || 'unico' };
  const v = k => esc(per[k] ?? '');
  return `<fieldset class="sis-periodicidad"><legend>Periodicidad</legend>
    <div class="sis-opciones"><label class="sis-opcion"><input type="radio" name="perTipo" value="unico" ${per.tipo !== 'recurrente' ? 'checked' : ''}> Único (una entrega)</label><label class="sis-opcion"><input type="radio" name="perTipo" value="recurrente" ${per.tipo === 'recurrente' ? 'checked' : ''}> Recurrente (servicio que se repite)</label></div>
    <div class="sis-per-rec">
      <div class="sis-par"><label class="sis-campo"><span>Se repite cada</span><span class="sis-en-linea"><input type="number" name="perCada" min="1" max="12" value="${v('cada')}"><select name="perUnidad"><option value="mes" ${per.unidad !== 'semana' ? 'selected' : ''}>mes(es)</option><option value="semana" ${per.unidad === 'semana' ? 'selected' : ''}>semana(s)</option></select></span></label>
        <label class="sis-campo"><span>Primer ciclo (mes o lunes de inicio)</span><input name="perDesde" value="${v('desde')}" placeholder="2025-10 o 2026-11-02"></label></div>
      <div class="sis-par"><label class="sis-campo"><span>N° de mes del contrato del primer ciclo</span><input type="number" name="perMesInicial" min="1" value="${v('mesInicial')}"></label>
        <label class="sis-campo"><span>Terreno (servicio mensual): parte en la</span><select name="perSemana">${SEMANAS.map(([k, t]) => `<option value="${k}" ${per.semana === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
      <div class="sis-par"><label class="sis-campo"><span>Días de terreno (hábiles)</span><input type="number" name="perDias" min="1" max="20" value="${v('diasTerreno')}"></label>
        <label class="sis-campo"><span>Los datos llegan</span><select name="perDatos">${DATOS.map(([k, t]) => `<option value="${k}" ${per.datos === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
      <div class="sis-par"><label class="sis-campo"><span>Entrega: días hábiles después de los datos</span><input type="number" name="perEntrega" min="0" max="60" value="${v('diasEntrega')}"></label>
        <label class="sis-campo"><span>Hasta (vacío: sin término)</span><input type="date" name="perHasta" value="${v('hasta')}"></label></div>
      <p class="sis-tenue">Cada ciclo aparece en el Calendario (terreno, llegada de datos y entrega) y, al crear el mes en Entregas, toma su nombre, N° de mes y fecha de llegada de los datos. Días hábiles = lunes a viernes.</p>
    </div></fieldset>`;
}

/** Lee la periodicidad desde el formulario (FormData). */
export function leerPeriodicidad(datos) {
  if (datos.get('perTipo') !== 'recurrente') return { tipo: 'unico' };
  return {
    tipo: 'recurrente', cada: Math.max(1, Number(datos.get('perCada')) || 1), unidad: datos.get('perUnidad') === 'semana' ? 'semana' : 'mes',
    desde: (datos.get('perDesde') || '').trim(), mesInicial: Math.max(1, Number(datos.get('perMesInicial')) || 1), semana: datos.get('perSemana') || 'ultima',
    diasTerreno: Math.max(1, Number(datos.get('perDias')) || 1), datos: datos.get('perDatos') || 'lunes', diasEntrega: Math.max(0, Number(datos.get('perEntrega')) || 0), hasta: datos.get('perHasta') || '',
  };
}

const filaCrono = (a, personas) => `<div class="enc-crono-fila" data-fila>
    <input type="hidden" name="cr_id" value="${esc(a.id || '')}"><input type="hidden" name="cr_hecho" value="${a.hecho ? '1' : ''}">
    <input name="cr_nombre" value="${esc(a.nombre || '')}" placeholder="Actividad" aria-label="Actividad">
    <input type="date" name="cr_desde" value="${esc(a.desde || '')}" aria-label="Desde">
    <input type="date" name="cr_hasta" value="${esc(a.hasta || '')}" aria-label="Hasta">
    <select name="cr_resp" aria-label="Responsable"><option value="">Responsable</option>${personas.map(x => `<option value="${esc(x.id)}" ${a.responsableId === x.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>
    <button type="button" class="sis-btn chico" data-enc="quitar-fila" aria-label="Quitar actividad">×</button></div>`;

export async function encargo(ctx, id) {
  const nuevo = !id || id === 'nuevo';
  const p = nuevo ? { estado: 'activo', tiposTrabajo: [], encargadoId: ctx.rol === 'terreno' ? (ctx.personaId || '') : '', fechaEncargo: hoyISO(), cuadrilla: [], vehiculoIds: [] } : await obtenerProyecto(id);
  if (!p || p.eliminadoEn) return vacio('Este proyecto no existe o está en la papelera.', '<a class="sis-btn" href="#/proyectos">Volver a Proyectos</a>');
  if (p.id === OFICINA_ID) return vacio('«Oficina» es un proyecto especial y no se edita.', '<a class="sis-btn" href="#/proyectos">Volver</a>');
  const [personas, adm, proyectos, adjuntos] = await Promise.all([listarPersonas(), Administracion.datos().catch(() => null), listarProyectos(), nuevo ? [] : archivosDe('encargo', p.id).catch(() => [])]);
  const hoy = hoyISO();
  const val = k => esc(p[k] ?? '');
  const tipos = tiposDeProyecto(p);
  const mandantes = adm ? adm.mandantes : [], vehiculos = adm ? adm.vehiculos : [];
  const info = (p.encargo && p.encargo.info) || {};
  const contacto = p.contactoTerreno || {};
  const jefatura = ctx.rol !== 'terreno';

  // Datos para calcular la disponibilidad en vivo (se leen en iniciarEncargo).
  const gente = personas.map(x => ({
    id: x.id, nombre: x.nombre,
    hab: adm ? habilitacionPersona(x.id, { ...adm, hoy, diasAviso: adm.config.diasAviso }).nivel : 'ok',
    aus: adm ? adm.ausencias.filter(a => a.personaId === x.id && a.estado !== 'rechazada' && (a.hasta || a.desde) >= hoy).map(a => ({ desde: a.desde, hasta: a.hasta || a.desde })) : [],
    proys: proyectos.filter(q => q.id !== OFICINA_ID && q.id !== p.id && q.estado !== 'cerrado' && genteDeProyecto(q).includes(x.id)).map(q => ({ nombre: q.nombre, rango: rangoProyecto(q) })),
  }));

  const pasos = `<ol class="enc-pasos" role="tablist" aria-label="Pasos del encargo">${PASOS.map(([n, t, d], i) => `<li><button type="button" role="tab" class="enc-paso-btn${i === 0 ? ' activo' : ''}" data-enc="ir" data-p="${n}" aria-selected="${i === 0}"><span>${n}</span><b>${t}</b><small>${d}</small></button></li>`).join('')}</ol>`;

  const paso1 = `<section class="enc-paso activo" data-paso="1" role="tabpanel"><h2>Datos básicos</h2>
    <p class="sis-tenue">Indique qué se solicita y para quién. Esta información se ingresa una sola vez y queda disponible en todos los módulos del proyecto.</p>
    <label class="sis-campo"><span>Nombre del proyecto *</span><input name="nombre" required value="${val('nombre')}" placeholder="Ej.: Canal Norte — levantamiento y batimetría"></label>
    <div class="sis-par">
      ${mandantes.length ? `<label class="sis-campo"><span>Mandante registrado (define la acreditación)</span><select name="mandanteId"><option value="">Otro: escribir el nombre</option>${mandantes.map(m => `<option value="${esc(m.id)}" data-nombre="${esc(m.nombre)}" ${p.mandanteId === m.id ? 'selected' : ''}>${esc(m.nombre)}${m.plataforma ? ` · ${esc(m.plataforma)}` : ''}</option>`).join('')}</select></label>` : ''}
      <label class="sis-campo"><span>Mandante</span><input name="mandante" value="${val('mandante')}" placeholder="Empresa que encarga el trabajo"></label>
    </div>
    <div class="sis-campo"><span>Tipos de trabajo (uno o más; el detalle es opcional)</span>
      <div class="sis-categorias">${CATEGORIAS_TRABAJO.map(c => `<label class="sis-opcion sis-cat"><input type="checkbox" name="tipos" value="${c.k}" ${tipos.categorias.includes(c.k) ? 'checked' : ''}> ${c.t}</label>`).join('')}</div>
      <div class="sis-detalles">${CATEGORIAS_TRABAJO.map(c => `<div class="sis-detalle" data-cat="${c.k}"><b>${c.t}</b>
        ${c.det.map(([d, t]) => `<label class="sis-opcion chico"><input type="checkbox" name="detalle" value="${c.k}:${d}" ${tipos.detalles.includes(`${c.k}:${d}`) ? 'checked' : ''}> ${t}</label>`).join('')}
        ${c.texto ? `<input name="tipoOtro" class="sis-detalle-texto" value="${val('tipoOtro')}" placeholder="¿Cuál?" aria-label="Otro tipo de trabajo">` : ''}</div>`).join('')}</div></div>
    <div class="sis-par">
      <label class="sis-campo"><span>Comuna</span><input name="comuna" value="${val('comuna')}"></label>
      <label class="sis-campo"><span>Región</span><select name="region"><option value=""></option>${REGIONES.map(r => `<option ${p.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
    </div>
    <label class="sis-campo"><span>Alcance del trabajo</span><textarea name="alcance" rows="3" placeholder="Ej.: red de 12 PR amarrada a SIRGAS-Chile, vuelo fotogramétrico de 180 ha con GSD de 3 cm y entrega de ortofoto y MDS.">${val('alcance')}</textarea></label>
    <label class="sis-campo"><span>Entregables solicitados</span><input name="entregablesPedidos" value="${val('entregablesPedidos')}" placeholder="Monografías, informe de red, ortofoto…">
      <span class="enc-sugerencias" data-enc-sug aria-label="Sugerencias de entregables"></span></label>
    <div class="sis-par">
      <label class="sis-campo"><span>Solicitado por (mandante o área)</span><input name="solicitadoPor" value="${val('solicitadoPor')}" placeholder="Quién lo pidió"></label>
      ${jefatura ? `<label class="sis-campo"><span>Monto cotizado ($)</span><input type="number" min="0" name="montoCotizado" value="${val('montoCotizado')}"></label>` : ''}
    </div>
    <div class="sis-campo"><span>Prioridad</span><div class="sis-opciones">${[['normal', 'Normal'], ['urgente', 'Urgente']].map(([k, t]) => `<label class="sis-opcion"><input type="radio" name="prioridad" value="${k}" ${((p.encargo && p.encargo.prioridad) || 'normal') === k ? 'checked' : ''}> ${t}</label>`).join('')}</div></div>
  </section>`;

  const crono = (p.cronograma || []).length ? p.cronograma : [];
  const paso2 = `<section class="enc-paso" data-paso="2" role="tabpanel" hidden><h2>Cronograma estimado</h2>
    <p class="sis-tenue">Defina las fechas del encargo y las actividades previstas. «Sugerir cronograma» propone una distribución según los tipos de trabajo; cada fecha se puede ajustar.</p>
    <div class="sis-par">
      <label class="sis-campo"><span>Fecha del encargo</span><input type="date" name="fechaEncargo" value="${val('fechaEncargo')}"></label>
      <label class="sis-campo"><span>Inicio de los trabajos</span><input type="date" name="fechaInicio" value="${val('fechaInicio')}"></label>
    </div>
    <label class="sis-campo"><span>Plazo de entrega al mandante</span><input type="date" name="plazo" value="${val('plazo')}"></label>
    <div class="sis-cab"><h3 class="sis-sub">Actividades</h3><div class="sis-acciones"><button type="button" class="sis-btn chico" data-enc="sugerir">Sugerir cronograma</button><button type="button" class="sis-btn chico" data-enc="agregar-fila">+ Actividad</button></div></div>
    <div class="enc-crono" data-enc-crono>${crono.map(a => filaCrono(a, personas)).join('')}</div>
    <template data-enc-plantilla>${filaCrono({}, personas)}</template>
    <div class="enc-gantt" data-enc-gantt aria-live="polite"></div>
    ${htmlPeriodicidad(p)}
  </section>`;

  const paso3 = `<section class="enc-paso" data-paso="3" role="tabpanel" hidden><h2>Información para el encargado</h2>
    <p class="sis-tenue">Indique el estado de cada antecedente. Lo marcado como «Pendiente» queda registrado a nombre de quien encarga hasta que se entregue; «No aplica» lo descarta.</p>
    <div class="enc-info">${INFO_ENCARGO.map(([k, t, d]) => `<div class="enc-info-fila"><span class="enc-info-txt"><b>${esc(t)}</b><small>${esc(d)}</small></span>
      <span class="enc-seg" role="radiogroup" aria-label="${esc(t)}">${[['si', 'Entregada'], ['pend', 'Pendiente'], ['na', 'No aplica']].map(([e, te]) => `<label class="${e}"><input type="radio" name="info_${k}" value="${e}" ${info[k] === e ? 'checked' : ''}><span>${te}</span></label>`).join('')}</span></div>`).join('')}</div>
    <div class="sis-par">
      <label class="sis-campo"><span>Contacto en terreno: nombre</span><input name="contactoNombre" value="${esc(contacto.nombre || '')}" placeholder="Quien recibe a la cuadrilla"></label>
      <label class="sis-campo"><span>Contacto en terreno: teléfono</span><input type="tel" name="contactoTelefono" value="${esc(contacto.telefono || '')}"></label>
    </div>
    <label class="sis-campo"><span>Sistema de referencia</span><input name="sistemaReferencia" value="${val('sistemaReferencia')}" placeholder="Ej.: SIRGAS-Chile, UTM huso 19 S, cotas NMM"></label>
    <label class="sis-campo"><span>Adjuntar archivos (KMZ, bases técnicas, planos, correos)</span><input type="file" name="archivos" multiple>
      <small class="sis-tenue" data-enc-archivos>${adjuntos.length ? `Ya adjuntos: ${adjuntos.map(a => esc(a.nombre)).join(', ')}.` : 'Se guardan en la carpeta «Encargo» del proyecto.'}</small></label>
    <label class="sis-campo"><span>Instrucciones adicionales</span><textarea name="notas" rows="3" placeholder="Indicaciones que hoy se entregan por teléfono: accesos, horarios, restricciones, prioridades.">${val('notas')}</textarea></label>
  </section>`;

  const sel = new Set(p.cuadrilla || []);
  const paso4 = `<section class="enc-paso" data-paso="4" role="tabpanel" hidden><h2>Equipo de trabajo</h2>
    <p class="sis-tenue">Seleccione a quienes realizarán el proyecto y marque a uno como encargado. La disponibilidad considera las fechas del cronograma, las vacaciones registradas y los demás proyectos activos.</p>
    ${personas.length ? `<div class="enc-gente">${personas.map(x => `<div class="enc-persona${sel.has(x.id) || p.encargadoId === x.id ? ' elegida' : ''}" data-persona="${esc(x.id)}">
      <label class="enc-persona-cab"><input type="checkbox" name="cuadrilla" value="${esc(x.id)}" ${sel.has(x.id) || p.encargadoId === x.id ? 'checked' : ''}>
        <span class="ad-avatar chico" aria-hidden="true">${esc(iniciales(x.nombre))}</span>
        <span class="enc-persona-txt"><b>${esc(x.nombre)}</b><small>${esc(x.cargo || (x.roles || []).map(r => NOMBRE_ROL_PERSONA[r] || r).join(', ') || 'Sin cargo')}</small></span></label>
      <div class="enc-persona-estado" data-estado></div>
      <label class="enc-encargado"><input type="radio" name="encargadoId" value="${esc(x.id)}" ${p.encargadoId === x.id ? 'checked' : ''}> Encargado</label></div>`).join('')}</div>` : vacio('Aún no hay personas registradas. Agréguelas en Personas.')}
    ${vehiculos.length ? `<div class="sis-campo"><span>Vehículos asignados</span><div class="sis-opciones">${vehiculos.map(v => `<label class="sis-opcion"><input type="checkbox" name="vehiculoIds" value="${esc(v.id)}" ${(p.vehiculoIds || []).includes(v.id) ? 'checked' : ''}> <span class="mono">${esc(v.patente)}</span></label>`).join('')}</div></div>` : '<p class="sis-tenue">Los vehículos se registran en Administración.</p>'}
  </section>`;

  const paso5 = `<section class="enc-paso" data-paso="5" role="tabpanel" hidden><h2>Revisar y ${nuevo ? 'encargar' : 'guardar'}</h2>
    <div class="enc-resumen" data-enc-resumen></div>
    ${nuevo ? '<p class="sis-tenue">Al encargar, el proyecto queda creado y el encargado recibe un aviso para acusar recibo. Las consultas, instrucciones y acuerdos posteriores se registran en la bitácora del proyecto.</p>' : `
    <label class="sis-campo"><span>Estado</span><select name="estado"><option value="activo">Activo</option><option value="cerrado" ${p.estado === 'cerrado' ? 'selected' : ''}>Cerrado</option></select></label>`}
  </section>`;

  return `<a class="sis-volver" href="${nuevo ? '#/proyectos' : `#/proyecto/${esc(p.id)}`}">← Volver</a>
    <div class="sis-cab"><div><h1>${nuevo ? 'Encargar proyecto' : `Editar encargo · ${esc(p.nombre)}`}</h1><span class="sis-tenue">${nuevo ? 'Cinco pasos breves. Puede avanzar y retroceder libremente; nada se guarda hasta el último paso.' : 'Los cambios se guardan al final, en el paso 5.'}</span></div></div>
    <form class="sis-form enc" data-form="encargo" data-id="${nuevo ? '' : esc(p.id)}" novalidate>
      ${pasos}
      <div class="enc-cuerpo">
        <div class="enc-principal sis-tarjeta">${paso1}${paso2}${paso3}${paso4}${paso5}
          <div class="enc-nav"><button type="button" class="sis-btn" data-enc="atras" hidden>← Anterior</button><span class="enc-nav-esp"></span>
            <button type="button" class="sis-btn primario" data-enc="sig">Siguiente →</button>
            <button class="sis-btn primario" data-enc-enviar hidden>${nuevo ? 'Encargar proyecto' : 'Guardar cambios'}</button></div>
        </div>
        <aside class="enc-lateral sis-tarjeta" aria-live="polite"><h2>Calidad del encargo</h2>
          <div class="enc-medidor"><div class="enc-medidor-barra"><i data-enc-barra style="width:0%"></i></div><b data-enc-pct>0 %</b></div>
          <p class="sis-tenue" data-enc-frase></p>
          <ul class="enc-check" data-enc-check></ul>
        </aside>
      </div>
      ${nuevo ? '' : `<div class="sis-acciones enc-peligro"><button type="button" class="sis-btn" data-accion="cerrar-proyecto" data-id="${esc(p.id)}">${p.estado === 'cerrado' ? 'Reabrir proyecto' : 'Cerrar proyecto'}</button>
        <button type="button" class="sis-btn peligro" data-accion="eliminar-proyecto" data-id="${esc(p.id)}">Eliminar</button></div>
        <p class="sis-tenue">«Cerrar» es para un trabajo terminado: queda en el registro por mandante. «Eliminar» es para un proyecto creado por error: va a la papelera y se puede restaurar desde Proyectos.</p>`}
      <script type="application/json" data-enc-datos>${json({ gente, hoy, sugerencias: SUGERENCIAS_ENTREGABLES, personas: personas.map(x => ({ id: x.id, nombre: x.nombre })), nuevo })}</script>
    </form>`;
}

/** Lee el formulario del encargo como un proyecto parcial (lo usan la pantalla en vivo y el guardado). */
export function leerEncargo(form) {
  const d = new FormData(form);
  const t = k => String(d.get(k) || '').trim();
  const tipos = d.getAll('tipos');
  const filas = [...form.querySelectorAll('[data-fila]')].map((f, i) => {
    const q = n => f.querySelector(`[name="${n}"]`).value.trim();
    return { id: q('cr_id') || `a${Date.now().toString(36)}${i}`, nombre: q('cr_nombre'), desde: q('cr_desde'), hasta: q('cr_hasta') || q('cr_desde'), responsableId: q('cr_resp') || null, hecho: q('cr_hecho') === '1' };
  }).filter(a => a.nombre || a.desde);
  const info = {};
  for (const [k] of INFO_ENCARGO) { const v = d.get(`info_${k}`); if (v) info[k] = v; }
  const contacto = { nombre: t('contactoNombre'), telefono: t('contactoTelefono') };
  if (contacto.nombre && contacto.telefono && !info.contacto) info.contacto = 'si';
  const encargadoId = d.get('encargadoId') || null;
  const cuadrilla = d.getAll('cuadrilla');
  const selMandante = form.querySelector('[name="mandanteId"]');
  const nombreMandante = selMandante && selMandante.selectedOptions[0] ? selMandante.selectedOptions[0].dataset.nombre || '' : '';
  return {
    nombre: t('nombre'), mandante: t('mandante') || nombreMandante, ...(d.has('mandanteId') ? { mandanteId: d.get('mandanteId') || null } : {}),
    tiposTrabajo: tipos, tiposDetalle: d.getAll('detalle').filter(x => tipos.includes(x.split(':')[0])), tipoOtro: tipos.includes('otro') ? t('tipoOtro') : '',
    comuna: t('comuna'), region: d.get('region') || '', alcance: t('alcance'), entregablesPedidos: t('entregablesPedidos'), solicitadoPor: t('solicitadoPor'),
    ...(d.has('montoCotizado') ? { montoCotizado: d.get('montoCotizado') === '' ? '' : Number(d.get('montoCotizado')) } : {}),
    fechaEncargo: d.get('fechaEncargo') || '', fechaInicio: d.get('fechaInicio') || '', plazo: d.get('plazo') || '',
    cronograma: filas, periodicidad: leerPeriodicidad(d),
    contactoTerreno: contacto, sistemaReferencia: t('sistemaReferencia'), notas: t('notas'),
    encargadoId, cuadrilla: encargadoId && !cuadrilla.includes(encargadoId) ? [encargadoId, ...cuadrilla] : cuadrilla, vehiculoIds: d.getAll('vehiculoIds'),
    ...(d.has('estado') ? { estado: d.get('estado') } : {}),
    encargo: { info, prioridad: d.get('prioridad') || 'normal' },
  };
}

const corta = iso => (iso ? fechaLegible(iso) : '—');

/** Comportamiento en vivo del asistente (se llama después de pintar la pantalla). */
export function iniciarEncargo(raiz) {
  const form = raiz.querySelector('form.enc');
  if (!form) return;
  const D = JSON.parse(form.querySelector('[data-enc-datos]').textContent);
  const $ = s => form.querySelector(s), $$ = s => [...form.querySelectorAll(s)];
  let paso = 1;
  const nomPers = id => (D.personas.find(x => x.id === id) || {}).nombre || '';

  function irA(n) {
    paso = Math.max(1, Math.min(PASOS.length, n));
    $$('.enc-paso').forEach(s => { const a = Number(s.dataset.paso) === paso; s.hidden = !a; s.classList.toggle('activo', a); });
    $$('.enc-paso-btn').forEach(b => { const a = Number(b.dataset.p) === paso; b.classList.toggle('activo', a); b.classList.toggle('hecho', Number(b.dataset.p) < paso); b.setAttribute('aria-selected', String(a)); });
    $('[data-enc="atras"]').hidden = paso === 1;
    $('[data-enc="sig"]').hidden = paso === PASOS.length;
    $('[data-enc-enviar]').hidden = paso !== PASOS.length;
    if (paso === PASOS.length) pintarResumen();
    form.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function rango(p) {
    const r = resumenCronograma(p.cronograma);
    const desde = r.desde || p.fechaInicio || p.fechaEncargo || D.hoy;
    const hasta = r.hasta || p.plazo || desde;
    return { desde, hasta: hasta < desde ? desde : hasta };
  }

  function pintarGantt(p) {
    const g = $('[data-enc-gantt]');
    const acts = p.cronograma.filter(a => a.nombre && a.desde && a.hasta && a.hasta >= a.desde);
    if (!acts.length) { g.innerHTML = '<p class="sis-tenue">Agregue actividades con sus fechas para ver la línea de tiempo.</p>'; return; }
    const r = resumenCronograma(acts);
    g.innerHTML = `<div class="enc-gantt-cab"><span>${corta(r.desde)}</span><b>${r.dias} día${r.dias === 1 ? '' : 's'}</b><span>${corta(r.hasta)}</span></div>
      ${acts.map((a, i) => { const b = barraActividad(a, r.desde, r.hasta); return `<div class="enc-gantt-fila"><span class="enc-gantt-nombre" title="${esc(a.nombre)}">${esc(a.nombre)}</span><span class="enc-gantt-pista"><i class="c${i % 5}" style="margin-left:${b.izq.toFixed(2)}%;width:${b.ancho.toFixed(2)}%"></i></span></div>`; }).join('')}
      ${p.plazo && p.plazo < r.hasta ? `<p class="sis-aviso-linea">El cronograma termina después del plazo de entrega (${corta(p.plazo)}).</p>` : ''}`;
  }

  function pintarGente(p) {
    const r = rango(p);
    $$('.enc-persona').forEach(el => {
      const x = D.gente.find(g => g.id === el.dataset.persona); if (!x) return;
      const marcada = el.querySelector('[name="cuadrilla"]').checked || el.querySelector('[name="encargadoId"]').checked;
      el.classList.toggle('elegida', marcada);
      const aus = x.aus.find(a => seCruzan(a, r));
      const otros = x.proys.filter(q => !q.rango || seCruzan(q.rango, r));
      const chips = [];
      if (aus) chips.push(`<span class="sis-chip rojo">Ausente ${corta(aus.desde)} al ${corta(aus.hasta)}</span>`);
      if (otros.length) chips.push(`<span class="sis-chip ambar" title="${esc(otros.map(q => q.nombre).join(' · '))}">En ${otros.length === 1 ? esc(otros[0].nombre) : `${otros.length} proyectos`}</span>`);
      if (!aus && !otros.length) chips.push('<span class="sis-chip verde">Disponible</span>');
      if (x.hab === 'no') chips.push('<span class="sis-chip rojo">No habilitado</span>');
      else if (x.hab === 'aviso') chips.push('<span class="sis-chip ambar">Documentos por vencer</span>');
      el.querySelector('[data-estado]').innerHTML = chips.join('');
    });
  }

  function pintarSugerencias(p) {
    const cont = $('[data-enc-sug]'); if (!cont) return;
    const ya = p.entregablesPedidos.toLowerCase();
    const lista = [...new Set(p.tiposTrabajo.flatMap(t => D.sugerencias[t] || []))].filter(s => !ya.includes(s.toLowerCase()));
    // Solo se repinta si cambió: si no, al salir de otro campo el botón se reemplazaría bajo el cursor y el clic se perdería.
    const html = lista.map(s => `<button type="button" class="enc-sug" data-enc="sugerencia" data-t="${esc(s)}">+ ${esc(s)}</button>`).join('');
    if (cont.dataset.html !== html) { cont.innerHTML = html; cont.dataset.html = html; }
  }

  function pintarCalidad(p) {
    const c = calidadEncargo(p);
    $('[data-enc-barra]').style.width = `${c.pct}%`;
    $('[data-enc-barra]').className = c.pct >= 85 ? 'alto' : c.pct >= 55 ? 'medio' : 'bajo';
    $('[data-enc-pct]').textContent = `${c.pct} %`;
    $('[data-enc-frase]').textContent = c.pct >= 85 ? 'Encargo completo: el encargado puede planificar sin consultas adicionales.'
      : c.pct >= 55 ? 'Encargo utilizable. Complete lo que falta para evitar llamadas y reprocesos.' : 'Faltan antecedentes esenciales para ejecutar el trabajo.';
    $('[data-enc-check]').innerHTML = c.items.map(x => `<li class="${x.ok ? 'ok' : x.pendiente ? 'pend' : ''}"><i aria-hidden="true">${x.ok ? '✓' : x.pendiente ? '…' : ''}</i>${esc(x.texto)}${x.pendiente ? ' <small>pendiente de entregar</small>' : ''}</li>`).join('');
    return c;
  }

  function pintarResumen() {
    const p = leerEncargo(form), c = calidadEncargo(p), r = resumenCronograma(p.cronograma);
    const archivos = [...($('[name="archivos"]').files || [])];
    const dato = (t, v) => `<div class="sis-dato"><span>${t}</span><b>${v || '—'}</b></div>`;
    $('[data-enc-resumen]').innerHTML = `<div class="sis-datos">
        ${dato('Proyecto', esc(p.nombre))}${dato('Mandante', esc(p.mandante))}
        ${dato('Ubicación', esc([p.comuna, p.region].filter(Boolean).join(', ')))}${dato('Plazo de entrega', p.plazo ? corta(p.plazo) : (p.periodicidad.tipo === 'recurrente' ? 'Servicio recurrente' : ''))}
        ${dato('Cronograma', r.total ? `${r.total} actividades · ${corta(r.desde)} al ${corta(r.hasta)}` : '')}${dato('Encargado', esc(nomPers(p.encargadoId)))}
        ${dato('Equipo de trabajo', esc(p.cuadrilla.map(nomPers).filter(Boolean).join(', ')))}${dato('Archivos por adjuntar', archivos.length ? esc(archivos.map(a => a.name).join(', ')) : '')}
      </div>
      ${p.alcance ? `<p><b>Alcance:</b> ${esc(p.alcance)}</p>` : ''}${p.entregablesPedidos ? `<p><b>Entregables:</b> ${esc(p.entregablesPedidos)}</p>` : ''}
      ${c.faltan.length ? `<div class="enc-faltan"><b>Calidad del encargo: ${c.pct} %. Aún falta:</b><ul>${c.faltan.map(f => `<li>${esc(f)}</li>`).join('')}</ul><span class="sis-tenue">Puede emitir el encargo de todos modos: lo faltante queda visible en la ficha del proyecto.</span></div>` : '<div class="enc-completo">Encargo completo: toda la información fue entregada o descartada.</div>'}
      ${!p.nombre ? '<p class="sis-aviso-linea">Falta el nombre del proyecto (paso 1).</p>' : ''}`;
  }

  function refrescar() {
    const p = leerEncargo(form);
    pintarCalidad(p); pintarGantt(p); pintarGente(p); pintarSugerencias(p);
    if (paso === PASOS.length) pintarResumen();
  }

  function agregarFila(a = {}) {
    const cont = $('[data-enc-crono]');
    cont.insertAdjacentHTML('beforeend', $('[data-enc-plantilla]').innerHTML);
    const f = cont.lastElementChild;
    for (const [n, v] of [['cr_id', a.id], ['cr_nombre', a.nombre], ['cr_desde', a.desde], ['cr_hasta', a.hasta], ['cr_resp', a.responsableId]]) if (v) f.querySelector(`[name="${n}"]`).value = v;
    return f;
  }

  form.addEventListener('click', ev => {
    const b = ev.target.closest('[data-enc]'); if (!b) return;
    const a = b.dataset.enc;
    if (a === 'ir' || a === 'sig' || a === 'atras') {
      const destino = a === 'ir' ? Number(b.dataset.p) : paso + (a === 'sig' ? 1 : -1);
      const nombre = $('[name="nombre"]');
      if (destino > 1 && !nombre.value.trim()) { irA(1); nombre.focus(); nombre.reportValidity(); return; }
      irA(destino);
    } else if (a === 'agregar-fila') { agregarFila().querySelector('[name="cr_nombre"]').focus(); refrescar(); }
    else if (a === 'quitar-fila') { b.closest('[data-fila]').remove(); refrescar(); }
    else if (a === 'sugerir') {
      const p = leerEncargo(form);
      const desde = p.fechaInicio || p.fechaEncargo || D.hoy, hasta = p.plazo;
      if (!hasta || hasta < desde) { const i = $('[name="plazo"]'); i.focus(); i.setCustomValidity('Indique un plazo de entrega posterior al inicio para sugerir el cronograma.'); i.reportValidity(); i.setCustomValidity(''); return; }
      if ($$('[data-fila]').length && !confirm('¿Reemplazar las actividades actuales por el cronograma sugerido?')) return;
      $('[data-enc-crono]').innerHTML = '';
      sugerirCronograma(p.tiposTrabajo, desde, hasta).forEach(x => agregarFila({ ...x, id: '' }));
      refrescar();
    } else if (a === 'sugerencia') {
      const i = $('[name="entregablesPedidos"]');
      i.value = [i.value.trim().replace(/[,;.\s]+$/, ''), b.dataset.t].filter(Boolean).join(', ');
      refrescar();
    }
  });
  form.addEventListener('input', refrescar);
  form.addEventListener('change', ev => {
    // Elegir a alguien como encargado lo suma al equipo; el mandante registrado completa el nombre.
    if (ev.target.name === 'encargadoId') { const c = ev.target.closest('.enc-persona').querySelector('[name="cuadrilla"]'); c.checked = true; }
    if (ev.target.name === 'cuadrilla' && !ev.target.checked) { const r = ev.target.closest('.enc-persona').querySelector('[name="encargadoId"]'); r.checked = false; }
    if (ev.target.name === 'mandanteId') { const o = ev.target.selectedOptions[0]; if (o && o.dataset.nombre) $('[name="mandante"]').value = o.dataset.nombre; }
    if (ev.target.name === 'archivos') { const fs = [...ev.target.files]; $('[data-enc-archivos]').textContent = fs.length ? `Por adjuntar: ${fs.map(f => f.name).join(', ')}.` : 'Se guardan en la carpeta «Encargo» del proyecto.'; const area = $$('[name="info_area"]'); if (fs.some(f => /\.(kmz|kml|dwg|dxf|shp|zip|geojson)$/i.test(f.name)) && !area.some(x => x.checked)) area[0].checked = true; }
    refrescar();
  });
  // Enter en un campo no envía el encargo a medias: avanza al paso siguiente.
  form.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.tagName === 'INPUT' && ev.target.type !== 'file' && paso < PASOS.length) { ev.preventDefault(); $('[data-enc="sig"]').click(); }
  });
  refrescar();
}
