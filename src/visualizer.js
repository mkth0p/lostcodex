export class AudioReactiveEcosystem {
    constructor(main, mini, planetOverlay) {
        this.main = main; this.mini = mini; this.planetOverlay = planetOverlay;
        this.analyser = null; this.color = '#5b9dff';
        this.biomeId = 'barren'; this.raf = null;
        this.particles = [];
        this.phase = 0;
        this._initParticles();
    }

    _initParticles() {
        this.particles = [];
        for (let i = 0; i < 60; i++) {
            this.particles.push({
                x: Math.random(), y: Math.random(),
                vx: (Math.random() - 0.5) * 0.005, vy: (Math.random() - 0.5) * 0.005,
                life: Math.random(),
                size: Math.random() * 2 + 0.5
            });
        }
    }

    setAnalyser(a) { this.analyser = a; }
    setColor(c) { this.color = c; }
    setBiome(id) {
        this.biomeId = id;
        this._initParticles();
    }

    _draw(cv) {
        if (!cv) return;
        const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
        ctx.clearRect(0, 0, W, H);

        // Always draw particle sway background
        this._drawParticleBackground(ctx, W, H);

        if (!this.analyser) return;

        const freqBuf = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(freqBuf);
        this.phase += 0.02;

        // Split frequencies into Low (kick/sub), Mid (chords/melody), High (hats/grains)
        let low = 0, mid = 0, high = 0;
        const len = freqBuf.length;
        for (let i = 0; i < 4; i++) low += freqBuf[i];
        for (let i = 4; i < 20; i++) mid += freqBuf[i];
        for (let i = 40; i < 100; i++) high += freqBuf[i];

        low = (low / (4 * 255));
        mid = (mid / (16 * 255));
        high = (high / (60 * 255));

        const cx = W / 2, cy = H / 2;
        const c = this.color;

        ctx.shadowColor = c;
        ctx.shadowBlur = 10;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Biome-specific reactive geometry
        if (this.biomeId === 'volcanic' || this.biomeId === 'corrupted') {
            // Aggressive geometric spikes that shoot out on drum kicks (Low freq)
            ctx.fillStyle = c;
            ctx.globalAlpha = 0.8;
            const spikes = 12;
            ctx.beginPath();
            for (let i = 0; i < spikes; i++) {
                const angle = (i / spikes) * Math.PI * 2 + this.phase * 0.5;
                const rInner = 10 + mid * 20;
                // Kick drum drives the spike length
                const rOuter = 20 + low * 80 + (Math.random() * high * 20);

                const ix = cx + Math.cos(angle) * rInner;
                const iy = cy + Math.sin(angle) * rInner;
                const ox = cx + Math.cos(angle + Math.PI / spikes) * rOuter;
                const oy = cy + Math.sin(angle + Math.PI / spikes) * rOuter;

                if (i === 0) ctx.moveTo(ix, iy); else ctx.lineTo(ix, iy);
                ctx.lineTo(ox, oy);
            }
            ctx.closePath();
            ctx.fill();

            // Glitch horizontal tear lines on high hats/noise
            if (high > 0.1) {
                ctx.strokeStyle = c;
                ctx.lineWidth = 1 + high * 3;
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const y = cy + (Math.random() - 0.5) * H;
                    ctx.moveTo(0, y);
                    ctx.lineTo(W, y + (Math.random() - 0.5) * 10);
                }
                ctx.stroke();
            }

        } else if (this.biomeId === 'oceanic' || this.biomeId === 'ethereal') {
            // Smooth expanding ripples driven by mids, scattering particles on high
            ctx.strokeStyle = c;
            ctx.globalAlpha = 0.6;

            // Central breathing orb
            const orbR = 15 + mid * 40 + low * 20;
            ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
            ctx.lineWidth = 2 + low * 4; ctx.stroke();

            // Expanding ripples
            const rippleSteps = 4;
            for (let i = 0; i < rippleSteps; i++) {
                const rScale = ((this.phase + i * (Math.PI * 2 / rippleSteps)) % (Math.PI * 2)) / (Math.PI * 2);
                ctx.globalAlpha = (1 - rScale) * 0.5 * (1 + high);
                ctx.beginPath();
                ctx.arc(cx, cy, orbR + rScale * 100, 0, Math.PI * 2);
                ctx.lineWidth = 1; ctx.stroke();
            }

            // High freq triggers particles
            ctx.fillStyle = c;
            this.particles.forEach(p => {
                p.x += Math.cos(p.life) * high * 0.05;
                p.y += Math.sin(p.life) * high * 0.05;
                p.life += 0.05;
                if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
                if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;

                ctx.globalAlpha = p.life % 1;
                ctx.beginPath();
                ctx.arc(p.x * W, p.y * H, 1 + high * 4, 0, Math.PI * 2);
                ctx.fill();
            });

        } else {
            // Desert / Organic / Crystalline: Mandala / Sacred Geometry
            ctx.strokeStyle = c;
            ctx.globalAlpha = 0.7;
            const petals = this.biomeId === 'crystalline' ? 6 : (this.biomeId === 'organic' ? 8 : 5);

            ctx.translate(cx, cy);
            ctx.rotate(this.phase * 0.2);

            for (let j = 0; j < 3; j++) {
                const layerScale = 1 + j * 0.5 + low * 0.5;
                ctx.lineWidth = (3 - j) + mid * 2;
                ctx.beginPath();
                for (let i = 0; i <= 100; i++) {
                    const t = (i / 100) * Math.PI * 2;
                    // Petal math driven by high freqs for complexity
                    const r = 10 * layerScale + Math.sin(t * petals) * (15 + mid * 30 + high * 10);
                    const x = Math.cos(t) * r;
                    const y = Math.sin(t) * r;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.rotate(mid * 0.1); // Twist layers by mid frequencies
            }
            ctx.resetTransform();
        }

        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    _drawParticleBackground(ctx, W, H) {
        // Gentle particle sway effect for ambient background
        ctx.save();
        this.phase += 0.008;
        
        this.particles.forEach(p => {
            // Sway motion
            p.x += p.vx + Math.sin(this.phase + p.life) * 0.0002;
            p.y += p.vy + Math.cos(this.phase + p.life * 0.7) * 0.0002;
            p.life += 0.01;
            
            // Wrap around edges
            if (p.x < 0) p.x = 1;
            if (p.x > 1) p.x = 0;
            if (p.y < 0) p.y = 1;
            if (p.y > 1) p.y = 0;
            
            const px = p.x * W;
            const py = p.y * H;
            const opacity = 0.15 + Math.sin(p.life * 0.5) * 0.1;
            
            // Draw particle with glow
            const glow = ctx.createRadialGradient(px, py, 0, px, py, p.size * 4);
            glow.addColorStop(0, `${this.color}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`);
            glow.addColorStop(0.5, `${this.color}22`);
            glow.addColorStop(1, 'transparent');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(px, py, p.size * 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Core
            ctx.fillStyle = `${this.color}${Math.floor(opacity * 200).toString(16).padStart(2, '0')}`;
            ctx.beginPath();
            ctx.arc(px, py, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.restore();
    }

    animate() {
        const loop = () => {
            this._draw(this.main);
            this._draw(this.mini);
            if (this.planetOverlay) {
                // Resize planet overlay canvas to match its container
                const po = this.planetOverlay;
                if (po.offsetWidth !== po.width || po.offsetHeight !== po.height) {
                    po.width = po.offsetWidth;
                    po.height = po.offsetHeight;
                }
                this._draw(this.planetOverlay);
            }
            if (!this.isMobile) {
                this.raf = requestAnimationFrame(loop);
            }
        };
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = requestAnimationFrame(loop);
    }
}