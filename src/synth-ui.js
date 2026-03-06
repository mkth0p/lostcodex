import { AudioEngine } from './audio/engine.js';
import { generatePlanet } from './planet.js';
import { GLYPHS } from './data.js';
import { decodeAddress, encodeAddress } from './ui/shared/address-codec.js';
import { randomAddress as buildRandomAddress } from './ui/shared/address-utils.js';
import { isBookmarked, loadBookmarks, saveBookmarks, toggleBookmark } from './ui/shared/bookmarks.js';
import { bindAudioEngineControls, syncDroneUiToPlanet } from './ui/shared/audio-controls.js';
import { createAudioStateRenderer } from './ui/shared/audio-state-ui.js';
import { createAudioEventConsole } from './ui/shared/audio-event-console.js';
import { fillSlider } from './ui/shared/slider-fill.js';
import { resolvePlanetRarity } from './ui/shared/rarity.js';

const DEFAULT_ADDRESS = GLYPHS.slice(0, 6).join('');
const ENGINE_MODE_STORAGE_KEY = 'lc_engine_mode';

const audio = new AudioEngine();
let planet = null;
let address = '';
let history = [];
let playPending = false;
let exportJob = null;
let unsubscribeState = null;
let renderAudioState = null;
let audioConsole = null;

const RARITY_TONES = {
    common: { color: '#9e9e9e', border: '#9e9e9e', background: 'rgba(158, 158, 158, 0.08)' },
    standard: { color: '#4dd0e1', border: '#4dd0e1', background: 'rgba(77, 208, 225, 0.08)' },
    uncommon: { color: '#76ff03', border: '#76ff03', background: 'rgba(118, 255, 3, 0.08)' },
    rare: { color: '#ffb74d', border: '#ffb74d', background: 'rgba(255, 183, 77, 0.1)' },
    anomalous: { color: '#d500f9', border: '#d500f9', background: 'rgba(213, 0, 249, 0.1)' },
    legendary: { color: '#ffd54f', border: '#ffd54f', background: 'rgba(255, 213, 79, 0.12)' },
};

const $ = (id) => document.getElementById(id);

function syncAddress() {
    const el = $('address-text');
    if (el) el.textContent = address;
}

function setAddress(next) {
    address = next || '';
    syncAddress();
}

function randomAddress() {
    setAddress(buildRandomAddress());
}

function renderHistory() {
    const el = $('history-chips');
    if (!el) return;
    el.innerHTML = '';
    if (!history.length) {
        el.innerHTML = '<span class="no-history">No planets visited yet.</span>';
        return;
    }
    history.forEach((addr) => {
        const chip = document.createElement('span');
        chip.className = 'history-chip';
        chip.title = addr;
        chip.textContent = [...addr].slice(0, 7).join('') + (addr.length > 7 ? '...' : '');
        chip.addEventListener('click', () => {
            setAddress(addr);
            navigate();
        });
        el.appendChild(chip);
    });
}

function renderBookmarks() {
    const el = $('bookmark-chips');
    if (!el) return;
    const bookmarks = loadBookmarks();
    el.innerHTML = '';
    if (!bookmarks.length) {
        el.innerHTML = '<span class="no-history">No bookmarks yet.</span>';
        return;
    }
    bookmarks.forEach((entry) => {
        const chip = document.createElement('span');
        chip.className = 'bookmark-chip';
        chip.title = `${entry.name || '?'} - ${entry.address}`;
        chip.textContent = [...entry.address].slice(0, 7).join('') + (entry.address.length > 7 ? '...' : '');
        chip.addEventListener('click', () => {
            setAddress(entry.address);
            navigate();
        });
        el.appendChild(chip);
    });
}

function syncBookmarkBtn() {
    const btn = $('btn-bookmark');
    if (!btn) return;
    const saved = isBookmarked(loadBookmarks(), address);
    btn.textContent = saved ? 'SAVED' : 'SAVE';
    btn.classList.toggle('saved', saved);
}

function toggleBookmarkAtCurrentAddress() {
    const bookmarks = loadBookmarks();
    const next = toggleBookmark(bookmarks, {
        address,
        name: planet ? planet.pname : '?',
        biomeId: planet ? planet.biome.id : '',
    });
    saveBookmarks(next);
    renderBookmarks();
    syncBookmarkBtn();
}

