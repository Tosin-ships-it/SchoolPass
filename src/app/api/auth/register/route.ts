import { NextResponse } from 'next/server';
import { registerParent, retryRegistrationStudentLink } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check if this is a retry-linking request
    if (body.action === 'retry-link') {
      const { email, token, studentNumber } = body;
      if (!email || !token || !studentNumber) {
        return NextResponse.json(
          { error: 'Email, verification token, and student number are required.' },
          { status: 400 }
        );
      }

      const retryResult = await retryRegistrationStudentLink({
        email,
        verificationToken: token,
        studentNumber,
      });

      if (!retryResult.success) {
        return NextResponse.json(
          { error: retryResult.error || 'Failed to submit student link request.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Your link request has been submitted and is pending staff approval.',
        studentName: retryResult.studentName,
        className: retryResult.className,
        requestId: retryResult.requestId,
      });
    }

    const { name, email, password, studentNumber } = body;

    if (!name || !email || !password || !studentNumber) {
      return NextResponse.json(
        { error: 'All fields are required, including your child\'s student number.' },
        { status: 400 }
      );
    }

    const result = await registerParent({
      name,
      email,
      password,
      studentNumber,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Registration successful. Please verify your email address.',
      verificationToken: result.verificationToken, // Provided in development for seamless testing
      email: email.trim().toLowerCase(),
      studentLink: result.studentLink,
    });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { email, token, studentNumber } = body;

    if (!email || !token || !studentNumber) {
      return NextResponse.json(
        { error: 'Email, verification token, and student number are required.' },
        { status: 400 }
      );
    }

    const result = await retryRegistrationStudentLink({
      email,
      verificationToken: token,
      studentNumber,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to submit student link request.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Your link request has been submitted and is pending staff approval.',
      studentName: result.studentName,
      className: result.className,
      requestId: result.requestId,
    });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
