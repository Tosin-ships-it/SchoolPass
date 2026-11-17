# SchoolPass Fee Management & Flutterwave Payment Workflow
## Comprehensive Architecture & Phased Implementation Plan

**Document Version:** 1.0  
**Status:** Under Product Review (Awaiting User Approval)  
**Authoritative Baselines:** `docs/SchoolPass_PRD_v6.md` & `docs/PRD_ADDENDUM_v6.1.md`  
**Governing Rules:** `RULES_PAYMENTS.md`, `RULES_DATA_MODEL.md`, `RULES_PRIVACY.md`, `RULES_AUTH.md`, `RULES_LOGGING.md`, `RULES_CONFIG.md`, `RULES_STAFF_UI.md`

---

## Executive Summary

SchoolPass provides parents of a single school with a private, secure web portal to monitor their child's records and pay school fees online. While Flutterwave has been provisioned and test API credentials exist, SchoolPass currently has **zero operational payment or fee-management code** in place (all payment directories under `src/lib/payments/`, `src/app/(parent)/pay/`, `src/app/(staff)/payments/`, and `src/app/api/payments/` contain only placeholder `.gitkeep` files).

This document establishes the end-to-end architecture and implementation blueprint for:
1. **Admin/Staff Fee Management:** Defining fee structures, configuring compulsory/optional fees, setting deadlines, bulk and individual assignment to students, and recording immutable adjustments and offline payments.
2. **Dynamic Ledger & Balance Calculation:** Implementing the authoritative Addendum v6.1 computed balance engine (`Outstanding = Charges − Offline payments − Online payments`), supporting term roll-over where debt carries forward.
3. **Parent Payment Workflow:** Enabling parents to view itemized fee obligations per child, select payment amounts (full or partial payments $\ge$ ₦1,000), and initiate online payments.
4. **Flutterwave Integration:** Secure payment initiation, standard hosted checkout, multi-layered verification (server verify call + cryptographic webhook), duplicate prevention, and reconciliation.
5. **Security, Privacy & RBAC:** Enforcing strict server-side authorization boundaries, mathematical integrity in Nigerian Naira (`Decimal(12,2)`), and total isolation of financial data from the AI pipeline.

---

## 1. Authoritative Documentation Review & Existing State

### 1.1 PRD Baseline vs. Addendum v6.1 Overrides

A strict reconciliation between `SchoolPass_PRD_v6.md` and `PRD_ADDENDUM_v6.1.md` yields the following foundational requirements:

| Topic | PRD v6.0 Baseline | Addendum v6.1 Explicit Override | Operational Consequence |
|---|---|---|---|
| **Fee Balance Source** | PRD §10.2 & §12.4: Sourced from a `FeeBalance` database record that is decremented upon payment. | **Addendum §3.2:** Explicitly overrides stored balance. Balance is a **dynamically computed ledger total**: <br>`Charges − Offline payments − Online payments`. Not stored as an editable balance. | No standalone `FeeBalance` table. Balance is computed on the fly from immutable `FeeEntry` and verified `Payment` records. |
| **Term Rollover & Debts** | PRD §10.1: At rollover, attendance and fee figures reset to the new term. Prior term data retained in history. | **Addendum §3.1:** **Unpaid fees accumulate across terms.** Fees do *not* reset at term rollover. Parents see total outstanding with a breakdown by term (e.g. Earlier terms vs. Current term). | Debts persist across academic terms. Charges belonging to terms that have not yet started are excluded until the start date. |
| **Offline Payments** | PRD §12 does not specify cash/bank transfer tracking. | **Addendum §3.3:** Sourced outside SchoolPass (cash, direct bank transfer) recorded by Staff as `FeeEntry` of type `OFFLINE_PAYMENT`. | Offline payments require an external receipt/transfer reference and cannot be refunded through SchoolPass or Flutterwave. |
| **Fee Entry Model** | PRD §10 had no defined schema for charges. | **Addendum §3.4 & §9.2:** Introduces `FeeEntry` with enum `FeeEntryType` (`CHARGE`, `ADJUSTMENT`, `OFFLINE_PAYMENT`), `studentId`, `termId`, `amount`, `note`, `createdByStaffId`. | Fee entries are **strictly immutable**. Corrections require counter-balancing `ADJUSTMENT` entries. |
| **Bulk Fee Assignment** | Not specified in PRD v6.0. | **Addendum §3.5 & §10:** Staff apply charges to the whole school or a selected class, creating one individual `FeeEntry` per student. Manual entry for exceptions. | Bulk actions create atomic, batch-inserted individual student records. |
| **Partial Payments & Refunds** | PRD §12.5 & §12.15: Partial payments allowed (min ₦1,000). Full refund within 30 days. | **Addendum §8.5:** Confirms partial payments, partial refunds, and allows confirmed refunds to increase the outstanding balance. | A payment is marked `REFUNDED` only when confirmed refunds equal original payment amount. |
| **Student Leavers** | PRD §10.3: Active status only. | **Addendum §4:** When student is marked `leftAt`, parent access terminates immediately even if money remains outstanding. | Parent authorization queries must verify `Student.leftAt === null`. |

