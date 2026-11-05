// modulos/equipos/sensores.js — datos de la cámara o del sensor de un dron (v0.11).
// Salen del catálogo de Vuelos (modulos/vuelos/drones.js): una sola fuente para Equipos y para el cálculo de vuelo.

import { DRONES_BASE } from '../vuelos/drones.js';

const fmt1 = n => Number(n).toLocaleString('es-CL', { maximumFractionDigits: 2 });
/** Cámara o sensor del catálogo de Vuelos que corresponde a un dron (por modelo): para mostrar sus datos en Equipos. */
export function sensoresDe(eq) {
  const t = `${eq.marca || ''} ${eq.modelo || ''} ${eq.equipo || ''}`.toLowerCase().replace(/\s+/g, ' ');
  const clave = [['matrice 4e', 'm4e'], ['m4e', 'm4e'], ['matrice 300', 'm300'], ['m300', 'm300'], ['phantom 4 rtk', 'p4rtk'], ['p4 rtk', 'p4rtk'], ['p4rtk', 'p4rtk']].find(([k]) => t.includes(k));
  return clave ? DRONES_BASE.filter(d => d.familia === clave[1]) : [];
}
export const textoSensor = d => `${d.sensor}: ${fmt1(d.sensorAnchoMm)} × ${fmt1(d.sensorAltoMm)} mm · ${d.pixelesAncho} × ${d.pixelesAlto} px · focal ${fmt1(d.focalMm)} mm${d.lidar ? ` · LiDAR ${fmt1(d.lidar.fovGrados)}° · ${Math.round(d.lidar.puntosPorSegundo / 1000)} mil pts/s` : ''}`;

