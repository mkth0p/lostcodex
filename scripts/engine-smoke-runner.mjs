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

function formatDuration(ms) {
    const totalSec = Math.max(0, Math.round(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}m${sec.toString().padStart(2, '0')}s`;
}

function summariseSamples(samples, sampleIntervalMs = 250) {
    const nodePeaks = samples.map((sample) => sample.debug.activeNodes || 0);
    const loadValues = samples.map((sample) => sample.debug.load || 0);
    const stepValues = samples.map((sample) => sample.debug.stepMs || 0).filter(Boolean);
    const lateCounts = samples.map((sample) => sample.debug.schedulerLateCallbacks || 0);
    const latePeaks = samples.map((sample) => sample.debug.schedulerMaxLateMs || 0);
    const intervalJitter = [];
    let phaseTransitions = 0;
    let lastPhase = null;

    for (let i = 1; i < samples.length; i++) {
        const deltaMs = samples[i].atMs - samples[i - 1].atMs;
        intervalJitter.push(Math.abs(deltaMs - sampleIntervalMs));
    }

    samples.forEach((sample) => {
        const phase = sample.debug.tensionPhase;
        if (!phase) return;
        if (lastPhase && lastPhase !== phase) phaseTransitions++;
        lastPhase = phase;
    });

    return {
        sampleCount: samples.length,
        activeNodePeak: Math.max(0, ...nodePeaks),
        activeNodeMean: nodePeaks.length ? nodePeaks.reduce((a, b) => a + b, 0) / nodePeaks.length : 0,
        loadMean: loadValues.length ? loadValues.reduce((a, b) => a + b, 0) / loadValues.length : 0,
        stepMsMean: stepValues.length ? stepValues.reduce((a, b) => a + b, 0) / stepValues.length : 0,
        schedulerLateCallbacksPeak: Math.max(0, ...lateCounts),
        schedulerMaxLateMsPeak: Math.max(0, ...latePeaks),
        sampleIntervalJitterMeanMs: intervalJitter.length
            ? intervalJitter.reduce((a, b) => a + b, 0) / intervalJitter.length
            : 0,
        sampleIntervalJitterPeakMs: Math.max(0, ...intervalJitter),
        phaseTransitions,
        tensionPhases: [...new Set(samples.map((sample) => sample.debug.tensionPhase).filter(Boolean))],
    };
}

async function captureRecordingSnapshot(page, code, durationMs) {
    return page.evaluate(async ({ captureCode, captureDurationMs }) => {
        const api = window.__LC_SYNTH_DEBUG__;
        const stream = api?.getRecordingStream ? api.getRecordingStream() : null;
        if (!stream || typeof MediaRecorder === 'undefined') {
            return {
                code: captureCode,
                ok: false,
                reason: 'MediaRecorder or recording stream unavailable',
            };
        }

        const preferredTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg',
            'audio/mp4',
        ];
        let mimeType = '';
        if (typeof MediaRecorder.isTypeSupported === 'function') {
            mimeType = preferredTypes.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
        }

        const recorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);
        const chunks = [];
        recorder.ondataavailable = (event) => {
            if (event?.data?.size > 0) chunks.push(event.data);
        };

        const stopped = new Promise((resolve) => {
            recorder.onstop = () => resolve();
        });

        recorder.start();
        await new Promise((resolve) => setTimeout(resolve, captureDurationMs));
        recorder.stop();
        await stopped;

        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }

        return {
            code: captureCode,
            ok: true,
            mimeType: blob.type || recorder.mimeType || mimeType || 'audio/webm',
            byteLength: bytes.length,
            base64: btoa(binary),
        };
    }, { captureCode: code, captureDurationMs: durationMs });
}

async function run() {
    const playwright = await loadPlaywright();
    if (!playwright?.chromium) {
        console.error('Playwright is not installed. Install it and rerun: npm i -D playwright');
        process.exit(1);
    }

    const targetUrl = process.argv[2] || 'http://127.0.0.1:8080/synth.html';
    const sampleDurationMs = Number(process.argv[3] || 30000);
    const maxPlanets = Number(process.argv[4] || Math.min(12, PLANET_CORPUS_CODES.length));
    const sampleIntervalMs = Number(process.argv[5] || 250);
    const captureCount = Math.max(0, Number(process.argv[6] || 3));
    const captureDurationMs = Number(process.argv[7] || 10000);
    const progressLogEveryMs = Math.max(0, Number(process.argv[8] || 5000));
    const corpus = PLANET_CORPUS_CODES.slice(0, Math.max(1, Math.min(maxPlanets, PLANET_CORPUS_CODES.length)));

    console.log(
        `Smoke run config: planets=${corpus.length}, sampleDuration=${formatDuration(sampleDurationMs)}, sampleInterval=${sampleIntervalMs}ms, captures=${captureCount}`
    );

    const browser = await playwright.chromium.launch({
        headless: true,
        args: ['--autoplay-policy=no-user-gesture-required'],
    });

    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__LC_SYNTH_DEBUG__);

    const report = [];
    const captureArtifacts = [];
    const runStartedAt = Date.now();
    for (let index = 0; index < corpus.length; index++) {
        const code = corpus[index];
        const planetStartedAt = Date.now();
        console.log(`[${index + 1}/${corpus.length}] start ${code}`);
        await page.evaluate((value) => {
            window.__LC_SYNTH_DEBUG__.setAddressFromCode(value);
            window.__LC_SYNTH_DEBUG__.start();
        }, code);

        const startAt = Date.now();
        let nextProgressLogMs = progressLogEveryMs;
        const samples = [];
        while (Date.now() - startAt < sampleDurationMs) {
            const debug = await page.evaluate(() => window.__LC_SYNTH_DEBUG__.getDebugState());
            const elapsedMs = Date.now() - startAt;
            samples.push({ atMs: elapsedMs, debug });
            if (progressLogEveryMs > 0 && elapsedMs >= nextProgressLogMs) {
                const progressPct = Math.round((elapsedMs / sampleDurationMs) * 100);
                console.log(
                    `[${index + 1}/${corpus.length}] ${code} sampling ${formatDuration(elapsedMs)} / ${formatDuration(sampleDurationMs)} (${Math.min(progressPct, 100)}%)`
                );
                nextProgressLogMs += progressLogEveryMs;
            }
            await page.waitForTimeout(sampleIntervalMs);
        }

        if (index < captureCount) {
            console.log(`[${index + 1}/${corpus.length}] capturing ${code} (${formatDuration(captureDurationMs)})`);
            captureArtifacts.push(await captureRecordingSnapshot(page, code, captureDurationMs));
        }

        await page.evaluate(() => window.__LC_SYNTH_DEBUG__.stop());
        const summary = summariseSamples(samples, sampleIntervalMs);
        report.push({
            code,
            summary,
        });
        const elapsedMs = Date.now() - runStartedAt;
        const completed = index + 1;
        const avgPerPlanetMs = elapsedMs / completed;
        const remainingMs = avgPerPlanetMs * (corpus.length - completed);
        console.log(
            `[${completed}/${corpus.length}] done ${code} in ${formatDuration(Date.now() - planetStartedAt)} | peakNodes=${summary.activeNodePeak} loadMean=${summary.loadMean.toFixed(3)} | eta=${formatDuration(remainingMs)}`
        );
    }

    await browser.close();

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const repoRoot = path.resolve(__dirname, '..');
    const captureDir = path.join(repoRoot, 'docs', 'engine-smoke-captures');
    fs.mkdirSync(captureDir, { recursive: true });
    const captureManifest = [];
    captureArtifacts.forEach((artifact) => {
        if (!artifact?.ok) {
            captureManifest.push({
                code: artifact?.code || 'unknown',
                status: 'skipped',
                reason: artifact?.reason || 'capture failed',
            });
            return;
        }

        const ext = artifact.mimeType.includes('ogg')
            ? 'ogg'
            : artifact.mimeType.includes('mp4')
                ? 'm4a'
                : 'webm';
        const fileName = `${artifact.code}.${ext}`;
        const filePath = path.join(captureDir, fileName);
        fs.writeFileSync(filePath, Buffer.from(artifact.base64, 'base64'));
        captureManifest.push({
            code: artifact.code,
            status: 'written',
            file: path.relative(repoRoot, filePath).replaceAll('\\', '/'),
            mimeType: artifact.mimeType,
            byteLength: artifact.byteLength,
        });
    });

    const outputPath = path.join(repoRoot, 'docs', 'engine-smoke-latest.json');
    const payload = {
        generatedAt: new Date().toISOString(),
        targetUrl,
        sampleDurationMs,
        sampleIntervalMs,
        corpusSize: corpus.length,
        captureCount,
        captureDurationMs,
        progressLogEveryMs,
        captures: captureManifest,
        planets: report,
    };
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Completed smoke run in ${formatDuration(Date.now() - runStartedAt)}.`);
    console.log(`Wrote ${outputPath}`);
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
