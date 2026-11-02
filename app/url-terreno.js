// Dirección de la app de Terreno para el QR de «Vincular teléfono».
// Por defecto es la app publicada junto al Sistema (carpeta terreno/). Si la persona escribió otra, se respeta;
// la página de prueba del paquete (paquete-conexion/ejemplo.html) que usaban las versiones ≤ 0.8 ya no se toma como guardada.
export const RUTA_TERRENO = 'terreno/';
const ANTIGUA = 'paquete-conexion/ejemplo.html';

export function resolverUrlTerreno(guardada, paginaSistema) {
  const g = (guardada || '').trim();
  if (g && !g.includes(ANTIGUA)) return g;
  return new URL(RUTA_TERRENO, String(paginaSistema).split('#')[0]).toString();
}
