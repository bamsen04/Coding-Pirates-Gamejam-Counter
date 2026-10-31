import express from "express";
import { join } from "path";
import {
    type AuthenticatorTransport,
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
    consumeEnrollToken,
    isValidEnrollToken,
    loadPasskeys,
    ORIGIN,
    RP_ID,
    RP_NAME,
    savePasskeys,
} from "./passkeys";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const turnstile_secret = process.env.TURNSTILE_SECRET_KEY;

interface Message {
    id: string;
    author: string;
    text: string;
    sentAt: number;
}

let messageTtlMs = 30 * 60 * 1000;

const approvedMessages: Message[] = [];
const messageQueue: Message[] = [];

const validSessions = new Set<string>();
const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

const CHALLENGE_COOKIE = "login_challenge";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
interface PendingChallenge {
    challenge: string;
    expires: number;
}
const loginChallenges = new Map<string, PendingChallenge>();
const enrollChallenges = new Map<string, PendingChallenge>();

// Rate limit for the login/enroll endpoints: per IP, fixed window.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_REQUESTS = 20; // a normal login is 2 requests
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function loginRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    let entry = loginAttempts.get(key);
    if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
        loginAttempts.set(key, entry);
    }
    entry.count++;
    if (entry.count > LOGIN_MAX_REQUESTS) {
        res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
        res.status(429).json({ status: "rate_limited" });
        return;
    }
    next();
}

// Drop expired rate-limit entries and challenges so the maps don't grow forever.
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of loginAttempts) if (v.resetAt <= now) loginAttempts.delete(k);
    for (const [k, v] of loginChallenges) if (v.expires <= now) loginChallenges.delete(k);
    for (const [k, v] of enrollChallenges) if (v.expires <= now) enrollChallenges.delete(k);
}, 60 * 1000).unref();

function parseCookies(header: string | undefined): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!header) return cookies;
    for (const pair of header.split(";")) {
        const idx = pair.indexOf("=");
        if (idx === -1) continue;
        cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
    }
    return cookies;
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE];
    if (token && validSessions.has(token)) {
        next();
        return;
    }
    res.redirect("/admin/login");
}

app.get("/", (req, res) => {
    res.sendFile(join(import.meta.dir, "index.html"));
});

app.get("/admin/login", (req, res) => {
    res.sendFile(join(import.meta.dir, "admin-login.html"));
});

app.post("/admin/login/options", loginRateLimit, async (req, res) => {
    const store = loadPasskeys();
    if (store.credentials.length === 0) {
        res.status(400).json({ status: "no_passkeys" });
        return;
    }
    const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        userVerification: "preferred",
        allowCredentials: store.credentials.map((c) => ({ id: c.id, transports: c.transports })),
    });
    const challengeId = crypto.randomUUID();
    loginChallenges.set(challengeId, { challenge: options.challenge, expires: Date.now() + CHALLENGE_TTL_MS });
    res.cookie(CHALLENGE_COOKIE, challengeId, { httpOnly: true, sameSite: "strict", maxAge: CHALLENGE_TTL_MS });
    res.json(options);
});

app.post("/admin/login/verify", loginRateLimit, async (req, res) => {
    const challengeId = parseCookies(req.headers.cookie)[CHALLENGE_COOKIE];
    const entry = challengeId ? loginChallenges.get(challengeId) : undefined;
    if (challengeId) loginChallenges.delete(challengeId);
    if (!entry || entry.expires < Date.now()) {
        res.status(400).json({ status: "challenge_expired" });
        return;
    }

    const store = loadPasskeys();
    const passkey = store.credentials.find((c) => c.id === req.body?.id);
    if (!passkey) {
        res.status(401).json({ status: "unknown_passkey" });
        return;
    }

    try {
        const verification = await verifyAuthenticationResponse({
            response: req.body,
            expectedChallenge: entry.challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
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
        passkey.counter = verification.authenticationInfo.newCounter;
        savePasskeys(store);
    } catch (err) {
        console.error("passkey login failed", err);
        res.status(401).json({ status: "verification_failed" });
        return;
    }

    const token = crypto.randomUUID();
    validSessions.add(token);
    res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE_MS,
    });
    res.json({ status: "ok" });
});

app.get("/admin/enroll", (req, res) => {
    res.sendFile(join(import.meta.dir, "admin-enroll.html"));
});

