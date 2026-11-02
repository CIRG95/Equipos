# Paquete de conexión Terreno ↔ Sistema · TopolandConexion 1.2 (Sistema v0.8)

Con este paquete la app de Terreno **alimenta al Sistema** sin integrarse a él (decisión del 2-nov) y **no hay que programar la base ni la nube**: solo incluir un archivo y llamar funciones.

## Archivos
| Archivo | Para qué |
|---|---|
| `topoland-conexion.js` | Script clásico, global `window.TopolandConexion`. Trae la base común `topoland`, Equipos, Seguimiento y la nube. **Generado** con `construir.sh` del Sistema: no editar en Terreno |
| `ejemplo.html` | «App de Terreno» mínima que usa todo el paquete: vincular, mis proyectos, tramos volados, problema/aviso de un equipo, nube. Sirve de referencia y para probar ya |

## Integración en Terreno (pasos)
1. Copiar `topoland-conexion.js` a `js/`, agregarlo en `index.html` (antes de los scripts de la app) y al caché del service worker.
2. Al abrir la app: `const info = TopolandConexion.iniciar({ clienteId: localStorage.getItem('googleClientId') });`
3. **Vincular** (pantalla nueva, se muestra si `TopolandConexion.persona()` es null):
   - El QR del Sistema abre la app con `?carpeta=…#vincular=CODIGO`; `iniciar()` lo lee y `vincular(TopolandConexion.codigoQR())` lo resuelve.
   - Si no hay QR: campo para escribir el código de 6 letras → `await TopolandConexion.vincular(codigo)`.
   - Teléfono nuevo: si `vincular` devuelve null, botón «Conectar nube» → `await TopolandConexion.conectarNube()` (trae las personas y vincula solo).
4. **Proyectos de la jornada:** `await TopolandConexion.misProyectos()` → reemplaza el texto libre de `jornada.proyecto` por la elección (`proyectoId`).
5. **Botón «Problema o aviso»** (equipos que salieron a terreno):
   - `await TopolandConexion.misEquiposEnTerreno()` → lista para elegir.
   - `await TopolandConexion.reportar({ equipoId, tipo: 'problema' | 'aviso', descripcion })`.
   - Lo ven **el encargado del proyecto** (campanita del Sistema) y **Administración** (Equipos → Alertas). Llega con la próxima sincronización.
6. **Tramos volados** (si el proyecto tiene seguimiento): `await TopolandConexion.tramosDeProyecto(proyectoId)` (cada tramo trae `ini` y `fin` en km si su nombre tiene DM) y `await TopolandConexion.marcarTramoVolado(proyectoId, tramoId, { nota })`.
7. **Monografías, jornadas y fotos (1.2)** — siempre con el `proyectoId` del Sistema:
   - `await TopolandConexion.publicarMonografia(m, { proyectoId })` → `{ id, estado }`. `m` es la monografía tal cual la guarda Terreno; las imágenes dataURL (`croquisImg`, `panoramicaImg`, `clienteLogo`, `fotosExtra[].img`) pasan a archivos del proyecto en la nube del Sistema (Proyectos / <proyecto> / Terreno / <fecha>). Volver a publicar la misma monografía la actualiza; las fotos repetidas no se duplican.
   - `await TopolandConexion.publicarJornada(jornada, levantamientos, { proyectoId })` → `{ id, fotos }`. Las fotos de los puntos (`puntos[].foto`) y de `fotosReq` pasan a archivos, con GPS, hora y autor.
   - `await TopolandConexion.subirFoto(dataUrl, { proyectoId, tipo, monografiaId, puntoId, punto, lat, lng, hora, leyenda })` → `{ archivoId }`. `tipo`: `panoramica | croquis | placa | detalle | punto | otra`.
   - `await TopolandConexion.estadoMonografias(proyectoId)` → `[{ id, punto, estado, observacion, revisadoPor, fecha }]`; `estado`: `enviada | en-revision | lista | con-observacion`. Con «con-observacion», mostrar el texto al encargado (p. ej. «retomar la foto de la placa»).
   - Detectar el paquete: `typeof TopolandConexion.publicarMonografia === 'function'`.
   - En el Sistema se revisan en **Monografías** (por proyecto): fotos de terreno, coordenadas finales, estado y PDF con el mismo formato de Terreno.
8. **Nube:** `TopolandConexion.conectarNube()` (desde un toque), `sincronizar()`, `estadoNube()`, `alCambiarNube(fn)`, `alLlegarDatos(fn)`.

## Qué no hace (todavía)
- Notificaciones instantáneas al teléfono: más adelante (necesita servidor; se verá con el Nextcloud de la empresa).
- Usuarios con contraseña: el código/QR es provisorio y se reemplaza cuando existan usuarios.
- Terreno sigue con su base propia (`terrenoTopoDB`): lo que se publica es una copia para el Sistema.
