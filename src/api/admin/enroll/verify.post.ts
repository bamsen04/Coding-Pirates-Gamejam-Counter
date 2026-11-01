import { type AuthenticatorTransport, verifyRegistrationResponse } from "@simplewebauthn/server";
import { enrollChallenges } from "@/auth";
import { config } from "@/config";
import { defineRoute } from "@/router";
import { addPasskey, consumeEnrollToken, getUserId, isValidEnrollToken } from "@/services/passkeys";

export default defineRoute({ rateLimit: true }, async (req, res) => {
    const { token, response } = req.body;
    const entry = typeof token === "string" ? enrollChallenges.get(token) : undefined;
    if (!(await isValidEnrollToken(token)) || !entry || entry.expires < Date.now()) {
        res.status(403).json({ status: "invalid_token" });
        return;
    }
    enrollChallenges.delete(token);

    try {
        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge: entry.challenge,
            expectedOrigin: config.origin,
            expectedRPID: config.rpId,
        });
        if (!verification.verified) {
            res.status(400).json({ status: "verification_failed" });
            return;
        }
        // Burn the token first so a single link can't register two passkeys.
        if (!(await consumeEnrollToken(token))) {
            res.status(403).json({ status: "invalid_token" });
            return;
        }
        const { credential } = verification.registrationInfo;
        await addPasskey(await getUserId(), {
            id: credential.id,
            publicKey: Buffer.from(credential.publicKey).toString("base64url"),
            counter: credential.counter,
            transports: (credential.transports ?? []) as AuthenticatorTransport[],
        });
        res.json({ status: "ok" });
    } catch (err) {
        console.error("passkey enrollment failed", err);
        res.status(400).json({ status: "verification_failed" });
    }
});
