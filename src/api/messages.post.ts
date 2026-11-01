import { defineRoute } from "@/router";
import { addMessage } from "@/services/messages";
import { verifyTurnstile } from "@/services/turnstile";

export default defineRoute(async (req, res) => {
    const { author, message } = req.body;
    const token = req.body["cf-turnstile-response"];
    if (!(await verifyTurnstile(token, req.ip))) {
        res.status(403).json({ status: "turnstile_failed" });
        return;
    }
    if (typeof author !== "string" || typeof message !== "string" || !author.trim() || !message.trim()) {
        res.status(400).json({ status: "invalid_message" });
        return;
    }
    await addMessage(author, message);
    res.json({ status: "pending" });
});
