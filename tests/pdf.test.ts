import { describe, expect, test } from "bun:test";
import "./helpers";

const { A4, buildPdf, fitSize, matrixRects } = await import("../src/services/pdf");
const { QR_BOTTOM, QR_SIZE, holdsPdf } = await import("../src/services/holds-pdf");
const { qrMatrix } = await import("../src/services/qr");

const site = { url: "https://countdown.example.dk", host: "countdown.example.dk" };

const hold = (number: number, token: string) => ({
    id: number,
    kind: "hold" as const,
    number,
    token,
    lastSentAt: null,
    label: `Hold ${number}`,
    cooldownMs: 600000,
    customCooldown: false,
    banned: false,
});

const text = (pdf: Buffer) => pdf.toString("latin1");

// Reads the cross-reference table and checks that each object really starts where it says.
function objectOffsetsAreCorrect(pdf: Buffer): boolean {
    const content = text(pdf);
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(content)![1]);
    if (!content.slice(startxref).startsWith("xref\n")) return false;

    const entries = [...content.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)];
    return entries.every((entry, i) => content.slice(Number(entry[1])).startsWith(`${i + 1} 0 obj\n`));
}

describe("buildPdf", () => {
    test("makes a PDF with one page per page given", () => {
        const pdf = buildPdf([{ lines: [{ text: "a", size: 20, y: 100 }] }, { lines: [{ text: "b", size: 20, y: 100 }] }]);
        const content = text(pdf);

        expect(content.startsWith("%PDF-1.4\n")).toBe(true);
        expect(content.endsWith("%%EOF\n")).toBe(true);
        expect(content).toContain("/Count 2");
        expect(content.match(/\/Type \/Page /g)).toHaveLength(2);
    });

    test("pages are A4", () => {
        expect(text(buildPdf([{ lines: [] }]))).toContain(`/MediaBox [0 0 ${A4.width} ${A4.height}]`);
    });

    test("its cross-reference table points at the objects", () => {
        const pdf = buildPdf([{ lines: [{ text: "hello", size: 30, y: 400 }] }, { lines: [] }, { lines: [] }]);

        expect(objectOffsetsAreCorrect(pdf)).toBe(true);
    });

    test("each page's length matches its content", () => {
        const content = text(buildPdf([{ lines: [{ text: "hello", size: 30, y: 400 }] }]));
        const [, length, body] = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(content)!;

        expect(Number(length)).toBe(body!.length);
    });

    test("centers text: Courier is 0.6 em per character", () => {
        const content = text(buildPdf([{ lines: [{ text: "ABCD", size: 100, y: 300 }] }]));
        const x = (A4.width - 4 * 0.6 * 100) / 2;

        expect(content).toContain(`BT /F1 100 Tf ${Math.round(x * 100) / 100} 300 Td (ABCD) Tj ET`);
    });

    test("escapes parentheses and backslashes so they can't end the string", () => {
        const content = text(buildPdf([{ lines: [{ text: "a(b)c\\d", size: 20, y: 100 }] }]));

        expect(content).toContain("(a\\(b\\)c\\\\d)");
    });

    test("writes æ, ø and å", () => {
        const pdf = buildPdf([{ lines: [{ text: "æøå ÆØÅ", size: 20, y: 100 }] }]);

        expect(text(pdf)).toContain("(æøå ÆØÅ)");
    });

    test("replaces characters it can't write instead of breaking", () => {
        const content = text(buildPdf([{ lines: [{ text: "a€b", size: 20, y: 100 }] }]));

        expect(content).toContain("(a?b)");
    });

    test("works with no pages at all", () => {
        expect(objectOffsetsAreCorrect(buildPdf([]))).toBe(true);
    });
});

describe("fitSize", () => {
    test("keeps the wanted size when the text fits", () => {
        expect(fitSize("ABC", 40, 500)).toBe(40);
    });

    test("shrinks the text to fit the width", () => {
        const size = fitSize("ABCDEFGHIJ", 120, 495);

        expect(size).toBeLessThan(120);
        expect(10 * 0.6 * size).toBeCloseTo(495);
    });

    test("copes with empty text", () => {
        expect(fitSize("", 40, 500)).toBe(40);
    });
});

