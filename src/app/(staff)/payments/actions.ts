'use server';

import { revalidatePath } from 'next/cache';
import {
  assertAdminSession,
  getConfiguredClasses,
  getConfiguredSessions,
} from '@/lib/auth';
import { validateActionPayload } from '@/lib/auth/validation';
import { ERROR_STRINGS } from '@/lib/errors/strings';
import { logEvent } from '@/lib/logging';
import { loadTermCalendarFromSettings } from '@/lib/payments/ledger';
import {
  OfflineEntryError,
  adjustmentSchema,
  offlinePaymentSchema,
  recordAdjustment,
  recordOfflinePayment,
  type OfflinePaymentInput,
} from '@/lib/payments/offline';
import {
  FeeTemplateError,
  assignTemplateToClass,
  bulkTemplateAssignmentSchema,
  canonicalizeTargetClass,
  createFeeTemplate,
  createIndividualCharge,
  deleteFeeTemplate,
  feeTemplateIdSchema,
  feeTemplateInputSchema,
  feeTemplateUpdateSchema,
  getFeeTemplateById,
  getSessionYearFromTermId,
  individualChargeSchema,
  previewTemplateAssignment,
  updateFeeTemplate,
  type FeeTemplate,
  type FeeTemplateInput,
  type FeeTemplateUpdateInput,
  type IndividualChargeInput,
  type TemplateAssignmentPreview,
  type TemplateAssignmentResult,
} from '@/lib/payments/templates';

export type FeeManagementErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'session_expired'
  | 'conflict'
  | 'not_found'
  | 'storage'
  | 'configuration'
  | 'temporary'
  | 'unexpected';

interface FeeManagementFailure {
  success: false;
  error: string;
  errorCode: FeeManagementErrorCode;
  fieldErrors?: Record<string, string>;
}

export interface FeeTemplateActionResult {
  success: boolean;
  template?: FeeTemplate;
  error?: string;
  errorCode?: FeeManagementErrorCode;
  fieldErrors?: Record<string, string>;
}

export interface DeleteFeeTemplateActionResult {
  success: boolean;
  templateId?: string;
  error?: string;
  errorCode?: FeeManagementErrorCode;
  fieldErrors?: Record<string, string>;
}

export interface TemplateAssignmentPreviewActionResult {
  success: boolean;
  preview?: TemplateAssignmentPreview;
  error?: string;
  errorCode?: FeeManagementErrorCode;
  fieldErrors?: Record<string, string>;
}

export interface TemplateAssignmentActionResult {
  success: boolean;
  result?: TemplateAssignmentResult;
  error?: string;
  errorCode?: FeeManagementErrorCode;
  fieldErrors?: Record<string, string>;
}

export interface IndividualChargeActionResult {
  success: boolean;
  feeEntryId?: string;
  error?: string;
  errorCode?: FeeManagementErrorCode;
  fieldErrors?: Record<string, string>;
}

export interface OfflinePaymentActionResult {
  success: boolean;
  feeEntryId?: string;
  termId?: string;
  error?: string;
  errorCode?: FeeManagementErrorCode;
  fieldErrors?: Record<string, string>;
}

export interface AdjustmentActionResult {
  success: boolean;
  feeEntryId?: string;
  termId?: string;
  error?: string;
  errorCode?: FeeManagementErrorCode;
  fieldErrors?: Record<string, string>;
}

type AdminGuardResult =
  | { authorized: true; userId: string }
  | { authorized: false; result: FeeManagementFailure };

async function getAdminForAction(action: string): Promise<AdminGuardResult> {
  const auth = await assertAdminSession();

  if (!auth.authorized || !auth.session) {
    logEvent({
      level: 'warn',
      event: 'fee_management_action_failed',
      actorType: auth.session?.role ?? 'anonymous',
      actorId: auth.session?.userId ?? 'unknown',
      outcome: 'failure',
      details: { action, reason: 'unauthorized' },
    });

    return {
      authorized: false,
      result: {
        success: false,
        error: auth.session
          ? auth.error ?? 'Unauthorized. Admin privileges required.'
          : 'Your session has expired. Please sign in again.',
        errorCode: auth.session ? 'unauthorized' : 'session_expired',
      },
    };
  }

  return { authorized: true, userId: auth.session.userId };
}

function isSerializationFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2034'
  );
}

