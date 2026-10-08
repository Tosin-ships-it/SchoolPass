import type { Metadata } from 'next';
import React from 'react';
import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Reset Password',
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
