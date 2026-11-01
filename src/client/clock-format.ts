function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

// "DD:HH:MM:SS" with days, or total hours as "HH:MM:SS" without. Days and hours grow past two
// digits if they need to.
export function formatClock(totalSeconds: number, showDays: boolean): string {
    const days = Math.floor(totalSeconds / 86400);
    const hours = showDays ? Math.floor((totalSeconds % 86400) / 3600) : Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = showDays ? [days, hours, minutes, seconds] : [hours, minutes, seconds];
    return parts.map(pad2).join(":");
}
