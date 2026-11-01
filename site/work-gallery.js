"use strict";

(() => {
  const wall = document.querySelector(".gallery-wall");
  const cards = [...document.querySelectorAll(".project-card")];
  const filters = [...document.querySelectorAll("[data-filter]")];
  const columnButtons = [...document.querySelectorAll(".layout-controls button[data-columns]")];
  const status = document.getElementById("filter-status");
  const dialog = document.getElementById("project-dialog");
  const image = document.getElementById("project-image");
  const video = document.getElementById("project-video");
  const mediaError = document.getElementById("project-media-error");
  const mediaSelector = document.getElementById("project-media-selector");
  const mediaRegion = dialog?.querySelector(".project-visual");
  const mediaStage = dialog?.querySelector(".lightbox-stage");
  const mediaTitle = document.getElementById("project-media-title");
  const title = document.getElementById("project-title");
  const summary = document.getElementById("project-summary");
  const steps = document.getElementById("project-steps");
  const serviceLinks = document.getElementById("project-service-links");
  const consultation = document.getElementById("project-consult");
  const counter = document.getElementById("project-counter");
  const previous = document.getElementById("project-prev");
  const next = document.getElementById("project-next");
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ui = window.LuquisoundUI;
  const cases = new Map((window.LuquisoundCases || []).map(project => [project.id, project]));
  const categories = { all: "Todos los trabajos", audio: "Audio", insonorizacion: "Insonorización", personalizacion: "Personalización" };
  let activeCard = null;
  let revealObserver = null;
  let restoringHistory = false;
  let leavingPage = false;

  if (!wall || !cards.length || !dialog || !image || !video || !mediaRegion || !mediaStage || !mediaSelector || !mediaError || !title || !counter || !previous || !next || !ui?.createMediaCarousel) return;

  const cardId = card => card.dataset.case || `foto-${card.dataset.index}`;
  const cardCategories = card => card.dataset.category.split(/\s+/);
  const matchesCategory = (card, category) => category === "all" || cardCategories(card).includes(category);

  function visibleCards() {
    return cards.filter(card => !card.hidden);
  }

  function navigationCards() {
    const visible = visibleCards();
    // A shared case may be opened while the gallery retains a different filter.
    return activeCard && !visible.includes(activeCard) ? [activeCard, ...visible] : visible;
  }

  function updateCardLinks() {
    cards.forEach(card => {
      const url = new URL(window.location.href);
      url.searchParams.set("trabajo", cardId(card));
      card.href = url.pathname + url.search;
    });
  }

  function applyFilter(category, updateUrl = false, revealCards = true) {
    const selectedCategory = Object.hasOwn(categories, category) ? category : "all";
    filters.forEach(button => {
      const selected = button.dataset.filter === selectedCategory;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    cards.forEach(card => {
      card.hidden = !matchesCategory(card, selectedCategory);
      if (!card.hidden && revealCards) card.classList.add("is-visible");
    });
    if (status) status.textContent = `${categories[selectedCategory]}: ${visibleCards().length} trabajos y fotografías.`;
    const url = new URL(window.location.href);
    if (selectedCategory === "all") url.searchParams.delete("categoria");
    else url.searchParams.set("categoria", selectedCategory);
    if (url.href !== window.location.href) {
      if (updateUrl) window.history.pushState(window.history.state, "", url);
      else window.history.replaceState(window.history.state, "", url);
    }
    updateCardLinks();
    updateCounter();
  }

  function applyColumns(columns, updateUrl = false) {
    const selectedColumns = columns === "2" ? "2" : "3";
    wall.dataset.columns = selectedColumns;
    columnButtons.forEach(button => {
      const selected = button.dataset.columns === selectedColumns;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    const url = new URL(window.location.href);
    if (selectedColumns === "3") url.searchParams.delete("columnas");
    else url.searchParams.set("columnas", selectedColumns);
    if (url.href !== window.location.href) {
      if (updateUrl) window.history.pushState(window.history.state, "", url);
      else window.history.replaceState(window.history.state, "", url);
    }
    updateCardLinks();
  }

  function releaseVideo() {
    video.pause();
    if (video.hasAttribute("src")) {
      video.removeAttribute("src");
      video.removeAttribute("poster");
      video.load();
    }
    video.hidden = true;
  }

  const carousel = ui.createMediaCarousel({
    region: mediaRegion,
    stage: mediaStage,
    image,
    controls: mediaSelector,
    error: mediaError,
    onShow(media) {
      releaseVideo();
      mediaStage.dataset.mediaType = media.type;
      if (media.type === "video") {
        video.setAttribute("aria-label", media.alt || media.title);
        video.poster = media.poster || "";
        video.src = media.src;
        video.hidden = false;
      }
      const type = media.type === "video" ? "Video" : "Foto";
      mediaTitle.textContent = media.title ? `${type} · ${media.title}` : type;
    }
  });

  function releaseMedia() {
    carousel.clear();
    releaseVideo();
    delete mediaStage.dataset.mediaType;
    mediaTitle.textContent = "";
  }

  function updateCounter() {
    if (!activeCard) return;
    const visible = navigationCards();
    counter.textContent = `${String(visible.indexOf(activeCard) + 1).padStart(2, "0")} / ${String(visible.length).padStart(2, "0")}`;
    previous.disabled = next.disabled = visible.length < 2;
  }

  function updateWorkUrl(push = false) {
    const url = new URL(window.location.href);
    url.searchParams.set("trabajo", cardId(activeCard));
    if (url.href === window.location.href) return;
    if (push) window.history.pushState({ ...window.history.state, luquisoundWork: true }, "", url);
    else window.history.replaceState(window.history.state, "", url);
  }

  function selectProject(card, updateUrl = true) {
    releaseMedia();
    activeCard = card;
    const project = cases.get(card.dataset.case);
    const sourceImage = card.querySelector("img");
    title.textContent = project?.title || card.dataset.title || "Luquisound";
    if (project) dialog.setAttribute("aria-describedby", "project-summary");
    else dialog.removeAttribute("aria-describedby");
    summary.textContent = project?.summary || "";
    summary.hidden = !project;
    steps.replaceChildren();
    steps.hidden = !project;
    (project?.steps || []).forEach(step => {
      const item = document.createElement("li");
      item.textContent = step;
      steps.append(item);
    });
    serviceLinks.replaceChildren();
    serviceLinks.hidden = !project?.serviceRefs.length;
    (project?.serviceRefs || []).forEach(service => {
      const link = document.createElement("a");
      link.href = `servicios.html?servicio=${service}`;
      link.textContent = categories[service];
      serviceLinks.append(link);
    });
    consultation.hidden = !project;
    consultation.href = project?.serviceRefs.length === 1
      ? `contacto.html?interes=${encodeURIComponent(categories[project.serviceRefs[0]])}`
      : "contacto.html";
    const media = project?.media || [{ type: "image", src: sourceImage.getAttribute("src"), alt: sourceImage.alt, title: title.textContent }];
    dialog.classList.toggle("has-case", Boolean(project));
    carousel.setItems(media);
    updateCounter();
    if (updateUrl) updateWorkUrl();
  }

  function openProject(card, pushHistory = true) {
    if (typeof dialog.showModal !== "function") return false;
    selectProject(card, false);
    const opener = card.hidden ? filters.find(button => button.classList.contains("is-active")) : card;
    if (!ui.openDialog(dialog, opener)) return false;
    if (pushHistory) updateWorkUrl(true);
    return true;
  }

  function navigateProject(direction) {
    const visible = navigationCards();
    if (!visible.length) return;
    const index = (visible.indexOf(activeCard) + direction + visible.length) % visible.length;
    selectProject(visible[index]);
    if (!dialog.contains(document.activeElement)) {
      (direction < 0 ? previous : next).focus({ preventScroll: true });
    }
  }

  cards.forEach(card => {
    card.addEventListener("click", event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (openProject(card)) event.preventDefault();
    });
  });
  previous.addEventListener("click", () => navigateProject(-1));
  next.addEventListener("click", () => navigateProject(1));
  dialog.addEventListener("keydown", event => {
    if (event.defaultPrevented || event.target.closest("video") || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    navigateProject(event.key === "ArrowLeft" ? -1 : 1);
  });
  filters.forEach(button => {
    const count = button.querySelector("[data-count]");
    if (count) count.textContent = String(cards.filter(card => matchesCategory(card, button.dataset.filter)).length).padStart(2, "0");
    button.addEventListener("click", () => applyFilter(button.dataset.filter, true));
  });
  columnButtons.forEach(button => button.addEventListener("click", () => applyColumns(button.dataset.columns, true)));

  function restoreLocation(revealCards = true) {
    const query = new URLSearchParams(window.location.search);
    applyFilter(query.get("categoria"), false, revealCards);
    applyColumns(query.get("columnas"));
    const requestedCard = cards.find(card => cardId(card) === query.get("trabajo"));
    if (requestedCard) {
      if (activeCard !== requestedCard || !dialog.open) openProject(requestedCard, false);
    } else if (dialog.open) {
      restoringHistory = true;
      ui.closeDialog(dialog);
    }
  }

  dialog.addEventListener("close", () => {
    releaseMedia();
    activeCard = null;
    if (restoringHistory) {
      restoringHistory = false;
      return;
    }
    if (leavingPage) return;
    if (window.history.state?.luquisoundWork) {
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("trabajo");
    window.history.replaceState(window.history.state, "", url);
  });
  window.addEventListener("popstate", () => restoreLocation());
  window.addEventListener("pagehide", () => {
    leavingPage = true;
    releaseMedia();
  });
  window.addEventListener("pageshow", event => {
    leavingPage = false;
    if (event.persisted) {
      activeCard = null;
      restoreLocation();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) video.pause();
  });
  video.addEventListener("error", () => { if (!video.hidden) mediaError.hidden = false; });

  function applyMotionPreference() {
    revealObserver?.disconnect();
    document.body.classList.remove("gallery-motion");
    if (motionPreference.matches || !("IntersectionObserver" in window)) {
      cards.forEach(card => card.classList.add("is-visible"));
      return;
    }
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .06, rootMargin: "0px 0px 50px 0px" });
    cards.forEach(card => revealObserver.observe(card));
    document.body.classList.add("gallery-motion");
  }

  restoreLocation(false);
  applyMotionPreference();
  motionPreference.addEventListener("change", applyMotionPreference);
  document.querySelectorAll("[data-gallery-controls]").forEach(element => { element.hidden = false; });
})();
