import { GLYPHS } from '../../data.js';

export function encodeAddress(address) {
    const indices = [...(address || '')].map((g) => {
        const idx = GLYPHS.indexOf(g);
        return idx === -1 ? 0 : idx;
    });
    return indices.map((i) => i.toString(36)).join('');
}

export function decodeAddress(encoded) {
    if (!encoded) return '';
    try {
        const indices = [];
        for (let i = 0; i < encoded.length; i++) {
            const idx = parseInt(encoded[i], 36);
            if (!isNaN(idx) && idx >= 0 && idx < GLYPHS.length) {
                indices.push(idx);
            }
        }
        return indices.map((i) => GLYPHS[i]).join('');
    } catch {
        return '';
    }
}
