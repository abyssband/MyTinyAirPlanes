import {
  assert,
  bootDebugPage,
  closeStaticServer,
  createStaticServer,
  getSnapshot,
  loadPlaywright,
  logStep,
  projectRoot,
} from "./playwright-support.mjs";

async function startRoute(page) {
  await page.evaluate(() => {
    document.getElementById("start-flight")?.click();
  });
  await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 9000 });
}

async function finishSuccess(page) {
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
}

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

    logStep("建立第一條航線的最佳鬼影");
    await bootDebugPage(page, url, 0);
    await startRoute(page);
    await finishSuccess(page);

    let storedGhost = await page.evaluate(() => JSON.parse(localStorage.getItem("tiny-airplanes.ghost-runs") || "{}"));
    assert(storedGhost["yvr-lax"]?.best, "預期成功結算後會寫入 yvr-lax 的最佳鬼影");
    assert(storedGhost["yvr-lax"]?.last, "預期成功結算後也會寫入最近回放");
    assert(storedGhost["yvr-lax"].best.samples?.length >= 2, "預期最佳鬼影至少包含起飛與降落兩個 sample");
    const bestTime = storedGhost["yvr-lax"].best.time;
    logStep(`最佳鬼影已寫入 localStorage，best=${bestTime}s`);

    logStep("再飛一次，建立較慢的最近回放");
    await page.evaluate(() => {
      window.__tinyAirplanes.startFlight(0);
    });
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 9000 });
    await page.waitForTimeout(1200);
    await finishSuccess(page);
    storedGhost = await page.evaluate(() => JSON.parse(localStorage.getItem("tiny-airplanes.ghost-runs") || "{}"));
    assert(storedGhost["yvr-lax"]?.last?.time >= bestTime, "預期最近回放時間應大於或等於最佳鬼影");
    assert(storedGhost["yvr-lax"]?.best?.time === bestTime, "預期較慢回放不會覆蓋最佳鬼影");
    logStep(`最近回放已更新，last=${storedGhost["yvr-lax"].last.time}s`);

    logStep("切換成使用最近回放，並確認偏好會持久化");
    await page.evaluate(() => {
      window.__tinyAirplanes.setGhostSlot("last");
    });

    logStep("重整頁面後確認鬼影仍存在");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.__tinyAirplanes?.getSnapshot));
    const mapSnapshot = await getSnapshot(page);
    assert(mapSnapshot.selectedRouteGhost?.bestTime > 0, "預期重整後仍能讀到最佳鬼影時間");
    assert(mapSnapshot.selectedRouteGhost?.lastTime >= mapSnapshot.selectedRouteGhost?.bestTime, "預期重整後仍保留最近回放時間");
    assert(mapSnapshot.selectedRouteGhost?.slot === "last", "預期重整後保留最近回放選擇");
    logStep(`重整後 best=${mapSnapshot.selectedRouteGhost.bestTime}s / last=${mapSnapshot.selectedRouteGhost.lastTime}s / slot=${mapSnapshot.selectedRouteGhost.slot}`);

    logStep("再次起飛，確認 ghost plane 會以最近回放載入");
    await page.evaluate(() => {
      window.__tinyAirplanes.startFlight(0);
    });
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 9000 });
    const flightSnapshot = await getSnapshot(page);
    assert(flightSnapshot.flight?.ghostAvailable === true, "預期再次起飛時會載入 ghost plane");
    assert(flightSnapshot.flight?.ghostSlot === "last", "預期再次起飛時會使用最近回放作為鬼影來源");
    assert(flightSnapshot.flight?.ghostFrames === storedGhost["yvr-lax"].last.samples.length, "預期鬼影 frame 數量與最近回放一致");
    logStep(`再次起飛已載入最近回放，ghostFrames=${flightSnapshot.flight.ghostFrames}`);

    console.log("");
    console.log("Ghost test passed");
    console.log(JSON.stringify({
      route: "yvr-lax",
      bestTime: mapSnapshot.selectedRouteGhost.bestTime,
      lastTime: mapSnapshot.selectedRouteGhost.lastTime,
      activeSlot: mapSnapshot.selectedRouteGhost.slot,
      ghostFrames: flightSnapshot.flight.ghostFrames,
    }, null, 2));
  } finally {
    await browser?.close();
    await closeStaticServer(server);
  }
}

main().catch((error) => {
  console.error("");
  console.error("Ghost test failed");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
