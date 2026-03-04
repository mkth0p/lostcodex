import { GLYPHS } from './data.js';
import { RNG } from './rng.js';
import { generatePlanet } from './planet.js';
import { AudioEngine } from './audio.js';
import { PlanetRenderer } from './renderer.js';
import { Starfield } from './starfield.js';
import { AudioReactiveEcosystem } from './visualizer.js';
import { WarpRenderer } from './warp.js';
export class App {
    constructor() {
        this.audio = new AudioEngine(); this.planet = null;
        this.address = ''; this.history = [];
        this.planetR = null; this.waveViz = null; this.starfield = null; this.warpR = null;
        this.isMobile = window.innerWidth <= 950 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        this.chordEl = null;
    }

    init() {
        // Canvases
        this.starfield = new Starfield(document.getElementById('bg-canvas'));
        this.starfield.isMobile = this.isMobile;
        this.starfield.animate();

        this.planetR = new PlanetRenderer(document.getElementById('planet-canvas'));
        this.planetR.isMobile = this.isMobile;
        this.planetR.animate();

        this.waveViz = new AudioReactiveEcosystem(
            document.getElementById('waveform-canvas'),
            document.getElementById('viz-mini')
        );
        this.waveViz.isMobile = this.isMobile;
        this.waveViz.animate();

        // Glyph keyboard
        const kb = document.getElementById('glyph-keyboard');
        GLYPHS.forEach(g => {
            const btn = document.createElement('button');
            btn.className = 'glyph-key'; btn.textContent = g;
            btn.addEventListener('click', () => this._addGlyph(g));
            kb.appendChild(btn);
        });

        // Keyboard input (a-z maps to glyphs)
        document.addEventListener('keydown', e => {
            if (e.key === 'Backspace') { e.preventDefault(); this._removeGlyph(); return; }
            if (e.key === 'Enter') { this._navigate(); return; }
            const gi = GLYPHS.indexOf(e.key);
            if (gi >= 0) { this._addGlyph(e.key); return; }
            if (/^[a-z]$/i.test(e.key)) {
                const ci = e.key.toLowerCase().charCodeAt(0) - 97;
                if (ci < GLYPHS.length) this._addGlyph(GLYPHS[ci]);
            }
        });

        // Buttons
        document.getElementById('btn-clear').addEventListener('click', () => this._clearAddress());
        document.getElementById('btn-random').addEventListener('click', () => this._randomAddress());
        document.getElementById('btn-navigate').addEventListener('click', () => this._navigate());
        document.getElementById('btn-bookmark').addEventListener('click', () => this._toggleBookmark());
        document.getElementById('play-btn').addEventListener('click', () => this._togglePlay());

        // Sliders
        const sl = id => {
            const el = document.getElementById(id);
            this._fillSlider(el);
            return el;
        };
        sl('ctrl-vol').addEventListener('input', e => { this.audio.setVolume(+e.target.value); this._fillSlider(e.target); });
        sl('ctrl-reverb').addEventListener('input', e => { this.audio.setReverb(+e.target.value); this._fillSlider(e.target); });
        sl('ctrl-drift').addEventListener('input', e => { this.audio._drift = +e.target.value; this._fillSlider(e.target); });
        sl('ctrl-density').addEventListener('input', e => { this.audio._density = +e.target.value; this._fillSlider(e.target); });
        sl('ctrl-eq-low').addEventListener('input', e => {
            if (this.audio.eqLow) this.audio.eqLow.gain.value = +e.target.value;
            this._fillSlider(e.target);
        });
        sl('ctrl-eq-mid').addEventListener('input', e => {
            if (this.audio.eqMid) this.audio.eqMid.gain.value = +e.target.value;
            this._fillSlider(e.target);
        });
        sl('ctrl-eq-high').addEventListener('input', e => {
            if (this.audio.eqHigh) this.audio.eqHigh.gain.value = +e.target.value;
            this._fillSlider(e.target);
        });
        document.getElementById('ctrl-granular').addEventListener('change', e => {
            this.audio._granularEnabled = e.target.checked;
            // Live toggle: ramp the dedicated granular bus smoothly —
            // grains keep running silently when off, unmuting is instant
            if (this.audio._granularBus && this.audio.ctx) {
                const g = this.audio._granularBus.gain;
                const now = this.audio.ctx.currentTime;
                g.cancelScheduledValues(now);
                g.setValueAtTime(g.value, now);
                g.linearRampToValueAtTime(e.target.checked ? 1 : 0, now + 1.5);
            }
        });
        document.getElementById('ctrl-perc').addEventListener('change', e => {
            this.audio._percussionEnabled = e.target.checked;
            // Live toggle: ramp the percBus gain to mute/unmute without restarting
            if (this.audio._percBus && this.audio.ctx) {
                const g = this.audio._percBus.gain;
                const now = this.audio.ctx.currentTime;
                g.cancelScheduledValues(now);
                g.setValueAtTime(g.value, now);
                g.linearRampToValueAtTime(e.target.checked ? this.audio._percVol : 0, now + 0.2);
            }
        });

        sl('ctrl-perc-vol').addEventListener('input', e => {
            this.audio._percVol = +e.target.value;
            if (this.audio._percussionEnabled && this.audio._percBus && this.audio.ctx) {
                const g = this.audio._percBus.gain;
                const now = this.audio.ctx.currentTime;
                g.cancelScheduledValues(now);
                g.setValueAtTime(g.value, now);
                g.linearRampToValueAtTime(this.audio._percVol, now + 0.1);
            }
            this._fillSlider(e.target);
        });

        // ── Melody feature toggles ──────────────────────────────────────────
        document.getElementById('ctrl-chords').addEventListener('change', e => {
            this.audio._chordEnabled = e.target.checked;
        });
        document.getElementById('ctrl-arp').addEventListener('change', e => {
            this.audio._arpEnabled = e.target.checked;
        });
        document.getElementById('ctrl-bend').addEventListener('change', e => {
            this.audio._pitchBendEnabled = e.target.checked;
        });
        document.getElementById('ctrl-motif').addEventListener('change', e => {
            this.audio._motifEnabled = e.target.checked;
        });

        // ── Rhythm feature toggles ──────────────────────────────────────────
        document.getElementById('ctrl-ghost').addEventListener('change', e => {
            this.audio._ghostEnabled = e.target.checked;
        });
        document.getElementById('ctrl-fills').addEventListener('change', e => {
            this.audio._fillsEnabled = e.target.checked;
        });

        this.warpR = new WarpRenderer(document.getElementById('warp-canvas'));
        this.warpR.isMobile = this.isMobile;

        // Parse URL hash for sharable planet address
        const hash = window.location.hash.slice(1);
        const initAddr = hash ? decodeURIComponent(hash) : 'ᚠᚢᚦᚨᚱᚲ';
        this._setAddress(initAddr);
        this._navigate();

        // Chord polling
        this.chordEl = document.getElementById('chord-display');
        setInterval(() => this._updateChordUI(), 100);
    }

