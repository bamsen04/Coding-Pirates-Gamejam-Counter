import { beforeEach, describe, expect, test } from "bun:test";
import { affected, callRoute, mockDb, mockRes } from "./helpers";

const { default: sendMessage } = await import("../src/api/messages.post");
const { startAdminSession } = await import("../src/auth");

const holdRow = (overrides: Record<string, unknown> = {}) => ({
    id: 5,
    kind: "hold",
    hold_number: 5,
    token: "ABCD2345",
    last_sent_at: null,
    cooldown_ms: null,
    banned: 0,
    ...overrides,
});

// A database that knows one hold (or none) and lets the cooldown claim succeed or not.
function database(options: { hold?: Record<string, unknown>; claimSucceeds?: boolean } = {}) {
    mockDb.handler = (sql) => {
        if (sql.startsWith("SELECT") && sql.includes("FROM holds")) return options.hold ? [options.hold] : [];
        if (sql.startsWith("UPDATE holds SET last_sent_at")) return affected(options.claimSucceeds === false ? 0 : 1);
        return [];
    };
}

// Each test uses its own IP, so the per-IP cooldown of one doesn't leak into another.
let nextIp = 1;
const freshIp = () => `192.0.2.${nextIp++}`;

function send(body: Record<string, unknown>, { cookie, ip = freshIp() }: { cookie?: string; ip?: string } = {}) {
    return callRoute(sendMessage, { body, ip, headers: cookie ? { cookie } : {} });
}

const insertedMessages = () => mockDb.queries("INSERT INTO messages");
const cooldownClaims = () => mockDb.queries("UPDATE holds SET last_sent_at");

const valid = { author: "Vilhelm", message: "Hej fra holdet" };
const asHold = "hold_token=ABCD2345";

beforeEach(() => {
    mockDb.reset();
    database();
});

describe("without a hold", () => {
    test("sends as 'Ingen hold'", async () => {
        const res = await send(valid);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ status: "pending" });
        expect(insertedMessages()).toHaveLength(1);
        expect(insertedMessages()[0]!.slice(1, 4)).toEqual(["Vilhelm", "Hej fra holdet", "Ingen hold"]);
    });

    test("is limited to one message per IP in 10 minutes", async () => {
        const ip = freshIp();
        expect((await send(valid, { ip })).statusCode).toBe(200);

        const second = await send(valid, { ip });
        expect(second.statusCode).toBe(429);
        const { status, retryAfterMs } = second.body as { status: string; retryAfterMs: number };
        expect(status).toBe("cooldown");
        expect(retryAfterMs).toBeGreaterThan(9 * 60 * 1000);
        expect(retryAfterMs).toBeLessThanOrEqual(10 * 60 * 1000);
        expect(insertedMessages()).toHaveLength(1);
    });

    test("another IP is not held back by it", async () => {
        await send(valid);
        expect((await send(valid)).statusCode).toBe(200);
    });

    test("a cookie with a code nobody has counts as no hold", async () => {
        const res = await send(valid, { cookie: "hold_token=NOTAREAL" });
        expect(res.statusCode).toBe(200);
        expect(insertedMessages()[0]!.slice(1, 4)).toEqual(["Vilhelm", "Hej fra holdet", "Ingen hold"]);
    });
});

describe("as a hold", () => {
    test("sends as that hold", async () => {
        database({ hold: holdRow() });
        const res = await send(valid, { cookie: asHold });

        expect(res.statusCode).toBe(200);
        expect(insertedMessages()[0]!.slice(1, 4)).toEqual(["Vilhelm", "Hej fra holdet", "Hold 5"]);
    });

    test("starts the hold's cooldown", async () => {
        database({ hold: holdRow() });
        await send(valid, { cookie: asHold });

        expect(cooldownClaims()).toHaveLength(1);
        expect(cooldownClaims()[0]!.at(-1)).toBeLessThan(Date.now()); // the cutoff: now minus the 10 minutes
    });

    test("is held back while the hold is cooling down, whoever on the hold sends", async () => {
        database({ hold: holdRow({ last_sent_at: Date.now() - 60 * 1000 }), claimSucceeds: false });
        const res = await send(valid, { cookie: asHold });

        expect(res.statusCode).toBe(429);
        const { retryAfterMs } = res.body as { retryAfterMs: number };
        expect(retryAfterMs).toBeGreaterThan(8 * 60 * 1000);
        expect(retryAfterMs).toBeLessThanOrEqual(9 * 60 * 1000);
        expect(insertedMessages()).toHaveLength(0);
    });

    test("uses the cooldown set for that hold", async () => {
        database({ hold: holdRow({ cooldown_ms: 30 * 60 * 1000, last_sent_at: Date.now() - 60 * 1000 }), claimSucceeds: false });
        const { retryAfterMs } = (await send(valid, { cookie: asHold })).body as { retryAfterMs: number };

        expect(retryAfterMs).toBeGreaterThan(28 * 60 * 1000);
    });

    test("is not rate limited by IP: two holds on one IP can both send", async () => {
        const ip = freshIp();
        database({ hold: holdRow() });
        expect((await send(valid, { cookie: asHold, ip })).statusCode).toBe(200);
        expect((await send(valid, { cookie: asHold, ip })).statusCode).toBe(200);
    });

    test("is refused when the hold is banned", async () => {
        database({ hold: holdRow({ banned: 1 }) });
        const res = await send(valid, { cookie: asHold });

        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual({ status: "banned" });
        expect(insertedMessages()).toHaveLength(0);
        expect(cooldownClaims()).toHaveLength(0);
    });
});

