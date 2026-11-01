import { byId } from "./dom";
import { resumeAudio } from "./sound";

// The page is blocked by a start screen until the visitor clicks it. That click unlocks audio,
// so the fanfare and the other sounds can play when their moment comes.
const blocker = byId("start-blocker");
const button = byId<HTMLButtonElement>("start-button");

button.addEventListener("click", async () => {
    await resumeAudio();
    blocker.remove();
});
button.focus();
