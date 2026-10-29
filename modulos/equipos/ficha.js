// modulos/equipos/ficha.js — ficha del equipo (boceto de Camilo, 28-10-2026):
//   [ foto ]  [ nombre + datos y especificaciones ]
//   pestañas: Accesorios · Certificados · Historial · Mantención · Notas · Documentos · Administración (RRHH)
// También: editar especificaciones, editar accesorios, agregar certificado, etiqueta QR, certificados por proyecto.
// Lo usa pantallas.js; recibe sus utilidades en `ctx` para no duplicarlas.

import { fechaLegible, fechaHoraLegible, hoyISO, cargarScript } from '../../compartido/util.js';
import { listarProyectos, OFICINA_ID } from '../../compartido/catalogos.js';
import { archivosDe, urlArchivo, abrirArchivo, archivoAPapelera, tamanoLegible } from '../../compartido/archivos.js';
import {
  ESTADOS_ALERTA, PASOS_ALERTA, COMPONENTES_SUGERIDOS, ESTADOS_ACCESORIO, TIPOS_MANTENCION, CAMPOS_ADMIN,
  PERIODO_CALIBRACION_MESES, camposEspecificacion, especificacionesDeDescripcion, periodosDeUso, claveModelo, alertaActiva,
} from './modelo.js';
import {
  estadoDeEquipo, listarConEstado, usosConAlerta, fijarFoto, guardarAccesorios, cambiarEstadoAccesorio,
  obtenerModelo, guardarEspecificaciones, subirDocumento, listarCertificados, agregarCertificado, adjuntarPdfCertificado,
  papeleraCertificado, listarMantenciones, agregarMantencion, papeleraMantencion, listarNotas, agregarNota, archivarNota,
  guardarAdmin, personaActiva,
} from './datos.js';

let urlQR = 'vendor/qrcode.js'; // relativa a la página, igual que SheetJS
export function configurarQR(url) { urlQR = url; }

