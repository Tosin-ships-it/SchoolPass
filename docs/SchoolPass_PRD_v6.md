# SchoolPass Product Requirements Document

**Version:** 6.0  
**Product:** SchoolPass  
**Platform:** Parent-facing web app, with a Staff & Admin interface  
**Primary User:** Parent/Guardian  
**School Model:** Single school  
**Estimated Scale:** Approximately 400 students  
**Location:** Nigeria  
**Status:** Build-ready  

---

## 1. Product Summary

SchoolPass is a private web app for parents and guardians of a single school.

It gives parents one place to:
- Ask questions about the school
- View their child's attendance and fee records
- Confirm their child's daily arrival
- Pay school fees or outstanding balances through Flutterwave
- Contact the school's Front Desk Officer through WhatsApp when the app cannot answer their question

### Product Promise
> The school's answers. Your child's records. One place.

### Definition of "Reliable"
Reliable means the app stays available during school hours, and the AI answers approved-information questions correctly without escalation at a rate the school considers acceptable.

* **Parent app uptime during school hours:** 99 percent per month. *Configurable.*
* **AI answer accuracy without escalation:** 70 percent of pilot questions. *Configurable.*

---

## 2. Problem

Parents repeatedly contact school staff for information that should be easy to access.

Typical questions include:
- What time does school close?
- Is there school tomorrow?
- When does the next term begin?
- What uniform should my child wear?
- How much school fees do I owe?
- Has my child been marked present today?
- When is the next PTA meeting?
- How do I pay my outstanding fees?

This creates extra work for staff and makes parents rely on WhatsApp messages, phone calls, and paper notices.
Student records are private and must stay separate from general school information.

### Current State Baseline
Before launch, collect from the school:
- Number of parent inquiries per week, by channel (phone, WhatsApp, in person).
- Estimated staff hours per week spent answering repeat questions.

This baseline is needed to measure whether SchoolPass reduces staff workload after launch.

---

## 3. Goals

* **G-1 — Answer Recurring School Questions**  
  Parents can ask questions about school policies, schedules, fees, uniforms, calendars, facilities, and other approved information. Accuracy target is configurable.  
  *Language:* v1 supports English only.
* **G-2 — Give Parents Access to Their Child's Records**  
  Parents can see attendance, fee balance, and enrollment status, always sourced directly from the database.
* **G-3 — Simplify Daily Attendance Confirmation**  
  Parents confirm arrival using a QR code, with a manual code as a fallback. Adoption target is configurable. Push notifications are a Non-Goal, so the reminder is an SMS or email to the parent, chosen by the parent at onboarding.
* **G-4 — Make Fee Payment Straightforward**  
  Parents pay outstanding fees, in Nigerian Naira, through Flutterwave. Success rate target is configurable.
* **G-5 — Provide a Human Fallback**  
  When SchoolPass or the AI cannot reliably answer, the parent is routed to the Front Desk Officer through WhatsApp. The parent does not choose the contact.

---

## 4. Non-Goals

SchoolPass v1 will not include:
- Student social feeds
- Parent-to-parent chat
- Teacher messaging
- Live video classes
- Homework management
- Examination results
- Student grades
- School bus tracking
- GPS or location tracking
- Push notifications
- Native mobile app
- Multi-school accounts
- Teacher marketplace
- AI-generated academic advice
- Medical records
- Discipline records
- Biometric identification
- Parent-to-staff enquiry threads outside the Front Desk Officer WhatsApp flow
- Multi-turn AI conversation
- Attendance status other than PRESENT or ABSENT
- Enrollment status other than Active

**Trade-off note on push notifications:** Without notifications, daily engagement for Confirm Arrival depends on parent habit. This is a known adoption risk, measured against the G-3 target. The reminder is an SMS or email to the parent, chosen by the parent at onboarding. Any reminder must not be a push notification.

These items may be considered in future versions.

---

## 5. Users

### 5.1 Primary User — Parent/Guardian
A registered parent or guardian linked to one or more students.

**Multi-guardian rule:** A student can have more than one linked guardian. All linked guardians can view attendance and fee status by default. Only School Staff or the Owner/Admin can add or remove a guardian's link to a student. This is modeled as a many-to-many relationship in the database, not a single link per student. How this link is first created is defined in Section 8.1.

Parents can:
- Ask school questions
- View approved school information
- View their own linked child's private records
- Confirm attendance
- Pay fees
- Contact the Front Desk Officer

### 5.2 Secondary User — School Staff
Staff can, through the Staff & Admin Interface (Section 7):
- Update approved school information
- Maintain student records
- Record manual attendance (source of truth for the attendance record, see Section 10.1)
- Display the daily arrival QR and manual code
- Verify payments
- Review reported AI answers

