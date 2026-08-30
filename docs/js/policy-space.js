/* Policy space dashboard — Room to Respond.
 *
 * Reads /files/policy-space.csv with header: iso3,country,year,pbi,esi
 * Missing values may be blank. If the file is absent the page shows an empty
 * state rather than a chart, because there is nothing honest to draw.
 *
 * No runtime dependencies. Country outlines come from js/world-paths.js.
 */
(function () {
  var root = document.getElementById("ps");
  if (!root) return;

  var MAX_SELECTED = 8;

  /* Palette lives in CSS (--ps-r0..r6 for the choropleth ramp, --ps-c0..c7 for
     the series) so light and dark are defined in one place. Quarto's theme
     toggle sets no body class — it swaps stylesheets and puts .alternate on the
     toggle element — so we re-read the variables whenever that class changes. */
  var palette = null;
  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function getPalette() {
    if (palette) return palette;
    var ramp = [], lines = [], i;
    for (i = 0; i < 7; i++) ramp.push(css("--ps-r" + i, "#9CBFD5"));
    for (i = 0; i < 8; i++) lines.push(css("--ps-c" + i, "#1D4E6F"));
    palette = { ramp: ramp, lines: lines };
    return palette;
  }
  function lineColor(k) { return getPalette().lines[k % 8]; }

  function watchTheme() {
    var t = document.querySelector(".quarto-color-scheme-toggle");
    if (!t || !window.MutationObserver) return;
    new MutationObserver(function () {
      palette = null;                  // stylesheet has swapped; re-read
      if (state.data) render();
    }).observe(t, { attributes: true, attributeFilter: ["class"] });
  }

  var state = {
    index: "pbi",
    selected: [],
    yearMin: null, yearMax: null,
    y0: null, y1: null,
    mapYear: null,
    data: null,          // iso3 -> {name, byYear: {year: {pbi, esi}}}
    years: []
  };

  var el = {
    empty:    document.getElementById("ps-empty"),
    app:      document.getElementById("ps-app"),
    map:      document.getElementById("ps-map"),
    chart:    document.getElementById("ps-chart"),
    chips:    document.getElementById("ps-chips"),
    picker:   document.getElementById("ps-picker"),
    search:   document.getElementById("ps-search"),
    tip:      document.getElementById("ps-tip"),
    mapYear:  document.getElementById("ps-mapyear"),
    mapYearL: document.getElementById("ps-mapyear-label"),
    y0:       document.getElementById("ps-y0"),
    y1:       document.getElementById("ps-y1"),
    rangeL:   document.getElementById("ps-range-label"),
    legend:   document.getElementById("ps-legend"),
    count:    document.getElementById("ps-count"),
    reset:    document.getElementById("ps-reset")
  };

  /* ---------- data ---------------------------------------------------- */

  function parseCSV(text) {
    var lines = text.trim().split(/\r?\n/);
    var head = lines[0].split(",").map(function (h) { return h.trim().toLowerCase(); });
    var ix = {
      iso3: head.indexOf("iso3"), country: head.indexOf("country"),
      year: head.indexOf("year"), pbi: head.indexOf("pbi"), esi: head.indexOf("esi")
    };
    if (ix.iso3 < 0 || ix.year < 0) throw new Error("csv needs iso3 and year columns");

    var byIso = {}, years = {};
    for (var i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      var c = lines[i].split(",");
      var iso = (c[ix.iso3] || "").trim().toUpperCase();
      var yr = parseInt(c[ix.year], 10);
      if (!iso || !isFinite(yr)) continue;

      var pbi = ix.pbi >= 0 ? parseFloat(c[ix.pbi]) : NaN;
      var esi = ix.esi >= 0 ? parseFloat(c[ix.esi]) : NaN;
      if (!isFinite(pbi) && !isFinite(esi)) continue;

      if (!byIso[iso]) {
        byIso[iso] = {
          name: (ix.country >= 0 && c[ix.country] ? c[ix.country].trim() : iso),
          byYear: {}
        };
      }
      byIso[iso].byYear[yr] = {
        pbi: isFinite(pbi) ? pbi : null,
        esi: isFinite(esi) ? esi : null
      };
      years[yr] = 1;
    }
    var ys = Object.keys(years).map(Number).sort(function (a, b) { return a - b; });
    return { byIso: byIso, years: ys };
  }

  function defaultStartYear(parsed) {
    var perYear = {}, iso, y;
    for (iso in parsed.byIso) {
      for (y in parsed.byIso[iso].byYear) perYear[y] = (perYear[y] || 0) + 1;
    }
    var peak = 0, k;
    for (k in perYear) if (perYear[k] > peak) peak = perYear[k];
    var need = peak * 0.5;
    for (var i = 0; i < parsed.years.length; i++) {
      if (perYear[parsed.years[i]] >= need) return parsed.years[i];
    }
    return parsed.years[0];
  }

  function valueAt(iso, year, which) {
    var c = state.data[iso];
    if (!c) return null;
    var r = c.byYear[year];
    return r ? r[which] : null;
  }

  /* ---------- colour scale -------------------------------------------- */
  /* Both indices are within-year percentiles, so the domain is fixed at
     0-100 and colours are comparable across years and across the two
     indices without renormalising. */

  function colorFor(v) {
    if (v === null || v === undefined || !isFinite(v)) return null;
    var ramp = getPalette().ramp;
    var t = Math.max(0, Math.min(100, v)) / 100;
    return ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))];
  }

  /* ---------- map ------------------------------------------------------ */

  function buildMap() {
    var W = 1000, H = 520;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="ps-map-svg" role="img" '
            + 'aria-label="World map of the selected index. Click a country to add it to the comparison.">';
    var P = window.WORLD_PATHS || {};
    for (var iso in P) {
      svg += '<path d="' + P[iso].d + '" data-iso="' + iso + '" '
           + 'tabindex="0" role="button" aria-label="' + P[iso].n.replace(/"/g, "") + '"></path>';
    }
    svg += "</svg>";
    el.map.innerHTML = svg;

    el.map.addEventListener("click", function (e) {
      var p = e.target.closest("path[data-iso]");
      if (p) toggle(p.dataset.iso);
    });
    el.map.addEventListener("keydown", function (e) {
      var p = e.target.closest && e.target.closest("path[data-iso]");
      if (p && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(p.dataset.iso); }
    });
    el.map.addEventListener("mousemove", function (e) {
      var p = e.target.closest("path[data-iso]");
      if (!p) { el.tip.hidden = true; return; }
      var iso = p.dataset.iso;
      var v = valueAt(iso, state.mapYear, state.index);
      var nm = (state.data[iso] && state.data[iso].name) || (window.WORLD_PATHS[iso] || {}).n || iso;
      el.tip.hidden = false;
      el.tip.innerHTML = "<strong>" + nm + "</strong>"
        + (v === null ? "<span class='ps-nodata'>no data</span>"
                      : "<span>" + state.index.toUpperCase() + " " + v.toFixed(1) + "</span>");
      var r = el.map.getBoundingClientRect();
      el.tip.style.left = (e.clientX - r.left + 14) + "px";
      el.tip.style.top  = (e.clientY - r.top + 14) + "px";
    });
    el.map.addEventListener("mouseleave", function () { el.tip.hidden = true; });
  }

  function paintMap() {
    var paths = el.map.querySelectorAll("path[data-iso]");
    for (var i = 0; i < paths.length; i++) {
      var p = paths[i], iso = p.dataset.iso;
      var v = valueAt(iso, state.mapYear, state.index);
      var c = colorFor(v);
      p.setAttribute("fill", c || "var(--ps-nodata)");
      p.classList.toggle("ps-sel", state.selected.indexOf(iso) > -1);
      p.classList.toggle("ps-has", c !== null);
    }
  }

  /* ---------- chart ---------------------------------------------------- */

  function drawChart() {
    var W = 940, H = 420, m = { t: 18, r: 20, b: 40, l: 52 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var years = state.years.filter(function (y) { return y >= state.y0 && y <= state.y1; });

    if (!state.selected.length) {
      el.chart.innerHTML = '<p class="ps-hint">Choose one or more countries — click them on the map, '
        + 'or use the search box — to plot the ' + state.index.toUpperCase() + ' over time.</p>';
      return;
    }
    if (years.length < 2) {
      el.chart.innerHTML = '<p class="ps-hint">The selected range covers fewer than two years with data, '
        + 'so there is no series to draw. Widen the range.</p>';
      return;
    }

    var x = function (y) { return m.l + (y - years[0]) / (years[years.length - 1] - years[0]) * iw; };
    var yy = function (v) { return m.t + ih - (v / 100) * ih; };

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="ps-chart-svg" role="img" aria-label="'
          + state.index.toUpperCase() + ' over time for the selected countries.">';

    // gridlines + y axis
    for (var g = 0; g <= 100; g += 25) {
      s += '<line class="ps-grid" x1="' + m.l + '" x2="' + (m.l + iw) + '" y1="' + yy(g) + '" y2="' + yy(g) + '"/>';
      s += '<text class="ps-axis" x="' + (m.l - 10) + '" y="' + (yy(g) + 4) + '" text-anchor="end">' + g + '</text>';
    }
    // x axis ticks — at most 10, on round years
    var span = years[years.length - 1] - years[0];
    var step = Math.max(1, Math.ceil(span / 9));
    for (var ty = years[0]; ty <= years[years.length - 1]; ty += step) {
      s += '<text class="ps-axis" x="' + x(ty) + '" y="' + (m.t + ih + 24) + '" text-anchor="middle">' + ty + '</text>';
    }

    // one line per selected country; gaps break the path rather than interpolating
    state.selected.forEach(function (iso, k) {
      var col = lineColor(k);
      var d = "", pen = false, pts = 0;
      years.forEach(function (y) {
        var v = valueAt(iso, y, state.index);
        if (v === null) { pen = false; return; }
        d += (pen ? "L" : "M") + x(y).toFixed(1) + " " + yy(v).toFixed(1);
        pen = true; pts++;
      });
      if (pts === 1) {
        years.forEach(function (y) {
          var v = valueAt(iso, y, state.index);
          if (v !== null) s += '<circle cx="' + x(y) + '" cy="' + yy(v) + '" r="3.5" fill="' + col + '"/>';
        });
      }
      if (d) s += '<path class="ps-line" d="' + d + '" stroke="' + col + '"/>';
    });

    s += "</svg>";
    el.chart.innerHTML = s;

    el.legend.innerHTML = state.selected.map(function (iso, k) {
      var nm = (state.data[iso] && state.data[iso].name) || iso;
      return '<span class="ps-key"><i style="background:' + lineColor(k) + '"></i>' + nm + '</span>';
    }).join("");
  }

  /* ---------- selection ------------------------------------------------ */

  function toggle(iso) {
    if (!state.data[iso]) return;              // never select a country we have no data for
    var i = state.selected.indexOf(iso);
    if (i > -1) state.selected.splice(i, 1);
    else {
      if (state.selected.length >= MAX_SELECTED) return;
      state.selected.push(iso);
    }
    render();
  }

  function drawChips() {
    if (!state.selected.length) {
      el.chips.innerHTML = '<span class="ps-hint-sm">Nothing selected</span>';
    } else {
      el.chips.innerHTML = state.selected.map(function (iso, k) {
        var nm = (state.data[iso] && state.data[iso].name) || iso;
        return '<button class="ps-chip" data-iso="' + iso + '" aria-label="Remove ' + nm + '">'
             + '<i style="background:' + lineColor(k) + '"></i>' + nm + ' &times;</button>';
      }).join("");
    }
    el.count.textContent = state.selected.length + " of " + MAX_SELECTED + " selected";
  }

  function drawPicker(filter) {
    var q = (filter || "").toLowerCase();
    var rows = Object.keys(state.data).map(function (iso) {
      return { iso: iso, name: state.data[iso].name };
    }).filter(function (r) {
      return !q || r.name.toLowerCase().indexOf(q) > -1 || r.iso.toLowerCase().indexOf(q) > -1;
    }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });

    el.picker.innerHTML = rows.length
      ? rows.map(function (r) {
          var on = state.selected.indexOf(r.iso) > -1;
          return '<li><button data-iso="' + r.iso + '" aria-pressed="' + on + '">'
               + r.name + '</button></li>';
        }).join("")
      : '<li class="ps-hint-sm">No country matches that.</li>';
  }

  /* ---------- wiring --------------------------------------------------- */

  function render() {
    paintMap(); drawChart(); drawChips(); drawPicker(el.search.value);
    el.rangeL.textContent = state.y0 + " – " + state.y1;
    el.mapYearL.textContent = state.mapYear;
  }

  function wire() {
    root.querySelectorAll("[data-index]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.index = b.dataset.index;
        root.querySelectorAll("[data-index]").forEach(function (o) {
          o.setAttribute("aria-pressed", o === b ? "true" : "false");
        });
        render();
      });
    });

    el.chips.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-iso]"); if (b) toggle(b.dataset.iso);
    });
    el.picker.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-iso]"); if (b) toggle(b.dataset.iso);
    });
    el.search.addEventListener("input", function () { drawPicker(el.search.value); });

    function clampRange() {
      state.y0 = Math.min(+el.y0.value, +el.y1.value);
      state.y1 = Math.max(+el.y0.value, +el.y1.value);
      if (state.mapYear < state.y0) state.mapYear = state.y0;
      if (state.mapYear > state.y1) state.mapYear = state.y1;
      el.mapYear.min = state.y0; el.mapYear.max = state.y1;
      el.mapYear.value = state.mapYear;
      render();
    }
    el.y0.addEventListener("input", clampRange);
    el.y1.addEventListener("input", clampRange);
    el.mapYear.addEventListener("input", function () {
      state.mapYear = +el.mapYear.value; render();
    });
    el.reset.addEventListener("click", function () {
      state.selected = [];
      state.y0 = state.defaultY0; state.y1 = state.yearMax;
      state.mapYear = state.yearMax;
      el.y0.value = state.y0; el.y1.value = state.y1;
      el.mapYear.min = state.y0; el.mapYear.max = state.y1; el.mapYear.value = state.mapYear;
      el.search.value = "";
      render();
    });
  }

  /* ---------- boot ----------------------------------------------------- */

  fetch("/files/policy-space.csv", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (text) {
      var parsed = parseCSV(text);
      if (!parsed.years.length) throw new Error("no usable rows");

      state.data = parsed.byIso;
      state.years = parsed.years;
      state.yearMin = parsed.years[0];
      state.yearMax = parsed.years[parsed.years.length - 1];
      state.mapYear = state.yearMax;

      /* The panel reaches back to the 1870s, but a percentile computed among a
         dozen reporting countries is not comparable to one computed among 174.
         Open on the first year where coverage reaches half its peak, which lands
         on 1971 for this panel — the era the paper works in, and the start of
         the ESI's training window. The slider still reaches the full range. */
      state.defaultY0 = state.y0 = defaultStartYear(parsed);
      state.y1 = state.yearMax;

      [el.y0, el.y1, el.mapYear].forEach(function (inp) {
        inp.min = state.yearMin; inp.max = state.yearMax;
      });
      el.y0.value = state.y0; el.y1.value = state.y1;
      el.mapYear.value = state.mapYear;

      el.empty.hidden = true;
      el.app.hidden = false;

      buildMap(); wire(); watchTheme(); render();
    })
    .catch(function () {
      el.empty.hidden = false;
      el.app.hidden = true;
    });
})();
