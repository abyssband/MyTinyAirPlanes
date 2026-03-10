import {
  assert,
  bootDebugPage,
  closeStaticServer,
  createStaticServer,
  getSnapshot,
  loadPlaywright,
  logStep,
  projectRoot,
  round,
} from "./playwright-support.mjs";

async function main() {
  const { chromium } = await loadPlaywright();
  const { server, url } = await createStaticServer(projectRoot);
  let browser;

  try {
    logStep(`靜態伺服器已啟動: ${url}`);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    });
    const page = await context.newPage();

    logStep("開啟遊戲頁面（debug + mute）");
    await bootDebugPage(page, url, 0);

    let snapshot = await getSnapshot(page);
    assert(snapshot.screen === "map", "預期初始畫面在世界地圖");
    logStep("地圖畫面與 debug API 可用");

    await page.evaluate(() => {
      document.getElementById("start-flight")?.click();
    });
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 5000 });
    snapshot = await getSnapshot(page);
    assert(snapshot.flight?.routeId === "tpe-hnd", "預期起飛後進入第一條航線");
    assert(snapshot.flight?.phase === "takeoff_roll", "預期飛行開場先進入跑道加速階段");
    logStep("可從地圖進入飛行畫面，並開始跑道滑跑");

    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().flight?.takeoffReady, null, { timeout: 4000 });
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(650);
    await page.keyboard.up("KeyW");
    await page.waitForFunction(() => !window.__tinyAirplanes.getSnapshot().flight?.grounded, null, { timeout: 2500 });
    const liftoffSnapshot = await getSnapshot(page);
    assert(!liftoffSnapshot.flight.grounded, "預期速度足夠時可從跑道離地");
    logStep(`起飛滑跑有效，離地速度 ${round(liftoffSnapshot.flight.speed)}`);

    await page.evaluate(() => {
      const { flight } = window.__tinyAirplanes.getSnapshot();
      window.__tinyAirplanes.patchFlight({
        worldX: Math.max(flight.worldX, flight.departureRunwayEnd + 180),
        altitude: 360,
        cameraAltitude: 330,
        vy: 0,
        speed: 210,
        phase: "cruise",
        grounded: false,
        runwayState: null,
      });
    });
    const cruiseSnapshot = await getSnapshot(page);
    const baseAltitude = cruiseSnapshot.flight.altitude;
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(950);
    await page.keyboard.up("KeyW");
    await page.waitForTimeout(120);
    const climbSnapshot = await getSnapshot(page);
    assert(
      climbSnapshot.flight.altitude > baseAltitude + 16 && climbSnapshot.flight.verticalSpeed > 0,
      `預期上升鍵能提高高度，實際只從 ${baseAltitude} 到 ${climbSnapshot.flight.altitude}，垂直速度 ${climbSnapshot.flight.verticalSpeed}`,
    );
    logStep(`上升輸入有效，高度 ${baseAltitude} -> ${round(climbSnapshot.flight.altitude)}`);

    await page.keyboard.down("ArrowDown");
    await page.waitForTimeout(900);
    await page.keyboard.up("ArrowDown");
    await page.waitForTimeout(120);
    const diveSnapshot = await getSnapshot(page);
    assert(
      diveSnapshot.flight.altitude < climbSnapshot.flight.altitude - 18 && diveSnapshot.flight.verticalSpeed < 0,
      `預期下降輸入能拉低高度，實際高度 ${climbSnapshot.flight.altitude} -> ${diveSnapshot.flight.altitude}，垂直速度 ${diveSnapshot.flight.verticalSpeed}`,
    );
    logStep(`下降輸入有效，高度 ${round(climbSnapshot.flight.altitude)} -> ${round(diveSnapshot.flight.altitude)}`);

    await page.keyboard.press("KeyD");
    let systemsSnapshot = await getSnapshot(page);
    assert(systemsSnapshot.flight.throttleTarget > 0.82, "預期加油門後 throttle target 應上升");
    await page.keyboard.press("KeyA");
    systemsSnapshot = await getSnapshot(page);
    assert(systemsSnapshot.flight.throttleTarget <= 0.82, "預期收油門後 throttle target 應下降");
    await page.keyboard.press("KeyF");
    systemsSnapshot = await getSnapshot(page);
    assert(systemsSnapshot.flight.flaps === 2, "預期切換襟翼後應進入下一段");
    await page.keyboard.down("Space");
    await page.waitForTimeout(160);
    systemsSnapshot = await getSnapshot(page);
    assert(systemsSnapshot.flight.airbrake === true, "預期空煞按下時 airbrake 應為 true");
    await page.keyboard.up("Space");
    await page.waitForTimeout(80);
    systemsSnapshot = await getSnapshot(page);
    assert(systemsSnapshot.flight.airbrake === false, "預期放開空煞後 airbrake 應回到 false");
    logStep(`飛機系統控制有效，油門 ${systemsSnapshot.flight.throttleTarget} / 襟翼 ${systemsSnapshot.flight.flaps}`);

    await page.evaluate(() => {
      const { flight } = window.__tinyAirplanes.getSnapshot();
      window.__tinyAirplanes.patchFlight({
        altitude: flight.altitude + 1900,
        cameraAltitude: flight.cameraAltitude + 1820,
        vy: 48,
        speed: 258,
      });
    });
    await page.waitForTimeout(160);
    const orbitSnapshot = await getSnapshot(page);
    assert(orbitSnapshot.flight.spaceRatio > 0.5, "預期高空時應進入近太空視角");
    logStep(`高空視角切換有效，spaceRatio=${orbitSnapshot.flight.spaceRatio}`);

    await page.evaluate(() => {
      const { flight } = window.__tinyAirplanes.getSnapshot();
      window.__tinyAirplanes.patchFlight({
        worldX: flight.arrivalRunwayStart + 28,
        altitude: flight.runwayAltitude + flight.planeBottomOffset + 2,
        cameraAltitude: flight.runwayAltitude + 220,
        vy: -72,
        speed: 136,
        sun: 999,
        phase: "approach",
        grounded: false,
        runwayState: null,
      });
    });
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "result", null, { timeout: 5000 });
    const resultSnapshot = await getSnapshot(page);
    assert(resultSnapshot.result?.title?.includes("順利抵達"), "預期對準跑道後應成功降落");
    assert(resultSnapshot.result?.body?.includes("落地評價"), "預期成功降落後結果畫面應顯示落地評價");
    logStep("跑道 touchdown 與滑停邏輯可進入成功結算");

    await page.evaluate(() => {
      document.getElementById("retry-flight")?.click();
    });
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 5000 });
    const retrySnapshot = await getSnapshot(page);
    assert(retrySnapshot.flight?.routeId === "tpe-hnd", "預期再飛一次會重新進入同一條航線");
    assert(retrySnapshot.flight?.phase === "takeoff_roll", "預期再飛一次後應從跑道滑跑重新開始");
    logStep("再飛一次按鈕可重新開始同一路線");

    console.log("");
    console.log("Smoke test passed");
    console.log(JSON.stringify({
      route: resultSnapshot.result.routeIndex,
      result: resultSnapshot.result.title,
      altitudeAfterClimb: climbSnapshot.flight.altitude,
      altitudeAfterDive: diveSnapshot.flight.altitude,
      throttleTarget: systemsSnapshot.flight.throttleTarget,
      flaps: systemsSnapshot.flight.flaps,
      spaceRatio: orbitSnapshot.flight.spaceRatio,
      retryPhase: retrySnapshot.flight.phase,
    }, null, 2));
  } finally {
    await browser?.close();
    await closeStaticServer(server);
  }
}

main().catch((error) => {
  console.error("");
  console.error("Smoke test failed");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
