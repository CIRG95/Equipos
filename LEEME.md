# Equipos — v0.1f (descargar planilla Excel)

Módulo de inventario de equipos topográficos de Topoland. Hoy funciona solo, como su propia PWA de prueba. Más adelante se integra a la app global, junto a Terreno Topografía y Gastos.

## Qué cambia en v0.1f

**«Descargar planilla» (RRHH)**, en Administrar y en Administrar → Respaldo. Genera `Equipos_Topoland_<fecha>.xlsx` con tres hojas:
- **Equipos:** las columnas de siempre (EQUIPO · MARCA · MODELO · DESCRIPCIÓN · N° SERIE · FECHA CALIBRACIÓN), más columnas informativas:
  - categoría, ubicación (oficina, terreno o mantención), proyecto y responsable;
  - próxima calibración, estado de la calibración, certificado vigente y su fecha;
  - alertas activas, accesorios por revisar, código interno y observaciones.
  - Las fechas son fechas de Excel (dd-mm-aaaa), «-» donde no se calibra, y la hoja trae filtros.
- **Accesorios:** cada accesorio con su equipo, cantidad, N° de serie y estado.
- **Certificados:** todos, del más reciente al más antiguo, con código, fecha de mantención, laboratorio y si el PDF está en la app.

**Sirve de respaldo que se abre sin la app** y **se puede volver a importar**: el importador reconoce las columnas de la planilla y deja pasar las informativas sin guardarlas como datos extra. Probado: descargar e importar de nuevo da «0 nuevos, 17 a actualizar».

Cada respaldo tiene su uso:
- **Planilla Excel:** para tener los datos a mano, en tu formato.
- **Respaldo `.json`:** para recuperar la app completa, con historial, PDF y fotos.

### Qué se está probando
1. Que tu compañero abra la planilla descargada y reconozca su formato.
2. Que la use como su copia periódica (por ejemplo, cada viernes).

### Cómo actualizar desde v0.1e
Reemplaza la carpeta **sin pisar `config.js`**. Los datos se conservan.

## Cambios de la v0.1e

**Nube con Google Drive, para trabajar entre dos o más personas.** En el encabezado hay una pastilla **☁** que abre el panel de nube.
- **Tú** creas la carpeta «Topoland Equipos (prueba)» en tu Drive, la compartes con tu compañero y le envías el **enlace de invitación** que da el panel.
- **Él** abre ese enlace, conecta su cuenta de Google y toca **«Usar la carpeta compartida»**. Con la casilla «Empezar desde la nube» (marcada por defecto) se borran sus datos de prueba locales, para no duplicar equipos, y se bajan los de la carpeta.
- Desde ahí, **la app sincroniza sola**: unos segundos después de cada cambio, cada minuto y medio, y al volver a abrirla. También se puede tocar «Sincronizar ahora».
- **Funciona sin conexión:** todo se guarda primero en el dispositivo; lo pendiente se sube al recuperar la conexión. La pastilla muestra «☁ Al día · 15:10», «Pendiente», «Sincronizando…», «Reconectar» o «Error».
- **En la carpeta de Drive** queda:
  - `datos/<dispositivo>.json`: cada dispositivo escribe **solo su archivo** y lee los de los demás. Así dos personas no se pisan el mismo archivo.
  - `Equipos/<Marca Modelo N° serie>/Certificados/…` y `…/Fotos/…`: los PDF y las fotos, ordenados y visibles en Drive como carpetas normales.
  - `Equipos/Modelos/<Marca Modelo>/…`: manuales y fichas técnicas.
- Un PDF subido desde otro dispositivo se baja la primera vez que se abre y queda guardado.

**Correcciones.**
- La primera vez que se abría la app en un navegador nuevo, a veces fallaba con «La base está abierta en otra pestaña»: dos aperturas de la base chocaban al crearla. Ahora se abren de a una.

### Cómo se mezclan los datos (importante para la prueba)
Se compara **registro por registro**, y gana la versión editada más recientemente.
- Las salidas, regresos, usos, alertas, certificados, notas y mantenciones son **registros nuevos**: nunca chocan.
- **Lo único que puede chocar** es editar **el mismo equipo** (su ficha, accesorios o datos administrativos) en dos dispositivos antes de que sincronicen. En ese caso se queda la última edición.

