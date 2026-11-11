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
    x: 39, d: -15, width: 18, depth: 14, bottom: 29, height: 8,
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
});

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
  const sideClearance = Math.min(center, room.width - center);
  const doorSweep = {
    x: room.width - room.doorWidth,
    d: -room.doorWidth,
    width: room.doorWidth,
    depth: room.doorWidth,
  };
  const allInside = Object.values(items).filter(item => !item.outside).every(item => insideRoom(item, room));
  const floorFixtures = Object.values(items).filter(item => item.floorStanding);
  const floorClash = floorFixtures.some((first, index) =>
    floorFixtures.slice(index + 1).some(second => overlaps(first, second)));
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
      title: `WC centre to nearest side wall: ${sideClearance} in`,
      detail: `Compared with a ${PLANNING_TARGETS.wcCenterToSideWall}-inch planning reference. The former dividing wall is removed in this proposal.`,
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
      id: 'door-basin', status: overlaps(doorSweep, items.basin) ? 'caution' : 'pass',
      title: 'Proposed outward door sweep clears the illustrated outside basin',
      detail: 'Checked using a conservative 29 x 29-inch sweep box. Actual corridor space, nearby doors and actual basin dimensions remain unmeasured.',
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
      id: 'external-clearance', status: 'unverified', title: 'Outside door swing and escape/circulation',
      detail: 'The door is proposed to open outward to preserve interior space. External clearance and any effect on the corridor or other users must be checked on site.',
    },
    {
      id: 'ventilation', status: 'unverified', title: 'Ventilation and local approvals',
      detail: 'No window or vent was measured. Confirm suitable ventilation, local requirements and approval for the final room arrangement.',
    },
  ];
  return {
    areaSquareFeet: room.width * room.depth / 144,
    recoveredSquareFeet: room.removedWallWidth * room.depth / 144,
    frontClearance,
    sideClearance,
    rearAllowance: room.depth - wcBounds.back,
    doorSweep,
    checks,
  };
}

export function planSvg({ showRemoved = false, showClearances = true, doorOpen = true } = {}) {
  const sy = d => ROOM.depth - d;
  const wc = ITEMS.toilet;
  const shower = ITEMS.shower;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 138 112" role="img" aria-label="Measured proposed plan, 96 by 48 inches, with left WC and right open shower">
  <title>Combined bathroom: 96 x 48 inches, 144-inch ceiling</title>
  <desc>Concept only. Right 29-inch doorway retained, left doorway infilled. WC front clearance 22 inches. Outward door swing and outside basin dimensions require a site check.</desc>
  <defs>
    <pattern id="tiles" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#eee9de"/><path d="M12 0H0V12" fill="none" stroke="#d6cdbd" stroke-width=".25"/></pattern>
    <marker id="arrow" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto-start-reverse"><path d="M5 0L0 2.5L5 5" fill="none" stroke="#50675f" stroke-width=".7"/></marker>
  </defs>
  <rect x="-20" y="-20" width="138" height="112" fill="#faf8f1"/>
  <g font-family="Arial,sans-serif" fill="#263e35" font-size="3">
    <rect width="96" height="48" fill="url(#tiles)"/>
    <rect x="${shower.x}" y="${sy(shower.d + shower.depth)}" width="${shower.width}" height="${shower.depth}" fill="#b9d1c5" fill-opacity=".72" stroke="#688b7b" stroke-dasharray="1.5 1"/>
    ${showClearances ? '<rect x="2.5" y="26" width="30" height="22" fill="#a2c2d7" fill-opacity=".25" stroke="#7092a8" stroke-dasharray="1 1"/><text x="34" y="38" font-size="2.8">22 in front</text>' : ''}
    ${showRemoved ? '<rect x="35" y="0" width="5.5" height="48" fill="#d78a64" fill-opacity=".25" stroke="#b16741" stroke-dasharray="2 1"/><text x="38" y="-2" text-anchor="middle" fill="#9d593c">Removed 5.5 in wall</text>' : ''}
    <path d="M0 48V0H96V48M0 48H67" fill="none" stroke="#344b41" stroke-width="1.5"/>
    <path d="M0 48H29" stroke="#be9165" stroke-width="1.5"/>
    <g data-item="toilet"><title>WC: 15 x 25 inches, 22-inch front clearance</title>
      <rect x="${wc.x}" y="${sy(wc.d + wc.depth)}" width="${wc.width}" height="5.5" rx="1" fill="#fffdf8" stroke="#727e76" stroke-width=".4"/>
      <ellipse cx="17.5" cy="16" rx="7.5" ry="10" fill="#fffdf8" stroke="#727e76" stroke-width=".4"/>
      <ellipse cx="17.5" cy="16" rx="4.6" ry="6.8" fill="#d5ddda"/>
      <text x="17.5" y="31" text-anchor="middle" font-weight="bold">WC</text>
    </g>
    <text x="78" y="15" text-anchor="middle" font-weight="bold">OPEN SHOWER</text>
    <text x="78" y="20" text-anchor="middle">36 x 36 in</text>
    <rect x="63" y="1" width="30" height="1.5" rx=".5" fill="#5b6860"/>
    <circle cx="89" cy="9" r="5.5" fill="#f3e5c4" stroke="#ac8d52" stroke-width=".4"/>
    <rect x="38" y="0" width="20" height="7" fill="#b7a785" fill-opacity=".65"/>
    <circle cx="47.5" cy="7.5" r="7" fill="#faf9f2" stroke="#9eaa9f" stroke-width=".5" stroke-dasharray="1 1"/>
    <text x="47.5" y="19" text-anchor="middle" font-size="2.6">Geyser above</text>
    <path d="M67 48A29 29 0 0 0 96 77" fill="none" stroke="#a27e4b" stroke-dasharray="1.2 1" stroke-width=".5"/>
    <path data-door-state="${doorOpen ? 'open' : 'closed'}" d="${doorOpen ? 'M96 48V77' : 'M96 48H67'}" stroke="#9f773e" stroke-width="1.3"/>
    <rect x="39" y="49" width="18" height="14" rx="3" fill="#fffdf8" stroke="#8a9990" stroke-width=".5"/>
    <ellipse cx="48" cy="56" rx="6.5" ry="4.5" fill="#d5ddda"/>
    <text x="48" y="68" text-anchor="middle" font-size="2.6">Existing basin OUTSIDE</text>
    <text x="14.5" y="56" text-anchor="middle" fill="#956d3f" font-size="2.5">Old door closed</text>
    <g fill="none" stroke="#50675f" stroke-width=".35">
      <path d="M0 -3V-13M96 -3V-13M0 -10H96" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
      <path d="M-3 0H-13M-3 48H-13M-10 0V48" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
      <path d="M67 81V87M96 81V87M67 84H96" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
    </g>
    <rect x="35" y="-13" width="26" height="5" fill="#faf8f1"/>
    <text x="48" y="-9" text-anchor="middle" font-weight="bold">96 in / 8 ft</text>
    <text x="-13" y="24" text-anchor="middle" transform="rotate(-90 -13 24)" font-weight="bold">48 in / 4 ft</text>
    <rect x="71" y="81" width="21" height="5" fill="#faf8f1"/>
    <text x="81.5" y="85" text-anchor="middle">29 in entry</text>
    <text x="0" y="89" font-size="2.5">CONCEPT ONLY - verify structure, drainage, electrics and actual fixture sizes on site.</text>
  </g></svg>`;
}
