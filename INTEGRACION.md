# INTEGRACION.md — Sistema v0.21.1

## v0.21.1 · Revisión de optimización y código genérico
- **Nombres internos:** base `sistema_trabajo` (`NOMBRE_BD`, exportado en `compartido/almacen.js`); claves `sistema_nube`, `sistema_nube_token`, `sistema_dispositivoId`, `sistema_conexion_persona|carpeta|codigo`, `sistema_invitacion` (sessionStorage), `sistema_bd_migrada`; globales `window.SISTEMA_CONFIG`, `window.SistemaConexion`, `window.SistemaNube`, `__sistemaBdEsperando`, `__sistemaBdBloqueada`.
- **`compartido/nombres-anteriores.js`:** único archivo con los nombres antiguos. `migrarClavesAnteriores()` corre al cargar `util.js` (copia sin pisar ni borrar). `almacen.abrir()` llama una vez a `traerBaseAnterior()`: copia todas las partes de la base anterior con `add` (no pisa), incluidas las que el esquema ya no registra, y deja marca `sistema_bd_migrada`; si la anterior está vacía la borra. `respaldo.js` acepta `app` antiguo; `nube.buscarCarpetas()` busca también el nombre antiguo. Borrar el archivo y sus 4 usos cuando todos los equipos hayan actualizado.
- **Marca:** `nombreEmpresa()` en `compartido/util.js` (lee `env_marca`; por defecto `NOMBRE_EMPRESA_DEFECTO = 'Mi empresa'`).
- **Lecturas compartidas:** `almacen.todos()` reutiliza la misma lectura 1,5 s (`VIGENCIA_LECTURA_MS`) y entrega una copia (`structuredClone`); `guardar`, `guardarVarios`, `vaciar` y `borrarDefinitivo` la descartan. `obtener` y `porIndice` no cambian.
- **Utilidades comunes nuevas en `util.js`:** `vacio`, `plural`, `txtCampo` (Administración la reexporta como `txt` desde `ui.js`; `app/vistas-ui.js` reexporta `vacio`).
- **Quitado (sin uso):** `NOMBRE_INFO`, `configurarSheetJS`, `configurarSheetJSExportar`, `configurarQR`, `deshacerPapelera`, `documentosDe`, `ausenteEn`, `eliminarDeGabinete`, `nube.conectarConToken`, `VERSION_ESQUEMA`.
- **Armado:** `esbuild --minify --keep-names` (antes solo espacios y sintaxis).
- **Paquete de conexión 1.8:** mismas funciones; `paquete-conexion/sistema-conexion.js` idéntico a `terreno/js/sistema-conexion.js`.

## v0.21 · Mapa de puntos (Monografías 0.5) y exportar KML/KMZ
- `compartido/kmz.js`: escribe KML con carpetas, estilos compartidos y `ExtendedData`, y el KMZ con `armarZip` (`compartido/zip.js`). `descargarDocumento(doc, base, 'kmz'|'kml')`.
- `app/kmz-proyecto.js` (sin pantalla, con pruebas): `carpetaCapas`, `carpetaRed`, `carpetaMarcas`, `carpetaVuelo(hoja, { avance, amarre, geo })`, `carpetaMonografias(puntos)`, `documentoProyecto(proyecto, { redes, marcas, vuelos, monografias })`.
- Vuelos: `calcularAmarreHoja(h, g, proyecto, redes)` y `prsParaAmarre` salen de `vista-amarre.js` para usarse sin la vista; puerta nueva `Vuelos.vuelosParaKmz(proyecto)`. Botón «Exportar KMZ» en la hoja (`data-accion="kmz-vuelo"`).
- Planificación: «Exportar KMZ» en la red (`kmz-red`) y en las marcas (`kmz-marcas`).
- Monografías: `mapa-calculo.js` (posición de la ficha, Web Mercator, escala, hoja con viñeta, zoom para una escala, nombres sin taparse) y `mapa-puntos.js` (ventana, dibujo en canvas, imagen y PDF con jsPDF). `croquis.js` exporta `dibujarSimbolo`, `dibujarNorte` y `capasDe`. Puerta nueva `Monografias.puntosDeProyecto(proyectoId)`.
- Proyecto: «Exportar el proyecto (KMZ)» y «Como KML» en «Lo planificado» (`exportar-kmz-proyecto` en `app/vistas.js`).

## v0.17 · Roles en proyectos, trabajos ordenables, capas del proyecto y Vuelos 0.10

- **Sin almacenes nuevos; paquete de conexión idéntico.** En el proyecto: `trabajos: [{ cat, dias, paralelo }]`, `capas: { archivos, caminos: [{ nombre, linea }], prs: [{ id, nombre, lon, lat, usar }], actualizadoEn }`, actividades del cronograma con `origen: 'trabajos'`. En la hoja de vuelo: `area.amarre { radioKm, asignado: { [i]: prId } }`, `params.jornada { modo, baterias, recarga, minCarga, minAlmuerzo, minIdaVuelta, minBase }`, `programa[].bases`, `resumen.amarre { bases, nuevos, nombres }`.
- **Archivos nuevos:** `modulos/vuelos/amarre.js` (puro: `calcularAmarre`, `jornadasPorBaterias`, `diametro`), `modulos/vuelos/capas-proyecto.js` (`leerCapasDeArchivos`, `fusionarCapas`, `prsActivos`, `resumenCapas`), `modulos/vuelos/vista-amarre.js` (fábrica del Resumen), `app/trabajos.js` (puro: `trabajosDeProyecto`, `cronogramaDeTrabajos`, `avisosOrden`, `moverTrabajo`), `app/vistas-tecnico.js` (`#/proyecto-tecnico/<id|nuevo>`).
- **Rutas por rol:** terreno en `#/encargo/…` va a `#/proyecto-tecnico/…`; los demás roles al revés. `ctx.repintar()` nuevo en el envoltorio. `AL_PINTAR.proyecto` inicia el arrastre de trabajos.

## v0.16 · Encargo de proyectos, gestión de personal, buscador lateral, Configuración y Terreno 0.6.0

