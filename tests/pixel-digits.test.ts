import { describe, expect, test } from "bun:test";
import { BITMAP, clockHtml } from "../src/client/pixel-digits";

const lit = (html: string) => (html.match(/<s class="on">/g) ?? []).length;
const groups = (html: string) => [...html.matchAll(/<span class="grp">/g)].length;
const labels = (html: string) => [...html.matchAll(/<i>([^<]*)<\/i>/g)].map((m) => m[1]);

describe("the digit bitmaps", () => {
    test("every digit is 3 x 5 pixels", () => {
        for (const digit of "0123456789") expect(BITMAP[digit]).toMatch(/^[01]{15}$/);
    });

    test("every digit looks different", () => {
        expect(new Set(Object.values(BITMAP)).size).toBe(10);
    });

    test("1 has fewer lit pixels than 8, and 8 has the most", () => {
        const count = (d: string) => [...BITMAP[d]!].filter((b) => b === "1").length;
        expect(count("8")).toBe(Math.max(...[..."0123456789"].map(count)));
        expect(count("1")).toBeLessThan(count("8"));
    });
});

describe("clockHtml", () => {
    test("makes a group for each part of the time, with the four labels", () => {
        const html = clockHtml("04:12:33:09");

        expect(groups(html)).toBe(4);
        expect(labels(html)).toEqual(["dage", "timer", "min", "sek"]);
    });

    test("without days it is hours, minutes and seconds", () => {
        const html = clockHtml("100:05:09");

        expect(groups(html)).toBe(3);
        expect(labels(html)).toEqual(["timer", "min", "sek"]);
    });

    test("draws every digit as 15 squares, lit where the bitmap says", () => {
        const html = clockHtml("08:00:00:00");
        const digitCells = (html.match(/<span class="bm">/g) ?? []).length;

        expect(digitCells).toBe(8);
        // 8 + seven 0s
        const expected = [..."08000000"].reduce((sum, d) => sum + [...BITMAP[d]!].filter((b) => b === "1").length, 0);
        expect(lit(html)).toBe(expected);
    });

    test("puts a colon of two squares between the groups", () => {
        expect((clockHtml("01:02:03:04").match(/class="bsep"/g) ?? []).length).toBe(3);
        expect((clockHtml("01:02:03").match(/class="bsep"/g) ?? []).length).toBe(2);
    });

    test("a digit it doesn't know is drawn blank, not broken", () => {
        expect(lit(clockHtml("xx:00:00:00")) > 0).toBe(true);
        expect(clockHtml("xx:00:00:00")).toContain('<span class="bm">');
    });

    test("three-digit hours get three digits", () => {
        const html = clockHtml("100:00:00");
        const firstGroup = html.split('<span class="bsep">')[0]!;

        expect((firstGroup.match(/<span class="bm">/g) ?? []).length).toBe(3);
    });
});
