// The default wait between messages: 10 minutes per hold, and 10 minutes per IP for people without a
// hold. A hold can be given its own (see services/holds.ts).
export const COOLDOWN_MS = 10 * 60 * 1000;

// Milliseconds left of a cooldown that started at `lastSentAt` (null: never sent).
export function cooldownRemaining(lastSentAt: number | null, cooldownMs = COOLDOWN_MS, now = Date.now()): number {
    if (lastSentAt === null) return 0;
    return Math.max(lastSentAt + cooldownMs - now, 0);
}

// Messages without a hold: when each IP last sent one. In memory, so a restart clears it.
const ipLastSent = new Map<string, number>();

setInterval(() => {
    for (const [ip, lastSent] of ipLastSent) if (cooldownRemaining(lastSent) === 0) ipLastSent.delete(ip);
}, 60 * 1000).unref();

export function ipCooldownRemaining(ip: string, now = Date.now()): number {
    return cooldownRemaining(ipLastSent.get(ip) ?? null, COOLDOWN_MS, now);
}

// Starts the cooldown for an IP. False (and nothing changes) if it is still cooling down.
export function claimIpCooldown(ip: string, now = Date.now()): boolean {
    if (ipCooldownRemaining(ip, now) > 0) return false;
    ipLastSent.set(ip, now);
    return true;
}
