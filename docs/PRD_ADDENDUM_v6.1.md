# SchoolPass PRD Addendum v6.1 — Final

**Baseline:** SchoolPass PRD v6.0  
**Purpose:** Implementation clarification and approved amendments to PRD v6.0.

This addendum supersedes only the sections and rules explicitly amended below. All other PRD v6.0 requirements remain unchanged.

### Requirement tags

- **APPROVED** — product decision approved for v1.
- **CLARIFICATION** — resolves ambiguity or contradiction in PRD v6.0.
- **ENGINEERING** — implementation detail; agent may choose the implementation.
- **DEFAULT** — defined behavior for v1 unless explicitly changed.

If this addendum conflicts with PRD v6.0, this addendum takes precedence for the sections it explicitly amends.

The implementation agent must not introduce functionality outside PRD v6.0 and this addendum.

---

# 1. Approved Amendments

The following product decisions are approved for v1:

1. **Attendance:** A successful parent arrival confirmation creates a PRESENT `AttendanceRecord` unless staff have already recorded attendance for that student and date. Staff can correct attendance at any time.
2. **Fees:** Unpaid fees accumulate across terms. Parents see and can pay the total outstanding balance, with a breakdown by term.
3. **Leavers:** When a student leaves, parent access to that student's records ends immediately, even if a balance remains.
4. **Unlinked parents:** Verified parents who have not yet been linked to a student may use Ask the School and Ask the Office, but cannot access student-specific features.
5. **Parent registration:** Parents self-register with name, email and password, verify their email, then wait for Staff/Admin to link them to their child or children.
6. **Automated reminders:** Deferred entirely from v1. No reminder email, SMS, scheduled reminder job or reminder provider is required.
7. **AI cost control:** v1 uses the provider's free tier. No monetary AI budget is required. A required global daily AI usage cap protects the application. A monthly monetary ceiling applies only if paid billing is ever enabled.
8. **AI retention:** Normal Ask the School questions and answers are not stored. Reported answers are stored temporarily for review and then deleted.
9. **Fee entry:** Staff can apply a fee charge to the whole school or a selected class, creating an individual fee entry for each applicable student. Manual per-student entry remains available for exceptions.
10. **AI quality measurement:** The pilot uses a reported-answer quality proxy rather than claiming a direct accuracy measurement.

---

# 2. Attendance

## 2.1 Attendance model

`AttendanceRecord` is the official attendance record shown in the parent and staff applications.

It supports two sources:

- `STAFF`
- `PARENT_CONFIRMATION`

A successful parent arrival confirmation creates a PRESENT attendance record with source `PARENT_CONFIRMATION`.

If a staff attendance record already exists for that student and date, the parent confirmation does not change it.

Staff can create or edit attendance for any student/date and may set:

- PRESENT
- ABSENT

Staff-set records use source `STAFF`.

There is no automatic ABSENT record simply because a student has no arrival confirmation.

A student with no attendance record for the date is considered **unresolved**, not automatically absent.

## 2.2 PRD references

References to `StaffAttendanceRecord` anywhere in the PRD mean `AttendanceRecord`.

The `AttendanceStatus` enum remains:

- `PRESENT`
- `ABSENT`

Replace the relevant PRD wording as follows:

**PRD §5.2, Staff bullet:**

> Resolve attendance: mark students PRESENT or ABSENT who have no parent arrival confirmation, and correct any attendance record (Section 10.1).

**PRD §7.1, attendance bullet:**

> Resolve and correct attendance records for students, creating or editing `AttendanceRecord` entries (PRD §10.1 as amended).

**PRD §11.3, step 5:**

> Server validates and either creates the arrival record or returns an appropriate error or already-confirmed state. When it creates the arrival record, it also creates an `AttendanceRecord` (PRESENT, source `PARENT_CONFIRMATION`) for that student and date in the same transaction, unless an attendance record already exists for that student and date, in which case the existing record is left unchanged.

**PRD §11.19, add:**

> A successful confirmation produces a PRESENT attendance record with source `PARENT_CONFIRMATION`, unless staff have already recorded attendance for that student and day. A confirmation never changes an existing staff-recorded attendance record.

## 2.3 Staff visibility

When a parent has confirmed arrival for a student and day, the Attendance screen shows a **Parent confirmed** marker with the confirmation time, even if staff have subsequently set a different attendance status.

The marker is read from `ArrivalConfirmation`.

No additional field is required on `AttendanceRecord` for this purpose.

