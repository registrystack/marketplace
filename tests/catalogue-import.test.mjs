import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = (path) => JSON.parse(read(path));
const privateRepository = /github\.com[/:]registrystack\/(?:registry-studio|breg-registry-starters)/i;

test("the active starter catalogue is the complete pinned Studio 0.44 catalogue", () => {
  const catalogue = readJson("data/starter-catalogue.json");

  assert.equal(catalogue.schemaVersion, 2);
  assert.equal(catalogue.source.breg.version, "0.44.0");
  assert.equal(catalogue.source.breg.revision, "bae18995d0f00eba35d7b96629a56e051ac3d0df");
  assert.equal(catalogue.source.publicschema.version, "0.3.0");
  assert.equal(catalogue.starters.length, 84);
  assert.equal(new Set(catalogue.starters.map(({ id }) => id)).size, 84);
  assert.equal(catalogue.marketplaceImport.assetPin.starterCount, 84);
  assert.match(catalogue.marketplaceImport.assetPin.catalogueSha256, /^[0-9a-f]{64}$/);
  assert.match(catalogue.marketplaceImport.assetPin.assetSetTreeSha256, /^[0-9a-f]{64}$/);
  assert.equal(catalogue.marketplaceImport.websiteComparison.sameStarterIds, true);
  assert.equal(catalogue.marketplaceImport.websiteComparison.differingStarterIds.length, 36);

  for (const starter of catalogue.starters) {
    assert.equal(typeof starter.title, "string", `${starter.id}: title`);
    assert.equal(typeof starter.task, "string", `${starter.id}: task`);
    assert.equal(typeof starter.summary, "string", `${starter.id}: summary`);
    assert.ok(Array.isArray(starter.recordTypes), `${starter.id}: recordTypes`);
    assert.ok(Array.isArray(starter.actions), `${starter.id}: actions`);
    assert.ok(Array.isArray(starter.accessProfiles), `${starter.id}: accessProfiles`);
    assert.ok(Array.isArray(starter.valuesKeys), `${starter.id}: valuesKeys`);
    assert.match(starter.download.path, /^content\/downloads\/[a-z0-9-]+-starter\.zip$/);
    assert.match(starter.download.sha256, /^[0-9a-f]{64}$/);
    assert.ok(starter.download.bytes > 100, `${starter.id}: download size`);
  }

  assert.doesNotMatch(JSON.stringify(catalogue), privateRepository);
});

test("register-family collections cover every starter exactly once", () => {
  const catalogue = readJson("data/starter-catalogue.json");
  const collections = readJson("data/collections.json");
  const allowedKeys = [
    "key",
    "title",
    "description",
    "intent",
    "starterIds",
    "featuredStarter",
    "openFirst",
    "mainSiteUrl",
  ].sort();

  assert.equal(collections.length, 7);
  const assigned = [];
  for (const collection of collections) {
    assert.deepEqual(Object.keys(collection).sort(), allowedKeys, `${collection.key}: fields`);
    assert.match(collection.mainSiteUrl, /^https:\/\/registrystack\.org\/solutions\/[a-z0-9-]+\/$/);
    assert.ok(collection.starterIds.length > 0, `${collection.key}: starters`);
    if (collection.featuredStarter !== null) {
      assert.ok(collection.starterIds.includes(collection.featuredStarter));
    }
    for (const id of collection.openFirst) {
      assert.ok(collection.starterIds.includes(id), `${collection.key}: ${id}`);
    }
    assigned.push(...collection.starterIds);
  }

  assert.equal(assigned.length, 84);
  assert.equal(new Set(assigned).size, 84);
  assert.deepEqual(
    [...assigned].sort(),
    catalogue.starters.map(({ id }) => id).sort(),
  );
  assert.doesNotMatch(JSON.stringify(collections), privateRepository);
});

test("all 84 starters and three integration assets have complete public integrity metadata", () => {
  const catalogue = readJson("data/starter-catalogue.json");
  const downloads = readJson("data/downloads.json");
  const starterIds = new Set(catalogue.starters.map(({ id }) => id));

  assert.equal(Object.keys(downloads).length, 87);
  assert.deepEqual(
    Object.keys(downloads).filter((id) => !starterIds.has(id)).sort(),
    ["dhis2-tracker", "odk-central", "opencrvs-event-search"],
  );

  for (const starter of catalogue.starters) {
    const download = downloads[starter.id];
    assert.ok(download, `${starter.id}: missing download metadata`);
    assert.equal(download.kind, "starter");
    assert.equal(download.assetPath, starter.download.path);
    assert.ok(!Object.hasOwn(download, "url"), `${starter.id}: public URL`);
    assert.equal(download.sha256, starter.download.sha256);
    assert.equal(download.bytes, starter.download.bytes);
    assert.equal(download.source.breg.version, catalogue.source.breg.version);
  }

  for (const [id, download] of Object.entries(downloads)) {
    assert.match(download.assetPath, /^content\/downloads\/[a-z0-9-]+\.zip$/);
    assert.ok(!Object.hasOwn(download, "url"), `${id}: public URL`);
    assert.match(download.sha256, /^[0-9a-f]{64}$/, `${id}: checksum metadata`);
    assert.ok(download.bytes > 100, `${id}: byte count metadata`);
  }

  assert.equal(
    downloads["professional-licensing"].upstreamSha256,
    "e2bc22159becb5495350922ef3528e26d359a4a7388b95769811e93c839c2e90",
  );
  assert.match(downloads["professional-licensing"].packagingNotes, /README/);
  assert.doesNotMatch(JSON.stringify(downloads), privateRepository);
});

test("private archives and filesystem metadata are absent from the built site", () => {
  const publicDownloads = new URL("../public/downloads", import.meta.url);
  const dist = new URL("../dist", import.meta.url);
  assert.ok(!existsSync(publicDownloads), "public/downloads must not exist");
  assert.ok(existsSync(dist), "build output must exist before the complete test run");

  const files = readdirSync(dist, { recursive: true, withFileTypes: true });
  for (const file of files) {
    if (!file.isFile()) continue;
    assert.ok(!file.name.endsWith(".zip"), `published ZIP: ${file.name}`);
    const path = join(file.parentPath, file.name);
    const contents = readFileSync(path, "utf8");
    assert.doesNotMatch(contents, /content\/downloads|"assetPath"/);
  }
  assert.ok(!existsSync(new URL("../dist/downloads", import.meta.url)));
});
