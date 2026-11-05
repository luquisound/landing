# Website preview

The static website is in `site/`. Use Node.js 22 and run `npm run preview` to
open a loopback-only preview. The server prints its URL and serves only the
website paths listed individually in `public-files.json`. Local preview requires
no build step or runtime dependencies.

## Brand assets

Titles use the locally hosted Pliant Bold Expanded variant (700 weight,
125% width); body text uses Barlow Regular (400). WOFF2 files are loaded with
`font-display: swap`, with system sans-serif fallbacks. The font licenses are
included beside the selected fonts in `site/assets/`.

The horizontal logo, vertical logo, monogram and favicon use prepared SVG
copies with direct fills and vector paths. The brand yellow is `#FED903`.
Original documentary files stay outside the public tree. Only the exact
selected SVG, WOFF2 and license paths are approved; SVG editor metadata,
active content, external references and optional WOFF2 private/metadata
blocks are rejected by the publication guard.

The home selects one video for the current viewport: a 25-second horizontal
montage from 1000 px, or the complete vertical workshop sequence below that
width. Both are silent and play without playback controls. Static posters,
reduced-motion handling and hidden-document pausing are provided.

Services retain three pillars and link to related work.
The Services index keeps three columns from 700 px and stacks on narrower
screens. Image panels account for viewport height, headings, captions and the
floating navigation. Short viewports scroll without clipping controls.
Soundproofing explains benefits and treatment levels for doors, floors and
roofs in native disclosure controls, with selected diagrams and HTML text.
Door levels add treated surfaces; floor and roof levels add material layers.
In Services, soundproofing examples appear in this order: Mustang photographs,
BMW door-work clip, Silverado photographs and Corsa door-work clip. Service
evidence supports both photographs and manually played videos.
The Mustang collection contains two process photographs followed by its
exterior; the Silverado contains three process photographs and its exterior
last in Services. Work adds a Silverado engine-bay photograph before that
exterior through the case's optional `workOnlyMedia` collection; shared service
media remain unchanged. Prepared exterior framing is also used by both gallery
thumbnails.
Work opens with the Mustang and Silverado soundproofing cases, followed by
the eight existing case collections, ten manually played clips and eight
standalone photographs.
Cases can belong to multiple filters. Case links, filters and columns restore
through browser history. Video sources are released when their dialog closes
or the selected media changes.
Service and Work dialogs use manual media carousels with previous/next controls,
a position counter and horizontal swipes on photographs. Media navigation wraps
within the selected work; Work navigation remains separate. Photographs retain
their proportions, with short fades and height transitions disabled for reduced
motion. The current image remains visible until the requested image is ready.

## Validation

Install development tools with `npm ci --ignore-scripts` and the browser with
`npx playwright install chromium`. Playwright is a development dependency;
the website still has no runtime dependencies or build step.

`npm run verify` runs the publication guard, internal site checks, unit tests
and Chromium smoke tests at desktop and mobile viewport sizes. The browser
suite starts its own loopback preview and does not send messages or visit
external contact destinations. Focused commands are:

- `npm run check`: publication paths, file contents and index checks.
- `npm run check:site`: internal resources and case/catalogue consistency.
- `npm test`: unit and fixture-based regression tests.
- `npm run test:browser`: consultation, history, dialogs and media smoke tests.

Automated checks complement the following manual coverage:

- Run `npm run verify` and `git diff --check` before a commit.
- Check mobile, tablet, desktop and ultrawide home framing, source selection,
  reduced motion and poster fallback.
- Check service links, case filters, direct case URLs, browser history,
  keyboard navigation, manual playback and media release.
- Check carousel wraparound, rapid navigation, image failures, changing work or
  closing during image loading, horizontal swipes alongside vertical scrolling,
  mixed photo/video collections, reduced motion and changing viewport sizes.
- Check direct consultation opening by click and keyboard, repeated submissions,
  service preselection, optional idea, required four-digit year validation
  from 1900 through the current calendar year,
  WhatsApp message encoding and the direct no-JavaScript link.
  Inspect or intercept the WhatsApp URL during testing; do not send a message.
- Check that only selected website files and prepared media enter the index.
- Confirm both local fonts load and check long expanded headings, navigation,
  cards and dialogs across viewport sizes. Check SVG proportions and favicon.

Documentary originals, local prototypes and private provenance stay outside
the public file list. Prepared video files contain no audio. The vertical
workshop derivative retains its sequence, with visible personal plates masked
in three shots. Contact details include the workshop location, opening hours
and a direct WhatsApp link. Contact presents the consultation inline, followed
by compact workshop details and alternative channels on smaller screens; wider
screens use two columns. Valid service-interest links focus the vehicle field.
On Contact at widths up to 699px, navigation follows the page content in normal
flow so it cannot cover the consultation button. Other pages and wider Contact
viewports retain floating navigation.
The consultation keeps make/model and a required four-digit year in one row.
The accepted years range from 1900 through the current calendar year.
The idea is optional; empty ideas are omitted from the message. Submitting
prepares a message locally and opens WhatsApp directly, preserving the form
values for further edits. The visitor sends the message from the chat; there
is no backend or automatic message delivery.
Repository delivery does not deploy the website automatically.

## Production domain and delivery

