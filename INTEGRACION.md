# INTEGRACION.md — Sistema v0.9

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

- **Sin almacenes nuevos:** la base `topoland` no cambia de versión, así que convive sin problema con la app de Equipos en el mismo dominio.
- **Nube:** `compartido/nube.js` sin cambios (prefijos `equipos_` y `compartido_`, carpeta «Topoland Equipos (prueba)»). El panel `app/nube-panel.js` es copia de `envoltorio-nube.js`.
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
- **Conexión con la app de Terreno** (`app/conexion-terreno.js` → `paquete-conexion/topoland-conexion.js`, global `TopolandConexion`):
  - La app de Terreno lo incluye y usa la base `topoland` y la nube del Sistema sin programarlas.
  - Persona vinculada en localStorage `topoland_conexion_persona`; carpeta del QR en `topoland_conexion_carpeta`.
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
- **`compartido/esquema.js` (nuevo):** lista completa de almacenes e índices de la base `topoland`. `almacen.js` la registra al cargarse, en el Sistema y en el paquete de Terreno. **Regla:** todo almacén o índice nuevo de un módulo se agrega también aquí; `pruebas/esquema.test.mjs` falla si falta.
- `almacen.js`: `registrarAlmacenes` suma índices nuevos a un almacén ya registrado; `definicionesRegistradas()`; marca `globalThis.__topolandBdEsperando` / `__topolandBdBloqueada` mientras una apertura espera (lo usa `index.html` para el aviso «Esperando los datos»). El rechazo por bloqueo pasa de 10 s a 60 s.
- **Paquete de conexión 1.3:** `alVincular(fn)`, `explicarVinculo(codigo?)`; código del QR en `localStorage['topoland_conexion_codigo']`; `alLlegarDatos` avisa después de intentar el código pendiente.
- **Chat de Terreno:** copiar `paquete-conexion/topoland-conexion.js` en `terreno/js/`, subir el caché del `sw.js` y usar `explicarVinculo` / `alVincular` en ⚙ → Sistema.

## Sistema v0.9
- **Vuelos 0.7** (`modulos/vuelos/`):
  - `hoja.js`: `kmEnEje(area, s, L)`, `sDeKm(area, km, L)`, `desdeInicio`, `lineaEje(area)`. Campo nuevo de la hoja: `area.dm.inv` (sentido invertido: el inicio es el último vértice guardado). `geometria()` ordena los sectores en el sentido de avance y agrega `rango` (m sobre el eje) a los sectores del corredor.
  - `cortes.js`: método `medida` (`area.auto.fijos` = lista de DM en texto, `auto.cada`/`auto.unidad`), `kmCortesAMedida`, `tramosVistaPrevia`, `METODOS_LINEALES`. Método propuesto para áreas lineales: `medida` (sin cortes fijos equivale a «Por distancia»).
  - `paso-area.js` / `mapas.js` / `pantallas.js`: sentido en Forma, chips de cortes fijos, modo de dibujo `dmfijo` (clic en el eje = corte fijo, DM bajo el cursor), sectores a todo el ancho (cinta + tabla), sector elegido resaltado y encuadrado (`st.zoomSector`).
  - Sin almacenes ni índices nuevos: `compartido/esquema.js` y el paquete de conexión no cambian.
- **Monografías 0.2** (`modulos/monografias/`): `ajuste.js` (diálogo «Ajustar encuadre» y `colocarImagen`), tarjeta «Presentación de las imágenes». `herramientas/extraer-pieza-monografia.mjs` exporta además `ajusteDe`, `calcRectImagen`, `cargarImagenEl`; `pieza-terreno.js` regenerada desde Terreno 0.5.8.
- **Terreno:** sin cambios. Lo que Terreno envía con sus ajustes de imagen se ve igual en el Sistema, y el ajuste hecho en gabinete queda en la versión revisada (`terreno_monografias_gabinete`).

