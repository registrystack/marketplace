import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  verifyCatalogueMetadata,
  verifyPublishedArtifacts,
} from "../scripts/verify-catalogue.mjs";

const readJson = (path) =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const inputs = () => ({
  catalogue: readJson("data/starter-catalogue.json"),
  collections: readJson("data/collections.json"),
  downloads: readJson("data/downloads.json"),
});

test("public catalogue metadata proves all advertised download identities without archive bytes", () => {
  assert.doesNotThrow(() => verifyCatalogueMetadata(inputs()));
});

test("public catalogue verification rejects incomplete integrity metadata and download URLs", () => {
  const missingChecksum = inputs();
  delete missingChecksum.downloads["professional-licensing"].sha256;
  assert.throws(
    () => verifyCatalogueMetadata(missingChecksum),
    /professional-licensing: invalid checksum/,
  );

  const publicUrl = inputs();
  publicUrl.downloads["odk-central"].url = "https://example.org/pack.zip";
  assert.throws(
    () => verifyCatalogueMetadata(publicUrl),
    /odk-central: public download URL must be absent/,
  );
});

test("public catalogue verification rejects source drift and collection drift", () => {
  const sourceDrift = inputs();
  sourceDrift.downloads["dhis2-tracker"].source.revision = "0".repeat(40);
  assert.throws(
    () => verifyCatalogueMetadata(sourceDrift),
    /dhis2-tracker: source provenance mismatch/,
  );

  const collectionDrift = inputs();
  collectionDrift.collections[0].starterIds.push("professional-licensing");
  assert.throws(
    () => verifyCatalogueMetadata(collectionDrift),
    /collection memberships must contain every starter exactly once/,
  );
});

test("public catalogue verification rejects private paths and starter metadata disagreement", () => {
  const unsafePath = inputs();
  unsafePath.downloads["odk-central"].assetPath = "../private/odk.zip";
  assert.throws(
    () => verifyCatalogueMetadata(unsafePath),
    /odk-central: private asset path mismatch/,
  );

  const mismatch = inputs();
  mismatch.downloads["professional-licensing"].bytes += 1;
  assert.throws(
    () => verifyCatalogueMetadata(mismatch),
    /professional-licensing: catalogue byte count mismatch/,
  );
});

test("published artifact verification rejects ZIPs, private pointers, and private asset paths", () => {
  assert.doesNotThrow(() =>
    verifyPublishedArtifacts(
      new Map([
        ["index.html", "<main>Marketplace</main>"],
        ["_astro/app.js", "console.log('public');"],
      ]),
    ),
  );
  assert.throws(
    () => verifyPublishedArtifacts(new Map([["downloads/pack.zip", Buffer.from("zip")]])),
    /published ZIP/,
  );
  assert.throws(
    () =>
      verifyPublishedArtifacts(
        new Map([["index.html", "github.com/registrystack/registry-studio"]]),
      ),
    /private repository pointer/,
  );
  assert.throws(
    () =>
      verifyPublishedArtifacts(
        new Map([["index.html", "content/downloads/example.zip"]]),
      ),
    /private asset path/,
  );
});
