import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const readJson = (path) =>
  JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("all 84 starter and three integration archives match public integrity metadata", () => {
  const catalogue = readJson("data/starter-catalogue.json");
  const downloads = readJson("data/downloads.json");
  const starterIds = new Set(catalogue.starters.map(({ id }) => id));

  assert.equal(Object.keys(downloads).length, 87);
  assert.deepEqual(
    Object.keys(downloads).filter((id) => !starterIds.has(id)).sort(),
    ["dhis2-tracker", "odk-central", "opencrvs-event-search"],
  );

  for (const [id, download] of Object.entries(downloads)) {
    const archiveUrl = new URL(`../../${download.assetPath}`, import.meta.url);
    assert.ok(existsSync(archiveUrl), `${id}: missing ${download.assetPath}`);
    const bytes = readFileSync(archiveUrl);
    assert.equal(bytes.length, download.bytes, `${id}: byte count`);
    assert.equal(sha256(bytes), download.sha256, `${id}: checksum`);
  }
});
