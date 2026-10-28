// modulos/equipos/modelo.js — modelo de datos del módulo de Equipos.
// Los cinco primeros campos son las columnas de la planilla de RRHH, con el mismo orden y nombre.

import { sumarMeses, diasEntre, hoyISO, normalizarTexto } from '../../compartido/util.js';
import { OFICINA_ID } from '../../compartido/catalogos.js';

export const VERSION_MODULO = '0.1f';
export const SCHEMA_VERSION = 1;

export const ALM = {
  equipos: 'equipos_equipos',
  eventos: 'equipos_eventos',  // solo se agregan, nunca se editan
  alertas: 'equipos_alertas',
  modelos: 'equipos_modelos',          // especificaciones y documentos compartidos por modelo (marca + modelo)
  certificados: 'equipos_certificados',
  mantenciones: 'equipos_mantenciones',
  notas: 'equipos_notas',              // notas de terreno
};

export const DEFINICIONES_ALMACENES = [
  { nombre: ALM.equipos },
  { nombre: ALM.eventos, indices: [['equipoId', 'equipoId'], ['proyectoId', 'proyectoId']] },
  { nombre: ALM.alertas, indices: [['equipoId', 'equipoId']] },
  { nombre: ALM.modelos },
  { nombre: ALM.certificados, indices: [['equipoId', 'equipoId']] },
  { nombre: ALM.mantenciones, indices: [['equipoId', 'equipoId']] },
  { nombre: ALM.notas, indices: [['equipoId', 'equipoId']] },
];

/** Especificaciones técnicas por categoría. Se guardan por modelo: las dos TS15 las comparten. */
export const ESPECIFICACIONES = {
  'Estación total': [
    { clave: 'precisionAngular', etiqueta: 'Precisión angular', sufijo: '"' },
    { clave: 'precisionDistancia', etiqueta: 'Precisión distancia', sufijo: 'mm + ppm' },
    { clave: 'alcanceSinPrisma', etiqueta: 'Alcance sin prisma', sufijo: 'm' },
    { clave: 'alcancePrisma', etiqueta: 'Alcance con prisma', sufijo: 'm' },
    { clave: 'egl', etiqueta: 'Guía EGL', opciones: ['Sí', 'No'] },
    { clave: 'motorizada', etiqueta: 'Motorizada / robótica', opciones: ['Sí', 'No'] },
  ],
  'Nivel': [
    { clave: 'aumento', etiqueta: 'Aumento', sufijo: 'x' },
    { clave: 'precisionKm', etiqueta: 'Precisión doble nivelación', sufijo: 'mm/km' },
    { clave: 'tipoNivel', etiqueta: 'Tipo', opciones: ['Automático', 'Digital'] },
  ],
  'GNSS': [
    { clave: 'precisionRtk', etiqueta: 'Precisión RTK (H / V)', sufijo: '' },
    { clave: 'precisionEstatica', etiqueta: 'Precisión estática (H / V)', sufijo: '' },
    { clave: 'constelaciones', etiqueta: 'Constelaciones', sufijo: '' },
    { clave: 'radio', etiqueta: 'Radio interna', sufijo: '' },
    { clave: 'canales', etiqueta: 'Canales', sufijo: '' },
  ],
  'Dron (RPAS)': [
    { clave: 'camara', etiqueta: 'Cámara / sensor', sufijo: '' },
    { clave: 'rtk', etiqueta: 'RTK', opciones: ['Sí', 'No'] },
    { clave: 'autonomia', etiqueta: 'Autonomía', sufijo: 'min' },
    { clave: 'alcanceTransmision', etiqueta: 'Alcance de transmisión', sufijo: 'km' },
    { clave: 'peso', etiqueta: 'Peso de despegue', sufijo: 'g' },
  ],
  'Escáner láser': [
    { clave: 'tipoEscaner', etiqueta: 'Tipo', opciones: ['Estático', 'Móvil (SLAM)'] },
    { clave: 'alcance', etiqueta: 'Alcance', sufijo: 'm' },
    { clave: 'puntosSegundo', etiqueta: 'Puntos por segundo', sufijo: '' },
    { clave: 'precisionEscaner', etiqueta: 'Precisión', sufijo: 'mm' },
  ],
};
export const ESPECIFICACIONES_GENERICAS = [{ clave: 'resumen', etiqueta: 'Características', sufijo: '' }];
export function camposEspecificacion(categoria) { return ESPECIFICACIONES[categoria] || ESPECIFICACIONES_GENERICAS; }

