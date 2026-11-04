import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? await import(process.env.PLAYWRIGHT_MODULE)
  : require("playwright");
const origin = process.env.MARKETPLACE_URL || "http://127.0.0.1:4317";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 1000 } });
const errors = [];
const external = [];
page.on("request", request => { const url = new URL(request.url()); if (![new URL(origin).origin, "https://fonts.googleapis.com", "https://fonts.gstatic.com"].includes(url.origin)) external.push(url.origin); });
page.on("pageerror", (error) => errors.push(error.message));
await page.route("https://fonts.googleapis.com/**", (route) =>
  route.fulfill({ status: 200, contentType: "text/css", body: "" }),
);
await page.goto(origin);
await page
  .getByRole("heading", {
    name: "Build a register. Connect an existing system.",
  })
  .waitFor();
await page.getByRole("button", { name: "Tracking preferences", exact: true }).click();
await page.getByText("Tracking is disabled in local preview.", { exact: false }).waitFor();
await page.getByRole("button", { name: "Close tracking preferences", exact: true }).click();
await page.locator('[data-filter="starter"]').click();
assert.equal(await page.locator("[data-free-pack]:visible").count(), 84);
assert.equal(await page.locator("[data-group]:visible").count(), 1);
await page.locator('[data-filter="evidence"]').click();
assert.equal(await page.locator("[data-free-pack]:visible").count(), 2);
assert.equal(await page.locator('[data-group="starter"]:visible').count(), 0);
await page.locator('[data-filter="all"]').click();
await page.getByLabel("Search free packs").fill("DHIS2");
assert.equal(await page.locator("[data-free-pack]:visible").count(), 1);
await page.locator("[data-free-pack]:visible a[data-pack]").first().click();
await page
  .getByText("Connect a source for fact checks.", { exact: true })
  .waitFor();
assert.equal(new URL(page.url()).pathname, "/packs/dhis2-tracker/");
await page.getByText("Studio import coming soon", { exact: true }).waitFor();
await page.getByRole("link", { name: "Download pack", exact: false }).click();
await page.getByRole("dialog").waitFor();
assert.equal(await page.getByRole("dialog").getByRole("button", { name: "Send request", exact: true }).isDisabled(), true);
await page.getByRole("dialog").getByLabel("Email address").fill("preview@example.test");
await page.getByRole("dialog").getByRole("button", { name: /Close/ }).click();
await page.goto(origin + "/packs/farmer-registry/");
await page.getByRole("link", { name: "Use in Studio" }).click();
assert.equal(new URL(page.url()).pathname, "/studio/farmer-registry/");
await page.getByText("registry-studio start", { exact: true }).waitFor();
await page.goto(origin + "/packs/licensing-service/");
assert.equal(
  await page
    .getByRole("link", { name: "Download pack", exact: false })
    .count(),
  0,
);
await page.getByText("Coming soon", { exact: true }).waitFor();
await page.goto(origin + "/packs/animal-health-status/");
await page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "02 Records and fields" }).click();
const record = page.locator("#record-assessment");
assert.equal(await record.locator(".mp-field-content").isVisible(), false);
await record.getByText("View 9 fields", { exact: true }).click();
assert.equal(await record.locator(".mp-field-content").isVisible(), true);
await record.getByText("Technical field metadata", { exact: true }).click();
await record.getByText("assessment-code: string", { exact: true }).waitFor();
const profile = page.locator(".mp-profile").first();
await profile.locator("summary").first().click();
assert.equal(await profile.locator(".mp-profile-content").isVisible(), true);
await page.goto(origin + "/packs/professional-licensing/");
await page.getByRole("link", { name: "Prepare a contribution" }).click();
assert.equal(
  new URL(page.url()).searchParams.get("basedOn"),
  "professional-licensing",
);
await page
  .getByText("Based on: Professional licensing", { exact: true })
  .waitFor();
await page.getByLabel("Pack name").fill("Public example adaptation");
await page.getByLabel("Repository URL").fill("https://example.org/pack");
await page
  .getByLabel("Pack type", { exact: true })
  .selectOption({ label: "Registry starter" });
await page
  .getByLabel("Licence", { exact: true })
  .selectOption({ label: "Apache 2.0" });
await page
  .getByLabel("What does it help someone do?")
  .fill("An adaptation with synthetic examples.");
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "Continue on GitHub" }).click();
const href = await page
  .getByRole("link", { name: "Open GitHub draft" })
  .getAttribute("href");
const github = new URL(href);
assert.equal(github.hostname, "github.com");
assert.equal(github.pathname, "/registrystack/registry-stack/issues/new");
assert.ok(
  github.searchParams.get("body").includes("Based on: Professional licensing"),
);
assert.ok(github.searchParams.get("body").includes("https://example.org/pack"));
await page.getByRole("button", { name: "Keep editing" }).click();
mkdirSync("test-results", { recursive: true });
for (const width of [1488, 1024, 736, 375, 320]) {
  await page.setViewportSize({ width, height: 1000 });
  for (const path of [
    "/",
    "/packs/dhis2-tracker/",
    "/packs/professional-licensing/",
    "/collections/licensing/",
    "/privacy/",
    "/contribute/",
    "/studio/farmer-registry/",
  ]) {
    await page.goto(origin + path);
    if (path === "/") {
      const headers = await page.locator("[data-group=starter] .mp-pack-art").evaluateAll(nodes => nodes.slice(0, 12).map(node => node.getBoundingClientRect().height));
      assert.ok(Math.max(...headers) - Math.min(...headers) < 1, "regular catalogue header heights at " + width);
      assert.ok(headers[0] < 100, "compact catalogue header at " + width);
    }
    if (path === "/packs/professional-licensing/") {
      await page.locator(".mp-record-fields > summary").first().click();
      await page.locator(".mp-profile > summary").first().click();
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert.equal(overflow, false, path + " overflow at " + width);
    if (path.startsWith("/packs/")) {
      await page.locator("[data-request-access]").click();
      const modal = page.getByRole("dialog");
      const bounds = await modal.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, "request popup fits " + width);
      assert.equal(await modal.evaluate(node => node.scrollWidth > node.clientWidth), false);
      await modal.press("Escape");
      assert.equal(await page.locator("[data-request-access]").evaluate(node => node === document.activeElement), true);
    }
    if (width === 1024 || width === 375)
      await page.screenshot({
        path:
          "test-results/" +
          (path === "/" ? "home" : path.split("/")[1]) +
          "-" +
          width +
          ".png",
        fullPage: false,
      });
  }
}
await page.goto(origin + "/#licensing");
await page.waitForURL("**/collections/licensing/");
assert.equal(await page.locator("[data-free-pack]").count(), 8);
const downloads = JSON.parse(readFileSync("data/downloads.json", "utf8"));
for (const item of Object.values(downloads)) {
  const response = await page.request.get(origin + "/downloads/" + item.assetPath.split("/").pop());
  assert.equal(response.status(), 404);
}
const missing = await page.request.get(origin + "/missing-page/");
assert.equal(missing.status(), 404);
assert.deepEqual(errors, []);
assert.deepEqual(external, []);
await browser.close();
console.log(
  "PASS: request popup, all 87 archive routes blocked, deep links, Studio instructions, GitHub draft attribution, paid coming-soon, five responsive widths with expandable starter details, 404, no JavaScript errors.",
);
