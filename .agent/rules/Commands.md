---
trigger: always_on
---

# RULES_COMMANDS.md

## Job
Hold allowed and forbidden commands, package install rules, database command rules, and git rules.

## Rule 1. Ask before a mutating command
Before running a mutating command, ask the user. Wait for the reply.
A command is mutating if it writes to disk, installs a package, changes the database, changes git history, or sends data to a third party.
Reason: a mutating command is hard to undo and easy to run by accident.

## Rule 2. Package installs
Ask before installing any package.
The request lists package name, version, and reason.
No install runs until the user replies.
Reason: a new package adds supply chain risk and a version to maintain.

## Rule 3. Forbidden commands
Do not run:
- Any Prisma CLI command that changes the database, including `prisma migrate`, `prisma db push`, and `prisma db seed`.
- Any raw SQL command against the database.
- Any command that edits the Prisma schema file.
Reason: the database holds fees, attendance, and child records. Schema changes are user decisions.

## Rule 4. Allowed non-mutating commands
Read-only commands are allowed without asking.
Examples: `git status`, `git diff`, `git log`, `npm run lint`, `npm run typecheck`.
Reason: these do not change state.

## Rule 5. Named commands
Lint: `npm run lint`.
Typecheck: `npm run typecheck`.
Build: `npm run build`.
Test: `npm run test`.
If a script does not exist, stop and ask.
Reason: one set of commands keeps sessions consistent.

## Rule 6. Git: what the agent may do
Commit only when the user asks.
Create a branch only when the user asks.
Push only when the user asks.
Reason: the user owns the history.

## Rule 7. Git: what the agent must never do
Never:
- Force push.
- Amend a pushed commit.
- Rewrite shared history.
- Delete a branch that is not local and unmerged.
Reason: these actions destroy work and cannot always be recovered.

## Rule 8. Commit message format
Subject line in the imperative mood, one line, describes what changed.
Body, if needed, explains why.
Reason: consistent history is readable across sessions and contributors.

## Rule 9. Branch names
Lowercase, hyphens, short type prefix.
Example shape: `feat/short-name` or `fix/short-name`.
Reason: a consistent shape makes branches scannable.

## Rule 10. One change per commit
One commit holds one change. Unrelated edits are not bundled.
Reason: a bundled commit cannot be reverted safely.