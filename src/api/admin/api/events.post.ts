import { defineRoute } from "@/router";
import { addEvent, isPointAction, isRangeAction } from "@/services/events";

// A non-negative whole number of seconds, or null when the field was left out.
function seconds(value: unknown): number | null | undefined {
    if (value == null) return null;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return undefined;
    return value;
}

export default defineRoute({ admin: true }, async (req, res) => {
    const { action } = req.body;
    const at = seconds(req.body.at);
    const until = seconds(req.body.until);

    if (at === undefined || until === undefined) {
        res.status(400).json({ status: "invalid_time" });
        return;
    }

    if (isPointAction(action)) {
        // Fires once, so it needs a moment and can't have a range.
        if (at === null || until !== null) {
            res.status(400).json({ status: "invalid_time" });
            return;
        }
    } else if (isRangeAction(action)) {
        // Plays every second between at (earlier, larger) and until (later, smaller).
        if (until === null || (at !== null && at < until)) {
            res.status(400).json({ status: "invalid_time" });
            return;
        }
    } else {
        res.status(400).json({ status: "invalid_action" });
        return;
    }

    await addEvent(action, at, until);
    res.json({ status: "ok" });
});
