// A small PDF writer, for pages of centered text. No library needed: the font is Courier-Bold, one of
// the 14 fonts every PDF reader has, and every character in it is exactly 0.6 em wide, so centering
// is just arithmetic.

export const A4 = { width: 595.28, height: 841.89 };

const CHAR_WIDTH = 0.6; // of the font size

export interface TextLine {
    text: string;
    size: number;
    /** Distance of the baseline from the bottom of the page, in points. */
    y: number;
}

// A filled black rectangle. Coordinates are in points from the bottom-left of the page.
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface PdfPage {
    lines: TextLine[];
    rects?: Rect[];
}

// The largest size (up to `maxSize`) at which `text` still fits in `maxWidth` points.
export function fitSize(text: string, maxSize: number, maxWidth: number): number {
    return Math.min(maxSize, maxWidth / (Math.max(text.length, 1) * CHAR_WIDTH));
}

// The text is written in WinAnsi (Latin-1 for these letters), so æ, ø and å work.
// Anything outside that becomes "?".
function encode(text: string): Buffer {
    const safe = [...text].map((char) => (char.charCodeAt(0) <= 255 ? char : "?")).join("");
    return Buffer.from(safe, "latin1");
}

function escapeText(text: Buffer): string {
    return text.toString("latin1").replace(/[\\()]/g, "\\$&");
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * The black squares of a QR code (or any grid of modules) as rectangles. `matrix[0]` is the top
 * row. The grid is `size` points wide and its bottom-left corner is at (`left`, `bottom`).
 * A run of dark modules in a row becomes one rectangle, which keeps the file small.
 */
export function matrixRects(matrix: boolean[][], left: number, bottom: number, size: number): Rect[] {
    const module = size / matrix.length;
    const rects: Rect[] = [];

    matrix.forEach((row, r) => {
        const y = bottom + size - (r + 1) * module;
        for (let c = 0; c < row.length; c++) {
            if (!row[c]) continue;
            const start = c;
            while (row[c + 1]) c++;
            rects.push({ x: left + start * module, y, width: (c - start + 1) * module, height: module });
        }
    });
    return rects;
}

// Rectangles are drawn a hair bigger than asked, so neighbours overlap and no light line shows
// between them in readers that anti-alias the edges.
const BLEED = 0.1;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function pageContent(page: PdfPage): Buffer {
    const rects = (page.rects ?? []).map(
        (r) => `${round3(r.x)} ${round3(r.y)} ${round3(r.width + BLEED)} ${round3(r.height + BLEED)} re f`,
    );
    const lines = page.lines.map((line) => {
        const text = encode(line.text);
        const x = (A4.width - text.length * CHAR_WIDTH * line.size) / 2;
        return `BT /F1 ${round(line.size)} Tf ${round(x)} ${round(line.y)} Td (${escapeText(text)}) Tj ET`;
    });
    return Buffer.from([...rects, ...lines].join("\n"), "latin1");
}

export function buildPdf(pages: PdfPage[]): Buffer {
    // Objects: 1 catalog, 2 page list, 3 font, then a page and its content for each page.
    const pageObject = (i: number) => 4 + i * 2;
    const contentObject = (i: number) => 5 + i * 2;

    const objects: Buffer[] = [
        Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
        Buffer.from(
            `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObject(i)} 0 R`).join(" ")}] /Count ${pages.length} >>`,
        ),
        Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>"),
    ];

    pages.forEach((page, i) => {
        objects.push(
            Buffer.from(
                `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] ` +
                    `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject(i)} 0 R >>`,
            ),
        );
        const content = pageContent(page);
        objects.push(
            Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from("\nendstream")]),
        );
    });

    const parts: Buffer[] = [Buffer.from("%PDF-1.4\n")];
    let offset = parts[0]!.length;
    const offsets: number[] = [];

    objects.forEach((body, i) => {
        offsets.push(offset);
        const object = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from("\nendobj\n")]);
        parts.push(object);
        offset += object.length;
    });

    const entries = ["0000000000 65535 f \n", ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)];
    parts.push(
        Buffer.from(
            `xref\n0 ${objects.length + 1}\n${entries.join("")}` +
                `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`,
        ),
    );

    return Buffer.concat(parts);
}
