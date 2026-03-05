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

function summariseSamples(samples) {
    const nodePeaks = samples.map((sample) => sample.debug.activeNodes || 0);
    const loadValues = samples.map((sample) => sample.debug.load || 0);
    const stepValues = samples.map((sample) => sample.debug.stepMs || 0).filter(Boolean);

    return {
        sampleCount: samples.length,
        activeNodePeak: Math.max(0, ...nodePeaks),
        activeNodeMean: nodePeaks.length ? nodePeaks.reduce((a, b) => a + b, 0) / nodePeaks.length : 0,
        loadMean: loadValues.length ? loadValues.reduce((a, b) => a + b, 0) / loadValues.length : 0,
        stepMsMean: stepValues.length ? stepValues.reduce((a, b) => a + b, 0) / stepValues.length : 0,
        tensionPhases: [...new Set(samples.map((sample) => sample.debug.tensionPhase).filter(Boolean))],
    };
}

async function run() {
    const playwright = await loadPlaywright();
    if (!playwright?.chromium) {
        console.error('Playwright is not installed. Install it and rerun: npm i -D playwright');
        process.exit(1);
    }

    const targetUrl = process.argv[2] || 'http://127.0.0.1:8080/synth.html';
    const sampleDurationMs = Number(process.argv[3] || 3000);
    const maxPlanets = Number(process.argv[4] || 5);
    const corpus = PLANET_CORPUS_CODES.slice(0, Math.max(1, Math.min(maxPlanets, PLANET_CORPUS_CODES.length)));

    const browser = await playwright.chromium.launch({
        headless: true,
        args: ['--autoplay-policy=no-user-gesture-required'],
    });

    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__LC_SYNTH_DEBUG__);

    const report = [];
    for (const code of corpus) {
        await page.evaluate((value) => {
            window.__LC_SYNTH_DEBUG__.setAddressFromCode(value);
            window.__LC_SYNTH_DEBUG__.start();
        }, code);

        const startAt = Date.now();
        const samples = [];
        while (Date.now() - startAt < sampleDurationMs) {
            const debug = await page.evaluate(() => window.__LC_SYNTH_DEBUG__.getDebugState());
            samples.push({ atMs: Date.now() - startAt, debug });
            await page.waitForTimeout(250);
        }

        await page.evaluate(() => window.__LC_SYNTH_DEBUG__.stop());
        report.push({
            code,
            summary: summariseSamples(samples),
        });
    }

    await browser.close();

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const repoRoot = path.resolve(__dirname, '..');
    const outputPath = path.join(repoRoot, 'docs', 'engine-smoke-latest.json');
    const payload = {
        generatedAt: new Date().toISOString(),
        targetUrl,
        sampleDurationMs,
        planets: report,
    };
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${outputPath}`);
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
