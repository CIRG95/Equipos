# Topoland · Sistema de trabajo — v0.8.2 (Sistema y Terreno en el mismo teléfono)

## Qué cambia en v0.8.2
- **Arreglo:** con Terreno abierto en el mismo teléfono (aunque en segundo plano), el Sistema podía quedar en «El Sistema no cargó». Ambas apps comparten la base `topoland`; Terreno la creaba solo con sus partes y el Sistema tenía que agrandarla, esperando a que Terreno la soltara (en Android una app en segundo plano está congelada). Ahora hay un **esquema común** (`compartido/esquema.js`) que ambas crean completo desde el principio.
- **Aviso claro** si aun así la base está ocupada: «Esperando los datos… ciérrala desde las apps recientes»; el Sistema termina de cargar solo apenas se suelta. El aviso genérico ya no menciona solo el computador.
- **Paquete de conexión 1.3:** base completa, código del QR guardado en el teléfono, vinculación automática al llegar los datos de la nube, `alVincular` y `explicarVinculo` (ver `paquete-conexion/LEEME.md`). **Hay que copiarlo en Terreno** (lo hace su chat).
- `almacen.js`: si un módulo agrega un índice a un almacén ya registrado, se suma (antes se ignoraba). Prueba `esquema.test.mjs`: avisa si un módulo registra algo que no está en el esquema. 40 pruebas.

---

## Versión anterior: v0.8.1 (QR de vincular hacia la app de Terreno)

## Qué cambia en v0.8.1
- **Vincular teléfono:** el QR abre por defecto la app de Terreno publicada junto al Sistema (`terreno/`), ya no la página de prueba `paquete-conexion/ejemplo.html`. No hay que escribir la dirección.
- Si se escribió otra dirección, se respeta. Una dirección guardada que apunte a la página de prueba se ignora.
- Pieza nueva `app/url-terreno.js` (`resolverUrlTerreno`) con 3 pruebas (`pruebas/url-terreno.test.mjs`; total 37).

---

## Versión anterior: v0.8 (Monografías desde Terreno y sectores por eje)

**Sistema v0.8 = v0.7 + Monografías 0.1 + Vuelos 0.6 + paquete de conexión 1.2.** Se sube igual que antes: todo menos `config.js`. **No borrar la carpeta `terreno/`** del repositorio (es la app de Terreno, la publica su chat).

## Qué cambia en v0.8
- **Monografías (nuevo, menú «Monografías» y tarjeta en la ficha del proyecto):**
  - Por proyecto llegan desde la app de Terreno las monografías, las jornadas y las fotos (paquete de conexión 1.2, botón «Enviar al Sistema» en Terreno).
  - Lista de vértices con estado: enviada → en revisión → lista, o con observación (el encargado la ve en Terreno). Faltantes por monografía.
  - Ficha con los mismos campos de Terreno: elegir fotos de terreno para el croquis, la panorámica y las fotos adicionales; coordenadas finales del postproceso; descripción, operador y revisó; qué secciones van en el PDF; chequeo ✔ – ! ?.
  - Si Terreno vuelve a enviar una monografía ya revisada, aparece «Terreno envió cambios» con «Usar la de Terreno».
  - **PDF idéntico al de Terreno:** el formato, el chequeo y el PDF se copiaron sin cambios del código de Terreno 0.5.6 (`modulos/monografias/pieza-terreno.js`, generado con `herramientas/extraer-pieza-monografia.mjs`). Uno por vértice o todos juntos. Logo de la empresa por computador.
  - Las monografías creadas en gabinete también se pueden hacer aquí.
- **Vuelos 0.6 · paso Área con sub-pestañas:** Origen · Forma · Sectores · Zonas y caminos, una tarjeta a la vez al lado del mapa (más alto y fijo).
  - **Forma:** detecta un **área lineal** y calcula su **eje** (línea media entre los dos bordes) con largo y ancho mín./prom./máx. Se puede volar como polígono por sectores o como **corredor sobre el eje**. DM del inicio del eje.
  - **Cortes con menú desplegable de método:** área lineal → por distancia (cada X m/km), por superficie (cada X ha/km²), alineados al DM, tramos del Seguimiento; cualquier área → en N sectores (cortes paralelos de igual superficie, con rotación ⟲ ⟳ y «Lado más largo»), por baterías, por días de vuelo; manual. Propone el método según la forma y muestra una vista previa.
  - Los sectores de un área lineal quedan en el orden del eje y nombrados por DM.
