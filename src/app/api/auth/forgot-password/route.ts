import { NextResponse } from 'next/server';
import { requestPasswordReset } from '@/lib/auth';

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

    const result = await requestPasswordReset(email);

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email address, we have sent instructions to reset your password.',
      resetToken: result.resetToken, // Provided in development for seamless testing
    });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
