// Small buttons for the lists on the admin page. They use the site's pixel button classes (see pixel.css).
const BUTTON_BASE = "px px-sm px-btn px-btn-sm";

export function makeButton(label: string, colors: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = `${BUTTON_BASE} ${colors}`;
    button.addEventListener("click", onClick);
    return button;
}

// Looks like makeButton, but is a link (for downloads).
export function makeLink(label: string, href: string, colors: string): HTMLAnchorElement {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    link.className = `${BUTTON_BASE} ${colors}`;
    return link;
}

export const GREEN_BUTTON = "px-btn-ok";
export const RED_BUTTON = "px-btn-no";
export const PLAIN_BUTTON = "";

// A row in a list: sunk into its panel.
export const ROW = "px-row p-3";

// The "nothing here" line shown in an empty list.
export function emptyNote(text: string): HTMLElement {
    const note = document.createElement("p");
    note.className = "opacity-60";
    note.textContent = text;
    return note;
}
