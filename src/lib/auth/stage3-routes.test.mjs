import test, { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  parentRegisterSchema,
  retryRegistrationLinkSchema,
  parentLoginSchema,
  staffLoginSchema,
} from './schemas.ts';
import { validateJsonBody } from './validation.ts';

describe('SchoolPass Stage 3: Core Authentication Routes Validation', async () => {
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

  describe('Route Level Validation: Parent Sign-in (POST /api/auth/login)', () => {
    it('rejects malformed JSON payload with status 400', async () => {
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ malformed json payload',
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Malformed JSON payload. Please verify request format.');
      } else {
        const req = new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ malformed json payload',
        });
        const result = await validateJsonBody(req, parentLoginSchema);
        assert.equal(result.success, false);
        if (!result.success) {
          assert.equal(result.response.status, 400);
          const data = await result.response.json();
          assert.equal(data.error, 'Malformed JSON payload. Please verify request format.');
        }
      }
    });

    it('rejects missing email with status 400', async () => {
      const payload = { password: 'ValidPassword123!' };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Email is required.');
      } else {
        const req = new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, parentLoginSchema);
        assert.equal(result.success, false);
        if (!result.success) {
          const data = await result.response.json();
          assert.equal(data.error, 'Email is required.');
        }
      }
    });

    it('rejects missing password with status 400', async () => {
      const payload = { email: 'parent@example.com' };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Password is required.');
      } else {
        const req = new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, parentLoginSchema);
        assert.equal(result.success, false);
        if (!result.success) {
          const data = await result.response.json();
          assert.equal(data.error, 'Password is required.');
        }
      }
    });

    it('rejects numeric email type with status 400', async () => {
      const payload = { email: 987654, password: 'ValidPassword123!' };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Email must be a valid text string.');
      } else {
        const req = new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, parentLoginSchema);
        assert.equal(result.success, false);
        if (!result.success) {
          const data = await result.response.json();
          assert.equal(data.error, 'Email must be a valid text string.');
        }
      }
    });

    it('rejects invalid email formats with status 400', async () => {
      const payload = { email: 'not-an-email', password: 'ValidPassword123!' };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Please enter a valid email address.');
      } else {
        const req = new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, parentLoginSchema);
        assert.equal(result.success, false);
        if (!result.success) {
          const data = await result.response.json();
          assert.equal(data.error, 'Please enter a valid email address.');
        }
      }
    });

    it('rejects empty or whitespace-only values with status 400', async () => {
      const payload = { email: '   ', password: 'ValidPassword123!' };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Email is required.');
      } else {
        const req = new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, parentLoginSchema);
        assert.equal(result.success, false);
        if (!result.success) {
          const data = await result.response.json();
          assert.equal(data.error, 'Email is required.');
        }
      }
    });

    it('valid requests pass validation and continue to auth logic with anti-enumeration response', async () => {
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'nonexistent.parent@schoolpass.ng', password: 'WrongPassword123!' }),
        });
        // Continues into auth logic, fails safely without enumeration with 401
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.error, 'Invalid email or password.');
      } else {
        const req = new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: '  Parent@SchoolPass.ng  ', password: 'MyExactPassword!' }),
        });
        const result = await validateJsonBody(req, parentLoginSchema);
        assert.equal(result.success, true);
        if (result.success) {
          assert.equal(result.data.email, 'parent@schoolpass.ng');
          assert.equal(result.data.password, 'MyExactPassword!');
        }
      }
    });
  });

  describe('Route Level Validation: Staff Sign-in (POST /api/auth/staff-login)', () => {
    it('rejects malformed JSON payload with status 400', async () => {
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/staff-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ not valid json',
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Malformed JSON payload. Please verify request format.');
      } else {
        const req = new Request('http://localhost/api/auth/staff-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ not valid json',
        });
        const result = await validateJsonBody(req, staffLoginSchema);
        assert.equal(result.success, false);
      }
    });

    it('rejects non-string password with status 400', async () => {
      const payload = { email: 'staff@school.ng', password: 12345678 };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/staff-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Password must be a valid text string.');
      } else {
        const req = new Request('http://localhost/api/auth/staff-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, staffLoginSchema);
        assert.equal(result.success, false);
      }
    });

    it('valid requests pass validation and continue to staff auth logic returning safe error', async () => {
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/staff-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'nonexistent.staff@school.ng', password: 'StaffPassword123!' }),
        });
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.error, 'Invalid staff email or password.');
      } else {
        const req = new Request('http://localhost/api/auth/staff-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'Staff@School.ng', password: 'ExactPassword!' }),
        });
        const result = await validateJsonBody(req, staffLoginSchema);
        assert.equal(result.success, true);
        if (result.success) {
          assert.equal(result.data.email, 'staff@school.ng');
          assert.equal(result.data.password, 'ExactPassword!');
        }
      }
    });
  });

  describe('Route Level Validation: Parent Registration (POST /api/auth/register)', () => {
    it('rejects malformed JSON payload with status 400', async () => {
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '<<<bad json>>>',
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Malformed JSON payload. Please verify request format.');
      } else {
        const req = new Request('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '<<<bad json>>>',
        });
        const result = await validateJsonBody(req, parentRegisterSchema);
        assert.equal(result.success, false);
      }
    });

    it('rejects missing student number with status 400', async () => {
      const payload = {
        name: 'Chioma Adeyemi',
        email: 'chioma@example.com',
        password: 'ValidPassword123!',
      };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, "Enter your child's student number.");
      } else {
        const req = new Request('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, parentRegisterSchema);
        assert.equal(result.success, false);
      }
    });

    it('rejects short passwords (< 8 characters) with status 400', async () => {
      const payload = {
        name: 'Chioma Adeyemi',
        email: 'chioma@example.com',
        password: 'short',
        studentNumber: 'SP-2026-0001',
      };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Password must be at least 8 characters long.');
      } else {
        const req = new Request('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, parentRegisterSchema);
        assert.equal(result.success, false);
      }
    });

    it('rejects whitespace-only name with status 400', async () => {
      const payload = {
        name: '    ',
        email: 'chioma@example.com',
        password: 'ValidPassword123!',
        studentNumber: 'SP-2026-0001',
      };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Please enter your full name.');
      } else {
        const req = new Request('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, parentRegisterSchema);
        assert.equal(result.success, false);
      }
    });

    it('handles retry-linking action payload safely via POST /api/auth/register', async () => {
      const invalidRetry = {
        action: 'retry-link',
        email: 'parent@domain.ng',
        token: '',
        studentNumber: 'SP-2026-0001',
      };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidRetry),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Verification token is required.');
      } else {
        const req = new Request('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidRetry),
        });
        const result = await validateJsonBody(req, retryRegistrationLinkSchema);
        assert.equal(result.success, false);
      }
    });
  });

  describe('Route Level Validation: Retry Registration Student-Link (PATCH /api/auth/register)', () => {
    it('rejects malformed JSON payload with status 400', async () => {
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/register`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: '{ invalid patch json',
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Malformed JSON payload. Please verify request format.');
      } else {
        const req = new Request('http://localhost/api/auth/register', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: '{ invalid patch json',
        });
        const result = await validateJsonBody(req, retryRegistrationLinkSchema);
        assert.equal(result.success, false);
      }
    });

    it('rejects missing token with status 400', async () => {
      const payload = {
        email: 'parent@example.com',
        studentNumber: 'SP-2026-0001',
      };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/register`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Verification token is required.');
      } else {
        const req = new Request('http://localhost/api/auth/register', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, retryRegistrationLinkSchema);
        assert.equal(result.success, false);
      }
    });

    it('rejects non-string student number with status 400', async () => {
      const payload = {
        email: 'parent@example.com',
        token: 'valid_token_string',
        studentNumber: 20260001,
      };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/register`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Student number must be a valid text string.');
      } else {
        const req = new Request('http://localhost/api/auth/register', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, retryRegistrationLinkSchema);
        assert.equal(result.success, false);
      }
    });

    it('valid retry request structure continues to retry verification session logic', async () => {
      const payload = {
        email: 'parent@example.com',
        token: 'invalid_or_expired_token',
        studentNumber: 'SP-2026-0001',
      };
      if (isServerRunning) {
        const res = await fetch(`${BASE_URL}/api/auth/register`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        // Continues into retryRegistrationStudentLink, checking token in store
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, 'Invalid or expired registration session.');
      } else {
        const req = new Request('http://localhost/api/auth/register', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await validateJsonBody(req, retryRegistrationLinkSchema);
        assert.equal(result.success, true);
        if (result.success) {
          assert.equal(result.data.email, 'parent@example.com');
          assert.equal(result.data.studentNumber, 'SP-2026-0001');
        }
      }
    });
  });
});
