# GitHub Pages and Cloudflare DNS

The marketplace uses the regular GitHub Pages deployment from the checked main branch. CI still runs on every pull request. It publishes only after checks pass, from main, and when the repository variable PAGES_DEPLOYMENT_ENABLED is exactly true. Pull requests never deploy to the production Pages environment.

## Repository visibility and private Pages

This repository is public. GitHub plan support matters if a future repository or fork is private: private-repository Pages requires a plan that includes it, while a public repository can use public GitHub Pages. Changing source visibility and changing website visibility remain separate decisions; a public website does not require public source on a plan that supports private-repository Pages.

No private archive bytes are tracked or uploaded. The 87 request-only ZIPs remain in ignored content/downloads/. Only static catalogue pages, CSS, and browser scripts enter the checked deployment artifact.

## DNS configuration

In the registrystack.org Cloudflare zone:

| Setting | Value |
| --- | --- |
| Type | CNAME |
| Name | marketplace |
| Target | registrystack.github.io |
| Proxy status | DNS only, grey cloud |
| TTL | Auto |

The equivalent Cloudflare API request body is in [cloudflare-dns.json](cloudflare-dns.json). TTL 1 represents Auto. The CNAME target is the organization hostname, without a repository path.

The DNS-only CNAME has been verified against registrystack.github.io. GitHub serves the TLS certificate, so Cloudflare's proxy SSL mode does not control this hostname. DNS correctness alone does not establish that a Pages deployment is live.

## GitHub configuration and deployment

The repository uses this configuration:

1. In repository Settings, Pages, select GitHub Actions as the deployment source.
2. Set the custom domain to marketplace.registrystack.org. A CNAME file in this repository is not required by the Actions publishing method.
3. Confirm DNS points to registrystack.github.io and enable Enforce HTTPS when GitHub has issued the certificate. Certificate provisioning can take up to 24 hours.
4. Configure the four public repository variables used only by the production build:
   - PUBLIC_UMAMI_WEBSITE_ID: a version-4 UUID;
   - PUBLIC_UMAMI_SCRIPT_SRC: an explicit HTTPS .js URL without credentials, query parameters, or a fragment;
   - PUBLIC_STARTER_REQUEST_ENDPOINT: an HTTPS /form/submit URL with exactly formId and privacy=kiosk; and
   - PUBLIC_SHARED_TRACKING_ENABLED: exactly true to request optional Mautic activation, or exactly false to publish it deliberately off. Analytics and form configuration remain required in both states.
5. Prepare the existing form gateway and Umami service for the canonical marketplace origin. When choosing true for shared tracking, also prepare the protocol-v2 consent broker. Do not put credentials or private infrastructure identifiers in these variables.
6. Set the repository variable PAGES_DEPLOYMENT_ENABLED to true.
7. Run Marketplace CI on main, or push a main-branch change. The production job starts only after the full review job passes, builds from a fresh checkout with the four variables, verifies the result with scripts/verify-preview-artifact.mjs --production, and uploads the Pages artifact. The deploy job consumes only that verified artifact.

Setting the activation variable to any other value disables publication and can be used as an emergency stop. GitHub Pages must be enabled first; the flag does not bypass a GitHub plan restriction.

The deployment retains noindex metadata and disallow-all robots.txt while the content remains under review. Removing those controls is a separate publication decision.

Pull requests and the review job keep all live configuration empty or false. They upload the verified site as a downloadable CI artifact, do not receive a hosted preview URL, and never deploy to GitHub Pages. Production runs in a separate job and checkout, so a configured production dist/ cannot contaminate the review artifact.

The production verifier rejects incomplete or malformed configuration and checks the generated pages against the exact four public inputs. It also rejects archives, private asset paths, symlinks, indexable HTML, and a robots.txt that permits crawling. These checks prove the static artifact, not the behavior of external services.

## Live verification

After the first configured deployment, use non-sensitive test data and record evidence from https://marketplace.registrystack.org that:

1. The production build and --production artifact verifier passed before upload.
2. The configured Umami script loaded on the canonical origin and received only allowlisted aggregate actions and canonical paths.
3. The existing Mautic kiosk endpoint accepted the canonical marketplace origin, confirmed every submitted field, and received no device identity or association request.
4. Existing website or documentation acceptance alone did not enroll the marketplace. Explicit acceptance on the marketplace allowed later marketplace activity to join existing website and documentation activity for the current global consent generation.
5. A global rejection, expiry, or generation rotation invalidated the marketplace enrollment, and DNT or GPC kept optional tracking off.

The maintained protocol and shared client remain protocol v2. The extra marketplace enrollment is owned by the consent broker, so it does not require a protocol-v3 or documentation-site release. Local synthetic funnel checks and successful static verification are prerequisites, but they are not evidence that this deployed end-to-end journey passed. Do not report live activation as verified until this evidence exists.

## Sources

- [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub custom domain setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Cloudflare DNS proxy status](https://developers.cloudflare.com/dns/proxy-status/)
