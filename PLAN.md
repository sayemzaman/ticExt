# ticExt project plan

Last reviewed: 2026-11-19 (Bangladesh time)

## Goal

Prepare a Bangladesh Railway ticket request in a Chrome extension. For each trip, the user chooses a travel date and train departure time, origin, destination, passenger count, two ranked travel classes, five ranked individual seat numbers, and a separate booking start date and time. At the booking start time, the extension opens the official railway e-ticket site and attempts to carry those choices through the available booking flow. It stops before payment so the user can review the selection and complete checkout.

The five seat preferences are specific seat numbers in priority order. When booking for multiple passengers, seats must be together. Prefer a group that includes a ranked preferred seat; otherwise choose another together-seated group as close as possible to the preferred seats on the site's seat map. We still need to confirm how seat numbers map to trains and classes. A requested train, class, or seat may be unavailable; the extension must show what actually happened rather than claim a ticket was booked.

## Current understanding of the flow

1. Create one booking request with travel date, origin, destination, passenger count, and a separate booking start date and time.
2. Show likely trains for that route and travel date. The user chooses a train departure time from the list.
3. Collect first and second class choices plus five ranked individual seat numbers. For multiple passengers, consider only groups seated together. Rank groups containing preferred seats first, then choose the nearest available together-seated group if none contains a preferred seat. While setting up the request, the user chooses whether to try another nearby train if the selected one is unavailable. The extension follows that choice at booking time without waiting for input.
4. Save the request locally and show its status and countdown.
5. At the agreed booking start time, open the official site, search for the journey, and select an available option according to the saved ranking and fallback settings. If the selected train is unavailable and alternates were disabled, stop the attempt and report the outcome.
6. Show the selected train, class, seats, and fare. Stop before payment and let the user finish checkout. Mark success only after the official site confirms the ticket.

## Technical direction

- Chrome Manifest V3 extension, TypeScript, and WXT. Add React only if the booking form or status view benefits from it.
- Use Chrome storage for booking requests and Chrome alarms for scheduled start. Restore or check pending alarms when the extension starts.
- Interact only with the official `eticket.railway.gov.bd` site. Request the smallest set of browser permissions needed.
- Keep the user's railway session in the browser. Do not store passwords, payment details, or identity documents in the extension.
- Treat the schedule list as provisional until the live site confirms it; do not depend on an undocumented API without validating its stability and permitted use.
- Chrome alarms may fire late and cannot wake a sleeping device. The extension should warn the user that Chrome and the computer need to be running and should report missed starts. Exact-time booking cannot be guaranteed.

## Task list

### Planning and discovery

- [x] Create local Git repository and connect it to GitHub.
- [x] Record the first product flow and key reliability limit in this plan.
- [x] Confirm that seat preferences are five ranked individual seat numbers and the selected train time is a travel time.
- [x] Confirm a separate booking start time, origin chosen for each trip, and a stop before payment.
- [x] Confirm that multiple passengers must sit together.
- [x] Confirm the seat fallback: choose another group together, as near as possible to preferred seats.
- [x] Confirm that the user chooses the alternate-train rule when setting up each request; the extension does not wait for a decision at booking time.
- [ ] Resolve the open product questions below.
- [ ] Inspect the current official booking UI, train search, seat map, login/verification, and payment flow using a test journey.
- [x] Inspect a logged-in search and open coach layout for Dhaka–Chattogram on 28 November 2026, without selecting seats.
- [ ] Inspect the verification/passenger/payment boundary; do not proceed through live seat reservation in automated tests.
- [ ] Check current site rules and Chrome Web Store requirements before implementing site automation.
- [x] Decide how to populate probable trains: dated snapshot of the public Train Information timetables, clearly labelled as estimates. Live availability must be checked during booking.

### First usable version

- [x] Scaffold the Manifest V3 extension and document build, test, and local loading commands.
- [x] Build the booking request form with separate travel and booking start dates/times, route, passenger count, class ranking, five specific seat numbers, and a per-request alternate-train choice.
- [x] Replace From and To text fields with station dropdowns from an official-site snapshot (263 destinations; 165 enabled origins). Validate selections and preserve them when editing.
- [x] Validate dates, passenger limits, route, and the preference order; persist the request locally. Initial count range is 1–4; confirm current railway limit during site inspection.
- [x] Show probable train options and let the user choose one. Filter by station order, running days and overnight boarding date; fill the selected train and time. Allow explicit manual entry when a timetable is missing.
- [x] Schedule, edit, cancel, restore, and display pending booking starts and statuses.
- [x] Open the official search at the scheduled time with route, date and first class in its query parameters. Login may be required by the site.
- [ ] Continue from the official search through train/class/seat selection using the saved choices.
- [x] Connect a tab-bound site assistant to train matching, preferred-class BOOK NOW, coach scanning, and a seat-group recommendation. Verified against local fixtures; live adapter verification remains pending.
- [ ] Handle unavailable trains/classes/seats with the saved fallback rules; stop and report when alternates are disabled, keep multiple passengers together, and show the chosen option and fare.
- [x] Implement and unit-test geometry-based seat-group planning with preferred seats and nearby fallback.
- [x] Connect the DOM seat-map reader to the group planner in preview mode; recheck the group before outlining recommendations, without clicking seats.
- [ ] Apply seat selections, recheck availability before each selection and report partial/failed reservations accurately. No live reservation tests.
- [ ] Hand off login and verification when required; stop before payment and detect and report official confirmation after the user finishes checkout.
- [ ] Test the form, scheduling, missed alarms, fallback logic, and at least one supervised end-to-end trial.

### After the first usable version

