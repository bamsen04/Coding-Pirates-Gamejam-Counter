import { describe, expect, test } from "bun:test";
import { mockRes } from "./helpers";

const { createRateLimit, isAllowedIp, parseCookies, setCookie, startAdminSession } = await import("../src/auth");
const { isHttps, normalizeIp } = await import("../src/config");

const trusted = "198.51.100.7"; // in ALLOWED_IPS, set in helpers
const stranger = "192.0.2.50";

const machine = (id: string) => `machine_id=${id}`;
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// Sends one request through the limiter. Says whether it got through, and what it answered.
function hit(limit: ReturnType<typeof createRateLimit>, ip: string | undefined, cookie?: string) {
    const res = mockRes();
    let passed = false;
    limit({ ip, headers: cookie ? { cookie } : {} } as never, res as never, () => {
        passed = true;
    });
    return { passed, res };
}

describe("an ordinary address", () => {
    test("gets the allowance, then a 429 with how long to wait", () => {
        const limit = createRateLimit(60_000, 2);

        expect(hit(limit, stranger).passed).toBe(true);
        expect(hit(limit, stranger).passed).toBe(true);

        const blocked = hit(limit, stranger);
        expect(blocked.passed).toBe(false);
        expect(blocked.res.statusCode).toBe(429);
        expect(blocked.res.body).toEqual({ status: "rate_limited" });
        expect(Number(blocked.res.headers["Retry-After"])).toBeGreaterThan(0);
    });

    test("is counted per address", () => {
        const limit = createRateLimit(60_000, 1);
        hit(limit, stranger);

        expect(hit(limit, stranger).passed).toBe(false);
        expect(hit(limit, "192.0.2.51").passed).toBe(true);
    });

    test("is not given a machine cookie", () => {
        const { res } = hit(createRateLimit(60_000, 1), stranger);

        expect(res.cookies).toHaveLength(0);
    });

    test("can't get more by sending someone's machine cookie", () => {
        const limit = createRateLimit(60_000, 1);
        hit(limit, stranger, machine(A));

        expect(hit(limit, stranger, machine(B)).passed).toBe(false);
    });
});

describe("an allowed address", () => {
    test("gets 5 times the allowance", () => {
        const limit = createRateLimit(60_000, 2); // 10 for a trusted address
        const results = Array.from({ length: 11 }, () => hit(limit, trusted, machine(A)).passed);

        expect(results.slice(0, 10).every(Boolean)).toBe(true);
        expect(results[10]).toBe(false);
    });

    test("counts it per machine: one browser running out doesn't stop another", () => {
        const limit = createRateLimit(60_000, 1); // 5 each
        for (let i = 0; i < 5; i++) hit(limit, trusted, machine(A));

        expect(hit(limit, trusted, machine(A)).passed).toBe(false);
        expect(hit(limit, trusted, machine(B)).passed).toBe(true);
    });

    test("a browser without a machine cookie is given one", () => {
        const { passed, res } = hit(createRateLimit(60_000, 1), trusted);

        expect(passed).toBe(true);
        expect(res.cookies).toHaveLength(1);
        const [cookie] = res.cookies;
        expect(cookie!.name).toBe("machine_id");
        expect(cookie!.value).toMatch(/^[0-9a-f-]{36}$/);
        expect(cookie!.options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });
    });

    test("a browser that already has one keeps it", () => {
        const { res } = hit(createRateLimit(60_000, 1), trusted, machine(A));

        expect(res.cookies).toHaveLength(0);
    });

    test("a cookie that isn't a machine id is replaced, not trusted as a key", () => {
        const { passed, res } = hit(createRateLimit(60_000, 1), trusted, "machine_id=../../etc/passwd");

        expect(passed).toBe(true);
        expect(res.cookies[0]!.value).toMatch(/^[0-9a-f-]{36}$/);
    });

    test("is recognised as an IPv4-mapped IPv6 address too", () => {
        const limit = createRateLimit(60_000, 1);
        for (let i = 0; i < 5; i++) hit(limit, `::ffff:${trusted}`, machine(A));

        expect(hit(limit, `::ffff:${trusted}`, machine(A)).passed).toBe(false); // counted as one machine...
        expect(hit(limit, trusted, machine(A)).passed).toBe(false); // ...whichever way the address is written
    });

    test("another machine cookie from a stranger's address is still limited normally", () => {
        const limit = createRateLimit(60_000, 1);
        hit(limit, stranger, machine(A));

        expect(hit(limit, stranger, machine(A)).passed).toBe(false);
    });
});

describe("isAllowedIp", () => {
    test.each([
        [trusted, true],
        ["203.0.113.9", true], // the second in the list, which had a space before it
        [`::ffff:${trusted}`, true],
        ["198.51.100.8", false],
        [stranger, false],
        [undefined, false],
        ["", false],
    ])("%p is %p", (ip, expected) => {
        expect(isAllowedIp(ip)).toBe(expected);
    });
});

test("normalizeIp turns an IPv4-mapped address into the plain one", () => {
    expect(normalizeIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(normalizeIp(" 203.0.113.7 ")).toBe("203.0.113.7");
    expect(normalizeIp("2001:db8::1")).toBe("2001:db8::1");
});

describe("cookies", () => {
    test("are secure when the site is served over https (ORIGIN is, in these tests)", () => {
        const res = mockRes();
        setCookie(res as never, "x", "1");

        expect(res.cookies[0]!.options).toMatchObject({ httpOnly: true, secure: true });
    });

    test("keep the options the caller gives", () => {
        const res = mockRes();
        setCookie(res as never, "x", "1", { sameSite: "strict", maxAge: 5 });

        expect(res.cookies[0]!.options).toMatchObject({ httpOnly: true, secure: true, sameSite: "strict", maxAge: 5 });
    });

    test("the admin session cookie is httpOnly and secure", () => {
        const res = mockRes();
        startAdminSession(res as never);

        expect(res.cookies[0]!.name).toBe("admin_session");
        expect(res.cookies[0]!.options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });
    });

    test.each([
        ["https://countdown.gamejamkbh.dk", true],
        ["http://localhost:3000", false],
        ["http://countdown.gamejamkbh.dk", false],
        ["", false],
    ])("%p is https: %p", (url, expected) => {
        expect(isHttps(url)).toBe(expected);
    });

    test("a malformed cookie no longer throws", () => {
        expect(() => parseCookies("a=%")).not.toThrow();
        expect(parseCookies("a=%; b=ok")).toEqual({ a: "%", b: "ok" });
    });

    test("cookies are decoded as before", () => {
        expect(parseCookies("a=hello%20world; b=2")).toEqual({ a: "hello world", b: "2" });
    });
});