### 5.3 Owner/Admin
Controls, through the Staff & Admin Interface (Section 7):
- School configuration, including the current term/session
- Staff accounts
- Approved information
- Payment configuration
- Access permissions, including guardian-to-student links
- Front Desk Officer contact configuration
- Operational settings

---

## 6. Core Product Architecture

SchoolPass has five parent-facing feature areas, supported by a Staff & Admin Interface and an account/access layer:

| Feature | Purpose |
| :--- | :--- |
| **F-1 Ask the School** | Answer school questions |
| **F-2 My Child's Records** | Show private student information |
| **F-3 Confirm Arrival** | Record daily arrival |
| **F-4 Pay Fees** | Pay outstanding school fees |
| **F-5 Ask the Office** | Human support fallback |

### Core Architectural Rule
School information and student records must remain separate. This is enforced as follows:
- The AI ingestion pipeline that feeds the vector database may only read from a table called `ApprovedSchoolInfo`.
- `ApprovedSchoolInfo` has no foreign key or relation to any student, guardian, attendance, arrival, or payment table.
- Private numeric records (fee balance, payment amounts, arrival status) are never passed to the AI as context. They are retrieved directly from the authoritative database.

### Authorization Rule
Every request for private student data must pass a server-side check confirming the authenticated parent has an active `ParentStudent` link to the requested student ID. This check happens on every API call, not only in the UI.

### Technology Direction
- Next.js
- TypeScript
- Prisma
- PostgreSQL, hosted on Neon
- pgvector, for the approved-information embedding store
- Vercel, for hosting
- Gemini embeddings, for the knowledge base
- Gemini Flash, for answer generation
- Flutterwave, for payments

---

## 7. Staff & Admin Interface

### Objective
Give Staff and Admin the tools they need to carry out the responsibilities assigned to them in Section 5.2 and 5.3. Without this interface, several parent-facing features (approved information, manual attendance, arrival codes, payment verification) have no way to be created or maintained.

### 7.1 Staff Capabilities
Through the Staff & Admin Interface, Staff can:
- Create and update entries in `ApprovedSchoolInfo` (Section 9.2).
- Record manual attendance for students, creating `StaffAttendanceRecord` entries (Section 10.1).
- Display the daily arrival QR code and manual code at the school's designated arrival point (Section 11.6).
- Review and verify payment records (Section 12).
- Review questions reported through "Report an incorrect answer" (Section 9.8).

### 7.2 Admin Capabilities
Admin has all Staff capabilities, plus:
- School configuration, including setting the current term/session (Section 10.1).
- Managing Staff accounts.
- Managing approved information.
- Managing payment configuration.
- Creating and removing `ParentStudent` guardian links (Section 8.1).
- Configuring the Front Desk Officer WhatsApp number (Section 13.6).
- Managing other operational settings.

### 7.3 Access
Staff and Admin sign in through their own authenticated accounts, separate from parent accounts. See Section 16 for the shared authentication rule.

Exact screen layouts and navigation for the Staff & Admin Interface are defined in Section 18.

---

## 8. Account & Access Management

### 8.1 Parent-to-Student Linking
A `ParentStudent` link is never created by a parent on their own. It is only created by Staff or Admin, through the Staff & Admin Interface, by directly linking a looked-up parent to a student. Staff or Admin looks up the parent account and the student, then creates the link.

Invite codes are out of scope for v1.  
Self-service linking without Staff or Admin involvement is never permitted.

### 8.2 Account Recovery
Parent, Staff, and Admin accounts each support a password reset flow.

In v1, the recovery method is an email link only. SMS code recovery is out of scope for v1.

---

## 9. F-1 — Ask the School

### Objective
Answer parent questions in natural language, using only approved school information.

### 9.1 Example Questions
> "What time does school close?"  
> "Is there school on Friday?"  
> "What uniform should Primary 4 students wear on Wednesday?"  
> "When does second term begin?"  
> "How much is the new sportswear?"  

### 9.2 Information Sources
Only content in `ApprovedSchoolInfo` may be used. Examples:
- School calendar
- Opening and closing times
- Uniform requirements
- School rules
- Fee policies
- Pickup policies
- Term dates
- PTA information
- General announcements
- School facilities
- Approved FAQs

### 9.3 Conversation Scope
Ask the School is single-question-and-answer in v1. Each question is answered independently, using only the current question text. There is no memory of earlier questions in the same session. Multi-turn conversation is a Non-Goal (Section 4).

