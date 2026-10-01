# Data-Law Compliance Memo — 2026-09-29

**From**: Overseer, acting as data-protection counsel per Joel's 2026-09-29 role expansion
**Trigger**: Apps expanding to overseas distribution
**Standard applied**: EU/UK GDPR + ePrivacy as the high-water mark. Meeting it substantially covers Canada (PIPEDA), Brazil (LGPD), and Australia. Every claim below was verified against current code on 2026-09-29; file:line cited.

---

## The one-paragraph opinion

The apps are in decent shape on data *minimization* (no ad tech, no data sales, modest PII: email, display name, photos, cooks/reviews, coarse location for weather/regions) and deletion now genuinely works. They are **not ready for EEA/UK distribution** on two grounds that are cheap to fix and routinely enforced: analytics runs without consent on every surface, and the privacy policies disclose none of what European law requires. **Recommendation: do not enable EEA/UK country availability until L-1 and L-3 below are closed.** Everything else can follow within a normal release cadence.

---

## L-1 — BLOCKER: Analytics collection without consent, every surface

**Web** — `public/gtm-init.js:49-51` sets Consent Mode defaults to `analytics_storage: 'granted'` before any user interaction. The comment at line 46 states the rationale: *"US-only audience, no ads — grant analytics, deny ad signals."* That premise is now false by decision. For EEA/UK visitors, analytics storage requires **prior opt-in** (ePrivacy Art. 5(3), GDPR-standard consent); "granted by default, no banner" is the fact pattern in a long line of CNIL/DSB enforcement.

**Native (all three apps)** — no `setConsent` or `setCollectionEnabled` call exists anywhere in `src/` (verified by grep). `@capacitor-firebase/analytics` therefore collects from first launch. Google's EU User Consent Policy independently requires consent signals for EEA end users.

**Fix (scoped to keep US behavior unchanged):**
- Web: region-conditional consent — default `denied` for EEA/UK (Consent Mode v2 `region` parameter or a geo-gated banner), keep current behavior for US. A minimal self-built banner is fine at this traffic level; no paid CMP needed.
- Native: on first launch, a one-time analytics consent screen for EEA/UK locales (or simpler: ship `setCollectionEnabled(false)` until consent for everyone — cleanest, tiny data cost).
- **Owners**: Website session (web); each app session (native). Route after Joel approves the approach.

**Adoption-state note (2026-09-29 late, per Notebook session — stated plainly so "unaffected by the half-state" is never read as "compliant"):** Board's local `track` (`App.board.jsx:69`) gates on nothing but `window.gtag` existing, and its static gtm tag guarantees it exists — Board collects with **no consent gate whatsoever** until its 2.4.6 adoption, which also costs more than Notebook's did (Board must gate its own `track`; the shared module never touches it). Standing rule extended: when a shared module gains a consent gate, the same-day sweep must cover **every analytics sender**, not just every importer of the gated module — non-importers look untouched while being equally non-compliant.

**DECIDED 2026-09-29 (delegated authority): consent-first for everyone — option (b).** Scorecard's checkpoint surfaced the fact that settled it: there are **two collectors on native** — gtag via the statically-loaded `gtm-init.js`, and the native Firebase Analytics SDK, which auto-fires `first_open` at process start, *before any JS gate could run*. So the reference implementation kills the native SDK via manifest/plist `collection_enabled=false` flags, loads gtag **only after** an equal-weight consent card answers "Allow", stores `{choice, timestamp, consentTextVersion}` for Art. 7(1) demonstrability, bans the word "anonymous" from consent copy, provides a Settings withdrawal toggle, and funnels every collector through one `src/consent.js` choke point. Crashlytics stays on under legitimate interest, disclosed with an objection route in L-3. Locale-based jurisdiction targeting (option a) was rejected because device locale is not residence — misclassification is the exact failure consent-first eliminates. Known tradeoff, logged for the Wednesday briefing: US analytics drops to the opt-in rate at cutover; that is a measurement change, not a usage collapse.

## L-2 — HIGH: Any signed-in user can enumerate every user's email