- **Sin almacenes nuevos.** El encargo vive en el registro del proyecto: `cronograma[]`, `encargo { info, prioridad, emitidoPor/En, recibidoPor/En }`, `bitacora[]`, `contactoTerreno`, `sistemaReferencia`, `fechaInicio`. Datos personales en `admin_fichas.personal`; baja de una persona = `activo: false` + `bajaEn`; carpeta de arranque = `admin_licitaciones` con `proyectoId`; marca en `admin_config.general.marca`.
- **Archivos nuevos:** `app/encargo.js` (reglas puras), `app/vistas-encargo.js` (asistente; `AL_PINTAR.encargo` inicia el comportamiento en vivo), `app/vistas-config.js`, `compartido/cronograma.js` (fechas del cronograma; no lo importa el paquete de conexión), `modulos/administracion/pantallas-gestion.js` (dotación, distribución, vacaciones).
- **Rutas:** `#/encargo/<id|nuevo>`, `#/configuracion`, `#/personal` (Dotación) · `/distribucion` · `/vacaciones` · `/carpetas` · `/carpeta/<id>` · `/carpeta-proyecto/<proyectoId>`. `#/personas` y `#/proyecto-editar/…` redirigen.
- **Buscador:** `iniciarBuscador({ panel, boton, rol, seccion })` devuelve `{ alNavegar }`; los ámbitos por sección están en `AMBITOS` (`app/buscador.js`). Para que una sección nueva tenga búsqueda propia, agregar su ámbito y poner sus registros en `armarIndice`.
- **Acceso:** `gestiona(v)` = rol `rrhh` o `direccion` (Recursos Humanos y Jefatura).
- **Paquete de conexión 1.4.2:** solo cambian textos de `explicarVinculo`. Copiado a `terreno/js/`.
- **Terreno 0.6.0:** `colaSync` en localStorage, `reconectarNubes(motivo)`, `hayConexion()`, `pendientesDeSubida()`; `sw.js` guarda `../config.js` y responde las navegaciones sin señal con `index.html`.

## v0.15 · Administración 0.1 + Planificación 0.1 (paquete de conexión 1.4.1)
### Compartido
- `compartido/vencimientos.js` (nuevo): **motor único de vencimientos**. `DIAS_AVISO`, `ESTADOS_VENC` (falta, vencido, rechazado, pendiente, por_vencer, vigente, no_vence, opcional; color y orden), `diasHasta`, `estadoFecha`, `estadoDocumento(tipo, doc, { hoy, diasAviso, obligatorio, estadoPlataforma })`, `habilitacion(requisitos, docs, opc)` → `{ habilitado, nivel: 'ok'|'aviso'|'no', pendientes, avisos, filas }`, `ultimoDoc`, `textoDias`, `ordenarPendientes`. Lo usan personas, camionetas y la acreditación por mandante.
- `compartido/zip.js` (nuevo): ZIP sin librerías (método store, CRC32, nombres UTF-8). `armarZip([{ nombre, datos }])` → Blob; `nombreSeguro`, `bytesDeDataURL`.
- `compartido/archivos.js`: `contenidoArchivo(id)` → `{ nombre, mime, datos }` (baja de la nube si hace falta).
- `compartido/esquema.js`: almacenes `compartido_mandantes`, `admin_tipos_doc`, `admin_documentos` (índice `dueno` [duenoTipo, duenoId]), `admin_fichas`, `admin_ausencias` (personaId), `admin_licitaciones`, `admin_vehiculos`, `admin_viajes` (proyectoId), `admin_guias` (proyectoId), `admin_cotizaciones`, `admin_seguridad` (proyectoId), `admin_biblioteca`, `admin_config`, `planif_redes` (proyectoId), `planif_marcas` (proyectoId). `VERSION_ESQUEMA` sigue en 1 (la base se agranda sola al faltar algo).
- `compartido/nube.js`: PREFIJOS suma `admin_` y `planif_`.
- `app/catalogo.js`: rol `direccion` («Dirección / comercial»).

### Administración 0.1 (`modulos/administracion/`)
- Puerta `administracion.js`: `iniciar`, `montar(contenedor, ctx)` (ctx.seccion = personal | administracion | comercial | conocimiento | seguridad; ctx.ruta), `datos()`, `pendientes({ rol, personaId, ... })`, `eventosCalendario`, `cuadrillaDeProyecto(p, { personas, hoy })`, `leccionesRelacionadas`, `mandanteDeProyecto`.
- `datos.js`: `asegurarBase()` siembra una sola vez tipos de documento base, el mandante Codelco · SUCAL (`man-codelco`, 8 requisitos de vehículo) y la configuración (bandera `semilla`). Archivos de personas en la carpeta `RRHH/Personas/<nombre>`; de camionetas en `Vehiculos/<patente>`.
- `modelo.js`: `TIPOS_BASE`, `MANDANTES_BASE`, `CONFIG_BASE`, listas (turnos, contratos, ausencias, estados de plataforma, cotización, guía, viaje, biblioteca, riesgos), `habilitacionPersona`, `acreditacion(mandante, duenoTipo, duenoId, base)`, `pendientesAdmin`, `eventosAdmin`, `estimar`, `resumenCotizaciones`, `cumplimientoLicitacion`.
- Pantallas: `pantallas-personal.js` (resumen, ficha con 8 pestañas, licitaciones con ZIP por persona y CV en PDF con jsPDF), `pantallas-admin.js` (camionetas, acreditación matriz + detalle, viajes, fondos, guías, mandantes, configuración), `pantallas-comercial.js`, `pantallas-conocimiento.js` (mapa Leaflet + Esri con agrupación), `pantallas-seguridad.js`; enrutador `pantallas.js` con delegación `data-a` / `data-c` / `form[data-f]`.
- Rutas: `#/personal`, `#/personal/<personaId>/<pestaña>`, `#/personal/licitaciones`, `#/personal/licitacion/<id>`, `#/administracion/<sección>/…`, `#/comercial/<sección>`, `#/conocimiento/<sección>`, `#/seguridad/<proyectoId>`.
- Para el rol terreno, `pendientesAdmin` solo entrega habilitación (sin detalle de documentos) y acreditación de camionetas de sus proyectos.

### Planificación 0.1 (`modulos/planificacion/`)
- `modelo.js` (sin pantalla, probado en `pruebas/planificacion.test.mjs`): `marcoLocal`, `sugerirPR(poligono, { n, caminos, fijos })`, `delaunay` (Bowyer-Watson), `vectoresSugeridos`, `preAnalisis(puntos, vectores, { fijos, a, b })` (σ = a + b·L; radio 95 % = 2,4477σ; redundancia local; solo entran los puntos conectados a un fijo; si no hay control, se fija el primer PR), `invertir` (null si es singular), `evaluarPunto`, `reforzar`, `tiempoPara(km, tabla)`, `planificarSesiones` (R receptores, cada sesión comparte un punto con la anterior), `marcasArea`, `marcasCorredor`.
- `datos.js`: `planif_redes`, `planif_marcas`; `PARAMS_RED { receptores: 3, a: 5, b: 1, tol: 20, nSugeridos: 6 }`. La tabla de tiempos se guarda en `admin_config` (`tablaTiempos: [{ hastaKm, minutos }]`).
- Puerta `planificacion.js`: `montar`, `resumenDeProyecto(id)`, `puntosDeRedes()`.
- Rutas: `#/planificacion`, `#/planificacion/proyecto/<id>`, `#/planificacion/red/<id>`, `#/planificacion/marcas/<id>`.

