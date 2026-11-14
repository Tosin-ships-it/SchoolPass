/**
 * Damerau-Levenshtein distance algorithm for calculating edit distance
 * between two strings, accounting for insertions, deletions, substitutions,
 * and adjacent character transpositions.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const matrix: number[][] = [];
  for (let i = 0; i <= al; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bl; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );

      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        val = Math.min(val, matrix[i - 2][j - 2] + 1); // transposition
      }

      matrix[i][j] = val;
    }
  }

  return matrix[al][bl];
}

export type IntakeStatus =
  | 'Enrolled & Linked'
  | 'Verification Pending'
  | 'Enrolled'
  | 'Pre-Admission Intake';

export interface IntakeStudentGuardian {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  isVerified: boolean;
}

export interface IntakeStudentItem {
  id: string;
  studentNumber: string;
  name: string;
  intendedClass: string;
  sessionYear: string;
  createdAt: string | Date;
  registeredByName?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  notes?: string | null;
  status: IntakeStatus;
  isClaimed?: boolean;

  // Fee Details
  totalCharges?: string;
  totalPaid?: string;
  outstandingBalance?: string;
  feeStatusLabel?: 'Settled' | 'Outstanding' | 'No Charges Assigned';
  lastPaymentDate?: string | null;

  // Check-ins & Attendance
  arrivalCheckinsCount?: number;
  lastCheckinDate?: string | null;
  attendancePresentCount?: number;
  attendanceTotalCount?: number;

  // Guardians
  guardians?: IntakeStudentGuardian[];
  pendingLinkCount?: number;
}

export interface SearchResult<T> {
  item: T;
  rank: number;
  score: number;
}

/**
 * Evaluates a single student record against the query string.
 * Lower rank means higher priority:
 *   Rank 1: Exact Student Number match
 *   Rank 2: Partial Student Number match
 *   Rank 3: Typo-tolerant Student Number match (Levenshtein distance <= 2)
 *   Rank 4: Student name match (secondary lookup)
 */
export function evaluateStudentMatch(
  record: IntakeStudentItem,
  rawQuery: string
): { match: boolean; rank: number; score: number } {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return { match: true, rank: 5, score: 0 };
  }

  const qUpper = trimmed.toUpperCase();
  const qLower = trimmed.toLowerCase();
  const snUpper = record.studentNumber.trim().toUpperCase();
  const nameLower = record.name.trim().toLowerCase();

  // 1. Exact Student Number Match (ignoring case & whitespace)
  if (snUpper === qUpper) {
    return { match: true, rank: 1, score: 100 };
  }

  // Exact without hyphens (e.g. SP20260001 === SP-2026-0001 without hyphens)
  const snNoHyphen = snUpper.replace(/-/g, '');
  const qNoHyphen = qUpper.replace(/-/g, '');
  if (snNoHyphen === qNoHyphen) {
    return { match: true, rank: 1.1, score: 95 };
  }

  // 2. Partial Student Number Match
  if (snUpper.startsWith(qUpper)) {
    return { match: true, rank: 2.0, score: 85 };
  }
  if (snUpper.endsWith(qUpper)) {
    return { match: true, rank: 2.1, score: 82 };
  }
  if (snUpper.includes(qUpper)) {
    return { match: true, rank: 2.2, score: 78 };
  }
  if (snNoHyphen.includes(qNoHyphen) && qNoHyphen.length >= 3) {
    return { match: true, rank: 2.3, score: 72 };
  }

  // 3. Typo-tolerant Student Number Match (Levenshtein <= 2)
  // Check full student number, no-hyphen version, or sequence portion (when typo is suspected)
  const distFull = damerauLevenshtein(qUpper, snUpper);
  const distNoHyphen = damerauLevenshtein(qNoHyphen, snNoHyphen);

  // If query is 4 digits like '0003', don't treat other 4-digit numbers ('0001', '0002') as typos
  const isExactFourDigits = /^\d{4}$/.test(qUpper);
  const snSequence = snUpper.slice(-4);
  const distSeq =
    !isExactFourDigits && qUpper.length >= 3 && qUpper.length <= 5
      ? damerauLevenshtein(qUpper, snSequence)
      : 99;

  const minSnDist = Math.min(distFull, distNoHyphen, distSeq);

  // Allow distance 1 for length >= 4; distance 2 for length >= 6
  if (
    (minSnDist === 1 && qUpper.length >= 4) ||
    (minSnDist === 2 && qUpper.length >= 6)
  ) {
    return { match: true, rank: 3.0 + minSnDist * 0.1, score: 60 - minSnDist * 10 };
  }

  // 4. Student Name as Secondary Lookup
  if (nameLower === qLower) {
    return { match: true, rank: 4.0, score: 50 };
  }
  const nameWords = nameLower.split(/\s+/);
  if (nameWords.some((w) => w === qLower)) {
    return { match: true, rank: 4.1, score: 45 };
  }
  if (nameLower.startsWith(qLower) || nameWords.some((w) => w.startsWith(qLower))) {
    return { match: true, rank: 4.2, score: 40 };
  }
  if (nameLower.includes(qLower)) {
    return { match: true, rank: 4.3, score: 35 };
  }

  // Typo tolerance on name words (distance 1 for query words of length >= 4)
  if (qLower.length >= 4) {
    const minWordDist = Math.min(...nameWords.map((w) => damerauLevenshtein(qLower, w)));
    if (minWordDist <= 1) {
      return { match: true, rank: 4.4, score: 30 };
    }
  }

  return { match: false, rank: 99, score: 0 };
}

/**
 * Filter and rank student intake records based on fuzzy search query.
 */
export function fuzzySearchStudents(
  students: IntakeStudentItem[],
  query: string
): IntakeStudentItem[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return students;
  }

  const results: SearchResult<IntakeStudentItem>[] = [];

  for (const item of students) {
    const evaluation = evaluateStudentMatch(item, trimmed);
    if (evaluation.match) {
      results.push({
        item,
        rank: evaluation.rank,
        score: evaluation.score,
      });
    }
  }

  results.sort((a, b) => {
    // 1. Primary sort by match category rank (lower rank = higher priority)
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    // 2. Secondary sort by score (higher score = better fit)
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    // 3. Fallback to newest creation date
    const dateA = new Date(a.item.createdAt).getTime();
    const dateB = new Date(b.item.createdAt).getTime();
    return dateB - dateA;
  });

  return results.map((r) => r.item);
}
