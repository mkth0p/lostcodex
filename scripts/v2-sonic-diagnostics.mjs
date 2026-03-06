import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLANET_CORPUS_CODES } from './planet-corpus.js';

async function loadPlaywright() {
    try {
        return await import('playwright');
    } catch {
        return null;
    }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function mean(values = []) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values = []) {
    if (!values.length) return 0;
    const avg = mean(values);
    const variance = mean(values.map((value) => (value - avg) ** 2));
    return Math.sqrt(variance);
}

function summarize(samples = []) {
    const activeNodes = samples.map((s) => s.debug.activeNodes || 0);
    const load = samples.map((s) => s.debug.load || 0);
    const sections = new Set(samples.map((s) => s.debug.section || s.debug.tensionPhase || 'none'));
    const chords = new Set(samples.map((s) => s.chord || '').filter(Boolean));
    const melodyModes = new Set(samples.map((s) => s.melody.mode || '').filter(Boolean));

    const arrangementEnergyValues = samples
        .map((s) => s.debug.arrangementEnergy)
        .filter((value) => Number.isFinite(value));
    const lufsValues = samples
        .map((s) => s.debug.mix?.integratedLufs)
        .filter((value) => Number.isFinite(value));
    const peakDbValues = samples
        .map((s) => s.debug.mix?.preLimiterPeakDb)
        .filter((value) => Number.isFinite(value));
    const eventRateValues = samples
        .map((s) => s.debug.eventRate)
        .filter((value) => Number.isFinite(value));

    const droneActiveSamples = samples.filter((s) => {
        const drone = s.debug.drone || {};
        return (drone.loopFill || 0) > 0.01
            || (drone.resonatorEnergy || 0) > 0.02
            || (drone.ambienceDepth || 0) > 0.08
            || (drone.modAmount || 0) > 0.05;
    }).length;

    return {
        sampleCount: samples.length,
        activeNodeMean: mean(activeNodes),
        activeNodePeak: Math.max(0, ...activeNodes),
        loadMean: mean(load),
        sectionCount: sections.size,
        sections: [...sections],
        chordCount: chords.size,
        chords: [...chords],
        melodyModeCount: melodyModes.size,
        melodyModes: [...melodyModes],
        arrangementEnergyMean: mean(arrangementEnergyValues),
        arrangementEnergyStd: std(arrangementEnergyValues),
        lufsMean: mean(lufsValues),
        peakDbMean: mean(peakDbValues),
        eventRateMean: mean(eventRateValues),
        dronePresenceRatio: samples.length ? droneActiveSamples / samples.length : 0,
    };
}

async function run() {
    const playwright = await loadPlaywright();
    if (!playwright?.chromium) {
        console.error('Playwright is not installed.');
        process.exit(1);
    }

    const url = process.argv[2] || 'http://127.0.0.1:8765/synth.html?engine=v2';
    const durationMs = Number(process.argv[3] || 12000);
    const maxPlanets = Number(process.argv[4] || 30);
    const intervalMs = Number(process.argv[5] || 300);
    const outputFile = process.argv[6] || 'docs/v2-sonic-diagnostics.json';

    const corpus = PLANET_CORPUS_CODES.slice(0, clamp(maxPlanets, 1, PLANET_CORPUS_CODES.length));
    const browser = await playwright.chromium.launch({
        headless: true,
        args: ['--autoplay-policy=no-user-gesture-required'],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__LC_SYNTH_DEBUG__);

    const planets = [];
    for (let i = 0; i < corpus.length; i++) {
        const code = corpus[i];
        console.log(`[${i + 1}/${corpus.length}] ${code}`);
        await page.evaluate((value) => {
            window.__LC_SYNTH_DEBUG__.setAddressFromCode(value);
            window.__LC_SYNTH_DEBUG__.start();
        }, code);

        const start = Date.now();
        const samples = [];
        while (Date.now() - start < durationMs) {
            const sample = await page.evaluate(() => {
                const debug = window.__LC_SYNTH_DEBUG__.getDebugState();
                const melody = window.__LC_SYNTH_DEBUG__.getMelodyState();
                const chord = document.getElementById('chord-display')?.textContent?.trim() || '';
                return { debug, melody, chord };
            });
            samples.push(sample);
            await page.waitForTimeout(intervalMs);
        }

        await page.evaluate(() => window.__LC_SYNTH_DEBUG__.stop());
        planets.push({ code, summary: summarize(samples) });
    }

    const payload = {
        generatedAt: new Date().toISOString(),
        url,
        durationMs,
        intervalMs,
        corpusSize: corpus.length,
        planets,
        aggregate: summarize(planets.flatMap((entry) => {
            const synthetic = [];
            const count = Math.max(1, entry.summary.sampleCount || 1);
            for (let i = 0; i < count; i++) {
                synthetic.push({
                    debug: {
                        activeNodes: entry.summary.activeNodeMean,
                        load: entry.summary.loadMean,
                        section: entry.summary.sections[0] || 'none',
                        arrangementEnergy: entry.summary.arrangementEnergyMean,
                        eventRate: entry.summary.eventRateMean,
                        mix: {
                            integratedLufs: entry.summary.lufsMean,
                            preLimiterPeakDb: entry.summary.peakDbMean,
                        },
                        drone: {
                            loopFill: entry.summary.dronePresenceRatio,
                            resonatorEnergy: entry.summary.dronePresenceRatio,
                            ambienceDepth: entry.summary.dronePresenceRatio,
                            modAmount: entry.summary.dronePresenceRatio,
                        },
                    },
                    melody: { mode: entry.summary.melodyModes[0] || '' },
                    chord: entry.summary.chords[0] || '',
                });
            }
            return synthetic;
        })),
    };

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const repoRoot = path.resolve(__dirname, '..');
    const outPath = path.resolve(repoRoot, outputFile);
    fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    await browser.close();
    console.log(`Wrote ${outPath}`);
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
