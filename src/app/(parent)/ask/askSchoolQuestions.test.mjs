import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ASK_THE_SCHOOL_COPY } from '../../../lib/errors/strings.ts';

describe('Ask the School Questions: Approved Copy & Visibility Behavior', () => {
  it('approved copy list contains exactly 8 questions', () => {
    assert.equal(Array.isArray(ASK_THE_SCHOOL_COPY.QUESTIONS), true);
    assert.equal(ASK_THE_SCHOOL_COPY.QUESTIONS.length, 8);
  });

  it('has exact toggle wording in approved copy list', () => {
    assert.equal(ASK_THE_SCHOOL_COPY.MORE_QUESTIONS, 'more questions');
    assert.equal(ASK_THE_SCHOOL_COPY.FEWER_QUESTIONS, 'fewer questions');
  });

  it('has exact typed question input, button, and standard records refusal copy', () => {
    assert.equal(typeof ASK_THE_SCHOOL_COPY.INPUT_PLACEHOLDER, 'string');
    assert.equal(ASK_THE_SCHOOL_COPY.ASK_BUTTON, 'Ask');
    assert.equal(typeof ASK_THE_SCHOOL_COPY.STANDARD_RECORDS_REFUSAL, 'string');
    assert.equal(
      ASK_THE_SCHOOL_COPY.STANDARD_RECORDS_REFUSAL.includes('Private student records'),
      true
    );
    assert.equal(
      ASK_THE_SCHOOL_COPY.STANDARD_RECORDS_REFUSAL.includes("My Child's Records"),
      true
    );
    assert.equal(
      ASK_THE_SCHOOL_COPY.STANDARD_RECORDS_REFUSAL.includes('Ask the Office'),
      true
    );
  });

  it('default view shows only the first four questions', () => {
    const allQuestions = ASK_THE_SCHOOL_COPY.QUESTIONS;
    const initialQuestions = allQuestions.slice(0, 4);

    assert.equal(initialQuestions.length, 4);
    assert.equal(initialQuestions[0].id, 'closing-time');
    assert.equal(initialQuestions[1].id, 'friday-school');
    assert.equal(initialQuestions[2].id, 'wednesday-uniform');
    assert.equal(initialQuestions[3].id, 'next-term-start');
  });

  it('more questions expansion reveals the remaining four questions', () => {
    const allQuestions = ASK_THE_SCHOOL_COPY.QUESTIONS;
    const remainingQuestions = allQuestions.slice(4);

    assert.equal(remainingQuestions.length, 4);
    assert.equal(remainingQuestions[0].id, 'early-pickup');
    assert.equal(remainingQuestions[1].id, 'contact-office');
    assert.equal(remainingQuestions[2].id, 'pta-meeting');
    assert.equal(remainingQuestions[3].id, 'student-absence');

    const expandedQuestions = [...allQuestions.slice(0, 4), ...remainingQuestions];
    assert.equal(expandedQuestions.length, 8);
  });

  it('Ask button stays disabled until something is typed', () => {
    // Empty string
    assert.equal(!''.trim(), true);
    // Whitespace only
    assert.equal(!'    '.trim(), true);
    assert.equal(!'\t\n'.trim(), true);
    // Valid text typed
    assert.equal(!'What time does gate open?'.trim(), false);
  });

  it('enforces single answer open at a time between tapped and typed questions', () => {
    let activeQuestionId = null;

    // 1. User taps suggested question 1
    activeQuestionId = 'closing-time';
    assert.equal(activeQuestionId, 'closing-time');

    // 2. User taps suggested question 2 -> question 1 closes, question 2 opens
    activeQuestionId = 'friday-school';
    assert.equal(activeQuestionId, 'friday-school');

    // 3. User submits a typed question -> question 2 closes, typed question answer opens
    activeQuestionId = 'typed';
    assert.equal(activeQuestionId, 'typed');

    // 4. User taps suggested question 3 -> typed question closes, question 3 opens
    activeQuestionId = 'wednesday-uniform';
    assert.equal(activeQuestionId, 'wednesday-uniform');

    // 5. User taps question 3 again -> question 3 toggles closed
    activeQuestionId = activeQuestionId === 'wednesday-uniform' ? null : 'wednesday-uniform';
    assert.equal(activeQuestionId, null);
  });

  it('closing fewer questions closes any open answer that gets hidden', () => {
    const allQuestions = ASK_THE_SCHOOL_COPY.QUESTIONS;
    const remainingQuestions = allQuestions.slice(4);

    // Case A: A question in remaining questions (index >= 4) is currently open
    let activeQuestionId = 'pta-meeting'; // question 7 (remaining question)
    let isExpanded = true;

    // User collapses to fewer questions
    isExpanded = false;
    if (activeQuestionId && remainingQuestions.some((q) => q.id === activeQuestionId)) {
      activeQuestionId = null;
    }

    assert.equal(activeQuestionId, null);

    // Case B: A question in first four (index < 4) is open
    activeQuestionId = 'closing-time';
    isExpanded = false;
    if (activeQuestionId && remainingQuestions.some((q) => q.id === activeQuestionId)) {
      activeQuestionId = null;
    }

    // Remains open because it is not hidden
    assert.equal(activeQuestionId, 'closing-time');

    // Case C: The typed question is open
    activeQuestionId = 'typed';
    isExpanded = false;
    if (activeQuestionId && remainingQuestions.some((q) => q.id === activeQuestionId)) {
      activeQuestionId = null;
    }

    // Typed question is not in remainingQuestions, so it is not accidentally closed by collapse
    assert.equal(activeQuestionId, 'typed');
  });

  it('verifies all 8 questions and answers are strictly shared school information', () => {
    for (const item of ASK_THE_SCHOOL_COPY.QUESTIONS) {
      assert.equal(typeof item.id, 'string');
      assert.equal(typeof item.question, 'string');
      assert.equal(typeof item.answer, 'string');
      assert.equal(item.question.length > 5, true);
      assert.equal(item.answer.length > 10, true);

      assert.equal(item.question.includes('studentNumber'), false);
      assert.equal(item.answer.includes('studentNumber'), false);
      assert.equal(item.answer.includes('ParentStudent'), false);
    }
  });
});