app.post("/admin/enroll/options", loginRateLimit, async (req, res) => {
    const { token } = req.body;
    if (!isValidEnrollToken(token)) {
        res.status(403).json({ status: "invalid_token" });
        return;
    }
    const store = loadPasskeys();
    const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: "admin",
        userID: new TextEncoder().encode(store.userId),
        attestationType: "none",
        excludeCredentials: store.credentials.map((c) => ({ id: c.id, transports: c.transports })),
        authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });
    enrollChallenges.set(token, { challenge: options.challenge, expires: Date.now() + CHALLENGE_TTL_MS });
    res.json(options);
});

app.post("/admin/enroll/verify", loginRateLimit, async (req, res) => {
    const { token, response } = req.body;
    const entry = typeof token === "string" ? enrollChallenges.get(token) : undefined;
    if (!isValidEnrollToken(token) || !entry || entry.expires < Date.now()) {
        res.status(403).json({ status: "invalid_token" });
        return;
    }
    enrollChallenges.delete(token);

    try {
        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge: entry.challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
        });
        if (!verification.verified) {
            res.status(400).json({ status: "verification_failed" });
            return;
        }
        const { credential } = verification.registrationInfo;
        const store = loadPasskeys();
        store.credentials.push({
            id: credential.id,
            publicKey: Buffer.from(credential.publicKey).toString("base64url"),
            counter: credential.counter,
            transports: credential.transports as AuthenticatorTransport[] | undefined,
        });
        savePasskeys(store);
        consumeEnrollToken(token);
        res.json({ status: "ok" });
    } catch (err) {
        console.error("passkey enrollment failed", err);
        res.status(400).json({ status: "verification_failed" });
    }
});

app.get("/admin", requireAdmin, (req, res) => {
    res.sendFile(join(import.meta.dir, "admin.html"));
})

app.get("/messages", (req, res) => {
    const cutoff = Date.now() - messageTtlMs;
    while (approvedMessages.length > 0 && approvedMessages[0]!.sentAt < cutoff) {
        approvedMessages.shift();
    }
    res.json(approvedMessages);
});

async function verifyTurnstile(token: unknown, ip: string | undefined): Promise<boolean> {
    if (!turnstile_secret || typeof token !== "string" || !token) return false;
    const body = new URLSearchParams({ secret: turnstile_secret, response: token });
    if (ip) body.set("remoteip", ip);
    try {
        const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            body,
        });
        const data = (await res.json()) as { success?: boolean };
        return data.success === true;
    } catch (err) {
        console.error("turnstile verification failed", err);
        return false;
    }
}

app.post("/messages", async (req, res) => {
    const { author, message } = req.body;
    const token = req.body["cf-turnstile-response"];
    if (!(await verifyTurnstile(token, req.ip))) {
        res.status(403).json({ status: "turnstile_failed" });
        return;
    }
    messageQueue.push({ id: crypto.randomUUID(), author: author, text: message, sentAt: Date.now() });
    res.json({ status: "pending" });
});

app.get("/admin/api/messages", requireAdmin, (req, res) => {
    res.json({ pending: messageQueue, approved: approvedMessages });
});

app.post("/admin/api/messages/:id/approve", requireAdmin, (req, res) => {
    const index = messageQueue.findIndex((m) => m.id === req.params.id);
    if (index === -1) {
        res.status(404).json({ status: "not_found" });
        return;
    }
    const [message] = messageQueue.splice(index, 1);
    message!.sentAt = Date.now();
    approvedMessages.push(message!);
    res.json({ status: "ok" });
});

app.post("/admin/api/messages/:id/reject", requireAdmin, (req, res) => {
    const index = messageQueue.findIndex((m) => m.id === req.params.id);
    if (index === -1) {
        res.status(404).json({ status: "not_found" });
        return;
    }
    messageQueue.splice(index, 1);
    res.json({ status: "ok" });
});

app.delete("/admin/api/messages/:id", requireAdmin, (req, res) => {
    const index = approvedMessages.findIndex((m) => m.id === req.params.id);
    if (index === -1) {
        res.status(404).json({ status: "not_found" });
        return;
    }
    approvedMessages.splice(index, 1);
    res.json({ status: "ok" });
});

app.get("/admin/api/config", requireAdmin, (req, res) => {
    res.json({ ttlMinutes: messageTtlMs / 60000 });
});

app.post("/admin/api/config", requireAdmin, (req, res) => {
    const { ttlMinutes } = req.body;
    const minutes = Number(ttlMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
        res.status(400).json({ status: "invalid_ttl" });
        return;
    }
    messageTtlMs = minutes * 60000;
    res.json({ status: "ok", ttlMinutes: minutes });
});

app.listen(3000, () => {
    console.log("running on http://localhost:3000/");
});
