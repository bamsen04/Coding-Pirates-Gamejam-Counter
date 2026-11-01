import { byId } from "../dom";
import { getJson, postJson } from "../http";
import type { EventAction, TimerEvent } from "../types";
import { emptyNote, makeButton, RED_BUTTON } from "./ui";

const list = byId("events-list");
const form = byId<HTMLFormElement>("event-form");
const actionInput = byId<HTMLSelectElement>("event-action");
const atInput = byId<HTMLInputElement>("event-at");
const untilInput = byId<HTMLInputElement>("event-until");
const status = byId("event-status");
const hint = byId("event-hint");

const LABELS: Record<EventAction, string> = {
    confetti: "Konfetti",
    fanfare: "Fanfare",
    tick: "Tik",
    beep: "Bip",
    dark: "Mørk tilstand",
};

const HINTS: Record<EventAction, string> = {
    confetti: 'Konfetti skydes af én gang, når uret når tidspunktet i "Ved".',
    fanfare: 'Fanfaren spilles én gang, når uret når tidspunktet i "Ved".',
    tick: 'Tik er lyden af selve nedtællingen: ét tik hvert sekund fra "Ved" til "Til". Lad "Ved" stå tom for at starte fra begyndelsen.',
    beep: 'Bip er til de sidste sekunder: ét bip hvert sekund fra "Ved" til "Til", fx fra 00:00:10 til 00:00:01.',
    dark: 'Siden er mørk, mens uret er mellem "Ved" og "Til", og skifter blidt tilbage til lyst bagefter. Fx "Ved" 20:00:00 og "Til" 08:00:00 er mørk i den periode. Lad "Ved" stå tom for at være mørk fra starten.',
};

// Confetti and fanfare happen once, so they have no "Til".
const ONE_SHOT: EventAction[] = ["confetti", "fanfare"];

function selectedAction(): EventAction {
    return actionInput.value as EventAction;
}

function updateForm() {
    const action = selectedAction();
    hint.textContent = HINTS[action];

    const oneShot = ONE_SHOT.includes(action);
    untilInput.disabled = oneShot;
    if (oneShot) untilInput.value = "";
}

// "HH:MM:SS", "MM:SS" or "SS" to seconds. Empty gives null, anything invalid gives NaN.
function parseTimer(text: string): number | null {
    const value = text.trim();
    if (value === "") return null;
    if (!/^\d+(:\d{1,2}){0,2}$/.test(value)) return NaN;
    return value.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

function formatTimer(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function describe(event: TimerEvent): string {
    const at = event.at === null ? "fra starten" : formatTimer(event.at);
    const when = event.until === null ? `ved ${at}` : `${at} til ${formatTimer(event.until)}`;
    return `${LABELS[event.action] ?? event.action}: ${when}`;
}

function row(event: TimerEvent): HTMLElement {
    const label = document.createElement("span");
    label.textContent = describe(event);

    const el = document.createElement("div");
    el.className = "border-2 border-black p-3 flex items-center justify-between gap-4 text-sm";
    el.append(label, makeButton("Fjern", RED_BUTTON, () => remove(event.id)));
    return el;
}

async function loadEvents() {
    try {
        const events = await getJson<TimerEvent[]>("/events");
        list.replaceChildren(...(events.length === 0 ? [emptyNote("Ingen begivenheder.")] : events.map(row)));
    } catch (err) {
        console.error("failed to load events", err);
    }
}

async function remove(id: number) {
    await fetch(`/admin/api/events/${id}`, { method: "DELETE" });
    loadEvents();
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    status.className = "text-sm text-red-500";

    const at = parseTimer(atInput.value);
    const until = parseTimer(untilInput.value);
    if (Number.isNaN(at) || Number.isNaN(until)) {
        status.textContent = "Brug TT:MM:SS.";
        return;
    }

    try {
        const res = await postJson("/admin/api/events", { action: selectedAction(), at, until });
        if (!res.ok) throw new Error("request failed");
        form.reset();
        updateForm();
        loadEvents();
    } catch {
        status.textContent = "Det er ikke en gyldig tid til den handling.";
    }
});

actionInput.addEventListener("change", updateForm);

export function initEvents() {
    updateForm();
    loadEvents();
}
