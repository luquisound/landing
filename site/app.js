"use strict";

const header = document.getElementById("site-header");
const navigation = document.getElementById("navigation");
const menuToggle = document.getElementById("menu-toggle");
const video = document.getElementById("hero-video");
const hero = document.querySelector(".hero");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const serviceDialog = document.getElementById("service-dialog");
const consultationForm = document.getElementById("consultation-form");
const preview = document.getElementById("consultation-preview");
const previewMessage = document.getElementById("preview-message");
const copyStatus = document.getElementById("copy-status");
const whatsappConsultation = document.getElementById("whatsapp-consultation");
const whatsappBaseUrl = whatsappConsultation?.href;
const consultationReadyStatus = "Revisá tu consulta. El mensaje se envía cuando lo confirmás en WhatsApp.";
const desktopNavigation = window.matchMedia("(min-width: 1000px)");
const dialogOpeners = new WeakMap();
let heroSource = "";
let heroLoadFailed = false;

document.documentElement.classList.add("js");

function setMenu(open) {
  if (!header || !navigation || !menuToggle) return;
  open = open && !desktopNavigation.matches;
  navigation.classList.toggle("is-open", open);
  header.classList.toggle("menu-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.innerHTML = open ? 'Cerrar <span aria-hidden="true">−</span>' : 'Menú <span aria-hidden="true">+</span>';
}

if (header && navigation && menuToggle) {
  menuToggle.hidden = false;
  menuToggle.addEventListener("click", () => setMenu(menuToggle.getAttribute("aria-expanded") !== "true"));
  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenu(false);
  });
  document.addEventListener("click", (event) => {
    if (menuToggle.getAttribute("aria-expanded") === "true" && !header.contains(event.target)) setMenu(false);
  });
  desktopNavigation.addEventListener("change", () => setMenu(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      menuToggle.focus();
    }
  });
  window.addEventListener("scroll", () => header.classList.toggle("is-scrolled", window.scrollY > 40), { passive: true });
  header.classList.toggle("is-scrolled", window.scrollY > 40);
}

function syncDialogState() {
  document.body.classList.toggle("dialog-open", Boolean(document.querySelector("dialog[open]")));
}

