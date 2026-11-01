import { config } from "@/config";
import { defineRoute } from "@/router";
import { listHolds } from "@/services/holds";
import { holdsPdf } from "@/services/holds-pdf";

// Every hold, two pages each, ready to print.
export default defineRoute({ admin: true }, async (req, res) => {
    const pdf = holdsPdf(await listHolds(), { url: config.origin, host: config.host });

    res.type("application/pdf");
    res.set("Content-Disposition", 'attachment; filename="hold-koder.pdf"');
    res.send(pdf);
});
