# GitHub Pages and Cloudflare DNS

The marketplace uses the regular GitHub Pages deployment from the checked main branch. CI still runs on every pull request. It publishes only after checks pass, from main, and when the repository variable PAGES_DEPLOYMENT_ENABLED is exactly true. Pull requests never deploy to the production Pages environment.

## Current activation prerequisite

The repository was created private. GitHub rejected Pages activation because the current organization plan does not support Pages for this private repository. The repository must either become public with the owner's explicit approval, or the organization must use a GitHub plan that supports private-repository Pages. Changing source visibility and changing website visibility are different actions; a public website does not require its source to be public on a suitable plan.

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

Because this record is DNS only, GitHub serves the TLS certificate. Cloudflare's proxy SSL mode does not control this hostname.

## GitHub activation

After resolving the repository plan or visibility prerequisite:

1. In repository Settings, Pages, select GitHub Actions as the deployment source.
2. Set the custom domain to marketplace.registrystack.org. A CNAME file in this repository is not required by the Actions publishing method.
3. Confirm DNS points to registrystack.github.io and enable Enforce HTTPS when GitHub has issued the certificate. Certificate provisioning can take up to 24 hours.
4. Set the repository variable PAGES_DEPLOYMENT_ENABLED to true.
5. Run Marketplace CI on main, or push a main-branch change. The deploy job consumes the same artifact that passed the checks.

Setting the activation variable to any other value disables publication. GitHub Pages must be enabled first; the flag does not bypass a GitHub plan restriction.

The initial deployment retains noindex metadata and disallow-all robots.txt while the content remains under review. Form submissions and analytics remain unconfigured. Removing those review controls and enabling live integrations require a deliberate subsequent change.

## Sources

- [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub custom domain setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Cloudflare DNS proxy status](https://developers.cloudflare.com/dns/proxy-status/)
