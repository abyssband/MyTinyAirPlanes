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
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 5000 });

    const startSnapshot = await getSnapshot(page);
    assert(startSnapshot.flight?.routeId === "tpe-hnd", "預期失敗案例從第一條航線開始");
    logStep("已進入飛行畫面，準備模擬飛過跑道");

    await page.evaluate(() => {
      const { flight } = window.__tinyAirplanes.getSnapshot();
      window.__tinyAirplanes.patchFlight({
        worldX: flight.arrivalRunwayEnd + 52,
        altitude: flight.runwayAltitude + flight.planeBottomOffset + 150,
        cameraAltitude: flight.runwayAltitude + 290,
        vy: 12,
        speed: 246,
        sun: 999,
        phase: "approach",
        grounded: false,
        runwayState: null,
      });
    });

    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "result", null, { timeout: 2500 });
    const resultSnapshot = await getSnapshot(page);
    assert(resultSnapshot.result?.title?.includes("失敗"), "預期飛過跑道後應進入失敗結算");
    assert(resultSnapshot.result?.body?.includes("飛過了機場"), "預期失敗原因應明確標示為錯過跑道");
    logStep("飛過 B 機場但未對準跑道時，會正確進入失敗結算");

    console.log("");
    console.log("Failure case passed");
    console.log(JSON.stringify({
      route: resultSnapshot.result.routeIndex,
      title: resultSnapshot.result.title,
      reason: "missed-runway",
      remainingBeforeFail: round(startSnapshot.flight.remaining),
    }, null, 2));
  } finally {
    await browser?.close();
    await closeStaticServer(server);
  }
}

main().catch((error) => {
  console.error("");
  console.error("Failure case failed");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
