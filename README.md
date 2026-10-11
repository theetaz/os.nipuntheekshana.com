# Serendib OS

A desktop-OS-style personal website for Nipun Theekshana at
https://os.nipuntheekshana.com. The site uses Astro 7, React 19 and Tailwind CSS 4,
and builds to static HTML for Cloudflare Workers static assets.

## Development

Use Node.js 24 (`nvm use` reads `.nvmrc`). All direct dependencies are pinned.

```sh
npm ci
npm run dev
```

Astro serves the site at http://localhost:4321. Tailwind uses CSS-first
configuration in `src/styles/global.css`.

This scaffold currently renders a placeholder home page. The desktop shell,
content, design tokens and test harness arrive in subsequent tasks. The local
`.design/` directory contains the specifications and is excluded from Git.

## Scripts

| Command | Purpose | Availability |
| --- | --- | --- |
| `npm run dev` | Start the Astro development server | Scaffold |
| `npm run check` | Check Astro and TypeScript | Scaffold |
| `npm run build` | Build the static site into `dist/` | Scaffold |
| `npm run preview` | Serve the built site on port 4321 | Scaffold |
| `npm test` | Run Vitest unit tests | Scaffold dependency-lock test; harness in P0-3 |
| `npm run test:watch` | Watch unit tests | Scaffold dependency-lock test; harness in P0-3 |
| `npm run test:e2e` | Run Playwright end-to-end tests | Test harness (P0-3) |
| `npm run budgets` | Check the built site's size budgets | Test harness (P0-3) |
| `npm run lhci:desktop` | Run desktop Lighthouse CI | Test harness (P0-3) |
| `npm run lhci:mobile` | Run mobile Lighthouse CI | Test harness (P0-3) |
| `npm run sync-content` | Copy content from the original website | Content sync (P0-2) |
| `npm run contours` | Generate the contour wallpaper | Wallpapers (P1-3) |
| `npm run icons` | Generate PNG icons from SVG artwork | Icons (P1-4) |
| `npm run og` | Generate the social preview image | SEO (P5-3) |
| `npm run quality` | Run check, unit tests, build and budgets | Requires P0-3 |
| `npm run deploy` | Build and deploy with Wrangler | Requires Cloudflare credentials |

All scripts are defined up front; commands marked for a later task require that
task's files before they can run.

## Content sync

The original repository, `../nipuntheekshana.com`, is a read-only reference. The
sync tool (P0-2) will copy content into this repository; the website never imports
from that repository at build or runtime.

```sh
npm run sync-content -- --source ../nipuntheekshana.com
npm run sync-content -- --check
npm run sync-content -- --dry-run
```

Commit the copied content here. CI will build from those copies and will not run
the sync tool.

## Fonts

Astro's local Fonts API registers Instrument Sans, Fraunces (normal and italic)
and Martian Mono from the pinned Fontsource packages. The full layout will load
them in P1-2; this placeholder page does not preload fonts.

## Deployment

```sh
npm run build
npx wrangler deploy --dry-run
```

The dry run validates the static-assets deployment without publishing or needing
Cloudflare authentication. `wrangler.jsonc` names the Worker `serendib-os`, serves
`dist/`, and configures the custom domain `os.nipuntheekshana.com`. The assets carry
security and caching headers from `public/_headers`.

When production launch is authorised and Cloudflare credentials are configured,
`npm run deploy` builds and publishes the site. The build-and-deploy workflow will
be added in P0-4; GitHub repository setup and production launch are later work.

The SEO route helpers are temporary scaffold exports. The final canonical and
sitemap policy will be implemented in P5-3.

## Scaffold validation notes

The configuration's `fontFile` helper has JSDoc string parameter types so the
strict TypeScript check can validate the JavaScript configuration.

The pinned Lighthouse CI dependency tree currently reports 17 npm audit findings
(11 high, 4 moderate, 2 low); `npm audit --omit=dev` reports zero findings.
Dependency upgrades require a separate deliberate
change; the scaffold retains every version specified for this project.

A scaffold-only test verifies that every direct dependency has an exact version
and resolves to that version in `package-lock.json`. This satisfies the common
unit-test requirement without introducing the later test harness.

Wrangler's `@cloudflare/workers-types` peer is optional and was not automatically
installed by npm 11.17.0, contrary to the architecture note. The static scaffold
does not need it; the backend phase will add it explicitly.
