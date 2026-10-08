import type { Metadata } from 'next';
import React from 'react';
import { StaffLoginForm } from './StaffLoginForm';

export const metadata: Metadata = {
  title: 'Staff & Admin Sign In',
};

export default function StaffLoginPage() {
  return <StaffLoginForm />;
}
