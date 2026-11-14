import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';

const raw = await readFile(new URL('../apps-data.json', import.meta.url), 'utf8');
const catalog = JSON.parse(raw);
assert.ok(Array.isArray(catalog.apps), 'apps-data.json must contain an apps array');
assert.ok(catalog.apps.length > 0, 'catalogue must not be empty');

assert.ok(Array.isArray(catalog.categoryDefinitions), 'catalogue must contain categoryDefinitions');
const categorySlugs = new Set();
for (const [index, category] of catalog.categoryDefinitions.entries()) {
  const label = category.slug || `category row ${index + 1}`;
  assert.equal(typeof category.slug, 'string', `${label}: category slug is required`);
  assert.match(category.slug, /^[a-zA-Z0-9_-]+$/, `${label}: category slug contains unsupported characters`);
  assert.ok(!categorySlugs.has(category.slug), `${label}: duplicate category slug`);
  categorySlugs.add(category.slug);
  assert.ok(typeof category.name === 'string' && category.name.trim(), `${label}: category name is required`);
}

const primarySectorSlugs = ['android', 'androidtv', 'desktop', 'router'];
assert.deepEqual(catalog.categories, primarySectorSlugs, 'catalogue must expose exactly four primary sectors');
assert.ok(Array.isArray(catalog.devices), 'catalogue must define the four primary devices');
assert.deepEqual(catalog.devices.map(device => device.slug), primarySectorSlugs,
  'primary device order must be Android, Android TV, Desktop, Router');
const sectorIds = new Set(catalog.devices.map(device => device.id));
for (const category of catalog.categoryDefinitions) {
  if (primarySectorSlugs.includes(category.slug)) continue;
  assert.ok(Array.isArray(category.deviceIds) && category.deviceIds.length > 0,
    `${category.slug}: subcategory must be assigned to at least one primary sector`);
  for (const deviceId of category.deviceIds) {
    assert.ok(primarySectorSlugs.includes(deviceId), `${category.slug}: unknown primary sector ${deviceId}`);
  }
}

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
  assert.ok(categorySlugs.has(app.category), `${label}: app category has no category definition`);

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

const outboundFields = ['url', 'sourceUrl', 'mirror1', 'telegramSupportUrl', 'iconUrl'];
for (const [index, app] of catalog.apps.entries()) {
  const label = app.id || `row ${index + 1}`;
  for (const field of outboundFields) {
    if (!app[field]) continue;
    let parsed;
    try { parsed = new URL(app[field]); }
    catch { assert.fail(`${label}: ${field} must be an absolute URL`); }
    assert.equal(parsed.protocol, 'https:', `${label}: ${field} must use HTTPS`);
    assert.equal(parsed.username, '', `${label}: ${field} must not contain embedded credentials`);
    assert.equal(parsed.password, '', `${label}: ${field} must not contain embedded credentials`);
  }
  if (app.iconFile !== undefined) {
    assert.ok(typeof app.iconFile === 'string' && app.iconFile.startsWith('./assets/') &&
      app.iconFile.split('/').every(segment => segment && segment !== '.' && segment !== '..'),
      `${label}: iconFile must point into ./assets without traversal segments`);
  }
  if (app.mirrors !== undefined) {
    assert.ok(Array.isArray(app.mirrors), `${label}: mirrors must be an array`);
    for (const mirror of app.mirrors) {
      const mirrorUrl = typeof mirror === 'string' ? mirror : mirror?.url;
      assert.ok(typeof mirrorUrl === 'string' && mirrorUrl.trim(), `${label}: each mirror needs a URL`);
      let parsed;
      try { parsed = new URL(mirrorUrl); }
      catch { assert.fail(`${label}: mirror URL must be absolute`); }
      assert.equal(parsed.protocol, 'https:', `${label}: mirror URL must use HTTPS`);
      assert.equal(parsed.username, '', `${label}: mirror URL must not contain embedded credentials`);
      assert.equal(parsed.password, '', `${label}: mirror URL must not contain embedded credentials`);
    }
  }
}

