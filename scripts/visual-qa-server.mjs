// Serve only verified static bytes; never load artifact JavaScript in Node.
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
const root = path.resolve('dist')
const base = process.env.E2E_BASE_PATH || '/'
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
      if (!pathname.startsWith(base)) throw new Error('Outside base')
      const relative = pathname.slice(base.length) || 'index.html'
      const file = path.resolve(root, relative)
      if (!file.startsWith(root + path.sep)) throw new Error('Outside root')
      const bytes = await fs.readFile(file)
      res.writeHead(200, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      res.end(bytes)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  })
  .listen(4175, '127.0.0.1')
