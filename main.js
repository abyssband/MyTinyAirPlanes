import {
  AIRPORTS,
  FORCE_DEBUG,
  MAP_LANDMASSES,
  MAP_REGION_STICKERS,
  MUSIC_PATTERN,
  ROUTES,
  STORAGE_BEST_KEY,
  STORAGE_GHOSTS_KEY,
  STORAGE_UNLOCK_KEY,
} from "./src/config.js?v=20260313-1205";
import { createAudioController } from "./src/audio.js?v=20260313-1205";
import { createFlightRenderer } from "./src/flight/render.js?v=20260313-1205";
import { createFlightRuntime } from "./src/flight/runtime.js?v=20260313-1205";
import {
  loadPersistedState,
  saveAudioPreference,
  saveDebugPreference,
  saveGhostPreference,
  saveProgressData,
} from "./src/storage.js?v=20260313-1205";
import {
  blendHex,
  clamp,
  createSeededRng,
  fract,
  hash1,
  lerp,
  roundNumber,
  smoothStep,
} from "./src/utils.js?v=20260313-1205";

const mapScreen = document.getElementById("map-screen");
const flightScreen = document.getElementById("flight-screen");
const resultScreen = document.getElementById("result-screen");

const mapCanvas = document.getElementById("map-canvas");
const gameCanvas = document.getElementById("game-canvas");
const mapCtx = mapCanvas.getContext("2d");
const gameCtx = gameCanvas.getContext("2d");

const routeTitle = document.getElementById("route-title");
const routeMeta = document.getElementById("route-meta");
const routeDesc = document.getElementById("route-desc");
const routeMission = document.getElementById("route-mission");
const routeFromCode = document.getElementById("route-from-code");
const routeFromName = document.getElementById("route-from-name");
const routeToCode = document.getElementById("route-to-code");
const routeToName = document.getElementById("route-to-name");
const routeBriefing = document.getElementById("route-briefing");
const ghostSlotMeta = document.getElementById("ghost-slot-meta");
const ghostSlotBestButton = document.getElementById("ghost-slot-best");
const ghostSlotLastButton = document.getElementById("ghost-slot-last");
const routePills = document.getElementById("route-pills");
const startFlightButton = document.getElementById("start-flight");
const resetProgressButton = document.getElementById("reset-progress");
const audioToggleButton = document.getElementById("audio-toggle");
const ghostToggleButton = document.getElementById("ghost-toggle");
const debugToggleButton = document.getElementById("debug-toggle");

const hudDistance = document.getElementById("hud-distance");
const hudHealth = document.getElementById("hud-health");
const hudFuel = document.getElementById("hud-fuel");
const hudScore = document.getElementById("hud-score");
const hudPhase = document.getElementById("hud-phase");
const hudSystems = document.getElementById("hud-systems");
const hudGhost = document.getElementById("hud-ghost");
const hudMission = document.getElementById("hud-mission");
const debugPanel = document.getElementById("debug-panel");

const resultTitle = document.getElementById("result-title");
const resultSummary = document.getElementById("result-summary");
const resultBody = document.getElementById("result-body");
const resultStats = document.getElementById("result-stats");
const resultNotes = document.getElementById("result-notes");
const resultContinuePanel = document.getElementById("result-continue-panel");
const resultContinueSummary = document.getElementById("result-continue-summary");
const continueFlightButton = document.getElementById("continue-flight");
const resultGhostPanel = document.getElementById("result-ghost-panel");
const resultGhostSummary = document.getElementById("result-ghost-summary");
const resultGhostBestButton = document.getElementById("result-ghost-best");
const resultGhostLastButton = document.getElementById("result-ghost-last");
const retryFlightButton = document.getElementById("retry-flight");
const backToMapButton = document.getElementById("back-to-map");

const touchControls = document.getElementById("touch-controls");
const touchUp = document.getElementById("touch-up");
const touchDown = document.getElementById("touch-down");
const touchLeft = document.getElementById("touch-left");
const touchRight = document.getElementById("touch-right");

const state = {
  screen: "map",
  selectedRoute: 0,
  unlockedRoute: 0,
  bestRuns: {},
  ghostRuns: {},
  mapHoverRoute: -1,
  mapHoverRegion: "",
  mapRegionPop: {},
  mapRegionStars: [],
  mapPulse: 0,
  mapTransition: null,
  flight: null,
  result: null,
  input: {
    up: false,
    down: false,
    left: false,
    right: false,
    airbrake: false,
  },
  audioEnabled: true,
  ghostEnabled: true,
  debugEnabled: false,
  lastTick: performance.now(),
};

const GHOST_SAMPLE_INTERVAL = 0.08;

const audioController = createAudioController({
  getState: () => state,
  musicPattern: MUSIC_PATTERN,
});
const flightRuntime = createFlightRuntime({
  ROUTES,
  gameCanvas,
  state,
  clamp,
  lerp,
  smoothStep,
  hash1,
  createSeededRng,
  playSfx,
  finishFlight,
  updateHud,
  currentTakeoffSpeed,
  currentStallSpeed,
  landingAssistState,
  updateFlightSystems,
});
const {
  cameraX,
  worldToScreenY,
  spaceAltitudeRatio,
  horizonCurveOffset,
  oceanSurfaceAt,
  islandAltitudeAt,
  groundAltitudeAt,
  departureRunwayStart,
  departureRunwayEnd,
  arrivalRunwayStart,
  arrivalRunwayEnd,
  routeProgress,
  runwayDeckAltitudeAt,
  surfaceScreenY,
  createFlightState,
  getAltitudeRouteBands,
  getAltitudeBandState,
  updateFlight,
} = flightRuntime;
const flightRenderer = createFlightRenderer({
  AIRPORTS,
  ROUTES,
  gameCanvas,
  gameCtx,
  clamp,
  blendHex,
  hash1,
  fract,
  lerp,
  drawRoundRectPath,
  cameraX,
  worldToScreenY,
  spaceAltitudeRatio,
  horizonCurveOffset,
  oceanSurfaceAt,
  islandAltitudeAt,
  routeProgress,
  runwayDeckAltitudeAt,
  surfaceScreenY,
  getAltitudeRouteBands,
  getAltitudeBandState,
  landingAssistState,
  nightApproachRatio,
  getState: () => state,
});

function missionItems(route) {
  return [
    `成功抵達 B 機場`,
    `收集至少 ${route.mission.stars} 顆星星`,
    `穿過至少 ${route.mission.drafts} 道風流`,
  ];
}

function loadProgress() {
  const persisted = loadPersistedState(localStorage);
  state.unlockedRoute = persisted.unlockedRoute;
  state.bestRuns = persisted.bestRuns;
  state.ghostRuns = persisted.ghostRuns;
  state.audioEnabled = persisted.audioEnabled;
  state.ghostEnabled = persisted.ghostEnabled;
  state.debugEnabled = persisted.debugEnabled;
}

function saveProgress() {
  saveProgressData(localStorage, state.unlockedRoute, state.bestRuns, state.ghostRuns);
}

function saveAudioSetting() {
  saveAudioPreference(localStorage, state.audioEnabled);
}

function saveDebugSetting() {
  saveDebugPreference(localStorage, state.debugEnabled);
}

function saveGhostSetting() {
  saveGhostPreference(localStorage, state.ghostEnabled);
}

function updateAudioToggleLabel() {
  if (!audioToggleButton) {
    return;
  }
  if (!audioController.hasSupport()) {
    audioToggleButton.textContent = "音效: 不支援";
    audioToggleButton.disabled = true;
    return;
  }
  audioToggleButton.disabled = false;
  audioToggleButton.textContent = state.audioEnabled ? "音效: 開啟" : "音效: 關閉";
}

function ghostSlotLabel(slot) {
  return slot === "last" ? "最近回放" : "最佳鬼影";
}

function updateGhostToggleLabel() {
  if (!ghostToggleButton) {
    return;
  }
  const hasGhost = Boolean(getGhostRun(getRoute(state.selectedRoute)?.id || "")?.samples?.length);
  ghostToggleButton.textContent = state.ghostEnabled
    ? hasGhost ? "鬼影: 開啟" : "鬼影: 開啟（無紀錄）"
    : "鬼影: 關閉";
}

function updateDebugToggleLabel() {
  if (!debugToggleButton) {
    return;
  }
  debugToggleButton.hidden = !FORCE_DEBUG;
  debugToggleButton.disabled = !FORCE_DEBUG;
  debugToggleButton.textContent = state.debugEnabled ? "Debug: 開啟" : "Debug: 關閉";
}

function clampThrottle(value) {
  return clamp(value, 0.18, 1);
}

function clampFlaps(value) {
  return clamp(Math.round(value), 0, 2);
}

function flapsLabel(value) {
  return ["0", "1", "2"][clampFlaps(value)];
}

function throttlePercent(value) {
  return Math.round(clampThrottle(value) * 100);
}

function nightApproachRatio(flight) {
  if (!flight) {
    return 0;
  }
  const sunRatio = clamp(flight.sun / Math.max(1, flight.maxSun), 0, 1);
  const approachBoost = smoothStep((routeProgress(flight) - 0.62) / 0.24) * 0.35;
  return clamp(1 - sunRatio * 1.18 + approachBoost, 0, 1);
}

function currentRotateSpeed(flight) {
  return Math.max(920, flight.rotateSpeed - flight.flapLift * 72);
}

function currentTakeoffSpeed(flight) {
  return Math.max(980, flight.takeoffSpeed - flight.flapLift * 92);
}

function currentStallSpeed(flight) {
  return Math.max(720, flight.stallSpeed - flight.flapLift * 124);
}

function altitudeBandLabel(flight) {
  if (!flight) {
    return "待命";
  }
  return getAltitudeBandState(flight).title;
}

function altitudeBandHint(flight) {
  if (!flight) {
    return "";
  }
  const band = getAltitudeBandState(flight);
  return `${band.title} · ${band.reward} / ${band.risk}`;
}

function currentFuelPercent(flight) {
  if (!flight) {
    return 0;
  }
  return clamp((flight.fuel / Math.max(1, flight.maxFuel)) * 100, 0, 100);
}

function autoThrottleTarget(flight) {
  if (flight.engineOut) {
    return 0.18;
  }
  if (flight.grounded && flight.runwayState === "departure") {
    return 1;
  }
  if (flight.grounded && flight.runwayState === "arrival") {
    return 0.18;
  }
  if (flight.phase === "climbout") {
    return 0.94;
  }
  if (flight.phase === "descent") {
    return 0.58;
  }
  if (flight.phase === "approach") {
    return landingAssistState(flight).flareWindow ? 0.28 : 0.44;
  }
  if (flight.phase === "landing_roll") {
    return 0.18;
  }
  return 0.82;
}

function autoFlapSetting(flight) {
  if (flight.grounded && flight.runwayState === "departure") {
    return 1;
  }
  if (flight.phase === "climbout") {
    return routeProgress(flight) < 0.06 ? 1 : 0;
  }
  if (flight.phase === "descent") {
    return 1;
  }
  if (flight.phase === "approach" || flight.phase === "landing_roll") {
    return 2;
  }
  return 0;
}

function speedControlLabel(flight) {
  if (!flight) {
    return "保持";
  }
  if (state.input.left) {
    return flight.grounded && flight.runwayState === "arrival" ? "地面煞停" : "減速";
  }
  if (state.input.right) {
    return flight.grounded && flight.runwayState === "departure" ? "起飛加速" : "加速";
  }
  return flight.phase === "approach" || flight.phase === "descent" ? "自動進場" : "保持";
}

function updateFlightSystems(flight, dt) {
  const flareWindow = landingAssistState(flight).flareWindow;
  let throttleTarget = autoThrottleTarget(flight);
  if (state.input.right) {
    throttleTarget += flight.grounded && flight.runwayState === "departure" ? 0.08 : 0.18;
  }
  if (state.input.left) {
    throttleTarget -= flight.grounded && flight.runwayState === "arrival" ? 0.24 : 0.26;
  }
  if (flareWindow) {
    throttleTarget = Math.min(throttleTarget, 0.34);
  }
  flight.throttleTarget = clampThrottle(throttleTarget);
  flight.flaps = clampFlaps(autoFlapSetting(flight));
  state.input.airbrake = state.input.left;
  flight.throttle = lerp(flight.throttle, flight.throttleTarget, clamp(dt * 4.8, 0.05, 0.24));
  const airbrakeTarget = state.input.airbrake ? 1 : 0;
  flight.airbrakeDrag = lerp(flight.airbrakeDrag, airbrakeTarget, clamp(dt * 7.5, 0.08, 0.3));
  const flapTarget = [0, 0.52, 1][flight.flaps];
  flight.flapLift = lerp(flight.flapLift, flapTarget, clamp(dt * 5.8, 0.06, 0.28));
  if (!flight.grounded && state.input.airbrake) {
    flight.spoilers = lerp(flight.spoilers, 0.62, 0.18);
  } else if (!flight.grounded) {
    flight.spoilers = Math.max(0, flight.spoilers - dt * 1.1);
  }
}

function landingAssistState(flight) {
  if (!flight) {
    return {
      distanceToThreshold: 0,
      heightAboveDeck: 0,
      gearDown: false,
      flareWindow: false,
      runwayAhead: 0,
    };
  }
  const distanceToThreshold = arrivalRunwayStart(flight) - flight.worldX;
  const heightAboveDeck = flight.altitude - (flight.runwayAltitude + flight.planeBottomOffset);
  const gearDown = flight.grounded
    || flight.phase === "landing_roll"
    || distanceToThreshold <= flight.gearDeployDistance;
  const flareWindow = !flight.grounded
    && distanceToThreshold <= flight.flareStartDistance
    && heightAboveDeck <= flight.flareHeight
    && flight.vy < 40;
  return {
    distanceToThreshold,
    heightAboveDeck,
    gearDown,
    flareWindow,
    runwayAhead: arrivalRunwayEnd(flight) - flight.worldX,
  };
}

function getGhostRecord(routeId) {
  return state.ghostRuns[routeId] || null;
}

function getGhostSlot(routeId) {
  const record = getGhostRecord(routeId);
  if (!record) {
    return "best";
  }
  if (record.activeSlot === "last" && record.last) {
    return "last";
  }
  return record.best ? "best" : "last";
}

function getGhostRun(routeId, slot = null) {
  const record = getGhostRecord(routeId);
  if (!record) {
    return null;
  }
  const activeSlot = slot || getGhostSlot(routeId);
  if (activeSlot === "last" && record.last) {
    return record.last;
  }
  return record.best || record.last || null;
}

function selectGhostSlotMode(slot, routeId = getRoute(state.selectedRoute)?.id, options = {}) {
  const record = getGhostRecord(routeId);
  if (!record) {
    return false;
  }
  if (slot === "last" && !record.last) {
    return false;
  }
  if (slot === "best" && !record.best) {
    return false;
  }
  record.activeSlot = slot;
  if (options.persist !== false) {
    saveProgress();
  }
  updateRouteInfo();
  updateHud();
  updateGhostToggleLabel();
  updateGhostControls();
  return true;
}

function setGhostEnabled(enabled, options = {}) {
  state.ghostEnabled = Boolean(enabled);
  if (options.persist !== false) {
    saveGhostSetting();
  }
  if (state.screen === "map") {
    updateRouteInfo();
  }
  updateGhostToggleLabel();
  updateHud();
}