The staff Attendance screen should allow staff to identify students who have not yet been resolved and mark them in bulk where appropriate.

## 2.4 Parent visibility

The parent attendance view shows:

- Date
- Status
- Time
- Source

Present/absent counts include attendance records created by either source.

Unresolved days are shown as **Not recorded yet**, rather than ABSENT.

---

# 3. Fees

## 3.1 Outstanding fees carry across terms

Unpaid fees are not reset when a new academic term begins.

Staff create new charges for the new term while historical charges remain intact.

Parents see one outstanding total per child with a breakdown, for example:

> **Outstanding: ₦120,000**  
> Earlier terms: ₦40,000  
> Current term: ₦80,000

The system does not copy or reset old balances.

Attendance resets according to the academic term; fees do not.

## 3.2 Fee calculation

### Outstanding total

> **Outstanding total = Charges − Offline payments − Online payments**

Where:

- **Charges** = the sum of all `FeeEntry` amounts of type `CHARGE` and `ADJUSTMENT` for terms that have started.
- `ADJUSTMENT` may be positive or negative.
- **Offline payments** = the sum of all `FeeEntry` amounts of type `OFFLINE_PAYMENT`.
- **Online payments** = for each `Payment` with status `SUCCESSFUL` or `REFUNDED`, its amount minus the total of its `CONFIRMED` refunds.
- `PENDING` and `FAILED` payments are ignored.
- `PENDING` refunds are ignored.

Charges belonging to a term that has not yet started are excluded from the outstanding balance and are not shown to parents until that term starts.

The total is computed from the underlying records and is not stored as an editable balance.

For references in the existing PRD:

- `FeeBalance` means this computed outstanding total.
- An `active fee record` means the student has at least one `FeeEntry`.

## 3.3 Payments made at the school

Cash and bank-transfer payments received outside SchoolPass are recorded by Staff or Admin as an `OFFLINE_PAYMENT` entry.

An offline payment:

- has a positive amount;
- requires a reference such as a receipt number or transfer reference;
- is not a `Payment` record;
- has no Flutterwave reference;
- is excluded from Flutterwave reconciliation;
- is not part of the Flutterwave payment state machine;
- cannot be refunded through SchoolPass.

Parents see offline payments in fee history as:

> **Payment recorded by the school**

A mistaken offline payment entry is reversed using an `ADJUSTMENT` with a note.

## 3.4 Fee entry model

Rename `FeeCharge` to `FeeEntry`.

Rename the staff **Fee Charges** screen to **Fee Entries**.

```prisma
enum FeeEntryType {
  CHARGE
  ADJUSTMENT
  OFFLINE_PAYMENT
}

model FeeEntry {
  id               String       @id @default(cuid())
  studentId        String
  termId           String
  type             FeeEntryType
  amount           Decimal      @db.Decimal(12,2)
  // CHARGE and OFFLINE_PAYMENT: greater than 0.
  // ADJUSTMENT: non-zero and may be negative.
  note             String?
  // Required for ADJUSTMENT and OFFLINE_PAYMENT.
  createdByStaffId String
  createdAt        DateTime     @default(now())

  @@index([studentId, termId])
}
```

Fee entries are immutable after creation. Corrections are represented by additional entries rather than editing historical entries.

## 3.5 Fee entry workflow

Staff can:

1. Create a charge for an individual student.
2. Apply the same charge to all students in the school.
3. Apply the same charge to all students in a selected class.
4. Review the students affected before confirming the bulk action.
5. Enter exceptions or corrections individually.

Bulk application creates one `FeeEntry` per applicable student.

---

# 4. Leavers

When Staff/Admin marks a student as having left:

- `leftAt` is recorded.
- Parent access to that student's records ends immediately.
- Existing `ParentStudent` links are retained.
- Student records are retained according to the PRD retention policy.
- The student cannot use arrival confirmation.
- The student cannot receive new parent-side fee access.

The parent's access to the student's SchoolPass records ends even if money remains outstanding.

Any remaining balance is settled through the school's process outside the parent application.

If a student's `leftAt` is cleared by Staff/Admin, normal access may be restored.

A pending online payment that completes after the student leaves is still processed and reflected in the student's records.

---

# 5. Parent Accounts and Access

## 5.1 Parent registration

1. Parent registers with name, email and password.
2. Parent verifies their email address.
3. Parent can sign in after verification.
4. Staff/Admin finds the parent by exact email address in the Guardian Links screen.
5. Staff/Admin confirms the correct parent and links the parent to one or more students.

