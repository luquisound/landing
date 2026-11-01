"use strict";

(() => {
  const dialog = document.getElementById("service-dialog");
  if (!dialog) return;

  const services = {
    insonorizacion: {
      title: "Insonorización",
      description: "Tratamientos en puertas, piso y techo que ayudan a reducir ruidos y vibraciones para viajar en un habitáculo más confortable.",
      topics: [],
      caseIds: ["ford-mustang-insonorizacion", "bmw-335i", "chevrolet-silverado-insonorizacion", "chevrolet-corsa"]
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
  const stage = document.getElementById("service-dialog-stage");
  const mediaError = document.getElementById("service-dialog-error");
  const caption = document.getElementById("service-dialog-caption");
  const picker = document.getElementById("service-dialog-clips");
  const mediaPicker = document.getElementById("service-dialog-media");
  const topics = document.getElementById("service-dialog-topics");
  const soundproofing = document.getElementById("service-dialog-soundproofing");
  const related = document.getElementById("service-dialog-related");
  const links = document.getElementById("service-dialog-work-links");
  const videoRetry = document.createElement("button");
  videoRetry.id = "service-video-retry";
  videoRetry.type = "button";
  videoRetry.className = "media-carousel-retry";
  videoRetry.textContent = "Reintentar";
  videoRetry.hidden = true;
  let carousel;
  let activeWork;

  function releaseVideo() {
    mediaError.hidden = true;
    videoRetry.hidden = true;
    video.pause();
    video.removeAttribute("src");
    video.removeAttribute("poster");
    video.load();
    video.hidden = true;
  }

  function showMedia(media) {
    releaseVideo();
    evidence.hidden = false;
    if (media.type === "video") {
      video.src = media.src;
      if (media.poster) video.poster = media.poster;
      video.setAttribute("aria-label", media.alt || "Video del trabajo " + activeWork.title);
      video.hidden = false;
    }
    const title = document.createElement("strong");
    title.textContent = activeWork.title;
    const description = document.createElement("span");
    description.textContent = media.title || activeWork.summary;
    caption.replaceChildren(title, description);
    caption.hidden = false;
  }

  function getCarousel() {
    if (!carousel) {
      carousel = window.LuquisoundUI.createMediaCarousel({
        region: evidence,
        stage,
        image,
        controls: mediaPicker,
        error: mediaError,
        onShow: showMedia
      });
      mediaPicker.append(videoRetry);
    }
    return carousel;
  }

  video.addEventListener("error", () => {
    if (video.hidden || !dialog.open || !video.error) return;
    mediaError.textContent = "No se pudo cargar el video. Podés reintentar o elegir otro trabajo.";
    mediaError.hidden = false;
    videoRetry.hidden = false;
    mediaPicker.hidden = false;
  });
  videoRetry.addEventListener("click", async () => {
    await carousel.show(0);
    if (video.hidden) return;
    video.focus();
    video.play().catch(() => {});
  });

  function selectWork(work, media, button) {
    picker.querySelectorAll("button").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    releaseVideo();
    activeWork = work;
    getCarousel().setItems(media);
  }

  function releaseMedia() {
    carousel?.clear();
    releaseVideo();
  }

  function prepare(card) {
    const id = card.dataset.openService;
    const service = services[id];
    if (!service) return null;
    dialog.dataset.service = id;
    soundproofing.hidden = id !== "insonorizacion";
    soundproofing.querySelectorAll("details").forEach(item => { item.open = false; });
    topics.hidden = service.topics.length === 0;
    related.querySelector("h3").textContent = id === "insonorizacion" ? "Trabajos de insonorización" : "Trabajos relacionados";
    releaseMedia();
    image.hidden = true;
    image.removeAttribute("src");
    evidence.hidden = false;
    caption.hidden = true;
    const cardImage = card.querySelector("img");
    document.getElementById("service-dialog-title").textContent = service.title;
    document.getElementById("service-dialog-description").textContent = service.description;
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
    const examples = works.map(work => {
      const videos = work.media.filter(item => item.type === "video");
      const clip = videos.find(item => item.src === service.clipByCase?.[work.id]) || videos[0];
      return { work, media: clip ? [clip] : work.media.filter(item => item.type === "image") };
    }).filter(item => item.media.length);
    examples.forEach(({ work, media }, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = work.title;
      button.setAttribute("aria-pressed", String(index === 0));
      button.addEventListener("click", () => selectWork(work, media, button));
      picker.append(button);
      if (index === 0) selectWork(work, media, button);
    });
    picker.hidden = examples.length < 2;
    if (!examples.length) {
      activeWork = service;
      getCarousel().setItems([{ type: "image", src: cardImage.getAttribute("src"), alt: cardImage.alt, title: service.title }]);
    }
    return { name: service.title, title: service.title, cta };
  }

  dialog.addEventListener("close", releaseMedia);
  window.addEventListener("pagehide", releaseMedia);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) video.pause();
  });
  window.LuquisoundServices = { prepare };
})();
