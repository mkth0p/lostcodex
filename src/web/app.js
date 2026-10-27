import { normalizeStation, stationId, STATIONS_PER_UNIVERSE } from '../score/piece.js';
import { UNIVERSES, getUniverse } from '../universes.js';
import { Dial, frequency } from './dial.js';
import { Field } from './field.js';

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const FADE = 3; // seconds of crossfade between stations
const PACK_WAIT = 10000; // ms to wait for the sample pack before playing synth-only
const SCAN_EVERY = 4 * 60 * 1000;

const $ = (id) => document.getElementById(id);
const field = new Field($('field'));
const isLite = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.hardwareConcurrency || 8) <= 4;

let ctx = null;
let current = null; // { node, gain, station }
let staticGain = null;
let wakeLock = null;
let powered = false;
let station = null; // the station shown, playing or not
let scanTimer = null;
let holdCustom = false; // a typed-in code stays put until the dial is turned
let packSent = false; // the worklet keeps the decoded pack once it has it

// Instruments rendered from real synths and samplers (about 1.6 MB), fetched as
// soon as the page opens. Without it every instrument has a synth stand-in.
const packPromise = fetch(new URL('../../samples/pack.bin', import.meta.url))
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);

function loadPack() {
    return Promise.race([packPromise, new Promise((resolve) => setTimeout(() => resolve(null), PACK_WAIT))]);
}

// "dub-07" -> its place on the dial; custom codes have none
function dialIndex(id) {
    const m = /^([a-z]+)-(\d{2})$/.exec(id);
    if (!m) return null;
    const u = UNIVERSES.findIndex((x) => x.id === m[1]);
    const n = Number(m[2]) - 1;
    if (u < 0 || n < 0 || n >= STATIONS_PER_UNIVERSE) return null;
    return u * STATIONS_PER_UNIVERSE + n;
}

function show(id, { tuning = false } = {}) {
    const universe = getUniverse(id.split('-')[0]);
    const index = dialIndex(id);
    $('name').textContent = universe.name;
    $('blurb').textContent = universe.blurb;
    $('freq').textContent = index === null
        ? `${universe.name} · ${id.split('-').slice(1).join('-')}`
        : `FM ${frequency(index).toFixed(1)} · ${universe.name} ${id.split('-')[1]}`;
    document.documentElement.style.setProperty('--hue', universe.color);
    document.body.classList.toggle('tuning', tuning);
    field.setUniverse(universe);
}

function setStation(id) {
    station = id;
    $('code').value = id;
    if (decodeURIComponent(location.hash.slice(1)) !== id) history.replaceState(null, '', `#${id}`);
    show(id);
}

async function ensureContext() {
    if (ctx) return ctx;
    // iOS: play through the ringer switch like a media app
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    ctx = new AudioContext({ latencyHint: 'playback' });
    await ctx.audioWorklet.addModule(new URL('./worklet.js', import.meta.url));
    staticGain = makeStatic(ctx);
    return ctx;
}

// Band-limited hiss, heard while the needle sits between stations.
function makeStatic(ac) {
    const buffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = buffer.getChannelData(0);
    let crackle = 0;
    for (let i = 0; i < data.length; i++) {
        crackle = Math.random() < 0.0008 ? 1 : crackle * 0.97;
        data[i] = (Math.random() * 2 - 1) * (0.6 + crackle);
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2200;
    band.Q.value = 0.5;
    const gain = ac.createGain();
    gain.gain.value = 0;
    src.connect(band).connect(gain).connect(ac.destination);
    src.start();
    return gain;
}

async function play(id) {
    const ac = await ensureContext();
    if (ac.state !== 'running') await ac.resume();
    if (current && current.station === id) {
        duck(1);
        return;
    }
    const pack = packSent ? null : await loadPack();
    // the dial may have moved on while the pack was loading
    if (id !== station) return;
    if (pack) packSent = true;
    const node = new AudioWorkletNode(ac, 'lost-codex', {
        numberOfInputs: 0,
        outputChannelCount: [2],
        processorOptions: { code: id, quality: isLite ? 'lite' : 'full', pack },
    });
    const gain = ac.createGain();
    const now = ac.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE);
    node.connect(gain).connect(ac.destination);
    node.port.onmessage = (e) => onMessage(node, e.data);

    const previous = current;
    current = { node, gain, station: id };
    if (previous) retire(previous, now);
    requestWakeLock();
}

