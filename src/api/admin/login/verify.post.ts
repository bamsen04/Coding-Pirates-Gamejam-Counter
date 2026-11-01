import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { CHALLENGE_COOKIE, loginChallenges, parseCookies, startAdminSession } from "@/auth";
import { config } from "@/config";
import { defineRoute } from "@/router";
import { getPasskey, updateCounter } from "@/services/passkeys";

export default defineRoute({ rateLimit: true }, async (req, res) => {
    const challengeId = parseCookies(req.headers.cookie)[CHALLENGE_COOKIE];
    const entry = challengeId ? loginChallenges.get(challengeId) : undefined;
    if (challengeId) loginChallenges.delete(challengeId);
    if (!entry || entry.expires < Date.now()) {
        res.status(400).json({ status: "challenge_expired" });
        return;
    }

    const passkey = await getPasskey(req.body?.id);
    if (!passkey) {
        res.status(401).json({ status: "unknown_passkey" });
        return;
    }

    try {
        const verification = await verifyAuthenticationResponse({
            response: req.body,
            expectedChallenge: entry.challenge,
            expectedOrigin: config.origin,
            expectedRPID: config.rpId,
            credential: {
                id: passkey.id,
                publicKey: Buffer.from(passkey.publicKey, "base64url"),
                counter: passkey.counter,
                transports: passkey.transports,
            },
        });
        if (!verification.verified) {
            res.status(401).json({ status: "verification_failed" });
            return;
        }
        await updateCounter(passkey.id, verification.authenticationInfo.newCounter);
    } catch (err) {
        console.error("passkey login failed", err);
        res.status(401).json({ status: "verification_failed" });
        return;
    }

    startAdminSession(res);
    res.json({ status: "ok" });
});
