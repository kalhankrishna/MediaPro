'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ───

interface ApiKey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

// ─── Helpers ───

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (days > 30) return formatDate(iso);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

// ─── Sub-components ───

function NewKeyBanner({ keyValue, onDismiss }: { keyValue: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(keyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — user can manually select
    }
  }, [keyValue]);

  return (
    <div className="border border-emerald-800/60 rounded-sm mb-6 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-emerald-800/60 flex items-center justify-between">
        <p className="font-mono text-[11px] text-emerald-400">
          key created — copy it now. it will not be shown again.
        </p>
      </div>
      <div className="px-4 py-3 flex items-center gap-3">
        <code className="flex-1 font-mono text-[12px] text-white break-all select-all">
          {keyValue}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="font-mono text-[11px] shrink-0 text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-sm transition-colors duration-100 cursor-pointer"
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <div className="px-4 py-2.5 border-t border-emerald-800/60">
        <button
          type="button"
          onClick={onDismiss}
          className="font-mono text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors duration-100 cursor-pointer py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 rounded-sm"
        >
          I've copied this key →
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───

export default function ApiKeyManager({ initialKeys }: { initialKeys: ApiKey[] }) {
  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState('');

  const handleCreate = useCallback(async () => {
    const name = newKeyName.trim();
    if (!name || creating) return;

    setCreating(true);
    setCreateError('');

    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (res.status === 401) { router.push('/login?error=session_expired'); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Error ${res.status}`);
      }

      const data = await res.json() as { keyId: string; key: string; name: string };

      // Add the new key metadata to the list and reveal the raw key
      setKeys(prev => [{ id: data.keyId, name: data.name, createdAt: new Date().toISOString(), lastUsedAt: null }, ...prev]);
      setNewKeyValue(data.key);
      setNewKeyName('');
      setRevokingId(null); // clear any pending revoke confirm state
      nameInputRef.current?.focus();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  }, [newKeyName, creating, router]);

  const handleRevoke = useCallback(async (id: string) => {
    // First click: enter confirm state
    if (revokingId !== id) {
      setRevokingId(id);
      setRevokeError('');
      return;
    }

    // Second click: confirmed — execute revoke
    try {
      const res = await fetch(`/api/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.status === 401) { router.push('/login?error=session_expired'); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      setKeys(prev => prev.filter(k => k.id !== id));
      setRevokingId(null);
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Failed to revoke key');
      setRevokingId(null);
    }
  }, [revokingId, router]);

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[15px] font-medium text-white">API Keys</h1>
      </div>

      {/* New key banner — shown until explicitly dismissed */}
      {newKeyValue && (
        <NewKeyBanner
          keyValue={newKeyValue}
          onDismiss={() => setNewKeyValue(null)}
        />
      )}

      {/* Create form */}
      <div className="mb-8">
        <label htmlFor="key-name" className="sr-only">API key name</label>
        <div className="flex items-center gap-3">
          <input
            ref={nameInputRef}
            id="key-name"
            type="text"
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="key name…"
            disabled={creating}
            maxLength={64}
            className="flex-1 bg-zinc-900/60 border border-zinc-800 rounded-sm px-3 py-2 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors duration-100 font-sans disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newKeyName.trim() || creating}
            className="font-mono text-[12px] text-white border border-zinc-700 hover:border-zinc-500 px-4 py-3 rounded-sm transition-colors duration-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {creating ? 'creating…' : '+ create'}
          </button>
        </div>
        {createError && (
          <p className="font-mono text-[11px] text-red-400 mt-2">{createError}</p>
        )}
      </div>

      {/* Key list */}
      {keys.length === 0 ? (
        <p className="font-mono text-[11px] text-zinc-500">
          No API keys yet. Create one above to enable agent access via the MCP server.
        </p>
      ) : (
        <div className="border border-zinc-800/70 rounded-sm overflow-hidden">
          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-[1fr_160px_120px_80px] gap-x-4 px-4 py-2 border-b border-zinc-800/70 bg-zinc-900/30">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Name</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Created</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Last used</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500"></span>
          </div>

          {keys.map((key, i) => (
            <div
              key={key.id}
              className={`px-4 py-3 ${i < keys.length - 1 ? 'border-b border-zinc-800/50' : ''}`}
            >
              {/* Desktop */}
              <div className="hidden sm:grid grid-cols-[1fr_160px_120px_80px] gap-x-4 items-center">
                <span className="text-[13px] text-zinc-200 truncate">{key.name}</span>
                <span className="font-mono text-[11px] text-zinc-400">{formatDate(key.createdAt)}</span>
                <span className="font-mono text-[11px] text-zinc-400">{formatRelative(key.lastUsedAt)}</span>
                <div className="flex justify-end">
                  {revokingId === key.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRevoke(key.id)}
                        className="font-mono text-[11px] text-red-400 hover:text-red-300 transition-colors duration-100 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 rounded-sm"
                      >
                        confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setRevokingId(null)}
                        className="font-mono text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors duration-100 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 rounded-sm"
                      >
                        cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRevoke(key.id)}
                      className="font-mono text-[11px] text-zinc-500 hover:text-red-400 transition-colors duration-100 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 rounded-sm"
                    >
                      revoke
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile: 2-line layout */}
              <div className="sm:hidden">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] text-zinc-200 truncate mr-4">{key.name}</span>
                  {revokingId === key.id ? (
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRevoke(key.id)}
                        className="font-mono text-[11px] text-red-400 hover:text-red-300 transition-colors duration-100 cursor-pointer"
                      >
                        confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setRevokingId(null)}
                        className="font-mono text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors duration-100 cursor-pointer"
                      >
                        cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRevoke(key.id)}
                      className="font-mono text-[11px] text-zinc-500 hover:text-red-400 transition-colors duration-100 cursor-pointer shrink-0"
                    >
                      revoke
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-zinc-500">{formatDate(key.createdAt)}</span>
                  <span className="font-mono text-[11px] text-zinc-600">·</span>
                  <span className="font-mono text-[11px] text-zinc-500">last used {formatRelative(key.lastUsedAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Revoke error */}
      {revokeError && (
        <p className="font-mono text-[11px] text-red-400 mt-3">{revokeError}</p>
      )}

      {/* Screen-reader status */}
      <span role="status" aria-live="polite" className="sr-only">
        {creating ? 'Creating API key…' : ''}
      </span>
    </div>
  );
}
