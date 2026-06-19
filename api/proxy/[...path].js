/**
 * Vercel serverless CORS proxy.
 *
 * Handles:  /api-proxy/<path>
 * Reads:    x-proxy-host header  →  the real Informatica base URL
 * Forwards: request server-side (no browser CORS restrictions)
 *
 * This is the production equivalent of the Vite dev-server middleware in
 * vite.config.js and the standalone proxy-server.cjs used in Docker.
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

module.exports = async function handler(req, res) {
  // CORS headers for the browser
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers','*');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const proxyHost = req.headers['x-proxy-host'];
  if (!proxyHost) {
    res.status(400).send('Missing x-proxy-host header');
    return;
  }

  // Vercel gives us req.url = /api/proxy/<rest>  — strip down to just <rest>
  // so we can reconstruct the real path the client intended (/api-proxy/<rest>)
  const rawUrl  = req.url || '/';
  const stripped = rawUrl.replace(/^\/api\/proxy/, '') || '/';

  let targetUrl;
  try {
    targetUrl = new URL(stripped, proxyHost);
  } catch (e) {
    res.status(400).send(`Bad target URL: ${e.message}`);
    return;
  }

  // Forward headers, dropping browser-only / proxy-specific ones
  const forwardHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (['host', 'x-proxy-host', 'origin', 'referer', 'connection', 'transfer-encoding'].includes(lower)) continue;
    forwardHeaders[key] = value;
  }
  forwardHeaders['host'] = targetUrl.host;

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
        path:   targetUrl.pathname + targetUrl.search,
        method: req.method,
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
        proxyRes.on('end', resolve);
      }
    );

    proxyReq.on('error', (err) => {
      console.error(`[vercel-proxy] Error: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).send(`Proxy Error: ${err.message}`);
      }
      resolve();
    });

    if (req.body) {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      proxyReq.write(body);
    } else {
      req.pipe(proxyReq, { end: true });
    }
  });
};