    _updateChordUI() {
        if (!this.chordEl) return;
        if (this.audio.playing) {
            const chord = this.audio.getChord();
            if (this.chordEl.textContent !== chord) {
                this.chordEl.textContent = chord;
                this.chordEl.style.transform = 'scale(1.2)';
                setTimeout(() => this.chordEl.style.transform = 'scale(1)', 100);
            }
            this.chordEl.style.opacity = '0.6';
        } else {
            this.chordEl.style.opacity = '0';
        }
    }

    _fillSlider(el) {
        const pct = ((el.value - el.min) / (el.max - el.min)) * 100;

        // Bipolar sliders (EQ) fill from center
        if (el.min < 0 && el.max > 0) {
            const center = 50;
            if (pct > center) {
                el.style.background = `linear-gradient(to right, rgba(91,157,255,0.2) 50%, var(--accent) 50%, var(--accent) ${pct}%, rgba(91,157,255,0.2) ${pct}%)`;
            } else {
                el.style.background = `linear-gradient(to right, rgba(91,157,255,0.2) ${pct}%, var(--accent) ${pct}%, var(--accent) 50%, rgba(91,157,255,0.2) 50%)`;
            }
        } else {
            // Unipolar sliders fill from left
            el.style.background = `linear-gradient(to right,var(--accent) ${pct}%,rgba(91,157,255,0.2) ${pct}%)`;
        }
    }

