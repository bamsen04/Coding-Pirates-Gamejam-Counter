// The admin page is split into tabs. Only one panel shows at a time, and the tab you're on is kept in
// the address (#holds), so a reload or a shared link opens the same one.
const ACTIVE = ["bg-accent", "text-onaccent"];
const INACTIVE = ["bg-field", "text-ink", "hover:brightness-95"];
const DEFAULT_TAB = "messages";

const tabs = document.querySelectorAll<HTMLButtonElement>("[data-tab]");
const panels = document.querySelectorAll<HTMLElement>("[data-panel]");

function show(name: string) {
    tabs.forEach((tab) => {
        const selected = tab.dataset.tab === name;
        tab.setAttribute("aria-selected", String(selected));
        tab.classList.remove(...(selected ? INACTIVE : ACTIVE));
        tab.classList.add(...(selected ? ACTIVE : INACTIVE));
    });
    panels.forEach((panel) => {
        panel.hidden = panel.dataset.panel !== name;
    });
}

function fromAddress(): string {
    const name = window.location.hash.slice(1);
    return [...tabs].some((tab) => tab.dataset.tab === name) ? name : DEFAULT_TAB;
}

export function initTabs() {
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            // Setting the hash fires "hashchange", which shows the tab.
            window.location.hash = tab.dataset.tab ?? DEFAULT_TAB;
        });
    });
    window.addEventListener("hashchange", () => show(fromAddress()));

    show(fromAddress());
}
