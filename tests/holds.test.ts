import { beforeEach, describe, expect, test } from "bun:test";
import { affected, mockDb } from "./helpers";

const holds = await import("../src/services/holds");
const { COOLDOWN_MS, claimIpCooldown, cooldownRemaining, ipCooldownRemaining } = await import("../src/services/cooldown");

beforeEach(() => mockDb.reset());

const row = (overrides: Record<string, unknown> = {}) => ({
    id: 5,
    kind: "hold",
    hold_number: 5,
    token: "ABCD2345",
    last_sent_at: null,
    cooldown_ms: null,
    banned: 0,
    ...overrides,
});

describe("hold codes", () => {
    test("are 8 characters of capital letters and digits", () => {
        for (let i = 0; i < 200; i++) expect(holds.generateToken()).toMatch(/^[A-Z0-9]{8}$/);
    });

    test("leave out characters that look alike (0, O, 1, I)", () => {
        const all = Array.from({ length: 500 }, () => holds.generateToken()).join("");
        expect(all).not.toMatch(/[01IO]/);
    });

    test("are not all the same", () => {
        const codes = new Set(Array.from({ length: 50 }, () => holds.generateToken()));
        expect(codes.size).toBe(50);
    });

    test("are typed forgivingly: case and surrounding spaces don't matter", () => {
        expect(holds.normalizeToken(" abcd2345 ")).toBe("ABCD2345");
        expect(holds.normalizeToken("ABCD2345")).toBe("ABCD2345");
    });

    test.each([[""], ["   "], [undefined], [null], [12345678], [{}]])("%p is not a code", (value) => {
        expect(holds.normalizeToken(value)).toBeNull();
    });
});

describe("reading holds", () => {
    test("labels them Hold N, and frivillig", async () => {
        mockDb.rows = [row(), row({ id: 9, kind: "frivillig", hold_number: null, token: "FRIV2345" })];
        const [hold, frivillig] = await holds.listHolds();

        expect(hold).toMatchObject({ id: 5, kind: "hold", number: 5, label: "Hold 5", token: "ABCD2345" });
        expect(frivillig).toMatchObject({ id: 9, kind: "frivillig", number: null, label: "frivillig" });
    });

    test("a hold waits 10 minutes by default, frivillig doesn't wait", async () => {
        mockDb.rows = [row(), row({ kind: "frivillig", hold_number: null })];
        const [hold, frivillig] = await holds.listHolds();

        expect(hold).toMatchObject({ cooldownMs: COOLDOWN_MS, customCooldown: false });
        expect(frivillig).toMatchObject({ cooldownMs: 0, customCooldown: false });
    });

    test("a cooldown set for the hold wins, even for frivillig, even zero", async () => {
        mockDb.rows = [
            row({ cooldown_ms: 25 * 60000 }),
            row({ kind: "frivillig", hold_number: null, cooldown_ms: 60000 }),
            row({ cooldown_ms: 0 }),
        ];
        const [slow, frivillig, none] = await holds.listHolds();

        expect(slow).toMatchObject({ cooldownMs: 25 * 60000, customCooldown: true });
        expect(frivillig).toMatchObject({ cooldownMs: 60000, customCooldown: true });
        expect(none).toMatchObject({ cooldownMs: 0, customCooldown: true });
    });

    test.each([
        [0, false],
        [1, true],
        [true, true],
        [false, false],
        ["1", true],
    ])("reads banned %p as %p", async (banned, expected) => {
        mockDb.rows = [row({ banned })];
        expect((await holds.listHolds())[0]!.banned).toBe(expected);
    });

    test("finds a hold by the code as typed", async () => {
        mockDb.handler = (sql, values) => (values[0] === "ABCD2345" ? [row()] : []);

        expect((await holds.findHoldByToken(" abcd2345 "))?.label).toBe("Hold 5");
        expect(await holds.findHoldByToken("ZZZZ9999")).toBeUndefined();
    });

    test("doesn't query for something that isn't a code", async () => {
        expect(await holds.findHoldByToken("")).toBeUndefined();
        expect(await holds.findHoldByToken(undefined)).toBeUndefined();
        expect(mockDb.calls).toHaveLength(0);
    });
});