function updatePlanetInfo(p) {
    $('planet-name').textContent = p.pname.toUpperCase();
    $('planet-designation').textContent = p.designation;
    $('info-biome').textContent = p.biome.name;
    $('info-sonic').textContent = p.biome.soundProfile;
    $('info-sonic').style.borderColor = p.biome.glowColor;
    $('info-sonic').style.color = p.biome.glowColor;
    $('info-freq').textContent = `${p.rootFreq.toFixed(1)} Hz`;
    $('info-scale').textContent = p.scaleName;
    $('info-tuning').textContent = p.tuningSystem + (p.quarterToneProb > 0 ? ' | QUARTER-TONE' : '') + (p.octaveStretch > 1.001 ? ' | STRETCH' : '');
    $('info-drone').textContent = p.ac?.droneWave?.replace('_', ' ').toUpperCase() || '--';
    $('info-pad').textContent = p.ac?.padWave?.replace('_', ' ').toUpperCase() || '--';
    $('info-voices').textContent = p.ac?.melodyWaves?.join(', ').replace(/_/g, ' ').toUpperCase() || '--';
    $('info-chord-aud').textContent = `${Math.round((p.ac?.chordAudibility || 0) * 100)}%`;
    $('info-atmo').textContent = p.biome.atmosphere;
    if (!p.numMoons) {
        $('info-moons').textContent = 'NONE';
    } else {
        const moonDensity = Math.round((p.moonSystem?.density || 0) * 100);
        $('info-moons').textContent = `${p.numMoons} SATELLITE${p.numMoons > 1 ? 'S' : ''} | DENS ${moonDensity}%`;
    }
    $('info-reverb').textContent = p.biome.reverbLabel;
    $('info-progression').textContent = p.progression.join(' - ');

    const glyphs = [...address];
    const third = Math.max(1, Math.floor(glyphs.length / 3));
    $('info-coords').textContent =
        `${glyphs.slice(0, third).join('') || '?'} | ${glyphs.slice(third, third * 2).join('') || '?'} | ${glyphs.slice(third * 2).join('') || '?'}`;

    const rarity = resolvePlanetRarity(p, address);
    const rarityEl = $('info-rarity');
    const rarityTone = RARITY_TONES[rarity.key] || RARITY_TONES.standard;
    rarityEl.textContent = rarity.label;
    rarityEl.style.color = rarityTone.color;
    rarityEl.style.borderColor = rarityTone.border;
    rarityEl.style.background = rarityTone.background;
    rarityEl.style.borderWidth = '1px';
    rarityEl.style.borderStyle = 'solid';
    rarityEl.style.borderRadius = '3px';
    rarityEl.style.padding = '2px 6px';
}

function navigate() {
    if (!address) randomAddress();
    planet = generatePlanet(address);
    updatePlanetInfo(planet);
    syncDroneUiToPlanet(planet, $, audio, fillSlider);

    if (!history.includes(address)) {
        history.unshift(address);
        if (history.length > 9) history.pop();
        renderHistory();
    }

    if (audio.playing) audio.crossfadeTo(planet);
    syncBookmarkBtn();
    window.location.hash = encodeAddress(address);
}

function setExportStatus(message, tone = 'neutral') {
    const el = $('export-status');
    if (!el) return;
    el.textContent = message;
    el.style.color = tone === 'error'
        ? 'var(--danger)'
        : tone === 'active'
            ? 'var(--accent)'
            : 'var(--text-dim)';
}

function syncExportButton() {
    const btn = $('btn-export');
    if (!btn) return;
    btn.textContent = exportJob ? 'STOP EXPORT' : 'DOWNLOAD';
    btn.classList.toggle('btn-danger', !!exportJob);
}

function pickRecorderFormat() {
    if (!window.MediaRecorder) return null;
    const candidates = [
        { mimeType: 'audio/mpeg', ext: 'mp3', label: 'MP3' },
        { mimeType: 'audio/webm;codecs=opus', ext: 'webm', label: 'WEBM/OPUS' },
        { mimeType: 'audio/ogg;codecs=opus', ext: 'ogg', label: 'OGG/OPUS' },
        { mimeType: 'audio/webm', ext: 'webm', label: 'WEBM' },
    ];
    for (const candidate of candidates) {
        if (!candidate.mimeType) return candidate;
        if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(candidate.mimeType)) {
            return candidate;
        }
    }
    return { mimeType: '', ext: 'webm', label: 'BROWSER DEFAULT' };
}