function createGhostPlayback(ghostRun, slot = "best") {
  if (!ghostRun?.samples?.length) {
    return null;
  }
  return {
    slot,
    time: ghostRun.time,
    seed: ghostRun.seed,
    samples: ghostRun.samples,
    cursor: 0,
    chaseCursor: 0,
  };
}

function createGhostRecorder() {
  return {
    interval: GHOST_SAMPLE_INTERVAL,
    lastSampleAt: -Infinity,
    samples: [],
  };
}

function recordGhostSample(flight, force = false) {
  const recorder = flight?.ghostRecorder;
  if (!recorder) {
    return;
  }
  if (!force && flight.elapsed - recorder.lastSampleAt < recorder.interval) {
    return;
  }
  const sample = [
    roundNumber(flight.elapsed, 2),
    roundNumber(flight.worldX, 1),
    roundNumber(flight.altitude, 1),
    roundNumber(flight.pitch, 3),
    flight.grounded ? 1 : 0,
  ];
  const last = recorder.samples[recorder.samples.length - 1];
  if (!last || sample.some((value, index) => value !== last[index])) {
    recorder.samples.push(sample);
  }
  recorder.lastSampleAt = flight.elapsed;
}

function buildGhostRun(flight) {
  if (!flight?.ghostRecorder) {
    return null;
  }
  recordGhostSample(flight, true);
  if (!flight.ghostRecorder.samples.length) {
    return null;
  }
  return {
    time: roundNumber(flight.elapsed, 3),
    seed: flight.seed,
    samples: flight.ghostRecorder.samples.slice(0, 2400),
  };
}

function sampleGhostPlayback(playback, elapsed, cursorKey = "cursor") {
  if (!playback?.samples?.length) {
    return null;
  }
  const samples = playback.samples;
  const limit = playback.time || samples[samples.length - 1][0] || 0;
  const clampedTime = clamp(elapsed, 0, limit);
  let index = clamp(playback[cursorKey] || 0, 0, Math.max(0, samples.length - 2));
  while (index < samples.length - 2 && samples[index + 1][0] < clampedTime) {
    index += 1;
  }
  while (index > 0 && samples[index][0] > clampedTime) {
    index -= 1;
  }
  playback[cursorKey] = index;
  const current = samples[index];
  const next = samples[Math.min(index + 1, samples.length - 1)];
  if (!next || next === current) {
    return {
      worldX: current[1],
      altitude: current[2],
      pitch: current[3],
      grounded: current[4] === 1,
    };
  }
  const span = Math.max(0.0001, next[0] - current[0]);
  const t = clamp((clampedTime - current[0]) / span, 0, 1);
  return {
    worldX: lerp(current[1], next[1], t),
    altitude: lerp(current[2], next[2], t),
    pitch: lerp(current[3], next[3], t),
    grounded: (t < 0.5 ? current[4] : next[4]) === 1,
  };
}

function ghostChaseState(flight) {
  if (!flight?.ghostPlayback?.samples?.length) {
    return { available: false, enabled: state.ghostEnabled, label: state.ghostEnabled ? "鬼影 開啟 · 目前沒有紀錄" : "鬼影 已隱藏" };
  }
  if (!state.ghostEnabled) {
    return { available: true, enabled: false, label: "鬼影 已隱藏" };
  }
  const ghost = sampleGhostPlayback(flight.ghostPlayback, flight.elapsed, "chaseCursor");
  if (!ghost) {
    return { available: false, enabled: true, label: "鬼影 開啟 · 目前沒有紀錄" };
  }
  const deltaMeters = flight.worldX - ghost.worldX;
  const slotLabel = ghostSlotLabel(flight.ghostPlayback.slot);
  let label = "鬼影 開啟 · 與鬼影並行";
  if (deltaMeters > 36) {
    label = `${slotLabel} · 領先 ${Math.round(deltaMeters)} m`;
  } else if (deltaMeters < -36) {
    label = `${slotLabel} · 落後 ${Math.round(Math.abs(deltaMeters))} m`;
  } else {
    label = `${slotLabel} · 與你並行`;
  }
  return {
    available: true,
    enabled: true,
    label,
    deltaMeters,
  };
}

function compareAgainstGhost(ghostRun, flight, slot = "best") {
  if (!ghostRun || !flight) {
    return "";
  }
  const label = ghostSlotLabel(slot);
  const delta = flight.elapsed - ghostRun.time;
  if (Math.abs(delta) < 0.05) {
    return `與${label}幾乎同時抵達`;
  }
  if (delta < 0) {
    return `超越${label}：快 ${Math.abs(delta).toFixed(1)} 秒`;
  }
  return `沒追上${label}：慢 ${delta.toFixed(1)} 秒`;
}

function updateGhostRun(routeId, flight) {
  const nextGhost = buildGhostRun(flight);
  if (!nextGhost) {
    return "";
  }
  const record = getGhostRecord(routeId) || {
    activeSlot: "best",
    best: null,
    last: null,
  };
  const previousBest = record.best;
  record.last = nextGhost;
  let message = `最近回放已更新：${nextGhost.time.toFixed(1)} 秒`;
  if (!record.best || nextGhost.time < record.best.time) {
    record.best = nextGhost;
    message += previousBest
      ? ` · 最佳鬼影更新：${nextGhost.time.toFixed(1)} 秒`
      : ` · 已建立最佳鬼影`;
  }
  if (!record.activeSlot || (record.activeSlot === "last" && !record.last)) {
    record.activeSlot = record.best ? "best" : "last";
  }
  state.ghostRuns[routeId] = record;
  return message;
}

function getFlightTouchdownState(flight) {
  if (!flight) {
    return null;
  }
  const runwayAltitude = runwayDeckAltitudeAt(flight, flight.worldX, flight.arrivalAirportX);
  const planeBottom = flight.altitude - flight.planeBottomOffset;
  const sinkRate = Math.max(0, -flight.vy);
  const overRunway = runwayAltitude > -Infinity;
  const runwayDelta = overRunway ? planeBottom - runwayAltitude : null;
  const departureRemaining = departureRunwayEnd(flight) - flight.worldX;
  const arrivalRemaining = arrivalRunwayEnd(flight) - flight.worldX;
  const assist = landingAssistState(flight);
  const takeoffReady = flight.speed >= currentTakeoffSpeed(flight);
  const rotateReady = flight.speed >= currentRotateSpeed(flight);
  const safeTouchdown = sinkRate <= flight.landingBounceSink
    && flight.speed <= flight.landingMaxTouchdownSpeed
    && flight.pitch <= flight.landingSafePitch;
  const crashTouchdown = sinkRate > flight.landingCrashSink
    || flight.speed > flight.landingMaxTouchdownSpeed
    || flight.pitch > flight.landingCrashPitch;
  const rolloutDecel = flight.rollBrake + flight.landingBrakeBonus + flight.speed * 0.07;
  const stopEstimate = flight.speed <= flight.rolloutStopSpeed ? 0 : (flight.speed * flight.speed) / (2 * Math.max(1, rolloutDecel));
  return {
    overRunway,
    runwayDelta,
    sinkRate,
    takeoffReady,
    rotateReady,
    departureRemaining,
    arrivalRemaining,
    safeTouchdown,
    crashTouchdown,
    stopEstimate,
    gearDown: assist.gearDown,
    flareWindow: assist.flareWindow,
    distanceToThreshold: assist.distanceToThreshold,
  };
}

function getSnapshot() {
  const selectedRoute = getRoute(state.selectedRoute);
  const selectedGhostRecord = selectedRoute ? getGhostRecord(selectedRoute.id) : null;
  const selectedGhost = selectedRoute ? getGhostRun(selectedRoute.id) : null;
  const snapshot = {
    screen: state.screen,
    selectedRoute: state.selectedRoute,
    unlockedRoute: state.unlockedRoute,
    debugEnabled: state.debugEnabled,
    audioEnabled: state.audioEnabled,
    ghostEnabled: state.ghostEnabled,
    selectedRouteGhost: selectedGhost
      ? {
          slot: selectedRoute ? getGhostSlot(selectedRoute.id) : "best",
          activeTime: roundNumber(selectedGhost.time, 1),
          activeFrames: selectedGhost.samples.length,
          bestTime: roundNumber(selectedGhostRecord?.best?.time || 0, 1),
          lastTime: roundNumber(selectedGhostRecord?.last?.time || 0, 1),
          seed: selectedGhost.seed,
        }
      : null,
  };

  if (state.flight) {
    const flight = state.flight;
    const route = ROUTES[flight.routeIndex];
    const touchdown = getFlightTouchdownState(flight);
    snapshot.flight = {
      routeId: route.id,
      from: route.from,
      to: route.to,
      progress: roundNumber(routeProgress(flight), 3),
      worldX: roundNumber(flight.worldX),
      remaining: roundNumber(arrivalRunwayStart(flight) - flight.worldX),
      routeDistance: flight.routeDistance,
      altitude: roundNumber(flight.altitude),
      cameraAltitude: roundNumber(flight.cameraAltitude),
      verticalSpeed: roundNumber(flight.vy),
      speed: roundNumber(flight.speed),
      altitudeBand: flight.altitudeBand || getAltitudeBandState(flight).id,
      altitudeBandLabel: altitudeBandLabel(flight),
      altitudeBandHint: altitudeBandHint(flight),
      throttle: roundNumber(flight.throttle, 2),
      throttleTarget: roundNumber(flight.throttleTarget, 2),
      flaps: flight.flaps,
      left: state.input.left,
      right: state.input.right,
      airbrake: state.input.airbrake,
      sun: roundNumber(flight.sun),
      sunPct: roundNumber(currentSunPercent(flight)),
      fuel: roundNumber(flight.fuel),
      maxFuel: roundNumber(flight.maxFuel),
      fuelPct: roundNumber(currentFuelPercent(flight)),
      engineOut: flight.engineOut,
      hadEngineOut: flight.hadEngineOut,
      lowFuelWarning: flight.lowFuelWarning,
      stars: flight.stars,
      drafts: flight.drafts,
      hits: flight.hits,
      grounded: flight.grounded,
      runwayState: flight.runwayState,
      phase: flight.phase,
      phaseText: phaseLabel(flight),
      spaceRatio: roundNumber(spaceAltitudeRatio(flight), 3),
      runwayAltitude: flight.runwayAltitude,
      runwayHalf: flight.runwayHalf,
      arrivalAirportX: roundNumber(flight.arrivalAirportX),
      departureRunwayStart: roundNumber(departureRunwayStart(flight)),
      departureRunwayEnd: roundNumber(departureRunwayEnd(flight)),
      arrivalRunwayStart: roundNumber(arrivalRunwayStart(flight)),
      arrivalRunwayEnd: roundNumber(arrivalRunwayEnd(flight)),
      planeBottomOffset: flight.planeBottomOffset,
      overRunway: touchdown.overRunway,
      runwayDelta: touchdown.runwayDelta === null ? null : roundNumber(touchdown.runwayDelta),
      sinkRate: roundNumber(touchdown.sinkRate),
      takeoffReady: touchdown.takeoffReady,
      rotateReady: touchdown.rotateReady,
      departureRemaining: roundNumber(touchdown.departureRemaining),
      arrivalRemaining: roundNumber(touchdown.arrivalRemaining),
      safeTouchdown: touchdown.safeTouchdown,
      crashTouchdown: touchdown.crashTouchdown,
      stopEstimate: roundNumber(touchdown.stopEstimate),
      gearDown: touchdown.gearDown,
      flareWindow: touchdown.flareWindow,
      distanceToThreshold: roundNumber(touchdown.distanceToThreshold),
      touchdownRating: flight.touchdownRating || "",
      touchdownSpeed: roundNumber(flight.touchdownSpeed),
      touchdownSinkRate: roundNumber(flight.touchdownSinkRate),
      spoilers: roundNumber(flight.spoilers, 2),
      nightRatio: roundNumber(nightApproachRatio(flight), 2),
      ghostAvailable: Boolean(flight.ghostPlayback?.samples?.length),
      ghostSlot: flight.ghostPlayback?.slot || "",
      ghostTime: roundNumber(flight.ghostPlayback?.time || 0, 1),
      ghostFrames: flight.ghostPlayback?.samples?.length || 0,
      ghostEnabled: state.ghostEnabled,
      rngSeed: flight.seed,
      cloudSignature: flight.initialCloudSignature || flight.clouds
        .slice(0, 3)
        .map((cloud) => `${roundNumber(cloud.x)},${roundNumber(cloud.altitude)},${roundNumber(cloud.r)}`)
        .join("|"),
    };
  }

  if (state.result) {
    snapshot.result = {
      routeIndex: state.result.routeIndex,
      title: state.result.title || resultTitle.textContent,
      summary: state.result.summary || resultSummary?.textContent || "",
      body: state.result.body || resultBody.textContent,
      notes: state.result.notes || [],
      continueRouteIndex: state.result.continueRouteIndex,
      continueRouteId: state.result.continueRouteId,
      continueFrom: state.result.continueFrom,
      continueTo: state.result.continueTo,
    };
  }

  return snapshot;
}

function renderDebugPanel() {
  if (!debugPanel) {
    return;
  }
  const visible = state.debugEnabled && state.screen === "flight";
  debugPanel.classList.toggle("hidden", !visible);
  if (!visible) {
    return;
  }

  const snapshot = getSnapshot();
  const flight = snapshot.flight;
  if (!flight) {
    debugPanel.textContent = "等待飛行資料...";
    return;
  }

  debugPanel.textContent = [
    `screen        ${snapshot.screen}`,
    `route         ${flight.from} -> ${flight.to} (${flight.routeId})`,
    `progress      ${(flight.progress * 100).toFixed(1)}%`,
    `worldX        ${flight.worldX} / ${flight.routeDistance}`,
    `remaining     ${flight.remaining}`,
    `altitude      ${flight.altitude}`,
    `band          ${flight.altitudeBandLabel}`,
    `cameraAlt     ${flight.cameraAltitude}`,
    `verticalSpeed ${flight.verticalSpeed}`,
    `speed         ${flight.speed}`,
    `systems       thr ${flight.throttleTarget} / flaps ${flight.flaps} / brake ${flight.airbrake ? "on" : "off"} / input ${flight.left ? "L" : "-"}${flight.right ? "R" : "-"}`,
    `fuel          ${flight.fuelPct}% (${flight.fuel}/${flight.maxFuel}) / ${flight.engineOut ? "engine-out" : flight.lowFuelWarning ? "low" : "stable"}`,
    `sun           ${flight.sunPct}%`,
    `nightRatio    ${flight.nightRatio}`,
    `spaceRatio    ${flight.spaceRatio}`,
    `phase         ${flight.phaseText}`,
    `grounded      ${flight.grounded ? flight.runwayState || "ground" : "air"}`,
    `runway        ${flight.overRunway ? "over-deck" : "off-deck"} / delta ${flight.runwayDelta === null ? "-" : flight.runwayDelta}`,
    `takeoff       ${flight.takeoffReady ? "ready" : "build-speed"} / remain ${flight.departureRemaining}`,
    `landing       ${flight.safeTouchdown ? "safe" : flight.crashTouchdown ? "unsafe" : "bounce"} / remain ${flight.arrivalRemaining}`,
    `assist        gear ${flight.gearDown ? "down" : "up"} / flare ${flight.flareWindow ? "yes" : "no"} / spoilers ${flight.spoilers}`,
    `touchdown     ${flight.touchdownRating || "-"} / sink ${flight.touchdownSinkRate || "-"} / speed ${flight.touchdownSpeed || "-"}`,
    `rollout est   ${flight.stopEstimate}`,
    `ghost         ${flight.ghostEnabled ? (flight.ghostAvailable ? `${flight.ghostSlot || "best"} / ${flight.ghostTime}s / ${flight.ghostFrames} frames` : "none") : "hidden"}`,
    `stars/drafts  ${flight.stars} / ${flight.drafts}`,
  ].join("\n");
}

