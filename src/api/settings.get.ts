import { defineRoute } from "@/router";
import { getMaxMs, getShowDays, getTargetDate } from "@/services/settings";

// Public: the front page polls this so a screen left open picks up changed timer settings.
export default defineRoute(async (req, res) => {
    res.json({ targetDate: await getTargetDate(), showDays: await getShowDays(), maxMs: await getMaxMs() });
});
