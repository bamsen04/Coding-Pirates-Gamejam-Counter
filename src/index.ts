import express from "express";
import nunjucks from "nunjucks";
import { join } from "path";
import { requireAdmin } from "./auth";
import { config } from "./config";
import { migrate } from "./migrate";
import { registerApiRoutes } from "./router";
import db from "./services/db";
import { listEvents } from "./services/events";
import { getMaxMs, getShowDays, getTargetDate } from "./services/settings";

const app = express();
app.set("trust proxy", config.trustProxy);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(import.meta.dir, "../public")));

nunjucks.configure(join(import.meta.dir, "../views"), { express: app, autoescape: true });

await migrate(db);

if (config.turnstile.disabled) console.warn("Turnstile is DISABLED, message spam protection is off");

// Pages
app.get("/", async (req, res) => {
    res.render("pages/index.njk", {
        targetDate: await getTargetDate(),
        showDays: await getShowDays(),
        maxMs: await getMaxMs(),
        events: await listEvents(),
        turnstile: { enabled: !config.turnstile.disabled, siteKey: config.turnstile.siteKey },
    });
});
app.get("/admin/login", (req, res) => res.render("pages/admin-login.njk"));
app.get("/admin/enroll", (req, res) => res.render("pages/admin-enroll.njk"));
app.get("/admin", requireAdmin, (req, res) => res.render("pages/admin.njk"));

// API: one file per route in src/api (see router.ts)
await registerApiRoutes(app, join(import.meta.dir, "api"));

app.listen(3000, () => {
    console.log("running on http://localhost:3000/");
});
