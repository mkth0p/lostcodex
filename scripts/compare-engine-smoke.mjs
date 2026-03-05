import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function safePctDelta(latest, baseline) {
    if (!Number.isFinite(latest) || !Number.isFinite(baseline)) return 0;
    const denom = Math.max(Math.abs(baseline), 0.0001);
    return ((latest - baseline) / denom) * 100;
}

function summariseRegression(baseline, latest, thresholdPct) {
    const baselineByCode = new Map((baseline.planets || []).map((entry) => [entry.code, entry.summary || {}]));
    const latestByCode = new Map((latest.planets || []).map((entry) => [entry.code, entry.summary || {}]));
    const codes = [...latestByCode.keys()].filter((code) => baselineByCode.has(code));

    const metrics = [
        'activeNodePeak',
        'loadMean',
        'schedulerMaxLateMsPeak',
        'sampleIntervalJitterPeakMs',
    ];

    const failures = [];
    const rows = [];
    codes.forEach((code) => {
        const baseSummary = baselineByCode.get(code);
        const latestSummary = latestByCode.get(code);
        metrics.forEach((metric) => {
            const baseValue = Number(baseSummary[metric] || 0);
            const latestValue = Number(latestSummary[metric] || 0);
            const deltaPct = safePctDelta(latestValue, baseValue);
            const regressed = deltaPct > thresholdPct;
            rows.push({
                code,
                metric,
                baseline: baseValue,
                latest: latestValue,
                deltaPct,
                regressed,
            });
            if (regressed) failures.push({ code, metric, baseline: baseValue, latest: latestValue, deltaPct });
        });
    });

    return { rows, failures };
}

function formatNumber(value) {
    return Number.isFinite(value) ? value.toFixed(3) : 'n/a';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const baselinePath = path.resolve(repoRoot, process.argv[2] || 'docs/engine-smoke-baseline.json');
const latestPath = path.resolve(repoRoot, process.argv[3] || 'docs/engine-smoke-latest.json');
const thresholdPct = Number(process.argv[4] || 10);

if (!fs.existsSync(baselinePath)) {
    console.error(`Missing baseline file: ${baselinePath}`);
    process.exit(1);
}
if (!fs.existsSync(latestPath)) {
    console.error(`Missing latest smoke file: ${latestPath}`);
    process.exit(1);
}

const baseline = readJson(baselinePath);
const latest = readJson(latestPath);
const { rows, failures } = summariseRegression(baseline, latest, thresholdPct);

console.log(`Compared ${rows.length} metric rows with threshold ${thresholdPct}%`);
rows.forEach((row) => {
    const label = row.regressed ? 'REGRESSION' : 'ok';
    console.log(
        `${label} ${row.code} ${row.metric}: baseline=${formatNumber(row.baseline)} latest=${formatNumber(row.latest)} delta=${row.deltaPct.toFixed(2)}%`
    );
});

if (failures.length) {
    console.error(`Detected ${failures.length} regressions above threshold.`);
    process.exit(1);
}

console.log('Smoke regression check passed.');
