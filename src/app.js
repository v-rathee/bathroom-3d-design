import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ROOM, ITEMS, evaluateLayout, planSvg } from './layout.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const metrics = evaluateLayout();
const state = {
  view: 'perspective', walls: 'cutaway', doorOpen: true,
  dimensions: true, labels: true, clearances: false, removed: false,
  finish: 'sage', selected: 'toilet', ready: false, error: null,
};
const fixtureModels = new Map();
const pickable = [];
const labels = new THREE.Group();
const dimensionLines = new THREE.Group();
const clearanceGroup = new THREE.Group();
const removedGroup = new THREE.Group();
let scene, renderer, controls, activeCamera, perspectiveCamera, topCamera;
let fullWalls, cutawayWalls, doorPivot, selectionBox, floorMesh, accentMaterial, wallMaterial;
let heightDimension, geometryAudit, resizeObserver;

const itemOrder = ['toilet', 'shower', 'bucket', 'heater', 'shelf', 'basin', 'drain'];
const shortSizes = {
  toilet: '15 x 25 in / compact model',
  shower: '36 x 36 in / no enclosure',
  bucket: '11 in diameter / movable',
  heater: '14 in diameter / assumed',
  shelf: '20 x 7 in / wall mounted',
  basin: 'Stays outside / size assumed',
  drain: '30 in long / proposed',
};

function renderInformation() {
  $('#item-list').innerHTML = itemOrder.map((id, index) => `<button type="button" class="item-card${id === state.selected ? ' active' : ''}" data-item="${id}" aria-pressed="${id === state.selected}"><span class="item-number">${String(index + 1).padStart(2, '0')}</span><span><strong>${ITEMS[id].name}</strong><small>${shortSizes[id]}</small></span><span class="item-arrow" aria-hidden="true">&rarr;</span></button>`).join('');
  $$('.item-card').forEach(button => button.addEventListener('click', () => selectItem(button.dataset.item)));
  const counts = { pass: 0, caution: 0, unverified: 0 };
  metrics.checks.forEach(check => counts[check.status]++);
  $('#check-count').textContent = String(counts.caution + counts.unverified);
  $('#checks-summary').innerHTML = `<span>${counts.pass} geometry passes</span><span>${counts.caution} cautions</span><span>${counts.unverified} site checks</span>`;
  $('#check-list').innerHTML = metrics.checks.map(check => `<details class="check-row ${check.status}" data-check="${check.id}"><summary><span class="check-status">${check.status === 'unverified' ? 'Site verification needed' : check.status === 'pass' ? 'Geometry pass' : 'Design caution'}</span>${check.title}</summary><p>${check.detail}</p></details>`).join('');
  selectItem('toilet');
  refreshPlan();
}

function selectItem(id) {
  const item = ITEMS[id];
  if (!item) throw new Error(`Unknown fixture: ${id}`);
  state.selected = id;
  $('#item-category').textContent = item.category;
  $('#item-title').textContent = item.name;
  $('#item-description').textContent = item.description;
  $('#item-size').textContent = id === 'toilet'
    ? '15 W x 25 D in / 17.5 in seat / 22 in front clearance'
    : `${item.width} W x ${item.depth} D in${item.bottom ? ` / base ${item.bottom} in above floor` : ''}`;
  $$('.item-card').forEach(button => {
    const active = button.dataset.item === id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (selectionBox) {
    const object = fixtureModels.get(id);
    selectionBox.visible = Boolean(object) && state.view !== 'plan';
    if (object) selectionBox.setFromObject(object);
  }
}

function refreshPlan() {
  $('#plan-host').innerHTML = planSvg({ showRemoved: state.removed, showClearances: state.clearances, doorOpen: state.doorOpen });
}

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...options });
}

function mesh(geometry, surface, parent, x, y, d) {
  const object = new THREE.Mesh(geometry, surface);
  object.position.set(x, y, -d);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent, width, height, depth, x, y, d, surface) {
  return mesh(new THREE.BoxGeometry(width, height, depth), surface, parent, x, y, d);
}

function cylinder(parent, radiusTop, radiusBottom, height, x, y, d, surface, open = false) {
  return mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 40, 1, open), surface, parent, x, y, d);
}

