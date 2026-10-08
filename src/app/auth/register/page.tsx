import type { Metadata } from 'next';
import React from 'react';
import { ParentRegisterForm } from './ParentRegisterForm';

export const metadata: Metadata = {
  title: 'Create Parent Account',
};

export default function ParentRegisterPage() {
  return <ParentRegisterForm />;
}
