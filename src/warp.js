export class WarpRenderer {
    constructor(canvas) {
        this.cv = canvas;
        this.ctx = canvas.getContext('2d');
        this.raf = null;
        this.t0 = 0;
        this.dur = 1350; // ms
        this.glowColor = '#5b9dff';
        this._resize();
        window.addEventListener('resize', () => this._resize());
    }
    _resize() { this.cv.width = window.innerWidth; this.cv.height = window.innerHeight; }

    trigger(color) {
        this.glowColor = color || '#5b9dff';
        this.t0 = performance.now();
        if (this.isMobile) {
            // No warp animation on mobile, just clear or simple flash
            return;
        }
        this.cv.classList.add('active');
        if (this.raf) cancelAnimationFrame(this.raf);
        this._loop();
    }

    _loop() {
        const elapsed = performance.now() - this.t0;
        const t = Math.min(1, elapsed / this.dur);
        this._draw(t);
        if (t < 1) {
            this.raf = requestAnimationFrame(() => this._loop());
        } else {
            this.cv.classList.remove('active');
            this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
            this.raf = null;
        }
    }

    _draw(t) {
        const ctx = this.ctx, W = this.cv.width, H = this.cv.height;
        const cx = W / 2, cy = H / 2;
        ctx.clearRect(0, 0, W, H);

        // Phase: 0→0.45 = stretch, 0.45→1 = fade out
        const stretch = t < 0.45 ? t / 0.45 : 1 - (t - 0.45) / 0.55;
        const alpha = stretch * 0.75;
        const maxR = Math.hypot(W, H) * 0.7;

        const NUM = 140;
        for (let i = 0; i < NUM; i++) {
            const angle = (i / NUM) * Math.PI * 2;
            const near = 30 * (1 - stretch * 0.6);
            const far = maxR * Math.pow(stretch, 1.4);
            // Vary brightness — every 3rd line brighter
            const bright = i % 3 === 0 ? 1 : 0.28;
            const hex = this.glowColor;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * near, cy + Math.sin(angle) * near);
            ctx.lineTo(cx + Math.cos(angle) * far, cy + Math.sin(angle) * far);
            ctx.strokeStyle = hex;
            ctx.globalAlpha = alpha * bright;
            ctx.lineWidth = i % 5 === 0 ? 2 : 1;
            ctx.stroke();
        }

        // Central white flash at peak (t ≈ 0.45)
        if (t > 0.35 && t < 0.58) {
            const fl = 1 - Math.abs(t - 0.45) / 0.13;
            ctx.globalAlpha = fl * 0.18;
            ctx.fillStyle = '#cce0ff';
            ctx.fillRect(0, 0, W, H);
        }
        ctx.globalAlpha = 1;
    }
}