'use client';

import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@/store/useWorkspace';
import { buildPrompt, downloadLayout, parseLayout } from '@/lib/scene/layout';

/**
 * One dialog for the whole round-trip: copy the prompt out, paste the AI's
 * reply back. Export and import were separate modals, which made a single
 * workflow feel like two unrelated features.
 */
export function LayoutDialog() {
  const exported = useWorkspace((s) => s.exported);
  const setExported = useWorkspace((s) => s.setExported);
  const applyImport = useWorkspace((s) => s.applyImport);
  const say = useWorkspace((s) => s.say);

  const [request, setRequest] = useState('');
  const [incoming, setIncoming] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!exported) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExported(null);
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [exported, setExported]);

  // Reset the paste box each time the dialog opens, so a previous failed
  // attempt isn't sitting there when you come back.
  useEffect(() => {
    if (exported) {
      setIncoming('');
      setError(null);
    }
  }, [exported]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  if (!exported) return null;

  const empty = exported.items.length === 0;
  const prompt = buildPrompt(exported, request);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      // clipboard needs a secure context; the textarea is selectable as a fallback
      say('Copy failed — select the text and copy manually.');
    }
  };

  const load = (text: string) => {
    try {
      const { file, skipped } = parseLayout(text);
      applyImport(file, skipped);
      setExported(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that layout.');
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // reset first so picking the same file twice still fires a change event
    e.target.value = '';
    if (f) load(await f.text());
  };

  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center bg-stone-900/40 p-4 backdrop-blur-sm"
      onClick={() => setExported(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export, Import, or Edit with AI"
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold">Export, Import, or Edit with AI</h2>
            <p className="mt-0.5 text-[13px] text-stone-500">
              Send your layout to an AI, then paste its reply back.
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={() => setExported(null)}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="text-[13px] font-semibold text-stone-900">
              1. Copy this to an AI
              <span className="ml-1.5 font-normal text-stone-400">
                {empty ? 'empty room' : `${exported.items.length} items`}
              </span>
            </h3>

            <input
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="What to change, e.g. desk against the far wall, plant on it"
              className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2 text-[13px] outline-none transition placeholder:text-stone-400 focus:border-stone-500"
            />

            <textarea
              readOnly
              value={prompt}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-2 h-40 w-full resize-none rounded-xl border border-stone-200 bg-stone-50 p-3 font-mono text-[11px] leading-relaxed text-stone-600 outline-none"
            />

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={copy}
                disabled={empty}
                aria-describedby={empty ? 'export-empty-hint' : undefined}
                className="rounded-xl bg-stone-900 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
              >
                {copied ? 'Copied ✓' : 'Copy prompt'}
              </button>
              <button
                onClick={() => {
                  downloadLayout(exported);
                  say('Layout downloaded');
                }}
                disabled={empty}
                aria-describedby={empty ? 'export-empty-hint' : undefined}
                className="rounded-xl px-3 py-2 text-[13px] font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
              >
                Download .json
              </button>
              {empty && (
                <p id="export-empty-hint" className="text-[12px] text-stone-500">
                  Add an item to your room first.
                </p>
              )}
            </div>
          </section>

          <section className="border-t border-stone-200 pt-4">
            <h3 className="text-[13px] font-semibold text-stone-900">2. Paste the reply back</h3>

            <textarea
              value={incoming}
              onChange={(e) => {
                setIncoming(e.target.value);
                setError(null);
              }}
              placeholder='{ "version": 1, "items": [ ... ] }'
              className="mt-2 h-28 w-full resize-none rounded-xl border border-stone-300 p-3 font-mono text-[11px] leading-relaxed outline-none transition placeholder:text-stone-400 focus:border-stone-500"
            />

            {error && <p className="mt-1.5 text-[12px] text-red-600">{error}</p>}

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => load(incoming)}
                disabled={!incoming.trim()}
                className="rounded-xl bg-stone-900 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
              >
                Apply layout
              </button>
              <button
                onClick={() => fileInput.current?.click()}
                className="rounded-xl px-3 py-2 text-[13px] font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
              >
                Upload .json
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                onChange={onFile}
                className="hidden"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
