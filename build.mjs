// node build.mjs [--fixtures]
// Turns src/projects.json + src/site.json into index.html and projects/<slug>/index.html.
// Built-in modules only. Env IMAGES_DIR overrides where images are looked up (dev fixtures).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = process.argv.includes('--fixtures');
const IMG_DIR = process.env.IMAGES_DIR ? path.resolve(process.env.IMAGES_DIR) : path.join(ROOT, 'images');
const errors = [];

// ---------- data ----------
function loadJSON(name, fixture) {
  const real = path.join(ROOT, 'src', name);
  const fx = path.join(ROOT, 'src', 'fixtures', fixture);
  const file = !FIXTURES && fs.existsSync(real) ? real : fx;
  try {
    return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) {
    console.error(`\n✖ Could not read ${path.relative(ROOT, file)}: ${e.message}\n`);
    process.exit(1);
  }
}
const P = loadJSON('projects.json', 'projects.sample.json');
const S = loadJSON('site.json', 'site.sample.json');
const projects = P.data;
const site = S.data;

let manifest = {};
const mfile = path.join(IMG_DIR, 'manifest.json');
if (fs.existsSync(mfile)) {
  try { manifest = JSON.parse(fs.readFileSync(mfile, 'utf8')); }
  catch (e) { console.warn(`! manifest.json unreadable (${e.message}); reading JPEG headers instead`); }
}

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const catSlug = (c) => String(c || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);

// Read JPEG width/height from the SOF marker. Returns null if not a JPEG.
function jpegSize(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const buf = Buffer.alloc(Math.min(size, 512 * 1024));
    fs.readSync(fd, buf, 0, buf.length, 0);
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return null;
  } finally { fs.closeSync(fd); }
}

const imgCache = new Map();
// Resolve an image reference to { lg, sm, w, h, smw }. `file` may be "name.jpg" or "slug/name.jpg".
function img(file, slug, where) {
  const candidates = file.includes('/') ? [file] : [`${slug}/${file}`, `home/${file}`, `drawing/${file}`];
  const key = candidates.find((k) => manifest[k] || fs.existsSync(path.join(IMG_DIR, k))) || candidates[0];
  if (imgCache.has(key)) return imgCache.get(key);
  const abs = path.join(IMG_DIR, key);
  const smKey = key.replace(/\.jpe?g$/i, '-sm.jpg');
  const smAbs = path.join(IMG_DIR, smKey);
  if (!fs.existsSync(abs)) { errors.push(`missing image  images/${key}   (${where})`); return null; }
  if (!fs.existsSync(smAbs)) { errors.push(`missing small  images/${smKey}   (${where})`); return null; }
  const dim = manifest[key] && manifest[key].w ? manifest[key] : jpegSize(abs);
  if (!dim) { errors.push(`cannot read size of images/${key}   (${where})`); return null; }
  const smd = jpegSize(smAbs) || { w: Math.round(dim.w * Math.min(1, 960 / Math.max(dim.w, dim.h))) };
  const r = { lg: `/images/${key}`, sm: `/images/${smKey}`, w: dim.w, h: dim.h, smw: smd.w };
  imgCache.set(key, r);
  return r;
}

function imgTag(im, alt, sizes, { eager = false, cls = '' } = {}) {
  if (!im) return '';
  const srcset = im.smw < im.w ? ` srcset="${esc(im.sm)} ${im.smw}w, ${esc(im.lg)} ${im.w}w" sizes="${sizes}"` : '';
  const load = eager ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"';
  return `<img${cls ? ` class="${cls}"` : ''} src="${esc(im.smw < im.w ? im.sm : im.lg)}"${srcset} width="${im.w}" height="${im.h}" alt="${esc(alt)}"${load}>`;
}

