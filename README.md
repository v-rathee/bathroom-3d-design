# Combined bathroom

**[Open the 3D design](https://v-rathee.github.io/bathroom-3d-design/)**
&nbsp; | &nbsp;
**[Open Plumber mode](https://v-rathee.github.io/bathroom-3d-design/#plumber)**

Public source: [v-rathee/bathroom-3d-design](https://github.com/v-rathee/bathroom-3d-design).
The original room photographs, credentials, diagnostics and local caches are not published.

## One approved concept

The viewer now shows **only the combined room**, with the **washbasin fixed outside**.
The inside-basin alternative and current-versus-combined comparison have been removed
from the application, source, plans and portable package.

- Inside footprint: **96 x 48 inches / 8 x 4 ft / 32 sq ft**.
- Ceiling: **144 inches / 12 ft**.
- Left: compact seated WC, illustrative **15-inch width x 25-inch body depth plus
  1-inch rear allowance**, giving 26 inches total wall-to-front projection and
  22 inches in front.
- Right: open 36 x 36-inch shower planning area, low bucket tap and movable bucket.
- Retain the right 29-inch nominal entrance, right-hinged and opening inward.
- Close the former left doorway and remove the dividing wall only after on-site approval.
- Outside basin: keep its existing location; illustrative 18 x 14-inch unit,
  35-inch rim height, proposed 22 x 24-inch mirror and splashback.

Actual products, rough-ins, door/jamb offsets and final finished-face dimensions
still need site verification.

## Controls and Plumber activation

- Drag to orbit, wheel to zoom, right-drag to pan.
- Touch: one finger rotates; two fingers zoom and pan.
- Click a fixture or its sidebar card to inspect the proposal.
- Camera presets: **3D view**, **Top 3D**, **Room view**, **2D plan**.
- Wall modes: shortened cutaway, full 144-inch height, or hidden shell.
- Door button/slider: retained inward door, 0-90 degrees.
- Checkboxes: measurements, labels, WC approach space and removed-partition trace.
- Keyboard: H home, T top, D door endpoints, M measurements, Escape clear selection.

**Clicking the Plumber tab now actually enables Plumber mode**, rather than just
opening explanatory notes. The top button also toggles it. A green
**PLUMBER MODE ACTIVE** status confirms selection. Switching it off returns to Layout.
The URL fragment `#plumber` enables this mode on load and during same-page navigation;
`#design` returns to normal design mode.

Plumber mode shows indicative service points, the **84-inch / 7-foot tile line**,
the existing drain **survey zone**, and the outside-basin design detail. These are
coordination aids, not drilling or pipe-hole coordinates.

The owner confirmed the existing bath drain is at the **back-left corner of the
original bathroom**. Its exact centre, invert, size, trap and destination remain
unverified. There are two existing bath taps and **no geyser or geyser points**.
The heater/hot-water provision shown is new future work.

## Plumber handover

**[Download the four-page concept PDF](Plumber-Concept.pdf)** or open
[the printable browser version](Plumber-Concept.html).

1. Combined-room setting-out plan, 1:20 only at A3/100%, and fixture envelope schedule.
2. Functional water/drainage schematics, service-point coordination and survey holds.
3. Rear-wall and outside-basin elevations.
4. Tile quantities, survey records and pre-concealment hold points.

The PDF has four A3 landscape pages and no local-file-path headers. Body dimensions
are not WC soil-pipe rough-in coordinates. No pipe route, diameter, invert, finished
level or floor slope is approved by this concept.

Inside tile estimate: **32 sq ft floor**, **168 sq ft gross walls** to 7 feet, and
approximately **151.89 sq ft net walls**, deducting one **assumed 29 x 80-inch doorway**.
With 10% extra: 35.2 sq ft floor and 167.08 sq ft walls, rounded up to actual boxes.
External splashback, jamb returns and other extra faces are additional.

## Open offline and export

Double-click [Bathroom-3D.html](Bathroom-3D.html) in a current Edge or Chrome
browser with WebGL enabled. The viewer is self-contained and needs no server,
internet or Node.js. Its handover links require the adjacent handover files.
The Three.js MIT notice is embedded.

**Save image** exports the current 3D view as PNG. **Download plan** exports the
combined SVG, including the survey-zone overlay in Plumber mode.
If WebGL fails, the error is displayed explicitly and the labelled 2D plan remains available.

## Construction limitations

This is a discussion/quotation concept, not a local-code, accessibility, structural,
plumbing or electrical approval.

- Obtain qualified on-site approval of the dividing wall, hidden services and door infill
  before demolition.
- Select the actual WC and verify its installed projection, waste outlet and rough-in.
- Have the plumber design suitable traps, vents, pipe routes/sizes, levels and drainage.
  **Do not connect WC soil into a bath floor drain.**
- Coordinate waterproofing, former wall/door footprints, penetrations, drains, threshold
  containment, slip resistance and required testing.
- Have qualified installers review future geyser support, service access, safety arrangements,
  electrical zones, protected supply and earthing.
- Check ventilation, actual clear door width, outside basin/corridor clearance and local approvals.

The combined room remains an **open wet room**: no dry entrance or dry WC is promised.
The inward door shares shower standing space while open; the bucket must move when
the full shower area is used. Floors are rendered flat; slopes/levels are not engineered.
The outside floor patch is context only.

The 80-inch door height, 1-inch bottom gap, 1.2-inch leaf thickness, 4-inch outer
walls and secondary fixture sizes are assumptions. Cutaway walls are shortened and
doors translucent for viewing, not proposed as glass; full-height mode restores solid doors.
Planning references are not a determination of applicable local requirements.

## Deliverables

- [Bathroom-3D.html](Bathroom-3D.html): offline combined-room viewer.
- [Bathroom-dimensioned-plan.svg](Bathroom-dimensioned-plan.svg): combined room, outside basin.
- [Bathroom-plumber-plan.svg](Bathroom-plumber-plan.svg): same plan with existing-drain survey zone.
- [Plumber-Concept.pdf](Plumber-Concept.pdf) and [Plumber-Concept.html](Plumber-Concept.html):
  four-sheet concept pack.
- [Preview-3D.png](Preview-3D.png), [Preview-Desktop.png](Preview-Desktop.png),
  [Preview-mobile.png](Preview-mobile.png), [Preview-Plumber.png](Preview-Plumber.png) and
  [Preview-Outside-Basin.png](Preview-Outside-Basin.png): current previews.
- [QA-REPORT.md](QA-REPORT.md): verification scope and results.
- [Bathroom-Design-Package.zip](Bathroom-Design-Package.zip): portable package with sources.

## Build, test and host

With Node.js and Microsoft Edge installed, from this folder on Windows:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run handover:pdf
npm.cmd test
npm.cmd run test:browser
```

Non-Windows browser/PDF QA uses Playwright Chromium, which must be installed for
that development environment. Local dependency and QA folders are not published.

GitHub Pages serves `main`, root `/`. The build writes **content-versioned CSS and
JavaScript URLs** into the published entry point so a stale unversioned script is
not reused with the current controls. Keep the generated version tokens when
publishing, along with `styles.css`, `dist/viewer.js`, `.nojekyll`, the handover
files and `THIRD-PARTY-NOTICES.txt`. All asset links are relative.

The source is authored for this measured room; changing constants alone is not
a substitute for re-authoring and checking the corresponding 3D geometry.
