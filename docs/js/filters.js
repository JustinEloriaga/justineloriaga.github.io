(function () {
  var chips = document.querySelectorAll(".chip");
  if (!chips.length) return;
  var papers = document.querySelectorAll(".paper");
  var groups = document.querySelectorAll(".group");
  var empty = document.getElementById("emptyMsg");

  function apply(filter) {
    var anyVisible = false;
    papers.forEach(function (p) {
      p.hidden = !(filter === "all" || p.dataset.status === filter);
    });
    groups.forEach(function (g) {
      var visible = g.querySelectorAll(".paper:not([hidden])").length;
      g.hidden = visible === 0;
      if (visible) anyVisible = true;
    });
    if (empty) empty.style.display = anyVisible ? "none" : "block";
  }

  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      chips.forEach(function (o) {
        o.setAttribute("aria-pressed", o === c ? "true" : "false");
      });
      apply(c.dataset.filter);
    });
  });
})();
