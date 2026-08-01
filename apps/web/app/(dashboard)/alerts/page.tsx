import type { Metadata } from 'next';

import { AlertWorkspace } from '@/components/commerce/alert-workspace';

export const metadata: Metadata = {
  title: 'Alerts',
};

export default function AlertsPage() {
  return <AlertWorkspace />;
}