function audioBufferToWavBlob(buffer) {
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const frameCount = buffer.length;
    const bytesPerSample = 2;
    const blockAlign = channels * bytesPerSample;
    const dataSize = frameCount * blockAlign;
    const wav = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wav);

    const writeString = (offset, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < frameCount; i++) {
        for (let ch = 0; ch < channels; ch++) {
            const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            offset += 2;
        }
    }
    return new Blob([wav], { type: 'audio/wav' });
}

async function finalizeRecordingBlob(blob, format) {
    if (!blob || format.ext === 'mp3') {
        return { blob, ext: format.ext, label: format.label };
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return { blob, ext: format.ext, label: format.label };

    let ctx = null;
    try {
        ctx = new Ctx();
        const arrayBuffer = await blob.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
        return { blob: audioBufferToWavBlob(decoded), ext: 'wav', label: 'WAV' };
    } catch {
        return { blob, ext: format.ext, label: format.label };
    } finally {
        if (ctx && ctx.close) {
            try { await ctx.close(); } catch { }
        }
    }
}

function ensurePlaybackForExport() {
    if (audio.playing) return;
    if (!planet) navigate();
    audio.start(planet);
    $('play-btn').textContent = 'STOP';
    $('play-btn').classList.add('playing');
    $('status-dot').className = 'status-dot playing';
    $('status-text').textContent = 'TRANSMITTING';
    playPending = false;
}

function stopExport() {
    if (!exportJob) return;
    clearTimeout(exportJob.timeoutId);
    clearInterval(exportJob.tickId);
    if (exportJob.recorder && exportJob.recorder.state !== 'inactive') exportJob.recorder.stop();
}

function startExport() {
    if (exportJob) {
        stopExport();
        return;
    }

    const minutes = Math.max(0.25, Math.min(15, +($('export-minutes').value || 1)));
    if (!window.MediaRecorder) {
        setExportStatus('MediaRecorder is not available in this browser.', 'error');
        return;
    }

    ensurePlaybackForExport();
    const stream = audio.getRecordingStream();
    if (!stream) {
        setExportStatus('Recording stream is unavailable in this browser.', 'error');
        return;
    }

    const format = pickRecorderFormat();
    const options = format?.mimeType ? { mimeType: format.mimeType } : undefined;
    const recorder = new MediaRecorder(stream, options);
    const chunks = [];
    const durationMs = minutes * 60 * 1000;
    const startedAt = Date.now();
    const exportPlanet = planet;

    recorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
    });
    recorder.addEventListener('stop', async () => {
        clearTimeout(exportJob?.timeoutId);
        clearInterval(exportJob?.tickId);
        const activeFormat = exportJob?.format || format;
        if (chunks.length) {
            const blobType = activeFormat.mimeType || recorder.mimeType || 'audio/webm';
            setExportStatus('Finalizing export...', 'active');
            const blob = new Blob(chunks, { type: blobType });
            const finalFile = await finalizeRecordingBlob(blob, activeFormat);
            const safeBase = `${(exportPlanet?.designation || exportPlanet?.pname || 'planet').replace(/[^A-Za-z0-9_-]+/g, '-')}-${minutes.toFixed(2).replace('.', '_')}min`;
            const url = URL.createObjectURL(finalFile.blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${safeBase}.${finalFile.ext}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setExportStatus(`Saved ${finalFile.label} capture.`, 'neutral');
        } else {
            setExportStatus('Export stopped before audio data was captured.', 'error');
        }
        exportJob = null;
        syncExportButton();
    });
    recorder.addEventListener('error', () => {
        clearTimeout(exportJob?.timeoutId);
        clearInterval(exportJob?.tickId);
        exportJob = null;
        syncExportButton();
        setExportStatus('Recorder failed to start.', 'error');
    });

    recorder.start(250);
    exportJob = {
        recorder,
        format,
        timeoutId: setTimeout(() => stopExport(), durationMs),
        tickId: null,
    };
    exportJob.tickId = setInterval(() => {
        if (!exportJob) return;
        const remaining = Math.max(0, durationMs - (Date.now() - startedAt));
        setExportStatus(`Recording ${format.label} | ${(remaining / 1000).toFixed(1)}s left`, 'active');
    }, 250);
    syncExportButton();
    setExportStatus(`Recording ${format.label}${format.ext === 'mp3' ? '' : ' fallback'}...`, 'active');
}