function line(parent, points, color = '#6e826e', dashed = false) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, y, d]) => new THREE.Vector3(x, y, -d)));
  const surface = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 1.4, gapSize: 1, transparent: true, opacity: 0.75 })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.65 });
  const object = new THREE.Line(geometry, surface);
  if (dashed) object.computeLineDistances();
  parent.add(object);
  return object;
}

function tube(parent, points, radius, surface) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, d]) => new THREE.Vector3(x, y, -d)));
  const object = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, radius, 10, false), surface);
  object.castShadow = true;
  parent.add(object);
  return object;
}

function tag(parent, text, x, y, d, { width = 24, color = '#314b3b', background = '#fbfaf1' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 72;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D text rendering is unavailable.');
  context.font = '500 40px "Segoe UI", Arial, sans-serif';
  canvas.width = Math.ceil(context.measureText(text).width + 36);
  context.fillStyle = background;
  context.beginPath();
  context.roundRect(2, 2, canvas.width - 4, 68, 12);
  context.fill();
  context.strokeStyle = '#d6dece';
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = color;
  context.font = '500 40px "Segoe UI", Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, 37);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(width, width * 72 / canvas.width, 1);
  sprite.position.set(x, y, -d);
  sprite.renderOrder = 5;
  parent.add(sprite);
  return sprite;
}

function register(id, object) {
  object.name = id;
  object.traverse(child => {
    if (child.isMesh) {
      child.userData.fixture = id;
      pickable.push(child);
    }
  });
  fixtureModels.set(id, object);
}

function buildWalls() {
  fullWalls = new THREE.Group();
  cutawayWalls = new THREE.Group();
  function shell(group, full) {
    const backHeight = full ? ROOM.height : 112;
    const sideHeight = full ? ROOM.height : 18;
    const frontHeight = full ? ROOM.height : 7;
    box(group, ROOM.width + 8, backHeight, 4, 48, backHeight / 2, 50, wallMaterial);
    box(group, 4, sideHeight, 48, -2, sideHeight / 2, 24, wallMaterial);
    box(group, 4, sideHeight, 48, 98, sideHeight / 2, 24, wallMaterial);
    box(group, 67, frontHeight, 4, 33.5, frontHeight / 2, -2, wallMaterial);
    if (full) {
      box(group, 29, ROOM.height - ROOM.doorHeight, 4, 81.5, (ROOM.height + ROOM.doorHeight) / 2, -2, wallMaterial);
    }
    for (let x = 0; x <= 96; x += 12) line(group, [[x, 0, 47.96], [x, backHeight, 47.96]], '#c7c9b9');
    for (let y = 12; y < backHeight; y += 12) line(group, [[0, y, 47.95], [96, y, 47.95]], '#c7c9b9');
    const infill = material('#cdbb98');
    box(group, 29, Math.min(frontHeight, 3), 4.1, 14.5, Math.min(frontHeight, 3) / 2, -2, infill);
  }
  shell(fullWalls, true);
  shell(cutawayWalls, false);
  scene.add(fullWalls, cutawayWalls);
  fullWalls.visible = false;
  const accent = new THREE.Group();
  box(accent, 36, 96, 0.15, 78, 48, 47.85, accentMaterial);
  for (let x = 60; x <= 96; x += 6) line(accent, [[x, 0, 47.74], [x, 96, 47.74]], '#638774');
  for (let y = 12; y < 96; y += 12) line(accent, [[60, y, 47.73], [96, y, 47.73]], '#638774');
  accent.name = 'shower-accent';
  scene.add(accent);
  const timber = material('#ab8154', { roughness: 0.8 });
  box(scene, 1.3, 80, 2, 66.6, 40, 0, timber);
  box(scene, 1.3, 80, 2, 96.6, 40, 0, timber);
  box(scene, 31.3, 1.4, 2, 81.6, 80.7, 0, timber);
}

function buildFloor() {
  const foundation = material('#c9c4b5');
  box(scene, 104, 2, 56, 48, -1.2, 24, foundation);
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = 256;
  tileCanvas.height = 256;
  const tileContext = tileCanvas.getContext('2d');
  if (!tileContext) throw new Error('Floor material texture could not be created.');
  tileContext.fillStyle = '#d4cbb7';
  tileContext.fillRect(0, 0, 256, 256);
  let seed = 41;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let index = 0; index < 3500; index++) {
    tileContext.fillStyle = index % 2 ? '#f0e9d680' : '#9a927a45';
    const x = random() * 256, y = random() * 256;
    tileContext.fillRect(x, y, random() * 2 + 0.3, random() * 2 + 0.3);
  }
  const floorTexture = new THREE.CanvasTexture(tileCanvas);
  floorTexture.colorSpace = THREE.SRGBColorSpace;
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(8, 4);
  floorMesh = box(scene, 96, 0.3, 48, 48, -0.15, 24, material('#ffffff', { map: floorTexture, roughness: 0.86 }));
  for (let x = 0; x <= 96; x += 12) line(scene, [[x, 0.03, 0], [x, 0.03, 48]], '#b6b09e');
  for (let d = 0; d <= 48; d += 12) line(scene, [[0, 0.04, d], [96, 0.04, d]], '#b6b09e');
  box(scene, 96, 0.25, 32, 48, -0.5, -16, material('#e0e2d7', { roughness: 0.98 }));
  const zone = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshBasicMaterial({ color: '#adc9b5', transparent: true, opacity: 0.18, depthWrite: false }));
  zone.rotation.x = -Math.PI / 2;
  zone.position.set(78, 0.08, -30);
  scene.add(zone);
}

