const pendingListEl = document.getElementById("pending-list");
const approvedListEl = document.getElementById("approved-list");
const pendingCountEl = document.getElementById("pending-count");
const approvedCountEl = document.getElementById("approved-count");
const ttlInput = document.getElementById("ttl-input");
const targetInput = document.getElementById("target-input");
const showDaysInput = document.getElementById("show-days-input");
const maxValueInput = document.getElementById("max-value-input");
const maxUnitInput = document.getElementById("max-unit-input");const configForm = document.getElementById("config-form");
const configStatus = document.getElementById("config-status");

let audioCtx = null;
let knownPendingIds = null;

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
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

document.addEventListener("click", unlockAudio, { once: true });
document.addEventListener("keydown", unlockAudio, { once: true });

function formatTime(ms) {
    return new Date(ms).toLocaleTimeString();
}

function renderMessage(msg, actions) {
    const div = document.createElement("div");
    div.className = "border-2 border-black p-3 flex items-start justify-between gap-4";

    const info = document.createElement("div");
    info.className = "min-w-0";

    const author = document.createElement("div");
    author.className = "text-xs font-semibold text-slate-500 mb-1 truncate";
    author.textContent = `${msg.author} · ${formatTime(msg.sentAt)}`;

    const text = document.createElement("div");
    text.className = "text-sm break-words";
    text.textContent = msg.text;

    info.appendChild(author);
    info.appendChild(text);

    const actionsEl = document.createElement("div");
    actionsEl.className = "flex gap-2 shrink-0";
    actionsEl.appendChild(actions(msg));

    div.appendChild(info);
    div.appendChild(actionsEl);
    return div;
}

function makeButton(label, className, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.className = `text-xs font-bold uppercase tracking-widest py-1 px-2 border-2 border-black transition-colors ${className}`;
    btn.addEventListener("click", onClick);
    return btn;
}

async function loadMessages() {
    try {
        const res = await fetch("/admin/api/messages");
        const { pending, approved } = await res.json();

        const currentIds = new Set(pending.map((m) => m.id));
        if (knownPendingIds !== null && pending.some((m) => !knownPendingIds.has(m.id))) {
            playBeep();
        }
        knownPendingIds = currentIds;

        pendingCountEl.textContent = `${pending.length}`;
        approvedCountEl.textContent = `${approved.length}`;

        pendingListEl.innerHTML = "";
        if (pending.length === 0) {
            pendingListEl.innerHTML = `<p class="text-sm text-slate-400">Ingen afventende beskeder.</p>`;
        } else {
            pending.forEach((msg) => {
                const row = renderMessage(msg, () => {
                    const container = document.createElement("div");
                    container.className = "flex gap-2";
                    container.appendChild(makeButton("Godkend", "bg-emerald-500 text-white hover:bg-emerald-600", () => approveMessage(msg.id)));
                    container.appendChild(makeButton("Afvis", "bg-red-500 text-white hover:bg-red-600", () => rejectMessage(msg.id)));
                    return container;
                });
                pendingListEl.appendChild(row);
            });
        }

        approvedListEl.innerHTML = "";
        if (approved.length === 0) {
            approvedListEl.innerHTML = `<p class="text-sm text-slate-400">Ingen godkendte beskeder.</p>`;
        } else {
            approved.forEach((msg) => {
                const row = renderMessage(msg, () => makeButton("Fjern", "bg-red-500 text-white hover:bg-red-600", () => removeMessage(msg.id)));
                approvedListEl.appendChild(row);
            });
        }
    } catch (err) {
        console.error("failed to load messages", err);
    }
}

async function approveMessage(id) {
    await fetch(`/admin/api/messages/${id}/approve`, { method: "POST" });
    loadMessages();
}

async function rejectMessage(id) {
    await fetch(`/admin/api/messages/${id}/reject`, { method: "POST" });
    loadMessages();
}

async function removeMessage(id) {
    await fetch(`/admin/api/messages/${id}`, { method: "DELETE" });
    loadMessages();
}

// The server stores the target as epoch ms; <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
function toLocalInput(ms) {
    const d = new Date(ms);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

async function loadConfig() {
    try {
        const res = await fetch("/admin/api/config");
        const { ttlMinutes, targetDate, showDays, maxValue, maxUnit } = await res.json();
        ttlInput.value = ttlMinutes;
        targetInput.value = toLocalInput(targetDate);
        showDaysInput.checked = showDays;
        maxValueInput.value = maxValue;
        maxUnitInput.value = maxUnit;
    } catch (err) {
        console.error("failed to load config", err);
    }
}

configForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    configStatus.textContent = "";
    try {
        const res = await fetch("/admin/api/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ttlMinutes: Number(ttlInput.value),
                targetDate: new Date(targetInput.value).getTime(),
                showDays: showDaysInput.checked,
                maxValue: Number(maxValueInput.value),
                maxUnit: maxUnitInput.value,            }),
        });
        if (!res.ok) throw new Error("request failed");
        configStatus.textContent = "Gemt.";
        configStatus.className = "text-sm text-emerald-600";
    } catch (err) {
        configStatus.textContent = "Kunne ikke gemme.";
        configStatus.className = "text-sm text-red-500";
    }
});