function failureForError(
  error: unknown,
  action: string,
  userId: string
): FeeManagementFailure {
  let errorCode: FeeManagementErrorCode = 'unexpected';
  let message: string = ERROR_STRINGS.GENERIC_RETRY;
  let fieldErrors: Record<string, string> | undefined;

  if (error instanceof FeeTemplateError) {
    if (error.code === 'conflict') {
      errorCode = 'conflict';
      message = error.message;
    } else if (error.code === 'not_found') {
      errorCode = 'not_found';
      message = error.message;
    } else if (error.code === 'storage') {
      errorCode = 'storage';
      message = 'Fee template configuration is temporarily unavailable.';
    } else {
      errorCode = 'validation';
      message = error.message;
      fieldErrors = { targetClass: error.message };
    }
  } else if (error instanceof OfflineEntryError) {
    if (error.code === 'conflict') {
      errorCode = 'conflict';
      message = error.message;
    } else if (error.code === 'not_found') {
      errorCode = 'not_found';
      message = error.message;
    } else if (error.code === 'configuration') {
      errorCode = 'configuration';
      message = error.message;
    } else {
      errorCode = 'storage';
      message = 'The fee ledger is temporarily unavailable. Please try again.';
    }
  } else if (isSerializationFailure(error)) {
    errorCode = 'temporary';
    message = 'The fee change could not be saved because another update was in progress. Please try again.';
  }

  logEvent({
    level: 'error',
    event: 'fee_management_action_failed',
    actorType: 'admin',
    actorId: userId,
    outcome: 'failure',
    details: {
      action,
      reason: errorCode,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    },
  });

  return { success: false, error: message, errorCode, fieldErrors };
}

async function validateTemplateConfiguration(
  targetClass: string,
  sessionYear: string
): Promise<{ targetClass?: string; fieldErrors?: Record<string, string> }> {
  const [classes, sessions] = await Promise.all([
    getConfiguredClasses(),
    getConfiguredSessions(),
  ]);

  const classResult = canonicalizeTargetClass(targetClass, classes);
  const fieldErrors: Record<string, string> = {};

  if (classResult.error) {
    fieldErrors.targetClass = classResult.error;
  }

  if (sessions.length > 0 && !sessions.includes(sessionYear)) {
    fieldErrors.sessionYear = 'Select a configured academic session.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  return { targetClass: classResult.targetClass };
}

export async function createFeeTemplateAction(
  payload: FeeTemplateInput
): Promise<FeeTemplateActionResult> {
  const guard = await getAdminForAction('fee_template_create');
  if (!guard.authorized) return guard.result;

  const validation = validateActionPayload(payload, feeTemplateInputSchema);
  if (!validation.success) {
    logEvent({
      level: 'warn',
      event: 'fee_management_action_failed',
      actorType: 'admin',
      actorId: guard.userId,
      outcome: 'failure',
      details: { action: 'fee_template_create', reason: 'validation' },
    });
    return {
      success: false,
      error: validation.error,
      errorCode: 'validation',
      fieldErrors: validation.fieldErrors,
    };
  }

  try {
    const configuration = await validateTemplateConfiguration(
      validation.data.targetClass,
      validation.data.sessionYear
    );
    if (configuration.fieldErrors) {
      return {
        success: false,
        error: 'Review the highlighted fee template fields.',
        errorCode: 'validation',
        fieldErrors: configuration.fieldErrors,
      };
    }

    const template = await createFeeTemplate({
      ...validation.data,
      targetClass: configuration.targetClass ?? validation.data.targetClass,
    });

    revalidatePath('/payments');
    logEvent({
      level: 'info',
      event: 'fee_template_created',
      actorType: 'admin',
      actorId: guard.userId,
      entityType: 'fee_template',
      entityId: template.id,
      outcome: 'success',
    });

    return { success: true, template };
  } catch (error) {
    return failureForError(error, 'fee_template_create', guard.userId);
  }
}

export async function updateFeeTemplateAction(
  payload: FeeTemplateUpdateInput
): Promise<FeeTemplateActionResult> {
  const guard = await getAdminForAction('fee_template_update');
  if (!guard.authorized) return guard.result;

  const validation = validateActionPayload(payload, feeTemplateUpdateSchema);
  if (!validation.success) {
    logEvent({
      level: 'warn',
      event: 'fee_management_action_failed',
      actorType: 'admin',
      actorId: guard.userId,
      outcome: 'failure',
      details: { action: 'fee_template_update', reason: 'validation' },
    });
    return {
      success: false,
      error: validation.error,
      errorCode: 'validation',
      fieldErrors: validation.fieldErrors,
    };
  }

  try {
    const configuration = await validateTemplateConfiguration(
      validation.data.targetClass,
      validation.data.sessionYear
    );
    if (configuration.fieldErrors) {
      return {
        success: false,
        error: 'Review the highlighted fee template fields.',
        errorCode: 'validation',
        fieldErrors: configuration.fieldErrors,
      };
    }

    const template = await updateFeeTemplate({
      ...validation.data,
      targetClass: configuration.targetClass ?? validation.data.targetClass,
    });

    revalidatePath('/payments');
    logEvent({
      level: 'info',
      event: 'fee_template_updated',
      actorType: 'admin',
      actorId: guard.userId,
      entityType: 'fee_template',
      entityId: template.id,
      outcome: 'success',
    });

    return { success: true, template };
  } catch (error) {
    return failureForError(error, 'fee_template_update', guard.userId);
  }
}

export async function deleteFeeTemplateAction(
  templateId: string
): Promise<DeleteFeeTemplateActionResult> {
  const guard = await getAdminForAction('fee_template_delete');
  if (!guard.authorized) return guard.result;

  const validation = validateActionPayload({ templateId }, feeTemplateIdSchema);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error,
      errorCode: 'validation',
      fieldErrors: validation.fieldErrors,
    };
  }

  try {
    const template = await deleteFeeTemplate(validation.data.templateId);
    revalidatePath('/payments');
    logEvent({
      level: 'info',
      event: 'fee_template_deleted',
      actorType: 'admin',
      actorId: guard.userId,
      entityType: 'fee_template',
      entityId: template.id,
      outcome: 'success',
    });

    return { success: true, templateId: template.id };
  } catch (error) {
    return failureForError(error, 'fee_template_delete', guard.userId);
  }
}