/**
 * Valores que se pueden deducir de la DESCRIPCIÓN de la planilla (ej. «1" R500 EGL», «Aumento 32x»).
 * Se muestran con «?» (calculado por la app) hasta que alguien los confirme en el modelo.
 */
export function especificacionesDeDescripcion(categoria, descripcion) {
  const d = String(descripcion || '');
  const s = {};
  let m;
  if (categoria === 'Estación total') {
    if ((m = d.match(/(\d+(?:[.,]\d+)?)\s*(?:"|''|”|″|seg)/i))) s.precisionAngular = m[1];
    if ((m = d.match(/\b(?:R|NP|NR)\s*(\d{3,4})\s*m?\b/i))) s.alcanceSinPrisma = m[1];
    if (/\bEGL\b/i.test(d)) s.egl = 'Sí';
  } else if (categoria === 'Nivel') {
    if ((m = d.match(/(\d{2})\s*x\b/i))) s.aumento = m[1];
  } else if (categoria === 'Dron (RPAS)') {
    if (/\bRTK\b/i.test(d)) s.rtk = 'Sí';
  }
  return s;
}

export const ESTADOS_ACCESORIO = { bueno: 'Bueno', danado: 'Dañado', falta: 'Falta' };

export const TIPOS_MANTENCION = ['Calibración', 'Preventiva', 'Correctiva (reparación)', 'Revisión'];

/** Datos administrativos (solo RRHH). venceAviso: se avisa como la calibración. soloCategoria: solo para esa categoría. */
export const CAMPOS_ADMIN = [
  { clave: 'nActivoFijo', etiqueta: 'N° activo fijo' },
  { clave: 'fechaCompra', etiqueta: 'Fecha de compra', tipo: 'date' },
  { clave: 'proveedorCompra', etiqueta: 'Proveedor' },
  { clave: 'valorCompra', etiqueta: 'Valor de compra ($)', tipo: 'number' },
  { clave: 'garantiaHasta', etiqueta: 'Garantía hasta', tipo: 'date' },
  { clave: 'seguroCompania', etiqueta: 'Seguro: compañía' },
  { clave: 'seguroPoliza', etiqueta: 'Seguro: póliza' },
  { clave: 'seguroVence', etiqueta: 'Seguro: vence', tipo: 'date', venceAviso: 'Seguro' },
  { clave: 'dgacRegistro', etiqueta: 'Registro DGAC', soloCategoria: 'Dron (RPAS)' },
  { clave: 'dgacVence', etiqueta: 'Registro DGAC: vence', tipo: 'date', venceAviso: 'Registro DGAC', soloCategoria: 'Dron (RPAS)' },
];

/** Columnas de la planilla de equipos (orden de Camilo, 28-10-2026) → campo del módulo. */
export const COLUMNAS_PLANILLA = [
  { campo: 'equipo', etiqueta: 'EQUIPO' },
  { campo: 'marca', etiqueta: 'MARCA' },
  { campo: 'modelo', etiqueta: 'MODELO' },
  { campo: 'descripcion', etiqueta: 'DESCRIPCIÓN' },
  { campo: 'numeroSerie', etiqueta: 'N° SERIE' },
  { campo: 'fechaUltimaCalibracion', etiqueta: 'FECHA CALIBRACIÓN' },
];

/**
 * Columnas que agrega «Descargar planilla» después de las de la planilla. Son informativas:
 * si ese Excel se vuelve a importar, el importador las ignora (no se guardan como datos extra).
 */
export const COLUMNAS_INFORMATIVAS = [
  'CATEGORÍA', 'UBICACIÓN', 'PROYECTO', 'RESPONSABLE', 'PRÓXIMA CALIBRACIÓN', 'ESTADO CALIBRACIÓN',
  'CERTIFICADO VIGENTE', 'FECHA CERTIFICADO', 'ALERTAS ACTIVAS', 'ACCESORIOS POR REVISAR', 'CÓDIGO INTERNO', 'OBSERVACIONES',
];

/** Valores que en la columna de fecha significan «este equipo no se calibra» (ej. «-» en drones y escáner). */
export const MARCAS_NO_APLICA = ['-', '—', '–', 'N/A', 'NA', 'NO APLICA', 'NO CORRESPONDE'];

export const CATEGORIAS = [
  'Estación total', 'GNSS', 'Nivel', 'Dron (RPAS)', 'Escáner láser',
  'Ecosonda', 'GPR', 'Controlador', 'Otro',
];

export const MARCAS_CONOCIDAS = [
  'Leica', 'Topcon', 'Geomax', 'Trimble', 'Sokkia', 'Nikon', 'Spectra', 'South', 'Stonex', 'CHC',
  'Pentax', 'DJI', 'FARO', 'GeoSLAM', 'Emlid',
];

/** Componentes que se sugieren al crear un equipo (RRHH los ajusta). Alimentan el checklist de salida. */
export const COMPONENTES_SUGERIDOS = {
  'Estación total': ['Estuche', 'Trípode', 'Batería 1', 'Batería 2', 'Cargador', 'Prisma', 'Bastón porta prisma'],
  'GNSS': ['Estuche', 'Receptor', 'Bastón', 'Batería 1', 'Batería 2', 'Cargador', 'Antena de radio', 'Controlador', 'Base nivelante / trípode', 'Huincha de altura'],
  'Nivel': ['Estuche', 'Trípode', 'Mira', 'Sapo'],
  'Dron (RPAS)': ['Estuche', 'Control remoto', 'Batería 1', 'Batería 2', 'Batería 3', 'Cargador', 'Hélices de repuesto', 'Tarjeta de memoria'],
  'Escáner láser': ['Estuche', 'Trípode', 'Batería 1', 'Batería 2', 'Cargador', 'Tarjeta de memoria', 'Esferas / dianas'],
  'Ecosonda': ['Estuche', 'Transductor', 'Cables', 'Soporte'],
  'GPR': ['Antena', 'Unidad de control', 'Batería', 'Cargador', 'Carro / odómetro'],
  'Controlador': ['Cargador', 'Lápiz', 'Soporte de bastón'],
  'Otro': [],
};

export const PERIODO_CALIBRACION_MESES = 12; // por defecto; cada equipo puede tener el suyo
export const DIAS_AVISO_CALIBRACION = 30;

export const ESTADOS_ALERTA = {
  abierta: 'Abierta',
  en_mantencion: 'En mantención',
  recibida: 'Recibida de mantención',
  cerrada: 'Cerrada',
};

/** Pasos que puede dar RRHH desde cada estado de alerta. */
export const PASOS_ALERTA = {
  abierta: [
    { estado: 'en_mantencion', texto: 'Enviar a mantención' },
    { estado: 'cerrada', texto: 'Cerrar sin mantención' },
  ],
  en_mantencion: [{ estado: 'recibida', texto: 'Marcar recibido' }],
  recibida: [{ estado: 'cerrada', texto: 'Cerrar alerta' }],
  cerrada: [],
};

export const LUGARES = {
  oficina: 'En oficina',
  terreno: 'En terreno',
  mantencion: 'En mantención',
  baja: 'De baja',
};

export const TIPOS_EVENTO = {
  alta: 'Alta del equipo',
  salida: 'Salida a proyecto',
  traspaso: 'Traspaso entre proyectos',
  regreso: 'Regreso a oficina',
  uso: 'Uso registrado',
  calibracion: 'Calibración',
  alerta: 'Alerta',
  baja: 'Dado de baja',
  reactivacion: 'Reactivado',
};

/** Equipo nuevo con todos sus campos (los de la planilla primero). */
export function nuevoEquipo(datos = {}) {
  return {
    // — columnas de la planilla de equipos —
    equipo: '',                // tipo, como lo escribe la planilla («Estacion Total», «Nivel Topografico»…)
    marca: '',
    modelo: '',
    descripcion: '',           // precisión/alcance, aumento o rol (Base, Rover, RTK, Control…), tal cual
    numeroSerie: '',
    fechaUltimaCalibracion: null, // aaaa-mm-dd
    calibracionNoAplica: false,   // true cuando la planilla trae «-» (drones, escáner)
    // — campos que agrega el módulo —
    categoria: 'Otro',
    codigoInterno: '',
    periodoCalibracionMeses: PERIODO_CALIBRACION_MESES,
    laboratorio: '',
    accesorios: [],            // [{ id, nombre, cantidad, serie, estado: bueno|danado|falta }]; arma el checklist
    fotoId: null,              // archivo (compartido/archivos.js) con la foto del equipo
    placaId: null,             // foto de la placa con el N° de serie
    admin: {},                 // datos administrativos (CAMPOS_ADMIN), solo RRHH
    fechaAlta: hoyISO(),
    observaciones: '',
    deBaja: false,
    columnasExtra: {},         // columnas de la planilla que no tienen campo propio: no se pierden
    origen: 'manual',          // 'manual' | 'planilla'
    ...datos,
  };
}

export function inferirMarca(texto) {
  const t = normalizarTexto(texto);
  return MARCAS_CONOCIDAS.find(m => t.includes(normalizarTexto(m))) || '';
}

/** Categoría desde la columna EQUIPO; si no se reconoce, desde el resto de la fila. */
export function categoriaDeFila(equipo, resto = '') {
  const c = inferirCategoria(equipo);
  return c !== 'Otro' ? c : inferirCategoria(`${equipo} ${resto}`);
}

/** Pasa registros antiguos (v0.1–v0.1b, con «detalle») al formato actual. No cambia lo guardado hasta editarlo. */
export function migrarEquipo(eq) {
  if (!eq) return eq;
  if (eq.descripcion === undefined) eq.descripcion = eq.detalle || '';
  delete eq.detalle;
  if (eq.calibracionNoAplica === undefined) eq.calibracionNoAplica = false;
  if (!Array.isArray(eq.accesorios)) {
    // v0.1–v0.1c: «componentes» era una lista de textos. Ids fijos por posición hasta que se guarde.
    eq.accesorios = (eq.componentes || []).map((nombre, i) => ({ id: `a${i}`, nombre, cantidad: 1, serie: '', estado: 'bueno' }));
  }
  delete eq.componentes;
  if (!eq.admin) eq.admin = {};
  return eq;
}

/** Clave del modelo para compartir especificaciones y documentos entre unidades iguales. */
export function claveModelo(eq) {
  const k = normalizarTexto(`${eq.marca || ''} ${eq.modelo || ''}`).replace(/ /g, '-');
  return k ? `modelo-${k}` : null;
}

/** Vencimientos administrativos (seguro, DGAC) con el mismo semáforo que la calibración. */
export function vencimientosAdmin(eq, hoy = hoyISO()) {
  const salida = [];
  for (const c of CAMPOS_ADMIN) {
    if (!c.venceAviso) continue;
    if (c.soloCategoria && c.soloCategoria !== eq.categoria) continue;
    const f = eq.admin && eq.admin[c.clave];
    if (!f) continue;
    const dias = diasEntre(hoy, f);
    salida.push({ nombre: c.venceAviso, fecha: f, dias, nivel: dias < 0 ? 'vencida' : dias <= DIAS_AVISO_CALIBRACION ? 'por_vencer' : 'ok' });
  }
  return salida;
}

/**
 * Períodos de uso: cada salida o traspaso abre un período en un proyecto; el siguiente
 * traspaso, regreso o envío a mantención lo cierra. Devuelve del más reciente al más antiguo.
 */
export function periodosDeUso(eventosAsc, hoy = hoyISO()) {
  const periodos = [];
  let actual = null;
  const cerrar = fecha => { if (actual) { actual.hasta = fecha; periodos.push(actual); actual = null; } };
  for (const e of eventosAsc) {
    if (e.tipo === 'salida' || e.tipo === 'traspaso') { cerrar(e.fecha); actual = { proyectoId: e.proyectoId, personaId: e.personaId, desde: e.fecha, hasta: null }; }
    else if (e.tipo === 'regreso' || (e.tipo === 'alerta' && e.estadoAlerta === 'en_mantencion')) cerrar(e.fecha);
  }
  if (actual) periodos.push(actual);
  for (const p of periodos) {
    const fin = p.hasta ? p.hasta.slice(0, 10) : hoy;
    p.dias = Math.max(1, diasEntre(p.desde.slice(0, 10), fin) + 1);
  }
  return periodos.reverse();
}

export function inferirCategoria(texto) {
  const t = ' ' + normalizarTexto(texto) + ' ';
  const reglas = [
    ['GNSS', /GNSS|GPS|HIPER|\bR10\b|\bR12\b|\bR8\b|\bR2\b|GS1\d|GS0\d|RECEPTOR|ZENITH/],
    ['Estación total', /ESTACION|\bET\b|TOTAL STATION|\bTS ?\d|\bGTS|\bGPT|\bGM ?\d|\bOS ?\d|\bES ?\d|ZOOM|FLEXLINE|NIKON N/],
    ['Nivel', /\bNIVEL\b|\bNA ?\d|\bAT ?B|\bLS ?\d|AUTOLEVEL/],
    ['Dron (RPAS)', /DRON|DRONE|RPAS|MAVIC|PHANTOM|MATRICE|EBEE|INSPIRE/],
    ['Escáner láser', /ESCANER|SCANNER|FARO|FOCUS|SLAM|\bZEB|HORIZON|\bRTC360|\bBLK/],
    ['Ecosonda', /ECOSONDA|BATIM|ECHO/],
    ['GPR', /\bGPR\b|GEORADAR|GEORRADAR/],
    ['Controlador', /COLECTOR|CONTROLADOR|LIBRETA|\bTSC\d|\bFC ?\d|DATA ?COLLECTOR/],
  ];
  for (const [cat, re] of reglas) if (re.test(t)) return cat;
  return 'Otro';
}

export function estadoCalibracion(equipo, hoy = hoyISO()) {
  if (equipo.calibracionNoAplica) return { nivel: 'no_aplica', proxima: null, dias: null };
  if (!equipo.fechaUltimaCalibracion) return { nivel: 'sin_dato', proxima: null, dias: null };
  const proxima = sumarMeses(equipo.fechaUltimaCalibracion, equipo.periodoCalibracionMeses || PERIODO_CALIBRACION_MESES);
  const dias = diasEntre(hoy, proxima);
  const nivel = dias < 0 ? 'vencida' : dias <= DIAS_AVISO_CALIBRACION ? 'por_vencer' : 'ok';
  return { nivel, proxima, dias };
}

/**
 * Dónde está el equipo y quién lo tiene. No se escribe a mano: se calcula
 * recorriendo sus eventos en orden (salida, traspaso, regreso, mantención).
 */
export function calcularUbicacion(equipo, eventosAsc) {
  let u = { lugar: 'oficina', proyectoId: OFICINA_ID, personaId: null, desde: equipo.fechaAlta || equipo.creadoEn };
  for (const e of eventosAsc) {
    if (e.tipo === 'salida' || e.tipo === 'traspaso') u = { lugar: 'terreno', proyectoId: e.proyectoId, personaId: e.personaId, desde: e.fecha };
    else if (e.tipo === 'regreso') u = { lugar: 'oficina', proyectoId: OFICINA_ID, personaId: null, desde: e.fecha };
    else if (e.tipo === 'alerta' && e.estadoAlerta === 'en_mantencion') u = { lugar: 'mantencion', proyectoId: null, personaId: null, desde: e.fecha };
    else if (e.tipo === 'alerta' && e.estadoAlerta === 'recibida' && u.lugar === 'mantencion') u = { lugar: 'oficina', proyectoId: OFICINA_ID, personaId: null, desde: e.fecha };
  }
  if (equipo.deBaja) u = { ...u, lugar: 'baja' };
  return u;
}

export function alertaActiva(a) { return !a.eliminadoEn && a.estado !== 'cerrada'; }

/** Clave para comparar números de serie sin que importen espacios, guiones ni mayúsculas. */
export function claveSerie(s) { return normalizarTexto(s).replace(/ /g, ''); }

export function nombreCorto(eq) {
  const marcaYa = eq.marca && normalizarTexto(eq.modelo).includes(normalizarTexto(eq.marca));
  const partes = [eq.equipo, [marcaYa ? '' : eq.marca, eq.modelo].filter(Boolean).join(' ')].filter(Boolean);
  const unicas = partes.filter((p, i) => i === 0 || !normalizarTexto(partes[0]).includes(normalizarTexto(p)));
  return unicas.join(' · ') || eq.numeroSerie || 'Equipo sin nombre';
}
