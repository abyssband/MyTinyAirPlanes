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
    await page.evaluate(() => {
      document.getElementById("start-flight")?.click();
    });
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 9000 });

    logStep("已進入飛行畫面，準備模擬落地後跑道不足");
    await page.evaluate(() => {
      const { flight } = window.__tinyAirplanes.getSnapshot();
      window.__tinyAirplanes.patchFlight({
        worldX: flight.arrivalRunwayEnd - 2,
        altitude: flight.runwayAltitude + flight.planeBottomOffset,
        cameraAltitude: flight.runwayAltitude + 150,
        vy: 0,
        speed: 420,
        throttle: 0.18,
        throttleTarget: 0.18,
        sun: 999,
        phase: "landing_roll",
        grounded: true,
        runwayState: "arrival",
        airbrake: true,
      });
    });

    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "result", null, { timeout: 2500 });
    const resultSnapshot = await getSnapshot(page);
    assert(resultSnapshot.result?.title?.includes("未完成"), "預期滑行衝出跑道後應進入失敗結算");
    assert(resultSnapshot.result?.body?.includes("跑道不夠長"), "預期失敗原因應標示為 landing_overrun");
    logStep("接地後無法在盡頭前停下時，會正確進入 landing_overrun 結算");

    console.log("");
    console.log("Landing overrun case passed");
    console.log(JSON.stringify({
      route: resultSnapshot.result.routeIndex,
      reason: "landing_overrun",
      rolloutSpeed: 420,
      runwayRemainingAtPatch: round(2),
    }, null, 2));
  } finally {
    await browser?.close();
    await closeStaticServer(server);
  }
}

main().catch((error) => {
  console.error("");
  console.error("Landing overrun case failed");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
