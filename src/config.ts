function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable ${name}`);
    return value;
}

const disableTurnstile = process.env.DISABLE_TURNSTILE === "true";

export const config = {
    mysql: {
        host: required("MYSQL_HOST"),
        user: required("MYSQL_USER"),
        password: required("MYSQL_PASSWORD"),
        database: required("MYSQL_DATABASE"),
    },
    turnstile: {
        disabled: disableTurnstile,
        // Not needed when Turnstile is disabled.
        secret: disableTurnstile ? undefined : required("TURNSTILE_SECRET_KEY"),
    },
    // Passkeys are bound to these. In production set them to your real domain / origin.
    rpId: process.env.RP_ID ?? "localhost",
    rpName: "CP Gamejam",
    origin: process.env.ORIGIN ?? "http://localhost:3000",
};
