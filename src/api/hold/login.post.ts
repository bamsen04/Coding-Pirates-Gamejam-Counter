import { holdLoginRateLimit, setCookie } from "@/auth";
import { defineRoute } from "@/router";
import { findHoldByToken } from "@/services/holds";
import { HOLD_COOKIE } from "@/services/sender";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default defineRoute({ rateLimit: holdLoginRateLimit }, async (req, res) => {
    const hold = await findHoldByToken(req.body?.token);
    if (!hold) {
        res.status(401).json({ status: "unknown_hold" });
        return;
    }

    // The cookie holds the code itself. If the holds are generated again, it simply stops matching.
    setCookie(res, HOLD_COOKIE, hold.token, { sameSite: "lax", maxAge: WEEK_MS });
    res.json({ status: "ok", label: hold.label });
});
