# SchoolPass Project Journal

This journal records key product, UX, and technical decisions, architectural milestones, and important discoveries throughout the lifecycle of SchoolPass.

---

## [Entry 001] — PRD v6.0 Baseline Specification

- **Category:** Product Specification / Baseline Architecture
- **References:** [SchoolPass_PRD_v6.md](file:///c:/Users/gbola/Desktop/SchoolPass/docs/SchoolPass_PRD_v6.md)

### Context & Scope
SchoolPass v6.0 PRD established the core baseline for a private web application serving parents, guardians, and staff of a single Nigerian primary/secondary school (~400 students).

### Key Decisions
1. **MVP Scope Defined (F-1 through F-5):**
   - **F-1 Ask the School:** Retrieval-augmented Q&A answering parent queries strictly from approved school policies and information.
   - **F-2 My Child's Records:** Parent access to their child's attendance and fee status.
   - **F-3 Confirm Arrival:** Gate drop-off confirmation via QR code or manual 6-digit code.
   - **F-4 Pay Fees:** Online fee payment in Nigerian Naira (NGN) via Flutterwave checkout.
   - **F-5 Ask the Office:** Routing unanswered inquiries to the school Front Desk Officer via WhatsApp.
   - **Staff & Admin Interface:** Dedicated administrative interface for staff operations.
2. **Explicit Non-Goals:**
   - Excluded social feeds, parent-to-parent chat, teacher messaging, live classes, homework, report cards/exam grades, bus tracking, GPS location tracking, push notifications, native apps, multi-school accounts, AI academic advice, medical/disciplinary records, biometrics, and multi-turn AI conversations.
3. **Core Architectural Invariants:**
   - **Privacy Boundary:** Complete segregation between shared public information (`ApprovedSchoolInfo`) and private student records. Private records must never be embedded or passed to the AI.
   - **Server-Side Authorization:** Every student-related request strictly validates the authenticated `ParentStudent` relationship on the server.
   - **Financial Accuracy:** All monetary amounts represented in NGN with 2 decimal places. No floating-point arithmetic.
   - **Timezone:** Standardized on `Africa/Lagos`.

---

## [Entry 002] — PRD Addendum v6.1 Approved Amendments & Clarifications

- **Category:** Product Decisions / Technical Clarifications
- **References:** [PRD_ADDENDUM_v6.1.md](file:///c:/Users/gbola/Desktop/SchoolPass/docs/PRD_ADDENDUM_v6.1.md)

### Context & Scope
Addendum v6.1 amended and finalized key implementation decisions for v1, resolving ambiguities and superseding specific PRD v6.0 sections.

### Key Decisions & Changes
1. **Attendance Model & Automation:**
   - Model unified as `AttendanceRecord` (replacing `StaffAttendanceRecord`) with source enum `AttendanceSource` (`STAFF` | `PARENT_CONFIRMATION`).
   - A successful parent arrival confirmation creates a `PRESENT` record with source `PARENT_CONFIRMATION` if no staff record exists for that date. Existing staff records are never overwritten by parent confirmations.
   - Unresolved attendance is displayed as **Not recorded yet** rather than automatic `ABSENT`.
2. **Cumulative Fees & Computed Balances:**
   - Outstanding fees accumulate across academic terms; balances do not reset at term rollover.
   - `FeeBalance` is a **computed value** at runtime (`Charges − Offline payments − Online payments`), not an editable database table.
   - Replaced `FeeCharge` with immutable `FeeEntry` supporting types: `CHARGE`, `ADJUSTMENT`, and `OFFLINE_PAYMENT` (for cash/bank transfer recorded by staff).
   - Approved bulk fee application by school or class in addition to individual student entries.
3. **Student Leavers Lifecycle:**
   - Added `leftAt DateTime?` to `Student`.
   - When marked as a leaver, parent access to student records terminates immediately, even if a balance remains. Existing `ParentStudent` links are retained.
   - Automated 7-year data deletion jobs are deferred from v1 (governed by compliance policy).
4. **Parent Registration & Access:**
   - Parents self-register (name, email, password) and verify their email before first sign-in. Staff link verified parents to students.
   - Verified unlinked parents may access Profile, Ask the School, and Ask the Office, but cannot access student-specific features.
   - No parent phone number collection or phone-based lookups in v1.
5. **AI Cost Controls & Stateless Reporting:**
   - v1 operates within the AI provider's free tier. No monetary budget required.
   - Governed by an Admin-configured **global daily question cap** (if unset or 0, Ask the School is disabled) and a personal parent daily limit of 20 questions/day.
   - Normal Q&A is not persisted. Answer reports use server-signed cryptographic tokens verified upon submission and saved into `AnswerReport` (90-day retention default).
6. **Feature Deferrals:**
   - Automated arrival reminders and SMS integration are deferred entirely from v1.
   - Parent-facing browse catalog for approved school info is excluded (Ask the School is the sole parent interface).
7. **Staff Interface Scope:**
   - Confirmed 10 screens: Dashboard, Students, Attendance, Arrival Code, Fee Entries, Payments, Approved School Information, Guardian Links, Ask the School reports, and Settings.

---

## [Entry 003] — Project Scaffolding & Design Token Architecture

- **Category:** Technical Architecture / Implementation Milestone
- **References:** [package.json](file:///c:/Users/gbola/Desktop/SchoolPass/package.json), [convert-tokens.js](file:///c:/Users/gbola/Desktop/SchoolPass/convert-tokens.js), [tokens.css](file:///c:/Users/gbola/Desktop/SchoolPass/tokens.css)

### Context & Scope
Initial project structure setup and design token transformation.

### Key Milestones
1. **Stack Dependencies Configured:**
   - Next.js 15.2.1, React 19, TypeScript 5.8.2, Prisma 6.4.1, and `server-only` initialized.
2. **Design Token Pipeline:**
   - Token specifications in `design-tokens.tokens.json` mapped into CSS custom properties via `convert-tokens.js`, generating `tokens.css`.
   - Script wired into `package.json` under `npm run tokens`.
3. **Directory Structure Established:**
   - Scaffolded domain structure matching `RULES_FOLDER_MAP.md` under `src/app/(parent)/`, `src/app/(staff)/`, `src/app/api/`, and `src/lib/`.
   - Server-only boundary files designated for database, auth, payments, and logging.

---

## [Entry 004] — Source-of-Truth Hierarchy & Context Verification

- **Category:** Architecture / Governance
- **References:** [AGENTS.md](file:///c:/Users/gbola/Desktop/SchoolPass/AGENTS.md), [SchoolPass_PRD_v6.md](file:///c:/Users/gbola/Desktop/SchoolPass/docs/SchoolPass_PRD_v6.md), [PRD_ADDENDUM_v6.1.md](file:///c:/Users/gbola/Desktop/SchoolPass/docs/PRD_ADDENDUM_v6.1.md)

### Context & Scope
Pre-implementation audit establishing strict documentation hierarchy and identifying discrepancies between older supporting `.agent/rules/` and Addendum v6.1.

### Key Decisions & Discoveries
1. **Hierarchy Formally Established:**
   - Layer 1: PRD v6.0 (baseline) + Addendum v6.1 (superseding amendment).
   - Layer 2: Supporting context files (`AGENTS.md`, `.agent/rules/`, `.agent/skills/`) serve as guidance only and do not override the PRD or Addendum.
2. **Audited Rule Discrepancies Reconciled:**
   - Reconciled attendance generation from arrival confirmations against stale `Attendance.md` / `confirm-arrival` skill rules.
   - Reconciled computed `FeeBalance` and `FeeEntry` against stale stored `FeeBalance` records in `Payments.md` / `handle-payment-webhook` skill.
   - Reconciled parent self-registration and exclusion of phone/SMS from `Auth.md` and `Config.md`.
   - Reconciled free-tier AI global daily cap against monthly monetary ceilings in `Ai.md`.
   - Confirmed no unresolved product decisions block core implementation.

---

## [Entry 005] — Landing Page & Authentication System Implementation

- **Category:** Implementation Milestone
- **References:** [PRD_ADDENDUM_v6.1.md](file:///c:/Users/gbola/Desktop/SchoolPass/docs/PRD_ADDENDUM_v6.1.md), [SchoolPass_PRD_v6.md](file:///c:/Users/gbola/Desktop/SchoolPass/docs/SchoolPass_PRD_v6.md), [src/app/page.tsx](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/page.tsx), [src/lib/auth/index.ts](file:///c:/Users/gbola/Desktop/SchoolPass/src/lib/auth/index.ts), [src/middleware.ts](file:///c:/Users/gbola/Desktop/SchoolPass/src/middleware.ts)

### Context & Scope
Implementation of the SchoolPass public landing page and end-to-end authentication system in strict compliance with PRD v6.0 and Addendum v6.1 specifications.

### Key Deliverables
1. **Public Landing Page (`src/app/page.tsx`):**
   - Built with official SchoolPass design tokens (`DM Sans`, semantic color roles, soft shadows).
   - Reflects core product promise: *"The school's answers. Your child's records. One place."*
   - Outlines core services F-1 through F-5 and the 3-step parent onboarding workflow (Register &rarr; Verify Email &rarr; Staff Link).
   - Provides explicit entry paths into Parent Sign In, Parent Registration, and Staff & Admin portal.
2. **Authentication Infrastructure (`src/lib/auth/`):**
   - Zero-dependency security implementation utilizing Node.js `node:crypto` for modern slow password hashing (`scrypt`), cryptographically secure random token generation, and HMAC-SHA256 session signatures.
   - Generic authentication responses preventing account enumeration.
   - Brute-force rate limiting per account/IP.
   - Strict segregation between Parent and Staff/Admin sessions.
   - Parent self-registration with email verification before first login.
   - Single-use, expiring password reset links with password reuse protection (last 3 passwords).
   - Server-side parent-to-student authorization check (`checkParentStudentAuthorization`).
3. **Authentication Pages & Routes (`src/app/auth/` & `src/app/api/auth/`):**
   - Parent Sign In (`/auth/login`), Parent Registration (`/auth/register`), Email Verification (`/auth/verify-email`), Staff & Admin Sign In (`/auth/staff-login`), Password Recovery (`/auth/forgot-password`), and Reset Password (`/auth/reset-password`).
4. **Route Protection & Middleware (`src/middleware.ts`):**
   - Enforces authentication boundaries across parent routes (`/ask`, `/records`, `/arrival`, `/pay`, `/office`) and staff routes (`/attendance`, `/info`, etc.).
5. **Validation:**
   - Both `npm run typecheck` and `npm run lint` pass cleanly with zero errors. All routes compile and respond with HTTP 200 in the development environment.

---

## [Entry 006] — Head Metadata, Dynamic Titles, Public SEO, and Favicon Configuration

- **Category:** Metadata & SEO Architecture
- **References:** [src/app/layout.tsx](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/layout.tsx), [src/app/page.tsx](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/page.tsx), [src/app/icon.svg](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/icon.svg), [src/app/(parent)/layout.tsx](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/%28parent%29/layout.tsx), [src/app/(staff)/layout.tsx](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/%28staff%29/layout.tsx), [src/app/auth/layout.tsx](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/auth/layout.tsx)

### Context & Scope
Implementation of dynamic page titles, four-word application description, public marketing SEO metadata, private route exclusion, and blue rectangular favicon.

### Key Deliverables
1. **Dynamic Page Titles:**
   - Root title template configured as `%s | SchoolPass` with default `SchoolPass` in `src/app/layout.tsx`.
   - Each auth and portal page exports explicit page titles (`Parent Sign In`, `Create Parent Account`, `Staff & Admin Sign In`, `Ask the School`, `Staff Attendance`).
2. **Four-Word Application Description:**
   - Configured as `"Private school parent portal"` across root layout and home page metadata.
3. **Public Marketing SEO (Home Page Only):**
   - Configured strictly on `src/app/page.tsx` using `NEXT_PUBLIC_APP_URL` (with fallback to `https://schoolpass.ng`).
   - Sourced OpenGraph (`og:title`, `og:description`, `og:url`, `og:locale`, `og:site_name`, `og:type`) and Twitter (`twitter:card`, `twitter:title`, `twitter:description`).
4. **Private Route SEO Exclusions:**
   - Route group layouts created for `/(parent)/*`, `/(staff)/*`, and `/auth/*` explicitly disabling indexing (`robots: { index: false, follow: false, nocache: true }`).
5. **Favicon:**
   - Generated `src/app/icon.svg` featuring a blue rectangle (`#087e8b`) with a centered bold white letter **S**.
6. **Validation:**
   - `npm run typecheck` and `npm run lint` passed with 0 errors. Verified in local environment.

---

## [Entry 007] — Dedicated Legal Routes, Authenticated Shells, and Navigation Refinements

- **Category:** Application Architecture & UX Enhancements
- **References:** [src/app/privacy/page.tsx](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/privacy/page.tsx), [src/app/terms/page.tsx](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/terms/page.tsx), [src/app/(parent)/ask/page.tsx](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/%28parent%29/ask/page.tsx), [src/app/(staff)/attendance/page.tsx](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/%28staff%29/attendance/page.tsx), [src/app/auth/register/ParentRegisterForm.tsx](file:///c:/Users/gbola/Desktop/SchoolPass/src/app/auth/register/ParentRegisterForm.tsx)

### Context & Scope
Implementation of standalone statutory legal routes, initial server-authenticated portal shells for parent and staff surfaces, and authentication navigation refinements.

### Key Deliverables
1. **Dedicated Statutory Legal Pages (`/privacy` & `/terms`):**
   - Implemented full standalone compliance pages under `src/app/privacy/page.tsx` and `src/app/terms/page.tsx`.
   - Comprehensive statutory disclosures adhering to the **Nigeria Data Protection Act (NDPA) 2023**, NDPR, and the **Cybercrimes (Prohibition, Prevention, etc.) Act 2015**.
   - Explicitly codifies the core structural guarantee: AI models read only approved public circulars and are strictly prohibited from receiving or processing private student records, attendance, or fees.
2. **Authenticated Portal Shells:**
   - **Ask the School (`/ask`):** Parent portal landing shell verifying authenticated parent session via `getSession()`, redirecting unauthenticated visitors to `/auth/login`, and featuring question input with daily quota display.
   - **Staff Attendance (`/attendance`):** Staff interface shell validating staff/admin role permissions, current date display, class filters, and attendance table structure.
3. **Registration Flow Navigation Refinement:**
   - Updated the external back link on the parent account creation page (`ParentRegisterForm.tsx`) to link to **Home** (`/`), providing clean return navigation to the public landing page.


