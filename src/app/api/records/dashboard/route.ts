import { getSession, type AuthSession } from '@/lib/auth';
import { getParentStudentLinks, getParentRequests, determineDashboardLinkState } from '@/lib/auth';
import { computeStudentBalance } from '@/lib/payments/ledger';
import { prisma as defaultPrisma } from '@/lib/db';

export interface ChildDashboardOverview {
  studentId: string;
  studentName: string;
  studentNumber: string;
  className: string;
  enrollmentStatus: 'Active';
  attendance: {
    hasRecords: boolean;
    totalDays: number;
    presentDays: number;
    percentage: number | null;
    text: string;
  };
  feeBalance: {
    isConfigured: boolean;
    hasCharges: boolean;
    totalOutstanding: string;
    formattedAmount: string;
    isCleared: boolean;
    text: string;
    note: string | null;
  };
}

export interface RecentActivityItem {
  id: string;
  type: 'PAYMENT' | 'ARRIVAL';
  title: string;
  description: string;
  date: string;
}

export interface ParentDashboardData {
  success: boolean;
  linkState: ReturnType<typeof determineDashboardLinkState>;
  children: ChildDashboardOverview[];
  pendingRequests: Array<{
    id: string;
    studentName: string;
    studentNumber: string;
    studentClass: string;
    status: string;
    createdAt: string;
  }>;
  recentActivity: RecentActivityItem[];
  isEmailVerified?: boolean;
  error?: string;
}

export interface DashboardRouteOptions {
  session?: AuthSession | null;
  prismaClient?: any;
  getLinksFn?: typeof getParentStudentLinks;
  getRequestsFn?: typeof getParentRequests;
  computeBalanceFn?: typeof computeStudentBalance;
}

