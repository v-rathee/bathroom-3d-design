import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  ROOM, ITEMS, DOORS, EXISTING_PAN, itemsForBasin, basinApproach,
  evaluateLayout, evaluateSeparate, doorTip, planSvg, comparisonSvg,
} from './layout.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let metrics = evaluateLayout();
const state = {
  view: 'perspective', walls: 'cutaway', doorOpen: true,
  dimensions: true, labels: true, clearances: false, removed: false,
  finish: 'sage', selected: 'toilet', ready: false, error: null,
  comparison: true, baselineVariant: 'current', basinPlacement: 'outside',
  frameChange: false, doorAngle: 90,
};
const fixtureModels = new Map();
const pickable = [];
const labels = new THREE.Group();
const dimensionLines = new THREE.Group();
const clearanceGroup = new THREE.Group();
const removedGroup = new THREE.Group();
const baseline = {
  scene: null, models: new Map(), pickable: [], labels: new THREE.Group(),
  dimensions: new THREE.Group(), walls: {}, doors: {}, variants: {},
};
const basinModels = {};
const basinLabels = {};
let scene, renderer, controls, activeCamera, perspectiveCamera, topCamera;
let fullWalls, cutawayWalls, doorPivot, selectionBox, floorMesh, accentMaterial, wallMaterial;
let heightDimension, geometryAudit, resizeObserver;
let basinMirror, insideApproach;

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
  const items = itemsForBasin(state.basinPlacement);
  metrics = evaluateLayout(ROOM, items);
  $('#item-list').innerHTML = itemOrder.map((id, index) => `<button type="button" class="item-card${id === state.selected ? ' active' : ''}" data-item="${id}" aria-pressed="${id === state.selected}"><span class="item-number">${String(index + 1).padStart(2, '0')}</span><span><strong>${ITEMS[id].name}</strong><small>${shortSizes[id]}</small></span><span class="item-arrow" aria-hidden="true">&rarr;</span></button>`).join('');
  $('.item-card[data-item="basin"] strong').textContent = items.basin.name;
  $('.item-card[data-item="basin"] small').textContent = state.basinPlacement === 'inside' ? '18 x 12 in / assumed compact product' : shortSizes.basin;
  $$('.item-card').forEach(button => button.addEventListener('click', () => selectItem(button.dataset.item)));
  const counts = { pass: 0, caution: 0, unverified: 0 };
  metrics.checks.forEach(check => counts[check.status]++);
  $('#check-count').textContent = String(counts.caution + counts.unverified);
  $('#checks-summary').innerHTML = `<span>${counts.pass} geometry passes</span><span>${counts.caution} cautions</span><span>${counts.unverified} site checks</span>`;
  $('#check-list').innerHTML = metrics.checks.map(check => `<details class="check-row ${check.status}" data-check="${check.id}"><summary><span class="check-status">${check.status === 'unverified' ? 'Site verification needed' : check.status === 'pass' ? 'Geometry pass' : 'Design caution'}</span>${check.title}</summary><p>${check.detail}</p></details>`).join('');
  if (state.selected) selectItem(state.selected);
  refreshPlan();
  updatePaneNotes();
  positionPanes();
}

function selectItem(id) {
  const existing = id.startsWith('existing-');
  const currentItems = {
    'existing-toilet': state.baselineVariant === 'western'
      ? { ...ITEMS.toilet, category: 'Separate-room test fit / door alteration may be needed', description: 'Same 15 x 25-inch WC, in the existing 35 x 48-inch toilet bay. It has 22 inches in front and 17.5 inches centre-to-side-wall, but the retained 29-inch inward door sweep overlaps its planning envelope. Inspect around 55 degrees. This is not a verified drop-in replacement.' }
      : EXISTING_PAN,
    'existing-bucket': { ...ITEMS.bucket, x: 49.5, d: 9.5, category: 'Existing / position and size illustrative', description: 'Bucket placed approximately from the room photo. Its size and exact location were not surveyed.' },
    'existing-basin': ITEMS.basin,
    'existing-taps': { name: 'Existing wall taps', category: 'Existing / illustration from the photos', width: 8, depth: 4, description: 'The current bathing room shows two wall taps. Heights and spacing are illustrative. A shower or geyser could be upgraded without removing the partition.' },
  };
  const item = existing ? currentItems[id] : itemsForBasin(state.basinPlacement)[id];
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
    selectionBox.visible = !existing && Boolean(object) && state.view !== 'plan';
    if (object) selectionBox.setFromObject(object);
  }
  if (baseline.selection) {
    const object = baseline.models.get(id);
    baseline.selection.visible = existing && state.comparison && Boolean(object) && state.view !== 'plan';
    if (object) baseline.selection.setFromObject(object);
  }
}

function refreshPlan() {
  const options = planOptions();
  $('#plan-host').innerHTML = planSvg(options);
  $('#existing-plan-host').innerHTML = planSvg({ ...options, scenario: state.baselineVariant });
}

