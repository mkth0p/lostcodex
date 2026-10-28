// Each universe has its own look, the way a record label gives each release
// its own sleeve. A look sets the page colours (paper, ink, accent), a class
// the stylesheet uses for the type, and a poster drawn on the canvas behind
// everything. Posters only react to the notes the engine actually plays, and
// any choice they make is seeded by the station, so a station always looks
// the same way it sounds.

const TAU = Math.PI * 2;

const BIG = new Set(['drone', 'pad', 'organ', 'choir', 'sub', 'bed', 'texture']);
const PITCHED = (n) => n.midi !== undefined;

// 0..1 across the range the universes play in
function pitch(n) {
    return Math.max(0, Math.min(1, ((n.midi ?? 60) - 28) / 70));
}

function hz(midi) {
    return 440 * 2 ** ((midi - 69) / 12);
}

function decay(list, rate) {
    for (const m of list) m.life -= rate * (m.slow ? 0.35 : 1);
    return list.filter((m) => m.life > 0);
}

// Tide: pure signal. Black and white bars and cells that flicker with the
// notes, one red cell for the newest note.
const raster = {
    paper: '#000000',
    ink: '#ffffff',
    accent: '#ff2a1a',
    init(f) {
        f.s.cols = 24;
        f.s.rows = 10;
        f.s.cells = new Float32Array(f.s.cols * f.s.rows);
        f.s.bars = [];
        f.s.red = -1;
        for (let i = 0; i < 12; i++) this.note(f, { midi: f.rng.int(36, 90), layer: f.rng.pick(['keys', 'bells', 'pad']), gain: 0.1 });
    },
    note(f, n) {
        const { s, rng } = f;
        const rows = { keys: 0, bells: 2, texture: 4, choir: 6, pad: 7, drone: 8, sub: 9 };
        const col = Math.floor(pitch(n) * (s.cols - 1));
        const row = Math.min(s.rows - 1, (rows[n.layer] ?? 5) + rng.int(0, 1));
        const i = row * s.cols + col;
        s.cells[i] = 1;
        s.red = i;
        const width = 2 + (n.gain || 0.1) * 60 * rng.range(0.4, 1.6);
        s.bars.push({ x: pitch(n), w: width, life: 1, slow: BIG.has(n.layer) });
        if (s.bars.length > 60) s.bars.shift();
    },
    draw(f) {
        const { ctx, w, h, s } = f;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        const m = Math.max(16, w * 0.04);
        // barcode band
        const top = h * 0.1;
        const band = h * 0.2;
        ctx.fillStyle = '#fff';
        for (const b of s.bars) {
            if (b.life < 0.15 && Math.floor(f.t * 12) % 2) continue;
            ctx.fillRect(m + b.x * (w - 2 * m - b.w), top, b.w, band * Math.min(1, b.life * 1.6));
        }
        s.bars = decay(s.bars, 0.005);
        // note grid, right side
        const gx = w > 700 ? w * 0.48 : m;
        const gw = w - gx - m;
        const cw = gw / s.cols;
        const gy = top + band + h * 0.05;
        for (let j = 0; j < s.rows; j++) {
            for (let i = 0; i < s.cols; i++) {
                const k = j * s.cols + i;
                const v = s.cells[k];
                const x = gx + i * cw;
                const y = gy + j * cw;
                if (k === s.red && v > 0.05) {
                    ctx.fillStyle = '#ff2a1a';
                    ctx.fillRect(x + 1, y + 1, cw - 2, cw - 2);
                } else if (v > 0.12) {
                    ctx.fillStyle = `rgba(255,255,255,${0.2 + v * 0.8})`;
                    ctx.fillRect(x + 1, y + 1, cw - 2, cw - 2);
                } else {
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillRect(x + cw / 2 - 0.75, y + cw / 2 - 0.75, 1.5, 1.5);
                }
                s.cells[k] = v * 0.992;
            }
        }
        // the chord as a dotted trace
        const ty = gy + s.rows * cw + h * 0.05;
        const chord = f.chord.length ? f.chord : [60];
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 180; i++) {
            const x = gx + (i / 180) * gw;
            let y = 0;
            for (const c of chord) y += Math.sin(i * hz(c) * 0.0009 + f.t * 0.8);
            ctx.fillRect(x, ty + (y / chord.length) * cw * 1.6, 1.5, 1.5);
        }
    },
};

