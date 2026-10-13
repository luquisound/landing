# Luquisound landing

Public repository infrastructure for the Luquisound landing project: <https://github.com/luquisound/landing>.

The initial public tree contains repository policy, publication checks and CI only. Existing local landing studies and their media are excluded until publication clearance is approved. No production hosting, domain, credentials, backend or application framework is configured.

## Infrastructure verification

Use Node.js 22.23.0 or a later patched Node.js 22 release:

```sh
npm ci --ignore-scripts
npm run verify
```

There are no third-party npm dependencies. CI validates the public file boundary and runs regression tests; CodeQL checks JavaScript and Dependabot proposes updates to GitHub Actions. Actions are pinned to complete commit SHAs and deployments are not automated.

`public-files.json` records the exact initial publication boundary. `.gitignore` denies unapproved paths by default; the guard also rejects unapproved tracked files, selected credential patterns and machine-local routes. Read [the security baseline](docs/security-baseline.md) for administrator setup, remaining limitations and media approval requirements. Public visibility does not grant an open-source license; no reuse license is selected.

## Local landing studies

The preview instructions below apply to the original local workspace. Public clones do not include the prototypes, their assets or `preview.mjs`.

Two independent, buildless HTML/CSS/JavaScript prototypes. Option 01 is the selected landing direction. Option 03 remains a separate reference for future work and collection sections. This is a local visual exploration, not a published site or a final commercial brief.

| Directory | Direction | Reference |
| --- | --- | --- |
| `01-immersive/` | Cinematic, dark, video-led | Crobar |
| `03-gallery/` | Photograph-led portfolio and panels | Why Not? Studio |

## Preview

From this directory, run:

```powershell
node preview.mjs
```

Open the Local URL printed by the server. It starts at `http://127.0.0.1:4173/` and chooses the next available port through 4180 if needed. It binds to loopback by default and supports video range requests. No dependency installation or build is required.

To preview on a phone connected to the same local network, bind to the computer's LAN IPv4 address:

```powershell
node preview.mjs --host 192.168.1.41
```

Open the printed LAN URL on the phone. The address may change when the computer reconnects. Windows Firewall must allow inbound TCP traffic on the printed port from the local subnet.

Each prototype contains its own assets and can also be served independently with a static HTTP server. Use HTTP for the intended video and clipboard behavior.

## Scope

- Source photographs, logos and workshop video come from the separate Luquisound business library. Originals remain untouched.
- Each `assets/PROVENANCE.md` records the source paths and media preparation.
- Contact details and descriptive copy are placeholders. Contact interactions stay local; no messages are sent.
- No current price, stock, warranty, compatibility or installation-time claims are established by these prototypes.
- No store or quoting system is implemented or linked as if available.
- The local Git repository is linked to the public remote. The prototypes and original media remain outside the initial public file list. Commit, push and deployment are separate delivery steps.

The supplied references informed composition and interaction. These are original Luquisound directions rather than reproductions of the reference sites.
