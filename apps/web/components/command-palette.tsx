'use client';

import {
  BellRing,
  Bot,
  Boxes,
  BrainCircuit,
  ChartNoAxesCombined,
  FileChartColumn,
  Gauge,
  Network,
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
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const commands = [
  { href: '/overview', label: 'Open overview', hint: 'Executive status', icon: Gauge },
  { href: '/ai', label: 'Ask NEXORA AI', hint: 'Local Qwen Copilot', icon: BrainCircuit },
  { href: '/sources', label: 'Manage sources', hint: 'Connect, import, collect', icon: RadioTower },
  { href: '/products', label: 'Browse products', hint: 'Prices and evidence', icon: PackageSearch },
  { href: '/market', label: 'Open market intelligence', hint: 'Signals and AI insights', icon: ChartNoAxesCombined },
  { href: '/agents', label: 'View agent operations', hint: 'Collection and analysis', icon: Bot },
  { href: '/jobs', label: 'Open automation', hint: 'Runs, failures, retries', icon: Boxes },
  { href: '/workflows', label: 'Open workflows', hint: 'Scheduled operations', icon: Workflow },
  { href: '/alerts', label: 'Review alerts', hint: 'Rules and events', icon: BellRing },
  { href: '/reports', label: 'Create a report', hint: 'Export live workspace data', icon: FileChartColumn },
  { href: '/integrations', label: 'View integrations', hint: 'Connectors and local services', icon: PlugZap },
  { href: '/system', label: 'Check system health', hint: 'Dependencies and models', icon: ServerCog },
  { href: '/settings', label: 'Open settings', hint: 'Workspace preferences', icon: Settings2 },
  { href: '/products', label: 'Search product evidence', hint: 'Name, brand, category, ID', icon: Network },
] as const;

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef(true);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      if (restoreFocusRef.current) previous?.focus();
    };
  }, [onClose, open]);


  const visibleCommands = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.hint}`.toLowerCase().includes(normalized),
    );
  }, [query]);

  if (!open) return null;

  const productSearchHref = `/products?q=${encodeURIComponent(query.trim())}`;

  function closeForNavigation() {
    restoreFocusRef.current = false;
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-3 pt-[10vh] sm:px-6 sm:pt-[14vh]">
      <button
        type="button"
        aria-label="Close command palette backdrop"
        tabIndex={-1}
        className="absolute inset-0 bg-[#02040a]/78 backdrop-blur-md"
        onClick={onClose}
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0b1120]/98 shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
      >
        <h2 id="command-palette-title" className="sr-only">
          NEXORA command palette
        </h2>

        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 sm:px-5">
          <Search className="size-[18px] shrink-0 text-[var(--faint)]" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !query.trim()) return;
              event.preventDefault();
              restoreFocusRef.current = false;
              flushSync(() => onClose());
              router.push(productSearchHref);
            }}
            placeholder="Navigate or search product evidence…"
            aria-label="Search commands"
            className="h-14 min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--faint)] sm:h-16"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            className="nx-icon-button size-8"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[min(62vh,520px)] overflow-y-auto p-2.5 sm:p-3">
          {query.trim() ? (
            <Link
              href={productSearchHref}
              onClick={closeForNavigation}
              className="mb-2 flex items-center gap-3 rounded-xl border border-[var(--blue)]/25 bg-[var(--blue)]/[0.08] px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/60"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--blue)]/12 text-[var(--blue)]">
                <Search className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-[var(--text)]">
                  Search products for “{query.trim()}”
                </span>
                <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                  Search live product names, brands, categories, and external IDs
                </span>
              </span>
              <kbd className="hidden rounded-md border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[var(--faint)] sm:block">
                Enter
              </kbd>
            </Link>
          ) : null}

          <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
            Workspace
          </p>
          <div className="grid gap-1 sm:grid-cols-2">
            {visibleCommands.map((command) => {
              const Icon = command.icon;
              return (
                <Link
                  key={`${command.href}-${command.label}`}
                  href={command.href}
                  onClick={closeForNavigation}
                  className="group flex min-h-[54px] items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/60"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-[var(--muted)] group-hover:border-[var(--blue)]/25 group-hover:text-[var(--blue)]">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-[var(--text)]">
                      {command.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-[var(--faint)]">
                      {command.hint}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>

          {visibleCommands.length === 0 ? (
            <div role="status" className="px-4 py-10 text-center text-sm text-[var(--muted)]">
              No workspace commands match. Press Enter to search product evidence for “{query.trim()}”.
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-2.5 text-[10px] text-[var(--faint)] sm:px-5">
          <span>Private workspace · product search uses live NEXORA data</span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <kbd className="rounded border border-white/[0.1] px-1.5 py-0.5">Esc</kbd>
            close
          </span>
        </div>
      </section>
    </div>
  );
}
