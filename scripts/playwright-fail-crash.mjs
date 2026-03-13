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

    logStep("已進入飛行畫面，準備模擬墜海/重落 crash");
    await page.evaluate(() => {
      const { flight } = window.__tinyAirplanes.getSnapshot();
      window.__tinyAirplanes.patchFlight({
        worldX: Math.max(flight.worldX, flight.departureRunwayEnd + 220),
        altitude: flight.planeBottomOffset + 6,
        cameraAltitude: 70,
        vy: -180,
        speed: 180,
        sun: 999,
        phase: "cruise",
        grounded: false,
        runwayState: null,
      });
    });

    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "result", null, { timeout: 2500 });
    const resultSnapshot = await getSnapshot(page);
    assert(resultSnapshot.result?.title?.includes("未完成"), "預期撞海或重落後應進入失敗結算");
    assert(resultSnapshot.result?.body?.includes("墜入海面") || resultSnapshot.result?.body?.includes("重落"), "預期失敗原因應標示為 crash");
    logStep("高度過低時，會正確進入 crash 結算");

    console.log("");
    console.log("Crash case passed");
    console.log(JSON.stringify({
      route: resultSnapshot.result.routeIndex,
      reason: "crash",
      patchedAltitude: round(6 + 0),
    }, null, 2));
  } finally {
    await browser?.close();
    await closeStaticServer(server);
  }
}

main().catch((error) => {
  console.error("");
  console.error("Crash case failed");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
