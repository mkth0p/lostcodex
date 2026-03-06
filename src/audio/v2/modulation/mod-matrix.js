const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const DEFAULT_MACRO_CONTROLS = {
    complexity: 0.5,
    motion: 0.5,
    dissonance: 0.35,
    texture: 0.5,
    space: 0.5,
    stability: 0.55,
};

export function normalizeMacroControls(input = {}) {
    return {
        complexity: clamp(Number.isFinite(input.complexity) ? input.complexity : DEFAULT_MACRO_CONTROLS.complexity, 0, 1),
        motion: clamp(Number.isFinite(input.motion) ? input.motion : DEFAULT_MACRO_CONTROLS.motion, 0, 1),
        dissonance: clamp(Number.isFinite(input.dissonance) ? input.dissonance : DEFAULT_MACRO_CONTROLS.dissonance, 0, 1),
        texture: clamp(Number.isFinite(input.texture) ? input.texture : DEFAULT_MACRO_CONTROLS.texture, 0, 1),
        space: clamp(Number.isFinite(input.space) ? input.space : DEFAULT_MACRO_CONTROLS.space, 0, 1),
        stability: clamp(Number.isFinite(input.stability) ? input.stability : DEFAULT_MACRO_CONTROLS.stability, 0, 1),
    };
}

export class ModMatrix {
    constructor(macroControls = DEFAULT_MACRO_CONTROLS) {
        this.setMacros(macroControls);
    }

    setMacros(nextMacros = {}) {
        this.macros = normalizeMacroControls({
            ...this.macros,
            ...nextMacros,
        });
    }

    resolve({ sectionEnergy = 0.2, section = 'INTRO', tension = 0, qualityScalar = 1 } = {}) {
        const m = this.macros;
        const sectionLift = section === 'SURGE'
            ? 0.16
            : section === 'GROWTH'
                ? 0.08
                : section === 'RELEASE'
                    ? -0.05
                    : 0;
        const complexity = clamp(m.complexity + sectionLift + sectionEnergy * 0.12, 0, 1);
        const dissonance = clamp(m.dissonance + (1 - m.stability) * 0.18 + tension * 0.1, 0, 1);
        const motion = clamp(m.motion + sectionEnergy * 0.1 - (1 - qualityScalar) * 0.22, 0, 1);
        const texture = clamp(m.texture + complexity * 0.13 - (1 - qualityScalar) * 0.2, 0, 1);
        const space = clamp(m.space + (section === 'AFTERGLOW' ? 0.08 : 0), 0, 1);

        return {
            complexity,
            dissonance,
            motion,
            texture,
            space,
            stability: m.stability,
            melodyRateMul: clamp(0.66 + complexity * 0.48, 0.58, 1.25),
            percussionDensityMul: clamp(0.42 + complexity * 0.3 + motion * 0.14, 0.26, 0.9),
            fillChanceMul: clamp(0.3 + complexity * 0.3 + dissonance * 0.16, 0.18, 0.88),
            ambienceGainMul: clamp(0.72 + texture * 0.34 + space * 0.3, 0.6, 1.35),
            widthMul: clamp(0.65 + space * 0.6 + motion * 0.2, 0.5, 1.5),
        };
    }
}
