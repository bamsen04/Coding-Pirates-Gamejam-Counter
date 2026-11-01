import { defineRoute } from "@/router";
import { createHolds } from "@/services/holds";

const MAX_HOLDS = 99;

// Generates the holds again: `count` of them plus frivillig, all with new codes. Replaces what exists.
export default defineRoute({ admin: true }, async (req, res) => {
    const { count } = req.body;
    if (!Number.isInteger(count) || count < 1 || count > MAX_HOLDS) {
        res.status(400).json({ status: "invalid_count" });
        return;
    }

    await createHolds(count);
    res.json({ status: "ok" });
});
