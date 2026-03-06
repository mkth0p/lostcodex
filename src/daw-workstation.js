const STEPS = 16;
const STORAGE_KEY = "lostcodex-daw-project-v1";
const SCHEDULER_LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.22;

const NOTE_ORDER = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const VOICE_TYPES = [
  "analog",
  "pad",
  "pluck",
  "fmBell",
  "bass",
  "kick",
  "snare",
  "hat",
  "noise",
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function createId() {
  return `trk_${Math.random().toString(36).slice(2, 10)}`;
}

function midiFromNote(note, octave) {
  const noteIndex = NOTE_ORDER.indexOf(note);
  if (noteIndex < 0) {
    return 60;
  }
  return noteIndex + (octave + 1) * 12;
}

function frequencyFromNote(note, octave) {
  const midi = midiFromNote(note, octave);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatSeconds(value) {
  return `${value.toFixed(2)}s`;
}

function formatHz(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}kHz` : `${Math.round(value)}Hz`;
}

function formatPan(value) {
  if (Math.abs(value) < 0.01) {
    return "C";
  }
  return value > 0 ? `R${Math.round(value * 100)}` : `L${Math.round(Math.abs(value) * 100)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function createDefaultTrack(index, voice) {
  const basePattern = Array.from({ length: STEPS }, (_, step) => (step % 4 === 0 ? 1 : 0));
  if (voice === "kick") {
    basePattern.forEach((_, i) => {
      basePattern[i] = i % 4 === 0 ? 2 : 0;
    });
  }
  if (voice === "hat") {
    basePattern.forEach((_, i) => {
      basePattern[i] = i % 2 === 0 ? 1 : 0;
    });
  }

  return {
    id: createId(),
    name: `Track ${index + 1}`,
    voice,
    note: ["C", "D", "F", "A"][index % 4],
    octave: voice === "bass" ? 2 : 4,
    mute: false,
    solo: false,
    steps: basePattern,
    volume: voice === "kick" || voice === "snare" ? 0.86 : 0.72,
    pan: 0,
    attack: voice === "pad" ? 0.08 : 0.01,
    decay: voice === "pad" ? 0.5 : 0.2,
    sustain: voice === "pluck" ? 0.15 : 0.5,
    release: voice === "pad" ? 1.8 : 0.35,
    cutoff: voice === "bass" ? 2600 : 6200,
    resonance: voice === "bass" ? 0.25 : 0.12,
    drive: 0.08,
    delaySend: voice === "hat" ? 0.06 : 0.22,
    reverbSend: voice === "kick" ? 0.08 : 0.25,
    probability: 1,
    humanize: 0.06,
  };
}

function makeInitialState() {
  return {
    projectName: "Untitled Orbit",
    bpm: 112,
    swing: 0.08,
    master: {
      volume: 0.88,
      drive: 0.15,
      compress: 0.4,
    },
    fx: {
      delayTime: 0.28,
      delayFeedback: 0.35,
      delayTone: 4800,
      reverbMix: 0.28,
      reverbSize: 2.8,
      reverbTone: 5200,
    },
    tracks: [
      createDefaultTrack(0, "kick"),
      createDefaultTrack(1, "snare"),
      createDefaultTrack(2, "hat"),
      createDefaultTrack(3, "bass"),
      createDefaultTrack(4, "pad"),
      createDefaultTrack(5, "pluck"),
    ],
  };
}

class WorkstationAudio {
  constructor() {
    this.context = null;
    this.masterIn = null;
    this.masterGain = null;
    this.masterDrive = null;
    this.compressor = null;
    this.delayNode = null;
    this.delayFeedback = null;
    this.delayTone = null;
    this.delayInput = null;
    this.reverbConvolver = null;
    this.reverbInput = null;
    this.reverbMix = null;
    this.reverbTone = null;
    this.noiseBuffer = null;
    this.activeNodes = new Set();
  }

  async ensureContext() {
    if (!this.context) {
      const AudioContextRef = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContextRef();
      this.buildGraph();
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  buildGraph() {
    const ctx = this.context;

    this.masterIn = ctx.createGain();
    this.masterIn.gain.value = 1;

    this.masterDrive = ctx.createWaveShaper();
    this.masterDrive.curve = this.makeDriveCurve(0.15);
    this.masterDrive.oversample = "4x";

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 16;
    this.compressor.ratio.value = 3.6;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.18;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.88;

    this.delayInput = ctx.createGain();
    this.delayInput.gain.value = 1;

    this.delayNode = ctx.createDelay(1.5);
    this.delayNode.delayTime.value = 0.28;

    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.35;

    this.delayTone = ctx.createBiquadFilter();
    this.delayTone.type = "lowpass";
    this.delayTone.frequency.value = 4800;
    this.delayTone.Q.value = 0.35;

    this.reverbInput = ctx.createGain();
    this.reverbInput.gain.value = 1;

    this.reverbConvolver = ctx.createConvolver();
    this.reverbConvolver.buffer = this.createImpulse(2.8, 5200);

    this.reverbTone = ctx.createBiquadFilter();
    this.reverbTone.type = "lowpass";
    this.reverbTone.frequency.value = 5200;
    this.reverbTone.Q.value = 0.1;

    this.reverbMix = ctx.createGain();
    this.reverbMix.gain.value = 0.28;

    this.noiseBuffer = this.createNoiseBuffer();

    this.masterIn.connect(this.masterDrive);
    this.masterDrive.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);

    this.delayInput.connect(this.delayNode);
    this.delayNode.connect(this.delayTone);
    this.delayTone.connect(this.masterIn);
    this.delayTone.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);

    this.reverbInput.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbTone);
    this.reverbTone.connect(this.reverbMix);
    this.reverbMix.connect(this.masterIn);
  }

  makeDriveCurve(amount) {
    const samples = 2048;
    const curve = new Float32Array(samples);
    const k = 1 + amount * 25;
    for (let i = 0; i < samples; i += 1) {
      const x = (i * 2) / (samples - 1) - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  createImpulse(seconds, lowpassHz) {
    const ctx = this.context;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        const progress = i / length;
        const decay = Math.pow(1 - progress, 2.4);
        const brightness = Math.exp((-progress * lowpassHz) / 9000);
        data[i] = (Math.random() * 2 - 1) * decay * brightness;
      }
    }
    return buffer;
  }

  createNoiseBuffer() {
    const ctx = this.context;
    const length = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  updateMaster(masterState) {
    if (!this.context) {
      return;
    }
    this.masterGain.gain.setTargetAtTime(clamp(masterState.volume, 0, 1.3), this.context.currentTime, 0.02);
    this.masterDrive.curve = this.makeDriveCurve(clamp(masterState.drive, 0, 1));

    const intensity = clamp(masterState.compress, 0, 1);
    this.compressor.threshold.value = -10 - intensity * 24;
    this.compressor.ratio.value = 1.5 + intensity * 6.5;
    this.compressor.knee.value = 8 + intensity * 16;
  }

  updateFx(fxState) {
    if (!this.context) {
      return;
    }
    const now = this.context.currentTime;
    this.delayNode.delayTime.setTargetAtTime(clamp(fxState.delayTime, 0.04, 1), now, 0.02);
    this.delayFeedback.gain.setTargetAtTime(clamp(fxState.delayFeedback, 0, 0.95), now, 0.03);
    this.delayTone.frequency.setTargetAtTime(clamp(fxState.delayTone, 400, 16000), now, 0.05);

    this.reverbMix.gain.setTargetAtTime(clamp(fxState.reverbMix, 0, 1), now, 0.03);
    this.reverbTone.frequency.setTargetAtTime(clamp(fxState.reverbTone, 600, 18000), now, 0.05);
    this.reverbConvolver.buffer = this.createImpulse(clamp(fxState.reverbSize, 0.5, 6), fxState.reverbTone);
  }

  scheduleStep(state, stepIndex, timeSec) {
    if (!this.context) {
      return;
    }
    const hasSolo = state.tracks.some((track) => track.solo);
    state.tracks.forEach((track) => {
      if (track.mute) {
        return;
      }
      if (hasSolo && !track.solo) {
        return;
      }

      const stepState = track.steps[stepIndex] ?? 0;
      if (!stepState) {
        return;
      }
      if (Math.random() > clamp(track.probability, 0, 1)) {
        return;
      }

      const humanOffset = (Math.random() * 2 - 1) * track.humanize * 0.03;
      const eventTime = Math.max(this.context.currentTime + 0.001, timeSec + humanOffset);
      this.triggerTrack(track, eventTime, stepState === 2);
    });
  }

  triggerTrack(track, timeSec, accent) {
    switch (track.voice) {
      case "kick":
        this.triggerKick(track, timeSec, accent);
        return;
      case "snare":
        this.triggerSnare(track, timeSec, accent);
        return;
      case "hat":
        this.triggerHat(track, timeSec, accent);
        return;
      case "noise":
        this.triggerNoise(track, timeSec, accent);
        return;
      default:
        this.triggerTonal(track, timeSec, accent);
    }
  }

  voiceFrame(track, timeSec, accent, releaseScale = 1) {
    const ctx = this.context;
    const sourceGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const panNode = ctx.createStereoPanner();
    const dry = ctx.createGain();
    const sendDelay = ctx.createGain();
    const sendReverb = ctx.createGain();

    filter.type = "lowpass";
    filter.frequency.value = clamp(track.cutoff, 120, 18000);
    filter.Q.value = 0.1 + clamp(track.resonance, 0, 1) * 20;

    const driveAmount = clamp(track.drive, 0, 1);
    const drive = ctx.createWaveShaper();
    drive.curve = this.makeDriveCurve(driveAmount * 0.7);
    drive.oversample = "2x";

    const velocity = accent ? 1.28 : 1;
    const level = clamp(track.volume * velocity, 0, 1.4);

    sourceGain.gain.cancelScheduledValues(timeSec);
    sourceGain.gain.setValueAtTime(0.0001, timeSec);
    sourceGain.gain.linearRampToValueAtTime(level, timeSec + track.attack + 0.001);
    sourceGain.gain.linearRampToValueAtTime(level * track.sustain, timeSec + track.attack + track.decay + 0.001);

    const releaseTime = Math.max(0.02, track.release * releaseScale);
    sourceGain.gain.setTargetAtTime(0.0001, timeSec + track.attack + track.decay + 0.02, releaseTime * 0.35);

    panNode.pan.value = clamp(track.pan, -1, 1);
    dry.gain.value = 1;
    sendDelay.gain.value = clamp(track.delaySend, 0, 1);
    sendReverb.gain.value = clamp(track.reverbSend, 0, 1);

    sourceGain.connect(filter);
    filter.connect(drive);
    drive.connect(panNode);
    panNode.connect(dry);
    panNode.connect(sendDelay);
    panNode.connect(sendReverb);
    dry.connect(this.masterIn);
    sendDelay.connect(this.delayInput);
    sendReverb.connect(this.reverbInput);

    this.activeNodes.add(sourceGain);
    this.activeNodes.add(filter);
    this.activeNodes.add(panNode);
    this.activeNodes.add(drive);

    const cleanupAt = timeSec + track.attack + track.decay + releaseTime + 0.6;
    window.setTimeout(() => {
      this.disconnectNode(sourceGain);
      this.disconnectNode(filter);
      this.disconnectNode(panNode);
      this.disconnectNode(drive);
      this.disconnectNode(dry);
      this.disconnectNode(sendDelay);
      this.disconnectNode(sendReverb);
      this.activeNodes.delete(sourceGain);
      this.activeNodes.delete(filter);
      this.activeNodes.delete(panNode);
      this.activeNodes.delete(drive);
    }, Math.max(10, (cleanupAt - this.context.currentTime) * 1000));

    return { sourceGain, filter, timeSec };
  }

  triggerTonal(track, timeSec, accent) {
    const ctx = this.context;
    const baseFreq = frequencyFromNote(track.note, track.octave);
    const layer = this.voiceFrame(track, timeSec, accent);

    if (track.voice === "fmBell") {
      const carrier = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();

      carrier.type = "sine";
      carrier.frequency.setValueAtTime(baseFreq, timeSec);

      modulator.type = "sine";
      modulator.frequency.setValueAtTime(baseFreq * 2.6, timeSec);
      modGain.gain.setValueAtTime(baseFreq * 1.4, timeSec);
      modGain.gain.exponentialRampToValueAtTime(2, timeSec + 1.2);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(layer.sourceGain);

      carrier.start(timeSec);
      modulator.start(timeSec);
      carrier.stop(timeSec + Math.max(0.3, track.release * 1.9) + 0.8);
      modulator.stop(timeSec + Math.max(0.3, track.release * 1.9) + 0.8);
      return;
    }

    if (track.voice === "pad") {
      const ratios = [1, 1.5, 2];
      ratios.forEach((ratio, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 2 ? "triangle" : "sawtooth";
        osc.frequency.setValueAtTime(baseFreq * ratio, timeSec);
        const detuneSpread = idx === 0 ? -8 : idx === 1 ? 6 : 0;
        osc.detune.setValueAtTime(detuneSpread, timeSec);
        const mix = ctx.createGain();
        mix.gain.value = idx === 2 ? 0.14 : 0.22;
        osc.connect(mix);
        mix.connect(layer.sourceGain);
        osc.start(timeSec);
        osc.stop(timeSec + Math.max(0.6, track.release * 2.6) + 1.4);
      });
      return;
    }

    if (track.voice === "pluck") {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(baseFreq, timeSec);

      const upper = ctx.createOscillator();
      upper.type = "square";
      upper.frequency.setValueAtTime(baseFreq * 2, timeSec);

      const upperGain = ctx.createGain();
      upperGain.gain.setValueAtTime(0.16, timeSec);
      upperGain.gain.exponentialRampToValueAtTime(0.0001, timeSec + 0.25);

      osc.connect(layer.sourceGain);
      upper.connect(upperGain);
      upperGain.connect(layer.sourceGain);

      osc.start(timeSec);
      upper.start(timeSec);
      osc.stop(timeSec + Math.max(0.12, track.release * 1.1) + 0.45);
      upper.stop(timeSec + 0.4);
      return;
    }

    if (track.voice === "bass") {
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();

      oscA.type = "sawtooth";
      oscB.type = "square";
      oscA.frequency.setValueAtTime(baseFreq * 0.5, timeSec);
      oscB.frequency.setValueAtTime(baseFreq * 0.5, timeSec);
      oscB.detune.setValueAtTime(-5, timeSec);

      const mixA = ctx.createGain();
      const mixB = ctx.createGain();
      mixA.gain.value = 0.45;
      mixB.gain.value = 0.35;

      oscA.connect(mixA);
      oscB.connect(mixB);
      mixA.connect(layer.sourceGain);
      mixB.connect(layer.sourceGain);

      layer.filter.frequency.setValueAtTime(clamp(track.cutoff, 120, 5500), timeSec);
      oscA.start(timeSec);
      oscB.start(timeSec);
      oscA.stop(timeSec + Math.max(0.2, track.release * 0.9) + 0.5);
      oscB.stop(timeSec + Math.max(0.2, track.release * 0.9) + 0.5);
      return;
    }

    const oscMain = ctx.createOscillator();
    const oscSub = ctx.createOscillator();
    const mixMain = ctx.createGain();
    const mixSub = ctx.createGain();

    oscMain.type = track.voice === "analog" ? "sawtooth" : "triangle";
    oscSub.type = "triangle";
    oscMain.frequency.setValueAtTime(baseFreq, timeSec);
    oscSub.frequency.setValueAtTime(baseFreq * 0.5, timeSec);
    oscMain.detune.setValueAtTime(3, timeSec);

    mixMain.gain.value = 0.48;
    mixSub.gain.value = 0.26;
    oscMain.connect(mixMain);
    oscSub.connect(mixSub);
    mixMain.connect(layer.sourceGain);
    mixSub.connect(layer.sourceGain);

    oscMain.start(timeSec);
    oscSub.start(timeSec);
    oscMain.stop(timeSec + Math.max(0.2, track.release * 1.6) + 0.8);
    oscSub.stop(timeSec + Math.max(0.2, track.release * 1.6) + 0.8);
  }

  triggerKick(track, timeSec, accent) {
    const ctx = this.context;
    const layer = this.voiceFrame(track, timeSec, accent, 0.7);
    layer.filter.frequency.setValueAtTime(2600, timeSec);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, timeSec);
    osc.frequency.exponentialRampToValueAtTime(42, timeSec + 0.16);
    osc.connect(layer.sourceGain);

    const click = ctx.createBufferSource();
    click.buffer = this.noiseBuffer;
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = "highpass";
    clickFilter.frequency.value = 1700;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(accent ? 0.18 : 0.12, timeSec);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, timeSec + 0.04);
    click.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(layer.sourceGain);

    osc.start(timeSec);
    osc.stop(timeSec + 0.38);
    click.start(timeSec);
    click.stop(timeSec + 0.05);
  }

  triggerSnare(track, timeSec, accent) {
    const ctx = this.context;
    const layer = this.voiceFrame(track, timeSec, accent, 0.55);
    layer.filter.frequency.setValueAtTime(4600, timeSec);

    const body = ctx.createOscillator();
    body.type = "triangle";
    body.frequency.setValueAtTime(210, timeSec);
    body.frequency.exponentialRampToValueAtTime(120, timeSec + 0.09);
    body.connect(layer.sourceGain);
    body.start(timeSec);
    body.stop(timeSec + 0.16);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = accent ? 3100 : 2600;
    noiseFilter.Q.value = 1.2;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(accent ? 0.52 : 0.38, timeSec);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, timeSec + 0.22);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(layer.sourceGain);
    noise.start(timeSec);
    noise.stop(timeSec + 0.24);
  }

  triggerHat(track, timeSec, accent) {
    const ctx = this.context;
    const layer = this.voiceFrame(track, timeSec, accent, 0.4);
    layer.filter.frequency.setValueAtTime(10000, timeSec);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = accent ? 7400 : 6800;
    hp.Q.value = 0.8;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 9300;
    band.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(accent ? 0.34 : 0.24, timeSec);
    gain.gain.exponentialRampToValueAtTime(0.0001, timeSec + 0.09);

    noise.connect(hp);
    hp.connect(band);
    band.connect(gain);
    gain.connect(layer.sourceGain);
    noise.start(timeSec);
    noise.stop(timeSec + 0.1);
  }

  triggerNoise(track, timeSec, accent) {
    const layer = this.voiceFrame(track, timeSec, accent, 0.8);
    const noise = this.context.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = false;
    layer.filter.type = "bandpass";
    layer.filter.frequency.setValueAtTime(clamp(track.cutoff, 300, 10000), timeSec);
    layer.filter.Q.value = 0.4 + track.resonance * 5;
    noise.connect(layer.sourceGain);
    noise.start(timeSec);
    noise.stop(timeSec + Math.max(0.2, track.release * 1.2) + 0.45);
  }

  disconnectNode(node) {
    if (!node || typeof node.disconnect !== "function") {
      return;
    }
    try {
      node.disconnect();
    } catch {
      // Ignore disconnect races from short-lived nodes.
    }
  }

  panic() {
    this.activeNodes.forEach((node) => this.disconnectNode(node));
    this.activeNodes.clear();
  }
}

