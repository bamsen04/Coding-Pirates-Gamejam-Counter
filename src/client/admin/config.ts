import { byId } from "../dom";
import { getJson, postJson } from "../http";

interface AdminConfig {
    ttlMinutes: number;
    targetDate: number; // epoch ms
    showDays: boolean;
    maxValue: number;
    maxUnit: string;
}

const form = byId<HTMLFormElement>("config-form");
const status = byId("config-status");
const ttlInput = byId<HTMLInputElement>("ttl-input");
const targetInput = byId<HTMLInputElement>("target-input");
const showDaysInput = byId<HTMLInputElement>("show-days-input");
const maxValueInput = byId<HTMLInputElement>("max-value-input");
const maxUnitInput = byId<HTMLSelectElement>("max-unit-input");

// The server stores the target as epoch ms; <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
function toLocalInput(ms: number): string {
    const d = new Date(ms);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

async function loadConfig() {
    try {
        const config = await getJson<AdminConfig>("/admin/api/config");
        ttlInput.value = String(config.ttlMinutes);
        targetInput.value = toLocalInput(config.targetDate);
        showDaysInput.checked = config.showDays;
        maxValueInput.value = String(config.maxValue);
        maxUnitInput.value = config.maxUnit;
    } catch (err) {
        console.error("failed to load config", err);
    }
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";

    const config: AdminConfig = {
        ttlMinutes: Number(ttlInput.value),
        targetDate: new Date(targetInput.value).getTime(),
        showDays: showDaysInput.checked,
        maxValue: Number(maxValueInput.value),
        maxUnit: maxUnitInput.value,
    };

    try {
        const res = await postJson("/admin/api/config", config);
        if (!res.ok) throw new Error("request failed");
        status.textContent = "Gemt.";
        status.className = "text-good";
    } catch {
        status.textContent = "Kunne ikke gemme.";
        status.className = "text-accent";
    }
});

export function initConfig() {
    loadConfig();
}
