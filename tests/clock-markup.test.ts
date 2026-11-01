import { describe, expect, test } from "bun:test";
import { clockHtml } from "../src/client/clock-markup";

const groups = (html: string) => [...html.matchAll(/<b>([^<]*)<\/b>/g)].map((m) => m[1]);
const labels = (html: string) => [...html.matchAll(/<i>([^<]*)<\/i>/g)].map((m) => m[1]);
const colons = (html: string) => (html.match(/class="sep"/g) ?? []).length;

describe("clockHtml", () => {
    test("makes a group for each part of the time, with the four labels", () => {
        const html = clockHtml("04:12:33:09");

        expect(groups(html)).toEqual(["04", "12", "33", "09"]);
        expect(labels(html)).toEqual(["dage", "timer", "min", "sek"]);
    });

    test("without days it is hours, minutes and seconds", () => {
        const html = clockHtml("100:05:09");

        expect(groups(html)).toEqual(["100", "05", "09"]);
        expect(labels(html)).toEqual(["timer", "min", "sek"]);
    });

    test("puts a colon between the groups, and none at the ends", () => {
        expect(colons(clockHtml("01:02:03:04"))).toBe(3);
        expect(colons(clockHtml("01:02:03"))).toBe(2);
        expect(clockHtml("01:02:03").startsWith('<span class="grp">')).toBe(true);
        expect(clockHtml("01:02:03").endsWith("</span>")).toBe(true);
    });

    test("keeps three-digit hours whole", () => {
        expect(groups(clockHtml("100:00:00"))[0]).toBe("100");
    });

    test("is only digits and our own tags: nothing in it can be injected", () => {
        const html = clockHtml("04:12:33:09");

        expect(html.replace(/<[^>]*>/g, "")).toBe("04dage:12timer:33min:09sek");
    });
});
