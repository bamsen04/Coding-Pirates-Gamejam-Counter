import { defineRoute } from "@/router";
import { getHold, regenerateToken } from "@/services/holds";

// A new code for one hold. The old one stops working.
export default defineRoute({ admin: true }, async (req, res) => {
    const hold = await getHold(Number(req.params.id));
    if (!hold) {
        res.status(404).json({ status: "not_found" });
        return;
    }

    await regenerateToken(hold.id);
    res.json({ status: "ok" });
});
