# Terreno Topografía — app de terreno (v0.5.7)

App aparte, liviana, para el teléfono (y PC). Alimenta al Sistema sin integrarse a él. Se publica con GitHub Pages en `…/equipos/terreno/`.

- Es una copia armada desde el proyecto Terreno (código en `js/`, `css/`, `vendor/`). **Los cambios se hacen en el chat de Terreno**, no editar aquí.
- Datos: base propia `terrenoTopoDB` (IndexedDB) y claves de localStorage sin prefijo `topoland_`/`env_`/`vu_`, así que no choca con el Sistema.
- Service worker propio (`terreno-topo-…`): solo borra sus cachés.
- Detalle de versiones: `LEEME-vX.Y.md` del proyecto Terreno.
