# Scorecard: parked releases and their triggers

Every release that is held or waiting gets a line here with the condition
that moves it, so nothing depends on someone remembering. (Auditor ruling
2026-10-12, after 4.3.0 sat 12 days on Closed testing without promotion.)
Check this file at the start of every working day. Delete a line once its
trigger has fired and the step is done.

| Waiting | Trigger | Then |
|---|---|---|
| Android 4.3.0 Open + Production (submitted 2026-10-12) | Google approves it (Play Console, Production track shows 4300 live) | Send the auditor the "Scorecard 4.3.0 live on both" note so it routes the privacy.html publish to Website. iOS 4.3.0 already released 2026-10-12. |
| 4.4.0 consent sentence + per-app consent versions | Notebook's ConsentCard.jsx / consent.js refactor is committed (the auditor routes the moment) | Build the per-app version map, write Scorecard's sentence from the inventory test, commit the test green, bump Scorecard's key. |
| 4.4.0 ship (Google review draft, password rules, sync fallback, analytics minimization) | 4.3.0 live on both stores AND the consent sentence done | Android 4400 through the full ladder; iOS 4.4.0 (16) from main; release-day bundle: Apple Product Interaction re-check, consent key bump verified. |

## Requirements for the per-app consent versions (before building)

- Each app has its own version value. Scorecard bumps with the 4.4.0
  sentence; **Board stays 1 and Notebook stays 1.** Board 2.4.6 is live on
  Internal with grants stored as textVersion 1, so seeding Board anywhere
  else would re-prompt every Board user and stop analytics until they answer.
- Versions are opaque per-app tokens compared with **strict equality**. No
  coercion or normalizing (values differ in type across the office:
  integers natively, date strings on the web).
- Legacy fallback: a stored `{ textVersion: 1 }` under the old shared key
  counts as valid for any app whose version is 1.
- Store each app's answer under its own key. Web apps share one origin, so
  one shared record would make Scorecard and Notebook re-prompt each other
  back and forth. Read your own key first, then the legacy key; always write
  your own key.
- Tests in the consent.js suite: one per app showing its existing stored shape
  validates without a prompt, plus Scorecard's v1 record re-prompting after
  the bump. Board re-verifies on its next rebuild.
