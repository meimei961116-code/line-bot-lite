/**
 * Cloudflare Worker relay: LINE -> Worker -> Google Apps Script.
 * Configure GAS_WEB_APP_URL, WEBHOOK_SECRET, and LINE_CHANNEL_SECRET as
 * Worker variables/secrets. Do not put credentials in this file.
 */
export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('LINE webhook relay is running.', { status: 200 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get('x-line-signature') || '';
    if (!signature || !(await verifyLineSignature_(rawBody, signature, env.LINE_CHANNEL_SECRET))) {
      return new Response('Unauthorized', { status: 401 });
    }

    const gasUrl = new URL(env.GAS_WEB_APP_URL);
    gasUrl.searchParams.set('key', env.WEBHOOK_SECRET);

    // Respond to LINE promptly. The GAS request follows Google's ContentService
    // redirect and carries out Gemini/LINE processing in the background.
    const forwarding = fetch(gasUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody,
      redirect: 'follow'
    }).then(async (response) => {
      await response.arrayBuffer();
      if (!response.ok) throw new Error('Apps Script returned HTTP ' + response.status);
    });

    ctx.waitUntil(forwarding.catch((error) => {
      console.error('Forwarding webhook to Apps Script failed:', error);
    }));

    return new Response('OK', { status: 200 });
  }
};

async function verifyLineSignature_(body, received, channelSecret) {
  if (!channelSecret) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
  let binary = '';
  digest.forEach((byte) => { binary += String.fromCharCode(byte); });
  const expected = btoa(binary);
  if (received.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}
