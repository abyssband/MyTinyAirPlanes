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
      playTone(392, 0.1, { delay: 0.0 });
      playTone(523.25, 0.12, { delay: 0.08 });
      playTone(659.25, 0.16, { delay: 0.16 });
      return;
    }
    if (type === "draft") {
      playNoise(0.12, 0.03, 780);
      playTone(720, 0.12, { gain: 0.04, slideTo: 980, delay: 0.02 });
      return;
    }
    if (type === "star") {
      playTone(820, 0.06, { gain: 0.05 });
      playTone(1040, 0.08, { gain: 0.05, delay: 0.04 });
      return;
    }
    if (type === "fuel") {
      playTone(640, 0.08, { gain: 0.045, slideTo: 760 });
      playTone(960, 0.1, { gain: 0.04, delay: 0.05 });
      playNoise(0.06, 0.018, 900, 0.01);
      return;
    }
    if (type === "island") {
      playTone(392, 0.08, { gain: 0.04 });
      playTone(523.25, 0.1, { gain: 0.045, delay: 0.07 });
      playTone(783.99, 0.12, { gain: 0.05, delay: 0.15 });
      return;
    }
    if (type === "perfect") {
      playTone(659.25, 0.08, { gain: 0.05 });
      playTone(783.99, 0.08, { gain: 0.05, delay: 0.05 });
      playTone(987.77, 0.12, { gain: 0.055, delay: 0.11 });
      return;
    }
    if (type === "touchdown") {
      playNoise(0.1, 0.03, 540);
      playTone(210, 0.09, { type: "sawtooth", gain: 0.035, slideTo: 160 });
      playTone(440, 0.08, { gain: 0.03, delay: 0.03 });
      return;
    }
    if (type === "bounce") {
      playNoise(0.07, 0.024, 760);
      playTone(260, 0.08, { gain: 0.032, slideTo: 340 });
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
