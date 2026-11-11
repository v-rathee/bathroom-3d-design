import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
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

test('standalone opens offline with no network assets, script leaks or browser errors', async ({ page }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.route(/^https?:/, route => route.abort());
  await page.reload();
  await page.waitForFunction(() => window.bathroomViewer?.snapshot().ready);
  const state = await snapshot(page);
  expect(state.geometry.matches).toBe(true);
  expect(state.geometry.wc).toEqual({ width: 15, depth: 25, front: 22, back: 47, height: 32.5 });
  expect(state.geometry.floor).toEqual({ width: 96, depth: 48 });
  expect(state.measurements.height).toBe(144);
  expect(state.measurements.wcFrontClearance).toBe(22);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  expect((await page.locator('body').innerText()).length).toBeLessThan(15000);
  expect(await page.locator('#third-party-license').textContent()).toContain('Permission is hereby granted');
  await expect(page.locator('#viewer-error')).toBeHidden();
});

test('GitHub Pages root entry point loads its relative script and stylesheet', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(new URL('../index.html', import.meta.url).href);
  await page.waitForFunction(() => window.bathroomViewer?.snapshot().ready);
  expect((await snapshot(page)).geometry.matches).toBe(true);
  expect(await page.locator('body').evaluate(element => getComputedStyle(element).fontFamily)).toContain('Segoe UI');
  await expect(page.locator('link[rel="license"]')).toHaveAttribute('href', 'THIRD-PARTY-NOTICES.txt');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /^data:image\/svg\+xml,/);
  expect(errors).toEqual([]);
});

test('all seven fixture inspectors select and show matching information', async ({ page }) => {
  for (const id of ['toilet', 'shower', 'bucket', 'heater', 'shelf', 'basin', 'drain']) {
    await page.locator(`.item-card[data-item="${id}"]`).click();
    expect((await snapshot(page)).selected).toBe(id);
    await expect(page.locator(`.item-card[data-item="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#item-description')).not.toBeEmpty();
  }
  await expect(page.locator('#item-category')).toContainText('plumbing survey');
});

test('wall modes, labels, dimensions, clearances, removed wall and finishes work', async ({ page }) => {
  await page.locator('#wall-mode').selectOption('full');
  expect((await snapshot(page)).visible).toMatchObject({ fullWalls: true, cutawayWalls: false });
  await expect(page.locator('#wall-caption')).toContainText('144 in');
  await page.locator('#wall-mode').selectOption('hidden');
  expect((await snapshot(page)).visible).toMatchObject({ fullWalls: false, cutawayWalls: false });
  await page.locator('#wall-mode').selectOption('cutaway');
  expect((await snapshot(page)).visible.cutawayWalls).toBe(true);
  for (const [id, key] of [['dimensions', 'dimensions'], ['labels', 'labels']]) {
    await page.locator(`#${id}`).uncheck();
    expect((await snapshot(page)).visible[key]).toBe(false);
    await page.locator(`#${id}`).check();
    expect((await snapshot(page)).visible[key]).toBe(true);
  }
  for (const [id, key] of [['clearances', 'clearances'], ['old-wall', 'removed']]) {
    await page.locator(`#${id}`).check();
    expect((await snapshot(page)).visible[key]).toBe(true);
  }
  await page.locator('[data-finish="sand"]').click();
  expect((await snapshot(page)).finish).toBe('sand');
  await expect(page.locator('[data-finish="sand"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-finish="sage"]').click();
  expect((await snapshot(page)).finish).toBe('sage');
});

test('door is outward opening and every camera preset works', async ({ page }) => {
  expect((await snapshot(page)).doorAngleDegrees).toBe(90);
  await page.locator('#door-toggle').click();
  expect((await snapshot(page)).doorAngleDegrees).toBe(0);
  await expect(page.locator('#door-toggle')).toHaveText('Door: closed');
  await page.locator('#door-toggle').click();
  expect((await snapshot(page)).doorAngleDegrees).toBe(90);
  await page.locator('[data-view="top"]').click();
  expect((await snapshot(page)).camera.type).toBe('OrthographicCamera');
  await page.locator('[data-view="inside"]').click();
  expect((await snapshot(page)).view).toBe('inside');
  await page.locator('[data-view="plan"]').click();
  await expect(page.locator('#plan-host svg')).toBeVisible();
  await expect(page.locator('#canvas-host')).toBeHidden();
  await expect(page.locator('#save-image')).toBeDisabled();
  await page.locator('#door-toggle').click();
  await expect(page.locator('#plan-host [data-door-state]')).toHaveAttribute('data-door-state', 'closed');
  await page.locator('#door-toggle').click();
  await expect(page.locator('#plan-host [data-door-state]')).toHaveAttribute('data-door-state', 'open');
  await page.locator('#reset-view').click();
  expect((await snapshot(page)).view).toBe('perspective');
  await expect(page.locator('#save-image')).toBeEnabled();
});

test('real canvas raycasting, wheel zoom, orbit and pan move the actual camera', async ({ page }) => {
  await page.locator('.item-card[data-item="shower"]').click();
  await page.locator('[data-view="top"]').click();
  const target = (await snapshot(page)).fixtureScreenPoints.toilet;
  const canvas = page.locator('#canvas-host canvas');
  await canvas.click({ position: target });
  expect((await snapshot(page)).selected).toBe('toilet');
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.6);
  const zoomBefore = (await snapshot(page)).camera.zoom;
  await page.mouse.wheel(0, -250);
  await expect.poll(async () => (await snapshot(page)).camera.zoom).toBeGreaterThan(zoomBefore);
  await page.locator('#reset-view').click();
  const before = (await snapshot(page)).camera.position;
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.62, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).camera.position).not.toEqual(before);
  const afterOrbit = (await snapshot(page)).camera.position;
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.68, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  await expect.poll(async () => (await snapshot(page)).camera.position).not.toEqual(afterOrbit);
});

