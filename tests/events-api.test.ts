import { beforeEach, describe, expect, test } from "bun:test";
import { callRoute, mockDb } from "./helpers";

const { default: addEventRoute } = await import("../src/api/admin/api/events.post");

beforeEach(() => mockDb.reset());

async function post(body: Record<string, unknown>) {
    return callRoute(addEventRoute, { body });
}

describe("POST /admin/api/events: point actions", () => {
    test("accepts confetti at a moment", async () => {
        const res = await post({ action: "confetti", at: 600 });
        expect(res.statusCode).toBe(200);
        expect(mockDb.calls).toHaveLength(1);
        expect(mockDb.calls[0]!.slice(1)).toEqual(["confetti", 600, null]);
    });

    test("accepts zero", async () => {
        expect((await post({ action: "fanfare", at: 0 })).statusCode).toBe(200);
    });

    test("needs a moment", async () => {
        const res = await post({ action: "confetti" });
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ status: "invalid_time" });
        expect(mockDb.calls).toHaveLength(0);
    });

    test("cannot have a range", async () => {
        const res = await post({ action: "fanfare", at: 10, until: 5 });
        expect(res.statusCode).toBe(400);
        expect(mockDb.calls).toHaveLength(0);
    });
});

describe("POST /admin/api/events: range actions", () => {
    test("accepts a range", async () => {
        const res = await post({ action: "beep", at: 10, until: 1 });
        expect(res.statusCode).toBe(200);
        expect(mockDb.calls[0]!.slice(1)).toEqual(["beep", 10, 1]);
    });

    test("accepts a range with no start", async () => {
        const res = await post({ action: "tick", until: 1 });
        expect(res.statusCode).toBe(200);
        expect(mockDb.calls[0]!.slice(1)).toEqual(["tick", null, 1]);
    });

    test("needs an end", async () => {
        const res = await post({ action: "tick", at: 10 });
        expect(res.statusCode).toBe(400);
        expect(mockDb.calls).toHaveLength(0);
    });

    test("start has to be before end on the clock (the larger number)", async () => {
        const res = await post({ action: "tick", at: 3, until: 10 });
        expect(res.statusCode).toBe(400);
        expect(mockDb.calls).toHaveLength(0);
    });
});

describe("POST /admin/api/events: dark mode", () => {
    test("is a range: accepts a start and an end", async () => {
        const res = await post({ action: "dark", at: 72000, until: 28800 });
        expect(res.statusCode).toBe(200);
        expect(mockDb.calls[0]!.slice(1)).toEqual(["dark", 72000, 28800]);
    });

    test("accepts an end only, meaning from the start", async () => {
        expect((await post({ action: "dark", until: 28800 })).statusCode).toBe(200);
    });

    test("needs an end", async () => {
        const res = await post({ action: "dark", at: 72000 });
        expect(res.statusCode).toBe(400);
        expect(mockDb.calls).toHaveLength(0);
    });
});

describe("POST /admin/api/events: bad input", () => {
    test("rejects an unknown action", async () => {
        const res = await post({ action: "explode", at: 10 });
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ status: "invalid_action" });
    });

    test.each([
        ["negative", -1],
        ["fractional", 1.5],
        ["a string", "10"],
        ["not a number", NaN],
    ])("rejects a time that is %s", async (_, at) => {
        const res = await post({ action: "confetti", at });
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ status: "invalid_time" });
        expect(mockDb.calls).toHaveLength(0);
    });
});
