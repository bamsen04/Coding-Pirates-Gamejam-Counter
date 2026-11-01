function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable ${name}`);
    return value;
}

const disableTurnstile = process.env.DISABLE_TURNSTILE === "true";
const origin = process.env.ORIGIN ?? "http://localhost:3000";

// "::ffff:203.0.113.7" (an IPv4 visitor on a dual-stack server) is the same address as "203.0.113.7".
export function normalizeIp(ip: string): string {
    return ip.trim().replace(/^::ffff:/i, "");
}

// Cookies get the Secure flag when the site is served over HTTPS. Browsers refuse to send them over plain
// http, which is why local development on http://localhost is left without it.
export function isHttps(url: string): boolean {
    return url.startsWith("https://");
}

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
    // Cookies are only sent over HTTPS when this is on.
    secureCookies: isHttps(origin),
    // Public IPs (e.g. the venue's) that get roomier login rate limits, counted per browser.
    // Comma-separated, in ALLOWED_IPS. Only meaningful when req.ip is the real address (see TRUST_PROXY).
    allowedIps: new Set((process.env.ALLOWED_IPS ?? "").split(",").map(normalizeIp).filter(Boolean)),
};
