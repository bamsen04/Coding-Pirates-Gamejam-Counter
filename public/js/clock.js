import { formatClock } from "./clock-format.js";

// Rendered into the page by the server, then kept fresh by polling /settings.
// targetDate is epoch ms; showDays picks DD:HH:MM:SS over total-hours HH:MM:SS;
// maxMs caps how much time the clock will ever show.
let targetDate = Number(document.body.dataset.targetDate);
let showDays = document.body.dataset.showDays === "true";
let maxMs = Number(document.body.dataset.maxMs);

async function refreshSettings() {
    try {
        const res = await fetch("/settings");
        const settings = await res.json();
        targetDate = settings.targetDate;
        showDays = settings.showDays;
        maxMs = settings.maxMs;
    } catch (err) {
        console.error("failed to fetch settings", err);
    }
}
setInterval(refreshSettings, 60000);

const clockEls = document.querySelectorAll(".clock-display");

const SEGMENTS = {
    "0": "abcdef",
    "1": "bc",
    "2": "abged",
    "3": "abgcd",
    "4": "fgbc",
    "5": "afgcd",
    "6": "afgecd",
    "7": "abc",
    "8": "abcdefg",
    "9": "abcdfg",
};

function renderDigits(str) {
    const html = [...str].map((ch) => {
        if (ch === ":") return `<span class="seg-colon"></span>`;
        const lit = SEGMENTS[ch] || "";
        const segs = ["a", "b", "c", "d", "e", "f", "g"]
            .map((s) => `<span class="seg seg-${s} seg-${"a,d,g".includes(s) ? "h" : "v"} ${lit.includes(s) ? "on" : ""}"></span>`)
            .join("");
        return `<span class="seg-digit">${segs}</span>`;
    }).join("");
    clockEls.forEach((el) => {
        el.innerHTML = html;
    });
}

// Other modules (sound, confetti) subscribe here. The callback gets the seconds
// remaining now and on the previous tick (null on the first tick).
const clockListeners = [];
let previousTotal = null;

export function onClockTick(fn) {
    clockListeners.push(fn);
}

// Seconds remaining as of the last tick (null before the first one).
export function currentTotal() {
    return previousTotal;
}

function updateClock() {
    let remaining = targetDate - Date.now();
    if (remaining < 0) remaining = 0;
    if (remaining > maxMs) remaining = maxMs;

    const totalSeconds = Math.floor(remaining / 1000);
    renderDigits(formatClock(totalSeconds, showDays));
    clockListeners.forEach((fn) => fn(totalSeconds, previousTotal));
    previousTotal = totalSeconds;
}

updateClock();
setInterval(updateClock, 1000);
