# DESIGN.md: Holy Smokes BBQ Co website

Status: values extracted from the live site on 2026-10-01 (audit-001) and
checked against Holy Smokes Marketing's brand inputs the same day
(`marketing/holy-smokes-bbq-voice-profile.md`, `marketing/brand-type-system.md`,
`marketing/brand-template-spec.md`). Two decisions are Joel's and are marked
PENDING below: whether the site switches to the brand typeface, and whether
the web palette moves to the logo colors.

## 1. Visual Theme & Atmosphere
A smokehouse sign at night: near-black, cream lettering, one burnt-orange
glow. The site is a landing page for four free BBQ apps and the family
behind them. Readers are home pitmasters and people hunting a BBQ joint,
most arriving on a phone from a store listing or a search. It should feel
like a hand-painted menu board, not a startup: confident, plain-spoken,
specific. Joel's own bio opens the page in first person; the product copy is
plain third person in his register, not marketing voice. No fire clichés
beyond the logo's own flames, no stock photos or BBQ clip art, no claims the
code can't back.

Voice (Marketing's profile): Joel talking, first person singular, "I" never
"we here at Holy Smokes". Kansas City is the heritage; he lives in Waukesha,
WI. Short declaratives, plain verbs, contractions mixed with full forms,
specs over adjectives, no hype, no trophy or pro claims, no em dashes, no
"it's not X, it's Y". Sign-off "Faith, family, and fire." The slogan is
styled FAITH, FAMILY & FIRE as a mark. Facts that must hold: THREE apps
(Scorecard, Notebook, Board) plus the Calculator, which is a website tool,
never "four apps"; the sauce is not for sale and nothing may imply it is;
never call the smoker an offset; Peyton's name and face never appear; no
exterior shots of the house. Anything drafted in Joel's name runs humanize,
then joel, then antislop.

Dial: ENERGY 2 / RHYTHM 2 / MOTION 1
Impeccable mode: Persuade (homepage), Read (SEO and legal pages)

## 2. Color Palette & Roles
PENDING (Joel): the live hexes below appear in no brand document. Marketing's
canon, sampled from the logo: charcoal `#444947`, orange `#D06129`, gold
`#F3CF6D`, outline `#090806`; print/card palette: cream `#E6D8B8`, ink
`#33211A`, stamp red `#B5432E`, gold `#E8C23A`; recent video end cards:
near-black `#1b1714` with gold, cream, orange. A logo-aligned web palette
would be background `#1b1714`, text `#E6D8B8` (12.6:1), orange `#D06129` for
headings and links (4.6:1, fine for 18px+ display, too low for 14px body
text), and gold `#F3CF6D` with ink text for Launch buttons (10.2:1). The logo
orange cannot be a button fill: no text color reaches AA on it (best 4.6:1
with near-black). Until Joel chooses, the live values stand:

Core: background `#1a1a1a`, surface `#2a2015` (warm umber panels), text
`#f5e6d3` (cream). Accent: `#d4782f` burnt orange (headings, links, hover).
Muted text `#ccc` on dark, `#888`/`#999` only for footer-grade text.
Hairlines `#333` on background, `#2a2015` between sections.

Per-app colors exist and are the written reason the palette exceeds 2+1:
Scorecard `#d4782f`, Notebook `#4a6741`, Board `#a85f52`, Calculator
`#d4a64a`. Rule: an app's color appears on its own card border, heading and
Launch button, and nowhere else on the page. Brass `#d4a64a` is Board's
secondary inside the Board app and Calculator's color on this page; it is
not a general accent here.

Contrast pairs that must stay AA: cream on background 14.2:1; `#ccc` on
surface 9.9:1; `#1a1a1a` on orange 5.4:1 (so Launch Scorecard uses dark text,
never white); white on Notebook green 6.4:1; white on Board brick 4.75:1 (do
not darken the brick); `#1a1a1a` on Calculator brass 7.8:1; footer `#888` on
background 4.9:1 at 13px minimum.

## 3. Typography Rules
PENDING (Joel): the locked brand face (2026-09-25, `marketing/brand-type-system.md`)
is Thornwood VF (Swell Type, Adobe Fonts): titles XTall UltraBold (wdth 50
wght 900), eyebrow and footer caps Regular-width Medium (wdth 100 wght 500),
body Tall Regular (wdth 75 wght 400), numbers Tall UltraBold; the logo
lettering matches Tall Bold. It is NOT licensed for web embedding through
the desktop sync route: web use needs an Adobe Fonts web project, or display
headings rendered as images. The role TTFs in `marketing/fonts/` must not be
uploaded to the site. Until Joel decides, the site keeps its inherited pair:

Oswald 700 for display: a condensed grotesk is the closest licensed stand-in
for Thornwood's tall, heavy lettering, and caps with 1px tracking read as a
stencil on a smoker. Used on h1, h2, card headings and buttons only. Inter
400/700 for everything else: it stays out of the way of the copy, which is
where the voice lives. Both self-hosted, Latin subset, `font-display: swap`.
If Thornwood arrives, it replaces Oswald role for role (XTall UltraBold for
h1/h2, Tall Regular for body) and this section is rewritten.

Scale: h1 `clamp(40px, 6vw, 64px)` line-height 1.05; card lead h2 26px;
card h2 22px; section h2 24px; h3 18px; body 16px line-height 1.65; story
17px line-height 1.7 at max 68ch; card copy 15px; FAQ answers 16px; footer
13px. Headings `text-wrap: balance`. Sentence case everywhere except the
Oswald display elements; the slogan "Faith, Family & Fire" keeps its title
case because it is a name.

## 4. Component Stylings
Buttons: Oswald 700 14px, 12px 24px padding, 8px radius, app color fill,
hover shifts the fill (lighter for the orange so dark text keeps AA, darker
for the rest), `:active` translateY(1px), `:focus-visible` 2px cream outline
offset 2px, transitions 150ms on background and transform only.
Store buttons: black `.play-mini`, 6px radius, 44px min height, real store
URLs; a non-link `.play-soon` variant with the same look, dimmed, for a
store the app is not on yet. Never a store button for a store the app is
not on.
Cards: surface fill, 2px border in the app color, 14px radius, flex column
so Launch buttons align across a row. Lead row (Scorecard, Board): 90px
logo, 26px heading, 32px padding. Second row (Notebook, Calculator): 72px
logo, 22px heading, 24px padding. The difference is the hierarchy: the two
apps on both stores and the newest app lead.
Social links: SVG mark + name, 44px tall, orange on hover.
Skip link: visually hidden until focused, then a cream pill at top left.

## 5. Layout Principles
Single column, max-width 980px, 20px side gutters. Order: header (logo,
h1, slogan) → story panel (the only first-person block) → app grid →
social strip → FAQ → "What each app does" (search copy, last on purpose)
→ footer. Spacing scale 8/12/16/24/32/40px; more space above a heading
than below it. The composition is specific because the bio comes before
the products and the products are a 2+2 grid with a heavier first row,
not a uniform three-across.

## 6. Depth & Elevation
No shadows; depth comes from surface color against background and 2px
color borders. Radii: 6px store buttons, 8px buttons, 14px cards and story
panel, 50% logos. Nothing pill-shaped.

## 7. Do's and Don'ts
Do: verify every number against the code before it ships (cities, states,
app counts, wood species). Do: keep every control at 44px or taller on a
phone. Do: run `python ~/.claude/skills/web-design/scripts/sitecheck.py
website/public-landing` and `npm run check:deploy` after every change.
Don't: em dashes anywhere in copy. Don't: eyebrow labels above headings
("NEW", "JUST LAUNCHED"). Don't: a "coming soon" badge once the app is on
that store, or a store badge before it is. Don't: "Get started" / "Learn
more" CTAs; name the app. Don't: forward promises ("no ads", "will stay
free"), "anonymous", identity padding in copy. Don't: scroll animations;
MOTION is 1, hover and press only, with `prefers-reduced-motion` honored.

## 8. Responsive Behavior
Breakpoints: one column under 600px, two columns from 600px. Logo 120px
under 600px, 160px above. h1 scales with the clamp. Story and FAQ text
never exceed 68ch. Tap targets 44px minimum; store buttons wrap to their
own line on narrow cards. No horizontal overflow at 375px. Card logos are
served at 2x their rendered size (180px for 90px, 144px for 72px).

## 9. Agent Prompt Guide
Build to a dark smokehouse sign: `#1a1a1a` background, `#f5e6d3` cream text,
`#d4782f` orange accent, umber `#2a2015` panels, Oswald caps for display
and Inter for body. Each app owns one color on its own card and button
only. ENERGY 2 / RHYTHM 2 / MOTION 1. The identity motif is the stencil
heading over a warm panel. Easy to get wrong: white text on the orange
(fails AA), numbers that drift from the data, and labels above headings.
