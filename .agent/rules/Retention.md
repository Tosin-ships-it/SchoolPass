---
trigger: glob
description: Load when the task touches student departure, archiving, deletion, or data retention. Load when the task mentions NDPR or compliance. If unsure, load.
globs: src/lib/retention/**/*.ts
---

# RULES_RETENTION.md

## Job
Hold the retention period and deletion process for departed students.

## Rule 1. Retention period
When a student leaves the school, their records are retained for the configured period.
Current setting: 7 years, consistent with NDPR retention guidance (PRD Section 14, Section 17). After 7 years, records are archived and then deleted on a schedule set by Admin.
Reason: retention is a compliance decision under NDPR.

## Rule 2. What is retained
Attendance records.
Arrival confirmations.
Payment history.
Reason: these records are needed for a dispute, an audit, or a school transfer.

## Rule 3. What archive means
Archive means the record is moved to a separate table that the app does not query in normal operation.
The record is not visible to parents or Staff after archiving.
Reason: archive must be a defined state, not a vague word.

## Rule 4. Deletion after the period
After the retention period, records are archived and then deleted on a schedule set by Admin.
The agent does not delete records on its own.
Reason: deletion is irreversible. It needs a human trigger.

## Rule 5. No early deletion
No record is deleted before the retention period ends.
Reason: an early delete destroys data the school may be required to keep.

## Rule 6. No indefinite retention
No record is kept after the retention period without an explicit Admin decision.
Reason: keeping data forever increases the cost of a breach.

## Rule 7. Who can trigger archive or delete
Only Admin can trigger archive or delete.
The agent builds the trigger but never runs it.
Reason: a retention action is a policy action.

## Rule 8. Parent deletion request
A parent data deletion request is handled by Admin.
It does not override the retention period for records the school is required to keep.
Reason: a parent cannot override a compliance obligation.

## Rule 9. The departed student's links
When a student leaves and the retention period ends, the student's `ParentStudent` links are removed.
Reason: an active link to a departed student has no purpose and keeps a door open.

## Rule 10. Log retention is separate
Log retention is set in `RULES_LOGGING.md` and `RULES_CONFIG.md`.
This file does not cover logs.
Reason: two retention policies in one file will be confused.