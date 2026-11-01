const pendingListEl = document.getElementById("pending-list");
const approvedListEl = document.getElementById("approved-list");
const pendingCountEl = document.getElementById("pending-count");
const approvedCountEl = document.getElementById("approved-count");
const ttlInput = document.getElementById("ttl-input");
const configForm = document.getElementById("config-form");
const configStatus = document.getElementById("config-status");

let audioCtx = null;
let knownPendingIds = null;

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function unlockAudio() {
    try {
        const ctx = getAudioCtx();
        if (ctx.state === "suspended") ctx.resume();
    } catch (err) {
        console.error("audio unlock failed", err);
    }
}

function playBeep() {
    try {
        const ctx = getAudioCtx();
        if (ctx.state === "suspended") ctx.resume();
        [880, 1175].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = ctx.currentTime + i * 0.18;
            osc.type = "square";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.15, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.17);
        });
    } catch (err) {
        console.error("beep failed", err);
    }
}

document.addEventListener("click", unlockAudio, { once: true });
document.addEventListener("keydown", unlockAudio, { once: true });

function formatTime(ms) {
    return new Date(ms).toLocaleTimeString();
}

function renderMessage(msg, actions) {
    const div = document.createElement("div");
    div.className = "border-2 border-black p-3 flex items-start justify-between gap-4";

    const info = document.createElement("div");
    info.className = "min-w-0";

    const author = document.createElement("div");
    author.className = "text-xs font-semibold text-slate-500 mb-1 truncate";
    author.textContent = `${msg.author} · ${formatTime(msg.sentAt)}`;

    const text = document.createElement("div");
    text.className = "text-sm break-words";
    text.textContent = msg.text;

    info.appendChild(author);
    info.appendChild(text);

    const actionsEl = document.createElement("div");
    actionsEl.className = "flex gap-2 shrink-0";
    actionsEl.appendChild(actions(msg));

    div.appendChild(info);
    div.appendChild(actionsEl);
    return div;
}

function makeButton(label, className, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.className = `text-xs font-bold uppercase tracking-widest py-1 px-2 border-2 border-black transition-colors ${className}`;
    btn.addEventListener("click", onClick);
    return btn;
}

async function loadMessages() {
    try {
        const res = await fetch("/admin/api/messages");
        const { pending, approved } = await res.json();

        const currentIds = new Set(pending.map((m) => m.id));
        if (knownPendingIds !== null && pending.some((m) => !knownPendingIds.has(m.id))) {
            playBeep();
        }
        knownPendingIds = currentIds;

        pendingCountEl.textContent = `${pending.length}`;
        approvedCountEl.textContent = `${approved.length}`;

        pendingListEl.innerHTML = "";
        if (pending.length === 0) {
            pendingListEl.innerHTML = `<p class="text-sm text-slate-400">No pending messages.</p>`;
        } else {
            pending.forEach((msg) => {
                const row = renderMessage(msg, () => {
                    const container = document.createElement("div");
                    container.className = "flex gap-2";
                    container.appendChild(makeButton("Approve", "bg-emerald-500 text-white hover:bg-emerald-600", () => approveMessage(msg.id)));
                    container.appendChild(makeButton("Reject", "bg-red-500 text-white hover:bg-red-600", () => rejectMessage(msg.id)));
                    return container;
                });
                pendingListEl.appendChild(row);
            });
        }

        approvedListEl.innerHTML = "";
        if (approved.length === 0) {
            approvedListEl.innerHTML = `<p class="text-sm text-slate-400">No approved messages.</p>`;
        } else {
            approved.forEach((msg) => {
                const row = renderMessage(msg, () => makeButton("Remove", "bg-red-500 text-white hover:bg-red-600", () => removeMessage(msg.id)));
                approvedListEl.appendChild(row);
            });
        }
    } catch (err) {
        console.error("failed to load messages", err);
    }
}

async function approveMessage(id) {
    await fetch(`/admin/api/messages/${id}/approve`, { method: "POST" });
    loadMessages();
}

async function rejectMessage(id) {
    await fetch(`/admin/api/messages/${id}/reject`, { method: "POST" });
    loadMessages();
}

async function removeMessage(id) {
    await fetch(`/admin/api/messages/${id}`, { method: "DELETE" });
    loadMessages();
}

async function loadConfig() {
    try {
        const res = await fetch("/admin/api/config");
        const { ttlMinutes } = await res.json();
        ttlInput.value = ttlMinutes;
    } catch (err) {
        console.error("failed to load config", err);
    }
}

configForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    configStatus.textContent = "";
    try {
        const res = await fetch("/admin/api/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ttlMinutes: Number(ttlInput.value) }),
        });
        if (!res.ok) throw new Error("request failed");
        configStatus.textContent = "Saved.";
        configStatus.className = "text-sm text-emerald-600";
    } catch (err) {
        configStatus.textContent = "Failed to save.";
        configStatus.className = "text-sm text-red-500";
    }
});

loadConfig();
loadMessages();
setInterval(loadMessages, 60000);
