"use strict";

/* =========================================================================
   CONFIGURACIÓN DE INSTRUMENTOS Y TIPOS DE LEVANTAMIENTO
   Para agregar un instrumento o tipo nuevo, solo hay que sumar una entrada
   aquí — el resto de la app (formulario, vista previa, exportes) se arma
   automáticamente a partir de esta estructura.
   ========================================================================= */
const INSTRUMENTOS = {
  nivel: {
    nombre: "Nivel Topográfico",
    tipos: {
      simple: {
        nombre: "Nivelación Simple",
        columnas: [
          { key: "punto", label: "Punto", tipo: "text" },
          { key: "lecturaAtras", label: "Lect. Atrás (m)", tipo: "number" },
          { key: "lecturaIntermedia", label: "Lect. Intermedia (m)", tipo: "number" },
          { key: "lecturaAdelante", label: "Lect. Adelante (m)", tipo: "number" },
          { key: "cota", label: "Cota (m)", tipo: "number" },
          { key: "obs", label: "Observaciones", tipo: "text" }
        ]
      },
      cerrada: {
        nombre: "Nivelación Cerrada (doble posición)",
        columnas: [
          { key: "puntoAtras", label: "Punto Atrás", tipo: "text" },
          { key: "puntoAdelante", label: "Punto Adelante", tipo: "text" },
          { key: "distancia", label: "Distancia tramo (m)", tipo: "number" },
          { key: "atras1", label: "Atrás Pos.1 (m)", tipo: "number" },
          { key: "adelante1", label: "Adelante Pos.1 (m)", tipo: "number" },
          { key: "atras2", label: "Atrás Pos.2 (m)", tipo: "number" },
          { key: "adelante2", label: "Adelante Pos.2 (m)", tipo: "number" },
          { key: "desnivel1", label: "Desnivel Pos.1 (m)", tipo: "number" },
          { key: "desnivel2", label: "Desnivel Pos.2 (m)", tipo: "number" },
          { key: "errorTramoMm", label: "Error entre Posiciones (mm)", tipo: "number" },
          { key: "desnivelAceptado", label: "Desnivel Aceptado (m)", tipo: "number" },
          { key: "cota", label: "Cota (m)", tipo: "number" },
          { key: "obs", label: "Observaciones", tipo: "text" }
        ]
      }
    }
  },
  gnss: {
    nombre: "GNSS",
    tipos: {
      estatico: {
        nombre: "Levantamiento Estático",
        columnas: [
          { key: "punto", label: "Punto / Código", tipo: "text" },
          { key: "alturaAntena", label: "Altura Antena (m)", tipo: "number", sticky: true },
          { key: "horaInicio", label: "Hora Inicio", tipo: "time" },
          { key: "horaFin", label: "Hora Fin", tipo: "time" },
          { key: "obs", label: "Observaciones", tipo: "text" }
        ]
      },
      rtk: {
        nombre: "RTK",
        columnas: [
          { key: "punto", label: "Punto / Código", tipo: "text" },
          { key: "alturaAntena", label: "Altura Antena (m)", tipo: "number", sticky: true },
          { key: "epocas", label: "Épocas", tipo: "number" },
          { key: "obs", label: "Observaciones", tipo: "text" }
        ]
      }
    }
  },
  estacion: {
    nombre: "Estación Total",
    tipos: {
      instalacion: {
        nombre: "Instalación y calaje",
        columnas: [
          { key: "estacion", label: "Estación", tipo: "text" },
          { key: "alturaInstr", label: "Altura instr. (m)", tipo: "number" },
          { key: "calaje", label: "Calaje", tipo: "text" },
          { key: "azCalaje", label: "Azimut calaje", tipo: "text" },
          { key: "distCalaje", label: "Dist. calaje (m)", tipo: "number" },
          { key: "hPrisma", label: "Altura prisma (m)", tipo: "number" },
          { key: "comp1", label: "Comprobación 1", tipo: "text" },
          { key: "dH1", label: "dH 1 (mm)", tipo: "number" },
          { key: "dZ1", label: "dZ 1 (mm)", tipo: "number" },
          { key: "comp2", label: "Comprobación 2", tipo: "text" },
          { key: "dH2", label: "dH 2 (mm)", tipo: "number" },
          { key: "dZ2", label: "dZ 2 (mm)", tipo: "number" },
          { key: "estadoTxt", label: "Estado", tipo: "text" },
          { key: "obs", label: "Observaciones", tipo: "text" }
        ]
      },
      replanteo: {
        nombre: "Replanteo",
        columnas: [
          { key: "punto", label: "Punto", tipo: "text" },
          { key: "Nd", label: "N diseño", tipo: "number" },
          { key: "Ed", label: "E diseño", tipo: "number" },
          { key: "Zd", label: "Z diseño", tipo: "number" },
          { key: "Nm", label: "N medido", tipo: "number" },
          { key: "Em", label: "E medido", tipo: "number" },
          { key: "Zm", label: "Z medido", tipo: "number" },
          { key: "dN", label: "ΔN (mm)", tipo: "number" },
          { key: "dE", label: "ΔE (mm)", tipo: "number" },
          { key: "dH", label: "dH (mm)", tipo: "number" },
          { key: "dZ", label: "dZ (mm)", tipo: "number" },
          { key: "estadoTxt", label: "Estado", tipo: "text" },
          { key: "obs", label: "Observaciones", tipo: "text" }
        ]
      }
    }
  },
  catastro: {
    nombre: "Catastro",
    tipos: {
      elementos: {
        nombre: "Catastro de elementos",
        columnas: [
          { key: "codigo", label: "Código", tipo: "text" },
          { key: "tipoElemento", label: "Tipo de elemento", tipo: "text" },
          { key: "estado", label: "Estado", tipo: "text" },
          { key: "descripcion", label: "Descripción", tipo: "text" },
          { key: "atributos", label: "Atributos", tipo: "text" },
          { key: "obs", label: "Notas", tipo: "text" }
        ]
      }
    }
  },
  escaner: {
    nombre: "Escáner Láser",
    tipos: {
      estacion: {
        nombre: "Estación de Escaneo",
        columnas: [
          { key: "estacion", label: "Estación / Código", tipo: "text" },
          { key: "modeloEscaner", label: "Modelo Escáner", tipo: "text", sticky: true },
          { key: "alturaInstrumento", label: "Altura Instrumento (m)", tipo: "number", sticky: true },
          { key: "resolucion", label: "Resolución / Calidad", tipo: "text", sticky: true },
          { key: "numDianas", label: "N° Dianas Visibles", tipo: "number" },
          { key: "horaInicio", label: "Hora Inicio", tipo: "time" },
          { key: "horaFin", label: "Hora Fin", tipo: "time" },
          { key: "obs", label: "Observaciones", tipo: "text" }
        ]
      },
      diana: {
        nombre: "Diana de Control",
        columnas: [
          { key: "codigo", label: "Código Diana", tipo: "text" },
          { key: "tipoDiana", label: "Tipo (esfera/plana/checkerboard)", tipo: "text", sticky: true },
          { key: "coordRTK", label: "Coordenada RTK (transcrita del equipo, opcional)", tipo: "text" },
          { key: "obs", label: "Observaciones", tipo: "text" }
        ]
      }
    }
  }
};

