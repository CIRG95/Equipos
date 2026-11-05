// modulos/monografias/pdf.js — PDF de la monografía con el código de Terreno (pieza-terreno.js).
// Antes de armarlo, las imágenes guardadas como { archivo: id } se convierten en URL del archivo.

import { cargarScript } from '../../compartido/util.js';
import { urlArchivo } from '../../compartido/archivos.js';
import { configurarPieza, prepararImagenesMonografia, construirMonografiaPdf, ordenNatural } from './pieza-terreno.js';
import { IMAGENES } from './datos.js';

const CLAVE_LOGO = 'mono_logo_empresa';
export function logoEmpresa() { try { return localStorage.getItem(CLAVE_LOGO) || null; } catch { return null; } }
export function fijarLogoEmpresa(dataURL) { try { dataURL ? localStorage.setItem(CLAVE_LOGO, dataURL) : localStorage.removeItem(CLAVE_LOGO); } catch { /* sin almacenamiento */ } }

/** URL que se puede mostrar (img src) de una imagen de monografía: dataURL o { archivo }. */
export async function urlImagen(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (v.archivo) return urlArchivo(v.archivo);
  return null;
}

/** Copia de la monografía con las imágenes como URL (lo que espera el código de Terreno). */
export async function materializar(m) {
  const c = { ...m, modulos: { ...(m.modulos || {}) } };
  for (const k of IMAGENES) c[k] = await urlImagen(m[k]);
  c.fotosExtra = [];
  for (const f of (m.fotosExtra || [])) c.fotosExtra.push({ ...f, img: await urlImagen(f.img) });
  // v0.11: la Observación va en el recuadro de texto, después de la descripción («Observación: …»).
  const obs = String(m.observacionPdf || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (c.modulos.observacion && obs.length) {
    const desc = c.modulos.descripcion ? String(c.descripcion || '') : '';
    c.descripcion = [desc, `Observación: ${obs[0]}`, ...obs.slice(1)].filter(Boolean).join('\n');
    c.modulos.descripcion = true;
  }
  return c;
}

async function jsPDFListo() { if (!(window.jspdf && window.jspdf.jsPDF)) await cargarScript('vendor/jspdf.umd.min.js'); }

/** PDF (Blob) de una o varias monografías, en el orden dado. */
export async function pdfDe(lista, { alAvanzar } = {}) {
  await jsPDFListo();
  configurarPieza({ logoEmpresa: logoEmpresa() });
  let doc = null, i = 0;
  for (const m0 of lista) {
    alAvanzar && alAvanzar(++i, lista.length);
    const m = await materializar(m0);
    doc = construirMonografiaPdf(m, await prepararImagenesMonografia(m), doc);
  }
  return doc ? doc.output('blob') : null;
}
export { ordenNatural };
