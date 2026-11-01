import { defineRoute } from "@/router";
import { approveMessage } from "@/services/messages";

export default defineRoute({ admin: true }, async (req, res) => {
    const found = await approveMessage(Number(req.params.id));
    res.status(found ? 200 : 404).json({ status: found ? "ok" : "not_found" });
});
