#!/usr/bin/env node
/*
 * Mirrors the Dry Powder Dispatch Substack onto this site.
 *
 * Substack is the source of truth for articles. This script reads its public RSS feed and
 * regenerates, from what is published there:
 *   - explainers/<slug>/index.html     one page per published post
 *   - explainers/index.html            the article list (between the sync markers)
 *   - index.html                       the "This week" row (between the sync markers)
 *   - feed.xml, sitemap.xml            article entries
 * It also keeps data/explainers.json, which holds what Substack does not: thumbnail, kicker, order.
 *
 * Pages for articles that are NOT on Substack yet are left exactly as they are.
 * Needs Node 18+ (global fetch). No dependencies.   Usage: node scripts/sync-substack.mjs [--feed <url|file>]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://dispatch.komalkedarnath.wiki";
const DEFAULT_FEED = "https://komalkedarnath.substack.com/feed";
const argFeed = process.argv.includes("--feed") ? process.argv[process.argv.indexOf("--feed") + 1] : DEFAULT_FEED;

const read = (p) => readFile(path.join(ROOT, p), "utf8");
const write = async (p, s) => { await mkdir(path.dirname(path.join(ROOT, p)), { recursive: true }); await writeFile(path.join(ROOT, p), s); };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");
const norm = (s) => s.toLowerCase().replace(/&[a-z#0-9]+;/g, "").replace(/[^a-z0-9]+/g, "");
const unent = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&lsquo;|&rsquo;/g, "’").replace(/&ldquo;|&rdquo;/g, "”")
  .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/* ---------- feed ---------- */
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  if (!m) return "";
  const v = m[1].trim();
  const c = v.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  return c ? c[1] : unent(v);
}

async function loadFeed() {
  const xml = /^https?:/.test(argFeed) ? await (await fetch(argFeed + (argFeed.includes("?") ? "&" : "?") + "t=" + Date.now(), { headers: { "user-agent": "dry-powder-dispatch-sync" } })).text() : await readFile(path.resolve(argFeed), "utf8");
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const b = m[1];
    const link = tag(b, "link");
    return {
      title: tag(b, "title"),
      dek: tag(b, "description"),
      link,
      substackSlug: (link.match(/\/p\/([^/?#]+)/) || [])[1] || "",
      date: new Date(tag(b, "pubDate")),
      html: tag(b, "content:encoded"),
    };
  }).filter((p) => p.title && p.substackSlug);
}

/* ---------- Substack HTML -> plain article HTML ---------- */
function dropBlocks(html, classRe) {
  // remove <div ...class="...match..."> ... </div> with nesting
  const open = new RegExp(`<div[^>]*class="[^"]*(?:${classRe})[^"]*"[^>]*>`, "i");
  for (;;) {
    const m = open.exec(html);
    if (!m) return html;
    let depth = 1, i = m.index + m[0].length;
    const re = /<(\/?)div\b[^>]*>/gi; re.lastIndex = i;
    let t;
    while (depth && (t = re.exec(html))) { depth += t[1] ? -1 : 1; i = re.lastIndex; }
    html = html.slice(0, m.index) + html.slice(i);
  }
}

function cleanBody(raw) {
  let h = raw;
  h = dropBlocks(h, "subscription-widget|button-wrapper|subscribe-widget|footnote-hr|share-");
  // captioned images -> <figure>
  h = h.replace(/<div class="captioned-image-container">[\s\S]*?<img[^>]*\ssrc="([^"]+)"[^>]*>[\s\S]*?(?:<figcaption[^>]*>([\s\S]*?)<\/figcaption>)?\s*<\/figure><\/div>/g,
    (_, src, cap) => `<figure><img src="${src}" alt="" loading="lazy" />${cap ? `<figcaption>${cap.replace(/<[^>]+>/g, "")}</figcaption>` : ""}</figure>`);
  h = h.replace(/<(?!img\b|a\b)([a-z0-9]+)\s[^>]*>/gi, "<$1>");        // drop attributes (classes, styles, data-*)
  h = h.replace(/<a\s+[^>]*?href="([^"]+)"[^>]*>/gi, (_, href) => `<a href="${href}" target="_blank" rel="noopener noreferrer">`);
  h = h.replace(/https:\/\/komalkedarnath\.wiki\/dry-powder-dispatch/g, SITE);
  h = h.replace(/<a href="(https:\/\/dispatch\.komalkedarnath\.wiki[^"]*)" target="_blank" rel="noopener noreferrer">/g, '<a href="$1">');
  h = h.replace(/<\/?(?:div|span|picture|source|button|svg|path)\b[^>]*>/gi, "");
  h = h.replace(/<p>\s*<\/p>/g, "").replace(/\n{2,}/g, "\n").trim();
  return h;
}

