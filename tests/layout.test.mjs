import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM, ITEMS, DOORS, PLUMBER_SITE, evaluateLayout, insideRoom, overlaps,
  rectangle, planSvg, doorTip, doorSweepIntersects, doorAtAngleIntersects, tileQuantities,
} from '../src/layout.js';

test('confirmed combined room dimensions and inferred wall width reconcile', () => {
  assert.equal(ROOM.width, 96);
  assert.equal(ROOM.depth, 48);
  assert.equal(ROOM.height, 144);
  assert.equal(ROOM.originalToiletWidth + ROOM.removedWallWidth + ROOM.originalBathWidth, ROOM.width);
});

test('combined floor and recovered wall area use square feet', () => {
  assert.equal(evaluateLayout().areaSquareFeet, 32);
  assert.ok(Math.abs(evaluateLayout().recoveredSquareFeet - 1.8333333333) < 1e-8);
});

test('the only basin and only retained door are the approved outside basin and right inward door', () => {
  assert.equal(ITEMS.basin.outside, true);
  assert.equal(PLUMBER_SITE.basinPlacement, 'outside');
  assert.deepEqual(Object.keys(DOORS), ['bathroom']);
  assert.equal(DOORS.bathroom.hinge, 'right');
  assert.equal(DOORS.bathroom.direction, 'inward');
});

test('every indoor fixture footprint fits the measured combined room', () => {
  for (const item of Object.values(ITEMS).filter(item => !item.outside)) assert.ok(insideRoom(item), item.name);
});

test('actual planned WC envelope leaves 22 inches in front and 1 inch behind', () => {
  assert.deepEqual(rectangle(ITEMS.toilet), { left: 10, right: 25, front: 22, back: 47 });
  assert.equal(evaluateLayout().frontClearance, 22);
  assert.equal(evaluateLayout().rearAllowance, 1);
  assert.equal(evaluateLayout().sideClearance, 17.5);
  assert.equal(ITEMS.toilet.seatHeight, 17.5);
});

test('a longer installed WC produces a front-clearance caution', () => {
  const items = { ...ITEMS, toilet: { ...ITEMS.toilet, d: 20, depth: 27 } };
  assert.equal(evaluateLayout(ROOM, items).checks.find(check => check.id === 'wc-front').status, 'caution');
});

test('a WC too close to the side wall produces a side-clearance caution', () => {
  const items = { ...ITEMS, toilet: { ...ITEMS.toilet, x: 5 } };
  assert.equal(evaluateLayout(ROOM, items).checks.find(check => check.id === 'wc-side').status, 'caution');
});

test('shower planning targets use both dimensions', () => {
  assert.equal(ITEMS.shower.width, 36);
  assert.equal(ITEMS.shower.depth, 36);
  const items = { ...ITEMS, shower: { ...ITEMS.shower, width: 28 } };
  assert.equal(evaluateLayout(ROOM, items).checks.find(check => check.id === 'shower-size').status, 'caution');
});

test('bucket shares shower space but not the WC footprint', () => {
  assert.equal(overlaps(ITEMS.toilet, ITEMS.shower), false);
  assert.equal(overlaps(ITEMS.toilet, ITEMS.bucket), false);
  assert.equal(overlaps(ITEMS.bucket, ITEMS.shower), true);
  assert.equal(ITEMS.bucket.movable, true);
});

test('floor-fixture collision is detected', () => {
  const items = { ...ITEMS, bucket: { ...ITEMS.bucket, x: 12, d: 26 } };
  assert.equal(evaluateLayout(ROOM, items).checks.find(check => check.id === 'floor-clash').status, 'caution');
});

test('an out-of-bounds fixture is detected', () => {
  const items = { ...ITEMS, shelf: { ...ITEMS.shelf, x: 90 } };
  assert.equal(evaluateLayout(ROOM, items).checks.find(check => check.id === 'bounds').status, 'caution');
});

test('right inward door tips match the closed, intermediate and open positions', () => {
  assert.deepEqual(doorTip(DOORS.bathroom, 0), { x: 67, d: 0 });
  assert.equal(doorTip(DOORS.bathroom, 90).x, 96);
  assert.equal(doorTip(DOORS.bathroom, 90).d, 29);
  assert.ok(Math.abs(doorTip(DOORS.bathroom, 55).x - (96 - 29 * Math.cos(55 * Math.PI / 180))) < 1e-8);
});

test('retained door clears fixed fixtures but shares shower standing space', () => {
  for (const item of Object.values(ITEMS).filter(item => !item.planningArea)) {
    assert.equal(doorSweepIntersects(DOORS.bathroom, item), false, item.name);
  }
  assert.equal(doorSweepIntersects(DOORS.bathroom, ITEMS.shower, { ignoreHeight: true }), true);
  assert.equal(evaluateLayout().checks.find(check => check.id === 'door-shower').status, 'caution');
});

test('quarter-circle sweep rejects an AABB corner false positive', () => {
  const item = { x: 67, d: 27, width: 2, depth: 2, height: 20 };
  assert.equal(overlaps(evaluateLayout().doorSweep, item), true);
  assert.equal(doorSweepIntersects(DOORS.bathroom, item), false);
});

test('door checks respect fixture heights', () => {
  const item = { x: 75, d: 10, width: 10, depth: 10, height: 0.5 };
  assert.equal(doorSweepIntersects(DOORS.bathroom, item), false);
  assert.equal(doorSweepIntersects(DOORS.bathroom, { ...item, bottom: 83, height: 22 }), false);
  assert.equal(doorSweepIntersects(DOORS.bathroom, { ...item, height: 20 }), true);
});

