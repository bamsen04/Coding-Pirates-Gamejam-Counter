// Entry point for the admin page.
import { initConfig } from "./admin/config";
import { initEvents } from "./admin/events";
import { initHolds } from "./admin/holds";
import { initMessages } from "./admin/messages";
import { initTabs } from "./admin/tabs";

initTabs();
initMessages();
initHolds();
initEvents();
initConfig();
