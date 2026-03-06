import { GLYPHS } from './data.js';
import { generatePlanet } from './planet.js';
import { AudioEngine } from './audio/engine.js';
import { PlanetRenderer } from './renderer.js';
import { Starfield } from './starfield.js';
import { AudioReactiveEcosystem } from './visualizer.js';
import { WarpRenderer } from './warp.js';
import { encodeAddress, decodeAddress } from './ui/shared/address-codec.js';
import { bindAudioEngineControls } from './ui/shared/audio-controls.js';
import { createAudioStateRenderer } from './ui/shared/audio-state-ui.js';
import { createAudioEventConsole } from './ui/shared/audio-event-console.js';
import { fillSlider } from './ui/shared/slider-fill.js';
import { randomAddress } from './ui/shared/address-utils.js';
import { isBookmarked, loadBookmarks, saveBookmarks, toggleBookmark } from './ui/shared/bookmarks.js';
import { resolvePlanetRarity } from './ui/shared/rarity.js';

const ENGINE_MODE_STORAGE_KEY = 'lc_engine_mode';

export class App {
    constructor() {
        this.audio = new AudioEngine(); this.planet = null;
        this.address = ''; this.history = [];
        this.planetR = null; this.waveViz = null; this.starfield = null; this.warpR = null;
        this.isMobile = window.innerWidth <= 950 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        this.chordEl = null;
        this.melodyEls = null;
        this.debugEls = null;
        this.tensionEls = null;
        this._unsubscribeState = null;
        this._renderAudioState = null;
        this._audioConsole = null;
    }

