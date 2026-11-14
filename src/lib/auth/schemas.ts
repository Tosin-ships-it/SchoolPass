import { z } from 'zod';
import { validatePersonFullName } from './validation';

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
    message: 'Please enter your full name.',
    required_error: 'Please enter your full name.',
    invalid_type_error: 'Name must be a valid text string.',
  })
  .trim()
  .min(1, 'Please enter your full name.')
  .max(100, 'Name must not exceed 100 characters.')
  .refine(
    (val) => {
      const parts = val.split(/\s+/).filter(Boolean);
      return parts.length >= 2;
    },
    {
      message: 'Please enter your first and last name.',
    }
  )
  .refine(
    (val) => {
      const parts = val.split(/\s+/).filter(Boolean);
      return parts.every((p) => p.length >= 2);
    },
    {
      message: 'Each name must be at least 2 characters long.',
    }
  );

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

export const parentRegisterSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    studentNumber: studentNumberSchema,
    acceptedTerms: z
      .boolean({
        invalid_type_error: 'Terms acceptance must be a boolean.',
      })
      .optional(),
    terms: z
      .boolean({
        invalid_type_error: 'Terms acceptance must be a boolean.',
      })
      .optional(),
    confirmPassword: z
      .string({
        invalid_type_error: 'Password confirmation must be a string.',
      })
      .optional(),
  })
  .refine(
    (data) => data.acceptedTerms === true || data.terms === true,
    {
      message: 'You must accept the Terms of Service and Privacy Policy.',
      path: ['acceptedTerms'],
    }
  )
  .refine(
    (data) => {
      if (data.confirmPassword !== undefined && data.confirmPassword !== null) {
        return data.confirmPassword === data.password;
      }
      return true;
    },
    {
      message: 'Passwords do not match.',
      path: ['confirmPassword'],
    }
  );
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

/**
 * Front-desk intending student intake and search schemas (Stage 2)
 */

export const intendingStudentIntakeSchema = z.object({
  submissionId: z
    .string({ invalid_type_error: 'Submission identifier must be a valid text string.' })
    .trim()
    .max(100, 'Submission identifier must not exceed 100 characters.')
    .optional(),
  name: z
    .string({
      required_error: 'Student full name is required.',
      invalid_type_error: 'Student name must be a valid text string.',
    })
    .trim()
    .superRefine((value, ctx) => {
      const err = validatePersonFullName(value, 'Student full name');
      if (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err,
        });
      }
    }),
  intendedClass: z
    .string({
      required_error: 'Intended class is required.',
      invalid_type_error: 'Intended class must be a valid text string.',
    })
    .trim()
    .min(1, 'Intended class is required.')
    .max(50, 'Intended class must not exceed 50 characters.')
    .refine((value) => /[\p{L}\p{N}]/u.test(value), {
      message: 'Intended class must include letters or numbers.',
    }),
  sessionYear: z
    .string({
      required_error: 'Session year is required.',
      invalid_type_error: 'Session year must be a valid text string.',
    })
    .trim()
    .min(4, 'Session year is required (e.g. 2026/2027).')
    .max(20, 'Session year must not exceed 20 characters.')
    .refine(
      (value) => {
        const match = value.match(/^(\d{4})\/(\d{4})$/);
        if (!match) return false;

        const start = Number(match[1]);
        const end = Number(match[2]);
        return start >= 2000 && start <= 2100 && end === start + 1;
      },
      {
        message:
          'Session year must be a consecutive academic year in the format YYYY/YYYY (e.g. 2026/2027).',
      }
    ),
  guardianName: z
    .string({ invalid_type_error: 'Guardian name must be a valid text string.' })
    .trim()
    .superRefine((value, ctx) => {
      if (value && value.length > 0) {
        const err = validatePersonFullName(value, 'Guardian name');
        if (err) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: err,
          });
        }
      }
    })
    .optional()
    .nullable(),
  guardianPhone: z
    .string({ invalid_type_error: 'Guardian phone must be a valid text string.' })
    .trim()
    .max(30, 'Guardian phone must not exceed 30 characters.')
    .refine(
      (value) => {
        if (value.length === 0) return true;
        if (!/^\+?[\d\s()-]+$/.test(value)) return false;

        const digits = value.replace(/\D/g, '');
        return digits.length >= 7 && digits.length <= 15;
      },
      {
        message: 'Please enter a valid guardian phone number.',
      }
    )
    .optional()
    .nullable(),
  guardianEmail: z
    .string({ invalid_type_error: 'Guardian email must be a valid text string.' })
    .trim()
    .email('Please enter a valid guardian email address.')
    .max(255, 'Guardian email must not exceed 255 characters.')
    .optional()
    .nullable()
    .or(z.literal('')),
  notes: z
    .string({ invalid_type_error: 'Notes must be a valid text string.' })
    .trim()
    .max(500, 'Notes must not exceed 500 characters.')
    .optional()
    .nullable(),
});
export type IntendingStudentIntakeInput = z.infer<typeof intendingStudentIntakeSchema>;

export const intendingStudentSearchSchema = z.object({
  query: z
    .string({ invalid_type_error: 'Search query must be a valid text string.' })
    .trim()
    .max(100, 'Search query must not exceed 100 characters.')
    .optional()
    .nullable(),
});
export type IntendingStudentSearchInput = z.infer<typeof intendingStudentSearchSchema>;

export const staffToggleFrontDeskSchema = z.object({
  staffId: cuidSchema,
  isFrontDesk: z.boolean({
    required_error: 'Front-desk permission status is required.',
    invalid_type_error: 'Front-desk permission status must be a boolean.',
  }),
});
export type StaffToggleFrontDeskInput = z.infer<typeof staffToggleFrontDeskSchema>;
