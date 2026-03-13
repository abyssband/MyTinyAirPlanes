# My Tiny AirPlanes

粉彩可愛風格的 2D 橫向卷軸小飛機遊戲原型。

## 玩法

- 先在可愛化的真實世界地圖上選擇航線，從 A 機場飛往 B 機場。
- 世界地圖上的機場已擴成一組代表性的國際樞紐，從溫哥華、洛杉磯一路延伸到倫敦、杜拜、台北、東京、雪梨與奧克蘭。
- 起飛前會先播放航線過場動畫。
- 進入飛行後，飛機會持續向前巡航，你要控制高度、速度與進場角度。
- 地圖洲塊與機場分布改成參考真實世界比例，航程資訊也會顯示真實世界航距。
- 空中巡航現在分成三條高度帶可選：
  - `低空星線`：星星密集，但鳥群多、失誤容錯低
  - `中空穩定帶`：風流最穩，最適合保守通關
  - `高空噴流帶`：速度最快，但空氣稀薄、雷暴更多
- 起飛後下方世界會變成大片海面，鏡頭會跟著飛機一路往高空追。
- 飛得夠高時，天空會逐漸轉成近太空的軌道感視覺。
- 途中可以收集星星、穿過風流，並避開暴風雲與鳥群。
- 航線上也會出現可愛的燃油補給；燃油耗盡時引擎會熄火，你得靠滑翔撐住，或趕快補到燃油。
- 天色會持續變暗，但不再因為時間耗盡直接判定失敗。
- 起飛時要先沿 A 機場跑道加速，速度足夠後再抬頭離地。
- 接近終點後要對準 B 機場跑道，以合適高度與下降速度接地，進場時會放起落架、進入 flare 提示，接地後則會有煙霧、減速板與滑跑痕跡。
- 結算畫面會顯示落地評價、接地速度與下降率，方便調整你的進場手感。
- 黃昏後的進場會逐步切到夜航氛圍，跑道燈、塔台 beacon 與海面反光都會變明顯。
- 飛行中只要用方向鍵：`↑ / ↓` 管高度、`← / →` 管速度，油門、襟翼與空氣煞車會自動配合階段處理。
- HUD 左側的第二格現在是燃油百分比；低油量和引擎熄火都會反映在系統提示與結算資訊裡。
- 每條航線會同時保存 `最佳鬼影` 與 `最近回放`；你可以選擇下一次起飛要追哪一條半透明 ghost plane。
- 每條航線都有額外任務，成功落地時會一起結算，方便你追求更漂亮的一趟飛行。

## 操作

- 桌機：
  - `↑` 抬頭拉升
  - `↓` 壓低機頭
  - `←` 減速進場
  - `→` 加速巡航
  - `G` 顯示或隱藏鬼影
- 手機：
  - 右下角 `上升` / `下降` / `減速` / `加速` 觸控按鈕
- 音效：
  - 右上角 `音效: 開啟/關閉` 可切換 SFX 與 BGM
- 鬼影：
  - 右上角 `鬼影: 開啟/關閉` 可切換 ghost plane 顯示，並保留到下次開啟頁面
  - 航線卡與結算畫面可切換 `使用最佳鬼影` / `使用最近回放`

## 執行方式

這是純前端專案，不需要安裝套件。

1. 在專案根目錄啟動靜態伺服器，例如：

   ```bash
   python3 -m http.server 5173
   ```

