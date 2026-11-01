import { generateRegistrationOptions } from "@simplewebauthn/server";
import { CHALLENGE_TTL_MS, enrollChallenges } from "@/auth";
import { config } from "@/config";
import { defineRoute } from "@/router";
import { getUserId, isValidEnrollToken, listPasskeys } from "@/services/passkeys";

export default defineRoute({ rateLimit: true }, async (req, res) => {
    const { token } = req.body;
    if (!(await isValidEnrollToken(token))) {
        res.status(403).json({ status: "invalid_token" });
        return;
    }
    const options = await generateRegistrationOptions({
        rpName: config.rpName,
        rpID: config.rpId,
        userName: "admin",
        userID: new TextEncoder().encode(await getUserId()),
        attestationType: "none",
        excludeCredentials: (await listPasskeys()).map((c) => ({ id: c.id, transports: c.transports })),
        authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });
    enrollChallenges.set(token, { challenge: options.challenge, expires: Date.now() + CHALLENGE_TTL_MS });
    res.json(options);
});
