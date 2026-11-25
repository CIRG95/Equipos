# Sistema de trabajo — v0.23 · Terreno 0.9.1

## Qué cambia en v0.23 (Monografías 0.8: mapa común de PR)
Pedido por Camilo el 25-nov, con el boceto del lienzo (pantallas 1, 2 y 3).
- **Datos comunes:** a la derecha hay un panel con el avance **X/14** (antes era la ventanita flotante), las fichas y el **Mapa común de PR**. A la izquierda siguen Documento, Medición y responsables, Qué incluye el PDF y el formato de coordenadas.
- **Pegar o cargar coordenadas:** la tabla ahora es **interactiva** (corriges celdas, agregas o quitas puntos; Tab pasa a la celda siguiente) y a la derecha aparece el **mapa con todos los PR**: fijas encuadre (mueve y acerca, o «Ajustar a todos los puntos»), fondo, forma y color del símbolo, tamaño de símbolo y de letra, norte y escala. Al apretar **Crear fichas** se guarda ese encuadre y (casilla marcada) se arma el croquis de cada ficha.
- **Cada ficha muestra solo su punto**, buscado por el **nombre de la hoja**, con el mismo encuadre y estilo. En el paso 2 de cada ficha aparece «Usar el encuadre común». En Datos comunes, «Encuadrar con todos los PR» reabre el mapa con las fichas que ya existen y «Armar croquis de todas las fichas» las rehace.
- Los puntos se dibujan con el **huso UTM de Datos comunes** (si falta, la ventana lo avisa). El zoom del encuadre es de números enteros.
- Archivos: `mapa-comun.js` (nuevo), `croquis.js` (`croquisConEncuadre`), `comun.js` (`croquisComun`), `pasos.js`, `monografias.css`. No se toca Terreno ni la conexión.
- Pendiente: probarlo en el navegador (no se pudo desde aquí); el mapa necesita internet.

## Qué cambia en v0.22 (estilo documento en toda la app)
Pedido por Camilo el 25-nov: «me gustó el estilo del boceto 3 (la ficha), aplícalo a la app completa».
- **Mismo lenguaje visual en todos los módulos:** fondo beige con hojas blancas, esquinas casi rectas (3 px), bordes finos y **banda de título en el color de marca** en cada tarjeta (como Coordenadas / Medición de la ficha). Los datos en cuadrícula (`sis-datos`, paso 3 de Monografías) llevan filas finas; las tablas de Gastos y Monografías, cabecera en banda.
- **Solo cambia el aspecto**, nada de funciones: se hace con una capa final, `app/estilo-documento.css` (cargada después de todos los CSS). Para volver atrás basta quitar su `<link>` de `index.html` y su entrada en `sw.js`.
- El color de la banda es el de la empresa (Personas → Empresa), así que cambia con la marca.
- **No se tocó Terreno** (`terreno/`) ni la conexión.
- Pendiente: mirarlo en el teléfono y en el PC y anotar qué pantallas quedan raras (no se pudo abrir en un navegador desde aquí).

## Qué cambia en v0.21.5 (Monografías 0.7: ficha más clara y editable)
Pedido por Camilo el 25-nov con la ficha de PFV Buena Esperanza (Perú) a la vista.
- **Un solo decimal: el punto.** Las geográficas se escribían con coma y las UTM y alturas con punto. Ahora todo va con punto (`5°08'35.92270" S`). Las fichas antiguas se corrigen al abrirlas y en el PDF.
- **Países.** La ficha tiene **País** (se completa sola con las coordenadas, o se elige). Los nombres cambian: Chile «Comuna · Región»; **Perú «Distrito · Provincia · Departamento»**; Bolivia «Municipio · Provincia · Departamento»; Argentina «Departamento · Provincia». En el PDF, el distrito lleva la provincia sin repetirla («Paita, Piura»). Sin país se asume Chile.
- **PDF:** «Coordenadas UTM - WGS84 - Zona 17 Sur» (antes «WGS84- Zona 17s»); columnas «Latitud» y «Longitud» (sin «(°)») y «Altura elipsoidal (m)».
- **Paso 3 · Coordenadas y medición:** ordenado como la ficha (Norte, Este, Cota ortométrica, Huso / Latitud, Longitud, Altura elipsoidal, Geoide / Equipo, Tipo, Fecha) y con **todas** las coordenadas (faltaba la altura elipsoidal).
  - **Equipo, tipo de medición, fecha, huso y geoide se cambian ahí mismo** (✎): el equipo se elige de la base de Equipos (con aviso de calibración) o se escribe otro. Ya no es un enlace al paso 1 cuando el dato es «de todas las fichas»: una ventana pregunta si el cambio va a **todas las fichas** o solo a esa.
