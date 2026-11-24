/*
 * Dry Powder Dispatch shared client script
 * - Theme state synced with <html data-theme="light|dark"> and localStorage["theme"]
 * - Mobile navigation toggle
 * - Live world clocks (BLR, SF, LDN, NY) updating every second
 * - Substack signup handoff with config placeholder support
 */

(function () {
  "use strict";

  // Set to the publication used for signups (currently the main site newsletter). To use a dedicated
  // publication later, e.g. "https://drypowderdispatch.substack.com".
  const SUBSTACK_URL = "https://komalkedarnath.substack.com";

  // Optional subscriber count: keep null so no count line is shown until set to a real number.
  const SUBSCRIBER_COUNT = null;

  const THEME_KEY = "theme";

  function getPreferredTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") return saved;
    } catch (_) {}
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function syncThemeMeta(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", theme === "dark" ? "#101614" : "#f6f5ef");
    }
  }

  function applyTheme(theme, animate) {
    const root = document.documentElement;
    if (animate && window.matchMedia && window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      root.classList.add("theme-anim");
      window.setTimeout(() => root.classList.remove("theme-anim"), 350);
    }
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (_) {}
    syncThemeMeta(theme);

    document.querySelectorAll(".theme-toggle").forEach((btn) => {
      const isDark = theme === "dark";
      btn.setAttribute("aria-checked", String(isDark));
      btn.setAttribute("title", isDark ? "Switch to the light page" : "Switch to the dark page");
    });
  }

  function initThemeToggle() {
    const initial = document.documentElement.getAttribute("data-theme") || getPreferredTheme();
    applyTheme(initial, false);

    document.querySelectorAll(".theme-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
        applyTheme(current === "dark" ? "light" : "dark", true);
      });
    });
  }

  function initMobileNav() {
    const btn = document.querySelector(".menu-btn");
    const drawer = document.getElementById("mobile-drawer");
    if (!btn || !drawer) return;

    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      drawer.hidden = expanded;
    });

    drawer.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        btn.setAttribute("aria-expanded", "false");
        drawer.hidden = true;
      });
    });
  }

  function initClocks() {
    const nodes = Array.from(document.querySelectorAll("[data-tz]"));
    if (!nodes.length) return;

    const formatters = new Map();
    nodes.forEach((el) => {
      const tz = el.getAttribute("data-tz");
      if (tz && !formatters.has(tz)) {
        formatters.set(
          tz,
          new Intl.DateTimeFormat("en-GB", {
            timeZone: tz,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })
        );
      }
    });

    function tick() {
      const now = new Date();
      nodes.forEach((el) => {
        const tz = el.getAttribute("data-tz");
        const fmt = tz && formatters.get(tz);
        if (fmt) {
          el.textContent = fmt.format(now);
        }
      });
    }

    tick();
    window.setInterval(tick, 1000);
  }

  function buildSubstackUrl(email) {
    const trimmedBase = SUBSTACK_URL.trim().replace(/\/+$/, "");
    if (!trimmedBase) return "";
    const params = new URLSearchParams();
    if (email) params.set("email", email);
    const query = params.toString();
    return `${trimmedBase}/subscribe${query ? `?${query}` : ""}`;
  }

  function initSignups() {
    document.querySelectorAll("[data-subscriber-count]").forEach((el) => {
      if (typeof SUBSCRIBER_COUNT === "number" && Number.isFinite(SUBSCRIBER_COUNT) && SUBSCRIBER_COUNT > 0) {
        el.textContent = `${SUBSCRIBER_COUNT.toLocaleString("en-US")} subscribers`;
        el.hidden = false;
      } else {
        el.textContent = "Early readers list is open. Be one of the first.";
        el.hidden = false;
      }
    });

    document.querySelectorAll("[data-signup-form]").forEach((form) => {
      const input = form.querySelector('input[type="email"]');
      const status = form.parentElement ? form.parentElement.querySelector("[data-signup-status]") : null;

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = input ? input.value.trim() : "";
        const target = buildSubstackUrl(email);
        if (!target) {
          if (status) {
            status.textContent = "Newsletter handoff is not configured yet (TODO: set SUBSTACK_URL in js/site.js).";
          }
          return;
        }
        if (status) {
          status.textContent = "Opening Substack to confirm your subscription…";
        }
        window.location.href = target;
      });
    });
  }

  function initReveal() {
    const items = Array.from(document.querySelectorAll(".reveal"));
    if (!items.length) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -40px 0px", threshold: 0.05 }
    );
    items.forEach((el) => observer.observe(el));
  }

  document.addEventListener("DOMContentLoaded", () => {
    initThemeToggle();
    initMobileNav();
    initClocks();
    initSignups();
    initReveal();
  });

  window.DryPowderDispatch = Object.freeze({
    get SUBSTACK_URL() {
      return SUBSTACK_URL;
    },
    get SUBSCRIBER_COUNT() {
      return SUBSCRIBER_COUNT;
    },
    applyTheme,
    buildSubstackUrl,
  });
})();