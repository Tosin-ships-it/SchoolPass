---
trigger: always_on
---

# RULES_ENV.md

## Job
Hold the names of environment variables SchoolPass uses. Names only. No values.

## Rule 1. The agent must not invent a name
Every name in this file is supplied by the user.
If a needed variable is not listed, stop and ask.
Reason: an invented name fails at runtime, not at build. The failure is silent until production.

## Rule 2. No values in this file
This file holds names only.
Values live in the deployment environment.
The deployment environment is the source of truth.
The local `.env` file mirrors the names for local development.
Reason: a committed value is a leaked secret.

## Rule 3. No `.env` file is committed
The `.env` file is not added to version control.
A `.env.example` file at the repo root lists the names only.
Reason: version control is shared. A shared secret is a burned secret.

## Rule 4. One variable, one purpose
Every variable has one purpose.
If a variable is used in two places for two purposes, split it.
Reason: one variable with two meanings breaks when one place changes.

## Rule 5. Removing a variable
When a variable is removed from the code, its name is removed from this file and from `.env.example` in the same change.
Reason: a stale name misleads the next reader.

## Rule 6. Status
The user supplied the environment variable names in `.env.example`.

## Rule 7. Variable Names and Purposes
- `DATABASE_URL`: Connection string for PostgreSQL database hosted on Neon.
- `GEMINI_API_KEY`: API key for Google Gemini (embeddings and Flash model for answers).
- `FLUTTERWAVE_PUBLIC_KEY`: Flutterwave public API key for payment checkout.
- `FLUTTERWAVE_SECRET_KEY`: Flutterwave secret key for server-side payment verification and refunds.
- `FLUTTERWAVE_WEBHOOK_SECRET`: Secret hash used to verify Flutterwave webhook signatures.
- `SESSION_SECRET`: Secret key used for signing and verifying httpOnly session cookies.
- `NEXT_PUBLIC_APP_URL`: Base URL of the deployment application.
- `RESEND_API_KEY`: API key for Resend email transmission.
- `RESEND_FROM`: (Optional) Custom sender address for Resend emails (defaults to SchoolPass <onboarding@resend.dev>).
- `NEXT_PUBLIC_ENABLE_DEV_STUBS`: (Optional, local development only) Set to "true" to opt into development testing stubs and credential helpers. Ignored and disabled in production.