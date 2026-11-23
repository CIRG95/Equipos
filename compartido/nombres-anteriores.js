// compartido/nombres-anteriores.js — v0.21.1 · nombres internos que usaban las versiones hasta la v0.21.
// Desde la v0.21.1 el código es genérico (sin el nombre de la empresa). Este archivo es lo ÚNICO que conoce
// los nombres antiguos y solo sirve para que una instalación anterior no pierda nada al actualizar:
//   · copia las preferencias del navegador (Drive vinculado, persona, dispositivo) a las claves nuevas;
//   · la base de datos anterior se copia a la nueva la primera vez (ver compartido/almacen.js);
//   · los respaldos y la carpeta de Drive antiguos se siguen reconociendo.
// La base anterior queda intacta como respaldo. Cuando todos los equipos (PC y teléfonos) hayan abierto la
// v0.21.1 o posterior, este archivo y sus usos se pueden borrar en una versión de limpieza.

const P = 'topoland'; // nombre anterior

export const BD_ANTERIOR = P;
export const APPS_RESPALDO_ANTERIORES = [P];
export const CARPETAS_DRIVE_ANTERIORES = ['Topoland Equipos (prueba)'];

const CLAVES = ['nube', 'nube_token', 'dispositivoId', 'conexion_persona', 'conexion_carpeta', 'conexion_codigo'];

/** Copia cada clave antigua a la nueva si la nueva aún no existe. No borra las antiguas (una app sin actualizar aún las usa). */
export function migrarClavesAnteriores(ls = globalThis.localStorage) {
  if (!ls) return 0;
  let n = 0;
  for (const k of CLAVES) {
    try {
      const viejo = ls.getItem(`${P}_${k}`);
      if (viejo != null && ls.getItem(`sistema_${k}`) == null) { ls.setItem(`sistema_${k}`, viejo); n++; }
    } catch { /* sin almacenamiento */ }
  }
  return n;
}
