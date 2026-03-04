// ============================================================
// RNG — Seeded pseudorandom number generator (cyrb53 + Mulberry32)
// ============================================================

export function cyrb53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export class RNG {
    constructor(seed) { this.s = (seed >>> 0) || 1; }
    next() {
        let t = this.s += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    range(lo, hi) { return lo + this.next() * (hi - lo); }
    int(lo, hi) { return lo + (this.next() * (hi - lo) | 0); }
    pick(arr) { return arr[this.int(0, arr.length)]; }
    bool(p = 0.5) { return this.next() < p; }
}

export function hashAddress(addr) {
    if (!addr) return 1;
    let h = 5381;
    for (let i = 0; i < addr.length; i++) h = (Math.imul(h, 33) ^ addr.charCodeAt(i)) >>> 0;
    return h || 1;
}
