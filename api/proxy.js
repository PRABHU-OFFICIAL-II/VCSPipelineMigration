import https from 'https';
import http  from 'http';
import { URL } from 'url';

// Disable body parsing — keep req as a raw stream we can pipe
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

  // The full Informatica URL is passed as ?url=<encoded>
  const reqUrl   = new URL(req.url, `http://${req.headers.host}`);
  const target   = reqUrl.searchParams.get('url');

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

  // Forward all headers except ones that confuse the upstream server
  const forwardHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (['host', 'x-proxy-host', 'origin', 'referer',
         'connection', 'transfer-encoding'].includes(lower)) continue;
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
