# Developing Bodycap

Bodycap is a static site built with React 19, Vite 8, and TypeScript in strict mode. Data lives in
IndexedDB through Dexie, behind small repositories so another store could replace it. The UI uses
TanStack Router (with hash URLs, since GitHub Pages can't serve app routes), Tailwind CSS 4, and
shadcn components on Base UI. Zod checks backup files, fflate writes and reads `.zip` backups, and
vite-plugin-pwa with Workbox provides offline support.

## Getting started

You need Node 24 (see `.nvmrc`). pnpm comes through Corepack, which installs the exact version in
`package.json`:

```sh
corepack enable          # or put "corepack" in front of each pnpm command below
pnpm install
pnpm dev                 # http://localhost:5173/bodycap/
```

## Commands

| Command              | What it does                                                |
| -------------------- | ----------------------------------------------------------- |
| `pnpm dev`           | Runs the development server                                 |
| `pnpm build`         | Builds the site into `dist/`, and checks the result         |
| `pnpm preview`       | Serves `dist/` as it will be published                      |
| `pnpm lint`          | ESLint with no warnings allowed, then the Prettier check    |
| `pnpm format`        | Formats everything with Prettier                            |
| `pnpm typecheck`     | Type-checks every part of the project                       |
| `pnpm test`          | Runs the unit, storage, and UI tests with Vitest            |
| `pnpm test:coverage` | The same, failing if coverage of `src/core` drops below 95% |
| `pnpm e2e`           | Builds and serves the app, then runs the Playwright tests   |

Before the first `pnpm e2e`, install the test browsers with
`pnpm exec playwright install chromium webkit`.

## How the code is organised

```text
src/core/   Domain logic with no React, storage, or browser APIs: validation, lifecycle rules,
            kits, loans, maintenance, photo rules, mount compatibility, the system map, value
            totals, stats, alerts, search, the gear catalogue and its search, shared kit links, the
            CSV file, the insurance list, and the backup format, its .zip layout, its upgrades, and
            merging
src/data/   The only code that uses Dexie: the database and its upgrades, repositories, backup,
            restore, and merge, and storage helpers. Photos are stored as bytes, since Safari
            won't store a Blob in a private window
src/ui/     React components and pages, which reach storage only through the repositories
build/      Build helpers: the Content Security Policy, version.json, and the checks on the
            built site
tests/      Vitest tests for core, data, and UI, mirroring src/
e2e/        Playwright tests against the built site
```

ESLint keeps those boundaries: `src/core` can't import React, Dexie, or browser globals, and
`src/ui` can't import Dexie.

The gear catalogue's data is in `src/core/catalogue/data/`, one file per maker. A test checks every
entry against the gear form's own rules, so a suggestion can never fill in something Bodycap
wouldn't save.

## Tests

- **Unit tests** cover all of `src/core`, with 95% coverage required.
- **Storage tests** run the repositories, backup, restore, and merge on fake-indexeddb, and
  upgrade a database seeded at an earlier version.
- **UI tests** render the whole app in jsdom with Testing Library.
- **End-to-end tests** run in Playwright against the built site, with its real base path, security
  policy, and service worker: adding gear, picking a lens from the model suggestions, and packing
  a kit with only a keyboard, lending and returning, logging maintenance, search, a backup restored
  into an empty browser and merged into another, a photo with a GPS location stored without it, a
  `.zip` backup with photos restored into an empty browser byte for byte, the CSV file, the
  insurance list in print, a kit shared into another browser's wishlist, offline use, the install
  manifest, focus outlines, layouts that must fit on a phone, and axe accessibility checks against
  WCAG 2.2 AA on every screen and the main dialogs in both themes. Every test fails on a console
  error or a security policy violation. CI runs them in Chromium; locally, WebKit also runs the
  storage and offline tests.

## Security

- A Content Security Policy in a meta tag (production builds only) allows scripts, styles, and
  workers from the site itself and nothing else.
- Trusted Types are required, so text can never be turned into script by accident. The service
  worker is registered with the one policy the app is allowed.
- User text is always shown as text, never as HTML.
- Backup files are treated as untrusted: they're size-capped, every field is checked, and every
  link between records (such as a loan's item) must point to something in the file, before a
  restore or merge.
- Shared kit links are treated the same way: size-capped, checked field by field, and held to the
  same rules as the gear form, so a changed link can't bring in anything the app wouldn't save.
- A `.zip` backup is checked before anything in it is unpacked: it may hold only the names Bodycap
  writes, each no bigger than Bodycap would make it, so a hostile file can't unpack to more than
  it holds. Nothing in the file chooses where anything goes, and every photo must be exactly the
  size its data says.
- Photos are redrawn on a canvas and encoded again before they're stored, so nothing hidden in the
  original file, such as its location, is kept.
- CSV cells that a spreadsheet would run as a formula start with an apostrophe, as OWASP advises.
- Charts are SVG drawn with attributes, not inline styles, so the security policy needs no
  exceptions for them.

## Publishing

The **Tests** workflow runs every check on each push and pull request. The **Deploy** workflow is
started by hand: it runs the tests, builds, and publishes to GitHub Pages. Pages needs the
repository to be public on a free plan, with Settings, Pages, Source set to GitHub Actions.

- The site is built for `/bodycap/`. Set `BASE_PATH` to build for another path, such as `/` for a
  repository named `<name>.github.io`.
- If a broken service worker were ever published, deploying a build made with
  `PWA_SELF_DESTROY=true` replaces it with one that removes itself.
- The app icons are made from `public/app-icon.png`, a hand-drawn icon, and committed. After
  changing the drawing, run `pnpm dlx @vite-pwa/assets-generator@1.0.4`.

## Dependencies

pnpm only installs versions that have been public for at least a day, refuses packages whose
publishing trust has dropped, and runs no install scripts. Dependabot suggests updates weekly, a
week after each release. Workflow actions are pinned to full commit SHAs.

As of October 2026, the site loads 187 kB of gzipped JavaScript at first, about 307 kB across all
its pages, and 10 kB of CSS. The code for making and reading `.zip` backups, and the gear
catalogue, load only when they're needed. The build fails if the first load passes 200 kB, or any
script loaded later passes 40 kB.