function ovalRing(parent, width, depth, innerWidth, innerDepth, height, x, y, d, surface) {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, width / 2, depth / 2, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, innerWidth / 2, innerDepth / 2, 0, Math.PI * 2, true, 0);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 48 });
  const object = mesh(geometry, surface, parent, x, y, d);
  object.rotation.x = -Math.PI / 2;
  return object;
}

function buildToilet(ceramic, brass) {
  const group = new THREE.Group();
  const profile = [[3.5, 0], [4.1, 0.5], [4.3, 3], [3.8, 6], [5.4, 10], [6.8, 13], [7.1, 15.5]];
  const body = mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 64), ceramic, group, 17.5, 0, 32);
  body.scale.z = 9.6 / 7.1;
  ovalRing(group, 14.5, 19.6, 10, 14.2, 0.6, 17.5, 15.5, 32, ceramic);
  ovalRing(group, 14.8, 20, 10.1, 14.4, 1.4, 17.5, 16.1, 32, ceramic);
  const inner = cylinder(group, 4.8, 3.2, 4.5, 17.5, 12.6, 32, material('#dce5df', { roughness: 0.25, side: THREE.DoubleSide }), true);
  inner.scale.z = 1.44;
  const water = cylinder(group, 3.2, 3.2, 0.04, 17.5, 10.4, 32, material('#b8d5d4', { roughness: 0.12 }));
  water.scale.z = 1.4;
  box(group, 15, 14.25, 5.5, 17.5, 25.125, 44.25, ceramic);
  box(group, 15, 0.25, 5.5, 17.5, 32.375, 44.25, ceramic);
  cylinder(group, 0.8, 0.8, 0.08, 17.5, 32.46, 44.25, brass);
  box(group, 4, 12, 4, 17.5, 12, 44.2, ceramic);
  scene.add(group);
  register('toilet', group);
  tube(scene, [[27.7, 23, 47], [30.5, 19, 45], [31, 8, 42], [29, 6, 40], [28, 16, 43]], 0.22, brass);
  const holder = box(scene, 1.5, 4, 1.2, 28, 24, 46, brass);
  holder.userData.fixture = 'toilet';
  pickable.push(holder);
  const roll = cylinder(scene, 2.2, 2.2, 4.2, 2.4, 26, 28, material('#f4f0e2'));
  roll.rotation.z = Math.PI / 2;
  tag(labels, 'COMPACT WC', 17.5, 39, 39, { width: 23 });
}

