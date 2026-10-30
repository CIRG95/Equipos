// app/catalogo.js — listas fijas del Sistema (se pueden ampliar sin tocar los módulos).

export const ROLES = {
  terreno: 'Encargado de terreno',
  rrhh: 'Administración / RRHH',
};

// Tipos de trabajo por categoría (Camilo, 29-oct). El proyecto lleva una o más categorías;
// el detalle es opcional. Se guarda: tiposTrabajo = ['dron', 'gnss'] y tiposDetalle = ['dron:aerofoto', 'gnss:red'].
export const CATEGORIAS_TRABAJO = [
  { k: 'dron', t: 'Dron', det: [['aerofoto', 'Aerofotogrametría'], ['lidar', 'LiDAR'], ['termografia', 'Termografía']] },
  { k: 'nivelacion', t: 'Nivelación', det: [['simple', 'Simple'], ['cerrada', 'Cerrada']] },
  { k: 'gnss', t: 'GNSS', det: [['rtk', 'RTK'], ['estatico', 'Estático'], ['red', 'Red geodésica']] },
  { k: 'estacion', t: 'Estación total', det: [['levantamiento', 'Levantamiento'], ['poligonal', 'Poligonal'], ['replanteo', 'Replanteo'], ['cubicacion', 'Cubicación'], ['catastro', 'Catastro']] },
  { k: 'escaneo', t: 'Escaneos', det: [['estatico', 'Estático (FARO)'], ['slam', 'Móvil (SLAM)']] },
  { k: 'batimetria', t: 'Batimetría', det: [['bote', 'Con bote']] },
  { k: 'otro', t: 'Otro', det: [['gpr', 'GPR'], ['otro', 'Otro']], texto: true },
];
export const NOMBRE_CATEGORIA = Object.fromEntries(CATEGORIAS_TRABAJO.map(c => [c.k, c.t]));
const NOMBRE_DETALLE = Object.fromEntries(CATEGORIAS_TRABAJO.flatMap(c => c.det.map(([d, t]) => [`${c.k}:${d}`, t])));

// Tipos de la lista anterior (v0.1–v0.2) → categoría:detalle. Los proyectos viejos se leen con esto y se guardan en el formato nuevo al editarlos.
const TIPO_ANTIGUO = {
  aerofoto: 'dron:aerofoto', lidar: 'dron:lidar', termografia: 'dron:termografia', levantamiento: 'estacion:levantamiento',
  rtk: 'gnss:rtk', replanteo: 'estacion:replanteo', cubicacion: 'estacion:cubicacion', red: 'gnss:red',
  escaneo: 'escaneo:estatico', slam: 'escaneo:slam', batimetria: 'batimetria:bote', gpr: 'otro:gpr',
};

/** Devuelve { categorias: ['dron', …], detalles: ['dron:aerofoto', …] } para cualquier proyecto, viejo o nuevo. */
export function tiposDeProyecto(p) {
  const cats = new Set(); const det = new Set(p.tiposDetalle || []);
  for (const t of p.tiposTrabajo || []) {
    if (NOMBRE_CATEGORIA[t]) cats.add(t);
    else if (TIPO_ANTIGUO[t]) { const v = TIPO_ANTIGUO[t]; cats.add(v.split(':')[0]); det.add(v); }
  }
  for (const d of det) cats.add(d.split(':')[0]);
  const orden = CATEGORIAS_TRABAJO.map(c => c.k);
  return { categorias: [...cats].sort((a, b) => orden.indexOf(a) - orden.indexOf(b)), detalles: [...det] };
}

/** «Dron · Aerofotogrametría, LiDAR» por cada categoría (para la ficha del proyecto). */
export function textosTipos(p) {
  const { categorias, detalles } = tiposDeProyecto(p);
  return categorias.map(c => {
    const ds = detalles.filter(d => d.startsWith(c + ':')).map(d => (d === 'otro:otro' && p.tipoOtro) ? p.tipoOtro : NOMBRE_DETALLE[d]).filter(Boolean);
    if (c === 'otro' && !ds.length && p.tipoOtro) ds.push(p.tipoOtro);
    return ds.length ? `${NOMBRE_CATEGORIA[c]} · ${ds.join(', ')}` : NOMBRE_CATEGORIA[c];
  });
}

export const ROLES_PERSONA = [
  ['encargado', 'Encargado de terreno'],
  ['ayudante', 'Ayudante'],
  ['rrhh', 'Administración / RRHH'],
  ['dibujo', 'Dibujo / gabinete'],
  ['direccion', 'Dirección / comercial'],
];
export const NOMBRE_ROL_PERSONA = Object.fromEntries(ROLES_PERSONA);

export const REGIONES = [
  'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso', 'Metropolitana',
  "O'Higgins", 'Maule', 'Ñuble', 'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes',
];

// Colores de marca para elegir por empresa (el primero es el de Topoland por defecto).
export const COLORES_MARCA = [
  ['#1D5C63', 'Azul petróleo'], ['#1D4ED8', 'Azul'], ['#0F766E', 'Verde'], ['#C2410C', 'Naranjo'], ['#1C1F23', 'Grafito'],
];
