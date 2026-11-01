import { byId } from "./dom";
import { getJson } from "./http";
import type { Message } from "./types";

// The approved messages, shown as dialogue boxes: split over both sides of the clock on wide screens,
// in one column on phones. See .msg in public/css/index.css.
const PER_SIDE = 4;

const leftEl = byId("bubbles-left");
const rightEl = byId("bubbles-right");
const mobileEl = byId("bubbles-mobile");

// The name and the hold sit on tabs on the box; the text goes inside.
function box(message: Message, index: number): HTMLElement {
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = message.author;

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = message.label;

    const text = document.createElement("p");
    text.textContent = message.text;

    const el = document.createElement("article");
    el.className = "msg";
    // Each box bobs on its own beat (negative: already under way when it appears).
    el.style.animationDelay = `${-(index % 5) * 0.9}s`;
    el.append(who, tag, text);
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
        (i % 2 === 0 ? leftEl : rightEl).appendChild(box(message, i));
        mobileEl.appendChild(box(message, i));
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
