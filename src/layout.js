export const ROOM = Object.freeze({
  width: 96,
  depth: 48,
  height: 144,
  originalToiletWidth: 35,
  originalBathWidth: 55.5,
  removedWallWidth: 5.5,
  doorWidth: 29,
  doorHeight: 80,
  wallThickness: 4,
});

export const ITEMS = Object.freeze({
  toilet: {
    name: 'Compact Western WC',
    category: 'Proposed / manufacturer selection required',
    x: 10, d: 22, width: 15, depth: 25, height: 32.5,
    seatHeight: 17.5,
    floorStanding: true,
    description: 'Left-side floor-mounted WC. The complete installed projection must be no more than 25 inches, with the illustrated 1-inch rear allowance. A longer model reduces the already-tight front clearance.',
  },
  shower: {
    name: 'Open shower',
    category: 'Proposed / shared wet room',
    x: 60, d: 12, width: 36, depth: 36, height: 82,
    planningArea: true,
    description: '36 x 36-inch shower planning area at the back right. No glass enclosure or shower door: the right entrance shares the wet-room floor. Water containment must be designed on site.',
  },
  bucket: {
    name: 'Bucket + low taps',
    category: 'Movable / shared shower space',
    x: 83.5, d: 33.5, width: 11, depth: 11, height: 17,
    floorStanding: true,
    movable: true,
    description: 'An illustrative 11-inch-diameter bucket below low taps. Store here, but move it out of the standing area when showering. This is not additional clear shower space.',
  },
  heater: {
    name: 'Storage geyser',
    category: 'Illustrative / electrical review required',
    x: 40.5, d: 33.5, width: 14, depth: 14, bottom: 83, height: 22,
    description: 'Illustrative 14-inch-diameter, 22-inch-high water heater, high on the rear wall and left of the shower footprint. Capacity, mounting, service access, electrical zones, earthing and protected supply are NOT certified by this model.',
  },
  shelf: {
    name: 'Wall shelf',
    category: 'Proposed / size assumed',
    x: 38, d: 41, width: 20, depth: 7, bottom: 48, height: 12,
    description: 'A shallow wall-mounted toiletries shelf between the WC and shower. Its lower shelf is 48 inches above the floor; there is no floor cabinet taking up circulation space.',
  },
  basin: {
    name: 'Existing outside washbasin',
    category: 'Existing / position confirmed, size assumed',
    x: 39, d: -18, width: 18, depth: 14, bottom: 29, height: 9,
    outside: true,
    description: 'Remains outside, midway between the original two doorways. The 18 x 14-inch basin shown is a context model only: its actual size and outside circulation were not measured.',
  },
  drain: {
    name: 'Proposed shower drain',
    category: 'Proposed / plumbing survey required',
    x: 63, d: 45.5, width: 30, depth: 1.5, height: 0.3,
    description: 'Illustrative rear linear drain. Existing drain and waste-pipe positions are unknown. Floor falls, trap, pipe route, waterproofing and threshold levels must be designed by the installer.',
  },
});

export const PLANNING_TARGETS = Object.freeze({
  wcFront: 21,
  wcCenterToSideWall: 15,
  showerSide: 30,
  preferredDoor: 32,
  basinFront: 21,
  basinApproachWidth: 24,
});

export const DOORS = Object.freeze({
  toilet: { x: 0, width: 29, hinge: 'left', direction: 'inward', bottom: 1, top: 80 },
  bathroom: { x: 67, width: 29, hinge: 'right', direction: 'inward', bottom: 1, top: 80 },
});

export const INSIDE_BASIN = Object.freeze({
  name: 'Compact inside handbasin',
  category: 'Optional / assumed compact product, not the measured existing basin',
  x: 34.5, d: 36, width: 18, depth: 12, bottom: 29, height: 9,
  description: 'Optional 18 x 12-inch wall-hung handbasin on the BACK wall, between the WC and shower. Its assumed 24 x 21-inch approach area stays clear of the WC and shower planning footprint. The shelf moves above the WC and a small mirror is added. Existing basin dimensions are unknown: this does not prove that the existing basin can be reused here.',
});

