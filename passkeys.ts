import { join } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import type { AuthenticatorTransport } from "@simplewebauthn/server";

export const RP_ID = process.env.RP_ID ?? "localhost";
export const RP_NAME = "CP Gamejam";
export const ORIGIN = process.env.ORIGIN ?? "http://localhost:3000";

const PASSKEYS_FILE = join(import.meta.dir, "passkeys.json");
const ENROLL_FILE = join(import.meta.dir, "enroll-tokens.json");

export const ENROLL_TOKEN_TTL_MS = 15 * 60 * 1000;

export interface StoredPasskey {
    id: string;
    publicKey: string; // base64url
    counter: number;
    transports?: AuthenticatorTransport[];
}

interface PasskeyStore {
    userId: string;
    credentials: StoredPasskey[];
}

function readJson<T>(file: string, fallback: T): T {
    if (!existsSync(file)) return fallback;
    return JSON.parse(readFileSync(file, "utf8")) as T;
}

export function loadPasskeys(): PasskeyStore {
    return readJson<PasskeyStore>(PASSKEYS_FILE, { userId: crypto.randomUUID(), credentials: [] });
}

export function savePasskeys(store: PasskeyStore) {
    writeFileSync(PASSKEYS_FILE, JSON.stringify(store, null, 2));
}

type EnrollTokens = Record<string, number>; // token -> expiry (ms)

function loadTokens(): EnrollTokens {
    const tokens = readJson<EnrollTokens>(ENROLL_FILE, {});
    const now = Date.now();
    for (const [token, expires] of Object.entries(tokens)) {
        if (expires < now) delete tokens[token];
    }
    return tokens;
}

export function createEnrollToken(): string {
    const tokens = loadTokens();
    const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
    tokens[token] = Date.now() + ENROLL_TOKEN_TTL_MS;
    writeFileSync(ENROLL_FILE, JSON.stringify(tokens, null, 2));
    return token;
}

export function isValidEnrollToken(token: unknown): boolean {
    return typeof token === "string" && token in loadTokens();
}

export function consumeEnrollToken(token: string) {
    const tokens = loadTokens();
    delete tokens[token];
    writeFileSync(ENROLL_FILE, JSON.stringify(tokens, null, 2));
}
