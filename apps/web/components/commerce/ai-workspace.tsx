'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUp,
  Bot,
  Check,
  Clipboard,
  Cpu,
  DatabaseZap,
  FileSearch,
  Gauge,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Sparkles,
  Square,
  UserRound,
  Workflow,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { PageHeader } from '@/components/page-header';
import {
  commerceRequest,
  streamAIChat,
  type AIChatMessage,
  type AIReadiness,
} from '@/lib/commerce-client';

const suggestions = [
  {
    label: 'Explain how you can help me',
    detail: 'Learn the Copilot’s evidence and automation scope',
    icon: Sparkles,
  },
  {
    label: 'Help me plan product research',
    detail: 'Build a concise workflow from source to insight',
    icon: FileSearch,
  },
  {
    label: 'Write a short Bangla product summary',
    detail: 'Generate a localized summary with the local model',
    icon: MessageSquareText,
  },
];

const capabilityRows = [
  { label: 'Product evidence', icon: DatabaseZap, href: '/products' },
  { label: 'Automation planning', icon: Workflow, href: '/jobs' },
  { label: 'Operational reasoning', icon: Gauge, href: '/overview' },
];

export function AIWorkspace() {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeModel, setActiveModel] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [copiedMessage, setCopiedMessage] = useState<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const readiness = useQuery({
    queryKey: ['commerce', 'ai-readiness'],
    queryFn: () => commerceRequest<AIReadiness>('ai/readiness'),
    refetchInterval: 30_000,
  });
  const ready = readiness.data?.status === 'ready';
  const model = activeModel || readiness.data?.expected_chat_model || 'Local AI';

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const prompt = new URLSearchParams(window.location.search).get('prompt')?.trim();
      if (prompt) {
        setInput(prompt.slice(0, 8000));
        inputRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  async function sendMessage(content: string) {
    const prompt = content.trim();
    if (!prompt || !ready || isStreaming) return;

    const requestMessages: AIChatMessage[] = [...messages, { role: 'user', content: prompt }];
    setMessages([...requestMessages, { role: 'assistant', content: '' }]);
    setInput('');
    setError('');
    setDuration(null);
    setCopiedMessage(null);
    setIsStreaming(true);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      await streamAIChat(
        requestMessages,
        (event) => {
          if (event.type === 'start' && event.model) setActiveModel(event.model);
          if (event.type === 'token' && event.content) {
            setMessages((current) => {
              const updated = [...current];
              const last = updated.at(-1);
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + event.content,
                };
              }
              return updated;
            });
          }
          if (event.type === 'done') {
            setDuration(event.total_duration_ms ?? null);
            if (event.model) setActiveModel(event.model);
          }
        },
        controller.signal,
      );
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(caught instanceof Error ? caught.message : 'Local AI could not respond.');
      setMessages((current) => {
        const last = current.at(-1);
        return last?.role === 'assistant' && !last.content ? current.slice(0, -1) : current;
      });
    } finally {
      controllerRef.current = null;
      setIsStreaming(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  function stopResponse() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsStreaming(false);
    setMessages((current) => {
      const last = current.at(-1);
      return last?.role === 'assistant' && !last.content ? current.slice(0, -1) : current;
    });
  }

  function newChat() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setMessages([]);
    setInput('');
    setError('');
    setDuration(null);
    setCopiedMessage(null);
    setIsStreaming(false);
    inputRef.current?.focus();
  }

  async function copyMessage(content: string, index: number) {
    try {
      await window.navigator.clipboard.writeText(content);
      setCopiedMessage(index);
      window.setTimeout(() => setCopiedMessage(null), 1600);
    } catch {
      setError('Could not copy this response.');
    }
  }

  const userTurns = messages.filter((message) => message.role === 'user').length;

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] flex-col">
      <PageHeader
        eyebrow="Private local intelligence"
        title="AI chat"
        description="Reason with your configured Qwen model through a live, cancellable stream. No account sign-in is required."
        actions={
          <button type="button" onClick={newChat} className="nx-button-secondary">
            <Plus className="size-4" aria-hidden="true" /> New chat
          </button>
        }
      />

      <div className="mt-5 grid min-h-0 flex-1 gap-4 xl:grid-cols-[210px_minmax(0,1fr)_238px]">
        <aside className="nx-panel hidden overflow-hidden xl:flex xl:flex-col" aria-label="Conversation information">
          <div className="border-b border-white/[0.07] p-4">
            <p className="nx-kicker">Session</p>
            <h2 className="mt-2 text-[13px] font-semibold text-[var(--text)]">Current conversation</h2>
            <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">Transient browser session</p>
          </div>
          <div className="p-3">
            <button
              type="button"
              onClick={newChat}
              className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--blue)]/20 bg-[var(--blue)]/[0.07] px-3 py-2.5 text-left text-[11px] font-semibold text-[#b9ccff] hover:bg-[var(--blue)]/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/60"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Start new chat
            </button>
          </div>
          <div className="border-t border-white/[0.07] p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--faint)]">Capabilities</p>
            <div className="mt-2 space-y-1">
              {capabilityRows.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[10px] text-[var(--muted)] hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/60"
                  >
                    <Icon className="size-3.5 text-[var(--faint)]" aria-hidden="true" />
                    {item.label}
                  </a>
                );
              })}
            </div>
          </div>
          <div className="mt-auto border-t border-white/[0.07] p-4 text-[9px] leading-4 text-[var(--faint)]">
            <ShieldCheck className="mb-2 size-4 text-[var(--emerald)]" aria-hidden="true" />
            Prompts are sent to the configured local Ollama runtime. Verify important decisions against source evidence.
          </div>
        </aside>

        <section className="nx-panel flex min-h-[600px] min-w-0 flex-col overflow-hidden" aria-label="Conversation">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.07] px-4 py-3 sm:px-5">
            <span className="inline-flex items-center gap-2 text-[10px] font-semibold text-[var(--text)]" aria-live="polite">
              <span
                className={`size-2 rounded-full ${ready ? 'status-pulse bg-[var(--emerald)]' : readiness.isLoading ? 'animate-pulse bg-[var(--amber)]' : 'bg-[var(--red)]'}`}
                aria-hidden="true"
              />
              {readiness.isLoading
                ? 'Checking local model…'
                : ready
                  ? `${model} ready`
                  : 'Local model unavailable'}
            </span>
            <span className="text-[9px] text-[var(--faint)]">{userTurns} prompt{userTurns === 1 ? '' : 's'}</span>
            {duration !== null && !isStreaming ? (
              <span className="text-[9px] text-[var(--faint)]">Last response {(duration / 1000).toFixed(1)}s</span>
            ) : null}
            <span className="ml-auto hidden items-center gap-1.5 text-[9px] text-[var(--faint)] sm:inline-flex">
              <ShieldCheck className="size-3 text-[var(--emerald)]" aria-hidden="true" />
              Local stream
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
            {messages.length === 0 ? (
              <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center py-8 text-center">
                <span className="relative grid size-14 place-items-center rounded-2xl border border-[var(--violet)]/24 bg-[linear-gradient(145deg,rgba(155,123,255,0.14),rgba(91,140,255,0.07))] text-[var(--violet)] shadow-[0_0_50px_rgba(155,123,255,0.09)]">
                  <span className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                  <Bot className="size-6" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-[24px] font-semibold tracking-[-0.04em] text-[var(--text)]">How can I help?</h2>
                <p className="mt-2 max-w-lg text-[11px] leading-5 text-[var(--muted)]">
                  Ask about product evidence, automation planning, alert interpretation, or request content from your local model.
                </p>
                <div className="mt-7 grid w-full gap-2.5 md:grid-cols-3">
                  {suggestions.map((suggestion) => {
                    const Icon = suggestion.icon;
                    return (
                      <button
                        key={suggestion.label}
                        type="button"
                        disabled={!ready}
                        onClick={() => void sendMessage(suggestion.label)}
                        className="group rounded-xl border border-white/[0.09] bg-white/[0.025] p-3.5 text-left hover:border-[var(--blue)]/25 hover:bg-[var(--blue)]/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/60 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Icon className="size-4 text-[var(--blue)]" aria-hidden="true" />
                        <span className="mt-3 block text-[11px] font-semibold leading-4 text-[var(--text)]">{suggestion.label}</span>
                        <span className="mt-1 block text-[9px] leading-4 text-[var(--faint)]">{suggestion.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-7" aria-live="polite">
                {messages.map((message, index) => (
                  <article
                    key={`${message.role}-${index}`}
                    className={`group flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' ? (
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl border border-[var(--violet)]/20 bg-[var(--violet)]/[0.08] text-[var(--violet)]">
                        <Bot className="size-4" aria-hidden="true" />
                      </span>
                    ) : null}
                    <div className={`min-w-0 ${message.role === 'user' ? 'max-w-[82%]' : 'max-w-[88%]'}`}>
                      <div
                        className={
                          message.role === 'user'
                            ? 'rounded-2xl rounded-br-md border border-[var(--blue)]/14 bg-[var(--blue)]/[0.09] px-4 py-3 text-[13px] leading-6 text-[#e7eeff]'
                            : 'whitespace-pre-wrap pt-1 text-[13px] leading-7 text-[#dce4f0]'
                        }
                      >
                        {message.content || (
                          <span className="inline-flex gap-1 pt-2" aria-label="AI is thinking">
                            <span className="size-1.5 animate-pulse rounded-full bg-[var(--violet)]" />
                            <span className="size-1.5 animate-pulse rounded-full bg-[var(--violet)] [animation-delay:150ms]" />
                            <span className="size-1.5 animate-pulse rounded-full bg-[var(--violet)] [animation-delay:300ms]" />
                          </span>
                        )}
                      </div>
                      {message.role === 'assistant' && message.content ? (
                        <button
                          type="button"
                          onClick={() => void copyMessage(message.content, index)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[9px] text-[var(--faint)] opacity-100 hover:bg-white/[0.04] hover:text-[var(--text)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/60 sm:opacity-0 sm:group-hover:opacity-100"
                          aria-label="Copy AI response"
                        >
                          {copiedMessage === index ? <Check className="size-3" aria-hidden="true" /> : <Clipboard className="size-3" aria-hidden="true" />}
                          {copiedMessage === index ? 'Copied' : 'Copy'}
                        </button>
                      ) : null}
                    </div>
                    {message.role === 'user' ? (
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl border border-white/[0.09] bg-white/[0.04] text-[var(--muted)]">
                        <UserRound className="size-4" aria-hidden="true" />
                      </span>
                    ) : null}
                  </article>
                ))}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.07] bg-[var(--surface-1)]/96 p-3 sm:p-4">
            {error ? (
              <div role="alert" className="mb-2.5 rounded-lg border border-[var(--red)]/18 bg-[var(--red)]/[0.06] px-3 py-2 text-center text-[10px] text-[#ff9aad]">
                {error}
              </div>
            ) : null}
            <form
              onSubmit={submit}
              className="rounded-2xl border border-white/[0.12] bg-[#070c16] p-2 shadow-[0_16px_50px_rgba(0,0,0,0.28)] focus-within:border-[var(--blue)]/42 focus-within:shadow-[0_0_0_3px_rgba(91,140,255,0.08)]"
            >
              <label htmlFor="ai-message" className="sr-only">Message NEXORA AI</label>
              <textarea
                ref={inputRef}
                id="ai-message"
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 8000))}
                onKeyDown={handleKeyDown}
                rows={2}
                disabled={!ready || isStreaming}
                placeholder={ready ? 'Message NEXORA AI…' : 'Local model is unavailable'}
                className="max-h-44 min-h-14 w-full resize-none bg-transparent px-3 py-2 text-[13px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--faint)] disabled:cursor-not-allowed"
              />
              <div className="flex items-center justify-between gap-3 px-2 pb-1">
                <span className="text-[9px] text-[var(--faint)]">Enter to send · Shift+Enter for line break · {input.length}/8000</span>
                {isStreaming ? (
                  <button type="button" onClick={stopResponse} className="nx-button !min-h-9 !px-3">
                    <Square className="size-3.5 fill-current" aria-hidden="true" /> Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!ready || !input.trim()}
                    className="grid size-9 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--blue),var(--violet))] text-white shadow-[0_8px_24px_rgba(91,140,255,0.2)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/60 disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-[var(--faint)] disabled:shadow-none"
                    aria-label="Send message"
                  >
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </form>
            <p className="mt-2 text-center text-[8px] text-[var(--faint)]">Local AI may make mistakes. Review evidence before operational decisions.</p>
          </div>
        </section>

        <aside className="hidden space-y-4 xl:block" aria-label="Local model information">
          <article className="nx-panel overflow-hidden">
            <div className="border-b border-white/[0.07] p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg border border-[var(--emerald)]/18 bg-[var(--emerald)]/[0.07] text-[var(--emerald)]">
                  <Cpu className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold text-[var(--text)]">Model runtime</p>
                  <p className="mt-0.5 text-[9px] text-[var(--faint)]">Configured Ollama service</p>
                </div>
              </div>
            </div>
            <dl className="divide-y divide-white/[0.065] px-4">
              <div className="py-3">
                <dt className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">Chat model</dt>
                <dd className="mt-1 truncate text-[10px] font-semibold text-[var(--text)]">{readiness.data?.expected_chat_model ?? 'Checking…'}</dd>
              </div>
              <div className="py-3">
                <dt className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">Embedding model</dt>
                <dd className="mt-1 truncate text-[10px] font-semibold text-[var(--text)]">{readiness.data?.expected_embedding_model ?? 'Checking…'}</dd>
              </div>
              <div className="py-3">
                <dt className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">Installed models</dt>
                <dd className="mt-1 text-[10px] font-semibold text-[var(--text)]">{readiness.data?.installed_models.length ?? '—'}</dd>
              </div>
            </dl>
            <a href="/system" className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3 text-[9px] font-semibold text-[var(--blue-strong)] hover:bg-white/[0.025] hover:text-white">
              Inspect readiness <ArrowRight className="size-3" aria-hidden="true" />
            </a>
          </article>

          <article className="nx-panel p-4">
            <p className="nx-kicker !text-[#f7c889]">Guardrail</p>
            <h2 className="mt-2 text-[12px] font-semibold text-[var(--text)]">Evidence before action</h2>
            <p className="mt-2 text-[9px] leading-4 text-[var(--muted)]">The chat model can help reason and draft, but it does not silently execute automation or alter commerce records.</p>
          </article>
        </aside>
      </div>
    </div>
  );
}
