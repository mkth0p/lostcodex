// The tuning dial: a big wheel whose top arc shows at the bottom of the
// screen. It turns with the thumb, keeps spinning a little when flicked, and
// settles on the nearest station. Everything is drawn on one canvas.

const TAU = Math.PI * 2;

export class Dial {
    constructor(canvas, { bands, perBand, onMove, onSettle, onTick }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.bands = bands; // [{ name, color }]
        this.perBand = perBand;
        this.count = bands.length * perBand;
        this.step = TAU / this.count;
        this.pos = 0;
        this.vel = 0;
        this.target = null;
        this.dragging = false;
        this.onMove = onMove;
        this.onSettle = onSettle;
        this.onTick = onTick;
        this.lastIndex = 0;
        this.settled = 0;
        this.resize();
        new ResizeObserver(() => this.resize()).observe(canvas);
        this._bind();
        this._last = performance.now();
        requestAnimationFrame((t) => this._frame(t));
    }

    get index() {
        return ((Math.round(this.pos) % this.count) + this.count) % this.count;
    }

    // distance from the nearest station, 0 (locked) .. 0.5 (between)
    get detune() {
        return Math.abs(this.pos - Math.round(this.pos));
    }

    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        this.w = w;
        this.h = h;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.radius = Math.max(260, Math.min(w * 0.82, 520));
        this.cx = w / 2;
        this.cy = 34 + this.radius;
    }

    // Move to a station index, turning the short way round.
    goTo(index, { instant = false } = {}) {
        const here = this.pos;
        let delta = (index - here) % this.count;
        if (delta > this.count / 2) delta -= this.count;
        if (delta < -this.count / 2) delta += this.count;
        if (instant) {
            this.pos = here + delta;
            this.target = null;
            this.vel = 0;
            this.lastIndex = this.index;
            this.settled = 0;
            return;
        }
        this.target = here + delta;
        this.settled = 0;
    }

    _bind() {
        const c = this.canvas;
        let lastX = 0;
        let lastT = 0;
        c.addEventListener('pointerdown', (e) => {
            c.setPointerCapture(e.pointerId);
            this.dragging = true;
            this.target = null;
            this.vel = 0;
            lastX = e.clientX;
            lastT = e.timeStamp;
        });
        c.addEventListener('pointermove', (e) => {
            if (!this.dragging) return;
            const dx = e.clientX - lastX;
            const dt = Math.max(1, e.timeStamp - lastT);
            // the wheel follows the finger along its rim
            const d = -dx / (this.radius * this.step);
            this.pos += d;
            this.vel = 0.8 * (d / dt) + 0.2 * this.vel;
            lastX = e.clientX;
            lastT = e.timeStamp;
            this.settled = 0;
        });
        const end = () => {
            if (!this.dragging) return;
            this.dragging = false;
            // a flick keeps turning; aim for the station it would coast to
            const coast = this.vel * 220;
            this.target = Math.round(this.pos + Math.max(-24, Math.min(24, coast)));
            this.vel = 0;
        };
        c.addEventListener('pointerup', end);
        c.addEventListener('pointercancel', end);
        c.addEventListener('wheel', (e) => {
            e.preventDefault();
            const base = this.target ?? Math.round(this.pos);
            this.target = base + Math.sign(e.deltaY || e.deltaX);
            this.settled = 0;
        }, { passive: false });
        c.addEventListener('keydown', (e) => {
            const moves = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: this.perBand, PageDown: -this.perBand };
            if (!(e.key in moves)) return;
            e.preventDefault();
            const base = this.target ?? Math.round(this.pos);
            this.target = base + moves[e.key];
            this.settled = 0;
        });
    }

    _frame(now) {
        requestAnimationFrame((t) => this._frame(t));
        const dt = Math.min(0.05, (now - this._last) / 1000);
        this._last = now;
        if (!this.dragging && this.target !== null) {
            // critically damped glide towards the target station
            const diff = this.target - this.pos;
            this.pos += diff * Math.min(1, dt * 7);
            if (Math.abs(diff) < 0.002) {
                this.pos = this.target;
                this.target = null;
            }
        }
        const idx = this.index;
        if (idx !== this.lastIndex) {
            this.lastIndex = idx;
            this.onTick?.(idx);
        }
        this.onMove?.(this.pos, this.detune, this.dragging || this.target !== null);
        if (!this.dragging && this.target === null) {
            this.settled += dt;
            if (this.settled > 0.35 && this.settled - dt <= 0.35) this.onSettle?.(idx);
        }
        this.canvas.setAttribute('aria-valuenow', String(idx));
        this._draw();
    }

    _draw() {
        const { ctx, w, h, cx, cy, radius: R, step } = this;
        ctx.clearRect(0, 0, w, h);
        const base = -Math.PI / 2;
        const current = Math.floor(this.index / this.perBand);

        // body of the wheel
        const grd = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R + 30);
        grd.addColorStop(0, 'rgba(255,255,255,0.015)');
        grd.addColorStop(1, 'rgba(255,255,255,0.05)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, R + 26, 0, TAU);
        ctx.fill();

        // band arcs
        for (let b = 0; b < this.bands.length; b++) {
            const start = base + (b * this.perBand - 0.5 - this.pos) * step;
            const end = start + this.perBand * step;
            ctx.strokeStyle = this.bands[b].color;
            ctx.globalAlpha = b === current ? 0.95 : 0.32;
            ctx.lineWidth = b === current ? 3 : 2;
            ctx.beginPath();
            ctx.arc(cx, cy, R + 12, start + 0.01, end - 0.01);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // station ticks
        for (let i = 0; i < this.count; i++) {
            const a = base + (i - this.pos) * step;
            if (Math.cos(a + Math.PI / 2) < 0.15) continue;
            const bandStart = i % this.perBand === 0;
            const len = bandStart ? 22 : i % 3 === 0 ? 13 : 8;
            const near = Math.max(0, 1 - Math.abs(i - this.pos) / 5);
            ctx.strokeStyle = `rgba(236,231,220,${0.25 + near * 0.6})`;
            ctx.lineWidth = bandStart ? 1.6 : 1;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
            ctx.lineTo(cx + Math.cos(a) * (R - len), cy + Math.sin(a) * (R - len));
            ctx.stroke();
        }

        // band names, set along the rim
        ctx.font = '400 11px Compagnon, "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let b = 0; b < this.bands.length; b++) {
            const mid = b * this.perBand + (this.perBand - 1) / 2;
            const a = base + (mid - this.pos) * step;
            if (Math.cos(a + Math.PI / 2) < 0.3) continue;
            ctx.save();
            ctx.translate(cx + Math.cos(a) * (R - 44), cy + Math.sin(a) * (R - 44));
            ctx.rotate(a + Math.PI / 2);
            ctx.fillStyle = b === current ? '#ece7dc' : 'rgba(236,231,220,0.45)';
            ctx.fillText(spaced(this.bands[b].name.toUpperCase()), 0, 0);
            ctx.restore();
        }

        // frequency figures every third station
        ctx.font = '300 10px Compagnon, "Courier New", monospace';
        for (let i = 0; i < this.count; i += 3) {
            const a = base + (i - this.pos) * step;
            if (Math.cos(a + Math.PI / 2) < 0.5) continue;
            ctx.save();
            ctx.translate(cx + Math.cos(a) * (R - 70), cy + Math.sin(a) * (R - 70));
            ctx.rotate(a + Math.PI / 2);
            ctx.fillStyle = 'rgba(236,231,220,0.35)';
            ctx.fillText(frequency(i).toFixed(1), 0, 0);
            ctx.restore();
        }

        // knurled inner edge, so turning reads as turning
        ctx.strokeStyle = 'rgba(236,231,220,0.08)';
        ctx.lineWidth = 1;
        for (let k = 0; k < 180; k++) {
            const a = base + (k / 180) * TAU - this.pos * step;
            if (Math.cos(a + Math.PI / 2) < 0.2) continue;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * (R - 90), cy + Math.sin(a) * (R - 90));
            ctx.lineTo(cx + Math.cos(a) * (R - 98), cy + Math.sin(a) * (R - 98));
            ctx.stroke();
        }
    }
}

function spaced(text) {
    return text.split('').join(' ');
}

export function frequency(index) {
    return 87.6 + index * 0.2;
}
