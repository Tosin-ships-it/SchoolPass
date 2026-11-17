# SchoolPass Fee Management & Payment Workflow Audit
## Comprehensive Validation, Documentation Reconciliation & Security Audit

**Document Version:** 1.0  
**Audit Date:** 2026-11-11  
**Target Document Reviewed:** [`docs/FEE_MANAGEMENT_AND_PAYMENT_WORKFLOW_PLAN.md`](file:///c:/Users/gbola/Desktop/SchoolPass/docs/FEE_MANAGEMENT_AND_PAYMENT_WORKFLOW_PLAN.md)  
**Authoritative Baselines:** [`docs/SchoolPass_PRD_v6.md`](file:///c:/Users/gbola/Desktop/SchoolPass/docs/SchoolPass_PRD_v6.md), [`docs/PRD_ADDENDUM_v6.1.md`](file:///c:/Users/gbola/Desktop/SchoolPass/docs/PRD_ADDENDUM_v6.1.md)  
**Governing Rules:** [`RULES_PAYMENTS.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/Payments.md), [`RULES_DATA_MODEL.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/DataModel.md), [`RULES_PRIVACY.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/Privacy.md), [`RULES_AUTH.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/Auth.md), [`RULES_LOGGING.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/Logging.md), [`RULES_CONFIG.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/Config.md), [`RULES_STAFF_UI.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/StaffUI.md), [`RULES_FOLDER_MAP.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/FolderMap.md)

---

## 1. Executive Summary

This audit evaluates the proposed Fee Management and Online Payment Workflow plan (`FEE_MANAGEMENT_AND_PAYMENT_WORKFLOW_PLAN.md`) against the authoritative documentation, the current PostgreSQL/Prisma schema, and project governance rules.

### Key Audit Findings

1. **The Existing Schema Already Fully Supports the Authoritative Ledger:**
   The existing models in [`prisma/schema.prisma`](file:///c:/Users/gbola/Desktop/SchoolPass/prisma/schema.prisma#L260-L328) ([`FeeEntry`](file:///c:/Users/gbola/Desktop/SchoolPass/prisma/schema.prisma#L266), [`Payment`](file:///c:/Users/gbola/Desktop/SchoolPass/prisma/schema.prisma#L291), and [`Refund`](file:///c:/Users/gbola/Desktop/SchoolPass/prisma/schema.prisma#L317)) are **already 100% compliant** with the revised specifications in PRD Addendum v6.1 §3.4 and §9.2. The core ledger calculation:
   $$\text{Outstanding Balance} = \sum(\text{CHARGE} + \text{ADJUSTMENT}) - \sum(\text{OFFLINE\_PAYMENT}) - \sum(\text{SUCCESSFUL Payments} - \text{CONFIRMED Refunds})$$
   can be executed **without adding a single new table, column, or migration**.
2. **The Proposed `FeeStructure` Model is an Unapproved Addition:**
   The workflow plan proposed introducing a new `FeeStructure` model to Prisma. While structured templates are helpful for UI data-entry convenience, **no such table exists in the PRD or Addendum v6.1**. Introducing it requires a Prisma schema migration and risks database drift. Reusable fee templates can be achieved without schema changes using the existing [`SchoolSetting`](file:///c:/Users/gbola/Desktop/SchoolPass/prisma/schema.prisma#L406) key-value store.
3. **Invalid Assumption Regarding Front-Desk Financial Permissions (`isFrontDesk`):**
   The workflow plan assumed staff with `isFrontDesk === true` should record offline payments and access financial directories. Inspection of [`src/lib/auth/index.ts`](file:///c:/Users/gbola/Desktop/SchoolPass/src/lib/auth/index.ts#L245-L274) and [`RULES_DATA_MODEL.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/DataModel.md#L190-L210) reveals that `isFrontDesk` was created solely for **prospective student registration and directory lookup at `/students`**. General staff accounts (teaching and front desk) currently have no financial authorization. Conflating student intake with financial ledger writes is a security and governance risk that requires explicit Owner/Admin approval.
4. **Folder Map and Route Violations:**
   The workflow plan proposed creating `src/app/(staff)/fee-entries/`. However, [`RULES_FOLDER_MAP.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/FolderMap.md#L45-L65) and [`RULES_STAFF_UI.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/StaffUI.md#L12-L25) strictly lock staff routes and only register `src/app/(staff)/payments/`. Under project rules, new routes cannot be created without updating the folder map first.
5. **Redundant Fields Identified:**
   The workflow plan's proposed additions of `Payment.receiptNumber` and `FeeEntry.reference` are redundant. `Payment.internalReference` (`@unique`) already serves as an unforgeable receipt identifier, and `FeeEntry.note` is already designated by Addendum §3.4 to store external offline payment references and adjustment justifications.

---

## 2. Corrections to the Original Workflow Plan

| Section in Original Plan | Proposed Content | Audit Finding & Required Correction |
|---|---|---|
| **§1.3 & §5.1 Database Models** | Proposed adding new `FeeStructure` table, adding `feeStructureId` and `reference` to `FeeEntry`, and adding `receiptNumber` to `Payment`. | **Correction:** **Reject unapproved Prisma additions.** Neither PRD v6.0 nor Addendum v6.1 defines `FeeStructure`. `Payment.internalReference` already provides a unique receipt key. The existing schema supports all required calculations. Template configurations can reside in `SchoolSetting`. |
| **§2.1 & §5.1 Screen Routes** | Proposed separate screen at `src/app/(staff)/fee-entries/`. | **Correction:** Violates [`RULES_FOLDER_MAP.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/FolderMap.md) and [`RULES_STAFF_UI.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/StaffUI.md). All staff payment verification, fee entry management, and offline recording must be housed under the approved route: [`src/app/(staff)/payments/`](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/(staff)/payments/), or `RULES_FOLDER_MAP.md` must be officially amended with user approval. |
| **§6 Role & Permission Matrix** | Assumed `isFrontDesk: true` automatically grants authority to record offline payments and view fee directories. | **Correction:** In the current implementation, `isFrontDesk` governs prospective student intake only ([`assertFrontDeskAccess`](file:///c:/Users/gbola/Desktop/SchoolPass/src/lib/auth/index.ts#L251)). Granting financial ledger access to front-desk staff requires an explicit business policy decision from the Owner/Admin. |
| **§3.3 Debt Allocation** | Stated that partial payments are allocated to arrears via automated FIFO accounting. | **Correction:** Clarify that FIFO is an **internal presentation rule**, not a database mutation. In Addendum §3.2, student balance is an aggregate ledger calculation; payments do not attach to specific `FeeEntry` foreign keys. |
| **§4.3 Return Verification** | Stated that the frontend return handler verifies payment with Flutterwave. | **Correction:** Enforce [`RULES_PAYMENTS.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/Payments.md) Rule 6: **"The return URL and query parameters never mark a payment successful."** The return page only renders a verifying spinner while calling a secure server action/endpoint that queries Flutterwave independently. |

---

## 3. Verified Existing Schema & Code Findings

Direct inspection of the codebase yields the following authoritative facts:

### 3.1 Prisma Models ([`prisma/schema.prisma`](file:///c:/Users/gbola/Desktop/SchoolPass/prisma/schema.prisma))

```prisma
// Existing in schema.prisma (Lines 260-328):

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
  amount           Decimal      @db.Decimal(12, 2)
  note             String?
  createdByStaffId String
  createdAt        DateTime     @default(now())

  student          Student      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  createdByStaff   StaffUser    @relation(fields: [createdByStaffId], references: [id], onDelete: Restrict)

  @@index([studentId, termId])
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
  internalReference    String        @unique
  flutterwaveReference String?       @unique
  status               PaymentStatus
  createdAt            DateTime      @default(now())
  verifiedAt           DateTime?

  student Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  parent  Parent   @relation(fields: [parentId], references: [id], onDelete: Cascade)
  refunds Refund[]

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
  status    RefundStatus
  createdAt DateTime     @default(now())

  payment Payment @relation(fields: [paymentId], references: [id], onDelete: Cascade)

  @@index([paymentId])
  @@map("refunds")
}
```

### 3.2 Staff Role & Permission Architecture ([`src/lib/auth/`](file:///c:/Users/gbola/Desktop/SchoolPass/src/lib/auth/))
- **`StaffUser.role`:** Enum `StaffRole` with only two values: `STAFF` and `ADMIN`.
- **`StaffUser.isFrontDesk`:** Boolean flag defaults to `false`. Added in Stage 2 (`intending_students`).
- **Authorization Helpers:**
  - [`assertAdminSession()`](file:///c:/Users/gbola/Desktop/SchoolPass/src/lib/auth/index.ts#L226): Checks `session.role === 'admin'`.
  - [`assertFrontDeskAccess()`](file:///c:/Users/gbola/Desktop/SchoolPass/src/lib/auth/index.ts#L251): Checks `session.role === 'admin' || (session.role === 'staff' && staff.isFrontDesk)`.
  - **There is no Bursar, Accountant, or Finance role in the database.**

### 3.3 Payment Directory Contents
- [`src/lib/payments/`](file:///c:/Users/gbola/Desktop/SchoolPass/src/lib/payments/) $\rightarrow$ `api/.gitkeep`
- [`src/app/(parent)/pay/`](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/(parent)/pay/) $\rightarrow$ `.gitkeep`
- [`src/app/(staff)/payments/`](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/(staff)/payments/) $\rightarrow$ `.gitkeep`
- [`src/app/api/payments/`](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/api/payments/) $\rightarrow$ `.gitkeep`
- **Result:** No payment business logic, checkout forms, webhook listeners, or verification routines exist in the codebase today.

---

## 4. Financial Data Model Audit

### 4.1 What fields and relationships already exist in `FeeEntry` and `Payment`?
- **`FeeEntry`:**
  - Fields: `id` (CUID), `studentId`, `termId` (String), `type` (`CHARGE`, `ADJUSTMENT`, `OFFLINE_PAYMENT`), `amount` (`Decimal(12,2)`), `note` (`String?`), `createdByStaffId`, `createdAt` (`DateTime`).
  - Relations: Mandatory relation to `Student` (`onDelete: Cascade`), mandatory relation to `StaffUser` as creator (`onDelete: Restrict`).
- **`Payment`:**
  - Fields: `id` (CUID), `studentId`, `parentId`, `amount` (`Decimal(12,2)`), `internalReference` (`String @unique`), `flutterwaveReference` (`String? @unique`), `status` (`PaymentStatus`), `createdAt`, `verifiedAt` (`DateTime?`).
  - Relations: Mandatory relation to `Student`, mandatory relation to `Parent`, one-to-many relation to `Refund`.

### 4.2 Can the existing models support the proposed ledger without restructuring?
**Yes, completely.**
The existing schema natively supports the full Addendum v6.1 §3.2 mathematical formulation:
```typescript
Total Charges = Sum(FeeEntry.amount WHERE type IN ['CHARGE', 'ADJUSTMENT'] AND termStarted <= now)
Total Offline Payments = Sum(FeeEntry.amount WHERE type == 'OFFLINE_PAYMENT')
Total Online Payments = Sum(Payment.amount WHERE status IN ['SUCCESSFUL', 'REFUNDED']) 
                        - Sum(Refund.amount WHERE status == 'CONFIRMED')

Outstanding Balance = Total Charges - Total Offline Payments - Total Online Payments
```
No restructuring, column modifications, or table additions are required to achieve accurate balance reporting.

### 4.3 Is a new `FeeStructure` model genuinely required by the PRD/Addendum?
**No.**
Neither `SchoolPass_PRD_v6.md` nor `PRD_ADDENDUM_v6.1.md` mandates a `FeeStructure` table. Addendum §3.5 specifies that staff apply charges to a school or class, which creates individual `FeeEntry` records. The application can store standard fee templates in the existing [`SchoolSetting`](file:///c:/Users/gbola/Desktop/SchoolPass/prisma/schema.prisma#L406) table under a JSON configuration key (e.g. `fee_templates`), identical to how `configured_classes` and `configured_sessions` are managed. This achieves reusable fee definitions while maintaining database schema stability.

### 4.4 How will offline payments be represented?
An offline payment is stored as a `FeeEntry` record where:
- `type = OFFLINE_PAYMENT`.
- `amount > 0` (strictly positive decimal).
- `note = "Teller/Receipt #... - Method: Cash/Transfer - Details..."` (mandatory).
- `createdByStaffId` records the staff member who accepted the payment.
- `Payment` table is **not touched**. No Flutterwave reference is generated.

### 4.5 How will online payments be represented?
An online payment is stored in the `Payment` table where:
- Status transitions: `PENDING` $\rightarrow$ `SUCCESSFUL` or `FAILED`.
- Has an immutable `internalReference` (`SP-PAY-YYYY-CUID`).
- Has a verified `flutterwaveReference` and `verifiedAt` timestamp.
- Credited toward the student's dynamic balance calculation as verified revenue.

### 4.6 Can any payment be counted twice?
**No, provided the state machine and ledger calculation are strictly implemented:**
1. The dynamic ledger only includes `Payment` records with status `SUCCESSFUL` or `REFUNDED` (less confirmed refunds). `PENDING` and `FAILED` records are ignored.
2. Webhook processing is idempotent: if a payment is already `SUCCESSFUL`, incoming webhooks return HTTP 200 immediately without executing database updates.
3. Database status updates use atomic condition checks (`WHERE id = ... AND status = 'PENDING'`), eliminating race conditions between the browser return redirect and asynchronous webhooks.

### 4.7 How will reversals, refunds and adjustments work without modifying historical records?
- **Fee Entry Corrections:** In accordance with Addendum §3.4, `FeeEntry` records are strictly immutable. To correct an erroneous charge, Admin logs a `FeeEntry` of type `ADJUSTMENT` with a signed amount (negative to credit/reduce balance, positive to debit) and an explanatory note.
- **Offline Payment Reversals:** A mistaken cash/teller entry is reversed with an `ADJUSTMENT` entry referencing the original note.
- **Online Payment Refunds:** A refund is created as a `Refund` record linked to the original `Payment`. When confirmed by Flutterwave, the refund amount offsets the payment total in the dynamic ledger formula, thereby increasing the outstanding debt by the exact refunded amount.

### 4.8 How will outstanding balances be calculated accurately across multiple terms?
- The backend queries all `FeeEntry` and `Payment` records for the student across all terms.
- Terms are partitioned by start date (via school term configuration in `SchoolSetting`):
  - **Arrears (Earlier Terms):** Sum of charges minus payments for terms that ended prior to the current term.
  - **Current Term:** Sum of charges minus payments for the active term.
  - **Future Terms:** Charges for terms that have not yet started are excluded from the balance calculation entirely (Addendum §3.2).

### 4.9 How will concurrent payments and duplicate webhook notifications be handled?
1. **Concurrent Payments for Same Student:**
   If a parent initiates a payment while another is `PENDING`, [`RULES_PAYMENTS.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/Payments.md) Rule 5 mandates reusing the existing pending attempt rather than creating a second pending payment.
2. **Duplicate Webhook Delivery:**
   When Flutterwave retries a webhook, the handler checks `payment.status`. If already `SUCCESSFUL`, it returns HTTP 200 immediately. Because balance is a computed sum of records rather than an incremental counter decrement, duplicate notifications cannot double-decrement a balance.

---

## 5. Minimum Necessary Schema Changes

To adhere to the core rule: **"Never touch the database directly; any schema change must be requested from the user and recorded in `RULES_DATA_MODEL.md` first,"** we evaluated whether schema changes are required.

### 5.1 Recommendation: Zero Schema Migrations for Phase 1

| Proposed Table / Column in Workflow Plan | Is It Essential? | Zero-Migration Alternative | Recommendation |
|---|:---:|---|:---:|
| **`FeeStructure` Table** | No | Store fee templates in `SchoolSetting` (`key: "fee_templates"`). Bulk assignment reads templates and batch-inserts standard `FeeEntry` records. | **Omit from schema.** Avoid unnecessary migrations. |
| **`FeeEntry.feeStructureId`** | No | Store template name in `FeeEntry.note`. | **Omit from schema.** |
| **`FeeEntry.reference`** | No | Addendum §3.4 already specifies that `FeeEntry.note` holds external teller/receipt references. | **Omit from schema.** |
| **`Payment.receiptNumber`** | No | `Payment.internalReference` (`@unique`) is already a permanent, unique receipt identifier. | **Omit from schema.** |
| **`Refund.reason`** | No | Audit logs record the reason for refund via structured JSON logging ([`RULES_LOGGING.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/Logging.md)). | **Omit from schema.** |

**Conclusion:** The existing Prisma schema is **100% sufficient** to implement fee entries, offline payments, Flutterwave online payments, dynamic balances, and refunds without altering `schema.prisma` or running database migrations.

---

## 6. Permissions & Role-Permission Matrix Audit

### 6.1 Critical Authorization Findings
1. **Staff Roles in Database:** The database only supports `StaffRole.STAFF` and `StaffRole.ADMIN`. There is no separate "Bursar" or "Finance" role.
2. **`isFrontDesk` Boundary:** In Stage 2, `isFrontDesk` was introduced exclusively to gate intending student intake (`assertFrontDeskAccess`).
3. **PRD v6.0 §7.1 vs. §7.2 Boundary:**
   - **Staff** can: "Review and verify payment records" (PRD §7.1).
   - **Admin** can: "Managing payment configuration ... operational settings" (PRD §7.2).
   - **Admin Only:** "Only Admin can initiate a refund" (PRD §12.15).

### 6.2 Corrected Role-Permission Matrix

| Action | Admin / Owner | Front Desk (`isFrontDesk: true`) | General Staff (`isFrontDesk: false`) | Parent / Guardian |
|---|:---:|:---:|:---:|:---:|
| **Configure Fee Templates (in SchoolSetting)** | Allowed | Denied | Denied | Denied |
| **Apply Bulk Charges to Class/School** | Allowed | Denied | Denied | Denied |
| **Apply Individual Student Charge** | Allowed | Denied | Denied | Denied |
| **Record Offline Payment (`OFFLINE_PAYMENT`)** | Allowed | **Requires Approval** (Default: Denied) | Denied | Denied |
| **Post Adjustment / Waiver (`ADJUSTMENT`)** | Allowed | Denied | Denied | Denied |
| **Initiate Flutterwave Refund** | Allowed (within 30d) | Denied | Denied | Denied |
| **View Student Outstanding Balance** | Allowed | Allowed (via Search) | Denied | Allowed (Linked Only) |
| **View Online Transactions & Status** | Allowed | Allowed (Read-only) | Denied | Allowed (Own child) |
| **Initiate Online Payment (Flutterwave)** | Denied | Denied | Denied | Allowed (Linked Only) |
| **View / Print Payment Receipt** | Allowed | Allowed | Denied | Allowed (Linked Only) |

> [!IMPORTANT]
> General teaching staff (`isFrontDesk: false`) must have **zero access** to student fee balances, ledgers, or payment verification screens. This honors [`RULES_STAFF_UI.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/StaffUI.md) Rule 5: *"Staff do not see what Staff do not need."*

---

## 7. Challenge of Proposed Business Rules

Each rule proposed in the original workflow plan has been challenged and classified:

```
[1] Explicitly Required by Documentation
[2] Supported by Existing Implementation
[3] Reasonable Technical Recommendation
[4] Business Decision Requiring Approval
[5] Unnecessary or Potentially Problematic
```

### 1. ₦1,000 Minimum Partial Payment
- **Classification:** `[1] Explicitly Required by Documentation`
- **Citation:** PRD v6.0 §12.5, §17; [`RULES_PAYMENTS.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/Payments.md) Rule 10.
- **Evaluation:** Locked by documentation. Enforced server-side during payment initiation.

### 2. FIFO Allocation of Partial Payments
- **Classification:** `[3] Reasonable Technical Recommendation` & `[4] Business Decision Requiring Approval`
- **Citation:** PRD Addendum v6.1 §3.1 & §3.2.
- **Evaluation:** The Addendum computes a single aggregate balance per student. In the UI, allocating payments to earlier term debt first is standard Nigerian school accounting. Requires formal user sign-off.

### 3. Online Payments Initiated Per Individual Student
- **Classification:** `[1] Explicitly Required by Documentation` & `[2] Supported by Existing Implementation`
- **Citation:** PRD v6.0 §12.18; [`prisma/schema.prisma`](file:///c:/Users/gbola/Desktop/SchoolPass/prisma/schema.prisma#L293).
- **Evaluation:** `Payment.studentId` is a non-nullable foreign key. A parent with multiple children must pay separately per child. This ensures uncompromised audit trails and clean reconciliation.

### 4. 15-Minute Payment Verification Fallback
- **Classification:** `[1] Explicitly Required by Documentation`
- **Citation:** PRD v6.0 §12.21, §17; [`RULES_PAYMENTS.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/Payments.md) Rule 12.
- **Evaluation:** Locked by documentation. If no webhook arrives within 15 minutes, an active server call verifies the transaction with Flutterwave.

### 5. 24-Hour Stuck Pending Transaction Timeout
- **Classification:** `[1] Explicitly Required by Documentation`
- **Citation:** PRD v6.0 §12.21, §17; [`RULES_PAYMENTS.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/Payments.md) Rule 12.
- **Evaluation:** Locked by documentation. Transactions unverified after 24 hours are transitioned to `FAILED`, unlocking retry attempts.

### 6. 30-Day Admin Refund Window
- **Classification:** `[1] Explicitly Required by Documentation`
- **Citation:** PRD v6.0 §12.15, §17; [`RULES_PAYMENTS.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/Payments.md) Rule 10.
- **Evaluation:** Locked by documentation. Admin can initiate refunds only within 30 days of the original payment.

### 7. Standardized Academic Term Identifiers (e.g. `2026/2027-T1`)
- **Classification:** `[3] Reasonable Technical Recommendation` & `[4] Business Decision Requiring Approval`
- **Citation:** `schema.prisma` defines `FeeEntry.termId String`.
- **Evaluation:** Using structured composite strings (e.g. `2026/2027-T1`, `2026/2027-T2`, `2026/2027-T3`) provides consistent grouping across `FeeEntry` records without adding an `AcademicTerm` table.

### 8. HTML/CSS Printable Receipts
- **Classification:** `[3] Reasonable Technical Recommendation` & `[4] Business Decision Requiring Approval`
- **Citation:** PRD v6.0 §12.17 states format is configurable.
- **Evaluation:** Responsive HTML with print media queries (`@media print`) avoids heavy, unstable headless browser/binary PDF dependencies on serverless environments.

---

## 8. Flutterwave Integration Security Verification

A rigorous review of Flutterwave API security mechanics confirms:

### 8.1 Webhook Signature Authentication
- **Mechanism:** Flutterwave sends a custom header `verif-hash` matching the secret hash configured in the Flutterwave dashboard.
- **Implementation Requirement:** The server compares `req.headers.get('verif-hash')` with `process.env.FLUTTERWAVE_WEBHOOK_SECRET`.
- **Security Rule:** Must use Node.js `crypto.timingSafeEqual` over buffers to prevent timing side-channel attacks.

### 8.2 Server-to-Server Transaction Verification
- **API Endpoint:** `GET https://api.flutterwave.com/v3/transactions/:id/verify`.
- **Verification Invariants:**
  1. `data.status === "successful"`.
  2. `data.tx_ref === payment.internalReference` (Guarantees token-binding).
  3. `data.currency === "NGN"` (Guarantees currency integrity; prevents cross-currency spoofing).
  4. `Decimal(data.amount) >= payment.amount` (Guarantees full payment).
- **Security Rule:** Browser return query parameters (`status=successful`) must **never** be trusted.

### 8.3 Idempotent Processing & Race Protection
- **Atomic State Transitions:**
  Status updates must execute conditionally:
  ```typescript
  const updated = await prisma.payment.updateMany({
    where: { id: paymentId, status: 'PENDING' },
    data: { status: 'SUCCESSFUL', verifiedAt: new Date(), flutterwaveReference }
  });
  ```
  If `updated.count === 0`, another process (e.g. webhook vs. user redirect) has already finalized the transaction. This guarantees zero duplicate credits.

### 8.4 Network Disconnects & Abandoned Payments
- If a parent completes payment on Flutterwave but closes the browser before returning to SchoolPass, the **Flutterwave Webhook** independently catches and confirms the transaction.
- If the webhook is also delayed, the **15-Minute Fallback** or on-demand parent refresh calls the verification endpoint to recover the payment status.

---

## 9. Authoritative Documentation Conflicts & Ambiguities

During the audit, three discrepancies were surfaced between PRD v6.0 and Addendum v6.1:

1. **Fee Balance Persistence:**
   - *Conflict:* PRD v6.0 §10.2 & §12.4 referenced a stored `FeeBalance` record that is decremented.
   - *Resolution:* Addendum v6.1 §3.2 explicitly overrides this: balance is computed dynamically from `FeeEntry` and `Payment` records.
2. **Term Rollover & Debt Reset:**
   - *Conflict:* PRD v6.0 §10.1 stated fee figures reset to the new term at rollover.
   - *Resolution:* Addendum v6.1 §3.1 explicitly overrides this: unpaid fees accumulate across terms.
3. **Screen Names in Navigation:**
   - *Conflict:* [`RULES_STAFF_UI.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/StaffUI.md) lists "Payment verification (`Payment`, `Refund`)", but Addendum §8.3 lists "Fee Entries" and "Payments" as separate staff tabs.
   - *Resolution:* Combine fee entry management and payment verification under the authorized route [`src/app/(staff)/payments/`](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/(staff)/payments/) using tabs, or officially update [`RULES_FOLDER_MAP.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/FolderMap.md) to add `src/app/(staff)/fee-entries/`.

---

## 10. Business Decisions Requiring User Approval

The following four business decisions must be confirmed by the product owner before implementation:

1. **Zero-Migration Approach vs. `FeeStructure` Table:**
   - *Option A (Recommended):* Implement fee templates inside `SchoolSetting` without modifying `prisma/schema.prisma` or running migrations.
   - *Option B:* Modify `prisma/schema.prisma` to create `FeeStructure` and link it to `FeeEntry`, requiring a schema migration.
2. **Staff Permission Scope for Offline Payments:**
   - *Option A:* Only Administrator accounts can record cash/transfer payments (`OFFLINE_PAYMENT`).
   - *Option B (Recommended):* Allow staff with `isFrontDesk: true` to record offline payments with mandatory teller numbers, while restricting waivers and adjustments (`ADJUSTMENT`) strictly to Admin.
3. **Staff Interface Route Architecture:**
   - *Option A (Recommended):* House both Fee Entries and Payment Verification under the existing approved route [`src/app/(staff)/payments/`](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/(staff)/payments/) using tabs (*Fee Management* and *Online Transactions*).
   - *Option B:* Formally update [`RULES_FOLDER_MAP.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/FolderMap.md) and [`RULES_STAFF_UI.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/StaffUI.md) to add a separate `src/app/(staff)/fee-entries/` route.
4. **Receipt Generation Format:**
   - Confirm using high-contrast, mobile-friendly HTML/CSS printable receipts with browser print-to-PDF support, avoiding server-side binary PDF dependencies.

---

## 11. Recommended Implementation Sequence

Once the decisions above are approved, implementation should proceed in 5 strictly controlled phases:

1. **Phase 1: Dynamic Ledger Math & Unit Tests**
   - Implement `computeStudentBalance(studentId)` in `src/lib/payments/ledger.ts`.
   - Unit tests covering arrears accumulation, offline payments, adjustments, and leaver exclusion.
2. **Phase 2: Staff Fee & Payment Interface (`/payments`)**
   - Bulk and individual fee assignment actions.
   - Offline payment recording and signed adjustment forms.
   - Transaction list and audit view.
3. **Phase 3: Flutterwave Core Integration**
   - Server-side Flutterwave client with test keys.
   - Payment initiation action (`POST /api/payments/initiate`).
   - Timing-safe webhook listener (`POST /api/payments/webhook`).
   - Active verification helper.
4. **Phase 4: Parent Portal (`/pay`) & Verification**
   - Multi-child fee breakdown view with arrears display.
   - Payment checkout redirect and verifying loading state.
   - Digital receipt view (`/pay/receipt/[reference]`).
5. **Phase 5: Timeouts, Fallbacks & Refunds**
   - 15-minute fallback verification routine.
   - 24-hour stuck payment timeout handler.
   - 30-day Admin refund workflow.

---

*End of Audit Report. Awaiting user review and approval before proceeding.*

