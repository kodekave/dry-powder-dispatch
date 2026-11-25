# Dry Powder Dispatch

*Follow the capital. Find the frontier.* A static, editorial site on venture capital, startup financings and sector money flow. Part of [komalkedarnath.wiki](https://komalkedarnath.wiki). Plain HTML, CSS and vanilla JS, no build step.

Live: https://komalkedarnath.wiki/dry-powder-dispatch/

## Structure
```
index.html            home (hero, clocks, featured, latest deals, signups)
deals/                archive with stage / sector / region filters and search
briefing/             the week in capital: short dated items, each with a source link
explainers/           index + one folder per article (index.html each)
about/                editor, coverage, standards, corrections
css/tokens.css        palette + fonts copied from the main site (light + dark)
css/base.css          layout, header, clocks, footer, controls
css/pages.css         page-level styles
js/site.js            theme sync, clocks, mobile nav, Kit signup (config at top)
js/deals.js           renders the deals feed from data/deals.json
data/deals.json       the feed: 66 real, sourced entries (25 Nov 2026); every entry has a source_url
assets/               original SVG art; feed.xml, sitemap.xml, robots.txt at root
```
Dark mode follows the main site: `data-theme` on `<html>`, saved in `localStorage["theme"]`.

## Add a deal
Append an object to `data/deals.json` (newest first is fine; the page sorts by date):
`{ "id", "date": "YYYY-MM-DD", "date_note", "company", "headline", "amount_usd", "currency_note", "stage", "sectors": [], "region", "lead_investors": [], "source_label", "source_url" }`
`date_note` is optional free text shown instead of the ISO date. Use it when the source gives only a week or quarter (for example "Nov 16–22, 2026" or "Q3 2026"), so the page never shows a precise day the source doesn't state. Leave `region` empty if the source doesn't say; the row still renders but the region filter skips it.
Stages: Pre-seed, Seed, Series A, Series B, Series C+, Growth, Fund close. Regions: India, US, Europe, Middle East, SE Asia, Other. Use a real `source_url` and set `sample` to false (or remove it). The "Sample data" banner disappears when no entry has `sample: true`.

## Add an explainer
Copy a folder in `explainers/`, edit its `index.html`, then add it to `explainers/index.html`, `feed.xml` and `sitemap.xml`.

## Preview locally
`python3 -m http.server 8000` then open http://localhost:8000/

## To do
- Deals and the nine briefings added 25 Nov 2026 come from pages read that day. Re-open each source link before relying on a number; several totals differ by data provider and each piece says which provider it quotes.
- Carta, Fed-expectation and IDB pages blocked automated fetches. The Carta figures (13% down rounds, $49.3B across 1,179 rounds, 71 tender offers) come from public listings, not the full reports. Check them.
- The three older explainers are still drafts with fictional examples.
- Briefing and article pages are marked "Draft for editor review". Remove the label when reviewed.
- `SUBSTACK_URL` in `js/site.js` is the Substack publication that collects signups (the form hands the address to its subscribe page). Set `SUBSCRIBER_COUNT` only to a real number.
- Optional: add `assets/og-card.png` and an Open Graph image tag.

## Brand

The mark is two curling wave crests over two ripples, drawn as a solid glyph that follows `currentColor` (so it flips in dark mode). It sits beside a bold sans wordmark, the way the reference site (veryfrontier.com) sets its mark. The brass node sits in the curl of the larger crest as the signature. Source files live in `assets/brand/`:
- `logo-mark.svg`: the glyph on its own (viewBox 64x44, ink colour).
- `favicon.svg`, `favicon.ico` (16, 32, 48), `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`: the glyph in paper on grainy olive wave bands (S-curve bands, grain fading toward the bottom). `site.webmanifest` lists the home-screen icons.
- `assets/og-card.png` (1200x630): brand line, headline and italic pair in the reference's layout, with three stippled swells along the bottom and a brass node on a crest.

The header and footer inline the glyph in every page (class `brand-mark`), so a logo change means replacing that `<svg>` in each HTML file. When changing CSS, JS or icons, bump the `?v=` token (now `20261125c`) on the links in each page so browsers drop cached copies. Palette: ink `#0e2419`, paper `#ffffff`, olive `#1b6b45`, brass `#e9ff3e`.
