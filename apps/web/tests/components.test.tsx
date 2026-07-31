import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '@/components/app-shell';
import { Brand } from '@/components/brand';
import { PageHeader } from '@/components/page-header';
import { LoadingPanel, StatePanel } from '@/components/state-panel';

let pathname = '/overview';

vi.mock('next/link', () => ({
  default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

describe('dashboard foundation components', () => {
  beforeEach(() => {
    pathname = '/overview';
  });

  it('renders the brand with a descriptive home link', () => {
    render(<Brand />);

    expect(screen.getByRole('link', { name: /nexora intelligence home/i })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByText('NEXORA')).toBeInTheDocument();
  });

  it('marks the active dashboard navigation item and preserves desktop layout', () => {
    const { container } = render(
      <AppShell>
        <p>Workspace content</p>
      </AppShell>,
    );

    expect(container.firstElementChild).toHaveClass('lg:flex');
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Workspace content')).toBeInTheDocument();
  });

  it('opens and closes mobile navigation accessibly', async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <p>Workspace content</p>
      </AppShell>,
    );

    const openButton = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(openButton);
    expect(openButton).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(openButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders reusable headings and state messaging', () => {
    render(
      <>
        <PageHeader eyebrow="System" title="Readiness" description="Current platform state" />
        <StatePanel variant="restricted" title="Restricted" description="Approval required" />
        <LoadingPanel label="Loading evidence" />
      </>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Readiness' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Restricted' })).toBeInTheDocument();
    expect(screen.getByText('Loading evidence').closest('section')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('has no automatically detectable accessibility violations in the shell', async () => {
    const { container } = render(
      <AppShell>
        <PageHeader eyebrow="Overview" title="Foundation" description="Validated platform status" />
      </AppShell>,
    );

    const result = await axe.run(container);
    expect(result.violations).toEqual([]);
  });
});