export const EXISTING_PAN = Object.freeze({
  name: 'Current Indian / squat pan',
  category: 'Existing / pan size and height illustrative',
  x: 7.5, d: 22, width: 20, depth: 24, height: 0.5,
  description: 'Floor-level squat pan and rear cistern, reconstructed from the photographs. Only room sizes and door directions/hinges are confirmed; pan dimensions and installation levels are illustrative. A door can pass above a low pan but collide with a raised seated WC.',
});

export function itemsForBasin(placement = 'outside') {
  if (!['outside', 'inside'].includes(placement)) throw new RangeError('Unknown basin placement.');
  return placement === 'outside' ? ITEMS : {
    ...ITEMS,
    basin: INSIDE_BASIN,
    shelf: {
      ...ITEMS.shelf, x: 4,
      description: 'The 20 x 7-inch shelf moves to the rear wall above the WC, leaving room for the optional basin and mirror. Its mounting and actual head/service clearances still need checking on site.',
    },
  };
}

function validateDoor(door, angle = 90) {
  if (!Number.isFinite(door.x) || !Number.isFinite(door.width) || door.width <= 0
    || !Number.isFinite(door.bottom) || !Number.isFinite(door.top) || door.bottom < 0 || door.top <= door.bottom) {
    throw new RangeError('Invalid door dimensions.');
  }
  if (!['left', 'right'].includes(door.hinge) || !['inward', 'outward'].includes(door.direction)) {
    throw new RangeError('Unknown door hinge or swing direction.');
  }
  if (!Number.isFinite(angle) || angle < 0 || angle > 90) throw new RangeError('Door angle must be between 0 and 90 degrees.');
}

export function doorTip(door, angle = 90) {
  validateDoor(door, angle);
  const radians = angle * Math.PI / 180;
  const hinge = door.x + (door.hinge === 'right' ? door.width : 0);
  return {
    x: hinge + (door.hinge === 'right' ? -1 : 1) * door.width * Math.cos(radians),
    d: (door.direction === 'inward' ? 1 : -1) * door.width * Math.sin(radians),
  };
}

function itemAtDoorHeight(door, item) {
  if (!Number.isFinite(item.height) || item.height <= 0) throw new RangeError('Fixture height must be positive.');
  const bottom = item.bottom ?? 0;
  if (!Number.isFinite(bottom)) throw new RangeError('Invalid fixture mounting height.');
  return bottom < door.top && bottom + item.height > door.bottom;
}

export function doorSweepIntersects(door, item, { ignoreHeight = false } = {}) {
  validateDoor(door);
  const bounds = rectangle(item);
  if (!ignoreHeight && !itemAtDoorHeight(door, item)) return false;
  const hinge = door.x + (door.hinge === 'right' ? door.width : 0);
  const left = Math.max(bounds.left - 0.6, door.hinge === 'right' ? hinge - door.width : hinge);
  const right = Math.min(bounds.right + 0.6, door.hinge === 'right' ? hinge : hinge + door.width);
  const front = Math.max(bounds.front - 0.6, door.direction === 'inward' ? 0 : -door.width);
  const back = Math.min(bounds.back + 0.6, door.direction === 'inward' ? door.width : 0);
  if (left > right || front > back) return false;
  const nearestX = Math.max(left, Math.min(hinge, right));
  const nearestD = Math.max(front, Math.min(0, back));
  return (nearestX - hinge) ** 2 + nearestD ** 2 <= (door.width + 0.6) ** 2;
}