- [ ] Improve the interface and accessibility from real trial feedback.
- [ ] Add clear error recovery for site layout changes, session expiry, and sold-out journeys.
- [ ] Package the extension and decide whether to keep it private or submit it to the Chrome Web Store.

## Open product questions

1. Are seat numbers and seat-map positions stable across trains and classes on the current site? How should distance be measured when the map does not show physical proximity clearly?
2. What is the maximum acceptable fare before handing off to payment?
3. If alternate trains are allowed, how close to the selected departure time may they be? Should the extension stop when both preferred classes are unavailable?
4. Will the extension be used on one logged-in Chrome profile on a computer that stays awake at booking time? All times are assumed to use Asia/Dhaka unless you prefer otherwise.

## Implementation handoff

The extension implements a planner page, serialized background storage updates, alarms, editing/cancellation, startup alarm restoration, and a two-minute late-start cutoff. The probable-train dropdown uses a snapshot of 167 public timetables; changing route or date clears the previous train. Manual entry is an explicit fallback. Saved alternate-train timing is configurable (initial value 120 minutes). Only the two preferred classes are allowed by the planned automation.

At the scheduled start, the extension opens `/booking/train/search` using the site's `fromcity`, `tocity`, `doj` (dd-MMM-yyyy), and `class` query parameters. A content script acts only in the tab bound to that request by the background worker. It checks route/date, matches train/time, tries class-specific BOOK NOW buttons and scans coach maps. It outlines the recommended group without clicking seat buttons or Continue Purchase. The result is stored as `recommendation` and `assistantStatus`; the booking status remains `opened`, never confirmed. The site may redirect to login. Seat reservation and checkout automation remain unimplemented.

Build and type-check pass. Unit tests cover validation, Bangladesh timezone conversion, and the late-start cutoff. See README.md for commands and the isolated browser test. npm audit has an unresolved picomatch advisory in development dependencies, documented in README.md.

Browser verification passed the real extension form, persistence after page reload, editing, cancellation and alarm removal, rescheduling, and a real alarm opening one railway tab. Tests intercept all railway traffic. A visual check found and fixed a form reset naming collision; the browser test now verifies the form clears successfully after saving.

Public homepage inspected in an isolated browser on 2026-11-18: route inputs are named `dest_from` and `dest_to`; the date field says `Pick a date`; a class dropdown and `SEARCH TRAINS` button are present. The class options are reflected in the form. Login/verification, search results, coach layouts, and the payment boundary still need inspection. No booking request or seat reservation was made.

Public Train Information page inspected: timetable routes and running days are available without login; actual booking search checks login. `scripts/refresh-timetable.mjs` refreshes a local snapshot manually, with rate-limited public information requests and no credentials. The snapshot contains 167 trains with zero failed fetches. It may omit route matches where the source has inconsistent backward clock jumps; no services or availability should be inferred from an empty result. The adapter has tests for midnight crossings and intermediate-station boarding weekdays. Snapshot data is never a live availability claim.

### Logged-in seat-layout inspection (2026-11-19)

The user opened the layout in their signed-in Chrome session. Verified flow: search results → class-specific BOOK NOW → coach dropdown → seat buttons → Boarding Station → CONTINUE PURCHASE. On PARJOTAK EXPRESS (816), the open layout offered coaches UMA, CHA, SCHA and XTR2; a coach can be sold out while another has available seats. Coach selection alone changed the displayed layout and left the selected-seat total at zero. No seats were selected, no reservation request was made, and CONTINUE PURCHASE was not clicked during this inspection.

Observed seat limit: four per order. Seat labels include the coach prefix (for example SCHA-6), so a number alone does not identify a seat across coaches. The SCHA map has an aisle between two seat blocks. One row is SCHA-7/SCHA-6 on the left and SCHA-5/SCHA-4 on the right; numeric neighbors are not always physically adjacent. Some coach layouts contain missing positions or partitions, which an adapter must preserve.

`lib/seat-planner.ts` takes explicit coach, block, row, column and availability data. It chooses connected available seats in one coach/block over at most two adjacent rows, first maximizing preferred-seat matches, then honoring preference order, then minimizing physical-grid distance to known preferred seats. If no group meets these requirements it returns no selection. This is the initial conservative interpretation of together; it never splits a group across an aisle. The DOM adapter now feeds it seat positions and reports a recommendation, but never reserves seats.

### Site assistant preview handoff

`lib/railway-dom.ts` uses the public site's `app-single-trip`, `.single-seat-class`, `.book-now-btn`, `app-seat-layout`, `#select-bogie`, `.seat_layout`, `.seat-row`, `.seat-in-row`, `.seat-wrapper` and `.btn-seat` controls. Empty seat slots are preserved; two aisle blocks and one visible floor are required. Unknown layouts, selected seats, or pending reservations stop the run. Sold-out coaches are read as unavailable; all coaches are compared before returning to the recommended coach and rechecking availability. The route-bound content script stores no account information and never clicks seat buttons or Continue Purchase.

Verification: typecheck, production build, 14 unit tests, scheduler browser test, and assistant fixture browser test pass. Assistant fixtures exercise second-class fallback, coach scanning, alternate train opt-in and time limits, unknown geometry, login detection, preserved ordinary tabs and no rerun of completed previews. They assert zero seat clicks and zero checkout clicks. Real-site end-to-end verification of this adapter is still pending; fixture success does not prove live-site compatibility. Next: supervised preview verification, then implement seat reservation with partial-failure handling and the prepayment handoff.

## References

- Bangladesh Railway purchase guide (published 2022): https://railway.gov.bd/pages/static-pages/691997d2933eb65569ddf747
- Official e-ticket site: https://eticket.railway.gov.bd/
- Chrome alarms behavior: https://developer.chrome.com/docs/extensions/reference/api/alarms
