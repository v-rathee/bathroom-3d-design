import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const url = new URL('../Bathroom-3D.html', import.meta.url).href;
const snapshot = page => page.evaluate(() => window.bathroomViewer.snapshot());

test.beforeEach(async ({ page }) => {
  await page.goto(url);
  await page.waitForFunction(() => window.bathroomViewer);
  expect((await snapshot(page)).error).toBeNull();
  expect((await snapshot(page)).ready).toBe(true);
});

test('standalone opens offline with only the combined layout and outside basin', async ({ page }) => {
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.route(/^https?:/, route => route.abort());
  await page.reload();
  await page.waitForFunction(() => window.bathroomViewer?.snapshot().ready);
  const state = await snapshot(page);
  expect(state.layout).toBe('combined');
  expect(state.basinPlacement).toBe('outside');
  expect(state.geometry.matches).toBe(true);
  expect(state.geometry.floor).toEqual({ width: 96, depth: 48 });
  expect(state.geometry.wc).toEqual({ width: 15, depth: 25, front: 22, back: 47, height: 32.5 });
  expect(state.geometry.basin).toMatchObject({ left: 39, width: 18, depth: 14, front: -18, back: -4 });
  await expect(page.locator('#compare-toggle, #basin-placement, #existing-heading, #existing-plan-host, #panel-decision')).toHaveCount(0);
  expect(Object.keys(state)).not.toContain('comparison');
  expect(Object.keys(state)).not.toContain('baselineVariant');
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  expect(await page.locator('#third-party-license').textContent()).toContain('Permission is hereby granted');
});

