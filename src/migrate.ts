import type { SQL } from "bun";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

export async function migrate(db: SQL) {
    await db`CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;

    const done = new Set((await db`SELECT name FROM schema_migrations`).map((r: any) => r.name));
    const dir = join(import.meta.dir, "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
        if (done.has(file)) continue;

        for (const stmt of readFileSync(join(dir, file), "utf8").split(";").map((s) => s.trim()).filter(Boolean)) {
            await db.unsafe(stmt);
        }

        await db`INSERT INTO schema_migrations (name) VALUES (${file})`;
        console.log(`applied ${file}`);
    }
}