The public origin is `https://luquisound.com`. All four pages use absolute
canonical URLs and permit indexing; `robots.txt` advertises the four-page
sitemap. Existing `.html` navigation paths are preserved, while `/index.html`,
HTTP and `www` redirect permanently to the canonical HTTPS URL, retaining query
parameters. The private quotation app remains on its own subdomain.

Run `npm run build` with a fresh output directory to package only approved
manifest entries. The default is `dist/`; an optional fresh destination can be
passed as a command argument. Website assets are isolated in its `site/` child;
the generated Worker entry includes approved video lengths without exposing
server metadata as an asset. The build also generates `_headers` from the same
security policy used by `scripts/site-worker.mjs`; this configuration is parsed
by Static Assets rather than served as content. No additional source assets or
publication allowlist entries are needed.

`wrangler.json` prepares the assets and handler for Cloudflare Workers Free,
with workers.dev and previews disabled. Selective `run_worker_first` patterns
`/`, `/*.html` and `/assets/*.mp4` preserve Worker handling for HTML and videos.
Other approved resources, including CSS, JavaScript, images and fonts, are
served directly without invoking the Worker. Their generated `_headers` rules
retain the production security headers described in the
[security baseline](security-baseline.md). The Worker retains its read-only
method checks, canonical redirects and real missing-file responses. Its CSP
allows same-origin resources and hashes the existing home-page no-JavaScript
style; no inline-script or general inline-style exception is enabled.
HTML also uses `no-transform` to prevent automatic analytics-script injection.
Video byte ranges are sliced as streams in the Worker, including suffix and
open-ended ranges, without buffering whole files. `If-Range` requires a matching
strong ETag; other validators fall back to the full representation.

Before deploying selective routing, create and verify a free Cloudflare Single
Redirect rule limited to GET and HEAD requests for exactly `luquisound.com` and
`www.luquisound.com`. Match HTTP or the `www` host and redirect permanently to
`https://luquisound.com`, preserving the original path and query string. This
rule must exclude `cotizador.luquisound.com` and all other subdomains. It is
required because resources served directly no longer reach the Worker's
canonical redirects. Exclude `/index.html` so the Worker retains its existing
single-hop redirect to `/`, including requests using HTTP or `www`.

Use this match expression, status `308`, target expression
`concat("https://luquisound.com", http.request.uri.path)` and enable query-string
preservation:

```text
(http.host in {"luquisound.com" "www.luquisound.com"} and http.request.method in {"GET" "HEAD"} and (not ssl or http.host eq "www.luquisound.com") and http.request.uri.path ne "/index.html")
```

Preparing this configuration does not publish it. An authorized push to `main`
triggers the automatic deployment described below.

Verify the full suite, canonical redirects, real missing-file responses, video
byte ranges and contact flows before an authorized deployment. Include direct
asset security headers and HTTP/`www` asset redirects. Check media and
contact destinations on the final host without sending a consultation.
Social preview enhancements and physical-device acceptance remain separate.

The November 4, 2026 domain activation uses Worker version
`50498117-2f97-4af9-bd31-7f0041c85e6b`. Live acceptance passed all 18 Chromium
desktop/mobile flow tests, HTTPS and canonical redirects, and exact prefix/suffix
byte ranges for all 12 approved videos. Both home videos loaded and played without
browser errors. Ignored media, configuration and generated server metadata return
404. Physical Safari/iPhone acceptance was not performed.

The static-routing reduction is active in Worker version
`43b33198-fe2c-4708-a742-99338562d885`, serving 100% of traffic. Cloudflare's
runtime configuration confirms direct asset delivery with the shared security
headers and selective Worker handling for HTML and MP4. The free
`luquisound_landing_canonical` Single Redirect rule is enabled with the match
and target above; the quotation app remains outside its scope.
Production acceptance passed all 18 Chromium desktop/mobile flow tests,
158 security/redirect/method checks and 72 checks across the 12 approved videos.
Both home videos loaded and advanced without browser errors. Physical
Safari/iPhone acceptance was not performed for this change.

## Automatic deployment

The CI workflow deploys `luquisound-landing` only on pushes to `main`, after
`public-boundary` and `tests` succeed. These jobs check the approved publication
boundary, site references, unit tests and Chromium desktop/mobile flows. CodeQL
runs independently and is not a deployment gate. Pull requests and manual CI
runs never deploy. Main-branch CI runs are serialized without cancelling an
active deployment.

The deploy job installs locked development dependencies without install scripts,
builds a fresh `dist/` from approved manifest entries and checks the generated
Worker with `wrangler deploy --dry-run --strict`. Only the final
`wrangler deploy --strict` step receives `CLOUDFLARE_API_TOKEN` from the private
Actions repository secret of that name. Keep the token out of source, chat and
logs. GitHub's workflow token retains only `contents: read`.

Use a dedicated Cloudflare token with Workers editing permission restricted to
the existing account. The existing Custom Domains currently prevent per-Worker
token scoping; no DNS, zone-edit, database or billing permission is needed to
retain those connections. Configure the secret through GitHub repository
Settings > Secrets and variables > Actions. Do not use local Wrangler OAuth
credentials as a repository secret. Confirm the first successful Actions deploy
and the canonical host before reporting activation.

The deployment retains `dist/site` as the sole assets directory, generated
security headers, selective Worker routing, disabled workers.dev/preview URLs,
the existing canonical redirect rule and Workers Free. It does not administer
DNS, redirect rules, the private quotation app or supplier services.