class WorkstationApp {
  constructor() {
    this.state = makeInitialState();
    this.audio = new WorkstationAudio();
    this.playing = false;
    this.currentStep = 0;
    this.nextStepTime = 0;
    this.schedulerTimer = null;
    this.playheadTimers = new Set();

    this.dom = this.collectDom();
    this.bindGlobalControls();
    this.bindTrackDelegates();
    this.applyStateToUi();
    this.renderTracks();
    this.syncProjectJson();
    this.setStatus("Ready");
  }

  collectDom() {
    return {
      projectName: document.getElementById("project-name"),
      playheadStep: document.getElementById("playhead-step"),
      transportStatus: document.getElementById("transport-status"),

      transportToggle: document.getElementById("transport-toggle"),
      transportStop: document.getElementById("transport-stop"),
      transportPanic: document.getElementById("transport-panic"),

      bpm: document.getElementById("bpm"),
      bpmValue: document.getElementById("bpm-value"),
      swing: document.getElementById("swing"),
      swingValue: document.getElementById("swing-value"),
      masterVolume: document.getElementById("master-volume"),
      masterVolumeValue: document.getElementById("master-volume-value"),
      masterDrive: document.getElementById("master-drive"),
      masterDriveValue: document.getElementById("master-drive-value"),
      masterCompress: document.getElementById("master-compress"),
      masterCompressValue: document.getElementById("master-compress-value"),

      fxDelayTime: document.getElementById("fx-delay-time"),
      fxDelayTimeValue: document.getElementById("fx-delay-time-value"),
      fxDelayFeedback: document.getElementById("fx-delay-feedback"),
      fxDelayFeedbackValue: document.getElementById("fx-delay-feedback-value"),
      fxDelayTone: document.getElementById("fx-delay-tone"),
      fxDelayToneValue: document.getElementById("fx-delay-tone-value"),
      fxReverbMix: document.getElementById("fx-reverb-mix"),
      fxReverbMixValue: document.getElementById("fx-reverb-mix-value"),
      fxReverbSize: document.getElementById("fx-reverb-size"),
      fxReverbSizeValue: document.getElementById("fx-reverb-size-value"),
      fxReverbTone: document.getElementById("fx-reverb-tone"),
      fxReverbToneValue: document.getElementById("fx-reverb-tone-value"),

      addTrack: document.getElementById("add-track"),
      randomize: document.getElementById("randomize"),
      clearPatterns: document.getElementById("clear-patterns"),
      saveProject: document.getElementById("save-project"),
      loadProject: document.getElementById("load-project"),
      copyJson: document.getElementById("copy-json"),
      applyJson: document.getElementById("apply-json"),
      actionStatus: document.getElementById("action-status"),
      trackList: document.getElementById("track-list"),
      projectJson: document.getElementById("project-json"),
    };
  }

