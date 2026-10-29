# Integración del módulo Equipos — v0.1f

Este archivo dice qué expone el módulo, qué espera recibir y qué almacenes usa. Se actualiza en cada versión, junto con el LEEME.

## 1. Qué expone (puerta de entrada)

Archivo: `modulos/equipos/equipos.js`. **Es lo único que otros módulos deben importar.** Para scripts clásicos (como los de Terreno Topografía), la misma puerta queda en `window.ModuloEquipos` cuando se carga `equipos-app.js`. Nadie lee los almacenes `equipos_…` directamente.

| Función | Devuelve | Para qué |
|---|---|---|
| `iniciar({ personaId })` | — | Registra los almacenes. La app global lo llama una vez al arrancar. Si se vuelve a llamar con `personaId`, cambia la persona que firma los registros. |
| `montar(contenedor, { rol, personaId })` | `{ desmontar(), refrescar() }` | Dibuja las pantallas dentro de `contenedor`. `rol`: `'terreno'` o `'rrhh'`. |
| `obtenerEquipo(equipoId)` | resumen o `null` | Datos y estado actual de un equipo. |
| `equiposDeProyecto(proyectoId)` | `[resumen]` | Equipos asignados hoy a un proyecto, según el último checklist de salida o traspaso. |
| `alertasActivas(equipoId)` | `[{ id, estado, descripcion, fechaReporte }]` | Alertas no cerradas. |
| `registrarUsoConAlerta(equipoId, personaId, proyectoId)` | `{ registrado, eventoId, alertas }` | Registra un uso. **Nunca bloquea**: si hay alertas activas, quedan anotadas en el evento y se devuelven para mostrar el aviso. |
| `certificadoVigente(equipoId)` | `{ id, codigo, fecha, laboratorio, archivoId }` o `null` | Certificado más reciente. |
| `certificadosDeProyecto(proyectoId)` | `[{ equipo: resumen, certificado }]` | Equipos que hoy están en el proyecto, con su certificado vigente. Ej.: anexar certificados al informe de Terreno. |
| `abrirArchivo(archivoId)` | — | Abre un PDF o una foto en otra pestaña. |
| `VERSION` | `'0.1f'` | — |
| `ALMACENES` | `['equipos_equipos', 'equipos_eventos', 'equipos_alertas']` | — |

**Resumen de un equipo:**
```js
{ id, nombre, equipo, marca, modelo, descripcion, numeroSerie, categoria,
  componentes: [texto],                     // nombres de los accesorios (compatibilidad)
  accesorios: [{ id, nombre, cantidad, serie, estado: 'bueno'|'danado'|'falta' }],
  fechaUltimaCalibracion,
  calibracion: { nivel: 'ok'|'por_vencer'|'vencida'|'sin_dato'|'no_aplica', proxima, dias },
  ubicacion:   { lugar: 'oficina'|'terreno'|'mantencion'|'baja', proyectoId, personaId, desde },
  alertasActivas: [{ id, estado, descripcion, fechaReporte }] }
```

**Uso previsto desde Terreno Topografía:** al abrir un levantamiento, `equiposDeProyecto(proyectoId)` propone los equipos que salieron al proyecto. Al elegir uno, `registrarUsoConAlerta(...)` muestra el aviso si hay alerta, sin bloquear.

## 2. Qué espera recibir

- **Rol y persona:** los entrega el envoltorio al llamar a `montar()`.
- **Abrir directo una ficha (opcional):** `montar(contenedor, { …, equipoInicial: equipoId })`. La etiqueta QR apunta a `<página>#equipo=<id>`; el envoltorio lee ese `#` y lo pasa como `equipoInicial`. Con `enlaceEquipo: id => url` la app global define otro formato de enlace.
- **Contenedor:** un elemento del DOM. El módulo no toca nada fuera de él, salvo un aviso flotante (`position: fixed`) que también vive dentro de su propia raíz.
- **Proyectos y personas:** siempre a través de `compartido/catalogos.js`.
  - Hoy son locales y temporales.
  - En la app global se llama a `configurarProveedorCatalogos({ listarProyectos, obtenerProyecto, listarPersonas, obtenerPersona, guardarProyecto?, guardarPersona? })` y el módulo no cambia.
  - Cada proyecto necesita `{ id, nombre, mandante? }`; cada persona, `{ id, nombre, cargo? }`.
  - El proyecto **«Oficina»** debe existir con id `oficina`.
