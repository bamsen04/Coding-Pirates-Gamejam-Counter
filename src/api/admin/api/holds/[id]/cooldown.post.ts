import { defineRoute } from "@/router";
import { getHold, setCooldown } from "@/services/holds";

const MAX_MINUTES = 24 * 60;

// Sets how many minutes this hold has to wait between messages (0 for no wait), or `null` to go
// back to the default.
export default defineRoute({ admin: true }, async (req, res) => {
    const { minutes } = req.body;
    const valid = minutes === null || (typeof minutes === "number" && minutes >= 0 && minutes <= MAX_MINUTES);
    if (!valid) {
        res.status(400).json({ status: "invalid_minutes" });
        return;
    }

    const hold = await getHold(Number(req.params.id));
    if (!hold) {
        res.status(404).json({ status: "not_found" });
        return;
    }

    await setCooldown(hold.id, minutes === null ? null : Math.round(minutes * 60000));
    res.json({ status: "ok" });
});
