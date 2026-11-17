# SchoolPass Fee Management & Payment Workflow Corrections
## Authoritative Policy Alignment & Role Permission Realignment

**Document Version:** 1.0  
**Date:** 2026-11-11  
**Status:** Approved Policy Update  
**Supercedes:** Role & Permission proposals in [`docs/FEE_MANAGEMENT_AND_PAYMENT_WORKFLOW_PLAN.md`](file:///c:/Users/gbola/Desktop/SchoolPass/docs/FEE_MANAGEMENT_AND_PAYMENT_WORKFLOW_PLAN.md) and [`docs/FEE_MANAGEMENT_AND_PAYMENT_WORKFLOW_AUDIT.md`](file:///c:/Users/gbola/Desktop/SchoolPass/docs/FEE_MANAGEMENT_AND_PAYMENT_WORKFLOW_AUDIT.md)  
**Authoritative References:** [`docs/SchoolPass_PRD_v6.md`](file:///c:/Users/gbola/Desktop/SchoolPass/docs/SchoolPass_PRD_v6.md), [`docs/PRD_ADDENDUM_v6.1.md`](file:///c:/Users/gbola/Desktop/SchoolPass/docs/PRD_ADDENDUM_v6.1.md), [`RULES_PAYMENTS.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/Payments.md), [`RULES_AUTH.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/Auth.md), [`RULES_STAFF_UI.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/StaffUI.md), [`RULES_LOGGING.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/Logging.md)

---

## 1. Executive Summary & Policy Directive

This document establishes the official corrections to the SchoolPass Fee Management and Payment Workflow architecture following the Owner/Admin directive regarding offline payment recording and financial ledger mutations:

> ### Authoritative Policy Decision
> 1. **Admin Only:** Only an authenticated Administrator can record, verify, and confirm offline payments (physical cash, bank transfers, bank deposit tellers, POS receipts, etc.).
> 2. **Front Desk:** Staff accounts with front-desk privileges (`isFrontDesk === true`) **cannot** record, approve, verify, or confirm offline payments. They **cannot** independently alter a student's outstanding balance.
> 3. **General Staff / Teachers:** General staff accounts have **zero offline payment permissions** and no access to financial ledger records.
> 4. **Parents:** Can view their verified linked child's payment records and initiate online payments through Flutterwave.
> 5. **Core Financial Invariant:** **A payment screenshot, bank alert, or transfer notification must never automatically reduce a student's outstanding balance.** Only an authorized Admin confirmation against authoritative school banking records can update the financial ledger.

---

## 2. Capability & Permission Analysis

### 2.1 Does the Existing Role Structure Support This Decision?

**Yes, completely and natively.**

In fact, this decision aligns the payment workflow **more cleanly and securely** with the existing codebase than the earlier draft proposals.

#### Verified Existing Implementation:
1. **Database Schema ([`prisma/schema.prisma`](file:///c:/Users/gbola/Desktop/SchoolPass/prisma/schema.prisma#L18-L58)):**
   - The database defines `enum StaffRole { STAFF, ADMIN }`.
   - The database defines `StaffUser.isFrontDesk Boolean @default(false)`.
   - **No new role is necessary.** We do *not* need to invent a `BURSAR` or `FINANCE` role in Prisma, nor do we need to alter `enum StaffRole` (which [`RULES_DATA_MODEL.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/DataModel.md) Rule 4 declares is closed).
2. **Authentication & Authorization Helpers ([`src/lib/auth/index.ts`](file:///c:/Users/gbola/Desktop/SchoolPass/src/lib/auth/index.ts#L226-L274)):**
   - The system already provides [`assertAdminSession()`](file:///c:/Users/gbola/Desktop/SchoolPass/src/lib/auth/index.ts#L226), which strictly verifies `session.role === 'admin'`.
   - The system already provides [`assertFrontDeskAccess()`](file:///c:/Users/gbola/Desktop/SchoolPass/src/lib/auth/index.ts#L251), which grants access strictly to prospective student intake (`/students`).
3. **Decoupling from `isFrontDesk`:**
   - The previous draft plan incorrectly conflated prospective student intake with financial ledger authority.
   - Under this policy, `isFrontDesk` remains strictly confined to prospective student intake at `/students`. Front-desk staff have **zero financial mutation rights**.

### 2.2 What Changes in the System Logic?

No database schema changes or migrations are needed. What changes is the **authorization gate** applied to financial server actions:

| Server Action / Endpoint | Previous Draft Proposal | Corrected Implementation Gate |
|---|---|---|
| `recordOfflinePaymentAction` | Permitted `isFrontDesk === true` | **Strictly gated by `assertAdminSession()`** (Returns HTTP 403 / unauthorized error for any non-admin staff). |
| `recordAdjustmentAction` | Admin only | **Strictly gated by `assertAdminSession()`**. |
| `applyFeeStructureBulkAction` | Admin only | **Strictly gated by `assertAdminSession()`**. |
| `initiateRefundAction` | Admin only | **Strictly gated by `assertAdminSession()`** (Enforcing 30-day window per PRD §12.15). |
| `getStudentLedgerAction` (Staff) | Admin & Front Desk | Read-only lookup allowed for Admin. Front Desk access limited strictly to student lookup if explicitly needed for reception queries, with zero mutation controls. |

---

## 3. Realignment with Authoritative Documentation

### 3.1 PRD Baseline vs. Addendum v6.1 vs. Final Policy

| Document | Stated Offline Payment Rule | Status Under This Policy |
|---|---|---|
| **PRD v6.0 Baseline** | Did not specify offline payment tracking (§12 focused exclusively on online Flutterwave flow). | Enhanced by Addendum v6.1. |
| **PRD Addendum v6.1 §3.3** | *"Cash and bank-transfer payments received outside SchoolPass are recorded by Staff or Admin as an `OFFLINE_PAYMENT` entry."* | **Authoritative Policy Clarification:** Narrows the broad "Staff or Admin" phrasing to strictly **"Admin only"**. In SchoolPass, general staff accounts must not modify financial ledgers. |
| **`RULES_PAYMENTS.md` Rule 9** | *"The balance is decremented only when a payment reaches Successful status... A Pending or Failed payment never changes the balance."* | **Reaffirmed:** An offline payment updates the ledger *only* when an authenticated Admin creates the verified `FeeEntry` of type `OFFLINE_PAYMENT`. |
| **`RULES_STAFF_UI.md` Rule 5** | *"Staff do not see what Staff do not need. A Staff screen shows only what the capability requires."* | **Reaffirmed:** Teaching and front-desk staff have no operational need to alter financial accounts. Financial mutation controls are strictly hidden and blocked. |

---

## 4. Final Corrected Role-Permission Matrix

This matrix represents the authoritative access policy for all SchoolPass fee and payment operations:

```
[✓] Allowed (Enforced Server-Side)
[✗] Denied / Blocked (Server returns 403 Forbidden)
```

| Operational Capability | Admin / Owner | Front Desk (`isFrontDesk: true`) | General Staff / Teachers (`isFrontDesk: false`) | Parent / Guardian |
|---|:---:|:---:|:---:|:---:|
| **Configure Fee Catalog / Templates** | **✓** | ✗ | ✗ | ✗ |
| **Assign Fees (Bulk to Class or Individual)** | **✓** | ✗ | ✗ | ✗ |
| **Post Adjustments / Waivers (`ADJUSTMENT`)** | **✓** | ✗ | ✗ | ✗ |
| **Record & Confirm Offline Payments (`OFFLINE_PAYMENT`)** | **✓** | ✗ | ✗ | ✗ |
| **Verify Bank Deposit Tellers / Transfers** | **✓** | ✗ | ✗ | ✗ |
| **Initiate Online Refund (within 30 days)** | **✓** | ✗ | ✗ | ✗ |
| **View Full School Financial Ledger & Audit Logs** | **✓** | ✗ | ✗ | ✗ |
| **Look Up Student Balance (Front Desk Queries)** | **✓** | **✓** (Read-Only) | ✗ | ✗ |
| **Initiate Online Payment (Flutterwave)** | ✗ | ✗ | ✗ | **✓** (Linked child only) |
| **View Child Fee Balance & Itemized Breakdown** | ✗ | ✗ | ✗ | **✓** (Linked child only) |
| **Download Official Payment Receipt** | **✓** | ✗ | ✗ | **✓** (Linked child only) |

---

## 5. Corrected Offline Payment & Verification Workflow

This workflow guarantees that unverified claims, bank alerts, or transfer screenshots cannot fraudulently or mistakenly reduce a student's balance.

```mermaid
sequenceDiagram
    autonumber
    actor Parent as Parent / Guardian
    actor FrontDesk as Front Desk Officer
    actor Admin as School Administrator / Bursar
    participant Server as SchoolPass Server
    participant DB as Neon PostgreSQL Ledger

    Note over Parent,FrontDesk: Scenario: Parent pays via bank transfer or cash at bank
    Parent->>FrontDesk: Presents transfer screenshot / bank teller slip
    FrontDesk-->>Parent: Acknowledges receipt of document (Evidence only)
    Note over FrontDesk,Server: Front Desk CANNOT alter the ledger or record payment.
    Note over DB: Student Balance Remains UNCHANGED.

    FrontDesk->>Admin: Hands over teller slip / payment evidence
    Admin->>Admin: Cross-checks school bank statement for credit settlement
    
    alt Bank Credit Confirmed
        Admin->>Server: Calls recordOfflinePaymentAction { studentId, amount, tellerRef, note }
        Server->>Server: assertAdminSession() verifies Admin identity
        Server->>DB: Inserts FeeEntry(type: OFFLINE_PAYMENT, createdByStaffId: Admin.id)
        DB-->>Server: Record created
        Server-->>Admin: Offline payment recorded successfully
        Note over DB: Dynamic calculation instantly decrements student balance!
        Server-->>Parent: Updated balance and payment record visible in portal
    else Credit Not in Bank Statement
        Admin-->>FrontDesk: Flags payment as unconfirmed / rejected
        FrontDesk-->>Parent: Informs parent transfer has not settled; balance remains due
    end
```

### Detailed Operational Steps:

1. **Submission of Payment Evidence:**
   - A parent who pays outside SchoolPass (via bank transfer, cash deposit at a bank branch, or POS) brings physical proof (bank teller, POS receipt) or transmits digital evidence (transfer screenshot via WhatsApp to the Front Desk Officer).
2. **Zero-Trust Invariant at Intake:**
   - Neither the Front Desk Officer nor client-side software can credit the student's account upon receiving evidence.
   - The student's outstanding balance remains **100% active and unreduced**.
3. **Independent Financial Verification:**
   - The document or notification is passed to the Administrator (or School Bursar operating under the Admin account).
   - The Admin verifies that the funds have cleared into the school's bank account against authoritative bank statements.
4. **Admin Confirmation in SchoolPass:**
   - The Admin logs in through the Staff & Admin Interface, opens the student's ledger, and enters:
     - Exact cleared amount in NGN.
     - External bank reference / teller number.
     - Academic term to credit.
     - Mandatory internal note (e.g., *"Verified on Zenith Bank statement dated 2026-11-10, Ref #98124"*).
   - The server validates the payload, verifies `assertAdminSession()`, and transactionally commits an immutable `FeeEntry` of type `OFFLINE_PAYMENT`.
5. **Ledger Update:**
   - The dynamic balance engine immediately incorporates the new `OFFLINE_PAYMENT` record:
     $$\text{Outstanding Balance} = \text{Charges} - \text{Offline Payments} - \text{Online Payments}$$
   - The parent's dashboard reflects the payment under fee history as:
     > **Payment recorded by the school** (per Addendum §3.3)

---

## 6. Staff Interface Screen Adjustments

In accordance with [`RULES_FOLDER_MAP.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/FolderMap.md) and [`RULES_STAFF_UI.md`](file:///c:/Users/gbola/Desktop/SchoolPass/.agent/rules/StaffUI.md), the Staff and Admin payments interface at [`src/app/(staff)/payments/`](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/(staff)/payments/) will feature strict role-conditioned rendering:

### 6.1 View for Administrator Accounts (`session.role === 'admin'`):
- **Full Capabilities:**
  - Tab 1: **Fee Structures & Bulk Assignment** (Create fees, apply charges to classes or individual students).
  - Tab 2: **Student Ledger & Offline Confirmation** (Search students, view full ledgers, record verified `OFFLINE_PAYMENT` entries, post signed `ADJUSTMENT` entries).
  - Tab 3: **Online Transactions & Reconciliation** (List Flutterwave transactions, view verification logs, trigger 30-day refunds).

### 6.2 View for Front-Desk Staff Accounts (`session.role === 'staff' && isFrontDesk === true`):
- **Restricted Read-Only Capabilities:**
  - Can access a **Directory Lookup** tab to search a student by name or student number to view current outstanding balances when a parent asks at the reception desk.
  - **No Action Buttons:** The "Record Offline Payment", "Post Adjustment", "Apply Fee", and "Initiate Refund" buttons are completely removed from the DOM and blocked on the server.

### 6.3 View for General Staff / Teachers (`session.role === 'staff' && isFrontDesk === false`):
- **Zero Financial Access:**
  - Navigating to `/payments` immediately redirects or displays an access denied message (*"Unauthorized. Administrator privileges required."*).
  - No financial links appear in the navigation sidebar.

---

## 7. Remaining Product Decisions for User Confirmation

With the offline payment policy firmly locked to **Admin Only**, the following remaining implementation details require confirmation:

1. **Zero-Migration Approach for Fee Templates:**
   - *Confirmed Path:* We will **not** modify `prisma/schema.prisma` or create a `FeeStructure` table. Reusable fee templates will be stored in [`SchoolSetting`](file:///c:/Users/gbola/Desktop/SchoolPass/prisma/schema.prisma#L406) under the key `fee_templates` (JSON array), keeping the database schema untouched.
2. **Front Desk Read-Only Directory Access:**
   - *Question:* Do you want front-desk staff (`isFrontDesk === true`) to have **read-only** visibility into student fee balances so they can answer walk-in parent balance enquiries at the desk, or should the `/payments` section be restricted **exclusively to Admin**?
   - *Recommendation:* Provide read-only balance lookup for front-desk staff with all mutation forms stripped out. This allows them to answer *"How much do I owe?"* without having the power to alter the ledger.
3. **Receipt Generation Format:**
   - *Confirmed Path:* Clean, responsive HTML/CSS print templates with dedicated print media queries (`@media print`), enabling instant mobile/desktop printing and "Save as PDF" without heavy server-side PDF generation packages.

---

*End of Corrections Document. This document serves as the authoritative permission reference for all subsequent fee and payment implementations.*

