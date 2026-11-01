import { beforeEach, describe, expect, test } from "bun:test";
import { affected, callRoute, mockDb, mockRes } from "./helpers";

const { default: login } = await import("../src/api/hold/login.post");
const { default: logout } = await import("../src/api/hold/logout.post");
const { default: me } = await import("../src/api/me.get");
const { default: listRoute } = await import("../src/api/admin/api/holds.get");
const { default: generate } = await import("../src/api/admin/api/holds.post");
const { default: regenerate } = await import("../src/api/admin/api/holds/[id]/token.post");
const { default: ban } = await import("../src/api/admin/api/holds/[id]/ban.post");
const { default: cooldown } = await import("../src/api/admin/api/holds/[id]/cooldown.post");
const { default: pdfOne } = await import("../src/api/admin/api/holds/[id]/pdf.get");
const { default: pdfAll } = await import("../src/api/admin/api/holds/pdf.get");

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

// A database with the given holds in it (matched by token or id).
function database(...holds: Record<string, unknown>[]) {
    mockDb.handler = (sql, values) => {
        if (sql.startsWith("SELECT") && sql.includes("WHERE token =")) return holds.filter((h) => h.token === values[0]);
        if (sql.startsWith("SELECT") && sql.includes("WHERE id =")) return holds.filter((h) => h.id === values[0]);
        if (sql.startsWith("SELECT") && sql.includes("FROM holds")) return holds;
        return affected(1);
    };
}

beforeEach(() => {
    mockDb.reset();
    database(holdRow());
});

describe("logging in to a hold", () => {
    test("with the right code sets the cookie and says who you are", async () => {
        const res = await callRoute(login, { body: { token: "ABCD2345" } });

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ status: "ok", label: "Hold 5" });
        expect(res.cookies).toHaveLength(1);
        expect(res.cookies[0]!.name).toBe("hold_token");
        expect(res.cookies[0]!.value).toBe("ABCD2345");
        expect(res.cookies[0]!.options).toMatchObject({ httpOnly: true, sameSite: "lax" });
    });

    test("does not care about case or spaces around the code", async () => {
        const res = await callRoute(login, { body: { token: "  abcd2345 " } });

        expect(res.statusCode).toBe(200);
        expect(res.cookies[0]!.value).toBe("ABCD2345");
    });

    test.each([
        ["a wrong code", "ZZZZ9999"],
        ["an empty code", ""],
        ["a code that is not text", 12345678],
        ["no code", undefined],
    ])("is refused with %s", async (_, token) => {
        const res = await callRoute(login, { body: { token } });

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ status: "unknown_hold" });
        expect(res.cookies).toHaveLength(0);
    });

    test("works for a banned hold too (it just can't send)", async () => {
        database(holdRow({ banned: 1 }));
        expect((await callRoute(login, { body: { token: "ABCD2345" } })).statusCode).toBe(200);
    });
});

test("logging out clears the cookie", async () => {
    const res = await callRoute(logout, {});

    expect(res.clearedCookies).toEqual(["hold_token"]);
    expect(res.body).toEqual({ status: "ok" });
});

describe("GET /me", () => {
    test("says nobody is logged in", async () => {
        database();
        const res = await callRoute(me, { ip: "198.51.100.1" });

        expect(res.body).toEqual({ kind: "none", label: "Ingen hold", banned: false, cooldownMs: 0 });
    });

    test("says which hold you are, and how long its cooldown has left", async () => {
        database(holdRow({ last_sent_at: Date.now() - 60 * 1000 }));
        const res = await callRoute(me, { headers: { cookie: "hold_token=ABCD2345" } });

        const body = res.body as { kind: string; label: string; banned: boolean; cooldownMs: number };
        expect(body).toMatchObject({ kind: "hold", label: "Hold 5", banned: false });
        expect(body.cooldownMs).toBeGreaterThan(8 * 60 * 1000);
        expect(body.cooldownMs).toBeLessThanOrEqual(9 * 60 * 1000);
    });

    test("reports a banned hold", async () => {
        database(holdRow({ banned: 1 }));
        const res = await callRoute(me, { headers: { cookie: "hold_token=ABCD2345" } });

        expect(res.body).toMatchObject({ kind: "hold", banned: true });
    });

    test("frivillig never waits", async () => {
        database(holdRow({ kind: "frivillig", hold_number: null, token: "FRIV2345", last_sent_at: Date.now() }));
        const res = await callRoute(me, { headers: { cookie: "hold_token=FRIV2345" } });

        expect(res.body).toMatchObject({ kind: "frivillig", label: "frivillig", cooldownMs: 0 });
    });
});

