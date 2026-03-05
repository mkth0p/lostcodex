export function fillSlider(el) {
    if (!el) return;
    const pct = ((el.value - el.min) / (el.max - el.min)) * 100;

    if (el.min < 0 && el.max > 0) {
        const center = 50;
        if (pct > center) {
            el.style.background = `linear-gradient(to right, rgba(91,157,255,0.2) 50%, var(--accent) 50%, var(--accent) ${pct}%, rgba(91,157,255,0.2) ${pct}%)`;
        } else {
            el.style.background = `linear-gradient(to right, rgba(91,157,255,0.2) ${pct}%, var(--accent) ${pct}%, var(--accent) 50%, rgba(91,157,255,0.2) 50%)`;
        }
        return;
    }

    el.style.background = `linear-gradient(to right,var(--accent) ${pct}%,rgba(91,157,255,0.2) ${pct}%)`;
}

