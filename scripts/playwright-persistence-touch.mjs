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

    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    });
    const desktopPage = await desktopContext.newPage();

    logStep("檢查正式頁面不暴露 debug API");
    await desktopPage.goto(`${url}/`, { waitUntil: "networkidle" });
    const prodSnapshot = await desktopPage.evaluate(() => ({
      hasApi: typeof window.__tinyAirplanes !== "undefined",
      debugHidden: document.getElementById("debug-toggle")?.hidden === true,
    }));
    assert(prodSnapshot.hasApi === false, "預期正式頁面不暴露 window.__tinyAirplanes");
    assert(prodSnapshot.debugHidden === true, "預期正式頁面隱藏 debug 切換按鈕");
    logStep("正式頁面已正確關閉 debug API");

    logStep("驗證舊存檔 migration 與版本化");
    await desktopPage.goto(`${url}/?debug=1&mute=1`, { waitUntil: "networkidle" });
    await desktopPage.waitForFunction(() => Boolean(window.__tinyAirplanes?.getSnapshot));
    await desktopPage.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("tiny-airplanes.unlocked-route", "2");
      localStorage.setItem("tiny-airplanes.best-runs", JSON.stringify({
        "tpe-hnd": { time: "18.5", stars: "9" },
      }));
      localStorage.setItem("tiny-airplanes.hangar", JSON.stringify({
        parts: "12",
        engine: "1",
        tank: "2",
        frame: "9",
      }));
      localStorage.removeItem("tiny-airplanes.save-version");
    });
    await desktopPage.reload({ waitUntil: "networkidle" });
    await desktopPage.waitForFunction(() => Boolean(window.__tinyAirplanes?.getSnapshot));

    let snapshot = await getSnapshot(desktopPage);
    let persisted = await desktopPage.evaluate(() => ({
      version: localStorage.getItem("tiny-airplanes.save-version"),
      hangar: JSON.parse(localStorage.getItem("tiny-airplanes.hangar") || "{}"),
      bestRuns: JSON.parse(localStorage.getItem("tiny-airplanes.best-runs") || "{}"),
    }));
    assert(snapshot.unlockedRoute === 2, `預期 migration 後保留已解鎖航線，實際 ${snapshot.unlockedRoute}`);
    assert(persisted.version === "5", `預期 migration 後寫入 save version 5，實際 ${persisted.version}`);
    assert(persisted.hangar?.upgrades?.frame === 5, `預期 migration 後機體升級被正規化到上限 5，實際 ${persisted.hangar?.upgrades?.frame}`);
    assert(persisted.bestRuns?.["tpe-hnd"]?.stars === 9, "預期 migration 後最佳紀錄保留並轉成數字");

    await desktopPage.evaluate(() => {
      window.__tinyAirplanes.setUnlockedRoute(3);
      window.__tinyAirplanes.setGhost(false);
    });
    await desktopPage.reload({ waitUntil: "networkidle" });
    await desktopPage.waitForFunction(() => Boolean(window.__tinyAirplanes?.getSnapshot));
    snapshot = await getSnapshot(desktopPage);
    assert(snapshot.unlockedRoute === 3, `預期重整後保留新的解鎖進度，實際 ${snapshot.unlockedRoute}`);
    assert(snapshot.ghostEnabled === false, "預期重整後保留鬼影關閉偏好");
    logStep("存檔 migration 與進度持久化正常");

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const mobilePage = await mobileContext.newPage();

    logStep("驗證觸控按鈕控制飛行");
    await bootDebugPage(mobilePage, url, 0);
    await mobilePage.evaluate(() => {
      document.getElementById("start-flight")?.click();
    });
    await mobilePage.waitForFunction(() => window.__tinyAirplanes.getSnapshot().screen === "flight", null, { timeout: 5000 });
    assert(await mobilePage.locator("#touch-controls").isVisible(), "預期手機模式下顯示觸控按鈕");

    await mobilePage.evaluate(() => {
      const { flight } = window.__tinyAirplanes.getSnapshot();
      window.__tinyAirplanes.patchFlight({
        worldX: Math.max(flight.worldX, flight.departureRunwayEnd + 180),
        altitude: 360,
        cameraAltitude: 330,
        vy: 0,
        speed: 210,
        phase: "cruise",
        grounded: false,
        runwayState: null,
      });
    });
    const beforeTouch = await getSnapshot(mobilePage);
    const throttleBefore = beforeTouch.flight.throttleTarget;

    await mobilePage.locator("#touch-up").dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 });
    await mobilePage.waitForTimeout(700);
    await mobilePage.locator("#touch-up").dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 });
    await mobilePage.waitForTimeout(120);
    const afterClimb = await getSnapshot(mobilePage);
    assert(
      afterClimb.flight.altitude > beforeTouch.flight.altitude + 12 && afterClimb.flight.verticalSpeed > 0,
      `預期觸控上升有效，實際高度 ${beforeTouch.flight.altitude} -> ${afterClimb.flight.altitude}`,
    );

    await mobilePage.locator("#touch-throttle-up").click();
    const afterThrottle = await getSnapshot(mobilePage);
    assert(afterThrottle.flight.throttleTarget > throttleBefore, "預期觸控加油後 throttle target 應上升");
    logStep("手機觸控飛行輸入正常");

    console.log("");
    console.log("Persistence + touch test passed");
    console.log(JSON.stringify({
      saveVersion: persisted.version,
      unlockedAfterReload: snapshot.unlockedRoute,
      touchAltitudeBefore: round(beforeTouch.flight.altitude),
      touchAltitudeAfter: round(afterClimb.flight.altitude),
      throttleAfterTouch: afterThrottle.flight.throttleTarget,
    }, null, 2));
  } finally {
    await browser?.close();
    await closeStaticServer(server);
  }
}

main().catch((error) => {
  console.error("");
  console.error("Persistence + touch test failed");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
