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

    const startSnapshot = await getSnapshot(page);
    assert(startSnapshot.flight?.phase === "takeoff_roll", "預期起飛失敗案例從跑道加速階段開始");
    logStep("已進入飛行畫面，準備模擬跑道用盡");

    await page.evaluate(() => {
      const { flight } = window.__tinyAirplanes.getSnapshot();
      window.__tinyAirplanes.patchFlight({
        worldX: flight.departureRunwayEnd + 6,
        altitude: flight.runwayAltitude + flight.planeBottomOffset,
        cameraAltitude: flight.runwayAltitude + 120,
        vy: 0,
        speed: 60,
        throttle: 0.18,
        throttleTarget: 0.18,
        phase: "takeoff_roll",
        grounded: true,
        runwayState: "departure",
      });
    });

    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "result", null, { timeout: 2500 });
    const resultSnapshot = await getSnapshot(page);
    assert(resultSnapshot.result?.title?.includes("未完成"), "預期跑道用盡後應進入失敗結算");
    assert(resultSnapshot.result?.body?.includes("跑道用完了"), "預期失敗原因應標示為起飛跑道不足");
    logStep("起飛跑道不足時，會正確進入 takeoff_overrun 結算");

    console.log("");
    console.log("Takeoff overrun case passed");
    console.log(JSON.stringify({
      route: resultSnapshot.result.routeIndex,
      reason: "takeoff_overrun",
      departureRemainingBeforeFail: round(startSnapshot.flight.departureRemaining),
    }, null, 2));
  } finally {
    await browser?.close();
    await closeStaticServer(server);
  }
}

main().catch((error) => {
  console.error("");
  console.error("Takeoff overrun case failed");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
