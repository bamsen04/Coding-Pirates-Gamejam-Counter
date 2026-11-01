import { describe, expect, test } from "bun:test";
import { isActive, shouldFire } from "../public/js/event-rules.js";

const point = (at: number) => ({ action: "confetti", at, until: null });
const range = (at: number | null, until: number) => ({ action: "tick", at, until });

describe("point events", () => {
    test("fire when the clock reaches the moment", () => {
        expect(shouldFire(point(600), 600, 601)).toBe(true);
    });

    test("do not fire before the moment", () => {
        expect(shouldFire(point(600), 601, 602)).toBe(false);
    });

    test("do not fire again after the moment", () => {
        expect(shouldFire(point(600), 599, 600)).toBe(false);
    });

    test("still fire if a tick was skipped over the moment", () => {
        // e.g. a background tab that throttled its timers
        expect(shouldFire(point(600), 597, 602)).toBe(true);
    });

    test("do not fire on the first tick, so loading the page late stays quiet", () => {
        expect(shouldFire(point(600), 600, null)).toBe(false);
        expect(shouldFire(point(600), 100, null)).toBe(false);
    });

    test("work at zero", () => {
        expect(shouldFire(point(0), 0, 1)).toBe(true);
        expect(shouldFire(point(0), 0, 0)).toBe(false);
        expect(shouldFire(point(0), 0, null)).toBe(false);
    });
});

describe("range events", () => {
    test("fire on every tick inside the range, bounds included", () => {
        const event = range(10, 3);
        expect(shouldFire(event, 10, 11)).toBe(true);
        expect(shouldFire(event, 6, 7)).toBe(true);
        expect(shouldFire(event, 3, 4)).toBe(true);
    });

    test("do not fire outside the range", () => {
        const event = range(10, 3);
        expect(shouldFire(event, 11, 12)).toBe(false);
        expect(shouldFire(event, 2, 3)).toBe(false);
        expect(shouldFire(event, 0, 1)).toBe(false);
    });

    test("fire on the first tick too, unlike point events", () => {
        expect(shouldFire(range(10, 3), 5, null)).toBe(true);
    });

    test("a range ending at 0 fires once at zero, then stops", () => {
        const event = range(10, 0);
        expect(shouldFire(event, 1, 2)).toBe(true);
        expect(shouldFire(event, 0, 1)).toBe(true);
        // the clock stays at 0 after it finishes
        expect(shouldFire(event, 0, 0)).toBe(false);
        expect(shouldFire(event, 0, 0)).toBe(false);
    });

    test("a range reaching 0 does not fire when the page loads after the end", () => {
        expect(shouldFire(range(60, 0), 0, null)).toBe(false);
        expect(shouldFire(range(null, 0), 0, null)).toBe(false);
    });

    test("with no start, fire from any time away until the end", () => {
        const event = range(null, 1);
        expect(shouldFire(event, 999999, 1000000)).toBe(true);
        expect(shouldFire(event, 1, 2)).toBe(true);
        expect(shouldFire(event, 0, 1)).toBe(false);
    });
});

describe("isActive (for states like dark mode)", () => {
    const dark = (at: number | null, until: number) => ({ action: "dark", at, until });

    test("is true while the clock is inside the range, bounds included", () => {
        expect(isActive(dark(3600, 600), 3600)).toBe(true);
        expect(isActive(dark(3600, 600), 1800)).toBe(true);
        expect(isActive(dark(3600, 600), 600)).toBe(true);
    });

    test("is false before and after the range", () => {
        expect(isActive(dark(3600, 600), 3601)).toBe(false);
        expect(isActive(dark(3600, 600), 599)).toBe(false);
    });

    test("with no start, is active from the beginning", () => {
        expect(isActive(dark(null, 600), 999999)).toBe(true);
        expect(isActive(dark(null, 600), 599)).toBe(false);
    });

    test("a range ending at 0 stays active once the clock has finished", () => {
        // unlike firing, a state should still hold after the end: dark stays dark
        expect(isActive(dark(3600, 0), 0)).toBe(true);
    });

    test("a point event is never active", () => {
        expect(isActive(point(0), 0)).toBe(false);
        expect(isActive(point(600), 600)).toBe(false);
    });
});
