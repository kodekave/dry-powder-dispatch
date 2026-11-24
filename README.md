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
- `KIT_FORM_URL` in `js/site.js` is the Kit form that collects signups. Set `SUBSCRIBER_COUNT` only to a real number.
- Optional: add `assets/og-card.png` and an Open Graph image tag.

## Brand

The mark is a lighthouse inside a postmark ring ("Follow the capital. Find the frontier."). Source files live in `assets/brand/`: `logo-mark.svg` (header and footer mark, uses `currentColor`), `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`. The social-share image is `assets/og-card.png` (1200x630) and `site.webmanifest` lists the home-screen icons. When changing CSS or JS, bump the `?v=` token on the stylesheet and script links in each page so browsers drop cached copies.
