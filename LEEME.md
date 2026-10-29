# Topoland · Sistema de trabajo — v0.3 (paquete de mejoras)

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
