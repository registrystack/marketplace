# Registry Stack Marketplace

Astro static site for marketplace.registrystack.org. The source is public at https://github.com/registrystack/marketplace. Regular GitHub Pages deployment can publish the verified main-branch artifact after CI passes and the deployment switch is enabled.

## Review locally

Requires Node 24 or later and npm.

    npm ci
    npm run check:ci
    npm run dev

Open http://127.0.0.1:4317. The server binds to loopback. The generated site is in dist/. Review builds and Pages publication include noindex metadata and a disallow-all robots.txt. The local server also adds an X-Robots-Tag header. Indexing requires a deliberate change to those controls.

The default and pull-request builds load no analytics, shared consent bridge, or request endpoint. The request popup can be filled in for review, but Send request is disabled. Production configuration is supplied only to the separate main-branch production build.

## Catalogue and pages

- 84 registry starters from the pinned Studio export, with archive-matched Base Registry Engine 0.44.0 metadata.
- Three integration and Evidence source packs, plus one paid service kit marked coming soon.
- Seven solution collections, covering every starter exactly once and linking to the main website's solution narratives.
- Static Astro pages generated from checked JSON data, including records, fields, permitted Actions, access profiles, included components, configuration values, references, and attribution.
- Category icons and subtle colours remain consistent across task choices, catalogue cards, and detail pages.
- PublicSchema badges appear only on starters with recorded PublicSchema provenance and link to their version, source, licence, and catalogue references.
- Studio links explain the supported local catalogue workflow and compatibility limits. They do not claim browser launch or remote import.
- Community contributions prepare a public GitHub issue draft for the contributor to review and submit. The site sends no issue automatically.

Edit Astro routes and components under src/, shared presentation rules in src/styles.css, and supplementary pack descriptions in data/packs.json. The imported starter model is data/starter-catalogue.json; collection membership is data/collections.json.

The source website used older 0.42.0-dev metadata. The imported catalogue records the 36 differing starter IDs and uses the newer archive-matched rows. Solution membership and ordering follow the main website.

## Access and request funnel

The button reads Download pack and opens a request dialog. Access is free on request. There is no public ZIP route, login system, automatic file delivery, or checkout.

The dialog uses the existing native kiosk request contract when PUBLIC_STARTER_REQUEST_ENDPOINT is explicitly configured. That value must be an HTTPS /form/submit URL with exactly formId and privacy=kiosk. The request contains the contact details, public pack ID and title, and canonical marketplace page. It omits visit identifiers. Confirmation requires the native endpoint to acknowledge every saved field. Failures retain entered details and provide an email recovery option.

With JavaScript unavailable, the primary link falls back to the existing main-site contact form with supported type=starter and context parameters. Paid kits have no request or purchase action.

## Production configuration and tracking

Production publication requires four repository variables: PUBLIC_UMAMI_WEBSITE_ID, PUBLIC_UMAMI_SCRIPT_SRC, PUBLIC_STARTER_REQUEST_ENDPOINT, and PUBLIC_SHARED_TRACKING_ENABLED. The shared-tracking variable must be explicitly true or false. Use true for the requested optional Mautic activation; use false to publish a new production artifact with optional Mautic tracking deliberately off. Umami analytics and the request form remain explicitly configured in either state. The Umami ID must be a version-4 UUID, its script must be an explicit HTTPS .js URL without credentials, query parameters, or a fragment, and the form endpoint must meet the kiosk contract above. These values are public build configuration, not credentials. The content security policy admits only the configured analytics and request origins, plus the exact main-site consent bridge origin.

The allowlisted marketplace_action event distinguishes download_intent from request_submitted. Intent means the visitor opened the request popup; submission means the endpoint confirmed the request. Neither event claims that a file was delivered. Event payloads contain public pack identifiers and canonical paths, never email, form text, search terms, query parameters, or request tokens.

Optional Mautic page activity retains the deployed protocol-v2 contract and shared client used by the main website and documentation. Marketplace access is an additional broker-owned enrollment bound to the current global consent generation. An acceptance recorded only on the website or documentation never enrolls the marketplace. The visitor must explicitly accept on the marketplace before later marketplace activity can join activity already recorded from those sites. A global rejection, consent expiry, or consent-generation rotation invalidates marketplace enrollment and requires a fresh marketplace acceptance.

DNT, GPC, local refusal, and bridge failures keep optional tracking off. The marketplace cannot request the bridge's browser identity. Its existing Mautic kiosk form never associates a device identity, regardless of tracking choice. Confirmed request_submitted and other aggregate marketplace_action events go to Umami separately from Mautic page activity.

## Source archives and verification

The 87 source archives are retained locally under content/downloads/, outside Astro's public directory and excluded from Git. data/downloads.json records their private asset paths, exact sizes, SHA-256 checksums, source revisions, licences, and packaging notes. These paths and archive bytes must never appear in dist/.

