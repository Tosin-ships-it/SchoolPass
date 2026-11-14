import 'server-only';
import { getSession, type AuthSession } from '@/lib/auth';
import { checkParentStudentAuthorization } from '@/lib/auth';

export interface ReceiptData {
  reference: string;
  flutterwaveReference: string | null;
  amount: string;
  status: string;
  createdAt: string;
  verifiedAt: string | null;
  student: {
    id: string;
    name: string;
    studentNumber: string;
    className: string;
  };
  parent: {
    id: string;
    name: string;
    email: string;
  };
  schoolName: string;
}

export interface ReceiptResponse {
  success: boolean;
  receipt?: ReceiptData;
  error?: string;
  code?: string;
}

export interface ReceiptOptions {
  session?: AuthSession | null;
  prismaClient?: any;
  checkAuthFn?: typeof checkParentStudentAuthorization;
}

/**
 * Retrieves official digital receipt data for a verified payment.
 * Enforces server-side authorization: caller must be linked to the student.
 */
export async function getReceiptData(
  reference: string,
  options?: ReceiptOptions
): Promise<Response> {
  const session = options?.session !== undefined ? options.session : await getSession();

  if (!session || (session.role !== 'parent' && session.role !== 'admin' && session.role !== 'staff')) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Authentication required.',
        code: 'UNAUTHORIZED',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const cleanReference = reference?.trim();
  if (!cleanReference) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Payment reference is required.',
        code: 'INVALID_REFERENCE',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const prisma = options?.prismaClient ?? (await import('@/lib/db')).prisma;

  const payment = await prisma.payment.findUnique({
    where: { internalReference: cleanReference },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          studentNumber: true,
          className: true,
        },
      },
      parent: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!payment) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Receipt not found for this reference.',
        code: 'NOT_FOUND',
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // If caller is a parent, verify active ParentStudent link to the student
  if (session.role === 'parent') {
    const checkAuth = options?.checkAuthFn ?? checkParentStudentAuthorization;
    const isAuthorized = await checkAuth(session.userId, payment.studentId);
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Access denied: You are not authorized to view this receipt.',
          code: 'FORBIDDEN',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  const schoolSetting = await prisma.schoolSetting.findUnique({
    where: { key: 'school_name' },
    select: { value: true },
  });

  const payload: ReceiptResponse = {
    success: true,
    receipt: {
      reference: payment.internalReference,
      flutterwaveReference: payment.flutterwaveReference,
      amount: payment.amount.toFixed(2),
      status: payment.status,
      createdAt: payment.createdAt.toISOString(),
      verifiedAt: payment.verifiedAt ? payment.verifiedAt.toISOString() : null,
      student: {
        id: payment.student.id,
        name: payment.student.name,
        studentNumber: payment.student.studentNumber,
        className: payment.student.className,
      },
      parent: {
        id: payment.parent.id,
        name: payment.parent.name,
        email: payment.parent.email,
      },
      schoolName: schoolSetting?.value || 'SchoolPass Academy',
    },
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

