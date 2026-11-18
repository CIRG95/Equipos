// app/vistas-tecnico.js — proyecto del encargado de terreno (Sistema v0.17). Ruta #/proyecto-tecnico/<id|nuevo>.
// Jefatura encarga con «Encargar proyecto» (datos, plazos, información y equipo). El encargado de terreno usa este
// formulario corto para crear un proyecto propio (p. ej. cuando el encargo llegó por correo) o ajustar lo técnico de uno
// recibido: tipos de trabajo, fechas, sistema de referencia y las capas del proyecto (KMZ con caminos y PR).
// La planificación técnica (vuelos, red de PR, marcas, orden de los trabajos) se arma después en la ficha del proyecto.

import { escapar as esc } from '../compartido/util.js';
import { obtenerProyecto, listarPersonas, OFICINA_ID } from '../compartido/catalogos.js';
import * as Administracion from '../modulos/administracion/administracion.js';
import { CATEGORIAS_TRABAJO, tiposDeProyecto, REGIONES } from './catalogo.js';
import { vacio } from './vistas-ui.js';
import { resumenCapas } from '../modulos/vuelos/capas-proyecto.js';

export async function proyectoTecnico(ctx, id) {
  const nuevo = !id || id === 'nuevo';
  const p = nuevo ? { tiposTrabajo: [], fechaInicio: '', estado: 'activo' } : await obtenerProyecto(id);
  if (!p || p.eliminadoEn) return vacio('Este proyecto no existe o está en la papelera.', '<a class="sis-btn" href="#/proyectos">Volver a Proyectos</a>');
  if (p.id === OFICINA_ID) return vacio('«Oficina» es un proyecto especial y no se edita.', '<a class="sis-btn" href="#/proyectos">Volver</a>');
  const [adm, personas] = await Promise.all([Administracion.datos().catch(() => null), listarPersonas()]);
  const mandantes = adm ? adm.mandantes : [];
  const tipos = tiposDeProyecto(p);
  const val = k => esc(p[k] ?? '');
  const deJefatura = !nuevo && p.encargo && p.encargo.emitidoPor && p.encargo.emitidoPor !== ctx.personaId;
  const quien = deJefatura ? ((personas.find(x => x.id === p.encargo.emitidoPor) || {}).nombre || 'Jefatura') : '';
  const bloqueado = deJefatura ? 'readonly' : '';
  return `<a class="sis-volver" href="${nuevo ? '#/proyectos' : `#/proyecto/${esc(p.id)}`}">← Volver</a>
    <div class="sis-cab"><div><h1>${nuevo ? 'Nuevo proyecto' : `Datos técnicos · ${esc(p.nombre)}`}</h1>
      <span class="sis-tenue">${nuevo ? 'Para un trabajo que llegó por correo o teléfono. Registre lo esencial; los vuelos, la red de PR y el orden de los trabajos se arman después en la ficha del proyecto.' : 'Tipos de trabajo, fechas y capas del proyecto. La planificación de vuelos y redes se hace desde la ficha.'}</span></div></div>
    ${deJefatura ? `<div class="sis-aviso-linea">Proyecto encargado por ${esc(quien)}. El nombre, el mandante, el plazo y el alcance los mantiene quien encargó; si algo no corresponde, regístrelo como consulta en la bitácora.</div>` : ''}
    <form class="sis-form sis-tarjeta tec" data-form="proyecto-tecnico" data-id="${nuevo ? '' : esc(p.id)}">
      <h2>Datos básicos</h2>
      <label class="sis-campo"><span>Nombre del proyecto *</span><input name="nombre" required value="${val('nombre')}" ${bloqueado} placeholder="Ej.: Paita — vuelo fotogramétrico y red de PR"></label>
      <div class="sis-par">
        ${mandantes.length ? `<label class="sis-campo"><span>Mandante registrado</span><select name="mandanteId" ${deJefatura ? 'disabled' : ''}><option value="">Otro: escribir el nombre</option>${mandantes.map(m => `<option value="${esc(m.id)}" data-nombre="${esc(m.nombre)}" ${p.mandanteId === m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></label>` : ''}
        <label class="sis-campo"><span>Mandante</span><input name="mandante" value="${val('mandante')}" ${bloqueado}></label>
      </div>
      <div class="sis-campo"><span>Tipos de trabajo</span>
        <div class="sis-categorias">${CATEGORIAS_TRABAJO.map(c => `<label class="sis-opcion sis-cat"><input type="checkbox" name="tipos" value="${c.k}" ${tipos.categorias.includes(c.k) ? 'checked' : ''}> ${c.t}</label>`).join('')}</div>
        <div class="sis-detalles">${CATEGORIAS_TRABAJO.map(c => `<div class="sis-detalle" data-cat="${c.k}"><b>${c.t}</b>
          ${c.det.map(([d, t]) => `<label class="sis-opcion chico"><input type="checkbox" name="detalle" value="${c.k}:${d}" ${tipos.detalles.includes(`${c.k}:${d}`) ? 'checked' : ''}> ${t}</label>`).join('')}
          ${c.texto ? `<input name="tipoOtro" class="sis-detalle-texto" value="${val('tipoOtro')}" placeholder="¿Cuál?" aria-label="Otro tipo de trabajo">` : ''}</div>`).join('')}</div></div>
      <div class="sis-par">
        <label class="sis-campo"><span>Comuna</span><input name="comuna" value="${val('comuna')}"></label>
        <label class="sis-campo"><span>Región</span><select name="region"><option value=""></option>${REGIONES.map(r => `<option ${p.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      </div>
      <div class="sis-par">
        <label class="sis-campo"><span>Inicio de terreno</span><input type="date" name="fechaInicio" value="${val('fechaInicio')}"></label>
        <label class="sis-campo"><span>Plazo de entrega</span><input type="date" name="plazo" value="${val('plazo')}" ${bloqueado}></label>
      </div>
      <label class="sis-campo"><span>Alcance</span><textarea name="alcance" rows="2" ${bloqueado} placeholder="Qué se pidió, en pocas palabras.">${val('alcance')}</textarea></label>
      <label class="sis-campo"><span>Sistema de referencia</span><input name="sistemaReferencia" value="${val('sistemaReferencia')}" placeholder="Ej.: SIRGAS-Chile, UTM 19 S; WGS84 UTM 17 S"></label>
      <h2>Capas del proyecto</h2>
      <p class="sis-tenue">KMZ o KML con los caminos (líneas) y los PR ya instalados (puntos). Las usan las hojas de vuelo para elegir las bases de amarre y la planificación de la red.${p.capas ? ` Hoy: ${esc(resumenCapas(p.capas) || 'sin PR activos')}.` : ''}</p>
      <label class="sis-campo"><span>${p.capas ? 'Agregar capas' : 'Cargar capas'}</span><input type="file" name="capas" accept=".kml,.kmz" multiple></label>
      <div class="sis-acciones"><button class="sis-btn primario">${nuevo ? 'Crear proyecto' : 'Guardar'}</button><a class="sis-btn" href="${nuevo ? '#/proyectos' : `#/proyecto/${esc(p.id)}`}">Cancelar</a></div>
    </form>`;
}

/** Lee el formulario técnico como un proyecto parcial. Si el proyecto lo encargó Jefatura, no toca sus datos. */
export function leerTecnico(form, { deJefatura = false } = {}) {
  const d = new FormData(form);
  const t = k => String(d.get(k) || '').trim();
  const tipos = d.getAll('tipos');
  const sel = form.querySelector('[name="mandanteId"]');
  const nomMan = sel && sel.selectedOptions[0] ? sel.selectedOptions[0].dataset.nombre || '' : '';
  const tecnico = {
    tiposTrabajo: tipos, tiposDetalle: d.getAll('detalle').filter(x => tipos.includes(x.split(':')[0])), tipoOtro: tipos.includes('otro') ? t('tipoOtro') : '',
    comuna: t('comuna'), region: d.get('region') || '', fechaInicio: d.get('fechaInicio') || '', sistemaReferencia: t('sistemaReferencia'),
  };
  if (deJefatura) return tecnico;
  return { ...tecnico, nombre: t('nombre'), mandante: t('mandante') || nomMan, ...(sel ? { mandanteId: d.get('mandanteId') || null } : {}), plazo: d.get('plazo') || '', alcance: t('alcance') };
}