### 1.2 Discovered Existing Codebase State

Inspection of the active workspace reveals:
- **Prisma Schema (`prisma/schema.prisma`):** Contains model definitions for `FeeEntry`, `Payment`, and `Refund`, as well as `Student`, `Parent`, `StaffUser`, and `SchoolSetting`.
- **Application Code:** 
  - `src/lib/payments/` $\rightarrow$ empty (`api/.gitkeep` only).
  - `src/app/(parent)/pay/` $\rightarrow$ empty (`.gitkeep` only).
  - `src/app/(staff)/payments/` $\rightarrow$ empty (`.gitkeep` only).
  - `src/app/api/payments/` $\rightarrow$ empty (`.gitkeep` only).
- **Environment Variables (`.env.example`):** Contains names `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_SECRET`, and `DATABASE_URL`.
- **Conclusion:** **There is currently zero payment or fee management implementation in the codebase.**

### 1.3 Identified Ambiguities and Missing Specifications

Before building, five structural gaps in the documentation must be formally resolved:
1. **Fee Catalog / Itemization:** Addendum §3 defines individual student `FeeEntry` rows, but does not specify how school administrators define *what* is being billed (e.g. "Third Term Tuition", "ICT Levy", "Graduation Fee"). Without a Fee Structure/Catalog, staff would have to manually re-type amounts and descriptions for every class each term.
2. **Compulsory vs. Optional Charges:** The user prompt requires defining which fees are compulsory (e.g. Tuition) and which are optional (e.g. Excursion, Club Uniform). The PRD does not specify how optional fees are selected or declined by parents.
3. **Academic Term Representation (`termId`):** In `schema.prisma`, `FeeEntry.termId` is a bare `String`. The database lacks an `AcademicTerm` model; term settings currently reside as unstructured strings in `SchoolSetting`.
4. **Partial Payment Allocation:** When a parent pays ₦50,000 against a total ₦120,000 balance spanning earlier and current terms, how is the payment allocated? (Standard accounting dictates FIFO: oldest term debt is cleared first).
5. **Staff vs. Front-Desk Permissions:** PRD §7.1 allows Staff to "review and verify payment records". Addendum §3.3 states Staff can record `OFFLINE_PAYMENT`. We must determine whether general teaching staff can record offline payments or if this is restricted to Admin and designated Front Desk / Bursar accounts.

---

## 2. Fee-Management Workflow (Admin & Staff)

The fee management system provides School Administrators with full financial control while ensuring all ledger entries remain immutable and auditable.

```mermaid
flowchart TD
    subgraph Admin_Configuration["1. Fee Setup & Catalog"]
        A[Admin / Bursar] -->|Defines| B[Fee Template / Structure]
        B -->|Specifies| C[Name, Description, Amount NGN]
        B -->|Configures| D[Target: Whole School or Class]
        B -->|Tags| E[Compulsory vs. Optional]
        B -->|Sets| F[Payment Deadline & Term]
    end

    subgraph Assignment_Engine["2. Fee Assignment"]
        B -->|Bulk Apply| G[Preview Affected Students]
        G -->|Confirm| H[Batch Insert FeeEntry Records]
        A -->|Individual Charge| H
    end

    subgraph Ledger_Mutations["3. Ledger Maintenance"]
        I[Physical Payment Received] -->|Admin / Front Desk Logs| J[FeeEntry: OFFLINE_PAYMENT]
        K[Billing Error / Concession] -->|Admin Logs| L[FeeEntry: ADJUSTMENT (+/-)]
        H --> M[(Authoritative Ledger)]
        J --> M
        L --> M
    end

    subgraph Dynamic_Calculation["4. Real-Time Calculation"]
        M --> N[Balance Calculation Engine]
        O[Verified Online Payments] --> N
        N -->|Computes| P[Student Outstanding Balance]
    end
```

### 2.1 Fee Structure Definition & Configuration
Admin can create reusable **Fee Structures** tied to an academic session and term:
- **Fee Title & Description:** (e.g. *"First Term Tuition"*, *"PTA Development Levy"*, *"Inter-House Sports Fee"*).
- **Amount:** Stored in Nigerian Naira (NGN) using `Decimal(12,2)`.
- **Academic Scope:** Bound to a specific Session (e.g. `2026/2027`) and Term (e.g. `First Term`).
- **Target Audience:** Whole school or specific classes (e.g. `JSS 1`, `Primary 4`).
- **Classification:**
  - **Compulsory:** Automatically assessed to all students in the target cohort.
  - **Optional:** Selectable fees (e.g. Boarding, School Bus, Music Club) assigned only upon parent opt-in or staff allocation.
