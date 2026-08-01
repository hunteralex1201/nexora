import type { Metadata } from 'next';

import { AgentsWorkspace } from '@/components/commerce/agents-workspace';

export const metadata: Metadata = {
  title: 'AI Agent Control Center',
};

export default function AgentsPage() {
  return <AgentsWorkspace />;
}