/* ---------- metadata store ---------- */
async function loadMeta() { return JSON.parse(await read("data/explainers.json")); }

function matchLocal(meta, post) {
  return meta.find((m) => m.substack === post.substackSlug) || meta.find((m) => !m.substack && norm(m.title) === norm(post.title));
}

const readMins = (html) => Math.max(1, Math.round(html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length / 150));
const isoDay = (d) => d.toISOString().slice(0, 10);

/* ---------- page generation ---------- */
function articleHtml(frame, e, body, meta) {
  const canonical = `${SITE}/explainers/${e.slug}/`;
  const org = { "@type": "Organization", "@id": `${SITE}/#org`, name: "Dry Powder Dispatch", url: `${SITE}/`, logo: { "@type": "ImageObject", url: `${SITE}/assets/brand/icon-512.png` } };
  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle", "@id": `${canonical}#article`, headline: e.title, description: e.dek,
        datePublished: e.date, dateModified: e.date, inLanguage: "en-GB", isAccessibleForFree: true,
        image: [`${SITE}/assets/og-card.png`],
        author: { "@type": "Person", name: "Komal Kedarnath G", url: `${SITE}/about/` },
        publisher: org, mainEntityOfPage: canonical, sameAs: e.url,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Dry Powder Dispatch", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Explainers", item: `${SITE}/explainers/` },
          { "@type": "ListItem", position: 3, name: e.seoTitle || e.title, item: canonical },
        ],
      },
    ],
  }, null, 2);
  const related = meta.filter((m) => m.substack && m.slug !== e.slug).slice(0, 3)
    .map((m) => `            <li><a class="link-underline" href="../${m.slug}/">${esc(m.title)}</a></li>`).join("\n");
  const article = `<article>
      <header class="article-header">
        <div class="wrap-reading">
          <p class="label label-dot" style="color:var(--color-brass-deep);">${esc(e.kicker)}</p>
          <h1 class="wordmark article-title">${esc(e.title)}</h1>
          <p class="article-dek">${esc(e.dek)}</p>
          <div class="article-byline">
            <span>By <a class="link-underline" href="../../about/">Komal Kedarnath G</a></span>
            <time datetime="${e.date}">${e.date}</time>
            <span>${e.read} min read</span>
            <a class="link-underline" href="${e.url}" target="_blank" rel="noopener noreferrer">Read on Substack</a>
          </div>
        </div>
      </header>

      <div class="article-body">
        <div class="wrap-reading">
${body}
        </div>
      </div>
${related ? `
      <section class="article-related" aria-labelledby="related-heading">
        <div class="wrap-reading">
          <h2 id="related-heading" class="label" style="color:var(--color-brass-deep);">More from the Dispatch</h2>
          <ul>
${related}
          </ul>
        </div>
      </section>
` : ""}    </article>`;
  const seo = e.seoTitle || e.title;
  const articleMeta = `<meta property="article:published_time" content="${e.date}" />\n  <meta property="article:author" content="Komal Kedarnath G" />\n  <meta property="article:section" content="${escAttr(e.kicker.split(" ·")[0])}" />`;
  return frame
    .replace("{{TITLE_TAG}}", () => `${esc(seo)} — Dispatch`).replace(/\{\{TITLE_ATTR\}\}/g, () => escAttr(seo))
    .replace(/\{\{DEK_ATTR\}\}/g, () => escAttr(e.dek)).replace(/\{\{CANONICAL\}\}/g, () => canonical)
    .replace("{{ARTICLE_META}}", () => articleMeta)
    .replace("{{JSONLD}}", () => `\n    ${ld.replace(/\n/g, "\n    ")}\n  `)
    .replace("<!--ARTICLE-->", () => article);
}

function thumbHtml(t) {
  return t ? `<div class="thumb is-photo"><img src="${escAttr(t.src)}" alt="" title="Image: ${escAttr(t.credit)}" width="96" height="96" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.thumb').remove()" /></div>\n            ` : "";
}

