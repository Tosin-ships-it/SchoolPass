import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  damerauLevenshtein,
  evaluateStudentMatch,
  fuzzySearchStudents,
} from './fuzzySearch.ts';

const mockStudents = [
  {
    id: 's1',
    studentNumber: 'SP-2026-0001',
    name: 'Asher Bello',
    intendedClass: 'Primary 1',
    sessionYear: '2026/2027',
    createdAt: new Date('2026-11-01T10:00:00Z'),
    status: 'Enrolled & Linked',
  },
  {
    id: 's2',
    studentNumber: 'SP-2026-0002',
    name: 'Chioma Adeyemi',
    intendedClass: 'Primary 2',
    sessionYear: '2026/2027',
    createdAt: new Date('2026-11-02T10:00:00Z'),
    status: 'Verification Pending',
  },
  {
    id: 's3',
    studentNumber: 'SP-2026-0003',
    name: 'Ibrahim Musa',
    intendedClass: 'JSS 1',
    sessionYear: '2026/2027',
    createdAt: new Date('2026-11-03T10:00:00Z'),
    status: 'Pre-Admission Intake',
  },
  {
    id: 's4',
    studentNumber: 'SP-2026-0010',
    name: 'Zainab Bello',
    intendedClass: 'Primary 3',
    sessionYear: '2026/2027',
    createdAt: new Date('2026-11-04T10:00:00Z'),
    status: 'Enrolled',
  },
];

describe('Damerau-Levenshtein Edit Distance', () => {
  it('correctly calculates edit distance for identical strings', () => {
    assert.equal(damerauLevenshtein('SP-2026-0001', 'SP-2026-0001'), 0);
  });

  it('detects single deletion', () => {
    // Missing '0'
    assert.equal(damerauLevenshtein('SP-2026-001', 'SP-2026-0001'), 1);
  });

  it('detects single substitution', () => {
    // 'O' instead of '0'
    assert.equal(damerauLevenshtein('SP-2026-OOO1', 'SP-2026-0001'), 3);
    assert.equal(damerauLevenshtein('SP-2026-0002', 'SP-2026-0001'), 1);
  });

  it('detects single transposition', () => {
    // Transposed adjacent letters 'PS' instead of 'SP'
    assert.equal(damerauLevenshtein('PS-2026-0001', 'SP-2026-0001'), 1);
  });
});

describe('Fuzzy Student Search Ranking Hierarchy', () => {
  it('ranks exact student number matches first', () => {
    const results = fuzzySearchStudents(mockStudents, 'SP-2026-0001');
    assert.equal(results.length >= 1, true);
    assert.equal(results[0].studentNumber, 'SP-2026-0001');
    assert.equal(results[0].name, 'Asher Bello');
  });

  it('handles case-insensitivity and whitespace in exact matches', () => {
    const results = fuzzySearchStudents(mockStudents, '  sp-2026-0002  ');
    assert.equal(results.length >= 1, true);
    assert.equal(results[0].studentNumber, 'SP-2026-0002');
  });

  it('matches without hyphens as an exact match', () => {
    const results = fuzzySearchStudents(mockStudents, 'SP20260003');
    assert.equal(results.length >= 1, true);
    assert.equal(results[0].studentNumber, 'SP-2026-0003');
  });

  it('matches partial student numbers (prefix, suffix, substring)', () => {
    // Suffix: '0003'
    const suffixResults = fuzzySearchStudents(mockStudents, '0003');
    assert.equal(suffixResults.length, 1);
    assert.equal(suffixResults[0].studentNumber, 'SP-2026-0003');

    // Prefix: 'SP-2026'
    const prefixResults = fuzzySearchStudents(mockStudents, 'SP-2026');
    assert.equal(prefixResults.length, 4);
  });

  it('matches minor typos in student numbers (1-2 edit distance)', () => {
    // Missing a 0 in sequence: 'SP-2026-003' (distance 1 from 'SP-2026-0003')
    const typoResults = fuzzySearchStudents(mockStudents, 'SP-2026-003');
    assert.equal(typoResults.length >= 1, true);
    assert.equal(typoResults[0].studentNumber, 'SP-2026-0003');

    // Transposed prefix 'PS-2026-0002'
    const transposedResults = fuzzySearchStudents(mockStudents, 'PS-2026-0002');
    assert.equal(transposedResults.length >= 1, true);
    assert.equal(transposedResults[0].studentNumber, 'SP-2026-0002');
  });

  it('supports student names as secondary lookup', () => {
    // Search for 'Chioma'
    const results = fuzzySearchStudents(mockStudents, 'Chioma');
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Chioma Adeyemi');

    // Search for 'Bello' (matches two students, both have Bello)
    const belloResults = fuzzySearchStudents(mockStudents, 'Bello');
    assert.equal(belloResults.length, 2);
    const names = belloResults.map((r) => r.name);
    assert.equal(names.includes('Asher Bello'), true);
    assert.equal(names.includes('Zainab Bello'), true);
  });

  it('returns all students when search query is empty', () => {
    const results = fuzzySearchStudents(mockStudents, '   ');
    assert.equal(results.length, mockStudents.length);
  });

  it('returns empty array when no records match', () => {
    const results = fuzzySearchStudents(mockStudents, 'XYZ999999');
    assert.equal(results.length, 0);
  });
});

