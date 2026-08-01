import type { Metadata } from 'next';

import { WorkflowWorkspace } from '@/components/commerce/workflow-workspace';

export const metadata: Metadata = {
  title: 'Workflows',
};

export default function WorkflowsPage() {
  return <WorkflowWorkspace />;
}
