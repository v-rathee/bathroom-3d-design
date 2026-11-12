# Bathroom comparison verification

Date: 2026-11-11

**Model: 30 layout tests passed. Viewer: all 19 browser tests passed.**

These are checks of the digital model and application, not permission to build.
Demolition, local-code/accessibility compliance, plumbing, waterproofing and
electrical installation still require qualified on-site verification.

## 1. Corrections and confirmed inputs

The owner clarified that both existing doors open **inward**. Viewed from outside,
the toilet door is left-hinged and the bathroom door right-hinged. The frames
(chokhat) are inward-only: changing hinge sides does not reverse their swing.

The former outward-opening combined entry is superseded. Current and combined
views now retain the right inward bathroom door. Only the labelled separate-WC
frame-alteration exploration can show an outward toilet door.

Room dimensions remain 96 x 48 inches overall, with a 144-inch ceiling, 35-inch
clear toilet bay, 55.5-inch clear bath bay, inferred 5.5-inch partition and two
29-inch nominal doorways.

The current reconstruction's pan/cistern dimensions and levels, bucket/tap
placement, outer wall thickness, door height/leaf thickness/bottom gap and jamb
offsets are illustrative, not surveyed as-built geometry.

## 2. Dimensions and actual rendered geometry

| Check | Result |
|---|---|
| Current clear toilet floor | 35 x 48 in / 11.67 sq ft |
| Current clear bath floor | 55.5 x 48 in / 18.5 sq ft |
| Total existing clear floor | 30.17 sq ft |
| Combined clear floor | 32 sq ft |
| Area recovered | 1.83 sq ft, about 6.1% of existing clear floor |
| Rendered proposed floor | 96 x 48 in |
| Rendered retained divider | x = 35; 5.5 in thick; 48 in deep |
| Rendered compact WC | 15 W x 25 D x 32.5 H in |
| WC front and back | 22 / 47 in from front inside face |
| WC front / rear allowance | 22 / 1 in |
| WC centre to left wall | 17.5 in |
| Inside basin option | 18 W x 12 D in; left x = 34.5; front d = 36; back d = 48 |
| WC centre to inside basin edge | 17 in |
| Basin approach rectangle | 24 W x 21 D in, x = 31.5; d = 15 |
| Shelf with inside basin | Moved left, x = 4 to 24 in, bottom = 48 in |
| Seated WC in separate bay | Same 15 x 25 in envelope and 22 in front clearance |

Critical checks use actual Three.js bounding boxes, not only input constants.
The viewer raises a visible error if floor, WC, basin, shelf or partition
geometry no longer matches the checked plan.

## 3. Full door-sweep analysis

The model checks a 29-inch quarter-circle sweep against fixture envelopes, with
an illustrative 1.2-inch door thickness allowance and overlapping fixture/leaf
heights. It also checks the door leaf at the selected 0-90 degree angle.
This avoids declaring a clash simply because an object is in a rectangular
sweep bounding box, and avoids treating a floor-level pan or overhead heater as
a raised object intersecting the leaf.

- **Current squat pan:** below the assumed 1-inch door bottom gap; its exact level
  must be measured. A low pan and a raised WC do not have equivalent door clearance.
- **Separate seated WC:** full inward sweep overlaps the selected WC planning
  envelope. A 55-degree view highlights the conflict. Zero and 90 degrees can
  both look clear without proving the path between them is clear.
- **Combined right door:** retains right hinge and inward movement; it clears
  the WC, compact basin and stored bucket envelopes, but shares part of the
  shower standing area while open. Close it for bathing.
- **Outward toilet exploration:** only an explicitly labelled frame/door
  alteration proposal. Outside space, other users and nearby basin are not surveyed.
  A slider would need its own unobstructed parking run.

The sweep test is an envelope screen, not manufacturer-specific solid-body
collision certification. A suitable different WC or altered door/frame solution
may work. The model does not conclude that every Western WC is impossible.

## 4. Layout test suite: 30 passed

Run: `npm.cmd test`

Coverage includes:

