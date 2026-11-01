import qrcode from "qrcode-generator";

/**
 * A QR code for `text` as rows of modules, `true` where a module is dark. Row 0 is the top. It has no
 * quiet zone (the white margin scanners need): whoever draws it leaves that room.
 */
export function qrMatrix(text: string): boolean[][] {
    const qr = qrcode(0, "M"); // 0: pick the smallest version that fits
    qr.addData(text);
    qr.make();

    const size = qr.getModuleCount();
    return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => qr.isDark(row, col)));
}
