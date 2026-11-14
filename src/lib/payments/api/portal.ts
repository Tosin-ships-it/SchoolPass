import 'server-only';
import { getSession, type AuthSession } from '@/lib/auth';
import { getParentStudentLinks, checkParentStudentAuthorization } from '@/lib/auth';
import { computeStudentBalance } from '../ledger';

export interface PortalFeeItem {
  id: string;
  termId: string;
  type: string;
  amount: string;
  note: string | null;
  createdAt: string;
}

export interface PortalPaymentItem {
  id: string;
  amount: string;
  internalReference: string;
  flutterwaveReference: string | null;
  status: string;
  createdAt: string;
  verifiedAt: string | null;
  refunds: Array<{
    id: string;
    amount: string;
    status: string;
    createdAt: string;
  }>;
}

export interface PortalTermBreakdownItem {
  termId: string;
  termName: string;
  charges: string;
  grossCharges: string;
  adjustments: string;
  paid: string;
  outstanding: string;
  isCurrentTerm: boolean;
}

export interface PortalBalanceData {
  totalOutstanding: string;
  amountDue: string;
  earlierTermsArrears: string;
  currentTermBalance: string;
  creditBalance: string;
  currentTermId: string | null;
  terms: PortalTermBreakdownItem[];
  configurationNotice?: string;
}

export interface PortalLinkedStudent {
  id: string;
  parentId: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  className: string;
  createdAt: Date;
}

export interface PortalDataResponse {
  success: boolean;
  linkedStudents: PortalLinkedStudent[];
  selectedStudent: PortalLinkedStudent | null;
  balance: PortalBalanceData | null;
  charges: PortalFeeItem[];
  payments: PortalPaymentItem[];
  error?: string;
  code?: string;
}

export interface PortalOptions {
  session?: AuthSession | null;
  prismaClient?: any;
  getLinksFn?: typeof getParentStudentLinks;
  checkAuthFn?: typeof checkParentStudentAuthorization;
  computeBalanceFn?: typeof computeStudentBalance;
}

/**
 * Loads portal financial summary, charges breakdown, and payment history
 * for verified linked children of the authenticated parent.
 */
export async function getPortalData(
  request: Request,
  options?: PortalOptions
): Promise<Response> {
  try {
    const session = options?.session !== undefined ? options.session : await getSession();

    if (!session || session.role !== 'parent') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Authentication required. Parent access only.',
          code: 'UNAUTHORIZED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const getLinks = options?.getLinksFn ?? getParentStudentLinks;
    const linkedStudents = await getLinks(session.userId);

    if (linkedStudents.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          linkedStudents: [],
          selectedStudent: null,
          balance: null,
          charges: [],
          payments: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(request.url);
    const requestedStudentId = url.searchParams.get('studentId') || linkedStudents[0].studentId;

    // Enforce server-side parent-to-student authorization
    const checkAuth = options?.checkAuthFn ?? checkParentStudentAuthorization;
    const isAuthorized = await checkAuth(session.userId, requestedStudentId);

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Access denied: You are not authorized to view financial records for this student.',
          code: 'FORBIDDEN',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const selectedStudent =
      linkedStudents.find((s) => s.studentId === requestedStudentId) || null;

    if (!selectedStudent) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Student is not an active linked student.',
          code: 'STUDENT_NOT_LINKED',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const computeBalance = options?.computeBalanceFn ?? computeStudentBalance;
    const prisma = options?.prismaClient ?? (await import('@/lib/db')).prisma;

    // 1. Fetch fee entries and payment records in parallel
    const [feeEntries, paymentRecords] = await Promise.all([
      prisma.feeEntry.findMany({
        where: { studentId: requestedStudentId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          termId: true,
          type: true,
          amount: true,
          note: true,
          createdAt: true,
        },
      }),
      // Notice: In Prisma, nested relations must be defined inside `select` rather than combining top-level `include` and `select`
      prisma.payment.findMany({
        where: { studentId: requestedStudentId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          internalReference: true,
          flutterwaveReference: true,
          status: true,
          createdAt: true,
          verifiedAt: true,
          refunds: {
            select: {
              id: true,
              amount: true,
              status: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    // 2. Compute dynamic balance safely
    let balanceData: PortalBalanceData;
    try {
      const balance = await computeBalance(requestedStudentId);
      balanceData = {
        totalOutstanding: balance.totalOutstanding.toFixed(2),
        amountDue: balance.amountDue.toFixed(2),
        earlierTermsArrears: balance.earlierTermsArrears.toFixed(2),
        currentTermBalance: balance.currentTermBalance.toFixed(2),
        creditBalance: balance.creditBalance.toFixed(2),
        currentTermId: balance.currentTermId,
        terms: balance.termBreakdown.map((t) => ({
          termId: t.termId,
          termName: t.termName,
          charges: t.charges.toFixed(2),
          grossCharges: t.grossCharges.toFixed(2),
          adjustments: t.adjustments.toFixed(2),
          paid: t.paid.toFixed(2),
          outstanding: t.outstanding.toFixed(2),
          isCurrentTerm: t.isCurrentTerm,
        })),
      };
    } catch (balanceErr: unknown) {
      // If term calendar is unconfigured, fallback to calculated entries or zero rather than crashing the portal
      balanceData = {
        totalOutstanding: '0.00',
        amountDue: '0.00',
        earlierTermsArrears: '0.00',
        currentTermBalance: '0.00',
        creditBalance: '0.00',
        currentTermId: null,
        terms: [],
        configurationNotice:
          balanceErr instanceof Error ? balanceErr.message : 'Term configuration incomplete.',
      };
    }

    const payload: PortalDataResponse = {
      success: true,
      linkedStudents,
      selectedStudent,
      balance: balanceData,
      charges: feeEntries.map((e: any) => ({
        id: e.id,
        termId: e.termId,
        type: e.type,
        amount: Number(e.amount).toFixed(2),
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
      payments: paymentRecords.map((p: any) => ({
        id: p.id,
        amount: Number(p.amount).toFixed(2),
        internalReference: p.internalReference,
        flutterwaveReference: p.flutterwaveReference,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
        refunds: (p.refunds || []).map((r: any) => ({
          id: r.id,
          amount: Number(r.amount).toFixed(2),
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
      })),
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve portal fee data.';
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
