import type { Metadata } from 'next';

import { AIWorkspace } from '@/components/commerce/ai-workspace';

export const metadata: Metadata = {
  title: 'Local AI | NEXORA Intelligence',
};

export default function AIPage() {
  return <AIWorkspace />;
}