/* =========================================================================
   PLANTILLAS DE OBJETIVOS DE JORNADA
   Cada plantilla describe todo lo que conlleva un tipo de trabajo (ej. vuelo
   dron para fotogrametría: instalar y medir marcas, baterías usadas, avance
   diario). El operador las adjunta a una jornada como "objetivos del día" y
   los ítems quedan como checklist/valores editables. Estas son solo las
   plantillas de fábrica — el usuario puede editarlas o crear las suyas desde
   el editor en la app (ver PLANTILLAS más abajo, que vive en localStorage).
   tipo de ítem: "check" (casillero + hora automática), "numero", "texto".
   ========================================================================= */
const PLANTILLAS_DEFAULT = [
  {
    id: "aer",
    nombre: "Dron — Aerofotogrametría",
    items: [
      { id: "aer1", texto: "Verificar red de control existente (o definir la nueva)", tipo: "check" },
      { id: "aer2", texto: "Instalar GPS/base en punto de vuelo", tipo: "check" },
      { id: "aer3", texto: "Instalar marcas de vuelo", tipo: "check" },
      { id: "aer4", texto: "Medir marcas de vuelo desde la red (coordenadas)", tipo: "check" },
      { id: "aer5", texto: "Cargar plan de vuelo", tipo: "check" },
      { id: "aer6", texto: "N° de vuelos realizados", tipo: "numero" },
      { id: "aer7", texto: "N° de baterías usadas", tipo: "numero" },
      { id: "aer8", texto: "Respaldar imágenes y datos PPK de la base", tipo: "check" },
      { id: "aer9", texto: "Avance diario (ha cubiertas)", tipo: "texto" }
    ]
  },
  {
    id: "lid",
    nombre: "Dron — LiDAR",
    items: [
      { id: "lid1", texto: "Definir dónde se instala la base (según zona de vuelo)", tipo: "check" },
      { id: "lid2", texto: "Instalar y verificar base GNSS", tipo: "check" },
      { id: "lid3", texto: "Medir puntos de control en terreno (coordenadas)", tipo: "check" },
      { id: "lid4", texto: "Cargar plan de vuelo", tipo: "check" },
      { id: "lid5", texto: "N° de vuelos realizados", tipo: "numero" },
      { id: "lid6", texto: "N° de baterías usadas", tipo: "numero" },
      { id: "lid7", texto: "Respaldar datos LiDAR y PPK de la base", tipo: "check" },
      { id: "lid8", texto: "Avance diario (ha / km cubiertos)", tipo: "texto" }
    ]
  },
  {
    id: "niv",
    nombre: "Topografía — Nivelación (nivel topográfico)",
    items: [
      { id: "niv1", texto: "Verificar BM de partida", tipo: "check" },
      { id: "niv2", texto: "Elegir clase de nivelación", tipo: "check" },
      { id: "niv3", texto: "Definir punto final / cierre", tipo: "check" },
      { id: "niv4", texto: "N° de tramos nivelados", tipo: "numero" },
      { id: "niv5", texto: "Cierre dentro de tolerancia", tipo: "check" },
      { id: "niv6", texto: "Avance diario", tipo: "texto" }
    ]
  },
  {
    id: "est",
    nombre: "Topografía — Levantamiento y poligonal (estación total)",
    items: [
      { id: "est1", texto: "Verificar puntos de control (coordenadas y estado)", tipo: "check" },
      { id: "est2", texto: "Instalar estación y calar (calaje + 2 comprobaciones)", tipo: "check" },
      { id: "est3", texto: "N° de instalaciones realizadas", tipo: "numero" },
      { id: "est4", texto: "Medir poligonal (ángulos y distancias, reiteraciones)", tipo: "check" },
      { id: "est5", texto: "Levantar elementos del área", tipo: "check" },
      { id: "est6", texto: "N° de puntos levantados", tipo: "numero" },
      { id: "est7", texto: "Avance diario", tipo: "texto" }
    ]
  },
  {
    id: "rtk",
    nombre: "Topografía — Levantamiento RTK (GNSS)",
    items: [
      { id: "rtk1", texto: "Instalar / verificar base RTK", tipo: "check" },
      { id: "rtk2", texto: "Comprobar en punto conocido", tipo: "check" },
      { id: "rtk3", texto: "Levantar puntos del tramo", tipo: "check" },
      { id: "rtk4", texto: "Fotografiar los puntos que lo requieran", tipo: "check" },
      { id: "rtk5", texto: "N° de puntos levantados", tipo: "numero" },
      { id: "rtk6", texto: "Avance diario", tipo: "texto" }
    ]
  },
  {
    id: "rep",
    nombre: "Topografía — Replanteo",
    items: [
      { id: "rep1", texto: "Verificar puntos de control", tipo: "check" },
      { id: "rep2", texto: "Instalar estación o base y verificar", tipo: "check" },
      { id: "rep3", texto: "Replantear puntos de diseño", tipo: "check" },
      { id: "rep4", texto: "Verificar puntos replanteados", tipo: "check" },
      { id: "rep5", texto: "N° de puntos replanteados", tipo: "numero" },
      { id: "rep6", texto: "Avance diario", tipo: "texto" }
    ]
  },
  {
    id: "ees",
    nombre: "Escaneo 3D — Estático (FARO)",
    items: [
      { id: "ees1", texto: "Instalar dianas de control", tipo: "check" },
      { id: "ees2", texto: "Medir dianas de control (coordenadas)", tipo: "check" },
      { id: "ees3", texto: "Definir estaciones de escaneo", tipo: "check" },
      { id: "ees4", texto: "N° de estaciones escaneadas", tipo: "numero" },
      { id: "ees5", texto: "Registrar la nube (CloudCompare / RealWorks)", tipo: "check" },
      { id: "ees6", texto: "Avance diario", tipo: "texto" }
    ]
  },
  {
    id: "esl",
    nombre: "Escaneo 3D — Móvil (SLAM)",
    items: [
      { id: "esl1", texto: "Instalar y medir puntos de control para el ajuste", tipo: "check" },
      { id: "esl2", texto: "Planificar recorrido y cierres de lazo", tipo: "check" },
      { id: "esl3", texto: "N° de recorridos realizados", tipo: "numero" },
      { id: "esl4", texto: "Respaldar datos del equipo", tipo: "check" },
      { id: "esl5", texto: "Avance diario", tipo: "texto" }
    ]
  },
  {
    id: "bat",
    nombre: "Batimetría (bote)",
    items: [
      { id: "bat1", texto: "Instalar base GNSS", tipo: "check" },
      { id: "bat2", texto: "Medir pelos de agua (nivel del agua)", tipo: "check" },
      { id: "bat3", texto: "Verificar ecosonda (velocidad del sonido / barra)", tipo: "check" },
      { id: "bat4", texto: "Definir líneas de navegación", tipo: "check" },
      { id: "bat5", texto: "Coordinar fecha y hora del vuelo dron", tipo: "texto" },
      { id: "bat6", texto: "N° de líneas navegadas", tipo: "numero" },
      { id: "bat7", texto: "Avance diario", tipo: "texto" }
    ]
  },
  {
    id: "red",
    nombre: "Red geodésica — GNSS estático",
    items: [
      { id: "red1", texto: "Tipo de red (nueva o amarrada a existente)", tipo: "texto" },
      { id: "red2", texto: "Verificar puntos de amarre existentes", tipo: "check" },
      { id: "red3", texto: "Materializar monumentos nuevos", tipo: "check" },
      { id: "red4", texto: "N° de puntos ocupados", tipo: "numero" },
      { id: "red5", texto: "Sesiones realizadas (horario y equipo)", tipo: "texto" },
      { id: "red6", texto: "Avance diario", tipo: "texto" }
    ]
  }
];

