import type { NextFunction, Request, Response } from "express";

const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const validSessions = new Set<string>();

export const CHALLENGE_COOKIE = "login_challenge";
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export interface PendingChallenge {
    challenge: string;
    expires: number;
}
export const loginChallenges = new Map<string, PendingChallenge>();
export const enrollChallenges = new Map<string, PendingChallenge>();

// Rate limits for the login endpoints: per IP, fixed window.
type Attempts = Map<string, { count: number; resetAt: number }>;
const allAttempts: Attempts[] = [];

export function createRateLimit(windowMs: number, maxRequests: number) {
    const attempts: Attempts = new Map();
    allAttempts.push(attempts);

    return (req: Request, res: Response, next: NextFunction) => {
        const now = Date.now();
        const key = req.ip ?? "unknown";
        let entry = attempts.get(key);
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            attempts.set(key, entry);
        }
        entry.count++;
        if (entry.count > maxRequests) {
            res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
            res.status(429).json({ status: "rate_limited" });
            return;
        }
        next();
    };
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Admin login and passkey enrollment. A normal login is 2 requests.
export const loginRateLimit = createRateLimit(FIFTEEN_MINUTES, 20);

// Logging in to a hold. Roomier: a whole room of players can share one IP.
export const holdLoginRateLimit = createRateLimit(FIFTEEN_MINUTES, 100);

// Drop expired rate-limit entries and challenges so the maps don't grow forever.
setInterval(() => {
    const now = Date.now();
    for (const attempts of allAttempts) for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
    for (const [k, v] of loginChallenges) if (v.expires <= now) loginChallenges.delete(k);
    for (const [k, v] of enrollChallenges) if (v.expires <= now) enrollChallenges.delete(k);
}, 60 * 1000).unref();

export function parseCookies(header: string | undefined): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!header) return cookies;
    for (const pair of header.split(";")) {
        const idx = pair.indexOf("=");
        if (idx === -1) continue;
        cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
    }
    return cookies;
}

export function isAdmin(req: Request): boolean {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    return token !== undefined && validSessions.has(token);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (isAdmin(req)) {
        next();
        return;
    }
    res.redirect("/admin/login");
}

export function startAdminSession(res: Response) {
    const token = crypto.randomUUID();
    validSessions.add(token);
    res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE_MS,
    });
}