// Dibujos genéricos por categoría (cuando el equipo no tiene foto).
const dib = d => `<svg viewBox="0 0 120 160" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const TRIPODE = '<path d="M60 92L30 152M60 92l30 60M60 92v62"/><path d="M42 92h36"/>';
const DIBUJOS = {
  'Estación total': dib(`${TRIPODE}<rect x="42" y="34" width="36" height="52" rx="5"/><circle cx="60" cy="54" r="9"/><path d="M50 78h20"/><path d="M78 46h6v20h-6"/>`),
  'GNSS': dib('<ellipse cx="60" cy="26" rx="28" ry="10"/><path d="M32 26v8c0 6 13 10 28 10s28-4 28-10v-8"/><path d="M60 44v112"/><path d="M60 92h18v22H60"/>'),
  'Nivel': dib(`${TRIPODE}<rect x="26" y="60" width="68" height="20" rx="6"/><path d="M94 66h10v8H94M26 66h-8v8h8"/><path d="M48 80l-4 12h32l-4-12"/>`),
  'Dron (RPAS)': dib('<rect x="46" y="68" width="28" height="22" rx="6"/><path d="M46 72L22 56M74 72l24-16M46 86L22 102M74 86l24 16"/><ellipse cx="22" cy="54" rx="16" ry="4"/><ellipse cx="98" cy="54" rx="16" ry="4"/><ellipse cx="22" cy="104" rx="16" ry="4"/><ellipse cx="98" cy="104" rx="16" ry="4"/><circle cx="60" cy="96" r="5"/>'),
  'Escáner láser': dib(`${TRIPODE}<rect x="44" y="22" width="32" height="64" rx="10"/><circle cx="60" cy="50" r="8"/><path d="M48 40h24"/>`),
  'Otro': dib('<rect x="24" y="50" width="72" height="60" rx="6"/><path d="M48 50V38h24v12"/><path d="M24 74h72"/>'),
};
const dibujo = cat => DIBUJOS[cat] || DIBUJOS.Otro;

const SUBTABS = [
  { id: 'accesorios', texto: 'Accesorios' },
  { id: 'certificados', texto: 'Certificados' },
  { id: 'historial', texto: 'Historial' },
  { id: 'mantencion', texto: 'Mantención' },
  { id: 'notas', texto: 'Notas' },
  { id: 'documentos', texto: 'Documentos' },
  { id: 'admin', texto: 'Administración', soloRRHH: true },
];

const ROLES_DOC = { ficha_tecnica: 'Ficha técnica', manual: 'Manual', guia: 'Guía rápida', documento: 'Otro documento' };

export function crearFicha(ctx) {
  const { st, esc, proy, pers, avisar, ir, render, esRRHH } = ctx;
  const pesos = n => '$' + Math.round(n).toLocaleString('es-CL');

  // ─────────── Vista principal ───────────

  async function vistaFicha() {
    const est = await estadoDeEquipo(st.equipoId);
    if (!est) return '<p>El equipo no existe o está en la papelera.</p><button class="eq-btn" data-accion="ir" data-vista="lista">Volver</button>';
    const eq = est.equipo;
    const tab = SUBTABS.some(s => s.id === st.fichaTab && (!s.soloRRHH || esRRHH)) ? st.fichaTab : 'accesorios';
    const [modelo, certs, mants, notas, docsModelo, docsUnidad] = await Promise.all([
      obtenerModelo(eq), listarCertificados(eq.id), listarMantenciones(eq.id), listarNotas(eq.id),
      claveModelo(eq) ? archivosDe('modelo', claveModelo(eq)) : [], archivosDe('equipo-doc', eq.id),
    ]);
    const conteo = {
      accesorios: eq.accesorios.length, certificados: certs.length, mantencion: est.alertasActivas.length,
      notas: notas.filter(n => !n.archivada).length, documentos: docsModelo.length + docsUnidad.length,
    };
    const ctxTab = { est, eq, modelo, certs, mants, notas, docsModelo, docsUnidad };
    const cuerpoTab = await TABS[tab](ctxTab);
    return `
      <button class="eq-volver" data-accion="ir" data-vista="lista">← Equipos</button>
      ${await cabecera(est, modelo, certs)}
      ${est.alertasActivas.length ? `<button class="eq-banda-alerta" data-accion="ficha-tab" data-tab="mantencion">
        ⚠ ${est.alertasActivas.length === 1 ? esc(est.alertasActivas[0].descripcion) : `${est.alertasActivas.length} alertas activas`}
        <span>${ESTADOS_ALERTA[est.alertasActivas[0].estado]} · ver</span></button>` : ''}
      <nav class="eq-subtabs" role="tablist">${SUBTABS.filter(s => !s.soloRRHH || esRRHH).map(s =>
        `<button role="tab" class="eq-subtab${s.id === tab ? ' activa' : ''}${s.id === 'mantencion' && conteo.mantencion ? ' alerta' : ''}" data-accion="ficha-tab" data-tab="${s.id}">${s.texto}${conteo[s.id] ? ` <span>${conteo[s.id]}</span>` : ''}</button>`).join('')}</nav>
      <section class="eq-subpanel">${cuerpoTab}</section>`;
  }

  async function cabecera(est, modelo, certs) {
    const eq = est.equipo;
    const [urlFoto, urlPlaca] = await Promise.all([urlArchivo(eq.fotoId), urlArchivo(eq.placaId)]);
    const verPlaca = st.verPlaca && urlPlaca;
    const principal = verPlaca ? urlPlaca : urlFoto;
    const u = est.ubicacion;
    const vig = certs[0];

    // Especificaciones: guardadas en el modelo; si faltan, las deducidas de la descripción (con «?»).
    const deducidas = especificacionesDeDescripcion(eq.categoria, eq.descripcion);
    const guardadas = (modelo && modelo.specs) || {};
    const specs = camposEspecificacion(eq.categoria).map(c => {
      const v = guardadas[c.clave] || deducidas[c.clave];
      if (!v) return '';
      const calc = !guardadas[c.clave];
      // La unidad se agrega solo si el valor es un número («400» → «400 m»; «1 mm + 1.5 ppm» queda tal cual).
      const unidad = c.sufijo && /^[\d.,\s]+$/.test(String(v)) ? (c.sufijo === '"' ? '"' : ` <small>${esc(c.sufijo)}</small>`) : '';
      return `<div class="eq-spec"><dt>${c.etiqueta}</dt><dd>${esc(String(v).trim())}${unidad}${calc ? ' <span class="eq-calc" title="Deducido de la descripción; confírmalo en Especificaciones">?</span>' : ''}</dd></div>`;
    }).join('');

    const datos = [
      ['Marca', eq.marca], ['Modelo', eq.modelo], ['N° serie', eq.numeroSerie, true],
      ['Calibración', eq.calibracionNoAplica ? 'No aplica' : fechaLegible(eq.fechaUltimaCalibracion), true],
      ...(!eq.calibracionNoAplica && est.calibracion.proxima ? [['Próxima', fechaLegible(est.calibracion.proxima), true]] : []),
      ['Certificado', vig ? vig.codigo : '—'],
    ].map(([k, v, mono]) => `<div class="eq-spec"><dt>${k}</dt><dd${mono ? ' class="eq-mono"' : ''}>${esc(v || '—')}</dd></div>`).join('');

    const venc = (est.vencimientos || []).filter(v => v.nivel !== 'ok').map(v =>
      `<span class="eq-chip ${v.nivel === 'vencida' ? 'rojo' : 'ambar'}">${esc(v.nombre)} ${v.nivel === 'vencida' ? 'vencido' : `vence en ${v.dias} d`}</span>`).join(' ');

    return `<header class="eq-ficha">
      <div class="eq-ficha-foto">
        <div class="eq-foto-marco">${principal ? `<img src="${principal}" alt="Foto de ${esc(est.nombre)}">` : `<div class="eq-foto-dibujo">${dibujo(eq.categoria)}<small>Sin foto</small></div>`}</div>
        <div class="eq-foto-acciones">
          ${urlFoto && urlPlaca ? `<button class="eq-btn chico${!verPlaca ? ' activo' : ''}" data-accion="ver-foto" data-cual="foto">Equipo</button><button class="eq-btn chico${verPlaca ? ' activo' : ''}" data-accion="ver-foto" data-cual="placa">Placa</button>` : ''}
          <label class="eq-btn chico">📷 ${urlFoto ? 'Cambiar foto' : 'Foto'}<input type="file" accept="image/*" capture="environment" data-accion-cambio="subir-foto" data-rol="foto" hidden></label>
          <label class="eq-btn chico">🏷 ${urlPlaca ? 'Cambiar placa' : 'Foto placa'}<input type="file" accept="image/*" capture="environment" data-accion-cambio="subir-foto" data-rol="placa" hidden></label>
        </div>
      </div>
      <div class="eq-ficha-info">
        <div class="eq-cat">${esc(eq.categoria)}${eq.codigoInterno ? ' · ' + esc(eq.codigoInterno) : ''}</div>
        <h2>${esc(est.nombre)}</h2>
        ${eq.descripcion ? `<p class="eq-ficha-desc">${esc(eq.descripcion)}</p>` : ''}
        <div class="eq-chips">${ctx.chipUbicacion(u)} ${ctx.chipCalibracion(est.calibracion)} ${venc}</div>
        ${u.lugar === 'terreno' ? `<p class="eq-tenue" style="margin:6px 0 0">En ${esc(proy(u.proyectoId))} desde ${fechaLegible(u.desde)} · responsable ${esc(pers(u.personaId))}</p>` : ''}
        <dl class="eq-specs">${datos}</dl>
        <div class="eq-specs-cab"><span>Especificaciones técnicas${modelo ? '' : ''}</span>
          ${esRRHH && claveModelo(eq) ? '<button class="eq-enlace" data-accion="ir" data-vista="especificaciones">Editar</button>' : ''}</div>
        ${specs || (modelo && modelo.otras) ? `<dl class="eq-specs">${specs}</dl>${modelo && modelo.otras ? `<p class="eq-tenue eq-pre">${esc(modelo.otras)}</p>` : ''}`
          : `<p class="eq-tenue">Sin especificaciones${esRRHH ? '. Se escriben una vez por modelo y las comparten todas las unidades iguales.' : '.'}</p>`}
        <div class="eq-acciones">
          <button class="eq-btn chico" data-accion="reportar" data-id="${eq.id}">⚠ Reportar anomalía</button>
          ${esRRHH ? `<button class="eq-btn chico" data-accion="editar" data-id="${eq.id}">Editar</button>` : ''}
          <button class="eq-btn chico" data-accion="ir" data-vista="etiqueta">QR</button>
        </div>
      </div>
    </header>`;
  }

  // ─────────── Pestañas ───────────

  const TABS = {
    async accesorios({ eq }) {
      if (!eq.accesorios.length) return `<div class="eq-sub-vacio"><p>Sin accesorios registrados. La lista arma el checklist de salida y regreso.</p>
        ${esRRHH ? '<button class="eq-btn" data-accion="ir" data-vista="accesorios">Agregar accesorios</button>' : ''}</div>`;
      const filas = eq.accesorios.map(a => `<tr>
        <td>${esc(a.nombre)}</td><td class="eq-mono eq-centro">${a.cantidad || 1}</td><td class="eq-mono">${esc(a.serie || '—')}</td>
        <td><select class="eq-estado-acc ${a.estado}" data-accion-cambio="estado-accesorio" data-id="${a.id}">
          ${Object.entries(ESTADOS_ACCESORIO).map(([k, v]) => `<option value="${k}"${k === a.estado ? ' selected' : ''}>${v}</option>`).join('')}</select></td></tr>`).join('');
      const malos = eq.accesorios.filter(a => a.estado !== 'bueno').length;
      return `<div class="eq-sub-cab"><span class="eq-tenue">${eq.accesorios.length} accesorios${malos ? ` · <b class="eq-txt-ambar">${malos} por revisar</b>` : ''}</span>
          ${esRRHH ? '<button class="eq-btn chico" data-accion="ir" data-vista="accesorios">Editar lista</button>' : ''}</div>
        <div class="eq-tabla-scroll"><table class="eq-tabla-sub"><thead><tr><th>Accesorio</th><th>Cant.</th><th>N° serie</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table></div>
        <p class="eq-tenue">Lo que no vuelve en el checklist de regreso queda en «Falta».</p>`;
    },

    async certificados({ eq, certs }) {
      const filas = certs.map((c, i) => `<tr>
        <td>${c.archivoId
          ? `<button class="eq-enlace eq-mono" data-accion="abrir-archivo" data-id="${c.archivoId}" title="Abrir PDF">${esc(c.codigo)}</button>`
          : `<span class="eq-mono">${esc(c.codigo)}</span> <span class="eq-tenue">(sin PDF)</span>`}
          ${i === 0 ? ' <span class="eq-chip verde">Vigente</span>' : ''}</td>
        <td class="eq-mono">${fechaLegible(c.fecha)}</td>
        ${esRRHH ? `<td class="eq-fin">${!c.archivoId ? `<label class="eq-enlace">Adjuntar PDF<input type="file" accept="application/pdf,image/*" hidden data-accion-cambio="pdf-certificado" data-id="${c.id}"></label>` : ''}
          <button class="eq-x" data-accion="papelera-certificado" data-id="${c.id}" title="Enviar a la papelera">✕</button></td>` : ''}
      </tr>`).join('');
      return `<div class="eq-sub-cab"><span class="eq-tenue">Toca el código para abrir el PDF.</span>
          ${esRRHH ? '<button class="eq-btn chico primario" data-accion="ir" data-vista="certificado">+ Agregar certificado</button>' : ''}</div>
        ${certs.length ? `<div class="eq-tabla-scroll"><table class="eq-tabla-sub"><thead><tr><th>Código del certificado</th><th>Fecha mantención</th>${esRRHH ? '<th></th>' : ''}</tr></thead><tbody>${filas}</tbody></table></div>`
          : `<div class="eq-sub-vacio"><p>Aún no hay certificados${eq.calibracionNoAplica ? ' (este equipo no requiere calibración)' : ''}.</p></div>`}`;
    },

    async historial({ est }) {
      const periodos = periodosDeUso(est.eventos);
      const total = periodos.reduce((s, p) => s + p.dias, 0);
      const filas = periodos.map(p => `<tr><td>${esc(proy(p.proyectoId))}</td><td>${esc(pers(p.personaId))}</td>
        <td class="eq-mono">${fechaLegible(p.desde)}</td><td class="eq-mono">${p.hasta ? fechaLegible(p.hasta) : '<b>en uso</b>'}</td><td class="eq-mono eq-centro">${p.dias}</td></tr>`).join('');
      return `${periodos.length ? `<div class="eq-sub-cab"><span class="eq-tenue">${periodos.length} salida${periodos.length > 1 ? 's' : ''} · <b>${total} días en terreno</b></span></div>
        <div class="eq-tabla-scroll"><table class="eq-tabla-sub"><thead><tr><th>Proyecto</th><th>Responsable</th><th>Desde</th><th>Hasta</th><th>Días</th></tr></thead><tbody>${filas}</tbody></table></div>`
        : '<div class="eq-sub-vacio"><p>Este equipo aún no ha salido a terreno.</p></div>'}
        <details class="eq-detalles"><summary>Todos los movimientos (${est.eventos.length})</summary>
          <ul class="eq-historial">${[...est.eventos].reverse().map(ctx.describirEvento).join('')}</ul></details>`;
    },

    async mantencion({ est, eq, mants }) {
      const tarjeta = async a => {
        const usos = (await usosConAlerta(a.id, eq.id)).filter(u => u.tipo !== 'alerta');
        return `<div class="eq-alerta${a.estado === 'cerrada' ? ' cerrada' : ''}">
          <div class="eq-alerta-cab"><span>${fechaLegible(a.fechaReporte)} · ${esc(pers(a.reportadaPor))}</span><span class="eq-chip ${a.estado === 'cerrada' ? 'gris' : 'rojo'}">${ESTADOS_ALERTA[a.estado]}</span></div>
          <p>${esc(a.descripcion)}</p>
          ${usos.length ? `<div class="eq-txt-rojo">Usado ${usos.length} ${usos.length === 1 ? 'vez' : 'veces'} con la alerta abierta</div>` : ''}
          ${esRRHH && PASOS_ALERTA[a.estado].length ? `<div class="eq-acciones">${PASOS_ALERTA[a.estado].map(p => `<button class="eq-btn chico" data-accion="alerta-paso" data-id="${a.id}" data-estado="${p.estado}">${p.texto}</button>`).join('')}</div>` : ''}
        </div>`;
      };
      const activas = await Promise.all(est.alertasActivas.map(tarjeta));
      const cerradas = await Promise.all(est.alertas.filter(a => !alertaActiva(a)).map(tarjeta));
      const filas = mants.map(m => `<tr><td class="eq-mono">${fechaLegible(m.fecha)}</td><td>${esc(m.tipo)}</td><td>${esc(m.proveedor || '—')}</td>
        <td class="eq-mono">${esc(m.orden || '—')}</td>${esRRHH ? `<td class="eq-mono">${m.costo ? pesos(m.costo) : '—'}</td>` : ''}<td class="eq-detalle">${esc(m.descripcion || '')}</td>
        ${esRRHH ? `<td class="eq-fin"><button class="eq-x" data-accion="papelera-mantencion" data-id="${m.id}" title="Enviar a la papelera">✕</button></td>` : ''}</tr>`).join('');
      const costoTotal = mants.reduce((s, m) => s + (m.costo || 0), 0);
      return `${activas.length ? `<h3>Alertas activas</h3>${activas.join('')}` : '<p class="eq-tenue">Sin alertas activas.</p>'}
        <div class="eq-acciones"><button class="eq-btn chico" data-accion="reportar" data-id="${eq.id}">⚠ Reportar anomalía</button></div>
        <div class="eq-sub-cab" style="margin-top:14px"><h3 style="margin:0">Mantenciones${esRRHH && costoTotal ? ` <small class="eq-tenue">· total ${pesos(costoTotal)}</small>` : ''}</h3></div>
        ${mants.length ? `<div class="eq-tabla-scroll"><table class="eq-tabla-sub"><thead><tr><th>Fecha</th><th>Tipo</th><th>Proveedor</th><th>N° orden</th>${esRRHH ? '<th>Costo</th>' : ''}<th>Qué se hizo</th>${esRRHH ? '<th></th>' : ''}</tr></thead><tbody>${filas}</tbody></table></div>`
          : '<p class="eq-tenue">Sin mantenciones registradas.</p>'}
        ${esRRHH ? `<details class="eq-detalles"><summary>+ Registrar mantención</summary>
          <form class="eq-form eq-mini" data-form="mantencion">
            <div class="eq-fila2"><label class="eq-campo"><span>Fecha</span><input type="date" name="fecha" value="${hoyISO()}" required></label>
            <label class="eq-campo"><span>Tipo</span><select name="tipo">${TIPOS_MANTENCION.map(t => `<option>${t}</option>`).join('')}</select></label></div>
            <div class="eq-fila2"><label class="eq-campo"><span>Proveedor / servicio técnico</span><input name="proveedor"></label>
            <label class="eq-campo"><span>N° de orden</span><input name="orden"></label></div>
            <label class="eq-campo"><span>Costo ($)</span><input type="number" name="costo" min="0" step="1"></label>
            <label class="eq-campo"><span>Qué se hizo</span><textarea name="descripcion" rows="2"></textarea></label>
            ${est.alertasActivas.length ? `<label class="eq-campo"><span>Corresponde a la alerta</span><select name="alertaId"><option value="">— ninguna —</option>${est.alertasActivas.map(a => `<option value="${a.id}">${esc(a.descripcion.slice(0, 60))}</option>`).join('')}</select></label>` : ''}
            <div class="eq-acciones"><button class="eq-btn primario" type="submit">Guardar mantención</button></div>
          </form></details>` : ''}
        ${cerradas.length ? `<details class="eq-detalles"><summary>Alertas cerradas (${cerradas.length})</summary>${cerradas.join('')}</details>` : ''}`;
    },

    async notas({ notas }) {
      const yo = personaActiva();
      const item = n => `<li class="eq-nota${n.archivada ? ' archivada' : ''}"><div>${esc(n.texto)}</div>
        <div class="eq-nota-pie"><span>${esc(pers(n.creadoPor))} · ${fechaLegible(n.creadoEn)}</span>
        ${esRRHH || n.creadoPor === yo ? `<button class="eq-enlace" data-accion="archivar-nota" data-id="${n.id}" data-valor="${n.archivada ? '0' : '1'}">${n.archivada ? 'Reactivar' : 'Archivar'}</button>` : ''}</div></li>`;
      const activas = notas.filter(n => !n.archivada);
      const archivadas = notas.filter(n => n.archivada);
      return `<form class="eq-form eq-mini" data-form="nota">
          <label class="eq-campo"><span>Nota para el próximo que lo use</span><textarea name="texto" rows="2" required placeholder="Ej.: la batería 2 dura poco; el tornillo de la base está suelto."></textarea></label>
          <div class="eq-acciones"><button class="eq-btn chico relleno" type="submit">Agregar nota</button></div></form>
        ${activas.length ? `<ul class="eq-notas">${activas.map(item).join('')}</ul>` : '<p class="eq-tenue">Sin notas. Úsalas para detalles que no son una alerta.</p>'}
        ${archivadas.length ? `<details class="eq-detalles"><summary>Archivadas (${archivadas.length})</summary><ul class="eq-notas">${archivadas.map(item).join('')}</ul></details>` : ''}`;
    },

    async documentos({ eq, docsModelo, docsUnidad }) {
      const lista = docs => docs.length ? `<ul class="eq-docs">${docs.map(d => `<li>
          <button class="eq-enlace" data-accion="abrir-archivo" data-id="${d.id}">${esc(d.nombre)}</button>
          <span class="eq-tenue">${ROLES_DOC[d.rol] || ''} · ${tamanoLegible(d.tamano)}</span>
          ${esRRHH ? `<button class="eq-x" data-accion="papelera-archivo" data-id="${d.id}" title="Enviar a la papelera">✕</button>` : ''}</li>`).join('')}</ul>`
        : '<p class="eq-tenue">Sin documentos.</p>';
      const subir = nivel => esRRHH ? `<form class="eq-form eq-mini fila" data-form="documento" data-nivel="${nivel}">
          <select name="rol">${Object.entries(ROLES_DOC).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <label class="eq-archivo">Elegir PDF<input type="file" name="archivo" accept="application/pdf,image/*" required></label>
          <button class="eq-btn chico relleno" type="submit">Subir</button></form>` : '';
      const iguales = (await listarConEstado()).filter(x => claveModelo(x.equipo) === claveModelo(eq)).length;
      return `<h3>Del modelo ${esc([eq.marca, eq.modelo].filter(Boolean).join(' '))}${iguales > 1 ? ` <small class="eq-tenue">· compartido por ${iguales} unidades</small>` : ''}</h3>
        ${claveModelo(eq) ? lista(docsModelo) + subir('modelo') : '<p class="eq-tenue">Falta marca o modelo.</p>'}
        <h3 style="margin-top:16px">De esta unidad</h3>
        ${lista(docsUnidad)}${subir('unidad')}`;
    },

    async admin({ est, eq }) {
      const campos = CAMPOS_ADMIN.filter(c => !c.soloCategoria || c.soloCategoria === eq.categoria).map(c =>
        `<label class="eq-campo"><span>${c.etiqueta}</span><input type="${c.tipo || 'text'}" name="${c.clave}" value="${esc(eq.admin[c.clave] ?? '')}"${c.tipo === 'number' ? ' min="0" step="1"' : ''}></label>`).join('');
      const extra = Object.entries(eq.columnasExtra || {}).map(([k, v]) => `<div class="eq-spec"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
      return `<form class="eq-form eq-mini" data-form="admin"><div class="eq-grid-admin">${campos}</div>
          <div class="eq-acciones"><button class="eq-btn chico relleno" type="submit">Guardar datos administrativos</button></div></form>
        <dl class="eq-specs">
          <div class="eq-spec"><dt>Fecha de alta</dt><dd class="eq-mono">${fechaLegible(eq.fechaAlta)}</dd></div>
          <div class="eq-spec"><dt>Origen</dt><dd>${eq.origen === 'planilla' ? 'Planilla importada' : 'Ingreso manual'}</dd></div>
          <div class="eq-spec"><dt>Calibrar cada</dt><dd>${eq.periodoCalibracionMeses || PERIODO_CALIBRACION_MESES} meses</dd></div>
          ${extra}
        </dl>
        ${eq.observaciones ? `<p class="eq-tenue eq-pre">${esc(eq.observaciones)}</p>` : ''}
        <div class="eq-acciones eq-zona-peligro">
          <button class="eq-btn chico" data-accion="baja" data-id="${eq.id}" data-valor="${eq.deBaja ? '0' : '1'}">${eq.deBaja ? 'Reactivar equipo' : 'Dar de baja'}</button>
          <button class="eq-btn chico peligro" data-accion="papelera-equipo" data-id="${eq.id}">Enviar a la papelera</button>
        </div>`;
    },
  };

  // ─────────── Vistas secundarias ───────────

  const VISTAS = {
    ficha: vistaFicha,

    async especificaciones() {
      const est = await estadoDeEquipo(st.equipoId);
      const eq = est.equipo;
      const modelo = await obtenerModelo(eq);
      const guardadas = (modelo && modelo.specs) || {};
      const deducidas = especificacionesDeDescripcion(eq.categoria, eq.descripcion);
      const iguales = (await listarConEstado()).filter(x => claveModelo(x.equipo) === claveModelo(eq)).length;
      const campos = camposEspecificacion(eq.categoria).map(c => {
        const v = guardadas[c.clave] ?? deducidas[c.clave] ?? '';
        const control = c.opciones
          ? `<select name="${c.clave}"><option value=""></option>${c.opciones.map(o => `<option${o === v ? ' selected' : ''}>${o}</option>`).join('')}</select>`
          : `<input name="${c.clave}" value="${esc(v)}">`;
        return `<label class="eq-campo"><span>${c.etiqueta}${c.sufijo ? ` (${esc(c.sufijo)})` : ''}${!guardadas[c.clave] && deducidas[c.clave] ? ' · <i>deducido de la descripción</i>' : ''}</span>${control}</label>`;
      }).join('');
      return `<button class="eq-volver" data-accion="ver" data-id="${eq.id}">← ${esc(est.nombre)}</button>
        <form class="eq-form" data-form="especificaciones"><fieldset><legend>Especificaciones · ${esc([eq.marca, eq.modelo].join(' '))}</legend>
          <p class="eq-tenue">Se guardan por modelo: ${iguales > 1 ? `las ${iguales} unidades ${esc(eq.marca)} ${esc(eq.modelo)} las comparten.` : 'si llega otra unidad igual, las tendrá también.'}</p>
          ${campos}
          <label class="eq-campo"><span>Otras especificaciones</span><textarea name="otras" rows="3">${esc((modelo && modelo.otras) || '')}</textarea></label>
        </fieldset><div class="eq-acciones"><button class="eq-btn primario" type="submit">Guardar especificaciones</button></div></form>`;
    },

    async accesorios() {
      const est = await estadoDeEquipo(st.equipoId);
      const eq = est.equipo;
      return `<button class="eq-volver" data-accion="ver" data-id="${eq.id}">← ${esc(est.nombre)}</button>
        <form class="eq-form" data-form="accesorios"><fieldset><legend>Accesorios</legend>
          <p class="eq-tenue">Lo que sale en la caja con el equipo. Arma el checklist de salida y regreso.</p>
          <div class="eq-acc-cab"><span>Accesorio</span><span>Cant.</span><span>N° serie</span><span></span></div>
          <div class="eq-acc-filas">${eq.accesorios.map(filaAccesorio).join('')}</div>
          <div class="eq-acciones"><button type="button" class="eq-btn chico" data-accion="acc-agregar">+ Agregar</button>
            <button type="button" class="eq-btn chico" data-accion="acc-sugerir" data-categoria="${esc(eq.categoria)}">Sugerir según categoría</button></div>
        </fieldset><div class="eq-acciones"><button class="eq-btn primario" type="submit">Guardar accesorios</button></div></form>`;
    },

    async certificado() {
      const est = await estadoDeEquipo(st.equipoId);
      const eq = est.equipo;
      return `<button class="eq-volver" data-accion="ver" data-id="${eq.id}">← ${esc(est.nombre)}</button>
        <form class="eq-form" data-form="certificado"><fieldset><legend>Agregar certificado</legend>
          <label class="eq-campo"><span>Código del certificado</span><input name="codigo" required placeholder="Ej.: CC-2025-1143"></label>
          <label class="eq-campo"><span>Fecha de mantención</span><input type="date" name="fecha" value="${hoyISO()}" required></label>
          <label class="eq-campo"><span>Laboratorio / servicio técnico (opcional)</span><input name="laboratorio" value="${esc(eq.laboratorio || '')}"></label>
          <label class="eq-campo"><span>PDF del certificado</span><input type="file" name="archivo" accept="application/pdf,image/*"></label>
          ${eq.calibracionNoAplica ? '' : '<label class="eq-comp"><input type="checkbox" name="actualizarFecha" checked> Actualizar la FECHA CALIBRACIÓN del equipo</label>'}
        </fieldset><div class="eq-acciones"><button class="eq-btn primario" type="submit">Guardar certificado</button></div></form>`;
    },

    async etiqueta() {
      const est = await estadoDeEquipo(st.equipoId);
      const eq = est.equipo;
      const enlace = ctx.enlaceEquipo(eq.id);
      const svgQR = await qrSVG(enlace);
      return `<button class="eq-volver" data-accion="ver" data-id="${eq.id}">← ${esc(est.nombre)}</button>
        <div class="eq-intro"><h2>Etiqueta QR</h2>
          <p class="eq-tenue">Imprímela y pégala en la caja. Al escanearla con el teléfono se abre esta ficha${/^https?:/.test(enlace) ? '' : '. <b>Para que el QR funcione desde otro teléfono, genera la etiqueta desde la versión publicada en GitHub Pages</b> (abierta desde el PC, el enlace apunta a un archivo local)'}.</p></div>
        <div class="eq-etiqueta" id="eq-etiqueta">
          <div class="eq-etq-qr">${svgQR}</div>
          <div class="eq-etq-txt"><b>${esc(est.nombre)}</b><span>N° serie ${esc(eq.numeroSerie || '—')}</span>${eq.codigoInterno ? `<span>${esc(eq.codigoInterno)}</span>` : ''}<small>Topoland</small></div>
        </div>
        <div class="eq-acciones bloque"><button class="eq-btn relleno" data-accion="imprimir-etiqueta">Imprimir etiqueta</button></div>`;
    },

    async 'cert-proyecto'() {
      const proyectos = await listarProyectos({ incluirOficina: false });
      const pid = st.certProyectoId || '';
      let tabla = '';
      if (pid) {
        const eqs = (await listarConEstado()).filter(e => e.ubicacion.proyectoId === pid && e.ubicacion.lugar === 'terreno');
        const filas = await Promise.all(eqs.map(async e => {
          const c = (await listarCertificados(e.equipo.id))[0];
          return `<tr><td><button class="eq-enlace" data-accion="ver" data-id="${e.equipo.id}">${esc(e.nombre)}</button></td><td class="eq-mono">${esc(e.equipo.numeroSerie)}</td>
            <td>${c ? (c.archivoId ? `<button class="eq-enlace eq-mono" data-accion="abrir-archivo" data-id="${c.archivoId}">${esc(c.codigo)}</button>` : `<span class="eq-mono">${esc(c.codigo)}</span> <span class="eq-tenue">(sin PDF)</span>`)
              : (e.equipo.calibracionNoAplica ? '<span class="eq-tenue">No requiere</span>' : '<span class="eq-txt-rojo">Sin certificado</span>')}</td>
            <td class="eq-mono">${c ? fechaLegible(c.fecha) : '—'}</td></tr>`;
        }));
        tabla = eqs.length ? `<div class="eq-tabla-scroll"><table class="eq-tabla-sub"><thead><tr><th>Equipo</th><th>N° serie</th><th>Código del certificado</th><th>Fecha mantención</th></tr></thead><tbody>${filas.join('')}</tbody></table></div>
          <p class="eq-tenue">Toca cada código para abrir su PDF.</p>`
          : '<p class="eq-tenue">No hay equipos asignados hoy a este proyecto.</p>';
      }
      return `<button class="eq-volver" data-accion="ir" data-vista="${esRRHH ? 'admin' : 'lista'}">← Volver</button>
        <div class="eq-intro"><h2>Certificados por proyecto</h2>
          <p class="eq-tenue">Los equipos que están hoy en el proyecto, con su certificado vigente. Para presentar al mandante o a la inspección.</p>
          <label class="eq-campo"><span>Proyecto</span><select data-accion-cambio="cert-proyecto"><option value="">Elige proyecto…</option>
            ${proyectos.map(p => `<option value="${p.id}"${p.id === pid ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label></div>
        ${tabla}`;
    },
  };

  function filaAccesorio(a = { id: '', nombre: '', cantidad: 1, serie: '', estado: 'bueno' }) {
    return `<div class="eq-acc-fila" data-id="${esc(a.id)}" data-estado="${esc(a.estado || 'bueno')}">
      <input name="acc-nombre" value="${esc(a.nombre)}" placeholder="Batería, radio, bastón…">
      <input name="acc-cantidad" type="number" min="1" value="${a.cantidad || 1}">
      <input name="acc-serie" value="${esc(a.serie || '')}" placeholder="opcional">
      <button type="button" class="eq-x" data-accion="acc-quitar" title="Quitar">✕</button></div>`;
  }

  async function qrSVG(texto) {
    try {
      if (!globalThis.qrcode) await cargarScript(urlQR);
      const q = globalThis.qrcode(0, 'M');
      q.addData(texto);
      q.make();
      return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch (e) {
      console.warn(e);
      return '<div class="eq-tenue">No se pudo generar el QR (falta vendor/qrcode.js).</div>';
    }
  }

  function imprimirEtiqueta() {
    const html = document.getElementById('eq-etiqueta')?.outerHTML;
    if (!html) return;
    const w = window.open('', '_blank');
    if (!w) { avisar('El navegador bloqueó la ventana de impresión', 'error'); return; }
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Etiqueta</title><style>
      body{margin:0;padding:10mm;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}
      .eq-etiqueta{display:flex;gap:4mm;align-items:center;width:70mm;padding:3mm;border:0.3mm solid #000;border-radius:2mm}
      .eq-etq-qr svg{width:26mm;height:26mm;display:block}
      .eq-etq-txt{display:flex;flex-direction:column;gap:1mm;font-size:8pt;line-height:1.2}
      .eq-etq-txt b{font-size:9.5pt}.eq-etq-txt small{color:#555;font-size:7pt}
      </style></head><body>${html}<script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  }

  // ─────────── Eventos ───────────

  /** Devuelve true si atendió el clic. */
  async function clic(accion, el) {
    switch (accion) {
      case 'ficha-tab': st.fichaTab = el.dataset.tab; await render(); return true;
      case 'ver-foto': st.verPlaca = el.dataset.cual === 'placa'; await render(); return true;
      case 'abrir-archivo': await abrirArchivo(el.dataset.id); return true;
      case 'papelera-archivo':
        if (!confirm('¿Enviar este documento a la papelera?')) return true;
        await archivoAPapelera(el.dataset.id, { personaId: personaActiva() }); avisar('Documento enviado a la papelera'); await render(); return true;
      case 'papelera-certificado':
        if (!confirm('¿Enviar este certificado a la papelera?')) return true;
        await papeleraCertificado(el.dataset.id); avisar('Certificado enviado a la papelera'); await render(); return true;
      case 'papelera-mantencion':
        if (!confirm('¿Enviar esta mantención a la papelera?')) return true;
        await papeleraMantencion(el.dataset.id); await render(); return true;
      case 'archivar-nota': await archivarNota(el.dataset.id, el.dataset.valor === '1'); await render(); return true;
      case 'acc-agregar': {
        const cont = el.closest('form').querySelector('.eq-acc-filas');
        cont.insertAdjacentHTML('beforeend', filaAccesorio());
        cont.lastElementChild.querySelector('input').focus();
        return true;
      }
      case 'acc-quitar': el.closest('.eq-acc-fila').remove(); return true;
      case 'acc-sugerir': {
        const cont = el.closest('form').querySelector('.eq-acc-filas');
        const actuales = [...cont.querySelectorAll('input[name="acc-nombre"]')].map(i => i.value.trim().toLowerCase());
        for (const n of COMPONENTES_SUGERIDOS[el.dataset.categoria] || []) {
          if (!actuales.includes(n.toLowerCase())) cont.insertAdjacentHTML('beforeend', filaAccesorio({ id: '', nombre: n, cantidad: 1, serie: '', estado: 'bueno' }));
        }
        return true;
      }
      case 'imprimir-etiqueta': imprimirEtiqueta(); return true;
    }
    return false;
  }

  async function cambio(el) {
    switch (el.dataset.accionCambio) {
      case 'subir-foto':
        if (!el.files[0]) return true;
        avisar('Guardando foto…');
        await fijarFoto(st.equipoId, el.dataset.rol, el.files[0]);
        st.verPlaca = el.dataset.rol === 'placa';
        avisar(el.dataset.rol === 'placa' ? 'Foto de la placa guardada' : 'Foto guardada');
        await render(); return true;
      case 'estado-accesorio':
        await cambiarEstadoAccesorio(st.equipoId, el.dataset.id, el.value);
        el.className = `eq-estado-acc ${el.value}`;
        avisar('Estado del accesorio actualizado'); return true;
      case 'pdf-certificado':
        if (!el.files[0]) return true;
        await adjuntarPdfCertificado(el.dataset.id, el.files[0]); avisar('PDF adjuntado'); await render(); return true;
      case 'cert-proyecto': st.certProyectoId = el.value; await render(); return true;
    }
    return false;
  }

  async function enviar(form, fd) {
    const eqId = st.equipoId;
    switch (form.dataset.form) {
      case 'especificaciones': {
        const est = await estadoDeEquipo(eqId);
        const specs = {};
        for (const c of camposEspecificacion(est.equipo.categoria)) if (fd[c.clave]) specs[c.clave] = String(fd[c.clave]).trim();
        await guardarEspecificaciones(est.equipo, specs, (fd.otras || '').trim());
        avisar('Especificaciones guardadas'); await ir('ficha'); return true;
      }
      case 'accesorios': {
        const lista = [...form.querySelectorAll('.eq-acc-fila')].map(f => ({
          id: f.dataset.id, estado: f.dataset.estado,
          nombre: f.querySelector('[name="acc-nombre"]').value, cantidad: f.querySelector('[name="acc-cantidad"]').value,
          serie: f.querySelector('[name="acc-serie"]').value,
        }));
        await guardarAccesorios(eqId, lista);
        avisar('Accesorios guardados'); await ir('ficha', { fichaTab: 'accesorios' }); return true;
      }
      case 'certificado': {
        const archivo = fd.archivo && fd.archivo.size ? fd.archivo : null;
        await agregarCertificado(eqId, { codigo: fd.codigo, fecha: fd.fecha, laboratorio: fd.laboratorio || '', archivo, actualizarFecha: fd.actualizarFecha === 'on' });
        avisar('Certificado guardado'); await ir('ficha', { fichaTab: 'certificados' }); return true;
      }
      case 'mantencion':
        await agregarMantencion(eqId, fd); avisar('Mantención registrada'); await render(); return true;
      case 'nota':
        await agregarNota(eqId, fd.texto); avisar('Nota agregada'); await render(); return true;
      case 'documento': {
        if (!fd.archivo || !fd.archivo.size) { avisar('Elige un archivo', 'error'); return true; }
        const est = await estadoDeEquipo(eqId);
        avisar('Subiendo…');
        await subirDocumento(est.equipo, { nivel: form.dataset.nivel, rol: fd.rol, archivo: fd.archivo });
        avisar('Documento guardado'); await render(); return true;
      }
      case 'admin': {
        const admin = {};
        for (const c of CAMPOS_ADMIN) if (c.clave in fd) admin[c.clave] = c.tipo === 'number' ? (fd[c.clave] === '' ? '' : Number(fd[c.clave])) : String(fd[c.clave]).trim();
        await guardarAdmin(eqId, admin); avisar('Datos administrativos guardados'); await render(); return true;
      }
    }
    return false;
  }

  return { VISTAS, clic, cambio, enviar };
}
