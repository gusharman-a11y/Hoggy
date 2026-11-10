# Hoggy: Conference review sources and review-system design

Research date: 2026-11-06. Method: web search plus a few page fetches. Legend: **[V]** = verified against a fetched official page this session; **[S]** = secondary source only; **[U]** = unverified (background knowledge or not confirmable). Not legal advice; get counsel to confirm ToS before launch. Signal quality is 1 (weak) to 5 (strong).

## 0. Bottom line

1. No external platform gives a clean, republishable, trustworthy conference-review dataset. Most review content is ToS-restricted, thin, or biased.
2. The strongest signals are objective (accreditation, track record, faculty, journal links) plus Hoggy's own verified-attendee reviews.
3. Use external ratings only as labelled links or short attributed counts via official APIs. Never scrape and republish review text.

## 1. (a) Public review platforms and communities

| Source | URL | Access | Legality / ToS verdict | Signal | Fabrication / bias risks |
|---|---|---|---|---|---|
| Google Maps / Places reviews (venue or event listing) | https://developers.google.com/maps/documentation/places/web-service/policies | Places API (New), API key, billed per SKU | **Allowed via API only.** [V] Must show author attribution, Google Maps logo/text, `googleMapsUri` link-back, sort/filter notice, translation notice. Place ID may be stored indefinitely; other content is subject to Maps Service Terms caching limits. Review count per response is small (commonly 5) [S]. Scraping Maps: prohibited [U]. | 2 for conferences (3 for venue) | Reviews rate the venue, not the programme. Google does not verify reviews, only removes fake content when found [V]. Competitor and incentive bias. Many conferences have no listing. |
| Trustpilot | https://developers.trustpilot.com | Business API needs a business account/subscription [S] | Conference organisers rarely listed. Third-party guides say display on other platforms and export for display elsewhere are restricted [S]. Scraping prohibited by terms [S]. **Link only.** | 1 | Paid-invitation selection bias, organiser-invited happy customers, fake review markets [U]. |
| 10Times | https://10times.com | No public API found [U] | No documented reuse licence [U]. Scraping likely breaches ToS [U]. Link out; a data partnership is the legitimate route. | 2 | Lead-gen marketplace, organiser-paid listings, meaning of "verified" unclear [U]. |
| Eventbrite | https://www.eventbrite.com/platform/api | Official API, OAuth | Allowed within API Terms (updated 30 May 2025); access can be terminated at any time [S]. Medical congresses rarely sell there. Review data in API not confirmed [U]. | 1 | Mostly small or social events. |
| TripAdvisor (venues, hotels) | https://developer-tripadvisor.com/content-api/ | Content API needs approval [S, vendor page] | Only under TripAdvisor developer terms (attribution, storage limits) [U]. Venue/hotel use only. | 2 (venue only) | Venue-centric; fake-review pressure in hospitality [U]. |
| Reddit (r/medicine, r/Residency, r/doctorsUK, r/medicalschool) | https://www.reddit.com/dev/api | Data API, OAuth. Reddit help page returned 403, terms not read [U] | Commercial use needs paid approval. Reddit staff stated $0.24 per 1,000 calls in May 2023 [S]; one 2026 blog claims a $12,000/yr minimum [S, unconfirmed]. Free tier non-commercial; approval can take weeks [S]. Scraping/republishing posts: not permitted [U]. | 3 for candid opinion, low volume | Anonymous, brigading, astroturfing by organisers/sponsors, bias toward complainers. Posters not verified clinicians. |
| Student Doctor Network | https://forums.studentdoctor.net | No API [U] | Terms not located [U]. Link only; do not copy posts. | 2 | Trainee-heavy, US-centric, anonymous. |
| Doximity | https://www.doximity.com | No public community API [U] | Consumer ToS scraping clause unconfirmed [S]; client-portal terms prohibit deriving insights for third-party platforms [S]. Treat as off limits. | 3 (members only) | Closed verified-physician network (strength) but cannot be ingested. |
| Sermo | https://www.sermo.com/terms-of-service/ | Members only; paid client terms | Limited-use licence, restrictions on commercial use of materials [S]; scraping clause unconfirmed [U]. Off limits except via commercial partnership. | 3 | Pharma-funded model; closed. |
| KevinMD | https://www.kevinmd.com | Public blog, no API | Articles copyrighted; link or summarise only. | 1 | Opinion pieces, not reviews. |
| X / LinkedIn hashtags (#ESC2026 etc.) | https://developer.x.com ; https://learn.microsoft.com/linkedin | X API paid [U]; LinkedIn API restricted to approved partners [U] | LinkedIn scraping prohibited [U]. X API only if budgeted; otherwise deep-link to hashtag search. | 2 | Promotional chatter, organiser/speaker self-posting, bots. |

## 2. (b) Post-event surveys and organiser-published satisfaction data

- **Where:** organiser post-congress reports, annual reports, exhibitor prospectuses ("92% would return"), CME outcome reports to accreditors. Specific figures per event: [U].
- **Access:** manual or LLM-assisted extraction from public PDFs; cite and link, do not reproduce charts. Facts (a number) are generally not copyrightable but the document is [U, confirm with counsel].
- **Verdict:** legal to cite with attribution. Signal 3.
- **Risks:** self-reported, survivorship and marketing bias, no sample size or method, definitions vary. Label "Organiser-reported"; never merge with Hoggy-verified scores.
- **Opportunity:** offer organisers a standard Hoggy survey and attendee-code flow in return for a "Verified organiser data" badge and analytics dashboard.

## 3. (c) Objective quality signals (highest value, lowest legal risk)

| Signal | Where | Access | Signal | Notes |
|---|---|---|---|---|
| CME/CPD accreditation (ACCME / AMA PRA Cat 1; UEMS-EACCME ECMECs; UK and other college CPD) | https://www.accme.org ; https://eaccme.uems.eu ; https://www.ama-assn.org/education/uemseaccme-cme-credit-recognition | Public pages; bulk API not confirmed [U] | 5 | Binary, checkable. AMA page showed the AMA-UEMS agreement through 31 Jul 2022; renewal unverified [S/U]. Capture credit count and validity per event. |
| Years running / edition number | Organiser site, Wikidata | Open | 4 | Survival proxy. |
| Parent society size and standing | Society annual report; Charity Commission / IRS 990 | Public filings | 4 | Large specialty societies are inherently higher-trust. |
| Abstracts submitted/accepted; proceedings in indexed journal supplement | PubMed (NCBI E-utilities), Crossref | Free official APIs | 4 | Journal-linked is strong. Check journal legitimacy (DOAJ, Scopus) [U]. |
| Faculty quality | Faculty list vs PubMed/ORCID | ORCID public API, PubMed | 3 | Show "faculty with publications" counts, not rankings. |
| Attendance trend | Organiser reports; audited figures (UFI) | Mixed | 3 | Self-reported unless audited [U]. |
| Hybrid / on-demand availability | Organiser site | Polite crawl of organiser pages (robots.txt) | 2 | Filter, not a quality score. |
| Predatory-conference flags | https://thinkcheckattend.org | Open checklist | 4 (negative filter) | A red-flag check, not a rating. |
| Sponsorship / COI transparency | Organiser disclosure; industry payment registers [U] | Public | 3 | Flag industry-funded programmes. |

## 4. (d) Official APIs: ToS and cost

| API | ToS gist | Cost | Cannot do |
|---|---|---|---|
| Google Places API (New) | Attribution, logo, link-back, sort notice required [V]. Only place ID exempt from caching [V]; other content per Maps Service Terms (version dated 2026-06-10 exists [S]); a vendor blog claims ratings cannot be stored [S, unverified]. Treat as **live-fetch, no permanent store**. | Pay per SKU with a monthly allowance; **current rates unverified [U]**. Set quotas/budget alerts. | Scrape Maps; store or republish reviews; strip attribution; blend into your own average. |
| Reddit Data API | Commercial use needs paid agreement and approval [S] | $0.24 per 1,000 calls (2023) [S]; $12k/yr minimum claim [S, unconfirmed] | Republish posts; scrape around the API [U]. |
| Trustpilot APIs | Subscription-tied; brand guidelines restrict widgets/display [S] | Not public [U] | Show others' reviews as your own; scrape. |
| Eventbrite API | Official API Terms, terminable [S] | Free [U] | Use outside terms. |
| TripAdvisor Content API | Approval and display rules [S, vendor] | Per-call after free tier [U] | Store beyond limits; alter ratings. |
| NCBI E-utilities / Crossref / ORCID | Open, rate-limited, polite use | Free | n/a (best value) |
| X API | Paid tiers; reuse limits | Paid [U] | Bulk republish. |

**Working rule on what cannot be scraped or republished:** review text and star averages from Google, Trustpilot, TripAdvisor, 10Times, LinkedIn, Doximity, Sermo, SDN, and Reddit (outside licensed API). Facts like accreditation status and dates may be cited with source links. Consider database rights and GDPR (reviewer names are personal data) [U].

## 5. Recommended review system for Hoggy

### 5.1 Principle
Hoggy-owned verified-attendee reviews are the core product. External ratings are context, shown as labelled links.

### 5.2 Verified-attendee reviews
- **Proof of attendance (any one):** (1) registration receipt upload (parsed, hashed, then deleted; keep only event ID and proof type); (2) CPD/CME certificate or credit ID; (3) organiser-issued unique attendee code (strongest, via partnership); (4) check-in/badge-scan integration.
- **Professional identity:** verify registration (GMC/NMC/AHPRA/NPI) or institutional email, without displaying it. Public display: role band, country, career stage (e.g. "Registrar, UK").
- **Window:** review open from event end to +60 days; one per person per edition.
- **Labels:** "Verified attendee" (scored), "Self-declared" (shown separately, not scored), "Organiser-reported" (separate panel), "Retrospective" (older events).

### 5.3 Structured ratings (1-5 each plus optional text)
1. Scientific content and faculty
2. Relevance and level for practice
3. Networking and peer access
4. Value for money (fee, travel, time away)
5. Venue and logistics (including accessibility)
6. CPD administration (credits issued correctly and promptly)
7. Independence from industry influence
8. Would attend again (yes/no)

Show each dimension separately. Show an overall score only when n >= 5 verified reviews, Bayesian-smoothed with a confidence band; otherwise "Not enough verified reviews yet".

### 5.4 Moderation
- Automated pre-screen: patient-identifiable content (reject), profanity and defamation heuristics, duplicate text.
- Human queue for flagged items, 72-hour target.
- Organiser right of reply (public, labelled). Organisers cannot edit, hide or pay to suppress.
- Published moderation policy, removal reasons and dispute process; legal takedown route per jurisdiction [U].

### 5.5 Anti-spam and anti-fabrication
- Proof of attendance required for scoring (the main control).
- One account per verified professional identity; rate limits; device/IP clustering; account-age weighting.
- Conflict-of-interest declaration (speaker, organiser, exhibitor, sponsored delegate, competitor); block organiser and sponsor email domains; COI reviews shown separately and excluded from score.
- Burst and outlier detection (many 5-star reviews in a short window, near-identical phrasing) with temporary hold.
- Incentives, if any, reward submitting a review not a positive one, and are disclosed.
- Periodic audit of samples against organiser attendee lists where partnered.

### 5.6 Seeding strategy
1. Launch with objective-signal profiles for every conference (Section 3), so pages are useful before any review exists.
2. Partner with 3-5 mid-size societies who send the Hoggy post-event survey to real attendees (verified codes), in return for an organiser analytics dashboard.
3. Recruit a founding panel of 50-100 verified clinicians to review events they attended in the last 12 months, labelled retrospective.
4. Prompt at the right moment: email 3 days after event end; CPD-log integration.
5. Never copy reviews from other sites, create fake seed reviews, or pay for positive reviews.

### 5.7 Ethical ingest of external ratings
- "Elsewhere on the web" card: source name, rating and count only when obtained through an official API under its display rules, with attribution and link-back (Google: logo/text, author credit, `googleMapsUri`, sort notice [V]).
- Otherwise only a search link ("Discussed on Reddit / SDN") with no content copied.
- Never blend external stars into Hoggy's score. Never store review text; store IDs only (Google Place ID is permitted [V]) and fetch live.
- Label: "External, not verified by Hoggy".
- Summaries of external discussion only from licensed or permitted data; default to link-only [U].
- Maintain a source register with ToS review date and owner; re-check quarterly.

### 5.8 Privacy and compliance
Lawful basis under GDPR/UK GDPR for reviewer data; minimise and delete proof documents after verification; no patient information; accessible forms; check fake-review rules in target markets (e.g. UK DMCC Act, US FTC rule) and defamation takedown duties [U, confirm with counsel].

## 6. To verify before build
- Google Places current SKU pricing and the exact review-caching clause in Maps Service Terms.
- Reddit commercial terms, minimum spend and approval timeline (help page returned 403).
- Trustpilot developer and brand terms on third-party display.
- Doximity, Sermo, SDN and 10Times full ToS on automated access.
- Whether ACCME/EACCME offer bulk data; AMA-UEMS agreement renewal status.
- Legal review of fake-review and defamation rules in target markets.

## Sources consulted
- Google Places policies: https://developers.google.com/maps/documentation/places/web-service/policies
- Google Maps service terms archive: https://cloud.google.com/archive/maps-platform/terms/maps-service-terms-20260610
- Reddit pricing commentary: https://octolens.com/blog/reddit-api-pricing ; https://www.xpoz.ai/blog/guides/reddit-api-pricing-tiers-and-alternatives/
- Trustpilot API commentary: https://dataimpulse.com/blog/trustpilot-api/ ; https://rollout.com/integration-guides/trustpilot/api-essentials
- AMA/UEMS: https://www.ama-assn.org/education/uemseaccme-cme-credit-recognition ; https://eaccme.uems.eu/international-collaborations
- Doximity ToS: https://www.doximity.com/terms-of-service ; Sermo ToS: https://www.sermo.com/terms-of-service/
- Eventbrite API terms: https://www.eventbrite.com/support/articleredirect?anum=8483
