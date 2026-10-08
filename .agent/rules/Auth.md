---
trigger: always_on
---

# RULES_AUTH.md

## Job
Hold authentication, session, parent-to-student authorization, linking, and account recovery rules.

## Rule 1. Separate accounts
Parent, Staff, and Admin accounts are separate.
A parent account cannot access the Staff and Admin Interface.
A Staff account cannot access the parent app as a parent.
Reason: the two surfaces have different capabilities. Mixing them leaks staff capability to a parent.

## Rule 2. Parent-to-student check is server-side
Every request for a private student record passes a server-side check that the authenticated parent has an active `ParentStudent` link to the requested student ID.
The check is not performed in the UI alone.
The client never decides the check.
Reason: a client check can be bypassed. The server is the only gate.

## Rule 3. Link creation
A `ParentStudent` link is created only by Staff or Admin through the Staff and Admin Interface.
No parent self-service linking exists.
Reason: self-service linking would let an adult claim a child who is not theirs.

## Rule 4. Link removal
A link is removed only by Staff or Admin.
Removal is logged.
Reason: the log is how the school investigates a dispute about access.

## Rule 5. Session token
The session token is stored in an httpOnly cookie.
The token expires after a period set by the user and recorded in `RULES_CONFIG.md`.
Reason: an httpOnly cookie cannot be read by client JavaScript. This reduces the impact of an XSS bug.

## Rule 6. Login
Login is rate-limited per account and per IP.
Reason: an unthrottled login endpoint can be brute forced.

## Rule 7. Password rules
Minimum length and password reuse rules are set by the user and recorded in `RULES_CONFIG.md`.
Reason: password policy is a school decision, not an engineering one.

## Rule 8. Password reset
Password reset uses a single method set by the user and recorded in `RULES_CONFIG.md`.
The method is one of: email link or SMS code. Not both in v1.
A successful reset invalidates all existing sessions for the account.
Reason: one method is simpler to secure. Invalidating sessions closes a stolen-session window.

## Rule 9. Failed check behavior
A failed parent-to-student check returns 403 and writes a log entry.
The response does not reveal whether the student exists.
Reason: revealing existence leaks which IDs are real.