import https from 'https';
import http  from 'http';
import { URL } from 'url';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',   '*');
  res.setHeader('Access-Control-Allow-Methods',  'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers',  '*');
  res.setHeader('Access-Control-Expose-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const reqUrl = new URL(req.url, `https://${req.headers.host}`);
  const target = reqUrl.searchParams.get('url');

  if (!target) {
    res.status(400).send('Missing ?url= query parameter');
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(decodeURIComponent(target));
  } catch (e) {
    res.status(400).send(`Invalid target URL: ${e.message}`);
    return;
  }

  const targetOrigin = `${targetUrl.protocol}//${targetUrl.host}`;

  // Build forwarded headers.
  // Key WAF-bypass rules:
  //   1. Set Origin + Referer to the TARGET domain so Informatica's WAF
  //      treats the request as coming from its own web UI.
  //   2. Keep User-Agent from the real browser (already in req.headers).
  //   3. Add Accept / Accept-Language if the client didn't send them.
  const forwardHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    // Drop headers that are proxy-specific or would confuse the upstream
    if (['host', 'x-proxy-host', 'origin', 'referer',
         'connection', 'transfer-encoding',
         'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto',
         'x-vercel-id', 'x-vercel-deployment-url'].includes(lower)) continue;
    forwardHeaders[lower] = value;
  }

  // Spoof Origin + Referer to the Informatica domain — passes WAF origin checks
  forwardHeaders['host']    = targetUrl.host;
  forwardHeaders['origin']  = targetOrigin;
  forwardHeaders['referer'] = `${targetOrigin}/`;

  // Ensure a browser-like User-Agent is present (Node http doesn't set one)
  if (!forwardHeaders['user-agent']) {
    forwardHeaders['user-agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/124.0.0.0 Safari/537.36';
  }

  // Ensure standard browser Accept headers are present
  if (!forwardHeaders['accept']) {
    forwardHeaders['accept'] = 'application/json, text/plain, */*';
  }
  if (!forwardHeaders['accept-language']) {
    forwardHeaders['accept-language'] = 'en-US,en;q=0.9';
  }

  const lib  = targetUrl.protocol === 'https:' ? https : http;
  const port = targetUrl.port
    ? parseInt(targetUrl.port, 10)
    : (targetUrl.protocol === 'https:' ? 443 : 80);

  console.log(`[vercel-proxy] ${req.method} ${targetUrl.href}`);

  await new Promise((resolve) => {
    const proxyReq = lib.request(
      {
        hostname: targetUrl.hostname,
        port,
        path:    targetUrl.pathname + targetUrl.search,
        method:  req.method,
        headers: forwardHeaders,
      },
      (proxyRes) => {
        const outHeaders = {};
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (key.toLowerCase().startsWith('access-control-')) continue;
          outHeaders[key] = value;
        }
        outHeaders['access-control-allow-origin'] = '*';
        res.writeHead(proxyRes.statusCode, outHeaders);
        proxyRes.pipe(res, { end: true });
        proxyRes.on('end',   resolve);
        proxyRes.on('error', resolve);
      }
    );

    proxyReq.on('error', (err) => {
      console.error(`[vercel-proxy] upstream error: ${err.message}`);
      if (!res.headersSent) res.status(502).send(`Proxy Error: ${err.message}`);
      resolve();
    });

    req.pipe(proxyReq, { end: true });
  });
}
