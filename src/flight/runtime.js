export function createFlightRuntime(deps) {
  const {
    ROUTES,
    getActiveVehicle,
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
    spaceVisualRatio,
  } = deps;

  const ALTITUDE_ROUTE_DEFS = [
    {
      id: "low",
      label: "低空",
      title: "低空星線",
      reward: "貼海速度感",
      risk: "鳥群多，容錯低",
      color: "rgba(255, 214, 132, 0.9)",
      centerBase: 156,
      centerScale: 8,
      spread: 86,
      throttleMultiplier: 0.96,
      dragBias: 18,
      liftBias: 22,
      stallBias: -34,
      maxSpeedMultiplier: 0.95,
    },
    {
      id: "mid",
      label: "中空",
      title: "中空穩定帶",
      reward: "姿態最好控",
      risk: "速度最平均",
      color: "rgba(126, 222, 255, 0.9)",
      centerBase: 392,
      centerScale: 14,
      spread: 108,
      throttleMultiplier: 1,
      dragBias: 0,
      liftBias: 0,
      stallBias: 0,
      maxSpeedMultiplier: 1,
    },
    {
      id: "high",
      label: "高空",
      title: "高空噴流帶",
      reward: "速度最快",
      risk: "空氣稀薄，雷暴多",
      color: "rgba(197, 206, 255, 0.92)",
      centerBase: 820,
      centerScale: 26,
      spread: 132,
      throttleMultiplier: 1.12,
      dragBias: -8,
      liftBias: -32,
      stallBias: 88,
      maxSpeedMultiplier: 1.14,
    },
  ];

  function cameraX(flight) {
    return flight.worldX - flight.screenX;
  }

  function worldToScreenY(flight, altitude) {
    return gameCanvas.height * 0.5 - (altitude - flight.cameraAltitude);
  }

  function spaceAltitudeRatio(flight) {
    return spaceVisualRatio ? spaceVisualRatio(flight) : clamp((flight.cameraAltitude - 520) / 1100, 0, 1);
  }

  function horizonCurveOffset(screenX, spaceRatio) {
    const dx = (screenX - gameCanvas.width * 0.5) / Math.max(1, gameCanvas.width * 0.5);
    return dx * dx * 72 * spaceRatio;
  }

  function oceanSurfaceAt(worldX) {
    return Math.sin(worldX / 220) * 4 + Math.sin(worldX / 74) * 2;
  }

  function islandAltitudeAt(flight, worldX, centerX) {
    const distance = Math.abs(worldX - centerX);
    if (distance > flight.islandHalf) {
      return -Infinity;
    }
    if (distance <= flight.runwayHalf + 12) {
      return flight.runwayAltitude;
    }
    const t = (distance - (flight.runwayHalf + 12)) / Math.max(1, flight.islandHalf - flight.runwayHalf - 12);
    return lerp(flight.runwayAltitude, oceanSurfaceAt(worldX) + 5, smoothStep(t));
  }

  function groundAltitudeAt(flight, worldX) {
    return Math.max(
      oceanSurfaceAt(worldX),
      islandAltitudeAt(flight, worldX, 0),
      islandAltitudeAt(flight, worldX, flight.arrivalAirportX),
    );
  }

  function departureRunwayStart(flight) {
    return -flight.runwayHalf;
  }

  function departureRunwayEnd(flight) {
    return flight.runwayHalf;
  }

  function arrivalRunwayStart(flight) {
    return flight.arrivalAirportX - flight.runwayHalf;
  }

  function arrivalRunwayEnd(flight) {
    return flight.arrivalAirportX + flight.runwayHalf;
  }

  function routeProgress(flight) {
    const start = departureRunwayStart(flight);
    const end = arrivalRunwayStart(flight);
    return clamp((flight.worldX - start) / Math.max(1, end - start), 0, 1);
  }

  function setFlightPhase(flight, phase) {
    if (flight.phase !== phase) {
      flight.phase = phase;
      flight.phaseTime = 0;
    }
  }

  function runwayDeckAltitudeAt(flight, worldX, centerX) {
    return Math.abs(worldX - centerX) <= flight.runwayHalf ? flight.runwayAltitude : -Infinity;
  }

  function surfaceScreenY(flight, worldX, screenX) {
    const ratio = spaceAltitudeRatio(flight);
    const actual = worldToScreenY(flight, oceanSurfaceAt(worldX)) + horizonCurveOffset(screenX, ratio);
    const orbital = gameCanvas.height * (0.88 + ratio * 0.04) + horizonCurveOffset(screenX, Math.max(ratio, 0.18));
    return lerp(actual, orbital, smoothStep(ratio));
  }

  function nextFlightRandom(flight, min, max) {
    return min + flight.rng() * (max - min);
  }

  function nextCloudAltitude(rng) {
    if (rng() < 0.68) {
      return 540 + rng() * 360;
    }
    return 220 + rng() * 140;
  }

  function createClouds(count, palette, rng) {
    const clouds = [];
    for (let i = 0; i < count; i += 1) {
      clouds.push({
        x: -gameCanvas.width * 0.35 + rng() * (gameCanvas.width * 2.15),
        altitude: nextCloudAltitude(rng),
        r: 22 + rng() * 26,
        drift: -6 + rng() * 12,
        alpha: 0.18 + rng() * 0.18,
        mood: rng() * Math.PI * 2,
        tint: palette.cloud,
      });
    }
    return clouds;
  }

  function cloudSignature(clouds) {
    return clouds
      .slice(0, 3)
      .map((cloud) => `${Math.round(cloud.x * 10) / 10},${Math.round(cloud.altitude * 10) / 10},${Math.round(cloud.r * 10) / 10}`)
      .join("|");
  }

  function createFlightState(routeIndex) {
    const route = ROUTES[routeIndex];
    const vehicle = getActiveVehicle();
    const effects = {
      speedMultiplier: vehicle.effects?.speedMultiplier || 1,
      launchBoost: vehicle.effects?.launchBoost || 1,
      glideLift: vehicle.effects?.glideLift || 1,
      crashResistance: vehicle.effects?.crashResistance || 1,
      sunsetPreservation: vehicle.effects?.sunsetPreservation || 1,
      sunReserve: vehicle.effects?.sunReserve || 78,
    };
    const seed = routeIndex * 97 + 17;
    const rng = createSeededRng(seed);
    const screenX = gameCanvas.width * 0.2;
    const runwayAltitude = 34;
    const runwayHalf = 1500;
    const planeBottomOffset = 18;
    const altitude = runwayAltitude + planeBottomOffset;
    const arrivalAirportX = route.distance + 5200 + route.difficulty * 420;
    const clouds = createClouds(9, route.palette, rng);
    const baseFuel = (120 + route.difficulty * 18 + route.estimatedGameMinutes * 60 * 0.92) * (vehicle.fuelCapacityMultiplier || 1);
    return {
      routeIndex,
      seed,
      rng,
      screenX,
      worldX: -runwayHalf + 34,
      routeDistance: route.distance,
      arrivalAirportX,
      descentStartProgress: 0.56,
      approachStartProgress: 0.76,
      speed: 0,
      throttle: 0.82,
      throttleTarget: 0.82,
      minSpeed: 0,
      minAirSpeed: vehicle.minAirSpeed,
      maxSpeed: vehicle.maxSpeed * effects.speedMultiplier,
      altitude,
      cameraAltitude: altitude + gameCanvas.height * 0.12,
      vy: 0,
      pitch: 0,
      shake: 0,
      propeller: 0,
      elapsed: 0,
      maxSun: effects.sunReserve,
      sun: effects.sunReserve,
      maxFuel: baseFuel,
      fuel: baseFuel,
      peakAltitude: altitude,
      engineOut: false,
      hadEngineOut: false,
      lowFuelWarning: false,
      hits: 0,
      phase: "takeoff_roll",
      phaseTime: 0,
      grounded: true,
      runwayState: "departure",
      runwayAltitude,
      runwayHalf,
      islandHalf: 1880,
      planeBottomOffset,
      rotateSpeed: vehicle.rotateSpeed * effects.launchBoost,
      takeoffSpeed: vehicle.takeoffSpeed * effects.launchBoost,
      stallSpeed: vehicle.stallSpeed,
      landingBounceSink: 190,
      landingCrashSink: 320,
      landingMaxTouchdownSpeed: vehicle.landingMaxTouchdownSpeed,
      landingSafePitch: 0.24,
      landingCrashPitch: 0.34,
      flareStartDistance: 760,
      flareHeight: 144,
      gearDeployDistance: 1880,
      rolloutStopSpeed: 22,
      takeoffAccel: vehicle.takeoffAccel * effects.launchBoost,
      rollBrake: vehicle.rollBrake,
      landingBrakeBonus: vehicle.landingBrakeBonus,
      flaps: 1,
      airbrakeDrag: 0,
      flapLift: 0,
      groundBounce: 0,
      groundBounceVelocity: 0,
      bounceCount: 0,
      touchdownRating: "",
      touchdownSpeed: 0,
      touchdownSinkRate: 0,
      spoilers: 0,
      touchdownFlash: 0,
      takeoffFlash: 0,
      touchdownBloom: 0,
      rolloutRibbon: 0,
      rolloutSmokeCooldown: 0,
      touchdownFx: [],
      runwayMarks: [],
      actors: [],
      altitudeBand: "low",
      altitudeBandTime: {
        low: 0,
        mid: 0,
        high: 0,
      },
      clouds,
      initialCloudSignature: cloudSignature(clouds),
      spawnCursor: runwayHalf + 320,
      vehicleId: vehicle.id,
      vehicleName: vehicle.label,
      vehicleBadge: vehicle.badge,
      vehicleStyle: vehicle.style,
      vehicleAccent: vehicle.accent,
      vehicleStripe: vehicle.stripe,
      vehicleCanopy: vehicle.canopy,
      vehicleBlurb: vehicle.blurb,
      performanceProfile: vehicle.profileTag,
      orbitCueZone: "atmosphere",
      orbitMessage: "",
      orbitMessageTimer: 0,
      orbitPulse: 0,
      orbitChallengeReached: false,
      orbitStickerEarned: false,
      effects,
    };
  }

  function getTouchdownRating(flight, sinkRate, speed, bounced = false) {
    if (bounced) {
      return "彈跳接地";
    }
    if (sinkRate <= 92 && speed <= flight.landingMaxTouchdownSpeed * 0.82) {
      return "奶油般接地";
    }
    if (sinkRate <= 148 && speed <= flight.landingMaxTouchdownSpeed * 0.93) {
      return "穩定接地";
    }
    return "重手接地";
  }

  function addRunwayMark(flight, worldX, width, alpha) {
    flight.runwayMarks.push({ x: worldX, width, alpha });
    if (flight.runwayMarks.length > 36) {
      flight.runwayMarks.shift();
    }
  }

  function emitTouchdownEffects(flight, sinkRate, mode = "touchdown") {
    const burst = mode === "rollout" ? 2 : mode === "bounce" ? 5 : 7;
    for (let i = 0; i < burst; i += 1) {
      const life = nextFlightRandom(flight, 0.18, mode === "rollout" ? 0.34 : 0.46);
      const isSpark = mode !== "rollout" && i < Math.ceil(burst * 0.4);
      flight.touchdownFx.push({
        x: flight.worldX + nextFlightRandom(flight, -16, 10),
        altitude: flight.runwayAltitude + nextFlightRandom(flight, 2, 9),
        vx: nextFlightRandom(flight, -26, 18),
        vy: isSpark ? nextFlightRandom(flight, 40, 92) : nextFlightRandom(flight, 18, 44),
        size: (isSpark ? nextFlightRandom(flight, 7, 12) : nextFlightRandom(flight, 12, 22)) + sinkRate * (isSpark ? 0.02 : 0.03),
        life,
        maxLife: life,
        mode: isSpark ? "spark" : "smoke",
      });
    }
    if (flight.touchdownFx.length > 80) {
      flight.touchdownFx.splice(0, flight.touchdownFx.length - 80);
    }
  }

  function updateLandingEffects(flight, dt) {
    flight.touchdownFlash = Math.max(0, flight.touchdownFlash - dt * 1.9);
    flight.takeoffFlash = Math.max(0, flight.takeoffFlash - dt * 1.3);
    flight.touchdownBloom = Math.max(0, flight.touchdownBloom - dt * 1.15);
    flight.rolloutRibbon = Math.max(0, flight.rolloutRibbon - dt * 0.42);
    flight.spoilers = Math.max(0, flight.spoilers - dt * 0.5);
    flight.touchdownFx = flight.touchdownFx.filter((effect) => {
      effect.life -= dt;
      effect.x += effect.vx * dt;
      effect.altitude += effect.vy * dt;
      effect.vy += (effect.mode === "spark" ? -180 : 32) * dt;
      effect.size += (effect.mode === "spark" ? -4 : 16) * dt;
      return effect.life > 0 && effect.size > 0;
    });
  }

  function pointInEllipse(px, py, cx, cy, rx, ry) {
    const dx = (px - cx) / rx;
    const dy = (py - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }

  function altitudeRouteCenter(flight, routeDef) {
    return routeDef.centerBase + ROUTES[flight.routeIndex].difficulty * routeDef.centerScale;
  }

  function getAltitudeRouteBands(flight) {
    return ALTITUDE_ROUTE_DEFS.map((routeDef) => ({
      ...routeDef,
      center: altitudeRouteCenter(flight, routeDef),
    }));
  }

  function getAltitudeBandState(flight, altitude = flight.altitude) {
    const altitudeAboveSea = altitude - oceanSurfaceAt(flight.worldX);
    const bands = getAltitudeRouteBands(flight);
    const lowMax = bands[0].center + bands[0].spread;
    const midMax = bands[1].center + bands[1].spread;
    let active = bands[1];
    if (altitudeAboveSea <= lowMax) {
      active = bands[0];
    } else if (altitudeAboveSea > midMax) {
      active = bands[2];
    }
    return {
      ...active,
      altitudeAboveSea,
    };
  }

  function spawnBandActors(flight, slot, x, band) {
    const route = ROUTES[flight.routeIndex];
    const lane = Math.max(
      82,
      altitudeRouteCenter(flight, band) + (hash1(slot * 5.7 + band.centerBase * 0.01, flight.seed + 11) - 0.5) * band.spread,
    );
    const roll = hash1(slot * 9.3 + band.centerBase * 0.001, flight.seed + 31);
    const variant = hash1(slot * 3.7 + band.centerScale, flight.seed + 47);
    if (band.id === "low") {
      if (roll < 0.34) {
        flight.actors.push({
          type: "bird",
          band: band.id,
          x,
          altitude: lane,
          r: 17 + variant * 4,
          phase: hash1(slot * 4.1, flight.seed + 59) * Math.PI * 2,
          damage: 8 + route.difficulty * 1.5,
          collected: false,
        });
        return;
      }
      if (roll < 0.52) {
        flight.actors.push({
          type: "storm",
          band: band.id,
          x,
          altitude: lane,
          r: 20 + variant * 8,
          phase: hash1(slot * 4.8, flight.seed + 51) * Math.PI * 2,
          damage: 8 + route.difficulty * 1.7,
          collected: false,
        });
        return;
      }
      return;
    }

    if (band.id === "mid") {
      if (roll < 0.22) {
        flight.actors.push({
          type: "bird",
          band: band.id,
          x,
          altitude: lane,
          r: 18 + variant * 4,
          phase: hash1(slot * 6.2, flight.seed + 53) * Math.PI * 2,
          damage: 8 + route.difficulty * 1.4,
          collected: false,
        });
        return;
      }
      if (roll < 0.38) {
        flight.actors.push({
          type: "storm",
          band: band.id,
          x,
          altitude: lane,
          r: 24 + variant * 10,
          phase: hash1(slot * 5.4, flight.seed + 41) * Math.PI * 2,
          damage: 10 + route.difficulty * 1.8,
          collected: false,
        });
        return;
      }
      if (roll < 0.54) {
        flight.actors.push({
          type: "jetstream",
          band: band.id,
          x,
          altitude: lane,
          rx: 72,
          ry: 28,
          speedBonus: 96 + variant * 22,
          lift: 10 + variant * 6,
          collected: false,
        });
        return;
      }
      return;
    }

    if (roll < 0.28) {
      flight.actors.push({
        type: "jetstream",
        band: band.id,
        x,
        altitude: lane,
        rx: 92,
        ry: 36,
        speedBonus: 148 + variant * 34,
        lift: 18 + variant * 10,
        collected: false,
      });
      return;
    }
    if (roll < 0.54) {
      flight.actors.push({
        type: "storm",
        band: band.id,
        x,
        altitude: lane,
        r: 30 + variant * 12,
        phase: hash1(slot * 4.1, flight.seed + 59) * Math.PI * 2,
        damage: 13 + route.difficulty * 2.2,
        collected: false,
      });
      return;
    }
  }

  function ensureActorsAhead(flight) {
    const horizon = Math.min(arrivalRunwayStart(flight) - 260, flight.worldX + gameCanvas.width + 2100);
    while (flight.spawnCursor < horizon) {
      const slot = Math.floor(flight.spawnCursor / 760);
      const x = flight.spawnCursor + 260 + hash1(slot * 4.7, flight.seed) * 140;
      ALTITUDE_ROUTE_DEFS.forEach((band, index) => {
        const laneX = x + (index - 1) * 18 + (hash1(slot * (6.1 + index), flight.seed + 91 + index * 7) - 0.5) * 18;
        spawnBandActors(flight, slot * 3 + index, laneX, band);
      });
      flight.spawnCursor = x + 520 + hash1(slot * 8.2, flight.seed + 73) * 360;
    }
    flight.actors = flight.actors.filter((actor) => actor.x > flight.worldX - 380 && !actor.collected);
  }

  function collectActors(flight) {
    const planeWorldX = flight.worldX;
    flight.actors.forEach((actor) => {
      if (actor.collected) {
        return;
      }
      if (actor.type === "jetstream") {
        if (pointInEllipse(planeWorldX, flight.altitude, actor.x, actor.altitude, actor.rx, actor.ry)) {
          actor.collected = true;
          flight.speed = Math.min(flight.maxSpeed * 1.18, flight.speed + actor.speedBonus);
          flight.vy += actor.lift;
          flight.sun = Math.min(flight.maxSun, flight.sun + 2.4);
          playSfx("jetstream");
        }
        return;
      }
      if (Math.hypot(actor.x - planeWorldX, actor.altitude - flight.altitude) <= actor.r + 18) {
        actor.collected = true;
        flight.hits += 1;
        flight.sun -= actor.damage / flight.effects.crashResistance;
        flight.speed *= 0.9;
        flight.shake = 0.66;
        playSfx("hit");
      }
    });
  }

  function updateClouds(flight, dt) {
    const route = ROUTES[flight.routeIndex];
    const leftBound = flight.worldX - gameCanvas.width * 0.6;
    const rightBound = flight.worldX + gameCanvas.width * 1.8;
    flight.clouds.forEach((cloud) => {
      cloud.x += cloud.drift * dt;
      cloud.mood += dt * 1.2;
      if (cloud.x < leftBound - 280) {
        cloud.x = rightBound + nextFlightRandom(flight, 100, 320);
        cloud.altitude = nextCloudAltitude(flight.rng);
        cloud.r = nextFlightRandom(flight, 22, 48);
        cloud.tint = route.palette.cloud;
      }
    });
  }

  function beginLandingRoll(flight, sinkRate) {
    const touchdownSpeed = flight.speed;
    flight.grounded = true;
    flight.runwayState = "arrival";
    setFlightPhase(flight, "landing_roll");
    flight.throttleTarget = flight.engineOut ? 0.18 : 0.22;
    flight.altitude = flight.runwayAltitude + flight.planeBottomOffset;
    flight.vy = 0;
    flight.touchdownSinkRate = sinkRate;
    flight.touchdownSpeed = touchdownSpeed;
    flight.touchdownRating = getTouchdownRating(flight, sinkRate, touchdownSpeed);
    flight.spoilers = 1;
    flight.touchdownFlash = 0.34;
    flight.touchdownBloom = 1;
    flight.rolloutRibbon = 1;
    flight.groundBounce = clamp(sinkRate * 0.05, 0, 10);
    flight.groundBounceVelocity = -sinkRate * 0.18;
    flight.speed *= clamp(0.97 - sinkRate / 1400, 0.82, 0.97);
    flight.pitch = lerp(flight.pitch, 0.02, 0.45);
    flight.shake = Math.max(flight.shake, clamp(sinkRate / 260, 0.12, 0.5));
    addRunwayMark(flight, flight.worldX - 12, 26 + sinkRate * 0.08, 0.2 + sinkRate * 0.0005);
    emitTouchdownEffects(flight, sinkRate, "touchdown");
    playSfx("touchdown");
    playSfx("rollout");
  }

  function handleArrivalTouchdown(flight) {
    const sinkRate = Math.max(0, -flight.vy);
    const tooFast = flight.speed > flight.landingMaxTouchdownSpeed;
    const noseHeavy = flight.pitch > flight.landingCrashPitch;
    if (sinkRate > flight.landingCrashSink || tooFast || noseHeavy) {
      flight.touchdownSinkRate = sinkRate;
      flight.touchdownSpeed = flight.speed;
      flight.touchdownRating = "重落失控";
      finishFlight("crash");
      return;
    }
    if (sinkRate > flight.landingBounceSink && flight.bounceCount < 2) {
      flight.altitude = flight.runwayAltitude + flight.planeBottomOffset + 2;
      flight.vy = sinkRate * 0.42;
      flight.speed *= 0.97;
      flight.pitch = lerp(flight.pitch, -0.08, 0.45);
      flight.bounceCount += 1;
      flight.touchdownSinkRate = sinkRate;
      flight.touchdownSpeed = flight.speed;
      flight.touchdownRating = getTouchdownRating(flight, sinkRate, flight.speed, true);
      flight.touchdownFlash = 0.22;
      flight.shake = Math.max(flight.shake, 0.32);
      addRunwayMark(flight, flight.worldX - 10, 18 + sinkRate * 0.06, 0.16 + sinkRate * 0.0005);
      emitTouchdownEffects(flight, sinkRate, "bounce");
      playSfx("bounce");
      return;
    }
    beginLandingRoll(flight, sinkRate);
  }

  function updateTakeoffRoll(flight, dt) {
    const engineThrottle = flight.engineOut ? 0 : flight.throttle;
    const accel = lerp(0, flight.takeoffAccel, engineThrottle) + (state.input.right && !flight.engineOut ? 120 : 0);
    const drag = 20 + flight.speed * (0.018 + flight.flapLift * 0.008) + flight.airbrakeDrag * (180 + flight.speed * 0.04);
    flight.speed = Math.max(0, flight.speed + (accel - drag) * dt);
    flight.worldX += flight.speed * dt;
    flight.altitude = flight.runwayAltitude + flight.planeBottomOffset;
    flight.vy = 0;
    flight.pitch = lerp(flight.pitch, state.input.up ? -0.24 - flight.flapLift * 0.02 : 0.02, 0.12);
    flight.cameraAltitude = lerp(flight.cameraAltitude, flight.altitude + gameCanvas.height * 0.12, 0.08);
    if (state.input.up && flight.speed >= currentTakeoffSpeed(flight)) {
      flight.grounded = false;
      flight.runwayState = null;
      setFlightPhase(flight, "climbout");
      flight.altitude += 2;
      flight.vy = 120 + Math.max(0, flight.speed - currentTakeoffSpeed(flight)) * 0.12 + flight.flapLift * 18;
      flight.takeoffFlash = 1;
      playSfx("perfect");
      return;
    }
    if (flight.worldX > departureRunwayEnd(flight) - 4) {
      finishFlight("takeoff_overrun");
    }
  }

  function updateAirborneFlight(flight, dt) {
    const progress = routeProgress(flight);
    if (flight.phase === "climbout" && progress > 0.06) {
      setFlightPhase(flight, "cruise");
    } else if (flight.phase !== "climbout" && progress >= flight.approachStartProgress) {
      setFlightPhase(flight, "approach");
    } else if (flight.phase !== "climbout" && progress >= flight.descentStartProgress && flight.phase !== "approach") {
      setFlightPhase(flight, "descent");
    }

    const landingAssist = landingAssistState(flight);
    const altitudeBand = getAltitudeBandState(flight);
    flight.altitudeBand = altitudeBand.id;
    const dynamicStallSpeed = currentStallSpeed(flight) + altitudeBand.stallBias;
    const engineThrottle = flight.engineOut ? 0 : flight.throttle;
    const throttlePush = lerp(-58, 420 * flight.effects.speedMultiplier * altitudeBand.throttleMultiplier, engineThrottle);
    const baseDrag = (flight.phase === "approach" ? 62 : flight.phase === "descent" ? 42 : 24) + altitudeBand.dragBias + flight.speed * 0.028;
    const flapDrag = flight.flapLift * (34 + flight.speed * 0.018);
    const airbrakeDrag = flight.airbrakeDrag * (240 + flight.speed * 0.1);
    flight.speed += (throttlePush - baseDrag - flapDrag - airbrakeDrag) * dt;

    const stallPenalty = Math.max(0, dynamicStallSpeed - flight.speed) * 0.34;
    const sink = -176 - stallPenalty - flight.airbrakeDrag * 52 + altitudeBand.liftBias;
    const climb = state.input.up ? 348 : 0;
    const dive = state.input.down ? (altitudeBand.id === "high" ? -462 : altitudeBand.id === "mid" ? -428 : -398) : 0;
    const speedLift = Math.max(0, flight.speed - dynamicStallSpeed) * 0.062 * flight.effects.glideLift;
    const flapLiftBonus = flight.flapLift * clamp((flight.speed - dynamicStallSpeed) * 0.09, 0, 104);
    const climboutBonus = flight.phase === "climbout" ? 54 : 0;
    const descentDamping = flight.phase === "descent" ? -10 : 0;
    const approachDamping = flight.phase === "approach" ? -18 : 0;
    const flareAssist = landingAssist.flareWindow ? 74 : 0;

    flight.vy += (sink + climb + dive + speedLift + flapLiftBonus + climboutBonus + descentDamping + approachDamping + flareAssist) * dt;
    flight.vy *= 0.988;
    flight.altitude += flight.vy * dt;

    if (state.input.down) {
      flight.speed += 240 * flight.effects.speedMultiplier * dt;
    }
    if (state.input.up && flight.phase !== "climbout") {
      flight.speed -= 36 * dt;
    }
    if (flight.phase === "descent") {
      flight.speed -= 28 * dt;
    }
    if (landingAssist.flareWindow) {
      flight.speed -= 52 * dt;
    }

    flight.speed = clamp(
      flight.speed,
      Math.max(760, flight.minAirSpeed - flight.flapLift * 90 + altitudeBand.stallBias * 0.2),
      flight.maxSpeed * altitudeBand.maxSpeedMultiplier,
    );
    flight.worldX += flight.speed * dt;
    const pitchTarget = landingAssist.flareWindow
      ? clamp(-flight.vy / 640 - 0.04 - flight.airbrakeDrag * 0.03, -0.24, 0.18)
      : clamp(-flight.vy / 520 - flight.airbrakeDrag * 0.04 - flight.flapLift * 0.02, -0.42, 0.34);
    flight.pitch = lerp(flight.pitch, pitchTarget, 0.12);
    const cameraTarget = Math.max(120, flight.altitude - gameCanvas.height * 0.04 + clamp(-flight.vy * 0.05, -30, 60));
    flight.cameraAltitude = lerp(flight.cameraAltitude, cameraTarget, 0.08);
    flight.altitudeBandTime[altitudeBand.id] += dt;
  }

  function updateLandingRoll(flight, dt) {
    flight.spoilers = lerp(flight.spoilers, 1, 0.18);
    const brake = flight.rollBrake + flight.landingBrakeBonus + flight.speed * 0.07 + flight.airbrakeDrag * 120 + (state.input.left ? 52 : 0) + (state.input.up ? 12 : 0);
    flight.speed = Math.max(0, flight.speed - brake * dt);
    flight.worldX += flight.speed * dt;

    flight.groundBounceVelocity += (-flight.groundBounce * 28 - flight.groundBounceVelocity * 8) * dt;
    flight.groundBounce += flight.groundBounceVelocity * dt;
    if (flight.groundBounce < 0) {
      flight.groundBounce = Math.abs(flight.groundBounce) * 0.24;
      flight.groundBounceVelocity = Math.abs(flight.groundBounceVelocity) * 0.2;
    }
    if (flight.groundBounce < 0.06 && Math.abs(flight.groundBounceVelocity) < 0.8) {
      flight.groundBounce = 0;
      flight.groundBounceVelocity = 0;
    }

    flight.altitude = flight.runwayAltitude + flight.planeBottomOffset + flight.groundBounce;
    flight.vy = 0;
    flight.pitch = lerp(flight.pitch, state.input.up ? -0.05 : 0.02, 0.12);
    flight.cameraAltitude = lerp(flight.cameraAltitude, flight.altitude + gameCanvas.height * 0.12, 0.08);
    flight.rolloutSmokeCooldown -= dt;
    if (flight.speed > 180 && flight.rolloutSmokeCooldown <= 0) {
      addRunwayMark(flight, flight.worldX - 8, 12 + flight.speed * 0.012, 0.08 + Math.min(0.14, flight.speed / 12000));
      emitTouchdownEffects(flight, flight.speed * 0.04, "rollout");
      flight.rolloutSmokeCooldown = clamp(0.12 - flight.speed / 10000, 0.04, 0.12);
    }

    if (flight.speed <= flight.rolloutStopSpeed) {
      finishFlight("arrived");
      return;
    }
    if (flight.worldX > arrivalRunwayEnd(flight)) {
      finishFlight("landing_overrun");
    }
  }

  function updateFlight(dt) {
    const flight = state.flight;
    if (!flight) {
      return;
    }
    const route = ROUTES[flight.routeIndex];

    flight.elapsed += dt;
    flight.phaseTime += dt;
    flight.propeller += dt * (18 + flight.speed * 0.06);
    flight.shake = Math.max(0, flight.shake - dt * 1.8);
    flight.sun = Math.max(0, flight.sun - (route.sunsetDrain / flight.effects.sunsetPreservation) * dt);
    flight.peakAltitude = Math.max(flight.peakAltitude || 0, flight.altitude);

    const fuelBand = getAltitudeBandState(flight);
    let fuelDrainRate = 0;
    if (!flight.engineOut) {
      if (flight.grounded && flight.runwayState === "departure") {
        fuelDrainRate = 1.45 + flight.throttleTarget * 1.15 + flight.flapLift * 0.24;
      } else if (flight.grounded && flight.runwayState === "arrival") {
        fuelDrainRate = 0.28 + flight.throttleTarget * 0.2;
      } else {
        const bandBias = fuelBand.id === "high" ? 0.42 : fuelBand.id === "low" ? 0.12 : 0;
        const phaseBias = flight.phase === "approach" ? 0.18 : flight.phase === "descent" ? 0.08 : 0;
        fuelDrainRate = 0.42 + flight.throttleTarget * 1.45 + flight.flapLift * 0.22 + flight.airbrakeDrag * 0.1 + bandBias + phaseBias;
      }
      flight.fuel = Math.max(0, flight.fuel - fuelDrainRate * dt);
    }
    if (flight.fuel <= 0.01) {
      flight.fuel = 0;
      flight.engineOut = true;
      flight.hadEngineOut = true;
    }
    flight.lowFuelWarning = flight.fuel > 0 && flight.fuel <= flight.maxFuel * 0.18;

    updateLandingEffects(flight, dt);
    updateFlightSystems(flight, dt);
    if (flight.grounded && flight.runwayState === "departure") {
      updateTakeoffRoll(flight, dt);
    } else if (flight.grounded && flight.runwayState === "arrival") {
      updateLandingRoll(flight, dt);
    } else {
      updateAirborneFlight(flight, dt);
    }

    if (state.flight !== flight) {
      return;
    }

    flight.altitudeBand = getAltitudeBandState(flight).id;

    flight.actors.forEach((actor) => {
      if (actor.type === "bird" || actor.type === "storm") {
        actor.phase += dt * (actor.type === "bird" ? 6 : 2.5);
        actor.altitude += Math.sin(actor.phase) * (actor.type === "bird" ? 18 : 10) * dt;
      }
    });

    ensureActorsAhead(flight);
    collectActors(flight);
    updateClouds(flight, dt);
    updateHud();

    const planeBottom = flight.altitude - flight.planeBottomOffset;
    const destinationDeck = runwayDeckAltitudeAt(flight, flight.worldX, flight.arrivalAirportX);
    if (!flight.grounded && destinationDeck > -Infinity && planeBottom <= destinationDeck + 6) {
      handleArrivalTouchdown(flight);
      return;
    }

    if (!flight.grounded && planeBottom <= groundAltitudeAt(flight, flight.worldX)) {
      finishFlight("crash");
      return;
    }

    if (!flight.grounded && flight.worldX > arrivalRunwayEnd(flight) + 40) {
      finishFlight("missed");
    }
  }

  return {
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
  };
}
