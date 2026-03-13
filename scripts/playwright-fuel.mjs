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
      window.__tinyAirplanes.startFlight(0);
    });
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 9000 });

    logStep("把航班切到巡航狀態，準備測試燃油耗盡");
    await page.evaluate(() => {
      const { flight } = window.__tinyAirplanes.getSnapshot();
      window.__tinyAirplanes.patchFlight({
        worldX: Math.max(flight.worldX, flight.departureRunwayEnd + 260),
        altitude: 396,
        cameraAltitude: 360,
        vy: 0,
        speed: 1180,
        phase: "cruise",
        grounded: false,
        runwayState: null,
        fuel: 0.01,
        maxFuel: 96,
        engineOut: false,
        hadEngineOut: false,
        spawnCursor: flight.arrivalRunwayStart - 400,
        clearActors: true,
      });
    });

    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().flight?.engineOut === true, null, { timeout: 4000 });
    let snapshot = await getSnapshot(page);
    assert(snapshot.flight?.fuelPct === 0, `預期燃油耗盡後 fuelPct 應為 0，實際 ${snapshot.flight?.fuelPct}`);
    assert(snapshot.flight?.engineOut === true, "預期燃油耗盡後引擎應熄火");
    logStep("燃油耗盡後，飛機會進入 engine-out 滑翔");

    logStep("生成一個燃油補給，驗證補到油後引擎能恢復");
    await page.evaluate(() => {
      const { flight } = window.__tinyAirplanes.getSnapshot();
      window.__tinyAirplanes.patchFlight({
        fuel: 0,
        engineOut: true,
        actors: [
          {
            type: "fuel",
            band: "mid",
            x: flight.worldX + 18,
            altitude: flight.altitude,
            r: 18,
            amount: 28,
          },
        ],
      });
    });

    await page.waitForFunction(() => {
      const flight = window.__tinyAirplanes.getSnapshot().flight;
      return Boolean(flight && flight.engineOut === false && flight.fuel > 0);
    }, null, { timeout: 4000 });
    snapshot = await getSnapshot(page);
    assert(snapshot.flight?.fuel > 0, `預期補到燃油後 fuel 應大於 0，實際 ${snapshot.flight?.fuel}`);
    assert(snapshot.flight?.engineOut === false, "預期補到燃油後引擎應恢復");
    assert(snapshot.flight?.hadEngineOut === true, "預期 snapshot 應保留曾經熄火的紀錄");
    logStep(`燃油補給生效，燃油回到 ${round(snapshot.flight.fuel)} / ${round(snapshot.flight.maxFuel)}`);

    console.log("");
    console.log("Fuel system test passed");
    console.log(JSON.stringify({
      route: snapshot.flight.routeId,
      fuel: snapshot.flight.fuel,
      fuelPct: snapshot.flight.fuelPct,
      engineOut: snapshot.flight.engineOut,
      hadEngineOut: snapshot.flight.hadEngineOut,
    }, null, 2));
  } finally {
    await browser?.close();
    await closeStaticServer(server);
  }
}

main().catch((error) => {
  console.error("");
  console.error("Fuel system test failed");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
