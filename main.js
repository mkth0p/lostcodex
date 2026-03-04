// ─── Boot ───
// This is the single entry point for both index.html and synth.html.
// synth.html sets window.__SYNTH_MODE = true before this module loads,
// so we skip the visual App and instead expose AudioEngine + generatePlanet globally.
import { AudioEngine } from './src/audio.js';
import { generatePlanet } from './src/planet.js';

if (window.__SYNTH_MODE) {
    // Expose for synth.html's inline script
    window.AudioEngine = AudioEngine;
    window.generatePlanet = generatePlanet;
} else {
    // Modular App mode for index.html
    import('./src/app-ui.js').then(({ App }) => {
        const app = new App();
        const run = () => app.init();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }
    });
}
