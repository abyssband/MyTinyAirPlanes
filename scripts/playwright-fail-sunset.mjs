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
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 5000 });

    logStep("已進入飛行畫面，準備模擬夕陽耗盡");
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
      });
    });

    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "result", null, { timeout: 2500 });
    const resultSnapshot = await getSnapshot(page);
    assert(resultSnapshot.result?.title?.includes("失敗"), "預期夕陽耗盡後應進入失敗結算");
    assert(resultSnapshot.result?.body?.includes("夕陽落下前"), "預期失敗原因應標示為 sunset");
    logStep("夕陽耗盡時，會正確進入 sunset 結算");

    console.log("");
    console.log("Sunset case passed");
    console.log(JSON.stringify({
      route: resultSnapshot.result.routeIndex,
      reason: "sunset",
    }, null, 2));
  } finally {
    await browser?.close();
    await closeStaticServer(server);
  }
}

main().catch((error) => {
  console.error("");
  console.error("Sunset case failed");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
