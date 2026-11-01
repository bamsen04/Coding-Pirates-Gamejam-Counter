// The clock's markup: a group per part of the time (days, hours, minutes, seconds), each with its digits
// in the pixel font and a label under it, with a colon between the groups. Styled by .clock-display in
// public/css/index.css.

// Under each group. With days switched off the clock is hours, minutes, seconds: the last three.
const LABELS = ["dage", "timer", "min", "sek"];

const SEPARATOR = '<span class="sep">:</span>';

/** The markup for a clock reading like "04:12:33:09" or "100:05:09". */
export function clockHtml(text: string): string {
    const groups = text.split(":");
    const labels = LABELS.slice(-groups.length);

    return groups.map((group, i) => `<span class="grp"><b>${group}</b><i>${labels[i]}</i></span>`).join(SEPARATOR);
}
