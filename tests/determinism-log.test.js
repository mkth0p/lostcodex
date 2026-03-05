import { describe, expect, it } from 'vitest';
import { buildDeterminismEventLog } from '../src/audio/subsystems/determinism-log.js';
import { generatePlanet } from '../src/planet.js';
import { decodeAddress } from '../src/ui/shared/address-codec.js';

function codeToPlanet(code) {
    const address = decodeAddress(code);
    return generatePlanet(address);
}

describe('determinism event log', () => {
    it('produces byte-identical logs for repeated strict-mode simulations', () => {
        const planet = codeToPlanet('0123456789ab');
        const runA = buildDeterminismEventLog(planet, { steps: 96 });
        const runB = buildDeterminismEventLog(planet, { steps: 96 });

        expect(JSON.stringify(runB)).toBe(JSON.stringify(runA));
    });

    it('changes event decisions for different seeds', () => {
        const planetA = codeToPlanet('0123456789ab');
        const planetB = codeToPlanet('fedcba9876543210');
        const runA = buildDeterminismEventLog(planetA, { steps: 64 });
        const runB = buildDeterminismEventLog(planetB, { steps: 64 });

        expect(JSON.stringify(runA)).not.toBe(JSON.stringify(runB));
    });

    it('includes chord, melody, and percussion channels', () => {
        const planet = codeToPlanet('tttt0000aaaa');
        const log = buildDeterminismEventLog(planet, { steps: 48 });

        expect(log.steps).toBe(48);
        expect(log.chords.length).toBe(48);
        expect(log.melody.length).toBe(48);
        expect(log.percussion.length).toBe(48);
        expect(log.chords[0]).toHaveProperty('chord');
        expect(log.melody[0]).toHaveProperty('mode');
        expect(log.percussion[0]).toHaveProperty('hits');
    });
});

