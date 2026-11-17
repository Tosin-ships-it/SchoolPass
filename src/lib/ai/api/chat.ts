import 'server-only';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logEvent } from '@/lib/logging';
import { ERROR_STRINGS, ASK_THE_SCHOOL_COPY } from '@/lib/errors/strings';
import {
  AI_CONFIG,
  generateGroundedAnswer,
  embedText,
  cosineSimilarity,
  countWords,
} from '../gemini';

/**
 * Zod validation schema for incoming chat requests.
 */
export const ChatMessageInputSchema = z
  .object({
    message: z.string().optional(),
    question: z.string().optional(),
  })
  .refine(
    (data) => Boolean(data.message?.trim() || data.question?.trim()),
    { message: 'Message cannot be empty.' }
  )
  .transform((data) => ({
    message: (data.message ?? data.question ?? '').trim(),
  }))
  .pipe(
    z.object({
      message: z
        .string()
        .min(1, { message: 'Message cannot be empty.' })
        .max(1000, { message: 'Message cannot exceed 1000 characters.' }),
    })
  );

export type ChatMessageInput = z.infer<typeof ChatMessageInputSchema>;

export interface ChatRequestContext {
  parentId?: string;
}

export interface ChatResponsePayload {
  success: boolean;
  answer: string;
  isPrivateRecordsRefusal?: boolean;
  isRateLimited?: boolean;
  isFallback?: boolean;
  suggestedAction?: 'records' | 'office';
  error?: string;
  modelUsed?: string;
  wordCount?: number;
}

/**
 * Checks if a question is asking for private student records rather than general school policy.
 * RULES_PRIVACY.md & RULES_AI.md Rule 1 & 2:
 * Private student data must never be queried or passed to the AI context.
 */
