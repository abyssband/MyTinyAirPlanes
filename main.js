import {
  AIRPORTS,
  FORCE_DEBUG,
  MUSIC_PATTERN,
  ROUTES,
  STORAGE_BEST_KEY,
  STORAGE_GHOSTS_KEY,
  STORAGE_UNLOCK_KEY,
  UPGRADE_CONFIG,
} from "./src/config.js";
import { createAudioController } from "./src/audio.js";
import { createFlightRenderer } from "./src/flight/render.js";
import { createFlightRuntime } from "./src/flight/runtime.js";
import {
  loadPersistedState,
  saveAudioPreference,
  saveDebugPreference,
  saveHangarData,
  saveGhostPreference,
  saveProgressData,
} from "./src/storage.js";
import {
  blendHex,
  clamp,
  createSeededRng,
  fract,
  hash1,
  lerp,
  roundNumber,
  smoothStep,
} from "./src/utils.js";

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
const ghostSlotMeta = document.getElementById("ghost-slot-meta");
const ghostSlotBestButton = document.getElementById("ghost-slot-best");
const ghostSlotLastButton = document.getElementById("ghost-slot-last");
const hangarParts = document.getElementById("hangar-parts");
const upgradeList = document.getElementById("upgrade-list");
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
const resultBody = document.getElementById("result-body");
const resultGhostPanel = document.getElementById("result-ghost-panel");
const resultGhostSummary = document.getElementById("result-ghost-summary");
const resultGhostBestButton = document.getElementById("result-ghost-best");
const resultGhostLastButton = document.getElementById("result-ghost-last");
const retryFlightButton = document.getElementById("retry-flight");
const backToMapButton = document.getElementById("back-to-map");

const touchControls = document.getElementById("touch-controls");
const touchUp = document.getElementById("touch-up");
const touchDown = document.getElementById("touch-down");
const touchThrottleDown = document.getElementById("touch-throttle-down");
const touchThrottleUp = document.getElementById("touch-throttle-up");
const touchFlaps = document.getElementById("touch-flaps");
const touchAirbrake = document.getElementById("touch-airbrake");

