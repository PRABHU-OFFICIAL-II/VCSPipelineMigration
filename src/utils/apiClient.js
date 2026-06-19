/**
 * proxyFetch — drop-in replacement for fetch() that routes all absolute
 * HTTP/HTTPS calls through the appropriate CORS proxy.
 *
 * Three environments, one strategy per env:
 *
 *  Dev (Vite)    → /api-proxy/<path>  with  x-proxy-host header
 *                  (handled by the corsProxyPlugin middleware in vite.config.js)
 *
 *  Vercel        → /api/proxy?url=<encoded-full-url>
 *                  (handled by api/proxy.js serverless function)
 *
 *  Docker/Nginx  → /api-proxy/<path>  with  x-proxy-host header
 *                  (nginx routes /api-proxy/ → proxy-server.cjs on port 3001)
 *
 * Detection: if the page is on a *.vercel.app domain or the hostname ends
 * with vercel.app we use the Vercel route.  Everything else (localhost or
 * Docker) falls back to the x-proxy-host strategy.
 */
export async function proxyFetch(url, options = {}) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return fetch(url, options);
  }

  const isVercel =
    typeof window !== 'undefined' &&
    (window.location.hostname.endsWith('.vercel.app') ||
     window.location.hostname === 'vercel.app');

  if (isVercel) {
    // Vercel: encode the full URL as a query param — flat endpoint, no path routing
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    let headers;
    if (options.headers instanceof Headers) {
      headers = new Headers(options.headers);
    } else {
      headers = new Headers(options.headers || {});
    }
    // Remove x-proxy-host in case it was already set — not needed for this strategy
    headers.delete('x-proxy-host');
    return fetch(proxyUrl, { ...options, headers });
  }

  // Dev / Docker: path-based proxy with x-proxy-host header
  const parsed   = new URL(url);
  const proxyUrl = `/api-proxy${parsed.pathname}${parsed.search}`;
  let headers;
  if (options.headers instanceof Headers) {
    headers = new Headers(options.headers);
  } else {
    headers = new Headers(options.headers || {});
  }
  headers.set('x-proxy-host', `${parsed.protocol}//${parsed.host}`);
  return fetch(proxyUrl, { ...options, headers });
}
