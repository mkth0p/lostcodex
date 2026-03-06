# V1 vs V2 Identity Baseline

Generated: 2026-03-06  
Source snapshots:
- `docs/sonic-diagnostics-v1.json`
- `docs/sonic-diagnostics-v2.json`
- `docs/engine-smoke-v1.json`
- `docs/engine-smoke-v2.json`

## Harness

Use a local server (example: `python -m http.server 8765`) and run:

```bash
npm run diag:identity:v1
npm run diag:identity:v2
```

Defaults are now a 30-planet corpus (`scripts/v2-sonic-diagnostics.mjs`).

## Current Aggregate Snapshot

The current committed snapshots were captured on a 10-planet subset and are kept as the reference anchor until the 30-planet refresh is committed.

| Metric | V1 | V2 | Notes |
|---|---:|---:|---|
| Planet count | 10 | 10 | Subset run |
| Active node mean | 152.85 | 160.46 | Similar engine load class |
| Active node peak (max) | 322 | 343 | Slightly higher V2 ceiling |
| Mean load | 0.1457 | 0.1395 | No CPU starvation regression |
| Chord count mean | 2.20 | 4.00 | V2 churn still higher |
| Melody mode count mean | 2.60 | 1.90 | V2 variety still lower |
| Section count mean | 1.30 | 1.90 | V2 form moving more frequently |
| Event rate mean (events/s) | 0.234 | 1.530 | V2 busier scheduler output |
| Drone presence ratio | 0.000 | 1.000 | V2 drone path active |
| LUFS mean | -24.00 | -39.85 | V2 remains under-target loudness |
| Pre-limiter peak mean (dB) | -60.00 | -33.46 | V2 still quieter than target |

## Acceptance Targets (R2.2)

- Chord hold behavior aligned to pace class:
  - `slow`: 6-24 bars
  - `medium`: 3-10 bars
  - `fast`: 1-6 bars
- Melody mode diversity should not collapse versus V1 corpus behavior.
- Drone audibility should remain stable and non-flooring for active drone profiles.
- Maintain deterministic parity for same seed + mode + settings.

## Notes

- `Drone Aud` telemetry is now calibrated from drone state + mix telemetry and no longer depends only on mix peak floor.
- V2 drone floor and layer contracts were raised to reduce masking and improve ambient body persistence.