export async function handleGetParentDashboard(
  options?: DashboardRouteOptions
): Promise<Response> {
  try {
    const session = options?.session !== undefined ? options.session : await getSession();

    if (!session || session.role !== 'parent') {
      return Response.json(
        {
          success: false,
          error: 'Authentication required. Parent access only.',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    const prisma = options?.prismaClient ?? defaultPrisma;
    const getLinks = options?.getLinksFn ?? getParentStudentLinks;
    const getRequests = options?.getRequestsFn ?? getParentRequests;
    const computeBalance = options?.computeBalanceFn ?? computeStudentBalance;

    let [activeLinks, requests] = await Promise.all([
      getLinks(session.userId),
      getRequests(session.userId),
    ]);

    // Resiliency: If parent has no active links and no requests, check if an intending student
    // was registered with their guardian email and initialize the pending link request
    if (activeLinks.length === 0 && requests.length === 0 && session.user?.email) {
      try {
        const db = prisma as any;
        if (db.intendingStudent) {
          const normalizedEmail = session.user.email.trim().toLowerCase();
          const intending = await db.intendingStudent.findFirst({
            where: {
              guardianEmail: {
                equals: normalizedEmail,
                mode: 'insensitive',
              },
            },
          });
          if (intending) {
            const student = await prisma.student.upsert({
              where: { studentNumber: intending.studentNumber },
              update: {},
              create: {
                studentNumber: intending.studentNumber,
                name: intending.name,
                className: intending.intendedClass,
              },
            });
            await prisma.studentLinkRequest.create({
              data: {
                parentId: session.userId,
                studentId: student.id,
                status: 'PENDING',
              },
            });
            requests = await getRequests(session.userId);
          }
        }
      } catch {
        // Continue gracefully without breaking dashboard render
      }
    }

    const linkState = determineDashboardLinkState(activeLinks.length > 0, requests);

    // 1. Compute per-child overview for actively linked children
    const children: ChildDashboardOverview[] = await Promise.all(
      activeLinks.map(async (link) => {
        // Attendance figures (staff-recorded attendance is the source of truth)
        let attendance = {
          hasRecords: false,
          totalDays: 0,
          presentDays: 0,
          percentage: null as number | null,
          text: 'No attendance recorded yet for current term',
        };

        try {
          const [totalDays, presentDays] = await Promise.all([
            prisma.attendanceRecord.count({
              where: { studentId: link.studentId },
            }),
            prisma.attendanceRecord.count({
              where: { studentId: link.studentId, status: 'PRESENT' },
            }),
          ]);

          if (totalDays > 0) {
            const percentage = Math.round((presentDays / totalDays) * 100);
            attendance = {
              hasRecords: true,
              totalDays,
              presentDays,
              percentage,
              text: `${presentDays} of ${totalDays} days present (${percentage}%)`,
            };
          }
        } catch {
          // Gracefully fallback if attendance table read encounters temporary error
        }

        // Outstanding Fee Balance
        let feeBalance = {
          isConfigured: false,
          hasCharges: false,
          totalOutstanding: '0.00',
          formattedAmount: 'Pending',
          isCleared: false,
          text: 'Fee schedule pending term configuration',
          note: 'Official term dates must be configured in School Settings before fee balances are active.',
        };

        try {
          const summary = await computeBalance(link.studentId);
          const totalOutstandingNum = summary.totalOutstanding.toNumber();
          const totalChargesNum = summary.totalCharges.toNumber();

          if (totalChargesNum === 0) {
            feeBalance = {
              isConfigured: true,
              hasCharges: false,
              totalOutstanding: '0.00',
              formattedAmount: '₦0.00',
              isCleared: true,
              text: 'No fees assigned yet for current term',
              note: null,
            };
          } else if (totalOutstandingNum <= 0) {
            feeBalance = {
              isConfigured: true,
              hasCharges: true,
              totalOutstanding: '0.00',
              formattedAmount: '₦0.00',
              isCleared: true,
              text: '₦0.00 (Fees cleared)',
              note: 'All assigned fees have been settled.',
            };
          } else {
            feeBalance = {
              isConfigured: true,
              hasCharges: true,
              totalOutstanding: totalOutstandingNum.toFixed(2),
              formattedAmount: `₦${totalOutstandingNum.toLocaleString('en-NG', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`,
              isCleared: false,
              text: `₦${totalOutstandingNum.toLocaleString('en-NG', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} outstanding`,
              note:
                summary.earlierTermsArrears.toNumber() > 0
                  ? 'Includes earlier term arrears'
                  : null,
            };
          }
        } catch {
          // If calendar is incomplete or unconfigured, keep the honest pending notice
        }

        return {
          studentId: link.studentId,
          studentName: link.studentName,
          studentNumber: link.studentNumber,
          className: link.className,
          enrollmentStatus: 'Active' as const,
          attendance,
          feeBalance,
        };
      })
    );

    // 2. Format pending link requests
    const pendingRequests = requests
      .filter((r) => r.status === 'PENDING')
      .map((r) => ({
        id: r.id,
        studentName: r.studentName,
        studentNumber: r.studentNumber,
        studentClass: r.studentClass,
        status: r.status,
        createdAt: new Date(r.createdAt).toISOString(),
      }));

    // 3. Meaningful Recent Activity (Only real, verified data. Empty if none exist)
    const recentActivity: RecentActivityItem[] = [];
    const studentIds = activeLinks.map((l) => l.studentId);

    try {
      const [recentPayments, recentArrivals] = await Promise.all([
        prisma.payment.findMany({
          where: { parentId: session.userId, status: 'SUCCESSFUL' },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            amount: true,
            internalReference: true,
            createdAt: true,
            student: { select: { name: true } },
          },
        }),
        studentIds.length > 0
          ? prisma.arrivalConfirmation.findMany({
              where: { studentId: { in: studentIds } },
              orderBy: { createdAt: 'desc' },
              take: 3,
              select: {
                id: true,
                method: true,
                createdAt: true,
                student: { select: { name: true } },
              },
            })
          : Promise.resolve([]),
      ]);

      for (const p of recentPayments) {
        const amt = Number(p.amount);
        recentActivity.push({
          id: p.id,
          type: 'PAYMENT',
          title: 'Fee Payment Confirmed',
          description: `₦${amt.toLocaleString('en-NG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} confirmed for ${p.student?.name || 'child'} (Ref: ${p.internalReference})`,
          date: new Date(p.createdAt).toISOString(),
        });
      }

      for (const a of recentArrivals) {
        recentActivity.push({
          id: a.id,
          type: 'ARRIVAL',
          title: 'Morning Arrival Confirmed',
          description: `Gate arrival confirmed for ${a.student?.name || 'child'} via ${
            a.method === 'QR' ? 'QR Code' : 'Manual Code'
          }`,
          date: new Date(a.createdAt).toISOString(),
        });
      }

      // Sort recent activity newest first
      recentActivity.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch {
      // If activity query fails, keep recentActivity empty rather than failing the whole dashboard
    }

    const responseData: ParentDashboardData = {
      success: true,
      linkState,
      children,
      pendingRequests,
      recentActivity: recentActivity.slice(0, 4),
      isEmailVerified: Boolean(session.isEmailVerified),
    };

    return Response.json(responseData);
  } catch (err: any) {
    return Response.json(
      {
        success: false,
        error: err?.message || 'Something went wrong. Please try again.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<Response> {
  return handleGetParentDashboard();
}