const explicitIconApps = catalog.apps.filter(app => app.iconUrl || app.iconFile);
assert.ok(explicitIconApps.length >= 20, 'catalogue should include a growing set of explicit app-owned icons');
for (const app of catalog.apps) {
  if (!app.iconUrl) continue;
  const iconUrl = new URL(app.iconUrl);
  assert.equal(iconUrl.protocol, 'https:', `${app.id}: app icon URL must use HTTPS`);
  assert.ok(!/google\\.com$|icons\\.duckduckgo\\.com$/i.test(iconUrl.hostname),
    `${app.id}: generic website favicons are not original app artwork`);
}
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const htmlIds = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
assert.equal(new Set(htmlIds).size, htmlIds.length, 'index.html must not contain duplicate element IDs');

const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(match => !/\bsrc\s*=/.test(match[1]) && !/type=["']application\/ld\+json["']/i.test(match[1]));
for (const [index, script] of inlineScripts.entries()) {
  assert.doesNotThrow(() => new Script(script[2], { filename: 'index.html:inline-script-' + (index + 1) }),
    'index.html inline script ' + (index + 1) + ' must parse without syntax errors');
}

const newWindowAnchors = [...html.matchAll(/<a\b[^>]*\btarget="_blank"[^>]*>/g)].map(match => match[0]);
assert.ok(newWindowAnchors.length > 0, 'website must contain external links that the security test can inspect');
for (const anchor of newWindowAnchors) {
  assert.match(anchor, /\brel="[^"]*noopener[^"]*"/,
    'links opening a new tab must use rel=noopener');
}

const isLegacyRenderer = html.includes("const PRIMARY_SECTORS = ['android','androidtv','desktop','router']");
if (isLegacyRenderer) {
  assert.ok(html.includes('validIconSource(item.iconUrl)') && html.includes('validIconSource(item.iconFile)'),
    'app icon engine must prioritize explicit app icon URLs and bundled icon files');
  assert.ok(!html.includes('validIconSource(item.icon)'),
    'legacy favicon fields must not be treated as original app icons');
  assert.ok(html.includes('Only explicitly supplied app artwork or bundled local files count as app icons'),
    'icon engine must distinguish app artwork from publisher favicons');
  const navStart = html.indexOf('<nav class="device-nav"');
  const navEnd = html.indexOf('</nav>', navStart);
  const primaryNav = navStart >= 0 && navEnd >= 0 ? html.slice(navStart, navEnd + 6) : '';
  assert.equal((primaryNav.match(/data-sector=/g) || []).length, 4,
    'top navigation must contain exactly four primary device sectors');
  assert.ok(!primaryNav.includes('data-category='),
    'subcategories must not appear in the primary top navigation');
  assert.ok(html.includes("parsed.pathname === '/s2/favicons'"),
    'generic Google favicons must not be treated as publisher-owned app icons');
  for (const required of [
    'id="catalogView"', 'id="appDetailsView"', 'id="downloadModal"',
    'PUBLIC_CATALOGUE_ENDPOINT', 'loadCatalogueData', 'applyPublishedDefinitions', './apps-data.json?t='
  ]) assert.ok(html.includes(required), 'index.html is missing required catalogue element/reference: ' + required);
  assert.ok(html.includes('openDownloadModal(') && html.includes('JSON.stringify(String(item.id))'),
    'catalogue download actions must safely encode app IDs');
  assert.ok(html.includes("!parsedUrl.username && !parsedUrl.password"),
    'publisher download links must reject URLs containing embedded credentials');
  assert.ok(html.includes("telegramUrl.hostname === 't.me'"),
    'dynamic Telegram configuration must be restricted to the official t.me host');
  assert.ok(html.includes('parsed.username || parsed.password'),
    'publisher icon URLs must reject embedded credentials');
  assert.ok(html.includes('Repository / ') && html.includes('textContent ='),
    'breadcrumb must assign raw text through textContent without HTML entity double-escaping');
  for (const device of allowedDevices) {
    for (const id of ['cat-' + device, 'subcategories-' + device, 'grid-' + device, 'count-' + device, 'viewMore-' + device]) {
      assert.ok(html.includes('id="' + id + '"'), 'index.html is missing the ' + device + ' device catalogue element: ' + id);
    }
  }
  assert.match(html, /router:\s*\{\s*label:\s*['"]Router['"]/,
    'device renderer must include the router device group');
  assert.match(html, /const discovered = apps[\s\S]*?deviceCatalogs\[slug\]\.categories = \[\.\.\.new Set\(\[\.\.\.assigned, \.\.\.discovered\]\)\]/,
    'device categories must be discovered from published app assignments, including static fallback data');
  assert.doesNotMatch(html, /SHA-256 Signatures|Free from Adware|Online 100%|VirusTotal|100% clean builds|tamper signatures|Scanned with VirusTotal|high-availability CDN|d5a7f98e72c83b4|Direct High-Speed|DIRECT CDN|High-Speed CDN|Zero wait time|unrestricted multi-thread|Lightning Fast Premium Hosting Cloud|High-Speed Gigabit VPN|Instant Download|Active Builds|CRITICAL RECOVERY|modded utility builds|CDN Pipe Ready|Authenticated!|TFTP, Odin|SP Flash utilities/i,
    'Website must not claim unverified security scans, delivery infrastructure, modified builds, or download verification');
} else {
  assert.ok(html.includes('const STORE = '), 'live storefront must render from the Command Studio STORE configuration');
  const storeStart = html.indexOf('const STORE = ') + 'const STORE = '.length;
  const storeEnd = html.indexOf(';\n    let activeFolder', storeStart);
  assert.ok(storeEnd > storeStart, 'live storefront STORE configuration must be a bounded JSON object');
  const store = JSON.parse(html.slice(storeStart, storeEnd));
  assert.deepEqual(store.devices.map(device => device.slug), ['android','androidtv','desktop','router'],
    'live storefront must preserve Android, Android TV, Desktop, Router order');
  assert.ok(store.categories.length > 0, 'live storefront must define categories');
  const liveCategorySlugs = new Set(store.categories.map(category => category.slug));
  for (const app of store.apps) {
    assert.ok(Array.isArray(app.devices) && app.devices.length > 0, app.id + ': live app needs device assignments');
    for (const device of app.devices) assert.ok(allowedDevices.has(device), app.id + ': unsupported live device ' + device);
    assert.ok(liveCategorySlugs.has(app.category), app.id + ': live app category is undefined');
  }
  for (const required of [
    'id="device-nav"', 'id="category-tabs"', 'id="apps-grid"',
    'function renderDeviceTabs()', 'function renderCategoryTabs()',
    'function selectDevice(', 'function selectCategory(', 'function showMoreApps()',
    "let activeDevice = 'android'", 'let visibleCount = 6',
    'class="detail-source"', 'class="detail-shots"', 'id="mw2-timer"'
  ]) assert.ok(html.includes(required), 'live storefront is missing ' + required);
  const heroStart = html.indexOf('<section class="hero">');
  const heroEnd = html.indexOf('</section>', heroStart);
  const navIndex = html.indexOf('id="device-nav"');
  assert.ok(heroStart >= 0 && heroEnd > heroStart && navIndex > heroEnd,
    'device navigation must appear after Hero without replacing it');
  assert.ok(html.includes('#apps-grid{grid-template-columns:repeat(3,minmax(0,1fr))}'),
    'desktop catalogue must use a three-column grid');
  assert.ok(html.includes('function startMiniWindow2(url, label)') && html.includes('Your download will start shortly.'),
    'download handoff must show its timed preparation message');
}

console.log('Catalogue validation passed: ' + catalog.apps.length + ' apps, ' + htmlIds.length + ' unique HTML IDs.');
