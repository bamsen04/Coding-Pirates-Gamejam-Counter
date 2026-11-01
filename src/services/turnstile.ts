import { config } from "@/config";

export async function verifyTurnstile(token: unknown, ip: string | undefined): Promise<boolean> {
    if (config.turnstile.disabled) return true;
    const secret = config.turnstile.secret;
    if (!secret || typeof token !== "string" || !token) return false;
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    try {
        const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            body,
        });
        const data = (await res.json()) as { success?: boolean };
        return data.success === true;
    } catch (err) {
        console.error("turnstile verification failed", err);
        return false;
    }
}
