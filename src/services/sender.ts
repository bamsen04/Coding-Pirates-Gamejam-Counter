import type { Request } from "express";
import { isAdmin, parseCookies } from "../auth";
import { claimIpCooldown, ipCooldownRemaining } from "./cooldown";
import { claimHoldCooldown, findHoldByToken, type Hold, type HoldKind, holdCooldownRemaining } from "./holds";

export const HOLD_COOKIE = "hold_token";

// Who is sending a message, which decides the label on it and what limit applies.
export type Sender =
    | { kind: "admin"; label: "Admin" }
    | { kind: HoldKind; label: string; hold: Hold }
    | { kind: "none"; label: "Ingen hold" };

// An admin session wins, then a hold login (the cookie set by /hold/login); otherwise no hold.
export async function resolveSender(req: Request): Promise<Sender> {
    if (isAdmin(req)) return { kind: "admin", label: "Admin" };

    const hold = await findHoldByToken(parseCookies(req.headers.cookie)[HOLD_COOKIE]);
    if (hold) return { kind: hold.kind, label: hold.label, hold };

    return { kind: "none", label: "Ingen hold" };
}

// A banned hold can't send. (Someone who logs out can still send as "Ingen hold", with that limit.)
export function isBanned(sender: Sender): boolean {
    return sender.kind !== "admin" && sender.kind !== "none" && sender.hold.banned;
}

const ipOf = (req: Request) => req.ip ?? "unknown";

// Milliseconds until the sender may send again (0: now).
export function senderCooldownRemaining(sender: Sender, req: Request): number {
    switch (sender.kind) {
        case "admin":
            return 0;
        case "none":
            return ipCooldownRemaining(ipOf(req));
        default:
            return holdCooldownRemaining(sender.hold);
    }
}

// Starts the sender's cooldown as they send. False if they are still cooling down.
export async function claimCooldown(sender: Sender, req: Request): Promise<boolean> {
    switch (sender.kind) {
        case "admin":
            return true;
        case "none":
            return claimIpCooldown(ipOf(req));
        default:
            return claimHoldCooldown(sender.hold);
    }
}
