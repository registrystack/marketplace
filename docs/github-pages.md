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
4. Set the repository variable PAGES_DEPLOYMENT_ENABLED to true.
5. Run Marketplace CI on main, or push a main-branch change. The deploy job consumes the same artifact that passed the checks.

Setting the activation variable to any other value disables publication and can be used as an emergency stop. GitHub Pages must be enabled first; the flag does not bypass a GitHub plan restriction.

The initial deployment retains noindex metadata and disallow-all robots.txt while the content remains under review. The workflow sets PUBLIC_SHARED_TRACKING_ENABLED to false and leaves Umami analytics and the form endpoint unconfigured. Visitors can fill the request dialog, but its Send request button remains disabled. Removing the review controls or enabling any live integration requires a deliberate subsequent change.

Pull requests upload the verified site as a downloadable CI artifact. They do not receive a hosted preview URL or deploy to GitHub Pages.

## Sources

- [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub custom domain setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Cloudflare DNS proxy status](https://developers.cloudflare.com/dns/proxy-status/)
