# SchoolPass

> The school's answers. Your child's records. One place.

SchoolPass is a private web application designed for parents and guardians of a single primary/secondary school (approximately 400 students in Nigeria). It provides parents with a single, reliable hub to find approved school information, track their child's attendance and fee status, confirm daily morning arrival, pay fees online, and reach the school front desk when questions cannot be answered automatically.

A separate Staff and Admin Interface allows teachers, bursars, and administrative staff to manage approved school information, resolve attendance, display daily arrival codes, enter fee charges, verify payments, review reported AI answers, manage staff accounts, and configure guardian-student links.

---

## Current Project State

- **Specification Status:** Build-ready baseline established in [SchoolPass_PRD_v6.md](docs/SchoolPass_PRD_v6.md) (PRD v6.0) with approved amendments and implementation decisions finalized in [PRD_ADDENDUM_v6.1.md](docs/PRD_ADDENDUM_v6.1.md) (PRD Addendum v6.1).
- **Codebase Status:** Active Next.js 15 (App Router) application with React 19, TypeScript, Prisma ORM, and design tokens mapped to CSS variables (`tokens.css`).
- **Implemented Capabilities:**
  - **Public Landing Page (`/`):** Full portal overview, value proposition, and responsive navigation (desktop menu and mobile full-screen drawer).
  - **Statutory Legal Pages (`/privacy` & `/terms`):** Full compliance pages adhering to the Nigeria Data Protection Act (NDPA) 2023, NDPR, and the Cybercrimes Act, detailing the strict structural separation between AI and private child records.
  - **Authentication Suite (`/auth/*`):** Zero-dependency cryptographic auth system (`node:crypto` scrypt hashing, rate limiting, and HMAC-SHA256 session cookies) covering Parent Sign In, Parent Self-Registration, Email Verification, Staff Login, and Expiring Password Reset links.
  - **Route Protection (`src/middleware.ts`):** Edge middleware enforcing role-based boundaries between parent (`/(parent)/*`) and staff (`/(staff)/*`) surfaces.
  - **Portal Shells:** Authenticated initial shells for Parent Ask the School (`/ask`) with daily quota tracking and Staff Attendance (`/attendance`).

---

## Implemented Routes & Interfaces

| Route | Role / Audience | Description & Status |
|---|---|---|
| `/` | Public | Public landing page with portal overview, onboarding steps, and mobile navigation drawer. |
| `/privacy` | Public | Statutory privacy policy compliant with the Nigeria Data Protection Act (NDPA) 2023. |
| `/terms` | Public | Terms of service and legal conditions under Nigerian law. |
| `/auth/login` | Parents | Parent sign in with email/password and rate-limited attempts. |
| `/auth/register` | Parents | Parent self-registration with return link to Home (`/`). |
| `/auth/verify-email` | Parents | Email verification confirmation handling with development test stub. |
| `/auth/staff-login` | Staff / Admin | Dedicated sign-in surface for school teachers, bursars, and administrators. |
| `/auth/forgot-password` | All Users | Password reset link request flow. |
| `/auth/reset-password` | All Users | Single-use expiring token password reset with 3-password reuse prevention. |
| `/ask` | Authenticated Parents | **F-1 Ask the School** interface shell with server-side auth guard and daily question quota badge. |
| `/attendance` | Authenticated Staff | Staff attendance management shell with date display and class filters. |

---

## Core Features (MVP Scope)

1. **F-1: Ask the School**
   - AI-powered retrieval answering parent questions strictly from `ApprovedSchoolInfo`.
   - Single-turn, question-and-answer format; answers only when the relevance threshold is met.
   - Operates within the provider free tier, protected by an Admin-configured global daily usage cap and a personal parent daily limit (20 questions/day).
   - Normal questions/answers are not stored; reported answers use tamper-resistant signed report tokens and are reviewed by staff.

2. **F-2: My Child's Records**
   - Direct access to student attendance and fee breakdown for linked students.
   - Attendance figures reflect the Admin-configured academic term and session, showing date, status (`PRESENT` / `ABSENT`), time, and source (`STAFF` or `PARENT_CONFIRMATION`).
   - Displays computed outstanding fee totals across terms with term-by-term breakdowns.

3. **F-3: Confirm Arrival**
   - Parents confirm morning drop-off via QR code or manual 6-digit code displayed at the school gate during the configured arrival window.
   - Server validates date, time window, school scope, student active status, and parent link.
   - Successful confirmation automatically creates a `PRESENT` attendance record with source `PARENT_CONFIRMATION` unless staff have already recorded attendance.
   - Duplicate submissions return the existing confirmation without creating duplicate entries.

