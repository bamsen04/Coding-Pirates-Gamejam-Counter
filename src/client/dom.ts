// document.getElementById that throws when the element is missing, so callers get the right type
// and a typo or a template change fails loudly instead of at some later null access.
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`#${id} is missing from the page`);
    return el as T;
}