- **Diseño:** usa las mismas variables CSS de Terreno Topografía en `:root`: `--bg`, `--surface`, `--ink`, `--primary`, `--primary-dark`, `--accent`, `--line`, `--muted`, `--danger`, `--ok`, `--radius`, `--soft`, `--mono` y `--sans`. Si no existen, aplica los valores de Terreno v0.4.1.
- **Modo de pantalla:** lee `body[data-modo]` (`telefono` | `pc`), el mismo atributo que fija `aplicarModoApp()` en Terreno.
  - En teléfono, la barra de pestañas del módulo va fija abajo.
  - En PC va fija arriba al centro (`top: 20px`), dentro del encabezado de la app.
  - Si la app global trae su propia barra inferior, hay que decidir si las pestañas del módulo pasan a ser una sub-barra (pendiente para la integración).
- **Hojas de estilo:** el envoltorio carga `modulos/equipos/equipos.css`.
- **Excel:** si `window.XLSX` ya existe (Terreno lo carga desde `vendor/`), el módulo lo usa. Si no, carga `vendor/xlsx.full.min.js`; con `configurarSheetJS(url)` de `compartido/planilla.js` se cambia la ruta.

## 3. Almacenes que usa (base IndexedDB `topoland`)

| Almacén | Clave | Índices | Contenido |
|---|---|---|---|
| `equipos_equipos` | `id` | — | Un registro por equipo. Primero las columnas de la planilla (`equipo`, `marca`, `modelo`, `descripcion`, `numeroSerie`, `fechaUltimaCalibracion`, más `calibracionNoAplica`); luego `categoria`, `codigoInterno`, `periodoCalibracionMeses`, `laboratorio`, `certificado`, `componentes[]`, `fechaAlta`, `observaciones`, `deBaja`, `columnasExtra{}` y `origen`. |
| `equipos_eventos` | `id` | `equipoId`, `proyectoId` | **Solo se agregan.** Tipos: `alta`, `salida`, `traspaso`, `regreso`, `uso`, `calibracion`, `alerta`, `baja`, `reactivacion`. Cada evento lleva `fecha`, `proyectoId`, `personaId` (responsable), `desdeProyectoId`, `checklist[]`, `faltantes[]`, `alertasAbiertas[]`, `avisos[]` y `nota`. La ubicación y el estado del equipo **se calculan** a partir de estos eventos. |
| `equipos_alertas` | `id` | `equipoId` | Una alerta por anomalía, con `estado` (`abierta` → `en_mantencion` → `recibida` → `cerrada`), `descripcion`, `reportadaPor`, `proyectoId`, `fechaReporte`, `historial[]` y `fechaCierre`. |

| `equipos_modelos` | `modelo-<marca>-<modelo>` | — | Especificaciones compartidas por modelo: `{ marca, modelo, categoria, specs: {clave: valor}, otras }`. |
| `equipos_certificados` | `id` | `equipoId` | `{ equipoId, codigo, fecha, laboratorio, archivoId }`. El vigente es el de fecha más reciente. |
| `equipos_mantenciones` | `id` | `equipoId` | `{ equipoId, fecha, tipo, proveedor, orden, costo, descripcion, alertaId }`. |
| `equipos_notas` | `id` | `equipoId` | Notas de terreno: `{ equipoId, texto, archivada }`; el autor está en `creadoPor`. |

Campos nuevos en `equipos_equipos` (v0.1d): `accesorios[]` (reemplaza a `componentes[]`), `fotoId`, `placaId` y `admin{}` (activo fijo, compra, garantía, seguro, DGAC).

Los registros con `detalle` (v0.1–v0.1b) se leen como `descripcion`, y los `componentes` (texto) como `accesorios`, con `migrarEquipo()`.

