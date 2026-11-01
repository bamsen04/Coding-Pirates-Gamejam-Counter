// The clock's digits, drawn with big pixels: each digit is a grid of 3 x 5 squares, and the lit ones are
// filled in (see .bm in public/css/index.css). A small bitmap font instead of a real one.

// Row by row, top to bottom; "1" is a lit pixel.
export const BITMAP: Record<string, string> = {
    "0": "111101101101111",
    "1": "010110010010111",
    "2": "111001111100111",
    "3": "111001111001111",
    "4": "101101111001001",
    "5": "111100111001111",
    "6": "111100111101111",
    "7": "111001001001001",
    "8": "111101111101111",
    "9": "111101111001111",
};

// Under each pair of digits. With days switched off the clock is hours, minutes, seconds: the last three.
const LABELS = ["dage", "timer", "min", "sek"];

function digitHtml(char: string): string {
    const bits = BITMAP[char] ?? "0".repeat(15);
    return `<span class="bm">${[...bits].map((bit) => (bit === "1" ? '<s class="on"></s>' : "<s></s>")).join("")}</span>`;
}

const SEPARATOR = '<span class="bsep"><s></s><s></s></span>';

/** The markup for a clock reading like "04:12:33:09" or "100:05:09": a group of digits per part of the time. */
export function clockHtml(text: string): string {
    const groups = text.split(":");
    const labels = LABELS.slice(-groups.length);

    return groups
        .map((group, i) => `<span class="grp"><span class="bms">${[...group].map(digitHtml).join("")}</span><i>${labels[i]}</i></span>`)
        .join(SEPARATOR);
}