export function doorAtAngleIntersects(door, item, angle) {
  validateDoor(door, angle);
  const bounds = rectangle(item);
  if (!itemAtDoorHeight(door, item)) return false;
  const hinge = door.x + (door.hinge === 'right' ? door.width : 0);
  const tip = doorTip(door, angle);
  let low = 0, high = 1;
  for (const [start, delta, minimum, maximum] of [
    [hinge, tip.x - hinge, bounds.left - 0.6, bounds.right + 0.6],
    [0, tip.d, bounds.front - 0.6, bounds.back + 0.6],
  ]) {
    if (Math.abs(delta) < 1e-10) {
      if (start < minimum || start > maximum) return false;
    } else {
      const a = (minimum - start) / delta, b = (maximum - start) / delta;
      low = Math.max(low, Math.min(a, b));
      high = Math.min(high, Math.max(a, b));
      if (low > high) return false;
    }
  }
  return true;
}

export function basinApproach(basin) {
  return {
    x: basin.x + basin.width / 2 - PLANNING_TARGETS.basinApproachWidth / 2,
    d: basin.d - PLANNING_TARGETS.basinFront,
    width: PLANNING_TARGETS.basinApproachWidth,
    depth: PLANNING_TARGETS.basinFront,
  };
}

export function evaluateSeparate(variant = 'current', { frameChange = false, angle = 90 } = {}) {
  if (!['current', 'western'].includes(variant)) throw new RangeError('Unknown separate-room variant.');
  const toiletDoor = {
    ...DOORS.toilet,
    direction: variant === 'western' && frameChange ? 'outward' : 'inward',
  };
  const pan = variant === 'western' ? ITEMS.toilet : EXISTING_PAN;
  return {
    variant,
    toiletDoor,
    floorSquareFeet: (ROOM.originalToiletWidth + ROOM.originalBathWidth) * ROOM.depth / 144,
    toiletSquareFeet: ROOM.originalToiletWidth * ROOM.depth / 144,
    bathSquareFeet: ROOM.originalBathWidth * ROOM.depth / 144,
    fullSweepConflict: doorSweepIntersects(toiletDoor, pan),
    currentAngleConflict: doorAtAngleIntersects(toiletDoor, pan, angle),
    frameChangeRequired: variant === 'western' && frameChange,
    wcFrontClearance: variant === 'western' ? ITEMS.toilet.d : null,
    wcSideClearance: variant === 'western' ? 17.5 : null,
  };
}

export function rectangle(item) {
  for (const key of ['x', 'd', 'width', 'depth']) {
    if (!Number.isFinite(item[key])) throw new TypeError(`Invalid ${key} in layout rectangle.`);
  }
  if (item.width <= 0 || item.depth <= 0) throw new RangeError('Rectangle dimensions must be positive.');
  return { left: item.x, right: item.x + item.width, front: item.d, back: item.d + item.depth };
}

export function overlaps(a, b) {
  const first = rectangle(a);
  const second = rectangle(b);
  return first.left < second.right && first.right > second.left
    && first.front < second.back && first.back > second.front;
}

export function insideRoom(item, room = ROOM) {
  const bounds = rectangle(item);
  return bounds.left >= 0 && bounds.right <= room.width
    && bounds.front >= 0 && bounds.back <= room.depth;
}

