import { mock } from "bun:test";

// Import this before any src module: config.ts reads these when it is first loaded.
process.env.MYSQL_HOST = "test";
process.env.MYSQL_USER = "test";
process.env.MYSQL_PASSWORD = "test";
process.env.MYSQL_DATABASE = "test";
process.env.DISABLE_TURNSTILE = "true";
process.env.ORIGIN = "https://countdown.example.dk";

/**
 * Stand-in for services/db: records every query (SQL with ? for each value, then the values) and
 * answers with `rows`, or with whatever `handler` returns when a test sets one.
 */
export const mockDb = {
    calls: [] as unknown[][],
    rows: [] as unknown[],
    handler: null as null | ((sql: string, values: unknown[]) => unknown),
    reset() {
        this.calls = [];
        this.rows = [];
        this.handler = null;
    },
    /** The recorded queries whose SQL starts with `prefix`. */
    queries(prefix: string) {
        return this.calls.filter((call) => String(call[0]).startsWith(prefix));
    },
};

mock.module("../src/services/db", () => ({
    default: (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join("?").replace(/\s+/g, " ").trim();
        mockDb.calls.push([sql, ...values]);
        return Promise.resolve(mockDb.handler ? mockDb.handler(sql, values) : mockDb.rows);
    },
}));

// What an UPDATE or DELETE answers with: no rows, but a count of the ones it changed.
export const affected = (count: number) => Object.assign([], { affectedRows: count });

export function mockReq(overrides: Record<string, unknown> = {}) {
    return { body: {}, params: {}, headers: {}, ip: "10.0.0.1", ...overrides };
}

export function mockRes() {
    const res = {
        statusCode: 200,
        body: undefined as unknown,
        cookies: [] as { name: string; value: string; options: unknown }[],
        clearedCookies: [] as string[],
        headers: {} as Record<string, string>,
        status(code: number) {
            res.statusCode = code;
            return res;
        },
        json(body: unknown) {
            res.body = body;
            return res;
        },
        send(body: unknown) {
            res.body = body;
            return res;
        },
        type(contentType: string) {
            res.headers["Content-Type"] = contentType;
            return res;
        },
        set(name: string, value: string) {
            res.headers[name] = value;
            return res;
        },
        cookie(name: string, value: string, options: unknown) {
            res.cookies.push({ name, value, options });
            return res;
        },
        clearCookie(name: string) {
            res.clearedCookies.push(name);
            return res;
        },
    };
    return res;
}

// Runs a route handler the way the router would, and returns what it responded with.
export async function callRoute(route: { handler: Function }, req: Record<string, unknown>) {
    const res = mockRes();
    await route.handler(mockReq(req), res);
    return res;
}
