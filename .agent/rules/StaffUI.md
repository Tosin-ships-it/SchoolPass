---
trigger: glob
description: Load when the task touches a screen, form, or page in the Staff and Admin Interface. Load when the task adds or edits a Staff capability. If unsure, load.
globs: src/app/(staff)/**/*.tsx
---

# RULES_STAFF_UI.md

## Job
Hold the Staff and Admin Interface screen list and navigation model.

## Rule 1. Screens
The interface has exactly these screens. No other screen is added without user approval.
- Approved info list and edit (`ApprovedSchoolInfo`).
- Attendance entry (`StaffAttendanceRecord`).
- Arrival code display (daily QR and manual code).
- Payment verification (`Payment`, `Refund`).
- Wrong answer reports.
- School settings, including current term and session.
- Staff accounts.
- Guardian links (`ParentStudent`).
- Front Desk Officer WhatsApp number.
Reason: the PRD fixes the capabilities. Extra screens add scope.

## Rule 2. Role to screen mapping
A Staff account sees only the screens its role has.
The role to screen mapping is recorded here.
Reason: least privilege reduces the impact of a compromised staff account.

## Rule 3. Navigation
Desktop: left sidebar.
Mobile: bottom tab bar.
Reason: two surfaces need two patterns. A single pattern fails on one.

## Rule 4. Layout is not fixed here
Exact layout and visual design are implementation decisions.
The agent asks the user before building a screen and records the decision here.
Reason: layout is a user decision, not a PRD fact.

## Rule 5. Staff do not see what Staff do not need
A Staff screen shows only what the capability requires.
Staff do not see the full audit log.
Staff do not see another staff member's permissions.
Reason: least privilege.

## Rule 6. Staff actions are logged
Every Staff action that changes data is logged.
The log records the staff ID, the action, and the time.
See `RULES_LOGGING.md`.
Reason: the school must be able to see who changed what.

## Rule 7. Deactivation
When a Staff account is deactivated, all its sessions are invalidated immediately.
An in-flight request returns 401.
Reason: a deactivated account must lose access at once.

## Rule 8. Validation error display
A validation error returned by the server is shown next to the field that caused it.
If no field is identified, the error is shown at the top of the form.
Reason: a visible error is fixable. An invisible one is not.

## Rule 9. No parent-facing wording in Staff screens
A Staff screen may use technical labels.
A parent-facing screen uses the wording in `RULES_ERROR_STATES.md`.
Reason: parents and staff are different readers.