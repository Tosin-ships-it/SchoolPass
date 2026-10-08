import type { Metadata } from 'next';
import React from 'react';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Forgot Password',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
