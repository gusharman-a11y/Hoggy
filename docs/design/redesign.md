# Hoggy redesign: "Field Atlas"

Branch `redesign`, November 2026. Replaces the dark-green, Inter, card-and-pill interface.

## The concept

A conference is a place and a date, and a doctor's year is a route between them. Hoggy now looks like a pocket atlas
crossed with a departures board: every listing gets its own printed **plate** (a small generated relief map with the
date set in oversized numerals), pages are ruled like a ledger instead of boxed like a dashboard, and the numbers that
matter (days to go, CPD hours, dollars waiting) are set as large as headlines. The artwork also carries Hoggy's honesty
rule: a plate with solid contours, a filled numeral and a stamp means "dates confirmed, source stored"; dashed contours
and an outlined month mean "estimate". You can read the data quality before you read a word.

## Identity

- **Mark**: a hedgehog reduced to a dome with five quills, which also reads as a sun on a horizon (the trip) and as
  radiating contour ticks (the plates). One colour, works at 16 px. `icons/icon.svg`, inlined in the header.
- **Wordmark**: "hoggy", lower case, IBM Plex Sans Condensed Bold, tight tracking (-.03em). The double g is the personality.
- **Voice in type**: sentence case everywhere. No uppercase eyebrows; kickers are small, sentence case, with a rule.
- **Motif**: the plate (see below), the perforated edge (ticket stubs on trips and receipts) and the quill tick (list
  bullets, the CPD dial marks, loading state).

## Type

IBM Plex (OFL), November 2026: the owner found the earlier text face too generic, and Plex was chosen from five tuned
options (`fonts-explore`, option C). Three self-hosted woff2 files, Latin subset, no hinting, kern and liga only:
**37 KB in all** (the pair it replaced was 69 KB). The two used on every screen (Plex Sans 400 and Plex Sans Condensed
700) are preloaded; SemiBold loads on first use. `font-display: swap`. Plex figures are tabular by default, so no mono
face is needed for numbers.

| Role | Face | Size | Notes |
|---|---|---|---|
| Display / hero | Plex Sans Condensed 700 | `clamp(2.9rem, 7.3vw, 7.7rem)` | line-height .9, tracking -.03em |
| Page title (h1) | Plex Condensed 700 | `clamp(2.42rem, 7vw, 4.84rem)` | line-height .9, tracking -.03em |
| Section title (h2) | Plex Condensed 700 | `clamp(1.4rem, 3vw, 2.2rem)` | tracking -.012em |
| Numerals | Plex Condensed 700 | up to 7.9rem | tabular by default |
| Card / row title | Plex Condensed 700 | 1.1–1.25rem | |
| Body | Plex Sans 400, 600 | 1rem / 1.5 (16 px on phones) | 500 in the CSS renders as 400 |
| Meta / notes | Plex Sans 400 | .8125–.875rem | never below 13 px |

Display sizes are set for Plex Condensed directly (about 12% below the sizes drawn for the face it replaced), not with
`size-adjust`, so Safari before 17 gets the same layout. On the plates (`lib/art.js`) the date numerals are drawn at 76%
and the month at 88% of the grid's nominal sizes, so a two-digit day still clears the month.

Fallback stack is `"Arial Narrow", "Helvetica Neue", Arial, sans-serif` for display and `system-ui` for text.

## Colour tokens

| Token | Light ("paper") | Dark ("night") | Use |
|---|---|---|---|
| `--bg` | `#F4EFE6` | `#12110E` | canvas |
| `--bg-2` | `#FBF8F2` | `#1A1814` | sheets, bars |
| `--inv` / `--inv-text` | `#15130F` / `#F4EFE6` | `#F3EEE4` / `#15130F` | inverted blocks: tab bar, toasts, closing band |
| `--line-2` | `#8A8172` | `#7D7566` | field borders, dashes (3:1 on the canvas) |
| `--card` | `#FFFDF9` | `#1F1D18` | the few raised surfaces |
| `--card-2` | `#EAE3D5` | `#2A2721` | fields, tracks |
| `--text` | `#15130F` | `#F3EEE4` | ink |
| `--muted` | `#5A5347` | `#B4AC9E` | secondary |
| `--faint` | `#6A6255` | `#9C9486` | tertiary |
| `--line` | `rgba(21,19,15,.14)` | `rgba(243,238,228,.14)` | hairlines |
| `--rule` | `#15130F` | `#F3EEE4` | ledger rules (1.5 px) |
| `--flare` | `#FF4D1F` | `#FF5B2E` | the one loud colour: primary buttons, marks |
| `--accent` | `#B8300A` | `#FF8A66` | accent as text, focus ring |
| `--accent-ink` | `#15130F` | `#15130F` | text on flare |
| `--ok` | `#0E5A4E` | `#6FD3B8` | confirmed, ready, paid |
| `--warn` | `#8A4B00` | `#F2B45C` | estimate, due, missing |
| `--bad` | `#A81E1E` | `#FF8A80` | errors, expired |

