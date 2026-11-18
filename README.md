# ticExt

Bangladesh Railway journey planner and booking-start scheduler for Chrome.

## Current version

Set the route, travel date/time, passenger count, two preferred classes, five ranked seat numbers, and a separate booking start. Choose alternate-train permission and a departure time window in advance. Save, edit, cancel, or reschedule requests. All times use Bangladesh time, regardless of the computer's timezone.

From and To are alphabetical station dropdowns. The bundled list was captured from the official railway homepage's public station data on 2026-11-18: 263 stations, of which 165 are enabled as origins. The list works offline; future railway station changes require refreshing the bundled snapshot. Selecting a station does not establish that a train runs on the selected route/date.

Choose a route and travel date to see probable trains from a dated snapshot of 167 public railway timetables. The list accounts for running days, route direction, and overnight boarding. Selecting a train fills its departure time. You can explicitly enter a train manually after checking the official site if the snapshot has no match. Timetables do not establish seats, fares or current service.

At the scheduled start, this version opens the official search, matches the requested train and time, and tries the two classes in order. If enabled, alternate trains are tried within the saved time window after the selected train. The assistant opens class layouts and reads each coach to recommend a connected group, preferring your seat numbers and nearby seats. It outlines the recommendation in blue and reports it in the saved plan. **Outlines are suggestions: seats are not selected or reserved. Seat selection, Continue Purchase, and payment are still manual.**

The assistant runs only in the tab it created for that request. Ordinary railway tabs are left alone. Login/verification, changed layouts, existing seat selections and unrecognized coach geometry stop the preview. This adapter has been verified against isolated DOM fixtures based on the observed site and public UI code; it still needs supervised verification against a live session. No reservation or purchase actions are invoked by this version.

Keep Chrome open and the computer awake. Starts more than two minutes late are marked missed instead of launching a stale attempt. Website opened does not mean ticket booked. Payment stays manual.

## Development

Install Node.js LTS with npm, then run:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

To refresh the bundled public timetable snapshot manually: `node scripts/refresh-timetable.mjs`. This reads public Train Information data at a limited rate; it does not search availability, log in, or reserve seats. Check the generated diff and rerun the checks before committing a refreshed snapshot.

This session used a local npm download because npm was absent: `node .tools/package/bin/npm-cli.js` can replace `npm` on this computer. `.tools` is ignored by Git.

## Load in Chrome

1. Open `chrome://extensions` and enable Developer mode.
2. Click **Load unpacked** and select `D:\ticExt\.output\chrome-mv3`.
3. Pin ticExt and click its toolbar button to open the planner.
4. After rebuilding, reload the extension on the extensions page.

## Browser verification

```sh
npx playwright install chromium
node tests/browser.mjs
node tests/assistant.mjs
```

If using this session's downloaded browser on Windows, set `$env:PLAYWRIGHT_BROWSERS_PATH='D:\ticExt\.tools\browsers'` first. The browser test uses an isolated profile and intercepts railway traffic; it never reserves real seats.

## Dependency note

The initial npm audit reports nine high-severity findings in the development toolchain, all stemming from the picomatch advisory GHSA-fc5q-39xc-vjpf. The registry currently reports 4.0.7 as latest and the advisory includes that version. These tools are not shipped in the extension. Recheck upstream before publishing or exposing a development server.

See [the project plan](PLAN.md) for the proposed ticket booking flow and task list.
