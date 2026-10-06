// Tiny static server for local testing: node serve.mjs [port] [--images <dir>]
// Mimics Vercel cleanUrls: /projects/x -> projects/x/index.html, /about -> about.html.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const port = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 4173);
const ii = args.indexOf('--images');
const IMAGES = ii >= 0 ? path.resolve(args[ii + 1]) : null; // optional fallback folder for /images/*
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.ico': 'image/x-icon' };

function resolve(urlPath) {
  const rel = decodeURIComponent(urlPath).replace(/^\/+/, '');
  const base = path.join(ROOT, rel);
  if (!base.startsWith(ROOT)) return null;
  const tries = [base, base + '.html', path.join(base, 'index.html')];
  if (IMAGES && rel.startsWith('images/')) tries.push(path.join(IMAGES, rel.slice(7)));
  return tries.find((f) => fs.existsSync(f) && fs.statSync(f).isFile()) || null;
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) { res.writeHead(308, { Location: u.pathname.slice(0, -1) + u.search }); return res.end(); }
  const file = resolve(u.pathname);
  if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404 ' + u.pathname); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving ${ROOT} at http://localhost:${port}${IMAGES ? `  (images fallback: ${IMAGES})` : ''}`));
