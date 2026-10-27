// The light behind the dial. Each universe has its own way of drawing the
// notes it plays: waves for Tide, shafts for Cathedral, rings for Dub, and so
// on. Marks keep the style they were born with, so switching stations
// crossfades naturally as the old marks fade and the new ones arrive.

const TAU = Math.PI * 2;

function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba([r, g, b], a) {
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

const BIG = new Set(['drone', 'pad', 'organ', 'choir', 'sub', 'bed', 'texture']);

// Every style turns a note into a mark ({ ...fields, life, decay }) and draws it.
const STYLES = {
    tide: {
        spawn(f, n) {
            return { y: f.yFor(n.midi), amp: BIG.has(n.layer) ? 26 : 12, phase: Math.random() * TAU, decay: BIG.has(n.layer) ? 0.004 : 0.01 };
        },
        draw(f, m, c, a) {
            const { ctx, w } = f;
            ctx.strokeStyle = rgba(c, a * 0.7);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let x = 0; x <= w; x += 12) {
                const y = m.y + Math.sin(x * 0.006 + m.phase + f.t * 0.4) * m.amp * (0.4 + m.life);
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        },
    },
    cathedral: {
        spawn(f, n) {
            return { x: f.xFor(n.midi), wide: BIG.has(n.layer) ? 120 : 40, decay: BIG.has(n.layer) ? 0.003 : 0.008, tilt: 0.18 };
        },
        draw(f, m, c, a) {
            const { ctx, h } = f;
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, rgba(c, a * 0.32));
            g.addColorStop(1, rgba(c, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(m.x - m.wide * 0.3, 0);
            ctx.lineTo(m.x + m.wide * 0.3, 0);
            ctx.lineTo(m.x + m.wide + h * m.tilt, h);
            ctx.lineTo(m.x - m.wide + h * m.tilt, h);
            ctx.fill();
        },
    },
    dub: {
        spawn(f, n) {
            const kick = n.layer === 'kick';
            return { x: f.w / 2, y: f.h * 0.42, r: kick ? 20 : 60, grow: kick ? 3.2 : 1.1, decay: kick ? 0.02 : 0.006, width: kick ? 2 : 1 };
        },
        draw(f, m, c, a) {
            const { ctx } = f;
            m.r += m.grow;
            ctx.strokeStyle = rgba(c, a * 0.3);
            ctx.lineWidth = m.width;
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.r, 0, TAU);
            ctx.stroke();
        },
    },
    ice: {
        spawn(f, n) {
            const len = BIG.has(n.layer) ? 220 : 70 + Math.random() * 90;
            return { x: f.xFor(n.midi), y: f.h * (0.1 + Math.random() * 0.6), len, ang: -1.2 + Math.random() * 0.5, decay: 0.006 };
        },
        draw(f, m, c, a) {
            const { ctx } = f;
            const dx = Math.cos(m.ang) * m.len;
            const dy = Math.sin(m.ang) * m.len;
            ctx.strokeStyle = rgba(c, a * 0.7);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(m.x - dx / 2, m.y - dy / 2);
            ctx.lineTo(m.x + dx / 2, m.y + dy / 2);
            ctx.lineTo(m.x + dx / 2 + 14, m.y + dy / 2 + 30);
            ctx.stroke();
        },
    },
    garden: {
        spawn(f, n) {
            return { x: f.w * (0.06 + Math.random() * 0.88), y: f.yFor(n.midi) + (Math.random() - 0.5) * f.h * 0.3, r: BIG.has(n.layer) ? 30 : 5 + Math.random() * 8, petals: 5 + Math.floor(Math.random() * 3), decay: 0.008, spin: Math.random() * TAU };
        },
        draw(f, m, c, a) {
            const { ctx } = f;
            const r = m.r * (1.6 - m.life * 0.6);
            ctx.fillStyle = rgba(c, a * 0.16);
            for (let p = 0; p < m.petals; p++) {
                const ang = m.spin + (p / m.petals) * TAU;
                ctx.beginPath();
                ctx.arc(m.x + Math.cos(ang) * r, m.y + Math.sin(ang) * r, r * 0.6, 0, TAU);
                ctx.fill();
            }
        },
    },
    ash: {
        spawn(f, n) {
            return Array.from({ length: BIG.has(n.layer) ? 6 : 3 }, () => ({ x: f.xFor(n.midi) + (Math.random() - 0.5) * 160, y: f.h * (0.7 + Math.random() * 0.3), vx: (Math.random() - 0.5) * 0.6, vy: -(0.6 + Math.random() * 1.4), r: 1 + Math.random() * 2.5, decay: 0.004 + Math.random() * 0.004 }));
        },
        draw(f, m, c, a) {
            const { ctx } = f;
            m.x += m.vx + Math.sin(f.t + m.y * 0.02) * 0.4;
            m.y += m.vy;
            const flicker = 0.6 + Math.random() * 0.4;
            ctx.fillStyle = rgba(c, a * flicker);
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.r, 0, TAU);
            ctx.fill();
        },
    },
    orbit: {
        spawn(f, n) {
            return { rx: 60 + ((n.midi % 24) / 24) * f.w * 0.45, ry: 30 + Math.random() * 90, ang: Math.random() * TAU, speed: 0.004 + Math.random() * 0.01, decay: BIG.has(n.layer) ? 0.003 : 0.006 };
        },
        draw(f, m, c, a) {
            const { ctx, w, h } = f;
            const cx = w / 2;
            const cy = h * 0.4;
            m.ang += m.speed;
            ctx.strokeStyle = rgba(c, a * 0.3);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(cx, cy, m.rx, m.ry, -0.25, 0, TAU);
            ctx.stroke();
            const x = cx + Math.cos(m.ang) * m.rx * Math.cos(-0.25) - Math.sin(m.ang) * m.ry * Math.sin(-0.25);
            const y = cy + Math.cos(m.ang) * m.rx * Math.sin(-0.25) + Math.sin(m.ang) * m.ry * Math.cos(-0.25);
            ctx.fillStyle = rgba(c, a);
            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, TAU);
            ctx.fill();
        },
    },
    voices: {
        spawn(f, n) {
            return { x: f.xFor(n.midi), y: f.h * (0.25 + Math.random() * 0.35), r: BIG.has(n.layer) ? 200 : 90, decay: 0.004, phase: Math.random() * TAU };
        },
        draw(f, m, c, a) {
            const { ctx } = f;
            const r = m.r * (1 + 0.12 * Math.sin(f.t * 0.8 + m.phase));
            const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
            g.addColorStop(0, rgba(c, a * 0.28));
            g.addColorStop(1, rgba(c, 0));
            ctx.fillStyle = g;
            ctx.fillRect(m.x - r, m.y - r, r * 2, r * 2);
        },
    },
};

