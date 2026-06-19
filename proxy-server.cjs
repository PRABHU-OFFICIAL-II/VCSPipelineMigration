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

const server = http.createServer((req, res) => {
  // Allow the browser (or Vite dev server) to call us
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers','*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const proxyHost = req.headers['x-proxy-host'];

  if (!proxyHost) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Missing x-proxy-host header');
    return;
  }

  // Strip the /api-proxy prefix that Vite / Nginx added
  const actualPath = req.url.replace(/^\/api-proxy/, '') || '/';

  let targetUrl;
  try {
    targetUrl = new URL(actualPath, proxyHost);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end(`Bad target URL: ${e.message}`);
    return;
  }

  // Forward every header except those that would confuse the upstream server
  const forwardHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (['host', 'x-proxy-host', 'origin', 'referer'].includes(lower)) continue;
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
      // Strip upstream CORS headers — we set our own above
      const responseHeaders = {};
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (key.toLowerCase().startsWith('access-control-')) continue;
        responseHeaders[key] = value;
      }
      responseHeaders['access-control-allow-origin'] = '*';

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
