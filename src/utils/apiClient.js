/**
 * proxyFetch — drop-in replacement for fetch() that routes all absolute
 * HTTP/HTTPS calls through the local CORS proxy server.
 *
 * How it works:
 *   - Rewrites  https://host.com/some/path  →  /api-proxy/some/path
 *   - Adds header  x-proxy-host: https://host.com  so the proxy knows
 *     which upstream server to forward to.
 *   - In dev, Vite proxies /api-proxy/* → localhost:3001 (proxy-server.cjs)
 *   - In Docker, Nginx proxies /api-proxy/* → localhost:3001 (same server)
 *   - Relative URLs are passed through unchanged.
 */
export async function proxyFetch(url, options = {}) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return fetch(url, options);
  }

  const parsed = new URL(url);
  const proxyUrl = `/api-proxy${parsed.pathname}${parsed.search}`;

  // Clone / build a Headers object so we can inject x-proxy-host
  let headers;
  if (options.headers instanceof Headers) {
    headers = new Headers(options.headers);
  } else if (options.headers && typeof options.headers === 'object') {
    headers = new Headers(options.headers);
  } else {
    headers = new Headers();
  }
  headers.set('x-proxy-host', `${parsed.protocol}//${parsed.host}`);

  return fetch(proxyUrl, { ...options, headers });
}
