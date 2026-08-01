import type { Metadata } from 'next';

import { SourceWorkspace } from '@/components/commerce/source-workspace';

export const metadata: Metadata = {
  title: 'Sources',
};

export default function SourcesPage() {
  return <SourceWorkspace />;
}
