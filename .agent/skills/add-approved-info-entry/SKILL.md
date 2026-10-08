---
name: add-approved-info-entry
description: Add or edit a record in ApprovedSchoolInfo and trigger re-embedding. Use when the user asks to create, update, or remove approved school information.
---

# Add Approved Info Entry

## Job
Write or update one record in `ApprovedSchoolInfo` and trigger re-embedding.

## Steps

1. Ask the user for the record fields: title, body, category, owner role.
2. Confirm the category is on the allowed list from the PRD 9.2 sources.
3. Confirm the owner role is one of: Owner, Admin, Bursar, Office Staff.
4. Write the record. Set `approved` to true.
5. Set `last_updated_by` to the current user ID.
6. Set `last_updated_at` to the current time.
7. Save the record.
8. Trigger re-embedding for this record.
9. Mark the record as updating until re-embedding finishes.
10. Confirm the record is searchable in Ask the School.

## Rules to follow
- Follow `RULES_DATA_MODEL.md` for the `ApprovedSchoolInfo` fields.
- Follow `RULES_AI.md` Rule 10 for re-embedding.
- Follow `RULES_PRIVACY.md` Rule 2. Do not add any relation from `ApprovedSchoolInfo` to a student, guardian, attendance, arrival, or payment table.

## Done when
The record is saved, re-embedded, and visible in Ask the School retrieval.