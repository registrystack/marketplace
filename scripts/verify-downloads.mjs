import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const siteRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const downloadsDirectory = join(siteRoot, "content", "downloads");
const metadataPath = join(siteRoot, "data", "downloads.json");
const cataloguePath = join(siteRoot, "data", "starter-catalogue.json");
const privateRepository = /github\.com[/:]registrystack\/(?:registry-studio|breg-registry-starters)/i;
const approvedRegistryHosts = new Set([
  "docs.registrystack.org",
  "id.registrystack.org",
  "registrystack.org",
  "www.registrystack.org",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertSafeArchiveName(name, archivePath) {
  assert.ok(name.length > 0, `${archivePath}: empty archive member name`);
  assert.ok(!name.startsWith("/"), `${archivePath}: absolute archive member ${name}`);
  assert.ok(!name.includes("\\"), `${archivePath}: backslash in archive member ${name}`);
  assert.ok(
    !name.split("/").includes(".."),
    `${archivePath}: parent traversal in archive member ${name}`,
  );
}

function readZipDirectory(zip, archivePath) {
  const endSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const earliestEnd = Math.max(0, zip.length - 22 - 0xffff);
  let endOffset = -1;

  for (let offset = zip.length - 22; offset >= earliestEnd; offset -= 1) {
    if (zip.readUInt32LE(offset) === endSignature) {
      endOffset = offset;
      break;
    }
  }

  assert.notEqual(endOffset, -1, `${archivePath}: missing ZIP end-of-directory record`);
  const entryCount = zip.readUInt16LE(endOffset + 10);
  const centralSize = zip.readUInt32LE(endOffset + 12);
  const centralOffset = zip.readUInt32LE(endOffset + 16);
  assert.ok(
    centralOffset + centralSize <= endOffset,
    `${archivePath}: invalid central directory bounds`,
  );

  const entries = new Map();
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(
      zip.readUInt32LE(offset),
      centralSignature,
      `${archivePath}: invalid central directory entry ${index}`,
    );
    const compressionMethod = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const name = zip.subarray(nameStart, nameStart + nameLength).toString("utf8");

    assertSafeArchiveName(name, archivePath);
    assert.ok(!entries.has(name), `${archivePath}: duplicate archive member ${name}`);
    entries.set(name, {
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset = nameStart + nameLength + extraLength + commentLength;
  }

  assert.equal(offset, centralOffset + centralSize, `${archivePath}: central directory size mismatch`);
  return entries;
}

function extractZipMember(zip, entry, name, archivePath) {
  const localSignature = 0x04034b50;
  const offset = entry.localHeaderOffset;
  assert.equal(
    zip.readUInt32LE(offset),
    localSignature,
    `${archivePath}: invalid local header for ${name}`,
  );
  const nameLength = zip.readUInt16LE(offset + 26);
  const extraLength = zip.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const compressed = zip.subarray(dataStart, dataStart + entry.compressedSize);
  let contents;

  if (entry.compressionMethod === 0) {
    contents = compressed;
  } else if (entry.compressionMethod === 8) {
    contents = inflateRawSync(compressed);
  } else {
    assert.fail(`${archivePath}: unsupported ZIP compression method ${entry.compressionMethod}`);
  }

  assert.equal(
    contents.length,
    entry.uncompressedSize,
    `${archivePath}: uncompressed size mismatch for ${name}`,
  );
  return contents;
}

function assertExactMembers(entries, expectedMembers, archivePath) {
  assert.deepEqual(
    [...entries.keys()].sort(),
    [...expectedMembers].sort(),
    `${archivePath}: archive closure differs from the expected source files`,
  );
}

function verifyPublicReferences(text, archivePath, name) {
  assert.doesNotMatch(
    text,
    privateRepository,
    `${archivePath}: ${name} contains a private repository pointer`,
  );
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'`\])}]+/gi)) {
    let host;
    try {
      host = new URL(match[0]).hostname.toLowerCase().replace(/\.$/, "");
    } catch {
      continue;
    }
    assert.ok(
      !host.endsWith(".registrystack.org") || approvedRegistryHosts.has(host),
      `${archivePath}: ${name} contains an unapproved Registry Stack host`,
    );
    assert.doesNotMatch(host, /\.(?:corp|home|internal|lan|local)$/i, `${archivePath}: ${name}`);
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const octets = ipv4.slice(1).map(Number);
      const privateAddress =
        octets[0] === 10 ||
        (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
        (octets[0] === 192 && octets[1] === 168) ||
        (octets[0] === 169 && octets[1] === 254);
      assert.ok(!privateAddress, `${archivePath}: ${name} contains a private-network URL`);
    }
  }
}

function verifyStarterArchive(zip, entries, id, archivePath) {
  const starterPrefix = `${id}-starter/`;
  const requiredMembers = ["LICENSE", "README.md", "project/registry.yaml"];
  assert.ok(entries.size > requiredMembers.length, `${archivePath}: starter archive is unexpectedly empty`);
  for (const name of entries.keys()) {
    assert.ok(
      name.startsWith(starterPrefix),
      `${archivePath}: member is outside ${starterPrefix}: ${name}`,
    );
  }
  for (const relativeName of requiredMembers) {
    assert.ok(
      entries.has(`${starterPrefix}${relativeName}`),
      `${archivePath}: missing ${starterPrefix}${relativeName}`,
    );
  }
  if (id === "professional-licensing") {
    for (const relativeName of ["NOTICE", "PUBLICSCHEMA-LICENSE.txt", "SOURCE.json"]) {
      assert.ok(entries.has(`${starterPrefix}${relativeName}`), `${archivePath}: missing ${relativeName}`);
    }
    const readmeName = `${starterPrefix}README.md`;
    const readme = extractZipMember(zip, entries.get(readmeName), readmeName, archivePath).toString(
      "utf8",
    );
    assert.match(
      readme,
      /reviewed licensing example in the Registry Stack starter catalogue/,
      `${archivePath}: missing the public catalogue reference`,
    );
    assert.ok(
      !readme.includes("repository access is required"),
      `${archivePath}: private catalogue access wording remains`,
    );
  }
  assert.ok(zip.length > 0, `${id}: empty starter archive`);
}

function verifySourceRecipe(zip, entries, id, archivePath) {
  const manifestName = `${id}/source-export.json`;
  const manifestEntry = entries.get(manifestName);
  assert.ok(manifestEntry, `${archivePath}: missing ${manifestName}`);
  const manifest = JSON.parse(extractZipMember(zip, manifestEntry, manifestName, archivePath));

  assert.equal(manifest.sourceId, id, `${archivePath}: sourceId mismatch`);
  assert.ok(Array.isArray(manifest.artifacts), `${archivePath}: manifest artifacts must be an array`);
  const artifactPaths = manifest.artifacts.map((artifact) => artifact.path);
  assert.equal(
    new Set(artifactPaths).size,
    artifactPaths.length,
    `${archivePath}: duplicate manifest artifact path`,
  );

  assertExactMembers(
    entries,
    [`${id}/LICENSE`, `${id}/README.md`, manifestName, ...artifactPaths.map((path) => `${id}/${path}`)],
    archivePath,
  );

  for (const artifact of manifest.artifacts) {
    assert.match(
      artifact.digest,
      /^sha256:[0-9a-f]{64}$/,
      `${archivePath}: invalid digest for ${artifact.path}`,
    );
    const memberName = `${id}/${artifact.path}`;
    const member = entries.get(memberName);
    assert.ok(member, `${archivePath}: missing manifest artifact ${memberName}`);
    assert.equal(
      sha256(extractZipMember(zip, member, memberName, archivePath)),
      artifact.digest.slice("sha256:".length),
      `${archivePath}: digest mismatch for ${memberName}`,
    );
  }
}

function verifyAdapterPack(zip, entries, archivePath) {
  const expectedMembers = [
    "odk-central/LICENSE",
    "odk-central/README.md",
    "odk-central/pack.yaml",
    "odk-central/scripts/cursor.rhai",
    "odk-central/scripts/shape-page.rhai",
    "odk-central/scripts/shape-repeats.rhai",
    "odk-central/fixtures/odk-central-repeats-page.yaml",
    "odk-central/fixtures/odk-central-submissions-empty.yaml",
    "odk-central/fixtures/odk-central-submissions-page-one.yaml",
    "odk-central/fixtures/odk-central-submissions-page-short.yaml",
    "odk-central/fixtures/odk-central-submissions-page-two.yaml",
    "odk-central/fixtures/odk-central-submissions-unauthorized.yaml",
  ];
  assertExactMembers(entries, expectedMembers, archivePath);

  const packName = "odk-central/pack.yaml";
  const pack = extractZipMember(zip, entries.get(packName), packName, archivePath).toString("utf8");
  const declaredScripts = new Map();
  const scriptPattern = /^\s+- path: (scripts\/\S+)\n\s+digest: sha256:([0-9a-f]{64})$/gm;
  for (const match of pack.matchAll(scriptPattern)) {
    declaredScripts.set(match[1], match[2]);
  }
  assert.equal(declaredScripts.size, 3, `${archivePath}: expected three digest-pinned scripts`);

  for (const [relativeName, digest] of declaredScripts) {
    const memberName = `odk-central/${relativeName}`;
    const member = entries.get(memberName);
    assert.ok(member, `${archivePath}: missing declared script ${memberName}`);
    assert.equal(
      sha256(extractZipMember(zip, member, memberName, archivePath)),
      digest,
      `${archivePath}: digest mismatch for ${memberName}`,
    );
  }
}

const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
const starterById = new Map(catalogue.starters.map((starter) => [starter.id, starter]));
const integrationIds = ["dhis2-tracker", "opencrvs-event-search", "odk-central"];

assert.equal(starterById.size, 84, "starter-catalogue.json must contain 84 unique starters");
assert.equal(Object.keys(metadata).length, 87, "downloads.json must describe 87 free downloads");
assert.deepEqual(
  Object.keys(metadata).filter((id) => !starterById.has(id)).sort(),
  [...integrationIds].sort(),
  "downloads.json must preserve exactly the three integration assets",
);
assert.deepEqual(
  (await readdir(downloadsDirectory)).filter((name) => name.endsWith(".zip")).sort(),
  Object.values(metadata).map(({ assetPath }) => basename(assetPath)).sort(),
  "content/downloads must contain exactly the private manifest ZIP files",
);
assert.doesNotMatch(JSON.stringify(metadata), privateRepository, "downloads metadata contains a private repository pointer");
assert.doesNotMatch(JSON.stringify(catalogue), privateRepository, "starter catalogue contains a private repository pointer");

for (const [id, entry] of Object.entries(metadata)) {
  assert.ok(!Object.hasOwn(entry, "url"), `${id}: public download URL must be absent`);
  assert.equal(
    entry.assetPath,
    `content/downloads/${basename(entry.assetPath)}`,
    `${id}: private asset path mismatch`,
  );
  assert.match(entry.sha256, /^[0-9a-f]{64}$/, `${id}: invalid checksum`);
  assert.ok(entry.bytes > 100, `${id}: invalid byte count`);
  assert.equal(typeof entry.format, "string", `${id}: missing format`);
  assert.ok(entry.format.length > 0, `${id}: empty format`);
  assert.equal(typeof entry.nativeUse, "string", `${id}: missing native-use instructions`);
  assert.ok(entry.nativeUse.length > 0, `${id}: empty native-use instructions`);

  const archivePath = join(siteRoot, entry.assetPath);
  const zip = await readFile(archivePath);
  assert.equal(zip.length, entry.bytes, `${id}: archive byte count mismatch`);
  assert.equal(sha256(zip), entry.sha256, `${id}: archive checksum mismatch`);
  const entries = readZipDirectory(zip, archivePath);
  for (const [name, member] of entries) {
    verifyPublicReferences(
      extractZipMember(zip, member, name, archivePath).toString("utf8"),
      archivePath,
      name,
    );
  }

  const starter = starterById.get(id);
  if (starter) {
    assert.equal(entry.kind, "starter", `${id}: download kind`);
    assert.equal(entry.assetPath, starter.download.path, `${id}: catalogue asset path mismatch`);
    assert.equal(entry.sha256, starter.download.sha256, `${id}: catalogue checksum mismatch`);
    assert.equal(entry.bytes, starter.download.bytes, `${id}: catalogue byte count mismatch`);
    assert.equal(entry.source.catalogueSha256, catalogue.marketplaceImport.assetPin.catalogueSha256);
    assert.equal(entry.source.assetSetTreeSha256, catalogue.marketplaceImport.assetPin.assetSetTreeSha256);
    assert.deepEqual(entry.source.breg, catalogue.source.breg, `${id}: BReg source mismatch`);
    assert.deepEqual(entry.source.publicschema, catalogue.source.publicschema, `${id}: PublicSchema source mismatch`);
    verifyStarterArchive(zip, entries, id, archivePath);
  } else if (id === "dhis2-tracker" || id === "opencrvs-event-search") {
    verifySourceRecipe(zip, entries, id, archivePath);
  } else if (id === "odk-central") {
    verifyAdapterPack(zip, entries, archivePath);
  }
}

const professional = metadata["professional-licensing"];
assert.match(professional.upstreamSha256, /^[0-9a-f]{64}$/);
assert.notEqual(professional.sha256, professional.upstreamSha256);
assert.match(professional.packagingNotes, /one README link/);

await assert.rejects(
  readdir(join(siteRoot, "public", "downloads")),
  (error) => error.code === "ENOENT",
  "public/downloads must not exist",
);
const distFiles = await readdir(join(siteRoot, "dist"), { recursive: true, withFileTypes: true });
for (const file of distFiles) {
  if (!file.isFile()) continue;
  assert.ok(!file.name.endsWith(".zip"), `published ZIP: ${file.name}`);
  if (!/\.(?:css|html|js|json|map|txt|xml)$/.test(file.name)) continue;
  const contents = await readFile(join(file.parentPath, file.name), "utf8");
  assert.doesNotMatch(contents, /content\/downloads|"assetPath"/);
}
await assert.rejects(
  readdir(join(siteRoot, "dist", "downloads")),
  (error) => error.code === "ENOENT",
  "built site must not contain a direct downloads route",
);

console.log(
  "Verified 84 starter archives and 3 integration archives offline: private asset paths, manifest checksums, source identities, safe members, public references, native closures, and no published ZIP route.",
);