function buildShower(brass) {
  const group = new THREE.Group();
  tube(group, [[79, 43, 46.5], [79, 70, 46.5], [79, 80, 46], [79, 81, 41], [79, 81, 38]], 0.35, brass);
  cylinder(group, 4.2, 4.2, 0.55, 79, 80.7, 38, brass);
  cylinder(group, 3.8, 3.8, 0.1, 79, 80.35, 38, material('#3e4d44'));
  const mixer = cylinder(group, 1.8, 1.8, 1, 79, 43, 46, brass);
  mixer.rotation.x = Math.PI / 2;
  box(group, 0.6, 3.3, 0.7, 79, 44.4, 44.8, brass);
  for (const x of [85, 90]) {
    tube(group, [[x, 18, 47], [x, 18, 44.5], [x, 17, 44]], 0.42, brass);
    box(group, 2.2, 0.35, 0.45, x, 19.2, 45.4, brass);
  }
  const area = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshBasicMaterial({ color: '#91b89a', opacity: 0, transparent: true, depthWrite: false }));
  area.rotation.x = -Math.PI / 2;
  area.position.set(78, 0.12, -30);
  group.add(area);
  scene.add(group);
  register('shower', group);
  tag(labels, 'OPEN SHOWER', 79, 88, 42, { width: 26 });
}

function buildBucket() {
  const group = new THREE.Group();
  const plastic = material('#d9c797', { side: THREE.DoubleSide, roughness: 0.5 });
  cylinder(group, 5.25, 4.5, 11, 89, 5.5, 39, plastic, true);
  cylinder(group, 4.5, 4.5, 0.3, 89, 0.15, 39, plastic);
  const rim = mesh(new THREE.TorusGeometry(5.3, 0.2, 8, 48), plastic, group, 89, 11, 39);
  rim.rotation.x = Math.PI / 2;
  const handle = mesh(new THREE.TorusGeometry(5.15, 0.15, 8, 32, Math.PI), material('#a99468'), group, 89, 11, 39);
  handle.rotation.z = 0;
  scene.add(group);
  register('bucket', group);
}

function buildHeater(ceramic, brass) {
  const group = new THREE.Group();
  cylinder(group, 7, 7, 22, 47.5, 94, 40.5, ceramic);
  cylinder(group, 6.7, 6.7, 0.15, 47.5, 104.9, 40.5, material('#deded2'));
  cylinder(group, 6.7, 6.7, 0.15, 47.5, 83.1, 40.5, material('#deded2'));
  box(group, 4.5, 3, 0.2, 47.5, 87.5, 33.48, material('#53675c'));
  scene.add(group);
  register('heater', group);
  tube(scene, [[44, 83, 40.5], [44, 77, 45.9], [59, 77, 46.2], [79, 77, 46.2]], 0.25, brass);
  tube(scene, [[51, 83, 40.5], [52, 74, 46.2], [85, 74, 46.2], [85, 20, 46.2]], 0.22, brass);
  tag(labels, 'GEYSER / ASSUMED SIZE', 47.5, 113, 42, { width: 34 });
}

function buildShelf() {
  const group = new THREE.Group();
  const wood = material('#b4a07b', { roughness: 0.86 });
  box(group, 20, 1, 7, 48, 48.5, 44.5, wood);
  box(group, 20, 1, 7, 48, 59.5, 44.5, wood);
  box(group, 1, 12, 7, 38.5, 54, 44.5, wood);
  box(group, 1, 12, 7, 57.5, 54, 44.5, wood);
  for (const [x, color, height] of [[43, '#d2d3bb', 5.5], [47, '#5e7d67', 7], [52, '#d5b686', 4]]) {
    cylinder(group, 1.1, 1.1, height, x, 49 + height / 2, 44, material(color));
    cylinder(group, 0.5, 0.5, 0.5, x, 49.25 + height, 44, material('#ac946c'));
  }
  scene.add(group);
  register('shelf', group);
}

function buildBasin(ceramic, brass) {
  const group = new THREE.Group();
  const basin = box(group, 18, 5, 14, 48, 31.5, -8, ceramic);
  ovalRing(group, 16.5, 12, 12.5, 8, 1, 48, 34, -8, ceramic);
  const bowl = cylinder(group, 5.8, 4, 2, 48, 33.5, -8, material('#dae5de'), true);
  bowl.scale.z = 0.64;
  tube(group, [[48, 33, -2.6], [48, 37, -2.6], [48, 37, -5]], 0.4, brass);
  basin.userData.fixture = 'basin';
  scene.add(group);
  register('basin', group);
  tag(labels, 'EXISTING BASIN / OUTSIDE', 48, 23, -18, { width: 34 });
}

