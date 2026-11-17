# ticExt project plan

Last reviewed: 2026-11-18 (Bangladesh time)

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
- [ ] Check current site rules and Chrome Web Store requirements before implementing site automation.
- [ ] Decide how to populate probable trains: official schedule data, live search, or a clearly labelled estimate.

### First usable version

- [x] Scaffold the Manifest V3 extension and document build, test, and local loading commands.
- [x] Build the booking request form with separate travel and booking start dates/times, route, passenger count, class ranking, five specific seat numbers, and a per-request alternate-train choice.
- [x] Replace From and To text fields with station dropdowns from an official-site snapshot (263 destinations; 165 enabled origins). Validate selections and preserve them when editing.
- [x] Validate dates, passenger limits, route, and the preference order; persist the request locally. Initial count range is 1–4; confirm current railway limit during site inspection.
- [ ] Show probable train options and let the user choose one.
- [x] Schedule, edit, cancel, restore, and display pending booking starts and statuses.
- [ ] Open the official site at the scheduled time and fill the supported search and selection steps.
- [ ] Handle unavailable trains/classes/seats with the saved fallback rules; stop and report when alternates are disabled, keep multiple passengers together, and show the chosen option and fare.
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

The first scaffold implements a planner page, serialized background storage updates, alarms, editing/cancellation, startup alarm restoration, and a two-minute late-start cutoff. The selected train is entered manually until live schedules are connected. Saved alternate-train timing is configurable (initial value 120 minutes). Only the two preferred classes are allowed by the planned automation.

At the scheduled start, the extension opens the official home page and explicitly reports that search and seat selection are not connected. There is no content script or request to a booking endpoint yet. The next integration task is inspection of the live site, including coach/seat map coordinates and session requirements, before adding automatic selections. Do not mark a booking successful merely because a tab opened.

Build and type-check pass. Unit tests cover validation, Bangladesh timezone conversion, and the late-start cutoff. See README.md for commands and the isolated browser test. npm audit has an unresolved picomatch advisory in development dependencies, documented in README.md.

Browser verification passed the real extension form, persistence after page reload, editing, cancellation and alarm removal, rescheduling, and a real alarm opening one railway tab. Tests intercept all railway traffic. A visual check found and fixed a form reset naming collision; the browser test now verifies the form clears successfully after saving.

Public homepage inspected in an isolated browser on 2026-11-18: route inputs are named `dest_from` and `dest_to`; the date field says `Pick a date`; a class dropdown and `SEARCH TRAINS` button are present. The class options are reflected in the form. Login/verification, search results, coach layouts, and the payment boundary still need inspection. No booking request or seat reservation was made.

## References

- Bangladesh Railway purchase guide (published 2022): https://railway.gov.bd/pages/static-pages/691997d2933eb65569ddf747
- Official e-ticket site: https://eticket.railway.gov.bd/
- Chrome alarms behavior: https://developer.chrome.com/docs/extensions/reference/api/alarms