### 9.4 Answer Rules
1. Search `ApprovedSchoolInfo` only.
2. Retrieve relevant passages.
3. Generate an answer only if the top retrieved passage clears the configured relevance threshold. If no passage clears the threshold, return the "not found" response. The system never generates a guess below this threshold.
4. Never invent information not present in the source content.
5. Clearly state when information is unavailable, and offer the Ask the Office fallback.

**Example — Information Found**
> **Parent:** "Will school close early tomorrow?"  
> **Answer:** "Yes. School closes at 1:00 PM tomorrow."

**Example — Information Not Found**
> "I couldn't find an approved notice about an early closing tomorrow."  
> **[Ask the Office]**

### 9.5 Content Freshness
Any edit to `ApprovedSchoolInfo` triggers re-embedding. Until re-embedding completes, that content is flagged as "updating" rather than served with confidence.

*Re-embedding window:* 5 minutes after an approved record change. *Configurable.*

### 9.6 Reliability and Cost Controls
- Each parent has a daily limit of 20 questions per day. *Configurable.* When a parent reaches this limit, the system shows: *"You've reached today's limit for Ask the School questions. Please try again tomorrow, or use Ask the Office."*
- If the AI provider is unavailable, the system returns: *"Ask the School is temporarily unavailable. Please use Ask the Office."* It does not fail silently or hang.
- A monthly cost ceiling is set by the Owner/Admin. Exact number is configurable and has no default.

### 9.7 Gated Information
- General information (school hours, calendar) is visible to any authenticated parent.
- Parent-specific information (fee balance, child attendance) is never answered through Ask the School. It is only shown through F-2, using the direct database lookup and authorization check defined in Section 6.

### 9.8 Report Wrong Answer
Every AI response includes:
**Report an incorrect answer**, with reasons:
- Wrong information
- Outdated information
- Didn't answer my question
- Other

Reports go to school staff for review (Section 7.1).

---

## 10. F-2 — My Child's Records

### Objective
Give parents access to their child's private school records.

### 10.1 Attendance
Attendance figures always state their time window, based on the school's currently configured term/session (set by Admin, see Section 7.2). Example:

> **Attendance — Current Term**  
> Present: 18 days  
> Absent: 2 days  

| Date | Status | Time | Source |
| :--- | :--- | :--- | :--- |
| Mon, Sep 7 | Present | 7:42 AM | Staff |
| Tue, Sep 8 | Present | 7:55 AM | Parent |
| Wed, Sep 9 | Absent | — | Staff |

**Source of truth rule:** Staff-recorded attendance is the only source for the attendance record shown here. The daily arrival confirmation described in F-3 is logged separately as a parent action and does not overwrite this record. Every attendance record stores a `source` field (`staff` or `parent_confirmation`).

**Time field:** Each attendance entry shows the time it was recorded, taken directly from the matching `ArrivalConfirmation` record (Section 11.13) when the source is `parent_confirmation`. For staff-recorded entries, the data model is defined below.

#### Staff-Recorded Attendance Data Model
```prisma
model StaffAttendanceRecord {
  id                 String           @id @default(cuid())
  studentId          String
  schoolId           String
  date               DateTime         @db.Date
  time               DateTime?
  status             AttendanceStatus
  recordedByStaffId String
  createdAt          DateTime         @default(now())

  student Student @relation(fields: [studentId], references: [id])
  school  School  @relation(fields: [schoolId], references: [id])

  @@unique([studentId, date])
}

enum AttendanceStatus {
  PRESENT
  ABSENT
}
```
Staff enter present or absent only. The `time` field is nullable. This is fixed in v1.

**Term configuration:** The school uses three terms per session: First Term, Second Term, Third Term. Admin sets the current term and session start and end dates through the Staff & Admin Interface (Section 7.2). Attendance and fee figures reflect this configured term. At rollover, attendance and fee figures reset to the new term. Prior term data is retained and viewable in history.

### 10.2 Fee Balance
> **Outstanding balance**  
> ₦85,000  

All amounts are in Nigerian Naira (NGN), the only supported currency in v1.  
The fee balance record is created and updated by Staff or Admin through the Staff & Admin Interface, and automatically by confirmed successful payments (Section 12.14).  
*CTA:* **Pay Fees**

### 10.3 Enrollment Status
> **Enrollment**  
> Active  

The only status shown in v1 is Active. Any other enrollment status is out of scope for v1.

### 10.4 Privacy Requirement
Private student records are never placed in the AI vector database. They are retrieved directly:

```
Authenticated Parent
       ↓
Server checks: does this parent have an active ParentStudent link to this student ID?
       ↓ (yes)
Authorized Student ID
       ↓
Database Record
```

If the check fails, the request is rejected and logged. This check is mandatory on every read of student data.

---

## 11. F-3 — Confirm Arrival

