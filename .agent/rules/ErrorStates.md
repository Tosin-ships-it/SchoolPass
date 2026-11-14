---
trigger: always_on
---

# RULES_ERROR_STATES.md

## Job
Hold cross-feature error messages and fallback wording.

## Rule 1. The Ask the Office fallback is one message
The exact wording is: "I couldn't find an approved answer to this. You can ask the school office."
The fallback button is labeled "Ask the Office".
Reason: the fallback is the parent's last resort. It must read the same everywhere.

## Rule 2. The generic retry message is one message
The exact wording is: "Something went wrong. Please try again."
Reason: one message keeps the parent's expectation consistent across features.

## Rule 3. The not-a-school-day message is one message
The exact wording is: "There is no school today."
Reason: this message appears in Confirm Arrival and can appear in Ask the School.

## Rule 4. Strings live in one module
All strings in this file live in one module.
No string is written inline in a feature.
Reason: a string in two places will drift.

## Rule 5. No error reveals private data
An error message never states a student's name, ID, fee balance, or attendance status.
Every string that is shown to a parent passes through a single helper before display.
The helper rejects a string that contains a student or parent identifier.
Reason: error text is often logged, cached, and shared. It is a leak path.

## Rule 6. No silent failure
Every failure returns a message the parent can act on.
The app never hangs, never blanks, and never shows a spinner forever.
Reason: a silent failure makes the parent call the office, which is what the product is built to reduce.

## Rule 7. Ask the School approved copy
The 8 preset approved questions and answers for Ask the School, the expansion toggle strings ("more questions", "fewer questions"), the typed question box labels, and the standard records refusal copy are defined in `src/lib/errors/strings.ts`.
By default, only the first 4 suggested questions are displayed.
The toggle link displays "more questions" when collapsed and "fewer questions" when expanded.
When collapsing, any open answer in the hidden subset (questions 5 to 8) is closed immediately.
Under the suggested questions, parents can type their own question into a box with an "Ask" button. The button remains disabled until text is entered.
Until the answer system is built, submitting a typed question shows the question with the school's standard records refusal message and makes no network call.
Only one answer may be open at a time across all tapped and typed questions. Opening any question closes any currently open answer.
Reason: keeping all approved copy and behavioral constraints in one module prevents copy drift and ensures strict auditability and privacy enforcement.