export class Field {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.marks = [];
        this.style = 'tide';
        this.color = rgb('#7fb7c9');
        this.bg = [8, 8, 11];
        this.bgTarget = [8, 8, 11];
        this.static = 0;
        this.energy = 0;
        this.t = 0;
        this.frame = 0;
        this.grain = makeGrain();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        requestAnimationFrame(() => this.loop());
    }

    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.canvas.width = Math.round(this.w * dpr);
        this.canvas.height = Math.round(this.h * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    setUniverse(universe) {
        if (!STYLES[universe.id]) return;
        this.style = universe.id;
        this.color = rgb(universe.color);
        // a very dark wash of the universe colour
        this.bgTarget = this.color.map((v) => 6 + v * 0.035);
    }

    // 0 = locked on a station, 1 = pure static
    setStatic(amount) {
        this.static = amount;
    }

    update(state) {
        for (const note of state.notes || []) this.add(note);
    }

    xFor(midi) {
        const t = (midi - 28) / (98 - 28);
        return this.w * (0.08 + 0.84 * Math.max(0, Math.min(1, t)));
    }

    yFor(midi) {
        const t = (midi - 28) / (98 - 28);
        return this.h * (0.75 - 0.6 * Math.max(0, Math.min(1, t)));
    }

    add(note) {
        if (note.midi === undefined) return;
        const style = STYLES[this.style];
        for (const mark of [].concat(style.spawn(this, note))) {
            mark.style = this.style;
            mark.color = this.color;
            mark.life = 1;
            mark.alpha = Math.min(1.6, 0.9 + (note.gain || 0.1) * 5);
            mark.decay *= 0.7;
            this.marks.push(mark);
        }
        if (this.marks.length > 90) this.marks.splice(0, this.marks.length - 90);
        this.energy = Math.min(1, this.energy + (BIG.has(note.layer) ? 0.25 : 0.08));
    }

    loop() {
        requestAnimationFrame(() => this.loop());
        // 30 fps is plenty for something this slow, and kinder to phones
        if (this.frame++ % 2) return;
        this.t += 1 / 30;
        const { ctx, w, h } = this;
        for (let i = 0; i < 3; i++) this.bg[i] += (this.bgTarget[i] - this.bg[i]) * 0.03;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgb(${this.bg.map(Math.round).join(',')})`;
        ctx.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = 'lighter';
        // a slow glow that swells with how much is being played
        this.energy *= 0.995;
        const glowA = 0.05 + this.energy * 0.1 + 0.02 * Math.sin(this.t * 0.3);
        const r = Math.max(w, h) * 0.7;
        const glow = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, r);
        glow.addColorStop(0, rgba(this.color, glowA * (1 - this.static * 0.7)));
        glow.addColorStop(1, rgba(this.color, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        const quiet = 1 - this.static * 0.7;
        for (const m of this.marks) {
            m.life -= m.decay;
            if (m.life <= 0) continue;
            // ease in over the first moments, then fade
            const a = m.alpha * Math.min(1, (1 - m.life) * 12) * m.life * quiet;
            STYLES[m.style].draw(this, m, m.color, a);
        }
        this.marks = this.marks.filter((m) => m.life > 0);

        if (this.static > 0.02) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = Math.min(0.22, this.static * 0.3);
            const ox = Math.floor(Math.random() * 128);
            const oy = Math.floor(Math.random() * 128);
            ctx.fillStyle = ctx.createPattern(this.grain, 'repeat');
            ctx.save();
            ctx.translate(-ox, -oy);
            ctx.fillRect(0, 0, w + 128, h + 128);
            ctx.restore();
            ctx.globalAlpha = 1;
        }
    }
}

function makeGrain() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 150;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
}