describe("a hold's cooldown", () => {
    const hold = (overrides: Record<string, unknown> = {}) => {
        mockDb.rows = [row(overrides)];
        return holds.listHolds().then((list) => list[0]!);
    };

    test("is nothing before it has sent", async () => {
        expect(holds.holdCooldownRemaining(await hold())).toBe(0);
    });

    test("counts down from the last message", async () => {
        const now = 1_000_000_000;
        const h = await hold({ last_sent_at: now - 4 * 60000 });

        expect(holds.holdCooldownRemaining(h, now)).toBe(6 * 60000);
        expect(holds.holdCooldownRemaining(h, now + 6 * 60000)).toBe(0);
        expect(holds.holdCooldownRemaining(h, now + 99 * 60000)).toBe(0);
    });

    test("follows the cooldown set for that hold", async () => {
        const now = 1_000_000_000;
        const h = await hold({ last_sent_at: now - 60000, cooldown_ms: 3 * 60000 });

        expect(holds.holdCooldownRemaining(h, now)).toBe(2 * 60000);
    });

    test("can be claimed when it has run out: one query, with the right cutoff", async () => {
        const h = await hold({ id: 5 });
        mockDb.handler = () => affected(1);
        const now = 1_000_000_000;

        expect(await holds.claimHoldCooldown(h, now)).toBe(true);
        const [update] = mockDb.queries("UPDATE holds SET last_sent_at");
        expect(update!.slice(1)).toEqual([now, 5, now - COOLDOWN_MS]);
    });

    test("can't be claimed while it hasn't (the update changes nothing)", async () => {
        const h = await hold();
        mockDb.handler = () => affected(0);

        expect(await holds.claimHoldCooldown(h)).toBe(false);
    });

    test("with a cooldown of zero is always claimed, without asking the database", async () => {
        const h = await hold({ cooldown_ms: 0 });
        mockDb.reset();

        expect(await holds.claimHoldCooldown(h)).toBe(true);
        expect(mockDb.calls).toHaveLength(0);
    });

    test("for frivillig is always claimed, without asking the database", async () => {
        const h = await hold({ kind: "frivillig", hold_number: null });
        mockDb.reset();

        expect(await holds.claimHoldCooldown(h)).toBe(true);
        expect(mockDb.calls).toHaveLength(0);
    });
});

describe("cooldownRemaining", () => {
    test("is the time left of the wait", () => {
        expect(cooldownRemaining(1000, 5000, 3000)).toBe(3000);
        expect(cooldownRemaining(1000, 5000, 6000)).toBe(0);
        expect(cooldownRemaining(1000, 5000, 9000)).toBe(0);
    });

    test("is nothing if nothing was ever sent", () => {
        expect(cooldownRemaining(null)).toBe(0);
    });

    test("is 10 minutes by default", () => {
        expect(cooldownRemaining(0, undefined, 0)).toBe(10 * 60 * 1000);
    });
});

describe("the cooldown per IP", () => {
    test("lets the first message through and holds back the next", () => {
        const ip = "203.0.113.1";
        const now = 5_000_000;

        expect(claimIpCooldown(ip, now)).toBe(true);
        expect(claimIpCooldown(ip, now + 1000)).toBe(false);
        expect(ipCooldownRemaining(ip, now + 1000)).toBe(COOLDOWN_MS - 1000);
    });

    test("lets the IP through again after 10 minutes", () => {
        const ip = "203.0.113.2";
        const now = 5_000_000;
        claimIpCooldown(ip, now);

        expect(claimIpCooldown(ip, now + COOLDOWN_MS - 1)).toBe(false);
        expect(claimIpCooldown(ip, now + COOLDOWN_MS)).toBe(true);
    });

    test("keeps IPs apart", () => {
        const now = 5_000_000;
        claimIpCooldown("203.0.113.3", now);

        expect(claimIpCooldown("203.0.113.4", now)).toBe(true);
    });

    test("a refused claim doesn't push the cooldown further out", () => {
        const ip = "203.0.113.5";
        const now = 5_000_000;
        claimIpCooldown(ip, now);
        claimIpCooldown(ip, now + 5 * 60000); // refused

        expect(ipCooldownRemaining(ip, now + 5 * 60000)).toBe(5 * 60000);
    });
});
