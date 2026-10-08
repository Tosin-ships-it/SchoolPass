---
name: handle-payment-webhook
description: Process one Flutterwave webhook event end to end. Use when a webhook arrives or when building the webhook handler.
---

# Handle Payment Webhook

## Job
Verify one Flutterwave webhook event and update the matching payment and balance.

## Steps

1. Receive the webhook at `POST /api/payments/webhook`.
2. Read the Flutterwave signature from the request headers.
3. Verify the signature against the Flutterwave webhook secret.
4. If the signature fails, return 401 and stop.
5. Extract the transaction reference from the event body.
6. Look up the `Payment` record by `flutterwaveReference` or `internalReference`.
7. If no payment matches, log the event and return 200. Do not create a payment.
8. If the payment is already in a terminal state, return 200. Do not change anything.
9. Compare the event amount and currency to the stored amount and currency.
10. If they differ, mark the payment `Failed`, write a log entry, and alert Admin.
11. If they match, mark the payment `Successful`. Set `verifiedAt` to the current time.
12. Decrement the `FeeBalance` by the payment amount.
13. Write a log entry with actor, event, and outcome.
14. Return 200.

## Rules to follow
- Follow `RULES_PAYMENTS.md` Rule 6. Server-side verification is the only truth.
- Follow `RULES_PAYMENTS.md` Rule 8. Processing is idempotent.
- Follow `RULES_PAYMENTS.md` Rule 9. Balance changes only on success.
- Follow `RULES_PAYMENTS.md` Rule 11. Mismatch fails the payment.
- Follow `RULES_PRIVACY.md` Rule 7. Do not log fee amounts, names, or student IDs.
- Follow `RULES_LOGGING.md` Rule 1. Log every payment event.

## Done when
The webhook returns 200 and the payment state and balance match the event.