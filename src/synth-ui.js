import { AudioEngine } from './audio/engine.js';
import { generatePlanet } from './planet.js';
import { GLYPHS } from './data.js';
import { decodeAddress, encodeAddress } from './ui/shared/address-codec.js';
import { randomAddress as buildRandomAddress } from './ui/shared/address-utils.js';
import { isBookmarked, loadBookmarks, saveBookmarks, toggleBookmark } from './ui/shared/bookmarks.js';
import { fillSlider } from './ui/shared/slider-fill.js';

const DEFAULT_ADDRESS = GLYPHS.slice(0, 6).join('');

const audio = new AudioEngine();
let planet = null;
let address = '';
let history = [];
let playPending = false;
let exportJob = null;
let unsubscribeState = null;

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
    $('info-moons').textContent = p.numMoons === 0 ? 'NONE' : `${p.numMoons} SATELLITE${p.numMoons > 1 ? 'S' : ''}`;
    $('info-reverb').textContent = p.biome.reverbLabel;
    $('info-progression').textContent = p.progression.join(' - ');

    const glyphs = [...address];
    const third = Math.max(1, Math.floor(glyphs.length / 3));
    $('info-coords').textContent =
        `${glyphs.slice(0, third).join('') || '?'} | ${glyphs.slice(third, third * 2).join('') || '?'} | ${glyphs.slice(third * 2).join('') || '?'}`;

    const len = glyphs.length;
    const rarity = len <= 3 ? 'COMMON' : len <= 6 ? 'STANDARD' : len <= 10 ? 'UNCOMMON' : len <= 15 ? 'RARE' : 'ANOMALOUS';
    $('info-rarity').textContent = rarity;
}