Staff do not create parent accounts.

## 5.2 Unlinked parent access

A verified parent with no `ParentStudent` link can access:

- Profile
- Ask the School
- Ask the Office

An unlinked parent cannot access:

- Student records
- Attendance
- Arrival confirmation
- Fees
- Payments

## 5.3 Linked parent access

A linked parent may access only the students associated with that parent through `ParentStudent`.

Parent-student authorization is checked server-side on every student-specific request.

The relationship is many-to-many:

- one parent may have multiple students;
- one student may have multiple linked parents/guardians.

## 5.4 Account security

The implementation must provide:

- modern slow password hashing;
- no plaintext passwords;
- email verification before first sign-in;
- single-use, expiring password-reset links;
- hashed reset tokens;
- reset invalidates other active sessions;
- generic authentication responses that do not expose whether an account exists;
- rate limiting;
- separate parent and staff sessions;
- server-side role checks;
- server-side active-account checks;
- server-side parent-student authorization;
- no default/shared credentials.

The specific authentication library, password-hashing algorithm, session mechanism and session durations are engineering choices.

## 5.5 Parent model

The `Parent` record contains:

- name;
- unique email;
- password hash;
- `emailVerifiedAt`.

No phone number is collected or used for parent lookup in v1.

---

# 6. Ask the School — AI

## 6.1 Usage and cost controls

SchoolPass v1 is designed to operate using the AI provider's free tier.

No monetary AI budget is required for v1.

### Per-parent limit

Each parent may send a maximum of **20 Ask the School questions per day**.

The limit applies to questions sent to the AI provider.

Provider errors do not consume the parent's personal daily limit.

### Global free-tier usage cap

A required Admin-editable setting defines the maximum number of Ask the School questions sent to the AI provider per day across all parents.

- It has no hardcoded value.
- **If the cap is unset or zero, Ask the School is disabled.**
- Parents see the PRD §9.6 "temporarily unavailable" message pointing to Ask the Office.
- Admin Settings shows:
  > Ask the School is off until a daily limit is set.
- The application-level global cap is the protection against uncontrolled usage.
- The provider's quota is only a secondary backstop.
- The configured cap should remain below the provider's free-tier allowance.

Today's usage may be displayed beside the Admin setting.

PRD §17's open item **Monthly AI cost ceiling** is superseded by this section. The monetary ceiling applies only if paid billing is ever enabled.

If the provider is unavailable, its quota is exhausted, or the application global cap is reached, Ask the School returns the temporary-unavailability message and points the parent to the Ask the Office.

There are no automatic retry loops or indefinite loading states.

The global cap and personal daily limit count questions sent to the provider.

---

# 7. Ask the School — Retention and Reports

## 7.1 Normal questions

Normal Ask the School questions and answers are not stored.

Retrieved passages are not stored unless explicitly required for approved debugging.

Ask the Office content is not stored by SchoolPass; the feature opens the configured WhatsApp destination.

## 7.2 Usage data

The system may retain content-free usage data.

### Per-parent daily usage

`AiUsageDaily` stores only:

- parent;
- date;
- question count.

Rows older than 35 days may be deleted.

### Daily aggregate statistics

`AiStatsDaily` stores no parent identifier and contains:

- answered;
- not found;
- unavailable;
- limit reached;
- reported.

## 7.3 Reported answers

Every AI response carries a report token containing a server-generated signature over:

- question;
- answer;
- parent account;
- time of issue.

The token is not stored.

When a parent reports an answer, the client returns the question, answer, time of issue and signature.

The server recomputes and verifies the signature.

A report is accepted only when:

- the signature is valid;
- it belongs to the reporting parent;
- it was issued within the previous 24 hours;
- the response has not already been reported.

The question and answer stored in the report are the server-verified values, not trusted client content.

Report text is plain text and has a maximum length.

The system stores:

- question;
- answer;
- report reason;
- optional note;
- timestamp;
- review status;
- reviewer;
- review time;
- report fingerprint used to prevent duplicate reporting.

The report does not store:

- parent identity;
- retrieved passages.

Reported answers are deleted after the Admin-configured retention period.

Default retention is **90 days**.

The retention value cannot be blank or unlimited.

## 7.4 Pilot answer-quality proxy

The pilot uses:

> **(answered − reported) ÷ (answered + not found)**

Unavailable and limit-reached questions are excluded.

