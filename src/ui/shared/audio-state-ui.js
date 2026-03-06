const DEFAULT_TENSION = { energy: 0, phase: 'DORMANT' };

const DEFAULT_OPTIONS = {
    chordScale: 1.1,
    keepChordTextOnIdle: false,
    chordOpacityPlaying: null,
    chordOpacityIdle: null,
    melodyDisplayOpacityPlaying: null,
    melodyDisplayOpacityIdle: null,
    motifEnabledColor: 'var(--accent)',
    motifDisabledColor: 'var(--text-dim)',
    standbyTextColor: 'var(--text-dim)',
    accentColor: 'var(--accent)',
    responseColor: '#ff9d5b',
    motifColor: '#9dff5b',
};

function applyMelodyModeStyle(el, mode, options) {
    if (!el) return;
    if (mode === 'RESPONSE') {
        el.style.background = 'rgba(255, 157, 91, 0.2)';
        el.style.color = options.responseColor;
        el.style.borderColor = 'rgba(255, 157, 91, 0.45)';
        return;
    }
    if (mode === 'MOTIF') {
        el.style.background = 'rgba(157, 255, 91, 0.2)';
        el.style.color = options.motifColor;
        el.style.borderColor = 'rgba(157, 255, 91, 0.45)';
        return;
    }
    el.style.background = 'rgba(91, 157, 255, 0.2)';
    el.style.color = options.accentColor;
    el.style.borderColor = 'rgba(91, 157, 255, 0.35)';
}

function setTensionUI(tensionFillEl, tensionIconEl, tension) {
    if (tensionFillEl) {
        tensionFillEl.style.width = `${Math.round((tension.energy || 0) * 100)}%`;
    }
    if (!tensionIconEl) return;
    const iconPhase = (tension.phase === 'SURGE' || tension.phase === 'CLIMAX' || tension.phase === 'FALLOUT')
        ? 'high'
        : tension.phase === 'BUILD'
            ? 'mid'
            : 'low';
    tensionIconEl.className = `tension-icon tension-${iconPhase}`;
}

function setMoonDebug(dbgMoonEl, debug, options) {
    if (!dbgMoonEl) return;
    if (!debug.moonCount) {
        dbgMoonEl.textContent = 'NONE';
        dbgMoonEl.style.color = options.motifDisabledColor;
        return;
    }
    if (debug.moonProcActive) {
        dbgMoonEl.textContent = `${debug.moonLastBurst || 1}x NOW`;
        dbgMoonEl.style.color = options.motifColor;
        return;
    }
    if (debug.moonLastProcAgoMs !== null) {
        dbgMoonEl.textContent = `${debug.moonCount} SAT | ${debug.moonLastProcAgoMs}ms`;
        dbgMoonEl.style.color = options.accentColor;
        return;
    }
    dbgMoonEl.textContent = `${debug.moonCount} SAT | IDLE`;
    dbgMoonEl.style.color = options.motifDisabledColor;
}

function setIdleMoonDebug(dbgMoonEl, options) {
    if (!dbgMoonEl) return;
    dbgMoonEl.textContent = '--';
    dbgMoonEl.style.color = options.motifDisabledColor;
}

