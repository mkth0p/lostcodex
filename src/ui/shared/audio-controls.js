import { fillSlider } from './slider-fill.js';

const MIX_SLIDERS = [
    ['ctrl-vol', 'volume'],
    ['ctrl-reverb', 'reverb'],
    ['ctrl-perc-vol', 'percussionVolume'],
    ['ctrl-eq-low', 'eqLow'],
    ['ctrl-eq-mid', 'eqMid'],
    ['ctrl-eq-high', 'eqHigh'],
];

const PERFORMANCE_SLIDERS = [
    ['ctrl-drift', 'drift'],
    ['ctrl-density', 'density'],
];

const MACRO_SLIDERS = [
    ['ctrl-macro-complexity', 'complexity'],
    ['ctrl-macro-motion', 'motion'],
    ['ctrl-macro-dissonance', 'dissonance'],
    ['ctrl-macro-texture', 'texture'],
    ['ctrl-macro-space', 'space'],
    ['ctrl-macro-stability', 'stability'],
];

const ARRANGEMENT_SLIDERS = [
    ['ctrl-arr-form-depth', 'formDepth'],
    ['ctrl-arr-variation-rate', 'variationRate'],
    ['ctrl-arr-phrase-bias', 'phraseLengthBias'],
    ['ctrl-arr-cadence-strength', 'cadenceStrength'],
];

const LAYER_SLIDERS = [
    ['ctrl-layer-drones', 'drones'],
    ['ctrl-layer-pads', 'pads'],
    ['ctrl-layer-melody', 'melody'],
    ['ctrl-layer-bass', 'bass'],
    ['ctrl-layer-percussion', 'percussion'],
    ['ctrl-layer-ambience', 'ambience'],
    ['ctrl-layer-fx', 'fx'],
];

const SPATIAL_SLIDERS = [
    ['ctrl-spatial-width', 'width'],
    ['ctrl-spatial-depth', 'depth'],
    ['ctrl-spatial-movement', 'movement'],
];

const DRONE_MACRO_SLIDERS = [
    ['ctrl-drone-dream', 'dream'],
    ['ctrl-drone-texture', 'texture'],
    ['ctrl-drone-motion', 'motion'],
    ['ctrl-drone-resonance', 'resonance'],
    ['ctrl-drone-diffusion', 'diffusion'],
    ['ctrl-drone-tail', 'tail'],
];

const DRONE_EXPERT_SLIDERS = [
    ['ctrl-drone-loop-start', 'loopStart'],
    ['ctrl-drone-loop-length', 'loopLength'],
    ['ctrl-drone-varispeed', 'varispeed'],
    ['ctrl-drone-sos', 'sos'],
    ['ctrl-drone-filter-cutoff', 'filterCutoff'],
    ['ctrl-drone-filter-q', 'filterQ'],
    ['ctrl-drone-filter-position', 'filterPosition'],
    ['ctrl-drone-resonator-tune', 'resonatorTune'],
    ['ctrl-drone-resonator-feedback', 'resonatorFeedback'],
    ['ctrl-drone-resonator-spread', 'resonatorSpread'],
    ['ctrl-drone-echo-time', 'echoTime'],
    ['ctrl-drone-echo-feedback', 'echoFeedback'],
    ['ctrl-drone-echo-tone', 'echoTone'],
    ['ctrl-drone-ambience-spacetime', 'ambienceSpacetime'],
    ['ctrl-drone-ambience-decay', 'ambienceDecay'],
    ['ctrl-drone-mod-master', 'modMaster'],
    ['ctrl-drone-mod-rate', 'modRate'],
    ['ctrl-drone-mod-routing', 'modRouting'],
];

const DRONE_EXPERT_SELECTS = [
    ['ctrl-drone-priority', 'expertPriority'],
    ['ctrl-drone-source-mode', 'sourceMode'],
    ['ctrl-drone-looper-source', 'looperSource'],
    ['ctrl-drone-filter-type', 'filterType'],
];

const FEATURE_TOGGLES = [
    ['ctrl-granular', 'granular'],
    ['ctrl-perc', 'percussion'],
    ['ctrl-chords', 'chords'],
    ['ctrl-arp', 'arp'],
    ['ctrl-bend', 'pitchBend'],
    ['ctrl-motif', 'motif'],
    ['ctrl-ghost', 'ghost'],
    ['ctrl-fills', 'fills'],
];

const V2_OVERLAY_TOGGLES = [
    ['ctrl-v2-overlay-harmony', 'extendedHarmony'],
    ['ctrl-v2-overlay-counterpoint', 'counterpoint'],
    ['ctrl-v2-overlay-microtonal', 'microtonalWarp'],
    ['ctrl-v2-overlay-drone', 'droneLayer'],
    ['ctrl-v2-overlay-moon', 'moonCanons'],
    ['ctrl-v2-overlay-perc', 'adaptivePercussion'],
    ['ctrl-v2-overlay-ecosystem', 'ambientEcosystem'],
];

