import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM, ITEMS, PLANNING_TARGETS, DOORS, EXISTING_PAN, itemsForBasin, basinApproach,
  evaluateLayout, evaluateSeparate, insideRoom, overlaps, rectangle, planSvg,
  comparisonSvg, doorTip, doorSweepIntersects, doorAtAngleIntersects,
} from '../src/layout.js';

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

test('right doorway is 29 inches and retained inward sweep clears context basin', () => {
  const metrics = evaluateLayout();
  assert.equal(ROOM.doorWidth, 29);
  assert.deepEqual(metrics.doorSweep, { x: 67, d: 0, width: 29, depth: 29 });
  assert.equal(overlaps(metrics.doorSweep, ITEMS.basin), false);
  assert.equal(metrics.checks.find(check => check.id === 'door-width').status, 'caution');
});

test('basin conflict is detected inside the actual inward sweep', () => {
  const changed = { ...ITEMS, basin: { ...ITEMS.basin, x: 75, d: 12, outside: false } };
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
  assert.ok(planSvg().includes('data-door-direction="inward" data-door-hinge="right" data-door-angle="90" d="M96 48L96 19"'));
  assert.ok(planSvg({ doorOpen: false }).includes('data-door-state="closed"'));
  assert.ok(planSvg({ doorOpen: false }).includes('d="M96 48L67 48"'));
});

test('confirmed doors are inward with left toilet and right bathroom hinges', () => {
  assert.equal(DOORS.toilet.hinge, 'left');
  assert.equal(DOORS.bathroom.hinge, 'right');
  assert.equal(DOORS.toilet.direction, 'inward');
  assert.equal(DOORS.bathroom.direction, 'inward');
  assert.ok(Math.abs(doorTip(DOORS.toilet).x) < 1e-10);
  assert.equal(doorTip(DOORS.toilet).d, 29);
  assert.equal(doorTip(DOORS.bathroom).x, 96);
  assert.equal(doorTip(DOORS.bathroom).d, 29);
});

test('full sweep conflicts with raised WC but not the low current pan', () => {
  assert.equal(doorSweepIntersects(DOORS.toilet, ITEMS.toilet), true);
  assert.equal(doorSweepIntersects(DOORS.toilet, EXISTING_PAN), false);
  assert.equal(evaluateSeparate('western').fullSweepConflict, true);
  assert.equal(evaluateSeparate('current').fullSweepConflict, false);
});

test('55-degree intermediate swing conflicts even when zero and 90 degrees are clear', () => {
  assert.equal(doorAtAngleIntersects(DOORS.toilet, ITEMS.toilet, 0), false);
  assert.equal(doorAtAngleIntersects(DOORS.toilet, ITEMS.toilet, 55), true);
  assert.equal(doorAtAngleIntersects(DOORS.toilet, ITEMS.toilet, 90), false);
  assert.equal(evaluateSeparate('western', { angle: 55 }).currentAngleConflict, true);
});

test('combined entry clears WC and inside basin but shares shower standing space', () => {
  assert.equal(doorSweepIntersects(DOORS.bathroom, ITEMS.toilet), false);
  assert.equal(doorSweepIntersects(DOORS.bathroom, itemsForBasin('inside').basin), false);
  assert.equal(doorSweepIntersects(DOORS.bathroom, ITEMS.shower, { ignoreHeight: true }), true);
  assert.equal(evaluateLayout().checks.find(check => check.id === 'door-shower').status, 'caution');
});

test('quarter-circle sweep rejects a false clash from the rectangular sweep box', () => {
  const corner = { x: 67, d: 27, width: 2, depth: 2, height: 20 };
  assert.equal(overlaps(evaluateLayout().doorSweep, corner), true);
  assert.equal(doorSweepIntersects(DOORS.bathroom, corner), false);
});

test('door height filters floor-level and overhead objects rather than false plan collisions', () => {
  const floorPan = { x: 75, d: 10, width: 10, depth: 10, height: 0.5 };
  const overhead = { ...floorPan, bottom: 83, height: 22 };
  assert.equal(doorSweepIntersects(DOORS.bathroom, floorPan), false);
  assert.equal(doorSweepIntersects(DOORS.bathroom, overhead), false);
  assert.equal(doorSweepIntersects(DOORS.bathroom, { ...floorPan, height: 20 }), true);
});