function normalizeDebugActor(actor, flight) {
  if (!actor || typeof actor !== "object") {
    return null;
  }
  const type = typeof actor.type === "string" ? actor.type : "star";
  return {
    type,
    band: typeof actor.band === "string" ? actor.band : "mid",
    x: Number.isFinite(actor.x) ? Number(actor.x) : flight.worldX + 160,
    altitude: Number.isFinite(actor.altitude) ? Number(actor.altitude) : flight.altitude,
    r: Number.isFinite(actor.r) ? Number(actor.r) : 12,
    rx: Number.isFinite(actor.rx) ? Number(actor.rx) : 60,
    ry: Number.isFinite(actor.ry) ? Number(actor.ry) : 72,
    strength: Number.isFinite(actor.strength) ? Number(actor.strength) : 1,
    speedBonus: Number.isFinite(actor.speedBonus) ? Number(actor.speedBonus) : 160,
    lift: Number.isFinite(actor.lift) ? Number(actor.lift) : 20,
    damage: Number.isFinite(actor.damage) ? Number(actor.damage) : 10,
    amount: Number.isFinite(actor.amount) ? Number(actor.amount) : 18,
    phase: Number.isFinite(actor.phase) ? Number(actor.phase) : 0,
    collected: Boolean(actor.collected),
  };
}

function setDebugEnabled(enabled, options = {}) {
  if (!FORCE_DEBUG) {
    state.debugEnabled = false;
    renderDebugPanel();
    return;
  }
  state.debugEnabled = Boolean(enabled);
  if (options.persist !== false) {
    saveDebugSetting();
  }
  updateDebugToggleLabel();
  renderDebugPanel();
}

function debugPatchFlight(patch = {}) {
  if (!state.flight || !patch || typeof patch !== "object") {
    return getSnapshot();
  }
  const flight = state.flight;
  const numericKeys = ["worldX", "altitude", "cameraAltitude", "vy", "speed", "sun", "fuel", "maxFuel", "stars", "drafts", "hits", "groundBounce", "groundBounceVelocity", "throttle", "throttleTarget", "spawnCursor"];
  numericKeys.forEach((key) => {
    if (Number.isFinite(patch[key])) {
      flight[key] = Number(patch[key]);
    }
  });
  if (typeof patch.phase === "string") {
    flight.phase = patch.phase;
  }
  if (typeof patch.grounded === "boolean") {
    flight.grounded = patch.grounded;
  }
  if (typeof patch.engineOut === "boolean") {
    flight.engineOut = patch.engineOut;
  }
  if (typeof patch.hadEngineOut === "boolean") {
    flight.hadEngineOut = patch.hadEngineOut;
  }
  if (typeof patch.runwayState === "string" || patch.runwayState === null) {
    flight.runwayState = patch.runwayState;
  }
  if (Number.isFinite(patch.flaps)) {
    flight.flaps = clampFlaps(patch.flaps);
  }
  if (typeof patch.airbrake === "boolean") {
    state.input.airbrake = patch.airbrake;
  }
  if (patch.clearActors) {
    flight.actors = [];
  }
  if (Array.isArray(patch.actors)) {
    flight.actors = patch.actors.map((actor) => normalizeDebugActor(actor, flight)).filter(Boolean);
  }
  flight.worldX = clamp(flight.worldX, departureRunwayStart(flight) - 40, arrivalRunwayEnd(flight) + 80);
  flight.altitude = Math.max(flight.planeBottomOffset + 2, flight.altitude);
  flight.speed = clamp(flight.speed, 0, flight.maxSpeed);
  flight.throttle = clampThrottle(flight.throttle);
  flight.throttleTarget = clampThrottle(flight.throttleTarget);
  flight.sun = clamp(flight.sun, 0, flight.maxSun);
  flight.maxFuel = Math.max(1, flight.maxFuel);
  flight.fuel = clamp(flight.fuel, 0, flight.maxFuel);
  if (flight.fuel <= 0.01) {
    flight.fuel = 0;
    flight.engineOut = true;
    flight.hadEngineOut = true;
  }
  flight.lowFuelWarning = flight.fuel > 0 && flight.fuel <= flight.maxFuel * 0.18;
  updateHud();
  renderDebugPanel();
  return getSnapshot();
}

function ensureAudioReady() {
  return audioController.ensureReady();
}

function setAudioEnabled(enabled) {
  state.audioEnabled = Boolean(enabled);
  saveAudioSetting();
  updateAudioToggleLabel();
  audioController.setEnabled(state.audioEnabled);
}

function playSfx(type) {
  audioController.playSfx(type);
}

function updateMusic() {
  audioController.updateMusic();
}

function setScreen(name) {
  state.screen = name;
  mapScreen.classList.toggle("hidden", name !== "map");
  flightScreen.classList.toggle("hidden", name !== "flight");
  resultScreen.classList.toggle("hidden", name !== "result");
  touchControls.classList.toggle("hidden", name !== "flight");
  if (name !== "map") {
    state.mapTransition = null;
    state.mapHoverRoute = -1;
    state.mapHoverRegion = "";
    state.mapRegionPop = {};
    state.mapRegionStars = [];
  }
  if (name === "map") {
    renderRoutePills();
    updateRouteInfo();
  }
  updateGhostToggleLabel();
  updateGhostControls();
  renderDebugPanel();
}

function getRoute(index) {
  return ROUTES[index];
}

function routeCodeLabel(route) {
  return `${AIRPORTS[route.from].code} -> ${AIRPORTS[route.to].code}`;
}

function routeNameLabel(route) {
  return `${AIRPORTS[route.from].name} -> ${AIRPORTS[route.to].name}`;
}

function normalizeLongitude(lon) {
  if (lon > 180) {
    return lon - 360;
  }
  if (lon < -180) {
    return lon + 360;
  }
  return lon;
}

function interpolateLongitude(fromLon, toLon, t) {
  let delta = toLon - fromLon;
  if (delta > 180) {
    delta -= 360;
  } else if (delta < -180) {
    delta += 360;
  }
  return normalizeLongitude(fromLon + delta * t);
}

function haversineKm(a, b) {
  const radius = 6371;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const hav = Math.sin(dLat * 0.5) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon * 0.5) ** 2;
  const arc = 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
  return radius * arc;
}

function flightGeoPosition(flight, reason) {
  const route = ROUTES[flight.routeIndex];
  if (reason === "arrived") {
    const airport = AIRPORTS[route.to];
    return { lat: airport.lat, lon: airport.lon };
  }
  const from = AIRPORTS[route.from];
  const to = AIRPORTS[route.to];
  const progress = clamp(routeProgress(flight), 0, 1);
  return {
    lat: lerp(from.lat, to.lat, progress),
    lon: interpolateLongitude(from.lon, to.lon, progress),
  };
}