    _addGlyph(g) { this.address += g; this._syncAddress(); }
    _removeGlyph() { this.address = [...this.address].slice(0, -1).join(''); this._syncAddress(); }
    _clearAddress() { this.address = ''; this._syncAddress(); }
    _setAddress(a) { this.address = a; this._syncAddress(); }

    _syncAddress() {
        // Only update the typing input display — NOT the header location
        document.getElementById('address-text').textContent = this.address;
    }

    _randomAddress() {
        const rng = new RNG((Date.now() ^ (Math.random() * 0xFFFFFF | 0)) >>> 0);
        let a = ''; for (let i = 0; i < rng.int(5, 18); i++) a += rng.pick(GLYPHS);
        this._setAddress(a);
    }

    _navigate() {
        if (!this.address) this._randomAddress();
        const planet = generatePlanet(this.address);
        this.planet = planet;

        // Warp animation tied to biome color
        if (this.warpR) this.warpR.trigger(planet.biome.glowColor);
        // Doppler whoosh on navigation (Tier 3)
        if (this.audio.playing) this.audio._dopplerWhoosh();

        // Update header location (only on confirmed navigation)
        const s = [...this.address].slice(0, 22).join('') + (this.address.length > 22 ? '…' : '');
        document.getElementById('addr-short').textContent = s || '—';

        // Apply biome CSS class
        document.documentElement.className = `biome-${planet.biome.id}`;

        // Planet render
        this.planetR.load(planet);

        // Info panel
        document.getElementById('planet-name').textContent = planet.pname.toUpperCase();
        document.getElementById('planet-designation').textContent = planet.designation;
        document.getElementById('info-biome').textContent = planet.biome.name;
        document.getElementById('info-sonic').textContent = planet.biome.soundProfile;
        document.getElementById('info-freq').textContent = `${planet.rootFreq.toFixed(1)} Hz`;
        document.getElementById('info-scale').textContent = planet.scaleName;
        const tuningEl = document.getElementById('info-tuning');
        if (tuningEl) tuningEl.textContent = planet.tuningSystem + (planet.quarterToneProb > 0 ? ' · μTONE' : '') + (planet.octaveStretch > 1.001 ? ' · STRETCH' : '');
        document.getElementById('info-atmo').textContent = planet.biome.atmosphere;
        document.getElementById('info-reverb').textContent = planet.biome.reverbLabel;
        document.getElementById('planet-desc').textContent = planet.biome.desc;
        document.getElementById('info-moons').textContent = planet.numMoons === 0 ? 'NONE' : `${planet.numMoons} SATELLITE${planet.numMoons > 1 ? 'S' : ''}`;

        // Sector · System · Planet coordinate split
        const glyphs = [...this.address];
        const third = Math.max(1, Math.floor(glyphs.length / 3));
        document.getElementById('info-coords').textContent =
            `${glyphs.slice(0, third).join('') || '?'} · ${glyphs.slice(third, third * 2).join('') || '?'} · ${glyphs.slice(third * 2).join('') || '?'}`;

        // Rarity class
        const len = glyphs.length;
        const RARITY = len <= 3 ? 'common' : len <= 6 ? 'standard' : len <= 10 ? 'uncommon' : len <= 15 ? 'rare' : 'anomalous';
        const rarityEl = document.getElementById('info-rarity');
        rarityEl.textContent = RARITY.toUpperCase();
        rarityEl.className = `rarity-tag rarity-${RARITY}`;

        const st = document.getElementById('info-sonic');
        st.style.borderColor = planet.biome.glowColor;
        st.style.color = planet.biome.glowColor;

        // Sync bookmark button state
        this._syncBookmarkBtn();

        // Overlay name
        const on = document.getElementById('planet-overlay-name');
        on.textContent = planet.pname.toUpperCase();
        on.classList.remove('visible');
        setTimeout(() => on.classList.add('visible'), 850);

        // Waveform colour + oscilloscope mode
        this.waveViz.setColor(planet.biome.glowColor);
        this.waveViz.setBiome(planet.biome.id);

        // History
        if (!this.history.includes(this.address)) {
            this.history.unshift(this.address);
            if (this.history.length > 9) this.history.pop();
            this._renderHistory();
        }

        // URL hash — makes every planet a shareable link
        window.location.hash = encodeURIComponent(this.address);

        // Crossfade audio if playing, else just record new planet
        if (this.audio.playing) {
            this.audio.crossfadeTo(planet, () => this.waveViz.setAnalyser(this.audio.getAnalyser()));
        }
    }