- **Due Date / Deadline:** Displayed to parents to encourage timely settlement.

### 2.2 Fee Assignment Mechanism
1. **Bulk Class/School Application (Primary Method):**
   - Admin selects a Fee Structure.
   - The system displays a confirmation preview listing all active students (`leftAt === null`) in the target class or school, along with the total monetary assessment.
   - Upon confirmation, the server transactionally generates an individual `FeeEntry` row of type `CHARGE` for each student.
2. **Individual Student Exceptions:**
   - Admin can add a bespoke `CHARGE` for a specific student (e.g. replacement ID card, boarding supplement, transfer fee).
3. **Idempotency Protection:**
   - Bulk assignment includes duplicate checks: if a `FeeEntry` with the same `feeStructureId` (or matching title and term) already exists for a student, it is skipped to prevent duplicate billing.

### 2.3 Offline Payment Recording (`OFFLINE_PAYMENT`)
For parents who pay directly at the school office via cash, POS, or direct bank transfer:
- Staff/Admin navigates to the student's ledger.
- Enters the payment details:
  - **Amount:** Positive `Decimal(12,2)`.
  - **Payment Method:** `CASH`, `BANK_TRANSFER`, or `POS`.
  - **Authoritative Reference:** External teller number, bank transaction ID, or receipt number (mandatory).
  - **Academic Term:** The term to credit.
  - **Internal Note:** Free-text remarks (e.g. *"Paid at Zenith Bank, teller #98231"*).
- Creates an immutable `FeeEntry` of type `OFFLINE_PAYMENT`.
- **Invariant:** Offline payments never interact with Flutterwave, cannot be refunded through SchoolPass, and are excluded from Flutterwave reconciliation.

### 2.4 Corrections & Adjustments (`ADJUSTMENT`)
- **No historical edit or hard delete:** In compliance with Addendum §3.4, existing `FeeEntry` records can never be updated or deleted.
- **Reversals and Waivers:** If a fee was assigned erroneously or a discount/scholarship is awarded, Admin logs a `FeeEntry` of type `ADJUSTMENT`.
- **Signed Amounts:** An `ADJUSTMENT` can be negative (reducing student debt) or positive (correcting an undercharge). A detailed explanatory note is strictly required.

---

## 3. Parent Payment Workflow

The parent payment experience is transparent, mobile-optimized, and gives parents of multiple children clear visibility into their financial obligations.

```mermaid
sequenceDiagram
    autonumber
    actor Parent as Parent / Guardian
    participant Web as SchoolPass UI (/pay)
    participant Server as SchoolPass Server
    participant DB as Neon PostgreSQL
    participant FW as Flutterwave Gateway

    Parent->>Web: Opens Pay Fees screen
    Web->>Server: Request fee summary for linked children
    Server->>DB: Check ParentStudent link & compute balance
    DB-->>Server: Ledger entries (Charges, Offline, Online)
    Server-->>Web: Calculated balance, term breakdown & fee items

    Parent->>Web: Selects child & payment amount (>= ₦1,000)
    Parent->>Web: Clicks "Proceed to Payment"
    Web->>Server: POST /api/payments/initiate { studentId, amount }
    Server->>DB: Create Payment record (Status: PENDING, tx_ref)
    Server->>FW: Request standard checkout link
    FW-->>Server: Checkout URL
    Server-->>Web: Redirect URL

    Web->>FW: Redirects parent to Flutterwave Hosted Checkout
    Parent->>FW: Enters card/bank details & authorizes OTP
    FW-->>Web: Redirects parent back to SchoolPass (/pay/verify?tx_ref=...)

    Web->>Server: Polls verification status (/api/payments/:ref/status)
    Server->>FW: GET /v3/transactions/:id/verify
    FW-->>Server: Status: "successful", amount, currency
    Server->>DB: Update Payment to SUCCESSFUL (Atomic Transaction)
    Server-->>Web: Payment Confirmed

    Web->>Parent: Displays Success Modal & Official Receipt
```

### 3.1 Multi-Child Account Experience
- When a parent opens `/pay`, the header prominently displays a **Child Selector** for all active linked children.
- Each child card shows:
  - Child full name, student number (`SP-YYYY-NNNN`), and class.
  - Total Outstanding Balance in ₦ (NGN).
  - High-level payment status badge (*"Fees Fully Settled"*, *"Partial Balance Due"*, or *"Unpaid"*).
- Selecting a child dynamically loads that specific child's ledger. Payments are always made **per student** to ensure clear auditability and prevent cross-child ledger reconciliation errors.

