import {
  CURRENT_SAVE_VERSION,
  FORCE_DEBUG,
  FORCE_MUTE,
  HAS_VEHICLE_OVERRIDE,
  ROUTES,
  STORAGE_AUDIO_KEY,
  STORAGE_BEST_KEY,
  STORAGE_DEBUG_KEY,
  STORAGE_GHOST_ENABLED_KEY,
  STORAGE_GHOSTS_KEY,
  STORAGE_SAVE_VERSION_KEY,
  STORAGE_STICKERS_KEY,
  STORAGE_UNLOCK_KEY,
  STORAGE_VEHICLE_KEY,
  VEHICLE_PROFILES,
  ACTIVE_VEHICLE_ID,
} from "./config.js?v=20260314-0115";
import { clamp } from "./utils.js?v=20260314-0115";

export function normalizeBestRuns(raw) {
  const bestRuns = {};
  if (!raw || typeof raw !== "object") {
    return bestRuns;
  }
  ROUTES.forEach((route) => {
    const entry = raw[route.id];
    if (!entry || typeof entry !== "object") {
      return;
    }
    bestRuns[route.id] = {
      time: Math.max(0, Number(entry.time) || 0),
    };
  });
  return bestRuns;
}

export function normalizeGhostRuns(raw) {
  const ghostRuns = {};
  if (!raw || typeof raw !== "object") {
    return ghostRuns;
  }
  function normalizeGhostRunEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const sourceSamples = Array.isArray(entry.samples) ? entry.samples : [];
    const samples = sourceSamples
      .map((sample) => (Array.isArray(sample)
        ? sample
        : [sample?.t, sample?.x, sample?.a, sample?.p, sample?.g]))
      .map(([time, worldX, altitude, pitch, grounded]) => [
        Math.max(0, Number(time) || 0),
        Number(worldX) || 0,
        Math.max(0, Number(altitude) || 0),
        clamp(Number(pitch) || 0, -1, 1),
        grounded ? 1 : 0,
      ])
      .filter((sample, index, array) => (
        Number.isFinite(sample[0])
        && Number.isFinite(sample[1])
        && Number.isFinite(sample[2])
        && Number.isFinite(sample[3])
        && (index === 0 || sample[0] >= array[index - 1][0])
      ))
      .slice(0, 2400);
    if (!samples.length) {
      return null;
    }
    return {
      time: Math.max(0, Number(entry.time) || samples[samples.length - 1][0] || 0),
      seed: Number.parseInt(entry.seed, 10) || 0,
      samples,
    };
  }
  ROUTES.forEach((route) => {
    const entry = raw[route.id];
    if (!entry || typeof entry !== "object") {
      return;
    }
    const best = normalizeGhostRunEntry(entry.best || (entry.samples ? entry : null));
    const last = normalizeGhostRunEntry(entry.last);
    if (!best && !last) {
      return;
    }
    const activeSlot = entry.activeSlot === "last" && last ? "last" : best ? "best" : "last";
    ghostRuns[route.id] = {
      activeSlot,
      best,
      last,
    };
  });
  return ghostRuns;
}

export function normalizeStickerCollection(raw) {
  const stickers = {};
  if (!raw || typeof raw !== "object") {
    return stickers;
  }
  ROUTES.forEach((route) => {
    if (raw[route.id]) {
      stickers[route.id] = true;
    }
  });
  return stickers;
}

function readJson(storage, key, fallback) {
  try {
    return JSON.parse(storage.getItem(key) || fallback);
  } catch {
    return JSON.parse(fallback);
  }
}

function readUnlocked(storage) {
  const unlocked = Number.parseInt(storage.getItem(STORAGE_UNLOCK_KEY) || "0", 10);
  return Number.isFinite(unlocked) ? clamp(unlocked, 0, ROUTES.length - 1) : 0;
}

function normalizeVehicleId(value) {
  return VEHICLE_PROFILES[value] ? value : ACTIVE_VEHICLE_ID;
}

