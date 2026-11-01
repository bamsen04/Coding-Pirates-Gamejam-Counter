const BUTTON_BASE = "text-xs font-bold uppercase tracking-widest py-1 px-2 border-2 border-black transition-colors";

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

export const GREEN_BUTTON = "bg-emerald-500 text-white hover:bg-emerald-600";
export const RED_BUTTON = "bg-red-500 text-white hover:bg-red-600";
export const PLAIN_BUTTON = "bg-white hover:bg-slate-100";

// The "nothing here" line shown in an empty list.
export function emptyNote(text: string): HTMLElement {
    const note = document.createElement("p");
    note.className = "text-sm text-slate-400";
    note.textContent = text;
    return note;
}
