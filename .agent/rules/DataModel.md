---
trigger: always_on
---

# RULES_DATA_MODEL.md

## Job
Hold the Prisma models, enums, fields, unique constraints, and relations for SchoolPass.

## Rule 1. Models fixed by the PRD
The PRD defines these models and enums. Their fields and constraints are in PRD 10.1, 11.13, and 12.18.
Models: `StaffAttendanceRecord`, `ArrivalConfirmation`, `Payment`, `Refund`.
Enums: `AttendanceStatus`, `ArrivalMethod`, `ArrivalStatus`, `PaymentStatus`, `RefundStatus`.
Reason: these are locked. The agent must not change them.

## Rule 2. Models the user must define
The PRD references but does not define these models: `School`, `Student`, `Parent`, `StaffUser`, `AdminUser`, `ParentStudent`, `ApprovedSchoolInfo`, `FeeBalance`, `ArrivalCode`, `WrongAnswerReport`.
For each model, the agent asks the user for:
- the model's purpose in one line,
- every field with its type,
- every unique constraint,
- every relation and the field it uses.
The agent records the answers here before writing code that uses the model.
Reason: the agent must not invent a field. An invented field becomes a migration.

## Rule 3. No model is added without user approval
If the agent thinks a model is missing, stop and ask.
Record the user's answer here before writing code.
Reason: a new model is a schema change. Schema changes are user decisions.

## Rule 4. Enums are closed
An enum value is added only by user approval.
Record it here first.
Reason: an enum with an extra value changes behavior silently.

## Rule 5. Common fields
A `createdAt` field is present on every model.
An `updatedAt` field is present on every model that can be edited.
Reason: timestamps are needed for audit and for rollover.

## Rule 6. Money fields
A money field uses Prisma `Decimal` with precision 12 and scale 2.
No money field uses `Float`.
Reason: floating point loses cents. Money must not lose cents.

## Rule 7. Foreign keys are indexed
Every foreign key has an index.
Reason: an unindexed foreign key makes every join slow.

## Rule 8. Naming
Model names are singular and PascalCase.
Field names are camelCase.
Tables map to snake_case.
Reason: consistent naming keeps Prisma generated types predictable.

## Rule 9. No soft deletes unless stated
A record is deleted only if the PRD or the user says so.
No `deletedAt` field is added on the agent's own initiative.
Reason: soft deletes change every query. They are a product decision.

## Rule 10. Change control
Every schema change is written here in the same change that uses it.
Reason: if this file drifts from the schema, the agent will invent.

---

## Stage 1 Approved Schema Definitions: Identity & Authentication

### Enum: `StaffRole`
- Values: `STAFF`, `ADMIN`.

### Model: `Parent`
- **Purpose**: Authenticated parent/guardian account. Self-registered with email verification.
- **Fields**:
  - `id`: `String` `@id @default(cuid())`
  - `name`: `String`
  - `email`: `String @unique`
  - `passwordHash`: `String`
  - `previousPasswordHashes`: `String[]` (Enforces 3-password reuse prevention rule)
  - `emailVerifiedAt`: `DateTime?`
  - `createdAt`: `DateTime @default(now())`
  - `updatedAt`: `DateTime @updatedAt`
  - Relations: `sessions Session[]`, `students ParentStudent[]`, `aiUsageDaily AiUsageDaily[]`
- **Table mapping**: `@@map("parents")`

### Model: `StaffUser`
- **Purpose**: Staff and Admin user accounts for the Staff & Admin Interface.
- **Fields**:
  - `id`: `String` `@id @default(cuid())`
  - `name`: `String`
  - `email`: `String @unique`
  - `passwordHash`: `String`
  - `role`: `StaffRole @default(STAFF)`
  - `createdAt`: `DateTime @default(now())`
  - `updatedAt`: `DateTime @updatedAt`
  - Relations: `sessions Session[]`, `feeEntries FeeEntry[]`, `attendanceRecords AttendanceRecord[]`
- **Table mapping**: `@@map("staff_users")`

### Model: `Session`
- **Purpose**: Persistent authentication session tokens stored in httpOnly cookies.
- **Fields**:
  - `id`: `String @id @default(cuid())`
  - `userId`: `String`
  - `role`: `String` (`parent`, `staff`, or `admin`)
  - `expiresAt`: `DateTime`
  - `createdAt`: `DateTime @default(now())`
  - Relations: optional `parent Parent? @relation(...)`, optional `staffUser StaffUser? @relation(...)`
- **Indices**: `@@index([userId])`, `@@map("sessions")`

### Model: `VerificationToken`
- **Purpose**: Single-use token hash for email verification before first login.
- **Fields**:
  - `id`: `String @id @default(cuid())`
  - `email`: `String`
  - `tokenHash`: `String @unique`
  - `expiresAt`: `DateTime`
  - `createdAt`: `DateTime @default(now())`
- **Indices**: `@@index([email])`, `@@map("verification_tokens")`

### Model: `PasswordResetToken`
- **Purpose**: Single-use token hash for email-based password reset links.
- **Fields**:
  - `id`: `String @id @default(cuid())`
  - `email`: `String`
  - `tokenHash`: `String @unique`
  - `expiresAt`: `DateTime`
  - `createdAt`: `DateTime @default(now())`
- **Indices**: `@@index([email])`, `@@map("password_reset_tokens")`

### Model: `Student`
- **Purpose**: Core student record.
- **Fields**:
  - `id`: `String @id @default(cuid())`
  - `name`: `String`
  - `className`: `String`
  - `leftAt`: `DateTime?` (Addendum 9.6: leaver timestamp. If non-null, parent access terminates immediately)
  - `createdAt`: `DateTime @default(now())`
  - `updatedAt`: `DateTime @updatedAt`
  - Relations: `guardians ParentStudent[]`, `attendanceRecords AttendanceRecord[]`, `arrivalConfirmations ArrivalConfirmation[]`, `feeEntries FeeEntry[]`, `payments Payment[]`
- **Table mapping**: `@@map("students")`

### Model: `ParentStudent`
- **Purpose**: Many-to-many relationship linking verified parents to students. Created strictly by Staff/Admin.
- **Fields**:
  - `id`: `String @id @default(cuid())`
  - `parentId`: `String`
  - `studentId`: `String`
  - `createdAt`: `DateTime @default(now())`
  - Relations: `parent Parent @relation(fields: [parentId], references: [id], onDelete: Cascade)`, `student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)`
- **Constraints**: `@@unique([parentId, studentId])`, `@@index([studentId])`, `@@map("parent_students")`

### Model: `RateLimit`
- **Purpose**: Persistent authentication brute-force protection per account key and IP.
- **Fields**:
  - `key`: `String @id`
  - `attempts`: `Int @default(0)`
  - `blockedUntil`: `DateTime?`
  - `updatedAt`: `DateTime @updatedAt`
- **Table mapping**: `@@map("rate_limits")`