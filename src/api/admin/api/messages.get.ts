import { defineRoute } from "@/router";
import { getApproved, getPending } from "@/services/messages";
import { getMessageTtlMs } from "@/services/settings";

export default defineRoute({ admin: true }, async (req, res) => {
    res.json({ pending: await getPending(), approved: await getApproved(await getMessageTtlMs()) });
});
