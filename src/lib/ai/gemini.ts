import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { logEvent } from '@/lib/logging';
import { ERROR_STRINGS } from '@/lib/errors/strings';

/**
 * AI configuration constants adhering to RULES_AI.md
 */
export const AI_CONFIG = {
  MAX_ANSWER_WORDS: 120, // Rule 7: An answer is at most 120 words.
  PASSAGE_SIZE_TOKENS: 512, // Rule 9: 512 tokens
  PASSAGE_OVERLAP_TOKENS: 50, // Rule 9: 50-token overlap
  DEFAULT_RELEVANCE_THRESHOLD: 0.65, // Rule 4: Cosine similarity
} as const;

let defaultClient: GoogleGenAI | null = null;

/**
 * Creates or retrieves the singleton GoogleGenAI client.
 * Strictly server-only; uses process.env.GEMINI_API_KEY.
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured');
  }
  if (!defaultClient) {
    defaultClient = new GoogleGenAI({ apiKey });
  }
  return defaultClient;
}

interface VerifiedModelsCache {
  generationModels: string[];
  embeddingModels: string[];
  timestamp: number;
}

let verifiedModelsCache: VerifiedModelsCache | null = null;
const MODEL_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache

/**
 * Programmatically discovers and verifies available Gemini model IDs for the configured API key.
 * Never assumes model availability.
 */
