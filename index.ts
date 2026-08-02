import express from "express";
import { join } from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const admin_password = process.env.ADMIN_PASSWORD;

interface Message {
    id: string;
    author: string;
    text: string;
    sentAt: number;
}

let messageTtlMs = 30 * 60 * 1000;

const approvedMessages: Message[] = [];
const messageQueue: Message[] = [];

const validSessions = new Set<string>();
const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function parseCookies(header: string | undefined): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!header) return cookies;
    for (const pair of header.split(";")) {
        const idx = pair.indexOf("=");
        if (idx === -1) continue;
        cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
    }
    return cookies;
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE];
    if (token && validSessions.has(token)) {
        next();
        return;
    }
    res.redirect("/admin/login");
}

app.get("/", (req, res) => {
    res.sendFile(join(import.meta.dir, "index.html"));
});

app.get("/admin/login", (req, res) => {
    res.sendFile(join(import.meta.dir, "admin-login.html"));
});

app.post("/admin/login", (req, res) => {
    const { password } = req.body;
    if (!admin_password || password !== admin_password) {
        res.redirect("/admin/login?error=1");
        return;
    }
    const token = crypto.randomUUID();
    validSessions.add(token);
    res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE_MS,
    });
    res.redirect("/admin");
});

app.get("/admin", requireAdmin, (req, res) => {
    res.sendFile(join(import.meta.dir, "admin.html"));
})

app.get("/messages", (req, res) => {
    const cutoff = Date.now() - messageTtlMs;
    while (approvedMessages.length > 0 && approvedMessages[0]!.sentAt < cutoff) {
        approvedMessages.shift();
    }
    res.json(approvedMessages);
});

app.post("/messages", (req, res) => {
    const { author, message } = req.body;
    messageQueue.push({ id: crypto.randomUUID(), author: author, text: message, sentAt: Date.now() });
    res.json({ status: "pending" });
});

app.get("/admin/api/messages", requireAdmin, (req, res) => {
    res.json({ pending: messageQueue, approved: approvedMessages });
});

app.post("/admin/api/messages/:id/approve", requireAdmin, (req, res) => {
    const index = messageQueue.findIndex((m) => m.id === req.params.id);
    if (index === -1) {
        res.status(404).json({ status: "not_found" });
        return;
    }
    const [message] = messageQueue.splice(index, 1);
    message!.sentAt = Date.now();
    approvedMessages.push(message!);
    res.json({ status: "ok" });
});

app.post("/admin/api/messages/:id/reject", requireAdmin, (req, res) => {
    const index = messageQueue.findIndex((m) => m.id === req.params.id);
    if (index === -1) {
        res.status(404).json({ status: "not_found" });
        return;
    }
    messageQueue.splice(index, 1);
    res.json({ status: "ok" });
});

app.delete("/admin/api/messages/:id", requireAdmin, (req, res) => {
    const index = approvedMessages.findIndex((m) => m.id === req.params.id);
    if (index === -1) {
        res.status(404).json({ status: "not_found" });
        return;
    }
    approvedMessages.splice(index, 1);
    res.json({ status: "ok" });
});

app.get("/admin/api/config", requireAdmin, (req, res) => {
    res.json({ ttlMinutes: messageTtlMs / 60000 });
});

app.post("/admin/api/config", requireAdmin, (req, res) => {
    const { ttlMinutes } = req.body;
    const minutes = Number(ttlMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
        res.status(400).json({ status: "invalid_ttl" });
        return;
    }
    messageTtlMs = minutes * 60000;
    res.json({ status: "ok", ttlMinutes: minutes });
});

app.listen(3000, () => {
    console.log("running on http://localhost:3000/");
});
