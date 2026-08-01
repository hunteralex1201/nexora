'use client';

import {
  BellRing,
  BrainCircuit,
  LayoutDashboard,
  Menu,
  PackageSearch,
  RadioTower,
  ServerCog,
  Workflow,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Brand } from '@/components/brand';

const navigation = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/sources', label: 'Sources', icon: RadioTower },
  { href: '/products', label: 'Products', icon: PackageSearch },
  { href: '/jobs', label: 'Automation', icon: Workflow },
  { href: '/alerts', label: 'Alerts', icon: BellRing },
  { href: '/ai', label: 'AI chat', icon: BrainCircuit },
] as const;

const pageTitles: Record<string, string> = {
  '/overview': 'Overview',
  '/sources': 'Sources',
  '/products': 'Products',
  '/jobs': 'Automation',
  '/alerts': 'Alerts',
  '/ai': 'AI chat',
  '/system': 'System health',
  '/settings': 'Settings',
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const pageTitle = pageTitles[pathname] ?? 'Workspace';

  return (
    <div className="min-h-screen bg-[#f6f5f1] text-[#272622] lg:flex">
      {navigationOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-[#272622]/35 backdrop-blur-[2px] lg:hidden"
          onClick={() => setNavigationOpen(false)}
        />
      )}

      <aside
        id="primary-navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-[#d8d5cd] bg-[#eeece6] px-3 py-4 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          navigationOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-10 items-center justify-between px-2">
          <Brand />
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg text-[#747168] hover:bg-[#e3e0d8] hover:text-[#272622] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b85c3d]/30 lg:hidden"
            aria-label="Close navigation"
            onClick={() => setNavigationOpen(false)}
          >
            <X className="size-[18px]" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Dashboard" className="mt-7 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setNavigationOpen(false)}
                className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b85c3d]/30 ${
                  active
                    ? 'bg-[#dedbd3] text-[#272622] shadow-[inset_0_0_0_1px_rgba(89,83,72,0.05)]'
                    : 'text-[#68655d] hover:bg-[#e5e2db] hover:text-[#272622]'
                }`}
              >
                <Icon
                  className={`size-[17px] ${active ? 'text-[#9d4b32]' : 'text-[#8f8b81]'}`}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1 border-t border-[#d8d5cd] pt-3">
          <Link
            href="/system"
            aria-current={pathname === '/system' ? 'page' : undefined}
            onClick={() => setNavigationOpen(false)}
            className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b85c3d]/30 ${
              pathname === '/system'
                ? 'bg-[#dedbd3] text-[#272622]'
                : 'text-[#68655d] hover:bg-[#e5e2db] hover:text-[#272622]'
            }`}
          >
            <ServerCog className="size-[17px] text-[#8f8b81]" aria-hidden="true" />
            System health
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-[#dedbd2] bg-[#f6f5f1]/92 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            type="button"
            className="mr-3 grid size-9 place-items-center rounded-lg text-[#68655d] hover:bg-[#ebe8e1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b85c3d]/30 lg:hidden"
            aria-label="Open navigation"
            aria-expanded={navigationOpen}
            aria-controls="primary-navigation"
            onClick={() => setNavigationOpen(true)}
          >
            <Menu className="size-[18px]" aria-hidden="true" />
          </button>
          <div className="lg:hidden">
            <Brand compact />
          </div>
          <p className="hidden text-[13px] font-medium text-[#747168] lg:block">{pageTitle}</p>
        </header>
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
