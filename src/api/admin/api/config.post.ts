import { defineRoute } from "@/router";
import { isMaxUnit, setSetting } from "@/services/settings";

export default defineRoute({ admin: true }, async (req, res) => {
    const { ttlMinutes, targetDate, showDays, maxValue, maxUnit } = req.body;
    const minutes = Number(ttlMinutes);
    const target = Number(targetDate);
    const max = Number(maxValue);

    if (!Number.isFinite(minutes) || minutes <= 0) {
        res.status(400).json({ status: "invalid_ttl" });
        return;
    }
    if (targetDate == null || !Number.isFinite(target)) {
        res.status(400).json({ status: "invalid_target_date" });
        return;
    }
    if (typeof showDays !== "boolean") {
        res.status(400).json({ status: "invalid_show_days" });
        return;
    }
    if (maxValue == null || !Number.isFinite(max) || max <= 0 || !isMaxUnit(maxUnit)) {
        res.status(400).json({ status: "invalid_max" });
        return;
    }

    await setSetting("message_ttl_minutes", String(minutes));
    await setSetting("target_date", String(Math.floor(target)));
    await setSetting("show_days", String(showDays));
    await setSetting("max_value", String(max));
    await setSetting("max_unit", maxUnit);
    res.json({ status: "ok" });
});
