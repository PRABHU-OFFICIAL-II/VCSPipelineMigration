import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'http'
import https from 'https'
import { URL } from 'url'

/**
 * Inline CORS proxy — runs inside the Vite dev server as middleware.
 * No separate process, no port conflicts, no race conditions.
 *
 * Browser calls /api-proxy/<path> with header x-proxy-host: https://host.com
 * This middleware forwards the request to https://host.com/<path> server-side.
 */
function corsProxyPlugin() {
  return {
    name: 'vite-plugin-cors-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api-proxy')) {
          return next()
        }

        // Handle CORS preflight
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
        res.setHeader('Access-Control-Allow-Headers', '*')
        if (req.method === 'OPTIONS') {
          res.writeHead(204)
          res.end()
          return
        }

        const proxyHost = req.headers['x-proxy-host']
        if (!proxyHost) {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end('Missing x-proxy-host header')
          return
        }

        const actualPath = req.url.replace(/^\/api-proxy/, '') || '/'
        let targetUrl
        try {
          targetUrl = new URL(actualPath, proxyHost)
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end(`Bad target URL: ${e.message}`)
          return
        }

        // Build forwarded headers — drop browser-specific ones
        const forwardHeaders = {}
        for (const [key, value] of Object.entries(req.headers)) {
          const lower = key.toLowerCase()
          if (['host', 'x-proxy-host', 'origin', 'referer', 'connection'].includes(lower)) continue
          forwardHeaders[key] = value
        }
        forwardHeaders['host'] = targetUrl.host

        const lib  = targetUrl.protocol === 'https:' ? https : http
        const port = targetUrl.port
          ? parseInt(targetUrl.port, 10)
          : (targetUrl.protocol === 'https:' ? 443 : 80)

        console.log(`\x1b[36m[proxy]\x1b[0m ${req.method} ${targetUrl.href}`)

        const proxyReq = lib.request(
          {
            hostname: targetUrl.hostname,
            port,
            path: targetUrl.pathname + targetUrl.search,
            method:  req.method,
            headers: forwardHeaders,
          },
          (proxyRes) => {
            const outHeaders = {}
            for (const [key, value] of Object.entries(proxyRes.headers)) {
              if (key.toLowerCase().startsWith('access-control-')) continue
              outHeaders[key] = value
            }
            outHeaders['access-control-allow-origin'] = '*'
            res.writeHead(proxyRes.statusCode, outHeaders)
            proxyRes.pipe(res)
          }
        )

        proxyReq.on('error', (err) => {
          console.error(`\x1b[31m[proxy error]\x1b[0m ${err.message}`)
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' })
            res.end(`Proxy Error: ${err.message}`)
          }
        })

        req.pipe(proxyReq)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), corsProxyPlugin()],
  server: { port: 5173 },
})
