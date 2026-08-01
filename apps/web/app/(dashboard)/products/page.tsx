import type { Metadata } from 'next';

import { ProductWorkspace } from '@/components/commerce/product-workspace';

export const metadata: Metadata = {
  title: 'Products',
};

export default function ProductsPage() {
  return <ProductWorkspace />;
}
