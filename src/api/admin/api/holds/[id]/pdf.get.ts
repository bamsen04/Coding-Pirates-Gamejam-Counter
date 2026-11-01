import { config } from "@/config";
import { defineRoute } from "@/router";
import { getHold } from "@/services/holds";
import { holdsPdf } from "@/services/holds-pdf";

// The two pages for one hold, e.g. to reprint after giving it a new code.
export default defineRoute({ admin: true }, async (req, res) => {
    const hold = await getHold(Number(req.params.id));
    if (!hold) {
        res.status(404).json({ status: "not_found" });
        return;
    }

    res.type("application/pdf");
    res.set("Content-Disposition", `attachment; filename="${hold.label.replace(/\s+/g, "-")}.pdf"`);
    res.send(holdsPdf([hold], { url: config.origin, host: config.host }));
});