- Confirmed dimensions, original widths, unit conversion and actual area gain.
- Indoor bounds, fixture overlaps, WC front/side and shower planning targets.
- Detection of longer-WC clearance failures, too-close side positions and floor clashes.
- Correct inward hinges, full sweep and intermediate-angle conflicts.
- No false collision from a rectangular bounding-box corner or non-overlapping heights.
- A frame-change proposal cannot silently alter the existing baseline.
- Inside-basin placement, shared approach space, retained WC clearances and relocated shelf.
- Oversized/deeper basin failures and unverified existing-basin reuse.
- Current, separate-Western, combined and inside-basin plan alternatives.
- Two equal-sized comparison SVGs with distinct marker IDs and honest area labels.
- Explicit invalid-input errors, rather than success-shaped defaults.
- Structural, drainage, waterproofing, electrical and other site checks remain unverified.

## 5. Browser suite: 19 passed

Run: `npm.cmd run test:browser`

Environment: isolated headless Microsoft Edge / Chromium on Windows.

1. Offline standalone renders both scenes with HTTP/HTTPS requests blocked, no
   application errors, no script leakage and the bundled license preserved.
2. Pages root entry loads relative CSS/JS and embedded icon with correct geometry.
3. Seven proposed fixture inspectors work.
4. Wall modes, measurements, labels, approach overlays, partition trace and finishes work.
5. Retained door opens inward and all camera/plan presets work.
6. Real raycasting, wheel zoom, orbit and right-drag pan affect the actual camera.
7. Combined checks distinguish geometry passes, cautions and site limitations.
8. Dimensioned SVG parses and reflects optional overlays.
9. PNG and SVG exports download nonempty files with correct signatures and selected scope.
10. Keyboard shortcuts work without hijacking focused form controls.
11. Desktop, tablet and phone layouts fit without horizontal overflow. Existing
    and combined pane dimensions are equal, side by side or stacked.
12. WebGL failure is explicit; both plan views remain available.
13. Current reconstruction, inward hinge directions and actual partition geometry match.
14. Separate-WC full sweep, 55-degree conflict highlight and labelled outward
    frame-alteration exploration update correctly.
15. Inside basin updates real geometry, mirror, shelf, inspector, checks and plan;
    the current-room outside basin stays unchanged.
16. Both displayed plan SVGs are valid with no duplicate marker IDs; comparison toggles work.
17. Current-room mesh picking works; the Decision guide opens the real clash view.
18. Exported comparison SVG preserves the selected seated-WC, inside-basin and door-angle settings.
19. Phone touch orbit and two-finger pinch change the actual shared camera.

The default outside-basin combined option shows 17 design checks: 7 geometry
passes, 4 cautions and 6 unverified site checks. The inside-basin option adds a
geometry approach check and an unverified actual-product/reuse check.
These design checks are distinct from the 30 unit tests and 19 browser tests.

The Node 26 test tooling may emit a `module.register()` deprecation warning;
the normal viewer browser console is clean. WebGL-failure QA intentionally
exercises a failure path.

## 6. Visual and decision review

Both scenes share one renderer/camera and identical viewport sizes, so the
same physical room is not misleadingly enlarged in one pane. On narrow screens
the panes stack. Cutaway walls and divider are shortened and doors translucent
only for viewing, not proposed as glass; full-height mode restores solid doors.
The current squat-pan silhouette, retained divider and proposed seated WC are
distinguishable. A top view and door-angle slider help inspect conflicts.

The outside-basin baseline, compact inside-basin option, shelf relocation,
shared wet entry and limited 1.83 sq ft area gain are explained in the interface.
New finishes, a shower or geyser are not attributed to demolition as if they
could not also be installed while keeping the partition.

## 7. Remaining site checks

- Exact fixture sizes, outlet/rough-in, installed WC shape/projection and full leaf sweep.
- Actual door dimensions, gaps, hinge offsets, frame construction, clear opening
  and feasibility of any outward/sliding alternative.
- Existing basin width/projection and plumbing; optional mirror/shelf/geyser coordination.
- Divider role, support, hidden services and proposed door infill before demolition.
- Waste routing, traps, floor falls, threshold containment, slip resistance,
  waterproofing continuity and flood test.
- Geyser mounting, service access, electrical zones, protected supply and earthing.
- Ventilation, local rules and approvals.

The planning references are not local-code certification. The room remains an
open wet room, the bucket is movable shared-use storage, the rendered floor is
flat, and no outside corridor area or construction approval is implied.
