import { byId } from "./dom";
import { getJson, postJson } from "./http";
import type { Me } from "./types";

// The + button and the modal. The modal has two steps:
//   1. "Er du på et hold?": type your hold's code, or press "Jeg er ikke på et hold".
//   2. The message form.
// Who you send as (a hold, frivillig, admin, or nobody) and the wait between messages are decided by
// the server; this just shows them. Admins and anyone already logged in to a hold skip step 1.
const fab = byId<HTMLButtonElement>("fab");
const modal = byId("message-modal");
const closeBtn = byId("message-close");

const gate = byId("gate");
const holdForm = byId<HTMLFormElement>("hold-form");
const holdToken = byId<HTMLInputElement>("hold-token");
const holdError = byId("hold-error");
const noHoldBtn = byId<HTMLButtonElement>("no-hold");

const compose = byId("compose");
const senderLabel = byId("sender-label");
const senderSwitch = byId<HTMLButtonElement>("sender-switch");
const form = byId<HTMLFormElement>("message-form");
const authorInput = byId<HTMLInputElement>("message-author");
const textInput = byId<HTMLTextAreaElement>("message-text");
const errorEl = byId("message-error");
const noteEl = byId("message-note");
const sendBtn = byId<HTMLButtonElement>("message-send");
const turnstileBox = document.getElementById("turnstile-box"); // missing when Turnstile is off

// For the display screen: no button.
if (window.location.hash === "#nofab") {
    fab.style.display = "none";
}

let me: Me = { kind: "none", label: "Ingen hold", banned: false, cooldownMs: 0 };
let cooldownEndsAt = 0;
// Set when someone presses "Jeg er ikke på et hold". Lasts until the page is reloaded.
let sendingWithoutHold = false;

const atGate = () => me.kind === "none" && !sendingWithoutHold;

function formatWait(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function focusStep() {
    (atGate() ? holdToken : authorInput).focus();
}

// Called every second while the modal is open, so the countdown moves.
function render() {
    const remaining = Math.max(cooldownEndsAt - Date.now(), 0);
    const withoutHold = me.kind === "none";

    gate.classList.toggle("hidden", !atGate());
    compose.classList.toggle("hidden", atGate());

    senderLabel.textContent = me.label;
    senderSwitch.hidden = me.kind === "admin";
    senderSwitch.textContent = withoutHold ? "Jeg er på et hold" : "Skift hold";
    turnstileBox?.classList.toggle("hidden", !withoutHold);

    let note = "";
    if (me.banned) {
        note = "Dit hold er spærret og kan ikke sende beskeder.";
    } else if (remaining > 0) {
        note = withoutHold
            ? `Du kan sende igen om ${formatWait(remaining)}.`
            : `Dit hold kan sende igen om ${formatWait(remaining)}.`;
    } else if (withoutHold) {
        note = "Uden hold kan man sende 1 besked hver 10. minut.";
    }
    noteEl.textContent = note;

    const blocked = me.banned || remaining > 0;
    sendBtn.disabled = blocked;
    sendBtn.textContent = !me.banned && remaining > 0 ? `Vent ${formatWait(remaining)}` : "Send";
    sendBtn.classList.toggle("opacity-50", blocked);
    sendBtn.classList.toggle("cursor-not-allowed", blocked);
}

async function loadMe() {
    try {
        me = await getJson<Me>("/me");
        cooldownEndsAt = Date.now() + me.cooldownMs;
    } catch (err) {
        console.error("failed to fetch sender", err);
    }
    render();
}

async function openModal() {
    errorEl.textContent = "";
    holdError.textContent = "";
    holdToken.value = "";
    form.reset();

    // Show what we knew last time straight away, then check: the hold's cooldown may have been
    // used by someone else on it, or the admin may have banned it.
    const stepBefore = atGate();
    render();
    modal.classList.remove("hidden");
    focusStep();

    await loadMe();
    if (atGate() !== stepBefore) focusStep();
}

function closeModal() {
    modal.classList.add("hidden");
}

fab.addEventListener("click", openModal);
closeBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
});
setInterval(() => {
    if (!modal.classList.contains("hidden")) render();
}, 1000);

holdForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    holdError.textContent = "";

    const res = await postJson("/hold/login", { token: holdToken.value });
    if (!res.ok) {
        holdError.textContent = res.status === 429 ? "For mange forsøg. Prøv igen senere." : "Forkert kode. Prøv igen.";
        holdToken.select();
        return;
    }

    holdToken.value = "";
    sendingWithoutHold = false;
    await loadMe();
    focusStep();
});

noHoldBtn.addEventListener("click", () => {
    sendingWithoutHold = true;
    render();
    focusStep();
});

// "Skift hold" / "Jeg er på et hold": back to step 1, logged out if you were logged in.
senderSwitch.addEventListener("click", async () => {
    if (me.kind !== "none") {
        await postJson("/hold/logout");
        await loadMe();
    }
    sendingWithoutHold = false;
    render();
    focusStep();
});

async function failureMessage(res: Response): Promise<string> {
    const body = await res.json().catch(() => ({}));

    if (res.status === 429) {
        cooldownEndsAt = Date.now() + (Number(body.retryAfterMs) || 0);
        return "Vent lidt, før du sender en ny besked.";
    }
    if (body.status === "banned") return "Dit hold er spærret.";
    if (body.status === "turnstile_failed") return "Captcha mislykkedes. Prøv igen.";
    return "Noget gik galt. Prøv igen.";
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sendBtn.disabled) return;

    const author = authorInput.value.trim();
    const message = textInput.value.trim();
    if (!author || !message) return;

    const turnstileToken = form.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')?.value;

    try {
        const res = await postJson("/messages", { author, message, "cf-turnstile-response": turnstileToken });
        window.turnstile?.reset();

        if (!res.ok) {
            errorEl.textContent = await failureMessage(res);
            await loadMe();
            return;
        }

        closeModal();
        await loadMe();
    } catch {
        errorEl.textContent = "Noget gik galt. Prøv igen.";
    }
});

loadMe();
