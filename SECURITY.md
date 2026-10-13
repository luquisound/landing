# Security policy

The supported version is the current `main` branch. This repository initially contains development infrastructure only; no production site or backend is deployed by its workflows.

## Reporting

Do not disclose credentials, client data or vulnerability details in public issues or pull requests. Use GitHub private vulnerability reporting at <https://github.com/luquisound/landing/security/advisories/new> after the repository administrator enables it. If that form is unavailable, contact the repository owner through an existing private channel and request a secure reporting channel. No unverified contact address is provided here.

## Scope and handling

Relevant issues include credential disclosure, unintended publication of private files, workflow privilege escalation and unsafe delivery of future application code. Use synthetic evidence; do not access client data or test third-party services without authorization.

If a credential is exposed, revoke or rotate it first. Removing it in a later commit does not remove it from history, forks, caches or logs. Coordinate any history changes and notification privately with the owner.

The local publication guard catches prohibited paths and selected common credential patterns. It is a defense in addition to manual review and GitHub secret scanning, not a complete secrets scanner or a media/privacy audit. See `docs/security-baseline.md` for the remote controls that require administrator setup.