/* Plantillas de fábrica de versiones anteriores: solo para retirar, sin tocar
   las que el usuario haya editado (ver cargarPlantillas). */
const PLANTILLAS_ANTIGUAS = [
  {
    id: "dron_fotogrametria",
    nombre: "Vuelo Dron - Fotogrametría",
    items: [
      { id: "df1", texto: "Instalar marcas de vuelo", tipo: "check" },
      { id: "df2", texto: "Medir marcas de vuelo (coordenadas)", tipo: "check" },
      { id: "df3", texto: "Instalar GPS/base en punto de vuelo", tipo: "check" },
      { id: "df4", texto: "Cargar plan de vuelo", tipo: "check" },
      { id: "df5", texto: "N° de baterías usadas", tipo: "numero" },
      { id: "df6", texto: "Avance diario (ha cubiertas / N° de vuelos)", tipo: "texto" }
    ]
  },
  {
    id: "escaneo_laser",
    nombre: "Escaneo Láser",
    items: [
      { id: "el1", texto: "Instalar dianas de control", tipo: "check" },
      { id: "el2", texto: "Medir dianas de control (coordenadas)", tipo: "check" },
      { id: "el3", texto: "Definir estaciones de escaneo", tipo: "check" },
      { id: "el4", texto: "N° de estaciones escaneadas", tipo: "numero" },
      { id: "el5", texto: "Avance diario", tipo: "texto" }
    ]
  },
  {
    id: "rtk_obras_arte",
    nombre: "RTK - Obras de Arte",
    items: [
      { id: "ra1", texto: "Instalar / verificar base RTK", tipo: "check" },
      { id: "ra2", texto: "Catastrar obras de arte del tramo", tipo: "check" },
      { id: "ra3", texto: "Fotografiar cada obra", tipo: "check" },
      { id: "ra4", texto: "N° de obras catastradas", tipo: "numero" },
      { id: "ra5", texto: "Avance diario (progreso del tramo)", tipo: "texto" }
    ]
  },
  {
    id: "nivelacion",
    nombre: "Nivelación",
    items: [
      { id: "nv1", texto: "Verificar BM de partida", tipo: "check" },
      { id: "nv2", texto: "Definir punto final / cierre", tipo: "check" },
      { id: "nv3", texto: "N° de tramos nivelados", tipo: "numero" },
      { id: "nv4", texto: "Avance diario", tipo: "texto" }
    ]
  },
  {
    id: "poligonal_catastro",
    nombre: "Poligonal / Catastro",
    items: [
      { id: "pc1", texto: "Verificar vértices de poligonal", tipo: "check" },
      { id: "pc2", texto: "Medir ángulos y distancias", tipo: "check" },
      { id: "pc3", texto: "Catastrar elementos del área", tipo: "check" },
      { id: "pc4", texto: "N° de puntos catastrados", tipo: "numero" },
      { id: "pc5", texto: "Avance diario", tipo: "texto" }
    ]
  }
];