- **Croquis:** además de la flecha de norte, **escala gráfica** (casilla «Escala gráfica»; el mapa muestra una escala de apoyo).
- `pieza-terreno.js` sigue generado desde Terreno (0.9.1); los ajustes de texto del PDF son `PARCHES` en `herramientas/extraer-pieza-monografia.mjs`. **Pendiente en el chat de Terreno** aplicar lo mismo para que el PDF del teléfono salga igual.
- Archivos: `comun.js` (`efectiva`, `paisDe`, `etiquetasUbicacion`, `zonaLegible`, `unirSinRepetir`), `coordenadas.js` (`puntoDecimal`), `vuelos/ubicacion.js` (`provincia`), `croquis.js` (`dibujarEscalaCroquis`). Sin almacenes nuevos; sin cambios en el paquete de conexión.
- Pruebas: nueva `ficha-pais-decimal.test.mjs`.

## Qué cambia en v0.21.4 (arreglo: fotos repetidas y logos en «Desde las fotos de Terreno»)
- La ventana para elegir croquis, panorámica o foto adicional ya no muestra los **logos del cliente** ni la **misma imagen repetida** (se reconoce por su huella o por nombre y tamaño). La lista del proyecto cuenta igual.
- Al cargar un logo del cliente, los logos anteriores de ese cliente van a la papelera (las fichas que los usaban pasan al nuevo); al abrir Monografías se limpian los que ya estaban repetidos.
- La v0.21.3 (coordenadas con columnas elegibles y fotos en lote) no había llegado a `main` (el PR #41 se fusionó con la versión anterior de la rama): entra con esta versión.

## Qué cambia en v0.21.3 (Monografías 0.6: coordenadas con columnas elegibles y fotos en lote)
- **«Pegar o cargar coordenadas»** (paso 1 › Fichas): se pega desde Excel o un texto, o se **carga el archivo** (.xlsx, .csv o .txt), y los valores quedan en una tabla.
  - En el **encabezado de cada columna** se elige qué es: Nombre, E (Este), N (Norte), Z (Cota) o «No usar». Parte con lo que detecta (por los títulos o por los valores: 7 dígitos = Norte, 6 = Este).
  - **Separador de columnas** (automático, tabulación, punto y coma, coma o espacios) y **decimales** (automático, punto o coma; también con separador de miles).
  - Casilla «La primera fila son títulos».
  - **Revisión antes de crear:** E y N invertidos (con botón «Intercambiar E y N»), celdas que no son número (en rojo), filas sin nombre, nombres repetidos y E/N fuera de lo normal para UTM. Con errores, «Crear» queda bloqueado.
  - Recuerda separador, decimales y el orden de columnas de la última vez (`mn_pegar_prefs`).
- **«Fotos en lote»**: se eligen o arrastran muchas fotos y se reparten solas:
  - por el **nombre del archivo** («PR-3_pano.jpg» → PR-3; «PR-1» no calza con «PR-10»);
  - por el **GPS de la foto** (la ficha a menos de 30 m; las fotos de WhatsApp enviadas como imagen no traen GPS);
  - el resto queda **sin asignar**: se elige la ficha en cada foto, o se elige una ficha arriba y se tocan sus fotos («Siguiente ficha →»), o «Repartir en orden las sin asignar».
  - Cada foto se marca Panorámica, Croquis o Adicional («croquis» o «pano» en el nombre la marcan sola; la primera de una ficha sin panorámica va como panorámica).
  - Si una ficha ya tenía panorámica o croquis, pregunta si reemplazarla o dejarla como adicional.
- Con una ventana abierta, el panel flotante de avance ya no queda encima.
- Archivos nuevos: `modulos/monografias/tabla-coords.js` y `fotos-lote.js` (lógica pura, con pruebas). Sin almacenes nuevos; sin cambios en Terreno ni en el paquete de conexión.
- Pruebas: 185 unitarias (nuevas `tabla-coords.test.mjs` 6 y `fotos-lote.test.mjs` 5); navegador en PC y teléfono: tabla con títulos y columna extra, coma separadora con punto decimal, E/N invertidos e intercambio, fotos por nombre, por GPS (3 m), en orden y a mano.


## Qué cambia en v0.21.2 (arreglo: logo del cliente en Monografías)
- El logo del cliente se guardaba con el cliente, pero la pantalla solo lo buscaba en las fichas: con 0 fichas decía «guardado» y mostraba «Sin imagen». Ahora se muestra el logo guardado del cliente aunque no haya fichas.
- Las fichas sin logo (nuevas o llegadas del teléfono) toman el logo del cliente al abrir Monografías; el mapa de puntos también lo usa.
- Si no hay cliente elegido, pide elegirlo antes de cargar el logo (antes quedaba guardado sin cliente y no aparecía).
- `datos.js`: `claveCliente`, `logoDeCliente(nombre)`. Sin cambios en Terreno ni en el paquete de conexión.

**Sistema v0.18 = estructura nueva** (pedido por Camilo el 18-nov, con la pizarra de flujos por rol y propuesta v0.18): el proyecto es el centro y sigue una línea encargo → planificación → terreno → entregas; un solo KMZ por proyecto; planificación en pasos; cronograma automático.

## Qué cambia en v0.21.1 (revisión de optimización y código genérico)
Sin funciones nuevas: la app hace lo mismo, más liviana y sin el nombre de ninguna empresa en el código.
- **Código genérico.** El nombre de la empresa sale solo de Configuración › Marca (por defecto «Mi empresa»): encabezado, título de la pestaña, letra del logo, etiqueta QR de los equipos, hoja de vuelo, CV en PDF y nombre del Excel de equipos. Nombres internos nuevos:
  - base de datos `sistema_trabajo`; claves del navegador `sistema_nube`, `sistema_nube_token`, `sistema_dispositivoId`, `sistema_conexion_*`, `sistema_invitacion`;
  - `config.js` define `window.SISTEMA_CONFIG` (el Client ID no cambia);
  - paquete de conexión **1.8**: archivo `sistema-conexion.js`, global `window.SistemaConexion` (mismas funciones);
  - carpeta nueva de Drive por defecto «Sistema de trabajo»; el proyecto «Oficina» nuevo lleva mandante «Interno»; los respaldos se marcan `app: 'sistema'`.
- **Nada se pierde al actualizar** (`compartido/nombres-anteriores.js`, el único archivo que conoce los nombres antiguos):
  - la primera vez que se abre (Sistema o Terreno), se copia la base anterior completa a la nueva sin pisar nada, y las claves del navegador (Drive vinculado, persona, dispositivo); la base anterior queda intacta como respaldo;
  - los respaldos `.json` antiguos se siguen importando y «Buscar carpetas» de Drive encuentra también la carpeta con el nombre anterior;
  - cuando todos los equipos hayan abierto la v0.21.1, ese archivo se puede borrar en una versión de limpieza.
- **Optimización:**
  - `sistema-app.js` de 1,23 MB a **1,12 MB** (−9 %): ahora también acorta las variables internas, pero conserva el nombre de cada función para leer los errores.
  - **Menos lecturas de la base:** cada pantalla pedía las mismas partes varias veces al pintarse (equipos, eventos y alertas hasta 4 veces). Ahora una lectura completa se comparte 1,5 s y cualquier escritura la descarta. Con datos de prueba: Inicio 25 → 17 lecturas, ficha del proyecto 44 → 29, Proyectos 35 → 15, Gastos 25 → 13. Lo que escriba otra pestaña o Terreno se ve al cambiar de pantalla, como antes.
  - La Oficina se revisa en la misma lectura de proyectos (antes una lectura extra cada vez).
  - Piezas repetidas unificadas en `compartido/util.js`: `vacio`, `plural`, `txtCampo` (4 copias en Administración) y `escapar` (3 copias); `puntoEnPoligono` de Planificación usa el de Vuelos.
  - Código sin uso quitado: 10 funciones exportadas que nadie llamaba y 8 importaciones sobrantes.
- **Terreno 0.9.1:** solo los nombres internos y el paquete 1.8; caché `terreno-topo-v53-0.9.1`. Sigue vinculado sin hacer nada.
- Pruebas: 174 unitarias (nueva `nombres-anteriores.test.mjs`); navegador con datos ficticios: copia desde una instalación anterior (PC y teléfono), recorrido de 30 pantallas con los tres roles sin errores, etiqueta QR con la marca, Terreno vinculado tras actualizar.

## Qué cambia en v0.21 (mapa de puntos y exportar KMZ/KML)
- **Monografías 0.5 · Mapa de puntos del proyecto** (botón «Mapa de puntos» junto a «PDF de todas»): mapa satelital de Esri con un símbolo por ficha (triángulo, círculo con cruz, cuadrado o círculo; color y tamaño) y su nombre, o nombre y cota.
  - Los **nombres se acomodan solos** para no taparse entre ellos ni tapar los símbolos, la flecha de norte o la escala gráfica; si se corren, quedan unidos a su punto con una línea.
  - **Encuadre en pantalla** (zoom con + y −, escala aproximada) o **escala fija** (1:1.000, 1:2.000, 1:5.000 o 1:10.000 en A4 o A3, horizontal o vertical): un marco punteado muestra lo que cabe en la hoja y avisa los puntos que quedan fuera. El detalle de la imagen se elige solo (o «Más» / «Máximo»).
  - **Descarga:** imagen PNG o JPG (en pantalla, 2× o 3×; en escala fija, a 300 ppp para imprimir exacto) u **hoja PDF con viñeta** (logos, título, proyecto, mandante, datum, huso, geoide, leyenda, escala gráfica, norte, elaboró, revisó, fecha y cuadro de coordenadas; lo que no cabe sigue en otra lámina). Los datos salen de «Datos comunes» del paso 1. También **Descargar KMZ** de los mismos puntos.
  - Fondo imagen, híbrido o calles; la atribución de Esri va siempre. La configuración queda guardada en el navegador (`mn_mapa_prefs`).
- **Exportar KML/KMZ en carpetas** (era la v0.18b planificada): cada botón exporta solo lo suyo y «Lo planificado» exporta todo el proyecto.
  - **Red de PR:** PR nuevos, puntos de control, vectores y área.
  - **Marcas de vuelo:** control (GCP), chequeo y área o eje.
  - **Vuelo (hoja):** «Exportar KMZ» en la hoja. Sectores aparte con sus hectáreas y % completado (verde, ámbar o gris), base usada y su altura (del registro de avance), base planificada y último vuelo; carpeta de bases con los sectores que cubre cada una; altura de vuelo, GSD y avance total en la descripción.
  - **Proyecto completo** («Exportar el proyecto (KMZ)» o «Como KML»): capas del proyecto (área, caminos, PR existentes), redes de PR, marcas, vuelos y monografías, cada parte en su carpeta.
- Sin almacenes nuevos y sin cambios en el paquete de conexión (sigue 1.7, idéntico al de `terreno/`).
- Pruebas: 171 unitarias (nuevas `kmz.test.mjs` y `mapa-puntos.test.mjs`); navegador con datos ficticios en PC y teléfono (mapa, imagen, hoja PDF y los cinco KMZ).

## Qué cambia en v0.20 (el Sistema prepara, el teléfono registra)
- **Checklist de terreno en el Sistema** (Configuración › Checklist de terreno): las plantillas de cada tipo de trabajo se editan aquí (nombre, ítems y tipo de respuesta: casilla, número o texto) y llegan a los teléfonos al sincronizar. Cada plantilla indica qué tipos de trabajo la cargan. También aquí: semáforo de nivelación por tramo y tipos de elemento de catastro. «Volver a las de fábrica» deshace los cambios.
- **Terreno 0.9.0, con menos opciones:**
  - Al elegir un proyecto del Sistema, la jornada trae **cargado el checklist de sus tipos de trabajo** (ya no se eligen los trabajos; «Cambiar» si hace falta).
  - **Registrar** muestra solo los instrumentos del proyecto («Ver todos los tipos» para el resto) y sugiere los equipos que la persona lleva según el checklist de salida.
  - Barra inferior en el teléfono: **Hoy · Registrar · Gastos**. «Mis jornadas» se abre desde Hoy y «Monografías» desde Registrar, con botón para volver. En modo computador se ven todas.
  - Vinculado, en Ajustes ya no se editan el checklist, el semáforo ni el catastro (vienen del Sistema). Sin vincular, la app funciona igual que antes.
- Paquete de conexión **1.7**: `configTerreno()`, `checklistDeProyecto(proyectoId)`. Sin almacenes nuevos: la configuración viaja en `admin_config` (id `terreno`).
- Pendiente acordado: el informe diario de jornada se podrá sacar desde ambas apps; se estructura en la próxima etapa (reportes diarios).
- Pruebas: 158 unitarias (nueva `plantillas-terreno.test.mjs`); navegador `terreno-090.js` y ajustes en las de Terreno.

## Qué cambia en v0.19 (uso simple)
Pensado para que lo use desde un alarife hasta la jefatura, sin explicación.
- **«¿Quién eres?»** reemplaza las listas de persona y rol del encabezado. Cada persona se elige una vez (agrupadas en Jefatura · Administración y RRHH · Terreno y gabinete) y **el rol sale de su ficha** (Dirección → Jefatura, RRHH → Administración, el resto → Terreno). El encabezado muestra un botón con el nombre y el rol; tocarlo permite cambiar de persona. Para probar pantallas de otro rol: Configuración › Usuario › «Ver como otro rol».
- **Inicio = «Hoy»** en los tres roles: arriba, **lo primero de hoy** con un botón grande («Hacerlo ahora»); debajo, **«Para hacer»** agrupado por lo que hay que hacer (Responder y confirmar · Renovar documentos · Aprobar vacaciones y permisos · Revisar contratos que terminan · Reponer EPP · Habilitar a la cuadrilla · Calibrar equipos · Pedir permisos de vuelo…). Ya no se muestran tarjetas en cero.
- **Jefatura**: tablero «Cómo van los proyectos» con un **semáforo** por proyecto (rojo: plazo vencido o consultas sin responder; ámbar: sin confirmar recepción, actividades atrasadas o vence en 7 días; verde: avanza bien) y el motivo en palabras simples. Al lado, solo **sus decisiones**.
- **RRHH**: pendientes agrupados por tipo; los de Personal se separan en documentos, contratos, EPP y ausencias.
- **Lenguaje simple**: «Confirmar que lo recibí» (antes «Acusar recibo»), «Información entregada» (antes «Calidad del encargo»), «Pedir permiso DGAC», «Subir el log del vuelo», tuteo en los pendientes.
- **Terreno 0.8.0 · modo simple para ayudantes y alarifes** (solo teléfono): si la ficha dice «Ayudante», la app abre en «Inicio» con cuatro botones grandes — Mi jornada · Foto o punto · Gasto · Charla de seguridad — y oculta Monografías e Historial. La **charla de seguridad** (proyecto, tema y asistentes) se registra sin señal y llega a Seguridad del proyecto en el Sistema.
- Paquete de conexión **1.6**: `miModo()`, `companerosDeProyecto(proyectoId)`, `registrarCharla({...})`; `misProyectos()` incluye los proyectos donde la persona integra la cuadrilla.
- Pruebas: 155 unitarias (nueva `hoy.test.mjs`); navegador `v019.js` (PC y teléfono) y `terreno-080.js`.

## Qué cambia en v0.18a (avance por sector)
- **Avance por sector en la hoja de vuelo:** tarjeta «Avance por sector» en el Resumen; se toca un sector y se registra fecha, % (25/50/75/100), base usada (PR), altura de la base y observación. Muestra sectores (un 50 % suma medio) y hectáreas, la meta del día y los sectores atrasados según el programa. Con todos los sectores al 100 % la hoja pasa sola a «Volado»; un sector al 100 % marca la columna Terreno de Entregas si el proyecto tiene un tramo con el mismo nombre.
- **Ficha del proyecto:** «Avance de los vuelos» en el Resumen y en la pestaña Terreno.
- **Desde el teléfono (Terreno 0.7.0):** el mismo registro sin señal; llega al Sistema con la sincronización.
- **Bases de amarre con la red planificada:** además de los PR existentes del KMZ, los PR de la red de PR del proyecto son candidatos a base de los vuelos (chip «Planificado en la red»).
- **Permisos omitidos por ahora:** interruptor en el paso Permisos y botón en el Resumen; la hoja queda «Planificado» (etapa nueva) sin perder lo cargado y se mantiene el aviso de la fecha límite DGAC.
- **Jornadas en panel lateral:** el Resumen muestra las jornadas en una línea de chips y «Ajustar jornadas» abre el panel con los controles, los días y «Agregar al calendario» (Escape cierra); Clima y Permisos ya no quedan abajo.
- **LiDAR:** el Resumen muestra densidad (pts/m²) y GSD de la cámara en vez de dejar el GSD vacío.

## Qué cambia en v0.18
- **Menús:** Planificación y Vuelos salen del menú y viven dentro del proyecto. Proyectos › **Vuelos** lista los vuelos de todos los proyectos; Herramientas › **Vuelo rápido** reúne los vuelos sin proyecto (u Oficina) con «Convertir en proyecto». Los enlaces antiguos (`#/planificacion`, `#/planificacion/proyecto/<id>`) llevan al proyecto.
- **Ficha por etapas:** Resumen · Encargo (o Datos) y bitácora · Planificación · Terreno · Entregas y cierre · Equipos y gastos.
- **Un solo KMZ por proyecto:** los polígonos quedan como área de trabajo (`capas.areas`, con hectáreas), las líneas como caminos y los puntos como PR existentes. La red de PR nueva nace con el área, los caminos, los PR existentes (control) y los PR nuevos que piden los vuelos (`resumen.amarre.nuevosLL`); las marcas nacen con el área; la hoja de vuelo nueva del proyecto parte con el área («Usar el área del proyecto» en el paso Área).
- **Planificación en pasos:** 1 Área y capas → 2 Red de PR → 3 Marcas de vuelo → 4 Vuelos → 5 Trabajos y cronograma (los pasos que no aplican al tipo de trabajo no aparecen). Tarjeta **«Lo planificado»** con una línea por parte y **«Guardar planificación»** (fecha, autor y aviso de cambios sin guardar).
- **Cronograma automático:** se arma solo con los trabajos ordenados y la fecha de inicio; conserva lo realizado. Se retiran «Llevar al cronograma» y el «Definir» que volvía a pedir los datos técnicos (para el encargado: «Planificar»/«Ajustar»).
- **Tabla de tiempos de ocupación GNSS** en Configuración (engranaje) › Parámetros técnicos.

## Versión anterior: v0.17b

## App de Terreno 0.6.1 — menos pasos
- Pestañas Hoy · Registrar · Monografías · Gastos · Historial. Vinculado, el operador y el proyecto vienen del Sistema; trabajos en un nivel; ubicación automática; checklist plegado; pronóstico en una línea; cierre al final con resumen y envío al Sistema (sin señal queda en cola). Detalle en `terreno/LEEME.md`.
- Conexión intacta: `terreno/js/sistema-conexion.js` idéntico a `paquete-conexion/` (cmp), mismas funciones del paquete 1.4.2 (`misProyectos`, `publicarJornada`, `misEquiposEnTerreno`).

## Qué cambia en v0.17b
- **Ficha del proyecto en pestañas:** Resumen (cronograma, cuadrilla, seguridad, gastos) · Planificación (trabajos, capas KMZ, vuelos, red de PR, monografías) · Datos y bitácora · Entregas · Equipos y gastos. Cada pestaña tiene su propia dirección (`#/proyecto/<id>/<pestaña>`); los pendientes enlazan directo a la pestaña que corresponde. La pestaña «Datos y bitácora» muestra cuántas entradas siguen abiertas.
- **Eliminar o cerrar un proyecto propio:** el encargado lo hace desde «Datos técnicos» → «Cerrar o eliminar». Los proyectos encargados por Jefatura solo los cierra o elimina quien los encargó (Editar → Eliminar). Lo eliminado queda en la papelera de Proyectos, desde donde se restaura o se borra definitivamente.
- **Hoja de vuelo más compacta:** los ajustes de la jornada quedan plegados en una línea con «Ajustar»; los días se muestran en mosaico (6 visibles, el resto en «Ver los N días restantes»); el clima muestra 6 días y un resumen del resto. En la ficha, cada vuelo lista 6 jornadas y un enlace a la hoja.
- Al crear un proyecto técnico se abre directo en la pestaña Planificación.

## Versión anterior: v0.17a

## Qué cambia en v0.17a
- **Hoja de vuelo · Jornadas:** un día por tarjeta (día, fecha, duración, barra, base y baterías), legible en el teléfono; se muestran los primeros 5 días y el resto en «Ver los N días restantes». El detalle de cada día es más corto («S1 a S2 · base PR1 · 4 + 4 baterías · S2 sigue otro día») y «Ver las baterías» lista solo las de ese día.
- **Controles de la jornada** en una grilla con etiquetas (horario, baterías, base, traslado) y la recarga en su propio bloque; la cantidad de jornadas se ve en grande. En el teléfono, dos columnas.
- **Bases de amarre:** «Base de cada sector» en tarjetas, con los sectores fuera del radio primero y en rojo; el botón de carga ya no muestra el campo de archivo del navegador.
- **Ficha del proyecto (encargado):** «Planificación técnica» plegable, abierta en la etapa de terreno, con resumen (trabajos y capas) en el título. En el teléfono, las filas de trabajos separan las acciones y el texto dice «con las flechas».
- **Teléfono:** se corrigió un desborde horizontal de la hoja de vuelo (avance del Resumen y botón de carga).

---

## Versión anterior: v0.17

**Sistema v0.17 = v0.16 + roles separados en proyectos + Vuelos 0.10 (bases de amarre y jornadas por baterías) + trabajos ordenables.** Pedido por Camilo el 17-nov-2026.

## Qué cambia en v0.17
- **Roles separados.** Jefatura encarga con «Encargar proyecto» (datos, cronograma, información y equipo). El encargado de terreno ya no ve ese asistente: tiene **«Nuevo proyecto»** (formulario corto para un trabajo que llegó por correo) y **«Datos técnicos»** para ajustar tipos, fechas, sistema de referencia y capas de un proyecto recibido. Si el proyecto lo encargó Jefatura, el nombre, mandante, plazo y alcance quedan a cargo de quien encargó.
- **Ficha del proyecto para el encargado:** sección «Planificación técnica» arriba, con:
  - **Trabajos del proyecto:** GNSS, vuelos, estación total, etc., ordenables arrastrando o con flechas, con días por trabajo y «en paralelo con el anterior». Los vuelos toman sus días de las hojas programadas (por baterías); el resto, por horario de trabajo. «Llevar al cronograma» arma las actividades en ese orden (conserva las ya realizadas). Avisa si los vuelos necesitan PR nuevos y van antes de la red GNSS.
  - **Capas del proyecto:** KMZ/KML con caminos (líneas) y PR instalados (puntos). Los puntos sin nombre («Marcador sin título») se cargan desmarcados.
- **Inicio del encargado:** tarjeta «Mis proyectos» (encargos de Jefatura y propios, acuse pendiente, actividades atrasadas).
- **Vuelos 0.10 · Bases de amarre (PR):** en el Resumen de la hoja, el Sistema elige la **menor cantidad de PR base** que deja cada sector dentro del radio de amarre (5 km por defecto, ajustable), prefiriendo bases centradas y cerca de un camino. Si un sector no lo alcanza ningún PR, sugiere PR nuevos sobre los caminos; si el sector es más grande que el radio, avisa que hay que dividirlo. Cada sector puede cambiar de base a mano («Volver a la propuesta» deshace). Las bases se ven en el esquema del área.
- **Vuelos 0.10 · Jornadas por baterías:** las jornadas de vuelo se calculan con las baterías disponibles (4 por defecto), agrupadas por base; un grupo que no cabe sigue al día siguiente con la misma base. Opción «Volver a cargar baterías a mediodía» (ida y vuelta, carga y almuerzo) con comparación sin/con recarga. Se mantiene el cálculo «Por horario». Al programar, cada día guarda su base.
- **Corrección:** al marcar algo dentro de una pantalla, la posición se toma antes de cargar los datos (evita saltos).

## Pendiente de calibrar (Camilo, vuelos del 18-nov)
- Autonomía real por batería, % al aterrizar, tiempos de instalación de base, traslado y carga de las 4 baterías: con esos datos se ajustan los valores por defecto.

## Límites conocidos
- Las capas y los trabajos se guardan dentro del proyecto (sin almacenes nuevos): si dos personas los editan sin conexión al mismo tiempo, prevalece el último guardado.
- Planificación (red de PR) todavía no usa los PR de las capas del proyecto como puntos existentes.
- El paquete de conexión y la app de Terreno no cambian.

## Pruebas
- 144 pruebas (`node --test pruebas/*.test.mjs`): nuevas `amarre` (13) y `trabajos` (6).
- Navegador (Playwright, datos ficticios): flujo del encargado con capas de 11 PR y 3 caminos, orden de trabajos, hoja de vuelo con bases y jornadas, recarga, radio y cambio manual; recorrido de todas las pantallas con los 3 roles; flujos de la v0.16; Terreno sin señal.

---

## Versión anterior: v0.16

**Sistema v0.16 = v0.15 + Encargo de proyectos + Administración 0.2 (gestión de personal) + buscador lateral + Configuración + Terreno 0.6.0 (sin conexión).** Pedido por Camilo el 16-nov-2026.

## Qué cambia en v0.16
- **Encargar proyecto (Jefatura y encargados):** asistente de 5 pasos que reemplaza al formulario largo: datos básicos → cronograma (con «Sugerir cronograma» y línea de tiempo) → información (qué se entrega, qué queda pendiente, archivos) → equipo de trabajo (con disponibilidad, ausencias y habilitación de cada persona) → revisar. El panel **«Calidad del encargo»** muestra en vivo qué falta.
- **Ficha del proyecto:** aviso para **acusar recibo** del encargo, calidad del encargo con lo pendiente, **cronograma** con actividades que se marcan como realizadas y **bitácora** de consultas, instrucciones y acuerdos. Una instrucción recibida por teléfono se anota y Jefatura la **confirma** con un clic.
- **Mis pendientes** suma: acusar recibo, actividades atrasadas, consultas sin respuesta, instrucciones por confirmar, información pendiente del encargo y solicitudes de vacaciones.
- **Inicio de Jefatura:** botón «Encargar proyecto», indicadores de encargos y lista de proyectos en curso con avance y calidad.
- **Personas = gestión de personal (Recursos Humanos y Jefatura):**
  - **Dotación:** dónde está hoy cada trabajador (proyecto, disponible o ausente), habilitación, alertas, alta («+ Trabajador»), baja y reincorporación, y exportación a CSV.
  - **Distribución:** personas por proyecto (se arrastran entre proyectos) y ocupación por semana.
  - **Vacaciones y ausencias:** solicitudes con advertencia de cruce con proyectos, línea de tiempo de 8 semanas, saldos (devengado estimado desde la fecha de ingreso) y registro. El encargado de terreno tiene «Mis vacaciones» para solicitar.
  - **Ficha:** pestaña nueva «Datos personales» (RUT, contacto, previsión, roles).
  - **Carpetas de arranque:** se crean desde un proyecto (toman su equipo y los documentos que exige su mandante) o para una licitación; el ZIP incluye un listado inicial con el estado de cada documento.
- **Configuración (botón de engranaje):** nombre y color de la empresa (ahora se sincronizan con la nube), modo de pantalla, vinculación de teléfonos con la app de Terreno (QR), nube y versión. Salieron de «Personas».
- **Buscador al costado (botón de lupa, tecla `/` o Ctrl+K):** en Inicio busca en todo el Sistema; en cada sección busca solo lo de esa sección, con filtros propios que no se mezclan entre secciones.
- **Rol «Dirección / comercial» pasa a llamarse «Jefatura / Dirección».**

## Correcciones
- Una acción dentro de una pantalla (marcar, agregar, cambiar un estado) ya no devuelve la página al inicio.
- La ficha del proyecto vuelve a actualizarse cuando llegan datos de la nube (antes no lo hacía por tener formularios).
- Desborde horizontal del «Registro por mandante» en el teléfono.
- Las rutas antiguas `#/personas` y `#/proyecto-editar/…` redirigen a las nuevas.
- Limpieza: importaciones sin uso en `app/vistas*.js`, se quitó la pantalla «Próximamente» y el formulario antiguo de proyecto.

## App de Terreno 0.6.0 — sin conexión
- Abre y registra sin señal; la **cola de subida queda guardada en el teléfono** aunque se cierre la app.
- Al volver la señal se reconecta sola y sube lo pendiente, también si la app se abrió sin internet. Franja «Sin conexión» y pastilla con las jornadas por subir.
- Ya no vuelve a subir todas las jornadas en cada apertura.
- Paquete de conexión **1.4.2** (mismas funciones; mensajes actualizados), copiado en `terreno/js/`; caché `terreno-topo-v48-0.6.0`.

## Límites conocidos
- **Google entrega sesiones de una hora.** Si la señal vuelve después de ese plazo, la subida a Google Drive puede pedir un toque en la pastilla de la nube para renovar la sesión. Nextcloud se reconecta solo. La primera apertura de la app necesita internet.
- El acceso exclusivo de Recursos Humanos y Jefatura es **dentro de la app**: la nube sigue siendo una sola carpeta. Para separarlo de verdad: Nextcloud por grupos o servidor aparte.
- La bitácora y el cronograma viven dentro del registro del proyecto: si dos personas editan el mismo proyecto sin conexión al mismo tiempo, prevalece el último guardado.
- Sin probar en teléfono real: Terreno sin señal en Android, arrastre en la distribución con pantalla táctil (existe «+ Agregar persona» y «×»).

## Lo que falta cargar (Camilo)
- Tabla de tiempos GNSS del Manual de Carreteras Vol. 2 (Planificación) y requisitos de personas de Codelco · SUCAL (Administración → Mandantes).

## Pruebas
- 125 pruebas (`node --test pruebas/*.test.mjs`): nuevas `encargo`, `buscador` y `personal`.
- Navegador (Playwright, datos ficticios): recorrido de todas las pantallas con los 3 roles en computador y teléfono; flujo encargo → acuse → bitácora → edición; buscador; personal; configuración; Terreno sin señal y junto al Sistema.
