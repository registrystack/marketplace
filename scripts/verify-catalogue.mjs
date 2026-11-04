import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultSiteRoot = dirname(dirname(scriptPath));
const privateRepository =
  /github\.com[/:]registrystack\/(?:registry-studio|breg-registry-starters)/i;
const sha256Pattern = /^[0-9a-f]{64}$/;
const starterIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".txt",
  ".xml",
]);

const expectedCatalogueSource = {
  catalogueVersion: 1,
  breg: {
    repository: "https://github.com/registrystack/registry-stack.git",
    revision: "bae18995d0f00eba35d7b96629a56e051ac3d0df",
    version: "0.44.0",
  },
  publicschema: {
    repository: "https://github.com/PublicSchema/publicschema.org",
    revision: "e5cfbbc0161e4d2c802d1acd752ec193253f7820",
    version: "0.3.0",
    license: "CC-BY-4.0",
  },
};

const expectedAssetPin = {
  catalogueSha256: "6e769c8c0e681a49b48fcbe6bf43436759b991d2c8e57111d31ff4e8f020a199",
  assetSetTreeSha256: "2190edb25bb846ece5748af91fe1a7c8b2cd2d06d1a052e5b69a9893878fe712",
  starterCount: 84,
};

const expectedIntegrationSources = {
  "dhis2-tracker": {
    repository: "https://github.com/registrystack/registry-stack",
    revision: "3e3c10d27436ba303dd5ca53e8bd1d7f16bba15f",
    path: "products/evidence/source-recipes/dhis2-tracker",
  },
  "opencrvs-event-search": {
    repository: "https://github.com/registrystack/registry-stack",
    revision: "3e3c10d27436ba303dd5ca53e8bd1d7f16bba15f",
    path: "products/evidence/source-recipes/opencrvs-event-search",
  },
  "odk-central": {
    repository: "https://github.com/registrystack/registry-stack",
    revision: "3e3c10d27436ba303dd5ca53e8bd1d7f16bba15f",
    path: "products/adapter/packs/odk-central",
  },
};

const expectedIntegrationPaths = {
  "dhis2-tracker": "content/downloads/dhis2-tracker-source-recipe.zip",
  "opencrvs-event-search":
    "content/downloads/opencrvs-event-search-source-recipe.zip",
  "odk-central": "content/downloads/odk-central-adapter-pack.zip",
};

function assertMetadataEntry(id, entry, expectedPath) {
  assert.ok(!Object.hasOwn(entry, "url"), `${id}: public download URL must be absent`);
  assert.equal(entry.assetPath, expectedPath, `${id}: private asset path mismatch`);
  assert.match(entry.sha256 ?? "", sha256Pattern, `${id}: invalid checksum`);
  assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 100, `${id}: invalid byte count`);
  assert.equal(typeof entry.format, "string", `${id}: missing format`);
  assert.ok(entry.format.length > 0, `${id}: empty format`);
  assert.equal(typeof entry.nativeUse, "string", `${id}: missing native-use instructions`);
  assert.ok(entry.nativeUse.length > 0, `${id}: empty native-use instructions`);
}

