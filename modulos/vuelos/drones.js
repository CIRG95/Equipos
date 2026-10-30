// modulos/vuelos/drones.js — catálogo de drones y cámaras para planificar.
// Valores de referencia de las fichas técnicas del fabricante: se pueden corregir en la app
// (Vuelos → Drones) y la corrección se guarda en el almacén vuelos_drones.
// Un dron puede tener varios sensores (Matrice 300: L2 o L1): cada combinación es una entrada con la misma «familia».
// Los Mavic 2 Enterprise no van: en Topoland se usan solo para termografía de cables.

export const DRONES_BASE = [
  {
    id: 'm4e', familia: 'm4e', familiaNombre: 'DJI Matrice 4E', sensor: 'Cámara gran angular',
    nombre: 'DJI Matrice 4E (cámara gran angular)',
    sensorAnchoMm: 17.3, sensorAltoMm: 13.0, focalMm: 12.29, pixelesAncho: 5280, pixelesAlto: 3956,
    obturador: 'mecanico', velocidadMaxMs: 21, autonomiaMin: 49, intervaloMinS: 0.5,
    vientoMaxMs: 12, rafagaMaxMs: 12, lidar: null,
  },
  {
    id: 'm300-l2', familia: 'm300', familiaNombre: 'DJI Matrice 300 RTK', sensor: 'Zenmuse L2',
    nombre: 'DJI Matrice 300 RTK · Zenmuse L2',
    sensorAnchoMm: 17.3, sensorAltoMm: 13.0, focalMm: 12.29, pixelesAncho: 5280, pixelesAlto: 3956,
    obturador: 'mecanico', velocidadMaxMs: 15, autonomiaMin: 30, intervaloMinS: 0.7,
    vientoMaxMs: 12, rafagaMaxMs: 15,
    lidar: { puntosPorSegundo: 240000, fovGrados: 70 },
  },
  {
    id: 'm300-l1', familia: 'm300', familiaNombre: 'DJI Matrice 300 RTK', sensor: 'Zenmuse L1',
    nombre: 'DJI Matrice 300 RTK · Zenmuse L1',
    sensorAnchoMm: 13.2, sensorAltoMm: 8.8, focalMm: 8.8, pixelesAncho: 5472, pixelesAlto: 3648,
    obturador: 'mecanico', velocidadMaxMs: 15, autonomiaMin: 30, intervaloMinS: 1.0,
    vientoMaxMs: 12, rafagaMaxMs: 15,
    lidar: { puntosPorSegundo: 240000, fovGrados: 70.4 },
  },
  {
    id: 'p4rtk', familia: 'p4rtk', familiaNombre: 'DJI Phantom 4 RTK', sensor: 'Cámara integrada',
    nombre: 'DJI Phantom 4 RTK',
    sensorAnchoMm: 13.2, sensorAltoMm: 8.8, focalMm: 8.8, pixelesAncho: 5472, pixelesAlto: 3648,
    obturador: 'mecanico', velocidadMaxMs: 14, autonomiaMin: 30, intervaloMinS: 2.0,
    vientoMaxMs: 10, rafagaMaxMs: 10, lidar: null,
  },
];

export const CAMPOS_DRON = [
  ['sensorAnchoMm', 'Ancho del sensor', 'mm'],
  ['sensorAltoMm', 'Alto del sensor', 'mm'],
  ['focalMm', 'Distancia focal real', 'mm'],
  ['pixelesAncho', 'Ancho de la imagen', 'px'],
  ['pixelesAlto', 'Alto de la imagen', 'px'],
  ['velocidadMaxMs', 'Velocidad máxima de misión', 'm/s'],
  ['autonomiaMin', 'Autonomía por batería (ficha)', 'min'],
  ['intervaloMinS', 'Intervalo mínimo entre fotos', 's'],
  ['vientoMaxMs', 'Viento sostenido máximo', 'm/s'],
  ['rafagaMaxMs', 'Ráfaga máxima', 'm/s'],
];
