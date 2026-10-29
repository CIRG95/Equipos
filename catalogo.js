// app/catalogo.js — listas fijas del Sistema (se pueden ampliar sin tocar los módulos).

export const ROLES = {
  terreno: 'Encargado de terreno',
  rrhh: 'Administración / RRHH',
};

// Tipos de trabajo (lista de Camilo, 27-oct). El proyecto lleva uno o más.
export const TIPOS_TRABAJO = [
  ['aerofoto', 'Dron · aerofotogrametría'],
  ['lidar', 'Dron · LiDAR'],
  ['termografia', 'Dron · termografía'],
  ['nivelacion', 'Nivelación'],
  ['levantamiento', 'Levantamiento / poligonal'],
  ['rtk', 'Levantamiento RTK (GNSS)'],
  ['replanteo', 'Replanteo'],
  ['cubicacion', 'Cubicación'],
  ['red', 'Red geodésica (GNSS estático)'],
  ['escaneo', 'Escaneo 3D estático'],
  ['slam', 'Escaneo 3D móvil (SLAM)'],
  ['batimetria', 'Batimetría'],
  ['gpr', 'GPR'],
  ['otro', 'Otro'],
];
export const NOMBRE_TIPO = Object.fromEntries(TIPOS_TRABAJO);

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
