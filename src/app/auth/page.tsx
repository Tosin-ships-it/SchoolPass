'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ParentLoginForm } from './login/ParentLoginForm';
import { ParentRegisterForm } from './register/ParentRegisterForm';
import { StaffLoginForm } from './staff-login/StaffLoginForm';
import { ForgotPasswordForm } from './forgot-password/ForgotPasswordForm';
import { ResetPasswordForm } from './reset-password/ResetPasswordForm';
import { VerifyEmailForm } from './verify-email/VerifyEmailForm';

export type AuthView =
  | 'login'
  | 'register'
  | 'staff-login'
  | 'forgot-password'
  | 'reset-password'
  | 'verify-email';

function AuthPageContainer() {
  const searchParams = useSearchParams();
  const requestedView = searchParams.get('view') as AuthView | null;
  const tokenParam = searchParams.get('token');

  let activeView: AuthView = 'login';

  if (
    requestedView &&
    ['login', 'register', 'staff-login', 'forgot-password', 'reset-password', 'verify-email'].includes(requestedView)
  ) {
    activeView = requestedView;
  } else if (tokenParam) {
    if (searchParams.get('mode') === 'reset' || searchParams.has('reset')) {
      activeView = 'reset-password';
    } else {
      activeView = 'verify-email';
    }
  }

  return (
    <>
      {activeView === 'login' && <ParentLoginForm />}
      {activeView === 'register' && <ParentRegisterForm />}
      {activeView === 'staff-login' && <StaffLoginForm />}
      {activeView === 'forgot-password' && (
        <ForgotPasswordForm initialEmail={searchParams ? searchParams.get('email') || undefined : undefined} />
      )}
      {activeView === 'reset-password' && <ResetPasswordForm />}
      {activeView === 'verify-email' && <VerifyEmailForm />}
    </>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-roles-background)',
            color: 'var(--color-roles-on-surface-variant)',
            fontFamily: 'var(--typography-body-medium-fontfamily)',
          }}
        >
          Loading SchoolPass authentication...
        </div>
      }
    >
      <AuthPageContainer />
    </Suspense>
  );
}