test('checks and notes distinguish geometry passes from unverified site safety', async ({ page }) => {
  await page.locator('[data-tab="checks"]').click();
  await expect(page.locator('.check-row')).toHaveCount(16);
  await expect(page.locator('.check-row.pass')).toHaveCount(7);
  await expect(page.locator('.check-row.caution')).toHaveCount(3);
  await expect(page.locator('.check-row.unverified')).toHaveCount(6);
  await page.locator('[data-check="electrical"] summary').click();
  await expect(page.locator('[data-check="electrical"] p')).toBeVisible();
  await expect(page.locator('[data-check="electrical"] p')).toContainText('No electrical compliance');
  await page.locator('[data-tab="notes"]').click();
  await expect(page.locator('#panel-notes')).toContainText('144 inches');
  await expect(page.locator('#panel-notes')).toContainText('flat');
  await expect(page.locator('#panel-notes')).toContainText('on-site qualified professional');
});

test('2D SVG is valid, dimensioned, and reflects overlays', async ({ page }) => {
  await page.locator('#old-wall').check();
  await page.locator('#clearances').check();
  await page.locator('[data-view="plan"]').click();
  const svg = await page.locator('#plan-host').innerHTML();
  const valid = await page.evaluate(source => {
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    return !doc.querySelector('parsererror');
  }, svg);
  expect(valid).toBe(true);
  await expect(page.locator('#plan-host')).toContainText('96 in / 8 ft');
  await expect(page.locator('#plan-host')).toContainText('48 in / 4 ft');
  await expect(page.locator('#plan-host')).toContainText('29 in entry');
  await expect(page.locator('#plan-host')).toContainText('22 in front');
  await expect(page.locator('#plan-host')).toContainText('Removed 5.5 in wall');
  await expect(page.locator('#plan-host')).toContainText('OUTSIDE');
});

test('PNG and SVG exports download nonempty files with the correct signatures', async ({ page }) => {
  await page.locator('h1').click();
  await page.keyboard.press('Escape');
  const pngReady = page.waitForEvent('download');
  await page.locator('#save-image').click();
  const png = await pngReady;
  expect(png.suggestedFilename()).toBe('Bathroom-perspective.png');
  await png.saveAs(path.join(root, 'Preview-3D.png'));
  await page.screenshot({ path: path.join(root, 'Preview-Desktop.png'), fullPage: true });
  const bytes = await readFile(path.join(root, 'Preview-3D.png'));
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.length).toBeGreaterThan(10000);
  const svgReady = page.waitForEvent('download');
  await page.locator('#save-plan').click();
  const svg = await svgReady;
  expect(svg.suggestedFilename()).toBe('Bathroom-dimensioned-plan.svg');
  expect(await svg.failure()).toBeNull();
});

test('keyboard shortcuts operate without hijacking focused form controls', async ({ page }) => {
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

test('desktop, tablet and phone layouts fit without horizontal overflow', async ({ page }) => {
  for (const size of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    await page.setViewportSize(size);
    await page.locator('#reset-view').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const canvas = await page.locator('#canvas-host canvas').boundingBox();
    expect(canvas.width).toBeGreaterThan(200);
    expect(canvas.height).toBeGreaterThan(300);
    await expect(page.locator('[data-view="plan"]')).toBeVisible();
    await page.locator('[data-view="plan"]').click();
    await expect(page.locator('#plan-host svg')).toBeVisible();
    await page.locator('#reset-view').click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.stage').screenshot({ path: path.join(root, 'Preview-mobile.png') });
});

test('WebGL failure shows an explicit error and keeps the 2D plan available', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return getContext.call(this, type, ...args);
    };
  });
  await page.reload();
  await expect(page.locator('#viewer-error')).toBeVisible();
  expect((await snapshot(page)).ready).toBe(false);
  await expect(page.locator('#save-image')).toBeDisabled();
  await page.locator('[data-view="plan"]').click();
  await expect(page.locator('#plan-host svg')).toBeVisible();
  await expect(page.locator('#viewer-error')).toBeHidden();
});

test('phone touch orbit and two-finger pinch operate the real camera', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#reset-view').click();
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const bounds = await page.locator('#canvas-host canvas').boundingBox();
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height * 0.6;
  const before = (await snapshot(page)).camera.position;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 45, y: y + 20, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await snapshot(page)).camera.position).not.toEqual(before);
  await page.locator('[data-view="top"]').click();
  const zoomBefore = (await snapshot(page)).camera.zoom;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 35, y, id: 1 }, { x: x + 35, y, id: 2 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 70, y, id: 1 }, { x: x + 70, y, id: 2 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await snapshot(page)).camera.zoom).toBeGreaterThan(zoomBefore);
  await client.detach();
});
