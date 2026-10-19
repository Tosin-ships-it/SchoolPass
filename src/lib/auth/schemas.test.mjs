import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  emailSchema,
  passwordSchema,
  loginPasswordSchema,
  nameSchema,
  studentNumberSchema,
  tokenSchema,
  cuidSchema,
  parentRegisterSchema,
  retryRegistrationLinkSchema,
  parentLoginSchema,
  staffLoginSchema,
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

describe('SchoolPass Stage 2: Zod Validation Foundation Primitives', () => {
  it('normalizes valid emails by trimming and converting to lowercase', () => {
    const parsed = emailSchema.parse('  GboyegaOlan@Gmail.com  ');
    assert.equal(parsed, 'gboyegaolan@gmail.com');
  });

  it('rejects non-string email types with clear error message', () => {
    const numericResult = emailSchema.safeParse(12345);
    assert.equal(numericResult.success, false);
    assert.equal(numericResult.error.issues[0].message, 'Email must be a valid text string.');

    const boolResult = emailSchema.safeParse(true);
    assert.equal(boolResult.success, false);
    assert.equal(boolResult.error.issues[0].message, 'Email must be a valid text string.');

    const objResult = emailSchema.safeParse({ email: 'test@example.com' });
    assert.equal(objResult.success, false);
    assert.equal(objResult.error.issues[0].message, 'Email must be a valid text string.');
  });

  it('rejects missing, empty, or whitespace-only emails', () => {
    const undefinedResult = emailSchema.safeParse(undefined);
    assert.equal(undefinedResult.success, false);
    assert.equal(undefinedResult.error.issues[0].message, 'Email is required.');

    const emptyResult = emailSchema.safeParse('');
    assert.equal(emptyResult.success, false);
    assert.equal(emptyResult.error.issues[0].message, 'Email is required.');

    const whitespaceResult = emailSchema.safeParse('    ');
    assert.equal(whitespaceResult.success, false);
    assert.equal(whitespaceResult.error.issues[0].message, 'Email is required.');
  });

  it('rejects malformed email formats', () => {
    const invalidFormats = [
      'plainaddress',
      '@missingusername.com',
      'username@.com',
      'username@domain',
      'username@domain..com',
    ];

    for (const bad of invalidFormats) {
      const res = emailSchema.safeParse(bad);
      assert.equal(res.success, false, `Expected ${bad} to fail email validation`);
      assert.equal(res.error.issues[0].message, 'Please enter a valid email address.');
    }
  });

  it('enforces password minimum length of 8 characters and preserves casing', () => {
    const validPw = 'SecurePass2026!';
    assert.equal(passwordSchema.parse(validPw), validPw, 'Password casing and characters must be preserved');

    const shortPw = passwordSchema.safeParse('Short1!');
    assert.equal(shortPw.success, false);
    assert.equal(shortPw.error.issues[0].message, 'Password must be at least 8 characters long.');
  });

  it('rejects non-string passwords with clear error message', () => {
    const res = passwordSchema.safeParse(12345678);
    assert.equal(res.success, false);
    assert.equal(res.error.issues[0].message, 'Password must be a valid text string.');
  });

  it('enforces password maximum length bound of 128 characters', () => {
    const oversized = 'a'.repeat(129);
    const res = passwordSchema.safeParse(oversized);
    assert.equal(res.success, false);
    assert.equal(res.error.issues[0].message, 'Password must not exceed 128 characters.');
  });

  it('loginPasswordSchema requires non-empty password', () => {
    const valid = loginPasswordSchema.safeParse('any_password');
    assert.equal(valid.success, true);

    const empty = loginPasswordSchema.safeParse('');
    assert.equal(empty.success, false);
    assert.equal(empty.error.issues[0].message, 'Password is required.');
  });

  it('normalizes student number by trimming and converting to uppercase', () => {
    const parsed = studentNumberSchema.parse('  sp-2026-0001  ');
    assert.equal(parsed, 'SP-2026-0001');
  });

  it('rejects empty or non-string student numbers', () => {
    const empty = studentNumberSchema.safeParse('   ');
    assert.equal(empty.success, false);
    assert.equal(empty.error.issues[0].message, "Enter your child's student number.");

    const nonString = studentNumberSchema.safeParse(20260001);
    assert.equal(nonString.success, false);
    assert.equal(nonString.error.issues[0].message, 'Student number must be a valid text string.');
  });

  it('validates CUID database identifiers', () => {
    // Valid CUID formats
    const validCuid = 'cmve8g9190003lgocy5mpp8r0';
    assert.equal(cuidSchema.parse(validCuid), validCuid);

    const invalid = cuidSchema.safeParse('12345-not-a-cuid');
    assert.equal(invalid.success, false);
    assert.equal(invalid.error.issues[0].message, 'Invalid identifier format.');
  });
});

