import { describe, expect, it, vi } from 'vitest';
import { bindAudioEngineControls } from '../src/ui/shared/audio-controls.js';
import { createAudioStateRenderer } from '../src/ui/shared/audio-state-ui.js';

function makeEl({ value = '0', min = '0', max = '1', checked = false } = {}) {
    return {
        value,
        min,
        max,
        checked,
        textContent: '',
        className: '',
        style: {},
        listeners: {},
        addEventListener(type, handler) {
            if (!this.listeners[type]) this.listeners[type] = [];
            this.listeners[type].push(handler);
        },
        dispatch(type) {
            const handlers = this.listeners[type] || [];
            handlers.forEach((handler) => handler({ target: this }));
        },
    };
}

function buildControlMap() {
    const map = Object.create(null);
    [
        'ctrl-vol',
        'ctrl-reverb',
        'ctrl-perc-vol',
        'ctrl-eq-low',
        'ctrl-eq-mid',
        'ctrl-eq-high',
        'ctrl-drift',
        'ctrl-density',
    ].forEach((id) => {
        map[id] = makeEl({ value: '0.5', min: '0', max: id.startsWith('ctrl-eq-') ? '12' : '1' });
    });
    [
        'ctrl-granular',
        'ctrl-perc',
        'ctrl-chords',
        'ctrl-arp',
        'ctrl-bend',
        'ctrl-motif',
        'ctrl-ghost',
        'ctrl-fills',
    ].forEach((id) => {
        map[id] = makeEl({ checked: true });
    });
    return map;
}

describe('ui shared helpers', () => {
    it('binds audio controls to stable engine API methods', () => {
        const controls = buildControlMap();
        const fillSpy = vi.fn();
        const mixSpy = vi.fn();
        const perfSpy = vi.fn();
        const featureSpy = vi.fn();
        const audio = {
            setMix: mixSpy,
            setPerformance: perfSpy,
            setFeatureFlags: featureSpy,
        };

        bindAudioEngineControls({
            getEl: (id) => controls[id],
            audio,
            fillSliderFn: fillSpy,
            defaultArpChecked: true,
        });

        controls['ctrl-vol'].value = '0.72';
        controls['ctrl-vol'].dispatch('input');
        expect(mixSpy).toHaveBeenCalledWith({ volume: 0.72 });

        controls['ctrl-density'].value = '0.31';
        controls['ctrl-density'].dispatch('input');
        expect(perfSpy).toHaveBeenCalledWith({ density: 0.31 });

        controls['ctrl-motif'].checked = false;
        controls['ctrl-motif'].dispatch('change');
        expect(featureSpy).toHaveBeenCalledWith({ motif: false });

        expect(controls['ctrl-arp'].checked).toBe(true);
        expect(fillSpy).toHaveBeenCalled();
    });

    it('renders transport/melody/debug/tension state with shared renderer', () => {
        const els = {
            chord: makeEl(),
            melodyDisplay: makeEl(),
            melMode: makeEl(),
            melLen: makeEl(),
            melRest: makeEl(),
            melBank: makeEl(),
            dbgNodes: makeEl(),
            dbgLoad: makeEl(),
            dbgStep: makeEl(),
            dbgMoon: makeEl(),
            tensionFill: makeEl(),
            tensionIcon: makeEl(),
        };
        const audio = {
            playing: true,
            getChord: () => 'I',
            getMelodyState: () => ({ mode: 'GENERATIVE', phraseLength: 0, restProb: 0.05, motifEnabled: true, motifIndex: 0, motifCount: 0 }),
            getDebugState: () => ({ activeNodes: 0, load: 0, stepMs: 0, tensionPhase: 'DORMANT', cycleSteps: 0 }),
        };

        const render = createAudioStateRenderer({
            audio,
            elements: els,
            options: {
                chordScale: 1.2,
                motifEnabledColor: 'lime',
                motifDisabledColor: 'gray',
                standbyTextColor: 'gray',
                accentColor: 'cyan',
            },
        });

        render({
            playing: true,
            chord: 'V',
            melody: {
                mode: 'MOTIF',
                phraseLength: 4,
                restProb: 0.42,
                motifEnabled: true,
                motifIndex: 2,
                motifCount: 5,
            },
            debug: {
                activeNodes: 33,
                load: 0.4,
                stepMs: 120,
                cycleSteps: 16,
                tensionPhase: 'BUILD',
                moonCount: 2,
                moonProcActive: false,
                moonLastProcAgoMs: 480,
            },
            tension: { energy: 0.73, phase: 'BUILD' },
        });

        expect(els.tensionFill.style.width).toBe('73%');
        expect(els.tensionIcon.className).toBe('tension-icon tension-mid');
        expect(els.chord.textContent).toBe('V');
        expect(els.melLen.textContent).toBe('4');
        expect(els.melRest.textContent).toBe('42%');
        expect(els.melBank.textContent).toBe('2/5');
        expect(els.melBank.style.color).toBe('lime');
        expect(els.dbgNodes.textContent).toBe('33');
        expect(els.dbgLoad.textContent).toBe('40%');
        expect(els.dbgStep.textContent).toBe('BUILD | 16/120ms');
        expect(els.dbgMoon.textContent).toBe('2 SAT | 480ms');

        render({ playing: false, tension: { energy: 0, phase: 'DORMANT' } });
        expect(els.melMode.textContent).toBe('STANDBY');
        expect(els.melLen.textContent).toBe('0');
        expect(els.melBank.textContent).toBe('--');
        expect(els.dbgNodes.textContent).toBe('0');
        expect(els.dbgMoon.textContent).toBe('--');
    });
});
