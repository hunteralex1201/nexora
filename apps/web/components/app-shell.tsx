'use client';

import {
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  ServerCog,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Brand } from '@/components/brand';

const navigation = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/system', label: 'System', icon: ServerCog },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 lg:flex">
      {navigationOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm lg:hidden"
          onClick={() => setNavigationOpen(false)}
        />
      )}

      <aside
        id="primary-navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/8 bg-[#090e19]/98 p-5 shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          navigationOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <Brand />
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 lg:hidden"
            aria-label="Close navigation"
            onClick={() => setNavigationOpen(false)}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-8 rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/10 via-blue-500/5 to-transparent p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Foundation mode
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Demonstration shell. Live commerce evidence is not connected in Phase 0.
          </p>
        </div>

        <nav aria-label="Dashboard" className="mt-7 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setNavigationOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                  active
                    ? 'border border-violet-400/25 bg-violet-500/12 text-white shadow-[0_0_24px_rgba(124,58,237,0.08)]'
                    : 'border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                }`}
              >
                <Icon
                  className={`size-5 ${active ? 'text-violet-300' : 'text-slate-500'}`}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Database className="size-4 text-cyan-400" aria-hidden="true" />
              Core services
            </div>
            <p className="mt-1 text-sm font-medium text-slate-300">Awaiting readiness probe</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-sm font-medium text-slate-400 hover:border-rose-400/15 hover:bg-rose-500/[0.06] hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <LogOut className="size-5" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/8 bg-[#070b14]/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 lg:hidden"
            aria-label="Open navigation"
            aria-expanded={navigationOpen}
            aria-controls="primary-navigation"
            onClick={() => setNavigationOpen(true)}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right sm:block">
              <span className="block text-xs font-medium text-slate-300">Platform operator</span>
              <span className="block text-[11px] text-slate-600">Protected session</span>
            </span>
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-full border border-violet-400/25 bg-violet-500/10 text-xs font-semibold text-violet-200"
            >
              NO
            </span>
          </div>
        </header>
        <main id="main-content" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
