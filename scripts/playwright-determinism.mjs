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
  await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 5000 });
  return getSnapshot(page);
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

    logStep("開啟遊戲頁面（debug + mute）");
    await bootDebugPage(page, url, 0);

    const first = await startRoute(page);
    assert(first.flight?.cloudSignature, "預期 snapshot 帶有初始雲層 signature");
    assert(first.flight?.rngSeed === 17, `預期第一條航線 seed 為 17，實際 ${first.flight?.rngSeed}`);
    logStep(`第一次起飛雲層 signature: ${first.flight.cloudSignature}`);

    await page.evaluate(() => {
      window.__tinyAirplanes.startFlight(0);
    });
    await page.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 5000 });
    const second = await getSnapshot(page);

    assert(second.flight?.rngSeed === first.flight?.rngSeed, "預期重開同航線時 seed 不變");
    assert(
      second.flight?.cloudSignature === first.flight?.cloudSignature,
      `預期同一路線重開後雲層 signature 一致，實際 ${first.flight?.cloudSignature} vs ${second.flight?.cloudSignature}`,
    );
    logStep("同一路線重開後，初始雲層配置可重現");

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.__tinyAirplanes?.getSnapshot));
    await page.evaluate(() => {
      localStorage.clear();
      window.__tinyAirplanes.resetProgress();
      window.__tinyAirplanes.setDebug(true);
      window.__tinyAirplanes.setAudio(false);
      window.__tinyAirplanes.setUnlockedRoute(0);
      window.__tinyAirplanes.selectRoute(0);
    });
    const third = await startRoute(page);
    assert(
      third.flight?.cloudSignature === first.flight?.cloudSignature,
      "預期重整後同一路線的初始雲層 signature 仍一致",
    );
    logStep("重整後同一路線仍保有相同 seed 行為");

    console.log("");
    console.log("Determinism test passed");
    console.log(JSON.stringify({
      seed: first.flight.rngSeed,
      cloudSignature: first.flight.cloudSignature,
    }, null, 2));
  } finally {
    await browser?.close();
    await closeStaticServer(server);
  }
}

main().catch((error) => {
  console.error("");
  console.error("Determinism test failed");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
