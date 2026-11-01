import { defineRoute } from "@/router";
import { removeMessage } from "@/services/messages";

export default defineRoute({ admin: true }, async (req, res) => {
    const found = await removeMessage(Number(req.params.id));
    res.status(found ? 200 : 404).json({ status: found ? "ok" : "not_found" });
});
