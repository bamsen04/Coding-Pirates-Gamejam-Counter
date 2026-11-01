import { byId } from "./dom";
import { postJson } from "./http";

// The + button, the modal with the message form, and the cooldown between messages.
const COOLDOWN_MS = 10 * 60 * 1000;
const STORAGE_KEY = "gamejam_last_sent";

const fab = byId<HTMLButtonElement>("fab");
const modal = byId("message-modal");
const form = byId<HTMLFormElement>("message-form");
const authorInput = byId<HTMLInputElement>("message-author");
const textInput = byId<HTMLTextAreaElement>("message-text");
const errorEl = byId("message-error");
const closeBtn = byId("message-close");

// For the display screen: no button.
if (window.location.hash === "#nofab") {
    fab.style.display = "none";
}

function remainingCooldown(): number {
    const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
    return Math.max(COOLDOWN_MS - (Date.now() - last), 0);
}

function formatCooldown(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function updateFab() {
    const remaining = remainingCooldown();
    const cooling = remaining > 0;

    fab.disabled = cooling;
    fab.textContent = cooling ? formatCooldown(remaining) : "+";
    fab.classList.toggle("opacity-50", cooling);
    fab.classList.toggle("cursor-not-allowed", cooling);
    fab.classList.toggle("text-sm", cooling);
    fab.classList.toggle("text-3xl", !cooling);
}

function openModal() {
    errorEl.textContent = "";
    form.reset();
    modal.classList.remove("hidden");
    authorInput.focus();
}

function closeModal() {
    modal.classList.add("hidden");
}

fab.addEventListener("click", () => {
    if (!fab.disabled) openModal();
});
closeBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (remainingCooldown() > 0) return;

    const author = authorInput.value.trim();
    const message = textInput.value.trim();
    if (!author || !message) return;

    const turnstileToken = form.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')?.value;

    try {
        const res = await postJson("/messages", { author, message, "cf-turnstile-response": turnstileToken });
        window.turnstile?.reset();
        if (!res.ok) throw new Error("request failed");

        localStorage.setItem(STORAGE_KEY, String(Date.now()));
        closeModal();
        updateFab();
    } catch {
        errorEl.textContent = "Noget gik galt. Prøv igen.";
    }
});

updateFab();
setInterval(updateFab, 1000);
