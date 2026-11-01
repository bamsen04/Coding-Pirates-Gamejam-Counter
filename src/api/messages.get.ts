import { defineRoute } from "@/router";
import { getApproved } from "@/services/messages";
import { settings } from "@/services/settings";

export default defineRoute(async (req, res) => {
    res.json(await getApproved(settings.messageTtlMs));
});
