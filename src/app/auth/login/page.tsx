import type { Metadata } from 'next';
import React from 'react';
import { ParentLoginForm } from './ParentLoginForm';

export const metadata: Metadata = {
  title: 'Parent Sign In',
};

export default function ParentLoginPage() {
  return <ParentLoginForm />;
}
