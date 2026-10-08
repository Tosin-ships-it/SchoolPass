import { NextResponse } from 'next/server';
import { resendVerificationEmail } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required.' },
        { status: 400 }
      );
    }

    const result = await resendVerificationEmail(email);

    return NextResponse.json({
      success: true,
      message: 'If an unverified account exists, a new verification link has been sent.',
      verificationToken: result.verificationToken, // Provided in development
    });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
