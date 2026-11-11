# Your combined bathroom

## View online

**[Open the interactive bathroom design](https://v-rathee.github.io/bathroom-3d-design/)**

Public source: [v-rathee/bathroom-3d-design](https://github.com/v-rathee/bathroom-3d-design).
The public project contains the design, source, plan, previews and QA documentation;
it does not contain the original room photographs or local dependency/test caches.

## Open the interactive design

**Double-click [Bathroom-3D.html](Bathroom-3D.html)** and open it in a current
Microsoft Edge or Chrome browser with WebGL enabled.

The HTML file is self-contained. You can copy that one file elsewhere: it does
not require Node.js, npm, an internet connection, a local server, or the other
files in this folder to run. The Three.js MIT license is embedded in the file.

### Controls

- Drag: rotate the room.
- Mouse wheel: zoom.
- Right-drag: pan.
- Touch: one finger rotates; two fingers zoom and pan.
- Click a fixture, or its sidebar card, to read its size and assumptions.
- **3D view**, **Top 3D**, **Inside**, **2D plan**: camera/plan presets.
- Wall selector: shortened cutaway, full measured height, or hidden shell.
- Checkboxes: measurements, labels, WC approach space, removed-wall trace.
- **Door**: compare the proposed outward-open and closed positions.
- **Save image**: download the current rendered 3D view as PNG.
- **Download plan**: download the dimensioned SVG plan.
- Keyboard: H home, T top, D door, M measurements, Escape clear selection.

On a phone-sized screen the viewer appears first and the controls/details follow
below it. If 3D cannot start, an explicit error is shown; the 2D plan remains
available. Do not confuse that alternative with a successful 3D render.

## The proposed arrangement

| Item | Proposed arrangement |
|---|---|
| Inside room | 96 x 48 inches, or 8 x 4 feet; 32 sq ft |
| Ceiling | 144 inches, or 12 feet |
| Dividing wall | Removed in the concept; inferred 5.5-inch thickness |
| Entrances | Right 29-inch doorway retained; left doorway infilled |
| Western WC | Left side, facing the front wall; compact 15 x 25-inch installed envelope |
| WC clearance | 22 inches in front, 17.5 inches from centre to left wall, 1 inch behind |
| Shower | Back right, 36 x 36-inch planning area; open, without glass |
| Bucket and low taps | Right rear; bucket is movable and shares shower space |
| Geyser | High rear wall, left of the shower footprint; size/location subject to installer review |
| Storage | Shallow wall shelf between WC and shower; no floor cabinet |
| Washbasin | Stays outside, between the original doorways |
| Drain | Proposed rear shower drain, subject to plumbing survey |

The initial palette is sage tile, warm limestone-look flooring, ivory fixtures,
wood-tone storage and brass-tone fittings. A second warm-sand palette is available.
Materials are visual suggestions, not product or slip-resistance specifications.

## Important constraints

1. **This is an open wet room, not separate wet and dry compartments.** The
   retained entrance shares the wet floor. There is no guaranteed dry path.
2. **Select the actual WC before approving the layout.** The illustrated
   installed projection is 25 inches plus a 1-inch rear allowance. Keeping the
   same rear allowance with a 27-inch WC would leave only 20 inches in front,
   below the 21-inch planning reference used here.
3. **The 29-inch doorway is narrow.** Its nominal measured width is not proof of
   a clear opening. This is not an accessible-bathroom design.
4. **The bucket must move when the full shower area is used.** Storage and
   shower standing space are shared, not counted as separate usable areas.
5. **The outward door swing is a proposal.** The corridor, adjacent doors and
   actual basin dimensions were not measured.
6. **No demolition is approved by this model.** An on-site qualified professional
   must verify the dividing wall, support and hidden services before work.
7. **Plumbing, waterproofing, electrical safety and ventilation remain
   unverified.** Have the appropriate qualified professionals review them.

The 21-inch WC front clearance, 15-inch centre-to-side-wall distance, 30-inch
shower-side reference and 32-inch door preference are illustrative planning
targets, not a determination of applicable local building regulations.

## Confirmed measurements and assumptions

Confirmed by the owner: 35-inch toilet width, 55.5-inch bathroom width, 96-inch
combined inside width, 48-inch room depth, 12-foot ceiling and two 29-inch
doorways. The owner selected a seated WC, right entrance, shower, bucket/low
taps, geyser and wall storage; the basin remains outside.

Assumptions: both room depths are equal; door positions are at the front-wall
ends as interpreted from the sketch; jamb offsets are unknown; door height is
80 inches; outer walls are illustrated as 4 inches thick; secondary fixture
sizes are illustrative. The 5.5-inch partition is inferred as
96 - 35 - 55.5. Its removal recovers about 1.83 sq ft.

The ceiling is omitted for viewing. Default cutaway front/side walls are
shortened and the rear wall is cut at 112 inches; **full-height mode shows
the actual 144-inch shell**. The floor is flat in the visualization: drainage
falls and construction levels are not engineered. The outside floor patch is
only context, not a measurement of available corridor space.

## Deliverables

- [Bathroom-3D.html](Bathroom-3D.html): offline interactive 3D viewer.
- [Bathroom-dimensioned-plan.svg](Bathroom-dimensioned-plan.svg): scalable plan
  with measurements and the WC approach area.
- [Preview-3D.png](Preview-3D.png): rendered model preview.
- [Preview-Desktop.png](Preview-Desktop.png): desktop viewer preview.
- [Preview-mobile.png](Preview-mobile.png): phone-layout preview.
- [QA-REPORT.md](QA-REPORT.md): verification scope, results and remaining checks.

## Rebuild or rerun software QA

The source and locked dependencies are retained for maintenance. On Windows,
with Node.js and Microsoft Edge installed:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd test
npm.cmd run test:browser
```

Run these commands from this folder. Development dependencies are not needed
to open the delivered standalone HTML. On non-Windows systems, browser QA uses
Playwright's Chromium, which must be installed for that development environment.

This model is authored for the confirmed room. Changing measurement constants
alone is not a substitute for re-authoring and rechecking the corresponding
3D geometry.

## GitHub Pages hosting

GitHub Pages serves the `main` branch, repository root (`/`). Keep `index.html`,
`styles.css`, the built `dist/viewer.js`, `.nojekyll` and
`THIRD-PARTY-NOTICES.txt` in the published files. All asset links are relative,
so the viewer works under the repository's Pages subpath.

After changing the source, run the build and tests, then commit the updated source
and generated files. The standalone HTML remains available for offline use.