export async function getVerifiedModelIds(forceRefresh = false): Promise<{
  generationModels: string[];
  embeddingModels: string[];
}> {
  const now = Date.now();
  if (
    !forceRefresh &&
    verifiedModelsCache &&
    now - verifiedModelsCache.timestamp < MODEL_CACHE_TTL_MS
  ) {
    return {
      generationModels: [...verifiedModelsCache.generationModels],
      embeddingModels: [...verifiedModelsCache.embeddingModels],
    };
  }

  const ai = getGeminiClient();
  const generationModels: string[] = [];
  const embeddingModels: string[] = [];

  try {
    const pager = await ai.models.list();
    for await (const m of pager) {
      const id = m.name?.replace(/^models\//, '') || '';
      const actions = m.supportedActions || [];
      if (actions.includes('generateContent') && id) {
        generationModels.push(id);
      }
      if (actions.includes('embedContent') && id) {
        embeddingModels.push(id);
      }
    }

    verifiedModelsCache = {
      generationModels,
      embeddingModels,
      timestamp: now,
    };

    logEvent({
      level: 'info',
      event: 'ai_models_verified',
      actorType: 'system',
      outcome: 'success',
      details: {
        generationCount: generationModels.length,
        embeddingCount: embeddingModels.length,
      },
    });

    return {
      generationModels: [...generationModels],
      embeddingModels: [...embeddingModels],
    };
  } catch (error) {
    logEvent({
      level: 'error',
      event: 'ai_model_verification_failed',
      actorType: 'system',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown model listing error',
      },
    });

    if (verifiedModelsCache) {
      return {
        generationModels: [...verifiedModelsCache.generationModels],
        embeddingModels: [...verifiedModelsCache.embeddingModels],
      };
    }

    throw new Error(
      `Failed to verify available Gemini models: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Resolves prioritized, verified generation model IDs available to our API key.
 * Checks explicitly requested/configured models against verified models first.
 */
export async function resolveVerifiedGenerativeModels(
  requestedModel?: string
): Promise<string[]> {
  const { generationModels } = await getVerifiedModelIds();

  // If a specific model was requested and verified, prioritize it
  const explicitlyConfigured = requestedModel || process.env.GEMINI_MODEL;
  const verifiedExplicit =
    explicitlyConfigured && generationModels.includes(explicitlyConfigured)
      ? explicitlyConfigured
      : null;

  // Preferred high-efficiency flash models in priority order
  const priorityList = [
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
  ];

  const candidates: string[] = [];
  if (verifiedExplicit) {
    candidates.push(verifiedExplicit);
  }

  for (const m of priorityList) {
    if (generationModels.includes(m) && !candidates.includes(m)) {
      candidates.push(m);
    }
  }

  // Include any other verified generation model supported by the key
  for (const m of generationModels) {
    if (!candidates.includes(m)) {
      candidates.push(m);
    }
  }

  if (candidates.length === 0) {
    throw new Error('No verified Gemini generation models available for this API key.');
  }

  return candidates;
}

/**
 * Resolves the active embedding model ID, ensuring it is verified and available.
 */
export async function resolveVerifiedEmbeddingModel(
  requestedModel?: string
): Promise<string> {
  const { embeddingModels } = await getVerifiedModelIds();

  const explicitlyConfigured = requestedModel || process.env.GEMINI_EMBEDDING_MODEL;
  if (explicitlyConfigured && embeddingModels.includes(explicitlyConfigured)) {
    return explicitlyConfigured;
  }

  const priorityList = ['gemini-embedding-001', 'gemini-embedding-2'];
  for (const m of priorityList) {
    if (embeddingModels.includes(m)) {
      return m;
    }
  }

  if (embeddingModels.length > 0) {
    return embeddingModels[0];
  }

  throw new Error('No verified Gemini embedding models available for this API key.');
}

/**
 * Counts words in a string by whitespace splitting.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Enforces RULES_AI.md Rule 7:
 * "An answer is at most 120 words. A longer answer is truncated at the sentence boundary."
 */
export function truncateToSentenceBoundary(
  text: string,
  maxWords: number = AI_CONFIG.MAX_ANSWER_WORDS
): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const totalWords = countWords(trimmed);
  if (totalWords <= maxWords) {
    return trimmed;
  }

  // Split into sentences preserving punctuation
  const sentenceMatches = trimmed.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  if (!sentenceMatches) {
    const words = trimmed.split(/\s+/).slice(0, maxWords);
    return `${words.join(' ')}...`;
  }

  let accumulated = '';
  for (const sentence of sentenceMatches) {
    const candidate = accumulated ? `${accumulated} ${sentence.trim()}` : sentence.trim();
    if (countWords(candidate) <= maxWords) {
      accumulated = candidate;
    } else {
      break;
    }
  }

  if (accumulated && countWords(accumulated) > 0) {
    return accumulated;
  }

  // Fallback if even the first sentence exceeds maxWords
  const words = trimmed.split(/\s+/).slice(0, maxWords);
  return `${words.join(' ')}...`;
}

/**
 * Computes cosine similarity between two numeric vectors.
 * RULES_AI.md Rule 4: Threshold units are cosine similarity on the embeddings Gemini produces.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const valA = a[i];
    const valB = b[i];
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface EmbedTextOptions {
  model?: string;
}

/**
 * Computes vector embeddings for a single text using a verified embedding model.
 */
export async function embedText(
  text: string,
  options?: EmbedTextOptions
): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  const ai = getGeminiClient();
  const model = await resolveVerifiedEmbeddingModel(options?.model);

  try {
    const response = await ai.models.embedContent({
      model,
      contents: trimmed,
    });
    const values = response.embeddings?.[0]?.values;
    if (!values || !Array.isArray(values)) {
      throw new Error('No embedding values returned from Gemini API');
    }
    return values;
  } catch (error) {
    logEvent({
      level: 'error',
      event: 'ai_embedding_error',
      actorType: 'system',
      outcome: 'failure',
      details: {
        model,
        error: error instanceof Error ? error.message : 'Unknown embedding error',
      },
    });
    throw error;
  }
}

/**
 * Computes vector embeddings for a batch of passages using a verified embedding model.
 */
export async function embedPassages(
  texts: string[],
  options?: EmbedTextOptions
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }
  const ai = getGeminiClient();
  const model = await resolveVerifiedEmbeddingModel(options?.model);

  try {
    const response = await ai.models.embedContent({
      model,
      contents: texts,
    });
    const embeddings = response.embeddings ?? [];
    return embeddings.map((e) => e.values ?? []);
  } catch (error) {
    logEvent({
      level: 'error',
      event: 'ai_batch_embedding_error',
      actorType: 'system',
      outcome: 'failure',
      details: {
        model,
        count: texts.length,
        error: error instanceof Error ? error.message : 'Unknown embedding error',
      },
    });
    throw error;
  }
}

export interface GroundedAnswerParams {
  question: string;
  passages: string[];
  options?: {
    model?: string;
    temperature?: number;
  };
}

export interface GroundedAnswerResult {
  answer: string;
  wordCount: number;
  modelUsed: string;
  grounded: boolean;
}

const SYSTEM_INSTRUCTION_GROUNDED = `You are the official SchoolPass assistant for the school.
Your job is to answer parent questions using ONLY the approved school information passages provided.
RULES:
1. Ground your answer strictly and exclusively in the provided passages.
2. Never invent, extrapolate, or assume facts not present in the passages.
3. If the passages do not contain the answer, reply with: "${ERROR_STRINGS.ASK_THE_OFFICE_FALLBACK}"
4. Keep your answer concise, courteous, and under 120 words.
5. Do not refer to "passage 1" or "the text provided"; speak directly on behalf of the school's approved guidelines.`;

/**
 * Generates an answer strictly grounded on ApprovedSchoolInfo passages using verified models.
 * Adheres to RULES_AI.md:
 * - Rule 1 & 2: Prompt contains only question text and approved passages. No student/private data.
 * - Rule 3: Grounded in source passages only.
 * - Rule 6: Single-turn; no conversational memory.
 * - Rule 7: Truncated at sentence boundary if exceeding 120 words.
 */
export async function generateGroundedAnswer({
  question,
  passages,
  options,
}: GroundedAnswerParams): Promise<GroundedAnswerResult> {
  const candidateModels = await resolveVerifiedGenerativeModels(options?.model);

  if (passages.length === 0) {
    return {
      answer: ERROR_STRINGS.ASK_THE_OFFICE_FALLBACK,
      wordCount: countWords(ERROR_STRINGS.ASK_THE_OFFICE_FALLBACK),
      modelUsed: candidateModels[0],
      grounded: false,
    };
  }

  const ai = getGeminiClient();

  const formattedPassages = passages
    .map((p, index) => `[Passage ${index + 1}]\n${p.trim()}`)
    .join('\n\n');

  const prompt = `Approved School Information Passages:
${formattedPassages}

Parent Question:
${question.trim()}

Answer:`;

  let lastError: unknown = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_GROUNDED,
          temperature: options?.temperature ?? 0.2, // Low temperature for high factual accuracy
          maxOutputTokens: 250, // Approx ~150-180 words maximum
        },
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        return {
          answer: ERROR_STRINGS.ASK_THE_OFFICE_FALLBACK,
          wordCount: countWords(ERROR_STRINGS.ASK_THE_OFFICE_FALLBACK),
          modelUsed: model,
          grounded: false,
        };
      }

      const truncated = truncateToSentenceBoundary(rawText, AI_CONFIG.MAX_ANSWER_WORDS);
      const wordCount = countWords(truncated);

      return {
        answer: truncated,
        wordCount,
        modelUsed: model,
        grounded: true,
      };
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  logEvent({
    level: 'error',
    event: 'ai_generation_error',
    actorType: 'system',
    outcome: 'failure',
    details: {
      triedModels: candidateModels,
      error: lastError instanceof Error ? lastError.message : 'Unknown generation error',
    },
  });
  throw lastError;
}

export interface GenerateTextOptions {
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * General single-turn text generation helper using verified models.
 */
export async function generateText(
  prompt: string,
  options?: GenerateTextOptions
): Promise<string> {
  const candidateModels = await resolveVerifiedGenerativeModels(options?.model);
  const ai = getGeminiClient();

  let lastError: unknown = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: options?.systemInstruction,
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxOutputTokens,
        },
      });

      return response.text?.trim() || '';
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  logEvent({
    level: 'error',
    event: 'ai_generate_text_error',
    actorType: 'system',
    outcome: 'failure',
    details: {
      triedModels: candidateModels,
      error: lastError instanceof Error ? lastError.message : 'Unknown generation error',
    },
  });
  throw lastError;
}