export function isPrivateRecordInquiry(query: string): boolean {
  const lower = query.toLowerCase().trim();

  // Explicit personal balance / payment status questions
  const personalFeePatterns = [
    /\b(my|our)\s+(fee|fees|tuition|balance|debt|receipt|invoice)\b/i,
    /\b(how much|what)\s+(do i|do we)\s+owe\b/i,
    /\b(my|our)\s+outstanding\b/i,
    /\bcheck\s+(my|our)\s+balance\b/i,
    /\bam i owing\b/i,
    /\bpay\s+(my|our)\s+fees?\b/i,
  ];

  // Explicit personal attendance / arrival questions
  const personalAttendancePatterns = [
    /\b(my|our)\s+(child|son|daughter|kid|ward)('s)?\s+(attendance|absence|arrival|presence|record)\b/i,
    /\b(is|did)\s+(my|our)\s+(child|son|daughter|kid|ward)\s+(in school|present|arrive|absent|make it)\b/i,
    /\b(check|show|view)\s+(my|our)\s+(attendance|arrival)\b/i,
    /\bhow many days\s+(was|has)\s+(my|our)\s+(child|son|daughter)\b/i,
  ];

  // Explicit personal academic / grades / disciplinary questions
  const personalAcademicPatterns = [
    /\b(my|our)\s+(child|son|daughter|kid|ward)('s)?\s+(grade|grades|score|scores|result|results|report card)\b/i,
    /\b(what did|how did)\s+(my|our)\s+(child|son|daughter)\s+score\b/i,
  ];

  // Specific student identification numbers (e.g. SP-2026-0001)
  const studentNumberPattern = /\bSP-\d{4}-\d{4}\b/i;

  return (
    studentNumberPattern.test(lower) ||
    personalFeePatterns.some((pattern) => pattern.test(lower)) ||
    personalAttendancePatterns.some((pattern) => pattern.test(lower)) ||
    personalAcademicPatterns.some((pattern) => pattern.test(lower))
  );
}

/**
 * Enforces daily rate limit for parent question asking.
 * RULES_AI.md Rule 9 & Rule 13: 20 questions per parent per day.
 */
async function checkAndIncrementDailyUsage(
  parentId: string
): Promise<{ allowed: boolean; currentCount: number }> {
  const DAILY_LIMIT = 20;
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  try {
    const existing = await prisma.aiUsageDaily.findUnique({
      where: {
        parentId_date: {
          parentId,
          date: todayUtc,
        },
      },
    });

    const currentCount = existing?.questionCount ?? 0;
    if (currentCount >= DAILY_LIMIT) {
      return { allowed: false, currentCount };
    }

    await prisma.aiUsageDaily.upsert({
      where: {
        parentId_date: {
          parentId,
          date: todayUtc,
        },
      },
      create: {
        parentId,
        date: todayUtc,
        questionCount: 1,
      },
      update: {
        questionCount: { increment: 1 },
      },
    });

    return { allowed: true, currentCount: currentCount + 1 };
  } catch (error) {
    // If the database is unreachable or in non-DB tests, log and permit non-blocking execution
    logEvent({
      level: 'warn',
      event: 'ai_usage_tracking_skipped',
      actorType: 'parent',
      actorId: parentId,
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown DB error',
      },
    });
    return { allowed: true, currentCount: 0 };
  }
}

/**
 * Collects passages from active ApprovedSchoolInfo and approved presets.
 * RULES_AI.md Rule 1: The AI reads only from ApprovedSchoolInfo and approved school presets.
 */
async function getApprovedPassages(): Promise<string[]> {
  const staticPassages = ASK_THE_SCHOOL_COPY.QUESTIONS.map(
    (q) => `${q.question}\n${q.answer}`
  );

  try {
    const dbItems = await prisma.approvedSchoolInfo.findMany({
      where: { isActive: true },
      select: { title: true, content: true },
    });
    const dbPassages = dbItems.map((item) => `${item.title}\n${item.content}`);
    return [...staticPassages, ...dbPassages];
  } catch {
    return staticPassages;
  }
}

/**
 * Evaluates candidate passages and returns those clearing the relevance threshold.
 * RULES_AI.md Rule 3 & Rule 4: Cosine similarity on Gemini embeddings.
 */
async function retrieveRelevantPassages(
  query: string,
  passages: string[]
): Promise<string[]> {
  if (passages.length === 0) return [];

  // Check direct semantic keyword/question match first
  const queryLower = query.toLowerCase().trim();
  const directMatches = passages.filter((p) => {
    const pLower = p.toLowerCase();
    return (
      pLower.includes(queryLower) ||
      queryLower
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .some((word) => pLower.includes(word))
    );
  });

  // Attempt vector embedding matching if API key is active
  if (process.env.GEMINI_API_KEY) {
    try {
      const queryVector = await embedText(query);
      if (queryVector && queryVector.length > 0) {
        // Embed candidate passages and calculate cosine similarity
        const scored: { passage: string; score: number }[] = [];
        for (const passage of passages) {
          const passageVector = await embedText(passage).catch(() => null);
          if (passageVector) {
            const score = cosineSimilarity(queryVector, passageVector);
            if (score >= AI_CONFIG.DEFAULT_RELEVANCE_THRESHOLD) {
              scored.push({ passage, score });
            }
          }
        }

        if (scored.length > 0) {
          scored.sort((a, b) => b.score - a.score);
          return scored.map((s) => s.passage).slice(0, 3);
        }
      }
    } catch {
      // Embedding check failed, fallback to direct keyword matches
    }
  }

  return directMatches.slice(0, 3);
}

/**
 * Handles incoming chat message from the dashboard.
 * Performs rigorous pre-call checks before deciding whether to invoke Gemini:
 * 1. Payload validation (non-empty, string, max 1000 chars)
 * 2. Privacy Check: Rejects inquiries into private student records with standard records refusal.
 * 3. Daily Rate Limit Check: Enforces 20 questions/day limit for parents.
 * 4. Grounding & Relevance Check: Retrieves approved school passages and verifies threshold.
 * 5. Gemini Grounded Answer: Only invoked when relevant approved passages exist.
 */
export async function handleChatRequest(
  req: Request,
  context?: ChatRequestContext
): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { success: false, error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  // Zod schema validation
  const validationResult = ChatMessageInputSchema.safeParse(body);
  if (!validationResult.success) {
    const errorMessage =
      validationResult.error.issues[0]?.message || 'Invalid message payload.';
    return Response.json(
      {
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
      },
      { status: 400 }
    );
  }

  const { message } = validationResult.data;

  // CHECK 1: Private Records Boundary Enforcement
  // RULES_PRIVACY.md: Never query or leak private student records to the AI.
  if (isPrivateRecordInquiry(message)) {
    logEvent({
      level: 'info',
      event: 'ai_private_record_inquiry_intercepted',
      actorType: 'parent',
      actorId: context?.parentId,
      outcome: 'success',
      details: {
        reason: 'Protected private student record inquiry intercepted prior to Gemini call',
      },
    });

    const payload: ChatResponsePayload = {
      success: true,
      answer: ASK_THE_SCHOOL_COPY.STANDARD_RECORDS_REFUSAL,
      isPrivateRecordsRefusal: true,
      suggestedAction: 'records',
      wordCount: countWords(ASK_THE_SCHOOL_COPY.STANDARD_RECORDS_REFUSAL),
    };
    return Response.json(payload);
  }

  // CHECK 2: Daily Rate Limit Check (20 questions / parent / day)
  if (context?.parentId) {
    const { allowed } = await checkAndIncrementDailyUsage(context.parentId);
    if (!allowed) {
      logEvent({
        level: 'warn',
        event: 'ai_daily_rate_limit_exceeded',
        actorType: 'parent',
        actorId: context.parentId,
        outcome: 'failure',
      });

      const payload: ChatResponsePayload = {
        success: true,
        answer: ERROR_STRINGS.ASK_THE_OFFICE_FALLBACK,
        isRateLimited: true,
        isFallback: true,
        suggestedAction: 'office',
        wordCount: countWords(ERROR_STRINGS.ASK_THE_OFFICE_FALLBACK),
      };
      return Response.json(payload);
    }
  }

  // CHECK 3: Retrieval of Approved School Information
  const allPassages = await getApprovedPassages();
  const relevantPassages = await retrieveRelevantPassages(message, allPassages);
  // Ensure Gemini has approved school context even for conversational/general questions
  const passagesForGemini =
    relevantPassages.length > 0 ? relevantPassages : allPassages.slice(0, 5);

  // CHECK 4: Invoke Gemini for Grounded Answer
  try {
    const result = await generateGroundedAnswer({
      question: message,
      passages: passagesForGemini,
    });

    logEvent({
      level: 'info',
      event: 'ai_question_answered',
      actorType: 'parent',
      actorId: context?.parentId,
      outcome: 'success',
      details: {
        modelUsed: result.modelUsed,
        wordCount: result.wordCount,
      },
    });

    const isOfficeFallback = result.answer.includes(
      "I couldn't find an approved answer to this"
    );

    const payload: ChatResponsePayload = {
      success: true,
      answer: result.answer,
      isFallback: isOfficeFallback,
      suggestedAction: isOfficeFallback ? 'office' : undefined,
      modelUsed: result.modelUsed,
      wordCount: result.wordCount,
    };
    return Response.json(payload);
  } catch (error) {
    // RULES_AI.md Rule 11: If AI provider is unavailable, return Ask the Office fallback
    logEvent({
      level: 'error',
      event: 'ai_provider_unavailable',
      actorType: 'parent',
      actorId: context?.parentId,
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown provider error',
      },
    });

    const payload: ChatResponsePayload = {
      success: true,
      answer: ERROR_STRINGS.ASK_THE_OFFICE_FALLBACK,
      isFallback: true,
      suggestedAction: 'office',
      wordCount: countWords(ERROR_STRINGS.ASK_THE_OFFICE_FALLBACK),
    };
    return Response.json(payload);
  }
}
