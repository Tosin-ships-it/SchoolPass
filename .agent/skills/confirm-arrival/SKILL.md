---
name: confirm-arrival
description: Validate an arrival code and create the arrival confirmation. Use when building or debugging Confirm Arrival.
---

# Confirm Arrival

## Job
Validate one arrival request and create one `ArrivalConfirmation` record.

## Steps

1. Receive the request at `POST /api/arrival/confirm`.
2. Confirm the session is authenticated. If not, return 401 and stop.
3. Read `studentId`, `code`, and `method` from the request body.
4. Confirm the parent has an active `ParentStudent` link to `studentId`. If not, return 403 and log.
5. Confirm the current date is a configured school day. If not, return the not-a-school-day message.
6. Confirm the current server time is inside the arrival window. If not, return the window-closed message.
7. Look up the `ArrivalCode` for the school and current day.
8. Compare the submitted code to the stored code. If not equal, rate-limit the attempt and return the invalid-code message.
9. Look up any existing `ArrivalConfirmation` for `studentId` and today.
10. If one exists, return the existing record with its time and method.
11. If none exists, create the record with `status` set to `CONFIRMED`.
12. Set `method` to `QR` or `MANUAL_CODE` based on the request.
13. Set `time` to the current server time.
14. Save the record.
15. Write a log entry with actor, student, method, and outcome.
16. Return the record.

## Rules to follow
- Follow `RULES_ARRIVAL.md` Rule 3. The server decides validity.
- Follow `RULES_ARRIVAL.md` Rules 4 and 5 for the arrival window.
- Follow `RULES_ARRIVAL.md` Rule 7. One confirmation per student per day.
- Follow `RULES_ARRIVAL.md` Rule 9. Always verify the parent-to-student link.
- Follow `RULES_AUTH.md` Rule 2. The link check is server-side.
- Follow `RULES_ATTENDANCE.md` Rule 8. Do not create a staff attendance record.

## Done when
The response contains the created or existing confirmation and the log entry exists.