// sizes per layout (container caps at 1440 + padding)
const SIZES = {
  full: '(min-width:1520px) 1376px, 94vw',
  g2: '(min-width:1520px) 683px, (min-width:620px) 46vw, 92vw',
  g3: '(min-width:1520px) 452px, (min-width:900px) 31vw, (min-width:620px) 46vw, 92vw',
  card: '(min-width:1520px) 448px, (min-width:1100px) 30vw, (min-width:640px) 46vw, 92vw',
  bleed: '(min-width:1920px) 1920px, 100vw',
  homehero: '(min-width:1520px) 1376px, 94vw',
};

const ar = (im) => +(im.w / im.h).toFixed(4);

// One figure inside a justified row: flex-grow = aspect ratio, so every image in a row
// shares one height and the row fills the measure. Nothing is cropped.
function fig(im, image, sizes, sheet) {
  if (!im) return '';
  const cap = image.caption ? `<figcaption>${esc(image.caption)}</figcaption>` : '';
  return `<figure class="fig${sheet ? ' on-sheet' : ''}" style="--ar:${ar(im)}"><div class="${sheet ? 'sheet' : 'frame'}"><button type="button" class="zoom" data-full="${esc(im.lg)}" aria-label="Enlarge: ${esc(image.alt || image.caption || 'image')}">${imgTag(im, image.alt || image.caption || '', sizes)}</button></div>${cap}</figure>`;
}

// Split n images into balanced rows of at most `cols` (no orphan in 2-up groups: 3 -> [3], 5 -> [3,2]).
function chunk(n, cols) {
  let rows = Math.ceil(n / cols);
  if (cols === 2 && n > 1 && n % 2 === 1) rows = Math.floor(n / 2);
  const base = Math.floor(n / rows), extra = n % rows, out = [];
  for (let r = 0; r < rows; r++) out.push(base + (r < extra ? 1 : 0));
  return out;
}

function groups(list, slug, where) {
  return (list || []).map((g, gi) => {
    const items = (g.images || []).filter(Boolean)
      .map((image, ii) => ({ image, im: img(image.file, slug, `${where} group ${gi + 1} image ${ii + 1}`) }))
      .filter((x) => x.im);
    if (!items.length) return '';
    const layout = ['full', 'g2', 'g3'].includes(g.layout) ? g.layout : 'g2';
    const cols = { full: 1, g2: 2, g3: 3 }[layout];
    let i = 0;
    const rows = chunk(items.length, cols).map((len) => {
      const row = items.slice(i, i += len);
      const sum = row.reduce((s, x) => s + ar(x.im), 0);
      const figs = row.map((x) => {
        const share = ar(x.im) / sum;              // fraction of the row this image occupies
        const vw = Math.max(1, Math.round(share * 94));
        const px = Math.round(share * 1376);
        const sizes = `(min-width:1520px) ${px}px, (min-width:621px) ${vw}vw, 92vw`;
        return fig(x.im, x.image, sizes, !!g.sheet);
      }).join('\n');
      return `<div class="row${len === 1 ? ' solo' : ''}" style="--sum:${sum.toFixed(4)};--n:${len}">\n${figs}\n</div>`;
    }).join('\n');
    return `<div class="grid ${layout}${g.sheet ? ' sheets' : ''}">\n${rows}\n</div>`;
  }).join('\n');
}

