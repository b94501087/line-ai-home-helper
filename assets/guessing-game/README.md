# 和芮居家《你演我猜》影片素材

員工一日旅遊車上遊戲用。每支影片直式 9:16、5–15 秒、**無音軌、畫面零文字**。

## 結構

```
src/Q01_輕鬆移位.html   動畫原始檔（自足式 HTML + inline SVG + CSS keyframes）
src/shoot.js            用 Chromium 逐格截圖的腳本
out/Q01_輕鬆移位.mp4     成品
```

## 為什麼是 HTML

原本規劃用 HeyGen 的 avatar 影片生成，但那條路的產品邏輯是「講稿驅動的虛擬主播」，
和本專案的三條硬性限制衝突（不要旁白、不要字幕、需要雙人全身肢體互動）。

改走 HyperFrames by HeyGen 的路線：動畫以 HTML 撰寫。好處是畫面每一個像素都是自己控制的，
所以「絕對不會被自動加字幕、不會被硬塞旁白」是結構上保證的，不是事後檢查出來的。

## 重新產生影片

```bash
npm i playwright                    # PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
node src/shoot.js src/Q01_輕鬆移位.html frames 10 25
ffmpeg -framerate 25 -i frames/f%04d.png \
       -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart -an \
       out/Q01_輕鬆移位.mp4
```

`shoot.js` 用負的 `animation-delay` 逐格定位 CSS 動畫，所以輸出是決定性的
（同一份 HTML 每次算出來的畫面都一樣），不是螢幕錄影。

## 命名規則

`Q<題號>_<答案>.mp4`，例如 `Q01_輕鬆移位.mp4`。主持人當天照檔名發題。

## 每支影片的自我檢查

- [ ] 畫面上完全沒有文字、字幕、logo、招牌字
- [ ] 沒有音軌（`ffprobe` 只應看到一條 video stream）
- [ ] 場景是台灣的家：米白磁磚、黑色鐵窗、木質家具
- [ ] 人物：阿嬤短捲髮花上衣／阿公格子襯衫老花眼鏡／照服員淺藍 polo 衫
- [ ] 長度 5–15 秒、1080×1920
- [ ] 關掉聲音也看得懂在演什麼
