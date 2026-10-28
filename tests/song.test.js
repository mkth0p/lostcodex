import { describe, expect, it } from 'vitest';
import { createPiece } from '../src/score/piece.js';
import { Score } from '../src/score/score.js';

const CODES = ['neon-01', 'neon-03', 'neon-07', 'neon-12'];

describe('song form', () => {
    it('lays sections end to end on bar lines, with a build before every drop', () => {
        for (const code of CODES) {
            const score = new Score(createPiece(code));
            const plan = score.plan;
            expect(plan, code).toBeTruthy();
            plan.index(30);
            for (let i = 0; i < plan.sections.length; i++) {
                const s = plan.sections[i];
                expect(Math.abs(s.start / plan.bar - Math.round(s.start / plan.bar))).toBeLessThan(1e-9);
                if (i) expect(s.start).toBe(plan.sections[i - 1].end);
                if (plan.isDrop(s)) expect(plan.sections[i - 1].type, code).toBe('build');
            }
        }
    });

    it('high-passes the build, pulls the dry signal in the gap, and opens up on the drop', () => {
        const score = new Score(createPiece('neon-03'));
        const plan = score.plan;
        const build = plan.sections.find((s) => s.type === 'build') || plan.index(1);
        expect(score.mix(build.start + 0.01).hp).toBeLessThan(40);
        expect(score.mix(plan.gap(build) - 0.05).hp).toBeGreaterThan(300);
        expect(score.mix(plan.gap(build) + 0.01).dry).toBeLessThan(0.2);
        expect(score.mix(build.end + 0.01)).toEqual({ hp: 28, dry: 1 });
    });

    it('holds a tension chord through each build and lands on the tonic at each drop', () => {
        for (const code of CODES) {
            const score = new Score(createPiece(code));
            const { plan, harmony } = score;
            plan.at(600);
            for (const s of plan.sections) {
                if (s.end > 590) break;
                if (s.type === 'build') {
                    const c = harmony.chordAt(s.start + 0.1);
                    expect([6, 4, 5], code).toContain(c.rootDegree);
                    expect(c.end, code).toBeGreaterThanOrEqual(s.end - 1e-6);
                }
                if (plan.isDrop(s)) {
                    const c = harmony.chordAt(s.start + 0.01);
                    expect(c.rootDegree, code).toBe(0);
                }
            }
        }
    });

    it('plays the same song every time', () => {
        const a = new Score(createPiece('neon-05'));
        const b = new Score(createPiece('neon-05'));
        expect(a.collect(300)).toEqual(b.collect(300));
    });
});
