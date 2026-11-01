import { resumeAudio } from "./sound.js";

// The page is blocked by a start screen until the visitor clicks it. That click unlocks
// audio, so the fanfare and the other sounds can play when their moment comes.
const blocker = document.getElementById("start-blocker");
const button = document.getElementById("start-button");

button.addEventListener("click", async () => {
    await resumeAudio();
    blocker.remove();
});
button.focus();