function retire(voice, now) {
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + FADE);
    setTimeout(() => {
        voice.node.disconnect();
        voice.gain.disconnect();
        voice.node.port.onmessage = null;
    }, (FADE + 0.5) * 1000);
}

// Lower the playing station while the dial is away from it.
function duck(level) {
    if (!current || !ctx) return;
    const g = current.gain.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(level, now, 0.15);
}

function onMessage(node, msg) {
    if (!current || node !== current.node) return;
    if (msg.type === 'state') {
        const s = msg.state;
        field.update(s);
        $('now').textContent = `${NOTE_NAMES[s.tonic % 12]} ${s.mode} · ${s.scene || ''}`;
    }
}

async function power(on) {
    powered = on;
    $('power').setAttribute('aria-pressed', String(on));
    document.body.classList.toggle('playing', on);
    if (on) {
        await play(station);
    } else if (ctx) {
        if (current) retire(current, ctx.currentTime);
        current = null;
        $('now').textContent = '';
        setScan(false);
    }
}

function setScan(on) {
    $('scan').setAttribute('aria-pressed', String(on));
    clearInterval(scanTimer);
    scanTimer = on
        ? setInterval(() => dial.goTo(Math.floor(Math.random() * dial.count)), SCAN_EVERY)
        : null;
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

const dial = new Dial($('dial'), {
    bands: UNIVERSES.map((u) => ({ name: u.name, color: u.color })),
    perBand: STATIONS_PER_UNIVERSE,
    onTick(index) {
        const id = stationId(Math.floor(index / STATIONS_PER_UNIVERSE), index % STATIONS_PER_UNIVERSE);
        show(id, { tuning: id !== current?.station });
        if (navigator.vibrate && powered) navigator.vibrate(4);
    },
    onMove(_pos, detune, moving) {
        // static rises as the needle leaves a station and swamps it halfway
        const amount = moving ? Math.min(1, 0.25 + detune * 2) : 0;
        field.setStatic(amount);
        if (staticGain && powered) staticGain.gain.setTargetAtTime(amount * 0.09, ctx.currentTime, 0.04);
        if (powered && moving && current) duck(1 - amount * 0.85);
    },
    onSettle(index) {
        const id = stationId(Math.floor(index / STATIONS_PER_UNIVERSE), index % STATIONS_PER_UNIVERSE);
        // a custom station sits on its band until the dial is really moved
        if (holdCustom) {
            show(station);
            duck(1);
            return;
        }
        setStation(id);
        if (powered) play(id);
    },
});

function tuneTo(id, { instant = false } = {}) {
    setStation(id);
    holdCustom = dialIndex(id) === null;
    const index = dialIndex(id);
    if (index !== null) {
        dial.goTo(index, { instant });
    } else {
        const u = UNIVERSES.findIndex((x) => x.id === id.split('-')[0]);
        dial.goTo(u * STATIONS_PER_UNIVERSE + Math.floor(STATIONS_PER_UNIVERSE / 2), { instant: true });
        show(id);
        if (powered) play(id);
    }
}

$('power').addEventListener('click', () => power(!powered));
$('scan').addEventListener('click', () => {
    const on = $('scan').getAttribute('aria-pressed') !== 'true';
    setScan(on);
    if (on && !powered) power(true);
});

// The first touch on the dial is also the gesture that unlocks audio.
$('dial').addEventListener('pointerdown', () => {
    holdCustom = false;
    if (!powered) power(true);
});
['wheel', 'keydown'].forEach((type) => $('dial').addEventListener(type, () => { holdCustom = false; }));

$('code-form').addEventListener('submit', (e) => {
    e.preventDefault();
    $('code').blur();
    tuneTo(normalizeStation($('code').value));
    if (!powered) power(true);
});

window.addEventListener('hashchange', () => {
    const id = normalizeStation(decodeURIComponent(location.hash.slice(1)));
    if (id !== station) tuneTo(id);
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && current) requestWakeLock();
});

// Hide everything but the dial after a few seconds without input.
let idleTimer = null;
function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        if (powered && document.activeElement !== $('code')) document.body.classList.add('idle');
    }, 5000);
}
['pointermove', 'pointerdown', 'keydown'].forEach((type) => window.addEventListener(type, wake));

const fromHash = decodeURIComponent(location.hash.slice(1));
tuneTo(fromHash ? normalizeStation(fromHash) : stationId(0, 0), { instant: true });
wake();