function openDialog(dialog, opener = document.activeElement) {
  if (!dialog || typeof dialog.showModal !== "function") return false;
  setMenu(false);
  if (!dialog.open) {
    dialogOpeners.set(dialog, opener);
    dialog.showModal();
  }
  syncDialogState();
  return true;
}

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog);
  });
  dialog.addEventListener("close", () => {
    syncDialogState();
    const opener = dialogOpeners.get(dialog);
    if (!document.querySelector("dialog[open]") && opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true });
  });
});
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => closeDialog(button.closest("dialog")));
});
function createMediaCarousel({ region, stage, image, controls, error, onShow }) {
  let items = [];
  let displayedIndex = -1;
  let requestedIndex = -1;
  let generation = 0;
  let motionVersion = 0;
  let preparedImages = new Map();
  let swipe = null;
  const animations = new Set();
  const previous = document.createElement("button");
  const next = document.createElement("button");
  const counter = document.createElement("span");
  const announcement = document.createElement("span");
  const retry = document.createElement("button");
  previous.type = next.type = retry.type = "button";
  previous.textContent = "←";
  next.textContent = "→";
  previous.setAttribute("aria-label", "Foto o video anterior");
  next.setAttribute("aria-label", "Foto o video siguiente");
  counter.className = "media-carousel-counter";
  counter.setAttribute("aria-hidden", "true");
  announcement.className = "sr-only";
  announcement.setAttribute("aria-live", "polite");
  announcement.setAttribute("aria-atomic", "true");
  retry.className = "media-carousel-retry";
  retry.textContent = "Reintentar";
  retry.hidden = true;
  controls.classList.add("media-carousel-controls");
  controls.replaceChildren(previous, counter, next, retry, announcement);
  region.setAttribute("role", "group");
  region.setAttribute("aria-roledescription", "carrusel");
  if (!region.hasAttribute("aria-label") && !region.hasAttribute("aria-labelledby")) region.setAttribute("aria-label", "Fotos y videos del trabajo");
  stage.classList.add("media-carousel-stage");
  stage.tabIndex = 0;

  function cancelMotion() {
    motionVersion += 1;
    animations.forEach(animation => animation.cancel());
    animations.clear();
    stage.style.removeProperty("height");
    stage.style.removeProperty("overflow");
    image.style.removeProperty("opacity");
  }

  async function animate(element, keyframes, duration) {
    if (!element.animate || reducedMotion.matches || document.hidden) return;
    const animation = element.animate(keyframes, { duration, easing: "cubic-bezier(.16, 1, .3, 1)", fill: "forwards" });
    animations.add(animation);
    await animation.finished.catch(() => {});
    animations.delete(animation);
    animation.cancel();
  }

  function loadPhoto(media) {
    const cache = preparedImages;
    if (!cache.has(media.src)) {
      const prepared = new Image();
      prepared.src = media.src;
      const ready = prepared.decode().then(() => prepared).catch(cause => {
        cache.delete(media.src);
        throw cause;
      });
      cache.set(media.src, ready);
    }
    return cache.get(media.src);
  }

  function updateControls() {
    controls.hidden = items.length < 2;
    previous.disabled = next.disabled = items.length < 2;
    counter.textContent = `${displayedIndex < 0 ? "—" : displayedIndex + 1} / ${items.length}`;
  }

  function commit(media, index, prepared) {
    image.hidden = media.type !== "image";
    if (media.type === "image") {
      stage.style.setProperty("--media-ratio", String(prepared.naturalWidth / prepared.naturalHeight));
      image.width = prepared.naturalWidth;
      image.height = prepared.naturalHeight;
      image.src = media.src;
      image.alt = media.alt || media.title || "Fotografía del trabajo";
    } else {
      stage.style.removeProperty("--media-ratio");
    }
    onShow(media, index);
    displayedIndex = index;
    updateControls();
    announcement.textContent = `${media.type === "video" ? "Video" : "Foto"} ${index + 1} de ${items.length}: ${media.title || media.alt || "Trabajo Luquisound"}`;
    for (const offset of [-1, 1]) {
      const adjacent = items[(index + offset + items.length) % items.length];
      if (adjacent?.type === "image") loadPhoto(adjacent).catch(() => {});
    }
  }

  async function select(index, animated) {
    if (!items.length) return;
    requestedIndex = (index % items.length + items.length) % items.length;
    const selection = requestedIndex;
    const media = items[selection];
    const request = ++generation;
    cancelMotion();
    const motion = motionVersion;
    const canAnimate = () => animated && motion === motionVersion && !reducedMotion.matches && !document.hidden;
    error.hidden = true;
    retry.hidden = true;
    stage.setAttribute("aria-busy", "true");
    try {
      const prepared = media.type === "image" ? await loadPhoto(media) : null;
      if (request !== generation) return;
      const previousPhoto = displayedIndex >= 0 && !image.hidden;
      if (canAnimate() && previousPhoto && media.type === "image") {
        await animate(image, [{ opacity: 1 }, { opacity: 0 }], 90);
        if (request !== generation) return;
        if (canAnimate()) image.style.opacity = "0";
        const fromHeight = stage.getBoundingClientRect().height;
        commit(media, selection, prepared);
        // The displayed image can retain its previous intrinsic size just after src changes.
        const toHeight = stage.getBoundingClientRect().width * prepared.naturalHeight / prepared.naturalWidth;
        if (canAnimate() && Math.abs(fromHeight - toHeight) > 1) {
          stage.style.height = `${toHeight}px`;
          stage.style.overflow = "hidden";
          await animate(stage, [{ height: `${fromHeight}px` }, { height: `${toHeight}px` }], 120);
          if (request !== generation) return;
        }
        stage.style.removeProperty("height");
        stage.style.removeProperty("overflow");
        if (canAnimate()) await animate(image, [{ opacity: 0 }, { opacity: 1 }], 120);
      } else {
        commit(media, selection, prepared);
      }
      if (request !== generation) return;
      image.style.removeProperty("opacity");
      stage.removeAttribute("aria-busy");
    } catch {
      if (request !== generation) return;
      cancelMotion();
      stage.removeAttribute("aria-busy");
      error.textContent = "No se pudo cargar la imagen. Podés reintentar o elegir otra con las flechas.";
      error.hidden = false;
      retry.hidden = false;
      controls.hidden = false;
      requestedIndex = displayedIndex;
      retry.onclick = () => select(selection, true);
    }
  }

  function show(index) {
    return select(index, true);
  }

  function navigate(direction) {
    if (items.length) show((requestedIndex < 0 ? 0 : requestedIndex) + direction);
  }

  function clear() {
    generation += 1;
    cancelMotion();
    items = [];
    displayedIndex = requestedIndex = -1;
    preparedImages = new Map();
    swipe = null;
    error.hidden = true;
    image.hidden = true;
    image.removeAttribute("src");
    stage.style.removeProperty("--media-ratio");
    retry.hidden = true;
    retry.onclick = null;
    controls.hidden = true;
    announcement.textContent = "";
    stage.removeAttribute("aria-busy");
  }

  function setItems(media) {
    clear();
    items = media;
    updateControls();
    return select(0, false);
  }

  previous.addEventListener("click", () => navigate(-1));
  next.addEventListener("click", () => navigate(1));
  region.addEventListener("keydown", event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || items.length < 2) return;
    if (!stage.contains(event.target) && !controls.contains(event.target)) return;
    if (event.target.closest("video, input, select, textarea, [contenteditable]")) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    navigate(event.key === "ArrowLeft" ? -1 : 1);
  });
  stage.addEventListener("pointerdown", event => {
    if (!event.isPrimary) {
      swipe = null;
      return;
    }
    if (!["touch", "pen"].includes(event.pointerType) || items.length < 2 || image.hidden || event.target.closest("video")) return;
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener("pointermove", event => {
    if (swipe?.id === event.pointerId && Math.abs(event.clientY - swipe.y) > 20 && Math.abs(event.clientY - swipe.y) > Math.abs(event.clientX - swipe.x)) swipe = null;
  });
  stage.addEventListener("pointerup", event => {
    const gesture = swipe;
    swipe = null;
    if (!gesture || gesture.id !== event.pointerId) return;
    const horizontal = event.clientX - gesture.x;
    const vertical = event.clientY - gesture.y;
    if (Math.abs(horizontal) >= 40 && Math.abs(horizontal) > Math.abs(vertical) * 1.5) navigate(horizontal < 0 ? 1 : -1);
  });
  stage.addEventListener("pointercancel", () => { swipe = null; });
  stage.addEventListener("lostpointercapture", () => { swipe = null; });
  stage.addEventListener("dragstart", event => { if (event.target === image) event.preventDefault(); });
  window.addEventListener("resize", cancelMotion);
  reducedMotion.addEventListener("change", cancelMotion);
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancelMotion(); });
  clear();
  return { setItems, show, clear };
}

