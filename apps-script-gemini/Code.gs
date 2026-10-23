/**
 * LINE Bot Lite port for Google Apps Script + Gemini API.
 * Configure Script Properties before deployment; see README.md.
 */
const CONFIG = {
  geminiModel: 'gemini-2.5-flash',
  lineReplyUrl: 'https://api.line.me/v2/bot/message/reply',
  geminiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/'
};

function doGet() {
  return ContentService.createTextOutput('LINE bot lite is running.');
}

function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const expectedSecret = props.getProperty('WEBHOOK_SECRET');
  const suppliedSecret = e && e.parameter ? e.parameter.key : '';

  // Apps Script web app events do not expose request headers, including LINE's
  // x-line-signature. Require a separate high-entropy URL secret as a fallback.
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return ContentService.createTextOutput('Unauthorized');
  }

  let payload;
  try {
    payload = JSON.parse(e.postData.contents || '{}');
  } catch (err) {
    console.error('Invalid JSON webhook body: ' + err);
    return ContentService.createTextOutput('Bad Request');
  }

  const events = payload.events || [];
  events.forEach(function (event) {
    try {
      handleLineEvent_(event, props);
    } catch (err) {
      console.error('Event handling failed: ' + err);
    }
  });

  return ContentService.createTextOutput('OK');
}

function handleLineEvent_(event, props) {
  if (!event || event.type !== 'message' || !event.replyToken) return;
  const message = event.message || {};
  if (message.type !== 'text') {
    replyLine_(event.replyToken, '目前我只看得懂文字喔。', props);
    return;
  }

  const question = String(message.text || '').trim();
  if (!question) return;

  if (/^(hi|hello|你好|嗨|哈囉|測試|test)$/i.test(question)) {
    replyLine_(event.replyToken,
      '你好！我是 LINE 上的 Gemini 助理。問我問題，我會用繁體中文回答。', props);
    return;
  }

  try {
    const answer = askGemini_(question, props);
    replyLine_(event.replyToken, answer, props);
  } catch (err) {
    console.error('Gemini request failed: ' + err);
    replyLine_(event.replyToken, '目前回答時發生錯誤，請稍後再試。', props);
  }
}

function askGemini_(question, props) {
  const apiKey = props.getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY Script Property');

  const model = props.getProperty('GEMINI_MODEL') || CONFIG.geminiModel;
  const url = CONFIG.geminiUrl + encodeURIComponent(model) + ':generateContent';
  const today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd (EEE)');
  const requestBody = {
    system_instruction: {
      parts: [{ text: '你是 LINE 上的助理，今天是 ' + today + '。請用台灣繁體中文、純文字回答，120 字以內，先講結論。不確定的事要坦白說明，不要編造。' }]
    },
    contents: [{ role: 'user', parts: [{ text: question }] }],
    generationConfig: { maxOutputTokens: 512, temperature: 0.7 }
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': apiKey },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const body = JSON.parse(response.getContentText() || '{}');
  if (status < 200 || status >= 300) {
    throw new Error('Gemini API returned ' + status + ': ' + (body.error && body.error.message || 'unknown error'));
  }

  const parts = body.candidates && body.candidates[0] && body.candidates[0].content && body.candidates[0].content.parts;
  const answer = parts ? parts.map(function (part) { return part.text || ''; }).join('').trim() : '';
  if (!answer) throw new Error('Gemini returned an empty response');
  return answer.slice(0, 5000);
}

function replyLine_(replyToken, text, props) {
  const accessToken = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  if (!accessToken) throw new Error('Missing LINE_CHANNEL_ACCESS_TOKEN Script Property');

  const response = UrlFetchApp.fetch(CONFIG.lineReplyUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + accessToken },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: String(text).slice(0, 5000) }]
    }),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('LINE reply failed (' + response.getResponseCode() + '): ' + response.getContentText());
  }
}
