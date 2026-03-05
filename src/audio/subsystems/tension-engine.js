import { RNG } from '../../rng.js';
import { DEFAULT_TENSION_PROFILE } from '../config/tension-profiles.js';

export function fireClimaxEvent(engine, p, dest) {
    const ctx = engine.ctx;
    const base = p.rootFreq;
    const profile = engine._tensionProfile || engine._getTensionProfile(p);
    const ratios = profile.climaxRatios || DEFAULT_TENSION_PROFILE.climaxRatios;
    ratios.forEach((ratio, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const pan = ctx.createStereoPanner();
        o.type = engine._resolveOscType(p.ac.padWave);
        o.frequency.value = base * ratio;
        pan.pan.value = ratios.length > 1
            ? ((i / (ratios.length - 1)) * 0.9) - 0.45
            : 0;

        const now = ctx.currentTime + i * profile.climaxSpacing;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(profile.climaxGain, now + 2.5);
        g.gain.linearRampToValueAtTime(profile.climaxGain, now + profile.climaxHold);
        g.gain.linearRampToValueAtTime(0, now + profile.climaxRelease);

        o.connect(pan);
        pan.connect(g);
        g.connect(dest);
        o.start(now);
        o.stop(now + profile.climaxRelease + 1);
        engine.nodes.push(o, g, pan);
    });

    // Brief master swell.
    const mg = engine.masterGain;
    const now = ctx.currentTime;
    mg.gain.linearRampToValueAtTime(engine._vol * profile.climaxMasterBoost, now + 3);
    mg.gain.linearRampToValueAtTime(engine._vol, now + Math.max(8, profile.climaxHold + 2));
}

export function startTensionArcLoop(engine, p, filt) {
    const ctx = engine.ctx;
    const base = engine.tensionBase;
    const profile = engine._tensionProfile = engine._getTensionProfile(p);
    engine.tension = 0;
    engine._tensionBaseValue = 0;
    engine._tensionTick = 0;
    engine._tensionSurge = 0;
    engine._tensionState = { phase: 'DORMANT', energy: 0, cyclePos: 0, pocket: 0.5 };
    engine._climaxFired = false;
    engine._climaxStartedDrain = false;

    const runTensionArcStep = () => {
        if (!engine.playing) return;
        const nyquist = ctx.sampleRate / 2;
        const arcRng = new RNG(p.seed + 88000 + engine._tensionTick);
        const density = engine._clamp(p.melodyDensity || 0.05, 0.01, 0.35);
        const wave = Math.sin((engine._tensionTick + profile.phaseOffset) * profile.pulseRate) * profile.pulseDepth;

        if (!engine._climaxStartedDrain) {
            const surgeHit = arcRng.range(0, 1) < profile.surgeChance
                ? arcRng.range(profile.surgeAmount * 0.35, profile.surgeAmount)
                : 0;
            const drift = arcRng.range(-profile.riseVariance, profile.riseVariance);
            engine._tensionSurge = Math.max(0, engine._tensionSurge * profile.surgeDecay + surgeHit - profile.surgeAmount * 0.08);
            engine._tensionBaseValue = engine._clamp(
                engine._tensionBaseValue + profile.riseRate + ((density - 0.08) * 0.05) + drift + (wave * profile.pulseLift),
                0,
                1
            );
        } else {
            engine._tensionSurge *= 0.45;
            engine._tensionBaseValue = Math.max(profile.floor, engine._tensionBaseValue - profile.drainRate);
            if (engine._tensionBaseValue <= profile.reset) {
                engine._climaxFired = false;
                engine._climaxStartedDrain = false;
            }
        }

        engine.tension = engine._clamp(engine._tensionBaseValue + wave + engine._tensionSurge, 0, 1);
        engine._tensionTick++;
        const prevPhase = engine._tensionState?.phase || 'DORMANT';
        const state = engine._getTensionState(p, engine.stepPerc || 0);
        engine._tensionState = state;
        engine._lastTensionPhase = state.phase;

        if (prevPhase !== state.phase && !(prevPhase === 'DORMANT' && state.phase === 'STIR')) {
            if ((ctx.currentTime - engine._lastPhaseEventTime) > 1.25) {
                engine._lastPhaseEventTime = ctx.currentTime;
                engine._firePhaseTransitionEvent(p, filt, prevPhase, state.phase);
            }
        }
        if (ctx.currentTime >= engine._macroEventCooldownUntil) {
            const macroChance = engine._getMacroEventChance(p.biome.id, state);
            if (arcRng.range(0, 1) < macroChance) {
                engine._fireSignatureMacroEvent(p, filt, state);
                engine._macroEventCooldownUntil = ctx.currentTime + engine._getMacroEventCooldown(p.biome.id, state.phase, arcRng);
            }
        }

        const tSq = state.energy * state.energy;
        const lfoDepth = (base ? base.lfoRate : 0.1) * 1000 * state.energy;
        const safeCeiling = nyquist - lfoDepth - 400;

        if (engine.tensionLfos) {
            engine.tensionLfos.forEach((lg) => {
                const reduction = 1.0 - (state.energy * 0.7);
                const originalDepth = base ? base.filtFreq * 0.20 : 200;
                lg.gain.linearRampToValueAtTime(originalDepth * reduction, ctx.currentTime + 2);
            });
        }

        const newFiltFreq = Math.min(
            (base ? base.filtFreq : 1000) * (1 + state.energy * profile.filterMul),
            safeCeiling
        );
        if (engine.tensionFilt) {
            engine.tensionFilt.frequency.linearRampToValueAtTime(
                Math.max(20, newFiltFreq), ctx.currentTime + 2
            );
        }
        if (engine.fmModGainNode && engine.fmIndexBase) {
            const newIndex = engine.fmIndexBase * (1 + tSq * profile.fmMul);
            engine.fmModGainNode.gain.linearRampToValueAtTime(
                newIndex, ctx.currentTime + 2
            );
        }

        engine._emitState();

        if (state.energy >= profile.climaxThreshold && !engine._climaxFired) {
            engine._climaxFired = true;
            fireClimaxEvent(engine, p, filt);
        }
        if (engine._climaxFired && state.energy >= 0.98) {
            engine._climaxStartedDrain = true;
        }
    };

    const tensionScheduled = engine._scheduleRecurringChannel(
        'tension',
        2,
        () => runTensionArcStep()
    );
    if (!tensionScheduled) {
        engine.intervals.push(setInterval(() => runTensionArcStep(), 2000));
    }
}

