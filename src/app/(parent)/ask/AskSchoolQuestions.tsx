'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ASK_THE_SCHOOL_COPY, type ApprovedQuestionItem } from '@/lib/errors/strings';

export function AskSchoolQuestions() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [typedInput, setTypedInput] = useState('');
  const [submittedTypedQuestion, setSubmittedTypedQuestion] = useState<string | null>(null);

  const allQuestions = ASK_THE_SCHOOL_COPY.QUESTIONS;
  const initialQuestions = allQuestions.slice(0, 4);
  const remainingQuestions = allQuestions.slice(4);
  const visibleQuestions = isExpanded ? allQuestions : initialQuestions;

  // Mutual exclusivity: only one answer open at a time across tapped and typed questions
  const handleToggleTappedQuestion = (id: string) => {
    setActiveQuestionId((prev) => (prev === id ? null : id));
  };

  const handleToggleTypedQuestion = () => {
    setActiveQuestionId((prev) => (prev === 'typed' ? null : 'typed'));
  };

  const handleToggleExpanded = () => {
    setIsExpanded((prev) => {
      const nextExpanded = !prev;
      if (!nextExpanded) {
        // When collapsing, close any open answer that gets hidden (questions 5 to 8)
        if (activeQuestionId && remainingQuestions.some((q) => q.id === activeQuestionId)) {
          setActiveQuestionId(null);
        }
      }
      return nextExpanded;
    });
  };

  // Submit typed question: purely client-side with no network call
  const handleAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = typedInput.trim();
    if (!trimmed) return;

    setSubmittedTypedQuestion(trimmed);
    // Open the typed question answer and close any open tapped question
    setActiveQuestionId('typed');
    setTypedInput('');
  };

  const isAskDisabled = !typedInput.trim();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
        marginTop: '8px',
      }}
    >
      {/* Suggested Questions List */}
      <div
        role="region"
        aria-label="Approved school questions"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {visibleQuestions.map((item: ApprovedQuestionItem, index: number) => {
          const isOpen = activeQuestionId === item.id;
          const answerId = `ask-school-answer-${item.id}`;
          const questionBtnId = `ask-school-question-${item.id}`;

          return (
            <div
              key={item.id}
              style={{
                borderRadius: '6px',
                border: '1px solid var(--color-roles-outline-variant, #e2e8f0)',
                backgroundColor: 'var(--color-roles-background, #f8fafc)',
                overflow: 'hidden',
                transition: 'border-color 0.15s ease',
              }}
            >
              <button
                id={questionBtnId}
                type="button"
                onClick={() => handleToggleTappedQuestion(item.id)}
                aria-expanded={isOpen}
                aria-controls={answerId}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--color-roles-on-surface, #0f172a)',
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  fontWeight: 600,
                  outline: 'none',
                }}
              >
                <span>
                  <span
                    style={{
                      color: 'var(--color-roles-on-surface-variant, #64748b)',
                      marginRight: '6px',
                      fontWeight: 500,
                    }}
                  >
                    {index + 1}.
                  </span>
                  {item.question}
                </span>

                <span
                  aria-hidden="true"
                  style={{
                    fontSize: '16px',
                    fontWeight: 400,
                    color: 'var(--color-roles-primary, #0284c7)',
                    transform: isOpen ? 'rotate(45deg)' : 'none',
                    transition: 'transform 0.15s ease',
                    userSelect: 'none',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '18px',
                    height: '18px',
                  }}
                >
                  +
                </span>
              </button>

              {isOpen && (
                <div
                  id={answerId}
                  role="region"
                  aria-labelledby={questionBtnId}
                  style={{
                    padding: '10px 14px 14px 28px',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    color: 'var(--color-roles-on-surface-variant, #475569)',
                    borderTop: '1px solid var(--color-roles-outline-variant, #f1f5f9)',
                    backgroundColor: 'var(--color-roles-surface, #ffffff)',
                  }}
                >
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Toggle Link: "more questions" / "fewer questions" */}
      <div>
        <button
          type="button"
          onClick={handleToggleExpanded}
          aria-expanded={isExpanded}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px 0',
            color: 'var(--color-roles-primary, #0284c7)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'underline',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {isExpanded
            ? ASK_THE_SCHOOL_COPY.FEWER_QUESTIONS
            : ASK_THE_SCHOOL_COPY.MORE_QUESTIONS}
        </button>
      </div>

      {/* Typed Question Card (Only one answer open between tapped and typed) */}
      {submittedTypedQuestion && (
        <div
          style={{
            marginTop: '6px',
            borderRadius: '6px',
            border: '1px solid var(--color-roles-outline-variant, #cbd5e1)',
            backgroundColor: 'var(--color-roles-surface-container, #f8fafc)',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={handleToggleTypedQuestion}
            aria-expanded={activeQuestionId === 'typed'}
            aria-controls="typed-question-answer"
            style={{
              width: '100%',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              color: 'var(--color-roles-on-surface, #0f172a)',
              fontFamily: 'inherit',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
            }}
          >
            <span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--color-roles-primary, #0284c7)',
                  backgroundColor: 'rgba(2, 132, 199, 0.1)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  marginRight: '8px',
                }}
              >
                Your Question
              </span>
              &ldquo;{submittedTypedQuestion}&rdquo;
            </span>

            <span
              aria-hidden="true"
              style={{
                fontSize: '16px',
                fontWeight: 400,
                color: 'var(--color-roles-primary, #0284c7)',
                transform: activeQuestionId === 'typed' ? 'rotate(45deg)' : 'none',
                transition: 'transform 0.15s ease',
                userSelect: 'none',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
              }}
            >
              +
            </span>
          </button>

          {activeQuestionId === 'typed' && (
            <div
              id="typed-question-answer"
              role="region"
              aria-label="Refusal response for typed question"
              style={{
                padding: '12px 14px 16px',
                fontSize: '13px',
                lineHeight: 1.5,
                color: 'var(--color-roles-on-surface, #334155)',
                borderTop: '1px solid var(--color-roles-outline-variant, #e2e8f0)',
                backgroundColor: 'var(--color-roles-surface, #ffffff)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '15px', color: '#e65100', lineHeight: 1.2 }}>ℹ</span>
                <p style={{ margin: 0 }}>
                  {ASK_THE_SCHOOL_COPY.STANDARD_RECORDS_REFUSAL}
                </p>
              </div>

              {/* Navigation Action Links */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap',
                  paddingTop: '8px',
                  borderTop: '1px dashed var(--color-roles-outline-variant, #e2e8f0)',
                }}
              >
                <Link
                  href="/records"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-roles-primary, #0284c7)',
                    textDecoration: 'none',
                  }}
                >
                  {ASK_THE_SCHOOL_COPY.RECORDS_LINK_LABEL} &rarr;
                </Link>

                <Link
                  href="/office"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-roles-secondary, #475569)',
                    textDecoration: 'none',
                  }}
                >
                  {ASK_THE_SCHOOL_COPY.OFFICE_LINK_LABEL} &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Typed Question Input Box */}
      <form
        onSubmit={handleAskSubmit}
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid var(--color-roles-outline-variant, #e2e8f0)',
        }}
      >
        <input
          type="text"
          value={typedInput}
          onChange={(e) => setTypedInput(e.target.value)}
          placeholder={ASK_THE_SCHOOL_COPY.INPUT_PLACEHOLDER}
          aria-label={ASK_THE_SCHOOL_COPY.INPUT_LABEL}
          style={{
            flex: 1,
            padding: '10px 14px',
            fontSize: '13px',
            borderRadius: '6px',
            border: '1px solid var(--color-roles-outline-color, #cbd5e1)',
            backgroundColor: 'var(--color-roles-surface, #ffffff)',
            color: 'var(--color-roles-on-surface, #0f172a)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        <button
          type="submit"
          disabled={isAskDisabled}
          style={{
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'var(--color-roles-primary, #0284c7)',
            color: 'var(--color-roles-on-primary, #ffffff)',
            cursor: isAskDisabled ? 'not-allowed' : 'pointer',
            opacity: isAskDisabled ? 0.45 : 1,
            transition: 'opacity 0.15s ease, background-color 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {ASK_THE_SCHOOL_COPY.ASK_BUTTON}
        </button>
      </form>
    </div>
  );
}
