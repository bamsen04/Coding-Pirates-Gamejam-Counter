const TARGET_DATE = new Date(2027, 11 - 1, 1, 13, 0, 0).getTime();
const MAX_MS = 24 * 60 * 60 * 1000 * 10000000;

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

function pad2(n) {
    return String(n).padStart(2, "0");
}

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

// Other modules (sound, confetti) subscribe here. The callback gets the new
// "DD:HH:MM:SS" string and the previous one (null on the first tick).
const clockListeners = [];
let previousStr = null;

export function onClockTick(fn) {
    clockListeners.push(fn);
}

function updateClock() {
    let remaining = TARGET_DATE - Date.now();
    if (remaining < 0) remaining = 0;
    if (remaining > MAX_MS) remaining = MAX_MS;

    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const str = `${pad2(days)}:${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
    renderDigits(str);
    clockListeners.forEach((fn) => fn(str, previousStr));
    previousStr = str;
}

updateClock();
setInterval(updateClock, 1000);
