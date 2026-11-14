import type { Metadata } from 'next';
import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { StaffSessionTracker } from './StaffSessionTracker';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session || (session.role !== 'staff' && session.role !== 'admin')) {
    redirect('/auth/staff-login');
  }

  return (
    <>
      <StaffSessionTracker timeoutMinutes={15} />
      {children}
    </>
  );
}
