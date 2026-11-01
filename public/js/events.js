import { currentTotal, onClockTick } from "./clock.js";
import { isActive, shouldFire } from "./event-rules.js";

// Runs the admin-configured timer events (see event-rules.js for when one fires).
let events = JSON.parse(document.body.dataset.events || "[]");

async function refreshEvents() {
    try {
        const res = await fetch("/events");
        events = await res.json();
    } catch (err) {
        console.error("failed to fetch events", err);
    }
}
setInterval(refreshEvents, 60000);

const handlers = {};

// Other modules (sound, confetti) register what an action does. fn gets the seconds remaining.
export function onAction(action, fn) {
    (handlers[action] ??= []).push(fn);
}

// For actions that are a state instead of a one-off (dark mode): fn(active, first) is called
// when an event of that action starts or stops covering the clock. `first` is true for the
// initial call, which happens right away, so a page can pick its starting state without a fade.
const stateHandlers = {};
const states = {};

function evaluateState(action, total) {
    const active = events.some((event) => event.action === action && isActive(event, total));
    if (active === states[action]) return;

    const first = states[action] === undefined;
    states[action] = active;
    stateHandlers[action].forEach((fn) => fn(active, first));
}

export function onState(action, fn) {
    (stateHandlers[action] ??= []).push(fn);
    const total = currentTotal();
    if (total !== null) evaluateState(action, total);
}

onClockTick((total, previous) => {
    for (const event of events) {
        if (shouldFire(event, total, previous)) handlers[event.action]?.forEach((fn) => fn(total));
    }
    for (const action of Object.keys(stateHandlers)) evaluateState(action, total);
});
