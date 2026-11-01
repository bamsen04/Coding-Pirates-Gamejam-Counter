import { byId } from "../dom";
import { getJson } from "../http";
import type { Message } from "../types";
import { emptyNote, GREEN_BUTTON, makeButton, RED_BUTTON, ROW } from "./ui";

const pendingListEl = byId("pending-list");
const approvedListEl = byId("approved-list");
const pendingCountEl = byId("pending-count");
const approvedCountEl = byId("approved-count");
const pendingBadge = byId("pending-badge"); // on the Beskeder tab, so you see it from the other tabs
const TITLE = "Admin | CP Gamejam";

// A beep when a new message arrives, so you notice it. Browsers only allow audio after the page
// has been clicked or typed in once.
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
    audioCtx ??= new (window.AudioContext ?? window.webkitAudioContext!)();
    return audioCtx;
}

function unlockAudio() {
    try {
        const ctx = getAudioCtx();
        if (ctx.state === "suspended") ctx.resume();
    } catch (err) {
        console.error("audio unlock failed", err);
    }
}

function playBeep() {
    try {
        const ctx = getAudioCtx();
        if (ctx.state === "suspended") ctx.resume();
        [880, 1175].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = ctx.currentTime + i * 0.18;
            osc.type = "square";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.15, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.17);
        });
    } catch (err) {
        console.error("beep failed", err);
    }
}

function messageRow(message: Message, actions: HTMLElement[]): HTMLElement {
    const author = document.createElement("div");
    author.className = "opacity-70 mb-1 truncate";
    author.textContent = `${message.author} (${message.label}) · ${new Date(message.sentAt).toLocaleTimeString()}`;

    const text = document.createElement("div");
    text.className = "break-words";
    text.textContent = message.text;

    const info = document.createElement("div");
    info.className = "min-w-0";
    info.append(author, text);

    const buttons = document.createElement("div");
    buttons.className = "flex gap-2 shrink-0";
    buttons.append(...actions);

    const row = document.createElement("div");
    row.className = `${ROW} flex items-start justify-between gap-4`;
    row.append(info, buttons);
    return row;
}

async function act(url: string, method: "POST" | "DELETE") {
    await fetch(url, { method });
    loadMessages();
}

const approve = (id: number) => act(`/admin/api/messages/${id}/approve`, "POST");
const reject = (id: number) => act(`/admin/api/messages/${id}/reject`, "POST");
const remove = (id: number) => act(`/admin/api/messages/${id}`, "DELETE");

let knownPendingIds: Set<number> | null = null;

async function loadMessages() {
    try {
        const { pending, approved } = await getJson<{ pending: Message[]; approved: Message[] }>("/admin/api/messages");

        if (knownPendingIds && pending.some((m) => !knownPendingIds!.has(m.id))) playBeep();
        knownPendingIds = new Set(pending.map((m) => m.id));

        pendingBadge.textContent = String(pending.length);
        pendingBadge.classList.toggle("hidden", pending.length === 0);
        document.title = pending.length > 0 ? `(${pending.length}) ${TITLE}` : TITLE;

        pendingCountEl.textContent = String(pending.length);
        approvedCountEl.textContent = String(approved.length);

        pendingListEl.replaceChildren(
            ...(pending.length === 0
                ? [emptyNote("Ingen afventende beskeder.")]
                : pending.map((m) =>
                      messageRow(m, [
                          makeButton("Godkend", GREEN_BUTTON, () => approve(m.id)),
                          makeButton("Afvis", RED_BUTTON, () => reject(m.id)),
                      ]),
                  )),
        );

        approvedListEl.replaceChildren(
            ...(approved.length === 0
                ? [emptyNote("Ingen godkendte beskeder.")]
                : approved.map((m) => messageRow(m, [makeButton("Fjern", RED_BUTTON, () => remove(m.id))]))),
        );
    } catch (err) {
        console.error("failed to load messages", err);
    }
}

export function initMessages() {
    document.addEventListener("click", unlockAudio, { once: true });
    document.addEventListener("keydown", unlockAudio, { once: true });

    loadMessages();
    setInterval(loadMessages, 60000);
}
