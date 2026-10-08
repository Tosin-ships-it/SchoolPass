# SchoolPass AGENTS.md

# SchoolPass

## Description
SchoolPass is a private web app for parents and guardians of a single school.
It gives parents one place to ask school questions, view their child's records, confirm daily arrival, pay fees, and reach the school office.
The Staff and Admin Interface lets Staff update `ApprovedSchoolInfo`, record manual attendance, display the daily arrival QR and manual code, verify payments, and review reported AI answers. Admin has all Staff capabilities plus school configuration, staff accounts, approved information, payment configuration, access permissions, guardian links, the Front Desk Officer WhatsApp number, and operational settings.

## Product Promise

> The school's answers. Your child's records. One place.

## Definition of Reliable

The app stays available during school hours.
The AI answers approved-information questions correctly without escalation at a rate the school accepts.
Uptime target: 99 percent per month during school hours. Configurable.
AI accuracy target: 70 percent of pilot questions answered without escalation. Configurable.

## Who uses it

**Parent/Guardian**
Registered adult linked to one or more students. Uses the parent-facing web app.
A student can have more than one linked guardian.
All linked guardians can view attendance and fee status by default.
Only Staff or Owner/Admin can add or remove a guardian link.

**School Staff**
Uses the Staff and Admin Interface.
Updates approved school information, records manual attendance, displays the daily arrival QR and manual code, verifies payments, reviews reported AI answers.

**Owner/Admin**
Uses the Staff and Admin Interface.
Has all Staff capabilities plus school configuration, staff accounts, approved information, payment configuration, access permissions, guardian links, Front Desk Officer WhatsApp number, and operational settings.

## Read order for rules files
The agent reads files in this order.
1. `AGENTS.md` (this file).
2. `RULES_FOLDER_MAP.md`.
3. `RULES_ENV.md`.
4. `RULES_DATA_MODEL.md`.
5. `RULES_AUTH.md`.
6. `RULES_COMMANDS.md`.
7. `RULES_LOGGING.md`.
8. `RULES_CONFIG.md`.
9. `RULES_ERROR_STATES.md`.
10. `RULES_AI.md`.
11. `RULES_PAYMENTS.md`.
12. `RULES_ARRIVAL.md`.
13. `RULES_ATTENDANCE.md`.
14. `RULES_RETENTION.md`.
15. `RULES_STAFF_UI.md`.
16. `RULES_PRIVACY.md`.
Reason: when two files could be read as conflicting, the file read later wins.

## One thing the agent must do well
Read `RULES_PRIVACY.md`. It is the core promise of the product. The boundary between shared school information and private student records is the one thing that must never break.

## Defined Scope for the MVP

**F-1 Ask the School**
Answer parent questions using only `ApprovedSchoolInfo`.
Single question and answer. No memory of earlier questions in the same session.
Answer only when the top retrieved passage clears the configured relevance threshold.
Below the threshold, return the not-found response and offer Ask the Office.
Every answer supports Report an incorrect answer.

**F-2 My Child's Records**
Show attendance, fee balance, and enrollment status for linked students.
Attendance shows figures for the Admin-configured current term and session. Every figure states its time window.
The table shows date, status, time, and source.
Staff-recorded attendance is the source of truth.
Arrival confirmation is logged separately with source `parent_confirmation` and does not overwrite the attendance record.
Fee balance is in Nigerian Naira and comes from the `FeeBalance` record.
Enrollment status in v1 shows Active only.

**F-3 Confirm Arrival**
Parent confirms arrival with a QR code or a manual code.
Codes are generated and displayed by Staff at the school gate.
The QR is scoped to the current school day and arrival window. It is not sent to individual parents.
Server validates code, school, window, expiry, `ParentStudent` link, and duplicate before creating a record.
A duplicate attempt returns the existing record and does not create a new one.
Unique constraint on student and date.
Confirm Arrival is disabled on non-school days. The parent sees a message that there is no school today.

**F-4 Pay Fees**
Parent views the outstanding balance from the `FeeBalance` record and pays through Flutterwave in Nigerian Naira.
The AI is never used to calculate, estimate, or state a balance.
Server creates a `Payment` record with status `Pending` before redirecting to Flutterwave.
Server verifies the payment with Flutterwave both on return and independently via webhook. The return URL and query parameters never mark a payment successful.
Webhook verifies the signature before processing. Receiving the same event twice does not double-update the balance.
Balance changes only after verified success.
Refunds are recorded, cannot exceed the original payment amount, and only increase the balance after Flutterwave confirms. Refund policy is configurable.

**F-5 Ask the Office**
Parent routes unanswered questions to the Front Desk Officer through WhatsApp.
One configured Front Desk Officer number per school. If no number is configured, the parent sees a message and the Owner/Admin is prompted to configure it.
Parent does not choose the contact.
SchoolPass never claims the message was delivered, read, or answered.

**Staff and Admin Interface**
Provides exactly the capabilities in PRD 7.1 and 7.2. Does not add teacher messaging, staff chat, or any capability not in those lists.
Screen layouts and navigation are defined in Section 18 of the PRD.

**Account and Access**
Parent-to-student links are created only by Staff or Admin.
Self-service linking is never allowed.
Parent, Staff, and Admin accounts are separate and authenticated separately. Each supports password reset using a verified email or phone on file. Recovery method is configurable.

