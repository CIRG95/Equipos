// compartido/plantillas-terreno.js — v0.20: lo que la app de Terreno recibe del Sistema.
// El checklist de cada tipo de trabajo, la tolerancia del semáforo de nivelación y los tipos de elemento de catastro
// se editan en el Sistema (Configuración › Checklist de terreno) y viajan al teléfono en `admin_config` (id 'terreno').
// Sin cambios en el Sistema, se usan estas plantillas base (las mismas que traía Terreno de fábrica).

export const PLANTILLAS_BASE = [
  {
    "id": "aer",
    "nombre": "Dron — Aerofotogrametría",
    "items": [
      {
        "id": "aer1",
        "texto": "Verificar red de control existente (o definir la nueva)",
        "tipo": "check"
      },
      {
        "id": "aer2",
        "texto": "Instalar GPS/base en punto de vuelo",
        "tipo": "check"
      },
      {
        "id": "aer3",
        "texto": "Instalar marcas de vuelo",
        "tipo": "check"
      },
      {
        "id": "aer4",
        "texto": "Medir marcas de vuelo desde la red (coordenadas)",
        "tipo": "check"
      },
      {
        "id": "aer5",
        "texto": "Cargar plan de vuelo",
        "tipo": "check"
      },
      {
        "id": "aer6",
        "texto": "N° de vuelos realizados",
        "tipo": "numero"
      },
      {
        "id": "aer7",
        "texto": "N° de baterías usadas",
        "tipo": "numero"
      },
      {
        "id": "aer8",
        "texto": "Respaldar imágenes y datos PPK de la base",
        "tipo": "check"
      },
      {
        "id": "aer9",
        "texto": "Avance diario (ha cubiertas)",
        "tipo": "texto"
      }
    ]
  },
  {
    "id": "lid",
    "nombre": "Dron — LiDAR",
    "items": [
      {
        "id": "lid1",
        "texto": "Definir dónde se instala la base (según zona de vuelo)",
        "tipo": "check"
      },
      {
        "id": "lid2",
        "texto": "Instalar y verificar base GNSS",
        "tipo": "check"
      },
      {
        "id": "lid3",
        "texto": "Medir puntos de control en terreno (coordenadas)",
        "tipo": "check"
      },
      {
        "id": "lid4",
        "texto": "Cargar plan de vuelo",
        "tipo": "check"
      },
      {
        "id": "lid5",
        "texto": "N° de vuelos realizados",
        "tipo": "numero"
      },
      {
        "id": "lid6",
        "texto": "N° de baterías usadas",
        "tipo": "numero"
      },
      {
        "id": "lid7",
        "texto": "Respaldar datos LiDAR y PPK de la base",
        "tipo": "check"
      },
      {
        "id": "lid8",
        "texto": "Avance diario (ha / km cubiertos)",
        "tipo": "texto"
      }
    ]
  },
  {
    "id": "niv",
    "nombre": "Topografía — Nivelación (nivel topográfico)",
    "items": [
      {
        "id": "niv1",
        "texto": "Verificar BM de partida",
        "tipo": "check"
      },
      {
        "id": "niv2",
        "texto": "Elegir clase de nivelación",
        "tipo": "check"
      },
      {
        "id": "niv3",
        "texto": "Definir punto final / cierre",
        "tipo": "check"
      },
      {
        "id": "niv4",
        "texto": "N° de tramos nivelados",
        "tipo": "numero"
      },
      {
        "id": "niv5",
        "texto": "Cierre dentro de tolerancia",
        "tipo": "check"
      },
      {
        "id": "niv6",
        "texto": "Avance diario",
        "tipo": "texto"
      }
    ]
  },
  {
    "id": "est",
    "nombre": "Topografía — Levantamiento y poligonal (estación total)",
    "items": [
      {
        "id": "est1",
        "texto": "Verificar puntos de control (coordenadas y estado)",
        "tipo": "check"
      },
      {
        "id": "est2",
        "texto": "Instalar estación y calar (calaje + 2 comprobaciones)",
        "tipo": "check"
      },
      {
        "id": "est3",
        "texto": "N° de instalaciones realizadas",
        "tipo": "numero"
      },
      {
        "id": "est4",
        "texto": "Medir poligonal (ángulos y distancias, reiteraciones)",
        "tipo": "check"
      },
      {
        "id": "est5",
        "texto": "Levantar elementos del área",
        "tipo": "check"
      },
      {
        "id": "est6",
        "texto": "N° de puntos levantados",
        "tipo": "numero"
      },
      {
        "id": "est7",
        "texto": "Avance diario",
        "tipo": "texto"
      }
    ]
  },
  {
    "id": "rtk",
    "nombre": "Topografía — Levantamiento RTK (GNSS)",
    "items": [
      {
        "id": "rtk1",
        "texto": "Instalar / verificar base RTK",
        "tipo": "check"
      },
      {
        "id": "rtk2",
        "texto": "Comprobar en punto conocido",
        "tipo": "check"
      },
      {
        "id": "rtk3",
        "texto": "Levantar puntos del tramo",
        "tipo": "check"
      },
      {
        "id": "rtk4",
        "texto": "Fotografiar los puntos que lo requieran",
        "tipo": "check"
      },
      {
        "id": "rtk5",
        "texto": "N° de puntos levantados",
        "tipo": "numero"
      },
      {
        "id": "rtk6",
        "texto": "Avance diario",
        "tipo": "texto"
      }
    ]
  },
  {
    "id": "rep",
    "nombre": "Topografía — Replanteo",
    "items": [
      {
        "id": "rep1",
        "texto": "Verificar puntos de control",
        "tipo": "check"
      },
      {
        "id": "rep2",
        "texto": "Instalar estación o base y verificar",
        "tipo": "check"
      },
      {
        "id": "rep3",
        "texto": "Replantear puntos de diseño",
        "tipo": "check"
      },
      {
        "id": "rep4",
        "texto": "Verificar puntos replanteados",
        "tipo": "check"
      },
      {
        "id": "rep5",
        "texto": "N° de puntos replanteados",
        "tipo": "numero"
      },
      {
        "id": "rep6",
        "texto": "Avance diario",
        "tipo": "texto"
      }
    ]
  },
  {
    "id": "ees",
    "nombre": "Escaneo 3D — Estático (FARO)",
    "items": [
      {
        "id": "ees1",
        "texto": "Instalar dianas de control",
        "tipo": "check"
      },
      {
        "id": "ees2",
        "texto": "Medir dianas de control (coordenadas)",
        "tipo": "check"
      },
      {
        "id": "ees3",
        "texto": "Definir estaciones de escaneo",
        "tipo": "check"
      },
      {
        "id": "ees4",
        "texto": "N° de estaciones escaneadas",
        "tipo": "numero"
      },
      {
        "id": "ees5",
        "texto": "Registrar la nube (CloudCompare / RealWorks)",
        "tipo": "check"
      },
      {
        "id": "ees6",
        "texto": "Avance diario",
        "tipo": "texto"
      }
    ]
  },
  {
    "id": "esl",
    "nombre": "Escaneo 3D — Móvil (SLAM)",
    "items": [
      {
        "id": "esl1",
        "texto": "Instalar y medir puntos de control para el ajuste",
        "tipo": "check"
      },
      {
        "id": "esl2",
        "texto": "Planificar recorrido y cierres de lazo",
        "tipo": "check"
      },
      {
        "id": "esl3",
        "texto": "N° de recorridos realizados",
        "tipo": "numero"
      },
      {
        "id": "esl4",
        "texto": "Respaldar datos del equipo",
        "tipo": "check"
      },
      {
        "id": "esl5",
        "texto": "Avance diario",
        "tipo": "texto"
      }
    ]
  },
  {
    "id": "bat",
    "nombre": "Batimetría (bote)",
    "items": [
      {
        "id": "bat1",
        "texto": "Instalar base GNSS",
        "tipo": "check"
      },
      {
        "id": "bat2",
        "texto": "Medir pelos de agua (nivel del agua)",
        "tipo": "check"
      },
      {
        "id": "bat3",
        "texto": "Verificar ecosonda (velocidad del sonido / barra)",
        "tipo": "check"
      },
      {
        "id": "bat4",
        "texto": "Definir líneas de navegación",
        "tipo": "check"
      },
      {
        "id": "bat5",
        "texto": "Coordinar fecha y hora del vuelo dron",
        "tipo": "texto"
      },
      {
        "id": "bat6",
        "texto": "N° de líneas navegadas",
        "tipo": "numero"
      },
      {
        "id": "bat7",
        "texto": "Avance diario",
        "tipo": "texto"
      }
    ]
  },
  {
    "id": "red",
    "nombre": "Red geodésica — GNSS estático",
    "items": [
      {
        "id": "red1",
        "texto": "Tipo de red (nueva o amarrada a existente)",
        "tipo": "texto"
      },
      {
        "id": "red2",
        "texto": "Verificar puntos de amarre existentes",
        "tipo": "check"
      },
      {
        "id": "red3",
        "texto": "Materializar monumentos nuevos",
        "tipo": "check"
      },
      {
        "id": "red4",
        "texto": "N° de puntos ocupados",
        "tipo": "numero"
      },
      {
        "id": "red5",
        "texto": "Sesiones realizadas (horario y equipo)",
        "tipo": "texto"
      },
      {
        "id": "red6",
        "texto": "Avance diario",
        "tipo": "texto"
      }
    ]
  }
];