export function evaluateLayout(room = ROOM, items = ITEMS) {
  for (const key of ['width', 'depth', 'height', 'doorWidth']) {
    if (!Number.isFinite(room[key]) || room[key] <= 0) throw new RangeError(`Room ${key} must be positive.`);
  }
  if (room.doorWidth > room.width) throw new RangeError('Door opening exceeds room width.');
  const wc = items.toilet;
  const wcBounds = rectangle(wc);
  const center = wc.x + wc.width / 2;
  const frontClearance = wcBounds.front;
  const basinBounds = rectangle(items.basin);
  const adjacentBasin = !items.basin.outside && basinBounds.front < wcBounds.back && basinBounds.back > wcBounds.front;
  const sideClearance = Math.min(center, room.width - center, adjacentBasin ? Math.max(0, basinBounds.left - center) : Infinity);
  const retainedDoor = { ...DOORS.bathroom, x: room.width - room.doorWidth, width: room.doorWidth, top: room.doorHeight };
  const doorSweep = {
    x: room.width - room.doorWidth,
    d: 0,
    width: room.doorWidth,
    depth: room.doorWidth,
  };
  const allInside = Object.values(items).filter(item => !item.outside).every(item => insideRoom(item, room));
  const floorFixtures = Object.values(items).filter(item => item.floorStanding);
  const floorClash = floorFixtures.some((first, index) =>
    floorFixtures.slice(index + 1).some(second => overlaps(first, second)));
  const doorClash = Object.values(items).filter(item => !item.planningArea).some(item => doorSweepIntersects(retainedDoor, item));
  const checks = [
    {
      id: 'bounds', status: allInside ? 'pass' : 'caution', title: 'Fixture footprints fit inside the measured room',
      detail: 'All proposed indoor footprints are checked against the 96 x 48-inch clear rectangle. Elevated fixtures are also checked in plan.',
    },
    {
      id: 'floor-clash', status: floorClash ? 'caution' : 'pass', title: 'No overlap between floor-standing fixtures',
      detail: 'The WC and stored bucket do not overlap. The bucket intentionally occupies part of the shared shower area.',
    },
    {
      id: 'wc-front', status: frontClearance >= PLANNING_TARGETS.wcFront ? 'pass' : 'caution',
      title: `WC front clearance: ${frontClearance} in`,
      detail: `Compared with a ${PLANNING_TARGETS.wcFront}-inch planning reference, not a local-code certification. Only 1 inch of spare clearance; select the actual WC before construction.`,
    },
    {
      id: 'wc-side', status: sideClearance >= PLANNING_TARGETS.wcCenterToSideWall ? 'pass' : 'caution',
      title: `WC centre to nearest side wall / basin edge: ${sideClearance} in`,
      detail: `Compared with a ${PLANNING_TARGETS.wcCenterToSideWall}-inch planning reference. The optional basin is treated as a side obstruction; its position must be checked against the actual WC.`,
    },
    {
      id: 'shower-size',
      status: Math.min(items.shower.width, items.shower.depth) >= PLANNING_TARGETS.showerSide ? 'pass' : 'caution',
      title: `Shower planning area: ${items.shower.width} x ${items.shower.depth} in`,
      detail: `Compared with a ${PLANNING_TARGETS.showerSide}-inch minimum-side planning reference. The bucket must be moved when this full area is used.`,
    },
    {
      id: 'wc-shower', status: overlaps(wc, items.shower) ? 'caution' : 'pass',
      title: 'WC and shower planning footprints are separate',
      detail: 'This is geometric separation only. Without a shower screen, spray can still reach the WC and entrance.',
    },
    {
      id: 'door-basin', status: doorClash ? 'caution' : 'pass',
      title: 'Retained inward door clears the fixed fixture envelopes',
      detail: 'Right hinge and inward swing are confirmed. The full quarter-circle sweep, assumed leaf thickness and fixture heights are checked, not just the fully open position. Exact product shapes and jamb offsets still need a site check.',
    },
    {
      id: 'door-shower', status: doorSweepIntersects(retainedDoor, items.shower, { ignoreHeight: true }) ? 'caution' : 'pass',
      title: 'Inward door uses part of the shower standing area while open',
      detail: 'This is shared-use floor space, not a clash with the shower fittings. Close the door for bathing. There is no separate dry entrance corridor.',
    },
    {
      id: 'door-width', status: room.doorWidth >= PLANNING_TARGETS.preferredDoor ? 'pass' : 'caution',
      title: `Existing entrance retained at ${room.doorWidth} in`,
      detail: 'Narrower than the 32-inch planning preference. A nominal doorway measurement is not a verified clear opening. This is not an accessible-bathroom design.',
    },
    {
      id: 'wet-entry', status: 'caution', title: 'Entrance shares the wet-room floor',
      detail: 'There is no separate dry corridor in this 4-foot-deep room. Use an appropriate slip-resistant finish; threshold and water containment need site design.',
    },
    {
      id: 'bucket', status: 'caution', title: 'Bucket and shower are shared-use, not simultaneous clear space',
      detail: 'The bucket is movable. Keeping it inside the standing area reduces usable shower space.',
    },
    {
      id: 'structure', status: 'unverified', title: 'Dividing-wall removal and door infill',
      detail: 'An on-site qualified professional must confirm wall function, support, hidden services and the proposed opening/infill work. Photos cannot establish demolition safety.',
    },
    {
      id: 'plumbing', status: 'unverified', title: 'Toilet outlet, traps and drain routes',
      detail: 'A seated WC may need a different outlet and rough-in from the squat pan. Installer must survey waste pipes and levels before approving placement.',
    },
    {
      id: 'waterproofing', status: 'unverified', title: 'Floor falls, waterproofing and wet-room threshold',
      detail: 'The rendered floor is flat for visualization. Drainage gradients, waterproofing continuity and flood testing are not represented or verified.',
    },
    {
      id: 'electrical', status: 'unverified', title: 'Geyser safety and service access',
      detail: 'A qualified installer/electrician must verify the model, mounting, electrical zones, protected supply, earthing and maintenance access. No electrical compliance is claimed.',
    },
    {
      id: 'external-clearance', status: 'unverified', title: 'Door frames, actual clear opening and any door alteration',
      detail: 'Both existing doors open inward. Changing hinge sides does not reverse an inward-only frame (chokhat). An outward or sliding retrofit would need separate frame/corridor/parking-space checks; the outside basin may obstruct a slider.',
    },
    {
      id: 'ventilation', status: 'unverified', title: 'Ventilation and local approvals',
      detail: 'No window or vent was measured. Confirm suitable ventilation, local requirements and approval for the final room arrangement.',
    },
  ];
  if (!items.basin.outside) {
    const approach = basinApproach(items.basin);
    const approachFits = insideRoom(approach, room) && !overlaps(approach, wc)
      && !overlaps(approach, items.shower) && !overlaps(items.basin, wc) && !overlaps(items.basin, items.shower);
    checks.splice(7, 0,
      {
        id: 'basin-approach', status: approachFits ? 'pass' : 'caution',
        title: `Inside basin: ${items.basin.width} x ${items.basin.depth} in, with a 24 x 21-in approach`,
        detail: 'A shallow back-wall handbasin fits the assumed envelopes without reducing the 22-inch WC front clearance. Approach space is shared circulation, not a second-person occupancy claim or local-code approval.',
      },
      {
        id: 'basin-product', status: 'unverified', title: 'Existing basin size and reuse are not established',
        detail: 'The existing basin was not measured. The inside option is a compact illustrative product, not proof that the existing basin fits. Confirm its actual width/projection, outlet, taps, mirror, shelf and geyser service/electrical clearances.',
      });
  }
  return {
    areaSquareFeet: room.width * room.depth / 144,
    recoveredSquareFeet: room.removedWallWidth * room.depth / 144,
    existingSquareFeet: (room.originalToiletWidth + room.originalBathWidth) * room.depth / 144,
    frontClearance,
    sideClearance,
    rearAllowance: room.depth - wcBounds.back,
    doorSweep,
    checks,
  };
}

