import { normalizeCode, randomCode } from '../score/piece.js';
import { Field } from './field.js';

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const FADE = 6;

const $ = (id) => document.getElementById(id);
const field = new Field($('field'));
const isLite = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.hardwareConcurrency || 8) <= 4;

let ctx = null;
let current = null; // { node, gain, code }
let wakeLock = null;
let piece = null;

function codeFromUrl() {
    const hash = decodeURIComponent(location.hash.slice(1));
    return hash ? normalizeCode(hash) : null;
}

function setCode(code) {
    $('code').value = code;
    if (location.hash.slice(1) !== code) history.replaceState(null, '', `#${code}`);
}

async function ensureContext() {
    if (ctx) return ctx;
    // iOS: play through the ringer switch like a media app
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    ctx = new AudioContext({ latencyHint: 'playback' });
    await ctx.audioWorklet.addModule(new URL('./worklet.js', import.meta.url));
    return ctx;
}

async function play(code) {
    const ac = await ensureContext();
    if (ac.state !== 'running') await ac.resume();
    setCode(code);
    const node = new AudioWorkletNode(ac, 'lost-codex', {
        numberOfInputs: 0,
        outputChannelCount: [2],
        processorOptions: { code, quality: isLite ? 'lite' : 'full' },
    });
    const gain = ac.createGain();
    const now = ac.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE);
    node.connect(gain).connect(ac.destination);
    node.port.onmessage = (e) => onMessage(node, e.data);

    const previous = current;
    current = { node, gain, code };
    if (previous) {
        previous.gain.gain.cancelScheduledValues(now);
        previous.gain.gain.setValueAtTime(previous.gain.gain.value, now);
        previous.gain.gain.linearRampToValueAtTime(0, now + FADE);
        setTimeout(() => {
            previous.node.disconnect();
            previous.gain.disconnect();
            previous.node.port.onmessage = null;
        }, (FADE + 0.5) * 1000);
    }
    document.body.classList.add('playing');
    $('pause').textContent = 'Pause';
    requestWakeLock();
}

function onMessage(node, msg) {
    if (!current || node !== current.node) return;
    if (msg.type === 'ready') {
        piece = msg.piece;
        field.setPiece(piece);
    } else if (msg.type === 'state') {
        field.update(msg.state);
        if (piece) {
            const key = `${NOTE_NAMES[piece.tonic % 12]} ${piece.mode}`;
            $('now').textContent = `${piece.code} · ${key} · ${msg.state.scene || ''}`;
        }
    }
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator && !wakeLock) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        }
    } catch {
        wakeLock = null;
    }
}

$('play').addEventListener('click', () => play(normalizeCode($('code').value)));

$('code-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = normalizeCode($('code').value);
    if (!current || current.code !== code) play(code);
});

$('next').addEventListener('click', () => play(randomCode()));

$('pause').addEventListener('click', async () => {
    if (!ctx) return;
    if (ctx.state === 'running') {
        await ctx.suspend();
        $('pause').textContent = 'Resume';
    } else {
        await ctx.resume();
        $('pause').textContent = 'Pause';
    }
});

$('fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
});

window.addEventListener('hashchange', () => {
    const code = codeFromUrl();
    if (code && current && code !== current.code) play(code);
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && current) requestWakeLock();
});

// Hide the controls after a few seconds without input, for installations.
let idleTimer = null;
function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        if (current && document.activeElement !== $('code')) document.body.classList.add('idle');
    }, 4000);
}
['pointermove', 'pointerdown', 'keydown'].forEach((type) => window.addEventListener(type, wake));

setCode(codeFromUrl() || randomCode());
wake();