- **Paquete de conexión 1.2:** `publicarMonografia`, `publicarJornada`, `subirFoto`, `estadoMonografias` (ver `paquete-conexion/LEEME.md`).
- **Pruebas:** 34 automáticas (nuevas: área lineal, cortes por método, cortes paralelos, rendimiento con 130 km y 20.000 vértices) y en navegador: Terreno → Sistema (publicar, revisar, observación, PDF).

---

# v0.7 (Vuelos: METAR, cortes del corredor y despegue en camino)

**Sistema v0.7 = v0.6 + Vuelos 0.5.** Se sube igual que antes: todo menos `config.js` (el tuyo se queda como está).

## Qué cambia en v0.7
- **METAR (opción A, copiar y pegar):**
  - El paso Clima, el Pronóstico rápido y el paquete de pronóstico muestran los **3 aeródromos con METAR más cercanos** (lista de NOAA, 77 en Chile): distancia, dirección, altura y enlaces a AIP Chile, MeteoChile y NOAA (texto).
  - Avisa «solo referencia» si el aeródromo está a más de 50 km o con más de 500 m de diferencia de altura.
  - Se **pega el METAR (y el TAF)** y la app lo lee: viento y ráfaga en m/s, dirección, visibilidad, nubes y techo, fenómenos, temperatura y rocío, QNH, hora del reporte y antigüedad, categoría VFR/MVFR/IFR/LIFR. Lo compara con los límites del dron y con el pronóstico de esa hora.
  - Queda guardado en la hoja, en el Resumen y en la hoja para terreno (PDF).
  - Por qué no se lee solo: NOAA no permite leerlo desde otra página (CORS) y AIP Chile y MeteoChile no tienen API. La opción B (un intermediario propio) queda para después.
- **UAS Control** (uascontrol.io) en Permisos → consultas, con registro y captura como NOTAM y AIP.
- **Cortes automáticos del corredor** (Área → «Cortes automáticos»):
  - **DM del inicio del eje** y si el DM baja hacia el final.
  - Modos: cada X m desde el inicio · **alineados al DM** (11+000, 12+000… o desde un primer DM) · **tramos del Seguimiento** del proyecto de la hoja · **por baterías** (máximo de baterías por sector).
  - Con el DM, los sectores se nombran por su tramo (10+300 – 11+000). Los cortes generados se arrastran o quitan igual que los manuales.
- **Caminos y despegue sugerido:**
  - **Red vial del MOP** (Dirección de Vialidad, gdb del 31-oct-2026) como capa de los mapas, por región: se baja solo la región del área (`vendor/capas/redvial/`, 17 archivos). Colores por carpeta (pavimento, ripio, suelo natural).
  - **Caminos propios** de la hoja: dibujados o cargados desde KML/KMZ (huellas y accesos que no están en la red).
  - Paso Vuelo → **«Despegue sugerido»**: prueba puntos de los caminos a menos de 1,5 km del sector y propone el de menos tiempo de jornada, con rol, carpeta, distancia al sector y ahorro; «Usar» lo deja como despegue. Para un sector o todos. **Es solo una referencia**: acceso, rejas, permisos y línea de vista se confirman en terreno.
- **Puertas:** `Seguimiento.tramosDeProyecto()` ahora trae `ini` y `fin` (km) de cada tramo. Paquete de conexión 1.1 (mismo cambio).
- **Pruebas:** 26 pruebas automáticas (nuevas: METAR y corredor/despegue).

---

# v0.6 (conexión con la app de Terreno)

**Sistema v0.6 = v0.5 + vincular teléfono + avisos de equipos + paquete de conexión para Terreno.**

## Qué cambia en v0.6
- **Vincular teléfono** (Personas → «Vincular teléfono»):
  - Cada persona tiene un **código de 6 letras** y un **QR**.
  - El QR abre la app de Terreno con la carpeta de la nube y el código, y el teléfono queda vinculado a esa persona: sus proyectos (donde es encargado) y sus equipos en terreno.
  - «Cambiar código» invalida el anterior. Es provisorio, hasta que existan usuarios.
  - **Dirección de la app de Terreno:** por defecto es la app publicada junto al Sistema (`terreno/`); solo se escribe si Terreno está en otra dirección. Una dirección guardada que apunte a la página de prueba `paquete-conexion/ejemplo.html` (versiones ≤ 0.8) se ignora.
