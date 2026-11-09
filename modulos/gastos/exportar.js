// modulos/gastos/exportar.js — salidas de una rendición: Excel (SheetJS) y PDF con las boletas como anexo (jsPDF).
// Ambas librerías ya están en vendor/ y en el caché del service worker (funcionan sin conexión).

import { cargarScript, fechaLegible, descargar } from '../../compartido/util.js';
import { clp as clpTexto, porCategoria, ESTADOS } from './modelo.js';
import { datosBoleta } from './datos.js';

// En el PDF el signo menos tipográfico no existe en la fuente estándar: se usa el guion.
const clp = n => clpTexto(n).replace('−', '-');
const limpiar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
export const nombreArchivo = (d, ext) => `Rendicion_${d.numero}_${limpiar(d.persona)}_${limpiar(d.proyecto)}.${ext}`;

/** Fecha aaaa-mm-dd → número de serie de Excel (para que se ordene y filtre como fecha). */
function serieExcel(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return (Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
}

/**
 * d: { numero, persona, proyecto, estado, envio, gastos: [...], fila: { fondo, anterior, depositos, gastado, saldo, pagado, reintegro } }
 */
export async function descargarExcel(d) {
  if (!globalThis.XLSX) await cargarScript('vendor/xlsx.full.min.js');
  const XLSX = globalThis.XLSX;
  const f = d.fila;
  const cab = [
    [`Rendición de gastos N° ${d.numero}`],
    ['Persona', d.persona], ['Proyecto', d.proyecto], ['Estado', ESTADOS[d.estado].texto], ['Enviada', d.envio ? fechaLegible(d.envio) : '—'],
    [],
    ['Fondo recibido', f.fondo], ['Gastado', f.gastado], [f.saldo < 0 ? 'Saldo a favor de la persona' : 'Saldo a favor de la empresa', Math.abs(f.saldo)],
    [],
  ];
  const enc = ['N°', 'Fecha', 'Comercio', 'Categoría', 'Monto (CLP)', 'Boleta', 'Nota'];
  const filas = d.gastos.map((g, i) => [i + 1, serieExcel(g.fecha), g.comercio || '', g.categoria, Number(g.monto) || 0,
    g.sinBoleta ? `Sin boleta: ${g.motivoSinBoleta || ''}` : 'Sí (ver PDF)', g.nota || '']);
  const total = ['', '', '', 'Total', f.gastado, '', ''];
  const aoa = [...cab, enc, ...filas, total];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const r0 = cab.length; // fila del encabezado de la tabla
  for (let r = r0 + 1; r <= r0 + filas.length; r++) {
    const cf = ws[XLSX.utils.encode_cell({ r, c: 1 })]; if (cf && cf.t === 'n') cf.z = 'dd-mm-yyyy';
    const cm = ws[XLSX.utils.encode_cell({ r, c: 4 })]; if (cm) cm.z = '"$" #,##0';
  }
  for (const r of [6, 7, 8, r0 + filas.length + 1]) {
    for (const c of [1, 4]) { const x = ws[XLSX.utils.encode_cell({ r, c })]; if (x && x.t === 'n') x.z = '"$" #,##0'; }
  }
  ws['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 36 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rendición');
  const cats = [['Categoría', 'Total (CLP)'], ...porCategoria(d.gastos)];
  const wc = XLSX.utils.aoa_to_sheet(cats);
  for (let r = 1; r < cats.length; r++) { const x = wc[XLSX.utils.encode_cell({ r, c: 1 })]; if (x) x.z = '"$" #,##0'; }
  wc['!cols'] = [{ wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wc, 'Por categoría');
  const bin = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  descargar(nombreArchivo(d, 'xlsx'), new Blob([bin], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

function medidas(dataURL) {
  return new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res(null); i.src = dataURL; });
}

/** PDF de la rendición: resumen, tabla de gastos y una página de anexo por cada dos boletas. */
export async function descargarPdf(d, { alAvanzar } = {}) {
  if (!(window.jspdf && window.jspdf.jsPDF)) await cargarScript('vendor/jspdf.umd.min.js');
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'letter' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 16;
  const f = d.fila;
  let y = M;
  const tinta = () => doc.setTextColor(28, 31, 35), tenue = () => doc.setTextColor(91, 97, 104);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); tinta();
  doc.text(`Rendición de gastos N° ${d.numero}`, M, y + 4); y += 11;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); tenue();
  doc.text(`${d.persona}  ·  ${d.proyecto}  ·  ${ESTADOS[d.estado].texto}${d.envio ? `  ·  enviada ${fechaLegible(d.envio)}` : ''}`, M, y); y += 9;

  // Resumen: fondo, gastado y saldo
  const cajas = [['Fondo recibido', clp(f.fondo)], ['Gastado', clp(f.gastado)], [f.saldo < 0 ? 'Saldo a favor de la persona' : 'Saldo a favor de la empresa', clp(Math.abs(f.saldo))]];
  const cw = (W - 2 * M - 8) / 3;
  cajas.forEach(([t, v], i) => {
    const x = M + i * (cw + 4);
    doc.setDrawColor(226, 224, 218); doc.roundedRect(x, y, cw, 16, 2, 2);
    doc.setFontSize(8.5); tenue(); doc.text(t, x + 3, y + 5.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); tinta(); doc.text(v, x + 3, y + 12.5); doc.setFont('helvetica', 'normal');
  });
  y += 22;
  if (f.pagado || f.reintegro) { doc.setFontSize(9.5); tenue(); doc.text(`${f.pagado ? `Pagado a la persona: ${clp(f.pagado)}` : ''}${f.pagado && f.reintegro ? '  ·  ' : ''}${f.reintegro ? `Devuelto por la persona: ${clp(f.reintegro)}` : ''}`, M, y); y += 7; }

  // Tabla
  const cols = [[10, 'N°'], [22, 'Fecha'], [58, 'Comercio'], [28, 'Categoría'], [26, 'Monto'], [0, 'Boleta / nota']];
  cols[5][0] = W - 2 * M - cols.slice(0, 5).reduce((t, c) => t + c[0], 0);
  const encabezado = () => {
    doc.setFillColor(239, 237, 232); doc.rect(M, y, W - 2 * M, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); tinta();
    let x = M; for (const [w, t] of cols) { doc.text(t, t === 'Monto' ? x + w - 2 : x + 2, y + 4.8, t === 'Monto' ? { align: 'right' } : undefined); x += w; }
    doc.setFont('helvetica', 'normal'); y += 7;
  };
  encabezado();
  d.gastos.forEach((g, i) => {
    const det = g.sinBoleta ? `Sin boleta: ${g.motivoSinBoleta || ''}` : `Boleta en anexo${g.nota ? ' · ' + g.nota : ''}`;
    const lineasDet = doc.splitTextToSize(det, cols[5][0] - 4);
    const lineasCom = doc.splitTextToSize(g.comercio || '—', cols[2][0] - 4);
    const alto = Math.max(lineasDet.length, lineasCom.length) * 4 + 3;
    if (y + alto > H - M) { doc.addPage(); y = M; encabezado(); }
    doc.setFontSize(8.5); tinta();
    let x = M;
    doc.text(String(i + 1), x + 2, y + 4.5); x += cols[0][0];
    doc.text(fechaLegible(g.fecha), x + 2, y + 4.5); x += cols[1][0];
    doc.text(lineasCom, x + 2, y + 4.5); x += cols[2][0];
    doc.text(g.categoria, x + 2, y + 4.5); x += cols[3][0];
    doc.text(clp(g.monto), x + cols[4][0] - 2, y + 4.5, { align: 'right' }); x += cols[4][0];
    if (d.observados && d.observados.includes(g.id)) doc.setTextColor(138, 52, 16);
    doc.text(lineasDet, x + 2, y + 4.5); tinta();
    y += alto;
    doc.setDrawColor(239, 237, 232); doc.line(M, y, W - M, y);
  });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
  doc.text('Total', M + cols.slice(0, 4).reduce((t, c) => t + c[0], 0) - 2, y + 5.5, { align: 'right' });
  doc.text(clp(f.gastado), M + cols.slice(0, 5).reduce((t, c) => t + c[0], 0) - 2, y + 5.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');

  // Anexo: dos boletas por página
  const conBoleta = d.gastos.map((g, i) => ({ g, n: i + 1 })).filter(x => !x.g.sinBoleta && x.g.archivoId);
  let k = 0;
  for (const { g, n } of conBoleta) {
    alAvanzar && alAvanzar(++k, conBoleta.length);
    const b = await datosBoleta(g.archivoId).catch(() => null);
    const arriba = (k - 1) % 2 === 0;
    if (arriba) { doc.addPage(); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); tinta(); doc.text(`Anexo · boletas de la rendición N° ${d.numero}`, M, M + 2); doc.setFont('helvetica', 'normal'); }
    const y0 = arriba ? M + 8 : H / 2 + 4, alto = H / 2 - M - 14;
    doc.setFontSize(9); tenue();
    doc.text(`${n}. ${g.comercio || 'Sin comercio'} · ${fechaLegible(g.fecha)} · ${clp(g.monto)} · ${g.categoria}`, M, y0 + 3);
    if (b && /^image\//.test(b.mime)) {
      const m = await medidas(b.datos);
      if (m) {
        const esc = Math.min((W - 2 * M) / m.w, (alto - 6) / m.h);
        const fmt = /png/i.test(b.mime) ? 'PNG' : 'JPEG';
        doc.addImage(b.datos, fmt, M, y0 + 6, m.w * esc, m.h * esc);
      }
    } else {
      doc.text(b ? `La boleta es un archivo PDF (${b.nombre}): se entrega aparte.` : 'No se pudo cargar la boleta (conéctate a la nube para bajarla).', M, y0 + 10);
    }
  }
  descargar(nombreArchivo(d, 'pdf'), doc.output('blob'));
}
