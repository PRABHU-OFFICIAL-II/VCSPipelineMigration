import https from 'https';
import http  from 'http';
import { URL } from 'url';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

// Only proxy requests to Informatica Cloud domains.
const ALLOWED_TARGET_RE = /^([a-z0-9-]+\.)*informatica(cloud)?\.com$/i;

// Only allow CORS from these origins.
const ALLOWED_ORIGIN_RES = [
  /^https?:\/\/([a-z0-9-]+\.)*informaticacloud\.com$/i,
  /^https?:\/\/([a-z0-9-]+\.)*vercel\.app$/i,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

function resolveOrigin(origin) {
  if (!origin) return null;
  return ALLOWED_ORIGIN_RES.some((re) => re.test(origin)) ? origin : null;
}

export default async function handler(req, res) {
  const requestOrigin = req.headers['origin'] || '';
  const corsOrigin    = resolveOrigin(requestOrigin);

  if (corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type,Authorization,INFA-SESSION-ID,x-proxy-host');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type,INFA-SESSION-ID');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (requestOrigin && !corsOrigin) {
    res.status(403).send('Origin not permitted');
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

  if (!ALLOWED_TARGET_RE.test(targetUrl.hostname)) {
    res.status(403).send('Target host not permitted');
    return;
  }

  const targetOrigin = `${targetUrl.protocol}//${targetUrl.host}`;

  // Build forwarded headers — drop hop-by-hop and proxy-specific headers.
  const forwardHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (['host', 'x-proxy-host', 'origin', 'referer',
         'connection', 'transfer-encoding',
         'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto',
         'x-vercel-id', 'x-vercel-deployment-url'].includes(lower)) continue;
    forwardHeaders[lower] = value;
  }

  // Set host, origin, and referer to the target domain as the Informatica API requires.
  forwardHeaders['host']    = targetUrl.host;
  forwardHeaders['origin']  = targetOrigin;
  forwardHeaders['referer'] = `${targetOrigin}/`;

  if (!forwardHeaders['user-agent']) {
    forwardHeaders['user-agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/124.0.0.0 Safari/537.36';
  }
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
        if (corsOrigin) {
          outHeaders['access-control-allow-origin'] = corsOrigin;
          outHeaders['vary'] = 'Origin';
        }
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
