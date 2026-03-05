// Single entry point for both app modes.
// synth.html sets window.__SYNTH_MODE = true before this module loads.
if (window.__SYNTH_MODE) {
    import('./src/synth-ui.js');
} else {
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
