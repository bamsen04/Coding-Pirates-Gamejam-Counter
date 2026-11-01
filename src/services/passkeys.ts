import type { AuthenticatorTransport } from "@simplewebauthn/server";
import db from "./db";

export const ENROLL_TOKEN_TTL_MS = 15 * 60 * 1000;

export interface StoredPasskey {
    id: string;
    publicKey: string; // base64url
    counter: number;
    transports: AuthenticatorTransport[];
}

// The JSON column comes back either parsed or as a string depending on the driver.
function parseTransports(value: unknown): AuthenticatorTransport[] {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? (parsed as AuthenticatorTransport[]) : [];
}

function toPasskey(row: any): StoredPasskey {
    return {
        id: row.credential_id,
        publicKey: row.public_key,
        counter: Number(row.counter),
        transports: parseTransports(row.transports),
    };
}

// There is a single admin user; every passkey shares the same WebAuthn user id.
export async function getUserId(): Promise<string> {
    const rows = await db`SELECT user_id FROM admin_passkeys LIMIT 1`;
    return rows[0]?.user_id ?? crypto.randomUUID();
}

export async function listPasskeys(): Promise<StoredPasskey[]> {
    const rows = await db`SELECT credential_id, public_key, counter, transports FROM admin_passkeys`;
    return rows.map(toPasskey);
}

export async function getPasskey(id: unknown): Promise<StoredPasskey | undefined> {
    if (typeof id !== "string") return undefined;
    const rows = await db`SELECT credential_id, public_key, counter, transports FROM admin_passkeys WHERE credential_id = ${id}`;
    return rows[0] ? toPasskey(rows[0]) : undefined;
}

export async function addPasskey(userId: string, passkey: StoredPasskey): Promise<void> {
    await db`INSERT INTO admin_passkeys (user_id, credential_id, public_key, counter, transports)
        VALUES (${userId}, ${passkey.id}, ${passkey.publicKey}, ${passkey.counter}, ${JSON.stringify(passkey.transports)})`;
}

export async function updateCounter(id: string, counter: number): Promise<void> {
    await db`UPDATE admin_passkeys SET counter = ${counter} WHERE credential_id = ${id}`;
}

export async function createEnrollToken(): Promise<string> {
    const now = Date.now();
    await db`DELETE FROM enrollment_tokens WHERE expires_at <= ${now}`;
    const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
    await db`INSERT INTO enrollment_tokens (token, expires_at) VALUES (${token}, ${now + ENROLL_TOKEN_TTL_MS})`;
    return token;
}

export async function isValidEnrollToken(token: unknown): Promise<boolean> {
    if (typeof token !== "string") return false;
    const rows = await db`SELECT 1 AS ok FROM enrollment_tokens WHERE token = ${token} AND expires_at > ${Date.now()}`;
    return rows.length > 0;
}

// Atomic: only one caller can consume a given token.
export async function consumeEnrollToken(token: string): Promise<boolean> {
    const result = await db`DELETE FROM enrollment_tokens WHERE token = ${token} AND expires_at > ${Date.now()}`;
    return result.affectedRows > 0;
}
