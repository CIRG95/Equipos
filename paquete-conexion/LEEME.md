# Paquete de conexión Terreno ↔ Sistema · TopolandConexion 1.0 (Sistema v0.6)

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
6. **Tramos volados** (si el proyecto tiene seguimiento): `await TopolandConexion.tramosDeProyecto(proyectoId)` y `await TopolandConexion.marcarTramoVolado(proyectoId, tramoId, { nota })`.
7. **Nube:** `TopolandConexion.conectarNube()` (desde un toque), `sincronizar()`, `estadoNube()`, `alCambiarNube(fn)`, `alLlegarDatos(fn)`.

## Qué no hace (todavía)
- Notificaciones instantáneas al teléfono: más adelante (necesita servidor; se verá con el Nextcloud de la empresa).
- Usuarios con contraseña: el código/QR es provisorio y se reemplaza cuando existan usuarios.
- Las jornadas y levantamientos de Terreno siguen en su base propia hasta la «Etapa Proyectos / Nube común» de su hoja de ruta.
