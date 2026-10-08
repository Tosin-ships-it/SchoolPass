---
name: record-staff-attendance
description: Record staff attendance for a student for a school day. Use when a teacher or admin marks attendance.
---

# Record Staff Attendance

## Job
Create or update one `StaffAttendanceRecord` for one student on one school day.

## Steps

1. Confirm the current date is a configured school day.
2. Look up the student and confirm the student is active.
3. Look up any existing `StaffAttendanceRecord` for this student and date.
4. If a record exists, load it for editing.
5. If no record exists, prepare a new record.
6. Set `status` to `PRESENT` or `ABSENT`. No other value.
7. Set `recordedByStaffId` to the current staff user ID.
8. Leave `time` null. Do not enter a time by hand.
9. Save the record.
10. Confirm the record appears on the parent's F-2 attendance view for the current term.

## Rules to follow
- Follow `RULES_ATTENDANCE.md` Rule 1. Staff attendance is the source of truth.
- Follow `RULES_ATTENDANCE.md` Rule 2. Status is closed.
- Follow `RULES_ATTENDANCE.md` Rule 3. The `time` field is nullable.
- Follow `RULES_ATTENDANCE.md` Rule 9. One record per student per day.
- Follow `RULES_LOGGING.md` Rule 1. Log the change with actor and time.

## Done when
The record is saved with the correct status and source, and the parent view reflects it.