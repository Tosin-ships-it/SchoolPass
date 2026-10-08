---
trigger: always_on
description: Load when creating a new file, moving a file, or adding an import. Load when the task asks for a file path. If unsure, load.
---

# RULES_FOLDER_MAP.md

## Job
Hold the confirmed folder structure and the file paths for SchoolPass.

## Activation
Always On.

## Repo shape
```
/
├── AGENTS.md
├── .agent/
│   ├── rules/
│   └── skills/
├── src/
├── prisma/
├── public/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── next.config.js
```

## Application folders
```
src/
├── app/
│   ├── (parent)/
│   │   ├── ask/
│   │   ├── records/
│   │   ├── arrival/
│   │   ├── pay/
│   │   └── office/
│   ├── (staff)/
│   │   ├── info/
│   │   ├── attendance/
│   │   ├── arrival-code/
│   │   ├── payments/
│   │   ├── reports/
│   │   ├── settings/
│   │   ├── staff-accounts/
│   │   └── guardian-links/
│   ├── api/
│   │   ├── ask/
│   │   ├── records/
│   │   ├── arrival/
│   │   ├── payments/
│   │   └── reports/
│   ├── auth/
│   ├── layout.tsx
│   └── page.tsx
└── lib/
    ├── ai/
    │   └── api/
    ├── payments/
    │   └── api/
    ├── arrival/
    │   └── api/
    ├── attendance/
    ├── retention/
    ├── auth/
    ├── logging/
    ├── db/
    └── errors/
```

## Purposes
| Path | Purpose |
|---|---|
| `src/app/(parent)/ask/` | F-1 Ask the School UI. |
| `src/app/(parent)/records/` | F-2 My Child's Records UI. |
| `src/app/(parent)/arrival/` | F-3 Confirm Arrival UI. |
| `src/app/(parent)/pay/` | F-4 Pay Fees UI. |
| `src/app/(parent)/office/` | F-5 Ask the Office UI. |
| `src/app/(staff)/info/` | Approved info list and edit. |
| `src/app/(staff)/attendance/` | Attendance entry. |
| `src/app/(staff)/arrival-code/` | Daily QR and manual code display. |
| `src/app/(staff)/payments/` | Payment verification. |
| `src/app/(staff)/reports/` | Wrong answer reports. |
| `src/app/(staff)/settings/` | School settings. Current term and session. |
| `src/app/(staff)/staff-accounts/` | Staff accounts. |
| `src/app/(staff)/guardian-links/` | Parent-to-student links. |
| `src/app/api/ask/` | AI answer route. Thin re-export. |
| `src/app/api/records/` | Private record reads route. |
| `src/app/api/arrival/` | Arrival confirm and status route. Thin re-export. |
| `src/app/api/payments/` | Initiate, webhook, status route. Thin re-export. |
| `src/app/api/reports/` | Wrong answer reports route. |
| `src/app/auth/` | Login, logout, password reset. |
| `src/lib/ai/` | Embeddings, retrieval, answer generation. |
| `src/lib/ai/api/` | Route logic for `src/app/api/ask/`. |
| `src/lib/payments/` | Flutterwave client, payment state, webhook, refunds. |
| `src/lib/payments/api/` | Route logic for `src/app/api/payments/`. |
| `src/lib/arrival/` | Code generation and validation. |
| `src/lib/arrival/api/` | Route logic for `src/app/api/arrival/`. |
| `src/lib/attendance/` | Attendance records, term config, rollover. |
| `src/lib/retention/` | Archive and delete routines. |
| `src/lib/auth/` | Session, parent-to-student check, links. |
| `src/lib/logging/` | Structured log writer. |
| `src/lib/db/` | Prisma client instance. |
| `src/lib/errors/` | Error strings and safe-display helper. |
| `prisma/schema.prisma` | Prisma schema. |
| `public/` | Static assets. |
| `convert-tokens.js` | Node script to convert design tokens to CSS variables. |
| `tokens.css` | Generated CSS variables from design tokens. |

## Import boundaries
| Module | May import from | May not import from |
|---|---|---|
| `src/lib/ai/` | `src/lib/db/`, `src/lib/errors/`, `src/lib/logging/` | `src/lib/payments/`, `src/lib/arrival/`, `src/lib/attendance/`, `src/lib/auth/`, `src/lib/retention/` |
| `src/lib/payments/` | `src/lib/db/`, `src/lib/errors/`, `src/lib/logging/`, `src/lib/auth/` | `src/lib/ai/` |
| `src/lib/arrival/` | `src/lib/db/`, `src/lib/errors/`, `src/lib/logging/`, `src/lib/auth/` | `src/lib/ai/` |
| `src/lib/attendance/` | `src/lib/db/`, `src/lib/errors/`, `src/lib/logging/`, `src/lib/auth/` | `src/lib/ai/` |
| `src/lib/retention/` | `src/lib/db/`, `src/lib/errors/`, `src/lib/logging/`, `src/lib/auth/` | `src/lib/ai/` |
| `src/lib/auth/` | `src/lib/db/`, `src/lib/errors/`, `src/lib/logging/` | `src/lib/ai/` |
| `src/lib/logging/` | `src/lib/db/` | `src/lib/ai/`, `src/lib/payments/`, `src/lib/arrival/`, `src/lib/attendance/`, `src/lib/auth/`, `src/lib/retention/` |
| `src/lib/db/` | none internal | everything else |
| `src/lib/errors/` | none internal | everything else |

Key rule. `src/lib/ai/` never imports any private-record module.

## Route imports
A route file under `src/app/` may import from any folder under `src/lib/`.
A route file under `src/app/(parent)/` must not import `src/lib/payments/`, `src/lib/arrival/`, `src/lib/attendance/`, or `src/lib/retention/` directly. It calls the API routes instead.
A route file under `src/app/(staff)/` may import from any `src/lib/` folder.

## Server-only modules
`src/lib/db/`, `src/lib/auth/`, `src/lib/logging/`, and `src/lib/payments/` run on the server only.
Mark each file with the `server-only` import at the top.
Reason: a client bundle must not contain the Prisma client, session secrets, or the Flutterwave secret key.

## Rules
1. One source of paths. Every file lives at a path listed here.
2. Do not invent a path. If a needed path is missing, stop and ask.
3. Shape of a new entry. Add path, purpose, and allowed importers.
4. Import check. Verify the importer is on the allowed list before adding an import.
5. Change control. Update this file in the same change as any folder change.
6. API routes are thin re-exports. Every file under `src/app/api/<feature>/route.ts` re-exports from `src/lib/<feature>/api/`. The logic lives in the feature folder, covered by that feature's Glob pattern. Reason: keeps the Glob pattern tight and the rule file loaded when the agent edits route logic.