describe('SchoolPass Stage 2: Operation Schemas', () => {
  it('parentRegisterSchema validates and normalizes all registration fields', () => {
    const raw = {
      name: '  Chinedu Okafor  ',
      email: '  Chinedu@Example.com  ',
      password: 'StrongPassword2026!',
      studentNumber: '  sp-2026-0001  ',
    };

    const parsed = parentRegisterSchema.parse(raw);
    assert.equal(parsed.name, 'Chinedu Okafor');
    assert.equal(parsed.email, 'chinedu@example.com');
    assert.equal(parsed.password, 'StrongPassword2026!');
    assert.equal(parsed.studentNumber, 'SP-2026-0001');
  });

  it('parentRegisterSchema rejects missing or invalid fields', () => {
    const missingName = parentRegisterSchema.safeParse({
      email: 'chinedu@example.com',
      password: 'StrongPassword2026!',
      studentNumber: 'SP-2026-0001',
    });
    assert.equal(missingName.success, false);

    const shortPassword = parentRegisterSchema.safeParse({
      name: 'Chinedu Okafor',
      email: 'chinedu@example.com',
      password: 'short',
      studentNumber: 'SP-2026-0001',
    });
    assert.equal(shortPassword.success, false);
    assert.equal(shortPassword.error.issues[0].message, 'Password must be at least 8 characters long.');
  });

  it('retryRegistrationLinkSchema validates retry action parameters', () => {
    const valid = retryRegistrationLinkSchema.parse({
      action: 'retry-link',
      email: 'Parent@Domain.ng',
      token: '  token_abc_123  ',
      studentNumber: 'sp-2026-0002',
    });

    assert.equal(valid.email, 'parent@domain.ng');
    assert.equal(valid.token, 'token_abc_123');
    assert.equal(valid.studentNumber, 'SP-2026-0002');
  });

  it('login schemas validate email normalization and password presence', () => {
    const parent = parentLoginSchema.parse({
      email: '  User@Domain.ng  ',
      password: 'MyPassword!',
    });
    assert.equal(parent.email, 'user@domain.ng');
    assert.equal(parent.password, 'MyPassword!');

    const staff = staffLoginSchema.parse({
      email: 'Staff@School.ng',
      password: 'StaffPassword!',
    });
    assert.equal(staff.email, 'staff@school.ng');
  });

  it('verifyEmailSchema requires valid token', () => {
    const valid = verifyEmailSchema.parse({ token: '  sample_raw_token  ' });
    assert.equal(valid.token, 'sample_raw_token');

    const empty = verifyEmailSchema.safeParse({ token: '' });
    assert.equal(empty.success, false);
    assert.equal(empty.error.issues[0].message, 'Verification token is required.');
  });

  it('resendVerificationSchema and forgotPasswordSchema normalize email', () => {
    const resend = resendVerificationSchema.parse({ email: 'GboyegaOlan@Gmail.com' });
    assert.equal(resend.email, 'gboyegaolan@gmail.com');

    const forgot = forgotPasswordSchema.parse({ email: '  Parent@Test.ng  ' });
    assert.equal(forgot.email, 'parent@test.ng');
  });

  it('resetPasswordSchema enforces minimum 8 characters and token presence', () => {
    const valid = resetPasswordSchema.parse({
      token: 'valid_token_string',
      password: 'NewStrongPassword123!',
    });
    assert.equal(valid.token, 'valid_token_string');
    assert.equal(valid.password, 'NewStrongPassword123!');

    const invalid = resetPasswordSchema.safeParse({
      token: 'valid_token',
      password: 'short',
    });
    assert.equal(invalid.success, false);
    assert.equal(invalid.error.issues[0].message, 'Password must be at least 8 characters long.');
  });

  it('studentLinkRequestSchema validates and normalizes studentNumber', () => {
    const valid = studentLinkRequestSchema.parse({ studentNumber: '  sp-2026-0001  ' });
    assert.equal(valid.studentNumber, 'SP-2026-0001');

    const empty = studentLinkRequestSchema.safeParse({ studentNumber: '' });
    assert.equal(empty.success, false);
    assert.equal(empty.error.issues[0].message, 'Please enter a valid student number.');
  });

  it('staff guardian-link schemas enforce CUID format', () => {
    const cuid = 'cmve8g9190003lgocy5mpp8r0';

    const approve = staffApproveLinkActionSchema.parse({ requestId: cuid });
    assert.equal(approve.requestId, cuid);

    const reject = staffRejectLinkActionSchema.parse({ requestId: cuid, reason: '  Name mismatch.  ' });
    assert.equal(reject.requestId, cuid);
    assert.equal(reject.reason, 'Name mismatch.');

    const remove = staffRemoveGuardianLinkActionSchema.parse({ linkId: cuid });
    assert.equal(remove.linkId, cuid);
  });
});

describe('SchoolPass Stage 2: Safe Request & Payload Validation Helper', () => {
  it('validateJsonBody successfully parses valid request body', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Parent@Example.com', password: 'Password123!' }),
    });

    const result = await validateJsonBody(req, parentLoginSchema);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.email, 'parent@example.com');
      assert.equal(result.data.password, 'Password123!');
    }
  });

  it('validateJsonBody cleanly handles malformed JSON without throwing exceptions', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ this is invalid json',
    });

    const result = await validateJsonBody(req, parentLoginSchema);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.response.status, 400);
      const json = await result.response.json();
      assert.equal(json.error, 'Malformed JSON payload. Please verify request format.');
    }
  });

  it('validateJsonBody returns HTTP 400 with field error message on type mismatch', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 12345, password: 'Password123!' }),
    });

    const result = await validateJsonBody(req, parentLoginSchema);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.response.status, 400);
      const json = await result.response.json();
      assert.equal(json.error, 'Email must be a valid text string.');
    }
  });

  it('validateActionPayload validates in-memory payloads cleanly', () => {
    const valid = validateActionPayload(
      { requestId: 'cmve8g9190003lgocy5mpp8r0' },
      staffApproveLinkActionSchema
    );
    assert.equal(valid.success, true);

    const invalid = validateActionPayload(
      { requestId: 'not_a_cuid' },
      staffApproveLinkActionSchema
    );
    assert.equal(invalid.success, false);
    if (!invalid.success) {
      assert.equal(invalid.error, 'Invalid identifier format.');
    }
  });
});