- **Avisos de equipos:**
  - Desde terreno, botón **Problema o Aviso** sobre un equipo que salió a terreno. Queda como alerta del equipo (`tipo`: problema | aviso, `origen`: app-terreno).
  - Lo ven **el encargado del proyecto**, en la **campanita** arriba y en la bandeja `#/avisos`, y **Administración**, que ve todos y además los tiene en Equipos → Alertas.
  - «Nuevo» se marca como visto al abrir la bandeja, por persona y por equipo.
  - No hay notificaciones instantáneas: llega con la sincronización.
- **Paquete de conexión** (`paquete-conexion/`): `topoland-conexion.js` (global `TopolandConexion`), con `ejemplo.html` y `LEEME.md` para el chat de Terreno. Funciones:
  - vincular y ver la persona vinculada;
  - mis proyectos y mis equipos en terreno;
  - reportar;
  - tramos y marcar tramo volado;
  - conectar la nube y sincronizar.
- **Seguimiento:** los tramos marcados desde Terreno llegan como eventos a la columna Terreno, con quién y la fecha.
- **Menú:** se quitó «Libreta de terreno», porque Terreno sigue como app aparte.
- **Puertas nuevas:**
  - `Equipos.reportarProblema()` y `Equipos.listarAlertas()`. El cambio en `datos.js` es solo que `reportarAnomalia` acepta `tipo` y `origen`; hay que avisar al chat de Equipos.
  - `Seguimiento.tramosDeProyecto()` y `Seguimiento.marcarTramoVolado()`.

---

# v0.5 (Seguimiento + Vuelos optimizado)

**Sistema v0.5 = envoltorio global + Equipos 0.1f + Vuelos 0.4 + Seguimiento 0.1.**

## Cómo subirlo
- Desde ahora la versión se sube **directo al repositorio** desde Claude, en una rama, con un *pull request* que se acepta con un clic en GitHub. Ya no hay que subir carpetas a mano.
- Si se sube a mano: **todas las carpetas** (`app/`, `compartido/`, `modulos/`, `vendor/`, `pruebas/`, `paquete-pronostico/`) más los archivos de la raíz. **No reemplazar `config.js`.**
- **Aviso nuevo:** si al sitio le falta un archivo o la versión publicada no calza con la pantalla, la app muestra un aviso naranjo arriba con lo que falta.

## Qué cambia en v0.5
### Seguimiento de entregas (módulo nuevo, menú «Seguimiento»)
- **Un seguimiento por proyecto.** Puede ser mensual (un ciclo por mes, con el N° de mes del contrato, que arma el nombre de carpeta, por ejemplo `012 Octubre`) o un trabajo único.
- **Tramos desde los nombres de carpeta:** pega las rutas copiadas del explorador («Copiar como ruta»). Se leen el número y los DM.
- **Pestaña Seguimiento:**
  - Indicadores y franja kilométrica con dos barras. **Terreno:** verde volado, naranjo falta. **Gabinete:** naranjo falta, azul procesando, verde cargado en entrega; rayado si aún no se vuela.
  - Al pasar el mouse se ve la fecha, quién, la nota y el estado de cada producto. Abajo, «Qué falta» en palabras.
- **Pestaña Marcar avance:**
  - Tabla de tramos × productos. Cada toque avanza falta → procesando → listo.
  - Columnas que se **arrastran para moverlas** y cuyo **borde se arrastra para el ancho**.
  - Selección de varios tramos, entregas E1, E2…, y la nota como **papelito** al final de la fila (cuadro en blanco si no hay).
  - **Deshacer** en cada cambio.
- **Revisar carpeta del mes (PC, Chrome o Edge):** eliges la carpeta y se marca listo lo que ya está, según la carpeta del tramo y la extensión de cada producto. Solo lee los nombres de archivo y no sube nada; Chrome dice «subir», pero no sale del PC.
- **Pestaña Configurar:**
  - Columnas: agregar o quitar productos con su extensión, cambiar nombre y orden, mostrar u ocultar.
  - Áreas y tramos.
  - Plazo: días hábiles desde la llegada de los datos, dentro de un mes, o sin plazo.
  - «+ Nuevo mes» copia los tramos sin avance.
- **Ficha del proyecto:** tarjeta «Seguimiento de entregas» con el avance y el plazo.
- **Datos:**
  - Se guarda en la base común con eventos de solo agregar (`seguimiento_planes`, `seguimiento_ciclos`, `seguimiento_eventos`, `seguimiento_entregas`) y se sincroniza con la nube.
  - Al crear un seguimiento se puede cargar un ejemplo ficticio para probar.

