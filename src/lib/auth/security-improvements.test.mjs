import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  passwordSchema,
  loginPasswordSchema,
  parentRegisterSchema,
  parentLoginSchema,
  staffLoginSchema,
  resetPasswordSchema,
} from './schemas.ts';
import {
  validatePasswordSync,
  validatePasswordStrength,
  validatePasswordStrengthAsync,
  isPwnedPassword,
  isCommonPassword,
} from './passwordValidation.ts';
import {
  checkIpRateLimit,
  recordIpFailedAttempt,
  resetIpRateLimit,
  extractClientIp,
  isValidIp,
  createRateLimitResponse,
  _clearRateLimitsForTesting,
} from './rateLimit.ts';
import { hashPassword, verifyPassword } from './crypto.ts';

describe('SchoolPass Security Improvements Test Suite', () => {
  beforeEach(() => {
    _clearRateLimitsForTesting();
  });

  describe('1. Password Trimming Consistency & Casing Preservation', () => {
    it('trims leading and trailing whitespace from passwordSchema for registration and reset', () => {
      const parsed = passwordSchema.parse('   P@ssw0rdSecure!   ');
      assert.equal(parsed, 'P@ssw0rdSecure!');
    });

    it('loginPasswordSchema preserves raw typed password for Two-Stage Migration', () => {
      const parsed = loginPasswordSchema.parse('   P@ssw0rdSecure!   ');
      assert.equal(parsed, '   P@ssw0rdSecure!   ');
    });

    it('preserves password character casing and special characters', () => {
      const complexPass = '   My#Str0ng_P@ssWord$2026!   ';
      const parsed = passwordSchema.parse(complexPass);
      assert.equal(parsed, 'My#Str0ng_P@ssWord$2026!');
      assert.notEqual(parsed, parsed.toLowerCase());
    });

    it('rejects passwords that are less than 8 characters after trimming', () => {
      const result = passwordSchema.safeParse('   abc   ');
      assert.equal(result.success, false);
      assert.equal(result.error.issues[0].message, 'Password must be at least 8 characters long.');
    });

    it('rejects whitespace-only passwords in loginPasswordSchema', () => {
      const result = loginPasswordSchema.safeParse('     ');
      assert.equal(result.success, false);
      assert.equal(result.error.issues[0].message, 'Password is required.');
    });

    it('trims passwords in registration and reset schemas, while login preserves raw input', () => {
      const reg = parentRegisterSchema.parse({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        studentNumber: 'SP-2026-0001',
        password: '   Ada#Secure2026!   ',
      });
      assert.equal(reg.password, 'Ada#Secure2026!');

      const parentLogin = parentLoginSchema.parse({
        email: 'ada@example.com',
        password: '   Ada#Secure2026!   ',
      });
      // Raw password preserved for server-side two-stage migration fallback
      assert.equal(parentLogin.password, '   Ada#Secure2026!   ');

      const staffLogin = staffLoginSchema.parse({
        email: 'staff@example.com',
        password: '   Staff#Pass2026!   ',
      });
      assert.equal(staffLogin.password, '   Staff#Pass2026!   ');

      const reset = resetPasswordSchema.parse({
        token: 'valid-reset-token-12345',
        password: '   New#P@ssword2026!   ',
      });
      assert.equal(reset.password, 'New#P@ssword2026!');
    });
  });

  describe('2. Client and Server Password Validation Rules Consistency', () => {
    it('requires at least 8 characters on trimmed passwords', () => {
      const res = validatePasswordSync('   1234567   ');
      assert.equal(res.valid, false);
      assert.match(res.error, /at least 8 characters/);
    });

    it('enforces maximum 128 characters length ceiling', () => {
      const longPass = 'A!'.repeat(65); // 130 chars
      const res = validatePasswordSync(longPass);
      assert.equal(res.valid, false);
      assert.match(res.error, /must not exceed 128 characters/);
    });

    it('requires at least one special character', () => {
      const res = validatePasswordSync('AlphaNumericPassword1234');
      assert.equal(res.valid, false);
      assert.match(res.error, /contain at least one special character|include at least one special character/);
    });

    it('rejects common and dictionary passwords', () => {
      assert.equal(isCommonPassword('Password123!'), true);
      assert.equal(isCommonPassword('admin123!'), true);
      assert.equal(isCommonPassword('welcome123!'), true);
      assert.equal(isCommonPassword('letmein123!'), true);
      assert.equal(isCommonPassword('qwerty123!'), true);
      assert.equal(isCommonPassword('schoolpass123!'), true);

      const res = validatePasswordSync('Password123!');
      assert.equal(res.valid, false);
      assert.match(res.error, /stronger password/);
    });

    it('approves strong compliant passwords', () => {
      const res = validatePasswordSync('   Ch!nedU#9876Okafor&2026   ');
      assert.equal(res.valid, true);
      assert.equal(res.error, undefined);
    });
  });

  describe('3. Have I Been Pwned (HIBP) k-anonymity Approach', () => {
    it('detects breached passwords via mocked k-anonymity response', async () => {
      process.env.TEST_MOCK_HIBP = 'true';
      try {
        const breached = await isPwnedPassword('PwnedBreached#123');
        assert.equal(breached, true);
      } finally {
        delete process.env.TEST_MOCK_HIBP;
      }
    });

    it('approves unique unbreached passwords via mocked k-anonymity response', async () => {
      process.env.TEST_MOCK_HIBP = 'true';
      try {
        const breached = await isPwnedPassword('Xy7$9qL#2mPz_Un!que2026');
        assert.equal(breached, false);
      } finally {
        delete process.env.TEST_MOCK_HIBP;
      }
    });

    it('fails open when HIBP network request errors or times out', async () => {
      // Provide an unreachable URL that will fail immediately
      const breached = await isPwnedPassword('TestingNetworkFailure#2026', 'http://127.0.0.1:59999/nonexistent');
      assert.equal(breached, false, 'Should fail open gracefully without throwing');
    });

    it('validatePasswordStrengthAsync runs both synchronous and HIBP checks', async () => {
      process.env.TEST_MOCK_HIBP = 'true';
      try {
        // Syntax failure caught synchronously first
        const weak = await validatePasswordStrengthAsync('short!');
        assert.equal(weak.valid, false);
        assert.match(weak.error, /at least 8 characters/);

        // Common dictionary password caught synchronously
        const common = await validatePasswordStrengthAsync('Password123!');
        assert.equal(common.valid, false);
        assert.match(common.error, /stronger password/);

        // Structurally compliant password detected as breached via HIBP
        const breached = await validatePasswordStrengthAsync('Str0ngFormat#9876pwned');
        assert.equal(breached.valid, false);
        assert.match(breached.error, /known data breach/);

        // Strong unbreached password passes
        const strong = await validatePasswordStrengthAsync('Sup3r#Un!quePass98234');
        assert.equal(strong.valid, true);
      } finally {
        delete process.env.TEST_MOCK_HIBP;
      }
    });
  });

  describe('4. Server-Side In-Memory IP Rate Limiting', () => {
    it('allows up to 5 failed attempts per IP address', () => {
      const ip = '198.51.100.1';

      for (let i = 1; i <= 5; i++) {
        const check = checkIpRateLimit(ip, 'test_scope');
        assert.equal(check.allowed, true, `Attempt ${i} should be allowed`);
        const result = recordIpFailedAttempt(ip, 'test_scope');
        assert.equal(result.attempts, i);
      }
    });

    it('temporarily blocks the IP on the 6th attempt with retryAfterSeconds', () => {
      const ip = '198.51.100.2';

      // 5 failed attempts
      for (let i = 1; i <= 5; i++) {
        recordIpFailedAttempt(ip, 'test_scope');
      }

      // Check should now be blocked
      const check = checkIpRateLimit(ip, 'test_scope');
      assert.equal(check.allowed, false, '6th attempt must be blocked');
      assert.ok(check.retryAfterSeconds > 0, 'retryAfterSeconds must be positive');
      assert.ok(check.retryAfterSeconds <= 900, 'retryAfterSeconds must not exceed 15 minutes');
    });

    it('createRateLimitResponse generates HTTP 429 with Retry-After header', async () => {
      const res = createRateLimitResponse(600);
      assert.equal(res.status, 429);
      assert.equal(res.headers.get('Retry-After'), '600');
      const data = await res.json();
      assert.match(data.error, /Too many attempts/);
      assert.equal(data.retryAfterSeconds, 600);
    });

    it('isolates rate limits by IP address and scope', () => {
      const ipBlocked = '203.0.113.10';
      const ipAllowed = '203.0.113.20';

      for (let i = 1; i <= 5; i++) {
        recordIpFailedAttempt(ipBlocked, 'login_scope');
      }

      assert.equal(checkIpRateLimit(ipBlocked, 'login_scope').allowed, false);
      assert.equal(checkIpRateLimit(ipAllowed, 'login_scope').allowed, true);
      // Different scope on same IP is not blocked
      assert.equal(checkIpRateLimit(ipBlocked, 'different_scope').allowed, true);
    });

    it('adheres to Natural Expiry policy: successful login does not clear shared IP failures', () => {
      const ip = '198.51.100.77';

      // Attacker on school Wi-Fi / NAT makes 3 failed attempts
      recordIpFailedAttempt(ip, 'auth_parent_login');
      recordIpFailedAttempt(ip, 'auth_parent_login');
      recordIpFailedAttempt(ip, 'auth_parent_login');

      // Under Natural Expiry policy, resetIpRateLimit is not called on successful login,
      // so attempts remain tracked
      const check = checkIpRateLimit(ip, 'auth_parent_login');
      assert.equal(check.allowed, true);

      // 2 more failed attempts trigger lockout as expected
      recordIpFailedAttempt(ip, 'auth_parent_login');
      recordIpFailedAttempt(ip, 'auth_parent_login');
      assert.equal(checkIpRateLimit(ip, 'auth_parent_login').allowed, false);
    });
  });

  describe('5. Client IP Identification & Anti-Spoofing', () => {
    it('prioritizes unforgeable x-vercel-forwarded-for platform header', () => {
      const req = new Request('http://localhost/api/auth/login', {
        headers: {
          'x-vercel-forwarded-for': '203.0.113.99',
          'x-real-ip': '198.51.100.10',
          'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        },
      });
      assert.equal(extractClientIp(req), '203.0.113.99');
    });

    it('uses x-real-ip when x-vercel-forwarded-for is absent', () => {
      const req = new Request('http://localhost/api/auth/login', {
        headers: {
          'x-real-ip': '198.51.100.10',
          'x-forwarded-for': '1.2.3.4',
        },
      });
      assert.equal(extractClientIp(req), '198.51.100.10');
    });

    it('extracts right-most IP from x-forwarded-for to defeat client-spoofed prefixes', () => {
      const req = new Request('http://localhost/api/auth/login', {
        headers: {
          // Attacker sends '1.2.3.4', proxy appends real client IP '198.51.100.42'
          'x-forwarded-for': '1.2.3.4, 198.51.100.42',
        },
      });
      assert.equal(extractClientIp(req), '198.51.100.42');
    });

    it('validates IPv4 and IPv6 format and rejects invalid or unknown IPs', () => {
      assert.equal(isValidIp('192.168.1.1'), true);
      assert.equal(isValidIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334'), true);
      assert.equal(isValidIp('::1'), true);
      assert.equal(isValidIp('unknown'), false);
      assert.equal(isValidIp('localhost'), false);
      assert.equal(isValidIp('999.999.999.999'), false);

      const reqInvalid = new Request('http://localhost/api/auth/login', {
        headers: { 'x-real-ip': 'unknown' },
      });
      assert.equal(extractClientIp(reqInvalid), '127.0.0.1');
    });

    it('supports Next.js Headers instances in addition to Request', () => {
      const headers = new Headers({
        'x-vercel-forwarded-for': '203.0.113.88',
      });
      assert.equal(extractClientIp(headers), '203.0.113.88');
    });
  });

  describe('6. Safe Two-Stage Password Migration', () => {
    it('authenticates untrimmed legacy password and rehashes to trimmed hash', async () => {
      // Simulate an existing account created before whitespace trimming:
      const rawLegacyPassword = '  LegacyPassword2026!  ';
      const trimmedPassword = rawLegacyPassword.trim();

      // Legacy stored hash was computed with untrimmed whitespace
      const legacyStoredHash = await hashPassword(rawLegacyPassword);

      // Verify that testing trimmed directly against legacy hash fails
      const trimmedMatch = await verifyPassword(trimmedPassword, legacyStoredHash);
      assert.equal(trimmedMatch, false, 'Trimmed password must not directly match untrimmed hash');

      // Two-stage migration step:
      // 1. Trimmed check fails
      // 2. Input had whitespace, so fallback check with raw untrimmed matches
      const untrimmedMatch = await verifyPassword(rawLegacyPassword, legacyStoredHash);
      assert.equal(untrimmedMatch, true, 'Untrimmed fallback matches legacy account');

      // 3. Transparent rehash to trimmed version
      const migratedHash = await hashPassword(trimmedPassword);

      // 4. Subsequent logins now match on trimmed password directly
      const futureLogin = await verifyPassword(trimmedPassword, migratedHash);
      assert.equal(futureLogin, true, 'Subsequent logins succeed with trimmed password');
    });
  });

  describe('7. Sign-In Form State Initialization and Field Semantics', () => {
    it('verifies ParentLoginForm initializes email and password state to empty strings without hardcoded values', async () => {
      const fs = await import('node:fs');
      const parentFormSrc = fs.readFileSync('src/app/auth/login/ParentLoginForm.tsx', 'utf-8');

      // Verify state initialization is empty
      assert.match(parentFormSrc, /const\s*\[email,\s*setEmail\]\s*=\s*useState\(''\);/);
      assert.match(parentFormSrc, /const\s*\[password,\s*setPassword\]\s*=\s*useState\(''\);/);

      // Verify no hardcoded credentials in initial state or default values
      assert.doesNotMatch(parentFormSrc, /useState\(['"][^'"]+@[^'"]+['"]\)/);
      assert.doesNotMatch(parentFormSrc, /defaultValue/);

      // Verify standard field semantics and autocomplete
      assert.match(parentFormSrc, /name="email"/);
      assert.match(parentFormSrc, /name="password"/);
      assert.match(parentFormSrc, /autoComplete="email"/);
      assert.match(parentFormSrc, /autoComplete="current-password"/);

      // Verify no localStorage or sessionStorage credential retrieval
      assert.doesNotMatch(parentFormSrc, /localStorage/);
      assert.doesNotMatch(parentFormSrc, /sessionStorage/);
    });

    it('verifies StaffLoginForm initializes email and password state to empty strings without hardcoded values', async () => {
      const fs = await import('node:fs');
      const staffFormSrc = fs.readFileSync('src/app/auth/staff-login/StaffLoginForm.tsx', 'utf-8');

      // Verify state initialization is empty
      assert.match(staffFormSrc, /const\s*\[email,\s*setEmail\]\s*=\s*useState\(''\);/);
      assert.match(staffFormSrc, /const\s*\[password,\s*setPassword\]\s*=\s*useState\(''\);/);

      // Verify no hardcoded credentials in initial state or default values
      assert.doesNotMatch(staffFormSrc, /useState\(['"][^'"]+@[^'"]+['"]\)/);
      assert.doesNotMatch(staffFormSrc, /defaultValue/);

      // Verify standard field semantics and autocomplete
      assert.match(staffFormSrc, /name="email"/);
      assert.match(staffFormSrc, /name="password"/);
      assert.match(staffFormSrc, /autoComplete="email"/);
      assert.match(staffFormSrc, /autoComplete="current-password"/);

      // Verify no localStorage or sessionStorage credential retrieval
      assert.doesNotMatch(staffFormSrc, /localStorage/);
      assert.doesNotMatch(staffFormSrc, /sessionStorage/);
    });

    it('verifies DevCredentialsHint requires explicit user click selection and does not auto-populate on mount', async () => {
      const fs = await import('node:fs');
      const authElementsSrc = fs.readFileSync('src/app/auth/components/AuthFormElements.tsx', 'utf-8');

      // Verify DevCredentialsHint does not contain auto-populating useEffect or mount handlers
      const hintFuncIndex = authElementsSrc.indexOf('function DevCredentialsHint');
      const hintSrc = authElementsSrc.slice(hintFuncIndex);

      assert.doesNotMatch(hintSrc, /useEffect/);
      assert.match(hintSrc, /onClick=\{.*onSelect/);
    });
  });
});

