---
trigger: always_on
---

# RULES_PRIVACY.md

## Job
Hold the boundary between shared school information and private records, the server-side check, and the module import rule.

## Rule 1. Two categories
Shared school information applies to everyone. It has no student ID and no parent ID.
Private records apply to one student. They have a student ID.
Reason: the line between the two is the product's core promise.

## Rule 2. The AI reads only shared information
`ApprovedSchoolInfo` holds shared information only.
It has no foreign key or relation to any student, guardian, attendance, arrival, or payment table.
The AI module reads only from `ApprovedSchoolInfo`.
Reason: the AI can only leak what it can read.

## Rule 3. Vector store schema
The vector store schema contains only fields that come from `ApprovedSchoolInfo`.
It contains no `studentId`, no `parentId`, no fee field, and no attendance field.
Reason: a copy of a private record is a second place to leak it.

## Rule 4. Private records are read from the database
Fee balances, payment records, and arrival records are read directly from the database.
They are never embedded, indexed, or copied into the vector store.
See `RULES_AI.md` Rule 2.
Reason: a copy is a leak path.

## Rule 5. Every read is checked
Every read of a private record passes a server-side check that the authenticated parent has an active `ParentStudent` link to that student.
A failed check returns 403 and is logged.
See `RULES_AUTH.md` Rule 2 and Rule 9.
Reason: the check is the only gate between a parent and a child's records.

## Rule 6. Module boundary
The AI module must not import the student, attendance, arrival, or payment modules.
The AI module imports only the approved information module.
A shared utility is placed in a module that neither the AI module nor the private-record modules own. Both may import it. It holds no private data.
Reason: an import is a path for data. Blocking the import blocks the path.

## Rule 7. No private data in logs or errors
Logs and error messages never contain fee balances, payment amounts, student or parent names, student IDs, attendance status, or session tokens.
See `RULES_LOGGING.md` Rule 2 and `RULES_ERROR_STATES.md` Rule 5.
Reason: logs and errors are copied, cached, and shared.

## Rule 8. Retention applies to private records
The retention rules in `RULES_RETENTION.md` apply to private records.
Reason: compliance covers private records, not only shared information.

## Rule 9. Schema change review
A schema change that adds any relation to `ApprovedSchoolInfo` is rejected in review.
The agent does not write it.
The user must approve it and record it in `RULES_DATA_MODEL.md`.
Reason: the boundary is structural. A relation is how it breaks.

## Rule 10. Change control
Any change that touches the boundary between shared and private data requires user approval.
The agent stops and asks.
Reason: the boundary is the one thing the product cannot get wrong.