### 3.2 Fee Visibility & Term Breakdown
Parents see a clear breakdown reflecting Addendum §3.1:
- **Total Outstanding Balance:** Prominently formatted in Nigerian Naira (e.g. `₦120,000.00`).
- **Term-by-Term Subtotals:**
  - *Earlier Terms (Arrears):* e.g. `₦40,000.00`
  - *Current Term:* e.g. `₦80,000.00`
- **Itemized Fee Obligations Table:**
  - Fee Name and Description.
  - Term / Session.
  - Type badge: `Compulsory` (Tuition, Development) vs. `Optional` (Excursion, Clubs).
  - Due date with warning styling if overdue.
  - Amount assessed, amount settled, and remaining balance.
- **Payment & History Timeline:**
  - Filterable audit history showing verified online payments (with Flutterwave references), school-recorded offline payments, adjustments, and refunds.

### 3.3 Flexible Payment Options
- Parents can choose:
  1. **Pay Full Outstanding Balance:** Automatically populates the total computed balance.
  2. **Pay Custom / Partial Amount:** Parents can enter an amount, subject to:
     - **Minimum Threshold:** Minimum partial payment is **₦1,000.00** (enforced by PRD §12.5 and `RULES_PAYMENTS.md`).
     - **Maximum Cap:** Cannot exceed the total outstanding balance (overpayments disallowed in v1).
- **Automatic Debt Allocation:** When a partial payment is made, the backend automatically allocates funds to arrears (earliest unpaid terms) first using standard FIFO accounting.

### 3.4 Official Payment Receipts
- Upon payment confirmation, SchoolPass generates an official digital receipt:
  - Unique Receipt Number (e.g. `RCP-2026-0042`).
  - School Name, Logo, and Official Address.
  - Student Name, Student Number, and Class.
  - Payer (Parent) Name and Verified Email.
  - Payment Date and Time.
  - Amount Paid in NGN and Remaining Outstanding Balance.
  - Payment Channel: `Flutterwave Online Checkout`.
  - Flutterwave Transaction Reference and SchoolPass Internal Reference.
  - Clean print-friendly stylesheet for saving as PDF or printing.

---

## 4. Flutterwave Integration Architecture

The payment pipeline follows the **Trust-No-Client** security model: browser redirects, frontend parameters, and return URLs are treated as untrusted hints. A payment transitions to `SUCCESSFUL` strictly when server-to-server cryptographic proof is established.

### 4.1 Payment Lifecycle & State Machine

In accordance with PRD §12.13 and `RULES_PAYMENTS.md` Rule 3:

```
[ PENDING ] ─────────► [ SUCCESSFUL ] ─────────► [ REFUNDED ]
     │
     └───────────────► [  FAILED   ]
```

- **Closed State Rules:**
  - `PENDING` $\rightarrow$ `SUCCESSFUL` (Allowed upon server API verification or verified webhook).
  - `PENDING` $\rightarrow$ `FAILED` (Allowed upon gateway failure, mismatch, or 24h timeout).
  - `SUCCESSFUL` $\rightarrow$ `REFUNDED` (Allowed only when total confirmed refunds equal original amount).
  - **No other transition is valid.** A terminal state (`SUCCESSFUL`, `FAILED`, `REFUNDED`) can never return to `PENDING`.

### 4.2 Payment Initiation (`POST /api/payments/initiate`)
1. **Authentication & Authorization:** Verify active session and server-side `ParentStudent` link to `studentId`. Check `Student.leftAt === null`.
2. **Validation:**
   - Amount is $\ge$ ₦1,000.00.
   - Amount $\le$ current computed balance.
3. **Idempotency Check:** Search for an existing `PENDING` payment for this parent and student created within the last 15 minutes. If found, reuse its `internalReference` and redirect URL rather than creating a duplicate.
4. **Pre-Allocation Database Record:** Create a `Payment` record in PostgreSQL with status `PENDING` and a cryptographically unique reference (`internalReference`: `SP-PAY-<CUID>`).
5. **Gateway Call:** Call Flutterwave Standard Payment API:
   ```json
   POST https://api.flutterwave.com/v3/payments
   Headers: { "Authorization": "Bearer FLUTTERWAVE_SECRET_KEY" }
   Body: {
     "tx_ref": "SP-PAY-cly28a1...",
     "amount": "85000.00",
     "currency": "NGN",
     "redirect_url": "https://schoolpass.school/api/payments/return",
     "customer": {
       "email": "parent@example.com",
       "name": "Chioma Okonjo"
     },
     "customizations": {
       "title": "SchoolPass Fee Payment",
       "description": "Tuition payment for SP-2026-0001"
     }
   }
   ```
6. **Return URL:** Send the Flutterwave checkout link to the client for immediate redirection.

