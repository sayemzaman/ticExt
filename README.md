# ticExt

Bangladesh Railway journey planner and booking-start scheduler for Chrome.

## Current version

Set the route, travel date/time, passenger count, two preferred classes, five ranked seat numbers, and a separate booking start. Choose alternate-train permission and a departure time window in advance. Save, edit, cancel, or reschedule requests. All times use Bangladesh time, regardless of the computer's timezone.

At the scheduled start, this version opens the official railway website. **Live train schedules, automatic search, seat selection, and checkout detection are not implemented yet.** Enter the train from an official search for now. Keeping passengers together and choosing nearby seats are saved requirements; selection automation is still pending.

Keep Chrome open and the computer awake. Starts more than two minutes late are marked missed instead of launching a stale attempt. Website opened does not mean ticket booked. Payment stays manual.

## Development

Install Node.js LTS with npm, then run:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

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
```

If using this session's downloaded browser on Windows, set `$env:PLAYWRIGHT_BROWSERS_PATH='D:\ticExt\.tools\browsers'` first. The browser test uses an isolated profile and intercepts railway traffic; it never reserves real seats.

## Dependency note

The initial npm audit reports nine high-severity findings in the development toolchain, all stemming from the picomatch advisory GHSA-fc5q-39xc-vjpf. The registry currently reports 4.0.7 as latest and the advisory includes that version. These tools are not shipped in the extension. Recheck upstream before publishing or exposing a development server.

See [the project plan](PLAN.md) for the proposed ticket booking flow and task list.
