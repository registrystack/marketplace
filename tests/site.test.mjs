import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");
test("homepage and deep pack pages have public metadata and real contents", () => {
  const home = read("dist/index.html");
  assert.match(home, /Build a register/);
  assert.match(home, /Registry Stack is open-source software/);
  assert.match(home, /A pack is a download/);
  for (const type of ["starter", "integration", "evidence"]) {
    assert.ok(
      home.includes('data-group="' + type + '"'),
      "Separate task group: " + type,
    );
  }
  assert.match(home, /Paid packs · Coming soon/);
  assert.match(home, /https:\/\/marketplace\.registrystack\.org\//);
  assert.doesNotMatch(home, /Concept sketch|actions are previews|Preview only/);
  for (const id of [
    "professional-licensing",
    "health-facilities",
    "farmer-registry",
    "dhis2-tracker",
    "opencrvs-event-search",
    "odk-central",
    "licensing-service",
  ]) {
    const page = read("dist/packs/" + id + "/index.html");
    assert.match(page, /rel="canonical"/);
    assert.match(page, /<h1[^>]*>[^<]+<\/h1>/);
    assert.match(page, /Your team supplies/);
    assert.doesNotMatch(
      page,
      /github\.com\/registrystack\/(?:registry-studio|breg-registry-starters)/,
      "Do not publish private repository references",
    );
    assert.ok(
      existsSync(
        new URL("../dist/studio/" + id + "/index.html", import.meta.url),
      ),
    );
  }
});
test("category symbols appear with labels in choices, cards, and pack pages", () => {
  const home = read("dist/index.html");
  for (const type of ["starter", "integration", "evidence"]) {
    assert.ok(
      home.includes('data-category="' + type + '"'),
      "Category styling for " + type,
    );
    assert.ok(
      home.split('data-category-icon="' + type + '"').length > 2,
      "Symbol repeated on choice and card for " + type,
    );
  }
  for (const [id, type] of [
    ["professional-licensing", "starter"],
    ["odk-central", "integration"],
    ["dhis2-tracker", "evidence"],
  ]) {
    const page = read("dist/packs/" + id + "/index.html");
    assert.ok(
      page.includes('data-pack-category data-category="' + type + '"'),
      "Detail category for " + id,
    );
    assert.ok(
      page.includes('data-category-icon="' + type + '"'),
      "Detail symbol for " + id,
    );
  }
  assert.doesNotMatch(
    read("dist/packs/licensing-service/index.html"),
    /data-pack-category data-category="/,
    "Planned paid kit stays neutral",
  );
});
test("paid packs have no checkout and contributions require review on GitHub", () => {
  const js = read("src/scripts/contribute.js");
  assert.match(js, /github\.com/);
  assert.match(js, /issues\/new/);
  assert.doesNotMatch(
    js,
    /window\.openai|widgetState|Preview only|Your address has not been sent/,
  );
  assert.match(read("dist/contribute/index.html"), /Continue on GitHub/);
  assert.doesNotMatch(
    read("dist/packs/licensing-service/index.html"),
    /Buy now|Add to cart/,
  );
});
