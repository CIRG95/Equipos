# INTEGRACION.md — Sistema v0.2

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