// ---------- shared chrome ----------
const css = fs.readFileSync(path.join(ROOT, 'assets', 'site.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'assets', 'site.js'), 'utf8');
const V = { css: hash(css), js: hash(js) };
const NAME = site.hero?.name || 'Arman Hossain Amir';
const SITE_URL = (site.url || '').replace(/\/$/, '');
const contact = site.contact || {};
const lines = contact.lines || [];

function href(h) {
  if (!h) return null;
  if (/^(https?:|mailto:|tel:|\/|#)/.test(h)) return h;
  return '/' + h.replace(/^\.?\//, '');
}
function link(text, h, cls = '') {
  const u = href(h);
  if (!u) return esc(text);
  const ext = /^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '';
  return `<a${cls ? ` class="${cls}"` : ''} href="${esc(u)}"${ext}>${esc(text)}</a>`;
}

function head({ title, description, image, url }) {
  const abs = (u) => (SITE_URL && u && u.startsWith('/') ? SITE_URL + u : u);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#121417">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${image ? `<meta property="og:image" content="${esc(abs(image))}">\n` : ''}${SITE_URL ? `<meta property="og:url" content="${esc(SITE_URL + url)}">\n<link rel="canonical" href="${esc(SITE_URL + url)}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23121417'/%3E%3Cpath d='M8 24 16 8l8 16' fill='none' stroke='%23EDEDEA' stroke-width='3'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..700&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css?v=${V.css}">
<script src="/assets/site.js?v=${V.js}" defer></script>
</head>`;
}

function bar(home) {
  const h = home ? '' : '/';
  return `<a class="skip" href="#main">Skip to content</a>
<header class="bar"><div class="wrap bar-in">
  <a class="nm" href="${home ? '#top' : '/'}">${esc(NAME)}</a>
  <nav aria-label="Primary">
    <a href="${h}#work">Work</a>
    <a href="${h}#practice">Practice</a>
    <a href="${h}#drawing">Drawing</a>
    <a href="${h}#contact">Contact</a>
  </nav>
</div></header>`;
}

function footer() {
  const pick = lines.filter((l) => l[2] && !/^tel:/.test(l[2])).slice(0, 4);
  const items = pick.map((l) => `<li>${link(/^mailto:/.test(l[2]) ? l[1] : l[0], l[2])}</li>`).join('');
  return `<footer class="foot"><div class="wrap foot-in">
  <p>© ${new Date().getFullYear()} ${esc(NAME)}</p>
  <ul>${items}</ul>
</div></footer>`;
}

const end = `</body>\n</html>\n`;

// ---------- home ----------
function home() {
  const hero = site.hero || {};
  const names = String(hero.name || NAME).split(/\s+/);
  const dims = (hero.dims || []).map(([k, v]) => {
    if (/^projects$/i.test(k)) v = `${WORDS[projects.length] || projects.length} selected`;
    return `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`;
  }).join('');
  const hi = site.heroImage ? img(site.heroImage.file, 'home', 'site.json heroImage') : null;

  const cats = ['Architecture', 'Interiors', 'Masterplan', 'Academic'].filter((c) => projects.some((p) => p.category === c));
  const chips = `<div class="chips" role="group" aria-label="Filter projects by category" hidden>
      <button type="button" data-cat="all" aria-pressed="true">All <span>${projects.length}</span></button>${cats.map((c) => `
      <button type="button" data-cat="${catSlug(c)}" aria-pressed="false">${esc(c)} <span>${projects.filter((p) => p.category === c).length}</span></button>`).join('')}
    </div>`;

  const cards = projects.map((p) => {
    const im = img(p.cover, p.slug, `${p.slug} cover`);
    return `<li class="card" data-cat="${catSlug(p.category)}"><a href="/projects/${esc(p.slug)}">
  <div class="card-img">${imgTag(im, '', SIZES.card)}</div>
  <div class="card-meta"><span>P-${esc(p.no)}</span><span>${esc(p.category)}</span></div>
  <h3 class="card-ti">${esc(p.title)}</h3>
  <p class="card-pl">${esc([p.location, p.year].filter(Boolean).join(' · '))}</p>
</a></li>`;
  }).join('\n');

  const pr = site.practice || {};
  const cv = (pr.cv || []).map(([y, t, s]) => `<li><span class="yr">${esc(y)}</span><span><b>${esc(t)}</b>${s ? `<span>${esc(s)}</span>` : ''}</span></li>`).join('\n');
  const dr = site.drawing || {};
  const cl = lines.map(([k, t, h]) => `<li><span class="k">${esc(k)}</span><span>${link(t, h)}</span></li>`).join('\n');

  const title = site.title || `${NAME} — Architectural Designer, New York`;
  const description = site.description || hero.role || '';
  return `${head({ title, description, image: hi && hi.lg, url: '/' })}
<body class="home">
${bar(true)}
<main id="main">
<section class="hero wrap" id="top">
  <div class="hero-text">
    <h1 class="exp">${names.map((n) => `<span>${esc(n)}</span>`).join('')}</h1>
    ${hero.role ? `<p class="role">${esc(hero.role)}</p>` : ''}
    <dl class="dim">${dims}</dl>
  </div>
  ${hi ? `<figure class="hero-fig">${imgTag(hi, site.heroImage.alt || '', SIZES.homehero, { eager: true })}</figure>` : ''}
</section>

<section class="work wrap" id="work" aria-labelledby="work-h">
  <div class="sec-head">
    <h2 class="label" id="work-h">${esc(site.work?.title || 'Selected work')}</h2>
    <p class="lead exp">${esc(site.work?.lead || 'Buildings, interiors, and the plans that get them built.')}</p>
    ${chips}
  </div>
  <ul class="cards">
${cards}
  </ul>
  <p class="filter-status" aria-live="polite"></p>
</section>

<section class="practice" id="practice" aria-labelledby="practice-h">
  <div class="wrap">
    <h2 class="label" id="practice-h">${esc(pr.title || 'Practice')}</h2>
    ${pr.lead ? `<p class="lead exp">${esc(pr.lead)}</p>` : ''}
    <div class="cols">
      <div class="prose">${(pr.paragraphs || []).map((t) => `<p>${esc(t)}</p>`).join('\n')}</div>
      <ul class="cv">
${cv}
      </ul>
    </div>
  </div>
</section>

<section class="drawing wrap" id="drawing" aria-labelledby="drawing-h">
  <div class="sec-head">
    <p class="label">${esc(dr.no || 'X-01')}</p>
    <h2 class="lead exp" id="drawing-h">${esc(dr.title || 'Drawing & photography')}</h2>
    ${dr.where ? `<p class="where">${esc(dr.where)}</p>` : ''}
  </div>
  <div class="groups">
${groups(dr.groups, 'drawing', 'site.json drawing')}
  </div>
</section>

<section class="contact wrap" id="contact" aria-labelledby="contact-h">
  <p class="label">${esc(contact.title || 'Contact')}</p>
  <h2 class="big exp" id="contact-h">${esc(contact.heading || 'Contact').replace(/\S+-\S+/g, (w) => `<span class="nw">${w}</span>`)}</h2>
  <ul class="lines">
${cl}
  </ul>
  ${contact.colophon ? `<p class="colophon">${esc(contact.colophon)}</p>` : ''}
</section>
</main>
${footer()}
${end}`;
}

// ---------- project ----------
function project(p, i) {
  const where = `${p.slug}`;
  const cover = img(p.cover, p.slug, `${where} cover`);
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const next = projects[(i + 1) % projects.length];
  // Full-bleed only for landscape covers with enough pixels; portrait or low-res covers are
  // contained (centred on a charcoal band, never upscaled past their own width).
  const contained = cover && (cover.h > cover.w * 0.8 || cover.w < 1600);
  const coverAlt = p.coverAlt || p.heroAlt || p.heroCaption || p.title;
  const heroSizes = contained ? `(min-width:${cover.w}px) ${Math.round(cover.w)}px, 100vw` : SIZES.bleed;
  const heroStyle = contained ? ` style="--ar:${ar(cover)};--w:${cover.w}px"` : '';
  const heroFig = cover ? `<figure class="fig bleed${contained ? ' contained' : ''}"${heroStyle}><div class="frame"><button type="button" class="zoom" data-full="${esc(cover.lg)}" aria-label="Enlarge: ${esc(coverAlt)}">${imgTag(cover, coverAlt, heroSizes, { eager: true })}</button></div>${p.heroCaption ? `<figcaption class="wrap">${esc(p.heroCaption)}</figcaption>` : ''}</figure>` : '';
  const spec = (p.spec || []).slice(0, 4).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  const whereLine = p.where || [p.location, p.year].filter(Boolean).join(' · ');
  const pn = (q, dir) => `<a class="pn pn-${dir}" href="/projects/${esc(q.slug)}" rel="${dir}"><span class="pn-k">${dir === 'prev' ? `← Previous · P-${esc(q.no)}` : `P-${esc(q.no)} · Next →`}</span><span class="pn-ti">${esc(q.title)}</span></a>`;
  return `${head({ title: `${p.title} — ${NAME}`, description: p.summary || '', image: cover && cover.lg, url: `/projects/${p.slug}` })}
<body class="project">
${bar(false)}
<main id="main">
<article class="proj">
  <header class="ph wrap">
    <p class="ph-meta"><span>P-${esc(p.no)}</span><span>${esc(p.category)}</span></p>
    <h1 class="exp">${esc(p.title)}</h1>
    ${whereLine ? `<p class="where">${esc(whereLine)}</p>` : ''}
  </header>
  ${heroFig}
  <div class="wrap">
    <div class="intro">
      <div class="prose">${(p.body || []).map((t) => `<p>${esc(t)}</p>`).join('\n')}</div>
      ${p.credit ? `<p class="credit">${esc(p.credit)}</p>` : ''}
    </div>
    ${spec ? `<dl class="spec">${spec}</dl>` : ''}
    <div class="groups">
${groups(p.groups, p.slug, where)}
    </div>
  </div>
</article>
<nav class="pnav wrap" aria-label="More projects">
  ${pn(prev, 'prev')}
  <a class="pn pn-all" href="/#work"><span class="pn-k">Index</span><span class="pn-ti">All work</span></a>
  ${pn(next, 'next')}
</nav>
</main>
${footer()}
${end}`;
}

// ---------- validate & write ----------
const slugs = new Set();
projects.forEach((p, i) => {
  if (!p.slug || !/^[a-z0-9-]+$/.test(p.slug)) errors.push(`project #${i + 1}: bad slug "${p.slug}"`);
  if (slugs.has(p.slug)) errors.push(`duplicate slug ${p.slug}`);
  slugs.add(p.slug);
  if (!p.title) errors.push(`${p.slug}: missing title`);
  if (!p.cover) errors.push(`${p.slug}: missing cover`);
});

const out = { 'index.html': home() };
projects.forEach((p, i) => { out[`projects/${p.slug}/index.html`] = project(p, i); });

if (errors.length) {
  console.error(`\n✖ Build failed — ${errors.length} problem(s):\n  ` + errors.join('\n  ') + `\n\nImages are looked up in ${IMG_DIR}\n`);
  process.exit(1);
}

// remove stale project pages
const pdir = path.join(ROOT, 'projects');
if (fs.existsSync(pdir)) for (const d of fs.readdirSync(pdir)) {
  if (!slugs.has(d) && fs.existsSync(path.join(pdir, d, 'index.html'))) fs.rmSync(path.join(pdir, d), { recursive: true });
}
let bytes = 0;
for (const [rel, html] of Object.entries(out)) {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
  bytes += Buffer.byteLength(html);
}
console.log(`✔ Built ${Object.keys(out).length} pages (${projects.length} projects, ${imgCache.size} images, ${(bytes / 1024).toFixed(0)} KB HTML)`);
console.log(`  data:   ${path.relative(ROOT, P.file)}, ${path.relative(ROOT, S.file)}`);
console.log(`  images: ${IMG_DIR}${Object.keys(manifest).length ? ' (manifest)' : ' (JPEG headers)'}`);
console.log(`  css ${(css.length / 1024).toFixed(1)} KB, js ${(js.length / 1024).toFixed(1)} KB`);
