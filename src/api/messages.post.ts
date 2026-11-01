import { defineRoute } from "@/router";
import { addMessage } from "@/services/messages";
import { claimCooldown, isBanned, resolveSender, senderCooldownRemaining } from "@/services/sender";
import { verifyTurnstile } from "@/services/turnstile";

// The same limits as the form's maxlength.
const MAX_AUTHOR = 30;
const MAX_MESSAGE = 200;

export default defineRoute(async (req, res) => {
    const { author, message } = req.body;
    const sender = await resolveSender(req);

    if (
        typeof author !== "string" ||
        typeof message !== "string" ||
        !author.trim() ||
        !message.trim() ||
        author.trim().length > MAX_AUTHOR ||
        message.trim().length > MAX_MESSAGE
    ) {
        res.status(400).json({ status: "invalid_message" });
        return;
    }

    if (isBanned(sender)) {
        res.status(403).json({ status: "banned" });
        return;
    }

    // The captcha is for people without a hold. A hold login or an admin is already trusted.
    if (sender.kind === "none" && !(await verifyTurnstile(req.body["cf-turnstile-response"], req.ip))) {
        res.status(403).json({ status: "turnstile_failed" });
        return;
    }

    if (!(await claimCooldown(sender, req))) {
        res.status(429).json({ status: "cooldown", retryAfterMs: senderCooldownRemaining(sender, req) });
        return;
    }

    await addMessage(author.trim(), message.trim(), sender.label);
    res.json({ status: "pending" });
});