### Vuelos 0.4 (optimización)
- `pantallas.js` (1.262 líneas) quedó dividido en un archivo por paso:
  - `vista-hojas.js`
  - `paso-area.js`
  - `paso-vuelo.js`
  - `paso-clima.js`
  - `paso-permisos.js`
  - `herramientas.js`
  - `mapas.js`
  - `ui.js`

  El núcleo quedó en 436 líneas.
- El paso Clima usa el mismo análisis que el **paquete del pronóstico para la app de Terreno** (`pronostico-widget.js`). Así no hay dos versiones.
- «Más corto» quedó en un solo lugar (`hoja.js`).
- **Mapa base configurable** con el botón «Mapa» en cada mapa:
  - **Satélite Esri:** si en `config.js` agregas `esriClave: '…'` (cuenta gratuita de ArcGIS Location Platform), usa el servicio con clave. Sin clave, el de siempre.
  - **Sentinel-2 2016:** libre, CC BY 4.0, 10 m por píxel. Respaldo si Esri no carga.
- Arreglo encontrado por las pruebas: dos áreas con el mismo primer y último vértice podían compartir el cálculo guardado.

### Piezas comunes nuevas (`compartido/`)
- `tooltip.js`: globo al pasar el mouse.
- `deshacer.js`: aviso con «Deshacer».
- `columnas.js`: columnas que se mueven y cambian de ancho.
- `data-solo-pc` y `data-solo-telefono` ya ocultan lo que corresponde.
- La nube sincroniza también los prefijos `seguimiento_`, `terreno_` y `gastos_`.

### Armado (`construir.sh`)
1. Revisa la sintaxis.
2. Corre **16 pruebas de cálculo** (`pruebas/`); si alguna falla, no arma.
3. Arma `sistema-app.js`.
4. Pone la versión en `sw.js`.
5. Genera `version.json`.
6. Rearma `paquete-pronostico/pronostico-vuelo.js` para la app de Terreno.

---

# v0.4 (hojas de vuelo)

**Sistema v0.4 = envoltorio global + Equipos 0.1f + Vuelos 0.3.**

## Qué cambia en v0.4: Vuelos se ordena en **hojas de vuelo**
Cada trabajo de vuelo es una hoja con su encabezado: fecha, piloto, dron, GSD y altura. Debajo hay 6 indicadores: área, vuelo, ventana GO, ráfaga máxima, Kp y luz, y permiso DGAC. La hoja tiene un **Resumen** y cuatro pasos (✓ = listo, ! = revisar).

La hoja **se guarda sola** al cargar el área o al ponerle nombre. Arriba del módulo hay cuatro pestañas: **Hojas de vuelo**, **Pronóstico rápido** (sin hoja), **Limpiar KML** y **Drones**. Los planes de la v0.3 se abren como hojas sin perder nada.

1. **Área**
   - Cargar KML/KMZ, **dibujar el área** o **dibujar un eje**.
   - Si el archivo trae una **línea abierta**, pregunta si es el **eje de un corredor** o si hay que cerrarla como contorno.
   - **Margen hacia afuera:** de 0 a 100 m, con accesos rápidos a 20, 30 y 50 m, y esquinas rectas o redondeadas. El polígono del mandante queda guardado tal cual.
   - **Corredor:** ancho hacia la izquierda y la derecha (o el mismo a los dos lados), con la opción de invertir. Las pasadas siguen el eje.
   - **Sectores:**
     - Con «Trazar corte» se divide el área a mano siguiendo un camino o una quebrada. Los vértices del corte se arrastran.
     - Cada sector tiene nombre, hectáreas, baterías y tiempo, y su KML.
     - Si el área es grande (más de 6 baterías, o parte del recorrido fuera del alcance de una batería), aparece **«Dividir en sectores»**.
   - **Zonas de referencia:**
     - Viene incluida la capa de **aeródromos** (774, del visor de Vuelatudrone). Dice a qué distancia queda el más cercano o si el área lo toca.
     - Se pueden cargar más capas (KMZ, KML o JSON): zonas restringidas, áreas protegidas o caminos.
     - Es referencial: lo oficial es AIP Chile.
