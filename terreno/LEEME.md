# Terreno Topografía — app de terreno (v0.5.9)

App aparte, liviana, para el teléfono (y PC). Alimenta al Sistema sin integrarse a él. Se publica con GitHub Pages en `…/equipos/terreno/`.

- Es una copia armada desde el proyecto Terreno (código en `js/`, `css/`, `vendor/`). **Los cambios se hacen en el chat de Terreno**, no editar aquí.
- Datos: base propia `terrenoTopoDB` (IndexedDB) y claves de localStorage sin prefijo `topoland_`/`env_`/`vu_`, así que no choca con el Sistema.
- Service worker propio (`terreno-topo-…`): solo borra sus cachés.
- **0.5.8:** paquete de conexión 1.3 del Sistema (`js/topoland-conexion.js`, copiado sin cambios desde `paquete-conexion/`): base compartida completa, código del QR guardado y vinculación automática al terminar la sincronización.
- **0.5.9:** pestaña **Gastos** con el paquete de conexión 1.4: nuevo gasto con foto de la boleta (cámara, galería o PDF), monto y categoría; borrador con fondo, gastado y saldo; aviso de duplicado; rendiciones devueltas con motivo y gastos observados; tarjeta «Gastos del proyecto» en la jornada en curso. Funciona sin señal. Archivos nuevos: `js/23-gastos.js`, `css/gastos.css`.
- Detalle de versiones: `LEEME-vX.Y.md` del proyecto Terreno.
