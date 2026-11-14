import type { Metadata } from 'next';
import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ParentDashboard } from './ParentDashboard';

export const metadata: Metadata = {
  title: 'Parent Dashboard | SchoolPass',
  description: 'View linked student records, current term attendance, fee balances, and access school services.',
};

export default async function AskPage() {
  const session = await getSession();

  if (!session || session.role !== 'parent') {
    redirect('/auth/login?returnUrl=/ask');
  }

  return (
    <ParentDashboard
      parentName={session.user.name}
      parentEmail={session.user.email}
    />
  );
}
