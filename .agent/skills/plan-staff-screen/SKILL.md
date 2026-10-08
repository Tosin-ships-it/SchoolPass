---
name: plan-staff-screen
description: Confirm a Staff screen is allowed and planned before opening any file under src/app/(staff)/. Use when the user asks to add or change a Staff screen.
---

# Plan Staff Screen

## Job
Confirm the four decisions about a Staff screen before any file under `src/app/(staff)/` is opened.

## Steps

1. Ask the user which screen to build.
2. Confirm the screen is on the allowed list in `RULES_STAFF_UI.md` Rule 1. If not, stop and ask the user.
3. Confirm which roles may see this screen. Record the mapping in `RULES_STAFF_UI.md` Rule 2 if new.
4. Confirm the file path is `src/app/(staff)/<screen>/page.tsx`.
5. Confirm the navigation entry to add in the sidebar and the mobile tab bar.
6. Once all four are confirmed, stop. The rules file `RULES_STAFF_UI.md` will load when the file is opened.

## Rules to follow
- Follow `RULES_STAFF_UI.md` Rule 1. Screens are the allowed list only.
- Follow `RULES_STAFF_UI.md` Rule 2. Role to screen mapping is fixed.
- Follow `RULES_FOLDER_MAP.md` for the file path.

## Done when
The screen, the role mapping, the folder path, and the navigation entry are all confirmed.