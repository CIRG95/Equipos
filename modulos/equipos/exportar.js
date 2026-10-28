// modulos/equipos/exportar.js — «Descargar planilla»: un Excel con las mismas columnas que la planilla de RRHH,
// más columnas informativas (ubicación, próxima calibración, certificado, alertas). Sirve de respaldo que se abre
// sin la app, y se puede volver a importar: las columnas informativas se ignoran al importar.
// Hojas: Equipos · Accesorios · Certificados.

import { cargarScript, hoyISO } from '../../compartido/util.js';
import { mapaNombres, OFICINA_ID } from '../../compartido/catalogos.js';
import { COLUMNAS_PLANILLA, COLUMNAS_INFORMATIVAS, LUGARES, ESTADOS_ACCESORIO, nombreCorto } from './modelo.js';
import { listarConEstado, todosLosCertificados } from './datos.js';

let urlSheetJS = 'vendor/xlsx.full.min.js';
export function configurarSheetJSExportar(url) { urlSheetJS = url; }

/**
 * aaaa-mm-dd → número de fecha de Excel (días desde 30-12-1899). Se escribe como número con formato
 * dd-mm-aaaa: así Excel lo trata como fecha y no se corre un día por la zona horaria de Chile
 * (con objetos Date la librería dejaba 01-12-2025 como 30-11-2025 23:59).
 */
const fecha = iso => {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return a && m && d ? Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000) : '';
};

const ESTADO_CAL = { ok: 'Al día', por_vencer: 'Por vencer', vencida: 'Vencida', sin_dato: 'Falta fecha', no_aplica: 'No requiere' };

function hoja(XLSX, filas, anchos, colsFecha = []) {
  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = anchos.map(w => ({ wch: w }));
  if (filas.length > 1) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length - 1, c: filas[0].length - 1 } }) };
  // Formato de fecha chileno en las columnas de fecha
  for (const c of colsFecha) {
    for (let r = 1; r < filas.length; r++) {
      const cel = ws[XLSX.utils.encode_cell({ r, c })];
      if (cel && cel.t === 'n') cel.z = 'dd-mm-yyyy';
    }
  }
  return ws;
}

/** Arma el libro y lo descarga. Devuelve { archivo, equipos }. */
export async function descargarPlanilla() {
  if (!globalThis.XLSX) await cargarScript(urlSheetJS);
  const XLSX = globalThis.XLSX;
  const [lista, certs, nombres] = await Promise.all([listarConEstado(), todosLosCertificados(), mapaNombres()]);
  const proy = id => id === OFICINA_ID ? 'Oficina' : (nombres.proyecto[id] || '');
  const pers = id => nombres.persona[id] || '';
  const vigente = {};
  for (const c of certs) if (!vigente[c.equipoId]) vigente[c.equipoId] = c; // vienen de más reciente a más antiguo

  const orden = (a, b) => (a.equipo.equipo || '').localeCompare(b.equipo.equipo || '', 'es') || a.nombre.localeCompare(b.nombre, 'es');
  const activos = lista.filter(e => e.ubicacion.lugar !== 'baja').sort(orden);
  const deBaja = lista.filter(e => e.ubicacion.lugar === 'baja').sort(orden);

  // ── Hoja 1: Equipos (columnas de la planilla + informativas) ──
  const enc = [...COLUMNAS_PLANILLA.map(c => c.etiqueta), ...COLUMNAS_INFORMATIVAS];
  const filasEq = [enc];
  for (const e of [...activos, ...deBaja]) {
    const eq = e.equipo;
    const c = vigente[eq.id];
    const planilla = COLUMNAS_PLANILLA.map(col => {
      if (col.campo === 'fechaUltimaCalibracion') return eq.calibracionNoAplica ? '-' : fecha(eq.fechaUltimaCalibracion);
      return eq[col.campo] ?? '';
    });
    const u = e.ubicacion;
    filasEq.push([
      ...planilla,
      eq.categoria || '',
      LUGARES[u.lugar] || u.lugar,
      u.lugar === 'terreno' ? proy(u.proyectoId) : '',
      u.lugar === 'terreno' ? pers(u.personaId) : '',
      fecha(e.calibracion.proxima),
      ESTADO_CAL[e.calibracion.nivel] || '',
      c ? c.codigo : '',
      c ? fecha(c.fecha) : '',
      e.alertasActivas.map(a => a.descripcion).join(' | '),
      eq.accesorios.filter(a => a.estado !== 'bueno').map(a => `${a.nombre} (${ESTADOS_ACCESORIO[a.estado].toLowerCase()})`).join(', '),
      eq.codigoInterno || '',
      eq.observaciones || '',
    ]);
  }
  const iFecha = COLUMNAS_PLANILLA.findIndex(c => c.campo === 'fechaUltimaCalibracion');
  const nP = COLUMNAS_PLANILLA.length;
  const wsEq = hoja(XLSX, filasEq,
    [18, 13, 14, 20, 20, 13, 15, 14, 24, 18, 13, 13, 16, 13, 40, 30, 12, 30],
    [iFecha, nP + 4, nP + 7]);

  // ── Hoja 2: Accesorios ──
  const filasAcc = [['EQUIPO', 'N° SERIE EQUIPO', 'ACCESORIO', 'CANTIDAD', 'N° SERIE ACCESORIO', 'ESTADO']];
  for (const e of activos) for (const a of e.equipo.accesorios) {
    filasAcc.push([nombreCorto(e.equipo), e.equipo.numeroSerie || '', a.nombre, a.cantidad || 1, a.serie || '', ESTADOS_ACCESORIO[a.estado] || a.estado]);
  }
  const wsAcc = hoja(XLSX, filasAcc, [30, 20, 26, 10, 20, 10]);

  // ── Hoja 3: Certificados (todos, del más reciente al más antiguo) ──
  const porId = Object.fromEntries(lista.map(e => [e.equipo.id, e]));
  const filasCert = [['EQUIPO', 'N° SERIE', 'CÓDIGO DEL CERTIFICADO', 'FECHA MANTENCIÓN', 'LABORATORIO', 'PDF EN LA APP']];
  for (const c of certs) {
    const e = porId[c.equipoId];
    if (!e) continue;
    filasCert.push([e.nombre, e.equipo.numeroSerie || '', c.codigo, fecha(c.fecha), c.laboratorio || '', c.archivoId ? 'Sí' : 'No']);
  }
  const wsCert = hoja(XLSX, filasCert, [30, 20, 24, 16, 26, 12], [3]);

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, wsEq, 'Equipos');
  XLSX.utils.book_append_sheet(libro, wsAcc, 'Accesorios');
  XLSX.utils.book_append_sheet(libro, wsCert, 'Certificados');
  const archivo = `Equipos_Topoland_${hoyISO()}.xlsx`;
  XLSX.writeFile(libro, archivo, { compression: true });
  return { archivo, equipos: activos.length + deBaja.length };
}
