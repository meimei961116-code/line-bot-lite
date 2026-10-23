# LINE bot 

本專案提供兩種版本：本機 Ollama，以及 Google Apps Script + Gemini 雲端版。

## 本機版本（Ollama）

需要 Python 3、Ollama 與 gemma4:e2b 模型。

~~~sh
ollama pull gemma4:e2b
python line-bot-lite/line_bot_lite.py --simulate
~~~

## 雲端版本（Google Apps Script + Gemini）

程式碼和設定步驟請看 [apps-script-gemini](apps-script-gemini/README.md)。它使用 Apps Script 呼叫 Gemini，並透過 Cloudflare Worker 驗證 LINE webhook 簽章及轉送訊息。

請勿將 API key、LINE token、Channel secret 或 webhook secret 提交到 GitHub。請依雲端版說明將憑證存放在 Apps Script 指令碼屬性和 Cloudflare Secrets。
