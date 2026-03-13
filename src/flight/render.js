export function createFlightRenderer(deps) {
  const {
    AIRPORTS,
    ROUTES,
    SPACE_REFERENCE,
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
    displaySpeedKmh,
    displaySinkRateMs,
    aglMeters,
    cruiseAltitudeMeters,
    formatAltitudeValue,
    spaceAltitudeProfile,
    getState,
  } = deps;

  function spaceVisualState(flight) {
    const profile = spaceAltitudeProfile(flight);
    const altitudeKm = profile.altitudeKm;
    return {
      ...profile,
      stratosphereRatio: clamp((altitudeKm - 18) / Math.max(1, SPACE_REFERENCE.karmanLineKm - 18), 0, 1),
      karmanRatio: clamp((altitudeKm - (SPACE_REFERENCE.karmanLineKm - 12)) / 48, 0, 1),
      leoRatio: clamp((altitudeKm - SPACE_REFERENCE.lowEarthOrbitStartKm) / Math.max(1, SPACE_REFERENCE.issMinKm - SPACE_REFERENCE.lowEarthOrbitStartKm), 0, 1),
      issRatio: clamp((altitudeKm - SPACE_REFERENCE.issMinKm) / Math.max(1, SPACE_REFERENCE.issMaxKm - SPACE_REFERENCE.issMinKm), 0, 1),
    };
  }

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
    ctx.translate(cloud.x, cloud.y);

    if (getState().debugEnabled) {
      ctx.globalAlpha = cloud.alpha;
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.arc(-cloud.r * 0.45, 0, cloud.r * 0.72, 0, Math.PI * 2);
      ctx.arc(cloud.r * 0.1, -cloud.r * 0.2, cloud.r * 0.82, 0, Math.PI * 2);
      ctx.arc(cloud.r * 0.62, cloud.r * 0.06, cloud.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.globalAlpha = cloud.alpha * 0.12;
    ctx.fillStyle = "rgba(93, 117, 143, 0.26)";
    ctx.beginPath();
    ctx.ellipse(0, cloud.r * 0.42, cloud.r * 1.06, cloud.r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = cloud.alpha;
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(-cloud.r * 0.45, 0, cloud.r * 0.72, 0, Math.PI * 2);
    ctx.arc(cloud.r * 0.1, -cloud.r * 0.2, cloud.r * 0.82, 0, Math.PI * 2);
    ctx.arc(cloud.r * 0.62, cloud.r * 0.06, cloud.r * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = cloud.alpha * 0.14;
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.beginPath();
    ctx.arc(-cloud.r * 0.18, -cloud.r * 0.14, cloud.r * 0.34, 0, Math.PI * 2);
    ctx.arc(cloud.r * 0.16, -cloud.r * 0.22, cloud.r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawJetstream(ctx, x, y, rx, ry, color) {
    ctx.save();
    ctx.translate(x, y);
    const gradient = ctx.createLinearGradient(-rx, 0, rx, 0);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.32, "rgba(205, 226, 255, 0.24)");
    gradient.addColorStop(0.68, "rgba(255,255,255,0.34)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.36)";
    ctx.lineWidth = 1.4;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-rx * 0.72, i * 10);
      ctx.bezierCurveTo(-rx * 0.18, i * 12, rx * 0.12, i * 4, rx * 0.72, i * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlaneWake(ctx, flight, x, y, palette, speedRatio, spaceRatio) {
    if (getState().debugEnabled) {
      return;
    }
    if (speedRatio <= 0.16) {
      return;
    }
    const declutter = phaseDeclutterScale(flight);
    const wakeAlpha = ((flight.engineOut ? 0.06 : 0.1) + speedRatio * 0.12) * (0.64 + declutter * 0.36);
    ctx.save();
    for (let i = 0; i < 3; i += 1) {
      const offset = i * 7;
      const trailLength = (42 + speedRatio * 84 + i * 16) * (0.72 + declutter * 0.28);
      const trailY = y + (i - 1.5) * 4;
      const gradient = ctx.createLinearGradient(x - 18, trailY, x - trailLength, trailY + 6);
      gradient.addColorStop(0, `rgba(255,255,255,${wakeAlpha * (0.8 - i * 0.12)})`);
      gradient.addColorStop(0.45, `rgba(235,247,255,${wakeAlpha * (0.48 - i * 0.08)})`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = Math.max(1, 2.1 - i * 0.28);
      ctx.beginPath();
      ctx.moveTo(x - 12 - offset, trailY);
      ctx.bezierCurveTo(
        x - 30 - offset * 1.2,
        trailY + 1.5 + Math.sin(flight.elapsed * 9 + i) * 1.2,
        x - trailLength * 0.52,
        trailY + (spaceRatio > 0.45 ? -5 : 2) + Math.sin(flight.elapsed * 4 + i) * 2.6,
        x - trailLength,
        trailY + (spaceRatio > 0.45 ? -12 : 5),
      );
      ctx.stroke();
    }

    if (speedRatio > 0.58 && declutter > 0.72) {
      for (let i = 0; i < 2; i += 1) {
        const drift = fract(hash1(i * 7.1, 631) + flight.elapsed * (0.7 + speedRatio)) * 120;
        const sparkleX = x - 34 - drift;
        const sparkleY = y + (hash1(i * 5.6, 653) - 0.5) * 18;
        ctx.fillStyle = `rgba(255, 252, 236, ${0.08 + speedRatio * 0.08})`;
        ctx.fillRect(sparkleX, sparkleY, 2, 2);
      }
    }
    ctx.restore();
  }

  function drawPlane(ctx, x, y, pitch, propeller, palette, details = {}) {
    const tilt = clamp(pitch, -0.45, 0.45);
    const gearDown = Boolean(details.gearDown);
    const spoilers = clamp(details.spoilers || 0, 0, 1);
    const landingLight = clamp(details.landingLight || 0, 0, 1);
    const flaps = clamp(details.flaps || 0, 0, 1);
    if (details.vehicleStyle === "spaceplane") {
      drawSpaceplane(ctx, x, y, tilt, propeller, palette, {
        gearDown,
        spoilers,
        landingLight,
        flaps,
        accent: details.vehicleAccent,
        stripe: details.vehicleStripe,
        canopy: details.vehicleCanopy,
      });
      return;
    }
    if (details.vehicleStyle === "shuttle") {
      drawReusableShuttle(ctx, x, y, tilt, propeller, palette, {
        gearDown,
        spoilers,
        landingLight,
        flaps,
        accent: details.vehicleAccent,
        stripe: details.vehicleStripe,
        canopy: details.vehicleCanopy,
      });
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    ctx.fillStyle = "rgba(28, 49, 71, 0.16)";
    ctx.beginPath();
    ctx.ellipse(-2, 18 + (gearDown ? 7 : 2), 46, 10, 0, 0, Math.PI * 2);
    ctx.fill();

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

    const bodyGradient = ctx.createLinearGradient(-42, -12, 32, 16);
    bodyGradient.addColorStop(0, blendHex(palette.accent, "#fff4ea", 0.28));
    bodyGradient.addColorStop(0.58, palette.accent);
    bodyGradient.addColorStop(1, blendHex(palette.accent, "#d9707e", 0.32));
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, 42, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    const bellyGradient = ctx.createLinearGradient(-18, -8, 20, 10);
    bellyGradient.addColorStop(0, "#fff9ef");
    bellyGradient.addColorStop(1, "#fbe7d4");
    ctx.fillStyle = bellyGradient;
    ctx.beginPath();
    ctx.ellipse(8, -1, 23, 10.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.quadraticCurveTo(6, -14, 23, -8);
    ctx.stroke();

    ctx.fillStyle = "#ffd8aa";
    ctx.beginPath();
    ctx.ellipse(-1, 2, 18, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(12, -1, 6.7, 0, Math.PI * 2);
    ctx.fill();
    const canopy = ctx.createLinearGradient(8, -7, 18, 5);
    canopy.addColorStop(0, "#fefeff");
    canopy.addColorStop(0.5, "#cfe5f9");
    canopy.addColorStop(1, "#79a0c8");
    ctx.fillStyle = canopy;
    ctx.beginPath();
    ctx.arc(12, -1, 5.9, 0, Math.PI * 2);
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

    const wingTop = ctx.createLinearGradient(-30, -8, 14, 16);
    wingTop.addColorStop(0, "#ffffff");
    wingTop.addColorStop(1, "#dce9f5");
    ctx.fillStyle = wingTop;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-40, 15);
    ctx.lineTo(14, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = blendHex("#dbe8f3", palette.accent, 0.18);
    ctx.beginPath();
    ctx.moveTo(-3, -2);
    ctx.lineTo(-26, -12);
    ctx.lineTo(8, -2);
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

    const tailGradient = ctx.createLinearGradient(-42, -22, -8, -4);
    tailGradient.addColorStop(0, blendHex(palette.hillFront, "#ffffff", 0.44));
    tailGradient.addColorStop(1, blendHex(palette.hillFront, palette.accent, 0.18));
    ctx.fillStyle = tailGradient;
    ctx.beginPath();
    ctx.moveTo(-23, -4);
    ctx.lineTo(-42, -20);
    ctx.lineTo(-13, -8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillRect(-22, -5.5, 18, 3);
    drawStar(ctx, -24, -12, 4.2, "#fff2ba");

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

    ctx.fillStyle = "rgba(255,255,255,0.84)";
    [-6, 3, 12].forEach((wx) => {
      ctx.beginPath();
      ctx.arc(wx, -1.5, 2.1, 0, Math.PI * 2);
      ctx.fill();
    });

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

    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.ellipse(44, 0, 16, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.ground;
    ctx.beginPath();
    ctx.arc(44, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawSpaceplane(ctx, x, y, tilt, propeller, palette, details = {}) {
    const gearDown = Boolean(details.gearDown);
    const spoilers = clamp(details.spoilers || 0, 0, 1);
    const landingLight = clamp(details.landingLight || 0, 0, 1);
    const flaps = clamp(details.flaps || 0, 0, 1);
    const accent = details.accent || "#8fc8ff";
    const stripe = details.stripe || "#ffe8c2";
    const canopyTone = details.canopy || "#9feaff";
    const enginePulse = 0.45 + Math.sin(propeller * 1.6) * 0.12;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    ctx.fillStyle = "rgba(18, 32, 50, 0.22)";
    ctx.beginPath();
    ctx.ellipse(-4, 18 + (gearDown ? 8 : 2), 54, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    if (landingLight > 0.02) {
      const lightGradient = ctx.createLinearGradient(28, -2, 150, -8);
      lightGradient.addColorStop(0, `rgba(255, 248, 232, ${landingLight * 0.34})`);
      lightGradient.addColorStop(1, "rgba(255, 248, 232, 0)");
      ctx.fillStyle = lightGradient;
      ctx.beginPath();
      ctx.moveTo(18, -5);
      ctx.lineTo(150, -24);
      ctx.lineTo(150, 18);
      ctx.lineTo(18, 5);
      ctx.closePath();
      ctx.fill();
    }

    if (!gearDown) {
      const exhaust = ctx.createLinearGradient(-72, 0, -28, 0);
      exhaust.addColorStop(0, "rgba(118, 221, 255, 0)");
      exhaust.addColorStop(0.38, `rgba(118, 221, 255, ${0.12 + enginePulse * 0.18})`);
      exhaust.addColorStop(0.72, `rgba(255, 236, 182, ${0.12 + enginePulse * 0.14})`);
      exhaust.addColorStop(1, "rgba(255, 236, 182, 0)");
      ctx.fillStyle = exhaust;
      ctx.beginPath();
      ctx.moveTo(-28, -2);
      ctx.lineTo(-76, -7);
      ctx.lineTo(-76, 7);
      ctx.lineTo(-28, 2);
      ctx.closePath();
      ctx.fill();
    }

    if (gearDown) {
      ctx.strokeStyle = "#24445f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-6, 9);
      ctx.lineTo(-14, 24);
      ctx.moveTo(14, 8);
      ctx.lineTo(18, 22);
      ctx.moveTo(26, 2);
      ctx.lineTo(30, 14);
      ctx.stroke();
      ctx.fillStyle = "#243c54";
      ctx.beginPath();
      ctx.arc(-15, 26, 5, 0, Math.PI * 2);
      ctx.arc(19, 24, 5.2, 0, Math.PI * 2);
      ctx.arc(31, 15.5, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const wingGradient = ctx.createLinearGradient(-52, -2, 24, 18);
    wingGradient.addColorStop(0, blendHex("#eef6ff", accent, 0.12));
    wingGradient.addColorStop(0.55, blendHex(accent, "#f6fbff", 0.28));
    wingGradient.addColorStop(1, blendHex(accent, "#7c8db8", 0.24));
    ctx.fillStyle = wingGradient;
    ctx.beginPath();
    ctx.moveTo(-4, -1);
    ctx.lineTo(-48, 18);
    ctx.lineTo(-12, 6);
    ctx.lineTo(28, 10);
    ctx.lineTo(12, 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = blendHex("#eef4fb", accent, 0.18);
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-34, -15);
    ctx.lineTo(8, -4);
    ctx.lineTo(18, 0);
    ctx.closePath();
    ctx.fill();

    if (flaps > 0.04) {
      ctx.fillStyle = blendHex("#e5eef5", "#ffffff", 0.36);
      ctx.beginPath();
      ctx.moveTo(-20, 9);
      ctx.lineTo(-38, 18 + flaps * 4);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(4, 7);
      ctx.lineTo(-3, 13 + flaps * 3);
      ctx.lineTo(13, 10);
      ctx.closePath();
      ctx.fill();
    }

    const fuselageGradient = ctx.createLinearGradient(-58, -10, 28, 12);
    fuselageGradient.addColorStop(0, blendHex(accent, "#ffffff", 0.4));
    fuselageGradient.addColorStop(0.52, blendHex(accent, "#dfeaff", 0.08));
    fuselageGradient.addColorStop(1, blendHex(accent, "#6f7ba5", 0.34));
    ctx.fillStyle = fuselageGradient;
    ctx.beginPath();
    ctx.moveTo(-44, -3);
    ctx.quadraticCurveTo(-20, -17, 14, -9);
    ctx.quadraticCurveTo(28, -6, 36, 0);
    ctx.quadraticCurveTo(24, 10, 2, 10);
    ctx.quadraticCurveTo(-28, 12, -46, 5);
    ctx.closePath();
    ctx.fill();

    const bellyGradient = ctx.createLinearGradient(-28, 2, 20, 13);
    bellyGradient.addColorStop(0, "rgba(30, 38, 52, 0.95)");
    bellyGradient.addColorStop(1, "rgba(64, 72, 94, 0.82)");
    ctx.fillStyle = bellyGradient;
    ctx.beginPath();
    ctx.moveTo(-16, 3);
    ctx.quadraticCurveTo(8, 4, 23, 1);
    ctx.lineTo(16, 8);
    ctx.quadraticCurveTo(-4, 10, -18, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = blendHex(stripe, "#ffffff", 0.24);
    ctx.beginPath();
    ctx.moveTo(-20, -5);
    ctx.quadraticCurveTo(2, -8, 20, -5);
    ctx.lineTo(18, -1.5);
    ctx.quadraticCurveTo(0, -3, -21, -0.5);
    ctx.closePath();
    ctx.fill();

    const canopyGradient = ctx.createLinearGradient(0, -12, 18, 2);
    canopyGradient.addColorStop(0, "#f7fdff");
    canopyGradient.addColorStop(0.55, canopyTone);
    canopyGradient.addColorStop(1, blendHex(canopyTone, "#4d78a4", 0.4));
    ctx.fillStyle = canopyGradient;
    ctx.beginPath();
    ctx.moveTo(4, -9);
    ctx.quadraticCurveTo(14, -12, 18, -3);
    ctx.quadraticCurveTo(12, 0, 1, -1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(5, -8);
    ctx.quadraticCurveTo(11, -10, 15, -4);
    ctx.stroke();

    ctx.fillStyle = blendHex("#e9f4ff", accent, 0.16);
    ctx.beginPath();
    ctx.moveTo(-18, -2);
    ctx.lineTo(-32, -18);
    ctx.lineTo(-24, -20);
    ctx.lineTo(-8, -4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-28, -1);
    ctx.lineTo(-36, -22);
    ctx.lineTo(-28, -23);
    ctx.lineTo(-20, -3);
    ctx.closePath();
    ctx.fill();

    if (spoilers > 0.02) {
      ctx.fillStyle = `rgba(36, 68, 95, ${0.34 + spoilers * 0.34})`;
      ctx.beginPath();
      ctx.moveTo(-8, -7);
      ctx.lineTo(-1, -14 - spoilers * 4);
      ctx.lineTo(2, -6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-20, 6);
      ctx.lineTo(-15, 1 - spoilers * 3);
      ctx.lineTo(-9, 7);
      ctx.closePath();
      ctx.fill();
    }

    drawStar(ctx, -26, -9, 3.6, stripe);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillRect(-16, -3, 9, 1.8);
    ctx.fillRect(-4, -2.4, 6, 1.6);

    ctx.restore();
  }

  function drawReusableShuttle(ctx, x, y, tilt, propeller, palette, details = {}) {
    const gearDown = Boolean(details.gearDown);
    const spoilers = clamp(details.spoilers || 0, 0, 1);
    const landingLight = clamp(details.landingLight || 0, 0, 1);
    const flaps = clamp(details.flaps || 0, 0, 1);
    const accent = details.accent || "#edf3ff";
    const stripe = details.stripe || "#ffb36b";
    const canopyTone = details.canopy || "#223451";
    const enginePulse = 0.45 + Math.sin(propeller * 1.2) * 0.1;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    ctx.fillStyle = "rgba(17, 30, 48, 0.24)";
    ctx.beginPath();
    ctx.ellipse(-2, 19 + (gearDown ? 8 : 2), 58, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    if (landingLight > 0.02) {
      const lightGradient = ctx.createLinearGradient(20, -2, 154, -8);
      lightGradient.addColorStop(0, `rgba(255, 248, 232, ${landingLight * 0.3})`);
      lightGradient.addColorStop(1, "rgba(255, 248, 232, 0)");
      ctx.fillStyle = lightGradient;
      ctx.beginPath();
      ctx.moveTo(16, -5);
      ctx.lineTo(154, -24);
      ctx.lineTo(154, 20);
      ctx.lineTo(16, 5);
      ctx.closePath();
      ctx.fill();
    }

    const plume = ctx.createLinearGradient(-82, 0, -30, 0);
    plume.addColorStop(0, "rgba(110, 204, 255, 0)");
    plume.addColorStop(0.45, `rgba(110, 204, 255, ${0.08 + enginePulse * 0.12})`);
    plume.addColorStop(0.78, `rgba(255, 210, 144, ${0.1 + enginePulse * 0.08})`);
    plume.addColorStop(1, "rgba(255, 210, 144, 0)");
    ctx.fillStyle = plume;
    ctx.beginPath();
    ctx.moveTo(-30, -3);
    ctx.lineTo(-82, -8);
    ctx.lineTo(-82, 8);
    ctx.lineTo(-30, 3);
    ctx.closePath();
    ctx.fill();

    if (gearDown) {
      ctx.strokeStyle = "#20354b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-4, 8);
      ctx.lineTo(-13, 25);
      ctx.moveTo(11, 8);
      ctx.lineTo(16, 22);
      ctx.moveTo(28, 5);
      ctx.lineTo(32, 15);
      ctx.stroke();
      ctx.fillStyle = "#27384c";
      ctx.beginPath();
      ctx.arc(-14, 27, 5.2, 0, Math.PI * 2);
      ctx.arc(17, 24, 5, 0, Math.PI * 2);
      ctx.arc(33, 16, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const wingGradient = ctx.createLinearGradient(-60, -2, 26, 18);
    wingGradient.addColorStop(0, "#e2ebf7");
    wingGradient.addColorStop(0.5, "#ffffff");
    wingGradient.addColorStop(1, blendHex(accent, "#c9d7ea", 0.34));
    ctx.fillStyle = wingGradient;
    ctx.beginPath();
    ctx.moveTo(-6, -1);
    ctx.lineTo(-54, 19);
    ctx.lineTo(-22, 8);
    ctx.lineTo(10, 12);
    ctx.lineTo(6, 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = blendHex("#dbe6f2", accent, 0.16);
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-35, -17);
    ctx.lineTo(-8, -8);
    ctx.lineTo(11, -2);
    ctx.closePath();
    ctx.fill();

    if (flaps > 0.04) {
      ctx.fillStyle = blendHex("#e9eff5", "#ffffff", 0.42);
      ctx.beginPath();
      ctx.moveTo(-25, 10);
      ctx.lineTo(-44, 19 + flaps * 4);
      ctx.lineTo(-14, 12);
      ctx.closePath();
      ctx.fill();
    }

    const bodyGradient = ctx.createLinearGradient(-58, -12, 34, 14);
    bodyGradient.addColorStop(0, "#eef4ff");
    bodyGradient.addColorStop(0.56, accent);
    bodyGradient.addColorStop(1, blendHex(accent, "#bccce2", 0.42));
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.moveTo(-48, -4);
    ctx.quadraticCurveTo(-18, -16, 10, -12);
    ctx.quadraticCurveTo(25, -10, 36, -2);
    ctx.quadraticCurveTo(30, 9, 8, 11);
    ctx.quadraticCurveTo(-24, 12, -49, 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(28, 36, 52, 0.96)";
    ctx.beginPath();
    ctx.moveTo(-18, 2);
    ctx.quadraticCurveTo(4, 2, 24, -1);
    ctx.lineTo(14, 8);
    ctx.quadraticCurveTo(-8, 9, -22, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(27, 35, 49, 0.98)";
    ctx.beginPath();
    ctx.moveTo(19, -10);
    ctx.quadraticCurveTo(30, -8, 34, -1);
    ctx.quadraticCurveTo(24, 1, 11, -2);
    ctx.quadraticCurveTo(10, -8, 19, -10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.beginPath();
    ctx.moveTo(-18, -5.5);
    ctx.quadraticCurveTo(2, -8.5, 18, -6.5);
    ctx.lineTo(16, -3.5);
    ctx.quadraticCurveTo(-2, -5.5, -19, -2.8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = stripe;
    ctx.fillRect(-34, -4.6, 16, 2.6);
    ctx.fillRect(-14, -4, 8, 2.2);

    const canopyGradient = ctx.createLinearGradient(4, -14, 20, 0);
    canopyGradient.addColorStop(0, "#9eb5d1");
    canopyGradient.addColorStop(0.5, "#415b7f");
    canopyGradient.addColorStop(1, canopyTone);
    ctx.fillStyle = canopyGradient;
    ctx.beginPath();
    ctx.moveTo(1, -9);
    ctx.quadraticCurveTo(13, -17, 20, -9);
    ctx.quadraticCurveTo(13, -2, 2, -1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.44)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(4, -8);
    ctx.quadraticCurveTo(11, -12, 17, -7);
    ctx.stroke();

    ctx.fillStyle = blendHex("#f4f8ff", accent, 0.22);
    ctx.beginPath();
    ctx.moveTo(-22, -2);
    ctx.lineTo(-36, -28);
    ctx.lineTo(-27, -30);
    ctx.lineTo(-12, -4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(34, 52, 81, 0.94)";
    ctx.beginPath();
    ctx.moveTo(-20, -3);
    ctx.lineTo(-32, -24);
    ctx.lineTo(-28, -24);
    ctx.lineTo(-14, -4);
    ctx.closePath();
    ctx.fill();

    if (spoilers > 0.02) {
      ctx.fillStyle = `rgba(36, 68, 95, ${0.3 + spoilers * 0.34})`;
      ctx.beginPath();
      ctx.moveTo(-12, -7);
      ctx.lineTo(-5, -15 - spoilers * 4);
      ctx.lineTo(-2, -7);
      ctx.closePath();
      ctx.fill();
    }

    drawStar(ctx, -28, -10, 3.4, stripe);
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
      vehicleStyle: flight.vehicleStyle,
      vehicleAccent: flight.vehicleAccent,
      vehicleStripe: flight.vehicleStripe,
      vehicleCanopy: flight.vehicleCanopy,
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
      ctx.fillStyle = "rgba(135, 147, 182, 0.72)";
      ctx.beginPath();
      ctx.arc(actor.x - actor.r * 0.42, actor.y, actor.r * 0.72, 0, Math.PI * 2);
      ctx.arc(actor.x + actor.r * 0.1, actor.y - actor.r * 0.16, actor.r * 0.77, 0, Math.PI * 2);
      ctx.arc(actor.x + actor.r * 0.6, actor.y + actor.r * 0.05, actor.r * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 224, 138, 0.6)";
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

  function drawAtmosphereBands(ctx, flight, state) {
    if (state.stratosphereRatio <= 0.04) {
      return;
    }
    const w = gameCanvas.width;
    const h = gameCanvas.height;
    ctx.save();
    const bandAlpha = 0.06 + state.stratosphereRatio * 0.24;
    const glow = ctx.createLinearGradient(0, h * 0.18, 0, h * 0.72);
    glow.addColorStop(0, `rgba(186, 219, 255, ${bandAlpha * 0.28})`);
    glow.addColorStop(0.48, `rgba(116, 178, 255, ${bandAlpha * 0.42})`);
    glow.addColorStop(0.82, `rgba(97, 235, 255, ${bandAlpha * 0.22})`);
    glow.addColorStop(1, "rgba(97, 235, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    const airglowY = h * (0.58 + state.karmanRatio * 0.06);
    const airglow = ctx.createLinearGradient(0, airglowY - 36, 0, airglowY + 24);
    airglow.addColorStop(0, "rgba(128, 214, 255, 0)");
    airglow.addColorStop(0.42, `rgba(123, 232, 255, ${bandAlpha * 0.58})`);
    airglow.addColorStop(1, "rgba(123, 232, 255, 0)");
    ctx.fillStyle = airglow;
    ctx.fillRect(0, airglowY - 36, w, 60);

    if (state.karmanRatio > 0.05) {
      ctx.strokeStyle = `rgba(189, 236, 255, ${0.08 + state.karmanRatio * 0.24})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-20, airglowY + 2);
      ctx.quadraticCurveTo(w * 0.5, airglowY - 18 - state.leoRatio * 10, w + 20, airglowY + 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOrbitStars(ctx, flight, state) {
    const ratio = state.visualRatio;
    if (ratio <= 0.04) {
      return;
    }
    const w = gameCanvas.width;
    const h = gameCanvas.height;
    const starCount = Math.round(28 + state.karmanRatio * 44 + state.leoRatio * 52 + state.issRatio * 18);
    ctx.save();
    ctx.globalAlpha = 0.14 + state.stratosphereRatio * 0.22 + state.karmanRatio * 0.26 + state.leoRatio * 0.34;
    for (let i = 0; i < starCount; i += 1) {
      const x = fract(hash1(i * 5.4, 91) + flight.worldX * (0.00002 + i * 0.0000007)) * w;
      const y = hash1(i * 8.7, 131) * h * (0.72 - state.leoRatio * 0.08);
      const radius = 0.65 + hash1(i * 3.1, 27) * (1.4 + state.leoRatio * 0.9);
      ctx.fillStyle = i % 9 === 0
        ? "rgba(255, 235, 187, 0.92)"
        : i % 7 === 0
          ? "rgba(190, 226, 255, 0.92)"
          : "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawOrbitLines(ctx, flight, state) {
    if (state.karmanRatio <= 0.08) {
      return;
    }
    const w = gameCanvas.width;
    const h = gameCanvas.height;
    ctx.save();
    ctx.strokeStyle = `rgba(189, 219, 255, ${0.05 + state.karmanRatio * 0.12 + state.leoRatio * 0.12})`;
    ctx.lineWidth = 1.5;
    const orbitCount = state.leoRatio > 0.2 ? 4 : 2;
    for (let i = 0; i < orbitCount; i += 1) {
      const drift = Math.sin(flight.elapsed * 0.28 + i * 0.9) * 18;
      ctx.beginPath();
      ctx.ellipse(
        w * (0.72 - i * 0.11),
        h * (0.18 + i * 0.08),
        w * (0.14 + i * 0.08 + state.leoRatio * 0.04),
        h * (0.032 + i * 0.018 + state.leoRatio * 0.01),
        -0.16 + i * 0.03,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w * (0.82 - i * 0.08) + drift, h * (0.18 + i * 0.08), 2.3 + i, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.24 + state.karmanRatio * 0.16 + state.leoRatio * 0.2})`;
      ctx.fill();
    }
    if (state.leoRatio > 0.18) {
      const satelliteX = fract(hash1(19, 817) + flight.elapsed * 0.022) * (w + 80) - 40;
      const satelliteY = h * (0.16 + Math.sin(flight.elapsed * 0.42) * 0.03);
      ctx.translate(satelliteX, satelliteY);
      ctx.rotate(-0.18);
      ctx.fillStyle = `rgba(232, 242, 255, ${0.36 + state.leoRatio * 0.28})`;
      ctx.fillRect(-12, -1.5, 24, 3);
      ctx.fillRect(-2, -8, 4, 16);
      ctx.fillRect(-18, -5, 5, 10);
      ctx.fillRect(13, -5, 5, 10);
    }
    ctx.restore();
  }

  function phaseDeclutterScale(flight) {
    switch (flight.phase) {
      case "landing_roll":
        return 0.14;
      case "approach":
        return 0.22;
      case "descent":
        return 0.48;
      case "climbout":
        return 0.7;
      default:
        return 1;
    }
  }

  function drawSpeedLines(ctx, flight, speedRatio, spaceRatio) {
    const declutter = phaseDeclutterScale(flight);
    if (speedRatio <= 0.24 || declutter <= 0.16) {
      return;
    }
    const w = gameCanvas.width;
    const h = gameCanvas.height;
    const density = Math.max(6, Math.floor((10 + speedRatio * 18) * declutter));
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < density; i += 1) {
      const seed = i * 3.17;
      const x = fract(hash1(seed * 4.1, 401) + flight.elapsed * (0.18 + speedRatio * 0.62) + i * 0.031) * (w + 180) - 80;
      const y = h * (0.14 + hash1(seed * 6.2, 433) * 0.56);
      const length = (36 + speedRatio * 138 + hash1(seed * 7.9, 479) * 38) * (0.72 + declutter * 0.28);
      const alpha = (0.04 + speedRatio * 0.1) * declutter;
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 0.9 + speedRatio * 1.1 * declutter;
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

  function drawSeaSparkles(ctx, flight, sunRatio, nightRatio, spaceRatio) {
    if (getState().debugEnabled) {
      return;
    }
    const w = gameCanvas.width;
    ctx.save();
    for (let i = 0; i < 16; i += 1) {
      const seed = i * 4.8;
      const x = fract(hash1(seed, 563) + flight.elapsed * 0.04 + i * 0.013) * (w + 80) - 40;
      const worldX = cameraX(flight) + x;
      const seaY = surfaceScreenY(flight, worldX, x);
      const drift = Math.sin(flight.elapsed * (1.2 + i * 0.03) + i) * 2.2;
      const width = 8 + hash1(seed * 1.9, 587) * 20;
      const alpha = (0.04 + sunRatio * 0.12 + nightRatio * 0.06) * (1 - spaceRatio * 0.72);
      ctx.fillStyle = `rgba(255, 251, 233, ${alpha})`;
      ctx.fillRect(x - width * 0.5 + drift, seaY + 6 + hash1(seed * 3.1, 607) * 22, width, 1.8);
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
    const declutter = phaseDeclutterScale(flight);
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
    drawSeaSparkles(ctx, flight, sunRatio, nightRatio, spaceRatio);

    for (let band = 0; band < 2; band += 1) {
      ctx.save();
      ctx.strokeStyle = `rgba(210, 240, 255, ${(0.08 - band * 0.016 - spaceRatio * 0.04) * (0.7 + declutter * 0.3)})`;
      ctx.lineWidth = 5 - band;
      ctx.beginPath();
      for (let x = 0; x <= w + 16; x += 18) {
        const worldX = cameraX(flight) + x;
        const y = surfaceScreenY(flight, worldX, x) + 16 + band * 16 + Math.sin((worldX + flight.elapsed * 70) / (96 + band * 26)) * (3 + band);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.strokeStyle = `rgba(255,255,255,${(0.16 - spaceRatio * 0.08) * (0.64 + declutter * 0.36)})`;
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
      ctx.strokeStyle = `rgba(144, 214, 255, ${spaceRatio * 0.22 * (0.7 + declutter * 0.3)})`;
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
    if (speedRatio > 0.42 && declutter > 0.2) {
      ctx.save();
      ctx.strokeStyle = `rgba(227, 249, 255, ${(0.06 + speedRatio * 0.1) * declutter})`;
      ctx.lineWidth = 1 + speedRatio * 0.9 * declutter;
      for (let i = 0; i < Math.max(8, Math.floor(12 * declutter)); i += 1) {
        const seed = i * 5.3;
        const startX = fract(hash1(seed, 517) + flight.elapsed * (0.28 + speedRatio * 0.84) + i * 0.021) * (w + 140) - 70;
        const y = h * (0.8 + hash1(seed * 4.1, 541) * 0.12);
        const len = 54 + speedRatio * 94;
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

  function drawBackdropWindow(ctx, x, y, w, h, alpha = 0.8) {
    ctx.fillStyle = `rgba(255, 225, 168, ${alpha})`;
    drawRoundRectPath(ctx, x - w * 0.5, y - h * 0.5, w, h, Math.min(w, h) * 0.35);
    ctx.fill();
  }

  function drawAirportBackdrop(ctx, airport, x, groundY, palette, nightRatio, elapsed) {
    if (getState().debugEnabled) {
      return;
    }
    const accent = airport?.color || palette.accent;
    const dark = blendHex("#5b6e84", "#24384a", nightRatio * 0.58);
    const light = blendHex(accent, "#fff2df", 0.44);
    const warm = `rgba(255, 223, 165, ${0.24 + nightRatio * 0.46})`;
    ctx.save();
    ctx.translate(x, groundY - 18);

    const drawGlow = (gx, gy, radius, alpha = 0.18) => {
      ctx.beginPath();
      ctx.arc(gx, gy, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 225, 180, ${alpha})`;
      ctx.fill();
    };

    switch (airport?.backdrop) {
      case "mountains":
        ctx.fillStyle = blendHex("#b8c8d8", light, 0.18);
        ctx.beginPath();
        ctx.moveTo(-120, 0);
        ctx.lineTo(-84, -48);
        ctx.lineTo(-42, 0);
        ctx.lineTo(-10, -36);
        ctx.lineTo(30, 0);
        ctx.lineTo(74, -54);
        ctx.lineTo(122, 0);
        ctx.closePath();
        ctx.fill();
        [-90, -56, 56, 92].forEach((treeX, index) => {
          const size = 14 + (index % 2) * 3;
          ctx.fillStyle = blendHex("#6ea183", dark, 0.24);
          ctx.beginPath();
          ctx.moveTo(treeX, -2);
          ctx.lineTo(treeX - size * 0.55, -size);
          ctx.lineTo(treeX + size * 0.55, -size);
          ctx.closePath();
          ctx.fill();
        });
        break;
      case "coast":
        ctx.strokeStyle = blendHex("#9cc7da", "#4f7b9b", nightRatio * 0.52);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-118, 8);
        ctx.quadraticCurveTo(-72, 0, -28, 8);
        ctx.quadraticCurveTo(18, 16, 58, 6);
        ctx.quadraticCurveTo(88, 0, 118, 8);
        ctx.stroke();
        [-72, 78].forEach((palmX, index) => {
          ctx.strokeStyle = dark;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(palmX, 6);
          ctx.lineTo(palmX + (index === 0 ? -4 : 5), -28);
          ctx.stroke();
          ctx.fillStyle = blendHex("#7ecb95", "#517460", nightRatio * 0.26);
          [-12, -4, 6].forEach((leaf) => {
            ctx.beginPath();
            ctx.ellipse(palmX + leaf * 0.6, -32 + Math.abs(leaf) * 0.14, 10, 4, leaf * 0.08, 0, Math.PI * 2);
            ctx.fill();
          });
        });
        break;
      case "aztec":
        ctx.fillStyle = blendHex("#c18c5c", dark, nightRatio * 0.22);
        drawRoundRectPath(ctx, -38, -30, 76, 30, 6);
        ctx.fill();
        drawRoundRectPath(ctx, -28, -46, 56, 18, 5);
        ctx.fill();
        drawRoundRectPath(ctx, -16, -58, 32, 14, 4);
        ctx.fill();
        break;
      case "cloud-peaks":
        ctx.fillStyle = blendHex("#c8d9e3", light, 0.12);
        ctx.beginPath();
        ctx.moveTo(-110, 0);
        ctx.lineTo(-72, -42);
        ctx.lineTo(-34, 0);
        ctx.lineTo(0, -34);
        ctx.lineTo(42, 0);
        ctx.lineTo(88, -48);
        ctx.lineTo(122, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.beginPath();
        ctx.ellipse(-40, -44, 28, 12, 0, 0, Math.PI * 2);
        ctx.ellipse(42, -54, 30, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "skyline":
        [-74, -44, -16, 16, 46, 76].forEach((bx, index) => {
          const bh = 26 + (index % 3) * 12;
          ctx.fillStyle = blendHex(light, dark, 0.24 + index * 0.06);
          drawRoundRectPath(ctx, bx - 10, -bh, 20, bh, 4);
          ctx.fill();
          if (nightRatio > 0.08) {
            drawBackdropWindow(ctx, bx, -bh + 12, 4, 6, 0.5 + nightRatio * 0.34);
            drawBackdropWindow(ctx, bx, -bh + 24, 4, 6, 0.4 + nightRatio * 0.28);
          }
        });
        break;
      case "tram-hill":
        ctx.fillStyle = blendHex("#8bad83", dark, 0.22);
        ctx.beginPath();
        ctx.moveTo(-120, 0);
        ctx.quadraticCurveTo(-38, -42, 120, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = dark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-96, -26);
        ctx.lineTo(88, -40);
        ctx.stroke();
        ctx.fillStyle = light;
        drawRoundRectPath(ctx, -12, -40, 28, 14, 4);
        ctx.fill();
        break;
      case "clock":
        ctx.fillStyle = blendHex(light, dark, 0.16);
        drawRoundRectPath(ctx, -12, -68, 24, 68, 5);
        ctx.fill();
        drawRoundRectPath(ctx, -18, -88, 36, 22, 8);
        ctx.fill();
        ctx.fillStyle = "#fff6e8";
        ctx.beginPath();
        ctx.arc(0, -76, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = dark;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -76);
        ctx.lineTo(0, -81);
        ctx.moveTo(0, -76);
        ctx.lineTo(4, -73);
        ctx.stroke();
        break;
      case "bridge":
        ctx.strokeStyle = blendHex(light, dark, 0.18);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-112, -8);
        ctx.quadraticCurveTo(-56, -42, 0, -24);
        ctx.quadraticCurveTo(54, -8, 112, -22);
        ctx.stroke();
        [-46, 46].forEach((towerX) => {
          ctx.fillStyle = dark;
          drawRoundRectPath(ctx, towerX - 7, -54, 14, 42, 4);
          ctx.fill();
        });
        break;
      case "dunes":
        ctx.fillStyle = blendHex("#d7b170", dark, 0.16);
        ctx.beginPath();
        ctx.moveTo(-120, 0);
        ctx.quadraticCurveTo(-68, -18, -12, 0);
        ctx.quadraticCurveTo(42, 12, 120, -4);
        ctx.lineTo(120, 0);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(28, 0);
        ctx.lineTo(48, -34);
        ctx.lineTo(68, 0);
        ctx.closePath();
        ctx.fill();
        break;
      case "savanna":
        ctx.fillStyle = blendHex("#7ab277", dark, 0.28);
        ctx.fillRect(-3, -28, 6, 28);
        ctx.beginPath();
        ctx.ellipse(0, -36, 24, 10, 0, 0, Math.PI * 2);
        ctx.ellipse(-12, -32, 12, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(12, -32, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "spires":
        [-60, -28, 4, 34, 66].forEach((sx, index) => {
          const height = index === 2 ? 78 : 34 + index * 8;
          ctx.fillStyle = blendHex(light, dark, 0.18 + index * 0.08);
          ctx.beginPath();
          ctx.moveTo(sx - 7, 0);
          ctx.lineTo(sx, -height);
          ctx.lineTo(sx + 7, 0);
          ctx.closePath();
          ctx.fill();
        });
        break;
      case "arch":
        ctx.fillStyle = blendHex(light, dark, 0.16);
        drawRoundRectPath(ctx, -26, -48, 52, 48, 6);
        ctx.fill();
        ctx.clearRect(-10, -20, 20, 20);
        ctx.strokeStyle = dark;
        ctx.lineWidth = 3;
        ctx.strokeRect(-10, -20, 20, 20);
        break;
      case "gardens":
        ctx.fillStyle = blendHex("#9dd5c4", dark, 0.18);
        ctx.beginPath();
        ctx.arc(-24, -18, 20, Math.PI, 0);
        ctx.arc(22, -16, 24, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(-4, -48, 8, 48);
        ctx.beginPath();
        ctx.arc(0, -58, 16, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "harbor":
        [-64, -34, -6, 24, 54].forEach((bx, index) => {
          const bh = 24 + (index % 2) * 10;
          ctx.fillStyle = blendHex(light, dark, 0.22 + index * 0.06);
          drawRoundRectPath(ctx, bx - 8, -bh, 16, bh, 4);
          ctx.fill();
        });
        ctx.strokeStyle = blendHex("#96c6de", dark, 0.26);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-112, 8);
        ctx.lineTo(112, 8);
        ctx.stroke();
        break;
      case "taipei-tower":
        ctx.fillStyle = blendHex(light, dark, 0.16);
        drawRoundRectPath(ctx, -10, -74, 20, 74, 4);
        ctx.fill();
        [-58, -46, -34, -22].forEach((stepY, index) => {
          drawRoundRectPath(ctx, -16 + index, stepY, 32 - index * 2, 8, 3);
          ctx.fill();
        });
        ctx.fillRect(-2, -90, 4, 16);
        break;
      case "gate":
        ctx.fillStyle = blendHex(light, dark, 0.18);
        drawRoundRectPath(ctx, -38, -34, 76, 18, 5);
        ctx.fill();
        drawRoundRectPath(ctx, -30, -18, 12, 18, 4);
        ctx.fill();
        drawRoundRectPath(ctx, 18, -18, 12, 18, 4);
        ctx.fill();
        break;
      case "torii":
        ctx.fillStyle = blendHex("#ef7f67", dark, nightRatio * 0.16);
        ctx.fillRect(-20, -36, 6, 36);
        ctx.fillRect(14, -36, 6, 36);
        ctx.fillRect(-28, -40, 54, 6);
        ctx.fillRect(-24, -50, 46, 5);
        break;
      case "bund":
        [-74, -48, -20, 10, 44].forEach((bx, index) => {
          const bh = index === 2 ? 68 : 26 + index * 8;
          ctx.fillStyle = blendHex(light, dark, 0.18 + index * 0.06);
          drawRoundRectPath(ctx, bx - 8, -bh, 16, bh, 4);
          ctx.fill();
        });
        ctx.fillStyle = blendHex("#f6d6df", dark, 0.16);
        ctx.beginPath();
        ctx.ellipse(-20, -78, 10, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "opera":
        ctx.fillStyle = blendHex("#f7f3ef", dark, 0.12);
        [-30, -6, 18].forEach((sx, index) => {
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.quadraticCurveTo(sx + 8, -28 - index * 8, sx + 26, 0);
          ctx.closePath();
          ctx.fill();
        });
        break;
      case "volcano":
        ctx.fillStyle = blendHex("#889f84", dark, 0.24);
        ctx.beginPath();
        ctx.moveTo(-46, 0);
        ctx.lineTo(0, -50);
        ctx.lineTo(52, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = warm;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-6, -56);
        ctx.quadraticCurveTo(2 + Math.sin(elapsed * 1.6) * 3, -70, 12, -56);
        ctx.stroke();
        break;
      default:
        [-42, -14, 16, 44].forEach((bx, index) => {
          ctx.fillStyle = blendHex(light, dark, 0.22 + index * 0.06);
          drawRoundRectPath(ctx, bx - 9, -28 - index * 6, 18, 28 + index * 6, 4);
          ctx.fill();
        });
        break;
    }

    if (nightRatio > 0.14) {
      [-68, -28, 18, 58].forEach((lx, index) => {
        drawGlow(lx, -18 - (index % 2) * 14, 8 + (index % 2) * 2, 0.08 + nightRatio * 0.1);
      });
    }
    ctx.restore();
  }

  function getAirportOpsProfile(airport) {
    const base = {
      edgeLight: "#ffdca6",
      centerLight: "#fff4cf",
      taxiLight: "#9fdbff",
      centerStep: 28,
      bridgeStyle: "glass",
      bridges: 1,
      apronSide: 1,
      terminalStyle: "modern",
      vehicles: ["cart", "fuel"],
      towerCall: "steady on final",
      towerTone: "calm and gentle",
      flareCall: "easy now, hold the flare",
      rolloutCall: "welcome in, let it roll easy",
      profilePraise: "pretty line, keep it there",
      correctionHigh: "ease it down a touch",
      correctionSink: "hold it softer, ease the sink",
      guidanceAccent: "#ffe8ba",
      papiRed: "#ff9a84",
      papiWhite: "#fff8e8",
      arrivalTag: "arrival lane",
    };

    switch (airport?.backdrop) {
      case "mountains":
        return { ...base, edgeLight: "#cdefff", taxiLight: "#a7e2cb", bridgeStyle: "wood", terminalStyle: "lodge", apronSide: -1, vehicles: ["cart", "fuel"], towerCall: "glide over the peaks", towerTone: "crisp mountain calm", flareCall: "float it over the ridge lights", rolloutCall: "mountain runway is yours, roll it easy", profilePraise: "clean line over the harbor", correctionHigh: "come down below the ridge glow", correctionSink: "soften that sink over the peaks", guidanceAccent: "#dff6ff", arrivalTag: "harbor mountain approach" };
      case "coast":
        return { ...base, edgeLight: "#ffd9b1", taxiLight: "#91d7ff", bridgeStyle: "retro", terminalStyle: "coast", apronSide: 1, vehicles: ["tram", "cart"], towerCall: "keep it smooth over the shoreline", towerTone: "sunny coastal warmth", flareCall: "coastline's under you, let it kiss", rolloutCall: "shoreline rollout, nice and easy", profilePraise: "lovely coastal line, keep it smooth", correctionHigh: "lower it a touch over the surf", correctionSink: "gentle now, don't drop it by the beach", guidanceAccent: "#ffe1be", arrivalTag: "coastal visual approach" };
      case "aztec":
        return { ...base, edgeLight: "#f6d37d", taxiLight: "#ffd9a8", bridgeStyle: "arch", terminalStyle: "stepped", apronSide: -1, vehicles: ["bus", "cart"], towerCall: "follow the golden centerline", towerTone: "sunlit ceremonial calm", flareCall: "golden lights ahead, hold that flare", rolloutCall: "sun stone runway welcomes you home", profilePraise: "beautiful line through the warm air", correctionHigh: "bring it down toward the golden path", correctionSink: "soft feet now, easy on the sink", guidanceAccent: "#ffe4a5", arrivalTag: "sun stone approach" };
      case "cloud-peaks":
        return { ...base, edgeLight: "#fff0d5", taxiLight: "#b4ecff", bridgeStyle: "glass", terminalStyle: "terrace", apronSide: 1, vehicles: ["cart", "fuel"], towerCall: "thread the cloud shelf", towerTone: "soft highland whisper", flareCall: "terrace lights ahead, hold it floating", rolloutCall: "terrace runway secure, let it coast", profilePraise: "nice cloud shelf line, keep that grace", correctionHigh: "ease lower beneath the cloud lip", correctionSink: "soften the drop through the mist", guidanceAccent: "#edf8ff", arrivalTag: "cloud terrace final" };
      case "skyline":
        return { ...base, edgeLight: "#ffd7ba", taxiLight: "#bfe1ff", bridgeStyle: "tube", bridges: 2, terminalStyle: "glassline", apronSide: 1, vehicles: ["bus", "fuel"], towerCall: "city lights ahead, stay centered", towerTone: "big-city velvet calm", flareCall: "runway's in the skyline, ease the flare", rolloutCall: "welcome to the city, keep that rollout straight", profilePraise: "that's a polished city line", correctionHigh: "bring it down into the light corridor", correctionSink: "easy now, don't thump it into the city", guidanceAccent: "#ffd6c3", arrivalTag: "skyline corridor" };
      case "tram-hill":
        return { ...base, edgeLight: "#ffe1b8", taxiLight: "#8bd4ff", bridgeStyle: "arched", terminalStyle: "hillside", apronSide: -1, vehicles: ["tram", "cart"], towerCall: "ride the hill and flare late", towerTone: "playful hillside sing-song", flareCall: "tram lights below, hold it a beat longer", rolloutCall: "hillside runway looks lovely, let it slow", profilePraise: "sweet line down the hillside", correctionHigh: "dip it under the tram glow", correctionSink: "easy there, soften the hill drop", guidanceAccent: "#ffe7c7", arrivalTag: "hill tram approach" };
      case "clock":
        return { ...base, edgeLight: "#ffd4c7", taxiLight: "#d2dfff", bridgeStyle: "brick", terminalStyle: "clockhall", apronSide: 1, vehicles: ["bus", "cart"], towerCall: "tower says hold the line", towerTone: "polite old-city precision", flareCall: "steady now, quite a lovely flare", rolloutCall: "splendid landing, roll it through", profilePraise: "excellent form, keep that exact line", correctionHigh: "a touch lower if you please", correctionSink: "mind the sink, easy does it", guidanceAccent: "#ffd7de", arrivalTag: "royal final" };
      case "bridge":
        return { ...base, edgeLight: "#ffd7af", taxiLight: "#9ad8ff", bridgeStyle: "suspension", terminalStyle: "bridgeport", apronSide: -1, vehicles: ["fuel", "tram"], towerCall: "crosswind over the bridge, hold center", towerTone: "harbor crosswind focus", flareCall: "bridge lights aligned, hold the flare", rolloutCall: "bridgeport rollout, keep it centered", profilePraise: "good bridge line, stay right there", correctionHigh: "lower it into the bridge corridor", correctionSink: "crosswind's biting, ease the sink", guidanceAccent: "#ffe0c0", arrivalTag: "bridge line visual" };
      case "dunes":
        return { ...base, edgeLight: "#ffd68c", taxiLight: "#ffdca5", bridgeStyle: "sand", terminalStyle: "desert", apronSide: 1, vehicles: ["bus", "fuel"], towerCall: "heat haze ahead, keep the nose calm", towerTone: "warm desert hush", flareCall: "easy through the haze, float it in", rolloutCall: "desert lights have you, let it run", profilePraise: "nice calm line through the heat", correctionHigh: "let it settle below the shimmer", correctionSink: "too much sink in the hot air, ease it", guidanceAccent: "#ffe1ab", arrivalTag: "desert glow final" };
      case "savanna":
        return { ...base, edgeLight: "#ffe3a9", taxiLight: "#b7e3a6", bridgeStyle: "canopy", terminalStyle: "safari", apronSide: -1, vehicles: ["cart", "bus"], towerCall: "easy flare on the warm runway", towerTone: "golden evening warmth", flareCall: "easy now, let it settle like a feather", rolloutCall: "savanna runway secure, roll it gentle", profilePraise: "that's a soft savanna line", correctionHigh: "bring it down toward the warm lights", correctionSink: "too quick into the warm runway, soften it", guidanceAccent: "#f3efb8", arrivalTag: "savanna approach" };
      case "spires":
        return { ...base, edgeLight: "#ffd0aa", taxiLight: "#a8d6ff", bridgeStyle: "sleek", bridges: 2, terminalStyle: "spire", apronSide: 1, vehicles: ["fuel", "bus"], towerCall: "spires off the nose, descend steady", towerTone: "desert metropolis poise", flareCall: "spire lights ahead, now hold the float", rolloutCall: "metropolis runway is yours, keep it smooth", profilePraise: "clean corridor between the spires", correctionHigh: "drop into the spire corridor", correctionSink: "too firm for the spire line, ease it", guidanceAccent: "#ffd6af", arrivalTag: "spire corridor" };
      case "arch":
        return { ...base, edgeLight: "#ffd789", taxiLight: "#ffd6b0", bridgeStyle: "courtyard", terminalStyle: "arch", apronSide: -1, vehicles: ["cart", "fuel"], towerCall: "glide through the arch lights", towerTone: "courtyard lantern calm", flareCall: "arch lights beneath you, hold it sweet", rolloutCall: "courtyard runway complete, let it breathe", profilePraise: "beautiful line through the lanterns", correctionHigh: "come down into the arch glow", correctionSink: "soft feet through the arch lights", guidanceAccent: "#ffe0ba", arrivalTag: "archway final" };
      case "gardens":
        return { ...base, edgeLight: "#c8fff0", taxiLight: "#90d8ff", bridgeStyle: "garden", bridges: 2, terminalStyle: "canopy", apronSide: 1, vehicles: ["tram", "fuel"], towerCall: "follow the garden glow", towerTone: "lush garden serenity", flareCall: "garden lights are under you, float it on", rolloutCall: "garden runway received, let it coast", profilePraise: "nice graceful line through the gardens", correctionHigh: "settle a little lower into the glow", correctionSink: "too sharp for the garden lights, soften", guidanceAccent: "#d7fff2", arrivalTag: "garden light lane" };
      case "harbor":
        return { ...base, edgeLight: "#ffdcae", taxiLight: "#8fcfff", bridgeStyle: "pier", terminalStyle: "harbor", apronSide: 1, vehicles: ["bus", "cart"], towerCall: "harbor lights aligned, keep descending", towerTone: "dockside evening calm", flareCall: "pier lights below, hold the float", rolloutCall: "harbor rollout looks good, easy now", profilePraise: "harbor line looks tidy, keep it set", correctionHigh: "bring it down over the piers", correctionSink: "too much drop for the harbor lights", guidanceAccent: "#ffe2be", arrivalTag: "harbor final" };
      case "taipei-tower":
        return { ...base, edgeLight: "#ffd39b", taxiLight: "#96d6ff", bridgeStyle: "tech", terminalStyle: "tech", apronSide: -1, vehicles: ["fuel", "tram"], towerCall: "tower sighted, flare by the river lights", towerTone: "river-city night glow", flareCall: "river lights are there, now hold it gentle", rolloutCall: "Taipei rollout looks sweet, let it slow", profilePraise: "beautiful tower line, keep it centered", correctionHigh: "bring it down toward the river lights", correctionSink: "too quick over the river, soften it", guidanceAccent: "#ffe0b2", arrivalTag: "tower line approach" };
      case "gate":
        return { ...base, edgeLight: "#d7fff1", taxiLight: "#a2dfff", bridgeStyle: "gate", terminalStyle: "pavilion", apronSide: 1, vehicles: ["bus", "cart"], towerCall: "line up with the lantern gate", towerTone: "calm lantern ceremony", flareCall: "lantern gate ahead, hold it light", rolloutCall: "gate runway received, slow it with grace", profilePraise: "nice centered line through the gate", correctionHigh: "settle lower into the lantern gate", correctionSink: "easy now, lantern line needs a softer sink", guidanceAccent: "#e2fff5", arrivalTag: "gate final" };
      case "torii":
        return { ...base, edgeLight: "#ffd0bb", taxiLight: "#fff0cf", bridgeStyle: "lantern", terminalStyle: "timber", apronSide: -1, vehicles: ["cart", "fuel"], towerCall: "lantern path is yours, keep it gentle", towerTone: "quiet lantern courtesy", flareCall: "lantern path beneath you, hold the flare", rolloutCall: "welcome home, let the lantern runway carry you", profilePraise: "beautiful lantern line, stay with it", correctionHigh: "ease lower into the lantern path", correctionSink: "gentler now, don't drop through the lanterns", guidanceAccent: "#ffd9cc", arrivalTag: "lantern final" };
      case "bund":
        return { ...base, edgeLight: "#d6ddff", taxiLight: "#9fd7ff", bridgeStyle: "artdeco", terminalStyle: "bund", apronSide: 1, vehicles: ["tram", "bus"], towerCall: "river lights under you, settle now", towerTone: "riverfront midnight polish", flareCall: "bund lights ahead, hold a silver flare", rolloutCall: "riverfront runway confirmed, roll it smooth", profilePraise: "silky riverfront line, keep it precise", correctionHigh: "bring it down into the river glow", correctionSink: "too firm for the riverfront, ease the sink", guidanceAccent: "#dee4ff", arrivalTag: "riverfront final" };
      case "opera":
        return { ...base, edgeLight: "#d9f2ff", taxiLight: "#89d6ff", bridgeStyle: "shell", bridges: 2, terminalStyle: "opera", apronSide: -1, vehicles: ["cart", "fuel"], towerCall: "sails lit ahead, hold a graceful flare", towerTone: "harbor opera elegance", flareCall: "sails shining ahead, let it float with style", rolloutCall: "opera runway applauds that landing, keep rolling", profilePraise: "graceful line over the harbor sails", correctionHigh: "bring it lower toward the sail lights", correctionSink: "soften it, give the harbor a gentler touch", guidanceAccent: "#e5f7ff", arrivalTag: "opera approach" };
      case "volcano":
        return { ...base, edgeLight: "#ffd8b0", taxiLight: "#bfe7c8", bridgeStyle: "island", terminalStyle: "volcano", apronSide: 1, vehicles: ["bus", "fuel"], towerCall: "island lights steady, keep the sink soft", towerTone: "island dusk calm", flareCall: "island glow ahead, float it in softly", rolloutCall: "island runway secure, let it rumble down", profilePraise: "good island line, keep it mellow", correctionHigh: "lower it into the island glow", correctionSink: "too much sink over the island, soften", guidanceAccent: "#ffe3c5", arrivalTag: "island glow final" };
      default:
        return base;
    }
  }

  function towerStatusCall(ops, flight, lineState, landingAssist) {
    if (flight.phase === "landing_roll") {
      return ops.rolloutCall;
    }
    if (landingAssist.flareWindow) {
      return ops.flareCall;
    }
    if (lineState === "high sink") {
      return ops.correctionSink;
    }
    if (lineState === "slightly high") {
      return ops.correctionHigh;
    }
    if (flight.phase === "descent") {
      return ops.towerCall;
    }
    return ops.profilePraise;
  }

  function drawGroundVehicle(ctx, kind, x, y, accent, dark, nightRatio, elapsed) {
    const bob = Math.sin(elapsed * 2.8 + x * 0.05) * 0.8;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(-8, 7, 3, 0, Math.PI * 2);
    ctx.arc(8, 7, 3, 0, Math.PI * 2);
    ctx.fill();

    const body = blendHex(accent, "#f7fbff", 0.22);
    if (kind === "fuel") {
      ctx.fillStyle = body;
      drawRoundRectPath(ctx, -18, -4, 30, 12, 4);
      ctx.fill();
      ctx.fillStyle = blendHex("#fff8e1", accent, 0.1);
      drawRoundRectPath(ctx, 2, -11, 14, 10, 3);
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(12, -10);
      ctx.lineTo(18, -14);
      ctx.stroke();
    } else if (kind === "bus") {
      ctx.fillStyle = body;
      drawRoundRectPath(ctx, -20, -8, 40, 16, 5);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 233, 180, ${0.36 + nightRatio * 0.4})`;
      [-10, 0, 10].forEach((wx) => drawBackdropWindow(ctx, wx, -1, 5, 5, 0.56 + nightRatio * 0.2));
    } else if (kind === "tram") {
      ctx.fillStyle = body;
      drawRoundRectPath(ctx, -16, -6, 32, 14, 5);
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, -8);
      ctx.lineTo(14, -8);
      ctx.stroke();
    } else {
      ctx.fillStyle = body;
      drawRoundRectPath(ctx, -12, -4, 24, 12, 4);
      ctx.fill();
      ctx.fillStyle = blendHex("#fef1d9", accent, 0.16);
      drawRoundRectPath(ctx, 4, -10, 10, 8, 3);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawJetBridge(ctx, x, y, style, accent, dark, nightRatio) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = blendHex(accent, "#f8fbff", 0.46);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.5;
    const styles = {
      wood: { len: 34, drop: -12 },
      retro: { len: 44, drop: -8 },
      arch: { len: 36, drop: -10 },
      tube: { len: 48, drop: -14 },
      arched: { len: 42, drop: -10 },
      brick: { len: 34, drop: -9 },
      suspension: { len: 46, drop: -14 },
      sand: { len: 34, drop: -8 },
      canopy: { len: 38, drop: -12 },
      sleek: { len: 46, drop: -12 },
      courtyard: { len: 36, drop: -10 },
      garden: { len: 44, drop: -14 },
      pier: { len: 40, drop: -10 },
      tech: { len: 42, drop: -12 },
      gate: { len: 38, drop: -10 },
      lantern: { len: 36, drop: -9 },
      artdeco: { len: 42, drop: -11 },
      shell: { len: 44, drop: -13 },
      island: { len: 34, drop: -10 },
      glass: { len: 40, drop: -12 },
    };
    const profile = styles[style] || styles.glass;
    drawRoundRectPath(ctx, -profile.len, profile.drop, profile.len, 10, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = blendHex("#d5eaff", "#fdfefe", 0.4);
    drawRoundRectPath(ctx, -profile.len - 12, profile.drop - 8, 12, 18, 4);
    ctx.fill();
    if (nightRatio > 0.1) {
      ctx.fillStyle = `rgba(255, 226, 178, ${0.32 + nightRatio * 0.3})`;
      drawBackdropWindow(ctx, -profile.len * 0.5, profile.drop + 4, 6, 4, 0.52 + nightRatio * 0.18);
    }
    ctx.restore();
  }

  function drawAirportApron(ctx, airport, x, groundY, tone, nightRatio, elapsed) {
    if (getState().debugEnabled) {
      return;
    }
    const profile = getAirportOpsProfile(airport);
    const accent = airport?.color || tone;
    const dark = blendHex("#52677f", "#23384a", nightRatio * 0.58);
    const body = blendHex(accent, "#f7fbff", 0.32);
    const side = profile.apronSide;
    const anchorX = x + side * 170;
    ctx.save();

    const terminalBaseY = groundY - 26;
    ctx.fillStyle = blendHex(body, "#fef8ef", 0.16);
    switch (profile.terminalStyle) {
      case "lodge":
        drawRoundRectPath(ctx, anchorX - 56, terminalBaseY - 34, 112, 34, 8);
        ctx.fill();
        ctx.fillStyle = blendHex("#9e7c65", dark, 0.22);
        ctx.beginPath();
        ctx.moveTo(anchorX - 64, terminalBaseY - 34);
        ctx.lineTo(anchorX, terminalBaseY - 62);
        ctx.lineTo(anchorX + 64, terminalBaseY - 34);
        ctx.closePath();
        ctx.fill();
        break;
      case "stepped":
        [0, 1, 2].forEach((i) => {
          drawRoundRectPath(ctx, anchorX - 44 + i * 10, terminalBaseY - (18 + i * 10), 88 - i * 20, 18 + i * 10, 6);
          ctx.fill();
        });
        break;
      case "glassline":
      case "tech":
      case "bund":
      case "modern":
        drawRoundRectPath(ctx, anchorX - 62, terminalBaseY - 28, 124, 28, 10);
        ctx.fill();
        ctx.fillStyle = blendHex("#d3ebff", "#f5fbff", 0.28);
        drawRoundRectPath(ctx, anchorX - 48, terminalBaseY - 22, 96, 14, 7);
        ctx.fill();
        break;
      case "coast":
      case "opera":
        ctx.beginPath();
        ctx.moveTo(anchorX - 58, terminalBaseY);
        ctx.quadraticCurveTo(anchorX - 18, terminalBaseY - 38, anchorX + 12, terminalBaseY);
        ctx.quadraticCurveTo(anchorX + 34, terminalBaseY - 22, anchorX + 58, terminalBaseY);
        ctx.closePath();
        ctx.fill();
        break;
      case "hillside":
      case "bridgeport":
      case "harbor":
      case "pavilion":
        drawRoundRectPath(ctx, anchorX - 58, terminalBaseY - 24, 116, 24, 8);
        ctx.fill();
        break;
      case "clockhall":
      case "timber":
        drawRoundRectPath(ctx, anchorX - 54, terminalBaseY - 30, 108, 30, 8);
        ctx.fill();
        ctx.fillStyle = blendHex("#e7c8b9", dark, 0.12);
        drawRoundRectPath(ctx, anchorX - 20, terminalBaseY - 46, 40, 16, 6);
        ctx.fill();
        break;
      case "desert":
      case "arch":
      case "volcano":
      case "safari":
        drawRoundRectPath(ctx, anchorX - 52, terminalBaseY - 26, 104, 26, 8);
        ctx.fill();
        break;
      case "canopy":
        drawRoundRectPath(ctx, anchorX - 58, terminalBaseY - 22, 116, 22, 8);
        ctx.fill();
        ctx.fillStyle = blendHex("#8fd4ba", "#eef9f6", 0.3);
        ctx.beginPath();
        ctx.arc(anchorX, terminalBaseY - 28, 22, Math.PI, 0);
        ctx.fill();
        break;
      case "terrace":
      default:
        drawRoundRectPath(ctx, anchorX - 58, terminalBaseY - 28, 116, 28, 8);
        ctx.fill();
        drawRoundRectPath(ctx, anchorX - 42, terminalBaseY - 40, 84, 12, 6);
        ctx.fill();
        break;
    }

    ctx.fillStyle = `rgba(255, 229, 176, ${0.28 + nightRatio * 0.34})`;
    [-36, -12, 12, 36].forEach((wx) => {
      drawBackdropWindow(ctx, anchorX + wx, terminalBaseY - 12, 6, 6, 0.5 + nightRatio * 0.18);
    });

    const bridgeBaseY = terminalBaseY - 8;
    for (let i = 0; i < profile.bridges; i += 1) {
      const bridgeX = anchorX - side * (20 - i * 18);
      drawJetBridge(ctx, bridgeX, bridgeBaseY - i * 6, profile.bridgeStyle, accent, dark, nightRatio);
    }

    const apronLineY = groundY + 6;
    ctx.strokeStyle = `rgba(255,255,255,${0.24 + nightRatio * 0.18})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(anchorX - 94, apronLineY);
    ctx.lineTo(anchorX + 94, apronLineY);
    ctx.stroke();

    profile.vehicles.forEach((kind, index) => {
      drawGroundVehicle(
        ctx,
        kind,
        anchorX - 52 + index * 34 + Math.sin(elapsed * 0.8 + index) * 3,
        groundY + 14 + (index % 2) * 4,
        accent,
        dark,
        nightRatio,
        elapsed,
      );
    });

    ctx.restore();
  }

  function drawWindsock(ctx, x, groundY, nightRatio, elapsed) {
    const sway = Math.sin(elapsed * 2.6 + x * 0.01) * 5;
    ctx.save();
    ctx.strokeStyle = "#5a728d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, groundY - 8);
    ctx.lineTo(x, groundY - 42);
    ctx.stroke();

    ctx.translate(x, groundY - 42);
    ctx.rotate((-8 + sway) * Math.PI / 180);
    ctx.fillStyle = blendHex("#ffd6b0", "#ffe7d7", nightRatio * 0.26);
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(18, -5);
    ctx.lineTo(28, 0);
    ctx.lineTo(18, 5);
    ctx.lineTo(0, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f48367";
    ctx.fillRect(4, -4, 6, 8);
    ctx.fillRect(14, -3.4, 5, 6.8);
    ctx.restore();
  }

  function drawAirportRunway(ctx, x, groundY, label, tone, runwayHalf = 74, options = {}) {
    const nightRatio = clamp(options.nightRatio || 0, 0, 1);
    const approachActive = Boolean(options.approachActive);
    const airport = options.airport || null;
    const ops = getAirportOpsProfile(airport);
    const accent = options.accent || tone;
    const runwayWidth = runwayHalf * 2;
    const shoulderWidth = runwayWidth + 24;
    drawRoundRectPath(ctx, x - shoulderWidth * 0.5, groundY + 20, shoulderWidth, 16, 8);
    ctx.fillStyle = "rgba(67, 112, 89, 0.86)";
    ctx.fill();
    drawRoundRectPath(ctx, x - shoulderWidth * 0.5 - 10, groundY + 18, shoulderWidth + 20, 6, 6);
    ctx.fillStyle = "rgba(255, 235, 204, 0.46)";
    ctx.fill();
    drawRoundRectPath(ctx, x - runwayWidth * 0.5, groundY, runwayWidth, 16, 8);
    const runwayGradient = ctx.createLinearGradient(x, groundY, x, groundY + 16);
    runwayGradient.addColorStop(0, blendHex("#6d758f", "#4d5569", nightRatio * 0.56));
    runwayGradient.addColorStop(1, blendHex("#50596f", "#343a4a", nightRatio * 0.6));
    ctx.fillStyle = runwayGradient;
    ctx.fill();
    for (let i = -runwayWidth * 0.5 + 16; i <= runwayWidth * 0.5 - 16; i += ops.centerStep) {
      const glow = 0.24 + nightRatio * 0.5 + (approachActive ? 0.16 : 0);
      ctx.fillStyle = ops.edgeLight;
      ctx.globalAlpha = glow;
      ctx.beginPath();
      ctx.arc(x + i, groundY + 2, 1.9, 0, Math.PI * 2);
      ctx.arc(x + i, groundY + 14, 1.4, 0, Math.PI * 2);
      ctx.fill();
      if (nightRatio > 0.12) {
        ctx.beginPath();
        ctx.arc(x + i, groundY + 8, 5, 0, Math.PI * 2);
        ctx.fillStyle = ops.centerLight;
        ctx.globalAlpha = nightRatio * 0.08;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    [0, 1, 2, 3].forEach((index) => {
      const offset = 14 + index * 10;
      ctx.fillStyle = ops.centerLight;
      ctx.fillRect(x - runwayWidth * 0.5 + offset, groundY + 2, 7, 12);
      ctx.fillRect(x + runwayWidth * 0.5 - offset - 7, groundY + 2, 7, 12);
    });
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
        ctx.fillStyle = ops.taxiLight;
        ctx.globalAlpha = 0.12 + nightRatio * 0.2;
        ctx.fillRect(x - runwayWidth * 0.5 - 38 * i, groundY + 6, 10, 2);
      }
    }
    ctx.globalAlpha = 1;
    drawRoundRectPath(ctx, x - 10, groundY - 38, 20, 38, 5);
    ctx.fillStyle = "#f1f5ff";
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(x - 5, groundY - 29, 10, 16);
    drawRoundRectPath(ctx, x - 24, groundY - 60, 48, 20, 10);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();
    ctx.fillStyle = "#24445f";
    ctx.font = `700 ${Math.round(11 * (gameCanvas.width / 1080))}px "M PLUS Rounded 1c", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(label, x, groundY - 46);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `700 ${Math.round(9 * (gameCanvas.width / 1080))}px "M PLUS Rounded 1c", sans-serif`;
    ctx.fillText("soft landing lane", x, groundY + 31);
  }

  function drawRunwayIsland(ctx, flight, centerX, airport, tone, palette, options = {}) {
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

    ctx.save();
    ctx.strokeStyle = "rgba(255, 232, 198, 0.34)";
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.restore();

    for (let i = -2; i <= 2; i += 1) {
      const bushX = centerX - camX + i * (flight.runwayHalf * 0.58);
      if (bushX < -80 || bushX > gameCanvas.width + 80) {
        continue;
      }
      const bushY = worldToScreenY(flight, flight.runwayAltitude) + 28 + Math.abs(i) * 4;
      ctx.fillStyle = blendHex("#7dc9a1", "#45665a", nightRatio * 0.32);
      ctx.beginPath();
      ctx.arc(bushX, bushY, 10 - Math.abs(i), 0, Math.PI * 2);
      ctx.arc(bushX + 8, bushY + 2, 8 - Math.abs(i) * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    const screenX = centerX - camX;
    const groundY = worldToScreenY(flight, flight.runwayAltitude) + horizonCurveOffset(screenX, spaceAltitudeRatio(flight));
    const detail = 1 - Math.abs(screenX - gameCanvas.width * 0.5) / Math.max(1, gameCanvas.width * 0.32);
    if (detail > 0.12 || options.approachActive || Math.abs(centerX - flight.worldX) < flight.runwayHalf * 0.9) {
      drawAirportBackdrop(ctx, airport, screenX, groundY - 10, palette, nightRatio, flight.elapsed);
    }
    drawAirportApron(ctx, airport, screenX, groundY - 4, tone, nightRatio, flight.elapsed);
    drawAirportRunway(ctx, screenX, groundY - 16, airport.code, tone, flight.runwayHalf, {
      nightRatio,
      approachActive: options.approachActive,
      accent: airport.color,
      airport,
    });
    drawControlTower(ctx, screenX + flight.runwayHalf * 0.32, groundY + 4, tone, nightRatio, flight.elapsed);
    drawWindsock(ctx, screenX - flight.runwayHalf * 0.44, groundY + 8, nightRatio, flight.elapsed);
    drawRunwayReflection(ctx, flight, centerX, nightRatio * (options.approachActive ? 1.1 : 0.7));
  }

  function drawApproachGuides(ctx, flight, airport, runwayScreenX, runwayScreenY, flareWindow) {
    const ops = getAirportOpsProfile(airport);
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = ops.guidanceAccent;
    ctx.globalAlpha = 0.56;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(runwayScreenX - 210, runwayScreenY - 124);
    ctx.lineTo(runwayScreenX - 26, runwayScreenY - 14);
    ctx.moveTo(runwayScreenX - 210, runwayScreenY - 92);
    ctx.lineTo(runwayScreenX + 26, runwayScreenY - 14);
    ctx.stroke();
    if (flareWindow) {
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ops.guidanceAccent;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(runwayScreenX - 52, runwayScreenY - 42, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = ops.guidanceAccent;
      ctx.font = `700 ${Math.round(14 * (gameCanvas.width / 1080))}px "M PLUS Rounded 1c", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("flare", runwayScreenX - 52, runwayScreenY - 70);
    }

    ctx.globalAlpha = 1;
    for (let i = 0; i < 4; i += 1) {
      const color = i < 2 ? ops.papiWhite : ops.papiRed;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(runwayScreenX - 128 + i * 11, runwayScreenY - 10, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(runwayScreenX + 128 - i * 11, runwayScreenY - 10, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = `700 ${Math.round(11 * (gameCanvas.width / 1080))}px "M PLUS Rounded 1c", sans-serif`;
    ctx.fillText(ops.arrivalTag, runwayScreenX, runwayScreenY - 118);
    ctx.restore();
  }

  function drawArrivalTowerGuidance(ctx, flight, airport, landingAssist, destinationX, destinationY) {
    if (getState().debugEnabled) {
      return;
    }
    if (flight.phase !== "descent" && flight.phase !== "approach" && flight.phase !== "landing_roll") {
      return;
    }
    const ops = getAirportOpsProfile(airport);
    const boxWidth = Math.min(320, gameCanvas.width * 0.32);
    const boxX = gameCanvas.width - boxWidth - 18;
    const boxY = 96;
    const distance = Math.max(0, flight.arrivalAirportX - flight.worldX);
    const sink = Math.max(0, -flight.vy);
    const sinkMs = displaySinkRateMs(sink);
    const aglLabel = formatAltitudeValue(aglMeters(flight), true);
    const lineState = landingAssist.flareWindow
      ? "flare now"
      : sink > flight.landingBounceSink * 0.9
        ? "high sink"
        : flight.altitude > flight.runwayAltitude + flight.flareHeight + 120
          ? "slightly high"
          : "on profile";
    const lineColor = lineState === "on profile"
      ? "#b9f6d4"
      : lineState === "flare now"
        ? ops.guidanceAccent
        : "#ffc6b1";
    const towerMessage = towerStatusCall(ops, flight, lineState, landingAssist);
    ctx.save();
    drawRoundRectPath(ctx, boxX, boxY, boxWidth, 122, 18);
    ctx.fillStyle = "rgba(255, 252, 246, 0.86)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 2;
    ctx.stroke();

    drawRoundRectPath(ctx, boxX + 12, boxY + 12, 94, 24, 12);
    ctx.fillStyle = ops.guidanceAccent;
    ctx.globalAlpha = 0.24;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#29485f";
    ctx.font = `700 ${Math.round(12 * (gameCanvas.width / 1080))}px "Baloo 2", sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(`${airport.code} tower`, boxX + 22, boxY + 29);
    ctx.font = `600 ${Math.round(10 * (gameCanvas.width / 1080))}px "Baloo 2", sans-serif`;
    ctx.fillStyle = "rgba(76, 109, 132, 0.9)";
    ctx.textAlign = "right";
    ctx.fillText(ops.towerTone, boxX + boxWidth - 18, boxY + 29, boxWidth - 136);
    ctx.textAlign = "left";

    ctx.fillStyle = "rgba(47, 77, 103, 0.92)";
    ctx.font = `700 ${Math.round(15 * (gameCanvas.width / 1080))}px "M PLUS Rounded 1c", sans-serif`;
    ctx.fillText(towerMessage, boxX + 18, boxY + 56, boxWidth - 36);

    ctx.fillStyle = "rgba(86, 107, 126, 0.92)";
    ctx.font = `600 ${Math.round(11 * (gameCanvas.width / 1080))}px "M PLUS Rounded 1c", sans-serif`;
    ctx.fillText(ops.towerCall, boxX + 18, boxY + 76, boxWidth - 36);
    ctx.fillText(`距跑道 ${Math.round(distance)} m · 離地 ${aglLabel} · 下沉 ${sinkMs.toFixed(1)} m/s`, boxX + 18, boxY + 93, boxWidth - 36);

    drawRoundRectPath(ctx, boxX + 18, boxY + 101, boxWidth - 36, 10, 6);
    ctx.fillStyle = "rgba(214, 227, 235, 0.9)";
    ctx.fill();
    drawRoundRectPath(ctx, boxX + 18, boxY + 101, (boxWidth - 36) * clamp(1 - distance / 1800, 0, 1), 10, 6);
    ctx.fillStyle = lineColor;
    ctx.fill();

    drawRoundRectPath(ctx, boxX + boxWidth - 100, boxY + 16, 72, 20, 10);
    ctx.fillStyle = lineColor;
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = blendHex(lineColor, "#24384a", 0.45);
    ctx.font = `700 ${Math.round(10 * (gameCanvas.width / 1080))}px "Baloo 2", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(lineState, boxX + boxWidth - 64, boxY + 30);

    ctx.strokeStyle = "rgba(255,255,255,0.42)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(boxX + 14, boxY + 124);
    ctx.lineTo(destinationX - 24, destinationY - 34);
    ctx.stroke();
    ctx.restore();
  }

  function drawLandingFeedbackHud(ctx, flight, airport) {
    if (flight.phase !== "landing_roll") {
      return;
    }
    const ops = getAirportOpsProfile(airport);
    const width = Math.min(300, gameCanvas.width * 0.38);
    const x = 18;
    const y = gameCanvas.height - 104;
    const rating = flight.touchdownRating || "landing";
    ctx.save();
    drawRoundRectPath(ctx, x, y, width, 80, 16);
    ctx.fillStyle = "rgba(255, 252, 246, 0.84)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.74)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#29485f";
    ctx.textAlign = "left";
    ctx.font = `700 ${Math.round(15 * (gameCanvas.width / 1080))}px "M PLUS Rounded 1c", sans-serif`;
    ctx.fillText(`${airport.code} rollout · ${rating}`, x + 16, y + 24);
    ctx.font = `600 ${Math.round(11 * (gameCanvas.width / 1080))}px "M PLUS Rounded 1c", sans-serif`;
    ctx.fillStyle = "rgba(75, 99, 120, 0.92)";
    ctx.fillText(`速度 ${displaySpeedKmh(flight.speed)} km/h · 接地 ${displaySinkRateMs(flight.touchdownSinkRate).toFixed(1)} m/s`, x + 16, y + 44, width - 32);
    ctx.fillText(ops.rolloutCall, x + 16, y + 60, width - 32);
    drawRoundRectPath(ctx, x + 16, y + 64, width - 32, 8, 4);
    ctx.fillStyle = "rgba(221, 231, 237, 0.9)";
    ctx.fill();
    drawRoundRectPath(ctx, x + 16, y + 64, (width - 32) * clamp(1 - flight.speed / 320, 0, 1), 8, 4);
    ctx.fillStyle = ops.guidanceAccent;
    ctx.fill();
    ctx.restore();
  }

  function drawTakeoffCue(ctx, flight, planeScreenY, spaceRatio) {
    if (getState().debugEnabled) {
      return;
    }
    const ready = flight.grounded && flight.runwayState === "departure"
      ? clamp((flight.speed - flight.rotateSpeed * 0.72) / Math.max(1, flight.takeoffSpeed - flight.rotateSpeed * 0.72), 0, 1)
      : 0;
    const burst = Math.max(flight.takeoffFlash, flight.phase === "climbout" ? Math.max(0, 1 - flight.phaseTime * 0.9) : 0);
    if (ready <= 0.02 && burst <= 0.02) {
      return;
    }
    const baseY = planeScreenY + 18;
    ctx.save();

    if (ready > 0.02) {
      const glowWidth = 120 + ready * 180;
      const glowHeight = 18 + ready * 12;
      const gradient = ctx.createRadialGradient(flight.screenX - 12, baseY + 4, 4, flight.screenX - 12, baseY + 4, glowWidth * 0.52);
      gradient.addColorStop(0, `rgba(255, 233, 176, ${0.14 + ready * 0.18})`);
      gradient.addColorStop(1, "rgba(255, 233, 176, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(flight.screenX - 12, baseY + 4, glowWidth, glowHeight, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (burst > 0.02) {
      const alpha = burst * (1 - spaceRatio * 0.7);
      ctx.strokeStyle = `rgba(255, 249, 228, ${0.38 * alpha})`;
      ctx.lineWidth = 2.4 + burst * 1.4;
      for (let i = 0; i < 3; i += 1) {
        const spread = 52 + i * 20 + burst * 40;
        ctx.beginPath();
        ctx.arc(flight.screenX - 12, baseY, spread, Math.PI * 0.9, Math.PI * 1.74);
        ctx.stroke();
      }
      for (let i = 0; i < 5; i += 1) {
        drawStar(
          ctx,
          flight.screenX - 36 - i * 16 - burst * 18,
          baseY - 8 - i * 4,
          2 + (4 - i) * 0.38,
          `rgba(255, 247, 214, ${0.24 + alpha * 0.28})`,
        );
      }
    }
    ctx.restore();
  }

  function drawTouchdownCue(ctx, flight, screenX, runwayY) {
    if (getState().debugEnabled) {
      return;
    }
    const cue = Math.max(flight.touchdownBloom, flight.phase === "landing_roll" ? Math.max(0, 0.5 - flight.phaseTime * 0.9) : 0);
    if (cue <= 0.02) {
      return;
    }
    ctx.save();
    const alpha = cue * 0.44;
    ctx.strokeStyle = `rgba(255, 240, 199, ${alpha})`;
    ctx.lineWidth = 2.6;
    for (let i = 0; i < 3; i += 1) {
      const radius = 18 + i * 16 + (1 - cue) * 42;
      ctx.beginPath();
      ctx.arc(screenX, runwayY + 6, radius, Math.PI * 0.08, Math.PI * 0.92);
      ctx.stroke();
    }
    for (let i = 0; i < 6; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      drawStar(
        ctx,
        screenX + side * (20 + i * 9),
        runwayY - 4 - (i % 3) * 10,
        2.2 + (5 - i) * 0.26,
        `rgba(255, 227, 170, ${0.18 + cue * 0.22})`,
      );
    }
    ctx.restore();
  }

  function drawRolloutCue(ctx, flight, runwayScreenY) {
    if (getState().debugEnabled) {
      return;
    }
    if (flight.phase !== "landing_roll") {
      return;
    }
    const cue = Math.max(flight.rolloutRibbon, clamp(flight.speed / 220, 0, 1) * 0.24);
    if (cue <= 0.02) {
      return;
    }
    ctx.save();
    ctx.lineCap = "round";
    const ribbonWidth = 130 + cue * 220;
    [-1, 1].forEach((side) => {
      const gradient = ctx.createLinearGradient(
        flight.screenX - ribbonWidth,
        runwayScreenY + 11 + side * 7,
        flight.screenX + 40,
        runwayScreenY + 11 + side * 7,
      );
      gradient.addColorStop(0, "rgba(255, 222, 164, 0)");
      gradient.addColorStop(0.6, `rgba(255, 222, 164, ${0.08 + cue * 0.16})`);
      gradient.addColorStop(1, `rgba(255, 248, 232, ${0.12 + cue * 0.18})`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.moveTo(flight.screenX - ribbonWidth, runwayScreenY + 11 + side * 7);
      ctx.lineTo(flight.screenX + 40, runwayScreenY + 11 + side * 7);
      ctx.stroke();
    });
    for (let i = 0; i < 5; i += 1) {
      const drift = (fract(hash1(i * 5.1, flight.seed + 919) + flight.elapsed * 0.8) - 0.5) * 24;
      drawStar(
        ctx,
        flight.screenX - 20 - i * 18 + drift,
        runwayScreenY - 10 - (i % 2) * 8,
        2 + (4 - i) * 0.32,
        `rgba(255, 248, 222, ${0.16 + cue * 0.2})`,
      );
    }
    ctx.restore();
  }

  function drawActors(ctx, flight, palette) {
    const camX = cameraX(flight);
    flight.actors.forEach((actor) => {
      if ((flight.phase === "approach" || flight.phase === "landing_roll") && actor.type === "jetstream") {
        return;
      }
      const x = actor.x - camX;
      const y = worldToScreenY(flight, actor.altitude) + horizonCurveOffset(x, spaceAltitudeRatio(flight));
      if (x < -120 || x > gameCanvas.width + 140 || y < -160 || y > gameCanvas.height + 160) {
        return;
      }
      if (actor.type === "jetstream") {
        drawJetstream(ctx, x, y, actor.rx, actor.ry, "rgba(205, 226, 255, 0.7)");
      } else {
        drawHazard(ctx, { ...actor, x, y });
      }
    });
  }

  function drawAltitudeRoutes(ctx, flight, spaceRatio) {
    const bands = getAltitudeRouteBands(flight);
    const activeBand = getAltitudeBandState(flight);
    if (flight.phase === "approach" || flight.phase === "landing_roll") {
      return;
    }
    const compact = flight.phase === "descent";
    const visibleBands = compact ? [activeBand] : bands;
    ctx.save();
    visibleBands.forEach((band, index) => {
      const y = worldToScreenY(flight, band.center);
      if (y < -70 || y > gameCanvas.height + 70) {
        return;
      }
      const active = band.id === activeBand.id;
      ctx.strokeStyle = band.color.replace(/0\.\d+\)/, `${compact ? 0.2 : active ? 0.28 : 0.12})`);
      ctx.lineWidth = compact ? 1.4 : active ? 2.2 : 1.2;
      ctx.setLineDash(compact ? [10, 12] : active ? [14, 10] : [10, 12]);
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

      if (!compact || active) {
        drawRoundRectPath(ctx, 18, y - 15, active ? 140 : 118, 26, 13);
        ctx.fillStyle = active ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.56)";
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
      }

      if (!compact && index < visibleBands.length - 1) {
        const nextY = worldToScreenY(flight, visibleBands[index + 1].center);
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
    const spaceState = spaceVisualState(flight);
    const spaceRatio = spaceAltitudeRatio(flight);
    const nightRatio = nightApproachRatio(flight);
    const camX = cameraX(flight);
    const planeScreenY = worldToScreenY(flight, flight.altitude);
    const speedRatio = clamp(flight.speed / Math.max(1, flight.maxSpeed), 0, 1);
    const landingAssist = landingAssistState(flight);

    const sky = gameCtx.createLinearGradient(0, 0, 0, h);
    const topBase = blendHex(
      blendHex(
        blendHex(palette.skyTop, palette.duskTop, 1 - sunRatio),
        "#13294f",
        nightRatio * 0.62 + spaceState.stratosphereRatio * 0.16,
      ),
      "#020814",
      spaceState.leoRatio * 0.72 + spaceState.issRatio * 0.12,
    );
    const midBase = blendHex(
      blendHex(
        blendHex(palette.skyMid, palette.duskTop, (1 - sunRatio) * 0.5),
        "#214778",
        nightRatio * 0.56 + spaceState.karmanRatio * 0.16,
      ),
      "#0d1c34",
      spaceState.leoRatio * 0.52,
    );
    const lowBase = blendHex(
      blendHex(
        blendHex(palette.skyBottom, palette.duskBottom, 1 - sunRatio),
        "#315277",
        nightRatio * 0.48 + spaceState.stratosphereRatio * 0.12,
      ),
      "#1a3858",
      spaceState.karmanRatio * 0.34,
    );
    sky.addColorStop(0, topBase);
    sky.addColorStop(0.42, midBase);
    sky.addColorStop(1, lowBase);
    gameCtx.fillStyle = sky;
    gameCtx.fillRect(0, 0, w, h);

    drawAtmosphereBands(gameCtx, flight, spaceState);
    drawOrbitStars(gameCtx, flight, spaceState);
    drawOrbitLines(gameCtx, flight, spaceState);
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
    drawRunwayIsland(gameCtx, flight, 0, AIRPORTS[route.from], "#78b0cc", palette, {
      nightRatio: nightRatio * 0.7,
      approachActive: false,
    });
    drawRunwayIsland(gameCtx, flight, flight.arrivalAirportX, AIRPORTS[route.to], "#4f7b9b", palette, {
      nightRatio,
      approachActive: flight.phase === "descent" || flight.phase === "approach" || flight.phase === "landing_roll",
    });
    drawRunwayMarks(gameCtx, flight);

    const destinationX = flight.arrivalAirportX - camX;
    const destinationY = worldToScreenY(flight, flight.runwayAltitude) + horizonCurveOffset(destinationX, spaceRatio);
    const destinationAirport = AIRPORTS[route.to];
    if ((flight.phase === "approach" || flight.phase === "descent") && !flight.grounded && destinationX > -220 && destinationX < w + 220) {
      drawApproachGuides(gameCtx, flight, destinationAirport, destinationX, destinationY - 16, landingAssist.flareWindow);
    }
    drawArrivalTowerGuidance(gameCtx, flight, destinationAirport, landingAssist, destinationX, destinationY - 16);

    drawAltitudeRoutes(gameCtx, flight, spaceRatio);
    drawActors(gameCtx, flight, palette);
    drawTouchdownEffects(gameCtx, flight);
    const planeRunwayY = worldToScreenY(flight, flight.runwayAltitude) + horizonCurveOffset(flight.screenX, spaceRatio);
    drawTakeoffCue(gameCtx, flight, planeScreenY, spaceRatio);
    drawTouchdownCue(gameCtx, flight, flight.screenX, planeRunwayY - 16);
    drawRolloutCue(gameCtx, flight, planeRunwayY - 16);
    drawLandingFeedbackHud(gameCtx, flight, destinationAirport);
    drawGhostPlane(gameCtx, flight, palette, spaceRatio);

    if (flight.shake > 0) {
      const shakeFrame = Math.floor(flight.elapsed * 120);
      const shakeX = (hash1(shakeFrame, flight.seed + 701) - 0.5) * flight.shake * 8;
      const shakeY = (hash1(shakeFrame, flight.seed + 809) - 0.5) * flight.shake * 8;
      gameCtx.save();
      gameCtx.translate(shakeX, shakeY);
    }
    drawPlaneWake(gameCtx, flight, flight.screenX, planeScreenY, palette, speedRatio, spaceRatio);
    drawPlane(gameCtx, flight.screenX, planeScreenY, flight.pitch, flight.propeller, palette, {
      gearDown: landingAssist.gearDown,
      spoilers: flight.spoilers,
      landingLight: !flight.grounded && landingAssist.gearDown ? 0.85 * (1 - spaceRatio * 0.72) : 0,
      flaps: flight.flapLift,
      vehicleStyle: flight.vehicleStyle,
      vehicleAccent: flight.vehicleAccent,
      vehicleStripe: flight.vehicleStripe,
      vehicleCanopy: flight.vehicleCanopy,
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
