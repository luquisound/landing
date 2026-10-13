"use strict";

(() => {
  const dialog = document.getElementById("service-dialog");
  if (!dialog) return;

  const services = {
    insonorizacion: {
      title: "Insonorización",
      description: "Tratamiento de puertas y preparación del montaje de los parlantes, cuidando los materiales y la terminación del interior.",
      topics: [
        ["Tratamiento de puertas", "Aplicación de material insonorizante en las puertas como parte de la intervención del sistema de audio."],
        ["Materiales y preparación", "Acceso al interior de la puerta, preparación de las superficies y colocación del tratamiento en las zonas de trabajo."],
        ["Montaje y terminación", "Instalación de los parlantes y armado del panel, conservando una terminación integrada al vehículo."]
      ],
      caseIds: ["bmw-335i", "chevrolet-corsa"]
    },
    audio: {
      title: "Audio",
      description: "Instalaciones de audio adaptadas al vehículo: componentes, integración de los equipos y ajuste del sistema.",
      topics: [
        ["Parlantes y amplificación", "Montaje de parlantes y amplificadores, con soportes y ubicaciones acordes al interior y a la instalación."],
        ["Subwoofers e integración", "Equipos bajo asientos o en el baúl, cajas de subwoofer, compartimentos accesibles y controles al alcance del usuario."],
        ["Calibración y ajuste DSP", "Configuración del procesador y medición con micrófono, computadora e instrumental para ajustar el sistema instalado."]
      ],
      caseIds: ["golf-r32", "peugeot-206", "abarth-dsp", "bmw-335i", "chevrolet-corsa"]
    },
    personalizacion: {
      title: "Personalización",
      description: "Iluminación y multimedia integradas al habitáculo, con atención a los controles y a las terminaciones del vehículo.",
      topics: [
        ["Iluminación ambiental", "Detalles de luz en tablero y puertas, con cambios de color y controles integrados según la intervención."],
        ["Cielo estrellado", "Puntos de iluminación en el techo para transformar la presentación del interior."],
        ["Pantallas y conectividad", "Integración de pantallas multimedia y funciones como CarPlay, según la compatibilidad del vehículo y del equipo."]
      ],
      caseIds: ["mercedes-c63s", "bmw-335i", "suv-gris"],
      clipByCase: { "bmw-335i": "assets/case-bmw-interior.mp4" }
    }
  };

  const image = document.getElementById("service-dialog-image");
  const video = document.getElementById("service-dialog-video");
  const evidence = document.getElementById("service-dialog-evidence");
  const caption = document.getElementById("service-dialog-caption");
  const picker = document.getElementById("service-dialog-clips");
  const topics = document.getElementById("service-dialog-topics");
  const related = document.getElementById("service-dialog-related");
  const links = document.getElementById("service-dialog-work-links");

  function releaseVideo() {
    video.pause();
    video.removeAttribute("src");
    video.removeAttribute("poster");
    video.load();
  }

  function selectClip(work, media, button) {
    releaseVideo();
    image.hidden = true;
    evidence.hidden = false;
    video.src = media.src;
    if (media.poster) video.poster = media.poster;
    video.setAttribute("aria-label", "Video del trabajo " + work.title);
    const title = document.createElement("strong");
    title.textContent = work.title;
    const description = document.createElement("span");
    description.textContent = media.title || work.summary;
    caption.replaceChildren(title, description);
    picker.querySelectorAll("button").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
  }

  function prepare(card) {
    const id = card.dataset.openService;
    const service = services[id];
    if (!service) return null;
    releaseVideo();
    image.hidden = false;
    evidence.hidden = true;
    const cardImage = card.querySelector("img");
    image.src = cardImage.getAttribute("src");
    image.alt = cardImage.alt;
    document.getElementById("service-dialog-title").textContent = service.title;
    document.getElementById("service-dialog-description").textContent = service.description;
    document.getElementById("service-dialog-examples").hidden = true;
    const cta = "contacto.html?interes=" + encodeURIComponent(service.title);
    document.getElementById("service-dialog-cta").href = cta;

    topics.replaceChildren(...service.topics.map(([title, description]) => {
      const item = document.createElement("li");
      const heading = document.createElement("h3");
      const paragraph = document.createElement("p");
      heading.textContent = title;
      paragraph.textContent = description;
      item.append(heading, paragraph);
      return item;
    }));

    const cases = Array.isArray(window.LuquisoundCases) ? window.LuquisoundCases : [];
    const works = service.caseIds.map(caseId => cases.find(work => work.id === caseId)).filter(Boolean);
    links.replaceChildren(...works.map(work => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      const arrow = document.createElement("span");
      arrow.textContent = "↗";
      arrow.setAttribute("aria-hidden", "true");
      link.href = "trabajos.html?trabajo=" + encodeURIComponent(work.id);
      link.append(document.createTextNode(work.title), arrow);
      item.append(link);
      return item;
    }));
    related.hidden = works.length === 0;
    const allWork = document.getElementById("service-dialog-all-work");
    allWork.href = "trabajos.html?categoria=" + encodeURIComponent(id);
    allWork.replaceChildren(document.createTextNode("Ver todos los trabajos de " + service.title + " "));
    const arrow = document.createElement("span");
    arrow.textContent = "↗";
    arrow.setAttribute("aria-hidden", "true");
    allWork.append(arrow);

    picker.replaceChildren();
    const clips = works.map(work => {
      const videos = work.media.filter(item => item.type === "video");
      return { work, media: videos.find(item => item.src === service.clipByCase?.[work.id]) || videos[0] };
    }).filter(item => item.media);
    clips.forEach(({ work, media }, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = work.title;
      button.setAttribute("aria-pressed", String(index === 0));
      button.addEventListener("click", () => selectClip(work, media, button));
      picker.append(button);
      if (index === 0) selectClip(work, media, button);
    });
    picker.hidden = clips.length < 2;
    return { name: service.title, title: service.title, cta };
  }

  dialog.addEventListener("close", releaseVideo);
  window.addEventListener("pagehide", releaseVideo);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) video.pause();
  });
  window.LuquisoundServices = { prepare };
})();