2. **Vuelo:** el planificador de la v0.3 con estos cambios:
   - **Un sector a la vez**, con el total de la hoja arriba.
   - **Despegue y rumbo propios** para cada sector.
   - **Las líneas largas se reparten entre baterías:** antes una línea más larga que una batería sumaba una batería entera; ahora la batería siguiente retoma desde donde quedó la anterior.
   - **Leyenda compacta dentro del mapa:** hasta 6 baterías a la vista; si son más, queda plegada en una línea.
   - **Corredor:** simula las pasadas, el tiempo y las baterías, y descarga el **eje limpio para el modo corredor de DJI Pilot 2**.
3. **Clima**
   - Gráfico por hora: barra de viento a 120 m con el color del estado, línea de ráfaga, banda con la diferencia entre modelos y límites del dron.
   - Debajo, filas de dirección, lluvia, nubes, temperatura y Kp.
   - **Checklist meteorológico** sobre la ventana GO.
   - **METAR/TAF** del aeródromo con reporte más cercano (NOAA). Si no responde, deja el enlace para revisarlo a mano.
   - **Viento medido en terreno** con el anemómetro.
4. **Permisos y consultas**
   - Solicitud DGAC por etapas (preparada, enviada, aprobada, vigente hasta) y el número.
   - Avisa si se envió con menos de 7 días hábiles y calcula la fecha límite.
   - Checklist de documentos.
   - Para **NOTAM** y **mapa AIP**: «Marcar revisado», que guarda fecha y persona, y «+ Captura».

**Hoja para terreno (PDF):** abre la impresión con los datos, un esquema del área (sectores, líneas por batería, despegues, norte y escala), una tabla por sector con las coordenadas de despegue, el clima, el checklist, los permisos y una tabla en blanco para el viento medido. En el teléfono o el PC, elige «Guardar como PDF».

**Limpiar KML** también acepta líneas: corrige la altura, los vértices repetidos y el exceso de vértices, y descarga **la línea limpia**. Con «Nueva hoja» crea una hoja de vuelo con ese elemento. Lee mejor los archivos de Global Mapper (coordenadas con espacios).

### Cómo actualizar desde la v0.3
**Importante:** la subida de la v0.3 quedó a medias, porque solo se actualizaron los archivos de la raíz. Esta vez:
1. Descomprime el zip **en el PC**.
2. En `github.dev/CIRG95/Equipos`, arrastra **todo el contenido, carpetas incluidas** (`app`, `compartido`, `modulos`, `vendor`) y acepta reemplazar. No borres tu `config.js`.
3. Haz **Commit & Push**.
4. Revisa que debajo de «Topoland» diga **v0.4** y que el encabezado sea blanco.

### Qué probar
1. Un KMZ real de Global Mapper que antes fallara en el control: descargarlo limpio y cargarlo en DJI Pilot 2.
2. Margen de 30 m más un corte por un camino: comparar el tiempo por sector con DJI Pilot 2.
3. Un eje de canal o camino como corredor, y llevar el eje limpio al modo corredor del control.
4. El pronóstico y el METAR de un día real; anotar el viento medido.
5. Imprimir la hoja como PDF desde el teléfono.

### Conocido / pendiente
- Las capas de zonas restringidas o prohibidas y de áreas protegidas no vienen incluidas: hay que cargarlas (ideal: los JSON del visor de Vuelatudrone).
- METAR desde NOAA: si el servicio no deja consultarlo desde la página, aparece el enlace. Hay que probarlo en terreno.
- El tiempo por batería supone el recorrido en zigzag; DJI Pilot 2 puede ordenar distinto.
- El GSD sigue siendo sobre el punto de despegue (sin modelo de elevación).

---

## Versión anterior: Topoland · Sistema de trabajo — v0.3 (paquete de mejoras)

**Sistema v0.3 = envoltorio global + Equipos 0.1f + Vuelos 0.2.**

## Qué cambia en v0.3

### Estética de los bocetos
- Fondo crema, tarjetas blancas con borde fino y letra IBM Plex. La letra viene incluida en `vendor/fuentes/`, así que funciona sin internet.
- **Color de marca** azul petróleo por defecto. Se cambia en **Personas → Empresa**, junto con el nombre que aparece arriba. Por ahora se guarda en cada equipo; cuando el Sistema esté en el Nextcloud de la empresa lo define RRHH para todos.
- **En PC:** encabezado blanco con las secciones subrayadas y contenido en dos columnas: lo principal al centro y una columna lateral.
- **En el teléfono:** menú abajo con íconos (Inicio, Proyectos, Equipos, Vuelos, Más). Gastos, Libreta y Personas van en «Más».
- Las pestañas de Equipos y Vuelos quedan como sub-barra arriba en los dos modos.
- La ficha de proyecto sigue el boceto: ruta, título y datos en una línea; al centro los planes de vuelo y las jornadas; al costado los equipos, los certificados y los gastos.

