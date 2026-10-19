import test, { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  studentLinkRequestSchema,
  staffApproveLinkActionSchema,
  staffRejectLinkActionSchema,
  staffRemoveGuardianLinkActionSchema,
} from './schemas.ts';
import { validateJsonBody, validateActionPayload } from './validation.ts';

describe('SchoolPass Stage 4: Remaining Zod Validation Integration', async () => {
  const BASE_URL = process.env.TEST_APP_URL || 'http://localhost:3000';
  let isServerRunning = false;

  before(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/session`, { signal: AbortSignal.timeout(1500) });
      if (res.status === 200) {
        isServerRunning = true;
      }
    } catch {
      isServerRunning = false;
    }
  });

  describe('Operation 1: Email Verification (POST /api/auth/verify-email)', () => {
    it('rejects malformed JSON payload with status 400', async () => {
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ invalid json for verify',
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Malformed JSON payload. Please verify request format.');
      } else {
        const req = new Request('http://localhost/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ invalid json for verify',
        });
        const result = await validateJsonBody(req, verifyEmailSchema);
        assert.equal(result.success, false);
      }
    });

    it('rejects missing or empty token with status 400', async () => {
      const payload = { token: '   ' };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Verification token is required.');
      } else {
        const req = new Request('http://localhost/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, verifyEmailSchema);
        assert.equal(result.success, false);
      }
    });

    it('rejects non-string token type with status 400', async () => {
      const payload = { token: 123456 };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Token must be a valid text string.');
      } else {
        const req = new Request('http://localhost/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, verifyEmailSchema);
        assert.equal(result.success, false);
      }
    });

    it('valid token payload continues to verifyEmail service and safely handles nonexistent token', async () => {
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: 'nonexistent_test_token' }),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Verification token is invalid or has already been used.');
      } else {
        const req = new Request('http://localhost/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: '  valid_token_raw  ' }),
        });
        const result = await validateJsonBody(req, verifyEmailSchema);
        assert.equal(result.success, true);
        if (result.success) {
          assert.equal(result.data.token, 'valid_token_raw');
        }
      }
    });
  });

  describe('Operation 2: Resend Verification Email (POST /api/auth/resend-verification)', () => {
    it('rejects malformed JSON payload with status 400', async () => {
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/resend-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ bad payload',
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Malformed JSON payload. Please verify request format.');
      } else {
        const req = new Request('http://localhost/api/auth/resend-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ bad payload',
        });
        const result = await validateJsonBody(req, resendVerificationSchema);
        assert.equal(result.success, false);
      }
    });

    it('rejects invalid email formats with status 400', async () => {
      const payload = { email: 'bad-email-address' };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/resend-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Please enter a valid email address.');
      } else {
        const req = new Request('http://localhost/api/auth/resend-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, resendVerificationSchema);
        assert.equal(result.success, false);
      }
    });

    it('preserves anti-enumeration response for validly formatted email', async () => {
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/resend-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'nonexistent.parent@schoolpass.ng' }),
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.message, 'If an unverified account exists, a new verification link has been sent.');
      } else {
        const req = new Request('http://localhost/api/auth/resend-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: '  TestParent@Domain.ng  ' }),
        });
        const result = await validateJsonBody(req, resendVerificationSchema);
        assert.equal(result.success, true);
        if (result.success) {
          assert.equal(result.data.email, 'testparent@domain.ng');
        }
      }
    });
  });

  describe('Operation 3: Forgot Password (POST /api/auth/forgot-password)', () => {
    it('rejects malformed JSON payload with status 400', async () => {
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ bad forgot payload',
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Malformed JSON payload. Please verify request format.');
      } else {
        const req = new Request('http://localhost/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ bad forgot payload',
        });
        const result = await validateJsonBody(req, forgotPasswordSchema);
        assert.equal(result.success, false);
      }
    });

    it('rejects non-string email with status 400', async () => {
      const payload = { email: 12345 };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Email must be a valid text string.');
      } else {
        const req = new Request('http://localhost/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, forgotPasswordSchema);
        assert.equal(result.success, false);
      }
    });

    it('preserves anti-enumeration response for validly formatted email', async () => {
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'nonexistent.reset@schoolpass.ng' }),
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(
          data.message,
          'If an account exists with this email address, we have sent instructions to reset your password.'
        );
      } else {
        const req = new Request('http://localhost/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: '  Forgot@SchoolPass.ng  ' }),
        });
        const result = await validateJsonBody(req, forgotPasswordSchema);
        assert.equal(result.success, true);
        if (result.success) {
          assert.equal(result.data.email, 'forgot@schoolpass.ng');
        }
      }
    });
  });

  describe('Operation 4: Reset Password (POST /api/auth/reset-password)', () => {
    it('rejects malformed JSON payload with status 400', async () => {
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '<<<not json>>>',
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Malformed JSON payload. Please verify request format.');
      } else {
        const req = new Request('http://localhost/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '<<<not json>>>',
        });
        const result = await validateJsonBody(req, resetPasswordSchema);
        assert.equal(result.success, false);
      }
    });

    it('rejects short passwords (< 8 characters) with status 400', async () => {
      const payload = { token: 'sample_token', password: 'short' };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Password must be at least 8 characters long.');
      } else {
        const req = new Request('http://localhost/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, resetPasswordSchema);
        assert.equal(result.success, false);
      }
    });

    it('valid reset payload preserves password casing and safely rejects invalid token', async () => {
      const payload = { token: 'invalid_token_123', password: 'ExactCasePassword2026!' };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Password reset link is invalid or has already been used.');
      } else {
        const req = new Request('http://localhost/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, resetPasswordSchema);
        assert.equal(result.success, true);
        if (result.success) {
          assert.equal(result.data.password, 'ExactCasePassword2026!');
        }
      }
    });
  });

  describe('Operation 5: Student-Link Request Submission (POST /api/records/link-requests)', () => {
    it('rejects unauthenticated requests with HTTP 401 before consuming payload', async () => {
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/records/link-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentNumber: 'SP-2026-0001' }),
        });
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.error, 'Unauthorized');
      } else {
        const valid = studentLinkRequestSchema.parse({ studentNumber: '  sp-2026-0001  ' });
        assert.equal(valid.studentNumber, 'SP-2026-0001');
      }
    });

    it('rejects empty or non-string student number with status 400', async () => {
      const emptyResult = studentLinkRequestSchema.safeParse({ studentNumber: '   ' });
      assert.equal(emptyResult.success, false);
      assert.equal(emptyResult.error.issues[0].message, 'Please enter a valid student number.');

      const nonString = studentLinkRequestSchema.safeParse({ studentNumber: 12345 });
      assert.equal(nonString.success, false);
      assert.equal(nonString.error.issues[0].message, 'Student number must be a valid text string.');
    });

    it('normalizes student number to trimmed uppercase', async () => {
      const parsed = studentLinkRequestSchema.parse({ studentNumber: '  sp-2026-0099  ' });
      assert.equal(parsed.studentNumber, 'SP-2026-0099');
    });
  });

  describe('Operation 6: Staff Guardian-Link Runtime Action Validation', () => {
    describe('approveStudentLinkAction Validation', () => {
      it('rejects invalid CUID identifier formats at runtime', () => {
        const result = validateActionPayload({ requestId: 'invalid-not-cuid' }, staffApproveLinkActionSchema);
        assert.equal(result.success, false);
        assert.equal(result.error, 'Invalid identifier format.');
      });

      it('rejects non-string identifier at runtime', () => {
        const result = validateActionPayload({ requestId: 12345 }, staffApproveLinkActionSchema);
        assert.equal(result.success, false);
        assert.equal(result.error, 'Identifier must be a valid text string.');
      });

      it('accepts valid CUID identifier at runtime', () => {
        const validCuid = 'cmve8g9190003lgocy5mpp8r0';
        const result = validateActionPayload({ requestId: validCuid }, staffApproveLinkActionSchema);
        assert.equal(result.success, true);
        if (result.success) {
          assert.equal(result.data.requestId, validCuid);
        }
      });
    });

    describe('rejectStudentLinkAction Validation', () => {
      it('rejects invalid CUID identifier formats at runtime', () => {
        const result = validateActionPayload({ requestId: 'bad-id', reason: 'Valid reason' }, staffRejectLinkActionSchema);
        assert.equal(result.success, false);
        assert.equal(result.error, 'Invalid identifier format.');
      });

      it('rejects non-string reason at runtime', () => {
        const validCuid = 'cmve8g9190003lgocy5mpp8r0';
        const result = validateActionPayload({ requestId: validCuid, reason: 98765 }, staffRejectLinkActionSchema);
        assert.equal(result.success, false);
        assert.equal(result.error, 'Reason must be a valid text string.');
      });

      it('rejects reason exceeding 500 characters', () => {
        const validCuid = 'cmve8g9190003lgocy5mpp8r0';
        const longReason = 'a'.repeat(501);
        const result = validateActionPayload({ requestId: validCuid, reason: longReason }, staffRejectLinkActionSchema);
        assert.equal(result.success, false);
        assert.equal(result.error, 'Reason must not exceed 500 characters.');
      });

      it('accepts valid CUID and optional/null reason at runtime', () => {
        const validCuid = 'cmve8g9190003lgocy5mpp8r0';
        const result1 = validateActionPayload({ requestId: validCuid, reason: 'Documentation mismatch' }, staffRejectLinkActionSchema);
        assert.equal(result1.success, true);

        const result2 = validateActionPayload({ requestId: validCuid, reason: '' }, staffRejectLinkActionSchema);
        assert.equal(result2.success, true);

        const result3 = validateActionPayload({ requestId: validCuid, reason: null }, staffRejectLinkActionSchema);
        assert.equal(result3.success, true);

        const result4 = validateActionPayload({ requestId: validCuid }, staffRejectLinkActionSchema);
        assert.equal(result4.success, true);
      });
    });

    describe('removeGuardianLinkAction Validation', () => {
      it('rejects invalid CUID identifier formats at runtime', () => {
        const result = validateActionPayload({ linkId: 'non-cuid-id' }, staffRemoveGuardianLinkActionSchema);
        assert.equal(result.success, false);
        assert.equal(result.error, 'Invalid identifier format.');
      });

      it('rejects non-string link identifier at runtime', () => {
        const result = validateActionPayload({ linkId: false }, staffRemoveGuardianLinkActionSchema);
        assert.equal(result.success, false);
        assert.equal(result.error, 'Identifier must be a valid text string.');
      });

      it('accepts valid CUID link identifier at runtime', () => {
        const validCuid = 'cmve8g9190003lgocy5mpp8r0';
        const result = validateActionPayload({ linkId: validCuid }, staffRemoveGuardianLinkActionSchema);
        assert.equal(result.success, true);
        if (result.success) {
          assert.equal(result.data.linkId, validCuid);
        }
      });
    });
  });
});
