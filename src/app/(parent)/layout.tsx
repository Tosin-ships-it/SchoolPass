import type { Metadata } from 'next';
import React from 'react';
import { getSession } from '@/lib/auth';
import { UnverifiedEmailBanner } from './components/UnverifiedEmailBanner';

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

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <>
      {session && !session.isEmailVerified && (
        <UnverifiedEmailBanner email={session.user.email} />
      )}
      {children}
    </>
  );
}