Plates use ten fixed two-colour palettes (flare, lagoon, night, bone, cobalt, plum, ochre, sky, moss, rose) picked by
specialty, so a specialty keeps its colour across the app.

## Space and shape

- 4 px base; steps 4, 8, 12, 16, 24, 32, 48, 72, 112. Phone gutter 20, desktop gutter `clamp(32px, 5vw, 80px)`.
- Radius: 4 on plates (they are prints), 12 on fields and buttons, 999 only on the primary action and the tab bar.
- No shadows on content. One soft shadow under the floating tab bar and sheets.
- Structure comes from rules: a 1.5 px ink rule opens a section, hairlines separate rows. Boxes only where something is
  a physical object (a ticket, a receipt, a dialog).

## The plate (generated artwork)

`lib/art.js`, used by the app and by the server-rendered pages. Deterministic, no network, no images.

- **Terrain = the place.** Two relief hills seeded from the city (its coordinates when the listing has them), drawn as
  nested closed curves with stacked translucent fills. The same city always gets the same terrain.
- **Colour = the specialty.**
- **Numerals = the date.** Day and month in display type; the city's coordinates and country code as small print.
- **Line style = the evidence.** Solid and stamped: confirmed with source stored. Solid, no stamp: confirmed earlier,
  being re-checked. Dashed with an outlined month and "est.": estimated.
- **Courses** get a dial instead of terrain (concentric arcs, a tick ring) with the course's short name, because a
  certificate is about time, not place.

Every plate is decorative (`aria-hidden`); the same facts are always in text next to it.

## Motion

1. Motion explains where things came from; it never delays reading. Nothing a person waits for runs over 500 ms, and text in the page never fades (so contrast is always full).
2. **Route changes** use the View Transitions API (the old page's snapshot fades for 120 ms while the new one rises
   12 px over 220 ms) where supported; elsewhere the page simply swaps. The top bar and tab bar hold still.
3. **Reveals**: blocks below the fold rise 26 px (transform only) the first time they enter the viewport;
   IntersectionObserver, once each. What is on screen at render never moves. The hero's plates wipe up (clip-path).
4. **Numbers roll up** once (days to go, CPD hours, counts) with tabular numerals; final values are in the DOM from the
   start for assistive tech.
5. **The hero**: three live plates fan out from a stack and follow the pointer by a few degrees; the "what's on" strip
   scrolls like a departures board and pauses on hover, focus or touch.
6. **Sheets** rise with a spring-like curve, can be dragged down to dismiss on phones, and the filter sheet does the same.
7. Buttons press (scale .97); the primary button is lightly magnetic on fine pointers.
8. `prefers-reduced-motion: reduce` turns all of it off: no transitions, no marquee, no roll-ups, no parallax.

## Navigation

Five destinations: **Home, Discover, Trips, Wallet, You**. Wallet holds receipts, claims, CPD and certificates behind
one tab with a ruled sub-navigation. Courses live under Discover (Conferences / Courses). Hospital pages open from You
(and from the desktop bar for the roles that use them). Phones get a floating tab bar; desktops get a top bar and a wide
editorial grid, not a stretched phone.

## Component inventory

