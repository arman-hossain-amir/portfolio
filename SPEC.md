# Portfolio site — build spec (shared contract for all agents)

Root of the repo = `C:\Users\zisha\OneDrive\Desktop\New Portfolio\site\` (call it `site/`).
Static front end only. No framework, no bundler, no npm runtime deps in the output.
A tiny Node build script (`build.mjs`, Node 24, built-in modules only) turns data into HTML.
Generated HTML is committed, so Vercel serves the files directly with no build step.

PATH note (PowerShell): run this first in every shell:
`$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")`
Node, npm, git are installed. `sharp` and `playwright` (with Chromium) are installed in
`C:\Users\zisha\AppData\Local\Temp\claude\c--Users-zisha-OneDrive-Desktop-New-Portfolio\a1645494-d85a-4888-b821-3dc3b7db0166\scratchpad\fb\node_modules`.
Run tool scripts from that folder (or set NODE_PATH to it). Never add node_modules to `site/`.

## Layout of site/

```
site/
  index.html                 generated — home
  projects/<slug>/index.html generated — one page per project
  assets/site.css            hand-written
  assets/site.js             hand-written (lightbox, filter, small things)
  images/<slug>/<name>.jpg   large (long side 2400px for heroes/renders, q≈82, progressive mozjpeg)
  images/<slug>/<name>-sm.jpg  small (long side 960px, q≈78)
  images/manifest.json       { "<slug>/<name>.jpg": { "w": 2400, "h": 1350 }, ... } (large file dims)
  images/home/...            home hero, drawing & photography images (slug = "home" / "drawing")
  Arman-Hossain-Amir-Resume.pdf
  src/projects.json          content (see schema)
  src/site.json              home-page content: hero, practice, drawing section, contact
  build.mjs                  node build.mjs → writes index.html + projects/*/index.html
  vercel.json                cleanUrls, trailingSlash false, long cache headers for /images and /assets
  README.md
```

## Slugs (fixed)

Existing site projects (from `files/site-full/index.html`):
| no | slug | title |
|---|---|---|
| 01 | adu-models | ADU Models X, Y and Z (New York City) |
| 02 | frozen-ridge | 365 Frozen Ridge Road (Newburgh, NY) |
| 03 | novo-theatre | Novo Theatre (Barishal) |
| 04 | green-farm-resort | Green Farm Resort (Manikganj) — MERGE Facebook post-014 images |
| 05 | z-commercial-complex | Z Commercial Complex (Gulshan-1) |
| 06 | vacation-house | Vacation House (Savar) |
| 07 | uttara-studio-apartment | Uttara apartment interior — MERGE Facebook post-008 (017 is a duplicate) |

New, from Facebook (`Facebook - ZED/posts.json`, images `Facebook - ZED/post-NNN-NN.jpg`, 2000px):
| slug | posts | notes |
|---|---|---|
| jashore-apartment | 001 + 003 | living/dining set + bedroom set, Jashore |
| dhanmondi-apartments | 002 + 005 | 002 joint venture with Boobun (co-architect Asif Iqbal Khan); 005 second apartment |
| bijoy-nagar-residence | 010 | Cornerstone Design Studio |
| khulna-residence | 012 | (019 is a duplicate — ignore) |
| bashundhara-rooftop | 006 + 016 | rooftop terrace, reception, front-yard garden |
| wari-old-dhaka | 013 | rooftop + lobby; description truncated in posts.json |
| lcls-lawyers-chamber | 018 | Gulshan-1, JV with Dreero.aec (co-architect Tanmay Hassan) |
| uttara-residential-tower | 011 | portrait 1414x2000 elevations + plan; Cornerstone Design Studio |
| green-school-rooftop | 015 | Mohammadpur Green School; plans + axonometrics; text truncated |
| learning-space-interior | 009 | axonometric cutaways; text truncated |
| narayanganj-kitchen | 004 | small renders on white |

Excluded: posts 007, 017, 019, 020, 021, 022.

## Image naming
- Existing projects keep the old basenames from `files/site-full/images` (e.g. `adu-x-hero.jpg` → `images/adu-models/adu-x-hero.jpg`).
- Facebook images keep their post names (`images/jashore-apartment/post-001-01.jpg`).
- Every large `<name>.jpg` has a `<name>-sm.jpg` sibling. Both are listed in the manifest only by the large name.