function togglePlay() {
    if (playPending) return;
    const btn = $('play-btn');
    const dot = $('status-dot');
    const txt = $('status-text');

    if (audio.playing) {
        if (exportJob) stopExport();
        audio.stop();
        btn.textContent = 'PLAY';
        btn.classList.remove('playing');
        dot.className = 'status-dot';
        txt.textContent = 'STANDBY';
        return;
    }

    playPending = true;
    if (!planet) navigate();
    btn.textContent = 'STOP';
    btn.classList.add('playing');
    dot.className = 'status-dot loading';
    txt.textContent = 'INITIATING...';
    setTimeout(() => {
        requestAnimationFrame(() => {
            audio.start(planet);
            dot.className = 'status-dot playing';
            txt.textContent = 'TRANSMITTING';
            playPending = false;
        });
    }, 120);
}

function updateAudioUI(state) {
    if (renderAudioState) renderAudioState(state);
    if (audioConsole) audioConsole.onState(state);
}

function bindControls() {
    bindAudioEngineControls({
        getEl: $,
        audio,
        fillSliderFn: fillSlider,
        defaultArpChecked: true,
        onEngineModeChange: (mode) => {
            audio.setEngineMode(mode);
            try { localStorage.setItem(ENGINE_MODE_STORAGE_KEY, mode); } catch { }
            if (planet && audio.playing) {
                audio.crossfadeTo(planet);
            }
        },
    });
}

function bindKeyboard() {
    const kb = $('glyph-keyboard');
    GLYPHS.forEach((g) => {
        const btn = document.createElement('button');
        btn.className = 'glyph-key';
        btn.textContent = g;
        btn.addEventListener('click', () => {
            address += g;
            syncAddress();
        });
        kb.appendChild(btn);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            e.preventDefault();
            address = [...address].slice(0, -1).join('');
            syncAddress();
            return;
        }
        if (e.key === 'Enter') {
            navigate();
            return;
        }
        if (e.key === ' ') {
            e.preventDefault();
            togglePlay();
            return;
        }
        const glyphIndex = GLYPHS.indexOf(e.key);
        if (glyphIndex >= 0) {
            address += e.key;
            syncAddress();
            return;
        }
        if (/^[a-z]$/i.test(e.key)) {
            const ci = e.key.toLowerCase().charCodeAt(0) - 97;
            if (ci < GLYPHS.length) {
                address += GLYPHS[ci];
                syncAddress();
            }
        }
    });
}

function bindButtons() {
    $('btn-clear').addEventListener('click', () => setAddress(''));
    $('btn-random').addEventListener('click', randomAddress);
    $('btn-navigate').addEventListener('click', navigate);
    $('btn-bookmark').addEventListener('click', toggleBookmarkAtCurrentAddress);
    $('play-btn').addEventListener('click', togglePlay);
    $('btn-export').addEventListener('click', startExport);
}

function initStateSubscription() {
    if (!renderAudioState) {
        renderAudioState = createAudioStateRenderer({
            audio,
            elements: {
                chord: $('chord-display'),
                melMode: $('mel-mode'),
                melLen: $('mel-len'),
                melRest: $('mel-rest'),
                melBank: $('mel-bank'),
                dbgNodes: $('dbg-nodes'),
                dbgLoad: $('dbg-load'),
                dbgStep: $('dbg-step'),
                dbgPace: $('dbg-pace'),
                dbgHold: $('dbg-hold'),
                dbgMicro: $('dbg-micro'),
                dbgDroneAud: $('dbg-drone-aud'),
                dbgMoonRate: $('dbg-moon-rate'),
                dbgMoon: $('dbg-moon'),
                tensionFill: $('tension-fill'),
                tensionIcon: $('tension-icon'),
                tensionVal: $('tension-val'),
                container: document.body,
            },
            options: {
                chordScale: 1.1,
                motifEnabledColor: 'var(--accent)',
                motifDisabledColor: 'var(--text-dim)',
                standbyTextColor: 'var(--text-dim)',
                accentColor: 'var(--accent)',
            },
        });
    }
    if (unsubscribeState) unsubscribeState();
    unsubscribeState = audio.subscribeState((state) => updateAudioUI(state));
}

