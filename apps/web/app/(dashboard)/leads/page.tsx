import type { Metadata } from 'next';
import { LeadsWorkspace } from '@/components/commerce/leads-workspace';

export const metadata: Metadata = {
  title: 'Leads & SEO Intelligence',
};

export default function LeadsPage() {
  return <LeadsWorkspace />;
}
