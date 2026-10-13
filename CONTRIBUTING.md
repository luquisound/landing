# Contributing

Use Node.js 22.23.0 or a later patched Node.js 22 release. There are no third-party npm dependencies.

```sh
npm ci --ignore-scripts
npm run verify
git diff --check
```

Submit focused pull requests. Review all added files, generated output and workflow edits. `public-files.json` is the exact list of files approved for the initial public infrastructure. Additions require a publication review and matching ignore-rule changes. Passing the guard is not proof that media permissions or business claims are approved.

Never include environment files, credentials, local document paths, client information, private media or private provenance in code, issues, PR bodies or CI logs. Use synthetic examples in tests. Report vulnerabilities through the private channel described in `SECURITY.md`.

The code and branding have no open-source license at this stage. Do not add a license or grant reuse rights without the owner's decision.