test('outward retrofit requires an alteration and cannot change the current baseline silently', () => {
  const retrofit = evaluateSeparate('western', { frameChange: true, angle: 55 });
  assert.equal(retrofit.toiletDoor.direction, 'outward');
  assert.equal(retrofit.frameChangeRequired, true);
  assert.equal(retrofit.fullSweepConflict, false);
  assert.equal(evaluateSeparate('current', { frameChange: true }).toiletDoor.direction, 'inward');
});

test('compact inside basin fits with a clear 24 by 21-inch approach and WC clearances', () => {
  const items = itemsForBasin('inside'), result = evaluateLayout(ROOM, items);
  assert.deepEqual(rectangle(items.basin), { left: 34.5, right: 52.5, front: 36, back: 48 });
  assert.deepEqual(basinApproach(items.basin), { x: 31.5, d: 15, width: 24, depth: 21 });
  assert.equal(result.frontClearance, 22);
  assert.equal(result.sideClearance, 17);
  assert.equal(result.checks.find(check => check.id === 'basin-approach').status, 'pass');
  assert.equal(result.checks.find(check => check.id === 'basin-product').status, 'unverified');
  assert.equal(items.shelf.x, 4);
});

test('oversized basin or insufficient standing depth cannot receive a geometry pass', () => {
  const inside = itemsForBasin('inside');
  const wide = { ...inside, basin: { ...inside.basin, width: 28 } };
  const deep = { ...inside, basin: { ...inside.basin, d: 18, depth: 30 } };
  for (const items of [wide, deep]) {
    assert.equal(evaluateLayout(ROOM, items).checks.find(check => check.id === 'basin-approach').status, 'caution');
  }
});

test('separate and combined areas quantify the gain without double-counting the whole room', () => {
  const separate = evaluateSeparate();
  assert.ok(Math.abs(separate.floorSquareFeet - 30.1666666667) < 1e-8);
  assert.ok(Math.abs(separate.toiletSquareFeet - 11.6666666667) < 1e-8);
  assert.equal(separate.bathSquareFeet, 18.5);
  const percent = evaluateLayout().recoveredSquareFeet / separate.floorSquareFeet * 100;
  assert.ok(percent > 6 && percent < 6.1);
});

test('plan alternatives retain or remove the real partition and identify the basin option', () => {
  const current = planSvg({ scenario: 'current' });
  assert.ok(current.includes('data-partition="retained"'));
  assert.ok(current.includes('INDIAN WC'));
  assert.ok(planSvg({ scenario: 'western' }).includes('FULL SWEEP overlaps WC'));
  assert.ok(!planSvg().includes('data-partition="retained"'));
  assert.ok(planSvg({ basinPlacement: 'inside' }).includes('18 x 12 in basin INSIDE'));
});

test('comparison SVG contains two equal-scale plans with distinct marker IDs and honest area gain', () => {
  const svg = comparisonSvg({ variant: 'western', basinPlacement: 'inside' });
  assert.ok(svg.includes('x="0" y="14" width="138" height="112"'));
  assert.ok(svg.includes('x="150" y="14" width="138" height="112"'));
  assert.ok(svg.includes('id="separate-western-arrow"'));
  assert.ok(svg.includes('id="combined-inside-arrow"'));
  assert.ok(svg.includes('30.17 sq ft'));
  assert.ok(svg.includes('Gain: 1.83 sq ft'));
});

test('invalid swing, angle, fixture, placement or scenario inputs are explicit errors', () => {
  assert.throws(() => doorTip({ ...DOORS.toilet, direction: 'sideways' }), /direction/);
  assert.throws(() => doorTip(DOORS.toilet, 91), /angle/);
  assert.throws(() => doorTip({ ...DOORS.toilet, width: 0 }), /dimensions/);
  assert.throws(() => doorSweepIntersects(DOORS.toilet, { ...ITEMS.toilet, height: NaN }), /height/);
  assert.throws(() => doorAtAngleIntersects(DOORS.toilet, { ...EXISTING_PAN, width: -1 }, 55), /positive/);
  assert.throws(() => itemsForBasin('unknown'), /placement/);
  assert.throws(() => evaluateSeparate('unknown'), /variant/);
});