### Objective
Let an authorized parent or guardian confirm that their child arrived at school for the current school day, using a QR code as the primary method and a manual code as a fallback.

### 11.1 User Stories
- As a parent, I want to scan a QR code at the school gate so I can confirm my child arrived.
- As a parent whose device cannot scan, I want to type a short code instead.
- As a parent with more than one child at the school, I want to confirm arrival separately for each child.
- As a parent, I want a clear message if I try to confirm arrival twice for the same child on the same day.

### 11.2 Preconditions
- Parent is authenticated.
- Parent has at least one active `ParentStudent` link.
- Today is a configured school day, and the current time is within the configured arrival window.

*Arrival window:* 6:30 AM to 10:00 AM on a configured school day. *Configurable.*

### 11.3 User Flow
1. Parent opens Confirm Arrival.
2. If more than one linked child, parent selects the child.
3. Parent scans the QR code, or selects "Can't scan? Enter code instead."
4. Client sends the scanned or typed value to the server with the selected student ID.
5. Server validates and either creates the arrival record or returns an appropriate error or already-confirmed state.
6. Parent sees a confirmation screen.

### 11.4 Screen Requirements
- Confirm Arrival entry screen, with child selector if more than one linked child.
- QR scan screen (camera view).
- Manual code entry screen.
- Result screen: success, already confirmed, invalid or expired, or error.

### 11.5 UI States
- Loading (validating code).
- Success (arrival confirmed, shows student, date, time).
- Already confirmed (shows existing confirmation time, does not create a new record).
- Invalid or expired code (offers retry with either method).
- Network or server error (offers retry).
- Not a school day (see 11.9).

### 11.6 QR and Code Ownership
- The QR code and manual code are generated and displayed by Staff, through the Staff & Admin Interface (Section 7.1), at the school's designated arrival point.
- The QR is scoped to the current school day and arrival window, and is not sent to individual parents directly.

### 11.7 QR Behaviour
- The client reads the QR value and sends it to the server. The server decides validity, not the client.
- A QR value is not reusable past its configured validity window.

### 11.8 Manual Code Behaviour
- The manual code is displayed alongside the QR code (Section 11.6).
- It is validated the same way as the QR value: server-side, scoped to school and day, expiring with the arrival window.
- Repeated invalid attempts are rate-limited to prevent guessing. *Rate limit:* 5 attempts per parent session per 15 minutes. *Configurable.*

### 11.9 Non-School-Day Rule
On a weekend, holiday, or any day not configured as a school day, Confirm Arrival is disabled. No QR or manual code is generated for that day, and the parent sees a message that there is no school today.

### 11.10 Validation Rules
A confirmation is accepted only if all of the following are true:
- Today is a configured school day.
- The code belongs to the correct school.
- The code is within its valid time window.
- The code has not expired.
- No arrival record already exists for this student on this school day.

### 11.11 Parent-Child Authorization
- The server verifies an active `ParentStudent` link between the authenticated parent and the selected student before creating any record.
- The child selector in the UI only lists children linked to the authenticated parent. The server check is mandatory regardless of what the client sends.

### 11.12 Duplicate Prevention
- The `ArrivalConfirmation` table has a unique constraint on `(studentId, date)`.
- If a confirmation attempt is made after one already exists, the server returns the existing record rather than creating a duplicate.

### 11.13 Arrival Record / Data Model
```prisma
model ArrivalConfirmation {
  id        String        @id @default(cuid())
  studentId String
  parentId  String
  schoolId  String
  date      DateTime      @db.Date
  time      DateTime
  method    ArrivalMethod
  status    ArrivalStatus
  createdAt DateTime      @default(now())

  student Student @relation(fields: [studentId], references: [id])
  parent  Parent  @relation(fields: [parentId], references: [id])
  school  School  @relation(fields: [schoolId], references: [id])

  @@unique([studentId, date])
}

enum ArrivalMethod {
  QR
  MANUAL_CODE
}

enum ArrivalStatus {
  CONFIRMED
}
```
*Code validity window:* Same as the arrival window. Expires at 10:00 AM. *Configurable.*

### 11.14 API / Backend Requirements
- `POST /api/arrival/confirm` — body: `{ studentId, code, method }`. Requires authenticated session. Validates `ParentStudent` link, code validity, and duplicate status server-side. Returns the created or existing record.
- `GET /api/arrival/status?studentId=` — returns whether arrival has been confirmed for the student today, and if so, at what time and by which method.

### 11.15 Database Requirements
- `ArrivalConfirmation` table with foreign keys to `Student`, `Parent`, `School`.
- Unique index on `(studentId, date)`.
- Index on `(schoolId, date)` for staff-side daily arrival views.

