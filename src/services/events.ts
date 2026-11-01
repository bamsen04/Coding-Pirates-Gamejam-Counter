import db from "./db";

// Actions that run over a range of the timer: the two sounds once per second, and dark mode for
// as long as the clock is in the range.
export const RANGE_ACTIONS = ["tick", "beep", "dark"] as const;
// Things that fire once when the timer reaches a value.
export const POINT_ACTIONS = ["fanfare", "confetti"] as const;

export type EventAction = (typeof RANGE_ACTIONS)[number] | (typeof POINT_ACTIONS)[number];

export function isRangeAction(value: unknown): value is (typeof RANGE_ACTIONS)[number] {
    return (RANGE_ACTIONS as readonly unknown[]).includes(value);
}

export function isPointAction(value: unknown): value is (typeof POINT_ACTIONS)[number] {
    return (POINT_ACTIONS as readonly unknown[]).includes(value);
}

// Times are seconds remaining on the timer. See migrations/003-events.sql.
export interface TimerEvent {
    id: number;
    action: EventAction;
    at: number | null;
    until: number | null;
}

function toEvent(row: any): TimerEvent {
    return {
        id: Number(row.id),
        action: row.action,
        at: row.at_seconds == null ? null : Number(row.at_seconds),
        until: row.until_seconds == null ? null : Number(row.until_seconds),
    };
}

export async function listEvents(): Promise<TimerEvent[]> {
    const rows = await db`SELECT id, action, at_seconds, until_seconds FROM events
        ORDER BY at_seconds IS NULL DESC, at_seconds DESC, id`;
    return rows.map(toEvent);
}

export async function addEvent(action: EventAction, at: number | null, until: number | null): Promise<void> {
    await db`INSERT INTO events (action, at_seconds, until_seconds) VALUES (${action}, ${at}, ${until})`;
}

export async function removeEvent(id: number): Promise<boolean> {
    const result = await db`DELETE FROM events WHERE id = ${id}`;
    return result.affectedRows > 0;
}
