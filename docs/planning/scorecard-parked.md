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