export function verifyCatalogueMetadata({ catalogue, collections, downloads }) {
  assert.equal(catalogue.schemaVersion, 2, "starter catalogue schema version");
  assert.deepEqual(catalogue.source, expectedCatalogueSource, "pinned catalogue source identity");
  assert.deepEqual(
    catalogue.marketplaceImport.assetPin,
    expectedAssetPin,
    "pinned catalogue asset identity",
  );
  assert.match(
    catalogue.marketplaceImport.websiteComparison.publicWebsiteRevision ?? "",
    /^[0-9a-f]{40}$/,
    "pinned website comparison revision",
  );

  assert.equal(catalogue.starters.length, 84, "starter catalogue must contain 84 starters");
  const starterById = new Map();
  for (const starter of catalogue.starters) {
    assert.match(starter.id ?? "", starterIdPattern, "invalid starter id");
    assert.ok(!starterById.has(starter.id), `${starter.id}: duplicate starter id`);
    starterById.set(starter.id, starter);
    assert.match(starter.download.sha256 ?? "", sha256Pattern, `${starter.id}: invalid catalogue checksum`);
    assert.ok(
      Number.isSafeInteger(starter.download.bytes) && starter.download.bytes > 100,
      `${starter.id}: invalid catalogue byte count`,
    );
    assert.equal(
      starter.download.path,
      `content/downloads/${starter.id}-starter.zip`,
      `${starter.id}: catalogue private asset path mismatch`,
    );
  }
  assert.equal(starterById.size, 84, "starter catalogue must contain 84 unique ids");

  assert.equal(collections.length, 7, "collections must contain seven register families");
  const memberships = collections.flatMap((collection) => collection.starterIds);
  assert.equal(
    memberships.length,
    84,
    "collection memberships must contain every starter exactly once",
  );
  assert.equal(
    new Set(memberships).size,
    84,
    "collection memberships must contain every starter exactly once",
  );
  assert.deepEqual(
    [...memberships].sort(),
    [...starterById.keys()].sort(),
    "collection memberships must contain every starter exactly once",
  );

  const downloadIds = Object.keys(downloads);
  assert.equal(downloadIds.length, 87, "downloads metadata must describe 87 free assets");
  const integrationIds = downloadIds.filter((id) => !starterById.has(id)).sort();
  assert.deepEqual(
    integrationIds,
    Object.keys(expectedIntegrationSources).sort(),
    "downloads metadata must preserve exactly the three integration assets",
  );

  const expectedStarterSource = {
    kind: "Registry Studio pinned starter catalogue export",
    catalogueSha256: expectedAssetPin.catalogueSha256,
    assetSetTreeSha256: expectedAssetPin.assetSetTreeSha256,
    breg: expectedCatalogueSource.breg,
    publicschema: expectedCatalogueSource.publicschema,
  };
  for (const [id, entry] of Object.entries(downloads)) {
    const starter = starterById.get(id);
    if (starter) {
      assertMetadataEntry(id, entry, `content/downloads/${id}-starter.zip`);
      assert.equal(entry.kind, "starter", `${id}: download kind`);
      assert.deepEqual(entry.source, expectedStarterSource, `${id}: source provenance mismatch`);
      assert.equal(entry.assetPath, starter.download.path, `${id}: catalogue asset path mismatch`);
      assert.equal(entry.sha256, starter.download.sha256, `${id}: catalogue checksum mismatch`);
      assert.equal(entry.bytes, starter.download.bytes, `${id}: catalogue byte count mismatch`);
    } else {
      assertMetadataEntry(id, entry, expectedIntegrationPaths[id]);
      assert.deepEqual(
        entry.source,
        expectedIntegrationSources[id],
        `${id}: source provenance mismatch`,
      );
    }
  }

  const publicMetadata = JSON.stringify({ catalogue, collections, downloads });
  assert.doesNotMatch(
    publicMetadata,
    privateRepository,
    "catalogue metadata contains a private repository pointer",
  );
}

export function verifyPublishedArtifacts(files) {
  for (const [path, contents] of files) {
    const normalizedPath = path.replaceAll("\\", "/");
    assert.ok(!normalizedPath.toLowerCase().endsWith(".zip"), `published ZIP: ${path}`);
    assert.ok(
      !normalizedPath.startsWith("downloads/"),
      `built site must not contain a direct downloads route: ${path}`,
    );
    if (!textExtensions.has(extname(normalizedPath).toLowerCase())) continue;
    const text = Buffer.isBuffer(contents) ? contents.toString("utf8") : contents;
    assert.doesNotMatch(text, privateRepository, `${path}: private repository pointer`);
    assert.doesNotMatch(text, /content\/downloads|"assetPath"/, `${path}: private asset path`);
  }
}

function readPublishedArtifacts(directory) {
  const files = new Map();
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile()) {
        files.set(relative(directory, path), readFileSync(path));
      }
    }
  };
  visit(directory);
  return files;
}

export function verifyCatalogue(siteRoot = defaultSiteRoot) {
  const readJson = (path) => JSON.parse(readFileSync(join(siteRoot, path), "utf8"));
  verifyCatalogueMetadata({
    catalogue: readJson("data/starter-catalogue.json"),
    collections: readJson("data/collections.json"),
    downloads: readJson("data/downloads.json"),
  });
  verifyPublishedArtifacts(readPublishedArtifacts(join(siteRoot, "dist")));
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  verifyCatalogue();
  console.log(
    "Verified public catalogue metadata for 84 starters, 7 family collections, and 87 integrity-pinned downloads; built output contains no private paths, repository pointers, or ZIPs.",
  );
}
