// A slow light field driven by the music: notes bloom as soft glows placed by
// pitch, the current chord hangs as faint columns, the scene tints the dark.

const SCENE_TINT = {
    drift: [0, 0],
    sparse: [-10, -0.15],
    shimmer: [25, 0.1],
    pulse: [-30, 0.05],
    storm: [160, -0.1],
};

const MODE_LIGHT = { lydian: 0.62, ionian: 0.58, mixolydian: 0.54, dorian: 0.5, aeolian: 0.46, phrygian: 0.42 };

export class Field {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.glows = [];
        this.chord = [];
        this.scene = 'drift';
        this.hue = 220;
        this.light = 0.5;
        this.tint = [0, 0];
        this.frame = 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.canvas.width = Math.round(this.w * dpr);
        this.canvas.height = Math.round(this.h * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    setPiece(piece) {
        // circle of fifths: neighbouring keys get neighbouring hues
        const pc = ((piece.tonic % 12) + 12) % 12;
        this.hue = ((pc * 7) % 12) * 30;
        this.light = MODE_LIGHT[piece.mode] ?? 0.5;
        this.harsh = piece.harsh;
        this.glows = [];
    }

    update(state) {
        this.chord = state.chord || [];
        if (state.scene) this.scene = state.scene;
        for (const note of state.notes || []) this.addGlow(note);
    }

    xFor(midi) {
        const t = (midi - 28) / (98 - 28);
        return this.w * (0.08 + 0.84 * Math.max(0, Math.min(1, t)));
    }

    addGlow(note) {
        const big = note.layer === 'drone' || note.layer === 'sub' || note.layer === 'texture';
        const kick = note.layer === 'kick';
        this.glows.push({
            x: this.xFor(note.midi) + (Math.random() - 0.5) * 40,
            y: this.h * (kick ? 0.82 : 0.25 + Math.random() * 0.5),
            r: kick ? 140 : big ? 260 : 60 + Math.random() * 60,
            life: 1,
            decay: kick ? 0.04 : big ? 0.004 : 0.012,
            alpha: Math.min(0.6, 0.22 + (note.gain || 0.1) * 3),
            hueShift: (note.midi % 12) * 2,
        });
        if (this.glows.length > 90) this.glows.shift();
    }

    loop() {
        requestAnimationFrame((t) => this.loop(t));
        // 30 fps is plenty for something this slow, and kinder to phones
        if (this.frame++ % 2) return;
        const { ctx, w, h } = this;
        const target = SCENE_TINT[this.scene] || [0, 0];
        this.tint[0] += (target[0] - this.tint[0]) * 0.01;
        this.tint[1] += (target[1] - this.tint[1]) * 0.01;
        const hue = this.hue + this.tint[0];
        const sat = 45 - (this.harsh || 0) * 25;

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `hsl(${hue}, ${sat * 0.6}%, ${3 + this.light * 4}%)`;
        ctx.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = 'lighter';
        for (const m of this.chord) {
            const x = this.xFor(m);
            const g = ctx.createLinearGradient(x - 50, 0, x + 50, 0);
            g.addColorStop(0, 'hsla(0,0%,0%,0)');
            g.addColorStop(0.5, `hsla(${hue + 20}, ${sat}%, ${30 + this.light * 20}%, 0.08)`);
            g.addColorStop(1, 'hsla(0,0%,0%,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - 50, 0, 100, h);
        }

        for (const glow of this.glows) {
            glow.life -= glow.decay;
            glow.y -= 0.15;
            glow.r += 0.25;
            if (glow.life <= 0) continue;
            const a = glow.alpha * glow.life * (1 + this.tint[1]);
            const g = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.r);
            g.addColorStop(0, `hsla(${hue + glow.hueShift}, ${sat + 15}%, ${45 + this.light * 25}%, ${a})`);
            g.addColorStop(1, 'hsla(0,0%,0%,0)');
            ctx.fillStyle = g;
            ctx.fillRect(glow.x - glow.r, glow.y - glow.r, glow.r * 2, glow.r * 2);
        }
        this.glows = this.glows.filter((gl) => gl.life > 0);
    }
}