describe("GET /admin/api/holds", () => {
    test("lists the holds with their code, ban and cooldown in minutes", async () => {
        database(
            holdRow({ banned: 1, cooldown_ms: 20 * 60 * 1000 }),
            holdRow({ id: 6, hold_number: 6, token: "WXYZ2345" }),
            holdRow({ id: 15, kind: "frivillig", hold_number: null, token: "FRIV2345" }),
        );
        const res = await callRoute(listRoute, {});

        expect(res.body).toEqual([
            { id: 5, kind: "hold", label: "Hold 5", token: "ABCD2345", banned: true, cooldownMinutes: 20, customCooldown: true },
            { id: 6, kind: "hold", label: "Hold 6", token: "WXYZ2345", banned: false, cooldownMinutes: 10, customCooldown: false },
            { id: 15, kind: "frivillig", label: "frivillig", token: "FRIV2345", banned: false, cooldownMinutes: 0, customCooldown: false },
        ]);
    });
});

describe("POST /admin/api/holds (generate)", () => {
    test("makes the holds plus frivillig, each with its own code", async () => {
        mockDb.handler = (sql) => (sql.startsWith("SELECT") ? [] : affected(1)); // no clashing code
        const res = await callRoute(generate, { body: { count: 14 } });

        expect(res.statusCode).toBe(200);
        expect(mockDb.queries("DELETE FROM holds")).toHaveLength(1);

        const inserts = mockDb.queries("INSERT INTO holds");
        expect(inserts).toHaveLength(15);
        const tokens = inserts.map((insert) => insert.at(-1) as string);
        expect(new Set(tokens).size).toBe(15);
        for (const token of tokens) expect(token).toMatch(/^[A-Z2-9]{8}$/);
        expect(inserts[0]![1]).toBe(1);
        expect(inserts[13]![1]).toBe(14);
        expect(String(inserts[14]![0])).toContain("'frivillig'");
    });

    test("starts from scratch: the old holds go first", async () => {
        mockDb.handler = (sql) => (sql.startsWith("SELECT") ? [] : affected(1));
        await callRoute(generate, { body: { count: 3 } });

        const firstInsert = mockDb.calls.findIndex((c) => String(c[0]).startsWith("INSERT INTO holds"));
        const delete_ = mockDb.calls.findIndex((c) => String(c[0]).startsWith("DELETE FROM holds"));
        expect(delete_).toBeLessThan(firstInsert);
    });

    test.each([
        ["zero", 0],
        ["negative", -1],
        ["over 99", 100],
        ["fractional", 1.5],
        ["text", "14"],
        ["missing", undefined],
    ])("is refused for a count that is %s", async (_, count) => {
        const res = await callRoute(generate, { body: { count } });

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ status: "invalid_count" });
        expect(mockDb.calls).toHaveLength(0);
    });
});

describe("a new code for one hold", () => {
    test("replaces only that hold's code", async () => {
        const res = await callRoute(regenerate, { params: { id: "5" } });

        expect(res.statusCode).toBe(200);
        const [update] = mockDb.queries("UPDATE holds SET token");
        expect(update![1]).toMatch(/^[A-Z2-9]{8}$/);
        expect(update![1]).not.toBe("ABCD2345");
        expect(update![2]).toBe(5);
    });

    test("is 404 for a hold that doesn't exist", async () => {
        const res = await callRoute(regenerate, { params: { id: "99" } });

        expect(res.statusCode).toBe(404);
        expect(mockDb.queries("UPDATE")).toHaveLength(0);
    });
});

