// modulos/equipos/importar.js — importa la planilla de RRHH (EQUIPO | FECHA ÚLTIMA CALIBRACIÓN | MODELO | N° SERIE | DETALLE).
// Columnas desconocidas se guardan en columnasExtra para no perder nada.

import { leerArchivoTabla, encontrarEncabezados, aFechaISO } from '../../compartido/planilla.js';
import { normalizarTexto } from '../../compartido/util.js';
import { categoriaDeFila, inferirMarca, claveSerie, COLUMNAS_PLANILLA, MARCAS_NO_APLICA, COLUMNAS_INFORMATIVAS } from './modelo.js';
import { listarEquipos, guardarEquipo } from './datos.js';

// Orden de búsqueda: primero los encabezados más específicos.
const CLAVES = [
  { campo: 'fechaUltimaCalibracion', claves: ['CALIBRACION', 'CALIBRADO'] },
  { campo: 'numeroSerie', claves: ['SERIE', 'SERIAL'] },
  { campo: 'modelo', claves: ['MODELO'] },
  { campo: 'descripcion', claves: ['DESCRIPCION', 'DETALLE'] },
  { campo: 'marca', claves: ['MARCA', 'FABRICANTE'] },
  { campo: 'equipo', claves: ['EQUIPO', 'INSTRUMENTO', 'TIPO'] },
];
const NO_APLICA = new Set(MARCAS_NO_APLICA.map(normalizarTexto).concat(['']));

function asignarColumnas(encabezados) {
  const usados = new Set();
  const informativas = new Set(COLUMNAS_INFORMATIVAS.map(normalizarTexto));
  const columnas = encabezados.map((h, indice) => {
    const encabezado = String(h ?? '').trim();
    return { indice, encabezado, campo: null, ignorar: informativas.has(normalizarTexto(encabezado)) };
  });
  for (const { campo, claves } of CLAVES) {
    const col = columnas.find(c => !c.campo && !c.ignorar && c.encabezado && claves.some(k => normalizarTexto(c.encabezado).includes(k)));
    if (col && !usados.has(campo)) { col.campo = campo; usados.add(campo); }
  }
  const faltan = COLUMNAS_PLANILLA.filter(c => !usados.has(c.campo)).map(c => c.etiqueta);
  return { columnas, faltan };
}

const texto = v => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').trim());

/** Lee el archivo y prepara la vista previa. No guarda nada. */
export async function prepararImportacion(archivo) {
  const { filas, hoja, hojas } = await leerArchivoTabla(archivo);
  const iEnc = encontrarEncabezados(filas, ['EQUIPO', 'MARCA', 'MODELO', 'SERIE', 'CALIBRACION', 'DESCRIPCION', 'DETALLE'], 2);
  if (iEnc < 0) throw new Error('No encontré la fila de encabezados (EQUIPO, MODELO, N° SERIE…). Revisa que la primera hoja sea la de equipos.');
  const { columnas, faltan } = asignarColumnas(filas[iEnc]);

  const existentes = await listarEquipos();
  const porSerie = new Map(existentes.filter(e => e.numeroSerie).map(e => [claveSerie(e.numeroSerie), e]));
  const vistosEnArchivo = new Map();
  const registros = [];

  for (let i = iEnc + 1; i < filas.length; i++) {
    const fila = filas[i];
    if (!fila || fila.every(c => texto(c) === '')) continue;
    const datos = { equipo: '', marca: '', modelo: '', descripcion: '', numeroSerie: '', fechaUltimaCalibracion: null, calibracionNoAplica: false };
    const extra = {};
    const problemas = [];
    for (const col of columnas) {
      const v = fila[col.indice];
      if (col.ignorar) continue; // columnas que agrega «Descargar planilla»: se recalculan, no se importan
      if (!col.campo) { if (texto(v) !== '' && col.encabezado) extra[col.encabezado] = texto(v); continue; }
      if (col.campo === 'fechaUltimaCalibracion') {
        const f = aFechaISO(v);
        const tv = texto(v);
        if (f) datos.fechaUltimaCalibracion = f;
        else if (tv !== '' && NO_APLICA.has(normalizarTexto(tv))) datos.calibracionNoAplica = true;
        else if (texto(v) !== '') { problemas.push(`Fecha no reconocida: «${texto(v)}» (queda guardada como texto)`); extra[`${col.encabezado} (original)`] = texto(v); }
      } else datos[col.campo] = texto(v);
    }
    if (!datos.equipo && !datos.modelo && !datos.numeroSerie) continue; // fila de totales o notas

    if (!datos.marca) datos.marca = inferirMarca([datos.equipo, datos.modelo, datos.descripcion].join(' '));
    const reg = {
      filaExcel: i + 1, datos, extra, problemas,
      categoria: categoriaDeFila(datos.equipo, `${datos.modelo} ${datos.descripcion}`),
      existente: null, accion: 'nuevo',
    };
    if (!datos.numeroSerie) problemas.push('Sin N° de serie: se crea igual, pero no se podrá reconocer en una próxima importación');
    else {
      const k = claveSerie(datos.numeroSerie);
      if (vistosEnArchivo.has(k)) { problemas.push(`N° de serie repetido en la planilla (fila ${vistosEnArchivo.get(k)})`); reg.accion = 'omitir'; }
      vistosEnArchivo.set(k, reg.filaExcel);
      if (porSerie.has(k) && reg.accion !== 'omitir') { reg.existente = porSerie.get(k); reg.accion = 'actualizar'; }
    }
    registros.push(reg);
  }
  return { archivo: archivo.name, hoja, hojas, filaEncabezados: iEnc + 1, columnas, faltan, registros };
}

/** Guarda los registros según la acción elegida para cada uno (nuevo / actualizar / omitir). */
export async function aplicarImportacion(registros) {
  const resumen = { nuevos: 0, actualizados: 0, omitidos: 0 };
  for (const r of registros) {
    if (r.accion === 'omitir') { resumen.omitidos++; continue; }
    if (r.accion === 'actualizar' && r.existente) {
      // Solo se tocan las columnas de la planilla; lo que se agregó en el módulo se respeta.
      const cambios = { id: r.existente.id };
      for (const [k, v] of Object.entries(r.datos)) if (v !== '' && v !== null && v !== false) cambios[k] = v;
      if (r.datos.fechaUltimaCalibracion) cambios.calibracionNoAplica = false;
      cambios.columnasExtra = { ...(r.existente.columnasExtra || {}), ...r.extra };
      await guardarEquipo(cambios);
      resumen.actualizados++;
    } else {
      await guardarEquipo({
        ...r.datos, categoria: r.categoria, columnasExtra: r.extra, origen: 'planilla',
      });
      resumen.nuevos++;
    }
  }
  return resumen;
}