// --- Timer events ---
const eventsListEl = document.getElementById("events-list");
const eventForm = document.getElementById("event-form");
const eventActionInput = document.getElementById("event-action");
const eventAtInput = document.getElementById("event-at");
const eventUntilInput = document.getElementById("event-until");
const eventStatus = document.getElementById("event-status");
const eventHintEl = document.getElementById("event-hint");

const EVENT_LABELS = { confetti: "Konfetti", fanfare: "Fanfare", tick: "Tik", beep: "Bip", dark: "Mørk tilstand" };

const EVENT_HINTS = {
    confetti: "Konfetti skydes af én gang, når uret når tidspunktet i \"Ved\".",
    fanfare: "Fanfaren spilles én gang, når uret når tidspunktet i \"Ved\".",
    tick: "Tik er lyden af selve nedtællingen: ét tik hvert sekund fra \"Ved\" til \"Til\". Lad \"Ved\" stå tom for at starte fra begyndelsen.",
    beep: "Bip er til de sidste sekunder: ét bip hvert sekund fra \"Ved\" til \"Til\", fx fra 00:00:10 til 00:00:01.",
    dark: "Siden er mørk, mens uret er mellem \"Ved\" og \"Til\", og skifter blidt tilbage til lyst bagefter. Fx \"Ved\" 20:00:00 og \"Til\" 08:00:00 er mørk i den periode. Lad \"Ved\" stå tom for at være mørk fra starten.",
};

// Confetti and fanfare happen once, so they have no "Til".
const ONE_SHOT_ACTIONS = ["confetti", "fanfare"];

function updateEventForm() {
    const action = eventActionInput.value;
    eventHintEl.textContent = EVENT_HINTS[action];
    const oneShot = ONE_SHOT_ACTIONS.includes(action);
    eventUntilInput.disabled = oneShot;
    if (oneShot) eventUntilInput.value = "";
}

// "HH:MM:SS", "MM:SS" or "SS" to seconds. Empty gives null, anything invalid gives NaN.
function parseTimer(text) {
    const value = text.trim();
    if (value === "") return null;
    if (!/^\d+(:\d{1,2}){0,2}$/.test(value)) return NaN;
    return value.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

function formatTimer(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function describeEvent(event) {
    const at = event.at === null ? "fra starten" : formatTimer(event.at);
    const range = event.until === null ? `ved ${at}` : `${at} til ${formatTimer(event.until)}`;
    return `${EVENT_LABELS[event.action] ?? event.action}: ${range}`;
}

async function loadEvents() {
    try {
        const res = await fetch("/events");
        const events = await res.json();

        eventsListEl.innerHTML = "";
        if (events.length === 0) {
            eventsListEl.innerHTML = `<p class="text-sm text-slate-400">Ingen begivenheder.</p>`;
            return;
        }
        events.forEach((event) => {
            const row = document.createElement("div");
            row.className = "border-2 border-black p-3 flex items-center justify-between gap-4 text-sm";

            const label = document.createElement("span");
            label.textContent = describeEvent(event);

            row.appendChild(label);
            row.appendChild(makeButton("Fjern", "bg-red-500 text-white hover:bg-red-600", () => removeEvent(event.id)));
            eventsListEl.appendChild(row);
        });
    } catch (err) {
        console.error("failed to load events", err);
    }
}

async function removeEvent(id) {
    await fetch(`/admin/api/events/${id}`, { method: "DELETE" });
    loadEvents();
}

eventForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    eventStatus.textContent = "";
    eventStatus.className = "text-sm text-red-500";

    const at = parseTimer(eventAtInput.value);
    const until = parseTimer(eventUntilInput.value);
    if (Number.isNaN(at) || Number.isNaN(until)) {
        eventStatus.textContent = "Brug TT:MM:SS.";
        return;
    }

    try {
        const res = await fetch("/admin/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: eventActionInput.value, at, until }),
        });
        if (!res.ok) throw new Error("request failed");
        eventForm.reset();
        updateEventForm();
        loadEvents();
    } catch (err) {
        eventStatus.textContent = "Det er ikke en gyldig tid til den handling.";
    }
});

eventActionInput.addEventListener("change", updateEventForm);
updateEventForm();

loadConfig();
loadEvents();
loadMessages();
setInterval(loadMessages, 60000);
