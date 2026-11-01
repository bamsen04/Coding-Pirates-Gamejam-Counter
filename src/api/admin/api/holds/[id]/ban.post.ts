import { defineRoute } from "@/router";
import { getHold, setBanned } from "@/services/holds";

// Bans a hold so it can't send messages, or lifts the ban.
export default defineRoute({ admin: true }, async (req, res) => {
    const { banned } = req.body;
    if (typeof banned !== "boolean") {
        res.status(400).json({ status: "invalid_banned" });
        return;
    }

    const hold = await getHold(Number(req.params.id));
    if (!hold) {
        res.status(404).json({ status: "not_found" });
        return;
    }

    await setBanned(hold.id, banned);
    res.json({ status: "ok" });
});