### 11.16 Security Requirements
- All validation happens server-side.
- Codes are short-lived and scoped to school and day.
- Manual code entry is rate-limited per parent session.
- Every confirmation attempt, successful or not, is logged.

### 11.17 Error States
- **Invalid code:** "This code is not valid. Try scanning again or enter the code shown at the gate."
- **Expired code:** "This code has expired for today. Please contact the Front Desk Officer if your child is present."
- **Already confirmed:** "Arrival already confirmed for [child] today at [time]."
- **Student not linked to this parent:** Rejected as invalid, without revealing that the student exists.
- **Not a school day:** "There is no school today."
- **Network or server error:** Generic retry message.

### 11.18 Edge Cases
- A family with multiple children must confirm arrival separately for each child.
- A code scanned after the arrival window closes fails validation, even if the child is physically present.
- Validity is judged against server time only, not the device generating the code.
- If the daily code is regenerated mid-window, the previous code stops validating immediately.

### 11.19 Acceptance Criteria
- A parent with a linked child can scan a valid QR code within the arrival window and receive a success state.
- A parent can enter a valid manual code and get the same result as a successful QR scan.
- A second confirmation attempt for the same student and day returns the existing record, not a duplicate.
- An expired or invalid code is rejected with a clear message, and the parent can retry with the other method.
- A parent cannot confirm arrival for a student they are not linked to, even with a valid code.
- On a non-school day, Confirm Arrival is disabled and the parent sees a clear message.
- Every confirmation is queryable later with student, parent, school, date, time, and method.

---

## 12. F-4 — Pay Fees

### Objective
Let an authorized parent view their child's outstanding fee balance and pay it through Flutterwave, with the balance only ever updated after server-verified payment success.

### 12.1 User Stories
- As a parent, I want to see my child's current outstanding balance before I pay.
- As a parent, I want to pay through a trusted payment provider and get a clear confirmation.
- As a parent, I want to know if a payment failed rather than see it silently disappear.
- As a school, I want every payment reconcilable against Flutterwave's own records.

### 12.2 Preconditions
- Parent is authenticated and has an active `ParentStudent` link to the child.
- The child has an active fee record with the school.

### 12.3 Currency
All amounts are in Nigerian Naira (NGN). This is the only supported currency in v1.

### 12.4 Balance Retrieval
- The displayed balance always comes from the authoritative `FeeBalance` record in the database.
- The AI is never used to calculate, estimate, or state a balance.

### 12.5 Amount-Selection Rules
- Partial payments are allowed. Minimum partial payment: ₦1,000. *Configurable.*
- The parent cannot select an amount that would take the balance negative unless the school explicitly allows overpayment.

### 12.6 Payment Initialization
- Before redirecting to Flutterwave, the server creates a `Payment` record with status `Pending` and a unique internal reference.
- The redirect to Flutterwave only happens after this record exists.

### 12.7 Unique Payment Reference
- Each payment attempt gets a unique internal reference, combining a UUID with school and student identifiers.
- This reference is passed to Flutterwave and used to match the transaction on return and on webhook.

### 12.8 Idempotency
- If a parent retries, refreshes, or reopens a pending payment before it resolves, the system reuses the existing `Pending` record and reference.
- A new `Payment` record is only created once the previous attempt has reached a terminal state.

### 12.9 Flutterwave Integration
- Use Flutterwave's standard checkout flow.
- Pass the internal reference, amount, currency (NGN), and customer details to Flutterwave at initiation.

### 12.10 Redirect / Return Handling
- When the parent returns from Flutterwave, the app shows a "verifying payment" state.
- The app never marks a payment as successful based solely on the return URL or query parameters.

### 12.11 Server-Side Verification
- On return, and independently via webhook, the server calls Flutterwave's transaction verification endpoint using the transaction reference.
- A payment is marked `Successful` only after server-side verification confirms it.

### 12.12 Webhook Handling
- A webhook endpoint receives Flutterwave payment events.
- The endpoint verifies the webhook signature before processing.
- Webhook processing is idempotent: receiving the same event twice does not double-update the balance.

### 12.13 Payment State Machine
$$\text{Pending} \rightarrow \text{Successful}$$
$$\text{Pending} \rightarrow \text{Failed}$$
$$\text{Successful} \rightarrow \text{Refunded}$$

No other transitions are valid.

### 12.14 Balance Update Rules
- The fee balance is decremented only when a `Payment` reaches `Successful` status, as confirmed by server-side verification.
- A `Pending` or `Failed` payment never changes the balance.

### 12.15 Refund Handling
- A refund is recorded as a `Refund` record linked to the original `Payment`.
- The balance is only increased after the refund is confirmed by Flutterwave.
- Refund amount cannot exceed the original payment amount.
- Only Admin can initiate a refund. A refund is allowed within 30 days of the original successful payment. *Configurable.*