export const TOLERANCIA_BASE = { verdeMm: 2, amarilloMm: 10 };
export const CATASTRO_BASE = [
  "Poste: Material, Altura (m), Diámetro (cm)",
  "Cámara: Material, Largo (m), Ancho (m), Profundidad (m)",
  "Tapa: Material, Diámetro o lado (cm), Servicio",
  "Luminaria: Tipo de lámpara, Altura (m), N° de brazos",
  "Muro: Material, Largo (m), Alto (m), Espesor (cm)",
  "Señal: Código de señal, Altura (m)",
  "Árbol: Especie, Altura (m), DAP (cm)",
  "Válvula: Diámetro (mm), Servicio",
  "Otro: Material, Dimensiones"
].join('\n');
export const TIPOS_ITEM = [['check', 'Casilla'], ['numero', 'Número'], ['texto', 'Texto']];

/** Checklist que corresponde a cada tipo de trabajo del proyecto (categoría o categoría:detalle). */
export const PLANTILLA_DE_TRABAJO = {
  'dron': 'aer', 'dron:aerofoto': 'aer', 'dron:lidar': 'lid', 'dron:termografia': null,
  'nivelacion': 'niv', 'nivelacion:simple': 'niv', 'nivelacion:cerrada': 'niv',
  'gnss': 'rtk', 'gnss:rtk': 'rtk', 'gnss:estatico': 'red', 'gnss:red': 'red',
  'estacion': 'est', 'estacion:levantamiento': 'est', 'estacion:poligonal': 'est', 'estacion:cubicacion': 'est', 'estacion:catastro': 'est', 'estacion:replanteo': 'rep',
  'escaneo': 'ees', 'escaneo:estatico': 'ees', 'escaneo:slam': 'esl',
  'batimetria': 'bat', 'batimetria:bote': 'bat',
};

