import type { Metadata } from 'next';
import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ReceiptView } from './ReceiptView';

export const metadata: Metadata = {
  title: 'Official Payment Receipt | SchoolPass',
  description: 'Digital verified receipt for school fee payments.',
};

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/auth/login');
  }

  const { reference } = await params;

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--color-roles-background)',
        padding: '32px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <ReceiptView reference={reference} />
    </div>
  );
}

