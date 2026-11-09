// modulos/monografias/pantallas.js — pantallas de Monografías (PC): proyectos → monografías del proyecto.
// v0.12: cada ficha se trabaja en el paso a paso (pasos.js): datos comunes, coordenadas y croquis, ubicación y descripción,
// revisar y PDF. Aquí queda la lista del proyecto con su estado, el botón Eliminar y la papelera de monografías.

import { escapar as esc, descargar, fechaLegible, fechaHoraLegible, leerLS } from '../../compartido/util.js';
import { listarProyectos, obtenerProyecto, OFICINA_ID } from '../../compartido/catalogos.js';
import * as D from './datos.js';
import { configurarPieza, chequeoMonografia } from './pieza-terreno.js';
import { pdfDe, ordenNatural } from './pdf.js';
import { montarPasos } from './pasos.js';
import { eliminarMonografia, restaurarMonografia, purgarMonografia, papeleraDeProyecto } from './borrado.js';
import { chequeoFicha, cuenta, normalizarComun, efectiva } from './comun.js';

const nombreArchivo = s => String(s || 'punto').replace(/[^a-z0-9_-]+/gi, '_');

export function montarPantallas(raiz, ctx) {
  if (ctx.proyectoId && ctx.monografiaId) return montarPasos(raiz, ctx);
  const st = { proyectoId: ctx.proyectoId || null, lista: [], mensaje: null, filtro: '', vivo: true };
  raiz.innerHTML = '<div class="mn"></div>';
  const cont = raiz.querySelector('.mn');
  const avisar = (texto, tipo = 'ok') => { st.mensaje = { texto, tipo }; };

  async function vistaProyectos() {
    const proys = (await listarProyectos()).filter(p => p.id !== OFICINA_ID && p.estado !== 'cerrado');
    const filas = await Promise.all(proys.map(async p => ({ p, r: await D.resumenDeProyecto(p.id) })));
    filas.sort((a, b) => b.r.total - a.r.total || a.p.nombre.localeCompare(b.p.nombre, 'es'));
    return `<div class="mn-cab"><h1>Monografías</h1><p class="sis-tenue">Por proyecto: lo que llega desde la app de Terreno (monografías, jornadas y fotos), las fichas hechas en gabinete paso a paso, la revisión y el PDF.</p></div>
      <section class="sis-tarjeta"><div class="sis-lista">${filas.map(({ p, r }) => `<a class="sis-fila" href="#/monografias/${esc(p.id)}">
          <span class="sis-fila-txt"><b>${esc(p.nombre)}</b><span class="sis-tenue">${esc(p.mandante || '')}${r.jornadas.length ? ` · ${r.jornadas.length} jornada${r.jornadas.length > 1 ? 's' : ''} de terreno` : ''}</span></span>
          <span class="sis-chips">${r.total ? Object.entries(r.porEstado).map(([e, n]) => `<span class="sis-chip ${D.ESTADOS[e].color}">${n} ${esc(D.ESTADOS[e].texto.toLowerCase())}</span>`).join('') : '<span class="sis-chip gris">sin monografías</span>'}</span></a>`).join('') || '<div class="sis-vacio"><p>No hay proyectos activos.</p></div>'}</div></section>`;
  }

  async function vistaProyecto() {
    const p = await obtenerProyecto(st.proyectoId);
    if (!p) return '<section class="sis-tarjeta sis-vacio"><p>No se encontró el proyecto.</p></section>';
    st.proyecto = p;
    st.lista = (await D.monografiasDeProyecto(st.proyectoId)).sort((a, b) => ordenNatural(a.ficha, b.ficha));
    configurarPieza({ monografias: st.lista.map(x => x.ficha) });
    const [jornadas, fotos, papelera] = await Promise.all([D.jornadasDeProyecto(st.proyectoId), D.fotosDeProyecto(st.proyectoId), papeleraDeProyecto(st.proyectoId)]);
    const comun = normalizarComun(leerLS(`mono_comun_${st.proyectoId}`, {}));
    const lista = st.lista.filter(x => !st.filtro || x.estado === st.filtro);
    const cuentaE = e => st.lista.filter(x => x.estado === e).length;
    const base = `#/monografias/${esc(st.proyectoId)}`;
    return `<a class="sis-volver" href="#/monografias">← Monografías</a>
      <div class="mn-cab"><h1>${esc(p.nombre)}</h1><p class="sis-tenue">${esc(p.mandante || '')} · ${st.lista.length} ficha${st.lista.length === 1 ? '' : 's'} · ${jornadas.length} jornada${jornadas.length === 1 ? '' : 's'} y ${fotos.length} foto${fotos.length === 1 ? '' : 's'} desde Terreno</p></div>
      <section class="sis-tarjeta mn-entrada"><div><h2>Paso a paso</h2>
          <ol class="mn-entrada-pasos"><li><b>Datos comunes</b><span>cliente, medición, responsables y qué lleva el PDF; se escriben una vez</span></li><li><b>Coordenadas y croquis</b><span>de cada ficha</span></li><li><b>Ubicación y descripción</b><span>de cada ficha</span></li><li><b>Revisar</b><span>todas y generar el PDF</span></li></ol></div>
        <div class="sis-acciones"><a class="sis-btn primario" href="${base}/comun">${st.lista.length ? 'Abrir el paso a paso' : 'Empezar: datos comunes'}</a>${st.lista.length ? `<a class="sis-btn" href="${base}/revisar">Revisar y PDF</a>` : ''}</div></section>
      ${st.lista.length ? `<div class="mn-barra">
        <div class="mn-filtros">${[['', `Todas · ${st.lista.length}`], ...Object.keys(D.ESTADOS).filter(cuentaE).map(e => [e, `${D.ESTADOS[e].texto} · ${cuentaE(e)}`])].map(([e, t]) => `<button type="button" class="vu-pildora${st.filtro === e ? ' activo' : ''}" data-mn="filtro" data-e="${e}">${esc(t)}</button>`).join('')}</div>
        <div class="sis-acciones"><button class="sis-btn primario" data-mn="pdf-todas" ${lista.length ? '' : 'disabled'}>PDF de ${st.filtro ? 'estas' : 'todas'} (${lista.length})</button></div>
      </div>` : ''}
      <section class="sis-tarjeta">${lista.length ? `<table class="mn-tabla"><thead><tr><th>Punto</th><th>Estado</th><th>Avance</th><th>Medición</th><th>Operador</th><th></th></tr></thead><tbody>
        ${lista.map(x => { const f = x.ficha, k = cuenta(chequeoFicha(f, chequeoMonografia(efectiva(f)), comun)); return `<tr>
          <td><a href="${base}/${esc(x.id)}"><b>${esc(f.puntoMedido || '(sin punto)')}</b></a>${x.nuevaDeTerreno ? '<small class="mn-nueva">Terreno envió cambios</small>' : ''}</td>
          <td><span class="sis-chip ${D.ESTADOS[x.estado].color}">${esc(D.ESTADOS[x.estado].texto)}</span>${x.observacion ? `<small class="mn-obs">${esc(x.observacion)}</small>` : ''}</td>
          <td><span class="sis-chip ${k.ok === k.total ? 'verde' : 'ambar'}">${k.ok} de ${k.total}</span></td>
          <td>${f.fechaMedicion ? esc(fechaLegible(f.fechaMedicion)) : '—'}</td><td>${esc(f.operadorNombre || '—')}</td>
          <td class="mn-acc"><a class="sis-btn chico" href="${base}/${esc(x.id)}">Abrir</a><button class="sis-btn chico" data-mn="pdf" data-id="${esc(x.id)}">PDF</button><button class="sis-btn chico peligro" data-mn="eliminar" data-id="${esc(x.id)}" data-nombre="${esc(f.puntoMedido || '(sin punto)')}">Eliminar</button></td></tr>`; }).join('')}
        </tbody></table>` : `<div class="sis-vacio"><p>${st.lista.length ? 'Ninguna con ese estado.' : 'Aún no hay fichas en este proyecto. Llegan desde la app de Terreno («Enviar al Sistema») o se crean aquí con el paso a paso.'}</p></div>`}</section>
      ${jornadas.length ? `<section class="sis-tarjeta"><h2>Jornadas de terreno</h2><div class="sis-lista">${jornadas.slice(0, 12).map(j => `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(j.fechaInicio ? fechaHoraLegible(j.fechaInicio) : 'Jornada')}</b><span class="sis-tenue">${esc(j.operador || '')}${j.horas != null ? ` · ${Number(j.horas).toLocaleString('es-CL', { maximumFractionDigits: 1 })} h` : ''}</span></span>
          <span class="sis-chips"><span class="sis-chip gris">${(j.levantamientos || []).length} levantamiento${(j.levantamientos || []).length === 1 ? '' : 's'}</span><span class="sis-chip gris">${(j.levantamientos || []).reduce((s, l) => s + (l.puntos || []).length, 0)} puntos</span></span></div>`).join('')}</div></section>` : ''}
      ${papelera.length ? `<details class="sis-tarjeta mn-papelera"><summary><b>Papelera · ${papelera.length}</b> <span class="sis-tenue">${papelera.length === 1 ? 'ficha eliminada' : 'fichas eliminadas'} de este proyecto</span></summary>
        <div class="sis-lista">${papelera.map(r => `<div class="sis-fila"><span class="sis-fila-txt"><b>${esc(r.ficha.puntoMedido || '(sin punto)')}</b><span class="sis-tenue">Eliminada el ${esc(fechaHoraLegible(r.eliminadoEn))}</span></span>
          <span class="sis-acciones"><button class="sis-btn chico" data-mn="restaurar" data-id="${esc(r.id)}">Restaurar</button><button class="sis-btn chico peligro" data-mn="purgar" data-id="${esc(r.id)}" data-nombre="${esc(r.ficha.puntoMedido || '(sin punto)')}">Eliminar definitivamente</button></span></div>`).join('')}</div>
        <div class="sis-acciones"><button class="sis-btn chico peligro" data-mn="vaciar">Vaciar la papelera</button></div></details>` : ''}`;
  }

  async function render() {
    if (!st.vivo) return;
    try {
      const html = st.proyectoId ? await vistaProyecto() : await vistaProyectos();
      cont.innerHTML = `${st.mensaje ? `<div class="vu-msg ${st.mensaje.tipo === 'error' ? 'error' : ''}" role="status">${esc(st.mensaje.texto)}</div>` : ''}${html}`;
      st.mensaje = null;
    } catch (e) { console.error(e); cont.innerHTML = `<section class="sis-tarjeta sis-error"><p>${esc(e.message || 'Error')}</p></section>`; }
  }

  async function descargarPdf(lista, nombre) {
    avisar('Generando PDF…'); await render();
    const blob = await pdfDe(lista);
    if (blob) { descargar(nombre, blob, 'application/pdf'); avisar(`PDF listo: ${lista.length} monografía${lista.length === 1 ? '' : 's'}.`); }
  }

  cont.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-mn]');
    if (!b) return;
    const a = b.dataset.mn;
    try {
      if (a === 'filtro') st.filtro = b.dataset.e;
      else if (a === 'pdf') { const x = st.lista.find(y => y.id === b.dataset.id); await descargarPdf([x.ficha], `monografia_${nombreArchivo(x.ficha.puntoMedido)}.pdf`); }
      else if (a === 'pdf-todas') {
        const lista = st.lista.filter(x => !st.filtro || x.estado === st.filtro).map(x => x.ficha);
        await descargarPdf(lista, `monografias_${nombreArchivo(st.proyecto ? st.proyecto.nombre : 'proyecto')}_${new Date().toISOString().slice(0, 10)}.pdf`);
      }
      else if (a === 'eliminar') {
        if (!confirm(`¿Eliminar la ficha «${b.dataset.nombre}»?\n\nVa a la papelera del proyecto y se puede restaurar.`)) return;
        await eliminarMonografia(b.dataset.id, ctx.personaId); avisar(`«${b.dataset.nombre}» quedó en la papelera.`);
      }
      else if (a === 'restaurar') { await restaurarMonografia(b.dataset.id, ctx.personaId); avisar('Ficha restaurada.'); }
      else if (a === 'purgar') {
        if (!confirm(`¿Eliminar definitivamente «${b.dataset.nombre}»?\n\nSe borra con su croquis y fotos y no se puede deshacer.`)) return;
        await purgarMonografia(b.dataset.id, ctx.personaId); avisar('Ficha eliminada definitivamente.');
      }
      else if (a === 'vaciar') {
        const l = await papeleraDeProyecto(st.proyectoId);
        if (!confirm(`¿Eliminar definitivamente las ${l.length} fichas de la papelera?\n\nNo se puede deshacer.`)) return;
        for (const r of l) await purgarMonografia(r.id, ctx.personaId);
        avisar('Papelera vacía.');
      }
      else return;
    } catch (e) { console.error(e); avisar(e.message || 'No se pudo', 'error'); }
    await render();
  });

  render();
  return { desmontar() { st.vivo = false; }, refrescar: render };
}