## Not in scope for the MVP
Student social feeds.
Parent-to-parent chat.
Teacher messaging.
Live video classes.
Homework management.
Examination results.
Student grades.
School bus tracking.
GPS or location tracking.
Push notifications.
Native mobile app.
Multi-school accounts.
Teacher marketplace.
AI-generated academic advice.
Medical records.
Discipline records.
Biometric identification.
Parent-to-staff enquiry threads outside the Front Desk Officer WhatsApp flow.
Multi-turn AI conversation.
Attendance status other than PRESENT or ABSENT.
Enrollment status other than Active.

## Stack
Next.js
TypeScript
Prisma
PostgreSQL, hosted on Neon
pgvector
Vercel for hosting
Gemini embeddings
Gemini Flash for answer generation
Flutterwave for payments

## Folder map
The confirmed folder structure lives in `RULES_FOLDER_MAP.md`.
Do not invent a folder structure.
When a file path is needed and `RULES_FOLDER_MAP.md` does not exist, stop and ask the user. Do not create a path.

## How to work

**One change at a time.**
One change means one file, one purpose, one review.
Make the change, stop, and wait for the user.
Do not bundle unrelated edits.

**Ask before adding packages.**
Ask the user before installing any package.
Do not install until the user replies.
List the package name, version, and reason.

**Never touch the database directly.**
Do not run migrations.
Do not run seed scripts.
Do not run raw SQL.
Do not edit the Prisma schema file.
Do not run any Prisma CLI command that changes the database.
Any schema change must be requested from the user and recorded in `RULES_DATA_MODEL.md` first.

**End every response with an Assumptions section.**
If there are none, write `Assumptions: none.`
Do not leave the section out.

**Stop and ask when the PRD is silent.**
If the PRD does not state a fact the agent needs, stop.
Do not proceed until the user replies.
Record the user's answer in the named rules file before continuing.

**Server-side enforcement.**
Every rule with real consequences is enforced on the server.
Client-side checks are convenience only.

**No private data to the AI.**
Never pass fee balances, payment records, arrival records, or any student-linked data to the AI as context.

## Where the detailed rules live
`RULES_FOLDER_MAP.md` holds the confirmed folder structure.
`RULES_ENV.md` holds environment variable names.
`RULES_DATA_MODEL.md` holds Prisma models, enums, fields, unique constraints, and relations.
`RULES_AUTH.md` holds authentication rules, session rules, the parent-to-student check, the linking mechanism, and account recovery.
`RULES_CONFIG.md` holds configurable values that do not belong to a single feature.
`RULES_ERROR_STATES.md` holds cross-feature error messages and fallback wording.
`RULES_LOGGING.md` holds what is logged and what is never logged.
`RULES_COMMANDS.md` holds allowed and forbidden commands, including git.
`RULES_AI.md` holds the AI boundary, threshold, limits, and cost ceiling.
`RULES_PAYMENTS.md` holds Flutterwave rules, payment states, webhook rules, refunds, and timeouts.
`RULES_ARRIVAL.md` holds the arrival window, rate limit, and code validity.
`RULES_ATTENDANCE.md` holds term and session configuration and the source of truth rule.
`RULES_RETENTION.md` holds retention and deletion for departed students.
`RULES_STAFF_UI.md` holds the Staff and Admin Interface screen list and navigation.
`RULES_PRIVACY.md` holds the boundary between shared information and private records and the module import rule.

## Definitions

**Record.** A row of data in the database. Examples: attendance record, payment record, arrival confirmation.

**Passage.** A unit of retrieved text from `ApprovedSchoolInfo`. The PRD uses `passage`, not `chunk`. If a library or doc uses `chunk`, treat it as a passage.

**ApprovedSchoolInfo.** The only table the AI ingestion pipeline may read. It holds approved school information. It has no foreign key or relation to any student, guardian, attendance, arrival, or payment table.

**ParentStudent link.** The link between a parent account and a student. Only Staff or Owner/Admin can create or remove it. It is the only authorization path from a parent to a student record.

**Front Desk Officer.** The single configured WhatsApp contact for parent questions that SchoolPass cannot answer.

**Source of truth.** For attendance, staff-recorded attendance. For payment status, server-side verification against Flutterwave. For fee balance, the `FeeBalance` record in the database.

**Current term and session.** The active school term configured by Admin. Attendance and fee figures reflect this term.

**Configurable.** A value the PRD intentionally leaves undefined. It must be set by the school or product owner before launch. It is recorded in the rules file for its feature, or in `RULES_CONFIG.md` when it spans features.

## Cross-feature rules
Every feature requires an authenticated session. No feature exposes student, attendance, arrival, or payment data to an unauthenticated request.
Every action tied to a specific student requires a server-side check that the authenticated parent has an active `ParentStudent` link to that student. This check is never trusted from the client.
Any child selector in the UI is a convenience, not a security boundary. The server independently verifies the selected child belongs to the requesting parent on every request.
SchoolPass is single-school. Every record, code, and query is scoped to the one configured school.
Arrival confirmations, payment attempts, and AI wrong answer reports are logged so staff can review what happened and when.