### App
- `app/buscador.js` (nuevo): `iniciarBuscador({ input, lista, rol })`; índice que se renueva cada minuto o al cambiar de rol.
- `app/sistema.js`: menú nuevo (Planificación, Administración, Comercial, Conocimiento), subnavegación de Personas por rol, rutas nuevas; `index.html` con el buscador (`#sis-buscar`) y las hojas `administracion.css` y `planificacion.css` (también en `sw.js`).
- `app/calendario.js`: tipos `vencimiento` y `ausencia`; `eventosEntre(desde, hasta, { rol })`.
- `app/vistas-inicio.js`: `misPendientes` / `tarjetaPendientes`; Inicio de Dirección.
- `app/vistas-proyectos.js` y `app/vistas.js`: ficha de encargo (campos nuevos del proyecto: `mandanteId`, `alcance`, `entregablesPedidos`, `montoCotizado`, `cuadrilla`, `vehiculoIds`; se suman a `solicitadoPor`, `fechaEncargo` y `plazo`), archivos del mandante (`duenoTipo: 'encargo'`, carpeta `Proyectos/<nombre>/Encargo`), entregables y cierre.

### Paquete de conexión 1.4.1
- Solo cambia el esquema (almacenes nuevos) y los prefijos de la nube; ninguna función. Copiado en `terreno/js/sistema-conexion.js`; `terreno/sw.js` CACHE = `terreno-topo-v47-0.5.9`. Paquete de pronóstico idéntico.

### Límite
- El acceso exclusivo de RRHH se controla en la app; la nube es una sola carpeta. Separarlo de verdad requiere Nextcloud con grupos o un servidor aparte.


## v0.14.1 · Revisión de optimización (sin cambios de funcionamiento)
- `app/vistas.js` dividido en `vistas-inicio.js` (`inicio`, `htmlFranjaProyectos`), `vistas-proyectos.js` (`proyectos`, `proyecto`, `proyectoEditar`, `datosRegistro`) y `vistas-ui.js` (`ICONO`, `chipCal`, `filaEquipo`, `vacio`, `estadoAlerta`, `aFechaL`, `lunesDe`, `diaCorto`). `vistas.js` sigue exportando `VISTAS`, `manejarEnvio`, `manejarClic`, `manejarCambio`, `avisosPara`, `marcarAvisoVisto`, `htmlFranjaProyectos`, `nuevoCodigo`, `urlTerreno`.
- `compartido/util.js`: `leerTexto(k, d)` / `escribirTexto(k, v)` (texto simple, sin JSON).
- Eliminadas por no tener uso: `equipos/datos.js` `registrarCalibracion`, `obtenerEquipoCrudo`; `monografias/datos.js` `historialDe`; `seguimiento/datos.js` `obtenerCiclo`; `vuelos/hoja.js` `DOCUMENTOS_DGAC`.
- Paquetes `paquete-conexion/` y `paquete-pronostico/` idénticos byte a byte.


## v0.14a · Gastos 0.1a: eliminar rendiciones (RRHH)
- `modulos/gastos/datos.js`: `eliminarRendicion(id, { modo: 'borrador' | 'todo' })` (anota `eliminacion: { modo, gastoIds, depositoIds }` en la rendición y la manda a la papelera; 'borrador' deja `rendicionId: null` en sus gastos, 'todo' manda gastos y depósitos ligados a la papelera), `restaurarRendicion(id)` (deshace según `eliminacion`; renumera si el N° quedó ocupado), `rendicionesEliminadas()`, `purgarRendicion(id)` (`eliminarDefinitivo` de la rendición, sus eventos, depósitos y, en 'todo', gastos y boletas).
- `pantallas.js`: `zonaEliminar` en la rendición (solo RRHH) y `vistaPapeleraRendiciones` en la bandeja; acciones `eliminar-rendicion`, `restaurar-rendicion`, `purgar-rendicion`. Estilos `gs-eliminar`, `gs-papelera`.
- Sin almacenes nuevos. Paquete de conexión idéntico (esbuild deja fuera estas funciones): Terreno no cambia.

## v0.14 · Paquete de conexión 1.4 (Gastos desde Terreno)
- `app/conexion-terreno.js`: sección «Gastos (v1.4)» que reutiliza `modulos/gastos/datos.js` y `modelo.js` (sin pantallas): `CATEGORIAS_GASTO`, `proyectosGastos`, `misGastos`, `gastosDevueltos`, `guardarGasto`, `eliminarGasto`, `restaurarGasto`, `boleta`. Ver `paquete-conexion/LEEME.md`.
- Reglas: la persona vinculada firma; solo gastos propios y editables (`gastoEditable`); foto obligatoria; mismo aviso de duplicado; carpeta de la boleta `Gastos/<proyecto>/<persona>`.
- Paquete copiado a `terreno/js/sistema-conexion.js`; Terreno 0.5.9 (caché `terreno-topo-v46-0.5.9`) suma la pestaña Gastos.
- El Sistema no cambia en lo que hace; las 90 pruebas pasan.

## v0.13 · Gastos 0.1
- Módulo nuevo `modulos/gastos/`: `gastos.js` (puerta: `iniciar`, `montar`, `resumenDeProyecto`, `avisos`), `datos.js` (almacenes y operaciones), `modelo.js` (reglas puras: montos, estados, libro de la cuenta, avisos; pruebas en `pruebas/gastos.test.mjs`), `pantallas.js`, `exportar.js` (Excel con SheetJS y PDF con jsPDF, ambos de `vendor/`), `gastos.css`.
- Almacenes (también en `compartido/esquema.js`): `gastos_gastos` (índices `proyectoId`, `personaId`, `rendicionId`), `gastos_rendiciones` (`proyectoId`, `personaId`), `gastos_eventos` (`rendicionId`). Boleta en `compartido_archivos` con `modulo: 'gastos'`, `duenoTipo: 'gasto'`, `rol: 'boleta'`, carpeta `Gastos/<proyecto>/<persona>`.
- Rutas: `#/gastos`, `#/gastos/proyecto/<id>`, `#/gastos/nuevo[/<proyectoId>]`, `#/gastos/gasto/<id>`, `#/gastos/rendicion/<id>`. El envoltorio pasa `vista`, `id` y `marcarVisto(id)`.
- Campanita: `avisosPara()` suma `Gastos.avisos()`; `marcarAvisoVisto(ctx, id)` (nuevo en `app/vistas.js`) marca un aviso visto desde un módulo.
- **Paquete de conexión:** cambia solo el esquema (3 almacenes nuevos). Copiado a `terreno/js/sistema-conexion.js` y caché de Terreno `terreno-topo-v45-0.5.8.2`. El paquete de pronóstico sale idéntico.