### Limitaciones de esta prueba
- **Google solo permite conectar desde la dirección web** (GitHub Pages). Con doble clic desde la carpeta la app funciona, pero sin nube.
- **La conexión con Google dura 1 hora.** Después, la pastilla dice «☁ Reconectar» y basta un toque. Lo que se haga mientras tanto queda pendiente y se sube al reconectar.
- **Permiso `drive` (todo el Drive).** Para que dos personas trabajen en la misma carpeta, la app pide el permiso completo de Drive, no el limitado que usa Terreno. Con el limitado, cada uno vería solo lo que subió él. La app solo lee y escribe en la carpeta elegida.
- **Aviso «Google no verificó esta app».** Aparece mientras el proyecto de Google Cloud esté en modo de prueba. Es normal: se toca «Continuar».
- **Datos reales:** tu plan era probar la nube con datos ficticios hasta presentárselo a tu jefe. La lista de equipos es poco sensible, pero los certificados, valores y activos fijos son de Topoland. Para esta prueba conviene una planilla de prueba, o al menos no llenar Administración con datos reales.

### Configurar Google Drive (lo haces tú, una vez, ~10 min)
1. **Publica la app en GitHub Pages**, en un repositorio aparte (por ejemplo `equipos`). La dirección queda `https://cirg95.github.io/equipos/`.
2. Entra a **console.cloud.google.com** con tu cuenta y elige tu proyecto (puede ser el de Nuestra Casa) o crea uno nuevo («Topoland pruebas»).
3. **APIs y servicios → Biblioteca →** busca **Google Drive API → Habilitar**.
4. **Google Auth Platform → Público (Audience):** debe decir *Externo* y *En prueba (Testing)*. En **Usuarios de prueba** agrega tu Gmail y la cuenta de Google de tu compañero.
5. **Acceso a los datos (Data access) → Agregar alcances:** marca `https://www.googleapis.com/auth/drive`.
6. **Clientes → Crear cliente → Aplicación web.** En **Orígenes de JavaScript autorizados** agrega `https://cirg95.github.io` (sin barra final ni carpeta). No hace falta «URI de redireccionamiento».
7. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`). En GitHub, edita **`config.js`** y pégalo en `googleClientId: '…'`. Guarda (commit).
8. Abre `https://cirg95.github.io/equipos/` → **☁ Conectar nube → Conectar con Google → Crear carpeta**. Carga tu planilla (Administrar → Importar) y crea las personas con «+».
9. En Drive, **comparte la carpeta «Topoland Equipos (prueba)» con tu compañero como Editor**. Copia el **enlace de invitación** del panel ☁ y envíaselo.

### Lo que hace tu compañero de RRHH
1. Si no tiene cuenta de Google: **accounts.google.com/signup → «Usar mi dirección de correo electrónico actual»** con su correo de Topoland. Así no necesita Gmail; Google solo le pide confirmar el correo.
2. Abre el enlace de invitación en el PC → **Conectar con Google** → elige su cuenta → «Google no verificó esta app» → **Continuar** → permitir.
3. Toca **«Usar la carpeta compartida»**. Elige su nombre en la lista de personas y el rol **RRHH**.

### Qué se está probando
1. Que la configuración de Google Cloud funcione con los pasos de arriba.
2. Tú (teléfono, Terreno): salida de un equipo y una alerta. Él (PC, RRHH) debe verlas en menos de dos minutos.
3. Él: pasa la alerta a mantención y sube un certificado en PDF. Tú: debes ver el equipo «En mantención» y abrir el PDF.
4. Que en Drive las carpetas `Equipos/…` queden ordenadas como esperas.

### Cómo actualizar desde v0.1d
Reemplaza la carpeta completa **sin pisar tu `config.js`** si ya pusiste el Client ID. Los datos se conservan.

## Cambios de la v0.1d

