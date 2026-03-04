import { RNG } from './rng.js';
export class PlanetRenderer {
    constructor(canvas) {
        this.cv = canvas; this.ctx = canvas.getContext('2d');
        this.planet = null; this.angle = 0; this.raf = null; this._tex = null;
        this.lastW = 0; this.lastH = 0;
        // Debounced resize to prevent distortion
        this.resizeTimeout = null;
        window.addEventListener('resize', () => this._handleResize());
    }

    _handleResize() {
        if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this._frame();
        }, 100);
    }

    _noise(grid, gw, x, y) {
        const xi = Math.floor(x) % gw, yi = Math.floor(y) % gw;
        const xf = x - Math.floor(x), yf = y - Math.floor(y);
        const s = t => t * t * (3 - 2 * t);
        const a = grid[yi * gw + xi], b = grid[yi * gw + (xi + 1) % gw];
        const c = grid[((yi + 1) % gw) * gw + xi], d = grid[((yi + 1) % gw) * gw + (xi + 1) % gw];
        return a + s(xf) * (b - a) + s(yf) * (c - a) + s(xf) * s(yf) * (a - b - c + d);
    }

    _buildTex(planet) {
        const sz = this.isMobile ? 128 : 256;
        const rng = new RNG(planet.seed + 7), gw = 16;
        const g1 = Array.from({ length: gw * gw }, () => rng.next());
        const g2 = Array.from({ length: gw * gw }, () => rng.next());
        const off = document.createElement('canvas'); off.width = off.height = sz;
        const ctx = off.getContext('2d');
        const img = ctx.createImageData(sz, sz), data = img.data;
        const cols = planet.colors;
        for (let py = 0; py < sz; py++) for (let px = 0; px < sz; px++) {
            const nx = px / sz * gw, ny = py / sz * gw;
            let n = this._noise(g1, gw, nx, ny) * 0.54
                + this._noise(g2, gw, nx * 2, ny * 2) * 0.27
                + this._noise(g1, gw, nx * 4, ny * 4) * 0.12
                + this._noise(g2, gw, nx * 8, ny * 8) * 0.07;
            n = Math.max(0, Math.min(1, n));
            const ci = Math.min(cols.length - 2, Math.floor(n * (cols.length - 1)));
            const t = n * (cols.length - 1) - ci;
            const c0 = this._hex(cols[ci]), c1 = this._hex(cols[ci + 1] || cols[ci]);
            const i = (py * sz + px) * 4;
            data[i] = c0.r + t * (c1.r - c0.r) | 0;
            data[i + 1] = c0.g + t * (c1.g - c0.g) | 0;
            data[i + 2] = c0.b + t * (c1.b - c0.b) | 0;
            data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        return off;
    }

    _hex(h) {
        const n = parseInt(h.replace('#', ''), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    load(planet) {
        this.planet = planet;
        // Defer texture build to avoid blocking click handler
        requestAnimationFrame(() => {
            this._tex = this._buildTex(planet);
            this._frame();
        });
    }

    _frame() {
        const cv = this.cv, ctx = this.ctx;
        // Only resize canvas if dimensions actually changed
        const W = cv.offsetWidth, H = cv.offsetHeight;
        if (this.lastW !== W || this.lastH !== H) {
            cv.width = W; cv.height = H;
            this.lastW = W; this.lastH = H;
        }
        const p = this.planet;
        ctx.clearRect(0, 0, W, H);
        if (!p) return;
        const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.36;

        // Outer glow
        const glow = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.5);
        glow.addColorStop(0, p.biome.glowColor + '44');
        glow.addColorStop(0.5, p.biome.glowColor + '18');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2); ctx.fill();

        // Planet body clipped
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
        if (this._tex) {
            const tw = this._tex.width, scale = (r * 2) / tw * 1.05;
            const ox = ((this.angle * 0.25) % (tw * scale)) - (tw * scale);
            ctx.drawImage(this._tex, cx - r + ox, cy - r, tw * scale, r * 2);
            ctx.drawImage(this._tex, cx - r + ox + tw * scale, cy - r, tw * scale, r * 2);
        }
        // Sphere shading
        const sh = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
        sh.addColorStop(0, 'rgba(255,255,255,0.08)');
        sh.addColorStop(0.5, 'rgba(0,0,0,0)');
        sh.addColorStop(1, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = sh; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

        // ── Lava Glow (Volcanic) ──────────────────────────────────────────
        if (p.hasLavaGlow) {
            const glowPulse = 0.15 + Math.sin(this.angle * 0.05) * 0.05;
            const lava = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r);
            lava.addColorStop(0, 'rgba(255, 50, 0, 0)');
            lava.addColorStop(0.8, `rgba(255, 70, 0, ${glowPulse})`);
            lava.addColorStop(1, 'rgba(255, 30, 0, 0)');
            ctx.fillStyle = lava; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }

        // ── Craters (Barren/Volcanic/Desert) ─────────────────────────────
        if (p.hasCraters) {
            const crRng = new RNG(p.seed + 88);
            ctx.globalAlpha = 0.25;
            for (let i = 0; i < 8; i++) {
                const cAngle = crRng.range(0, Math.PI * 2) + this.angle * 0.005;
                const cDist = crRng.range(0, r * 0.85);
                const cSize = crRng.range(r * 0.05, r * 0.15);
                const crx = cx + Math.cos(cAngle) * cDist;
                const cry = cy + Math.sin(cAngle) * cDist;
                // Simple rim shading
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(crx, cry, cSize, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.beginPath(); ctx.arc(crx - 1, cry - 1, cSize, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        // ── Ice Caps (Glacial/Crystalline) ───────────────────────────────
        if (p.hasIceCaps) {
            const capRng = new RNG(p.seed + 555);
            // Internal helper to draw a jagged polar mass
            const drawCap = (ty, scaleY) => {
                const capBaseR = r * 0.55;
                const segments = 40;
                ctx.beginPath();
                for (let i = 0; i <= segments; i++) {
                    const ang = (i / segments) * Math.PI * 2;
                    // Seeded noise makes the edge "crunchy" and island-like
                    const dist = capBaseR * (0.85 + capRng.range(0, 0.25));
                    const px = cx + Math.cos(ang) * dist;
                    const py = ty + Math.sin(ang) * dist * scaleY;
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath();

                // 3D shading for the ice mass
                const grad = ctx.createRadialGradient(cx - r * 0.2, ty - r * 0.1 * (ty < cy ? 1 : -1), 0, cx, ty, capBaseR);
                grad.addColorStop(0, '#ffffffe8');
                grad.addColorStop(0.7, '#e0f4ffaf');
                grad.addColorStop(1, '#b0d0f0');
                ctx.fillStyle = grad;
                ctx.fill();

                // Subtle "cracks" and frost texture
                ctx.globalAlpha = 0.35;
                ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                ctx.lineWidth = 0.8;
                for (let i = 0; i < 10; i++) {
                    const fx = cx + capRng.range(-capBaseR, capBaseR) * 0.6;
                    const fy = ty + capRng.range(-capBaseR, capBaseR) * 0.3 * scaleY;
                    ctx.beginPath(); ctx.arc(fx, fy, capRng.range(2, 6), 0, Math.PI * 2); ctx.stroke();
                }
                ctx.globalAlpha = 1.0;
            };

            ctx.save();
            drawCap(cy - r * 0.85, 0.35); // North
            drawCap(cy + r * 0.85, 0.35); // South
            ctx.restore();
        }

        // ── Auroras (Ethereal/Quantum/Abyssal) ───────────────────────────
        if (p.hasAuroras) {
            const auRng = new RNG(p.seed + 99);
            for (let i = 0; i < 2; i++) {
                const ay = cy - r * 0.4 + (i * r * 0.45);
                const drift = Math.sin(this.angle * 0.02 + i) * 10;
                const auGlow = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
                const baseC = p.biome.glowColor;
                auGlow.addColorStop(0, 'transparent');
                auGlow.addColorStop(0.5, baseC + '66');
                auGlow.addColorStop(1, 'transparent');
                ctx.fillStyle = auGlow;
                ctx.globalAlpha = 0.4 + Math.sin(this.angle * 0.05) * 0.2;
                ctx.fillRect(cx - r, ay + drift, r * 2, r * 0.15);
            }
            ctx.globalAlpha = 1;
        }

        // Clouds
        if (p.hasClouds) {
            ctx.globalAlpha = p.cloudOpac * 0.65;
            const cColor = p.biome.id === 'volcanic' ? 'rgba(255, 200, 150, 0.5)' :
                p.biome.id === 'psychedelic' ? 'rgba(200, 255, 180, 0.5)' :
                    p.biome.id === 'corrupted' ? 'rgba(200, 180, 255, 0.5)' :
                        'rgba(220, 230, 255, 0.55)';

            for (let i = 0; i < 5; i++) {
                const cr = new RNG(p.seed + i * 1237);
                const ox = ((this.angle * 0.55 + i * r * 0.5) % (r * 3)) - r;
                const cy2 = cy - r * 0.65 + cr.range(0, r * 1.3);
                const rx2 = cr.range(r * 0.22, r * 0.52), ry2 = cr.range(r * 0.06, r * 0.14);
                ctx.fillStyle = cColor;
                ctx.beginPath(); ctx.ellipse(cx + ox, cy2, rx2, ry2, 0, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
        ctx.restore();

        // Atmosphere halo
        const atm = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.08);
        atm.addColorStop(0, 'transparent');
        atm.addColorStop(0.55, p.biome.glowColor + Math.round(p.atmOpac * 120).toString(16).padStart(2, '0'));
        atm.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.9; ctx.fillStyle = atm;
        ctx.beginPath(); ctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;

        // Rings
        if (p.hasRings) {
            ctx.save(); ctx.translate(cx, cy); ctx.scale(1, p.ringTilt);
            const ri = r * 1.28, ro = r * 1.9;
            const rg = ctx.createRadialGradient(0, 0, ri, 0, 0, ro);
            rg.addColorStop(0, 'transparent');
            rg.addColorStop(0.2, p.biome.colors[2] + '88');
            rg.addColorStop(0.6, p.biome.colors[3] + 'bb');
            rg.addColorStop(1, 'transparent');
            for (let i = 0; i < 5; i++) {
                ctx.globalAlpha = 0.32 - i * 0.04;
                ctx.strokeStyle = rg; ctx.lineWidth = (ro - ri) / 5;
                ctx.beginPath(); ctx.arc(0, 0, ri + (ro - ri) * (i / 5), 0, Math.PI * 2); ctx.stroke();
            }
            ctx.globalAlpha = 1; ctx.restore();
        }

        // Moons — orbit in flattened ellipses for 3D feel
        for (let m = 0; m < (p.numMoons || 0); m++) {
            const mr = new RNG(p.seed + m * 1777);
            const orbitR = r * (1.45 + mr.range(0.25, 1.05));
            const speed = mr.range(0.35, 1.7) * (m % 2 === 0 ? 1 : -1);
            const phase = mr.range(0, Math.PI * 2);
            const mAngle = this.angle * speed * 0.009 + phase;
            const mx = cx + Math.cos(mAngle) * orbitR;
            const my = cy + Math.sin(mAngle) * orbitR * 0.3;
            const mSize = r * mr.range(0.044, 0.092);
            const mColor = p.biome.colors[mr.int(1, p.biome.colors.length)];
            // Dim when behind the planet (z-sort via sin)
            ctx.globalAlpha = Math.sin(mAngle) < -0.12 ? 0.32 : 1;
            // Glow
            const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mSize * 3);
            mg.addColorStop(0, mColor + '55'); mg.addColorStop(1, 'transparent');
            ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mSize * 3, 0, Math.PI * 2); ctx.fill();
            // Body
            ctx.fillStyle = mColor;
            ctx.beginPath(); ctx.arc(mx, my, mSize, 0, Math.PI * 2); ctx.fill();
            // Sphere shading
            const ms = ctx.createRadialGradient(mx - mSize * 0.3, my - mSize * 0.3, 0, mx, my, mSize);
            ms.addColorStop(0, 'rgba(255,255,255,0.2)'); ms.addColorStop(1, 'rgba(0,0,0,0.6)');
            ctx.fillStyle = ms; ctx.beginPath(); ctx.arc(mx, my, mSize, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // ── Bioluminescence (Oceanic/Psychedelic) ────────────────────────
        if (p.biome.id === 'oceanic' || p.biome.id === 'psychedelic') {
            const bioRng = new RNG(p.seed + 123);
            ctx.save();
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
            for (let i = 0; i < 15; i++) {
                const bAngle = bioRng.range(0, Math.PI * 2) + this.angle * 0.01;
                const bDist = bioRng.range(0, r * 0.95);
                const bx = cx + Math.cos(bAngle) * bDist;
                const by = cy + Math.sin(bAngle) * bDist;
                const bGlow = ctx.createRadialGradient(bx, by, 0, bx, by, 4);
                bGlow.addColorStop(0, p.biome.glowColor + 'aa');
                bGlow.addColorStop(1, 'transparent');
                ctx.fillStyle = bGlow;
                ctx.globalAlpha = 0.5 + Math.sin(this.angle * 0.08 + i) * 0.4;
                ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
            ctx.globalAlpha = 1;
        }
    }

    animate() {
        const loop = () => {
            if (!this.isMobile) {
                this.angle += 0.22;
            }
            this._frame();
            if (!this.isMobile) {
                this.raf = requestAnimationFrame(loop);
            }
        };
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = requestAnimationFrame(loop);
    }
}
