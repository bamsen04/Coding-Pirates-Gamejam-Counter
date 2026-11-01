import { byId } from "./dom";
import { getJson } from "./http";
import type { Message } from "./types";

// The approved messages, shown as bubbles: split over both sides of the clock on wide screens,
// in one column on phones.
const PER_SIDE = 4;
const COLORS = [
    "border-emerald-300 bg-emerald-50",
    "border-sky-300 bg-sky-50",
    "border-amber-300 bg-amber-50",
    "border-fuchsia-300 bg-fuchsia-50",
    "border-rose-300 bg-rose-50",
];

const leftEl = byId("bubbles-left");
const rightEl = byId("bubbles-right");
const mobileEl = byId("bubbles-mobile");

function randomColor(): string {
    return COLORS[Math.floor(Math.random() * COLORS.length)]!;
}

function bubble(message: Message, classes: string): HTMLElement {
    const el = document.createElement("div");
    el.className = `${classes} border-2 ${randomColor()} px-4 py-3 text-slate-800`;

    const author = document.createElement("div");
    author.className = "text-xs font-semibold text-slate-500 mb-1 truncate";
    author.textContent = `${message.author} (${message.label})`;

    const text = document.createElement("div");
    text.className = "text-sm break-words";
    text.textContent = message.text;

    el.append(author, text);
    return el;
}

function newest(messages: Message[]): Message[] {
    return [...messages].sort((a, b) => b.sentAt - a.sentAt).slice(0, PER_SIDE * 2);
}

function layout(messages: Message[]) {
    leftEl.replaceChildren();
    rightEl.replaceChildren();
    mobileEl.replaceChildren();

    newest(messages).forEach((message, i) => {
        const el = bubble(message, "bubble w-full max-w-[340px] backdrop-blur");
        el.style.animationDelay = `${(i % 5) * 0.7}s`;
        (i % 2 === 0 ? leftEl : rightEl).appendChild(el);

        mobileEl.appendChild(bubble(message, "w-full"));
    });
}

let lastIds = "";

async function fetchMessages() {
    try {
        const messages = await getJson<Message[]>("/messages");
        const ids = messages.map((m) => m.id).join(",");
        if (ids === lastIds) return;

        lastIds = ids;
        layout(messages);
    } catch (err) {
        console.error("failed to fetch messages", err);
    }
}

fetchMessages();
setInterval(fetchMessages, 60000);