function planOptions() {
  return {
    showRemoved: state.removed, showClearances: state.clearances,
    doorAngle: state.doorAngle, basinPlacement: state.basinPlacement,
    variant: state.baselineVariant, frameChange: state.frameChange,
  };
}

function updatePaneNotes() {
  const separate = evaluateSeparate(state.baselineVariant, { frameChange: state.frameChange, angle: state.doorAngle });
  $('#existing-note').textContent = separate.fullSweepConflict
    ? 'Full inward sweep overlaps this WC. Scrub to 55 degrees; not a drop-in swap.'
    : separate.frameChangeRequired
      ? 'Outward option requires door/frame work and an outside-clearance check.'
      : '35 + 55.5 in rooms; partition retained. Fixtures approximate; both doors inward.';
  $('#existing-note').classList.toggle('clash-note', separate.fullSweepConflict);
  $('#proposed-note').textContent = state.basinPlacement === 'inside'
    ? '18 x 12 in assumed handbasin on BACK wall; 22 in WC front clearance retained.'
    : 'Right door stays inward. Basin remains outside. Open wet-room floor.';
  $('#retrofit-frame').disabled = state.baselineVariant !== 'western' || !state.comparison;
  $('#retrofit-warning').hidden = state.baselineVariant !== 'western';
  $('#retrofit-warning').textContent = separate.fullSweepConflict
    ? 'Seated WC test fit: the full door sweep overlaps the selected WC envelope, even though the 90-degree open position is clear. Changing hinge sides alone will not reverse the inward-only frame.'
    : 'A changed outward swing is shown ONLY as a frame/door alteration proposal. External clearance is unknown. A sliding door also needs parking space; the outside basin may obstruct it.';
  $('#angle-value').textContent = `${state.doorAngle} degrees`;
}

function getViewports() {
  const stage = $('.stage');
  const stacked = state.comparison && stage.clientWidth < 650;
  stage.classList.toggle('comparing', state.comparison);
  stage.classList.toggle('stacked', stacked);
  const { width, height } = stage.getBoundingClientRect();
  const top = state.comparison ? 190 : 155, bottom = 85, margin = 12;
  if (!state.comparison) return { width, height, stacked: false, proposed: { left: margin, top, width: width - margin * 2, height: height - top - bottom }, existing: null };
  if (stacked) {
    const paneHeight = (height - top - bottom - 80) / 2;
    return {
      width, height, stacked,
      existing: { left: margin, top, width: width - margin * 2, height: paneHeight },
      proposed: { left: margin, top: top + paneHeight + 80, width: width - margin * 2, height: paneHeight },
    };
  }
  const paneWidth = (width - margin * 3) / 2;
  return {
    width, height, stacked,
    existing: { left: margin, top, width: paneWidth, height: height - top - bottom },
    proposed: { left: margin * 2 + paneWidth, top, width: paneWidth, height: height - top - bottom },
  };
}

function positionPanes() {
  const panes = getViewports();
  for (const [name, rectangle] of [['existing', panes.existing], ['proposed', panes.proposed]]) {
    const heading = $(`#${name}-heading`);
    const plan = name === 'existing' ? $('#existing-plan-host') : $('#plan-host');
    heading.hidden = !rectangle;
    plan.hidden = !rectangle || state.view !== 'plan';
    if (!rectangle) continue;
    Object.assign(heading.style, { left: `${rectangle.left}px`, top: `${rectangle.top - 72}px`, width: `${rectangle.width}px` });
    Object.assign(plan.style, { inset: 'auto', left: `${rectangle.left}px`, top: `${rectangle.top}px`, width: `${rectangle.width}px`, height: `${rectangle.height}px` });
  }
  return panes;
}

function renderScenes() {
  const panes = getViewports();
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, panes.width, panes.height);
  renderer.setClearColor('#eef0e7', 1);
  renderer.clear();
  renderer.setScissorTest(true);
  for (const [targetScene, pane] of [[baseline.scene, panes.existing], [scene, panes.proposed]]) {
    if (!pane) continue;
    const bottom = panes.height - pane.top - pane.height;
    renderer.setViewport(pane.left, bottom, pane.width, pane.height);
    renderer.setScissor(pane.left, bottom, pane.width, pane.height);
    renderer.render(targetScene, activeCamera);
  }
  renderer.setScissorTest(false);
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

function register(id, object, models = fixtureModels, targets = pickable) {
  object.name = id;
  object.traverse(child => {
    if (child.isMesh) {
      child.userData.fixture = id;
      targets.push(child);
    }
  });
  models.set(id, object);
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
  buildFrame(scene, 67, timber);
}

function buildFrame(parent, start, timber) {
  box(parent, 1.3, 80, 2, start - 0.4, 40, 0, timber);
  box(parent, 1.3, 80, 2, start + 29.6, 40, 0, timber);
  box(parent, 31.3, 1.4, 2, start + 14.6, 80.7, 0, timber);
}

