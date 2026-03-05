import { RNG } from '../../rng.js';
import { GLYPHS } from '../../data.js';

export function randomAddress(minLen = 5, maxLen = 18) {
    const rng = new RNG((Date.now() ^ (Math.random() * 0xFFFFFF | 0)) >>> 0);
    let address = '';
    for (let i = 0; i < rng.int(minLen, maxLen); i++) address += rng.pick(GLYPHS);
    return address;
}

