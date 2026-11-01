import { byId } from "./dom";
import { postJson } from "./http";

const token = new URLSearchParams(window.location.search).get("token");
const button = byId<HTMLButtonElement>("register-btn");
const statusEl = byId("status");

async function post(url: string, body: unknown) {
    const res = await postJson(url, body);
    if (res.status === 429) throw new Error("For mange forsøg. Prøv igen senere.");
    if (!res.ok) throw new Error("Anmodningen mislykkedes (ugyldigt eller udløbet link?).");
    return res.json();
}

button.addEventListener("click", async () => {
    statusEl.className = "text-accent";
    statusEl.textContent = "";
    try {
        const optionsJSON = await post("/admin/enroll/options", { token });
        const response = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON });
        await post("/admin/enroll/verify", { token, response });
        statusEl.className = "text-good";
        statusEl.textContent = "Adgangsnøgle registreret. Du kan nu logge ind.";
        button.disabled = true;
    } catch (err) {
        statusEl.textContent = err instanceof Error ? err.message : "Registrering mislykkedes.";
    }
});
