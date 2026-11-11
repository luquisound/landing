# Public repository security baseline

## Publication boundary

The exact paths in `public-files.json` define the repository publication boundary. Infrastructure and the selected website files in `site/` are included individually. Documentary originals, local prototypes, the private preview server and provenance documents remain ignored. The documentary library remains outside Git; its location is stored only in ignored `docs/project-context.local.md`.

The selected website integration was authorized for `main`. New assets, client/vehicle identities, visible plates, audio tracks and business claims still require explicit approval. Review metadata and prepare public copies with appropriate sanitization. The selected video derivatives are silent, and the complete vertical workshop derivative masks personal plates in three shots. Keep private provenance in local/private storage. Updating the manifest or ignore rules remains a publication decision; repository delivery does not authorize a deployment.

Verification jobs need no secrets. The automatic deployment uses a dedicated
Cloudflare token from an Actions repository secret, exposed only to the final
deploy step on pushes to `main` after CI succeeds. Pull requests and manual CI
runs never deploy. CodeQL runs independently and is not a deployment gate.
Browser code must never contain private credentials; environment variable
prefixes or obscured strings do not make browser-delivered secrets private.
Avoid uploading CI artifacts containing private files. The guard detects a
limited set of common credential patterns and does not validate arbitrary
secrets or media rights. Treat every Git object, commit author, issue, PR and
log as potentially public.

## Implemented locally

- Git initialized with `main`; origin points to the supplied remote.
- Deny-by-default ignore rules plus an independent exact public file manifest.
- A Node.js standard-library guard checks indexed and visible candidate paths, selected credential patterns, local routes, file types, size, linked files, UTF-8 and JavaScript/JSON syntax. It validates the manifest before any commit and checks the complete index once files are staged.
- Regression tests for publication policy and static site references, plus Chromium smoke tests for the visitor flows. Playwright is a development-only dependency; the website has no runtime dependencies or install scripts.
- CI on pushes to `main` and PRs, with read-only tokens, no persisted checkout credentials, SHA-pinned actions, GitHub-hosted runners and job timeouts.
- CodeQL with `security-extended` queries and the narrowly scoped permission needed to upload security results. GitHub treats fork PR uploads specially; no repository secrets are passed.
- Weekly Dependabot updates for Actions and npm development tools, CODEOWNERS, contribution guidance and a security reporting policy.
- The local preview server permits only the selected landing pages, their scripts/styles and media, and rejects redirected filesystem paths. Configuration and private provenance are not served. It remains a development-only tool and does not define production security headers or a deployment bundle.

## Administrator setup

Initial inspection on 2026-10-12 confirmed a public, empty remote. The contributor session (`materamos`) had write access; the owner session (`luquisound`) was subsequently authenticated and verified with administrator access. Owner access is used only for repository configuration. Commits and pushes use `materamos`, with its GitHub no-reply author address.

The owner session configured and read back secret scanning and push protection, private vulnerability reporting, Dependabot security updates, restricted Actions with required SHA pins, read-only workflow defaults, approval for every external fork contributor and 14-day log/artifact retention. The current development workflow permits direct pushes to `main`, without mandatory pull requests or owner approval. Main protection blocks force pushes and deletion and preserves linear history. CI and CodeQL run after a push; their results do not gate the push. This document describes the baseline; inspect GitHub for its current live state.

An administrator must apply and read back each control below. JSON payloads are reviewable REST API request bodies, not a workflow that automatically changes permissions. Use the authenticated GitHub CLI without copying tokens into files or this repository.

1. Review changes and run local verification before authorized commits/pushes directly to `main`. Review the commit author email; use GitHub's verified no-reply address if personal email should remain private. Inspect CI and CodeQL results after each push and address failures.
2. Apply repository merge settings and secret scanning/push protection:

   ```sh
   gh api --method PATCH repos/luquisound/landing --input docs/github-settings/repository.json
   gh api --method PUT repos/luquisound/landing/private-vulnerability-reporting
   ```

