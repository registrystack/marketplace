import catalogue from '../../data/starter-catalogue.json' with { type: 'json' };
import authored from '../../data/packs.json' with { type: 'json' };
import downloads from '../../data/downloads.json' with { type: 'json' };
import collections from '../../data/collections.json' with { type: 'json' };
export { catalogue, collections };
const timezoneRequired = new Set(['animal-health-status', 'business-register', 'education-institutions', 'environmental-permits', 'health-facilities', 'plant-protection-products', 'professional-licensing', 'public-funding-state-aid', 'representation-mandates', 'supplier-prequalification']);
export const packs = [
  ...catalogue.starters.map(starter => {
    const overlay = authored.find(pack => pack.id === starter.id) || {};
    return {
      type: 'starter', kind: 'Registry starter',
      local: ['Your authority, jurisdiction, and institutional rules', 'Access assignments and local source bindings', 'Runtime configuration, checks, and deployment'],
      reference: 'Base Registry Engine ' + catalogue.source.breg.version,
      referenceNote: 'Run the matching product checks on your generated project. Catalogue inclusion does not establish an end-to-end service.',
      source: 'https://github.com/registrystack/registry-stack',
      format: 'Starter archive', licence: 'Apache 2.0 + CC BY 4.0',
      ...overlay,
      referenceNote: timezoneRequired.has(starter.id) ? 'The current Studio checker pin (bregctl 0.45.0-dev) refuses this 0.44.0 catalogue starter with breg.timezone.required because its date-sensitive rules do not declare a project timezone. Review and correct this before use.' : 'Run the matching product checks on the generated project. Catalogue inclusion does not establish an end-to-end service.',
      id: starter.id, title: starter.title, summary: starter.summary || starter.task,
      cardTask: overlay.cardTask || starter.summary,
      cardDescription: starter.summary || starter.task,
      overview: starter.task, model: starter.recordTypes.map(type => type.label),
      native: starter,
      publicschema: starter.catalogueRows.length > 0 ? catalogue.source.publicschema : null,
    };
  }),
  ...authored.filter(pack => pack.type !== 'starter'),
].map(pack => ({ ...pack, download: downloads[pack.id] || null, requestHref: pack.paid ? null : 'https://registrystack.org/contact/?' + new URLSearchParams({ type: 'starter', context: pack.title }) }));
export const words = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replaceAll('-', ' ').replace(/^./, c => c.toUpperCase());
