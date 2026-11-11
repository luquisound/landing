"use strict";

window.LuquisoundCases = [
  {
    id: "ford-mustang-insonorizacion",
    title: "Ford Mustang",
    categories: ["insonorizacion"],
    summary: "Insonorización del piso, el túnel central y la zona trasera del habitáculo con material BRÜDER. Las fotos recorren las superficies tratadas y el vehículo en el taller.",
    steps: ["Material de insonorización sobre el piso y el túnel central, con los asientos retirados.", "Detalles del tratamiento en la zona trasera del habitáculo.", "Vista exterior del Mustang en el taller."],
    serviceRefs: ["insonorizacion"],
    media: [
      { type: "image", src: "assets/case-mustang-tunel.jpg", alt: "Detalle del material de insonorización sobre el piso y el túnel del Mustang", title: "Piso y túnel central" },
      { type: "image", src: "assets/case-mustang-trasera.jpg", alt: "Material de insonorización en la zona trasera del habitáculo del Mustang", title: "Zona trasera del habitáculo" },
      { type: "image", src: "assets/case-mustang-insonorizacion.jpg", alt: "Vista exterior del Ford Mustang verde en el taller Luquisound", title: "Mustang en el taller" }
    ]
  },
  {
    id: "chevrolet-silverado-insonorizacion",
    title: "Chevrolet Silverado",
    categories: ["insonorizacion"],
    summary: "Insonorización de la cabina: piso, túnel central y panel frontal. El proceso muestra la preparación de las superficies y la colocación del material, con el tablero retirado.",
    steps: ["Material de insonorización en el piso, el túnel central y la zona trasera.", "Frente de la cabina con el tablero retirado y el panel a la vista.", "Material colocado en el panel frontal de la cabina."],
    serviceRefs: ["insonorizacion"],
    media: [
      { type: "image", src: "assets/case-silverado-piso.jpg", alt: "Piso, túnel central y zona trasera de la cabina de la Silverado con material de insonorización BRÜDER", title: "Piso y zona trasera" },
      { type: "image", src: "assets/case-silverado-frente.jpg", alt: "Frente de la cabina de la Silverado con el tablero retirado y el panel todavía sin material de insonorización", title: "Frente con el tablero retirado" },
      { type: "image", src: "assets/case-silverado-panel.jpg", alt: "Material de insonorización colocado en el panel frontal de la cabina de la Silverado", title: "Tratamiento del panel frontal" },
      { type: "image", src: "assets/case-silverado-insonorizacion.jpg", alt: "Vista exterior de la Chevrolet Silverado verde en el taller Luquisound", title: "Silverado en el taller" }
    ],
    workOnlyMedia: [
      { type: "image", src: "assets/case-silverado-motor.jpg", alt: "Vano motor de la Chevrolet Silverado verde, con conducto de admisión cromado y filtro cónico visibles", title: "Vano motor de la Silverado" }
    ]
  },
  {
    id: "bmw-335i",
    title: "BMW 335i",
    categories: ["audio", "insonorizacion", "personalizacion"],
    summary: "Audio, insonorización e iluminación en el BMW 335i. Recorremos el tratamiento de puertas, la integración de los equipos y las terminaciones del habitáculo.",
    steps: ["Puertas con material de insonorización y montaje de parlantes.", "Componentes bajo el asiento y equipos integrados en el baúl.", "Iluminación interior y cielo estrellado.", "Otros recorridos de exterior e interior de la colección."],
    serviceRefs: ["audio", "insonorizacion", "personalizacion"],
    media: [
      { type: "image", src: "assets/case-bmw.jpg", alt: "Detalle de la instalación en el BMW 335i", title: "Instalación BMW 335i" },
      { type: "video", src: "assets/case-bmw.mp4", poster: "assets/case-bmw.jpg", alt: "Recorrido por el tratamiento de puertas, los equipos de audio y la iluminación del BMW 335i", title: "Instalación y terminaciones" },
      { type: "video", src: "assets/case-bmw-exterior.mp4", poster: "assets/case-bmw-exterior.jpg", alt: "Otro recorrido de la colección BMW 335i: apertura y cierre del baúl, exterior y detalles de terminación", title: "Exterior y detalles" },
      { type: "video", src: "assets/case-bmw-interior.mp4", poster: "assets/case-bmw-interior.jpg", alt: "Otro recorrido de la colección BMW 335i: consola, celular, iluminación ambiental, cielo estrellado y pantalla multimedia", title: "Interior y multimedia" }
    ]
  },
  {
    id: "golf-r32",
    title: "Volkswagen Golf R32",
    categories: ["audio"],
    summary: "Audio integrado en el baúl, con subwoofer y un compartimento que permite acceder a los equipos. El controlador queda integrado en el habitáculo.",
    steps: ["Subwoofer y terminación del baúl.", "Compartimento de equipos accesible mediante una tapa.", "Control de audio integrado en el interior."],
    serviceRefs: ["audio"],
    media: [
      { type: "image", src: "assets/case-r32.jpg", alt: "Detalle del montaje de audio del Volkswagen Golf R32", title: "Integración en el Golf R32" },
      { type: "video", src: "assets/case-r32.mp4", poster: "assets/case-r32.jpg", alt: "Recorrido por el subwoofer, el compartimento de equipos y el controlador del Golf R32", title: "Audio integrado en el baúl" }
    ]
  },
  {
    id: "peugeot-206",
    title: "Peugeot 206",
    categories: ["audio", "personalizacion"],
    summary: "Instalación de parlantes, subwoofer y multimedia, con una etapa de ajuste mediante computadora y micrófono de medición. El recorrido muestra el montaje y las terminaciones del sistema.",
    steps: ["Parlantes en soportes junto al parabrisas.", "Subwoofer y terminaciones del baúl; pantalla y controlador en el habitáculo.", "Ajuste del sistema con computadora y micrófono de medición."],
    serviceRefs: ["audio", "personalizacion"],
    media: [
      { type: "image", src: "assets/case-peugeot.jpg", alt: "Detalle de la instalación de audio del Peugeot 206", title: "Instalación Peugeot 206" },
      { type: "video", src: "assets/case-peugeot.mp4", poster: "assets/case-peugeot.jpg", alt: "Recorrido por los parlantes, el subwoofer, la multimedia y el ajuste del Peugeot 206", title: "Montaje y calibración" }
    ]
  },
  {
    id: "chevrolet-corsa",
    title: "Chevrolet Corsa",
    categories: ["audio", "insonorizacion"],
    summary: "Tratamiento de puertas y montaje de componentes de audio. El proceso recorre la colocación del material de insonorización, la integración del estéreo y el interior terminado.",
    steps: ["Preparación de la puerta con material de insonorización.", "Montaje de parlantes y equipos de audio.", "Integración del estéreo y recorrido por el resultado terminado."],
    serviceRefs: ["audio", "insonorizacion"],
    media: [
      { type: "image", src: "assets/case-corsa.jpg", alt: "Detalle del trabajo de audio e insonorización en el Chevrolet Corsa", title: "Instalación Chevrolet Corsa" },
      { type: "video", src: "assets/case-corsa.mp4", poster: "assets/case-corsa.jpg", alt: "Recorrido por el tratamiento de puertas y el montaje de componentes del Chevrolet Corsa", title: "Proceso y componentes" }
    ]
  },
  {
    id: "mercedes-c63s",
    title: "Mercedes-Benz C63s",
    categories: ["personalizacion"],
    summary: "Multimedia e iluminación ambiental integradas al habitáculo: pantalla con navegación y CarPlay, control de funciones y selección de colores de iluminación.",
    steps: ["Pantalla con navegación e interfaz CarPlay.", "Control de funciones desde la pantalla.", "Selección de colores de iluminación ambiental."],
    serviceRefs: ["personalizacion"],
    media: [
      { type: "image", src: "assets/case-mercedes.jpg", alt: "Detalle del interior y la multimedia del Mercedes-Benz C63s", title: "Interior Mercedes-Benz C63s" },
      { type: "video", src: "assets/case-mercedes.mp4", poster: "assets/case-mercedes.jpg", alt: "Demostración de la pantalla multimedia y la iluminación ambiental del Mercedes-Benz C63s", title: "Multimedia e iluminación" }
    ]
  },
  {
    id: "abarth-dsp",
    title: "Abarth · Calibración DSP",
    categories: ["audio"],
    summary: "Calibración del sistema de audio con instrumental, computadora y micrófono de medición. El recorrido muestra la disposición de los equipos y el software de ajuste.",
    steps: ["Controlador de audio en el habitáculo.", "Interfaz de medición y software de ajuste.", "Micrófono dispuesto para la medición dentro del vehículo."],
    serviceRefs: ["audio"],
    media: [
      { type: "image", src: "assets/case-abarth-dsp.jpg", alt: "Detalle del instrumental utilizado en la calibración DSP del Abarth", title: "Medición y ajuste DSP" },
      { type: "video", src: "assets/case-abarth-dsp.mp4", poster: "assets/case-abarth-dsp.jpg", alt: "Recorrido por la interfaz, la computadora y el micrófono de calibración DSP del Abarth", title: "Calibración con instrumental" }
    ]
  },
  {
    id: "abarth-admision",
    title: "Abarth · Admisión",
    categories: ["personalizacion"],
    summary: "Trabajo especial de admisión en el vano motor. El proceso muestra la intervención sobre las conexiones, los componentes y las terminaciones del montaje.",
    steps: ["Intervención manual sobre las conexiones en el vano motor.", "Detalles de los componentes de admisión.", "Vista del montaje terminado."],
    serviceRefs: [],
    media: [
      { type: "image", src: "assets/case-abarth-intake.jpg", alt: "Detalle del trabajo especial de admisión en el Abarth", title: "Admisión Abarth" },
      { type: "video", src: "assets/case-abarth-intake.mp4", poster: "assets/case-abarth-intake.jpg", alt: "Proceso manual y terminaciones de un trabajo de admisión en el Abarth", title: "Trabajo especial de admisión" }
    ]
  },
  {
    id: "suv-gris",
    title: "SUV gris · Audio e iluminación",
    categories: ["audio", "personalizacion"],
    summary: "Instalación de iluminación ambiental en tablero y puertas, amplificador y subwoofer. El recorrido reúne los componentes y las terminaciones del interior.",
    steps: ["Iluminación ambiental en tablero y puertas.", "Amplificador y subwoofer en el vehículo.", "Recorrido por el interior y el exterior terminado."],
    serviceRefs: ["audio", "personalizacion"],
    media: [
      { type: "image", src: "assets/case-suv.jpg", alt: "Detalle de la iluminación y el audio en un SUV gris", title: "Audio e iluminación en SUV" },
      { type: "video", src: "assets/case-suv.mp4", poster: "assets/case-suv.jpg", alt: "Recorrido por la iluminación ambiental, el amplificador y el subwoofer del SUV gris", title: "Interior e instalación de audio" }
    ]
  }
];
