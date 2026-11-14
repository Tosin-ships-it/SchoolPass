import 'server-only';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

export const FEE_TEMPLATES_SETTING_KEY = 'fee_templates';

const CUID_PATTERN = /^c[^\s-]{8,}$/i;
const MONEY_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const MAX_MONEY = 9999999999.99;
const CLASS_TOKEN_PATTERN = /[\p{L}\p{N}]/u;
const TERM_ID_PATTERN = /^(\d{4})\/(\d{4})-T([1-3])$/;

export type FeeTemplateErrorCode =
  | 'conflict'
  | 'not_found'
  | 'storage'
  | 'invalid_class'
  | 'invalid_target';

export class FeeTemplateError extends Error {
  readonly code: FeeTemplateErrorCode;

  constructor(code: FeeTemplateErrorCode, message: string) {
    super(message);
    this.name = 'FeeTemplateError';
    this.code = code;
  }
}

export class FeeTemplateStorageError extends FeeTemplateError {
  constructor(message: string) {
    super('storage', message);
    this.name = 'FeeTemplateStorageError';
  }
}

export function createFeeTemplateId(): string {
  return `c${randomBytes(16).toString('hex')}`;
}

export function normalizeFeeAmount(value: string): string {
  const [wholePart, fractionPart = ''] = value.trim().split('.');
  const normalizedWhole = wholePart.replace(/^0+(?=\d)/, '') || '0';
  const normalizedFraction = `${fractionPart}00`.slice(0, 2);
  return `${normalizedWhole}.${normalizedFraction}`;
}

const amountSchema = z
  .string({
    required_error: 'Amount is required.',
    invalid_type_error: 'Amount must be a valid amount.',
  })
  .trim()
  .min(1, 'Amount is required.')
  .regex(MONEY_PATTERN, 'Enter a valid amount with no more than 2 decimal places.')
  .refine((value) => Number(value) > 0, 'Amount must be greater than zero.')
  .refine((value) => Number(value) <= MAX_MONEY, 'Amount is too large.')
  .transform(normalizeFeeAmount);

const titleSchema = z
  .string({
    required_error: 'Fee title is required.',
    invalid_type_error: 'Fee title must be valid text.',
  })
  .trim()
  .min(2, 'Fee title must be at least 2 characters.')
  .max(100, 'Fee title must not exceed 100 characters.')
  .refine((value) => CLASS_TOKEN_PATTERN.test(value), 'Fee title must include letters or numbers.');

const targetClassSchema = z
  .string({
    required_error: 'Target class is required.',
    invalid_type_error: 'Target class must be valid text.',
  })
  .trim()
  .min(1, 'Target class is required.')
  .max(50, 'Target class must not exceed 50 characters.')
  .refine((value) => value.toUpperCase() === 'ALL' || CLASS_TOKEN_PATTERN.test(value), {
    message: 'Target class must include letters or numbers.',
  })
  .transform((value) => (value.toUpperCase() === 'ALL' ? 'ALL' : value));

const sessionYearSchema = z
  .string({
    required_error: 'Session year is required.',
    invalid_type_error: 'Session year must be valid text.',
  })
  .trim()
  .regex(/^\d{4}\/\d{4}$/, 'Session year must use the format YYYY/YYYY.')
  .refine(
    (value) => {
      const match = value.match(/^(\d{4})\/(\d{4})$/);
      if (!match) return false;
      const start = Number(match[1]);
      const end = Number(match[2]);
      return start >= 2000 && start <= 2100 && end === start + 1;
    },
    'Session year must be a consecutive academic year such as 2026/2027.'
  );

const termIdSchema = z
  .string({
    required_error: 'Term is required.',
    invalid_type_error: 'Term must be valid text.',
  })
  .trim()
  .regex(TERM_ID_PATTERN, 'Term must use the format YYYY/YYYY-T1, T2, or T3.');

const dueDateSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z
    .string()
    .trim()
    .refine((value) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
      }
      return !Number.isNaN(Date.parse(value));
    }, 'Due date must be a valid date.')
    .transform((value) => {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T23:59:59.999Z`)
        : new Date(value);
      return date.toISOString();
    })
    .optional()
);

const templateFields = z.object({
  title: titleSchema,
  amount: amountSchema,
  targetClass: targetClassSchema,
  sessionYear: sessionYearSchema,
  termId: termIdSchema,
  isCompulsory: z.boolean().default(true),
  dueDate: dueDateSchema,
});

function addTermConsistencyIssue(
  value: { sessionYear: string; termId: string },
  context: z.RefinementCtx
): void {
  if (!value.termId.startsWith(`${value.sessionYear}-`)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['termId'],
      message: 'Term must belong to the selected session year.',
    });
  }
}

export const feeTemplateInputSchema = templateFields.superRefine(addTermConsistencyIssue);

export const feeTemplateUpdateSchema = templateFields
  .extend({
    id: z.string().trim().regex(CUID_PATTERN, 'Invalid fee template identifier.'),
  })
  .superRefine(addTermConsistencyIssue);

export const feeTemplateRecordSchema = templateFields
  .extend({
    id: z.string().trim().regex(CUID_PATTERN, 'Invalid fee template identifier.'),
  })
  .superRefine(addTermConsistencyIssue);

export const feeTemplateIdSchema = z.object({
  templateId: z.string().trim().regex(CUID_PATTERN, 'Invalid fee template identifier.'),
});

export const bulkTemplateAssignmentSchema = z.object({
  templateId: z.string().trim().regex(CUID_PATTERN, 'Invalid fee template identifier.'),
  targetClass: z
    .string()
    .trim()
    .min(1, 'Target class is required.')
    .max(50, 'Target class must not exceed 50 characters.'),
});

export const individualChargeSchema = z.object({
  studentId: z.string().trim().regex(CUID_PATTERN, 'Select a valid student.'),
  title: titleSchema,
  amount: amountSchema,
  termId: termIdSchema,
  note: z
    .string()
    .trim()
    .max(500, 'Note must not exceed 500 characters.')
    .optional()
    .or(z.literal('')),
});

export type FeeTemplateInput = z.infer<typeof feeTemplateInputSchema>;
export type FeeTemplateUpdateInput = z.infer<typeof feeTemplateUpdateSchema>;
export type FeeTemplate = z.infer<typeof feeTemplateRecordSchema>;
export type IndividualChargeInput = z.infer<typeof individualChargeSchema>;

export interface FeeAssignmentStudent {
  id: string;
  studentNumber: string;
  name: string;
  className: string;
  leftAt: Date | null;
}

export interface FeeAssignmentStudentPreview {
  id: string;
  studentNumber: string;
  name: string;
  className: string;
}

export interface ExistingFeeCharge {
  studentId: string;
  termId: string;
  type: string;
  note: string | null;
}

export interface TemplateAssignmentPlan {
  eligibleStudents: FeeAssignmentStudent[];
  skippedStudents: FeeAssignmentStudent[];
}

export interface TemplateAssignmentPreview {
  template: FeeTemplate;
  targetClass: string;
  eligibleStudents: FeeAssignmentStudentPreview[];
  skippedCount: number;
  totalStudents: number;
}

export interface TemplateAssignmentResult {
  template: FeeTemplate;
  targetClass: string;
  createdCount: number;
  skippedCount: number;
  totalStudents: number;
}

export function getSessionYearFromTermId(termId: string): string | null {
  const match = termId.trim().match(TERM_ID_PATTERN);
  return match ? `${match[1]}/${match[2]}` : null;
}

export function buildTemplateMarker(templateId: string): string {
  return `(template:${templateId})`;
}

export function buildTemplateChargeNote(template: FeeTemplate): string {
  return `${template.title} ${buildTemplateMarker(template.id)}`;
}

export function hasTemplateMarker(note: string | null | undefined, templateId: string): boolean {
  return Boolean(note?.includes(buildTemplateMarker(templateId)));
}

export function buildIndividualChargeNote(title: string, note?: string): string {
  const trimmedNote = note?.trim();
  return trimmedNote ? `${title.trim()} - ${trimmedNote}` : title.trim();
}

export function areSameClass(first: string, second: string): boolean {
  return first.trim().toLowerCase() === second.trim().toLowerCase();
}

/**
 * Checks whether a student's class belongs to a target fee class.
 * Supports:
 * - 'ALL' target matching all students.
 * - Exact case-insensitive match (e.g. 'JSS 1' === 'JSS 1', 'JSS 1A' === 'JSS 1A').
 * - Level-tier matching where fees are set for an academic level and apply to all arms/streams
 *   of that level (e.g. target 'JSS 1' covers students in 'JSS 1A', 'JSS 1B', 'JSS 1 - Gold', etc.).
 */
export function doesStudentClassMatchTarget(
  studentClass: string | null | undefined,
  targetClass: string | null | undefined
): boolean {
  if (!studentClass || !targetClass) return false;
  const target = targetClass.trim();
  const student = studentClass.trim();

  if (target.toUpperCase() === 'ALL') return true;
  if (areSameClass(student, target)) return true;

  const normTarget = target.toLowerCase().replace(/\s+/g, ' ');
  const normStudent = student.toLowerCase().replace(/\s+/g, ' ');

  if (normStudent === normTarget) return true;

  // Level matching: target represents the grade/tier (e.g. "JSS 1", "Primary 2", "Creche")
  // and student is in a specific arm/stream (e.g. "JSS 1A", "JSS 1B", "Primary 2 - Gold", "Creche A")
  if (normStudent.startsWith(normTarget)) {
    const remainder = normStudent.slice(normTarget.length);
    // If remainder starts with a digit, it is a different level (e.g. "Primary 1" vs "Primary 10")
    if (!/^[0-9]/.test(remainder)) {
      if (/[0-9]$/.test(normTarget)) {
        // e.g. "JSS 1" -> "JSS 1A", "JSS 1 A", "JSS 1-A", "JSS 1 (Gold)"
        if (/^[a-z]/i.test(remainder) || /^[\s\-_/(]/.test(remainder)) {
          return true;
        }
      } else {
        // e.g. "Creche" -> "Creche A", "Creche - Gold", "Creche/Daycare"
        if (/^[\s\-_/(]/.test(remainder)) {
          return true;
        }
      }
    }
  }

  // Also handle spacing variants like "JSS1" vs "JSS 1"
  const compactTarget = normTarget.replace(/\s+/g, '');
  const compactStudent = normStudent.replace(/\s+/g, '');
  if (compactStudent === compactTarget) return true;

  if (compactStudent.startsWith(compactTarget)) {
    const remainder = compactStudent.slice(compactTarget.length);
    if (!/^[0-9]/.test(remainder)) {
      if (/[0-9]$/.test(compactTarget)) {
        if (/^[a-z]/i.test(remainder) || /^[\-_/(]/.test(remainder)) {
          return true;
        }
      } else {
        if (/^[\-_/(]/.test(remainder)) {
          return true;
        }
      }
    }
  }

  return false;
}

export function canonicalizeTargetClass(
  targetClass: string,
  configuredClasses: readonly string[]
): { targetClass: string; error?: string } {
  const trimmed = targetClass.trim();
  if (trimmed.toUpperCase() === 'ALL') {
    return { targetClass: 'ALL' };
  }

  // 1. Direct match in configured classes
  const match = configuredClasses.find((className) => areSameClass(className, trimmed));
  if (match) {
    return { targetClass: match };
  }

  // 2. Level match: targetClass is an academic level that encompasses configured arms/streams
  // (e.g. target "JSS 1" matches configured classes ["JSS 1A", "JSS 1B"])
  const levelMatch = configuredClasses.some((className) =>
    doesStudentClassMatchTarget(className, trimmed)
  );
  if (levelMatch) {
    return { targetClass: trimmed };
  }

  if (configuredClasses.length === 0) {
    return { targetClass: trimmed };
  }

  return {
    targetClass: trimmed,
    error: `Class "${trimmed}" is not configured for this school.`,
  };
}

export function findDuplicateFeeTemplate(
  templates: readonly FeeTemplate[],
  candidate: Pick<FeeTemplate, 'title' | 'amount' | 'targetClass' | 'termId'>,
  excludeId?: string
): FeeTemplate | undefined {
  return templates.find((template) => {
    if (excludeId && template.id === excludeId) return false;
    return (
      template.title.trim().toLowerCase() === candidate.title.trim().toLowerCase() &&
      template.amount === candidate.amount &&
      areSameClass(template.targetClass, candidate.targetClass) &&
      template.termId === candidate.termId
    );
  });
}

export function planTemplateAssignment(
  template: FeeTemplate,
  students: readonly FeeAssignmentStudent[],
  existingCharges: readonly ExistingFeeCharge[],
  confirmedTargetClass: string
): TemplateAssignmentPlan {
  const marker = buildTemplateMarker(template.id);
  const alreadyAssigned = new Set(
    existingCharges
      .filter(
        (charge) =>
          charge.type === 'CHARGE' &&
          charge.termId === template.termId &&
          Boolean(charge.note?.includes(marker))
      )
      .map((charge) => charge.studentId)
  );

  const eligibleStudents: FeeAssignmentStudent[] = [];
  const skippedStudents: FeeAssignmentStudent[] = [];

  for (const student of students) {
    if (student.leftAt) continue;
    if (!doesStudentClassMatchTarget(student.className, confirmedTargetClass)) continue;

    if (alreadyAssigned.has(student.id)) {
      skippedStudents.push(student);
    } else {
      eligibleStudents.push(student);
    }
  }

  return { eligibleStudents, skippedStudents };
}

export function parseFeeTemplatesJson(value: string | null | undefined): FeeTemplate[] {
  if (!value || value.trim() === '') return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new FeeTemplateStorageError('Fee template configuration could not be read.');
  }

  if (!Array.isArray(parsed)) {
    throw new FeeTemplateStorageError('Fee template configuration must be a list.');
  }

  const templates: FeeTemplate[] = [];
  for (const item of parsed) {
    const result = feeTemplateRecordSchema.safeParse(item);
    if (!result.success) {
      throw new FeeTemplateStorageError('Fee template configuration contains invalid data.');
    }
    templates.push(result.data);
  }

  return templates;
}

export function serializeFeeTemplates(templates: readonly FeeTemplate[]): string {
  return JSON.stringify(templates);
}

function isSerializationFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2034'
  );
}

async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isSerializationFailure(error) || attempt === 2) throw error;
    }
  }

  throw new FeeTemplateStorageError('Fee template storage is temporarily unavailable.');
}

async function mutateFeeTemplateStore<T>(
  mutator: (templates: FeeTemplate[]) => { templates: FeeTemplate[]; result: T }
): Promise<T> {
  const { prisma } = await import('@/lib/db');
  const { Prisma } = await import('@prisma/client');

  return withSerializableRetry(() =>
    prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.schoolSetting.findUnique({
          where: { key: FEE_TEMPLATES_SETTING_KEY },
        });
        const templates = parseFeeTemplatesJson(existing?.value);
        const outcome = mutator(templates);
        const serialized = serializeFeeTemplates(outcome.templates);

        if (serialized !== existing?.value) {
          await transaction.schoolSetting.upsert({
            where: { key: FEE_TEMPLATES_SETTING_KEY },
            create: { key: FEE_TEMPLATES_SETTING_KEY, value: serialized },
            update: { value: serialized },
          });
        }

        return outcome.result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
}

export async function listFeeTemplates(): Promise<FeeTemplate[]> {
  const { prisma } = await import('@/lib/db');
  const setting = await prisma.schoolSetting.findUnique({
    where: { key: FEE_TEMPLATES_SETTING_KEY },
  });
  return parseFeeTemplatesJson(setting?.value);
}

export async function getFeeTemplateById(templateId: string): Promise<FeeTemplate | null> {
  const templates = await listFeeTemplates();
  return templates.find((template) => template.id === templateId) ?? null;
}

export async function createFeeTemplate(input: FeeTemplateInput): Promise<FeeTemplate> {
  const template: FeeTemplate = {
    ...input,
    id: createFeeTemplateId(),
  };

  return mutateFeeTemplateStore((templates) => {
    const duplicate = findDuplicateFeeTemplate(templates, template);
    if (duplicate) {
      throw new FeeTemplateError(
        'conflict',
        'A matching fee template already exists for this class and term.'
      );
    }

    return { templates: [...templates, template], result: template };
  });
}

export async function updateFeeTemplate(input: FeeTemplateUpdateInput): Promise<FeeTemplate> {
  const { id, ...fields } = input;
  const updated: FeeTemplate = { id, ...fields };

  return mutateFeeTemplateStore((templates) => {
    const index = templates.findIndex((template) => template.id === id);
    if (index === -1) {
      throw new FeeTemplateError('not_found', 'Fee template not found.');
    }

    const duplicate = findDuplicateFeeTemplate(templates, updated, id);
    if (duplicate) {
      throw new FeeTemplateError(
        'conflict',
        'A matching fee template already exists for this class and term.'
      );
    }

    const nextTemplates = [...templates];
    nextTemplates[index] = updated;
    return { templates: nextTemplates, result: updated };
  });
}

export async function deleteFeeTemplate(templateId: string): Promise<FeeTemplate> {
  return mutateFeeTemplateStore((templates) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      throw new FeeTemplateError('not_found', 'Fee template not found.');
    }

    return {
      templates: templates.filter((item) => item.id !== templateId),
      result: template,
    };
  });
}

export async function listActiveStudentsForFeeAssignment(): Promise<FeeAssignmentStudent[]> {
  const { prisma } = await import('@/lib/db');
  return prisma.student.findMany({
    where: { leftAt: null },
    select: {
      id: true,
      studentNumber: true,
      name: true,
      className: true,
      leftAt: true,
    },
    orderBy: [{ className: 'asc' }, { name: 'asc' }],
  });
}

function toPreviewStudent(student: FeeAssignmentStudent): FeeAssignmentStudentPreview {
  return {
    id: student.id,
    studentNumber: student.studentNumber,
    name: student.name,
    className: student.className,
  };
}

export async function previewTemplateAssignment(
  template: FeeTemplate,
  targetClass: string
): Promise<TemplateAssignmentPreview> {
  const { prisma } = await import('@/lib/db');

  const allStudents = await prisma.student.findMany({
    where: { leftAt: null },
    select: {
      id: true,
      studentNumber: true,
      name: true,
      className: true,
      leftAt: true,
    },
    orderBy: [{ className: 'asc' }, { name: 'asc' }],
  });

  const students = allStudents.filter((student) =>
    doesStudentClassMatchTarget(student.className, targetClass)
  );

  const studentIds = students.map((student) => student.id);
  const existingCharges =
    studentIds.length === 0
      ? []
      : await prisma.feeEntry.findMany({
          where: {
            studentId: { in: studentIds },
            termId: template.termId,
            type: 'CHARGE',
          },
          select: {
            studentId: true,
            termId: true,
            type: true,
            note: true,
          },
        });

  const plan = planTemplateAssignment(template, students, existingCharges, targetClass);

  return {
    template,
    targetClass,
    eligibleStudents: plan.eligibleStudents.map(toPreviewStudent),
    skippedCount: plan.skippedStudents.length,
    totalStudents: students.length,
  };
}

export async function assignTemplateToClass(
  template: FeeTemplate,
  targetClass: string,
  createdByStaffId: string
): Promise<TemplateAssignmentResult> {
  const { prisma } = await import('@/lib/db');
  const { Prisma } = await import('@prisma/client');

  return withSerializableRetry(() =>
    prisma.$transaction(
      async (transaction) => {
        const allStudents = await transaction.student.findMany({
          where: { leftAt: null },
          select: {
            id: true,
            studentNumber: true,
            name: true,
            className: true,
            leftAt: true,
          },
          orderBy: [{ className: 'asc' }, { name: 'asc' }],
        });

        const students = allStudents.filter((student) =>
          doesStudentClassMatchTarget(student.className, targetClass)
        );

        const studentIds = students.map((student) => student.id);
        const existingCharges =
          studentIds.length === 0
            ? []
            : await transaction.feeEntry.findMany({
                where: {
                  studentId: { in: studentIds },
                  termId: template.termId,
                  type: 'CHARGE',
                },
                select: {
                  studentId: true,
                  termId: true,
                  type: true,
                  note: true,
                },
              });

        const plan = planTemplateAssignment(template, students, existingCharges, targetClass);
        const note = buildTemplateChargeNote(template);

        if (plan.eligibleStudents.length > 0) {
          await transaction.feeEntry.createMany({
            data: plan.eligibleStudents.map((student) => ({
              studentId: student.id,
              termId: template.termId,
              type: 'CHARGE',
              amount: new Prisma.Decimal(template.amount),
              note,
              createdByStaffId,
            })),
          });
        }

        return {
          template,
          targetClass,
          createdCount: plan.eligibleStudents.length,
          skippedCount: plan.skippedStudents.length,
          totalStudents: students.length,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
}

export async function createIndividualCharge(
  input: IndividualChargeInput,
  createdByStaffId: string
): Promise<{ feeEntryId: string; created: boolean }> {
  const { prisma } = await import('@/lib/db');
  const { Prisma } = await import('@prisma/client');
  const note = buildIndividualChargeNote(input.title, input.note);
  const amount = new Prisma.Decimal(input.amount);

  return withSerializableRetry(() =>
    prisma.$transaction(
      async (transaction) => {
        const student = await transaction.student.findFirst({
          where: { id: input.studentId, leftAt: null },
          select: { id: true },
        });

        if (!student) {
          throw new FeeTemplateError('not_found', 'Active student not found.');
        }

        const duplicate = await transaction.feeEntry.findFirst({
          where: {
            studentId: input.studentId,
            termId: input.termId,
            type: 'CHARGE',
            amount,
            note,
          },
          select: { id: true },
        });

        if (duplicate) {
          throw new FeeTemplateError(
            'conflict',
            'This identical charge already exists for the selected student.'
          );
        }

        const entry = await transaction.feeEntry.create({
          data: {
            studentId: input.studentId,
            termId: input.termId,
            type: 'CHARGE',
            amount,
            note,
            createdByStaffId,
          },
          select: { id: true },
        });

        return { feeEntryId: entry.id, created: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
}