### 4.3 Return & Verification Handler (`GET /pay/verify` & `GET /api/payments/:id/status`)
- When Flutterwave redirects the parent back, the URL contains query parameters `status`, `tx_ref`, and `transaction_id`.
- The parent sees a dedicated **"Verifying Payment with School..."** loading state.
- The server executes an active verification call to Flutterwave:
  `GET https://api.flutterwave.com/v3/transactions/{transaction_id}/verify`
- **Integrity Validation:**
  1. `data.status === "successful"`.
  2. `data.tx_ref === payment.internalReference`.
  3. `data.currency === "NGN"`.
  4. `Decimal(data.amount) >= payment.amount`.
- If all checks pass, the server updates `Payment.status = SUCCESSFUL`, sets `flutterwaveReference`, and records `verifiedAt`.
- If currency or amount does not match, the payment is marked `FAILED`, logged, and an administrative alert is flagged (`RULES_PAYMENTS.md` Rule 11).

### 4.4 Webhook Handler (`POST /api/payments/webhook`)
Webhooks provide independent, asynchronous settlement confirmation even if the parent drops connection:
1. **Secret Hash Verification:** Extract `verif-hash` request header. Verify against `FLUTTERWAVE_WEBHOOK_SECRET` using timing-safe string comparison. If invalid, reject with HTTP 401 immediately.
2. **Event Parsing:** Listen for `charge.completed` event.
3. **Database Lookup:** Query `Payment` by `internalReference = event.data.tx_ref`.
4. **Idempotency Gate:**
   - If `payment.status === SUCCESSFUL`, return HTTP 200 immediately (no-op).
   - If `payment.status === PENDING`, perform active verify call against Flutterwave, verify amounts, and update status to `SUCCESSFUL` in an atomic database transaction.
5. **Speedy Acknowledgment:** Respond with HTTP 200 within 5 seconds to prevent gateway retries.

### 4.5 Fallbacks and Timeout Policies
- **15-Minute Webhook Fallback:** If a payment remains `PENDING` 15 minutes after initiation without webhook delivery, on-demand status checks trigger active verification against Flutterwave's API.
- **24-Hour Stuck Transaction Timeout:** In accordance with PRD §12.21, transactions that remain unverified after 24 hours are transitioned to `FAILED`, releasing any pending lock and inviting the parent to retry.

---

## 5. Proposed Data Model & Schema Blueprint

The proposed schema honors existing database structures while adding the minimal necessary primitives to support catalog-driven fees and receipt tracking.

```mermaid
erDiagram
    School ||--o{ Student : enrolls
    Student ||--o{ ParentStudent : links
    Parent ||--o{ ParentStudent : links
    StaffUser ||--o{ FeeEntry : records
    StaffUser ||--o{ FeeStructure : creates

    FeeStructure ||--o{ FeeEntry : "template for"
    Student ||--o{ FeeEntry : owes
    Student ||--o{ Payment : "credited to"
    Parent ||--o{ Payment : "paid by"
    Payment ||--o{ Refund : has

    FeeStructure {
        string id PK
        string title
        string description
        decimal amount
        string termId
        string sessionYear
        string targetClass
        boolean isCompulsory
        datetime dueDate
    }

    FeeEntry {
        string id PK
        string studentId FK
        string termId
        string feeStructureId FK
        enum type "CHARGE | ADJUSTMENT | OFFLINE_PAYMENT"
        decimal amount
        string reference
        string note
        string createdByStaffId FK
        datetime createdAt
    }

    Payment {
        string id PK
        string studentId FK
        string parentId FK
        decimal amount
        string internalReference UK
        string flutterwaveReference UK
        enum status "PENDING | SUCCESSFUL | FAILED | REFUNDED"
        string receiptNumber UK
        datetime createdAt
        datetime verifiedAt
    }

    Refund {
        string id PK
        string paymentId FK
        decimal amount
        enum status "PENDING | CONFIRMED"
        string reason
        datetime createdAt
    }
```

### 5.1 Schema Enhancements (To be recorded in `RULES_DATA_MODEL.md` upon approval)

