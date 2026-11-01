import { describe, expect, test } from "bun:test";
import { join } from "path";
import "./helpers";

const { compareUrls, defineRoute, registerApiRoutes, toUrlPath } = await import("../src/router");
const { loginRateLimit, requireAdmin } = await import("../src/auth");

describe("toUrlPath", () => {
    test("maps a file path to a URL", () => {
        expect(toUrlPath("messages")).toBe("/messages");
        expect(toUrlPath("admin/login/options")).toBe("/admin/login/options");
    });

    test("turns [param] folders and files into :param", () => {
        expect(toUrlPath("admin/api/messages/[id]/approve")).toBe("/admin/api/messages/:id/approve");
        expect(toUrlPath("admin/api/messages/[id]")).toBe("/admin/api/messages/:id");
    });

    test("treats index as its folder", () => {
        expect(toUrlPath("index")).toBe("/");
        expect(toUrlPath("admin/index")).toBe("/admin");
    });
});

describe("compareUrls", () => {
    test("puts static segments before :params", () => {
        const sorted = ["/a/:id", "/a/new", "/a/:id/edit"].sort(compareUrls);
        expect(sorted).toEqual(["/a/new", "/a/:id", "/a/:id/edit"]);
    });
});

describe("defineRoute", () => {
    const handler = () => {};

    test("accepts just a handler", () => {
        expect(defineRoute(handler)).toEqual({ options: {}, handler });
    });

    test("accepts options and a handler", () => {
        expect(defineRoute({ admin: true }, handler)).toEqual({ options: { admin: true }, handler });
    });
});

// Register the real src/api folder against a fake app that just records the calls.
const registered: { method: string; url: string; middleware: unknown[] }[] = [];
const fakeApp = new Proxy(
    {},
    {
        get: (_, method: string) => (url: string, ...fns: unknown[]) => {
            registered.push({ method: method.toUpperCase(), url, middleware: fns.slice(0, -1) });
        },
    },
);
await registerApiRoutes(fakeApp as never, join(import.meta.dir, "../src/api"));
const routes = registered.map((r) => `${r.method} ${r.url}`).sort();

describe("registerApiRoutes on src/api", () => {
    test("registers every route file with the right method and URL", () => {
        expect(routes).toEqual(
            [
                "GET /events",
                "GET /messages",
                "GET /settings",
                "POST /messages",
                "GET /admin/api/config",
                "POST /admin/api/config",
                "GET /admin/api/messages",
                "DELETE /admin/api/messages/:id",
                "POST /admin/api/messages/:id/approve",
                "POST /admin/api/messages/:id/reject",
                "POST /admin/api/events",
                "DELETE /admin/api/events/:id",
                "POST /admin/login/options",
                "POST /admin/login/verify",
                "POST /admin/enroll/options",
                "POST /admin/enroll/verify",
            ].sort(),
        );
    });

    test("every /admin/api route is behind the admin check", () => {
        const adminRoutes = registered.filter((r) => r.url.startsWith("/admin/api"));
        expect(adminRoutes.length).toBeGreaterThan(0);
        for (const route of adminRoutes) {
            expect(route.middleware).toEqual([requireAdmin]);
        }
    });

    test("login and enroll routes are rate limited", () => {
        const authRoutes = registered.filter((r) => /^\/admin\/(login|enroll)\//.test(r.url));
        expect(authRoutes.length).toBe(4);
        for (const route of authRoutes) {
            expect(route.middleware).toEqual([loginRateLimit]);
        }
    });

    test("public routes have no middleware", () => {
        for (const route of registered.filter((r) => !r.url.startsWith("/admin"))) {
            expect(route.middleware).toEqual([]);
        }
    });
});
