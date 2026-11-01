import { formatClock } from "./clock-format";
import { clockHtml } from "./clock-markup";
import { getJson } from "./http";
import type { Settings } from "./types";

// The server renders these into the page; they're refreshed every minute from /settings.
// targetDate is epoch ms, showDays picks DD:HH:MM:SS over total-hours HH:MM:SS, and maxMs caps
// how much time the clock will ever show.
let targetDate = Number(document.body.dataset.targetDate);
let showDays = document.body.dataset.showDays === "true";
let maxMs = Number(document.body.dataset.maxMs);

async function refreshSettings() {
    try {
        const settings = await getJson<Settings>("/settings");
        targetDate = settings.targetDate;
        showDays = settings.showDays;
        maxMs = settings.maxMs;
    } catch (err) {
        console.error("failed to fetch settings", err);
    }
}
setInterval(refreshSettings, 60000);

const clockEls = document.querySelectorAll<HTMLElement>(".clock-display");

function renderDigits(text: string) {
    const html = clockHtml(text);
    clockEls.forEach((el) => {
        el.innerHTML = html;
    });
}

// Other modules (events) subscribe here. The callback gets the seconds remaining now and on the
// previous tick (null on the first tick).
type TickListener = (total: number, previous: number | null) => void;
const listeners: TickListener[] = [];
let previousTotal: number | null = null;

export function onClockTick(fn: TickListener) {
    listeners.push(fn);
}

// Seconds remaining as of the last tick (null before the first one).
export function currentTotal(): number | null {
    return previousTotal;
}

function updateClock() {
    const remaining = Math.min(Math.max(targetDate - Date.now(), 0), maxMs);
    const total = Math.floor(remaining / 1000);

    renderDigits(formatClock(total, showDays));
    listeners.forEach((fn) => fn(total, previousTotal));
    previousTotal = total;
}

updateClock();
setInterval(updateClock, 1000);
