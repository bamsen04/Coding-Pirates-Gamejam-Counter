import { currentTotal, onClockTick } from "./clock";
import { isActive, shouldFire } from "./event-rules";
import { getJson } from "./http";
import type { EventAction, TimerEvent } from "./types";

// Runs the admin-configured timer events (see event-rules.ts for when one fires).
let events: TimerEvent[] = JSON.parse(document.body.dataset.events || "[]");

async function refreshEvents() {
    try {
        events = await getJson<TimerEvent[]>("/events");
    } catch (err) {
        console.error("failed to fetch events", err);
    }
}
setInterval(refreshEvents, 60000);

// One-off actions (sound, confetti): other modules register what an action does.
// fn gets the seconds remaining.
type ActionHandler = (secondsLeft: number) => void;
const actionHandlers: Partial<Record<EventAction, ActionHandler[]>> = {};

export function onAction(action: EventAction, fn: ActionHandler) {
    (actionHandlers[action] ??= []).push(fn);
}

// Actions that are a state instead of a one-off (dark mode): fn(active, first) is called when an
// event of that action starts or stops covering the clock. `first` is true for the initial call,
// which happens right away, so a page can pick its starting state without a fade.
type StateHandler = (active: boolean, first: boolean) => void;
const stateHandlers: Partial<Record<EventAction, StateHandler[]>> = {};
const states: Partial<Record<EventAction, boolean>> = {};

function evaluateState(action: EventAction, total: number) {
    const active = events.some((event) => event.action === action && isActive(event, total));
    if (active === states[action]) return;

    const first = states[action] === undefined;
    states[action] = active;
    stateHandlers[action]?.forEach((fn) => fn(active, first));
}

export function onState(action: EventAction, fn: StateHandler) {
    (stateHandlers[action] ??= []).push(fn);

    const total = currentTotal();
    if (total !== null) evaluateState(action, total);
}

onClockTick((total, previous) => {
    for (const event of events) {
        if (shouldFire(event, total, previous)) actionHandlers[event.action]?.forEach((fn) => fn(total));
    }
    for (const action of Object.keys(stateHandlers) as EventAction[]) evaluateState(action, total);
});
