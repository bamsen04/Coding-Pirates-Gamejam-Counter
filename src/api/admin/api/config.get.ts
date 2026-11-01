import { defineRoute } from "@/router";
import { getMax, getMessageTtlMs, getShowDays, getTargetDate } from "@/services/settings";

export default defineRoute({ admin: true }, async (req, res) => {
    const max = await getMax();
    res.json({
        ttlMinutes: (await getMessageTtlMs()) / 60000,
        targetDate: await getTargetDate(),
        showDays: await getShowDays(),
        maxValue: max.value,
        maxUnit: max.unit,
    });
});
