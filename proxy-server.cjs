/**
 * Local CORS proxy server.
 *
 * The browser calls  /api-proxy/<path>  with an  x-proxy-host  header
 * that carries the full Informatica base URL (e.g. https://dm-us.informaticacloud.com).
 * This server strips /api-proxy, rebuilds the real URL, and forwards the
 * request server-to-server — no browser CORS restrictions apply here.
 */

const http  = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PROXY_PORT || 3001;

// Only proxy to Informatica Cloud domains.
const ALLOWED_HOST_RE = /^([a-z0-9-]+\.)*informatica(cloud)?\.com$/i;

// Only respond with CORS headers for these origins.
const ALLOWED_ORIGIN_RES = [
  /^https?:\/\/([a-z0-9-]+\.)*informaticacloud\.com$/i,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

function resolveOrigin(origin) {
  if (!origin) return null;
  return ALLOWED_ORIGIN_RES.some((re) => re.test(origin)) ? origin : null;
}

const server = http.createServer((req, res) => {
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
    res.writeHead(204);
    res.end();
    return;
  }

  if (requestOrigin && !corsOrigin) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Origin not permitted');
    return;
  }

  const proxyHost = req.headers['x-proxy-host'];

  if (!proxyHost) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Missing x-proxy-host header');
    return;
  }

  let proxyHostUrl;
  try {
    proxyHostUrl = new URL(proxyHost);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Invalid x-proxy-host value');
    return;
  }

  if (!ALLOWED_HOST_RE.test(proxyHostUrl.hostname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Target host not permitted');
    return;
  }

  const actualPath = req.url.replace(/^\/api-proxy/, '') || '/';

  let targetUrl;
  try {
    targetUrl = new URL(actualPath, proxyHost);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end(`Bad target URL: ${e.message}`);
    return;
  }

  const forwardHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (['host', 'x-proxy-host', 'origin', 'referer', 'connection'].includes(lower)) continue;
    forwardHeaders[key] = value;
  }
  forwardHeaders['host'] = targetUrl.host;

  const lib  = targetUrl.protocol === 'https:' ? https : http;
  const port = targetUrl.port
    ? parseInt(targetUrl.port, 10)
    : (targetUrl.protocol === 'https:' ? 443 : 80);

  console.log(`[proxy] ${req.method} ${targetUrl.href}`);

  const proxyReq = lib.request(
    {
      hostname: targetUrl.hostname,
      port,
      path: targetUrl.pathname + targetUrl.search,
      method:  req.method,
      headers: forwardHeaders,
    },
    (proxyRes) => {
      const responseHeaders = {};
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (key.toLowerCase().startsWith('access-control-')) continue;
        responseHeaders[key] = value;
      }
      if (corsOrigin) {
        responseHeaders['access-control-allow-origin'] = corsOrigin;
        responseHeaders['vary'] = 'Origin';
      }
      res.writeHead(proxyRes.statusCode, responseHeaders);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    console.error(`[proxy] Error forwarding to ${targetUrl.href}: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`Proxy Error: ${err.message}`);
    }
  });

  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`[proxy] Running on http://localhost:${PORT}`);
  console.log(`[proxy] Forwarding /api-proxy/* → x-proxy-host + <path>`);
});
