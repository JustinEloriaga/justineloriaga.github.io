# justineloriaga.com

Personal academic site. Quarto project; static HTML output in `docs/`, served by GitHub Pages.

Live at <https://justineloriaga.com> (GitHub Pages, `main` branch, `/docs` folder).

`CNAME` holds the custom domain and is copied into `docs/` on every render. GitHub Pages
reads `docs/CNAME` on each build, so do not delete it — and do not clear the Custom domain
field in the Pages settings UI either, since that writes a commit directly to `main` and
will desync your local clone.

## Layout

    _quarto.yml              site config: navbar, footer, theme, output dir
    custom.scss              the entire design system — colors, type, components
    index.qmd                home: hero, about, education
    research/index.qmd       the paper index
    lecture-materials/       teaching page
    teaching-playlists/      teaching page
    cv-and-short-bio/        CV page
    files/                   PDFs go here, linked as /files/name.pdf
    img/portrait.jpg         the headshot
    js/filters.js            the status filter on the research page
    js/playlists.js          the search + topic filter on the teaching playlists page
    docs/                    BUILD OUTPUT — never edit by hand, always committed

Page paths deliberately match the old WordPress URLs, so existing links and any
citations pointing at `/research/` or `/cv-and-short-bio/` keep working.

## Working on it

    quarto preview     # live reload while editing
    quarto render      # writes docs/

`docs/` is generated. Edit the `.qmd` files, re-render, commit both.

## The teaching playlists page

`teaching-playlists/index.qmd` is **generated** — 26 playlists and 257 videos scraped
from the YouTube channel and written into the page as static HTML, so the page needs no
API key and works offline. Editing it by hand is fine for a one-off fix, but if the
channel changes substantially it is easier to regenerate. The topic buckets and the
one-line blurbs are hand-written and live in the generator, not on YouTube.

## Adding a paper

Open `research/index.qmd`. Everything between the ```` ```{=html} ```` fence and its
closing fence is plain HTML passed straight through. Copy an existing
`<article class="paper">` block and edit four things:

- `data-status` — `review`, `wp`, `forthcoming`, or `published`. Drives the filter chips.
- `<div class="tag">` — the label on the left. Add class `live` for amber (under review),
  `out` for blue (published, forthcoming).
- `<details>` — the abstract. Several papers have a commented-out stub; delete the
  comment markers and write the abstract inside the `<p>`.
- `<div class="links">` — put the PDF in `files/` and link it as `/files/name.pdf`.

Keep the indentation as it is. Do not indent HTML by four or more spaces outside the
raw block — Pandoc reads that as a code block.

## Deploying

Push to `main`. GitHub Pages serves from `main` branch, `/docs` folder, so a push is a
deploy. Give it about a minute; the run shows up in the Actions tab as
"pages build and deployment".

`.nojekyll` and `CNAME` sit at the project root and are copied into `docs/` on every
render. GitHub Pages needs both — `.nojekyll` stops Jekyll from mangling `site_libs/`,
and `docs/CNAME` is what tells Pages which custom domain to serve.

## Domain and DNS

`justineloriaga.com` is **registered at WordPress.com** and its nameservers still point
there (`ns1`/`ns2`/`ns3.wordpress.com`). Only the records were repointed at GitHub — the
registration was never transferred. Renewal and auto-renew stay in the WordPress.com
account.

Records live, as of August 2026:

    A      @      185.199.108.153
    A      @      185.199.109.153
    A      @      185.199.110.153
    A      @      185.199.111.153
    AAAA   @      2606:50c0:8000::153
    AAAA   @      2606:50c0:8001::153
    AAAA   @      2606:50c0:8002::153
    AAAA   @      2606:50c0:8003::153
    CNAME  www    justineloriaga.github.io
    NS     @      handled by WordPress.com   <- do not touch, this is the zone itself
    TXT    _domainconnect                    <- inert WordPress.com leftover

There are no MX records; no email runs on this domain.

To edit them: wordpress.com -> Domains -> justineloriaga.com -> the three-dot menu ->
Manage DNS. Ignore the two yellow banners there offering to "restore default A records"
and "restore default CNAME record" — both point the domain back at WordPress.

To roll back to WordPress in an emergency, delete the GitHub records and use those
"restore default" links. TTL is 300s, so it takes about five minutes.

Verify from a terminal:

    dig +short justineloriaga.com A
