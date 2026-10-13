# Project guidance

- This repository is public. Review the publication boundary before adding files.
- Read `docs/security-baseline.md` and `public-files.json` before changing infrastructure.
- Existing local prototypes and documentary assets are private pending publication approval. Do not stage them, copy their provenance into public files, or expand the allowlist without explicit authorization.
- Read `docs/project-context.local.md` when present; it is ignored machine-local routing context and must never be committed.
- Keep original media, client data, internal budgets, local paths and credentials outside the public tree.
- Use Node.js 22 and its standard library. No application framework or runtime dependencies have been selected.
- Run `npm run verify` and `git diff --check` before handing off changes.
- GitHub Actions must use full commit SHA pins, minimum token permissions, GitHub-hosted runners and bounded timeouts. Do not use `pull_request_target` to execute contribution code.
- Review `.github/` changes carefully; branch protection must be enforced remotely by an administrator.
- Deployments, public media publication, Git commits and pushes require explicit user authorization. Preserve unrelated local work.