```prisma
// ==========================================
// 5. FEES, CATALOG & PAYMENTS
// ==========================================

enum FeeEntryType {
  CHARGE
  ADJUSTMENT
  OFFLINE_PAYMENT
}

enum FeeCategoryTarget {
  ALL_STUDENTS
  CLASS_SPECIFIC
}

model FeeStructure {
  id             String            @id @default(cuid())
  title          String            // e.g. "Third Term Tuition"
  description    String?           // Explanatory breakdown for parents
  amount         Decimal           @db.Decimal(12, 2)
  sessionYear    String            // e.g. "2026/2027"
  termId         String            // e.g. "Third Term"
  targetType     FeeCategoryTarget @default(CLASS_SPECIFIC)
  targetClass    String?           // Nullable if ALL_STUDENTS; e.g. "JSS 1"
  isCompulsory   Boolean           @default(true)
  dueDate        DateTime?
  createdById    String
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  feeEntries     FeeEntry[]
  createdBy      StaffUser         @relation(fields: [createdById], references: [id], onDelete: Restrict)

  @@index([sessionYear, termId])
  @@index([targetClass])
  @@map("fee_structures")
}

model FeeEntry {
  id               String        @id @default(cuid())
  studentId        String
  termId           String        // Term identifier matching SchoolSetting
  feeStructureId   String?       // Optional reference to parent FeeStructure template
  type             FeeEntryType
  amount           Decimal       @db.Decimal(12, 2)
  reference        String?       // Offline payment teller/receipt number or adjustment ref
  note             String?       // Required for ADJUSTMENT and OFFLINE_PAYMENT
  createdByStaffId String
  createdAt        DateTime      @default(now())

  student          Student       @relation(fields: [studentId], references: [id], onDelete: Cascade)
  feeStructure     FeeStructure? @relation(fields: [feeStructureId], references: [id], onDelete: SetNull)
  createdByStaff   StaffUser     @relation(fields: [createdByStaffId], references: [id], onDelete: Restrict)

  @@index([studentId, termId])
  @@index([feeStructureId])
  @@index([createdByStaffId])
  @@map("fee_entries")
}

enum PaymentStatus {
  PENDING
  SUCCESSFUL
  FAILED
  REFUNDED
}

model Payment {
  id                   String        @id @default(cuid())
  studentId            String
  parentId             String
  amount               Decimal       @db.Decimal(12, 2)
  internalReference    String        @unique // SP-PAY-YYYY-CUID
  flutterwaveReference String?       @unique // FLW-MOCK-... or gateway flw_ref
  status               PaymentStatus @default(PENDING)
  receiptNumber        String?       @unique // SP-RCP-YYYY-NNNN issued upon SUCCESSFUL
  createdAt            DateTime      @default(now())
  verifiedAt           DateTime?

  student              Student       @relation(fields: [studentId], references: [id], onDelete: Cascade)
  parent               Parent        @relation(fields: [parentId], references: [id], onDelete: Cascade)
  refunds              Refund[]

  @@index([studentId])
  @@index([parentId])
  @@index([status])
  @@map("payments")
}

enum RefundStatus {
  PENDING
  CONFIRMED
}

model Refund {
  id        String       @id @default(cuid())
  paymentId String
  amount    Decimal      @db.Decimal(12, 2)
  status    RefundStatus @default(PENDING)
  reason    String?
  createdAt DateTime     @default(now())

  payment   Payment      @relation(fields: [paymentId], references: [id], onDelete: Cascade)

  @@index([paymentId])
  @@map("refunds")
}
```

---

## 6. Roles & Permission Matrix (RBAC)

All permission checks are strictly executed on the server. Frontend UI elements conditionally display according to verified server session claims.

| Operational Capability | Admin / Owner | Front Desk (`isFrontDesk: true`) | Teaching Staff (`isFrontDesk: false`) | Parent / Guardian |
|---|:---:|:---:|:---:|:---:|
| **Create/Edit Fee Structures (Catalog)** | Yes | No | No | No |
| **Apply Bulk Charges (School/Class)** | Yes | No | No | No |
| **Create Bespoke Student Charge** | Yes | No | No | No |
| **Record Offline Payments (`OFFLINE_PAYMENT`)** | Yes | Yes (Configurable) | No | No |
| **Post Adjustments/Waivers (`ADJUSTMENT`)** | Yes | No | No | No |
| **View School Financial Reports & Audit** | Yes | Limited (Directory) | No | No |
| **Initiate Flutterwave Refund** | Yes (within 30d) | No | No | No |
| **View Student Outstanding Balance** | Yes | Yes | No | Yes (Linked only) |
| **Initiate Online Payment (Flutterwave)** | No | No | No | Yes (Linked only) |
| **Download Official Payment Receipt** | Yes | Yes | No | Yes (Linked only) |

---

## 7. Financial Integrity & Security Invariants

1. **Exact-Precision Currency Representation:**
   - All monetary calculations are performed using `Prisma.Decimal` or arbitrary-precision decimal representations (`Decimal(12,2)`). JavaScript IEEE-754 binary floating-point arithmetic (`number`) is strictly forbidden for financial calculations.
2. **Strict Privacy Boundary (`RULES_PRIVACY.md`):**
   - The AI module (`src/lib/ai/`) **must never** import `src/lib/payments/` or read `FeeEntry`, `Payment`, or `Refund`.
   - Private fee balances and payment amounts are never placed in vector stores or passed to Gemini as prompt context.
3. **Structured Audit Logging (`RULES_LOGGING.md`):**
   - Every payment attempt, status transition, and failed verification is logged with structured JSON: `{ timestamp, level, event, actorType, actorId, entityType, entityId, outcome }`.
   - In accordance with `RULES_LOGGING.md` Rule 2, **monetary amounts, fee balances, and parent/student names are never written into production log strings**.
