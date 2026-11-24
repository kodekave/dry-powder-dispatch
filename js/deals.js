/*
 * Deals feed & archive renderer for Dry Powder Dispatch.
 * Renders plain ruled deal rows grouped by day (home) or month (archive),
 * with stage/sector/region filter chips and text search on /deals/.
 */

(function () {
  "use strict";

  const STAGE_ORDER = ["Pre-seed", "Seed", "Series A", "Series B", "Series C+", "Growth", "Fund close"];
  const SECTOR_ORDER = [
    "AI infra",
    "AI apps",
    "fintech",
    "climate",
    "defense and space",
    "health",
    "SaaS",
    "consumer",
    "deep tech",
  ];
  const REGION_ORDER = ["India", "US", "Europe", "Middle East", "SE Asia", "Other"];

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatAmount(deal) {
    if (typeof deal.amount_usd === "number" && Number.isFinite(deal.amount_usd)) {
      if (deal.amount_usd >= 1e9) {
        return `$${(deal.amount_usd / 1e9).toFixed(deal.amount_usd % 1e9 === 0 ? 0 : 1)}B`;
      }
      if (deal.amount_usd >= 1e6) {
        return `$${(deal.amount_usd / 1e6).toFixed(deal.amount_usd % 1e6 === 0 ? 0 : 1)}M`;
      }
      if (deal.amount_usd >= 1e3) {
        return `$${Math.round(deal.amount_usd / 1e3)}K`;
      }
      return `$${deal.amount_usd}`;
    }
    return deal.currency_note ? String(deal.currency_note) : "Undisclosed";
  }

  function formatDayHeader(isoDate) {
    const parts = String(isoDate).split("-");
    if (parts.length !== 3) return isoDate;
    const dt = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(dt);
  }

  function formatMonthHeader(isoDate) {
    const parts = String(isoDate).split("-");
    if (parts.length < 2) return isoDate;
    const dt = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, 1));
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    }).format(dt);
  }

  function renderDealRow(deal) {
    const sectors = Array.isArray(deal.sectors) ? deal.sectors : [];
    const sectorChips = sectors
      .map((s) => `<span class="tag-chip">${escapeHtml(s)}</span>`)
      .join("");
    const safeUrl = /^https?:\/\//i.test(String(deal.source_url || "")) ? deal.source_url : "#";
    const sampleMark = deal.sample ? ` <span class="tag-chip" title="Sample entry">Sample</span>` : "";

    return `
      <li class="deal-row">
        <div class="deal-main">
          <time class="deal-date tabular" datetime="${escapeHtml(deal.date)}">${escapeHtml(deal.date_note || deal.date)}</time>
          <a class="deal-headline" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(deal.headline)}</a>
        </div>
        <div class="deal-meta">
          <span class="deal-amount tabular">${escapeHtml(formatAmount(deal))}</span>
          <span class="tag-chip">${escapeHtml(deal.stage || "Stage n/a")}</span>
          ${sectorChips}
          ${deal.region ? `<span>${escapeHtml(deal.region)}</span>` : ""}
          ${sampleMark}
        </div>
      </li>
    `;
  }


  const SECTOR_ART = {
    "fintech": "fintech", "climate": "climate", "ai infra": "ai-infra", "deep tech": "deep-tech", "saas": "saas",
    "health": "health", "defense and space": "defense-space", "ai apps": "ai-apps", "consumer": "consumer",
  };

  function artFor(deal) {
    if (String(deal.stage || "").toLowerCase() === "fund close") return "fund";
    const first = Array.isArray(deal.sectors) && deal.sectors.length ? String(deal.sectors[0]).toLowerCase() : "";
    return SECTOR_ART[first] || "general";
  }

  function renderDealCard(deal, assetsBase) {
    const sectors = Array.isArray(deal.sectors) ? deal.sectors : [];
    const chips = sectors.map((s) => `<span class="tag-chip">${escapeHtml(s)}</span>`).join("");
    const hasUrl = /^https?:\/\//i.test(String(deal.source_url || ""));
    const title = hasUrl
      ? `<a href="${escapeHtml(deal.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(deal.headline)}</a>`
      : escapeHtml(deal.headline);
    const meta = [
      `<time class="tabular" datetime="${escapeHtml(deal.date)}">${escapeHtml(deal.date_note || deal.date)}</time>`,
      `<span>${escapeHtml(deal.stage || "Stage n/a")}</span>`,
      deal.region ? `<span>${escapeHtml(deal.region)}</span>` : "",
    ].join("");
    return `
      <li class="deal-card${hasUrl ? " has-link" : ""}">
        <div class="deal-card-img">
          <img class="img-light" src="${escapeHtml(assetsBase)}${artFor(deal)}.webp?v=20261125" alt="" width="1000" height="625" loading="lazy" decoding="async" />
          <img class="img-dark" src="${escapeHtml(assetsBase)}${artFor(deal)}-dark.webp?v=20261125" alt="" width="1000" height="625" loading="lazy" decoding="async" />
        </div>
        <div class="featured-meta">${meta}</div>
        <h3 class="deal-card-title">${title}</h3>
        <div class="deal-card-foot"><span class="deal-amount tabular">${escapeHtml(formatAmount(deal))}</span>${chips}${deal.sample ? `<span class="tag-chip" title="Sample entry">Sample</span>` : ""}</div>
      </li>
    `;
  }

  function syncSampleBanner(deals) {
    const banner = document.getElementById("sample-notice");
    if (!banner) return;
    const hasSample = deals.some((d) => Boolean(d.sample));
    banner.hidden = !hasSample;
  }

  function renderLatestHome(container, deals, limit) {
    const sorted = deals.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const items = typeof limit === "number" ? sorted.slice(0, limit) : sorted;

    if (!items.length) {
      container.innerHTML = `<p class="mono-meta">No deals logged yet.</p>`;
      return;
    }

    if (container.getAttribute("data-layout") === "cards") {
      const base = container.getAttribute("data-assets") || "assets/sector/";
      container.innerHTML = `<ul class="deal-grid">${items.map((d) => renderDealCard(d, base)).join("")}</ul>`;
      return;
    }

    const groups = new Map();
    items.forEach((deal) => {
      const key = deal.date || "Undated";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(deal);
    });

    const html = Array.from(groups.entries())
      .map(
        ([day, rows]) => `
        <div class="day-group">
          <h3 class="label group-heading tabular">${escapeHtml(formatDayHeader(day))}</h3>
          <ul class="deal-list">
            ${rows.map(renderDealRow).join("")}
          </ul>
        </div>
      `
      )
      .join("");

    container.innerHTML = html;
  }

  function initArchive(container, deals) {
    const searchInput = document.getElementById("deal-search");
    const stageChipsEl = document.getElementById("stage-chips");
    const sectorChipsEl = document.getElementById("sector-chips");
    const regionChipsEl = document.getElementById("region-chips");
    const countEl = document.getElementById("archive-count");
    const resetBtn = document.getElementById("reset-filters");

    const state = {
      stage: "",
      sector: "",
      region: "",
      query: "",
    };

    function buildChips(target, values, key) {
      if (!target) return;
      target.innerHTML = values
        .map(
          (val) =>
            `<button type="button" class="filter-chip" data-filter-key="${key}" data-filter-val="${escapeHtml(val)}" aria-pressed="false">${escapeHtml(val)}</button>`
        )
        .join("");

      target.querySelectorAll(".filter-chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          const val = btn.getAttribute("data-filter-val") || "";
          state[key] = state[key] === val ? "" : val;
          target.querySelectorAll(".filter-chip").forEach((b) => {
            b.setAttribute("aria-pressed", String(b.getAttribute("data-filter-val") === state[key]));
          });
          applyFilters();
        });
      });
    }

    buildChips(stageChipsEl, STAGE_ORDER, "stage");
    buildChips(sectorChipsEl, SECTOR_ORDER, "sector");
    buildChips(regionChipsEl, REGION_ORDER, "region");

    function applyFilters() {
      const q = state.query.trim().toLowerCase();
      const filtered = deals
        .filter((d) => {
          if (state.stage && d.stage !== state.stage) return false;
          if (state.region && d.region !== state.region) return false;
          if (state.sector && !(Array.isArray(d.sectors) && d.sectors.includes(state.sector))) return false;
          if (q) {
            const haystack = [
              d.company,
              d.headline,
              d.stage,
              d.region,
              ...(Array.isArray(d.sectors) ? d.sectors : []),
              ...(Array.isArray(d.lead_investors) ? d.lead_investors : []),
            ]
              .join(" ")
              .toLowerCase();
            if (!haystack.includes(q)) return false;
          }
          return true;
        })
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));

      if (countEl) {
        countEl.textContent = `${filtered.length} ${filtered.length === 1 ? "deal" : "deals"} shown`;
      }

      if (!filtered.length) {
        container.innerHTML = `<p class="mono-meta">No deals match the active filters.</p>`;
        return;
      }

      const months = new Map();
      filtered.forEach((deal) => {
        const mKey = String(deal.date || "").slice(0, 7) || "Undated";
        if (!months.has(mKey)) months.set(mKey, { sampleDate: deal.date, items: [] });
        months.get(mKey).items.push(deal);
      });

      container.innerHTML = Array.from(months.entries())
        .map(
          ([, group]) => `
          <div class="month-group">
            <h3 class="label group-heading tabular">${escapeHtml(formatMonthHeader(group.sampleDate))}</h3>
            <ul class="deal-list">
              ${group.items.map(renderDealRow).join("")}
            </ul>
          </div>
        `
        )
        .join("");
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.query = searchInput.value || "";
        applyFilters();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        state.stage = "";
        state.sector = "";
        state.region = "";
        state.query = "";
        if (searchInput) searchInput.value = "";
        document.querySelectorAll(".filter-chip").forEach((b) => b.setAttribute("aria-pressed", "false"));
        applyFilters();
      });
    }

    applyFilters();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const latestEl = document.getElementById("latest-deals");
    const archiveEl = document.getElementById("archive-deals");
    if (!latestEl && !archiveEl) return;

    const dataUrl = (latestEl || archiveEl).getAttribute("data-deals-url") || "data/deals.json";

    fetch(dataUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((deals) => {
        const list = Array.isArray(deals) ? deals : [];
        syncSampleBanner(list);
        if (latestEl) {
          const limitAttr = Number(latestEl.getAttribute("data-limit"));
          renderLatestHome(latestEl, list, Number.isFinite(limitAttr) && limitAttr > 0 ? limitAttr : 12);
        }
        if (archiveEl) {
          initArchive(archiveEl, list);
        }
      })
      .catch(() => {
        const msg = `<p class="mono-meta">Unable to load deal feed right now.</p>`;
        if (latestEl) latestEl.innerHTML = msg;
        if (archiveEl) archiveEl.innerHTML = msg;
      });
  });
})();