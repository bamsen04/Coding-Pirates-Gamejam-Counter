import express from "express";
import nunjucks from "nunjucks";
import { join } from "path";
import { requireAdmin } from "./auth";
import { config } from "./config";
import { migrate } from "./migrate";
import { registerApiRoutes } from "./router";
import db from "./services/db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(import.meta.dir, "../public")));

nunjucks.configure(join(import.meta.dir, "../views"), { express: app, autoescape: true });

await migrate(db);

if (config.turnstile.disabled) console.warn("Turnstile is DISABLED, message spam protection is off");

// Pages
app.get("/", (req, res) => {
    res.render("pages/index.njk", {
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