describe("as frivillig", () => {
    const frivillig = (overrides: Record<string, unknown> = {}) =>
        holdRow({ id: 15, kind: "frivillig", hold_number: null, token: "FRIV2345", ...overrides });

    test("sends as frivillig, with no cooldown", async () => {
        database({ hold: frivillig() });
        const cookie = "hold_token=FRIV2345";

        expect((await send(valid, { cookie })).statusCode).toBe(200);
        expect((await send(valid, { cookie })).statusCode).toBe(200);
        expect(insertedMessages()).toHaveLength(2);
        expect(insertedMessages()[0]!.slice(1, 4)).toEqual(["Vilhelm", "Hej fra holdet", "frivillig"]);
        expect(cooldownClaims()).toHaveLength(0);
    });

    test("gets a cooldown when one is set for it", async () => {
        database({ hold: frivillig({ cooldown_ms: 5 * 60 * 1000 }), claimSucceeds: false });
        const res = await send(valid, { cookie: "hold_token=FRIV2345" });

        expect(res.statusCode).toBe(429);
    });

    test("can be banned", async () => {
        database({ hold: frivillig({ banned: 1 }) });
        expect((await send(valid, { cookie: "hold_token=FRIV2345" })).statusCode).toBe(403);
    });
});

describe("as admin", () => {
    function adminCookie() {
        const res = mockRes();
        startAdminSession(res as never);
        const { name, value } = res.cookies[0]!;
        return `${name}=${value}`;
    }

    test("sends as Admin, with no cooldown", async () => {
        const cookie = adminCookie();
        const ip = freshIp();

        expect((await send(valid, { cookie, ip })).statusCode).toBe(200);
        expect((await send(valid, { cookie, ip })).statusCode).toBe(200);
        expect(insertedMessages()).toHaveLength(2);
        expect(insertedMessages()[0]!.slice(1, 4)).toEqual(["Vilhelm", "Hej fra holdet", "Admin"]);
        expect(cooldownClaims()).toHaveLength(0);
    });

    test("wins over a hold cookie", async () => {
        database({ hold: holdRow({ banned: 1 }) });
        const res = await send(valid, { cookie: `${adminCookie()}; ${asHold}` });

        expect(res.statusCode).toBe(200);
        expect(insertedMessages()[0]!.slice(1, 4)).toEqual(["Vilhelm", "Hej fra holdet", "Admin"]);
    });
});

describe("what a message has to look like", () => {
    test("is trimmed", async () => {
        await send({ author: "  Vilhelm ", message: " Hej  " });
        expect(insertedMessages()[0]!.slice(1, 3)).toEqual(["Vilhelm", "Hej"]);
    });

    test.each([
        ["no name", { author: undefined, message: "Hej" }],
        ["no message", { author: "Vilhelm", message: undefined }],
        ["a blank name", { author: "   ", message: "Hej" }],
        ["a blank message", { author: "Vilhelm", message: "   " }],
        ["a name that is not text", { author: 5, message: "Hej" }],
        ["a name over 30 characters", { author: "x".repeat(31), message: "Hej" }],
        ["a message over 200 characters", { author: "Vilhelm", message: "x".repeat(201) }],
    ])("is refused with %s", async (_, body) => {
        const res = await send(body);

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ status: "invalid_message" });
        expect(insertedMessages()).toHaveLength(0);
    });

    test("allows the longest name and message", async () => {
        const res = await send({ author: "x".repeat(30), message: "y".repeat(200) });
        expect(res.statusCode).toBe(200);
    });

    test("a refused message does not use up the cooldown", async () => {
        const ip = freshIp();
        await send({ author: "", message: "Hej" }, { ip });
        expect((await send(valid, { ip })).statusCode).toBe(200);
    });
});
