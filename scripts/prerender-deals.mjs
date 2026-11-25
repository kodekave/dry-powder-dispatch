#!/usr/bin/env node
/*
 * Pre-renders the deals into plain HTML so search engines and AI crawlers that do not run
 * JavaScript can read them, and refreshes the Dataset structured data for /deals/.
 *
 * js/deals.js still renders the interactive version in the browser and replaces this markup.
 * Run after editing data/deals.json:  node scripts/prerender-deals.mjs
 * Needs Node 18+. No dependencies.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://dispatch.komalkedarnath.wiki";
const read = (p) => readFile(path.join(ROOT, p), "utf8");
const write = (p, s) => writeFile(path.join(ROOT, p), s);
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function amount(d) {
  const n = d.amount_usd;
  if (typeof n === "number" && Number.isFinite(n)) {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
    if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
    return `$${n}`;
  }
  return d.currency_note ? String(d.currency_note) : "Undisclosed";
}
const monthHeader = (iso) => { const [y, m] = String(iso).split("-").map(Number); return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1))); };

function row(d) {
  const chips = (Array.isArray(d.sectors) ? d.sectors : []).map((s) => `<span class="tag-chip">${esc(s)}</span>`).join("");
  const url = /^https?:\/\//i.test(String(d.source_url || "")) ? d.source_url : "#";
  return `              <li class="deal-row">
                <div class="deal-main">
                  <time class="deal-date tabular" datetime="${esc(d.date)}">${esc(d.date_note || d.date)}</time>
                  <a class="deal-headline" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(d.headline)}</a>
                </div>
                <div class="deal-meta">
                  <span class="deal-amount tabular">${esc(amount(d))}</span>
                  <span class="tag-chip">${esc(d.stage || "Stage n/a")}</span>
                  ${chips}
                  ${d.region ? `<span>${esc(d.region)}</span>` : ""}
                </div>
              </li>`;
}

function between(html, name, inner, indent = "          ") {
  const a = `<!-- prerender:${name}:start -->`, b = `<!-- prerender:${name}:end -->`;
  if (!html.includes(a)) throw new Error(`marker ${name} missing`);
  return html.replace(new RegExp(`${a}[\\s\\S]*?${b}`), () => `${a}\n${inner}\n${indent}${b}`);
}

const deals = JSON.parse(await read("data/deals.json")).sort((a, b) => String(b.date).localeCompare(String(a.date)));

// 1. /deals/: the full archive, grouped by month
const groups = new Map();
for (const d of deals) { const k = String(d.date).slice(0, 7); (groups.get(k) || groups.set(k, []).get(k)).push(d); }
const archive = [...groups.values()].map((items) => `          <div class="month-group">
            <h2 class="label group-heading tabular">${esc(monthHeader(items[0].date))}</h2>
            <ul class="deal-list">
${items.map(row).join("\n")}
            </ul>
          </div>`).join("\n");

// 2. Dataset structured data
const dates = deals.map((d) => d.date).sort();
const dataset = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Dry Powder Dispatch startup funding deals",
  description: `Startup funding rounds and fund closes logged by Dry Powder Dispatch: ${deals.length} entries from ${dates[0]} to ${dates[dates.length - 1]}. Each has the company, headline, amount, stage, sectors, region, lead investors and a link to its public source.`,
  url: `${SITE}/deals/`,
  isAccessibleForFree: true,
  inLanguage: "en-GB",
  keywords: ["startup funding", "venture capital", "funding rounds", "fund closes", "Series A", "Series B", "India", "US", "Europe", "Middle East"],
  temporalCoverage: `${dates[0]}/${dates[dates.length - 1]}`,
  creator: { "@type": "Organization", name: "Dry Powder Dispatch", url: `${SITE}/` },
  variableMeasured: ["date", "company", "headline", "amount_usd", "stage", "sectors", "region", "lead_investors", "source_url"],
  distribution: { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/data/deals.json` },
};

let page = await read("deals/index.html");
page = between(page, "deals", archive);
page = between(page, "ld", `  <script type="application/ld+json">\n    ${JSON.stringify(dataset, null, 2).replace(/\n/g, "\n    ")}\n  </script>`, "  ");
await write("deals/index.html", page);

// 3. Home: the ten latest, for readers without JavaScript
let home = await read("index.html");
home = between(home, "latest", `            <p class="mono-meta">JavaScript is disabled; showing the 10 latest entries.</p>\n            <ul class="deal-list">\n${deals.slice(0, 10).map(row).join("\n")}\n            </ul>`, "            ");
await write("index.html", home);

console.log(`Pre-rendered ${deals.length} deals.`);
