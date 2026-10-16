/* Unlock script for the policymaker uncertainty dashboard.
 *
 * The dashboard (markup, app and data) is published only as /files/pmu-locked.json: gzip-compressed
 * and encrypted with AES-256-GCM under a key derived from a passphrase with PBKDF2-HMAC-SHA256.
 * This script derives the same key with WebCrypto, decrypts in the browser, inflates the bundle and
 * injects it below the lock card. Nothing leaves the browser. The passphrase is kept in
 * sessionStorage so a reload in the same tab does not ask again; closing the tab forgets it.
 */
(function () {
  var lock = document.getElementById("pmu-lock");
  if (!lock) return;
  var form = document.getElementById("pmu-lock-form"), input = document.getElementById("pmu-pass"),
      msg = document.getElementById("pmu-lock-msg"), btn = document.getElementById("pmu-unlock"),
      target = document.getElementById("pmu-unlocked");
  var BUNDLE = "/files/pmu-locked.json";

  function b64(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function say(t, bad) { msg.textContent = t; msg.classList.toggle("pmu-lock-bad", !!bad); }

  function unlock(pass) {
    if (!window.crypto || !crypto.subtle || !window.TextEncoder) return Promise.reject(new Error("This browser cannot decrypt the page. Please use a current Chrome, Safari, Firefox or Edge."));
    var meta;
    return fetch(BUNDLE, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("The locked dashboard file is missing from the site.");
      return r.json();
    }).then(function (m) {
      meta = m;
      return crypto.subtle.importKey("raw", new TextEncoder().encode(pass.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
    }).then(function (base) {
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(meta.salt), iterations: meta.iter, hash: "SHA-256" },
                                     base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    }).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(meta.iv) }, key, b64(meta.ct)).then(null, function () {
        throw new Error("That passphrase did not unlock the dashboard.");
      });
    }).then(function (plain) {
      var bytes = new Uint8Array(plain);
      if (!meta.gzip) return new TextDecoder().decode(bytes);
      if (!window.DecompressionStream) throw new Error("This browser cannot inflate the page. Please use a current Chrome, Safari, Firefox or Edge.");
      var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      return new Response(stream).arrayBuffer().then(function (buf) { return new TextDecoder().decode(new Uint8Array(buf)); });
    });
  }

  function inject(html) {
    var tpl = document.createElement("template");
    tpl.innerHTML = html;
    var scripts = Array.prototype.slice.call(tpl.content.querySelectorAll("script"));
    scripts.forEach(function (s) { s.parentNode.removeChild(s); });
    target.appendChild(tpl.content);
    scripts.forEach(function (s) { var n = document.createElement("script"); n.textContent = s.textContent; document.body.appendChild(n); });
    lock.hidden = true;
  }

  function attempt(pass, remember) {
    btn.disabled = true; say("Unlocking…");
    unlock(pass).then(function (html) {
      if (remember) { try { sessionStorage.setItem("pmu-pass", pass); } catch (e) {} }
      inject(html);
    }).catch(function (e) {
      say(e && e.message ? e.message : String(e), true);
      btn.disabled = false; input.focus(); input.select();
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var p = input.value;
    if (!p) { say("Enter the passphrase.", true); return; }
    attempt(p, true);
  });
  try { var saved = sessionStorage.getItem("pmu-pass"); if (saved) attempt(saved, false); } catch (e) {}
})();
