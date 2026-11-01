const bubblesLeftEl = document.getElementById("bubbles-left");
const bubblesRightEl = document.getElementById("bubbles-right");
const bubbleColors = [
    "border-emerald-300 bg-emerald-50",
    "border-sky-300 bg-sky-50",
    "border-amber-300 bg-amber-50",
    "border-fuchsia-300 bg-fuchsia-50",
    "border-rose-300 bg-rose-50",
];

let lastMessages = [];
const PER_SIDE = 4;

function randomColor() {
    return bubbleColors[Math.floor(Math.random() * bubbleColors.length)];
}

function placeBubble(msg, side, i) {
    const div = document.createElement("div");
    div.className = `bubble w-full max-w-[340px] border-2 ${randomColor()} backdrop-blur px-4 py-3 text-slate-800`;
    div.style.animationDelay = `${(i % 5) * 0.7}s`;

    const author = document.createElement("div");
    author.className = "text-xs font-semibold text-slate-500 mb-1 truncate";
    author.textContent = msg.author;

    const text = document.createElement("div");
    text.className = "text-sm break-words";
    text.textContent = msg.text;

    div.appendChild(author);
    div.appendChild(text);
    (side === "left" ? bubblesLeftEl : bubblesRightEl).appendChild(div);
}

function layoutBubbles(messages) {
    bubblesLeftEl.innerHTML = "";
    bubblesRightEl.innerHTML = "";

    const newest = [...messages]
        .sort((a, b) => b.sentAt - a.sentAt)
        .slice(0, PER_SIDE * 2);

    newest.forEach((msg, i) => {
        const side = i % 2 === 0 ? "left" : "right";
        placeBubble(msg, side, i);
    });
}

const mobileBubblesEl = document.getElementById("bubbles-mobile");

function layoutMobileBubbles(messages) {
    mobileBubblesEl.innerHTML = "";

    const newest = [...messages]
        .sort((a, b) => b.sentAt - a.sentAt)
        .slice(0, PER_SIDE * 2);

    newest.forEach((msg) => {
        const div = document.createElement("div");
        div.className = `w-full border-2 ${randomColor()} px-4 py-3 text-slate-800`;

        const author = document.createElement("div");
        author.className = "text-xs font-semibold text-slate-500 mb-1 truncate";
        author.textContent = msg.author;

        const text = document.createElement("div");
        text.className = "text-sm break-words";
        text.textContent = msg.text;

        div.appendChild(author);
        div.appendChild(text);
        mobileBubblesEl.appendChild(div);
    });
}

async function fetchMessages() {
    try {
        const res = await fetch("/messages");
        const messages = await res.json();
        const ids = messages.map((m) => m.id).join(",");
        if (ids !== lastMessages.map((m) => m.id).join(",")) {
            lastMessages = messages;
            layoutBubbles(messages);
            layoutMobileBubbles(messages);
        }
    } catch (err) {
        console.error("failed to fetch messages", err);
    }
}

fetchMessages();
setInterval(fetchMessages, 60000);

const COOLDOWN_MS = 10 * 60 * 1000;
const STORAGE_KEY = "gamejam_last_sent";

const fab = document.getElementById("fab");
const modal = document.getElementById("message-modal");
const form = document.getElementById("message-form");
const authorInput = document.getElementById("message-author");
const textInput = document.getElementById("message-text");
const errorEl = document.getElementById("message-error");
const closeBtn = document.getElementById("message-close");

if (window.location.hash === "#nofab") {
    fab.style.display = "none";
}

function getRemainingCooldown() {
    const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
    const remaining = COOLDOWN_MS - (Date.now() - last);
    return remaining > 0 ? remaining : 0;
}

function formatCooldown(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

function updateFabState() {
    const remaining = getRemainingCooldown();
    if (remaining > 0) {
        fab.disabled = true;
        fab.textContent = formatCooldown(remaining);
        fab.classList.add("opacity-50", "cursor-not-allowed", "text-sm");
        fab.classList.remove("text-3xl");
    } else {
        fab.disabled = false;
        fab.textContent = "+";
        fab.classList.remove("opacity-50", "cursor-not-allowed", "text-sm");
        fab.classList.add("text-3xl");
    }
}

function openModal() {
    errorEl.textContent = "";
    form.reset();
    modal.classList.remove("hidden");
    authorInput.focus();
}

function closeModal() {
    modal.classList.add("hidden");
}

fab.addEventListener("click", () => {
    if (fab.disabled) return;
    openModal();
});

closeBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (getRemainingCooldown() > 0) return;

    const author = authorInput.value.trim();
    const text = textInput.value.trim();
    if (!author || !text) return;

    const turnstileToken = form.querySelector('[name="cf-turnstile-response"]')?.value;

    try {
        const res = await fetch("/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ author, message: text, "cf-turnstile-response": turnstileToken }),
        });
        if (window.turnstile) window.turnstile.reset();
        if (!res.ok) throw new Error("request failed");

        localStorage.setItem(STORAGE_KEY, String(Date.now()));
        closeModal();
        updateFabState();
    } catch (err) {
        errorEl.textContent = "Noget gik galt. Prøv igen.";
    }
});

updateFabState();
setInterval(updateFabState, 1000);