    init() {
        const queryMode = new URLSearchParams(window.location.search).get('engine');
        let storedMode = null;
        try { storedMode = localStorage.getItem(ENGINE_MODE_STORAGE_KEY); } catch { }
        const forcedMode = window.__LC_ENGINE_MODE__ || queryMode || storedMode;
        if (forcedMode === 'v2' || forcedMode === 'v1') {
            this.audio.setEngineMode(forcedMode);
            try { localStorage.setItem(ENGINE_MODE_STORAGE_KEY, forcedMode); } catch { }
        }
        // Canvases
        this.starfield = new Starfield(document.getElementById('bg-canvas'));
        this.starfield.isMobile = this.isMobile;
        this.starfield.animate();

        this.planetR = new PlanetRenderer(document.getElementById('planet-canvas'));
        this.planetR.isMobile = this.isMobile;
        this.planetR.animate();

        this.waveViz = new AudioReactiveEcosystem(
            document.getElementById('waveform-canvas'),
            document.getElementById('viz-mini'),
            document.getElementById('planet-viz-canvas')
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
        document.getElementById('btn-share').addEventListener('click', () => this._copyShareLink());
        document.getElementById('play-btn').addEventListener('click', () => this._togglePlay());

        bindAudioEngineControls({
            getEl: (id) => document.getElementById(id),
            audio: this.audio,
            fillSliderFn: (el) => this._fillSlider(el),
            defaultArpChecked: true,
            onEngineModeChange: (mode) => {
                this.audio.setEngineMode(mode);
                try { localStorage.setItem(ENGINE_MODE_STORAGE_KEY, mode); } catch { }
                if (this.planet && this.audio.playing) {
                    this.audio.crossfadeTo(this.planet, () => this.waveViz.setAnalyser(this.audio.getAnalyser()));
                }
            },
        });
        this.warpR = new WarpRenderer(document.getElementById('warp-canvas'));
        this.warpR.isMobile = this.isMobile;

        // Parse URL hash for sharable planet address
        const hash = window.location.hash.slice(1);
        let initAddr = GLYPHS.slice(0, 6).join('');
        if (hash) {
            // Try decoding as new format first
            const decoded = decodeAddress(hash);
            if (decoded) {
                initAddr = decoded;
            } else {
                // Fallback to old format (direct Unicode)
                try {
                    initAddr = decodeURIComponent(hash);
                } catch (e) {
                    console.warn('Failed to decode URL hash:', e);
                }
            }
        }
        this._setAddress(initAddr);
        this._navigate();

        // Chord polling
        this.chordEl = document.getElementById('chord-display');
        this.melodyEls = {
            display: document.getElementById('melody-display'),
            mode: document.getElementById('mel-mode'),
            len: document.getElementById('mel-len'),
            rest: document.getElementById('mel-rest'),
            bank: document.getElementById('mel-bank'),
        };
        this.debugEls = {
            nodes: document.getElementById('dbg-nodes'),
            load: document.getElementById('dbg-load'),
            step: document.getElementById('dbg-step'),
        };
        this.tensionEls = {
            fill: document.getElementById('tension-fill'),
            icon: document.getElementById('tension-icon'),
        };
        this._renderAudioState = createAudioStateRenderer({
            audio: this.audio,
            elements: {
                chord: this.chordEl,
                melodyDisplay: this.melodyEls.display,
                melMode: this.melodyEls.mode,
                melLen: this.melodyEls.len,
                melRest: this.melodyEls.rest,
                melBank: this.melodyEls.bank,
                dbgNodes: this.debugEls.nodes,
                dbgLoad: this.debugEls.load,
                dbgStep: this.debugEls.step,
                dbgPace: document.getElementById('dbg-pace'),
                dbgHold: document.getElementById('dbg-hold'),
                dbgMicro: document.getElementById('dbg-micro'),
                dbgDroneAud: document.getElementById('dbg-drone-aud'),
                dbgMoonRate: document.getElementById('dbg-moon-rate'),
                tensionFill: this.tensionEls.fill,
                tensionIcon: this.tensionEls.icon,
            },
            options: {
                chordScale: 1.2,
                keepChordTextOnIdle: true,
                chordOpacityPlaying: '0.6',
                chordOpacityIdle: '0',
                melodyDisplayOpacityPlaying: '1',
                melodyDisplayOpacityIdle: '0.55',
                motifEnabledColor: 'var(--planet-glow)',
                motifDisabledColor: 'var(--text-secondary)',
                standbyTextColor: 'var(--text-secondary)',
                accentColor: 'var(--accent)',
            },
        });
        this._audioConsole = createAudioEventConsole({
            audio: this.audio,
            outputEl: document.getElementById('audio-console'),
            clearBtnEl: document.getElementById('audio-console-clear'),
        });
        this._unsubscribeState = this.audio.subscribeState((state) => this._updateAudioUI(state));
        window.addEventListener('beforeunload', () => {
            if (this._unsubscribeState) this._unsubscribeState();
            if (this._audioConsole) this._audioConsole.dispose();
        });
    }

    _updateAudioUI(state = null) {
        if (this._renderAudioState) this._renderAudioState(state);
        if (this._audioConsole) this._audioConsole.onState(state);
    }

    _fillSlider(el) {
        fillSlider(el);
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
        this._setAddress(randomAddress());
    }

    _navigate() {
        if (!this.address) this._randomAddress();
        const planet = generatePlanet(this.address);
        this.planet = planet;

        // Warp animation tied to biome color
        if (this.warpR) this.warpR.trigger(planet.biome.glowColor);
        // Navigation transition effect through public engine API.
        if (this.audio.playing && typeof this.audio.triggerNavigationFx === 'function') {
            this.audio.triggerNavigationFx();
        }

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

        // Synth additions
        const droneEl = document.getElementById('info-drone');
        if (droneEl) droneEl.textContent = planet.ac?.droneWave?.replace('_', ' ').toUpperCase() || '—';
        const padEl = document.getElementById('info-pad');
        if (padEl) padEl.textContent = planet.ac?.padWave?.replace('_', ' ').toUpperCase() || '—';
        const voicesEl = document.getElementById('info-voices');
        if (voicesEl) voicesEl.textContent = planet.ac?.melodyWaves?.join(', ').replace(/_/g, ' ').toUpperCase() || '—';
        const chordAudEl = document.getElementById('info-chord-aud');
        if (chordAudEl) chordAudEl.textContent = `${Math.round((planet.ac?.chordAudibility || 0) * 100)}%`;

        const atmoEl = document.getElementById('info-atmo');
        if (atmoEl) atmoEl.textContent = planet.biome.atmosphere;
        const revEl = document.getElementById('info-reverb');
        if (revEl) revEl.textContent = planet.biome.reverbLabel;
        const descEl = document.getElementById('planet-desc');
        if (descEl) descEl.textContent = planet.biome.desc;
        const moonsEl = document.getElementById('info-moons');
        if (moonsEl) {
            if (!planet.numMoons) {
                moonsEl.textContent = 'NONE';
            } else {
                const moonDensity = Math.round((planet.moonSystem?.density || 0) * 100);
                moonsEl.textContent = `${planet.numMoons} SATELLITE${planet.numMoons > 1 ? 'S' : ''} | DENS ${moonDensity}%`;
            }
        }

        // Sector · System · Planet coordinate split
        const glyphs = [...this.address];
        const third = Math.max(1, Math.floor(glyphs.length / 3));
        document.getElementById('info-coords').textContent =
            `${glyphs.slice(0, third).join('') || '?'} · ${glyphs.slice(third, third * 2).join('') || '?'} · ${glyphs.slice(third * 2).join('') || '?'}`;

        // Rarity class
        const rarity = resolvePlanetRarity(planet, this.address);
        const rarityEl = document.getElementById('info-rarity');
        rarityEl.textContent = rarity.label;
        rarityEl.className = `rarity-tag ${rarity.className}`;

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

        // URL hash — makes every planet a shareable link (using compact encoding)
        window.location.hash = encodeAddress(this.address);

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

    _loadBookmarks() { return loadBookmarks(); }
    _saveBookmarks(bm) { saveBookmarks(bm); }

    _toggleBookmark() {
        const bm = this._loadBookmarks();
        const next = toggleBookmark(bm, {
            address: this.address,
            name: this.planet ? this.planet.pname : '?',
            biomeId: this.planet ? this.planet.biome.id : '',
        });
        this._saveBookmarks(next);
        this._renderBookmarks();
        this._syncBookmarkBtn();
    }

    _syncBookmarkBtn() {
        const btn = document.getElementById('btn-bookmark');
        if (!btn) return;
        const saved = isBookmarked(this._loadBookmarks(), this.address);
        btn.textContent = saved ? '★ SAVED' : '☆ SAVE';
        btn.classList.toggle('saved', saved);
    }

    _copyShareLink() {
        const url = window.location.href;
        const icon = document.getElementById('share-icon');
        const text = document.getElementById('share-text');
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                // Success feedback
                if (icon) icon.textContent = '✓';
                if (text) text.textContent = 'COPIED!';
                setTimeout(() => {
                    if (icon) icon.textContent = '🔗';
                    if (text) text.textContent = 'COPY LINK';
                }, 2000);
            }).catch(err => {
                console.warn('Failed to copy:', err);
                this._fallbackCopy(url);
            });
        } else {
            this._fallbackCopy(url);
        }
    }

    _fallbackCopy(text) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            const icon = document.getElementById('share-icon');
            const textEl = document.getElementById('share-text');
            if (icon) icon.textContent = '✓';
            if (textEl) textEl.textContent = 'COPIED!';
            setTimeout(() => {
                if (icon) icon.textContent = '🔗';
                if (textEl) textEl.textContent = 'COPY LINK';
            }, 2000);
        } catch (err) {
            console.warn('Fallback copy failed:', err);
        }
        document.body.removeChild(textarea);
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




