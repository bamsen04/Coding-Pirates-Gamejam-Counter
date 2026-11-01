import { defineRoute } from "@/router";
import { settings } from "@/services/settings";

export default defineRoute({ admin: true }, (req, res) => {
    res.json({ ttlMinutes: settings.messageTtlMs / 60000 });
});