function buildDrain() {
  const group = new THREE.Group();
  box(group, 30, 0.3, 1.5, 78, 0.15, 46.25, material('#5a665d', { metalness: 0.6 }));
  for (let x = 64; x < 93; x += 1.5) box(group, 0.45, 0.05, 1.1, x, 0.32, 46.25, material('#a9b1a3'));
  scene.add(group);
  register('drain', group);
}

function buildDoor(brass) {
  const wood = material('#a68156', { roughness: 0.8 });
  doorPivot = new THREE.Group();
  doorPivot.position.set(96, 0, 0);
  box(doorPivot, 29, 80, 1.2, -14.5, 40, 0, wood);
  for (let x = -27; x < -1; x += 2) line(doorPivot, [[x, 2, -0.62], [x, 78, -0.62]], '#8b6943');
  box(doorPivot, 3.2, 0.5, 1.7, -25, 37, -1.1, brass);
  doorPivot.rotation.y = Math.PI / 2;
  scene.add(doorPivot);
  const arc = [];
  for (let step = 0; step <= 40; step++) {
    const angle = step / 40 * Math.PI / 2;
    arc.push([96 - 29 * Math.cos(angle), 0.2, -29 * Math.sin(angle)]);
  }
  line(dimensionLines, arc, '#a78a56', true);
  tag(dimensionLines, '29 in / RETAINED ENTRY', 81.5, 1.2, -37, { width: 31 });
}

function buildMeasurements() {
  const arrow = (a, b) => {
    line(dimensionLines, [a, b], '#59745e');
    const dx = b[0] - a[0], dd = b[2] - a[2];
    if (Math.abs(dx) > Math.abs(dd)) {
      for (const p of [a, b]) line(dimensionLines, [[p[0], p[1], p[2] - 1.6], [p[0], p[1], p[2] + 1.6]], '#59745e');
    } else {
      for (const p of [a, b]) line(dimensionLines, [[p[0] - 1.6, p[1], p[2]], [p[0] + 1.6, p[1], p[2]]], '#59745e');
    }
  };
  arrow([0, 0.3, -9], [96, 0.3, -9]);
  arrow([-9, 0.3, 0], [-9, 0.3, 48]);
  tag(dimensionLines, '96 in / 8 ft', 24, 0.8, -9, { width: 20 });
  tag(dimensionLines, '48 in / 4 ft', -10, 1, 27, { width: 21 });
  heightDimension = new THREE.Group();
  line(heightDimension, [[-7, 0, 48], [-7, 144, 48]]);
  tag(heightDimension, '144 in / 12 ft', -7, 127, 48, { width: 24 });
  dimensionLines.add(heightDimension);
  heightDimension.visible = false;
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), new THREE.MeshBasicMaterial({ color: '#7fa9c1', transparent: true, opacity: 0.24, depthWrite: false }));
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(17.5, 0.15, -11);
  clearanceGroup.add(patch);
  line(clearanceGroup, [[17.5, 0.3, 0], [17.5, 0.3, 22]], '#5b7f95', true);
  tag(clearanceGroup, '22 in / WC FRONT CLEAR', 26, 1.2, 10, { width: 32, color: '#41657a' });
  clearanceGroup.visible = false;
  const ghost = box(removedGroup, 5.5, 45, 48, 37.75, 22.5, 24, new THREE.MeshBasicMaterial({ color: '#c78e67', transparent: true, opacity: 0.13, depthWrite: false }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(ghost.geometry), new THREE.LineBasicMaterial({ color: '#b67b50', transparent: true, opacity: 0.5 }));
  edges.position.copy(ghost.position);
  removedGroup.add(edges);
  tag(removedGroup, 'REMOVED / 5.5 in PARTITION', 37.75, 51, 24, { width: 35, color: '#9b603d', background: '#fff3df' });
  removedGroup.visible = false;
  scene.add(labels, dimensionLines, clearanceGroup, removedGroup);
}

