import type { Metadata } from 'next';
import { CheckinSimulatorClient } from '../schoolpass/checkin/CheckinSimulatorClient';

export const metadata: Metadata = {
  title: 'Check-in Device Simulator | SchoolPass',
  description: 'Physical gate turnstile simulator for verifying student check-in codes.',
};

export default function CheckinSimulatorDirectPage() {
  return <CheckinSimulatorClient />;
}
