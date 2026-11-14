import type { Metadata } from 'next';
import { CheckinSimulatorClient } from './CheckinSimulatorClient';

export const metadata: Metadata = {
  title: 'Check-in Device Simulator | SchoolPass',
  description: 'Physical gate turnstile simulator for verifying student check-in codes.',
};

export default function CheckinSimulatorPage() {
  return <CheckinSimulatorClient />;
}