window.LuquisoundUI = { openDialog, closeDialog, createMediaCarousel };

function applyMotionPreference() {
  if (!video || !hero) return;
  const source = desktopNavigation.matches ? video.dataset.desktopSource : video.dataset.mobileSource;
  const poster = desktopNavigation.matches ? video.dataset.desktopPoster : video.dataset.mobilePoster;
  video.poster = poster;
  if (source !== heroSource) {
    video.pause();
    video.removeAttribute("src");
    video.load();
    heroSource = source;
    heroLoadFailed = false;
  }
  hero.classList.toggle("hero-video-reduced", reducedMotion.matches || heroLoadFailed);
  if (reducedMotion.matches || document.hidden || heroLoadFailed) {
    video.pause();
    return;
  }
  if (!video.hasAttribute("src")) {
    video.src = source;
    video.load();
  }
  video.play().catch(error => {
    if (error.name === "AbortError" || source !== heroSource) return;
    heroLoadFailed = true;
    applyMotionPreference();
  });
}

if (video) {
  video.addEventListener("error", () => {
    if (!video.hasAttribute("src")) return;
    heroLoadFailed = true;
    applyMotionPreference();
  });
  reducedMotion.addEventListener("change", applyMotionPreference);
  desktopNavigation.addEventListener("change", applyMotionPreference);
  document.addEventListener("visibilitychange", applyMotionPreference);
  applyMotionPreference();
}

const serviceCards = [...document.querySelectorAll("[data-open-service]")];
let restoringServiceHistory = false;
let leavingPage = false;
function openService(card, updateHistory = true) {
  if (!serviceDialog || !card || typeof serviceDialog.showModal !== "function") return false;
  const name = card.querySelector(".work-name").textContent;
  if (!window.LuquisoundServices?.prepare(card)) {
    const image = card.querySelector("img");
    const dialogImage = document.getElementById("service-dialog-image");
    dialogImage.src = image.getAttribute("src");
    dialogImage.alt = image.alt;
    document.getElementById("service-dialog-title").textContent = name;
    document.getElementById("service-dialog-description").textContent = "Conocé los detalles de este servicio y consultanos por tu vehículo.";
    document.getElementById("service-dialog-cta").href = "contacto.html?interes=" + encodeURIComponent(name);
  }
  const url = new URL(location.href);
  url.searchParams.set("servicio", card.dataset.openService);
  if (updateHistory && url.href !== location.href) history.pushState({ ...history.state, luquisoundService: true }, "", url);
  return openDialog(serviceDialog, card);
}
serviceCards.forEach(card => card.addEventListener("click", (event) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (openService(card)) event.preventDefault();
}));
if (serviceDialog) {
  function restoreService() {
    const requestedService = new URLSearchParams(location.search).get("servicio");
    const card = serviceCards.find(card => card.dataset.openService === requestedService);
    if (card) openService(card, false);
    else if (serviceDialog.open) {
      restoringServiceHistory = true;
      closeDialog(serviceDialog);
    }
  }
  serviceDialog.addEventListener("close", () => {
    if (restoringServiceHistory) {
      restoringServiceHistory = false;
      return;
    }
    if (leavingPage) return;
    if (history.state?.luquisoundService) {
      const opener = dialogOpeners.get(serviceDialog);
      window.addEventListener("popstate", () => {
        requestAnimationFrame(() => {
          if (!leavingPage && !document.querySelector("dialog[open]") && opener?.isConnected && opener.getClientRects().length) {
            opener.focus({ preventScroll: true });
          }
        });
      }, { once: true });
      history.back();
      return;
    }
    const url = new URL(location.href);
    url.searchParams.delete("servicio");
    history.replaceState(history.state, "", url);
  });
  window.addEventListener("popstate", restoreService);
  window.addEventListener("pagehide", () => { leavingPage = true; });
  window.addEventListener("pageshow", () => {
    leavingPage = false;
    restoreService();
  });
  restoreService();
}

