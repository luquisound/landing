# Luquisound

Static website for Luquisound. Under development.

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

The website needs no build step or runtime dependencies. Playwright is used
only for development checks.

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
