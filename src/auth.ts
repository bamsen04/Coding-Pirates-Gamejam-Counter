import type { CookieOptions, NextFunction, Request, Response } from "express";
import { config, normalizeIp } from "./config";

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

// A malformed cookie (a stray "%") must not take the request down.
function decode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export function parseCookies(header: string | undefined): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!header) return cookies;
    for (const pair of header.split(";")) {
        const idx = pair.indexOf("=");
        if (idx === -1) continue;
        cookies[pair.slice(0, idx).trim()] = decode(pair.slice(idx + 1).trim());
    }
    return cookies;
}

/**
 * Sets a cookie the page's scripts can't read, and, when the site is served over HTTPS, one the
 * browser only ever sends over HTTPS. Every cookie goes through here.
 */
export function setCookie(res: Response, name: string, value: string, options: CookieOptions = {}) {
    res.cookie(name, value, { httpOnly: true, secure: config.secureCookies, ...options });
}

// --- Rate limits for the login endpoints: fixed window, per IP ---

type Attempts = Map<string, { count: number; resetAt: number }>;
const allAttempts: Attempts[] = [];

// An address in ALLOWED_IPS (e.g. the venue's) gets this many times the allowance...
const ALLOWED_IP_MULTIPLIER = 5;
// ...and counts it per browser instead of for the whole address. Everyone at the venue shares one public
// IP, so one person trying too often would otherwise lock out everyone, the admin included.
const MACHINE_COOKIE = "machine_id";
const MACHINE_ID = /^[0-9a-f-]{36}$/;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function isAllowedIp(ip: string | undefined): boolean {
    return ip !== undefined && config.allowedIps.has(normalizeIp(ip));
}

// A random id for this browser, set the first time it is needed. Clearing cookies gives a fresh one,
// which is acceptable for an address you chose to trust.
function machineId(req: Request, res: Response): string {
    const existing = parseCookies(req.headers.cookie)[MACHINE_COOKIE];
    if (existing && MACHINE_ID.test(existing)) return existing;

    const id = crypto.randomUUID();
    setCookie(res, MACHINE_COOKIE, id, { sameSite: "lax", maxAge: YEAR_MS });
    return id;
}

export function createRateLimit(windowMs: number, maxRequests: number) {
    const attempts: Attempts = new Map();
    allAttempts.push(attempts);

    return (req: Request, res: Response, next: NextFunction) => {
        const ip = req.ip ?? "unknown";
        const allowed = isAllowedIp(req.ip);
        const key = allowed ? `${normalizeIp(ip)}|${machineId(req, res)}` : ip;
        const max = allowed ? maxRequests * ALLOWED_IP_MULTIPLIER : maxRequests;

        const now = Date.now();
        let entry = attempts.get(key);
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            attempts.set(key, entry);
        }
        entry.count++;
        if (entry.count > max) {
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

// --- Admin sessions ---

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
    setCookie(res, SESSION_COOKIE, token, { sameSite: "lax", maxAge: SESSION_MAX_AGE_MS });
}
