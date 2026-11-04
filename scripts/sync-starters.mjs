import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const siteRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const downloadsDirectory = join(siteRoot, "content", "downloads");
const privateRepository = /github\.com[/:]registrystack\/(?:registry-studio|breg-registry-starters)/i;
const approvedRegistryHosts = new Set([
  "docs.registrystack.org",
  "id.registrystack.org",
  "registrystack.org",
  "www.registrystack.org",
]);

const usage = `Usage:
  node scripts/sync-starters.mjs \\
    --website-root /absolute/path/to/registrystack.org \\
    --website-revision <expected-head> \\
    --studio-root /absolute/path/to/registry-studio \\
    --studio-revision <expected-head>`;

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    assert.ok(key?.startsWith("--") && value, usage);
    options[key.slice(2)] = value;
  }
  for (const key of ["website-root", "website-revision", "studio-root", "studio-revision"]) {
    assert.ok(options[key], `Missing --${key}\n${usage}`);
  }
  return options;
}

function gitHead(root) {
  const result = spawnSync(
    "git",
    ["--no-optional-locks", "-C", root, "rev-parse", "HEAD"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, `Cannot read Git HEAD for ${root}: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readZipMembers(zip, archivePath) {
  const endSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;
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
  assert.ok(centralOffset + centralSize <= endOffset, `${archivePath}: invalid central directory`);

  const members = new Map();
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(zip.readUInt32LE(offset), centralSignature, `${archivePath}: invalid entry ${index}`);
    const compressionMethod = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const name = zip.subarray(nameStart, nameStart + nameLength).toString("utf8");
    assert.ok(name && !name.startsWith("/") && !name.includes("\\"), `${archivePath}: unsafe ${name}`);
    assert.ok(!name.split("/").includes(".."), `${archivePath}: unsafe ${name}`);
    assert.ok(!members.has(name), `${archivePath}: duplicate ${name}`);

    assert.equal(zip.readUInt32LE(localHeaderOffset), localSignature, `${archivePath}: bad ${name}`);
    const localNameLength = zip.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = zip.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = zip.subarray(dataStart, dataStart + compressedSize);
    let contents;
    if (compressionMethod === 0) contents = compressed;
    else if (compressionMethod === 8) contents = inflateRawSync(compressed);
    else assert.fail(`${archivePath}: unsupported ZIP compression ${compressionMethod}`);
    assert.equal(contents.length, uncompressedSize, `${archivePath}: size mismatch for ${name}`);
    members.set(name, contents);

    offset = nameStart + nameLength + extraLength + commentLength;
  }
  assert.equal(offset, centralOffset + centralSize, `${archivePath}: central directory size mismatch`);
  return members;
}

function assertNoPrivatePointers(zip, archivePath) {
  for (const [name, contents] of readZipMembers(zip, archivePath)) {
    const text = contents.toString("utf8");
    assert.doesNotMatch(text, privateRepository, `${archivePath}: ${name}`);
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
}

function parseSolutionAreas(source) {
  const match = source.match(
    /export const solutionAreas: readonly SolutionArea\[\] = (\[[\s\S]*?\]) as const;/,
  );
  assert.ok(match, "Could not locate solutionAreas in the website source");
  return Function(`"use strict"; return (${match[1]});`)();
}

function withoutDownload(starter) {
  const { download: _download, ...metadata } = starter;
  return metadata;
}

const derivativePython = String.raw`
import sys
from zipfile import ZipFile

source, destination, member, old, replacement = sys.argv[1:]
found = False
with ZipFile(source, "r") as incoming, ZipFile(destination, "w") as outgoing:
    for info in incoming.infolist():
        contents = incoming.read(info)
        if info.filename == member:
            text = contents.decode("utf-8")
            if text.count(old) != 1:
                raise SystemExit(f"expected one private README sentence, found {text.count(old)}")
            contents = text.replace(old, replacement).encode("utf-8")
            found = True
        outgoing.writestr(info, contents, compress_type=info.compress_type)
if not found:
    raise SystemExit(f"missing derivative member: {member}")
`;

async function createProfessionalDerivative(sourcePath, destinationPath) {
  const member = "professional-licensing-starter/README.md";
  const old =
    "A separate optional [reviewed licensing example](https://github.com/registrystack/breg-registry-starters/blob/main/docs/reviewed-licensing.md) demonstrates applicant intake and exact final-terms approval; repository access is required.";
  const replacement =
    "A separate optional reviewed licensing example in the Registry Stack starter catalogue demonstrates applicant intake and exact final-terms approval.";
  const result = spawnSync(
    "uv",
    ["run", "python", "-c", derivativePython, sourcePath, destinationPath, member, old, replacement],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        UV_CACHE_DIR: "/private/tmp/registrystack-marketplace-uv-cache",
      },
    },
  );
  assert.equal(result.status, 0, `Could not package professional-licensing: ${result.stderr.trim()}`);
}

const options = parseArguments(process.argv.slice(2));
const websiteRoot = resolve(options["website-root"]);
const studioRoot = resolve(options["studio-root"]);
assert.equal(
  gitHead(websiteRoot),
  options["website-revision"],
  "Public website checkout drifted from the explicitly selected revision",
);
assert.equal(
  gitHead(studioRoot),
  options["studio-revision"],
  "Registry Studio checkout drifted from the explicitly selected revision",
);

const websiteCataloguePath = join(websiteRoot, "src", "data", "starters.json");
const websiteSolutionsPath = join(websiteRoot, "src", "data", "solutions.ts");
const studioCataloguePath = join(studioRoot, "catalogue", "catalogue.json");
const studioPinPath = join(studioRoot, "catalogue", "PIN.json");
const studioStartersDirectory = join(studioRoot, "catalogue", "starters");

const [websiteCatalogueBytes, websiteSolutions, studioCatalogueBytes, studioPinBytes] =
  await Promise.all([
    readFile(websiteCataloguePath),
    readFile(websiteSolutionsPath, "utf8"),
    readFile(studioCataloguePath),
    readFile(studioPinPath),
  ]);
const websiteCatalogue = JSON.parse(websiteCatalogueBytes);
const studioCatalogue = JSON.parse(studioCatalogueBytes);
const studioPin = JSON.parse(studioPinBytes);

assert.equal(sha256(studioCatalogueBytes), studioPin.catalogueSha256, "Studio catalogue pin mismatch");
assert.equal(studioCatalogue.starters.length, 84, "Studio catalogue must contain 84 starters");
assert.equal(studioPin.starterCount, 84, "Studio pin must cover 84 starters");
assert.equal(websiteCatalogue.starters.length, 84, "Website catalogue must contain 84 starters");

const websiteIds = websiteCatalogue.starters.map(({ id }) => id);
const studioIds = studioCatalogue.starters.map(({ id }) => id);
assert.deepEqual(websiteIds, studioIds, "Website and Studio starter IDs or ordering differ");
const websiteById = new Map(websiteCatalogue.starters.map((starter) => [starter.id, starter]));
const differingStarterIds = studioCatalogue.starters
  .filter((starter) =>
    JSON.stringify(withoutDownload(starter)) !==
    JSON.stringify(withoutDownload(websiteById.get(starter.id))),
  )
  .map(({ id }) => id);
assert.equal(differingStarterIds.length, 36, "Unexpected website/Studio metadata difference count");

const sourceArchives = new Map();
for (const starter of studioCatalogue.starters) {
  const fileName = basename(starter.download.path);
  const archivePath = join(studioStartersDirectory, fileName);
  const bytes = await readFile(archivePath);
  assert.equal(bytes.length, starter.download.bytes, `${starter.id}: Studio archive byte count`);
  assert.equal(sha256(bytes), starter.download.sha256, `${starter.id}: Studio archive checksum`);
  sourceArchives.set(starter.id, { archivePath, bytes, fileName });
}

const privateArchiveHits = [];
for (const [id, { archivePath, bytes }] of sourceArchives) {
  for (const [name, contents] of readZipMembers(bytes, archivePath)) {
    if (privateRepository.test(contents.toString("utf8"))) privateArchiveHits.push({ id, name });
    privateRepository.lastIndex = 0;
  }
}
assert.deepEqual(privateArchiveHits, [
  {
    id: "professional-licensing",
    name: "professional-licensing-starter/README.md",
  },
]);

const solutionAreas = parseSolutionAreas(websiteSolutions);
const collections = solutionAreas
  .filter(({ kind }) => kind === "register-family")
  .map((area) => ({
    key: area.key,
    title: area.name,
    description: area.description,
    intent: area.intent,
    starterIds: [...area.starters],
    featuredStarter: area.featuredStarter ?? null,
    openFirst: [...(area.openFirst ?? [])],
    mainSiteUrl: new URL(area.slug, "https://registrystack.org").href,
  }));
const assignedIds = collections.flatMap(({ starterIds }) => starterIds);
assert.equal(collections.length, 7, "Expected seven register-family collections");
assert.equal(new Set(assignedIds).size, 84, "A starter is missing or assigned more than once");
assert.deepEqual([...assignedIds].sort(), [...studioIds].sort(), "Collection coverage differs");

const existingDownloads = JSON.parse(await readFile(join(siteRoot, "data", "downloads.json")));
const integrationIds = ["dhis2-tracker", "opencrvs-event-search", "odk-central"];
const integrations = Object.fromEntries(
  integrationIds.map((id) => {
    assert.ok(existingDownloads[id], `Missing existing integration download metadata: ${id}`);
    const existing = existingDownloads[id];
    const fileName = basename(existing.assetPath ?? existing.url);
    const { url: _url, ...metadata } = existing;
    return [id, { ...metadata, assetPath: `content/downloads/${fileName}` }];
  }),
);

await mkdir(downloadsDirectory, { recursive: true });
for (const [id, { archivePath, fileName }] of sourceArchives) {
  const destinationPath = join(downloadsDirectory, fileName);
  if (id === "professional-licensing") {
    await createProfessionalDerivative(archivePath, destinationPath);
  } else {
    await copyFile(archivePath, destinationPath);
  }
}

const starterDownloads = {};
for (const starter of studioCatalogue.starters) {
  const { archivePath: sourcePath, bytes: upstreamBytes, fileName } = sourceArchives.get(starter.id);
  const destinationPath = join(downloadsDirectory, fileName);
  const packagedBytes = await readFile(destinationPath);
  assertNoPrivatePointers(packagedBytes, destinationPath);
  const packagedSha256 = sha256(packagedBytes);
  const isDerivative = packagedSha256 !== starter.download.sha256;
  if (isDerivative) assert.equal(starter.id, "professional-licensing");

  if (isDerivative) {
    const upstreamMembers = readZipMembers(upstreamBytes, sourcePath);
    const packagedMembers = readZipMembers(packagedBytes, destinationPath);
    assert.deepEqual([...packagedMembers.keys()], [...upstreamMembers.keys()]);
    const readme = `${starter.id}-starter/README.md`;
    for (const [name, contents] of upstreamMembers) {
      if (name !== readme) {
        assert.deepEqual(packagedMembers.get(name), contents, `${starter.id}: changed ${name}`);
      }
    }
    for (const attribution of ["LICENSE", "NOTICE", "PUBLICSCHEMA-LICENSE.txt"])
      assert.ok(packagedMembers.has(`${starter.id}-starter/${attribution}`));
  }

  starter.download = {
    path: `content/downloads/${fileName}`,
    sha256: packagedSha256,
    bytes: packagedBytes.length,
  };
  starterDownloads[starter.id] = {
    kind: "starter",
    assetPath: `content/downloads/${fileName}`,
    sha256: packagedSha256,
    bytes: packagedBytes.length,
    ...(isDerivative
      ? {
          upstreamSha256: sha256(upstreamBytes),
          packagingNotes:
            `Public marketplace derivative: one README link to a private starter catalogue was replaced by a non-linked Registry Stack starter catalogue reference. The other ${readZipMembers(upstreamBytes, sourcePath).size - 1} archive members retain their upstream bytes.`,
        }
      : {}),
    source: {
      kind: "Registry Studio pinned starter catalogue export",
      catalogueSha256: studioPin.catalogueSha256,
      assetSetTreeSha256: studioPin.assetSetTreeSha256,
      breg: studioCatalogue.source.breg,
      publicschema: studioCatalogue.source.publicschema,
    },
    format: "Registry Studio starter ZIP",
    nativeUse:
      `Extract the archive, follow ${starter.id}-starter/README.md, and use its project/ directory as the native starter source with matching Registry Studio and Registry Stack versions.`,
  };
}

studioCatalogue.marketplaceImport = {
  activeMetadata: "Pinned Registry Studio 0.44.0 catalogue rows matching the packaged downloads.",
  assetPin: {
    catalogueSha256: studioPin.catalogueSha256,
    assetSetTreeSha256: studioPin.assetSetTreeSha256,
    starterCount: studioPin.starterCount,
  },
  websiteComparison: {
    publicWebsiteRevision: options["website-revision"],
    metadataSource: websiteCatalogue.source,
    sameStarterIds: true,
    differingStarterIds,
    note: "The public website snapshot used BReg 0.42.0-dev. Active marketplace metadata and downloads use the pinned 0.44.0 Studio catalogue; only family membership and ordering come from the website solution areas.",
  },
};

const downloads = { ...starterDownloads, ...integrations };
assert.equal(Object.keys(downloads).length, 87);
for (const [name, manifest] of [
  ["starter-catalogue.json", studioCatalogue],
  ["collections.json", collections],
  ["downloads.json", downloads],
]) {
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  assert.doesNotMatch(serialized, privateRepository, `${name}: private repository reference`);
  await writeFile(join(siteRoot, "data", name), serialized);
}

for (const id of integrationIds) {
  const entry = integrations[id];
  const path = join(siteRoot, entry.assetPath);
  const bytes = await readFile(path);
  assert.equal(bytes.length, entry.bytes, `${id}: preserved byte count`);
  assert.equal(sha256(bytes), entry.sha256, `${id}: preserved checksum`);
  assertNoPrivatePointers(bytes, path);
}

const totalBytes = (
  await Promise.all(Object.values(downloads).map(({ assetPath }) => stat(join(siteRoot, assetPath))))
).reduce((sum, file) => sum + file.size, 0);
console.log(
  `Imported 84 pinned Studio starters and preserved 3 integration assets (${totalBytes} bytes); ` +
    `packaged 1 README-only public derivative and recorded ${differingStarterIds.length} website metadata differences.`,
);
