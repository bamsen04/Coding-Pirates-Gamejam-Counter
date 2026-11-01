function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable ${name}`);
    return value;
}

const disableTurnstile = process.env.DISABLE_TURNSTILE === "true";
const origin = process.env.ORIGIN ?? "http://localhost:3000";

// "countdown.gamejamkbh.dk" from "https://countdown.gamejamkbh.dk", for printing.
function hostOf(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}

export const config = {
    mysql: {
        host: required("MYSQL_HOST"),
        user: required("MYSQL_USER"),
        password: required("MYSQL_PASSWORD"),
        database: required("MYSQL_DATABASE"),
    },
    turnstile: {
        disabled: disableTurnstile,
        // Public widget key (not a secret), shown in the page.
        siteKey: process.env.TURNSTILE_SITE_KEY ?? "0x4AAAAAAFuH0h9YAh9IFnDd",
        // Not needed when Turnstile is disabled.
        secret: disableTurnstile ? undefined : required("TURNSTILE_SECRET_KEY"),
    },
    // Set when the app runs behind a reverse proxy (Caddy, nginx), so req.ip is the visitor's address
    // and not the proxy's. Matters for the per-IP limit on messages without a hold.
    trustProxy: process.env.TRUST_PROXY === "true",
    // Passkeys are bound to these. In production set them to your real domain / origin.
    rpId: process.env.RP_ID ?? "localhost",
    rpName: "CP Gamejam",
    origin,
    // The site's address as people would type it. Printed on the hold PDFs.
    host: hostOf(origin),
};
