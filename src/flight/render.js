export function createFlightRenderer(deps) {
  const {
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
    getState,
  } = deps;

  function drawStar(ctx, x, y, radius, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? radius : radius * 0.45;
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawCloud(ctx, cloud, tint) {
    ctx.save();
    ctx.fillStyle = tint;
    ctx.globalAlpha = cloud.alpha;
    ctx.beginPath();
    ctx.arc(cloud.x - cloud.r * 0.45, cloud.y, cloud.r * 0.72, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.r * 0.1, cloud.y - cloud.r * 0.2, cloud.r * 0.82, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.r * 0.62, cloud.y + cloud.r * 0.06, cloud.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = cloud.alpha * 0.64;
    ctx.strokeStyle = "#708093";
    ctx.lineWidth = Math.max(1, cloud.r * 0.055);
    ctx.beginPath();
    ctx.arc(cloud.x - cloud.r * 0.18, cloud.y + cloud.r * 0.08, cloud.r * 0.04, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.r * 0.18, cloud.y + cloud.r * 0.08, cloud.r * 0.04, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y + cloud.r * 0.2, cloud.r * 0.18, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function drawDraft(ctx, x, y, rx, ry, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 18 - 8, ry * 0.6);
      ctx.quadraticCurveTo(i * 18 + 4, 0, i * 18 - 4, -ry * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawJetstream(ctx, x, y, rx, ry, color) {
    ctx.save();
    ctx.translate(x, y);
    const gradient = ctx.createLinearGradient(-rx, 0, rx, 0);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.28, color);
    gradient.addColorStop(0.72, "rgba(255,255,255,0.86)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.lineWidth = 2.4;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-rx * 0.72, i * 10);
      ctx.bezierCurveTo(-rx * 0.18, i * 12, rx * 0.12, i * 4, rx * 0.72, i * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFuelPickup(ctx, x, y, radius, elapsed = 0) {
    const bob = Math.sin(elapsed * 3.6 + x * 0.01) * 2.4;
    const glow = 0.24 + Math.sin(elapsed * 5 + x * 0.02) * 0.04;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(-0.08);

    ctx.fillStyle = `rgba(255, 241, 180, ${glow})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.7, radius * 1.36, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyGradient = ctx.createLinearGradient(-radius, -radius, radius, radius);
    bodyGradient.addColorStop(0, "#fff8d1");
    bodyGradient.addColorStop(0.55, "#ffd071");
    bodyGradient.addColorStop(1, "#ffaf58");
    drawRoundRectPath(ctx, -radius * 0.78, -radius * 0.92, radius * 1.56, radius * 1.88, radius * 0.42);
    ctx.fillStyle = bodyGradient;
    ctx.fill();

    ctx.strokeStyle = "rgba(41, 72, 95, 0.34)";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawRoundRectPath(ctx, -radius * 0.5, -radius * 1.18, radius, radius * 0.36, radius * 0.14);
    ctx.fillStyle = "#f7f2de";
    ctx.fill();

    ctx.fillStyle = "#29485f";
    ctx.beginPath();
    ctx.moveTo(-radius * 0.14, -radius * 0.22);
    ctx.lineTo(radius * 0.22, -radius * 0.22);
    ctx.lineTo(radius * 0.04, radius * 0.12);
    ctx.lineTo(radius * 0.28, radius * 0.12);
    ctx.lineTo(-radius * 0.06, radius * 0.54);
    ctx.lineTo(radius * 0.06, radius * 0.18);
    ctx.lineTo(-radius * 0.18, radius * 0.18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.beginPath();
    ctx.arc(-radius * 0.24, -radius * 0.3, radius * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawPlane(ctx, x, y, pitch, propeller, palette, details = {}) {
    const tilt = clamp(pitch, -0.45, 0.45);
    const gearDown = Boolean(details.gearDown);
    const spoilers = clamp(details.spoilers || 0, 0, 1);
    const landingLight = clamp(details.landingLight || 0, 0, 1);
    const flaps = clamp(details.flaps || 0, 0, 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    if (landingLight > 0.02) {
      const lightGradient = ctx.createLinearGradient(24, 0, 120, 0);
      lightGradient.addColorStop(0, `rgba(255, 250, 228, ${landingLight * 0.34})`);
      lightGradient.addColorStop(1, "rgba(255, 250, 228, 0)");
      ctx.fillStyle = lightGradient;
      ctx.beginPath();
      ctx.moveTo(24, -4);
      ctx.lineTo(126, -18);
      ctx.lineTo(126, 18);
      ctx.lineTo(24, 4);
      ctx.closePath();
      ctx.fill();
    }

    if (gearDown) {
      ctx.strokeStyle = "#24445f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-2, 10);
      ctx.lineTo(-10, 24);
      ctx.moveTo(20, 9);
      ctx.lineTo(26, 22);
      ctx.moveTo(34, 2);
      ctx.lineTo(38, 15);
      ctx.stroke();
      ctx.fillStyle = "#2a4058";
      ctx.beginPath();
      ctx.arc(-11, 26, 5.5, 0, Math.PI * 2);
      ctx.arc(27, 24, 5.5, 0, Math.PI * 2);
      ctx.arc(39, 17, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.ellipse(0, 0, 42, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff7eb";
    ctx.beginPath();
    ctx.ellipse(8, -1, 23, 10.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(12, -1, 6.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#24445f";
    ctx.beginPath();
    ctx.arc(13.5, -1.2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#24445f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(6, 4.2, 7.5, 0.18 * Math.PI, 0.86 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-40, 15);
    ctx.lineTo(14, 8);
    ctx.closePath();
    ctx.fill();

    if (flaps > 0.04) {
      ctx.fillStyle = blendHex("#dce7ef", "#f7fbff", 0.3);
      ctx.beginPath();
      ctx.moveTo(-24, 10);
      ctx.lineTo(-38, 18 + flaps * 4);
      ctx.lineTo(-16, 12);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(4, 5);
      ctx.lineTo(-4, 11 + flaps * 3);
      ctx.lineTo(11, 9);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = blendHex(palette.hillFront, "#ffffff", 0.36);
    ctx.beginPath();
    ctx.moveTo(-23, -4);
    ctx.lineTo(-42, -20);
    ctx.lineTo(-13, -8);
    ctx.closePath();
    ctx.fill();

    if (spoilers > 0.02) {
      ctx.fillStyle = `rgba(36, 68, 95, ${0.36 + spoilers * 0.34})`;
      ctx.beginPath();
      ctx.moveTo(-15, -8);
      ctx.lineTo(-7, -15 - spoilers * 4);
      ctx.lineTo(-3, -7);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-28, 7);
      ctx.lineTo(-22, 1 - spoilers * 3);
      ctx.lineTo(-16, 8);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = blendHex(palette.ground, "#29485f", 0.45);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.lineTo(-52, 0);
    ctx.stroke();

    ctx.save();
    ctx.translate(44, 0);
    ctx.rotate(propeller);
    ctx.strokeStyle = "rgba(255,255,255,0.88)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 12);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = palette.ground;
    ctx.beginPath();
    ctx.arc(44, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function sampleGhostPlayback(playback, elapsed) {
    if (!playback?.samples?.length) {
      return null;
    }
    const samples = playback.samples;
    const clampedTime = clamp(elapsed, 0, playback.time || samples[samples.length - 1][0] || 0);
    let index = clamp(playback.cursor || 0, 0, Math.max(0, samples.length - 2));
    while (index < samples.length - 2 && samples[index + 1][0] < clampedTime) {
      index += 1;
    }
    while (index > 0 && samples[index][0] > clampedTime) {
      index -= 1;
    }
    playback.cursor = index;
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

  function drawGhostPlane(ctx, flight, palette, spaceRatio) {
    if (!getState().ghostEnabled) {
      return;
    }
    const ghost = sampleGhostPlayback(flight.ghostPlayback, flight.elapsed);
    if (!ghost) {
      return;
    }
    const x = ghost.worldX - cameraX(flight);
    const y = worldToScreenY(flight, ghost.altitude);
    if (x < -180 || x > gameCanvas.width + 180 || y < -180 || y > gameCanvas.height + 180) {
      return;
    }
    const ghostPalette = {
      ...palette,
      accent: blendHex(palette.accent, "#dff5ff", 0.64),
      ground: blendHex(palette.ground, "#6d94b8", 0.58),
      hillFront: blendHex(palette.hillFront, "#cfe8ff", 0.52),
    };
    ctx.save();
    ctx.globalAlpha = 0.28 + (1 - spaceRatio) * 0.1;
    ctx.fillStyle = "rgba(215, 241, 255, 0.18)";
    ctx.beginPath();
    ctx.ellipse(x, y, 56, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    drawPlane(ctx, x, y, ghost.pitch, 0, ghostPalette, {
      gearDown: ghost.grounded,
      spoilers: ghost.grounded ? 0.3 : 0,
      landingLight: 0,
      flaps: 0,
    });
    ctx.restore();
  }

  function drawRunwayMarks(ctx, flight) {
    if (!flight.runwayMarks.length) {
      return;
    }
    const camX = cameraX(flight);
    const ratio = spaceAltitudeRatio(flight);
    ctx.save();
    flight.runwayMarks.forEach((mark) => {
      const x = mark.x - camX;
      if (x < -80 || x > gameCanvas.width + 80) {
        return;
      }
      const deckAltitude = runwayDeckAltitudeAt(flight, mark.x, flight.arrivalAirportX);
      if (deckAltitude === -Infinity) {
        return;
      }
      const y = worldToScreenY(flight, deckAltitude) + horizonCurveOffset(x, ratio);
      ctx.fillStyle = `rgba(42, 48, 64, ${mark.alpha})`;
      ctx.fillRect(x - mark.width * 0.5, y + 8, mark.width, 3);
    });
    ctx.restore();
  }

  function drawTouchdownEffects(ctx, flight) {
    if (!flight.touchdownFx.length) {
      return;
    }
    const camX = cameraX(flight);
    const ratio = spaceAltitudeRatio(flight);
    ctx.save();
    flight.touchdownFx.forEach((effect) => {
      const x = effect.x - camX;
      const y = worldToScreenY(flight, effect.altitude) + horizonCurveOffset(x, ratio);
      const alpha = clamp(effect.life / effect.maxLife, 0, 1);
      if (effect.mode === "spark") {
        ctx.strokeStyle = `rgba(255, 231, 183, ${alpha * 0.9})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + effect.size * 0.7, y - effect.size * 0.24);
        ctx.stroke();
        return;
      }
      ctx.fillStyle = `rgba(245, 248, 255, ${alpha * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(x, y, effect.size, effect.size * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawHazard(ctx, actor) {
    if (actor.type === "storm") {
      ctx.fillStyle = "rgba(135, 147, 182, 0.96)";
      ctx.beginPath();
      ctx.arc(actor.x - actor.r * 0.42, actor.y, actor.r * 0.72, 0, Math.PI * 2);
      ctx.arc(actor.x + actor.r * 0.1, actor.y - actor.r * 0.16, actor.r * 0.77, 0, Math.PI * 2);
      ctx.arc(actor.x + actor.r * 0.6, actor.y + actor.r * 0.05, actor.r * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffe08a";
      ctx.beginPath();
      ctx.moveTo(actor.x + actor.r * 0.08, actor.y + actor.r * 0.34);
      ctx.lineTo(actor.x - actor.r * 0.08, actor.y + actor.r * 1.0);
      ctx.lineTo(actor.x + actor.r * 0.22, actor.y + actor.r * 0.92);
      ctx.lineTo(actor.x + actor.r * 0.02, actor.y + actor.r * 1.44);
      ctx.lineTo(actor.x + actor.r * 0.5, actor.y + actor.r * 0.72);
      ctx.closePath();
      ctx.fill();
      return;
    }

    ctx.fillStyle = "#f9d58e";
    ctx.beginPath();
    ctx.ellipse(actor.x, actor.y, actor.r * 0.85, actor.r * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2c56f";
    ctx.beginPath();
    ctx.ellipse(actor.x + actor.r * 0.6, actor.y - actor.r * 0.05, actor.r * 0.36, actor.r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a445f";
    ctx.beginPath();
    ctx.arc(actor.x + actor.r * 0.66, actor.y - actor.r * 0.09, actor.r * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff9e4f";
    ctx.beginPath();
    ctx.moveTo(actor.x + actor.r * 0.94, actor.y - actor.r * 0.03);
    ctx.lineTo(actor.x + actor.r * 1.22, actor.y + actor.r * 0.08);
    ctx.lineTo(actor.x + actor.r * 0.94, actor.y + actor.r * 0.16);
    ctx.closePath();
    ctx.fill();
  }

  function drawOrbitStars(ctx, flight, ratio) {
    if (ratio <= 0.04) {
      return;
    }
    const w = gameCanvas.width;
    const h = gameCanvas.height;
    ctx.save();
    ctx.globalAlpha = 0.18 + ratio * 0.72;
    for (let i = 0; i < 72; i += 1) {
      const x = fract(hash1(i * 5.4, 91) + flight.worldX * (0.00002 + i * 0.0000007)) * w;
      const y = hash1(i * 8.7, 131) * h * 0.74;
      const radius = 0.7 + hash1(i * 3.1, 27) * 1.8;
      ctx.fillStyle = i % 7 === 0 ? "rgba(255, 235, 187, 0.92)" : "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawOrbitLines(ctx, flight, ratio) {
    if (ratio <= 0.22) {
      return;
    }
    const w = gameCanvas.width;
    const h = gameCanvas.height;
    ctx.save();
    ctx.strokeStyle = `rgba(189, 219, 255, ${0.08 + ratio * 0.14})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i += 1) {
      const drift = Math.sin(flight.elapsed * 0.28 + i * 0.9) * 18;
      ctx.beginPath();
      ctx.ellipse(
        w * (0.72 - i * 0.11),
        h * (0.18 + i * 0.08),
        w * (0.16 + i * 0.08),
        h * (0.038 + i * 0.018),
        -0.16 + i * 0.03,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w * (0.82 - i * 0.08) + drift, h * (0.18 + i * 0.08), 2.3 + i, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.3 + ratio * 0.25})`;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSpeedLines(ctx, flight, speedRatio, spaceRatio) {
    if (speedRatio <= 0.2) {
      return;
    }
    const w = gameCanvas.width;
    const h = gameCanvas.height;
    const density = 20 + Math.floor(speedRatio * 28);
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < density; i += 1) {
      const seed = i * 3.17;
      const x = fract(hash1(seed * 4.1, 401) + flight.elapsed * (0.18 + speedRatio * 0.62) + i * 0.031) * (w + 180) - 80;
      const y = h * (0.14 + hash1(seed * 6.2, 433) * 0.56);
      const length = 60 + speedRatio * 220 + hash1(seed * 7.9, 479) * 60;
      const alpha = 0.07 + speedRatio * 0.17;
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 1.3 + speedRatio * 1.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - length, y + (spaceRatio > 0.45 ? -5 : 0));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSeaReflections(ctx, flight, sunRatio, nightRatio) {
    const w = gameCanvas.width;
    const h = gameCanvas.height;
    const baseX = w * 0.78;
    ctx.save();
    for (let i = 0; i < 18; i += 1) {
      const t = i / 17;
      const y = h * (0.6 + t * 0.3);
      const width = 28 + (1 - t) * 140 + nightRatio * 26;
      const drift = Math.sin(flight.elapsed * (1.6 + t) + i * 1.3) * (6 + t * 10);
      const alpha = (0.05 + sunRatio * 0.12 + nightRatio * 0.1) * (1 - t * 0.78);
      ctx.fillStyle = `rgba(255, 242, 198, ${alpha})`;
      ctx.fillRect(baseX - width * 0.5 + drift, y, width, 2 + (1 - t) * 1.4);
    }
    ctx.restore();
  }

  function drawRunwayReflection(ctx, flight, centerX, intensity) {
    if (intensity <= 0.02) {
      return;
    }
    const camX = cameraX(flight);
    const screenX = centerX - camX;
    if (screenX < -320 || screenX > gameCanvas.width + 320) {
      return;
    }
    const seaY = surfaceScreenY(flight, centerX, screenX);
    ctx.save();
    for (let i = 0; i < 8; i += 1) {
      const width = 18 + i * 8;
      const alpha = intensity * (0.12 - i * 0.01);
      ctx.fillStyle = `rgba(255, 223, 158, ${Math.max(0, alpha)})`;
      ctx.fillRect(screenX - width * 0.5 + Math.sin(flight.elapsed * 4 + i) * 3, seaY + 10 + i * 8, width, 2.4);
    }
    ctx.restore();
  }

  function drawOcean(ctx, flight, palette, spaceRatio, sunRatio, nightRatio) {
    const w = gameCanvas.width;
    const h = gameCanvas.height;
    const seaGradient = ctx.createLinearGradient(0, h * 0.58, 0, h);
    seaGradient.addColorStop(0, blendHex("#8fe2f1", "#416b9e", spaceRatio * 0.88));
    seaGradient.addColorStop(1, blendHex(blendHex("#2a9dc9", "#07131f", spaceRatio), "#02111d", nightRatio * 0.7));

    ctx.beginPath();
    ctx.moveTo(0, h + 40);
    for (let x = 0; x <= w + 16; x += 16) {
      const worldX = cameraX(flight) + x;
      const y = surfaceScreenY(flight, worldX, x);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h + 40);
    ctx.closePath();
    ctx.fillStyle = seaGradient;
    ctx.fill();
    drawSeaReflections(ctx, flight, sunRatio, nightRatio);

    ctx.strokeStyle = `rgba(255,255,255,${0.26 - spaceRatio * 0.14})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= w + 16; x += 20) {
      const worldX = cameraX(flight) + x;
      const y = surfaceScreenY(flight, worldX, x) - 4 - Math.sin((worldX + flight.elapsed * 90) / 70) * 1.6;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    if (spaceRatio > 0.12) {
      ctx.strokeStyle = `rgba(144, 214, 255, ${spaceRatio * 0.38})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let x = 0; x <= w + 16; x += 18) {
        const worldX = cameraX(flight) + x;
        const y = surfaceScreenY(flight, worldX, x) - 2;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    const speedRatio = clamp(flight.speed / Math.max(1, flight.maxSpeed), 0, 1);
    if (speedRatio > 0.28) {
      ctx.save();
      ctx.strokeStyle = `rgba(227, 249, 255, ${0.12 + speedRatio * 0.22})`;
      ctx.lineWidth = 1.8 + speedRatio * 1.5;
      for (let i = 0; i < 22; i += 1) {
        const seed = i * 5.3;
        const startX = fract(hash1(seed, 517) + flight.elapsed * (0.28 + speedRatio * 0.84) + i * 0.021) * (w + 140) - 70;
        const y = h * (0.8 + hash1(seed * 4.1, 541) * 0.12);
        const len = 80 + speedRatio * 160;
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(startX - len, y + 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawControlTower(ctx, x, groundY, tone, nightRatio, elapsed) {
    const beacon = 0.45 + Math.sin(elapsed * 4.4) * 0.25 + nightRatio * 0.22;
    drawRoundRectPath(ctx, x - 18, groundY - 76, 36, 62, 8);
    ctx.fillStyle = blendHex("#f3f7ff", "#a9bad0", nightRatio * 0.5);
    ctx.fill();
    drawRoundRectPath(ctx, x - 24, groundY - 98, 48, 24, 10);
    ctx.fillStyle = blendHex("#f8fbff", tone, 0.22);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 214, 152, ${0.08 + nightRatio * 0.58})`;
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        ctx.fillRect(x - 10 + col * 10, groundY - 68 + row * 14, 6, 8);
      }
    }
    ctx.fillStyle = "#4d6a88";
    ctx.fillRect(x - 1.5, groundY - 120, 3, 22);
    ctx.beginPath();
    ctx.arc(x, groundY - 122, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 122, 88, ${clamp(beacon, 0.12, 0.88)})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, groundY - 122, 11, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 155, 120, ${clamp(beacon * 0.2, 0.03, 0.16)})`;
    ctx.fill();
  }

  function drawAirportRunway(ctx, x, groundY, label, tone, runwayHalf = 74, options = {}) {
    const nightRatio = clamp(options.nightRatio || 0, 0, 1);
    const approachActive = Boolean(options.approachActive);
    const runwayWidth = runwayHalf * 2;
    const shoulderWidth = runwayWidth + 24;
    drawRoundRectPath(ctx, x - shoulderWidth * 0.5, groundY + 20, shoulderWidth, 16, 8);
    ctx.fillStyle = "rgba(67, 112, 89, 0.86)";
    ctx.fill();
    drawRoundRectPath(ctx, x - runwayWidth * 0.5, groundY, runwayWidth, 16, 8);
    ctx.fillStyle = blendHex("#606782", "#465063", nightRatio * 0.55);
    ctx.fill();
    for (let i = -runwayWidth * 0.5 + 16; i <= runwayWidth * 0.5 - 16; i += 28) {
      const glow = 0.24 + nightRatio * 0.5 + (approachActive ? 0.16 : 0);
      ctx.fillStyle = `rgba(255, 241, 191, ${glow})`;
      ctx.beginPath();
      ctx.arc(x + i, groundY + 2, 1.9, 0, Math.PI * 2);
      ctx.arc(x + i, groundY + 14, 1.4, 0, Math.PI * 2);
      ctx.fill();
      if (nightRatio > 0.12) {
        ctx.beginPath();
        ctx.arc(x + i, groundY + 8, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 218, 132, ${nightRatio * 0.08})`;
        ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(x - runwayWidth * 0.5 + 14, groundY + 3, 18, 10);
    ctx.fillRect(x + runwayWidth * 0.5 - 32, groundY + 3, 18, 10);
    const stripeStart = -runwayWidth * 0.36;
    const stripeEnd = runwayWidth * 0.36;
    for (let i = stripeStart; i <= stripeEnd; i += 30) {
      ctx.fillStyle = "rgba(255,255,255,0.74)";
      ctx.fillRect(x + i - 6, groundY + 5, 12, 3);
    }
    if (approachActive && nightRatio > 0.16) {
      for (let i = 1; i <= 5; i += 1) {
        ctx.fillStyle = `rgba(255, 228, 162, ${0.12 + nightRatio * 0.2})`;
        ctx.fillRect(x - runwayWidth * 0.5 - 38 * i, groundY + 6, 10, 2);
      }
    }
    drawRoundRectPath(ctx, x - 10, groundY - 38, 20, 38, 5);
    ctx.fillStyle = "#f1f5ff";
    ctx.fill();
    ctx.fillStyle = tone;
    ctx.fillRect(x - 5, groundY - 29, 10, 16);
    drawRoundRectPath(ctx, x - 24, groundY - 60, 48, 20, 10);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();
    ctx.fillStyle = "#24445f";
    ctx.font = `700 ${Math.round(11 * (gameCanvas.width / 1080))}px "M PLUS Rounded 1c", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(label, x, groundY - 46);
  }

  function drawRunwayIsland(ctx, flight, centerX, label, tone, palette, options = {}) {
    const camX = cameraX(flight);
    const islandLeft = centerX - flight.islandHalf;
    const islandRight = centerX + flight.islandHalf;
    if (islandRight - camX < -280 || islandLeft - camX > gameCanvas.width + 280) {
      return;
    }
    const nightRatio = clamp(options.nightRatio || 0, 0, 1);

    ctx.beginPath();
    ctx.moveTo(islandLeft - camX, gameCanvas.height + 60);
    for (let worldX = islandLeft; worldX <= islandRight + 8; worldX += 12) {
      const screenX = worldX - camX;
      const altitude = Math.max(oceanSurfaceAt(worldX), islandAltitudeAt(flight, worldX, centerX));
      const y = worldToScreenY(flight, altitude) + horizonCurveOffset(screenX, spaceAltitudeRatio(flight));
      ctx.lineTo(screenX, y);
    }
    ctx.lineTo(islandRight - camX, gameCanvas.height + 60);
    ctx.closePath();

    const islandGradient = ctx.createLinearGradient(0, gameCanvas.height * 0.58, 0, gameCanvas.height);
    islandGradient.addColorStop(0, blendHex(blendHex(palette.hillBack, "#c3dfcc", 0.34), "#53708c", nightRatio * 0.38));
    islandGradient.addColorStop(1, blendHex(palette.ground, "#24384a", nightRatio * 0.44));
    ctx.fillStyle = islandGradient;
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const screenX = centerX - camX;
    const groundY = worldToScreenY(flight, flight.runwayAltitude) + horizonCurveOffset(screenX, spaceAltitudeRatio(flight));
    drawAirportRunway(ctx, screenX, groundY - 16, label, tone, flight.runwayHalf, {
      nightRatio,
      approachActive: options.approachActive,
    });
    drawControlTower(ctx, screenX + flight.runwayHalf * 0.32, groundY + 4, tone, nightRatio, flight.elapsed);
    drawRunwayReflection(ctx, flight, centerX, nightRatio * (options.approachActive ? 1.1 : 0.7));
  }

  function drawApproachGuides(ctx, flight, runwayScreenX, runwayScreenY, flareWindow) {
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = "rgba(255,255,255,0.56)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(runwayScreenX - 210, runwayScreenY - 124);
    ctx.lineTo(runwayScreenX - 26, runwayScreenY - 14);
    ctx.moveTo(runwayScreenX - 210, runwayScreenY - 92);
    ctx.lineTo(runwayScreenX + 26, runwayScreenY - 14);
    ctx.stroke();
    if (flareWindow) {
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(255, 233, 176, 0.88)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(runwayScreenX - 52, runwayScreenY - 42, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 247, 220, 0.94)";
      ctx.font = `700 ${Math.round(14 * (gameCanvas.width / 1080))}px "M PLUS Rounded 1c", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("flare", runwayScreenX - 52, runwayScreenY - 70);
    }
    ctx.restore();
  }

  function drawActors(ctx, flight, palette) {
    const camX = cameraX(flight);
    flight.actors.forEach((actor) => {
      const x = actor.x - camX;
      const y = worldToScreenY(flight, actor.altitude) + horizonCurveOffset(x, spaceAltitudeRatio(flight));
      if (x < -120 || x > gameCanvas.width + 140 || y < -160 || y > gameCanvas.height + 160) {
        return;
      }
      if (actor.type === "star") {
        drawStar(ctx, x, y, actor.r, palette.star);
      } else if (actor.type === "fuel") {
        drawFuelPickup(ctx, x, y, actor.r, flight.elapsed);
      } else if (actor.type === "draft") {
        drawDraft(ctx, x, y, actor.rx, actor.ry, palette.draft);
      } else if (actor.type === "jetstream") {
        drawJetstream(ctx, x, y, actor.rx, actor.ry, "rgba(205, 226, 255, 0.7)");
      } else {
        drawHazard(ctx, { ...actor, x, y });
      }
    });
  }

  function drawAltitudeRoutes(ctx, flight, spaceRatio) {
    const bands = getAltitudeRouteBands(flight);
    const activeBand = getAltitudeBandState(flight);
    ctx.save();
    bands.forEach((band, index) => {
      const y = worldToScreenY(flight, band.center);
      if (y < -70 || y > gameCanvas.height + 70) {
        return;
      }
      const active = band.id === activeBand.id;
      ctx.strokeStyle = band.color.replace(/0\.\d+\)/, `${active ? 0.34 : 0.15})`);
      ctx.lineWidth = active ? 2.6 : 1.4;
      ctx.setLineDash(active ? [14, 10] : [10, 12]);
      ctx.beginPath();
      for (let x = 28; x <= gameCanvas.width - 24; x += 28) {
        const yy = y + horizonCurveOffset(x, spaceRatio) * 0.12;
        if (x === 28) {
          ctx.moveTo(x, yy);
        } else {
          ctx.lineTo(x, yy);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);

      drawRoundRectPath(ctx, 18, y - 15, active ? 140 : 118, 26, 13);
      ctx.fillStyle = active ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.62)";
      ctx.fill();
      ctx.fillStyle = active ? "#29485f" : "rgba(41, 72, 95, 0.76)";
      ctx.font = `700 ${Math.round((active ? 13 : 12) * (gameCanvas.width / 1080))}px "M PLUS Rounded 1c", sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(active ? `${band.title} · ${band.reward}` : band.title, 30, y + 2);
      if (active) {
        ctx.fillStyle = band.color;
        ctx.beginPath();
        ctx.arc(138, y - 2, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (index < bands.length - 1) {
        const nextY = worldToScreenY(flight, bands[index + 1].center);
        const splitY = (y + nextY) * 0.5;
        if (splitY > 0 && splitY < gameCanvas.height) {
          ctx.strokeStyle = "rgba(255,255,255,0.1)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(20, splitY);
          ctx.lineTo(gameCanvas.width - 20, splitY);
          ctx.stroke();
        }
      }
    });
    ctx.restore();
  }

  function drawFlight() {
    const flight = getState().flight;
    if (!flight) {
      return;
    }
    const route = ROUTES[flight.routeIndex];
    const palette = route.palette;
    const w = gameCanvas.width;
    const h = gameCanvas.height;
    const sunRatio = clamp(flight.sun / flight.maxSun, 0, 1);
    const progress = routeProgress(flight);
    const spaceRatio = spaceAltitudeRatio(flight);
    const nightRatio = nightApproachRatio(flight);
    const camX = cameraX(flight);
    const planeScreenY = worldToScreenY(flight, flight.altitude);
    const speedRatio = clamp(flight.speed / Math.max(1, flight.maxSpeed), 0, 1);
    const landingAssist = landingAssistState(flight);

    const sky = gameCtx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, blendHex(blendHex(blendHex(palette.skyTop, palette.duskTop, 1 - sunRatio), "#0a1b2d", nightRatio * 0.7), "#071322", spaceRatio));
    sky.addColorStop(0.42, blendHex(blendHex(blendHex(palette.skyMid, palette.duskTop, (1 - sunRatio) * 0.5), "#17314f", nightRatio * 0.68), "#102b4f", spaceRatio * 0.86));
    sky.addColorStop(1, blendHex(blendHex(blendHex(palette.skyBottom, palette.duskBottom, 1 - sunRatio), "#1d3555", nightRatio * 0.62), "#254365", spaceRatio * 0.58));
    gameCtx.fillStyle = sky;
    gameCtx.fillRect(0, 0, w, h);

    drawOrbitStars(gameCtx, flight, spaceRatio);
    drawOrbitLines(gameCtx, flight, spaceRatio);
    drawSpeedLines(gameCtx, flight, speedRatio, spaceRatio);
    drawSun(gameCtx, palette, sunRatio, nightRatio);
    gameCtx.save();
    gameCtx.globalAlpha = 1 - spaceRatio * 0.82;
    drawPaperTexture(gameCtx, palette);
    gameCtx.restore();

    flight.clouds.forEach((cloud) => {
      const x = cloud.x - camX;
      const y = worldToScreenY(flight, cloud.altitude) + horizonCurveOffset(x, spaceRatio) * 0.2;
      if (x < -160 || x > w + 180 || y < -120 || y > h + 120) {
        return;
      }
      drawCloud(gameCtx, { ...cloud, x, y, alpha: cloud.alpha * (1 - spaceRatio * 0.52) }, palette.cloud);
    });

    drawOcean(gameCtx, flight, palette, spaceRatio, sunRatio, nightRatio);
    drawRunwayIsland(gameCtx, flight, 0, AIRPORTS[route.from].code, "#78b0cc", palette, {
      nightRatio: nightRatio * 0.7,
      approachActive: false,
    });
    drawRunwayIsland(gameCtx, flight, flight.arrivalAirportX, AIRPORTS[route.to].code, "#4f7b9b", palette, {
      nightRatio,
      approachActive: flight.phase === "descent" || flight.phase === "approach" || flight.phase === "landing_roll",
    });
    drawRunwayMarks(gameCtx, flight);

    const destinationX = flight.arrivalAirportX - camX;
    const destinationY = worldToScreenY(flight, flight.runwayAltitude) + horizonCurveOffset(destinationX, spaceRatio);
    if ((flight.phase === "approach" || flight.phase === "descent") && !flight.grounded && destinationX > -220 && destinationX < w + 220) {
      drawApproachGuides(gameCtx, flight, destinationX, destinationY - 16, landingAssist.flareWindow);
    }

    drawAltitudeRoutes(gameCtx, flight, spaceRatio);
    drawActors(gameCtx, flight, palette);
    drawTouchdownEffects(gameCtx, flight);
    drawGhostPlane(gameCtx, flight, palette, spaceRatio);

    if (flight.shake > 0) {
      const shakeFrame = Math.floor(flight.elapsed * 120);
      const shakeX = (hash1(shakeFrame, flight.seed + 701) - 0.5) * flight.shake * 8;
      const shakeY = (hash1(shakeFrame, flight.seed + 809) - 0.5) * flight.shake * 8;
      gameCtx.save();
      gameCtx.translate(shakeX, shakeY);
    }
    drawPlane(gameCtx, flight.screenX, planeScreenY, flight.pitch, flight.propeller, palette, {
      gearDown: landingAssist.gearDown,
      spoilers: flight.spoilers,
      landingLight: !flight.grounded && landingAssist.gearDown ? 0.85 * (1 - spaceRatio * 0.72) : 0,
      flaps: flight.flapLift,
    });
    if (flight.shake > 0) {
      gameCtx.restore();
    }

    if (flight.touchdownFlash > 0) {
      gameCtx.fillStyle = `rgba(255, 247, 226, ${flight.touchdownFlash * 0.12})`;
      gameCtx.fillRect(0, 0, w, h);
    }

    const barWidth = w * 0.68;
    const barX = (w - barWidth) * 0.5;
    const barY = h - 18;
    drawRoundRectPath(gameCtx, barX, barY, barWidth, 12, 8);
    gameCtx.fillStyle = "rgba(255,255,255,0.6)";
    gameCtx.fill();
    drawRoundRectPath(gameCtx, barX, barY, barWidth * progress, 12, 8);
    gameCtx.fillStyle = palette.accent;
    gameCtx.fill();
    gameCtx.fillStyle = "#29485f";
    gameCtx.font = `${Math.round(12 * (w / 1080))}px "M PLUS Rounded 1c", sans-serif`;
    gameCtx.textAlign = "left";
    gameCtx.fillText(AIRPORTS[route.from].code, barX - 2, barY - 6);
    gameCtx.textAlign = "right";
    gameCtx.fillText(AIRPORTS[route.to].code, barX + barWidth + 2, barY - 6);
  }

  function drawSun(ctx, palette, sunRatio, nightRatio = 0) {
    const w = gameCanvas.width;
    const h = gameCanvas.height;
    const x = w * 0.78;
    const y = lerp(h * 0.18, h * 0.72, 1 - sunRatio);
    ctx.fillStyle = `rgba(255, 240, 202, ${0.14 + (1 - nightRatio) * 0.34})`;
    ctx.beginPath();
    ctx.arc(x, y, h * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blendHex(palette.sun, "#f4f7ff", nightRatio * 0.78);
    ctx.beginPath();
    ctx.arc(x, y, h * 0.07, 0, Math.PI * 2);
    ctx.fill();
    if (nightRatio > 0.18) {
      ctx.strokeStyle = `rgba(210, 230, 255, ${nightRatio * 0.28})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, h * 0.09, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPaperTexture(ctx, palette) {
    ctx.fillStyle = palette.paper;
    for (let i = 0; i < 120; i += 1) {
      const x = hash1(i * 4.7, 31) * gameCanvas.width;
      const y = hash1(i * 6.1, 73) * gameCanvas.height;
      const size = 0.6 + hash1(i * 8.5, 19) * 1.4;
      ctx.fillRect(x, y, size, size);
    }
  }

  return {
    drawFlight,
  };
}
