import { defineRoute } from "@/router";
import { removeEvent } from "@/services/events";

export default defineRoute({ admin: true }, async (req, res) => {
    const found = await removeEvent(Number(req.params.id));
    res.status(found ? 200 : 404).json({ status: found ? "ok" : "not_found" });
});