test('published root uses content-versioned assets rather than a poisoned stale unversioned script', async ({ page }) => {
  const staleRequests = [], requests = [], errors = [];
  const files = new Map([
    ['/', { bytes: await readFile(path.join(root, 'index.html')), type: 'text/html' }],
    ['/styles.css', { bytes: await readFile(path.join(root, 'styles.css')), type: 'text/css' }],
    ['/dist/viewer.js', { bytes: await readFile(path.join(root, 'dist', 'viewer.js')), type: 'text/javascript' }],
  ]);
  const server = createServer((request, response) => {
    const target = new URL(request.url, 'http://localhost');
    const file = files.get(target.pathname);
    requests.push(target);
    if (target.pathname === '/dist/viewer.js' && !target.searchParams.has('v')) {
      staleRequests.push(target.href);
      response.writeHead(200, { 'Content-Type': 'text/javascript' });
      response.end('window.staleViewerLoaded = true;');
      return;
    }
    response.writeHead(file ? 200 : 404, { 'Content-Type': file?.type ?? 'text/plain' });
    response.end(file?.bytes ?? 'Not found');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  page.on('pageerror', error => errors.push(error.message));
  try {
    const address = server.address();
    const response = await page.goto(`http://127.0.0.1:${address.port}/`);
    expect(response.status()).toBe(200);
    await page.waitForFunction(() => window.bathroomViewer?.snapshot().ready);
    for (const asset of ['/styles.css', '/dist/viewer.js']) {
      const request = requests.find(target => target.pathname === asset);
      const expected = createHash('sha256').update(files.get(asset).bytes).digest('hex').slice(0, 12);
      expect(request.searchParams.get('v')).toBe(expected);
    }
    expect(staleRequests).toEqual([]);
    await page.locator('[data-tab="plumber"]').click();
    expect((await snapshot(page)).plumber).toBe(true);
    expect((await snapshot(page)).visible.plumber).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await page.goto('about:blank');
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('all seven combined-room fixture inspectors work', async ({ page }) => {
  for (const id of ['toilet', 'shower', 'bucket', 'heater', 'shelf', 'basin', 'drain']) {
    await page.locator(`.item-card[data-item="${id}"]`).click();
    expect((await snapshot(page)).selected).toBe(id);
    await expect(page.locator(`.item-card[data-item="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#item-description')).not.toBeEmpty();
  }
  await page.locator('.item-card[data-item="basin"]').click();
  await expect(page.locator('#item-title')).toHaveText('Existing outside washbasin');
});

test('wall modes, labels, dimensions, approach overlay and finishes preserve behavior', async ({ page }) => {
  await page.locator('#wall-mode').selectOption('full');
  expect((await snapshot(page)).visible.fullWalls).toBe(true);
  await expect(page.locator('#wall-caption')).toContainText('144 in');
  await page.locator('#wall-mode').selectOption('hidden');
  expect((await snapshot(page)).visible).toMatchObject({ fullWalls: false, cutawayWalls: false });
  await page.locator('#wall-mode').selectOption('cutaway');
  expect((await snapshot(page)).visible.cutawayWalls).toBe(true);
  for (const id of ['dimensions', 'labels']) {
    await page.locator(`#${id}`).uncheck();
    expect((await snapshot(page)).visible[id]).toBe(false);
    await page.locator(`#${id}`).check();
  }
  await page.locator('#clearances').check();
  await page.locator('#old-wall').check();
  expect((await snapshot(page)).visible).toMatchObject({ clearances: true, removed: true });
  await page.locator('[data-finish="sand"]').click();
  expect((await snapshot(page)).finish).toBe('sand');
  await page.locator('[data-finish="sage"]').click();
  expect((await snapshot(page)).finish).toBe('sage');
});

test('right inward door and all camera presets work', async ({ page }) => {
  expect((await snapshot(page)).doorAngleDegrees).toBe(-90);
  expect((await snapshot(page)).doorTips.proposed).toEqual({ x: 96, d: 29 });
  await page.locator('#door-toggle').click();
  expect((await snapshot(page)).doorAngleDegrees).toBe(0);
  await page.locator('#door-angle').fill('55');
  expect((await snapshot(page)).doorAngleDegrees).toBeCloseTo(-55);
  await page.locator('[data-view="top"]').click();
  expect((await snapshot(page)).camera.type).toBe('OrthographicCamera');
  await page.locator('[data-view="inside"]').click();
  expect((await snapshot(page)).view).toBe('inside');
  await page.locator('[data-view="plan"]').click();
  await expect(page.locator('#plan-host svg')).toBeVisible();
  await expect(page.locator('#save-image')).toBeDisabled();
  await expect(page.locator('#plan-host [data-door-angle]')).toHaveAttribute('data-door-angle', '55');
  await page.locator('#reset-view').click();
  await expect(page.locator('#save-image')).toBeEnabled();
});

test('raycasting, wheel zoom, orbit and pan move the actual combined-room camera', async ({ page }) => {
  await page.locator('.item-card[data-item="shower"]').click();
  await page.locator('[data-view="top"]').click();
  const point = (await snapshot(page)).fixtureScreenPoints.toilet;
  const canvas = page.locator('#canvas-host canvas');
  await canvas.click({ position: point });
  expect((await snapshot(page)).selected).toBe('toilet');
  const bounds = await canvas.boundingBox();
  const pane = (await snapshot(page)).viewports.proposed;
  const x = bounds.x + pane.left + pane.width * 0.6;
  const y = bounds.y + pane.top + pane.height * 0.6;
  await page.mouse.move(x, y);
  const zoom = (await snapshot(page)).camera.zoom;
  await page.mouse.wheel(0, -250);
  await expect.poll(async () => (await snapshot(page)).camera.zoom).toBeGreaterThan(zoom);
  await page.locator('#reset-view').click();
  const before = (await snapshot(page)).camera.position;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 70, y + 30, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).camera.position).not.toEqual(before);
  const orbit = (await snapshot(page)).camera.position;
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(x + 100, y + 50, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  await expect.poll(async () => (await snapshot(page)).camera.position).not.toEqual(orbit);
});

test('clicking the Plumber tab actually activates the service overlays and status', async ({ page }) => {
  expect((await snapshot(page)).plumber).toBe(false);
  await page.locator('[data-tab="plumber"]').click();
  const state = await snapshot(page);
  expect(state.plumber).toBe(true);
  expect(state.visible.plumber).toBe(true);
  expect(state.visible.tileGuide).toBe(true);
  expect(state.plumberConcept.tileGuideWorldHeight).toBe(84);
  expect(state.plumberConcept.existingDrain.exactCentreVerified).toBe(false);
  expect(state.plumberConcept.geyserPointsInstalled).toBe(false);
  await expect(page.locator('#mode-status')).toHaveClass(/active/);
  await expect(page.locator('#mode-status')).toContainText('PLUMBER MODE ACTIVE');
  await expect(page.locator('#plumber-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#panel-plumber')).toBeVisible();
  expect(page.url()).toContain('#plumber');
});

test('header Plumber button toggles repeatedly and the tab can reactivate it', async ({ page }) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.locator('#plumber-toggle').click();
    expect((await snapshot(page)).plumber).toBe(true);
    await page.locator('#plumber-toggle').click();
    expect((await snapshot(page)).plumber).toBe(false);
    expect((await snapshot(page)).visible.plumber).toBe(false);
    await expect(page.locator('#mode-status')).not.toHaveClass(/active/);
    await expect(page.locator('#panel-layout')).toBeVisible();
    expect(page.url()).toContain('#design');
  }
  await page.locator('[data-tab="plumber"]').click();
  await page.locator('#open-plumber-view').click();
  expect((await snapshot(page)).plumber).toBe(true);
});

test('plumber URL works on a fresh page and same-document mode navigation', async ({ page }) => {
  await page.goto(`${url}#plumber`);
  await page.waitForFunction(() => window.bathroomViewer?.snapshot().plumber);
  await page.reload();
  await page.waitForFunction(() => window.bathroomViewer?.snapshot().plumber);
  await page.goto(`${url}#design`);
  await expect.poll(async () => (await snapshot(page)).plumber).toBe(false);
  await page.goto(`${url}#plumber`);
  await expect.poll(async () => (await snapshot(page)).visible.plumber).toBe(true);
});

test('tile guide, outside basin detail and handover links work without an inside-basin alternative', async ({ page }) => {
  await page.locator('[data-tab="plumber"]').click();
  await expect(page.locator('#plumber-quantities')).toContainText('151.89');
  await page.locator('#tile-line').uncheck();
  expect((await snapshot(page)).visible.tileGuide).toBe(false);
  await page.locator('#tile-line').check();
  await expect(page.locator('#plumber-pdf')).toHaveAttribute('href', 'Plumber-Concept.pdf');
  await expect(page.locator('#plumber-print')).toHaveAttribute('href', 'Plumber-Concept.html');
  await page.locator('#outside-basin-view').click();
  const state = await snapshot(page);
  expect(state.view).toBe('basin');
  expect(state.walls).toBe('full');
  expect(state.doorAngle).toBe(0);
  expect(state.visible.outsideBasinDesign).toBe(true);
  expect(state.basinPlacement).toBe('outside');
  await page.locator('.stage').screenshot({ path: path.join(root, 'Preview-Outside-Basin.png') });
  await page.locator('#reset-view').click();
  expect((await snapshot(page)).plumber).toBe(true);
});

test('checks and notes keep site safety and product assumptions explicit', async ({ page }) => {
  await page.locator('[data-tab="checks"]').click();
  await expect(page.locator('.check-row')).toHaveCount(17);
  await expect(page.locator('.check-row.pass')).toHaveCount(7);
  await expect(page.locator('.check-row.caution')).toHaveCount(4);
  await expect(page.locator('.check-row.unverified')).toHaveCount(6);
  await page.locator('[data-check="electrical"] summary').click();
  await expect(page.locator('[data-check="electrical"] p')).toContainText('No electrical compliance');
  await page.locator('[data-tab="notes"]').click();
  await expect(page.locator('#panel-notes')).toContainText('26 inches');
  await expect(page.locator('#panel-notes')).toContainText('on-site qualified professional');
});

test('one valid dimensioned plan reflects the door, wall trace and plumber survey zone', async ({ page }) => {
  await page.locator('#clearances').check();
  await page.locator('#old-wall').check();
  await page.locator('[data-view="plan"]').click();
  await expect(page.locator('.plan-host svg')).toHaveCount(1);
  for (const text of ['96 in / 8 ft', '48 in / 4 ft', '29 in entry', '22 in front', 'OUTSIDE', 'Removed 5.5 in wall']) {
    await expect(page.locator('#plan-host')).toContainText(text);
  }
  const valid = await page.locator('#plan-host svg').evaluate(svg =>
    !new DOMParser().parseFromString(new XMLSerializer().serializeToString(svg), 'image/svg+xml').querySelector('parsererror'));
  expect(valid).toBe(true);
  await page.locator('[data-tab="plumber"]').click();
  await page.locator('[data-view="plan"]').click();
  await expect(page.locator('#plan-host [data-site-ref="E1"]')).toHaveAttribute('data-exact-centre', 'unverified');
});

test('PNG and SVG exports contain the single combined layout', async ({ page }) => {
  await page.locator('h1').click();
  await page.keyboard.press('Escape');
  const pngReady = page.waitForEvent('download');
  await page.locator('#save-image').click();
  const png = await pngReady;
  expect(png.suggestedFilename()).toBe('Bathroom-perspective.png');
  await png.saveAs(path.join(root, 'Preview-3D.png'));
  const bytes = await readFile(path.join(root, 'Preview-3D.png'));
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.length).toBeGreaterThan(10000);
  await page.locator('h1').click();
  await page.screenshot({ path: path.join(root, 'Preview-Desktop.png'), fullPage: true });
  await page.locator('[data-tab="plumber"]').click();
  const svgReady = page.waitForEvent('download');
  await page.locator('#save-plan').click();
  const svg = await svgReady;
  expect(svg.suggestedFilename()).toBe('Bathroom-plumber-plan.svg');
  const chunks = [];
  for await (const chunk of await svg.createReadStream()) chunks.push(chunk);
  const source = Buffer.concat(chunks).toString('utf8');
  expect(source).toContain('data-site-ref="E1"');
  expect(source).toContain('Existing basin OUTSIDE');
  expect(source).not.toContain('INDIAN WC');
});

test('keyboard shortcuts do not hijack focused form controls', async ({ page }) => {
  await page.locator('h1').click();
  await page.keyboard.press('d');
  expect((await snapshot(page)).doorOpen).toBe(false);
  await page.keyboard.press('m');
  expect((await snapshot(page)).dimensions).toBe(false);
  await page.keyboard.press('t');
  expect((await snapshot(page)).view).toBe('top');
  await page.keyboard.press('h');
  expect((await snapshot(page)).view).toBe('perspective');
  await page.keyboard.press('Escape');
  expect((await snapshot(page)).selected).toBeNull();
  await page.locator('#wall-mode').focus();
  await page.keyboard.press('d');
  expect((await snapshot(page)).doorOpen).toBe(false);
});

test('desktop, tablet and phone layouts expose working Plumber controls without overlap', async ({ page }) => {
  for (const size of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    await page.setViewportSize(size);
    await page.locator('[data-tab="plumber"]').click();
    expect((await snapshot(page)).visible.plumber).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.waitForFunction(() =>
      document.querySelector('.stage-caption').getBoundingClientRect().top >= document.querySelector('.stage-toolbar').getBoundingClientRect().bottom);
    await page.locator('[data-view="plan"]').click();
    await expect(page.locator('#plan-host svg')).toBeVisible();
    await page.locator('#reset-view').click();
    await page.locator('#plumber-toggle').click();
    expect((await snapshot(page)).plumber).toBe(false);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.stage').screenshot({ path: path.join(root, 'Preview-mobile.png') });
  await page.locator('[data-tab="plumber"]').click();
  await page.locator('.stage').screenshot({ path: path.join(root, 'Preview-Plumber.png') });
});

test('WebGL failure is explicit while the combined plumber plan remains available', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(type)) return null;
      return getContext.call(this, type, ...args);
    };
  });
  await page.reload();
  await expect(page.locator('#viewer-error')).toBeVisible();
  expect((await snapshot(page)).ready).toBe(false);
  await expect(page.locator('#save-image')).toBeDisabled();
  await page.locator('[data-tab="plumber"]').click();
  await page.locator('[data-view="plan"]').click();
  await expect(page.locator('#plan-host svg')).toBeVisible();
  await expect(page.locator('#plan-host [data-site-ref="E1"]')).toHaveCount(1);
  await expect(page.locator('#viewer-error')).toBeHidden();
});

