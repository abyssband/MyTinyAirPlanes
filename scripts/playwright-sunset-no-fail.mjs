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
    await page.evaluate(() => {
      document.getElementById("start-flight")?.click();
    });
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 9000 });

    logStep("已進入飛行畫面，準備模擬天色耗盡");
    await page.evaluate(() => {
      const { flight } = window.__tinyAirplanes.getSnapshot();
      window.__tinyAirplanes.patchFlight({
        worldX: Math.max(flight.worldX, flight.departureRunwayEnd + 180),
        altitude: 360,
        cameraAltitude: 330,
        vy: 0,
        speed: 210,
        sun: 0.001,
        phase: "cruise",
        grounded: false,
        runwayState: null,
        spawnCursor: Math.max(flight.worldX, flight.departureRunwayEnd + 180) + 2200,
        clearActors: true,
      });
    });

    await page.waitForTimeout(800);
    const snapshot = await getSnapshot(page);
    assert(snapshot.screen === "flight", "預期天色耗盡後仍保持在飛行畫面");
    assert(snapshot.flight?.sunPct === 0, `預期天色耗盡後 sunPct 應為 0，實際 ${snapshot.flight?.sunPct}`);
    logStep("天色耗盡後不再直接失敗，飛行可持續進行");

    console.log("");
    console.log("Sunset no-fail case passed");
    console.log(JSON.stringify({
      route: snapshot.flight?.routeId,
      screen: snapshot.screen,
      sunPct: snapshot.flight?.sunPct,
      phase: snapshot.flight?.phase,
    }, null, 2));
  } finally {
    await browser?.close();
    await closeStaticServer(server);
  }
}

main().catch((error) => {
  console.error("");
  console.error("Sunset no-fail case failed");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
