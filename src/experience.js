import * as THREE from 'three';
import { ROOM, ITEMS, DOORS, doorTip, rectangle } from './layout.js';

export const EYE_HEIGHT = 61;
export const CAMERA_MARGIN = 7;
export const DEFAULT_LENS = 84;
export const ROOM_VIEWS = Object.freeze({
  entrance: { label: 'From the entrance', x: 81, d: 8, targetX: 54, targetD: 43, targetHeight: 56 },
  toilet: { label: 'Toward the WC', x: 51, d: 9, targetX: 17.5, targetD: 35, targetHeight: 32 },
  shower: { label: 'Toward the shower', x: 54, d: 13, targetX: 84, targetD: 43, targetHeight: 57 },
  door: { label: 'Toward the entrance', x: 48, d: 30, targetX: 81, targetD: 0, targetHeight: 46 },
});

export function roomPose(name) {
  const view = ROOM_VIEWS[name];
  if (!view) throw new RangeError(`Unknown room viewpoint: ${name}`);
  const dx = view.targetX - view.x, dd = view.targetD - view.d;
  return {
    x: view.x, d: view.d, y: EYE_HEIGHT,
    yaw: Math.atan2(-dx, dd),
    pitch: Math.atan2(view.targetHeight - EYE_HEIGHT, Math.hypot(dx, dd)),
  };
}

export function canPlaceCamera(position, doorAngle = 0) {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.d)) throw new TypeError('Camera coordinates must be finite.');
  const { x, d } = position;
  if (x < CAMERA_MARGIN || x > ROOM.width - CAMERA_MARGIN
    || d < CAMERA_MARGIN || d > ROOM.depth - CAMERA_MARGIN) return false;
  for (const item of Object.values(ITEMS)) {
    if (item.outside || item.planningArea) continue;
    const nearHead = item.bottom !== undefined && item.bottom <= EYE_HEIGHT + 2 && item.bottom + item.height >= EYE_HEIGHT - 12;
    if (!item.floorStanding && !nearHead) continue;
    const bounds = rectangle(item);
    const nearestX = Math.max(bounds.left, Math.min(x, bounds.right));
    const nearestD = Math.max(bounds.front, Math.min(d, bounds.back));
    if ((x - nearestX) ** 2 + (d - nearestD) ** 2 < CAMERA_MARGIN ** 2) return false;
  }
  const tip = doorTip(DOORS.bathroom, doorAngle);
  const hinge = DOORS.bathroom.x + DOORS.bathroom.width;
  const vx = tip.x - hinge, vd = tip.d;
  const t = Math.max(0, Math.min(1, ((x - hinge) * vx + d * vd) / (vx * vx + vd * vd)));
  return Math.hypot(x - hinge - t * vx, d - t * vd) >= CAMERA_MARGIN + 0.6;
}

export function moveCamera(position, dx, dd, doorAngle = 0) {
  if (!Number.isFinite(dx) || !Number.isFinite(dd)) throw new TypeError('Camera movement must be finite.');
  if (!canPlaceCamera(position, doorAngle)) throw new RangeError('Camera must start at a valid room position.');
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dd) / 2));
  const next = { x: position.x, d: position.d };
  for (let step = 0; step < steps; step++) {
    const across = { x: next.x + dx / steps, d: next.d };
    if (canPlaceCamera(across, doorAngle)) next.x = across.x;
    const along = { x: next.x, d: next.d + dd / steps };
    if (canPlaceCamera(along, doorAngle)) next.d = along.d;
  }
  return next;
}

export function lensToVertical(horizontalDegrees, aspect) {
  if (!Number.isFinite(horizontalDegrees) || horizontalDegrees < 45 || horizontalDegrees > 95
    || !Number.isFinite(aspect) || aspect <= 0) throw new RangeError('Invalid room lens or aspect ratio.');
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(horizontalDegrees) / 2) / aspect));
}

function canvas2d(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Surface texture generation requires Canvas 2D.');
  return { canvas, context };
}

export function tileMaterial({ color, tileWidth = 24, tileHeight = 12, floor = false, anisotropy = 4 }) {
  const cellWidth = 256, cellHeight = Math.round(256 * tileHeight / tileWidth);
  const { canvas, context } = canvas2d(cellWidth * 2, cellHeight * 2);
  const bump = canvas2d(canvas.width, canvas.height);
  context.fillStyle = '#aaa99e';
  context.fillRect(0, 0, canvas.width, canvas.height);
  bump.context.fillStyle = '#333333';
  bump.context.fillRect(0, 0, canvas.width, canvas.height);
  let seed = floor ? 73 : 23;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const joint = Math.max(1, cellWidth * 0.08 / tileWidth);
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
    const shade = Math.round(236 + random() * 15);
    const x = col * cellWidth + joint / 2, y = row * cellHeight + joint / 2;
    context.fillStyle = `rgb(${shade},${shade},${shade - 2})`;
    context.fillRect(x, y, cellWidth - joint, cellHeight - joint);
    bump.context.fillStyle = '#d0d0d0';
    bump.context.fillRect(x, y, cellWidth - joint, cellHeight - joint);
    for (let grain = 0; grain < (floor ? 2000 : 800); grain++) {
      const gx = x + random() * (cellWidth - joint), gy = y + random() * (cellHeight - joint);
      context.fillStyle = floor ? 'rgba(125,120,105,.09)' : 'rgba(170,170,155,.055)';
      context.fillRect(gx, gy, random() * (floor ? 6 : 2) + 0.2, random() * 1.5 + 0.2);
      bump.context.fillStyle = `rgba(140,140,140,${floor ? 0.1 : 0.035})`;
      bump.context.fillRect(gx, gy, 1, 1);
    }
  }
  const map = new THREE.CanvasTexture(canvas), bumpMap = new THREE.CanvasTexture(bump.canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map, bumpMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = anisotropy;
  }
  const surface = new THREE.MeshPhysicalMaterial({
    color, map, bumpMap, bumpScale: floor ? 0.035 : 0.018,
    roughness: floor ? 0.68 : 0.32, metalness: 0,
    clearcoat: floor ? 0.03 : 0.3, clearcoatRoughness: 0.3,
    polygonOffset: !floor, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  surface.userData.tileWidth = tileWidth;
  surface.userData.tileHeight = tileHeight;
  surface.userData.atlasSize = 2;
  return surface;
}

export function woodMaterial() {
  const { canvas, context } = canvas2d(256, 512);
  context.fillStyle = '#b5956f';
  context.fillRect(0, 0, 256, 512);
  for (let x = 0; x < 256; x++) {
    context.strokeStyle = `rgba(90,60,30,${0.025 + (Math.sin(x * 1.7) + 1) * 0.025})`;
    context.beginPath();
    context.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 16) context.lineTo(x + Math.sin(y / 80 + x / 11) * 1.5, y);
    context.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ color: '#ffffff', map, roughness: 0.65 });
}