const svgNumber = value => Math.round(value * 1000) / 1000;

function svgDoor(door, angle, key, conflict = false) {
  const tip = doorTip(door, angle);
  const closed = doorTip(door, 0), opened = doorTip(door, 90);
  const hinge = door.x + (door.hinge === 'right' ? door.width : 0);
  const sweep = (door.hinge === 'left') === (door.direction === 'outward') ? 1 : 0;
  const color = conflict ? '#bc533c' : '#9f773e';
  return `<path d="M${svgNumber(closed.x)} 48A${door.width} ${door.width} 0 0 ${sweep} ${svgNumber(opened.x)} ${svgNumber(48 - opened.d)}" fill="none" stroke="${color}" stroke-dasharray="1.2 1" stroke-width=".5"/>
    <path data-door-key="${key}" data-door-state="${angle > 0 ? 'open' : 'closed'}" data-door-direction="${door.direction}" data-door-hinge="${door.hinge}" data-door-angle="${angle}" d="M${hinge} 48L${svgNumber(tip.x)} ${svgNumber(48 - tip.d)}" stroke="${color}" stroke-width="1.2"/>`;
}

function svgWc() {
  return `<g data-item="toilet"><title>Compact seated WC: 15 x 25 inches; 22-inch front clearance</title>
    <rect x="10" y="1" width="15" height="5.5" rx="1" fill="#fffdf8" stroke="#727e76" stroke-width=".4"/>
    <ellipse cx="17.5" cy="16" rx="7.4" ry="10" fill="#fffdf8" stroke="#727e76" stroke-width=".4"/>
    <ellipse cx="17.5" cy="16" rx="4.6" ry="6.8" fill="#d5ddda"/>
    <text x="17.5" y="31" text-anchor="middle" font-weight="bold">SEATED WC</text></g>`;
}

