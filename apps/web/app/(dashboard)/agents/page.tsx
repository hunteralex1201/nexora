import type { Metadata } from 'next';

import { AgentWorkspace } from '@/components/commerce/agent-workspace';

export const metadata: Metadata = {
  title: 'Agent Operations',
};

export default function AgentsPage() {
  return <AgentWorkspace />;
}