**Ficha del equipo según el boceto de Camilo.** Al tocar un equipo se abre:
- **Arriba, a la izquierda:** la foto del equipo y una segunda foto de la **placa con el N° de serie**, para distinguir unidades iguales. Si no hay foto, se ve un dibujo según la categoría. En el teléfono se puede tomar con la cámara.
- **Arriba, a la derecha:** el nombre, la descripción, el estado (dónde está, calibración, vencimientos) y los datos de la planilla (marca, modelo, N° de serie, calibración, próxima, certificado vigente).
  - **Especificaciones técnicas** por categoría (estación total, nivel, GNSS, dron, escáner). Se guardan **por modelo**: las dos TS15 las comparten.
  - Lo que se puede deducir de la DESCRIPCIÓN aparece solo con una marca amarilla «?», como en Terreno Topografía: «1" R500 EGL» → precisión 1", alcance sin prisma 500 m, EGL sí. Al confirmar o editar el valor, el «?» desaparece.
- **Abajo, pestañas** para no saturar la vista:
  - **Accesorios:** nombre, cantidad, N° de serie y estado (Bueno / Dañado / Falta), que cualquiera puede cambiar. Arman el checklist de salida y regreso. Lo que no vuelve en el regreso queda solo en «Falta».
  - **Certificados:** lista **código | fecha de mantención**. Al tocar el código se abre el PDF; el más reciente aparece marcado como «Vigente». Al agregar un certificado se actualiza la FECHA CALIBRACIÓN. A un certificado sin PDF se le puede adjuntar después.
  - **Historial:** cada salida con proyecto, responsable, desde, hasta y días, más el total de días en terreno. Abajo, todos los movimientos.
  - **Mantención:** las alertas con su ciclo (si hay una abierta, aparece una banda roja sobre las pestañas) y el registro de mantenciones (fecha, tipo, proveedor, N° de orden, costo y qué se hizo). El costo solo lo ve RRHH.
  - **Notas:** detalles de terreno que no son una alerta («la batería 2 dura poco»). Se pueden archivar.
  - **Documentos:** del **modelo** (ficha técnica, manual, guía rápida, compartidos por todas las unidades iguales) y de **la unidad**.
  - **Administración (solo RRHH):** N° de activo fijo, compra (fecha, proveedor, valor), garantía, seguro y, en drones, registro DGAC. El vencimiento del seguro y de la DGAC avisa con el mismo semáforo que la calibración. Aquí quedan también «Dar de baja» y «Papelera».
- **QR:** genera una etiqueta para imprimir y pegar en la caja. Al escanearla se abre la ficha.

**Otros cambios.**
- **Certificados por proyecto** (Administrar, o el botón al terminar una salida): los equipos que están hoy en el proyecto, cada uno con su certificado vigente para abrir. Sirve para presentar al mandante o a la inspección.
- El regreso muestra el N° de serie de cada equipo, para distinguir dos iguales.
- El formulario «Editar» quedó solo con los datos de la planilla y del módulo. Accesorios, certificados, fotos y especificaciones se editan en la ficha.
- La papelera también muestra certificados, mantenciones y archivos eliminados, y permite restaurarlos.

**Archivos (PDF y fotos) — preparación para la nube.** Se guardan en una capa común, `compartido/archivos.js`. Cada archivo sabe a quién pertenece (equipo, modelo o certificado) y trae la **ruta que tendrá en la nube**, por ejemplo `Equipos/Leica TS15 1669403/Certificados/cert.pdf`. Hoy quedan en el navegador. En la próxima versión se prueba subirlos a Drive.
- Las fotos se reducen a 1600 px, igual que en Terreno. El máximo por archivo es 15 MB.
- **Ojo:** el respaldo `.json` incluye los PDF y las fotos, así que crece con cada archivo. Esto se resuelve con la nube.

### Qué se está probando
1. ¿La ficha se entiende y se ve ordenada, en el PC y en el teléfono?
2. Cargar 2 o 3 certificados reales en PDF y abrirlos desde la lista, también en el teléfono.
3. Una salida y un regreso con accesorios: lo que no vuelve debe quedar en «Falta».
4. Imprimir una etiqueta QR desde la versión publicada en GitHub Pages y escanearla con el teléfono.

### Cómo actualizar desde v0.1c
Reemplaza la carpeta completa. Los datos se conservan; los componentes de las versiones anteriores pasan solos a la lista de accesorios.

## Cambios de la v0.1c

