(function () {
  var q = document.getElementById("plq");
  if (!q) return;

  var list    = document.getElementById("pllist");
  var empty   = document.getElementById("plempty");
  var counter = document.getElementById("plcount");
  var chips   = document.querySelectorAll(".chip[data-topic]");
  var cards   = Array.prototype.slice.call(list.querySelectorAll(".pl"));
  var topic   = "all";

  // Cache each card's searchable text and its video <li> nodes once.
  cards.forEach(function (c) {
    c._title  = c.querySelector("h3").textContent.toLowerCase();
    c._blurb  = (c.querySelector(".pl-blurb") || {}).textContent || "";
    c._blurb  = c._blurb.toLowerCase();
    c._items  = Array.prototype.slice.call(c.querySelectorAll("ol li"));
    c._items.forEach(function (li) { li._t = li.textContent.toLowerCase(); });
    c._details = c.querySelector("details");
  });

  var totalVideos = cards.reduce(function (n, c) { return n + c._items.length; }, 0);

  function apply() {
    var term = q.value.trim().toLowerCase();
    var shownPl = 0, shownVid = 0;

    cards.forEach(function (c) {
      var topicOk = topic === "all" || c.dataset.topic === topic;
      if (!topicOk) { c.hidden = true; return; }

      if (!term) {
        c.hidden = false;
        c._items.forEach(function (li) { li.hidden = false; });
        c._details.open = false;
        c.classList.remove("hit");
        shownPl++; shownVid += c._items.length;
        return;
      }

      var titleHit = c._title.indexOf(term) > -1 || c._blurb.indexOf(term) > -1;
      var matches  = c._items.filter(function (li) { return li._t.indexOf(term) > -1; });

      if (titleHit) {
        // Whole playlist matches — show every video in it.
        c._items.forEach(function (li) { li.hidden = false; });
        shownVid += c._items.length;
      } else if (matches.length) {
        c._items.forEach(function (li) { li.hidden = li._t.indexOf(term) === -1; });
        shownVid += matches.length;
      } else {
        c.hidden = true;
        return;
      }

      c.hidden = false;
      c.classList.add("hit");
      // Open the video list automatically so matches are visible.
      c._details.open = true;
      shownPl++;
    });

    empty.style.display = shownPl ? "none" : "block";

    if (!term && topic === "all") {
      counter.textContent = totalVideos + " videos in " + cards.length + " playlists";
    } else {
      counter.textContent =
        shownVid + (shownVid === 1 ? " video" : " videos") + " in " +
        shownPl + (shownPl === 1 ? " playlist" : " playlists");
    }
  }

  var t;
  q.addEventListener("input", function () {
    clearTimeout(t);
    t = setTimeout(apply, 90);
  });
  q.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { q.value = ""; apply(); }
  });

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      topic = chip.dataset.topic;
      chips.forEach(function (o) {
        o.setAttribute("aria-pressed", o === chip ? "true" : "false");
      });
      apply();
    });
  });

  apply();
})();
