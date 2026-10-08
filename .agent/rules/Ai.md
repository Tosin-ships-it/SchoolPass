---
trigger: glob
description: Load when the task touches Ask the School, retrieval, embeddings, vector search, or answer generation. Load when the task involves `ApprovedSchoolInfo` or the AI provider. If unsure, load.
globs: src/lib/ai/**/*.ts
---

# RULES_AI.md

## Job
Hold the AI boundary, threshold, limits, cost ceiling, and answer rules for F-1.

## Rule 1. The only source
The AI reads only from `ApprovedSchoolInfo`.
It never reads from any student, guardian, attendance, arrival, or payment table.
Reason: private records must never reach the AI.

## Rule 2. No private data in the prompt
Fee balances, payment records, arrival records, and any student-linked data are never included in the model context.
A retrieval query is the parent's question text only. No history and no metadata is added.
Reason: the prompt is sent to a third party. Anything in it is out of your control.

## Rule 3. Answer rules
1. Search `ApprovedSchoolInfo` only.
2. Retrieve relevant passages.
3. Answer only if the top passage clears the configured relevance threshold.
4. Below the threshold, return the not-found response and offer the Ask the Office fallback.
5. Never invent information not present in the source.
Reason: the product promise is the school's answers, not a plausible answer.

## Rule 4. Threshold units
Threshold units are cosine similarity on the embeddings Gemini produces.
No other metric is used.
Reason: one metric keeps the threshold checkable.

## Rule 5. Not-found response
Use the wording in `RULES_ERROR_STATES.md`.
Offer the Ask the Office fallback with it.
Reason: the fallback is the parent's path to a human.

## Rule 6. Single turn
Answer one question at a time. No memory of earlier questions.
Reason: multi-turn is a Non-Goal. Memory would let a private detail from one question leak into the next.

## Rule 7. Answer length
An answer is at most 120 words.
A longer answer is truncated at the sentence boundary.
Reason: a short answer is easier to read and cheaper to generate.

## Rule 8. Edit during answer
If an `ApprovedSchoolInfo` record is edited while a question is being answered, the answer uses the record state as of the retrieval time.
The parent sees a freshness note if the edit lands within 60 seconds.
Reason: a stale answer is worse than no answer.

## Rule 9. Configurable values
Confirmed settings from PRD v6 Section 17:
- Daily question limit: 20 questions per parent per day (PRD Section 9.6, Section 17).
- Re-embedding window: 5 minutes after an approved record change (PRD Section 9.5, Section 17).
- Passage size: 512 tokens with 50-token overlap (PRD Section 17).
- Relevance threshold: Cosine similarity on Gemini embeddings (configurable by Admin).
- Monthly cost ceiling: Request-count ceiling set by Owner/Admin.
Reason: cost and quality are the school's decisions.

## Rule 10. Re-embedding
Any edit to `ApprovedSchoolInfo` triggers re-embedding.
Re-embedding respects the provider's rate limit.
The record is flagged as updating until re-embedding completes.
The maximum delay is the provider's rate limit window, not a fixed number.
Reason: the free tier may throttle. The app must show the record as updating rather than pretend it is fresh.

## Rule 11. Provider unavailable
If the AI provider is unavailable, return the message in `RULES_ERROR_STATES.md` and offer Ask the Office.
Do not hang and do not fail silently.
Reason: the parent must always have a next step.

## Rule 12. Report an incorrect answer
Every AI response shows a Report an incorrect answer control.
Reasons: Wrong information. Outdated information. Didn't answer my question. Other.
Reports go to school staff for review.
Reason: the report is how the school finds and fixes a wrong answer.

## Rule 13. Request-count ceiling
The monthly ceiling for Ask the School is a request-count ceiling, not a money ceiling.
The value is set by Owner or Admin and recorded in `RULES_AI.md`.
When the daily free-tier cap is reached, Ask the School is paused until the cap resets.
The parent sees the Ask the Office fallback.
Reason: the free tier enforces a hard daily limit. The app must degrade gracefully when the limit is hit, not fail.