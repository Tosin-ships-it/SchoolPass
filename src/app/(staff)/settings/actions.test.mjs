import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

const authMockSource = `
let state = { authorized: false, error: 'Authentication required.' };
export function __setAuth(next) { state = next; }
export async function assertAdminSession() { return state; }
export async function getConfiguredClasses() { return ['Primary 1', 'Primary 2']; }
export async function getConfiguredSessions() { return ['2026/2027']; }
`;

const loaderSource = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/auth') {
    return {
      url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(authMockSource)}),
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
`;

register('data:text/javascript,' + encodeURIComponent(loaderSource), import.meta.url);

const authMock = await import('@/lib/auth');
const actions = await import('./actions.ts');
const paymentActions = await import('@/app/(staff)/payments/actions');
const { getDefaultAcademicCalendar } = await import('@/lib/attendance/calendar');

describe('SchoolPass Academic Calendar: Admin Security in Server Actions', () => {
  it('blocks unauthenticated callers from reading calendar action', async () => {
    authMock.__setAuth({ authorized: false, error: 'Authentication required.' });
    const res = await actions.getAcademicCalendarAction();
    assert.equal(res.success, false);
    assert.match(res.errors[0], /Authentication required/);
  });

  it('blocks non-admin staff callers from saving calendar action', async () => {
    authMock.__setAuth({
      authorized: false,
      session: { role: 'staff', userId: 'cstaff_1' },
      error: 'Unauthorized. Admin privileges required.',
    });

    const res = await actions.saveAcademicCalendarAction(getDefaultAcademicCalendar());
    assert.equal(res.success, false);
    assert.match(res.errors[0], /Admin privileges required/);
  });

  it('blocks non-admin staff callers from reading calendar action', async () => {
    authMock.__setAuth({
      authorized: false,
      session: { role: 'staff', userId: 'cstaff_1' },
      error: 'Unauthorized. Admin privileges required.',
    });

    const res = await actions.getAcademicCalendarAction();
    assert.equal(res.success, false);
    assert.match(res.errors[0], /Admin privileges required/);
  });
});

describe('SchoolPass Financial Protections: Blocked Operations When Current Term Incomplete', () => {
  it('blocks bulk fee assignment when current term calendar is incomplete', async () => {
    authMock.__setAuth({
      authorized: true,
      session: { role: 'admin', userId: 'cadmin_001', user: { id: 'cadmin_001', name: 'Admin', email: 'admin@school.ng' } },
    });

    const res = await paymentActions.applyFeeTemplateBulkAction('c1234567890abcdef12345678', 'Primary 1');
    assert.equal(res.success, false);
    assert.equal(res.errorCode, 'configuration');
    assert.match(res.error, /term dates are incomplete/i);
    assert.match(res.error, /School Settings/i);
  });

  it('blocks fee assignment preview when current term calendar is incomplete', async () => {
    authMock.__setAuth({
      authorized: true,
      session: { role: 'admin', userId: 'cadmin_001', user: { id: 'cadmin_001', name: 'Admin', email: 'admin@school.ng' } },
    });

    const res = await paymentActions.previewTemplateAssignmentAction('c1234567890abcdef12345678', 'Primary 1');
    assert.equal(res.success, false);
    assert.equal(res.errorCode, 'configuration');
    assert.match(res.error, /term dates are incomplete/i);
    assert.match(res.error, /School Settings/i);
  });

  it('blocks individual charge creation when current term calendar is incomplete', async () => {
    authMock.__setAuth({
      authorized: true,
      session: { role: 'admin', userId: 'cadmin_001', user: { id: 'cadmin_001', name: 'Admin', email: 'admin@school.ng' } },
    });

    const res = await paymentActions.createIndividualChargeAction('cstudent1234567890abcdef', {
      title: 'Lab Levy',
      amount: '5000',
      termId: '2026/2027-T1',
    });
    assert.equal(res.success, false);
    assert.equal(res.errorCode, 'configuration');
    assert.match(res.error, /term dates are incomplete/i);
    assert.match(res.error, /School Settings/i);
  });
});