### Tipos de trabajo por categoría
- Categorías: Dron, Nivelación, GNSS, Estación total, Escaneos, Batimetría y Otro. Al marcar una aparece su **detalle opcional**:
  - Dron: aerofotogrametría, LiDAR o termografía.
  - Nivelación: simple o cerrada.
  - GNSS: RTK, estático o red geodésica.
  - Estación total: levantamiento, poligonal, replanteo, cubicación o catastro.
  - Escaneos: estático (FARO) o móvil (SLAM).
  - Batimetría: con bote.
  - Otro: GPR o texto libre.
- En las listas se ven solo las categorías; en la ficha del proyecto, con su detalle.
- Los proyectos creados antes se leen solos con las categorías nuevas y quedan guardados así al editarlos.

### Vuelos 0.2: planificador interactivo
- **Deslizadores:**
  - GSD y altura van enlazados: mueves uno y cambia el otro.
  - También hay deslizadores para los traslapes y la velocidad.
  - El valor se puede escribir encima del deslizador.
  - La velocidad parte en la sugerida; si la mueves, aparece «usar la sugerida» para volver a ella.
- **Dron y sensor:** un solo «DJI Matrice 300 RTK» y aparte el **Sensor** (Zenmuse L2 o L1).
- **Mapa Esri híbrido siempre visible:**
  - Las **líneas se colorean por batería** y la leyenda muestra los minutos de cada una.
  - El **punto de despegue** se arrastra; el tiempo incluye ir y volver desde él en cada batería.
  - Botones del mapa: ⟲ 5°, ⟳ 5°, **Girar 90°**, **Más corto** (prueba todos los rumbos y deja el de menos tiempo) y **Auto**.
  - **Dibujar en el mapa:** marcas los vértices tocando el mapa y luego Terminar. Sirve cuando no hay KMZ.
- **Opciones por GSD:**
  - Tabla de 3,0, 2,5, 2,0 y 1,5 cm, más el GSD actual y los que agregues con «+ GSD».
  - Muestra la altura y el tiempo de vuelo y las baterías a **dos velocidades editables** (5 y 10 m/s por defecto).
  - Las filas sobre 120 m quedan marcadas por la DGAC; con * se marca lo que va sobre la velocidad sugerida.
  - **Copiar para correo** y **Descargar Excel**. Con «usar» ese GSD pasa al plan.
- El botón ahora dice **«Descargar KML»**: el archivo sirve para DJI Pilot 2, Google Earth u otro programa.
- **Limpiar KML** muestra los polígonos del archivo en el mapa, numerados.
- **Pronóstico:**
  - Eliges dónde consultar: **Plan** (de la lista de planes con área, incluido el que estás armando), **Mi ubicación** o **Coordenadas**. Se muestra el plan elegido y el lugar consultado.
  - Se arregló **«Sol: — – —»**: ahora muestra la salida y la puesta del sol.
  - **Kp:** se lee en los dos formatos que entrega NOAA y aparece el «Kp máx.» del día. Si NOAA no responde, se avisa debajo de la tabla.

### Otros arreglos
- En Vuelos, las unidades (ha, %, m/s) se iban debajo de los campos y el texto se veía chico.
- El aviso flotante tapaba el menú de abajo en el teléfono.

### Cómo actualizar desde v0.2a
En `github.dev/CIRG95/Equipos`:
1. Arrastra todo el contenido del zip (trae la carpeta nueva `vendor/fuentes`) y acepta reemplazar. **No borres tu `config.js`**: el zip no lo trae.
2. Haz **Commit & Push**.
3. En el teléfono o en el PC, recarga una vez; si sigue la versión anterior, cierra la app y ábrela de nuevo (la caché ahora se llama `sistema-v0.3`).

### Qué probar
1. Un KMZ real: compara las líneas, el tiempo y las baterías con DJI Pilot 2, moviendo el despegue a donde realmente despegas.
2. La tabla de opciones por GSD contra tu tabla de «El Pimiento». Ojo: tu tabla daba alturas de unos 99 m por cada cm de GSD y el Matrice 4E (gran angular) da unos 37,5 m. Revisa con qué dron y cámara se hizo.
3. El pronóstico desde un plan guardado: que salgan el sol y el Kp.
4. Crear o editar un proyecto con categorías y detalle.