| Component | Class | Where |
|---|---|---|
| Wordmark + mark | `.brand`, `.mark` | header, server pages, icons, share image |
| Top bar / tab bar | `.side`, `.nav` | shell |
| Plate | `.plate` (`.plate.mini`) | cards, rows, sheet hero, hero fan, server pages |
| Conference card | `.card` | Discover, shelves |
| Shelf (swipeable) | `.shelf` | Home |
| Ticker | `.ticker` | public Home |
| Status line (replaces most pills) | `.pill` / `.pill.g` / `.pill.w` / `.pill.b` | everywhere |
| Fact strip (ruled `dl`) | `.facts`, `.fact` | detail sheet, course page, server pages |
| Ledger list | `.list`, `.li` | paperwork |
| Group | `.panel` | paperwork: ruled group with a title, not a box |
| Ticket | `.ticket` | trips |
| Big figure | `.fig` | dashboard, wallet, CPD |
| CPD dial | `.dial` | Home, Wallet, CPD |
| Sub-navigation | `.seg`, `.subnav` | Discover/Courses, Wallet |
| Filter sheet | `.fsheet` | Discover, Courses (bottom sheet on phones, inline bar on desktop) |
| Sheet / dialog | `.overlay`, `.sheet`, `.sheet.center` | detail, forms |
| Sticky action bar | `.actbar` | detail sheet, session sheet |
| Buttons | `.btn`, `.primary`, `.ghost`, `.sm`, `.lg`, `.icon-btn` | everywhere |
| Fields | `.field`, `.search`, `.two` | forms |
| Empty state | `.empty` | one sentence, one action, a quill tick |
| Toast, banner | `.toast`, `.net-banner` | feedback |
| Document | `.doc`, `.site-head`, `.site-foot` | about, privacy, terms, 404, listing pages |

## Make a trip of it (November 2026)

The conference comes first; Hoggy then shows what is on around it and packages the trip. Logic in `lib/trip.js`
(shared by the app, `/conferences/<id>` and `tests/trip.test.js`); matching in `lib/experiences.js`; data in
`data/experiences/experiences.json` (fetched after first paint, about 290 KB).

| Piece | Class | Where |
|---|---|---|
| "Make a trip of it" section: day chips (Conference only, +1, +2, +3), up to 4 items then "See all", category icon, dates, one line, source host, Add | `.mtrip`, `.xp` | conference sheet, course session sheet, `/conferences/<id>` (chips are `?days=` links) |
| Stated session pattern with the organiser's quote | `.sched`, `.card-sched` | sheet (under the pills), cards |
| Organiser type ("Commercial provider" in warn), resort tags, accreditation quote with "Check with your college" | `orgPill`, `destTags` | sheet, cards, server page |
| Interest chips (Ski & snow, Food & wine, Festivals, Sport, Nature & wildlife, Beach, Family) | `.do-chips` | Home hero, Home shelf, Discover (`#/discover?do=food`) |
| Card line "+ Barossa Vintage Festival" | `.card-trip` | trip shelf, Discover by interest |
| Trip builder: days before/after, day plan (Work, Personal, Travel), pinned items with official page and a day picker, ideas | `.tplan`, `.days`, `.pin`, `.ideas` | Trips |
| Costs split, the rule used, fare override, disclaimer | `.tcost`, `table.split` | Trips |

Split rules (general information; the UI says employer and tax rules vary): registration is work; a night is a conference
night when the next day is a conference day (or it follows the last one and the next day is travel); fares count as work
when work days outnumber personal days (travel days left out), otherwise they are apportioned work/(work + personal);
meals, transport and other follow the day spent; a personal portion typed on a receipt wins. The user can set fares to all
work, apportion or all personal. The claim pack, CSV, email and Mark submitted carry only the work portion and list the
personal days as excluded. `suggestTrips({ specialty, months, interests, cpdNeeds })` is the entry point for a future chat:
conferences are filtered first, and an experience never lifts one that fails the CPD need.

## Data honesty rules kept

Confirmed / confirmed earlier / estimated wording is unchanged; estimates still read "Usually June 2027"; CPD, price and
attendance still show only with a source and otherwise say "check organiser" or "check provider"; commercial providers
and certifying bodies are still labelled; counts on Home are computed from the lists at render time.

## Checks

- axe-core: `tests/e2e/a11y.js` runs every route and the main dialogs at 390x844 and 1280x900 in light and dark and
  fails on any serious or critical violation. Every text pair above is AA by that run.
- Tap targets are 44 px or more (small buttons grow to 44 px on coarse pointers); focus is a 2.5 px accent ring.
- Layout shift: the fonts are preloaded with `font-display: swap`, plates are inline SVG with a fixed aspect ratio and
  motion is transform-only, so measured CLS is 0 on Home, Discover, Courses and the server pages.
