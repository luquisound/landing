# Public repository security baseline

## Publication boundary

The bootstrap intentionally publishes only the exact infrastructure paths in `public-files.json`. Existing local prototypes, the local preview server, photographs, videos and provenance documents are ignored. The documentary library remains outside Git; its location is stored only in ignored `docs/project-context.local.md`.

Media clearance is pending. Before adding landing content, obtain approval for every selected asset, client/vehicle identity, visible plate, audio track and business claim. Review metadata and prepare public copies with appropriate sanitization. Keep the private provenance document in local/private storage; prepare a public-safe credit or permission record only when appropriate. Updating the manifest or ignore rules is a publication decision.

No secrets are needed for the initial CI. Browser code must never contain private credentials; environment variable prefixes or obscured strings do not make browser-delivered secrets private. Avoid uploading CI artifacts containing private files. The guard detects a limited set of common credential patterns and does not validate arbitrary secrets or media rights. Treat every Git object, commit author, issue, PR and log as potentially public.

## Implemented locally

- Git initialized with `main`; origin points to the supplied remote.
- Deny-by-default ignore rules plus an independent exact public file manifest.
- A Node.js standard-library guard checks indexed and visible candidate paths, selected credential patterns, local routes, file types, size, linked files, UTF-8 and JavaScript/JSON syntax. It validates the manifest before any commit and checks the complete index once files are staged.
- Regression tests for publication policy. No third-party npm dependencies or install scripts.
- CI on pushes to `main` and PRs, with read-only tokens, no persisted checkout credentials, SHA-pinned actions, GitHub-hosted runners and job timeouts.
- CodeQL with `security-extended` queries and the narrowly scoped permission needed to upload security results. GitHub treats fork PR uploads specially; no repository secrets are passed.
- Weekly Dependabot updates for Actions, CODEOWNERS, contribution guidance and a security reporting policy.
- The local preview server now permits only the two existing preview pages, their scripts/styles and media, and rejects redirected filesystem paths. Configuration and private provenance are not served. It remains a development-only tool and does not define production security headers or a deployment bundle.

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

The infrastructure does not configure GitHub Pages, Vercel, DNS or any production environment. The buildless local studies remain usable locally. Select the production stack and approved public media before preparing a deployable directory. Serve only that approved directory, with HTTPS and reviewed CSP, framing, referrer, permissions and MIME-sniffing policies. Do not deploy the repository root or the documentary library. Any future deployments must be separately authorized and verified.

## References

- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub secret scanning](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)
- [Actions permissions REST API](https://docs.github.com/en/rest/actions/permissions)
- [Repository rules REST API](https://docs.github.com/en/rest/repos/rules)
