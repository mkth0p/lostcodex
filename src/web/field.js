// The poster behind the dial. Each universe draws with its own look (see
// looks.js); this class runs the canvas, feeds the looks the notes being
// played, seeds them from the station and lays static over everything while
// the needle sits between stations.

import { hashString, Rng } from '../core/rng.js';
import { LOOKS } from './looks.js';

export class Field {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.look = LOOKS.tide;
        this.station = null;
        this.name = '';
        this.s = {};
        this.rng = new Rng(1);
        this.chord = [];
        this.bass = null;
        this.time = 0;
        this.static = 0;
        this.t = 0;
        this.frame = 0;
        this.grain = makeGrain();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        // looks that render type once need the real faces, not the fallback
        document.fonts?.ready.then(() => this.look.resize?.(this));
        requestAnimationFrame(() => this.loop());
    }

    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.canvas.width = Math.round(this.w * dpr);
        this.canvas.height = Math.round(this.h * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.look.resize?.(this);
    }

    // A new station starts its look from scratch, seeded by its code.
    setStation(id, universe, format = null) {
        if (id === this.station) return;
        this.station = id;
        this.name = format ? format.label : universe.name;
        this.look = LOOKS[universe.id] || LOOKS.tide;
        this.rng = new Rng(hashString(`look:${id}`));
        this.s = {};
        this.chord = [];
        this.time = 0;
        this.look.init(this);
    }

    // 0 = locked on a station, 1 = pure static
    setStatic(amount) {
        this.static = amount;
    }

    update(state) {
        if (state.chord) this.chord = state.chord;
        if (state.bass !== undefined) this.bass = state.bass;
        if (state.time !== undefined) this.time = state.time;
        if (state.bpm) this.bpm = state.bpm;
        if (state.scene !== undefined) {
            this.scene = state.scene;
            // "acid:drop" -> "drop": what the section does, whatever its format
            this.role = state.scene ? state.scene.split(':').pop() : null;
        }
        for (const note of state.notes || []) this.look.note(this, note);
    }

    // Lay the film grain over the poster.
    grainOver(alpha, mode = 'source-over') {
        const { ctx } = this;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = mode;
        const ox = (this.frame * 37) % 256;
        const oy = (this.frame * 91) % 256;
        ctx.translate(-ox, -oy);
        ctx.fillStyle = ctx.createPattern(this.grain, 'repeat');
        ctx.fillRect(0, 0, this.w + 256, this.h + 256);
        ctx.restore();
    }

    loop() {
        requestAnimationFrame(() => this.loop());
        // 30 fps is plenty, and kinder to phones
        if (this.frame++ % 2) return;
        this.t += 1 / 30;
        const { ctx } = this;
        ctx.save();
        this.look.draw(this);
        ctx.restore();
        if (this.static > 0.02) this.grainOver(Math.min(0.85, this.static));
    }
}

function makeGrain() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const img = g.createImageData(256, 256);
    const rng = new Rng(7);
    for (let i = 0; i < img.data.length; i += 4) {
        const v = rng.next() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
}
