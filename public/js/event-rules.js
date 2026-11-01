// Timer events. Times are seconds remaining on the clock.
//   point event (until === null): fires once, when the clock reaches `at`
//   range event: covers the clock between `until` and `at` (at === null means "from the start")

// Whether a range event covers this moment. A point event never does. Used for things that are a
// state rather than a one-off, like dark mode.
export function isActive(event, total) {
    return event.until !== null && total >= event.until && (event.at === null || total <= event.at);
}

// Whether an event fires on this clock tick. Range events fire on every tick they cover; point
// events once. `previous` is the seconds remaining on the tick before (null on the first tick).
export function shouldFire(event, total, previous) {
    if (event.until !== null) {
        // The clock stays at 0 once it has finished, so a range that includes 0 may only fire on
        // the tick that reaches it. Otherwise it would keep going every second forever.
        if (total === 0 && !(previous > 0)) return false;
        return isActive(event, total);
    }
    // Only on a live crossing, so loading the page after the moment doesn't fire it.
    return previous !== null && previous > event.at && total <= event.at;
}
