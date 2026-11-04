# Registry Stack Marketplace

Separate Astro static marketplace for marketplace.registrystack.org.
The source repository is public and regular GitHub Pages deployment is authorized. Main may publish only after CI passes and only while PAGES_DEPLOYMENT_ENABLED is exactly true; leave it unset or set it to another value to stop publication.

- npm run check:ci validates a clean checkout without private assets.
- npm run check adds explicit local private-archive verification.
- node scripts/check-browser.mjs starts its own temporary server and runs browser checks.
- Preview artifacts must pass scripts/verify-preview-artifact.mjs before upload.
- npm run dev serves the built site on loopback. npm run dev:astro starts Astro development.
- npm run test:e2e checks local browser journeys; npm run test:funnel uses synthetic intercepted services.
- Edit routes/components under src/, catalogue JSON in data/, and shared src/styles.css.
- Preserve the existing design, plain category labels, icons, and subtle category colours.
- Source archives stay in ignored content/downloads/, never public/ or dist/.
- Download pack opens a request form. Only confirmed requests count as submitted; no automatic file delivery.
- Keep personal data out of analytics. Local preview must not contact production analytics, bridge, or form endpoints.
- Keep PUBLIC_SHARED_TRACKING_ENABLED false until the protocol-v3 website and documentation changes are ready for coordinated publication. Production builds must also leave analytics and form configuration empty until those integrations are deliberately enabled.
- PublicSchema badges require recorded source provenance. Preserve attribution, licences, and archive integrity.
- Contributions open user-reviewed GitHub drafts. Never send issues automatically.
- Studio uses its checked local starter catalogue. Do not invent a launch or import protocol.
- Paid kits remain coming soon. No checkout, accounts, or fabricated community metrics.
