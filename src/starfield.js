export class Starfield {
    constructor(canvas) {
        this.cv = canvas; this.ctx = canvas.getContext('2d');
        this.stars = []; this.nebula = []; this.raf = null;
        this._init();
        window.addEventListener('resize', () => this._init());
    }
    _init() {
        const W = window.innerWidth, H = window.innerHeight;
        this.cv.width = W; this.cv.height = H;
        const starCount = this.isMobile ? 120 : 300;
        const nebulaCount = this.isMobile ? 3 : 7;
        this.stars = Array.from({ length: starCount }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.2, a: Math.random(), phase: Math.random() * Math.PI * 2, spd: Math.random() * 0.002 + 0.0004 }));
        this.nebula = Array.from({ length: nebulaCount }, () => ({ x: Math.random() * W, y: Math.random() * H, rx: Math.random() * 320 + 100, ry: Math.random() * 200 + 80, a: Math.random() * 0.04 + 0.007, hue: Math.floor(Math.random() * 70) + 200 }));
    }
    draw(t) {
        const cv = this.cv, ctx = this.ctx, W = cv.width, H = cv.height;
        ctx.clearRect(0, 0, W, H);
        this.nebula.forEach(nb => {
            ctx.save(); ctx.scale(1, nb.ry / nb.rx);
            const g = ctx.createRadialGradient(nb.x, nb.y * (nb.rx / nb.ry), 0, nb.x, nb.y * (nb.rx / nb.ry), nb.rx);
            g.addColorStop(0, `hsla(${nb.hue},65%,35%,${nb.a})`); g.addColorStop(1, 'transparent');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(nb.x, nb.y * (nb.rx / nb.ry), nb.rx, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });
        this.stars.forEach(s => {
            ctx.globalAlpha = s.a * (0.4 + 0.6 * Math.sin(t * s.spd * 1000 + s.phase));
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
    }
    animate() {
        const loop = t => {
            this.draw(t / 1000);
            if (this.isMobile) {
                this.raf = null; // No loop on mobile
                return;
            }
            this.raf = requestAnimationFrame(loop);
        };
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = requestAnimationFrame(loop);
    }
}