const state = {
  screen: "map",
  selectedRoute: 0,
  unlockedRoute: 0,
  bestRuns: {},
  ghostRuns: {},
  hangar: {
    parts: 0,
    upgrades: {
      engine: 0,
      tank: 0,
      frame: 0,
    },
  },
  mapHoverRoute: -1,
  mapPulse: 0,
  mapTransition: null,
  flight: null,
  result: null,
  input: {
    up: false,
    down: false,
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
  getHangarEffects,
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

function getUpgradeCost(id, level = state.hangar.upgrades[id]) {
  const config = UPGRADE_CONFIG[id];
  return config.baseCost + config.costStep * level;
}

function getHangarEffects() {
  const engineLevel = state.hangar.upgrades.engine;
  const wingLevel = state.hangar.upgrades.tank;
  const frameLevel = state.hangar.upgrades.frame;
  return {
    speedMultiplier: 1 + engineLevel * 0.08,
    launchBoost: 1 + engineLevel * 0.09,
    glideLift: 1 + wingLevel * 0.12,
    draftBoost: 1 + wingLevel * 0.1,
    crashResistance: 1 + frameLevel * 0.12,
    sunsetPreservation: 1 + frameLevel * 0.08,
    sunReserve: 78 + frameLevel * 10,
  };
}

function loadProgress() {
  const persisted = loadPersistedState(localStorage);
  state.unlockedRoute = persisted.unlockedRoute;
  state.bestRuns = persisted.bestRuns;
  state.ghostRuns = persisted.ghostRuns;
  state.hangar = persisted.hangar;
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

function saveHangar() {
  saveHangarData(localStorage, state.hangar);
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
  const approachBoost = smoothStep((routeProgress(flight) - 0.74) / 0.18) * 0.35;
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

function updateFlightSystems(flight, dt) {
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
      throttle: roundNumber(flight.throttle, 2),
      throttleTarget: roundNumber(flight.throttleTarget, 2),
      flaps: flight.flaps,
      airbrake: state.input.airbrake,
      sun: roundNumber(flight.sun),
      sunPct: roundNumber(currentSunPercent(flight)),
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
      cloudSignature: flight.clouds
        .slice(0, 3)
        .map((cloud) => `${roundNumber(cloud.x)},${roundNumber(cloud.altitude)},${roundNumber(cloud.r)}`)
        .join("|"),
    };
  }

  if (state.result) {
    snapshot.result = {
      routeIndex: state.result.routeIndex,
      title: resultTitle.textContent,
      body: resultBody.textContent,
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
    `cameraAlt     ${flight.cameraAltitude}`,
    `verticalSpeed ${flight.verticalSpeed}`,
    `speed         ${flight.speed}`,
    `systems       thr ${flight.throttleTarget} / flaps ${flight.flaps} / airbrake ${flight.airbrake ? "on" : "off"}`,
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
  const numericKeys = ["worldX", "altitude", "cameraAltitude", "vy", "speed", "sun", "stars", "drafts", "hits", "groundBounce", "groundBounceVelocity", "throttle", "throttleTarget"];
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
  if (typeof patch.runwayState === "string" || patch.runwayState === null) {
    flight.runwayState = patch.runwayState;
  }
  if (Number.isFinite(patch.flaps)) {
    flight.flaps = clampFlaps(patch.flaps);
  }
  if (typeof patch.airbrake === "boolean") {
    state.input.airbrake = patch.airbrake;
  }
  flight.worldX = clamp(flight.worldX, departureRunwayStart(flight) - 40, arrivalRunwayEnd(flight) + 80);
  flight.altitude = Math.max(flight.planeBottomOffset + 2, flight.altitude);
  flight.speed = clamp(flight.speed, 0, flight.maxSpeed);
  flight.throttle = clampThrottle(flight.throttle);
  flight.throttleTarget = clampThrottle(flight.throttleTarget);
  flight.sun = clamp(flight.sun, 0, flight.maxSun);
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
  }
  if (name === "map") {
    renderRoutePills();
    updateRouteInfo();
    renderHangarUpgrades();
  }
  updateGhostToggleLabel();
  updateGhostControls();
  renderDebugPanel();
}

function getRoute(index) {
  return ROUTES[index];
}

function selectRoute(index) {
  state.selectedRoute = clamp(index, 0, ROUTES.length - 1);
  renderRoutePills();
  renderHangarUpgrades();
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

function renderHangarUpgrades() {
  if (!upgradeList || !hangarParts) {
    return;
  }
  const effects = getHangarEffects();
  hangarParts.textContent = `零件: ${state.hangar.parts}`;
  upgradeList.innerHTML = "";
  Object.values(UPGRADE_CONFIG).forEach((config) => {
    const level = state.hangar.upgrades[config.id];
    const maxed = level >= config.maxLevel;
    const cost = getUpgradeCost(config.id, level);
    const disabled = maxed || state.hangar.parts < cost || state.mapTransition !== null;
    const item = document.createElement("div");
    item.className = "upgrade-item";

    const top = document.createElement("div");
    top.className = "upgrade-top";

    const name = document.createElement("p");
    name.className = "upgrade-name";
    name.textContent = config.name;

    const lv = document.createElement("p");
    lv.className = "upgrade-level";
    lv.textContent = `Lv.${level}/${config.maxLevel}`;

    const desc = document.createElement("p");
    desc.className = "upgrade-desc";
    if (config.id === "engine") {
      desc.textContent = `${config.desc} · 目前 x${effects.speedMultiplier.toFixed(2)}`;
    } else if (config.id === "tank") {
      desc.textContent = `${config.desc} · 升力 x${effects.glideLift.toFixed(2)}`;
    } else {
      desc.textContent = `${config.desc} · 夕照保留 x${effects.sunsetPreservation.toFixed(2)}`;
    }

    const button = document.createElement("button");
    button.className = "upgrade-btn";
    button.disabled = disabled;
    button.textContent = maxed ? "已滿級" : `升級 -${cost} 零件`;
    button.addEventListener("click", () => tryUpgrade(config.id));

    top.appendChild(name);
    top.appendChild(lv);
    item.appendChild(top);
    item.appendChild(desc);
    item.appendChild(button);
    upgradeList.appendChild(item);
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
        `目前再飛一次會使用 ${ghostSlotLabel(activeSlot)}`,
      ].filter(Boolean).join(" · ");
    }
  }
}

function tryUpgrade(id) {
  const config = UPGRADE_CONFIG[id];
  if (!config) {
    return;
  }
  const level = state.hangar.upgrades[id];
  if (level >= config.maxLevel) {
    return;
  }
  const cost = getUpgradeCost(id, level);
  if (state.hangar.parts < cost || state.mapTransition) {
    return;
  }
  state.hangar.parts -= cost;
  state.hangar.upgrades[id] += 1;
  saveHangar();
  renderHangarUpgrades();
  updateRouteInfo();
  playSfx("star");
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
  const upgrades = state.hangar.upgrades;
  routeTitle.textContent = `${from.name} -> ${to.name}`;
  routeMeta.textContent = [
    `航程 ${route.distance} km`,
    `難度 ${stars}`,
    `改裝 E${upgrades.engine}/W${upgrades.tank}/F${upgrades.frame}`,
    best ? `最快 ${best.time.toFixed(1)} 秒 · ${best.stars} 星` : "",
    ghost ? `${state.ghostEnabled ? ghostSlotLabel(getGhostSlot(route.id)) : "鬼影已隱藏"} ${ghost.time.toFixed(1)} 秒` : "",
    ghostRecord?.last ? `最近回放 ${ghostRecord.last.time.toFixed(1)} 秒` : "",
  ].filter(Boolean).join(" · ");
  routeDesc.textContent = route.desc;
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

function drawMap() {
  const w = mapCanvas.width;
  const h = mapCanvas.height;
  mapCtx.clearRect(0, 0, w, h);

  const route = ROUTES[state.selectedRoute];
  const ocean = mapCtx.createLinearGradient(0, 0, 0, h);
  ocean.addColorStop(0, blendHex(route.palette.skyTop, "#ffffff", 0.22));
  ocean.addColorStop(1, blendHex(route.palette.skyBottom, "#8fd7df", 0.2));
  mapCtx.fillStyle = ocean;
  mapCtx.fillRect(0, 0, w, h);

  mapCtx.fillStyle = "rgba(255, 255, 255, 0.12)";
  for (let i = 0; i < 18; i += 1) {
    mapCtx.fillRect(0, (i / 17) * h, w, 1);
  }

  const landColor = "#b9d9a6";
  const stroke = "rgba(76, 120, 86, 0.34)";
  drawBlob(mapCtx, [
    [w * 0.11, h * 0.22], [w * 0.18, h * 0.16], [w * 0.27, h * 0.2], [w * 0.31, h * 0.3],
    [w * 0.26, h * 0.39], [w * 0.2, h * 0.44], [w * 0.13, h * 0.4], [w * 0.09, h * 0.31],
  ], landColor, stroke);
  drawBlob(mapCtx, [
    [w * 0.33, h * 0.2], [w * 0.44, h * 0.15], [w * 0.56, h * 0.18], [w * 0.67, h * 0.23],
    [w * 0.76, h * 0.31], [w * 0.79, h * 0.4], [w * 0.71, h * 0.47], [w * 0.61, h * 0.51],
    [w * 0.51, h * 0.48], [w * 0.4, h * 0.43], [w * 0.35, h * 0.34],
  ], landColor, stroke);
  drawBlob(mapCtx, [
    [w * 0.62, h * 0.53], [w * 0.69, h * 0.58], [w * 0.72, h * 0.67], [w * 0.65, h * 0.72],
    [w * 0.59, h * 0.66], [w * 0.57, h * 0.58],
  ], landColor, stroke);
  drawBlob(mapCtx, [
    [w * 0.83, h * 0.69], [w * 0.9, h * 0.66], [w * 0.95, h * 0.71], [w * 0.93, h * 0.79],
    [w * 0.86, h * 0.81], [w * 0.81, h * 0.75],
  ], landColor, stroke);

  ROUTES.forEach((item, index) => {
    const curve = routeCurve(item);
    const selected = index === state.selectedRoute;
    const hovered = index === state.mapHoverRoute;
    const locked = index > state.unlockedRoute;
    mapCtx.beginPath();
    mapCtx.setLineDash(locked ? [3, 8] : [8, 6]);
    mapCtx.moveTo(curve.a.x, curve.a.y);
    mapCtx.quadraticCurveTo(curve.c.x, curve.c.y, curve.b.x, curve.b.y);
    mapCtx.lineWidth = selected ? 5 : hovered ? 4 : 3;
    mapCtx.strokeStyle = locked ? "rgba(255,255,255,0.34)" : selected ? "#ffd373" : "rgba(255,255,255,0.94)";
    mapCtx.stroke();
    if (!locked) {
      const t = (state.mapPulse * 0.14 + index * 0.18) % 1;
      const p = quadraticPoint(curve, t);
      mapCtx.setLineDash([]);
      mapCtx.beginPath();
      mapCtx.arc(p.x, p.y, selected ? 7 : 5, 0, Math.PI * 2);
      mapCtx.fillStyle = selected ? item.palette.accent : "#ffffff";
      mapCtx.fill();
    }
  });

  mapCtx.setLineDash([]);
  Object.keys(AIRPORTS).forEach((id) => {
    const airport = AIRPORTS[id];
    const p = airportPixel(id);
    const active = ROUTES.some((item, index) => index <= state.unlockedRoute && (item.from === id || item.to === id));
    const selected = ROUTES[state.selectedRoute].from === id || ROUTES[state.selectedRoute].to === id;
    mapCtx.beginPath();
    mapCtx.arc(p.x, p.y, selected ? 12 : 9, 0, Math.PI * 2);
    mapCtx.fillStyle = active ? airport.color : "rgba(255,255,255,0.52)";
    mapCtx.fill();
    mapCtx.lineWidth = selected ? 3 : 2;
    mapCtx.strokeStyle = "rgba(255,255,255,0.94)";
    mapCtx.stroke();
    mapCtx.fillStyle = "#29485f";
    mapCtx.font = `${Math.round(12 * (w / 960))}px "M PLUS Rounded 1c", sans-serif`;
    mapCtx.textAlign = "center";
    mapCtx.fillText(airport.code, p.x, p.y - 15);
  });

  drawRoundRectPath(mapCtx, 16, 16, 316, 66, 16);
  mapCtx.fillStyle = "rgba(255,255,255,0.9)";
  mapCtx.fill();
  mapCtx.fillStyle = "#29485f";
  mapCtx.textAlign = "left";
  mapCtx.font = `700 ${Math.round(16 * (w / 960))}px "Baloo 2", sans-serif`;
  mapCtx.fillText("今日夢航線", 28, 41);
  mapCtx.font = `${Math.round(14 * (w / 960))}px "M PLUS Rounded 1c", sans-serif`;
  mapCtx.fillText(`${AIRPORTS[route.from].code} -> ${AIRPORTS[route.to].code}`, 28, 64);

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
  state.mapTransition = {
    routeIndex: state.selectedRoute,
    elapsed: 0,
    duration: 2.2,
  };
  renderRoutePills();
  renderHangarUpgrades();
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
    return "油門 -- · 襟翼 -- · 空煞 收起";
  }
  return `油門 ${throttlePercent(flight.throttleTarget)}% · 襟翼 ${flapsLabel(flight.flaps)} · 空煞 ${state.input.airbrake ? "展開" : "收起"}`;
}

function drawFlight() {
  flightRenderer.drawFlight();
}

function phaseLabel(flight) {
  const landingAssist = landingAssistState(flight);
  if (flight.phase === "takeoff_roll") {
    return flight.speed >= currentRotateSpeed(flight) ? "狀態: 速度足夠，抬頭起飛" : `狀態: 跑道加速中 · 油門 ${throttlePercent(flight.throttleTarget)}%`;
  }
  if (flight.phase === "landing_roll") {
    return flight.speed > 260 ? "狀態: 減速板展開，跑道減速" : "狀態: 跑道滑行減速";
  }
  if (spaceAltitudeRatio(flight) > 0.65) {
    return "狀態: 高空軌道巡航";
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
  if (flight.vy > 30) {
    return "狀態: 平穩爬升";
  }
  if (flight.vy < -60) {
    return "狀態: 緩降巡航";
  }
  return "狀態: 巡航中";
}

function missionProgressLabel(flight, route) {
  const landingAssist = landingAssistState(flight);
  if (flight.phase === "takeoff_roll") {
    return `沿 ${AIRPORTS[route.from].code} 跑道加速，現在油門 ${throttlePercent(flight.throttleTarget)}%，襟翼 ${flapsLabel(flight.flaps)}`;
  }
  if (flight.phase === "landing_roll") {
    const rating = flight.touchdownRating ? ` · ${flight.touchdownRating}` : "";
    return `保持機身穩定，沿 ${AIRPORTS[route.to].code} 跑道滑停${rating}`;
  }
  if (landingAssist.flareWindow) {
    return `接近 ${AIRPORTS[route.to].code} 跑道，輕拉機頭把下降率收在 ${Math.round(flight.landingBounceSink)} 以內`;
  }
  if (flight.phase === "approach") {
    return `已放起落架，對準 ${AIRPORTS[route.to].code} 跑道，油門收在 ${Math.max(28, throttlePercent(flight.throttleTarget) - 10)}% 左右，接地速度建議低於 ${Math.round(flight.landingMaxTouchdownSpeed)}`;
  }
  return `目的地 ${AIRPORTS[route.to].code} · 星星 ${flight.stars}/${route.mission.stars} · 風流 ${flight.drafts}/${route.mission.drafts}`;
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
  hudHealth.textContent = `${Math.max(0, currentSunPercent(flight)).toFixed(0)}%`;
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
  const missionBonus = arrived && mission.success ? 14 + route.difficulty * 4 : 0;
  const reward = Math.max(8, Math.round(14 + flight.stars * 1.4 + flight.drafts * 5 + missionBonus));
  state.hangar.parts += reward;
  saveHangar();

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
  } else if (reason === "sunset") {
    playSfx("sunset");
  } else {
    playSfx("fail");
  }

  saveProgress();

  let lead = "這趟航班失敗了。";
  if (arrived) {
    lead = "順利降落，已經抵達 B 機場。";
  } else if (reason === "sunset") {
    lead = "夕陽落下前沒能抵達 B 機場。";
  } else if (reason === "crash") {
    lead = "高度過低，墜入海面或重落在跑道上。";
  } else if (reason === "takeoff_overrun") {
    lead = "跑道用完了，速度還是不足以安全起飛。";
  } else if (reason === "landing_overrun") {
    lead = "已經接地，但跑道不夠長，沒能在盡頭前停下。";
  } else if (reason === "missed") {
    lead = "你飛過了機場，但沒有對準跑道。";
  }

  state.result = {
    routeIndex: flight.routeIndex,
  };

  resultTitle.textContent = arrived ? "順利抵達 B 機場" : "這趟航班失敗了";
  resultBody.textContent = [
    lead,
    `航線：${AIRPORTS[route.from].code} -> ${AIRPORTS[route.to].code}`,
    `飛行時間：${flight.elapsed.toFixed(1)} 秒`,
    flight.touchdownRating ? `落地評價：${flight.touchdownRating}（接地速度 ${Math.round(flight.touchdownSpeed)} / 下降率 ${Math.round(flight.touchdownSinkRate)}）` : "",
    `收集星星：${flight.stars}`,
    `穿過風流：${flight.drafts}`,
    `獲得零件：+${reward}（現有 ${state.hangar.parts}）`,
    mission.success ? "額外任務完成" : `額外任務未完成：${mission.failed.join("、")}`,
    ghostRaceMessage,
    ghostMessage,
    unlockMessage,
  ].filter(Boolean).join("\n");

  state.flight = null;
  state.input.up = false;
  state.input.down = false;
  state.input.airbrake = false;
  setScreen("result");
}

function tick(now) {
  const dt = clamp((now - state.lastTick) / 1000, 0.001, 0.034);
  state.lastTick = now;
  state.mapPulse += dt;
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
      if (typeof nextInput.airbrake === "boolean") {
        state.input.airbrake = nextInput.airbrake;
      }
      return getSnapshot();
    },
    releaseInput() {
      state.input.up = false;
      state.input.down = false;
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
    mapCanvas.style.cursor = state.mapHoverRoute >= 0 ? "pointer" : "default";
  });

  mapCanvas.addEventListener("pointerleave", () => {
    state.mapHoverRoute = -1;
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
      adjustThrottle(-0.08);
      event.preventDefault();
      return;
    }
    if (event.code === "ArrowRight" || event.code === "KeyD") {
      ensureAudioReady();
      adjustThrottle(0.08);
      event.preventDefault();
      return;
    }
    if (event.code === "KeyF") {
      ensureAudioReady();
      cycleFlaps(1);
      event.preventDefault();
      return;
    }
    if (event.code === "Space") {
      ensureAudioReady();
      state.input.airbrake = true;
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
    if (event.code === "Space") {
      state.input.airbrake = false;
    }
  });

  window.addEventListener("pointerdown", () => {
    ensureAudioReady();
  }, { once: true });

  window.addEventListener("blur", () => {
    state.input.up = false;
    state.input.down = false;
    state.input.airbrake = false;
  });

  window.addEventListener("resize", () => {
    resizeCanvas(mapCanvas);
    resizeCanvas(gameCanvas);
  });

  bindHoldButton(touchUp, "up");
  bindHoldButton(touchDown, "down");
  bindHoldButton(touchAirbrake, "airbrake");
  bindTapButton(touchThrottleDown, () => adjustThrottle(-0.08));
  bindTapButton(touchThrottleUp, () => adjustThrottle(0.08));
  bindTapButton(touchFlaps, () => cycleFlaps(1));
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
