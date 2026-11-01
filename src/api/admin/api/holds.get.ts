import { defineRoute } from "@/router";
import { listHolds } from "@/services/holds";

export default defineRoute({ admin: true }, async (req, res) => {
    const holds = await listHolds();
    res.json(
        holds.map((hold) => ({
            id: hold.id,
            kind: hold.kind,
            label: hold.label,
            token: hold.token,
            banned: hold.banned,
            cooldownMinutes: hold.cooldownMs / 60000,
            customCooldown: hold.customCooldown,
        })),
    );
});
