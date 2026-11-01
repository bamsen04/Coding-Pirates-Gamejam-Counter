const errorEl = document.getElementById("login-error");

async function post(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
    });
    if (res.status === 429) throw new Error("Too many attempts. Try again later.");
    if (!res.ok) throw new Error("Login failed.");
    return res.json();
}

document.getElementById("login-btn").addEventListener("click", async () => {
    errorEl.textContent = "";
    try {
        const optionsJSON = await post("/admin/login/options");
        const response = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON });
        await post("/admin/login/verify", response);
        window.location.href = "/admin";
    } catch (err) {
        errorEl.textContent = err.message || "Login failed.";
    }
});