    _renderHistory() {
        const el = document.getElementById('history-chips');
        el.innerHTML = '';
        this.history.forEach(addr => {
            const chip = document.createElement('span');
            chip.className = 'history-chip'; chip.title = addr;
            chip.textContent = [...addr].slice(0, 7).join('') + (addr.length > 7 ? '…' : '');
            chip.addEventListener('click', () => { this._setAddress(addr); this._navigate(); });
            el.appendChild(chip);
        });
    }

    _loadBookmarks() { try { return JSON.parse(localStorage.getItem('hc-bookmarks') || '[]'); } catch (e) { return []; } }
    _saveBookmarks(bm) { localStorage.setItem('hc-bookmarks', JSON.stringify(bm)); }

    _toggleBookmark() {
        const bm = this._loadBookmarks();
        const idx = bm.findIndex(b => b.address === this.address);
        if (idx >= 0) bm.splice(idx, 1);
        else {
            bm.unshift({ address: this.address, name: this.planet ? this.planet.pname : '?', biomeId: this.planet ? this.planet.biome.id : '' });
            if (bm.length > 20) bm.pop();
        }
        this._saveBookmarks(bm);
        this._renderBookmarks();
        this._syncBookmarkBtn();
    }

    _syncBookmarkBtn() {
        const btn = document.getElementById('btn-bookmark');
        if (!btn) return;
        const saved = this._loadBookmarks().some(b => b.address === this.address);
        btn.textContent = saved ? '★ SAVED' : '☆ SAVE';
        btn.classList.toggle('saved', saved);
    }

    _renderBookmarks() {
        const el = document.getElementById('bookmark-chips');
        if (!el) return;
        const bm = this._loadBookmarks();
        el.innerHTML = '';
        if (!bm.length) { el.innerHTML = '<span class="no-history">No bookmarks yet.</span>'; return; }
        bm.forEach(b => {
            const chip = document.createElement('span');
            chip.className = 'bookmark-chip';
            chip.title = (b.name || '?') + ' — ' + b.address;
            chip.textContent = [...b.address].slice(0, 7).join('') + (b.address.length > 7 ? '…' : '');
            chip.addEventListener('click', () => { this._setAddress(b.address); this._navigate(); });
            el.appendChild(chip);
        });
    }

    _togglePlay() {
        if (this._playPending) return; // Prevent double-click race
        const btn = document.getElementById('play-btn');
        const dot = document.getElementById('status-dot');
        const txt = document.getElementById('status-text');
        if (this.audio.playing) {
            this.audio.stop();
            btn.textContent = '▶'; btn.classList.remove('playing');
            dot.className = 'status-dot'; txt.textContent = 'STANDBY';
        } else {
            this._playPending = true;
            if (!this.planet) this._navigate();
            // Update UI immediately, defer heavy audio work
            btn.textContent = '■'; btn.classList.add('playing');
            dot.className = 'status-dot loading'; txt.textContent = 'INITIATING…';
            setTimeout(() => {
                requestAnimationFrame(() => {
                    this.audio.start(this.planet);
                    this.waveViz.setAnalyser(this.audio.getAnalyser());
                    dot.className = 'status-dot playing'; txt.textContent = 'TRANSMITTING';
                    this._playPending = false;
                });
            }, 180);
        }
    }
}