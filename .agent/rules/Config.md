---
trigger: always_on
---

# RULES_CONFIG.md

## Job
Hold every configurable value that does not belong to a single feature.

## Rule 1. What belongs here
A value belongs here if it is marked configurable in the PRD and is used by more than one feature.
Reason: a value used in one feature lives in that feature's rules file. A value used across features lives here.

## Rule 2. No value is hardcoded
Every value listed here is read from configuration at runtime.
No value is written into the source.
Reason: a hardcoded value is invisible to the school and cannot be changed without a deploy.

## Rule 3. Missing value behavior
If a required value is missing, the app fails at startup.
The startup error names the missing variable by its environment variable name.
The startup error does not name the value.
Reason: a silent fallback hides a misconfigured deployment.

## Rule 4. Who may change values
Only Owner or Admin may view or change configuration values in the Staff and Admin Interface.
Reason: configuration controls behavior. It is an owner decision.

## Rule 5. Values recorded here
The confirmed settings from PRD v6 Section 17 are recorded below:
- Parent app uptime target: 99% per month during school hours (PRD Section 1, Section 17).
- AI answer accuracy target: 70% of pilot questions answered without escalation (PRD Section 1, Section 17).
- Session token expiry: 7 days.
- Password reset method: Email link only (PRD Section 8.2, Section 17).
- Password minimum length and reuse rule: Minimum 8 characters; reuse prevented for last 3 passwords.
- Prefilled WhatsApp message content: Question text only. No parent name. No child name (PRD Section 13, Section 17).
- Confirm Arrival reminder channel: SMS or email to parent, chosen at onboarding. No push notifications (PRD Section 4, Section 17).
- Performance targets: First Contentful Paint under 5s on 3G; Time to Interactive under 8s on 3G. Mandatory loading and retry states on all pages (PRD Section 15, Section 17).
- Log retention period: 7 years, aligning with NDPR record retention (PRD Section 14).
- Monthly request-count ceiling for Ask the School: Configured by Owner/Admin; daily limit is 20 questions per parent per day (PRD Section 9.6, Section 17).
Reason: these span features and have no single owner file.

## Rule 6. Change control
When the user changes a value, the agent updates this file or the feature file in the same change.
Reason: a config file that drifts from the running app is worse than none.