function buildFloor(parent = scene, wet = true) {
  const foundation = material('#c9c4b5');
  box(parent, 104, 2, 56, 48, -1.2, 24, foundation);
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
  const floor = box(parent, 96, 0.3, 48, 48, -0.15, 24, material('#ffffff', { map: floorTexture, roughness: 0.86 }));
  for (let x = 0; x <= 96; x += 12) line(parent, [[x, 0.03, 0], [x, 0.03, 48]], '#b6b09e');
  for (let d = 0; d <= 48; d += 12) line(parent, [[0, 0.04, d], [96, 0.04, d]], '#b6b09e');
  box(parent, 96, 0.25, 32, 48, -0.5, -16, material('#e0e2d7', { roughness: 0.98 }));
  const zone = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshBasicMaterial({ color: '#adc9b5', transparent: true, opacity: 0.18, depthWrite: false }));
  zone.rotation.x = -Math.PI / 2;
  zone.position.set(78, 0.08, -30);
  if (wet) parent.add(zone);
  return floor;
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
  for (const placement of ['outside', 'inside']) {
    const item = itemsForBasin(placement).basin;
    const x = item.x + item.width / 2, d = item.d + item.depth / 2;
    const group = new THREE.Group();
    box(group, item.width, 5, item.depth, x, 31.5, d, ceramic);
    ovalRing(group, item.width - 1.5, item.depth - 2, item.width - 5.5, item.depth - 6, 1, x, 34, d, ceramic);
    const bowl = cylinder(group, 5.8, 4, 2, x, 33.5, d, material('#dae5de'), true);
    bowl.scale.z = (item.depth - 6) / 11.6;
    const mount = item.d + item.depth - 1;
    tube(group, [[x, 33, mount], [x, 37, mount], [x, 37, d + 2]], 0.4, brass);
    group.visible = placement === state.basinPlacement;
    scene.add(group);
    register('basin', group);
    basinModels[placement] = group;
    basinLabels[placement] = tag(labels, placement === 'outside' ? 'EXISTING BASIN / OUTSIDE' : 'COMPACT BASIN / INSIDE',
      x, placement === 'outside' ? 23 : 43, placement === 'outside' ? -24 : 38, { width: placement === 'outside' ? 34 : 29 });
    basinLabels[placement].visible = group.visible;
  }
  fixtureModels.set('basin', basinModels[state.basinPlacement]);
  basinMirror = new THREE.Group();
  box(basinMirror, 18, 24, 0.4, 43.5, 62, 47.6, brass);
  box(basinMirror, 16.5, 22.5, 0.1, 43.5, 62, 47.3, material('#b4c9c4', { metalness: 0.65, roughness: 0.13 }));
  basinMirror.visible = state.basinPlacement === 'inside';
  scene.add(basinMirror);
}

function buildDrain() {
  const group = new THREE.Group();
  box(group, 30, 0.3, 1.5, 78, 0.15, 46.25, material('#5a665d', { metalness: 0.6 }));
  for (let x = 64; x < 93; x += 1.5) box(group, 0.45, 0.05, 1.1, x, 0.32, 46.25, material('#a9b1a3'));
  scene.add(group);
  register('drain', group);
}

function makeDoor(parent, definition, brass) {
  const wood = material('#a68156', { roughness: 0.8, transparent: true, opacity: 0.32, depthWrite: false });
  const pivot = new THREE.Group();
  const sign = definition.hinge === 'right' ? -1 : 1;
  pivot.position.set(definition.x + (sign < 0 ? definition.width : 0), 0, 0);
  const leaf = box(pivot, definition.width, definition.top - definition.bottom, 1.2, sign * definition.width / 2, (definition.top + definition.bottom) / 2, 0, wood);
  leaf.castShadow = false;
  pivot.userData.leaf = leaf;
  box(pivot, 3.2, 0.5, 1.7, sign * 25, 37, -1.1, brass);
  const tip = new THREE.Object3D();
  tip.name = 'door-tip';
  tip.position.set(sign * definition.width, 40, 0);
  pivot.add(tip);
  parent.add(pivot);
  return pivot;
}

function doorTrace(parent, definition, color = '#a78a56') {
  const arc = [];
  for (let step = 0; step <= 40; step++) {
    const tip = doorTip(definition, step / 40 * 90);
    arc.push([tip.x, 0.2, tip.d]);
  }
  return line(parent, arc, color, true);
}