### 12.16 Reconciliation
- Every `Payment` record stores both the internal reference and the Flutterwave transaction reference, for reconciliation against Flutterwave's dashboard or reports.

### 12.17 Receipt / Confirmation
- After a `Successful` payment, the parent sees a confirmation screen with amount, date, student, and reference.
- A downloadable or shareable receipt is available if the school requires one. Exact format is configurable.

### 12.18 Database Model
```prisma
model Payment {
  id                   String        @id @default(cuid())
  studentId            String
  parentId             String
  amount               Decimal
  internalReference    String        @unique
  flutterwaveReference String?       @unique
  status               PaymentStatus
  createdAt            DateTime      @default(now())
  verifiedAt           DateTime?

  student Student  @relation(fields: [studentId], references: [id])
  parent  Parent   @relation(fields: [parentId], references: [id])
  refunds Refund[]
}

enum PaymentStatus {
  PENDING
  SUCCESSFUL
  FAILED
  REFUNDED
}

model Refund {
  id        String       @id @default(cuid())
  paymentId String
  amount    Decimal
  status    RefundStatus
  createdAt DateTime     @default(now())

  payment Payment @relation(fields: [paymentId], references: [id])
}

enum RefundStatus {
  PENDING
  CONFIRMED
}
```

### 12.19 API / Backend Requirements
- `POST /api/payments/initiate` — creates or reuses a `Pending` payment, returns the Flutterwave checkout URL and reference.
- `POST /api/payments/webhook` — receives and verifies Flutterwave webhook events, updates payment status idempotently.
- `GET /api/payments/:id/status` — returns current verified status for the parent's return-screen polling.

### 12.20 Security Requirements
- Webhook signature verification is mandatory before trusting any webhook payload.
- Balance mutation happens only in server code triggered by verified payment status, never from client input.
- The server checks the `ParentStudent` link before allowing a parent to initiate payment for a given student.

### 12.21 Error States
- **Payment failed:** Shown clearly, balance untouched, retry offered.
- **Webhook not received within 15 minutes:** Server falls back to an active verify call. *Configurable.*
- **Duplicate webhook delivery:** Second delivery is a no-op given the payment is already in a terminal state.
- **Stuck transaction:** If Flutterwave never resolves a transaction (no webhook, and repeated verify calls return no result) within 24 hours, the payment is marked `Failed` and the parent is invited to retry. *Configurable.*

### 12.22 Edge Cases
- Parent closes the browser or app mid-payment: the payment stays `Pending` until webhook or a later verify call resolves it.
- Webhook arrives before the parent's browser returns from Flutterwave: the app shows success immediately on return.
- A partial payment leaves the balance above zero: expected, and the app shows the updated remaining balance.
- A refund request for more than the original payment amount is rejected.

### 12.23 Acceptance Criteria
- A parent sees the correct current balance, in NGN, sourced from the database, before paying.
- A parent completing a Flutterwave payment sees a "verifying" state, followed by "successful" only after server-side verification.
- No balance changes occur on a `Pending` or `Failed` payment.
- Retrying a payment reuses the pending attempt rather than creating duplicates.
- A duplicate webhook delivery does not double-apply a balance change.
- A transaction that never resolves is eventually marked `Failed` rather than staying `Pending` indefinitely.
- Every successful payment has a matching Flutterwave transaction reference for reconciliation.

---

## 13. F-5 — Ask the Office

### Objective
Give parents a simple, reliable way to reach a human when SchoolPass or the AI cannot resolve their question, by routing them to the school's designated Front Desk Officer through WhatsApp.

### 13.1 User Stories
- As a parent, I want to easily reach the school by WhatsApp when the AI cannot answer my question.
- As a parent, I do not want to figure out which staff member to contact.
- As a school, I want all parent enquiries that reach this point to go to one consistent contact.

### 13.2 Parent Flow
1. Parent selects Ask the Office, directly or after Ask the School cannot answer.
2. Parent types their question in a text field.
3. Parent confirms and submits.
4. SchoolPass builds a WhatsApp deep link containing the Front Desk Officer's number and the parent's question as prefilled text.
5. WhatsApp opens with the message ready to send.
6. Parent sends the message. The conversation continues inside WhatsApp from this point.

### 13.3 Front Desk Officer Routing
- There is exactly one configured Front Desk Officer WhatsApp contact per school.
- The parent cannot choose a teacher, department, bursar, administrator, or any other staff member.

