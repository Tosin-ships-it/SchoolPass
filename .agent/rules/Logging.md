---
trigger: always_on
description: Load when writing code that logs an event, handles a failure, or reports an error. Load when the task mentions logs, audit, or event records. If unsure, load.
---

# RULES_LOGGING.md

## Job
Hold what is logged, what is never logged, and where logs go.

## Rule 1. What is logged
- Every arrival confirmation attempt, successful or not.
- Every payment attempt and every payment state change.
- Every failed parent-to-student authorization check.
- Every AI wrong answer report.
Reason: these events are needed to investigate a dispute, a refund, or a leak.

## Rule 2. What is never logged
- Fee balances.
- Payment amounts.
- Student names, student IDs, parent names, parent emails, parent phone numbers.
- Attendance status.
- Session tokens.
Reason: a log is a second copy of sensitive data. A leak in a log is a leak in the system.

## Rule 3. Log format
A log entry is structured JSON with fields: timestamp, level, event, actorType, actorId, entityType, entityId, outcome.
An ID in a log is the record's CUID. No other identifier is used.
Reason: structured logs can be searched. A CUID does not identify a person by itself.

## Rule 4. Log levels
Only three levels are used: info, warn, error.
No debug level in production.
Reason: a debug level in production leaks detail that was not reviewed.

## Rule 5. Where logs go
Logs go to the hosting platform's log system.
The agent does not build a log storage table in the database in v1.
Reason: the PRD does not ask for a log table. Adding one adds schema and retention obligations.

## Rule 6. Log write failure
A failed log write does not break the request.
The request continues and the failure is reported through the hosting platform's own error channel.
Reason: logging must not take down the app.

## Rule 7. Log retention
Log retention is set by the user and recorded in `RULES_CONFIG.md`.
Reason: retention is a compliance decision, not an engineering one.

## Rule 8. Log access
Logs are readable by Owner or Admin only.
Staff read audit information through the Staff and Admin Interface, not through the log system.
Reason: raw logs contain technical detail that Staff do not need.