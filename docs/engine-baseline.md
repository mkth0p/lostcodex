# Engine Baseline

Generated: 2026-03-05T10:06:50.931Z

## Corpus

- Size: 30
- Source: `scripts/planet-corpus.js`

## Aggregate Metrics

- BPM min/max/avg: 63 / 177 / 115.53
- Step count min/max: 5 / 16
- Step count distribution: 5:1, 6:3, 7:2, 9:3, 12:1, 16:20
- Biome distribution: crystalline:10, corrupted:3, glacial:3, storm:2, desert:1, ethereal:1, abyssal:3, volcanic:3, quantum:2, fungal:1, arctic:1

## Planet Table

| # | Code | Biome | BPM | Steps | Root Hz | Progression |
|---|---|---|---:|---:|---:|---|
| 1 | `01234` | crystalline | 143 | 16 | 36.7 | ii - V - I - vi |
| 2 | `56789` | corrupted | 70 | 16 | 49.0 | vi - IV - I - V |
| 3 | `abcde` | glacial | 90 | 6 | 65.4 | I - V - ii - IV |
| 4 | `fghij` | storm | 167 | 16 | 87.3 | I - V - ii - IV |
| 5 | `klmno` | desert | 73 | 16 | 116.5 | I - V - vi - IV |
| 6 | `pqrst` | ethereal | 138 | 16 | 38.9 | I - IV - I - V |
| 7 | `00000` | crystalline | 154 | 16 | 32.7 | I - IV - I - V |
| 8 | `ttttt` | abyssal | 63 | 9 | 43.6 | I - iii - vi - IV |
| 9 | `02468ace` | crystalline | 131 | 16 | 41.2 | ii - V - I - vi |
| 10 | `13579bdf` | volcanic | 151 | 16 | 43.6 | ii - V - I - vi |
| 11 | `0a1b2c3d4e` | crystalline | 104 | 16 | 34.6 | I - iii - vi - IV |
| 12 | `9h8g7f6e5d` | quantum | 110 | 7 | 51.9 | I - IV - I - V |
| 13 | `0123456789ab` | crystalline | 177 | 16 | 36.7 | I - V - ii - IV |
| 14 | `bcdefghijklm` | fungal | 112 | 12 | 69.3 | I - V - ii - IV |
| 15 | `mnopqrstabcd` | corrupted | 100 | 16 | 32.7 | I - iii - vi - IV |
| 16 | `tttt0000aaaa` | abyssal | 99 | 9 | 43.6 | ii - V - I - vi |
| 17 | `0t0t0t0t0t0t` | crystalline | 155 | 16 | 32.7 | I - iii - vi - IV |
| 18 | `123456789abcde` | volcanic | 81 | 16 | 38.9 | vi - IV - I - V |
| 19 | `edcba987654321` | arctic | 149 | 5 | 65.4 | I - IV - I - V |
| 20 | `abcdef012345678` | glacial | 85 | 6 | 65.4 | ii - V - I - vi |
| 21 | `9876543210fedcb` | quantum | 162 | 7 | 49.0 | I - vi - IV - V |
| 22 | `0123456789abcdef` | crystalline | 132 | 16 | 36.7 | ii - V - I - vi |
| 23 | `fedcba9876543210` | storm | 123 | 16 | 69.3 | I - V - ii - IV |
| 24 | `aaaabbbbccccdddd` | glacial | 104 | 6 | 58.3 | ii - V - I - vi |
| 25 | `0123abcd4567efgh` | crystalline | 103 | 16 | 36.7 | I - IV - I - V |
| 26 | `0f1g2h3i4j5k6l7m` | crystalline | 67 | 16 | 34.6 | I - V - ii - IV |
| 27 | `mnopqrstmnopqrst` | corrupted | 65 | 16 | 32.7 | I - vi - IV - V |
| 28 | `0000aaaabbbbtttt` | crystalline | 80 | 16 | 32.7 | I - vi - IV - V |
| 29 | `1234abcd5678efghij` | volcanic | 165 | 16 | 38.9 | I - V - vi - IV |
| 30 | `t9876543210abcdefgh` | abyssal | 113 | 9 | 51.9 | I - IV - I - V |

## Notes

- This baseline is generated from deterministic planet metadata (no audio runtime sampling).
- Use `npm run smoke:engine` for runtime `AudioEngine` start/stop and `getDebugState()` sampling in a real browser.
- Default smoke run is a quick profile (12 planets, 30 seconds each, 3 captures) and now prints live progress: `npm run smoke:engine -- http://127.0.0.1:8080/synth.html`.
- Full corpus profile (30 planets, 60 seconds each, 5 captures): `npm run smoke:engine:full`.
- To lock a runtime baseline, copy `docs/engine-smoke-latest.json` to `docs/engine-smoke-baseline.json`.
- Compare latest run against baseline acceptance thresholds: `npm run smoke:compare`.