4. **Timing-Safe Webhook Signature Verification:**
   - Webhook requests verify `verif-hash` using Node.js `crypto.timingSafeEqual` against a SHA256/HMAC digest of the secret to thwart timing attacks.
5. **Replay & Double-Update Protection:**
   - Webhook processing is idempotent. Updates run inside database transactions (`prisma.$transaction`) with atomic row-level status verification. Once a `Payment` is marked `SUCCESSFUL`, subsequent webhook deliveries return HTTP 200 immediately without executing balance updates.

---

## 8. Dashboard User Experience Design

The user interface follows the established SchoolPass design system (`tokens.css`, CSS variables, accessible high-contrast typography, and explicit mobile/desktop layout patterns).

### 8.1 Staff & Admin Interface (`/payments` & `/fee-entries`)
- **Navigation:** Accessible via the left sidebar on desktop and the "More" navigation sheet on mobile.
- **Screen 1: Fee Entries & Catalog (`src/app/(staff)/fee-entries/`)**
  - **Header:** Academic Session and Term selector.
  - **Tab A — Active Fee Catalog:** Table of configured fee structures with due dates, amounts, target classes, and compulsory tags. "Create Fee Structure" action button.
  - **Tab B — Student Fee Ledger:** Searchable directory by student name or student number. Shows total assessed charges, total payments, and current outstanding balance.
  - **Action Modals:**
    - *Apply Fee Structure Modal:* Select class $\rightarrow$ preview affected students $\rightarrow$ confirm bulk assignment.
    - *Record Offline Payment Modal:* Select student $\rightarrow$ enter amount, external teller reference, payment method, and note $\rightarrow$ record.
    - *Post Adjustment Modal:* Select student $\rightarrow$ enter credit/debit adjustment with required justification note.
- **Screen 2: Online Transactions & Verification (`src/app/(staff)/payments/`)**
  - Searchable list of all Flutterwave transactions.
  - Columns: Date/Time, Student Number, Parent Name, Internal Reference, Gateway Reference, Status Badge (`SUCCESSFUL`, `PENDING`, `FAILED`, `REFUNDED`), and Action.
  - **Actions:** View Receipt, Manually Re-verify (for pending items), and "Initiate Refund" (Admin only, with 30-day constraint).

### 8.2 Parent Portal (`/pay`)
- **Navigation:** Direct tab on Parent bottom bar (mobile) and top navigation bar (desktop).
- **Child Selector Header:** Distinct cards for each linked child showing name, class, and outstanding balance summary.
- **Main Payment Card:**
  - **Hero Balance Display:** Clear `₦XX,XXX.00` display with a breakdown toggle showing *Earlier Terms Arrears* vs. *Current Term*.
  - **Itemized Fee Table:** Clean visual rows indicating each charge, due date, amount, and `Compulsory` vs `Optional` chip.
- **Payment Action Section:**
  - Radio toggles: *"Pay Full Balance"* or *"Pay Other Amount"*.
  - Amount input field (pre-filled or custom; validates $\ge$ ₦1,000 and $\le$ balance).
  - Primary Action Button: **"Pay with Flutterwave"** (includes lock icon and security badge).
- **Recent Receipts & History:**
  - Downloadable receipts with status tags and dates.

---

## 9. Phased Implementation Roadmap

To maintain codebase stability and adhere to the project rule of verified, step-by-step progress, the implementation is divided into six logical phases:

```mermaid
gantt
    title SchoolPass Fee & Payment Implementation Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1: Foundation
    Data Models & Ledger Engine           :p1, 2026-11-15, 3d
    section Phase 2: Staff Management
    Fee Catalog & Bulk Assignment         :p2, after p1, 4d
    Offline Payments & Adjustments        :p3, after p2, 3d
    section Phase 3: Gateway Integration
    Flutterwave Client & Security Core    :p4, after p3, 4d
    section Phase 4: Parent Portal
    Parent UI & Checkout Flow             :p5, after p4, 4d
    section Phase 5: Audit & Refunds
    Reconciliation, Receipts & Refunds    :p6, after p5, 3d
```

### Phase 1: Data Model & Dynamic Ledger Engine
- **Deliverables:**
  - Record proposed `FeeStructure` and `Payment` updates in `RULES_DATA_MODEL.md`.
  - Update `prisma/schema.prisma` and execute controlled migration (upon user approval).
  - Implement the core ledger math in `src/lib/payments/ledger.ts`:
    `computeStudentBalance(studentId, asOfDate)`
  - Unit tests for ledger math: term rollover, arrears accumulation, future term exclusion, negative adjustments.
- **Dependencies:** None.

