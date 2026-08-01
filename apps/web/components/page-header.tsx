import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a4553a]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[26px] font-semibold tracking-[-0.035em] text-[#272622] sm:text-[30px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-xl text-[13px] leading-5 text-[#747168]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
