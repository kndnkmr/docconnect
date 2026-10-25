# Client safety tests

Automated checks for the parts of ProMedicoz where a mistake could mislead a
patient: blood-report ranges and "see a doctor today" limits, the photo
reader, the daily medicine chart and its reminders, the doctor's prescription
box, vaccine dates, and the due-date / ovulation maths.

```
npm test
```

They run automatically before every build (`prebuild` in `package.json`), so
a Vercel deploy **stops** instead of going live if any check fails.

They use Node's built-in test runner (no extra packages) and import the same
plain-JS files the pages use (`src/pages/tools/*.js`, `src/utils/rx*.js`).

## Changing a medical number

If a doctor asks you to change a range or limit in
`src/pages/tools/reports.js` (or the vaccine schedule in `vaccines.js`),
update the matching expectation in `reports.test.mjs` / `vaccines.test.mjs`
in the same commit. The failing test is the reminder that someone has
to confirm the new number on purpose.

Dates in tests are compared as ISO strings (`2026-08-10`), not month names,
because short month names differ between Node versions.