### Phase 2: Staff Fee Management & Catalog
- **Deliverables:**
  - Server actions for Fee Structure CRUD (`createFeeStructureAction`, `archiveFeeStructureAction`).
  - Server actions for Bulk Fee Assignment (`applyFeeStructureBulkAction`).
  - Build Staff UI at `src/app/(staff)/fee-entries/`.
  - Integration tests verifying bulk assignment idempotency and student leaver exclusions.
- **Dependencies:** Phase 1.

### Phase 3: Offline Payments & Manual Adjustments
- **Deliverables:**
  - Server actions for offline payment logging (`recordOfflinePaymentAction`) and adjustments (`recordAdjustmentAction`).
  - Validation: Mandatory external reference for offline payments; mandatory notes for adjustments.
  - UI modals on Staff Fee Directory.
  - Unit tests verifying ledger updates and audit logging.
- **Dependencies:** Phase 2.

### Phase 4: Flutterwave Core Integration
- **Deliverables:**
  - Flutterwave API Client wrapper in `src/lib/payments/flutterwave.ts` (using test environment keys).
  - Payment initiation endpoint (`src/app/api/payments/initiate/route.ts`).
  - Secure Webhook handler with timing-safe signature check (`src/app/api/payments/webhook/route.ts`).
  - Active verification fallback service (`src/lib/payments/verify.ts`).
  - Mock tests simulating webhook delivery, signature mismatch rejection, and idempotency.
- **Dependencies:** Phase 1.

### Phase 5: Parent Payment Interface & Receipt Generation
- **Deliverables:**
  - Parent UI at `src/app/(parent)/pay/` with multi-child selector and term breakdowns.
  - Amount selection component ($\ge$ ₦1,000 validation).
  - Payment callback/verification screen (`src/app/(parent)/pay/verify/`).
  - Printable official receipt view (`src/app/(parent)/pay/receipt/[receiptNumber]/`).
  - End-to-end tests for parent checkout flow.
- **Dependencies:** Phase 4.

### Phase 6: Reconciliation, Timeouts & Admin Refunds
- **Deliverables:**
  - Staff Payment Reconciliation screen at `src/app/(staff)/payments/`.
  - Admin refund action (`initiateRefundAction`) enforcing 30-day window and amount caps.
  - 24-hour stuck transaction expiration job/helper.
  - Final end-to-end security audit and penetration verification.
- **Dependencies:** Phase 5.

---

## 10. Outstanding Product Decisions for User Approval

Before proceeding with Phase 1 implementation, the following decisions require formal confirmation:

1. **Fee Catalog Schema Model (`FeeStructure`):**
   - *Question:* Do you approve adding the `FeeStructure` model to Prisma to enable reusable fee templates (with compulsory/optional flags and deadlines), or should staff enter raw `FeeEntry` rows manually for each student?
   - *Recommendation:* Approve `FeeStructure`. It prevents clerical data-entry errors and powers the class-based bulk application required by Addendum §3.5.

2. **Partial Payment Allocation Strategy:**
   - *Question:* When a parent makes a partial payment, should the system automatically allocate it to arrears (earliest unpaid terms) first via FIFO accounting, or should parents explicitly check off which specific fee items they are paying?
   - *Recommendation:* Adopt standard automated FIFO allocation. It simplifies parent UX, guarantees historical debts are cleared first, and avoids complex partial reconciliation states.

3. **Front-Desk Authority for Offline Payments:**
   - *Question:* Should staff members with `isFrontDesk: true` be permitted to log cash and bank transfer payments (`OFFLINE_PAYMENT`), or should offline payment recording be restricted strictly to Administrator / Bursar accounts?
   - *Recommendation:* Allow Front Desk staff to log `OFFLINE_PAYMENT` with mandatory receipt/teller references, since front-desk receptionists frequently receive walk-in bank deposit slips. Restrict `ADJUSTMENT` (waivers/corrections) strictly to Admin.

4. **Digital Receipt Presentation:**
   - *Question:* Should payment receipts be dynamically rendered as secure HTML web views with dedicated print/PDF styling, or do you require a binary PDF generation package (e.g. `pdfkit` / Puppeteer)?
   - *Recommendation:* Use high-fidelity HTML/CSS print templates. They render instantly on all mobile and desktop browsers, require zero heavy server-side PDF rendering dependencies, and allow direct "Save as PDF" on mobile devices.

5. **Term Management Formalization:**
   - *Question:* Currently, `SchoolSetting` holds session and term keys as unstructured text. Should we formalize term identification into a standardized composite string (e.g. `2026/2027-T1`, `2026/2027-T2`, `2026/2027-T3`) for fee indexing?
   - *Recommendation:* Yes. Standardizing term identifier strings provides consistent indexing across `FeeEntry` and `FeeStructure` without requiring complex extra tables.

---

*End of Design Document. Awaiting user review and approval before initiating Phase 1.*