export async function previewTemplateAssignmentAction(
  templateId: string,
  targetClass: string
): Promise<TemplateAssignmentPreviewActionResult> {
  const guard = await getAdminForAction('fee_template_assignment_preview');
  if (!guard.authorized) return guard.result;

  const validation = validateActionPayload(
    { templateId, targetClass },
    bulkTemplateAssignmentSchema
  );
  if (!validation.success) {
    return {
      success: false,
      error: validation.error,
      errorCode: 'validation',
      fieldErrors: validation.fieldErrors,
    };
  }

  const calendar = await loadTermCalendarFromSettings();
  if (!calendar) {
    return {
      success: false,
      error:
        'Fee assignment is paused because the current academic term dates are incomplete. Configure the official term dates in School Settings before assigning fees.',
      errorCode: 'configuration',
    };
  }

  try {
    const template = await getFeeTemplateById(validation.data.templateId);
    if (!template) {
      throw new FeeTemplateError('not_found', 'Fee template not found.');
    }

    const classes = await getConfiguredClasses();
    const targetClassResult = canonicalizeTargetClass(validation.data.targetClass, classes);
    if (targetClassResult.error) {
      return {
        success: false,
        error: targetClassResult.error,
        errorCode: 'validation',
        fieldErrors: { targetClass: targetClassResult.error },
      };
    }

    const preview = await previewTemplateAssignment(template, targetClassResult.targetClass);
    return { success: true, preview };
  } catch (error) {
    return failureForError(error, 'fee_template_assignment_preview', guard.userId);
  }
}

export async function applyFeeTemplateBulkAction(
  templateId: string,
  targetClass: string
): Promise<TemplateAssignmentActionResult> {
  const guard = await getAdminForAction('fee_template_bulk_assign');
  if (!guard.authorized) return guard.result;

  const validation = validateActionPayload(
    { templateId, targetClass },
    bulkTemplateAssignmentSchema
  );
  if (!validation.success) {
    return {
      success: false,
      error: validation.error,
      errorCode: 'validation',
      fieldErrors: validation.fieldErrors,
    };
  }

  const calendar = await loadTermCalendarFromSettings();
  if (!calendar) {
    return {
      success: false,
      error:
        'Fee assignment is paused because the current academic term dates are incomplete. Configure the official term dates in School Settings before assigning fees.',
      errorCode: 'configuration',
    };
  }

  try {
    const template = await getFeeTemplateById(validation.data.templateId);
    if (!template) {
      throw new FeeTemplateError('not_found', 'Fee template not found.');
    }

    const classes = await getConfiguredClasses();
    const targetClassResult = canonicalizeTargetClass(validation.data.targetClass, classes);
    if (targetClassResult.error) {
      return {
        success: false,
        error: targetClassResult.error,
        errorCode: 'validation',
        fieldErrors: { targetClass: targetClassResult.error },
      };
    }

    const result = await assignTemplateToClass(
      template,
      targetClassResult.targetClass,
      guard.userId
    );

    revalidatePath('/payments');
    logEvent({
      level: 'info',
      event: 'fee_template_bulk_assigned',
      actorType: 'admin',
      actorId: guard.userId,
      entityType: 'fee_template',
      entityId: template.id,
      outcome: 'success',
      details: {
        createdCount: result.createdCount,
        skippedCount: result.skippedCount,
        targetClass: result.targetClass,
      },
    });

    return { success: true, result };
  } catch (error) {
    return failureForError(error, 'fee_template_bulk_assign', guard.userId);
  }
}

