# 專案 Skills

放在這裡的 skill 只在這個 repo 的 Claude Code session 生效。

## grill-me / grilling

來源：[mattpocock/skills](https://github.com/mattpocock/skills)（MIT，作者 Matt Pocock）
取得的 commit：`2ab9580`（2026-07-28）
授權條款全文：`LICENSE.mattpocock`

`grill-me` 是使用者手動呼叫的入口（`/grill-me`），本體只有一行，實際內容在 `grilling`。
兩個要一起放，只複製 `grill-me` 會找不到 `grilling` 而失效。

用途：在動手寫程式前，讓 Claude 一次一題把你的計畫問到底，每題附上建議答案，
你確認之後才開始做。適合用在改 `src/server.js` 的 webhook 流程、
或調整 `data/knowledge.md` 的客服回答邏輯之前。

### 更新方式

這是手動複製的快照，不會自動更新。要拿到新版就重新從上游複製，並更新上面的 commit 記錄。
如果你在自己電腦的 Claude Code CLI 上用，建議改裝官方 marketplace 版本，會自動更新：

```
/plugin install mattpocock-skills
```
