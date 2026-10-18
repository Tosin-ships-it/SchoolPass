import { NextResponse } from 'next/server';
import { getSession, submitStudentLinkRequest, getParentRequests, getParentStudentLinks } from '@/lib/auth';

/**
 * GET /api/records/link-requests
 * Retrieve link requests and active links for the authenticated parent.
 */
export async function GET() {
  const session = await getSession();

  if (!session || session.role !== 'parent') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [requests, activeLinks] = await Promise.all([
      getParentRequests(session.userId),
      getParentStudentLinks(session.userId),
    ]);

    return NextResponse.json({
      success: true,
      requests,
      activeLinks,
    });
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/records/link-requests
 * Submit a student number link request for staff review.
 */
export async function POST(req: Request) {
  const session = await getSession();

  if (!session || session.role !== 'parent') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const studentNumber = typeof body?.studentNumber === 'string' ? body.studentNumber.trim() : '';

    if (!studentNumber) {
      return NextResponse.json(
        { error: 'Please enter a valid student number.' },
        { status: 400 }
      );
    }

    const result = await submitStudentLinkRequest(session.userId, studentNumber);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to submit link request.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Your link request has been submitted and is pending staff approval.',
      requestId: result.requestId,
      studentName: result.studentName,
      className: result.className,
    });
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
