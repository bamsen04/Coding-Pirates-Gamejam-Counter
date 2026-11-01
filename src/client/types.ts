// Shapes of what the server sends. Kept in step with src/services by hand.

export interface Message {
    id: number;
    author: string;
    text: string;
    sentAt: number;
    /** Who it was sent as: "Hold 5", "frivillig", "Ingen hold" or "Admin". */
    label: string;
}

export type EventAction = "confetti" | "fanfare" | "tick" | "beep" | "dark";

// Times are seconds remaining on the clock; see event-rules.ts.
export interface TimerEvent {
    id: number;
    action: EventAction;
    at: number | null;
    until: number | null;
}

// GET /settings
export interface Settings {
    targetDate: number; // epoch ms
    showDays: boolean;
    maxMs: number;
}

// GET /me: who the visitor is sending as, and how long until they can send again.
export interface Me {
    kind: "admin" | "hold" | "frivillig" | "none";
    label: string;
    banned: boolean;
    cooldownMs: number;
}

// GET /admin/api/holds
export interface AdminHold {
    id: number;
    kind: "hold" | "frivillig";
    label: string;
    token: string;
    banned: boolean;
    cooldownMinutes: number;
    /** Whether a cooldown was set for this hold in particular, rather than the default. */
    customCooldown: boolean;
}
