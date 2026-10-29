# Topoland · Sistema de trabajo — v0.1 (versión de prueba)

**Sistema v0.1 = envoltorio global + Equipos 0.1f** (la versión de Equipos publicada en GitHub el 28-10).

Primera versión del sistema integrado. Une en una sola app el menú por rol, los proyectos como eje y el módulo de Equipos, usando **la misma conexión a Google Drive** que ya probaste en Equipos.

## Qué trae

- **Menú por rol** (arriba): Inicio · Proyectos · Equipos · Personas, más Gastos y Libreta de terreno marcados como «pronto».
  - **Encargado de terreno:** ve sus equipos y proyectos.
  - **Administración / RRHH:** ve el panorama de la empresa.
  - Persona y rol se eligen arriba. Siguen siendo temporales: todavía no hay usuarios reales.
- **Inicio de terreno:**
  - **Equipos a mi cargo**, según el último checklist de salida.
  - Un aviso «Ojo con estos equipos» si alguno tiene la calibración vencida o una alerta abierta. Se pueden usar igual.
  - **Proyectos activos**, primero los que tienes a cargo.
- **Inicio de RRHH:**
  - Cuatro cifras: calibraciones vencidas, por vencer en 30 días, equipos con alerta y equipos en terreno.
  - Lista de calibraciones por revisar, alertas abiertas y equipos en terreno agrupados por proyecto.
  - Tocar un equipo abre su ficha en Equipos.
- **Proyectos:**
  - Datos: nombre, mandante, **tipos de trabajo** (uno o más), comuna, región, encargado y estado (activo o cerrado).
  - Encargo: quién lo pidió, fecha del encargo y plazo, con la cuenta de días.
  - Dentro de cada proyecto:
    - los **equipos que están ahí**;
    - los **certificados para el mandante**: el certificado vigente de cada equipo del proyecto, con botón para abrir su PDF.
  - «Oficina» sigue siendo el proyecto especial fijo.
  - Gastos y jornadas aparecen como «llega en v0.2 / v0.3».
- **Personas:** nombre, cargo y **roles** (una persona puede tener varios). Solo RRHH edita.
- **Equipos:** el módulo completo, igual que en su app, con sus pestañas como sub-barra. La etiqueta QR también abre la ficha dentro del Sistema.

## Cómo publicarlo (GitHub Pages)

1. Crea un repositorio nuevo, por ejemplo **`sistema`**, y sube **todo el contenido de esta carpeta**.
2. Settings → Pages → rama `main`, carpeta raíz. La dirección queda **`https://cirg95.github.io/sistema/`**.
3. **No hay que tocar Google Cloud.** El `config.js` trae el mismo Client ID de Equipos, y Google autoriza por dominio (`https://cirg95.github.io`), no por carpeta.

## Qué pasa con los datos (importante)

- **En el mismo navegador, el Sistema y la app de Equipos comparten los datos.** Las dos viven en `cirg95.github.io`, y el navegador guarda una sola base `topoland` por dominio. Lo que cargaste en `…/equipos/` aparece en `…/sistema/`, y al revés. También comparten la conexión a la nube, la persona elegida y el rol.
- **En la nube usan la misma carpeta** («Topoland Equipos (prueba)»). Tu compañero de RRHH puede seguir con la app de Equipos o pasarse al Sistema; los datos son los mismos.
- Los proyectos y personas que se crean aquí (con sus campos nuevos) también los ve la app de Equipos. Los campos que no conoce, simplemente no los muestra.
- **Sigue usando datos ficticios o poco sensibles**, como acordamos.

## Qué se está probando

1. **Abrirlo desde la dirección web** y ver que aparece todo lo que ya tenías en Equipos.
2. **Nube:** la pastilla ☁ debe decir «Al día» sin pedir carpeta de nuevo. Si dice «Reconectar», un toque.
3. **Terreno (teléfono):** crea un proyecto desde Inicio → «+ Proyecto», con tipos de trabajo y plazo. Haz una salida en Equipos → Salida hacia ese proyecto. Vuelve a Inicio: los equipos deben aparecer «a mi cargo».
4. **RRHH (PC):** en Inicio deben verse esa salida en «Equipos en terreno», las calibraciones por revisar y las alertas. En el proyecto, «Certificados para el mandante» debe listar los certificados y abrir los PDF.
5. **Que se entienda sin explicación:** muéstraselo a tu compañero y anota qué le cuesta.

## Conocido / pendiente

- **Persona y rol se eligen a mano.** No hay usuarios reales ni permisos todavía.
- **Logo y marca por empresa:** por ahora el logo es una «T». La configuración de marca llega en una versión posterior.
- **La conexión con Google dura 1 hora** (igual que en Equipos): después se toca «Reconectar».
- **El módulo Equipos incluido es el 0.1f publicado.** Si el chat de Equipos tiene cambios sin publicar (0.1g), no están aquí.
- **Cambio pequeño en Equipos:** su puerta de entrada ganó `listarEquiposConEstado()`, que usa la portada del Sistema. Hay que pasarlo al chat de Equipos para que quede también en su código (ver `INTEGRACION.md`).
- **Gastos:** Sistema v0.2. **Libreta de terreno:** Sistema v0.3.

## Para quien programa

- `app/`: envoltorio del Sistema (`sistema.js` con las rutas, `vistas.js`, `nube-panel.js`, `sistema.css`).
- `compartido/` y `modulos/equipos/`: copiados del repositorio de Equipos.
- `./construir.sh`: valida cada `.js` con `node --check` y arma `sistema-app.js` con esbuild.
- **Rutas:** `#/inicio`, `#/proyectos`, `#/proyecto/<id>`, `#/proyecto-editar/<id|nuevo>`, `#/equipos[/<equipoId>]`, `#/personas`, `#/gastos`, `#/terreno`.
