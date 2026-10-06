# Arman Hossain Amir — portfolio site

Static site. No framework, no bundler, no runtime dependencies. The generated HTML is
committed, so Vercel serves the folder as-is (no build step on Vercel).

## Layout

```
index.html                    generated: home
projects/<slug>/index.html    generated: one page per project
assets/site.css               hand-written styles (one file)
assets/site.js                hand-written: lightbox + category filter (< 6 KB)
images/<slug>/<name>.jpg      large image (+ <name>-sm.jpg at 960 px)
images/manifest.json          { "<slug>/<name>.jpg": { "w": ..., "h": ... } }
src/projects.json             project content (order in file = order on site)
src/site.json                 home content: hero, work, practice, drawing, contact
src/fixtures/*.sample.json    small dev fixtures, used when src/*.json is missing
build.mjs                     node build.mjs -> writes the HTML
serve.mjs                     local static server with Vercel-style clean URLs
vercel.json                   cleanUrls, long cache headers for /images and /assets
```

## Build

```powershell
node build.mjs              # uses src/projects.json + src/site.json
node build.mjs --fixtures   # force the sample fixtures
```

The build reads image sizes from `images/manifest.json` (or from the JPEG header if an entry is
missing), writes `width`/`height`/`srcset`/`sizes` on every image, escapes all text, and stops
with a list of problems if any image or its `-sm.jpg` file is missing. Asset URLs carry a
content hash (`/assets/site.css?v=…`), so the one-year immutable cache is safe to use.

Edit content in `src/*.json`, then run the build again and commit the regenerated HTML.

Optional fields the build understands: per project `where` (line under the title),
`coverAlt`, `credit`; in `site.json`, `url` (absolute site URL for Open Graph and canonical
links), `title`, `description`. Image `file` values may be `name.jpg` (looked up in the
project's folder) or `folder/name.jpg`.

## Preview locally

```powershell
node serve.mjs              # http://localhost:4173
node serve.mjs 8080
```

`/projects/adu-models` maps to `projects/adu-models/index.html`, the same way Vercel's
`cleanUrls` does.

## Layout rules

- Image groups (`full` / `g2` / `g3`) are laid out as justified rows: images in a row share
  one height and are never cropped. Rows that would be taller than the screen are scaled
  down and centred. Odd counts are balanced (3 in a `g2` group form one row; 4 in a `g3` group
  form 2 + 2).
- Project heroes are full-bleed, except portrait covers and covers narrower than 1600 px,
  which sit centred on a charcoal band at no more than their own width.
- Home cards use a fixed 3:2 crop. This is the only place images are cropped.

## Deploy

From this folder: `vercel` (preview) or `vercel --prod`. There is no build command and the
output directory is the folder itself.