export async function createIndividualChargeAction(
  studentId: string,
  payload: Omit<IndividualChargeInput, 'studentId'>
): Promise<IndividualChargeActionResult> {
  const guard = await getAdminForAction('individual_fee_charge_create');
  if (!guard.authorized) return guard.result;

  const validation = validateActionPayload(
    { ...payload, studentId },
    individualChargeSchema
  );
  if (!validation.success) {
    return {
      success: false,
      error: validation.error,
      errorCode: 'validation',
      fieldErrors: validation.fieldErrors,
    };
  }

  const calendar = await loadTermCalendarFromSettings();
  if (!calendar) {
    return {
      success: false,
      error:
        'Fee assignment is paused because the current academic term dates are incomplete. Configure the official term dates in School Settings before assigning fees.',
      errorCode: 'configuration',
    };
  }

  try {
    const sessions = await getConfiguredSessions();
    const sessionYear = getSessionYearFromTermId(validation.data.termId);
    if (sessions.length > 0 && sessionYear && !sessions.includes(sessionYear)) {
      return {
        success: false,
        error: 'Select a configured academic session.',
        errorCode: 'validation',
        fieldErrors: { termId: 'Term must belong to a configured academic session.' },
      };
    }

    const result = await createIndividualCharge(validation.data, guard.userId);
    revalidatePath('/payments');
    logEvent({
      level: 'info',
      event: 'individual_fee_charge_created',
      actorType: 'admin',
      actorId: guard.userId,
      entityType: 'fee_entry',
      entityId: result.feeEntryId,
      outcome: 'success',
      details: { termId: validation.data.termId },
    });

    return { success: true, feeEntryId: result.feeEntryId };
  } catch (error) {
    return failureForError(error, 'individual_fee_charge_create', guard.userId);
  }
}

export async function recordOfflinePaymentAction(
  studentId: string,
  amount: string,
  method: OfflinePaymentInput['method'],
  reference: string,
  note: string
): Promise<OfflinePaymentActionResult> {
  const guard = await getAdminForAction('offline_payment_record');
  if (!guard.authorized) return guard.result;

  const validation = validateActionPayload(
    { studentId, amount, method, reference, note },
    offlinePaymentSchema
  );
  if (!validation.success) {
    logEvent({
      level: 'warn',
      event: 'fee_management_action_failed',
      actorType: 'admin',
      actorId: guard.userId,
      outcome: 'failure',
      details: { action: 'offline_payment_record', reason: 'validation' },
    });
    return {
      success: false,
      error: validation.error,
      errorCode: 'validation',
      fieldErrors: validation.fieldErrors,
    };
  }

  try {
    const result = await recordOfflinePayment(validation.data, guard.userId);
    revalidatePath('/payments');
    logEvent({
      level: 'info',
      event: 'offline_payment_recorded',
      actorType: 'admin',
      actorId: guard.userId,
      entityType: 'fee_entry',
      entityId: result.feeEntryId,
      outcome: 'success',
      details: { method: validation.data.method, termId: result.termId },
    });

    return {
      success: true,
      feeEntryId: result.feeEntryId,
      termId: result.termId,
    };
  } catch (error) {
    return failureForError(error, 'offline_payment_record', guard.userId);
  }
}

export async function recordAdjustmentAction(
  studentId: string,
  amount: string,
  note: string
): Promise<AdjustmentActionResult> {
  const guard = await getAdminForAction('fee_adjustment_record');
  if (!guard.authorized) return guard.result;

  const validation = validateActionPayload(
    { studentId, amount, note },
    adjustmentSchema
  );
  if (!validation.success) {
    logEvent({
      level: 'warn',
      event: 'fee_management_action_failed',
      actorType: 'admin',
      actorId: guard.userId,
      outcome: 'failure',
      details: { action: 'fee_adjustment_record', reason: 'validation' },
    });
    return {
      success: false,
      error: validation.error,
      errorCode: 'validation',
      fieldErrors: validation.fieldErrors,
    };
  }

  try {
    const result = await recordAdjustment(validation.data, guard.userId);
    revalidatePath('/payments');
    logEvent({
      level: 'info',
      event: 'fee_adjustment_recorded',
      actorType: 'admin',
      actorId: guard.userId,
      entityType: 'fee_entry',
      entityId: result.feeEntryId,
      outcome: 'success',
      details: {
        direction: validation.data.amount.startsWith('-') ? 'credit' : 'debit',
        termId: result.termId,
      },
    });

    return {
      success: true,
      feeEntryId: result.feeEntryId,
      termId: result.termId,
    };
  } catch (error) {
    return failureForError(error, 'fee_adjustment_record', guard.userId);
  }
}
