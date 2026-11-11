# Bathroom design verification

Date: 2026-11-11

**Result: 17 layout tests and 13 browser tests passed.**

This result verifies the digital model/viewer within the scope below. It does
**not** certify demolition safety, building-code compliance, accessibility,
plumbing, waterproofing, electrical installation or construction readiness.

## 1. Measured plan and actual rendered geometry

| Check | Result |
|---|---|
| Confirmed inside dimensions | 96 x 48 inches |
| Confirmed ceiling | 144 inches |
| Width reconciliation | 35 + 5.5 + 55.5 = 96 inches |
| Combined clear floor area | 32 sq ft |
| Inferred partition footprint recovered | 1.8333 sq ft |
| Actual rendered floor bounding box | Exactly 96 x 48 inches |
| Actual rendered WC bounding box | Exactly 15 W x 25 D x 32.5 H inches |
| Actual rendered WC front/rear positions | 22 / 47 inches from front inside face |
| WC front clearance | 22 inches |
| WC centre to left wall | 17.5 inches |
| WC rear allowance | 1 inch |
| Shower planning footprint | 36 x 36 inches |
| Door position in proposal | Rightmost 29 inches of front wall |
| Door motion | 0 degrees closed; 90 degrees outward open |
| Outside basin versus assumed door sweep | No plan overlap; actual site clearance still unknown |

The WC and floor checks use the built Three.js objects' bounding boxes, not only
the intended input values. The viewer raises a visible error if those critical
rendered dimensions drift from the plan.

## 2. Layout tests: 17 passed

Run: `npm.cmd test`

- Confirmed dimensions and inferred partition width reconcile.
- Area conversions and recovered footprint are correct.
- All indoor fixture planning footprints fit inside the room.
- Compact WC envelope, clearances and seat height match the proposal.
- A longer 27-inch WC produces a clearance caution, not a false pass.
- Moving the WC too close to a side wall produces a caution.
- Both shower dimensions are checked against the planning reference.
- WC and shower planning footprints do not overlap.
- Bucket shares the shower footprint and is explicitly movable.
- Floor-fixture overlap is detected.
- Out-of-bounds fixtures are detected.
- Right doorway and conservative outward sweep match the proposal.
- A hypothetical outside-basin/sweep conflict is detected.
- Shelf/heater are elevated and the heater remains below the ceiling.
- Physical/site safety items remain unverified, never geometry-certified.
- Invalid geometry inputs throw errors.
- SVG includes dimensions, outside-basin context and construction limitations.
- The SVG door leaf reflects open/closed state.

Some bullets group multiple assertions within one test; the executable test
runner's authoritative total is 17 tests.

## 3. Browser QA: 13 passed

Run: `npm.cmd run test:browser`

Environment: isolated headless Microsoft Edge / Chromium on Windows.

1. Standalone file loads with HTTP/HTTPS requests blocked, with no external
   assets, no application console errors and no leaked JavaScript in page text.
   The bundled Three.js license is preserved.
2. All seven fixture inspector buttons select and show information.
3. Cutaway/full/hidden walls, measurements, labels, WC approach overlay,
   removed-partition trace and both finishes respond.
4. Door and all camera presets work; open/closed door state also updates the
   2D plan.
5. Real canvas raycasting selects the WC mesh; wheel zoom, orbit and right-drag
   pan change the actual camera.
6. All 16 design checks are displayed: 7 geometry passes, 3 cautions and 6
   unverified site checks. Expandable details and assumptions are readable.
7. The plan parses as valid SVG/XML and includes measured dimensions,
   clearances and the optional removed-wall overlay.
8. PNG and SVG downloads work. PNG has the correct file signature and nonempty
   image content. A rendered preview is saved.
9. Keyboard shortcuts work and do not hijack focused form controls.
10. Layouts at 1440 x 1000, 1024 x 768, 768 x 1024, 390 x 844 and 320 x 740
    fit without horizontal page overflow. Model and plan remain available.
11. Simulated WebGL initialization failure displays an explicit error and
    disables image export; the separately labelled 2D plan remains available.
12. Emulated phone touch rotation and two-finger pinch change the actual camera.
13. The GitHub Pages root entry point loads its relative stylesheet and compiled
    script, matches the checked geometry, embeds its tab icon without an external
    request, and links the third-party license notice.

The Node 26 test environment emits a test-tool deprecation warning about
`module.register()`. Tests pass; the normal viewer's browser console is clean.
The WebGL-failure test deliberately exercises an error condition.

## 4. Visual review

The exported 3D render and desktop UI were inspected. The final default view
shows the WC, shower fittings, mounted heater, wall shelf, retained entrance and
labelled outside basin. The rear cutaway wall extends above the heater so mounted
fixtures are not depicted floating above a removed wall. Labels and dimensions
were checked for legibility. The bucket is in the rear-right shower area and can
be inspected by rotating or switching to the top view.

Finishes, shadows and fixture forms are illustrative, not photorealistic product
models. The outside basin can visually obscure part of the shower from the
default perspective; it is outside the actual room footprint.

## 5. Cautions and unverified site checks

**Design cautions:** narrow 29-inch nominal doorway; a shared wet entrance;
bucket/shower shared use. The compact WC has only 1 inch of spare front clearance
relative to the chosen 21-inch planning reference.

**Must be checked on site before approving work:**

- Dividing-wall role, support, hidden services and proposed door infill.
- Actual WC product, outlet/rough-in, traps, waste-pipe routes and drainage levels.
- Floor falls, threshold containment, slip resistance, waterproofing and flood test.
- Geyser model, mounting, service access, electrical zones, protected supply and earthing.
- Actual corridor dimensions, other doors, basin size and outward door clearance.
- Ventilation, local requirements and required approvals.

All secondary fixture dimensions and jamb offsets must be checked before purchase.
The planning references in this model are not a substitute for applicable local
regulations or a professional installation review.