const DRONE_UI_STORAGE_KEY = 'lc_drone_ui_v1';

function loadDroneUiState() {
    try {
        const raw = localStorage.getItem(DRONE_UI_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveDroneUiState(state) {
    try {
        localStorage.setItem(DRONE_UI_STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore storage failures in private mode or locked browsers.
    }
}

function bindSlider(getEl, id, onInput, fillSliderFn, options = {}) {
    const el = getEl(id);
    if (!el) return;
    if (Number.isFinite(options.initialValue)) {
        el.value = options.initialValue;
    }
    fillSliderFn(el);
    if (options.applyInitial) onInput(+el.value);
    el.addEventListener('input', (e) => {
        const value = +e.target.value;
        onInput(value);
        fillSliderFn(e.target);
    });
}

function bindSelect(getEl, id, onChange, options = {}) {
    const el = getEl(id);
    if (!el) return;
    if (typeof options.initialValue === 'string' && options.initialValue) {
        el.value = options.initialValue;
    }
    if (options.applyInitial) onChange(el.value);
    el.addEventListener('change', (e) => {
        onChange(e.target.value);
    });
}

export function bindAudioEngineControls({
    getEl,
    audio,
    fillSliderFn = fillSlider,
    defaultArpChecked = true,
    onEngineModeChange = null,
} = {}) {
    if (typeof getEl !== 'function' || !audio) return;

    const droneUiState = loadDroneUiState();
    const updateDroneState = (id, value) => {
        droneUiState[id] = value;
        saveDroneUiState(droneUiState);
    };

    MIX_SLIDERS.forEach(([id, key]) => {
        bindSlider(getEl, id, (value) => {
            audio.setMix({ [key]: value });
        }, fillSliderFn);
    });

    PERFORMANCE_SLIDERS.forEach(([id, key]) => {
        bindSlider(getEl, id, (value) => {
            audio.setPerformance({ [key]: value });
        }, fillSliderFn);
    });

    MACRO_SLIDERS.forEach(([id, key]) => {
        bindSlider(getEl, id, (value) => {
            audio.setMacroControls({ [key]: value });
        }, fillSliderFn);
    });

    ARRANGEMENT_SLIDERS.forEach(([id, key]) => {
        bindSlider(getEl, id, (value) => {
            audio.setArrangement({ [key]: value });
        }, fillSliderFn);
    });

    LAYER_SLIDERS.forEach(([id, key]) => {
        bindSlider(getEl, id, (value) => {
            audio.setLayerMix({ [key]: value });
        }, fillSliderFn);
    });

    SPATIAL_SLIDERS.forEach(([id, key]) => {
        bindSlider(getEl, id, (value) => {
            audio.setSpatial({ [key]: value });
        }, fillSliderFn);
    });

    DRONE_MACRO_SLIDERS.forEach(([id, key]) => {
        bindSlider(getEl, id, (value) => {
            audio.setDroneMacros({ [key]: value });
            updateDroneState(id, value);
        }, fillSliderFn, {
            initialValue: Number.isFinite(droneUiState[id]) ? droneUiState[id] : undefined,
            applyInitial: Number.isFinite(droneUiState[id]),
        });
    });

    bindSlider(getEl, 'ctrl-drone-volume', (value) => {
        audio.setDroneVolume(value);
        updateDroneState('ctrl-drone-volume', value);
    }, fillSliderFn, {
        initialValue: Number.isFinite(droneUiState['ctrl-drone-volume']) ? droneUiState['ctrl-drone-volume'] : undefined,
        applyInitial: Number.isFinite(droneUiState['ctrl-drone-volume']),
    });

    DRONE_EXPERT_SLIDERS.forEach(([id, key]) => {
        bindSlider(getEl, id, (value) => {
            audio.setDroneExpert({ [key]: value });
            updateDroneState(id, value);
        }, fillSliderFn, {
            initialValue: Number.isFinite(droneUiState[id]) ? droneUiState[id] : undefined,
            applyInitial: Number.isFinite(droneUiState[id]),
        });
    });

    DRONE_EXPERT_SELECTS.forEach(([id, key]) => {
        bindSelect(getEl, id, (value) => {
            audio.setDroneExpert({ [key]: value });
            updateDroneState(id, value);
        }, {
            initialValue: typeof droneUiState[id] === 'string' ? droneUiState[id] : undefined,
            applyInitial: typeof droneUiState[id] === 'string',
        });
    });

    FEATURE_TOGGLES.forEach(([id, key]) => {
        const el = getEl(id);
        if (!el) return;
        el.addEventListener('change', (e) => {
            audio.setFeatureFlags({ [key]: e.target.checked });
            syncLayersButtonLabel();
        });
    });

    const engineModeSelect = getEl('ctrl-engine-mode');
    if (engineModeSelect) {
        engineModeSelect.value = audio.getEngineMode();
        engineModeSelect.addEventListener('change', (e) => {
            const mode = e.target.value;
            if (typeof onEngineModeChange === 'function') {
                onEngineModeChange(mode);
            } else {
                audio.setEngineMode(mode);
            }
        });
    }

    const backgroundPolicySelect = getEl('ctrl-bg-policy');
    if (backgroundPolicySelect) {
        backgroundPolicySelect.addEventListener('change', (e) => {
            audio.setBackgroundPolicy(e.target.value);
        });
    }

    const paceOverrideSelect = getEl('ctrl-pace-override');
    if (paceOverrideSelect) {
        paceOverrideSelect.addEventListener('change', (e) => {
            audio.setPlanetPaceOverride(e.target.value);
        });
    }

    V2_OVERLAY_TOGGLES.forEach(([id, key]) => {
        const el = getEl(id);
        if (!el) return;
        el.addEventListener('change', (e) => {
            audio.setV2OverlayFlags({ [key]: e.target.checked });
            syncLayersButtonLabel();
        });
    });

    const layersAllOffBtn = getEl('ctrl-layers-all-off');
    const allLayerToggleIds = [
        ...FEATURE_TOGGLES.map(([id]) => id),
        ...V2_OVERLAY_TOGGLES.map(([id]) => id),
    ];
    const getLayerToggleEls = () => allLayerToggleIds
        .map((id) => getEl(id))
        .filter(Boolean);
    const areAllLayersOff = () => {
        const els = getLayerToggleEls();
        if (!els.length) return false;
        return els.every((el) => !el.checked);
    };
    const syncLayersButtonLabel = () => {
        if (!layersAllOffBtn) return;
        layersAllOffBtn.textContent = areAllLayersOff() ? 'ALL LAYERS ON' : 'ALL LAYERS OFF';
    };
    if (layersAllOffBtn) {
        layersAllOffBtn.addEventListener('click', () => {
            const turnOn = areAllLayersOff();
            FEATURE_TOGGLES.forEach(([id]) => {
                const el = getEl(id);
                if (el) el.checked = turnOn;
            });
            V2_OVERLAY_TOGGLES.forEach(([id]) => {
                const el = getEl(id);
                if (el) el.checked = turnOn;
            });
            audio.setFeatureFlags({
                granular: turnOn,
                percussion: turnOn,
                chords: turnOn,
                arp: turnOn,
                pitchBend: turnOn,
                motif: turnOn,
                ghost: turnOn,
                fills: turnOn,
            });
            audio.setV2OverlayFlags({
                extendedHarmony: turnOn,
                counterpoint: turnOn,
                microtonalWarp: turnOn,
                droneLayer: turnOn,
                moonCanons: turnOn,
                adaptivePercussion: turnOn,
                ambientEcosystem: turnOn,
            });
            syncLayersButtonLabel();
        });
    }

    const randomTargetEl = getEl('ctrl-drone-rand-target');
    const randomIntensityEl = getEl('ctrl-drone-rand-intensity');
    if (randomIntensityEl) {
        bindSlider(getEl, 'ctrl-drone-rand-intensity', (value) => {
            updateDroneState('ctrl-drone-rand-intensity', value);
        }, fillSliderFn, {
            initialValue: Number.isFinite(droneUiState['ctrl-drone-rand-intensity'])
                ? droneUiState['ctrl-drone-rand-intensity']
                : undefined,
            applyInitial: false,
        });
    }

    const applyRandomizer = (action = 'apply') => {
        const target = randomTargetEl?.value || 'all';
        const intensity = Number.isFinite(+randomIntensityEl?.value)
            ? +randomIntensityEl.value
            : 0.5;
        audio.setDroneRandomizer({ target, intensity, action });
    };

    const randApply = getEl('ctrl-drone-rand-apply');
    if (randApply) randApply.addEventListener('click', () => applyRandomizer('apply'));
    const randUndo = getEl('ctrl-drone-rand-undo');
    if (randUndo) randUndo.addEventListener('click', () => applyRandomizer('undo'));
    const randRedo = getEl('ctrl-drone-rand-redo');
    if (randRedo) randRedo.addEventListener('click', () => applyRandomizer('redo'));

    const captureToggle = getEl('ctrl-drone-capture-toggle');
    if (captureToggle) {
        captureToggle.addEventListener('click', () => {
            const source = getEl('ctrl-drone-looper-source')?.value || 'pre';
            audio.captureDroneLoop({ mode: 'toggle', source });
        });
    }

    const captureMomentary = getEl('ctrl-drone-capture-momentary');
    if (captureMomentary) {
        captureMomentary.addEventListener('click', () => {
            const source = getEl('ctrl-drone-looper-source')?.value || 'pre';
            audio.captureDroneLoop({ mode: 'momentary', source });
        });
    }

    if (defaultArpChecked) {
        const arp = getEl('ctrl-arp');
        if (arp) arp.checked = true;
    }
    syncLayersButtonLabel();
}
