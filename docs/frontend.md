# Website preview

The static website is in `site/`. Use Node.js 22 and run `npm run preview` to
open a loopback-only preview. The server prints its URL and serves only the
website paths listed individually in `public-files.json`. No build step or
runtime dependencies are required.

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
The consultation keeps make/model and a required four-digit year in one row.
The accepted years range from 1900 through the current calendar year.
The idea is optional; empty ideas are omitted from the message. Submitting
prepares a message locally and opens WhatsApp directly, preserving the form
values for further edits. The visitor sends the message from the chat; there
is no backend or automatic message delivery.
Repository delivery does not deploy the website.

## Before launch

Keep `noindex,nofollow` during development. With the final domain and approved
public media in place, review indexability on all four pages, canonical URLs,
page titles/descriptions, social previews, a sitemap and confirmed business data.

Prepare only the approved public directory for hosting. Verify HTTPS and
production security headers as described in the [security baseline](security-baseline.md).
Measure media delivery on the final host and check contact destinations and
selected media privacy manually. Deployment requires separate authorization.