const listRow = (e) => `          <li class="explainer-row">
            ${thumbHtml(e.thumb)}<div class="featured-text">
            <div class="featured-meta"><time datetime="${e.date}">${e.date}</time><span>${e.read} min read</span><span>${esc(e.kicker)}</span></div>
            <h2 class="explainer-title"><a href="${e.slug}/">${esc(e.title)}</a></h2>
            <p class="featured-dek">${esc(e.dek)}</p>
          </div>
          </li>`;

const featuredItem = (e) => `          <article class="featured-item">
            ${thumbHtml(e.thumb)}<div class="featured-text">
              <div class="featured-meta">
              <span class="label">${esc(e.kicker.split(" ·")[0])}</span>
              <span>${e.date}</span>
            </div>
            <h3 class="featured-headline"><a href="explainers/${e.slug}/">${esc(e.title)}</a></h3>
            <p class="featured-dek">${esc(e.dek)}</p>
            </div>
          </article>`;

function between(html, name, inner) {
  const a = `<!-- sync:${name}:start -->`, b = `<!-- sync:${name}:end -->`;
  if (!html.includes(a)) throw new Error(`marker ${name} missing`);
  return html.replace(new RegExp(`${a}[\\s\\S]*?${b}`), () => `${a}\n${inner}\n          ${b}`);
}

/* ---------- main ---------- */
const posts = await loadFeed();
const meta = await loadMeta();
const frame = await read("scripts/article-frame.html");
console.log(`Substack posts in feed: ${posts.length}`);

let changed = 0;
for (const p of posts) {
  let e = matchLocal(meta, p);
  if (!e) {
    e = { slug: p.substackSlug, title: p.title, dek: p.dek, date: isoDay(p.date), read: 0, isNew: true, kicker: "Dispatch", thumb: null };
    meta.unshift(e);
  }
  const body = cleanBody(p.html);
  // keep the reading time already shown for an article; only compute it for a new one
  Object.assign(e, { substack: p.substackSlug, url: p.link, title: p.title, dek: p.dek || e.dek, read: e.read && !e.isNew ? e.read : readMins(body) });
  delete e.isNew;
  await write(`explainers/${e.slug}/index.html`, articleHtml(frame, e, body, meta));
  changed++;
}

// stable order: newest date first, ties keep file order
const order = new Map(meta.map((m, i) => [m, i]));
meta.sort((a, b) => b.date.localeCompare(a.date) || order.get(a) - order.get(b));
await write("data/explainers.json", JSON.stringify(meta, null, 1) + "\n");

// lists
await write("explainers/index.html", between(await read("explainers/index.html"), "explainers", meta.map(listRow).join("\n")));
await write("index.html", between(await read("index.html"), "featured", meta.slice(0, 3).map(featuredItem).join("\n\n")));

// feed.xml
const items = meta.map((e, i) => {
  const u = `${SITE}/explainers/${e.slug}/`;
  const d = new Date(`${e.date}T09:00:00+05:30`); d.setMinutes(d.getMinutes() - i);
  return `    <item>
      <title>${esc(e.title)}</title>
      <link>${u}</link>
      <guid>${u}</guid>
      <pubDate>${d.toUTCString().replace("GMT", "+0000")}</pubDate>
      <description>${esc(e.dek)}</description>
    </item>`;
}).join("\n");
let feed = await read("feed.xml");
feed = feed.replace(/(<atom:link[^>]*\/>\n)[\s\S]*(\n  <\/channel>)/, (_, a, b) => `${a}${items}${b}`);
await write("feed.xml", feed);

// sitemap.xml
let sm = await read("sitemap.xml");
sm = sm.replace(/\s*<url>\s*<loc>[^<]*\/explainers\/[^/<]+\/<\/loc>[\s\S]*?<\/url>/g, "");
const urls = meta.filter((e) => e.substack).map((e) => `  <url>\n    <loc>${SITE}/explainers/${e.slug}/</loc>\n    <lastmod>${e.date}</lastmod>\n  </url>`).join("\n");
sm = sm.replace("</urlset>", () => `${urls}\n</urlset>`);
await write("sitemap.xml", sm);

// llms.txt: keep the article list in step
let llms = await read("llms.txt");
const llmsList = meta.filter((e) => e.substack).map((e) => `- [${e.title}](${SITE}/explainers/${e.slug}/): ${e.dek}`).join("\n");
llms = llms.replace(/(## Explainers\n\n)[\s\S]*?(\n\n## Optional)/, (_, a, b) => `${a}${llmsList}${b}`);
await write("llms.txt", llms);

console.log(`Synced ${changed} post(s); ${meta.length} entries listed.`);
