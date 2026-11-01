import type { Hold } from "./holds";
import { A4, buildPdf, fitSize, matrixRects, type PdfPage } from "./pdf";
import { qrMatrix } from "./qr";

const MARGIN = 50;
const FIT_WIDTH = A4.width - MARGIN * 2;

// The QR code on the front: its width in points, and where its bottom edge is. There's room around
// it for the white margin a scanner needs.
export const QR_SIZE = 230;
export const QR_BOTTOM = 300;

function line(text: string, maxSize: number, y: number) {
    return { text, size: fitSize(text, maxSize, FIT_WIDTH), y };
}

export interface Site {
    /** The full address the QR code opens, e.g. "https://countdown.gamejamkbh.dk". */
    url: string;
    /** The same as people would type it, printed on the front, e.g. "countdown.gamejamkbh.dk". */
    host: string;
}

/**
 * Two A4 pages for each hold, to be printed two to a sheet, one on each side.
 *   Front: which hold you are, a QR code for the site, and its address.
 *   Back:  the hold's code, and nothing else.
 */
export function holdsPdf(holds: Hold[], site: Site): Buffer {
    // The same for every hold, so make it once.
    const qr = matrixRects(qrMatrix(site.url), (A4.width - QR_SIZE) / 2, QR_BOTTOM, QR_SIZE);

    const pages: PdfPage[] = holds.flatMap((hold) => [
        {
            rects: qr,
            lines: [
                line("DU ER", 40, 730),
                line(hold.label.toUpperCase(), 100, 640),
                line("Scan for at åbne siden", 18, 240),
                line("eller gå ind på", 16, 170),
                line(site.host, 36, 125),
            ],
        },
        {
            lines: [line("DIN KODE", 48, 560), line(hold.token, 120, 440)],
        },
    ]);

    return buildPdf(pages);
}