### Conocido / pendiente
- El color y el nombre de la empresa se guardan por equipo (hasta pasar a Nextcloud).
- El tiempo por batería supone el recorrido en zigzag por las líneas; DJI Pilot 2 puede ordenar distinto.
- El GSD sigue sobre el punto de despegue (sin modelo de elevación).
- Cambié `modulos/equipos/equipos.css` solo en colores, para la paleta nueva. Hay que avisarle al chat de Equipos, junto con `listarEquiposConEstado`.

---

## Versión anterior: Sistema v0.2a (mapa en Vuelos)

**Sistema v0.2a = envoltorio global + Equipos 0.1f + Vuelos 0.1a.**

## Qué cambia en v0.2a
- **Mapa satelital híbrido de Esri en Planificar**, en lugar del dibujo esquemático. Es la misma imagen que usa Terreno Topografía, con nombres de lugares y caminos encima.
  - Muestra el contorno del área (naranjo) y las líneas de vuelo (celeste), así se ve dónde queda el trabajo.
  - Al cambiar el GSD, los traslapes o el rumbo, las líneas se actualizan sin perder el zoom.
  - Se puede mover y hacer zoom con los dedos o el mouse.
- Leaflet 1.9.4 va incluido en `vendor/leaflet/`, así que la app no depende de internet para cargarlo. **La imagen satelital sí necesita conexión.** Sin conexión se ve el fondo gris con el polígono y las líneas.

### Cómo actualizar desde v0.2
En `github.dev/CIRG95/Equipos`, arrastra todo el contenido del zip (trae la carpeta nueva `vendor/leaflet`), acepta reemplazar y haz **Commit & Push**.

---

## Versión anterior: Sistema v0.2 (Vuelos)

**Sistema v0.2 = envoltorio global + Equipos 0.1f + Vuelos 0.1.**

## Qué cambia en v0.2: nuevo módulo **Vuelos**
Está en el menú de **Encargado de terreno**, y también dentro de cada proyecto («+ Planificar vuelo»). Tiene cinco pestañas:

1. **Planificar**
   - Cargas el KMZ/KML del área (o escribes las hectáreas) y eliges el dron: Matrice 4E, M300 + L2, M300 + L1 o Phantom 4 RTK.
   - Defines el GSD objetivo (o la altura), los traslapes y, si quieres, la velocidad y el rumbo de las líneas.
   - Calcula: altura, GSD, huella de la foto, separación entre líneas, cantidad de líneas, distancia, fotos, intervalo de disparo, tiempo en el aire, **vuelos/baterías** y la **jornada de vuelo**.
   - Con L1/L2 en modo LiDAR, calcula el ancho de barrido y la **densidad de puntos**.
   - La velocidad sugerida es la menor entre la máxima del dron, la que evita que la foto se arrastre (½ píxel) y la que permite a la cámara disparar a tiempo.
   - Avisa si algo no cuadra (por ejemplo, altura sobre 120 m).
   - Muestra una vista esquemática del polígono con las líneas de vuelo.
   - **Guardar plan** dentro de un proyecto, **descargar el KML limpio** y **ver el pronóstico** del lugar.
2. **Limpiar KML**
   - Revisa el archivo que te enviaron: varios elementos, altura, hoyos, contorno abierto, vértices repetidos, demasiados vértices, cruces y coordenadas que no son lat/lon.
   - Descarga **cada polígono como un KML limpio para DJI Pilot 2**: un solo contorno, sin altura, cerrado y simplificado hasta el máximo de vértices que elijas (200 por defecto).
   - Las polilíneas de AutoCAD se cierran como polígono.
   - Los cruces se avisan pero no se corrigen solos.
3. **Pronóstico**
   - Hora a hora, por 3 días, para unas coordenadas, tu ubicación o el centro del polígono.
   - Viento a 120 m (promedio de ECMWF, GFS e ICON, con el rango entre ellos), ráfaga estimada, dirección, lluvia, nubes, temperatura, altura del sol e índice Kp.
   - Cada hora queda en **GO / Marginal / NO / Sin luz** según los límites del dron, y se marca la mejor **ventana GO** del día.
   - Incluye enlaces a NOTAM y al mapa de AIP Chile, UAS Control, Vuelatudrone y Windy.
