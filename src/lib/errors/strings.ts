/**
 * RULES_ERROR_STATES.md - Centralized cross-feature strings
 * All strings live in this single module and must not be duplicated inline.
 */

export const ERROR_STRINGS = {
  ASK_THE_OFFICE_FALLBACK: "I couldn't find an approved answer to this. You can ask the school office.",
  ASK_THE_OFFICE_BUTTON: "Ask the Office",
  GENERIC_RETRY: "Something went wrong. Please try again.",
  NOT_A_SCHOOL_DAY: "There is no school today.",
} as const;