function buildDoor(brass) {
  doorPivot = makeDoor(scene, DOORS.bathroom, brass);
  doorTrace(dimensionLines, DOORS.bathroom);
  tag(dimensionLines, '29 in / INWARD ENTRY', 81.5, 1.2, -10, { width: 29 });
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
  const approach = basinApproach(itemsForBasin('inside').basin);
  insideApproach = new THREE.Group();
  const basinPatch = new THREE.Mesh(new THREE.PlaneGeometry(approach.width, approach.depth), new THREE.MeshBasicMaterial({ color: '#7fa9c1', transparent: true, opacity: 0.24, depthWrite: false }));
  basinPatch.rotation.x = -Math.PI / 2;
  basinPatch.position.set(approach.x + approach.width / 2, 0.15, -(approach.d + approach.depth / 2));
  insideApproach.add(basinPatch);
  tag(insideApproach, '24 x 21 in / BASIN APPROACH', 44, 1.2, 25, { width: 35, color: '#41657a' });
  insideApproach.visible = state.basinPlacement === 'inside';
  clearanceGroup.add(insideApproach);
  clearanceGroup.visible = false;
  const ghost = box(removedGroup, 5.5, 45, 48, 37.75, 22.5, 24, new THREE.MeshBasicMaterial({ color: '#c78e67', transparent: true, opacity: 0.13, depthWrite: false }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(ghost.geometry), new THREE.LineBasicMaterial({ color: '#b67b50', transparent: true, opacity: 0.5 }));
  edges.position.copy(ghost.position);
  removedGroup.add(edges);
  tag(removedGroup, 'REMOVED / 5.5 in PARTITION', 37.75, 51, 24, { width: 35, color: '#9b603d', background: '#fff3df' });
  removedGroup.visible = false;
  scene.add(labels, dimensionLines, clearanceGroup, removedGroup);
}

function addEnvironment(parent) {
  const hemi = new THREE.HemisphereLight('#fff8e6', '#a8b8a4', 1.6);
  parent.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4d8', 2.4);
  sun.position.set(-45, 180, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 150, bottom: -150, near: 0.5, far: 500 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.2;
  sun.target.position.set(48, 0, -24);
  parent.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#e4f0ec', 0.7);
  fill.position.set(150, 100, -130);
  parent.add(fill);
  const ground = mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.ShadowMaterial({ color: '#394632', opacity: 0.15 }), parent, 48, -2.5, 20);
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
}

function buildBaseline(ceramic, brass) {
  baseline.scene = new THREE.Scene();
  baseline.scene.background = new THREE.Color('#eef0e7');
  addEnvironment(baseline.scene);
  baseline.floor = buildFloor(baseline.scene, false);
  const wall = material('#e3dfd1', { roughness: 0.86 });
  for (const full of [false, true]) {
    const group = new THREE.Group();
    const backHeight = full ? 144 : 112, sideHeight = full ? 144 : 18, frontHeight = full ? 144 : 7;
    box(group, 104, backHeight, 4, 48, backHeight / 2, 50, wall);
    box(group, 4, sideHeight, 48, -2, sideHeight / 2, 24, wall);
    box(group, 4, sideHeight, 48, 98, sideHeight / 2, 24, wall);
    box(group, 38, frontHeight, 4, 48, frontHeight / 2, -2, wall);
    const dividerHeight = full ? 144 : 54;
    const divider = box(group, 5.5, dividerHeight, 48, 37.75, dividerHeight / 2, 24, wall);
    if (!full) baseline.divider = divider;
    if (full) for (const x of [14.5, 81.5]) box(group, 29, 64, 4, x, 112, -2, wall);
    for (let x = 0; x <= 96; x += 12) line(group, [[x, 0, 47.96], [x, backHeight, 47.96]], '#c7c9b9');
    for (let y = 12; y < backHeight; y += 12) line(group, [[0, y, 47.95], [96, y, 47.95]], '#c7c9b9');
    for (let d = 0; d <= 48; d += 12) line(group, [[34.96, 0, d], [34.96, dividerHeight, d]], '#c7c9b9');
    group.visible = !full;
    baseline.walls[full ? 'full' : 'cutaway'] = group;
    baseline.scene.add(group);
  }
  const timber = material('#ab8154', { roughness: 0.8 });
  buildFrame(baseline.scene, 0, timber);
  buildFrame(baseline.scene, 67, timber);

  const indian = new THREE.Group();
  const pan = new THREE.Group();
  box(pan, 20, 0.2, 24, 17.5, 0.1, 34, ceramic);
  const hole = cylinder(pan, 1, 1, 0.05, 17.5, 0.23, 34, material('#829188'));
  hole.scale.set(3.1, 1, 7);
  for (const x of [11, 24]) {
    box(pan, 4, 0.15, 16, x, 0.28, 34, material('#d7ddd1'));
    for (let d = 27; d <= 41; d += 1.5) line(pan, [[x - 1.8, 0.37, d], [x + 1.8, 0.37, d]], '#adb9ac');
  }
  indian.add(pan);
  baseline.pan = pan;
  box(indian, 18, 14, 5, 17.5, 36, 45.5, ceramic);
  box(indian, 18, 0.5, 5, 17.5, 43.25, 45.5, ceramic);
  tube(indian, [[17.5, 29, 44.2], [17.5, 15, 44.2], [17.5, 0.6, 43]], 0.75, material('#8e9890'));
  tube(indian, [[34.4, 37, 46], [29, 37, 46], [26.5, 37, 46]], 0.3, brass);
  baseline.variants.current = indian;
  baseline.scene.add(indian);
  register('existing-toilet', indian, baseline.models, baseline.pickable);
  const western = fixtureModels.get('toilet').clone(true);
  baseline.variants.western = western;
  western.visible = false;
  baseline.scene.add(western);
  register('existing-toilet', western, baseline.models, baseline.pickable);
  baseline.models.set('existing-toilet', indian);

  const bucket = fixtureModels.get('bucket').clone(true);
  bucket.position.x -= 34;
  bucket.position.z += 24;
  baseline.scene.add(bucket);
  register('existing-bucket', bucket, baseline.models, baseline.pickable);
  const basin = basinModels.outside.clone(true);
  basin.visible = true;
  baseline.scene.add(basin);
  register('existing-basin', basin, baseline.models, baseline.pickable);
  const taps = new THREE.Group();
  for (const x of [65.5, 71]) {
    tube(taps, [[x, 32, 47], [x, 32, 44.5], [x, 31, 44]], 0.4, brass);
    box(taps, 2, 0.35, 0.4, x, 33.2, 45.5, brass);
  }
  baseline.scene.add(taps);
  register('existing-taps', taps, baseline.models, baseline.pickable);
  baseline.doors.toilet = makeDoor(baseline.scene, DOORS.toilet, brass);
  baseline.doors.bathroom = makeDoor(baseline.scene, DOORS.bathroom, brass);
  baseline.inwardTrace = doorTrace(baseline.dimensions, DOORS.toilet);
  baseline.outwardTrace = doorTrace(baseline.dimensions, { ...DOORS.toilet, direction: 'outward' });
  baseline.outwardTrace.visible = false;
  doorTrace(baseline.dimensions, DOORS.bathroom);
  tag(baseline.dimensions, '35 in / TOILET', 17.5, 1.2, -10, { width: 23 });
  tag(baseline.dimensions, '55.5 in / BATH', 70, 1.2, -10, { width: 25 });
  baseline.indianLabel = tag(baseline.labels, 'CURRENT SQUAT WC', 17.5, 49, 39, { width: 29 });
  baseline.westernLabel = tag(baseline.labels, 'SEPARATE / SEATED WC', 17.5, 40, 39, { width: 30 });
  baseline.westernLabel.visible = false;
  tag(baseline.labels, 'PARTITION RETAINED', 37.75, 62, 25, { width: 30 });
  tag(baseline.labels, 'BASIN STAYS OUTSIDE', 48, 23, -24, { width: 31 });
  baseline.selection = new THREE.BoxHelper(indian, '#bd9659');
  baseline.selection.visible = false;
  baseline.clashBox = new THREE.BoxHelper(western, '#c05239');
  baseline.clashBox.visible = false;
  baseline.scene.add(baseline.labels, baseline.dimensions, baseline.selection, baseline.clashBox);
}

function updateBaseline() {
  if (!baseline.scene) return;
  const separate = evaluateSeparate(state.baselineVariant, { frameChange: state.frameChange, angle: state.doorAngle });
  const western = state.baselineVariant === 'western';
  baseline.variants.current.visible = !western;
  baseline.variants.western.visible = western;
  baseline.models.set('existing-toilet', baseline.variants[state.baselineVariant]);
  baseline.indianLabel.visible = !western;
  baseline.westernLabel.visible = western;
  baseline.inwardTrace.visible = !separate.frameChangeRequired;
  baseline.outwardTrace.visible = separate.frameChangeRequired;
  baseline.inwardTrace.material.color.set(separate.fullSweepConflict ? '#be533b' : '#a78a56');
  baseline.clashBox.visible = western && separate.currentAngleConflict;
  const radians = THREE.MathUtils.degToRad(state.doorAngle);
  baseline.doors.toilet.rotation.y = state.doorAngle === 0 ? 0 : separate.toiletDoor.direction === 'inward' ? radians : -radians;
  baseline.doors.bathroom.rotation.y = state.doorAngle === 0 ? 0 : -radians;
  if (state.selected?.startsWith('existing-')) selectItem(state.selected);
}

function setBasinPlacement(placement) {
  itemsForBasin(placement);
  state.basinPlacement = placement;
  if (state.ready) {
    for (const name of ['outside', 'inside']) {
      basinModels[name].visible = name === placement;
      basinLabels[name].visible = name === placement;
    }
    basinMirror.visible = placement === 'inside';
    insideApproach.visible = placement === 'inside';
    fixtureModels.set('basin', basinModels[placement]);
    fixtureModels.get('shelf').position.x = placement === 'inside' ? -34 : 0;
    auditGeometry();
  }
  renderInformation();
}

function auditGeometry() {
  scene.updateMatrixWorld(true);
  const wc = new THREE.Box3().setFromObject(fixtureModels.get('toilet'));
  const floor = new THREE.Box3().setFromObject(floorMesh);
  const size = wc.getSize(new THREE.Vector3());
  const floorSize = floor.getSize(new THREE.Vector3());
  const basin = new THREE.Box3().setFromObject(fixtureModels.get('basin'));
  const basinSize = basin.getSize(new THREE.Vector3());
  const expectedBasin = itemsForBasin(state.basinPlacement).basin;
  const divider = new THREE.Box3().setFromObject(baseline.divider);
  const dividerSize = divider.getSize(new THREE.Vector3());
  const pan = new THREE.Box3().setFromObject(baseline.pan).getSize(new THREE.Vector3());
  const separateWc = new THREE.Box3().setFromObject(baseline.variants.western).getSize(new THREE.Vector3());
  const shelf = new THREE.Box3().setFromObject(fixtureModels.get('shelf'));
  const expectedShelf = itemsForBasin(state.basinPlacement).shelf;
  const close = (actual, expected) => Math.abs(actual - expected) < 0.02;
  const matches = close(size.x, ITEMS.toilet.width) && close(size.z, ITEMS.toilet.depth)
    && close(-wc.max.z, ITEMS.toilet.d) && close(floorSize.x, ROOM.width) && close(floorSize.z, ROOM.depth)
    && close(basinSize.x, expectedBasin.width) && close(basinSize.z, expectedBasin.depth) && close(basin.min.x, expectedBasin.x)
    && close(-basin.max.z, expectedBasin.d) && close(divider.min.x, 35)
    && close(dividerSize.x, 5.5) && close(dividerSize.z, 48)
    && close(pan.x, 20) && close(pan.z, 24) && pan.y < DOORS.toilet.bottom
    && close(separateWc.x, 15) && close(separateWc.z, 25) && close(shelf.min.x, expectedShelf.x);
  geometryAudit = {
    matches,
    wc: { width: size.x, depth: size.z, front: -wc.max.z, back: -wc.min.z, height: size.y },
    floor: { width: floorSize.x, depth: floorSize.z },
    basin: { left: basin.min.x, width: basinSize.x, depth: basinSize.z, front: -basin.max.z, back: -basin.min.z },
    shelf: { left: shelf.min.x, right: shelf.max.x, bottom: shelf.min.y },
    partition: { x: divider.min.x, width: dividerSize.x, depth: dividerSize.z },
    existingPan: { width: pan.x, depth: pan.z, height: pan.y },
    separateWc: { width: separateWc.x, depth: separateWc.z },
  };
  if (!matches) throw new Error('Rendered room, WC, basin or retained partition does not match the checked plan dimensions.');
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
  addEnvironment(scene);
  wallMaterial = material('#e4e3d5', { roughness: 0.8 });
  accentMaterial = material('#7b9b85', { roughness: 0.68 });
  const ceramic = material('#f5f4e9', { roughness: 0.24, metalness: 0.02 });
  const brass = material('#b89b64', { metalness: 0.7, roughness: 0.32 });
  floorMesh = buildFloor();
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
  buildBaseline(ceramic, brass);
  selectionBox = new THREE.BoxHelper(fixtureModels.get('toilet'), '#bd9659');
  selectionBox.material.transparent = true;
  selectionBox.material.opacity = 0.65;
  scene.add(selectionBox);
  auditGeometry();
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe($('.stage'));
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    showViewerError(new Error('The WebGL graphics context was lost. Reload the viewer to restore 3D.'));
  });
  let pointerStart;
  renderer.domElement.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; });
  renderer.domElement.addEventListener('pointerup', event => {
    if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const panes = getViewports();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    const existing = panes.existing && x >= panes.existing.left && x <= panes.existing.left + panes.existing.width
      && y >= panes.existing.top && y <= panes.existing.top + panes.existing.height;
    const pane = existing ? panes.existing : panes.proposed;
    if (x < pane.left || x > pane.left + pane.width || y < pane.top || y > pane.top + pane.height) return;
    const pointer = new THREE.Vector2((x - pane.left) / pane.width * 2 - 1, -(y - pane.top) / pane.height * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, activeCamera);
    const visible = object => {
      for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return false;
      return true;
    };
    const hit = raycaster.intersectObjects((existing ? baseline.pickable : pickable).filter(visible), false)[0];
    if (hit) selectItem(hit.object.userData.fixture);
  });
  state.ready = true;
  setDoorAngle(state.doorAngle);
  setView('perspective');
  renderer.setAnimationLoop(() => {
    if (state.view === 'plan' || document.hidden || !state.ready) return;
    controls.update();
    renderScenes();
  });
}

