import { randomInt } from "crypto";
import { COOLDOWN_MS, cooldownRemaining } from "./cooldown";
import db from "./db";

export type HoldKind = "hold" | "frivillig";

export interface Hold {
    id: number;
    kind: HoldKind;
    /** 1, 2, 3 ... for a normal hold; null for frivillig. */
    number: number | null;
    token: string;
    lastSentAt: number | null;
    /** What messages from it say: "Hold 5" or "frivillig". */
    label: string;
    /** The wait between its messages: its own if one was set, else 10 minutes (none for frivillig). */
    cooldownMs: number;
    /** Whether a cooldown was set for this hold in particular. */
    customCooldown: boolean;
    /** A banned hold can't send messages. */
    banned: boolean;
}

// Capital letters and digits, without the ones that look alike (0/O, 1/I), so a code can be read
// off a printout and typed.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TOKEN_LENGTH = 8;

export function generateToken(): string {
    let token = "";
    for (let i = 0; i < TOKEN_LENGTH; i++) token += ALPHABET[randomInt(ALPHABET.length)];
    return token;
}

// Codes are typed by hand, so don't make case or stray spaces matter.
export function normalizeToken(token: unknown): string | null {
    if (typeof token !== "string") return null;
    const normalized = token.trim().toUpperCase();
    return normalized === "" ? null : normalized;
}

function toHold(row: any): Hold {
    const kind: HoldKind = row.kind === "frivillig" ? "frivillig" : "hold";
    const number = row.hold_number == null ? null : Number(row.hold_number);
    const customCooldown = row.cooldown_ms != null;

    return {
        id: Number(row.id),
        kind,
        number,
        token: row.token,
        lastSentAt: row.last_sent_at == null ? null : Number(row.last_sent_at),
        label: kind === "frivillig" ? "frivillig" : `Hold ${number}`,
        cooldownMs: customCooldown ? Number(row.cooldown_ms) : kind === "frivillig" ? 0 : COOLDOWN_MS,
        customCooldown,
        banned: Boolean(Number(row.banned)),
    };
}

export async function listHolds(): Promise<Hold[]> {
    const rows = await db`SELECT id, kind, hold_number, token, last_sent_at, cooldown_ms, banned FROM holds
        ORDER BY kind = 'frivillig', hold_number`;
    return rows.map(toHold);
}

export async function getHold(id: number): Promise<Hold | undefined> {
    const rows = await db`SELECT id, kind, hold_number, token, last_sent_at, cooldown_ms, banned FROM holds WHERE id = ${id}`;
    return rows[0] ? toHold(rows[0]) : undefined;
}

export async function findHoldByToken(token: unknown): Promise<Hold | undefined> {
    const normalized = normalizeToken(token);
    if (!normalized) return undefined;

    const rows = await db`SELECT id, kind, hold_number, token, last_sent_at, cooldown_ms, banned FROM holds WHERE token = ${normalized}`;
    return rows[0] ? toHold(rows[0]) : undefined;
}

// A code nobody has. A clash is very unlikely (32^8 codes), but it costs one query to be sure.
async function newToken(): Promise<string> {
    for (;;) {
        const token = generateToken();
        const rows = await db`SELECT id FROM holds WHERE token = ${token}`;
        if (rows.length === 0) return token;
    }
}

/**
 * Replaces every hold with `count` new ones (Hold 1 ... Hold count) and a frivillig, each with a
 * new random code. Old codes, cooldowns and bans are gone.
 */
export async function createHolds(count: number): Promise<void> {
    await db`DELETE FROM holds`;

    for (let number = 1; number <= count; number++) {
        await db`INSERT INTO holds (kind, hold_number, token) VALUES ('hold', ${number}, ${await newToken()})`;
    }
    await db`INSERT INTO holds (kind, hold_number, token) VALUES ('frivillig', NULL, ${await newToken()})`;
}

// Gives one hold a new code. Whoever was logged in with the old one is logged out.
export async function regenerateToken(id: number): Promise<void> {
    await db`UPDATE holds SET token = ${await newToken()} WHERE id = ${id}`;
}

export async function setBanned(id: number, banned: boolean): Promise<void> {
    await db`UPDATE holds SET banned = ${banned} WHERE id = ${id}`;
}

// null goes back to the default cooldown.
export async function setCooldown(id: number, cooldownMs: number | null): Promise<void> {
    await db`UPDATE holds SET cooldown_ms = ${cooldownMs} WHERE id = ${id}`;
}

export function holdCooldownRemaining(hold: Hold, now = Date.now()): number {
    return cooldownRemaining(hold.lastSentAt, hold.cooldownMs, now);
}

/**
 * Starts a hold's cooldown. One query, so two people on the same hold sending at the same moment
 * can't both get through. False if the hold is still cooling down.
 */
export async function claimHoldCooldown(hold: Hold, now = Date.now()): Promise<boolean> {
    if (hold.cooldownMs === 0) return true;

    const result = await db`UPDATE holds SET last_sent_at = ${now}
        WHERE id = ${hold.id} AND (last_sent_at IS NULL OR last_sent_at <= ${now - hold.cooldownMs})`;
    return result.affectedRows > 0;
}
