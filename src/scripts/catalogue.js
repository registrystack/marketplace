import collections from '../../data/collections.json';

// Preserve family bookmarks carried over by the main site's starter redirects.
const family = location.hash.slice(1);
if (collections.some(collection => collection.key === family)) location.replace('/collections/' + family + '/');

const grid = document.querySelector('#mp-pack-grid');
const search = document.querySelector('#mp-search');
if (grid && search) {
  let filter = 'all';
  const update = () => {
    let count = 0;
    const query = search.value.trim().toLowerCase();
    for (const group of grid.querySelectorAll('[data-group]')) {
      let visible = 0;
      for (const card of group.querySelectorAll('[data-free-pack]')) {
        card.hidden = (filter !== 'all' && group.dataset.group !== filter) || !card.textContent.toLowerCase().includes(query);
        if (!card.hidden) { visible++; count++; }
      }
      group.hidden = visible === 0;
    }
    document.querySelector('#mp-search-empty').hidden = count !== 0;
    document.querySelector('#mp-search-status').textContent = count + ' matching free packs.';
    for (const button of document.querySelectorAll('[data-filter]')) button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  };
  search.addEventListener('input', update);
  for (const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click', () => { filter = button.dataset.filter; update(); });
  document.querySelector('[data-clear-search]').addEventListener('click', () => { search.value = ''; filter = 'all'; update(); search.focus(); });
  update();
}