function initAddressFromHash() {
    const hash = window.location.hash.slice(1);
    if (!hash) {
        setAddress(DEFAULT_ADDRESS);
        return;
    }
    const decoded = decodeAddress(hash);
    if (decoded) {
        setAddress(decoded);
        return;
    }
    try {
        setAddress(decodeURIComponent(hash));
    } catch {
        setAddress(DEFAULT_ADDRESS);
    }
}

function init() {
    if (window.__LC_DETERMINISM_MODE__ === 'strict') {
        audio.setDeterminismMode('strict');
    }
    const queryMode = new URLSearchParams(window.location.search).get('engine');
    let storedMode = null;
    try { storedMode = localStorage.getItem(ENGINE_MODE_STORAGE_KEY); } catch { }
    const forcedMode = window.__LC_ENGINE_MODE__ || queryMode || storedMode;
    if (forcedMode === 'v2' || forcedMode === 'v1') {
        audio.setEngineMode(forcedMode);
        try { localStorage.setItem(ENGINE_MODE_STORAGE_KEY, forcedMode); } catch { }
    }
    bindKeyboard();
    bindButtons();
    bindControls();
    audioConsole = createAudioEventConsole({
        audio,
        outputEl: $('audio-console'),
        clearBtnEl: $('audio-console-clear'),
    });
    initStateSubscription();
    initAddressFromHash();

    navigate();
    renderBookmarks();
    syncExportButton();
    if (!window.MediaRecorder) {
        setExportStatus('MediaRecorder is unavailable in this browser.', 'error');
    }

    window.__LC_SYNTH_DEBUG__ = {
        setAddressFromCode: (code) => {
            const decoded = decodeAddress(code);
            setAddress(decoded || code || '');
            navigate();
            return address;
        },
        setAddress: (nextAddress) => {
            setAddress(nextAddress);
            navigate();
            return address;
        },
        start: () => {
            if (!planet) navigate();
            if (!audio.playing) audio.start(planet);
            return audio.playing;
        },
        stop: () => {
            if (audio.playing) audio.stop();
            return audio.playing;
        },
        setEngineMode: (mode) => {
            audio.setEngineMode(mode);
            if (planet && audio.playing) {
                audio.crossfadeTo(planet);
            }
            return audio.getEngineMode();
        },
        getEngineMode: () => audio.getEngineMode(),
        setBackgroundPolicy: (policy) => {
            audio.setBackgroundPolicy(policy);
            return audio.getDebugState?.().backgroundPolicy || policy;
        },
        setMacroControls: (controls = {}) => {
            audio.setMacroControls(controls);
            return audio.getDebugState();
        },
        setV2OverlayFlags: (flags = {}) => {
            audio.setV2OverlayFlags(flags);
            return audio.getIdentityDiagnostics?.() || audio.getDebugState?.();
        },
        setPlanetPaceOverride: (pace = 'auto') => {
            audio.setPlanetPaceOverride(pace);
            return audio.getIdentityDiagnostics?.() || audio.getDebugState?.();
        },
        getIdentityDiagnostics: () => audio.getIdentityDiagnostics?.() || audio.getDebugState?.(),
        setDroneMacros: (controls = {}) => {
            audio.setDroneMacros(controls);
            return audio.getDroneState?.() || audio.getDebugState?.().drone || null;
        },
        setDroneVolume: (value) => {
            audio.setDroneVolume(value);
            return audio.getDroneState?.() || audio.getDebugState?.().drone || null;
        },
        setDroneExpert: (controls = {}) => {
            audio.setDroneExpert(controls);
            return audio.getDroneState?.() || audio.getDebugState?.().drone || null;
        },
        captureDroneLoop: (options = {}) => audio.captureDroneLoop(options),
        setDroneRandomizer: (options = {}) => audio.setDroneRandomizer(options),
        setDroneVariationSeed: (seed) => {
            audio.setDroneVariationSeed(seed);
            return audio.getDroneState?.() || audio.getDebugState?.().drone || null;
        },
        getDroneState: () => audio.getDroneState?.() || audio.getDebugState?.().drone || null,
        getRecordingStream: () => audio.getRecordingStream(),
        getDebugState: () => audio.getDebugState(),
        getMelodyState: () => audio.getMelodyState(),
    };

    window.addEventListener('beforeunload', () => {
        if (exportJob) stopExport();
        if (unsubscribeState) unsubscribeState();
        if (audioConsole) audioConsole.dispose();
        if (window.__LC_SYNTH_DEBUG__) delete window.__LC_SYNTH_DEBUG__;
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