4. **Planes guardados**: para abrirlos o eliminarlos.
5. **Drones**: los datos de cámara y vuelo usados en los cálculos son **valores de referencia de las fichas técnicas**. Revísalos con tus equipos; si corriges uno, se usa tu valor. Los Mavic 2 Enterprise no están porque son solo para termografía.

En cada **proyecto** aparece la sección **«Planes de vuelo»**, con los planes guardados.

### Qué se está probando
1. Cargar un KMZ real de un trabajo y comparar el resultado (líneas, fotos, tiempo y baterías) con lo que da DJI Pilot 2 para el mismo polígono.
2. Llevar un KML limpio al control y confirmar que lo lee a la primera.
3. Comparar el pronóstico de un día con lo que midas en terreno con el anemómetro.
4. Revisar en «Drones» los datos de cada equipo (sobre todo la autonomía real).

### Conocido / pendiente
- El pronóstico usa **Open-Meteo**, gratis para uso no comercial. Si la empresa lo adopta, hay que contratar su plan pagado.
- El GSD se calcula sobre el punto de despegue: **no considera el desnivel del terreno** (llegará con un modelo de elevación).
- Aún no hay mapa con zonas restringidas, METAR, registro de NOTAM ni seguimiento del permiso DGAC: van en la próxima versión de Vuelos.
- El cálculo es una estimación para planificar y cotizar; el vuelo se programa en DJI Pilot 2.

### Cómo actualizar desde v0.1a
En `github.dev/CIRG95/Equipos`, arrastra **todo el contenido** del zip (trae la carpeta nueva `modulos/vuelos`), acepta reemplazar y haz **Commit & Push**. El zip no trae `config.js`, así que el tuyo no se toca. Los datos se conservan.

---

## Versión anterior: Sistema v0.1a (correcciones)

**Sistema v0.1a = envoltorio global + Equipos 0.1f.**

## Qué cambia en v0.1a
- **Casillas de «Tipos de trabajo» parejas.** Antes, algunas salían como cuadros grandes y otras chicas: el estilo de los campos de texto se aplicaba también a las casillas. Ahora todas son iguales, en teléfono y en PC.
- **Eliminar un proyecto creado por error.** En el proyecto → Editar → **Eliminar**.
  - No se puede eliminar si tiene equipos en terreno: primero hay que registrar su regreso o traspaso en Equipos.
  - «Oficina» no se elimina.
  - El proyecto eliminado va a la **papelera**, al final de la lista de Proyectos, y se puede **restaurar**.
  - «Cerrar proyecto» sigue siendo para los trabajos terminados.

### Qué se está probando
1. Crear un proyecto de prueba, eliminarlo y restaurarlo.
2. Que las casillas se vean parejas en tu teléfono y en el PC.

### Cómo actualizar desde v0.1
En `github.dev/CIRG95/Equipos`, arrastra los archivos de este zip respetando sus carpetas (`app/…` dentro de `app`), acepta reemplazar y haz **Commit & Push**. Los datos se conservan.

---

## Versión anterior: Sistema v0.1

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

## Cómo publicarlo (sobre el repositorio `equipos` que ya tienes)

No hay que configurar nada de nuevo: misma dirección (`cirg95.github.io/equipos/`), mismo Client ID, misma carpeta de Drive y mismos datos.

1. En el repositorio `equipos`, **sube y reemplaza** todos los archivos de este zip, **menos `config.js`**: deja el que ya tienes.
2. **Borra los archivos que ya no se usan:** `equipos-app.js`, `envoltorio.js` y `envoltorio-nube.js`. Si quedan no rompen nada, pero así no confunden.
3. Abre `https://cirg95.github.io/equipos/` y recarga con **Ctrl+Shift+R** en PC. En el teléfono, cierra y vuelve a abrir la app.
4. Lo que ya estaba cargado (equipos, certificados, personas y conexión a la nube) aparece igual. La app instalada en el teléfono y en el PC de tu compañero pasa sola al Sistema la próxima vez que se abra con conexión. Las etiquetas QR impresas siguen funcionando.

## Qué pasa con los datos (importante)

- **El Sistema reemplaza a la app de Equipos en la misma dirección** y usa la misma base `topoland` del navegador. No hay migración: los datos ya están.
- **En la nube sigue la misma carpeta** («Topoland Equipos (prueba)»). Si tu compañero abre la app antes de que actualice, no pasa nada: los datos son compatibles en ambos sentidos.
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