export function loadPersistedState(storage) {
  const unlockedRoute = readUnlocked(storage);
  const bestRuns = normalizeBestRuns(readJson(storage, STORAGE_BEST_KEY, "{}"));
  const ghostRuns = normalizeGhostRuns(readJson(storage, STORAGE_GHOSTS_KEY, "{}"));
  const stickerCollection = normalizeStickerCollection(readJson(storage, STORAGE_STICKERS_KEY, "{}"));
  const storedVehicleId = normalizeVehicleId(storage.getItem(STORAGE_VEHICLE_KEY));
  const audioRaw = storage.getItem(STORAGE_AUDIO_KEY);
  const debugRaw = storage.getItem(STORAGE_DEBUG_KEY);
  const ghostEnabledRaw = storage.getItem(STORAGE_GHOST_ENABLED_KEY);
  const saveVersion = Number.parseInt(storage.getItem(STORAGE_SAVE_VERSION_KEY) || "0", 10) || 0;

  const snapshot = {
    unlockedRoute,
    bestRuns,
    ghostRuns,
    stickerCollection,
    selectedVehicleId: HAS_VEHICLE_OVERRIDE ? ACTIVE_VEHICLE_ID : storedVehicleId,
    audioEnabled: FORCE_MUTE ? false : audioRaw === null ? true : audioRaw === "1",
    debugEnabled: FORCE_DEBUG ? debugRaw === "1" : false,
    ghostEnabled: ghostEnabledRaw === null ? true : ghostEnabledRaw === "1",
    saveVersion,
  };

  if (saveVersion < CURRENT_SAVE_VERSION) {
    persistFullState(storage, snapshot);
  }

  return snapshot;
}

function persistFullState(storage, snapshot) {
  storage.setItem(STORAGE_SAVE_VERSION_KEY, String(CURRENT_SAVE_VERSION));
  storage.setItem(STORAGE_UNLOCK_KEY, String(snapshot.unlockedRoute));
  storage.setItem(STORAGE_BEST_KEY, JSON.stringify(snapshot.bestRuns));
  storage.setItem(STORAGE_GHOSTS_KEY, JSON.stringify(snapshot.ghostRuns || {}));
  storage.setItem(STORAGE_STICKERS_KEY, JSON.stringify(normalizeStickerCollection(snapshot.stickerCollection || {})));
  storage.setItem(STORAGE_VEHICLE_KEY, normalizeVehicleId(snapshot.selectedVehicleId));
  storage.setItem(STORAGE_AUDIO_KEY, snapshot.audioEnabled ? "1" : "0");
  storage.setItem(STORAGE_DEBUG_KEY, snapshot.debugEnabled ? "1" : "0");
  storage.setItem(STORAGE_GHOST_ENABLED_KEY, snapshot.ghostEnabled ? "1" : "0");
}

export function saveProgressData(storage, unlockedRoute, bestRuns, ghostRuns = {}, stickerCollection = {}, selectedVehicleId = ACTIVE_VEHICLE_ID) {
  storage.setItem(STORAGE_SAVE_VERSION_KEY, String(CURRENT_SAVE_VERSION));
  storage.setItem(STORAGE_UNLOCK_KEY, String(unlockedRoute));
  storage.setItem(STORAGE_BEST_KEY, JSON.stringify(bestRuns));
  storage.setItem(STORAGE_GHOSTS_KEY, JSON.stringify(normalizeGhostRuns(ghostRuns)));
  storage.setItem(STORAGE_STICKERS_KEY, JSON.stringify(normalizeStickerCollection(stickerCollection)));
  storage.setItem(STORAGE_VEHICLE_KEY, normalizeVehicleId(selectedVehicleId));
}

export function saveAudioPreference(storage, enabled) {
  storage.setItem(STORAGE_SAVE_VERSION_KEY, String(CURRENT_SAVE_VERSION));
  storage.setItem(STORAGE_AUDIO_KEY, enabled ? "1" : "0");
}

export function saveDebugPreference(storage, enabled) {
  storage.setItem(STORAGE_SAVE_VERSION_KEY, String(CURRENT_SAVE_VERSION));
  storage.setItem(STORAGE_DEBUG_KEY, enabled ? "1" : "0");
}

export function saveGhostData(storage, ghostRuns) {
  storage.setItem(STORAGE_SAVE_VERSION_KEY, String(CURRENT_SAVE_VERSION));
  storage.setItem(STORAGE_GHOSTS_KEY, JSON.stringify(normalizeGhostRuns(ghostRuns)));
}

export function saveGhostPreference(storage, enabled) {
  storage.setItem(STORAGE_SAVE_VERSION_KEY, String(CURRENT_SAVE_VERSION));
  storage.setItem(STORAGE_GHOST_ENABLED_KEY, enabled ? "1" : "0");
}

export function saveVehiclePreference(storage, vehicleId) {
  storage.setItem(STORAGE_SAVE_VERSION_KEY, String(CURRENT_SAVE_VERSION));
  storage.setItem(STORAGE_VEHICLE_KEY, normalizeVehicleId(vehicleId));
}
