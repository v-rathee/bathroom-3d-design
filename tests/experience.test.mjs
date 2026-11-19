import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EYE_HEIGHT, CAMERA_MARGIN, DEFAULT_LENS, ROOM_VIEWS, roomPose,
  canPlaceCamera, moveCamera, lensToVertical,
} from '../src/experience.js';
import { ROOM } from '../src/layout.js';

test('all finished-room viewpoints use the same assumed eye height and valid room positions', () => {
  assert.equal(EYE_HEIGHT, 61);
  for (const name of Object.keys(ROOM_VIEWS)) {
    const pose = roomPose(name);
    assert.equal(pose.y, 61);
    assert.ok(canPlaceCamera(pose), name);
    assert.ok(Number.isFinite(pose.yaw));
    assert.ok(Number.isFinite(pose.pitch));
  }
});

test('camera cannot leave the measured inside rectangle', () => {
  assert.equal(canPlaceCamera({ x: 0, d: 24 }), false);
  assert.equal(canPlaceCamera({ x: 48, d: 48 }), false);
  const result = moveCamera({ x: 48, d: 8 }, 500, 0);
  assert.ok(result.x <= ROOM.width - CAMERA_MARGIN);
  assert.ok(canPlaceCamera(result));
});

test('camera does not pass through the WC envelope', () => {
  const result = moveCamera({ x: 17.5, d: 8 }, 0, 40);
  assert.ok(result.d <= 22 - CAMERA_MARGIN);
  assert.ok(canPlaceCamera(result));
});

test('long camera steps are subdivided rather than tunnelling through fixtures', () => {
  const result = moveCamera({ x: 17.5, d: 8 }, 0, 240);
  assert.ok(result.d < 22);
  assert.ok(canPlaceCamera(result));
});

test('camera proximity rule rejects bucket, shelf and wall intersections', () => {
  assert.equal(canPlaceCamera({ x: 89, d: 39 }), false);
  assert.equal(canPlaceCamera({ x: 48, d: 41 }), false);
  assert.equal(canPlaceCamera({ x: 3, d: 10 }), false);
});

test('door is included in camera collision checks', () => {
  assert.equal(canPlaceCamera({ x: 81, d: 8 }, 0), true);
  assert.equal(canPlaceCamera({ x: 81, d: 8 }, 45), false);
});

test('portrait lens conversion preserves the intended horizontal field of view', () => {
  const vertical = lensToVertical(DEFAULT_LENS, 0.8);
  const horizontal = 2 * Math.atan(Math.tan(vertical * Math.PI / 360) * 0.8) * 180 / Math.PI;
  assert.ok(Math.abs(horizontal - DEFAULT_LENS) < 1e-8);
  assert.ok(vertical > DEFAULT_LENS);
});

test('invalid room navigation inputs fail explicitly', () => {
  assert.throws(() => roomPose('unknown'), /Unknown/);
  assert.throws(() => canPlaceCamera({ x: NaN, d: 8 }), /finite/);
  assert.throws(() => moveCamera({ x: 81, d: 8 }, NaN, 0), /finite/);
  assert.throws(() => moveCamera({ x: 17.5, d: 34 }, 1, 0), /valid/);
  assert.throws(() => lensToVertical(120, 1), /Invalid/);
  assert.throws(() => lensToVertical(74, 0), /Invalid/);
});
