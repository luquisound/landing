# Luquisound

Static website for Luquisound at https://luquisound.com/.

## Local development

Use Node.js 22. Install the development tools and Chromium once:

```sh
npm ci --ignore-scripts
npx playwright install chromium
```

Start the loopback-only preview; the server prints its local URL:

```sh
npm run preview
```

Local preview needs no build step or runtime dependencies. Playwright is used
only for development checks.

## Hosting

Cloudflare Workers serves the public landing separately from the private
quotation app at `cotizador.luquisound.com`. HTTP and `www` redirect to
`https://luquisound.com/`, preserving paths and query parameters.

Run `npm run build` to prepare a fresh `dist/` directory. Its `site/` subdirectory
contains approved website entries from `public-files.json` and a generated
`_headers` configuration; the generated server entry stays outside the served
assets. The command refuses an existing output directory; an optional fresh
path can be passed with `npm run build --
<output-directory>`. Never deploy the raw repository or `site/` directory.
`wrangler.json` describes the landing Worker and its two custom domains.
Its prepared configuration runs the Worker first for `/`, `/*.html` and
`/assets/*.mp4`, while other approved assets are served directly with the same
security headers. Before deploying this configuration, create and verify the
free canonical redirect rule described in the [frontend guide](docs/frontend.md).
Deployment remains a separate, explicitly authorized operation using an
authenticated Wrangler CLI (validated with version 4.157.0). No runtime
dependencies, secrets, database or paid plan are required for this landing.

## Verification

Before an authorized commit or push, run:

```sh
npm run verify
git diff --check
```

Verification covers the publication boundary, internal site references,
unit tests and Chromium browser smoke tests. See the [frontend guide](docs/frontend.md)
for focused commands and the remaining manual checks.

Only files listed in `public-files.json` are approved for publication.
See the [security baseline](docs/security-baseline.md) before changing delivery
or infrastructure. Repository delivery does not deploy the website.
