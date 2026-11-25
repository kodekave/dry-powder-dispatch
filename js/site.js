/*
 * Dry Powder Dispatch shared client script
 * - Theme state synced with <html data-theme="light|dark"> and localStorage["theme"]
 * - Mobile navigation toggle
 * - Live world clocks (BLR, SF, LDN, NY) updating every second
 * - Signup is Substack's embedded form (an iframe in the HTML; this only fills the count line)
 */

(function () {
  "use strict";

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
      meta.setAttribute("content", theme === "dark" ? "#08140d" : "#ffffff");
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
    get SUBSCRIBER_COUNT() {
      return SUBSCRIBER_COUNT;
    },
    applyTheme,
  });
})();