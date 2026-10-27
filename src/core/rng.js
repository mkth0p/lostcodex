// Deterministic randomness. Every musical decision draws from a named stream
// forked from the piece seed, so adding a new stream never shifts another.

export function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    // final avalanche (murmur3 fmix32)
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
}

export class Rng {
    constructor(seed) {
        this.seed = seed >>> 0;
        this.state = this.seed;
    }

    // mulberry32
    next() {
        let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    range(min, max) {
        return min + (max - min) * this.next();
    }

    // inclusive integer range
    int(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
    }

    chance(p) {
        return this.next() < p;
    }

    pick(items) {
        return items[Math.floor(this.next() * items.length)];
    }

    // items: [[value, weight], ...]
    weighted(items) {
        let total = 0;
        for (const [, w] of items) total += w;
        let r = this.next() * total;
        for (const [value, w] of items) {
            r -= w;
            if (r < 0) return value;
        }
        return items[items.length - 1][0];
    }

    // exponential inter-onset time with the given mean
    exp(mean) {
        return -Math.log(1 - this.next()) * mean;
    }

    fork(label) {
        return new Rng(hashString(`${this.seed}:${label}`));
    }
}