This is a **reported-answer quality proxy**, not a direct accuracy measurement, because an incorrect answer that is never reported is not detected.

Periodic manual sampling may be used if the pilot needs a direct assessment of answer quality.

---

# 8. Other Clarifications

## 8.1 Timezone

SchoolPass uses:

> `Africa/Lagos`

The server determines:

- today's date;
- attendance dates;
- arrival windows;
- daily AI limits;
- daily usage statistics.

Stored timestamps use UTC.

## 8.2 Arrival codes

Staff generate one arrival code for each school day.

The QR code contains a random token.

The manual fallback is a six-digit code.

The arrival code:

- is valid only during the configured arrival window;
- is scoped to the school and date;
- is server-validated;
- can be regenerated by Staff/Admin;
- causes the previous code to become invalid when regenerated.

Every arrival attempt is recorded in `AuditLog`.

Arrival attempts are rate-limited according to the configured manual-code rate limit.

## 8.3 Staff/Admin screens

The staff application includes screens/capabilities for:

- Dashboard
- Students
- Attendance
- Arrival Code
- Fee Entries
- Payments
- Approved School Information
- Guardian Links
- Ask the School reports
- Settings

A mobile staff navigation pattern such as a **More** tab may be used where necessary to avoid overcrowding.

## 8.4 Approved School Information

Parents access approved school information through Ask the School.

There is no separate parent-facing browse page for the approved-information knowledge base in v1.

## 8.5 Payments and refunds

Flutterwave payments remain subject to the original PRD payment state machine.

The addendum permits:

- partial payments;
- partial refunds;
- confirmed refunds affecting the outstanding balance.

A payment becomes `REFUNDED` only when the total of confirmed refunds equals the original payment amount.

Pending refunds do not affect the balance.

A rejected refund must not remain indefinitely as an active pending refund; the implementation must provide a way to resolve or cancel a failed refund request.

The existing PRD payment requirements remain in force unless explicitly amended here.

## 8.6 Student import

A one-time developer/administrative import may be used to populate initial student records.

This does not create a general-purpose import product in v1.

## 8.7 Scheduled work

v1 requires only:

- payment verification fallback;
- cleanup of reported answers;
- cleanup of AI usage counters.

The implementation agent chooses whether these run as scheduled jobs or on-demand checks within free-tier hosting constraints.

There is **no reminder job**.

Student-record seven-year archival/deletion is not built in v1. The PRD retention policy remains the governing policy and future implementation responsibility.

---

# 9. Data Model Changes

## 9.1 Attendance

```prisma
enum AttendanceSource {
  STAFF
  PARENT_CONFIRMATION
}

model AttendanceRecord {
  id                String           @id @default(cuid())
  studentId         String
  date              DateTime
  time              DateTime?
  status            AttendanceStatus
  source            AttendanceSource
  recordedByStaffId String?
  createdAt         DateTime         @default(now())

  @@unique([studentId, date])
}
```

`arrivalConfirmationId` is not stored on `AttendanceRecord`.

`ArrivalConfirmation` remains the source for the parent-confirmed marker and confirmation time.

## 9.2 Fee entries

```prisma
enum FeeEntryType {
  CHARGE
  ADJUSTMENT
  OFFLINE_PAYMENT
}

model FeeEntry {
  id               String       @id @default(cuid())
  studentId        String
  termId           String
  type             FeeEntryType
  amount           Decimal      @db.Decimal(12,2)
  note             String?
  createdByStaffId String
  createdAt        DateTime     @default(now())

  @@index([studentId, termId])
}
```

## 9.3 AI reports

```prisma
enum ReportStatus {
  OPEN
  REVIEWED
}

enum ReportReason {
  WRONG
  OUTDATED
  NO_ANSWER
  OTHER
}

model AnswerReport {
  id           String       @id @default(cuid())
  question     String
  answer       String
  reason       ReportReason
  note         String?
  fingerprint  String       @unique
  status       ReportStatus @default(OPEN)
  createdAt    DateTime     @default(now())
  reviewedById String?
  reviewedAt   DateTime?
}
```

## 9.4 AI usage

```prisma
model AiUsageDaily {
  id            String   @id @default(cuid())
  parentId      String
  date          DateTime
  questionCount Int

  @@unique([parentId, date])
}
```

```prisma
model AiStatsDaily {
  id           String   @id @default(cuid())
  date         DateTime @unique
  answered     Int
  notFound     Int
  unavailable  Int
  limitReached Int
  reported     Int
}
```

