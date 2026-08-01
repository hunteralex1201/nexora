import type { Metadata } from 'next';

import { IntegrationWorkspace } from '@/components/commerce/integration-workspace';

export const metadata: Metadata = {
  title: 'Integrations',
};

export default function IntegrationsPage() {
  return <IntegrationWorkspace />;
}