## src/projects.json schema
```json
[{
  "slug": "adu-models",
  "no": "01",
  "title": "ADU Models X, Y and Z",
  "location": "New York City",
  "year": "2025",
  "category": "Architecture",          // one of: Architecture | Interiors | Masterplan | Academic
  "summary": "One sentence, <= 160 chars, shown on cards and as meta description.",
  "body": ["paragraph", "paragraph"],   // 1–4 short paragraphs, professional, first person where the old site used it
  "credit": "Who did what / office / joint venture. Optional.",
  "spec": [["Location","New York City"],["Role","Designer"],["Size","643–776 sq ft"],["Type","Detached ADU"]],  // exactly 4
  "cover": "adu-x-hero.jpg",           // card image + hero
  "heroCaption": "Model X — entry corner",
  "groups": [                           // in order, after the text
    { "layout": "g2", "sheet": false, "images": [ { "file": "adu-x-context.jpg", "caption": "…", "alt": "…" } ] }
  ]                                     // layout: "full" | "g2" | "g3"; sheet:true = drawing on white paper
}]
```
Order in the file = order on the site. Suggested order: the 7 existing first (as now), then the strongest
Facebook projects (bashundhara-rooftop, jashore-apartment, wari-old-dhaka, khulna-residence,
bijoy-nagar-residence, dhanmondi-apartments, lcls-lawyers-chamber, uttara-residential-tower,
green-school-rooftop, learning-space-interior, narayanganj-kitchen). Renumber `no` 01–18 in order.

## Design (carry over from files/site-full/index.html — read its <style> block)
- Dark field `--ink:#121417`, text `#EDEDEA`, lines `#32373D`, mid grey `#8D939A`; bone `#F0EEE9` for the Practice band.
- Typeface: Archivo variable from Google Fonts (wdth 62..125, wght 400..700). Display style `.exp`
  (font-stretch 120%, 700, tight tracking, line-height .88).
- No accent colour. Colour comes from the work.
- Drawings sit on a white "sheet". Renders inside a project page are never cropped or stretched.
- Exception (new): cards on the home grid use a fixed 3:2 frame with object-fit: cover, so the index reads as a calm grid.
- Fixed translucent top bar; side padding `--pad: clamp(20px,4vw,64px)`; max content width ~1440px centred on very wide screens.
- One orchestrated entrance animation on the home hero only; respect prefers-reduced-motion.

## Pages
**Home (`/`)**: top bar (name · Work · Practice · Drawing · Contact) → hero (name, role line, 4-item
dimension strip, Projects = "Eighteen selected") → Work: category filter chips (All / Architecture /
Interiors / Masterplan / Academic, JS-enhanced, all cards visible without JS) and a responsive card grid
(3 cols ≥1100px, 2 cols ≥640px, 1 col below). Card = cover image, "P-01", title, location · year →
links to `/projects/<slug>` → Practice band (copy from old site) → Drawing & photography → Contact (copy from old site).

**Project page (`/projects/<slug>`)**: top bar → header (P-NN, title, where-line) → full-bleed hero with
caption → body text + credit → 4-cell spec strip → image groups → prev / next project nav + "All work" link → footer contact line.
Lightbox on every `.fig` image: arrows/keys to step through all images on the page, Esc to close, focus
returns, caption shown, loads the large file.

## Performance rules
- `<img>` always has `width`/`height` from the manifest, `srcset="<sm> 960w, <lg> <w>w"` and a sensible `sizes`.
- Hero image: `fetchpriority="high"`, not lazy. Everything else `loading="lazy" decoding="async"`.
- No JS framework; site.js < 6 KB. CSS in one file.
- Fonts: preconnect + `display=swap`.
- `vercel.json`: `cleanUrls: true`, cache `public, max-age=31536000, immutable` for `/images/(.*)` and `/assets/(.*)`.
- Total `site/images` should stay under ~120 MB; no file over 2.5 MB.

## Accessibility & SEO
Semantic landmarks, alt text on every image, visible focus, `<title>` per page ("<Project> — Arman Hossain Amir"),
meta description = summary, Open Graph title/description/image (cover). `lang="en"`.