  bindGlobalControls() {
    this.dom.projectName.addEventListener("input", (event) => {
      this.state.projectName = event.target.value;
      this.syncProjectJson();
    });

    this.bindRange(this.dom.bpm, this.dom.bpmValue, (value) => {
      this.state.bpm = Number(value);
      return `${Math.round(this.state.bpm)}`;
    });
    this.bindRange(this.dom.swing, this.dom.swingValue, (value) => {
      this.state.swing = Number(value);
      return formatPercent(this.state.swing);
    });
    this.bindRange(this.dom.masterVolume, this.dom.masterVolumeValue, (value) => {
      this.state.master.volume = Number(value);
      this.audio.updateMaster(this.state.master);
      return formatPercent(this.state.master.volume);
    });
    this.bindRange(this.dom.masterDrive, this.dom.masterDriveValue, (value) => {
      this.state.master.drive = Number(value);
      this.audio.updateMaster(this.state.master);
      return formatPercent(this.state.master.drive);
    });
    this.bindRange(this.dom.masterCompress, this.dom.masterCompressValue, (value) => {
      this.state.master.compress = Number(value);
      this.audio.updateMaster(this.state.master);
      return formatPercent(this.state.master.compress);
    });

    this.bindRange(this.dom.fxDelayTime, this.dom.fxDelayTimeValue, (value) => {
      this.state.fx.delayTime = Number(value);
      this.audio.updateFx(this.state.fx);
      return formatSeconds(this.state.fx.delayTime);
    });
    this.bindRange(this.dom.fxDelayFeedback, this.dom.fxDelayFeedbackValue, (value) => {
      this.state.fx.delayFeedback = Number(value);
      this.audio.updateFx(this.state.fx);
      return formatPercent(this.state.fx.delayFeedback);
    });
    this.bindRange(this.dom.fxDelayTone, this.dom.fxDelayToneValue, (value) => {
      this.state.fx.delayTone = Number(value);
      this.audio.updateFx(this.state.fx);
      return formatHz(this.state.fx.delayTone);
    });
    this.bindRange(this.dom.fxReverbMix, this.dom.fxReverbMixValue, (value) => {
      this.state.fx.reverbMix = Number(value);
      this.audio.updateFx(this.state.fx);
      return formatPercent(this.state.fx.reverbMix);
    });
    this.bindRange(this.dom.fxReverbSize, this.dom.fxReverbSizeValue, (value) => {
      this.state.fx.reverbSize = Number(value);
      this.audio.updateFx(this.state.fx);
      return formatSeconds(this.state.fx.reverbSize);
    });
    this.bindRange(this.dom.fxReverbTone, this.dom.fxReverbToneValue, (value) => {
      this.state.fx.reverbTone = Number(value);
      this.audio.updateFx(this.state.fx);
      return formatHz(this.state.fx.reverbTone);
    });

    this.dom.transportToggle.addEventListener("click", () => {
      if (this.playing) {
        this.stopTransport(false);
      } else {
        this.startTransport();
      }
    });

    this.dom.transportStop.addEventListener("click", () => {
      this.stopTransport(true);
    });

    this.dom.transportPanic.addEventListener("click", () => {
      this.audio.panic();
      this.setStatus("Panic: all active voices stopped");
    });

    this.dom.addTrack.addEventListener("click", () => {
      this.addTrack();
    });

    this.dom.randomize.addEventListener("click", () => {
      this.randomizeProject();
      this.renderTracks();
      this.syncProjectJson();
      this.setStatus("Patterns and controls randomized");
    });

    this.dom.clearPatterns.addEventListener("click", () => {
      this.clearPatterns();
      this.renderTracks();
      this.syncProjectJson();
      this.setStatus("All patterns cleared");
    });

    this.dom.saveProject.addEventListener("click", () => {
      this.saveLocal();
    });

    this.dom.loadProject.addEventListener("click", () => {
      this.loadLocal();
    });

    this.dom.copyJson.addEventListener("click", async () => {
      await this.copyJsonToClipboard();
    });

    this.dom.applyJson.addEventListener("click", () => {
      this.applyJson();
    });
  }

