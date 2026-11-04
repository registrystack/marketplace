import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("all 87 private download archives match their recorded checksums", () => {
  const downloads = JSON.parse(read("data/downloads.json"));
  assert.equal(Object.keys(downloads).length, 87);
  for (const value of Object.values(downloads)) {
    const bytes = readFileSync(new URL(`../../${value.assetPath}`, import.meta.url));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      value.sha256,
    );
    assert.equal(bytes.length, value.bytes);
    assert.ok(bytes.length > 100);
  }
});
