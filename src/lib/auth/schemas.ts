import { z } from 'zod';

/**
 * Reusable primitive validation schemas
 */

export const emailSchema = z
  .string({
    required_error: 'Email is required.',
    invalid_type_error: 'Email must be a valid text string.',
  })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required.')
  .email('Please enter a valid email address.')
  .max(255, 'Email must not exceed 255 characters.');

export const passwordSchema = z
  .string({
    required_error: 'Password is required.',
    invalid_type_error: 'Password must be a valid text string.',
  })
  .trim()
  .min(8, 'Password must be at least 8 characters long.')
  .max(128, 'Password must not exceed 128 characters.');

export const loginPasswordSchema = z
  .string({
    required_error: 'Password is required.',
    invalid_type_error: 'Password must be a valid text string.',
  })
  .min(1, 'Password is required.')
  .max(128, 'Password must not exceed 128 characters.')
  .refine((val) => val.trim().length > 0, {
    message: 'Password is required.',
  });

export const nameSchema = z
  .string({
    required_error: 'Please enter your full name.',
    invalid_type_error: 'Name must be a valid text string.',
  })
  .trim()
  .min(2, 'Please enter your full name.')
  .max(100, 'Name must not exceed 100 characters.');

export const studentNumberSchema = z
  .string({
    required_error: "Enter your child's student number.",
    invalid_type_error: 'Student number must be a valid text string.',
  })
  .trim()
  .toUpperCase()
  .min(1, "Enter your child's student number.")
  .max(32, 'Student number must not exceed 32 characters.');

export const tokenSchema = z
  .string({
    required_error: 'Verification token is required.',
    invalid_type_error: 'Token must be a valid text string.',
  })
  .trim()
  .min(1, 'Verification token is required.');

export const cuidSchema = z
  .string({
    required_error: 'Identifier is required.',
    invalid_type_error: 'Identifier must be a valid text string.',
  })
  .cuid('Invalid identifier format.');

/**
 * Operation-specific schemas for authentication and guardian-linking
 */

export const parentRegisterSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  studentNumber: studentNumberSchema,
});
export type ParentRegisterInput = z.infer<typeof parentRegisterSchema>;

export const retryRegistrationLinkSchema = z.object({
  action: z.literal('retry-link').optional(),
  email: emailSchema,
  token: tokenSchema,
  studentNumber: studentNumberSchema,
});
export type RetryRegistrationLinkInput = z.infer<typeof retryRegistrationLinkSchema>;

export const parentLoginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});
export type ParentLoginInput = z.infer<typeof parentLoginSchema>;

export const staffLoginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});
export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

export const verifyEmailSchema = z.object({
  token: tokenSchema,
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: emailSchema,
});
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z
    .string({
      required_error: 'Token and new password are required.',
      invalid_type_error: 'Token must be a valid text string.',
    })
    .trim()
    .min(1, 'Token and new password are required.'),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const studentLinkRequestSchema = z.object({
  studentNumber: z
    .string({
      required_error: 'Please enter a valid student number.',
      invalid_type_error: 'Student number must be a valid text string.',
    })
    .trim()
    .toUpperCase()
    .min(1, 'Please enter a valid student number.')
    .max(32, 'Student number must not exceed 32 characters.'),
});
export type StudentLinkRequestInput = z.infer<typeof studentLinkRequestSchema>;

export const staffApproveLinkActionSchema = z.object({
  requestId: cuidSchema,
});
export type StaffApproveLinkActionInput = z.infer<typeof staffApproveLinkActionSchema>;

export const staffRejectLinkActionSchema = z.object({
  requestId: cuidSchema,
  reason: z
    .string({ invalid_type_error: 'Reason must be a valid text string.' })
    .trim()
    .max(500, 'Reason must not exceed 500 characters.')
    .optional()
    .nullable(),
});
export type StaffRejectLinkActionInput = z.infer<typeof staffRejectLinkActionSchema>;

export const staffRemoveGuardianLinkActionSchema = z.object({
  linkId: cuidSchema,
});
export type StaffRemoveGuardianLinkActionInput = z.infer<typeof staffRemoveGuardianLinkActionSchema>;
