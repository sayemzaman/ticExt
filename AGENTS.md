# Working on ticExt

Read PLAN.md before making product changes. Keep its checklist accurate; check a task only after verifying the implemented behavior.

Stack: WXT, TypeScript, Manifest V3. Commands: npm ci, npm run typecheck, npm test, npm run build. Browser test: npx playwright install chromium, then node tests/browser.mjs (build first).

All booking times use Asia/Dhaka. Keep passengers together and follow the fallback choices saved when the request was created. Stop before payment. Do not report a confirmed ticket without confirmation from the official website.

Do not store credentials, payment details, or identity documents. Do not log passenger details. Automated tests must not reserve real seats or send booking requests to the railway site. Keep unverified site automation clearly labelled in the UI and in PLAN.md.
