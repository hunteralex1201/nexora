'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowUp, Bot, Plus, Square, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { PageHeader } from '@/components/page-header';
import {
  commerceRequest,
  streamAIChat,
  type AIChatMessage,
  type AIReadiness,
} from '@/lib/commerce-client';

const suggestions = [
  'Explain how you can help me',
  'Help me plan product research',
  'Write a short Bangla product summary',
];

export function AIWorkspace() {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeModel, setActiveModel] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

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
    setIsStreaming(false);
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-4xl flex-col">
      <PageHeader
        title="AI chat"
        actions={
          <button type="button" onClick={newChat} className="nx-button-secondary">
            <Plus className="size-4" aria-hidden="true" /> New chat
          </button>
        }
      />

      <div className="mt-4 flex items-center gap-2 text-xs text-[#747168]" aria-live="polite">
        <span
          className={`size-2 rounded-full ${ready ? 'status-pulse bg-[#287a55]' : 'bg-[#a5463c]'}`}
          aria-hidden="true"
        />
        {readiness.isLoading
          ? 'Checking local model…'
          : ready
            ? `${model} ready`
            : 'Local model unavailable'}
        {duration !== null && !isStreaming ? ` · ${(duration / 1000).toFixed(1)}s` : ''}
      </div>

      <section className="flex flex-1 flex-col py-8" aria-label="Conversation">
        {messages.length === 0 ? (
          <div className="my-auto flex flex-col items-center py-12 text-center">
            <div className="grid size-11 place-items-center rounded-2xl bg-[#eee5dc] text-[#9d4b32]">
              <Bot className="size-5" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.035em] text-[#2f2d28]">
              How can I help?
            </h2>
            <div className="mt-7 grid w-full max-w-xl gap-2 sm:grid-cols-3">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={!ready}
                  onClick={() => void sendMessage(suggestion)}
                  className="rounded-xl border border-[#dedbd2] bg-white px-4 py-3 text-left text-[13px] leading-5 text-[#56534c] shadow-[0_1px_2px_rgba(44,40,32,0.03)] transition hover:border-[#cfc9bd] hover:bg-[#fbfaf7] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-7" aria-live="polite">
            {messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' ? (
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-[#eee5dc] text-[#9d4b32]">
                    <Bot className="size-4" aria-hidden="true" />
                  </span>
                ) : null}
                <div
                  className={
                    message.role === 'user'
                      ? 'max-w-[82%] rounded-2xl rounded-br-md bg-[#eee9df] px-4 py-3 text-sm leading-6 text-[#34322d]'
                      : 'max-w-[88%] whitespace-pre-wrap pt-1 text-sm leading-7 text-[#3f3d37]'
                  }
                >
                  {message.content || (
                    <span className="inline-flex gap-1 pt-2" aria-label="AI is thinking">
                      <span className="size-1.5 animate-pulse rounded-full bg-[#b8b2a7]" />
                      <span className="size-1.5 animate-pulse rounded-full bg-[#b8b2a7] [animation-delay:150ms]" />
                      <span className="size-1.5 animate-pulse rounded-full bg-[#b8b2a7] [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
                {message.role === 'user' ? (
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-[#dedbd3] text-[#5f5c54]">
                    <UserRound className="size-4" aria-hidden="true" />
                  </span>
                ) : null}
              </article>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </section>

      <div className="sticky bottom-0 -mx-1 bg-[linear-gradient(to_bottom,transparent_0%,#f7f5f0_18%)] px-1 pb-1 pt-6">
        {error ? (
          <div role="alert" className="mb-2 text-center text-[13px] text-[#a5463c]">
            {error}
          </div>
        ) : null}
        <form
          onSubmit={submit}
          className="rounded-2xl border border-[#d5d0c6] bg-white p-2 shadow-[0_10px_35px_rgba(44,40,32,0.10)] focus-within:border-[#b9b2a6]"
        >
          <label htmlFor="ai-message" className="sr-only">
            Message NEXORA AI
          </label>
          <textarea
            id="ai-message"
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, 8000))}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={!ready || isStreaming}
            placeholder={ready ? 'Message NEXORA AI…' : 'Local model is unavailable'}
            className="max-h-44 min-h-14 w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-[#34322d] outline-none placeholder:text-[#a8a39a] disabled:cursor-not-allowed"
          />
          <div className="flex items-center justify-between gap-3 px-2 pb-1">
            <span className="text-[11px] text-[#aaa59b]">
              Enter to send · Shift+Enter for line break
            </span>
            {isStreaming ? (
              <button type="button" onClick={stopResponse} className="nx-button !min-h-9 !px-3">
                <Square className="size-3.5 fill-current" aria-hidden="true" /> Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!ready || !input.trim()}
                className="grid size-9 place-items-center rounded-xl bg-[#2f2d28] text-white transition hover:bg-[#47443d] disabled:cursor-not-allowed disabled:bg-[#d8d4cc]"
                aria-label="Send message"
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
