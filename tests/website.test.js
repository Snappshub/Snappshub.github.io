const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const apps = JSON.parse(fs.readFileSync(path.join(root, "apps-data.json"), "utf8")).apps;
const details = fs.readFileSync(path.join(root, "app-details.html"), "utf8");

test("catalogue is valid and has unique stable app IDs", () => {
  assert.ok(Array.isArray(apps) && apps.length > 0);
  const ids = apps.map(app => app.id);
  assert.ok(ids.every(id => typeof id === "string" && id.trim()));
  assert.equal(new Set(ids).size, ids.length);
});

test("catalogue entries have titles, categories and HTTPS source links", () => {
  for (const app of apps) {
    assert.ok(typeof app.title === "string" && app.title.trim(), app.id);
    assert.ok(typeof app.category === "string" && app.category.trim(), app.id);
    const links = [app.url, app.downloadUrl, app.sourceUrl].filter(Boolean);
    assert.ok(links.length, app.id + " has no link");
    for (const link of links) {
      const parsed = new URL(link);
      assert.equal(parsed.protocol, "https:", app.id + " has non-HTTPS link");
    }
  }
});

test("main page has no duplicate DOM IDs", () => {
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test("brand lockup and in-page app details entrypoint exist", () => {
  assert.match(html, /SN Apps Hub/);
  assert.match(html, /id=["']appDetailsView["']/);
  assert.match(html, /function viewAppDetails\s*\(/);
  assert.match(html, /function showCatalogView\s*\(/);
  assert.match(details, /SN Apps Hub|app-details/i);
  assert.match(details, /noindex,follow/);
  assert.match(details, /location\.replace/);
  assert.doesNotMatch(details, /CapCut Studio Pro|Full VIP unlocked|SHA-256 clean signature verified/i);
});

test("robots and sitemap reference the canonical website", () => {
  const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  assert.match(robots, /Sitemap:\s*https:\/\//i);
  assert.match(sitemap, /<urlset[\s>]/i);
  assert.match(sitemap, /https:\/\//);
});

test("all local stylesheet and script references resolve", () => {
  const refs = [
    ...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']/gi)
  ].map(match => match[1]).filter(ref => !/^(?:https?:)?\/\//i.test(ref));
  for (const ref of refs) {
    const clean = ref.split("?")[0].replace(/^\.\//, "");
    assert.ok(fs.existsSync(path.join(root, clean)), "Missing local asset: " + ref);
  }
});


test("official Telegram and Gmail contacts use the configured destinations without exposing raw email text", () => {
  assert.match(html, /href=["']https:\/\/t\.me\/snappshub["']/);
  assert.match(html, /href=["']https:\/\/t\.me\/SnappsHubBot["']/);
  assert.match(html, /href=["']mailto:alaminsaheb2019@gmail\.com["']/);
  assert.match(html, /href=["']mailto:alaminsahebweb@gmail\.com["']/);
  assert.match(html, />\s*Gmail Support\s*</);
  assert.match(html, />\s*Gmail\s*</);
  assert.match(html, />\s*Gmail \(Alternate\)\s*</);
  const visibleText = html.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  assert.doesNotMatch(visibleText, /alaminsaheb(?:2019|web)@gmail\.com/i);
  assert.match(html, /href=["']https:\/\/t\.me\/snappshub["'][^>]*rel=["']noopener noreferrer["']/);
  assert.match(html, /href=["']https:\/\/t\.me\/SnappsHubBot["'][^>]*rel=["']noopener noreferrer["']/);
});
