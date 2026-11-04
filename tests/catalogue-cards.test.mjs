import assert from "node:assert/strict";
import { test } from "node:test";

import {
  categoryFor,
  escapeHtml,
  renderCatalogue,
  renderCategoryIcon,
} from "../src/catalogue.js";
import { packs } from "../src/lib/catalogue.mjs";

const occurrences = (value, needle) => value.split(needle).length - 1;

test("all free catalogue cards keep summaries out of the tinted category header", () => {
  const freePacks = packs.filter((pack) => !pack.paid);

  assert.equal(freePacks.length, 87);

  for (const pack of freePacks) {
    const category = categoryFor(pack);
    const catalogue = renderCatalogue([pack]);
    const cardMatch = catalogue.match(
      new RegExp(
        `<article class="mp-pack-card" data-free-pack="${pack.id}">` +
          `<div class="mp-pack-art mp-art-${pack.type}" data-category="${pack.type}">` +
          `([\\s\\S]*?)</div>` +
          `<div class="mp-pack-body">([\\s\\S]*?)</div></article>`,
      ),
    );

    assert.ok(cardMatch, `${pack.id}: rendered card`);
    const [, header, body] = cardMatch;
    const expectedHeader =
      renderCategoryIcon(pack.type) +
      `<span class="mp-pack-art-label">${escapeHtml(category.label)}</span>`;
    const titleMarkup = `>${escapeHtml(pack.title)}</a></h3>`;
    const descriptionMarkup = `<p class="mp-card-description">${escapeHtml(pack.cardDescription)}</p>`;

    assert.equal(header, expectedHeader, `${pack.id}: category header contents`);
    assert.doesNotMatch(header, /mp-card-task/, `${pack.id}: card task in header`);
    assert.ok(
      !header.includes(escapeHtml(pack.cardDescription)),
      `${pack.id}: full description in header`,
    );
    assert.ok(
      body.includes(titleMarkup + descriptionMarkup),
      `${pack.id}: title and full description in body`,
    );
    assert.equal(
      occurrences(catalogue, titleMarkup),
      1,
      `${pack.id}: title count`,
    );
    assert.equal(
      occurrences(catalogue, descriptionMarkup),
      1,
      `${pack.id}: full description count`,
    );
    assert.equal(
      body.includes("data-publicschema"),
      Boolean(pack.publicschema),
      `${pack.id}: PublicSchema badge`,
    );
  }
});
