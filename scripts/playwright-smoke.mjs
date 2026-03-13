import {
  attachPageDiagnostics,
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
    attachPageDiagnostics(page, "smoke");

    logStep("開啟遊戲頁面（debug + mute）");
    await bootDebugPage(page, url, 0);

    let snapshot = await getSnapshot(page);
    assert(snapshot.screen === "map", "預期初始畫面在世界地圖");
    logStep("地圖畫面與 debug API 可用");

    await page.evaluate(() => {
      document.getElementById("start-flight")?.click();
    });
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 9000 });
    snapshot = await getSnapshot(page);
    assert(snapshot.flight?.routeId === "yvr-lax", "預期起飛後進入第一條航線");
    assert(snapshot.flight?.phase === "takeoff_roll", "預期飛行開場先進入跑道加速階段");
    logStep("可從地圖進入飛行畫面，並開始跑道滑跑");

    logStep("起飛開場狀態正確，接著切到穩定巡航區段測核心操控");

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
        spawnCursor: Math.max(flight.worldX, flight.departureRunwayEnd + 180) + 2200,
        clearActors: true,
      });
    });
    const cruiseSnapshot = await getSnapshot(page);
    const baseAltitude = cruiseSnapshot.flight.altitude;
    await page.evaluate(() => {
      window.__tinyAirplanes.setInput({ up: true });
    });
    await page.waitForFunction(
      (base) => {
        const flight = window.__tinyAirplanes.getSnapshot().flight;
        return flight.altitude > base + 2 && flight.verticalSpeed > 0;
      },
      baseAltitude,
      { timeout: 3200 },
    );
    await page.evaluate(() => {
      window.__tinyAirplanes.releaseInput();
    });
    await page.waitForTimeout(120);
    const climbSnapshot = await getSnapshot(page);
    assert(
      climbSnapshot.flight.altitude > baseAltitude + 2 && climbSnapshot.flight.verticalSpeed > 0,
      `預期上升鍵能提高高度，實際只從 ${baseAltitude} 到 ${climbSnapshot.flight.altitude}，垂直速度 ${climbSnapshot.flight.verticalSpeed}`,
    );
    logStep(`上升輸入有效，高度 ${baseAltitude} -> ${round(climbSnapshot.flight.altitude)}`);

    await page.evaluate(() => {
      window.__tinyAirplanes.setInput({ down: true });
    });
    await page.waitForFunction(
      (targetAltitude) => {
        const flight = window.__tinyAirplanes.getSnapshot().flight;
        return flight.altitude < targetAltitude - 4 && flight.verticalSpeed < 0;
      },
      climbSnapshot.flight.altitude,
      { timeout: 3200 },
    );
    await page.evaluate(() => {
      window.__tinyAirplanes.releaseInput();
    });
    await page.waitForTimeout(120);
    const diveSnapshot = await getSnapshot(page);
    assert(
      diveSnapshot.flight.altitude < climbSnapshot.flight.altitude - 4 && diveSnapshot.flight.verticalSpeed < 0,
      `預期下降輸入能拉低高度，實際高度 ${climbSnapshot.flight.altitude} -> ${diveSnapshot.flight.altitude}，垂直速度 ${diveSnapshot.flight.verticalSpeed}`,
    );
    logStep(`下降輸入有效，高度 ${round(climbSnapshot.flight.altitude)} -> ${round(diveSnapshot.flight.altitude)}`);

    await page.evaluate(() => {
      window.__tinyAirplanes.setInput({ right: true });
    });
    await page.waitForTimeout(180);
    let systemsSnapshot = await getSnapshot(page);
    assert(systemsSnapshot.flight.throttleTarget > 0.82 && systemsSnapshot.flight.right, "預期按住右鍵後應進入加速狀態");
    await page.evaluate(() => {
      window.__tinyAirplanes.setInput({ right: false, left: true });
    });
    await page.waitForTimeout(180);
    systemsSnapshot = await getSnapshot(page);
    assert(systemsSnapshot.flight.throttleTarget < 0.82 && systemsSnapshot.flight.airbrake === true && systemsSnapshot.flight.left, "預期按住左鍵後應減速並展開空煞");
    await page.evaluate(() => {
      window.__tinyAirplanes.releaseInput();
    });
    await page.waitForTimeout(80);
    systemsSnapshot = await getSnapshot(page);
    assert(systemsSnapshot.flight.airbrake === false && !systemsSnapshot.flight.left, "預期放開左鍵後應回到一般巡航控制");
    logStep(`方向鍵速度控制有效，油門 ${systemsSnapshot.flight.throttleTarget} / 襟翼 ${systemsSnapshot.flight.flaps}`);

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
    assert(resultSnapshot.result?.title?.includes("已抵達"), "預期對準跑道後應成功降落");
    assert(resultSnapshot.result?.body?.includes("落地評價"), "預期成功降落後結果畫面應顯示落地評價");
    logStep("跑道 touchdown 與滑停邏輯可進入成功結算");

    await page.evaluate(() => {
      document.getElementById("retry-flight")?.click();
    });
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 9000 });
    const retrySnapshot = await getSnapshot(page);
    assert(retrySnapshot.flight?.routeId === "yvr-lax", "預期再飛一次會重新進入同一條航線");
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
