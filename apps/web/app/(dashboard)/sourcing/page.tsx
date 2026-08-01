import type { Metadata } from 'next';
import { SourcingWorkspace } from '@/components/commerce/sourcing-workspace';

export const metadata: Metadata = {
  title: 'Sourcing & Dropshipping',
};

export default function SourcingPage() {
  return <SourcingWorkspace />;
}