**El módulo sigue el orden de la planilla que ordenó Camilo (28-10-2026):**
EQUIPO · MARCA · MODELO · DESCRIPCIÓN · N° SERIE · FECHA CALIBRACIÓN.
- **MARCA** pasa a ser columna de la planilla: se importa tal cual y ya no se adivina.
- **DESCRIPCIÓN** reemplaza a DETALLE. Se guarda como texto, sin separar, porque mezcla cosas distintas según el equipo: precisión y alcance en estaciones totales («1" R500 EGL»), aumento en niveles («Aumento 32x») y rol en GNSS y drones («Base», «Rover», «RTK», «Control»). Los datos antiguos con DETALLE pasan solos a DESCRIPCIÓN.
- **Fecha de calibración:**
  - «-» = **no requiere calibración** (drones y escáner). Se muestra en gris y no cuenta como pendiente.
  - Celda vacía = **falta la fecha** (los GNSS South G7). Se muestra en naranja y entra en el filtro «Calibración por revisar».
- La **categoría** se toma de la columna EQUIPO («Nivel Topografico» → Nivel, «Escaner Láser» → Escáner láser). Antes, la palabra «RTK» de la descripción podía clasificar un dron como GNSS.
- La tabla del PC, la ficha, la vista previa de importación y el formulario usan el mismo orden de columnas.
- En el formulario, EQUIPO y MARCA sugieren los valores ya usados, y hay una casilla «No requiere calibración».
- Las tarjetas del teléfono muestran la descripción bajo el nombre.

### Qué se está probando
1. Importar la planilla real: las 17 filas deben verse igual que en Excel.
2. Que «-» y celda vacía se entiendan como se describe arriba.

### Cómo actualizar desde v0.1b
Reemplaza la carpeta completa. Si ya importaste la planilla antigua, vuelve a importar la nueva: los equipos se reconocen por N° de serie y se actualizan.

## Cambios de la v0.1b

**Corrección: la v0.1a quedaba en blanco al abrir `index.html` con doble clic.** El navegador bloquea los módulos de JavaScript (`import`) cuando la página se abre como archivo local, y solo se veía el encabezado.
- Ahora todo el código va empaquetado en **`equipos-app.js`**, un script clásico como los de Terreno. Abre con doble clic, en GitHub Pages y sin internet.
- Las carpetas `compartido/` y `modulos/equipos/` siguen siendo el código fuente separado para la integración. `equipos-app.js` se genera a partir de ellas con `construir.sh` (lo hago yo en cada versión; no hay que editarlo).
- Si algo vuelve a fallar al cargar, en vez de la pantalla vacía aparece un aviso con qué revisar.
- La puerta de entrada también queda disponible como `window.ModuloEquipos`, para que la usen scripts clásicos como los de Terreno.
- El diseño y las funciones son los mismos de la v0.1a.

### Qué se está probando
1. Abrir `index.html` con doble clic en el PC: debe verse el módulo, no solo el encabezado.
2. Lo mismo publicado en GitHub Pages, desde el teléfono.

### Cómo actualizar desde v0.1a
Reemplaza la carpeta completa. Lo importante es que `equipos-app.js` quede junto a `index.html`. Los datos se conservan.

## Cambios de la v0.1a

**Mismo diseño que Terreno Topografía v0.4.1 (estética D).** No cambia ninguna función ni dato; solo el aspecto.
- Encabezado verde petróleo con bordes redondeados abajo. Ahí se eligen rol y persona, como píldoras, igual que «Conectar nube» en Terreno.
- **Teléfono:** barra de pestañas abajo con íconos (Equipos, Salida, Regreso, Alertas y, para RRHH, Administrar).
- **PC:** las pestañas pasan al encabezado flotante y el contenido va en un panel blanco al centro. Mismo cambio automático de modo que Terreno (pantalla de 900 px o más con mouse). El botón ⇄ fuerza teléfono o PC.
- Tarjetas blancas con sombra suave, botón principal naranja (#C24A17), botones secundarios con borde verde, campos de 44 px de alto e insignias redondeadas.
- Números de serie y fechas en letra monoespaciada.
- «Administrar» se ve como el menú Herramientas de Terreno: ícono, título, descripción y flecha.
- Los colores salen de las mismas variables de Terreno (`--primary`, `--accent`, `--line`…). Al juntar los módulos, Equipos toma el diseño de la app global sin cambiar nada.
- **Lectura de Excel sin internet:** SheetJS va incluido en `vendor/`, igual que en Terreno.
- Se quitó el modo oscuro para quedar igual que Terreno. Ambos lo tendrán en la 1.0.

**Correcciones.**
- En el checklist de salida, los componentes ahora aparecen solo al marcar el equipo.
- En PC, al abrir una ficha el título ya no queda tapado por el encabezado.

### Qué se está probando
1. Que en el teléfono se sienta parte de la misma familia que Terreno: barra inferior, encabezado y tarjetas.
2. Que el checklist de salida se use bien con una mano y con guantes.
3. RRHH en el PC: tabla de equipos y pestañas en el encabezado.

### Cómo actualizar desde v0.1
Reemplaza los archivos en GitHub Pages. Los datos se conservan, porque viven en el navegador y la versión no cambia el formato. Si el teléfono muestra la versión anterior, cierra y abre la app dos veces.

## Qué hace el módulo

**Equipos.** La lista muestra dónde está cada equipo y quién lo tiene, el estado de su calibración y si tiene alertas.
- En el teléfono se ve en tarjetas; en el PC, en una tabla con las columnas de la planilla de RRHH.
- Filtros: en oficina, en terreno, en mantención, con alerta, calibración vencida o por vencer, de baja.

**Ficha del equipo.** Arriba van las columnas de la planilla, tal como RRHH las conoce. Luego vienen calibración, componentes, otros datos y el historial completo.

**Importar planilla (RRHH).** Lee .xlsx, .xls o .csv con las columnas EQUIPO · FECHA ÚLTIMA CALIBRACIÓN · MODELO · N° SERIE · DETALLE.
- Encuentra sola la fila de encabezados, aunque arriba haya un título.
- Muestra una vista previa fila por fila antes de guardar.
- Fechas: entiende la fecha de Excel, dd-mm-aaaa, dd/mm/aaaa y aaaa-mm-dd. Si una fecha no se entiende (por ejemplo «pendiente»), lo avisa y guarda el texto original.
- Al importar de nuevo, reconoce los equipos por N° de serie y solo actualiza las columnas de la planilla.
- Los N° de serie repetidos dentro del archivo quedan marcados para omitir.
- Las columnas desconocidas no se pierden: quedan como datos extra.
- Propone la categoría y la marca a partir del texto de la fila; RRHH puede corregirlas.

**Checklist de salida (terreno).**
- Asigna los equipos a un proyecto y a un responsable.
- Por cada equipo se marcan sus componentes: lo que no se marca queda registrado como faltante.
- Si el equipo ya estaba en otro proyecto, queda como **traspaso** y no necesita volver a oficina.
- Las alertas abiertas y las calibraciones vencidas se muestran como aviso, **sin bloquear** la salida.

**Regreso a oficina.** Mismo checklist al volver.

**Alertas.**
- Terreno reporta la anomalía.
- RRHH la lleva por sus estados: Enviar a mantención → Marcar recibido → Cerrar. También puede cerrarla sin mantención.
- Cada salida, traspaso o uso registrado mientras la alerta está abierta queda anotado: se ve cuántas veces se usó el equipo con la alerta abierta y quién lo usó.

**Calibración (RRHH).** Registra una nueva calibración, con laboratorio y certificado. La próxima fecha se calcula según el periodo del equipo (12 meses por defecto) y avisa 30 días antes.

**Administrar (RRHH).** Nuevo equipo, proyectos y personas (catálogos temporales), respaldo .json (descargar y cargar) y papelera.

## Roles

El envoltorio de prueba deja elegir arriba el **rol** (Terreno o RRHH) y la **persona**.
- **Terreno:** Equipos, Salida, Regreso, Alertas (ver y reportar).
- **RRHH:** todo lo anterior, más editar, importar, calibraciones, gestionar alertas, catálogos, respaldo y papelera.

## Supuestos de esta versión (por confirmar)

- **EQUIPO** se trata como texto libre (tipo o nombre). La categoría vive en un campo aparte.
- La **calibración** es anual por defecto; se puede cambiar por equipo.
- **Componentes:** cada equipo tiene una lista simple, y el botón «Sugerir según categoría» propone una base. No son equipos aparte.
- **Certificado:** por ahora solo el número o dónde está. El archivo PDF se adjuntará cuando exista la nube (Drive o Nextcloud).
- **Proyectos y personas** son de prueba. «Oficina» tiene el id fijo `oficina`.

## Cómo probarlo

1. En el PC basta con abrir `index.html` con doble clic. Para el teléfono, sube la carpeta completa a GitHub Pages.
2. Ábrela en el teléfono y en el PC. Crea una persona con «+ Persona».
3. Con el rol RRHH, ve a Administrar → Importar planilla y carga la planilla real.
4. Con el rol Terreno, haz un checklist de salida, reporta una anomalía y registra el regreso.
5. Vuelve a RRHH y lleva la alerta hasta cerrarla.

Todo funciona sin internet, incluida la lectura de Excel.

## Estructura

```
compartido/        igual en todos los módulos
  almacen.js       una base IndexedDB «topoland»; cada módulo registra sus almacenes
  util.js          uuid, sellos, fechas, utilidades
  papelera.js      borrado suave
  respaldo.js      respaldo .json (mezcla por registro; gana el más reciente)
  catalogos.js     proyectos y personas (temporales; reemplazables)
  planilla.js      lector de .xlsx / .csv y de fechas
modulos/equipos/
  equipos.js       PUERTA DE ENTRADA (lo único que importan otros módulos)
  modelo.js        campos, categorías, reglas de calibración y ubicación
  datos.js         lectura y escritura (uso interno)
  importar.js      importación de la planilla de RRHH
  pantallas.js     pantallas, montadas en un contenedor
  equipos.css      estilos propios (todo bajo .mod-equipos)
vendor/xlsx.full.min.js                                 lector de Excel (el mismo de Terreno)
index.html, envoltorio.js, manifest.json, sw.js, iconos/   envoltorio de prueba
compartido/nube.js       sincronización (común a todos los módulos)
compartido/nube-drive.js adaptador de Google Drive (mañana: nube-nextcloud.js)
envoltorio-nube.js       panel ☁ del envoltorio de prueba
config.js                Client ID de Google (se edita en GitHub)
compartido/archivos.js   archivos (PDF, fotos) con dueño y ruta prevista en la nube
modulos/equipos/exportar.js «Descargar planilla» (Excel)
modulos/equipos/ficha.js ficha del equipo y sus pestañas
vendor/qrcode.js         generador de QR (MIT)
equipos-app.js     GENERADO: todo lo anterior en un script clásico (lo que carga index.html)
construir.sh       arma equipos-app.js (npx esbuild)
```

## Versiones

- **v0.1f** (28-10-2026): «Descargar planilla» Excel (Equipos, Accesorios, Certificados), reimportable.
- **v0.1e** (28-10-2026): nube con Google Drive (carpeta compartida, un archivo por dispositivo, PDF y fotos en carpetas ordenadas, enlace de invitación, sincronización automática); corrección de la apertura de la base en un navegador nuevo.
- **v0.1d** (28-10-2026): ficha con foto, especificaciones por modelo y pestañas (accesorios con estado, certificados con PDF, historial de uso, mantención, notas, documentos, administración); etiqueta QR; certificados por proyecto; capa común de archivos.
- **v0.1c** (28-10-2026): columnas EQUIPO · MARCA · MODELO · DESCRIPCIÓN · N° SERIE · FECHA CALIBRACIÓN; «-» = no requiere calibración; categoría desde EQUIPO.
- **v0.1b** (28-10-2026): corrección; abre con doble clic (código empaquetado en `equipos-app.js`), aviso si no carga, `window.ModuloEquipos`.
- **v0.1a** (27-10-2026): diseño de Terreno Topografía v0.4.1 (estética D) en teléfono y PC, SheetJS local, componentes del checklist ocultos hasta marcar el equipo, ficha visible bajo el encabezado en PC.
- **v0.1** (27-10-2026): primera versión. Modelo de datos desde la planilla de RRHH, importación, checklist de salida y regreso, traspasos, alertas con su ciclo, calibraciones, papelera, respaldo y puerta de entrada para otros módulos.
