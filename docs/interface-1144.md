# Interface 11.4.4

Implemented on top of main `8c859c3`, with the existing data stores, coach functions and integrations retained.

## Findings and changes

- Desktop previously had nine primary destinations, while mobile put Progress inside More. Both now use Today, Planning, Progress, Races and More.
- Planning opens a seven-day list, with availability and workout creation directly reachable. The month calendar is available in a disclosure. Existing editing, moving and locking actions remain in the workout detail.
- Today previously stacked the main session, week overview, supplementary training, multiple complete coach engines and all activity results. It now emphasizes the session, its purpose, supplementary sessions and a short adaptive summary. Detailed coaching is collapsed.
- Activity results and review forms now live only in Progress. Review shortcuts activate that destination before opening the form. Advanced analysis is collapsed and section links expand the required ancestors.
- Sync diagnostics have one home in Progress, with direct links from Today and More. Failed activity sync and offline status remain visible without opening the detailed coach.
- The existing visual stylesheet was replaced with common dark green surfaces, one accent, consistent controls and typographic hierarchy. Advanced tool surfaces share the same tokens.
- Workout phases use the original display steps. The visual sequence does not invent duration proportions. Exact textual steps remain visible below it; training calculations and prescriptions are unchanged.
- Internal routes remember their scroll position. Detail routes expose a back action. The More dialog traps keyboard focus and restores focus when closed.
- Safe-area padding, 44px controls, 16px form inputs, fluid grids, visible focus and reduced-motion support are included. The shell cache and asset versions were bumped together.

## Validation

- `node --test tests/*.test.cjs`: 124 passed.
- `node --check js/app.js`, `node --check js/interface.js`, `node --check js/bootstrap.js`: passed.
- `git diff --check`: passed.
- Full HTML and all scripts executed together in JSDOM using isolated test storage and a simulated unavailable backend. The smoke check covers unique IDs, five navigation destinations, workout phases, week/detail navigation, availability saving and returning, moving through the editor, review routing, expanding coaching, sync error access, races, More focus and offline status.

Reproduce the DOM smoke check from the repository root:

```sh
npm install --prefix /tmp/jaco-ui-test jsdom@30.1.2 --no-audit --no-fund
NODE_PATH=/tmp/jaco-ui-test/node_modules node tests/ui/interface.smoke.cjs
```

## Remaining validation and release status

The existing production screen was inspected in a browser. Its personal Intervals.icu data required a PIN, which was not provided or entered. Real authenticated sync, export and race predictions were therefore not validated end-to-end.

The browser could not open the local development server (`ERR_BLOCKED_BY_CLIENT`). JSDOM checks behavior and DOM structure, not layout or paint. Mobile/desktop screenshots, clipping/contrast checks and installed iOS PWA behavior remain to be verified on a reachable preview. No fabricated screenshots or production data were used.

The branch and draft PR #86 are published. Vercel preview build succeeded. The deployed desktop preview was inspected for Today, Planning, Progress and Races. No horizontal page overflow was measured at the available 1363px viewport. Two issues found during inspection were corrected: old colors in empty cards and a loading message persisting after failed wellness sync. Mobile viewport resizing is not exposed by the available browser API, so iPhone/standalone visual checks remain pending. Production has not been changed.
