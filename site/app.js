"use strict";

const header = document.getElementById("site-header");
const navigation = document.getElementById("navigation");
const menuToggle = document.getElementById("menu-toggle");
const video = document.getElementById("hero-video");
const hero = document.querySelector(".hero");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const serviceDialog = document.getElementById("service-dialog");
const contactDialog = document.getElementById("contact-dialog");
const consultationForm = document.getElementById("consultation-form");
const preview = document.getElementById("consultation-preview");
const previewMessage = document.getElementById("preview-message");
const copyStatus = document.getElementById("copy-status");
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
window.LuquisoundUI = { openDialog, closeDialog };

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
    document.getElementById("service-dialog-examples").hidden = true;
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

function showConsultation(interest, opener) {
  if (!contactDialog || typeof contactDialog.showModal !== "function") return false;
  if (interest) document.getElementById("interest").value = interest;
  consultationForm.hidden = false;
  preview.hidden = true;
  copyStatus.textContent = "Tu consulta está lista para revisar. No se envió ningún mensaje.";
  return openDialog(contactDialog, opener);
}

document.querySelectorAll("[data-open-contact]").forEach((element) => {
  element.addEventListener("click", (event) => {
    if (showConsultation(element.dataset.interest, element)) event.preventDefault();
    setMenu(false);
  });
});
if (consultationForm) {
  const selectedInterest = new URLSearchParams(location.search).get("interes");
  const interestField = document.getElementById("interest");
  const requiredFields = [document.getElementById("vehicle"), document.getElementById("idea")];
  if ([...interestField.options].some(option => option.value === selectedInterest)) interestField.value = selectedInterest;
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
    consultationForm.hidden = true;
    preview.hidden = false;
    document.getElementById("copy-consultation").focus();
  });
  document.getElementById("edit-consultation").addEventListener("click", () => {
    preview.hidden = true;
    consultationForm.hidden = false;
    document.getElementById("vehicle").focus();
  });
  document.getElementById("copy-consultation").addEventListener("click", async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(previewMessage.value);
      copyStatus.textContent = "Mensaje copiado. No se envió ninguna consulta.";
    } catch {
      previewMessage.focus();
      previewMessage.select();
      copyStatus.textContent = "Seleccionamos el mensaje para que puedas copiarlo. No se envió ninguna consulta.";
    }
  });
}

document.querySelectorAll("[data-app-only]").forEach(element => { element.hidden = false; });
