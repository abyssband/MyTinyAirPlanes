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
    await bootDebugPage(page, url, 1);
    await page.evaluate(() => {
      document.getElementById("start-flight")?.click();
    });
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 9000 });

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
    assert(resultSnapshot.result?.continueRouteId === "mex-bog", "預期成功抵達 LAX 後，最近機場續飛應預設到 MEX -> BOG");
    logStep("結算畫面已給出最近機場續飛建議");

    await page.evaluate(() => {
      document.getElementById("continue-flight")?.click();
    });
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 9000 });
    const continueSnapshot = await getSnapshot(page);
    assert(continueSnapshot.flight?.routeId === "mex-bog", "預期按下繼續飛行後會進入最近機場的下一段航線");
    assert(continueSnapshot.flight?.phase === "takeoff_roll", "預期繼續飛行後應從新航段跑道滑跑開始");
    logStep("繼續飛行按鈕可直接接到最近機場的下一段航線");

    console.log("");
    console.log("Continue flight test passed");
    console.log(JSON.stringify({
      suggestedRoute: resultSnapshot.result.continueRouteId,
      startedRoute: continueSnapshot.flight.routeId,
      phase: continueSnapshot.flight.phase,
    }, null, 2));
  } finally {
    await browser?.close();
    await closeStaticServer(server);
  }
}

main().catch((error) => {
  console.error("");
  console.error("Continue flight test failed");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
