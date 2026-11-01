import db from "./db";

// Key/value settings the admin can change. A setting that isn't in the table yet uses its default.
const DEFAULTS = {
    message_ttl_minutes: "30",
    // Epoch ms (UTC). 2027-11-01 13:00 Copenhagen time.
    target_date: String(Date.parse("2027-11-01T12:00:00Z")),
    // "true": DD:HH:MM:SS, "false": total hours as HH:MM:SS
    show_days: "true",
    // The clock never shows more than max_value max_unit remaining.
    max_value: "9999",
    max_unit: "days",
} as const;

export const MAX_UNITS = {
    days: 86400000,
    hours: 3600000,
    minutes: 60000,
    seconds: 1000,
} as const;

export type MaxUnit = keyof typeof MAX_UNITS;

export function isMaxUnit(value: unknown): value is MaxUnit {
    return typeof value === "string" && Object.hasOwn(MAX_UNITS, value);
}

export type SettingName = keyof typeof DEFAULTS;

export async function getSetting(name: SettingName): Promise<string> {
    const rows = await db`SELECT value FROM settings WHERE name = ${name}`;
    return rows[0]?.value ?? DEFAULTS[name];
}

export async function setSetting(name: SettingName, value: string): Promise<void> {
    await db`INSERT INTO settings (name, value) VALUES (${name}, ${value}) AS new
        ON DUPLICATE KEY UPDATE value = new.value`;
}

async function getNumber(name: SettingName): Promise<number> {
    const value = Number(await getSetting(name));
    return Number.isFinite(value) ? value : Number(DEFAULTS[name]);
}

export async function getMessageTtlMs(): Promise<number> {
    return (await getNumber("message_ttl_minutes")) * 60000;
}

export async function getTargetDate(): Promise<number> {
    return getNumber("target_date");
}

export async function getShowDays(): Promise<boolean> {
    return (await getSetting("show_days")) === "true";
}

export async function getMax(): Promise<{ value: number; unit: MaxUnit }> {
    const unit = await getSetting("max_unit");
    return {
        value: await getNumber("max_value"),
        unit: isMaxUnit(unit) ? unit : (DEFAULTS.max_unit as MaxUnit),
    };
}

export async function getMaxMs(): Promise<number> {
    const { value, unit } = await getMax();
    return value * MAX_UNITS[unit];
}
