import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Inline test loader for Node ESM to resolve Next.js server modules and TS paths
const inlineLoaderCode = `
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve as pathResolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/headers' || specifier === 'next/headers.js') {
    return {
      url: 'data:text/javascript,' + encodeURIComponent(\`
        const cookieJar = new Map();
        export function setTestCookie(k, v) { if (v === null || v === undefined) cookieJar.delete(k); else cookieJar.set(k, v); }
        export function clearTestCookies() { cookieJar.clear(); }
        export async function cookies() {
          return {
            get: (k) => cookieJar.has(k) ? { name: k, value: cookieJar.get(k) } : undefined,
            set: (k, v) => cookieJar.set(k, v),
            delete: (k) => cookieJar.delete(k),
          };
        }
        export async function headers() { return new Headers(); }
      \`),
      shortCircuit: true,
    };
  }
  if (specifier === 'next/cache' || specifier === 'next/cache.js') {
    return {
      url: 'data:text/javascript,' + encodeURIComponent(\`
        export function revalidatePath() {}
        export function revalidateTag() {}
      \`),
      shortCircuit: true,
    };
  }
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2);
    const basePath = pathResolve(process.cwd(), 'src', rel);
    if (existsSync(basePath + '.ts')) {
      return nextResolve(pathToFileURL(basePath + '.ts').href, context);
    }
    if (existsSync(basePath + '/index.ts')) {
      return nextResolve(pathToFileURL(basePath + '/index.ts').href, context);
    }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    const parentDir = dirname(fileURLToPath(context.parentURL));
    const targetPath = pathResolve(parentDir, specifier);
    if (existsSync(targetPath + '.ts')) {
      return nextResolve(pathToFileURL(targetPath + '.ts').href, context);
    }
    if (existsSync(targetPath + '/index.ts')) {
      return nextResolve(pathToFileURL(targetPath + '/index.ts').href, context);
    }
  }
  return nextResolve(specifier, context);
}
`;

register('data:text/javascript,' + encodeURIComponent(inlineLoaderCode), import.meta.url);

