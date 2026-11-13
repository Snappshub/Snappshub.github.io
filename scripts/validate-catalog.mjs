import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const raw = await readFile(new URL('../apps-data.json', import.meta.url), 'utf8');
const catalog = JSON.parse(raw);
assert.ok(Array.isArray(catalog.apps), 'apps-data.json must contain an apps array');
assert.ok(catalog.apps.length > 0, 'catalogue must not be empty');

const ids = new Set();
const allowedDevices = new Set(['android', 'androidtv', 'desktop', 'router']);
for (const [index, app] of catalog.apps.entries()) {
  const label = app.id || `row ${index + 1}`;
  assert.equal(typeof app.id, 'string', `${label}: id is required`);
  assert.match(app.id, /^[a-zA-Z0-9_-]+$/, `${label}: id contains unsupported characters`);
  assert.ok(!ids.has(app.id), `${label}: duplicate id`);
  ids.add(app.id);

  assert.ok(typeof (app.title || app.name) === 'string' && (app.title || app.name).trim(), `${label}: title is required`);
  assert.ok(typeof app.category === 'string' && app.category.trim(), `${label}: category is required`);
  assert.ok(Array.isArray(app.devices) && app.devices.length > 0, `${label}: at least one device is required`);
  for (const device of app.devices) assert.ok(allowedDevices.has(device), `${label}: unsupported device "${device}"`);
  assert.match(app.category, /^[a-zA-Z0-9_-]+$/, `${label}: category contains unsupported characters`);

  for (const field of ['url', 'sourceUrl']) {
    if (!app[field]) continue;
    let parsed;
    try { parsed = new URL(app[field]); }
    catch { assert.fail(`${label}: ${field} must be a valid absolute URL`); }
    assert.equal(parsed.protocol, 'https:', `${label}: ${field} must use HTTPS`);
    assert.equal(parsed.username, '', `${label}: ${field} must not contain embedded credentials`);
    assert.equal(parsed.password, '', `${label}: ${field} must not contain embedded credentials`);
  }

  if (app.icon) {
    const icon = String(app.icon).trim();
    if (/^https:\/\//i.test(icon)) {
      let parsed;
      try { parsed = new URL(icon); }
      catch { assert.fail(`${label}: icon must be a valid HTTPS URL`); }
      assert.equal(parsed.protocol, 'https:', `${label}: icon must use HTTPS`);
      assert.equal(parsed.username, '', `${label}: icon must not contain embedded credentials`);
      assert.equal(parsed.password, '', `${label}: icon must not contain embedded credentials`);
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(icon)) {
      assert.fail(`${label}: icon must not use an unsafe URL scheme`);
    } else if (icon.startsWith('./') || icon.startsWith('../') || icon.startsWith('/')) {
      assert.match(icon, /^\.\/assets\/[a-zA-Z0-9._/-]+$/, `${label}: local icon path must point into ./assets`);
    }
  }
}

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
for (const required of [
  'id="catalogView"',
  'id="appDetailsView"',
  'id="downloadModal"',
  'PUBLIC_CATALOGUE_ENDPOINT',
  'loadCatalogueData',
  'applyPublishedDefinitions',
  './apps-data.json?t='
]) {
  assert.ok(html.includes(required), `index.html is missing required catalogue element/reference: ${required}`);
}

for (const device of allowedDevices) {
  for (const id of [`cat-${device}`, `subcategories-${device}`, `grid-${device}`, `count-${device}`, `viewMore-${device}`]) {
    assert.ok(html.includes(`id="${id}"`), `index.html is missing the ${device} device catalogue element: ${id}`);
  }
}
assert.match(html, /router:\s*\{\s*label:\s*['"]Router Firmware['"]/,
  'device renderer must include the router device group');
assert.match(html, /const discovered = apps[\s\S]*?deviceCatalogs\[slug\]\.categories = \[\.\.\.new Set\(\[\.\.\.assigned, \.\.\.discovered\]\)\]/,
  'device categories must be discovered from published app assignments, including static fallback data');
assert.doesNotMatch(html, /SHA-256 Signatures|Free from Adware|Online 100%|VirusTotal|100% clean builds|tamper signatures|Scanned with VirusTotal|high-availability CDN|d5a7f98e72c83b4|Direct High-Speed|DIRECT CDN|High-Speed CDN|Zero wait time|unrestricted multi-thread|Lightning Fast Premium Hosting Cloud|High-Speed Gigabit VPN|Instant Download|Active Builds|CRITICAL RECOVERY|modded utility builds|CDN Pipe Ready|Authenticated!|TFTP, Odin|SP Flash utilities/i, 'Website must not claim unverified security scans, delivery infrastructure, modified builds, or download verification');
console.log(`Catalogue validation passed: ${catalog.apps.length} apps, ${ids.size} unique IDs.`);
