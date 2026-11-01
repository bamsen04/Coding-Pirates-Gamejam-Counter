import { defineRoute } from "@/router";
import { isBanned, resolveSender, senderCooldownRemaining } from "@/services/sender";

// Public: who the visitor is sending as, whether they're allowed to, and how long until they can send
// again. The message form reads this each time it opens.
export default defineRoute(async (req, res) => {
    const sender = await resolveSender(req);

    res.json({
        kind: sender.kind,
        label: sender.label,
        banned: isBanned(sender),
        cooldownMs: senderCooldownRemaining(sender, req),
    });
});