// Cathedral: a Swiss concert poster. Each organ or choir note draws an arc
// around one centre; the arcs turn slowly and the bass sets the red hub.
const viva = {
    paper: '#f4f4f1',
    ink: '#111111',
    accent: '#e8361f',
    init(f) {
        f.s.arcs = [];
        f.s.hub = 0;
        // the poster opens with a few arcs so it is never empty
        for (let i = 0; i < 6; i++) this.note(f, { midi: 40 + i * 7, layer: 'organ', gain: 0.15 }, true);
    },
    note(f, n, quiet = false) {
        const { s, rng } = f;
        if (n.layer === 'sub' || n.layer === 'kick') {
            s.hub = 1;
            return;
        }
        s.arcs.push({
            r: 0.12 + pitch(n) * 0.88,
            a: rng.range(0, TAU),
            len: BIG.has(n.layer) ? rng.range(1.2, 3.4) : rng.range(0.25, 0.9),
            lw: 0.15 + Math.min(1, (n.gain || 0.1) * 4) * rng.range(0.4, 1),
            spin: rng.range(-1, 1) * 0.05,
            red: rng.next() < 0.18,
            life: quiet ? 0.8 : 1,
            slow: true,
        });
        if (s.arcs.length > 26) s.arcs.shift();
    },
    draw(f) {
        const { ctx, w, h, s } = f;
        ctx.fillStyle = this.paper;
        ctx.fillRect(0, 0, w, h);
        const wide = w > 700;
        const cx = wide ? w * 0.66 : w * 0.6;
        const cy = wide ? h * 0.42 : h * 0.5;
        const R = Math.min(w, h) * (wide ? 0.36 : 0.34);
        ctx.lineCap = 'butt';
        for (const a of s.arcs) {
            a.a += a.spin / 30;
            const grow = Math.min(1, (1 - a.life) * 20 + 0.05);
            ctx.strokeStyle = a.red ? this.accent : this.ink;
            ctx.globalAlpha = Math.min(1, a.life * 3);
            ctx.lineWidth = R * 0.07 * a.lw;
            ctx.beginPath();
            ctx.arc(cx, cy, R * a.r, a.a, a.a + a.len * grow);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        s.arcs = decay(s.arcs, 0.0015);
        s.hub *= 0.985;
        ctx.fillStyle = this.accent;
        ctx.beginPath();
        ctx.arc(cx, cy, R * (0.06 + s.hub * 0.03), 0, TAU);
        ctx.fill();
    },
};

// Dub: the station name cut into strips. Every note pushes the strips near
// its pitch, and the push echoes away like a delay.
const slice = {
    paper: '#1d2fe0',
    ink: '#dcff4f',
    accent: '#dcff4f',
    init(f) {
        f.s.strips = new Float32Array(28);
        f.s.vel = new Float32Array(28);
        f.s.src = null;
    },
    note(f, n) {
        const { s, rng } = f;
        // each note sends a wave through the strips; low notes travel long
        const push = Math.min(1, (n.gain || 0.08) * 5) * rng.pick([-1, 1]) * (n.layer === 'kick' ? 0.5 : 1);
        const wave = 0.2 + pitch(n) * 0.9;
        const phase = rng.range(0, TAU);
        for (let i = 0; i < s.strips.length; i++) s.vel[i] += push * 0.006 * Math.sin(i * wave + phase);
    },
    draw(f) {
        const { ctx, w, h, s } = f;
        ctx.fillStyle = this.paper;
        ctx.fillRect(0, 0, w, h);
        if (!s.src || s.src.width !== Math.round(w) || s.src.height !== Math.round(h)) {
            s.src = document.createElement('canvas');
            s.src.width = Math.round(w);
            s.src.height = Math.round(h);
            const q = s.src.getContext('2d');
            q.fillStyle = this.ink;
            const size = Math.min(w * 0.62 / Math.max(1.6, f.name.length * 0.5), h * 0.4);
            q.font = `300 ${size}px Basteleur, Georgia, serif`;
            q.textAlign = 'center';
            q.fillText(f.name, w / 2, h * 0.6);
        }
        const n0 = s.strips.length;
        const sh = h / n0;
        for (let i = 0; i < n0; i++) {
            // a spring with long echoes: overshoots and rings out slowly
            s.vel[i] += -s.strips[i] * 0.004;
            s.vel[i] *= 0.985;
            s.strips[i] += s.vel[i];
            const dx = s.strips[i] * w;
            const y = Math.floor(i * sh);
            const hh = Math.ceil(sh) + 1;
            ctx.globalAlpha = 0.22;
            ctx.drawImage(s.src, 0, y, w, hh, dx * 2.4, y, w, hh);
            ctx.globalAlpha = 1;
            ctx.drawImage(s.src, 0, y, w, hh, dx, y, w, hh);
        }
    },
    resize(f) {
        f.s.src = null;
    },
};

// Ice: hairline fractures on frosted white, each labelled with the pitch
// that cracked it.
const frost = {
    paper: '#e8eef1',
    ink: '#0c1f33',
    accent: '#2aa9d6',
    init(f) {
        f.s.cracks = [];
        for (let i = 0; i < 10; i++) this.note(f, { midi: f.rng.int(40, 96), layer: i % 3 ? 'bells' : 'drone' }, 0.6);
    },
    note(f, n, life = 1) {
        const { s, rng, w, h } = f;
        if (!PITCHED(n) || n.layer === 'sub') return;
        const x = w * (0.04 + pitch(n) * 0.92) + rng.range(-60, 60);
        const y = h * rng.range(0.1, 0.7);
        const pts = [[x, y]];
        let ang = rng.range(0, TAU);
        const steps = BIG.has(n.layer) ? 22 : 10;
        const len = Math.min(w, h) * (BIG.has(n.layer) ? 0.035 : 0.022);
        for (let i = 0; i < steps; i++) {
            ang += rng.range(-0.7, 0.7);
            const [px, py] = pts[pts.length - 1];
            pts.push([px + Math.cos(ang) * len, py + Math.sin(ang) * len]);
        }
        const branch = rng.int(2, steps - 1);
        s.cracks.push({ pts, branch, bang: ang + rng.range(1, 2), life, slow: true });
        if (s.cracks.length > 40) s.cracks.shift();
    },
    draw(f) {
        const { ctx, w, h, s } = f;
        ctx.fillStyle = this.paper;
        ctx.fillRect(0, 0, w, h);
        ctx.lineWidth = 1;
        for (const c of s.cracks) {
            const grow = Math.min(1, (1 - c.life) * 30 + 0.02);
            const shown = Math.max(2, Math.ceil(c.pts.length * grow));
            ctx.strokeStyle = this.ink;
            ctx.globalAlpha = Math.min(1, c.life * 2);
            ctx.beginPath();
            c.pts.slice(0, shown).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            if (shown > c.branch) {
                const [bx, by] = c.pts[c.branch];
                const l = Math.hypot(c.pts[1][0] - c.pts[0][0], c.pts[1][1] - c.pts[0][1]) * 3;
                ctx.moveTo(bx, by);
                ctx.lineTo(bx + Math.cos(c.bang) * l, by + Math.sin(c.bang) * l);
            }
            ctx.stroke();
            const [x0, y0] = c.pts[0];
            ctx.fillStyle = this.accent;
            ctx.fillRect(x0 - 2.5, y0 - 2.5, 5, 5);
        }
        ctx.globalAlpha = 1;
        s.cracks = decay(s.cracks, 0.0025);
    },
};

// Garden: environmental music sleeves. A composition of pastel blocks fixed
// by the station, ripples where notes land and a sun crossing as it plays.
const kankyo = {
    paper: '#e4e4df',
    ink: '#1a1a1a',
    accent: '#e8572a',
    init(f) {
        const { s, rng } = f;
        const pastels = ['#b9cdb0', '#f0c6a8', '#b8cbe0', '#e6d79a', '#d7b9c9'];
        const start = rng.int(0, pastels.length - 1);
        s.blocks = [0, 1, 2].map((i) => ({
            x: rng.range(0.35, 0.6), y: rng.range(0.08, 0.5), bw: rng.range(0.22, 0.42), bh: rng.range(0.14, 0.3),
            color: pastels[(start + i) % pastels.length],
        }));
        s.circle = { x: rng.range(0.4, 0.75), y: rng.range(0.15, 0.4), r: rng.range(0.12, 0.2) };
        s.horizon = rng.range(0.56, 0.64);
        s.ripples = [];
    },
    note(f, n) {
        const { s, rng } = f;
        if (!PITCHED(n)) return;
        s.ripples.push({ x: 0.08 + pitch(n) * 0.84, y: s.horizon - rng.range(0.02, 0.4), life: 1, r0: BIG.has(n.layer) ? 0.05 : 0.01 });
        if (s.ripples.length > 30) s.ripples.shift();
    },
    draw(f) {
        const { ctx, w, h, s } = f;
        const u = Math.min(w, h);
        ctx.fillStyle = this.paper;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'multiply';
        for (const b of s.blocks) {
            ctx.fillStyle = b.color;
            ctx.fillRect(w * b.x, h * b.y, w * b.bw, h * b.bh);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = this.ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(w * s.circle.x, h * s.circle.y, u * s.circle.r, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, h * s.horizon);
        ctx.lineTo(w, h * s.horizon);
        ctx.stroke();
        for (const r of s.ripples) {
            ctx.globalAlpha = r.life * 0.6;
            ctx.beginPath();
            ctx.arc(w * r.x, h * r.y, u * (r.r0 + (1 - r.life) * 0.08), 0, TAU);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        s.ripples = decay(s.ripples, 0.006);
        // the sun takes ten minutes to cross
        const p = (f.time / 600) % 1;
        ctx.fillStyle = this.accent;
        ctx.beginPath();
        ctx.arc(w * (0.04 + p * 0.92), h * s.horizon - Math.sin(p * Math.PI) * h * s.horizon * 0.8, u * 0.018, 0, TAU);
        ctx.fill();
    },
};

// Ash: a flyer through a broken copier. Notes drop ink blobs that a coarse
// halftone screen turns into dots; harsh layers add toner noise.
const xerox = {
    paper: '#ff6a1f',
    ink: '#111111',
    accent: '#111111',
    init(f) {
        f.s.blobs = [];
        f.s.toner = 0;
        for (let i = 0; i < 3; i++) this.note(f, { midi: 40 + i * 12, layer: 'pad', gain: 0.12 });
    },
    note(f, n) {
        const { s, rng } = f;
        if (n.layer === 'texture' || n.layer === 'bed') s.toner = Math.min(1, s.toner + 0.3);
        s.blobs.push({
            x: 0.1 + pitch(n) * 0.8 + rng.range(-0.1, 0.1), y: rng.range(0.15, 0.85),
            r: (BIG.has(n.layer) ? 0.28 : 0.12) * rng.range(0.7, 1.3),
            vx: rng.range(-1, 1) * 0.0004, vy: rng.range(-1, 1) * 0.0003, life: 1, slow: BIG.has(n.layer),
        });
        if (s.blobs.length > 14) s.blobs.shift();
    },
    draw(f) {
        const { ctx, w, h, s } = f;
        ctx.fillStyle = this.paper;
        ctx.fillRect(0, 0, w, h);
        const step = Math.max(9, Math.max(w, h) / 46);
        const ang = 0.26;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const reach = Math.hypot(w, h) / 2 + step;
        const blobs = s.blobs.map((b) => [b.x * w, b.y * h, b.r * Math.min(w, h) * 1.3, Math.min(1, b.life * 2)]);
        ctx.fillStyle = this.ink;
        for (let a = -reach; a < reach; a += step) {
            for (let b = -reach; b < reach; b += step) {
                const x = w / 2 + a * ca - b * sa;
                const y = h / 2 + a * sa + b * ca;
                if (x < -step || y < -step || x > w + step || y > h + step) continue;
                let v = 0;
                for (const [bx, by, br, bl] of blobs) {
                    const d = ((x - bx) ** 2 + (y - by) ** 2) / (br * br);
                    if (d < 4) v += Math.exp(-d * 1.8) * bl;
                }
                if (v > 0.05) {
                    ctx.beginPath();
                    ctx.arc(x, y, step * 0.6 * Math.sqrt(Math.min(1, v)), 0, TAU);
                    ctx.fill();
                }
            }
        }
        for (const b of s.blobs) {
            b.x += b.vx;
            b.y += b.vy;
        }
        s.blobs = decay(s.blobs, 0.004);
        s.toner *= 0.99;
        f.grainOver(0.12 + s.toner * 0.25, 'multiply');
    },
};

// Orbit: a heavily grained colour field under a strict grid. Four colours
// drift towards places set by the current chord.
const signal = {
    paper: '#d9cfb8',
    ink: '#0e0e10',
    accent: '#0e0e10',
    init(f) {
        const { s, rng } = f;
        const sets = [
            [[222, 108, 38], [96, 104, 40], [26, 72, 78], [232, 222, 200]],
            [[200, 76, 44], [40, 86, 92], [214, 196, 150], [70, 70, 34]],
            [[236, 150, 60], [52, 92, 70], [30, 50, 66], [226, 214, 190]],
        ];
        s.colors = sets[rng.int(0, sets.length - 1)];
        s.pts = s.colors.map(() => [rng.range(0.1, 0.9), rng.range(0.1, 0.9)]);
        s.goal = s.pts.map((p) => p.slice());
        s.lo = document.createElement('canvas');
        s.lo.width = 40;
        s.lo.height = 52;
        s.lastChord = '';
    },
    note(f, n) {
        const { s, rng } = f;
        const key = f.chord.join(',');
        if (key !== s.lastChord) {
            s.lastChord = key;
            s.goal = s.goal.map((_, i) => {
                const c = f.chord[i % Math.max(1, f.chord.length)] ?? 60;
                return [0.1 + ((c * 7) % 12) / 12 * 0.8, rng.range(0.1, 0.9)];
            });
        }
        if (n.layer === 'lead' || n.layer === 'keys') {
            const i = rng.int(0, s.pts.length - 1);
            s.pts[i][1] += rng.range(-0.04, 0.04);
        }
    },
    draw(f) {
        const { ctx, w, h, s } = f;
        const lq = s.lo.getContext('2d');
        const img = lq.createImageData(s.lo.width, s.lo.height);
        for (let i = 0; i < s.pts.length; i++) {
            s.pts[i][0] += (s.goal[i][0] - s.pts[i][0]) * 0.002;
            s.pts[i][1] += (s.goal[i][1] - s.pts[i][1]) * 0.002;
        }
        for (let j = 0; j < s.lo.height; j++) {
            for (let i = 0; i < s.lo.width; i++) {
                let sw = 0;
                let r = 0;
                let g = 0;
                let b = 0;
                for (let k = 0; k < s.pts.length; k++) {
                    const d = (i / s.lo.width - s.pts[k][0]) ** 2 + ((j / s.lo.height - s.pts[k][1]) * 1.2) ** 2;
                    const wt = 1 / (d * d + 0.0004);
                    sw += wt;
                    r += s.colors[k][0] * wt;
                    g += s.colors[k][1] * wt;
                    b += s.colors[k][2] * wt;
                }
                const o = (j * s.lo.width + i) * 4;
                img.data[o] = r / sw;
                img.data[o + 1] = g / sw;
                img.data[o + 2] = b / sw;
                img.data[o + 3] = 255;
            }
        }
        lq.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(s.lo, 0, 0, w, h);
        f.grainOver(0.35, 'overlay');
        ctx.strokeStyle = 'rgba(14,14,16,0.45)';
        ctx.lineWidth = 1;
        const cols = w > 700 ? 6 : 4;
        for (let i = 1; i < cols; i++) {
            const x = Math.round((w * i) / cols) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
    },
};

// Voices: two riso inks, overprinted. Each sung note prints a vowel at its
// pitch, slightly off register.
const riso = {
    paper: '#f5f5f2',
    ink: '#1b2b6b',
    accent: '#ff48b0',
    init(f) {
        f.s.glyphs = [];
    },
    note(f, n) {
        const { s, rng } = f;
        if (!PITCHED(n)) return;
        const big = BIG.has(n.layer);
        s.glyphs.push({
            ch: 'aeiou'[n.midi % 5],
            x: pitch(n) + rng.range(-0.05, 0.05),
            y: rng.range(0, 1),
            size: big ? rng.range(0.4, 0.65) : rng.range(0.14, 0.26),
            ink: rng.next() < 0.5 ? '#ff48b0' : '#0078bf',
            off: rng.range(-1, 1),
            life: 1,
            slow: big,
        });
        if (s.glyphs.length > 22) s.glyphs.shift();
    },
    draw(f) {
        const { ctx, w, h, s } = f;
        const u = Math.min(w, h);
        ctx.fillStyle = this.paper;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'multiply';
        ctx.textAlign = 'center';
        for (const g of s.glyphs) {
            const a = Math.min(1, (1 - g.life) * 8) * Math.min(1, g.life * 2);
            ctx.globalAlpha = 0.85 * a;
            ctx.font = `300 ${u * g.size}px Basteleur, Georgia, serif`;
            ctx.fillStyle = g.ink;
            // glyphs keep clear of the text: right half on wide screens, lower half on phones
            const x = w > 700 ? w * (0.48 + g.x * 0.46) : w * (0.08 + g.x * 0.84);
            const y = w > 700 ? h * (0.3 + g.y * 0.45) : h * (0.5 + g.y * 0.22);
            ctx.fillText(g.ch, x + g.off * 4, y);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        s.glyphs = decay(s.glyphs, 0.004);
        f.grainOver(0.08, 'multiply');
    },
};

export const LOOKS = {
    tide: { name: 'Raster', ...raster },
    cathedral: { name: 'Musica Viva', ...viva },
    dub: { name: 'Slice', ...slice },
    ice: { name: 'Frost', ...frost },
    garden: { name: 'Kankyō', ...kankyo },
    ash: { name: 'Photocopy', ...xerox },
    orbit: { name: 'Soft Signal', ...signal },
    voices: { name: 'Riso', ...riso },
};
