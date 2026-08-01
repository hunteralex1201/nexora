import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '@/components/app-shell';
import { Brand } from '@/components/brand';
import { PageHeader } from '@/components/page-header';
import { LoadingPanel, StatePanel } from '@/components/state-panel';

let pathname = '/overview';
const pushMock = vi.fn();

vi.mock('next/link', () => ({
  default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: pushMock }),
}));

describe('dashboard foundation components', () => {
  beforeEach(() => {
    pathname = '/overview';
    pushMock.mockReset();
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

  it('supports command search, modal focus containment, Escape, and Enter handoff', async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <p>Workspace content</p>
      </AppShell>,
    );

    const trigger = screen.getByRole('button', { name: 'Open command palette' });
    await user.click(trigger);
    const search = screen.getByRole('textbox', { name: 'Search commands' });
    await waitFor(() => expect(search).toHaveFocus());

    await user.tab({ shift: true });
    expect(screen.getByRole('link', { name: /Search product evidence/i })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'NEXORA command palette' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    const reopenedSearch = screen.getByRole('textbox', { name: 'Search commands' });
    await user.type(reopenedSearch, 'unlisted item');
    expect(screen.getByRole('status')).toHaveTextContent('No workspace commands match');
    await user.keyboard('{Enter}');
    expect(pushMock).toHaveBeenCalledWith('/products?q=unlisted%20item');
    expect(screen.queryByRole('dialog', { name: 'NEXORA command palette' })).not.toBeInTheDocument();
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