test('intermediate-angle collision is detected even if both endpoints clear a hypothetical obstruction', () => {
  const item = { x: 82, d: 18, width: 8, depth: 8, height: 20 };
  assert.equal(doorAtAngleIntersects(DOORS.bathroom, item, 0), false);
  assert.equal(doorAtAngleIntersects(DOORS.bathroom, item, 55), true);
  assert.equal(doorAtAngleIntersects(DOORS.bathroom, item, 90), false);
});

test('plumber record distinguishes the confirmed drain corner from unverified pipe details', () => {
  assert.equal(PLUMBER_SITE.existingDrain.corner, 'back-left corner of the original bathroom');
  assert.equal(PLUMBER_SITE.existingDrain.exactCentreVerified, false);
  assert.equal(PLUMBER_SITE.existingDrain.invertVerified, false);
  assert.equal(PLUMBER_SITE.existingDrain.destinationVerified, false);
  assert.ok(insideRoom(PLUMBER_SITE.existingDrain.surveyZone));
  assert.equal(PLUMBER_SITE.wcOutletVerified, false);
  assert.equal(PLUMBER_SITE.geyserInstalled, false);
  assert.equal(PLUMBER_SITE.geyserPointsInstalled, false);
  assert.equal(PLUMBER_SITE.existingBathTapCount, 2);
});

test('seven-foot tile quantities and wastage match the measured room', () => {
  const result = tileQuantities();
  assert.equal(PLUMBER_SITE.tileHeight, 84);
  assert.equal(result.floor, 32);
  assert.equal(result.grossWalls, 168);
  assert.ok(Math.abs(result.doorway - 16.1111111111) < 1e-8);
  assert.ok(Math.abs(result.netWalls - 151.8888888889) < 1e-8);
  assert.ok(Math.abs(result.wallsWithWaste - 167.0777777778) < 1e-8);
  assert.equal(result.outsideSplashbackExcluded, true);
  assert.equal(result.doorHeightAssumed, true);
});

test('door deduction is capped to the tile band and invalid heights fail explicitly', () => {
  assert.equal(tileQuantities(ROOM, 60).doorway, 29 * 60 / 144);
  assert.throws(() => tileQuantities(ROOM, 145), /exceed/);
  assert.throws(() => tileQuantities(ROOM, 0), /Invalid/);
});

test('outside basin design remains illustrative and elevated services fit below the ceiling', () => {
  const design = PLUMBER_SITE.outsideBasin;
  assert.equal(design.width, ITEMS.basin.width);
  assert.equal(design.depth, ITEMS.basin.depth);
  assert.equal(design.rimHeight, 35);
  assert.deepEqual(design.mirror, { width: 22, height: 24, bottom: 44 });
  assert.equal(design.measuredProduct, false);
  assert.ok(ITEMS.heater.bottom + ITEMS.heater.height < ROOM.height);
  assert.ok(ITEMS.shelf.bottom >= 48);
});

test('site safety and compliance are never certified by the geometry checks', () => {
  const checks = evaluateLayout().checks;
  assert.equal(checks.length, 17);
  for (const id of ['structure', 'plumbing', 'waterproofing', 'electrical', 'external-clearance', 'ventilation']) {
    assert.equal(checks.find(check => check.id === id).status, 'unverified', id);
  }
});

test('plan exports contain only the combined layout and outside basin', () => {
  const svg = planSvg();
  for (const text of ['96 in / 8 ft', '48 in / 4 ft', '29 in entry', '22 in front', 'OUTSIDE', 'CONCEPT ONLY']) {
    assert.ok(svg.includes(text), text);
  }
  assert.ok(!svg.includes('INDIAN WC'));
  assert.ok(!svg.includes('basin INSIDE'));
  assert.ok(!svg.includes('data-partition="retained"'));
  assert.ok(planSvg({ showRemoved: true }).includes('Removed 5.5 in wall'));
  assert.ok(!planSvg({ showClearances: false }).includes('22 in front</text>'));
});

test('plan door state and plumber survey labels match their settings', () => {
  assert.ok(planSvg().includes('data-door-direction="inward" data-door-hinge="right" data-door-angle="90" d="M96 48L96 19"'));
  assert.ok(planSvg({ doorOpen: false }).includes('data-door-state="closed"'));
  assert.ok(planSvg({ showPlumber: true }).includes('data-exact-centre="unverified"'));
  assert.ok(planSvg({ showPlumber: true }).includes('no WC rough-in approved'));
  assert.ok(!planSvg().includes('data-site-ref="E1"'));
});

test('invalid rectangles, room dimensions and door parameters throw explicit errors', () => {
  assert.throws(() => rectangle({ x: 0, d: 0, width: -1, depth: 4 }), /positive/);
  assert.throws(() => rectangle({ x: NaN, d: 0, width: 1, depth: 4 }), /Invalid/);
  assert.throws(() => evaluateLayout({ ...ROOM, depth: 0 }), /depth/);
  assert.throws(() => evaluateLayout({ ...ROOM, doorWidth: 97 }), /opening/);
  assert.throws(() => doorTip(DOORS.bathroom, 91), /angle/);
  assert.throws(() => doorTip({ ...DOORS.bathroom, direction: 'sideways' }), /direction/);
});
