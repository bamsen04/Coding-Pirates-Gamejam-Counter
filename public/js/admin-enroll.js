const token = new URLSearchParams(window.location.search).get("token");
const statusEl = document.getElementById("status");
const btn = document.getElementById("register-btn");

async function post(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(res.status === 429 ? "Too many attempts. Try again later." : "Request failed (invalid or expired link?).");
    return res.json();
}

btn.addEventListener("click", async () => {
    statusEl.className = "text-sm text-red-500";
    statusEl.textContent = "";
    try {
        const optionsJSON = await post("/admin/enroll/options", { token });
        const response = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON });
        await post("/admin/enroll/verify", { token, response });
        statusEl.className = "text-sm text-green-600";
        statusEl.textContent = "Passkey registered. You can now log in.";
        btn.disabled = true;
    } catch (err) {
        statusEl.textContent = err.message || "Registration failed.";
    }
});
