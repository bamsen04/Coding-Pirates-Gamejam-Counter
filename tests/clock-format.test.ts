import { describe, expect, test } from "bun:test";
import { formatClock } from "../src/client/clock-format";

describe("with days", () => {
    test("formats DD:HH:MM:SS", () => {
        expect(formatClock(0, true)).toBe("00:00:00:00");
        expect(formatClock(59, true)).toBe("00:00:00:59");
        expect(formatClock(90061, true)).toBe("01:01:01:01");
    });

    test("rolls hours over into days", () => {
        expect(formatClock(86399, true)).toBe("00:23:59:59");
        expect(formatClock(86400, true)).toBe("01:00:00:00");
    });

    test("days can grow past two digits", () => {
        expect(formatClock(100 * 86400, true)).toBe("100:00:00:00");
    });
});

describe("without days", () => {
    test("formats total hours as HH:MM:SS", () => {
        expect(formatClock(0, false)).toBe("00:00:00");
        expect(formatClock(59, false)).toBe("00:00:59");
        expect(formatClock(3661, false)).toBe("01:01:01");
    });

    test("keeps counting hours past 24", () => {
        expect(formatClock(90061, false)).toBe("25:01:01");
        expect(formatClock(100 * 3600, false)).toBe("100:00:00");
    });
});