if (consultationForm) {
  const selectedInterest = new URLSearchParams(location.search).get("interes");
  const interestField = document.getElementById("interest");
  const requiredFields = [document.getElementById("vehicle"), document.getElementById("idea")];
  const hasSelectedInterest = [...interestField.options].some(option => option.value === selectedInterest);
  if (hasSelectedInterest) interestField.value = selectedInterest;
  const contactShell = consultationForm.closest(".contact-shell");
  const floatingNavigation = document.querySelector(".floating-nav");
  let consultationFocusFrame = 0;
  function keepConsultationFocusVisible(element) {
    cancelAnimationFrame(consultationFocusFrame);
    if (!element?.matches("input, select, textarea, button, a") || !contactShell.contains(element)) return;
    consultationFocusFrame = requestAnimationFrame(() => {
      if (document.activeElement !== element || !element.isConnected) return;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const viewportTop = window.visualViewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (window.visualViewport?.height ?? window.innerHeight);
      const navigationRect = floatingNavigation?.getBoundingClientRect();
      const navigationVisible = navigationRect && navigationRect.bottom > viewportTop && navigationRect.top < viewportBottom;
      const safeTop = viewportTop + 24;
      const safeBottom = navigationVisible ? Math.min(viewportBottom - 24, navigationRect.top - 16) : viewportBottom - 24;
      if (rect.top >= safeTop && rect.bottom <= safeBottom) return;
      const desiredTop = safeTop + Math.max(0, (safeBottom - safeTop - rect.height) / 2);
      window.scrollBy({ top: rect.top - desiredTop, behavior: reducedMotion.matches ? "auto" : "smooth" });
    });
  }
  contactShell.addEventListener("focusin", event => keepConsultationFocusVisible(event.target));
  const restoreContactFocusVisibility = () => keepConsultationFocusVisible(document.activeElement);
  window.addEventListener("resize", restoreContactFocusVisibility);
  window.visualViewport?.addEventListener("resize", restoreContactFocusVisibility);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted || !hasSelectedInterest) return;
    document.getElementById("vehicle").focus({ preventScroll: true });
  });
  requiredFields.forEach(field => field.addEventListener("input", () => field.setCustomValidity("")));
  consultationForm.addEventListener("submit", (event) => {
    event.preventDefault();
    requiredFields.forEach(field => field.setCustomValidity(field.value.trim() ? "" : "Completá este campo."));
    if (!consultationForm.reportValidity()) return;
    const data = new FormData(consultationForm);
    const vehicle = String(data.get("vehicle")).trim();
    const interest = String(data.get("interest"));
    const idea = String(data.get("idea")).trim();
    previewMessage.value = `Hola Luquisound. Tengo un ${vehicle}.\n\nMe interesa: ${interest}.\n\nMi idea: ${idea}`;
    whatsappConsultation.href = whatsappBaseUrl + "?text=" + encodeURIComponent(previewMessage.value);
    copyStatus.textContent = consultationReadyStatus;
    consultationForm.hidden = true;
    preview.hidden = false;
    whatsappConsultation.focus();
  });
  document.getElementById("edit-consultation").addEventListener("click", () => {
    preview.hidden = true;
    consultationForm.hidden = false;
    previewMessage.value = "";
    whatsappConsultation.href = whatsappBaseUrl;
    copyStatus.textContent = consultationReadyStatus;
    document.getElementById("vehicle").focus();
  });
  document.getElementById("copy-consultation").addEventListener("click", async () => {
    const message = previewMessage.value;
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(message);
      if (preview.hidden || previewMessage.value !== message) return;
      copyStatus.textContent = "Mensaje copiado. No se envió ninguna consulta.";
    } catch {
      if (preview.hidden || previewMessage.value !== message) return;
      previewMessage.focus();
      previewMessage.select();
      copyStatus.textContent = "Seleccionamos el mensaje para que puedas copiarlo. No se envió ninguna consulta.";
    }
  });
  document.getElementById("consultation-fields").disabled = false;
}

document.querySelectorAll("[data-app-only]").forEach(element => { element.hidden = false; });
