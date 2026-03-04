import { GLYPHS } from './data.js';
import { RNG } from './rng.js';
import { generatePlanet } from './planet.js';
import { AudioEngine } from './audio.js';
import { PlanetRenderer } from './renderer.js';
import { Starfield } from './starfield.js';
import { AudioReactiveEcosystem } from './visualizer.js';
import { WarpRenderer } from './warp.js';

// URL-friendly address encoding/decoding
function encodeAddress(address) {
    // Convert glyphs to indices, then to base36 string
    const indices = [...address].map(g => {
        const idx = GLYPHS.indexOf(g);
        return idx === -1 ? 0 : idx;
    });
    // Join with dashes for readability: e.g., "0-1-2-3-4-5"
    return indices.map(i => i.toString(36)).join('');
}

function decodeAddress(encoded) {
    if (!encoded) return '';
    try {
        // Parse compact base36 string back to indices
        const indices = [];
        for (let i = 0; i < encoded.length; i++) {
            const idx = parseInt(encoded[i], 36);
            if (!isNaN(idx) && idx >= 0 && idx < GLYPHS.length) {
                indices.push(idx);
            }
        }
        return indices.map(i => GLYPHS[i]).join('');
    } catch (e) {
        return '';
    }
}

export class App {
    constructor() {
        this.audio = new AudioEngine(); this.planet = null;
        this.address = ''; this.history = [];
        this.planetR = null; this.waveViz = null; this.starfield = null; this.warpR = null;
        this.isMobile = window.innerWidth <= 950 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        this.chordEl = null;
        this.melodyEls = null;
        this.debugEls = null;
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
        document.getElementById('ctrl-arp').checked = this.audio._arpEnabled;

        this.warpR = new WarpRenderer(document.getElementById('warp-canvas'));
        this.warpR.isMobile = this.isMobile;

        // Parse URL hash for sharable planet address
        const hash = window.location.hash.slice(1);
        let initAddr = 'ᚠᚢᚦᚨᚱᚲ';
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
        setInterval(() => this._updateAudioUI(), 100);
    }

    _updateAudioUI() {
        const melDisplay = this.melodyEls?.display;
        const melModeEl = this.melodyEls?.mode;
        const melLenEl = this.melodyEls?.len;
        const melRestEl = this.melodyEls?.rest;
        const melBankEl = this.melodyEls?.bank;
        const dbgNodesEl = this.debugEls?.nodes;
        const dbgLoadEl = this.debugEls?.load;
        const dbgStepEl = this.debugEls?.step;

        if (this.audio.playing) {
            const chord = this.audio.getChord();
            if (this.chordEl && this.chordEl.textContent !== chord) {
                this.chordEl.textContent = chord;
                this.chordEl.style.transform = 'scale(1.2)';
                setTimeout(() => this.chordEl.style.transform = 'scale(1)', 100);
            }
            if (this.chordEl) this.chordEl.style.opacity = '0.6';

            const melody = this.audio.getMelodyState();
            const debug = this.audio.getDebugState();
            if (melDisplay) melDisplay.style.opacity = '1';
            if (melLenEl) melLenEl.textContent = `${melody.phraseLength}`;
            if (melRestEl) melRestEl.textContent = `${Math.round(melody.restProb * 100)}%`;
            if (dbgNodesEl) dbgNodesEl.textContent = `${debug.activeNodes}`;
            if (dbgLoadEl) dbgLoadEl.textContent = `${Math.round(debug.load * 100)}%`;
            if (dbgStepEl) dbgStepEl.textContent = debug.stepMs
                ? `${debug.tensionPhase} | ${debug.cycleSteps}/${debug.stepMs}ms`
                : '--';
            if (melBankEl) {
                melBankEl.textContent = melody.motifEnabled
                    ? (melody.motifCount ? `${melody.motifIndex}/${melody.motifCount}` : '--')
                    : 'OFF';
                melBankEl.style.color = melody.motifEnabled ? 'var(--planet-glow)' : 'var(--text-secondary)';
            }
            if (melModeEl) {
                melModeEl.textContent = melody.mode;
                if (melody.mode === 'RESPONSE') {
                    melModeEl.style.background = 'rgba(255, 157, 91, 0.18)';
                    melModeEl.style.color = '#ff9d5b';
                    melModeEl.style.borderColor = 'rgba(255, 157, 91, 0.45)';
                } else if (melody.mode === 'MOTIF') {
                    melModeEl.style.background = 'rgba(157, 255, 91, 0.18)';
                    melModeEl.style.color = '#9dff5b';
                    melModeEl.style.borderColor = 'rgba(157, 255, 91, 0.45)';
                } else {
                    melModeEl.style.background = 'rgba(91, 157, 255, 0.16)';
                    melModeEl.style.color = 'var(--accent)';
                    melModeEl.style.borderColor = 'rgba(91, 157, 255, 0.35)';
                }
            }
        } else {
            if (this.chordEl) this.chordEl.style.opacity = '0';
            if (melDisplay) melDisplay.style.opacity = '0.55';
            if (melLenEl) melLenEl.textContent = '0';
            if (melRestEl) melRestEl.textContent = '5%';
            if (dbgNodesEl) dbgNodesEl.textContent = '0';
            if (dbgLoadEl) dbgLoadEl.textContent = '0%';
            if (dbgStepEl) dbgStepEl.textContent = '--';
            if (melBankEl) {
                melBankEl.textContent = '--';
                melBankEl.style.color = 'var(--text-secondary)';
            }
            if (melModeEl) {
                melModeEl.textContent = 'STANDBY';
                melModeEl.style.background = 'rgba(255, 255, 255, 0.05)';
                melModeEl.style.color = 'var(--text-secondary)';
                melModeEl.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            }
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
        if (moonsEl) moonsEl.textContent = planet.numMoons === 0 ? 'NONE' : `${planet.numMoons} SATELLITE${planet.numMoons > 1 ? 'S' : ''}`;

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
