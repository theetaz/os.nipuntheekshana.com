# Kottu OS

Nipun Theekshana's desktop in a browser at https://os.nipuntheekshana.com.
Drag the props, open the projects, read the writing, try the terminal or scroll
through the story. Kottu OS 2.0 "Pettah" is freshly chopped since 2016.

The site uses Astro 7, one React 19 island, Tailwind CSS 4, Motion and Jotai.
Content pages render as static HTML and work without JavaScript. App windows
and their code load on demand. Cloudflare Workers serves the static assets and
the postcard API.

## Development

Use Node.js 24 (`nvm use` reads `.nvmrc`). Direct dependencies are pinned.

```sh
npm ci
npm run dev
```

Astro's development server uses http://localhost:4321. Tailwind's CSS-first
configuration lives in `src/styles/global.css`.

## Build and verification

```sh
PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA SERENDIB_ACTIVITY_SOURCE=snapshot npm run build
npm run check
npm test
npm run budgets
```

The snapshot selects the checked-in activity data for a reproducible build.
The public Turnstile test key is for local verification. Production uses its
configured public key. Build before running unit tests: some tests inspect the
generated HTML and assets.

Static output is in `dist/client`; Worker output is in `dist/server`. For local
preview, `npm run preview -- --port 4413 --ignore-lock` serves the static output.
API verification needs a local Worker and local D1 migrations too.

| Command | Purpose |
| --- | --- |
| `npm run check` | Check Astro and TypeScript |
| `npm test` | Run Vitest |
| `npm run test:watch` | Watch unit tests |
| `npm run test:e2e` | Run Playwright browser tests |
| `npm run budgets` | Check built JavaScript, CSS, fonts, HTML and images |
| `npm run icons` | Regenerate the favicon and install icons |
| `npm run og` | Capture `/og` on the local preview into `public/og.png` |
| `npm run quality` | Check, build, run unit tests and check budgets |
| `npm run postcards:admin` | Moderate postcards |

`npm run og` uses http://localhost:4413 by default. Build and serve the site
first, capture the image, then rebuild to include it in the static output.
The capture page is 1200 × 630 and is excluded from search indexing.

## Content and fonts

The original site at `../nipuntheekshana.com` is a read-only content reference.
The site builds from its own copied content and never imports that repository
at runtime. `npm run sync-content -- --check` checks the copied content;
`--source <path>` selects a source and `--dry-run` previews a sync.

Astro's local Fonts API registers Shrikhand, Kalam, Instrument Sans, Fraunces
and Martian Mono from pinned Fontsource packages. Instrument Sans and Shrikhand
are preloaded; the other faces load when used. Fonts use the SIL Open Font License.

## Deployment

```sh
npm run build
npx wrangler deploy --dry-run
```

The dry run validates the Worker and static assets without publishing.
Deployment configuration retains the original internal resource names so
existing resources and browser preferences remain compatible. Security and
caching headers live in `public/_headers`.

`npm run deploy` builds and publishes when deployment is authorised and
Cloudflare credentials are configured.
