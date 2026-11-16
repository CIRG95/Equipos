# Topoland · Sistema de trabajo — v0.16

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
