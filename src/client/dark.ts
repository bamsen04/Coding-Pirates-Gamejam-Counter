import { onState } from "./events";

// Dark mode is a timer event (action "dark"). The theme itself is the `dark` class on <html>,
// defined in src/styles/app.css; this turns it on and off as events start and stop.
const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

onState("dark", (active, first) => {
    const apply = () => root.classList.toggle("dark", active);

    // The first call is the starting state, so no fade. After that the browser crossfades the page.
    if (first || reduceMotion.matches || !document.startViewTransition) {
        apply();
    } else {
        document.startViewTransition(apply);
    }
});