  bindTrackDelegates() {
    this.dom.trackList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.dataset.action === "step") {
        const trackId = target.dataset.trackId;
        const stepIndex = Number(target.dataset.stepIndex);
        if (!trackId || Number.isNaN(stepIndex)) {
          return;
        }
        this.cycleStep(trackId, stepIndex);
        this.renderTracks();
        this.syncProjectJson();
        return;
      }

      if (!target.dataset.action || !target.dataset.trackId) {
        return;
      }

      const { action, trackId } = target.dataset;
      if (action === "mute") {
        this.toggleMute(trackId);
      } else if (action === "solo") {
        this.toggleSolo(trackId);
      } else if (action === "duplicate") {
        this.duplicateTrack(trackId);
      } else if (action === "delete") {
        this.deleteTrack(trackId);
      }

      this.renderTracks();
      this.syncProjectJson();
    });

    this.dom.trackList.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
        return;
      }

      const trackId = target.dataset.trackId;
      const field = target.dataset.field;
      if (!trackId || !field) {
        return;
      }
      this.updateTrackField(trackId, field, target.value);

      const outputId = target.dataset.outputId;
      if (outputId) {
        const output = document.getElementById(outputId);
        if (output) {
          const track = this.state.tracks.find((t) => t.id === trackId);
          if (track) {
            output.textContent = this.formatTrackControl(field, track[field]);
          }
        }
      }

      if (field === "voice" || field === "note" || field === "octave") {
        this.setStatus(`Updated ${field} on track`);
      }
      this.syncProjectJson();
    });
  }

  bindRange(input, output, formatter) {
    const render = () => {
      output.textContent = formatter(input.value);
      this.syncProjectJson();
    };
    input.addEventListener("input", render);
    render();
  }

  applyStateToUi() {
    this.dom.projectName.value = this.state.projectName;
    this.dom.bpm.value = `${this.state.bpm}`;
    this.dom.swing.value = `${this.state.swing}`;
    this.dom.masterVolume.value = `${this.state.master.volume}`;
    this.dom.masterDrive.value = `${this.state.master.drive}`;
    this.dom.masterCompress.value = `${this.state.master.compress}`;
    this.dom.fxDelayTime.value = `${this.state.fx.delayTime}`;
    this.dom.fxDelayFeedback.value = `${this.state.fx.delayFeedback}`;
    this.dom.fxDelayTone.value = `${this.state.fx.delayTone}`;
    this.dom.fxReverbMix.value = `${this.state.fx.reverbMix}`;
    this.dom.fxReverbSize.value = `${this.state.fx.reverbSize}`;
    this.dom.fxReverbTone.value = `${this.state.fx.reverbTone}`;
    this.dom.bpmValue.textContent = `${Math.round(this.state.bpm)}`;
    this.dom.swingValue.textContent = formatPercent(this.state.swing);
    this.dom.masterVolumeValue.textContent = formatPercent(this.state.master.volume);
    this.dom.masterDriveValue.textContent = formatPercent(this.state.master.drive);
    this.dom.masterCompressValue.textContent = formatPercent(this.state.master.compress);
    this.dom.fxDelayTimeValue.textContent = formatSeconds(this.state.fx.delayTime);
    this.dom.fxDelayFeedbackValue.textContent = formatPercent(this.state.fx.delayFeedback);
    this.dom.fxDelayToneValue.textContent = formatHz(this.state.fx.delayTone);
    this.dom.fxReverbMixValue.textContent = formatPercent(this.state.fx.reverbMix);
    this.dom.fxReverbSizeValue.textContent = formatSeconds(this.state.fx.reverbSize);
    this.dom.fxReverbToneValue.textContent = formatHz(this.state.fx.reverbTone);
    this.updatePlayheadUi(this.currentStep);
  }

  async startTransport() {
    await this.audio.ensureContext();
    this.audio.updateMaster(this.state.master);
    this.audio.updateFx(this.state.fx);

    if (this.playing) {
      return;
    }
    this.playing = true;
    this.dom.transportToggle.textContent = "Pause";
    this.dom.transportStatus.textContent = "Playing";
    this.nextStepTime = this.audio.context.currentTime + 0.08;
    this.scheduler();
    this.schedulerTimer = window.setInterval(() => this.scheduler(), SCHEDULER_LOOKAHEAD_MS);
    this.setStatus("Transport running");
  }

  stopTransport(resetPosition) {
    if (this.schedulerTimer) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.playing = false;
    this.dom.transportToggle.textContent = "Play";
    this.dom.transportStatus.textContent = "Stopped";

    this.playheadTimers.forEach((timer) => window.clearTimeout(timer));
    this.playheadTimers.clear();

    if (resetPosition) {
      this.currentStep = 0;
      this.updatePlayheadUi(0);
    }
    this.setStatus("Transport stopped");
  }

  scheduler() {
    if (!this.playing || !this.audio.context) {
      return;
    }
    const ctx = this.audio.context;
    while (this.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      const stepIndex = this.currentStep;
      this.audio.scheduleStep(this.state, stepIndex, this.nextStepTime);
      this.schedulePlayhead(stepIndex, this.nextStepTime);

      const interval = this.getStepDuration(stepIndex);
      this.nextStepTime += interval;
      this.currentStep = (this.currentStep + 1) % STEPS;
    }
  }

  getStepDuration(stepIndex) {
    const sixteenth = (60 / clamp(this.state.bpm, 20, 300)) / 4;
    const swing = clamp(this.state.swing, 0, 0.45);
    if (stepIndex % 2 === 0) {
      return sixteenth * (1 + swing);
    }
    return sixteenth * (1 - swing);
  }

  schedulePlayhead(stepIndex, timeSec) {
    if (!this.audio.context) {
      return;
    }
    const delayMs = Math.max(0, (timeSec - this.audio.context.currentTime) * 1000);
    const timer = window.setTimeout(() => {
      this.updatePlayheadUi(stepIndex);
      this.renderPlayingStep(stepIndex);
      this.playheadTimers.delete(timer);
    }, delayMs);
    this.playheadTimers.add(timer);
  }

  updatePlayheadUi(stepIndex) {
    this.dom.playheadStep.textContent = `Step ${String(stepIndex + 1).padStart(2, "0")} / ${STEPS}`;
  }

  renderPlayingStep(stepIndex) {
    this.dom.trackList.querySelectorAll(".step.playing").forEach((stepEl) => {
      stepEl.classList.remove("playing");
    });
    this.dom.trackList.querySelectorAll(`.step[data-step-index="${stepIndex}"]`).forEach((stepEl) => {
      stepEl.classList.add("playing");
    });
  }

  setStatus(text) {
    this.dom.actionStatus.textContent = text;
  }

  addTrack() {
    const voice = VOICE_TYPES[Math.floor(Math.random() * VOICE_TYPES.length)];
    const newTrack = createDefaultTrack(this.state.tracks.length, voice);
    newTrack.name = `Track ${this.state.tracks.length + 1}`;
    this.state.tracks.push(newTrack);
    this.renderTracks();
    this.syncProjectJson();
    this.setStatus(`Added ${voice} track`);
  }

  duplicateTrack(trackId) {
    const track = this.state.tracks.find((entry) => entry.id === trackId);
    if (!track) {
      return;
    }
    const clone = JSON.parse(JSON.stringify(track));
    clone.id = createId();
    clone.name = `${track.name} Copy`;
    this.state.tracks.push(clone);
    this.setStatus(`Duplicated ${track.name}`);
  }

  deleteTrack(trackId) {
    if (this.state.tracks.length <= 1) {
      this.setStatus("Cannot delete the last track");
      return;
    }
    const before = this.state.tracks.length;
    this.state.tracks = this.state.tracks.filter((track) => track.id !== trackId);
    if (this.state.tracks.length < before) {
      this.setStatus("Track deleted");
    }
  }

  toggleMute(trackId) {
    const track = this.state.tracks.find((entry) => entry.id === trackId);
    if (!track) {
      return;
    }
    track.mute = !track.mute;
    if (track.mute) {
      track.solo = false;
    }
  }

  toggleSolo(trackId) {
    const track = this.state.tracks.find((entry) => entry.id === trackId);
    if (!track) {
      return;
    }
    track.solo = !track.solo;
    if (track.solo) {
      track.mute = false;
    }
  }

  cycleStep(trackId, stepIndex) {
    const track = this.state.tracks.find((entry) => entry.id === trackId);
    if (!track) {
      return;
    }
    const current = track.steps[stepIndex] ?? 0;
    track.steps[stepIndex] = (current + 1) % 3;
  }

  updateTrackField(trackId, field, rawValue) {
    const track = this.state.tracks.find((entry) => entry.id === trackId);
    if (!track) {
      return;
    }
    const numericFields = new Set([
      "octave",
      "volume",
      "pan",
      "attack",
      "decay",
      "sustain",
      "release",
      "cutoff",
      "resonance",
      "drive",
      "delaySend",
      "reverbSend",
      "probability",
      "humanize",
    ]);

    if (numericFields.has(field)) {
      track[field] = Number(rawValue);
      return;
    }
    track[field] = rawValue;
  }

  formatTrackControl(field, value) {
    if (field === "pan") {
      return formatPan(value);
    }
    if (field === "cutoff") {
      return formatHz(value);
    }
    if (field === "attack" || field === "decay" || field === "release") {
      return formatSeconds(value);
    }
    if (field === "octave") {
      return `${value}`;
    }
    return formatPercent(value);
  }

  randomizeProject() {
    this.state.tracks.forEach((track) => {
      track.steps = track.steps.map(() => {
        const roll = Math.random();
        if (roll < 0.64) {
          return 0;
        }
        return roll > 0.9 ? 2 : 1;
      });

      track.volume = clamp(randomRange(0.35, 0.95), 0, 1.2);
      track.pan = randomRange(-0.95, 0.95);
      track.attack = randomRange(0.002, 0.18);
      track.decay = randomRange(0.08, 0.9);
      track.sustain = randomRange(0.08, 0.95);
      track.release = randomRange(0.08, 2.4);
      track.cutoff = randomRange(350, 12000);
      track.resonance = randomRange(0.02, 0.72);
      track.drive = randomRange(0, 0.7);
      track.delaySend = randomRange(0, 0.72);
      track.reverbSend = randomRange(0.04, 0.88);
      track.probability = randomRange(0.45, 1);
      track.humanize = randomRange(0, 0.4);
    });
  }

  clearPatterns() {
    this.state.tracks.forEach((track) => {
      track.steps = Array.from({ length: STEPS }, () => 0);
    });
  }

  saveLocal() {
    const payload = this.exportProject();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    this.setStatus("Project saved locally");
  }

  loadLocal() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      this.setStatus("No saved project found");
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      this.importProject(parsed);
      this.setStatus("Loaded project from local storage");
    } catch {
      this.setStatus("Failed to parse local project");
    }
  }

  async copyJsonToClipboard() {
    const payload = JSON.stringify(this.exportProject(), null, 2);
    this.dom.projectJson.value = payload;
    try {
      await navigator.clipboard.writeText(payload);
      this.setStatus("Project JSON copied");
    } catch {
      this.setStatus("Clipboard blocked; JSON is still in the text box");
    }
  }

  applyJson() {
    const source = this.dom.projectJson.value;
    if (!source.trim()) {
      this.setStatus("JSON field is empty");
      return;
    }

    try {
      const parsed = JSON.parse(source);
      this.importProject(parsed);
      this.setStatus("Applied project JSON");
    } catch {
      this.setStatus("Invalid JSON");
    }
  }

  exportProject() {
    return {
      projectName: this.state.projectName,
      bpm: this.state.bpm,
      swing: this.state.swing,
      master: { ...this.state.master },
      fx: { ...this.state.fx },
      tracks: this.state.tracks.map((track) => ({
        ...track,
        steps: [...track.steps],
      })),
    };
  }

  importProject(project) {
    const fallback = makeInitialState();
    this.state.projectName = typeof project.projectName === "string" ? project.projectName : fallback.projectName;
    this.state.bpm = clamp(Number(project.bpm) || fallback.bpm, 50, 180);
    this.state.swing = clamp(Number(project.swing) || fallback.swing, 0, 0.45);

    this.state.master = {
      volume: clamp(Number(project.master?.volume) || fallback.master.volume, 0, 1.2),
      drive: clamp(Number(project.master?.drive) || fallback.master.drive, 0, 1),
      compress: clamp(Number(project.master?.compress) || fallback.master.compress, 0, 1),
    };

    this.state.fx = {
      delayTime: clamp(Number(project.fx?.delayTime) || fallback.fx.delayTime, 0.08, 0.75),
      delayFeedback: clamp(Number(project.fx?.delayFeedback) || fallback.fx.delayFeedback, 0, 0.92),
      delayTone: clamp(Number(project.fx?.delayTone) || fallback.fx.delayTone, 400, 12000),
      reverbMix: clamp(Number(project.fx?.reverbMix) || fallback.fx.reverbMix, 0, 1),
      reverbSize: clamp(Number(project.fx?.reverbSize) || fallback.fx.reverbSize, 0.8, 4.8),
      reverbTone: clamp(Number(project.fx?.reverbTone) || fallback.fx.reverbTone, 1200, 12000),
    };

    const sourceTracks = Array.isArray(project.tracks) ? project.tracks : fallback.tracks;
    this.state.tracks = sourceTracks.slice(0, 18).map((sourceTrack, index) => {
      const defaults = createDefaultTrack(index, VOICE_TYPES[index % VOICE_TYPES.length]);
      return {
        ...defaults,
        ...sourceTrack,
        id: typeof sourceTrack.id === "string" ? sourceTrack.id : createId(),
        name: typeof sourceTrack.name === "string" ? sourceTrack.name : defaults.name,
        voice: VOICE_TYPES.includes(sourceTrack.voice) ? sourceTrack.voice : defaults.voice,
        note: NOTE_ORDER.includes(sourceTrack.note) ? sourceTrack.note : defaults.note,
        octave: clamp(Number(sourceTrack.octave) || defaults.octave, 1, 7),
        steps: Array.from({ length: STEPS }, (_, step) => {
          const value = Number(sourceTrack.steps?.[step]);
          if (value === 1 || value === 2) {
            return value;
          }
          return 0;
        }),
        mute: Boolean(sourceTrack.mute),
        solo: Boolean(sourceTrack.solo),
        volume: clamp(Number(sourceTrack.volume) || defaults.volume, 0, 1.2),
        pan: clamp(Number(sourceTrack.pan) || defaults.pan, -1, 1),
        attack: clamp(Number(sourceTrack.attack) || defaults.attack, 0.001, 0.5),
        decay: clamp(Number(sourceTrack.decay) || defaults.decay, 0.03, 2),
        sustain: clamp(Number(sourceTrack.sustain) || defaults.sustain, 0, 1),
        release: clamp(Number(sourceTrack.release) || defaults.release, 0.05, 3),
        cutoff: clamp(Number(sourceTrack.cutoff) || defaults.cutoff, 120, 18000),
        resonance: clamp(Number(sourceTrack.resonance) || defaults.resonance, 0, 1),
        drive: clamp(Number(sourceTrack.drive) || defaults.drive, 0, 1),
        delaySend: clamp(Number(sourceTrack.delaySend) || defaults.delaySend, 0, 1),
        reverbSend: clamp(Number(sourceTrack.reverbSend) || defaults.reverbSend, 0, 1),
        probability: clamp(Number(sourceTrack.probability) || defaults.probability, 0, 1),
        humanize: clamp(Number(sourceTrack.humanize) || defaults.humanize, 0, 0.45),
      };
    });

    if (this.state.tracks.length === 0) {
      this.state.tracks = fallback.tracks;
    }

    this.applyStateToUi();
    this.renderTracks();
    this.syncProjectJson();
    this.audio.updateMaster(this.state.master);
    this.audio.updateFx(this.state.fx);
  }

  syncProjectJson() {
    const payload = JSON.stringify(this.exportProject(), null, 2);
    this.dom.projectJson.value = payload;
  }

  renderTracks() {
    const html = this.state.tracks.map((track) => this.trackCard(track)).join("");
    this.dom.trackList.innerHTML = html;
  }

  trackCard(track) {
    const safeName = escapeHtml(track.name);
    const voiceOptions = VOICE_TYPES.map((voice) => {
      const selected = voice === track.voice ? "selected" : "";
      return `<option value="${voice}" ${selected}>${voice}</option>`;
    }).join("");

    const noteOptions = NOTE_ORDER.map((note) => {
      const selected = note === track.note ? "selected" : "";
      return `<option value="${note}" ${selected}>${note}</option>`;
    }).join("");

    const steps = track.steps
      .map((value, index) => {
        const stepClass = value === 2 ? "step accent" : value === 1 ? "step on" : "step";
        const label = value === 2 ? "A" : value === 1 ? "On" : "Off";
        return `<button type="button" class="${stepClass}" data-action="step" data-track-id="${track.id}" data-step-index="${index}">${label}</button>`;
      })
      .join("");

    const muteClass = track.mute ? "btn btn-danger" : "btn";
    const soloClass = track.solo ? "btn btn-primary" : "btn";

    const controls = [
      { field: "volume", label: "Volume", min: 0, max: 1.2, step: 0.01 },
      { field: "pan", label: "Pan", min: -1, max: 1, step: 0.01 },
      { field: "attack", label: "Attack", min: 0.001, max: 0.5, step: 0.001 },
      { field: "decay", label: "Decay", min: 0.03, max: 2, step: 0.01 },
      { field: "sustain", label: "Sustain", min: 0, max: 1, step: 0.01 },
      { field: "release", label: "Release", min: 0.05, max: 3, step: 0.01 },
      { field: "cutoff", label: "Cutoff", min: 120, max: 18000, step: 1 },
      { field: "resonance", label: "Resonance", min: 0, max: 1, step: 0.01 },
      { field: "drive", label: "Drive", min: 0, max: 1, step: 0.01 },
      { field: "delaySend", label: "Delay", min: 0, max: 1, step: 0.01 },
      { field: "reverbSend", label: "Reverb", min: 0, max: 1, step: 0.01 },
      { field: "probability", label: "Prob", min: 0, max: 1, step: 0.01 },
      { field: "humanize", label: "Humanize", min: 0, max: 0.45, step: 0.01 },
    ];

    const controlHtml = controls
      .map(({ field, label, min, max, step }) => {
        const outputId = `${track.id}-${field}-out`;
        const value = track[field];
        return `
          <label class="small-control">
            <span>${label}</span>
            <input
              type="range"
              min="${min}"
              max="${max}"
              step="${step}"
              value="${value}"
              data-track-id="${track.id}"
              data-field="${field}"
              data-output-id="${outputId}">
            <output id="${outputId}">${this.formatTrackControl(field, value)}</output>
          </label>
        `;
      })
      .join("");

    return `
      <article class="track" data-track-id="${track.id}">
        <div class="track-header">
          <div class="field">
            <label>Name</label>
            <input class="track-name" type="text" value="${safeName}" data-track-id="${track.id}" data-field="name">
          </div>
          <div class="field">
            <label>Voice</label>
            <select data-track-id="${track.id}" data-field="voice">${voiceOptions}</select>
          </div>
          <div class="field">
            <label>Note</label>
            <select data-track-id="${track.id}" data-field="note">${noteOptions}</select>
          </div>
          <div class="field">
            <label>Octave</label>
            <input type="number" min="1" max="7" value="${track.octave}" data-track-id="${track.id}" data-field="octave">
          </div>
          <div class="track-actions">
            <button type="button" class="${muteClass}" data-action="mute" data-track-id="${track.id}">Mute</button>
            <button type="button" class="${soloClass}" data-action="solo" data-track-id="${track.id}">Solo</button>
            <button type="button" class="btn" data-action="duplicate" data-track-id="${track.id}">Dup</button>
            <button type="button" class="btn btn-danger" data-action="delete" data-track-id="${track.id}">Del</button>
          </div>
        </div>
        <div class="track-body">
          <div class="step-grid">${steps}</div>
          <div class="control-grid">${controlHtml}</div>
        </div>
      </article>
    `;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  // Expose a lightweight handle for console experiments.
  window.daw = new WorkstationApp();
});