## v0.12 · Monografías paso a paso
- Rutas: `#/monografias/<p>/comun` (paso 1), `#/monografias/<p>/<id>` (paso 2), `#/monografias/<p>/<id>/ubicacion` (paso 3), `#/monografias/<p>/revisar`. El envoltorio pasa `paso: partes[3]` a `Monografias.montar`.
- Archivos nuevos: `modulos/monografias/pasos.js` (pantallas del paso a paso), `comun.js` (lógica pura: datos comunes, nombres, tabla pegada, UTM ↔ geográficas, chequeo por paso; pruebas en `pruebas/monografias-comun.test.mjs`), `borrado.js` (papelera de monografías).
- `datos.js` **no se tocó** porque va dentro del paquete de conexión de Terreno; el paquete sale idéntico.
- Datos comunes por proyecto en el navegador (`mono_comun_<proyecto>`: casillas «Todas las fichas», valores, módulos del PDF, formato); los valores quedan además en cada ficha. Frases propias en `mono_frases`.
- Módulos del PDF nuevos: `logoEmpresa`, `logoCliente` (en `ficha.modulos`) y `disposicionImg: 'solo-croquis'`; se aplican en `pdf.js` con `efectiva()` sin tocar `pieza-terreno.js`.
- Monografías usa `listarEquiposConEstado()` de Equipos y `ubicacionDe()` de Vuelos.


## Qué contiene

| Pieza | Origen | Versión |
|---|---|---|
| `compartido/` | Repositorio `cirg95/equipos` | Equipos 0.1f (commit 3302b28, 28-10) |
| `modulos/equipos/` | Repositorio `cirg95/equipos` | 0.1f + `listarEquiposConEstado()` (ver abajo) |
| `modulos/vuelos/` | Nuevo (chat de integración) | Vuelos 0.1 |
| `app/` | Nuevo (chat de integración) | Sistema 0.2 |

## Cómo monta los módulos el envoltorio

- `Equipos.iniciar({ personaId })` al arrancar.
- `Equipos.montar(contenedor, { rol, personaId, equipoInicial })` en `#/equipos[/<id>]`. Se vuelve a montar al cambiar rol, persona o equipo, y al tocar «Equipos» en el menú.
- Al llegar datos de la nube: `refrescar()` si hay módulo montado; si no, se vuelve a pintar la pantalla del Sistema, salvo que haya un formulario abierto.
- `body[data-modo]` lo fija el envoltorio, con la preferencia `env_modo` compartida con Equipos y Terreno.
- **En PC, la barra de pestañas del módulo pasa a ser una sub-barra** dentro del contenido (`app/sistema.css`). El módulo no cambia.

## Cambio en el módulo Equipos (pasar al chat de Equipos)

En `modulos/equipos/equipos.js` (puerta de entrada) se agregó:

```js
/** Todos los equipos vigentes (no de baja ni en papelera) con su estado. */
export async function listarEquiposConEstado({ incluirBaja = false } = {}) {
  iniciar();
  return (await listarConEstado())
    .filter(e => incluirBaja || e.ubicacion.lugar !== 'baja')
    .map(resumen);
}
```

La usan la portada y los proyectos del Sistema para no consultar equipo por equipo.

## Catálogos

Siguen siendo los temporales de `compartido/catalogos.js` (almacenes `compartido_proyectos` y `compartido_personas`). El Sistema no usa `configurarProveedorCatalogos()` todavía; solo agrega campos.

- **Proyecto:** `tiposTrabajo[]`, `comuna`, `region`, `encargadoId`, `estado` (`activo` | `cerrado`), `solicitadoPor`, `fechaEncargo`, `plazo`, `notas`.
- **Persona:** `roles[]` (`encargado`, `ayudante`, `rrhh`, `dibujo`, `direccion`).
- «Oficina» sigue con `id = 'oficina'` y no se edita.

## Datos y nube

- **Sin almacenes nuevos:** la base común no cambia de versión, así que convive sin problema con la app de Equipos en el mismo dominio.
- **Nube:** `compartido/nube.js` sin cambios (prefijos `equipos_` y `compartido_`, carpeta de prueba de Drive). El panel `app/nube-panel.js` es copia de `envoltorio-nube.js`.
- **Service worker:** caché `sistema-v0.2`, separado del de Equipos (`equipos-…`).

## Próximo: Gastos básico (después de Vuelos)

- Almacenes `gastos_gastos` y `gastos_eventos` (rendiciones).
- Agregar `'gastos_'` a `PREFIJOS` en `compartido/nube.js`.
- Boletas con `duenoTipo = 'gasto'`.
- Ruta `#/gastos` y apartado «Gastos y boletas» dentro del proyecto.

## Módulo Vuelos (Sistema v0.2)

- **Puerta de entrada:** `modulos/vuelos/vuelos.js` → `iniciar()`, `montar(contenedor, { rol, personaId, proyectoId?, planId?, tab? })`, `planesDeProyecto(proyectoId)`, `VERSION`, `ALMACENES`.
- **Almacenes:** `vuelos_planes` (índice `proyectoId`) y `vuelos_drones` (correcciones del catálogo).
  - Plan: `{ nombre, proyectoId, dronId, params, poligono: { nombre, anillo:[[lon,lat],…] } | null, resumen }`.
- **Nube:** se agregó `'vuelos_'` a `PREFIJOS` en `compartido/nube.js`.
- **Rutas del Sistema:** `#/vuelos`, `#/vuelos/plan/<id>`, `#/vuelos/proyecto/<proyectoId>`.
- **Sin librerías nuevas:** el KMZ se abre con `DecompressionStream` y el KML con `DOMParser`.
- **Servicios externos:**
  - `api.open-meteo.com` (pronóstico; uso no comercial gratis).
  - `services.swpc.noaa.gov` (Kp; si falla, se muestra sin Kp).
- **Usa las clases `sis-` del Sistema** además de `vu-` (`vuelos.css`). No está pensado para funcionar fuera del Sistema.


