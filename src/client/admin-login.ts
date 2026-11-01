import { byId } from "./dom";
import { postJson } from "./http";

const button = byId("login-btn");
const errorEl = byId("login-error");

async function post(url: string, body?: unknown) {
    const res = await postJson(url, body);
    if (res.status === 429) throw new Error("For mange forsøg. Prøv igen senere.");
    if (!res.ok) throw new Error("Login mislykkedes.");
    return res.json();
}

button.addEventListener("click", async () => {
    errorEl.textContent = "";
    try {
        const optionsJSON = await post("/admin/login/options");
        const response = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON });
        await post("/admin/login/verify", response);
        window.location.href = "/admin";
    } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : "Login mislykkedes.";
    }
});
