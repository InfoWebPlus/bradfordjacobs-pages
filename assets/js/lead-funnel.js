(function () {
  "use strict";

  var WA_E164 = "35627782880"; /* Malta office — change when ready */
  var EXIT_DWELL_MS = 45000;
  var STORAGE_LEADS = "bj_leads";
  var SESSION_EXIT = "bj_exit_shown";
  var SESSION_SUBMITTED = "bj_lead_submitted";

  var INTENTS = {
    guide: {
      eyebrow: "Free resource",
      title: "Get the hiring checklist",
      sub: "A short one-pager on EOR vs entity — sent to your work email.",
      submit: "Get the guide",
      fields: [
        { name: "name", label: "Name (optional)", type: "text", required: false, placeholder: "Jane Smith" },
        { name: "email", label: "Work email", type: "email", required: true, placeholder: "jane@company.com", autocomplete: "email" }
      ]
    },
    quote: {
      eyebrow: "Free comparison",
      title: "Get a free comparison",
      sub: "Tell us where you want to hire — we map EOR, PEO, and entity options with real cost.",
      submit: "Request comparison",
      fields: [
        { name: "name", label: "Full name", type: "text", required: true, placeholder: "Jane Smith", autocomplete: "name" },
        { name: "email", label: "Work email", type: "email", required: true, placeholder: "jane@company.com", autocomplete: "email" },
        { name: "countries", label: "Where do you want to hire?", type: "text", required: true, placeholder: "e.g. UK, Singapore" },
        { name: "headcount", label: "Approx. headcount", type: "text", required: false, placeholder: "e.g. 3–10" },
        { name: "message", label: "Anything else? (optional)", type: "textarea", required: false, placeholder: "Timeline, roles, constraints…" }
      ]
    },
    partner: {
      eyebrow: "Partner enquiry",
      title: "Ask about this partner",
      sub: "Independent advice on fit, coverage, and commercial terms — we don’t push a single vendor.",
      submit: "Send enquiry",
      fields: [
        { name: "name", label: "Full name", type: "text", required: true, placeholder: "Jane Smith", autocomplete: "name" },
        { name: "email", label: "Work email", type: "email", required: true, placeholder: "jane@company.com", autocomplete: "email" },
        { name: "message", label: "What do you want to know?", type: "textarea", required: true, placeholder: "Markets, headcount, timeline…" }
      ]
    },
    call: {
      eyebrow: "Book a call",
      title: "Book a scoping call",
      sub: "A short call with an advisor — no hard sell, just the right model for your markets.",
      submit: "Request a call",
      fields: [
        { name: "name", label: "Full name", type: "text", required: true, placeholder: "Jane Smith", autocomplete: "name" },
        { name: "email", label: "Work email", type: "email", required: true, placeholder: "jane@company.com", autocomplete: "email" },
        { name: "phone", label: "Phone", type: "tel", required: true, placeholder: "+44 …", autocomplete: "tel" },
        {
          name: "window",
          label: "Preferred window",
          type: "select",
          required: false,
          options: [
            { value: "", label: "No preference" },
            { value: "morning", label: "Morning (local)" },
            { value: "afternoon", label: "Afternoon (local)" },
            { value: "asap", label: "ASAP" }
          ]
        }
      ]
    }
  };

  var overlay = document.getElementById("leadOverlay");
  var modal = document.getElementById("leadModal");
  var form = document.getElementById("leadForm");
  var fieldsEl = document.getElementById("leadFields");
  var successEl = document.getElementById("leadSuccess");
  var exitEl = document.getElementById("leadExit");
  var exitForm = document.getElementById("leadExitForm");
  var exitSuccess = document.getElementById("leadExitSuccess");
  var waFloat = document.getElementById("waFloat");

  if (!modal || !form) return;

  function pageTitle() {
    var h1 = document.querySelector("h1");
    return (h1 && h1.textContent.trim()) || document.title || "your site";
  }

  function utmString() {
    try {
      var p = new URLSearchParams(window.location.search);
      var keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
      var parts = [];
      keys.forEach(function (k) {
        var v = p.get(k);
        if (v) parts.push(k + "=" + v);
      });
      return parts.join("&");
    } catch (e) {
      return "";
    }
  }

  function storeLead(payload) {
    var list = [];
    try {
      list = JSON.parse(localStorage.getItem(STORAGE_LEADS) || "[]");
      if (!Array.isArray(list)) list = [];
    } catch (e) {
      list = [];
    }
    list.push(payload);
    try {
      localStorage.setItem(STORAGE_LEADS, JSON.stringify(list.slice(-50)));
      sessionStorage.setItem(SESSION_SUBMITTED, "1");
    } catch (e2) {}
  }

  function formDataToObject(f) {
    var data = {};
    new FormData(f).forEach(function (v, k) {
      data[k] = typeof v === "string" ? v.trim() : v;
    });
    return data;
  }

  function buildFields(intentKey, prefs) {
    var cfg = INTENTS[intentKey] || INTENTS.quote;
    var html = "";
    cfg.fields.forEach(function (f) {
      var id = "lead_" + f.name;
      var val = "";
      if (f.name === "countries" && prefs.country) val = prefs.country;
      html += '<div class="lead-field">';
      html += '<label for="' + id + '">' + f.label + "</label>";
      if (f.type === "textarea") {
        html +=
          '<textarea id="' +
          id +
          '" name="' +
          f.name +
          '" rows="2" placeholder="' +
          (f.placeholder || "") +
          '"' +
          (f.required ? " required" : "") +
          ">" +
          val +
          "</textarea>";
      } else if (f.type === "select") {
        html += '<select id="' + id + '" name="' + f.name + '"' + (f.required ? " required" : "") + ">";
        (f.options || []).forEach(function (o) {
          html += '<option value="' + o.value + '">' + o.label + "</option>";
        });
        html += "</select>";
      } else {
        html +=
          '<input id="' +
          id +
          '" type="' +
          f.type +
          '" name="' +
          f.name +
          '" placeholder="' +
          (f.placeholder || "") +
          '" value="' +
          val.replace(/"/g, "&quot;") +
          '"' +
          (f.autocomplete ? ' autocomplete="' + f.autocomplete + '"' : "") +
          (f.required ? " required" : "") +
          ">";
      }
      html += "</div>";
    });
    fieldsEl.innerHTML = html;
  }

  function openModal(intentKey, prefs) {
    prefs = prefs || {};
    var key = INTENTS[intentKey] ? intentKey : "quote";
    var cfg = INTENTS[key];

    document.getElementById("leadModalEyebrow").textContent = cfg.eyebrow;
    document.getElementById("leadModalTitle").textContent =
      key === "partner" && prefs.partnerLabel
        ? "Ask about " + prefs.partnerLabel
        : cfg.title;
    document.getElementById("leadModalSub").textContent = cfg.sub;
    document.getElementById("leadSubmit").textContent = cfg.submit;
    document.getElementById("leadIntent").value = key;
    document.getElementById("leadPage").value = location.pathname;
    document.getElementById("leadPartner").value = prefs.partner || "";
    document.getElementById("leadService").value = prefs.service || "";
    document.getElementById("leadUtm").value = utmString();

    buildFields(key, prefs);
    form.hidden = false;
    successEl.hidden = true;
    closeExit(true);

    overlay.hidden = false;
    modal.hidden = false;
    document.body.classList.add("lead-open");
    var first = fieldsEl.querySelector("input, textarea, select");
    if (first) setTimeout(function () { first.focus(); }, 50);
  }

  function closeModal() {
    modal.hidden = true;
    if (!exitEl || exitEl.hidden) {
      overlay.hidden = true;
      document.body.classList.remove("lead-open");
    }
  }

  function openExit() {
    if (!exitEl) return;
    if (sessionStorage.getItem(SESSION_EXIT) || sessionStorage.getItem(SESSION_SUBMITTED)) return;
    if (!modal.hidden) return;
    sessionStorage.setItem(SESSION_EXIT, "1");
    exitForm.hidden = false;
    if (exitSuccess) exitSuccess.hidden = true;
    overlay.hidden = false;
    exitEl.hidden = false;
    document.body.classList.add("lead-open");
  }

  function closeExit(skipOverlay) {
    if (!exitEl) return;
    exitEl.hidden = true;
    if (!skipOverlay && modal.hidden) {
      overlay.hidden = true;
      document.body.classList.remove("lead-open");
    }
  }

  function handleSubmit(f, onSuccess) {
    if (!f.checkValidity()) {
      f.reportValidity();
      return;
    }
    var data = formDataToObject(f);
    data.ts = new Date().toISOString();
    data.page = data.page || location.pathname;
    data.title = pageTitle();
    storeLead(data);
    onSuccess();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    handleSubmit(form, function () {
      form.hidden = true;
      successEl.hidden = false;
      setTimeout(closeModal, 2200);
    });
  });

  if (exitForm) {
    exitForm.addEventListener("submit", function (e) {
      e.preventDefault();
      handleSubmit(exitForm, function () {
        exitForm.hidden = true;
        if (exitSuccess) exitSuccess.hidden = false;
        setTimeout(function () { closeExit(false); }, 2200);
      });
    });
  }

  document.addEventListener("click", function (e) {
    var openBtn = e.target.closest("[data-lead-open]");
    if (openBtn) {
      e.preventDefault();
      openModal(openBtn.getAttribute("data-lead-open"), {
        partner: openBtn.getAttribute("data-lead-partner") || "",
        partnerLabel: openBtn.getAttribute("data-lead-partner-label") || "",
        country: openBtn.getAttribute("data-lead-country") || "",
        service: openBtn.getAttribute("data-lead-service") || ""
      });
      return;
    }
    if (e.target.closest("[data-lead-close]")) {
      closeModal();
      return;
    }
    if (e.target.closest("[data-lead-exit-close]")) {
      closeExit(false);
      return;
    }
    if (e.target === overlay || e.target === modal || e.target === exitEl) {
      if (!modal.hidden) closeModal();
      else closeExit(false);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!modal.hidden) closeModal();
      else closeExit(false);
    }
  });

  /* WhatsApp float */
  if (waFloat) {
    var msg =
      "Hi Bradford Jacobs — I'm looking at \"" +
      pageTitle() +
      "\". Can you help with EOR/payroll options?";
    waFloat.href =
      "https://wa.me/" + WA_E164 + "?text=" + encodeURIComponent(msg);
  }

  /* Soft exit / dwell popup */
  var exitArmed = false;
  function armExit() {
    if (exitArmed) return;
    exitArmed = true;
    setTimeout(openExit, EXIT_DWELL_MS);
    document.addEventListener("mouseout", function (ev) {
      if (ev.clientY > 0) return;
      if (ev.relatedTarget || ev.toElement) return;
      openExit();
    });
  }
  if (document.readyState === "complete") armExit();
  else window.addEventListener("load", armExit);

  window.BJLead = { open: openModal, close: closeModal };

  /* Full contact page form */
  var contactForm = document.getElementById("contactPageForm");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!contactForm.checkValidity()) {
        contactForm.reportValidity();
        return;
      }
      var data = formDataToObject(contactForm);
      data.ts = new Date().toISOString();
      data.page = location.pathname;
      data.title = pageTitle();
      storeLead(data);
      var thanks = document.getElementById("contactFormThanks");
      var note = document.getElementById("contactFormNote");
      if (thanks) thanks.hidden = false;
      if (note) note.textContent = "Demo saved locally — CRM wiring comes later.";
      contactForm.reset();
    });
  }
})();
