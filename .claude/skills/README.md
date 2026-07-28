# 專案 Skills

放在這裡的 skill 只在這個 repo 的 Claude Code session 生效。

## 這個專案自己的（手動呼叫）

| Skill | 用途 |
|---|---|
| `/line-deploy-check` | 部署前核對 `src/server.js`、`.env.example`、`render.yaml` 三邊的環境變數是否一致，並確認簽章驗證沒被關掉 |
| `/line-smoke-test` | 本機起 server，用偽造簽章打假 webhook，確認真的回得出話 |

## 這個專案自己的（自動觸發）

| Skill | 何時會自己跳出來 |
|---|---|
| `knowledge-edit` | 要改 `data/knowledge.md` 時。整份檔案會進 AI 的 system prompt，直接影響對真實客戶的回答，所以有一套事實查證與護欄規則 |

## 從 mattpocock/skills 複製來的

來源：[mattpocock/skills](https://github.com/mattpocock/skills)（MIT，作者 Matt Pocock）
取得的 commit：`2ab9580`（2026-07-28）
授權條款全文：`LICENSE.mattpocock`

| Skill | 用途 |
|---|---|
| `/grill-me` | 動手前先被一次一題問到底，每題附建議答案，你確認才開始做 |
| `grilling` | `grill-me` 的本體。**兩個要一起放**，只複製 `grill-me` 會變成斷掉的參照 |
| `diagnosing-bugs` | 難纏的 bug 與效能問題的診斷流程。核心是「先建立一個會對這個 bug 變紅的回饋迴圈」 |

`diagnosing-bugs` 附帶 `scripts/hitl-loop.template.sh`，是上游的一部分，不要單獨刪掉。

沒有複製上游的 `code-review`：它依賴 `docs/agents/issue-tracker.md` 與 `/setup-matt-pocock-skills`，而且會跟 Claude Code 內建的 `/code-review` 撞名。

### 更新方式

這是手動複製的快照，不會自動更新。要拿到新版就重新從上游複製，並更新上面的 commit 記錄。
如果你在自己電腦的 Claude Code CLI 上用，建議改裝官方 marketplace 版本，會自動更新且包含全部 41 個 skill：

```
/plugin install mattpocock-skills
```

注意：`mattpocock-skills` 在 Claude Code CLI 的官方 marketplace，**不在** claude.ai 的 connector 目錄。在 claude.ai 網頁或手機上只能用這裡的複本。
