# LINE Bot Lite：Google Apps Script + Gemini

這個版本使用 Google Apps Script 呼叫 Gemini，並透過 Cloudflare Worker 接收 LINE webhook。

## 檔案

- `Code.gs`：Apps Script webhook 與 Gemini／LINE 回覆流程
- `appsscript.json`：Apps Script V8 設定
- `line-webhook-worker.js`：驗證 LINE 簽章並轉送事件的 Cloudflare Worker

## 設定 Apps Script

1. 建立 Apps Script 專案，將 `Code.gs` 貼入編輯器。
2. 在「專案設定 → 指令碼屬性」加入：

   | 屬性 | 值 |
   |---|---|
   | `GEMINI_API_KEY` | Google AI Studio 的 Gemini API key |
   | `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers 的 Channel access token |
   | `WEBHOOK_SECRET` | 自行產生的高強度隨機字串（至少 32 字元） |
   | `GEMINI_MODEL` | 選填，預設為 `gemini-2.5-flash` |

3. 「部署 → 新增部署 → 網頁應用程式」：執行身分選「我」、存取權限選「所有人」，部署後複製 `/exec` URL。

## 設定 Cloudflare Worker

1. 在 Cloudflare 建立 Worker，貼上 `line-webhook-worker.js` 並部署。
2. 在 Worker 設定加入：
   - `GAS_WEB_APP_URL`：Apps Script 的 `/exec` URL，不要附加 query string。
   - `WEBHOOK_SECRET`：與 Apps Script 指令碼屬性相同。
   - `LINE_CHANNEL_SECRET`：LINE Developers 的 Channel secret。
3. 重新部署 Worker，複製它的 `workers.dev` URL。

## 設定 LINE webhook

1. LINE Developers Console → Messaging API：Webhook URL 設為 Cloudflare Worker 的 `workers.dev` URL。
2. 開啟 **Use webhook**，儲存後按 **Verify**。
3. 若 LINE Official Account Manager 的自動回應或 AI 回應會搶先回覆，請關閉後再測試。

## 安全與限制

- 不要把 API key、LINE token、Channel secret 或 webhook secret 寫入程式碼、提交到 GitHub，或放在公開網址；憑證只放在 Apps Script 指令碼屬性及 Cloudflare Secrets。
- Apps Script 的 `doPost(e)` 不提供 request headers，所以無法在 GAS 驗證 LINE 的 `x-line-signature`；此 Worker 會先驗證簽章。
- Worker 會立即回 LINE HTTP 200，再背景轉送到 Apps Script。Apps Script 同步呼叫 Gemini 後使用 LINE 的 `replyToken` 回覆；Gemini 太慢時，背景轉送可能逾時。
- 此版本只處理文字訊息，不保存對話歷史。模型配額與費用依 Google AI Studio 帳戶方案為準。