### 13.4 WhatsApp Integration / Deep-Link Behaviour
- Use a `wa.me` style link, or a WhatsApp Business API link if the school has a Business account, containing the Front Desk Officer's number and a URL-encoded prefilled message.
- On mobile, this opens the WhatsApp app if installed.
- On desktop, or where the app is unavailable, fall back to the WhatsApp Web link.

### 13.5 Prefilled Message Behaviour
- The prefilled message includes the parent's question text only.
- It does not include the parent's name or the child's name.
- The parent can edit the message inside WhatsApp before sending.

### 13.6 Front Desk Officer Contact Configuration
- The Owner/Admin sets the Front Desk Officer's WhatsApp number in school settings (Section 7.2).
- Only one number is supported in v1.

### 13.7 Authorization / Access Considerations
- Any authenticated parent can use Ask the Office. No additional authorization is required, since this feature does not expose private student data by itself.

### 13.8 AI Fallback Relationship
Ask the Office is offered when:
- Ask the School's retrieval confidence is below the configured threshold.
- The question is not covered by approved school information.
- The question requires a human decision.
- The parent explicitly chooses Ask the Office instead of asking the AI.

The AI must never generate an answer just to avoid showing this fallback.

### 13.9 Error States
- **No Front Desk Officer number configured:** The parent sees a message that the office contact is not yet set up, and the Owner/Admin is prompted to configure it.
- **WhatsApp not available and no web fallback possible:** Show the Front Desk Officer's number as plain text with a "copy number" action.

### 13.10 Edge Cases
- Very long questions may exceed WhatsApp deep-link length limits. If this happens, truncate the prefilled message and tell the parent it was shortened.
- On a shared or public device, the question text should not persist in the browser history in a way that exposes it.

### 13.11 Acceptance Criteria
- Selecting Ask the Office and submitting a question opens WhatsApp with the Front Desk Officer's number and the question prefilled.
- The parent is never shown a contact other than the Front Desk Officer.
- SchoolPass never claims the message was delivered, read, or answered.
- If the Front Desk Officer number is not configured, the parent sees a clear message rather than a broken or silent failure.

---

## 14. Data Retention & Deletion Policy

When a student leaves the school (graduates, withdraws, or transfers), their records (attendance, arrival confirmations, payment history) are retained for 7 years, consistent with NDPR retention guidance for school records.

After 7 years, records are archived and then deleted on a schedule set by Admin.

*Exact retention period and deletion schedule are configurable.*

---

## 15. Non-Functional Requirements

SchoolPass is used primarily on parents' mobile phones, often on limited or unstable network connections. The app must be usable on a small mobile screen and should remain functional under slow or intermittent network conditions, for example by showing appropriate loading and retry states rather than failing silently.

**Performance targets:**
- **First contentful paint on a 3G connection:** Under 5 seconds on a mid-range Android phone.
- **Interactive:** Under 8 seconds on a 3G connection.
- All pages must show a loading state and a retry action.

*These targets are configurable.*

---

## 16. Cross-Feature Rules

- **Authentication:** Every feature requires an authenticated session. This applies equally to Parent, Staff, and Admin accounts, which are authenticated separately through their respective interfaces (parent app vs. Staff & Admin Interface, Section 7). No feature exposes student, attendance, arrival, or payment data to an unauthenticated request.
- **Parent/guardian authorization:** Every action tied to a specific student requires a server-side check that the authenticated parent has an active `ParentStudent` link to that student. This check is never trusted from the client.
- **Child selection:** Any child selector in the UI is a convenience, not a security boundary. The server independently verifies the selected child belongs to the requesting parent on every request.
- **School isolation:** SchoolPass is single-school in this version. Every record, code, and query is implicitly scoped to the one configured school.
- **Private data protection:** Fee balances, payment records, and arrival records are never placed in the AI's knowledge base or passed to the AI as context. They are always retrieved directly from the authoritative database through an authorized query.
- **AI boundaries:** The AI answers only from `ApprovedSchoolInfo`. It never invents an answer when retrieval confidence is below threshold. It never answers questions about private student data; those are routed to F-2 or F-5.
- **Payment verification:** No payment is marked successful, and no balance is changed, based on client-side or redirect-based signals alone. Server-side verification against Flutterwave is the only source of truth for payment status.
- **Auditability:** Arrival confirmations, payment attempts, and AI "wrong answer" reports are all logged so school staff can review what happened and when.
- **Server-side validation:** Every rule with real consequences (code validity, duplicate prevention, payment status, authorization) is enforced on the server, not just presented well on the client.
- **Configurable values:** Any value marked "configurable" in this document (thresholds, time windows, rate limits, targets, timeouts, retention periods) is intentionally undefined here. It must be set by the school or product owner before launch.

---

## 17. Resolved Open Items

