# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Romanian-language robotics parts store ("Magazin de piese de robotica") built with Node.js + Express + EJS. It is a university web technologies project (TW = Tehnologii Web).

## Running the Server

```bash
node index.js              # start server (default port 5000, auto-increments if busy)
npx nodemon index.js       # start with auto-reload on file changes (dev)
PORT=3000 node index.js    # custom port
```

No build step is needed. SCSS is compiled automatically at server startup and watched for live changes.

## Architecture

**Single entry point:** `index.js` — handles Express setup, SCSS compilation, middleware, all routes, and server startup.

**Routing:**
- `/`, `/index`, `/home` → renders `views/index.ejs` with products and today's gallery images
- `/galerie` → renders `views/pagini/galerie.ejs`
- `/resurse/imagini/galerie/:file?w=<px>` → serves gallery images, resizing on-demand via Sharp if `w` query param is present
- `/resurse/` (directory itself) → 403
- Unmatched routes → 404 via `afisareEroare()`

**Views (EJS):**
- `views/index.ejs` — main page (standalone, not using EJS partials)
- `views/pagini/` — inner pages (galerie.ejs, about.ejs, eroare.ejs)
- `views/fragmente/` — reusable partials: `head.ejs`, `header.ejs`, `footer.ejs`, `galerie.ejs`

Note: `index.html`, `galerie.html`, and `galerie-dinamica.html` are static HTML files served separately from the EJS routes.

**Data (JSON, loaded fresh per request):**
- `resurse/json/produse.json` — product catalog (`{ produse: [...] }`)
- `resurse/json/galerie.json` — gallery images with day-of-week display intervals (`intervale_zile`)
- `resurse/json/erori.json` — error page config (images, titles, texts by HTTP code)

**Styles:**
- `resurse/scss/` → compiled to `resurse/css/` at startup; file watcher re-compiles on save
- Before each recompile, the existing CSS is backed up to `backup/resurse/css/` with a timestamp suffix
- `resurse/scss/custom.scss` customizes Bootstrap 5 via `@use ... with ()`
- `resurse/css/nav.css`, `nav1000.css`, `nav700.css` — responsive nav breakpoints (separate files, not SCSS-generated)

**Auto-created directories** (created at startup if missing): `temp/`, `backup/`, `logs/`, `fisiere_uploadate/`

## Key Behaviors

- **Gallery day filtering:** `esteImagineAstazi()` filters gallery images by `intervale_zile` (array of `[startDay, endDay]` pairs in Romanian). The route accepts `?data=YYYY-MM-DD` to test a specific date. Gallery is always truncated to an even count for zig-zag layout.
- **On-demand image resizing:** Sharp resizes gallery images to `w x (w*1.25)` (cover fit); cached as `<name>_<w>w<ext>` beside the original.
- **Error handling:** `afisareEroare(res, code)` reads `obGlobal.obErori` (initialized once at startup from `erori.json`).
- **Port selection:** tries port 5000, increments up to 20 times if `EADDRINUSE`.

## Template Variables

`views/index.ejs` receives: `{ produse, galerie: { cale_galerie, imagini }, dataAstazi, ip }`

`views/pagini/galerie.ejs` receives: `{ galerie: { cale_galerie, imagini }, dataAstazi, ip }`
