export const categories = [
  {
    id: "starter",
    title: "Start a new register",
    label: "Registry starter",
    purpose: "Start a new register.",
    description:
      "Begin with a model of the records to keep, the changes staff can make, and who can do what. Your team adapts it to local rules and sets up the system.",
    includes: "A record model, change rules, and access profiles to adapt.",
  },
  {
    id: "integration",
    title: "Read data from another system",
    label: "Data integration pack",
    purpose: "Read data from another system.",
    description:
      "Begin with connection code for a system you already use. Your team configures the connection and decides where the data goes.",
    includes: "Connection code and examples for reading a particular system.",
  },
  {
    id: "evidence",
    title: "Connect a source for fact checks",
    label: "Fact-check source connection",
    purpose: "Connect a source for fact checks.",
    description:
      "Connect existing records to Registry Stack Evidence, which provides signed answers to specific questions. These packs supply the source connection; your team still defines the question and who may ask it.",
    includes: "Source connection files for a Registry Stack Evidence project.",
  },
];
export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

export function categoryFor(pack) {
  return categories.find((category) => category.id === pack.type);
}

// Decorative symbols accompany the same visible task labels on every surface.
export function renderCategoryIcon(type) {
  const shapes = {
    starter:
      '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10M15 10v10"/>',
    integration:
      '<path d="M9 3v5m6-5v5M7 8h10v3a5 5 0 0 1-10 0V8Zm5 8v3a2 2 0 0 0 2 2h4"/>',
    evidence:
      '<path d="M13 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h6M13 3l5 5h-5V3ZM7 8h3M7 12h3"/><circle cx="16" cy="16" r="4"/><path d="m19 19 3 3"/>',
  };
  if (!shapes[type]) return "";
  return (
    '<span class="mp-category-symbol" aria-hidden="true"><svg class="mp-category-icon" data-category-icon="' +
    escapeHtml(type) +
    '" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    shapes[type] +
    "</svg></span>"
  );
}

// This is a provenance symbol, not the PublicSchema logo.
export function renderPublicSchemaBadge(pack, href = '/packs/' + pack.id + '/#publicschema-attribution') {
  if (!pack.publicschema) return '';
  return '<a class="mp-publicschema" data-publicschema href="' + escapeHtml(href) + '" title="Uses PublicSchema content. View source and attribution."><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true" focusable="false"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M7 10v7h7M10 7h7v7"/></svg><span>Built with PublicSchema</span></a>';
}

export function renderCatalogue(packs) {
  return categories
    .map((category) => {
      const cards = packs
        .filter((pack) => !pack.paid && pack.type === category.id)
        .map(
          (pack) =>
            '<article class="mp-pack-card" data-free-pack="' +
            escapeHtml(pack.id) +
            '">' +
            '<div class="mp-pack-art mp-art-' +
            category.id +
            '" data-category="' +
            category.id +
            '">' +
            renderCategoryIcon(category.id) +
            '<span class="mp-pack-art-label">' +
            escapeHtml(category.label) +
            "</span></div>" +
            '<div class="mp-pack-body"><h3><a class="mp-card-title" data-marketplace-action="pack_open" data-pack-id="' +
            escapeHtml(pack.id) +
            '" data-pack="' +
            escapeHtml(pack.id) +
            '" href="/packs/' +
            escapeHtml(pack.id) +
            '/">' +
            escapeHtml(pack.title) +
            "</a></h3>" +
            '<p class="mp-card-description">' +
            escapeHtml(pack.cardDescription) +
            "</p>" +
            renderPublicSchemaBadge(pack) +
            '<div class="mp-card-bottom"><span class="mp-publisher">Maintained by Registry Stack</span><span class="mp-badge">Free on request</span></div></div></article>',
        )
        .join("");
      return (
        '<section class="mp-task-group" data-group="' +
        category.id +
        '" aria-labelledby="mp-group-' +
        category.id +
        '">' +
        '<div class="mp-group-intro"><h3 id="mp-group-' +
        category.id +
        '">' +
        escapeHtml(category.title) +
        "</h3><p>" +
        escapeHtml(category.description) +
        "</p></div>" +
        '<div class="mp-pack-grid">' +
        cards +
        "</div></section>"
      );
    })
    .join("");
}