`firestore.rules:98-99`: `match /users/{userId} { allow read: if isSignedIn(); }` — the whole collection is listable and profile docs still carry `email`. One throwaway account harvests the entire userbase's emails. Under GDPR this is an Art. 32 failure (appropriate security), and if exploited it is a notifiable personal-data breach (Art. 33, 72-hour clock). This was flagged in the July audit as an accepted tradeoff; overseas distribution changes the calculus.

**Fix**: the profile split recommended in July — owner-only doc (email + private fields), public subdoc (displayName/photoURL/friendCode) for friend discovery. Shared rules + client reads across Scorecard/Notebook: **Overseer specs it, app sessions adjust reads, coordinated rules deploy.**

## L-3 — BLOCKER (paired with L-1): Privacy policies disclose nothing GDPR requires

`public/privacy.html`, `privacy-notebook.html`, `privacy-board.html`: grep for GDPR elements returns **zero hits** in all three — no legal basis, no retention periods, no international-transfer disclosure, no user-rights enumeration (access/erasure/portability/objection), no supervisory-authority mention. Firebase processes data in the US, so an Art. 13 notice must disclose the transfer and its mechanism (Google LLC is certified under the EU-US Data Privacy Framework — the disclosure is straightforward, it just has to exist).

**Fix**: I draft the three policy revisions (counsel work product); Website session publishes. One template, three app-specific variants. Include: controller identity (Holy Smokes BBQ Co / Joel), data categories, purposes + legal bases (contract for accounts/sync; consent for analytics; legitimate interest for crash logs), retention, transfer + DPF disclosure, rights + how to exercise (datadelete@ + in-app), complaint right.

## L-4 — MEDIUM: Erasure pipeline is manual but its promises are now true

Verified fixed: `deleteCloudReview` + `deleteReviewPhotos` + tombstones wired (`src/context/AppContext.jsx:114, 1028-1029`) — individual deletion now actually erases server-side, closing July's S-2, which had made the deletion pages' claims false. Account deletion remains a manual email process (`datadelete@`, 7-day promise). GDPR allows a month; 7 days is fine **if honored** — the legal risk is operational (a missed email = broken promise in writing). Recommendation: lightweight — a logged checklist per request; longer-term, in-app account deletion (Play already nudges this direction).

## L-5 — MEDIUM: Store declarations must match reality in every territory

