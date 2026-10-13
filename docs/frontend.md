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

Services retain three pillars and link to related work. Work contains eight
case collections, ten manually played clips and nine existing photographs.
Cases can belong to multiple filters. Case links, filters and columns restore
through browser history. Video sources are released when their dialog closes
or the selected media changes.

## Validation

- Run `npm run verify` and `git diff --check` before a commit.
- Check mobile, tablet, desktop and ultrawide home framing, source selection,
  reduced motion and poster fallback.
- Check service links, case filters, direct case URLs, browser history,
  keyboard navigation, manual playback and media release.
- Check that only selected website files and prepared media enter the index.
- Confirm both local fonts load and check long expanded headings, navigation,
  cards and dialogs across viewport sizes. Check SVG proportions and favicon.

Documentary originals, local prototypes and private provenance stay outside
the public file list. Prepared video files contain no audio. The vertical
workshop derivative retains its sequence, with visible personal plates masked
in three shots. Contact details include the workshop location, opening hours
and a direct WhatsApp link. The consultation remains a local preview/copy
flow. Repository delivery does not deploy the website.