/** Instrumentos de Terreno (pestaña Registrar) que corresponden a cada categoría de trabajo. */
export const INSTRUMENTOS_DE_CATEGORIA = {
  nivelacion: ['nivel'], gnss: ['gnss'], estacion: ['estacion'], escaneo: ['escaner'], batimetria: ['gnss'], dron: [], otro: [],
};

const copia = x => JSON.parse(JSON.stringify(x));

/** Configuración efectiva (la guardada en el Sistema o la base), siempre completa. */
export function configEfectiva(guardada) {
  const g = guardada || {};
  const plantillas = Array.isArray(g.plantillas) && g.plantillas.length ? g.plantillas : PLANTILLAS_BASE;
  return {
    plantillas: copia(plantillas),
    tolerancia: { ...TOLERANCIA_BASE, ...(g.tolerancia || {}) },
    catastro: String(g.catastro || '').trim() ? g.catastro : CATASTRO_BASE,
    desdeSistema: !!(g.plantillas || g.tolerancia || g.catastro),
    actualizadoEn: g.actualizadoEn || null,
  };
}

/**
 * Plantillas del checklist para los tipos de trabajo de un proyecto (sin repetir, en el orden de los tipos).
 * Si un detalle no tiene plantilla propia se usa la de su categoría. Detalles marcados ganan a la categoría sola.
 */
export function plantillasDeTrabajos({ categorias = [], detalles = [] } = {}, plantillas = PLANTILLAS_BASE) {
  const ids = [];
  const sumar = id => { if (id && !ids.includes(id)) ids.push(id); };
  const conDetalle = new Set(detalles.map(d => d.split(':')[0]));
  for (const d of detalles) sumar(d in PLANTILLA_DE_TRABAJO ? PLANTILLA_DE_TRABAJO[d] : PLANTILLA_DE_TRABAJO[d.split(':')[0]]);
  for (const c of categorias) if (!conDetalle.has(c)) sumar(PLANTILLA_DE_TRABAJO[c]);
  return ids.map(id => plantillas.find(p => p.id === id)).filter(Boolean);
}

/** Instrumentos de Registrar para las categorías del proyecto ([] = todos). */
export function instrumentosDeTrabajos({ categorias = [], detalles = [] } = {}) {
  const s = new Set();
  for (const c of categorias) (INSTRUMENTOS_DE_CATEGORIA[c] || []).forEach(i => s.add(i));
  if (detalles.includes('estacion:catastro')) s.add('catastro');
  return [...s];
}

/** Revisa una plantilla antes de guardarla. Devuelve el texto del problema o ''. */
export function problemaPlantilla(p) {
  if (!p || !String(p.nombre || '').trim()) return 'La plantilla necesita un nombre.';
  if (!Array.isArray(p.items) || !p.items.length) return `«${p.nombre}» necesita al menos un ítem.`;
  if (p.items.some(i => !String(i.texto || '').trim())) return `«${p.nombre}» tiene un ítem sin texto.`;
  return '';
}