describe("banning a hold", () => {
    test("bans it", async () => {
        const res = await callRoute(ban, { params: { id: "5" }, body: { banned: true } });

        expect(res.statusCode).toBe(200);
        expect(mockDb.queries("UPDATE holds SET banned")[0]!.slice(1)).toEqual([true, 5]);
    });

    test("lifts the ban", async () => {
        await callRoute(ban, { params: { id: "5" }, body: { banned: false } });
        expect(mockDb.queries("UPDATE holds SET banned")[0]!.slice(1)).toEqual([false, 5]);
    });

    test("needs true or false", async () => {
        const res = await callRoute(ban, { params: { id: "5" }, body: { banned: "yes" } });

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ status: "invalid_banned" });
        expect(mockDb.queries("UPDATE")).toHaveLength(0);
    });

    test("is 404 for a hold that doesn't exist", async () => {
        expect((await callRoute(ban, { params: { id: "99" }, body: { banned: true } })).statusCode).toBe(404);
    });
});

describe("a cooldown for one hold", () => {
    const setCooldown = (minutes: unknown, id = "5") => callRoute(cooldown, { params: { id }, body: { minutes } });
    const stored = () => mockDb.queries("UPDATE holds SET cooldown_ms")[0]!.slice(1);

    test("is stored in milliseconds", async () => {
        expect((await setCooldown(30)).statusCode).toBe(200);
        expect(stored()).toEqual([30 * 60000, 5]);
    });

    test("can be a fraction of a minute", async () => {
        await setCooldown(0.5);
        expect(stored()).toEqual([30000, 5]);
    });

    test("can be none at all", async () => {
        await setCooldown(0);
        expect(stored()).toEqual([0, 5]);
    });

    test("null goes back to the default", async () => {
        await setCooldown(null);
        expect(stored()).toEqual([null, 5]);
    });

    test.each([
        ["negative", -1],
        ["over a day", 1441],
        ["text", "10"],
        ["missing", undefined],
        ["not a number", NaN],
    ])("is refused when it is %s", async (_, minutes) => {
        const res = await setCooldown(minutes);

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ status: "invalid_minutes" });
        expect(mockDb.queries("UPDATE")).toHaveLength(0);
    });

    test("is 404 for a hold that doesn't exist", async () => {
        expect((await setCooldown(10, "99")).statusCode).toBe(404);
    });
});

describe("the PDFs", () => {
    test("one hold's PDF is a PDF with that hold in it", async () => {
        const res = await callRoute(pdfOne, { params: { id: "5" } });
        const pdf = (res.body as Buffer).toString("latin1");

        expect(res.headers["Content-Type"]).toBe("application/pdf");
        expect(res.headers["Content-Disposition"]).toBe('attachment; filename="Hold-5.pdf"');
        expect(pdf.startsWith("%PDF-1.4")).toBe(true);
        expect(pdf).toContain("(ABCD2345)");
        expect(pdf).toContain("(HOLD 5)");
    });

    test("one hold's PDF is 404 for a hold that doesn't exist", async () => {
        expect((await callRoute(pdfOne, { params: { id: "99" } })).statusCode).toBe(404);
    });

    test("the PDF of all holds has every hold, and the site's address", async () => {
        database(holdRow(), holdRow({ id: 6, hold_number: 6, token: "WXYZ2345" }));
        const res = await callRoute(pdfAll, {});
        const pdf = (res.body as Buffer).toString("latin1");

        expect(res.headers["Content-Disposition"]).toBe('attachment; filename="hold-koder.pdf"');
        expect(pdf).toContain("(ABCD2345)");
        expect(pdf).toContain("(WXYZ2345)");
        expect(pdf).toContain("(countdown.example.dk)"); // from ORIGIN, set in helpers
    });
});
