import { beforeEach, describe, expect, test } from "bun:test";
import { callRoute, mockDb } from "./helpers";

const settings = await import("../src/services/settings");
const { default: configPost } = await import("../src/api/admin/api/config.post");

beforeEach(() => mockDb.reset());

describe("reading settings", () => {
    test("fall back to the defaults when nothing is stored", async () => {
        expect(await settings.getMessageTtlMs()).toBe(30 * 60000);
        expect(await settings.getShowDays()).toBe(true);
        expect(await settings.getTargetDate()).toBe(Date.parse("2027-11-01T12:00:00Z"));
    });

    test("use the stored value", async () => {
        mockDb.rows = [{ value: "15" }];
        expect(await settings.getMessageTtlMs()).toBe(15 * 60000);
    });

    test("fall back to the default when the stored value is garbage", async () => {
        mockDb.rows = [{ value: "soon" }];
        expect(await settings.getMessageTtlMs()).toBe(30 * 60000);
    });

    test("read booleans from the string", async () => {
        mockDb.rows = [{ value: "false" }];
        expect(await settings.getShowDays()).toBe(false);
    });

    test("read the stored maximum value", async () => {
        // The mocked table answers every lookup with the same row, so the unit also reads as "48" and falls back.
        mockDb.rows = [{ value: "48" }];
        const { value } = await settings.getMax();
        expect(value).toBe(48);
    });

    test("the default maximum is 9999 days", async () => {
        expect(await settings.getMax()).toEqual({ value: 9999, unit: "days" });
        expect(await settings.getMaxMs()).toBe(9999 * 86400000);
    });

    test("fall back to days when the stored unit is unknown", async () => {
        mockDb.rows = [{ value: "10" }];
        expect((await settings.getMax()).unit).toBe("days");
    });
});

describe("isMaxUnit", () => {
    test("accepts the four units only", () => {
        for (const unit of ["days", "hours", "minutes", "seconds"]) expect(settings.isMaxUnit(unit)).toBe(true);
        for (const bad of ["weeks", "", 5, null, undefined, "toString"]) expect(settings.isMaxUnit(bad)).toBe(false);
    });
});

describe("POST /admin/api/config", () => {
    const valid = {
        ttlMinutes: 45,
        targetDate: 1800000000000,
        showDays: false,
        maxValue: 48,
        maxUnit: "hours",
    };

    const post = (body: Record<string, unknown>) => callRoute(configPost, { body });

    test("stores every setting", async () => {
        const res = await post(valid);
        expect(res.statusCode).toBe(200);
        const written = mockDb.calls.map((c) => c.slice(1));
        expect(written).toEqual([
            ["message_ttl_minutes", "45"],
            ["target_date", "1800000000000"],
            ["show_days", "false"],
            ["max_value", "48"],
            ["max_unit", "hours"],
        ]);
    });

    test.each([
        ["ttl is zero", { ttlMinutes: 0 }, "invalid_ttl"],
        ["ttl is not a number", { ttlMinutes: "soon" }, "invalid_ttl"],
        ["target date is missing", { targetDate: undefined }, "invalid_target_date"],
        ["target date is not a number", { targetDate: "tomorrow" }, "invalid_target_date"],
        ["showDays is not a boolean", { showDays: "yes" }, "invalid_show_days"],
        ["maximum is zero", { maxValue: 0 }, "invalid_max"],
        ["maximum unit is unknown", { maxUnit: "weeks" }, "invalid_max"],
    ])("rejects it when %s", async (_, change, status) => {
        const res = await post({ ...valid, ...change });
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ status });
        expect(mockDb.calls).toHaveLength(0);
    });
});