function auditGeometry() {
  scene.updateMatrixWorld(true);
  const wc = new THREE.Box3().setFromObject(fixtureModels.get('toilet'));
  const floor = new THREE.Box3().setFromObject(floorMesh);
  const size = wc.getSize(new THREE.Vector3());
  const floorSize = floor.getSize(new THREE.Vector3());
  const close = (actual, expected) => Math.abs(actual - expected) < 0.02;
  const matches = close(size.x, ITEMS.toilet.width) && close(size.z, ITEMS.toilet.depth)
    && close(-wc.max.z, ITEMS.toilet.d) && close(floorSize.x, ROOM.width) && close(floorSize.z, ROOM.depth);
  geometryAudit = {
    matches,
    wc: { width: size.x, depth: size.z, front: -wc.max.z, back: -wc.min.z, height: size.y },
    floor: { width: floorSize.x, depth: floorSize.z },
  };
  if (!matches) throw new Error('Rendered floor or WC geometry does not match the checked plan dimensions.');
}

function initialize3D() {
  const host = $('#canvas-host');
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#eef0e7');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D bathroom model');
  renderer.domElement.setAttribute('role', 'img');
  host.append(renderer.domElement);
  perspectiveCamera = new THREE.PerspectiveCamera(42, 1, 0.5, 1800);
  topCamera = new THREE.OrthographicCamera(-80, 80, 80, -80, 0.5, 1800);
  topCamera.up.set(0, 0, -1);
  activeCamera = perspectiveCamera;
  controls = new OrbitControls(activeCamera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 16;
  controls.maxDistance = 520;
  controls.maxPolarAngle = Math.PI / 2 - 0.025;
  controls.minZoom = 0.45;
  controls.maxZoom = 5;
  const hemi = new THREE.HemisphereLight('#fff8e6', '#a8b8a4', 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4d8', 2.4);
  sun.position.set(-45, 180, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 150, bottom: -150, near: 0.5, far: 500 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.2;
  sun.target.position.set(48, 0, -24);
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#e4f0ec', 0.7);
  fill.position.set(150, 100, -130);
  scene.add(fill);
  const ground = mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.ShadowMaterial({ color: '#394632', opacity: 0.15 }), scene, 48, -2.5, 20);
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
  wallMaterial = material('#e4e3d5', { roughness: 0.8 });
  accentMaterial = material('#7b9b85', { roughness: 0.68 });
  const ceramic = material('#f5f4e9', { roughness: 0.24, metalness: 0.02 });
  const brass = material('#b89b64', { metalness: 0.7, roughness: 0.32 });
  buildFloor();
  buildWalls();
  buildToilet(ceramic, brass);
  buildShower(brass);
  buildBucket();
  buildHeater(ceramic, brass);
  buildShelf();
  buildBasin(ceramic, brass);
  buildDrain();
  buildDoor(brass);
  buildMeasurements();
  selectionBox = new THREE.BoxHelper(fixtureModels.get('toilet'), '#bd9659');
  selectionBox.material.transparent = true;
  selectionBox.material.opacity = 0.65;
  scene.add(selectionBox);
  auditGeometry();
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    showViewerError(new Error('The WebGL graphics context was lost. Reload the viewer to restore 3D.'));
  });
  let pointerStart;
  renderer.domElement.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; });
  renderer.domElement.addEventListener('pointerup', event => {
    if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, activeCamera);
    const hit = raycaster.intersectObjects(pickable, false)[0];
    if (hit) selectItem(hit.object.userData.fixture);
  });
  state.ready = true;
  setView('perspective');
  renderer.setAnimationLoop(() => {
    if (state.view === 'plan' || document.hidden || !state.ready) return;
    controls.update();
    renderer.render(scene, activeCamera);
  });
}

function resize() {
  if (!renderer) return;
  const { width, height } = $('#canvas-host').getBoundingClientRect();
  if (width <= 0 || height <= 0) return;
  renderer.setSize(width, height, false);
  perspectiveCamera.aspect = width / height;
  perspectiveCamera.updateProjectionMatrix();
  const aspect = width / height;
  const halfHeight = Math.max(61, 70 / aspect);
  topCamera.left = -halfHeight * aspect;
  topCamera.right = halfHeight * aspect;
  topCamera.top = halfHeight;
  topCamera.bottom = -halfHeight;
  topCamera.updateProjectionMatrix();
  if (state.ready && state.view === 'perspective') fitPerspective();
}

