# DESIGN.md: Holy Smokes BBQ Co website

Status: values extracted from the live site on 2026-10-01 (audit-001). The
fonts and palette are inherited, not yet confirmed by Holy Smokes Marketing;
revise sections 2 and 3 when they answer. Everything else is decided.

## 1. Visual Theme & Atmosphere
A smokehouse sign at night: near-black, cream lettering, one burnt-orange
glow. The site is a landing page for four free BBQ apps and the family
behind them. Readers are home pitmasters and people hunting a BBQ joint,
most arriving on a phone from a store listing or a search. It should feel
like a hand-painted menu board, not a startup: confident, plain-spoken,
specific. Joel's own bio opens the page in first person; the product copy is
plain third person. No fire clichés beyond the logo's own flames, no stock
photos, no claims the code can't back.

Dial: ENERGY 2 / RHYTHM 2 / MOTION 1
Impeccable mode: Persuade (homepage), Read (SEO and legal pages)

## 2. Color Palette & Roles
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
Oswald 700 for display: a condensed grotesk is the sign-painter's face, and
caps with 1px tracking read as a stencil on a smoker. Used on h1, h2, card
headings and buttons only. Inter 400/700 for everything else: it stays out
of the way of the copy, which is where the voice lives. Both self-hosted,
Latin subset, `font-display: swap`.

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