export function createAudioStateRenderer({ audio, elements = {}, options = {} } = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    return function renderAudioState(state = null) {
        const {
            chord: chordEl,
            melodyDisplay: melDisplay,
            melMode: melModeEl,
            melLen: melLenEl,
            melRest: melRestEl,
            melBank: melBankEl,
            dbgNodes: dbgNodesEl,
            dbgLoad: dbgLoadEl,
            dbgStep: dbgStepEl,
            dbgMoon: dbgMoonEl,
            dbgPace: dbgPaceEl,
            dbgHold: dbgHoldEl,
            dbgMicro: dbgMicroEl,
            dbgDroneAud: dbgDroneAudEl,
            dbgMoonRate: dbgMoonRateEl,
            tensionFill: tensionFillEl,
            tensionIcon: tensionIconEl,
        } = elements;

        const playing = state?.playing ?? !!audio?.playing;
        const chord = state?.chord ?? audio?.getChord?.() ?? '';
        const melody = state?.melody ?? audio?.getMelodyState?.() ?? {};
        const debug = state?.debug ?? audio?.getDebugState?.() ?? {};
        const tension = state?.tension || DEFAULT_TENSION;

        setTensionUI(tensionFillEl, tensionIconEl, tension);

        if (playing) {
            if (chordEl && chordEl.textContent !== chord) {
                chordEl.textContent = chord;
                chordEl.style.transform = `scale(${opts.chordScale})`;
                setTimeout(() => {
                    if (chordEl) chordEl.style.transform = 'scale(1)';
                }, 100);
            }
            if (opts.chordOpacityPlaying !== null && chordEl) chordEl.style.opacity = opts.chordOpacityPlaying;
            if (opts.melodyDisplayOpacityPlaying !== null && melDisplay) melDisplay.style.opacity = opts.melodyDisplayOpacityPlaying;

            if (melModeEl) melModeEl.textContent = melody.mode;
            if (melLenEl) melLenEl.textContent = `${melody.phraseLength || 0}`;
            if (melRestEl) melRestEl.textContent = `${Math.round((melody.restProb || 0) * 100)}%`;
            if (dbgNodesEl) dbgNodesEl.textContent = `${debug.activeNodes || 0}`;
            if (dbgLoadEl) dbgLoadEl.textContent = `${Math.round((debug.load || 0) * 100)}%`;
            if (dbgStepEl) {
                dbgStepEl.textContent = debug.stepMs
                    ? `${debug.tensionPhase} | ${debug.cycleSteps}/${debug.stepMs}ms`
                    : '--';
            }
            if (dbgPaceEl) dbgPaceEl.textContent = `${state?.paceClass || debug.paceClass || '--'}`.toUpperCase();
            if (dbgHoldEl) dbgHoldEl.textContent = `${state?.harmonyHoldBarsCurrent ?? debug.harmonyHoldBarsCurrent ?? '--'}`;
            if (dbgMicroEl) dbgMicroEl.textContent = `${Math.round(((state?.microtonalDepth ?? debug.microtonalDepth ?? 0) * 100))}%`;
            if (dbgDroneAudEl) {
                const aud = state?.droneAudibilityDb ?? debug.droneAudibilityDb;
                dbgDroneAudEl.textContent = Number.isFinite(aud) ? `${aud.toFixed(1)} dB` : '--';
            }
            if (dbgMoonRateEl) {
                const moonRate = state?.moonActivityRate ?? debug.moonActivityRate;
                dbgMoonRateEl.textContent = Number.isFinite(moonRate) ? `${moonRate.toFixed(2)}/step` : '--';
            }
            setMoonDebug(dbgMoonEl, debug, opts);

            if (melBankEl) {
                melBankEl.textContent = melody.motifEnabled
                    ? (melody.motifCount ? `${melody.motifIndex}/${melody.motifCount}` : '--')
                    : 'OFF';
                melBankEl.style.color = melody.motifEnabled ? opts.motifEnabledColor : opts.motifDisabledColor;
            }
            applyMelodyModeStyle(melModeEl, melody.mode, opts);
            return;
        }

        if (chordEl) {
            if (!opts.keepChordTextOnIdle) chordEl.textContent = '';
            if (opts.chordOpacityIdle !== null) chordEl.style.opacity = opts.chordOpacityIdle;
        }
        if (opts.melodyDisplayOpacityIdle !== null && melDisplay) melDisplay.style.opacity = opts.melodyDisplayOpacityIdle;
        if (melLenEl) melLenEl.textContent = '0';
        if (melRestEl) melRestEl.textContent = '5%';
        if (melBankEl) {
            melBankEl.textContent = '--';
            melBankEl.style.color = opts.motifDisabledColor;
        }
        if (dbgNodesEl) dbgNodesEl.textContent = '0';
        if (dbgLoadEl) dbgLoadEl.textContent = '0%';
        if (dbgStepEl) dbgStepEl.textContent = '--';
        if (dbgPaceEl) dbgPaceEl.textContent = '--';
        if (dbgHoldEl) dbgHoldEl.textContent = '--';
        if (dbgMicroEl) dbgMicroEl.textContent = '--';
        if (dbgDroneAudEl) dbgDroneAudEl.textContent = '--';
        if (dbgMoonRateEl) dbgMoonRateEl.textContent = '--';
        setIdleMoonDebug(dbgMoonEl, opts);

        if (melModeEl) {
            melModeEl.textContent = 'STANDBY';
            melModeEl.style.background = 'rgba(255, 255, 255, 0.05)';
            melModeEl.style.color = opts.standbyTextColor;
            melModeEl.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        }
    };
}
