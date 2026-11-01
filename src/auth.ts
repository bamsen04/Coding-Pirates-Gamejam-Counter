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

// Rate limit for the login/enroll endpoints: per IP, fixed window.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_REQUESTS = 20; // a normal login is 2 requests
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function loginRateLimit(req: Request, res: Response, next: NextFunction) {
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

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token && validSessions.has(token)) {
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
