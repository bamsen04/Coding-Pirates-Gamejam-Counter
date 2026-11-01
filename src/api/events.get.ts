import { defineRoute } from "@/router";
import { listEvents } from "@/services/events";

// Public: the front page reads this to know what to do as the timer runs.
export default defineRoute(async (req, res) => {
    res.json(await listEvents());
});
