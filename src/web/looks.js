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

// Neon: a dot-matrix sign on Akira red. The station's name scrolls one
// column per kick; every note lights a column of the board below it, in
// white, and black rain slants across the lot. In a build-up the sign
// scrolls on every snare of the roll, so it speeds up with it; in a drop the
// sign turns over, red dots on a black band.
const matrix = {
    paper: '#e8231b',
    ink: '#0b0b0b',
    accent: '#f6f1e7',
    init(f) {
        const { s, rng } = f;
        s.scroll = 0;
        s.target = 0;
        s.text = null;
        s.board = new Float32Array(40);
        s.rain = Array.from({ length: 70 }, () => ({ x: rng.next(), y: rng.next(), v: rng.range(0.6, 1.4), l: rng.range(0.02, 0.07) }));
        s.drops = 0;
    },
    // the sign's text as a bitmap, 9 dots tall
    _bitmap(f) {
        const text = `${f.name} ${f.station.split('-')[1] || ''}  `.toUpperCase();
        const c = document.createElement('canvas');
        const h = 9;
        c.height = h;
        const q = c.getContext('2d');
        q.font = `400 ${h + 1}px Compagnon, "Courier New", monospace`;
        c.width = Math.ceil(q.measureText(text).width) + 2;
        q.font = `400 ${h + 1}px Compagnon, "Courier New", monospace`;
        q.fillStyle = '#000';
        q.textBaseline = 'top';
        q.fillText(text, 1, 0);
        const data = q.getImageData(0, 0, c.width, h).data;
        const cols = [];
        for (let x = 0; x < c.width; x++) {
            const col = [];
            for (let y = 0; y < h; y++) col.push(data[(y * c.width + x) * 4 + 3] > 90);
            cols.push(col);
        }
        return cols;
    },
    note(f, n) {
        const { s } = f;
        if (n.layer === 'kick') {
            s.target += 1;
            return;
        }
        if (n.layer === 'snare') {
            s.drops = 1;
            if (f.scene === 'build') s.target += 1;
        }
        if (!PITCHED(n)) return;
        const i = Math.floor(pitch(n) * (s.board.length - 1));
        s.board[i] = Math.min(1, s.board[i] + 0.4 + (n.gain || 0.05) * 4);
    },
    draw(f) {
        const { ctx, w, h, s } = f;
        ctx.fillStyle = this.paper;
        ctx.fillRect(0, 0, w, h);
        if (!s.text) s.text = this._bitmap(f);
        // with no beat, the sign creeps on by itself
        s.target += 0.004;
        s.scroll += (s.target - s.scroll) * 0.25;
        const u = Math.max(7, Math.min(w / 40, h / 34));
        const top = h * 0.07;
        const cols = Math.ceil(w / u) + 1;
        const len = s.text.length;
        const off = Math.floor(s.scroll);
        const frac = s.scroll - off;
        const drop = f.scene === 'drop' || f.scene === 'drive';
        if (drop) {
            ctx.fillStyle = this.ink;
            ctx.fillRect(0, top - u * 0.5, w, u * 10);
        }
        for (let i = 0; i < cols; i++) {
            const col = s.text[(i + off) % len];
            const x = (i - frac) * u + u / 2;
            for (let j = 0; j < 9; j++) {
                ctx.fillStyle = drop ? this.paper : this.ink;
                ctx.globalAlpha = col[j] ? 1 : 0.13;
                ctx.beginPath();
                ctx.arc(x, top + j * u + u / 2, u * (col[j] ? 0.42 : 0.16), 0, TAU);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
        // the board: one column of dots per pitch, white while it sounds
        const bt = top + 10.5 * u;
        const bx = w > 700 ? w * 0.45 : 0;
        const bu = (w - bx) / s.board.length;
        for (let i = 0; i < s.board.length; i++) {
            const v = s.board[i];
            const lit = Math.round(v * 6);
            for (let j = 0; j < 6; j++) {
                const on = 5 - j < lit;
                ctx.fillStyle = on ? this.accent : this.ink;
                ctx.globalAlpha = on ? 1 : 0.13;
                ctx.fillRect(bx + i * bu + bu * 0.2, bt + j * Math.max(6, bu * 0.5), bu * 0.6, Math.max(4, bu * 0.32));
            }
            s.board[i] = v * 0.965;
        }
        ctx.globalAlpha = 1;
        // rain, harder for a moment on each clap
        ctx.strokeStyle = this.ink;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (const d of s.rain) {
            d.y += 0.012 * d.v * (1 + s.drops * 2);
            d.x -= 0.003 * d.v;
            if (d.y > 1) {
                d.y -= 1.1;
                d.x = (d.x + 0.37) % 1;
            }
            if (d.x < 0) d.x += 1;
            const x = d.x * w;
            const y = d.y * h;
            ctx.moveTo(x, y);
            ctx.lineTo(x - d.l * h * 0.25, y - d.l * h);
        }
        ctx.stroke();
        s.drops *= 0.9;
    },
    resize(f) {
        f.s.text = null;
    },
};

// Abyss: a bathymetric chart. Contour lines of a seabed fixed by the
// station; every note sends a sonar ring through the depths and every kick
// presses the whole floor down a little.
const bathymetry = {
    paper: '#0f3a40',
    ink: '#efe6cf',
    accent: '#ff7a1a',
    init(f) {
        const { s, rng } = f;
        s.bumps = Array.from({ length: 7 }, () => ({ x: rng.range(-0.1, 1.1), y: rng.range(-0.1, 1.1), r: rng.range(0.15, 0.45), a: rng.range(-1, 1) }));
        s.pings = [];
        s.press = 0;
        s.nx = 56;
        s.ny = 40;
        s.v = new Float32Array((s.nx + 1) * (s.ny + 1));
    },
    note(f, n) {
        const { s, rng } = f;
        if (n.layer === 'kick') {
            s.press = Math.min(1, s.press + 0.25);
            return;
        }
        if (!PITCHED(n)) return;
        s.pings.push({ x: 0.08 + pitch(n) * 0.84, y: rng.range(0.15, 0.85), r: 0, life: 1, a: BIG.has(n.layer) ? 0.9 : 0.45 });
        if (s.pings.length > 10) s.pings.shift();
    },
    draw(f) {
        const { ctx, w, h, s } = f;
        ctx.fillStyle = this.paper;
        ctx.fillRect(0, 0, w, h);
        const { nx, ny, v } = s;
        const t = f.t * 0.02;
        for (let j = 0; j <= ny; j++) {
            for (let i = 0; i <= nx; i++) {
                const x = i / nx;
                const y = j / ny;
                let z = 0;
                for (const b of s.bumps) z += b.a * Math.exp(-((x - b.x) ** 2 + ((y - b.y) * h / w) ** 2) / (b.r * b.r));
                z += 0.15 * Math.sin(x * 5 + t) * Math.cos(y * 4 - t);
                for (const p of s.pings) {
                    const d = Math.hypot(x - p.x, (y - p.y) * h / w);
                    z += p.a * p.life * Math.exp(-((d - p.r) ** 2) / 0.0012);
                }
                v[j * (nx + 1) + i] = z - s.press * 0.25;
            }
        }
        const cw = w / nx;
        const ch = h / ny;
        ctx.strokeStyle = this.ink;
        for (let k = -6; k <= 8; k++) {
            const level = k * 0.14;
            ctx.lineWidth = k % 4 === 0 ? 2.2 : 0.9;
            ctx.beginPath();
            for (let j = 0; j < ny; j++) {
                for (let i = 0; i < nx; i++) {
                    const a = v[j * (nx + 1) + i] - level;
                    const b = v[j * (nx + 1) + i + 1] - level;
                    const c = v[(j + 1) * (nx + 1) + i + 1] - level;
                    const d = v[(j + 1) * (nx + 1) + i] - level;
                    // marching squares, edge crossings by linear interpolation
                    const pts = [];
                    if ((a > 0) !== (b > 0)) pts.push([i + a / (a - b), j]);
                    if ((b > 0) !== (c > 0)) pts.push([i + 1, j + b / (b - c)]);
                    if ((c > 0) !== (d > 0)) pts.push([i + 1 - c / (c - d), j + 1]);
                    if ((d > 0) !== (a > 0)) pts.push([i, j + 1 - d / (d - a)]);
                    for (let p = 0; p + 1 < pts.length; p += 2) {
                        ctx.moveTo(pts[p][0] * cw, pts[p][1] * ch);
                        ctx.lineTo(pts[p + 1][0] * cw, pts[p + 1][1] * ch);
                    }
                }
            }
            ctx.stroke();
        }
        // the sounding that sent each ring: a solid orange mark
        ctx.fillStyle = this.accent;
        for (const p of s.pings) {
            p.r += 0.0035;
            const r = Math.min(w, h) * 0.012 * (0.5 + p.life);
            ctx.globalAlpha = Math.min(1, p.life * 2);
            ctx.fillRect(p.x * w - r, p.y * h - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
        s.pings = decay(s.pings, 0.006);
        s.press *= 0.94;
    },
};

// Bronze: a weave on turmeric. The columns are the sixteenths of the 2-bar
// cycle every figure shares and the rows are pitch: struck keys lay weft,
// bells lay warp, threads pass over and under, and each gong stamps an
// oxblood disc behind the cloth.
const weave = {
    paper: '#e3a72f',
    ink: '#2b1a10',
    accent: '#8e1b12',
    init(f) {
        const { s, rng } = f;
        s.cols = 32;
        s.rows = 16;
        s.weft = new Float32Array(s.cols * s.rows);
        s.warp = new Float32Array(s.cols * s.rows);
        s.gongs = [];
        // the cloth is never bare: a few seeded threads from the start
        for (let i = 0; i < 24; i++) this.note(f, { midi: rng.int(50, 90), layer: rng.pick(['keys', 'bells']), time: rng.int(0, 31) * 0.2, gain: 0.1 }, 0.5);
    },
    note(f, n, life = 1) {
        const { s, rng } = f;
        if (!PITCHED(n)) return;
        if (n.layer === 'drone' && n.midi < 66 && (n.gain || 0) > 0.1) {
            s.gongs.push({ x: rng.range(0.25, 0.75), y: rng.range(0.25, 0.55), life: 1, slow: true });
            if (s.gongs.length > 3) s.gongs.shift();
            return;
        }
        const sixteenth = 60 / (f.bpm || 80) / 4;
        const col = Math.floor((n.time ?? f.time) / sixteenth + 0.5) % s.cols;
        const row = s.rows - 1 - Math.floor(pitch(n) * (s.rows - 1));
        // bells lay a warp thread down a few rows, keys a weft thread along
        // a few sixteenths
        const run = rng.int(2, 4);
        for (let k = 0; k < run; k++) {
            if (n.layer === 'bells') {
                const j = Math.min(s.rows - 1, row + k);
                s.warp[j * s.cols + col] = Math.max(s.warp[j * s.cols + col], life);
            } else {
                const i = (col + k) % s.cols;
                s.weft[row * s.cols + i] = Math.max(s.weft[row * s.cols + i], life);
            }
        }
    },
    draw(f) {
        const { ctx, w, h, s } = f;
        ctx.fillStyle = this.paper;
        ctx.fillRect(0, 0, w, h);
        const u = Math.min(w, h);
        for (const g of s.gongs) {
            ctx.fillStyle = this.accent;
            ctx.globalAlpha = Math.min(1, g.life * 1.5);
            ctx.beginPath();
            ctx.arc(w * g.x, h * g.y, u * (0.2 + (1 - g.life) * 0.1), 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        s.gongs = decay(s.gongs, 0.003);
        const wide = w > 700;
        const gx = wide ? w * 0.5 : w * 0.06;
        const gw = (wide ? w * 0.96 : w * 0.94) - gx;
        const gy = wide ? h * 0.08 : h * 0.07;
        const gh = wide ? h * 0.46 : h * 0.2;
        const cw = gw / s.cols;
        const rh = gh / s.rows;
        // the loom: every thread faintly, so the grid is always there
        ctx.fillStyle = this.ink;
        ctx.globalAlpha = 0.12;
        for (let i = 0; i < s.cols; i++) ctx.fillRect(gx + i * cw + cw * 0.45, gy, cw * 0.1, gh);
        for (let j = 0; j < s.rows; j++) ctx.fillRect(gx, gy + j * rh + rh * 0.45, gw, rh * 0.1);
        // warp first (vertical), then weft over it except where the warp
        // crosses on top
        for (let i = 0; i < s.cols; i++) {
            for (let j = 0; j < s.rows; j++) {
                const v = s.warp[j * s.cols + i];
                if (v < 0.04) continue;
                ctx.globalAlpha = Math.min(1, v * 1.4);
                ctx.fillRect(gx + i * cw + cw * 0.14, gy + j * rh - rh * 0.02, cw * 0.72, rh * 1.04);
            }
        }
        for (let j = 0; j < s.rows; j++) {
            for (let i = 0; i < s.cols; i++) {
                const k = j * s.cols + i;
                const v = s.weft[k];
                if (v < 0.04) continue;
                if ((i + j) % 2 && s.warp[k] > 0.2) continue;
                ctx.globalAlpha = Math.min(1, v * 1.4);
                ctx.fillStyle = j % 4 === 1 ? this.accent : this.ink;
                ctx.fillRect(gx + i * cw - cw * 0.02, gy + j * rh + rh * 0.16, cw * 1.04, rh * 0.68);
            }
        }
        ctx.fillStyle = this.ink;
        ctx.globalAlpha = 1;
        for (let k = 0; k < s.weft.length; k++) {
            s.weft[k] *= 0.997;
            s.warp[k] *= 0.997;
        }
        // the playhead: where in the two bars every figure is now
        const sixteenth = 60 / (f.bpm || 80) / 4;
        const p = ((f.time / sixteenth) % s.cols) / s.cols;
        ctx.fillRect(gx + p * gw - 1, gy - rh, 3, gh + rh * 2);
        // the two bar lines under the cloth
        for (const c of [0, 16, 32]) ctx.fillRect(gx + c * cw - 1, gy + gh + rh * 0.6, 2, rh * 1.2);
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
    neon: { name: 'Dot Matrix', ...matrix },
    abyss: { name: 'Bathymetry', ...bathymetry },
    bronze: { name: 'Weave', ...weave },
};