describe('SchoolPass Argon2id Password Hashing & Migration Test Suite', async () => {
  const crypto = await import('./crypto.ts');
  const store = await import('./store.ts');
  const auth = await import('./index.ts');
  const { prisma } = await import('../db/index.ts');
  const nodeCrypto = await import('node:crypto');

  // Helper to generate a legacy scrypt hash matching SchoolPass v1 format:
  // scrypt$N=16384,r=8,p=1$<salt_hex_32chars>$<derivedKey_hex_128chars>
  async function generateLegacyScryptHash(password) {
    const salt = nodeCrypto.randomBytes(16).toString('hex');
    const derivedKey = await new Promise((resolve, reject) => {
      nodeCrypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => {
        if (err) reject(err);
        else resolve(key.toString('hex'));
      });
    });
    return `scrypt$N=16384,r=8,p=1$${salt}$${derivedKey}`;
  }

  describe('1. Hashing Salting & Uniqueness (Deliverable 07)', () => {
    it('hashing the same password twice produces different hashes due to unique random salt', async () => {
      const password = 'SchoolPassTestPassword2026!';
      const hash1 = await crypto.hashPassword(password);
      const hash2 = await crypto.hashPassword(password);

      assert.notEqual(hash1, hash2, 'Two hashes of the same password must differ due to unique salts');
      assert.ok(hash1.startsWith('$argon2id$v=19$m=65536,t=3,p=1$'), 'Hash 1 uses Argon2id format');
      assert.ok(hash2.startsWith('$argon2id$v=19$m=65536,t=3,p=1$'), 'Hash 2 uses Argon2id format');

      // Both hashes verify the same original password
      assert.equal(await crypto.verifyPassword(password, hash1), true);
      assert.equal(await crypto.verifyPassword(password, hash2), true);
    });
  });

  describe('2. Argon2id Verification Correctness', () => {
    it('verifies correct password and rejects incorrect password', async () => {
      const password = 'CorrectPassword2026#';
      const hash = await crypto.hashPassword(password);

      assert.equal(await crypto.verifyPassword(password, hash), true, 'Correct password verifies');
      assert.equal(await crypto.verifyPassword('WrongPassword2026#', hash), false, 'Wrong password rejected');
      assert.equal(await crypto.verifyPassword('correctpassword2026#', hash), false, 'Case sensitivity preserved');
    });

    it('safely handles malformed and garbage hash strings without throwing', async () => {
      assert.equal(await crypto.verifyPassword('password', ''), false);
      assert.equal(await crypto.verifyPassword('password', '$argon2id$garbage'), false);
      assert.equal(await crypto.verifyPassword('password', 'scrypt$invalid$parts'), false);
      assert.equal(await crypto.verifyPassword('password', null), false);
      assert.equal(await crypto.verifyPassword('password', undefined), false);
    });
  });

  describe('3. Legacy scrypt Verification Backward Compatibility', () => {
    it('verifies existing scrypt hashes and rejects incorrect passwords', async () => {
      const password = 'LegacyStudentPassword2026!';
      const legacyHash = await generateLegacyScryptHash(password);

      assert.ok(legacyHash.startsWith('scrypt$N=16384,r=8,p=1$'), 'Legacy hash has scrypt prefix');
      assert.equal(crypto.needsRehash(legacyHash), true, 'Legacy scrypt hash identified as needing rehash');

      assert.equal(await crypto.verifyPassword(password, legacyHash), true, 'Legacy scrypt password verifies');
      assert.equal(await crypto.verifyPassword('IncorrectPassword123!', legacyHash), false, 'Wrong password rejected');
    });
  });

  describe('4. Parent Login Transparent Rehash & Session Preservation', () => {
    it('authenticates legacy scrypt parent and transparently updates stored hash to Argon2id', async () => {
      const email = `parent.test.${Date.now()}@schoolpass.test`;
      const password = 'ParentLegacyPass2026!';
      const legacyHash = await generateLegacyScryptHash(password);

      // Create parent directly in store with legacy scrypt hash
      const parent = await store.createParent({
        name: 'Legacy Parent',
        email,
        passwordHash: legacyHash,
        previousPasswordHashes: [legacyHash],
        emailVerifiedAt: new Date(),
      });

      assert.ok(parent.passwordHash.startsWith('scrypt$'), 'Parent starts with legacy scrypt hash');

      // Execute loginParent
      const loginResult = await auth.loginParent(email, password, '127.0.0.1');
      assert.equal(loginResult.success, true, 'Login succeeds for legacy scrypt account');

      // Fetch parent from database to verify transparent rehash
      const updatedParent = await store.findParentById(parent.id);
      assert.ok(updatedParent.passwordHash.startsWith('$argon2id$v=19$m=65536,t=3,p=1$'), 'Stored hash upgraded to Argon2id');
      assert.equal(crypto.needsRehash(updatedParent.passwordHash), false, 'Upgraded hash no longer needs rehash');

      // Subsequent login verifies directly with upgraded Argon2id hash
      const subsequentLogin = await auth.loginParent(email, password, '127.0.0.1');
      assert.equal(subsequentLogin.success, true, 'Subsequent login succeeds with Argon2id');
    });
  });

  describe('5. Staff Login Transparent Rehash & Session Preservation', () => {
    it('authenticates legacy scrypt staff user and updates stored hash without invalidating sessions', async () => {
      const email = `staff.test.${Date.now()}@schoolpass.test`;
      const password = 'StaffLegacyPass2026!';
      const legacyHash = await generateLegacyScryptHash(password);

      const staff = await store.createStaffUser({
        name: 'Legacy Staff Member',
        email,
        passwordHash: legacyHash,
        role: 'STAFF',
      });

      assert.ok(staff.passwordHash.startsWith('scrypt$'), 'Staff starts with legacy scrypt hash');

      // Simulate pre-existing active session
      const existingSession = await store.createSessionRecord(staff.id, 'staff', new Date(Date.now() + 3600000));
      assert.ok(existingSession.id, 'Session created');

      // Execute loginStaff
      const loginResult = await auth.loginStaff(email, password, '127.0.0.1');
      assert.equal(loginResult.success, true, 'Login succeeds for legacy staff account');

      // Verify transparent rehash in database
      const updatedStaff = await store.findStaffById(staff.id);
      assert.ok(updatedStaff.passwordHash.startsWith('$argon2id$v=19$m=65536,t=3,p=1$'), 'Staff hash upgraded to Argon2id');

      // Crucial verification: pre-existing session was NOT invalidated by the login rehash
      const checkedSession = await store.findSessionRecord(existingSession.id);
      assert.ok(checkedSession, 'Pre-existing staff session remains active and valid after rehash');
    });
  });

  describe('6. Failed Login Behavior', () => {
    it('failed login does not trigger rehash or alter the stored database hash', async () => {
      const email = `parent.failed.${Date.now()}@schoolpass.test`;
      const password = 'RealPassword2026!';
      const legacyHash = await generateLegacyScryptHash(password);

      const parent = await store.createParent({
        name: 'Untouched Parent',
        email,
        passwordHash: legacyHash,
        previousPasswordHashes: [legacyHash],
        emailVerifiedAt: new Date(),
      });

      // Attempt login with wrong password
      const loginResult = await auth.loginParent(email, 'WrongPassword2026!', '127.0.0.1');
      assert.equal(loginResult.success, false, 'Login fails with wrong password');

      // Verify stored hash remains exact legacy scrypt hash
      const parentAfter = await store.findParentById(parent.id);
      assert.equal(parentAfter.passwordHash, legacyHash, 'Stored hash was not touched on failed login');
    });
  });

  describe('7. Concurrency & Optimistic Concurrency Overwrite Protection', () => {
    it('conditionallyRehashParentPassword skips update if password changed concurrently', async () => {
      const expectedOldHash = 'scrypt$N=16384,r=8,p=1$salt$oldKey';
      const actualNewerHash = '$argon2id$v=19$m=65536,t=3,p=1$newResetHash';
      const attemptedRehash = '$argon2id$v=19$m=65536,t=3,p=1$staleRehash';

      const email = `parent.race.${Date.now()}@schoolpass.test`;
      const parent = await store.createParent({
        name: 'Race Parent',
        email,
        passwordHash: actualNewerHash, // User already reset their password
        previousPasswordHashes: [],
        emailVerifiedAt: new Date(),
      });

      // A concurrent login rehash arrives with expectedOldHash
      const rehashSuccess = await store.conditionallyRehashParentPassword(parent.id, expectedOldHash, attemptedRehash);
      assert.equal(rehashSuccess, false, 'Conditional rehash returns false when stored hash does not match');

      // Verify newer reset password was NOT overwritten
      const parentAfter = await store.findParentById(parent.id);
      assert.equal(parentAfter.passwordHash, actualNewerHash, 'Newer reset password preserved without overwrite');
    });

    it('conditionallyRehashStaffPassword skips update if password changed concurrently', async () => {
      const expectedOldHash = 'scrypt$N=16384,r=8,p=1$salt$oldStaffKey';
      const actualNewerHash = '$argon2id$v=19$m=65536,t=3,p=1$newStaffResetHash';
      const attemptedRehash = '$argon2id$v=19$m=65536,t=3,p=1$staleStaffRehash';

      const email = `staff.race.${Date.now()}@schoolpass.test`;
      const staff = await store.createStaffUser({
        name: 'Race Staff',
        email,
        passwordHash: actualNewerHash,
        role: 'STAFF',
      });

      const rehashSuccess = await store.conditionallyRehashStaffPassword(staff.id, expectedOldHash, attemptedRehash);
      assert.equal(rehashSuccess, false, 'Conditional staff rehash returns false when stored hash does not match');

      const staffAfter = await store.findStaffById(staff.id);
      assert.equal(staffAfter.passwordHash, actualNewerHash, 'Newer staff password preserved without overwrite');
    });
  });

  describe('8. Rehash Failure Resilience (Fail-Safe)', () => {
    it('allows valid login to succeed and retains legacy hash when persistence update fails', async () => {
      const email = `parent.failsafe.${Date.now()}@schoolpass.test`;
      const password = 'FailSafePassword2026!';
      const legacyHash = await generateLegacyScryptHash(password);

      const parent = await store.createParent({
        name: 'FailSafe Parent',
        email,
        passwordHash: legacyHash,
        previousPasswordHashes: [legacyHash],
        emailVerifiedAt: new Date(),
      });

      // Monkey-patch prisma.parent.updateMany to simulate transient database rejection
      const originalUpdateMany = prisma.parent.updateMany;
      try {
        prisma.parent.updateMany = async () => {
          throw new Error('Simulated transient DB connection timeout');
        };

        const loginResult = await auth.loginParent(email, password, '127.0.0.1');
        assert.equal(loginResult.success, true, 'Login succeeds even when background rehash persistence throws');

        // Verify original scrypt hash is retained in database for next time
        const parentAfter = await store.findParentById(parent.id);
        assert.equal(parentAfter.passwordHash, legacyHash, 'Legacy hash retained safely in database');
      } finally {
        prisma.parent.updateMany = originalUpdateMany;
      }
    });
  });

  describe('9. Password Reset & Historical Reuse Across Mixed Formats', () => {
    it('password reset stores Argon2id and rejects reuse of legacy scrypt passwords in history', async () => {
      const email = `parent.reuse.${Date.now()}@schoolpass.test`;
      const oldPassword = 'OldLegacyPassword2026!';
      const legacyHash = await generateLegacyScryptHash(oldPassword);

      const parent = await store.createParent({
        name: 'Reuse Test Parent',
        email,
        passwordHash: legacyHash,
        previousPasswordHashes: [legacyHash],
        emailVerifiedAt: new Date(),
      });

      // Generate a valid password reset token
      const rawToken = crypto.generateSecureToken();
      const tokenHash = crypto.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 3600000);
      await store.savePasswordResetToken(email, tokenHash, expiresAt);

      // Attempt to reset to the EXACT same old password (stored in history as scrypt)
      const reusedResult = await auth.resetPassword(rawToken, oldPassword);
      assert.equal(reusedResult.success, false, 'Reuse of legacy scrypt password is appropriately blocked');
      assert.equal(reusedResult.error, 'You cannot reuse one of your last 3 passwords.');

      // Now reset to a new, distinct password
      const newPassword = 'BrandNewPassword2026#';
      const successResult = await auth.resetPassword(rawToken, newPassword);
      assert.equal(successResult.success, true, 'Reset with new password succeeds');

      const parentAfter = await store.findParentById(parent.id);
      assert.ok(parentAfter.passwordHash.startsWith('$argon2id$v=19$m=65536,t=3,p=1$'), 'New hash is Argon2id');
      assert.equal(await crypto.verifyPassword(newPassword, parentAfter.passwordHash), true);
    });
  });

  describe('10. Whitespace Trimming & Two-Stage Login Semantics', () => {
    it('migrates legacy untrimmed scrypt account to trimmed Argon2id upon login', async () => {
      const untrimmedPassword = '   PaddedPassword2026!   ';
      const trimmedPassword = untrimmedPassword.trim();
      // Legacy account was created with untrimmed space in hash:
      const legacyUntrimmedHash = await generateLegacyScryptHash(untrimmedPassword);

      const email = `parent.padded.${Date.now()}@schoolpass.test`;
      const parent = await store.createParent({
        name: 'Padded Parent',
        email,
        passwordHash: legacyUntrimmedHash,
        previousPasswordHashes: [legacyUntrimmedHash],
        emailVerifiedAt: new Date(),
      });

      // User submits with trailing whitespace:
      const loginResult = await auth.loginParent(email, untrimmedPassword, '127.0.0.1');
      assert.equal(loginResult.success, true, 'Two-stage login succeeds via untrimmed fallback');

      // Verify the rehash updated the password to trimmed Argon2id
      const parentAfter = await store.findParentById(parent.id);
      assert.ok(parentAfter.passwordHash.startsWith('$argon2id$v=19$m=65536,t=3,p=1$'), 'Migrated to Argon2id');

      // Subsequent login with trimmed password matches directly
      const nextLogin = await auth.loginParent(email, trimmedPassword, '127.0.0.1');
      assert.equal(nextLogin.success, true, 'Subsequent login matches trimmed password');
    });
  });
});
