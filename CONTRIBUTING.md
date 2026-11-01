# Contributing

Use Node.js 22.23.0 or a later patched Node.js 22 release. The website has no
runtime dependencies; Playwright is used only for development checks.

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run verify
git diff --check
```

Keep changes focused. The current development workflow uses direct commits and pushes to `main`, without mandatory pull requests or owner approval. Run local verification before pushing and inspect CI/CodeQL afterward. Review all added files, generated output and workflow edits. `public-files.json` is the exact list of files approved for the initial public infrastructure. Additions require a publication review and matching ignore-rule changes. Passing the guard is not proof that media permissions or business claims are approved.

Never include environment files, credentials, local document paths, client information, private media or private provenance in code, issues, PR bodies or CI logs. Use synthetic examples in tests. Report vulnerabilities through the private channel described in `SECURITY.md`.

The code and branding have no open-source license at this stage. Do not add a license or grant reuse rights without the owner's decision.