## 9.5 Arrival codes

```prisma
model ArrivalCode {
  id          String   @id @default(cuid())
  date        DateTime
  qrTokenHash String
  manualCode  String
  createdAt   DateTime @default(now())
  expiresAt   DateTime

  @@unique([date])
}
```

Regeneration replaces the active code for that date.

## 9.6 Student leaver field

`Student` includes:

```text
leftAt DateTime?
```

The existing enrollment status remains `Active` for v1.

A student with a non-null `leftAt` cannot be accessed through parent student features.

---

# 10. Configuration Sources

SchoolPass has one source of truth for each configurable value.

### Layer 1 — Product requirements

PRD v6.0 and this addendum define product behavior.

### Layer 2 — Fixed invariants

Security and system invariants are fixed in code.

### Layer 3 — Constants

Examples:

- per-parent AI daily limit;
- manual-code rate limit;
- refund window;
- webhook fallback and stuck-payment timeouts;
- re-embedding window;
- student-record retention period.

### Layer 4 — Admin settings

The following are Admin-configurable:

- current term and dates;
- school days and holidays;
- arrival window;
- Front Desk number;
- minimum partial payment;
- overpayment on/off;
- global AI daily cap;
- reported-answer retention days.

At initial setup, Layer 4 values may be initialized from corresponding `RULES_*.md` values.

After initialization, the Admin-edited database value is the only runtime source of truth.

The application must not read the `RULES_*.md` value again at runtime.

### Layer 5 — Secrets

Production credentials and secrets remain environment variables.

---

# 11. Defaults

The following are v1 defaults:

1. Staff-set attendance records are never overwritten by a parent confirmation.
2. There is no automatic ABSENT status; unresolved attendance is shown as **Not recorded yet**.
3. Partial refunds are supported according to the refund rules in Section 8.5.
4. There is no parent-facing browse page for approved school information.
5. Students and Fee Entries screens are included in the staff application.
6. Charges for terms that have not started are excluded from the current balance.
7. The global AI cap counts questions sent to the provider per day.
8. Reported answers are retained for 90 days by default.
9. Ask the School displays a notice advising parents not to enter sensitive personal information.

Bulk fee application by school/class is the approved v1 fee-entry workflow, with individual entry available for exceptions.

---

# 12. What Blocks What

## Product decisions

No unresolved product decision blocks the core implementation once this addendum is approved.

The approved fee-entry method must be implemented before the fee-entry screens are finalized.

## Implementation dependencies

These are not product decisions:

- Owner confirms environment variable names before environment files are created.
- `RULES_*.md` files are present, including the AI relevance threshold in `RULES_AI.md`.
- Development database or stub.
- Gemini development key and model IDs.
- Flutterwave test keys.
- Email development stub.

## Launch configuration

The following must be configured before production:

- global AI daily cap;
- reported-answer retention days;
- current academic term and dates;
- school days and holidays;
- arrival window;
- Front Desk number;
- minimum partial payment;
- overpayment setting;
- student records;
- opening fee balances;
- G-3 and G-4 targets;
- school's prelaunch inquiry baseline.

Ask the School remains disabled until the global AI daily cap is set.

## Production credentials and provider setup

Before production:

- production database and hosting variables;
- live Flutterwave keys;
- registered Flutterwave webhook URL;
- email provider with verified sender domain;
- production Gemini key confirmed to be on the intended free tier;
- provider data-use terms reviewed;
- first Admin account created.

## School process

The school must define how staff verify that a person is a child's guardian before linking the parent to a student.

## Not applicable in v1

The following are explicitly not required for v1:

- monthly AI monetary cost ceiling;
- automated reminders;
- SMS provider;
- automated seven-year student-record deletion;
- parent phone collection;
- parent-facing approved-information browse page.

---

# 13. Scope Guard

The implementation agent must not introduce:

- multi-school support;
- social feeds;
- parent-to-parent communication;
- teacher messaging;
- live classes;
- homework;
- exams/results/grades;
- bus tracking;
- GPS tracking;
- push notifications;
- native mobile applications;
- AI academic advice;
- medical or disciplinary records;
- biometrics;
- multi-turn AI conversations;
- additional attendance statuses beyond PRESENT/ABSENT;
- additional enrollment statuses beyond the existing v1 requirement.

Any requirement not present in PRD v6.0 or this addendum must be treated as out of scope unless explicitly approved by the product owner.
