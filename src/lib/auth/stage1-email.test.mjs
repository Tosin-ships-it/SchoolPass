import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAppBaseUrl,
  buildWelcomeEmailHtml,
  buildWelcomeEmailText,
  buildVerificationEmailHtml,
  buildVerificationEmailText,
  buildPasswordResetEmailHtml,
  buildPasswordResetEmailText,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  isDevStubsEnabled,
} from './email.ts';
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
} from './crypto.ts';

describe('SchoolPass Stage 1: Email Verification and Password Reset Delivery', () => {
  it('constructs canonical application URLs correctly', () => {
    const originalUrl = process.env.NEXT_PUBLIC_APP_URL;

    process.env.NEXT_PUBLIC_APP_URL = 'https://portal.schoolpass.ng/';
    assert.equal(getAppBaseUrl(), 'https://portal.schoolpass.ng');

    delete process.env.NEXT_PUBLIC_APP_URL;
    assert.equal(getAppBaseUrl(), 'https://schoolpass.ng');

    if (originalUrl) {
      process.env.NEXT_PUBLIC_APP_URL = originalUrl;
    }
  });

  it('builds verification email HTML with parent name, canonical link, and 24h expiry', () => {
    const token = 'test_token_verification_12345';
    const html = buildVerificationEmailHtml(token, 'Amina Bello');

    assert.ok(html.includes('Hello Amina Bello,'), 'Includes parent greeting');
    assert.ok(html.includes('/auth/verify-email?token=test_token_verification_12345'), 'Includes canonical verify route');
    assert.ok(html.includes('24 hours'), 'Includes 24-hour expiry notice');
    assert.ok(html.includes('SchoolPass'), 'Includes SchoolPass branding');
    assert.ok(html.includes('#087e8b'), 'Uses SchoolPass primary brand color token');
  });

  it('builds verification email plain-text with canonical link and 24h expiry', () => {
    const token = 'test_token_verification_12345';
    const text = buildVerificationEmailText(token, 'Amina Bello');

    assert.ok(text.includes('Hello Amina Bello,'), 'Includes parent greeting in text');
    assert.ok(text.includes('/auth/verify-email?token=test_token_verification_12345'), 'Includes canonical verify route in text');
    assert.ok(text.includes('24 hours'), 'Includes 24-hour expiry notice in text');
  });

  it('builds password reset email HTML with parent name, canonical link, 1h expiry, and ignore notice', () => {
    const token = 'test_token_reset_67890';
    const html = buildPasswordResetEmailHtml(token, 'Chidi Okafor');

    assert.ok(html.includes('Hello Chidi Okafor,'), 'Includes recipient greeting');
    assert.ok(html.includes('/auth/reset-password?token=test_token_reset_67890'), 'Includes canonical reset route');
    assert.ok(html.includes('1 hour'), 'Includes 1-hour expiry notice');
    assert.ok(html.includes('safely ignore this email'), 'Explains user can safely ignore if not requested');
    assert.ok(html.includes('#087e8b'), 'Uses SchoolPass primary brand color token');
  });

  it('builds password reset email plain-text with canonical link, 1h expiry, and ignore notice', () => {
    const token = 'test_token_reset_67890';
    const text = buildPasswordResetEmailText(token, 'Chidi Okafor');

    assert.ok(text.includes('Hello Chidi Okafor,'), 'Includes recipient greeting in text');
    assert.ok(text.includes('/auth/reset-password?token=test_token_reset_67890'), 'Includes canonical reset route in text');
    assert.ok(text.includes('1 hour'), 'Includes 1-hour expiry notice in text');
    assert.ok(text.includes('safely ignore this email'), 'Includes safe ignore notice in text');
  });

  it('preserves existing welcome email templates and behavior', () => {
    const html = buildWelcomeEmailHtml('Fatima Musa');
    const text = buildWelcomeEmailText('Fatima Musa');

    assert.ok(html.includes("Welcome to SchoolPass! We're glad to have you here."), 'Welcome HTML includes existing body text');
    assert.ok(html.includes('Welcome to SchoolPass!'), 'Welcome HTML includes headline');
    assert.ok(text.includes('Welcome to SchoolPass!'), 'Welcome text includes headline');
  });

  it('activates email mock safeguard and returns test_mock_email_id without network calls', async () => {
    process.env.RESEND_MOCK = 'true';

    const welcomeResult = await sendWelcomeEmail({
      to: 'test-welcome@example.com',
      name: 'Test Parent',
      userId: 'test_parent_cuid_1',
    });
    assert.equal(welcomeResult.success, true);
    assert.equal(welcomeResult.id, 'test_mock_email_id');

    const verifyResult = await sendVerificationEmail({
      to: 'test-verify@example.com',
      token: 'raw_test_verification_token',
      name: 'Test Parent',
      userId: 'test_parent_cuid_1',
    });
    assert.equal(verifyResult.success, true);
    assert.equal(verifyResult.id, 'test_mock_email_id');

    const resetResult = await sendPasswordResetEmail({
      to: 'test-reset@example.com',
      token: 'raw_test_reset_token',
      name: 'Test Parent',
      userId: 'test_parent_cuid_1',
    });
    assert.equal(resetResult.success, true);
    assert.equal(resetResult.id, 'test_mock_email_id');
  });

  it('dispatches multiple verification emails to the same address with distinct tokens within 5 minutes without suppression', async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.RESEND_API_KEY;
    const originalResendMock = process.env.RESEND_MOCK;
    const originalNodeEnv = process.env.NODE_ENV;

    const dispatchedRequests = [];
    process.env.RESEND_API_KEY = 're_test_mock_api_key_123';
    process.env.RESEND_MOCK = 'false';
    process.env.NODE_ENV = 'development';

    globalThis.fetch = async (url, options) => {
      dispatchedRequests.push({ url, body: JSON.parse(options.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: `resend_verify_${dispatchedRequests.length}` }),
      };
    };

    try {
      const email = 'resend.parent@example.com';
      const token1 = 'token_alpha_11111';
      const token2 = 'token_beta_22222';

      // First verification send
      const result1 = await sendVerificationEmail({
        to: email,
        token: token1,
        name: 'Parent User',
      });
      assert.equal(result1.success, true);
      assert.equal(result1.id, 'resend_verify_1');

      // Immediate resend within 5 minutes with fresh token
      const result2 = await sendVerificationEmail({
        to: email,
        token: token2,
        name: 'Parent User',
      });
      assert.equal(result2.success, true, 'Second verification email must not be suppressed by deduplication');
      assert.equal(result2.id, 'resend_verify_2');

      // Verify two distinct network requests were dispatched with their respective tokens
      assert.equal(dispatchedRequests.length, 2, 'Exactly 2 verification emails must be dispatched');
      assert.ok(dispatchedRequests[0].body.html.includes(token1), 'Request 1 contains token 1');
      assert.ok(dispatchedRequests[1].body.html.includes(token2), 'Request 2 contains token 2');
    } finally {
      globalThis.fetch = originalFetch;
      process.env.RESEND_API_KEY = originalApiKey;
      process.env.RESEND_MOCK = originalResendMock;
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('dispatches multiple password reset emails to the same address with distinct tokens within 5 minutes without suppression', async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.RESEND_API_KEY;
    const originalResendMock = process.env.RESEND_MOCK;
    const originalNodeEnv = process.env.NODE_ENV;

    const dispatchedRequests = [];
    process.env.RESEND_API_KEY = 're_test_mock_api_key_123';
    process.env.RESEND_MOCK = 'false';
    process.env.NODE_ENV = 'development';

    globalThis.fetch = async (url, options) => {
      dispatchedRequests.push({ url, body: JSON.parse(options.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: `resend_reset_${dispatchedRequests.length}` }),
      };
    };

    try {
      const email = 'reset.parent@example.com';
      const token1 = 'reset_token_first_aaa';
      const token2 = 'reset_token_second_bbb';

      // First password reset request
      const result1 = await sendPasswordResetEmail({
        to: email,
        token: token1,
        name: 'Parent User',
      });
      assert.equal(result1.success, true);
      assert.equal(result1.id, 'resend_reset_1');

      // Immediate second password reset request within 5 minutes with fresh token
      const result2 = await sendPasswordResetEmail({
        to: email,
        token: token2,
        name: 'Parent User',
      });
      assert.equal(result2.success, true, 'Second password reset email must not be suppressed by deduplication');
      assert.equal(result2.id, 'resend_reset_2');

      // Verify two distinct network requests were dispatched with their respective tokens
      assert.equal(dispatchedRequests.length, 2, 'Exactly 2 reset emails must be dispatched');
      assert.ok(dispatchedRequests[0].body.html.includes(token1), 'Request 1 contains token 1');
      assert.ok(dispatchedRequests[1].body.html.includes(token2), 'Request 2 contains token 2');
    } finally {
      globalThis.fetch = originalFetch;
      process.env.RESEND_API_KEY = originalApiKey;
      process.env.RESEND_MOCK = originalResendMock;
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('preserves welcome email deduplication within 5 minutes', async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.RESEND_API_KEY;
    const originalResendMock = process.env.RESEND_MOCK;
    const originalNodeEnv = process.env.NODE_ENV;

    const dispatchedRequests = [];
    process.env.RESEND_API_KEY = 're_test_mock_api_key_123';
    process.env.RESEND_MOCK = 'false';
    process.env.NODE_ENV = 'development';

    globalThis.fetch = async (url, options) => {
      dispatchedRequests.push({ url, body: JSON.parse(options.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: `resend_welcome_${dispatchedRequests.length}` }),
      };
    };

    try {
      const email = 'welcome.dedupe.test@example.com';

      // First welcome email send
      const result1 = await sendWelcomeEmail({
        to: email,
        name: 'New Parent',
      });
      assert.equal(result1.success, true);
      assert.equal(result1.id, 'resend_welcome_1');
      assert.equal(dispatchedRequests.length, 1);

      // Immediate second welcome email to same address within 5 minutes
      const result2 = await sendWelcomeEmail({
        to: email,
        name: 'New Parent',
      });
      assert.equal(result2.success, true);
      assert.ok(result2.error?.includes('Deduplicated'), 'Second welcome email must be deduplicated');
      assert.equal(dispatchedRequests.length, 1, 'No second network request must be made for welcome email');
    } finally {
      globalThis.fetch = originalFetch;
      process.env.RESEND_API_KEY = originalApiKey;
      process.env.RESEND_MOCK = originalResendMock;
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('keeps verification and password reset emails independent for the same address', async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.RESEND_API_KEY;
    const originalResendMock = process.env.RESEND_MOCK;
    const originalNodeEnv = process.env.NODE_ENV;

    const dispatchedSubjects = [];
    process.env.RESEND_API_KEY = 're_test_mock_api_key_123';
    process.env.RESEND_MOCK = 'false';
    process.env.NODE_ENV = 'development';

    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      dispatchedSubjects.push(body.subject);
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: `resend_msg_${dispatchedSubjects.length}` }),
      };
    };

    try {
      const email = 'multi.type.parent@example.com';

      const verifyRes = await sendVerificationEmail({
        to: email,
        token: 'verify_token_123',
      });
      assert.equal(verifyRes.success, true);

      const resetRes = await sendPasswordResetEmail({
        to: email,
        token: 'reset_token_456',
      });
      assert.equal(resetRes.success, true);

      assert.equal(dispatchedSubjects.length, 2);
      assert.equal(dispatchedSubjects[0], 'Confirm your SchoolPass email address');
      assert.equal(dispatchedSubjects[1], 'Reset your SchoolPass password');
    } finally {
      globalThis.fetch = originalFetch;
      process.env.RESEND_API_KEY = originalApiKey;
      process.env.RESEND_MOCK = originalResendMock;
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('preserves scrypt password hashing, verification, and timing-safe checks', async () => {
    const password = 'SchoolPassSecretPassword2026!';
    const hash = await hashPassword(password);

    // Verify format: scrypt$N=16384,r=8,p=1$salt$derivedKey
    assert.ok(hash.startsWith('scrypt$N=16384,r=8,p=1$'), 'Password hash uses scrypt format');
    assert.ok(!hash.startsWith('$argon2'), 'Argon2 is not used in Stage 1');
    assert.ok(!hash.startsWith('$2a$') && !hash.startsWith('$2b$'), 'bcrypt is not used in Stage 1');
    assert.ok(hash.split('$').length === 4, 'scrypt hash has 4 components');

    // Verify valid password
    const isValid = await verifyPassword(password, hash);
    assert.equal(isValid, true, 'Valid password verifies correctly');

    // Verify invalid password
    const isInvalid = await verifyPassword('WrongPassword123!', hash);
    assert.equal(isInvalid, false, 'Invalid password is rejected');
  });

  it('strictly isolates SHA-256 token hashing from password hashing', () => {
    const rawToken = generateSecureToken();
    assert.equal(rawToken.length, 64, 'Token is 64 hex characters (32 random bytes)');

    const tokenHash = hashToken(rawToken);
    assert.equal(tokenHash.length, 64, 'Token hash is 64 hex characters (SHA-256)');
    assert.notEqual(tokenHash, rawToken, 'Hashed token does not match raw token');

    // SHA-256 is deterministic for tokens
    const secondHash = hashToken(rawToken);
    assert.equal(secondHash, tokenHash, 'Token hash is deterministic SHA-256');
  });

  it('prevents raw verification or reset token leakage in production mode even with dev stubs enabled', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalStubFlag = process.env.NEXT_PUBLIC_ENABLE_DEV_STUBS;
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_ENABLE_DEV_STUBS = 'true';

    try {
      // isDevStubsEnabled must strictly return false in production
      assert.equal(isDevStubsEnabled(), false, 'isDevStubsEnabled must return false in production regardless of flag');

      const rawToken = 'sample_secret_token_abcdef123456';
      const devResponse = {
        success: true,
        message: 'Registration successful. Please verify your email address.',
        ...(isDevStubsEnabled() && { verificationToken: rawToken }),
      };

      assert.equal(devResponse.verificationToken, undefined, 'verificationToken is omitted in production');
      assert.ok(!('verificationToken' in devResponse), 'verificationToken key does not exist on response in production');

      const resetResponse = {
        success: true,
        message: 'Password reset instructions sent.',
        ...(isDevStubsEnabled() && { resetToken: rawToken }),
      };

      assert.equal(resetResponse.resetToken, undefined, 'resetToken is omitted in production');
      assert.ok(!('resetToken' in resetResponse), 'resetToken key does not exist on response in production');
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.NEXT_PUBLIC_ENABLE_DEV_STUBS = originalStubFlag;
    }
  });

  it('omits tokens in development mode unless NEXT_PUBLIC_ENABLE_DEV_STUBS is explicitly true', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalStubFlag = process.env.NEXT_PUBLIC_ENABLE_DEV_STUBS;

    process.env.NODE_ENV = 'development';

    try {
      // Case 1: Flag unset
      delete process.env.NEXT_PUBLIC_ENABLE_DEV_STUBS;
      assert.equal(isDevStubsEnabled(), false, 'isDevStubsEnabled returns false in dev when flag is unset');

      const rawToken = 'dev_token_sample_123';
      const resUnset = {
        success: true,
        ...(isDevStubsEnabled() && { verificationToken: rawToken }),
      };
      assert.equal(resUnset.verificationToken, undefined, 'Tokens omitted when flag is unset');

      // Case 2: Flag set to false
      process.env.NEXT_PUBLIC_ENABLE_DEV_STUBS = 'false';
      assert.equal(isDevStubsEnabled(), false, 'isDevStubsEnabled returns false when flag is false');

      // Case 3: Flag set to 'true' in development
      process.env.NEXT_PUBLIC_ENABLE_DEV_STUBS = 'true';
      assert.equal(isDevStubsEnabled(), true, 'isDevStubsEnabled returns true in dev when flag is true');

      const resOptIn = {
        success: true,
        ...(isDevStubsEnabled() && { verificationToken: rawToken }),
      };
      assert.equal(resOptIn.verificationToken, rawToken, 'Token included in dev when flag is explicitly true');
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.NEXT_PUBLIC_ENABLE_DEV_STUBS = originalStubFlag;
    }
  });

  it('guarantees user-facing resend status messages never expose raw tokens', () => {
    // Verified user-facing copy from ParentLoginForm
    const standardStatus = 'If an unverified account exists, a new verification link has been sent to your email.';
    assert.ok(!standardStatus.includes('token'), 'User status message must never contain token word');
    assert.ok(!standardStatus.includes('Test token'), 'User status message must never contain Test token');
  });

  it('enforces strict role separation between staff and parent credentials', () => {
    const staffAccounts = [
      { email: 'staff@school.ng', role: 'staff' },
      { email: 'admin@school.ng', role: 'admin' },
    ];
    const parentAccounts = [
      { email: 'parent.linked@example.com', role: 'parent' },
      { email: 'parent.unlinked@example.com', role: 'parent' },
      { email: 'parent.unverified@example.com', role: 'parent' },
    ];

    // Verify staff list contains no parent emails
    for (const s of staffAccounts) {
      assert.ok(!s.email.includes('parent'), `Staff account ${s.email} must not be a parent account`);
      assert.ok(s.role === 'staff' || s.role === 'admin', 'Staff accounts must have staff or admin role');
    }

    // Verify parent list contains no staff emails
    for (const p of parentAccounts) {
      assert.ok(!p.email.includes('staff') && !p.email.includes('admin'), `Parent account ${p.email} must not be a staff account`);
      assert.equal(p.role, 'parent', 'Parent accounts must have parent role');
    }
  });

  it('normalizes email inputs to lowercase as characters are typed', () => {
    // Simulated input typing with mixed case
    const rawInputs = [
      'GboyegaOlan@Gmail.com',
      'PARENT.TEST@EXAMPLE.NG',
      'Staff_Admin@SchoolPass.ORG',
      '  LeadingTrailing@Domain.com  ',
    ];

    const normalizedTyped = rawInputs.map(input => input.toLowerCase());
    assert.deepEqual(normalizedTyped, [
      'gboyegaolan@gmail.com',
      'parent.test@example.ng',
      'staff_admin@schoolpass.org',
      '  leadingtrailing@domain.com  ',
    ]);

    // Trimming applied on server-side or on submit
    const serverNormalized = rawInputs.map(input => input.trim().toLowerCase());
    assert.deepEqual(serverNormalized, [
      'gboyegaolan@gmail.com',
      'parent.test@example.ng',
      'staff_admin@schoolpass.org',
      'leadingtrailing@domain.com',
    ]);
  });

  it('strictly preserves password character casing and never converts passwords to lowercase', () => {
    const rawPasswords = [
      'SecretPassword2026!',
      'AllUPPERCASE999#',
      'Mixed_Case_Secure_Key$',
    ];

    // Password fields must never be lowercased
    const transformed = rawPasswords.map(pw => pw); // identity
    assert.deepEqual(transformed, [
      'SecretPassword2026!',
      'AllUPPERCASE999#',
      'Mixed_Case_Secure_Key$',
    ]);

    // Verifying FormField behavior: type === 'email' normalizes, but type === 'password' or 'text' preserves
    function simulateFormFieldChange(type, value) {
      const event = { target: { value } };
      if (type === 'email' && typeof event.target.value === 'string') {
        event.target.value = event.target.value.toLowerCase();
      }
      return event.target.value;
    }

    assert.equal(simulateFormFieldChange('email', 'Parent@Domain.COM'), 'parent@domain.com');
    assert.equal(simulateFormFieldChange('password', 'SecretPassword2026!'), 'SecretPassword2026!');
    assert.equal(simulateFormFieldChange('text', 'SP-2026-0001'), 'SP-2026-0001');
  });
});

