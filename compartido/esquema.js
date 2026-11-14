// compartido/esquema.js — todas las partes (almacenes) de la base «topoland», en un solo lugar.
// La base la comparten el Sistema y la app de Terreno (mismo dominio). Si cada app creara solo lo suyo,
// la que llega después tendría que subir la versión de la base y esperar a que la otra la suelte; en Android,
// una app en segundo plano está congelada y no la suelta nunca (el Sistema quedaba sin cargar).
// Por eso almacen.js registra este esquema completo al cargarse: la abra quien la abra, se crea entera.
// Al agregar un almacén o un índice en un módulo, agregarlo también aquí (la prueba esquema.test.mjs lo revisa).
export const VERSION_ESQUEMA = 1;

const porProyecto = [['proyectoId', 'proyectoId']];
const porEquipo = [['equipoId', 'equipoId']];

export const ESQUEMA = [
  // compartido
  { nombre: 'compartido_proyectos' },
  { nombre: 'compartido_personas' },
  { nombre: 'compartido_archivos', indices: [['dueno', ['duenoTipo', 'duenoId']]] },
  // Equipos
  { nombre: 'equipos_equipos' },
  { nombre: 'equipos_eventos', indices: [['equipoId', 'equipoId'], ['proyectoId', 'proyectoId']] },
  { nombre: 'equipos_alertas', indices: porEquipo },
  { nombre: 'equipos_modelos' },
  { nombre: 'equipos_certificados', indices: porEquipo },
  { nombre: 'equipos_mantenciones', indices: porEquipo },
  { nombre: 'equipos_notas', indices: porEquipo },
  // Vuelos
  { nombre: 'vuelos_planes', indices: porProyecto },
  { nombre: 'vuelos_drones' },
  { nombre: 'local_vuelos_capas' },
  // Seguimiento
  { nombre: 'seguimiento_planes', indices: porProyecto },
  { nombre: 'seguimiento_ciclos', indices: [['planId', 'planId']] },
  { nombre: 'seguimiento_eventos', indices: [['cicloId', 'cicloId']] },
  { nombre: 'seguimiento_entregas', indices: [['cicloId', 'cicloId']] },
  // Gastos (v0.13)
  { nombre: 'gastos_gastos', indices: [['proyectoId', 'proyectoId'], ['personaId', 'personaId'], ['rendicionId', 'rendicionId']] },
  { nombre: 'gastos_rendiciones', indices: [['proyectoId', 'proyectoId'], ['personaId', 'personaId']] },
  { nombre: 'gastos_eventos', indices: [['rendicionId', 'rendicionId']] },
  // Monografías (datos que llegan desde Terreno)
  { nombre: 'terreno_monografias', indices: porProyecto },
  { nombre: 'terreno_monografias_gabinete', indices: porProyecto },
  { nombre: 'terreno_revisiones', indices: [['monografiaId', 'monografiaId'], ['proyectoId', 'proyectoId']] },
  { nombre: 'terreno_jornadas', indices: porProyecto },
  // Administración (v0.15): personal, flota, acreditación por mandante, comercial, seguridad y biblioteca
  { nombre: 'compartido_mandantes' },
  { nombre: 'admin_tipos_doc' },
  { nombre: 'admin_documentos', indices: [['dueno', ['duenoTipo', 'duenoId']]] },
  { nombre: 'admin_fichas' },
  { nombre: 'admin_ausencias', indices: [['personaId', 'personaId']] },
  { nombre: 'admin_licitaciones' },
  { nombre: 'admin_vehiculos' },
  { nombre: 'admin_viajes', indices: porProyecto },
  { nombre: 'admin_guias', indices: porProyecto },
  { nombre: 'admin_cotizaciones' },
  { nombre: 'admin_seguridad', indices: porProyecto },
  { nombre: 'admin_biblioteca' },
  { nombre: 'admin_config' },
  // Planificación (v0.15): redes geodésicas y marcas de vuelo
  { nombre: 'planif_redes', indices: porProyecto },
  { nombre: 'planif_marcas', indices: porProyecto },
];
