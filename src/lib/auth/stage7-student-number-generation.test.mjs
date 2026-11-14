import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  runIdempotent,
  _clearIdempotencyForTesting,
} from './idempotency.ts';
import {
  checkActorRateLimit,
  _clearRateLimitsForTesting,
} from './rateLimit.ts';
import { intendingStudentIntakeSchema } from './schemas.ts';
import { getAllStaffUsers } from './store.ts';

describe('Stage 7: Student Number Generation Hardening', () => {
  describe('Idempotency helper', () => {
    beforeEach(() => {
      _clearIdempotencyForTesting();
    });

    it('returns the cached result for a repeated key without re-running the operation', async () => {
      let calls = 0;
      const operation = async () => {
        calls += 1;
        return { success: true, studentNumber: 'SP-2026-0001' };
      };

      const first = await runIdempotent('staff_1:submission_1', operation);
      const second = await runIdempotent('staff_1:submission_1', operation);

      assert.equal(calls, 1);
      assert.deepEqual(first, second);
    });

    it('shares one in-flight operation between concurrent callers with the same key', async () => {
      let calls = 0;
      const operation = async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { success: true, studentNumber: 'SP-2026-0002' };
      };

      const [first, second] = await Promise.all([
        runIdempotent('staff_1:submission_2', operation),
        runIdempotent('staff_1:submission_2', operation),
      ]);

      assert.equal(calls, 1);
      assert.deepEqual(first, second);
    });

    it('does not cache failed results when shouldCache rejects them', async () => {
      let calls = 0;
      const operation = async () => {
        calls += 1;
        return { success: false, error: 'allocation_failed' };
      };
      const options = { shouldCache: (result) => result.success };

      await runIdempotent('staff_1:submission_3', operation, options);
      await runIdempotent('staff_1:submission_3', operation, options);

      assert.equal(calls, 2);
    });

    it('keeps different keys independent', async () => {
      let calls = 0;
      const operation = async () => {
        calls += 1;
        return { success: true, calls };
      };

      await runIdempotent('staff_1:submission_4', operation);
      await runIdempotent('staff_1:submission_5', operation);

      assert.equal(calls, 2);
    });
  });

  describe('Per-actor rate limiting', () => {
    beforeEach(() => {
      _clearRateLimitsForTesting();
    });

    it('allows requests up to the limit and rejects the next request', () => {
      assert.equal(checkActorRateLimit('staff_1', 'intake', 3, 60_000).allowed, true);
      assert.equal(checkActorRateLimit('staff_1', 'intake', 3, 60_000).allowed, true);
      assert.equal(checkActorRateLimit('staff_1', 'intake', 3, 60_000).allowed, true);

      const denied = checkActorRateLimit('staff_1', 'intake', 3, 60_000);
      assert.equal(denied.allowed, false);
      assert.equal(denied.remaining, 0);
      assert.ok((denied.retryAfterSeconds ?? 0) >= 1);
    });

    it('isolates limits by actor', () => {
      checkActorRateLimit('staff_1', 'intake', 1, 60_000);
      assert.equal(checkActorRateLimit('staff_1', 'intake', 1, 60_000).allowed, false);
      assert.equal(checkActorRateLimit('staff_2', 'intake', 1, 60_000).allowed, true);
    });

    it('isolates limits by scope', () => {
      checkActorRateLimit('staff_1', 'intake', 1, 60_000);
      assert.equal(checkActorRateLimit('staff_1', 'intake', 1, 60_000).allowed, false);
      assert.equal(checkActorRateLimit('staff_1', 'search', 1, 60_000).allowed, true);
    });
  });

  describe('Staff directory data minimization', () => {
    it('does not expose staff password hashes to the client-facing directory', async () => {
      const staff = await getAllStaffUsers();

      for (const account of staff) {
        assert.equal('passwordHash' in account, false);
        assert.equal('password_hash' in account, false);
      }
    });
  });

  describe('Intake schema submission identifier', () => {
    const basePayload = {
      name: 'Chioma Okonjo',
      intendedClass: 'Primary 1',
      sessionYear: '2026/2027',
    };

    it('accepts an optional submissionId', () => {
      const result = intendingStudentIntakeSchema.safeParse({
        ...basePayload,
        submissionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.submissionId, 'f47ac10b-58cc-4372-a567-0e02b2c3d479');
      }
    });

    it('still accepts a payload without a submissionId', () => {
      const result = intendingStudentIntakeSchema.safeParse(basePayload);
      assert.equal(result.success, true);
    });

    it('rejects an overlong submissionId', () => {
      const result = intendingStudentIntakeSchema.safeParse({
        ...basePayload,
        submissionId: 'x'.repeat(101),
      });

      assert.equal(result.success, false);
      assert.match(result.error?.issues[0]?.message || '', /must not exceed 100 characters/i);
    });
  });
});
