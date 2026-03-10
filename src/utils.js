export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothStep(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export function random(min, max) {
  return min + Math.random() * (max - min);
}

export function createSeededRng(seed = 1) {
  let state = (Number(seed) >>> 0) || 1;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fract(value) {
  return value - Math.floor(value);
}

export function hash1(value, seed = 0) {
  return fract(Math.sin(value * 127.1 + seed * 311.7) * 43758.5453123);
}

export function noise1D(value, seed = 0) {
  const base = Math.floor(value);
  const t = smoothStep(value - base);
  return lerp(hash1(base, seed), hash1(base + 1, seed), t);
}

export function blendHex(hexA, hexB, amount) {
  const a = hexA.replace("#", "");
  const b = hexB.replace("#", "");
  const t = clamp(amount, 0, 1);
  const ar = Number.parseInt(a.slice(0, 2), 16);
  const ag = Number.parseInt(a.slice(2, 4), 16);
  const ab = Number.parseInt(a.slice(4, 6), 16);
  const br = Number.parseInt(b.slice(0, 2), 16);
  const bg = Number.parseInt(b.slice(2, 4), 16);
  const bb = Number.parseInt(b.slice(4, 6), 16);
  const r = Math.round(lerp(ar, br, t)).toString(16).padStart(2, "0");
  const g = Math.round(lerp(ag, bg, t)).toString(16).padStart(2, "0");
  const b2 = Math.round(lerp(ab, bb, t)).toString(16).padStart(2, "0");
  return `#${r}${g}${b2}`;
}

export function roundNumber(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
