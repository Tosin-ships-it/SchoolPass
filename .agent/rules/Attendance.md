---
trigger: glob
description: Load when the task touches attendance records, term configuration, session dates, or rollover. Load when the task involves the `StaffAttendanceRecord` model. If unsure, load.
globs: src/lib/attendance/**/*.ts
---

# RULES_ATTENDANCE.md

## Job
Hold the term and session configuration, rollover behavior, and the source of truth rule.

## Rule 1. Source of truth
Staff-recorded attendance is the attendance record.
A parent arrival confirmation is logged separately with source `parent_confirmation`.
A parent confirmation never overwrites a staff-recorded record.
Reason: two records can disagree. One must win. The school's record wins.

## Rule 2. Attendance status is closed
Attendance status is `PRESENT` or `ABSENT` only.
No other status exists in v1.
Reason: a wider status set changes every display and every figure. It is a v2 decision.

## Rule 3. Staff time entry
Staff enter present or absent.
Staff do not enter a specific arrival time.
The `time` field is nullable and is filled only from a matching arrival confirmation.
Reason: a specific time is not required to record presence.

## Rule 4. Term and session
The school uses three terms per session: First Term, Second Term, Third Term.
Admin sets the current term and the session start and end dates through the Staff and Admin Interface.
Reason: attendance and fee figures are meaningless without a term.

## Rule 5. Figures reflect the current term
Attendance figures shown to a parent reflect the current term only.
The parent can view prior terms in history.
Reason: a running total across all terms hides the current term.

## Rule 6. Rollover
At term rollover, attendance and fee figures reset to the new term.
Prior term data is retained and viewable in history.
No prior term data is deleted at rollover.
Reason: historical records are needed for retention and for disputes.

## Rule 7. Arrival confirmations at rollover
Arrival confirmations remain on their original date.
They are not moved or re-tagged.
Reason: a confirmation is evidence about a specific day.

## Rule 8. Parent confirmation without a staff record
When a parent confirms arrival and no staff record exists, the attendance view shows the parent confirmation as a separate row with source `parent_confirmation`.
No staff record is created.
Reason: the parent action is not the school's record.

## Rule 9. One record per student per day
The `StaffAttendanceRecord` table has a unique constraint on student and date.
Reason: two attendance records for one day for one student have no defined meaning.

## Rule 10. Who records attendance
Only Staff and Admin record staff attendance.
A parent cannot record staff attendance.
Reason: staff attendance is the school's record.

## Rule 11. Editing an existing day
A teacher opening attendance for a day with existing records sees the existing records and can edit them.
Reason: mistakes happen and must be correctable.