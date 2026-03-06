const DEFAULT_MAX_LINES = 220;
const DEFAULT_STATE_INTERVAL_MS = 900;

const ON = 'ON';
const OFF = 'off';

function fmtTime(ts = Date.now()) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

function fmtDb(value, fallback = '--') {
    return Number.isFinite(value) ? `${value.toFixed(1)} dB` : fallback;
}

function onOff(value) {
    return value ? ON : OFF;
}

function formatFlags(flags = {}) {
    return `g:${onOff(flags.granular)} p:${onOff(flags.percussion)} c:${onOff(flags.chords)} a:${onOff(flags.arp)} m:${onOff(flags.motif)}`;
}

function formatOverlays(overlays = {}) {
    return `H:${onOff(overlays.extendedHarmony)} C:${onOff(overlays.counterpoint)} M:${onOff(overlays.microtonalWarp)} D:${onOff(overlays.droneLayer)} N:${onOff(overlays.moonCanons)} P:${onOff(overlays.adaptivePercussion)} E:${onOff(overlays.ambientEcosystem)}`;
}

function fmtUnit(value, digits = 2) {
    return Number.isFinite(value) ? value.toFixed(digits) : '--';
}

function formatLayerDb(layerDb = {}) {
    const keys = ['drones', 'pads', 'melody', 'bass', 'percussion', 'ambience', 'fx'];
    return keys
        .map((key) => {
            const tag = key.slice(0, 3);
            const rms = layerDb[key]?.rmsDb;
            return `${tag}:${Number.isFinite(rms) ? rms.toFixed(1) : '--'}`;
        })
        .join(' ');
}

function eventSummary(event = {}) {
    switch (event.type) {
        case 'engine-start':
            return `engine start mode=${event.engineMode || event.mode || 'n/a'} seed=${event.seed ?? 'n/a'}`;
        case 'engine-stop':
            return `engine stop mode=${event.engineMode || event.mode || 'n/a'}`;
        case 'engine-mode':
            return `engine mode -> ${event.mode || 'n/a'}`;
        case 'section-change':
            return `section ${event.section || 'n/a'} energy=${Number.isFinite(event.arrangementEnergy) ? event.arrangementEnergy.toFixed(2) : '--'}`;
        case 'chord-change':
            return `chord ${event.chord || 'n/a'} hold=${event.holdBars ?? '--'} bars pace=${event.paceClass || '--'}`;
        case 'background-mode':
            return `background mode=${event.mode || 'n/a'} policy=${event.policy || 'n/a'}`;
        case 'background-policy':
            return `background policy=${event.policy || 'n/a'}`;
        case 'unsupported-feature':
            return `unsupported ${event.feature || 'feature'} in ${event.engineMode || 'unknown'}`;
        case 'feature-flags':
            return `flags ${formatFlags(event.featureFlags || {})}`;
        case 'v2-overlay-flags':
            return `overlays ${formatOverlays(event.overlays || {})}`;
        case 'pace-override':
            return `pace override=${event.paceOverride || 'auto'}`;
        case 'drone-macros':
            return `drone macros d=${fmtUnit(event.macros?.dream)} t=${fmtUnit(event.macros?.texture)} m=${fmtUnit(event.macros?.motion)} r=${fmtUnit(event.macros?.resonance)} df=${fmtUnit(event.macros?.diffusion)} tl=${fmtUnit(event.macros?.tail)}`;
        case 'drone-expert':
            return `drone expert src=${event.expert?.sourceMode || '--'} prio=${event.expert?.expertPriority || '--'} f=${event.expert?.filterType || '--'} pos=${event.expert?.filterPosition ?? '--'} var=${fmtUnit(event.expert?.varispeed)}`;
        case 'drone-capture':
            return `drone capture mode=${event.mode || '--'} src=${event.source || '--'} enabled=${onOff(event.state?.captureEnabled)}`;
        case 'drone-randomizer':
            return `drone random ${event.action || 'apply'} tgt=${event.target || 'all'} amt=${fmtUnit(event.intensity)}`;
        case 'drone-seed':
            return `drone seed=${event.seed ?? '--'}`;
        case 'drone-volume':
            return `drone volume=${fmtUnit(event.level)}`;
        case 'drone-frame':
            return `drone section=${event.section || '--'} loop=${Number.isFinite(event.loopFill) ? event.loopFill.toFixed(2) : '--'} src=${event.sourceMode || '--'} stage=${event.degradeStage || '--'}`;
        default:
            return event.type ? `${event.type}` : 'event';
    }
}

export function createAudioEventConsole({
    audio,
    outputEl = null,
    clearBtnEl = null,
    maxLines = DEFAULT_MAX_LINES,
    stateIntervalMs = DEFAULT_STATE_INTERVAL_MS,
} = {}) {
    if (!audio || !outputEl) {
        return {
            onState: () => { },
            dispose: () => { },
        };
    }

    const lines = [];
    let lastStateAt = 0;
    let lastDroneFrameAt = 0;
    const max = Math.max(20, Number.isFinite(maxLines) ? Math.round(maxLines) : DEFAULT_MAX_LINES);
    const stateMs = Math.max(250, Number.isFinite(stateIntervalMs) ? Math.round(stateIntervalMs) : DEFAULT_STATE_INTERVAL_MS);

    const redraw = () => {
        outputEl.textContent = lines.join('\n');
        outputEl.scrollTop = outputEl.scrollHeight;
    };

    const pushLine = (message, ts = Date.now()) => {
        lines.push(`${fmtTime(ts)}  ${message}`);
        if (lines.length > max) lines.splice(0, lines.length - max);
        redraw();
    };

    const unsubscribeEvents = typeof audio.subscribeEvents === 'function'
        ? audio.subscribeEvents((event) => {
            const now = Date.now();
            if (event?.type === 'drone-frame' && (now - lastDroneFrameAt) < 1200) return;
            if (event?.type === 'drone-frame') lastDroneFrameAt = now;
            pushLine(eventSummary(event), event?.ts || now);
        })
        : () => { };

    const onClear = () => {
        lines.length = 0;
        redraw();
        pushLine('console cleared');
    };
    if (clearBtnEl) clearBtnEl.addEventListener('click', onClear);

    pushLine('audio console ready');

    return {
        onState(state = null) {
            const now = Date.now();
            if (!state || (now - lastStateAt) < stateMs) return;
            lastStateAt = now;

            const debug = state.debug || {};
            const mix = state.mix || {};
            const featureFlags = debug.featureFlags || state.featureFlags || {};
            const effectiveFlags = debug.effectiveFlags || state.effectiveFlags || featureFlags;
            const overlays = debug.v2OverlayFlags || {};
            const peak = fmtDb(mix.preLimiterPeakDb);
            const lufs = fmtDb(mix.integratedLufs);
            const droneAud = fmtDb(state.droneAudibilityDb ?? debug.droneAudibilityDb);
            const layers = formatLayerDb(mix.layerDb || {});
            const sec = state.section || debug.section || '--';

            pushLine(
                `state sec=${sec} peak=${peak} lufs=${lufs} drone=${droneAud} ` +
                `flags[${formatFlags(featureFlags)}] eff[${formatFlags(effectiveFlags)}] ov[${formatOverlays(overlays)}] ` +
                `layers[${layers}]`,
                now,
            );
        },
        dispose() {
            try { unsubscribeEvents(); } catch { }
            if (clearBtnEl) {
                try { clearBtnEl.removeEventListener('click', onClear); } catch { }
            }
        },
    };
}
