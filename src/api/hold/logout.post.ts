import { defineRoute } from "@/router";
import { HOLD_COOKIE } from "@/services/sender";

export default defineRoute((req, res) => {
    res.clearCookie(HOLD_COOKIE);
    res.json({ status: "ok" });
});
