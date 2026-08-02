(function () {
  "use strict";

  /* Keep sticky page chrome offsets in sync with the live header height */
  function syncSiteHeadOffset() {
    var head = document.querySelector(".site-head");
    if (!head) return;
    document.documentElement.style.setProperty(
      "--site-head-offset",
      head.getBoundingClientRect().height + "px"
    );
  }
  syncSiteHeadOffset();
  window.addEventListener("resize", syncSiteHeadOffset);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncSiteHeadOffset).catch(function () {});
  }

  /* ---------- Desktop mega menu (click to open; no hover) ---------- */
  var navItems = document.querySelectorAll(".nav-item");

  function setOpen(item, open) {
    item.classList.toggle("is-open", open);
    var trigger = item.querySelector(".nav-link");
    if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function closeAll(except) {
    navItems.forEach(function (item) {
      if (item !== except) setOpen(item, false);
    });
  }

  navItems.forEach(function (item) {
    var trigger = item.querySelector(".nav-link");
    if (!trigger) return;

    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-haspopup", "true");

    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var willOpen = !item.classList.contains("is-open");
      closeAll(item);
      setOpen(item, willOpen);
    });

    trigger.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        setOpen(item, false);
        trigger.blur();
      }
    });
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".nav-item")) closeAll(null);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAll(null);
  });

  /* ---------- Hero country search (homepage) ---------- */
  (function initHeroSearch() {
    var form = document.getElementById("heroCountrySearch");
    var input = document.getElementById("heroCountryInput");
    var suggest = document.getElementById("heroSuggest");
    if (!form || !input || !suggest) return;

    var LIVE = { estonia: 1, ireland: 1, malta: 1, singapore: 1, uk: 1 };
    var SHORT = { uk: "UK", "united-states": "US", uae: "UAE" };
    var SERVICES = [
      { key: "eor", label: "Employer of Record", meta: "EOR" },
      { key: "global-payroll", label: "Global Payroll", meta: "Payroll" },
      { key: "entity-formation", label: "Entity Formation", meta: "Entity" },
      { key: "peo", label: "PEO Services", meta: "PEO" }
    ];
    var roster = [];
    var active = -1;

    fetch("/data/countries-roster.json")
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { roster = Array.isArray(data) ? data : []; })
      .catch(function () { roster = []; });

    function countryHref(c) {
      return "/countries/" + c.slug + "/";
    }

    function serviceHref(c, key) {
      return "/countries/" + c.slug + "/" + key + "/";
    }

    function shortName(c) {
      return SHORT[c.slug] || c.name;
    }

    function matchesQuery(c, q) {
      var name = (c.name || "").toLowerCase();
      var slug = c.slug || "";
      return name.indexOf(q) !== -1 || slug.indexOf(q) !== -1;
    }

    function resolveCountry(term) {
      var q = (term || "").toLowerCase().trim();
      if (!q || !roster.length) return null;
      var exact = roster.find(function (c) {
        return (c.name || "").toLowerCase() === q || c.slug === q;
      });
      if (exact) return exact;
      var starts = roster.find(function (c) {
        return (c.name || "").toLowerCase().indexOf(q) === 0 || c.slug.indexOf(q) === 0;
      });
      if (starts) return starts;
      return roster.find(function (c) {
        return matchesQuery(c, q);
      }) || null;
    }

    function hideSuggest() {
      suggest.hidden = true;
      suggest.innerHTML = "";
      active = -1;
    }

    function optionHtml(item, i) {
      return (
        '<button type="button" role="option" data-i="' +
        i +
        '" data-href="' +
        item.href +
        '">' +
        '<span class="flag sm"><span class="fi fi-' +
        item.flag +
        '"></span></span>' +
        "<span>" +
        item.label +
        "</span><small>" +
        item.meta +
        "</small></button>"
      );
    }

    function renderSuggest(term) {
      var q = (term || "").toLowerCase().trim();
      if (q.length < 1 || !roster.length) {
        hideSuggest();
        return;
      }
      var hits = roster.filter(function (c) {
        return matchesQuery(c, q);
      }).slice(0, 6);
      if (!hits.length) {
        hideSuggest();
        return;
      }

      var exact = hits.find(function (c) {
        return (c.name || "").toLowerCase() === q || c.slug === q;
      });
      var expand = exact || (hits.length === 1 ? hits[0] : null);
      var items = [];

      if (expand) {
        var live = !!LIVE[expand.slug];
        items.push({
          href: countryHref(expand),
          label: expand.name,
          meta: live ? "Guide" : "Coming soon",
          flag: expand.flag
        });
        SERVICES.forEach(function (s) {
          items.push({
            href: serviceHref(expand, s.key),
            label: s.label + " " + shortName(expand),
            meta: s.meta,
            flag: expand.flag
          });
        });
        hits.forEach(function (c) {
          if (c.slug === expand.slug) return;
          items.push({
            href: countryHref(c),
            label: c.name,
            meta: LIVE[c.slug] ? "Guide" : "Coming soon",
            flag: c.flag
          });
        });
      } else {
        hits.forEach(function (c) {
          items.push({
            href: countryHref(c),
            label: c.name,
            meta: LIVE[c.slug] ? "Guide" : "Coming soon",
            flag: c.flag
          });
        });
      }

      suggest.innerHTML = items.map(optionHtml).join("");
      suggest.hidden = false;
      active = -1;
    }

    function go(href) {
      window.location.href = href;
    }

    input.addEventListener("input", function () {
      renderSuggest(input.value);
    });

    input.addEventListener("keydown", function (e) {
      var buttons = suggest.querySelectorAll("button");
      if (e.key === "ArrowDown" && buttons.length) {
        e.preventDefault();
        active = Math.min(active + 1, buttons.length - 1);
        buttons.forEach(function (b, i) { b.classList.toggle("is-active", i === active); });
        if (buttons[active] && buttons[active].scrollIntoView) {
          buttons[active].scrollIntoView({ block: "nearest" });
        }
      } else if (e.key === "ArrowUp" && buttons.length) {
        e.preventDefault();
        active = Math.max(active - 1, 0);
        buttons.forEach(function (b, i) { b.classList.toggle("is-active", i === active); });
        if (buttons[active] && buttons[active].scrollIntoView) {
          buttons[active].scrollIntoView({ block: "nearest" });
        }
      } else if (e.key === "Enter" && active >= 0 && buttons[active]) {
        e.preventDefault();
        go(buttons[active].dataset.href);
      } else if (e.key === "Escape") {
        hideSuggest();
      }
    });

    suggest.addEventListener("mousedown", function (e) {
      var btn = e.target.closest("button[data-href]");
      if (!btn) return;
      e.preventDefault();
      go(btn.dataset.href);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) {
        go("/countries/");
        return;
      }
      var match = resolveCountry(q);
      if (match) {
        go(countryHref(match));
        return;
      }
      go("/countries/");
    });

    document.addEventListener("click", function (e) {
      if (!form.contains(e.target)) hideSuggest();
    });
  })();

  /* ---------- Mobile panel ---------- */
  var burger = document.querySelector(".burger");
  var mobilePanel = document.querySelector(".mobile-panel");
  var mobileScrim = document.querySelector(".mobile-scrim");
  var mobileClose = document.querySelector(".mp-close");

  function openMobile() {
    mobilePanel.classList.add("open");
    mobileScrim.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeMobile() {
    mobilePanel.classList.remove("open");
    mobileScrim.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (burger) burger.addEventListener("click", openMobile);
  if (mobileClose) mobileClose.addEventListener("click", closeMobile);
  if (mobileScrim) mobileScrim.addEventListener("click", closeMobile);

  /* ---------- Mobile accordions (Services / Countries) ---------- */
  document.querySelectorAll(".mobile-acc > button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var acc = btn.parentElement;
      var wasOpen = acc.classList.contains("open");
      document.querySelectorAll(".mobile-acc").forEach(function (a) {
        a.classList.remove("open");
      });
      acc.classList.toggle("open", !wasOpen);
    });
  });

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll(".faq-q").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var item = btn.closest(".faq-item");
      item.classList.toggle("open");
    });
  });

  /* ---------- Cost calculator (static UI, no calc logic yet) ---------- */
  document.querySelectorAll(".calc-slider").forEach(function (slider) {
    var out = document.getElementById(slider.dataset.out);
    if (!out) return;
    var render = function () {
      out.textContent = slider.dataset.prefix + Number(slider.value).toLocaleString() + slider.dataset.suffix;
    };
    slider.addEventListener("input", render);
    render();
  });

  /* ---------- Scroll reveal ---------- */
  var revealTargets = document.querySelectorAll(".hero, .pad, .cta-band");
  revealTargets.forEach(function (el) { el.classList.add("reveal"); });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Countries atlas: search, region/hub filter, cards/table toggle, sortable table ---------- */
  var grid = document.getElementById("countryGrid");
  if (grid) {
    var searchInput = document.getElementById("countrySearch");
    var chips = document.querySelectorAll("#regionChips .chip");
    var cards = grid.querySelectorAll(".country-card");
    var noResults = document.getElementById("noResults");
    var clearFilters = document.getElementById("clearFilters");
    var viewToggle = document.getElementById("viewToggle");
    var tableHeading = document.getElementById("tableHeading");
    var tableWrap = document.getElementById("countryTableWrap");
    var tableNote = document.getElementById("tableNote");
    var table = document.getElementById("countryTable");

    var currentFilter = "all";

    // Deep-link from nav / hero: /countries/?region=europe | ?filter=hub | ?q=germany
    (function applyQueryFilter() {
      var params = new URLSearchParams(window.location.search);
      var region = params.get("region");
      var filter = params.get("filter");
      var q = params.get("q");
      if (q && searchInput) {
        searchInput.value = q;
        searchInput.focus();
      }
      var wanted = null;
      if (filter === "hub") wanted = "hub";
      else if (region) wanted = "region:" + region;
      if (!wanted) return;
      var match = null;
      chips.forEach(function (chip) {
        if (chip.dataset.filter === wanted) match = chip;
      });
      if (!match) return;
      chips.forEach(function (c) { c.classList.remove("on"); });
      match.classList.add("on");
      currentFilter = wanted;
    })();

    function itemMatches(el, term) {
      var region = el.dataset.region;
      var isHub = el.dataset.hub === "1";
      var name = el.dataset.name || "";
      var matchesFilter =
        currentFilter === "all" ||
        (currentFilter === "hub" && isHub) ||
        (currentFilter.indexOf("region:") === 0 && region === currentFilter.slice(7));
      var matchesSearch = !term || name.indexOf(term) !== -1;
      return matchesFilter && matchesSearch;
    }

    function applyFilters() {
      var term = (searchInput && searchInput.value || "").toLowerCase().trim();
      var showTable = tableWrap && !tableWrap.hidden;
      var anyVisible = false;

      cards.forEach(function (card) {
        var visible = itemMatches(card, term);
        card.style.display = visible ? "" : "none";
        if (!showTable && visible) anyVisible = true;
      });

      if (table) {
        table.querySelectorAll("tbody tr").forEach(function (row) {
          var visible = itemMatches(row, term);
          row.style.display = visible ? "" : "none";
          if (showTable && visible) anyVisible = true;
        });
      }

      if (noResults) noResults.hidden = anyVisible;
    }

    applyFilters();

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.classList.remove("on"); });
        chip.classList.add("on");
        currentFilter = chip.dataset.filter;
        applyFilters();
      });
    });

    if (searchInput) searchInput.addEventListener("input", applyFilters);

    if (clearFilters) {
      clearFilters.addEventListener("click", function (e) {
        e.preventDefault();
        if (searchInput) searchInput.value = "";
        currentFilter = "all";
        chips.forEach(function (c) { c.classList.remove("on"); });
        if (chips[0]) chips[0].classList.add("on");
        applyFilters();
      });
    }

    if (viewToggle) {
      var viewButtons = viewToggle.querySelectorAll("button");
      viewButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          viewButtons.forEach(function (b) { b.classList.remove("on"); });
          btn.classList.add("on");
          var showTable = btn.dataset.view === "table";
          grid.hidden = showTable;
          if (noResults) noResults.hidden = showTable ? true : noResults.hidden;
          if (tableHeading) tableHeading.hidden = !showTable;
          if (tableWrap) tableWrap.hidden = !showTable;
          if (tableNote) tableNote.hidden = !showTable;
          applyFilters();
        });
      });
    }

    if (table) {
      var headers = table.querySelectorAll("th.sortable");
      headers.forEach(function (th) {
        th.addEventListener("click", function () {
          var col = Number(th.dataset.col);
          var tbody = table.querySelector("tbody");
          var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
          var asc = !th.classList.contains("sort-asc");
          headers.forEach(function (h) { h.classList.remove("sort-asc", "sort-desc"); });
          th.classList.add(asc ? "sort-asc" : "sort-desc");
          rows.sort(function (a, b) {
            var av = a.children[col].textContent.trim().toLowerCase();
            var bv = b.children[col].textContent.trim().toLowerCase();
            if (av < bv) return asc ? -1 : 1;
            if (av > bv) return asc ? 1 : -1;
            return 0;
          });
          rows.forEach(function (row) { tbody.appendChild(row); });
        });
      });
    }
  }

  /* ---------- Blog sidebar: locale → country hubs ---------- */
  (function initGeoHub() {
    var card = document.querySelector("[data-geo-card]");
    if (!card) return;

    var MARKETS = [
      { slug: "uk", name: "United Kingdom", flag: "gb", tz: ["Europe/London"], lang: ["en-GB"] },
      { slug: "ireland", name: "Ireland", flag: "ie", tz: ["Europe/Dublin"], lang: ["en-IE"] },
      { slug: "malta", name: "Malta", flag: "mt", tz: ["Europe/Malta"], lang: ["mt", "en-MT"] },
      { slug: "estonia", name: "Estonia", flag: "ee", tz: ["Europe/Tallinn"], lang: ["et", "et-EE"] },
      { slug: "singapore", name: "Singapore", flag: "sg", tz: ["Asia/Singapore"], lang: ["en-SG", "zh-SG"] },
    ];

    function detectMarket() {
      var tz = "";
      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      } catch (e) {}
      var langs = [];
      if (navigator.languages && navigator.languages.length) {
        langs = Array.prototype.slice.call(navigator.languages);
      } else if (navigator.language) {
        langs = [navigator.language];
      }

      var i, m, j;
      for (i = 0; i < MARKETS.length; i++) {
        m = MARKETS[i];
        if (m.tz.indexOf(tz) !== -1) return m;
      }
      for (i = 0; i < MARKETS.length; i++) {
        m = MARKETS[i];
        for (j = 0; j < langs.length; j++) {
          var lang = (langs[j] || "").toLowerCase();
          if (m.lang.some(function (code) { return lang === code.toLowerCase() || lang.indexOf(code.toLowerCase()) === 0; })) {
            return m;
          }
        }
      }
      return MARKETS[0];
    }

    var market = detectMarket();
    var flagEl = card.querySelector("[data-geo-flag]");
    var nameEl = card.querySelector("[data-geo-name]");
    var chips = card.querySelector("[data-geo-chips]");
    var guide = card.querySelector("[data-geo-guide]");

    if (flagEl) flagEl.className = "fi fi-" + market.flag;
    if (nameEl) nameEl.textContent = market.name;
    if (guide) {
      guide.href = "/countries/" + market.slug + "/";
      guide.textContent = "View " + market.name + " guide";
    }
    if (chips) {
      chips.innerHTML =
        '<a href="/countries/' + market.slug + '/eor/">EOR</a>' +
        '<a href="/countries/' + market.slug + '/global-payroll/">Payroll</a>' +
        '<a href="/countries/' + market.slug + '/entity-formation/">Entity</a>' +
        '<a href="/countries/' + market.slug + '/peo/">PEO</a>';
    }
    card.hidden = false;
  })();

  /* ---------- Partner hub: lens filters + cards/matrix layout toggle ---------- */
  (function initPartnerHub() {
    var root = document.querySelector("[data-partner-hub]");
    if (!root) return;

    var state = { service: "all", region: "all", focus: "all" };
    var labels = {
      service: { all: "All services", eor: "EOR", peo: "PEO", payroll: "Global Payroll", compliance: "Compliance" },
      region: { all: "Anywhere", global: "Global", europe: "Europe" },
      focus: { all: "Any size", enterprise: "Enterprise", "mid-market": "Mid-market" },
    };
    var cardsWrap = root.querySelector("[data-partner-cards]");
    var matrixWrap = root.querySelector("[data-partner-matrix]");
    var emptyEl = root.querySelector("[data-partner-empty]");
    var countEl = root.querySelector("[data-partner-count]");
    var viewToggle = root.querySelector("[data-partner-view]");
    var recipeEl = root.querySelector("[data-partner-recipe]");
    var clearBtn = root.querySelector("[data-partner-reset]");

    function matchAttrs(el) {
      var services = (el.getAttribute("data-services") || "").split(",");
      var regions = (el.getAttribute("data-regions") || "").split(",");
      var focus = (el.getAttribute("data-focus") || "").split(",");
      if (state.service !== "all" && services.indexOf(state.service) === -1) return false;
      if (state.region !== "all" && regions.indexOf(state.region) === -1) return false;
      if (state.focus !== "all" && focus.indexOf(state.focus) === -1) return false;
      return true;
    }

    function updateRecipe() {
      if (!recipeEl || !clearBtn) return;
      var active = [];
      ["service", "region", "focus"].forEach(function (key) {
        if (state[key] === "all") return;
        active.push({ key: key, value: state[key], label: labels[key][state[key]] || state[key] });
      });
      recipeEl.hidden = active.length === 0;
      clearBtn.hidden = active.length === 0;
      recipeEl.innerHTML = active
        .map(function (item) {
          return (
            '<span class="recipe-tag">' +
            item.label +
            ' <button type="button" data-clear-key="' +
            item.key +
            '" aria-label="Remove ' +
            item.label +
            '">×</button></span>'
          );
        })
        .join("");
    }

    function apply() {
      var seen = {};

      root.querySelectorAll(".partner-hub-card").forEach(function (card) {
        var ok = matchAttrs(card);
        card.hidden = !ok;
        if (ok) seen[card.getAttribute("data-name")] = 1;
      });

      var colMap = {};
      root.querySelectorAll("[data-partner-col]").forEach(function (cell) {
        var slug = cell.getAttribute("data-partner-col");
        if (!colMap[slug]) colMap[slug] = { ok: matchAttrs(cell), cells: [] };
        colMap[slug].cells.push(cell);
      });
      Object.keys(colMap).forEach(function (slug) {
        var entry = colMap[slug];
        entry.cells.forEach(function (cell) {
          cell.hidden = !entry.ok;
        });
        if (entry.ok) {
          var name = entry.cells[0].getAttribute("data-name");
          if (name) seen[name] = 1;
        }
      });

      var n = Object.keys(seen).length;
      if (countEl) countEl.textContent = n + " partner" + (n === 1 ? "" : "s");
      if (emptyEl) emptyEl.hidden = n > 0;
      updateRecipe();
    }

    function setGroupValue(key, value) {
      state[key] = value;
      var group = root.querySelector('[data-filter-group="' + key + '"]');
      if (group) {
        group.querySelectorAll("[data-filter]").forEach(function (c) {
          c.classList.toggle("on", c.getAttribute("data-filter") === value);
        });
      }
      apply();
    }

    function setView(view) {
      root.setAttribute("data-view", view);
      if (cardsWrap) cardsWrap.hidden = view !== "cards";
      if (matrixWrap) matrixWrap.hidden = view !== "matrix";
      if (viewToggle) {
        viewToggle.querySelectorAll("[data-view]").forEach(function (b) {
          var on = b.getAttribute("data-view") === view;
          b.classList.toggle("on", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
      }
      if (view === "matrix") syncSiteHeadOffset();
    }

    root.querySelectorAll("[data-filter-group]").forEach(function (group) {
      var key = group.getAttribute("data-filter-group");
      group.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-filter]");
        if (!btn || !group.contains(btn)) return;
        setGroupValue(key, btn.getAttribute("data-filter"));
      });
    });

    if (recipeEl) {
      recipeEl.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-clear-key]");
        if (!btn) return;
        setGroupValue(btn.getAttribute("data-clear-key"), "all");
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        setGroupValue("service", "all");
        setGroupValue("region", "all");
        setGroupValue("focus", "all");
      });
    }

    if (viewToggle) {
      viewToggle.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-view]");
        if (!btn) return;
        setView(btn.getAttribute("data-view"));
      });
    }

    setView(root.getAttribute("data-view") || "cards");
    apply();
  })();
})();
