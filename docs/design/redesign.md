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

25 November 2026, after a reference study against Airbnb, Spotify and Apple: UI text uses the **system stack**
(`-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`), so phones
get San Francisco or Roboto with no download. **IBM Plex Sans Condensed Bold** (OFL, one woff2, preloaded) is kept only for
poster numerals, coordinates and the wordmark. The Plex Sans text files stay in `fonts/` for the share-image tool but are
no longer served or preloaded.

Whole pixels only (no rem or clamp maths; `tests/home.test.js` checks), as tokens in `styles.css`:

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `--t-caption` | 12/16 | 500 | badges, small labels |
| `--t-meta` | 13/18 | 400 (600 bold) | meta lines, status labels, "Show all" |
| `--t-body` | 15/22 | 400 (600 bold) | body |
| `--t-card` | 15/20 | 600 | card titles (two lines at most) |
| `--t-body-lg` | 17/24 | 400 / 600 | inputs (no iOS zoom), sub-titles, the phone bar title |
| `--t-title` | 22/26 | 600, -0.3 | section titles |
| `--t-large` | 34/41 | 700, -0.4 | phone large titles, figures |
| `--t-display` | 48/52 | 700, -0.8 | desktop page titles |

The detail title is 26/30 600 on phones. Weights: 400 and 600 for text, 700 for large titles and figures only.

## Colour tokens

| Token | Light ("paper") | Dark ("night") | Use |
|---|---|---|---|
| `--bg` | `#F4EFE6` | `#12110E` | canvas |
| `--bg-2` | `#FBF8F2` | `#1A1814` | sheets |
| `--card` | `#FFFDF9` | `#1F1D18` | the search pill, cards that hold controls |
| `--card-2` | `#EAE3D5` | `#2A2721` | secondary buttons, segmented tracks |
| `--text` | `#15130F` | `#F3EEE4` | ink, dates |
| `--muted` | `#6B645A` | `#ABA396` | meta, status labels |
| `--line` | `#E6DFD2` | `#2E2B25` | the only divider (1 px) |
| `--line-2` | `#8A8172` | `#7D7566` | field borders (3:1) |
| `--flare` | `#FF4D1F` | `#FF5B2E` | **the one accent**: primary action, active tab icon, selected chip |
| `--accent` | `#B8300A` | `#FF8A66` | focus ring |
| `--ok` | `#0E5A4E` | `#6FD3B8` | the confirmed dot, switches on |
| `--warn` | `#8A4B00` | `#F2B45C` | the estimate ring (dashed) |
| `--inv` | `#15130F` | `#F3EEE4` | "Show N results", toasts |

Status is a dot and a grey 13 px label: confirmed is a solid 8 px `--ok` dot, estimate a dashed amber ring, re-checking a
hollow ring. No red kicker rules, no red half-headlines, no 1.5 px ink rules: sections are separated by 32 to 40 px of space
or one 1 px `--line`.

## Space and shape

- 4 px base. Phone gutter 20, desktop 40 (80 from 1280). 48 px above a desktop page title; 40 px between shelves.
- Radius: 16 on posters and cards, 12 on shelf posters, buttons and fields, 24 on sheets, 999 on the search pill and chips.
- Shadows: the search pill (`0 1px 2px / 0 4px 12px`, 6%), the desktop booking card (`0 6px 16px`, 12%), sheets.

## Patterns from the references

- **Airbnb**: the 56 px search pill ("Where to?" over "Any month · Any specialty", a 40 px filter circle) opens a Where /
  When / Specialty sheet; an interest row of in-house line glyphs (All, Ski & snow, Food & wine, Festivals, Sport, Nature &
  wildlife, Beach, Family); the filter sheet (region segmented control, 12 month chips, CPD and school-holiday switches,
  a searchable specialty list, Country / School holidays / Dates / Sort, sticky "Clear all" and dark "Show N results");
  full-width 4:3 posters with a white heart on phones, four columns on desktop; the conference page (poster header with round
  back / share / save buttons, an overlapping sheet, When / Where / CPD / Make a trip of it, a sticky bar with the dates and
  trip window and Plan trip; on desktop a 1+4 poster mosaic, two columns and a sticky booking card).
- **Spotify**: Home is shelves (Coming up, Make a trip of it: Food & wine, Near school holidays, Courses due or nearby,
  Saved), 160 px cards on 4:5 posters; "Browse by specialty" tiles on Discover, one colour per specialty with a small
  poster tilted off the corner.
- **Apple**: large titles (34/41 phone, 48/52 desktop) that hand over to a 44 px translucent bar with the title centred
  once scrolled; a flat 49 px tab bar with a hairline, 24 px icons and 10 px labels.

## The plate (generated artwork)

`lib/art.js`, used by the app and by the server-rendered pages. Deterministic, no network, no images.

- **Terrain = the place.** Two relief hills seeded from the city (its coordinates when the listing has them), drawn as
  nested closed curves with stacked translucent fills. The same city always gets the same terrain.
- **Colour = the specialty**: twelve hues (flare, lagoon, cobalt, plum, ochre, sky, moss, rose, violet, teal, berry, night).
- **Texture = the city**: contours, coastline, graticule or ripples, seeded from the city, so lists vary and one city's posters match.
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

Five destinations: **Home, Discover, Trips, Wallet, You**. The Preview line (data resets on the demo host) sits under You. Wallet holds receipts, claims, CPD and certificates behind
one tab with a ruled sub-navigation. Courses live under Discover (Conferences / Courses). Hospital pages open from You
(and from the desktop bar for the roles that use them). Phones get a flat tab bar; desktops get a top bar and a four-column
grid, not a stretched phone.

## Component inventory

| Component | Class | Where |
|---|---|---|
| Wordmark + mark | `.brand`, `.mark` | header, server pages, icons, share image |
| Top bar / tab bar | `.side`, `.nav` | shell |
| Plate | `.plate` (`.plate.mini`) | cards, rows, sheet hero, hero fan, server pages |
| Conference card | `.card` | Discover, shelves |
| Shelf (swipeable) | `.shelf` | Home |
| Search pill, interest row, tiles | `.spill`, `.irow`, `.tile` | Discover, Home |
| Search sheet, filter sheet | `.ssheet`, `.fsheet.modal`, `.segc`, `.mchips`, `.switch`, `.slist`, `.sfoot` | Discover |
| Conference page frame | `.dt`, `.dt-bar`, `.dt-hero`, `.dt-body`, `.dt-book`, `.honest`, `.dt-sec` | conference and session sheets, `/conferences/<id>` |
| Status dot + grey label | `.pill` / `.pill.g` / `.pill.w` / `.pill.b` | everywhere |
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
- Layout shift: UI text is the system face; the poster face is preloaded with `font-display: swap`, plates are inline SVG with a fixed aspect ratio and
  motion is transform-only, so measured CLS is 0 on Home, Discover, Courses and the server pages.
