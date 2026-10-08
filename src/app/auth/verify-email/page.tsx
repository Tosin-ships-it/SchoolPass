import type { Metadata } from 'next';
import React from 'react';
import { VerifyEmailForm } from './VerifyEmailForm';

export const metadata: Metadata = {
  title: 'Verify Email',
};

export default function VerifyEmailPage() {
  return <VerifyEmailForm />;
}
