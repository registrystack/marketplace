# Registry Stack Marketplace

Separate Astro static marketplace for marketplace.registrystack.org.
The source repository is public and regular GitHub Pages deployment is authorized. Main may publish only after CI passes and only while PAGES_DEPLOYMENT_ENABLED is exactly true; leave it unset or set it to another value to stop publication.

- npm run check:ci validates a clean checkout without private assets.
- npm run check adds explicit local private-archive verification.
- node scripts/check-browser.mjs starts its own temporary server and runs browser checks.
- Review artifacts must pass scripts/verify-preview-artifact.mjs before upload. The main-only production build uses --production and must pass before the Pages artifact is uploaded.
- npm run dev serves the built site on loopback. npm run dev:astro starts Astro development.
- npm run test:e2e checks local browser journeys; npm run test:funnel uses synthetic intercepted services.
- Edit routes/components under src/, catalogue JSON in data/, and shared src/styles.css.
- Preserve the existing design, plain category labels, icons, and subtle category colours.
- Source archives stay in ignored content/downloads/, never public/ or dist/.
- Download pack opens a request form. Only confirmed requests count as submitted; no automatic file delivery.
- Keep personal data out of analytics. Local preview must not contact production analytics, bridge, or form endpoints.
- Review builds keep Umami, the form endpoint, and shared tracking inert. The separate production job receives PUBLIC_UMAMI_WEBSITE_ID, PUBLIC_UMAMI_SCRIPT_SRC, PUBLIC_STARTER_REQUEST_ENDPOINT, and PUBLIC_SHARED_TRACKING_ENABLED only from repository variables. Shared tracking must be explicitly true or false: true requests activation, while false publishes it deliberately off. Analytics and form configuration remain required in both states.
- Retain noindex metadata and disallow-all robots.txt in review and production artifacts until indexing is separately authorized.
- Preserve the deployed protocol-v2 client and contract. Marketplace tracking requires explicit marketplace acceptance recorded as a broker-owned enrollment for the current global consent generation; website or documentation acceptance alone is insufficient. Global rejection, expiry, or generation rotation invalidates the enrollment.
- The existing Mautic kiosk form never associates a device identity. Umami aggregate events remain separate from optional Mautic page activity.
- Do not record real service identifiers in source, tests, or documentation. Do not claim live end-to-end success without evidence from the canonical deployed origin.
- PublicSchema badges require recorded source provenance. Preserve attribution, licences, and archive integrity.
- Contributions open user-reviewed GitHub drafts. Never send issues automatically.
- Studio uses its checked local starter catalogue. Do not invent a launch or import protocol.
- Paid kits remain coming soon. No checkout, accounts, or fabricated community metrics.
