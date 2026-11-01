import { defineRoute } from "@/router";
import { settings } from "@/services/settings";

export default defineRoute({ admin: true }, (req, res) => {
    const minutes = Number(req.body.ttlMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
        res.status(400).json({ status: "invalid_ttl" });
        return;
    }
    settings.messageTtlMs = minutes * 60000;
    res.json({ status: "ok", ttlMinutes: minutes });
});