test('touch orbit and two-finger pinch operate the single room camera', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#reset-view').click();
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const bounds = await page.locator('#canvas-host canvas').boundingBox();
  const pane = (await snapshot(page)).viewports.proposed;
  const x = bounds.x + pane.left + pane.width / 2;
  const y = bounds.y + pane.top + pane.height * 0.6;
  const before = (await snapshot(page)).camera.position;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 40, y: y + 20, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await snapshot(page)).camera.position).not.toEqual(before);
  await page.locator('[data-view="top"]').click();
  const zoom = (await snapshot(page)).camera.zoom;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 30, y, id: 1 }, { x: x + 30, y, id: 2 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 60, y, id: 1 }, { x: x + 60, y, id: 2 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await snapshot(page)).camera.zoom).toBeGreaterThan(zoom);
  await client.detach();
});

test('printable plumber concept remains four valid combined-room sheets', async ({ page }) => {
  await page.goto(new URL('../Plumber-Concept.html', import.meta.url).href);
  await expect(page.locator('.sheet')).toHaveCount(4);
  await expect(page.locator('#p01')).toContainText('NOT soil-pipe coordinates');
  await expect(page.locator('#p02')).toContainText('No slope, finished level or step height is assigned');
  await expect(page.locator('#p03')).toContainText('No floor vanity proposed');
  await expect(page.locator('#p04')).toContainText('151.89');
  const valid = await page.locator('svg').evaluateAll(svgs => svgs.every(svg =>
    !new DOMParser().parseFromString(new XMLSerializer().serializeToString(svg), 'image/svg+xml').querySelector('parsererror')));
  expect(valid).toBe(true);
});
