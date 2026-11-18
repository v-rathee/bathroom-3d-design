# Combined bathroom verification

Date: 2026-11-18

**24 layout tests and 18 browser tests passed.**

The viewer is combined-room only, with the washbasin fixed outside. The removed
alternatives and their obsolete plans/previews are no longer part of the current
application or portable package. This result is software/model verification,
not construction or local-code approval.

## 1. Plumber activation fix

The earlier live page reproduced the reported UI gap: selecting the Plumber tab
opened its notes while the mode remained off. The separate header toggle worked,
but the tab itself did not enable the overlays.

Now:

- The Plumber tab, its view button, the header toggle and `#plumber` URL all activate
  the actual mode.
- A green status and pressed header button confirm selection.
- Switching off hides the overlays, updates the URL to `#design` and returns to Layout.
- Same-document hash navigation and fresh-page/deep-link loads are tested.
- Published CSS/JS URLs include content-derived versions. A local HTTP regression
  test poisons the old unversioned script response and verifies the versioned assets
  are loaded instead and Plumber activation still works.
- Initialization errors are surfaced through the existing visible error panel.

## 2. Geometry and assumed measurements

| Quantity | Checked value |
|---|---|
| Combined inside floor | 96 x 48 in / 32 sq ft |
| Ceiling | 144 in |
| Actual rendered WC envelope | 15 W x 25 D x 32.5 H in |
| WC front/back from front inside face | 22 / 47 in |
| WC rear allowance | 1 in; total wall-to-front projection 26 in |
| WC centre to nearest side wall | 17.5 in |
| Shower planning footprint | 36 x 36 in |
| Only retained door | Right-hinged, inward, nominal 29 in |
| Outside basin envelope | 18 W x 14 D in; left X = 39; D = -18 to -4 in |
| Shelf footprint | X = 38 to 58 in; base 48 in above floor |
| Plumber tile guide | Actual world-space height 84 in / 7 ft |

Critical floor, WC, outside-basin and shelf checks use the built Three.js objects,
not only the input data. The viewer raises a visible error if those geometry
checks drift from the plan.

The existing bath-drain corner is confirmed, but its precise pipe centre, trap,
invert, size and discharge route remain unverified. The marked rectangle is a
survey zone, not an actual pipe centre. The WC product/outlet is not selected;
the heater and its points do not exist now.

## 3. Layout tests: 24 passed

Run: `npm.cmd test`

Coverage:

- Room/partition-width reconciliation and square-foot conversion.
- Outside-basin-only and right-inward-door-only layout.
- Indoor footprint bounds and actual proposed WC clearances.
- Longer WC, too-close side position, undersized shower, fixture clash and out-of-bounds failures.
- Retained door endpoints, intermediate angle, full quarter-circle sweep and height filtering.
- Avoiding rectangular-sweep false positives.
- Shared shower/bucket/door standing space recorded as a caution.
- Confirmed versus unverified plumber data and future geyser provision.
- Seven-foot tile quantities, wastage and doorway deduction limited to the tile band.
- Illustrative outside basin/mirror sizes and elevated storage.
- Site safety/compliance never certified by geometry.
- Single combined plan, outside basin, door state and survey-zone export.
- Invalid inputs raise explicit errors.

## 4. Browser tests: 18 passed

Run: `npm.cmd run test:browser`

Environment: isolated headless Microsoft Edge / Chromium on Windows.

1. Standalone viewer renders offline; only the combined layout/outside basin exists,
   with no comparison controls or inside-basin selector.
2. Published root uses content-versioned assets, bypasses the deliberately poisoned
   unversioned script and activates Plumber mode.
3. All seven fixture inspectors work.
4. Wall modes, labels, measurements, approach space, removed-wall trace and finishes work.
5. Right inward door and all camera/plan presets work.
6. Actual mesh raycasting, wheel zoom, orbit and pan work.
7. Clicking the Plumber tab activates overlays, the real 84-inch guide and status.
8. Header on/off works repeatedly, and the tab can reactivate the mode.
9. Fresh load, reload and same-document `#plumber` / `#design` navigation work.
10. Tile guide, outside-basin detail and handover links work without an inside-basin option.
11. The 17 design checks retain 7 geometry passes, 4 cautions and 6 unverified site checks.
12. One valid SVG plan reflects dimensions, inward door, optional wall trace and survey zone.
13. PNG/SVG exports contain the combined layout only.
14. Keyboard shortcuts do not hijack focused form controls.
15. Layouts at 1440 x 1000, 1024 x 768, 768 x 1024, 390 x 844 and 320 x 740
    fit without horizontal overflow, with working Plumber controls.
16. Simulated WebGL failure is explicit; the combined Plumber plan remains available.
17. Phone touch orbit and two-finger pinch move the real camera.
18. The four-sheet printable concept retains valid drawings and explicit hold points.

The design-check counts are separate from the unit/browser test counts.
The Node 26 tooling may emit a `module.register()` deprecation warning; normal
application browser checks are clean. The WebGL-failure test intentionally
exercises a failure path.

## 5. PDF and print checks

Run: `npm.cmd run handover:pdf`

The PDF is parsed to verify exactly four A3 landscape pages. Print-layout checks
verify page/footer bounds, drawing text inside SVG bounds, valid SVGs, no application
errors and no local paths in document text. The 1:20 plan's SVG viewport is
187.96 x 160.02 mm at A3/100%; its 1000-mm calibration bar is 50 mm on paper.
Elevations and service schematics are explicitly not to scale.

## 6. Construction limitations

The 80-inch door height, 1-inch bottom gap, 1.2-inch leaf thickness, outer-wall
thickness and fixture products are assumptions. Written dimensions govern.
Planning targets do not certify local-code compliance or accessibility.

Before work: verify wall role/support/hidden services, door infill, selected WC
and rough-in, actual basin/corridor clearance, water source/pressure, pipe routes
and sizing, traps/vents, drainage inverts, floor falls, threshold, waterproofing,
testing, ventilation and qualified geyser/electrical review.

The room is an open wet room; no dry entry or WC is promised. Floor slopes are
not engineered in the 3D model. Do not connect WC soil into a bath floor drain.
The plumber pack is for discussion and quotation, not an instruction to start
construction.