describe("holdsPdf", () => {
    test("has two pages for each hold", () => {
        const pdf = holdsPdf([hold(1, "AAAA2222"), hold(2, "BBBB3333"), hold(3, "CCCC4444")], site);

        expect(text(pdf)).toContain("/Count 6");
    });

    test("the front says which hold you are, with the site's address; the back is only the code", () => {
        const content = text(holdsPdf([hold(7, "KJHG4567")], site));
        const [front, back] = [...content.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((m) => m[1]!);

        expect(front).toContain("(DU ER)");
        expect(front).toContain("(HOLD 7)");
        expect(front).toContain("(countdown.example.dk)");
        expect(front).not.toContain("KJHG4567");

        expect(back).toContain("(DIN KODE)");
        expect(back).toContain("(KJHG4567)");
        // nothing else on the back
        expect(back!.match(/ Tj ET/g)).toHaveLength(2);
        expect(back).not.toContain("HOLD 7");
        expect(back).not.toContain("countdown.example.dk");
    });

    test("labels frivillig", () => {
        const frivillig = { ...hold(0, "FRIV2345"), kind: "frivillig" as const, number: null, label: "frivillig" };
        const content = text(holdsPdf([frivillig], site));

        expect(content).toContain("(FRIVILLIG)");
        expect(content).toContain("(FRIV2345)");
    });

    test("fits a long label on the page", () => {
        const content = text(holdsPdf([{ ...hold(0, "FRIV2345"), label: "frivillig" }], site));
        const size = Number(/BT \/F1 ([\d.]+) Tf [\d.]+ [\d.]+ Td \(FRIVILLIG\)/.exec(content)![1]);

        expect(9 * 0.6 * size).toBeLessThanOrEqual(A4.width - 100 + 0.01);
    });

    test("is a valid PDF", () => {
        const pdf = holdsPdf([hold(1, "AAAA2222"), hold(2, "BBBB3333")], site);

        expect(objectOffsetsAreCorrect(pdf)).toBe(true);
    });

    test("with no holds is an empty PDF, not an error", () => {
        expect(text(holdsPdf([], site))).toContain("/Count 0");
    });
});

describe("qrMatrix", () => {
    const matrix = qrMatrix("https://countdown.example.dk");

    test("is a square grid of a valid QR size (21, 25, 29 ... modules)", () => {
        expect(matrix.length).toBeGreaterThanOrEqual(21);
        expect((matrix.length - 17) % 4).toBe(0);
        for (const row of matrix) expect(row).toHaveLength(matrix.length);
    });

    test("has the three finder squares in the corners, and none in the fourth", () => {
        const n = matrix.length;
        // 7x7: dark ring, light ring, dark 3x3 centre
        const finderAt = (top: number, left: number) => {
            for (let r = 0; r < 7; r++) {
                for (let c = 0; c < 7; c++) {
                    const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3)); // 0 centre ... 3 outside
                    const dark = ring === 3 || ring <= 1;
                    if (matrix[top + r]![left + c] !== dark) return false;
                }
            }
            return true;
        };

        expect(finderAt(0, 0)).toBe(true); // top left
        expect(finderAt(0, n - 7)).toBe(true); // top right
        expect(finderAt(n - 7, 0)).toBe(true); // bottom left
        expect(finderAt(n - 7, n - 7)).toBe(false); // bottom right has none
    });

    test("is different for a different address", () => {
        expect(qrMatrix("https://other.example.dk")).not.toEqual(matrix);
    });
});

describe("matrixRects", () => {
    const grid = [
        [true, true, false],
        [false, true, true],
        [true, false, true],
    ];

    test("makes one rectangle for each run of dark modules in a row", () => {
        const rects = matrixRects(grid, 0, 0, 30); // 10pt modules

        expect(rects).toEqual([
            { x: 0, y: 20, width: 20, height: 10 }, // top row: two modules
            { x: 10, y: 10, width: 20, height: 10 }, // middle row: the last two
            { x: 0, y: 0, width: 10, height: 10 }, // bottom row: the first...
            { x: 20, y: 0, width: 10, height: 10 }, // ...and the last
        ]);
    });

    test("puts the grid where it is asked to be", () => {
        const [first] = matrixRects(grid, 100, 200, 30);

        expect(first).toEqual({ x: 100, y: 220, width: 20, height: 10 });
    });

    test("covers exactly the dark modules", () => {
        const matrix = qrMatrix("https://countdown.example.dk");
        const dark = matrix.flat().filter(Boolean).length;
        const rects = matrixRects(matrix, 0, 0, 190);
        const module = 190 / matrix.length;
        const area = rects.reduce((sum, r) => sum + r.width * r.height, 0);

        expect(area / (module * module)).toBeCloseTo(dark);
        expect(rects.length).toBeLessThan(dark); // runs are merged
    });

    test("nothing to draw for an empty grid", () => {
        expect(matrixRects([], 0, 0, 100)).toEqual([]);
    });
});

describe("the QR code on the hold PDF", () => {
    // the drawing commands of each page, in order: front, back, front, back ...
    const pageContents = (pdf: Buffer) => [...text(pdf).matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((m) => m[1]!);
    const rectLines = (content: string) => content.split("\n").filter((l) => l.endsWith(" re f"));

    test("is on the front of every hold, and not on the back", () => {
        const pdf = holdsPdf([hold(1, "AAAA2222"), hold(2, "BBBB3333")], site);
        const [front1, back1, front2, back2] = pageContents(pdf);

        expect(rectLines(back1!)).toHaveLength(0);
        expect(rectLines(back2!)).toHaveLength(0);
        expect(rectLines(front1!).length).toBeGreaterThan(50);
        expect(rectLines(front2!)).toEqual(rectLines(front1!)); // the same site, so the same code
    });

    test("is the site's QR code", () => {
        const [front] = pageContents(holdsPdf([hold(1, "AAAA2222")], site));
        const expected = matrixRects(qrMatrix(site.url), (A4.width - QR_SIZE) / 2, QR_BOTTOM, QR_SIZE);

        expect(rectLines(front!)).toHaveLength(expected.length);
    });

    test("is centered, and keeps clear of the text above and below it", () => {
        const [front] = pageContents(holdsPdf([hold(1, "AAAA2222")], site));
        const rects = rectLines(front!).map((l) => l.split(" ").map(Number)); // x y width height
        const left = Math.min(...rects.map(([x]) => x!));
        const right = Math.max(...rects.map(([x, , w]) => x! + w!));
        const bottom = Math.min(...rects.map(([, y]) => y!));
        const top = Math.max(...rects.map(([, y, , h]) => y! + h!));

        expect(left + (right - left) / 2).toBeCloseTo(A4.width / 2, 0);
        expect(bottom).toBeGreaterThanOrEqual(QR_BOTTOM - 0.01);
        expect(top).toBeLessThanOrEqual(QR_BOTTOM + QR_SIZE + 0.2);
        // "HOLD N" is drawn at baseline 640 and the caption at 240, both outside the code and its margin
        expect(top + 30).toBeLessThan(640);
        expect(bottom - 30).toBeGreaterThan(240);
    });
});