## Sistema v0.5
- **Seguimiento 0.1** (`modulos/seguimiento/`): puerta `seguimiento.js` con `montar(contenedor, { rol, personaId, proyectoId?, tab? })` y `resumenDeProyecto(proyectoId)`. Rutas `#/seguimiento` y `#/seguimiento/<proyectoId>[/marcar|/config]`. Reglas puras en `modelo.js` (probadas en `pruebas/seguimiento.test.mjs`).
- **Eventos de solo agregar** (`seguimiento_eventos`): `{ cicloId, planId, tramoId, tipo: terreno|prod|entrega|nota, col, valor, por }`. El estado se calcula con el último evento. **La app de Terreno**, cuando se conecte, escribirá eventos `tipo: 'terreno'` (tramo volado, con fecha y piloto) y `tipo: 'nota'`; no edita los planes.
- **Vuelos 0.4**: pantallas divididas por paso (fábricas `crearX(v)` con el contexto compartido `v`). `pronostico-widget.js` es la pieza común con Terreno.
- **compartido/**: `tooltip.js`, `deshacer.js`, `columnas.js`. Sincronizan `seguimiento_`, `terreno_`, `gastos_`.
- **app/revision.js** + `version.json`: aviso de subida incompleta.

## Sistema v0.6
- **Conexión con la app de Terreno** (`app/conexion-terreno.js` → `paquete-conexion/sistema-conexion.js`, global `SistemaConexion`):
  - La app de Terreno lo incluye y usa la base común y la nube del Sistema sin programarlas.
  - Persona vinculada en localStorage `sistema_conexion_persona`; carpeta del QR en `sistema_conexion_carpeta`.
- **Personas:** campo `codigoVinculo` (6 letras sin ambiguas). El QR es `<dirección de Terreno>?carpeta=<id>#vincular=<código>`.
- **Equipos (puerta):**
  - `reportarProblema({ equipoId, descripcion, tipo, proyectoId, personaId, origen })` y `listarAlertas({ soloActivas })`.
  - En `datos.js`, `reportarAnomalia` acepta `tipo` ('problema' | 'aviso') y `origen`; las alertas los guardan. **Avisar al chat de Equipos.**
- **Seguimiento (puerta):** `tramosDeProyecto(proyectoId)` y `marcarTramoVolado(proyectoId, tramoId, { volado, fecha, por, nota })`, que escribe eventos con `origen: 'app-terreno'`.
- **Avisos:**
  - Ruta `#/avisos` (en el menú cuenta como Inicio) y campanita `#sis-avisos`.
  - Destinatarios: rol rrhh (todos) y el encargado del proyecto (`encargadoId`).
  - Visto: localStorage `env_avisos_vistos_<personaId>`.

## Sistema v0.7
- **Vuelos 0.5**:
  - `metar.js` (estaciones cercanas desde `vendor/capas/metar-estaciones.json`, que va dentro del paquete; decodificar y comparar) y `metar-ui.js` (panel común del Sistema y del paquete de pronóstico). Ya no se llama a NOAA desde la página.
  - `redvial.js`: red vial MOP por región (`vendor/capas/redvial/indice.json` + un JSON por región, se baja a pedido) y `despegueSobreCamino()`.
  - `geom.js`: `puntoEnEje`, `cortesTransversales`, `distanciaEnEje`. `hoja.js`: `dmAKm`, `kmADm`, `distanciasCorte`, `cortesDeCorredor`, `distanciasPorBaterias`; `calcularSector` acepta `extra.despegue`.
  - Hoja: `area.dm = { texto, inicio (km), desc }`, `area.auto = { modo, cada, primer, bat }`, `area.caminos = [{ nombre, linea }]`, `metar = { texto, leidoEn }`. Sin cambio de `schemaVersion` (campos opcionales).
  - Vuelos importa la puerta de Seguimiento (`tramosDeProyecto`) para los cortes por tramos.
- **Seguimiento (puerta):** `tramosDeProyecto()` agrega `ini` y `fin` (km) por tramo.
- **Paquete de pronóstico 1.1:** METAR pegado en vez de leído; `resumen.metar` queda en lo que devuelve.
- **Paquete de conexión 1.1:** `tramosDeProyecto()` trae `ini`/`fin`.

## Sistema v0.8
- **Monografías 0.1** (`modulos/monografias/`): `monografias.js` (puerta: `montar`, `resumenDeProyecto`, `publicarMonografia`, `publicarJornada`, `subirFoto`, `estadoMonografias`), `datos.js`, `pantallas.js`, `pdf.js`, `pieza-terreno.js` (GENERADO desde Terreno con `herramientas/extraer-pieza-monografia.mjs <terreno/js>`; no editar a mano).
  - Almacenes (prefijo `terreno_`, se sincronizan): `terreno_monografias` (lo que envía Terreno; imágenes → `{ archivo: id }`), `terreno_monografias_gabinete` (versión revisada; `basadoEn`), `terreno_revisiones` (estados, solo se agregan), `terreno_jornadas`.
  - Fotos en `compartido_archivos` con `modulo: 'terreno'`, `proyectoId` y `detalle` (tipo, punto, lat, lng, hora, leyenda, autor, huella). `compartido/archivos.js` agrega `guardarArchivoDatos` y `archivosDeProyecto`, y guarda `meta.detalle`.
  - `vendor/jspdf.umd.min.js` (el mismo de Terreno) se carga solo al generar un PDF.
- **Paquete de conexión 1.2:** usa solo `modulos/monografias/datos.js` (sin pantallas ni PDF).
- **Vuelos 0.6:** `cortes.js` (forma, métodos, `generarCortes`), en `geom.js`: `ejeDePoligono`, `remuestrear`, `simplificar`, `cascoConvexo`, `rumboLadoLargo`, `cortesParalelos`, `distanciasPorSuperficie`, `anchoEn`. Hoja: `area.ejeCalc` (eje calculado en lon/lat, anchos y perfil), `area.auto` (`modo`, `cada`, `unidad`, `sup`, `unidadSup`, `n`, `rumbo`, `igual`, `bat`, `horas`, `primer`). El modo `inicio` de la v0.7 se lee como `distancia` en metros.
- **Repositorio:** desde el 2-nov `terreno/` es la app de Terreno (la publica su chat). Las ramas del Sistema parten de `main` y no tocan `terreno/` ni `config.js`.

## Sistema v0.8.1
- `app/url-terreno.js`: `resolverUrlTerreno(guardada, paginaSistema)` → dirección de la app de Terreno para el QR de «Vincular teléfono». Sin dirección guardada usa `terreno/` junto al Sistema; ignora `paquete-conexion/ejemplo.html` (valor de las versiones ≤ 0.8).
- `app/vistas.js` (`urlTerreno`) la usa. Sin cambios en módulos, datos ni en el paquete de conexión 1.2.

## Sistema v0.8.2
- **`compartido/esquema.js` (nuevo):** lista completa de almacenes e índices de la base común (`sistema_trabajo` desde la v0.21.1). `almacen.js` la registra al cargarse, en el Sistema y en el paquete de Terreno. **Regla:** todo almacén o índice nuevo de un módulo se agrega también aquí; `pruebas/esquema.test.mjs` falla si falta.
- `almacen.js`: `registrarAlmacenes` suma índices nuevos a un almacén ya registrado; `definicionesRegistradas()`; marca `globalThis.__sistemaBdEsperando` / `__sistemaBdBloqueada` mientras una apertura espera (lo usa `index.html` para el aviso «Esperando los datos»). El rechazo por bloqueo pasa de 10 s a 60 s.
- **Paquete de conexión 1.3:** `alVincular(fn)`, `explicarVinculo(codigo?)`; código del QR en `localStorage['sistema_conexion_codigo']`; `alLlegarDatos` avisa después de intentar el código pendiente.
- **Chat de Terreno:** copiar `paquete-conexion/sistema-conexion.js` en `terreno/js/`, subir el caché del `sw.js` y usar `explicarVinculo` / `alVincular` en ⚙ → Sistema.

## Sistema v0.9
- **Vuelos 0.7** (`modulos/vuelos/`):
  - `hoja.js`: `kmEnEje(area, s, L)`, `sDeKm(area, km, L)`, `desdeInicio`, `lineaEje(area)`. Campo nuevo de la hoja: `area.dm.inv` (sentido invertido: el inicio es el último vértice guardado). `geometria()` ordena los sectores en el sentido de avance y agrega `rango` (m sobre el eje) a los sectores del corredor.
  - `cortes.js`: método `medida` (`area.auto.fijos` = lista de DM en texto, `auto.cada`/`auto.unidad`), `kmCortesAMedida`, `tramosVistaPrevia`, `METODOS_LINEALES`. Método propuesto para áreas lineales: `medida` (sin cortes fijos equivale a «Por distancia»).
  - `paso-area.js` / `mapas.js` / `pantallas.js`: sentido en Forma, chips de cortes fijos, modo de dibujo `dmfijo` (clic en el eje = corte fijo, DM bajo el cursor), sectores a todo el ancho (cinta + tabla), sector elegido resaltado y encuadrado (`st.zoomSector`).
  - Sin almacenes ni índices nuevos: `compartido/esquema.js` y el paquete de conexión no cambian.
- **Monografías 0.2** (`modulos/monografias/`): `ajuste.js` (diálogo «Ajustar encuadre» y `colocarImagen`), tarjeta «Presentación de las imágenes». `herramientas/extraer-pieza-monografia.mjs` exporta además `ajusteDe`, `calcRectImagen`, `cargarImagenEl`; `pieza-terreno.js` regenerada desde Terreno 0.5.8.
- **Terreno:** sin cambios. Lo que Terreno envía con sus ajustes de imagen se ve igual en el Sistema, y el ajuste hecho en gabinete queda en la versión revisada (`terreno_monografias_gabinete`).


## Sistema v0.10
- `compartido/periodicidad.js`: `proyecto.periodicidad` (`tipo` unico|recurrente, `cada`, `unidad` mes|semana, `semana`, `desde`, `mesInicial`, `diasTerreno`, `datos` lunes|siguiente|mismo, `diasEntrega`, `hasta`), `ciclosEntre`, `cicloDelMes`, `sumarHabiles`, `restarHabiles`, `diasHabilesDesde`, `textoPeriodicidad`. Días hábiles lun–vie.
- `app/calendario.js`: `eventosEntre(desde, hasta)` (hojas de vuelo: `programa` o `fecha`, límite DGAC; proyectos: ciclos o `plazo`; Equipos: `calibracion.proxima`) y `vistaCalendario(estado)` (mes, semana, por persona). En Proyectos, botón Lista/Calendario (`env_proyectos_vista`, `env_cal_modo` en localStorage).
- Vuelos 0.8: `hoja.params.horario` `{inicio, fin, pausa, traslado}`, `jornadasNecesarias`, `minutosUtiles`; `hoja.programa` `[{fecha, dia, de, sectores, min, baterias}]`. Resumen nuevo en `vista-hojas.js`.
- Seguimiento 0.2: el ciclo guarda `entrega`, `terreno`, `diasEntrega` cuando sale de la periodicidad; `plazoCiclo` usa `ciclo.entrega` si existe.
- Sin almacenes nuevos ni cambios en el paquete de conexión (Terreno no se actualiza).


## Sistema v0.11.4 (optimización)
- `construir.sh`: `sistema-app.js` con `--minify-whitespace --minify-syntax` (sin renombrar identificadores). Los paquetes para Terreno siguen igual.
- `compartido/util.js`: `leerLS(k, d)` y `escribirLS(k, v)` (antes copiados en Vuelos y Seguimiento). El paquete de conexión no cambia (esbuild deja fuera lo que no usa).
- Vuelos 0.9.4: `calcularSector` con memoria (`WeakMap` por geometría; el resultado no se debe modificar); `cargarBase` solo si hubo cambios (`alCambiar`) o `refrescar()`. Quitados `perimetroM` y `fechaMenosHabiles`.
- Equipos: importaciones sin uso quitadas (sin cambios de comportamiento).

## Sistema v0.11.3
- **`compartido/papelera.js`:** `eliminarDefinitivo(almacen, id, { personaId })` reemplaza el registro por una marca `{ id, eliminadoEn, eliminadoPor, purgadoEn, creadoEn, creadoPor, dispositivoId }` + sellos (gana en la sincronización) y hace lo mismo con los `compartido_archivos` cuyo `duenoId` es ese id. `estaPurgado(r)`; `enPapelera` ya no lista los purgados. Como la marca conserva `eliminadoEn`, todo lo que filtra eliminados (incluida la app de Terreno) la ignora sin cambios.
- **Sistema:** acciones `purgar-proyecto` y `vaciar-papelera-proyectos` (Proyectos); Equipos `purgar` y `vaciar-papelera`.
- **Vuelos 0.9.3:**
  - `datos.js`: `planesEnPapelera`, `restaurarPlan`, `purgarPlan`; papelera en la lista de vuelos (`restaurar-hoja`, `purgar-hoja`, `vaciar-papelera-vuelos`).
  - `mapas.js`: control de medición en todos los mapas (`agregarMedir`, `pintarMedir`; distancia con `mapa.distance`, superficie en proyección local). Mientras se mide, la clase `vu-midiendo` deja pasar los clics al mapa. Capa `propuesta` (cortes por aplicar, punteados).
  - `pantallas.js`: `elegirMetodo` ya no aplica; `cortarAutomatico` arma `st.propuesta`; `aplicarCortes`; `st.respaldoCortes` guarda los cortes al entrar a editar a mano (`descartar-cortes` los repone). `h.area.aplicado = { modo, en }`.
  - `paso-area.js › htmlPropuesta`. `vista-hojas.js › htmlBateriasDia` y `miniatura` sobre `mapa-estatico.js › fondoEstatico(puntosLL, W, H)` (teselas Esri en %, `xy(lonLat)` para dibujar encima). `ui.js › COLORES_DIA`.
  - `vuelos.js › planesDeProyecto` agrega `jornadas`, `mapa` (html) y `coloresDia` para la ficha del proyecto.
- Pruebas: `mapa-estatico.test.mjs` (72 pasan). Sin almacenes nuevos; paquetes de conexión y pronóstico sin cambios (Terreno no se actualiza).

## Sistema v0.11.2
- **Vuelos 0.9.2:**
  - `redvial.js`: `recortarLinea(linea, bbox, tol)` y `simplificarLL(linea, tol)` (grados; 0,00003 ≈ 3 m). `caminosEn` recorta y simplifica al recuadro y guarda el último resultado (el mapa y la búsqueda de despegue piden el mismo). Cada camino del MOP lleva `bbox`. `despegueSobreCamino` filtra por recuadro del sector + radio, pasa a metros una vez, máx. 300 pruebas + 60 de afinado.
  - `pantallas.js`: caminos cargados → recortados a 3 km del área (sin área: solo simplificados), campo `grupo` (nombre del archivo), tope de 60.000 vértices por hoja. Acción `quitar-camino` con `data-g` (un archivo) o sin él (todos).
  - `mapas.js › pintarCaminos`: renderer `L.canvas` por mapa, capa en caché (`m.caminos = { clave, grupo }`), con más de 400 caminos MOP se agrupan por carpeta en una polilínea múltiple.
  - `geom.js › recorrerPorBaterias`: prueba las 4 partidas (`recorrerDesde`) y elige menos baterías y luego menos tiempo. `hoja.js › opcionesDespegue` con memoria (máx. 60 entradas).
- Pruebas: `caminos-formatos.test.mjs` agrega recorte y simplificación (71 pasan). Sin almacenes nuevos; paquetes de conexión y pronóstico sin cambios (Terreno no se actualiza).

## Sistema v0.11.1
- **Vuelos 0.9.1:**
  - `drones.js`: entrada `m400-l3` (familia `m400`). `equipos/sensores.js` reconoce «Matrice 400» / «M400».
  - `geom.js › recorrerPorBaterias`: con despegue, la ruta parte por la esquina más cercana (primera o última pasada, en cualquier sentido). `calculo.js` devuelve `baterias[k].fin` también en el marco local.
  - `hoja.js › opcionesDespegue(hoja, dron, geo, i)` → `[{ k, texto, xy, lonLat, minTotal, mejor }]` (inicio, cambios de batería, final, centro; calculadas con una ruta de referencia desde el centro para que no cambien al elegir). Se guarda igual que antes en `metaSector(h, i).despegue` (lon/lat).
  - `paso-vuelo.js`: tarjeta «Punto de despegue» (`#vu-desp-ops`, acción `despegue-op`) y rumbo sugerido en `#vu-lados` (`rumboMasCorto`, guardado en memoria por sector, despegue y parámetros). `mapas.js`: capa `opsDesp` con las letras.
  - `paso-area.js`: interruptor Automático/Manual (`tipo-corte`) y tarjetas para todos los métodos; se quitó el `<select>` de método. `pantallas.js › elegirMetodo(h, m)` (los manuales dejan el mapa listo para marcar).
  - `formatos.js` (nuevo): `lineasDeArchivos(files)`, `lineasDeShapefile`, `leerShp`, `nombresDbf`, `proyeccionDePrj`, `tmInversa`, `lineasDeGeoJSON`, `lineasDeGpx`. `kml.js › leerZip(buf)` reemplaza el lector de zip interno (el KMZ lo sigue usando).
- **Equipos:** `pantallas.js` tarjetas `eq-tarjeta-foto` (foto con `urlArchivo(fotoId)` cargada después de pintar), panel `.eq-lado` (solo PC) con resumen o con la vista `alta(true)`. `ficha.js` exporta `dibujo`. Sin cambios en datos ni en la puerta.
- **Pruebas:** `pruebas/caminos-formatos.test.mjs` (UTM 19S comparado con PROJ, shapefile con .dbf y .prj, GeoJSON). 69 pruebas pasan.
- **Sin almacenes ni índices nuevos;** paquete de conexión 1.3 idéntico. El paquete de pronóstico cambia (catálogo con la M400): copiado a `terreno/js/pronostico-vuelo.js` y caché de Terreno `terreno-topo-v44-0.5.8.2`.

## Sistema v0.11
- **Envoltorio (`app/sistema.js`):** menú Inicio · Proyectos · Vuelos · Equipos · Herramientas · Personas · Gastos y sub-pestañas por sección (`SUBNAV`). Rutas nuevas: `#/proyectos/calendario`, `#/proyectos/registro`, `#/sensores` (Vuelos con `tab: 'drones'`), `#/herramientas/kml` y `#/herramientas/pronostico` (Vuelos con `tab`). `#/seguimiento` y `#/monografias` siguen igual y se ven dentro de Proyectos y Herramientas. Los módulos se montan en `.sis-modulo`, debajo de la sub-barra. Vuelos ya no muestra su barra de herramientas (`ctx.conNav` la vuelve a mostrar).
- **Proyecto:** campos `etapa` (`terreno` | `gabinete` | `entregables` | `completado`) y `etapas` (`{ etapa: fecha }`). «Completado» pone `estado: 'cerrado'`. `app/catalogo.js`: `ETAPAS_PROYECTO`, `etapaProyecto(p)`.
- **Vuelos 0.9 (puerta):** `listarVuelos()` → vuelos con `etapa` (`hoja.js › etapaVuelo`: planificacion, permisos, programado, volado, log, procesado), fechas, logs y documentos pendientes.
  - Hoja (campos opcionales, sin cambio de `schemaVersion`): `mandante`, `jefe`, `ubicacion` `{ comuna, region, pais, codigoPais, auto }`, `procesado`, `permisos.zona`, `permisos.docsEstado` `{ k: { estado, vence, archivoId } }`, `permisos.logs` `[{ id, nombre, fecha, personaId, archivoId }]`. `resumen` agrega `largo` y `centro`.
  - `cerrados.js`: `cortesCerrados(poli)` y `prolongarCorte(corte, poli)`; `geometria()` prolonga los cortes cuyos extremos están sobre el borde (cortes de vértice a vértice). Métodos nuevos en `cortes.js`: `cerrados` y `vertices`.
  - `geom.js`: `pasadasPorLado`, `pasadasCorredor` con la regla de DJI; `calculo.js` devuelve `detalle` y `minRutaDji`. `drones.js`: Matrice 4E `focalMm: 12.2` (`focalFichaMm: 12.29`); una corrección guardada con 12,29 ya no pisa la nueva.
  - `ubicacion.js`: comuna y región por Nominatim (OpenStreetMap). Clima: `pedirPronostico(lat, lon, 10)` y pronóstico por tramo.
  - Archivos de permisos y logs en `compartido_archivos` (`duenoTipo: 'vuelos_hoja'`, `rol: 'documento' | 'log'`).
- **Equipos 0.2:** `sensores.js` (datos de cámara desde el catálogo de Vuelos), vista tarjetas/lista (`localStorage['eq_vista_lista']`), filtro por categoría y vista `alta` paso a paso. Sin cambios en `datos.js` ni en la puerta.
- **Monografías 0.3:** `coordenadas.js` (datums, zonas, geoides, formato DD/DMS), `croquis.js` (mapa Esri → imagen), pestañas por ficha, campos `observacionPdf`, `modulos.observacion`, `paisUTM`, `formatoGeo`, `decimalesGeo`, `firmaPropia`. Logos de clientes en `compartido_archivos` con `duenoTipo: 'cliente_logo'` y `duenoId` = nombre normalizado. Grupos «para todas las fichas» en `localStorage['mono_comun_<proyectoId>']`. `pieza-terreno.js` no cambia: la Observación se agrega al texto de la descripción al armar el PDF.
- **Sin almacenes ni índices nuevos:** `compartido/esquema.js` y el paquete de conexión 1.3 no cambian (se verificó que `paquete-conexion/sistema-conexion.js` queda idéntico). El paquete de pronóstico solo cambia en el dato de focal de la Matrice 4E; la copia de Terreno no necesita actualizarse.

## v0.17b
- Rutas nuevas: `#/proyecto/<id>/{planificacion|encargo|entregas|recursos}` (sin sufijo = Resumen). Sin cambios en IndexedDB ni en `compartido/esquema.js`.
- Paquete de conexión sin cambios (cmp con `terreno/js/sistema-conexion.js` idéntico).

## Terreno 0.6.1
- Sin cambios en el paquete de conexión ni en la base común. Terreno ahora usa también `misEquiposEnTerreno()` (lista de equipos en Registrar) y llama `publicarJornada()` al terminar la jornada sin segunda confirmación (si el teléfono está vinculado y la jornada tiene proyecto del Sistema).

## v0.18 · Estructura: proyecto por etapas, un solo KMZ, planificación en pasos
- Sin almacenes nuevos ni cambios en `compartido/esquema.js`. Campos nuevos en `compartido_proyectos`: `capas.areas [{ id, nombre, anillo, ha }]` y `planificacion { guardadoEn, guardadoPor, lineas }`. En la hoja de vuelo: `resumen.amarre.nuevosLL [{ nombre, lon, lat }]`.
- Rutas nuevas: `#/planificacion/nueva-red/<proyectoId>`, `#/planificacion/nueva-marcas/<proyectoId>`, `#/herramientas/vuelo-rapido`, `#/proyecto/<id>/terreno`. Redirigen: `#/planificacion` → `#/proyectos`; `#/planificacion/proyecto/<id>` → `#/proyecto/<id>/planificacion`.
- Módulo nuevo `modulos/planificacion/desde-proyecto.js` (semillas de red y marcas). `app/trabajos.js` suma `cronogramaSincronizado`.
- Paquete de conexión sin cambios (cmp idéntico a `terreno/js/sistema-conexion.js`).

## v0.18a · Avance por sector · paquete de conexión 1.5 · Terreno 0.7.0
- Almacén nuevo `vuelos_avance` (índices `hojaId`, `proyectoId`), agregado en `compartido/esquema.js`: eventos de solo agregar `{ hojaId, proyectoId, sector, fecha, pct, base, alturaBase, obs, personaId, origen: 'sistema'|'terreno' }`. La hoja guarda `resumen.listaSectores [{ nombre, ha }]`.
- Módulos: `modulos/vuelos/avance.js` (cálculo, sin base de datos), `modulos/vuelos/avance-datos.js` (registrar: hoja a «Volado» y tramo de Seguimiento), `Vuelos.avanceDeProyecto(pid)`.
- Paquete 1.5: `vuelosDeProyecto(proyectoId)`, `registrarAvance({ hojaId, sector, fecha, pct, base, alturaBase, obs })`, `PORCENTAJES_AVANCE`. Copiado a `terreno/js/` (cmp idéntico).
- Hoja: `permisos.omitir` y etapa `planificado`. Amarre: también los puntos de `planif_redes` del proyecto.

## v0.19 · Uso simple · paquete de conexión 1.6 · Terreno 0.8.0
- Sistema: persona y rol ya no se eligen en listas del encabezado: pantalla `#/quien` («¿Quién eres?»), rol desde `persona.roles` (`rolDePersona`: direccion > rrhh > terreno). Las listas `#sis-persona`/`#sis-rol` siguen en el HTML, ocultas, como estado (claves `env_persona`/`env_rol` sin cambios). «Ver como otro rol» en Configuración (`data-accion="ver-como"`).
- Inicio por rol con `app/hoy.js` (sin DOM, con pruebas): `agruparPendientes`, `accionPrincipal`, `semaforoProyecto`, `contarSemaforo`, `VERBO`.
- Categorías de pendientes de Administración: `Personal` (documentos), `Contratos`, `EPP`, `Ausencias`, `Cuadrilla`, `Vehículos`, `Guías`, `Comercial`.
- Paquete 1.6: `miModo()` → `{ modo: 'simple'|'completo', roles }` (simple = ayudante sin encargado); `companerosDeProyecto(proyectoId)` → `[{ id, nombre }]`; `registrarCharla({ proyectoId, tema, asistentes, otros, fecha })` escribe en `admin_seguridad` (`tipo: 'charla'`, `origen: 'terreno'`, `creadoPor` = persona vinculada). `misProyectos()` usa `genteDeProyecto` (encargado + cuadrilla). Sin almacenes nuevos. Copiado a `terreno/js/` (cmp idéntico).
- Terreno 0.8.0: `js/24-simple.js` (pestaña `simple`, `body[data-simple="1"]`); se activa al iniciar y en cada `sisRefrescar`.

## v0.20 · Checklist de terreno desde el Sistema · paquete de conexión 1.7 · Terreno 0.9.0
- `compartido/plantillas-terreno.js` (sin DOM, con pruebas): `PLANTILLAS_BASE` (las 10 de fábrica de Terreno), `TOLERANCIA_BASE`, `CATASTRO_BASE`, `PLANTILLA_DE_TRABAJO` (categoría[:detalle] → id de plantilla), `INSTRUMENTOS_DE_CATEGORIA`, `configEfectiva`, `plantillasDeTrabajos`, `instrumentosDeTrabajos`, `problemaPlantilla`.
- Configuración en `admin_config` id `terreno`: `{ plantillas, tolerancia: { verdeMm, amarilloMm }, catastro, actualizadoEn }` (`obtenerConfigTerreno` / `guardarConfigTerreno` en `modulos/administracion/datos.js`). Valores null = usar los de fábrica.
- Sistema: tarjeta `#checklist-terreno` en Configuración; formularios `plantilla-terreno` y `terreno-parametros`; acciones `plantilla-terreno-nueva|quitar|fabrica`.
- Paquete 1.7: `configTerreno()`; `checklistDeProyecto(proyectoId)` → `{ plantillas, instrumentos, tipos }`. Copiado a `terreno/js/` (cmp idéntico).
- Terreno 0.9.0: `js/25-desde-sistema.js` (`sisAplicarConfigTerreno`, `sisChecklistProyectoUI`, `sisSugerirEquipos`, `barraVolver`); `body[data-vinculado="1"]`; la jornada guarda `instrumentos` para filtrar Registrar.
