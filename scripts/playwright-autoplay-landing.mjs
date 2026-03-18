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
} from "./playwright-support.mjs";

async function main() {
  const { chromium } = await loadPlaywright();
  const { server, url } = await createStaticServer(projectRoot);
  let browser;

  try {
    logStep(`靜態伺服器已啟動: ${url}`);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    }).then((context) => context.newPage());
    attachPageDiagnostics(page, "autoplay-landing");

    logStep("開啟遊戲頁面（debug + mute）");
    await bootDebugPage(page, url, 0);
    await page.evaluate(() => {
      document.getElementById("start-flight")?.click();
    });
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 9000 });

    await page.locator("#autoplay-toggle").click();
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().autoPlayEnabled === true, null, { timeout: 3000 });
    logStep("自動飛行已開啟，將航班切到最後進場前");

    await page.evaluate(() => {
      const snap = window.__tinyAirplanes.getSnapshot();
      const flight = snap.flight;
      window.__tinyAirplanes.patchFlight({
        worldX: flight.arrivalRunwayStart - 1600,
        altitude: flight.runwayAltitude + flight.planeBottomOffset + 170,
        cameraAltitude: flight.runwayAltitude + 210,
        vy: -22,
        speed: flight.landingMaxTouchdownSpeed * 0.9,
        phase: "approach",
        grounded: false,
        runwayState: null,
        clearActors: true,
      });
    });

    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "result", null, { timeout: 12000 });
    const snapshot = await getSnapshot(page);
    logStep(`自動飛行落地結果：${snapshot.result?.title || "unknown"} / ${snapshot.result?.summary || "no-summary"}`);
    assert(snapshot.result?.title?.includes("已抵達"), `預期自動飛行能完成降落，實際 ${snapshot.result?.title || "unknown"}`);
    logStep("自動飛行可完成最後進場並成功滑停");

    console.log("");
    console.log("Autoplay landing test passed");
    console.log(JSON.stringify({
      title: snapshot.result.title,
      route: snapshot.result.routeIndex,
      summary: snapshot.result.summary,
    }, null, 2));
  } finally {
    await browser?.close();
    await closeStaticServer(server);
  }
}

main().catch((error) => {
  console.error("");
  console.error("Autoplay landing test failed");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
