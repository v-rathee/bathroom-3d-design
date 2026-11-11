import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM, ITEMS, PLANNING_TARGETS, evaluateLayout, insideRoom, overlaps, rectangle, planSvg } from '../src/layout.js';

test('confirmed inside dimensions and original widths reconcile exactly', () => {
  assert.equal(ROOM.width, 96);
  assert.equal(ROOM.depth, 48);
  assert.equal(ROOM.height, 12 * 12);
  assert.equal(ROOM.originalToiletWidth + ROOM.removedWallWidth + ROOM.originalBathWidth, ROOM.width);
});

test('area and recovered partition footprint use square feet, not square inches', () => {
  const metrics = evaluateLayout();
  assert.equal(metrics.areaSquareFeet, 32);
  assert.ok(Math.abs(metrics.recoveredSquareFeet - 1.8333333333333333) < 1e-10);
});

test('every indoor fixture footprint is within measured inside faces', () => {
  for (const item of Object.values(ITEMS).filter(item => !item.outside)) {
    assert.ok(insideRoom(item), item.name);
  }
});

test('compact WC fits the exact proposed installed envelope', () => {
  assert.deepEqual(rectangle(ITEMS.toilet), { left: 10, right: 25, front: 22, back: 47 });
  const metrics = evaluateLayout();
  assert.equal(metrics.frontClearance, 22);
  assert.equal(metrics.rearAllowance, 1);
  assert.equal(metrics.sideClearance, 17.5);
  assert.equal(ITEMS.toilet.seatHeight, 17.5);
});

test('WC clearance check fails for a longer 27-inch replacement keeping the rear allowance', () => {
  const changed = { ...ITEMS, toilet: { ...ITEMS.toilet, d: 20, depth: 27 } };
  const result = evaluateLayout(ROOM, changed);
  assert.equal(result.frontClearance, 20);
  assert.equal(result.checks.find(check => check.id === 'wc-front').status, 'caution');
});

test('WC side check detects a centre closer than the planning reference', () => {
  const changed = { ...ITEMS, toilet: { ...ITEMS.toilet, x: 5 } };
  assert.equal(evaluateLayout(ROOM, changed).checks.find(check => check.id === 'wc-side').status, 'caution');
});

test('shower target is checked against both dimensions', () => {
  assert.equal(ITEMS.shower.width, 36);
  assert.equal(ITEMS.shower.depth, 36);
  const changed = { ...ITEMS, shower: { ...ITEMS.shower, width: 28 } };
  assert.equal(evaluateLayout(ROOM, changed).checks.find(check => check.id === 'shower-size').status, 'caution');
});

test('WC and shower do not overlap, and bucket storage is explicitly within shower', () => {
  assert.equal(overlaps(ITEMS.toilet, ITEMS.shower), false);
  assert.equal(overlaps(ITEMS.toilet, ITEMS.bucket), false);
  assert.equal(overlaps(ITEMS.shower, ITEMS.bucket), true);
  assert.equal(ITEMS.bucket.movable, true);
});

test('floor fixture collision is detected, not silently passed', () => {
  const changed = { ...ITEMS, bucket: { ...ITEMS.bucket, x: 12, d: 26 } };
  assert.equal(evaluateLayout(ROOM, changed).checks.find(check => check.id === 'floor-clash').status, 'caution');
});

test('out-of-room fixture produces a failed geometry check', () => {
  const changed = { ...ITEMS, shelf: { ...ITEMS.shelf, x: 90 } };
  assert.equal(evaluateLayout(ROOM, changed).checks.find(check => check.id === 'bounds').status, 'caution');
});

test('right doorway is 29 inches and outward sweep clears context basin', () => {
  const metrics = evaluateLayout();
  assert.equal(ROOM.doorWidth, 29);
  assert.deepEqual(metrics.doorSweep, { x: 67, d: -29, width: 29, depth: 29 });
  assert.equal(overlaps(metrics.doorSweep, ITEMS.basin), false);
  assert.equal(metrics.checks.find(check => check.id === 'door-width').status, 'caution');
});

test('basin conflict is detected if the basin moves into the outward sweep box', () => {
  const changed = { ...ITEMS, basin: { ...ITEMS.basin, x: 75 } };
  assert.equal(evaluateLayout(ROOM, changed).checks.find(check => check.id === 'door-basin').status, 'caution');
});

test('elevated storage and heater keep the main floor free', () => {
  assert.ok(ITEMS.shelf.bottom >= 48);
  assert.ok(ITEMS.heater.bottom + ITEMS.heater.height < ROOM.height);
  assert.ok(ITEMS.heater.x + ITEMS.heater.width < ITEMS.shower.x);
  assert.equal(ITEMS.heater.floorStanding, undefined);
});

test('structural, plumbing, electrical and site checks are never certified by geometry', () => {
  const checks = evaluateLayout().checks;
  for (const id of ['structure', 'plumbing', 'waterproofing', 'electrical', 'external-clearance', 'ventilation']) {
    assert.equal(checks.find(check => check.id === id).status, 'unverified', id);
  }
  assert.equal(checks.find(check => check.id === 'wet-entry').status, 'caution');
  assert.equal(checks.find(check => check.id === 'bucket').status, 'caution');
  assert.equal(PLANNING_TARGETS.wcFront, 21);
});

test('invalid input surfaces an error instead of success-shaped results', () => {
  assert.throws(() => rectangle({ x: 0, d: 0, width: -1, depth: 4 }), /positive/);
  assert.throws(() => rectangle({ x: NaN, d: 0, width: 1, depth: 4 }), /Invalid x/);
  assert.throws(() => evaluateLayout({ ...ROOM, depth: 0 }), /depth/);
  assert.throws(() => evaluateLayout({ ...ROOM, doorWidth: 97 }), /opening/);
});

test('exported plan includes measured dimensions, outside basin and construction limitations', () => {
  const svg = planSvg();
  for (const text of ['96 in / 8 ft', '48 in / 4 ft', '29 in entry', '22 in front', 'OUTSIDE', 'CONCEPT ONLY']) {
    assert.ok(svg.includes(text), text);
  }
  assert.ok(!svg.includes('Removed 5.5 in wall'));
  assert.ok(planSvg({ showRemoved: true }).includes('Removed 5.5 in wall'));
  assert.ok(!planSvg({ showClearances: false }).includes('22 in front</text>'));
  assert.ok(!svg.includes('</+text>'));
});

test('2D plan door state matches its open or closed setting', () => {
  assert.ok(planSvg().includes('data-door-state="open" d="M96 48V77"'));
  assert.ok(planSvg({ doorOpen: false }).includes('data-door-state="closed" d="M96 48H67"'));
});