function resize() {
  const panes = positionPanes();
  if (!renderer) return;
  const { width, height } = panes;
  if (width <= 0 || height <= 0) return;
  renderer.setSize(width, height, false);
  perspectiveCamera.aspect = panes.proposed.width / panes.proposed.height;
  perspectiveCamera.updateProjectionMatrix();
  const aspect = perspectiveCamera.aspect;
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
  $('#view-caption').textContent = state.comparison ? 'LINKED VIEWS / SAME CAMERA AND SCALE' : plan ? 'DIMENSIONED PLAN / INSIDE FACE MEASUREMENTS' : 'PROPOSED OPEN WET ROOM';
  $('#viewer-help').innerHTML = plan
    ? '<strong>Every inch matters.</strong><span>Back wall at top / retained entrance at bottom right</span>'
    : state.comparison
      ? '<strong>Compare at the same scale.</strong><span>Drag either view to rotate both &middot; Scroll to zoom &middot; Click a fixture</span>'
      : '<strong>Make yourself at home.</strong><span>Drag to rotate &middot; Scroll to zoom &middot; Click a fixture</span>';
  $$('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  positionPanes();
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
  if (state.selected) selectItem(state.selected);
  resize();
  renderScenes();
}

function setWalls(value) {
  state.walls = value;
  $('#wall-caption').textContent = value === 'full' ? 'Full height: 144 in / ceiling omitted' : value === 'hidden' ? 'Shell hidden / translucent doors' : 'Cutaway / translucent doors for viewing';
  if (!state.ready) return;
  fullWalls.visible = value === 'full';
  cutawayWalls.visible = value === 'cutaway';
  scene.getObjectByName('shower-accent').visible = value !== 'hidden';
  baseline.walls.full.visible = value === 'full';
  baseline.walls.cutaway.visible = value === 'cutaway';
  for (const pivot of [doorPivot, baseline.doors.toilet, baseline.doors.bathroom]) {
    const leaf = pivot.userData.leaf;
    leaf.material.transparent = value !== 'full';
    leaf.material.opacity = value === 'full' ? 1 : 0.32;
    leaf.material.depthWrite = value === 'full';
    leaf.material.needsUpdate = true;
    leaf.castShadow = value === 'full';
  }
  heightDimension.visible = value === 'full';
  if (state.view === 'perspective') setView('perspective');
}

function toggleDoor() {
  setDoorAngle(state.doorAngle > 0 ? 0 : 90);
}

function setDoorAngle(angle) {
  doorTip(DOORS.bathroom, angle);
  state.doorAngle = angle;
  state.doorOpen = angle > 0;
  $('#door-toggle').textContent = `Door: ${state.doorOpen ? 'open' : 'closed'}`;
  $('#door-toggle').setAttribute('aria-pressed', String(state.doorOpen));
  $('#door-angle').value = String(angle);
  if (doorPivot) doorPivot.rotation.y = angle === 0 ? 0 : -THREE.MathUtils.degToRad(angle);
  updateBaseline();
  updatePaneNotes();
  refreshPlan();
}

function setComparison(enabled) {
  state.comparison = enabled;
  $('#compare-toggle').textContent = enabled ? 'Compare: on' : 'Compare: off';
  $('#compare-toggle').setAttribute('aria-pressed', String(enabled));
  if (baseline.selection) baseline.selection.visible = enabled && Boolean(state.selected?.startsWith('existing-'));
  updatePaneNotes();
  setView(state.view);
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
  $('#door-angle').addEventListener('input', event => setDoorAngle(Number(event.target.value)));
  $('#compare-toggle').addEventListener('click', () => setComparison(!state.comparison));
  $('#basin-placement').addEventListener('change', event => setBasinPlacement(event.target.value));
  $('#existing-layout').addEventListener('change', event => {
    state.baselineVariant = event.target.value;
    evaluateSeparate(state.baselineVariant);
    if (state.baselineVariant === 'current') {
      state.frameChange = false;
      $('#retrofit-frame').checked = false;
    }
    updateBaseline();
    updatePaneNotes();
    refreshPlan();
  });
  $('#retrofit-frame').addEventListener('change', event => {
    state.frameChange = event.target.checked;
    updateBaseline();
    updatePaneNotes();
    refreshPlan();
  });
  $('#show-door-clash').addEventListener('click', () => {
    state.baselineVariant = 'western';
    state.frameChange = false;
    $('#existing-layout').value = 'western';
    $('#retrofit-frame').checked = false;
    setComparison(true);
    setDoorAngle(55);
    setView('top');
    selectTab('layout');
    $('.stage').scrollIntoView({ block: 'start' });
  });
  $('#reset-view').addEventListener('click', () => setView('perspective'));
  for (const [id, key, group] of [['dimensions', 'dimensions', dimensionLines], ['labels', 'labels', labels], ['clearances', 'clearances', clearanceGroup], ['old-wall', 'removed', removedGroup]]) {
    $(`#${id}`).addEventListener('change', event => {
      state[key] = event.target.checked;
      group.visible = state[key];
      if (key === 'labels') baseline.labels.visible = state.labels;
      if (key === 'dimensions') baseline.dimensions.visible = state.dimensions;
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
    new Blob([state.comparison ? comparisonSvg(planOptions()) : planSvg(planOptions())], { type: 'image/svg+xml' }),
    state.comparison ? 'Bathroom-comparison-plan.svg' : 'Bathroom-dimensioned-plan.svg',
  ));
  $('#save-image').addEventListener('click', () => {
    if (!state.ready || state.view === 'plan') {
      showMessage('Choose an available 3D view before saving an image.');
      return;
    }
    renderScenes();
    const image = document.createElement('canvas');
    image.width = renderer.domElement.width;
    image.height = renderer.domElement.height;
    const context = image.getContext('2d');
    if (!context) {
      console.error('Bathroom viewer: image export could not create a drawing context.');
      showMessage('Image export could not start. Use Download plan instead.');
      return;
    }
    context.drawImage(renderer.domElement, 0, 0);
    const panes = getViewports();
    const scale = image.width / panes.width;
    context.scale(scale, scale);
    context.fillStyle = '#263e35';
    context.font = '600 13px "Segoe UI", Arial, sans-serif';
    for (const [pane, title] of [
      [panes.existing, state.baselineVariant === 'current' ? 'A. CURRENT / INDIAN WC + PARTITION' : 'A. KEEP SEPARATE / SEATED WC TEST FIT'],
      [panes.proposed, `B. COMBINED / BASIN ${state.basinPlacement.toUpperCase()}`],
    ]) if (pane) context.fillText(title, pane.left + 8, pane.top - 22, pane.width - 16);
    context.font = '10px "Segoe UI", Arial, sans-serif';
    context.fillText('CONCEPT ONLY / verify actual fixtures, door sweep and site conditions before construction.', 18, panes.height - 20, panes.width - 36);
    image.toBlob(blob => {
      if (!blob) {
        console.error('Bathroom viewer: PNG export returned no image.');
        showMessage('Image export failed. Try another browser or use Download plan.');
        return;
      }
      download(blob, `Bathroom-${state.comparison ? 'comparison-' : ''}${state.view}.png`);
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
        if (baseline.selection) baseline.selection.visible = false;
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
        measurements: { ...ROOM, areaSquareFeet: metrics.areaSquareFeet, existingSquareFeet: metrics.existingSquareFeet, recoveredSquareFeet: metrics.recoveredSquareFeet, wcFrontClearance: metrics.frontClearance, wcSideClearance: metrics.sideClearance },
        camera: activeCamera ? { type: activeCamera.type, position: activeCamera.position.toArray(), zoom: activeCamera.zoom } : null,
        visible: {
          dimensions: dimensionLines.visible, labels: labels.visible, clearances: clearanceGroup.visible,
          removed: removedGroup.visible, fullWalls: Boolean(fullWalls?.visible), cutawayWalls: Boolean(cutawayWalls?.visible),
          existingCurrent: Boolean(baseline.variants.current?.visible), existingWestern: Boolean(baseline.variants.western?.visible),
          insideBasin: Boolean(basinModels.inside?.visible), outsideBasin: Boolean(basinModels.outside?.visible),
          mirror: Boolean(basinMirror?.visible), existingBasin: Boolean(baseline.models.get('existing-basin')?.visible),
          doorClashHighlight: Boolean(baseline.clashBox?.visible),
        },
        doorAngleDegrees: doorPivot ? THREE.MathUtils.radToDeg(doorPivot.rotation.y) : null,
        existingToiletDoorAngleDegrees: baseline.doors.toilet ? THREE.MathUtils.radToDeg(baseline.doors.toilet.rotation.y) : null,
        doorTips: doorPivot && baseline.doors.toilet ? Object.fromEntries([
          ['proposed', doorPivot], ['existingToilet', baseline.doors.toilet], ['existingBath', baseline.doors.bathroom],
        ].map(([id, object]) => {
          const point = object.getObjectByName('door-tip').getWorldPosition(new THREE.Vector3());
          return [id, { x: point.x, d: -point.z }];
        })) : null,
        separate: evaluateSeparate(state.baselineVariant, { frameChange: state.frameChange, angle: state.doorAngle }),
        viewports: getViewports(),
        fixtureScreenPoints: activeCamera && renderer ? Object.fromEntries([...fixtureModels].map(([id, object]) => {
          const point = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).project(activeCamera);
          const pane = getViewports().proposed;
          return [id, { x: pane.left + (point.x + 1) * pane.width / 2, y: pane.top + (1 - point.y) * pane.height / 2 }];
        })) : null,
        existingScreenPoints: activeCamera && renderer && state.comparison ? Object.fromEntries([...baseline.models].map(([id, object]) => {
          const point = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).project(activeCamera);
          const pane = getViewports().existing;
          return [id, { x: pane.left + (point.x + 1) * pane.width / 2, y: pane.top + (1 - point.y) * pane.height / 2 }];
        })) : null,
        checks: metrics.checks.map(check => ({ id: check.id, status: check.status })),
        canvas: renderer ? { width: renderer.domElement.width, height: renderer.domElement.height } : null,
      };
    },
  }),
});
