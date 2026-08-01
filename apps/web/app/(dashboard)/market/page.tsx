import type { Metadata } from 'next';

import { MarketWorkspace } from '@/components/commerce/market-workspace';

export const metadata: Metadata = {
  title: 'Market Intelligence',
};

export default function MarketPage() {
  return <MarketWorkspace />;
}