The starter importer requires explicit source roots and expected revisions:

    node scripts/sync-starters.mjs --website-root /absolute/website --website-revision <expected-head> --studio-root /absolute/studio --studio-revision <expected-head>

It validates the pinned source identities, preserves all 84 starter IDs, and derives the seven family collections from the website's maintained solution data. Repeated imports produce identical manifests and archive checksums. The professional-licensing archive has one README-only packaging edit to omit a private catalogue pointer; its other 30 members remain byte-identical. Licence and attribution files are preserved.

CI and clean-checkout checks do not need the local archives. The explicit check:archives gate still requires all 87 source archives and fails if they are absent. The build generates pages from the checked JSON catalogue.

    npm run check
    npm run test:e2e
    npm run test:funnel

Start npm run dev before test:e2e. Browser checks cover catalogue filters, solution collections, useful old fragments, Studio instructions, contribution drafts, request popups, blocked archive URLs, missing pages, and responsive widths. test:funnel builds a separate temporary fixture and intercepts every canonical website, form, bridge, and analytics request. It checks failed requests, retained fields, successful confirmation, and the two analytics signals without contacting production.

Archive checks prove integrity and native file closure. They do not establish provider connectivity, product runtime success, legal suitability, or production readiness. Compatibility notes identify the current Studio checker limitation for ten date-sensitive starters.

## Main-site migration

Prepared main-site changes keep its solution stories and leave current starter pages active by default. Only PUBLIC_MARKETPLACE_MIGRATION_ENABLED=true enables the 85 starter redirects and marketplace collection links. The prepared static redirects are HTML meta refresh documents, not HTTP 301 responses. The exact route map can later configure an edge redirect layer. No live routes have changed.

For compatibility with the existing native request form, requests use request_type=starter and starter_id for every free pack, including integration packs. Reporting should treat starter_id as the general pack identifier; the public UI calls these packs. Before relying on live sending, verify that the existing form gateway allows the exact marketplace origin, preserves the canonical marketplace source_page, confirms every saved field, and receives no device association.

## Repository and CI

The repository is public at https://github.com/registrystack/marketplace. Marketplace CI runs on pull requests, pushes to main, and manual dispatch. Its build token is read-only. A separate production build starts only after all checks pass on main and only when PAGES_DEPLOYMENT_ENABLED is exactly true. It receives the four production variables, builds from a fresh checkout, runs scripts/verify-preview-artifact.mjs --production, and uploads the Pages artifact. The deployment job alone has the Pages and OIDC permissions required for publication. Leaving PAGES_DEPLOYMENT_ENABLED unset or changing it from true provides an emergency publication stop. Official actions are pinned to immutable commits.

The review job installs locked dependencies, runs check:ci, executes browser journeys on a temporary loopback server, and checks the fully intercepted request/analytics funnel. Its environment keeps all live configuration empty or false. It uploads only the verified review dist/ site and browser review images, retained for seven days. Review verification rejects ZIPs and other archives, private asset paths, live request or analytics configuration, and indexable HTML.

Production verification requires complete explicit configuration and confirms that the built pages contain those exact public values. It also retains the archive, private-path, symlink, noindex, and disallow-all robots checks. A stale configured dist/ cannot enter the review artifact because review and production run in separate jobs and checkouts.

The deployed protocol-v2 tracking protocol and shared client are pinned by data/tracking-contract.json. The explicit local cross-site integration check compares maintained checkouts without making the standalone CI depend on sibling repositories:

    node scripts/check-shared-tracking.mjs --website-root /absolute/website --docs-root /absolute/docs/site

Those pins establish local file identity, not live broker behavior. Protocol-v3 changes or a documentation-site release are not prerequisites for marketplace enrollment because the additional marketplace grant is broker-owned. Before treating production tracking and forms as verified, record evidence from the canonical deployed origin that:

- the four-variable production build and --production artifact verification passed;
- Umami loaded only from its configured origin and received the intended aggregate events without form or visitor data;
- the existing kiosk form accepted the exact marketplace origin, confirmed every saved field, and received no tracking identifier;
- website or documentation acceptance alone did not send marketplace activity, explicit marketplace acceptance enabled later marketplace activity for the current global generation, and global rejection, expiry, or generation rotation disabled that enrollment; and
- DNT and GPC kept optional marketplace tracking off.

The synthetic funnel and local artifact checks do not provide that deployed end-to-end evidence. No real-service end-to-end result is claimed by this repository documentation.

The selected host is regular GitHub Pages. Pull requests produce downloadable CI review artifacts but no hosted PR environment. Main can publish the checked Pages artifact after explicit activation. See docs/github-pages.md for repository configuration, deployment controls, and the Cloudflare DNS record. No separate PR hosting service is used.
