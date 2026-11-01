import { byId } from "../dom";
import { getJson, postJson } from "../http";
import type { AdminHold } from "../types";
import { emptyNote, GREEN_BUTTON, makeButton, makeLink, PLAIN_BUTTON, RED_BUTTON } from "./ui";

const list = byId("holds-list");
const form = byId<HTMLFormElement>("holds-form");
const countInput = byId<HTMLInputElement>("holds-count");
const status = byId("holds-status");

let holds: AdminHold[] = [];

// Runs an action on one hold and then redraws the list.
async function act(url: string, body?: unknown) {
    const res = await postJson(url, body);
    if (!res.ok) status.textContent = "Det lykkedes ikke.";
    await loadHolds();
}

function cooldownField(hold: AdminHold): HTMLElement {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "1440";
    input.step = "any";
    input.value = String(hold.cooldownMinutes);
    input.setAttribute("aria-label", `Ventetid for ${hold.label}, i minutter`);
    input.className = "border-2 border-black px-2 py-1 w-20 text-sm";

    const label = document.createElement("label");
    label.className = "flex items-center gap-1 text-xs";
    label.append("Ventetid", input, "min");

    const wrapper = document.createElement("div");
    wrapper.className = "flex items-center gap-2";
    wrapper.append(
        label,
        makeButton("Sæt", PLAIN_BUTTON, () => act(`/admin/api/holds/${hold.id}/cooldown`, { minutes: Number(input.value) })),
    );
    if (hold.customCooldown) {
        wrapper.append(makeButton("Standard", PLAIN_BUTTON, () => act(`/admin/api/holds/${hold.id}/cooldown`, { minutes: null })));
    } else {
        const note = document.createElement("span");
        note.className = "text-xs text-slate-400";
        note.textContent = "(standard)";
        wrapper.append(note);
    }
    return wrapper;
}

function row(hold: AdminHold): HTMLElement {
    const name = document.createElement("span");
    name.className = "font-bold w-24";
    name.textContent = hold.label;

    const token = document.createElement("span");
    token.className = "font-mono text-lg tracking-widest";
    token.textContent = hold.token;

    const el = document.createElement("div");
    el.className = "border-2 border-black p-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm";
    el.append(name, token);

    if (hold.banned) {
        const badge = document.createElement("span");
        badge.className = "text-xs font-bold uppercase bg-red-500 text-white px-2 py-1";
        badge.textContent = "Spærret";
        el.append(badge);
    }

    const actions = document.createElement("div");
    actions.className = "flex flex-wrap items-center gap-2 ml-auto";
    actions.append(
        cooldownField(hold),
        hold.banned
            ? makeButton("Åbn igen", GREEN_BUTTON, () => act(`/admin/api/holds/${hold.id}/ban`, { banned: false }))
            : makeButton("Spær", RED_BUTTON, () => {
                  if (confirm(`Spær ${hold.label}? De kan ikke sende beskeder, før du åbner igen.`)) {
                      act(`/admin/api/holds/${hold.id}/ban`, { banned: true });
                  }
              }),
        makeButton("Ny kode", PLAIN_BUTTON, () => {
            if (confirm(`Ny kode til ${hold.label}? Den gamle virker ikke længere.`)) {
                act(`/admin/api/holds/${hold.id}/token`);
            }
        }),
        makeLink("PDF", `/admin/api/holds/${hold.id}/pdf`, PLAIN_BUTTON),
    );
    el.append(actions);
    return el;
}

async function loadHolds() {
    try {
        holds = await getJson<AdminHold[]>("/admin/api/holds");
        list.replaceChildren(...(holds.length === 0 ? [emptyNote("Ingen hold endnu.")] : holds.map(row)));
    } catch (err) {
        console.error("failed to load holds", err);
    }
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";

    if (holds.length > 0 && !confirm("Det erstatter alle koder, ventetider og spærringer. Fortsæt?")) return;

    const res = await postJson("/admin/api/holds", { count: Number(countInput.value) });
    status.className = res.ok ? "text-sm text-emerald-600" : "text-sm text-red-500";
    status.textContent = res.ok ? "Lavet." : "Det lykkedes ikke.";
    await loadHolds();
});

export function initHolds() {
    loadHolds();
}
