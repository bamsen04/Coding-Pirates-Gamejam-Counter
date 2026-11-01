// Shapes of what the server sends. Kept in step with src/services by hand.

export interface Message {
    id: number;
    author: string;
    text: string;
    sentAt: number;
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
