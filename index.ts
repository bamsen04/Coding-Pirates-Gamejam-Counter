import express from "express";
import { join } from "path";

const app = express();
app.use(express.json());

interface Message {
    id: string;
    author: string;
    text: string;
    sentAt: number;
}

const MESSAGE_TTL_MS = 30 * 60 * 1000;

const approvedMessages: Message[] = [];
const messageQueue: Message[] = [];

app.get("/", (req, res) => {
    res.sendFile(join(import.meta.dir, "index.html"));
});

app.get("/messages", (req, res) => {
    const cutoff = Date.now() - MESSAGE_TTL_MS;
    while (approvedMessages.length > 0 && approvedMessages[0]!.sentAt < cutoff) {
        approvedMessages.shift();
    }
    res.json(approvedMessages);
});

app.post("/messages", (req, res) => {
    const { author, message } = req.body;
    approvedMessages.push({ id: crypto.randomUUID(), author: author, text: message, sentAt: Date.now() });
    res.json({ status: "ok" });
});

app.listen(3000, () => {
    console.log("running on http://localhost:3000/");
});