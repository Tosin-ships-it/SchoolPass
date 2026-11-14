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

export interface ApprovedQuestionItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

export const ASK_THE_SCHOOL_COPY = {
  MORE_QUESTIONS: 'more questions',
  FEWER_QUESTIONS: 'fewer questions',
  SECTION_HEADING: 'Ask the School',
  SECTION_SUBTITLE:
    'Get direct answers about official school policies, uniform guidelines, term calendar, and closing times.',
  INPUT_LABEL: 'Type your question',
  INPUT_PLACEHOLDER: 'Ask a question about the school...',
  ASK_BUTTON: 'Ask',
  STANDARD_RECORDS_REFUSAL:
    "Ask the School only provides answers from approved school policies and public information. Private student records—such as individual attendance figures, fee balances, and personal records—are protected and cannot be accessed through this tool. Please check My Child's Records, or use Ask the Office if you have questions for school staff.",
  RECORDS_LINK_LABEL: "View My Child's Records",
  OFFICE_LINK_LABEL: 'Ask the Office',
  QUESTIONS: [
    {
      id: 'closing-time',
      question: 'What time does school close?',
      answer:
        'Regular school hours end at 2:00 PM Monday through Thursday, and at 1:00 PM on Friday.',
    },
    {
      id: 'friday-school',
      question: 'Is there school on Friday?',
      answer:
        'Yes, regular school sessions run on Friday with early dismissal at 1:00 PM.',
    },
    {
      id: 'wednesday-uniform',
      question: 'What uniform should students wear on Wednesday?',
      answer:
        'All students wear their designated sports wear and white canvas shoes on Wednesday for physical education and sports.',
    },
    {
      id: 'next-term-start',
      question: 'When does the next term begin?',
      answer:
        'Second Term commences on Monday, 11 January 2027. The administrative office reopens one week earlier for registrations and enquiries.',
    },
    {
      id: 'early-pickup',
      question: 'What is the policy for picking up a child early?',
      answer:
        'Early pickup requires prior written notice to the front desk. Parents or authorized guardians must sign the gate register before departure.',
    },
    {
      id: 'contact-office',
      question: 'How do I reach the school office for urgent enquiries?',
      answer:
        "You can reach the school office directly via WhatsApp through the 'Ask the Office' button or call during school hours (7:30 AM – 3:30 PM).",
    },
    {
      id: 'pta-meeting',
      question: 'When is the next PTA meeting scheduled?',
      answer:
        'The general Parent-Teacher Association (PTA) meeting is scheduled for the third Saturday of each term at 10:00 AM in the school hall.',
    },
    {
      id: 'student-absence',
      question: 'What should I do if my child will be absent?',
      answer:
        'Please notify the front desk via WhatsApp or phone call before 8:30 AM on the day of absence. A medical note is required for absences exceeding two consecutive days.',
    },
  ] as const satisfies readonly ApprovedQuestionItem[],
} as const;