4. **F-4: Pay Fees**
   - Online fee payments in Nigerian Naira (NGN) via Flutterwave checkout.
   - Server-side verification and webhook handling; return URLs are never trusted for payment confirmation.
   - Supports offline cash/transfer payments recorded by staff via `FeeEntry` (`OFFLINE_PAYMENT`).
   - Outstanding balances are computed (`Charges − Offline payments − Online payments`), never calculated by AI or stored as an editable balance.

5. **F-5: Ask the Office**
   - Human fallback routing unanswered inquiries directly to the school's configured Front Desk Officer via WhatsApp.
   - Prefilled with question text only (no parent or student names).

6. **Staff & Admin Interface**
   - Dedicated screens: Dashboard, Students, Attendance, Arrival Code, Fee Entries, Payments, Approved School Information, Guardian Links, Ask the School Reports, and Settings.
   - Capabilities include bulk fee charge application (school-wide or by class), manual attendance resolution, QR code regeneration, and role-based access.

---

## Documentation Structure & Source of Truth

To ensure architectural integrity, the project strictly observes the following hierarchy:

```
SchoolPass/
├── docs/
│   ├── SchoolPass_PRD_v6.md    # [Layer 1] Baseline product specification (PRD v6.0)
│   └── PRD_ADDENDUM_v6.1.md    # [Layer 1] Approved amendments & clarifications (Addendum v6.1)
├── AGENTS.md                   # Agent & developer operating rules, boundaries, and invariants
├── README.md                   # Project overview, structure, and operational guidance
├── JOURNAL.md                  # Chronological record of decisions and milestones
└── .agent/
    ├── rules/                  # Supporting domain rules (Auth, Payments, AI, Attendance, etc.)
    └── skills/                 # Step-by-step operational workflows (Confirm Arrival, Webhooks, etc.)
```

### Roles of Specifications & Context Files

1. **[SchoolPass_PRD_v6.md](file:///c:/Users/gbola/Desktop/SchoolPass/docs/SchoolPass_PRD_v6.md) (PRD v6.0):**
   The baseline functional and non-functional specification for SchoolPass v1.
2. **[PRD_ADDENDUM_v6.1.md](file:///c:/Users/gbola/Desktop/SchoolPass/docs/PRD_ADDENDUM_v6.1.md) (Addendum v6.1):**
   Approved amendments and implementation decisions. **Takes precedence** wherever it explicitly changes, clarifies, or replaces PRD v6.0 requirements.
3. **[AGENTS.md](file:///c:/Users/gbola/Desktop/SchoolPass/AGENTS.md), `.agent/rules/`, and `.agent/skills/`:**
   Supporting operational guidance for AI pair programming agents and developers. These files must **not** override the PRD or Addendum. When context files lag behind amendments, the PRD and Addendum govern implementation.

---

## Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **UI & Styling:** React 19, Vanilla CSS with design token variables (`tokens.css`)
- **Database & ORM:** PostgreSQL (Neon) with `pgvector`, Prisma ORM
- **AI Services:** Google Gemini API (Embeddings & Gemini Flash for answer generation)
- **Payments:** Flutterwave (Standard Checkout, Webhooks, and API verification)
- **Deployment Platform:** Vercel

---

## Essential Architecture & Security Invariants

- **Strict Privacy Barrier:** Shared school information (`ApprovedSchoolInfo`) and private student records (attendance, arrival, fees, payments) are strictly segregated. `ApprovedSchoolInfo` has no relation to student or parent tables. Private student records are never embedded, indexed, or passed as context to the AI.
- **Server-Side Authorization:** Every request for student records requires server-side validation that the authenticated parent possesses an active `ParentStudent` link to the requested student ID. Client checks are convenience only.
- **Parent Account Lifecycle:** Parents self-register with name, email, and password, followed by email verification. Staff or Admin manually link the parent to their child via the Guardian Links interface. No parent phone number is collected or required in v1.
- **Leavers:** When a student departs (`leftAt` timestamp set), parent access to that student's records ceases immediately. Existing links are retained, and student records are preserved under the governing retention policy.
- **Single School Scoping:** SchoolPass is strictly single-school. All records, codes, terms, and settings belong to the configured school. Timezone is fixed to `Africa/Lagos`.

---

## Getting Started

### Prerequisites

- Node.js (v20+ recommended)
- PostgreSQL database instance with `pgvector` enabled

### Setup & Commands

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and supply the required values:
   - `DATABASE_URL`: PostgreSQL connection string.
   - `GEMINI_API_KEY`: Google Gemini API key.
   - `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_SECRET`: Flutterwave credentials.
   - `SESSION_SECRET`: Secret key for httpOnly session cookies.
   - `NEXT_PUBLIC_APP_URL`: Base application URL.

3. **Convert design tokens (if updated):**
   ```bash
   npm run tokens
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

5. **Static type checking & linting:**
   ```bash
   npm run typecheck
   npm run lint
   ```