3. Restrict Actions to the required official actions, require SHA pins and restrict token permissions:

   ```sh
   gh api --method PUT repos/luquisound/landing/actions/permissions --input docs/github-settings/actions.json
   gh api --method PUT repos/luquisound/landing/actions/permissions/selected-actions --input docs/github-settings/allowed-actions.json
   gh api --method PUT repos/luquisound/landing/actions/permissions/workflow --input docs/github-settings/workflow.json
   gh api --method PUT repos/luquisound/landing/actions/permissions/fork-pr-contributor-approval -f approval_policy=all_external_contributors
   ```

   GitHub requires `allowed_actions` to be `selected` before accepting the action allowlist. Configure both while no workflow is running. Use only GitHub-hosted runners; do not grant write tokens to fork PRs. Set short log/artifact retention:

   ```sh
   gh api --method PUT repos/luquisound/landing/actions/permissions/artifact-and-log-retention -F days=14
   gh api --method PUT repos/luquisound/landing/vulnerability-alerts
   gh api --method PUT repos/luquisound/landing/automated-security-fixes
   ```

   Confirm account/organization policy permits these settings; do not broaden action access to work around a policy failure.

4. Inspect `main-ruleset.json` and create the ruleset, or update the existing ruleset using its ID:

   ```sh
   gh api --method POST repos/luquisound/landing/rulesets --input docs/github-settings/main-ruleset.json
   ```

   This blocks force pushes and branch deletion, requires linear history and has no bypass actors. It does not require PRs, reviews, status checks or pre-existing CodeQL results. These gates would prevent routine direct pushes before the new commit could be analyzed. Secret scanning push protection remains enabled independently. CODEOWNERS provides optional reviewer guidance rather than a required approval.

5. Read back repository `security_and_analysis`, Actions policies, workflow defaults, private reporting status and the ruleset. Verify an authorized direct push to `main` succeeds and CI/CodeQL run on its commit. Confirm force-push and deletion rules remain active. Do not claim these protections are active based solely on JSON files, CODEOWNERS or a workflow definition.

These admin controls need the repository owner's session or an appropriately scoped admin credential. Do not request or paste credentials into chat. GitHub may reject a payload due to account/organization policy; resolve the specific rejection with the owner rather than disabling controls.

## Delivery and hosting

The selected public host is Cloudflare Workers Free at `luquisound.com`, with
`www.luquisound.com` redirecting to the apex and HTTP navigation upgrading to
HTTPS. It is a separate Worker from the private quotation app; the landing has
no credentials, database or API bindings. Workers.dev and preview URLs are
disabled. Existing Vercel project linkage is not used for landing delivery.

The public prototype uses `noindex` metadata while allowing crawling. This
search-engine instruction is not access control: all approved website content
remains public and must continue to satisfy the publication boundary above.

`scripts/build-site.mjs` copies only exact approved `site/` manifest entries to a
fresh output directory's `site/` child, validating content and rejecting linked
source paths. It generates `_headers` from the Worker's security policy without
copying a source sidecar or expanding the publication allowlist. Static Assets
parses this configuration rather than serving it as content. A generated server
entry with approved video lengths stays outside that served child; no metadata
endpoint is published.
Do not deploy the raw `site/`, repository root or documentary library: ignored
local media can exist beside approved assets. The prepared `wrangler.json`
configuration runs `scripts/site-worker.mjs` first for `/`, `/*.html` and
`/assets/*.mp4`. Other approved resources are served directly by Static Assets,
with the generated `_headers` preserving CSP, HSTS, framing, referrer,
permissions and MIME-sniffing protection. Worker responses use that same policy
and retain canonical redirects and read-only methods. Static asset lookup
retains real 404s without SPA fallback.
The Worker streams one video byte range per request because the static asset
binding ignores Range requests. HTML responses retain `no-transform` to
prevent automatic third-party script injection conflicting with the site's CSP.
Before deploying selective routing, create and verify a free Single Redirect
rule for GET/HEAD requests to exactly `luquisound.com` or `www.luquisound.com`
when the request uses HTTP or the `www` host. Redirect permanently to HTTPS on
the apex, preserving path and query. Do not match the private quotation app or
other subdomains. Exclude `/index.html` so the Worker retains its single-hop
redirect to `/`. This prerequisite preserves canonical redirects for resources
that bypass the Worker. Authorized pushes to `main` deploy only after the
publication/site checks, unit tests, Chromium flows, fresh approved build and
Worker dry run succeed. The lockfile-installed Wrangler retains the existing
Custom Domains and redirect rule without DNS or zone-edit permissions. Its
dedicated token is restricted to Workers editing in the existing account;
Custom Domains currently do not support per-Worker token scoping. Keep it in
the private `CLOUDFLARE_API_TOKEN` Actions repository secret, never in the public
tree or build. Activation requires that secret and a verified first deployment.

## References

- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub secret scanning](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)
- [Actions permissions REST API](https://docs.github.com/en/rest/actions/permissions)
- [Repository rules REST API](https://docs.github.com/en/rest/repos/rules)
