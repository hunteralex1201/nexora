'use client';

import {
  BellRing,
  Bot,
  Boxes,
  BrainCircuit,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  FileChartColumn,
  Gauge,
  Menu,
  PackageSearch,
  PlugZap,
  RadioTower,
  Search,
  ServerCog,
  Settings2,
  Workflow,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { Brand } from '@/components/brand';
import { CommandPalette } from '@/components/command-palette';

const navigationGroups = [
  {
    label: 'Core',
    items: [
      { href: '/overview', label: 'Overview', icon: Gauge },
      { href: '/ai', label: 'AI Copilot', icon: BrainCircuit, badge: 'Live' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/sources', label: 'Sources', icon: RadioTower },
      { href: '/products', label: 'Products', icon: PackageSearch },
      { href: '/market', label: 'Market Intel', icon: ChartNoAxesCombined },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/agents', label: 'Agents', icon: Bot },
      { href: '/jobs', label: 'Automation', icon: Boxes },
      { href: '/workflows', label: 'Workflows', icon: Workflow },
    ],
  },
  {
    label: 'Control',
    items: [
      { href: '/alerts', label: 'Alerts', icon: BellRing },
      { href: '/reports', label: 'Reports', icon: FileChartColumn },
      { href: '/integrations', label: 'Integrations', icon: PlugZap },
    ],
  },
] as const;

const platformNavigation = [
  { href: '/system', label: 'System health', icon: ServerCog },
  { href: '/settings', label: 'Settings', icon: Settings2 },
] as const;

const pageTitles: Record<string, string> = {
  '/overview': 'Overview',
  '/ai': 'AI Copilot',
  '/sources': 'Sources',
  '/products': 'Products',
  '/market': 'Market Intelligence',
  '/agents': 'Agent Operations',
  '/jobs': 'Automation',
  '/workflows': 'Workflows',
  '/alerts': 'Alerts',
  '/reports': 'Reports',
  '/integrations': 'Integrations',
  '/system': 'System Health',
  '/settings': 'Settings',
};

function isCurrentRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteRoute, setPaletteRoute] = useState<string | null>(null);
  const pageTitle = pageTitles[pathname] ?? 'Workspace';
  const paletteOpen = paletteRoute === pathname;
  const closePalette = useCallback(() => setPaletteRoute(null), []);
  const openPalette = useCallback(() => setPaletteRoute(pathname), [pathname]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem('nexora-sidebar-collapsed');
      setSidebarCollapsed(stored === 'true');
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteRoute((current) => (current === pathname ? null : pathname));
      }
      if (event.key === 'Escape') setNavigationOpen(false);
    }

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [pathname]);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('nexora-sidebar-collapsed', String(next));
      return next;
    });
  }

  function navItemClass(active: boolean) {
    return `group relative flex min-h-9 items-center gap-3 rounded-xl px-3 text-[12.5px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/60 lg:min-h-10 ${
      sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''
    } ${
      active
        ? 'border border-[var(--blue)]/20 bg-[linear-gradient(90deg,rgba(91,140,255,0.16),rgba(91,140,255,0.055))] text-white shadow-[inset_3px_0_0_rgba(91,140,255,0.9)]'
        : 'border border-transparent text-[var(--muted)] hover:border-white/[0.06] hover:bg-white/[0.045] hover:text-white'
    }`;
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--text)] lg:flex">
      {navigationOpen ? (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-[#02040a]/78 backdrop-blur-sm lg:hidden"
          onClick={() => setNavigationOpen(false)}
        />
      ) : null}

      <aside
        id="primary-navigation"
        data-collapsed={sidebarCollapsed}
        className={`fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-white/[0.08] bg-[var(--sidebar)] px-3 py-4 shadow-[24px_0_80px_rgba(0,0,0,0.34)] transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          sidebarCollapsed ? 'lg:w-[76px]' : 'lg:w-[244px]'
        } ${navigationOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className={`flex h-11 items-center px-2 ${sidebarCollapsed ? 'lg:justify-center' : ''}`}>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="hidden lg:block">
            <Brand compact={sidebarCollapsed} />
          </div>
          <button
            type="button"
            className="nx-icon-button ml-auto lg:hidden"
            aria-label="Close navigation"
            onClick={() => setNavigationOpen(false)}
          >
            <X className="size-[18px]" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin]">
          <nav aria-label="Dashboard" className="space-y-4 lg:space-y-5">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <p
                  className={`mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--faint)] ${
                    sidebarCollapsed ? 'lg:sr-only' : ''
                  }`}
                >
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isCurrentRoute(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setNavigationOpen(false)}
                        className={navItemClass(active)}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <Icon
                          className={`size-[17px] shrink-0 ${
                            active ? 'text-[var(--blue)]' : 'text-[var(--faint)] group-hover:text-[var(--muted)]'
                          }`}
                          aria-hidden="true"
                        />
                        <span className={sidebarCollapsed ? 'lg:sr-only' : ''}>{item.label}</span>
                        {'badge' in item && !sidebarCollapsed ? (
                          <span className="ml-auto rounded-full border border-[var(--violet)]/25 bg-[var(--violet)]/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[#c8b9ff]">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-3 border-t border-white/[0.08] pt-3">
          <div className="space-y-1">
            {platformNavigation.map((item) => {
              const Icon = item.icon;
              const active = isCurrentRoute(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setNavigationOpen(false)}
                  className={navItemClass(active)}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon
                    className={`size-[17px] shrink-0 ${active ? 'text-[var(--blue)]' : 'text-[var(--faint)]'}`}
                    aria-hidden="true"
                  />
                  <span className={sidebarCollapsed ? 'lg:sr-only' : ''}>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div
            className={`mt-3 flex items-center gap-2.5 rounded-xl border border-[var(--emerald)]/15 bg-[var(--emerald)]/[0.055] px-3 py-2.5 ${
              sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''
            }`}
          >
            <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--emerald)] opacity-25 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2.5 rounded-full bg-[var(--emerald)]" />
            </span>
            <span className={sidebarCollapsed ? 'lg:sr-only' : ''}>
              <span className="block text-[10px] font-semibold text-[#a9f4d6]">Local-first workspace</span>
              <span className="mt-0.5 block text-[9px] text-[var(--faint)]">Private AI · no sign-in</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="nx-icon-button absolute -right-3 top-[74px] z-10 hidden size-7 border-white/[0.12] bg-[var(--surface-2)] shadow-lg lg:grid"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronLeft className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.08] bg-[var(--canvas)]/88 px-3 backdrop-blur-xl sm:px-5 lg:px-6">
          <button
            type="button"
            className="nx-icon-button lg:hidden"
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

          <p className="hidden min-w-0 truncate text-[12px] font-semibold text-[var(--muted)] sm:block lg:w-36">
            {pageTitle}
          </p>

          <button
            type="button"
            onClick={openPalette}
            className="group mx-auto flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 text-left text-[12px] text-[var(--faint)] hover:border-white/[0.15] hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/60 sm:max-w-xl"
            aria-label="Open command palette"
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">Search NEXORA or run a command</span>
            <kbd className="hidden rounded-md border border-white/[0.1] bg-black/20 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--faint)] sm:block">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/ai"
              className="hidden h-9 items-center gap-2 rounded-xl border border-[var(--violet)]/20 bg-[var(--violet)]/[0.08] px-3 text-[11px] font-semibold text-[#d7ceff] hover:border-[var(--violet)]/35 hover:bg-[var(--violet)]/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--violet)]/55 md:inline-flex"
            >
              <BrainCircuit className="size-4" aria-hidden="true" />
              Ask AI
            </Link>
            <Link href="/alerts" className="nx-icon-button" aria-label="Open alerts">
              <BellRing className="size-[17px]" aria-hidden="true" />
            </Link>
            <Link
              href="/system"
              className="nx-icon-button hidden sm:grid"
              aria-label="Open system health"
            >
              <span className="size-2.5 rounded-full bg-[var(--emerald)] shadow-[0_0_14px_rgba(52,211,153,0.45)]" />
            </Link>
          </div>
        </header>

        <main
          id="main-content"
          className="relative mx-auto w-full max-w-[1660px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 2xl:px-10"
        >
          {children}
        </main>
      </div>

      {paletteOpen ? <CommandPalette open onClose={closePalette} /> : null}
    </div>
  );
}