function svgBasin(basin) {
  const x = basin.x + basin.width / 2, y = 48 - basin.d - basin.depth / 2;
  return `<g data-basin-location="${basin.outside ? 'outside' : 'inside'}">
    <rect x="${basin.x}" y="${48 - basin.d - basin.depth}" width="${basin.width}" height="${basin.depth}" rx="2" fill="#fffdf8" stroke="#8a9990" stroke-width=".5"/>
    <ellipse cx="${x}" cy="${y}" rx="${basin.width * 0.35}" ry="${basin.depth * 0.3}" fill="#d5ddda"/>
    <text x="${x}" y="${basin.outside ? 71 : 18}" text-anchor="middle" font-size="2.6">${basin.outside ? 'Existing basin OUTSIDE' : '18 x 12 in basin INSIDE'}</text>
    ${basin.outside ? '' : '<text x="43.5" y="23" text-anchor="middle" font-size="2.4">Mirror / geyser above</text>'}
  </g>`;
}

function svgDimensions(prefix) {
  return `<g fill="none" stroke="#50675f" stroke-width=".35">
    <path d="M0 -3V-13M96 -3V-13M-3 0H-13M-3 48H-13M67 81V87M96 81V87"/>
    <path d="M0 -10H96" marker-start="url(#${prefix}-arrow)" marker-end="url(#${prefix}-arrow)"/>
    <path d="M-10 0V48" marker-start="url(#${prefix}-arrow)" marker-end="url(#${prefix}-arrow)"/>
    <path d="M67 84H96" marker-start="url(#${prefix}-arrow)" marker-end="url(#${prefix}-arrow)"/>
    </g><rect x="35" y="-13" width="26" height="5" fill="#faf8f1"/>
    <text x="48" y="-9" text-anchor="middle" font-weight="bold">96 in / 8 ft</text>
    <text x="-13" y="24" text-anchor="middle" transform="rotate(-90 -13 24)" font-weight="bold">48 in / 4 ft</text>
    <rect x="71" y="81" width="21" height="5" fill="#faf8f1"/>
    <text x="81.5" y="85" text-anchor="middle">29 in entry</text>`;
}