2. 開啟瀏覽器到：

   [http://localhost:5173](http://localhost:5173)

## 發佈

### GitHub Pages

這個專案已經附上 GitHub Pages workflow：

- `.github/workflows/deploy-pages.yml`
- `.nojekyll`

只要照下面做：

1. 把專案推到 GitHub repository
2. 確認預設分支是 `main`
3. 到 GitHub repository 的 `Settings -> Pages`
4. 在 `Build and deployment` 裡把 `Source` 設成 `GitHub Actions`
5. push 到 `main` 後，GitHub Actions 會自動部署

部署完成後，網址通常會是：

- `https://<你的帳號>.github.io/<repository-name>/`

### 其他簡單平台

- `itch.io`
  - 適合把這個作品當成可玩的瀏覽器小遊戲頁面
  - 需要上傳含 `index.html` 的 ZIP 檔
- `Netlify`
  - 最適合快速拖拉資料夾直接上線
- `Cloudflare Pages`
  - 適合接 GitHub 自動部署，也支援之後加自訂網域

## Debug 與驗證

- 正式頁面不暴露 debug API；只有以 `?debug=1` 開啟頁面時，飛行畫面右上角才會出現即時 debug 面板與測試 API。
- 以 `?debug=1&mute=1` 開啟頁面，可在測試時關閉音效初始化。
- 瀏覽器內可使用 `window.__tinyAirplanes`：
  - `getSnapshot()`：讀取目前畫面、飛行、高度、跑道 touchdown 狀態
  - `setAudio(true/false)`：切換音效存檔
  - `setGhost(true/false)`：切換鬼影顯示存檔
  - `setGhostSlot("best"|"last", routeIndex?)`：切換該航線下次起飛使用哪一條鬼影
  - `setDebug(true/false)`：切換 debug 面板
  - `selectRoute(index)` / `setUnlockedRoute(index)`：切換或解鎖航線
  - `startFlight(routeIndex)`：直接進入飛行
  - `setInput({ up, down, airbrake })` / `releaseInput()`：模擬輸入
  - `setThrottle(value)` / `adjustThrottle(delta)`：調整油門
  - `setFlaps(value)` / `cycleFlaps(step)`：調整襟翼
  - `patchFlight({ ... })`：直接調整測試中的飛行狀態，也可在 debug 測試中塞入自訂 `actors`
  - `getSnapshot()` 也會包含目前選定航線的 `selectedRouteGhost`（`bestTime / lastTime / slot`），以及飛行中的 `ghostAvailable / ghostSlot / ghostTime / ghostFrames`
  - 飛行 snapshot 也會包含 `fuel / maxFuel / fuelPct / engineOut / hadEngineOut`
- Playwright smoke test：
  1. `npm install -D playwright`
  2. `npx playwright install chromium`
  3. `npm run test:playwright`
- Playwright 失敗案例：
  - `npm run test:playwright:fail-missed`
  - `npm run test:playwright:fail-takeoff-overrun`
  - `npm run test:playwright:fail-landing-overrun`
  - `npm run test:playwright:fail-crash`
  - 驗證飛過跑道、起飛跑道不足、落地滑停失敗、墜海/重落等分支
- 燃油系統驗證：
  - `npm run test:playwright:fuel`
  - 驗證燃油耗盡後會熄火滑翔，並可透過燃油補給恢復引擎
- 天色耗盡不失敗驗證：
  - `npm run test:playwright:sunset-no-fail`
  - 驗證天色降到 0 後，航班仍會繼續進行
- 存檔與觸控整合驗證：
  - `npm run test:playwright:persistence-touch`
  - 驗證 debug API gating、存檔 migration、save version、解鎖進度與鬼影偏好持久化，以及手機觸控按鈕
- Seed 重現驗證：
  - `npm run test:playwright:determinism`
  - 驗證同一路線在重開與重整後，會得到相同的 flight seed 與初始雲層配置
- Ghost 回放驗證：
  - `npm run test:playwright:ghost`
  - 驗證成功結算後會同時儲存最佳鬼影與最近回放，重整後仍保留，並可切換下一次起飛使用的 ghost source
- 一次跑完整矩陣：
  - `npm run test:playwright:all`

## 專案檔案

- `index.html`：地圖、飛行、結算畫面結構
- `styles.css`：粉彩插畫風 UI 與響應式版面
- `main.js`：畫面切換、地圖流程、HUD、結果結算與主循環整合
- `src/config.js`：航線、機場、存檔 key 與 debug/mute 旗標
- `src/utils.js`：共用數學與顏色工具
- `src/storage.js`：存檔讀寫、版本化與 migration
- `src/audio.js`：WebAudio 控制器
- `src/flight/runtime.js`：飛行 state 建立、三條高度帶邏輯、actor 更新與 flight physics
- `src/flight/render.js`：海面/跑道/飛機/高空軌道視覺、鬼影與高度帶引導渲染
- `scripts/playwright-ghost.mjs`：Playwright 鬼影存檔 / 載入驗證
- `scripts/playwright-smoke.mjs`：Playwright 自動 smoke test
- `scripts/playwright-fail-missed.mjs`：Playwright 跑道錯過失敗案例
- `scripts/playwright-fail-takeoff-overrun.mjs`：Playwright 起飛跑道不足案例
- `scripts/playwright-fail-landing-overrun.mjs`：Playwright 落地滑停失敗案例
- `scripts/playwright-sunset-no-fail.mjs`：Playwright 天色耗盡但不中止飛行案例
- `scripts/playwright-fail-crash.mjs`：Playwright 墜海/重落案例
- `scripts/playwright-fuel.mjs`：Playwright 燃油耗盡 / 補給恢復驗證
- `scripts/playwright-persistence-touch.mjs`：Playwright 存檔 migration / touch 整合測試
- `scripts/playwright-determinism.mjs`：Playwright flight seed / 初始雲層可重現測試
- `scripts/playwright-support.mjs`：Playwright 共用測試 helper
