export function createAudioController({ getState, musicPattern }) {
  const audio = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    started: false,
    nextNoteTime: 0,
    noteIndex: 0,
  };

  function hasSupport() {
    return Boolean(window.AudioContext || window.webkitAudioContext);
  }

  function initializeAudioGraph() {
    if (!hasSupport()) {
      return false;
    }
    if (!audio.ctx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new AudioCtor();
      audio.master = audio.ctx.createGain();
      audio.musicGain = audio.ctx.createGain();
      audio.sfxGain = audio.ctx.createGain();
      audio.master.gain.value = getState().audioEnabled ? 0.92 : 0;
      audio.musicGain.gain.value = 0.03;
      audio.sfxGain.gain.value = 0.08;
      audio.musicGain.connect(audio.master);
      audio.sfxGain.connect(audio.master);
      audio.master.connect(audio.ctx.destination);
    }
    return true;
  }

  function ensureReady() {
    if (!getState().audioEnabled) {
      return false;
    }
    if (!initializeAudioGraph()) {
      return false;
    }
    if (audio.ctx.state === "suspended") {
      audio.ctx.resume().catch(() => {});
    }
    if (!audio.started) {
      audio.started = true;
      audio.nextNoteTime = audio.ctx.currentTime + 0.05;
      audio.noteIndex = 0;
    }
    return audio.ctx.state === "running";
  }

  function setEnabled(enabled) {
    if (!initializeAudioGraph()) {
      return;
    }
    const now = audio.ctx.currentTime;
    audio.master.gain.setTargetAtTime(enabled ? 0.92 : 0.0001, now, 0.08);
  }

  function playTone(frequency, duration, options = {}) {
    if (!audio.ctx || audio.ctx.state !== "running" || !getState().audioEnabled) {
      return;
    }
    const start = audio.ctx.currentTime + (options.delay || 0);
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = options.type || "triangle";
    osc.frequency.setValueAtTime(frequency, start);
    if (options.slideTo) {
      osc.frequency.linearRampToValueAtTime(options.slideTo, start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.gain || 0.05, start + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(audio.sfxGain);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function playNoise(duration, gainValue, highpass, delay = 0) {
    if (!audio.ctx || audio.ctx.state !== "running" || !getState().audioEnabled) {
      return;
    }
    const sampleRate = audio.ctx.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = audio.ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) {
      const life = 1 - i / frameCount;
      data[i] = (Math.random() * 2 - 1) * life * life;
    }
    const start = audio.ctx.currentTime + delay;
    const source = audio.ctx.createBufferSource();
    const filter = audio.ctx.createBiquadFilter();
    const gain = audio.ctx.createGain();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.setValueAtTime(highpass, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.sfxGain);
    source.start(start);
    source.stop(start + duration + 0.03);
  }

  function playSfx(type) {
    if (!ensureReady()) {
      return;
    }
    if (type === "tap") {
      playTone(760, 0.08, { gain: 0.05, slideTo: 900 });
      return;
    }
    if (type === "start") {
      playNoise(0.16, 0.018, 320);
      playTone(164.81, 0.14, { type: "sawtooth", gain: 0.026, slideTo: 196 });
      playTone(392, 0.1, { delay: 0.0 });
      playTone(523.25, 0.12, { delay: 0.08 });
      playTone(659.25, 0.16, { delay: 0.16 });
      return;
    }
    if (type === "jetstream") {
      playNoise(0.12, 0.03, 780);
      playTone(720, 0.12, { gain: 0.04, slideTo: 980, delay: 0.02 });
      return;
    }
    if (type === "island") {
      playTone(392, 0.08, { gain: 0.04 });
      playTone(523.25, 0.1, { gain: 0.045, delay: 0.07 });
      playTone(783.99, 0.12, { gain: 0.05, delay: 0.15 });
      return;
    }
    if (type === "perfect") {
      playNoise(0.2, 0.018, 420);
      playTone(196, 0.16, { type: "sawtooth", gain: 0.028, slideTo: 312 });
      playTone(659.25, 0.09, { gain: 0.046, delay: 0.03 });
      playTone(783.99, 0.11, { gain: 0.05, delay: 0.1 });
      playTone(987.77, 0.16, { gain: 0.054, delay: 0.18 });
      return;
    }
    if (type === "touchdown") {
      playNoise(0.12, 0.036, 460);
      playNoise(0.08, 0.02, 1800, 0.02);
      playTone(176, 0.11, { type: "sawtooth", gain: 0.04, slideTo: 128 });
      playTone(220, 0.1, { type: "triangle", gain: 0.026, delay: 0.01, slideTo: 188 });
      playTone(523.25, 0.08, { gain: 0.022, delay: 0.045 });
      return;
    }
    if (type === "rollout") {
      playNoise(0.18, 0.018, 520, 0.02);
      playTone(148, 0.16, { type: "sawtooth", gain: 0.024, delay: 0.02, slideTo: 118 });
      playTone(294.33, 0.12, { gain: 0.018, delay: 0.08, slideTo: 247 });
      return;
    }
    if (type === "bounce") {
      playNoise(0.08, 0.026, 760);
      playTone(220, 0.08, { gain: 0.028, slideTo: 300 });
      playTone(410, 0.06, { gain: 0.016, delay: 0.04 });
      return;
    }
    if (type === "hit") {
      playNoise(0.14, 0.05, 720);
      playTone(220, 0.14, { type: "square", gain: 0.04, slideTo: 140 });
      return;
    }
    if (type === "success") {
      playTone(523.25, 0.14, { gain: 0.05 });
      playTone(659.25, 0.14, { gain: 0.05, delay: 0.08 });
      playTone(783.99, 0.18, { gain: 0.055, delay: 0.16 });
      return;
    }
    if (type === "stratosphere") {
      playNoise(0.14, 0.012, 1200);
      playTone(523.25, 0.12, { gain: 0.034, delay: 0.01 });
      playTone(783.99, 0.16, { gain: 0.038, delay: 0.1, slideTo: 932.33 });
      return;
    }
    if (type === "karman") {
      playNoise(0.22, 0.02, 980);
      playTone(392, 0.16, { type: "sawtooth", gain: 0.03, slideTo: 523.25 });
      playTone(659.25, 0.14, { gain: 0.034, delay: 0.08 });
      playTone(987.77, 0.18, { gain: 0.04, delay: 0.18 });
      return;
    }
    if (type === "orbit") {
      playNoise(0.18, 0.015, 1400);
      playTone(293.66, 0.24, { type: "sine", gain: 0.026, slideTo: 440 });
      playTone(587.33, 0.18, { gain: 0.03, delay: 0.09 });
      playTone(880, 0.22, { gain: 0.034, delay: 0.18 });
      return;
    }
    if (type === "iss") {
      playTone(659.25, 0.12, { gain: 0.034 });
      playTone(987.77, 0.14, { gain: 0.038, delay: 0.06 });
      playTone(1318.51, 0.18, { gain: 0.042, delay: 0.14 });
      playNoise(0.12, 0.012, 1800, 0.03);
      return;
    }
    if (type === "sticker") {
      playTone(523.25, 0.1, { gain: 0.038 });
      playTone(783.99, 0.1, { gain: 0.04, delay: 0.07 });
      playTone(1174.66, 0.14, { gain: 0.046, delay: 0.15 });
      playNoise(0.08, 0.01, 1600, 0.03);
      return;
    }
    if (type === "unlock") {
      playTone(587.33, 0.12, { gain: 0.05 });
      playTone(783.99, 0.12, { gain: 0.05, delay: 0.09 });
      playTone(1174.66, 0.16, { gain: 0.055, delay: 0.18 });
      return;
    }
    if (type === "fail") {
      playTone(310, 0.2, { type: "sawtooth", gain: 0.045, slideTo: 180 });
      playNoise(0.16, 0.028, 640, 0.02);
      return;
    }
    if (type === "sunset") {
      playTone(349.23, 0.18, { gain: 0.04 });
      playTone(293.66, 0.22, { gain: 0.04, delay: 0.1 });
    }
  }

  function scheduleMusicNote(note, startTime, secondsPerBeat) {
    if (!audio.ctx || audio.ctx.state !== "running" || !getState().audioEnabled || note.freq <= 0) {
      return;
    }
    const leadOsc = audio.ctx.createOscillator();
    const leadGain = audio.ctx.createGain();
    const bassOsc = audio.ctx.createOscillator();
    const bassGain = audio.ctx.createGain();
    const duration = Math.max(0.08, secondsPerBeat * note.beats * 0.9);
    leadOsc.type = "triangle";
    bassOsc.type = "sine";
    leadOsc.frequency.setValueAtTime(note.freq, startTime);
    bassOsc.frequency.setValueAtTime(note.freq * 0.5, startTime);
    leadGain.gain.setValueAtTime(0.0001, startTime);
    bassGain.gain.setValueAtTime(0.0001, startTime);
    leadGain.gain.exponentialRampToValueAtTime(0.028, startTime + 0.015);
    bassGain.gain.exponentialRampToValueAtTime(0.018, startTime + 0.02);
    leadGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    leadOsc.connect(leadGain);
    bassOsc.connect(bassGain);
    leadGain.connect(audio.musicGain);
    bassGain.connect(audio.musicGain);
    leadOsc.start(startTime);
    leadOsc.stop(startTime + duration + 0.02);
    bassOsc.start(startTime);
    bassOsc.stop(startTime + duration + 0.02);
  }

  function updateMusic() {
    if (!audio.ctx || !audio.started) {
      return;
    }
    const state = getState();
    const now = audio.ctx.currentTime;
    const target = state.audioEnabled ? (state.screen === "flight" ? 0.036 : 0.026) : 0;
    audio.musicGain.gain.setTargetAtTime(target, now, 0.12);
    if (!state.audioEnabled || audio.ctx.state !== "running") {
      return;
    }
    const tempo = state.screen === "flight" ? 122 : 104;
    const secondsPerBeat = 60 / tempo;
    while (audio.nextNoteTime < now + 0.3) {
      const note = musicPattern[audio.noteIndex % musicPattern.length];
      scheduleMusicNote(note, audio.nextNoteTime, secondsPerBeat);
      audio.nextNoteTime += secondsPerBeat * note.beats;
      audio.noteIndex += 1;
    }
  }

  return {
    hasSupport,
    ensureReady,
    setEnabled,
    playSfx,
    updateMusic,
  };
}