function svgFrame(content, prefix, title, description) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 138 112" role="img" aria-label="${title}">
    <title>${title}</title><desc>${description}</desc>
    <defs><pattern id="${prefix}-tiles" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#eee9de"/><path d="M12 0H0V12" fill="none" stroke="#d6cdbd" stroke-width=".25"/></pattern>
    <marker id="${prefix}-arrow" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto-start-reverse"><path d="M5 0L0 2.5L5 5" fill="none" stroke="#50675f" stroke-width=".7"/></marker></defs>
    <rect x="-20" y="-20" width="138" height="112" fill="#faf8f1"/>
    <g font-family="Arial,sans-serif" fill="#263e35" font-size="3">
    <rect width="96" height="48" fill="url(#${prefix}-tiles)"/>
    ${content}${svgDimensions(prefix)}
    <text x="0" y="89" font-size="2.5">CONCEPT ONLY - verify structure, drainage, electrics and actual fixture sizes on site.</text>
    </g></svg>`;
}

export function planSvg({
  showRemoved = false, showClearances = true, doorOpen = true,
  doorAngle = doorOpen ? 90 : 0, basinPlacement = 'outside',
  scenario = 'combined', frameChange = false,
} = {}) {
  if (scenario !== 'combined') {
    const separate = evaluateSeparate(scenario, { frameChange, angle: doorAngle });
    const warning = separate.fullSweepConflict
      ? 'FULL SWEEP overlaps WC: not a drop-in replacement.'
      : separate.frameChangeRequired ? 'Outward option needs frame rework + outside checks.' : 'Current fixture sizes illustrative; both doors open inward.';
    const pan = scenario === 'western' ? svgWc() : `<g data-item="squat-pan">
      <rect x="7.5" y="2" width="20" height="24" rx="1" fill="#fffdf8" stroke="#8b958a" stroke-width=".4"/>
      <ellipse cx="17.5" cy="14" rx="3.1" ry="7" fill="#8f9e94"/>
      <rect x="9" y="6" width="4" height="16" fill="#dbe0d5"/><rect x="22" y="6" width="4" height="16" fill="#dbe0d5"/>
      <rect x="8.5" y="0" width="18" height="5" fill="none" stroke="#8b958a" stroke-dasharray="1 1"/>
      <text x="17.5" y="31" text-anchor="middle" font-weight="bold">INDIAN WC</text></g>`;
    const content = `<rect data-partition="retained" x="35" y="0" width="5.5" height="48" fill="#b6ae9b" stroke="#6b7364" stroke-width=".4"/>
      <path d="M0 48V0H96V48M29 48H67" fill="none" stroke="#344b41" stroke-width="1.5"/>
      ${showClearances && scenario === 'western' ? '<rect x="2.5" y="26" width="30" height="22" fill="#a2c2d7" fill-opacity=".22" stroke="#7092a8" stroke-dasharray="1 1"/><text x="17.5" y="40" text-anchor="middle">22 in front</text>' : ''}
      ${pan}<circle cx="55" cy="33" r="5.5" fill="#f3e5c4" stroke="#ac8d52" stroke-width=".4"/>
      <path d="M65.5 1V4M71 1V4" stroke="#8f773d" stroke-width="1"/>
      <text x="68" y="19" text-anchor="middle" font-weight="bold">BATH ROOM</text>
      <text x="17.5" y="-2" text-anchor="middle">35 in clear</text><text x="68.25" y="-2" text-anchor="middle">55.5 in clear</text>
      ${svgBasin(ITEMS.basin)}
      ${svgDoor(separate.toiletDoor, doorAngle, 'toilet', separate.fullSweepConflict)}
      ${svgDoor(DOORS.bathroom, doorAngle, 'bathroom')}
      <text x="0" y="77" font-size="2.5" fill="${separate.fullSweepConflict ? '#ad4837' : '#6d7f68'}">${warning}</text>`;
    return svgFrame(content, `separate-${scenario}`, scenario === 'western' ? 'Separate rooms with a compact Western WC: test fit' : 'Current separate toilet and bathroom: measured room reconstruction',
      '35-inch toilet and 55.5-inch bath with a 5.5-inch dividing wall. Fixture sizes assumed. Full door sweep must be checked, not only the fully open position.');
  }
  const items = itemsForBasin(basinPlacement);
  const approach = basinApproach(items.basin);
  const content = `<rect x="60" y="0" width="36" height="36" fill="#b9d1c5" fill-opacity=".72" stroke="#688b7b" stroke-dasharray="1.5 1"/>
    ${showClearances ? '<rect x="2.5" y="26" width="30" height="22" fill="#a2c2d7" fill-opacity=".25" stroke="#7092a8" stroke-dasharray="1 1"/><text x="34" y="38" font-size="2.8">22 in front</text>' : ''}
    ${showClearances && basinPlacement === 'inside' ? `<rect x="${approach.x}" y="${48 - approach.d - approach.depth}" width="24" height="21" fill="#c3d7e2" fill-opacity=".32" stroke="#7092a8" stroke-dasharray="1 1"/><text x="43.5" y="30" text-anchor="middle" font-size="2.5">24 x 21 in approach</text>` : ''}
    ${showRemoved ? '<rect x="35" y="0" width="5.5" height="48" fill="#d78a64" fill-opacity=".25" stroke="#b16741" stroke-dasharray="2 1"/><text x="38" y="-2" text-anchor="middle" fill="#9d593c">Removed 5.5 in wall</text>' : ''}
    <path d="M0 48V0H96V48M0 48H67" fill="none" stroke="#344b41" stroke-width="1.5"/>
    <path d="M0 48H29" stroke="#be9165" stroke-width="1.5"/>
    ${svgWc()}<text x="78" y="15" text-anchor="middle" font-weight="bold">OPEN SHOWER</text>
    <text x="78" y="20" text-anchor="middle">36 x 36 in</text>
    <rect x="63" y="1" width="30" height="1.5" rx=".5" fill="#5b6860"/>
    <circle cx="89" cy="9" r="5.5" fill="#f3e5c4" stroke="#ac8d52" stroke-width=".4"/>
    <rect x="${items.shelf.x}" y="0" width="20" height="7" fill="#b7a785" fill-opacity=".35" stroke="#9b8e70" stroke-dasharray="1 1"/>
    ${basinPlacement === 'outside' ? '<circle cx="47.5" cy="7.5" r="7" fill="#faf9f2" stroke="#9eaa9f" stroke-width=".5" stroke-dasharray="1 1"/><text x="47.5" y="19" text-anchor="middle" font-size="2.6">Geyser above</text>' : ''}
    ${svgBasin(items.basin)}${svgDoor(DOORS.bathroom, doorAngle, 'bathroom')}
    <text x="14.5" y="56" text-anchor="middle" fill="#956d3f" font-size="2.5">Old door closed</text>
    <text x="0" y="77" font-size="2.5">Right door retained inward. Basin ${basinPlacement}; actual basin size unmeasured.</text>`;
  return svgFrame(content, `combined-${basinPlacement}`, `Combined bathroom, basin ${basinPlacement}: 96 x 48 inches`,
    'Right-hinged 29-inch door retained opening inward. Compact WC has 22-inch front clearance. Optional inside basin is an assumed 18 x 12-inch product, not a measured existing fixture.');
}

export function comparisonSvg(options = {}) {
  const left = planSvg({ ...options, scenario: options.variant ?? 'current' });
  const right = planSvg({ ...options, scenario: 'combined' });
  const place = (svg, x) => svg.replace('<svg ', `<svg x="${x}" y="14" width="138" height="112" `);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 288 133" role="img" aria-label="Current or separate-Western rooms beside the combined bathroom">
    <title>Bathroom options at the same scale</title><rect width="288" height="133" fill="#faf8f1"/>
    <g font-family="Arial,sans-serif" fill="#263e35" font-size="4" font-weight="bold">
    <text x="8" y="9">A. ${options.variant === 'western' ? 'Keep separate + seated WC' : 'Current separate rooms'}</text>
    <text x="158" y="9">B. Combined / basin ${options.basinPlacement ?? 'outside'}</text></g>
    ${place(left, 0)}${place(right, 150)}
    <text x="8" y="131" font-family="Arial,sans-serif" font-size="3" fill="#566d5c">Same overall footprint. Existing clear floor 30.17 sq ft; combined 32 sq ft. Gain: 1.83 sq ft, not a doubled room.</text></svg>`;
}
