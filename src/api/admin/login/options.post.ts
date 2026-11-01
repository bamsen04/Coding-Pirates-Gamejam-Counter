import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { CHALLENGE_COOKIE, CHALLENGE_TTL_MS, loginChallenges } from "@/auth";
import { config } from "@/config";
import { defineRoute } from "@/router";
import { listPasskeys } from "@/services/passkeys";

export default defineRoute({ rateLimit: true }, async (req, res) => {
    const credentials = await listPasskeys();
    if (credentials.length === 0) {
        res.status(400).json({ status: "no_passkeys" });
        return;
    }
    const options = await generateAuthenticationOptions({
        rpID: config.rpId,
        userVerification: "preferred",
        allowCredentials: credentials.map((c) => ({ id: c.id, transports: c.transports })),
    });
    const challengeId = crypto.randomUUID();
    loginChallenges.set(challengeId, { challenge: options.challenge, expires: Date.now() + CHALLENGE_TTL_MS });
    res.cookie(CHALLENGE_COOKIE, challengeId, { httpOnly: true, sameSite: "strict", maxAge: CHALLENGE_TTL_MS });
    res.json(options);
});
