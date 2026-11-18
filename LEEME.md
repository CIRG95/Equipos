# Topoland · Sistema de trabajo — v0.17a

**Sistema v0.17a = v0.17 + pulido de pantallas** (pedido por Camilo el 17-nov: «optimización de pantallas como versión a»). Sin funciones nuevas.

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