function fitPerspective() {
  const camera = perspectiveCamera;
  const target = controls.target;
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const direction = camera.position.clone().sub(target).normalize();
  const inverse = camera.quaternion.clone().invert();
  const verticalTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  let distance = 0;
  const top = state.walls === 'full' ? 151 : 120;
  for (const x of [-15, 110]) for (const y of [0, top]) for (const z of [-54, 43]) {
    const point = new THREE.Vector3(x, y, z).sub(target).applyQuaternion(inverse);
    distance = Math.max(distance, Math.abs(point.x) / (verticalTangent * camera.aspect * 0.86) + point.z,
      Math.abs(point.y) / (verticalTangent * 0.76) + point.z);
  }
  camera.position.copy(target).addScaledVector(direction, distance);
  camera.updateMatrixWorld();
}

function setView(view) {
  state.view = view;
  const plan = view === 'plan';
  $('#plan-host').hidden = !plan;
  $('#canvas-host').hidden = plan;
  $('#viewer-error').hidden = plan || !state.error;
  $('#save-image').disabled = plan || !state.ready;
  $('#view-caption').textContent = plan ? 'DIMENSIONED PLAN / INSIDE FACE MEASUREMENTS' : 'PROPOSED OPEN WET ROOM';
  $('#viewer-help').innerHTML = plan
    ? '<strong>Every inch matters.</strong><span>Back wall at top / retained entrance at bottom right</span>'
    : '<strong>Make yourself at home.</strong><span>Drag to rotate &middot; Scroll to zoom &middot; Click a fixture</span>';
  $$('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (!state.ready || plan) return;
  controls.enabled = false;
  controls.dispose();
  activeCamera = view === 'top' ? topCamera : perspectiveCamera;
  const target = new THREE.Vector3(48, state.walls === 'full' ? 58 : 35, -20);
  if (view === 'top') {
    activeCamera.position.set(48, 280, -12);
    target.set(48, 0, -12);
    activeCamera.zoom = 1;
    activeCamera.updateProjectionMatrix();
  } else if (view === 'inside') {
    activeCamera.position.set(80, 57, 14);
    target.set(35, 32, -40);
  } else {
    activeCamera.position.set(-65, state.walls === 'full' ? 180 : 110, 145);
  }
  controls = new OrbitControls(activeCamera, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 12;
  controls.maxDistance = 520;
  controls.minZoom = 0.45;
  controls.maxZoom = 5;
  controls.enableRotate = view !== 'top';
  controls.maxPolarAngle = Math.PI / 2 - 0.025;
  controls.update();
  selectionBox.visible = Boolean(state.selected);
  resize();
  renderer.render(scene, activeCamera);
}

function setWalls(value) {
  state.walls = value;
  $('#wall-caption').textContent = value === 'full' ? 'Full height: 144 in / ceiling omitted' : value === 'hidden' ? 'Shell hidden / fittings retained' : 'Cutaway / ceiling omitted';
  if (!state.ready) return;
  fullWalls.visible = value === 'full';
  cutawayWalls.visible = value === 'cutaway';
  scene.getObjectByName('shower-accent').visible = value !== 'hidden';
  heightDimension.visible = value === 'full';
  if (state.view === 'perspective') setView('perspective');
}

function toggleDoor() {
  state.doorOpen = !state.doorOpen;
  $('#door-toggle').textContent = `Door: ${state.doorOpen ? 'open' : 'closed'}`;
  $('#door-toggle').setAttribute('aria-pressed', String(state.doorOpen));
  if (doorPivot) doorPivot.rotation.y = state.doorOpen ? Math.PI / 2 : 0;
  refreshPlan();
}

function selectTab(name) {
  $$('.tab').forEach(button => {
    const active = button.dataset.tab === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $$('.tab-panel').forEach(panel => { panel.hidden = panel.id !== `panel-${name}`; });
}

function showMessage(message) {
  $('#export-message').textContent = message;
  $('#export-message').hidden = false;
  window.clearTimeout(showMessage.timer);
  showMessage.timer = window.setTimeout(() => { $('#export-message').hidden = true; }, 6500);
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  showMessage(`Download requested: ${filename}`);
}

function showViewerError(error) {
  console.error('Bathroom viewer:', error);
  state.error = error.message;
  state.ready = false;
  $('#viewer-error-text').textContent = error.message;
  $('#viewer-error').hidden = state.view === 'plan';
  $('#save-image').disabled = true;
  if (renderer) renderer.setAnimationLoop(null);
}

function wireControls() {
  $$('.tab').forEach(button => button.addEventListener('click', () => selectTab(button.dataset.tab)));
  $$('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $('#wall-mode').addEventListener('change', event => setWalls(event.target.value));
  $('#door-toggle').addEventListener('click', toggleDoor);
  $('#reset-view').addEventListener('click', () => setView('perspective'));
  for (const [id, key, group] of [['dimensions', 'dimensions', dimensionLines], ['labels', 'labels', labels], ['clearances', 'clearances', clearanceGroup], ['old-wall', 'removed', removedGroup]]) {
    $(`#${id}`).addEventListener('change', event => {
      state[key] = event.target.checked;
      group.visible = state[key];
      refreshPlan();
    });
  }
  $$('[data-finish]').forEach(button => button.addEventListener('click', () => {
    state.finish = button.dataset.finish;
    $$('[data-finish]').forEach(swatch => {
      const active = swatch === button;
      swatch.classList.toggle('active', active);
      swatch.setAttribute('aria-pressed', String(active));
    });
    if (accentMaterial) accentMaterial.color.set(state.finish === 'sage' ? '#7b9b85' : '#c1a57c');
    if (wallMaterial) wallMaterial.color.set(state.finish === 'sage' ? '#e4e3d5' : '#eeeadf');
  }));
  $('#save-plan').addEventListener('click', () => download(
    new Blob([planSvg({ showRemoved: state.removed, showClearances: state.clearances, doorOpen: state.doorOpen })], { type: 'image/svg+xml' }),
    'Bathroom-dimensioned-plan.svg',
  ));
  $('#save-image').addEventListener('click', () => {
    if (!state.ready || state.view === 'plan') {
      showMessage('Choose an available 3D view before saving an image.');
      return;
    }
    renderer.render(scene, activeCamera);
    renderer.domElement.toBlob(blob => {
      if (!blob) {
        console.error('Bathroom viewer: PNG export returned no image.');
        showMessage('Image export failed. Try another browser or use Download plan.');
        return;
      }
      download(blob, `Bathroom-${state.view}.png`);
    }, 'image/png');
  });
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'SUMMARY'].includes(event.target.tagName)) return;
    switch (event.key.toLowerCase()) {
      case 'h': setView('perspective'); break;
      case 't': setView('top'); break;
      case 'd': toggleDoor(); break;
      case 'm': $('#dimensions').click(); break;
      case 'escape':
        state.selected = null;
        if (selectionBox) selectionBox.visible = false;
        $$('.item-card').forEach(button => {
          button.classList.remove('active');
          button.setAttribute('aria-pressed', 'false');
        });
        break;
    }
  });
}

renderInformation();
wireControls();
try {
  initialize3D();
} catch (error) {
  showViewerError(error instanceof Error ? error : new Error(String(error)));
}

Object.defineProperty(window, 'bathroomViewer', {
  value: Object.freeze({
    snapshot() {
      return {
        ...state,
        geometry: geometryAudit,
        measurements: { ...ROOM, areaSquareFeet: metrics.areaSquareFeet, recoveredSquareFeet: metrics.recoveredSquareFeet, wcFrontClearance: metrics.frontClearance },
        camera: activeCamera ? { type: activeCamera.type, position: activeCamera.position.toArray(), zoom: activeCamera.zoom } : null,
        visible: { dimensions: dimensionLines.visible, labels: labels.visible, clearances: clearanceGroup.visible, removed: removedGroup.visible, fullWalls: Boolean(fullWalls?.visible), cutawayWalls: Boolean(cutawayWalls?.visible) },
        doorAngleDegrees: doorPivot ? THREE.MathUtils.radToDeg(doorPivot.rotation.y) : null,
        fixtureScreenPoints: activeCamera && renderer ? Object.fromEntries([...fixtureModels].map(([id, object]) => {
          const point = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).project(activeCamera);
          const bounds = renderer.domElement.getBoundingClientRect();
          return [id, { x: (point.x + 1) * bounds.width / 2, y: (1 - point.y) * bounds.height / 2 }];
        })) : null,
        checks: metrics.checks.map(check => ({ id: check.id, status: check.status })),
        canvas: renderer ? { width: renderer.domElement.width, height: renderer.domElement.height } : null,
      };
    },
  }),
});
