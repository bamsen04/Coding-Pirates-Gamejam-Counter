import db from "./db";

export interface Message {
    id: number;
    author: string;
    text: string;
    sentAt: number;
    /** Who it was sent as: "Hold 5", "frivillig", "Ingen hold" or "Admin". */
    label: string;
}

function toMessage(row: any): Message {
    return {
        id: Number(row.id),
        author: row.author,
        text: row.text,
        sentAt: Number(row.sent_at),
        label: row.label,
    };
}

export async function addMessage(author: string, text: string, label: string): Promise<void> {
    await db`INSERT INTO messages (author, text, label, sent_at, is_approved) VALUES (${author}, ${text}, ${label}, ${Date.now()}, FALSE)`;
}

export async function getPending(): Promise<Message[]> {
    const rows = await db`SELECT id, author, text, sent_at, label FROM messages WHERE is_approved = FALSE ORDER BY sent_at`;
    return rows.map(toMessage);
}

// Approved messages newer than the TTL cutoff.
export async function getApproved(ttlMs: number): Promise<Message[]> {
    const cutoff = Date.now() - ttlMs;
    const rows = await db`SELECT id, author, text, sent_at, label FROM messages WHERE is_approved = TRUE AND sent_at >= ${cutoff} ORDER BY sent_at`;
    return rows.map(toMessage);
}

// Each of these returns false when no matching row was found.
export async function approveMessage(id: number): Promise<boolean> {
    const result = await db`UPDATE messages SET is_approved = TRUE, sent_at = ${Date.now()} WHERE id = ${id} AND is_approved = FALSE`;
    return result.affectedRows > 0;
}

export async function rejectMessage(id: number): Promise<boolean> {
    const result = await db`DELETE FROM messages WHERE id = ${id} AND is_approved = FALSE`;
    return result.affectedRows > 0;
}

export async function removeMessage(id: number): Promise<boolean> {
    const result = await db`DELETE FROM messages WHERE id = ${id} AND is_approved = TRUE`;
    return result.affectedRows > 0;
}