function findContinueSuggestion(flight, reason) {
  const position = flightGeoPosition(flight, reason);
  const rankedAirports = Object.values(AIRPORTS)
    .map((airport) => ({
      airport,
      distanceKm: haversineKm(position, airport),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  for (const candidate of rankedAirports) {
    const routeIndex = ROUTES.findIndex((route, index) => index <= state.unlockedRoute && route.from === candidate.airport.code);
    if (routeIndex !== -1) {
      const route = ROUTES[routeIndex];
      return {
        airportCode: candidate.airport.code,
        airportName: candidate.airport.name,
        distanceKm: Math.round(candidate.distanceKm),
        routeIndex,
        routeId: route.id,
        fromCode: route.from,
        fromName: AIRPORTS[route.from].name,
        toCode: route.to,
        toName: AIRPORTS[route.to].name,
      };
    }
  }

  return null;
}

function fallbackContinueSuggestion(flight) {
  const route = ROUTES[flight.routeIndex];
  return {
    airportCode: route.from,
    airportName: AIRPORTS[route.from].name,
    distanceKm: 0,
    routeIndex: flight.routeIndex,
    routeId: route.id,
    fromCode: route.from,
    fromName: AIRPORTS[route.from].name,
    toCode: route.to,
    toName: AIRPORTS[route.to].name,
    isFallback: true,
  };
}

function resolveContinueSuggestion(flight, reason) {
  return findContinueSuggestion(flight, reason) || fallbackContinueSuggestion(flight);
}

function resultReasonSummary(reason, flight, route) {
  if (reason === "arrived") {
    return flight.hadEngineOut
      ? `途中一度燃油見底，但你還是把飛機帶進 ${AIRPORTS[route.to].code}。`
      : `已經在 ${AIRPORTS[route.to].code} 跑道滑停，這段航班順利完成。`;
  }
  if (reason === "crash") {
    return flight.hadEngineOut
      ? "燃油耗盡後失去推力，最後沒有把滑翔線穩住。"
      : "高度或接地姿態沒有控制好，最後墜海或重落。";
  }
  if (reason === "takeoff_overrun") {
    return flight.engineOut
      ? "滑跑途中推力中斷，跑道用完前還是沒能離地。"
      : "跑道用完了，但起飛速度還是不足。";
  }
  if (reason === "landing_overrun") {
    return "雖然已經接地，但跑道不夠長，最後還是衝出了跑道。";
  }
  if (reason === "missed") {
    return flight.hadEngineOut
      ? "你一路滑翔到機場附近，但最後還是沒有對準跑道。"
      : "你飛過了機場，但最後沒有把跑道對正。";
  }
  return "這趟航班沒有順利完成。";
}

function renderResultSummary(summary) {
  if (resultSummary) {
    resultSummary.textContent = summary;
  }
}

function renderResultStats(items) {
  if (!resultStats) {
    return;
  }
  resultStats.innerHTML = items.map((item) => `
    <article class="result-stat">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
      <small>${item.meta}</small>
    </article>
  `).join("");
}

function renderResultNotes(notes) {
  if (!resultNotes) {
    return;
  }
  const visible = notes.length > 0;
  resultNotes.classList.toggle("hidden", !visible);
  resultNotes.innerHTML = visible
    ? notes.map((note) => `<li>${note}</li>`).join("")
    : "";
}

function renderContinuePanel(continueSuggestion, currentRouteIndex) {
  if (!resultContinuePanel || !continueFlightButton || !resultContinueSummary) {
    return;
  }
  const sameRoute = continueSuggestion.routeIndex === currentRouteIndex;
  const sameAirport = continueSuggestion.airportCode === continueSuggestion.fromCode;
  const airportLabel = sameAirport
    ? `${continueSuggestion.airportName} ${continueSuggestion.airportCode}`
    : `${continueSuggestion.airportName} ${continueSuggestion.airportCode}（離目前約 ${continueSuggestion.distanceKm} km）`;
  resultContinueSummary.textContent = sameRoute
    ? `目前最近可續飛的航班還是這一段，會從 ${continueSuggestion.fromName} ${continueSuggestion.fromCode} 再出發，飛往 ${continueSuggestion.toName} ${continueSuggestion.toCode}。`
    : `預設從最近可續飛的機場 ${airportLabel} 出發，下一段會飛往 ${continueSuggestion.toName} ${continueSuggestion.toCode}。`;
  continueFlightButton.textContent = `繼續飛行：${continueSuggestion.fromCode} -> ${continueSuggestion.toCode}`;
  continueFlightButton.disabled = false;
}

function selectRoute(index) {
  state.selectedRoute = clamp(index, 0, ROUTES.length - 1);
  renderRoutePills();
  updateRouteInfo();
  updateGhostToggleLabel();
  playSfx("tap");
}

function renderRoutePills() {
  routePills.innerHTML = "";
  const transitionLock = state.mapTransition !== null;
  ROUTES.forEach((route, index) => {
    const from = AIRPORTS[route.from];
    const to = AIRPORTS[route.to];
    const pill = document.createElement("button");
    const locked = index > state.unlockedRoute || transitionLock;
    pill.className = "route-pill";
    if (index === state.selectedRoute) {
      pill.classList.add("active");
    }
    pill.disabled = locked;
    pill.textContent = locked ? `${from.code} -> ${to.code} (鎖定)` : `${from.code} -> ${to.code}`;
    pill.addEventListener("click", () => selectRoute(index));
    routePills.appendChild(pill);
  });
}

function updateGhostControls() {
  const route = getRoute(state.selectedRoute);
  const record = route ? getGhostRecord(route.id) : null;
  const activeSlot = route ? getGhostSlot(route.id) : "best";
  const best = record?.best || null;
  const last = record?.last || null;
  if (ghostSlotMeta) {
    ghostSlotMeta.textContent = [
      best ? `最佳鬼影 ${best.time.toFixed(1)} 秒` : "最佳鬼影 --",
      last ? `最近回放 ${last.time.toFixed(1)} 秒` : "最近回放 --",
      record ? `使用中 ${ghostSlotLabel(activeSlot)}` : "",
    ].filter(Boolean).join(" · ");
  }
  [
    [ghostSlotBestButton, "best", best],
    [ghostSlotLastButton, "last", last],
    [resultGhostBestButton, "best", best],
    [resultGhostLastButton, "last", last],
  ].forEach(([button, slot, run]) => {
    if (!button) {
      return;
    }
    button.disabled = !run;
    button.classList.toggle("active", Boolean(run) && activeSlot === slot);
  });
  if (resultGhostPanel) {
    const visible = Boolean(record);
    resultGhostPanel.classList.toggle("hidden", !visible);
    if (visible && resultGhostSummary) {
      resultGhostSummary.textContent = [
        best ? `最佳鬼影 ${best.time.toFixed(1)} 秒` : "",
        last ? `最近回放 ${last.time.toFixed(1)} 秒` : "",
        `目前鬼影設定：${ghostSlotLabel(activeSlot)}`,
      ].filter(Boolean).join(" · ");
    }
  }
}

function updateRouteInfo() {
  const route = getRoute(state.selectedRoute);
  const from = AIRPORTS[route.from];
  const to = AIRPORTS[route.to];
  const locked = state.selectedRoute > state.unlockedRoute;
  const transitioning = state.mapTransition !== null;
  const stars = "★".repeat(route.difficulty) + "☆".repeat(5 - route.difficulty);
  const best = state.bestRuns[route.id];
  const ghost = getGhostRun(route.id);
  const ghostRecord = getGhostRecord(route.id);
  const ghostLabel = ghost
    ? `${state.ghostEnabled ? ghostSlotLabel(getGhostSlot(route.id)) : "鬼影已隱藏"}`
    : "尚未建立";
  const ghostMeta = ghost
    ? `${ghost.time.toFixed(1)} 秒`
    : "完成一次成功降落";
  const bestLabel = best
    ? `${best.time.toFixed(1)} 秒`
    : "尚無紀錄";
  const bestMeta = best
    ? `${best.stars} 星`
    : "等你刷新";
  const cruiseNote = route.difficulty >= 4
    ? "低空撿星、中空吃風流、高空追噴流；三條高度帶都會刷出燃油補給，長航段要提早選線。"
    : route.difficulty >= 3
      ? "中段開始主動換線：低空賺星，中空穩定，高空衝速度，油量偏低時先往補給靠。"
      : "先練習三條高度帶：低空有星線，中空最穩，高空最刺激，也都可能刷出燃油補給。";
  routeTitle.textContent = `${from.name} -> ${to.name}`;
  if (routeFromCode) {
    routeFromCode.textContent = from.code;
  }
  if (routeFromName) {
    routeFromName.textContent = from.name;
  }
  if (routeToCode) {
    routeToCode.textContent = to.code;
  }
  if (routeToName) {
    routeToName.textContent = to.name;
  }
  routeMeta.innerHTML = [
    {
      label: "航程",
      value: `${route.realDistanceKm || route.distance} km`,
      meta: `真實世界航距`,
    },
    {
      label: "難度",
      value: stars,
      meta: `第 ${route.difficulty} 級航班`,
    },
    {
      label: "最佳",
      value: bestLabel,
      meta: bestMeta,
    },
    {
      label: "鬼影",
      value: ghostLabel,
      meta: ghostRecord?.last ? `最近 ${ghostRecord.last.time.toFixed(1)} 秒` : ghostMeta,
    },
  ].map((item) => `
    <article class="briefing-stat">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
      <small>${item.meta}</small>
    </article>
  `).join("");
  routeDesc.textContent = route.desc;
  if (routeBriefing) {
    routeBriefing.innerHTML = [
      {
        label: "起飛",
        text: `先沿 ${from.code} 跑道加速，速度足夠再抬頭離地。`,
      },
      {
        label: "巡航",
        text: cruiseNote,
      },
      {
        label: "進場",
        text: `提早對正 ${to.code} 跑道，flare 後接地並滑停。`,
      },
    ].map((item) => `
      <div class="briefing-step">
        <span class="briefing-step-label">${item.label}</span>
        <span class="briefing-step-text">${item.text}</span>
      </div>
    `).join("");
  }
  routeMission.innerHTML = "";
  missionItems(route).forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    routeMission.appendChild(li);
  });
  startFlightButton.disabled = locked || transitioning;
  startFlightButton.textContent = locked ? "尚未解鎖" : transitioning ? "過場飛行中..." : "從 A 機場起飛";
  updateGhostToggleLabel();
  updateGhostControls();
}

function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function airportPixel(id) {
  const airport = AIRPORTS[id];
  return {
    x: airport.x * mapCanvas.width,
    y: airport.y * mapCanvas.height,
  };
}

function regionStickerLayout(sticker, width, height) {
  return {
    x: sticker.x * width,
    y: sticker.y * height,
    cardWidth: Math.max(104, width * 0.115),
    cardHeight: Math.max(44, height * 0.1),
    angle: (hash1(sticker.x * 10 + sticker.y * 10) - 0.5) * 0.18,
  };
}

function regionStickerHitTest(point) {
  const width = mapCanvas.width;
  const height = mapCanvas.height;
  for (const sticker of MAP_REGION_STICKERS) {
    const layout = regionStickerLayout(sticker, width, height);
    const dx = Math.abs(point.x - layout.x);
    const dy = Math.abs(point.y - layout.y);
    if (dx <= layout.cardWidth * 0.55 && dy <= layout.cardHeight * 0.62) {
      return sticker.id;
    }
  }
  return "";
}

function triggerRegionStickerBurst(regionId) {
  if (!regionId) {
    return;
  }
  const sticker = MAP_REGION_STICKERS.find((entry) => entry.id === regionId);
  if (!sticker) {
    return;
  }
  const { x, y, cardWidth, cardHeight } = regionStickerLayout(sticker, mapCanvas.width, mapCanvas.height);
  state.mapRegionPop[regionId] = 1;
  for (let i = 0; i < 10; i += 1) {
    const angle = (-Math.PI * 0.9) + (i / 9) * Math.PI * 1.1 + (hash1(i + x * 0.001) - 0.5) * 0.28;
    const speed = 24 + hash1(y * 0.01 + i * 0.4) * 36;
    state.mapRegionStars.push({
      x: x + (hash1(i * 0.71 + x) - 0.5) * cardWidth * 0.34,
      y: y - cardHeight * 0.14 + (hash1(i * 0.31 + y) - 0.5) * 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 22,
      life: 0.95 + hash1(i * 0.53 + 2.1) * 0.35,
      maxLife: 0.95 + hash1(i * 0.53 + 2.1) * 0.35,
      size: 3 + hash1(i * 0.22 + 9.4) * 4,
      color: i % 2 === 0 ? sticker.accent : blendHex(sticker.accent, "#fff7d8", 0.45),
      twinkle: hash1(i * 0.91 + 7.2) * Math.PI * 2,
    });
  }
}

function updateMapEffects(dt) {
  Object.keys(state.mapRegionPop).forEach((regionId) => {
    const next = Math.max(0, state.mapRegionPop[regionId] - dt * 2.2);
    if (next <= 0) {
      delete state.mapRegionPop[regionId];
      return;
    }
    state.mapRegionPop[regionId] = next;
  });
  state.mapRegionStars = state.mapRegionStars.filter((star) => {
    star.life -= dt;
    if (star.life <= 0) {
      return false;
    }
    star.x += star.vx * dt;
    star.y += star.vy * dt;
    star.vx *= 0.985;
    star.vy += 18 * dt;
    star.vy *= 0.986;
    return true;
  });
}

function routeCurve(route) {
  const a = airportPixel(route.from);
  const b = airportPixel(route.to);
  const mx = (a.x + b.x) * 0.5;
  const my = (a.y + b.y) * 0.5;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const arc = Math.min(mapCanvas.height * 0.16, len * 0.24);
  return { a, b, c: { x: mx + nx * arc, y: my + ny * arc } };
}

function quadraticPoint(curve, t) {
  return {
    x: (1 - t) * (1 - t) * curve.a.x + 2 * (1 - t) * t * curve.c.x + t * t * curve.b.x,
    y: (1 - t) * (1 - t) * curve.a.y + 2 * (1 - t) * t * curve.c.y + t * t * curve.b.y,
  };
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
  const cx = start.x + t * dx;
  const cy = start.y + t * dy;
  return Math.hypot(point.x - cx, point.y - cy);
}

function routeHitTest(point) {
  let hit = -1;
  let bestDistance = Infinity;
  ROUTES.forEach((route, index) => {
    if (index > state.unlockedRoute) {
      return;
    }
    const curve = routeCurve(route);
    let prev = curve.a;
    for (let i = 1; i <= 28; i += 1) {
      const next = quadraticPoint(curve, i / 28);
      const distance = distanceToSegment(point, prev, next);
      if (distance < bestDistance) {
        bestDistance = distance;
        hit = index;
      }
      prev = next;
    }
  });
  return bestDistance <= 18 ? hit : -1;
}

function getCanvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function drawRoundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawBlob(ctx, points, fillStyle, strokeStyle) {
  if (points.length < 3) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function sketchPoint(point, seed, jitter = 6) {
  const angle = hash1(seed) * Math.PI * 2;
  const radius = (hash1(seed + 0.37) - 0.5) * jitter;
  return {
    x: point[0] + Math.cos(angle) * radius,
    y: point[1] + Math.sin(angle) * radius,
  };
}

function traceSketchLoop(ctx, points, seed, jitter = 6) {
  if (points.length < 2) {
    return;
  }
  const sketched = points.map((point, index) => sketchPoint(point, seed + index * 0.91, jitter));
  ctx.beginPath();
  ctx.moveTo((sketched[0].x + sketched[1].x) * 0.5, (sketched[0].y + sketched[1].y) * 0.5);
  for (let i = 1; i < sketched.length; i += 1) {
    const current = sketched[i];
    const next = sketched[(i + 1) % sketched.length];
    const midX = (current.x + next.x) * 0.5;
    const midY = (current.y + next.y) * 0.5;
    ctx.quadraticCurveTo(current.x, current.y, midX, midY);
  }
  ctx.closePath();
}

function drawSketchLandmass(ctx, points, options) {
  const {
    fill,
    shadow,
    stroke,
    scribble,
    seed,
  } = options;
  const shadowPoints = points.map(([x, y]) => [x + 5, y + 7]);
  traceSketchLoop(ctx, shadowPoints, seed + 12.4, 4);
  ctx.fillStyle = shadow;
  ctx.fill();

  traceSketchLoop(ctx, points, seed, 5);
  ctx.fillStyle = fill;
  ctx.fill();

  if (scribble) {
    ctx.save();
    traceSketchLoop(ctx, points, seed, 5);
    ctx.clip();
    ctx.strokeStyle = scribble;
    ctx.lineWidth = 2;
    for (let i = -1; i < 7; i += 1) {
      const y = points[0][1] - 20 + i * 26;
      ctx.beginPath();
      ctx.moveTo(-40, y);
      ctx.bezierCurveTo(120, y + 8, 260, y - 10, 420, y + 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  traceSketchLoop(ctx, points, seed + 1.7, 4);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.stroke();
}

function drawMapCloud(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.beginPath();
  ctx.arc(-18, 0, 16, 0, Math.PI * 2);
  ctx.arc(0, -8, 20, 0, Math.PI * 2);
  ctx.arc(22, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(99, 132, 155, 0.32)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-8, 1, 1.8, 0, Math.PI * 2);
  ctx.arc(8, 1, 1.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 9, 8, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawMapWave(ctx, x, y, width, color, lift = 0) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - width * 0.5, y);
  ctx.bezierCurveTo(
    x - width * 0.22,
    y - 6 - lift,
    x - width * 0.08,
    y - 6 - lift,
    x + width * 0.1,
    y,
  );
  ctx.bezierCurveTo(
    x + width * 0.28,
    y + 6 + lift,
    x + width * 0.4,
    y + 6 + lift,
    x + width * 0.5,
    y,
  );
  ctx.stroke();
  ctx.restore();
}

function drawMapDoodleIcon(ctx, kind, x, y, size, fill = "#fffdf3", stroke = "#35506b") {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.lineWidth = Math.max(1.6, size * 0.12);

  switch (kind) {
    case "pine":
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.9);
      ctx.lineTo(size * 0.55, -size * 0.16);
      ctx.lineTo(size * 0.24, -size * 0.16);
      ctx.lineTo(size * 0.7, size * 0.32);
      ctx.lineTo(size * 0.28, size * 0.32);
      ctx.lineTo(size * 0.46, size * 0.78);
      ctx.lineTo(-size * 0.46, size * 0.78);
      ctx.lineTo(-size * 0.28, size * 0.32);
      ctx.lineTo(-size * 0.7, size * 0.32);
      ctx.lineTo(-size * 0.24, -size * 0.16);
      ctx.lineTo(-size * 0.55, -size * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case "palm":
      ctx.beginPath();
      ctx.moveTo(-size * 0.08, size * 0.82);
      ctx.quadraticCurveTo(-size * 0.18, size * 0.18, size * 0.08, -size * 0.28);
      ctx.stroke();
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(size * 0.05, -size * 0.22);
        ctx.quadraticCurveTo(size * 0.38 * i, -size * (0.76 + Math.abs(i) * 0.08), size * 0.68 * i, -size * 0.3);
        ctx.stroke();
      }
      break;
    case "sun":
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI * 2 * i) / 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * size * 0.78, Math.sin(angle) * size * 0.78);
        ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case "leaf":
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.9);
      ctx.bezierCurveTo(size * 0.72, -size * 0.56, size * 0.7, size * 0.34, 0, size * 0.9);
      ctx.bezierCurveTo(-size * 0.7, size * 0.34, -size * 0.72, -size * 0.56, 0, -size * 0.9);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.72);
      ctx.lineTo(0, size * 0.64);
      ctx.stroke();
      break;
    case "heart":
      ctx.beginPath();
      ctx.moveTo(0, size * 0.88);
      ctx.bezierCurveTo(size * 0.92, size * 0.28, size * 0.92, -size * 0.5, 0, -size * 0.12);
      ctx.bezierCurveTo(-size * 0.92, -size * 0.5, -size * 0.92, size * 0.28, 0, size * 0.88);
      ctx.fill();
      ctx.stroke();
      break;
    case "shell":
      ctx.beginPath();
      ctx.moveTo(-size * 0.88, size * 0.66);
      ctx.quadraticCurveTo(0, -size * 0.92, size * 0.88, size * 0.66);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.52);
        ctx.lineTo(i * size * 0.22, size * 0.56);
        ctx.stroke();
      }
      break;
    case "crown":
      ctx.beginPath();
      ctx.moveTo(-size * 0.82, size * 0.68);
      ctx.lineTo(-size * 0.6, -size * 0.24);
      ctx.lineTo(-size * 0.12, size * 0.1);
      ctx.lineTo(0, -size * 0.56);
      ctx.lineTo(size * 0.12, size * 0.1);
      ctx.lineTo(size * 0.6, -size * 0.24);
      ctx.lineTo(size * 0.82, size * 0.68);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case "star": {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const angle = -Math.PI / 2 + (Math.PI * i) / 5;
        const radius = i % 2 === 0 ? size : size * 0.44;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "tulip":
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.74);
      ctx.lineTo(size * 0.24, -size * 0.1);
      ctx.lineTo(size * 0.56, -size * 0.44);
      ctx.lineTo(size * 0.6, size * 0.18);
      ctx.quadraticCurveTo(0, size * 0.92, -size * 0.6, size * 0.18);
      ctx.lineTo(-size * 0.56, -size * 0.44);
      ctx.lineTo(-size * 0.24, -size * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, size * 0.22);
      ctx.lineTo(0, size * 0.96);
      ctx.stroke();
      break;
    case "pyramid":
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.88);
      ctx.lineTo(size * 0.88, size * 0.76);
      ctx.lineTo(-size * 0.88, size * 0.76);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, size * 0.16);
      ctx.lineTo(size * 0.4, size * 0.16);
      ctx.moveTo(-size * 0.56, size * 0.44);
      ctx.lineTo(size * 0.56, size * 0.44);
      ctx.stroke();
      break;
    case "camel":
      ctx.beginPath();
      ctx.moveTo(-size * 0.88, size * 0.48);
      ctx.lineTo(-size * 0.58, size * 0.48);
      ctx.quadraticCurveTo(-size * 0.44, -size * 0.2, -size * 0.16, size * 0.16);
      ctx.quadraticCurveTo(0, -size * 0.5, size * 0.22, size * 0.1);
      ctx.lineTo(size * 0.62, size * 0.12);
      ctx.lineTo(size * 0.86, -size * 0.1);
      ctx.lineTo(size * 0.82, size * 0.2);
      ctx.lineTo(size * 0.62, size * 0.42);
      ctx.lineTo(size * 0.38, size * 0.42);
      ctx.lineTo(size * 0.26, size * 0.88);
      ctx.moveTo(-size * 0.2, size * 0.42);
      ctx.lineTo(-size * 0.32, size * 0.88);
      ctx.moveTo(-size * 0.62, size * 0.42);
      ctx.lineTo(-size * 0.74, size * 0.88);
      ctx.stroke();
      break;
    case "lotus":
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(0, size * 0.72);
        ctx.quadraticCurveTo(size * 0.28 * i, -size * 0.7, size * 0.5 * i, size * 0.22);
        ctx.quadraticCurveTo(size * 0.18 * i, size * 0.5, 0, size * 0.72);
        ctx.fill();
        ctx.stroke();
      }
      break;
    case "wave":
      ctx.beginPath();
      ctx.moveTo(-size, -size * 0.12);
      ctx.bezierCurveTo(-size * 0.52, -size * 0.7, -size * 0.14, -size * 0.7, size * 0.18, -size * 0.08);
      ctx.bezierCurveTo(size * 0.48, size * 0.44, size * 0.76, size * 0.44, size, -size * 0.04);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.82, size * 0.34);
      ctx.bezierCurveTo(-size * 0.4, -size * 0.16, -size * 0.02, -size * 0.16, size * 0.26, size * 0.34);
      ctx.bezierCurveTo(size * 0.46, size * 0.72, size * 0.7, size * 0.72, size * 0.9, size * 0.3);
      ctx.stroke();
      break;
    case "flower":
    case "blossom":
      for (let i = 0; i < 5; i += 1) {
        const angle = (-Math.PI / 2) + (Math.PI * 2 * i) / 5;
        ctx.beginPath();
        ctx.ellipse(Math.cos(angle) * size * 0.42, Math.sin(angle) * size * 0.42, size * 0.26, size * 0.38, angle, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = stroke;
      ctx.fill();
      break;
    case "ribbon":
      ctx.beginPath();
      ctx.moveTo(-size * 0.88, -size * 0.22);
      ctx.quadraticCurveTo(-size * 0.26, -size * 0.88, 0, 0);
      ctx.quadraticCurveTo(size * 0.26, -size * 0.88, size * 0.88, -size * 0.22);
      ctx.quadraticCurveTo(size * 0.3, size * 0.1, 0, 0);
      ctx.quadraticCurveTo(-size * 0.3, size * 0.1, -size * 0.88, -size * 0.22);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.16, 0);
      ctx.lineTo(-size * 0.42, size * 0.92);
      ctx.lineTo(-size * 0.04, size * 0.54);
      ctx.moveTo(size * 0.16, 0);
      ctx.lineTo(size * 0.42, size * 0.92);
      ctx.lineTo(size * 0.04, size * 0.54);
      ctx.stroke();
      break;
    case "tower":
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.88);
      ctx.lineTo(size * 0.18, -size * 0.52);
      ctx.lineTo(size * 0.46, -size * 0.52);
      ctx.lineTo(size * 0.28, -size * 0.2);
      ctx.lineTo(size * 0.58, -size * 0.2);
      ctx.lineTo(size * 0.34, size * 0.1);
      ctx.lineTo(size * 0.22, size * 0.86);
      ctx.lineTo(-size * 0.22, size * 0.86);
      ctx.lineTo(-size * 0.34, size * 0.1);
      ctx.lineTo(-size * 0.58, -size * 0.2);
      ctx.lineTo(-size * 0.28, -size * 0.2);
      ctx.lineTo(-size * 0.46, -size * 0.52);
      ctx.lineTo(-size * 0.18, -size * 0.52);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case "sail":
      ctx.beginPath();
      ctx.moveTo(-size * 0.78, size * 0.62);
      ctx.quadraticCurveTo(0, size * 0.9, size * 0.78, size * 0.62);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.88);
      ctx.lineTo(0, size * 0.64);
      ctx.moveTo(0, -size * 0.78);
      ctx.lineTo(size * 0.6, size * 0.08);
      ctx.lineTo(0, size * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case "fern":
      ctx.beginPath();
      ctx.moveTo(-size * 0.08, size * 0.86);
      ctx.lineTo(size * 0.12, -size * 0.84);
      ctx.stroke();
      for (let i = -3; i <= 3; i += 1) {
        const stemY = i * size * 0.22;
        ctx.beginPath();
        ctx.moveTo(0, stemY);
        ctx.lineTo((i % 2 === 0 ? 1 : -1) * size * 0.42, stemY - size * 0.18);
        ctx.stroke();
      }
      break;
    default:
      drawMapDoodleIcon(ctx, "star", 0, 0, size, fill, stroke);
      break;
  }

  ctx.restore();
}