Standing memory: Notebook and Board likely still carry the Data Safety analytics gap (Scorecard's fixed 2026-07-20). Inaccurate Play Data Safety / Apple privacy labels are enforceable listing violations everywhere and consumer-law exposure in the EU. Ties to F-10's missing `PrivacyInfo.xcprivacy`. **Owners**: each app session verifies its console declarations before any new-territory rollout; Overseer drives the console review (browser).

**Scorecard verified 2026-09-29 — two under-declarations found and ordered fixed same day:** (1) **Photos** not declared, though review-photo upload code runs on every signed-in save (Spark's Storage revocation makes it fail, not cease to exist — it resumes the moment Blaze returns, with no app update in between); (2) **Approximate location** not declared, though BBQ Near Me reads geolocation and sends lat/lng to overpass-api.de — this also settles the long-open "location tick unverified" question: it must be ticked. Ruling on sequencing: the two truth-fixes go in **today**; the analytics required→optional flip waits for the consent release, because the form must describe the app as it is, in both directions. Position adopted on location "sharing": Play's user-initiated-action carve-out applies (tapping BBQ Near Me is an expected lookup), **but** the L-3 policy must still name the Overpass/OSM lookup — the Play carve-out does not erase the GDPR Art. 13 disclosure duty. Notebook's parity check is in their queue; Board's follows their release work.

**Apple-vs-Play declaration doctrine (2026-09-30, Scorecard, endorsed):** (1) The Overpass lookup is declared on Play (Approximate location, ephemeral) but deliberately NOT on Apple — Apple's "collect" excludes data processed in real time solely to service the request and not retained, so the same egress is "collected" on Play and "not collected" on Apple. Platform definitions differ; declarations follow each platform's definition, not each other. (2) Apple's User ID purpose stays "Analytics + App Functionality" until iOS 4.3.0 is actually live, because live 4.2.0 still sends GA User-ID — the declaration describes the shipped build, both directions, always. Release-day bundle (Apple purpose fix + Play optional-flip + privacy.html publish) fires when BOTH platforms are live.

**Deletion-URL sweep (2026-09-30):** Scorecard found BOTH Play form URL fields miswired to privacy.html — "Delete account URL" *and* "Delete data URL" — and fixed both to /delete-account.html (published Sep 30, bundled with the Open 4.2.1 promotion so neither review restarted the other). Checklist for Notebook and Board updated accordingly: check both fields, not one. Release-note wording precision also adopted from Scorecard: "No **usage analytics** is sent until you allow it," never "nothing" — Crashlytics reports under legitimate interest.

## L-6 — LOW: Board public price data + userId attribution

`board_prices` docs carry `userId` and are world-readable. A Firebase UID tied to submissions is personal data under GDPR (identifiability via combination). Exposure is low (opaque UID, no profile join for signed-out readers — profile reads require sign-in, see L-2). Post-L-2, consider whether public price reads need `userId` at all; serving it only to the owner/moderation path would moot the question. **Detail added 2026-09-29 (Board session):** user-added shop doc IDs also embed the first 8 chars of the submitter's uid (`user_<slug>_<uid8>`, `App.board.jsx` ~1896) — strictly less revealing than the world-readable `userId` field itself, but public. Anonymous→Google sign-in verified non-linking (no `link*` calls; sign-in replaces the uid, prior anonymous submissions stay unconnected). Policy wording tightened in rev 5 to "stored with an account identifier" — the word "internally" claimed privacy the read-open data model doesn't deliver.

---

## Sequencing for the overseas rollout

| Gate | Item | Owner | Status |
|---|---|---|---|
| **Before enabling any EEA/UK availability** | L-1 consent (web + native) | Website + 3 app sessions | **Web LIVE 2026-09-29** (EEA/UK/CH denied-by-default, banner, versioned record; one open low-residual item: EEA-IP spot check of Google's region default). **Scorecard native built** (rides 4.3.0); Notebook/Board adoptions sequenced |
| **Before enabling any EEA/UK availability** | L-3 policies | Overseer drafts → Website publishes | **Drafts committed** (docs/legal/); publish waits ONLY on Joel's two bracketed decisions |
| First release after | L-2 profile split | Overseer spec → sessions | not started |
| First release after | L-5 declarations re-check | app sessions + Overseer console pass | partially (Scorecard done) |
| Normal cadence | L-4 deletion ops, L-6 userId | Overseer / Board | L-4 promises now true |

## L-7 — Auth posture review (2026-09-30/10-01, on Joel's five questions)

Reviewed with code evidence: **(1) Session tokens** — Firebase model, client-side only (browserLocalPersistence on native WebView by deliberate iOS fix; native-plugin refresh tokens in app-private storage/Keychain); `allowBackup=false` all three apps; residual risk is WebView XSS, held at zero by the audit regime. Acceptable. **(2) Admin checks** — no admin concept exists anywhere (rules or client); moderation is Google-IAM-gated console access. Doctrine: any future in-app moderation uses custom claims checked in rules, never client flags. **(3) MFA** — deferred by decision: social sign-ins inherit Google/Apple MFA; TOTP needs Identity Platform; SMS impossible (billing closed). Revisit if accounts ever guard payments. **(4) Login rate limiting** — present, server-side (Firebase throttling; `auth/too-many-requests` handled in UI). **(5) Password strength — the gap, now fixed client-side** (Scorecard `a8e2445` + `c2c139b`, rides next release; Website/Notebook mirror): sign-up ≥8 + case-insensitive common-password BLOCK per NIST 800-63B (curated floor, documented as NOT a breach check), dependency-free meter, sign-in gate untouched so existing 6-7 char accounts aren't locked out; 149/149 tests, browser-verified. **Pending, console (needs Joel's one-time Google sign-in in the pane):** server password policy min-8 Require ×3 projects (governs resets — the only reset flow is Firebase's hosted page), email-enumeration protection ×3, GA4 retention read ×4 properties.

**When real counsel is warranted** (flagging now so it's never a surprise): any regulator correspondence, a data-breach event, or if a future feature adds payments/health/children's data. Nothing in today's scope requires it.
