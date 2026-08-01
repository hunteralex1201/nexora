import type { Metadata } from 'next';

import { JobWorkspace } from '@/components/commerce/job-workspace';

export const metadata: Metadata = {
  title: 'Jobs',
};

export default function JobsPage() {
  return <JobWorkspace />;
}