function navigate() {
    if (!address) randomAddress();
    planet = generatePlanet(address);
    updatePlanetInfo(planet);

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

function applyMelodyModeStyle(el, mode) {
    if (!el) return;
    if (mode === 'RESPONSE') {
        el.style.background = 'rgba(255, 157, 91, 0.2)';
        el.style.color = '#ff9d5b';
        el.style.borderColor = 'rgba(255, 157, 91, 0.45)';
    } else if (mode === 'MOTIF') {
        el.style.background = 'rgba(157, 255, 91, 0.2)';
        el.style.color = '#9dff5b';
        el.style.borderColor = 'rgba(157, 255, 91, 0.45)';
    } else {
        el.style.background = 'rgba(91, 157, 255, 0.2)';
        el.style.color = 'var(--accent)';
        el.style.borderColor = 'rgba(91, 157, 255, 0.35)';
    }
}

function updateAudioUI(state) {
    const chordEl = $('chord-display');
    const melModeEl = $('mel-mode');
    const melLenEl = $('mel-len');
    const melRestEl = $('mel-rest');
    const melBankEl = $('mel-bank');
    const dbgNodesEl = $('dbg-nodes');
    const dbgLoadEl = $('dbg-load');
    const dbgStepEl = $('dbg-step');
    const dbgMoonEl = $('dbg-moon');
    const tensionFillEl = $('tension-fill');
    const tensionIconEl = $('tension-icon');

    const playing = !!state?.playing;
    const chord = state?.chord ?? audio.getChord();
    const melody = state?.melody ?? audio.getMelodyState();
    const debug = state?.debug ?? audio.getDebugState();
    const tension = state?.tension || { energy: 0, phase: 'DORMANT' };

    if (tensionFillEl) tensionFillEl.style.width = `${Math.round((tension.energy || 0) * 100)}%`;
    if (tensionIconEl) {
        const iconPhase = (tension.phase === 'SURGE' || tension.phase === 'CLIMAX' || tension.phase === 'FALLOUT')
            ? 'high'
            : tension.phase === 'BUILD'
                ? 'mid'
                : 'low';
        tensionIconEl.className = `tension-icon tension-${iconPhase}`;
    }

    if (playing) {
        if (chordEl && chordEl.textContent !== chord) {
            chordEl.textContent = chord;
            chordEl.style.transform = 'scale(1.1)';
            setTimeout(() => {
                if (chordEl) chordEl.style.transform = 'scale(1)';
            }, 100);
        }
        if (melModeEl) melModeEl.textContent = melody.mode;
        if (melLenEl) melLenEl.textContent = `${melody.phraseLength}`;
        if (melRestEl) melRestEl.textContent = `${Math.round(melody.restProb * 100)}%`;
        if (dbgNodesEl) dbgNodesEl.textContent = `${debug.activeNodes}`;
        if (dbgLoadEl) dbgLoadEl.textContent = `${Math.round(debug.load * 100)}%`;
        if (dbgStepEl) dbgStepEl.textContent = debug.stepMs ? `${debug.tensionPhase} | ${debug.cycleSteps}/${debug.stepMs}ms` : '--';
        if (dbgMoonEl) {
            if (!debug.moonCount) {
                dbgMoonEl.textContent = 'NONE';
                dbgMoonEl.style.color = 'var(--text-dim)';
            } else if (debug.moonProcActive) {
                dbgMoonEl.textContent = `${debug.moonLastBurst || 1}x NOW`;
                dbgMoonEl.style.color = '#9dff5b';
            } else if (debug.moonLastProcAgoMs !== null) {
                dbgMoonEl.textContent = `${debug.moonCount} SAT | ${debug.moonLastProcAgoMs}ms`;
                dbgMoonEl.style.color = 'var(--accent)';
            } else {
                dbgMoonEl.textContent = `${debug.moonCount} SAT | IDLE`;
                dbgMoonEl.style.color = 'var(--text-dim)';
            }
        }
        if (melBankEl) {
            melBankEl.textContent = melody.motifEnabled
                ? (melody.motifCount ? `${melody.motifIndex}/${melody.motifCount}` : '--')
                : 'OFF';
            melBankEl.style.color = melody.motifEnabled ? 'var(--accent)' : 'var(--text-dim)';
        }
        applyMelodyModeStyle(melModeEl, melody.mode);
    } else {
        if (chordEl) chordEl.textContent = '';
        if (melLenEl) melLenEl.textContent = '0';
        if (melRestEl) melRestEl.textContent = '5%';
        if (melBankEl) {
            melBankEl.textContent = '--';
            melBankEl.style.color = 'var(--text-dim)';
        }
        if (dbgNodesEl) dbgNodesEl.textContent = '0';
        if (dbgLoadEl) dbgLoadEl.textContent = '0%';
        if (dbgStepEl) dbgStepEl.textContent = '--';
        if (dbgMoonEl) {
            dbgMoonEl.textContent = '--';
            dbgMoonEl.style.color = 'var(--text-dim)';
        }
        if (melModeEl) {
            melModeEl.textContent = 'STANDBY';
            melModeEl.style.background = 'rgba(255, 255, 255, 0.05)';
            melModeEl.style.color = 'var(--text-dim)';
            melModeEl.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        }
    }
}

function bindControls() {
    const slider = (id) => {
        const el = $(id);
        fillSlider(el);
        return el;
    };

    slider('ctrl-vol').addEventListener('input', (e) => {
        audio.setMix({ volume: +e.target.value });
        fillSlider(e.target);
    });
    slider('ctrl-reverb').addEventListener('input', (e) => {
        audio.setMix({ reverb: +e.target.value });
        fillSlider(e.target);
    });
    slider('ctrl-drift').addEventListener('input', (e) => {
        audio.setPerformance({ drift: +e.target.value });
        fillSlider(e.target);
    });
    slider('ctrl-density').addEventListener('input', (e) => {
        audio.setPerformance({ density: +e.target.value });
        fillSlider(e.target);
    });
    slider('ctrl-perc-vol').addEventListener('input', (e) => {
        audio.setMix({ percussionVolume: +e.target.value });
        fillSlider(e.target);
    });
    slider('ctrl-eq-low').addEventListener('input', (e) => {
        audio.setMix({ eqLow: +e.target.value });
        fillSlider(e.target);
    });
    slider('ctrl-eq-mid').addEventListener('input', (e) => {
        audio.setMix({ eqMid: +e.target.value });
        fillSlider(e.target);
    });
    slider('ctrl-eq-high').addEventListener('input', (e) => {
        audio.setMix({ eqHigh: +e.target.value });
        fillSlider(e.target);
    });

    $('ctrl-granular').addEventListener('change', (e) => audio.setFeatureFlags({ granular: e.target.checked }));
    $('ctrl-perc').addEventListener('change', (e) => audio.setFeatureFlags({ percussion: e.target.checked }));
    $('ctrl-chords').addEventListener('change', (e) => audio.setFeatureFlags({ chords: e.target.checked }));
    $('ctrl-arp').addEventListener('change', (e) => audio.setFeatureFlags({ arp: e.target.checked }));
    $('ctrl-bend').addEventListener('change', (e) => audio.setFeatureFlags({ pitchBend: e.target.checked }));
    $('ctrl-motif').addEventListener('change', (e) => audio.setFeatureFlags({ motif: e.target.checked }));
    $('ctrl-ghost').addEventListener('change', (e) => audio.setFeatureFlags({ ghost: e.target.checked }));
    $('ctrl-fills').addEventListener('change', (e) => audio.setFeatureFlags({ fills: e.target.checked }));
    $('ctrl-arp').checked = true;
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
    bindKeyboard();
    bindButtons();
    bindControls();
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
        getDebugState: () => audio.getDebugState(),
        getMelodyState: () => audio.getMelodyState(),
    };

    window.addEventListener('beforeunload', () => {
        if (exportJob) stopExport();
        if (unsubscribeState) unsubscribeState();
        if (window.__LC_SYNTH_DEBUG__) delete window.__LC_SYNTH_DEBUG__;
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
