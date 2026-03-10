# My Tiny AirPlanes

粉彩可愛風格的 2D 橫向卷軸小飛機遊戲原型。

## 玩法

- 先在迷你世界地圖上選擇航線，從 A 機場飛往 B 機場。
- 起飛前會先播放航線過場動畫。
- 進入飛行後，飛機會持續向前巡航，你要控制高度、速度與進場角度。
- 起飛後下方世界會變成大片海面，鏡頭會跟著飛機一路往高空追。
- 飛得夠高時，天空會逐漸轉成近太空的軌道感視覺。
- 途中可以收集星星、穿過風流，並避開暴風雲與鳥群。
- 夕陽會持續下降；如果太晚還沒抵達，航班會失敗。
- 起飛時要先沿 A 機場跑道加速，速度足夠後再抬頭離地。
- 接近終點後要對準 B 機場跑道，以合適高度與下降速度接地，進場時會放起落架、進入 flare 提示，接地後則會有煙霧、減速板與滑跑痕跡。
- 結算畫面會顯示落地評價、接地速度與下降率，方便調整你的進場手感。
- 黃昏後的進場會逐步切到夜航氛圍，跑道燈、塔台 beacon 與海面反光都會變明顯。
- 飛行中可手動調整油門、襟翼與空氣煞車，讓起飛、巡航、進場和滑跑的節奏更細。
- 每條航線會同時保存 `最佳鬼影` 與 `最近回放`；你可以選擇下一次起飛要追哪一條半透明 ghost plane。
- 每條航線都有額外任務，完成後可以拿到更多零件。
- 每場結算都會獲得零件，可用於升級引擎、翼面與機體。

## 操作

- 桌機：
  - `W` / `↑` 抬頭拉升
  - `S` / `↓` 壓低機頭
  - `A` / `←` 收油門
  - `D` / `→` 加油門
  - `F` 切換襟翼
  - `Space` 空氣煞車
  - `G` 顯示或隱藏鬼影
- 手機：
  - 右下角 `上升` / `下降` / `收油` / `加油` / `襟翼` / `空煞` 觸控按鈕
- 音效：
  - 右上角 `音效: 開啟/關閉` 可切換 SFX 與 BGM
- 鬼影：
  - 右上角 `鬼影: 開啟/關閉` 可切換 ghost plane 顯示，並保留到下次開啟頁面
  - 航線卡與結算畫面可切換 `使用最佳鬼影` / `使用最近回放`
- 改裝：
  - 地圖右側 `小飛機改裝` 可強化速度、升力與暮光耐受

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
  - `patchFlight({ ... })`：直接調整測試中的飛行狀態
  - `getSnapshot()` 也會包含目前選定航線的 `selectedRouteGhost`（`bestTime / lastTime / slot`），以及飛行中的 `ghostAvailable / ghostSlot / ghostTime / ghostFrames`
- Playwright smoke test：
  1. `npm install -D playwright`
  2. `npx playwright install chromium`
  3. `npm run test:playwright`
- Playwright 失敗案例：
  - `npm run test:playwright:fail-missed`
  - `npm run test:playwright:fail-takeoff-overrun`
  - `npm run test:playwright:fail-landing-overrun`
  - `npm run test:playwright:fail-sunset`
  - `npm run test:playwright:fail-crash`
  - 驗證飛過跑道、起飛跑道不足、落地滑停失敗、夕陽耗盡、墜海/重落等分支
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
- `src/config.js`：航線、機場、升級、存檔 key 與 debug/mute 旗標
- `src/utils.js`：共用數學與顏色工具
- `src/storage.js`：存檔讀寫、版本化與 migration
- `src/audio.js`：WebAudio 控制器
- `src/flight/runtime.js`：飛行 state 建立、幾何 helper、actor 更新與 flight physics
- `src/flight/render.js`：海面/跑道/飛機/高空軌道視覺與飛行畫面渲染
- `scripts/playwright-ghost.mjs`：Playwright 鬼影存檔 / 載入驗證
- `scripts/playwright-smoke.mjs`：Playwright 自動 smoke test
- `scripts/playwright-fail-missed.mjs`：Playwright 跑道錯過失敗案例
- `scripts/playwright-fail-takeoff-overrun.mjs`：Playwright 起飛跑道不足案例
- `scripts/playwright-fail-landing-overrun.mjs`：Playwright 落地滑停失敗案例
- `scripts/playwright-fail-sunset.mjs`：Playwright 夕陽耗盡案例
- `scripts/playwright-fail-crash.mjs`：Playwright 墜海/重落案例
- `scripts/playwright-persistence-touch.mjs`：Playwright 存檔 migration / touch 整合測試
- `scripts/playwright-determinism.mjs`：Playwright flight seed / 初始雲層可重現測試
- `scripts/playwright-support.mjs`：Playwright 共用測試 helper
