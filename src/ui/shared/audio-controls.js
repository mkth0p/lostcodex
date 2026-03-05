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

function bindSlider(getEl, id, onInput, fillSliderFn) {
    const el = getEl(id);
    if (!el) return;
    fillSliderFn(el);
    el.addEventListener('input', (e) => {
        const value = +e.target.value;
        onInput(value);
        fillSliderFn(e.target);
    });
}

export function bindAudioEngineControls({
    getEl,
    audio,
    fillSliderFn = fillSlider,
    defaultArpChecked = true,
} = {}) {
    if (typeof getEl !== 'function' || !audio) return;

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

    FEATURE_TOGGLES.forEach(([id, key]) => {
        const el = getEl(id);
        if (!el) return;
        el.addEventListener('change', (e) => {
            audio.setFeatureFlags({ [key]: e.target.checked });
        });
    });

    if (defaultArpChecked) {
        const arp = getEl('ctrl-arp');
        if (arp) arp.checked = true;
    }
}
