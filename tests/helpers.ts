import { mock } from "bun:test";

// Import this before any src module: config.ts reads these when it is first loaded.
process.env.MYSQL_HOST = "test";
process.env.MYSQL_USER = "test";
process.env.MYSQL_PASSWORD = "test";
process.env.MYSQL_DATABASE = "test";
process.env.DISABLE_TURNSTILE = "true";

/**
 * Stand-in for services/db: records every query (SQL with ? for each value, then the values)
 * and answers with `rows`.
 */
export const mockDb = {
    calls: [] as unknown[][],
    rows: [] as unknown[],
    reset() {
        this.calls = [];
        this.rows = [];
    },
};

mock.module("../src/services/db", () => ({
    default: (strings: TemplateStringsArray, ...values: unknown[]) => {
        mockDb.calls.push([strings.join("?").replace(/\s+/g, " ").trim(), ...values]);
        return Promise.resolve(mockDb.rows);
    },
}));

export function mockRes() {
    const res = {
        statusCode: 200,
        body: undefined as unknown,
        status(code: number) {
            res.statusCode = code;
            return res;
        },
        json(body: unknown) {
            res.body = body;
            return res;
        },
    };
    return res;
}

// Runs a route handler the way the router would, and returns what it responded with.
export async function callRoute(route: { handler: Function }, req: Record<string, unknown>) {
    const res = mockRes();
    await route.handler(req, res);
    return res;
}