function drawMapSticker(ctx, x, y, radius, fill, stroke, accent) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.08);
  ctx.fillStyle = "rgba(74, 88, 115, 0.16)";
  ctx.beginPath();
  ctx.ellipse(4, 10, radius * 0.88, radius * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < 16; i += 1) {
    const angle = (-Math.PI / 2) + (i / 16) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : radius * 0.8;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.44, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMapSparkle(ctx, x, y, size, color, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(1.2, size * 0.18);
  for (let i = 0; i < 4; i += 1) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(0, size);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMapRegionStarTrail(ctx) {
  state.mapRegionStars.forEach((star) => {
    const alpha = clamp(star.life / Math.max(0.001, star.maxLife), 0, 1);
    ctx.save();
    ctx.strokeStyle = star.color;
    ctx.globalAlpha = alpha * 0.26;
    ctx.lineWidth = Math.max(1, star.size * 0.18);
    ctx.beginPath();
    ctx.moveTo(star.x - star.vx * 0.02, star.y - star.vy * 0.02);
    ctx.lineTo(star.x + star.vx * 0.04, star.y + star.vy * 0.04);
    ctx.stroke();
    ctx.restore();
    drawMapSparkle(
      ctx,
      star.x,
      star.y,
      star.size * (0.45 + alpha * 0.55),
      star.color,
      alpha * (0.42 + 0.28 * Math.sin(state.mapPulse * 8 + star.twinkle)),
    );
  });
}

function drawMapRegionSticker(ctx, sticker, width, height, options = {}) {
  const { hovered = false, related = false, pop = 0 } = options;
  const { x, y, cardWidth, cardHeight, angle } = regionStickerLayout(sticker, width, height);
  const popWave = pop > 0 ? Math.sin((1 - pop) * Math.PI * 1.1) * pop : 0;
  const lift = (hovered ? -8 - Math.sin(state.mapPulse * 6 + x * 0.01) * 2.4 : related ? -3.5 : 0) - popWave * 10;
  const scale = (hovered ? 1.06 : related ? 1.03 : 1) + popWave * 0.08;
  const shimmer = Math.max(hovered ? 0.92 : related ? 0.52 : 0, popWave * 1.1);

  ctx.save();
  ctx.translate(x, y + lift);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(97, 111, 132, 0.14)";
  ctx.beginPath();
  ctx.ellipse(6, cardHeight * 0.62, cardWidth * 0.46, cardHeight * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  drawRoundRectPath(ctx, -cardWidth * 0.5, -cardHeight * 0.5, cardWidth, cardHeight, 18);
  ctx.fillStyle = sticker.paper;
  ctx.fill();
  ctx.strokeStyle = hovered ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.92)";
  ctx.lineWidth = hovered ? 3.5 : 3;
  ctx.stroke();

  drawRoundRectPath(ctx, -cardWidth * 0.5, -cardHeight * 0.5, cardWidth, cardHeight, 18);
  ctx.strokeStyle = hovered ? `${sticker.accent}cc` : related ? `${sticker.accent}aa` : `${sticker.accent}88`;
  ctx.lineWidth = hovered ? 2.2 : 1.5;
  ctx.stroke();

  if (shimmer > 0) {
    const wash = ctx.createLinearGradient(-cardWidth * 0.5, -cardHeight * 0.5, cardWidth * 0.5, cardHeight * 0.5);
    wash.addColorStop(0, "rgba(255,255,255,0)");
    wash.addColorStop(0.5, `rgba(255,255,255,${0.2 + shimmer * 0.18})`);
    wash.addColorStop(1, "rgba(255,255,255,0)");
    drawRoundRectPath(ctx, -cardWidth * 0.5, -cardHeight * 0.5, cardWidth, cardHeight, 18);
    ctx.fillStyle = wash;
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255, 245, 227, 0.92)";
  drawRoundRectPath(ctx, -cardWidth * 0.5 + 12, -cardHeight * 0.5 - 10, cardWidth * 0.28, 16, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(226, 198, 157, 0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = sticker.accent;
  ctx.beginPath();
  ctx.arc(-cardWidth * 0.28, 0, cardHeight * 0.32, 0, Math.PI * 2);
  ctx.fill();
  drawMapDoodleIcon(ctx, sticker.doodle, -cardWidth * 0.28, 0, cardHeight * 0.22, "#fffdf4", "#405668");

  ctx.fillStyle = "#34506a";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(cardHeight * 0.28)}px "Baloo 2", sans-serif`;
  ctx.fillText(sticker.label, -cardWidth * 0.03, -cardHeight * 0.08);
  ctx.font = `${Math.round(cardHeight * 0.18)}px "M PLUS Rounded 1c", sans-serif`;
  ctx.fillStyle = "rgba(67, 94, 118, 0.8)";
  ctx.fillText(sticker.note, -cardWidth * 0.03, cardHeight * 0.2);
  ctx.restore();

  if (shimmer > 0) {
    const sparkleColor = hovered ? sticker.accent : blendHex(sticker.accent, "#fff7d8", 0.45);
    drawMapSparkle(ctx, x - cardWidth * 0.42, y - cardHeight * 0.5 + lift, 5 + shimmer * 3, sparkleColor, 0.46 + shimmer * 0.34);
    drawMapSparkle(ctx, x + cardWidth * 0.38, y - cardHeight * 0.44 + lift, 4 + shimmer * 2.5, "#fff8de", 0.4 + shimmer * 0.32);
    drawMapSparkle(ctx, x + cardWidth * 0.46, y + cardHeight * 0.16 + lift, 3 + shimmer * 1.8, sticker.accent, 0.28 + shimmer * 0.24);
  }
}

function drawMapCityBackdrop(ctx, airport, x, y, size, emphasis = 0) {
  const nightStrength = clamp((emphasis - 0.46) / 0.54, 0, 1);
  const stroke = blendHex(blendHex(airport.color, "#ffffff", 0.55), "#233247", nightStrength * 0.42);
  const fill = blendHex(blendHex(airport.color, "#fffaf1", 0.72), "#24374d", nightStrength * 0.52);
  ctx.save();
  ctx.translate(x, y + size * 0.2);
  ctx.globalAlpha = 0.22 + emphasis * 0.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.lineWidth = Math.max(1.1, size * 0.11);

  if (nightStrength > 0.02) {
    const glow = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, size * 1.7);
    glow.addColorStop(0, `rgba(31, 48, 76, ${0.18 + nightStrength * 0.18})`);
    glow.addColorStop(1, "rgba(31, 48, 76, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.2, size * 1.7, size * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fill;
  }

  switch (airport.backdrop) {
    case "mountains":
    case "cloud-peaks":
      ctx.beginPath();
      ctx.moveTo(-size * 1.5, size * 0.8);
      ctx.lineTo(-size * 0.82, -size * 0.08);
      ctx.lineTo(-size * 0.24, size * 0.52);
      ctx.lineTo(size * 0.28, -size * 0.34);
      ctx.lineTo(size * 0.92, size * 0.38);
      ctx.lineTo(size * 1.5, size * 0.8);
      ctx.stroke();
      if (airport.backdrop === "cloud-peaks") {
        drawMapCloud(ctx, 0, -size * 0.58, 0.26);
      }
      break;
    case "coast":
    case "harbor":
      drawMapWave(ctx, 0, size * 0.72, size * 2.6, stroke, 0.5);
      drawMapWave(ctx, -size * 0.24, size * 0.96, size * 2, fill, 0.2);
      if (airport.backdrop === "harbor") {
        ctx.beginPath();
        ctx.moveTo(-size * 0.9, size * 0.62);
        ctx.lineTo(-size * 0.6, size * 0.1);
        ctx.lineTo(-size * 0.34, size * 0.62);
        ctx.moveTo(size * 0.16, size * 0.62);
        ctx.lineTo(size * 0.16, -size * 0.2);
        ctx.lineTo(size * 0.48, size * 0.18);
        ctx.lineTo(size * 0.16, size * 0.18);
        ctx.stroke();
      }
      break;
    case "aztec":
      ctx.beginPath();
      ctx.moveTo(-size * 1.04, size * 0.8);
      ctx.lineTo(-size * 0.72, size * 0.42);
      ctx.lineTo(-size * 0.42, size * 0.42);
      ctx.lineTo(-size * 0.42, size * 0.08);
      ctx.lineTo(-size * 0.12, size * 0.08);
      ctx.lineTo(-size * 0.12, -size * 0.22);
      ctx.lineTo(size * 0.12, -size * 0.22);
      ctx.lineTo(size * 0.12, size * 0.08);
      ctx.lineTo(size * 0.42, size * 0.08);
      ctx.lineTo(size * 0.42, size * 0.42);
      ctx.lineTo(size * 0.72, size * 0.42);
      ctx.lineTo(size * 1.04, size * 0.8);
      ctx.stroke();
      break;
    case "skyline":
    case "bund":
    case "spires":
      ctx.beginPath();
      ctx.moveTo(-size * 1.42, size * 0.8);
      ctx.lineTo(-size * 1.42, size * 0.12);
      ctx.lineTo(-size * 1.04, size * 0.12);
      ctx.lineTo(-size * 1.04, -size * 0.2);
      ctx.lineTo(-size * 0.62, -size * 0.2);
      ctx.lineTo(-size * 0.62, size * 0.24);
      ctx.lineTo(-size * 0.22, size * 0.24);
      ctx.lineTo(-size * 0.22, -size * 0.46);
      ctx.lineTo(size * 0.1, -size * 0.46);
      ctx.lineTo(size * 0.1, size * 0.04);
      ctx.lineTo(size * 0.48, size * 0.04);
      ctx.lineTo(size * 0.48, -size * 0.32);
      ctx.lineTo(size * 0.82, -size * 0.32);
      ctx.lineTo(size * 0.82, size * 0.18);
      ctx.lineTo(size * 1.24, size * 0.18);
      ctx.lineTo(size * 1.24, size * 0.8);
      ctx.stroke();
      if (airport.backdrop === "bund") {
        ctx.beginPath();
        ctx.arc(size * 0.18, -size * 0.68, size * 0.14, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case "tram-hill":
      ctx.beginPath();
      ctx.arc(0, size * 1.2, size * 1.55, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.86, size * 0.4);
      ctx.lineTo(-size * 0.22, 0);
      ctx.lineTo(size * 0.62, 0.34);
      ctx.lineTo(size * 0.62, size * 0.8);
      ctx.lineTo(-size * 0.22, size * 0.8);
      ctx.closePath();
      ctx.stroke();
      break;
    case "clock":
      ctx.beginPath();
      ctx.moveTo(-size * 0.22, size * 0.82);
      ctx.lineTo(-size * 0.22, -size * 0.64);
      ctx.lineTo(size * 0.22, -size * 0.64);
      ctx.lineTo(size * 0.22, size * 0.82);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -size * 0.22, size * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "bridge":
      ctx.beginPath();
      ctx.moveTo(-size * 1.18, size * 0.74);
      ctx.lineTo(size * 1.18, size * 0.74);
      ctx.moveTo(-size * 0.9, size * 0.74);
      ctx.lineTo(-size * 0.9, -size * 0.12);
      ctx.moveTo(size * 0.9, size * 0.74);
      ctx.lineTo(size * 0.9, -size * 0.12);
      ctx.moveTo(-size * 0.9, -size * 0.12);
      ctx.quadraticCurveTo(0, -size * 0.94, size * 0.9, -size * 0.12);
      ctx.stroke();
      break;
    case "dunes":
      drawMapWave(ctx, -size * 0.08, size * 0.56, size * 2.6, stroke, 0.8);
      drawMapWave(ctx, size * 0.3, size * 0.88, size * 2.2, fill, 0.4);
      break;
    case "savanna":
      ctx.beginPath();
      ctx.moveTo(0, size * 0.88);
      ctx.lineTo(0, -size * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.86, size * 0.12);
      ctx.quadraticCurveTo(-size * 0.32, -size * 0.74, 0, -size * 0.28);
      ctx.quadraticCurveTo(size * 0.32, -size * 0.74, size * 0.86, size * 0.12);
      ctx.stroke();
      break;
    case "arch":
      ctx.beginPath();
      ctx.moveTo(-size * 0.92, size * 0.82);
      ctx.lineTo(-size * 0.92, -size * 0.08);
      ctx.lineTo(-size * 0.34, -size * 0.08);
      ctx.quadraticCurveTo(0, -size * 0.8, size * 0.34, -size * 0.08);
      ctx.lineTo(size * 0.92, -size * 0.08);
      ctx.lineTo(size * 0.92, size * 0.82);
      ctx.stroke();
      break;
    case "gardens":
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.arc(i * size * 0.52, size * 0.22, size * 0.42, Math.PI, 0);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-size * 1.12, size * 0.82);
      ctx.lineTo(size * 1.12, size * 0.82);
      ctx.stroke();
      break;
    case "taipei-tower":
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.92);
      ctx.lineTo(size * 0.12, -size * 0.6);
      ctx.lineTo(size * 0.28, -size * 0.6);
      ctx.lineTo(size * 0.18, -size * 0.28);
      ctx.lineTo(size * 0.4, -size * 0.28);
      ctx.lineTo(size * 0.22, size * 0.08);
      ctx.lineTo(size * 0.5, size * 0.08);
      ctx.lineTo(size * 0.28, size * 0.44);
      ctx.lineTo(size * 0.14, size * 0.88);
      ctx.lineTo(-size * 0.14, size * 0.88);
      ctx.lineTo(-size * 0.28, size * 0.44);
      ctx.lineTo(-size * 0.5, size * 0.08);
      ctx.lineTo(-size * 0.22, size * 0.08);
      ctx.lineTo(-size * 0.4, -size * 0.28);
      ctx.lineTo(-size * 0.18, -size * 0.28);
      ctx.lineTo(-size * 0.28, -size * 0.6);
      ctx.lineTo(-size * 0.12, -size * 0.6);
      ctx.closePath();
      ctx.stroke();
      break;
    case "gate":
      ctx.beginPath();
      ctx.moveTo(-size * 1.02, size * 0.82);
      ctx.lineTo(-size * 1.02, -size * 0.12);
      ctx.lineTo(-size * 0.52, -size * 0.12);
      ctx.lineTo(-size * 0.4, -size * 0.52);
      ctx.lineTo(size * 0.4, -size * 0.52);
      ctx.lineTo(size * 0.52, -size * 0.12);
      ctx.lineTo(size * 1.02, -size * 0.12);
      ctx.lineTo(size * 1.02, size * 0.82);
      ctx.stroke();
      break;
    case "torii":
      ctx.beginPath();
      ctx.moveTo(-size * 0.92, -size * 0.32);
      ctx.lineTo(size * 0.92, -size * 0.32);
      ctx.moveTo(-size * 0.72, -size * 0.12);
      ctx.lineTo(size * 0.72, -size * 0.12);
      ctx.moveTo(-size * 0.5, -size * 0.12);
      ctx.lineTo(-size * 0.5, size * 0.82);
      ctx.moveTo(size * 0.5, -size * 0.12);
      ctx.lineTo(size * 0.5, size * 0.82);
      ctx.stroke();
      break;
    case "opera":
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * size * 0.4, size * 0.72);
        ctx.quadraticCurveTo(i * size * 0.64, -size * 0.24, i * size * 0.02, size * 0.02);
        ctx.stroke();
      }
      break;
    case "volcano":
      ctx.beginPath();
      ctx.moveTo(-size * 1.02, size * 0.82);
      ctx.lineTo(-size * 0.28, -size * 0.18);
      ctx.lineTo(size * 0.26, -size * 0.18);
      ctx.lineTo(size * 1.02, size * 0.82);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -size * 0.54, size * 0.2, Math.PI * 0.8, Math.PI * 0.2, true);
      ctx.stroke();
      break;
    default:
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.92, 0, Math.PI * 2);
      ctx.stroke();
      break;
  }

  if (nightStrength > 0.02) {
    const warm = blendHex("#ffd86c", airport.color, 0.18);
    const cool = blendHex("#bfe7ff", airport.color, 0.35);
    const pulse = 0.72 + 0.28 * Math.sin(state.mapPulse * 5.4 + x * 0.03 + y * 0.02);
    const drawLight = (lx, ly, r, color, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha * pulse;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lx, ly, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    const drawWindow = (lx, ly, w, h, color, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha * pulse;
      ctx.fillStyle = color;
      drawRoundRectPath(ctx, lx - w * 0.5, ly - h * 0.5, w, h, Math.min(w, h) * 0.35);
      ctx.fill();
      ctx.restore();
    };
    switch (airport.backdrop) {
      case "skyline":
      case "spires":
      case "bund":
        drawWindow(-size * 0.98, size * 0.26, size * 0.12, size * 0.18, warm, 0.85);
        drawWindow(-size * 0.44, 0, size * 0.11, size * 0.18, cool, 0.76);
        drawWindow(size * 0.18, -size * 0.12, size * 0.12, size * 0.18, warm, 0.88);
        drawWindow(size * 0.76, size * 0.1, size * 0.12, size * 0.18, cool, 0.76);
        break;
      case "harbor":
      case "bridge":
      case "opera":
      case "coast":
        drawLight(-size * 0.84, size * 0.56, size * 0.08, warm, 0.86);
        drawLight(0, size * 0.46, size * 0.08, cool, 0.7);
        drawLight(size * 0.84, size * 0.56, size * 0.08, warm, 0.86);
        if (airport.backdrop === "harbor" || airport.backdrop === "coast") {
          ctx.save();
          ctx.strokeStyle = `${warm}aa`;
          ctx.globalAlpha = 0.28 * pulse;
          ctx.lineWidth = Math.max(1, size * 0.07);
          ctx.beginPath();
          ctx.moveTo(-size * 0.98, size * 0.84);
          ctx.lineTo(-size * 0.84, size * 1.08);
          ctx.moveTo(size * 0.02, size * 0.72);
          ctx.lineTo(size * 0.14, size * 1);
          ctx.moveTo(size * 0.84, size * 0.84);
          ctx.lineTo(size * 0.96, size * 1.04);
          ctx.stroke();
          ctx.restore();
        }
        break;
      case "clock":
      case "torii":
      case "gate":
      case "taipei-tower":
      case "arch":
        drawLight(0, -size * 0.42, size * 0.1, warm, 0.9);
        drawLight(-size * 0.32, size * 0.24, size * 0.07, cool, 0.74);
        drawLight(size * 0.32, size * 0.24, size * 0.07, cool, 0.74);
        break;
      default:
        drawLight(-size * 0.3, size * 0.34, size * 0.07, warm, 0.84);
        drawLight(size * 0.3, size * 0.22, size * 0.07, cool, 0.68);
        break;
    }
  }

  ctx.restore();
}

function drawMapAirportMarker(ctx, airport, x, y, selected, active, focused = false) {
  const radius = selected ? 16 : focused ? 13.5 : 12;
  const fill = active ? blendHex(airport.color, "#fff7f2", 0.26) : "#eef1f4";
  const stroke = selected ? "rgba(232, 168, 94, 0.88)" : "rgba(255,255,255,0.96)";
  const accent = active ? airport.color : "#d7dde5";
  const emphasis = selected ? 1 : focused ? 0.72 : active ? 0.35 : 0.18;
  drawMapCityBackdrop(ctx, airport, x, y, radius * 1.28, emphasis);
  if (selected) {
    ctx.save();
    ctx.fillStyle = "rgba(245, 188, 99, 0.18)";
    ctx.beginPath();
    ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  drawMapSticker(ctx, x, y, radius, fill, stroke, accent);
  drawMapDoodleIcon(
    ctx,
    airport.icon || "star",
    x,
    y,
    radius * 0.52,
    active ? "#fffdf5" : "#f7f8fa",
    active ? "#36516b" : "#97a3b1",
  );
}

function drawMapAirportLabel(ctx, x, y, text, selected) {
  const paddingX = 11;
  const paddingY = 6;
  ctx.save();
  ctx.font = `${Math.round(12 * (mapCanvas.width / 960))}px "M PLUS Rounded 1c", sans-serif`;
  const width = ctx.measureText(text).width + paddingX * 2;
  const height = 24;
  drawRoundRectPath(ctx, x - width * 0.5, y - 16 - height, width, height, 10);
  ctx.fillStyle = selected ? "rgba(255, 249, 221, 0.95)" : "rgba(255, 255, 255, 0.92)";
  ctx.fill();
  ctx.strokeStyle = selected ? "rgba(227, 171, 93, 0.72)" : "rgba(132, 154, 176, 0.46)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#35506b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y - 16 - height * 0.5 + 1);
  ctx.restore();
}

function drawMapCompass(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.18);
  ctx.strokeStyle = "rgba(89, 110, 128, 0.48)";
  ctx.fillStyle = "rgba(255, 251, 239, 0.88)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -size + 4);
  ctx.lineTo(size * 0.22, 0);
  ctx.lineTo(0, size - 4);
  ctx.lineTo(-size * 0.22, 0);
  ctx.closePath();
  ctx.fillStyle = "rgba(240, 153, 117, 0.74)";
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#49647b";
  ctx.font = `700 ${Math.round(size * 0.8)}px "Baloo 2", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", 0, -size - 10);
  ctx.restore();
}

function drawMapWhale(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(0.08);
  ctx.fillStyle = "rgba(103, 164, 198, 0.22)";
  ctx.beginPath();
  ctx.ellipse(6, 10, 32, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7ac4d9";
  ctx.beginPath();
  ctx.moveTo(-34, 4);
  ctx.bezierCurveTo(-20, -10, 14, -12, 38, -2);
  ctx.bezierCurveTo(42, 4, 36, 12, 18, 13);
  ctx.bezierCurveTo(4, 18, -18, 15, -34, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(34, -1);
  ctx.lineTo(48, -11);
  ctx.lineTo(43, 0);
  ctx.lineTo(52, 9);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-10, -2, 2, 0, Math.PI * 2);
  ctx.fillStyle = "#35506b";
  ctx.fill();
  ctx.strokeStyle = "rgba(53, 80, 107, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-14, 6, 10, 0.14 * Math.PI, 0.84 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawMapSun(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 12; i += 1) {
    ctx.rotate(Math.PI / 6);
    ctx.strokeStyle = "rgba(245, 185, 102, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, size + 4);
    ctx.lineTo(0, size + 14);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd978";
  ctx.fill();
  ctx.strokeStyle = "rgba(232, 161, 89, 0.68)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawMapRouteThread(ctx, curve, options) {
  const { selected, hovered, locked, color, pulseColor } = options;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(curve.a.x, curve.a.y);
  ctx.quadraticCurveTo(curve.c.x, curve.c.y, curve.b.x, curve.b.y);
  ctx.lineCap = "round";
  ctx.strokeStyle = locked ? "rgba(153, 166, 176, 0.42)" : "rgba(103, 126, 150, 0.2)";
  ctx.lineWidth = selected ? 8 : hovered ? 6 : 5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(curve.a.x, curve.a.y);
  ctx.quadraticCurveTo(curve.c.x, curve.c.y, curve.b.x, curve.b.y);
  ctx.setLineDash(locked ? [4, 10] : [10, 9]);
  ctx.lineDashOffset = selected ? -state.mapPulse * 12 : 0;
  ctx.strokeStyle = locked ? "rgba(255,255,255,0.55)" : selected ? color : "rgba(255,255,255,0.92)";
  ctx.lineWidth = selected ? 4 : hovered ? 3.4 : 2.7;
  ctx.stroke();
  ctx.setLineDash([]);

  if (!locked) {
    const t = (state.mapPulse * 0.14 + options.index * 0.18) % 1;
    const p = quadraticPoint(curve, t);
    drawMapSticker(ctx, p.x, p.y, selected ? 9 : 7, pulseColor, "rgba(255,255,255,0.96)", "#fff7d4");
  }
  ctx.restore();
}

function drawMap() {
  const w = mapCanvas.width;
  const h = mapCanvas.height;
  mapCtx.clearRect(0, 0, w, h);

  const route = ROUTES[state.selectedRoute];
  const focusRoute = ROUTES[state.mapHoverRoute >= 0 ? state.mapHoverRoute : state.selectedRoute];
  const relatedRegions = new Set([
    AIRPORTS[focusRoute.from]?.region,
    AIRPORTS[focusRoute.to]?.region,
  ].filter(Boolean));
  const focusedAirports = new Set([focusRoute.from, focusRoute.to]);
  const paper = mapCtx.createLinearGradient(0, 0, 0, h);
  paper.addColorStop(0, "#fff7ee");
  paper.addColorStop(0.52, blendHex(route.palette.hillBack || "#fff3e8", "#fffef9", 0.72));
  paper.addColorStop(1, "#ffeedb");
  mapCtx.fillStyle = paper;
  mapCtx.fillRect(0, 0, w, h);

  for (let i = 0; i < 7; i += 1) {
    const stainX = (0.08 + i * 0.13) * w;
    const stainY = (0.12 + (i % 3) * 0.24) * h;
    const stain = mapCtx.createRadialGradient(stainX, stainY, 8, stainX, stainY, 120 + i * 8);
    stain.addColorStop(0, i % 2 === 0 ? "rgba(185, 229, 243, 0.24)" : "rgba(255, 218, 174, 0.18)");
    stain.addColorStop(1, "rgba(255,255,255,0)");
    mapCtx.fillStyle = stain;
    mapCtx.beginPath();
    mapCtx.arc(stainX, stainY, 120 + i * 8, 0, Math.PI * 2);
    mapCtx.fill();
  }

  for (let i = 0; i < 22; i += 1) {
    const y = ((i + 0.5) / 22) * h;
    drawMapWave(
      mapCtx,
      (0.1 + ((i * 37) % 80) / 100) * w,
      y,
      42 + (i % 4) * 10,
      i % 2 === 0 ? "rgba(121, 191, 214, 0.22)" : "rgba(255, 184, 156, 0.14)",
      (i % 3) * 0.9,
    );
  }

  MAP_LANDMASSES.forEach((landmass, index) => {
    const points = landmass.points.map((point) => [point.x * w, point.y * h]);
    const fill = blendHex(
      landmass.fill,
      index % 3 === 0 ? route.palette.hillMid : route.palette.hillBack,
      index % 2 === 0 ? 0.38 : 0.28,
    );
    drawSketchLandmass(mapCtx, points, {
      fill,
      shadow: "rgba(105, 118, 94, 0.12)",
      stroke: "rgba(95, 111, 88, 0.48)",
      scribble: index % 2 === 0 ? "rgba(255,255,255,0.22)" : "rgba(118, 149, 120, 0.14)",
      seed: index * 7.13 + 1.4,
    });
  });

  drawMapSun(mapCtx, w * 0.12, h * 0.16, Math.max(18, w * 0.028));
  drawMapCloud(mapCtx, w * 0.23, h * 0.15, 1.02);
  drawMapCloud(mapCtx, w * 0.53, h * 0.11, 0.82);
  drawMapCloud(mapCtx, w * 0.83, h * 0.2, 0.9);
  drawMapWhale(mapCtx, w * 0.16, h * 0.78, Math.min(1.1, w / 960));
  drawMapCompass(mapCtx, w * 0.91, h * 0.82, Math.max(18, w * 0.025));
  MAP_REGION_STICKERS.forEach((sticker) => {
    drawMapRegionSticker(mapCtx, sticker, w, h, {
      hovered: state.mapHoverRegion === sticker.id,
      related: relatedRegions.has(sticker.id),
      pop: state.mapRegionPop[sticker.id] || 0,
    });
  });
  drawMapRegionStarTrail(mapCtx);

  ROUTES.forEach((item, index) => {
    const curve = routeCurve(item);
    const selected = index === state.selectedRoute;
    const hovered = index === state.mapHoverRoute;
    const locked = index > state.unlockedRoute;
    drawMapRouteThread(mapCtx, curve, {
      selected,
      hovered,
      locked,
      color: selected ? "#f6b557" : "rgba(255,255,255,0.94)",
      pulseColor: selected ? item.palette.accent : "#ffffff",
      index,
    });
  });

  mapCtx.setLineDash([]);
  Object.keys(AIRPORTS).forEach((id) => {
    const airport = AIRPORTS[id];
    const p = airportPixel(id);
    const active = ROUTES.some((item, index) => index <= state.unlockedRoute && (item.from === id || item.to === id));
    const selected = ROUTES[state.selectedRoute].from === id || ROUTES[state.selectedRoute].to === id;
    const focused = focusedAirports.has(id);
    drawMapAirportMarker(mapCtx, airport, p.x, p.y, selected, active, focused);
    drawMapAirportLabel(mapCtx, p.x, p.y, airport.code, selected);
  });

  drawRoundRectPath(mapCtx, 14, 14, 352, 84, 20);
  mapCtx.fillStyle = "rgba(255, 253, 246, 0.94)";
  mapCtx.fill();
  mapCtx.strokeStyle = "rgba(233, 189, 124, 0.4)";
  mapCtx.lineWidth = 2;
  mapCtx.stroke();
  mapCtx.fillStyle = "#29485f";
  mapCtx.textAlign = "left";
  mapCtx.font = `${Math.round(12 * (w / 960))}px "M PLUS Rounded 1c", sans-serif`;
  mapCtx.fillStyle = "rgba(143, 110, 129, 0.9)";
  mapCtx.fillText("Dreamy World Map", 30, 34);
  mapCtx.font = `700 ${Math.round(21 * (w / 960))}px "Baloo 2", sans-serif`;
  mapCtx.fillStyle = "#2d4b63";
  mapCtx.fillText("手繪世界航線地圖", 28, 58);
  mapCtx.font = `${Math.round(13 * (w / 960))}px "M PLUS Rounded 1c", sans-serif`;
  mapCtx.fillStyle = "rgba(61, 91, 118, 0.82)";
  mapCtx.fillText(`${AIRPORTS[route.from].code} -> ${AIRPORTS[route.to].code} · 洲別貼紙、機場圖示與縫線航路`, 28, 81);

  drawRoundRectPath(mapCtx, w - 186, 20, 154, 42, 15);
  mapCtx.fillStyle = "rgba(255, 246, 224, 0.94)";
  mapCtx.fill();
  mapCtx.strokeStyle = "rgba(229, 184, 101, 0.5)";
  mapCtx.lineWidth = 2;
  mapCtx.stroke();
  mapCtx.fillStyle = "#49647b";
  mapCtx.textAlign = "center";
  mapCtx.font = `700 ${Math.round(14 * (w / 960))}px "Baloo 2", sans-serif`;
  mapCtx.fillText("點航線開始飛", w - 109, 46);

  drawRoundRectPath(mapCtx, 20, h - 60, 182, 36, 14);
  mapCtx.fillStyle = "rgba(241, 250, 255, 0.92)";
  mapCtx.fill();
  mapCtx.strokeStyle = "rgba(126, 179, 206, 0.42)";
  mapCtx.stroke();
  mapCtx.fillStyle = "#53708a";
  mapCtx.textAlign = "left";
  mapCtx.font = `${Math.round(12 * (w / 960))}px "M PLUS Rounded 1c", sans-serif`;
  mapCtx.fillText("縫線路徑會跟著小飛機移動", 34, h - 38);

  mapCtx.save();
  mapCtx.strokeStyle = "rgba(233, 203, 167, 0.58)";
  mapCtx.lineWidth = 3;
  drawRoundRectPath(mapCtx, 8, 8, w - 16, h - 16, 28);
  mapCtx.stroke();
  mapCtx.restore();

  if (state.mapTransition) {
    drawMapTransitionOverlay();
  }
}

function drawMapTransitionPlane(ctx, x, y, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(-14, 6);
  ctx.lineTo(8, 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMapTransitionOverlay() {
  const transition = state.mapTransition;
  if (!transition) {
    return;
  }
  const route = ROUTES[transition.routeIndex];
  const curve = routeCurve(route);
  const t = clamp(transition.elapsed / transition.duration, 0, 1);
  const eased = smoothStep(t);
  const point = quadraticPoint(curve, eased);
  const ahead = quadraticPoint(curve, Math.min(1, eased + 0.02));
  const angle = Math.atan2(ahead.y - point.y, ahead.x - point.x);
  mapCtx.fillStyle = `rgba(26, 39, 55, ${0.16 + eased * 0.34})`;
  mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
  mapCtx.strokeStyle = "rgba(255, 234, 164, 0.95)";
  mapCtx.lineWidth = 6;
  mapCtx.setLineDash([10, 6]);
  mapCtx.beginPath();
  mapCtx.moveTo(curve.a.x, curve.a.y);
  mapCtx.quadraticCurveTo(curve.c.x, curve.c.y, curve.b.x, curve.b.y);
  mapCtx.stroke();
  mapCtx.setLineDash([]);
  drawMapTransitionPlane(mapCtx, point.x, point.y, angle, route.palette.accent);
  drawRoundRectPath(mapCtx, (mapCanvas.width - 344) * 0.5, 24, 344, 64, 16);
  mapCtx.fillStyle = "rgba(255,255,255,0.92)";
  mapCtx.fill();
  mapCtx.fillStyle = "#29485f";
  mapCtx.textAlign = "center";
  mapCtx.font = `700 ${Math.round(17 * (mapCanvas.width / 960))}px "Baloo 2", sans-serif`;
  mapCtx.fillText("夢航線過場", mapCanvas.width * 0.5, 48);
  mapCtx.font = `${Math.round(13 * (mapCanvas.width / 960))}px "M PLUS Rounded 1c", sans-serif`;
  mapCtx.fillText(`${AIRPORTS[route.from].code} -> ${AIRPORTS[route.to].code} · ${Math.floor(t * 100)}%`, mapCanvas.width * 0.5, 72);
}

function beginMapTransition() {
  if (state.screen !== "map" || state.mapTransition || state.selectedRoute > state.unlockedRoute) {
    return;
  }
  ensureAudioReady();
  playSfx("start");
  if (FORCE_DEBUG) {
    startFlight({ routeIndex: state.selectedRoute });
    return;
  }
  state.mapTransition = {
    routeIndex: state.selectedRoute,
    elapsed: 0,
    duration: 2.2,
  };
  renderRoutePills();
  updateRouteInfo();
}

function updateMapTransition(dt) {
  const transition = state.mapTransition;
  if (!transition) {
    return;
  }
  transition.elapsed += dt;
  if (transition.elapsed >= transition.duration) {
    const routeIndex = transition.routeIndex;
    state.mapTransition = null;
    startFlight({ routeIndex });
  }
}

function currentSunPercent(flight) {
  return (flight.sun / Math.max(1, flight.maxSun)) * 100;
}

function planeScreenX(flight) {
  return flight.screenX;
}

function startFlight(options = {}) {
  const routeIndex = options.routeIndex ?? state.selectedRoute;
  if (routeIndex > state.unlockedRoute) {
    return;
  }
  const route = ROUTES[routeIndex];
  const ghostSlot = getGhostSlot(route.id);
  const ghostRun = getGhostRun(route.id, ghostSlot);
  ensureAudioReady();
  setScreen("flight");
  resizeCanvas(gameCanvas);
  state.selectedRoute = routeIndex;
  state.flight = createFlightState(routeIndex);
  state.flight.ghostPlayback = createGhostPlayback(ghostRun, ghostSlot);
  state.flight.ghostRecorder = createGhostRecorder();
  recordGhostSample(state.flight, true);
  state.result = null;
  state.input.up = false;
  state.input.down = false;
  state.input.left = false;
  state.input.right = false;
  state.input.airbrake = false;
  updateHud();
}

function setThrottleTarget(nextValue) {
  if (!state.flight) {
    return getSnapshot();
  }
  state.flight.throttleTarget = clampThrottle(nextValue);
  updateHud();
  return getSnapshot();
}

function adjustThrottle(delta) {
  if (!state.flight) {
    return getSnapshot();
  }
  state.flight.throttleTarget = clampThrottle(state.flight.throttleTarget + delta);
  playSfx("tap");
  updateHud();
  return getSnapshot();
}

function cycleFlaps(step = 1) {
  if (!state.flight) {
    return getSnapshot();
  }
  state.flight.flaps = clampFlaps((state.flight.flaps + step + 3) % 3);
  playSfx("tap");
  updateHud();
  return getSnapshot();
}

function flightSystemsLabel(flight) {
  if (!flight) {
    return "燃油 -- · 方向鍵速度 保持 · 自動襟翼 --";
  }
  const fuelLabel = flight.engineOut
    ? "引擎熄火"
    : flight.lowFuelWarning
      ? `低油量 ${Math.round(currentFuelPercent(flight))}%`
      : `燃油 ${Math.round(currentFuelPercent(flight))}%`;
  return `${altitudeBandLabel(flight)} · ${fuelLabel} · 方向鍵速度 ${speedControlLabel(flight)} · 自動襟翼 ${flapsLabel(flight.flaps)} · 自動空煞 ${state.input.airbrake ? "展開" : "收起"}`;
}

function drawFlight() {
  flightRenderer.drawFlight();
}

function phaseLabel(flight) {
  const landingAssist = landingAssistState(flight);
  if (flight.phase === "takeoff_roll" && flight.engineOut) {
    return "狀態: 燃油耗盡，跑道上已經沒有推力";
  }
  if (!flight.grounded && flight.engineOut) {
    return landingAssist.flareWindow
      ? "狀態: 引擎熄火，靠滑翔 flare 接地"
      : "狀態: 引擎熄火，改用滑翔保住高度";
  }
  if (flight.phase === "takeoff_roll") {
    return flight.speed >= currentRotateSpeed(flight) ? "狀態: 速度足夠，抬頭起飛" : "狀態: 跑道加速中";
  }
  if (flight.phase === "landing_roll") {
    return flight.speed > 260 ? "狀態: 減速板展開，跑道減速" : "狀態: 跑道滑行減速";
  }
  if (flight.phase === "descent") {
    return "狀態: 提早減速下降，開始修正進場";
  }
  if (spaceAltitudeRatio(flight) > 0.65) {
    return `狀態: 高空軌道巡航 · ${altitudeBandLabel(flight)}`;
  }
  if (landingAssist.flareWindow) {
    return "狀態: 拉平 flare，準備接地";
  }
  if (flight.phase === "approach") {
    const nightTag = nightApproachRatio(flight) > 0.45 ? "夜間" : "黃昏";
    return landingAssist.gearDown ? `狀態: ${nightTag}放輪進場` : "狀態: 進場對準跑道";
  }
  if (state.input.up) {
    return "狀態: 拉升爬高";
  }
  if (state.input.down) {
    return "狀態: 俯衝加速";
  }
  if (state.input.left) {
    return "狀態: 穩定減速";
  }
  if (state.input.right) {
    return "狀態: 加速巡航";
  }
  if (flight.lowFuelWarning) {
    return `狀態: 低油量巡航 · ${altitudeBandLabel(flight)}`;
  }
  if (flight.vy > 30) {
    return "狀態: 平穩爬升";
  }
  if (flight.vy < -60) {
    return `狀態: 緩降巡航 · ${altitudeBandLabel(flight)}`;
  }
  return `狀態: 巡航中 · ${altitudeBandLabel(flight)}`;
}

function missionProgressLabel(flight, route) {
  const landingAssist = landingAssistState(flight);
  if (flight.phase === "takeoff_roll" && flight.engineOut) {
    return `燃油已經見底，${AIRPORTS[route.from].code} 跑道上沒有足夠推力；除非補到燃油，不然這趟起飛只能中止`;
  }
  if (!flight.grounded && flight.engineOut) {
    return `引擎熄火，先穩住機頭維持滑翔，朝 ${AIRPORTS[route.to].code} 跑道或前方的燃油補給飛過去`;
  }
  if (flight.phase === "takeoff_roll") {
    return `沿 ${AIRPORTS[route.from].code} 跑道加速，用 → 保持加速，速度足夠後按 ↑ 抬頭離地`;
  }
  if (flight.phase === "landing_roll") {
    const rating = flight.touchdownRating ? ` · ${flight.touchdownRating}` : "";
    return `保持機身穩定，沿 ${AIRPORTS[route.to].code} 跑道滑停${rating}`;
  }
  if (flight.phase === "descent") {
    return `提早為 ${AIRPORTS[route.to].code} 進場做準備，先按 ← 減速，再用 ↑ / ↓ 把高度和下降率慢慢穩下來`;
  }
  if (landingAssist.flareWindow) {
    return `接近 ${AIRPORTS[route.to].code} 跑道，輕拉機頭把下降率收在 ${Math.round(flight.landingBounceSink)} 以內`;
  }
  if (flight.phase === "approach") {
    return `已進入最後進場，對準 ${AIRPORTS[route.to].code} 跑道，用 ← 慢慢收速度，用 ↑ / ↓ 修正角度與接地點`;
  }
  if (flight.lowFuelWarning) {
    return `燃油偏低，優先找前方的燃油補給；中空最好穩住姿態，低空與高空也能冒險補油`;
  }
  return `${altitudeBandHint(flight)} · 目的地 ${AIRPORTS[route.to].code} · 星星 ${flight.stars}/${route.mission.stars} · 風流 ${flight.drafts}/${route.mission.drafts}`;
}

function updateHud() {
  const flight = state.flight;
  if (!flight) {
    return;
  }
  const route = ROUTES[flight.routeIndex];
  const progress = routeProgress(flight);
  const ghostState = ghostChaseState(flight);
  hudDistance.textContent = `${Math.floor(progress * 100)}%`;
  hudHealth.textContent = `${Math.max(0, currentFuelPercent(flight)).toFixed(0)}%`;
  hudFuel.textContent = `${Math.round(flight.speed)}`;
  hudScore.textContent = `${flight.stars}`;
  hudPhase.textContent = phaseLabel(flight);
  hudSystems.textContent = flightSystemsLabel(flight);
  hudGhost.textContent = ghostState.label;
  hudMission.textContent = missionProgressLabel(flight, route);
  renderDebugPanel();
}

function evaluateMission(flight, route) {
  const failed = [];
  if (flight.stars < route.mission.stars) {
    failed.push(`星星 ${flight.stars}/${route.mission.stars}`);
  }
  if (flight.drafts < route.mission.drafts) {
    failed.push(`風流 ${flight.drafts}/${route.mission.drafts}`);
  }
  return {
    success: failed.length === 0,
    failed,
    stars: flight.stars,
    drafts: flight.drafts,
  };
}

function updateBestRun(routeId, flight) {
  const current = state.bestRuns[routeId] || { time: 0, stars: 0 };
  if (current.time === 0 || flight.elapsed < current.time) {
    state.bestRuns[routeId] = {
      time: Number(flight.elapsed.toFixed(1)),
      stars: Math.max(current.stars || 0, flight.stars),
    };
    return;
  }
  if (flight.stars > (current.stars || 0)) {
    state.bestRuns[routeId] = {
      time: current.time,
      stars: flight.stars,
    };
  }
}

function finishFlight(reason) {
  const flight = state.flight;
  if (!flight) {
    return;
  }
  const route = ROUTES[flight.routeIndex];
  const arrived = reason === "arrived";
  const mission = evaluateMission(flight, route);
  const activeGhostSlot = getGhostSlot(route.id);
  const previousGhost = getGhostRun(route.id);

  let unlockMessage = "";
  let ghostRaceMessage = "";
  let ghostMessage = "";
  if (arrived) {
    ghostRaceMessage = compareAgainstGhost(previousGhost, flight, activeGhostSlot);
    updateBestRun(route.id, flight);
    ghostMessage = updateGhostRun(route.id, flight);
    if (flight.routeIndex === state.unlockedRoute && state.unlockedRoute < ROUTES.length - 1) {
      state.unlockedRoute += 1;
      unlockMessage = `解鎖新航線：${AIRPORTS[ROUTES[state.unlockedRoute].from].name} -> ${AIRPORTS[ROUTES[state.unlockedRoute].to].name}`;
      playSfx("unlock");
    } else {
      playSfx("success");
    }
  } else {
    playSfx("fail");
  }

  saveProgress();

  const title = arrived ? `已抵達 ${AIRPORTS[route.to].code}` : "航班未完成";
  const summary = resultReasonSummary(reason, flight, route);
  const body = arrived
    ? `${routeCodeLabel(route)} · 飛行 ${flight.elapsed.toFixed(1)} 秒 · 燃油 ${Math.round(currentFuelPercent(flight))}% · 落地評價 ${flight.touchdownRating || "已完成"}`
    : `${routeCodeLabel(route)} · ${summary}`;
  const stats = [
    {
      label: "航線",
      value: routeCodeLabel(route),
      meta: routeNameLabel(route),
    },
    {
      label: "飛行時間",
      value: `${flight.elapsed.toFixed(1)} 秒`,
      meta: arrived ? "本次完整航班" : "本次嘗試紀錄",
    },
    {
      label: "燃油",
      value: `${Math.round(currentFuelPercent(flight))}%`,
      meta: `${Math.round(flight.fuel)} / ${Math.round(flight.maxFuel)}`,
    },
    {
      label: "收集",
      value: `${flight.stars} 星`,
      meta: `風流 ${flight.drafts} 道`,
    },
    flight.touchdownRating
      ? {
          label: "接地",
          value: flight.touchdownRating,
          meta: `速度 ${Math.round(flight.touchdownSpeed)} · 下降率 ${Math.round(flight.touchdownSinkRate)}`,
        }
      : {
          label: "狀態",
          value: arrived ? "完成" : "未完成",
          meta: arrived ? "已滑停" : summary,
        },
  ];
  const notes = [
    mission.success
      ? `今日任務完成：星星 ${flight.stars}/${route.mission.stars} · 風流 ${flight.drafts}/${route.mission.drafts}`
      : `今日任務未完成：${mission.failed.join("、")}`,
    flight.hadEngineOut ? "途中曾經發生引擎熄火" : "",
    ghostRaceMessage,
    ghostMessage,
    unlockMessage,
  ].filter(Boolean);
  const continueSuggestion = resolveContinueSuggestion(flight, reason);

  state.result = {
    routeIndex: flight.routeIndex,
    title,
    summary,
    body,
    notes,
    continueRouteIndex: continueSuggestion?.routeIndex ?? null,
    continueRouteId: continueSuggestion?.routeId ?? "",
    continueFrom: continueSuggestion?.fromCode ?? "",
    continueTo: continueSuggestion?.toCode ?? "",
  };

  resultTitle.textContent = title;
  renderResultSummary(summary);
  resultBody.textContent = body;
  renderResultStats(stats);
  renderResultNotes(notes);
  renderContinuePanel(continueSuggestion, flight.routeIndex);

  state.flight = null;
  state.input.up = false;
  state.input.down = false;
  state.input.left = false;
  state.input.right = false;
  state.input.airbrake = false;
  setScreen("result");
}

function tick(now) {
  const dt = clamp((now - state.lastTick) / 1000, 0.001, 0.034);
  state.lastTick = now;
  state.mapPulse += dt;
  updateMapEffects(dt);
  updateMusic();

  if (state.screen === "map") {
    resizeCanvas(mapCanvas);
    updateMapTransition(dt);
    if (state.screen === "map") {
      drawMap();
    }
  } else if (state.screen === "flight") {
    resizeCanvas(gameCanvas);
    updateFlight(dt);
    if (state.screen === "flight") {
      recordGhostSample(state.flight);
      drawFlight();
    }
  }

  requestAnimationFrame(tick);
}

function resetProgress() {
  state.unlockedRoute = 0;
  state.bestRuns = {};
  state.ghostRuns = {};
  localStorage.removeItem(STORAGE_UNLOCK_KEY);
  localStorage.removeItem(STORAGE_BEST_KEY);
  localStorage.removeItem(STORAGE_GHOSTS_KEY);
  localStorage.removeItem("tiny-airplanes.hangar");
  selectRoute(0);
  setScreen("map");
}

function bindHoldButton(button, key) {
  if (!button) {
    return;
  }
  const press = (event) => {
    ensureAudioReady();
    event.preventDefault();
    if (button.setPointerCapture && event.pointerId !== undefined) {
      button.setPointerCapture(event.pointerId);
    }
    state.input[key] = true;
  };
  const release = (event) => {
    if (event) {
      event.preventDefault();
    }
    state.input[key] = false;
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
}

function bindTapButton(button, handler) {
  if (!button) {
    return;
  }
  button.addEventListener("click", (event) => {
    ensureAudioReady();
    event.preventDefault();
    handler();
  });
}

function installDebugApi() {
  if (!FORCE_DEBUG) {
    delete window.__tinyAirplanes;
    return;
  }
  window.__tinyAirplanes = {
    getSnapshot,
    setDebug(enabled) {
      setDebugEnabled(enabled, { persist: false });
      return getSnapshot();
    },
    setAudio(enabled) {
      setAudioEnabled(Boolean(enabled));
      return getSnapshot();
    },
    setGhost(enabled) {
      setGhostEnabled(Boolean(enabled), { persist: true });
      return getSnapshot();
    },
    setGhostSlot(slot, routeIndex = state.selectedRoute) {
      const route = ROUTES[clamp(routeIndex, 0, ROUTES.length - 1)];
      selectGhostSlotMode(slot, route.id, { persist: true });
      return getSnapshot();
    },
    selectRoute(index) {
      selectRoute(index);
      return getSnapshot();
    },
    setUnlockedRoute(index) {
      state.unlockedRoute = clamp(index, 0, ROUTES.length - 1);
      saveProgress();
      renderRoutePills();
      updateRouteInfo();
      return getSnapshot();
    },
    startFlight(routeIndex = state.selectedRoute) {
      startFlight({ routeIndex });
      return getSnapshot();
    },
    setInput(nextInput = {}) {
      if (typeof nextInput.up === "boolean") {
        state.input.up = nextInput.up;
      }
      if (typeof nextInput.down === "boolean") {
        state.input.down = nextInput.down;
      }
      if (typeof nextInput.left === "boolean") {
        state.input.left = nextInput.left;
      }
      if (typeof nextInput.right === "boolean") {
        state.input.right = nextInput.right;
      }
      if (typeof nextInput.airbrake === "boolean") {
        state.input.airbrake = nextInput.airbrake;
      }
      return getSnapshot();
    },
    releaseInput() {
      state.input.up = false;
      state.input.down = false;
      state.input.left = false;
      state.input.right = false;
      state.input.airbrake = false;
      return getSnapshot();
    },
    setThrottle(value) {
      return setThrottleTarget(value);
    },
    adjustThrottle(delta) {
      return adjustThrottle(delta);
    },
    setFlaps(value) {
      if (!state.flight) {
        return getSnapshot();
      }
      state.flight.flaps = clampFlaps(value);
      updateHud();
      return getSnapshot();
    },
    cycleFlaps(step = 1) {
      return cycleFlaps(step);
    },
    patchFlight(patch = {}) {
      return debugPatchFlight(patch);
    },
    resetProgress() {
      resetProgress();
      return getSnapshot();
    },
  };
}

function installEventListeners() {
  startFlightButton.addEventListener("click", () => {
    ensureAudioReady();
    beginMapTransition();
  });

  retryFlightButton.addEventListener("click", () => {
    if (!state.result) {
      return;
    }
    ensureAudioReady();
    selectRoute(state.result.routeIndex);
    setScreen("map");
    beginMapTransition();
  });

  bindTapButton(continueFlightButton, () => {
    if (!state.result || state.result.continueRouteIndex === null || state.result.continueRouteIndex === undefined) {
      return;
    }
    selectRoute(state.result.continueRouteIndex);
    setScreen("map");
    beginMapTransition();
  });

  backToMapButton.addEventListener("click", () => {
    ensureAudioReady();
    playSfx("tap");
    setScreen("map");
  });

  bindTapButton(ghostSlotBestButton, () => {
    const routeId = getRoute(state.selectedRoute)?.id;
    if (routeId) {
      selectGhostSlotMode("best", routeId);
      playSfx("tap");
    }
  });
  bindTapButton(ghostSlotLastButton, () => {
    const routeId = getRoute(state.selectedRoute)?.id;
    if (routeId) {
      selectGhostSlotMode("last", routeId);
      playSfx("tap");
    }
  });
  bindTapButton(resultGhostBestButton, () => {
    const routeId = getRoute(state.result?.routeIndex ?? state.selectedRoute)?.id;
    if (routeId) {
      selectGhostSlotMode("best", routeId);
      playSfx("tap");
    }
  });
  bindTapButton(resultGhostLastButton, () => {
    const routeId = getRoute(state.result?.routeIndex ?? state.selectedRoute)?.id;
    if (routeId) {
      selectGhostSlotMode("last", routeId);
      playSfx("tap");
    }
  });

  resetProgressButton.addEventListener("click", () => {
    ensureAudioReady();
    playSfx("tap");
    const approved = window.confirm("確定要清空航線解鎖與最佳紀錄嗎？");
    if (approved) {
      resetProgress();
    }
  });

  audioToggleButton.addEventListener("click", () => {
    if (!audioController.hasSupport()) {
      return;
    }
    const nextValue = !state.audioEnabled;
    setAudioEnabled(nextValue);
    if (nextValue) {
      ensureAudioReady();
      playSfx("tap");
    }
  });

  ghostToggleButton.addEventListener("click", () => {
    ensureAudioReady();
    setGhostEnabled(!state.ghostEnabled);
    playSfx("tap");
  });

  debugToggleButton.addEventListener("click", () => {
    setDebugEnabled(!state.debugEnabled);
  });

  mapCanvas.addEventListener("pointermove", (event) => {
    if (state.screen !== "map" || state.mapTransition) {
      return;
    }
    const point = getCanvasPoint(event, mapCanvas);
    state.mapHoverRoute = routeHitTest(point);
    state.mapHoverRegion = regionStickerHitTest(point);
    mapCanvas.style.cursor = state.mapHoverRoute >= 0 || state.mapHoverRegion ? "pointer" : "default";
  });

  mapCanvas.addEventListener("pointerleave", () => {
    state.mapHoverRoute = -1;
    state.mapHoverRegion = "";
    mapCanvas.style.cursor = "default";
  });

  mapCanvas.addEventListener("click", (event) => {
    if (state.screen !== "map" || state.mapTransition) {
      return;
    }
    ensureAudioReady();
    const point = getCanvasPoint(event, mapCanvas);
    const hit = routeHitTest(point);
    if (hit >= 0) {
      selectRoute(hit);
      return;
    }
    const regionId = regionStickerHitTest(point);
    if (regionId) {
      triggerRegionStickerBurst(regionId);
      playSfx("tap");
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "ArrowUp" || event.code === "KeyW") {
      ensureAudioReady();
      state.input.up = true;
      event.preventDefault();
      return;
    }
    if (event.code === "ArrowDown" || event.code === "KeyS") {
      ensureAudioReady();
      state.input.down = true;
      event.preventDefault();
      return;
    }
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      ensureAudioReady();
      state.input.left = true;
      event.preventDefault();
      return;
    }
    if (event.code === "ArrowRight" || event.code === "KeyD") {
      ensureAudioReady();
      state.input.right = true;
      event.preventDefault();
      return;
    }
    if (event.code === "KeyG") {
      ensureAudioReady();
      setGhostEnabled(!state.ghostEnabled);
      playSfx("tap");
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowUp" || event.code === "KeyW") {
      state.input.up = false;
      return;
    }
    if (event.code === "ArrowDown" || event.code === "KeyS") {
      state.input.down = false;
      return;
    }
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      state.input.left = false;
      state.input.airbrake = false;
      return;
    }
    if (event.code === "ArrowRight" || event.code === "KeyD") {
      state.input.right = false;
    }
  });

  window.addEventListener("pointerdown", () => {
    ensureAudioReady();
  }, { once: true });

  window.addEventListener("blur", () => {
    state.input.up = false;
    state.input.down = false;
    state.input.left = false;
    state.input.right = false;
    state.input.airbrake = false;
  });

  window.addEventListener("resize", () => {
    resizeCanvas(mapCanvas);
    resizeCanvas(gameCanvas);
  });

  bindHoldButton(touchUp, "up");
  bindHoldButton(touchDown, "down");
  bindHoldButton(touchLeft, "left");
  bindHoldButton(touchRight, "right");
}

function init() {
  loadProgress();
  updateAudioToggleLabel();
  updateGhostToggleLabel();
  updateDebugToggleLabel();
  selectRoute(0);
  setScreen("map");
  installDebugApi();
  installEventListeners();
  resizeCanvas(mapCanvas);
  resizeCanvas(gameCanvas);
  renderDebugPanel();
  requestAnimationFrame(tick);
}

init();
