import type { Express, Request, RequestHandler, Response } from "express";
import { Glob } from "bun";
import { join } from "path";
import { pathToFileURL } from "url";
import { loginRateLimit, requireAdmin } from "@/auth";

/**
 * File-based API routes. Every `<path>.<method>.ts` file under the api folder becomes a route:
 *
 *   api/messages.get.ts                      GET    /messages
 *   api/admin/api/messages/[id].delete.ts    DELETE /admin/api/messages/:id
 *
 * A file default-exports `defineRoute(...)`.
 */

type Handler = (req: Request, res: Response) => void | Promise<void>;

export interface RouteOptions {
    /** Require a logged-in admin session. */
    admin?: boolean;
    /** Apply the login/enroll rate limit. */
    rateLimit?: boolean;
}

interface Route {
    options: RouteOptions;
    handler: Handler;
}

export function defineRoute(handler: Handler): Route;
export function defineRoute(options: RouteOptions, handler: Handler): Route;
export function defineRoute(a: RouteOptions | Handler, b?: Handler): Route {
    return typeof a === "function" ? { options: {}, handler: a } : { options: a, handler: b! };
}

const FILE_PATTERN = /^(.*)\.(get|post|put|patch|delete)\.ts$/;

function toUrlPath(filePath: string): string {
    const url = "/" + filePath.replace(/\[(\w+)\]/g, ":$1").replace(/(^|\/)index$/, "");
    return url === "/" ? url : url.replace(/\/$/, "");
}

// Static segments before :params, so /a/new is registered ahead of /a/:id.
function compareUrls(a: string, b: string): number {
    const as = a.split("/");
    const bs = b.split("/");
    for (let i = 0; i < Math.min(as.length, bs.length); i++) {
        const aParam = as[i]!.startsWith(":");
        const bParam = bs[i]!.startsWith(":");
        if (aParam !== bParam) return aParam ? 1 : -1;
    }
    return a.localeCompare(b);
}

export async function registerApiRoutes(app: Express, dir: string) {
    const found: { method: string; url: string; file: string }[] = [];

    for await (const raw of new Glob("**/*.ts").scan(dir)) {
        const file = raw.replaceAll("\\", "/");
        const match = FILE_PATTERN.exec(file);
        if (!match) continue;
        found.push({ method: match[2]!, url: toUrlPath(match[1]!), file });
    }
    found.sort((a, b) => compareUrls(a.url, b.url));

    for (const { method, url, file } of found) {
        const mod = await import(pathToFileURL(join(dir, file)).href);
        const route = mod.default as Route | undefined;
        if (!route || typeof route.handler !== "function") {
            throw new Error(`${file} must default-export defineRoute(...)`);
        }

        const middleware: RequestHandler[] = [];
        if (route.options.rateLimit) middleware.push(loginRateLimit);
        if (route.options.admin) middleware.push(requireAdmin);

        // Express 5 forwards rejected promises from handlers to its error handler.
        app[method as "get"](url, ...middleware, route.handler);
    }

    console.log(`registered ${found.length} api routes`);
}