### Archivos (`compartido_archivos`, capa común en `compartido/archivos.js`)
`{ modulo, duenoTipo, duenoId, rol, proyectoId, nombre, mime, tamano, datos (dataURL), nube: { estado: 'local', ruta } }`
- `duenoTipo`: `equipo` (fotos), `certificado` (PDF de certificados; `duenoId` = equipoId), `modelo` (documentos compartidos; `duenoId` = id del modelo) o `equipo-doc` (documentos de la unidad).
- `nube.ruta` es la ruta prevista, por ejemplo `Equipos/Leica TS15 1669403/Certificados/cert.pdf` o `Equipos/Modelos/Leica TS15/manual.pdf`.
- **v0.1e (prueba de nube):** el adaptador subirá `datos` a `nube.ruta`, cambiará `nube.estado` a `'subido'` con el id remoto y podrá borrar `datos` del dispositivo. Los módulos no cambian, porque solo llaman a `guardarArchivo`, `urlArchivo` y `abrirArchivo`.

Todos los registros llevan `creadoEn`, `creadoPor`, `actualizadoEn`, `dispositivoId`, `modificadoPor` y `schemaVersion` (hoy 1). Lo que se borra queda en la papelera, con `eliminadoEn` y `eliminadoPor`.

La capa compartida usa además `compartido_proyectos` y `compartido_personas`. Son temporales y desaparecen cuando la app global entregue sus catálogos.

## 4. Reglas para convivir con otros módulos

- Los almacenes de cada módulo llevan su prefijo (`equipos_`, `terreno_`, `gastos_`).
  - `registrarAlmacenes()` crea solo los que faltan, subiendo la versión de la base sin tocar los demás.
- El respaldo `.json` es común. `descargarRespaldo(['equipos_', 'compartido_'])` exporta solo este módulo y los catálogos; al cargarlo, se mezcla por registro.
- La carpeta `compartido/` debe ser idéntica en todos los módulos. Si se cambia aquí, se copia a los demás.

## 5. Carga del código

- **Fuente:** módulos ES en `compartido/` y `modulos/equipos/`.
- **Lo que se carga:** `equipos-app.js`, generado con `construir.sh` (esbuild, formato iife). Es un script clásico, así que funciona con `file://` (doble clic), en GitHub Pages y sin internet.
- **En la app global:** se puede empaquetar todo junto de la misma manera, o cargar los módulos ES directamente si la app siempre se sirve por http(s).

## 6. Nube (v0.1e) — capa común, el módulo no la conoce

`compartido/nube.js` sincroniza **todos los almacenes `equipos_*` y `compartido_*`**. Cuando existan `terreno_*` y `gastos_*`, basta agregar sus prefijos a `PREFIJOS`.
- **La app (envoltorio o app global) llama a:** `configurar({ clienteId })`, `iniciar()`, `conectar()` (desde un toque), `crearCarpeta()` / `usarCarpeta(idOEnlace, { empezarDesdeNube })`, `sincronizar()`, `enlaceInvitacion()`, `alEstado(fn)` y `alDatosRemotos(fn)`.
- **Al llegar datos de otro dispositivo,** la app llama a `refrescar()` del módulo montado.
- **El módulo no hace nada especial:** cada escritura en `compartido/almacen.js` avisa (`alCambiar`), y la nube sube los cambios.
- **Formato en la carpeta:** `datos/<dispositivoId>.json` = `{ app, formato: 1, dispositivoId, escritoEn, almacenes: { nombre: [registros] } }`. Es el mismo formato que el respaldo `.json`, pero los archivos van sin `datos`. Los PDF y fotos se suben a `nube.ruta` y su registro guarda `nube: { estado: 'subido', id, ruta }`.
- **Regla de mezcla:** por registro, gana `actualizadoEn` mayor. Por eso las cosas que dos personas pueden tocar se guardan como registros nuevos (eventos, alertas, certificados, notas), no como ediciones de uno compartido.
- **Cambiar de proveedor:** se escribe `compartido/nube-nextcloud.js` con las mismas funciones que `nube-drive.js` (`conectar`, `tokenVigente`, `buscarCarpetas`, `crearCarpeta`, `datosCarpeta`, `asegurarRuta`, `listarArchivos`, `subir`, `descargar`) y se elige en `nube.js`. Ni los módulos ni el formato cambian.

## 7. Planilla Excel (v0.1f)
`modulos/equipos/exportar.js → descargarPlanilla()`: hojas Equipos, Accesorios y Certificados. Usa SheetJS (`window.XLSX` o `vendor/xlsx.full.min.js`). Las columnas extra de la hoja Equipos están en `COLUMNAS_INFORMATIVAS` (`modelo.js`) y el importador las ignora, así que el archivo se puede volver a importar sin ensuciar los datos.
