---
trigger: glob
description: Load when the task touches payment initiation, Flutterwave, webhooks, refunds, or fee balance changes. Load when the task involves the `Payment` or `Refund` model. If unsure, load.
globs: src/lib/payments/**/*.ts
---

# RULES_PAYMENTS.md

## Job
Hold Flutterwave rules, payment states, webhook rules, refund rules, and timeouts.

## Rule 1. Currency
All amounts are in Nigerian Naira.
This is the only currency in v1.
Reason: the school bills in Naira. A second currency adds reconciliation work.

## Rule 2. Balance source
The displayed balance comes from the `FeeBalance` record in the database.
The AI is never used to calculate, estimate, or state a balance.
Reason: a balance is a private record. It must come from the source of truth.

## Rule 3. Payment state machine
Allowed transitions:
Pending to Successful.
Pending to Failed.
Successful to Refunded.
No other transition is valid.
Reason: a closed state machine prevents a payment from being re-applied or double-counted.

## Rule 4. Initialize before redirect
Before redirecting to Flutterwave, the server creates a `Payment` record with status `Pending` and a unique internal reference.
The redirect only happens after the record exists.
Reason: a payment without a record cannot be reconciled.

## Rule 5. Idempotent initiation
If a parent retries before the pending payment resolves, reuse the existing `Pending` record and reference.
A new record is created only after the previous attempt reaches a terminal state.
Reason: retries must not create duplicate charges or duplicate records.

## Rule 6. Server-side verification is the only truth
A payment is marked `Successful` only after the server calls Flutterwave's verification endpoint and confirms the payment.
The return URL and query parameters never mark a payment successful.
Reason: a return URL can be forged. Only Flutterwave's API is trusted.

## Rule 7. Webhook path
Webhook path is `POST /api/payments/webhook`.
No other path is used.
Reason: one path is one place to audit.

## Rule 8. Webhook rules
The webhook endpoint verifies the Flutterwave signature before processing.
Webhook processing is idempotent. The same event twice does not double-update the balance.
Reason: webhooks can be retried. A retried webhook must not change state twice.

## Rule 9. Balance rules
The balance is decremented only when a payment reaches `Successful` status.
The balance is increased only when a refund is confirmed by Flutterwave.
A `Pending` or `Failed` payment never changes the balance.
Reason: the balance must match the money the school actually received.

## Rule 10. Refund rules
A refund is recorded as a `Refund` record linked to the original `Payment`.
Refund amount cannot exceed the original payment amount.
Only Admin initiates a refund.
Current setting: Within 30 days of the original successful payment (PRD Section 12.15, Section 17).
Partial payments are permitted, with a minimum partial payment of ₦1,000 (PRD Section 12.5, Section 17).
Reason: refunds are money leaving the school. They need a single owner and a cap.

## Rule 11. Mismatch
If Flutterwave returns an amount or currency that differs from the initiated payment, mark the payment `Failed`.
Write a log entry.
Alert Admin in the Staff and Admin Interface.
Reason: a mismatch is either a bug or fraud. Both need a human.

## Rule 12. Timeouts
If no webhook arrives within the configured window (15 minutes), the server falls back to an active Flutterwave verify call (PRD Section 12.21, Section 17).
If a transaction never resolves within the configured stuck-transaction window (24 hours), the payment is marked `Failed` (PRD Section 12.21, Section 17).
Reason: a payment must not stay `Pending` forever.

## Rule 13. Reconciliation fields
Every `Payment` record stores the internal reference and the Flutterwave transaction reference.
Reason: reconciliation against Flutterwave requires both references.