All items below were open in PRD v5. Each is now resolved. `- [x]` means resolved. `- [ ]` means still open and must be set before launch.

- [x] Baseline inquiry data from the school (Section 2). The school must provide pre-launch counts by channel and estimated staff hours per week.
- [x] AI relevance threshold (Section 9). Recorded in `RULES_AI.md`.
- [x] Daily question limit per parent (Section 9). 20 per day. Recorded in `RULES_AI.md`.
- [x] Re-embedding window (Section 9). 5 minutes after an approved record change. Recorded in `RULES_AI.md`.
- [ ] Monthly AI cost ceiling (Section 9). Exact number to be set by Owner/Admin. Recorded in `RULES_AI.md`.
- [x] Passage size (Section 9). 512 tokens with 50 token overlap. Recorded in `RULES_AI.md`.
- [x] Arrival window (Section 11). 6:30 AM to 10:00 AM on a configured school day. Recorded in `RULES_ARRIVAL.md`.
- [x] Manual code rate limit (Section 11). 5 attempts per parent session per 15 minutes. Recorded in `RULES_ARRIVAL.md`.
- [x] Code validity window (Section 11). Same as the arrival window. Expires at 10:00 AM. Recorded in `RULES_ARRIVAL.md`.
- [x] Partial payment rule (Section 12). Partial payments are allowed. Recorded in `RULES_PAYMENTS.md`.
- [x] Minimum partial payment (Section 12). ₦1,000. Recorded in `RULES_PAYMENTS.md`.
- [x] Refund policy (Section 12). Admin only. Within 30 days of the original successful payment. Recorded in `RULES_PAYMENTS.md`.
- [x] Payment webhook timeout (Section 12). 15 minutes. Recorded in `RULES_PAYMENTS.md`.
- [x] Stuck transaction timeout (Section 12). 24 hours. Recorded in `RULES_PAYMENTS.md`.
- [x] Prefilled WhatsApp message content (Section 13). Question text only. No parent name. No child name. Recorded in `RULES_CONFIG.md`.
- [x] Confirm Arrival reminder mechanism (Section 4). SMS or email to the parent, chosen at onboarding. No push notification. Recorded in `RULES_CONFIG.md`.
- [x] Parent-to-student linking mechanism (Section 8.1). Direct staff lookup only. No invite code. Recorded in `RULES_AUTH.md`.
- [x] Account recovery method (Section 8.2). Email link only. Recorded in `RULES_AUTH.md`.
- [x] Staff attendance time entry (Section 10.1). Present or absent only. `time` is nullable. Recorded in `RULES_ATTENDANCE.md`.
- [x] Term model (Section 10.1). Three terms per session. Admin sets current term and dates. Rollover resets figures. Prior term data retained. Recorded in `RULES_ATTENDANCE.md`.
- [x] Data retention period (Section 14). 7 years. Then archive and delete on an Admin-set schedule. Recorded in `RULES_RETENTION.md`.
- [x] Performance targets (Section 15). FCP under 5 seconds on 3G. Interactive under 8 seconds on 3G. Loading and retry states on all pages. Recorded in `RULES_CONFIG.md`.
- [x] Uptime target (Section 1). 99 percent per month during school hours. Recorded in `RULES_CONFIG.md`.
- [x] AI accuracy target (Section 1). 70 percent of pilot questions answered without escalation. Recorded in `RULES_CONFIG.md`.
- [x] Staff and Admin Interface screens (Section 7). Screens match capabilities in 7.1 and 7.2. Navigation is a left sidebar on desktop and a bottom tab bar on mobile. Recorded in `RULES_STAFF_UI.md`.
- [x] Enrollment statuses (Section 10.3). Only Active is shown in v1. Recorded in `RULES_DATA_MODEL.md`.
- [ ] Environment variable names (Section 6, Technology Direction). The PRD does not name any. The user must supply every name. Recorded in `RULES_ENV.md`.

---

## 18. Staff & Admin Interface Screens

This section resolves the reference in Section 7.3.
Staff and Admin Interface screens match the capabilities listed in Section 7.1 and 7.2.

**Navigation:**
- Left sidebar on desktop.
- Bottom tab bar on mobile.

**Screens:**
- Approved Info list and edit (`ApprovedSchoolInfo`).
- Attendance entry (`StaffAttendanceRecord`).
- Arrival code display (daily QR and manual code).
- Payment verification (`Payment`, `Refund`).
- Wrong answer reports (Section 9.8).
- School settings, including current term and session.
- Staff accounts.
- Guardian links (`ParentStudent`).
- Front Desk Officer WhatsApp number.

Exact layout and visual design are implementation decisions. This section fixes the screen list and navigation model only.

---

**End of SchoolPass PRD v6.0**